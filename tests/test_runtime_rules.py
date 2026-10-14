"""Rules of the chapter 3-5 minigame modes and of the flood layer bao_so_3_2027 (tools/runtime_rules.py,
the reference both engines implement): the golden file the Unity tests replay is fresh, the story beats
come out of the data, losing has a consequence, and both engines carry the same rules."""

import json
import pathlib
import re
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

import runtime_rules as rr  # noqa: E402

UE = ROOT / "ue5" / "Plugins" / "HanoiCity" / "Source" / "HanoiCityRuntime"
CS = ROOT / "unity" / "Packages" / "com.vncity.hanoicity" / "Runtime" / "Core"
CONTENT = ROOT / "game" / "content"

MODES = rr.load_items("minigame_modes")
LAYER = rr.load_items("flood_layers")["bao_so_3_2027"]
TABLE = rr.depth_table(LAYER)


def _missions():
    out = {}
    for f in sorted((CONTENT / "missions").glob("*.json")):
        for m in json.loads(f.read_text(encoding="utf-8"))["items"]:
            out[m["id"]] = m
    return out


MISSIONS = _missions()


def _mode_steps():
    for m in MISSIONS.values():
        for s in m["steps"]:
            if s.get("params", {}).get("mode") in MODES:
                yield m, s


def _depth(zone_id, t):
    zone = next(z for z in LAYER["zones"] if z["id"] == zone_id)
    return rr.zone_depth(LAYER, TABLE, zone, t)


def test_golden_file_is_fresh():
    assert rr.GOLDEN.read_text(encoding="utf-8") == rr.render(), "run python tools/runtime_rules.py"


# ----------------------------------------------------------------------------- minigames

def test_ledger_gives_the_460_million_of_chapter_3():
    m = MODES["dung_lai_dong_tien"]
    assert rr.ledger_owed(m) == 460_000_000
    assert abs(rr.ledger_owed(m) - m["ledger"]["expected_owed_vnd"]) <= m["ledger"]["tolerance_vnd"]


@pytest.mark.parametrize("mission,step", [(m["id"], s["id"]) for m, s in _mode_steps()])
def test_every_mode_step_is_winnable_and_losable(mission, step):
    s = next(x for x in MISSIONS[mission]["steps"] if x["id"] == step)
    p, mode = s["params"], MODES[s["params"]["mode"]]
    win = rr.perfect_play(mode, p)
    assert win.outcome == rr.DAT
    # one mistake on a critical task (sort) / a critical forbidden move (sequence) loses it
    lose = rr.Session(mode, p)
    if lose.sorting:
        cr = next(t for t in lose.tasks if t.get("critical"))
        other = next(lb["id"] for lb in mode["labels"] if lb["id"] != cr["answer"])
        lose.answer(cr["id"], other)
    else:
        lose.perform(next(t["id"] for t in lose.tasks if t.get("forbidden") and t.get("critical")))
    assert lose.finished and lose.outcome == rr.CHUA_DAT
    assert set(s["next"]) >= {rr.DAT, rr.CHUA_DAT}, "both outcomes are branches of the mission"


def test_difficulty_four_adds_tasks_to_every_mode():
    for mid, m in MODES.items():
        assert len(rr.tasks_in_play(m, 4)) > len(rr.tasks_in_play(m, 3)) or all(t.get("min_difficulty", 0) <= 3 for t in m["tasks"]), mid
    assert any(len(rr.tasks_in_play(m, 4)) > len(rr.tasks_in_play(m, 3)) for m in MODES.values())


def test_running_out_of_time_loses():
    m = MODES["tham_dinh_cheo"]
    s = rr.Session(m, {"difficulty": 3, "pass_score": 80, "max_faults": 2, "time_limit_s": 180})
    s.tick(181)
    assert s.timed_out and s.outcome == rr.CHUA_DAT


def _flags_read():
    """Every flag some condition reads (dialogue lines/choices, missions requires, steps)."""
    read = set()

    def walk(x):
        if isinstance(x, dict):
            for k, v in x.items():
                if k in ("flags", "not_flags") and isinstance(v, list):
                    read.update(v)
                else:
                    walk(v)
            # branch_source flag: branch keys are flags
            if x.get("params", {}).get("branch_source") == "flag" and isinstance(x.get("next"), dict):
                read.update(k for k in x["next"] if k != "default")
        elif isinstance(x, list):
            for v in x:
                walk(v)

    for f in CONTENT.rglob("*.json"):
        walk(json.loads(f.read_text(encoding="utf-8")))
    return read


def _retries_after_a_wait(mission, lost):
    """The lost branch leads back to the same minigame through a wait_until (the price is a night)."""
    steps = {x["id"]: x for x in mission["steps"]}
    seen, cur, waited = set(), lost, False
    while cur and cur["id"] not in seen:
        seen.add(cur["id"])
        waited |= cur["kind"] == "wait_until"
        nxt = cur.get("next")
        if not isinstance(nxt, str):
            return False
        cur = steps.get(nxt)
        if cur and cur.get("params", {}).get("mode") in MODES:
            return waited
    return False


def test_losing_a_mode_minigame_has_a_consequence():
    """Tứ diệu đế: the chua_dat branch sets a flag that a later condition reads, or costs a night and a retry."""
    read = _flags_read()
    for m, s in _mode_steps():
        steps = {x["id"]: x for x in m["steps"]}
        lost = steps[s["next"][rr.CHUA_DAT]]
        if _retries_after_a_wait(m, lost):
            continue
        flags = lost.get("set_flags", [])
        assert flags, f"{m['id']}/{lost['id']} sets no flag"
        assert any(f in read for f in flags), f"{m['id']}/{lost['id']}: {flags} never read"


def test_losing_a_chapter_4_minigame_takes_an_ending_choice_away():
    ch5 = json.loads((CONTENT / "dialogues" / "chapter5.json").read_text(encoding="utf-8"))
    gated = set()
    for d in ch5["items"]:
        for line in d.get("lines", []):
            for c in line.get("choices", []) or []:
                gated.update((c.get("condition") or {}).get("not_flags", []))
    ch4 = [(m, s) for m, s in _mode_steps() if m.get("chapter") == 4]
    assert len(ch4) == 2
    for m, s in ch4:
        steps = {x["id"]: x for x in m["steps"]}
        flags = steps[s["next"][rr.CHUA_DAT]].get("set_flags", [])
        assert gated & set(flags), f"{m['id']}/{s['id']}: losing does not gate a chapter 5 choice"


# ----------------------------------------------------------------------------- flood

def test_bai_giua_closes_to_motorbikes_at_20h():
    """c3_07: the loa phường says the bridge closes at 20:00; Minh has to get ông Bảy out before."""
    xe_may = LAYER["passable_depth_m"]["xe_may"]
    assert _depth("bai_giua_phuc_xa", 1.0) < xe_may          # 19:00 Minh arrives
    assert _depth("bai_giua_phuc_xa", 1.75) < xe_may         # 19:45 still passable
    assert _depth("bai_giua_phuc_xa", 2.0) >= xe_may         # 20:00 not any more
    c = LAYER["closures"][0]
    assert not rr.closure_active(LAYER, c, 1.99) and rr.closure_active(LAYER, c, 2.0)


def test_hang_chieu_peaks_at_midnight_and_drains_by_morning():
    """c3_08 records a ~40 cm water mark in ngõ Hàng Chiếu; Khôi's gác is reached at 22:36."""
    depths = {t / 4: _depth("ngo_hang_chieu", t / 4) for t in range(0, 73)}
    peak_t = max(depths, key=depths.get)
    assert 5.5 <= peak_t <= 6.5, peak_t                     # around midnight
    assert 0.38 <= depths[peak_t] <= 0.5
    assert depths[3.5] > LAYER["passable_depth_m"]["di_bo"] * 0.3   # 21:30 Lan's kitchen is wet
    assert depths[12.0] < 0.1                                        # 06:00 the lane drains


def test_river_crosses_alarm_two_and_world_event_follows_the_rain():
    alarms = LAYER["gauge"]["alarm_m"]
    assert rr.river_at(LAYER, 0) > alarms[1]
    assert max(rr.river_at(LAYER, t / 4) for t in range(73)) < alarms[2]
    assert not rr.world_events_on(LAYER, TABLE, 0) and rr.world_events_on(LAYER, TABLE, 3)


# ----------------------------------------------------------------------------- engine parity

def test_both_engines_have_the_new_systems():
    for h in ("HanoiMinigameSubsystem", "HanoiFloodSubsystem", "HanoiCollectibleSubsystem", "HanoiRandomEventSubsystem"):
        assert (UE / "Public" / f"{h}.h").exists() and (UE / "Private" / f"{h}.cpp").exists(), h
    for c in ("MinigameSystem", "FloodSystem", "CollectibleSystem", "RandomEventSystem"):
        assert (CS / "Systems" / f"{c}.cs").exists(), c


def test_time_limit_on_a_branching_step_is_a_loss_in_both_engines():
    ue = (UE / "Private" / "HanoiMissionSubsystem.cpp").read_text(encoding="utf-8")
    cs = (CS / "Systems" / "MissionRunner.cs").read_text(encoding="utf-8")
    assert re.search(r"StepElapsed > TimeLimit && StepBranchesOnFailure\(\) && IsStepGateOpen\(\)\)\s*\{[^}]*Advance\(OutcomeFailed\)", ue)
    assert re.search(r"StepElapsed > TimeLimit && !StepBranchesOnFailure\(\)", ue)
    assert re.search(r"stepElapsed > limit && StepBranchesOnFailure && StepGateOpen\)\s*\{[^}]*Advance\(OutcomeFailed\)", cs)
    assert re.search(r"stepElapsed > limit && !StepBranchesOnFailure\)", cs)


def test_minigame_and_flood_rules_match_in_both_engines():
    ue_m = (UE / "Private" / "HanoiMinigameSubsystem.cpp").read_text(encoding="utf-8")
    cs_m = (CS / "Systems" / "MinigameSystem.cs").read_text(encoding="utf-8")
    assert "(100 * Points) / Total" in ue_m and "100 * Points / TotalPoints" in cs_m
    assert "FaultWeight > 0 ? Task.FaultWeight : 1" in ue_m and "FaultWeight ?? 1" in cs_m
    assert "RoundHalfToEven" in ue_m and "MidpointRounding.ToEven" in cs_m
    ue_f = (UE / "Private" / "HanoiFloodSubsystem.cpp").read_text(encoding="utf-8")
    cs_f = (CS / "Systems" / "FloodSystem.cs").read_text(encoding="utf-8")
    for pat in (r"/ 1000\.0 \* double\(Layer\.StepH\)", r"FloorToInt\(X \+ HanoiFlood::Eps\)", r"K\.TH <= T \+ HanoiFlood::Eps"):
        assert re.search(pat, ue_f), pat
    for pat in (r"/ 1000\.0 \* layer\.StepH", r"Math\.Floor\(x \+ Eps\)", r"k\.TH <= t \+ Eps"):
        assert re.search(pat, cs_f), pat


def test_coupon_spot_hash_is_the_same_in_both_engines():
    ue = (UE / "Private" / "HanoiCollectibleSubsystem.cpp").read_text(encoding="utf-8")
    cs = (CS / "Systems" / "CollectibleSystem.cs").read_text(encoding="utf-8")
    for a, b in (("2166136261", "2166136261"), ("16777619", "16777619"), ("H % 3600u", "h % 3600"), ("(H >> 12) % 1000u", "(h >> 12) % 1000"), ("0.4 + 0.6", "0.4 + 0.6")):
        assert a in ue and b in cs, (a, b)
