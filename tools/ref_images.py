"""Collect legally reusable reference photos of the Old Quarter and the priority landmarks.

The photos feed artists and the Codex image-generation route (facade kits, props). They are
REFERENCES: an item may be used directly as a texture only when its `usage` is `texture_ok`
(CC0 / public domain / CC BY). CC BY-SA items are `reference_only`: look at them, never trace,
crop or project them onto a mesh (that would make the derived asset share-alike).

Hard rule: no Google Street View / Maps / Earth imagery, in any form. There is no Google source
here and none may be added.

Sources (stdlib only, no extra dependency):
  commons    Wikimedia Commons API: geosearch, category members, file search. No key.
  openverse  Openverse API (CC aggregator). No key (anonymous rate limit). Text search only.
  mapillary  Mapillary Graph API v4, bbox search. Needs MAPILLARY_TOKEN. Always CC BY-SA 4.0.
  flickr     flickr.photos.search, geo + licence filter. Needs FLICKR_API_KEY.
  kartaview  KartaView (ex OpenStreetCam) nearby-photos. No key. Always CC BY-SA 4.0.
  panoramax  Panoramax STAC search (meta-catalogue). No key. Per-picture licence.

Usage:
  python -m tools.ref_images --landmarks thap_rua,cau_the_huc --streets "Hàng Bạc,Tạ Hiện"
  python -m tools.ref_images --all-landmarks --all-streets --download
  python -m tools.ref_images --bbox 105.849,21.031,105.854,21.037 --bbox-name pho_co_loi
  python -m tools.ref_images --check            # only probe which sources are reachable

Outputs: out/refs/<target>/manifest.json, out/refs/<target>/img/* (with --download),
out/refs/ATTRIBUTION.md (rebuilt from every manifest under out/refs).

Set REFS_CONTACT (an e-mail or URL) so API operators can reach you; it goes in the User-Agent.
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import io
import json
import math
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LANDMARKS = ROOT / "game" / "content" / "world" / "landmarks.json"
OUT = ROOT / "out" / "refs"
TOOL_VERSION = "0.1"
MAX_THUMB_W = 1600

# --------------------------------------------------------------------------------------------
# Targets
# --------------------------------------------------------------------------------------------

# Old Quarter streets. Centre and bbox (lon_min, lat_min, lon_max, lat_max) were measured from
# the Overture road graph (out/hoankiem/traffic/graph.json, release 2026-09-23.0).
STREETS: dict[str, dict] = {
    "Hàng Bạc": {"centre": (21.033940, 105.852113), "bbox": (105.85068, 21.03379, 105.85378, 21.03411)},
    "Hàng Buồm": {"centre": (21.035744, 105.851408), "bbox": (105.85002, 21.03532, 105.85279, 21.03605)},
    "Tạ Hiện": {"centre": (21.034643, 105.852052), "bbox": (105.85180, 21.03393, 105.85216, 21.03589)},
    "Hàng Gai": {"centre": (21.032092, 105.850522), "bbox": (105.84914, 21.03132, 105.85134, 21.03234)},
    "Hàng Mã": {"centre": (21.036715, 105.848095), "bbox": (105.84613, 21.03656, 105.84945, 21.03688)},
    "Mã Mây": {"centre": (21.035619, 105.853216), "bbox": (105.85279, 21.03382, 105.85345, 21.03605)},
    "Hàng Đào": {"centre": (21.032837, 105.851187), "bbox": (105.85068, 21.03230, 105.85134, 21.03408)},
    "Hàng Ngang": {"centre": (21.034861, 105.850255), "bbox": (105.85002, 21.03408, 105.85068, 21.03532)},
    "Hàng Đường": {"centre": (21.036158, 105.849719), "bbox": (105.84945, 21.03532, 105.85002, 21.03688)},
    "Lương Văn Can": {"centre": (21.032402, 105.850621), "bbox": (105.84994, 21.03141, 105.85100, 21.03399)},
    "Hàng Bè": {"centre": (21.032684, 105.853811), "bbox": (105.85378, 21.03219, 105.85383, 21.03379)},
    "Đinh Liệt": {"centre": (21.033187, 105.851963), "bbox": (105.85190, 21.03227, 105.85204, 21.03393)},
    "Hàng Chiếu": {"centre": (21.037016, 105.850264), "bbox": (105.84945, 21.03688, 105.85210, 21.03731)},
    "Hàng Thiếc": {"centre": (21.032823, 105.847758), "bbox": (105.84769, 21.03249, 105.84795, 21.03380)},
}

# Commons categories worth listing for landmarks; names that do not exist simply return nothing.
LANDMARK_CATEGORIES: dict[str, list[str]] = {
    "thap_rua": ["Turtle Tower", "Tháp Rùa"],
    "cau_the_huc": ["The Huc Bridge", "Thê Húc Bridge", "Cầu Thê Húc"],
    "den_ngoc_son": ["Ngọc Sơn Temple"],
    "nha_tho_lon": ["St. Joseph's Cathedral, Hanoi", "Hanoi St. Joseph's Cathedral"],
    "o_quan_chuong": ["Ô Quan Chưởng", "O Quan Chuong"],
    "nha_hat_lon": ["Hanoi Opera House"],
    "cau_long_bien": ["Long Biên Bridge"],
    "cho_dong_xuan": ["Đồng Xuân Market"],
    "den_bach_ma": ["Bạch Mã Temple"],
    "van_mieu": ["Temple of Literature, Hanoi"],
    "chua_mot_cot": ["One Pillar Pagoda"],
    "cot_co_ha_noi": ["Flag Tower of Hanoi"],
}

# Geosearch radius per landmark kind (metres): a point monument needs less than a lake.
KIND_RADIUS = {"lake": 600, "park": 400, "street": 250, "bridge": 250, "market": 200}
DEFAULT_RADIUS = 150


def slug(text: str) -> str:
    s = text.replace("đ", "d").replace("Đ", "D")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def bbox_around(lat: float, lon: float, radius_m: float) -> tuple[float, float, float, float]:
    dlat = radius_m / 111_320.0
    dlon = radius_m / (111_320.0 * math.cos(math.radians(lat)))
    return (lon - dlon, lat - dlat, lon + dlon, lat + dlat)


def haversine_m(lat1, lon1, lat2, lon2) -> float:
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def load_landmarks(path: Path = LANDMARKS) -> dict[str, dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return {it["id"]: it for it in data["items"]}


def landmark_target(item: dict) -> dict:
    lat, lon = item["location"]["lat"], item["location"]["lon"]
    radius = KIND_RADIUS.get(item.get("kind"), DEFAULT_RADIUS)
    vi, en = item["name"]["vi"], item["name"].get("en", "")
    short_vi = vi.split("(")[0].strip()
    short_en = en.split("(")[0].strip()
    queries = [q for q in dict.fromkeys([f"{short_vi} Hà Nội", f"{short_en} Hanoi"]) if q.strip()]
    return {
        "id": item["id"], "kind": "landmark", "name_vi": vi, "name_en": en,
        "lat": lat, "lon": lon, "radius_m": radius, "bbox": bbox_around(lat, lon, radius),
        "queries": queries,
        "commons_categories": LANDMARK_CATEGORIES.get(item["id"], []),
        "coords_unverified": "coords_unverified" in item.get("tags", []),
    }


def street_target(name: str) -> dict:
    s = STREETS[name]
    lat, lon = s["centre"]
    w, so, e, n = s["bbox"]
    pad = 30.0  # metres: catch photos taken from the corner / opposite pavement
    w0, s0, _, _ = bbox_around(so, w, pad)
    _, _, e1, n1 = bbox_around(n, e, pad)
    half_diag = haversine_m(s0, w0, n1, e1) / 2
    plain = slug(name).replace("_", " ")
    return {
        "id": "pho_" + slug(name), "kind": "street", "name_vi": f"Phố {name}", "name_en": f"{plain.title()} Street",
        "lat": lat, "lon": lon, "radius_m": round(min(half_diag, 400)), "bbox": (w0, s0, e1, n1),
        "queries": [f"Phố {name} Hà Nội", f"{plain.title()} Street Hanoi"],
        "commons_categories": [f"{name} Street", f"{plain.title()} Street", f"Phố {name}", f"{name} Street, Hanoi"],
        "coords_unverified": False,
    }


def bbox_target(name: str, bbox: tuple[float, float, float, float]) -> dict:
    w, s, e, n = bbox
    lat, lon = (s + n) / 2, (w + e) / 2
    return {
        "id": slug(name), "kind": "bbox", "name_vi": name, "name_en": name, "lat": lat, "lon": lon,
        "radius_m": round(min(haversine_m(s, w, n, e) / 2, 10_000)), "bbox": bbox,
        "queries": [], "commons_categories": [], "coords_unverified": False,
    }


# --------------------------------------------------------------------------------------------
# Licences
# --------------------------------------------------------------------------------------------

LICENCE_URLS = {
    "cc0": "https://creativecommons.org/publicdomain/zero/1.0/",
    "pd": "https://creativecommons.org/publicdomain/mark/1.0/",
}


def normalize_licence(raw: str | None, url: str | None = None) -> dict | None:
    """Map any source's licence string to {code, version, name, url}, or None if not allowed.

    Allowed: CC0, public domain (incl. PDM), CC BY, CC BY-SA (any version, incl. "2.0 generic").
    Rejected: anything with NC or ND, GFDL-only, all-rights-reserved, unknown.
    """
    text = " ".join(x for x in (raw, url) if x).lower()
    if not text.strip():
        return None
    t = text.replace("_", "-")
    if re.search(r"(?<![a-z])(nc|nd)(?![a-z])", t.replace("-", " ")) or "noncommercial" in t or "noderiv" in t:
        return None
    version = None
    m = re.search(r"(\d\.\d)", raw or "") or re.search(r"/(\d\.\d)", url or "")
    if m:
        version = m.group(1)
    compact = re.sub(r"[\s\-]+", "", (raw or "").lower())
    url_l = (url or "").lower()
    if compact.startswith("cc0") or "publicdomain/zero" in url_l:
        code = "cc0"
    elif (compact in {"pd", "pdm", "publicdomain", "publicdomainmark"} or compact.startswith("pd")
          or "public domain" in t or "publicdomain/mark" in url_l):
        code = "pd"
    elif compact.startswith("ccbysa") or compact.startswith("bysa") or "/licenses/by-sa/" in url_l:
        code = "cc-by-sa"
    elif compact.startswith("ccby") or compact.startswith("by") or "/licenses/by/" in url_l:
        code = "cc-by"
    else:
        return None
    if code in ("cc0", "pd"):
        name = "CC0 1.0" if code == "cc0" else "Public domain"
        lic_url = url or LICENCE_URLS[code]
    else:
        v = version or "4.0"
        name = ("CC BY-SA " if code == "cc-by-sa" else "CC BY ") + v
        lic_url = url or f"https://creativecommons.org/licenses/{code[3:]}/{v}/"
    return {"code": code, "version": version, "name": name, "url": lic_url}


def usage_for(code: str) -> str:
    return "texture_ok" if code in ("cc0", "pd", "cc-by") else "reference_only"


# Flickr licence ids (flickr.photos.licenses.getInfo). Only the allowed ones are listed.
FLICKR_LICENCES = {
    "4": ("CC BY 2.0", "https://creativecommons.org/licenses/by/2.0/"),
    "5": ("CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0/"),
    "7": ("No known copyright restrictions", "https://www.flickr.com/commons/usage/"),
    "9": ("CC0 1.0", "https://creativecommons.org/publicdomain/zero/1.0/"),
    "10": ("Public Domain Mark 1.0", "https://creativecommons.org/publicdomain/mark/1.0/"),
    "11": ("CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"),
    "12": ("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"),
}
# 7 ("no known restrictions", Flickr Commons institutions) is not a licence; keep it out.
FLICKR_ALLOWED_IDS = ["4", "5", "9", "10", "11", "12"]


# --------------------------------------------------------------------------------------------
# HTTP: polite client (User-Agent with contact, per-host rate limit, retry with back-off)
# --------------------------------------------------------------------------------------------

class Unreachable(Exception):
    """Host refused at network/proxy level: skip the whole source."""


class Http:
    def __init__(self, contact: str | None = None, min_interval: float = 1.0, retries: int = 3, timeout: float = 30):
        contact = contact or os.environ.get("REFS_CONTACT") or "https://github.com/vansyson1308/vncity"
        self.ua = f"vncity-ref-images/{TOOL_VERSION} (+https://github.com/vansyson1308/vncity; {contact}) python-urllib"
        self.min_interval = min_interval
        self.retries = retries
        self.timeout = timeout
        self._last: dict[str, float] = {}

    def _wait(self, host: str):
        dt_ = time.monotonic() - self._last.get(host, 0.0)
        if dt_ < self.min_interval:
            time.sleep(self.min_interval - dt_)
        self._last[host] = time.monotonic()

    def get(self, url: str, params: dict | None = None, data: dict | None = None, headers: dict | None = None) -> bytes:
        if params:
            url = url + ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
        body = urllib.parse.urlencode(data).encode() if data is not None else None
        host = urllib.parse.urlsplit(url).netloc
        hdrs = {"User-Agent": self.ua, "Accept": "application/json, image/*;q=0.9, */*;q=0.5"}
        hdrs.update(headers or {})
        last_err: Exception | None = None
        for attempt in range(self.retries + 1):
            self._wait(host)
            try:
                with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=hdrs), timeout=self.timeout) as r:
                    return r.read()
            except urllib.error.HTTPError as e:
                last_err = e
                if e.code in (429, 500, 502, 503, 504) and attempt < self.retries:
                    ra = e.headers.get("Retry-After")
                    time.sleep(float(ra) if ra and ra.isdigit() else 2.0 * (2 ** attempt))
                    continue
                raise
            except urllib.error.URLError as e:
                reason = str(getattr(e, "reason", e))
                # A proxy CONNECT refusal / DNS failure will not fix itself: fail fast.
                if "403" in reason or "407" in reason or "Tunnel" in reason or "Name or service" in reason:
                    raise Unreachable(f"{host}: {reason}") from e
                last_err = e
            except (TimeoutError, ConnectionError, OSError) as e:
                if "403" in str(e) or "Tunnel" in str(e):
                    raise Unreachable(f"{host}: {e}") from e
                last_err = e
            if attempt < self.retries:
                time.sleep(2.0 * (2 ** attempt))
        raise Unreachable(f"{host}: {last_err}")

    def json(self, url: str, params: dict | None = None, **kw) -> dict:
        return json.loads(self.get(url, params, **kw).decode("utf-8"))


# --------------------------------------------------------------------------------------------
# Sources. Each has: name, env key (or None), probe(http), search(http, target, limit) -> raw
# records, and a pure parse_*(payload, target) -> list[item] that tests run on canned JSON.
# --------------------------------------------------------------------------------------------

def strip_html(s: str | None) -> str:
    if not s:
        return ""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()


def make_item(*, source, sid, url, thumb_url, page_url, title, author, author_url, licence, lat, lon,
              capture_date, width, height, target, match, restrictions=None, heading=None) -> dict:
    dist = round(haversine_m(target["lat"], target["lon"], lat, lon)) if lat is not None and lon is not None else None
    return {
        "id": f"{source}:{sid}",
        "source": source,
        "title": title or "",
        "url": url,
        "thumb_url": thumb_url,
        "page_url": page_url,
        "author": author or "unknown",
        "author_url": author_url,
        "license": licence["name"],
        "license_code": licence["code"],
        "license_url": licence["url"],
        "usage": usage_for(licence["code"]),
        "lat": lat,
        "lon": lon,
        "distance_m": dist,
        "heading_deg": heading,
        "capture_date": capture_date,
        "width": width,
        "height": height,
        "match": match,
        "restrictions": restrictions or "",
        "attribution": f"\"{title or sid}\" by {author or 'unknown'}, {licence['name']}, via {SOURCE_LABEL.get(source, source)}",
    }


SOURCE_LABEL = {"commons": "Wikimedia Commons", "openverse": "Openverse", "mapillary": "Mapillary",
                "flickr": "Flickr", "kartaview": "KartaView", "panoramax": "Panoramax"}


# ---- Wikimedia Commons -----------------------------------------------------------------------

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
COMMONS_EXT = "LicenseShortName|LicenseUrl|License|Artist|Credit|DateTimeOriginal|ImageDescription|Restrictions|NonFree|AttributionRequired|GPSLatitude|GPSLongitude"


def _commons_params(**gen) -> dict:
    p = {"action": "query", "format": "json", "formatversion": "2", "prop": "imageinfo|coordinates",
         "iiprop": "url|size|extmetadata|mime", "iiurlwidth": str(MAX_THUMB_W), "iiextmetadatafilter": COMMONS_EXT,
         "colimit": "max", "maxlag": "5"}
    p.update(gen)
    return p


def parse_commons(payload: dict, target: dict, match: str) -> tuple[list[dict], int]:
    items, rejected = [], 0
    for page in (payload.get("query") or {}).get("pages", []) or []:
        info = (page.get("imageinfo") or [None])[0]
        if not info or not str(info.get("mime", "image/")).startswith("image/"):
            continue
        meta = {k: (v or {}).get("value") for k, v in (info.get("extmetadata") or {}).items()}
        if str(meta.get("NonFree", "")).lower() in ("true", "1"):
            rejected += 1
            continue
        lic = normalize_licence(meta.get("LicenseShortName") or meta.get("License"), meta.get("LicenseUrl"))
        if lic is None:
            rejected += 1
            continue
        coords = (page.get("coordinates") or [{}])[0]
        lat = coords.get("lat", _f(meta.get("GPSLatitude")))
        lon = coords.get("lon", _f(meta.get("GPSLongitude")))
        title = page.get("title", "").removeprefix("File:")
        artist = strip_html(meta.get("Artist"))
        m = re.search(r'href="([^"]+)"', meta.get("Artist") or "")
        author_url = ("https:" + m.group(1)) if m and m.group(1).startswith("//") else (m.group(1) if m else None)
        items.append(make_item(
            source="commons", sid=page.get("pageid"), url=info.get("url"), thumb_url=info.get("thumburl") or info.get("url"),
            page_url=info.get("descriptionurl"), title=title, author=artist, author_url=author_url, licence=lic,
            lat=lat, lon=lon, capture_date=_date(strip_html(meta.get("DateTimeOriginal"))),
            width=info.get("width"), height=info.get("height"), target=target, match=match,
            restrictions=strip_html(meta.get("Restrictions"))))
    return items, rejected


def _f(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _date(s: str | None) -> str | None:
    if not s:
        return None
    m = re.search(r"(\d{4})[-:](\d{2})[-:](\d{2})", s)
    if m:
        return "-".join(m.groups())
    m = re.search(r"\b(1[89]\d\d|20\d\d)\b", s)
    return m.group(1) if m else s[:32]


def search_commons(http: Http, target: dict, limit: int):
    out = []
    radius = int(min(max(target["radius_m"], 10), 10_000))
    out.append((http.json(COMMONS_API, _commons_params(
        generator="geosearch", ggscoord=f"{target['lat']}|{target['lon']}", ggsradius=str(radius),
        ggsnamespace="6", ggslimit=str(min(limit, 500)))), "geo"))
    for cat in target.get("commons_categories", []):
        out.append((http.json(COMMONS_API, _commons_params(
            generator="categorymembers", gcmtitle=f"Category:{cat}", gcmtype="file",
            gcmlimit=str(min(limit, 500)))), "category"))
    for q in target.get("queries", [])[:2]:
        out.append((http.json(COMMONS_API, _commons_params(
            generator="search", gsrsearch=f"filetype:bitmap {q}", gsrnamespace="6",
            gsrlimit=str(min(limit, 50)))), "text"))
    return out


def probe_commons(http: Http):
    http.json(COMMONS_API, {"action": "query", "meta": "siteinfo", "format": "json"})


# ---- Openverse -------------------------------------------------------------------------------

OPENVERSE_API = "https://api.openverse.org/v1/images/"


def parse_openverse(payload: dict, target: dict, match: str = "text") -> tuple[list[dict], int]:
    items, rejected = [], 0
    for r in payload.get("results", []) or []:
        raw = r.get("license") or ""
        ver = r.get("license_version") or ""
        lic = normalize_licence(f"{'' if raw in ('cc0', 'pdm') else 'cc '}{raw} {ver}".strip(), r.get("license_url"))
        if lic is None:
            rejected += 1
            continue
        if (r.get("source") or r.get("provider")) == "wikimedia":
            # Commons already queried directly with better metadata; keep it but mark provenance.
            pass
        items.append(make_item(
            source="openverse", sid=r.get("id"), url=r.get("url"), thumb_url=r.get("url"),
            page_url=r.get("foreign_landing_url"), title=r.get("title"), author=r.get("creator"),
            author_url=r.get("creator_url"), licence=lic, lat=None, lon=None, capture_date=None,
            width=r.get("width"), height=r.get("height"), target=target, match=match,
            restrictions=f"upstream: {r.get('source') or r.get('provider') or '?'}"))
    return items, rejected


def search_openverse(http: Http, target: dict, limit: int):
    out = []
    for q in target.get("queries", [])[:2]:
        out.append((http.json(OPENVERSE_API, {"q": q, "license": "cc0,pdm,by,by-sa", "page_size": str(min(limit, 20)),
                                              "mature": "false"}), "text"))
    return out


def probe_openverse(http: Http):
    http.json(OPENVERSE_API, {"q": "hanoi", "page_size": "1"})


# ---- Mapillary -------------------------------------------------------------------------------

MAPILLARY_API = "https://graph.mapillary.com/images"
MAPILLARY_LIC = {"code": "cc-by-sa", "version": "4.0", "name": "CC BY-SA 4.0",
                 "url": "https://creativecommons.org/licenses/by-sa/4.0/"}


def parse_mapillary(payload: dict, target: dict, match: str = "geo") -> tuple[list[dict], int]:
    items = []
    for r in payload.get("data", []) or []:
        geom = r.get("computed_geometry") or r.get("geometry") or {}
        lon, lat = (geom.get("coordinates") or [None, None])[:2]
        ts = r.get("captured_at")
        cap = dt.datetime.fromtimestamp(ts / 1000, dt.timezone.utc).date().isoformat() if isinstance(ts, (int, float)) else None
        creator = (r.get("creator") or {}).get("username")
        items.append(make_item(
            source="mapillary", sid=r.get("id"), url=r.get("thumb_original_url") or r.get("thumb_2048_url"),
            thumb_url=r.get("thumb_1024_url") or r.get("thumb_2048_url"),
            page_url=f"https://www.mapillary.com/app/?pKey={r.get('id')}", title=f"Mapillary {r.get('id')}",
            author=creator, author_url=f"https://www.mapillary.com/app/user/{creator}" if creator else None,
            licence=MAPILLARY_LIC, lat=lat, lon=lon, capture_date=cap, width=r.get("width"), height=r.get("height"),
            target=target, match=match, heading=r.get("computed_compass_angle", r.get("compass_angle")),
            restrictions="panorama" if r.get("is_pano") else ""))
    return items, 0


def search_mapillary(http: Http, target: dict, limit: int):
    tok = os.environ["MAPILLARY_TOKEN"]
    w, s, e, n = target["bbox"]
    fields = "id,captured_at,compass_angle,computed_compass_angle,geometry,computed_geometry,creator,width,height,is_pano,thumb_1024_url,thumb_2048_url,thumb_original_url"
    return [(http.json(MAPILLARY_API, {"bbox": f"{w:.6f},{s:.6f},{e:.6f},{n:.6f}", "fields": fields,
                                       "limit": str(min(limit, 2000))},
                       headers={"Authorization": f"OAuth {tok}"}), "geo")]


def probe_mapillary(http: Http):
    w, s, e, n = bbox_around(21.0288, 105.8524, 30)
    http.json(MAPILLARY_API, {"bbox": f"{w},{s},{e},{n}", "fields": "id", "limit": "1"},
              headers={"Authorization": f"OAuth {os.environ['MAPILLARY_TOKEN']}"})


# ---- Flickr ----------------------------------------------------------------------------------

FLICKR_API = "https://api.flickr.com/services/rest/"


def parse_flickr(payload: dict, target: dict, match: str = "geo") -> tuple[list[dict], int]:
    items, rejected = [], 0
    for p in (payload.get("photos") or {}).get("photo", []) or []:
        lid = str(p.get("license"))
        if lid not in FLICKR_ALLOWED_IDS:
            rejected += 1
            continue
        name, url = FLICKR_LICENCES[lid]
        lic = normalize_licence(name, url)
        if lic is None:
            rejected += 1
            continue
        thumb = p.get("url_h") or p.get("url_l") or p.get("url_c") or p.get("url_z")
        w = _int(p.get("width_h") or p.get("width_l") or p.get("o_width"))
        h = _int(p.get("height_h") or p.get("height_l") or p.get("o_height"))
        items.append(make_item(
            source="flickr", sid=p.get("id"), url=p.get("url_o") or thumb, thumb_url=thumb,
            page_url=f"https://www.flickr.com/photos/{p.get('owner')}/{p.get('id')}", title=p.get("title"),
            author=p.get("ownername") or p.get("owner"), author_url=f"https://www.flickr.com/people/{p.get('owner')}",
            licence=lic, lat=_f(p.get("latitude")) or None, lon=_f(p.get("longitude")) or None,
            capture_date=_date(p.get("datetaken")), width=w, height=h, target=target, match=match))
    return items, rejected


def _int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def search_flickr(http: Http, target: dict, limit: int):
    w, s, e, n = target["bbox"]
    base = {"method": "flickr.photos.search", "api_key": os.environ["FLICKR_API_KEY"], "format": "json",
            "nojsoncallback": "1", "license": ",".join(FLICKR_ALLOWED_IDS), "media": "photos", "content_types": "0",
            "safe_search": "1", "extras": "license,owner_name,geo,date_taken,url_h,url_l,url_c,url_o,o_dims",
            "per_page": str(min(limit, 250))}
    out = [(http.json(FLICKR_API, {**base, "bbox": f"{w},{s},{e},{n}"}), "geo")]
    for q in target.get("queries", [])[:1]:
        out.append((http.json(FLICKR_API, {**base, "text": q}), "text"))
    return out


def probe_flickr(http: Http):
    http.json(FLICKR_API, {"method": "flickr.test.echo", "api_key": os.environ["FLICKR_API_KEY"], "format": "json",
                           "nojsoncallback": "1"})


# ---- KartaView -------------------------------------------------------------------------------

KARTAVIEW_API = "https://api.openstreetcam.org/2.0/photo/"
KARTAVIEW_LIC = MAPILLARY_LIC


def parse_kartaview(payload: dict, target: dict, match: str = "geo") -> tuple[list[dict], int]:
    res = payload.get("result") or {}
    rows = res.get("data") if isinstance(res, dict) else None
    if rows is None:
        rows = (payload.get("currentPageItems") or [])
    items = []
    for r in rows or []:
        lat, lon = _f(r.get("lat")), _f(r.get("lng"))
        full = r.get("fileurlProc") or r.get("fileurl") or r.get("name")
        thumb = r.get("fileurlLTh") or r.get("fileurlTh") or r.get("lth_name") or full
        items.append(make_item(
            source="kartaview", sid=r.get("id"), url=full, thumb_url=thumb,
            page_url=f"https://kartaview.org/details/{r.get('sequenceId') or r.get('sequence_id')}/{r.get('sequenceIndex') or r.get('sequence_index') or 0}",
            title=f"KartaView {r.get('id')}", author=r.get("username") or (r.get("user") or {}).get("username"),
            author_url=None, licence=KARTAVIEW_LIC, lat=lat, lon=lon,
            capture_date=_date(r.get("shotDate") or r.get("shot_date") or r.get("dateAdded")),
            width=_int(r.get("width")), height=_int(r.get("height")), target=target, match=match,
            heading=_f(r.get("heading"))))
    return items, 0


def search_kartaview(http: Http, target: dict, limit: int):
    w, s, e, n = target["bbox"]
    return [(http.json(KARTAVIEW_API, {"tLeft": f"{n},{w}", "bRight": f"{s},{e}", "itemsPerPage": str(min(limit, 100)),
                                       "orderBy": "shotDate", "orderDirection": "desc"}), "geo")]


def probe_kartaview(http: Http):
    http.json(KARTAVIEW_API, {"lat": "21.0288", "lng": "105.8524", "radius": "50", "itemsPerPage": "1"})


# ---- Panoramax -------------------------------------------------------------------------------

PANORAMAX_API = "https://api.panoramax.xyz/api/search"


def parse_panoramax(payload: dict, target: dict, match: str = "geo") -> tuple[list[dict], int]:
    items, rejected = [], 0
    for f in payload.get("features", []) or []:
        props = f.get("properties") or {}
        lic_raw = props.get("license") or ""
        lic_url = next((lk.get("href") for lk in f.get("links", []) if lk.get("rel") == "license"), None)
        lic = normalize_licence(lic_raw, lic_url)
        if lic is None:  # e.g. etalab-2.0: permissive, but not in the allowed list
            rejected += 1
            continue
        lon, lat = ((f.get("geometry") or {}).get("coordinates") or [None, None])[:2]
        assets = f.get("assets") or {}
        prov = ", ".join(p.get("name", "") for p in props.get("providers", []) or f.get("providers", []) or [] if p.get("name"))
        items.append(make_item(
            source="panoramax", sid=f.get("id"), url=(assets.get("hd") or {}).get("href"),
            thumb_url=(assets.get("sd") or assets.get("hd") or {}).get("href"),
            page_url=f"https://api.panoramax.xyz/#focus=pic&pic={f.get('id')}", title=f"Panoramax {f.get('id')}",
            author=prov, author_url=None, licence=lic, lat=lat, lon=lon, capture_date=_date(props.get("datetime")),
            width=_int((props.get("pers:interior_orientation") or {}).get("sensor_array_dimensions", [None])[0]),
            height=None, target=target, match=match, heading=_f(props.get("view:azimuth"))))
    return items, rejected


def search_panoramax(http: Http, target: dict, limit: int):
    w, s, e, n = target["bbox"]
    return [(http.json(PANORAMAX_API, {"bbox": f"{w},{s},{e},{n}", "limit": str(min(limit, 100))}), "geo")]


def probe_panoramax(http: Http):
    http.json(PANORAMAX_API, {"bbox": "105.85,21.02,105.851,21.021", "limit": "1"})


SOURCES = {
    "commons": {"env": None, "probe": probe_commons, "search": search_commons, "parse": parse_commons},
    "openverse": {"env": None, "probe": probe_openverse, "search": search_openverse, "parse": parse_openverse},
    "mapillary": {"env": "MAPILLARY_TOKEN", "probe": probe_mapillary, "search": search_mapillary, "parse": parse_mapillary},
    "flickr": {"env": "FLICKR_API_KEY", "probe": probe_flickr, "search": search_flickr, "parse": parse_flickr},
    "kartaview": {"env": None, "probe": probe_kartaview, "search": search_kartaview, "parse": parse_kartaview},
    "panoramax": {"env": None, "probe": probe_panoramax, "search": search_panoramax, "parse": parse_panoramax},
}
KEY_HELP = {
    "MAPILLARY_TOKEN": "free: mapillary.com/dashboard/developers -> Register application -> Client Token",
    "FLICKR_API_KEY": "free non-commercial key: flickr.com/services/apps/create (needs a Flickr account)",
}

# Never add these. Checked in collect() as a second line of defence.
FORBIDDEN_HOST_RE = re.compile(r"(^|\.)(google|googleapis|gstatic|googleusercontent|ggpht)\.", re.I)


# --------------------------------------------------------------------------------------------
# Manifest
# --------------------------------------------------------------------------------------------

REQUIRED_ITEM_KEYS = ("source", "url", "page_url", "author", "license", "license_url", "lat", "lon",
                      "capture_date", "width", "height", "usage")


def filter_items(items: list[dict], target: dict) -> list[dict]:
    """Dedupe, drop forbidden hosts, drop far-away geotagged hits, sort best first."""
    seen, out = set(), []
    for it in items:
        key = it.get("page_url") or it["id"]
        if key in seen or it["id"] in seen:
            continue
        if any(FORBIDDEN_HOST_RE.search(urllib.parse.urlsplit(u or "").netloc or "") for u in (it["url"], it["thumb_url"], it["page_url"])):
            continue
        # Geotagged photo far outside the search area: probably a mis-match from a text query.
        if it["distance_m"] is not None and it["match"] != "geo" and it["distance_m"] > max(1500, 4 * target["radius_m"]):
            continue
        seen.add(key)
        seen.add(it["id"])
        out.append(it)
    rank = {"geo": 0, "category": 1, "text": 2}
    out.sort(key=lambda i: (rank.get(i["match"], 3), i["distance_m"] if i["distance_m"] is not None else 1e9))
    return out


def build_manifest(target: dict, items: list[dict], source_stats: dict) -> dict:
    by_lic, by_src, by_usage = {}, {}, {}
    for it in items:
        by_lic[it["license"]] = by_lic.get(it["license"], 0) + 1
        by_src[it["source"]] = by_src.get(it["source"], 0) + 1
        by_usage[it["usage"]] = by_usage.get(it["usage"], 0) + 1
    t = {k: v for k, v in target.items() if k not in ("queries", "commons_categories")}
    t["bbox"] = list(target["bbox"])
    return {
        "schema": "vncity.refs/1",
        "tool": f"tools/ref_images.py {TOOL_VERSION}",
        "generated_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "target": t,
        "queries": {"text": target.get("queries", []), "commons_categories": target.get("commons_categories", [])},
        "policy": {
            "allowed_licences": ["CC0", "Public domain", "CC BY", "CC BY-SA"],
            "excluded": ["NC", "ND", "GFDL-only", "all rights reserved", "Google Street View/Maps/Earth"],
            "usage": {"texture_ok": "CC0/PD/CC BY: may be used as texture or traced, with attribution for CC BY",
                      "reference_only": "CC BY-SA: look only; tracing/cropping/projecting makes the asset BY-SA"},
        },
        "sources": source_stats,
        "counts": {"total": len(items), "by_source": by_src, "by_license": by_lic, "by_usage": by_usage},
        "items": items,
    }


def validate_manifest(m: dict) -> list[str]:
    errs = []
    for k in ("schema", "target", "sources", "counts", "items"):
        if k not in m:
            errs.append(f"missing {k}")
    for i, it in enumerate(m.get("items", [])):
        for k in REQUIRED_ITEM_KEYS:
            if k not in it:
                errs.append(f"item {i} missing {k}")
        if it.get("usage") not in ("reference_only", "texture_ok"):
            errs.append(f"item {i} bad usage {it.get('usage')}")
        lic = normalize_licence(it.get("license"), it.get("license_url"))
        if lic is None:
            errs.append(f"item {i} licence not allowed: {it.get('license')}")
        elif usage_for(lic["code"]) != it.get("usage"):
            errs.append(f"item {i} usage {it.get('usage')} inconsistent with {it.get('license')}")
    return errs


# --------------------------------------------------------------------------------------------
# Run
# --------------------------------------------------------------------------------------------

def probe_sources(http: Http, names: list[str]) -> dict[str, dict]:
    status = {}
    for name in names:
        src = SOURCES[name]
        env = src["env"]
        if env and not os.environ.get(env):
            status[name] = {"status": "skipped_no_key", "message": f"set {env} ({KEY_HELP[env]})"}
            print(f"[{name}] skipped: {env} not set -> {KEY_HELP[env]}", file=sys.stderr)
            continue
        try:
            src["probe"](http)
            status[name] = {"status": "ok", "message": ""}
            print(f"[{name}] reachable", file=sys.stderr)
        except Unreachable as e:
            status[name] = {"status": "unreachable", "message": str(e)}
            print(f"[{name}] UNREACHABLE: {e}", file=sys.stderr)
        except urllib.error.HTTPError as e:
            status[name] = {"status": "error", "message": f"HTTP {e.code}: {e.reason}"}
            print(f"[{name}] error: HTTP {e.code} {e.reason}", file=sys.stderr)
        except Exception as e:  # noqa: BLE001 - report and keep going with other sources
            status[name] = {"status": "error", "message": repr(e)}
            print(f"[{name}] error: {e!r}", file=sys.stderr)
    return status


def collect(http: Http, target: dict, status: dict[str, dict], limit: int) -> dict:
    items, stats = [], {}
    for name, st in status.items():
        s = dict(st, raw=0, kept=0, rejected_licence=0)
        if st["status"] == "ok":
            src = SOURCES[name]
            try:
                for payload, match in src["search"](http, target, limit):
                    got, rej = src["parse"](payload, target, match)
                    s["raw"] += len(got) + rej
                    s["rejected_licence"] += rej
                    items.extend(got)
            except Unreachable as e:
                s.update(status="unreachable", message=str(e))
            except Exception as e:  # noqa: BLE001
                s.update(status="error", message=repr(e))
                print(f"[{name}] {target['id']}: {e!r}", file=sys.stderr)
        stats[name] = s
    kept = filter_items(items, target)
    for name in stats:
        stats[name]["kept"] = sum(1 for i in kept if i["source"] == name)
    return build_manifest(target, kept, stats)


def download(http: Http, manifest: dict, folder: Path, max_n: int) -> int:
    folder.mkdir(parents=True, exist_ok=True)
    n = 0
    for it in manifest["items"]:
        if n >= max_n:
            break
        url = it.get("thumb_url") or it.get("url")
        if not url:
            continue
        name = f"{it['source']}_{re.sub(r'[^A-Za-z0-9_-]+', '_', str(it['id'].split(':', 1)[1]))[:60]}.jpg"
        dest = folder / name
        if not dest.exists():
            try:
                data = http.get(url, headers={"Accept": "image/*"})
            except Exception as e:  # noqa: BLE001
                print(f"  download failed {url}: {e}", file=sys.stderr)
                continue
            data = _shrink(data)
            dest.write_bytes(data)
        it["local_file"] = str(dest.relative_to(folder.parent))
        n += 1
    return n


def _shrink(data: bytes) -> bytes:
    try:
        from PIL import Image
    except ImportError:
        return data
    try:
        im = Image.open(io.BytesIO(data))
        if im.width <= MAX_THUMB_W:
            return data
        im = im.convert("RGB")
        im.thumbnail((MAX_THUMB_W, MAX_THUMB_W * 4))
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=88)
        return buf.getvalue()
    except Exception:  # noqa: BLE001 - not an image we can read; keep the bytes
        return data


def write_attribution(out_dir: Path) -> Path:
    lines = ["# Ảnh tham chiếu: ghi công / Reference photo attribution", "",
             "Sinh tự động bởi `tools/ref_images.py`. Không sửa tay; chạy lại tool để cập nhật.", "",
             "- `texture_ok`: CC0 / public domain / CC BY. Được dùng làm texture hoặc vẽ theo; CC BY phải ghi công như dưới.",
             "- `reference_only`: CC BY-SA. Chỉ để nhìn. Không cắt, can, chiếu lên mesh.", ""]
    for mf in sorted(out_dir.glob("*/manifest.json")):
        m = json.loads(mf.read_text(encoding="utf-8"))
        t = m["target"]
        lines += [f"## {t.get('name_vi') or t['id']} (`{t['id']}`)", ""]
        if not m["items"]:
            lines += ["_Chưa có ảnh._", ""]
            continue
        for it in m["items"]:
            author = f"[{it['author']}]({it['author_url']})" if it.get("author_url") else it["author"]
            title = (it.get("title") or it["id"]).replace("[", "(").replace("]", ")")
            lines.append(f"- [{title}]({it['page_url']}) by {author}, [{it['license']}]({it['license_url']}), "
                         f"{SOURCE_LABEL.get(it['source'], it['source'])}. `{it['usage']}`")
        lines.append("")
    path = out_dir / "ATTRIBUTION.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--landmarks", help="comma-separated landmark ids from landmarks.json")
    ap.add_argument("--all-landmarks", action="store_true")
    ap.add_argument("--streets", help="comma-separated Old Quarter street names, e.g. 'Hàng Bạc,Tạ Hiện'")
    ap.add_argument("--all-streets", action="store_true")
    ap.add_argument("--bbox", help="lon_min,lat_min,lon_max,lat_max (extra target)")
    ap.add_argument("--bbox-name", default="bbox")
    ap.add_argument("--old-quarter", action="store_true",
                    help="extra target 'pho_co': bbox of all listed streets + Commons 'Category:Old Quarter, Hanoi'")
    ap.add_argument("--sources", default=",".join(SOURCES), help=f"subset of {','.join(SOURCES)}")
    ap.add_argument("--limit", type=int, default=50, help="max results per query")
    ap.add_argument("--download", action="store_true", help=f"download thumbnails (<= {MAX_THUMB_W}px wide)")
    ap.add_argument("--max-download", type=int, default=20, help="per target")
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--rate", type=float, default=1.0, help="min seconds between requests to one host")
    ap.add_argument("--check", action="store_true", help="only probe sources and exit")
    a = ap.parse_args(argv)

    names = [s.strip() for s in a.sources.split(",") if s.strip()]
    bad = [s for s in names if s not in SOURCES]
    if bad:
        ap.error(f"unknown sources {bad}; choose from {list(SOURCES)}")
    if not os.environ.get("REFS_CONTACT"):
        print("note: set REFS_CONTACT=<email or url> so API operators can contact you (User-Agent).", file=sys.stderr)
    http = Http(min_interval=a.rate)
    status = probe_sources(http, names)
    if a.check:
        print(json.dumps(status, ensure_ascii=False, indent=1))
        return 0

    targets = []
    lm = load_landmarks()
    ids = list(lm) if a.all_landmarks else [x.strip() for x in (a.landmarks or "").split(",") if x.strip()]
    for i in ids:
        if i not in lm:
            ap.error(f"unknown landmark {i}")
        targets.append(landmark_target(lm[i]))
    streets = list(STREETS) if a.all_streets else [unicodedata.normalize("NFC", x.strip()) for x in (a.streets or "").split(",") if x.strip()]
    for s in streets:
        if s not in STREETS:
            ap.error(f"unknown street {s}; known: {', '.join(STREETS)}")
        targets.append(street_target(s))
    if a.old_quarter:
        bb = [st["bbox"] for st in STREETS.values()]
        t = bbox_target("pho_co", (min(b[0] for b in bb), min(b[1] for b in bb), max(b[2] for b in bb), max(b[3] for b in bb)))
        t.update(name_vi="Phố cổ Hà Nội", name_en="Hanoi Old Quarter", queries=["Phố cổ Hà Nội", "Hanoi Old Quarter street"],
                 commons_categories=["Old Quarter, Hanoi", "Streets in Hoàn Kiếm District"])
        targets.append(t)
    if a.bbox:
        targets.append(bbox_target(a.bbox_name, tuple(float(v) for v in a.bbox.split(","))))
    if not targets:
        ap.error("no targets: use --landmarks/--all-landmarks/--streets/--all-streets/--bbox")
    if not any(s["status"] == "ok" for s in status.values()):
        print("warning: no source is reachable; manifests will be empty but record why.", file=sys.stderr)

    out = Path(a.out)
    summary = {}
    for t in targets:
        m = collect(http, t, status, a.limit)
        folder = out / t["id"]
        folder.mkdir(parents=True, exist_ok=True)
        if a.download and m["items"]:
            m["downloaded"] = download(http, m, folder / "img", a.max_download)
        (folder / "manifest.json").write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")
        summary[t["id"]] = m["counts"]
        print(f"{t['id']}: {m['counts']['total']} items {m['counts']['by_source']} {m['counts']['by_license']}")
    write_attribution(out)
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
