#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Tickable.h"
#include "Generated/HanoiContentTypes.h"
#include "HanoiRandomEventSubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHanoiRandomEventStartedSignature, const FHanoiRandomEventsRow&, Event);
/** A choice with a minigame was picked: gameplay plays Activity and calls CompleteMinigame(bPassed). */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FHanoiRandomEventMinigameSignature, FName, EventId, FName, ChoiceId, const FHanoiRef&, Activity);
/** ChoiceId is None when the player rode past (ignore_effect); Outcome is the text to show (empty when ignored or the minigame was lost). */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FHanoiRandomEventResolvedSignature, FName, EventId, FName, ChoiceId, const FHanoiText&, Outcome);

/**
 * Random street events between missions (collection random_events, docs/gdd/02 §7.1), the C++ twin
 * of the Unity core's RandomEventSystem (same rules, tests/test_unity_harness.py keeps them aligned).
 *
 * Every game hour (UHanoiTimeWeatherSubsystem hour change, polled in Tick), with no event running
 * and no mission active (Settings.bRandomEventsDuringMissions), events are shuffled and each one
 * whose spawn filters hold rolls spawn.chance_per_game_hour; the first hit starts. Filters:
 * max_per_playthrough, cooldown_days, hours, weather, events_active, protagonist, on_vehicle
 * (EHanoiOptionalBool: Unset = either), road_types and the player context (UHanoiMissionSubsystem::
 * SetPlayerContext), districts (nearest content district center to the pawn), landmarks (within
 * Settings.RandomEventLandmarkRadiusM), then `requires`. The player ignores the event (Ignore, or
 * duration_s real seconds pass: ignore_effect) or picks a choice (Choose): a choice with a
 * minigame waits for CompleteMinigame (effect when passed, fail_effect when not, the activity's
 * skills trained either way). Effects: money (may be negative), reputation, heat, a traffic rule's
 * fine, items, skills trained, game minutes spent. Counts and last times are saved in
 * FHanoiPlayerState (RandomEventCounts, RandomEventLast).
 */
UCLASS()
class HANOICITYRUNTIME_API UHanoiRandomEventSubsystem : public UGameInstanceSubsystem, public FTickableGameObject
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	virtual void Tick(float DeltaTime) override;
	virtual TStatId GetStatId() const override;
	virtual bool IsTickable() const override { return bReady; }
	virtual ETickableTickType GetTickableTickType() const override { return ETickableTickType::Conditional; }

	/** Rolls the dice once now (normally done every game hour). */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|RandomEvents")
	void RollNow();

	/** Every filter of spawn + requires + cooldown, without the dice. OutReason names the one that failed. */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|RandomEvents")
	bool CanSpawn(FName EventId, FString& OutReason) const;

	/** Starts an event now, skipping the dice (debug menu, scripted moments). */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|RandomEvents")
	bool Spawn(FName EventId);

	UFUNCTION(BlueprintPure, Category = "Hanoi|RandomEvents")
	bool HasCurrentEvent() const { return !Current.Id.IsNone(); }

	UFUNCTION(BlueprintPure, Category = "Hanoi|RandomEvents")
	FHanoiRandomEventsRow GetCurrentEvent() const { return Current; }

	UFUNCTION(BlueprintPure, Category = "Hanoi|RandomEvents")
	bool IsWaitingForMinigame() const { return !PendingChoice.IsNone(); }

	/** The player rode past: ignore_effect. */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|RandomEvents")
	void Ignore();

	/** Picks a choice of the current event. False if there is no such choice. */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|RandomEvents")
	bool Choose(FName ChoiceId);

	/** The minigame of the pending choice ended (dat = effect, chua_dat = fail_effect). */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|RandomEvents")
	void CompleteMinigame(bool bPassed);

	/** Content district whose center is nearest to a world point (None without districts or geo). */
	UFUNCTION(BlueprintPure, Category = "Hanoi|RandomEvents")
	FName LocateDistrict(const FVector& WorldLocation) const;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|RandomEvents")
	FHanoiRandomEventStartedSignature OnEventStarted;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|RandomEvents")
	FHanoiRandomEventMinigameSignature OnMinigameRequested;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|RandomEvents")
	FHanoiRandomEventResolvedSignature OnEventResolved;

private:
	void StartEvent(const FHanoiRandomEventsRow& Row);
	template <typename EffectType>
	void ApplyEffect(const EffectType& Effect);
	bool PlayerPawnLocation(FVector& OutWorld) const;
	class UHanoiMissionSubsystem* Missions() const;

	UPROPERTY()
	FHanoiRandomEventsRow Current;

	FName PendingChoice;
	float Remaining = 0.f;
	int32 LastHour = -1;
	bool bReady = false;
	FRandomStream Random;
};
