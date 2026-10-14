"""Top-down check plot of the semantic layer: archetypes, street edges, scattered props, traffic.

Usage:
  python -m pipeline.preview --name hoankiem [--center lat,lon] [--radius 250] [--out preview_semantic.png]
"""

import argparse
import csv
import json
import pathlib

import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.collections import LineCollection, PolyCollection  # noqa: E402
from matplotlib.patches import Patch  # noqa: E402

from build import local_projection  # noqa: E402

ARCHETYPE_COLOR = {
    "nha_ong_pho_co": "#c9733a", "nha_ong_hien_dai": "#e3b04b", "biet_thu_phap": "#f2d16b",
    "cong_trinh_phap_cong": "#d9a441", "khu_tap_the": "#8fa6a0", "chung_cu_cao_tang": "#5b7f95",
    "van_phong_cao_tang": "#3f5e7a", "lien_ke_kdt": "#b9a48b", "dinh_chua": "#a8322d", "cho": "#7a4f9a",
    "cong_trinh_cong_cong": "#6c8e5a", "nha_xuong": "#6e6e6e", "nha_thap_tang": "#c8bfae",
}
PROPS = [("street_trees", "#2e7d32", 6, "o"), ("power_poles", "#222222", 3, "s"),
         ("shop_signs", "#e53935", 5, "^"), ("parked_motorbikes", "#1e88e5", 0.6, "."),
         ("pavement_seating", "#fb8c00", 4, "o"), ("street_vendors", "#8e24aa", 12, "*"),
         ("street_lights", "#fdd835", 4, "d")]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--data", default="data")
    ap.add_argument("--out-dir", default="out")
    ap.add_argument("--center", help="lat,lon (default: area centre)")
    ap.add_argument("--radius", type=float, default=250.0)
    ap.add_argument("--out", default="preview_semantic.png")
    a = ap.parse_args()
    out = pathlib.Path(a.out_dir) / a.name
    fetched = json.loads((pathlib.Path(a.data) / a.name / "fetch.json").read_text())
    w, s, e, n = fetched["bbox"]
    geo = json.loads((out / "manifest.json").read_text()).get("georeference", {})
    lat0, lon0 = geo.get("origin_lat", (s + n) / 2), geo.get("origin_lon", (w + e) / 2)
    _, _, tf = local_projection(lat0, lon0)  # same frame as build.py (which may use --origin)
    lat, lon = (map(float, a.center.split(",")) if a.center else ((s + n) / 2, (w + e) / 2))
    cx, cy = tf.transform(lon, lat)
    r = a.radius
    inside = lambda x, y: abs(x - cx) < r and abs(y - cy) < r  # noqa: E731

    fig, ax = plt.subplots(figsize=(14, 14), dpi=130)
    ax.set_facecolor("#ecebe6")
    graph = json.loads((out / "traffic" / "graph.json").read_text())
    segs, widths, colors = [], [], []
    for ed in graph["edges"]:
        pl = np.array(ed["polyline"])
        if not any(inside(x, y) for x, y in pl):
            continue
        segs.append(pl)
        widths.append(max(0.6, ed["width_m"] * 0.55))
        colors.append("#9e9e9e" if ed["motorbike_only"] else "#5f5f66")
    ax.add_collection(LineCollection(segs, linewidths=widths, colors=colors, capstyle="round", zorder=1))

    polys, pcols, fronts = [], [], []
    for p in sorted((out / "semantics").glob("footprints_*.json")):
        for b in json.loads(p.read_text())["buildings"]:
            o = np.array(b["outline"])
            if not inside(*o.mean(0)):
                continue
            polys.append(o)
            pcols.append(ARCHETYPE_COLOR.get(b["archetype"], "#999999"))
            fronts += [[f["a"], f["b"]] for f in b["frontage"]]
    ax.add_collection(PolyCollection(polys, facecolors=pcols, edgecolors="#00000040", linewidths=0.3, zorder=2))
    ax.add_collection(LineCollection(fronts, colors="#d81b60", linewidths=1.2, zorder=3))

    for set_, col, size, mk in PROPS:
        f = out / "pcg" / f"{set_}.csv"
        if not f.exists():
            continue
        with open(f, encoding="utf-8") as fh:
            pts = [(float(row["X"]), float(row["Y"])) for row in csv.DictReader(fh)]
        pts = np.array([p for p in pts if inside(*p)])
        if len(pts):
            ax.scatter(pts[:, 0], pts[:, 1], s=size, c=col, marker=mk, linewidths=0, zorder=4, label=set_)

    sig = np.array([(nd["x"], nd["y"]) for nd in graph["nodes"] if nd["signal"] and inside(nd["x"], nd["y"])])
    if len(sig):
        ax.scatter(sig[:, 0], sig[:, 1], s=40, facecolors="none", edgecolors="#00c853", linewidths=1.5,
                   zorder=5, label="traffic signals")

    ax.set_xlim(cx - r, cx + r)
    ax.set_ylim(cy - r, cy + r)
    ax.set_aspect("equal")
    handles = [Patch(color=c, label=k) for k, c in ARCHETYPE_COLOR.items()]
    handles.append(Patch(color="#d81b60", label="street-facing edge (shopfront)"))
    leg1 = ax.legend(handles=handles, loc="upper left", fontsize=7, title="archetype", framealpha=0.9)
    ax.add_artist(leg1)
    ax.legend(loc="lower right", fontsize=8, markerscale=2, framealpha=0.9)
    ax.set_title(f"{a.name}: semantic layer ({2 * r:.0f} m window)")
    ax.set_xlabel("east (m)")
    ax.set_ylabel("north (m)")
    fig.savefig(out / a.out, bbox_inches="tight")
    print(out / a.out)


if __name__ == "__main__":
    main()
