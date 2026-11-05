"""Mái bạt che nắng trước cửa hàng: tấm bạt dốc ra phố, diềm rủ ở mép, hai tay đỡ thép, thanh treo
trên tường.

Millimet; gốc ở giữa mép trên sát tường (theo hợp đồng), +X ra khỏi tường, +Z lên, bạt rộng 4 m dọc Y
(engine chỉ co giãn Y theo bề ngang mặt tiền). Biến thể n = màu bạt.
"""
import math

import sand3d as s3d

SLOT = "awnings/canvas"
COLOURS = ["#1f5fae", "#c4161c", "#2e8b57", "#e67e22", "#3b7dd8", "#a3241f"]


def build(variant=0, length=1650, width=4000, slope=25, flap=250, t=15):
    a = math.radians(slope)
    reach, drop = length * math.cos(a), length * math.sin(a)
    sheet = s3d.at(s3d.box("canvas", length, width, t), x=reach / 2, z=-drop / 2, ry=slope)
    valance = s3d.at(s3d.box("valance", t, width, flap), x=reach, z=-drop - flap)
    s3d.material([sheet, valance], "fabric", color=COLOURS[variant % len(COLOURS)])
    bar = s3d.at(s3d.box("wall_bar", 60, width, 60), x=30, z=-90)
    arms = [s3d.wire("arm", [(30, y, -80), (reach - 20, y, -drop - 20)], 30) for y in (-(width / 2 - 100), width / 2 - 100)]
    s3d.material([bar, *arms], "painted_metal", color="#4a4d50")
    return s3d.group(f"awning_canvas_v{variant}", sheet, valance, bar, *arms)
