"""Generate Unreal C++ row types from game/schemas and convert game/content to DataTable JSON.

Two jobs, both deterministic and stdlib-only (so Unreal's embedded Python can run this file too):

1. Header: game/schemas/*.schema.json -> ue5/Plugins/HanoiCity/Source/HanoiCityRuntime/Public/
   Generated/HanoiContentTypes.h. One USTRUCT(BlueprintType) deriving FTableRowBase per collection
   item ("F<Prefix><Singular>Row"), nested USTRUCTs for nested objects, one UENUM per enum.
   Shared types from common.schema.json map to the hand-written structs in HanoiCoreTypes.h
   (FHanoiText, FHanoiGeo, FHanoiRef, FHanoiHourRange, FHanoiTarget, FHanoiNext) or to generated
   FHanoiCondition / FHanoiReward. The header is committed; regenerate whenever a schema changes
   (tests/test_codegen_ue.py fails while it is stale).

2. Data: every game/content/**.json collection document -> <out>/<collection>.json, a JSON array
   of rows in the format UE's DataTable JSON importer reads: {"Name": <id>, <UPROPERTY>: value}.
   Every field is written (defaults for absent optional fields) so imports produce no
   "missing property" warnings. <out>/manifest.json maps collection -> row struct, for
   ue5/Plugins/HanoiCity/Content/Python/import_content.py. Default out: ue5/Data/Generated
   (gitignored: it is a build product of game/content).

Mapping rules (also documented in docs/05-tich-hop-ue5.md):
  string -> FString; $defs/id -> FName; $defs/ref "col:id" -> FHanoiRef{Collection, Id};
  integer -> int32; money_vnd -> int64; number -> float; boolean -> bool (prefixed b);
  enum -> UENUM with an "Unset" zero value, identifiers PascalCased, UMETA(DisplayName = original);
  object with properties -> nested USTRUCT; object with only additionalProperties -> TMap<FName, V>;
  free-form object -> FString holding compact JSON; array -> TArray;
  oneOf geo|ref -> FHanoiTarget{Kind, Geo, Ref}; oneOf id|{key: id} -> FHanoiNext{Step, Branches};
  any other oneOf -> FString holding compact JSON.
  Property "name" becomes DisplayName (DataTable JSON reserves "Name" for the row name) and
  "class" becomes ClassKind.

Usage:
  python tools/codegen_ue.py                # write header + convert content
  python tools/codegen_ue.py --check        # exit 1 if the committed header is stale
  python tools/codegen_ue.py --data-only --content game/content --out ue5/Data/Generated
"""

import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCHEMA_DIR = ROOT / "game" / "schemas"
CONTENT_DIR = ROOT / "game" / "content"
HEADER_PATH = (ROOT / "ue5" / "Plugins" / "HanoiCity" / "Source" / "HanoiCityRuntime" / "Public"
               / "Generated" / "HanoiContentTypes.h")
DATA_OUT = ROOT / "ue5" / "Data" / "Generated"

PREFIX = "Hanoi"
API = "HANOICITYRUNTIME_API"
COMMON = "common.schema.json#/$defs/"

SINGULAR = {
    "activities": "Activity", "building_archetypes": "BuildingArchetype", "businesses": "Business",
    "characters": "Character", "dialogues": "Dialogue", "districts": "District", "events": "Event",
    "factions": "Faction", "items": "Item", "landmarks": "Landmark", "missions": "Mission",
    "radio": "RadioStation", "traffic_rules": "TrafficRule", "vehicles": "Vehicle",
    # nested array properties
    "steps": "Step", "upgrades": "Upgrade", "lines": "Line", "choices": "Choice",
    "schedule": "ScheduleEntry", "relationships": "Relationship",
}
RENAMES = {"name": "DisplayName", "class": "ClassKind"}
FIXED_ENUM_NAMES = {("FHanoiCondition", "weather"): "EHanoiWeather"}

# Hand-written structs in HanoiCoreTypes.h: (json key, UPROPERTY name, spec) per field.
CORE = {
    "FHanoiText": [("vi", "Vi", {"k": "string"}), ("en", "En", {"k": "string"})],
    "FHanoiGeo": [("lat", "Lat", {"k": "double"}), ("lon", "Lon", {"k": "double"}),
                  ("alt_m", "AltM", {"k": "double"}), (None, "bIsSet", {"k": "bool"})],
    "FHanoiRef": [(None, "Collection", {"k": "name"}), (None, "Id", {"k": "name"})],
    "FHanoiHourRange": [(None, "From", {"k": "float"}), (None, "To", {"k": "float"})],
    "FHanoiTarget": [(None, "Kind", {"k": "enum", "name": "EHanoiTargetKind"}),
                     (None, "Geo", {"k": "struct", "name": "FHanoiGeo"}),
                     (None, "Ref", {"k": "struct", "name": "FHanoiRef"})],
    "FHanoiNext": [(None, "Step", {"k": "name"}),
                   (None, "Branches", {"k": "map", "value": {"k": "name"}})],
}

CPP_SCALARS = {"name": "FName", "string": "FString", "int": "int32", "int64": "int64",
               "float": "float", "double": "double", "bool": "bool", "json": "FString"}
CPP_DEFAULTS = {"int": " = 0", "int64": " = 0", "float": " = 0.f", "double": " = 0.0",
                "bool": " = false"}


# ----------------------------------------------------------------------------- naming

def pascal(s):
    """snake_case -> PascalCase; adjacent numeric parts keep an underscore (1873_1954)."""
    out = ""
    for part in [p for p in re.split(r"[^A-Za-z0-9]+", s) if p]:
        if out and out[-1].isdigit() and part[0].isdigit():
            out += "_"
        out += part[0].upper() + part[1:]
    if not out or out[0].isdigit():
        out = "V" + out
    return out


def singular(prop):
    if prop in SINGULAR:
        return SINGULAR[prop]
    p = pascal(prop)
    if p.endswith("ies"):
        return p[:-3] + "y"
    if p.endswith("s") and not p.endswith("ss"):
        return p[:-1]
    return p + "Entry"


def field_name(prop, spec):
    n = RENAMES.get(prop, pascal(prop))
    return "b" + n if spec["k"] == "bool" else n


def enum_ident(value):
    return pascal(str(value))


# ----------------------------------------------------------------------------- model

class Model:
    def __init__(self, schemas):
        self.schemas = schemas
        self.common = schemas["common"]["$defs"]
        self.structs = {}      # name -> {"fields": [...], "doc": str, "row": bool, "collection"}
        self.order = []        # emission order (dependencies first)
        self.enums = {}        # name -> [values]
        self.enum_by_values = {}
        self.collections = {}  # collection -> row struct name
        self._common_struct("condition", "FHanoiCondition")
        self._common_struct("reward", "FHanoiReward")
        for name in sorted(schemas):
            if name == "common":
                continue
            s = schemas[name]
            col = s.get("x-collection") or s["properties"]["collection"]["const"]
            item = s["properties"]["items"]["items"]
            row = f"F{PREFIX}{SINGULAR.get(col, pascal(col))}Row"
            self._struct(row, item, doc=s.get("description") or s.get("title", ""), row=True,
                         collection=col)
            self.collections[col] = row

    def _common_struct(self, def_name, struct_name):
        node = self.common[def_name]
        self._struct(struct_name, node, doc=node.get("description", ""))

    def _struct(self, name, node, doc="", row=False, collection=None):
        if name in self.structs:
            return
        self.structs[name] = None  # reserve (guards recursion)
        fields = []
        required = set(node.get("required", []))
        base = name[:-3] if name.endswith("Row") else name
        for prop, sub in node.get("properties", {}).items():
            spec = self.spec(sub, base, prop)
            fields.append({"json": prop, "cpp": field_name(prop, spec), "spec": spec,
                           "required": prop in required, "doc": self._doc(sub)})
        self.structs[name] = {"fields": fields, "doc": doc, "row": row, "collection": collection,
                              "props": list(node.get("properties", {}))}
        self.order.append(name)

    def _doc(self, node):
        if "description" in node:
            return node["description"]
        ref = node.get("$ref", "")
        if ref.startswith(COMMON):
            return self.common[ref[len(COMMON):]].get("description", "")
        return ""

    def _enum(self, owner, prop, values):
        key = tuple(values)
        fixed = FIXED_ENUM_NAMES.get((owner, prop))
        if fixed is None and key in self.enum_by_values:
            return self.enum_by_values[key]
        name = fixed or "E" + owner[1:] + pascal(prop)
        idents = [enum_ident(v) for v in values]
        if len(set(idents)) != len(idents) or "Unset" in idents:
            raise ValueError(f"{name}: enum values do not sanitize to unique identifiers")
        self.enums[name] = list(values)
        self.enum_by_values.setdefault(key, name)
        return name

    def spec(self, node, owner, prop, elem=False):
        """Map one schema node to a type spec dict {"k": kind, ...}.

        elem: node is the item schema of array property `prop` (struct names use the singular).
        """
        ref = node.get("$ref", "")
        if ref.startswith("#/$defs/"):  # local ref inside common.schema.json
            ref = COMMON + ref[len("#/$defs/"):]
        if ref:
            if not ref.startswith(COMMON):
                raise ValueError(f"unsupported $ref {ref}")
            d = ref[len(COMMON):]
            return {
                "id": {"k": "name"},
                "ref": {"k": "struct", "name": "FHanoiRef", "core": "ref"},
                "text": {"k": "struct", "name": "FHanoiText", "core": "text"},
                "geo": {"k": "struct", "name": "FHanoiGeo", "core": "geo"},
                "money_vnd": {"k": "int64"},
                "hour_range": {"k": "struct", "name": "FHanoiHourRange", "core": "hours"},
                "tags": {"k": "array", "elem": {"k": "name"}},
                "condition": {"k": "struct", "name": "FHanoiCondition"},
                "reward": {"k": "struct", "name": "FHanoiReward"},
            }[d]
        if "oneOf" in node:
            alts = [self.spec(a, owner, prop, elem) for a in node["oneOf"]]
            cores = sorted(a.get("core", a["k"]) for a in alts)
            if cores == ["geo", "ref"]:
                return {"k": "struct", "name": "FHanoiTarget", "core": "target"}
            if (len(alts) == 2 and {"k": "name"} in alts
                    and {"k": "map", "value": {"k": "name"}} in alts):
                return {"k": "struct", "name": "FHanoiNext", "core": "next"}
            return {"k": "json"}
        if "enum" in node:
            return {"k": "enum", "name": self._enum(owner, prop, node["enum"])}
        t = node.get("type")
        if t == "object":
            if node.get("properties"):
                name = owner + (singular(prop) if elem else pascal(prop))
                self._struct(name, node, doc=node.get("description", ""))
                return {"k": "struct", "name": name}
            ap = node.get("additionalProperties")
            if isinstance(ap, dict):
                return {"k": "map", "value": self.spec(ap, owner, prop, elem)}
            return {"k": "json"}
        if t == "array":
            return {"k": "array", "elem": self.spec(node.get("items", {}), owner, prop, True)}
        if t == "string":
            return {"k": "string"}
        if t == "integer":
            return {"k": "int"}
        if t == "number":
            return {"k": "float"}
        if t == "boolean":
            return {"k": "bool"}
        return {"k": "json"}


def load_schemas(schema_dir=SCHEMA_DIR):
    out = {}
    for p in sorted(pathlib.Path(schema_dir).glob("*.schema.json")):
        out[p.name[:-len(".schema.json")]] = json.loads(p.read_text(encoding="utf-8"))
    return out


def build_model(schema_dir=SCHEMA_DIR):
    return Model(load_schemas(schema_dir))


# ----------------------------------------------------------------------------- header

def cpp_type(spec):
    k = spec["k"]
    if k in CPP_SCALARS:
        return CPP_SCALARS[k]
    if k in ("struct", "enum"):
        return spec["name"]
    if k == "array":
        return f"TArray<{cpp_type(spec['elem'])}>"
    if k == "map":
        return f"TMap<FName, {cpp_type(spec['value'])}>"
    raise ValueError(k)


def cpp_default(spec):
    if spec["k"] == "enum":
        return f" = {spec['name']}::Unset"
    return CPP_DEFAULTS.get(spec["k"], "")


def comment(text, indent="\t"):
    text = " ".join(str(text).replace("*/", "* /").split())
    return f"{indent}/** {text} */\n" if text else ""


def render_header(model):
    o = ["// GENERATED by tools/codegen_ue.py from game/schemas/*.schema.json. DO NOT EDIT.\n"
         "// Regenerate: python tools/codegen_ue.py\n\n"
         "#pragma once\n\n"
         "#include \"CoreMinimal.h\"\n"
         "#include \"Engine/DataTable.h\"\n"
         "#include \"HanoiCoreTypes.h\"\n"
         "#include \"HanoiContentTypes.generated.h\"\n\n"]
    for name in sorted(model.enums):
        o.append(f"UENUM(BlueprintType)\nenum class {name} : uint8\n{{\n")
        o.append("\tUnset = 0 UMETA(DisplayName = \"(unset)\"),\n")
        for v in model.enums[name]:
            o.append(f"\t{enum_ident(v)} UMETA(DisplayName = \"{v}\"),\n")
        o.append("};\n\n")
    for name in model.order:
        s = model.structs[name]
        doc = s["doc"]
        if s["row"]:
            doc = f"Row of collection '{s['collection']}' (DataTable row name = id). {doc}"
        o.append(comment(doc, ""))
        o.append("USTRUCT(BlueprintType)\n")
        base = " : public FTableRowBase" if s["row"] else ""
        o.append(f"struct {API} {name}{base}\n{{\n\tGENERATED_BODY()\n")
        for f in s["fields"]:
            note = f"json: {f['json']}{' (required)' if f['required'] else ''}"
            if f["spec"]["k"] == "json":
                note += " - compact JSON text"
            doc = f"{f['doc']} [{note}]" if f["doc"] else f"[{note}]"
            o.append("\n" + comment(doc))
            o.append("\tUPROPERTY(EditAnywhere, BlueprintReadWrite, Category = \"Hanoi\")\n")
            o.append(f"\t{cpp_type(f['spec'])} {f['cpp']}{cpp_default(f['spec'])};\n")
        o.append("};\n\n")
    o.append("namespace HanoiGenerated\n{\n")
    o.append("\t/** Calls Fn(collection name, row struct) for every content collection. */\n")
    o.append("\tinline void ForEachCollection(TFunctionRef<void(FName, UScriptStruct*)> Fn)\n\t{\n")
    for col in sorted(model.collections):
        o.append(f"\t\tFn(FName(TEXT(\"{col}\")), {model.collections[col]}::StaticStruct());\n")
    o.append("\t}\n}\n")
    return "".join(o)


# ----------------------------------------------------------------------------- data

def convert_value(model, spec, v):
    """Convert a content value (None = absent) to the DataTable JSON value for spec."""
    k = spec["k"]
    if k in ("name", "string"):
        return "" if v is None else str(v)
    if k in ("int", "int64"):
        return 0 if v is None else int(v)
    if k in ("float", "double"):
        return 0.0 if v is None else float(v)
    if k == "bool":
        return bool(v)
    if k == "json":
        return "" if v is None else json.dumps(v, ensure_ascii=False, sort_keys=True,
                                               separators=(",", ":"))
    if k == "enum":
        if v is None:
            return "Unset"
        if v not in model.enums[spec["name"]]:
            raise ValueError(f"{v!r} is not a value of {spec['name']}")
        return enum_ident(v)
    if k == "array":
        return [convert_value(model, spec["elem"], x) for x in (v or [])]
    if k == "map":
        return {str(key): convert_value(model, spec["value"], x)
                for key, x in sorted((v or {}).items())}
    if k == "struct":
        core = spec.get("core")
        if core:
            return convert_core(model, core, v)
        return convert_struct(model, spec["name"], v or {})
    raise ValueError(k)


def parse_ref(s):
    col, _, rid = str(s).partition(":")
    return {"Collection": col, "Id": rid}


def convert_core(model, core, v):
    if core == "text":
        v = v or {}
        return {"Vi": v.get("vi", ""), "En": v.get("en", "")}
    if core == "geo":
        if v is None:
            return {"Lat": 0.0, "Lon": 0.0, "AltM": 0.0, "bIsSet": False}
        return {"Lat": float(v["lat"]), "Lon": float(v["lon"]),
                "AltM": float(v.get("alt_m", 0.0)), "bIsSet": True}
    if core == "ref":
        return parse_ref(v) if v else {"Collection": "", "Id": ""}
    if core == "hours":
        a, b = (v if v is not None else (0, 24))
        return {"From": float(a), "To": float(b)}
    if core == "target":
        out = {"Kind": "Unset", "Geo": convert_core(model, "geo", None),
               "Ref": convert_core(model, "ref", None)}
        if isinstance(v, dict):
            out["Kind"], out["Geo"] = "Geo", convert_core(model, "geo", v)
        elif isinstance(v, str):
            out["Kind"], out["Ref"] = "Ref", parse_ref(v)
        return out
    if core == "next":
        if isinstance(v, dict):
            return {"Step": "", "Branches": {str(a): str(b) for a, b in sorted(v.items())}}
        return {"Step": v or "", "Branches": {}}
    raise ValueError(core)


def convert_struct(model, name, obj):
    s = model.structs[name]
    known = {f["json"] for f in s["fields"]}
    extra = set(obj) - known
    if extra:
        raise ValueError(f"{name}: unknown properties {sorted(extra)}")
    return {f["cpp"]: convert_value(model, f["spec"], obj.get(f["json"])) for f in s["fields"]}


def convert_item(model, collection, item):
    row = {"Name": item["id"]}
    row.update(convert_struct(model, model.collections[collection], item))
    return row


def load_content(content_dir=CONTENT_DIR):
    """Merge every collection document under content_dir: {collection: [items]} (file order)."""
    out = {}
    for p in sorted(pathlib.Path(content_dir).rglob("*.json")):
        doc = json.loads(p.read_text(encoding="utf-8"))
        if not isinstance(doc, dict) or "collection" not in doc:
            continue
        out.setdefault(doc["collection"], []).extend((p, it) for it in doc.get("items", []))
    return out


def convert_content(model, content_dir=CONTENT_DIR, out_dir=DATA_OUT):
    out_dir = pathlib.Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = {"generator": "tools/codegen_ue.py", "collections": {}}
    for col, entries in sorted(load_content(content_dir).items()):
        if col not in model.collections:
            raise ValueError(f"unknown collection {col!r} in {entries[0][0]}")
        rows, seen = [], {}
        for path, item in entries:
            if item["id"] in seen:
                raise ValueError(f"{col}:{item['id']} defined in {seen[item['id']]} and {path}")
            seen[item["id"]] = path
            rows.append(convert_item(model, col, item))
        (out_dir / f"{col}.json").write_text(
            json.dumps(rows, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        manifest["collections"][col] = {
            "file": f"{col}.json", "rows": len(rows),
            "row_struct": model.collections[col][1:],  # UScriptStruct name has no F prefix
            "struct_path": f"/Script/HanoiCityRuntime.{model.collections[col][1:]}",
        }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n",
                                           encoding="utf-8")
    return manifest


# ----------------------------------------------------------------------------- cli

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--schemas", default=str(SCHEMA_DIR))
    ap.add_argument("--content", default=str(CONTENT_DIR))
    ap.add_argument("--header", default=str(HEADER_PATH))
    ap.add_argument("--out", default=str(DATA_OUT), help="DataTable JSON output directory")
    ap.add_argument("--check", action="store_true", help="fail if the header is stale")
    ap.add_argument("--data-only", action="store_true")
    ap.add_argument("--header-only", action="store_true")
    a = ap.parse_args(argv)
    model = build_model(a.schemas)
    header = pathlib.Path(a.header)
    text = render_header(model)
    if a.check:
        if not header.exists() or header.read_text(encoding="utf-8") != text:
            print(f"{header} is stale; run python tools/codegen_ue.py", file=sys.stderr)
            return 1
        print("header up to date")
        return 0
    if not a.data_only:
        header.parent.mkdir(parents=True, exist_ok=True)
        if not header.exists() or header.read_text(encoding="utf-8") != text:
            header.write_text(text, encoding="utf-8", newline="\n")
        print(f"header: {header} ({len(model.order)} structs, {len(model.enums)} enums)")
    if not a.header_only:
        if pathlib.Path(a.content).is_dir():
            m = convert_content(model, a.content, a.out)
            n = sum(c["rows"] for c in m["collections"].values())
            print(f"data: {a.out} ({len(m['collections'])} collections, {n} rows)")
        else:
            print(f"data: skipped, {a.content} not found")
    return 0


if __name__ == "__main__":
    sys.exit(main())
