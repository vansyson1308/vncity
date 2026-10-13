"""Unit tests for the semantic layer, on small synthetic geometry (no network)."""

import shapely
from shapely.geometry import LineString, box

from pipeline import scatter, semantics, traffic


def bld(**kw):
    b = {"id": "b1", "name": None, "class": None, "floors": None, "height_obs": None, "area_m2": 80.0,
         "rect": 0.95, "elong": 3.0, "short_m": 4.0, "row_neighbours": 0, "district": "pho_co"}
    b.update(kw)
    return b


def test_classify_old_quarter_tube_house():
    assert semantics.classify(bld(), "old_quarter")[0] == "nha_ong_pho_co"


def test_classify_tiny_old_quarter_plot_is_still_a_house():
    assert semantics.classify(bld(area_m2=20.0), "old_quarter")[0] == "nha_ong_pho_co"


def test_classify_religious_name_wins():
    assert semantics.classify(bld(name="Đình Kim Ngân"), "old_quarter")[0] == "dinh_chua"


def test_classify_french_villa_and_tower():
    assert semantics.classify(bld(area_m2=300, elong=1.4, short_m=14), "french_quarter")[0] == "biet_thu_phap"
    assert semantics.classify(bld(floors=25, **{"class": "office"}), None)[0] == "van_phong_cao_tang"


def test_classify_collective_slab_outside_core():
    b = bld(area_m2=900, elong=5.0, short_m=12, rect=0.9, district="dong_da")
    assert semantics.classify(b, None)[0] == "khu_tap_the"


def test_no_kdt_terraces_in_inner_city():
    b = bld(area_m2=90, rect=0.95, elong=2.2, short_m=5, row_neighbours=6, district="hoan_kiem")
    assert semantics.classify(b, None)[0] == "nha_ong_hien_dai"
    b["district"] = "ha_dong"
    assert semantics.classify(b, None)[0] == "lien_ke_kdt"


def test_floors_are_stable_and_in_range():
    b = bld(id="abc")
    f1 = semantics.resolve_floors(b, "nha_ong_pho_co")
    assert f1 == semantics.resolve_floors(b, "nha_ong_pho_co")
    assert 2 <= f1[0] <= 4 and f1[2] == "estimated_archetype"
    assert semantics.resolve_floors(bld(height_obs=33.0), "nha_ong_pho_co")[2] == "observed"


def test_frontage_only_on_street_side_and_not_through_neighbours():
    # Road along y = -5 (running east). Two houses in a row along it, and one behind them.
    road = LineString([(-50, -5), (50, -5)])
    roads = [(road, "residential", "Hàng Bạc", 3.0)]
    tree = shapely.STRtree([road])
    front, side = box(0, 0, 4, 15), box(4, 0, 8, 15)
    behind = box(0, 15, 4, 25)
    geoms = [front, side, behind]
    btree = shapely.STRtree(geoms)
    f = semantics.frontage(front, roads, tree, 0, geoms, btree)
    assert len(f) == 1 and f[0]["road_name"] == "Hàng Bạc"
    assert abs(f[0]["facing_deg"] - 270.0) < 1e-6  # faces south, toward the road
    assert semantics.frontage(behind, roads, tree, 2, geoms, btree) == []


def test_traffic_heading_rules():
    denied_back = [{"access_type": "denied", "when": {"heading": "backward"}}]
    assert traffic.heading_rule(denied_back) == "forward"
    walk_only = [{"access_type": "denied", "when": {"heading": "backward", "mode": ["car"]}}]
    assert traffic.heading_rule(walk_only) is None
    assert traffic.cars_denied([{"access_type": "denied", "when": {"mode": ["car"]}}])


def test_route_respects_oneway_and_motorbike_only():
    nodes = [{"id": i, "x": float(x), "y": 0.0, "z": 0.0, "signal": False} for i, x in enumerate([0, 100, 200])]
    e = lambda i, a, b, oneway=False, moto=False: {  # noqa: E731
        "id": i, "from": a, "to": b, "oneway": oneway, "motorbike_only": moto, "speed_kmh": 40,
        "length_m": 100.0}
    g = {"nodes": nodes, "edges": [e(0, 0, 1, oneway=True), e(1, 1, 2, moto=True)]}
    assert traffic.route(g, 0, 2, car=False) == [0, 1, 2]
    assert traffic.route(g, 0, 2, car=True) is None
    assert traffic.route(g, 1, 0, car=False) is None


def test_scatter_is_deterministic():
    assert scatter.tree_species("Phố Huế") == scatter.tree_species("Phố Huế")
    assert scatter.seed_of("a", 1) == scatter.seed_of("a", 1) != scatter.seed_of("a", 2)
    pts = list(scatter.along([[0, 0], [100, 0]], 10, 3.0, 5))
    assert len(pts) == 10 and all(abs(y - 3.0) < 1e-9 for _, y, _ in pts)
