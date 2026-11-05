"""Cột điện bê tông chữ H: hai chân bê tông nối bằng giằng, xà thép và sứ ở đỉnh, trạm biến áp treo
giữa hai chân ở các biến thể lộn xộn.

Millimet; +X dọc tuyến dây, +Z lên, gốc ở tâm giữa hai chân. Biến thể n = mức lộn xộn 0-3.
"""
import sand3d as s3d

SLOT = "power_poles/concrete_h"


def build(variant=0, h=8500, span=950, leg_w=380, leg_d=250):
    legs = [s3d.at(s3d.box("leg", leg_w, leg_d, h), y=sy * span / 2) for sy in (-1, 1)]
    braces = [s3d.at(s3d.box("brace", 200, span - leg_d, 150), z=z) for z in (2500, 5000, 7500)]
    s3d.material([*legs, *braces], "concrete", color="#a9a59c")
    metal = crossarm(h, span + leg_d)
    if variant >= 2:
        metal.append(s3d.at(s3d.box("transformer", 350, span - leg_d - 20, 800), z=3600))
    s3d.material(metal, "painted_metal", color="#5b5f63")
    stickers = [s3d.at(s3d.box("sticker", leg_w + 6, leg_d + 6, 180), y=sy * span / 2, z=1300 + 400 * k)
                for k in range(variant) for sy in (-1, 1)]
    if stickers:
        s3d.material(stickers, "plastic", color="#f2e6b8")
    return s3d.group(f"concrete_h_v{variant}", *legs, *braces, *metal, *stickers)


def crossarm(h, length, t=80):
    arm = s3d.at(s3d.box("crossarm", t, length, t), z=h - 300)
    insulators = [s3d.at(s3d.cylinder("insulator", 60, 140), y=y, z=h - 220) for y in (-450, 0, 450)]
    return [arm, *insulators]
