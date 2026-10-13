"""Build the drivable road graph for traffic AI from Overture segments + connectors.

Every Overture segment lists the connectors along it with their linear position `at`; the
segment is split at each one, so edges run node-to-node and the graph is routable as is.

Output out/<name>/traffic/graph.json (format: docs/pipeline-outputs.md) and a summary.

Hanoi specifics:
  * ngõ/ngách (service alleys, living streets, anything under 4 m) are `motorbike_only`;
  * one-way comes from access restrictions denied on the `backward`/`forward` heading;
  * speed defaults follow the urban limits of Thông tư 38/2024/TT-BGTVT (60 km/h on divided
    arterials, 50 km/h elsewhere) when the data has no limit, alleys 20 km/h for gameplay.

Usage:
  python -m pipeline.traffic --name hoankiem [--origin lat,lon]
"""

import argparse
import heapq
import json
import math
import pathlib
from collections import Counter

import duckdb
import numpy as np
import shapely
from shapely import wkb
from shapely.ops import substring
from shapely.strtree import STRtree

from build import ROAD_WIDTH, local_projection, project
from fetch import load_extensions

DRIVABLE = {"motorway", "trunk", "primary", "secondary", "tertiary", "residential", "unclassified",
            "living_street", "service", "unknown"}
LANES = {"motorway": 4, "trunk": 4, "primary": 4, "secondary": 2, "tertiary": 2, "residential": 2,
         "unclassified": 2, "living_street": 1, "service": 1, "unknown": 1}
SPEED = {"motorway": 80, "trunk": 60, "primary": 60, "secondary": 50, "tertiary": 50,
         "residential": 40, "unclassified": 40, "living_street": 20, "service": 20, "unknown": 30}
SIGNAL_SNAP_M = 15.0


def max_speed(limits):
    for s in limits or []:
        m = s.get("max_speed")
        if m and m.get("value") and not s.get("when"):
            v = float(m["value"])
            return round(v * 1.609) if m.get("unit") == "mph" else round(v)
    return None


def heading_rule(access):
    """'forward' if travel is only allowed along the geometry, 'backward' if only against it."""
    for r in access or []:
        w = r.get("when") or {}
        if r.get("access_type") == "denied" and w.get("heading") and not (w.get("mode") or w.get("vehicle")):
            return "forward" if w["heading"] == "backward" else "backward"
    return None


def cars_denied(access):
    for r in access or []:
        w = r.get("when") or {}
        modes = set(w.get("mode") or [])
        if r.get("access_type") == "denied" and modes & {"car", "motor_vehicle", "hgv"} and "motorcycle" not in modes:
            return True
    return False


def width_of(cls, rules):
    for r in rules or []:
        if r.get("value"):
            return float(r["value"])
    return float(ROAD_WIDTH.get(cls or "unknown", ROAD_WIDTH["unknown"]))


def build_graph(src, tf):
    con = duckdb.connect()
    load_extensions(con, "spatial")
    nodes_raw = {cid: project(wkb.loads(bytes(g)), tf)
                 for cid, g in con.sql(f"SELECT id, wkb FROM '{src / 'connectors.parquet'}'").fetchall()}
    signals = []
    if (src / "infrastructure.parquet").exists():
        signals = [project(wkb.loads(bytes(g)), tf) for (g,) in con.sql(
            f"SELECT wkb FROM '{src / 'infrastructure.parquet'}' WHERE class = 'traffic_signals'").fetchall()]
    segs = con.sql(f"""SELECT id, name, class, subclass, connectors, speed_limits, access_restrictions,
                              width_rules, wkb FROM '{src / 'graph.parquet'}'""").fetchall()

    node_id, nodes, edges, stats = {}, [], [], Counter()

    def nid(cid):
        if cid not in node_id:
            p = nodes_raw.get(cid)
            if p is None:
                return None
            node_id[cid] = len(nodes)
            nodes.append({"id": len(nodes), "x": round(p.x, 2), "y": round(p.y, 2), "z": 0.0, "signal": False})
        return node_id[cid]

    for sid, name, cls, subcls, conns, limits, access, wrules, g in segs:
        if cls not in DRIVABLE:
            stats["skipped_" + str(cls)] += 1
            continue
        line = project(wkb.loads(bytes(g)), tf)
        if line.geom_type != "LineString" or line.length < 0.5:
            continue
        width = width_of(cls, wrules)
        heading = heading_rule(access)
        alley = cls in ("service", "living_street") or subcls == "alley" or width < 4.0
        moto_only = alley or cars_denied(access)
        speed = max_speed(limits) or SPEED.get(cls, 30)
        pts = sorted(conns or [], key=lambda c: c["at"])
        for c0, c1 in zip(pts, pts[1:]):
            a, b = nid(c0["connector_id"]), nid(c1["connector_id"])
            if a is None or b is None or a == b or c1["at"] <= c0["at"]:
                continue
            part = substring(line, c0["at"], c1["at"], normalized=True)
            coords = [[round(x, 2), round(y, 2)] for x, y in part.coords]
            if heading == "backward":
                a, b, coords = b, a, coords[::-1]
            edges.append({"id": len(edges), "from": a, "to": b, "road_id": sid, "name": name, "class": cls,
                          "oneway": heading is not None, "lanes": 1 if alley else LANES.get(cls, 1),
                          "width_m": width, "speed_kmh": speed, "motorbike_only": moto_only,
                          "length_m": round(part.length, 2), "polyline": coords})
            stats[cls] += 1

    if signals and nodes:
        tree = STRtree([shapely.Point(n["x"], n["y"]) for n in nodes])
        for s in signals:
            hit = tree.query_nearest(s, max_distance=SIGNAL_SNAP_M)
            for i in hit[:1]:
                nodes[int(i)]["signal"] = True
    return {"nodes": nodes, "edges": edges}, stats


def adjacency(graph):
    adj = {}
    for e in graph["edges"]:
        adj.setdefault(e["from"], []).append((e["to"], e))
        if not e["oneway"]:
            adj.setdefault(e["to"], []).append((e["from"], e))
    return adj


def route(graph, start, goal, car=True):
    """A* by travel time; returns the node list or None. Used by tests and as the reference
    implementation for the UE AHanoiTrafficGraph."""
    nodes, adj = graph["nodes"], adjacency(graph)
    vmax = max(e["speed_kmh"] for e in graph["edges"]) / 3.6

    def h(n):
        return math.dist((nodes[n]["x"], nodes[n]["y"]), (nodes[goal]["x"], nodes[goal]["y"])) / vmax

    best, prev, pq = {start: 0.0}, {}, [(h(start), start)]
    while pq:
        _, n = heapq.heappop(pq)
        if n == goal:
            path = [n]
            while n in prev:
                n = prev[n]
                path.append(n)
            return path[::-1]
        for m, e in adj.get(n, []):
            if car and e["motorbike_only"]:
                continue
            t = best[n] + e["length_m"] / (e["speed_kmh"] / 3.6)
            if t < best.get(m, math.inf):
                best[m], prev[m] = t, n
                heapq.heappush(pq, (t + h(m), m))
    return None


def components(graph):
    parent = list(range(len(graph["nodes"])))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for e in graph["edges"]:
        parent[find(e["from"])] = find(e["to"])
    return Counter(find(i) for i in range(len(parent)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--data", default="data")
    ap.add_argument("--out", default="out")
    ap.add_argument("--origin")
    a = ap.parse_args()
    src = pathlib.Path(a.data) / a.name
    fetched = json.loads((src / "fetch.json").read_text())
    w, s, e, n = fetched["bbox"]
    lat0, lon0 = (map(float, a.origin.split(",")) if a.origin else ((s + n) / 2, (w + e) / 2))
    _, _, tf = local_projection(lat0, lon0)

    graph, stats = build_graph(src, tf)
    out = pathlib.Path(a.out) / a.name / "traffic"
    out.mkdir(parents=True, exist_ok=True)
    (out / "graph.json").write_text(json.dumps(graph, ensure_ascii=False, separators=(",", ":")))
    comp = components(graph)
    summary = {"nodes": len(graph["nodes"]), "edges": len(graph["edges"]),
               "signals": sum(nd["signal"] for nd in graph["nodes"]),
               "oneway_edges": sum(e["oneway"] for e in graph["edges"]),
               "motorbike_only_edges": sum(e["motorbike_only"] for e in graph["edges"]),
               "km": round(sum(e["length_m"] for e in graph["edges"]) / 1000, 1),
               "largest_component_share": round(max(comp.values()) / max(1, len(graph["nodes"])), 3),
               "edges_by_class": dict(stats)}
    (out / "summary.json").write_text(json.dumps(summary, indent=1))
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
