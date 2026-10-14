"""Export a compact window of a built area for the browser preview (viewer/city.html).

The preview is a stand-in for UE5 until it is installed: same data, simple meshes. Output is
one JSON file with integer decimetre coordinates relative to the window centre.

Usage:
  python tools/export_web_demo.py --name hoankiem --center 21.0318,105.8512 --radius 450 \
      --out site/city/city.json
"""

import argparse
import csv
import json
import pathlib
import sys

import duckdb
import shapely
from shapely import wkb

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from build import local_projection, polygons, project  # noqa: E402
from fetch import load_extensions  # noqa: E402

PROP_SETS = {"street_trees": 1.0, "power_poles": 1.0, "shop_signs": 1.0, "parked_motorbikes": 0.5,
             "pavement_seating": 1.0, "street_vendors": 1.0, "street_lights": 1.0, "awnings": 1.0,
             "cable_spans": 1.0}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--center", required=True, help="lat,lon")
    ap.add_argument("--radius", type=float, default=450)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    data, out = pathlib.Path("data") / a.name, pathlib.Path("out") / a.name
    fetched = json.loads((data / "fetch.json").read_text())
    w, s, e, n = fetched["bbox"]
    _, _, tf = local_projection((s + n) / 2, (w + e) / 2)
    lat, lon = map(float, a.center.split(","))
    cx, cy = tf.transform(lon, lat)
    r = a.radius
    win = shapely.box(cx - r, cy - r, cx + r, cy + r)
    q = lambda v: int(round(v * 10))  # noqa: E731  decimetres
    pt = lambda x, y: [q(x - cx), q(y - cy)]  # noqa: E731

    buildings = []
    for p in sorted((out / "semantics").glob("footprints_*.json")):
        for b in json.loads(p.read_text())["buildings"]:
            poly = shapely.Polygon(b["outline"])
            if not poly.is_valid or not win.contains(poly.centroid):
                continue
            buildings.append({"a": b["archetype"], "h": q(b["height_m"]), "f": b["floors"],
                              "o": [pt(x, y) for x, y in b["outline"]],
                              "n": b["name"] or "", "fr": [[*pt(*f["a"]), *pt(*f["b"])] for f in b["frontage"]]})

    graph = json.loads((out / "traffic" / "graph.json").read_text())
    roads = []
    for ed in graph["edges"]:
        line = shapely.LineString(ed["polyline"])
        if line.intersects(win):
            roads.append({"w": q(ed["width_m"]), "m": int(ed["motorbike_only"]),
                          "p": [pt(x, y) for x, y in ed["polyline"]], "n": ed["name"] or ""})
    signals = [pt(nd["x"], nd["y"]) for nd in graph["nodes"] if nd["signal"] and win.contains(shapely.Point(nd["x"], nd["y"]))]

    con = duckdb.connect()
    load_extensions(con, "spatial")
    water = []
    for (g,) in con.sql(f"SELECT wkb FROM '{data / 'water.parquet'}'").fetchall():
        for poly in polygons(project(wkb.loads(bytes(g)), tf).intersection(win)):
            water.append([pt(x, y) for x, y in poly.simplify(0.5).exterior.coords[:-1]])
    green = []
    for (g,) in con.sql(f"SELECT wkb FROM '{data / 'land_use.parquet'}' WHERE subtype IN ('park','managed','horticulture','recreation')").fetchall():
        for poly in polygons(project(wkb.loads(bytes(g)), tf).intersection(win)):
            green.append([pt(x, y) for x, y in poly.simplify(0.5).exterior.coords[:-1]])

    props = {}
    for set_, keep in PROP_SETS.items():
        f = out / "pcg" / f"{set_}.csv"
        if not f.exists():
            continue
        rows = []
        with open(f, encoding="utf-8") as fh:
            for i, row in enumerate(csv.DictReader(fh)):
                x, y = float(row["X"]), float(row["Y"])
                if abs(x - cx) > r or abs(y - cy) > r or (keep < 1 and i % round(1 / keep)):
                    continue
                rows.append([*pt(x, y), q(float(row["Z"])), round(float(row["Yaw"])), round(float(row["Scale"]), 2),
                             row["Kind"], int(row["Variant"])])
        props[set_] = rows

    arch_path = pathlib.Path("game/content/world/building_archetypes.json")
    archetypes = {}
    if arch_path.exists():
        for it in json.loads(arch_path.read_text(encoding="utf-8"))["items"]:
            archetypes[it["id"]] = {"name": it["name"]["vi"], "palette": it["facade"].get("palette", [])}
    doc = {"name": a.name, "archetypes": archetypes, "center": [lat, lon], "radius_m": r, "units": "decimetres, x=east y=north",
           "buildings": buildings, "roads": roads, "signals": signals, "water": water, "green": green,
           "props": props}
    pathlib.Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    pathlib.Path(a.out).write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")))
    print(f"{a.out}: {len(buildings)} buildings, {len(roads)} roads, "
          f"{sum(len(v) for v in props.values())} props, {pathlib.Path(a.out).stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
