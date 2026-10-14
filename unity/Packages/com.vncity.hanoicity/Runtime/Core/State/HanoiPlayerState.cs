using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace HanoiCity.State
{
    /// <summary>
    /// Persistent player progress: the fields of FHanoiPlayerState plus what the Unity-only systems keep
    /// (random events, collectibles, tapes, businesses, jobs, bills). Saved as JSON by HanoiSave.
    /// </summary>
    [Serializable]
    public sealed class HanoiPlayerState
    {
        public HashSet<string> CompletedMissions = new HashSet<string>();
        public HashSet<string> Flags = new HashSet<string>();
        /// <summary>Faction / district / character id -> reputation (-100..100 for factions).</summary>
        public Dictionary<string, int> Reputation = new Dictionary<string, int>();
        /// <summary>
        /// Character id -> skill id -> level 0-100. Per character (the UE state keeps one map): each
        /// protagonist starts from characters/*.json skills and condition.min_skills reads the one
        /// currently played.
        /// </summary>
        public Dictionary<string, Dictionary<string, int>> Skills = new Dictionary<string, Dictionary<string, int>>();
        public long MoneyVnd;
        /// <summary>Item id -> count.</summary>
        public Dictionary<string, int> Inventory = new Dictionary<string, int>();
        /// <summary>Unlocked refs as "collection:id".</summary>
        public HashSet<string> Unlocked = new HashSet<string>();
        /// <summary>Current protagonist character id.</summary>
        public string Protagonist = "";
        public int LicencePoints = 12;
        public long UnpaidFinesVnd;
        public DateTime GameTime;
        /// <summary>Game time of the last fine; null = none yet. Drives the clean-record flag.</summary>
        public DateTime? LastFineGameTime;

        // ---- random events
        /// <summary>Random event id -> times it fired this playthrough.</summary>
        public Dictionary<string, int> RandomEventCounts = new Dictionary<string, int>();
        /// <summary>Random event id -> game time it last fired (cooldown_days).</summary>
        public Dictionary<string, DateTime> RandomEventLast = new Dictionary<string, DateTime>();

        // ---- collectibles
        public HashSet<string> Collected = new HashSet<string>();
        /// <summary>Cassette numbers 1-24 the player can play.</summary>
        public HashSet<int> Tapes = new HashSet<int>();

        // ---- economy
        /// <summary>Business id -> ownership (upgrades bought, loss streak).</summary>
        public Dictionary<string, OwnedBusiness> Businesses = new Dictionary<string, OwnedBusiness>();
        /// <summary>Activity id -> jobs this game week that count toward weekly_bonus (rating >= threshold).</summary>
        public Dictionary<string, int> WeeklyJobs = new Dictionary<string, int>();
        /// <summary>First day of the current game week (weekly bonus window).</summary>
        public DateTime WeekStart;
        /// <summary>Monthly bill id -> instalments already paid (for bills with a fixed count).</summary>
        public Dictionary<string, int> BillsPaid = new Dictionary<string, int>();
        /// <summary>Money the player owes because a bill could not be paid in full.</summary>
        public long ArrearsVnd;
        /// <summary>Game day of the last monthly billing.</summary>
        public DateTime LastBillingDay;

        public int GetSkill(string character, string skill) =>
            character != null && Skills.TryGetValue(character, out var map) && map.TryGetValue(skill, out var v) ? v : 0;

        public int GetReputation(string key) => Reputation.TryGetValue(key, out var v) ? v : 0;

        public string ToJson() => JsonConvert.SerializeObject(this, Formatting.Indented);

        public static HanoiPlayerState FromJson(string json) =>
            JsonConvert.DeserializeObject<HanoiPlayerState>(json, new JsonSerializerSettings { ObjectCreationHandling = ObjectCreationHandling.Replace });
    }

    [Serializable]
    public sealed class OwnedBusiness
    {
        public HashSet<string> Upgrades = new HashSet<string>();
        /// <summary>Consecutive game days with a loss; at HanoiRules.BusinessLossDaysBeforeSale it must be sold.</summary>
        public int LossDays;
        /// <summary>Game time until which a viral video adds HanoiRules.ViralIncomeBonus.</summary>
        public DateTime? ViralUntil;
        /// <summary>Last minigame quality 0-1 (cooking score...), scales income; 1 = as written.</summary>
        public double Quality = 1.0;
        /// <summary>Income minus upkeep since purchase (the phone app shows it).</summary>
        public long LifetimeProfitVnd;
    }

    /// <summary>Save file: state + the mission that was running (it restarts from its first step on load).</summary>
    [Serializable]
    public sealed class HanoiSaveData
    {
        public int Version = 1;
        public HanoiPlayerState State = new HanoiPlayerState();
        public string ActiveMission;
        public List<string> ManualWorldEvents = new List<string>();
    }
}
