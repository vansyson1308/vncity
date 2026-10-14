using System;
using System.Collections.Generic;
using System.Linq;
using HanoiCity.Content;
using HanoiCity.Geo;
using HanoiCity.State;
using HanoiCity.Systems;
using HanoiCity.Time;
using HanoiCity.Weather;
using Newtonsoft.Json;

namespace HanoiCity
{
    /// <summary>What the runtime needs to know about the player pawn. The Unity layer implements it.</summary>
    public interface IHanoiPlayerQuery
    {
        bool HasPawn { get; }
        /// <summary>Pawn position in ENU metres (double, independent of the floating origin).</summary>
        Double3 PositionEnu { get; }
        bool OnVehicle { get; }
        /// <summary>Driving a car (picks the car fine) rather than a motorbike/bicycle.</summary>
        bool InCar { get; }
        /// <summary>Riding a bicycle (flood passable depth xe_dap) rather than a motorbike.</summary>
        bool OnBicycle { get; }
        /// <summary>random_events road type under the pawn (ngo, pho, duong_lon, de, cau, via_he, cho, ben_xe) or null.</summary>
        string RoadType { get; }
    }

    /// <summary>
    /// The game state and its systems, engine-free: the Unity twin of the UE GameInstance subsystems
    /// (content, time/weather, missions, heat, random street events, collectibles, chapter 3-5 minigame
    /// modes, flood layers) plus skills, economy and calendar. The Unity layer (HanoiGame) owns one, calls
    /// Tick every frame and forwards input; tests drive it directly.
    /// </summary>
    public sealed class HanoiWorld
    {
        public HanoiContentDatabase Content { get; }
        public HanoiRules Rules { get; }
        public HanoiGeoFrame Geo { get; }
        public HanoiClock Clock { get; }
        public HanoiPlayerState State { get; private set; } = new HanoiPlayerState();
        public HanoiWeatherState Weather { get; private set; } = new HanoiWeatherState();
        public IHanoiPlayerQuery Player { get; set; }
        public HanoiRandom Random { get; set; }
        public DistrictLocator Districts { get; set; }

        public MissionRunner Missions { get; }
        public DialogueRunner Dialogue { get; }
        public HeatSystem Heat { get; }
        public SkillSystem Skills { get; }
        public RandomEventSystem RandomEvents { get; }
        public CollectibleSystem Collectibles { get; }
        public EconomySystem Economy { get; }
        public MinigameSystem Minigames { get; }
        public FloodSystem Floods { get; }
        /// <summary>Road graphs the flood layer blocks and slows (the Unity layer registers HanoiTrafficGraphView's).</summary>
        public List<City.HanoiTrafficGraph> TrafficGraphs { get; } = new List<City.HanoiTrafficGraph>();

        IHanoiWeatherProvider weatherProvider;
        double secondsSincePoll;
        readonly HashSet<string> manualEvents = new HashSet<string>();
        readonly HashSet<string> calendarEvents = new HashSet<string>();

        public event Action<HanoiPlayerState> StateChanged;
        public event Action<HanoiWeatherState> WeatherChanged;
        public event Action<string, bool> WorldEventChanged;
        /// <summary>Warnings the Unity layer forwards to Debug.LogWarning.</summary>
        public event Action<string> Log;

        public HanoiWorld(HanoiContentDatabase content, HanoiRules rules = null, DateTime? start = null, ulong seed = 0)
        {
            Content = content;
            Rules = rules ?? new HanoiRules();
            Geo = new HanoiGeoFrame(Rules.OriginLat, Rules.OriginLon, Rules.OriginHeightM);
            Clock = start.HasValue ? new HanoiClock(start.Value, Rules.TimeScale) : HanoiClock.StartingToday(Rules.StartHour, Rules.TimeScale);
            Clock.SyncToRealTime = Rules.SyncToRealHanoiTime;
            Random = new HanoiRandom(seed != 0 ? seed : (ulong)DateTime.UtcNow.Ticks);
            Districts = new DistrictLocator(content, Geo, null);
            State.MoneyVnd = Rules.StartingMoneyVnd;
            weatherProvider = new HanoiClimatologyWeather();

            Missions = new MissionRunner(this);
            Dialogue = new DialogueRunner(this);
            Heat = new HeatSystem(this);
            Skills = new SkillSystem(this);
            RandomEvents = new RandomEventSystem(this);
            Collectibles = new CollectibleSystem(this);
            Economy = new EconomySystem(this);
            Minigames = new MinigameSystem(this);
            Floods = new FloodSystem(this);

            Missions.MissionEnded += (id, ok, reason) => Collectibles.CheckTapes();
            Clock.HourChanged += OnHourChanged;
            Clock.DayChanged += d => Economy.OnDayChanged(d);
            RefreshWeather();
            RefreshCalendar();
        }

        internal void Warn(string message) => Log?.Invoke(message);

        // ------------------------------------------------------------------ frame

        /// <summary>Advance everything by realSeconds of real time.</summary>
        public void Tick(double realSeconds)
        {
            Clock.Tick(realSeconds);
            if (!(weatherProvider is HanoiClimatologyWeather) && weatherProvider != null)
            {
                secondsSincePoll += realSeconds;
                if (secondsSincePoll >= Rules.WeatherPollSeconds) RefreshWeather();
            }
            Heat.Tick(realSeconds);
            Missions.Tick(realSeconds);
            RandomEvents.Tick(realSeconds);
            Minigames.Tick(realSeconds);
            Floods.Tick();
            UpdateCleanRecord();
        }

        void OnHourChanged(int hour)
        {
            if (weatherProvider is HanoiClimatologyWeather) RefreshWeather();
            RefreshCalendar();
            RandomEvents.OnGameHour();
        }

        // ------------------------------------------------------------------ weather

        /// <summary>null = Manual (only SetWeather changes it).</summary>
        public void SetWeatherProvider(IHanoiWeatherProvider provider)
        {
            weatherProvider = provider;
            RefreshWeather();
        }

        public void RefreshWeather()
        {
            secondsSincePoll = 0;
            weatherProvider?.RequestWeather(Clock.Now, SetWeather);
        }

        public void SetWeather(HanoiWeatherState w)
        {
            Weather = w ?? new HanoiWeatherState();
            WeatherChanged?.Invoke(Weather);
            RefreshCalendar();
        }

        // ------------------------------------------------------------------ world events

        /// <summary>Calendar-driven events (Tết, weekend walking street, nồm...) are refreshed every game hour.</summary>
        public void RefreshCalendar()
        {
            foreach (var ev in Content.All<HanoiEventRow>("events"))
            {
                if (!WorldEventCalendar.IsAutomatic(ev)) continue;
                bool on = WorldEventCalendar.IsActive(ev, Clock.Now, Weather);
                bool was = calendarEvents.Contains(ev.Id);
                if (on == was) continue;
                bool before = IsWorldEventActive(ev.Id);
                if (on) calendarEvents.Add(ev.Id); else calendarEvents.Remove(ev.Id);
                if (IsWorldEventActive(ev.Id) != before) WorldEventChanged?.Invoke(ev.Id, !before);
            }
        }

        /// <summary>Gameplay override (SetWorldEventActive in UE): on until set off, whatever the calendar says.</summary>
        public void SetWorldEventActive(string eventId, bool active)
        {
            eventId = HanoiRef.IdOf(eventId);
            bool before = IsWorldEventActive(eventId);
            if (active) manualEvents.Add(eventId); else manualEvents.Remove(eventId);
            if (IsWorldEventActive(eventId) != before) WorldEventChanged?.Invoke(eventId, !before);
        }

        public bool IsWorldEventActive(string eventId) => manualEvents.Contains(eventId) || calendarEvents.Contains(eventId);

        public IEnumerable<string> ActiveWorldEvents => manualEvents.Union(calendarEvents);

        // ------------------------------------------------------------------ conditions & progress

        /// <summary>
        /// FHanoiCondition: missions_completed, min_reputation, min_skills (current protagonist), hours,
        /// weather, protagonist, flags (all set), not_flags (none set), events_active. Null = always.
        /// </summary>
        public bool EvaluateCondition(HanoiCondition c)
        {
            if (c == null) return true;
            foreach (var r in c.MissionsCompleted) if (!State.CompletedMissions.Contains(r.Id)) return false;
            foreach (var kv in c.MinReputation) if (State.GetReputation(kv.Key) < kv.Value) return false;
            foreach (var kv in c.MinSkills) if (State.GetSkill(State.Protagonist, kv.Key) < kv.Value) return false;
            if (c.Hours != null && !c.Hours.Contains(Clock.HourOfDay)) return false;
            if (c.Weather.Count > 0 && !c.Weather.Contains(Weather.Condition)) return false;
            if (c.Protagonist.Count > 0 && !c.Protagonist.Any(r => r.Id == State.Protagonist)) return false;
            foreach (var f in c.Flags) if (!State.Flags.Contains(f)) return false;
            foreach (var f in c.NotFlags) if (State.Flags.Contains(f)) return false;
            foreach (var e in c.EventsActive) if (!IsWorldEventActive(e.Id)) return false;
            return true;
        }

        public void ApplyReward(HanoiReward r)
        {
            if (r == null) return;
            State.MoneyVnd += r.MoneyVnd ?? 0;
            foreach (var kv in r.Reputation) AddReputation(kv.Key, kv.Value, notify: false);
            foreach (var item in r.Items) AddItem(item.Id, 1, notify: false);
            foreach (var u in r.Unlocks) State.Unlocked.Add(u.ToString());
            foreach (var f in r.SetFlags) State.Flags.Add(f);
            NotifyStateChanged();
        }

        public void AddReputation(string key, int delta, bool notify = true)
        {
            State.Reputation[key] = Math.Max(-100, Math.Min(100, State.GetReputation(key) + delta));
            if (notify) NotifyStateChanged();
        }

        public void AddItem(string itemId, int count = 1, bool notify = true)
        {
            State.Inventory.TryGetValue(itemId, out var n);
            State.Inventory[itemId] = n + count;
            if (notify) NotifyStateChanged();
        }

        /// <summary>Adds (or, negative, takes) money; never below zero. Returns what actually moved.</summary>
        public long AddMoney(long deltaVnd)
        {
            long before = State.MoneyVnd;
            State.MoneyVnd = Math.Max(0, State.MoneyVnd + deltaVnd);
            NotifyStateChanged();
            return State.MoneyVnd - before;
        }

        /// <summary>Spends if affordable; false (and nothing spent) otherwise.</summary>
        public bool SpendMoney(long amountVnd)
        {
            if (amountVnd < 0 || State.MoneyVnd < amountVnd) return false;
            State.MoneyVnd -= amountVnd;
            NotifyStateChanged();
            return true;
        }

        public void SetFlag(string flag, bool set)
        {
            bool changed = set ? State.Flags.Add(flag) : State.Flags.Remove(flag);
            if (changed) NotifyStateChanged();
        }

        public void NotifyStateChanged() => StateChanged?.Invoke(State);

        /// <summary>Possess a character; their starting skills (characters/*.json) seed the first time.</summary>
        public bool SetProtagonist(string characterId)
        {
            characterId = HanoiRef.IdOf(characterId);
            if (string.IsNullOrEmpty(characterId) || State.Protagonist == characterId) return false;
            State.Protagonist = characterId;
            Skills.EnsureSeeded(characterId);
            NotifyStateChanged();
            return true;
        }

        /// <summary>A fine was issued now: restarts the clean-record counter and clears the flag.</summary>
        public void RecordFine()
        {
            State.LastFineGameTime = Clock.Now;
            State.Flags.Remove(Rules.CleanRecordFlag);
            NotifyStateChanged();
        }

        void UpdateCleanRecord()
        {
            if (State.Flags.Contains(Rules.CleanRecordFlag)) return;
            if (!State.LastFineGameTime.HasValue)
            {
                State.LastFineGameTime = Clock.Now;  // a new game counts from its first day
                return;
            }
            if ((Clock.Now - State.LastFineGameTime.Value).TotalDays >= Rules.CleanRecordDays) SetFlag(Rules.CleanRecordFlag, true);
        }

        /// <summary>District id (content districts) the player is in, or null.</summary>
        public string PlayerDistrict => Player != null && Player.HasPawn ? Districts.Locate(Player.PositionEnu) : null;

        /// <summary>ENU position of a ref (landmark, business, character home...), or null.</summary>
        public Double3? ResolveEnu(HanoiRef r)
        {
            var g = Content.ResolveLocation(r);
            return g == null ? (Double3?)null : Geo.GeoToEnu(g);
        }

        // ------------------------------------------------------------------ save

        public string SaveToJson()
        {
            State.GameTime = Clock.Now;
            var data = new HanoiSaveData
            {
                State = State,
                ActiveMission = Missions.IsActive ? Missions.ActiveMissionId : null,
                ManualWorldEvents = manualEvents.OrderBy(e => e, StringComparer.Ordinal).ToList(),
            };
            return JsonConvert.SerializeObject(data, Formatting.Indented);
        }

        public void LoadFromJson(string json)
        {
            var data = JsonConvert.DeserializeObject<HanoiSaveData>(json, new JsonSerializerSettings { ObjectCreationHandling = ObjectCreationHandling.Replace });
            Missions.AbandonSilently();
            RandomEvents.Clear();
            Minigames.Cancel();
            Floods.Clear();
            State = data.State ?? new HanoiPlayerState();
            if (State.GameTime.Ticks > 0) Clock.Restore(State.GameTime);
            manualEvents.Clear();
            foreach (var e in data.ManualWorldEvents) manualEvents.Add(e);
            RefreshWeather();
            RefreshCalendar();
            NotifyStateChanged();
            Floods.Resume();
            if (!string.IsNullOrEmpty(data.ActiveMission)) Missions.StartMission(data.ActiveMission);
        }
    }

    /// <summary>
    /// Which game district a point is in: the content district (districts.json centers) nearest to the
    /// point among those whose pipeline build box (pipeline/districts.json) contains it, or among all
    /// of them when the point is outside every box or no boxes were given.
    /// </summary>
    public sealed class DistrictLocator
    {
        readonly List<(string id, Double3 center)> centers = new List<(string, Double3)>();
        readonly Dictionary<string, (double w, double s, double e, double n)> boxes;
        readonly HanoiGeoFrame geo;

        public DistrictLocator(HanoiContentDatabase content, HanoiGeoFrame geo, Dictionary<string, (double w, double s, double e, double n)> boxesByGameDistrict)
        {
            this.geo = geo;
            boxes = boxesByGameDistrict;
            foreach (var d in content.All<HanoiDistrictRow>("districts"))
                if (d.Center != null) centers.Add((d.Id, geo.GeoToEnu(d.Center)));
        }

        /// <summary>Boxes from pipeline/districts.json ({"districts": {k: {"bbox": [w,s,e,n], "game_districts": [...]}}}).</summary>
        public static Dictionary<string, (double, double, double, double)> ParseBoxes(string pipelineDistrictsJson)
        {
            var o = Newtonsoft.Json.Linq.JObject.Parse(pipelineDistrictsJson);
            var map = new Dictionary<string, (double, double, double, double)>();
            foreach (var p in ((Newtonsoft.Json.Linq.JObject)o["districts"]).Properties())
            {
                var b = p.Value["bbox"];
                var box = ((double)b[0], (double)b[1], (double)b[2], (double)b[3]);
                foreach (var g in p.Value["game_districts"] ?? new Newtonsoft.Json.Linq.JArray()) map[(string)g] = box;
            }
            return map;
        }

        public string Locate(Double3 enu)
        {
            var g = geo.EnuToGeo(enu);
            string best = null;
            double bestD = double.MaxValue;
            foreach (bool needBox in new[] { true, false })
            {
                foreach (var (id, c) in centers)
                {
                    if (needBox)
                    {
                        if (boxes == null || !boxes.TryGetValue(id, out var b)) continue;
                        if (g.Lon < b.w || g.Lon > b.e || g.Lat < b.s || g.Lat > b.n) continue;
                    }
                    double d = Double3.PlanDistance(enu, c);
                    if (d < bestD) { bestD = d; best = id; }
                }
                if (best != null) return best;
            }
            return best;
        }
    }
}
