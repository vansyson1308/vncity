"""Build every inner-city district from one fetched cache, all in one coordinate frame.

  python fetch.py --name noi_thanh --bbox 105.72,20.93,105.95,21.12
  python -m pipeline.fetch_context --name noi_thanh
  python -m pipeline.run_districts [--only ba_dinh,tay_ho] [--tile 500]

For each entry in pipeline/districts.json this cuts data/<district> out of the cache
(pipeline.subset) and runs the rest of pipeline.run with the shared origin, then writes
out/districts.json: one row per district with the manifest summaries, so the UE5 importer and
docs/11-cac-quan.md have one index of what was built.
"""

import argparse
import json
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONFIG = ROOT / "pipeline" / "districts.json"


def load_config():
    return json.loads(CONFIG.read_text(encoding="utf-8"))


def run_district(name, cfg, origin, cache, tile, data, out):
    bbox = ",".join(str(v) for v in cfg["bbox"])
    t = time.time()
    subprocess.run([sys.executable, "-m", "pipeline.run", "--name", name, "--from", cache,
                    "--bbox", bbox, "--tile", str(tile), "--origin", f"{origin['lat']},{origin['lon']}"],
                   check=True, cwd=ROOT)
    manifest = json.loads((pathlib.Path(out) / name / "manifest.json").read_text())
    fetched = json.loads((pathlib.Path(data) / name / "fetch.json").read_text())
    sm = manifest["layers"]["summaries"]
    return {
        "name": name, "bbox": cfg["bbox"], "game_districts": cfg["game_districts"],
        "seconds": round(time.time() - t),
        "buildings": manifest["buildings"]["count"], "buildings_fetched": fetched["buildings"],
        "tiles": len(manifest["tiles"]), "triangles": manifest["triangles"],
        "archetypes": sm["semantics"]["archetypes"], "places": sm["semantics"]["places"],
        "road_km": sm["traffic"]["km"], "nodes": sm["traffic"]["nodes"], "signals": sm["traffic"]["signals"],
        "largest_component_share": sm["traffic"]["largest_component_share"],
        "props": sum(sm["pcg"].values()), "props_by_set": sm["pcg"],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="comma-separated district ids (default: all)")
    ap.add_argument("--tile", default="500")
    ap.add_argument("--data", default="data")
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    cfg = load_config()
    names = a.only.split(",") if a.only else list(cfg["districts"])
    cache = cfg["cache"]["name"]
    index_path = pathlib.Path(a.out) / "districts.json"
    index = json.loads(index_path.read_text()) if index_path.exists() else {}
    for name in names:
        print(f"\n#### {name}", flush=True)
        index[name] = run_district(name, cfg["districts"][name], cfg["origin"], cache, a.tile, a.data, a.out)
        index_path.parent.mkdir(parents=True, exist_ok=True)
        index_path.write_text(json.dumps({"origin": cfg["origin"], "districts": index}, indent=1, ensure_ascii=False))
    print(json.dumps({k: {"buildings": v["buildings"], "road_km": v["road_km"], "props": v["props"]}
                      for k, v in index.items()}, indent=1))


if __name__ == "__main__":
    main()
