#include "HanoiFloodSubsystem.h"
#include "HanoiCitySettings.h"
#include "HanoiContentSubsystem.h"
#include "HanoiGeoSubsystem.h"
#include "HanoiHeatSubsystem.h"
#include "HanoiMissionSubsystem.h"
#include "HanoiTimeWeatherSubsystem.h"
#include "HanoiTrafficGraph.h"
#include "Dom/JsonObject.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/Pawn.h"
#include "Kismet/GameplayStatics.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

const FName UHanoiFloodSubsystem::StallEvent(TEXT("xe_chet_may"));

namespace HanoiFlood
{
	static constexpr double Eps = 1e-9;
	static const FName XeMay(TEXT("xe_may"));
	static const FName OTo(TEXT("o_to"));
	static const FName XeDap(TEXT("xe_dap"));
	static const FName DiBo(TEXT("di_bo"));
}

// ------------------------------------------------------------------ model

void FHanoiFloodModel::Build(const FHanoiFloodLayerRow& InLayer)
{
	Layer = InLayer;
	Table.Reset();
	const int32 N = FMath::RoundToInt(double(Layer.DurationH) / double(Layer.StepH));
	for (const FHanoiFloodLayerZone& Zone : Layer.Zones)
	{
		if (Zone.Cause != EHanoiFloodLayerZoneCause::Mua)
		{
			continue;
		}
		TArray<double>& Col = Table.Add(Zone.Id);
		double D = 0.0;
		Col.Add(D);
		for (int32 i = 0; i < N; ++i)
		{
			const double T = i * double(Layer.StepH);
			const double Drain = double(Zone.DrainMmH) * (RiverAt(T) >= double(Layer.Drainage.GravityBlockRiverM) ? double(Layer.Drainage.PumpShare) : 1.0);
			D = D + (RainAt(T) * double(Zone.Catchment) - Drain) / 1000.0 * double(Layer.StepH);
			D = FMath::Min(FMath::Max(D, 0.0), double(Zone.MaxDepthM));
			Col.Add(D);
		}
	}
}

double FHanoiFloodModel::RiverAt(double T) const
{
	const TArray<FHanoiFloodLayerTimelineEntry>& Tl = Layer.Timeline;
	if (Tl.Num() == 0)
	{
		return 0.0;
	}
	if (T <= Tl[0].TH)
	{
		return Tl[0].RiverM;
	}
	for (int32 i = 0; i + 1 < Tl.Num(); ++i)
	{
		const FHanoiFloodLayerTimelineEntry& A = Tl[i];
		const FHanoiFloodLayerTimelineEntry& B = Tl[i + 1];
		if (A.TH <= T && T < B.TH)
		{
			return A.RiverM + (double(B.RiverM) - A.RiverM) * (T - A.TH) / (double(B.TH) - A.TH);
		}
	}
	return Tl.Last().RiverM;
}

double FHanoiFloodModel::RainAt(double T) const
{
	if (Layer.Timeline.Num() == 0)
	{
		return 0.0;
	}
	double Rain = Layer.Timeline[0].RainMmH;
	for (const FHanoiFloodLayerTimelineEntry& K : Layer.Timeline)
	{
		if (K.TH <= T + HanoiFlood::Eps)
		{
			Rain = K.RainMmH;
		}
	}
	return Rain;
}

double FHanoiFloodModel::ZoneDepth(const FHanoiFloodLayerZone& Zone, double T) const
{
	if (T < 0.0 || T > Layer.DurationH + HanoiFlood::Eps)
	{
		return 0.0;
	}
	if (Zone.Cause == EHanoiFloodLayerZoneCause::Song)
	{
		return FMath::Max(0.0, RiverAt(T) - Zone.FloorM);
	}
	const TArray<double>* Col = Table.Find(Zone.Id);
	if (!Col || Col->Num() == 0)
	{
		return 0.0;
	}
	const double X = T / Layer.StepH;
	const int32 I = FMath::Min(FMath::FloorToInt(X + HanoiFlood::Eps), Col->Num() - 1);
	if (I >= Col->Num() - 1)
	{
		return Col->Last();
	}
	const double F = X - I;
	return (*Col)[I] + ((*Col)[I + 1] - (*Col)[I]) * F;
}

bool FHanoiFloodModel::IsClosureActive(const FHanoiFloodLayerClosure& Closure, double T) const
{
	return T >= 0.0 && T <= Layer.DurationH + HanoiFlood::Eps && T + HanoiFlood::Eps >= Closure.FromH
		&& RiverAt(T) >= Closure.RiverMAtLeast;
}

bool FHanoiFloodModel::WorldEventsOn(double T) const
{
	for (const FHanoiFloodLayerZone& Zone : Layer.Zones)
	{
		if (Zone.Cause == EHanoiFloodLayerZoneCause::Mua && ZoneDepth(Zone, T) > Layer.SlowDepthM)
		{
			return true;
		}
	}
	return false;
}

double FHanoiFloodModel::PassableDepth(FName VehicleClass) const
{
	const FHanoiFloodLayerPassableDepthM& P = Layer.PassableDepthM;
	if (VehicleClass == HanoiFlood::OTo) { return P.OTo; }
	if (VehicleClass == HanoiFlood::XeDap) { return P.XeDap; }
	if (VehicleClass == HanoiFlood::DiBo) { return P.DiBo; }
	return P.XeMay;
}

// ------------------------------------------------------------------ subsystem

void UHanoiFloodSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Collection.InitializeDependency(UHanoiContentSubsystem::StaticClass());
	Collection.InitializeDependency(UHanoiTimeWeatherSubsystem::StaticClass());
	Collection.InitializeDependency(UHanoiMissionSubsystem::StaticClass());
	Super::Initialize(Collection);
	if (UHanoiMissionSubsystem* M = Missions())
	{
		M->OnStepStarted.AddDynamic(this, &UHanoiFloodSubsystem::HandleStepStarted);
	}
	bReady = true;
}

void UHanoiFloodSubsystem::Deinitialize()
{
	if (UHanoiMissionSubsystem* M = Missions())
	{
		M->OnStepStarted.RemoveDynamic(this, &UHanoiFloodSubsystem::HandleStepStarted);
	}
	bReady = false;
	Super::Deinitialize();
}

TStatId UHanoiFloodSubsystem::GetStatId() const
{
	RETURN_QUICK_DECLARE_CYCLE_STAT(UHanoiFloodSubsystem, STATGROUP_Tickables);
}

UHanoiMissionSubsystem* UHanoiFloodSubsystem::Missions() const
{
	return GetGameInstance() ? GetGameInstance()->GetSubsystem<UHanoiMissionSubsystem>() : nullptr;
}

UWorld* UHanoiFloodSubsystem::GameWorld() const
{
	return GetGameInstance() ? GetGameInstance()->GetWorld() : nullptr;
}

void UHanoiFloodSubsystem::HandleStepStarted(FName MissionId, int32 StepIndex, const FHanoiMissionStep& Step)
{
	TSharedPtr<FJsonObject> Params;
	FString LayerId;
	if (!Step.Params.IsEmpty() && FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Step.Params), Params)
		&& Params.IsValid() && Params->TryGetStringField(TEXT("flood_layer"), LayerId) && LayerId != TEXT("live"))
	{
		StartLayer(FName(*LayerId));
	}
}

bool UHanoiFloodSubsystem::StartLayer(FName LayerId)
{
	const UHanoiContentSubsystem* Content = GetGameInstance()->GetSubsystem<UHanoiContentSubsystem>();
	const FHanoiFloodLayerRow* Row = Content ? Content->Find<FHanoiFloodLayerRow>(TEXT("flood_layers"), LayerId) : nullptr;
	const UHanoiTimeWeatherSubsystem* Time = GetGameInstance()->GetSubsystem<UHanoiTimeWeatherSubsystem>();
	UHanoiMissionSubsystem* M = Missions();
	if (!Row || !Time || !M)
	{
		return false;
	}
	if (IsActive())
	{
		ClearWorld();
	}
	Model.Build(*Row);
	bPlayerSeeded = false;
	ActiveLayer = LayerId;
	Start = Time->GetHanoiTime();
	M->MutableState().ActiveFloodLayer = LayerId;
	M->MutableState().FloodLayerStart = Start;
	M->NotifyStateChanged();
	LastUpdateH = -1.0;
	OnLayerChanged.Broadcast(LayerId, true);
	UpdateWorld();
	return true;
}

void UHanoiFloodSubsystem::Resume()
{
	UHanoiMissionSubsystem* M = Missions();
	const UHanoiContentSubsystem* Content = GetGameInstance()->GetSubsystem<UHanoiContentSubsystem>();
	if (!M || !Content || M->GetPlayerStateRef().ActiveFloodLayer.IsNone())
	{
		return;
	}
	const FName LayerId = M->GetPlayerStateRef().ActiveFloodLayer;
	if (const FHanoiFloodLayerRow* Row = Content->Find<FHanoiFloodLayerRow>(TEXT("flood_layers"), LayerId))
	{
		Model.Build(*Row);
		bPlayerSeeded = false;
		ActiveLayer = LayerId;
		Start = M->GetPlayerStateRef().FloodLayerStart;
		LastUpdateH = -1.0;
		OnLayerChanged.Broadcast(LayerId, true);
	}
	else
	{
		M->MutableState().ActiveFloodLayer = NAME_None;
	}
}

void UHanoiFloodSubsystem::StopLayer()
{
	if (!IsActive())
	{
		return;
	}
	ClearWorld();
	const FName Old = ActiveLayer;
	ActiveLayer = NAME_None;
	if (UHanoiMissionSubsystem* M = Missions())
	{
		M->MutableState().ActiveFloodLayer = NAME_None;
		M->NotifyStateChanged();
	}
	OnLayerChanged.Broadcast(Old, false);
}

void UHanoiFloodSubsystem::ClearWorld()
{
	if (UWorld* World = GameWorld())
	{
		for (TActorIterator<AHanoiTrafficGraph> It(World); It; ++It)
		{
			It->ClearEdgeOverrides();
		}
	}
	if (UHanoiMissionSubsystem* M = Missions())
	{
		for (const FHanoiRef& Ev : Model.Layer.WorldEvents)
		{
			M->SetWorldEventActive(Ev.Id, false);
		}
	}
	bWorldEventsOn = false;
	PlayerInClosures.Reset();
	PlayerStalledZone = NAME_None;
	bPlayerSeeded = false;
}

float UHanoiFloodSubsystem::GetFloodTimeH() const
{
	const UHanoiTimeWeatherSubsystem* Time = GetGameInstance()->GetSubsystem<UHanoiTimeWeatherSubsystem>();
	return IsActive() && Time ? float((Time->GetHanoiTime() - Start).GetTotalHours()) : 0.f;
}

void UHanoiFloodSubsystem::Tick(float DeltaTime)
{
	if (!IsActive())
	{
		const UHanoiMissionSubsystem* M = Missions();
		if (M && !M->GetPlayerStateRef().ActiveFloodLayer.IsNone())
		{
			Resume();
		}
		if (!IsActive())
		{
			return;
		}
	}
	const double T = GetFloodTimeH();
	if (T > Model.Layer.DurationH)
	{
		StopLayer();
		return;
	}
	const double StepH = UHanoiCitySettings::Get()->FloodUpdateGameMinutes / 60.0;
	if (LastUpdateH < 0.0 || FMath::Abs(T - LastUpdateH) >= StepH)
	{
		UpdateWorld();
	}
	UpdatePlayer(T);
}

void UHanoiFloodSubsystem::UpdateWorld()
{
	const double T = GetFloodTimeH();
	LastUpdateH = T;
	UpdateTraffic(T);
	const bool bOn = Model.WorldEventsOn(T);
	if (bOn != bWorldEventsOn)
	{
		bWorldEventsOn = bOn;
		if (UHanoiMissionSubsystem* M = Missions())
		{
			for (const FHanoiRef& Ev : Model.Layer.WorldEvents)
			{
				M->SetWorldEventActive(Ev.Id, bOn);
			}
		}
	}
}

bool UHanoiFloodSubsystem::ZoneCenter(const FHanoiFloodLayerZone& Zone, FVector& OutWorld) const
{
	const UWorld* World = GameWorld();
	const UHanoiGeoSubsystem* Geo = World ? World->GetSubsystem<UHanoiGeoSubsystem>() : nullptr;
	if (!Geo)
	{
		return false;
	}
	FHanoiGeo Point = Zone.Location;
	if (!Point.bIsSet)
	{
		const UHanoiContentSubsystem* Content = GetGameInstance()->GetSubsystem<UHanoiContentSubsystem>();
		if (!Content || !Content->ResolveLocation(Zone.Landmark, Point))
		{
			return false;
		}
	}
	OutWorld = Geo->GeoToWorld(Point);
	return true;
}

bool UHanoiFloodSubsystem::ClosureCenter(const FHanoiFloodLayerClosure& Closure, FVector& OutWorld) const
{
	const UWorld* World = GameWorld();
	const UHanoiGeoSubsystem* Geo = World ? World->GetSubsystem<UHanoiGeoSubsystem>() : nullptr;
	const UHanoiContentSubsystem* Content = GetGameInstance()->GetSubsystem<UHanoiContentSubsystem>();
	FHanoiGeo Point;
	if (!Geo || !Content || !Content->ResolveLocation(Closure.Landmark, Point))
	{
		return false;
	}
	OutWorld = Geo->GeoToWorld(Point);
	return true;
}

float UHanoiFloodSubsystem::GetRiverLevelM() const
{
	return IsActive() ? float(Model.RiverAt(GetFloodTimeH())) : 0.f;
}

float UHanoiFloodSubsystem::GetZoneDepthM(FName ZoneId) const
{
	if (!IsActive())
	{
		return 0.f;
	}
	const FHanoiFloodLayerZone* Zone = Model.Layer.Zones.FindByPredicate([ZoneId](const FHanoiFloodLayerZone& Z) { return Z.Id == ZoneId; });
	return Zone ? float(Model.ZoneDepth(*Zone, GetFloodTimeH())) : 0.f;
}

float UHanoiFloodSubsystem::GetDepthAt(const FVector& WorldLocation, FName& OutZoneId) const
{
	OutZoneId = NAME_None;
	if (!IsActive())
	{
		return 0.f;
	}
	const double T = GetFloodTimeH();
	double Best = 0.0;
	for (const FHanoiFloodLayerZone& Zone : Model.Layer.Zones)
	{
		FVector C;
		if (ZoneCenter(Zone, C) && FVector::DistSquared2D(C, WorldLocation) <= FMath::Square(100.0 * Zone.RadiusM))
		{
			const double D = Model.ZoneDepth(Zone, T);
			if (D > Best)
			{
				Best = D;
				OutZoneId = Zone.Id;
			}
		}
	}
	return float(Best);
}

bool UHanoiFloodSubsystem::IsPassableAt(const FVector& WorldLocation, FName VehicleClass) const
{
	FName Zone;
	return GetDepthAt(WorldLocation, Zone) < Model.PassableDepth(VehicleClass);
}

float UHanoiFloodSubsystem::GetSpeedFactorAt(const FVector& WorldLocation, FName VehicleClass) const
{
	FName Zone;
	const float Depth = GetDepthAt(WorldLocation, Zone);
	if (Depth >= Model.PassableDepth(VehicleClass))
	{
		return 0.f;
	}
	return Depth > Model.Layer.SlowDepthM ? Model.Layer.SlowSpeedFactor : 1.f;
}

bool UHanoiFloodSubsystem::IsClosureActive(FName ClosureId) const
{
	const FHanoiFloodLayerClosure* C = Model.Layer.Closures.FindByPredicate([ClosureId](const FHanoiFloodLayerClosure& X) { return X.Id == ClosureId; });
	return IsActive() && C && Model.IsClosureActive(*C, GetFloodTimeH());
}

void UHanoiFloodSubsystem::UpdateTraffic(double T)
{
	UWorld* World = GameWorld();
	if (!World)
	{
		return;
	}
	struct FCircle { FVector C; double R2; };
	TArray<FCircle> Closed;
	for (const FHanoiFloodLayerClosure& Closure : Model.Layer.Closures)
	{
		FVector C;
		if (Model.IsClosureActive(Closure, T) && ClosureCenter(Closure, C))
		{
			Closed.Add({C, FMath::Square(100.0 * Closure.RadiusM)});
		}
	}
	for (TActorIterator<AHanoiTrafficGraph> It(World); It; ++It)
	{
		AHanoiTrafficGraph* Graph = *It;
		for (int32 E = 0; E < Graph->NumEdges(); ++E)
		{
			const FVector Mid = Graph->GetEdgeMidpoint(E);
			bool bBlocked = Closed.ContainsByPredicate([&Mid](const FCircle& X) { return FVector::DistSquared2D(X.C, Mid) <= X.R2; });
			float Factor = 1.f;
			if (!bBlocked)
			{
				FName Zone;
				const float Depth = GetDepthAt(Mid, Zone);
				// AI traffic is mostly motorbikes: the xe_may depth closes the street to it.
				bBlocked = Depth >= Model.PassableDepth(HanoiFlood::XeMay);
				Factor = Depth > Model.Layer.SlowDepthM ? Model.Layer.SlowSpeedFactor : 1.f;
			}
			Graph->SetEdgeBlocked(E, bBlocked);
			Graph->SetEdgeSpeedFactor(E, Factor);
		}
	}
}

FName UHanoiFloodSubsystem::PlayerVehicleClass() const
{
	const UHanoiMissionSubsystem* M = Missions();
	if (!M || !M->GetPlayerContext().bOnVehicle)
	{
		return HanoiFlood::DiBo;
	}
	const FHanoiPlayerContext& Ctx = M->GetPlayerContext();
	return Ctx.bInCar ? HanoiFlood::OTo : Ctx.bOnBicycle ? HanoiFlood::XeDap : HanoiFlood::XeMay;
}

void UHanoiFloodSubsystem::UpdatePlayer(double T)
{
	UWorld* World = GameWorld();
	const APawn* Pawn = World ? UGameplayStatics::GetPlayerPawn(World, 0) : nullptr;
	UHanoiMissionSubsystem* M = Missions();
	if (!Pawn || !M)
	{
		return;
	}
	const FVector P = Pawn->GetActorLocation();
	const FName Vehicle = PlayerVehicleClass();
	const bool bRiding = Vehicle == HanoiFlood::XeMay || Vehicle == HanoiFlood::XeDap;

	// Water: a two-wheeler stalls once per zone it drives into too deep.
	FName Zone;
	const float Depth = GetDepthAt(P, Zone);
	if (bRiding && Depth >= Model.PassableDepth(Vehicle))
	{
		if (PlayerStalledZone != Zone)
		{
			PlayerStalledZone = Zone;
			OnVehicleStalled.Broadcast(Zone, Depth);
			M->ReportEvent(StallEvent);
		}
	}
	else if (Depth < Model.Layer.SlowDepthM)
	{
		PlayerStalledZone = NAME_None;
	}

	// Closures: riding into an active one breaks its traffic rule, under the eyes of the police posted
	// there. Being inside already when it starts is not (the people of bãi giữa are let out).
	for (const FHanoiFloodLayerClosure& Closure : Model.Layer.Closures)
	{
		FVector C;
		const bool bInside = ClosureCenter(Closure, C) && FVector::DistSquared2D(C, P) <= FMath::Square(100.0 * Closure.RadiusM);
		const bool bWasInside = PlayerInClosures.Contains(Closure.Id);
		if (bInside && !bWasInside)
		{
			PlayerInClosures.Add(Closure.Id);
			if (bPlayerSeeded && Model.IsClosureActive(Closure, T))
			{
				OnClosureEntered.Broadcast(Closure.Id, true);
				FString StepFine;
				const bool bStepPricesIt = M->GetActiveStepParamString(TEXT("apply_fine"), StepFine) && !StepFine.IsEmpty();
				UHanoiHeatSubsystem* Heat = World->GetSubsystem<UHanoiHeatSubsystem>();
				if (Vehicle != HanoiFlood::DiBo && !bStepPricesIt && Heat && Closure.TrafficRule.IsValid())
				{
					Heat->ReportViolation(Closure.TrafficRule.Id, Vehicle == HanoiFlood::OTo, true, false);
				}
			}
		}
		else if (!bInside && bWasInside)
		{
			PlayerInClosures.Remove(Closure.Id);
			OnClosureEntered.Broadcast(Closure.Id, false);
		}
	}
	bPlayerSeeded = true;
}
