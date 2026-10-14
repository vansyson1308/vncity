"""Write docs/11-cac-quan.md and docs/img/districts_preview.png from out/districts.json.

Run after `python -m pipeline.run_districts`. The index out/districts.json is not committed (out/ is
build output); this turns it into the committed record of what was built, so the docs say what the
UE5 importer will find.

Usage:
  python tools/district_doc.py
"""

import json
import pathlib

from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / "out" / "districts.json"
DOC = ROOT / "docs" / "11-cac-quan.md"
IMG = ROOT / "docs" / "img" / "districts_preview.png"
CONFIG = ROOT / "pipeline" / "districts.json"

NAMES = {"hoan_kiem": "Hoàn Kiếm (phố cổ + hồ Gươm)", "ba_dinh": "Ba Đình", "dong_da": "Đống Đa",
         "hai_ba_trung": "Hai Bà Trưng", "tay_ho": "Tây Hồ", "cau_giay": "Cầu Giấy", "thanh_xuan": "Thanh Xuân",
         "hoang_mai": "Hoàng Mai", "long_bien": "Long Biên", "nam_tu_liem": "Nam Từ Liêm (Mỹ Đình)",
         "bac_tu_liem": "Bắc Từ Liêm", "ha_dong": "Hà Đông"}


def montage(names, cols=4, cell=420):
    tiles = []
    for n in names:
        p = ROOT / "out" / n / "preview.png"
        if not p.exists():
            continue
        im = Image.open(p).convert("RGB")
        im.thumbnail((cell, cell))
        canvas = Image.new("RGB", (cell, cell + 28), "white")
        canvas.paste(im, ((cell - im.width) // 2, 0))
        ImageDraw.Draw(canvas).text((6, cell + 6), NAMES.get(n, n), fill="black")
        tiles.append(canvas)
    if not tiles:
        return None
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 28)), "white")
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * cell, (i // cols) * (cell + 28)))
    return sheet


def main():
    idx = json.loads(INDEX.read_text(encoding="utf-8"))
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    order = [n for n in cfg["districts"] if n in idx["districts"]]
    d = idx["districts"]
    tot = {k: sum(d[n][k] for n in order) for k in ("buildings", "tiles", "triangles", "road_km", "props", "places", "signals")}
    arch = {}
    for n in order:
        for k, v in d[n]["archetypes"].items():
            arch[k] = arch.get(k, 0) + v
    L = ["# 11. Mười hai quận nội thành", "",
         "Dựng ngày 14/10/2026 bằng `python -m pipeline.run_districts` từ một lần tải Overture 2026-09-23.0 cho khung "
         f"{cfg['cache']['bbox']} (663.712 tòa nhà, 112.829 đoạn đường, tải 2m43s + 1m55s lớp ngữ cảnh), rồi cắt theo quận "
         "bằng `pipeline/subset.py` (không tải lại). Mọi quận dùng **một gốc tọa độ** (hồ Gươm, "
         f"{idx['origin']['lat']}, {idx['origin']['lon']}) nên `out/<quận>/tiles/*.glb` đặt cạnh nhau là khớp; ô 500 m, "
         "khóa ô `ix_iy` tính từ gốc chung, các khung chồng mép nhau nên ô ở ranh giới xuất hiện ở hai quận (importer lấy một).", "",
         "**Tên quận.** Hà Nội bỏ cấp quận từ 1/7/2025 (phường trực thuộc thành phố). Game vẫn gọi theo quận cũ vì dữ liệu mở, "
         "ảnh đường phố và người Hà Nội vẫn nói \"Ba Đình\", \"Cầu Giấy\"; các vùng ở đây là *khu vực chơi*, ranh giới là khung "
         "chữ nhật trong `pipeline/districts.json`, không phải ranh giới hành chính. Tên phường mới được gắn vào từng tòa nhà "
         "qua `semantics/footprints_*.json` (`ward`).", "",
         "| Quận | Tòa nhà | Ô 500 m | Tam giác | Đường (km) | Nút đèn | Liên thông | Cửa hàng/POI | Đạo cụ PCG | Thời gian |",
         "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for n in order:
        r = d[n]
        L.append(f"| {NAMES.get(n, n)} | {r['buildings']:,} | {r['tiles']} | {r['triangles']/1e6:.1f} tr | {r['road_km']:,.0f} | "
                 f"{r['signals']} | {100*r['largest_component_share']:.0f}% | {r['places']:,} | {r['props']:,} | {r['seconds']} s |")
    L.append(f"| **Tổng** | **{tot['buildings']:,}** | **{tot['tiles']}** | **{tot['triangles']/1e6:.0f} tr** | **{tot['road_km']:,.0f}** | "
             f"**{tot['signals']}** | | **{tot['places']:,}** | **{tot['props']:,}** | |")
    L += ["", "Số liệu đọc từ `out/districts.json` (sinh bởi `run_districts.py`); đường km và nút đèn tính trên đồ thị xe chạy "
          "được của từng khung nên đoạn đường ở ranh giới được đếm hai lần.", "",
          "## Kiểu nhà trên toàn nội thành", "",
          "| Kiểu nhà | Số tòa | Tỷ lệ |", "| --- | ---: | ---: |"]
    for k, v in sorted(arch.items(), key=lambda kv: -kv[1]):
        L.append(f"| `{k}` | {v:,} | {100*v/tot['buildings']:.1f}% |")
    L += ["", "Phân loại theo luật trong `pipeline/semantics.py` với vùng phố cổ / phố Pháp vẽ tay; ngoài lõi, "
          "`lien_ke_kdt` nhận ra dãy nhà đều của khu đô thị mới (Linh Đàm, Văn Quán, Mỹ Đình), `khu_tap_the` nhận ra nhà tấm "
          "lớn ở Kim Liên, Thành Công, Giảng Võ, Thanh Xuân Bắc. Cần người kiểm mẫu ở mỗi quận (xem `07-qc-checklist.md`).", "",
          "## Đạo cụ theo quận", "",
          "`game/assets/asset_specs.json` mục `district_sets` ghi bộ đạo cụ cần cho mỗi quận (bộ sẵn có + 11 bộ mới: "
          "`metro_rail`, `national_rail`, `river_dike`, `lakeside`, `rooftop_clutter`, `kdt_moi`, `road_structures`, `ktt_addons`, "
          "`lang_trong_pho`, `cho_coc`, `pavement_clutter`); các bộ mới chưa được bước `scatter` rải tự động, mới có hợp đồng kích "
          "thước và prompt tham chiếu (`08-nguon-tai-san-3d.md`).", "",
          "## Xem trước", "", "![12 quận, tô màu theo nguồn chiều cao](img/districts_preview.png)", "",
          "Từng quận: `out/<quận>/preview.png` (khối nhà) và `preview_semantic.png` (kiểu nhà, mặt tiền, đạo cụ quanh tâm quận).", "",
          "## Chưa làm", "",
          "- Huyện ngoại thành (Gia Lâm, Đông Anh, Thanh Trì, Hoài Đức): khung đã ghi ở `pipeline/districts.json` mục `later`, "
          "cần một lần tải riêng vì nằm ngoài khung cache.",
          "- Ghép 12 bộ ô thành một thế giới trong UE5: importer đọc `out/districts.json` để lấy danh sách; trùng ô ở mép lấy quận đứng trước.",
          "- Sông Hồng, Hồ Tây làm mặt nước: lớp `water.parquet` đã có trong cache, chưa xuất mesh."]
    DOC.write_text("\n".join(L) + "\n", encoding="utf-8")
    sheet = montage(order)
    if sheet is not None:
        IMG.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(IMG, optimize=True)
    print(f"{DOC.relative_to(ROOT)}: {len(order)} districts, {tot['buildings']:,} buildings")


if __name__ == "__main__":
    main()
