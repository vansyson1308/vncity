"""Every landmark sits on its real-world feature (docs/gdd/00: Hanoi must be recognisable at a glance).

game/reference/landmarks_osm.json is the snapshot tools/landmark_audit.py writes from OpenStreetMap
data (via Overture): for each landmark, the matched OSM feature and the reference point on it. These
tests run offline, so a coordinate edited by hand without re-running the audit fails CI."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "game" / "content"
LANDMARKS = json.loads((CONTENT / "world" / "landmarks.json").read_text(encoding="utf-8"))["items"]
REF = json.loads((ROOT / "game" / "reference" / "landmarks_osm.json").read_text(encoding="utf-8"))
ORIGIN = json.loads((ROOT / "pipeline" / "districts.json").read_text(encoding="utf-8"))["origin"]
TOLERANCE_M = 50.0


def _m(a, b):
    r = 6_371_008.8
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(b[1] - a[1]) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def test_every_landmark_has_a_reference():
    missing = [lm["id"] for lm in LANDMARKS if not (REF["landmarks"].get(lm["id"]) or {}).get("match")]
    assert not missing, f"run tools/landmark_audit.py audit --fix: {missing}"
    assert REF["tolerance_m"] == TOLERANCE_M


def test_landmarks_within_50_m_of_their_osm_feature():
    far = {}
    for lm in LANDMARKS:
        ref = REF["landmarks"][lm["id"]]["ref_point"]
        d = _m((lm["location"]["lat"], lm["location"]["lon"]), (ref["lat"], ref["lon"]))
        if d > TOLERANCE_M:
            far[lm["id"]] = round(d)
    assert not far, f"moved off the reference (m); re-run the audit if the move is right: {far}"


def test_matches_are_osm_features_or_cited():
    """Places (Meta/Microsoft POIs) and hand references are allowed, but each must say what it is."""
    for lid, ref in REF["landmarks"].items():
        assert ref["layer"] in {"building", "land_use", "water", "infrastructure", "segment", "division", "place", "manual"}, lid
        if ref["layer"] not in {"place", "manual"}:
            assert ref["osm"] and ref["osm"].split("/")[0] in {"node", "way", "relation"}, lid
        if ref["layer"] == "manual":
            assert REF["overrides"][lid].get("source"), lid


def test_tags_say_verified():
    for lm in LANDMARKS:
        tags = lm.get("tags", [])
        assert "coords_verified_osm" in tags and "coords_unverified" not in tags, lm["id"]


def test_district_matches_2025_ward_or_is_explained():
    """Hanoi replaced quận with merged phường on 1/7/2025; the game keeps the old quận as zones
    (pipeline/districts.json). A landmark whose 2025 ward is not one of its zone's wards needs a note."""
    for lid, ref in REF["landmarks"].items():
        if ref.get("district_ok") is False:
            assert ref.get("district_note"), f"{lid}: wards {ref['wards_2025']}"


def test_shared_origin_is_ho_guom():
    """All tiles share one origin at Hồ Hoàn Kiếm; it must be inside the lake as OSM draws it."""
    lake = next(lm for lm in LANDMARKS if lm["id"] == "ho_hoan_kiem")
    ref = REF["landmarks"]["ho_hoan_kiem"]
    assert ref["layer"] == "water" and ref["offset_m"] == 0
    assert _m((ORIGIN["lat"], ORIGIN["lon"]), (lake["location"]["lat"], lake["location"]["lon"])) < 1
