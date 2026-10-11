"""Fetch open geodata for an area into a local GeoParquet cache.

Sources (all openly licensed, no scraping):
  - Overture Maps buildings, transportation segments and division boundaries
    (per-feature licence kept in sources[].license; OSM-derived rows are ODbL)
  - Copernicus DEM GLO-30 (a 30 m DSM) from the public AWS bucket

Usage:
  python fetch.py --name caugiay --bbox 105.785,21.028,105.805,21.040
  python fetch.py --name hanoi --region VN-HN
"""

import argparse
import json
import math
import os
import pathlib
import urllib.request

import duckdb

RELEASE = "2026-09-23.0"
OVERTURE = f"s3://overturemaps-us-west-2/release/{RELEASE}"
DEM_URL = (
    "https://copernicus-dem-30m.s3.amazonaws.com/"
    "Copernicus_DSM_COG_10_{lat}_00_{lon}_00_DEM/Copernicus_DSM_COG_10_{lat}_00_{lon}_00_DEM.tif"
)


def connect():
    # Public bucket: force anonymous access even if AWS_* variables are present.
    for k in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN"):
        os.environ.pop(k, None)
    con = duckdb.connect()
    con.sql("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;")
    con.sql(
        "SET s3_region='us-west-2'; SET s3_access_key_id=''; "
        "SET s3_secret_access_key=''; SET s3_session_token='';"
    )
    return con


def overture(theme, kind):
    return f"read_parquet('{OVERTURE}/theme={theme}/type={kind}/*', hive_partitioning=1)"


def bbox_filter(w, s, e, n):
    return f"bbox.xmin <= {e} AND bbox.xmax >= {w} AND bbox.ymin <= {n} AND bbox.ymax >= {s}"


def fetch_boundary(con, region, out):
    """Return the land polygon of a VN region (province / city) by ISO 3166-2 code."""
    q = f"""
    SELECT id, names.primary AS name, subtype, ST_AsGeoJSON(geometry) AS geom,
           bbox.xmin, bbox.ymin, bbox.xmax, bbox.ymax
    FROM {overture('divisions', 'division_area')}
    WHERE country = 'VN' AND subtype = 'region' AND class = 'land'
      AND region = ?
    """
    rows = con.execute(q, [region]).fetchall()
    if len(rows) != 1:
        raise SystemExit(f"expected one land area for region {region!r}, found {len(rows)}")
    did, name, subtype, geom, *bbox = rows[0]
    fc = {"type": "FeatureCollection", "features": [{
        "type": "Feature", "geometry": json.loads(geom),
        "properties": {"id": did, "name": name, "subtype": subtype}}]}
    out.write_text(json.dumps(fc, ensure_ascii=False))
    return tuple(bbox), geom


def copy_query(con, select, out):
    con.sql(f"COPY ({select}) TO '{out}' (FORMAT parquet, COMPRESSION zstd)")
    return con.sql(f"SELECT count(*) FROM '{out}'").fetchone()[0]


def fetch_buildings(con, where, out):
    return copy_query(con, f"""
    SELECT id, names.primary AS name, class, subtype, height, num_floors, min_height,
           min_floor, roof_shape, roof_height, facade_material, is_underground,
           list_transform(sources, x -> struct_pack(dataset := x.dataset,
               license := x.license, record_id := x.record_id)) AS sources,
           ST_AsWKB(geometry) AS wkb
    FROM {overture('buildings', 'building')}
    WHERE {where}
    """, out)


def fetch_roads(con, where, out):
    return copy_query(con, f"""
    SELECT id, names.primary AS name, subtype, class, subclass, width_rules, level_rules,
           road_flags,
           list_transform(sources, x -> struct_pack(dataset := x.dataset,
               license := x.license)) AS sources,
           ST_AsWKB(geometry) AS wkb
    FROM {overture('transportation', 'segment')}
    WHERE {where} AND subtype IN ('road', 'rail')
    """, out)


def fetch_dem(bbox, out_dir):
    """Download the 1x1 degree Copernicus tiles that intersect the bbox."""
    w, s, e, n = bbox
    names = []
    for lat in range(math.floor(s), math.floor(n) + 1):
        for lon in range(math.floor(w), math.floor(e) + 1):
            la = f"{'N' if lat >= 0 else 'S'}{abs(lat):02d}"
            lo = f"{'E' if lon >= 0 else 'W'}{abs(lon):03d}"
            dst = out_dir / f"dem_{la}_{lo}.tif"
            if not dst.exists():
                urllib.request.urlretrieve(DEM_URL.format(lat=la, lon=lo), dst)
            names.append(dst.name)
    return names


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    area = ap.add_mutually_exclusive_group(required=True)
    area.add_argument("--bbox", help="west,south,east,north in WGS84 degrees")
    area.add_argument("--region", help="ISO 3166-2 code of a VN region, e.g. VN-HN, VN-SG")
    ap.add_argument("--out", default="data")
    a = ap.parse_args()
    out = pathlib.Path(a.out) / a.name
    out.mkdir(parents=True, exist_ok=True)

    con = connect()
    if a.region:
        bbox, boundary = fetch_boundary(con, a.region, out / "boundary.geojson")
        # Row-group pruning uses the bbox; the exact clip keeps features touching the region.
        where = (f"{bbox_filter(*bbox)} AND "
                 f"ST_Intersects(geometry, ST_GeomFromGeoJSON('{boundary}'))")
    else:
        bbox = tuple(float(v) for v in a.bbox.split(","))
        where = bbox_filter(*bbox)

    meta = {"name": a.name, "bbox": bbox, "region": a.region, "overture_release": RELEASE}
    meta["buildings"] = fetch_buildings(con, where, out / "buildings.parquet")
    meta["road_segments"] = fetch_roads(con, where, out / "roads.parquet")
    meta["dem_tiles"] = fetch_dem(bbox, out)
    (out / "fetch.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    print(json.dumps(meta, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
