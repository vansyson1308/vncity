"""Tải các toà nhà do máy học vẽ (Microsoft ML Buildings, Google Open Buildings) từ Overture Maps
cho những ô phố mà OpenStreetMap chưa vẽ nhà, lưu vào web/.cache/overture_ml.json (không commit).
Overture đã tự loại các nhà trùng với OSM. Giấy phép: ODbL (Microsoft), CC BY 4.0 / ODbL (Google).

Dùng: pip install duckdb && python tools/fetch_overture.py
"""
import json
import os
import pathlib
import re

import duckdb

BBOX = (105.83, 21.019, 105.864, 21.05)  # phải khớp tools/fetch_osm.mjs
RELEASE = os.environ.get("OVERTURE_RELEASE", "2026-09-23.0")
OUT = pathlib.Path(__file__).resolve().parent.parent / ".cache" / "overture_ml.json"


def main():
    for k in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN"):
        os.environ.pop(k, None)
    con = duckdb.connect()
    con.sql("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;")
    con.sql("SET s3_region='us-west-2'; SET s3_access_key_id=''; SET s3_secret_access_key=''; SET s3_session_token='';")
    w, s, e, n = BBOX
    rows = con.sql(f"""
        SELECT sources[1].dataset AS dataset, height, ST_AsText(geometry) AS wkt
        FROM read_parquet('s3://overturemaps-us-west-2/release/{RELEASE}/theme=buildings/type=building/*', hive_partitioning=1)
        WHERE bbox.xmin <= {e} AND bbox.xmax >= {w} AND bbox.ymin <= {n} AND bbox.ymax >= {s}
          AND sources[1].dataset <> 'OpenStreetMap'
    """).fetchall()
    out = []
    for dataset, height, wkt in rows:
        ring = re.search(r"\(\(([^()]+)\)", wkt)  # vòng ngoài của đa giác đầu tiên
        if not ring:
            continue
        pts = [[round(float(v), 7) for v in p.split()] for p in ring.group(1).split(",")]
        out.append({"src": "ms" if dataset.startswith("Microsoft") else "google", "h": height, "p": pts})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"release": RELEASE, "bbox": BBOX, "items": out}))
    print(f"{len(out)} nhà ML → {OUT}")


if __name__ == "__main__":
    main()
