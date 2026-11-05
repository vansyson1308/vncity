"""Build the props written as sand3d programs (game/assets/sand3d/*.py) into contract meshes.

sand3d (https://github.com/Sandflow-ai/sand3d, Apache-2.0) writes a 3D object as a short Python
program over Blender's bpy. Each program here builds one asset_specs.json slot (its SLOT) and
exposes build(variant) returning the root of the object, in millimetres, +X forward, +Z up, the
pivot where the contract puts it. This tool:

  1. runs every program once per variant the contract asks for (bpy, so it needs `sand3d`
     installed: pip install -r requirements-sand3d.txt, Python 3.13 or 3.11),
  2. exports a GLB (sand3d scales to metres; Blender's exporter puts +Y up, which is the frame
     tools/check_assets.py reads),
  3. finishes it with trimesh: one mesh per material (so the material count matches the
     contract's slots) and box-projected UVs at 1 UV unit per metre (sand3d writes none; the
     engine's tiling materials need them),
  4. writes out/SM_<set>_<kind>_v<n>.glb, and with --check runs tools/check_assets.py on them.

The GLBs are build outputs (assets_work/ is not in git); the programs and their sources.json
entries are. Usage:

  python tools/sand3d_build.py                       # every program -> assets_work/out/sand3d
  python tools/sand3d_build.py --only infrastructure/bench --check
  python tools/sand3d_build.py --write-sources       # refresh game/assets/sources.json entries
  python tools/sand3d_build.py --list                # programs and variants, no bpy needed
"""

import argparse
import ast
import importlib.util
import json
import pathlib
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROGRAMS = ROOT / "game" / "assets" / "sand3d"
SPECS = ROOT / "game" / "assets" / "asset_specs.json"
SOURCES = ROOT / "game" / "assets" / "sources.json"
DEFAULT_OUT = ROOT / "assets_work" / "out" / "sand3d"
SAND3D_URL = "https://github.com/Sandflow-ai/sand3d"
ROUTE = "sand3d"


def specs():
    return {p["id"]: p for p in json.loads(SPECS.read_text(encoding="utf-8"))["props"]}


def programs():
    """[(path, slot)] for every program, read without importing it (no bpy needed)."""
    out = []
    for path in sorted(PROGRAMS.glob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        slot = None
        for node in tree.body:
            if isinstance(node, ast.Assign) and any(getattr(t, "id", None) == "SLOT" for t in node.targets):
                slot = ast.literal_eval(node.value)
        out.append((path, slot))
    return out


def file_name(slot, variant):
    return f"SM_{slot.replace('/', '_')}_v{variant}.glb"


def outputs():
    """[(program path, slot, variant, file name)] for every mesh the programs make."""
    idx = specs()
    return [(path, slot, v, file_name(slot, v)) for path, slot in programs() for v in range(idx[slot]["variants"])]


def source_entries():
    return [{"file": name, "source": f"sand3d program {path.relative_to(ROOT).as_posix()}", "author": "vncity",
             "licence": "own-work", "url": SAND3D_URL,
             "note": "Built by tools/sand3d_build.py with sand3d (Apache-2.0) over Blender bpy; the output is ours"}
            for path, _, _, name in outputs()]


def write_sources():
    data = json.loads(SOURCES.read_text(encoding="utf-8"))
    ours = {e["file"] for e in source_entries()}
    kept = [a for a in data["assets"] if a["file"] not in ours and not a.get("source", "").startswith("sand3d program")]
    data["assets"] = kept + source_entries()
    SOURCES.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return len(source_entries())


# ------------------------------------------------------------------ finishing (trimesh only)

def box_uv(mesh, per_m=1.0):
    """Unmerge the vertices and give each face the two coordinates its normal does not point
    along: a box projection, per_m UV units per metre."""
    import numpy as np
    mesh = mesh.copy()
    mesh.unmerge_vertices()
    axis = np.abs(mesh.face_normals).argmax(axis=1)
    keep = np.array([[1, 2], [0, 2], [0, 1]])[axis]            # face looking along x: (y, z), ...
    uv = np.zeros((len(mesh.vertices), 2))
    for corner in range(3):
        vi = mesh.faces[:, corner]
        uv[vi] = np.take_along_axis(mesh.vertices[vi], keep, axis=1) * per_m
    return mesh, uv


def finish(src, dst):
    """One mesh per material, box UVs, written to dst. Returns (meshes, triangles)."""
    import numpy as np
    import trimesh
    scene = trimesh.load(src, force="scene")
    groups = {}
    for geom in scene.dump():
        mat = getattr(geom.visual, "material", None)
        if mat is None:
            colour = getattr(geom.visual, "main_color", [200, 200, 200, 255])
            mat = trimesh.visual.material.PBRMaterial(name="default", baseColorFactor=colour)
        key = getattr(mat, "name", None) or repr(getattr(mat, "baseColorFactor", None))
        groups.setdefault(key, (mat, []))[1].append(trimesh.Trimesh(geom.vertices, geom.faces, process=False))
    out = trimesh.Scene()
    tris = 0
    for key, (mat, parts) in sorted(groups.items()):
        merged = trimesh.util.concatenate(parts)
        merged, uv = box_uv(merged)
        merged.visual = trimesh.visual.TextureVisuals(uv=uv, material=mat)
        out.add_geometry(merged, geom_name=str(key), node_name=str(key))
        tris += len(merged.faces)
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.export(dst)
    return len(groups), tris


# ------------------------------------------------------------------ building (needs sand3d / bpy)

def load_program(path):
    spec = importlib.util.spec_from_file_location(f"sand3d_prog_{path.stem}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def build(out, only=None):
    import sand3d as s3d
    done = []
    with tempfile.TemporaryDirectory() as tmp:
        for path, slot, v, name in outputs():
            if only and slot not in only:
                continue
            s3d.empty_scene()
            root = load_program(path).build(v)
            raw = pathlib.Path(tmp) / name
            s3d.export(root, raw)
            meshes, tris = finish(raw, out / name)
            print(f"built {name}: {meshes} materials, {tris:,} tris")
            done.append(name)
    return done


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--out", type=pathlib.Path, default=DEFAULT_OUT)
    ap.add_argument("--only", action="append", help="slot id, e.g. infrastructure/bench (repeatable)")
    ap.add_argument("--check", action="store_true", help="run tools/check_assets.py on the output")
    ap.add_argument("--write-sources", action="store_true", help="refresh the sand3d entries in sources.json")
    ap.add_argument("--list", action="store_true", help="list programs and the files they make")
    a = ap.parse_args(argv)
    if a.write_sources:
        print(f"{write_sources()} sand3d entries in {SOURCES.relative_to(ROOT)}")
        return 0
    if a.list:
        for path, slot, v, name in outputs():
            print(f"{slot:34} v{v}  {name:44} {path.relative_to(ROOT).as_posix()}")
        return 0
    done = build(a.out, set(a.only) if a.only else None)
    if not done:
        print("nothing built: --only names no program", file=sys.stderr)
        return 1
    if a.check:
        sys.path.insert(0, str(ROOT))
        import tools.check_assets as ca
        return ca.main([str(a.out)])
    return 0


if __name__ == "__main__":
    sys.exit(main())
