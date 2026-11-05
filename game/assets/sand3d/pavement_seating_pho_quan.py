"""Bàn ghế quán phở vỉa hè: bàn inox thấp, ghế nhựa đỏ hoặc xanh quanh bàn, lọ tương ớt, ống đũa.

Millimet; trục theo hợp đồng (asset_specs.json): +X là 'forward', +Z hướng lên, gốc ở tâm đáy.
Biến thể n = cách xếp và màu ghế.
"""
import math

import sand3d as s3d

SLOT = "pavement_seating/pho_quan"
STOOL_COLOURS = ["#c4161c", "#1f5fae", "#c4161c", "#1f5fae"]


def build(variant=0):
    table = steel_table()
    n = 4 if variant % 2 == 0 else 3
    stools = [place_stool(stool(STOOL_COLOURS[variant % 4]), k, n, start=15 * variant) for k in range(n)]
    props = table_props(table_h=450)
    return s3d.group(f"pho_quan_v{variant}", table, *stools, *props)


def place_stool(st, k, n, start, r=600):
    a = math.radians(start + 360 * k / n)
    return s3d.at(st, x=r * math.cos(a), y=r * math.sin(a), rz=math.degrees(a))


def steel_table(w=700, d=500, h=450, top_t=20, leg_d=25):
    top = s3d.at(s3d.box("table_top", w, d, top_t), z=h - top_t)
    legs = [s3d.at(s3d.cylinder("table_leg", leg_d, h - top_t), x=sx * (w / 2 - 40), y=sy * (d / 2 - 40))
            for sx in (-1, 1) for sy in (-1, 1)]
    s3d.material([top, *legs], "brushed_steel")
    return s3d.group("table", top, *legs)


def stool(colour, w=300, h=260, seat_t=25, leg=30):
    seat = s3d.at(s3d.box("stool_seat", w, w, seat_t), z=h - seat_t)
    legs = [s3d.at(s3d.box("stool_leg", leg, leg, h - seat_t), x=sx * (w / 2 - 30), y=sy * (w / 2 - 30))
            for sx in (-1, 1) for sy in (-1, 1)]
    s3d.material([seat, *legs], "plastic", color=colour)
    return s3d.group("stool", seat, *legs)


def table_props(table_h):
    bottles = [s3d.at(s3d.cylinder("bottle", 55, 170), x=-200 + 70 * i, y=120, z=table_h) for i in range(3)]
    chopsticks = s3d.at(s3d.tube("chopstick_holder", 80, 70, 140), x=120, y=120, z=table_h)
    napkins = s3d.at(s3d.box("napkin_box", 160, 90, 80), x=180, y=-120, z=table_h)
    parts = [*bottles, chopsticks, napkins]
    s3d.material(parts, "glossy_plastic", color="#e8e2d0")
    return parts
