using System.IO;
using HanoiCity.City;
using HanoiCity.Geo;
using UnityEngine;

namespace HanoiCity.UnityLayer
{
    /// <summary>
    /// Loads out/&lt;city&gt;/traffic/graph.json (copied to StreamingAssets) for AI traffic and route
    /// finding, and draws it as gizmos (one-way edges blue, motorbike-only orange, signals red).
    /// Twin of AHanoiTrafficGraph.
    /// </summary>
    public sealed class HanoiTrafficGraphView : MonoBehaviour
    {
        public string graphFile = "Hanoi/City/traffic/graph.json";
        public bool drawGizmos = true;
        [Tooltip("Only draw edges within this distance of the scene camera (metres).")]
        public float gizmoRadiusM = 800f;

        public HanoiTrafficGraph Graph { get; private set; }

        public bool LoadGraph()
        {
            var path = Path.Combine(Application.streamingAssetsPath, graphFile);
            if (!File.Exists(path)) { Debug.LogWarning($"[HanoiCity] no traffic graph at {path}"); return false; }
            Graph = HanoiTrafficGraph.Parse(File.ReadAllText(path));
            Debug.Log($"[HanoiCity] traffic graph: {Graph.Nodes.Count} nodes, {Graph.Edges.Count} edges");
            return true;
        }

        void Awake() => LoadGraph();

        void OnDrawGizmos()
        {
            if (!drawGizmos) return;
            if (Graph == null && !LoadGraph()) return;
            var frame = HanoiFloatingOrigin.CurrentFrame;
            var cam = Camera.current != null ? Camera.current.transform.position : Vector3.zero;
            Vector3 U(double e, double n) { var u = frame.EnuToUnity(new Double3(e, n, 1.0)); return new Vector3((float)u.X, (float)u.Y, (float)u.Z); }
            foreach (var e in Graph.Edges)
            {
                if (e.Polyline.Count < 2) continue;
                var a0 = U(e.Polyline[0].x, e.Polyline[0].y);
                if ((a0 - cam).sqrMagnitude > gizmoRadiusM * gizmoRadiusM) continue;
                Gizmos.color = e.MotorbikeOnly ? new Color(1f, 0.55f, 0f) : e.Oneway ? Color.cyan : Color.white;
                for (int i = 1; i < e.Polyline.Count; ++i)
                    Gizmos.DrawLine(U(e.Polyline[i - 1].x, e.Polyline[i - 1].y), U(e.Polyline[i].x, e.Polyline[i].y));
            }
            Gizmos.color = Color.red;
            foreach (var n in Graph.Nodes)
            {
                if (!n.Signal) continue;
                var p = U(n.Position.X, n.Position.Y);
                if ((p - cam).sqrMagnitude <= gizmoRadiusM * gizmoRadiusM) Gizmos.DrawSphere(p, 1.5f);
            }
        }
    }
}
