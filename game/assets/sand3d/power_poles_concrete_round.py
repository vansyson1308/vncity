"""Cột điện bê tông ly tâm tròn: thân côn, giá đỡ sứ ở đỉnh, hộp nối và băng dán quảng cáo theo mức lộn xộn.

Millimet; +X dọc tuyến dây, +Z lên, gốc ở tâm chân cột. Biến thể n = mức lộn xộn 0-3.
"""
import sand3d as s3d

SLOT = "power_poles/concrete_round"


def build(variant=0, h=8500, d_base=350, d_top=190):
    pole = s3d.cone("pole", d_base, h, d2=d_top)
    s3d.material(pole, "concrete", color="#a9a59c")
    metal = top_fittings(h, d_top)
    if variant >= 1:
        metal.append(junction_box(z=2600, r=d_base / 2 - 20))
    if variant >= 3:
        metal.append(junction_box(z=1700, r=d_base / 2 - 15))
    s3d.material(metal, "painted_metal", color="#5b5f63")
    stickers = sticker_bands(variant, d_base, d_top, h)
    return s3d.group(f"concrete_round_v{variant}", pole, *metal, *stickers)


def top_fittings(h, d_top):
    collar = s3d.at(s3d.cylinder("collar", d_top + 30, 120), z=h - 600)
    insulators = [s3d.at(s3d.cylinder("insulator", 60, 140), x=sx * 60, z=h) for sx in (-1, 1)]
    return [collar, *insulators]


def junction_box(z, r, w=240, depth=80, h=340):
    return s3d.at(s3d.box("junction_box", w, depth, h), y=r + depth / 2, z=z)


def sticker_bands(variant, d_base, d_top, h):
    bands = []
    for k in range(variant):
        z = 1200 + 450 * k
        d = d_base - (d_base - d_top) * z / h + 4
        bands.append(s3d.at(s3d.cylinder("sticker_band", d, 160), z=z))
    if bands:
        s3d.material(bands, "plastic", color="#f2e6b8")
    return bands
