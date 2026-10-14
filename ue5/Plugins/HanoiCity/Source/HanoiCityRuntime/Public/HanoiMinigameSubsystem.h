#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Tickable.h"
#include "Generated/HanoiContentTypes.h"
#include "HanoiMinigameSubsystem.generated.h"

/**
 * One play of a minigame mode (collection minigame_modes) at a step's params. The rules, the same in
 * the Unity core's MinigameSession and in tools/runtime_rules.py (which writes the golden plays both
 * engines must score identically):
 *  - tasks in play: min_difficulty <= params.difficulty.
 *  - phan_loai (sort): each task is answered once with a label; right = its points, wrong = its
 *    fault_weight (default 1) in faults.
 *  - sap_xep (sequence): each task is performed once; a non-forbidden task is right when every
 *    in-play non-forbidden task of a lower order is already done (else it is spent, no points, a
 *    fault); a forbidden task is a fault.
 *  - a critical task that goes wrong ends the game at once.
 *  - complete: every task answered (phan_loai) / every non-forbidden task performed (sap_xep).
 *  - score = floor(100 * points right / points in play).
 *  - dat when complete, no critical failure, no time out, score >= pass_score, faults <= max_faults;
 *    otherwise chua_dat.
 */
USTRUCT(BlueprintType)
struct HANOICITYRUNTIME_API FHanoiMinigameSession
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Minigame")
	FName ModeId;

	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Minigame")
	EHanoiMinigameModeMechanic Mechanic = EHanoiMinigameModeMechanic::Unset;

	/** In-play tasks, content order. */
	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Minigame")
	TArray<FHanoiMinigameModeTask> Tasks;

	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Minigame")
	int32 Difficulty = 0;

	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Minigame")
	int32 PassScore = 0;

	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Minigame")
	int32 MaxFaults = MAX_int32;

	/** Seconds, 0 = none. */
	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Minigame")
	float TimeLimitS = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Minigame")
	TArray<FName> Done;

	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Minigame")
	TArray<FName> Right;

	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Minigame")
	int32 Points = 0;

	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Minigame")
	int32 Faults = 0;

	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Minigame")
	bool bCriticalFailed = false;

	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Minigame")
	bool bTimedOut = false;

	UPROPERTY(BlueprintReadOnly, Category = "Hanoi|Minigame")
	float Elapsed = 0.f;

	void Begin(const FHanoiMinigameModeRow& Mode, int32 InDifficulty, int32 InPassScore, int32 InMaxFaults, float InTimeLimitS);
	bool IsSorting() const { return Mechanic == EHanoiMinigameModeMechanic::PhanLoai; }
	const FHanoiMinigameModeTask* FindTask(FName TaskId) const;
	bool Answer(FName TaskId, FName Label);
	bool Perform(FName TaskId);
	/** Total seconds since the start; sets bTimedOut past the limit. */
	void SetElapsed(float Seconds);
	int32 TotalPoints() const;
	int32 Score() const;
	bool IsComplete() const;
	bool IsFinished() const { return bCriticalFailed || bTimedOut || IsComplete(); }
	bool IsPassed() const;

private:
	void Wrong(const FHanoiMinigameModeTask& Task);
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FHanoiMinigameStartedSignature, const FHanoiMinigameSession&, Session);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FHanoiMinigameTaskSignature, FName, TaskId, bool, bRight, const FHanoiMinigameSession&, Session);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FHanoiMinigameEndedSignature, bool, bPassed, const FHanoiMinigameSession&, Session);

/**
 * Runs the data-driven minigame modes of chapters 3-5 (dung_lai_dong_tien, tham_dinh_cheo,
 * cuu_phim_uot, cuu_bang_uot). When a mission enters a minigame step whose params.mode names a
 * minigame_modes row, a session starts with the step's difficulty / pass_score / max_faults /
 * time_limit_s; the UI shows the tasks (OnMinigameStarted) and calls Answer / Perform. When the
 * session finishes (complete, critical mistake or time out), the step completes with dat or
 * chua_dat and the mission takes that branch: losing has a price written in the story (c4_01:
 * phim_hong / bang_dut set the flags that take an ending choice away in chapter 5), it is not a
 * game over. Other minigame modes (activities) stay with gameplay code.
 */
UCLASS()
class HANOICITYRUNTIME_API UHanoiMinigameSubsystem : public UGameInstanceSubsystem, public FTickableGameObject
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	virtual void Tick(float DeltaTime) override;
	virtual TStatId GetStatId() const override;
	virtual bool IsTickable() const override { return bRunning; }
	virtual ETickableTickType GetTickableTickType() const override { return ETickableTickType::Conditional; }

	/** Starts a session outside a mission (practice, debug). Returns false for an unknown mode. */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Minigame")
	bool StartSession(FName ModeId, int32 Difficulty, int32 PassScore, int32 MaxFaults, float TimeLimitS);

	UFUNCTION(BlueprintPure, Category = "Hanoi|Minigame")
	bool IsRunning() const { return bRunning; }

	UFUNCTION(BlueprintPure, Category = "Hanoi|Minigame")
	const FHanoiMinigameSession& GetSession() const { return Session; }

	/** phan_loai: label a task. True when right. */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Minigame")
	bool Answer(FName TaskId, FName Label);

	/** sap_xep: do a step of the procedure. True when right. */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Minigame")
	bool Perform(FName TaskId);

	/** The player gives up: the session ends chua_dat. */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Minigame")
	void GiveUp();

	/** Ledger modes: what is owed under the law (BLDS Điều 468) from the answer key; -1 without a ledger. */
	UFUNCTION(BlueprintPure, Category = "Hanoi|Minigame")
	int64 GetLedgerOwed(FName ModeId) const;

	static int64 LedgerOwed(const FHanoiMinigameModeRow& Mode);
	/** Whole months from "YYYY-MM" A to B. */
	static int32 MonthsBetween(const FString& A, const FString& B);

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Minigame")
	FHanoiMinigameStartedSignature OnMinigameStarted;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Minigame")
	FHanoiMinigameTaskSignature OnTaskResolved;

	UPROPERTY(BlueprintAssignable, Category = "Hanoi|Minigame")
	FHanoiMinigameEndedSignature OnMinigameEnded;

private:
	UFUNCTION()
	void HandleStepStarted(FName MissionId, int32 StepIndex, const FHanoiMissionStep& Step);

	UFUNCTION()
	void HandleStepCompleted(FName MissionId, int32 StepIndex, const FHanoiMissionStep& Step);

	UFUNCTION()
	void HandleMissionEnded(FName MissionId, bool bSuccess, FName Reason);

	void FinishIfDone();
	class UHanoiMissionSubsystem* Missions() const;

	UPROPERTY()
	FHanoiMinigameSession Session;

	bool bRunning = false;
	/** The session belongs to the active mission step (completes it when it ends). */
	bool bForMission = false;
	bool bFinishing = false;
};
