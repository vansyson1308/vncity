"""Cut a smaller area out of an already fetched cache, without touching the network.

Fetching from Overture on S3 costs minutes per query however small the bbox, so one fetch of the
whole inner city (fetch.py + pipeline.fetch_context) is cheaper than one per district. This tool
then carves data/<name> for one district out of that cache so the rest of the pipeline
(`pipeline.run --skip-fetch`) runs on it unchanged:

  python -m pipeline.subset --from noi_thanh --name ba_dinh --bbox 105.800,21.020,105.850,21.050

Every parquet layer is filtered by geometry bbox overlap (same rule as fetch.py's bbox_filter),
DEM tiles are hard-linked, and the new fetch.json carries the district bbox plus `subset_of`.
"""

import argparse
import json
import os
import pathlib

import duckdb

from fetch import load_extensions

LAYERS = ("buildings", "roads", "places", "infrastructure", "land_use", "water", "divisions",
          "graph", "connectors")


def subset(src, dst, bbox, con=None):
    w, s, e, n = bbox
    meta = json.loads((src / "fetch.json").read_text())
    sw, ss, se, sn = meta["bbox"]
    if w < sw - 1e-9 or s < ss - 1e-9 or e > se + 1e-9 or n > sn + 1e-9:
        raise SystemExit(f"bbox {bbox} is not inside the cache bbox {meta['bbox']}")
    dst.mkdir(parents=True, exist_ok=True)
    own = con is None
    con = con or duckdb.connect()
    if own:
        load_extensions(con, "spatial")
    counts = {}
    for layer in LAYERS:
        p = src / f"{layer}.parquet"
        if not p.exists():
            continue
        q = dst / f"{layer}.parquet"
        con.sql(f"""COPY (SELECT * FROM read_parquet('{p}')
                          WHERE ST_XMin(ST_GeomFromWKB(wkb)) <= {e} AND ST_XMax(ST_GeomFromWKB(wkb)) >= {w}
                            AND ST_YMin(ST_GeomFromWKB(wkb)) <= {n} AND ST_YMax(ST_GeomFromWKB(wkb)) >= {s})
                    TO '{q}' (FORMAT parquet, COMPRESSION zstd)""")
        counts[layer] = con.sql(f"SELECT count(*) FROM '{q}'").fetchone()[0]
    if own:
        con.close()
    dem = []
    for name in meta.get("dem_tiles", []):
        t = dst / name
        if not t.exists():
            try:
                os.link(src / name, t)
            except OSError:
                t.write_bytes((src / name).read_bytes())
        dem.append(name)
    new = {"name": dst.name, "bbox": list(bbox), "region": None,
           "overture_release": meta["overture_release"], "subset_of": src.name,
           "buildings": counts.get("buildings", 0), "road_segments": counts.get("roads", 0),
           "dem_tiles": dem,
           "context": {k: counts[k] for k in counts if k not in ("buildings", "roads")}}
    (dst / "fetch.json").write_text(json.dumps(new, indent=2, ensure_ascii=False))
    return new


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="src", required=True, help="name of the fetched cache to cut from")
    ap.add_argument("--name", required=True)
    ap.add_argument("--bbox", required=True, help="west,south,east,north")
    ap.add_argument("--data", default="data")
    a = ap.parse_args()
    bbox = tuple(float(v) for v in a.bbox.split(","))
    meta = subset(pathlib.Path(a.data) / a.src, pathlib.Path(a.data) / a.name, bbox)
    print(json.dumps(meta, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
