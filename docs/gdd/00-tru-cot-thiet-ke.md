# 00. Trụ cột thiết kế

*Hanoi City, tài liệu thiết kế game (GDD). Bản v0, tháng 10/2026.*

Hanoi City là một game thế giới mở theo khuôn GTA5: bản đồ lớn, ba nhân vật chính hoán đổi được,
hàng trăm hoạt động, thời gian và thời tiết sống. Khác GTA ở chỗ **không có tội phạm, không có súng,
không có bạo lực**. Kịch tính đến từ đời sống thật: tiền nhà, nồi nước dùng, giấy tờ, kẹt xe,
những quyết định giữ hay bán.

Bốn trụ cột dưới đây là tiêu chí để duyệt mọi nội dung. Một đề xuất vi phạm trụ cột thì sửa đề xuất,
không sửa trụ cột.

## 1. Nhận ra Hà Nội ngay

Người Hà Nội nhìn một ảnh chụp màn hình bất kỳ phải nói được "đây là phố nào". Người chưa từng đến
phải nói được "đây là Hà Nội", không phải "một thành phố châu Á".

| Cấp | Cách làm | Dữ liệu |
| --- | --- | --- |
| Biểu tượng | 44 địa danh dựng tay hoặc quét ảnh, đúng tỉ lệ (Tháp Rùa, cầu Long Biên, Nhà hát Lớn...) | `game/content/world/landmarks.json` |
| Mạng phố | Đường và khối nhà 1:1 từ Overture/OSM, không nén bản đồ | pipeline `fetch.py`, `build.py` |
| Mặt tiền | 13 kiểu kiến trúc Hà Nội gắn cho từng khối nhà theo quận | `world/building_archetypes.json`, `world/districts.json` |
| Đường phố | Dây điện, biển hiệu, xe máy đỗ vỉa hè, ghế nhựa đỏ, cây sấu, bàng | điểm PCG `pcg/*.csv` |
| Âm thanh | Tiếng rao, còi xe, loa phường, chuông xe đạp bán hoa | `ambient_audio` của từng quận |
| Con người | 20 kiểu dân cư với lịch sinh hoạt thật | `characters/ambient.json` |

Quy tắc màu: vàng Pháp (ochre), xanh lá cửa chớp, đỏ son đình chùa, ghi xi măng khu tập thể. Không
dùng bảng màu "Đông Nam Á chung chung" (tre, mái lá) cho nội đô.

## 2. Không bạo lực

- Không vũ khí, không đánh nhau, không cướp xe, không giết người đi đường. Va chạm giao thông có
  hậu quả (ngã xe, hỏng hàng, tiền sửa xe, CSGT lập biên bản) nhưng không có máu và không có cái chết.
- Hệ thống "Chú ý CSGT" thay cho mức truy nã. Cảnh sát chỉ ra hiệu dừng, kiểm tra giấy tờ, lập
  biên bản, tạm giữ xe. Không rượt đuổi bằng súng, không có cảnh sát bạo lực, không có hối lộ thành
  công (người chơi có thể thử, NPC luôn từ chối, và hành vi đó tăng mức Chú ý).
- Đối thủ là con người có lý lẽ: Kim Long Land muốn mua nhà, không đe dọa ai. Xung đột được giải
  bằng thương lượng, tiền, uy tín, dư luận, pháp lý và lựa chọn đạo đức.
- Hành vi xấu có tồn tại (dò la thông tin chủ nhà, tiết lộ thông tin mật ngân hàng, chở ba, lái xe
  sau khi uống) nhưng luôn có hệ quả trong hệ thống uy tín và cốt truyện.

## 3. Đời sống thật

- Mọi nghề trong game là nghề thật ở Hà Nội: xe ôm công nghệ, shipper, bán hàng rong, chủ quán phở,
  thợ ảnh, thợ sửa xe, đạp xích lô. Tiền công và giá cả tính bằng VND theo mặt bằng 2025-2026
  (xem `01-vong-lap-gameplay.md`).
- Lịch sinh hoạt theo nhịp thật: phở mở từ 6 giờ, chợ Long Biên họp từ nửa đêm, các cụ tập dưỡng
  sinh lúc 5 giờ, phố đi bộ từ tối thứ Sáu, Tết thì thành phố vắng.
- Luật giao thông thật, mức phạt thật (Nghị định 168/2024/NĐ-CP, đánh dấu `fine_unverified` khi
  chưa đối chiếu văn bản gốc).
- Hài hước đến từ quan sát đời thường (app "Vồ", "con bò đi spa", tiếng rao), không từ chế giễu
  vùng miền, tầng lớp hay người khuyết tật.

## 4. Dữ liệu thật

- Hình học thành phố: Overture Maps, OSM, Copernicus DEM. Không dùng Google Street View/Earth để
  vẽ lại hay dựng mô hình (điều khoản cấm), xem `docs/01-nghien-cuu-cong-nghe.md` mục 3.
- Tham chiếu hình ảnh: ảnh tự chụp của đội, Wikimedia Commons, Mapillary CC BY-SA (chỉ để xem).
- Thời tiết, bụi mịn, mưa ngập lấy từ nguồn dữ liệu sống (`live_feed` trong `events.json`).
- Giao thông: đồ thị đường `traffic/graph.json`, tuyến buýt từ GTFS Hà Nội (CC BY 4.0).
- Toạ độ địa danh: 24/44 địa danh đã được `pipeline/verify_landmarks.py` khớp với Overture (tag
  `coords_verified_overture`, không sửa tay); 20 địa danh còn lại là ước lượng, gắn tag
  `coords_unverified`, phải khớp trước khi khóa.

## Địa điểm trang nghiêm

Một số nơi được gắn tag `respectful_zone` hoặc `state_site` (Lăng Chủ tịch Hồ Chí Minh, Quảng trường
Ba Đình, Phủ Chủ tịch, đình chùa, nhà thờ, Văn Miếu). Quy tắc chung:

1. Mô hình đúng, trang trọng. Không parody tên, không biến dạng, không gắn quảng cáo.
2. Không nhiệm vụ, không hoạt động ồn ào, không minigame hài hước tại Lăng, Quảng trường Ba Đình,
   Phủ Chủ tịch. Người chơi chỉ được đi bộ và xem lễ thượng cờ, hạ cờ từ khu vực công cộng.
3. Xe không được vào khu vực cấm (đúng như ngoài đời); camera chụp ảnh bị khóa ở nơi cấm chụp.
4. Ở đình chùa, nhà thờ: NPC đi lễ, có giờ lễ; người chơi không được chạy xe vào sân, nhạc radio tự
   giảm âm lượng.
5. Lịch sử chiến tranh (cầu Long Biên, Hỏa Lò, ông Thắng là cựu binh) được kể với giọng trân trọng,
   qua ký ức con người, không biến thành gameplay chiến đấu.
6. Mọi kịch bản có chi tiết chính trị, lịch sử nhạy cảm phải qua người duyệt là người Hà Nội trước
   khi ghi âm.

## Thương hiệu và người thật

- Tên xe, app, thương hiệu luôn là parody (Hồng Đạt, Giamaha, Vồ, Đói, Tóp Tóp). Model thật chỉ ghi
  ở trường `inspired_by`, không bao giờ hiện trong game.
- Tòa nhà thương mại có tên riêng (Landmark 72, Lotte Center) dùng tên parody trên biển hiệu.
- Nhân vật đều hư cấu. Quán Phở Thọ, Ảnh Khải, số nhà 49 Hàng Chiếu là hư cấu, không gắn vào quán
  thật nào.
