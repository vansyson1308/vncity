"""Offline tests for tools/ref_images.py: licence filter and manifest shape on canned API JSON."""

import json

import pytest

from tools import ref_images as ri

TARGET = ri.street_target("Hàng Bạc")


@pytest.mark.parametrize("raw,url,code", [
    ("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "cc-by-sa"),
    ("CC BY 2.0", None, "cc-by"),
    ("CC-BY-SA-3.0,2.5,2.0,1.0", None, "cc-by-sa"),
    ("CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "cc0"),
    ("Public domain", None, "pd"),
    ("PD-self", None, "pd"),
    ("cc by-sa 2.0", None, "cc-by-sa"),          # Openverse style
    ("pdm 1.0", None, "pd"),
    ("CC-BY-SA-4.0", None, "cc-by-sa"),           # Panoramax style
    (None, "https://creativecommons.org/licenses/by/4.0/", "cc-by"),
])
def test_allowed_licences(raw, url, code):
    lic = ri.normalize_licence(raw, url)
    assert lic is not None and lic["code"] == code
    assert lic["url"].startswith("http")


@pytest.mark.parametrize("raw,url", [
    ("CC BY-NC-SA 2.0", None),
    ("CC BY-ND 4.0", None),
    ("CC BY-NC 4.0", None),
    ("cc by-nc-nd 4.0", None),
    ("CC BY 2.0", "https://creativecommons.org/licenses/by-nc/2.0/"),  # URL contradicts name: reject
    ("GFDL", None),
    ("All rights reserved", None),
    ("etalab-2.0", None),
    ("", None),
    (None, None),
])
def test_rejected_licences(raw, url):
    assert ri.normalize_licence(raw, url) is None


def test_usage_rule():
    assert ri.usage_for("cc0") == ri.usage_for("pd") == ri.usage_for("cc-by") == "texture_ok"
    assert ri.usage_for("cc-by-sa") == "reference_only"


COMMONS = {"query": {"pages": [
    {"pageid": 101, "title": "File:Hang Bac street.jpg", "coordinates": [{"lat": 21.03390, "lon": 105.85220}],
     "imageinfo": [{"url": "https://upload.wikimedia.org/wikipedia/commons/a/ab/Hang_Bac_street.jpg",
                    "thumburl": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Hang_Bac_street.jpg/1600px-Hang_Bac_street.jpg",
                    "descriptionurl": "https://commons.wikimedia.org/wiki/File:Hang_Bac_street.jpg",
                    "width": 4000, "height": 3000, "mime": "image/jpeg",
                    "extmetadata": {"LicenseShortName": {"value": "CC BY-SA 4.0"},
                                    "LicenseUrl": {"value": "https://creativecommons.org/licenses/by-sa/4.0"},
                                    "Artist": {"value": "<a href=\"//commons.wikimedia.org/wiki/User:Someone\">Someone</a>"},
                                    "DateTimeOriginal": {"value": "2019-03-02 10:11:12"}}}]},
    {"pageid": 102, "title": "File:Old house.jpg", "coordinates": [{"lat": 21.0340, "lon": 105.8523}],
     "imageinfo": [{"url": "https://upload.wikimedia.org/x.jpg", "descriptionurl": "https://commons.wikimedia.org/wiki/File:Old_house.jpg",
                    "width": 800, "height": 600, "mime": "image/jpeg",
                    "extmetadata": {"LicenseShortName": {"value": "Public domain"}, "Artist": {"value": "Unknown"},
                                    "DateTimeOriginal": {"value": "circa 1915"}}}]},
    {"pageid": 103, "title": "File:NC photo.jpg",
     "imageinfo": [{"url": "https://upload.wikimedia.org/y.jpg", "descriptionurl": "https://commons.wikimedia.org/wiki/File:NC.jpg",
                    "width": 10, "height": 10, "mime": "image/jpeg",
                    "extmetadata": {"LicenseShortName": {"value": "CC BY-NC 2.0"}}}]},
    {"pageid": 104, "title": "File:Map.pdf",
     "imageinfo": [{"url": "https://upload.wikimedia.org/z.pdf", "mime": "application/pdf", "extmetadata": {}}]},
]}}

OPENVERSE = {"result_count": 3, "results": [
    {"id": "ov-1", "title": "Hang Bac", "url": "https://live.staticflickr.com/1/1_o.jpg", "foreign_landing_url": "https://www.flickr.com/photos/a/1",
     "creator": "alice", "creator_url": "https://www.flickr.com/photos/a", "license": "by", "license_version": "2.0",
     "license_url": "https://creativecommons.org/licenses/by/2.0/", "provider": "flickr", "source": "flickr", "width": 1024, "height": 768},
    {"id": "ov-2", "title": "Lantern", "url": "https://x/2.jpg", "foreign_landing_url": "https://x/2", "creator": "bob",
     "license": "by-nc", "license_version": "2.0", "license_url": "https://creativecommons.org/licenses/by-nc/2.0/", "source": "flickr"},
    {"id": "ov-3", "title": "Cathedral", "url": "https://x/3.jpg", "foreign_landing_url": "https://x/3", "creator": "carol",
     "license": "cc0", "license_version": "1.0", "license_url": "https://creativecommons.org/publicdomain/zero/1.0/", "source": "wikimedia"},
]}

MAPILLARY = {"data": [
    {"id": "555", "captured_at": 1672531200000, "compass_angle": 90.0, "computed_geometry": {"type": "Point", "coordinates": [105.8521, 21.0339]},
     "creator": {"username": "mapper", "id": "9"}, "width": 2048, "height": 1536, "is_pano": False,
     "thumb_1024_url": "https://scontent.mapillary/1024.jpg", "thumb_original_url": "https://scontent.mapillary/orig.jpg"},
]}

FLICKR = {"photos": {"page": 1, "photo": [
    {"id": "1", "owner": "1@N0", "ownername": "dan", "title": "Ta Hien", "license": "12", "latitude": "21.0346", "longitude": "105.8520",
     "datetaken": "2018-07-01 20:00:00", "url_l": "https://live.staticflickr.com/l.jpg", "width_l": "1024", "height_l": "683"},
    {"id": "2", "owner": "2@N0", "ownername": "eve", "title": "NC one", "license": "2", "latitude": "21.0346", "longitude": "105.8520"},
    {"id": "3", "owner": "3@N0", "ownername": "fay", "title": "BY-ND", "license": "6"},
]}}


def _all_items():
    items, rejected = [], 0
    for parser, payload, match in [(ri.parse_commons, COMMONS, "geo"), (ri.parse_openverse, OPENVERSE, "text"),
                                   (ri.parse_mapillary, MAPILLARY, "geo"), (ri.parse_flickr, FLICKR, "geo")]:
        got, rej = parser(payload, TARGET, match)
        items += got
        rejected += rej
    return items, rejected


def test_parsers_filter_licences():
    items, rejected = _all_items()
    ids = {i["id"] for i in items}
    assert ids == {"commons:101", "commons:102", "openverse:ov-1", "openverse:ov-3", "mapillary:555", "flickr:1"}
    assert rejected == 1 + 1 + 2  # commons NC, openverse NC, flickr NC + ND
    by_id = {i["id"]: i for i in items}
    assert by_id["commons:101"]["usage"] == "reference_only"
    assert by_id["commons:101"]["author"] == "Someone"
    assert by_id["commons:101"]["author_url"] == "https://commons.wikimedia.org/wiki/User:Someone"
    assert by_id["commons:101"]["capture_date"] == "2019-03-02"
    assert by_id["commons:102"]["usage"] == "texture_ok" and by_id["commons:102"]["capture_date"] == "1915"
    assert by_id["openverse:ov-1"]["license"] == "CC BY 2.0" and by_id["openverse:ov-1"]["usage"] == "texture_ok"
    assert by_id["mapillary:555"]["license"] == "CC BY-SA 4.0" and by_id["mapillary:555"]["capture_date"] == "2023-01-01"
    assert by_id["flickr:1"]["license"] == "CC BY-SA 4.0" and by_id["flickr:1"]["lat"] == pytest.approx(21.0346)


def test_manifest_shape_and_roundtrip():
    items, _ = _all_items()
    kept = ri.filter_items(items, TARGET)
    stats = {"commons": {"status": "ok", "message": "", "raw": 4, "kept": 2, "rejected_licence": 1}}
    m = json.loads(json.dumps(ri.build_manifest(TARGET, kept, stats), ensure_ascii=False))
    assert ri.validate_manifest(m) == []
    assert m["target"]["id"] == "pho_hang_bac"
    assert m["counts"]["total"] == len(kept) == 6
    assert m["counts"]["by_usage"] == {"reference_only": 3, "texture_ok": 3}
    for it in m["items"]:
        for k in ri.REQUIRED_ITEM_KEYS:
            assert k in it
    # geo matches come first, nearest first; text-only matches last
    assert m["items"][-1]["match"] == "text"


def test_validate_catches_bad_items():
    items, _ = _all_items()
    m = ri.build_manifest(TARGET, ri.filter_items(items, TARGET), {})
    m["items"][0]["usage"] = "texture_ok" if m["items"][0]["usage"] == "reference_only" else "reference_only"
    m["items"][1]["license"] = "CC BY-NC 4.0"
    m["items"][1]["license_url"] = "https://creativecommons.org/licenses/by-nc/4.0/"
    del m["items"][2]["author"]
    errs = ri.validate_manifest(m)
    assert any("inconsistent" in e for e in errs)
    assert any("not allowed" in e for e in errs)
    assert any("missing author" in e for e in errs)


def test_filter_drops_google_and_duplicates():
    items, _ = _all_items()
    dup = dict(items[0])
    goog = dict(items[1], id="commons:999", page_url="https://maps.google.com/x", url="https://lh3.googleusercontent.com/p.jpg")
    kept = ri.filter_items(items + [dup, goog], TARGET)
    assert len(kept) == len(items)
    assert all("google" not in (i["url"] or "") for i in kept)


def test_targets():
    lm = ri.load_landmarks()
    for lid in ("thap_rua", "cau_the_huc", "nha_tho_lon", "o_quan_chuong"):
        t = ri.landmark_target(lm[lid])
        w, s, e, n = t["bbox"]
        assert w < t["lon"] < e and s < t["lat"] < n
    for name in ri.STREETS:
        t = ri.street_target(name)
        assert t["id"].startswith("pho_") and t["id"].isascii()
        assert 21.02 < t["lat"] < 21.045 and 105.84 < t["lon"] < 105.86
    assert ri.street_target("Hàng Đào")["id"] == "pho_hang_dao"


def test_attribution_file(tmp_path):
    items, _ = _all_items()
    m = ri.build_manifest(TARGET, ri.filter_items(items, TARGET), {})
    (tmp_path / TARGET["id"]).mkdir()
    (tmp_path / TARGET["id"] / "manifest.json").write_text(json.dumps(m, ensure_ascii=False), encoding="utf-8")
    text = ri.write_attribution(tmp_path).read_text(encoding="utf-8")
    assert "Phố Hàng Bạc" in text and "CC BY-SA 4.0" in text and "reference_only" in text
    assert text.count("\n- [") == len(m["items"])
