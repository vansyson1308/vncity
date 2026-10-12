"""Scatter the street life that makes a Hanoi street read as Hanoi, as PCG point sets.

Writes out/<name>/pcg/<set>.csv (format: docs/pipeline-outputs.md). Every point is derived
from real data (a building's street edge, a real shop, a real road, a real traffic light) and
then varied with a stable per-row seed, so a rebuild gives identical output.

Sets:
  shop_signs        one sign per shopfront edge, family taken from the real shop behind it
                    (vertical signs on narrow Old Quarter fronts); Scale = sign width / 4 m
  awnings           canvas awnings over shopfronts
  parked_motorbikes nose-in rows on the pavement in front of shops
  pavement_seating  plastic stools + low tables in front of real eateries, cafés, bia hơi
  street_vendors    gánh hàng rong, xe đẩy, xe đạp bán hoa near busy corners
  street_trees      sấu, xà cừ, hoa sữa, bàng… along real streets; lakeside liễu / lộc vừng
  power_poles       concrete poles along streets that still have overhead cables
  cable_spans       one row per span between consecutive poles; Scale = span length (m)
  street_lights     along arterials
  infrastructure    real street furniture from Overture: traffic lights, bus stops, ATMs…

Usage:
  python -m pipeline.scatter --name hoankiem
"""

import argparse
import csv
import hashlib
import json
import math
import pathlib
from collections import Counter, defaultdict

import duckdb
import numpy as np
import shapely
from shapely import wkb
from shapely.geometry import LineString, Point
from shapely.strtree import STRtree

from build import local_projection, polygons, project
from fetch import load_extensions

HEADER = ["Name", "X", "Y", "Z", "Yaw", "Scale", "Set", "Kind", "Variant", "Seed", "Tile", "Ref"]

SIGN_FAMILY = {
    "food": {"restaurant", "casual_eatery", "fast_food_restaurant", "food_and_drink", "bakery",
             "dessert_shop", "noodle_restaurant"},
    "cafe": {"coffee_shop", "cafe", "non_alcoholic_beverage_venue", "tea_room", "juice_bar"},
    "bar": {"bar", "pub", "brewery", "beer_garden", "nightclub", "music_venue"},
    "lodging": {"hotel", "lodging", "hostel", "guest_house", "motel"},
    "fashion": {"fashion_and_apparel_store", "shoe_store", "jewelry_store", "accessories_store"},
    "beauty": {"personal_or_beauty_service", "wellness_service", "personal_care_and_beauty_store",
               "spa", "hair_salon", "massage"},
    "travel": {"travel_service", "tour_operator"},
    "grocery": {"food_and_beverage_store", "convenience_store", "grocery_store", "supermarket", "shopping"},
    "pharmacy": {"pharmacy_and_drug_store", "hospital", "clinic", "medical_service"},
    "finance": {"bank_or_credit_union", "financial_service", "atm"},
    "crafts": {"arts_crafts_and_hobby_store", "art_gallery", "flowers_and_gifts_store", "souvenir_shop"},
    "hardware": {"hardware_home_and_garden_store", "electronics_store", "home_service",
                 "building_or_construction_service", "manufacturer", "automotive_service"},
}
FAMILY_OF = {c: f for f, cats in SIGN_FAMILY.items() for c in cats}
SEATING = {"food": "pho_quan", "cafe": "tra_da", "bar": "bia_hoi"}
SHOP_ARCHETYPES = {"nha_ong_pho_co", "nha_ong_hien_dai", "lien_ke_kdt", "nha_thap_tang", "khu_tap_the"}
SHOP_CHANCE = {"primary": 0.9, "secondary": 0.9, "tertiary": 0.85, "residential": 0.6,
               "unclassified": 0.5, "living_street": 0.4, "service": 0.25, "pedestrian": 0.8}
# Famous street trees; everything else draws from the common urban mix.
STREET_TREE = {"Phan Đình Phùng": "sau", "Hoàng Diệu": "sau", "Điện Biên Phủ": "sau",
               "Nguyễn Du": "hoa_sua", "Quang Trung": "xa_cu", "Lê Duẩn": "xa_cu",
               "Đinh Tiên Hoàng": "loc_vung", "Lê Thái Tổ": "loc_vung", "Tràng Tiền": "sao_den",
               "Hai Bà Trưng": "sao_den", "Thanh Niên": "bang_lang", "Lý Thường Kiệt": "sau"}
TREE_MIX = [("xa_cu", 0.3), ("sau", 0.2), ("bang", 0.15), ("hoa_sua", 0.15), ("sao_den", 0.1),
            ("phuong_vi", 0.1)]
TREE_CLASSES = {"primary", "secondary", "tertiary", "trunk"}
POLE_CLASSES = {"tertiary", "residential", "service", "unclassified", "secondary"}
LIGHT_CLASSES = {"primary", "secondary", "tertiary", "trunk"}


def seed_of(*parts):
    return int.from_bytes(hashlib.blake2b(":".join(map(str, parts)).encode(), digest_size=4).digest(), "little")


class Rng:
    """Per-key deterministic RNG."""

    def __init__(self, *key):
        self.r = np.random.default_rng(seed_of(*key))

    def __getattr__(self, k):
        return getattr(self.r, k)


class Writer:
    def __init__(self, out, tile):
        self.out, self.tile, self.rows = out, tile, defaultdict(list)

    def add(self, set_, kind, x, y, z, yaw, scale=1.0, variant=0, ref="", key=None):
        rows = self.rows[set_]
        tile = f"{math.floor(x / self.tile)}_{math.floor(y / self.tile)}"
        rows.append([f"{set_}_{len(rows)}", round(x, 2), round(y, 2), round(z, 2), round(yaw % 360, 1),
                     round(scale, 3), set_, kind, int(variant), seed_of(set_, key or (x, y)), tile, ref or ""])

    def save(self):
        self.out.mkdir(parents=True, exist_ok=True)
        for set_, rows in self.rows.items():
            with open(self.out / f"{set_}.csv", "w", newline="", encoding="utf-8") as f:
                w = csv.writer(f)
                w.writerow(HEADER)
                w.writerows(rows)
        return {k: len(v) for k, v in sorted(self.rows.items())}


class Blockers:
    """Building outlines; scattered props must not land inside a building."""

    def __init__(self, outlines):
        self.geoms = outlines
        self.tree = STRtree(outlines) if outlines else None

    def free(self, x, y, clearance=0.3):
        if self.tree is None:
            return True
        p = Point(x, y)
        return len(self.tree.query(p.buffer(clearance), predicate="intersects")) == 0


def edge_frame(f):
    a, b = np.array(f["a"]), np.array(f["b"])
    d = (b - a) / max(f["length_m"], 1e-6)
    yaw = math.radians(f["facing_deg"])
    return a, b, d, np.array([math.cos(yaw), math.sin(yaw)])


def shopfronts(fp, places, w, blockers):
    for bld in fp["buildings"]:
        if bld["archetype"] not in SHOP_ARCHETYPES or not bld["frontage"]:
            continue
        pois = [places[p] for p in bld["pois"] if p in places]
        fams = [FAMILY_OF.get(p["basic_category"]) for p in pois]
        fams = [f for f in fams if f]
        main = max(bld["frontage"], key=lambda f: f["length_m"])
        rng = Rng("shop", bld["id"])
        if not fams and rng.random() > SHOP_CHANCE.get(main["road_class"], 0.3):
            continue
        family = Counter(fams).most_common(1)[0][0] if fams else rng.choice(list(SIGN_FAMILY))
        ref = pois[0]["id"] if pois else bld["id"]
        a, b, d, n = edge_frame(main)
        mid = (a + b) / 2
        width = min(main["length_m"] * 0.9, 8.0)
        vertical = bld["archetype"] == "nha_ong_pho_co" and main["length_m"] < 5.5
        x, y = mid + n * 0.25
        w.add("shop_signs", f"{family}_vertical" if vertical else family, x, y,
              3.4 if not vertical else 4.5, main["facing_deg"], width / 4.0, rng.integers(0, 8), ref, bld["id"])
        if rng.random() < 0.6:
            x, y = mid + n * 0.9
            w.add("awnings", "canvas", x, y, 2.6, main["facing_deg"], width / 4.0, rng.integers(0, 6), bld["id"],
                  bld["id"])
        # Nose-in motorbikes on the pavement, ~0.8 m apart.
        count = int(main["length_m"] / 0.8 * rng.uniform(0.3, 0.9))
        for i in range(count):
            t = (i + 0.5) / max(count, 1)
            off = rng.uniform(1.3, 2.0)
            x, y = a + d * main["length_m"] * t + n * off
            if blockers.free(x, y):
                kind = rng.choice(["scooter", "scooter", "manual", "manual", "electric"])
                w.add("parked_motorbikes", kind, x, y, 0.0, main["facing_deg"] + 180 + rng.normal(0, 8),
                      1.0, rng.integers(0, 12), bld["id"], (bld["id"], i))
        if family in SEATING and rng.random() < 0.8:
            for i in range(int(rng.integers(1, 5))):
                t = rng.uniform(0.1, 0.9)
                x, y = a + d * main["length_m"] * t + n * rng.uniform(1.5, 3.2)
                if blockers.free(x, y, 0.5):
                    w.add("pavement_seating", SEATING[family], x, y, 0.0, rng.uniform(0, 360), 1.0,
                          rng.integers(0, 4), ref, (bld["id"], "seat", i))


def tree_species(street):
    """One species per street (Hanoi streets are planted uniformly), stable by street name."""
    kinds, weights = zip(*TREE_MIX)
    u = seed_of("species", street) % 10000 / 10000
    return kinds[min(int(np.searchsorted(np.cumsum(weights), u, side="right")), len(kinds) - 1)]


def along(polyline, spacing, offset, phase=0.0):
    """Points every `spacing` m along a polyline, offset sideways (+left, -right); yields x, y, heading."""
    line = LineString(polyline)
    if line.length < spacing * 0.5:
        return
    s = phase % spacing
    while s < line.length:
        p0, p1 = line.interpolate(max(0, s - 0.5)), line.interpolate(min(line.length, s + 0.5))
        dx, dy = p1.x - p0.x, p1.y - p0.y
        L = math.hypot(dx, dy) or 1.0
        p = line.interpolate(s)
        yield p.x - dy / L * offset, p.y + dx / L * offset, math.degrees(math.atan2(dy, dx))
        s += spacing


def streets(graph, zones, w, blockers):
    poles_by_edge = []
    for e in graph["edges"]:
        cls, half = e["class"], e["width_m"] / 2
        rng = Rng("street", e["id"])
        name = e.get("name") or ""
        if cls in TREE_CLASSES and e["width_m"] >= 9:
            species = STREET_TREE.get(name) or tree_species(name or e["road_id"])
            for side in (1, -1):
                for x, y, hd in along(e["polyline"], rng.uniform(9, 14), side * (half + 1.8), rng.uniform(0, 10)):
                    if blockers.free(x, y, 1.2):
                        w.add("street_trees", species, x, y, 0.0, rng.uniform(0, 360), rng.uniform(0.8, 1.25),
                              rng.integers(0, 5), e["road_id"], (e["id"], side, round(x), round(y)))
        if cls in LIGHT_CLASSES:
            sides = (1, -1) if e["width_m"] >= 12 else (1,)
            for side in sides:
                for x, y, hd in along(e["polyline"], 30, side * (half + 0.5), 15):
                    if blockers.free(x, y, 0.4):
                        w.add("street_lights", "boulevard" if e["width_m"] >= 12 else "single", x, y, 0.0,
                              hd + (90 if side > 0 else -90) + 180, 1.0, 0, e["road_id"], (e["id"], side, x, y))
        if cls in POLE_CLASSES:
            side = 1 if seed_of("pole_side", e["road_id"]) % 2 else -1
            prev = None
            density = 3 if zones.get(e["id"]) == "old_quarter" else int(rng.integers(0, 3))
            for x, y, hd in along(e["polyline"], rng.uniform(28, 38), side * (half + 0.6), 5):
                if not blockers.free(x, y, 0.3):
                    continue
                w.add("power_poles", "concrete_h" if rng.random() < 0.7 else "concrete_round", x, y, 0.0,
                      hd, 1.0, density, e["road_id"], (e["id"], x, y))
                if prev is not None:
                    span = math.dist(prev, (x, y))
                    if span < 60:
                        mx, my = (prev[0] + x) / 2, (prev[1] + y) / 2
                        yaw = math.degrees(math.atan2(y - prev[1], x - prev[0]))
                        w.add("cable_spans", f"bundle_{density}", mx, my, 7.0, yaw, span, density,
                              e["road_id"], (e["id"], mx, my))
                prev = (x, y)
            poles_by_edge.append(e["id"])
    return poles_by_edge


def vendors(graph, places, w, blockers, zone_of):
    """Street vendors gather at busy corners (nodes with 3+ edges) and outside markets/schools."""
    degree = Counter()
    for e in graph["edges"]:
        degree[e["from"]] += 1
        degree[e["to"]] += 1
    nodes = graph["nodes"]
    for nid, deg in degree.items():
        if deg < 3:
            continue
        nd = nodes[nid]
        rng = Rng("vendor", nid)
        zone = zone_of(nd["x"], nd["y"])
        if rng.random() > (0.55 if zone else 0.25):
            continue
        ang = rng.uniform(0, 2 * math.pi)
        x, y = nd["x"] + math.cos(ang) * rng.uniform(6, 10), nd["y"] + math.sin(ang) * rng.uniform(6, 10)
        if blockers.free(x, y, 0.6):
            kind = rng.choice(["ganh_hang", "xe_day_banh_mi", "xe_dap_hoa", "xe_day_hoa_qua", "tra_da_via_he"],
                              p=[0.3, 0.2, 0.15, 0.2, 0.15])
            w.add("street_vendors", kind, x, y, 0.0, rng.uniform(0, 360), 1.0, rng.integers(0, 6), "", ("v", nid))


def lakeshores(src, tf, w, blockers):
    con = duckdb.connect()
    load_extensions(con, "spatial")
    rows = con.sql(f"SELECT id, name, wkb FROM '{src / 'water.parquet'}' "
                   f"WHERE subtype IN ('lake', 'pond', 'reservoir') OR class IN ('lake', 'pond')").fetchall()
    for wid, name, g in rows:
        for poly in polygons(project(wkb.loads(bytes(g)), tf)):
            if poly.area < 20000:
                continue
            inland = poly.exterior.buffer(4.0).difference(poly).exterior if poly.is_valid else None
            if inland is None or inland.is_empty:
                continue
            ring = LineString(inland.coords)
            rng = Rng("lake", wid)
            s = 0.0
            while s < ring.length:
                p = ring.interpolate(s)
                if blockers.free(p.x, p.y, 1.0):
                    kind = rng.choice(["liu", "loc_vung", "so", "bang"], p=[0.4, 0.3, 0.15, 0.15])
                    w.add("street_trees", kind, p.x, p.y, 0.0, rng.uniform(0, 360), rng.uniform(0.8, 1.3),
                          rng.integers(0, 5), wid, (wid, round(s)))
                s += rng.uniform(7, 11)


def infrastructure(src, tf, w):
    con = duckdb.connect()
    load_extensions(con, "spatial")
    rows = con.sql(f"""SELECT id, class, wkb FROM '{src / 'infrastructure.parquet'}'
                       WHERE ST_GeometryType(ST_GeomFromWKB(wkb)) = 'POINT'""").fetchall()
    for iid, cls, g in rows:
        p = project(wkb.loads(bytes(g)), tf)
        w.add("infrastructure", cls or "unknown", p.x, p.y, 0.0, 0.0, 1.0, 0, iid, iid)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--data", default="data")
    ap.add_argument("--out", default="out")
    ap.add_argument("--tile", type=float, default=500.0)
    ap.add_argument("--origin")
    a = ap.parse_args()
    src = pathlib.Path(a.data) / a.name
    out = pathlib.Path(a.out) / a.name
    fetched = json.loads((src / "fetch.json").read_text())
    ws, s, e, n = fetched["bbox"]
    lat0, lon0 = (map(float, a.origin.split(",")) if a.origin else ((s + n) / 2, (ws + e) / 2))
    _, _, tf = local_projection(lat0, lon0)

    places = {p["id"]: p for p in json.loads((out / "places" / "pois.json").read_text())["places"]}
    graph = json.loads((out / "traffic" / "graph.json").read_text())
    fps = [json.loads(p.read_text()) for p in sorted((out / "semantics").glob("footprints_*.json"))]
    outlines = [shapely.Polygon(b["outline"]) for fp in fps for b in fp["buildings"] if len(b["outline"]) >= 3]
    blockers = Blockers(outlines)

    from pipeline.semantics import ZONES
    zone_polys = {k: project(shapely.Polygon(v), tf) for k, v in ZONES.items()}

    def zone_of(x, y):
        pt = Point(x, y)
        return next((k for k, z in zone_polys.items() if z.contains(pt)), None)

    edge_zone = {ed["id"]: zone_of(*ed["polyline"][len(ed["polyline"]) // 2]) for ed in graph["edges"]}

    w = Writer(out / "pcg", a.tile)
    for fp in fps:
        shopfronts(fp, places, w, blockers)
    streets(graph, edge_zone, w, blockers)
    vendors(graph, places, w, blockers, zone_of)
    if (src / "water.parquet").exists():
        lakeshores(src, tf, w, blockers)
    if (src / "infrastructure.parquet").exists():
        infrastructure(src, tf, w)
    counts = w.save()
    (out / "pcg" / "summary.json").write_text(json.dumps(counts, indent=1))
    print(json.dumps(counts, indent=1))


if __name__ == "__main__":
    main()
