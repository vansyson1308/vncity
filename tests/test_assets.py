import json
import pathlib

import trimesh

import tools.asset_prompts as ap
import tools.check_assets as ca

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPEC = json.loads((ROOT / "game" / "assets" / "asset_specs.json").read_text(encoding="utf-8"))


def pcg_kinds():
    """Set/Kind pairs the scatter step can emit, read from its source."""
    import pipeline.scatter as sc
    kinds = {("shop_signs", f) for f in sc.SIGN_FAMILY} | {("shop_signs", f + "_vertical") for f in sc.SIGN_FAMILY}
    kinds |= {("pavement_seating", k) for k in sc.SEATING.values()}
    kinds |= {("street_trees", k) for k, _ in sc.TREE_MIX} | {("street_trees", k) for k in sc.STREET_TREE.values()}
    kinds |= {("street_trees", k) for k in ("liu", "loc_vung", "so", "bang")}
    kinds |= {("parked_motorbikes", k) for k in ("scooter", "manual", "electric")}
    kinds |= {("street_vendors", k) for k in ("ganh_hang", "xe_day_banh_mi", "xe_dap_hoa", "xe_day_hoa_qua", "tra_da_via_he")}
    kinds |= {("power_poles", "concrete_h"), ("power_poles", "concrete_round"), ("awnings", "canvas")}
    kinds |= {("cable_spans", f"bundle_{i}") for i in range(4)} | {("street_lights", "boulevard"), ("street_lights", "single")}
    return kinds


def test_every_scattered_kind_has_a_contract():
    have = {(p["set"], p["kind"]) for p in SPEC["props"]}
    assert pcg_kinds() - have == set()


def test_every_archetype_has_a_kit():
    arch = json.loads((ROOT / "game" / "content" / "world" / "building_archetypes.json").read_text(encoding="utf-8"))
    assert {a["id"] for a in arch["items"]} == {k["archetype"] for k in SPEC["facade_kits"]}


def test_asset_map_covers_every_set_and_scale_axes_match():
    amap = json.loads((ROOT / "ue5" / "Config" / "asset_map.json").read_text(encoding="utf-8"))
    for p in SPEC["props"]:
        entry = amap.get(f"{p['set']}/{p['kind']}") or amap.get(f"{p['set']}/*")
        assert entry is not None, p["id"]
        assert entry.get("scale_axes", "xyz") == p["scale_axes"], p["id"]


def test_prompt_pack_is_current_and_signs_have_one_print_per_variant():
    text, rows = ap.build()
    assert (ROOT / "game" / "assets" / "prompts.jsonl").read_text(encoding="utf-8") == text
    prints = [r for r in rows if r["type"] == "sign_print"]
    signs = [p for p in SPEC["props"] if p["set"] == "shop_signs"]
    assert len(prints) == sum(p["variants"] for p in signs)
    assert len({r["out"] for r in rows}) == len(rows)


def test_check_assets_accepts_a_fitting_mesh_and_rejects_a_wrong_one(tmp_path, monkeypatch):
    src = tmp_path / "sources.json"
    monkeypatch.setattr(ca, "SOURCES", src)
    stool = next(p for p in SPEC["props"] if p["id"] == "pavement_seating/tra_da")
    s = stool["size_m"]
    good = trimesh.creation.box(extents=[s["x"], s["z"], s["y"]])
    good.apply_translation([0, s["z"] / 2, 0])
    good.visual = trimesh.visual.TextureVisuals(uv=good.vertices[:, :2])
    good.export(tmp_path / "SM_pavement_seating_tra_da_v0.glb")
    bad = trimesh.creation.box(extents=[3 * s["x"], s["z"], s["y"]])  # 3x too deep, pivot in the middle
    bad.export(tmp_path / "SM_pavement_seating_tra_da_v1.glb")
    src.write_text(json.dumps({"assets": [
        {"file": "SM_pavement_seating_tra_da_v0.glb", "licence": "CC0-1.0"},
        {"file": "SM_pavement_seating_tra_da_v1.glb", "licence": "CC-BY-NC-4.0"}]}))
    assert ca.main([str(tmp_path)]) == 1
    idx, sources = ca.load_index(), ca.load_sources()
    p_good, _ = ca.check_one(tmp_path / "SM_pavement_seating_tra_da_v0.glb", "prop", idx["pavement_seating_tra_da"][1], sources, 0.3)
    p_bad, _ = ca.check_one(tmp_path / "SM_pavement_seating_tra_da_v1.glb", "prop", idx["pavement_seating_tra_da"][1], sources, 0.3)
    assert p_good == []
    assert any("size x" in p for p in p_bad) and any("pivot" in p for p in p_bad)
    assert any("licence" in p for p in p_bad) and any("UVs" in p for p in p_bad)
