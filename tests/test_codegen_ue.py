"""Tests for tools/codegen_ue.py and the pure-Python twin of the UE runtime math (hanoi_geo)."""

import importlib.util
import json
import math
import pathlib
import re
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent
PY_DIR = ROOT / "ue5" / "Plugins" / "HanoiCity" / "Content" / "Python"
CORE_HEADER = ROOT / "ue5" / "Plugins" / "HanoiCity" / "Source" / "HanoiCityRuntime" / "Public" / "HanoiCoreTypes.h"


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


cg = _load("codegen_ue", ROOT / "tools" / "codegen_ue.py")
hg = _load("hanoi_geo", PY_DIR / "hanoi_geo.py")


@pytest.fixture(scope="module")
def model():
    return cg.build_model()


@pytest.fixture(scope="module")
def header(model):
    return cg.render_header(model)


def struct_block(header, name):
    m = re.search(r"struct HANOICITYRUNTIME_API " + re.escape(name) + r"\b.*?\n};\n", header, re.S)
    assert m, f"{name} not in header"
    return m.group(0)


# ----------------------------------------------------------------------------- header

def test_header_is_deterministic(model):
    assert cg.render_header(model) == cg.render_header(cg.build_model())


def test_committed_header_is_up_to_date(header):
    assert cg.HEADER_PATH.read_text(encoding="utf-8") == header, "run python tools/codegen_ue.py"


def test_check_mode_passes():
    assert cg.main(["--check"]) == 0


def test_every_collection_has_a_row_struct(model, header):
    schemas = cg.load_schemas()
    cols = {s.get("x-collection") or s["properties"]["collection"]["const"]
            for n, s in schemas.items() if n != "common"}
    assert cols == set(model.collections)
    for col, name in model.collections.items():
        assert f"struct HANOICITYRUNTIME_API {name} : public FTableRowBase" in header
        assert f'Fn(FName(TEXT("{col}")), {name}::StaticStruct());' in header


def _walk(model, header, node, struct_name, seen):
    """Independently walk a schema object and check every property maps to a field."""
    if struct_name in seen:
        return
    seen.add(struct_name)
    struct = model.structs[struct_name]
    props = node.get("properties", {})
    assert [f["json"] for f in struct["fields"]] == list(props), struct_name
    block = struct_block(header, struct_name)
    common = model.common
    for f in struct["fields"]:
        decl = f"\t{cg.cpp_type(f['spec'])} {f['cpp']}"
        assert decl in block, f"{struct_name}.{f['json']}: missing '{decl}'"
        sub, spec = props[f["json"]], f["spec"]
        while spec["k"] == "array":
            sub, spec = sub.get("items", {}), spec["elem"]
        ref = sub.get("$ref", "")
        if ref.endswith("/condition") or ref.endswith("/reward"):
            _walk(model, header, common[ref.rsplit("/", 1)[1]], spec["name"], seen)
        elif sub.get("type") == "object" and sub.get("properties"):
            assert spec["k"] == "struct"
            _walk(model, header, sub, spec["name"], seen)


def test_every_schema_property_maps_to_a_field(model, header):
    seen = set()
    for name, schema in cg.load_schemas().items():
        if name == "common":
            continue
        col = schema.get("x-collection") or schema["properties"]["collection"]["const"]
        _walk(model, header, schema["properties"]["items"]["items"], model.collections[col], seen)
    # every generated struct was reached from some schema
    assert seen == set(model.structs)


def test_enums_have_unset_and_display_names(model, header):
    for name, values in model.enums.items():
        m = re.search(r"enum class " + name + r" : uint8\n\{\n(.*?)\n\};", header, re.S)
        assert m, name
        body = m.group(1)
        assert body.splitlines()[0].strip().startswith("Unset = 0")
        for v in values:
            assert f'{cg.enum_ident(v)} UMETA(DisplayName = "{v}")' in body
    assert "EHanoiWeather" in model.enums  # used by hand-written runtime code


def test_identifier_rules():
    assert cg.pascal("colonial_1873_1954") == "Colonial1873_1954"
    assert cg.pascal("pre_1873") == "Pre1873"
    assert cg.field_name("name", {"k": "struct"}) == "DisplayName"
    assert cg.field_name("rating", {"k": "bool"}) == "bRating"


def test_core_types_match_hand_written_header():
    text = CORE_HEADER.read_text(encoding="utf-8")
    for struct, fields in cg.CORE.items():
        block = re.search(r"struct HANOICITYRUNTIME_API " + struct + r"\b.*?\n};", text, re.S)
        assert block, struct
        for _, cpp, spec in fields:
            assert re.search(r"\b" + re.escape(cg.cpp_type(spec)) + r"\s+" + cpp + r"\b", block.group(0)), f"{struct}.{cpp}"


def test_pcg_row_struct_matches_csv_contract():
    text = CORE_HEADER.read_text(encoding="utf-8")
    block = re.search(r"struct HANOICITYRUNTIME_API FHanoiPcgPointRow.*?\n};", text, re.S).group(0)
    for col in "X,Y,Z,Yaw,Scale,Set,Kind,Variant,Seed,Tile,Ref".split(","):
        assert re.search(r"\s" + col + r"( = [^;]+)?;", block), col
    assert "int64 Seed" in block  # pipeline seeds span uint32


# ----------------------------------------------------------------------------- data

MISSION = {
    "id": "m_test", "name": {"vi": "Thử"}, "type": "side", "giver": "characters:co_lan",
    "start": {"lat": 21.03, "lon": 105.85},
    "steps": [
        {"id": "s1", "kind": "go_to", "objective": {"vi": "Đi"}, "target": {"lat": 21.0278, "lon": 105.8523}},
        {"id": "s2", "kind": "choice", "objective": {"vi": "Chọn"}, "target": "landmarks:thap_rua",
         "params": {"radius_m": 10}, "next": {"help": "s3", "default": "end"}},
        {"id": "s3", "kind": "talk", "objective": {"vi": "Nói"}, "next": "end",
         "dialogue": "dialogues:d1", "fail_if": ["time>60"]},
    ],
    "reward": {"money_vnd": 50000, "reputation": {"pho_co": 2}},
}


def test_convert_mission_oneofs_and_defaults(model):
    row = cg.convert_item(model, "missions", MISSION)
    assert row["Name"] == "m_test" and row["Id"] == "m_test"
    assert row["Type"] == "Side"
    assert row["DisplayName"] == {"Vi": "Thử", "En": ""}
    assert row["Giver"] == {"Collection": "characters", "Id": "co_lan"}
    s1, s2, s3 = row["Steps"]
    assert s1["Kind"] == "GoTo"
    assert s1["Target"]["Kind"] == "Geo" and s1["Target"]["Geo"]["bIsSet"] is True
    assert s1["Next"] == {"Step": "", "Branches": {}}
    assert s2["Target"]["Kind"] == "Ref" and s2["Target"]["Ref"] == {"Collection": "landmarks", "Id": "thap_rua"}
    assert s2["Next"] == {"Step": "", "Branches": {"default": "end", "help": "s3"}}
    assert json.loads(s2["Params"]) == {"radius_m": 10}
    assert s3["Next"]["Step"] == "end" and s3["FailIf"] == ["time>60"]
    assert row["Reward"]["MoneyVnd"] == 50000 and row["Reward"]["Reputation"] == {"pho_co": 2}
    # absent optional fields are written with defaults
    assert row["Requires"]["Hours"] == {"From": 0.0, "To": 24.0}
    assert row["Summary"] == {"Vi": "", "En": ""}
    assert row["Chapter"] == 0 and row["Tags"] == []


def _keys_match(model, struct_name, row):
    s = model.structs.get(struct_name)
    if s is None:
        return
    assert set(row) - {"Name"} == {f["cpp"] for f in s["fields"]}
    for f in s["fields"]:
        spec, v = f["spec"], row[f["cpp"]]
        while spec["k"] == "array":
            spec = spec["elem"]
            for x in v:
                if spec["k"] == "struct":
                    _keys_match(model, spec["name"], x)
            break
        else:
            if spec["k"] == "struct":
                _keys_match(model, spec["name"], v)


def test_convert_rejects_unknown_property_and_enum(model):
    with pytest.raises(ValueError):
        cg.convert_item(model, "missions", dict(MISSION, bogus=1))
    with pytest.raises(ValueError):
        cg.convert_item(model, "missions", dict(MISSION, type="epic"))


def test_convert_real_content(model, tmp_path):
    content = ROOT / "game" / "content"
    if not any(content.rglob("*.json")):
        pytest.skip("no game content yet")
    manifest = cg.convert_content(model, content, tmp_path)
    for col, info in manifest["collections"].items():
        rows = json.loads((tmp_path / info["file"]).read_text(encoding="utf-8"))
        assert len(rows) == info["rows"] > 0
        assert len({r["Name"] for r in rows}) == len(rows)
        for r in rows:
            _keys_match(model, model.collections[col], r)
    again = tmp_path / "again"
    cg.convert_content(model, content, again)
    for p in tmp_path.glob("*.json"):
        assert p.read_bytes() == (again / p.name).read_bytes()


# ----------------------------------------------------------------------------- geo / sun / axes

def test_tmerc_matches_pyproj():
    pyproj = pytest.importorskip("pyproj")
    lat0, lon0 = 21.031, 105.85
    tm = hg.TransverseMercator(lat0, lon0)
    crs = pyproj.CRS.from_proj4(f"+proj=tmerc +lat_0={lat0} +lon_0={lon0} +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +units=m")
    tf = pyproj.Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    for lat in (20.6, 21.0, 21.031, 21.4):
        for lon in (105.3, 105.85, 106.0):
            x, y = tm.forward(lat, lon)
            px, py = tf.transform(lon, lat)
            assert abs(x - px) < 1e-3 and abs(y - py) < 1e-3
            la, lo = tm.inverse(x, y)
            assert abs(la - lat) * 111e3 < 1e-2 and abs(lo - lon) * 104e3 < 1e-2
    assert tm.forward(lat0, lon0) == pytest.approx((0.0, 0.0), abs=1e-6)


def test_enu_to_ue_contract():
    assert hg.enu_to_ue(1.0, 2.0, 3.0) == (100.0, -200.0, 300.0)
    assert hg.ue_yaw(90.0) == -90.0  # facing north (CCW from east) = UE yaw -90 (towards -Y)


def test_solar_position_hanoi():
    # June solstice, Hanoi local noon (05:00 UTC): sun near zenith, slightly north (lat < decl).
    el, az = hg.solar_position(hg.julian_day(2026, 6, 21, 5.0), 21.03, 105.85)
    assert 86.0 < el < 89.0 and (az > 300 or az < 60)
    # March equinox around solar noon: elevation ~ 90 - lat
    el, az = hg.solar_position(hg.julian_day(2026, 3, 20, 12.0 - 7.0 + (105.0 - 105.85) / 15.0), 21.03, 105.85)
    assert abs(el - (90 - 21.03)) < 1.5 and 150 < az < 210
    # Morning sun in the east, evening sun in the west
    assert 45 < hg.solar_position(hg.julian_day(2026, 9, 1, 1.5), 21.03, 105.85)[1] < 135
    assert 225 < hg.solar_position(hg.julian_day(2026, 9, 1, 9.5), 21.03, 105.85)[1] < 315


@pytest.mark.parametrize("origin", [(1500.0, -1000.0), (0.0, 0.0), (-500.0, -500.0)])
def test_tile_placement_recovers_any_importer_mapping(origin):
    ox, oy = origin
    size = 500.0
    expected = (ox + 40, ox + 430, oy + 10, oy + 260)
    for m in hg.PLANE_MAPS:
        for units in (100.0, 1.0):
            for baked in (True, False):
                de, dn = (0.0, 0.0) if baked else (ox, oy)
                box = hg._box(m, expected[0] - de, expected[1] - de, expected[2] - dn, expected[3] - dn, units)
                p = hg.solve_tile_placement((box[0], box[2], 0.0), (box[1], box[3], 10.0), origin, size, expected)
                e, n, u = ox + 100, oy + 200, 7.0
                lx, ly = hg._apply(m, e - de, n - dn)
                world = hg.apply_placement(p, (lx * units, ly * units, u * units))
                assert world == pytest.approx((e * 100, -n * 100, u * 100), abs=1e-6)


def test_contract_importer_needs_identity_transform():
    # The expected glTF importer (Y/Z swap, m -> cm, node offset baked) maps (e, n) -> (100e, -100n).
    p = hg.placement_from_mapping(((1, 0), (0, -1)), 100.0, True, (500.0, -1000.0))
    assert p["location"] == (0.0, 0.0, 0.0) and p["yaw"] == 0.0 and p["scale"] == (1.0, 1.0, 1.0)


def test_real_tiles_project_inside_their_tile():
    manifest = ROOT / "out" / "hoankiem" / "manifest.json"
    if not manifest.exists():
        pytest.skip("no city build")
    m = json.loads(manifest.read_text(encoding="utf-8"))
    g = m["georeference"]
    tm = hg.TransverseMercator(g["origin_lat"], g["origin_lon"])
    size = m["tile_size_m"]
    for t in m["tiles"][:6]:
        p = manifest.parent / "tiles" / f"bld_{t['key'][0]}_{t['key'][1]}.json"
        if not p.exists():
            continue
        ox, oy = t["origin_m"]
        for b in json.loads(p.read_text(encoding="utf-8"))["buildings"][:50]:
            x, y = tm.forward(b["lat"], b["lon"])
            assert ox - 1 <= x <= ox + size + 1 and oy - 1 <= y <= oy + size + 1
