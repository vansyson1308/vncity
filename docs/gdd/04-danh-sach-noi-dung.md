# 04. Danh sách nội dung và phần còn thiếu

Kiểm tra: `./venv/bin/python tools/validate.py` (schema + tham chiếu). Mọi file là
`{"collection": "...", "items": [...]}` theo `game/schemas/<collection>.schema.json`.

## Nội dung hiện có (v0)

| Collection | File | Số mục | Ghi chú |
| --- | --- | --- | --- |
| districts | `world/districts.json` | 13 | Phố cổ, Hoàn Kiếm/khu Pháp, Ba Đình, Tây Hồ, Long Biên, Đống Đa, Hai Bà Trưng, Cầu Giấy, Thanh Xuân, Hà Đông, Hoàng Mai, Gia Lâm, Mỹ Đình. Tên phường theo ranh giới sau sáp nhập 7/2025 gắn tag `division_names_need_check` |
| building_archetypes | `world/building_archetypes.json` | 13 | Đúng 13 id pipeline dùng |
| landmarks | `world/landmarks.json` | 44 | Mọi toạ độ gắn `coords_unverified` |
| characters | `characters/protagonists.json` | 3 | Minh, Lan, Khôi |
| characters | `characters/story.json` | 24 | Nhân vật truyện, liên lạc, người bán, 3 người dẫn radio |
| characters | `characters/ambient.json` | 20 | Kiểu dân cư có lịch sinh hoạt |
| vehicles | `vehicles.json` | 26 | Tên parody, model thật chỉ ở `inspired_by` |
| activities | `activities.json` | 24 | Việc làm, minigame, giải trí, sưu tầm, đua hợp pháp, kinh doanh |
| missions | `missions/story_prologue.json` | 3 | Mở đầu (chương 0) |
| missions | `missions/story_chapter1.json` | 9 | Chương 1 |
| missions | `missions/side_stranger.json` | 12 | Phụ và người lạ |
| dialogues | `dialogues/prologue.json`, `chapter1.json`, `side.json` | 57 | Có bản `en` cho mọi dòng |
| items | `items.json` | 48 | Đồ ăn, đồ dùng, app, giấy tờ, sưu tầm |
| businesses | `businesses.json` | 11 | Đủ 10 loại hình |
| events | `events.json` | 20 | Lịch âm, lịch dương, tuần, dữ liệu sống |
| radio | `radio.json` | 7 | Nhạc gốc hoặc chờ cấp phép |
| factions | `factions.json` | 10 | |
| traffic_rules | `traffic_rules.json` | 15 | Nghị định 168/2024/NĐ-CP; 11 mục gắn `fine_unverified` |

## So với quy mô GTA5

| Hạng mục | GTA5 (ước tính công khai) | Hanoi City v0 | Còn thiếu |
| --- | --- | --- | --- |
| Nhiệm vụ cốt truyện | ~69 | 12 | Chương 2-5: ~55 nhiệm vụ, 3 kết |
| Nhiệm vụ phụ / người lạ | ~60 "Strangers and Freaks" | 12 | ~50, ưu tiên mỗi quận ít nhất 4 |
| Sự kiện ngẫu nhiên trên phố | ~57 | 0 (chỉ có sự kiện lịch) | Hệ thống + 40 sự kiện: xe chết máy giữa đường, bà cụ cần qua đường, khách quên điện thoại trên xe, cây đổ sau bão, đám cưới chắn đường, đám tang... |
| Hoạt động / minigame | ~40 | 24 | Bi-a, cầu lông công viên, cắt tóc vỉa hè, xem bói (hài, nhẹ), ô ăn quan, kéo co phố đi bộ, câu cá Hồ Tây, gói bánh chưng ngày Tết, nặn gốm Bát Tràng, quay phim Tóp Tóp |
| Phương tiện | ~250+ | 26 | Biến thể màu, Cúp độ, Win 100 (xe phượt), xe điện du lịch phố cổ, xe đẩy hàng, xe cứu thương, xe cứu hỏa, xe rác, xe chở cây Tết, xe tải cẩu xe vi phạm, tàu metro tuyến 3 Nhổn - ga Hà Nội |
| Đài radio | ~20 | 7 | Đài tiếng Anh cho khách nước ngoài, đài thể thao bóng đá, playlist thật cho từng đài |
| Kiểu người đi đường | hàng trăm model | 20 kiểu | Mỗi kiểu cần 5-10 biến thể ngoại hình; thêm thợ cắt tóc vỉa hè, người tập yoga Hồ Tây, sư thầy, giáo dân, công nhân điện lực, bảo vệ dân phố, trẻ con chơi đá bóng ngõ |
| Cửa hàng / dịch vụ | quần áo, súng, cắt tóc, xăm... | 0 (ngoài businesses) | Cây xăng, quán quần áo Hàng Đào, tiệm cắt tóc, tiệm điện thoại, cửa hàng tiện lợi, nhà thuốc, rửa xe |
| Bất động sản mua được | ~20 | 11 | Nhà ở cho nhân vật (Minh thuê chung cư, Khôi sửa gác) |
| Nội thất vào được | hàng trăm | chưa liệt kê | Cần collection `interiors` (xem đề xuất schema) |
| Sưu tầm | ~5 bộ, hàng trăm món | 3 bộ (ảnh xưa 120, tem phiếu 40, biển hiệu 60) | Nội dung chi tiết từng món chưa có (`archive_frame` mới đặt tên mẫu) |
| Cảnh cắt | hàng giờ | chỉ có thoại | Kịch bản quay, phân cảnh |

## Việc kiểm chứng còn treo

1. **Toạ độ** 44 địa danh và tâm 13 quận: khớp với Overture places/OSM, bỏ tag `coords_unverified`.
2. **Tên phường** trong `overture_division_names`: đối chiếu ranh giới hành chính sau 1/7/2025 mà
   Overture đang dùng.
3. **Mức phạt** 11 lỗi `fine_unverified`: đối chiếu Nghị định 168/2024/NĐ-CP (và sửa đổi nếu có)
   theo đúng điều, khoản, điểm.
4. **Giá cả**: cước app gọi xe, giá vé tàu 2A, lệ phí thi A1, giá sang nhượng quán phố cổ.
5. **Lịch âm**: kiểm tra bộ đổi lịch Việt Nam cho các năm phát hành.
6. **Duyệt văn hóa**: người Hà Nội đọc lại toàn bộ thoại (từ lóng, xưng hô, giọng Thái Bình, Nam
   Định, Phú Thọ) và các chi tiết lịch sử (ông Thắng 1979, ông Khiêm 1972, tem phiếu 1984).
7. **Bản quyền âm nhạc**: đài "Sân Đình" đang `licensed_tbd`.

## Đề xuất thay đổi schema (chưa sửa `game/schemas/`)

1. **missions.steps[].next dạng bảng**: thêm `branch_on` để nói rõ khóa nhánh lấy từ đâu, ví dụ
   `{"source": "flag" | "dialogue_choice" | "minigame_score" | "player_input", "map": {...}}`. Hiện
   khóa nhánh chỉ được quy ước trong tài liệu.
2. **missions.steps[].switch_to**: trường chuẩn để đổi nhân vật điều khiển (hiện dùng
   `params.protagonist` và `params.switch_protagonist_on_line`).
3. **dialogues.lines[].condition**: dòng thoại chỉ hiện khi đủ điều kiện (cờ, uy tín) để các chương
   sau phản ứng với lựa chọn trước mà không cần nhân đôi đoạn thoại.
4. **dialogues.lines[].speaker** cho phép giá trị đặc biệt `player` (nhân vật đang điều khiển), để
   một đoạn thoại dùng được cho nhiều nhân vật chính.
5. **traffic_rules.fine_vnd** thêm `min`/`max` theo khung phạt thật, `points_vehicle` riêng xe máy
   và ô tô, `impound_days`, và `legal_ref` có cấu trúc (điều, khoản, điểm).
6. **landmarks.footprint_ref / geometry**: polygon hoặc id Overture building để thay thế khối procedural
   (hiện chỉ có `overture_ids`, chưa điền).
7. **condition** thêm `max_heat`, `event_active`, `weekday`, `items_owned` (nhiều nhiệm vụ cần).
8. **collection mới**: `interiors`, `random_events`, `collectibles` (từng món: ảnh xưa với
   `archive_frame`, vị trí, giờ, mùa), `shops`, `phone_contacts`.
9. **activities.pay** thêm `commission_rate` (app ăn chiết khấu) và `currency_note`.
10. **characters.voice** thêm `dialect_region` chi tiết hơn (`thai_binh`, `nam_dinh`, `phu_tho`,
    `hung_yen`) thay vì gộp `northern_rural`.
