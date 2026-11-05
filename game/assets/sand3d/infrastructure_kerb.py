"""Đoạn bó vỉa đá granite dài 1 m.

Millimet; +X hướng ra đường, +Z lên, gốc ở tâm đáy.
"""
import sand3d as s3d

SLOT = "infrastructure/kerb"


def build(variant=0, w=200, length=1000, h=200):
    kerb = s3d.box("kerb", w, length, h)
    s3d.fillet(kerb, 15, edges="top")
    s3d.material(kerb, "concrete", color="#7d7b78")
    return s3d.group("kerb_segment", kerb)
