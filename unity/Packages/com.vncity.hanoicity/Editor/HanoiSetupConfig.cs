using System.IO;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace HanoiCity.EditorTools
{
    /// <summary>
    /// unity/hanoi_setup.json with paths made absolute. Command-line overrides in batch mode, as
    /// UE's hanoi_common.load_config: -hanoiCity &lt;dir&gt; -hanoiContent &lt;dir&gt; -hanoiMaxTiles N.
    /// </summary>
    public sealed class HanoiSetupConfig
    {
        public string ProjectDir;
        public string CityBuild, GameContent, PipelineDistricts, AssetMap;
        public string Scene, TilesDest, StreamingDest;
        public bool ImportRoads = true;
        public int MaxTiles;

        public static HanoiSetupConfig Load()
        {
            var project = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
            var path = Path.Combine(project, "hanoi_setup.json");
            var j = JObject.Parse(File.ReadAllText(path));
            string Abs(string key) => Path.GetFullPath(Path.Combine(project, (string)j[key] ?? ""));
            var c = new HanoiSetupConfig
            {
                ProjectDir = project,
                CityBuild = Abs("city_build"),
                GameContent = Abs("game_content"),
                PipelineDistricts = Abs("pipeline_districts"),
                AssetMap = Abs("asset_map"),
                Scene = (string)j["scene"] ?? "Assets/Scenes/Hanoi.unity",
                TilesDest = (string)j["tiles_dest"] ?? "Assets/HanoiCity/Tiles",
                StreamingDest = (string)j["streaming_dest"] ?? "Assets/StreamingAssets/Hanoi",
                ImportRoads = (bool?)j["import_roads"] ?? true,
                MaxTiles = (int?)j["max_tiles"] ?? 0,
            };
            var args = System.Environment.GetCommandLineArgs();
            for (int i = 0; i + 1 < args.Length; ++i)
            {
                if (args[i] == "-hanoiCity") c.CityBuild = Path.GetFullPath(args[i + 1]);
                if (args[i] == "-hanoiContent") c.GameContent = Path.GetFullPath(args[i + 1]);
                if (args[i] == "-hanoiMaxTiles") c.MaxTiles = int.Parse(args[i + 1]);
            }
            return c;
        }

        public string Abs(string assetsRelative) => Path.GetFullPath(Path.Combine(ProjectDir, assetsRelative));
    }
}
