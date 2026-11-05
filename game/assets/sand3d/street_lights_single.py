"""Cột đèn đường một cần: thân thép côn trên đế, cần cong vươn ra lòng đường, đầu đèn LED.

Millimet; +X hướng ra lòng đường (phía cần đèn), +Z lên, gốc ở tâm chân cột.
"""
import sand3d as s3d

SLOT = "street_lights/single"


def build(variant=0, h=8000, reach=1600):
    flange = s3d.cylinder("flange", 360, 40)
    pole = s3d.cone("pole", 160, h - 300, d2=80)
    arm = s3d.wire("arm", [(0, 0, h - 400), (500, 0, h - 120), (reach, 0, h - 120)], 60, fillet=250)
    s3d.material([flange, pole, arm], "painted_metal", color="#8c9196")
    head = s3d.at(s3d.box("led_head", 500, 200, 80), x=reach - 100, z=h - 200)
    s3d.material(head, "light", color="#fff4dc")
    return s3d.group("street_light_single", flange, pole, arm, head)
