"""No real trademark may reach the player (docs/gdd/07-tham-dinh-trieu-do.md, risk 4; item 11).
Real names live only in reference fields (`modelling.real_name`, `inspired_by`, `name_keywords`,
`reference_sources`, `notes`); everything the game shows uses the parody names (Hồng Đạt, Giamaha,
App Vồ, MặtBook, Thời Gian City, Hoàng Gia City, Ê Ông Mall, Lốt Tê...)."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "game" / "content"

# Keys whose values are reference data, never shown in game.
REFERENCE_KEYS = {"inspired_by", "real_name", "name_keywords", "reference_sources", "notes", "sources", "reference"}
# (pattern, vi_only): vi_only patterns are English words that are also brands.
TRADEMARKS = [
    (r"Aeon|AEON", False), (r"\bLotte\b", False), (r"Times City", False), (r"Royal City", False),
    (r"Vinhomes|Vincom|VinFast|Vinmart|Winmart", False), (r"Keangnam", False), (r"\bGrab\b", True),
    (r"Gojek|Shopee|Zalo|Facebook|TikTok|Instagram|YouTube|Google|Momo|ZaloPay", False),
    (r"Highlands|Starbucks|Phúc Long|Circle K|Big C", False),
    (r"\bHonda\b|\bYamaha\b|\bVespa\b|Piaggio|Suzuki|Toyota|Hyundai", False),
    (r"Samsung|iPhone|\bApple\b", True), (r"Heineken|Viettel|Vietcombank|Techcombank", False),
]


def _strings(node, key=None):
    if isinstance(node, dict):
        for k, v in node.items():
            if k in REFERENCE_KEYS:
                continue
            yield from _strings(v, k)
    elif isinstance(node, list):
        for v in node:
            yield from _strings(v, key)
    elif isinstance(node, str):
        yield key, node


def test_no_real_trademark_in_player_facing_text():
    hits = []
    for p in sorted(CONTENT.rglob("*.json")):
        doc = json.loads(p.read_text(encoding="utf-8"))
        for key, s in _strings(doc):
            for pat, vi_only in TRADEMARKS:
                if vi_only and key != "vi":
                    continue
                if re.search(pat, s):
                    hits.append(f"{p.relative_to(ROOT)}: {key}: {s[:80]!r} matches {pat}")
    assert not hits, "\n".join(hits)


def test_brand_landmarks_keep_real_name_as_reference_only():
    marks = json.loads((CONTENT / "world" / "landmarks.json").read_text(encoding="utf-8"))["items"]
    with_real = {l["id"] for l in marks if l["modelling"].get("real_name")}
    assert {"landmark_72", "lotte_center", "times_city", "royal_city", "aeon_long_bien"} <= with_real
