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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="game")
    a = ap.parse_args()
    root = pathlib.Path(a.root)
    schemas, registry = load_registry(root / "schemas")
    errors, ids, docs = [], {}, []

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
        docs.append((p, name, doc))

    for p, name, doc in docs:
        item_schema = schemas[name]["properties"]["items"]["items"]
        for i, item in enumerate(doc.get("items", [])):
            for path, ref in iter_refs(item_schema, item, f"items[{i}]({item.get('id')})", schemas):
                if ref not in ids:
                    errors.append(f"{p}: {path}: unresolved reference {ref}")

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
