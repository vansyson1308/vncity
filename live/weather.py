"""Hanoi weather for the game, live or from baked climatology, in one JSON shape.

The UE harness (UHanoiTimeWeatherSubsystem) polls an HTTP endpoint that returns:

  {"time_utc": "2026-10-12T19:00:00Z", "local_hour": 2.0, "condition": "drizzle",
   "temperature_c": 24.1, "humidity": 0.86, "precip_mm_h": 0.3, "cloud_cover": 0.9,
   "wind_kmh": 9.0, "nom": false, "source": "open-meteo" | "climatology"}

`condition` is one of the weather values of game/schemas/common.schema.json. `nom` is the
northern-Vietnam damp spell (nồm ẩm, Feb-Apr): walls and floors sweat, the game shows wet floors.

Licensing: Open-Meteo data is CC BY 4.0 but its free API is for non-commercial use only. Use
`--mode live` for development; a shipped game needs a commercial plan or `--mode baked`.

Usage:
  python -m live.weather                    # print the current state (live, falls back to baked)
  python -m live.weather --mode baked --at 2026-02-20T07:00:00Z
  python -m live.weather --serve 8765       # http://127.0.0.1:8765/weather for the UE harness
"""

import argparse
import datetime as dt
import hashlib
import json
import math
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

LAT, LON = 21.0285, 105.8542  # Hồ Hoàn Kiếm
TZ = dt.timezone(dt.timedelta(hours=7))
OPEN_METEO = ("https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
              "&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,wind_speed_10m,weather_code")

# Hanoi monthly climate normals (approximate, 1991-2020 station normals as published on
# Wikipedia / IMHEN): mean °C, daily range °C, rain mm, rainy days, relative humidity.
NORMALS = [
    (16.4, 5.5, 19, 9, 0.80), (17.6, 5.2, 26, 11, 0.82), (20.3, 5.0, 44, 15, 0.85),
    (24.2, 5.6, 90, 13, 0.86), (27.7, 6.6, 189, 14, 0.82), (29.4, 6.4, 240, 15, 0.81),
    (29.6, 6.2, 288, 16, 0.82), (28.9, 5.8, 318, 17, 0.85), (27.8, 6.0, 265, 13, 0.83),
    (25.3, 6.4, 131, 9, 0.80), (21.9, 6.6, 43, 6, 0.78), (18.2, 6.2, 23, 6, 0.77),
]
WMO = [((0, 1), "clear"), ((2, 3), "cloudy"), ((45, 48), "fog"), ((51, 57), "drizzle"),
       ((61, 67), "rain"), ((80, 82), "rain"), ((95, 99), "storm")]


def _u(*key):
    return int.from_bytes(hashlib.blake2b(":".join(map(str, key)).encode(), digest_size=8).digest(), "little") / 2**64


def baked(at_utc):
    """Plausible weather for this hour from climatology, deterministic per hour."""
    local = at_utc.astimezone(TZ)
    m = local.month - 1
    mean, rng, rain_mm, rain_days, rh = NORMALS[m]
    hour = local.hour + local.minute / 60
    temp = mean + rng / 2 * math.cos((hour - 14.5) / 24 * 2 * math.pi)
    day_key = local.strftime("%Y-%m-%d")
    wet_day = _u("wet", day_key) < rain_days / 30.4
    nom = m in (1, 2, 3) and _u("nom", day_key) < 0.35
    precip, cond, cloud = 0.0, "clear", 0.25 + 0.5 * _u("cloud", day_key)
    if wet_day and _u("hour", day_key, local.hour) < (0.25 if m in range(4, 9) else 0.5):
        per_event = rain_mm / max(rain_days, 1)
        if m in range(4, 9):  # summer: short heavy showers and storms, mostly afternoon
            precip = per_event / 2 * (1 + _u("int", day_key, local.hour))
            cond = "storm" if precip > 12 and 13 <= local.hour <= 19 else "rain"
        else:  # winter/spring: mưa phùn
            precip, cond = 0.2 + 0.4 * _u("int", day_key, local.hour), "drizzle"
        cloud = 0.9
    elif nom or (m in (0, 1, 11) and local.hour < 9 and _u("fog", day_key) < 0.3):
        cond, cloud = ("fog" if local.hour < 9 else "cloudy"), 0.85
    elif cloud > 0.6:
        cond = "cloudy"
    if cond in ("clear", "cloudy") and temp >= 35:
        cond = "hot"
    elif cond in ("clear", "cloudy") and temp <= 13:
        cond = "cold"
    return {"temperature_c": round(temp, 1), "humidity": rh if not nom else 0.97, "precip_mm_h": round(precip, 1),
            "cloud_cover": round(cloud, 2), "wind_kmh": round(6 + 10 * _u("wind", day_key, local.hour), 1),
            "condition": cond, "nom": nom, "source": "climatology"}


def live():
    with urllib.request.urlopen(OPEN_METEO.format(lat=LAT, lon=LON), timeout=10) as r:
        cur = json.load(r)["current"]
    code = int(cur.get("weather_code", 0))
    cond = next((c for (lo, hi), c in WMO if lo <= code <= hi), "cloudy")
    t = float(cur["temperature_2m"])
    if cond in ("clear", "cloudy") and t >= 35:
        cond = "hot"
    elif cond in ("clear", "cloudy") and t <= 13:
        cond = "cold"
    rh = cur["relative_humidity_2m"] / 100
    month = dt.datetime.now(TZ).month
    return {"temperature_c": t, "humidity": rh, "precip_mm_h": cur["precipitation"],
            "cloud_cover": cur["cloud_cover"] / 100, "wind_kmh": cur["wind_speed_10m"], "condition": cond,
            "nom": month in (2, 3, 4) and rh >= 0.9, "source": "open-meteo"}


def state(mode="live", at=None):
    at = at or dt.datetime.now(dt.timezone.utc)
    w = None
    if mode == "live" and at is not None:
        try:
            w = live()
        except Exception as e:  # network down or rate-limited: the game must not stall
            w = baked(at) | {"fallback_reason": type(e).__name__}
    w = w or baked(at)
    local = at.astimezone(TZ)
    return {"time_utc": at.strftime("%Y-%m-%dT%H:%M:%SZ"), "local_hour": round(local.hour + local.minute / 60, 2)} | w


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["live", "baked"], default="live")
    ap.add_argument("--at", help="UTC ISO time for baked mode")
    ap.add_argument("--serve", type=int, help="serve /weather on this port")
    a = ap.parse_args()
    at = dt.datetime.fromisoformat(a.at.replace("Z", "+00:00")) if a.at else None
    if not a.serve:
        print(json.dumps(state(a.mode, at), ensure_ascii=False, indent=1))
        return

    class H(BaseHTTPRequestHandler):
        def do_GET(self):
            body = json.dumps(state(a.mode)).encode()
            self.send_response(200 if self.path.startswith("/weather") else 404)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)

    HTTPServer(("127.0.0.1", a.serve), H).serve_forever()


if __name__ == "__main__":
    main()
