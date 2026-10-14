using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace HanoiCity.Content
{
    /// <summary>
    /// All game content, read straight from game/content/**.json (in a build: StreamingAssets/Hanoi/Content).
    /// Strict: an unknown key, a missing required key, a bad enum value or a duplicate id throws, so a
    /// content file that would not load in the game fails the dotnet tests first. Twin of
    /// UHanoiContentSubsystem (which reads DataTables converted from the same files).
    /// </summary>
    public sealed class HanoiContentDatabase
    {
        readonly Dictionary<string, List<IHanoiRow>> rows = new Dictionary<string, List<IHanoiRow>>();
        readonly Dictionary<string, Dictionary<string, IHanoiRow>> byId = new Dictionary<string, Dictionary<string, IHanoiRow>>();
        readonly Dictionary<string, string> sourceOf = new Dictionary<string, string>();

        public static JsonSerializerSettings SerializerSettings() => new JsonSerializerSettings
        {
            MissingMemberHandling = MissingMemberHandling.Error,
            ObjectCreationHandling = ObjectCreationHandling.Replace,
            NullValueHandling = NullValueHandling.Ignore,
            FloatParseHandling = FloatParseHandling.Double,
        };

        readonly JsonSerializer serializer = JsonSerializer.Create(SerializerSettings());

        public IEnumerable<string> Collections => rows.Keys;

        public int Count(string collection) => rows.TryGetValue(collection, out var list) ? list.Count : 0;

        public int TotalRows => rows.Values.Sum(l => l.Count);

        /// <summary>Loads every *.json under dir in the same order as tools/codegen_ue.py (sorted paths).</summary>
        public static HanoiContentDatabase LoadDirectory(string dir)
        {
            if (!Directory.Exists(dir)) throw new DirectoryNotFoundException($"content folder {dir} not found");
            var db = new HanoiContentDatabase();
            var files = Directory.GetFiles(dir, "*.json", SearchOption.AllDirectories)
                .Select(p => p.Replace('\\', '/'))
                .OrderBy(p => p, StringComparer.Ordinal);
            foreach (var path in files)
            {
                db.LoadDocument(File.ReadAllText(path), path);
            }
            return db;
        }

        /// <summary>Adds one collection document {"collection": ..., "items": [...]}. Other JSON is ignored.</summary>
        public void LoadDocument(string json, string source)
        {
            JToken parsed;
            try
            {
                parsed = JToken.Parse(json);
            }
            catch (JsonReaderException e)
            {
                throw new InvalidDataException($"{source}: not valid JSON: {e.Message}", e);
            }
            if (!(parsed is JObject doc)) return;  // not a collection document (codegen_ue skips these too)
            var collection = (string)doc["collection"];
            if (collection == null) return;
            if (!HanoiCollections.RowTypes.TryGetValue(collection, out var type))
                throw new InvalidDataException($"{source}: unknown collection '{collection}'");
            if (!rows.TryGetValue(collection, out var list))
            {
                list = new List<IHanoiRow>();
                rows[collection] = list;
                byId[collection] = new Dictionary<string, IHanoiRow>();
            }
            var items = doc["items"] as JArray ?? new JArray();
            foreach (var item in items)
            {
                IHanoiRow row;
                try
                {
                    row = (IHanoiRow)item.ToObject(type, serializer);
                }
                catch (JsonException e)
                {
                    throw new InvalidDataException($"{source}: {collection} item {(string)item["id"]}: {e.Message}", e);
                }
                var key = collection + ":" + row.Id;
                if (byId[collection].ContainsKey(row.Id))
                    throw new InvalidDataException($"{key} defined in {sourceOf[key]} and {source}");
                byId[collection][row.Id] = row;
                sourceOf[key] = source;
                list.Add(row);
            }
        }

        public IReadOnlyList<T> All<T>(string collection) where T : class, IHanoiRow =>
            rows.TryGetValue(collection, out var list) ? list.Cast<T>().ToList() : new List<T>();

        public T Get<T>(string collection, string id) where T : class, IHanoiRow =>
            id != null && byId.TryGetValue(collection, out var table) && table.TryGetValue(id, out var row) ? row as T : null;

        public T Get<T>(HanoiRef r) where T : class, IHanoiRow => r == null ? null : Get<T>(r.Collection, r.Id);

        public bool Has(HanoiRef r) => r != null && byId.TryGetValue(r.Collection, out var t) && t.ContainsKey(r.Id);

        public HanoiMissionRow Mission(string id) => Get<HanoiMissionRow>("missions", id);
        public HanoiDialogueRow Dialogue(string id) => Get<HanoiDialogueRow>("dialogues", id);
        public HanoiCharacterRow Character(string id) => Get<HanoiCharacterRow>("characters", id);
        public HanoiTrafficRuleRow TrafficRule(string id) => Get<HanoiTrafficRuleRow>("traffic_rules", id);

        /// <summary>
        /// WGS84 point of a ref: landmarks.location, businesses.location, characters.home,
        /// districts.center, factions.base, collectibles.location, missions.start. Null if none.
        /// </summary>
        public HanoiGeo ResolveLocation(HanoiRef r)
        {
            if (r == null) return null;
            switch (r.Collection)
            {
                case "landmarks": return Get<HanoiLandmarkRow>(r)?.Location;
                case "businesses": return Get<HanoiBusinessRow>(r)?.Location;
                case "characters": return Get<HanoiCharacterRow>(r)?.Home;
                case "districts": return Get<HanoiDistrictRow>(r)?.Center;
                case "factions": return Get<HanoiFactionRow>(r)?.Base;
                case "collectibles": return Get<HanoiCollectiblesRow>(r)?.Location;
                case "missions": return Get<HanoiMissionRow>(r)?.Start;
                default: return null;
            }
        }
    }
}
