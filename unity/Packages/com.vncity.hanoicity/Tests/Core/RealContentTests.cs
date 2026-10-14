using System;
using System.Collections.Generic;
using System.Linq;
using HanoiCity.Content;
using HanoiCity.Systems;
using HanoiCity.Weather;
using Newtonsoft.Json.Linq;
using NUnit.Framework;

namespace HanoiCity.Tests
{
    /// <summary>
    /// The real game content through the C# runtime: every mission runs to its end under an autopilot,
    /// every dialogue walks to an end, every random event resolves through every choice. A port bug or
    /// a content shape the Unity runtime cannot run fails here, before anyone opens Unity.
    /// </summary>
    public class RealContentTests
    {
        static IEnumerable<string> MissionIds() => TestPaths.RealContent.All<HanoiMissionRow>("missions").Select(m => m.Id);

        static void Satisfy(HanoiWorld w, HanoiCondition c)
        {
            if (c == null) return;
            foreach (var r in c.MissionsCompleted) w.State.CompletedMissions.Add(r.Id);
            foreach (var kv in c.MinReputation) w.State.Reputation[kv.Key] = kv.Value;
            foreach (var f in c.Flags) w.State.Flags.Add(f);
            foreach (var f in c.NotFlags) w.State.Flags.Remove(f);
            foreach (var e in c.EventsActive) w.SetWorldEventActive(e.Id, true);
            if (c.Protagonist.Count > 0) w.SetProtagonist(c.Protagonist[0].Id);
            foreach (var kv in c.MinSkills) w.Skills.Train(kv.Key, 100);
            if (c.Weather.Count > 0)
            {
                w.SetWeatherProvider(null);
                w.SetWeather(new HanoiWeatherState { Condition = c.Weather[0], Source = "manual" });
            }
            if (c.Hours != null) JumpToHour(w, c.Hours.From + 0.05);
        }

        static void JumpToHour(HanoiWorld w, double hour)
        {
            var now = w.Clock.Now;
            var at = now.Date.AddHours(hour % 24);
            if (at <= now) at = at.AddDays(1);
            w.Clock.Set(at);
        }

        /// <summary>Plays one mission like a cooperative player; returns (ended, success, reason, steps).</summary>
        static (bool ended, bool success, string reason, int steps) Autoplay(string missionId)
        {
            var w = Worlds.Real();
            var m = w.Content.Mission(missionId);
            if (m.Protagonists.Count > 0) w.SetProtagonist(m.Protagonists[0].Id);
            Satisfy(w, m.Requires);
            var first = m.Steps[0].Params as JObject;
            if (first?["requires_event"] != null) w.SetWorldEventActive((string)first["requires_event"], true);
            bool ended = false, success = false;
            string reason = null;
            w.Missions.MissionEnded += (id, ok, r) => { ended = true; success = ok; reason = r; };
            Assert.That(w.Missions.StartMission(missionId), $"{missionId} does not start: {(w.Missions.CanStartMission(missionId, out var why) ? "" : why)}");
            var player = (FakePlayer)w.Player;
            int steps = 0;
            while (!ended && steps < 400)
            {
                var step = w.Missions.ActiveStep;
                var p = step.Params as JObject;
                if (p?["requires_event"] != null) w.SetWorldEventActive((string)p["requires_event"], true);
                steps++;
                switch (step.Kind)
                {
                    case HanoiMissionStepKind.GoTo:
                    case HanoiMissionStepKind.Ride:
                    case HanoiMissionStepKind.Deliver:
                    case HanoiMissionStepKind.DrivePassenger:
                    case HanoiMissionStepKind.Follow:
                        var t = w.Missions.GetActiveStepTargetEnu();
                        if (t.HasValue) player.PositionEnu = t.Value;
                        else w.Missions.CompleteCurrentStep();
                        break;
                    case HanoiMissionStepKind.WaitUntil:
                        double hour = p?["hours"] is JArray h ? (double)h[0] : (double?)p?["until_hour"] ?? (double?)p?["hour"] ?? 0;
                        JumpToHour(w, hour + 0.01);
                        break;
                    case HanoiMissionStepKind.EscapeTrafficPolice:
                        w.Tick(1.1);
                        if (w.Missions.ActiveStep == step) w.Heat.PulledOver();
                        break;
                    default:
                        string outcome = MissionRunner.Success;
                        if (step.Next != null && step.Next.IsBranching)
                        {
                            var keys = step.Next.Branches.Where(kv => kv.Value != MissionRunner.Fail && kv.Key != MissionRunner.Default).Select(kv => kv.Key).ToList();
                            outcome = keys.Contains("dat") ? "dat" : keys.FirstOrDefault() ?? MissionRunner.Default;
                        }
                        if (step.Kind == HanoiMissionStepKind.Choice && (string)p?["branch_source"] == "flag") break;  // resolved on entry
                        w.Missions.CompleteCurrentStep(outcome);
                        break;
                }
                if (!ended) w.Tick(0.05);
            }
            return (ended, success, reason, steps);
        }

        [TestCaseSource(nameof(MissionIds))]
        public void EveryMissionCompletesUnderTheRuntime(string missionId)
        {
            var (ended, success, reason, steps) = Autoplay(missionId);
            Assert.That(ended, $"{missionId} did not end after {steps} steps");
            Assert.That(success, $"{missionId} failed: {reason}");
        }

        [Test]
        public void EveryDialogueWalksToAnEnd()
        {
            var w = Worlds.Real();
            var warnings = new List<string>();
            w.Log += warnings.Add;
            foreach (var d in w.Content.All<HanoiDialogueRow>("dialogues"))
            {
                var line = w.Dialogue.ResolveLine(d, null);
                Assert.That(line, Is.Not.Null, $"{d.Id} shows nothing");
                int n = 0;
                while (line != null && n++ < 300)
                {
                    var choices = w.Dialogue.AvailableChoices(line);
                    if (line.Choices.Count > 0)
                    {
                        Assert.That(choices, Is.Not.Empty, $"{d.Id}/{line.Id}: every choice hidden");
                        line = w.Dialogue.ApplyChoice(d, line, choices.Last());
                    }
                    else line = w.Dialogue.NextLine(d, line);
                }
                Assert.That(n, Is.LessThan(300), $"{d.Id} loops");
            }
            Assert.That(warnings, Is.Empty);
        }

        [Test]
        public void EveryRandomEventResolvesThroughEveryChoice()
        {
            foreach (var ev in TestPaths.RealContent.All<HanoiRandomEventsRow>("random_events"))
            {
                foreach (var c in ev.Choices.Select(x => x.Id).Concat(new string[] { null }))
                {
                    var w = Worlds.Real();
                    w.SetProtagonist("minh");
                    w.State.MoneyVnd = 10000000;
                    var resolved = false;
                    w.RandomEvents.Resolved += (e, choice, outcome) => resolved = true;
                    w.RandomEvents.Spawn(ev);
                    if (c == null) w.RandomEvents.Ignore();
                    else
                    {
                        Assert.That(w.RandomEvents.Choose(c));
                        if (w.RandomEvents.WaitingForMinigame) w.RandomEvents.CompleteMinigame(false);
                    }
                    Assert.That(resolved, $"{ev.Id}/{c}");
                    Assert.That(w.RandomEvents.Current, Is.Null);
                }
            }
        }

        [Test]
        public void EveryDistrictHasRandomEventsThatCanSpawnThere()
        {
            var db = TestPaths.RealContent;
            foreach (var d in db.All<HanoiDistrictRow>("districts"))
            {
                int possible = db.All<HanoiRandomEventsRow>("random_events").Count(e => e.Spawn.Districts.Count == 0 || e.Spawn.Districts.Any(x => x.Id == d.Id));
                Assert.That(possible, Is.GreaterThanOrEqualTo(15), d.Id);
                var w = Worlds.Real();
                ((FakePlayer)w.Player).PositionEnu = w.Geo.GeoToEnu(d.Center);
                Assert.That(w.PlayerDistrict, Is.EqualTo(d.Id), $"the center of {d.Id} locates to it");
            }
        }

        [Test]
        public void HourlyRollsSpawnEventsOverAGameWeek()
        {
            var w = Worlds.Real(seed: 42);
            w.SetProtagonist("minh");
            var center = w.Content.Get<HanoiDistrictRow>("districts", "pho_co").Center;
            ((FakePlayer)w.Player).PositionEnu = w.Geo.GeoToEnu(center);
            int spawned = 0;
            w.RandomEvents.Started += e => { spawned++; w.RandomEvents.Ignore(); };
            for (int h = 0; h < 24 * 7; ++h) w.Clock.Advance(TimeSpan.FromHours(1));
            Assert.That(spawned, Is.InRange(5, 24 * 7), "some, but not every hour");
        }
    }
}
