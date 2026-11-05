"""Cổng ngõ: hai trụ xây, xà ngang, biển tên ngõ trên mặt nhìn ra phố (chữ do engine vẽ).

Millimet; +X hướng ra phố, +Z lên, gốc ở tâm đáy.
"""
import sand3d as s3d

SLOT = "infrastructure/gate"


def build(variant=0, width=3000, h=3500, pillar=400, beam_h=500, depth=500):
    pillars = [s3d.at(s3d.box("pillar", pillar, pillar, h - beam_h), y=sy * (width - pillar) / 2) for sy in (-1, 1)]
    beam = s3d.at(s3d.box("beam", depth, width, beam_h), z=h - beam_h)
    sign = s3d.at(s3d.box("name_sign", 40, width * 0.55, beam_h * 0.7), x=depth / 2 + 20, z=h - beam_h * 0.85)
    caps = [s3d.at(s3d.box("pillar_cap", pillar + 60, pillar + 60, 60), y=sy * (width - pillar) / 2, z=h - beam_h - 60)
            for sy in (-1, 1)]
    s3d.material([*pillars, beam, sign, *caps], "concrete", color="#d8c89a")
    return s3d.group("alley_gate", *pillars, beam, sign, *caps)
