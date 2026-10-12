"""Package a built area for the browser viewer in viewer/index.html.

The viewer runs on hosts that only serve common web types and only let the page fetch its
own files, so each .glb tile ships as base64 text (tiles/<name>.glb.txt) that the page
decodes and hands to GLTFLoader.parseAsync.

Usage:
  python package_viewer.py --name caugiay [--overview out/hanoi/preview.png]
  python -m http.server -d site/caugiay   # map: /index.html, third-person walk: /walk.html
"""

import argparse
import base64
import pathlib
import shutil

HERE = pathlib.Path(__file__).parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--out", default="out")
    ap.add_argument("--site", default="site")
    ap.add_argument("--overview", help="PNG shown as the city-wide figure (hanoi_preview.png)")
    a = ap.parse_args()

    src = pathlib.Path(a.out) / a.name
    dst = pathlib.Path(a.site) / a.name
    if dst.exists():
        shutil.rmtree(dst)
    (dst / "tiles").mkdir(parents=True)
    shutil.copy(HERE / "viewer" / "index.html", dst / "index.html")
    shutil.copy(HERE / "viewer" / "walk.html", dst / "walk.html")
    shutil.copy(src / "manifest.json", dst / "manifest.json")
    for f in sorted((src / "tiles").iterdir()):
        if f.suffix == ".json":
            shutil.copy(f, dst / "tiles" / f.name)
        elif f.suffix == ".glb":
            (dst / "tiles" / f"{f.name}.txt").write_text(base64.b64encode(f.read_bytes()).decode())
    # the walker: Rocketbox avatar (MIT), shipped as base64 like the tiles
    (dst / "models").mkdir()
    (dst / "models" / "walker.glb.txt").write_text(base64.b64encode((HERE / "viewer" / "assets" / "walker.glb").read_bytes()).decode())
    shutil.copy(HERE / "viewer" / "assets" / "ROCKETBOX_LICENSE.md", dst / "models" / "ROCKETBOX_LICENSE.md")
    if a.overview:
        shutil.copy(a.overview, dst / "hanoi_preview.png")
    print(f"viewer written to {dst}")


if __name__ == "__main__":
    main()
