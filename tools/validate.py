"""Validate all game content against its JSON Schema and check cross-references.

Every file under game/content/**.json is a collection document:
  {"collection": "<name>", "items": [ {"id": ...}, ... ]}
validated by game/schemas/<name>.schema.json. Several files may share a collection.
References are strings '<collection>:<id>' (see common.schema.json#/$defs/ref) and must
resolve to an existing item. Exit code 1 on any problem.

Usage: python tools/validate.py [--root game]
"""

import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

REF_KEYS = {"ref"}


def load_registry(schema_dir):
    schemas, resources = {}, []
    for p in sorted(schema_dir.glob("*.schema.json")):
        s = json.loads(p.read_text(encoding="utf-8"))
        schemas[p.name.removesuffix(".schema.json")] = s
        resources.append((s["$id"], Resource.from_contents(s)))
    return schemas, Registry().with_resources(resources)


def iter_refs(schema_node, value, path, schemas):
    """Yield (path, ref) for every value whose schema node is the common ref type."""
    if isinstance(schema_node, dict) and schema_node.get("$ref", "").endswith("$defs/ref"):
        if isinstance(value, str):
            yield path, value
        return
    if isinstance(schema_node, dict):
        if "oneOf" in schema_node:
            for alt in schema_node["oneOf"]:
                yield from iter_refs(alt, value, path, schemas)
        if isinstance(value, dict):
            props = schema_node.get("properties", {})
            for k, v in value.items():
                if k in props:
                    yield from iter_refs(props[k], v, f"{path}.{k}", schemas)
                elif isinstance(schema_node.get("additionalProperties"), dict):
                    yield from iter_refs(schema_node["additionalProperties"], v, f"{path}.{k}", schemas)
            ref = schema_node.get("$ref", "")
            if ref.startswith("common.schema.json#/$defs/") and not ref.endswith("/ref"):
                sub = schemas["common"]["$defs"][ref.rsplit("/", 1)[1]]
                yield from iter_refs(sub, value, path, schemas)
        elif isinstance(value, list) and "items" in schema_node:
            for i, v in enumerate(value):
                yield from iter_refs(schema_node["items"], v, f"{path}[{i}]", schemas)
        elif isinstance(value, list) and schema_node.get("$ref", "").startswith("common.schema.json#/$defs/"):
            sub = schemas["common"]["$defs"][schema_node["$ref"].rsplit("/", 1)[1]]
            yield from iter_refs(sub, value, path, schemas)


TERMINAL_STEPS = {"end", "success", "fail"}
DIALOGUE_CONDITION_KEYS = {"flags", "not_flags", "events_active", "min_reputation", "min_skills", "protagonist"}  # UHanoiMissionSubsystem::ResolveDialogueLine  # common.schema.json#/$defs/step_id; UHanoiMissionSubsystem::Advance


def check_missions(docs, items):
    """Mission step graphs: every next target is a step of the same mission or a terminal id,
    step ids are unique, choice branch params are consistent, and switch_protagonist_on_line
    names lines of the step's dialogue."""
    errors = []
    for p, name, doc in docs:
        if name != "missions":
            continue
        for m in doc.get("items", []):
            steps = m.get("steps", [])
            sids = [s.get("id") for s in steps]
            where = f"{p}: missions:{m.get('id')}"
            if len(set(sids)) != len(sids):
                errors.append(f"{where}: duplicate step ids")
            for s in steps:
                nxt = s.get("next")
                targets = [nxt] if isinstance(nxt, str) else list((nxt or {}).values())
                for tgt in targets:
                    if tgt not in sids and tgt not in TERMINAL_STEPS:
                        errors.append(f"{where}.{s.get('id')}: next '{tgt}' is not a step or one of {sorted(TERMINAL_STEPS)}")
                params = s.get("params") or {}
                if "branch_source" in params and not isinstance(nxt, dict):
                    errors.append(f"{where}.{s.get('id')}: branch_source needs an object next (branch table)")
                if params.get("branch_source") == "flag" and isinstance(nxt, dict) and "default" not in nxt:
                    errors.append(f"{where}.{s.get('id')}: branch_source=flag needs a 'default' branch")
                lines = params.get("switch_protagonist_on_line")
                if lines:
                    dlg = items.get(s.get("dialogue") or "")
                    known = {ln.get("id") for ln in (dlg or {}).get("lines", [])}
                    for line in lines:
                        if line not in known:
                            errors.append(f"{where}.{s.get('id')}: switch_protagonist_on_line line '{line}' "
                                          f"is not in {s.get('dialogue')}")
    return errors


def check_dialogues(docs):
    """Dialogue graphs: every goto names a line of the same dialogue, line ids are unique, a line with
    choices has no goto of its own, and `condition` on lines/choices only uses state the dialogue UI
    can evaluate mid-conversation (flags, not_flags, events_active, min_reputation, min_skills, protagonist).
    Conditional lines/choices (UHanoiMissionSubsystem::ResolveDialogueLine / GetAvailableChoices):
    a line with choices keeps at least one unconditional choice, so the UI always has something to
    offer, and the last line of a dialogue carries no condition (skipping it would end the dialogue
    silently)."""
    errors = []
    for p, name, doc in docs:
        if name != "dialogues":
            continue
        for d in doc.get("items", []):
            lines = d.get("lines", [])
            ids = [ln.get("id") for ln in lines]
            where = f"{p}: dialogues:{d.get('id')}"
            if len(set(ids)) != len(ids):
                errors.append(f"{where}: duplicate line ids")
            for ln in lines:
                targets = [ln["goto"]] if "goto" in ln else []
                targets += [c.get("goto") for c in ln.get("choices", [])]
                for tgt in targets:
                    if tgt not in ids:
                        errors.append(f"{where}.{ln.get('id')}: goto '{tgt}' is not a line of this dialogue")
                if ln.get("choices") and "goto" in ln:
                    errors.append(f"{where}.{ln.get('id')}: a line with choices cannot also have goto")
                conds = [("line", ln.get("condition"))] + [(f"choice {i}", c.get("condition")) for i, c in enumerate(ln.get("choices", []))]
                for what, cond in conds:
                    for key in (cond or {}):
                        if key not in DIALOGUE_CONDITION_KEYS:
                            errors.append(f"{where}.{ln.get('id')} {what}: condition.{key} is not evaluable mid-dialogue "
                                          f"(allowed: {sorted(DIALOGUE_CONDITION_KEYS)})")
            where = f"{p}: dialogues:{d.get('id')}"
            for line in lines:
                choices = line.get("choices") or []
                if choices and all("condition" in c for c in choices):
                    errors.append(f"{where}.{line.get('id')}: every choice has a condition; keep one unconditional")
            if lines and "condition" in lines[-1] and "goto" not in lines[-1] and not lines[-1].get("choices"):
                errors.append(f"{where}.{lines[-1].get('id')}: the last line is conditional; add an unconditional closing line")
    return errors


def _step_protagonists(m):
    """Characters a mission step can be played as: the mission's protagonists plus every params.protagonist."""
    out = set(m.get("protagonists", []))
    for s in m.get("steps", []):
        if (s.get("params") or {}).get("protagonist"):
            out.add(s["params"]["protagonist"])
    return out


def check_minigame_modes(docs, items):
    """minigame_modes rows are playable as written (tools/runtime_rules.py states the rules): phan_loai
    tasks answer with one of the mode's labels, sap_xep tasks have an order unless forbidden, forbidden
    tasks score nothing, the ledger names labels of the mode. Every mission minigame step whose
    params.mode is a minigame_modes id branches on dat and chua_dat, carries pass_score and max_faults,
    is played by the mode's protagonist, and can be won: a perfect play at the step's difficulty
    reaches pass_score. params.mode values that name no row are modes coded in gameplay (day_xe_loi_nuoc)."""
    import runtime_rules as rr
    errors = []
    modes = {k.split(":", 1)[1]: v for k, v in items.items() if k.startswith("minigame_modes:")}
    for mid, m in modes.items():
        where = f"minigame_modes:{mid}"
        labels = {lb["id"] for lb in m.get("labels", [])}
        ids = [t["id"] for t in m["tasks"]]
        if len(set(ids)) != len(ids):
            errors.append(f"{where}: duplicate task ids")
        for t in m["tasks"]:
            tw = f"{where}.{t['id']}"
            if m["mechanic"] == "phan_loai":
                if t.get("answer") not in labels:
                    errors.append(f"{tw}: answer {t.get('answer')!r} is not a label of the mode")
                if "order" in t or t.get("forbidden"):
                    errors.append(f"{tw}: order/forbidden belong to sap_xep modes")
            else:
                if "answer" in t:
                    errors.append(f"{tw}: answer belongs to phan_loai modes")
                if not t.get("forbidden") and "order" not in t:
                    errors.append(f"{tw}: a sap_xep task needs an order (or forbidden: true)")
                if t.get("forbidden") and t["points"] != 0:
                    errors.append(f"{tw}: a forbidden task scores nothing (points 0)")
        if m["mechanic"] == "phan_loai" and len(labels) < 2:
            errors.append(f"{where}: phan_loai needs at least two labels")
        lg = m.get("ledger")
        if lg:
            for key in ("principal_label", "capitalized_label", "paid_label"):
                if key in lg and lg[key] not in labels:
                    errors.append(f"{where}: ledger.{key} {lg[key]!r} is not a label")
            owed = rr.ledger_owed(m)
            if abs(owed - lg["expected_owed_vnd"]) > lg.get("tolerance_vnd", 0):
                errors.append(f"{where}: the ledger gives {owed:,} VND owed, the story says {lg['expected_owed_vnd']:,}")
    for p, name, doc in docs:
        if name != "missions":
            continue
        for mis in doc.get("items", []):
            for s in mis.get("steps", []):
                pr = s.get("params") or {}
                if s.get("kind") != "minigame" or pr.get("mode") not in modes:
                    continue
                m = modes[pr["mode"]]
                where = f"{p}: missions:{mis['id']}.{s['id']} (mode {pr['mode']})"
                nxt = s.get("next")
                if not isinstance(nxt, dict) or not {"dat", "chua_dat"} <= set(nxt):
                    errors.append(f"{where}: a minigame mode step branches on dat and chua_dat")
                for key in ("pass_score", "max_faults", "difficulty"):
                    if key not in pr:
                        errors.append(f"{where}: params.{key} is required with a minigame mode")
                if m["protagonist"] not in _step_protagonists(mis):
                    errors.append(f"{where}: the mode is played by {m['protagonist']}, not a protagonist of this mission")
                if "pass_score" in pr and rr.perfect_play(m, pr).score < pr["pass_score"]:
                    errors.append(f"{where}: a perfect play cannot reach pass_score {pr['pass_score']}")
    return errors


def check_flood_layers(docs, items):
    """flood_layers rows: the timeline starts at t 0 and runs forward, duration_h is a whole number of
    step_h, rain-zone fields are present on rain zones and floor_m on river zones; every mission
    params.flood_layer is 'live' or a flood_layers id."""
    errors = []
    layers = {k.split(":", 1)[1]: v for k, v in items.items() if k.startswith("flood_layers:")}
    for lid, layer in layers.items():
        where = f"flood_layers:{lid}"
        ts = [k["t_h"] for k in layer["timeline"]]
        if ts[0] != 0 or any(b <= a for a, b in zip(ts, ts[1:])):
            errors.append(f"{where}: timeline t_h must start at 0 and increase")
        n = layer["duration_h"] / layer["step_h"]
        if abs(n - round(n)) > 1e-9:
            errors.append(f"{where}: duration_h is not a whole number of step_h")
        zids = [z["id"] for z in layer["zones"]]
        if len(set(zids)) != len(zids):
            errors.append(f"{where}: duplicate zone ids")
        for z in layer["zones"]:
            need = ("floor_m",) if z["cause"] == "song" else ("catchment", "drain_mm_h", "max_depth_m")
            for key in need:
                if key not in z:
                    errors.append(f"{where}.{z['id']}: a {z['cause']} zone needs {key}")
    for p, name, doc in docs:
        if name != "missions":
            continue
        for mis in doc.get("items", []):
            for s in mis.get("steps", []):
                fl = (s.get("params") or {}).get("flood_layer")
                if fl is not None and fl != "live" and fl not in layers:
                    errors.append(f"{p}: missions:{mis['id']}.{s['id']}: flood_layer {fl!r} is not 'live' or a flood_layers id")
    return errors


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="game")
    a = ap.parse_args()
    root = pathlib.Path(a.root)
    schemas, registry = load_registry(root / "schemas")
    errors, ids, docs, items = [], {}, [], {}

    for p in sorted((root / "content").rglob("*.json")):
        try:
            doc = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"{p}: invalid JSON: {e}")
            continue
        name = doc.get("collection")
        if name not in schemas or name == "common":
            errors.append(f"{p}: unknown collection {name!r}")
            continue
        v = Draft202012Validator(schemas[name], registry=registry)
        for e in sorted(v.iter_errors(doc), key=lambda e: list(e.path)):
            loc = "/".join(str(x) for x in e.path)
            errors.append(f"{p}: {loc}: {e.message}")
        for item in doc.get("items", []):
            key = f"{name}:{item.get('id')}"
            if key in ids:
                errors.append(f"{p}: duplicate id {key} (also in {ids[key]})")
            ids[key] = p
            items[key] = item
        docs.append((p, name, doc))

    for p, name, doc in docs:
        item_schema = schemas[name]["properties"]["items"]["items"]
        for i, item in enumerate(doc.get("items", [])):
            for path, ref in iter_refs(item_schema, item, f"items[{i}]({item.get('id')})", schemas):
                if ref not in ids:
                    errors.append(f"{p}: {path}: unresolved reference {ref}")

    errors += check_missions(docs, items)
    errors += check_dialogues(docs)
    errors += check_minigame_modes(docs, items)
    errors += check_flood_layers(docs, items)

    counts = {}
    for _, name, doc in docs:
        counts[name] = counts.get(name, 0) + len(doc.get("items", []))
    for e in errors:
        print(e)
    print(json.dumps({"collections": counts, "items": sum(counts.values()), "errors": len(errors)},
                     ensure_ascii=False))
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
