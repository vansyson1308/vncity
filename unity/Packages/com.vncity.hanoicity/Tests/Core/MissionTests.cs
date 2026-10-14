using System;
using System.Collections.Generic;
using System.Linq;
using HanoiCity.Content;
using HanoiCity.Geo;
using NUnit.Framework;

namespace HanoiCity.Tests
{
    public class MissionTests
    {
        // Single quotes become double quotes in Worlds.FromDocuments.
        const string Characters = @"{'collection': 'characters', 'items': [
            {'id': 'minh', 'name': {'vi': 'Minh'}, 'role': 'protagonist', 'bio': {'vi': '.'}, 'skills': {'lai_xe': 55}},
            {'id': 'lan', 'name': {'vi': 'Lan'}, 'role': 'protagonist', 'bio': {'vi': '.'}}]}";
        const string Rules = @"{'collection': 'traffic_rules', 'items': [
            {'id': 'vuot_den_do', 'name': {'vi': 'Vượt đèn đỏ'}, 'detection': {'base_notice_chance': 0.0, 'camera_enforced': true},
             'fine_vnd': {'motorbike': 4000000, 'car': 20000000}, 'heat': 2, 'licence_points': 4}]}";
        const string Events = @"{'collection': 'events', 'items': [
            {'id': 'trung_thu_test', 'name': {'vi': 'T'}, 'trigger': {'live_feed': 'manual.test'}}]}";
        const string Missions = @"{'collection': 'missions', 'items': [
          {'id': 'm_branch', 'name': {'vi': 'B'}, 'type': 'side', 'giver': 'characters:minh', 'protagonists': ['characters:lan'], 'steps': [
            {'id': 'di', 'kind': 'go_to', 'objective': {'vi': 'Đi'}, 'target': {'lat': 21.0300, 'lon': 105.8524}, 'params': {'radius_m': 10}},
            {'id': 'hoi', 'kind': 'choice', 'objective': {'vi': 'Chọn'}, 'params': {'player_input': 'hoi_gi'}, 'next': {'giup': 'giup', 'bo': 'fail'}},
            {'id': 'giup', 'kind': 'talk', 'objective': {'vi': 'Nói'}, 'set_flags': ['da_giup'], 'params': {'minimap': false}},
            {'id': 're', 'kind': 'choice', 'objective': {'vi': 'Rẽ'}, 'params': {'branch_source': 'flag'}, 'next': {'da_giup': 'cuoi', 'default': 'fail'}},
            {'id': 'cuoi', 'kind': 'wait_until', 'objective': {'vi': 'Đợi'}, 'params': {'hours': [18, 19]}}],
           'reward': {'money_vnd': 300000, 'set_flags': ['xong_branch'], 'reputation': {'hoi_xe_om': 5}}},
          {'id': 'm_fail', 'name': {'vi': 'F'}, 'type': 'side', 'giver': 'characters:minh', 'steps': [
            {'id': 'chay', 'kind': 'escape_traffic_police', 'objective': {'vi': 'Chạy'}, 'params': {'heat': 3}, 'fail_if': ['heat>=3', 'time>200']}]},
          {'id': 'm_gate', 'name': {'vi': 'G'}, 'type': 'story', 'giver': 'characters:minh', 'requires': {'flags': ['xong_branch']}, 'steps': [
            {'id': 'cho', 'kind': 'cutscene', 'objective': {'vi': 'Rước đèn'}, 'params': {'requires_event': 'events:trung_thu_test', 'apply_fine': 'traffic_rules:vuot_den_do'}}]},
          {'id': 'm_deadline', 'name': {'vi': 'D'}, 'type': 'side', 'giver': 'characters:minh', 'steps': [
            {'id': 'giao', 'kind': 'deliver', 'objective': {'vi': 'Giao'}, 'target': {'lat': 21.05, 'lon': 105.85}, 'params': {'deadline_hour': 9}}]}]}";

        static HanoiWorld World() => Worlds.FromDocuments(Worlds.Monday0700, Characters, Rules, Events, Missions);

        [Test]
        public void BranchingFlagsRewardsAndProtagonist()
        {
            var w = World();
            var log = new List<string>();
            w.Missions.ProtagonistSwitched += (c, l) => log.Add("as:" + c);
            w.Missions.ChoiceRequested += (m, s, prompt, opts) => log.Add($"choice:{prompt}:{string.Join("|", opts)}");
            w.Missions.MinimapVisibilityChanged += v => log.Add("minimap:" + v);
            w.Missions.MissionEnded += (m, ok, r) => log.Add($"end:{m}:{ok}");
            Assert.That(w.Missions.StartMission("m_branch"));
            Assert.That(w.State.Protagonist, Is.EqualTo("lan"), "a mission is played by its protagonist");
            var player = (FakePlayer)w.Player;
            var target = w.Missions.GetActiveStepTargetEnu().Value;
            player.PositionEnu = new Double3(target.X + 20, target.Y, 0);
            w.Tick(0.1);
            Assert.That(w.Missions.ActiveStep.Id, Is.EqualTo("di"), "20 m is outside radius_m 10");
            player.PositionEnu = new Double3(target.X + 5, target.Y, 0);
            w.Tick(0.1);
            Assert.That(w.Missions.ActiveStep.Id, Is.EqualTo("hoi"));
            w.Missions.CompleteCurrentStep("giup");
            Assert.That(w.Missions.MinimapAllowed, Is.False);
            w.Missions.CompleteCurrentStep();
            // set_flags applied before the flag branch resolves: straight to wait_until.
            Assert.That(w.Missions.ActiveStep.Id, Is.EqualTo("cuoi"));
            w.Clock.Set(new DateTime(2026, 10, 12, 18, 15, 0));
            w.Tick(0.1);
            Assert.That(w.Missions.IsActive, Is.False);
            Assert.That(w.State.CompletedMissions, Does.Contain("m_branch"));
            Assert.That(w.State.Flags, Is.SupersetOf(new[] { "da_giup", "xong_branch" }));
            Assert.That(w.State.MoneyVnd, Is.EqualTo(500000 + 300000));
            Assert.That(w.State.GetReputation("hoi_xe_om"), Is.EqualTo(5));
            Assert.That(log, Is.EqualTo(new[] { "as:lan", "choice:hoi_gi:giup|bo", "minimap:False", "minimap:True", "end:m_branch:True" }));
        }

        [Test]
        public void ChoosingFailEndsTheMission()
        {
            var w = World();
            w.Missions.StartMission("m_branch");
            w.Player = new FakePlayer { PositionEnu = w.Missions.GetActiveStepTargetEnu().Value };
            w.Tick(0.1);
            bool? ok = null;
            w.Missions.MissionEnded += (m, s, r) => ok = s;
            w.Missions.CompleteCurrentStep("bo");
            Assert.That(ok, Is.False);
            Assert.That(w.State.CompletedMissions, Is.Empty);
        }

        [Test]
        public void FailIfHeatAndEscape()
        {
            var w = World();
            string reason = null;
            w.Missions.MissionEnded += (m, s, r) => reason = r;
            w.Missions.StartMission("m_fail");
            Assert.That(w.Heat.Heat, Is.EqualTo(3));
            w.Tick(0.1);
            Assert.That(reason, Is.EqualTo("heat>=3"));
        }

        [Test]
        public void RequirementsEventsAndFines()
        {
            var w = World();
            Assert.That(w.Missions.CanStartMission("m_gate", out var why), Is.False);
            Assert.That(why, Is.EqualTo("requirements not met"));
            w.SetFlag("xong_branch", true);
            Assert.That(w.Missions.CanStartMission("m_gate", out why), Is.False);
            Assert.That(why, Is.EqualTo("waits for event trung_thu_test"));
            Assert.That(w.Missions.GetAvailableMissions(), Does.Not.Contain("m_gate"));
            w.SetWorldEventActive("trung_thu_test", true);
            Assert.That(w.Missions.StartMission("m_gate"));
            Assert.That(w.State.UnpaidFinesVnd, Is.EqualTo(4000000));
            Assert.That(w.State.LicencePoints, Is.EqualTo(8));
            w.SetWorldEventActive("trung_thu_test", false);
            w.Missions.CompleteCurrentStep();
            Assert.That(w.Missions.IsActive, "the step waits while the event is off");
            w.SetWorldEventActive("trung_thu_test", true);
            w.Missions.CompleteCurrentStep();
            Assert.That(w.State.CompletedMissions, Does.Contain("m_gate"));
            Assert.That(w.Missions.CanStartMission("m_gate", out why), Is.False);
            Assert.That(why, Is.EqualTo("already completed"));
        }

        [Test]
        public void DeadlineFailsWhenTheClockPassesIt()
        {
            var w = World();
            string reason = null;
            w.Missions.MissionEnded += (m, s, r) => reason = r;
            w.Missions.StartMission("m_deadline");
            w.Clock.Advance(TimeSpan.FromHours(1.5));
            w.Tick(0.01);
            Assert.That(w.Missions.IsActive);
            w.Clock.Advance(TimeSpan.FromHours(1));
            w.Tick(0.01);
            Assert.That(reason, Is.EqualTo("deadline"));
        }

        [Test]
        public void DeadlineStartedAtItsOwnHourLastsADay()
        {
            var w = World();
            w.Clock.Set(new DateTime(2026, 10, 12, 9, 0, 0));
            string reason = null;
            w.Missions.MissionEnded += (m, s, r) => reason = r;
            w.Missions.StartMission("m_deadline");
            w.Clock.Advance(TimeSpan.FromHours(23.5));
            w.Tick(0.01);
            Assert.That(w.Missions.IsActive, "accepted at 09:00 with deadline_hour 9 = until 09:00 tomorrow");
            w.Clock.Advance(TimeSpan.FromHours(1));
            w.Tick(0.01);
            Assert.That(reason, Is.EqualTo("deadline"));
        }

        [Test]
        public void CleanRecordFlagAfterNinetyDaysWithoutFines()
        {
            var w = World();
            w.Tick(0.01);
            w.Clock.Advance(TimeSpan.FromDays(89));
            w.Tick(0.01);
            Assert.That(w.State.Flags, Does.Not.Contain("ho_so_sach_90_ngay"));
            w.Clock.Advance(TimeSpan.FromDays(1.1));
            w.Tick(0.01);
            Assert.That(w.State.Flags, Does.Contain("ho_so_sach_90_ngay"));
            w.State.MoneyVnd = 500000;  // ninety days of bills have emptied the wallet
            w.Heat.ReportViolation("vuot_den_do", false, true, false);
            Assert.That(w.State.Flags, Does.Not.Contain("ho_so_sach_90_ngay"));
            Assert.That(w.Heat.Stars, Is.EqualTo(2));
            Assert.That(w.Heat.PulledOver(), Is.EqualTo(500000), "pays what the player has");
            Assert.That(w.State.UnpaidFinesVnd, Is.EqualTo(3500000));
        }

        [Test]
        public void SaveAndLoadRoundTrip()
        {
            var w = World();
            w.Missions.StartMission("m_branch");
            w.SetFlag("x", true);
            w.SetWorldEventActive("trung_thu_test", true);
            var json = w.SaveToJson();
            var w2 = World();
            w2.LoadFromJson(json);
            Assert.That(w2.State.Flags, Does.Contain("x"));
            Assert.That(w2.State.Protagonist, Is.EqualTo("lan"));
            Assert.That(w2.Missions.ActiveMissionId, Is.EqualTo("m_branch"), "the running mission restarts from its first step");
            Assert.That(w2.IsWorldEventActive("trung_thu_test"));
            Assert.That(w2.Clock.Now, Is.EqualTo(w.Clock.Now));
        }
    }
}
