using System;
using System.Collections.Generic;
using System.Linq;
using HanoiCity.Content;
using HanoiCity.Geo;

namespace HanoiCity.Systems
{
    /// <summary>
    /// The second map (collectibles.json, docs/gdd/02 §11): 120 old photos to re-shoot, 40 ration
    /// coupons to find, 60 old signs to photograph, each at a real coordinate. Photos count only when
    /// the shot matches the old frame (PhotoMatchThreshold) inside the photo's light hours. Tapes: a
    /// photo with unlocks_tape opens that cassette; 60 photos open tape 22, 90 open tape 23; tape 24
    /// opens with 30 photos once chapter 3 is reached, or by story (flag khoi_nghe_thang_ke_het).
    /// Coupons are hidden near (not at) their coordinate, at a spot stable per item.
    /// </summary>
    public sealed class CollectibleSystem
    {
        readonly HanoiWorld world;

        public event Action<HanoiCollectiblesRow> Collected;
        public event Action<int> TapeUnlocked;

        public CollectibleSystem(HanoiWorld world) { this.world = world; }

        public HanoiCollectiblesRow Get(string id) => world.Content.Get<HanoiCollectiblesRow>("collectibles", id);

        public int Count(HanoiCollectiblesSet set) =>
            world.State.Collected.Count(id => Get(id)?.Set == set);

        public int Total(HanoiCollectiblesSet set) => world.Content.All<HanoiCollectiblesRow>("collectibles").Count(c => c.Set == set);

        /// <summary>Where the player must be: the coordinate, or for coupons the hiding spot near it.</summary>
        public Double3 SpotEnu(HanoiCollectiblesRow c)
        {
            var p = world.Geo.GeoToEnu(c.Location);
            if (c.Set != HanoiCollectiblesSet.TemPhieu) return p;
            // Stable per id (FNV-1a), within CouponHideRadiusM: the coordinate is the street, the coupon is in a house on it.
            uint h = 2166136261;
            foreach (char ch in c.Id) { h ^= ch; h *= 16777619; }
            double angle = (h % 3600) / 3600.0 * 2 * Math.PI;
            double dist = world.Rules.CouponHideRadiusM * (0.4 + 0.6 * ((h >> 12) % 1000) / 1000.0);
            return new Double3(p.X + dist * Math.Cos(angle), p.Y + dist * Math.Sin(angle), p.Z);
        }

        public bool CanCollect(string id, out string reason)
        {
            var c = Get(id);
            reason = null;
            if (c == null) { reason = "unknown"; return false; }
            if (world.State.Collected.Contains(id)) { reason = "already collected"; return false; }
            var act = world.Content.Get<HanoiActivityRow>(c.Activity);
            if (act != null && !world.EvaluateCondition(act.Unlock)) { reason = "activity locked"; return false; }
            if (c.Hours != null && !c.Hours.Contains(world.Clock.HourOfDay)) { reason = "light does not match the old frame"; return false; }
            var player = world.Player;
            if (player == null || !player.HasPawn || Double3.PlanDistance(player.PositionEnu, SpotEnu(c)) > world.Rules.CollectRadiusM) { reason = "too far"; return false; }
            return true;
        }

        /// <summary>
        /// Collect at the current position. matchScore: photos only (0-1, how well the shot matches the
        /// archive frame); coupons and signs pass 1. Returns false if not collectable or the match is too low.
        /// </summary>
        public bool Collect(string id, double matchScore = 1.0)
        {
            if (!CanCollect(id, out _)) return false;
            var c = Get(id);
            if (c.Set == HanoiCollectiblesSet.AnhXua && matchScore < world.Rules.PhotoMatchThreshold) return false;
            world.State.Collected.Add(id);
            world.Skills.TrainFromActivity(c.Activity?.Id);
            Collected?.Invoke(c);
            if (c.UnlocksTape.HasValue) UnlockTape(c.UnlocksTape.Value);
            CheckTapes();
            world.NotifyStateChanged();
            return true;
        }

        /// <summary>Tapes that open by count or by story; call after missions end too (HanoiWorld does).</summary>
        public void CheckTapes()
        {
            var r = world.Rules;
            int photos = Count(HanoiCollectiblesSet.AnhXua);
            if (photos >= r.Tape22Photos) UnlockTape(22);
            if (photos >= r.Tape23Photos) UnlockTape(23);
            if ((photos >= r.Tape24Photos && ReachedChapter(r.Tape24Chapter)) || world.State.Flags.Contains(r.Tape24Flag)) UnlockTape(24);
        }

        /// <summary>A story mission of that chapter (or later) is running or done.</summary>
        public bool ReachedChapter(int chapter)
        {
            var active = world.Missions.ActiveMission;
            if (active != null && active.Type == HanoiMissionType.Story && (active.Chapter ?? 0) >= chapter) return true;
            return world.State.CompletedMissions.Any(id =>
            {
                var m = world.Content.Mission(id);
                return m != null && m.Type == HanoiMissionType.Story && (m.Chapter ?? 0) >= chapter;
            });
        }

        void UnlockTape(int tape)
        {
            if (world.State.Tapes.Add(tape)) TapeUnlocked?.Invoke(tape);
        }

        /// <summary>Nearest uncollected item of a set to the player (phone map), or null.</summary>
        public HanoiCollectiblesRow NearestUncollected(HanoiCollectiblesSet set)
        {
            var player = world.Player;
            if (player == null || !player.HasPawn) return null;
            return world.Content.All<HanoiCollectiblesRow>("collectibles")
                .Where(c => c.Set == set && !world.State.Collected.Contains(c.Id))
                .OrderBy(c => Double3.PlanDistance(player.PositionEnu, SpotEnu(c)))
                .FirstOrDefault();
        }

        /// <summary>Uncollected items within radius metres (to spawn pickups / photo prompts near the player).</summary>
        public List<HanoiCollectiblesRow> Nearby(double radiusM)
        {
            var player = world.Player;
            if (player == null || !player.HasPawn) return new List<HanoiCollectiblesRow>();
            return world.Content.All<HanoiCollectiblesRow>("collectibles")
                .Where(c => !world.State.Collected.Contains(c.Id) && Double3.PlanDistance(player.PositionEnu, SpotEnu(c)) <= radiusM)
                .ToList();
        }
    }
}
