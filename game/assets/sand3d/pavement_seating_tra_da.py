"""Ghế trà đá vỉa hè: ghế nhựa thấp quanh một băng gỗ nhỏ, phích nước trên băng.

Millimet; +X 'forward', +Z lên, gốc ở tâm đáy. Biến thể n = số ghế và màu.
"""
import math

import sand3d as s3d

SLOT = "pavement_seating/tra_da"
STOOL_COLOURS = ["#1f5fae", "#c4161c", "#2e8b57", "#1f5fae"]


def build(variant=0):
    bench, top_z = wooden_bench()
    n = 4 + variant % 2
    stools = []
    for k in range(n):
        a = math.radians(20 * variant + 360 * k / n)
        stools.append(s3d.at(stool(STOOL_COLOURS[variant % 4]), x=620 * math.cos(a), y=620 * math.sin(a),
                             rz=math.degrees(a)))
    flask = s3d.at(thermos(), x=-200, y=40 if variant % 2 else -40, z=top_z)
    return s3d.group(f"tra_da_v{variant}", bench, flask, *stools)


def wooden_bench(w=700, d=300, h=350, t=30):
    top = s3d.at(s3d.box("bench_top", w, d, t), z=h - t)
    legs = [s3d.at(s3d.box("bench_leg", t, d - 40, h - t), x=sx * (w / 2 - 50)) for sx in (-1, 1)]
    s3d.material([top, *legs], "pine")
    return s3d.group("bench", top, *legs), h


def stool(colour, w=260, h=230, seat_t=22, leg=28):
    seat = s3d.at(s3d.box("stool_seat", w, w, seat_t), z=h - seat_t)
    legs = [s3d.at(s3d.box("stool_leg", leg, leg, h - seat_t), x=sx * (w / 2 - 25), y=sy * (w / 2 - 25))
            for sx in (-1, 1) for sy in (-1, 1)]
    s3d.material([seat, *legs], "plastic", color=colour)
    return s3d.group("stool", seat, *legs)


def thermos(d=110, h=300):
    body = s3d.cylinder("thermos", d, h)
    cap = s3d.at(s3d.cylinder("thermos_cap", d * 0.6, 40), z=h)
    s3d.material([body, cap], "painted_metal", color="#d9534f")
    return s3d.group("thermos_set", body, cap)
