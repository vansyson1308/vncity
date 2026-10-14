"""Turn a fetched area into Unreal-ready tiles.

Outputs (under out/<name>/):
  manifest.json            georeference origin, projection, tile index, provenance stats
  tiles/bld_X_Y.glb        extruded buildings of one tile (vertex colour = height provenance)
  tiles/bld_X_Y.json       per-building attributes + triangle range inside the tile mesh
  tiles/road_X_Y.glb       road / rail ribbons clipped to the tile
  tiles/walk_X_Y.glb       raised sidewalks between carriageway and building line
  terrain/heightmap.png    16-bit heightmap from Copernicus GLO-30 (a DSM, see manifest)
  preview.png              top-down overview coloured by height provenance

Coordinates: local transverse Mercator centred on the origin (metres, east/north/up),
written to glTF as X=east, Y=up, Z=-north. Each tile's vertices are relative to the tile's
south-west corner; the node translation and manifest carry the tile offset.

Memory stays flat at city scale: the parent only projects centroids and bounds to assign
tile keys, writes tile-sorted GeoParquet copies, and each worker reads its own tile back.

Usage:
  python build.py --name caugiay [--tile 500] [--heights-tif open_buildings_2_5d.tif]
"""

import argparse
import json
import math
import multiprocessing as mp
import pathlib
from collections import Counter

import duckdb
import numpy as np
import pyarrow as pa
import pyproj
import shapely
import trimesh
from shapely import wkb
from shapely.geometry import box

from fetch import load_extensions

FLOOR_M = 3.3  # typical VN storey height used to convert floor counts
# Inferred defaults by footprint area (m²) when no height or floor count is known.
# Small plots in Hanoi/Saigon are mostly 3-5 storey "nhà ống" tube houses.
AREA_FLOORS = [(60, 3), (150, 4), (600, 5), (2000, 7), (math.inf, 9)]
ROAD_WIDTH = {
    "motorway": 24, "trunk": 20, "primary": 16, "secondary": 12, "tertiary": 9,
    "residential": 6, "unclassified": 6, "living_street": 4, "service": 4,
    "pedestrian": 4, "footway": 2, "cycleway": 2, "steps": 2, "path": 1.5,
    "track": 3, "unknown": 5,
}
RAIL_WIDTH = 3.0
PROVENANCE_RGBA = {
    "observed": (46, 160, 67, 255),      # height present in source data
    "derived_floors": (31, 111, 235, 255),  # floors × storey height
    "derived_raster": (163, 113, 247, 255),  # sampled from a 2.5D height raster
    "estimated_archetype": (230, 150, 40, 255),  # typical storeys of its Hanoi archetype (pipeline/semantics.py)
    "estimated": (150, 150, 150, 255),   # area heuristic, replace before shipping
}
# Sidewalk width (m) beside each carriageway edge, by road class. Narrow alleys (ngõ)
# have none: houses open straight onto the lane.
# Assumed from typical Hanoi streets (main roads 5-8 m); not measured per street.
SIDEWALK_WIDTH = {
    "motorway": 0.0, "trunk": 5.0, "primary": 6.0, "secondary": 5.0, "tertiary": 4.0,
    "residential": 2.0, "unclassified": 2.0,
}
CURB_M = 0.15
ROAD_RGBA = (60, 60, 64, 255)
RAIL_RGBA = (120, 85, 60, 255)
WALK_RGBA = (168, 72, 58, 255)  # red terracotta paving common on Hanoi sidewalks
# Probe distances (m) from a facade's midpoint outwards when deciding if it faces a street.
FRONTAGE_PROBES = (2.0, 6.0, 12.0)
MIN_FRONTAGE_M = 2.0
Y_UP = np.array([[1, 0, 0, 0], [0, 0, 1, 0], [0, -1, 0, 0], [0, 0, 0, 1]], dtype=float)


def local_projection(lat0, lon0):
    proj = f"+proj=tmerc +lat_0={lat0} +lon_0={lon0} +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +units=m"
    crs = pyproj.CRS.from_proj4(proj)
    return proj, crs, pyproj.Transformer.from_crs("EPSG:4326", crs, always_xy=True)


def area_of_interest(src, bbox, tf):
    """Projected clip area: the region boundary when fetched by region, else the bbox."""
    boundary = src / "boundary.geojson"
    if boundary.exists():
        geom = shapely.from_geojson(json.dumps(json.loads(boundary.read_text())["features"][0]["geometry"]))
    else:
        geom = box(*bbox).segmentize(0.001)
    area = project(geom, tf)
    shapely.prepare(area)
    return area


def project(geom, tf):
    return shapely.transform(geom, lambda xy: np.column_stack(tf.transform(xy[:, 0], xy[:, 1])))


def polygons(geom):
    if geom.geom_type == "Polygon":
        return [geom]
    if geom.geom_type in ("MultiPolygon", "GeometryCollection"):
        return [g for g in geom.geoms if g.geom_type == "Polygon"]
    return []


def resolve_height(row, area, raster_h):
    if row["height"] and row["height"] > 0:
        return float(row["height"]), "observed"
    if row["num_floors"] and row["num_floors"] > 0:
        return row["num_floors"] * FLOOR_M, "derived_floors"
    if raster_h is not None and raster_h > 2:
        return float(raster_h), "derived_raster"
    if row.get("sem_height"):
        return float(row["sem_height"]), "estimated_archetype"
    floors = next(f for limit, f in AREA_FLOORS if area < limit)
    return floors * FLOOR_M, "estimated"


def sample_raster(src, geom_wgs84):
    """Median raster value inside one footprint (e.g. Open Buildings 2.5D height band)."""
    from rasterio.mask import mask

    try:
        data, _ = mask(src, [geom_wgs84.__geo_interface__], crop=True, filled=False)
    except ValueError:
        return None
    vals = data[0].compressed()
    return float(np.median(vals)) if vals.size else None


def extrude(poly, base, top):
    meshes = []
    for p in polygons(poly):
        if p.area < 1.0:
            continue
        try:
            m = trimesh.creation.extrude_polygon(p, top - base)
        except Exception:
            continue
        m.apply_translation((0, 0, base))
        meshes.append(m)
    return meshes


PROV_CODES = list(PROVENANCE_RGBA)
BCOLS = ["id", "name", "class", "height", "num_floors", "min_height", "is_underground", "sources", "wkb"]
RCOLS = ["id", "subtype", "class", "width_rules", "wkb"]
SEMCOLS = ["sem_height", "archetype"]
RCOLS = ["subtype", "class", "width_rules", "wkb"]
W = {}  # per-worker state, filled by init_worker


def init_worker(cfg):
    W.update(cfg)
    W["proj"], _, W["tf"] = local_projection(cfg["lat0"], cfg["lon0"])
    W["area"] = area_of_interest(cfg["src"], cfg["bbox"], W["tf"])
    W["con"] = duckdb.connect(config={"threads": 1, "memory_limit": "1GB"})
    W["raster"] = None
    if cfg["heights_tif"]:
        import rasterio
        W["raster"] = rasterio.open(cfg["heights_tif"])


def tile_buildings(ix, iy, ox, oy):
    sem = W["src"] / "semantics.parquet"
    if sem.exists():  # archetype heights from pipeline/semantics.py
        q = (f"SELECT {', '.join('b.' + c for c in BCOLS)}, s.height_m, s.archetype "
             f"FROM '{W['work'] / 'buildings.parquet'}' b LEFT JOIN '{sem}' s ON s.id = b.id "
             f"WHERE b.ix = ? AND b.iy = ?")
    else:
        q = (f"SELECT {', '.join(BCOLS)}, NULL, NULL FROM '{W['work'] / 'buildings.parquet'}' "
             f"WHERE ix = ? AND iy = ?")
    rows = W["con"].execute(q, [ix, iy]).fetchall()
    out, skipped = [], Counter()
    for r in rows:
        row = dict(zip(BCOLS + SEMCOLS, r))
        if row["is_underground"]:
            skipped["underground"] += 1
            continue
        g = wkb.loads(bytes(row["wkb"]))
        pg = project(g, W["tf"])
        if not polygons(pg):
            skipped["not_polygon"] += 1
            continue
        rh = sample_raster(W["raster"], g) if W["raster"] is not None else None
        h, prov = resolve_height(row, pg.area, rh)
        base = float(row["min_height"] or 0.0)
        if h <= base:
            skipped["non_positive_height"] += 1
            continue
        c = g.centroid
        local = shapely.make_valid(shapely.affinity.translate(pg, -ox, -oy).simplify(0.05))
        out.append({
            "id": row["id"], "name": row["name"], "class": row["class"],
            "geom": local, "base": base, "top": h,
            "id": row["id"], "name": row["name"], "class": row["class"], "archetype": row["archetype"],
            "geom": shapely.affinity.translate(pg, -ox, -oy), "base": base, "top": h,
            "height_m": round(h, 2), "height_source": prov, "min_height_m": base,
            "area_m2": round(pg.area, 1), "lon": round(c.x, 7), "lat": round(c.y, 7),
            "sources": sorted({x["dataset"] for x in (row["sources"] or [])}),
        })
    return out, skipped


def roads_around(ix, iy, ox, oy, size, margin=30.0):
    """Road ribbons (tile-local) for this tile plus a margin, so facades and sidewalks at a
    tile edge still see the street across the border. Each segment appears once."""
    rows = W["con"].execute(
        f"SELECT {', '.join(RCOLS)} FROM '{W['work'] / 'roads.parquet'}' "
        "WHERE ix BETWEEN ? AND ? AND iy BETWEEN ? AND ?",
        [ix - 1, ix + 1, iy - 1, iy + 1]).fetchall()
    reach = box(ox - margin, oy - margin, ox + size + margin, oy + size + margin)
    out, seen = [], set()
    for r in rows:
        row = dict(zip(RCOLS, r))
        if row["id"] in seen:
            continue
        seen.add(row["id"])
        line = project(wkb.loads(bytes(row["wkb"])), W["tf"]).intersection(W["area"])
        if row["subtype"] == "rail":
            width = RAIL_WIDTH
        else:
            rules = row["width_rules"] or []
            width = next((x["value"] for x in rules if x["value"]), None) or \
                ROAD_WIDTH.get(row["class"] or "unknown", ROAD_WIDTH["unknown"])
        ribbon = line.buffer(width / 2, cap_style="flat").intersection(reach)
        if ribbon.is_empty:  # the clip left only points of this segment
            continue
        out.append({"subtype": row["subtype"], "class": row["class"] or "unknown",
                    "ribbon": shapely.affinity.translate(ribbon, -ox, -oy)})
    return out


def sidewalks(roads, buildings, size):
    """Raised walk between each carriageway and the building line, clipped to the tile."""
    bands = [r["ribbon"].buffer(SIDEWALK_WIDTH[r["class"]], join_style="mitre")
             for r in roads if r["subtype"] == "road" and SIDEWALK_WIDTH.get(r["class"], 0) > 0]
    if not bands:
        return []
    walk = shapely.union_all(bands)
    walk = walk.difference(shapely.union_all([r["ribbon"] for r in roads]))
    if buildings:
        walk = walk.difference(shapely.union_all([b["geom"] for b in buildings]))
    return polygons(walk.intersection(box(0, 0, size, size)))


def street_edges(poly, roads, tree):
    """Footprint edges that face a carriageway: where facades, shopfronts and signs go."""
    edges = []
    ring = shapely.geometry.polygon.orient(poly, 1.0).exterior  # counter-clockwise
    pts = np.asarray(ring.coords)
    for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
        dx, dy = x1 - x0, y1 - y0
        length = math.hypot(dx, dy)
        if length < MIN_FRONTAGE_M:
            continue
        nx, ny = dy / length, -dx / length  # outward normal of a CCW ring
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        for d in FRONTAGE_PROBES:
            hits = tree.query(shapely.Point(mx + nx * d, my + ny * d), predicate="intersects")
            if len(hits):
                edges.append({"a": [round(x0, 2), round(y0, 2)], "b": [round(x1, 2), round(y1, 2)],
                              "len": round(length, 2), "road": roads[hits[0]]["class"],
                              "setback_m": d})
                break
    return edges


def build_tile(key):
    ix, iy = key
    size = W["tile"]
    ox, oy = ix * size, iy * size
    out_dir = W["out"] / "tiles"
    res = {"key": [ix, iy], "origin_m": [ox, oy], "buildings": 0, "triangles": 0, "files": [],
           "provenance": Counter(), "skipped": Counter(), "points": [], "outlines": [], "roads": []}

    buildings, res["skipped"] = tile_buildings(ix, iy, ox, oy)
    roads = roads_around(ix, iy, ox, oy, size)
    carriageways = [r for r in roads if r["subtype"] == "road"]
    tree = shapely.STRtree([r["ribbon"] for r in carriageways])
    parts, attrs, face = [], [], 0
    for b in buildings:
        ms = extrude(b["geom"], b["base"], b["top"])
        if not ms:
            res["skipped"]["degenerate"] += 1
            continue
        m = trimesh.util.concatenate(ms)
        m.visual.vertex_colors = np.tile(PROVENANCE_RGBA[b["height_source"]], (len(m.vertices), 1))
        parts.append(m)
        main = max(polygons(b["geom"]), key=lambda p: p.area)
        attrs.append({k: b[k] for k in ("id", "name", "class", "height_m", "height_source",
        attrs.append({k: b[k] for k in ("id", "name", "class", "archetype", "height_m", "height_source",
                                        "min_height_m", "area_m2", "lon", "lat", "sources")}
                     | {"face_start": face, "face_count": len(m.faces),
                        "floors": max(1, round((b["top"] - b["base"]) / FLOOR_M)),
                        "footprint": np.round(np.asarray(main.exterior.coords), 2).tolist(),
                        "street_edges": street_edges(main, carriageways, tree)})
        face += len(m.faces)
        res["provenance"][b["height_source"]] += 1
        code = PROV_CODES.index(b["height_source"])
        c = b["geom"].centroid
        res["points"].append((c.x + ox, c.y + oy, code))
        if W["detail_preview"]:
            for p in polygons(b["geom"]):
                res["outlines"].append((np.asarray(p.exterior.coords) + (ox, oy), code))
    if parts:
        mesh = trimesh.util.concatenate(parts)
        mesh.apply_transform(Y_UP)
        name = f"bld_{ix}_{iy}"
        export_glb(mesh, name, (ox, oy), out_dir / f"{name}.glb")
        (out_dir / f"{name}.json").write_text(json.dumps(
            {"tile": [ix, iy], "origin_m": [ox, oy], "buildings": attrs}, ensure_ascii=False))
        res["buildings"] = len(attrs)
        res["triangles"] += len(mesh.faces)
        res["files"] += [f"{name}.glb", f"{name}.json"]

    tile_box = box(0, 0, size, size)
    parts = []
    for r in roads:
        for p in polygons(r["ribbon"].intersection(tile_box)):
            try:
                m = trimesh.creation.extrude_polygon(p, 0.08)
            except Exception:
                continue
            m.visual.vertex_colors = np.tile(RAIL_RGBA if r["subtype"] == "rail" else ROAD_RGBA,
                                             (len(m.vertices), 1))
            parts.append(m)
            if W["detail_preview"]:
                res["roads"].append(np.asarray(p.exterior.coords) + (ox, oy))
    if parts:
        mesh = trimesh.util.concatenate(parts)
        mesh.apply_transform(Y_UP)
        name = f"road_{ix}_{iy}"
        export_glb(mesh, name, (ox, oy), out_dir / f"{name}.glb")
        res["triangles"] += len(mesh.faces)
        res["files"].append(f"{name}.glb")

    parts = []
    for p in sidewalks(roads, buildings, size):
        try:
            m = trimesh.creation.extrude_polygon(p, CURB_M)
        except Exception:
            continue
        m.visual.vertex_colors = np.tile(WALK_RGBA, (len(m.vertices), 1))
        parts.append(m)
    if parts:
        mesh = trimesh.util.concatenate(parts)
        mesh.apply_transform(Y_UP)
        name = f"walk_{ix}_{iy}"
        export_glb(mesh, name, (ox, oy), out_dir / f"{name}.glb")
        res["triangles"] += len(mesh.faces)
        res["files"].append(f"{name}.glb")
    return res


def tile_index(con, src, work, tf, size):
    """Write tile-sorted copies of buildings and roads; return the set of tile keys.

    Buildings belong to the tile of their centroid; a road is copied into every tile its
    projected bounds touch and clipped to that tile by the worker.
    """
    b = con.sql(f"""SELECT file_row_number AS r,
                           ST_X(ST_Centroid(ST_GeomFromWKB(wkb))) AS x,
                           ST_Y(ST_Centroid(ST_GeomFromWKB(wkb))) AS y
                    FROM read_parquet('{src / 'buildings.parquet'}', file_row_number = true)""").fetchnumpy()
    bx, by = tf.transform(b["x"], b["y"])
    bkeys = pa.table({"r": b["r"], "ix": np.floor(np.asarray(bx) / size).astype(np.int32),
                      "iy": np.floor(np.asarray(by) / size).astype(np.int32)})
    con.register("bkeys", bkeys)
    con.sql(f"""COPY (SELECT p.*, k.ix, k.iy
                      FROM read_parquet('{src / 'buildings.parquet'}', file_row_number = true) p
                      JOIN bkeys k ON p.file_row_number = k.r ORDER BY k.ix, k.iy)
                TO '{work / 'buildings.parquet'}' (FORMAT parquet, ROW_GROUP_SIZE 8192)""")

    r = con.sql(f"""SELECT file_row_number AS r, ST_XMin(g) x0, ST_YMin(g) y0, ST_XMax(g) x1, ST_YMax(g) y1
                    FROM (SELECT file_row_number, ST_GeomFromWKB(wkb) g
                          FROM read_parquet('{src / 'roads.parquet'}', file_row_number = true))""").fetchnumpy()
    corners = [tf.transform(r[xk], r[yk]) for xk in ("x0", "x1") for yk in ("y0", "y1")]
    xs = np.stack([np.asarray(c[0]) for c in corners])
    ys = np.stack([np.asarray(c[1]) for c in corners])
    ix0, ix1 = np.floor(xs.min(0) / size).astype(np.int64), np.floor(xs.max(0) / size).astype(np.int64)
    iy0, iy1 = np.floor(ys.min(0) / size).astype(np.int64), np.floor(ys.max(0) / size).astype(np.int64)
    pairs = [(row, i, j) for row, a0, a1, b0, b1 in zip(r["r"], ix0, ix1, iy0, iy1)
             for i in range(a0, a1 + 1) for j in range(b0, b1 + 1)]
    rk = np.array(pairs, dtype=np.int64).reshape(-1, 3)
    con.register("rkeys", pa.table({"r": rk[:, 0], "ix": rk[:, 1].astype(np.int32),
                                    "iy": rk[:, 2].astype(np.int32)}))
    con.sql(f"""COPY (SELECT p.*, k.ix, k.iy
                      FROM read_parquet('{src / 'roads.parquet'}', file_row_number = true) p
                      JOIN rkeys k ON p.file_row_number = k.r ORDER BY k.ix, k.iy)
                TO '{work / 'roads.parquet'}' (FORMAT parquet, ROW_GROUP_SIZE 8192)""")
    keys = {(int(i), int(j)) for i, j in zip(bkeys["ix"].to_numpy(), bkeys["iy"].to_numpy())}
    keys |= {(int(i), int(j)) for i, j in rk[:, 1:]}
    return sorted(keys), len(b["r"]), len(r["r"])


def export_glb(mesh, name, tile_origin, path):
    scene = trimesh.Scene()
    ox, oy = tile_origin
    # Tile offset in glTF axes (X=east, Y=up, Z=-north).
    tf = np.eye(4)
    tf[:3, 3] = (ox, 0.0, -oy)
    scene.add_geometry(mesh, node_name=name, geom_name=name, transform=tf)
    path.write_bytes(scene.export(file_type="glb", include_normals=True))


def export_heightmap(dem_paths, bbox, out_dir, crs):
    import rasterio
    from rasterio.merge import merge
    from rasterio.warp import Resampling, calculate_default_transform, reproject
    from PIL import Image

    srcs = [rasterio.open(p) for p in dem_paths]
    w, s, e, n = bbox
    mosaic, transform = merge(srcs, bounds=(w, s, e, n))
    src_crs = srcs[0].crs
    dst_transform, width, height = calculate_default_transform(
        src_crs, crs.to_wkt(), mosaic.shape[2], mosaic.shape[1], w, s, e, n, resolution=30)
    dst = np.zeros((height, width), dtype=np.float32)
    reproject(mosaic[0], dst, src_transform=transform, src_crs=src_crs,
              dst_transform=dst_transform, dst_crs=crs.to_wkt(), resampling=Resampling.bilinear)
    lo, hi = float(np.nanmin(dst)), float(np.nanmax(dst))
    scaled = np.round((dst - lo) / max(hi - lo, 1e-6) * 65535).astype(np.uint16)
    Image.fromarray(scaled).save(out_dir / "heightmap.png")
    return {
        "file": "terrain/heightmap.png", "source": "Copernicus DEM GLO-30 (DSM)",
        "kind": "DSM: includes building and canopy surfaces at 30 m, not bare earth",
        "pixels": [width, height], "pixel_size_m": 30,
        "west_m": dst_transform.c, "north_m": dst_transform.f,
        "min_m": lo, "max_m": hi,
        "unreal_landscape_z_scale": (hi - lo) / 512.0 * 100.0,
    }


def preview(results, path, title, detail):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.collections import PolyCollection
    from matplotlib.patches import Patch

    colors = np.array(list(PROVENANCE_RGBA.values())) / 255
    fig, ax = plt.subplots(figsize=(12, 12), dpi=150)
    if detail:
        roads = [p for r in results for p in r["roads"]]
        ax.add_collection(PolyCollection(roads, facecolors="#3c3c40", edgecolors="none"))
        outlines = [o for r in results for o in r["outlines"]]
        ax.add_collection(PolyCollection([o[0] for o in outlines],
                                         facecolors=colors[[o[1] for o in outlines]], edgecolors="none"))
    else:
        pts = np.array([p for r in results for p in r["points"]])
        order = np.argsort(pts[:, 2] != PROV_CODES.index("estimated"))  # estimated drawn first
        pts = pts[order]
        ax.scatter(pts[:, 0], pts[:, 1], s=0.05, c=colors[pts[:, 2].astype(int)], linewidths=0)
    ax.autoscale_view()
    ax.set_aspect("equal")
    ax.set_facecolor("#f4f4f1")
    ax.set_title(title)
    ax.set_xlabel("east (m)")
    ax.set_ylabel("north (m)")
    ax.legend(handles=[Patch(color=np.array(v) / 255, label=k) for k, v in PROVENANCE_RGBA.items()],
              loc="lower right")
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--data", default="data")
    ap.add_argument("--out", default="out")
    ap.add_argument("--tile", type=float, default=500.0, help="tile edge in metres")
    ap.add_argument("--origin", help="lat,lon of the world origin (default: bbox centre)")
    ap.add_argument("--heights-tif", help="optional 2.5D building-height raster in metres")
    ap.add_argument("--workers", type=int, default=mp.cpu_count())
    a = ap.parse_args()

    src = pathlib.Path(a.data) / a.name
    fetched = json.loads((src / "fetch.json").read_text())
    w, s, e, n = fetched["bbox"]
    lat0, lon0 = (map(float, a.origin.split(",")) if a.origin else ((s + n) / 2, (w + e) / 2))
    proj, crs, tf = local_projection(lat0, lon0)
    out = pathlib.Path(a.out) / a.name
    work = out / "work"
    for d in (out / "tiles", out / "terrain", work):
        d.mkdir(parents=True, exist_ok=True)

    con = duckdb.connect(config={"memory_limit": "4GB"})
    load_extensions(con, "spatial")
    keys, n_buildings, n_roads = tile_index(con, src, work, tf, a.tile)
    con.close()
    detail = n_buildings <= 60000
    print(f"indexed {n_buildings:,} buildings, {n_roads:,} road segments into {len(keys):,} tiles",
          flush=True)

    cfg = {"lat0": lat0, "lon0": lon0, "src": src, "bbox": (w, s, e, n), "work": work, "out": out,
           "tile": a.tile, "heights_tif": a.heights_tif, "detail_preview": detail}
    results = []
    with mp.Pool(a.workers, initializer=init_worker, initargs=(cfg,), maxtasksperchild=200) as pool:
        for i, r in enumerate(pool.imap_unordered(build_tile, keys, chunksize=2), 1):
            if r["files"]:
                results.append(r)
            if i % 250 == 0:
                print(f"tiles {i:,}/{len(keys):,}", flush=True)
    results.sort(key=lambda r: r["key"])

    dem = [src / p for p in fetched.get("dem_tiles", [])]
    terrain = export_heightmap(dem, (w, s, e, n), out / "terrain", crs) if dem else None

    prov = sum((r["provenance"] for r in results), Counter())
    skipped = sum((r["skipped"] for r in results), Counter())
    built = sum(r["buildings"] for r in results)
    manifest = {
        "name": a.name,
        "source": {"overture_release": fetched["overture_release"], "bbox_wgs84": [w, s, e, n],
                   "region": fetched.get("region"),
                   "licences": "Overture Maps (per-feature; OSM-derived rows ODbL), "
                               "Copernicus DEM GLO-30. Attribution required in credits."},
        "georeference": {"origin_lat": lat0, "origin_lon": lon0, "origin_height_m": 0.0,
                         "projection": proj, "gltf_axes": "X=east, Y=up, Z=-north (metres)"},
        "tile_size_m": a.tile,
        "buildings": {"fetched": n_buildings, "count": built, "skipped": dict(skipped),
                      "height_provenance": dict(prov),
                      "height_rules": {"floor_m": FLOOR_M, "area_floors": AREA_FLOORS[:-1]}},
        "roads": {"segments": n_roads},
        "terrain": terrain,
        "tiles": [{k: r[k] for k in ("key", "origin_m", "buildings", "triangles", "files")}
                  for r in results],
        "triangles": sum(r["triangles"] for r in results),
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
    preview(results, out / "preview.png",
            f"{a.name}: {built:,} buildings, provenance of height", detail)
    print(json.dumps({k: manifest[k] for k in ("buildings", "roads", "triangles")}, indent=1))
    print(f"tiles: {len(results)}")


if __name__ == "__main__":
    main()
