#include "HanoiRandomEventSubsystem.h"
#include "HanoiCitySettings.h"
#include "HanoiContentSubsystem.h"
#include "HanoiGeoSubsystem.h"
#include "HanoiHeatSubsystem.h"
#include "HanoiMissionSubsystem.h"
#include "HanoiTimeWeatherSubsystem.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "Kismet/GameplayStatics.h"

void UHanoiRandomEventSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Collection.InitializeDependency(UHanoiContentSubsystem::StaticClass());
	Collection.InitializeDependency(UHanoiTimeWeatherSubsystem::StaticClass());
	Collection.InitializeDependency(UHanoiMissionSubsystem::StaticClass());
	Super::Initialize(Collection);
	Random.Initialize(int32(FDateTime::UtcNow().GetTicks() & 0x7fffffff));
	bReady = true;
}

void UHanoiRandomEventSubsystem::Deinitialize()
{
	bReady = false;
	Super::Deinitialize();
}

TStatId UHanoiRandomEventSubsystem::GetStatId() const
{
	RETURN_QUICK_DECLARE_CYCLE_STAT(UHanoiRandomEventSubsystem, STATGROUP_Tickables);
}

UHanoiMissionSubsystem* UHanoiRandomEventSubsystem::Missions() const
{
	return GetGameInstance() ? GetGameInstance()->GetSubsystem<UHanoiMissionSubsystem>() : nullptr;
}

bool UHanoiRandomEventSubsystem::PlayerPawnLocation(FVector& OutWorld) const
{
	const UWorld* World = GetGameInstance() ? GetGameInstance()->GetWorld() : nullptr;
	const APawn* Pawn = World ? UGameplayStatics::GetPlayerPawn(World, 0) : nullptr;
	if (!Pawn)
	{
		return false;
	}
	OutWorld = Pawn->GetActorLocation();
	return true;
}

void UHanoiRandomEventSubsystem::Tick(float DeltaTime)
{
	const UHanoiTimeWeatherSubsystem* Time = GetGameInstance()->GetSubsystem<UHanoiTimeWeatherSubsystem>();
	if (Time)
	{
		const int32 Hour = FMath::FloorToInt(Time->GetHourOfDay());
		if (LastHour >= 0 && Hour != LastHour)
		{
			RollNow();
		}
		LastHour = Hour;
	}
	if (HasCurrentEvent() && !IsWaitingForMinigame())
	{
		Remaining -= DeltaTime;
		if (Remaining <= 0.f)
		{
			Ignore();
		}
	}
}

// ------------------------------------------------------------------ spawning

void UHanoiRandomEventSubsystem::RollNow()
{
	const UHanoiMissionSubsystem* M = Missions();
	if (HasCurrentEvent() || !M)
	{
		return;
	}
	if (M->IsMissionActive() && !UHanoiCitySettings::Get()->bRandomEventsDuringMissions)
	{
		return;
	}
	FVector Unused;
	if (!PlayerPawnLocation(Unused))
	{
		return;
	}
	const UHanoiContentSubsystem* Content = GetGameInstance()->GetSubsystem<UHanoiContentSubsystem>();
	const UDataTable* Table = Content ? Content->GetTable(TEXT("random_events")) : nullptr;
	if (!Table)
	{
		return;
	}
	TArray<FName> Ids;
	Table->GetRowMap().GenerateKeyArray(Ids);
	// Shuffle so content order does not favour the first rows.
	for (int32 i = Ids.Num() - 1; i > 0; --i)
	{
		Ids.Swap(i, Random.RandRange(0, i));
	}
	for (const FName& Id : Ids)
	{
		FString Reason;
		if (!CanSpawn(Id, Reason))
		{
			continue;
		}
		const FHanoiRandomEventsRow* Row = Content->Find<FHanoiRandomEventsRow>(TEXT("random_events"), Id);
		if (Row && Random.FRand() < Row->Spawn.ChancePerGameHour)
		{
			StartEvent(*Row);
			return;
		}
	}
}

FName UHanoiRandomEventSubsystem::LocateDistrict(const FVector& WorldLocation) const
{
	const UWorld* World = GetGameInstance() ? GetGameInstance()->GetWorld() : nullptr;
	const UHanoiGeoSubsystem* Geo = World ? World->GetSubsystem<UHanoiGeoSubsystem>() : nullptr;
	const UHanoiContentSubsystem* Content = GetGameInstance()->GetSubsystem<UHanoiContentSubsystem>();
	const UDataTable* Table = Content ? Content->GetTable(TEXT("districts")) : nullptr;
	if (!Geo || !Table)
	{
		return NAME_None;
	}
	FName Best;
	double BestD = TNumericLimits<double>::Max();
	for (const TPair<FName, uint8*>& Pair : Table->GetRowMap())
	{
		const FHanoiDistrictRow* Row = reinterpret_cast<const FHanoiDistrictRow*>(Pair.Value);
		if (!Row->Center.bIsSet)
		{
			continue;
		}
		const double D = FVector::DistSquared2D(Geo->GeoToWorld(Row->Center), WorldLocation);
		if (D < BestD)
		{
			BestD = D;
			Best = Pair.Key;
		}
	}
	return Best;
}

bool UHanoiRandomEventSubsystem::CanSpawn(FName EventId, FString& OutReason) const
{
	const UHanoiContentSubsystem* Content = GetGameInstance()->GetSubsystem<UHanoiContentSubsystem>();
	const FHanoiRandomEventsRow* Row = Content ? Content->Find<FHanoiRandomEventsRow>(TEXT("random_events"), EventId) : nullptr;
	const UHanoiMissionSubsystem* M = Missions();
	const UHanoiTimeWeatherSubsystem* Time = GetGameInstance()->GetSubsystem<UHanoiTimeWeatherSubsystem>();
	if (!Row || !M || !Time)
	{
		OutReason = TEXT("unknown");
		return false;
	}
	const FHanoiRandomEventsSpawn& S = Row->Spawn;
	const FHanoiPlayerState& St = M->GetPlayerStateRef();
	const FHanoiPlayerContext& Ctx = M->GetPlayerContext();

	if (S.MaxPerPlaythrough > 0 && St.RandomEventCounts.FindRef(EventId) >= S.MaxPerPlaythrough)
	{
		OutReason = TEXT("max_per_playthrough");
		return false;
	}
	if (const FDateTime* Last = St.RandomEventLast.Find(EventId))
	{
		if ((Time->GetHanoiTime() - *Last).GetTotalDays() < double(S.CooldownDays))
		{
			OutReason = TEXT("cooldown");
			return false;
		}
	}
	if (!S.Hours.Contains(Time->GetHourOfDay()))
	{
		OutReason = TEXT("hours");
		return false;
	}
	if (S.Weather.Num() > 0 && !S.Weather.Contains(Time->GetWeather().Condition))
	{
		OutReason = TEXT("weather");
		return false;
	}
	for (const FHanoiRef& Ev : S.EventsActive)
	{
		if (!M->IsWorldEventActive(Ev.Id))
		{
			OutReason = TEXT("events_active");
			return false;
		}
	}
	if (S.Protagonist.Num() > 0 && !S.Protagonist.ContainsByPredicate([&St](const FHanoiRef& R) { return R.Id == St.Protagonist; }))
	{
		OutReason = TEXT("protagonist");
		return false;
	}
	if (S.OnVehicle != EHanoiOptionalBool::Unset && Ctx.bOnVehicle != (S.OnVehicle == EHanoiOptionalBool::True))
	{
		OutReason = TEXT("on_vehicle");
		return false;
	}
	if (S.RoadTypes.Num() > 0)
	{
		const int64 Road = Ctx.RoadType.IsNone() ? -1
			: UHanoiContentSubsystem::EnumValueFromContentString(StaticEnum<EHanoiRandomEventsSpawnRoadTypes>(), Ctx.RoadType.ToString());
		if (Road < 0 || !S.RoadTypes.Contains(EHanoiRandomEventsSpawnRoadTypes(Road)))
		{
			OutReason = TEXT("road_types");
			return false;
		}
	}
	FVector Pawn;
	const bool bHasPawn = PlayerPawnLocation(Pawn);
	if (S.Districts.Num() > 0)
	{
		const FName District = bHasPawn ? LocateDistrict(Pawn) : NAME_None;
		if (District.IsNone() || !S.Districts.ContainsByPredicate([District](const FHanoiRef& R) { return R.Id == District; }))
		{
			OutReason = TEXT("districts");
			return false;
		}
	}
	if (S.Landmarks.Num() > 0)
	{
		const UWorld* World = GetGameInstance()->GetWorld();
		const UHanoiGeoSubsystem* Geo = World ? World->GetSubsystem<UHanoiGeoSubsystem>() : nullptr;
		const float RadiusCm = 100.f * UHanoiCitySettings::Get()->RandomEventLandmarkRadiusM;
		bool bNear = false;
		for (const FHanoiRef& L : S.Landmarks)
		{
			FHanoiGeo Point;
			if (bHasPawn && Geo && Content->ResolveLocation(L, Point)
				&& FVector::DistSquared2D(Geo->GeoToWorld(Point), Pawn) <= FMath::Square(RadiusCm))
			{
				bNear = true;
				break;
			}
		}
		if (!bNear)
		{
			OutReason = TEXT("landmarks");
			return false;
		}
	}
	if (!M->EvaluateCondition(Row->Requires))
	{
		OutReason = TEXT("requires");
		return false;
	}
	return true;
}

bool UHanoiRandomEventSubsystem::Spawn(FName EventId)
{
	const UHanoiContentSubsystem* Content = GetGameInstance()->GetSubsystem<UHanoiContentSubsystem>();
	const FHanoiRandomEventsRow* Row = Content ? Content->Find<FHanoiRandomEventsRow>(TEXT("random_events"), EventId) : nullptr;
	if (!Row)
	{
		return false;
	}
	StartEvent(*Row);
	return true;
}

void UHanoiRandomEventSubsystem::StartEvent(const FHanoiRandomEventsRow& Row)
{
	UHanoiMissionSubsystem* M = Missions();
	const UHanoiTimeWeatherSubsystem* Time = GetGameInstance()->GetSubsystem<UHanoiTimeWeatherSubsystem>();
	if (!M)
	{
		return;
	}
	Current = Row;
	PendingChoice = NAME_None;
	Remaining = Row.DurationS > 0.f ? Row.DurationS : UHanoiCitySettings::Get()->RandomEventDefaultDurationS;
	FHanoiPlayerState& St = M->MutableState();
	St.RandomEventCounts.FindOrAdd(Row.Id) += 1;
	if (Time)
	{
		St.RandomEventLast.Add(Row.Id, Time->GetHanoiTime());
	}
	M->NotifyStateChanged();
	OnEventStarted.Broadcast(Current);
}

// ------------------------------------------------------------------ resolving

void UHanoiRandomEventSubsystem::Ignore()
{
	if (!HasCurrentEvent())
	{
		return;
	}
	const FHanoiRandomEventsRow Ev = Current;
	Current = FHanoiRandomEventsRow();
	PendingChoice = NAME_None;
	ApplyEffect(Ev.IgnoreEffect);
	OnEventResolved.Broadcast(Ev.Id, NAME_None, FHanoiText());
}

bool UHanoiRandomEventSubsystem::Choose(FName ChoiceId)
{
	if (!HasCurrentEvent() || IsWaitingForMinigame())
	{
		return false;
	}
	const FHanoiRandomEventsChoice* Choice = Current.Choices.FindByPredicate([ChoiceId](const FHanoiRandomEventsChoice& C) { return C.Id == ChoiceId; });
	if (!Choice)
	{
		return false;
	}
	if (Choice->Minigame.IsValid())
	{
		PendingChoice = ChoiceId;
		OnMinigameRequested.Broadcast(Current.Id, ChoiceId, Choice->Minigame);
		return true;
	}
	const FHanoiRandomEventsRow Ev = Current;
	const FHanoiRandomEventsChoice Picked = *Choice;
	Current = FHanoiRandomEventsRow();
	ApplyEffect(Picked.Effect);
	OnEventResolved.Broadcast(Ev.Id, Picked.Id, Picked.Outcome);
	return true;
}

void UHanoiRandomEventSubsystem::CompleteMinigame(bool bPassed)
{
	if (!HasCurrentEvent() || !IsWaitingForMinigame())
	{
		return;
	}
	const FHanoiRandomEventsRow Ev = Current;
	const FHanoiRandomEventsChoice* Choice = Ev.Choices.FindByPredicate([this](const FHanoiRandomEventsChoice& C) { return C.Id == PendingChoice; });
	Current = FHanoiRandomEventsRow();
	PendingChoice = NAME_None;
	if (!Choice)
	{
		return;
	}
	if (UHanoiMissionSubsystem* M = Missions())
	{
		M->TrainFromActivity(Choice->Minigame);
	}
	if (bPassed)
	{
		ApplyEffect(Choice->Effect);
	}
	else
	{
		ApplyEffect(Choice->FailEffect);
	}
	OnEventResolved.Broadcast(Ev.Id, Choice->Id, bPassed ? Choice->Outcome : FHanoiText());
}

template <typename EffectType>
void UHanoiRandomEventSubsystem::ApplyEffect(const EffectType& E)
{
	UHanoiMissionSubsystem* M = Missions();
	if (!M)
	{
		return;
	}
	if (E.MoneyVnd != 0)
	{
		M->AddMoney(E.MoneyVnd);
	}
	FHanoiPlayerState& St = M->MutableState();
	for (const TPair<FName, int32>& Pair : E.Reputation)
	{
		int32& Rep = St.Reputation.FindOrAdd(Pair.Key);
		Rep = FMath::Clamp(Rep + Pair.Value, -100, 100);
	}
	for (const FHanoiRef& Item : E.Items)
	{
		St.Inventory.FindOrAdd(Item.Id) += 1;
	}
	UWorld* World = GetGameInstance()->GetWorld();
	UHanoiHeatSubsystem* Heat = World ? World->GetSubsystem<UHanoiHeatSubsystem>() : nullptr;
	if (Heat && E.Heat > 0.f)
	{
		Heat->AddHeat(E.Heat);
	}
	if (Heat && E.Fine.IsValid())
	{
		Heat->ApplyRuleFine(E.Fine.Id, M->GetPlayerContext().bInCar);
	}
	for (const FString& Skill : E.Skills)
	{
		M->TrainSkill(FName(*Skill));
	}
	if (E.TimeMin > 0)
	{
		if (UHanoiTimeWeatherSubsystem* Time = GetGameInstance()->GetSubsystem<UHanoiTimeWeatherSubsystem>())
		{
			Time->SetHanoiTime(Time->GetHanoiTime() + FTimespan::FromMinutes(E.TimeMin));
		}
	}
	M->NotifyStateChanged();
}
