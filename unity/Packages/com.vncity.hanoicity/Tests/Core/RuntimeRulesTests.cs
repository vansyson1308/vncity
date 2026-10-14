using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using HanoiCity.City;
using HanoiCity.Content;
using HanoiCity.Geo;
using HanoiCity.Systems;
using Newtonsoft.Json.Linq;
using NUnit.Framework;

namespace HanoiCity.Tests
{
    /// <summary>
    /// The minigame modes and flood layers of chapters 3-5 (MinigameSystem, FloodSystem): the golden
    /// plays and water levels of tools/runtime_rules.py (tests/golden/runtime_rules.json) must come
    /// out the same here, and the systems must drive missions, traffic and the player as the story needs.
    /// </summary>
    public class RuntimeRulesTests
    {
        static JObject golden;
        static JObject Golden => golden ??= JObject.Parse(File.ReadAllText(Path.Combine(TestPaths.Root, "tests", "golden", "runtime_rules.json")));

        // ------------------------------------------------------------------ golden parity

        [Test]
        public void GoldenMinigamePlaysScoreTheSame()
        {
            var content = TestPaths.RealContent;
            var plays = (JArray)Golden["minigames"];
            Assert.That(plays.Count, Is.GreaterThan(20));
            foreach (JObject play in plays)
            {
                var name = (string)play["name"];
                var mode = content.Get<HanoiMinigameModeRow>("minigame_modes", (string)play["mode"]);
                var p = (JObject)play["params"];
                var s = new MinigameSession(mode, (int)p["difficulty"], (double)p["pass_score"], (int)p["max_faults"], (double)p["time_limit_s"]);
                double elapsed = 0;
                foreach (JArray a in play["actions"])
                {
                    switch ((string)a[0])
                    {
                        case "answer": s.Answer((string)a[1], (string)a[2]); break;
                        case "perform": s.Perform((string)a[1]); break;
                        case "tick": elapsed += (double)a[1]; s.SetElapsed(elapsed); break;
                    }
                }
                var r = (JObject)play["result"];
                Assert.That(s.Score, Is.EqualTo((int)r["score"]), name + " score");
                Assert.That(s.Faults, Is.EqualTo((int)r["faults"]), name + " faults");
                Assert.That(s.Complete, Is.EqualTo((bool)r["complete"]), name + " complete");
                Assert.That(s.CriticalFailed, Is.EqualTo((bool)r["critical_failed"]), name + " critical");
                Assert.That(s.TimedOut, Is.EqualTo((bool)r["timed_out"]), name + " timed out");
                Assert.That(s.Outcome, Is.EqualTo((string)r["outcome"]), name + " outcome");
            }
        }

        [Test]
        public void GoldenLedgerOwesTheSame()
        {
            foreach (var kv in (JObject)Golden["ledgers"])
            {
                var mode = TestPaths.RealContent.Get<HanoiMinigameModeRow>("minigame_modes", kv.Key);
                Assert.That(MinigameSystem.LedgerOwed(mode), Is.EqualTo((long)kv.Value), kv.Key);
                Assert.That(Math.Abs(MinigameSystem.LedgerOwed(mode).Value - mode.Ledger.ExpectedOwedVnd), Is.LessThanOrEqualTo(mode.Ledger.ToleranceVnd ?? 0));
            }
        }

        [Test]
        public void GoldenFloodWaterIsTheSame()
        {
            foreach (var kv in (JObject)Golden["floods"])
            {
                var model = new FloodModel(TestPaths.RealContent.Get<HanoiFloodLayerRow>("flood_layers", kv.Key));
                foreach (JObject sample in (JArray)kv.Value)
                {
                    double t = (double)sample["t_h"];
                    Assert.That(model.RiverAt(t), Is.EqualTo((double)sample["river_m"]).Within(1e-8), $"{kv.Key} river at {t}");
                    Assert.That(model.RainAt(t), Is.EqualTo((double)sample["rain_mm_h"]).Within(1e-12), $"{kv.Key} rain at {t}");
                    foreach (var d in (JObject)sample["depth_m"])
                        Assert.That(model.ZoneDepth(model.Zone(d.Key), t), Is.EqualTo((double)d.Value).Within(1e-8), $"{kv.Key} {d.Key} at {t}");
                    var closures = model.Layer.Closures.Where(c => model.ClosureActive(c, t)).Select(c => c.Id).ToList();
                    Assert.That(closures, Is.EqualTo(((JArray)sample["closures"]).Select(x => (string)x).ToList()), $"{kv.Key} closures at {t}");
                    Assert.That(model.WorldEventsOn(t), Is.EqualTo((bool)sample["world_events_on"]), $"{kv.Key} world events at {t}");
                }
            }
        }

        // ------------------------------------------------------------------ systems in a world

        const string Characters = @"{'collection': 'characters', 'items': [
            {'id': 'minh', 'name': {'vi': 'Minh'}, 'role': 'protagonist', 'bio': {'vi': '.'}},
            {'id': 'khoi', 'name': {'vi': 'Khôi'}, 'role': 'protagonist', 'bio': {'vi': '.'}}]}";
        const string Missions = @"{'collection': 'missions', 'items': [
          {'id': 'm_phim', 'name': {'vi': 'P'}, 'type': 'side', 'giver': 'characters:khoi', 'steps': [
            {'id': 'rua', 'kind': 'minigame', 'objective': {'vi': 'Rửa'},
             'params': {'mode': 'cuu_phim_uot', 'difficulty': 4, 'pass_score': 85, 'time_limit_s': 300, 'max_faults': 2},
             'next': {'dat': 'cung', 'chua_dat': 'hong', 'default': 'hong'}},
            {'id': 'cung', 'kind': 'talk', 'objective': {'vi': 'Cứu được'}, 'next': 'end'},
            {'id': 'hong', 'kind': 'talk', 'objective': {'vi': 'Hỏng'}, 'set_flags': ['phim_hong_test']}]},
          {'id': 'm_luat', 'name': {'vi': 'L'}, 'type': 'side', 'giver': 'characters:minh', 'steps': [
            {'id': 'giao', 'kind': 'deliver', 'objective': {'vi': 'Giao'}, 'target': {'lat': 21.05, 'lon': 105.85}, 'params': {'time_limit_s': 60}}]},
          {'id': 'm_lu', 'name': {'vi': 'Lũ'}, 'type': 'side', 'giver': 'characters:minh', 'steps': [
            {'id': 'mo', 'kind': 'cutscene', 'objective': {'vi': 'Bão'}, 'params': {'flood_layer': 'bao_so_3_2027'}},
            {'id': 'cho', 'kind': 'talk', 'objective': {'vi': 'Chờ'}}]}]}";

        static HanoiWorld FixtureWorld(DateTime start)
        {
            var db = new HanoiContentDatabase();
            foreach (var f in new[] { "minigame_modes.json", "flood_layers.json", "traffic_rules.json", Path.Combine("world", "landmarks.json") })
                db.LoadDocument(File.ReadAllText(Path.Combine(TestPaths.Content, f)), f);
            db.LoadDocument(Characters.Replace('\'', '"'), "characters");
            db.LoadDocument(Missions.Replace('\'', '"'), "missions");
            var w = new HanoiWorld(db, new HanoiRules(), start, 11);
            w.Player = new FakePlayer { HasPawn = true, OnVehicle = true, PositionEnu = new Double3(0, 0, 0) };
            return w;
        }

        static readonly DateTime Evening = new DateTime(2027, 7, 21, 18, 0, 0);

        static IEnumerable<string> PerfectProcedure(HanoiMinigameModeRow mode, int difficulty) =>
            mode.Tasks.Where(t => (t.MinDifficulty ?? 0) <= difficulty && t.Forbidden != true).OrderBy(t => t.Order ?? 0).ThenBy(t => t.Id, StringComparer.Ordinal).Select(t => t.Id);

        [Test]
        public void WinningTheMinigameTakesTheDatBranch()
        {
            var w = FixtureWorld(Evening);
            Assert.That(w.Missions.StartMission("m_phim"));
            Assert.That(w.Minigames.IsRunning);
            Assert.That(w.Minigames.Current.Tasks.Count(t => t.MinDifficulty == 4), Is.GreaterThan(0), "difficulty 4 adds the hard steps");
            foreach (var id in PerfectProcedure(w.Minigames.Current.Mode, 4)) Assert.That(w.Minigames.Perform(id), id);
            Assert.That(w.Minigames.IsRunning, Is.False);
            Assert.That(w.Missions.ActiveStep.Id, Is.EqualTo("cung"));
        }

        [Test]
        public void ACriticalMistakeEndsTheMinigameOnTheChuaDatBranch()
        {
            var w = FixtureWorld(Evening);
            w.Missions.StartMission("m_phim");
            var mode = w.Minigames.Current.Mode;
            bool? passed = null;
            w.Minigames.Ended += (ok, s) => passed = ok;
            w.Minigames.Perform(PerfectProcedure(mode, 4).First());
            var critical = mode.Tasks.First(t => t.Forbidden == true && t.Critical == true && (t.MinDifficulty ?? 0) <= 4);
            Assert.That(w.Minigames.Perform(critical.Id), Is.False);
            Assert.That(passed, Is.False);
            Assert.That(w.Missions.ActiveStep.Id, Is.EqualTo("hong"));
            Assert.That(w.State.Flags, Does.Not.Contain("phim_hong_test"), "set_flags of the branch step come when it completes");
        }

        [Test]
        public void RunningOutOfTimeIsALossNotAGameOver()
        {
            var w = FixtureWorld(Evening);
            bool ended = false;
            w.Missions.MissionEnded += (m, ok, r) => ended = true;
            w.Missions.StartMission("m_phim");
            w.Tick(200);
            Assert.That(w.Missions.ActiveStep.Id, Is.EqualTo("rua"));
            w.Tick(101);
            Assert.That(ended, Is.False);
            Assert.That(w.Missions.ActiveStep.Id, Is.EqualTo("hong"));
            Assert.That(w.Minigames.IsRunning, Is.False);
        }

        [Test]
        public void ATimeLimitWithoutAChuaDatBranchStillFailsTheMission()
        {
            var w = FixtureWorld(Evening);
            string reason = null;
            w.Missions.MissionEnded += (m, ok, r) => reason = r;
            w.Missions.StartMission("m_luat");
            w.Tick(61);
            Assert.That(reason, Is.EqualTo("time_limit"));
        }

        static Double3 ZoneEnu(HanoiWorld w, string zone) => w.Geo.GeoToEnu(w.Content.Get<HanoiFloodLayerRow>("flood_layers", "bao_so_3_2027").Zones.First(z => z.Id == zone).Location);

        [Test]
        public void TheStormNightFloodsBaiGiuaBeforeTheBridgeCloses()
        {
            var w = FixtureWorld(Evening);
            var player = (FakePlayer)w.Player;
            player.PositionEnu = ZoneEnu(w, "bai_giua_phuc_xa");
            var stalls = new List<string>();
            w.Floods.VehicleStalled += (zone, depth) => stalls.Add(zone);
            int violations = 0;
            w.Heat.Violation += (rule, noticed, fine) => violations++;

            Assert.That(w.Missions.StartMission("m_lu"));
            Assert.That(w.Floods.ActiveLayer, Is.EqualTo("bao_so_3_2027"));
            w.Tick(0.01);
            w.Clock.Advance(TimeSpan.FromHours(1));   // 19:00, Minh reaches ông Bảy
            w.Tick(0.01);
            Assert.That(w.Floods.IsPassableAt(player.PositionEnu, FloodSystem.Motorbike), "19:00: the bike still gets through");
            Assert.That(w.IsWorldEventActive("mua_ngap"), Is.False);
            Assert.That(stalls, Is.Empty);

            w.Clock.Advance(TimeSpan.FromMinutes(30));
            w.Tick(0.01);
            Assert.That(w.IsWorldEventActive("mua_ngap"), "19:30: the streets flood");

            w.Clock.Advance(TimeSpan.FromMinutes(30));   // 20:00
            w.Tick(0.01);
            Assert.That(stalls, Is.EqualTo(new[] { "bai_giua_phuc_xa" }), "20:00: the bike stalls in bãi giữa");
            Assert.That(w.Floods.ClosureActive("cam_cau_long_bien"));
            Assert.That(violations, Is.EqualTo(0), "being in bãi giữa when the bridge closes is not a violation");
            w.Tick(0.01);
            Assert.That(stalls.Count, Is.EqualTo(1), "one stall per zone");

            player.PositionEnu = ZoneEnu(w, "ngo_hang_chieu");
            w.Tick(0.01);
            var bridge = w.ResolveEnu(HanoiRef.Parse("landmarks:cau_long_bien")).Value;
            player.PositionEnu = bridge;
            w.Tick(0.01);
            Assert.That(violations, Is.EqualTo(1), "riding onto the closed bridge is fined");
            Assert.That(w.State.UnpaidFinesVnd, Is.GreaterThan(0));

            w.Clock.Advance(TimeSpan.FromHours(16.6));
            w.Tick(0.01);
            Assert.That(w.Floods.IsActive, Is.False, "the layer ends after duration_h");
            Assert.That(w.State.ActiveFloodLayer, Is.Null);
            Assert.That(w.IsWorldEventActive("mua_ngap"), Is.False);
        }

        [Test]
        public void FloodedStreetsAreRoutedAround()
        {
            var w = FixtureWorld(Evening);
            var c = ZoneEnu(w, "ngo_hang_chieu");
            string N(int id, double x, double y) => $"{{\"id\": {id}, \"x\": {x.ToString(System.Globalization.CultureInfo.InvariantCulture)}, \"y\": {y.ToString(System.Globalization.CultureInfo.InvariantCulture)}}}";
            string E(int id, int a, int b, double len) => $"{{\"id\": {id}, \"from\": {a}, \"to\": {b}, \"length_m\": {len}}}";
            var json = "{\"nodes\": [" + string.Join(",", N(1, c.X - 60, c.Y), N(2, c.X, c.Y), N(3, c.X + 60, c.Y), N(4, c.X, c.Y + 400)) + "], \"edges\": ["
                + string.Join(",", E(10, 1, 2, 60), E(11, 2, 3, 60), E(12, 1, 4, 410), E(13, 4, 3, 410)) + "]}";
            var g = HanoiTrafficGraph.Parse(json);
            w.TrafficGraphs.Add(g);
            w.Floods.Start("bao_so_3_2027");
            w.Tick(0.01);
            Assert.That(g.FindPath(1, 3), Is.EqualTo(new[] { 1, 2, 3 }), "18:00: dry");
            w.Clock.Advance(TimeSpan.FromHours(6));   // midnight, Hàng Chiếu at its deepest
            w.Tick(0.01);
            Assert.That(g.IsEdgeBlocked(0));
            Assert.That(g.FindPath(1, 3), Is.EqualTo(new[] { 1, 4, 3 }), "midnight: around the flooded lane");
            Assert.That(w.Floods.ZoneDepthM("ngo_hang_chieu"), Is.GreaterThan(0.4));
            w.Floods.Stop();
            Assert.That(g.IsEdgeBlocked(0), Is.False);
        }

        [Test]
        public void AFloodLayerSurvivesSaveAndLoad()
        {
            var w = FixtureWorld(Evening);
            w.Floods.Start("bao_so_3_2027");
            w.Clock.Advance(TimeSpan.FromHours(3));
            w.Tick(0.01);
            double depth = w.Floods.ZoneDepthM("thai_ha");
            var save = w.SaveToJson();
            var w2 = FixtureWorld(Evening.AddDays(-3));
            w2.LoadFromJson(save);
            Assert.That(w2.Floods.ActiveLayer, Is.EqualTo("bao_so_3_2027"));
            Assert.That(w2.Floods.ZoneDepthM("thai_ha"), Is.EqualTo(depth).Within(1e-9));
            Assert.That(w2.IsWorldEventActive("mua_ngap"));
        }
    }
}
