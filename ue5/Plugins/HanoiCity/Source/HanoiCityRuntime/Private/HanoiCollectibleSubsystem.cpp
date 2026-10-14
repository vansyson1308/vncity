#include "HanoiCollectibleSubsystem.h"
#include "HanoiCitySettings.h"
#include "HanoiContentSubsystem.h"
#include "HanoiGeoSubsystem.h"
#include "HanoiMissionSubsystem.h"
#include "HanoiTimeWeatherSubsystem.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "Kismet/GameplayStatics.h"

void UHanoiCollectibleSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Collection.InitializeDependency(UHanoiContentSubsystem::StaticClass());
	Collection.InitializeDependency(UHanoiMissionSubsystem::StaticClass());
	Super::Initialize(Collection);
	if (UHanoiMissionSubsystem* M = Missions())
	{
		M->OnMissionEnded.AddDynamic(this, &UHanoiCollectibleSubsystem::HandleMissionEnded);
	}
}

void UHanoiCollectibleSubsystem::Deinitialize()
{
	if (UHanoiMissionSubsystem* M = Missions())
	{
		M->OnMissionEnded.RemoveDynamic(this, &UHanoiCollectibleSubsystem::HandleMissionEnded);
	}
	Super::Deinitialize();
}

UHanoiMissionSubsystem* UHanoiCollectibleSubsystem::Missions() const
{
	return GetGameInstance() ? GetGameInstance()->GetSubsystem<UHanoiMissionSubsystem>() : nullptr;
}

const FHanoiCollectiblesRow* UHanoiCollectibleSubsystem::Get(FName Id) const
{
	const UHanoiContentSubsystem* Content = GetGameInstance()->GetSubsystem<UHanoiContentSubsystem>();
	return Content ? Content->Find<FHanoiCollectiblesRow>(TEXT("collectibles"), Id) : nullptr;
}

bool UHanoiCollectibleSubsystem::PawnLocation(FVector& OutWorld) const
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

uint32 UHanoiCollectibleSubsystem::HashId(const FString& Id)
{
	uint32 H = 2166136261u;
	for (const TCHAR Ch : Id)
	{
		H ^= uint32(uint16(Ch));
		H *= 16777619u;
	}
	return H;
}

FVector UHanoiCollectibleSubsystem::SpotWorld(const FHanoiCollectiblesRow& Item) const
{
	const UWorld* World = GetGameInstance() ? GetGameInstance()->GetWorld() : nullptr;
	const UHanoiGeoSubsystem* Geo = World ? World->GetSubsystem<UHanoiGeoSubsystem>() : nullptr;
	if (!Geo)
	{
		return FVector::ZeroVector;
	}
	FVector P = Geo->GeoToWorld(Item.Location);
	if (Item.Set != EHanoiCollectiblesSet::TemPhieu)
	{
		return P;
	}
	// Same spot as the Unity core: angle from h % 3600, distance 0.4-1.0 of CouponHideRadiusM from (h >> 12) % 1000.
	// ENU east/north map to world +X / -Y in UHanoiGeoSubsystem (UE is left-handed), hence the minus on Y.
	const uint32 H = HashId(Item.Id.ToString());
	const double Angle = double(H % 3600u) / 3600.0 * 2.0 * PI;
	const double DistM = UHanoiCitySettings::Get()->CouponHideRadiusM * (0.4 + 0.6 * double((H >> 12) % 1000u) / 1000.0);
	P.X += 100.0 * DistM * FMath::Cos(Angle);
	P.Y -= 100.0 * DistM * FMath::Sin(Angle);
	return P;
}

FVector UHanoiCollectibleSubsystem::GetSpotWorld(FName Id) const
{
	const FHanoiCollectiblesRow* Item = Get(Id);
	return Item ? SpotWorld(*Item) : FVector::ZeroVector;
}

bool UHanoiCollectibleSubsystem::CanCollect(FName Id, FString& OutReason) const
{
	const FHanoiCollectiblesRow* Item = Get(Id);
	const UHanoiMissionSubsystem* M = Missions();
	if (!Item || !M)
	{
		OutReason = TEXT("unknown");
		return false;
	}
	if (M->GetPlayerStateRef().Collected.Contains(Id))
	{
		OutReason = TEXT("already collected");
		return false;
	}
	const UHanoiContentSubsystem* Content = GetGameInstance()->GetSubsystem<UHanoiContentSubsystem>();
	if (const FHanoiActivityRow* Act = Item->Activity.IsValid() ? Content->Find<FHanoiActivityRow>(TEXT("activities"), Item->Activity.Id) : nullptr)
	{
		if (!M->EvaluateCondition(Act->Unlock))
		{
			OutReason = TEXT("activity locked");
			return false;
		}
	}
	if (const UHanoiTimeWeatherSubsystem* Time = GetGameInstance()->GetSubsystem<UHanoiTimeWeatherSubsystem>())
	{
		if (!Item->Hours.Contains(Time->GetHourOfDay()))
		{
			OutReason = TEXT("light does not match the old frame");
			return false;
		}
	}
	FVector Pawn;
	const float RadiusCm = 100.f * UHanoiCitySettings::Get()->CollectRadiusM;
	if (!PawnLocation(Pawn) || FVector::DistSquared2D(Pawn, SpotWorld(*Item)) > FMath::Square(RadiusCm))
	{
		OutReason = TEXT("too far");
		return false;
	}
	return true;
}

bool UHanoiCollectibleSubsystem::Collect(FName Id, float MatchScore)
{
	FString Reason;
	if (!CanCollect(Id, Reason))
	{
		return false;
	}
	const FHanoiCollectiblesRow* Item = Get(Id);
	if (Item->Set == EHanoiCollectiblesSet::AnhXua && MatchScore < UHanoiCitySettings::Get()->PhotoMatchThreshold)
	{
		return false;
	}
	UHanoiMissionSubsystem* M = Missions();
	M->MutableState().Collected.Add(Id);
	M->TrainFromActivity(Item->Activity);
	OnCollected.Broadcast(*Item);
	if (Item->UnlocksTape > 0)
	{
		UnlockTape(Item->UnlocksTape);
	}
	CheckTapes();
	M->NotifyStateChanged();
	return true;
}

int32 UHanoiCollectibleSubsystem::CountCollected(EHanoiCollectiblesSet Set) const
{
	const UHanoiMissionSubsystem* M = Missions();
	int32 N = 0;
	if (M)
	{
		for (const FName& Id : M->GetPlayerStateRef().Collected)
		{
			const FHanoiCollectiblesRow* Item = Get(Id);
			N += Item && Item->Set == Set ? 1 : 0;
		}
	}
	return N;
}

int32 UHanoiCollectibleSubsystem::CountTotal(EHanoiCollectiblesSet Set) const
{
	const UHanoiContentSubsystem* Content = GetGameInstance()->GetSubsystem<UHanoiContentSubsystem>();
	const UDataTable* Table = Content ? Content->GetTable(TEXT("collectibles")) : nullptr;
	int32 N = 0;
	if (Table)
	{
		for (const TPair<FName, uint8*>& Pair : Table->GetRowMap())
		{
			N += reinterpret_cast<const FHanoiCollectiblesRow*>(Pair.Value)->Set == Set ? 1 : 0;
		}
	}
	return N;
}

bool UHanoiCollectibleSubsystem::IsTapeUnlocked(int32 Tape) const
{
	const UHanoiMissionSubsystem* M = Missions();
	return M && M->GetPlayerStateRef().Tapes.Contains(Tape);
}

void UHanoiCollectibleSubsystem::CheckTapes()
{
	const UHanoiMissionSubsystem* M = Missions();
	if (!M)
	{
		return;
	}
	const UHanoiCitySettings* S = UHanoiCitySettings::Get();
	const int32 Photos = CountCollected(EHanoiCollectiblesSet::AnhXua);
	if (Photos >= S->Tape22Photos)
	{
		UnlockTape(22);
	}
	if (Photos >= S->Tape23Photos)
	{
		UnlockTape(23);
	}
	if ((Photos >= S->Tape24Photos && M->HasReachedChapter(S->Tape24Chapter)) || M->GetPlayerStateRef().Flags.Contains(S->Tape24Flag))
	{
		UnlockTape(24);
	}
}

void UHanoiCollectibleSubsystem::UnlockTape(int32 Tape)
{
	UHanoiMissionSubsystem* M = Missions();
	if (M && !M->GetPlayerStateRef().Tapes.Contains(Tape))
	{
		M->MutableState().Tapes.Add(Tape);
		OnTapeUnlocked.Broadcast(Tape);
		M->NotifyStateChanged();
	}
}

void UHanoiCollectibleSubsystem::HandleMissionEnded(FName MissionId, bool bSuccess, FName Reason)
{
	CheckTapes();
}

FName UHanoiCollectibleSubsystem::NearestUncollected(EHanoiCollectiblesSet Set) const
{
	const UHanoiContentSubsystem* Content = GetGameInstance()->GetSubsystem<UHanoiContentSubsystem>();
	const UDataTable* Table = Content ? Content->GetTable(TEXT("collectibles")) : nullptr;
	const UHanoiMissionSubsystem* M = Missions();
	FVector Pawn;
	if (!Table || !M || !PawnLocation(Pawn))
	{
		return NAME_None;
	}
	FName Best;
	double BestD = TNumericLimits<double>::Max();
	for (const TPair<FName, uint8*>& Pair : Table->GetRowMap())
	{
		const FHanoiCollectiblesRow* Item = reinterpret_cast<const FHanoiCollectiblesRow*>(Pair.Value);
		if (Item->Set != Set || M->GetPlayerStateRef().Collected.Contains(Pair.Key))
		{
			continue;
		}
		const double D = FVector::DistSquared2D(Pawn, SpotWorld(*Item));
		if (D < BestD)
		{
			BestD = D;
			Best = Pair.Key;
		}
	}
	return Best;
}

TArray<FName> UHanoiCollectibleSubsystem::Nearby(float RadiusM) const
{
	TArray<FName> Out;
	const UHanoiContentSubsystem* Content = GetGameInstance()->GetSubsystem<UHanoiContentSubsystem>();
	const UDataTable* Table = Content ? Content->GetTable(TEXT("collectibles")) : nullptr;
	const UHanoiMissionSubsystem* M = Missions();
	FVector Pawn;
	if (!Table || !M || !PawnLocation(Pawn))
	{
		return Out;
	}
	const double R2 = FMath::Square(100.0 * RadiusM);
	for (const TPair<FName, uint8*>& Pair : Table->GetRowMap())
	{
		const FHanoiCollectiblesRow* Item = reinterpret_cast<const FHanoiCollectiblesRow*>(Pair.Value);
		if (!M->GetPlayerStateRef().Collected.Contains(Pair.Key) && FVector::DistSquared2D(Pawn, SpotWorld(*Item)) <= R2)
		{
			Out.Add(Pair.Key);
		}
	}
	return Out;
}
