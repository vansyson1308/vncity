using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using HanoiCity.City;
using HanoiCity.Content;
using HanoiCity.Geo;
using HanoiCity.UnityLayer;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace HanoiCity.EditorTools
{
    /// <summary>
    /// Tools > Hanoi City: the Unity twin of UE's setup_project.py / import_city.py /
    /// import_pcg_points.py / import_content.py. Run Full Setup = copy data -> validate content ->
    /// open/create the scene -> import and place tiles -> point sets -> traffic graph -> verify markers.
    /// Batch mode: Unity -batchmode -quit -projectPath unity -executeMethod HanoiCity.EditorTools.HanoiCitySetup.RunFullSetupBatch
    /// </summary>
    public static class HanoiCitySetup
    {
        const string Tag = "[HanoiCity]";
        static readonly (string label, double lat, double lon)[] VerifyPoints =
        {
            ("Thap Rua (Turtle Tower islet, Ho Guom)", 21.02781, 105.85231),
            ("Nha hat Lon (Opera House)", 21.02430, 105.85760),
            ("Nha tho Lon (St Joseph's Cathedral)", 21.02870, 105.84900),
        };

        [MenuItem("Tools/Hanoi City/Run Full Setup", priority = 0)]
        public static void RunFullSetup() => Run(HanoiSetupConfig.Load(), interactive: true);

        public static void RunFullSetupBatch()
        {
            try { Run(HanoiSetupConfig.Load(), interactive: false); }
            catch (Exception e) { Debug.LogException(e); EditorApplication.Exit(1); }
        }

        static void Run(HanoiSetupConfig cfg, bool interactive)
        {
            CopyRuntimeData(cfg);
            ValidateContent(cfg);
            var manifest = LoadManifest(cfg);
            OpenOrCreateScene(cfg);
            var frame = new HanoiGeoFrame(manifest.OriginLat, manifest.OriginLon, manifest.OriginHeightM);
            int tiles = ImportTiles(cfg, manifest, frame, interactive);
            int points = SpawnPointSets(cfg);
            EnsureTrafficGraph();
            int markers = SpawnVerifyMarkers(cfg, frame);
            EditorSceneManager.SaveOpenScenes();
            Debug.Log($"{Tag} Run Full Setup done: {tiles} tile objects, {points} point sets, {markers} verify markers. Scene {cfg.Scene}");
        }

        // ------------------------------------------------------------------ data

        [MenuItem("Tools/Hanoi City/Copy Runtime Data")]
        public static void CopyRuntimeDataMenu() => CopyRuntimeData(HanoiSetupConfig.Load());

        /// <summary>game/content, pipeline/districts.json and the city's runtime files into StreamingAssets/Hanoi.</summary>
        public static void CopyRuntimeData(HanoiSetupConfig cfg)
        {
            var dest = cfg.Abs(cfg.StreamingDest);
            var content = Path.Combine(dest, "Content");
            if (Directory.Exists(content)) Directory.Delete(content, true);
            int n = 0;
            foreach (var src in Directory.GetFiles(cfg.GameContent, "*.json", SearchOption.AllDirectories))
            {
                var rel = Path.GetRelativePath(cfg.GameContent, src);
                var to = Path.Combine(content, rel);
                Directory.CreateDirectory(Path.GetDirectoryName(to));
                File.Copy(src, to, true);
                n++;
            }
            if (File.Exists(cfg.PipelineDistricts)) File.Copy(cfg.PipelineDistricts, Path.Combine(dest, "districts.json"), true);
            var city = Path.Combine(dest, "City");
            var copied = new List<string>();
            foreach (var rel in new[] { "manifest.json", "traffic/graph.json", "places/pois.json", "districts.geojson" })
            {
                var src = Path.Combine(cfg.CityBuild, rel);
                if (!File.Exists(src)) continue;
                var to = Path.Combine(city, rel);
                Directory.CreateDirectory(Path.GetDirectoryName(to));
                File.Copy(src, to, true);
                copied.Add(rel);
            }
            var pcg = Path.Combine(cfg.CityBuild, "pcg");
            if (Directory.Exists(pcg))
            {
                Directory.CreateDirectory(Path.Combine(city, "pcg"));
                foreach (var csv in Directory.GetFiles(pcg, "*.csv"))
                {
                    File.Copy(csv, Path.Combine(city, "pcg", Path.GetFileName(csv)), true);
                    copied.Add("pcg/" + Path.GetFileName(csv));
                }
            }
            AssetDatabase.Refresh();
            Debug.Log($"{Tag} {n} content files and [{string.Join(", ", copied)}] copied to {dest}");
        }

        [MenuItem("Tools/Hanoi City/Validate Content")]
        public static void ValidateContentMenu() => ValidateContent(HanoiSetupConfig.Load());

        /// <summary>Strict load into the generated classes (the same check dotnet test runs in CI).</summary>
        public static HanoiContentDatabase ValidateContent(HanoiSetupConfig cfg)
        {
            var db = HanoiContentDatabase.LoadDirectory(Path.Combine(cfg.Abs(cfg.StreamingDest), "Content"));
            Debug.Log($"{Tag} content OK: {db.TotalRows} rows in {db.Collections.Count()} collections");
            return db;
        }

        static HanoiCityManifest LoadManifest(HanoiSetupConfig cfg)
        {
            var path = Path.Combine(cfg.CityBuild, "manifest.json");
            if (!File.Exists(path)) throw new FileNotFoundException($"{path} not found; run the pipeline (build.py / run_districts.py) or pass -hanoiCity");
            return HanoiCityManifest.Parse(File.ReadAllText(path));
        }

        // ------------------------------------------------------------------ scene

        static void OpenOrCreateScene(HanoiSetupConfig cfg)
        {
            if (File.Exists(cfg.Abs(cfg.Scene))) EditorSceneManager.OpenScene(cfg.Scene);
            else
            {
                var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);
                Directory.CreateDirectory(Path.GetDirectoryName(cfg.Abs(cfg.Scene)));
                EditorSceneManager.SaveScene(scene, cfg.Scene);
            }
            var game = UnityEngine.Object.FindAnyObjectByType<HanoiGame>() ?? new GameObject("HanoiGame").AddComponent<HanoiGame>();
            if (game.GetComponent<HanoiFloatingOrigin>() == null) game.gameObject.AddComponent<HanoiFloatingOrigin>();

            var sunLight = UnityEngine.Object.FindObjectsByType<Light>(FindObjectsSortMode.None).FirstOrDefault(l => l.type == LightType.Directional);
            if (sunLight == null) { sunLight = new GameObject("Sun").AddComponent<Light>(); sunLight.type = LightType.Directional; }
            if (sunLight.GetComponent<HanoiSunDriver>() == null) sunLight.gameObject.AddComponent<HanoiSunDriver>();

            var player = UnityEngine.Object.FindAnyObjectByType<HanoiPlayerAdapter>();
            if (player == null)
            {
                var go = GameObject.CreatePrimitive(PrimitiveType.Capsule);
                go.name = "Player (placeholder)";
                UnityEngine.Object.DestroyImmediate(go.GetComponent<Collider>());
                go.AddComponent<CharacterController>();
                player = go.AddComponent<HanoiPlayerAdapter>();
                go.transform.position = new Vector3(-9.4f, 1.0f, -109.6f);  // Tháp Rùa shore, ENU (-9.36, -109.61)
            }
            game.player = player;
            var fo = game.GetComponent<HanoiFloatingOrigin>();
            fo.tracked = player.transform;
            var cam = Camera.main;
            if (cam != null && !fo.unanchoredRoots.Contains(cam.transform)) fo.unanchoredRoots.Add(cam.transform);
            EditorSceneManager.MarkSceneDirty(game.gameObject.scene);
        }

        static Transform Folder(string path)
        {
            Transform parent = null;
            foreach (var part in path.Split('/'))
            {
                var found = parent == null
                    ? UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects().FirstOrDefault(g => g.name == part)?.transform
                    : parent.Find(part);
                if (found == null)
                {
                    found = new GameObject(part).transform;
                    found.SetParent(parent, false);
                }
                parent = found;
            }
            return parent;
        }

        static void ClearFolder(string path)
        {
            var f = Folder(path);
            for (int i = f.childCount - 1; i >= 0; --i) UnityEngine.Object.DestroyImmediate(f.GetChild(i).gameObject);
        }

        // ------------------------------------------------------------------ tiles

        [MenuItem("Tools/Hanoi City/Import City Tiles")]
        public static void ImportTilesMenu()
        {
            var cfg = HanoiSetupConfig.Load();
            var m = LoadManifest(cfg);
            ImportTiles(cfg, m, new HanoiGeoFrame(m.OriginLat, m.OriginLon, m.OriginHeightM), true);
        }

        /// <summary>Expected ENU plan box of a tile's buildings (import_city.tile_expected_box).</summary>
        public static PlanBox? ExpectedTileBox(HanoiSetupConfig cfg, HanoiGeoFrame frame, HanoiTileEntry t)
        {
            var fp = Path.Combine(cfg.CityBuild, "semantics", $"footprints_{t.Ix}_{t.Iy}.json");
            if (File.Exists(fp))
            {
                var outlines = JObject.Parse(File.ReadAllText(fp))["buildings"]?.Select(b => b["outline"] as JArray).Where(o => o != null && o.Count > 0).ToList();
                if (outlines != null && outlines.Count >= 8)
                {
                    var vs = outlines.SelectMany(o => o).Select(v => ((double)v[0], (double)v[1])).ToList();
                    return new PlanBox(vs.Min(v => v.Item1), vs.Max(v => v.Item1), vs.Min(v => v.Item2), vs.Max(v => v.Item2));
                }
            }
            var bld = Path.Combine(cfg.CityBuild, "tiles", $"bld_{t.Ix}_{t.Iy}.json");
            if (!File.Exists(bld)) return null;
            var pts = JObject.Parse(File.ReadAllText(bld))["buildings"]?
                .Where(b => b["lat"] != null && b["lon"] != null)
                .Select(b => frame.GeoToEnu((double)b["lat"], (double)b["lon"])).ToList();
            if (pts == null || pts.Count < 8) return null;
            const double pad = 8.0;  // centroids are inside the footprints
            return new PlanBox(pts.Min(p => p.X) - pad, pts.Max(p => p.X) + pad, pts.Min(p => p.Y) - pad, pts.Max(p => p.Y) + pad);
        }

        /// <summary>Plan box (x, z) of every mesh under root, in root-local space.</summary>
        public static PlanBox? MeasureLocalPlan(GameObject root)
        {
            var toRoot = root.transform.worldToLocalMatrix;
            bool any = false;
            double x0 = double.MaxValue, x1 = double.MinValue, z0 = double.MaxValue, z1 = double.MinValue;
            foreach (var mf in root.GetComponentsInChildren<MeshFilter>(true))
            {
                if (mf.sharedMesh == null) continue;
                var b = mf.sharedMesh.bounds;
                var m = toRoot * mf.transform.localToWorldMatrix;
                for (int i = 0; i < 8; ++i)
                {
                    var c = m.MultiplyPoint3x4(new Vector3(
                        (i & 1) == 0 ? b.min.x : b.max.x, (i & 2) == 0 ? b.min.y : b.max.y, (i & 4) == 0 ? b.min.z : b.max.z));
                    x0 = Math.Min(x0, c.x); x1 = Math.Max(x1, c.x); z0 = Math.Min(z0, c.z); z1 = Math.Max(z1, c.z);
                    any = true;
                }
            }
            return any ? new PlanBox(x0, x1, z0, z1) : (PlanBox?)null;
        }

        public static int ImportTiles(HanoiSetupConfig cfg, HanoiCityManifest manifest, HanoiGeoFrame frame, bool interactive)
        {
            var tiles = manifest.TilesByDistance().ToList();
            if (cfg.MaxTiles > 0) tiles = tiles.Take(cfg.MaxTiles).ToList();
            ClearFolder("City/Buildings");
            ClearFolder("City/Roads");
            var imported = new List<(string kind, HanoiTileEntry t, GameObject prefab)>();
            try
            {
                AssetDatabase.StartAssetEditing();
                foreach (var t in tiles)
                    foreach (var kind in new[] { "bld", "road" })
                    {
                        if (kind == "road" && !cfg.ImportRoads) continue;
                        var file = $"{kind}_{t.Ix}_{t.Iy}.glb";
                        if (!t.Has(file)) continue;
                        var dest = $"{cfg.TilesDest}/{t.Key.Replace('-', 'm')}/{file}";
                        Directory.CreateDirectory(Path.GetDirectoryName(cfg.Abs(dest)));
                        File.Copy(Path.Combine(cfg.CityBuild, "tiles", file), cfg.Abs(dest), true);
                    }
            }
            finally { AssetDatabase.StopAssetEditing(); }
            AssetDatabase.Refresh();  // glTFast's importer turns each .glb into a prefab-like asset

            for (int i = 0; i < tiles.Count; ++i)
            {
                var t = tiles[i];
                if (interactive && EditorUtility.DisplayCancelableProgressBar("Hanoi City", $"tile {t.Key}", i / (float)tiles.Count)) break;
                foreach (var kind in new[] { "bld", "road" })
                {
                    var asset = AssetDatabase.LoadAssetAtPath<GameObject>($"{cfg.TilesDest}/{t.Key.Replace('-', 'm')}/{kind}_{t.Ix}_{t.Iy}.glb");
                    if (asset != null) imported.Add((kind, t, asset));
                }
            }
            if (interactive) EditorUtility.ClearProgressBar();

            // Calibrate the importer's axis convention on up to 16 building tiles (import_city.calibrate).
            var samples = new List<HanoiTilePlacement.Sample>();
            foreach (var (kind, t, prefab) in imported)
            {
                if (kind != "bld" || samples.Count >= 16) continue;
                var expected = ExpectedTileBox(cfg, frame, t);
                var measured = MeasureLocalPlan(prefab);
                if (expected == null || measured == null) continue;
                samples.Add(new HanoiTilePlacement.Sample
                {
                    MeasuredLocal = measured.Value, ExpectedEnu = expected.Value,
                    TileOriginEast = t.OriginX, TileOriginNorth = t.OriginY,
                });
            }
            TileMapping mapping;
            if (samples.Count == 0)
            {
                mapping = HanoiTilePlacement.Candidates().First();
                Debug.LogWarning($"{Tag} no tile suitable for axis calibration; assuming the glTFast mapping {mapping}");
            }
            else
            {
                var sol = HanoiTilePlacement.Solve(samples);
                mapping = sol.Mapping;
                var msg = $"{Tag} tile axes: {mapping} (IoU {string.Join(", ", sol.Scores.Select(s => s.ToString("0.00")))}; runner-up {sol.RunnerUp} {sol.RunnerUpTotal:0.00} vs {sol.Total:0.00})";
                if (sol.Ambiguous) Debug.LogWarning(msg + " AMBIGUOUS: check the verify markers against the buildings");
                else Debug.Log(msg);
            }

            int count = 0;
            foreach (var (kind, t, prefab) in imported)
            {
                var p = HanoiTilePlacement.Place(mapping, t.OriginX, t.OriginY);
                var parent = Folder(kind == "bld" ? "City/Buildings" : "City/Roads");
                var anchorGo = new GameObject($"{kind}_{t.Ix}_{t.Iy}");
                anchorGo.transform.SetParent(parent, false);
                anchorGo.isStatic = true;
                var anchor = anchorGo.AddComponent<HanoiGeoAnchor>();
                anchor.Enu = new Double3(p.OffsetEast, p.OffsetNorth, 0);
                var inst = (GameObject)PrefabUtility.InstantiatePrefab(prefab, anchorGo.transform);
                inst.transform.localRotation = Quaternion.Euler(0f, (float)p.YawDeg, 0f);
                inst.transform.localScale = new Vector3(1f, 1f, (float)p.ScaleZ);
                foreach (var tr in inst.GetComponentsInChildren<Transform>(true)) tr.gameObject.isStatic = true;
                anchor.Apply(null);
                count++;
            }
            Debug.Log($"{Tag} placed {count} tile objects from {tiles.Count} tiles");
            return count;
        }

        // ------------------------------------------------------------------ points

        [MenuItem("Tools/Hanoi City/Import PCG Points")]
        public static void SpawnPointSetsMenu() => SpawnPointSets(HanoiSetupConfig.Load());

        /// <summary>One HanoiPointSetRenderer per (Set, Kind, Tile, variant prefab) with a prefab in hanoi_asset_map.json.</summary>
        public static int SpawnPointSets(HanoiSetupConfig cfg)
        {
            ClearFolder("City/Points");
            var map = File.Exists(cfg.AssetMap) ? JObject.Parse(File.ReadAllText(cfg.AssetMap)) : new JObject();
            var pcgDir = Path.Combine(cfg.Abs(cfg.StreamingDest), "City", "pcg");
            if (!Directory.Exists(pcgDir)) return 0;
            int spawned = 0;
            var skipped = new SortedDictionary<string, int>();
            foreach (var csv in Directory.GetFiles(pcgDir, "*.csv").OrderBy(p => p))
            {
                var rel = "Hanoi/City/pcg/" + Path.GetFileName(csv);
                var rows = HanoiPointSetRenderer.ReadCsv(rel);
                foreach (var g in rows.GroupBy(r => (r.Set, r.Kind, r.Tile)).OrderBy(g => g.Key))
                {
                    var entry = (map[$"{g.Key.Set}/{g.Key.Kind}"] ?? map[$"{g.Key.Set}/*"]) as JObject;
                    var prefabs = entry == null ? new List<string>()
                        : ((entry["prefabs"] as JArray)?.Select(x => (string)x).Where(x => !string.IsNullOrEmpty(x)).ToList() ?? new List<string>());
                    if (prefabs.Count == 0 && !string.IsNullOrEmpty((string)entry?["prefab"])) prefabs.Add((string)entry["prefab"]);
                    if (prefabs.Count == 0)
                    {
                        var k = $"{g.Key.Set}/{g.Key.Kind}";
                        skipped[k] = (skipped.TryGetValue(k, out var c) ? c : 0) + g.Count();
                        continue;
                    }
                    for (int v = 0; v < prefabs.Count; ++v)
                    {
                        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(prefabs[v]);
                        var mf = prefab != null ? prefab.GetComponentInChildren<MeshFilter>() : null;
                        var mr = prefab != null ? prefab.GetComponentInChildren<MeshRenderer>() : null;
                        if (mf == null || mr == null) { Debug.LogWarning($"{Tag} {g.Key.Set}/{g.Key.Kind}: {prefabs[v]} has no MeshFilter/MeshRenderer"); continue; }
                        var go = new GameObject($"{g.Key.Set}_{g.Key.Kind}_{g.Key.Tile}" + (prefabs.Count > 1 ? $"_v{v}" : ""));
                        go.transform.SetParent(Folder("City/Points/" + g.Key.Set), false);
                        var r = go.AddComponent<HanoiPointSetRenderer>();
                        r.csvFile = rel; r.set = g.Key.Set; r.kind = g.Key.Kind; r.tile = g.Key.Tile;
                        r.variantIndex = v; r.variantCount = prefabs.Count;
                        r.mesh = mf.sharedMesh; r.materials = mr.sharedMaterials;
                        foreach (var mat in r.materials) if (mat != null && !mat.enableInstancing) { mat.enableInstancing = true; EditorUtility.SetDirty(mat); }
                        r.scale = (float?)entry["scale"] ?? 1f;
                        r.scaleAxes = (string)entry["scale_axes"] ?? "xyz";
                        r.yawOffsetDeg = (float?)entry["yaw_offset_deg"] ?? 0f;
                        r.cullDistanceM = (float?)entry["cull_distance_m"] ?? 0f;
                        spawned++;
                    }
                }
            }
            if (skipped.Count > 0)
                Debug.Log($"{Tag} no prefab mapped yet (fill {cfg.AssetMap}): " + string.Join(", ", skipped.Select(kv => $"{kv.Key}={kv.Value}")));
            Debug.Log($"{Tag} spawned {spawned} point-set renderers");
            return spawned;
        }

        // ------------------------------------------------------------------ traffic, markers

        static void EnsureTrafficGraph()
        {
            var view = UnityEngine.Object.FindAnyObjectByType<HanoiTrafficGraphView>();
            if (view == null)
            {
                view = new GameObject("HanoiTrafficGraph").AddComponent<HanoiTrafficGraphView>();
                view.transform.SetParent(Folder("City/Systems"), false);
            }
            if (!view.LoadGraph()) Debug.LogWarning($"{Tag} traffic graph failed to load");
        }

        [MenuItem("Tools/Hanoi City/Spawn Verify Markers")]
        public static void SpawnVerifyMarkersMenu() => SpawnVerifyMarkers(HanoiSetupConfig.Load(), new HanoiGeoFrame());

        /// <summary>Text markers at known WGS84 points and every content landmark, to eyeball the georeference.</summary>
        public static int SpawnVerifyMarkers(HanoiSetupConfig cfg, HanoiGeoFrame frame)
        {
            ClearFolder("City/Verify");
            var points = VerifyPoints.ToList();
            var dbDir = Path.Combine(cfg.Abs(cfg.StreamingDest), "Content");
            if (Directory.Exists(dbDir))
            {
                var db = HanoiContentDatabase.LoadDirectory(dbDir);
                foreach (var lm in db.All<HanoiLandmarkRow>("landmarks"))
                    if (lm.Location != null) points.Add((lm.DisplayName?.Vi ?? lm.Id, lm.Location.Lat, lm.Location.Lon));
            }
            var parent = Folder("City/Verify");
            foreach (var (label, lat, lon) in points)
            {
                var go = new GameObject("Verify_" + (label.Length > 40 ? label.Substring(0, 40) : label));
                go.transform.SetParent(parent, false);
                var anchor = go.AddComponent<HanoiGeoAnchor>();
                var enu = frame.GeoToEnu(lat, lon);
                anchor.Enu = new Double3(enu.X, enu.Y, 40.0);
                var text = go.AddComponent<TextMesh>();
                text.text = label;
                text.characterSize = 2f;
                text.fontSize = 64;
                text.anchor = TextAnchor.MiddleCenter;
                anchor.Apply(frame);
                Debug.Log($"{Tag} verify marker {label}: lat/lon {lat:0.00000},{lon:0.00000} -> ENU {enu.X:0},{enu.Y:0}");
            }
            return points.Count;
        }
    }
}
