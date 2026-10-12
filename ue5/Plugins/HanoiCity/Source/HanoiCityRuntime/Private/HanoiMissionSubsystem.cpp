#include "HanoiMissionSubsystem.h"
#include "HanoiCitySettings.h"
#include "HanoiContentSubsystem.h"
#include "HanoiGeoSubsystem.h"
#include "HanoiHeatSubsystem.h"
#include "HanoiTimeWeatherSubsystem.h"
#include "Dom/JsonObject.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "Kismet/GameplayStatics.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

namespace HanoiMission
{
	const FName End(TEXT("end"));
	const FName Success(TEXT("success"));
	const FName Fail(TEXT("fail"));
	const FName Default(TEXT("default"));
}

void UHanoiMissionSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Collection.InitializeDependency(UHanoiContentSubsystem::StaticClass());
	Collection.InitializeDependency(UHanoiTimeWeatherSubsystem::StaticClass());
	Super::Initialize(Collection);
	State.MoneyVnd = UHanoiCitySettings::Get()->StartingMoneyVnd;
	bReady = true;
}

void UHanoiMissionSubsystem::Deinitialize()
{
	bReady = false;
	Super::Deinitialize();
}

TStatId UHanoiMissionSubsystem::GetStatId() const
{
	RETURN_QUICK_DECLARE_CYCLE_STAT(UHanoiMissionSubsystem, STATGROUP_Tickables);
}

UWorld* UHanoiMissionSubsystem::GetGameWorld() const
{
	return GetGameInstance() ? GetGameInstance()->GetWorld() : nullptr;
}

// ------------------------------------------------------------------ conditions & progress

bool UHanoiMissionSubsystem::EvaluateCondition(const FHanoiCondition& C) const
{
	for (const FHanoiRef& Ref : C.MissionsCompleted)
	{
		if (!State.CompletedMissions.Contains(Ref.Id)) { return false; }
	}
	for (const TPair<FName, int32>& Pair : C.MinReputation)
	{
		const int32* Rep = State.Reputation.Find(Pair.Key);
		if ((Rep ? *Rep : 0) < Pair.Value) { return false; }
	}
	const UHanoiTimeWeatherSubsystem* Time = GetGameInstance()->GetSubsystem<UHanoiTimeWeatherSubsystem>();
	if (Time && !C.Hours.Contains(Time->GetHourOfDay()))
	{
		return false;
	}
	if (Time && C.Weather.Num() > 0 && !C.Weather.Contains(Time->GetWeather().Condition))
	{
		return false;
	}
	if (C.Protagonist.Num() > 0 && !C.Protagonist.ContainsByPredicate([this](const FHanoiRef& R) { return R.Id == State.Protagonist; }))
	{
		return false;
	}
	for (const FString& Flag : C.Flags)
	{
		if (!State.Flags.Contains(FName(*Flag))) { return false; }
	}
	return true;
}

void UHanoiMissionSubsystem::ApplyReward(const FHanoiReward& Reward)
{
	State.MoneyVnd += Reward.MoneyVnd;
	for (const TPair<FName, int32>& Pair : Reward.Reputation)
	{
		State.Reputation.FindOrAdd(Pair.Key) += Pair.Value;
	}
	for (const FHanoiRef& Item : Reward.Items)
	{
		State.Inventory.FindOrAdd(Item.Id) += 1;
	}
	for (const FHanoiRef& Unlock : Reward.Unlocks)
	{
		State.Unlocked.Add(FName(*Unlock.ToString()));
	}
	for (const FString& Flag : Reward.SetFlags)
	{
		State.Flags.Add(FName(*Flag));
	}
	NotifyStateChanged();
}

void UHanoiMissionSubsystem::AddMoney(int64 DeltaVnd)
{
	State.MoneyVnd = FMath::Max<int64>(0, State.MoneyVnd + DeltaVnd);
	NotifyStateChanged();
}

bool UHanoiMissionSubsystem::SpendMoney(int64 AmountVnd)
{
	if (AmountVnd < 0 || State.MoneyVnd < AmountVnd)
	{
		return false;
	}
	State.MoneyVnd -= AmountVnd;
	NotifyStateChanged();
	return true;
}

void UHanoiMissionSubsystem::SetFlag(FName Flag, bool bSet)
{
	if (bSet) { State.Flags.Add(Flag); } else { State.Flags.Remove(Flag); }
	NotifyStateChanged();
}

bool UHanoiMissionSubsystem::SaveProgress()
{
	UHanoiSaveGame* Save = Cast<UHanoiSaveGame>(UGameplayStatics::CreateSaveGameObject(UHanoiSaveGame::StaticClass()));
	if (!Save)
	{
		return false;
	}
	if (const UHanoiTimeWeatherSubsystem* Time = GetGameInstance()->GetSubsystem<UHanoiTimeWeatherSubsystem>())
	{
		State.GameTime = Time->GetHanoiTime();
	}
	Save->State = State;
	// Missions restart from their first step on load (GTA-style checkpoints come later).
	Save->ActiveMission = bActive ? ActiveMission.Id : NAME_None;
	return UGameplayStatics::SaveGameToSlot(Save, UHanoiCitySettings::Get()->SaveSlot, 0);
}

bool UHanoiMissionSubsystem::LoadProgress()
{
	const FString& Slot = UHanoiCitySettings::Get()->SaveSlot;
	UHanoiSaveGame* Save = Cast<UHanoiSaveGame>(UGameplayStatics::LoadGameFromSlot(Slot, 0));
	if (!Save)
	{
		return false;
	}
	State = Save->State;
	if (UHanoiTimeWeatherSubsystem* Time = GetGameInstance()->GetSubsystem<UHanoiTimeWeatherSubsystem>())
	{
		if (State.GameTime.GetTicks() > 0) { Time->SetHanoiTime(State.GameTime); }
	}
	NotifyStateChanged();
	if (!Save->ActiveMission.IsNone())
	{
		StartMission(Save->ActiveMission);
	}
	return true;
}

// ------------------------------------------------------------------ mission flow

bool UHanoiMissionSubsystem::CanStartMission(FName MissionId, FString& OutReason) const
{
	const UHanoiContentSubsystem* Content = GetGameInstance()->GetSubsystem<UHanoiContentSubsystem>();
	const FHanoiMissionRow* Row = Content ? Content->Find<FHanoiMissionRow>(TEXT("missions"), MissionId) : nullptr;
	if (!Row) { OutReason = TEXT("unknown mission"); return false; }
	if (bActive) { OutReason = TEXT("another mission is active"); return false; }
	if (State.CompletedMissions.Contains(MissionId) && Row->Type == EHanoiMissionType::Story) { OutReason = TEXT("already completed"); return false; }
	if (Row->Steps.Num() == 0) { OutReason = TEXT("mission has no steps"); return false; }
	if (!EvaluateCondition(Row->Requires)) { OutReason = TEXT("requirements not met"); return false; }
	return true;
}

TArray<FName> UHanoiMissionSubsystem::GetAvailableMissions() const
{
	TArray<FName> Out;
	const UHanoiContentSubsystem* Content = GetGameInstance()->GetSubsystem<UHanoiContentSubsystem>();
	if (const UDataTable* Table = Content ? Content->GetTable(TEXT("missions")) : nullptr)
	{
		for (const TPair<FName, uint8*>& Pair : Table->GetRowMap())
		{
			const FHanoiMissionRow* Row = reinterpret_cast<const FHanoiMissionRow*>(Pair.Value);
			if (!State.CompletedMissions.Contains(Pair.Key) && EvaluateCondition(Row->Requires))
			{
				Out.Add(Pair.Key);
			}
		}
	}
	return Out;
}

bool UHanoiMissionSubsystem::StartMission(FName MissionId)
{
	FString Reason;
	if (!CanStartMission(MissionId, Reason))
	{
		UE_LOG(LogHanoi, Warning, TEXT("Cannot start mission %s: %s"), *MissionId.ToString(), *Reason);
		return false;
	}
	ActiveMission = *GetGameInstance()->GetSubsystem<UHanoiContentSubsystem>()->Find<FHanoiMissionRow>(TEXT("missions"), MissionId);
	bActive = true;
	EnterStep(0);
	return true;
}

void UHanoiMissionSubsystem::AbandonMission()
{
	if (bActive)
	{
		FinishMission(false, TEXT("abandoned"));
	}
}

void UHanoiMissionSubsystem::FailMission(FName Reason)
{
	if (bActive)
	{
		FinishMission(false, Reason);
	}
}

bool UHanoiMissionSubsystem::GetActiveStep(FHanoiMissionStep& OutStep) const
{
	if (!bActive || !ActiveMission.Steps.IsValidIndex(StepIndex))
	{
		return false;
	}
	OutStep = ActiveMission.Steps[StepIndex];
	return true;
}

void UHanoiMissionSubsystem::EnterStep(int32 Index)
{
	StepIndex = Index;
	StepElapsed = 0.f;
	StepEvents.Reset();
	StepParams.Reset();
	const FHanoiMissionStep& Step = ActiveMission.Steps[Index];
	if (!Step.Params.IsEmpty())
	{
		FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Step.Params), StepParams);
	}
	if (Step.Kind == EHanoiMissionStepKind::EscapeTrafficPolice)
	{
		if (UWorld* World = GetGameWorld())
		{
			if (UHanoiHeatSubsystem* Heat = World->GetSubsystem<UHanoiHeatSubsystem>())
			{
				Heat->AddHeat(GetParamNumber(TEXT("heat"), 2.f));
			}
		}
	}
	OnStepStarted.Broadcast(ActiveMission.Id, StepIndex, Step);
}

void UHanoiMissionSubsystem::CompleteCurrentStep(FName Outcome)
{
	if (bActive)
	{
		Advance(Outcome);
	}
}

void UHanoiMissionSubsystem::ReportEvent(FName Event)
{
	StepEvents.Add(Event);
}

void UHanoiMissionSubsystem::Advance(FName Outcome)
{
	const FHanoiMissionStep Step = ActiveMission.Steps[StepIndex];
	OnStepCompleted.Broadcast(ActiveMission.Id, StepIndex, Step);

	FName NextId;
	if (!Step.Next.Step.IsNone())
	{
		NextId = Step.Next.Step;
	}
	else if (Step.Next.IsBranching())
	{
		const FName* Found = Step.Next.Branches.Find(Outcome);
		Found = Found ? Found : Step.Next.Branches.Find(HanoiMission::Default);
		if (!Found)
		{
			UE_LOG(LogHanoi, Warning, TEXT("Mission %s step %s: no branch for outcome '%s'"),
				*ActiveMission.Id.ToString(), *Step.Id.ToString(), *Outcome.ToString());
			FinishMission(false, TEXT("no_branch"));
			return;
		}
		NextId = *Found;
	}
	else
	{
		NextId = ActiveMission.Steps.IsValidIndex(StepIndex + 1) ? ActiveMission.Steps[StepIndex + 1].Id : HanoiMission::End;
	}

	if (NextId == HanoiMission::End || NextId == HanoiMission::Success)
	{
		FinishMission(true, Outcome);
		return;
	}
	if (NextId == HanoiMission::Fail)
	{
		FinishMission(false, Outcome);
		return;
	}
	const int32 NextIndex = ActiveMission.Steps.IndexOfByPredicate([NextId](const FHanoiMissionStep& S) { return S.Id == NextId; });
	if (NextIndex == INDEX_NONE)
	{
		UE_LOG(LogHanoi, Error, TEXT("Mission %s: next step '%s' not found"), *ActiveMission.Id.ToString(), *NextId.ToString());
		FinishMission(false, TEXT("bad_next"));
		return;
	}
	EnterStep(NextIndex);
}

void UHanoiMissionSubsystem::FinishMission(bool bSuccess, FName Reason)
{
	const FName Id = ActiveMission.Id;
	bActive = false;
	StepIndex = INDEX_NONE;
	if (bSuccess)
	{
		State.CompletedMissions.Add(Id);
		ApplyReward(ActiveMission.Reward);
		for (const FHanoiRef& Unlock : ActiveMission.Unlocks)
		{
			State.Unlocked.Add(FName(*Unlock.ToString()));
		}
		NotifyStateChanged();
	}
	OnMissionEnded.Broadcast(Id, bSuccess, Reason);
	if (bSuccess)
	{
		SaveProgress();
	}
}

// ------------------------------------------------------------------ per-frame checks

float UHanoiMissionSubsystem::GetParamNumber(const TCHAR* Key, float Default) const
{
	double Value = 0.0;
	return (StepParams.IsValid() && StepParams->TryGetNumberField(Key, Value)) ? float(Value) : Default;
}

float UHanoiMissionSubsystem::GetCurrentHeat() const
{
	UWorld* World = GetGameWorld();
	const UHanoiHeatSubsystem* Heat = World ? World->GetSubsystem<UHanoiHeatSubsystem>() : nullptr;
	return Heat ? Heat->GetHeat() : 0.f;
}

bool UHanoiMissionSubsystem::GetActiveStepTargetLocation(FVector& OutWorld) const
{
	FHanoiMissionStep Step;
	UWorld* World = GetGameWorld();
	const UHanoiGeoSubsystem* Geo = World ? World->GetSubsystem<UHanoiGeoSubsystem>() : nullptr;
	if (!GetActiveStep(Step) || !Geo)
	{
		return false;
	}
	FHanoiGeo Point;
	if (Step.Target.Kind == EHanoiTargetKind::Geo)
	{
		Point = Step.Target.Geo;
	}
	else if (Step.Target.Kind == EHanoiTargetKind::Ref)
	{
		const UHanoiContentSubsystem* Content = GetGameInstance()->GetSubsystem<UHanoiContentSubsystem>();
		if (!Content || !Content->ResolveLocation(Step.Target.Ref, Point))
		{
			return false;
		}
	}
	else
	{
		return false;
	}
	OutWorld = Geo->GeoToWorld(Point);
	return true;
}

bool UHanoiMissionSubsystem::IsAutoComplete() const
{
	const FHanoiMissionStep& Step = ActiveMission.Steps[StepIndex];
	switch (Step.Kind)
	{
	case EHanoiMissionStepKind::GoTo:
	case EHanoiMissionStepKind::Ride:
	case EHanoiMissionStepKind::Deliver:
	case EHanoiMissionStepKind::DrivePassenger:
	case EHanoiMissionStepKind::Follow:
	{
		FVector Target;
		const APawn* Pawn = UGameplayStatics::GetPlayerPawn(GetGameWorld(), 0);
		if (!Pawn || !GetActiveStepTargetLocation(Target))
		{
			return false;
		}
		const float RadiusCm = 100.f * GetParamNumber(TEXT("radius_m"), UHanoiCitySettings::Get()->MissionArriveRadiusM);
		return FVector::DistSquared2D(Pawn->GetActorLocation(), Target) <= FMath::Square(RadiusCm);
	}
	case EHanoiMissionStepKind::WaitUntil:
	{
		const UHanoiTimeWeatherSubsystem* Time = GetGameInstance()->GetSubsystem<UHanoiTimeWeatherSubsystem>();
		if (!Time) { return true; }
		FHanoiHourRange Range;
		const TArray<TSharedPtr<FJsonValue>>* Hours = nullptr;
		if (StepParams.IsValid() && StepParams->TryGetArrayField(TEXT("hours"), Hours) && Hours->Num() == 2)
		{
			Range.From = float((*Hours)[0]->AsNumber());
			Range.To = float((*Hours)[1]->AsNumber());
		}
		else
		{
			Range.From = GetParamNumber(TEXT("hour"), 0.f);
			Range.To = FMath::Fmod(Range.From + 1.f, 24.f);
		}
		return Range.Contains(Time->GetHourOfDay());
	}
	case EHanoiMissionStepKind::EscapeTrafficPolice:
		return StepElapsed > 1.f && GetCurrentHeat() <= 0.f;
	default:
		return false;
	}
}

bool UHanoiMissionSubsystem::ShouldFail(FName& OutReason) const
{
	const float TimeLimit = GetParamNumber(TEXT("time_limit_s"), 0.f);
	if (TimeLimit > 0.f && StepElapsed > TimeLimit)
	{
		OutReason = TEXT("time_limit");
		return true;
	}
	for (const FString& Rule : ActiveMission.Steps[StepIndex].FailIf)
	{
		FString Left, Right;
		if (Rule.Split(TEXT(":"), &Left, &Right))
		{
			const bool bHit = (Left == TEXT("event") && StepEvents.Contains(FName(*Right)))
				|| (Left == TEXT("flag") && State.Flags.Contains(FName(*Right)));
			if (bHit) { OutReason = FName(*Rule); return true; }
			continue;
		}
		// "<var><op><number>" with var in {time, heat}
		static const TCHAR* Ops[] = {TEXT(">="), TEXT("<="), TEXT("=="), TEXT(">"), TEXT("<")};
		for (const TCHAR* Op : Ops)
		{
			if (!Rule.Split(Op, &Left, &Right)) { continue; }
			Left.TrimStartAndEndInline();
			const float Rhs = FCString::Atof(*Right.TrimStartAndEnd());
			const bool bKnownVar = Left == TEXT("time") || Left == TEXT("heat");
			const float Lhs = Left == TEXT("time") ? StepElapsed : GetCurrentHeat();
			const FString O(Op);
			const bool bHit = bKnownVar && ((O == TEXT(">=") && Lhs >= Rhs) || (O == TEXT("<=") && Lhs <= Rhs)
				|| (O == TEXT("==") && FMath::IsNearlyEqual(Lhs, Rhs)) || (O == TEXT(">") && Lhs > Rhs) || (O == TEXT("<") && Lhs < Rhs));
			if (bHit) { OutReason = FName(*Rule); return true; }
			break;
		}
	}
	return false;
}

void UHanoiMissionSubsystem::Tick(float DeltaTime)
{
	if (!bActive || !ActiveMission.Steps.IsValidIndex(StepIndex))
	{
		return;
	}
	StepElapsed += DeltaTime;
	FName Reason;
	if (ShouldFail(Reason))
	{
		FinishMission(false, Reason);
	}
	else if (IsAutoComplete())
	{
		Advance(HanoiMission::Success);
	}
}
