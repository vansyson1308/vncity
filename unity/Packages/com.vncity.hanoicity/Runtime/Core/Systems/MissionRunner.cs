using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using HanoiCity.Content;
using HanoiCity.Geo;
using Newtonsoft.Json.Linq;

namespace HanoiCity.Systems
{
    /// <summary>
    /// Runs data-driven missions one at a time: a line-by-line port of UHanoiMissionSubsystem, so the
    /// rules in docs/05-tich-hop-ue5.md §10 and docs/gdd/02-he-thong.md §8 hold in both engines.
    ///
    /// Auto-complete: go_to, ride, deliver, drive_passenger, follow within params.radius_m of the target
    /// (plan distance, ENU doubles); wait_until inside params.hours / until_hour / hour; escape_traffic_police
    /// when heat is back to 0. Everything else waits for CompleteCurrentStep(outcome) from gameplay/UI.
    /// next: a step id, a branch table (outcome, then "default"), or the next step in array order;
    /// end/success finish, fail fails. choice + branch_source "flag" picks the first branch whose flag is
    /// set. fail_if: time/heat comparisons, event:x (ReportEvent), flag:x. Runtime params (x-consumer
    /// "runtime"): radius_m, heat, hour, until_hour, hours, time_limit_s, deadline_hour, requires_event,
    /// apply_fine, protagonist, switch_protagonist_on_line, branch_source, player_input, minimap.
    /// </summary>
    public sealed class MissionRunner
    {
        public const string End = "end", Success = "success", Fail = "fail", Default = "default";

        /// <summary>The params this runner reads itself (tests keep it equal to missions.schema.json x-consumer runtime).</summary>
        public static readonly string[] RuntimeParams =
        {
            "radius_m", "heat", "hour", "until_hour", "hours", "time_limit_s", "deadline_hour", "requires_event",
            "apply_fine", "protagonist", "switch_protagonist_on_line", "branch_source", "player_input", "minimap",
        };

        static readonly Regex FailIfPattern = new Regex(@"^(event|flag):[a-z0-9_]+$|^(time|heat)(>=|<=|==|>|<)\d+(\.\d+)?$", RegexOptions.CultureInvariant);
        static readonly string[] Ops = { ">=", "<=", "==", ">", "<" };

        readonly HanoiWorld world;

        HanoiMissionRow active;
        int stepIndex = -1;
        double stepElapsed;
        readonly HashSet<string> stepEvents = new HashSet<string>();
        JObject stepParams;
        string requiredEvent;
        double deadlineGameHours = -1;
        DateTime stepStartGameTime;

        public bool IsActive => active != null;
        public string ActiveMissionId => active?.Id;
        public HanoiMissionRow ActiveMission => active;
        public int StepIndex => stepIndex;
        public HanoiMissionStep ActiveStep => active != null && stepIndex >= 0 && stepIndex < active.Steps.Count ? active.Steps[stepIndex] : null;
        public double StepElapsedSeconds => stepElapsed;
        public bool MinimapAllowed { get; private set; } = true;

        public event Action<string, int, HanoiMissionStep> StepStarted;
        public event Action<string, int, HanoiMissionStep> StepCompleted;
        /// <summary>(mission, success, reason)</summary>
        public event Action<string, bool, string> MissionEnded;
        /// <summary>choice step: UI shows the prompt (params.player_input) with the options and calls CompleteCurrentStep(option).</summary>
        public event Action<string, string, string, IReadOnlyList<string>> ChoiceRequested;
        /// <summary>params.apply_fine: (rule, fine VND, licence points).</summary>
        public event Action<string, long, int> FineApplied;
        /// <summary>params.protagonist / switch_protagonist_on_line: (character, line or null).</summary>
        public event Action<string, string> ProtagonistSwitched;
        public event Action<bool> MinimapVisibilityChanged;
        /// <summary>params.requires_event: (mission, step, event) cannot complete until the event is on.</summary>
        public event Action<string, string, string> StepWaitingForEvent;

        public MissionRunner(HanoiWorld world) { this.world = world; }

        // ------------------------------------------------------------------ starting

        public bool CanStartMission(string missionId, out string reason)
        {
            var row = world.Content.Mission(missionId);
            if (row == null) { reason = "unknown mission"; return false; }
            if (IsActive) { reason = "another mission is active"; return false; }
            if (world.State.CompletedMissions.Contains(missionId) && row.Type == HanoiMissionType.Story) { reason = "already completed"; return false; }
            if (row.Steps.Count == 0) { reason = "mission has no steps"; return false; }
            return CanStartNow(row, out reason);
        }

        bool CanStartNow(HanoiMissionRow row, out string reason)
        {
            reason = null;
            if (!world.EvaluateCondition(row.Requires)) { reason = "requirements not met"; return false; }
            var ev = FirstStepRequiredEvent(row);
            if (ev != null && !world.IsWorldEventActive(ev)) { reason = "waits for event " + ev; return false; }
            return true;
        }

        static string FirstStepRequiredEvent(HanoiMissionRow row)
        {
            var p = row.Steps.Count > 0 ? row.Steps[0].Params as JObject : null;
            var ev = (string)p?["requires_event"];
            return string.IsNullOrEmpty(ev) ? null : HanoiRef.IdOf(ev);
        }

        /// <summary>Missions whose requires hold now and that are not completed.</summary>
        public List<string> GetAvailableMissions() =>
            world.Content.All<HanoiMissionRow>("missions")
                .Where(m => !world.State.CompletedMissions.Contains(m.Id) && CanStartNow(m, out _))
                .Select(m => m.Id).ToList();

        public bool StartMission(string missionId)
        {
            if (!CanStartMission(missionId, out var reason))
            {
                world.Warn($"Cannot start mission {missionId}: {reason}");
                return false;
            }
            active = world.Content.Mission(missionId);
            // The mission belongs to its protagonists: possess the first one unless the player already is one.
            if (active.Protagonists.Count > 0 && !active.Protagonists.Any(r => r.Id == world.State.Protagonist))
                SwitchProtagonist(active.Protagonists[0].Id, null);
            EnterStep(0);
            return true;
        }

        public void AbandonMission() { if (IsActive) Finish(false, "abandoned"); }

        public void FailMission(string reason) { if (IsActive) Finish(false, reason); }

        /// <summary>Drop the mission without events or rewards (loading a save).</summary>
        internal void AbandonSilently()
        {
            active = null;
            stepIndex = -1;
            stepParams = null;
            requiredEvent = null;
            MinimapAllowed = true;
        }

        // ------------------------------------------------------------------ steps

        void EnterStep(int index)
        {
            stepIndex = index;
            stepElapsed = 0;
            stepEvents.Clear();
            requiredEvent = null;
            deadlineGameHours = -1;
            var step = active.Steps[index];
            stepParams = step.Params as JObject;
            if (step.Kind == HanoiMissionStepKind.EscapeTrafficPolice) world.Heat.AddHeat(ParamNumber("heat", 2.0));
            ApplyStepParamsOnEnter(step);
            var mission = active;
            OnStepStarted(step);
            if (active != mission || stepIndex != index) return;  // a listener already completed or ended the step

            if (step.Kind == HanoiMissionStepKind.Choice && step.Next != null && step.Next.IsBranching)
            {
                if (ParamString("branch_source") == "flag")
                {
                    // Branch keys are flag names set earlier (a dialogue choice); else "default".
                    foreach (var key in step.Next.Branches.Keys)
                    {
                        if (key != Default && world.State.Flags.Contains(key)) { Advance(key); return; }
                    }
                    Advance(Default);
                    return;
                }
                var options = step.Next.Branches.Keys.Where(k => k != Default).ToList();
                ChoiceRequested?.Invoke(active.Id, step.Id, ParamString("player_input"), options);
            }
        }

        void OnStepStarted(HanoiMissionStep step) => StepStarted?.Invoke(active.Id, stepIndex, step);

        void ApplyStepParamsOnEnter(HanoiMissionStep step)
        {
            foreach (var rule in step.FailIf)
                if (!FailIfPattern.IsMatch(rule))
                    world.Warn($"Mission {active.Id} step {step.Id}: fail_if '{rule}' is not understood and is ignored");

            SetMinimapAllowed(ParamBool("minimap", true));

            var protagonist = ParamString("protagonist");
            if (!string.IsNullOrEmpty(protagonist)) SwitchProtagonist(HanoiRef.IdOf(protagonist), null);

            var fine = ParamString("apply_fine");
            if (!string.IsNullOrEmpty(fine)) ApplyFine(HanoiRef.IdOf(fine));

            if (TryParamNumber("deadline_hour", out var deadline))
            {
                stepStartGameTime = world.Clock.Now;
                deadlineGameHours = ((deadline - world.Clock.HourOfDay) % 24.0 + 24.0) % 24.0;
                // Starting at the deadline hour itself means the same hour tomorrow, not zero hours left.
                // (UE's Fmod gives 0 here; see docs/13-tich-hop-unity.md §8.)
                if (deadlineGameHours < 1.0 / 60.0) deadlineGameHours = 24.0;
            }

            var ev = ParamString("requires_event");
            if (!string.IsNullOrEmpty(ev))
            {
                requiredEvent = HanoiRef.IdOf(ev);
                if (!world.IsWorldEventActive(requiredEvent)) StepWaitingForEvent?.Invoke(active.Id, step.Id, requiredEvent);
            }
        }

        bool StepGateOpen => requiredEvent == null || world.IsWorldEventActive(requiredEvent);

        void SetMinimapAllowed(bool allowed)
        {
            if (MinimapAllowed == allowed) return;
            MinimapAllowed = allowed;
            MinimapVisibilityChanged?.Invoke(allowed);
        }

        void SwitchProtagonist(string character, string lineId)
        {
            if (world.SetProtagonist(character)) ProtagonistSwitched?.Invoke(character, lineId);
        }

        void ApplyFine(string ruleId)
        {
            var rule = world.Content.TrafficRule(ruleId);
            if (rule == null) { world.Warn($"apply_fine: unknown traffic rule {ruleId}"); return; }
            // Mission fines are written for the player's motorbike (the default vehicle).
            long amount = rule.FineVnd.Motorbike ?? 0;
            world.Heat.AddFine(amount, rule.LicencePoints ?? 0);
            FineApplied?.Invoke(ruleId, amount, rule.LicencePoints ?? 0);
        }

        /// <summary>Dialogue UI: a line was shown (drives params.switch_protagonist_on_line).</summary>
        public void NotifyDialogueLine(string lineId)
        {
            if (!IsActive) return;
            if (stepParams?["switch_protagonist_on_line"] is JObject lines && lines[lineId] != null)
                SwitchProtagonist(HanoiRef.IdOf((string)lines[lineId]), lineId);
        }

        /// <summary>Completes the current step with an outcome (choice key, minigame result dat/chua_dat, dialogue end...).</summary>
        public void CompleteCurrentStep(string outcome = Success)
        {
            if (!IsActive) return;
            if (!StepGateOpen)
            {
                world.Warn($"Mission {active.Id}: step waits for event {requiredEvent}");
                return;
            }
            Advance(outcome ?? Success);
        }

        /// <summary>Gameplay event for fail_if "event:&lt;name&gt;".</summary>
        public void ReportEvent(string ev) => stepEvents.Add(ev);

        void Advance(string outcome)
        {
            var mission = active;
            var step = active.Steps[stepIndex];
            if (step.SetFlags.Count > 0)
            {
                foreach (var f in step.SetFlags) world.State.Flags.Add(f);
                world.NotifyStateChanged();
            }
            StepCompleted?.Invoke(active.Id, stepIndex, step);
            if (active != mission) return;  // a listener ended the mission

            string nextId;
            if (step.Next != null && !string.IsNullOrEmpty(step.Next.Step)) nextId = step.Next.Step;
            else if (step.Next != null && step.Next.IsBranching)
            {
                if (!step.Next.Branches.TryGetValue(outcome, out nextId) && !step.Next.Branches.TryGetValue(Default, out nextId))
                {
                    world.Warn($"Mission {active.Id} step {step.Id}: no branch for outcome '{outcome}'");
                    Finish(false, "no_branch");
                    return;
                }
            }
            else nextId = stepIndex + 1 < active.Steps.Count ? active.Steps[stepIndex + 1].Id : End;

            if (nextId == End || nextId == Success) { Finish(true, outcome); return; }
            if (nextId == Fail) { Finish(false, outcome); return; }
            int next = active.Steps.FindIndex(s => s.Id == nextId);
            if (next < 0)
            {
                world.Warn($"Mission {active.Id}: next step '{nextId}' not found");
                Finish(false, "bad_next");
                return;
            }
            EnterStep(next);
        }

        void Finish(bool success, string reason)
        {
            var mission = active;
            active = null;
            stepIndex = -1;
            stepParams = null;
            requiredEvent = null;
            deadlineGameHours = -1;
            SetMinimapAllowed(true);
            if (success)
            {
                world.State.CompletedMissions.Add(mission.Id);
                world.ApplyReward(mission.Reward);
                foreach (var u in mission.Unlocks) world.State.Unlocked.Add(u.ToString());
                world.NotifyStateChanged();
            }
            MissionEnded?.Invoke(mission.Id, success, reason);
        }

        // ------------------------------------------------------------------ params

        double ParamNumber(string key, double fallback) => TryParamNumber(key, out var v) ? v : fallback;

        bool TryParamNumber(string key, out double value)
        {
            value = 0;
            var t = stepParams?[key];
            if (t == null || (t.Type != JTokenType.Float && t.Type != JTokenType.Integer)) return false;
            value = (double)t;
            return true;
        }

        string ParamString(string key)
        {
            var t = stepParams?[key];
            return t != null && t.Type == JTokenType.String ? (string)t : null;
        }

        bool ParamBool(string key, bool fallback)
        {
            var t = stepParams?[key];
            return t != null && t.Type == JTokenType.Boolean ? (bool)t : fallback;
        }

        /// <summary>Typed access to the active step's params for gameplay code (minigames, UI, vehicles).</summary>
        public JToken GetActiveStepParam(string key) => IsActive ? stepParams?[key] : null;

        public bool GetActiveStepParamNumber(string key, out double value)
        {
            value = 0;
            return IsActive && TryParamNumber(key, out value);
        }

        public string GetActiveStepParamString(string key) => IsActive ? ParamString(key) : null;

        public JObject GetActiveStepParams() => IsActive ? stepParams : null;

        /// <summary>ENU position of the active step's target (HUD marker), null if none.</summary>
        public Double3? GetActiveStepTargetEnu()
        {
            var step = ActiveStep;
            if (step?.Target == null) return null;
            if (step.Target.Kind == HanoiTargetKind.Geo) return world.Geo.GeoToEnu(step.Target.Geo);
            if (step.Target.Kind == HanoiTargetKind.Ref) return world.ResolveEnu(step.Target.Ref);
            return null;
        }

        // ------------------------------------------------------------------ per frame

        bool IsAutoComplete()
        {
            var step = active.Steps[stepIndex];
            switch (step.Kind)
            {
                case HanoiMissionStepKind.GoTo:
                case HanoiMissionStepKind.Ride:
                case HanoiMissionStepKind.Deliver:
                case HanoiMissionStepKind.DrivePassenger:
                case HanoiMissionStepKind.Follow:
                {
                    var target = GetActiveStepTargetEnu();
                    var player = world.Player;
                    if (player == null || !player.HasPawn || !target.HasValue) return false;
                    double radius = ParamNumber("radius_m", world.Rules.MissionArriveRadiusM);
                    return Double3.PlanDistance(player.PositionEnu, target.Value) <= radius;
                }
                case HanoiMissionStepKind.WaitUntil:
                {
                    HanoiHourRange range;
                    if (stepParams?["hours"] is JArray h && h.Count == 2) range = new HanoiHourRange((double)h[0], (double)h[1]);
                    else
                    {
                        double from = ParamNumber("until_hour", ParamNumber("hour", 0));
                        range = new HanoiHourRange(from, (from + 1) % 24.0);
                    }
                    return range.Contains(world.Clock.HourOfDay);
                }
                case HanoiMissionStepKind.EscapeTrafficPolice:
                    return stepElapsed > 1.0 && world.Heat.Heat <= 0;
                default:
                    return false;
            }
        }

        bool ShouldFail(out string reason)
        {
            reason = null;
            double limit = ParamNumber("time_limit_s", 0);
            if (limit > 0 && stepElapsed > limit) { reason = "time_limit"; return true; }
            if (deadlineGameHours >= 0 && (world.Clock.Now - stepStartGameTime).TotalHours > deadlineGameHours) { reason = "deadline"; return true; }
            foreach (var rule in active.Steps[stepIndex].FailIf)
            {
                int colon = rule.IndexOf(':');
                if (colon > 0)
                {
                    string left = rule.Substring(0, colon), right = rule.Substring(colon + 1);
                    bool hit = (left == "event" && stepEvents.Contains(right)) || (left == "flag" && world.State.Flags.Contains(right));
                    if (hit) { reason = rule; return true; }
                    continue;
                }
                foreach (var op in Ops)
                {
                    int at = rule.IndexOf(op, StringComparison.Ordinal);
                    if (at < 0) continue;
                    string var = rule.Substring(0, at).Trim();
                    if (!double.TryParse(rule.Substring(at + op.Length).Trim(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var rhs)) break;
                    bool known = var == "time" || var == "heat";
                    double lhs = var == "time" ? stepElapsed : world.Heat.Heat;
                    bool hit = known && ((op == ">=" && lhs >= rhs) || (op == "<=" && lhs <= rhs) || (op == "==" && Math.Abs(lhs - rhs) < 1e-6)
                        || (op == ">" && lhs > rhs) || (op == "<" && lhs < rhs));
                    if (hit) { reason = rule; return true; }
                    break;
                }
            }
            return false;
        }

        public void Tick(double realSeconds)
        {
            if (!IsActive || ActiveStep == null) return;
            stepElapsed += realSeconds;
            if (ShouldFail(out var reason)) Finish(false, reason);
            else if (StepGateOpen && IsAutoComplete()) Advance(Success);
        }
    }
}
