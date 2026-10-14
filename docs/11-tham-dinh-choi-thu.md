# 11. Chơi thử và thẩm định cốt truyện (chương 0-1)

*Ngày 14/10/2026. Chơi thử trên dữ liệu thật trong repo (`game/content/**`), mô phỏng đúng ngữ nghĩa
của `UHanoiMissionSubsystem`: 24 nhiệm vụ, 126 bước, 57 đoạn thoại, 39 lựa chọn thoại, mọi nhánh
`next`. Góc nhìn: một người chơi GTA5 lần đầu vào Hanoi City. Lỗi runtime tìm thấy đã sửa ở PR #5;
tài liệu này không sửa lời thoại hay cốt truyện, chỉ nêu vấn đề và đề xuất để chủ dự án duyệt.*

## 1. Kết luận

**Cốt truyện có logic không?** Có, ở mức xương sống: dòng thời gian nhân vật khớp (Khôi sinh 1988
đi Đức 1998, mã tủ sắt 20/8/98, ông Thắng 1979 → 1981 → 1989, cô Hạnh 13 tuổi năm 1984, bà Vân
1996 → 2003), ba người đứng tên căn nhà và lá phiếu quyết định nằm ở Khôi là một tiền đề sạch,
tờ giấy 1957 cháy một góc là cái móc tốt để kéo sang chương 2. Có 7 chỗ gãy logic ở mức trung
bình (mục 3), không chỗ nào làm sập truyện, nhưng người chơi tinh ý sẽ nhận ra (giờ giấc chợ Đồng
Xuân, Khôi "tiếng Việt dừng ở 1998" mà nói như người Hà Nội, Lan không có bố mẹ).

**Có hấp dẫn không?** Lời thoại và nhân vật là tài sản lớn nhất của dự án hiện nay, ở chất
lượng mà nhiều game kể chuyện thương mại không có: ngắn, có quan sát, hài không lố ("Bò nhà
mình đi lò mổ chứ đi spa nào", "Giấy khen em treo cạnh biên bản phạt cho cân"), và những câu
găm được ("Tớ không sợ phố đổi. Tớ sợ phố mất người", "Bảo nó: vì có người đợi"). Nhịp chương
1 tốt: mỗi nhiệm vụ có một ý, kết chương có bí mật.

**Có cuốn người chơi không?** Chưa. Ba lý do, theo thứ tự nặng nhẹ:

1. **Lựa chọn không có hệ quả.** Chương 1 đặt 33 cờ từ lựa chọn; đúng 2 cờ được đọc lại
   (`lan_mua_gia_vi_chuan`/`_re`). Minh nhận việc dò la cho Kim Long, Lan tiết lộ thông tin mật
   trước cả phố, Khôi tuyên bố giữ phần nhà: không nhân vật nào nhắc lại, không nhiệm vụ nào đổi.
   Người chơi GTA/RPG nhận ra điều này sau hai lựa chọn và ngừng cân nhắc.
2. **Giữa hai nhiệm vụ không có gì để làm.** Vòng lặp "phiên chơi" (chạy cuốc, bán phở, chụp ảnh
   bán báo, sự kiện ngẫu nhiên trên phố) mới có trên giấy (`activities.json`, GDD 01) chứ chưa có
   runtime nào chạy; harness UE5 hiện chỉ có hệ nhiệm vụ. Thế giới mở của GTA sống nhờ 70% thời
   gian người chơi ở ngoài nhiệm vụ.
3. **Chưa có "đinh".** 12 nhiệm vụ truyện ≈ 2-3 giờ chơi. Cao trào chương 1 là một bữa tối uống
   trà ở tầng 72. GTA5 mở màn bằng cướp ngân hàng trong tuyết; game này không cần bạo lực nhưng
   cần một cảnh người chơi kể lại cho bạn: mưa ngập theo dữ liệu thật có thể là cảnh đó, hiện mới
   là một bước `deliver` với `flood_layer: "live"`.

**Có đủ tầm thành sản phẩm triệu đô không?** Nói thẳng:

- Nếu "triệu đô" nghĩa là *một GTA5 lấy bối cảnh Hà Nội* thì không, và không nên theo đuổi:
  GTA5 là sản phẩm ngân sách hàng trăm triệu USD, 69 nhiệm vụ truyện, hàng trăm xe, hàng chục
  hoạt động. Mọi phép so cùng thước sẽ thua.
- Nếu "triệu đô" nghĩa là *doanh thu một triệu USD* (khoảng 60-80 nghìn bản ở giá 15-20 USD
  trên Steam sau chiết khấu) thì đây là mục tiêu thực tế cho một game kể chuyện thế giới mở
  nhỏ, với hai điều kiện mà dự án đang có nền đúng: Hà Nội nhận ra ngay từ ảnh chụp màn hình
  (trụ cột 1, đã có pipeline và asset contract) và kịch bản ở chất lượng hiện tại được giữ
  xuyên suốt 5 hồi. Mẫu hình đúng không phải GTA5 mà là **Yakuza/Like a Dragon**: một khu phố
  nhỏ cực kỳ đậm đặc (Kamurocho chỉ vài trăm mét vuông), truyện nặng, minigame đời thường, không
  súng. Khu thí điểm phố cổ + hồ Gươm chính là Kamurocho của dự án. Các game kể chuyện Đông Nam Á
  (A Space for the Unbound của Indonesia, Coffee Talk) đã chứng minh có thị trường quốc tế cho
  chất liệu địa phương kể cho tốt.
- Điều còn thiếu để đến được đó không phải cốt truyện mà là **hệ thống**: một vòng lặp chạy
  xe/bán hàng chạy được, hệ quả lựa chọn, và một bản chơi thử 60-90 phút (mục 6).

Điểm theo thang 10, để so lần sau:

| Hạng mục | Điểm | Ghi chú |
| --- | --- | --- |
| Lời thoại | 8,5 | Chuyên nghiệp; cần người Hà Nội soát xưng hô |
| Nhân vật | 8 | Ba nhân vật chính rõ cung; phản diện có lý; Khôi bị "kể" nhiều hơn "thấy" |
| Logic cốt truyện | 7 | 7 chỗ gãy trung bình, không chỗ nào sập |
| Cấu trúc nhiệm vụ | 6 | Đa dạng kiểu bước, nhưng minigame không thua được, giờ giấc có chỗ sai |
| Hệ quả lựa chọn | 3 | 2/33 cờ được đọc |
| Bản sắc Hà Nội trong truyện | 9 | Nghề thật, giá thật, phố thật, Nghị định 168, phở không người lái |
| Vòng lặp thế giới mở | 2 | Chỉ có trên giấy |
| Quy mô nội dung | 2 | 12 nhiệm vụ truyện / 69 của GTA5; chương 2-5 là dàn ý |

## 2. Nhật ký chơi thử theo nhiệm vụ

Cột "cuốn" là cảm nhận 1-5 của người chơi, không phải điểm kỹ thuật.

| # | Nhiệm vụ | Nhịp | Điểm hay | Điểm gãy / chán | Cuốn |
| --- | --- | --- | --- | --- | --- |
| P1 | Cuốc xe lúc rạng đông | Dạy lái, đèn đỏ, gặp Khôi + Lan | Mở màn tự nhiên; lựa chọn vượt đèn có giá 5 triệu dạy luật ngay; câu cuối của bà Tâm là cái móc | Khôi "nói tiếng Việt sõi thế" ngay dòng 3 phá tiền đề "tiếng Việt dừng ở 1998" | 4 |
| P2 | Nồi nước dùng lúc bốn giờ | Nấu 4 bước, ông nếm, mở hàng, cô Hạnh | "Ghi vào lưỡi ấy"; cô Hạnh là phản diện mềm thuyết phục; "Vậy là... anh Khôi" | 4 bước nấu liên tiếp lúc 3:30 là nhịp chậm cho người chơi GTA, chưa được lái gì | 3 |
| P3 | Chiếc tủ sắt trên gác | Mã tủ, băng số 1, chờ sáng, chụp Tháp Rùa | Mã 20/8/98 là khoảnh khắc hay nhất prologue; băng số 1 giao "bài tập" là vòng sưu tầm chính | Chờ đến 5:30 (có `skip_allowed`, cần UI bỏ qua rõ) | 4 |
| 1.1 | Thầy Minh | Học xe, thi A1, qua cầu Long Biên | "Triết lý đàn cá"; đi bên trái cầu Long Biên là chi tiết chỉ Hà Nội có | Thi A1 không thua được (xem S4); học phí 800k Khôi trả Minh lại thành +800k cho ví chung | 4 |
| 1.2 | Người vui nhất Hà Nội | Xích lô có bình luận theo vị trí, chụp lại ảnh 1989 | Ông Thắng là nhân vật phụ hay nhất; "Người biết sớm quá thường sai" | Ba lựa chọn cuối đặt 3 cờ, không ai đọc | 5 |
| 1.3 | Khách VIP cả ngày | 11 bước, chở Thảo 14 nhà, lời mời, kể hay giấu Lan | Xung đột đạo đức đời thường đúng chất game; "Phòng trọ em mười hai mét vuông" | Lựa chọn lớn nhất chương (kể cho Lan / giấu) không có hệ quả; 11 bước hơi dài cho một cuốc xe | 4 |
| 1.4 | Chợ lúc sáu giờ | Long Biên 2:30, Đồng Xuân 6:00, chọn gia vị, ông nếm | Lựa chọn tiền–chất có hệ quả thật (-5% doanh thu 14 ngày): mẫu đúng cho cả game | Giờ giấc sai: 6:00 là giờ mở hàng, nước dùng đã ninh từ 3:30, nhưng cụ nếm "nước dùng nấu bằng gia vị vừa mua" ngay sau đó (M1) | 3 |
| 1.5 | Mưa ngập phố | Mưa thật, giao 30 suất, Chú ý CSGT, cứu Tuấn | Ứng viên "đinh" của chương: thời tiết dữ liệu thật + lớp ngập + hàng dễ đổ | Bước Chú ý 2 sao áp bất kể người chơi có vi phạm hay không (M2) | 4 |
| 1.6 | Họp tổ dân phố | Ba lập luận của Lan, hai của Khôi | Cuộc họp viết rất thật (loa cầm tay, quỹ khuyến học, Kiều); đổi nhân vật theo dòng thoại | Cô Hạnh hẹn "cuối tuần" từ P2, nhưng đến đây đã qua nhiều tuần (M7); không có cách dùng danh sách 14 nhà Minh kể | 4 |
| 1.7 | Con bò đi spa | Mark quay, nấu, viral | Hài nhất chương; "vì có người đợi"; viral +30%/21 ngày là hệ quả kinh tế thật | Điểm 60-85 không có nhánh (chỉ <60 là thua) | 5 |
| 1.8 | Tối thứ Bảy trên phố đi bộ | Chuyển cả ba nhân vật, Thảo khóc trước ảnh bà | Cảnh ảnh bà Vân là đỉnh cảm xúc chương 1; "Bản gốc là của phố này" | Chỉ chơi được tối thứ Sáu-CN (đã chặn ở runtime, cần UI báo); Linh phân việc nhưng không có nhịp "khách đến gian" cho người chơi thấy đông | 5 |
| 1.9 | Bữa tối ở tầng bảy mươi hai | Đi hai xe, đề nghị của Vĩnh, về đêm, hộp bánh quy | Vĩnh không cao giọng mà đáng sợ; "Tên cô không có trong sổ đỏ"; radio Hà Nội Xưa trên đại lộ Thăng Long; giấy cháy | Lan trả lời "nhà tôi là không" dù Khôi vừa "xin thêm thời gian" ở 1.6 (M4); không có áp lực nào trong cảnh (không giới hạn thời gian, không hệ quả tức thì) | 4 |
| S01 | Lá dong cho bà Tâm | Chạy chợ Long Biên trước 6 giờ | Nhỏ, đúng giờ giấc thật, có tin đồn phố | Chỉ Minh, chạy 1 km, ngắn | 3 |
| S02 | Kỳ thủ bờ hồ | 3 ván cờ | "Thua tôi hai trăm ván, thắng một ván, khoe cả năm" | Ba ván cờ độ khó 5 không thua được; dùng AI cờ tướng thật là việc lớn | 3 |
| S03 | Làm hòn đá giữa dòng sông | Dạy Mark sang đường, phố đường tàu | Bài học sang đường kiểu Hà Nội là ý chỉ game này có; phố đường tàu xử lý đúng trụ cột an toàn | Thưởng 300k không rõ ai trả | 4 |
| S04 | Không bản đồ | 5 địa chỉ, tắt minimap, 20 phút | Năng lực "Thuộc đường" thành thử thách; thưởng là chỗ đỗ, không phải tiền | Cần 5 địa chỉ thật trên bản đồ (hiện là chuỗi tên) | 4 |
| S05 | Ảnh cưới lúc mặt trời mọc | 6 khung ảnh trên cầu | "Lũ lụt với đám cưới đều là ngày ai cũng khóc" | Thưởng 2 triệu là lớn nhất game, dễ farm nếu lặp được | 4 |
| S06 | Diều sáo bãi giữa | Thả diều theo gió thật | "Mười phút không nghĩ đến tiền" | Minigame 3 phút giữ diều có thể rất chán nếu không có gì xảy ra | 3 |
| S07 | Mười một chiếc xe chết máy | Sửa 11 xe | Mở mục tiêu 120 triệu; thưởng 330k đúng 30k/xe | Lặp 11 lần một minigame | 3 |
| S08 | Phở không người lái | Tìm 5 tem phiếu | Ký ức bao cấp kể qua đồ vật; mở bộ sưu tầm | Hai bước `collect` không có địa điểm cụ thể | 3 |
| S09 | Sáu tấm biển Hàng Thiếc | Chụp 6 biển trước 7 giờ sáng | "Bảo tồn không phải bắt mọi người sống trong bảo tàng" | Ngắn | 4 |
| S10 | Vòng Hồ Tây lúc năm giờ | Đua 17 km đúng luật | Đua hợp pháp có người phân luồng, NPC thắng kịch bản | Không thua được | 3 |
| S11 | Đèn ông sao | Trung thu, cụ bà lạc | Chở chậm êm, từ chối tiền | Chỉ có đêm Trung thu (đã chặn ở runtime) | 4 |
| S12 | Phải nghe 'tách' | 200 mũ, 20 học sinh | CSGT tử tế đúng trụ cột 2 | Trước PR #5 không thể mở (cờ 90 ngày không ai đặt) | 4 |

Tổng thưởng tiền cả 24 nhiệm vụ: 6,54 triệu đồng. Mục tiêu đầu tiên (tiệm Đức Còi) là 120 triệu:
nghĩa là tiến trình kinh tế hoàn toàn trông vào hoạt động lặp chưa có runtime (mục 3, S2).

## 3. Vấn đề xếp theo mức độ

### Nghiêm trọng (chặn mục tiêu "cuốn người chơi")

| # | Vấn đề | Bằng chứng | Đề xuất |
| --- | --- | --- | --- |
| S1 | Lựa chọn không có hệ quả | 33 cờ do lựa chọn đặt, 2 được đọc (`tests/test_content_logic.py` liệt kê). `lan_biet_danh_sach`, `minh_nhan_viec_kim_long`, `lan_lo_thong_tin_mat`, `khoi_giu_phan`, `linh_dang_anh_thao`, `lan_tu_choi_vinh`… không đổi gì | Làm schema `dialogues.lines[].condition` (đề xuất 3 trong GDD 04) rồi nối ít nhất 5 điểm trong chương 1, xem mục 5 |
| S2 | Không có vòng lặp ngoài nhiệm vụ | Harness UE5 chỉ có `UHanoiMissionSubsystem`; 24 `activities` không có runtime; `business_tick`, `ride_request`, sự kiện ngẫu nhiên chỉ trong GDD | Trước khi viết chương 2, làm **một** vòng lặp chạy được end-to-end (gợi ý: cuốc xe app Vồ, vì P1 đã dạy nó) và `business_tick` cho Phở Thọ |
| S3 | Chưa có cảnh "đinh" | Cao trào chương 1 (1.9) là hội thoại tĩnh; 1.5 có tiềm năng nhưng là một bước `deliver` | Dựng 1.5 thành set piece: nước dâng theo giờ, điểm ngập đổi đường, cầu Chương Dương tắc, phở đổ theo vật lý; thêm một cảnh ở Giao thừa Hồ Gươm cho chương 2 |
| S4 | Minigame không thua được | `thi_sat_hach` (max_faults 2), 3 ván cờ, đua Hồ Tây, `nau_cho_mark` 60-85 điểm: bước `minigame`/`cook` không có nhánh thua, runtime chạy tiếp với mọi outcome; gameplay phải tự gọi `FailMission` mà hợp đồng không ghi | Quy ước: minigame có đối thủ/ngưỡng dùng `next: {dat: ..., chua_dat: ..., default: ...}` như `p2.nem_thu`, hoặc `fail_if: ["event:thua"]`; thêm kiểm tra vào `tools/validate.py` |

### Trung bình (người chơi nhận ra, làm giảm niềm tin)

| # | Vấn đề | Chỗ | Đề xuất |
| --- | --- | --- | --- |
| M1 | Giờ giấc 1.4 sai | Long Biên 2:30 → Đồng Xuân 6:00 "phải về kịp giờ ninh" → cụ nếm nước dùng nấu bằng gia vị vừa mua. Nước dùng ninh từ 3:30 và 6:00 là giờ mở hàng | Gia vị mua cho ngày mai; chèn `wait_until` sáng hôm sau (hoặc `time_of_day` hôm sau) trước bước `nem`; đổi lời "về kịp giờ ninh" thành "về trước giờ cao điểm" |
| M2 | Chú ý 2 sao áp vô điều kiện | 1.5 `chu_y_csgt` (`escape_traffic_police`, `heat: 2`) chạy dù người chơi tấp lề nghe điện thoại đúng luật | Gameplay đặt cờ `minh_nghe_dien_thoai_khi_lai` ở cutscene; thêm bước `choice` `branch_source: "flag"` rẽ qua `chu_y_csgt` khi không có cờ |
| M3 | Ví tiền chung ba nhân vật | `FHanoiPlayerState.MoneyVnd` một ô. Minh nợ 180 triệu, Lan lương 35 triệu, cùng ví; học phí 800k Khôi trả Minh thành +800k cho người chơi | GTA5 có ví riêng; đề xuất `MoneyVnd` theo nhân vật (`TMap<FName,int64>`), uy tín vẫn chung như GDD 02 §5 |
| M4 | 1.9 không nhớ 1.6 | Lan "Câu trả lời của nhà tôi là không" trong khi Khôi vừa chọn "xin thêm thời gian"; Vĩnh/Thảo không đổi giọng theo `lan_lo_thong_tin_mat`, `linh_dang_anh_thao` | Thuộc S1; tối thiểu khóa lựa chọn "không" của Lan khi `khoi_xin_thoi_gian` |
| M5 | Khôi được kể, không được thấy | GDD: "tiếng Việt dừng ở 1998, lạc lõng"; thoại: nói lưu loát, giảng về chính quyền hạn chế cà phê đường tàu; xe ôm khen "nói sõi thế" | Rẻ mà hiệu quả: Khôi dùng sai 2-3 từ mới mỗi chương ("app", "ship", "sổ đỏ", "Tóp Tóp"), Minh/Lan sửa; một lần không hiểu tiếng lóng |
| M6 | Lan không có bố mẹ | "Cháu đích tôn" 29 tuổi sống với ông và cô ruột, bố mẹ không được nhắc một lần trong 57 đoạn thoại | Một câu ở P2 hoặc 1.4 là đủ (mất, ly hôn, đi xuất khẩu lao động…); chọn hướng nào ảnh hưởng tới cung "tiền thật" của Lan |
| M7 | "Cuối tuần" họp tổ dân phố | P2 cô Hạnh hẹn cuối tuần; 1.6 chỉ mở sau 1.1 (tuần học xe + thi), 1.3, 1.4 | Đổi lời cô Hạnh thành "sắp tới", hoặc thêm `requires.hours`/ngày cho 1.6 |
| M8 | Prologue chậm cho khán giả GTA | P2 bốn bước nấu lúc 3:30; P3 chờ đến 5:30; hai trong ba nhiệm vụ đầu không có lái xe | Rút P2 còn 2 bước nấu + mở hàng; cho P3 chụp ngay chiều hôm đó rồi "chụp lại đúng giờ" là hoạt động tùy chọn; giữ P1 nguyên |
| M9 | Nhiệm vụ theo sự kiện cần UI báo | 1.8 (phố đi bộ), S11 (Trung thu) giờ không bắt đầu được ngoài sự kiện (PR #5) nhưng người chơi không biết vì sao | HUD hiện "Mở tối thứ Sáu 19:00" từ `CanStartMission` reason |
| M10 | Chưa cân bằng được kinh tế | Thưởng chương 1 = 6,5 triệu; mục tiêu 120 triệu ⇒ ~300 cuốc xe; `businesses.income_per_day` 3,5 triệu/ngày của Phở Thọ sẽ phá cân bằng nếu cộng thẳng vào ví | Chỉ cân sau khi có vòng lặp (S2); tách "tiền quán" khỏi "tiền túi" |

### Nhỏ (soát lời, số liệu)

- N1. Xưng hô Lan–Minh dao động giữa các đoạn: chị/em (1.5), anh/tôi (1.3 `bao_lan`), anh/chị
  (1.3 `hang_chieu`). Cần người Hà Nội chốt một kiểu theo quan hệ từng giai đoạn.
- N2. Cụ Thọ 86 tuổi: gánh phở lên Hà Nội năm 1954 (14 tuổi), góp tiền mua nhà 1957 (17 tuổi).
  Hơi trẻ; cho cụ 90 tuổi hoặc dời năm mua nhà.
- N3. S03 thưởng 300.000 đ: thoại không nói Mark trả; thêm một câu hoặc bỏ tiền.
- N4. S10 "năm giờ sáng Chủ nhật" không gate ngày; thêm `weekday` khi schema `condition` mở rộng.
- N5. Lan nhận ra Khôi ngay ở cửa dù lúc anh đi cô mới 1 tuổi; thêm nửa câu "em nhận ra anh nhờ
  ảnh bác dán ở tủ kính" (P3 đã có chi tiết tủ kính, chỉ cần nối).
- N6. Khôi "về chịu tang" nhưng đến 3 tuần sau khi bố mất (tang lễ Việt Nam trong vài ngày). Có
  thể là chủ ý ("Anh... về muộn") nhưng nên có một câu lý do (kẹt ở vùng lũ, visa).
- N7. 1.1: Khôi thi A1 ngay sau buổi tập đầu; thực tế cần đăng ký, thi lý thuyết, chờ lịch. Một
  dòng "tuần sau" + `wait_until` là đủ.
- N8. S08 hai bước `collect` không có địa điểm cụ thể (đồng nát "quanh Đống Đa").

## 4. Những gì phải giữ nguyên

Các khoảnh khắc này đang làm việc và là lý do để tin vào kịch bản:

- Mã tủ sắt là ngày mẹ con Khôi bay đi (P3). Kể cả cung bố–con trong một con số.
- Lựa chọn vượt đèn đỏ ở P1 với cái giá "bằng gần cả tháng gửi về quê": dạy luật bằng ví tiền.
- "Tớ sợ phố mất người" (1.2), "Bảo nó: vì có người đợi" (1.7), "Bản gốc là của phố này" (1.8),
  "Ở đời cái gì miễn phí mới đắt" (1.9): mỗi chương có một câu để nhớ.
- Thảo khóc trước ảnh bà ngoại (1.8): phản diện có quá khứ ở chính con ngõ này, và người chơi
  quyết định có đăng lên mạng không. Đây là kiểu lựa chọn game cần nhiều hơn.
- Gia vị chuẩn hay rẻ (1.4) có hệ quả doanh thu đo được. Mẫu để nhân rộng cho S1.
- Hệ "Chú ý CSGT" thay truy nã, hối lộ luôn bị từ chối, S12 thưởng cho hồ sơ sạch: khác biệt rõ
  với GTA mà vẫn là một hệ áp lực.
- Phố đường tàu, Lăng, đình chùa xử lý đúng trụ cột an toàn và trang nghiêm; không có chỗ nào
  trong 57 đoạn thoại vi phạm trụ cột 2 (không bạo lực).

## 5. Đề xuất sửa cụ thể cho cốt truyện và nhiệm vụ (chủ dự án duyệt)

Thứ tự theo tác động trên công sức.

1. **Nối hệ quả trong chương 1 (S1), năm điểm tối thiểu:**
   - `minh_nhan_viec_kim_long` → 1.5 Tuấn: "Thằng Hùng Hàng Đậu nhận rồi. Mà mày cũng nhận rồi
     còn gì" và lựa chọn "Tao không làm cái đấy" biến mất.
   - `lan_biet_danh_sach` → 1.6 Lan có lựa chọn thứ tư: đọc 14 số nhà trước tổ dân phố (uy tín
     tổ dân phố +15, Kim Long -25, đặt `lan_cong_khai_danh_sach`); `minh_giu_kin_danh_sach` →
     Lan ở 1.5 lạnh hơn với Minh.
   - `lan_lo_thong_tin_mat` → 1.9 Vĩnh mở đầu: "Cô làm tôi mất một khoản vay. Tôi vẫn mời cô
     trà" và Thảo không tiễn ra thang máy.
   - `khoi_giu_phan` → 1.9 Vĩnh bỏ qua Khôi, nói với Lan và Minh; `khoi_xin_thoi_gian` → khóa
     câu "nhà tôi là không" của Lan (M4).
   - `linh_dang_anh_thao` → 1.9 Thảo: "Tôi đã xem bài đăng" thay cho "Tôi vẫn nghĩ về tấm ảnh".
2. **Sửa giờ giấc 1.4 (M1)** và **Chú ý có điều kiện 1.5 (M2)**: hai sửa dữ liệu nhỏ, không
   đụng thoại nhiều.
3. **Quy ước thua cho minigame (S4)**: thêm nhánh `chua_dat` cho `thi_sat_hach` (thi lại hôm sau,
   mất lệ phí), `van_1..3` (thua là mời trà, về sau quay lại), `dua` (ngoài top 3 thì Tuấn vẫn
   có content, không thưởng).
4. **Khôi lạc lõng bằng ngôn ngữ (M5)** và **một câu về bố mẹ Lan (M6)**: hai sửa thoại ngắn.
5. **Rút prologue (M8)**: mục tiêu người chơi cầm lái trong 60 giây đầu (P1 đã đạt) và không
   có quá 3 phút liên tiếp không điều khiển gì trong 20 phút đầu.
6. **Chương 2 "Mùa nồm"**: dàn ý 5 hồi là tốt; đề nghị Giao thừa Hồ Gươm là "đinh" của cả game
   (pháo hoa, phố đi bộ kín người, ba nhân vật ở ba chỗ rồi gặp nhau lúc 0:00) và hạn chót của
   Vĩnh trùng đêm đó. Băng số 12 ("để cho người đã gánh phở nuôi con tôi") nên được nghe ở
   chương 2 chứ không chờ chương 4: bí mật phải nhỏ giọt, mỗi chương một giọt.
7. **Ví tiền riêng (M3)**: quyết định trước khi làm vòng lặp kinh tế, vì đổi sau sẽ phải cân lại
   toàn bộ thưởng.

## 6. So với chuẩn GTA5 và game thế giới mở thành công

| Thành phần | GTA5 | Hanoi City hôm nay | Trạng thái |
| --- | --- | --- | --- |
| Vòng khoảnh khắc (lái, va chạm) | Xe + súng | Lái xe máy giữa bầy, luật thật, Chú ý CSGT | Thiết kế có; runtime heat có; bầy xe chưa |
| Vòng phiên chơi (ngoài nhiệm vụ) | Hoạt động, random events, tài sản | 24 hoạt động, 11 cơ sở, 20 sự kiện lịch | Dữ liệu có; runtime không |
| Vòng tiến trình | Tiền, mở khóa, truyện | Tiền, uy tín 10 phe, cờ, mở khóa | Runtime có (mission subsystem) |
| Ba nhân vật chuyển đổi | Có, camera bay | Có, năng lực riêng (Thuộc đường / Tính nhẩm / Mắt nhà nghề) | Runtime đổi nhân vật trong nhiệm vụ (PR #5 thêm đổi khi bắt đầu); đổi tự do chưa |
| Nhiệm vụ truyện | ~69, nhiều set piece | 12, không set piece | 2-3 giờ chơi |
| Nhiệm vụ phụ / người lạ | ~60 | 12 | Chất lượng tốt, số lượng thiếu |
| Sự kiện ngẫu nhiên trên phố | ~57 | 0 | GDD 04 đã liệt kê 40 ý |
| Radio | ~20 đài | 7 đài, nhạc chờ cấp phép | |
| Hệ quả lựa chọn | Ba kết + vài nhánh | 33 cờ, 2 được đọc | Điểm yếu nhất |
| Bản sắc địa phương | Los Santos nhại LA | Hà Nội 1:1 Overture, 13 kiểu nhà, nghề thật, luật thật | Điểm mạnh nhất (trên giấy và pipeline) |

Game thế giới mở "không bạo lực" đã thành công đều đi con đường **nhỏ mà đậm**: Yakuza (một khu
phố), Shenmue (một thị trấn), A Short Hike (một hòn đảo). Dự án nên tuyên bố rõ: *thành phố Hà
Nội 1:1 để lái xe và nhận ra, nhưng nội dung đậm đặc ở phố cổ + hồ Gươm*, giống GTA cho người
chơi cả bản đồ nhưng 80% nhiệm vụ ở vài khu.

## 7. Bản chơi thử 60-90 phút nên có gì (vertical slice)

Đây là ngưỡng để trả lời câu "triệu đô" bằng số liệu (wishlist, tỉ lệ chơi hết demo) thay vì
cảm nhận:

1. Phố cổ + hồ Gươm dựng đủ để nhận ra trong ảnh chụp màn hình (trụ cột 1), còn lại thành phố
   là khối xám đi được.
2. P1 → P3 (rút gọn theo M8) + 1.5 Mưa ngập (dựng thành set piece) + 1.8 Phố đi bộ (cảnh Thảo).
3. Một vòng lặp lặp được: cuốc xe app Vồ với CSGT, mưa, đánh giá sao; đủ để người chơi tự chơi
   15 phút ngoài nhiệm vụ.
4. Ba lựa chọn có hệ quả nhìn thấy ngay trong demo (gia vị 1.4, vượt đèn P1, kể cho Lan 1.3 →
   phản ứng ở 1.5).
5. Radio hai đài có nhạc đã cấp phép; tiếng rao, loa phường.

Nếu bản này giữ được người chơi đến hết và ảnh chụp màn hình lan được trên mạng xã hội Việt Nam
("đúng phố mình"), mục tiêu doanh thu một triệu USD là chuyện của sản xuất và tiếp thị, không
còn là câu hỏi về cốt truyện.

## 8. Lỗi runtime/dữ liệu đã sửa trong lần chơi thử này (PR #5)

| # | Lỗi | Hậu quả nếu không sửa | Sửa |
| --- | --- | --- | --- |
| R1 | Cờ `ho_so_sach_90_ngay` được tài liệu ghi "runtime tự đặt" nhưng không có dòng code nào đặt | S12 không bao giờ mở được | `State.LastFineGameTime` + `RecordFine()`, đặt cờ sau `CleanRecordDays` ngày game, xóa khi bị phạt |
| R2 | `StartMission` không đổi sang nhân vật của nhiệm vụ | Minh có thể nấu phở thay Lan, mở tủ sắt thay Khôi | Đổi sang `protagonists[0]` nếu nhân vật hiện tại không thuộc nhiệm vụ |
| R3 | Bước đầu có `requires_event` vẫn cho bắt đầu nhiệm vụ | Bắt đầu 1.8 vào thứ Ba là bị khóa trong nhiệm vụ đến tối thứ Sáu (nhiều giờ thật); S11 chờ đến Trung thu | `CanStartMission`/`GetAvailableMissions` chặn tới khi sự kiện đang diễn ra |
| D1 | `p2.nem_thu` bảng nhánh không có `default` | Outcome lạ từ gameplay làm nhiệm vụ thất bại `no_branch` | Thêm `default: che` |
| D2 | `unlocks` của 1.4, 1.5, 1.7 không ghi nhiệm vụ mà chúng là điều kiện cuối | UI "đã mở khóa" sai | Bổ sung |

Kiểm tra tự động mới: `tests/test_content_logic.py` (cờ đọc/đặt, bước và dòng thoại chết, bảng
nhánh có `default`, đồ thị mở khóa, ba quy tắc runtime trên). Chạy lại mỗi khi thêm chương.
