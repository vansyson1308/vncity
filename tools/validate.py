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
DIALOGUE_CONDITION_KEYS = {"flags", "flags_not", "min_reputation", "protagonist"}  # UHanoiMissionSubsystem::ResolveDialogueLine  # common.schema.json#/$defs/step_id; UHanoiMissionSubsystem::Advance


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
    """Dialogue graphs: every goto names a line of the same dialogue, line ids are unique, and
    `condition` on lines/choices only uses state the dialogue UI can evaluate mid-conversation
    (flags, flags_not, min_reputation, protagonist); a line with choices has no goto of its own."""
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
