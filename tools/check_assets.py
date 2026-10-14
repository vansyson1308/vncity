"""Check delivered meshes against the asset contract (game/assets/asset_specs.json).

Whatever made a mesh (reused pack, Megascans, image-to-3D, hand modelling), it has to fit the
slot the city data puts it in. For every .glb under the given folder whose file name follows the
contract (SM_<set>_<kind>_v<n>.glb, SM_<archetype>_<module>_v<n>.glb) this checks:

  * size: bounding box within --tol (default 30%) of size_m on each axis (glb frame: +X forward,
    +Y up, +Z = UE +Y; see asset_specs.json "conventions")
  * pivot: base pivots sit on Y=0 and are centred in plan; kit modules start at the origin
  * budget: triangles <= 1.5 x tris_lod0
  * UVs present, material count <= material slots
  * licence: an entry in game/assets/sources.json with an allowed licence

Usage:
  python tools/check_assets.py assets_work/out [--tol 0.3]
Exit code 1 when any mesh fails; a report goes to stdout.
"""

import argparse
import json
import pathlib
import re
import sys

import numpy as np
import trimesh

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPECS = ROOT / "game" / "assets" / "asset_specs.json"
SOURCES = ROOT / "game" / "assets" / "sources.json"
ALLOWED = {"CC0-1.0", "CC-BY-4.0", "CC-BY-3.0", "Fab-Standard", "Megascans-Fab", "Epic-Content", "own-work",
           "generated-own"}  # generated-own: made in-house with a tool whose terms give us the output
NAME = re.compile(r"^SM_(?P<slot>.+)_v(?P<n>\d+)$")


def load_index():
    spec = json.loads(SPECS.read_text(encoding="utf-8"))
    idx = {}
    for p in spec["props"]:
        idx[f"{p['set']}_{p['kind']}"] = ("prop", p)
    for kit in spec["facade_kits"]:
        for m in kit["modules"]:
            idx[f"{kit['archetype']}_{m['module']}"] = ("kit", {**m, "id": f"{kit['archetype']}/{m['module']}",
                                                               "variants": kit["variants"],
                                                               "tris_lod0": 20000, "material_slots": ["a", "b", "c", "d"]})
    return idx


def load_sources():
    if not SOURCES.exists():
        return {}
    return {s["file"]: s for s in json.loads(SOURCES.read_text(encoding="utf-8"))["assets"]}


def measure(path):
    scene = trimesh.load(path, force="scene")
    meshes = list(scene.dump()) if hasattr(scene, "dump") else [scene]
    lo, hi = scene.bounds
    tris = sum(len(m.faces) for m in meshes)
    has_uv = all(getattr(m.visual, "uv", None) is not None for m in meshes)
    mats = {id(getattr(m.visual, "material", None)) for m in meshes}
    return lo, hi, tris, has_uv, len(mats)


def check_one(path, kind, e, sources, tol):
    problems = []
    lo, hi, tris, has_uv, n_mats = measure(path)
    ext = hi - lo  # glb: x forward, y up, z = UE +Y
    want = np.array([e["size_m"]["x"], e["size_m"]["z"], e["size_m"]["y"]])
    for axis, got, w in zip("xyz", ext, want):
        if w > 0.05 and abs(got - w) / w > tol:
            problems.append(f"size {axis}={got:.2f} m, contract {w:g} m")
    if kind == "prop":
        pivot = e.get("pivot", "")
        if pivot.startswith("base") and abs(lo[1]) > 0.05:
            problems.append(f"base pivot: lowest point at y={lo[1]:.2f} m, expected 0")
        if pivot.startswith("base_center"):
            c = (lo + hi) / 2
            if abs(c[0]) > 0.25 * max(want[0], 0.4) or abs(c[2]) > 0.25 * max(want[2], 0.4):
                problems.append(f"base_center pivot: plan centre at ({c[0]:.2f}, {c[2]:.2f}), expected (0, 0)")
    else:
        if abs(lo[1]) > 0.05 or hi[0] > 1.3 or lo[0] < -0.5:
            problems.append("kit module: base must be at y=0, front face on x=0 (balconies up to +1.2 m)")
    if tris > 1.5 * e["tris_lod0"]:
        problems.append(f"{tris:,} triangles, budget {e['tris_lod0']:,}")
    if not has_uv:
        problems.append("missing UVs")
    if n_mats > len(e["material_slots"]):
        problems.append(f"{n_mats} materials, contract slots {e['material_slots']}")
    src = sources.get(path.name)
    if not src:
        problems.append("no entry in game/assets/sources.json")
    elif src.get("licence") not in ALLOWED:
        problems.append(f"licence {src.get('licence')!r} not allowed")
    return problems, tris


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--tol", type=float, default=0.3)
    a = ap.parse_args(argv)
    idx, sources = load_index(), load_sources()
    files = sorted(pathlib.Path(a.folder).rglob("*.glb"))
    bad = 0
    for f in files:
        m = NAME.match(f.stem)
        if not m or m["slot"] not in idx:
            print(f"SKIP {f.name}: name does not match a contract slot")
            bad += 1
            continue
        kind, e = idx[m["slot"]]
        if int(m["n"]) >= e["variants"]:
            print(f"WARN {f.name}: variant {m['n']} >= {e['variants']} variants the data uses")
        problems, tris = check_one(f, kind, e, sources, a.tol)
        print(f"{'FAIL' if problems else 'OK  '} {f.name} ({tris:,} tris)" + "".join(f"\n     - {p}" for p in problems))
        bad += bool(problems)
    print(f"{len(files)} meshes, {bad} with problems")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
