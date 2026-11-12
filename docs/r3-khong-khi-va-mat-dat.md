# Đợt 3: không khí và mặt đất (ghi chú kỹ thuật, bổ sung cho `17-ban-web-threejs.md`)

Phần việc bám theo art bible `18-ha-noi-2026-art-bible.md`, các mục 2.4, 2.5, 2.11, 7 và dấu hiệu 13, 20, 21.

## 1. Trời mù và sương khớp màu trời (`web/src/engine/sky.js`)

- **Sương không còn một màu cố định.** `sky.js` thay bốn đoạn mã sương của three.js (`ShaderChunk.fog_*`) cho mọi vật
  liệu. Vật liệu nào có `SKY_GLSL` (mặt đất, nhà, đồ vật, xe, mặt nước) thì điểm ảnh ở xa tan vào **đúng màu trời phía
  sau nó** (`hazeColor(hướng nhìn)`, cùng hàm `skyBase` mà vòm trời dùng). Mép vùng dựng hình vì thế không lộ ra thành
  dải đen ban đêm hay bức tường lệch màu lúc hoàng hôn. Vật liệu khác dùng `fogColor` = màu chân trời.
- **Hình dạng sương:** `1 − exp(−(ρd)² − λρd)`. Phần bình phương vẫn che mép vùng dựng hình như cũ (mật độ ρ theo mức chất
  lượng trong `config.js`, không đổi); phần tuyến tính λ thêm phối cảnh không khí từ vài chục mét (phố xa bạc màu).
- **Đêm:** khoá màu đêm là quầng sáng đô thị nâu xám ấm (chân trời `#4d423c`, đỉnh trời `#25232b`), không còn xanh đen.
  Sao chỉ còn vài chấm trên đỉnh đầu. Sát chân trời có một dải "phố xa" mờ lấm tấm đèn (chỉ vẽ trên vòm trời, không tốn
  hình học), mặt nước soi bóng dải đèn ấy thành vệt dài (`shoreLights` trong shader nước).
- **Chạng vạng** đi qua cam hồng `#F2A65A` rồi tím xám `#8E7F9B` (khoá ở góc mặt trời −1,5° và −5,5°).
- **Thời tiết theo mùa:** bảng `WEATHER` (`mu` mặc định: đầu đông, trời xám trắng; `thu`, `he`, `nom`). Chọn bằng
  `?weather=thu` hoặc `sky.setWeather('thu')`. Mỗi bộ chỉ là vài hệ số (độ mù, nắng, ánh trời, sương, mây, đường ướt).
  Giờ mặt trời mọc, lặn giữ nguyên (5:45, 18:15) để không đổi nhịp chơi đã thiết kế.
- Kiểm tra: `node tools/hours.mjs outdir/ "q=medium&street=Phố Hàng Đào"` chụp đủ 24 giờ trong một lần nạp game, ghép
  bảng `sheet.png`, đo độ sáng từng khung và báo lỗi nếu có khung quá tối.

## 2. Vệt đèn đêm (`LightPools` trong `web/src/world/chunks.js`)

Vệt sáng **nhân** độ sáng mặt đất (`nền × (1 + đèn)`, trộn `DST_COLOR, ONE`) thay vì cộng một màu phẳng: vân đá, vạch
sơn vẫn rõ dưới đèn. Màu theo loại đèn, suy từ bán kính ghi trong danh sách đèn của `props.js`/`decor.js`:
13 m = đèn trục chính (LED trắng trung tính; riêng phố cổ là sodium vàng cam), 9 m = phố nhỏ (sodium), 7 m = đèn vườn
(vàng ấm), 6 m = phố đèn lồng (đỏ cam), dưới 5,5 m = tuýp LED cửa hàng. Nếu đổi các bán kính này thì sửa `poolKind`.

## 3. Mặt đất (`web/src/world/gen/ground.js`, `textures.js`, shader mặt đất trong `materials.js`)

- **18 lớp chất liệu** trong một texture mảng. Lát hè theo khu (`pavingParts`): granite xám sáng trong vòng 60 m quanh Hồ
  Gươm; đá tự nhiên xanh xám trên trục chính phố cổ, phố Pháp, Ba Đình; gạch block đỏ xương cá hoặc terrazzo cũ ở phố
  nhỏ và các khu khác (xét theo ô 32 m, đổi kiểu theo mảng 128 m).
- **Bó vỉa vát + rãnh biên:** mỗi cạnh khối phố thêm một tứ giác nghiêng (chân nhô 10 cm) và một dải rãnh bê tông; cứ
  chừng 30 m có song chắn rác. Va chạm không đổi (mép hè vẫn ở cạnh khối phố, `nav.groundY` vốn đã vuốt 25 cm).
- **Đề can không cần UV:** nắp hố ga, song chắn rác, miếng vá, mũi tên, vệt dầu, vạch ô đỗ xe là tứ giác trong chính lưới
  mặt đất, lớp ≥ 32. Lưới mặt đất không có UV nên toạ độ trong ô đề can đi nhờ thuộc tính pháp tuyến (x, z), còn y chở
  lớp nền bên dưới để shader vẽ lại nền ở chỗ đề can trong suốt (`GB.decal`). Không thêm lệnh vẽ, không sửa `chunks.js`.
- **Vạch sơn theo QCVN 41** (mục 2.4): tim đường vàng 15 cm (đứt 2/4 m; liền từ 10 m; vàng đôi từ 14 m), chia làn trắng
  đứt 3/6 m, phố cổ dưới 8 m không vạch dọc, vạch sang đường 40/60 cm dài 3,2 đến 4 m, vạch dừng 40 cm và mũi tên làn ở
  nút lớn (chỉ trên nửa đường của chiều xe đi tới). Sơn mòn do shader khoét theo nhiễu, lộ nhựa bên dưới.
- **Ô đỗ xe** (mục 2.5): dải 2 m sát bó vỉa trên hè rộng từ 3,5 m (xe máy), ô 2,2 × 5,5 m trên lòng đường rộng (ô tô).
- **Kè Hồ Gươm** (dấu hiệu 20): cấu kiện bê tông đúc sẵn thấp, một bậc thềm sát mặt nước, không lan can; ban đêm có dải
  LED vàng ấm chạy theo mép kè (hệ chiếu sáng 28/8/2026). Hồ khác giữ kè đá hộc.
- **Ô cây** (`gen/pits.js`): ô 1,4 m viền đá, gọi từ `props.js` ngay chỗ đặt cây (một dòng), nên cây dời đâu ô theo đó.

Ngân sách: lưới mặt đất ô dày nhất 2.928 tam giác (ngân sách 6.000), trung bình 603 (trước là 425).
