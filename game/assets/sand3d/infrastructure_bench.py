"""Ghế đá công viên, vỉa hè: mặt ghế đá mài trên hai chân đá.

Millimet; +X hướng ra đường, +Z lên, gốc ở tâm đáy.
"""
import sand3d as s3d

SLOT = "infrastructure/bench"


def build(variant=0, w=500, length=1600, h=450, t=80):
    seat = s3d.at(s3d.box("seat", w, length, t), z=h - t)
    s3d.fillet(seat, 10, edges="top")
    feet = [s3d.at(s3d.box("foot", w - 100, 120, h - t), y=sy * (length / 2 - 200)) for sy in (-1, 1)]
    s3d.material([seat, *feet], "concrete", color="#9a968e")
    return s3d.group("bench", seat, *feet)
