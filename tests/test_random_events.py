"""Standards for game/content/random_events.json (docs/gdd/02-he-thong.md §7, docs/gdd/07 item 7):
the street between missions must offer enough unscripted events, each one a person with a motive,
each one a real fork (no two choices with the same consequence), and every district must get its share."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "game" / "content"

EVENTS = json.loads((CONTENT / "random_events.json").read_text(encoding="utf-8"))["items"]
DISTRICTS = [d["id"] for d in json.loads((CONTENT / "world" / "districts.json").read_text(encoding="utf-8"))["items"]]
LANDMARK_DISTRICT = {l["id"]: l["district"].split(":", 1)[1]
                     for l in json.loads((CONTENT / "world" / "landmarks.json").read_text(encoding="utf-8"))["items"]}

MIN_EVENTS = 40          # docs/gdd/07-tham-dinh-trieu-do.md item 7
MIN_PER_DISTRICT = 15    # events that can roll in a given district (unfiltered ones count everywhere)
KINDS = {"giup_nguoi", "giao_thong", "hiem_hoa", "co_hoi", "van_hoa", "kinh_te"}


def _districts_of(ev):
    sp = ev["spawn"]
    out = set()
    for ref in sp.get("districts", []):
        out.add(ref.split(":", 1)[1])
    for ref in sp.get("landmarks", []):
        out.add(LANDMARK_DISTRICT[ref.split(":", 1)[1]])
    return out or set(DISTRICTS)


def test_enough_events_and_every_kind_used():
    assert len(EVENTS) >= MIN_EVENTS
    assert {e["kind"] for e in EVENTS} == KINDS


def test_every_event_is_a_person_with_a_motive():
    for e in EVENTS:
        assert e["motive"]["kho"].strip() and e["motive"]["tap"].strip(), e["id"]
        assert e["description"]["vi"].strip(), e["id"]


def test_every_event_is_a_real_fork():
    for e in EVENTS:
        effects = [json.dumps(c["effect"], sort_keys=True) for c in e["choices"]]
        assert len(set(effects)) == len(effects), f"{e['id']}: two choices with the same consequence"
        assert any(c["effect"] for c in e["choices"]), f"{e['id']}: no choice changes anything"
        for c in e["choices"]:
            assert c.get("outcome", {}).get("vi"), f"{e['id']}/{c['id']}: the player must see what happened"
            if "minigame" in c:
                assert "fail_effect" in c, f"{e['id']}/{c['id']}: minigame without fail_effect"


def test_every_district_gets_street_life():
    per = {d: 0 for d in DISTRICTS}
    for e in EVENTS:
        for d in _districts_of(e):
            per[d] += 1
    thin = {d: n for d, n in per.items() if n < MIN_PER_DISTRICT}
    assert not thin, thin


def test_spawn_filters_are_sane():
    for e in EVENTS:
        sp = e["spawn"]
        assert 0 < sp["chance_per_game_hour"] <= 0.5, e["id"]  # >0.5/h would make it a nuisance
        if "hours" in sp:
            a, b = sp["hours"]
            assert a != b, e["id"]
