"""Run the whole city pipeline for one area and record the layers in the manifest.

  python -m pipeline.run --name hoankiem --bbox 105.840,21.020,105.860,21.042
  python -m pipeline.run --name hanoi --region VN-HN --tile 1000 --skip-fetch

Steps: fetch.py → pipeline.fetch_context → pipeline.semantics → build.py →
       pipeline.traffic → pipeline.scatter → pipeline.preview
"""

import argparse
import json
import pathlib
import subprocess
import sys
import time


def step(*args):
    t = time.time()
    print(f"\n== {' '.join(args)}", flush=True)
    subprocess.run([sys.executable, *args], check=True)
    print(f"   {time.time() - t:.0f} s", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    area = ap.add_mutually_exclusive_group()
    area.add_argument("--bbox")
    area.add_argument("--region")
    ap.add_argument("--tile", default="500")
    ap.add_argument("--skip-fetch", action="store_true", help="reuse data/<name> from an earlier fetch")
    a = ap.parse_args()
    n = ["--name", a.name]
    if not a.skip_fetch:
        if not (a.bbox or a.region):
            ap.error("--bbox or --region is required unless --skip-fetch")
        step("fetch.py", *n, *(["--bbox", a.bbox] if a.bbox else ["--region", a.region]))
        step("-m", "pipeline.fetch_context", *n)
    step("-m", "pipeline.semantics", *n, "--tile", a.tile)
    step("build.py", *n, "--tile", a.tile)
    step("-m", "pipeline.traffic", *n)
    step("-m", "pipeline.scatter", *n, "--tile", a.tile)
    step("-m", "pipeline.preview", *n)

    out = pathlib.Path("out") / a.name
    manifest = json.loads((out / "manifest.json").read_text())
    manifest["layers"] = {
        "semantics": sorted(f"semantics/{p.name}" for p in (out / "semantics").glob("footprints_*.json")),
        "pcg": sorted(f"pcg/{p.name}" for p in (out / "pcg").glob("*.csv")),
        "traffic": "traffic/graph.json",
        "places": "places/pois.json",
        "districts": "districts.geojson",
        "summaries": {k: json.loads((out / p).read_text()) for k, p in
                      [("semantics", "semantics/summary.json"), ("traffic", "traffic/summary.json"),
                       ("pcg", "pcg/summary.json")]},
        "contract": "docs/pipeline-outputs.md",
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
    print(json.dumps(manifest["layers"]["summaries"], indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
