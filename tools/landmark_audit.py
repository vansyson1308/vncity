"""Audit every landmark coordinate against OpenStreetMap-derived open data and lock the result.

Why: a landmark is where the hero asset, mission markers and collectibles go. A pin 200 m off
puts Đền Ngọc Sơn in the lake or Chợ Hôm on the wrong block, and Hanoi players notice at once.

Source: Overture Maps (release pinned in fetch.RELEASE). Its water, land use, infrastructure,
transportation and building layers are OpenStreetMap data (ODbL); places add Meta/Microsoft POIs.
OSM's own servers (Overpass, Nominatim) are not reachable from the build containers, Overture on
S3 is, and its `sources[].record_id` keeps the OSM way/relation id so every match can be opened on
openstreetmap.org.

Steps:
  python tools/landmark_audit.py fetch            # ~2-4 min: named features in the landmark bbox -> data/landmark_ref/
  python tools/landmark_audit.py audit            # report: offset of each landmark to its OSM feature
  python tools/landmark_audit.py audit --fix      # move landmarks further than 50 m onto the feature,
                                                  # rewrite game/reference/landmarks_osm.json
Name matching picks namesakes now and then (a café called after the tower), so a landmark can be pinned
by hand in the "overrides" block of game/reference/landmarks_osm.json: {"osm": "way/123", "reason": ...}
forces the match, {"ref_point": {...}, "source": ...} cites a reference where OSM has nothing, and
"district_note" explains a landmark whose 2025 ward lies outside its game zone (old quận).
For each landmark the matched feature, its OSM id, the reference point (the nearest point of the
feature to the landmark, or the landmark itself when it lies inside the feature) and the 2025 wards
around it are written to game/reference/landmarks_osm.json. tests/test_landmark_coords.py reads that
snapshot offline, so CI fails if a coordinate is edited without re-running the audit.
"""

import argparse
import json
import math
import pathlib
import re
import sys
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

LANDMARKS = ROOT / "game" / "content" / "world" / "landmarks.json"
DISTRICTS = ROOT / "game" / "content" / "world" / "districts.json"
REFERENCE = ROOT / "game" / "reference" / "landmarks_osm.json"
CACHE = ROOT / "data" / "landmark_ref"
TOLERANCE_M = 50.0
SEARCH_M = 2500.0
AREA_KINDS = {"lake", "bridge", "street", "park"}
# Words too common in Hanoi names to identify anything on their own.
STOP = {"ha", "noi", "hanoi", "the", "of", "and", "pho", "duong", "khu", "di", "tich", "quoc", "gia",
        "viet", "nam", "vietnam", "phuong", "quan", "song", "hong", "ngo", "cong", "vien"}
# Layer preference per landmark kind: an area landmark must match the area itself, not a café named after it.
# Street furniture named after the landmark ("Bảo tàng Dân tộc học" bus stop) is not the landmark.
MINOR_INFRA = {"bus_stop", "bus_station", "parking", "parking_entrance", "bicycle_parking", "motorcycle_parking",
               "pedestrian_crossing", "crossing", "traffic_signals", "atm", "toilets", "bench", "information",
               "charging_station", "vending_machine", "post_box", "waste_basket", "drinking_water"}
PREFERRED = {
    "lake": ("water",),
    "bridge": ("infrastructure", "segment"),
    "street": ("segment",),
    "park": ("land_use", "water"),
}

LAYERS = {
    "place": ("places", "place", "names.primary", "NULL::VARCHAR AS cls"),
    "building": ("buildings", "building", "names.primary", "class AS cls"),
    "water": ("base", "water", "names.primary", "class AS cls"),
    "land_use": ("base", "land_use", "names.primary", "class AS cls"),
    "infrastructure": ("base", "infrastructure", "names.primary", "class AS cls"),
    "segment": ("transportation", "segment", "names.primary", "class AS cls"),
    "division": ("divisions", "division_area", "names.primary", "subtype AS cls"),
}


def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower()).replace("đ", "d")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9 ]+", " ", s).split()


def score(a, b):
    ta, tb = set(norm(a)) - STOP, set(norm(b)) - STOP
    if not ta or not tb:
        return 0.0
    common = len(ta & tb)
    return min(common / len(ta), common / len(tb))


def name_variants(lm):
    """'Hồ Hoàn Kiếm (Hồ Gươm)' -> the full name, each part, plus the English and real names."""
    out = []
    for raw in (lm["name"]["vi"], lm["name"].get("en"), lm.get("modelling", {}).get("real_name")):
        if not raw:
            continue
        out.append(raw)
        out += [p.strip() for p in re.split(r"[()\-–]| và | and ", raw) if len(norm(p)) >= 1 and p.strip() != raw]
    return [v for v in dict.fromkeys(out) if set(norm(v)) - STOP]


def ward_key(name):
    """'Phường Văn Miếu - Quốc Tử Giám' and 'Văn Miếu - Quốc Tử Giám' are the same ward."""
    return " ".join(t for t in norm(name) if t not in ("phuong", "xa", "quan", "huyen"))


def dist_m(lat1, lon1, lat2, lon2):
    r = 6_371_008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def bbox_of(items, pad_m=SEARCH_M):
    pad = pad_m / 111_000
    return (min(i["location"]["lon"] for i in items) - pad, min(i["location"]["lat"] for i in items) - pad,
            max(i["location"]["lon"] for i in items) + pad, max(i["location"]["lat"] for i in items) + pad)


def fetch(_args):
    from fetch import RELEASE, bbox_filter, connect, overture
    items = json.loads(LANDMARKS.read_text(encoding="utf-8"))["items"]
    w, s, e, n = bbox_of(items)
    CACHE.mkdir(parents=True, exist_ok=True)
    con = connect()
    for layer, (theme, typ, name_col, cls) in LAYERS.items():
        out = CACHE / f"{layer}.parquet"
        extra = "AND subtype IN ('locality', 'neighborhood', 'macrohood', 'county', 'localadmin')" if layer == "division" else ""
        con.sql(f"""COPY (
            SELECT id, {name_col} AS name, {cls},
                   list_transform(sources, x -> x.dataset || ':' || coalesce(x.record_id, '')) AS sources,
                   ST_AsWKB(geometry) AS wkb
            FROM {overture(theme, typ)}
            WHERE {bbox_filter(w, s, e, n)} AND {name_col} IS NOT NULL {extra}
        ) TO '{out}' (FORMAT parquet, COMPRESSION zstd)""")
        print(f"{layer:<15}{con.sql(f"SELECT count(*) FROM '{out}'").fetchone()[0]:>9,}")
    (CACHE / "meta.json").write_text(json.dumps({"overture_release": RELEASE, "bbox": [w, s, e, n]}))


def osm_ref(sources):
    """'OpenStreetMap:w123@4' -> 'way/123' (the id openstreetmap.org understands)."""
    for src in sources or []:
        ds, _, rec = src.partition(":")
        if ds == "OpenStreetMap" and rec:
            m = re.match(r"([nwr])(\d+)", rec)
            if m:
                return {"n": "node", "w": "way", "r": "relation"}[m.group(1)] + "/" + m.group(2)
    return None


def load_features():
    """Per layer: the features plus an index token -> feature numbers, so matching 260k places is quick."""
    import duckdb
    import numpy as np
    import shapely
    from pyproj import Transformer
    fwd = Transformer.from_crs("EPSG:4326", "EPSG:32648", always_xy=True)
    con = duckdb.connect()
    feats = {}
    for layer in LAYERS:
        rows = con.sql(f"SELECT id, name, cls, sources, wkb FROM '{CACHE / (layer + '.parquet')}'").fetchall()
        geoms = shapely.from_wkb([bytes(r[4]) for r in rows])
        geoms = shapely.transform(geoms, lambda xy: np.column_stack(fwd.transform(xy[:, 0], xy[:, 1])))
        out, index = [], {}
        for (fid, name, cls, sources, _), g in zip(rows, geoms):
            if g is None or g.is_empty:
                continue
            k = len(out)
            out.append({"layer": layer, "id": fid, "name": name, "cls": cls, "sources": sources, "geom": g})
            for t in set(norm(name)) - STOP:
                index.setdefault(t, []).append(k)
        feats[layer] = out
        feats[layer + "#index"] = index
    return feats, fwd


def audit(args):
    from pyproj import Transformer
    from shapely.geometry import Point
    from shapely.ops import nearest_points, unary_union

    meta = json.loads((CACHE / "meta.json").read_text())
    feats, fwd = load_features()
    inv = Transformer.from_crs("EPSG:32648", "EPSG:4326", always_xy=True)
    doc = json.loads(LANDMARKS.read_text(encoding="utf-8"))
    districts = {d["id"]: d for d in json.loads(DISTRICTS.read_text(encoding="utf-8"))["items"]}
    overrides = json.loads(REFERENCE.read_text(encoding="utf-8")).get("overrides", {}) if REFERENCE.exists() else {}

    def to_ll(p):
        lon, lat = inv.transform(p.x, p.y)
        return round(lat, 6), round(lon, 6)

    def wards_of(lm, pt):
        """The 2025 wards around the pin, and whether one of them belongs to the landmark's game zone."""
        wards = sorted({w["name"] for w in feats["division"] if w["cls"] in ("neighborhood", "locality", "macrohood") and w["geom"].covers(pt)})
        allowed = {ward_key(n) for n in districts.get(lm.get("district", "").split(":", 1)[-1], {}).get("overture_division_names", [])}
        return wards, (bool({ward_key(w) for w in wards} & allowed) if wards else None)

    refs, moved, problems = {}, [], []
    for lm in doc["items"]:
        lat, lon = lm["location"]["lat"], lm["location"]["lon"]
        pt = Point(*fwd.transform(lon, lat))
        variants = name_variants(lm)
        pref = PREFERRED.get(lm["kind"], ("building", "place"))
        osm_layers = ["building", "land_use", "water", "infrastructure", "segment"]
        layers = list(pref) + [l for l in osm_layers if l not in pref] if lm["kind"] in AREA_KINDS else osm_layers
        ov = overrides.get(lm["id"])
        if ov and ov.get("osm"):
            layers = list(LAYERS)
        cands = []
        for layer in dict.fromkeys(layers + ["place"]):
            pool, index = feats.get(layer, []), feats.get(layer + "#index", {})
            hits = {k for v in variants for t in set(norm(v)) - STOP for k in index.get(t, ())}
            if ov and ov.get("osm"):
                hits |= {k for k, f in enumerate(pool) if osm_ref(f["sources"]) == ov["osm"]}
            for f in (pool[k] for k in hits):
                d = f["geom"].distance(pt)
                if d > SEARCH_M:
                    continue
                if f["layer"] == "infrastructure" and f["cls"] in MINOR_INFRA:
                    continue
                if ov and ov.get("osm"):
                    if osm_ref(f["sources"]) != ov["osm"]:
                        continue
                    sc = 1.0
                else:
                    sc = max(score(v, f["name"]) for v in variants)
                if sc < 0.6:
                    continue
                rank = (layers.index(layer) if layer in layers else len(layers))
                cands.append((-sc, rank, d, f, layer))
        if ov and ov.get("ref_point"):
            rp = ov["ref_point"]
            d = dist_m(lat, lon, rp["lat"], rp["lon"])
            wards, district_ok = wards_of(lm, pt)
            refs[lm["id"]] = {"name": lm["name"]["vi"], "match": ov["source"], "layer": "manual", "osm": None,
                              "ref_point": rp, "offset_m": round(d, 1), "wards_2025": wards, "district_ok": district_ok}
            if ov.get("district_note"):
                refs[lm["id"]]["district_note"] = ov["district_note"]
            elif district_ok is False:
                problems.append((lm["id"], f"wards {wards} not in district {lm.get('district')}"))
            if d > TOLERANCE_M:
                problems.append((lm["id"], f"{d:.0f} m from the cited reference point"))
            elif args.fix:
                lm["tags"] = [t for t in lm.get("tags", []) if not t.startswith("coords_")] + ["coords_verified_osm"]
            print(f"{lm['id']:<28}{d:>7.0f} m  manual         {ov['source']}")
            continue
        if not cands:
            problems.append((lm["id"], "no OSM/Overture feature with this name within 2.5 km"))
            refs[lm["id"]] = {"name": lm["name"]["vi"], "match": None}
            continue
        # OSM-derived layers first: places mix in Meta/Microsoft POIs whose pins are often a block off.
        cands.sort(key=lambda c: (c[0], c[4] == "place", c[1], c[2]))
        _, _, d, f, layer = cands[0]
        geom = f["geom"]
        if lm["kind"] in ("street", "bridge", "lake", "park"):
            # A long street or bridge is split into many OSM ways: merge the namesakes nearby.
            same = [c[3]["geom"] for c in cands if c[3]["name"] == f["name"] and c[3]["layer"] == f["layer"] and c[2] < d + 1500]
            geom = unary_union(same)
            d = geom.distance(pt)
        if d > TOLERANCE_M and args.fix:
            # Long features (streets, bridges, a 4 km ceramic wall): the nearest point on them, not their middle.
            if geom.geom_type in ("Point", "MultiPoint", "LineString", "MultiLineString") or lm["kind"] in ("street", "bridge"):
                target = nearest_points(geom, pt)[0]
            else:
                target = geom.centroid if geom.contains(geom.centroid) else geom.representative_point()
            nlat, nlon = to_ll(target)
            moved.append((lm["id"], round(d), (lat, lon), (nlat, nlon), f["name"]))
            lm["location"] = {"lat": nlat, "lon": nlon}
            lat, lon = nlat, nlon
            pt = Point(*fwd.transform(lon, lat))
            d = geom.distance(pt)
        if geom.is_empty:
            raise SystemExit(f"{lm['id']}: matched an empty geometry {f['id']}")
        ref_pt = pt if d < 0.5 else nearest_points(geom, pt)[0]
        wards, district_ok = wards_of(lm, pt)
        note = (ov or {}).get("district_note")
        refs[lm["id"]] = {
            "name": lm["name"]["vi"],
            "match": f["name"], "layer": f["layer"], "class": f["cls"], "overture_id": f["id"],
            "osm": osm_ref(f["sources"]),
            "ref_point": dict(zip(("lat", "lon"), to_ll(ref_pt))),
            "offset_m": round(d, 1),
            "wards_2025": wards,
            "district_ok": district_ok,
        }
        if note:
            refs[lm["id"]]["district_note"] = note
        if d > TOLERANCE_M:
            problems.append((lm["id"], f"{d:.0f} m from '{f['name']}' ({f['layer']})"))
        if district_ok is False and not note:
            problems.append((lm["id"], f"wards {wards} not in district {lm.get('district')}"))
        tags = [t for t in lm.get("tags", []) if t not in ("coords_unverified", "coords_verified_overture", "coords_verified_osm")]
        if args.fix:
            lm["tags"] = tags + ["coords_verified_osm"] if d <= TOLERANCE_M else lm.get("tags", [])
        print(f"{lm['id']:<28}{d:>7.0f} m  {f['layer']:<14} {f['name']}  {refs[lm['id']]['osm'] or ''}  {', '.join(wards)}")

    for p in problems:
        print("PROBLEM", *p)
    for m in moved:
        print("MOVED", m)
    if args.fix:
        LANDMARKS.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        REFERENCE.parent.mkdir(parents=True, exist_ok=True)
        REFERENCE.write_text(json.dumps({
            "_comment": "Written by tools/landmark_audit.py audit --fix. Reference point of each landmark on its OpenStreetMap feature (via Overture). tests/test_landmark_coords.py checks landmarks.json against it.",
            "source": f"Overture Maps {meta['overture_release']} (OpenStreetMap ODbL for water, land use, infrastructure, transportation, buildings)",
            "tolerance_m": TOLERANCE_M,
            "overrides": overrides,
            "landmarks": refs,
        }, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return 1 if problems and not args.fix else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("fetch")
    a = sub.add_parser("audit")
    a.add_argument("--fix", action="store_true")
    args = ap.parse_args()
    return {"fetch": fetch, "audit": audit}[args.cmd](args) or 0


if __name__ == "__main__":
    sys.exit(main())
