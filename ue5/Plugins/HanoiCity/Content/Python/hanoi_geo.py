"""Pure-Python geo math shared by the editor scripts; twin of the C++ runtime.

No `unreal` import, so tests/test_codegen_ue.py checks it outside the editor:
  * TransverseMercator: same Krueger n^3 series as FHanoiTransverseMercator (HanoiGeoSubsystem.cpp).
  * enu_to_ue / ue_yaw: the contract in docs/pipeline-outputs.md.
  * solar_position: NOAA algorithm, twin of UHanoiTimeWeatherSubsystem::ComputeSunPosition.
  * solve_mapping / solve_tile_placement: work out how the glTF importer mapped the tiles (axes,
    units, baked node offset) from the imported mesh bounds (jointly over several tiles, or for
    one tile), and placement_from_mapping returns the actor transform that puts a tile on the
    contract frame. This removes the dependency on importer axis conventions.
"""

import math

A_WGS84 = 6378137.0
F_WGS84 = 1.0 / 298.257223563


class TransverseMercator:
    """+proj=tmerc +lat_0 +lon_0 +k=1 +x_0=0 +y_0=0 +ellps=WGS84, metres east/north."""

    def __init__(self, lat0, lon0):
        self.lat0, self.lon0 = lat0, lon0
        n = F_WGS84 / (2 - F_WGS84)
        self.n = n
        n2, n3 = n * n, n ** 3
        self.A = A_WGS84 / (1 + n) * (1 + n2 / 4 + n2 * n2 / 64)
        self.alpha = (n / 2 - 2 / 3 * n2 + 5 / 16 * n3, 13 / 48 * n2 - 3 / 5 * n3, 61 / 240 * n3)
        self.beta = (n / 2 - 2 / 3 * n2 + 37 / 96 * n3, 1 / 48 * n2 + 1 / 15 * n3, 17 / 480 * n3)
        self.delta = (2 * n - 2 / 3 * n2 - 2 * n3, 7 / 3 * n2 - 8 / 5 * n3, 56 / 15 * n3)
        self.y0 = 0.0
        self.y0 = self._project(math.radians(lat0), 0.0)[1]

    def _project(self, phi, lam):
        n = self.n
        k = 2 * math.sqrt(n) / (1 + n)
        s = math.sin(phi)
        t = math.sinh(math.atanh(s) - k * math.atanh(k * s))
        xip = math.atan2(t, math.cos(lam))
        etap = math.atanh(math.sin(lam) / math.sqrt(1 + t * t))
        xi, eta = xip, etap
        for j, a in enumerate(self.alpha, 1):
            xi += a * math.sin(2 * j * xip) * math.cosh(2 * j * etap)
            eta += a * math.cos(2 * j * xip) * math.sinh(2 * j * etap)
        return self.A * eta, self.A * xi - self.y0

    def forward(self, lat, lon):
        return self._project(math.radians(lat), math.radians(lon - self.lon0))

    def inverse(self, x, y):
        xi, eta = (y + self.y0) / self.A, x / self.A
        xip, etap = xi, eta
        for j, b in enumerate(self.beta, 1):
            xip -= b * math.sin(2 * j * xi) * math.cosh(2 * j * eta)
            etap -= b * math.cos(2 * j * xi) * math.sinh(2 * j * eta)
        chi = math.asin(math.sin(xip) / math.cosh(etap))
        phi = chi + sum(d * math.sin(2 * j * chi) for j, d in enumerate(self.delta, 1))
        return math.degrees(phi), self.lon0 + math.degrees(math.atan2(math.sinh(etap), math.cos(xip)))


def enu_to_ue(x, y, z=0.0):
    """ENU metres -> UE centimetres (X east, Y south, Z up)."""
    return (x * 100.0, -y * 100.0, z * 100.0)


def ue_yaw(yaw_ccw_from_east_deg):
    return -yaw_ccw_from_east_deg


# ----------------------------------------------------------------------------- sun

def julian_day(year, month, day, hour_utc=0.0):
    if month <= 2:
        year, month = year - 1, month + 12
    a = year // 100
    b = 2 - a + a // 4
    return (math.floor(365.25 * (year + 4716)) + math.floor(30.6001 * (month + 1)) + day + b
            - 1524.5 + hour_utc / 24.0)


def solar_position(jd_utc, lat, lon):
    """NOAA solar position. Returns (elevation_deg, azimuth_deg clockwise from north)."""
    jc = (jd_utc - 2451545.0) / 36525.0
    l0 = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360.0
    m = 357.52911 + jc * (35999.05029 - 0.0001537 * jc)
    e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc)
    mr = math.radians(m)
    c = (math.sin(mr) * (1.914602 - jc * (0.004817 + 0.000014 * jc))
         + math.sin(2 * mr) * (0.019993 - 0.000101 * jc) + math.sin(3 * mr) * 0.000289)
    omega = math.radians(125.04 - 1934.136 * jc)
    app_long = l0 + c - 0.00569 - 0.00478 * math.sin(omega)
    obliq = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60
    obliq_corr = math.radians(obliq + 0.00256 * math.cos(omega))
    decl = math.asin(math.sin(obliq_corr) * math.sin(math.radians(app_long)))
    y = math.tan(obliq_corr / 2) ** 2
    l0r = math.radians(l0)
    eq_time = 4 * math.degrees(y * math.sin(2 * l0r) - 2 * e * math.sin(mr)
                               + 4 * e * y * math.sin(mr) * math.cos(2 * l0r)
                               - 0.5 * y * y * math.sin(4 * l0r) - 1.25 * e * e * math.sin(2 * mr))
    minutes_utc = ((jd_utc + 0.5) % 1.0) * 1440.0
    tst = (minutes_utc + eq_time + 4 * lon) % 1440.0
    ha = tst / 4 + 180 if tst < 0 else tst / 4 - 180
    latr, har = math.radians(lat), math.radians(ha)
    cos_zen = math.sin(latr) * math.sin(decl) + math.cos(latr) * math.cos(decl) * math.cos(har)
    zen = math.acos(max(-1.0, min(1.0, cos_zen)))
    denom = math.cos(latr) * math.sin(zen)
    if abs(denom) < 1e-9:
        az = 180.0
    else:
        x = max(-1.0, min(1.0, (math.sin(latr) * math.cos(zen) - math.sin(decl)) / denom))
        az = (math.degrees(math.acos(x)) + 180) % 360 if ha > 0 else (540 - math.degrees(math.acos(x))) % 360
    return 90.0 - math.degrees(zen), az


# ----------------------------------------------------------------------------- tile placement

PLANE_MAPS = [  # signed permutations: (ue_local_x, ue_local_y) from (east, north)
    ((1, 0), (0, -1)),  # the contract (X east, Y south): preferred on ties
    ((1, 0), (0, 1)), ((-1, 0), (0, 1)), ((-1, 0), (0, -1)),
    ((0, 1), (1, 0)), ((0, 1), (-1, 0)), ((0, -1), (1, 0)), ((0, -1), (-1, 0)),
]


def _apply(m, e, n):
    return (m[0][0] * e + m[0][1] * n, m[1][0] * e + m[1][1] * n)


def _box(m, e0, e1, n0, n1, s):
    pts = [_apply(m, e, n) for e in (e0, e1) for n in (n0, n1)]
    xs, ys = [p[0] * s for p in pts], [p[1] * s for p in pts]
    return min(xs), max(xs), min(ys), max(ys)


def _iou(a, b):
    ix = max(0.0, min(a[1], b[1]) - max(a[0], b[0]))
    iy = max(0.0, min(a[3], b[3]) - max(a[2], b[2]))
    inter = ix * iy
    area = lambda r: max(0.0, r[1] - r[0]) * max(0.0, r[3] - r[2])
    union = area(a) + area(b) - inter
    return inter / union if union > 0 else 0.0


def solve_tile_placement(mesh_min, mesh_max, tile_origin_m, tile_size_m, expected_box_m=None):
    """Find the actor transform that lands an imported tile mesh on the contract frame.

    mesh_min/mesh_max: imported static mesh local bounds (UE units), tile_origin_m: (ox, oy) of
    the tile's south-west corner (ENU), tile_size_m: tile edge. expected_box_m: optional absolute
    ENU plan box (e0, e1, n0, n1) of the tile's content (e.g. from building centroids in
    bld_X_Y.json); without it the tile square is used, which cannot tell an axis swap from the
    identity when the importer drops the node offset. Ties keep the contract mapping.

    Returns dict(location=(x,y,z), yaw=deg, scale=(sx,sy,sz), baked=bool, units=s, score=IoU).
    Contract: world = (100 e, -100 n, 100 u). Candidate importer mapping: local = s * M (e, n)
    (+ tile offset dropped if not baked) with s in {100, 1}.
    """
    ox, oy = tile_origin_m
    measured = (mesh_min[0], mesh_max[0], mesh_min[1], mesh_max[1])
    ex = expected_box_m or (ox, ox + tile_size_m, oy, oy + tile_size_m)
    best = None
    for s in (100.0, 1.0):
        for baked in (True, False):
            de, dn = (0.0, 0.0) if baked else (ox, oy)
            for m in PLANE_MAPS:
                box = _box(m, ex[0] - de, ex[1] - de, ex[2] - dn, ex[3] - dn, s)
                score = _iou(box, measured)
                if best is None or score > best[0] + 1e-9:
                    best = (score, s, baked, m)
    score, s, baked, m = best
    p = placement_from_mapping(m, s, baked, tile_origin_m)
    p["score"] = score
    return p


TIE_IOU = 0.005  # per-tile IoU difference below which the contract mapping wins


def candidate_mappings():
    """All 32 importer hypotheses (map, units, baked); the contract comes first."""
    return [(m, s, baked) for s in (100.0, 1.0) for baked in (True, False) for m in PLANE_MAPS]


def mapping_score(m, s, baked, mesh_min, mesh_max, tile_origin_m, expected_box_m):
    """IoU of the measured mesh plan box with the expected box under one importer hypothesis."""
    ox, oy = tile_origin_m
    de, dn = (0.0, 0.0) if baked else (ox, oy)
    ex = expected_box_m
    box = _box(m, ex[0] - de, ex[1] - de, ex[2] - dn, ex[3] - dn, s)
    return _iou(box, (mesh_min[0], mesh_max[0], mesh_min[1], mesh_max[1]))


def solve_mapping(samples):
    """Joint solve over several tiles: samples = [(mesh_min, mesh_max, tile_origin_m, expected_box_m)].

    One importer behaves the same for every tile, so the hypotheses are ranked by their summed IoU.
    Per-tile argmax is not enough: a tile whose content is roughly square and centred like its
    neighbours (typically the tiles around the origin) scores a rotated/mirrored hypothesis within
    0.1% of the right one, and footprints that straddle tile edges can tip it. Summing over tiles
    at different offsets separates them. Near-ties (< TIE_IOU per tile) keep the contract mapping.

    Returns dict(map, units, baked, total, scores=[per-tile IoU], runner_up=(hypothesis, total)).
    """
    ranked = []
    for i, (m, s, baked) in enumerate(candidate_mappings()):
        scores = [mapping_score(m, s, baked, mn, mx, o, ex) for mn, mx, o, ex in samples]
        ranked.append((sum(scores), -i, (m, s, baked), scores))
    contract = ranked[0]
    ranked.sort(reverse=True)
    if contract[0] >= ranked[0][0] - TIE_IOU * len(samples):  # near-tie: trust the contract
        ranked.remove(contract)
        ranked.insert(0, contract)
    total, _, (m, s, baked), scores = ranked[0]
    second = ranked[1] if len(ranked) > 1 else None
    return {"map": m, "units": s, "baked": baked, "total": total, "scores": scores,
            "runner_up": (second[2], second[0]) if second else None}


def placement_from_mapping(m, s, baked, tile_origin_m):
    """Actor transform for a tile imported with mapping local = s * M (e, n) (+offset if baked)."""
    ox, oy = tile_origin_m
    # world_xy = D * M^-1 * local / s (+ D * (ox, oy) if not baked), D = diag(100, -100).
    # M is a signed permutation, so M^-1 = M^T.
    minv = ((m[0][0], m[1][0]), (m[0][1], m[1][1]))
    k = 100.0 / s
    # Decompose D * M^T = R * diag(1, sy): rotation R (UE yaw), optional mirror on local Y.
    r = ((minv[0][0], minv[0][1]), (-minv[1][0], -minv[1][1]))
    det = r[0][0] * r[1][1] - r[0][1] * r[1][0]
    sy = 1.0
    if det < 0:
        sy = -1.0
        r = ((r[0][0], -r[0][1]), (r[1][0], -r[1][1]))
    # UE yaw rotates +X toward +Y: R = [[c, -s], [s, c]] in UE XY.
    yaw = math.degrees(math.atan2(r[1][0], r[0][0]))
    loc = (0.0, 0.0, 0.0) if baked else (100.0 * ox, -100.0 * oy, 0.0)
    return {"location": loc, "yaw": round(yaw, 6) + 0.0, "scale": (k, k * sy, k), "baked": baked,
            "units": s, "map": m}


def apply_placement(p, local_xyz):
    """Apply a solve_tile_placement result to a mesh-local point (for tests/debug)."""
    x, y, z = local_xyz[0] * p["scale"][0], local_xyz[1] * p["scale"][1], local_xyz[2] * p["scale"][2]
    c, s = math.cos(math.radians(p["yaw"])), math.sin(math.radians(p["yaw"]))
    return (c * x - s * y + p["location"][0], s * x + c * y + p["location"][1], z + p["location"][2])
