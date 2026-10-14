"""Image-generation prompt pack for the 3D assets in game/assets/asset_specs.json.

Every mesh the city data places has a size, pivot and look in asset_specs.json. This script turns
that contract into prompts an image generator (e.g. Codex with an imagegen skill) can run one by
one, with a fixed output path per image so the next steps (image -> 3D, texturing, checks) find
them:

  ref_sheet     orthographic turnaround on a flat grey background: input for image-to-3D and the
                modelling reference (one per prop variant group)
  sign_print    the printed background of a shop sign (one per variant); the fictional Vietnamese
                shop name in "text" is rendered in UE with an OFL font, because image models still
                misspell Vietnamese diacritics
  facade        straight-on elevation of one facade kit module (input for trim sheets / relief)
  texture       seamless PBR base-colour tiles for the kit and prop materials

Output: game/assets/prompts.jsonl (one JSON object per line) and a summary on stdout.
`--check` fails when the committed file is out of date (CI runs it).

Usage:
  python tools/asset_prompts.py [--check]
"""

import argparse
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPECS = ROOT / "game" / "assets" / "asset_specs.json"
OUT = ROOT / "game" / "assets" / "prompts.jsonl"
WORK = "assets_work"  # gitignored; generated images and meshes land here

STYLE = ("photorealistic, physically plausible materials, true-to-scale proportions, "
         "contemporary Hanoi, Vietnam")
SHEET = ("orthographic product turnaround sheet: front, left side, back and top views plus one 3/4 view, "
         "each view separate, flat neutral mid-grey background (#808080), soft even studio light, "
         "no cast shadows, no perspective distortion, nothing cropped, no text or labels")
NEGATIVE = ["brand names", "logos", "trademarks", "watermarks", "people", "cast shadows",
            "perspective distortion", "cropped object", "text labels on the sheet"]

# Fictional shop names per sign family: plausible Hanoi signage, not copied from real shops.
SHOP_NAMES = {
    "food": ["Phở Bò Hương Liên", "Bún Chả Cô Hằng", "Cơm Bình Dân Minh Tâm", "Bánh Cuốn Bà Hoa",
             "Bún Riêu Hồng Nhung", "Miến Lươn Phúc Lộc", "Xôi Chè Thu Hà", "Bánh Mì Anh Tuấn"],
    "cafe": ["Cà Phê Gác Nhỏ", "Cafe Mùa Thu", "Cà Phê Phố Cũ", "Cafe Hoa Sữa", "Cà Phê Trứng Nhà Mây",
             "Cafe Góc Phố", "Cà Phê Ban Công", "Cafe Lặng"],
    "bar": ["Bia Hơi Thanh Bình", "Bia Hơi 68", "Quán Nhậu Hương Quê", "Bia Tươi Phố Cổ",
            "Bia Hơi Hải Đăng", "Lẩu Nướng Bạn Hiền", "Bia Hơi Ngã Tư", "Quán Gió"],
    "lodging": ["Khách Sạn Ngân Hà Phố", "Nhà Nghỉ Bình An", "Old Lantern Hostel", "Khách Sạn Phố Hoa",
                "Nhà Nghỉ Thu Trang", "Lotus Garden Inn", "Khách Sạn Sen Vàng", "Nhà Nghỉ Hồ Xanh"],
    "fashion": ["Thời Trang Thu Hà", "Giày Dép Minh Anh", "Shop Mây", "Thời Trang Ngọc Lan",
                "Vải Lụa Hà Đông Xưa", "Áo Dài Phương Thảo", "Túi Ví Hằng Nga", "Thời Trang Nam An"],
    "beauty": ["Gội Đầu Dưỡng Sinh Hoa Mai", "Salon Tóc Anh Dũng", "Spa Ngọc Bích", "Cắt Tóc Nam Hùng",
               "Nail Mi Mi", "Gội Đầu Thảo Dược", "Salon Linh Chi", "Massage Chân Bình Yên"],
    "travel": ["Tour Hạ Long Sapa Giá Rẻ", "Vé Xe Khách Bắc Nam", "Đại Lý Vé Máy Bay Minh Châu",
               "Old Quarter Travel", "Thuê Xe Máy Tự Lái", "Tour Ninh Bình Trong Ngày", "Đặt Vé Tàu", "Lữ Hành Sen"],
    "grocery": ["Tạp Hoá Minh Hoà", "Tạp Hoá Bà Năm", "Đại Lý Nước Giải Khát", "Tạp Hoá Hồng Hạnh",
                "Thực Phẩm Sạch Quê Nhà", "Gạo Ngon Thanh Hà", "Tạp Hoá 24", "Đồ Khô Hàng Bè Cũ"],
    "pharmacy": ["Nhà Thuốc Phúc Khang", "Nhà Thuốc An Bình", "Quầy Thuốc Minh Châu", "Nhà Thuốc Tâm Đức",
                 "Nhà Thuốc Số 7", "Thuốc Nam Bắc Hoà Hiệp", "Nhà Thuốc Hồng Phúc", "Nhà Thuốc Thanh Tâm"],
    "finance": ["Vàng Bạc Kim Thành", "Đổi Ngoại Tệ Minh Phát", "Tiệm Vàng Kim Phượng", "Vàng Bạc Đá Quý Kim Ngân",
                "Cầm Đồ Uy Tín", "Vàng Bạc Thịnh Phát", "Đổi Tiền Du Lịch", "Kim Hoàn Phúc Long"],
    "crafts": ["Tranh Phố Cổ", "Đồ Gỗ Mỹ Nghệ Hàng Gai", "Quà Lưu Niệm Thăng Long", "Đèn Lồng Hội An Ra Bắc",
               "Tranh Sơn Mài Hoàng Gia", "Gốm Sứ Quê Hương", "Nón Lá Làng Chuông", "Thêu Tay Tân Mỹ"],
    "hardware": ["Điện Máy Hoàng Long", "Sửa Xe Máy Anh Ba", "Kim Khí Điện Nước Toàn Thắng", "Vá Lốp 24h",
                 "Điện Lạnh Bách Khoa", "Ổ Khoá Chìa Khoá", "Sơn Nước Minh Phát", "Điện Thoại Sửa Chữa Nhanh"],
}

TEXTURES = [
    ("plaster_ochre_peeling", "yellow ochre lime-wash plaster wall of an old Hanoi tube house, peeling paint, "
                              "black mould streaks under the eaves, patches of exposed brick"),
    ("plaster_cream_french", "cream colonial French plaster facade with fine cracks and faded paint, Hanoi"),
    ("plaster_grey_concrete", "grey rendered concrete wall of a 1970s Soviet-era collective housing block, rain stains"),
    ("tile_terracotta_yin_yang", "old terracotta yin-yang (âm dương) roof tiles of a northern Vietnamese house, moss"),
    ("tile_floor_encaustic", "Vietnamese encaustic cement floor tiles (gạch bông), faded pattern"),
    ("wood_shutter_brown", "old brown-painted wooden folding shutter doors, worn paint, vertical planks"),
    ("metal_shutter_rolling", "corrugated steel roller shutter, scratched light-grey paint, rust at the bottom"),
    ("pavement_brick_hanoi", "Hanoi pavement of red or grey square concrete pavers, oil stains, uneven joints"),
    ("asphalt_hanoi_road", "worn asphalt road with patched repairs and faded white lane markings"),
    ("granite_kerb", "grey granite kerb stone, chipped edges"),
    ("glass_curtain_wall", "blue-green glass curtain wall of a 2010s Hanoi office tower, mullion grid"),
    ("brick_red_exposed", "exposed red brick with grey mortar, uneven, old"),
    ("temple_red_lacquer", "red lacquered wooden temple column and panel with gold leaf patterns, worn"),
    ("tiled_facade_white", "small white ceramic facade tiles of a modern Vietnamese tube house"),
]


def ref_sheet(p):
    s = p["size_m"]
    dims = f"{s['x']:g} m deep (along the forward axis) x {s['y']:g} m wide x {s['z']:g} m tall"
    return {"type": "ref_sheet", "asset": p["id"], "route": p["route"], "size_px": [2048, 2048],
            "prompt": f"{SHEET}. Subject: {p['look_en']}. Real size about {dims}. Forward direction: {p['forward']}. {STYLE}.",
            "avoid": NEGATIVE + p.get("avoid", []),
            "refs": f"out/refs (search: {p['references_vi']})",
            "out": f"{WORK}/{p['set']}/{p['kind']}/ref_sheet.png"}


def sign_prints(p):
    family = p["kind"].removesuffix("_vertical")
    vertical = p["kind"].endswith("_vertical")
    sells = p["name_vi"].split("(", 1)[1].rstrip(")")  # "Biển hiệu ngang (phở, bún chả, cơm)"
    rows = []
    for n, name in enumerate(SHOP_NAMES[family][:p["variants"]]):
        layout = ("tall vertical 1:4 panel, the name band running top to bottom"
                  if vertical else "wide 4:1 panel, the name band across the centre")
        rows.append({
            "type": "sign_print", "asset": p["id"], "variant": n, "size_px": [512, 2048] if vertical else [2048, 512],
            "text": {"shop_name": name, "subtitle": sells.capitalize(), "font": "Be Vietnam Pro (SIL OFL)"},
            "prompt": (f"flat front-on artwork for the printed face of a Vietnamese shop signboard, {layout}. "
                       f"Background design only: typical Hanoi signage colours (red, yellow, blue, white), simple "
                       f"borders, a small picture of what the shop sells ({family}), slight sun fading. Leave a large "
                       f"clean empty band where the shop name will be added later. NO letters, NO text, NO numbers. "
                       f"Fill the whole frame, no frame, no wall, no perspective."),
            "avoid": NEGATIVE + ["any lettering", "real shop names"],
            "out": f"{WORK}/{p['set']}/{p['kind']}/print_v{n}.png"})
    return rows


def facades(kit):
    rows = []
    feats = ", ".join(f.replace("_", " ") for f in kit["features"][:10])
    palette = ", ".join(kit["palette"])
    for m in kit["modules"]:
        s = m["size_m"]
        for n in range(kit["variants"]):
            rows.append({
                "type": "facade", "asset": f"{kit['archetype']}/{m['module']}", "variant": n,
                "size_px": [1024, max(256, round(1024 * s["z"] / s["y"]))],
                "prompt": (f"straight-on orthographic elevation of one module of a {kit['name_vi']} facade "
                           f"({kit['archetype'].replace('_', ' ')}), {m['role']}; exactly {s['y']:g} m wide and "
                           f"{s['z']:g} m tall, filling the frame edge to edge so modules tile side by side; "
                           f"flat even daylight, no perspective, no sky, no people. Typical details: {feats}. "
                           f"Colour palette: {palette}. Variant {n + 1} of {kit['variants']}: change the "
                           f"colours, wear and small details, keep the structure. {STYLE}."),
                "avoid": NEGATIVE,
                "out": f"{WORK}/kits/{kit['archetype']}/{m['module']}_v{n}.png"})
    return rows


def textures():
    return [{"type": "texture", "asset": f"material/{tid}", "size_px": [2048, 2048],
             "prompt": (f"seamless tileable square texture, top-down flat view, even diffuse light, no shadows, "
                        f"no vignetting: {desc}. 2 m x 2 m real-world area. Base colour only."),
             "avoid": NEGATIVE + ["visible seams", "perspective", "lighting gradients"],
             "out": f"{WORK}/materials/{tid}_basecolor.png"} for tid, desc in TEXTURES]


def build():
    spec = json.loads(SPECS.read_text(encoding="utf-8"))
    rows = []
    for p in spec["props"]:
        rows.append(ref_sheet(p))
        if p["set"] == "shop_signs":
            rows += sign_prints(p)
    for kit in spec["facade_kits"]:
        rows += facades(kit)
    rows += textures()
    for i, r in enumerate(rows):
        r["n"] = i
    return "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    text, rows = build()
    if a.check:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            sys.exit("game/assets/prompts.jsonl is out of date: run python tools/asset_prompts.py")
        print("prompts up to date")
        return
    OUT.write_text(text, encoding="utf-8")
    counts = {}
    for r in rows:
        counts[r["type"]] = counts.get(r["type"], 0) + 1
    print(f"{OUT.relative_to(ROOT)}: {len(rows)} prompts {counts}")


if __name__ == "__main__":
    main()
