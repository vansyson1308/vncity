"""Fetch the context layers that make the massing read as Hanoi.

Adds, next to fetch.py's buildings/roads cache in data/<name>/:
  places.parquet         named POIs (shops, cafés, temples…) with Overture taxonomy
  infrastructure.parquet street furniture & utilities (power poles, lamps, crossings, bus stops…)
  land_use.parquet       parks, cemeteries, schools, residential blocks…
  water.parquet          lakes, river, ponds
  graph.parquet          road segments with connectors, speed limits and access rules
  connectors.parquet     graph nodes
  divisions.parquet      wards / districts (admin areas) intersecting the bbox

Run fetch.py first (it records the bbox). Usage:
  python -m pipeline.fetch_context --name hoankiem
"""

import argparse
import json
import pathlib

import fetch
from fetch import bbox_filter, connect, copy_query, overture

SRC = ("list_transform(sources, x -> struct_pack(dataset := x.dataset, "
       "license := x.license)) AS sources")


def fetch_places(con, where, out):
    return copy_query(con, f"""
    SELECT id, names.primary AS name, basic_category, taxonomy.primary AS category,
           taxonomy.hierarchy AS hierarchy, confidence, operating_status,
           brand.names.primary AS brand, addresses[1].freeform AS address,
           {SRC}, ST_AsWKB(geometry) AS wkb
    FROM {overture('places', 'place')}
    WHERE {where} AND confidence >= 0.4
    """, out)


def fetch_base(con, kind, where, out):
    return copy_query(con, f"""
    SELECT id, names.primary AS name, subtype, class, {'height,' if kind == 'infrastructure' else ''}
           source_tags, {SRC}, ST_AsWKB(geometry) AS wkb
    FROM {overture('base', kind)}
    WHERE {where}
    """, out)


def fetch_graph(con, where, out_seg, out_con):
    n_seg = copy_query(con, f"""
    SELECT id, names.primary AS name, subtype, class, subclass, connectors, speed_limits,
           access_restrictions, road_flags, width_rules, level_rules, road_surface,
           {SRC}, ST_AsWKB(geometry) AS wkb
    FROM {overture('transportation', 'segment')}
    WHERE {where} AND subtype = 'road'
    """, out_seg)
    n_con = copy_query(con, f"""
    SELECT id, ST_AsWKB(geometry) AS wkb
    FROM {overture('transportation', 'connector')}
    WHERE {where}
    """, out_con)
    return n_seg, n_con


def fetch_divisions(con, where, out):
    return copy_query(con, f"""
    SELECT id, names.primary AS name, subtype, admin_level, class, region,
           ST_AsWKB(geometry) AS wkb
    FROM {overture('divisions', 'division_area')}
    WHERE {where} AND country = 'VN' AND subtype IN ('county', 'locality', 'localadmin', 'neighborhood', 'macrohood', 'microhood')
    """, out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--data", default="data")
    a = ap.parse_args()
    out = pathlib.Path(a.data) / a.name
    meta_path = out / "fetch.json"
    meta = json.loads(meta_path.read_text())
    where = bbox_filter(*meta["bbox"])
    fetch.RELEASE = meta["overture_release"]  # same release as the buildings and roads

    con = connect()
    ctx = {
        "places": fetch_places(con, where, out / "places.parquet"),
        "infrastructure": fetch_base(con, "infrastructure", where, out / "infrastructure.parquet"),
        "land_use": fetch_base(con, "land_use", where, out / "land_use.parquet"),
        "water": fetch_base(con, "water", where, out / "water.parquet"),
        "divisions": fetch_divisions(con, where, out / "divisions.parquet"),
    }
    ctx["graph_segments"], ctx["graph_connectors"] = fetch_graph(
        con, where, out / "graph.parquet", out / "connectors.parquet")
    meta["context"] = ctx
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    print(json.dumps(ctx, indent=2))


if __name__ == "__main__":
    main()
