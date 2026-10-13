# Kiến trúc dự án Hanoi City

Ý tưởng chính: **mọi thứ là dữ liệu trung lập với engine**, còn UE5 chỉ là nơi "đọc" dữ liệu đó.
Khi có SSD và cài UE 5.8, bạn mở `ue5/HanoiCity.uproject`, chạy một script, và thành phố, nhân
vật, nhiệm vụ, giao thông được nạp vào. Nếu sau này đổi sang UE6 hay engine khác, chỉ viết lại
lớp harness, không đụng đến dữ liệu.

```
 Dữ liệu thật (mở)                   Pipeline Python (repo này)                 UE 5.8 (sau này)
 ─────────────────                   ──────────────────────────                 ─────────────────
 Overture buildings ─┐               fetch.py                                   ue5/ harness
 Overture roads ─────┤   ───────►    pipeline/fetch_context.py                  ├ import_city.py   → Static mesh + Nanite, World Partition
 Overture places ────┤               pipeline/semantics.py   (kiểu nhà, mặt tiền) ├ import_pcg_points → HISM / PCG graph theo bộ kit
 Overture base ──────┤               build.py                (khối 3D glb)       ├ import_content   → DataTable từ game/content
 Copernicus DEM ─────┘               pipeline/traffic.py     (đồ thị đường)      ├ HanoiCityRuntime → Geo, thời tiết, nhiệm vụ, CSGT
                                     pipeline/scatter.py     (đạo cụ phố)        └ MCP (Claude điều khiển editor)
 Thời tiết thật ──────────────────►  live/weather.py         (HTTP JSON)  ─────► UHanoiTimeWeatherSubsystem
 Release Overture mới ─────────────► live/update_city.py     (ô cần dựng lại)
                                     game/schemas + game/content (thiết kế game dạng dữ liệu)
                                     tools/validate.py, tools/codegen_ue.py (JSON Schema → USTRUCT)
```

## Bốn lớp, đúng như cách một studio thế giới mở chia việc

| Lớp | GTA5 làm gì | Ở đây | Thư mục |
| --- | --- | --- | --- |
| 1. Hình khối thành phố | Map sector + LOD dựng tay | Khối 3D từ dữ liệu thật, tỉ lệ 1:1, ô 500 m | `fetch.py`, `build.py` |
| 2. Ngữ nghĩa | Artist chọn kiểu nhà cho từng lô | Máy phân loại 13 kiểu nhà Hà Nội, tìm cạnh hướng ra phố, gắn cửa hàng thật | `pipeline/semantics.py` |
| 3. Sự sống đường phố | Prop placement, traffic paths | Biển hiệu theo cửa hàng thật, xe máy đỗ, ghế nhựa, hàng rong, cây sấu/hoa sữa, cột điện + bó dây, đèn, đồ thị giao thông | `pipeline/scatter.py`, `pipeline/traffic.py` |
| 4. Trò chơi | Script nhiệm vụ, nhân vật, kinh tế | JSON có schema: quận, công trình, nhân vật, xe, việc làm, nhiệm vụ, hội thoại, sự kiện, luật giao thông | `game/` |

Lớp 1-3 sinh tự động từ dữ liệu, nên khi Hà Nội thay đổi (tòa nhà mới, đường mới) ta chạy lại
và chỉ dựng lại các ô bị ảnh hưởng. Lớp 4 là thiết kế, viết tay, có kiểm tra tự động.

## Hệ tọa độ (một nguồn sự thật)

- Pipeline: mét ENU (đông, bắc, lên) trong phép chiếu Transverse Mercator đặt tâm tại gốc ghi
  trong `manifest.json`.
- UE: `X = đông × 100`, `Y = −bắc × 100`, `Z = lên × 100` (cm), giống quy ước của Cesium for
  Unreal, nên sau này có thể đặt Cesium làm lớp tham chiếu trùng khít.
- Chi tiết định dạng: [pipeline-outputs.md](pipeline-outputs.md).

## Vì sao không dựng thành phố bằng tay hay bằng ảnh

Dựng tay cả Hà Nội là công sức hàng trăm người-năm. Dựng bằng ảnh Google bị điều khoản cấm (xem
[01-nghien-cuu-cong-nghe.md](01-nghien-cuu-cong-nghe.md)). Cách GTA5 cũng không phải là quét cả
thành phố. Nên ta kết hợp:

1. **Thủ tục hóa có hiểu biết địa phương** cho 99% tòa nhà: khối đúng vị trí, đúng diện tích,
   chiều cao theo kiểu nhà, mặt tiền gắn bộ kit (nhà ống phố cổ, biệt thự Pháp, tập thể…).
2. **Công trình biểu tượng dựng tay hoặc photogrammetry** (danh sách và độ ưu tiên ở
   `game/content/world/landmarks.json`): Tháp Rùa, cầu Thê Húc, Nhà hát Lớn, cầu Long Biên…
3. **Ảnh tự chụp** cho vật liệu và đạo cụ (xe máy, ghế nhựa, gánh hàng, cột điện).

## Những gì còn thiếu để "nhìn là nhận ra" (cần tài sản 3D, không phải code)

| Hạng mục | Số lượng tối thiểu | Ghi chú |
| --- | --- | --- |
| Bộ kit mặt tiền | 13 kiểu nhà × 3-5 biến thể | PCG lắp từ module tầng/cửa/ban công |
| Đạo cụ phố | ~40 mesh (xem `Kind` trong `out/*/pcg/*.csv`) | Biển hiệu, xe máy, ghế nhựa, gánh hàng, cây, cột điện, dây cáp |
| Công trình biểu tượng | 35, ưu tiên 1 trước | Xem landmarks.json |
| Xe | ~20 | Tên thương hiệu nhại kiểu GTA |
| Nhân vật | 3 nhân vật chính + ~35 vai | MetaHuman |

Danh sách đầy đủ và thứ tự làm nằm trong [06-lo-trinh.md](06-lo-trinh.md).
