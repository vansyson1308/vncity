"""Cột đèn giao thông: cột thép trên đế, hộp ba đèn đỏ - vàng - xanh nhìn ra đường, mái che từng đèn,
bảng đếm ngược bên dưới.

Millimet; +X hướng ra đường (mặt đèn), +Z lên, gốc ở tâm chân cột.
"""
import sand3d as s3d

SLOT = "infrastructure/traffic_signals"
LAMPS = [("red", "#e0201b"), ("amber", "#f2a900"), ("green", "#16a34a")]


def build(variant=0, pole_h=3300, housing_h=1000):
    plate = s3d.cylinder("base_plate", 500, 30)
    pole = s3d.cylinder("pole", 140, pole_h)
    housing = s3d.at(s3d.box("housing", 300, 380, housing_h), z=pole_h)
    visors = [s3d.at(s3d.box("visor", 180, 300, 30), x=240, z=pole_h + 320 * (2 - k) + 290) for k in range(3)]
    timer = s3d.at(s3d.box("countdown", 160, 260, 220), x=70, z=pole_h - 260)
    s3d.material([plate, pole, housing, *visors, timer], "painted_metal", color="#2a2c2e")
    lamps = []
    for k, (name, colour) in enumerate(LAMPS):
        lamp = s3d.at(s3d.cylinder(f"lamp_{name}", 200, 30), x=150, z=pole_h + 320 * (2 - k) + 160, ry=90)
        s3d.material(lamp, "light", color=colour)
        lamps.append(lamp)
    return s3d.group("traffic_signals", plate, pole, housing, timer, *visors, *lamps)
