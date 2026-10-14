"""Dry-run the story the way a player would, without an engine.

The game content is data (missions, dialogues, flags, rewards, places, time windows). This tool
walks that data like a GTA-style session: it starts at the prologue, picks every mission that
becomes available, travels between step targets on the real map (1:1 distances, Hanoi speeds),
reads dialogue, makes choices, earns and spends money, sets flags, and advances the clock in the
"48-minute day" rhythm. Several player personas run the same content with different choice
policies so branches and consequences are all exercised.

What it checks (logic, not taste):
  * reachability: every mission can be started by some persona; flags that gate content are set
    somewhere; `next` keys and dialogue `goto`s resolve; unlocks point at real content
  * time: steps that say "6 a.m." after a ride that takes four game hours at 30x clock speed;
    time windows (`hours`, `deadline_hour`) that no route can meet; missions that need an event
    or weather that nothing in the run makes active
  * geography: how far each step moves the player, which districts and landmarks the story
    visits, which districts it never touches
  * economy: money per protagonist after the written content, against the GDD price list
    (repair shop 120M, cô Hạnh's share ~3 billion) and the flat income of a working day
  * cast and consequence: who the player meets, which choices are read later (flags consumed)
    and which are set but never read (a choice with no consequence); conditional dialogue lines
    and choices (`condition.flags` / `not_flags`) are evaluated the way the runtime does, so the
    report counts how many consequences each persona actually triggered and how far the personas'
    paths diverge (steps and lines only some of them saw)
  * opening: real minutes until the player first holds the controls, until the first choice, the
    longest stretch without control in the first 20 minutes, and when the central stake (the house
    and the 1957 paper) is first spoken

Output: out/playtest/<persona>.json (full timeline), out/playtest/summary.json, and a Markdown
report printed to stdout (`--report docs/gdd/06-gia-lap-choi-thu.md` writes it). Exit code 1 if a
hard error (dead end, unreachable story mission, broken reference) is found, so CI can run it.

Usage:
  python tools/playtest.py [--personas all|tu_te,lieu,toi_uu_tien,ngau_nhien] [--seed 1] [--report path]
"""

import argparse
import collections
import glob
import json
import math
import pathlib
import random
import sys
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTENT = ROOT / "game" / "content"

# --- the rules of the dry run (documented assumptions, not engine truth) --------------------
GAME_DAY_REAL_MIN = 48.0                      # docs/gdd/01: one game day = 48 real minutes
CLOCK_RATE = 24 * 60 / GAME_DAY_REAL_MIN      # 30 game minutes per real minute
SPEED_KMH = {"ride": 22.0, "drive_passenger": 20.0, "deliver": 20.0, "follow": 15.0, "go_to": 18.0,
             "escape_traffic_police": 30.0, "walk": 4.5, "cyclo": 8.0, "bicycle": 12.0}
STEP_REAL_MIN = {"talk": 1.5, "cutscene": 2.0, "photograph": 2.5, "minigame": 6.0, "cook": 7.0,
                 "collect": 4.0, "choice": 0.5, "wait_until": 0.0, "escape_traffic_police": 3.0,
                 "follow": 2.0, "deliver": 2.0, "drive_passenger": 1.0, "go_to": 0.5, "ride": 0.5}
START_MONEY = {"minh": 1_200_000, "lan": 9_500_000, "khoi": 42_000_000}   # before the prologue (GDD bios); other playable characters start at 0
DAILY_NET_INCOME = {"minh": 350_000, "lan": 1_600_000, "khoi": 650_000}  # a working day between missions (GDD §kinh tế)
DAILY_COST = {"minh": 90_000, "lan": 120_000, "khoi": 150_000}           # food, parking, fuel
GOALS_VND = {"tiem_sua_xe_duc_coi": 120_000_000, "ca_phe_trung_hang_gai": 450_000_000,
             "phan_nha_co_hanh": 3_000_000_000}
RUNTIME_FLAGS = {"ho_so_sach_90_ngay": "90 game days without a traffic violation (docs/gdd/02-he-thong.md)",
                 "minh_nghe_dien_thoai_khi_lai": "gameplay: the player answered the phone while riding in c1_05 (docs/gdd/10 M2)"}
# flags content sets for the runtime to read (no mission or dialogue needs to read them)
RUNTIME_READ_FLAGS = {"giam_chu_y_vinh_vien_1": "UHanoiHeatSubsystem caps heat one star lower for good"}
CONTROL_KINDS = {"go_to", "ride", "deliver", "photograph", "follow", "escape_traffic_police", "minigame", "cook", "collect", "drive_passenger"}
STAKE_WORDS = ("tờ giấy", "bán nhà", "bán phần", "ký thỏa thuận", "nhà này của hai nhà", "không nhà nào bán")   # the central stake: the house and the 1957 paper


def load(collection, sub=None):
    items = []
    for p in sorted(glob.glob(str(CONTENT / (sub or "") / "**" / "*.json"), recursive=True)):
        doc = json.loads(pathlib.Path(p).read_text(encoding="utf-8"))
        if doc.get("collection") == collection:
            items += doc["items"]
    return items


def dist_km(a, b):
    k = 111.32
    return math.hypot((a["lat"] - b["lat"]) * k, (a["lon"] - b["lon"]) * k * math.cos(math.radians(a["lat"])))


class World:
    def __init__(self):
        self.missions = {m["id"]: m for m in load("missions")}
        self.dialogues = {d["id"]: d for d in load("dialogues")}
        self.landmarks = {l["id"]: l for l in load("landmarks")}
        self.districts = {d["id"]: d for d in load("districts")}
        self.characters = {c["id"]: c for c in load("characters")}
        self.activities = {a["id"]: a for a in load("activities")}
        self.events = {e["id"]: e for e in load("events")}
        self.items = {i["id"]: i for i in load("items")}
        self.businesses = {b["id"]: b for b in load("businesses")}
        self.rules = {r["id"]: r for r in load("traffic_rules")}
        self.flag_readers = collections.defaultdict(set)
        self.flag_writers = collections.defaultdict(set)
        self.flag_read_kinds = collections.defaultdict(set)   # flag -> {mission_gate, step_branch, step_variant, fail_if, dialogue_line, dialogue_choice, activity}
        self.choice_flags = set()                             # flags only a player decision can set
        self.index_flags()

    def place(self, target):
        """lat/lon of a step target, or None."""
        if target is None:
            return None, None
        if isinstance(target, dict):
            return target, None
        coll, _, tid = target.partition(":")
        if coll == "landmarks" and tid in self.landmarks:
            return self.landmarks[tid]["location"], tid
        if coll == "characters" and tid in self.characters and "home" in self.characters[tid]:
            return self.characters[tid]["home"], None
        return None, None

    def district_of(self, pt):
        if not pt:
            return None
        k = math.cos(math.radians(pt["lat"]))
        return min(self.districts.values(),
                   key=lambda d: ((d["center"]["lon"] - pt["lon"]) * k) ** 2 + (d["center"]["lat"] - pt["lat"]) ** 2)["id"]

    def index_flags(self):
        def read(f, mid, kind):
            self.flag_readers[f].add(mid)
            self.flag_read_kinds[f].add(kind)

        def cond_flags(cond):
            return list((cond or {}).get("flags", [])) + list((cond or {}).get("not_flags", []))

        for m in self.missions.values():
            mid = m["id"]
            for f in (m.get("reward") or {}).get("set_flags", []):
                self.flag_writers[f].add(mid)
            for f in cond_flags(m.get("requires")):
                read(f, mid, "mission_gate")
            branched = set()   # steps only reachable through a branch table = steps a decision led to
            for s in m["steps"]:
                if isinstance(s.get("next"), dict):
                    branched |= set(s["next"].values())
            for s in m["steps"]:
                for f in s.get("set_flags", []):
                    self.flag_writers[f].add(mid)
                    if s["id"] in branched:
                        self.choice_flags.add(f)
                for rule in s.get("fail_if", []):
                    if rule.startswith("flag:"):
                        read(rule[5:], mid, "fail_if")
                p = s.get("params") or {}
                if p.get("branch_source") == "flag":
                    for f in s["next"]:
                        if f != "default":
                            read(f, mid, "step_branch")
                for f in p.get("reacts_to_flags") or []:
                    read(f, mid, "step_variant")
                for f in (p.get("variant_from_flags") or {}):
                    read(f, mid, "step_variant")
        for d in self.dialogues.values():
            did = "dialogue:" + d["id"]
            for line in d["lines"]:
                for f in cond_flags(line.get("condition")):
                    read(f, did, "dialogue_line")
                for c in line.get("choices", []):
                    for f in (c.get("effect") or {}).get("set_flags", []):
                        self.flag_writers[f].add(did)
                        self.choice_flags.add(f)
                    for f in cond_flags(c.get("condition")):
                        read(f, did, "dialogue_choice")
        for a in self.activities.values():
            for f in cond_flags(a.get("requires") or a.get("unlock")):
                read(f, a["id"], "activity")

    def holds(self, cond, flags, rep, protagonist, active_events=(), done=None):
        """A dialogue/mission condition the way UHanoiMissionSubsystem::EvaluateCondition reads it
        (state only: flags, not_flags, events_active, min_reputation, protagonist, missions_completed)."""
        c = cond or {}
        if any(f not in flags for f in c.get("flags", [])):
            return False
        if any(f in flags for f in c.get("not_flags", [])):
            return False
        if any(x.split(":", 1)[1] not in active_events for x in c.get("events_active", [])):
            return False
        if done is not None and any(x.split(":", 1)[1] not in done for x in c.get("missions_completed", [])):
            return False
        if any(rep[k] < v for k, v in (c.get("min_reputation") or {}).items()):
            return False
        if c.get("protagonist") and protagonist not in [x.split(":", 1)[1] for x in c["protagonist"]]:
            return False
        return True


# --- personas: how choices get made ------------------------------------------------------
KEYWORDS = {
    "tu_te": (["dừng", "giữ", "thật", "giúp", "không bán", "xin phép", "trả", "chuẩn", "từ chối", "kể", "đúng",
               "hỏi tên", "chậm", "nhường", "đội mũ"], ["vượt", "giấu", "rẻ", "nhận việc", "bán", "đăng"]),
    "lieu": (["vượt", "tăng ga", "nhận", "bán", "rẻ", "đăng", "liều", "tắt", "đi luôn", "thử", "nhanh", "chiêu"],
             ["dừng", "từ chối", "chậm"]),
    "toi_uu_tien": (["nhận việc", "tiền", "lương", "bán", "rẻ", "thêm", "gấp đôi", "tip", "chiêu trò", "viral"],
                    ["từ chối", "tặng", "miễn phí"]),
}


def norm(t):
    t = unicodedata.normalize("NFD", t.lower()).replace("đ", "d")
    return "".join(c for c in t if unicodedata.category(c) != "Mn")


class Persona:
    def __init__(self, name, seed):
        self.name = name
        self.rng = random.Random(seed)

    def choose(self, options):
        """options: list of (key, text_vi)."""
        if self.name == "ngau_nhien" or self.name not in KEYWORDS:
            return self.rng.choice(options)[0]
        likes, dislikes = [[norm(w) for w in ws] for ws in KEYWORDS[self.name]]
        def score(t):
            t = norm(t)
            return sum(w in t for w in likes) - sum(w in t for w in dislikes)
        best = max(options, key=lambda o: (score(o[1]), -options.index(o)))
        return best[0]


# --- the session ------------------------------------------------------------------------------
class Session:
    def __init__(self, world, persona, mission_clock=CLOCK_RATE):
        self.w, self.p = world, persona
        self.mission_clock = mission_clock   # game minutes per real minute while inside a mission
        self.in_mission = False
        self.violations = 0
        self.money = dict(START_MONEY)
        self.flags, self.items, self.rep = set(), set(), collections.Counter()
        self.done, self.failed = [], []
        self.unlocked_activities, self.unlocked_businesses = set(), set()
        self.events_seen, self.chars_met, self.landmarks_seen, self.districts_seen = set(), set(), set(), set()
        self.hour, self.day = 5.0, 1          # the prologue starts at 5 a.m.
        self.pos = world.characters["minh"]["home"]
        self.protagonist = "minh"
        self.real_minutes = 0.0
        self.control_log = []                                # (real minute at end of step, player held the controls)
        self.km = collections.Counter()
        self.timeline, self.issues, self.notes = [], [], []
        self.choices = []
        self.lines_seen, self.steps_seen = set(), set()     # (dialogue, line) / (mission, step) this persona saw
        self.consequences = []                               # conditional content whose condition was decided by an earlier choice
        self.opening = {"first_control_min": None, "first_choice_min": None, "first_stake_min": None, "stake_line": None}

    # -- helpers --
    def issue(self, sev, mission, step, text):
        self.issues.append({"severity": sev, "mission": mission, "step": step, "text": text})

    def advance(self, real_min):
        self.real_minutes += real_min
        game_min = real_min * (self.mission_clock if self.in_mission else CLOCK_RATE)
        self.hour += game_min / 60
        while self.hour >= 24:
            self.hour -= 24
            self.day += 1

    def set_hour(self, h, mission, step, reason):
        """A step pins the clock (time_of_day): count the skipped time as a day boundary if needed."""
        if h < self.hour - 0.01:
            self.day += 1
        self.hour = h

    def available(self):
        out = []
        for m in self.w.missions.values():
            if m["id"] in self.done or m["id"] in self.failed:
                continue
            r = m.get("requires") or {}
            if any(x.split(":", 1)[1] not in self.done for x in r.get("missions_completed", [])):
                continue
            if not self.w.holds(r, self.flags, self.rep, self.protagonist):
                continue
            out.append(m)
        return out

    def consequence(self, mission, where, kind, cond, shown):
        """Record conditional content decided by a flag some choice set (or could have set)."""
        flags = list((cond or {}).get("flags", [])) + list((cond or {}).get("not_flags", []))
        decided = [f for f in flags if f in self.w.choice_flags]
        if decided:
            self.consequences.append({"mission": mission, "where": where, "kind": kind, "flags": decided, "shown": shown})

    def note_opening(self, text):
        if self.opening["first_stake_min"] is None and any(w in text.lower() for w in STAKE_WORDS):
            self.opening["first_stake_min"] = round(self.real_minutes, 1)
            self.opening["stake_line"] = text[:80]

    def apply_reward(self, rw, who, mission, where):
        if not rw:
            return
        if rw.get("money_vnd"):
            self.money[who] = self.money.get(who, 0) + rw["money_vnd"]
        for k, v in (rw.get("reputation") or {}).items():
            self.rep[k] += v
        for it in rw.get("items", []):
            self.items.add(it.split(":", 1)[1])
        for f in rw.get("set_flags", []):
            self.flags.add(f)
        for u in rw.get("unlocks", []):
            coll, _, uid = u.partition(":")
            if coll == "activities":
                self.unlocked_activities.add(uid)
            elif coll == "businesses":
                self.unlocked_businesses.add(uid)

    def run_dialogue(self, did, mission, step, active_events=()):
        d = self.w.dialogues.get(did)
        if not d:
            self.issue("error", mission, step, f"dialogue {did} does not exist")
            return
        lines = {l["id"]: l for l in d["lines"]}
        order = [l["id"] for l in d["lines"]]
        cur, seen, n = order[0], set(), 0
        while cur and n < 200:
            n += 1
            if cur not in lines:
                self.issue("error", mission, step, f"dialogue {did}: goto '{cur}' is not a line")
                return
            line = lines[cur]
            if "condition" in line:
                ok = self.w.holds(line["condition"], self.flags, self.rep, self.protagonist, active_events, self.done)
                self.consequence(mission, f"{did}/{cur}", "dialogue_line", line["condition"], ok)
                if not ok:   # skipped: fall through to the next line of the array (runtime ResolveDialogueLine)
                    i = order.index(cur)
                    cur = order[i + 1] if i + 1 < len(order) else None
                    continue
            sp = line["speaker"].split(":", 1)[1]
            if sp != self.protagonist and sp != "player":
                self.chars_met.add(sp)
            seen.add(cur)
            self.lines_seen.add((did, cur))
            self.note_opening(line["text"]["vi"])
            if line.get("choices"):
                visible = []
                for c in line["choices"]:
                    if "condition" in c:
                        ok = self.w.holds(c["condition"], self.flags, self.rep, self.protagonist, active_events, self.done)
                        self.consequence(mission, f"{did}/{cur}", "dialogue_choice", c["condition"], ok)
                        if not ok:
                            continue
                    visible.append(c)
                if not visible:
                    self.issue("error", mission, step, f"dialogue {did}/{cur}: every choice is hidden by its condition")
                    return
                if self.opening["first_choice_min"] is None:
                    self.opening["first_choice_min"] = round(self.real_minutes, 1)
                opts = [(c["goto"], c["text"]["vi"]) for c in visible]
                pick = self.p.choose(opts)
                choice = next(c for c in visible if c["goto"] == pick)
                self.choices.append({"mission": mission, "dialogue": did, "line": cur, "chose": choice["text"]["vi"][:60]})
                self.apply_reward(choice.get("effect"), self.protagonist, mission, f"{did}/{cur}")
                cur = pick
            elif line.get("goto"):
                cur = line["goto"]
            else:
                i = order.index(cur)
                cur = order[i + 1] if i + 1 < len(order) else None
        if n >= 200:
            self.issue("error", mission, step, f"dialogue {did} loops")
        unseen = set(order) - seen
        return unseen

    def run_mission(self, m):
        mid = m["id"]
        steps = {s["id"]: s for s in m["steps"]}
        protagonists = [p.split(":", 1)[1] for p in m.get("protagonists", [])]
        if protagonists and self.protagonist not in protagonists:
            # StartMission possesses protagonists[0] first; the ride to `start` is theirs, from their home
            self.protagonist = protagonists[0]
            self.pos = self.w.characters[self.protagonist].get("home", self.pos)
        self.money.setdefault(self.protagonist, 0)
        if m.get("start"):
            self.travel(m["start"], "ride", mid, "start")
        t0 = self.real_minutes
        self.in_mission = True
        r = m.get("requires") or {}
        if r.get("flags") or r.get("not_flags"):
            self.consequence(mid, "requires", "mission_gate", r, True)
        cur, visited, n = m["steps"][0]["id"], [], 0
        outcome = "success"
        while cur not in (None, "end", "success", "fail") and n < 100:
            n += 1
            if cur not in steps:
                self.issue("error", mid, cur, f"next -> '{cur}' is not a step of this mission")
                outcome = "dead_end"
                break
            s = steps[cur]
            visited.append(cur)
            self.steps_seen.add((mid, cur))
            pr = s.get("params") or {}
            if pr.get("protagonist"):
                self.protagonist = pr["protagonist"].split(":", 1)[1]
                self.money.setdefault(self.protagonist, 0)
            if s["kind"] in CONTROL_KINDS and self.opening["first_control_min"] is None:
                self.opening["first_control_min"] = round(self.real_minutes, 1)
            if s["kind"] == "choice" and self.opening["first_choice_min"] is None:
                self.opening["first_choice_min"] = round(self.real_minutes, 1)
            self.note_opening(s["objective"]["vi"])
            for key in ("variant_from_flags", "reacts_to_flags"):
                if pr.get(key):
                    hit = [f for f in pr[key] if f in self.flags]
                    self.consequence(mid, f"{cur}.{key}", "step_variant", {"flags": list(pr[key])}, bool(hit))
            for ev in (pr.get("requires_event"), pr.get("force_event")):
                if ev:
                    self.events_seen.add(ev.split(":", 1)[1])
            # time pins and windows
            if "time_of_day" in pr:
                self.set_hour(float(pr["time_of_day"]), mid, cur, "time_of_day")
            if s["kind"] == "wait_until":
                h = pr.get("until_hour", pr.get("hour"))
                if h is not None:
                    if h < self.hour:
                        self.day += 1
                    self.hour = float(h)
            if "hours" in pr and not (pr["hours"][0] <= self.hour < pr["hours"][1]):
                self.issue("warn", mid, cur, f"clock is {self.hour:.1f}h but the step wants {pr['hours']} (persona {self.p.name})")
            # movement
            target, lm = self.w.place(s.get("target"))
            if lm:
                self.landmarks_seen.add(lm)
            if target:
                mode = s["kind"] if s["kind"] in SPEED_KMH else ("walk" if pr.get("on_foot") else "ride")
                if self.protagonist == "khoi" and "khoi_co_bang_a1" not in self.flags and mode in ("ride", "go_to"):
                    mode = "walk" if s["kind"] == "go_to" else mode
                self.travel(target, mode, mid, cur, deadline=pr.get("deadline_hour"))
            # step body
            self.advance(pr["duration_s"] / 60 if "duration_s" in pr else STEP_REAL_MIN.get(s["kind"], 1.0))
            self.control_log.append((self.real_minutes, s["kind"] in CONTROL_KINDS))
            if pr.get("cost_vnd"):
                self.money[self.protagonist] -= pr["cost_vnd"]
            if pr.get("apply_fine"):
                self.violations += 1
                rid = pr["apply_fine"].split(":", 1)[1]
                fine = (self.w.rules.get(rid) or {}).get("fine_vnd", 0)
                fine = fine if isinstance(fine, (int, float)) else (fine or {}).get("motorbike", 0)
                self.money[self.protagonist] -= fine or 0
            if s.get("dialogue"):
                active = {ev.split(":", 1)[1] for ev in (pr.get("requires_event"), pr.get("force_event")) if ev}
                self.run_dialogue(s["dialogue"].split(":", 1)[1], mid, cur, active)
            for f in s.get("set_flags", []):
                self.flags.add(f)
            # choose the next step
            nxt = s.get("next")
            if isinstance(nxt, dict):
                if pr.get("branch_source") == "flag":
                    key = next((k for k in nxt if k in self.flags), "default" if "default" in nxt else None)
                    if key is None:
                        self.issue("error", mid, cur, f"flag branch has no match and no default: {list(nxt)}")
                        outcome = "dead_end"
                        break
                    self.consequence(mid, f"{cur}.next", "step_branch", {"flags": [k for k in nxt if k != "default"]}, key != "default")
                else:
                    key = self.p.choose([(k, k.replace("_", " ")) for k in nxt])
                    self.choices.append({"mission": mid, "step": cur, "chose": key})
                cur = nxt[key]
            elif nxt is None:
                i = [x["id"] for x in m["steps"]].index(cur)
                cur = m["steps"][i + 1]["id"] if i + 1 < len(m["steps"]) else None
            else:
                cur = nxt
        if n >= 100:
            self.issue("error", mid, cur, "step loop")
            outcome = "loop"
        self.in_mission = False
        if outcome == "success":
            self.apply_reward(m.get("reward"), self.protagonist, mid, "reward")
            for u in m.get("unlocks", []):
                self.apply_reward({"unlocks": [u]}, self.protagonist, mid, "unlocks")
            self.done.append(mid)
        else:
            self.failed.append(mid)
        unvisited = [s["id"] for s in m["steps"] if s["id"] not in visited]
        self.timeline.append({"day": self.day, "hour": round(self.hour, 2), "mission": mid, "type": m["type"],
                              "chapter": m.get("chapter"), "protagonist": self.protagonist,
                              "real_min": round(self.real_minutes - t0, 1), "outcome": outcome,
                              "steps": visited, "unvisited_steps": unvisited,
                              "money": dict(self.money)})
        return outcome

    def travel(self, target, mode, mid, step, deadline=None):
        d = dist_km(self.pos, target)
        if d < 0.05:
            return
        speed = SPEED_KMH.get(mode, SPEED_KMH["ride"])
        real_min = d / speed * 60
        before = self.hour
        self.control_log.append((self.real_minutes, True))   # riding/walking is the player's, start to end
        self.advance(real_min)
        self.control_log.append((self.real_minutes, True))
        self.km[self.protagonist] += d
        self.pos = target
        self.districts_seen.add(self.w.district_of(target))
        if deadline is not None and self.hour > deadline and before <= deadline:
            self.issue("warn", mid, step, f"{d:.1f} km at {speed:g} km/h ends at {self.hour:.1f}h, past the {deadline}h deadline (48-min day)")
        if d > 12:
            self.issue("warn", mid, step, f"{d:.1f} km hop in one step (from the previous target)")

    def idle_day(self):
        """A day of free play between story beats: flat income, costs, rent. Free play is the player's time."""
        self.control_log.append((self.real_minutes, True))
        for who in self.money:
            self.money[who] += DAILY_NET_INCOME.get(who, 0) - DAILY_COST.get(who, 0)
        self.day += 1
        self.hour = 6.0
        self.real_minutes += GAME_DAY_REAL_MIN
        self.control_log.append((self.real_minutes, True))
        if self.day % 30 == 0:
            self.money["minh"] -= 2_500_000 + 6_000_000   # rent + money home (GDD)
        if self.p.name == "lieu":
            self.violations += 1 if self.day % 7 == 0 else 0   # a reckless player gets caught weekly
        if self.day >= 90 and self.violations == 0:
            self.flags.add("ho_so_sach_90_ngay")   # runtime flag, see RUNTIME_FLAGS

    def gated_by_runtime_flag(self):
        return [m for m in self.w.missions.values() if m["id"] not in self.done and m["id"] not in self.failed
                and any(f in RUNTIME_FLAGS for f in (m.get("requires") or {}).get("flags", []))]

    def play(self, max_days=120):
        guard = 0
        while guard < 500:
            guard += 1
            avail = self.available()
            if not avail:
                if self.gated_by_runtime_flag() and self.day < max_days:
                    self.idle_day()   # keep playing until the runtime flag can appear (or we give up)
                    continue
                break
            # story first, then side missions, in chapter order
            avail.sort(key=lambda m: (m["type"] != "story", m.get("chapter", 99), m["id"]))
            m = avail[0]
            r = m.get("requires") or {}
            if "hours" in r and not (r["hours"][0] <= self.hour < r["hours"][1]):
                if r["hours"][0] < self.hour:
                    self.day += 1
                self.hour = r["hours"][0]
            if "weather" in r:
                self.notes.append(f"{m['id']} needs weather {r['weather']}: assumed to occur")
            self.run_mission(m)
            if m["type"] == "story" and m.get("chapter", 0) > 0:
                self.idle_day()   # the prologue runs as one continuous sequence (p0 cuts straight into p1)
        if guard >= 500:
            self.issue("error", None, None, "session did not terminate")


# --- static checks that do not depend on a persona -------------------------------------------
def static_checks(w):
    issues = []
    for m in w.missions.values():
        ids = {s["id"] for s in m["steps"]}
        for s in m["steps"]:
            nxt = s.get("next")
            targets = list(nxt.values()) if isinstance(nxt, dict) else ([nxt] if nxt else [])
            for t in targets:
                if t not in ids and t not in ("end", "success", "fail"):
                    issues.append(("error", m["id"], s["id"], f"next '{t}' is not a step"))
            if s.get("dialogue") and s["dialogue"].split(":", 1)[1] not in w.dialogues:
                issues.append(("error", m["id"], s["id"], f"dialogue {s['dialogue']} missing"))
            tgt = s.get("target")
            if isinstance(tgt, str):
                coll, _, tid = tgt.partition(":")
                if coll == "landmarks" and tid not in w.landmarks:
                    issues.append(("error", m["id"], s["id"], f"landmark {tid} missing"))
        for u in m.get("unlocks", []):
            coll, _, uid = u.partition(":")
            pool = {"missions": w.missions, "activities": w.activities, "businesses": w.businesses}.get(coll)
            if pool is not None and uid not in pool:
                issues.append(("error", m["id"], None, f"unlocks {u} missing"))
    # flags: read but never written / written but never read
    readers, writers = set(w.flag_readers), set(w.flag_writers)
    for f in sorted(readers - writers):
        if f in RUNTIME_FLAGS:
            issues.append(("info", None, None, f"flag '{f}' is set by the runtime ({RUNTIME_FLAGS[f]}), required by {sorted(w.flag_readers[f])}"))
        else:
            issues.append(("error", None, None, f"flag '{f}' is required by {sorted(w.flag_readers[f])} but nothing sets it"))
    for f in sorted(writers - readers):
        if f in RUNTIME_READ_FLAGS:
            continue   # the engine reads it (RUNTIME_READ_FLAGS)
        issues.append(("info", None, None, f"flag '{f}' set by {sorted(w.flag_writers[f])} is never read (choice without consequence yet)"))
    return issues


def longest_no_control(control_log, window_min=20.0):
    """Longest stretch (real minutes) inside the first `window_min` minutes with no control step."""
    longest, start = 0.0, 0.0
    for t, control in control_log:
        if t > window_min:
            t = window_min
        if control:
            start = t
        else:
            longest = max(longest, t - start)
        if t >= window_min:
            break
    return round(longest, 1)


def summarize(w, sessions, static):
    story = [m for m in w.missions.values() if m["type"] == "story"]
    reach = collections.defaultdict(set)
    for s in sessions:
        for mid in s.done:
            reach[mid].add(s.p.name)
    unreached = sorted(m["id"] for m in w.missions.values() if m["id"] not in reach)
    districts_story = set().union(*(s.districts_seen for s in sessions))
    landmarks_used = set().union(*(s.landmarks_seen for s in sessions))
    chars = set().union(*(s.chars_met for s in sessions))
    issues = [dict(severity=a, mission=b, step=c, text=d) for a, b, c, d in static]
    seen = set()
    for s in sessions:
        for i in s.issues:
            key = (i["severity"], i["mission"], i["step"], i["text"].split(" (persona")[0])
            if key not in seen:
                seen.add(key)
                issues.append({**i, "text": key[3]})
    per = {}
    for s in sessions:
        fired = [c for c in s.consequences if c["shown"]]
        per[s.p.name] = {"days": s.day, "real_hours": round(s.real_minutes / 60, 1), "missions": len(s.done),
                         "violations": s.violations,
                         "failed": s.failed, "money": s.money, "flags": sorted(s.flags), "km": {k: round(v, 1) for k, v in s.km.items()},
                         "choices": s.choices, "timeline": s.timeline, "issues": s.issues, "notes": s.notes,
                         "consequences_fired": len(fired), "consequences_checked": len(s.consequences),
                         "consequence_flags": sorted({f for c in fired for f in c["flags"]}),
                         "opening": {**s.opening, "longest_no_control_min": longest_no_control(s.control_log)}}
    # how far the personas' paths diverge: content only some of them saw
    all_lines = [s.lines_seen for s in sessions]
    all_steps = [s.steps_seen for s in sessions]
    div_lines = set().union(*all_lines) - set.intersection(*all_lines)
    div_steps = set().union(*all_steps) - set.intersection(*all_steps)
    choice_flags = sorted(w.choice_flags)
    choice_read = [f for f in choice_flags if f in w.flag_readers]
    consequences = {
        "choice_flags": len(choice_flags), "choice_flags_read": len(choice_read),
        "choice_flags_unread": sorted(set(choice_flags) - set(choice_read)),
        "progress_flags": len([f for f in w.flag_writers if f not in w.choice_flags]),
        "progress_flags_unread": sorted(f for f in w.flag_writers if f not in w.choice_flags and f not in w.flag_readers and f not in RUNTIME_READ_FLAGS),
        "read_sites": sum(len(w.flag_readers[f]) for f in choice_read),
        "kinds": dict(collections.Counter(k for f in choice_read for k in w.flag_read_kinds[f])),
        "by_flag": {f: {"set_by": sorted(w.flag_writers[f]), "read_by": sorted(w.flag_readers[f]), "kinds": sorted(w.flag_read_kinds[f])} for f in choice_flags},
        "divergent_lines": len(div_lines), "divergent_steps": len(div_steps),
        "lines_total": sum(len(d["lines"]) for d in w.dialogues.values()),
        "in_chapter_payoffs": sorted({(c["mission"], f) for s in sessions for c in s.consequences if c["shown"]
                                      for f in c["flags"] if (w.missions.get(c["mission"]) or {}).get("chapter") == 1
                                      and all((w.missions.get(m) or {}).get("chapter") in (0, 1) for m in w.flag_writers[f] if not m.startswith("dialogue:"))}),
    }
    return {
        "missions": len(w.missions), "story_missions": len(story), "side_missions": len(w.missions) - len(story),
        "unreachable_missions": unreached,
        "districts_visited": sorted(d for d in districts_story if d), "districts_total": len(w.districts),
        "districts_never_visited": sorted(set(w.districts) - districts_story),
        "landmarks_used": sorted(landmarks_used), "landmarks_total": len(w.landmarks),
        "characters_met": sorted(chars), "characters_total": len([c for c in w.characters.values() if c.get("role") != "protagonist"]),
        "flags_written": sorted(w.flag_writers), "flags_read": sorted(w.flag_readers),
        "consequences": consequences,
        "issues": issues, "personas": per,
        "goals_vnd": GOALS_VND,
        "mission_clock": sessions[0].mission_clock,
        "step_kinds": dict(collections.Counter(st["kind"] for m in w.missions.values() for st in m["steps"])),
        "steps_total": sum(len(m["steps"]) for m in w.missions.values()),
        "mission_real_minutes": {t["mission"]: t["real_min"] for t in sessions[0].timeline},
    }


def economy(w):
    """Minh's monthly balance from the GDD numbers alone (no story money)."""
    month_income = DAILY_NET_INCOME["minh"] * 30
    month_cost = DAILY_COST["minh"] * 30 + 2_500_000 + 6_000_000
    net = month_income - month_cost
    months = GOALS_VND["tiem_sua_xe_duc_coi"] / net if net > 0 else None
    return {"minh_month_income": month_income, "minh_month_cost": month_cost, "minh_month_net": net,
            "months_to_repair_shop": None if months is None else round(months, 1),
            "real_hours_to_repair_shop": None if months is None else round(months * 30 * GAME_DAY_REAL_MIN / 60)}


def render_report(summary, w):
    L = []
    L.append("# 06. Giả lập chơi thử (dry run) bản nháp v0\n")
    L.append("Sinh tự động bởi `tools/playtest.py`: đi qua toàn bộ nhiệm vụ như một người chơi, trên bản đồ 1:1, với nhịp ngày 48 phút. "
             "Bốn kiểu người chơi: **tử tế** (chọn đúng luật, giữ, nói thật), **liều** (vượt đèn, nhận việc, bán), "
             "**tối ưu tiền** (chọn theo tiền), **ngẫu nhiên**.\n")
    errs = [i for i in summary["issues"] if i["severity"] == "error"]
    warns = [i for i in summary["issues"] if i["severity"] == "warn"]
    infos = [i for i in summary["issues"] if i["severity"] == "info"]
    L.append("## Kết quả nhanh\n")
    L.append(f"- Nhiệm vụ: {summary['missions']} ({summary['story_missions']} cốt truyện, {summary['side_missions']} phụ). "
             f"Không chơi tới được: {', '.join(summary['unreachable_missions']) or 'không có'}.")
    L.append(f"- Lỗi logic chặn chơi: **{len(errs)}**. Cảnh báo (thời gian, khoảng cách): {len(warns)}. Lựa chọn chưa có hệ quả: {len(infos)}.")
    L.append(f"- Quận cốt truyện đi qua: {len(summary['districts_visited'])}/{summary['districts_total']} "
             f"({', '.join(summary['districts_visited'])}). Chưa bao giờ tới: {', '.join(summary['districts_never_visited']) or 'không'}.")
    L.append(f"- Địa danh dùng trong nhiệm vụ: {len(summary['landmarks_used'])}/{summary['landmarks_total']}. "
             f"Nhân vật gặp qua thoại: {len(summary['characters_met'])}/{summary['characters_total']}.\n")
    L.append("## Mỗi kiểu người chơi\n")
    L.append("| Kiểu | Ngày game | Giờ chơi thật | Nhiệm vụ xong | Tiền Minh | Tiền Lan | Tiền Khôi | Km đi |")
    L.append("| --- | --- | --- | --- | --- | --- | --- | --- |")
    for name, p in summary["personas"].items():
        km = sum(p["km"].values())
        L.append(f"| {name} | {p['days']} | {p['real_hours']} h | {p['missions']} | {p['money']['minh']/1e6:.1f} tr | "
                 f"{p['money']['lan']/1e6:.1f} tr | {p['money']['khoi']/1e6:.1f} tr | {km:.0f} |")
    L.append("")
    g = summary["goals_vnd"]
    p0 = next(iter(summary["personas"].values()))
    L.append(f"Mục tiêu tiền lớn (GDD): tiệm Đức Còi {g['tiem_sua_xe_duc_coi']/1e6:.0f} tr, cà phê trứng {g['ca_phe_trung_hang_gai']/1e6:.0f} tr, "
             f"phần nhà cô Hạnh {g['phan_nha_co_hanh']/1e9:.0f} tỷ. Sau toàn bộ nội dung đã viết (mở đầu + chương 1 + 12 nhiệm vụ phụ) "
             f"Minh có khoảng {p0['money']['minh']/1e6:.0f} tr: còn xa mục tiêu đầu tiên, nghĩa là vòng lặp làm việc tự do phải gánh phần lớn tiến trình, "
             f"đúng với thiết kế nhưng chương 2-5 cần các cú hích tiền từ truyện.\n")
    ec = summary["economy"]
    L.append("## Kinh tế của Minh theo số liệu GDD\n")
    L.append(f"- Thu một tháng chạy xe chăm: {ec['minh_month_income']/1e6:.1f} tr. Chi: ăn uống, xăng, gửi xe {DAILY_COST['minh']*30/1e6:.1f} tr + "
             f"trọ 2,5 tr + gửi về quê 6 tr = {ec['minh_month_cost']/1e6:.1f} tr. **Dư: {ec['minh_month_net']/1e6:.1f} tr/tháng.**")
    if ec["months_to_repair_shop"] is None:
        L.append("- Với số liệu này Minh **không bao giờ** tự gom được 120 tr mua tiệm Đức Còi bằng chạy xe; mục tiêu đời của nhân vật chính chỉ đạt được qua tiền thưởng cốt truyện. "
                 "Hoặc là chủ ý (chương 2-5 phải trả), hoặc là phải nâng thu nhập ngày / giảm khoản gửi quê (hiện gần bằng cả tháng dư).")
    else:
        L.append(f"- Gom 120 tr mua tiệm mất khoảng {ec['months_to_repair_shop']} tháng game = {ec['real_hours_to_repair_shop']} giờ chơi thật nếu chỉ chạy xe.")
    L.append("")
    ac = summary["alt_clock"]
    L.append("## Hai cách chạy đồng hồ trong nhiệm vụ\n")
    L.append(f"- Đồng hồ {summary['mission_clock']:g}x trong nhiệm vụ (như ngoài phố): {len(warns)} cảnh báo giờ/khoảng cách.")
    L.append(f"- Đồng hồ {ac['mission_clock']:g}x trong nhiệm vụ: {len(ac['time_warnings'])} cảnh báo"
             + (": " + "; ".join(ac["time_warnings"]) if ac["time_warnings"] else "") + ".")
    L.append("- Đề xuất: trong nhiệm vụ cốt truyện, đồng hồ chạy giờ thật (1x) hoặc dừng khi đang thoại; khung giờ (`hours`) chỉ kiểm tra lúc bắt đầu bước; "
             "nhiệm vụ cần hoàng hôn/bình minh thêm `wait_until` trước bước chụp.\n")
    co = summary["consequences"]
    L.append("## Mở màn\n")
    L.append("| Kiểu | Phút thật tới lúc cầm lái | Tới lựa chọn đầu | Đoạn dài nhất không điều khiển (20 phút đầu) | Phút biết câu hỏi lớn (nhà, tờ giấy) |")
    L.append("| --- | --- | --- | --- | --- |")
    for name, p in summary["personas"].items():
        o = p["opening"]
        L.append(f"| {name} | {o['first_control_min']} | {o['first_choice_min']} | {o['longest_no_control_min']} | {o['first_stake_min']} |")
    L.append("")
    L.append("Chuẩn 5/5 (docs/gdd/07): cầm lái trước phút 1, lựa chọn đầu trước phút 3, không quá 3 phút liên tiếp chỉ xem, "
             "câu hỏi lớn được nói ra trước phút 5.\n")
    L.append("## Hệ quả lựa chọn\n")
    L.append(f"- Cờ do lựa chọn đặt: **{co['choice_flags']}**, được đọc lại: **{co['choice_flags_read']}** "
             f"({100 * co['choice_flags_read'] // max(1, co['choice_flags'])}%), tổng {co['read_sites']} chỗ đọc. "
             f"Chưa đọc: {', '.join(co['choice_flags_unread']) or 'không'}.")
    L.append(f"- Loại hệ quả: " + ", ".join(f"{k} {v}" for k, v in sorted(co["kinds"].items())) + ".")
    L.append(f"- Cờ tiến trình (không do lựa chọn): {co['progress_flags']}, chưa đọc: {', '.join(co['progress_flags_unread']) or 'không'}.")
    L.append(f"- Hệ quả trả ngay trong chương 1 cho lựa chọn chương 0-1: {len(co['in_chapter_payoffs'])} cặp (nhiệm vụ, cờ).")
    L.append(f"- Độ phân nhánh giữa các kiểu người chơi: {co['divergent_lines']}/{co['lines_total']} dòng thoại và {co['divergent_steps']} bước chỉ một phần người chơi thấy.")
    L.append("| Kiểu | Hệ quả kiểm tra | Đã kích hoạt | Cờ lựa chọn đã trả |")
    L.append("| --- | --- | --- | --- |")
    for name, p in summary["personas"].items():
        L.append(f"| {name} | {p['consequences_checked']} | {p['consequences_fired']} | {len(p['consequence_flags'])} |")
    L.append("")
    sk = summary["step_kinds"]
    tot = summary["steps_total"]
    talk = sk.get("talk", 0) + sk.get("cutscene", 0)
    act = sum(sk.get(k, 0) for k in ("ride", "drive_passenger", "deliver", "follow", "escape_traffic_police", "minigame", "cook", "photograph", "collect"))
    L.append("## Nhịp chơi\n")
    L.append(f"- {tot} bước trong {summary['missions']} nhiệm vụ: {talk} bước thoại/cắt cảnh ({100*talk//tot}%), {act} bước hành động "
             f"({100*act//tot}%: lái, giao, minigame, nấu, chụp), {sk.get('choice',0)} bước lựa chọn tường minh.")
    mm = summary["mission_real_minutes"]
    L.append(f"- Nhiệm vụ dài nhất: {max(mm, key=mm.get)} ({max(mm.values()):.0f} phút thật); ngắn nhất: {min(mm, key=mm.get)} ({min(mm.values()):.0f} phút). "
             f"GTA5 thường 15-40 phút một nhiệm vụ truyện; các nhiệm vụ dưới 8 phút nên gộp hoặc thêm đoạn chơi.")
    L.append("")
    if errs:
        L.append("## Lỗi chặn chơi (phải sửa)\n")
        for i in errs:
            L.append(f"- `{i['mission'] or '-'}` / `{i['step'] or '-'}`: {i['text']}")
        L.append("")
    if warns:
        L.append("## Cảnh báo thời gian và khoảng cách\n")
        L.append("Đồng hồ game chạy nhanh 30 lần (ngày 48 phút) trên bản đồ 1:1: một cuốc 5 km mất 13 phút thật = **6,5 giờ game**. "
                 "Mọi bước có giờ cố định sau một chuyến đi dài đều bị lệch; đây là mâu thuẫn thiết kế lớn nhất mà giả lập phát hiện.\n")
        for i in warns:
            L.append(f"- `{i['mission']}` / `{i['step']}`: {i['text']}")
        L.append("")
    if infos:
        L.append("## Lựa chọn chưa có hệ quả\n")
        for i in infos:
            L.append(f"- {i['text']}")
        L.append("")
    L.append("## Dòng thời gian (kiểu tử tế)\n")
    L.append("| Ngày | Giờ | Nhiệm vụ | NV | Phút thật | Kết quả |")
    L.append("| --- | --- | --- | --- | --- | --- |")
    for t in summary["personas"][next(iter(summary["personas"]))]["timeline"]:
        L.append(f"| {t['day']} | {t['hour']:.1f} | {t['mission']} | {t['protagonist']} | {t['real_min']} | {t['outcome']}{' (bỏ qua: ' + ', '.join(t['unvisited_steps']) + ')' if t['unvisited_steps'] else ''} |")
    L.append("")
    return "\n".join(L)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--personas", default="all")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--report")
    ap.add_argument("--out", default=str(ROOT / "out" / "playtest"))
    ap.add_argument("--mission-clock", type=float, default=CLOCK_RATE,
                    help="game minutes per real minute inside missions (30 = GTA rhythm everywhere, 1 = real time during missions)")
    a = ap.parse_args(argv)
    w = World()
    names = ["tu_te", "lieu", "toi_uu_tien", "ngau_nhien"] if a.personas == "all" else a.personas.split(",")
    sessions = []
    for n in names:
        s = Session(w, Persona(n, a.seed), mission_clock=a.mission_clock)
        s.play()
        sessions.append(s)
    static = static_checks(w)
    summary = summarize(w, sessions, static)
    # the same content with the clock at real time inside missions: how many time warnings remain
    alt = Session(w, Persona(names[0], a.seed), mission_clock=1.0 if a.mission_clock != 1.0 else CLOCK_RATE)
    alt.play()
    summary["alt_clock"] = {"mission_clock": alt.mission_clock,
                            "time_warnings": [i["text"] for i in alt.issues if i["severity"] == "warn"]}
    summary["economy"] = economy(w)
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "summary.json").write_text(json.dumps(summary, indent=1, ensure_ascii=False))
    report = render_report(summary, w)
    if a.report:
        pathlib.Path(a.report).write_text(report, encoding="utf-8")
    print(report)
    errors = [i for i in summary["issues"] if i["severity"] == "error"]
    unreachable_story = [m for m in summary["unreachable_missions"] if w.missions[m]["type"] == "story"]
    return 1 if errors or unreachable_story else 0


if __name__ == "__main__":
    sys.exit(main())
