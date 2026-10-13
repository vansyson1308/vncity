"""Tests for tools/codegen_ue.py and the pure-Python twin of the UE runtime math (hanoi_geo)."""

import importlib.util
import json
import math
import os
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


# ----------------------------------------------------------------------------- generator guards (UHT rules)

def _schemas_with(item_props):
    """Minimal schema set: common.schema.json + one collection whose item has item_props."""
    schemas = cg.load_schemas()
    common = schemas["common"]
    return {"common": common, "things": {
        "x-collection": "things",
        "properties": {"collection": {"const": "things"},
                       "items": {"type": "array", "items": {
                           "type": "object", "required": ["id"],
                           "properties": dict({"id": {"$ref": "common.schema.json#/$defs/id"}}, **item_props)}}}}}


def test_nested_containers_become_json_text():
    m = cg.Model(_schemas_with({
        "grid": {"type": "array", "items": {"type": "array", "items": {"type": "number"}}},
        "by_key": {"type": "object", "additionalProperties": {"type": "array", "items": {"type": "string"}}},
        "list_of_maps": {"type": "array", "items": {"type": "object", "additionalProperties": {"type": "integer"}}},
        "ok_map": {"type": "object", "additionalProperties": {"type": "integer"}},
    }))
    header = cg.render_header(m)
    assert "TArray<TArray" not in header and not re.search(r"TMap<[^;]*TArray|TMap<[^;]*TMap|TArray<TMap", header)
    fields = {f["json"]: f["spec"] for f in m.structs["FHanoiThingsRow"]["fields"]}
    assert fields["grid"] == fields["by_key"] == fields["list_of_maps"] == {"k": "json"}
    assert fields["ok_map"] == {"k": "map", "value": {"k": "int"}}
    row = cg.convert_item(m, "things", {"id": "a", "grid": [[1, 2], [3]], "by_key": {"x": ["y"]}})
    assert json.loads(row["Grid"]) == [[1, 2], [3]] and json.loads(row["ByKey"]) == {"x": ["y"]}


def test_reserved_and_clashing_identifiers_are_rejected():
    with pytest.raises(ValueError, match="macro"):
        cg.Model(_schemas_with({"mode": {"enum": ["ok", "ERROR"]}}))
    with pytest.raises(ValueError, match="MAX"):
        cg.Model(_schemas_with({"mode": {"enum": ["min", "max"]}}))
    with pytest.raises(ValueError, match="unique"):
        cg.Model(_schemas_with({"mode": {"enum": ["a-b", "a_b"]}}))
    with pytest.raises(ValueError, match="same field name"):
        cg.Model(_schemas_with({"foo_bar": {"type": "string"}, "foo-bar": {"type": "string"}}))
    with pytest.raises(ValueError, match="uint8"):
        cg.Model(_schemas_with({"mode": {"enum": [f"v{i}" for i in range(255)]}}))


def test_struct_name_collision_is_rejected():
    # "loop" (object) and "loops" (array of objects, singular "Loop") would both be F...Loop.
    with pytest.raises(ValueError, match="two different schema objects"):
        cg.Model(_schemas_with({
            "loop": {"type": "object", "properties": {"a": {"type": "string"}}},
            "loops": {"type": "array", "items": {"type": "object", "properties": {"b": {"type": "integer"}}}},
        }))


def test_integer_range_and_type_checks(model):
    assert cg.convert_value(model, {"k": "int"}, 2**31 - 1) == 2**31 - 1
    assert cg.convert_value(model, {"k": "int64"}, 4_231_724_271) == 4_231_724_271
    assert cg.convert_value(model, {"k": "int"}, 3.0) == 3
    for bad in (2**31, 2.5, "7", True):
        with pytest.raises(ValueError):
            cg.convert_value(model, {"k": "int"}, bad)


def test_enum_display_name_is_escaped():
    m = cg.Model(_schemas_with({"mode": {"enum": ['say "hi"', "back\\slash"]}}))
    header = cg.render_header(m)
    assert 'UMETA(DisplayName = "say \\"hi\\"")' in header
    assert 'UMETA(DisplayName = "back\\\\slash")' in header


def test_pascal_matches_runtime_enum_lookup_rule():
    # UHanoiContentSubsystem::EnumValueFromContentString implements the same rule in C++.
    assert cg.pascal("race_legal") == "RaceLegal"
    assert cg.pascal("drive-passenger now") == "DrivePassengerNow"
    assert cg.pascal("2005_plus") == "V2005Plus"
    assert cg.pascal("a_1_2") == "A1_2"


# ----------------------------------------------------------------------------- converter output vs header text

GEN_HEADER = cg.HEADER_PATH
SCALARS = {"FString": str, "FName": str, "bool": bool}


def _parse_headers():
    """{struct: {field: cpp type}}, {enum: {identifiers}} read from the C++ text (not the model)."""
    structs, enums = {}, {}
    for path in (GEN_HEADER, CORE_HEADER):
        text = path.read_text(encoding="utf-8")
        for m in re.finditer(r"enum class (\w+) : uint8\n\{\n(.*?)\n\};", text, re.S):
            enums[m.group(1)] = {re.match(r"\s*(\w+)", l).group(1) for l in m.group(2).splitlines() if l.strip()}
        for m in re.finditer(r"struct HANOICITYRUNTIME_API (\w+)[^{]*\{(.*?)\n\};", text, re.S):
            fields = {}
            for f in re.finditer(r"UPROPERTY\([^)]*\)\s*([\w<>, ]+?)\s+(\w+)\s*(?:=[^;]*)?;", m.group(2)):
                fields[f.group(2)] = f.group(1).strip()
            structs[m.group(1)] = fields
    return structs, enums


def _check_value(structs, enums, cpp, v, where):
    if cpp in SCALARS:
        assert isinstance(v, SCALARS[cpp]), where
    elif cpp in ("int32", "int64"):
        bits = 31 if cpp == "int32" else 63
        assert isinstance(v, int) and not isinstance(v, bool) and -2**bits <= v < 2**bits, where
    elif cpp in ("float", "double"):
        assert isinstance(v, (int, float)) and not isinstance(v, bool), where
    elif cpp.startswith("TArray<"):
        assert isinstance(v, list), where
        for i, x in enumerate(v):
            _check_value(structs, enums, cpp[7:-1], x, f"{where}[{i}]")
    elif cpp.startswith("TMap<FName, "):
        assert isinstance(v, dict), where
        for k, x in v.items():
            _check_value(structs, enums, cpp[12:-1], x, f"{where}.{k}")
    elif cpp in enums:
        assert v in enums[cpp], f"{where}: {v!r} not in {cpp}"
    else:
        assert cpp in structs, f"{where}: unknown C++ type {cpp}"
        assert isinstance(v, dict) and set(v) == set(structs[cpp]), \
            f"{where}: keys {sorted(v)} != UPROPERTYs {sorted(structs[cpp])}"
        for k, x in v.items():
            _check_value(structs, enums, structs[cpp][k], x, f"{where}.{k}")


def test_real_content_rows_match_uproperty_names_in_header(model, tmp_path):
    content = ROOT / "game" / "content"
    if not any(content.rglob("*.json")):
        pytest.skip("no game content yet")
    structs, enums = _parse_headers()
    manifest = cg.convert_content(model, content, tmp_path)
    assert manifest["collections"]
    for col, info in manifest["collections"].items():
        row_struct = "F" + info["row_struct"]
        assert info["struct_path"] == f"/Script/HanoiCityRuntime.{info['row_struct']}"
        for r in json.loads((tmp_path / info["file"]).read_text(encoding="utf-8")):
            assert isinstance(r.pop("Name"), str) and r
            _check_value(structs, enums, row_struct, r, f"{col}:{r['Id']}")


def test_live_weather_conditions_map_to_runtime_enum():
    weather = pytest.importorskip("live.weather")
    import datetime as dt
    _, enums = _parse_headers()
    seen = set()
    t0 = dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc)
    for h in range(0, 24 * 365, 5):
        s = weather.baked(t0 + dt.timedelta(hours=h))
        seen.add(s["condition"])
        # same keys UHanoiHttpWeather::ParseFeed reads
        assert {"condition", "temperature_c", "humidity", "precip_mm_h", "cloud_cover", "wind_kmh", "nom", "source"} <= set(s)
    assert {cg.enum_ident(c) for c in seen} <= enums["EHanoiWeather"] - {"Unset"}


# ----------------------------------------------------------------------------- real pipeline output (out/hoankiem)

CITY = ROOT / "out" / "hoankiem"
needs_city = pytest.mark.skipif(not (CITY / "manifest.json").exists(), reason="no city build in out/hoankiem")


@pytest.fixture
def editor_scripts(monkeypatch):
    """hanoi_common / import_city loaded against a stub `unreal` module (project dir = ue5/)."""
    import types
    stub = types.ModuleType("unreal")

    class Paths:
        @staticmethod
        def project_dir():
            return str(ROOT / "ue5") + "/"

        @staticmethod
        def project_content_dir():
            return str(ROOT / "ue5" / "Content") + "/"

        @staticmethod
        def convert_relative_path_to_full(p):
            return p

    stub.Paths = Paths
    monkeypatch.setitem(sys.modules, "unreal", stub)
    monkeypatch.syspath_prepend(str(PY_DIR))
    for name in ("hanoi_common", "import_city"):
        monkeypatch.delitem(sys.modules, name, raising=False)
    hc = _load("hanoi_common", PY_DIR / "hanoi_common.py")
    ic = _load("import_city", PY_DIR / "import_city.py")
    yield hc, ic
    for name in ("hanoi_common", "import_city"):
        sys.modules.pop(name, None)


def test_setup_config_resolves_repo_paths(editor_scripts):
    hc, _ = editor_scripts
    cfg = hc.load_config([])
    assert cfg["city_build"] == str(ROOT / "out" / "hoankiem")
    assert cfg["game_content"] == str(ROOT / "game" / "content")
    assert cfg["codegen"] == str(ROOT / "tools" / "codegen_ue.py") and os.path.exists(cfg["codegen"])
    assert cfg["data_json_out"] == str(ROOT / "ue5" / "Data" / "Generated")
    cfg = hc.load_config(["--city", "../out/other", "--max-tiles", "3", "--skip-points"])
    assert cfg["city_build"] == str(ROOT / "out" / "other") and cfg["max_tiles"] == 3 and cfg["skip_points"]
    # the codegen module loads from the path the editor uses and points at the committed header
    mod = hc.load_codegen(hc.load_config([]))
    assert pathlib.Path(mod.HEADER_PATH) == cg.HEADER_PATH


def _glb_json(path):
    import struct
    data = path.read_bytes()
    assert data[:4] == b"glTF"
    (length,) = struct.unpack("<I", data[12:16])
    return json.loads(data[20:20 + length])


def _contract_samples(ic, m, limit=None):
    """(mesh_min, mesh_max, origin, expected_box) per real tile, simulating the expected importer
    (Y/Z swap, m -> cm, node offset baked) on the glb bounds, in import_city's tile order."""
    g, size = m["georeference"], float(m["tile_size_m"])
    tm = hg.TransverseMercator(g["origin_lat"], g["origin_lon"])
    tiles = sorted(m["tiles"], key=lambda t: math.hypot(t["origin_m"][0] + size / 2, t["origin_m"][1] + size / 2))
    out = []
    for t in tiles:
        key, origin = t["key"], t["origin_m"]
        assert origin == [key[0] * size, key[1] * size]
        assert f"bld_{key[0]}_{key[1]}.glb" in t["files"]
        j = _glb_json(CITY / "tiles" / f"bld_{key[0]}_{key[1]}.glb")
        assert len(j["meshes"]) == 1 and len(j["nodes"]) == 1  # one StaticMesh per tile
        node = j["nodes"][0]
        tx, ty, tz = node["matrix"][12:15] if "matrix" in node else node.get("translation", [0, 0, 0])
        assert (tx, ty, tz) == pytest.approx((origin[0], 0.0, -origin[1]))
        acc = j["accessors"][j["meshes"][0]["primitives"][0]["attributes"]["POSITION"]]
        (x0, y0, z0), (x1, y1, z1) = acc["min"], acc["max"]
        mn = (100 * (x0 + tx), 100 * (z0 + tz), 100 * (y0 + ty))
        mx = (100 * (x1 + tx), 100 * (z1 + tz), 100 * (y1 + ty))
        box = ic.tile_expected_box(tm, str(CITY / "tiles"), key, origin, size)
        if box is not None:
            out.append((key, (mn, mx, origin, box)))
    return out[:limit] if limit else out


@needs_city
def test_real_tile_footprints_give_the_exact_mesh_box(editor_scripts):
    _, ic = editor_scripts
    m = json.loads((CITY / "manifest.json").read_text(encoding="utf-8"))
    for key, (mn, mx, origin, box) in _contract_samples(ic, m):
        assert box == pytest.approx((mn[0] / 100, mx[0] / 100, -mx[1] / 100, -mn[1] / 100), abs=0.05), key


@needs_city
@pytest.mark.parametrize("n", [1, 2, 4, 7, 16])
def test_real_tiles_calibrate_to_the_contract_mapping(editor_scripts, n):
    """import_city's joint calibration on the first n tiles it would import recovers the contract
    (identity actor transform). Regression: the per-tile vote picked rotated/unbaked mappings for
    3 of the 4 tiles around the origin."""
    _, ic = editor_scripts
    m = json.loads((CITY / "manifest.json").read_text(encoding="utf-8"))
    samples = [s for _, s in _contract_samples(ic, m, n)]
    r = hg.solve_mapping(samples)
    assert (r["map"], r["units"], r["baked"]) == (((1, 0), (0, -1)), 100.0, True)
    assert min(r["scores"]) > 0.99
    p = hg.placement_from_mapping(r["map"], r["units"], r["baked"], samples[0][2])
    assert p["location"] == (0.0, 0.0, 0.0) and p["yaw"] == 0.0 and p["scale"] == (1.0, 1.0, 1.0)


@needs_city
@pytest.mark.parametrize("hyp", [1, 5, 9, 18, 31])
def test_real_tiles_calibrate_any_importer(editor_scripts, hyp):
    """Same real tiles imported under other hypotheses (axes/units/baking) are recovered jointly."""
    _, ic = editor_scripts
    m = json.loads((CITY / "manifest.json").read_text(encoding="utf-8"))
    hm, hs, hb = hg.candidate_mappings()[hyp]
    samples = []
    for _, (_, _, origin, box) in _contract_samples(ic, m, 7):
        de, dn = (0.0, 0.0) if hb else tuple(origin)
        b = hg._box(hm, box[0] - de, box[1] - de, box[2] - dn, box[3] - dn, hs)
        samples.append(((b[0], b[2], 0.0), (b[1], b[3], 1.0), origin, box))
    r = hg.solve_mapping(samples)
    assert (r["map"], r["units"], r["baked"]) == (hm, hs, hb)


@needs_city
def test_real_semantics_footprints_agree_with_projection():
    m = json.loads((CITY / "manifest.json").read_text(encoding="utf-8"))
    g, size = m["georeference"], float(m["tile_size_m"])
    tm = hg.TransverseMercator(g["origin_lat"], g["origin_lon"])
    errors = []
    for rel in m["layers"]["semantics"]:
        path = CITY / rel
        doc = json.loads(path.read_text(encoding="utf-8"))
        kx, ky = doc["tile"]
        assert re.fullmatch(r"footprints_(-?\d+)_(-?\d+)\.json", path.name).groups() == (str(kx), str(ky))
        assert doc["origin_m"] == [kx * size, ky * size]
        lat_lon = {b["id"]: (b["lat"], b["lon"])
                   for b in json.loads((CITY / "tiles" / f"bld_{kx}_{ky}.json").read_text(encoding="utf-8"))["buildings"]}
        for b in doc["buildings"]:
            o = b["outline"]
            a = cx = cy = 0.0
            for (x0, y0), (x1, y1) in zip(o, o[1:] + o[:1]):
                c = x0 * y1 - x1 * y0
                a, cx, cy = a + c, cx + (x0 + x1) * c, cy + (y0 + y1) * c
            if abs(a) < 1e-9:
                continue
            x, y = tm.forward(*lat_lon[b["id"]])
            errors.append(math.hypot(x - cx / (3 * a), y - cy / (3 * a)))
    errors.sort()
    assert len(errors) > 1000
    # pipeline (pyproj) and hanoi_geo agree to millimetres; outliers are multi-part footprints
    assert errors[len(errors) // 2] < 0.01 and errors[int(len(errors) * 0.99)] < 0.05 and errors[-1] < 20


@needs_city
def test_real_pcg_csvs_import_into_pcg_point_row():
    import csv
    structs, _ = _parse_headers()
    fields = structs["FHanoiPcgPointRow"]
    m = json.loads((CITY / "manifest.json").read_text(encoding="utf-8"))
    big_seed = neg_tile = 0
    for rel in m["layers"]["pcg"]:
        with open(CITY / rel, newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            head = next(reader)
            assert head[0] == "Name" and set(head[1:]) == set(fields), rel  # first column = row name
            names = set()
            for row in reader:
                r = dict(zip(head, row))
                assert r["Name"] not in names
                names.add(r["Name"])
                for col, cpp in fields.items():
                    v = r[col]
                    if cpp in ("double", "float"):
                        float(v)
                    elif cpp in ("int32", "int64"):
                        bits = 31 if cpp == "int32" else 63
                        assert -2**bits <= int(v) < 2**bits, (rel, col, v)
                big_seed += int(r["Seed"]) > 2**31 - 1
                assert re.fullmatch(r"-?\d+_-?\d+", r["Tile"]), r["Tile"]
                neg_tile += r["Tile"].startswith("-")
                assert r["Set"] == pathlib.Path(rel).stem
    assert big_seed > 0 and neg_tile > 0  # the int64 Seed and negative tile keys are exercised


@needs_city
def test_real_traffic_graph_matches_runtime_loader():
    """Mirror of AHanoiTrafficGraph::LoadGraph's expectations on the real graph.json."""
    g = json.loads((CITY / "traffic" / "graph.json").read_text(encoding="utf-8"))
    ids = {}
    for n in g["nodes"]:
        assert isinstance(n["id"], int) and abs(n["id"]) < 2**53 and n["id"] not in ids
        assert all(isinstance(n[k], (int, float)) for k in ("x", "y"))
        assert isinstance(n.get("z", 0.0), (int, float)) and isinstance(n.get("signal", False), bool)
        ids[n["id"]] = (n["x"], n["y"])
    edge_ids = set()
    for e in g["edges"]:
        assert e["from"] in ids and e["to"] in ids  # LoadGraph silently drops dangling edges
        assert isinstance(e["id"], int) and -2**31 <= e["id"] < 2**31 and e["id"] not in edge_ids
        edge_ids.add(e["id"])
        assert isinstance(e.get("oneway", False), bool) and isinstance(e.get("motorbike_only", False), bool)
        assert e.get("speed_kmh", 30) > 0 and e.get("lanes", 1) >= 1
        poly = e.get("polyline", [])
        assert all(isinstance(p, list) and len(p) >= 2 for p in poly)
        if len(poly) >= 2:  # polyline runs From -> To
            assert math.dist(poly[0][:2], ids[e["from"]]) < 1.0 and math.dist(poly[-1][:2], ids[e["to"]]) < 1.0


# ----------------------------------------------------------------------------- hand-written C++ vs generated types

RUNTIME_SRC = ROOT / "ue5" / "Plugins" / "HanoiCity" / "Source" / "HanoiCityRuntime"

# (struct, field, C++ type) the hand-written runtime reads; a schema change that breaks one of
# these breaks the C++ build, so it is caught here first.
RUNTIME_FIELD_CONTRACT = [
    ("FHanoiCondition", "MissionsCompleted", "TArray<FHanoiRef>"),
    ("FHanoiCondition", "MinReputation", "TMap<FName, int32>"),
    ("FHanoiCondition", "Hours", "FHanoiHourRange"),
    ("FHanoiCondition", "Weather", "TArray<EHanoiWeather>"),
    ("FHanoiCondition", "Protagonist", "TArray<FHanoiRef>"),
    ("FHanoiCondition", "Flags", "TArray<FString>"),
    ("FHanoiReward", "MoneyVnd", "int64"),
    ("FHanoiReward", "Reputation", "TMap<FName, int32>"),
    ("FHanoiReward", "Items", "TArray<FHanoiRef>"),
    ("FHanoiReward", "Unlocks", "TArray<FHanoiRef>"),
    ("FHanoiReward", "SetFlags", "TArray<FString>"),
    ("FHanoiMissionRow", "Id", "FName"),
    ("FHanoiMissionRow", "Type", "EHanoiMissionType"),
    ("FHanoiMissionRow", "Requires", "FHanoiCondition"),
    ("FHanoiMissionRow", "Steps", "TArray<FHanoiMissionStep>"),
    ("FHanoiMissionRow", "Reward", "FHanoiReward"),
    ("FHanoiMissionRow", "Unlocks", "TArray<FHanoiRef>"),
    ("FHanoiMissionStep", "Id", "FName"),
    ("FHanoiMissionStep", "Kind", "EHanoiMissionStepKind"),
    ("FHanoiMissionStep", "Target", "FHanoiTarget"),
    ("FHanoiMissionStep", "Params", "FString"),
    ("FHanoiMissionStep", "Next", "FHanoiNext"),
    ("FHanoiMissionStep", "FailIf", "TArray<FString>"),
    ("FHanoiTrafficRuleRow", "FineVnd", "FHanoiTrafficRuleFineVnd"),
    ("FHanoiTrafficRuleFineVnd", "Car", "int64"),
    ("FHanoiTrafficRuleFineVnd", "Motorbike", "int64"),
    ("FHanoiTrafficRuleRow", "Detection", "FHanoiTrafficRuleDetection"),
    ("FHanoiTrafficRuleDetection", "BaseNoticeChance", "float"),
    ("FHanoiTrafficRuleDetection", "bCameraEnforced", "bool"),
    ("FHanoiTrafficRuleRow", "Heat", "int32"),
    ("FHanoiTrafficRuleRow", "LicencePoints", "int32"),
    ("FHanoiLandmarkRow", "Location", "FHanoiGeo"),
    ("FHanoiBusinessRow", "Location", "FHanoiGeo"),
    ("FHanoiCharacterRow", "Home", "FHanoiGeo"),
    ("FHanoiDistrictRow", "Center", "FHanoiGeo"),
    ("FHanoiFactionRow", "Base", "FHanoiGeo"),
]


def test_hand_written_runtime_matches_generated_types():
    structs, enums = _parse_headers()
    for struct, field, cpp in RUNTIME_FIELD_CONTRACT:
        assert structs.get(struct, {}).get(field) == cpp, f"{struct}::{field} is no longer {cpp}"
    used = set()
    for p in RUNTIME_SRC.rglob("*.*"):
        if p.suffix in (".h", ".cpp") and "Generated" not in p.parts:
            text = re.sub(r"//.*", "", p.read_text(encoding="utf-8"))
            used |= set(re.findall(r"\b(EHanoi\w+)::(\w+)", text))
            for row in re.findall(r"\b(FHanoi\w+Row)\b", text):
                assert row in structs, f"{p.name}: {row} not generated"
    hand = {"EHanoiTargetKind", "EHanoiWeatherSourceKind"}
    for enum, value in sorted(used):
        if enum not in hand:
            assert value in enums.get(enum, set()), f"{enum}::{value} used by C++ but not generated"
