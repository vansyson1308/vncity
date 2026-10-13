#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Tickable.h"
#include "HanoiSaveGame.h"
#include "Generated/HanoiContentTypes.h"
#include "HanoiMissionSubsystem.generated.h"

class FJsonObject;
class FJsonValue;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FHanoiMissionStepSignature, FName, MissionId, int32, StepIndex, const FHanoiMissionStep&, Step);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FHanoiMissionEndSignature, FName, MissionId, bool, bSuccess, FName, Reason);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHanoiPlayerStateSignature, const FHanoiPlayerState&, State);
/** choice step: UI shows PromptKey with Options (the step's next keys) and calls CompleteCurrentStep(option). */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_FourParams(FHanoiChoiceRequestSignature, FName, MissionId, FName, StepId, FName, PromptKey, const TArray<FName>&, Options);
/** params.apply_fine: the fine was added to the player's unpaid fines. */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FHanoiFineAppliedSignature, FName, RuleId, int64, FineVnd, int32, LicencePoints);
/** params.protagonist / switch_protagonist_on_line: possess CharacterId. LineId is None when the step switched. */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHanoiProtagonistSignature, FName, CharacterId, FName, LineId);
/** params.minimap: HUD shows/hides the minimap. */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHanoiMinimapSignature, bool, bVisible);
/** params.requires_event: the step cannot complete until SetWorldEventActive(EventId, true). */
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FHanoiStepWaitingSignature, FName, MissionId, FName, StepId, FName, EventId);

/**
 * Runs data-driven missions (collection "missions") one at a time.
 *
 * Step completion by kind:
 *  - go_to, ride, deliver, drive_passenger, follow: player pawn within params.radius_m
 *    (default Settings.MissionArriveRadiusM) of the step target, in plan (XY).
 *  - wait_until: game hour inside params.hours [from, to] or params.hour (one hour window).
 *  - escape_traffic_police: heat reaches 0 (params.heat adds heat when the step starts).
 *  - talk, choice, minigame, cook, cutscene, photograph, collect: gameplay/UI calls
 *    CompleteCurrentStep(Outcome); for talk the dialogue UI reads Step.Dialogue.
 * Branching: Step.Next.Step, else Step.Next.Branches[Outcome] (falling back to "default"),
 * else the next step in array order. Next ids "end"/"success" finish, "fail" fails the mission.
 * fail_if entries: "time>N" (seconds in step), "heat>=N" (also > < <= ==), "event:<name>"
 * (ReportEvent), "flag:<name>". params.time_limit_s is shorthand for "time>N";
 * params.deadline_hour fails when the game clock passes that hour.
 * Step completion applies Step.SetFlags before the next step is resolved.
 * Runtime params (x-consumer "runtime" in missions.schema.json): radius_m, heat, hour, until_hour,
 * hours, time_limit_s, deadline_hour, requires_event, apply_fine, protagonist,
 * switch_protagonist_on_line, branch_source, player_input, minimap. Every other param is for
 * gameplay code, read with GetActiveStepParam* (tests/test_codegen_ue.py keeps this list honest).
 */
UCLASS()
class HANOICITYRUNTIME_API UHanoiMissionSubsystem : public UGameInstanceSubsystem, public FTickableGameObject
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	virtual void Tick(float DeltaTime) override;
	virtual TStatId GetStatId() const override;
	virtual bool IsTickable() const override { return bReady && bActive; }
	virtual ETickableTickType GetTickableTickType() const override { return ETickableTickType::Conditional; }

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Missions")
	bool CanStartMission(FName MissionId, FString& OutReason) const;

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Missions")
	bool StartMission(FName MissionId);

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Missions")
	void AbandonMission();

	/** Completes the current step with an outcome (choice key, minigame result, dialogue end...). */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Missions")
	void CompleteCurrentStep(FName Outcome);

	/** Gameplay event for fail_if "event:<name>". */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Missions")
	void ReportEvent(FName Event);

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Missions")
	void FailMission(FName Reason);

	/** Dialogue UI: a line was shown (drives params.switch_protagonist_on_line). */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Missions")
	void NotifyDialogueLine(FName LineId);

	/** World event (collection "events") started/ended; gates params.requires_event. */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Missions")
	void SetWorldEventActive(FName EventId, bool bIsActive);

	UFUNCTION(BlueprintPure, Category = "Hanoi|Missions")
	bool IsWorldEventActive(FName EventId) const { return ActiveWorldEvents.Contains(EventId); }

	/** False while the active step has params.minimap = false. */
	UFUNCTION(BlueprintPure, Category = "Hanoi|Missions")
	bool IsMinimapAllowed() const { return bMinimapAllowed; }

	/** Typed access to the active step's params for gameplay code (minigames, UI, vehicles). */
	UFUNCTION(BlueprintPure, Category = "Hanoi|Missions")
	bool GetActiveStepParamNumber(const FString& Key, float& OutValue) const;

	UFUNCTION(BlueprintPure, Category = "Hanoi|Missions")
	bool GetActiveStepParamString(const FString& Key, FString& OutValue) const;

	UFUNCTION(BlueprintPure, Category = "Hanoi|Missions")
	bool GetActiveStepParamBool(const FString& Key, bool& OutValue) const;

	/** Raw params JSON of the active step (arrays/objects), empty if none. */
	UFUNCTION(BlueprintPure, Category = "Hanoi|Missions")
	FString GetActiveStepParamsJson() const;

	UFUNCTION(BlueprintPure, Category = "Hanoi|Missions")
	bool IsMissionActive() const { return bActive; }

	UFUNCTION(BlueprintPure, Category = "Hanoi|Missions")
	FName GetActiveMissionId() const { return bActive ? ActiveMission.Id : NAME_None; }

	UFUNCTION(BlueprintPure, Category = "Hanoi|Missions")
	bool GetActiveStep(FHanoiMissionStep& OutStep) const;

	/** World location of the active step's target (for the HUD marker); false if none. */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Missions")
	bool GetActiveStepTargetLocation(FVector& OutWorld) const;

	/** Missions whose `requires` currently hold and that are not completed. */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Missions")
	TArray<FName> GetAvailableMissions() const;

	UFUNCTION(BlueprintPure, Category = "Hanoi|Missions")
	bool EvaluateCondition(const FHanoiCondition& Condition) const;

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Progress")
	void ApplyReward(const FHanoiReward& Reward);

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Progress")
	void AddMoney(int64 DeltaVnd);

	/** Spends if affordable; returns false (and spends nothing) otherwise. */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Progress")
	bool SpendMoney(int64 AmountVnd);

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Progress")
	void SetFlag(FName Flag, bool bSet);

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Progress")
	bool SaveProgress();

	UFUNCTION(BlueprintCallable, Category = "Hanoi|Progress")
	bool LoadProgress();

	UFUNCTION(BlueprintPure, Category = "Hanoi|Progress")
	FHanoiPlayerState GetPlayerState() const { return State; }

	/** C++ read access without a copy. */
	const FHanoiPlayerState& GetPlayerStateRef() const { return State; }

	/** Direct access for other subsystems (heat fines...). Call NotifyStateChanged after edits. */
	FHanoiPlayerState& MutableState() { return State; }
	void NotifyStateChanged() { OnStateChanged.Broadcast(State); }

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Missions")
	FHanoiMissionStepSignature OnStepStarted;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Missions")
	FHanoiMissionStepSignature OnStepCompleted;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Missions")
	FHanoiMissionEndSignature OnMissionEnded;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Progress")
	FHanoiPlayerStateSignature OnStateChanged;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Missions")
	FHanoiChoiceRequestSignature OnChoiceRequested;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Progress")
	FHanoiFineAppliedSignature OnFineApplied;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Missions")
	FHanoiProtagonistSignature OnProtagonistSwitched;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Missions")
	FHanoiMinimapSignature OnMinimapVisibilityChanged;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Missions")
	FHanoiStepWaitingSignature OnStepWaitingForEvent;

private:
	void EnterStep(int32 Index);
	void Advance(FName Outcome);
	void FinishMission(bool bSuccess, FName Reason);
	bool ShouldFail(FName& OutReason) const;
	bool IsAutoComplete() const;
	float GetParamNumber(const TCHAR* Key, float Default) const;
	bool TryGetParamNumber(const TCHAR* Key, double& OutValue) const;
	FString GetParamString(const TCHAR* Key) const;
	bool GetParamBool(const TCHAR* Key, bool bDefault) const;
	const TArray<TSharedPtr<FJsonValue>>* GetParamArray(const TCHAR* Key) const;
	TSharedPtr<FJsonObject> GetParamObject(const TCHAR* Key) const;
	bool IsStepGateOpen() const;
	void ApplyStepParamsOnEnter(const FHanoiMissionStep& Step);
	void ApplyFine(FName RuleId);
	void SwitchProtagonist(const FHanoiRef& Character, FName LineId);
	void SetMinimapAllowed(bool bAllowed);
	float GetCurrentHeat() const;
	UWorld* GetGameWorld() const;

	UPROPERTY()
	FHanoiPlayerState State;

	UPROPERTY()
	FHanoiMissionRow ActiveMission;

	bool bReady = false;
	bool bActive = false;
	int32 StepIndex = INDEX_NONE;
	float StepElapsed = 0.f;
	TSet<FName> StepEvents;
	TSharedPtr<FJsonObject> StepParams;
	TSet<FName> ActiveWorldEvents;
	FName RequiredEvent;
	bool bMinimapAllowed = true;
	/** params.deadline_hour: game hours allowed from step start, < 0 = none. */
	double DeadlineGameHours = -1.0;
	FDateTime StepStartGameTime;
};
