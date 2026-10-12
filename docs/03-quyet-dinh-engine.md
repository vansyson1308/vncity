# Quyết định: engine và cách làm (ADR)

**Ngày:** 12/10/2026 · **Trạng thái:** đã chốt, xem lại khi UE6 ra Early Access (dự kiến cuối 2027)

## Bối cảnh

Muốn một Hà Nội nhận ra ngay, chất lượng ngang GTA5, nhưng chủ dự án chưa cài được UE5 (thiếu ổ
cứng). Cần chọn engine đích và cách làm để mọi việc trước ngày cài đặt đều không bị bỏ đi.

## Quyết định

1. **Engine đích: Unreal Engine 5.8.** Nanite, Lumen, MegaLights, PCG (production), World Partition,
   Mass, MetaHuman và plugin MCP chính chủ. Không engine nào khác đạt chất lượng thành phố photoreal
   tương đương năm 2026 (so sánh ở `01-nghien-cuu-cong-nghe.md` mục 7). Phí bản quyền 5% trên
   doanh thu vượt 1 triệu USD.
2. **Mọi tài nguyên là dữ liệu trung lập:** glTF cho hình khối, JSON có schema cho thiết kế game,
   CSV cho điểm PCG, JSON cho đồ thị đường. UE chỉ là nơi đọc. Đổi sang UE6 hay engine khác chỉ
   phải viết lại `ue5/`.
3. **Thành phố sinh từ dữ liệu mở, không dùng ảnh Google:** Overture Maps + OSM + Copernicus, cộng
   phân loại kiểu nhà Hà Nội và bộ kit mặt tiền. Công trình biểu tượng dựng tay hoặc photogrammetry
   từ ảnh tự chụp.
4. **Tỉ lệ 1:1, không nén bản đồ như GTA.** Nếu gameplay cần nén, làm ở tầng dữ liệu sau.
5. **Repo:** dùng tiếp `vncity` vì pipeline Overture → glTF của nó đúng hướng và đủ tốt để làm lõi;
   phần mới (ngữ nghĩa, game, harness) xây thêm bên trên, không viết lại.

## Phương án đã loại

| Phương án | Lý do loại |
| --- | --- |
| Unity 6 HDRP | Thiếu Nanite/Lumen/World Partition tương đương, công cụ thành phố yếu hơn |
| Godot 4.7, O3DE, Bevy | Chưa có hình học ảo hóa và GI động ở quy mô thành phố |
| Google Photorealistic 3D Tiles qua Cesium | Điều khoản cấm lưu, dùng offline, dựng lại 3D |
| Gaussian Splatting cho cả thành phố | Ánh sáng xấp xỉ, không va chạm, chưa chạy ở quy mô thành phố; chỉ dùng cho cảnh điện ảnh |
| CityEngine (vitruvio) | Cần giấy phép thương mại; không hiểu kiến trúc Hà Nội tốt hơn luật tự viết |
