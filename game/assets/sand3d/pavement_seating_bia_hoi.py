"""Bàn bia hơi: bàn nhựa thấp, ghế nhựa đỏ, cốc bia và xô đá.

Millimet; +X 'forward', +Z lên, gốc ở tâm đáy. Biến thể n = cách xếp ghế và số cốc.
"""
import math

import sand3d as s3d

SLOT = "pavement_seating/bia_hoi"


def build(variant=0):
    table, top_z = plastic_table()
    n = 4 + variant % 2
    stools = []
    for k in range(n):
        a = math.radians(30 * variant + 360 * k / n)
        stools.append(s3d.at(stool(), x=640 * math.cos(a), y=640 * math.sin(a), rz=math.degrees(a)))
    glasses = [s3d.at(s3d.cylinder("beer_glass", 75, 120), x=150 * math.cos(math.radians(72 * i)),
                      y=150 * math.sin(math.radians(72 * i)), z=top_z) for i in range(2 + variant)]
    bucket = s3d.at(s3d.cone("ice_bucket", 200, 180, d2=240), x=-180, y=-150, z=top_z)
    s3d.material([*glasses, bucket], "glass", color="#e8b34a")
    return s3d.group(f"bia_hoi_v{variant}", table, bucket, *glasses, *stools)


def plastic_table(w=600, h=420, t=25, leg=35):
    top = s3d.at(s3d.box("table_top", w, w, t), z=h - t)
    legs = [s3d.at(s3d.box("table_leg", leg, leg, h - t), x=sx * (w / 2 - 40), y=sy * (w / 2 - 40))
            for sx in (-1, 1) for sy in (-1, 1)]
    s3d.material([top, *legs], "plastic", color="#1f5fae")
    return s3d.group("table", top, *legs), h


def stool(w=280, h=250, seat_t=22, leg=30):
    seat = s3d.at(s3d.box("stool_seat", w, w, seat_t), z=h - seat_t)
    legs = [s3d.at(s3d.box("stool_leg", leg, leg, h - seat_t), x=sx * (w / 2 - 28), y=sy * (w / 2 - 28))
            for sx in (-1, 1) for sy in (-1, 1)]
    s3d.material([seat, *legs], "plastic", color="#c4161c")
    return s3d.group("stool", seat, *legs)
