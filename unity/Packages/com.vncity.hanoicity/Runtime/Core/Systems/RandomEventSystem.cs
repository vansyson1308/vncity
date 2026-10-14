using System;
using System.Collections.Generic;
using System.Linq;
using HanoiCity.Content;
using HanoiCity.Geo;

namespace HanoiCity.Systems
{
    /// <summary>
    /// Random street events between missions (random_events.json, docs/gdd/02 §7.1); UE has only the
    /// design for this (UHanoiRandomEventSubsystem "chưa viết"). Every game hour, events whose spawn
    /// filters match (district, within RandomEventLandmarkRadiusM of a landmark, road type, hours,
    /// weather, calendar events, protagonist, riding or on foot) and whose requires hold roll
    /// chance_per_game_hour; cooldown_days and max_per_playthrough stop repeats. One event at a time,
    /// none during a mission. The player rides past (ignore_effect after duration_s real seconds, or
    /// Ignore()), or picks a choice; a choice with a minigame waits for CompleteMinigame(passed) and
    /// applies effect or fail_effect. Effects: money (may be negative), reputation, heat, a traffic
    /// rule's fine, items, skills trained, game minutes spent.
    /// </summary>
    public sealed class RandomEventSystem
    {
        readonly HanoiWorld world;
        HanoiRandomEventsChoice pendingMinigame;
        double remaining;

        public HanoiRandomEventsRow Current { get; private set; }
        public bool WaitingForMinigame => pendingMinigame != null;

        public event Action<HanoiRandomEventsRow> Started;
        /// <summary>(event, choice, activity to play)</summary>
        public event Action<HanoiRandomEventsRow, HanoiRandomEventsChoice, HanoiRef> MinigameRequested;
        /// <summary>(event, choice id or null when ignored, outcome text or null)</summary>
        public event Action<HanoiRandomEventsRow, string, HanoiText> Resolved;

        public RandomEventSystem(HanoiWorld world) { this.world = world; }

        internal void Clear()
        {
            Current = null;
            pendingMinigame = null;
        }

        // ------------------------------------------------------------------ spawning

        public void OnGameHour()
        {
            if (Current != null) return;
            if (world.Missions.IsActive && !world.Rules.RandomEventsDuringMissions) return;
            if (world.Player == null || !world.Player.HasPawn) return;
            var events = world.Content.All<HanoiRandomEventsRow>("random_events").ToList();
            // Shuffle so content order does not favour the first rows.
            for (int i = events.Count - 1; i > 0; --i)
            {
                int j = (int)(world.Random.NextDouble() * (i + 1));
                (events[i], events[j]) = (events[j], events[i]);
            }
            foreach (var ev in events)
            {
                if (!CanSpawn(ev, out _)) continue;
                if (world.Random.NextDouble() < (ev.Spawn.ChancePerGameHour)) { Spawn(ev); return; }
            }
        }

        /// <summary>Every filter of spawn + requires + cooldown, without the dice. reason says which failed.</summary>
        public bool CanSpawn(HanoiRandomEventsRow ev, out string reason)
        {
            var s = ev.Spawn;
            var st = world.State;
            var player = world.Player;
            reason = null;
            if (s.MaxPerPlaythrough.HasValue && st.RandomEventCounts.TryGetValue(ev.Id, out var n) && n >= s.MaxPerPlaythrough.Value) { reason = "max_per_playthrough"; return false; }
            if (st.RandomEventLast.TryGetValue(ev.Id, out var last) && (world.Clock.Now - last).TotalDays < (s.CooldownDays ?? 0)) { reason = "cooldown"; return false; }
            if (s.Hours != null && !s.Hours.Contains(world.Clock.HourOfDay)) { reason = "hours"; return false; }
            if (s.Weather.Count > 0 && !s.Weather.Contains(world.Weather.Condition)) { reason = "weather"; return false; }
            if (s.EventsActive.Any(e => !world.IsWorldEventActive(e.Id))) { reason = "events_active"; return false; }
            if (s.Protagonist.Count > 0 && !s.Protagonist.Any(p => p.Id == st.Protagonist)) { reason = "protagonist"; return false; }
            if (s.OnVehicle.HasValue && (player == null || player.OnVehicle != s.OnVehicle.Value)) { reason = "on_vehicle"; return false; }
            if (s.RoadTypes.Count > 0)
            {
                var road = player?.RoadType;
                if (road == null || !s.RoadTypes.Any(r => EnumValue(r) == road)) { reason = "road_types"; return false; }
            }
            if (s.Districts.Count > 0)
            {
                var d = world.PlayerDistrict;
                if (d == null || !s.Districts.Any(r => r.Id == d)) { reason = "districts"; return false; }
            }
            if (s.Landmarks.Count > 0)
            {
                if (player == null || !player.HasPawn) { reason = "landmarks"; return false; }
                bool near = s.Landmarks.Any(l =>
                {
                    var p = world.ResolveEnu(l);
                    return p.HasValue && Double3.PlanDistance(player.PositionEnu, p.Value) <= world.Rules.RandomEventLandmarkRadiusM;
                });
                if (!near) { reason = "landmarks"; return false; }
            }
            if (!world.EvaluateCondition(ev.Requires)) { reason = "requires"; return false; }
            return true;
        }

        /// <summary>Starts an event now, skipping the dice (debug menu, tests, scripted moments).</summary>
        public void Spawn(HanoiRandomEventsRow ev)
        {
            Current = ev;
            pendingMinigame = null;
            remaining = ev.DurationS ?? world.Rules.RandomEventDefaultDurationS;
            world.State.RandomEventCounts.TryGetValue(ev.Id, out var n);
            world.State.RandomEventCounts[ev.Id] = n + 1;
            world.State.RandomEventLast[ev.Id] = world.Clock.Now;
            Started?.Invoke(ev);
        }

        public bool Spawn(string id)
        {
            var ev = world.Content.Get<HanoiRandomEventsRow>("random_events", id);
            if (ev == null) return false;
            Spawn(ev);
            return true;
        }

        public void Tick(double realSeconds)
        {
            if (Current == null || pendingMinigame != null) return;
            remaining -= realSeconds;
            if (remaining <= 0) Ignore();
        }

        // ------------------------------------------------------------------ resolving

        /// <summary>The player rode past (or the event timed out): ignore_effect.</summary>
        public void Ignore()
        {
            var ev = Current;
            if (ev == null) return;
            Current = null;
            pendingMinigame = null;
            var e = ev.IgnoreEffect;
            Apply(e.MoneyVnd, e.Reputation, e.Heat, e.Fine, e.Items, e.Skills, e.TimeMin);
            Resolved?.Invoke(ev, null, null);
        }

        /// <summary>Pick a choice. Returns false if there is no such choice. A minigame choice waits for CompleteMinigame.</summary>
        public bool Choose(string choiceId)
        {
            var ev = Current;
            var c = ev?.Choices.FirstOrDefault(x => x.Id == choiceId);
            if (c == null) return false;
            if (c.Minigame != null)
            {
                pendingMinigame = c;
                MinigameRequested?.Invoke(ev, c, c.Minigame);
                return true;
            }
            Current = null;
            var e = c.Effect;
            Apply(e.MoneyVnd, e.Reputation, e.Heat, e.Fine, e.Items, e.Skills, e.TimeMin);
            Resolved?.Invoke(ev, c.Id, c.Outcome);
            return true;
        }

        /// <summary>The minigame of the pending choice ended: dat = effect, chua_dat = fail_effect.</summary>
        public void CompleteMinigame(bool passed)
        {
            var ev = Current;
            var c = pendingMinigame;
            if (ev == null || c == null) return;
            Current = null;
            pendingMinigame = null;
            world.Skills.TrainFromActivity(c.Minigame.Id);
            if (passed)
            {
                var e = c.Effect;
                Apply(e.MoneyVnd, e.Reputation, e.Heat, e.Fine, e.Items, e.Skills, e.TimeMin);
            }
            else
            {
                var e = c.FailEffect;
                Apply(e.MoneyVnd, e.Reputation, e.Heat, e.Fine, e.Items, e.Skills, e.TimeMin);
            }
            Resolved?.Invoke(ev, c.Id, passed ? c.Outcome : null);
        }

        void Apply(int? money, Dictionary<string, int> reputation, double? heat, HanoiRef fine, List<HanoiRef> items, List<string> skills, int? timeMin)
        {
            if (money.HasValue && money.Value != 0) world.AddMoney(money.Value);
            foreach (var kv in reputation) world.AddReputation(kv.Key, kv.Value, notify: false);
            if (heat.HasValue && heat.Value > 0) world.Heat.AddHeat(heat.Value);
            if (fine != null) world.Heat.ApplyRuleFine(fine.Id, world.Player != null && world.Player.InCar);
            foreach (var i in items) world.AddItem(i.Id, 1, notify: false);
            foreach (var s in skills) world.Skills.Train(s);
            if (timeMin.HasValue && timeMin.Value > 0) world.Clock.Advance(TimeSpan.FromMinutes(timeMin.Value));
            world.NotifyStateChanged();
        }

        static string EnumValue(HanoiRandomEventsSpawnRoadTypes v) =>
            Newtonsoft.Json.Linq.JToken.FromObject(v).ToString();
    }
}
