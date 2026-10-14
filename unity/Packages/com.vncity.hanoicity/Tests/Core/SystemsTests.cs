using System;
using System.IO;
using System.Linq;
using HanoiCity.City;
using HanoiCity.Content;
using HanoiCity.Geo;
using NUnit.Framework;

namespace HanoiCity.Tests
{
    public class SystemsTests
    {
        [Test]
        public void SkillsSeedFromTheCharacterAndUnlockTiers()
        {
            var w = Worlds.Real();
            w.SetProtagonist("minh");
            var start = w.Content.Character("minh").Skills;
            Assert.That(w.Skills.Level("lai_xe"), Is.EqualTo(start["lai_xe"]));
            var skill = w.Content.Get<HanoiSkillsRow>("skills", "lai_xe");
            var next = w.Skills.NextTier("lai_xe");
            Assert.That(next, Is.Not.Null);
            int reached = -1;
            w.Skills.TierReached += (c, s, level, tier) => reached = level;
            w.Skills.Train("lai_xe", next.Level - w.Skills.Level("lai_xe"));
            Assert.That(reached, Is.EqualTo(next.Level));
            foreach (var r in next.Refs) Assert.That(w.State.Unlocked, Does.Contain(r.ToString()));
            var gate = new HanoiCondition();
            gate.MinSkills["lai_xe"] = next.Level;
            Assert.That(w.EvaluateCondition(gate));
            w.SetProtagonist("lan");
            Assert.That(w.EvaluateCondition(gate), Is.EqualTo(w.Skills.Level("lai_xe") >= next.Level), "min_skills reads the current protagonist");
            Assert.That(skill.Tiers.Count, Is.EqualTo(3));
        }

        [Test]
        public void PhotosNeedTheRightLightAndAGoodMatch()
        {
            var w = Worlds.Real();
            var photo = w.Content.All<HanoiCollectiblesRow>("collectibles").First(c => c.Set == HanoiCollectiblesSet.AnhXua && c.Hours != null && c.UnlocksTape.HasValue);
            var act = w.Content.Get<HanoiActivityRow>(photo.Activity);
            // Unlock the activity the way content does.
            foreach (var f in act.Unlock.Flags) w.State.Flags.Add(f);
            foreach (var m in act.Unlock.MissionsCompleted) w.State.CompletedMissions.Add(m.Id);
            foreach (var kv in act.Unlock.MinSkills) { w.SetProtagonist("khoi"); w.Skills.Train(kv.Key, 100); }
            if (act.Unlock.Protagonist.Count > 0) w.SetProtagonist(act.Unlock.Protagonist[0].Id);
            ((FakePlayer)w.Player).PositionEnu = w.Collectibles.SpotEnu(photo);
            var outside = photo.Hours.From >= 1 ? photo.Hours.From - 1 : (photo.Hours.To + 1) % 24;
            w.Clock.Set(w.Clock.Now.Date.AddDays(1).AddHours(outside));
            Assert.That(w.Collectibles.CanCollect(photo.Id, out var why), Is.False);
            Assert.That(why, Does.Contain("light"));
            w.Clock.Set(w.Clock.Now.Date.AddDays(1).AddHours(photo.Hours.From + 0.1));
            Assert.That(w.Collectibles.Collect(photo.Id, 0.6), Is.False, "a poor match does not count");
            int tape = 0;
            w.Collectibles.TapeUnlocked += t => tape = t;
            Assert.That(w.Collectibles.Collect(photo.Id, 0.9));
            Assert.That(tape, Is.EqualTo(photo.UnlocksTape.Value));
        }

        [Test]
        public void TapesByCountAndByStory()
        {
            var w = Worlds.Real();
            var photos = w.Content.All<HanoiCollectiblesRow>("collectibles").Where(c => c.Set == HanoiCollectiblesSet.AnhXua).Select(c => c.Id).ToList();
            foreach (var id in photos.Take(60)) w.State.Collected.Add(id);
            w.Collectibles.CheckTapes();
            Assert.That(w.State.Tapes, Does.Contain(22));
            Assert.That(w.State.Tapes, Does.Not.Contain(23));
            Assert.That(w.State.Tapes, Does.Not.Contain(24), "no chapter 3 yet");
            w.SetFlag("khoi_nghe_thang_ke_het", true);
            w.Collectibles.CheckTapes();
            Assert.That(w.State.Tapes, Does.Contain(24), "ông Thắng tells it");
            Assert.That(w.Collectibles.Total(HanoiCollectiblesSet.AnhXua), Is.EqualTo(120));
        }

        [Test]
        public void CouponsAreHiddenNearTheirCoordinateStably()
        {
            var w = Worlds.Real();
            foreach (var c in w.Content.All<HanoiCollectiblesRow>("collectibles").Where(c => c.Set == HanoiCollectiblesSet.TemPhieu))
            {
                var at = w.Geo.GeoToEnu(c.Location);
                double d = Double3.PlanDistance(at, w.Collectibles.SpotEnu(c));
                Assert.That(d, Is.InRange(0.3 * w.Rules.CouponHideRadiusM, w.Rules.CouponHideRadiusM + 1e-9), c.Id);
                Assert.That(w.Collectibles.SpotEnu(c).X, Is.EqualTo(w.Collectibles.SpotEnu(c).X));
            }
        }

        [Test]
        public void BusinessesJobsAndBills()
        {
            var w = Worlds.Real();
            var b = w.Content.All<HanoiBusinessRow>("businesses").First(x => x.Unlock.Flags.Count == 0 && x.Unlock.MissionsCompleted.Count == 0
                && x.Unlock.MinSkills.Count == 0 && x.Unlock.MinReputation.Count == 0 && (x.IncomePerDayVnd ?? 0) > (x.UpkeepPerDayVnd ?? 0));
            w.State.MoneyVnd = b.PriceVnd + 100;
            Assert.That(w.Economy.Buy(b.Id), Is.True);
            Assert.That(w.State.MoneyVnd, Is.EqualTo(100));
            long expected = (b.IncomePerDayVnd ?? 0) - (b.UpkeepPerDayVnd ?? 0);
            w.SetWeatherProvider(null);
            w.SetWeather(new Weather.HanoiWeatherState { Condition = HanoiWeather.Clear });
            Assert.That(w.Economy.DailyProfit(b.Id), Is.EqualTo(expected));
            w.Clock.Advance(TimeSpan.FromDays(1));
            Assert.That(w.State.MoneyVnd, Is.EqualTo(100 + expected));

            var job = w.Content.All<HanoiActivityRow>("activities").First(a => (a.Pay.WeeklyBonusVnd ?? 0) > 0);
            long pay = w.Economy.CompleteJob(job.Id, 5.0, 5.0, 999999999);
            Assert.That(pay, Is.EqualTo((job.Pay.BaseVnd ?? 0) + 5 * (job.Pay.PerKmVnd ?? 0) + (job.Pay.TipMaxVnd ?? 0)), "tip is capped");

            var bills = 0L;
            w.Economy.BillCharged += (bill, paid, shortfall) => bills += paid + shortfall;
            w.Clock.Advance(TimeSpan.FromDays(31));
            Assert.That(bills, Is.EqualTo(w.Rules.MonthlyBills.Sum(x => x.AmountVnd)));
        }

        [Test]
        public void TetClosesBusinesses()
        {
            var w = Worlds.Real(new DateTime(2026, 2, 17, 9, 0, 0));
            Assert.That(w.IsWorldEventActive("tet_nguyen_dan"));
            var b = w.Content.All<HanoiBusinessRow>("businesses").First();
            w.State.Businesses[b.Id] = new State.OwnedBusiness();
            Assert.That(w.Economy.DailyProfit(b.Id), Is.EqualTo(-(b.UpkeepPerDayVnd ?? 0)));
        }

        [Test]
        public void TilePlacementRecoversEveryImporterHypothesis()
        {
            // Three tiles at different offsets with rectangular content (as around the origin, near-square tiles are ambiguous alone).
            var tiles = new[] { (ox: 0.0, oy: 0.0, box: new PlanBox(30, 470, 60, 420)), (ox: 500.0, oy: -500.0, box: new PlanBox(520, 990, -480, -110)), (ox: -1000.0, oy: 500.0, box: new PlanBox(-990, -560, 505, 990)) };
            foreach (var truth in HanoiTilePlacement.Candidates())
            {
                var samples = tiles.Select(t => new HanoiTilePlacement.Sample
                {
                    MeasuredLocal = HanoiTilePlacement.ExpectedLocalBox(truth, t.box, t.ox, t.oy),
                    TileOriginEast = t.ox, TileOriginNorth = t.oy, ExpectedEnu = t.box,
                }).ToList();
                var sol = HanoiTilePlacement.Solve(samples);
                Assert.That(sol.Mapping, Is.EqualTo(truth), truth.ToString());
                foreach (var t in tiles)
                {
                    var place = HanoiTilePlacement.Place(sol.Mapping, t.ox, t.oy);
                    var local = HanoiTilePlacement.ExpectedLocalBox(truth, t.box, t.ox, t.oy);
                    var a = HanoiTilePlacement.Apply(place, local.X0, local.Y0);
                    var b = HanoiTilePlacement.Apply(place, local.X1, local.Y1);
                    Assert.That(Math.Min(a.east, b.east), Is.EqualTo(t.box.X0).Within(1e-6));
                    Assert.That(Math.Max(a.east, b.east), Is.EqualTo(t.box.X1).Within(1e-6));
                    Assert.That(Math.Min(a.north, b.north), Is.EqualTo(t.box.Y0).Within(1e-6));
                    Assert.That(Math.Max(a.north, b.north), Is.EqualTo(t.box.Y1).Within(1e-6));
                }
            }
            var glTFast = HanoiTilePlacement.Place(HanoiTilePlacement.Candidates().First(), 0, 0);
            Assert.That((glTFast.YawDeg, glTFast.ScaleZ), Is.EqualTo((180.0, 1.0)), "glTFast's X mirror is a 180 degree turn");
        }

        [Test]
        public void TrafficGraphRoutesAndRespectsOneWay()
        {
            var g = HanoiTrafficGraph.Parse(@"{""nodes"": [
                {""id"": 0, ""x"": 0, ""y"": 0}, {""id"": 1, ""x"": 100, ""y"": 0}, {""id"": 2, ""x"": 100, ""y"": 100}, {""id"": 3, ""x"": 0, ""y"": 100, ""signal"": true}],
              ""edges"": [
                {""id"": 0, ""from"": 0, ""to"": 1, ""length_m"": 100, ""oneway"": true, ""polyline"": [[0,0],[100,0]]},
                {""id"": 1, ""from"": 1, ""to"": 2, ""length_m"": 100},
                {""id"": 2, ""from"": 0, ""to"": 3, ""length_m"": 100, ""motorbike_only"": true},
                {""id"": 3, ""from"": 3, ""to"": 2, ""length_m"": 150}]}");
            Assert.That(g.FindPath(0, 2), Is.EqualTo(new[] { 0, 1, 2 }));
            Assert.That(g.FindPath(2, 0), Is.EqualTo(new[] { 2, 3, 0 }), "edge 0 is one-way");
            Assert.That(g.FindPath(2, 0, motorbike: false), Is.Empty, "cars may not use the motorbike-only lane");
            Assert.That(g.Nearest(new Double3(90, 10, 0)).Id, Is.EqualTo(1));
        }

        [Test]
        public void PcgCsvKeepsBigSeedsAndNegativeTiles()
        {
            var csv = "Name,X,Y,Z,Yaw,Scale,Set,Kind,Variant,Seed,Tile,Ref\n" +
                      "shop_signs_0,-512.25,1033.5,3.2,271,1.025,shop_signs,vertical,2,4294967295,-1_2,\"place,1\"\n";
            var pts = HanoiPcgCsv.Read(new StringReader(csv));
            Assert.That(pts.Count, Is.EqualTo(1));
            Assert.That(pts[0].Seed, Is.EqualTo(4294967295L));
            Assert.That(pts[0].Tile, Is.EqualTo("-1_2"));
            Assert.That(pts[0].Ref, Is.EqualTo("place,1"));
        }

        [Test]
        public void CityManifestParses()
        {
            var m = HanoiCityManifest.Parse(@"{""name"": ""hoankiem"", ""georeference"": {""origin_lat"": 21.0288, ""origin_lon"": 105.8524},
                ""tile_size_m"": 500, ""tiles"": [{""key"": [-1, 0], ""origin_m"": [-500, 0], ""files"": [""bld_-1_0.glb""]},
                                                 {""key"": [3, 3], ""origin_m"": [1500, 1500], ""files"": []}]}");
            Assert.That(m.TilesByDistance().First().Key, Is.EqualTo("-1_0"));
            Assert.That(m.Tiles[0].Has("bld_-1_0.glb"));
        }
    }
}
