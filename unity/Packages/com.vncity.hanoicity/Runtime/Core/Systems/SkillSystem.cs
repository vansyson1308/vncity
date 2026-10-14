using System;
using System.Collections.Generic;
using HanoiCity.Content;

namespace HanoiCity.Systems
{
    /// <summary>
    /// Skills 0-100 per character (docs/gdd/02 §10). A character starts from characters/*.json skills
    /// the first time they are played; activities (skills_trained) and random-event choices (skills)
    /// train them. Reaching a tier of skills.json adds the tier's refs to State.Unlocked, the same
    /// levels content gates with condition.min_skills.
    /// </summary>
    public sealed class SkillSystem
    {
        readonly HanoiWorld world;

        /// <summary>(character, skill, tier level, tier) when a tier is reached.</summary>
        public event Action<string, string, int, HanoiSkillsTier> TierReached;
        /// <summary>(character, skill, new level)</summary>
        public event Action<string, string, int> SkillChanged;

        public SkillSystem(HanoiWorld world) { this.world = world; }

        public int Level(string skill, string character = null) => world.State.GetSkill(character ?? world.State.Protagonist, skill);

        public void EnsureSeeded(string character)
        {
            if (string.IsNullOrEmpty(character) || world.State.Skills.ContainsKey(character)) return;
            var map = new Dictionary<string, int>();
            var row = world.Content.Character(character);
            if (row != null) foreach (var kv in row.Skills) map[kv.Key] = Clamp(kv.Value);
            world.State.Skills[character] = map;
            foreach (var kv in map) UnlockTiers(character, kv.Key, -1, kv.Value);
        }

        /// <summary>Adds delta levels (default HanoiRules.SkillGainPerTraining) to the current or given character.</summary>
        public int Train(string skill, int? delta = null, string character = null)
        {
            character = character ?? world.State.Protagonist;
            if (string.IsNullOrEmpty(character) || string.IsNullOrEmpty(skill)) return 0;
            EnsureSeeded(character);
            var map = world.State.Skills[character];
            map.TryGetValue(skill, out var old);
            int now = Clamp(old + (delta ?? world.Rules.SkillGainPerTraining));
            if (now == old) return now;
            map[skill] = now;
            UnlockTiers(character, skill, old, now);
            SkillChanged?.Invoke(character, skill, now);
            world.NotifyStateChanged();
            return now;
        }

        /// <summary>A job/minigame of an activity was completed: train its skills_trained once each.</summary>
        public void TrainFromActivity(string activityId)
        {
            var a = world.Content.Get<HanoiActivityRow>("activities", HanoiRef.IdOf(activityId));
            if (a == null) return;
            foreach (var s in a.SkillsTrained) Train(s);
        }

        void UnlockTiers(string character, string skill, int from, int to)
        {
            var row = world.Content.Get<HanoiSkillsRow>("skills", skill);
            if (row == null) return;
            foreach (var tier in row.Tiers)
            {
                if (tier.Level <= from || tier.Level > to) continue;
                foreach (var r in tier.Refs) world.State.Unlocked.Add(r.ToString());
                TierReached?.Invoke(character, skill, tier.Level, tier);
            }
        }

        /// <summary>The next tier above the current level (what the phone shows as coming), or null.</summary>
        public HanoiSkillsTier NextTier(string skill, string character = null)
        {
            var row = world.Content.Get<HanoiSkillsRow>("skills", skill);
            if (row == null) return null;
            int level = Level(skill, character);
            foreach (var t in row.Tiers) if (t.Level > level) return t;
            return null;
        }

        static int Clamp(int v) => Math.Max(0, Math.Min(100, v));
    }
}
