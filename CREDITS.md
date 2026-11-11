# Ghi công và giấy phép: Hà Nội Dạo Phố (bản web)

## Âm thanh và nhạc nền

**Không có tệp âm thanh nào trong game.** Mọi tiếng động và nhạc nền đều do mã nguồn tổng hợp trực tiếp bằng Web Audio
(`web/src/audio/audio.js`), thuộc giấy phép của chính repo này.

| Âm thanh | Cách tạo | Nguồn, giấy phép |
|---|---|---|
| Tiếng máy xe (theo vòng tua, hộp số 4 cấp), tiếng hút gió, gió và lốp, phanh rít, còi | Dao động răng cưa, vuông, tạp âm qua bộ lọc | Tự viết, không dùng mẫu thu âm |
| Bước chân, đóng dấu, tiền, va chạm, màn trập máy ảnh, chuông | Tạp âm và sóng sin có đường bao biên độ | Tự viết |
| Nền phố: xe cộ, còi xa, chuông hàng rong, chim sẻ, ve, dế | Tạp âm lọc dải, xung nhịp | Tự viết |
| Nhạc nền ngày (điệu Bắc) và đêm (điệu Nam) | Giai điệu sinh ngẫu nhiên trên thang ngũ cung, ba âm sắc tổng hợp gợi đàn bầu, đàn tranh, sáo trúc | Tự sáng tác bằng thuật toán; không dùng giai điệu của bài hát nào |

Đã thử tìm nhạc có sẵn với giấy phép dùng lại rõ ràng (CC0, phạm vi công cộng, CC BY): trên Wikimedia Commons chỉ thấy
các bản thu hát cổ (hát trống quân, cải lương thập niên 1920), không phải nhạc không lời hợp làm nhạc nền và tình trạng
bản quyền tuỳ từng nước. Vì không có bản nào chắc chắn về giấy phép và phù hợp, game dùng nhạc tự sáng tác. Không dùng
bài hát nào về Hà Nội còn bản quyền, kể cả bản cover.

## Dữ liệu bản đồ

- © Những người đóng góp cho OpenStreetMap, giấy phép ODbL 1.0 (đường, nhà, hồ, sông, cây, tường rào, cổng).
- Overture Maps (toà nhà bổ sung do máy học vẽ): Microsoft ML Buildings, giấy phép ODbL; Google Open Buildings, giấy phép CC BY 4.0.

## Mô hình và hình ảnh

- Nhân vật: Microsoft Rocketbox Avatar Library, giấy phép MIT.
- Mọi mô hình cảnh (nhà, công trình, cầu, xe, cây), chất liệu bề mặt, biển hiệu: dựng bằng mã trong repo, không tải từ ngoài.
- Phông chữ Be Vietnam Pro, giấy phép SIL Open Font License 1.1.

## Thư viện

three.js (MIT), Vite (MIT), clipper-lib (BSL 1.0), earcut (ISC), meshoptimizer (MIT).
