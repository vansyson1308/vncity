using System.Collections.Generic;
using System.IO;
using HanoiCity.City;
using HanoiCity.Geo;
using UnityEngine;
using UnityEngine.Rendering;

namespace HanoiCity.UnityLayer
{
    /// <summary>
    /// GPU-instanced props for one (Set, Kind, Tile, variant) of out/&lt;city&gt;/pcg/&lt;set&gt;.csv: street trees,
    /// poles, cables, signs, awnings, parked motorbikes, pavement stools. The twin of UE's
    /// AHanoiPointSetActor (HISM). Rows are read at runtime from StreamingAssets (2.47M points for the
    /// whole city do not belong in a scene file) and drawn with Graphics.RenderMeshInstanced in
    /// batches of 1023, culled per batch by distance. Transform per row, matching UE:
    /// position = ENU (X, Y, Z); yaw = -Yaw + yawOffsetDeg about +Y; scale = Scale * scale on the axes in
    /// scaleAxes, scale on the others. Rebuilt after every floating-origin shift.
    /// </summary>
    [AddComponentMenu("Hanoi City/Point Set Renderer")]
    public sealed class HanoiPointSetRenderer : MonoBehaviour
    {
        public string csvFile = "Hanoi/City/pcg/street_trees.csv";
        public string set = "", kind = "", tile = "";
        [Tooltip("Rows with Variant % variantCount == variantIndex.")]
        public int variantIndex, variantCount = 1;
        public Mesh mesh;
        public Material[] materials;
        public float scale = 1f;
        public string scaleAxes = "xyz";
        public float yawOffsetDeg;
        [Tooltip("0 = never culled.")]
        public float cullDistanceM = 300f;
        public ShadowCastingMode shadows = ShadowCastingMode.On;

        static readonly Dictionary<string, List<HanoiPcgPoint>> csvCache = new Dictionary<string, List<HanoiPcgPoint>>();
        const int BatchSize = 1023;

        readonly List<Matrix4x4[]> batches = new List<Matrix4x4[]>();
        readonly List<int> batchCounts = new List<int>();
        readonly List<Bounds> batchBounds = new List<Bounds>();
        List<HanoiPcgPoint> rows = new List<HanoiPcgPoint>();

        public int InstanceCount => rows.Count;

        public static List<HanoiPcgPoint> ReadCsv(string streamingRelative)
        {
            if (csvCache.TryGetValue(streamingRelative, out var cached)) return cached;
            var path = Path.Combine(Application.streamingAssetsPath, streamingRelative);
            var list = new List<HanoiPcgPoint>();
            if (File.Exists(path))
                using (var r = new StreamReader(path)) list = HanoiPcgCsv.Read(r);
            else
                Debug.LogWarning($"[HanoiCity] point CSV {path} not found");
            csvCache[streamingRelative] = list;
            return list;
        }

        void OnEnable()
        {
            rows = new List<HanoiPcgPoint>();
            foreach (var p in ReadCsv(csvFile))
                if (p.Set == set && (kind == "*" || p.Kind == kind) && (string.IsNullOrEmpty(tile) || p.Tile == tile)
                    && (variantCount <= 1 || ((p.Variant % variantCount) + variantCount) % variantCount == variantIndex))
                    rows.Add(p);
            Rebuild();
            HanoiFloatingOrigin.Shifted += OnShifted;
        }

        void OnDisable() => HanoiFloatingOrigin.Shifted -= OnShifted;

        void OnShifted(Vector3 delta) => Rebuild();

        public void Rebuild()
        {
            batches.Clear(); batchCounts.Clear(); batchBounds.Clear();
            var frame = HanoiFloatingOrigin.CurrentFrame;
            for (int start = 0; start < rows.Count; start += BatchSize)
            {
                int n = Mathf.Min(BatchSize, rows.Count - start);
                var m = new Matrix4x4[n];
                var b = new Bounds();
                for (int i = 0; i < n; ++i)
                {
                    var p = rows[start + i];
                    var u = frame.EnuToUnity(new Double3(p.X, p.Y, p.Z));
                    var pos = new Vector3((float)u.X, (float)u.Y, (float)u.Z);
                    float s = p.Scale > 0 ? p.Scale : 1f;
                    // scale_axes name UE mesh axes (x forward, y side, z up); in Unity the side is z and up is y.
                    var sc = new Vector3(Axis('x', s), Axis('z', s), Axis('y', s));
                    var rot = Quaternion.Euler(0f, (float)HanoiGeoFrame.EnuYawToUnityYaw(p.Yaw) + yawOffsetDeg, 0f);
                    m[i] = Matrix4x4.TRS(pos, rot, sc);
                    if (i == 0) b = new Bounds(pos, Vector3.one * 10f); else b.Encapsulate(pos);
                }
                b.Expand(20f);
                batches.Add(m); batchCounts.Add(n); batchBounds.Add(b);
            }
        }

        float Axis(char enuAxis, float rowScale) => scaleAxes.IndexOf(enuAxis) >= 0 ? scale * rowScale : scale;

        void Update()
        {
            if (mesh == null || materials == null || materials.Length == 0 || batches.Count == 0) return;
            var cam = Camera.main;
            var camPos = cam != null ? cam.transform.position : Vector3.zero;
            for (int bi = 0; bi < batches.Count; ++bi)
            {
                if (cullDistanceM > 0 && batchBounds[bi].SqrDistance(camPos) > cullDistanceM * cullDistanceM) continue;
                for (int sub = 0; sub < mesh.subMeshCount; ++sub)
                {
                    var mat = materials[Mathf.Min(sub, materials.Length - 1)];
                    if (mat == null) continue;
                    var rp = new RenderParams(mat) { shadowCastingMode = shadows, receiveShadows = true, worldBounds = batchBounds[bi], layer = gameObject.layer };
                    Graphics.RenderMeshInstanced(rp, mesh, sub, batches[bi], batchCounts[bi]);
                }
            }
        }
    }
}
