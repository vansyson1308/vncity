#include "HanoiMinigameSubsystem.h"
#include "HanoiContentSubsystem.h"
#include "HanoiMissionSubsystem.h"
#include "Dom/JsonObject.h"
#include "Engine/GameInstance.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

// ------------------------------------------------------------------ session rules

void FHanoiMinigameSession::Begin(const FHanoiMinigameModeRow& Mode, int32 InDifficulty, int32 InPassScore, int32 InMaxFaults, float InTimeLimitS)
{
	*this = FHanoiMinigameSession();
	ModeId = Mode.Id;
	Mechanic = Mode.Mechanic;
	Difficulty = InDifficulty;
	PassScore = InPassScore;
	MaxFaults = InMaxFaults;
	TimeLimitS = InTimeLimitS;
	for (const FHanoiMinigameModeTask& Task : Mode.Tasks)
	{
		if (Task.MinDifficulty <= Difficulty)
		{
			Tasks.Add(Task);
		}
	}
}

const FHanoiMinigameModeTask* FHanoiMinigameSession::FindTask(FName TaskId) const
{
	return Tasks.FindByPredicate([TaskId](const FHanoiMinigameModeTask& T) { return T.Id == TaskId; });
}

void FHanoiMinigameSession::Wrong(const FHanoiMinigameModeTask& Task)
{
	Faults += Task.FaultWeight > 0 ? Task.FaultWeight : 1;
	if (Task.bCritical)
	{
		bCriticalFailed = true;
	}
}

bool FHanoiMinigameSession::Answer(FName TaskId, FName Label)
{
	const FHanoiMinigameModeTask* Task = FindTask(TaskId);
	if (!IsSorting() || !Task || Done.Contains(TaskId) || IsFinished())
	{
		return false;
	}
	Done.Add(TaskId);
	if (Label == Task->Answer)
	{
		Right.Add(TaskId);
		Points += Task->Points;
		return true;
	}
	Wrong(*Task);
	return false;
}

bool FHanoiMinigameSession::Perform(FName TaskId)
{
	const FHanoiMinigameModeTask* Task = FindTask(TaskId);
	if (IsSorting() || !Task || Done.Contains(TaskId) || IsFinished())
	{
		return false;
	}
	Done.Add(TaskId);
	if (Task->bForbidden)
	{
		Wrong(*Task);
		return false;
	}
	bool bReady = true;
	for (const FHanoiMinigameModeTask& Other : Tasks)
	{
		if (!Other.bForbidden && Other.Order < Task->Order && !Done.Contains(Other.Id))
		{
			bReady = false;
			break;
		}
	}
	if (bReady)
	{
		Right.Add(TaskId);
		Points += Task->Points;
		return true;
	}
	Wrong(*Task);
	return false;
}

void FHanoiMinigameSession::SetElapsed(float Seconds)
{
	Elapsed = Seconds;
	if (TimeLimitS > 0.f && Seconds > TimeLimitS && !IsFinished())
	{
		bTimedOut = true;
	}
}

int32 FHanoiMinigameSession::TotalPoints() const
{
	int32 Total = 0;
	for (const FHanoiMinigameModeTask& Task : Tasks)
	{
		Total += Task.bForbidden ? 0 : Task.Points;
	}
	return Total;
}

int32 FHanoiMinigameSession::Score() const
{
	const int32 Total = TotalPoints();
	return Total == 0 ? 100 : (100 * Points) / Total;
}

bool FHanoiMinigameSession::IsComplete() const
{
	for (const FHanoiMinigameModeTask& Task : Tasks)
	{
		const bool bNeeded = IsSorting() || !Task.bForbidden;
		if (bNeeded && !Done.Contains(Task.Id))
		{
			return false;
		}
	}
	return true;
}

bool FHanoiMinigameSession::IsPassed() const
{
	return IsComplete() && !bCriticalFailed && !bTimedOut && Score() >= PassScore && Faults <= MaxFaults;
}

// ------------------------------------------------------------------ subsystem

void UHanoiMinigameSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Collection.InitializeDependency(UHanoiContentSubsystem::StaticClass());
	Collection.InitializeDependency(UHanoiMissionSubsystem::StaticClass());
	Super::Initialize(Collection);
	if (UHanoiMissionSubsystem* M = Missions())
	{
		M->OnStepStarted.AddDynamic(this, &UHanoiMinigameSubsystem::HandleStepStarted);
		M->OnStepCompleted.AddDynamic(this, &UHanoiMinigameSubsystem::HandleStepCompleted);
		M->OnMissionEnded.AddDynamic(this, &UHanoiMinigameSubsystem::HandleMissionEnded);
	}
}

void UHanoiMinigameSubsystem::Deinitialize()
{
	if (UHanoiMissionSubsystem* M = Missions())
	{
		M->OnStepStarted.RemoveDynamic(this, &UHanoiMinigameSubsystem::HandleStepStarted);
		M->OnStepCompleted.RemoveDynamic(this, &UHanoiMinigameSubsystem::HandleStepCompleted);
		M->OnMissionEnded.RemoveDynamic(this, &UHanoiMinigameSubsystem::HandleMissionEnded);
	}
	bRunning = false;
	Super::Deinitialize();
}

TStatId UHanoiMinigameSubsystem::GetStatId() const
{
	RETURN_QUICK_DECLARE_CYCLE_STAT(UHanoiMinigameSubsystem, STATGROUP_Tickables);
}

UHanoiMissionSubsystem* UHanoiMinigameSubsystem::Missions() const
{
	return GetGameInstance() ? GetGameInstance()->GetSubsystem<UHanoiMissionSubsystem>() : nullptr;
}

bool UHanoiMinigameSubsystem::StartSession(FName ModeId, int32 Difficulty, int32 PassScore, int32 MaxFaults, float TimeLimitS)
{
	const UHanoiContentSubsystem* Content = GetGameInstance()->GetSubsystem<UHanoiContentSubsystem>();
	const FHanoiMinigameModeRow* Mode = Content ? Content->Find<FHanoiMinigameModeRow>(TEXT("minigame_modes"), ModeId) : nullptr;
	if (!Mode)
	{
		return false;
	}
	Session.Begin(*Mode, Difficulty, PassScore, MaxFaults, TimeLimitS);
	bRunning = true;
	bForMission = false;
	OnMinigameStarted.Broadcast(Session);
	return true;
}

void UHanoiMinigameSubsystem::HandleStepStarted(FName MissionId, int32 StepIndex, const FHanoiMissionStep& Step)
{
	if (Step.Kind != EHanoiMissionStepKind::Minigame || Step.Params.IsEmpty())
	{
		return;
	}
	TSharedPtr<FJsonObject> Params;
	if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Step.Params), Params) || !Params.IsValid())
	{
		return;
	}
	FString Mode;
	if (!Params->TryGetStringField(TEXT("mode"), Mode))
	{
		return;
	}
	double Difficulty = 0.0, PassScore = 0.0, MaxFaults = double(MAX_int32), TimeLimit = 0.0;
	Params->TryGetNumberField(TEXT("difficulty"), Difficulty);
	Params->TryGetNumberField(TEXT("pass_score"), PassScore);
	Params->TryGetNumberField(TEXT("max_faults"), MaxFaults);
	Params->TryGetNumberField(TEXT("time_limit_s"), TimeLimit);
	// Modes that are not minigame_modes rows (activities' minigames) are played by gameplay code.
	if (StartSession(FName(*Mode), int32(Difficulty), int32(PassScore), int32(MaxFaults), float(TimeLimit)))
	{
		bForMission = true;
	}
}

void UHanoiMinigameSubsystem::HandleStepCompleted(FName MissionId, int32 StepIndex, const FHanoiMissionStep& Step)
{
	// The mission moved on by itself (its own time limit, a debug skip): drop the session.
	if (bForMission && !bFinishing)
	{
		bRunning = false;
		bForMission = false;
	}
}

void UHanoiMinigameSubsystem::HandleMissionEnded(FName MissionId, bool bSuccess, FName Reason)
{
	HandleStepCompleted(MissionId, INDEX_NONE, FHanoiMissionStep());
}

void UHanoiMinigameSubsystem::Tick(float DeltaTime)
{
	Session.SetElapsed(Session.Elapsed + DeltaTime);
	FinishIfDone();
}

bool UHanoiMinigameSubsystem::Answer(FName TaskId, FName Label)
{
	if (!bRunning)
	{
		return false;
	}
	const bool bRight = Session.Answer(TaskId, Label);
	OnTaskResolved.Broadcast(TaskId, bRight, Session);
	FinishIfDone();
	return bRight;
}

bool UHanoiMinigameSubsystem::Perform(FName TaskId)
{
	if (!bRunning)
	{
		return false;
	}
	const bool bRight = Session.Perform(TaskId);
	OnTaskResolved.Broadcast(TaskId, bRight, Session);
	FinishIfDone();
	return bRight;
}

void UHanoiMinigameSubsystem::GiveUp()
{
	if (bRunning)
	{
		Session.bTimedOut = true;
		FinishIfDone();
	}
}

void UHanoiMinigameSubsystem::FinishIfDone()
{
	if (!bRunning || !Session.IsFinished())
	{
		return;
	}
	bRunning = false;
	const bool bPassed = Session.IsPassed();
	OnMinigameEnded.Broadcast(bPassed, Session);
	if (bForMission)
	{
		bForMission = false;
		if (UHanoiMissionSubsystem* M = Missions())
		{
			TGuardValue<bool> Guard(bFinishing, true);
			M->CompleteCurrentStep(bPassed ? UHanoiMissionSubsystem::OutcomePassed : UHanoiMissionSubsystem::OutcomeFailed);
		}
	}
}

int32 UHanoiMinigameSubsystem::MonthsBetween(const FString& A, const FString& B)
{
	auto Parse = [](const FString& S, int32& Y, int32& M)
	{
		FString Ys, Ms;
		S.Split(TEXT("-"), &Ys, &Ms);
		Y = FCString::Atoi(*Ys);
		M = FCString::Atoi(*Ms);
	};
	int32 Ya, Ma, Yb, Mb;
	Parse(A, Ya, Ma);
	Parse(B, Yb, Mb);
	return (Yb - Ya) * 12 + (Mb - Ma);
}

int64 UHanoiMinigameSubsystem::LedgerOwed(const FHanoiMinigameModeRow& Mode)
{
	const FHanoiMinigameModeLedger& L = Mode.Ledger;
	if (L.PrincipalLabel.IsNone())
	{
		return -1;
	}
	int64 Principal = 0, Paid = 0;
	for (const FHanoiMinigameModeTask& Task : Mode.Tasks)
	{
		Principal += Task.Answer == L.PrincipalLabel ? Task.AmountVnd : 0;
		Paid += Task.Answer == L.PaidLabel ? Task.AmountVnd : 0;
	}
	const double Years = MonthsBetween(L.Start, L.AsOf) / 12.0;
	return int64(FMath::RoundHalfToEven(double(Principal) + double(Principal) * double(L.LegalRatePerYear) * Years - double(Paid)));
}

int64 UHanoiMinigameSubsystem::GetLedgerOwed(FName ModeId) const
{
	const UHanoiContentSubsystem* Content = GetGameInstance()->GetSubsystem<UHanoiContentSubsystem>();
	const FHanoiMinigameModeRow* Mode = Content ? Content->Find<FHanoiMinigameModeRow>(TEXT("minigame_modes"), ModeId) : nullptr;
	return Mode ? LedgerOwed(*Mode) : -1;
}
