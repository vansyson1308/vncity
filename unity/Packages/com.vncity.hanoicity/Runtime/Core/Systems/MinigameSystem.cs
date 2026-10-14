using System;
using System.Collections.Generic;
using System.Linq;
using HanoiCity.Content;
using Newtonsoft.Json.Linq;

namespace HanoiCity.Systems
{
    /// <summary>
    /// One play of a minigame mode (minigame_modes.json) at a step's params; twin of the UE
    /// FHanoiMinigameSession and of tools/runtime_rules.py Session (the golden plays in
    /// tests/golden/runtime_rules.json must score the same here). Rules: tasks in play have
    /// min_difficulty &lt;= difficulty. phan_loai: each task answered once with a label, right = its
    /// points, wrong = fault_weight (default 1) faults. sap_xep: each task performed once; a
    /// non-forbidden task is right when every in-play non-forbidden task of a lower order is done
    /// (else spent without points, a fault); a forbidden task is a fault. A critical task gone wrong
    /// ends the game. Complete: every task answered (phan_loai) / every non-forbidden task performed
    /// (sap_xep). score = floor(100 * points / points in play); dat when complete, no critical
    /// failure, no time out, score &gt;= pass_score, faults &lt;= max_faults.
    /// </summary>
    public sealed class MinigameSession
    {
        public HanoiMinigameModeRow Mode { get; }
        public IReadOnlyList<HanoiMinigameModeTask> Tasks { get; }
        public int Difficulty { get; }
        public double PassScore { get; }
        public int MaxFaults { get; }
        public double TimeLimitS { get; }
        public List<string> Done { get; } = new List<string>();
        public HashSet<string> Right { get; } = new HashSet<string>();
        public int Points { get; private set; }
        public int Faults { get; private set; }
        public bool CriticalFailed { get; private set; }
        public bool TimedOut { get; private set; }
        public double Elapsed { get; private set; }

        public MinigameSession(HanoiMinigameModeRow mode, int difficulty, double passScore, int maxFaults, double timeLimitS)
        {
            Mode = mode;
            Difficulty = difficulty;
            PassScore = passScore;
            MaxFaults = maxFaults;
            TimeLimitS = timeLimitS;
            Tasks = mode.Tasks.Where(t => (t.MinDifficulty ?? 0) <= difficulty).ToList();
        }

        public bool Sorting => Mode.Mechanic == HanoiMinigameModeMechanic.PhanLoai;

        public HanoiMinigameModeTask Find(string taskId) => Tasks.FirstOrDefault(t => t.Id == taskId);

        void Wrong(HanoiMinigameModeTask t)
        {
            Faults += t.FaultWeight ?? 1;
            if (t.Critical == true) CriticalFailed = true;
        }

        /// <summary>phan_loai. True when right; false for a wrong, unknown or repeated answer.</summary>
        public bool Answer(string taskId, string label)
        {
            var t = Find(taskId);
            if (!Sorting || t == null || Done.Contains(taskId) || Finished) return false;
            Done.Add(taskId);
            if (label == t.Answer)
            {
                Right.Add(taskId);
                Points += t.Points;
                return true;
            }
            Wrong(t);
            return false;
        }

        /// <summary>sap_xep. True when the step was right (in order, not forbidden).</summary>
        public bool Perform(string taskId)
        {
            var t = Find(taskId);
            if (Sorting || t == null || Done.Contains(taskId) || Finished) return false;
            Done.Add(taskId);
            if (t.Forbidden == true)
            {
                Wrong(t);
                return false;
            }
            int order = t.Order ?? 0;
            bool ready = Tasks.Where(o => o.Forbidden != true && (o.Order ?? 0) < order).All(o => Done.Contains(o.Id));
            if (ready)
            {
                Right.Add(taskId);
                Points += t.Points;
                return true;
            }
            Wrong(t);
            return false;
        }

        /// <summary>Total seconds since the start; past the limit the game is timed out.</summary>
        public void SetElapsed(double seconds)
        {
            Elapsed = seconds;
            if (TimeLimitS > 0 && seconds > TimeLimitS && !Finished) TimedOut = true;
        }

        internal void GiveUp() => TimedOut = true;

        public int TotalPoints => Tasks.Where(t => t.Forbidden != true).Sum(t => t.Points);

        public int Score => TotalPoints == 0 ? 100 : 100 * Points / TotalPoints;

        public bool Complete => Tasks.Where(t => Sorting || t.Forbidden != true).All(t => Done.Contains(t.Id));

        public bool Finished => CriticalFailed || TimedOut || Complete;

        public bool Passed => Complete && !CriticalFailed && !TimedOut && Score >= PassScore && Faults <= MaxFaults;

        public string Outcome => Passed ? MissionRunner.OutcomePassed : MissionRunner.OutcomeFailed;
    }

    /// <summary>
    /// Runs the data-driven minigame modes of chapters 3-5 (twin of UHanoiMinigameSubsystem). A
    /// mission step of kind minigame whose params.mode is a minigame_modes id starts a session with
    /// the step's difficulty / pass_score / max_faults / time_limit_s; the UI calls Answer / Perform;
    /// when the session finishes the step completes dat or chua_dat and the mission branches. Losing
    /// costs what the story says (c4_01 phim_hong / bang_dut take an ending choice away in chapter 5),
    /// it is not a game over. Other modes (activities) stay with gameplay code.
    /// </summary>
    public sealed class MinigameSystem
    {
        readonly HanoiWorld world;
        bool forMission;
        bool finishing;

        public MinigameSession Current { get; private set; }
        public bool IsRunning => Current != null;

        public event Action<MinigameSession> Started;
        public event Action<string, bool, MinigameSession> TaskResolved;
        public event Action<bool, MinigameSession> Ended;

        public MinigameSystem(HanoiWorld world)
        {
            this.world = world;
            world.Missions.StepStarted += OnStepStarted;
            world.Missions.StepCompleted += (id, i, s) => DropIfMissionMovedOn();
            world.Missions.MissionEnded += (id, ok, reason) => DropIfMissionMovedOn();
        }

        public HanoiMinigameModeRow Mode(string id) => world.Content.Get<HanoiMinigameModeRow>("minigame_modes", HanoiRef.IdOf(id));

        /// <summary>Starts a session outside a mission (practice, debug). False for an unknown mode.</summary>
        public bool Start(string modeId, int difficulty, double passScore, int maxFaults, double timeLimitS)
        {
            var mode = Mode(modeId);
            if (mode == null) return false;
            Current = new MinigameSession(mode, difficulty, passScore, maxFaults, timeLimitS);
            forMission = false;
            Started?.Invoke(Current);
            return true;
        }

        void OnStepStarted(string missionId, int index, HanoiMissionStep step)
        {
            if (step.Kind != HanoiMissionStepKind.Minigame || !(step.Params is JObject p)) return;
            var mode = (string)p["mode"];
            if (mode == null) return;
            if (Start(mode, (int?)p["difficulty"] ?? 0, (double?)p["pass_score"] ?? 0, (int?)p["max_faults"] ?? int.MaxValue, (double?)p["time_limit_s"] ?? 0))
                forMission = true;
        }

        void DropIfMissionMovedOn()
        {
            // The mission moved on by itself (its own time limit, a debug skip): the session is void.
            if (forMission && !finishing) Cancel();
        }

        public void Cancel()
        {
            Current = null;
            forMission = false;
        }

        public void Tick(double realSeconds)
        {
            if (Current == null) return;
            Current.SetElapsed(Current.Elapsed + realSeconds);
            FinishIfDone();
        }

        public bool Answer(string taskId, string label)
        {
            if (Current == null) return false;
            bool right = Current.Answer(taskId, label);
            TaskResolved?.Invoke(taskId, right, Current);
            FinishIfDone();
            return right;
        }

        public bool Perform(string taskId)
        {
            if (Current == null) return false;
            bool right = Current.Perform(taskId);
            TaskResolved?.Invoke(taskId, right, Current);
            FinishIfDone();
            return right;
        }

        /// <summary>The player gives up: the session ends chua_dat.</summary>
        public void GiveUp()
        {
            if (Current == null) return;
            Current.GiveUp();
            FinishIfDone();
        }

        void FinishIfDone()
        {
            var s = Current;
            if (s == null || !s.Finished) return;
            Current = null;
            bool mission = forMission;
            forMission = false;
            Ended?.Invoke(s.Passed, s);
            if (!mission) return;
            finishing = true;
            try { world.Missions.CompleteCurrentStep(s.Outcome); }
            finally { finishing = false; }
        }

        /// <summary>Ledger modes: what is owed under the law (BLDS Điều 468) from the answer key; null without a ledger.</summary>
        public static long? LedgerOwed(HanoiMinigameModeRow mode)
        {
            var lg = mode.Ledger;
            if (lg == null || string.IsNullOrEmpty(lg.PrincipalLabel)) return null;
            long principal = mode.Tasks.Where(t => t.Answer == lg.PrincipalLabel).Sum(t => t.AmountVnd ?? 0);
            long paid = mode.Tasks.Where(t => t.Answer == lg.PaidLabel).Sum(t => t.AmountVnd ?? 0);
            double years = MonthsBetween(lg.Start, lg.AsOf) / 12.0;
            return (long)Math.Round(principal + principal * lg.LegalRatePerYear * years - paid, MidpointRounding.ToEven);
        }

        /// <summary>Whole months from "YYYY-MM" a to b.</summary>
        public static int MonthsBetween(string a, string b)
        {
            var pa = a.Split('-');
            var pb = b.Split('-');
            return (int.Parse(pb[0]) - int.Parse(pa[0])) * 12 + (int.Parse(pb[1]) - int.Parse(pa[1]));
        }
    }
}
