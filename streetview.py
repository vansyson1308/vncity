"""Real street-level appearance from open 360° imagery (KartaView and Mapillary, CC BY-SA 4.0).

  harvest   list every KartaView photo in the area (metadata only)
  mapillary list Mapillary 360° images in the area with their SfM poses (needs MAPILLARY_TOKEN)
  download  fetch the equirectangular 360° panoramas (faces and plates already blurred by the source)
  sequences fetch each KartaView capture's full sequence (travel direction comes from its neighbours)
  pose      correct KartaView phone-GPS poses: snap each capture to its lane; heading from travel
            direction, the recorded compass, or where the sky shows against the block model.
            Mapillary images keep the pose Mapillary's own SfM computed.
  facades   project panoramas onto the street-facing walls built by build.py -> photo facade textures
  check     draw the street walls over panoramas and tile the facade textures, to judge alignment
  viewer    write web-sized panoramas + index for viewer/walk.html's real-photo mode

Usage:
  python streetview.py harvest  --name caugiay
  MAPILLARY_TOKEN=MLY|... python streetview.py mapillary --name caugiay
  python streetview.py download --name caugiay
  python streetview.py sequences --name caugiay
  python streetview.py pose     --name caugiay
  python streetview.py facades  --name caugiay
  python streetview.py check    --name caugiay
  python streetview.py viewer   --name caugiay --site site/caugiay [--facades]
"""

import argparse
import glob
import json
import math
import os
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import numpy as np
import pyproj
import shapely
from PIL import Image, ImageDraw

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build import ROAD_WIDTH  # noqa: E402  (same width table as the road meshes)

Image.MAX_IMAGE_PIXELS = 200_000_000  # KartaView panoramas are 13000 x 6500
API = "https://api.openstreetcam.org"
STORAGE = "https://{storage}.openstreetcam.org/files/photo/{path}"
UA = {"User-Agent": "vncity/0.1 (github.com/vansyson1308/vncity)"}
MLY_GRAPH = "https://graph.mapillary.com"
MLY_TILE = "https://tiles.mapillary.com/maps/vtp/{layer}/2/14/{x}/{y}?access_token={token}"
MLY_FIELDS = ("id,camera_type,captured_at,sequence,geometry,computed_geometry,"
              "compass_angle,computed_compass_angle,computed_rotation")
MLY_SPACING_M = 8.0        # keep one Mapillary panorama per this distance: cars capture every ~2 m

CAMERA_HEIGHT_M = 1.8      # handheld / helmet capture; KartaView does not record it
MAX_RANGE_M = 30.0         # farther facades are too small in a 13000 px panorama
MIN_FRONTALITY = 0.35      # cos of the angle between the wall normal and the view ray
PX_PER_M = 40              # facade texture resolution
MAX_TEX_PX = 1024
MAX_FACADE_H_M = 12.0      # the panorama's vertical band rarely reaches higher at street range
SNAP_RANGE_M = 15.0        # phone GPS error in Hanoi streets; farther captures are left as recorded
MAX_TURN_DEG = 50.0        # a heading prior this far from the road means a turn: keep the prior
SKY_ELEVATIONS = np.array([15, 20, 25, 30, 35])   # degrees above the horizon tested for open sky
SKY_RANGE_M = 70.0
MIN_SKY_MARGIN = 0.08      # correlation gap between the two road directions to trust the sky


def get_bytes(url, data=None, headers=None, tries=4):
    for i in range(tries):
        try:
            body = urllib.parse.urlencode(data).encode() if data else None
            req = urllib.request.Request(url, data=body, headers=UA | (headers or {}))
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code < 500 and e.code != 429:      # a refused token or bad query will not heal
                raise SystemExit(f"{e.code} from {url.split('?')[0]}: {e.read()[:300].decode(errors='replace')}")
            if i == tries - 1:
                raise
        except OSError:
            if i == tries - 1:
                raise
        time.sleep(2 ** (i + 1))


def get_json(url, data=None, headers=None):
    return json.loads(get_bytes(url, data, headers))


def area(name, data):
    meta = json.loads((pathlib.Path(data) / name / "fetch.json").read_text())
    return meta["bbox"]


def harvest(a):
    w, s, e, n = area(a.name, a.data)
    lat0 = (s + n) / 2
    step_lat = 0.6 * a.radius / 111_320
    step_lon = 0.6 * a.radius / (111_320 * math.cos(math.radians(lat0)))
    photos = {}
    lat = s
    while lat <= n + step_lat:
        lon = w
        while lon <= e + step_lon:
            d = get_json(f"{API}/1.0/list/nearby-photos/",
                         {"lat": f"{lat:.6f}", "lng": f"{lon:.6f}", "radius": a.radius})
            for p in d.get("currentPageItems", []):
                photos[p["id"]] = p
            print(f"{lat:.4f},{lon:.4f}: total {len(photos)}", flush=True)
            lon += step_lon
        lat += step_lat
    inside = [p for p in photos.values()
              if w <= float(p["lng"]) <= e and s <= float(p["lat"]) <= n]
    out = pathlib.Path(a.data) / a.name / "kartaview.json"
    out.write_text(json.dumps(inside, indent=1))
    sphere = sum(p["projection"] == "SPHERE" for p in inside)
    print(f"{len(inside)} photos in the area ({sphere} 360° panoramas) -> {out}")


def download(a):
    src = pathlib.Path(a.data) / a.name
    pano_dir = src / "panos"
    pano_dir.mkdir(exist_ok=True)
    if (src / "kartaview.json").exists():
        photos = json.loads((src / "kartaview.json").read_text())
        todo = [p for p in photos if p["projection"] == "SPHERE"]
        for i, p in enumerate(todo, 1):
            dst = pano_dir / f"{p['id']}.jpg"
            if dst.exists():
                continue
            storage, path = p["name"].split("/files/photo/")
            url = STORAGE.format(storage=storage, path=path.replace("/proc/", "/wrapped_proc/"))
            fetch_file(url, dst)
            print(f"KartaView {i}/{len(todo)} {dst.name}", flush=True)
    if (src / "mapillary.json").exists():
        todo = [p for p in json.loads((src / "mapillary.json").read_text())["images"]
                if p["selected"] and not (pano_dir / f"{p['id']}.jpg").exists()]
        done = 0
        for i in range(0, len(todo), 50):        # image URLs are signed and expire: ask right before use
            batch = todo[i:i + 50]
            urls = {int(r["id"]): r.get("thumb_original_url") for r in mly_graph(
                "images", {"image_ids": ",".join(str(p["mly_id"]) for p in batch),
                           "fields": "id,thumb_original_url", "limit": len(batch)}).get("data", [])}
            if not any(urls.values()):
                raise SystemExit("Mapillary returned no image URLs: the token's app needs read access "
                                 "(mapillary.com/dashboard/developers)")
            for p in batch:
                if urls.get(p["mly_id"]):
                    fetch_file(urls[p["mly_id"]], pano_dir / f"{p['id']}.jpg")
                    done += 1
                    print(f"Mapillary {done}/{len(todo)} {p['id']}", flush=True)


def fetch_file(url, dst, tries=5):
    """Stream to a temporary name and rename, so an interrupted transfer never looks complete."""
    tmp = dst.with_suffix(".part")
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            tmp.rename(dst)
            return
        except OSError:
            if i == tries - 1:
                raise
            time.sleep(2 ** (i + 1))


def mly_token():
    tok = os.environ.get("MAPILLARY_TOKEN")
    if not tok:
        raise SystemExit("set MAPILLARY_TOKEN to a client token from mapillary.com/dashboard/developers")
    return tok


def mly_graph(path, params):
    return get_json(f"{MLY_GRAPH}/{path}?{urllib.parse.urlencode(params)}",
                    headers={"Authorization": f"OAuth {mly_token()}"})


def mly_tile_panos(layer, w, s, e, n):
    """360° images in the bbox from Mapillary's z14 coverage tiles. `mly1_computed_public` carries
    the SfM position and compass angle, `mly1_public` the recorded GPS and compass. Tile
    coordinates are quantised to 1/4096 of a tile, about 0.55 m at Hà Nội's latitude."""
    import mapbox_vector_tile

    z = 14
    N = 2 ** z
    tx = lambda lon: int((lon + 180) / 360 * N)
    ty = lambda lat: int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * N)
    out = {}
    for x in range(tx(w), tx(e) + 1):
        for y in range(ty(n), ty(s) + 1):
            raw = get_bytes(MLY_TILE.format(layer=layer, x=x, y=y, token=mly_token()))
            tile = mapbox_vector_tile.decode(raw, default_options={"y_coord_down": True}).get("image")
            for f in (tile or {}).get("features", []):
                px, py = f["geometry"]["coordinates"]
                lon = (x + px / tile["extent"]) / N * 360 - 180
                lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + py / tile["extent"]) / N))))
                if f["properties"].get("is_pano") and w <= lon <= e and s <= lat <= n:
                    out[int(f["properties"]["id"])] = f["properties"] | {"lng": lon, "lat": lat}
            print(f"{layer} {z}/{x}/{y}: {len(out)} panoramas so far", flush=True)
    return out


def mapillary(a):
    """List Mapillary 360° images with the pose Mapillary's structure-from-motion computed.

    Mapillary reconstructs each upload with OpenSfM, so `computed_geometry` and
    `computed_compass_angle` come from matching the images to each other, not from one phone
    fix. Only images with such a pose are kept for download; one per MLY_SPACING_M, newest first."""
    w, s, e, n = area(a.name, a.data)
    gps = mly_tile_panos("mly1_public", w, s, e, n)
    sfm = mly_tile_panos("mly1_computed_public", w, s, e, n)
    ids = sorted(gps.keys() | sfm.keys())
    meta = {}
    for i in range(0, len(ids), 50):
        batch = ids[i:i + 50]
        for r in mly_graph("images", {"image_ids": ",".join(map(str, batch)), "fields": MLY_FIELDS,
                                      "limit": len(batch)}).get("data", []):
            meta[int(r["id"])] = r
        print(f"Graph API: {len(meta)}/{min(i + 50, len(ids))} images described", flush=True)
    if not meta:
        print("WARNING: the Graph API described none of these images. Poses below come from the "
              "coverage tiles only, and `download` will need the token's app to have read access.")
    images = []
    for i in ids:
        g, c, m = gps.get(i), sfm.get(i), meta.get(i, {})
        t = g or c
        if m.get("camera_type") not in (None, "spherical", "equirectangular"):
            continue
        rec = {"id": f"mly_{i}", "mly_id": i, "sequence": m.get("sequence") or t["sequence_id"],
               "captured_at": m.get("captured_at") or t["captured_at"],
               "camera_type": m.get("camera_type"), "quality_score": t.get("quality_score"),
               "gps": None, "sfm": None}
        if "geometry" in m:
            lng, lat = m["geometry"]["coordinates"]
            rec["gps"] = {"lng": lng, "lat": lat, "compass": m.get("compass_angle"), "from": "graph"}
        elif g:
            rec["gps"] = {"lng": g["lng"], "lat": g["lat"], "compass": g.get("compass_angle"), "from": "tile"}
        if "computed_geometry" in m and m.get("computed_compass_angle") is not None:
            lng, lat = m["computed_geometry"]["coordinates"]
            rec["sfm"] = {"lng": lng, "lat": lat, "heading": m["computed_compass_angle"],
                          "rotation": m.get("computed_rotation"), "from": "graph"}
        elif c and c.get("compass_angle") is not None:
            rec["sfm"] = {"lng": c["lng"], "lat": c["lat"], "heading": c["compass_angle"], "from": "tile"}
        images.append(rec)

    # thin to one per MLY_SPACING_M: SfM pose from the Graph API first, then newest capture
    lat0 = (s + n) / 2
    xy = lambda r: (r["sfm"]["lng"] * 111_320 * math.cos(math.radians(lat0)), r["sfm"]["lat"] * 110_574)
    ranked = sorted((r for r in images if r["sfm"]), reverse=True,
                    key=lambda r: (r["sfm"]["from"] == "graph", (r["quality_score"] or 0) >= 0.5, r["captured_at"]))
    kept = []
    grid = {}
    for r in ranked:
        x, y = xy(r)
        cx, cy = int(x // MLY_SPACING_M), int(y // MLY_SPACING_M)
        near = [q for dx in (-1, 0, 1) for dy in (-1, 0, 1) for q in grid.get((cx + dx, cy + dy), [])]
        r["selected"] = all(math.hypot(x - qx, y - qy) >= MLY_SPACING_M for qx, qy in near)
        if r["selected"]:
            grid.setdefault((cx, cy), []).append((x, y))
            kept.append(r)
    for r in images:
        r.setdefault("selected", False)
    out = pathlib.Path(a.data) / a.name / "mapillary.json"
    out.write_text(json.dumps({"source": "Mapillary (CC BY-SA 4.0)", "spacing_m": MLY_SPACING_M,
                               "images": images}, indent=1))
    years = sorted({time.gmtime(r["captured_at"] / 1000).tm_year for r in kept})
    print(f"{len(images)} Mapillary 360° images in the area, {sum(bool(r['sfm']) for r in images)} with "
          f"an SfM pose ({sum(bool(r['sfm']) and r['sfm']['from'] == 'graph' for r in images)} from the "
          f"Graph API); {len(kept)} kept for download, {len({r['sequence'] for r in kept})} sequences, "
          f"{years[0] if years else '-'}-{years[-1] if years else '-'} -> {out}")


def local_tf(manifest):
    crs = pyproj.CRS.from_proj4(manifest["georeference"]["projection"])
    return pyproj.Transformer.from_crs("EPSG:4326", crs, always_xy=True)


def load_panos(src, tf, recorded=False, sources=("kartaview", "mapillary")):
    """Downloaded panoramas in local metres. KartaView poses are corrected by `pose` unless
    `recorded`; Mapillary images carry the pose of Mapillary's SfM."""
    poses = {}
    pose_file = src / "pano_poses.json"
    if not recorded and pose_file.exists():
        poses = {p["id"]: p for p in json.loads(pose_file.read_text())["poses"]}
    panos = []
    for p in json.loads((src / "kartaview.json").read_text()) if "kartaview" in sources and (src / "kartaview.json").exists() else []:
        f = src / "panos" / f"{p['id']}.jpg"
        if p["projection"] != "SPHERE" or not f.exists():
            continue
        x, y = tf.transform(float(p["lng"]), float(p["lat"]))
        # KartaView leaves heading empty when the device recorded none; never read that as north
        heading = float(p["heading"]) if p["heading"] not in (None, "") else None
        quality = "recorded" if heading is not None else "none"
        if p["id"] in poses:
            q = poses[p["id"]]
            x, y, heading, quality = q["x"], q["y"], q["heading"], q["quality"]
        panos.append({"id": p["id"], "x": x, "y": y, "heading": heading, "pose_quality": quality,
                      "shot": p["shot_date"], "file": f, "sequence": p["sequence_id"], "source": "KartaView"})
    mly = src / "mapillary.json"
    for p in json.loads(mly.read_text())["images"] if "mapillary" in sources and mly.exists() else []:
        f = src / "panos" / f"{p['id']}.jpg"
        if not p["sfm"] or not f.exists():
            continue
        x, y = tf.transform(p["sfm"]["lng"], p["sfm"]["lat"])
        panos.append({"id": p["id"], "x": x, "y": y, "heading": p["sfm"]["heading"],
                      "pose_quality": f"sfm-{p['sfm']['from']}", "file": f, "sequence": p["sequence"],
                      "shot": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(p["captured_at"] / 1000)),
                      "source": "Mapillary"})
    return panos


def road_lines(src, tf):
    import duckdb

    lines = []
    for subtype, cls, rules, w in duckdb.sql(
            f"SELECT subtype, class, width_rules, wkb FROM '{src / 'roads.parquet'}' "
            "WHERE subtype = 'road'").fetchall():
        g = shapely.from_wkb(bytes(w))
        g = shapely.transform(g, lambda xy: np.column_stack(tf.transform(xy[:, 0], xy[:, 1])))
        width = next((r["value"] for r in (rules or []) if r["value"]), None)
        for part in getattr(g, "geoms", [g]):
            if part.length > 1:
                lines.append((part, cls or "unknown", width))
    return lines


def sequences(a):
    src = pathlib.Path(a.data) / a.name
    ids = sorted({p["sequence_id"] for p in json.loads((src / "kartaview.json").read_text())
                  if p["projection"] == "SPHERE"})
    out = {}
    for i, sid in enumerate(ids, 1):
        d = get_json(f"{API}/2.0/photo/?sequenceId={sid}&itemsPerPage=150")
        out[sid] = [{"id": x["id"], "idx": int(x["sequenceIndex"]), "lat": float(x["lat"]),
                     "lng": float(x["lng"])} for x in d.get("result", {}).get("data", [])]
        print(f"{i}/{len(ids)} sequence {sid}: {len(out[sid])} photos", flush=True)
    (src / "kartaview_sequences.json").write_text(json.dumps(out))


def travel_bearings(src, tf):
    """Bearing of travel at each capture, from the captures before and after it."""
    f = src / "kartaview_sequences.json"
    if not f.exists():
        return {}
    out = {}
    for photos in json.loads(f.read_text()).values():
        photos = sorted(photos, key=lambda p: p["idx"])
        xy = [tf.transform(p["lng"], p["lat"]) for p in photos]
        for i, p in enumerate(photos):
            a, b = xy[max(0, i - 1)], xy[min(len(xy) - 1, i + 1)]
            if math.hypot(b[0] - a[0], b[1] - a[1]) > 2.0:     # moved enough to tell direction
                out[p["id"]] = math.degrees(math.atan2(b[0] - a[0], b[1] - a[1])) % 360
    return out


def wall_segments(out_dir):
    segs = []
    for f in sorted(glob.glob(str(out_dir / "tiles" / "bld_*.json"))):
        d = json.load(open(f))
        ox, oy = d["origin_m"]
        for b in d["buildings"]:
            fp = np.asarray(b["footprint"]) + (ox, oy)
            segs.extend([[*p, *q, b["height_m"]] for p, q in zip(fp[:-1], fp[1:])])
    return np.array(segs)


def predicted_sky(segs, cam):
    """360 x elevations: 1 where the block model leaves the sky open from `cam`."""
    near = np.minimum(np.hypot(*(segs[:, :2] - cam[:2]).T), np.hypot(*(segs[:, 2:4] - cam[:2]).T)) < SKY_RANGE_M
    segs = segs[near]
    az = np.radians(np.arange(360))
    u = np.stack([np.sin(az), np.cos(az)], 1)
    p, e, H = segs[:, :2], segs[:, 2:4] - segs[:, :2], segs[:, 4]
    w = p - cam[:2]
    den = u[:, None, 0] * e[None, :, 1] - u[:, None, 1] * e[None, :, 0]
    with np.errstate(divide="ignore", invalid="ignore"):
        t = (w[None, :, 0] * e[None, :, 1] - w[None, :, 1] * e[None, :, 0]) / den
        sg = (w[None, :, 0] * u[:, None, 1] - w[None, :, 1] * u[:, None, 0]) / den
    hit = (t > 0.3) & (t < SKY_RANGE_M) & (sg >= 0) & (sg <= 1)
    top = np.where(hit, np.degrees(np.arctan2(H[None, :] - cam[2], np.where(hit, t, 1.0))), -90.0)
    return (SKY_ELEVATIONS[None, :] > top.max(1)[:, None]).astype(float)


def observed_sky(img):
    """360 x elevations: share of sky-looking pixels, column 0 = 180° left of the image centre."""
    h, w, _ = img.shape
    obs = np.full((360, len(SKY_ELEVATIONS)), np.nan)
    cols = np.array_split(np.arange(w), 360)
    for j, el in enumerate(SKY_ELEVATIONS):
        band = img[int((0.5 - (el + 2) / 180) * h): int((0.5 - (el - 2) / 180) * h)].astype(float)
        for k, c in enumerate(cols):
            px = band[:, c].reshape(-1, 3)
            px = px[px.max(1) > 10]                               # black = outside the capture
            if len(px) < 0.5 * band.shape[0] * len(c):
                continue
            mx, mn = px.max(1), px.min(1)
            sat, val = (mx - mn) / np.maximum(mx, 1), mx / 255
            # Hà Nội skies are mostly white-grey haze, sometimes blue
            obs[k, j] = (((val > 0.62) & (sat < 0.22)) | ((px[:, 2] > px[:, 0] + 12) & (val > 0.55))).mean()
    return obs


def sky_scores(pred, obs):
    """Correlation of observed vs predicted sky for each heading 0..359 (image centre azimuth)."""
    valid = ~np.isnan(obs)
    o = obs[valid]
    out = np.full(360, -1.0)
    if o.std() == 0:
        return out
    for hd in range(360):
        b = np.roll(pred, 180 - hd, axis=0)[valid]               # rows -> relative -180..179
        if b.std() > 0:
            out[hd] = np.corrcoef(o, b)[0, 1]
    return out


def pose(a):
    """Captures are taken on roads: snapping to the right-hand lane removes cross-track GPS
    error, and the road fixes heading up to its two directions. Which of the two (or any
    heading off-road) comes from, in order of trust: the travel direction within the
    sequence, the recorded compass, then where the sky shows against the block model."""
    src = pathlib.Path(a.data) / a.name
    out_dir = pathlib.Path(a.out) / a.name
    tf = local_tf(json.loads((out_dir / "manifest.json").read_text()))
    lines = road_lines(src, tf)
    tree = shapely.STRtree([l[0] for l in lines])
    travel = travel_bearings(src, tf)
    segs = wall_segments(out_dir)
    ang = lambda h1, h2: abs((h1 - h2 + 180) % 360 - 180)
    out, moved = [], []
    for p in load_panos(src, tf, recorded=True, sources=("kartaview",)):
        rec = {"id": p["id"], "recorded": [round(p["x"], 2), round(p["y"], 2), p["heading"]]}
        prior, prior_src = travel.get(p["id"]), "travel"
        if prior is None and p["heading"] is not None:
            prior, prior_src = p["heading"], "compass"
        pt = shapely.Point(p["x"], p["y"])
        line, cls, width = lines[tree.nearest(pt)]
        snapped = line.distance(pt) <= SNAP_RANGE_M
        cam = np.array([p["x"], p["y"], CAMERA_HEIGHT_M])
        if snapped:
            sp = line.project(pt)
            q0, q1 = line.interpolate(max(0, sp - 2)), line.interpolate(min(line.length, sp + 2))
            road_hd = math.degrees(math.atan2(q1.x - q0.x, q1.y - q0.y)) % 360
            c = line.interpolate(sp)
            cam[:2] = (c.x, c.y)
            cands = [road_hd, (road_hd + 180) % 360]
        else:
            cands = list(range(360))
        img = np.asarray(Image.open(p["file"]).convert("RGB").resize((3600, 1800)))
        scores = sky_scores(predicted_sky(segs, cam), observed_sky(img))
        if prior is not None:
            near_prior = [h for h in cands if ang(h, prior) <= MAX_TURN_DEG]
            heading = min(near_prior, key=lambda h: ang(h, prior)) if near_prior else prior
            quality = f"{'road+' if near_prior and snapped else ''}{prior_src}"
        else:
            best = max(cands, key=lambda h: scores[int(round(h)) % 360])
            margin = scores[int(round(best)) % 360] - max(
                (scores[int(round(h)) % 360] for h in cands if ang(h, best) > 30), default=-1)
            heading = best
            quality = f"{'road+' if snapped else ''}sky" if margin >= MIN_SKY_MARGIN else "uncertain"
        x, y = p["x"], p["y"]
        if snapped:
            w = width or ROAD_WIDTH.get(cls, ROAD_WIDTH["unknown"])
            lane = min(w * 0.25, 3.0) if w > 5 else 0.0                 # keep right (Vietnam)
            r = math.radians(heading)
            x, y = cam[0] + math.cos(r) * lane, cam[1] - math.sin(r) * lane
            moved.append(math.hypot(x - p["x"], y - p["y"]))
        out.append(rec | {"x": round(x, 2), "y": round(y, 2), "heading": round(heading % 360, 2),
                          "quality": quality, "snapped": snapped, "road_class": cls if snapped else None,
                          "sky_score": round(float(scores[int(round(heading)) % 360]), 3)})
        print(f"{p['id']}: {quality} heading {heading:.0f}", flush=True)
    (src / "pano_poses.json").write_text(json.dumps({"camera_height_m": CAMERA_HEIGHT_M, "poses": out}, indent=1))
    from collections import Counter
    print(Counter(o["quality"] for o in out))
    print(f"snapped {len(moved)}/{len(out)}; median shift {np.median(moved) if moved else 0:.1f} m")


DEPTH_MODEL = "depth-anything/Depth-Anything-V2-Metric-Outdoor-Small-hf"   # range
SKY_MODEL = "depth-anything/Depth-Anything-V2-Small-hf"     # relative: puts the sky at zero disparity
DEPTH_W, DEPTH_H = 1024, 512
SKY_DEPTH_M = 400.0
RIG_LAT_DEG = -45.0        # below this the panorama shows the capture rig (rider, bike, roof), not the street


def encode_depth(rng, cls):
    """Depth that survives a browser canvas: centimetres in R (high byte) and G (low byte),
    class in B (0 = surface, 128 = sky, 255 = no data)."""
    cm = np.clip(np.round(rng * 100), 1, 65535).astype(np.uint16)
    return np.dstack([(cm >> 8).astype(np.uint8), (cm & 255).astype(np.uint8),
                      np.select([cls == 1, cls == 2], [128, 255], 0).astype(np.uint8)])


def decode_depth(rgb):
    rgb = rgb.astype(np.int32)
    return (rgb[..., 0] * 256 + rgb[..., 1]) / 100.0, np.select([rgb[..., 2] > 192, rgb[..., 2] > 64], [2, 1], 0)


def pano_depth(pano, models):
    """Metric range along each ray of an equirect panorama (DEPTH_H x DEPTH_W), and a sky mask.

    Depth Anything V2 sees overlapping 100° perspective views (a ring at the horizon, rings at
    ±50°); each output ray takes the log-range of the views it falls in, weighted to the one
    that sees it most centrally. The metric model puts textureless sky a few metres away, so the
    sky comes from the relative model instead, which gives it zero disparity."""
    import torch

    H, W, _ = pano.shape
    lon = (np.arange(DEPTH_W) + 0.5) / DEPTH_W * 2 * np.pi - np.pi
    lat = np.pi / 2 - (np.arange(DEPTH_H) + 0.5) / DEPTH_H * np.pi
    LON, LAT = np.meshgrid(lon, lat)
    rays = np.stack([np.cos(LAT) * np.sin(LON), np.sin(LAT), np.cos(LAT) * np.cos(LON)], -1)   # x right, y up, z ahead
    acc, skyacc, wsum = np.zeros((DEPTH_H, DEPTH_W)), np.zeros((DEPTH_H, DEPTH_W)), np.zeros((DEPTH_H, DEPTH_W))
    n, fov = 518, 100
    f = n / 2 / np.tan(np.radians(fov / 2))
    u, v = np.meshgrid(np.arange(n) - n / 2 + 0.5, np.arange(n) - n / 2 + 0.5)
    cam_rays = np.stack([u, -v, np.full_like(u, f)], -1)
    cam_rays /= np.linalg.norm(cam_rays, axis=-1, keepdims=True)
    views = [(y, 0) for y in range(0, 360, 45)] + [(y, p) for p in (50, -50) for y in range(0, 360, 90)]
    for yaw, pitch in views:
        cp, sp = np.cos(np.radians(pitch)), np.sin(np.radians(pitch))
        cy, sy = np.cos(np.radians(yaw)), np.sin(np.radians(yaw))
        R = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]) @ np.array([[1, 0, 0], [0, cp, sp], [0, -sp, cp]])
        w = cam_rays @ R.T
        lo, la = np.arctan2(w[..., 0], w[..., 2]), np.arcsin(np.clip(w[..., 1], -1, 1))
        view = pano[np.clip(((0.5 - la / np.pi) * (H - 1)).round().astype(int), 0, H - 1),
                    (((lo / (2 * np.pi)) + 0.5) * (W - 1)).round().astype(int) % W]
        out = []
        for model, proc in models:
            with torch.no_grad():
                pd = model(**proc(images=Image.fromarray(view), return_tensors="pt")).predicted_depth
            out.append(torch.nn.functional.interpolate(pd[None], size=(n, n), mode="bicubic")[0, 0].numpy())
        z, disp = out
        is_sky = (disp < 0.03 * max(np.percentile(disp, 95), 1e-6)).astype(float)
        c = rays @ R                                    # output rays in this view's camera frame
        cz = np.maximum(c[..., 2], 1e-3)
        px, py = f * c[..., 0] / cz + n / 2 - 0.5, -f * c[..., 1] / cz + n / 2 - 0.5
        ok = (c[..., 2] > 0.2) & (px >= 0) & (px <= n - 1) & (py >= 0) & (py <= n - 1)
        iy, ix = np.clip(py.round().astype(int), 0, n - 1), np.clip(px.round().astype(int), 0, n - 1)
        wt = np.where(ok, np.clip(c[..., 2], 0, 1) ** 8, 0)
        acc += wt * np.log(np.maximum(z[iy, ix] / cz, 0.1))    # z-depth -> range along the ray
        skyacc += wt * is_sky[iy, ix]
        wsum += wt
    wsum = np.maximum(wsum, 1e-9)
    return np.exp(acc / wsum), skyacc / wsum > 0.5, rays, LAT


def depth(a):
    """Per-panorama depth: the real street as 3D, from the photo itself.

    The model's metric scale is off for 360° crops, so range is rescaled until the ground in
    front of the camera lies CAMERA_HEIGHT_M below it, and ground within 25 cm of that plane is
    snapped onto it (the walker's feet stand on it in walk.html). Sky gets SKY_DEPTH_M; the
    capture rig below RIG_LAT_DEG and KartaView's blue fill are marked as no data."""
    from transformers import AutoImageProcessor, AutoModelForDepthEstimation
    import torch

    torch.set_num_threads(os.cpu_count() or 4)
    src = pathlib.Path(a.data) / a.name
    out = src / "depth"
    out.mkdir(exist_ok=True)
    tf = local_tf(json.loads((pathlib.Path(a.out) / a.name / "manifest.json").read_text()))
    models = [(AutoModelForDepthEstimation.from_pretrained(m).eval(), AutoImageProcessor.from_pretrained(m))
              for m in (DEPTH_MODEL, SKY_MODEL)]
    todo = [p for p in load_panos(src, tf) if not (out / f"{p['id']}.png").exists()]
    for i, p in enumerate(todo, 1):
        pano = np.asarray(Image.open(p["file"]).convert("RGB").resize((4096, 2048)))
        rng, sky, rays, LAT = pano_depth(pano, models)
        img = np.asarray(Image.fromarray(pano).resize((DEPTH_W, DEPTH_H))).astype(float)
        mx = img.max(-1)
        up = LAT > np.radians(3)
        rig = ~up & ((LAT < np.radians(RIG_LAT_DEG)) | (mx < 10) | ((img[..., 2] > img[..., 0] + 40) & (LAT < np.radians(-30))))
        y = rays[..., 1] * rng
        band = (LAT < np.radians(-20)) & (LAT > np.radians(RIG_LAT_DEG)) & ~rig
        scale = float(np.clip(CAMERA_HEIGHT_M / max(-np.median(y[band]), 1e-3), 0.15, 1.5)) if band.any() else 1.0
        rng = rng * scale
        y = rays[..., 1] * rng
        sky = (sky & up) | (up & (mx < 10))      # KartaView leaves the zenith black
        to_ground = np.where(rays[..., 1] < -0.05, -CAMERA_HEIGHT_M / np.minimum(rays[..., 1], -0.05), np.inf)
        ground = (rays[..., 1] < -0.05) & (np.abs(y + CAMERA_HEIGHT_M) < 0.25)
        rng = np.where(ground, to_ground, rng)
        rng = np.where(sky, SKY_DEPTH_M, rng)
        cls = np.where(rig, 2, np.where(sky, 1, 0))
        tmp = out / f"{p['id']}.part"         # renamed when complete: an interrupted run never leaves half a file
        Image.fromarray(encode_depth(rng, cls)).save(tmp, format="PNG", optimize=True)
        tmp.rename(out / f"{p['id']}.png")
        print(f"{i}/{len(todo)} {p['id']}: scale {scale:.2f}, median range "
              f"{np.median(rng[cls == 0]):.1f} m, sky {sky.mean():.0%}", flush=True)


def sample_equirect(img, cam, heading, pts):
    """Colours seen from `cam` (x, y, z metres) looking at world points `pts` (N x 3).

    The panorama's centre column faces the capture heading (degrees clockwise from north);
    rows run from +90° pitch at the top to -90° at the bottom. Returns colours and a mask of
    samples that landed on real pixels (KartaView leaves the poles black)."""
    h, w, _ = img.shape
    v = pts - cam
    az = np.degrees(np.arctan2(v[:, 0], v[:, 1]))            # clockwise from north
    rel = (az - heading + 180.0) % 360.0 - 180.0             # -180..180, 0 = heading
    pitch = np.degrees(np.arctan2(v[:, 2], np.hypot(v[:, 0], v[:, 1])))
    col = ((rel / 360.0) + 0.5) * (w - 1)
    row = (0.5 - pitch / 180.0) * (h - 1)
    c0, r0 = np.floor(col).astype(int), np.floor(row).astype(int)
    fc, fr = (col - c0)[:, None], (row - r0)[:, None]
    c1, r1 = (c0 + 1) % w, np.clip(r0 + 1, 0, h - 1)
    c0, r0 = c0 % w, np.clip(r0, 0, h - 1)
    px = (img[r0, c0] * (1 - fc) * (1 - fr) + img[r0, c1] * fc * (1 - fr)
          + img[r1, c0] * (1 - fc) * fr + img[r1, c1] * fc * fr)
    valid = px.max(axis=1) > 8                                # black band = no data
    return px.astype(np.uint8), valid


def credit(sources):
    return f"{', '.join(sorted(sources))} (CC BY-SA 4.0)"


def facades(a):
    out = pathlib.Path(a.out) / a.name
    src = pathlib.Path(a.data) / a.name
    manifest = json.loads((out / "manifest.json").read_text())
    tf = local_tf(manifest)
    panos = [p for p in load_panos(src, tf) if p["heading"] is not None
             and p["pose_quality"] not in ("uncertain", "none")]
    if not panos:
        raise SystemExit("no panoramas with a trusted pose: run harvest, download and pose first")
    pano_xy = np.array([[p["x"], p["y"]] for p in panos])

    walls, owners = [], []
    for f in sorted(glob.glob(str(out / "tiles" / "bld_*.json"))):
        d = json.load(open(f))
        ox, oy = d["origin_m"]
        for b in d["buildings"]:
            fp = np.asarray(b["footprint"]) + (ox, oy)
            walls.append(shapely.Polygon(fp))
            owners.append(b["id"])
            b["_o"] = (ox, oy)
            b["_poly"] = len(walls) - 1
    tree = shapely.STRtree(walls)

    cache, chosen = {}, []
    for f in sorted(glob.glob(str(out / "tiles" / "bld_*.json"))):
        d = json.load(open(f))
        ox, oy = d["origin_m"]
        for b in d["buildings"]:
            top = min(b["height_m"], MAX_FACADE_H_M)
            for k, e in enumerate(b["street_edges"]):
                a2 = np.array(e["a"]) + (ox, oy)
                b2 = np.array(e["b"]) + (ox, oy)
                L = e["len"]
                along = (b2 - a2) / L
                normal = np.array([along[1], -along[0]])       # outward for a CCW footprint
                mid = (a2 + b2) / 2
                best = None
                near = np.where(np.hypot(*(pano_xy - mid).T) < MAX_RANGE_M)[0]
                for i in near:
                    v = pano_xy[i] - mid
                    dist = float(np.hypot(*v))
                    if dist < 1.5:
                        continue
                    front = float(np.dot(v / dist, normal))
                    if front < MIN_FRONTALITY:
                        continue
                    sight = shapely.LineString([pano_xy[i], mid + normal * 0.3])
                    hits = [j for j in tree.query(sight, predicate="intersects")
                            if owners[j] != b["id"]]
                    if hits:
                        continue
                    score = dist / front * (1.0 if panos[i]["pose_quality"].startswith("sfm") else 2.0)
                    if best is None or score < best[0]:
                        best = (score, i, dist, front)
                if best is None:
                    continue
                _, i, dist, front = best
                p = panos[i]
                if p["id"] not in cache:
                    cache.clear()  # keep one 250 MB panorama in memory at a time
                    cache[p["id"]] = np.asarray(Image.open(p["file"]).convert("RGB"), dtype=np.float32)
                img = cache[p["id"]]
                tw = int(min(MAX_TEX_PX, max(16, L * PX_PER_M)))
                th = int(min(MAX_TEX_PX, max(16, top * PX_PER_M)))
                u = (np.arange(tw) + 0.5) / tw * L
                hgt = top - (np.arange(th) + 0.5) / th * top          # row 0 = top of wall
                uu, hh = np.meshgrid(u, hgt)
                pts = np.column_stack([a2[0] + along[0] * uu.ravel() + normal[0] * 0.05,
                                       a2[1] + along[1] * uu.ravel() + normal[1] * 0.05,
                                       hh.ravel()])
                cam = np.array([p["x"], p["y"], CAMERA_HEIGHT_M])
                px, valid = sample_equirect(img, cam, p["heading"], pts)
                coverage = float(valid.mean())
                if coverage < 0.25:
                    continue
                rgba = np.concatenate([px, (valid * 255).astype(np.uint8)[:, None]], axis=1)
                name = f"{b['id']}_{k}.png"
                (out / "facades").mkdir(exist_ok=True)
                Image.fromarray(rgba.reshape(th, tw, 4), "RGBA").save(out / "facades" / name, optimize=True)
                chosen.append({"building": b["id"], "edge": k, "a": a2.round(2).tolist(),
                               "b": b2.round(2).tolist(), "height_m": round(top, 2),
                               "file": f"facades/{name}", "pano": p["id"], "source": p["source"], "shot": p["shot"],
                               "distance_m": round(dist, 1), "frontality": round(front, 2),
                               "coverage": round(coverage, 2)})
    (out / "facades.json").write_text(json.dumps(
        {"source": credit({c["source"] for c in chosen}), "camera_height_m": CAMERA_HEIGHT_M,
         "facades": chosen}, indent=1))
    total = sum(len(json.load(open(f))["buildings"]) for f in glob.glob(str(out / "tiles" / "bld_*.json")))
    print(f"{len(chosen)} photo facades from {len(panos)} panoramas "
          f"({len({c['building'] for c in chosen})} of {total} buildings)")


def equirect_px(cam, heading, pts, w, h):
    """Pixel (col, row) of world points `pts` in a w x h panorama; inverse of sample_equirect."""
    v = pts - cam
    rel = (np.degrees(np.arctan2(v[:, 0], v[:, 1])) - heading + 180.0) % 360.0 - 180.0
    pitch = np.degrees(np.arctan2(v[:, 2], np.hypot(v[:, 0], v[:, 1])))
    return np.column_stack([((rel / 360.0) + 0.5) * (w - 1), (0.5 - pitch / 180.0) * (h - 1)])


def check(a):
    """Visual check of pose against the block model.

    check/<pano>.jpg: the panorama with every visible wall within MAX_RANGE_M drawn over it
    (yellow = foot of the wall, red = MAX_FACADE_H_M or the roof, cyan = corners). With a right
    pose the yellow line sits where the wall meets the pavement and cyan lines on building corners.
    facades_sheet.jpg: the facade textures `facades` produced, to see whether they look frontal."""
    out = pathlib.Path(a.out) / a.name
    src = pathlib.Path(a.data) / a.name
    tf = local_tf(json.loads((out / "manifest.json").read_text()))
    panos = {str(p["id"]): p for p in load_panos(src, tf) if p["heading"] is not None}
    polys, owners = [], []
    for f in sorted(glob.glob(str(out / "tiles" / "bld_*.json"))):
        d = json.load(open(f))
        for b in d["buildings"]:
            polys.append(np.asarray(b["footprint"]) + d["origin_m"])
            owners.append(b["height_m"])
    tree = shapely.STRtree([shapely.Polygon(fp) for fp in polys])
    fac = json.loads((out / "facades.json").read_text())["facades"] if (out / "facades.json").exists() else []
    if a.ids:
        ids = a.ids.split(",")
    else:   # the panoramas that textured the most facades
        used = {}
        for c in fac:
            used[str(c["pano"])] = used.get(str(c["pano"]), 0) + 1
        ids = sorted(used, key=used.get, reverse=True)[:a.count] or list(panos)[:a.count]
    (out / "check").mkdir(exist_ok=True)
    for pid in ids:
        p = panos.get(pid)
        if p is None:
            continue
        im = Image.open(p["file"]).convert("RGB").resize((4096, 2048))
        dr = ImageDraw.Draw(im)
        cam = np.array([p["x"], p["y"], CAMERA_HEIGHT_M])
        for j in tree.query(shapely.Point(cam[:2]).buffer(MAX_RANGE_M)):
            fp, top = polys[j], min(owners[j], MAX_FACADE_H_M)
            for q0, q1 in zip(fp[:-1], fp[1:]):
                mid = (q0 + q1) / 2
                sight = shapely.LineString([cam[:2], mid + (cam[:2] - mid) / max(np.hypot(*(cam[:2] - mid)), 1e-6) * 0.3])
                if any(k != j for k in tree.query(sight, predicate="intersects")):
                    continue    # hidden behind another building
                t = np.linspace(0, 1, 40)[:, None]
                line = q0 + (q1 - q0) * t
                for z, col in ((0.0, (255, 230, 0)), (top, (255, 40, 40))):
                    px = equirect_px(cam, p["heading"], np.column_stack([line, np.full(len(t), z)]), *im.size)
                    for u, v in zip(px[:-1], px[1:]):
                        if abs(u[0] - v[0]) < im.size[0] / 2:           # skip the seam wrap
                            dr.line([tuple(u), tuple(v)], fill=col, width=3)
                px = equirect_px(cam, p["heading"], np.array([[*q0, 0.0], [*q0, top]]), *im.size)
                dr.line([tuple(px[0]), tuple(px[1])], fill=(0, 230, 255), width=3)
        dr.text((12, 12), f"{p['source']} {pid} pose {p['pose_quality']} heading {p['heading']:.1f}",
                fill=(255, 255, 255))
        im.save(out / "check" / f"{pid}.jpg", quality=85)
        print(f"check/{pid}.jpg", flush=True)
    if fac:
        cell, cols = 256, 8
        shown = fac[:cols * 8]
        sheet = Image.new("RGB", (cols * cell, -(-len(shown) // cols) * cell), (40, 40, 40))
        for i, c in enumerate(shown):
            t = Image.open(out / c["file"]).convert("RGBA")
            t.thumbnail((cell - 8, cell - 24))
            sheet.paste(t, (i % cols * cell + 4, i // cols * cell + 20), t)
            ImageDraw.Draw(sheet).text((i % cols * cell + 4, i // cols * cell + 4),
                                       f"{c['pano']} {c['distance_m']} m", fill=(255, 255, 255))
        sheet.save(out / "facades_sheet.jpg", quality=85)
        print(f"facades_sheet.jpg: {len(shown)} of {len(fac)} facades")


def tour(a):
    """A run through the given captures, along the road network between them -> <site>/tour.json.

    viewer/walk.html#tour follows it (and #record steps it frame by frame for a video). Between
    two captures the path is the shortest one over the road centrelines, so it never cuts through
    a block; at each capture it passes through the exact spot the photo was taken from."""
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import dijkstra

    src = pathlib.Path(a.data) / a.name
    site = pathlib.Path(a.site)
    tf = local_tf(json.loads((pathlib.Path(a.out) / a.name / "manifest.json").read_text()))
    panos = {str(p["id"]): p for p in json.loads((site / "panos.json").read_text())["panos"]}
    stops = [panos[i] for i in a.ids.split(",")]
    if a.montage:      # one scene per capture, the camera at the real lens; runs alternate away / toward it
        import duckdb

        named, names = [], []         # street name for the caption: the nearest named road within 12 m
        for n, w in duckdb.sql(f"SELECT name, wkb FROM '{src / 'roads.parquet'}' "
                               "WHERE subtype = 'road' AND name IS NOT NULL").fetchall():
            g = shapely.from_wkb(bytes(w))
            named.append(shapely.transform(g, lambda xy: np.column_stack(tf.transform(xy[:, 0], xy[:, 1]))))
            names.append(n)
        ntree = shapely.STRtree(named)
        def street(s_):
            pt = shapely.Point(s_["x"], s_["y"])
            k = ntree.nearest(pt)
            return names[k] if named[k].distance(pt) < 12 else None
        scenes = [{"pano": s_["id"], "dir": "away" if k % 2 == 0 else "toward", "street": street(s_)}
                  for k, s_ in enumerate(stops)]
        (site / "tour.json").write_text(json.dumps({"scenes": scenes}))
        print(f"montage of {len(scenes)} captures -> {site / 'tour.json'}")
        return
    # graph over road vertices (0.1 m grid joins segments that share an end)
    key, xy, edges = {}, [], []
    def node(x, y):
        k = (round(x * 10), round(y * 10))
        if k not in key:
            key[k] = len(xy)
            xy.append((x, y))
        return key[k]
    lines = road_lines(src, tf)
    for line, _, _ in lines:
        c = np.asarray(line.coords)
        for p0, p1 in zip(c[:-1], c[1:]):
            edges.append((node(*p0), node(*p1), float(np.hypot(*(p1 - p0)))))
    # each stop joins the graph at its foot on the nearest road
    tree = shapely.STRtree([l[0] for l in lines])
    feet = []
    for s_ in stops:
        pt = shapely.Point(s_["x"], s_["y"])
        line = lines[tree.nearest(pt)][0]
        d = line.project(pt)
        c = np.asarray(line.coords)
        cum = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(c, axis=0).T))])
        k = min(int(np.searchsorted(cum, d, side="right")) - 1, len(c) - 2)
        f = line.interpolate(d)
        fn = node(f.x, f.y)
        for end in (k, k + 1):
            edges.append((fn, node(*c[end]), float(np.hypot(c[end][0] - f.x, c[end][1] - f.y))))
        feet.append(fn)
    n = len(xy)
    i, j, w = map(np.array, zip(*edges))
    g = coo_matrix((np.r_[w, w] + 1e-6, (np.r_[i, j], np.r_[j, i])), shape=(n, n)).tocsr()
    path = [(stops[0]["x"], stops[0]["y"])]
    for s0, s1, f0, f1 in zip(stops[:-1], stops[1:], feet[:-1], feet[1:]):
        dist, prev = dijkstra(g, indices=f0, return_predecessors=True)
        if not np.isfinite(dist[f1]):
            raise SystemExit(f"no road path from {s0['id']} to {s1['id']}")
        seq, v = [], f1
        while v != f0 and v >= 0:
            seq.append(v)
            v = prev[v]
        seq.append(f0)
        path += [xy[v] for v in reversed(seq)] + [(s1["x"], s1["y"])]
    # drop repeats, then round the corners (Chaikin) so the run turns like a person, not a robot
    pts = [path[0]]
    for q in path[1:]:
        if math.hypot(q[0] - pts[-1][0], q[1] - pts[-1][1]) > 0.3:
            pts.append(q)
    pts = np.array(pts)
    for _ in range(2):
        q = 0.75 * pts[:-1] + 0.25 * pts[1:]
        r = 0.25 * pts[:-1] + 0.75 * pts[1:]
        pts = np.vstack([pts[:1], np.column_stack([q, r]).reshape(-1, 2), pts[-1:]])
    length = float(np.hypot(*np.diff(pts, axis=0).T).sum())
    (site / "tour.json").write_text(json.dumps({"stops": [s_["id"] for s_ in stops],
                                                "path": pts.round(2).tolist(), "length_m": round(length, 1)}))
    print(f"tour through {len(stops)} captures: {length:.0f} m, {len(pts)} points -> {site / 'tour.json'}")


def viewer(a):
    out = pathlib.Path(a.out) / a.name
    src = pathlib.Path(a.data) / a.name
    site = pathlib.Path(a.site)
    manifest = json.loads((out / "manifest.json").read_text())
    panos = load_panos(src, local_tf(manifest))
    (site / "panos").mkdir(parents=True, exist_ok=True)
    index = []
    for p in panos:
        dst = site / "panos" / f"{p['id']}.jpg"
        if not dst.exists():
            im = Image.open(p["file"]).convert("RGB")
            im.resize((a.width, a.width // 2), Image.LANCZOS).save(dst, quality=82, optimize=True)
        rec = {"id": p["id"], "x": round(p["x"], 2), "y": round(p["y"], 2),
               "heading": p["heading"] if p["heading"] is not None else 0.0,
               "pose_quality": p["pose_quality"], "shot": p["shot"], "source": p["source"],
               "file": f"panos/{p['id']}.jpg"}
        dep = src / "depth" / f"{p['id']}.png"
        if dep.exists():     # half resolution is plenty for the browser mesh; keep exact codes (no filtering)
            (site / "depth").mkdir(exist_ok=True)
            Image.fromarray(np.asarray(Image.open(dep))[::2, ::2]).save(site / "depth" / dep.name, optimize=True)
            rec["depth"] = f"depth/{dep.name}"
        index.append(rec)
    (site / "panos.json").write_text(json.dumps({"source": credit({p["source"] for p in panos}),
                                                 "camera_height_m": CAMERA_HEIGHT_M,
                                                 "panos": index}))
    fac = out / "facades.json"
    if a.facades and fac.exists():     # only once `check` shows the photos sit on the walls
        (site / "facades").mkdir(exist_ok=True)
        for c in json.loads(fac.read_text())["facades"]:
            (site / c["file"]).write_bytes((out / c["file"]).read_bytes())
        (site / "facades.json").write_text(fac.read_text())
    print(f"{len(index)} panoramas written to {site}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["harvest", "mapillary", "download", "sequences", "pose", "depth",
                                        "facades", "check", "viewer", "tour"])
    ap.add_argument("--name", required=True)
    ap.add_argument("--data", default="data")
    ap.add_argument("--out", default="out")
    ap.add_argument("--site", default="site")
    ap.add_argument("--radius", type=int, default=600, help="harvest query radius (m)")
    ap.add_argument("--width", type=int, default=4096, help="web panorama width (px)")
    ap.add_argument("--ids", help="check / tour: comma-separated panorama ids (tour: in running order)")
    ap.add_argument("--facades", action="store_true", help="viewer: ship the photo facades too")
    ap.add_argument("--montage", action="store_true", help="tour: a cut per capture instead of one run along the roads")
    ap.add_argument("--count", type=int, default=12, help="check: number of panoramas")
    a = ap.parse_args()
    {"harvest": harvest, "mapillary": mapillary, "download": download, "sequences": sequences,
     "pose": pose, "depth": depth,
     "facades": facades, "check": check, "viewer": viewer, "tour": tour}[a.command](a)


if __name__ == "__main__":
    main()
