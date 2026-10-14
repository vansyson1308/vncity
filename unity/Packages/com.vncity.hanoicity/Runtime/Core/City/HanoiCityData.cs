using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using HanoiCity.Geo;
using Newtonsoft.Json.Linq;

namespace HanoiCity.City
{
    /// <summary>out/&lt;city&gt;/manifest.json (build.py): georeference and tile index.</summary>
    public sealed class HanoiCityManifest
    {
        public string Name;
        public double OriginLat, OriginLon, OriginHeightM;
        public double TileSizeM;
        public List<HanoiTileEntry> Tiles = new List<HanoiTileEntry>();

        public static HanoiCityManifest Parse(string json)
        {
            var o = JObject.Parse(json);
            var g = o["georeference"];
            var m = new HanoiCityManifest
            {
                Name = (string)o["name"],
                OriginLat = (double)g["origin_lat"],
                OriginLon = (double)g["origin_lon"],
                OriginHeightM = (double?)g["origin_height_m"] ?? 0.0,
                TileSizeM = (double)o["tile_size_m"],
            };
            foreach (var t in (JArray)o["tiles"] ?? new JArray())
            {
                m.Tiles.Add(new HanoiTileEntry
                {
                    Ix = (int)t["key"][0],
                    Iy = (int)t["key"][1],
                    OriginX = (double)t["origin_m"][0],
                    OriginY = (double)t["origin_m"][1],
                    Files = t["files"]?.Select(f => (string)f).ToList() ?? new List<string>(),
                });
            }
            return m;
        }

        /// <summary>Tiles nearest the origin first (what --max-tiles keeps).</summary>
        public IEnumerable<HanoiTileEntry> TilesByDistance() =>
            Tiles.OrderBy(t => Math.Sqrt(Math.Pow(t.OriginX + TileSizeM / 2, 2) + Math.Pow(t.OriginY + TileSizeM / 2, 2)));
    }

    public sealed class HanoiTileEntry
    {
        public int Ix, Iy;
        /// <summary>South-west corner, ENU metres.</summary>
        public double OriginX, OriginY;
        public List<string> Files = new List<string>();

        public string Key => $"{Ix}_{Iy}";
        public bool Has(string file) => Files.Contains(file);
    }

    /// <summary>One row of out/&lt;city&gt;/pcg/&lt;set&gt;.csv (docs/pipeline-outputs.md). ENU metres, yaw CCW from east.</summary>
    public struct HanoiPcgPoint
    {
        public string Name;
        public double X, Y, Z;
        public float Yaw, Scale;
        public string Set, Kind;
        public int Variant;
        /// <summary>Spans uint32 in the pipeline.</summary>
        public long Seed;
        public string Tile, Ref;
    }

    public static class HanoiPcgCsv
    {
        public static readonly string[] Header = { "Name", "X", "Y", "Z", "Yaw", "Scale", "Set", "Kind", "Variant", "Seed", "Tile", "Ref" };

        /// <summary>Reads a point set. Fields never contain commas except Ref, which may be quoted.</summary>
        public static List<HanoiPcgPoint> Read(TextReader reader)
        {
            var points = new List<HanoiPcgPoint>();
            var header = SplitCsv(reader.ReadLine() ?? "");
            var col = new Dictionary<string, int>();
            for (int i = 0; i < header.Count; ++i) col[header[i].Trim()] = i;
            foreach (var h in Header)
                if (!col.ContainsKey(h)) throw new InvalidDataException($"PCG csv lacks column {h}");
            string line;
            var inv = CultureInfo.InvariantCulture;
            while ((line = reader.ReadLine()) != null)
            {
                if (line.Length == 0) continue;
                var f = SplitCsv(line);
                string Get(string k) => col[k] < f.Count ? f[col[k]] : "";
                points.Add(new HanoiPcgPoint
                {
                    Name = Get("Name"),
                    X = double.Parse(Get("X"), inv), Y = double.Parse(Get("Y"), inv), Z = double.Parse(Get("Z"), inv),
                    Yaw = float.Parse(Get("Yaw"), inv), Scale = float.Parse(Get("Scale"), inv),
                    Set = Get("Set"), Kind = Get("Kind"),
                    Variant = int.Parse(Get("Variant"), inv), Seed = long.Parse(Get("Seed"), inv),
                    Tile = Get("Tile"), Ref = Get("Ref"),
                });
            }
            return points;
        }

        static List<string> SplitCsv(string line)
        {
            var out_ = new List<string>();
            var cur = new System.Text.StringBuilder();
            bool quoted = false;
            for (int i = 0; i < line.Length; ++i)
            {
                char c = line[i];
                if (quoted)
                {
                    if (c == '"' && i + 1 < line.Length && line[i + 1] == '"') { cur.Append('"'); ++i; }
                    else if (c == '"') quoted = false;
                    else cur.Append(c);
                }
                else if (c == '"') quoted = true;
                else if (c == ',') { out_.Add(cur.ToString()); cur.Clear(); }
                else cur.Append(c);
            }
            out_.Add(cur.ToString());
            return out_;
        }
    }

    /// <summary>traffic/graph.json: drivable road graph with A* routing (twin of AHanoiTrafficGraph).</summary>
    public sealed class HanoiTrafficGraph
    {
        public sealed class Node { public int Id; public Double3 Position; public bool Signal; }

        public sealed class Edge
        {
            public int Id, From, To, Lanes;
            public string RoadId, Name, Class;
            public bool Oneway, MotorbikeOnly;
            public double WidthM, SpeedKmh, LengthM;
            public List<(double x, double y)> Polyline = new List<(double, double)>();
        }

        public readonly List<Node> Nodes = new List<Node>();
        public readonly List<Edge> Edges = new List<Edge>();
        readonly Dictionary<int, int> indexOfNode = new Dictionary<int, int>();
        readonly Dictionary<int, List<(int edge, int to)>> adjacency = new Dictionary<int, List<(int, int)>>();
        readonly HashSet<int> blockedEdges = new HashSet<int>();
        readonly Dictionary<int, double> edgeSpeedFactors = new Dictionary<int, double>();

        /// <summary>Flooded or closed (FloodSystem): routing skips the edge. Index into Edges.</summary>
        public void SetEdgeBlocked(int edgeIndex, bool blocked)
        {
            if (blocked) blockedEdges.Add(edgeIndex); else blockedEdges.Remove(edgeIndex);
        }

        /// <summary>Slowed by water: the edge costs length / factor (clamped 0.05-1; 1 removes the override).</summary>
        public void SetEdgeSpeedFactor(int edgeIndex, double factor)
        {
            factor = Math.Max(0.05, Math.Min(1.0, factor));
            if (factor >= 1.0) edgeSpeedFactors.Remove(edgeIndex); else edgeSpeedFactors[edgeIndex] = factor;
        }

        public void ClearEdgeOverrides()
        {
            blockedEdges.Clear();
            edgeSpeedFactors.Clear();
        }

        public bool IsEdgeBlocked(int edgeIndex) => blockedEdges.Contains(edgeIndex);

        public double EdgeSpeedFactor(int edgeIndex) => edgeSpeedFactors.TryGetValue(edgeIndex, out var f) ? f : 1.0;

        /// <summary>Middle polyline vertex, else the midpoint of the end nodes (ENU metres).</summary>
        public Double3 EdgeMidpoint(int edgeIndex)
        {
            var e = Edges[edgeIndex];
            if (e.Polyline.Count > 0)
            {
                var p = e.Polyline[e.Polyline.Count / 2];
                return new Double3(p.x, p.y, 0);
            }
            var a = NodeById(e.From).Position;
            var b = NodeById(e.To).Position;
            return new Double3((a.X + b.X) / 2, (a.Y + b.Y) / 2, (a.Z + b.Z) / 2);
        }

        public static HanoiTrafficGraph Parse(string json)
        {
            var o = JObject.Parse(json);
            var g = new HanoiTrafficGraph();
            foreach (var n in (JArray)o["nodes"])
            {
                var node = new Node
                {
                    Id = (int)n["id"],
                    Position = new Double3((double)n["x"], (double)n["y"], (double?)n["z"] ?? 0.0),
                    Signal = (bool?)n["signal"] ?? false,
                };
                g.indexOfNode[node.Id] = g.Nodes.Count;
                g.Nodes.Add(node);
            }
            foreach (var e in (JArray)o["edges"])
            {
                var edge = new Edge
                {
                    Id = (int)e["id"], From = (int)e["from"], To = (int)e["to"],
                    RoadId = (string)e["road_id"], Name = (string)e["name"], Class = (string)e["class"],
                    Oneway = (bool?)e["oneway"] ?? false, Lanes = (int?)e["lanes"] ?? 1,
                    WidthM = (double?)e["width_m"] ?? 0, SpeedKmh = (double?)e["speed_kmh"] ?? 30,
                    MotorbikeOnly = (bool?)e["motorbike_only"] ?? false, LengthM = (double?)e["length_m"] ?? 0,
                };
                foreach (var p in (JArray)e["polyline"] ?? new JArray()) edge.Polyline.Add(((double)p[0], (double)p[1]));
                if (!g.indexOfNode.ContainsKey(edge.From) || !g.indexOfNode.ContainsKey(edge.To))
                    throw new InvalidDataException($"edge {edge.Id} references a missing node");
                int ei = g.Edges.Count;
                g.Edges.Add(edge);
                g.Link(edge.From, ei, edge.To);
                if (!edge.Oneway) g.Link(edge.To, ei, edge.From);
            }
            return g;
        }

        void Link(int from, int edge, int to)
        {
            if (!adjacency.TryGetValue(from, out var list)) adjacency[from] = list = new List<(int, int)>();
            list.Add((edge, to));
        }

        public Node NodeById(int id) => indexOfNode.TryGetValue(id, out var i) ? Nodes[i] : null;

        public Node Nearest(Double3 enu)
        {
            Node best = null;
            double bestD = double.MaxValue;
            foreach (var n in Nodes)
            {
                double d = Double3.PlanDistance(n.Position, enu);
                if (d < bestD) { bestD = d; best = n; }
            }
            return best;
        }

        /// <summary>Shortest path by length (A*, straight-line heuristic). Node ids, empty if unreachable. motorbike=false skips motorbike_only edges; blocked edges are skipped and slowed ones cost length / factor.</summary>
        public List<int> FindPath(int fromNode, int toNode, bool motorbike = true)
        {
            var goal = NodeById(toNode);
            if (NodeById(fromNode) == null || goal == null) return new List<int>();
            var g = new Dictionary<int, double> { [fromNode] = 0 };
            var came = new Dictionary<int, int>();
            var open = new SortedSet<(double f, int id)> { (Double3.PlanDistance(NodeById(fromNode).Position, goal.Position), fromNode) };
            var closed = new HashSet<int>();
            while (open.Count > 0)
            {
                var cur = open.Min;
                open.Remove(cur);
                if (cur.id == toNode) break;
                if (!closed.Add(cur.id)) continue;
                if (!adjacency.TryGetValue(cur.id, out var next)) continue;
                foreach (var (ei, to) in next)
                {
                    var e = Edges[ei];
                    if ((!motorbike && e.MotorbikeOnly) || blockedEdges.Contains(ei)) continue;
                    double length = e.LengthM > 0 ? e.LengthM : Double3.PlanDistance(NodeById(e.From).Position, NodeById(e.To).Position);
                    double cost = g[cur.id] + length / EdgeSpeedFactor(ei);
                    if (g.TryGetValue(to, out var old) && old <= cost) continue;
                    g[to] = cost;
                    came[to] = cur.id;
                    open.Add((cost + Double3.PlanDistance(NodeById(to).Position, goal.Position), to));
                }
            }
            if (!g.ContainsKey(toNode)) return new List<int>();
            var path = new List<int> { toNode };
            while (path[path.Count - 1] != fromNode) path.Add(came[path[path.Count - 1]]);
            path.Reverse();
            return path;
        }
    }
}
