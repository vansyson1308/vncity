"""Keep the game city in step with the real one: diff an area between Overture releases.

Overture publishes a new release about monthly (new buildings, demolitions, height and
road updates, merged from OSM and other sources). This script:

  1. lists the releases on the public bucket and picks the newest (or --release);
  2. fetches the area's buildings and roads for that release into data/<name>@<release>/;
  3. diffs them against data/<name>/ by GERS id and geometry hash;
  4. writes out/<name>/updates/<old>__<new>.json with added / removed / changed ids and
     which build tiles they touch, so only those tiles are rebuilt and re-imported.

Usage:
  python -m live.update_city --name hoankiem [--release 2026-09-23.1] [--dry-run]
"""

import argparse
import json
import math
import os
import pathlib
import re
import subprocess
import sys
import urllib.request

import duckdb

from build import local_projection
from fetch import load_extensions

BUCKET = "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/?list-type=2&prefix=release/&delimiter=/"


def releases():
    with urllib.request.urlopen(BUCKET, timeout=30) as r:
        xml = r.read().decode()
    return sorted(re.findall(r"<Prefix>release/(\d{4}-\d{2}-\d{2}\.\d+)/</Prefix>", xml))


def snapshot(con, parquet):
    cols = {r[0] for r in con.sql(f"DESCRIBE SELECT * FROM '{parquet}'").fetchall()}
    extra = " || ".join(f"coalesce({c}::VARCHAR, '')" for c in ("height", "num_floors", "class") if c in cols)
    rows = con.sql(f"SELECT id, md5(wkb::VARCHAR{(' || ' + extra) if extra else ''}) AS h, "
                   f"ST_X(ST_Centroid(ST_GeomFromWKB(wkb))) x, ST_Y(ST_Centroid(ST_GeomFromWKB(wkb))) y "
                   f"FROM '{parquet}'").fetchall()
    return {i: (h, x, y) for i, h, x, y in rows}


def diff(old, new):
    added = sorted(set(new) - set(old))
    removed = sorted(set(old) - set(new))
    changed = sorted(i for i in set(old) & set(new) if old[i][0] != new[i][0])
    return added, removed, changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--release", help="target release (default: newest on the bucket)")
    ap.add_argument("--tile", type=float, default=500.0)
    ap.add_argument("--dry-run", action="store_true", help="only report the newest release")
    a = ap.parse_args()
    base = pathlib.Path("data") / a.name
    meta = json.loads((base / "fetch.json").read_text())
    old_rel = meta["overture_release"]
    target = a.release or releases()[-1]
    print(f"current {old_rel}, target {target}")
    if a.dry_run or target == old_rel:
        print("nothing to do" if target == old_rel else "dry run")
        return

    name_new = f"{a.name}@{target}"
    area = ["--bbox", ",".join(map(str, meta["bbox"]))] if not meta.get("region") else ["--region", meta["region"]]
    env = {"OVERTURE_RELEASE": target}
    subprocess.run([sys.executable, "fetch.py", "--name", name_new, *area], check=True,
                   env=os.environ | env)

    con = duckdb.connect()
    load_extensions(con, "spatial")
    w, s, e, n = meta["bbox"]
    _, _, tf = local_projection((s + n) / 2, (w + e) / 2)
    report = {"area": a.name, "from": old_rel, "to": target}
    tiles = set()
    for layer in ("buildings", "roads"):
        old = snapshot(con, base / f"{layer}.parquet")
        new = snapshot(con, pathlib.Path("data") / name_new / f"{layer}.parquet")
        added, removed, changed = diff(old, new)
        report[layer] = {"added": added, "removed": removed, "changed": changed,
                         "counts": {"added": len(added), "removed": len(removed), "changed": len(changed)}}
        for i in added + changed:
            x, y = tf.transform(new[i][1], new[i][2])
            tiles.add(f"{math.floor(x / a.tile)}_{math.floor(y / a.tile)}")
        for i in removed:
            x, y = tf.transform(old[i][1], old[i][2])
            tiles.add(f"{math.floor(x / a.tile)}_{math.floor(y / a.tile)}")
    report["dirty_tiles"] = sorted(tiles)
    out = pathlib.Path("out") / a.name / "updates"
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"{old_rel}__{target}.json"
    path.write_text(json.dumps(report, indent=1))
    print(json.dumps({k: report[k]["counts"] for k in ("buildings", "roads")} | {"dirty_tiles": len(tiles)}))
    print(f"report: {path}\nTo adopt: move data/{name_new} to data/{a.name} and re-run "
          f"`python -m pipeline.run --name {a.name} --skip-fetch` (fetch_context too).")


if __name__ == "__main__":
    main()
