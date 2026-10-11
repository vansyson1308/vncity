"""Real street-level appearance from open 360° imagery (KartaView, CC BY-SA 4.0).

  harvest   list every KartaView photo in the area (metadata only)
  download  fetch the equirectangular 360° panoramas (faces and plates already blurred by KartaView)
  sequences fetch each capture's full sequence (travel direction comes from its neighbours)
  pose      correct phone-GPS poses: snap each capture to its lane; heading from travel direction,
            the recorded compass, or where the sky shows against the block model
  facades   project panoramas onto the street-facing walls built by build.py -> photo facade textures
  viewer    write web-sized panoramas + index for viewer/walk.html's real-photo mode

Usage:
  python streetview.py harvest  --name caugiay
  python streetview.py download --name caugiay
  python streetview.py sequences --name caugiay
  python streetview.py pose     --name caugiay
  python streetview.py facades  --name caugiay
  python streetview.py viewer   --name caugiay --site site/caugiay
"""

import argparse
import glob
import json
import math
import pathlib
import sys
import time
import urllib.parse
import urllib.request

import numpy as np
import pyproj
import shapely
from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build import ROAD_WIDTH  # noqa: E402  (same width table as the road meshes)

Image.MAX_IMAGE_PIXELS = 200_000_000  # KartaView panoramas are 13000 x 6500
API = "https://api.openstreetcam.org"
STORAGE = "https://{storage}.openstreetcam.org/files/photo/{path}"
UA = {"User-Agent": "vncity/0.1 (github.com/vansyson1308/vncity)"}

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


def get_json(url, data=None, tries=4):
    for i in range(tries):
        try:
            body = urllib.parse.urlencode(data).encode() if data else None
            req = urllib.request.Request(url, data=body, headers=UA)
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(2 ** (i + 1))


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
    photos = json.loads((src / "kartaview.json").read_text())
    pano_dir = src / "panos"
    pano_dir.mkdir(exist_ok=True)
    todo = [p for p in photos if p["projection"] == "SPHERE"]
    for i, p in enumerate(todo, 1):
        dst = pano_dir / f"{p['id']}.jpg"
        if dst.exists():
            continue
        storage, path = p["name"].split("/files/photo/")
        url = STORAGE.format(storage=storage, path=path.replace("/proc/", "/wrapped_proc/"))
        fetch_file(url, dst)
        print(f"{i}/{len(todo)} {dst.name}", flush=True)


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


def local_tf(manifest):
    crs = pyproj.CRS.from_proj4(manifest["georeference"]["projection"])
    return pyproj.Transformer.from_crs("EPSG:4326", crs, always_xy=True)


def load_panos(src, tf, recorded=False):
    """Downloaded panoramas in local metres; corrected poses from `pose` unless `recorded`."""
    poses = {}
    pose_file = src / "pano_poses.json"
    if not recorded and pose_file.exists():
        poses = {p["id"]: p for p in json.loads(pose_file.read_text())["poses"]}
    panos = []
    for p in json.loads((src / "kartaview.json").read_text()):
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
                      "shot": p["shot_date"], "file": f, "sequence": p["sequence_id"]})
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
    for p in load_panos(src, tf, recorded=True):
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
                    score = dist / front
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
                               "file": f"facades/{name}", "pano": p["id"], "shot": p["shot"],
                               "distance_m": round(dist, 1), "frontality": round(front, 2),
                               "coverage": round(coverage, 2)})
    (out / "facades.json").write_text(json.dumps(
        {"source": "KartaView (CC BY-SA 4.0)", "camera_height_m": CAMERA_HEIGHT_M,
         "facades": chosen}, indent=1))
    total = sum(len(json.load(open(f))["buildings"]) for f in glob.glob(str(out / "tiles" / "bld_*.json")))
    print(f"{len(chosen)} photo facades from {len(panos)} panoramas "
          f"({len({c['building'] for c in chosen})} of {total} buildings)")


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
        index.append({"id": p["id"], "x": round(p["x"], 2), "y": round(p["y"], 2),
                      "heading": p["heading"] if p["heading"] is not None else 0.0,
                      "pose_quality": p["pose_quality"], "shot": p["shot"],
                      "file": f"panos/{p['id']}.jpg"})
    (site / "panos.json").write_text(json.dumps({"source": "KartaView (CC BY-SA 4.0)",
                                                 "camera_height_m": CAMERA_HEIGHT_M,
                                                 "panos": index}))
    fac = out / "facades.json"
    if fac.exists():
        (site / "facades").mkdir(exist_ok=True)
        for c in json.loads(fac.read_text())["facades"]:
            (site / c["file"]).write_bytes((out / c["file"]).read_bytes())
        (site / "facades.json").write_text(fac.read_text())
    print(f"{len(index)} panoramas written to {site}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["harvest", "download", "sequences", "pose", "facades", "viewer"])
    ap.add_argument("--name", required=True)
    ap.add_argument("--data", default="data")
    ap.add_argument("--out", default="out")
    ap.add_argument("--site", default="site")
    ap.add_argument("--radius", type=int, default=600, help="harvest query radius (m)")
    ap.add_argument("--width", type=int, default=4096, help="web panorama width (px)")
    a = ap.parse_args()
    {"harvest": harvest, "download": download, "sequences": sequences, "pose": pose,
     "facades": facades, "viewer": viewer}[a.command](a)


if __name__ == "__main__":
    main()
