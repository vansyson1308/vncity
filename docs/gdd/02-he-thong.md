# 02. Các hệ thống

## 1. Chú ý CSGT (thay mức truy nã)

Mức **Chú ý** từ 0 đến 5 sao. Mỗi lỗi trong `traffic_rules.json` cộng `heat` sao khi bị phát hiện.
Phát hiện = CSGT nhìn thấy (xác suất `base_notice_chance`, giảm theo khoảng cách, mưa, đêm) hoặc
camera (`camera_enforced`: lỗi được ghi "phạt nguội", không có ai đuổi theo nhưng tiền phạt xuất hiện
trong app *Tra cứu phạt nguội*).

| Sao | Phản ứng của thế giới |
| --- | --- |
| 0 | Bình thường |
| 1 | CSGT gần đó ra hiệu dừng nếu thấy bạn; không ai theo dõi chủ động |
| 2 | Một tổ tuần tra hai xe máy để ý khu vực; chốt giờ cao điểm kiểm tra kỹ hơn |
| 3 | Chốt chặn xuất hiện trên tuyến chính quanh vị trí cuối cùng bị thấy |
| 4 | Chốt ở các cầu và cửa ngõ quận; app Vồ tạm khóa tài khoản tài xế (Minh) |
| 5 | Chỉ đạt được với lỗi nặng (nồng độ cồn mức 3): mọi chốt trong thành phố có ảnh xe của bạn |

**Không có rượt đuổi.** Cách duy nhất để giảm Chú ý là:

1. **Tuân thủ**: chạy đúng luật, ra khỏi tầm nhìn tổ tuần tra; sao giảm dần sau 60-120 giây. Phóng
   nhanh, lạng lách, không dừng khi được ra hiệu là lỗi mới (cộng thêm sao).
2. **Dừng xe chấp hành**: bị lập biên bản, nộp phạt (mức trong `fine_vnd`, dùng mức giữa khung),
   trừ điểm giấy phép (`licence_points`), có thể bị tạm giữ xe (lấy lại ở bãi sau 7 ngày game, mất
   phí bãi). Chú ý về 0 ngay.
3. **Đổi phương tiện hợp pháp**: gửi xe, đi bộ hoặc gọi xe. Xe vẫn bị nhận diện ở mức 3 trở lên.

Hối lộ: người chơi có thể chọn câu thoại "bồi dưỡng". NPC CSGT luôn từ chối và cộng 2 sao (thông điệp
rõ ràng, không giáo điều).

**Điểm giấy phép lái xe**: mỗi nhân vật có 12 điểm (theo Luật Trật tự, an toàn giao thông đường bộ
2024). Hết điểm thì không được lái cho đến khi thi lại phần lý thuyết (minigame trắc nghiệm luật).
Điểm phục hồi đủ 12 nếu giữ hồ sơ sạch đủ lâu (luật thật: 12 tháng không bị trừ điểm, cần kiểm
tra; game nén thành 60 ngày game). Giữ sạch 90 ngày game mở nhiệm vụ phụ tích cực với CSGT
(`s12_mu_bao_hiem_cho_be`): runtime tự đặt cờ `ho_so_sach_90_ngay` khi đủ 90 ngày game không bị
lập biên bản (không nhiệm vụ hay thoại nào đặt cờ này).

Nồng độ cồn: mọi đồ uống có cồn cộng `nong_do_con`. Chốt đo nồng độ xuất hiện tối 21h-1h. Thiết kế
khuyến khích gọi xe về sau bia hơi (hoạt động bia hơi gợi ý sẵn).

Mức phạt lấy theo Nghị định 168/2024/NĐ-CP theo hiểu biết hiện tại; mục nào chưa chắc gắn
`fine_unverified` và **phải đối chiếu văn bản gốc trước khi khóa nội dung**.

## 2. Thời gian và thời tiết từ dữ liệu thật

- Hai chế độ: **Nhịp game** (1 ngày = 48 phút) và **Đồng bộ thật** (giờ game = giờ Hà Nội, UTC+7).
- Ở chế độ đồng bộ, thời tiết lấy trực tiếp từ nguồn sống: nhiệt độ, độ ẩm, mưa theo giờ, gió (dùng
  cho thả diều), AQI. Ở chế độ nhịp game, phát lại dữ liệu thật của một ngày gần đây cùng mùa, nên
  mùa nồm, mùa hoa sữa, rét đậm vẫn đúng mùa.
- Adapter sống (`live_feed`) mà `events.json` dùng: `weather.heavy_rain`, `weather.storm`,
  `weather.nom_am`, `weather.heatwave`, `weather.cold_snap`, `air.aqi_unhealthy`. Ngưỡng đề xuất:
  mưa trên ~50 mm trong vài giờ thì bật lớp ngập; nồm khi độ ẩm trên 90% và điểm sương sát nhiệt độ.
- **Ngập**: lớp ngập theo điểm trũng đã biết (Nguyễn Khuyến, Phan Bội Châu, Thái Hà, Nguyễn Trãi...)
  cộng mô hình độ cao DEM. Xe số qua nước sâu có xác suất chết máy; tay ga dễ chết hơn.
- Lịch âm: sự kiện `lunar_date` cần bộ đổi âm-dương lịch Việt Nam (múi giờ UTC+7, khác lịch Trung
  Quốc ở một số năm). "30-12" nghĩa là **ngày cuối tháng Chạp** (có năm chỉ có 29).
- `weekday` dùng 0 = thứ Hai. Phố đi bộ Hồ Gươm: thứ Sáu = 4, thứ Bảy = 5, Chủ nhật = 6.

## 3. Bầy giao thông

- Đồ thị đường từ `traffic/graph.json` (pipeline). Tỉ lệ xe máy/ô tô theo `traffic_profile` từng
  quận (phố cổ 88% xe máy, Mỹ Đình 66%), giờ cao điểm theo `peak_hours`.
- Xe máy mô phỏng như **bầy** (boids có luật): giữ khoảng cách, len vào khe, dồn lên vạch dừng khi
  đèn đỏ, nhích lên vỉa hè khi tắc (NPC cũng có thể bị phạt nếu bị CSGT thấy, tạo cảnh phố sống).
- Mật độ thật: ngã tư lớn giờ cao điểm 300-600 xe máy trong một chu kỳ đèn. Dùng LOD hành vi: gần
  người chơi mô phỏng đầy đủ, xa thì dòng chảy thống kê.
- Luật riêng có dữ liệu: cầu Long Biên đi bên trái; phố đi bộ cấm xe theo lịch; làn ô tô trên các
  trục lớn; đường một chiều phố cổ; tàu Thống Nhất qua phố đường tàu theo giờ chạy.
- Người đi bộ sang đường kiểu Hà Nội: đi đều, xe vòng qua. Người chơi chạy ngang bất ngờ thì xe
  phanh gấp, tăng nguy cơ va chạm.
- Phương tiện công cộng: xe buýt theo GTFS, tàu điện 2A Cát Linh - Hà Đông chạy trên cao dùng làm
  "di chuyển nhanh" có vé (8.000 - 15.000 đ, cần kiểm tra).

## 4. Điện thoại và ứng dụng (tên parody)

| App | Nhại | Chức năng |
| --- | --- | --- |
| Vồ | App gọi xe | Nhận cuốc xe ôm, giao hàng (Minh); gọi xe cho mọi nhân vật |
| Đói | App giao đồ ăn | Đơn giao đồ ăn; Phở Thọ lên app để có đơn |
| Bản Đồ Ơi | App bản đồ | Dẫn đường, đôi khi chỉ vào ngõ cụt; vô dụng khi đã thuộc đường |
| Alô Chat | App nhắn tin | Nhiệm vụ, nhóm tổ dân phố, nhóm tài xế báo chốt, tin nhắn của mẹ Minh |
| MặtBook | Mạng xã hội | Dư luận, hội nhóm "Phố Cũ Còn Đây", tin rao sang nhượng |
| Tóp Tóp | Video ngắn | Đăng clip quán, ảnh; viral thay đổi doanh thu |
| Ví Heo | Ví điện tử | Quét QR trả tiền, nhận tiền cuốc |
| Sổ Tay Bán Hàng | App quản lý | Sổ sách các cơ sở kinh doanh |
| Trời Hà Nội | App thời tiết | Thời tiết, AQI từ dữ liệu thật, cảnh báo ngập |
| Tra cứu phạt nguội | Tra cứu thật | Lỗi do camera ghi, nộp phạt trực tuyến |
| Máy ảnh / Kho phim | Camera | Chế độ chụp ảnh, chồng ảnh xưa (Khôi) |
| Băng cát-sét | Trình phát | 24 cuộn băng của ông Khải |

Dùng điện thoại khi xe đang chạy (mở app, nghe gọi) là lỗi `dung_dien_thoai_khi_lai`. Muốn nhận cuốc
phải tấp vào lề: một lựa chọn rủi ro nhỏ lặp lại hàng trăm lần.

## 5. Uy tín và phe phái

Mỗi phe trong `factions.json` có thanh uy tín -100 đến 100 chung cho cả ba nhân vật (phố biết họ là
một nhóm). Uy tín thay đổi qua `reward.reputation` của nhiệm vụ và `effect` của lựa chọn thoại.

| Phe | Uy tín cao mở ra | Đối địch |
| --- | --- | --- |
| Hội xe ôm Ô Quan Chưởng | Chỗ đỗ ở phố cổ, khách quen giới thiệu | Cộng đồng tài xế app |
| Cộng đồng tài xế và shipper | Báo chốt, báo ngập, cứu hộ miễn phí | Hội xe ôm truyền thống |
| Hội Người cao tuổi phường | Ký ức (mở thêm ảnh xưa), phiếu ủng hộ ở tổ dân phố | |
| Tổ dân phố số 5 Hàng Chiếu | Kết quả bỏ phiếu về dự án | Kim Long Land |
| Ban quản lý chợ Đồng Xuân | Giá sỉ tốt, quyền thuê sạp | |
| Những người bán hàng rong | Tin đồn, nguồn tem phiếu và đồ cổ | |
| Nhóm "Phố Cũ Còn Đây" | Truyền thông, hồ sơ di sản, kiến nghị | Kim Long Land |
| Kim Long Land | Hợp đồng, việc làm lương cao | Bảo tồn, tổ dân phố |
| Làng cờ bờ hồ | Thách đấu cụ Bảo, chuyện xưa | |
| CLB Phượt Thủ Đô | Tuyến đường dài, đua xe đạp | |

Không phe nào "ác". Uy tín Kim Long Land cao là con đường chơi hợp lệ (tiền nhiều, phố giận).

## 6. Kinh doanh

- Cơ sở trong `businesses.json` có giá sang nhượng, thu/chi mỗi ngày, nâng cấp (`income_bonus`).
- Mỗi ngày game, `business_tick` tính doanh thu theo: chất lượng (điểm minigame gần nhất), uy tín,
  thời tiết (rét thì phở đông, mưa ngập thì vắng), sự kiện (Tết đóng cửa, Trung thu đông), mạng xã
  hội (video viral +30% trong 3 tuần).
- Nhân viên NPC có độ hài lòng; trả lương thấp thì họ nghỉ (như "thằng giao hàng nghỉ" ở chương 1).
- Lỗ 3 tháng liền thì phải sang nhượng lại.

## 7. Sự kiện

Sự kiện trong `events.json` kích hoạt theo lịch âm, lịch dương, ngày trong tuần hoặc dữ liệu sống,
và áp `world_changes` (tag cho hệ thống dựng cảnh: cờ, đèn lồng, cấm xe, đổi doanh thu...). Sự kiện
có thể mở nhiệm vụ riêng (`missions`). Danh sách hiện có: Tết, Giao thừa, Ông Công ông Táo, Rằm
tháng Giêng, Giỗ Tổ, Trung thu, Vu Lan, Quốc khánh, Giải phóng Thủ đô, 30/4-1/5, phố đi bộ cuối tuần
(buổi tối thứ Sáu đến Chủ nhật, và ban ngày thứ Bảy, Chủ nhật: hai mục), mùa hoa sữa, mùa loa kèn,
nồm, mưa ngập, nắng nóng, rét đậm, bụi mịn, bão (20 mục).

## 8. Quy ước cho dữ liệu nhiệm vụ

- Bước rẽ nhánh có `next` là bảng `{khóa: bước}`; runtime (`UHanoiMissionSubsystem`) chọn nhánh theo
  `Outcome` mà gameplay/UI truyền vào `CompleteCurrentStep`. Nguồn của khóa ghi trong `params`:
  - `branch_source: "flag"` + `from_dialogue`: khóa trùng tên cờ `set_flags` của lựa chọn thoại vừa
    xong (ví dụ `lan_mua_gia_vi_chuan` / `lan_mua_gia_vi_re` ở `c1_04`);
  - `branch_source: "player_input"` hoặc `player_input`: lựa chọn trực tiếp của người chơi
    (`dung_lai`/`vuot_den` ở P1, `hoi_thang`/`im_lang` và `ke_cho_lan`/`giu_kin` ở `c1_03`);
  - minigame có `pass_score`: khóa `dat`/`chua_dat`.
  Đề xuất đưa thành trường schema riêng ở `04-danh-sach-noi-dung.md`.
- **Bước không có `next` sẽ chạy tiếp sang bước kế tiếp trong mảng** (đúng như runtime); bước cuối
  mảng thì kết thúc nhiệm vụ. Bước kết thúc nằm giữa mảng (cuối một nhánh) phải ghi `"next": "end"`.
  `end`/`success` là hoàn thành, `fail` là thất bại.
- `fail_if` dùng cú pháp runtime: `event:<tên>` (gameplay gọi `ReportEvent`), `flag:<tên>`, hoặc
  biểu thức `time>N`, `heat>=N`. `params.time_limit_s` là cách viết tắt của `time>N`.
- `wait_until` đọc `params.hours` hoặc `params.hour` (cửa sổ một giờ); `escape_traffic_police` đọc
  `params.heat` (số sao cộng khi bắt đầu bước).
- `params.switch_protagonist_on_line` cho phép đổi nhân vật điều khiển giữa một đoạn thoại nhiều người.
- Bước không có `next` là bước kết thúc nhiệm vụ.
