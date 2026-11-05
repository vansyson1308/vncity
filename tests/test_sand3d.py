"""The sand3d asset route: programs, contract, sources and the trimesh finishing step.

Building the programs needs bpy (CI job sand3d-assets); everything here runs without it.
"""
import ast
import json
import pathlib

import numpy as np
import trimesh

import tools.check_assets as ca
import tools.sand3d_build as sb

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPEC = {p["id"]: p for p in json.loads((ROOT / "game" / "assets" / "asset_specs.json").read_text(encoding="utf-8"))["props"]}
# sand3d 1.6.2's public surface (sand3d.__all__) and its material presets
VERBS = {"rect", "circle", "ellipse", "slot", "polygon", "poly", "arc", "tangent_arc", "spline", "superellipse",
         "station", "text", "offset", "stroke", "wrap", "mirror", "extrude", "revolve", "sweep", "loft", "body", "wire",
         "helix", "box", "cylinder", "tube", "cone", "sphere", "wedge", "torus", "dome", "cut", "join", "intersect",
         "split", "delete", "copy", "hole", "pocket", "merge", "scale", "fillet", "chamfer", "soften", "shell", "dent",
         "Frame", "bbox", "local", "at", "transform", "grid", "ring", "along", "snap", "gear", "knurl", "thread",
         "material", "joint", "pose", "seat", "group", "assembly", "attach", "Handle", "export", "empty_scene", "units",
         "fingerprint"}
PRESETS = {"oak", "walnut", "pine", "birch", "steel", "brushed_steel", "chrome", "aluminium", "brass", "copper",
           "painted_metal", "plastic", "glossy_plastic", "rubber", "glass", "ceramic", "fabric", "velvet", "leather",
           "marble", "concrete", "light"}


def test_every_program_builds_a_sand3d_slot_and_every_sand3d_slot_has_a_program():
    progs = sb.programs()
    slots = [slot for _, slot in progs]
    assert len(progs) >= 10 and None not in slots
    assert len(set(slots)) == len(slots)
    for path, slot in progs:
        assert slot in SPEC, path.name
        assert SPEC[slot]["route"] == "sand3d", slot
        assert SPEC[slot].get("route_before_sand3d"), slot          # the manual fallback stays written down
        assert path.stem == slot.replace("/", "_"), path.name
    assert {i for i, p in SPEC.items() if p["route"] == "sand3d"} == set(slots)


def test_programs_use_only_sand3d_verbs_and_presets_and_define_build():
    for path, _ in sb.programs():
        tree = ast.parse(path.read_text(encoding="utf-8"))
        assert any(isinstance(n, ast.FunctionDef) and n.name == "build" for n in tree.body), path.name
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                assert {a.name for a in node.names} <= {"math", "sand3d"}, path.name
            if isinstance(node, ast.Attribute) and getattr(node.value, "id", None) == "s3d":
                assert node.attr in VERBS, f"{path.name}: s3d.{node.attr}"
            if (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "material"
                    and len(node.args) > 1 and isinstance(node.args[1], ast.Constant)):
                assert node.args[1].value in PRESETS, f"{path.name}: preset {node.args[1].value}"
            assert not (isinstance(node, ast.Name) and node.id in {"bpy", "bmesh"}), path.name


def test_sources_has_an_own_work_entry_for_every_built_file():
    have = {a["file"]: a for a in json.loads((ROOT / "game" / "assets" / "sources.json").read_text(encoding="utf-8"))["assets"]}
    want = sb.source_entries()
    assert len(want) == sum(SPEC[s]["variants"] for _, s in sb.programs())
    for e in want:
        assert have.get(e["file"]) == e, f"{e['file']}: run python tools/sand3d_build.py --write-sources"
        assert e["licence"] in ca.ALLOWED


def _raw_glb(path, parts):
    """A GLB as sand3d writes one: several meshes, materials shared by name, no UVs."""
    scene = trimesh.Scene()
    for i, (extents, centre, mat) in enumerate(parts):
        m = trimesh.creation.box(extents=extents)
        m.apply_translation(centre)
        m.visual = trimesh.visual.TextureVisuals(material=mat)
        scene.add_geometry(m, node_name=f"part{i}")
    scene.export(path)


def test_finish_merges_by_material_adds_uvs_and_passes_the_contract(tmp_path, monkeypatch):
    bench = SPEC["infrastructure/bench"]
    stone = trimesh.visual.material.PBRMaterial(name="concrete", baseColorFactor=[150, 150, 140, 255])
    # glb frame: x forward, y up, z = UE +Y; a 0.5 x 1.6 seat 0.45 m up on two feet
    _raw_glb(tmp_path / "raw.glb", [([0.5, 0.08, 1.6], [0, 0.41, 0], stone),
                                    ([0.4, 0.37, 0.12], [0, 0.185, -0.6], stone),
                                    ([0.4, 0.37, 0.12], [0, 0.185, 0.6], stone)])
    out = tmp_path / "out" / "SM_infrastructure_bench_v0.glb"
    meshes, tris = sb.finish(tmp_path / "raw.glb", out)
    assert meshes == 1 and tris == 36
    lo, hi, n, has_uv, n_mats = ca.measure(out)
    assert has_uv and n_mats == 1 and n == 36
    assert np.allclose(hi - lo, [0.5, 0.45, 1.6], atol=1e-3)
    src = tmp_path / "sources.json"
    src.write_text(json.dumps({"assets": [{"file": out.name, "licence": "own-work"}]}))
    monkeypatch.setattr(ca, "SOURCES", src)
    problems, _ = ca.check_one(out, "prop", bench, ca.load_sources(), 0.3)
    assert problems == []


def test_check_assets_counts_materials_not_mesh_copies(tmp_path):
    red = trimesh.visual.material.PBRMaterial(name="red", baseColorFactor=[200, 0, 0, 255])
    grey = trimesh.visual.material.PBRMaterial(name="grey", baseColorFactor=[90, 90, 90, 255])
    _raw_glb(tmp_path / "raw.glb", [([1, 1, 1], [i * 2, 0.5, 0], red if i < 3 else grey) for i in range(4)])
    assert ca.measure(tmp_path / "raw.glb")[4] == 2
    meshes, _ = sb.finish(tmp_path / "raw.glb", tmp_path / "done.glb")
    assert meshes == 2 and ca.measure(tmp_path / "done.glb")[4] == 2


def test_box_uv_follows_the_dominant_axis():
    m = trimesh.creation.box(extents=[2, 1, 1])
    m2, uv = sb.box_uv(m)
    assert uv.shape == (len(m2.vertices), 2) and len(m2.faces) == len(m.faces)
    top = np.where(m2.face_normals[:, 2] > 0.9)[0][0]
    assert np.allclose(uv[m2.faces[top]], m2.vertices[m2.faces[top]][:, :2])
