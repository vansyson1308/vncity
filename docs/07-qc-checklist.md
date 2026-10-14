# Checklist QC cuối trước khi cắm UE5

Đợt QC ngày 13/10/2026, trên nhánh `feat/final-qc`. Ký hiệu: ✅ đã kiểm và đạt, 🔧 tìm thấy lỗi và
đã sửa, 👤 cần người làm, 🎮 chỉ kiểm được khi đã cài UE 5.8.

## 1. Kiểm tra tự động (chạy lại được bất cứ lúc nào)

| Lệnh | Kết quả |
| --- | --- |
| `./venv/bin/python -m pytest -q` | ✅ 61 kiểm thử qua |
| `./venv/bin/python tools/validate.py` | ✅ 363 mục nội dung, 0 lỗi (schema, tham chiếu, đồ thị nhiệm vụ) |
| `./venv/bin/python tools/codegen_ue.py --check` | ✅ header C++ sinh từ schema khớp bản trong repo |
| CI GitHub (`.github/workflows/ci.yml`) | ✅ chạy cả ba lệnh trên ở mỗi PR |
| Link tương đối trong mọi file `.md` | ✅ không có link hỏng |

## 2. Pipeline thành phố

| Hạng mục | Trạng thái |
| --- | --- |
| Chạy lại từ đầu trên khu mới (Cầu Giấy, bbox 105.785,21.028,105.805,21.040) | ✅ 5 phút 43 giây, không lỗi: 8.912 nhà, 2.068 nút / 84 km đường (98,3% liên thông), khoảng 33.000 đạo cụ |
| Hoàn Kiếm | ✅ 17.688 nhà, 111 km đường, khoảng 63.000 đạo cụ |
| Nhận nhầm đền chùa theo tên | 🔧 "Ga Chùa Hà" (ga tàu) và "5 Điện Biên Phủ" (địa chỉ) bị xếp vào `dinh_chua`. Đã siết luật tên ("phủ", "quán", "am" chỉ tính ở đầu tên), thêm luật tên công trình công cộng, có kiểm thử |
| Đường dạo ven hồ | 🔧 viết lại cách lấy vòng 4 m quanh hồ cho mọi dạng đa giác |
| Khớp tọa độ footprint với `hanoi_geo` (UE) | ✅ 17.688 footprint, sai số trung vị 5 mm |
| CSV PCG khớp `FHanoiPcgPointRow` | ✅ 62.950 dòng |
| Đồ thị giao thông khớp bộ nạp C++ | ✅ |
| Cầu Giấy: rất ít nhà cao tầng được nhận (2 chung cư, 21 văn phòng) | 👤 Overture gần như không có chiều cao ở đây; cần raster chiều cao (`--heights-tif`) hoặc khảo sát |
| Nhà ga trên cao vắt qua đường hiện là khối đặc từ mặt đất | 👤 cần mô hình riêng (công trình biểu tượng) |

## 3. Nội dung game (chi tiết: [gdd/05-qc-noi-dung.md](gdd/05-qc-noi-dung.md))

| Hạng mục | Trạng thái |
| --- | --- |
| Luồng nhiệm vụ đối chiếu runtime thật | 🔧 16 lỗi: bước thiếu `next` chạy lan sang bước sau, `fail_if` sai cú pháp bị bỏ qua âm thầm, khóa nhánh không khớp hội thoại, giờ nhiệm vụ trước giờ sự kiện… |
| Nhất quán tuổi, năm, giá tiền, quan hệ nhân vật | 🔧 12 lỗi (ví dụ Lan sinh 1997 mà "khóc đòi kem" năm 1998) |
| Thương hiệu thật, bài hát có bản quyền, tần số radio trùng VOV Giao thông | 🔧 9 lỗi, đã thay bằng tên chung hoặc tên nhại |
| Đủ số lượng hứa trong GDD (12 ứng dụng điện thoại) | 🔧 thêm 2 ứng dụng còn thiếu |
| Tài liệu GDD lệch với dữ liệu | 🔧 4 chỗ |
| Cốt truyện | 👤 vẫn là "bản nháp v0", chờ chủ dự án định hướng |
| Đọc duyệt hội thoại bởi người Hà Nội (tiếng lóng, xưng hô) | 👤 |
| Mức phạt theo Nghị định 168/2024 | ✅ 16/16 luật đối chiếu NĐ 168/2024 và NĐ 238/2026, tra 14/10/2026 (`15-kiem-chung-du-lieu-thuc.md`) |
| Tên quận/phường sau sáp nhập 1/7/2025, giá cả hiện hành | 👤 |
| Tọa độ công trình biểu tượng | ✅ 84/84 trong 50 m của đối tượng OSM, khóa bằng `tests/test_landmark_coords.py` (`15-kiem-chung-du-lieu-thuc.md`) |

## 4. Harness UE 5.8

| Hạng mục | Trạng thái |
| --- | --- |
| Hiệu chỉnh trục khi import glTF | 🔧 lỗi nặng nhất: trên dữ liệu thật, 3/4 ô quanh gốc tự giải ra phép quay sai. Nay giải chung trên tối đa 16 ô; thử trên glb thật cho kết quả đúng với 1, 2, 4, 7, 16 ô |
| Lỗi biên dịch tiềm ẩn (ép kiểu int64, `TTuple`, tên biến che nhau, macro `PI`, trả về `const&` cho Blueprint) | 🔧 7 chỗ |
| Đèn mặt trời Static không quay | 🔧 tự chuyển sang Movable |
| Bản đóng gói không có DataTable (không được cook) | 🔧 thêm `DirectoriesToAlwaysCook` |
| Import glTF: trùng importer cũ, Interchange trả danh sách rỗng, chạy setup lần hai bị nhân đôi actor trong World Partition | 🔧 |
| Sinh code từ schema: thiếu chặn kiểu lồng nhau, tràn số, enum > 254 giá trị, tên trùng macro | 🔧 thêm chặn (header hiện tại không đổi) |
| Runtime nhiệm vụ không đọc 7 tham số mà nội dung dùng (`requires_event`, `apply_fine`, đổi nhân vật, lựa chọn của người chơi, ẩn minimap…) | 🔧 đã cài trong `HanoiMissionSubsystem`, có delegate cho UI; mọi tham số khác có kiểu trong schema; kiểm thử chặn lỗ hổng này mở lại |
| Biên dịch C++, UHT, tên API Python của editor, nhập DataTable JSON | 🎮 danh sách đầy đủ ở [05-tich-hop-ue5.md](05-tich-hop-ue5.md) mục 7 |
| Kiểm tra trục bằng mắt (Tháp Rùa đúng chỗ), chạy PIE, đóng gói | 🎮 |

## 5. Tài liệu và giấy phép

| Hạng mục | Trạng thái |
| --- | --- |
| Hướng dẫn cài UE 5.8 và mở lần đầu (Visual Studio, build, setup) | 🔧 viết lại từng bước ở [05-tich-hop-ue5.md](05-tich-hop-ue5.md) |
| Không dùng ảnh, mô hình Google Street View / Earth | ✅ không có trong repo |
| Ghi công dữ liệu (OSM/ODbL, Overture, Copernicus) | ✅ chữ cho màn hình credits ở [04-du-lieu-va-giay-phep.md](04-du-lieu-va-giay-phep.md); 🎮 cần đưa lên màn hình credits trong game |
| Open-Meteo miễn phí cấm thương mại | ✅ có chế độ khí hậu nướng sẵn (`live/weather.py --mode baked`) |
| File LICENSE cho mã nguồn repo | 👤 chưa có, chủ dự án chọn (ví dụ MIT cho code, giữ bản quyền cho nội dung) |

## 6. Còn thiếu so với một game hoàn chỉnh (không làm được nếu thiếu người hoặc UE)

1. Mô hình 3D: bộ kit mặt tiền 13 kiểu nhà, khoảng 40 đạo cụ, 8 công trình biểu tượng ưu tiên 1.
   Dữ liệu vị trí và kiểu đã sẵn; mesh phải dựng trong Blender (CC0) hoặc mua.
2. Ảnh khảo sát phố cổ để mặt tiền "y hệt" (nguồn tham chiếu hợp pháp duy nhất).
3. Nhân vật MetaHuman, hoạt ảnh, lồng tiếng, âm thanh, nhạc.
4. UI (bản đồ, điện thoại, hội thoại) dựng trong UMG, nối vào các delegate đã có.

## 7. Ngày cắm UE5

Làm theo [05-tich-hop-ue5.md](05-tich-hop-ue5.md) mục 3 đến 7: cài UE 5.8 và Visual Studio 2022,
chạy `tools/codegen_ue.py`, mở `ue5/HanoiCity.uproject`, để editor biên dịch plugin, chạy
**Tools > Hanoi City > Hanoi: Run Full Setup**, rồi đi hết danh sách kiểm tra mục 7. Lỗi biên dịch nếu có sẽ nằm trong
phạm vi các API đã khoanh ở mục 7.1.
