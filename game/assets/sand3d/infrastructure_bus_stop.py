"""Nhà chờ xe buýt Hà Nội: khung thép, mái phẳng, vách kính sau, ghế dài, bảng lộ trình ở một đầu.

Millimet; +X hướng ra đường, +Z lên, gốc ở tâm đáy.
"""
import sand3d as s3d

SLOT = "infrastructure/bus_stop"


def build(variant=0, depth=1600, length=4000, h=2600, post=80):
    posts = [s3d.at(s3d.box("post", post, post, h - 100), x=-depth / 2 + 150, y=sy * (length / 2 - 100))
             for sy in (-1, 0, 1)]
    roof = s3d.at(s3d.box("roof", depth, length, 100), z=h - 100)
    bench = s3d.at(s3d.box("bench", 400, 2000, 40), x=-depth / 2 + 400, z=450)
    bench_legs = [s3d.at(s3d.box("bench_leg", 300, 40, 450), x=-depth / 2 + 400, y=sy * 800) for sy in (-1, 1)]
    s3d.material([*posts, roof, bench, *bench_legs], "painted_metal", color="#3d6e9e")
    glass = s3d.at(s3d.box("back_glass", 20, length - 300, 1800), x=-depth / 2 + 150, z=400)
    s3d.material(glass, "glass")
    board = s3d.at(s3d.box("route_board", 40, 900, 1200), x=-depth / 2 + 150, y=length / 2 - 600, z=700)
    s3d.material(board, "plastic", color="#f4f1e8")
    return s3d.group("bus_stop", *posts, roof, bench, *bench_legs, glass, board)
