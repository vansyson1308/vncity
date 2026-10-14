"""Collectibles are the game's second map (docs/gdd/07 item 8, docs/gdd/02 §11): the three sets
exist item by item with real coordinates, every district gets its share of archive photos, every
archive frame a mission asks for is a photo the player can find, and tapes are not double-booked."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "game" / "content"
ITEMS = json.loads((CONTENT / "collectibles.json").read_text(encoding="utf-8"))["items"]
DISTRICTS = [d["id"] for d in json.loads((CONTENT / "world" / "districts.json").read_text(encoding="utf-8"))["items"]]
HO_GUOM = (21.0288, 105.8524)
SIZES = {"anh_xua": 120, "tem_phieu": 40, "bien_hieu": 60}   # docs/gdd/01-vong-lap-gameplay.md
MIN_PHOTOS_PER_DISTRICT = 4


def _km(a, b):
    return math.hypot((a[0] - b[0]) * 111.0, (a[1] - b[1]) * 111.0 * math.cos(math.radians(a[0])))


def test_set_sizes():
    counts = {}
    for it in ITEMS:
        counts[it["set"]] = counts.get(it["set"], 0) + 1
    assert counts == SIZES, counts


def test_every_district_has_photos_to_find():
    per = {d: 0 for d in DISTRICTS}
    for it in ITEMS:
        if it["set"] == "anh_xua":
            per[it["district"].split(":", 1)[1]] += 1
    thin = {d: n for d, n in per.items() if n < MIN_PHOTOS_PER_DISTRICT}
    assert not thin, thin


def test_coordinates_are_in_hanoi():
    for it in ITEMS:
        loc = (it["location"]["lat"], it["location"]["lon"])
        assert _km(loc, HO_GUOM) < 25, f"{it['id']} is {_km(loc, HO_GUOM):.1f} km from Hoàn Kiếm"


def test_photos_have_frame_hours_and_unique_frames_and_tapes():
    frames, tapes = [], []
    for it in ITEMS:
        if it["set"] != "anh_xua":
            assert "archive_frame" not in it and "unlocks_tape" not in it, it["id"]
            continue
        assert "archive_frame" in it and "hours" in it and "year" in it, it["id"]
        assert it["archive_frame"].startswith(f"khai_{it['year']}_"), it["id"]
        frames.append(it["archive_frame"])
        if "unlocks_tape" in it:
            tapes.append(it["unlocks_tape"])
    assert len(set(frames)) == len(frames)
    assert len(set(tapes)) == len(tapes), "a tape is unlocked by two photos"
    assert len(tapes) >= 20, "most of the 24 tapes should hang on a photo"


def test_mission_archive_frames_exist():
    frames = {it["archive_frame"] for it in ITEMS if it["set"] == "anh_xua"}
    missing = []
    for p in sorted((CONTENT / "missions").glob("*.json")):
        for m in json.loads(p.read_text(encoding="utf-8"))["items"]:
            for st in m.get("steps", []):
                f = (st.get("params") or {}).get("archive_frame")
                if f and f not in frames:
                    missing.append(f"{m['id']}/{st['id']}: {f}")
    assert not missing, missing


def test_coupons_and_signs_say_where_they_hide():
    for it in ITEMS:
        if it["set"] == "tem_phieu":
            assert "hidden_in" in it, it["id"]
        if it["set"] == "bien_hieu":
            assert "sign_kind" in it, it["id"]
