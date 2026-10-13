# Lộ trình

Trạng thái tính đến 12/10/2026. "Xong" nghĩa là có code chạy được và kiểm thử, hoặc có dữ liệu qua
kiểm tra tự động. Những gì cần UE5 để chạy thử được đánh dấu riêng.

## Đã có trong repo

| Hạng mục | Trạng thái | Ghi chú |
| --- | --- | --- |
| Pipeline khối nhà, đường, địa hình | Xong | Chạy được cả TP Hà Nội (2,5 triệu tòa nhà) |
| Phân loại 13 kiểu nhà Hà Nội | Xong, cần tinh chỉnh | Luật trong `pipeline/semantics.py`; vùng phố cổ / phố Pháp vẽ tay xấp xỉ |
| Chiều cao theo kiểu nhà | Xong | 98,7% tòa nhà ở Hoàn Kiếm không có chiều cao gốc |
| Mặt tiền hướng phố | Xong | Có kiểm tra tầm nhìn, không nhận nhầm tường chung |
| Đồ thị giao thông | Xong | Một chiều, ngõ chỉ xe máy, đèn tín hiệu, A* |
| Đạo cụ đường phố (10 bộ) | Xong | Biển hiệu theo cửa hàng thật, xe máy, ghế nhựa, hàng rong, cây, cột điện, dây, đèn |
| Thời tiết thật / khí hậu | Xong | `live/weather.py`, có chế độ nướng sẵn cho bản thương mại |
| Cập nhật bản đồ theo release Overture | Xong | `live/update_city.py` báo ô nào cần dựng lại |
| Kiểm tra tọa độ công trình biểu tượng | Xong | 24/44 khớp dữ liệu thật trong 300 m; còn lại cần người kiểm |
| Schema dữ liệu game (14 bộ) | Xong | `game/schemas` |
| Nội dung game | Bản đầu | 359 mục: 13 quận, 44 công trình, 47 nhân vật, 26 xe, 24 việc làm, 24 nhiệm vụ, 57 hội thoại… |
| Cốt truyện | Bản nháp v0 | Mở đầu + chương 1 chơi được dạng dữ liệu; 5 hồi dàn ý. Chờ chủ dự án định hướng |
| Harness UE 5.8 | Viết xong, **chưa biên dịch** | Plugin C++, sinh USTRUCT từ schema, script import; danh sách API cần kiểm ở `05-tich-hop-ue5.md` mục 7 |
| Xem trước 3D trên web | Xong | `viewer/city.html` |

## Việc tiếp theo, theo thứ tự

### Không cần UE5 (làm ngay được)

1. **Khảo sát ảnh phố cổ** (cần người ở Hà Nội): một buổi sáng đi bộ Hàng Bạc, Hàng Buồm, Tạ Hiện,
   Hàng Gai, chụp mặt tiền thẳng góc, biển hiệu, cột điện, dây, vỉa hè. Đây là tham chiếu hợp pháp
   duy nhất để làm bộ kit mặt tiền "y hệt".
2. **Tinh chỉnh phân loại kiểu nhà** bằng ảnh khảo sát: vẽ lại vùng phố cổ / phố Pháp chính xác,
   thêm luật nhận biệt khu tập thể (Kim Liên, Thành Công, Giảng Võ).
3. **Chạy toàn thành phố** (`pipeline.run --region VN-HN --tile 1000`), đo thời gian và dung lượng.
4. **Bộ kit mặt tiền trong Blender** (glTF, PBR, CC0 texture): 13 kiểu × 3-5 biến thể, mỗi kit chia
   module tầng trệt / tầng giữa / mái để PCG lắp. Bắt đầu từ `nha_ong_pho_co`.
5. **Đạo cụ** theo `Kind` trong `out/*/pcg/*.csv` (khoảng 40 mesh): xe máy (tên nhại), ghế nhựa,
   gánh hàng, xe đạp hoa, cột điện chữ H, bó dây, biển hiệu theo 12 nhóm ngành.
6. **Công trình biểu tượng ưu tiên 1**: Tháp Rùa, cầu Thê Húc, đền Ngọc Sơn, Nhà hát Lớn, Nhà thờ
   Lớn, cầu Long Biên, chợ Đồng Xuân, Ô Quan Chưởng.
7. **Mở rộng schema** theo 10 đề xuất trong `gdd/04-danh-sach-noi-dung.md` (nhánh nhiệm vụ, đổi nhân
   vật, điều kiện hội thoại, khoảng phạt…).
8. **Kiểm tra lại mức phạt** theo Nghị định 168/2024 (11/15 luật đang gắn `fine_unverified`).
9. **Hiệu chỉnh mật độ xe máy** bằng SUMO (mô hình sublane) để có số liệu cho Mass traffic.

### Khi có UE5 (ngày cắm vào)

1. Làm theo `05-tich-hop-ue5.md`: cài UE 5.8, mở `ue5/HanoiCity.uproject`, biên dịch plugin, chạy
   Tools > Hanoi City > Setup.
2. Đi qua danh sách kiểm tra lần mở đầu (trục tọa độ, Tháp Rùa đúng chỗ, DataTable nạp đủ).
3. Bật plugin MCP của Epic để Claude Code điều khiển editor.
4. Dựng PCG graph lắp bộ kit mặt tiền lên `semantics/footprints_*.json`.
5. Thay đạo cụ khối hộp bằng mesh thật qua `ue5/Config/asset_map.json`.
6. Mass traffic trên đồ thị đường, mô hình bầy xe máy.
7. MetaHuman cho 3 nhân vật chính, chạy vertical slice: mở đầu + chương 1 quanh phố cổ.

## Rủi ro đã biết

| Rủi ro | Cách xử lý |
| --- | --- |
| Chiều cao nhà gần như toàn ước lượng | Ảnh khảo sát + Google Open Buildings 2.5D (CC BY 4.0) qua `--heights-tif` |
| Footprint phố cổ chia lô không đều | Mặt tiền vẫn đúng vị trí; bộ kit co giãn theo chiều rộng thật |
| Harness C++ chưa biên dịch | Đã khoanh vùng API không chắc; sửa trong buổi đầu mở UE |
| Open-Meteo miễn phí cấm thương mại | Bản phát hành dùng chế độ khí hậu hoặc gói trả phí |
| Địa điểm chính trị nhạy cảm | Gắn `state_site` / `respectful_zone`, không có gameplay quanh đó |
