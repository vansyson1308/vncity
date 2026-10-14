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
#include "Internationalization/Regex.h"
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

const FName UHanoiMissionSubsystem::CleanRecordFlag(TEXT("ho_so_sach_90_ngay"));

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
	for (const FString& Flag : C.NotFlags)
	{
		if (State.Flags.Contains(FName(*Flag))) { return false; }
	}
	for (const FHanoiRef& Event : C.EventsActive)
	{
		if (!ActiveWorldEvents.Contains(Event.Id)) { return false; }
	}
	return true;
}

// ------------------------------------------------------------------ dialogue trees

bool UHanoiMissionSubsystem::ResolveDialogueLine(const FHanoiDialogueRow& Dialogue, FName LineId, FHanoiDialogueLine& OutLine) const
{
	int32 Index = 0;
	if (!LineId.IsNone())
	{
		Index = Dialogue.Lines.IndexOfByPredicate([LineId](const FHanoiDialogueLine& L) { return L.Id == LineId; });
		if (Index == INDEX_NONE)
		{
			UE_LOG(LogHanoi, Warning, TEXT("Dialogue %s has no line %s"), *Dialogue.Id.ToString(), *LineId.ToString());
			return false;
		}
	}
	for (; Index < Dialogue.Lines.Num(); ++Index)
	{
		if (IsDialogueLineAvailable(Dialogue.Lines[Index]))
		{
			OutLine = Dialogue.Lines[Index];
			return true;
		}
	}
	return false;
}

bool UHanoiMissionSubsystem::NextDialogueLine(const FHanoiDialogueRow& Dialogue, const FHanoiDialogueLine& Line, FHanoiDialogueLine& OutLine) const
{
	if (!Line.Goto.IsNone())
	{
		return ResolveDialogueLine(Dialogue, Line.Goto, OutLine);
	}
	const int32 Index = Dialogue.Lines.IndexOfByPredicate([&Line](const FHanoiDialogueLine& L) { return L.Id == Line.Id; });
	if (Index == INDEX_NONE || Index + 1 >= Dialogue.Lines.Num())
	{
		return false;
	}
	return ResolveDialogueLine(Dialogue, Dialogue.Lines[Index + 1].Id, OutLine);
}

TArray<FHanoiDialogueLineChoice> UHanoiMissionSubsystem::GetAvailableChoices(const FHanoiDialogueLine& Line) const
{
	TArray<FHanoiDialogueLineChoice> Out;
	for (const FHanoiDialogueLineChoice& Choice : Line.Choices)
	{
		if (IsChoiceAvailable(Choice))
		{
			Out.Add(Choice);
		}
	}
	return Out;
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

void UHanoiMissionSubsystem::RecordFine()
{
	if (const UHanoiTimeWeatherSubsystem* Time = GetGameInstance()->GetSubsystem<UHanoiTimeWeatherSubsystem>())
	{
		State.LastFineGameTime = Time->GetHanoiTime();
	}
	State.Flags.Remove(CleanRecordFlag);
	NotifyStateChanged();
}

void UHanoiMissionSubsystem::UpdateCleanRecord()
{
	if (State.Flags.Contains(CleanRecordFlag))
	{
		return;
	}
	const UHanoiTimeWeatherSubsystem* Time = GetGameInstance() ? GetGameInstance()->GetSubsystem<UHanoiTimeWeatherSubsystem>() : nullptr;
	if (!Time)
	{
		return;
	}
	const FDateTime Now = Time->GetHanoiTime();
	if (State.LastFineGameTime.GetTicks() == 0)
	{
		State.LastFineGameTime = Now;  // a new game counts from its first day
		return;
	}
	if ((Now - State.LastFineGameTime).GetTotalDays() >= double(UHanoiCitySettings::Get()->CleanRecordDays))
	{
		SetFlag(CleanRecordFlag, true);
	}
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
	return CanStartNow(*Row, OutReason);
}

bool UHanoiMissionSubsystem::CanStartNow(const FHanoiMissionRow& Row, FString& OutReason) const
{
	if (!EvaluateCondition(Row.Requires)) { OutReason = TEXT("requirements not met"); return false; }
	const FName Event = FirstStepRequiredEvent(Row);
	if (!Event.IsNone() && !ActiveWorldEvents.Contains(Event))
	{
		OutReason = FString::Printf(TEXT("waits for event %s"), *Event.ToString());
		return false;
	}
	return true;
}

FName UHanoiMissionSubsystem::FirstStepRequiredEvent(const FHanoiMissionRow& Row)
{
	if (Row.Steps.Num() == 0 || Row.Steps[0].Params.IsEmpty())
	{
		return NAME_None;
	}
	TSharedPtr<FJsonObject> Params;
	FString Event;
	if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Row.Steps[0].Params), Params) || !Params.IsValid()
		|| !Params->TryGetStringField(TEXT("requires_event"), Event) || Event.IsEmpty())
	{
		return NAME_None;
	}
	const FHanoiRef Ref = FHanoiRef::Parse(Event);
	return Ref.IsValid() ? Ref.Id : FName(*Event);
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
			FString Reason;
			if (!State.CompletedMissions.Contains(Pair.Key) && CanStartNow(*Row, Reason))
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
	// The mission belongs to its protagonists: possess the first one unless the player already is one.
	const bool bIsProtagonist = ActiveMission.Protagonists.ContainsByPredicate(
		[this](const FHanoiRef& R) { return R.Id == State.Protagonist; });
	if (ActiveMission.Protagonists.Num() > 0 && !bIsProtagonist)
	{
		SwitchProtagonist(ActiveMission.Protagonists[0], NAME_None);
	}
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
	RequiredEvent = NAME_None;
	DeadlineGameHours = -1.0;
	// Copy: delegates fired below may start another step and reallocate ActiveMission.Steps.
	const FHanoiMissionStep Step = ActiveMission.Steps[Index];
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
	ApplyStepParamsOnEnter(Step);
	const int32 EnteredIndex = StepIndex;
	OnStepStarted.Broadcast(ActiveMission.Id, StepIndex, Step);
	if (!bActive || StepIndex != EnteredIndex)
	{
		return;  // a listener already completed or ended the step
	}

	if (Step.Kind == EHanoiMissionStepKind::Choice && Step.Next.IsBranching())
	{
		if (GetParamString(TEXT("branch_source")) == TEXT("flag"))
		{
			// Branch keys are flag names (set earlier, e.g. by a dialogue choice); else "default".
			for (const TPair<FName, FName>& Branch : Step.Next.Branches)
			{
				if (Branch.Key != HanoiMission::Default && State.Flags.Contains(Branch.Key))
				{
					Advance(Branch.Key);
					return;
				}
			}
			Advance(HanoiMission::Default);
			return;
		}
		TArray<FName> Options;
		Step.Next.Branches.GenerateKeyArray(Options);
		Options.Remove(HanoiMission::Default);
		OnChoiceRequested.Broadcast(ActiveMission.Id, Step.Id, FName(*GetParamString(TEXT("player_input"))), Options);
	}
}

void UHanoiMissionSubsystem::ApplyStepParamsOnEnter(const FHanoiMissionStep& Step)
{
	for (const FString& Rule : Step.FailIf)
	{
		static const FRegexPattern Pattern(TEXT("^(event|flag):[a-z0-9_]+$|^(time|heat)(>=|<=|==|>|<)\\d+(\\.\\d+)?$"));
		FRegexMatcher Matcher(Pattern, Rule);
		if (!Matcher.FindNext())
		{
			UE_LOG(LogHanoi, Warning, TEXT("Mission %s step %s: fail_if '%s' is not understood and is ignored"),
				*ActiveMission.Id.ToString(), *Step.Id.ToString(), *Rule);
		}
	}

	SetMinimapAllowed(GetParamBool(TEXT("minimap"), true));

	const FString Protagonist = GetParamString(TEXT("protagonist"));
	if (!Protagonist.IsEmpty())
	{
		SwitchProtagonist(FHanoiRef::Parse(Protagonist), NAME_None);
	}

	const FString FineRule = GetParamString(TEXT("apply_fine"));
	if (!FineRule.IsEmpty())
	{
		ApplyFine(FHanoiRef::Parse(FineRule).Id);
	}

	double Deadline = 0.0;
	const UHanoiTimeWeatherSubsystem* Time = GetGameInstance()->GetSubsystem<UHanoiTimeWeatherSubsystem>();
	if (Time && TryGetParamNumber(TEXT("deadline_hour"), Deadline))
	{
		StepStartGameTime = Time->GetHanoiTime();
		DeadlineGameHours = FMath::Fmod(Deadline - double(Time->GetHourOfDay()) + 24.0, 24.0);
	}

	const FString Event = GetParamString(TEXT("requires_event"));
	if (!Event.IsEmpty())
	{
		const FHanoiRef EventRef = FHanoiRef::Parse(Event);
		RequiredEvent = EventRef.IsValid() ? EventRef.Id : FName(*Event);
		if (!ActiveWorldEvents.Contains(RequiredEvent))
		{
			OnStepWaitingForEvent.Broadcast(ActiveMission.Id, Step.Id, RequiredEvent);
		}
	}
}

bool UHanoiMissionSubsystem::IsStepGateOpen() const
{
	return RequiredEvent.IsNone() || ActiveWorldEvents.Contains(RequiredEvent);
}

void UHanoiMissionSubsystem::SetMinimapAllowed(bool bAllowed)
{
	if (bMinimapAllowed != bAllowed)
	{
		bMinimapAllowed = bAllowed;
		OnMinimapVisibilityChanged.Broadcast(bAllowed);
	}
}

void UHanoiMissionSubsystem::SwitchProtagonist(const FHanoiRef& Character, FName LineId)
{
	if (!Character.IsValid() || State.Protagonist == Character.Id)
	{
		return;
	}
	State.Protagonist = Character.Id;
	OnProtagonistSwitched.Broadcast(Character.Id, LineId);
	NotifyStateChanged();
}

void UHanoiMissionSubsystem::ApplyFine(FName RuleId)
{
	const UHanoiContentSubsystem* Content = GetGameInstance()->GetSubsystem<UHanoiContentSubsystem>();
	const FHanoiTrafficRuleRow* Rule = Content ? Content->Find<FHanoiTrafficRuleRow>(TEXT("traffic_rules"), RuleId) : nullptr;
	if (!Rule)
	{
		UE_LOG(LogHanoi, Warning, TEXT("apply_fine: unknown traffic rule %s"), *RuleId.ToString());
		return;
	}
	// Mission fines are written for the player's motorbike (the default vehicle).
	const int64 Fine = Rule->FineVnd.Motorbike;
	State.UnpaidFinesVnd += Fine;
	State.LicencePoints = FMath::Max(0, State.LicencePoints - Rule->LicencePoints);
	RecordFine();
	OnFineApplied.Broadcast(RuleId, Fine, Rule->LicencePoints);
}

void UHanoiMissionSubsystem::NotifyDialogueLine(FName LineId)
{
	if (!bActive)
	{
		return;
	}
	if (const TSharedPtr<FJsonObject> Lines = GetParamObject(TEXT("switch_protagonist_on_line")))
	{
		FString Character;
		if (Lines->TryGetStringField(LineId.ToString(), Character))
		{
			SwitchProtagonist(FHanoiRef::Parse(Character), LineId);
		}
	}
}

void UHanoiMissionSubsystem::SetWorldEventActive(FName EventId, bool bIsActive)
{
	if (bIsActive)
	{
		ActiveWorldEvents.Add(EventId);
	}
	else
	{
		ActiveWorldEvents.Remove(EventId);
	}
}

void UHanoiMissionSubsystem::CompleteCurrentStep(FName Outcome)
{
	if (!bActive)
	{
		return;
	}
	if (!IsStepGateOpen())
	{
		UE_LOG(LogHanoi, Log, TEXT("Mission %s: step waits for event %s"), *ActiveMission.Id.ToString(), *RequiredEvent.ToString());
		return;
	}
	Advance(Outcome);
}

void UHanoiMissionSubsystem::ReportEvent(FName Event)
{
	StepEvents.Add(Event);
}

void UHanoiMissionSubsystem::Advance(FName Outcome)
{
	const FHanoiMissionStep Step = ActiveMission.Steps[StepIndex];
	if (Step.SetFlags.Num() > 0)
	{
		for (const FString& Flag : Step.SetFlags)
		{
			State.Flags.Add(FName(*Flag));
		}
		NotifyStateChanged();
	}
	OnStepCompleted.Broadcast(ActiveMission.Id, StepIndex, Step);
	if (!bActive)
	{
		return;  // a listener ended the mission
	}

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
	StepParams.Reset();
	RequiredEvent = NAME_None;
	DeadlineGameHours = -1.0;
	SetMinimapAllowed(true);
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
	return TryGetParamNumber(Key, Value) ? float(Value) : Default;
}

bool UHanoiMissionSubsystem::TryGetParamNumber(const TCHAR* Key, double& OutValue) const
{
	return StepParams.IsValid() && StepParams->TryGetNumberField(Key, OutValue);
}

FString UHanoiMissionSubsystem::GetParamString(const TCHAR* Key) const
{
	FString Value;
	if (StepParams.IsValid())
	{
		StepParams->TryGetStringField(Key, Value);
	}
	return Value;
}

bool UHanoiMissionSubsystem::GetParamBool(const TCHAR* Key, bool bDefault) const
{
	bool bValue = bDefault;
	if (StepParams.IsValid())
	{
		StepParams->TryGetBoolField(Key, bValue);
	}
	return bValue;
}

const TArray<TSharedPtr<FJsonValue>>* UHanoiMissionSubsystem::GetParamArray(const TCHAR* Key) const
{
	const TArray<TSharedPtr<FJsonValue>>* Values = nullptr;
	return (StepParams.IsValid() && StepParams->TryGetArrayField(Key, Values)) ? Values : nullptr;
}

TSharedPtr<FJsonObject> UHanoiMissionSubsystem::GetParamObject(const TCHAR* Key) const
{
	const TSharedPtr<FJsonObject>* Object = nullptr;
	return (StepParams.IsValid() && StepParams->TryGetObjectField(Key, Object) && Object) ? *Object : nullptr;
}

bool UHanoiMissionSubsystem::GetActiveStepParamNumber(const FString& Key, float& OutValue) const
{
	double Value = 0.0;
	if (bActive && StepParams.IsValid() && StepParams->TryGetNumberField(Key, Value))
	{
		OutValue = float(Value);
		return true;
	}
	return false;
}

bool UHanoiMissionSubsystem::GetActiveStepParamString(const FString& Key, FString& OutValue) const
{
	return bActive && StepParams.IsValid() && StepParams->TryGetStringField(Key, OutValue);
}

bool UHanoiMissionSubsystem::GetActiveStepParamBool(const FString& Key, bool& OutValue) const
{
	return bActive && StepParams.IsValid() && StepParams->TryGetBoolField(Key, OutValue);
}

FString UHanoiMissionSubsystem::GetActiveStepParamsJson() const
{
	return (bActive && ActiveMission.Steps.IsValidIndex(StepIndex)) ? ActiveMission.Steps[StepIndex].Params : FString();
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
		const TArray<TSharedPtr<FJsonValue>>* Hours = GetParamArray(TEXT("hours"));
		if (Hours && Hours->Num() == 2)
		{
			Range.From = float((*Hours)[0]->AsNumber());
			Range.To = float((*Hours)[1]->AsNumber());
		}
		else
		{
			Range.From = GetParamNumber(TEXT("until_hour"), GetParamNumber(TEXT("hour"), 0.f));
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
	if (DeadlineGameHours >= 0.0)
	{
		const UHanoiTimeWeatherSubsystem* Time = GetGameInstance()->GetSubsystem<UHanoiTimeWeatherSubsystem>();
		if (Time && (Time->GetHanoiTime() - StepStartGameTime).GetTotalHours() > DeadlineGameHours)
		{
			OutReason = TEXT("deadline");
			return true;
		}
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
	UpdateCleanRecord();
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
	else if (IsStepGateOpen() && IsAutoComplete())
	{
		Advance(HanoiMission::Success);
	}
}
