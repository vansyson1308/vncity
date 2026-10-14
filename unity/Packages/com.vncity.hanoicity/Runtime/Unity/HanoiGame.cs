using System;
using System.IO;
using HanoiCity.Content;
using UnityEngine;

namespace HanoiCity.UnityLayer
{
    /// <summary>
    /// Bootstrap: loads the content from StreamingAssets into a HanoiWorld, ticks it every frame,
    /// wires the player, weather feed and district boxes, and saves. One per scene (Run Full Setup
    /// adds it). Everything the game knows lives in World; UI and gameplay scripts subscribe to its
    /// events (World.Missions.StepStarted, World.RandomEvents.Started, World.StateChanged, ...).
    /// </summary>
    [DefaultExecutionOrder(-1000)]
    public sealed class HanoiGame : MonoBehaviour
    {
        public static HanoiGame Instance { get; private set; }

        public HanoiSettings settings;
        public HanoiPlayerAdapter player;
        [Tooltip("Load the save file on start, if it exists.")]
        public bool loadSaveOnStart = true;

        public HanoiWorld World { get; private set; }
        public HanoiContentDatabase Content { get; private set; }

        /// <summary>Raised once World exists, before the first Tick.</summary>
        public event Action<HanoiWorld> WorldReady;

        public string SavePath => Path.Combine(Application.persistentDataPath, Settings.saveFile);
        HanoiSettings Settings => settings != null ? settings : (settings = Resources.Load<HanoiSettings>("HanoiSettings") ?? ScriptableObject.CreateInstance<HanoiSettings>());

        void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Debug.LogWarning("[HanoiCity] a second HanoiGame was destroyed");
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            var s = Settings;
            var root = Application.streamingAssetsPath;
            var contentDir = Path.Combine(root, s.contentFolder);
            try
            {
                Content = HanoiContentDatabase.LoadDirectory(contentDir);
            }
            catch (Exception e)
            {
                // Strict on purpose: a typo in game/content must stop the game, not hide a mission.
                Debug.LogError($"[HanoiCity] content in {contentDir} failed to load: {e.Message}");
                enabled = false;
                return;
            }

            World = new HanoiWorld(Content, s.ToRules(), null, s.seed);
            World.Log += m => Debug.LogWarning("[HanoiCity] " + m);
            var districts = Path.Combine(root, s.districtsFile);
            if (File.Exists(districts))
                World.Districts = new DistrictLocator(Content, World.Geo, DistrictLocator.ParseBoxes(File.ReadAllText(districts)));
            if (!string.IsNullOrEmpty(s.weatherEndpoint))
                World.SetWeatherProvider(new HanoiWebWeatherProvider(s.weatherEndpoint));
            if (player == null) player = FindAnyObjectByType<HanoiPlayerAdapter>();
            World.Player = player;
            if (s.autosaveOnMissionEnd) World.Missions.MissionEnded += (id, ok, reason) => Save();
            if (loadSaveOnStart && File.Exists(SavePath)) Load();
            Debug.Log($"[HanoiCity] {Content.TotalRows} content rows, {Content.Count("missions")} missions; {World.Clock.Now:yyyy-MM-dd HH:mm} Hanoi");
            WorldReady?.Invoke(World);
        }

        void Update()
        {
            if (World == null) return;
            if (World.Player == null && player != null) World.Player = player;
            World.Tick(UnityEngine.Time.deltaTime);  // "Time" alone is the HanoiCity.Time namespace here
        }

        void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        public void Save()
        {
            if (World == null) return;
            var tmp = SavePath + ".tmp";
            File.WriteAllText(tmp, World.SaveToJson());
            if (File.Exists(SavePath)) File.Replace(tmp, SavePath, null);
            else File.Move(tmp, SavePath);
        }

        public bool Load()
        {
            try
            {
                World.LoadFromJson(File.ReadAllText(SavePath));
                return true;
            }
            catch (Exception e)
            {
                Debug.LogError($"[HanoiCity] save {SavePath} not loaded: {e.Message}");
                return false;
            }
        }
    }
}
