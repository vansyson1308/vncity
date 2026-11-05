"""Cột đèn đường đôi trên dải phân cách: thân thép côn, đế trang trí, hai cần cong hai phía, hai đầu LED.

Millimet; +X hướng ra lòng đường, hai cần dọc trục Y, +Z lên, gốc ở tâm chân cột.
"""
import sand3d as s3d

SLOT = "street_lights/boulevard"


def build(variant=0, h=10000, reach=1350):
    base = s3d.cylinder("base", 400, 1200)
    pole = s3d.at(s3d.cone("pole", 260, h - 1500, d2=130), z=1200)
    arms = [s3d.wire("arm", [(0, 0, h - 700), (0, sy * 500, h - 180), (0, sy * reach, h - 180)], 70, fillet=250)
            for sy in (-1, 1)]
    s3d.material([base, pole, *arms], "painted_metal", color="#7f868c")
    heads = [s3d.at(s3d.box("led_head", 200, 400, 80), y=sy * (reach - 100), z=h - 260) for sy in (-1, 1)]
    s3d.material(heads, "light", color="#fff4dc")
    return s3d.group("street_light_boulevard", base, pole, *arms, *heads)
