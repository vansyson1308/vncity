"""Classify every building into a Hanoi archetype and find the edges that face the street.

This is what turns grey boxes into Hanoi: a 4 m wide, 4 storey tube house in the Old Quarter
gets the `nha_ong_pho_co` facade kit with a shopfront on its street edge, a long 5 storey block
in Kim Liên becomes a `khu_tap_the` with caged balconies, an ochre villa in the French quarter a
`biet_thu_phap`.

Inputs  data/<name>/{buildings,roads,places,divisions}.parquet (fetch.py + pipeline.fetch_context)
Outputs data/<name>/semantics.parquet        id → archetype, floors, height, district (read by build.py)
        out/<name>/semantics/footprints_X_Y.json   see docs/pipeline-outputs.md
        out/<name>/places/pois.json         named places with category and host building
        out/<name>/districts.geojson        ward polygons (WGS84) with the game district they map to

Archetype ids are those of game/content/world/building_archetypes.json. The rules below are
deliberately explicit so they can be tuned against a photo survey; every decision is recorded in
`archetype_rule` so a wrong call can be traced.

Usage:
  python -m pipeline.semantics --name hoankiem [--origin lat,lon] [--tile 500]
"""

import argparse
import hashlib
import json
import math
import multiprocessing as mp
import pathlib
import re
from collections import Counter

import duckdb
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import shapely
from shapely import wkb
from shapely.geometry import LineString, Point, box
from shapely.strtree import STRtree

from build import FLOOR_M, ROAD_WIDTH, local_projection, polygons, project, tile_index
from fetch import load_extensions

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTENT = ROOT / "game" / "content"

# Hand-drawn zones (WGS84 lon/lat rings). Approximate on purpose: they bias the classifier,
# they are not cadastral boundaries. Refine against the photo survey.
ZONES = {
    # 36 phố phường: Hàng Đậu / Phùng Hưng / Hàng Bông-Hàng Gai / Cầu Gỗ / Trần Nhật Duật.
    "old_quarter": [(105.8458, 21.0393), (105.8530, 21.0398), (105.8553, 21.0372), (105.8547, 21.0331),
                    (105.8522, 21.0318), (105.8478, 21.0306), (105.8445, 21.0318), (105.8452, 21.0365)],
    # Khu phố Pháp: south and east of Hoàn Kiếm lake, Tràng Tiền to Lê Duẩn.
    "french_quarter": [(105.8430, 21.0265), (105.8560, 21.0270), (105.8600, 21.0240), (105.8560, 21.0130),
                       (105.8440, 21.0130), (105.8410, 21.0200)],
    # Ba Đình villa district: Điện Biên Phủ, Phan Đình Phùng, Hoàng Diệu, Chu Văn An.
    "ba_dinh_villas": [(105.8300, 21.0420), (105.8445, 21.0420), (105.8450, 21.0300), (105.8400, 21.0270),
                       (105.8300, 21.0285)],
}
CORE_ZONES = ("old_quarter", "french_quarter", "ba_dinh_villas")

RELIGIOUS = re.compile(r"\b(chùa|đền|đình|miếu|nhà thờ|thánh đường|phủ|quán|từ đường|nghè|am)\b", re.I)
MARKET = re.compile(r"\bchợ\b", re.I)
WORKS = re.compile(r"\b(xí nghiệp|nhà máy|kho|xưởng|công ty cơ khí|depot|toa xe|đầu máy)\b", re.I)
COLLECTIVE = re.compile(r"\b(khu tập thể|tập thể|ktt|nhà [a-z]\d|^[a-z]\d{1,2}$)", re.I)
PUBLIC_CLASSES = {"school", "university", "college", "kindergarten", "hospital", "government", "civic",
                  "library", "post_office", "train_station", "public", "museum", "fire_station",
                  "police", "townhall", "sports_hall", "stadium", "sports_centre", "theatre"}
RELIGIOUS_CLASSES = {"church", "temple", "shrine", "mosque", "chapel", "cathedral", "religious", "monastery"}
WORKS_CLASSES = {"industrial", "warehouse", "garages", "garage", "manufacture", "factory", "hangar"}
HIGH_RES_CLASSES = {"apartments", "residential", None}
OFFICE_CLASSES = {"office", "commercial", "hotel", "retail"}

# Typical storeys per archetype when nothing is known: (min, max). Heights are floors × FLOOR_M
# (ground floors of shophouses are taller; the kit handles that, the massing stays simple).
ARCHETYPE_FLOORS = {
    "nha_ong_pho_co": (2, 4), "nha_ong_hien_dai": (4, 6), "biet_thu_phap": (2, 3),
    "cong_trinh_phap_cong": (2, 4), "khu_tap_the": (4, 5), "chung_cu_cao_tang": (15, 30),
    "van_phong_cao_tang": (12, 25), "lien_ke_kdt": (4, 5), "dinh_chua": (1, 2), "cho": (1, 3),
    "cong_trinh_cong_cong": (3, 6), "nha_xuong": (1, 2), "nha_thap_tang": (1, 2),
}
# Pre-2000 inner city: no new-urban-area (KĐT) terraces here.
INNER_DISTRICTS = {"pho_co", "hoan_kiem", "ba_dinh", "dong_da", "hai_ba_trung", "tay_ho"}
SHOPFRONT_ARCHETYPES = {"nha_ong_pho_co", "nha_ong_hien_dai", "lien_ke_kdt", "nha_thap_tang", "khu_tap_the"}
FRONTAGE_REACH_M = 12.0
NOT_FRONTAGE = {"steps", "path", "cycleway", "track", "bridleway"}  # an edge "faces" a road whose kerb is within this distance
W = {}


def stable_rand(key, salt=""):
    """Deterministic uniform [0,1) from a string, so reruns and diffs are stable."""
    h = hashlib.blake2b(f"{salt}:{key}".encode(), digest_size=8).digest()
    return int.from_bytes(h, "little") / 2**64


def shape_metrics(poly):
    """Rectangularity, elongation and short side of the minimum rotated rectangle."""
    mrr = poly.minimum_rotated_rectangle
    xy = np.asarray(mrr.exterior.coords)[:4]
    sides = np.hypot(*(np.roll(xy, -1, 0) - xy).T)
    short, long_ = float(sides.min()), float(sides.max())
    rect = poly.area / mrr.area if mrr.area > 0 else 0.0
    return rect, (long_ / short if short > 0 else 1.0), short


def classify(b, zone):
    """Return (archetype, rule) for one building dict."""
    name, cls = (b["name"] or ""), b["class"]
    floors = b["floors"]
    area, rect, elong, short = b["area_m2"], b["rect"], b["elong"], b["short_m"]
    tall = (b["height_obs"] or 0) >= 40 or (floors or 0) >= 12

    if cls in RELIGIOUS_CLASSES or RELIGIOUS.search(name):
        return "dinh_chua", "religious name/class"
    if MARKET.search(name) and area > 300:
        return "cho", "market name"
    if cls in WORKS_CLASSES or WORKS.search(name):
        return "nha_xuong", "industrial name/class"
    if tall:
        if cls in OFFICE_CLASSES or (name and not COLLECTIVE.search(name)):
            return "van_phong_cao_tang", "tall office/hotel/named tower"
        return "chung_cu_cao_tang", "tall residential"
    if cls in PUBLIC_CLASSES:
        if zone in CORE_ZONES and area > 400:
            return "cong_trinh_phap_cong", f"public building in {zone}"
        return "cong_trinh_cong_cong", "public class"
    if COLLECTIVE.search(name) or (cls in HIGH_RES_CLASSES and 300 <= area <= 2500 and elong >= 2.5
                                   and rect > 0.75 and zone not in ("old_quarter",)):
        return "khu_tap_the", "long slab block (collective housing)"
    if area < 12 or (area < 25 and zone != "old_quarter" and elong < 2.0):
        return "nha_thap_tang", "kiosk/shed size"
    if zone == "old_quarter" and area < 400:
        return "nha_ong_pho_co", "small plot in Old Quarter"
    if zone in ("french_quarter", "ba_dinh_villas") and 120 <= area <= 700 and elong < 2.5:
        return "biet_thu_phap", f"detached mid-size plot in {zone}"
    if zone in CORE_ZONES and area > 700:
        return "cong_trinh_phap_cong", f"large plot in {zone}"
    if area <= 200 and (short <= 7.5 or elong >= 2.0):
        if zone is None and b["district"] not in INNER_DISTRICTS and rect > 0.92 and 60 <= area <= 140 and b["row_neighbours"] >= 4:
            return "lien_ke_kdt", "regular row of identical plots"
        return "nha_ong_hien_dai", "narrow plot (tube house)"
    if area <= 400:
        return "nha_ong_hien_dai", "small plot"
    if area > 2500:
        return "cong_trinh_cong_cong", "very large plot"
    return "nha_thap_tang", "fallback"


def resolve_floors(b, archetype):
    if b["height_obs"] and b["height_obs"] > 0:
        return max(1, round(b["height_obs"] / FLOOR_M)), float(b["height_obs"]), "observed"
    if b["floors"] and b["floors"] > 0:
        return int(b["floors"]), b["floors"] * FLOOR_M, "derived_floors"
    lo, hi = ARCHETYPE_FLOORS[archetype]
    f = lo + int(stable_rand(b["id"], "floors") * (hi - lo + 1))
    return f, f * FLOOR_M, "estimated_archetype"


def load_districts():
    """Game districts (id, centre, ward names) from content, if the content exists yet."""
    p = CONTENT / "world" / "districts.json"
    if not p.exists():
        return []
    items = json.loads(p.read_text(encoding="utf-8"))["items"]
    return [{"id": d["id"], "lat": d["center"]["lat"], "lon": d["center"]["lon"],
             "wards": set(d.get("overture_division_names", []))} for d in items]


def district_for(ward, lon, lat, districts):
    for d in districts:
        if ward and ward in d["wards"]:
            return d["id"]
    if not districts:
        return None
    k = math.cos(math.radians(lat))
    return min(districts, key=lambda d: ((d["lon"] - lon) * k) ** 2 + (d["lat"] - lat) ** 2)["id"]


def init_worker(cfg):
    W.update(cfg)
    _, _, W["tf"] = local_projection(cfg["lat0"], cfg["lon0"])
    W["con"] = duckdb.connect(config={"threads": 1, "memory_limit": "1GB"})
    W["zones"] = {k: project(shapely.Polygon(v), W["tf"]) for k, v in ZONES.items()}
    wards = cfg["wards"]
    W["ward_geoms"] = [project(wkb.loads(g), W["tf"]) for _, g in wards]
    W["ward_names"] = [n for n, _ in wards]
    W["ward_tree"] = STRtree(W["ward_geoms"]) if wards else None
    W["districts"] = load_districts()


def zone_of(pt):
    for k, z in W["zones"].items():
        if z.contains(pt):
            return k
    return None


def ward_of(pt):
    if W["ward_tree"] is None:
        return None
    for i in W["ward_tree"].query(pt, predicate="within"):
        return W["ward_names"][i]
    return None


def query_tile(table, cols, ix, iy, ring=0):
    return W["con"].execute(
        f"SELECT {', '.join(cols)} FROM '{W['work'] / table}' "
        f"WHERE ix BETWEEN ? AND ? AND iy BETWEEN ? AND ?",
        [ix - ring, ix + ring, iy - ring, iy + ring]).fetchall()


def road_width(cls, width_rules):
    for r in width_rules or []:
        if r.get("value"):
            return float(r["value"])
    return float(ROAD_WIDTH.get(cls or "unknown", ROAD_WIDTH["unknown"]))


def frontage(poly, roads, road_tree, self_idx=None, geoms=None, btree=None):
    """Outline edges that look onto a road kerb within FRONTAGE_REACH_M.

    An edge qualifies when the nearest road lies in front of it (within 60° of its outward
    normal) and no other building stands between the edge and that road, so party walls
    between tube houses and back walls deep inside a block are not shopfronts.
    """
    ring = shapely.orient_polygons(poly).exterior  # CCW: outward normal is to the right of travel
    xy = np.asarray(ring.coords)
    out = []
    for a, b in zip(xy[:-1], xy[1:]):
        d = b - a
        length = float(np.hypot(*d))
        if length < 2.0:
            continue
        n = np.array([d[1], -d[0]]) / length  # right-hand normal = outward for CCW
        mid = (a + b) / 2
        probe = LineString([mid + n * 0.5, mid + n * FRONTAGE_REACH_M]).buffer(length / 2, cap_style="flat")
        best = None
        for i in road_tree.query(probe):
            line, cls, name, half = roads[i]
            if cls in NOT_FRONTAGE:
                continue
            q = line.interpolate(line.project(Point(mid)))
            v = np.array([q.x, q.y]) - mid
            dist = float(np.hypot(*v))
            if dist - half > FRONTAGE_REACH_M or dist < 1e-6 or float(np.dot(n, v / dist)) < 0.5:
                continue
            if btree is not None:
                sight = LineString([mid + n * 0.3, (q.x, q.y)])
                if any(j != self_idx and geoms[j].intersection(sight).length > 0.3
                       for j in btree.query(sight)):
                    continue
            if best is None or dist < best[0]:
                best = (dist, cls, name)
        if best:
            out.append({"a": [round(float(a[0]), 2), round(float(a[1]), 2)],
                        "b": [round(float(b[0]), 2), round(float(b[1]), 2)],
                        "length_m": round(length, 2), "road_class": best[1], "road_name": best[2],
                        "facing_deg": round(math.degrees(math.atan2(n[1], n[0])) % 360, 1)})
    return out


def row_neighbours(poly, idx, geoms, tree):
    """How many similar-sized, similarly oriented plots sit within 15 m (terraced rows)."""
    def angle(p):
        xy = np.asarray(p.minimum_rotated_rectangle.exterior.coords)[:2]
        return math.degrees(math.atan2(*(xy[1] - xy[0])[::-1])) % 90
    a0, ar = angle(poly), poly.area
    n = 0
    for j in tree.query(poly.buffer(15)):
        if j == idx:
            continue
        g = geoms[j]
        if 0.75 < g.area / ar < 1.33 and min(abs(angle(g) - a0), 90 - abs(angle(g) - a0)) < 6:
            n += 1
    return n


def process_tile(key):
    ix, iy = key
    size, tf = W["tile"], W["tf"]
    rows = query_tile("buildings.parquet",
                      ["id", "name", "class", "height", "num_floors", "min_height", "is_underground", "wkb"],
                      ix, iy)
    bld = []
    for r in rows:
        bid, name, cls, h, nf, mh, under, g = r
        if under:
            continue
        geom_wgs = wkb.loads(bytes(g))
        polys = polygons(project(geom_wgs, tf))
        if not polys:
            continue
        poly = max(polys, key=lambda p: p.area)
        bld.append({"id": bid, "name": name, "class": cls, "height_obs": h, "floors": nf,
                    "base_m": float(mh or 0.0), "poly": poly, "wgs": geom_wgs.centroid})

    roads = []
    for cls, name, wr, g in query_tile("roads.parquet", ["class", "name", "width_rules", "wkb"], ix, iy, 1):
        line = project(wkb.loads(bytes(g)), tf)
        roads.append((line, cls, name, road_width(cls, wr) / 2))
    road_tree = STRtree([r[0] for r in roads]) if roads else None

    geoms = [b["poly"] for b in bld]
    btree = STRtree(geoms) if geoms else None
    place_rows = query_tile("places.parquet", ["id", "name", "category", "basic_category", "x", "y"], ix, iy)
    pois_by_building = {}
    pois = []
    for pid, pname, cat, basic, x, y in place_rows:
        pt = Point(x, y)
        host = None
        if btree is not None:
            hits = btree.query(pt, predicate="within")
            if len(hits) == 0:
                near = btree.query_nearest(pt, max_distance=8.0)
                hits = near[:1]
            if len(hits):
                host = bld[int(hits[0])]["id"]
                pois_by_building.setdefault(host, []).append(pid)
        pois.append({"id": pid, "name": pname, "category": cat, "basic_category": basic,
                     "x": round(x, 2), "y": round(y, 2), "building": host})

    out_rows, footprints, stats = [], [], Counter()
    for i, b in enumerate(bld):
        poly = b["poly"]
        c = poly.centroid
        rect, elong, short = shape_metrics(poly)
        b.update(area_m2=round(poly.area, 1), rect=rect, elong=elong, short_m=short,
                 row_neighbours=row_neighbours(poly, i, geoms, btree) if poly.area < 160 else 0)
        zone = zone_of(c)
        ward = ward_of(c)
        district = district_for(ward, b["wgs"].x, b["wgs"].y, W["districts"])
        b["district"] = district
        archetype, rule = classify(b, zone)
        floors, height, hsrc = resolve_floors(b, archetype)
        front = frontage(poly, roads, road_tree, i, geoms, btree) if road_tree is not None else []
        if archetype in SHOPFRONT_ARCHETYPES and not front:
            stats["no_frontage_shophouse"] += 1  # back-lot house reached through a ngõ
        stats[archetype] += 1
        out_rows.append({"id": b["id"], "archetype": archetype, "archetype_rule": rule, "zone": zone,
                         "ward": ward, "district": district, "floors": floors,
                         "height_m": round(height, 2), "height_source": hsrc})
        footprints.append({
            "id": b["id"], "name": b["name"], "archetype": archetype, "district": district, "ward": ward,
            "base_m": b["base_m"], "height_m": round(height, 2), "floors": floors,
            "height_source": hsrc, "area_m2": b["area_m2"],
            "outline": [[round(float(x), 2), round(float(y), 2)]
                        for x, y in shapely.orient_polygons(poly).exterior.coords[:-1]],
            "frontage": front, "pois": pois_by_building.get(b["id"], [])})

    if footprints:
        (W["out"] / "semantics" / f"footprints_{ix}_{iy}.json").write_text(json.dumps(
            {"tile": [ix, iy], "origin_m": [ix * size, iy * size], "buildings": footprints},
            ensure_ascii=False))
    return out_rows, pois, stats


def tile_places(con, src, work, tf, size):
    p = src / "places.parquet"
    if not p.exists():
        con.sql(f"CREATE OR REPLACE TABLE e AS SELECT ''::VARCHAR id, ''::VARCHAR name, ''::VARCHAR category, "
                f"''::VARCHAR basic_category, 0.0 x, 0.0 y, 0 ix, 0 iy LIMIT 0")
        con.sql(f"COPY e TO '{work / 'places.parquet'}' (FORMAT parquet)")
        return 0
    t = con.sql(f"""SELECT id, name, category, basic_category,
                           ST_X(ST_GeomFromWKB(wkb)) lon, ST_Y(ST_GeomFromWKB(wkb)) lat
                    FROM '{p}'""").fetchnumpy()
    x, y = tf.transform(t["lon"], t["lat"])
    x, y = np.asarray(x), np.asarray(y)
    tbl = pa.table({"id": t["id"], "name": t["name"], "category": t["category"],
                    "basic_category": t["basic_category"], "x": x, "y": y,
                    "ix": np.floor(x / size).astype(np.int32), "iy": np.floor(y / size).astype(np.int32)})
    pq.write_table(tbl.sort_by([("ix", "ascending"), ("iy", "ascending")]), work / "places.parquet")
    return tbl.num_rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--data", default="data")
    ap.add_argument("--out", default="out")
    ap.add_argument("--tile", type=float, default=500.0)
    ap.add_argument("--origin", help="lat,lon of the world origin (default: bbox centre, as build.py)")
    ap.add_argument("--workers", type=int, default=mp.cpu_count())
    a = ap.parse_args()

    src = pathlib.Path(a.data) / a.name
    fetched = json.loads((src / "fetch.json").read_text())
    w, s, e, n = fetched["bbox"]
    lat0, lon0 = (map(float, a.origin.split(",")) if a.origin else ((s + n) / 2, (w + e) / 2))
    _, crs, tf = local_projection(lat0, lon0)
    out = pathlib.Path(a.out) / a.name
    work = out / "work"
    for d in (out / "semantics", out / "places", work):
        d.mkdir(parents=True, exist_ok=True)

    con = duckdb.connect(config={"memory_limit": "4GB"})
    load_extensions(con, "spatial")
    keys, nb, nr = tile_index(con, src, work, tf, a.tile)
    npl = tile_places(con, src, work, tf, a.tile)
    wards = []
    if (src / "divisions.parquet").exists():
        wards = [(nm, bytes(g)) for nm, g in con.sql(
            f"SELECT name, wkb FROM '{src / 'divisions.parquet'}' WHERE subtype IN ('locality','localadmin','county')"
        ).fetchall()]
    con.close()
    print(f"semantics: {nb:,} buildings, {nr:,} roads, {npl:,} places, {len(wards)} wards, {len(keys)} tiles",
          flush=True)

    cfg = {"lat0": lat0, "lon0": lon0, "work": work, "out": out, "tile": a.tile, "wards": wards}
    rows, pois, stats = [], [], Counter()
    with mp.Pool(a.workers, initializer=init_worker, initargs=(cfg,), maxtasksperchild=200) as pool:
        for r, p, st in pool.imap_unordered(process_tile, keys, chunksize=2):
            rows += r
            pois += p
            stats += st

    rows.sort(key=lambda r: r["id"])
    pq.write_table(pa.Table.from_pylist(rows), src / "semantics.parquet")
    pois.sort(key=lambda p: p["id"])
    (out / "places" / "pois.json").write_text(json.dumps({"places": pois}, ensure_ascii=False))

    districts = load_districts()
    feats = []
    for nm, g in wards:
        geom = wkb.loads(g)
        c = geom.representative_point()
        feats.append({"type": "Feature", "geometry": shapely.geometry.mapping(geom),
                      "properties": {"ward": nm, "district": district_for(nm, c.x, c.y, districts)}})
    (out / "districts.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats},
                                                      ensure_ascii=False))
    hs = Counter(r["height_source"] for r in rows)
    summary = {"buildings": len(rows), "archetypes": {k: v for k, v in stats.items() if k in ARCHETYPE_FLOORS},
               "shophouses_without_street_edge": stats["no_frontage_shophouse"],
               "height_source": dict(hs), "places": len(pois),
               "places_in_buildings": sum(1 for p in pois if p["building"])}
    (out / "semantics" / "summary.json").write_text(json.dumps(summary, indent=1, ensure_ascii=False))
    print(json.dumps(summary, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
