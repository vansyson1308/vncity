"""Gather the Rocketbox avatar and motions next to convert.html, with web-sized textures.

Usage: python tools/character/prepare.py <microsoft-rocketbox checkout> <work dir>
"""
import pathlib
import shutil
import sys

from PIL import Image

AVATAR = "Assets/Avatars/Adults/Male_Adult_09"
MOTIONS = {   # in-place clips: root drift removed ("xy"), or no root motion at all ("static")
    "m_idle_neutral_01.max.fbx": "all_animations_max_motextr_static",
    "m_walk_neutral_01.max.fbx": "all_animations_max_motextr_xy",
    "m_run_neutral_01.max.fbx": "all_animations_max_motextr_xy",
    "m_run_slow_01.max.fbx": "all_animations_max_motextr_xy",
}


def main():
    rb, work = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    work.mkdir(parents=True, exist_ok=True)
    shutil.copy(rb / AVATAR / "Export" / "Male_Adult_09.fbx", work)
    for name, folder in MOTIONS.items():
        shutil.copy(rb / "Assets" / "Animations" / folder / name, work)
    for tga in (rb / AVATAR / "Textures").glob("*.tga"):
        im = Image.open(tga).resize((1024, 1024), Image.LANCZOS)
        if "opacity" in tga.stem:
            im.save(work / f"{tga.stem}.png", optimize=True)          # hair and lashes need the alpha
        else:
            im.convert("RGB").save(work / f"{tga.stem}.jpg", quality=90)
    shutil.copy(pathlib.Path(__file__).with_name("convert.html"), work)


if __name__ == "__main__":
    main()
