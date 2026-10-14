"""Reference model of the data-driven runtime rules that both engines implement.

The UE plugin (C++, not compiled in CI) and the Unity core (C#, compiled and tested in CI) each
implement these rules from game/content. This file is the third, executable statement of the same
rules, written to be read: tests/test_runtime_rules.py checks the story against it (the flood
reaches the beats the dialogue describes, the minigames can be won and lost the way the chapters
need), and it writes tests/golden/runtime_rules.json, which the Unity tests replay so the C# gives
the same numbers to the last bit.

1. Minigame modes (game/content/minigame_modes.json, schema minigame_modes.schema.json):
   tasks in play = tasks whose min_difficulty <= step difficulty. phan_loai: each task is answered
   once with a label; right = its points, wrong = fault_weight faults. sap_xep: each task is
   performed once; a non-forbidden task is right when every in-play non-forbidden task of a lower
   order is already done (done out of order it is spent without points and is a fault); a forbidden
   task is a fault. A critical task that goes wrong ends the game at once. The game is complete
   when every in-play task is answered (phan_loai) or every non-forbidden task is performed
   (sap_xep). score = floor(100 * points right / points in play). Outcome dat when complete, no
   critical failure, score >= pass_score, faults <= max_faults and the time limit did not run out;
   otherwise chua_dat.
   Ledger modes: owed = principal + principal * rate * months(start..as_of) / 12 - paid, where
   principal / paid are the amounts of the tasks whose answer is the ledger's labels.

2. Flood layers (game/content/flood_layers.json): see flood_layers.schema.json. Depth table at
   t_i = i * step_h, i = 0..round(duration_h / step_h); rain zones integrate forward from 0 with
   rain and river read at the start of each step; depth between table points is interpolated
   linearly; river zones read the river directly.

3. Steps with a time limit (missions): a step whose `next` has a chua_dat branch ends chua_dat
   when params.time_limit_s runs out instead of failing the mission (the loss has a price, it is
   not a game over); any other step still fails the mission (reason time_limit).

Usage:
  python tools/runtime_rules.py            # write tests/golden/runtime_rules.json
  python tools/runtime_rules.py --check    # exit 1 if the golden file is stale
"""

import argparse
import json
import math
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTENT = ROOT / "game" / "content"
GOLDEN = ROOT / "tests" / "golden" / "runtime_rules.json"

DAT, CHUA_DAT = "dat", "chua_dat"
EPS = 1e-9


def load_items(name):
    doc = json.loads((CONTENT / f"{name}.json").read_text(encoding="utf-8"))
    return {it["id"]: it for it in doc["items"]}


# ----------------------------------------------------------------------------- minigames

def tasks_in_play(mode, difficulty):
    return [t for t in mode["tasks"] if t.get("min_difficulty", 0) <= difficulty]


class Session:
    """One play of a minigame mode at a step's params (difficulty, pass_score, max_faults, time_limit_s)."""

    def __init__(self, mode, params):
        self.mode = mode
        self.params = params
        self.tasks = tasks_in_play(mode, int(params.get("difficulty", 0)))
        self.by_id = {t["id"]: t for t in self.tasks}
        self.done = []          # task ids in the order they were answered / performed
        self.right = set()
        self.points = 0
        self.faults = 0
        self.critical_failed = False
        self.timed_out = False

    @property
    def total_points(self):
        return sum(t["points"] for t in self.tasks if not t.get("forbidden"))

    @property
    def sorting(self):
        return self.mode["mechanic"] == "phan_loai"

    def _wrong(self, t):
        self.faults += t.get("fault_weight", 1)
        if t.get("critical"):
            self.critical_failed = True

    def answer(self, task_id, label):
        """phan_loai. Returns True when the answer is right; False for a wrong, unknown or repeated answer."""
        t = self.by_id.get(task_id)
        if not self.sorting or t is None or task_id in self.done or self.finished:
            return False
        self.done.append(task_id)
        if label == t.get("answer"):
            self.right.add(task_id)
            self.points += t["points"]
            return True
        self._wrong(t)
        return False

    def perform(self, task_id):
        """sap_xep. Returns True when the step was right (in order, not forbidden)."""
        t = self.by_id.get(task_id)
        if self.sorting or t is None or task_id in self.done or self.finished:
            return False
        self.done.append(task_id)
        if t.get("forbidden"):
            self._wrong(t)
            return False
        order = t.get("order", 0)
        ready = all(o["id"] in self.done for o in self.tasks
                    if not o.get("forbidden") and o.get("order", 0) < order)
        if ready:
            self.right.add(task_id)
            self.points += t["points"]
            return True
        self._wrong(t)
        return False

    @property
    def complete(self):
        needed = [t for t in self.tasks if not (not self.sorting and t.get("forbidden"))]
        return all(t["id"] in self.done for t in needed)

    @property
    def finished(self):
        return self.critical_failed or self.timed_out or self.complete

    @property
    def score(self):
        total = self.total_points
        return 100 if total == 0 else math.floor(100 * self.points / total + EPS)

    def tick(self, seconds_elapsed):
        limit = self.params.get("time_limit_s", 0)
        if limit and seconds_elapsed > limit and not self.finished:
            self.timed_out = True

    @property
    def outcome(self):
        ok = (self.complete and not self.critical_failed and not self.timed_out
              and self.score >= self.params.get("pass_score", 0)
              and self.faults <= self.params.get("max_faults", 1 << 30))
        return DAT if ok else CHUA_DAT

    def result(self):
        return {"score": self.score, "faults": self.faults, "complete": self.complete,
                "critical_failed": self.critical_failed, "timed_out": self.timed_out,
                "outcome": self.outcome}


def perfect_play(mode, params):
    """Every task right: the answer for sorting, the procedure in order (forbidden tasks skipped)."""
    s = Session(mode, params)
    if s.sorting:
        for t in s.tasks:
            s.answer(t["id"], t["answer"])
    else:
        for t in sorted((t for t in s.tasks if not t.get("forbidden")), key=lambda t: (t["order"], t["id"])):
            s.perform(t["id"])
    return s


def months_between(a, b):
    ya, ma = map(int, a.split("-"))
    yb, mb = map(int, b.split("-"))
    return (yb - ya) * 12 + (mb - ma)


def ledger_owed(mode):
    """Amount owed under the law from the ledger's right answers (None for a mode without a ledger)."""
    lg = mode.get("ledger")
    if not lg:
        return None
    principal = sum(t.get("amount_vnd", 0) for t in mode["tasks"] if t.get("answer") == lg["principal_label"])
    paid = sum(t.get("amount_vnd", 0) for t in mode["tasks"] if t.get("answer") == lg["paid_label"])
    years = months_between(lg["start"], lg["as_of"]) / 12.0
    return round(principal + principal * lg["legal_rate_per_year"] * years - paid)


# ----------------------------------------------------------------------------- flood

def river_at(layer, t):
    tl = layer["timeline"]
    if t <= tl[0]["t_h"]:
        return tl[0]["river_m"]
    for a, b in zip(tl, tl[1:]):
        if a["t_h"] <= t < b["t_h"]:
            return a["river_m"] + (b["river_m"] - a["river_m"]) * (t - a["t_h"]) / (b["t_h"] - a["t_h"])
    return tl[-1]["river_m"]


def rain_at(layer, t):
    rain = layer["timeline"][0]["rain_mm_h"]
    for k in layer["timeline"]:
        if k["t_h"] <= t + EPS:
            rain = k["rain_mm_h"]
    return rain


def depth_table(layer):
    """{zone id: [depth at t_i]} for rain zones; river zones are read live (river_depth)."""
    n = int(round(layer["duration_h"] / layer["step_h"]))
    dr = layer["drainage"]
    out = {}
    for z in layer["zones"]:
        if z["cause"] != "mua":
            continue
        d, col = 0.0, [0.0]
        for i in range(n):
            t = i * layer["step_h"]
            drain = z["drain_mm_h"] * (dr["pump_share"] if river_at(layer, t) >= dr["gravity_block_river_m"] else 1.0)
            d = d + (rain_at(layer, t) * z["catchment"] - drain) / 1000.0 * layer["step_h"]
            d = min(max(d, 0.0), z["max_depth_m"])
            col.append(d)
        out[z["id"]] = col
    return out


def zone_depth(layer, table, zone, t):
    if t < 0 or t > layer["duration_h"] + EPS:
        return 0.0
    if zone["cause"] == "song":
        return max(0.0, river_at(layer, t) - zone["floor_m"])
    col = table[zone["id"]]
    x = t / layer["step_h"]
    i = min(int(math.floor(x + EPS)), len(col) - 1)
    if i >= len(col) - 1:
        return col[-1]
    f = x - i
    return col[i] + (col[i + 1] - col[i]) * f


def passable(layer, depth, vehicle):
    return depth < layer["passable_depth_m"][vehicle]


def closure_active(layer, closure, t):
    return (0 <= t <= layer["duration_h"] + EPS and t + EPS >= closure["from_h"]
            and river_at(layer, t) >= closure["river_m_at_least"])


def world_events_on(layer, table, t):
    return any(zone_depth(layer, table, z, t) > layer["slow_depth_m"] for z in layer["zones"] if z["cause"] == "mua")


# ----------------------------------------------------------------------------- golden

# Scripted plays every engine must score the same way: (name, mode, step params, actions).
# Actions: ["answer", task, label] / ["perform", task] / ["tick", seconds].
def _plays(modes):
    def sorted_ids(m, d):
        return [t["id"] for t in sorted((t for t in tasks_in_play(m, d) if not t.get("forbidden")),
                                        key=lambda t: (t["order"], t["id"]))]
    plays = []
    for mid, m in sorted(modes.items()):
        for d in (3, 4):
            p = {"difficulty": d, "pass_score": 80 if d == 3 else 85, "max_faults": 2, "time_limit_s": 180}
            if m["mechanic"] == "phan_loai":
                tasks = tasks_in_play(m, d)
                perfect = [["answer", t["id"], t["answer"]] for t in tasks]
                plays.append((f"{mid}_d{d}_perfect", mid, p, perfect))
                # one wrong label on the first non-critical task, everything else right
                nc = next(t for t in tasks if not t.get("critical"))
                other = next(lb["id"] for lb in m["labels"] if lb["id"] != nc["answer"])
                plays.append((f"{mid}_d{d}_one_wrong", mid, p,
                              [["answer", nc["id"], other] if a[1] == nc["id"] else a for a in perfect]))
                # a critical task wrong (the bo_sot / sai_so of the story)
                cr = next((t for t in tasks if t.get("critical")), None)
                if cr:
                    other = next(lb["id"] for lb in m["labels"] if lb["id"] != cr["answer"])
                    plays.append((f"{mid}_d{d}_critical_wrong", mid, p,
                                  [["answer", cr["id"], other] if a[1] == cr["id"] else a for a in perfect]))
                plays.append((f"{mid}_d{d}_timeout", mid, p, perfect[:2] + [["tick", 181]] + perfect[2:]))
            else:
                ids = sorted_ids(m, d)
                plays.append((f"{mid}_d{d}_perfect", mid, p, [["perform", i] for i in ids]))
                swapped = ids[:]
                swapped[1], swapped[2] = swapped[2], swapped[1]
                plays.append((f"{mid}_d{d}_out_of_order", mid, p, [["perform", i] for i in swapped]))
                non_critical = [t["id"] for t in tasks_in_play(m, d) if t.get("forbidden") and not t.get("critical")]
                if non_critical:
                    plays.append((f"{mid}_d{d}_one_forbidden", mid, p,
                                  [["perform", ids[0]], ["perform", non_critical[0]]] + [["perform", i] for i in ids[1:]]))
                crit = [t["id"] for t in tasks_in_play(m, d) if t.get("forbidden") and t.get("critical")]
                if crit:
                    plays.append((f"{mid}_d{d}_critical", mid, p,
                                  [["perform", ids[0]], ["perform", crit[0]]] + [["perform", i] for i in ids[1:]]))
    return plays


def run_play(mode, params, actions):
    s = Session(mode, params)
    elapsed = 0.0
    for a in actions:
        if a[0] == "answer":
            s.answer(a[1], a[2])
        elif a[0] == "perform":
            s.perform(a[1])
        elif a[0] == "tick":
            elapsed += a[1]
            s.tick(elapsed)
    return s.result()


def golden():
    modes = load_items("minigame_modes")
    layers = load_items("flood_layers")
    out = {"_note": "Generated by tools/runtime_rules.py; replayed by unity/.../Tests/Core/RuntimeRulesGoldenTests.cs.",
           "minigames": [], "ledgers": {}, "floods": {}}
    for name, mid, p, actions in _plays(modes):
        out["minigames"].append({"name": name, "mode": mid, "params": p, "actions": actions,
                                 "result": run_play(modes[mid], p, actions)})
    for mid, m in sorted(modes.items()):
        if m.get("ledger"):
            out["ledgers"][mid] = ledger_owed(m)
    for lid, layer in sorted(layers.items()):
        table = depth_table(layer)
        samples = []
        t = 0.0
        while t <= layer["duration_h"] + EPS:
            samples.append({"t_h": round(t, 6), "river_m": round(river_at(layer, t), 9),
                            "rain_mm_h": rain_at(layer, t),
                            "depth_m": {z["id"]: round(zone_depth(layer, table, z, t), 9) for z in layer["zones"]},
                            "closures": [c["id"] for c in layer.get("closures", []) if closure_active(layer, c, t)],
                            "world_events_on": world_events_on(layer, table, t)})
            t += 0.5
        out["floods"][lid] = samples
    return out


def render():
    return json.dumps(golden(), ensure_ascii=False, indent=1, sort_keys=True) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args(argv)
    text = render()
    if a.check:
        if not GOLDEN.exists() or GOLDEN.read_text(encoding="utf-8") != text:
            print(f"{GOLDEN} is stale; run python tools/runtime_rules.py", file=sys.stderr)
            return 1
        print("runtime golden up to date")
        return 0
    GOLDEN.parent.mkdir(parents=True, exist_ok=True)
    GOLDEN.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {GOLDEN.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
