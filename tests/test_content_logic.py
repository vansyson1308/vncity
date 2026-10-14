"""Playthrough-level checks of game/content against the mission runtime's semantics: every flag
a mission or activity reads is set by content or by the runtime, no step or dialogue line is dead,
the unlock/requires graph agrees with itself, and the runtime behaviours the content relies on
(protagonist possession, first-step requires_event gate, clean-record flag) exist in the C++."""
import collections
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "game" / "content"
MISSION_CPP = ROOT / "ue5" / "Plugins" / "HanoiCity" / "Source" / "HanoiCityRuntime" / "Private" / "HanoiMissionSubsystem.cpp"
HEAT_CPP = MISSION_CPP.with_name("HanoiHeatSubsystem.cpp")
TERMINAL = {"end", "success", "fail"}

# Flags the runtime sets itself (docs/gdd/02-he-thong.md §1); content may read them without setting them.
RUNTIME_FLAGS = {"ho_so_sach_90_ngay"}


def _load(sub):
    out = {}
    for p in sorted(CONTENT.glob(sub)):
        for it in json.loads(p.read_text(encoding="utf-8"))["items"]:
            out[it["id"]] = it
    return out


MISSIONS = _load("missions/*.json")
DIALOGUES = _load("dialogues/*.json")
ACTIVITIES = _load("activities.json")


def _step_targets(mission, step):
    ids = [s["id"] for s in mission["steps"]]
    nxt = step.get("next")
    if isinstance(nxt, str):
        return [nxt]
    if isinstance(nxt, dict):
        return list(nxt.values())
    k = ids.index(step["id"]) + 1
    return [ids[k]] if k < len(ids) else ["end"]


def test_every_flag_read_is_set_by_content_or_runtime():
    flags_set, flags_read = set(RUNTIME_FLAGS), collections.defaultdict(set)
    for m in MISSIONS.values():
        flags_set |= set((m.get("reward") or {}).get("set_flags", []))
        for f in (m.get("requires") or {}).get("flags", []):
            flags_read[f].add(f"requires {m['id']}")
        for s in m["steps"]:
            flags_set |= set(s.get("set_flags", []))
            for rule in s.get("fail_if", []):
                if rule.startswith("flag:"):
                    flags_read[rule[5:]].add(f"fail_if {m['id']}.{s['id']}")
            p = s.get("params") or {}
            if p.get("branch_source") == "flag":
                for k in s["next"]:
                    if k != "default":
                        flags_read[k].add(f"branch {m['id']}.{s['id']}")
            for key in ("reacts_to_flags", "variant_from_flags"):
                for f in p.get(key) or []:
                    flags_read[f].add(f"{key} {m['id']}.{s['id']}")
    for d in DIALOGUES.values():
        for line in d["lines"]:
            for c in line.get("choices", []):
                flags_set |= set((c.get("effect") or {}).get("set_flags", []))
    for a in ACTIVITIES.values():
        for f in (a.get("requires") or a.get("unlock") or {}).get("flags", []):
            flags_read[f].add(f"activity {a['id']}")
    missing = {f: sorted(w) for f, w in flags_read.items() if f not in flags_set}
    assert not missing, f"flags read but never set: {missing}"


def test_runtime_sets_the_clean_record_flag_and_resets_it_on_fines():
    cpp = MISSION_CPP.read_text(encoding="utf-8")
    assert 'CleanRecordFlag(TEXT("ho_so_sach_90_ngay"))' in cpp
    assert "CleanRecordDays" in cpp and "LastFineGameTime" in cpp
    # both fine paths restart the counter
    assert cpp.count("RecordFine()") >= 2
    assert "RecordFine()" in HEAT_CPP.read_text(encoding="utf-8")


def test_start_mission_possesses_the_missions_protagonist():
    cpp = MISSION_CPP.read_text(encoding="utf-8")
    start = cpp[cpp.index("UHanoiMissionSubsystem::StartMission"):cpp.index("UHanoiMissionSubsystem::AbandonMission")]
    assert "Protagonists[0]" in start and "SwitchProtagonist" in start
    # every mission names at least one protagonist, so the possession rule always applies
    for m in MISSIONS.values():
        assert m.get("protagonists"), m["id"]


def test_first_step_requires_event_gates_mission_start():
    cpp = MISSION_CPP.read_text(encoding="utf-8")
    assert "FirstStepRequiredEvent" in cpp and "waits for event" in cpp
    gated = [m["id"] for m in MISSIONS.values() if (m["steps"][0].get("params") or {}).get("requires_event")]
    assert "c1_08_pho_di_bo_toi_thu_bay" in gated and "s11_cu_ba_lac_duong" in gated


def test_no_dead_steps_and_every_branch_table_has_a_default_unless_player_input():
    for m in MISSIONS.values():
        ids = [s["id"] for s in m["steps"]]
        reach, stack = set(), [ids[0]]
        while stack:
            x = stack.pop()
            if x in reach or x not in ids:
                continue
            reach.add(x)
            stack += _step_targets(m, m["steps"][ids.index(x)])
        assert reach == set(ids), f"{m['id']}: unreachable steps {sorted(set(ids) - reach)}"
        for s in m["steps"]:
            nxt = s.get("next")
            if isinstance(nxt, dict):
                p = s.get("params") or {}
                if p.get("branch_source") == "player_input" or (s["kind"] == "choice" and "player_input" in p):
                    continue  # UI can only answer with the listed keys
                assert "default" in nxt, f"{m['id']}.{s['id']}: branch table from gameplay needs a default"


def test_no_dead_dialogue_lines():
    for d in DIALOGUES.values():
        ids = [l["id"] for l in d["lines"]]
        by_id = {l["id"]: l for l in d["lines"]}
        reach, stack = set(), [ids[0]]
        while stack:
            x = stack.pop()
            if x in reach or x not in by_id:
                continue
            reach.add(x)
            line = by_id[x]
            if "choices" in line:
                stack += [c["goto"] for c in line["choices"]]
            elif "goto" in line:
                stack.append(line["goto"])
            else:
                k = ids.index(x) + 1
                if k < len(ids):
                    stack.append(ids[k])
        assert reach == set(ids), f"{d['id']}: unreachable lines {sorted(set(ids) - reach)}"


def test_unlocks_cover_the_requires_graph():
    """A mission listed in another's `unlocks` is startable right after it only if that mission is
    its last prerequisite; so every prerequisite of a story mission lists it, or none does."""
    unlocked_by = collections.defaultdict(set)
    for m in MISSIONS.values():
        for u in m.get("unlocks", []):
            if u.startswith("missions:"):
                unlocked_by[u.split(":", 1)[1]].add(m["id"])
    for mid, m in MISSIONS.items():
        req = {r.split(":", 1)[1] for r in (m.get("requires") or {}).get("missions_completed", [])}
        assert unlocked_by[mid] <= req, f"{mid}: unlocked by {sorted(unlocked_by[mid] - req)} which it does not require"
        if m["type"] == "story" and unlocked_by[mid]:
            assert unlocked_by[mid] == req, f"{mid}: unlocked by {sorted(unlocked_by[mid])} but requires {sorted(req)}"


def test_every_mission_is_reachable_from_a_new_game():
    done, remaining = [], set(MISSIONS)
    while remaining:
        ready = sorted(x for x in remaining
                       if {r.split(":", 1)[1] for r in (MISSIONS[x].get("requires") or {}).get("missions_completed", [])} <= set(done))
        assert ready, f"unreachable or cyclic: {sorted(remaining)}"
        done += ready
        remaining -= set(ready)
    assert done[0] == "p1_cuoc_xe_luc_rang_dong"
