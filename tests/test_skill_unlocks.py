"""Skills must unlock things the player can see (docs/gdd/07 item 10, docs/gdd/02 §10):
every skill anyone has or trains is in skills.json with three ascending tiers, every tier names
what it unlocks, every min_skills gate in content sits exactly on a tier level of that skill, and
every skill has at least one real gate or unlock ref so the number on the phone means something."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "game" / "content"


def _docs():
    return {p: json.loads(p.read_text(encoding="utf-8")) for p in sorted(CONTENT.rglob("*.json"))}


DOCS = _docs()
SKILLS = {s["id"]: s for p, d in DOCS.items() if d["collection"] == "skills" for s in d["items"]}


def _walk(node, path=""):
    if isinstance(node, dict):
        for k, v in node.items():
            yield from _walk(v, f"{path}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from _walk(v, f"{path}[{i}]")
    else:
        yield path, node


def _gates():
    """(skill, level, where) for every condition.min_skills in content."""
    out = []
    for p, d in DOCS.items():
        for path, v in _walk(d):
            if ".min_skills." in path:
                skill = path.rsplit(".", 1)[1]
                out.append((skill, v, f"{p.name}:{path}"))
    return out


def test_every_known_skill_has_tiers():
    used = set()
    for p, d in DOCS.items():
        if d["collection"] == "characters":
            for c in d["items"]:
                used |= set(c.get("skills") or {})
        if d["collection"] == "activities":
            for a in d["items"]:
                used |= set(a.get("skills_trained") or [])
        if d["collection"] == "random_events":
            for e in d["items"]:
                for c in e["choices"]:
                    for eff in (c.get("effect"), c.get("fail_effect")):
                        used |= set((eff or {}).get("skills") or [])
    assert used <= set(SKILLS), used - set(SKILLS)


def test_tiers_ascend_and_say_what_they_unlock():
    for s in SKILLS.values():
        levels = [t["level"] for t in s["tiers"]]
        assert levels == sorted(levels) and len(set(levels)) == 3, s["id"]
        for t in s["tiers"]:
            assert t["unlocks"]["vi"].strip(), f"{s['id']}@{t['level']}"


def test_every_gate_sits_on_a_visible_tier():
    for skill, level, where in _gates():
        assert skill in SKILLS, where
        tiers = {t["level"] for t in SKILLS[skill]["tiers"]}
        assert level in tiers, f"{where}: {skill} {level} is not a tier level {sorted(tiers)}"


def test_every_skill_gates_something():
    gated = {skill for skill, _, _ in _gates()}
    with_refs = {s["id"] for s in SKILLS.values() if any(t.get("refs") for t in s["tiers"])}
    assert set(SKILLS) <= gated | with_refs, set(SKILLS) - (gated | with_refs)
    assert len(gated) >= 10, sorted(gated)


def test_gated_dialogue_choices_are_marked_for_the_player():
    """A skill check the player cannot see is a coin toss; the choice text names the skill and level."""
    for p, d in DOCS.items():
        if d["collection"] != "dialogues":
            continue
        for dlg in d["items"]:
            for line in dlg["lines"]:
                for c in line.get("choices") or []:
                    for skill, level in ((c.get("condition") or {}).get("min_skills") or {}).items():
                        name = SKILLS[skill]["name"]["vi"]
                        assert f"[{name} {level}]" in c["text"]["vi"], \
                            f"{dlg['id']}/{line['id']}: choice gated by {skill} {level} must show it"
