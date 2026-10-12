"""Check landmark coordinates in game/content/world/landmarks.json against real data.

For every landmark, look for Overture places and named buildings within --radius metres whose
name matches the landmark's Vietnamese name, and report the distance to the best match.
With --fix, coordinates are replaced by the matched feature (building centroid preferred,
it is where the hero asset goes) and the `coords_unverified` tag is dropped; the matched
Overture ids go into `overture_ids` so the city build can swap the procedural mass for the
hand-made asset.

Usage:
  python -m pipeline.verify_landmarks [--radius 700] [--fix]
"""

import argparse
import json
import math
import pathlib
import re
import unicodedata

from fetch import bbox_filter, connect, overture

ROOT = pathlib.Path(__file__).resolve().parent.parent
LANDMARKS = ROOT / "game" / "content" / "world" / "landmarks.json"
AREA_KINDS = {"lake", "bridge", "street", "park"}
STOP = {"ha", "noi", "hanoi", "the", "of", "and", "pho", "duong", "khu", "di", "tich", "quoc", "gia"}


def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower()).replace("đ", "d")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9 ]+", " ", s).split()


def score(a, b):
    ta, tb = set(norm(a)) - STOP, set(norm(b)) - STOP
    if not ta or not tb:
        return 0.0
    common = len(ta & tb)
    return min(common / len(ta), common / len(tb))  # both names must be mostly the same words


def dist_m(lat1, lon1, lat2, lon2):
    k = 111_320.0
    return math.hypot((lat2 - lat1) * k, (lon2 - lon1) * k * math.cos(math.radians(lat1)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--radius", type=float, default=700.0)
    ap.add_argument("--min-score", type=float, default=0.6)
    ap.add_argument("--fix", action="store_true")
    ap.add_argument("--max-fix", type=float, default=300.0, help="never move a landmark further than this (m)")
    a = ap.parse_args()
    doc = json.loads(LANDMARKS.read_text(encoding="utf-8"))
    items = doc["items"]
    pad = a.radius / 111_000
    w = min(i["location"]["lon"] for i in items) - pad
    e = max(i["location"]["lon"] for i in items) + pad
    s = min(i["location"]["lat"] for i in items) - pad
    n = max(i["location"]["lat"] for i in items) + pad

    con = connect()
    feats = []
    for kind, theme, typ in (("place", "places", "place"), ("building", "buildings", "building")):
        rows = con.sql(f"""SELECT id, names.primary, ST_Y(ST_Centroid(geometry)), ST_X(ST_Centroid(geometry))
                           FROM {overture(theme, typ)}
                           WHERE {bbox_filter(w, s, e, n)} AND names.primary IS NOT NULL""").fetchall()
        feats += [(kind, *r) for r in rows]
    print(f"{len(feats):,} named features in the landmark bbox")

    report, fixed = [], 0
    for lm in items:
        lat, lon = lm["location"]["lat"], lm["location"]["lon"]
        names = [lm["name"]["vi"]] + ([lm["name"]["en"]] if lm["name"].get("en") else [])
        best = None
        for kind, fid, fname, flat, flon in feats:
            d = dist_m(lat, lon, flat, flon)
            if d > a.radius:
                continue
            sc = max(score(nm, fname) for nm in names)
            if sc < a.min_score:
                continue
            key = (sc, kind == "building", -d)
            if best is None or key > best[0]:
                best = (key, kind, fid, fname, flat, flon, d)
        row = {"id": lm["id"], "name": lm["name"]["vi"]}
        if best:
            _, kind, fid, fname, flat, flon, d = best
            row.update(match=fname, kind=kind, overture_id=fid, offset_m=round(d))
            # Area landmarks (lakes, bridges, streets, parks) keep their hand-picked anchor.
            # Big jumps are more often a namesake (a café called after the tower) than a fix.
            if a.fix and lm["kind"] not in AREA_KINDS and d <= a.max_fix:
                lm["location"] = {"lat": round(flat, 6), "lon": round(flon, 6)}
                lm["tags"] = [t for t in lm.get("tags", []) if t != "coords_unverified"] + ["coords_verified_overture"]
                if kind == "building":
                    lm["overture_ids"] = sorted(set(lm.get("overture_ids", [])) | {fid})
                fixed += 1
        else:
            row["match"] = None
        report.append(row)
        print(f"{row['id']:<28} {('%5d m' % row['offset_m']) if best else '   no match':>8}  {row.get('match')}")

    out = ROOT / "out" / "landmarks_check.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(report, indent=1, ensure_ascii=False))
    if a.fix:
        LANDMARKS.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"fixed {fixed}/{len(items)} landmarks")


if __name__ == "__main__":
    main()
