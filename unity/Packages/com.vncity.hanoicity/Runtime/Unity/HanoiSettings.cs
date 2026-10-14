using UnityEngine;

namespace HanoiCity.UnityLayer
{
    /// <summary>
    /// Project-wide knobs (the UE twin is UHanoiCitySettings in Project Settings > Plugins > Hanoi City).
    /// Create one with Assets > Create > Hanoi City > Settings and put it in a Resources folder as
    /// "HanoiSettings", or assign it on HanoiGame. Tuning that both engines share lives in HanoiRules
    /// (Runtime/Core/HanoiRules.cs); this asset overrides the few values designers change per build.
    /// </summary>
    [CreateAssetMenu(menuName = "Hanoi City/Settings", fileName = "HanoiSettings")]
    public sealed class HanoiSettings : ScriptableObject
    {
        [Header("Content (under StreamingAssets)")]
        [Tooltip("Folder with game/content JSON, copied by Tools > Hanoi City > Run Full Setup.")]
        public string contentFolder = "Hanoi/Content";
        [Tooltip("Folder with manifest.json, traffic/graph.json, places/pois.json and pcg/*.csv of the city build.")]
        public string cityFolder = "Hanoi/City";
        [Tooltip("pipeline/districts.json (district boxes for random events), copied next to the content.")]
        public string districtsFile = "Hanoi/districts.json";

        [Header("Clock")]
        [Tooltip("Game minutes per real minute. 30 = one game day in 48 real minutes (owner's decision, GTA V pace).")]
        public double timeScale = 30.0;
        public bool syncToRealHanoiTime = false;
        [Range(0, 24)] public double startHour = 7.0;

        [Header("Weather")]
        [Tooltip("live/weather.py feed (python -m live.weather --serve 8765). Empty = climatology only.")]
        public string weatherEndpoint = "http://127.0.0.1:8765/weather";
        [Tooltip("Real seconds between feed polls.")]
        public float weatherPollSeconds = 600f;

        [Header("World")]
        [Tooltip("Shift the world back to the Unity origin when the player is this far from it (metres). float32 is ~1 mm at 8 km.")]
        public float floatingOriginThresholdM = 2000f;
        [Tooltip("Random seed; 0 = new every run.")]
        public ulong seed = 0;

        [Header("Save")]
        public string saveFile = "hanoi_save.json";
        public bool autosaveOnMissionEnd = true;

        public HanoiRules ToRules()
        {
            var r = new HanoiRules
            {
                TimeScale = timeScale,
                SyncToRealHanoiTime = syncToRealHanoiTime,
                StartHour = startHour,
                WeatherPollSeconds = weatherPollSeconds,
            };
            return r;
        }
    }
}
