#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Tickable.h"
#include "Generated/HanoiContentTypes.h"
#include "HanoiFloodSubsystem.generated.h"

/**
 * Water of a flood layer (collection flood_layers) over time, the same numbers as the Unity core's
 * FloodModel and tools/runtime_rules.py (golden file tests/golden/runtime_rules.json):
 *  - river level: linear between timeline points; rain: the last timeline point at or before t.
 *  - rain zones (cause mua): depth table at t_i = i * step_h, integrated forward from 0:
 *    d += (rain * catchment - drain) / 1000 * step_h, clamped to [0, max_depth_m], where drain =
 *    drain_mm_h, times drainage.pump_share once the river reaches gravity_block_river_m (the
 *    drains cannot flow out by gravity, only the pumps work); rain and river read at t_i. Between
 *    table points the depth is interpolated linearly.
 *  - river zones (cause song): depth = river - floor_m, at least 0.
 *  - outside [0, duration_h] every depth is 0.
 */
struct HANOICITYRUNTIME_API FHanoiFloodModel
{
	FHanoiFloodLayerRow Layer;
	TMap<FName, TArray<double>> Table;

	void Build(const FHanoiFloodLayerRow& InLayer);
	double RiverAt(double T) const;
	double RainAt(double T) const;
	double ZoneDepth(const FHanoiFloodLayerZone& Zone, double T) const;
	bool IsClosureActive(const FHanoiFloodLayerClosure& Closure, double T) const;
	/** A rain zone is deeper than slow_depth_m (the layer's world_events are on). */
	bool WorldEventsOn(double T) const;
	/** passable_depth_m of a vehicle class: xe_may, o_to, xe_dap, di_bo. */
	double PassableDepth(FName VehicleClass) const;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHanoiFloodLayerSignature, FName, LayerId, bool, bActive);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHanoiFloodStallSignature, FName, ZoneId, float, DepthM);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHanoiFloodClosureSignature, FName, ClosureId, bool, bEntered);

/**
 * Runs a flood layer in the world (docs/gdd/13 §c3_07 Đêm nước lên). A mission step with
 * params.flood_layer naming a flood_layers row starts it at the game time the step starts (c3_07:
 * 18:00); "live" is the weather-driven street flooding of chapter 1 and is not handled here. The
 * layer is saved (FHanoiPlayerState ActiveFloodLayer / FloodLayerStart) and resumes on load; it
 * ends after duration_h game hours. While it runs, every Settings.FloodUpdateGameMinutes:
 *  - traffic: edges of every AHanoiTrafficGraph whose midpoint is in a zone are blocked when the
 *    water reaches passable_depth_m.xe_may, slowed by slow_speed_factor above slow_depth_m; edges
 *    within an active closure are blocked (AI routes around, GPS too);
 *  - world events: the layer's world_events (mua_ngap) are on while a rain zone is deeper than
 *    slow_depth_m (missions, random events and the economy read them);
 *  - the player: a motorbike or bicycle in water at or above its passable depth stalls (mission
 *    event xe_chet_may, OnVehicleStalled; gameplay makes the rider push it); riding into an active
 *    closure from outside is the closure's traffic_rule violation, seen by the police posted there,
 *    unless the active step prices that crossing itself (params.apply_fine); being inside already
 *    when the closure starts is not (bãi giữa is evacuated, not fined).
 */
UCLASS()
class HANOICITYRUNTIME_API UHanoiFloodSubsystem : public UGameInstanceSubsystem, public FTickableGameObject
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	virtual void Tick(float DeltaTime) override;
	virtual TStatId GetStatId() const override;
	virtual bool IsTickable() const override { return bReady; }
	virtual ETickableTickType GetTickableTickType() const override { return ETickableTickType::Conditional; }

	/** Starts a layer now (normally done by the mission step). */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Flood")
	bool StartLayer(FName LayerId);

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Flood")
	void StopLayer();

	UFUNCTION(BlueprintPure, Category = "Hanoi|Flood")
	bool IsActive() const { return !ActiveLayer.IsNone(); }

	UFUNCTION(BlueprintPure, Category = "Hanoi|Flood")
	FName GetActiveLayer() const { return ActiveLayer; }

	/** Game hours since the layer started. */
	UFUNCTION(BlueprintPure, Category = "Hanoi|Flood")
	float GetFloodTimeH() const;

	/** River level at the layer's gauge (m), 0 when no layer runs. */
	UFUNCTION(BlueprintPure, Category = "Hanoi|Flood")
	float GetRiverLevelM() const;

	UFUNCTION(BlueprintPure, Category = "Hanoi|Flood")
	float GetZoneDepthM(FName ZoneId) const;

	/** Deepest water at a world point (m), and the zone it comes from. */
	UFUNCTION(BlueprintPure, Category = "Hanoi|Flood")
	float GetDepthAt(const FVector& WorldLocation, FName& OutZoneId) const;

	UFUNCTION(BlueprintPure, Category = "Hanoi|Flood")
	bool IsPassableAt(const FVector& WorldLocation, FName VehicleClass) const;

	/** 1 in dry streets, slow_speed_factor in slowing water, 0 where the vehicle cannot pass. */
	UFUNCTION(BlueprintPure, Category = "Hanoi|Flood")
	float GetSpeedFactorAt(const FVector& WorldLocation, FName VehicleClass) const;

	UFUNCTION(BlueprintPure, Category = "Hanoi|Flood")
	bool IsClosureActive(FName ClosureId) const;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Flood")
	FHanoiFloodLayerSignature OnLayerChanged;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Flood")
	FHanoiFloodStallSignature OnVehicleStalled;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Flood")
	FHanoiFloodClosureSignature OnClosureEntered;

	/** Mission event when the player's vehicle stalls in water. */
	static const FName StallEvent;

private:
	UFUNCTION()
	void HandleStepStarted(FName MissionId, int32 StepIndex, const FHanoiMissionStep& Step);

	void Resume();
	void UpdateWorld();
	void UpdateTraffic(double T);
	void UpdatePlayer(double T);
	void ClearWorld();
	bool ZoneCenter(const FHanoiFloodLayerZone& Zone, FVector& OutWorld) const;
	bool ClosureCenter(const FHanoiFloodLayerClosure& Closure, FVector& OutWorld) const;
	FName PlayerVehicleClass() const;
	class UHanoiMissionSubsystem* Missions() const;
	class UWorld* GameWorld() const;

	FHanoiFloodModel Model;
	FName ActiveLayer;
	FDateTime Start;
	double LastUpdateH = -1.0;
	bool bWorldEventsOn = false;
	TSet<FName> PlayerInClosures;
	FName PlayerStalledZone;
	/** The first player update after a start or load only records where the player is. */
	bool bPlayerSeeded = false;
	bool bReady = false;
};
