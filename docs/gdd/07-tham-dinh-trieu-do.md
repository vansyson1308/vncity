# 07. Thẩm định: cốt truyện này có thành sản phẩm triệu đô không?

Ngày 14/10/2026, sau khi chạy `tools/playtest.py` (giả lập bốn kiểu người chơi đi hết mở đầu + chương 1
+ 12 nhiệm vụ phụ trên bản đồ 1:1, kết quả ở `06-gia-lap-choi-thu.md`) và đọc lại toàn bộ 57 đoạn
thoại, 24 nhiệm vụ, dàn ý 5 hồi. Đây là ý kiến thẩm định, không phải số liệu đo được, trừ chỗ ghi rõ.
Bản chơi thử bằng tay cùng ngày, đi sâu vào lời thoại, dòng thời gian nhân vật và runtime (và đã sửa
3 lỗi runtime ở PR #5) nằm ở `../11-tham-dinh-choi-thu.md`; tài liệu này không lặp lại phần đó mà
nhìn ở tầng hệ thống: đồng hồ, bản đồ, kinh tế, độ phủ quận, và đường tới một bản bán được.

**Cập nhật cùng ngày (sau khi sửa):** hai điểm thấp nhất, *Mở màn* và *Hệ quả lựa chọn*, đã được nâng
lên 5/5 bằng cold open 1957/1972, thoại có điều kiện, 38 hệ quả trong chương 1; chương 2 "Mùa nồm"
viết thành dữ liệu; chuẩn 5/5 đo được, số đo trước/sau và bảng 57 cờ ở `11-mo-man-va-he-qua.md`.
Các số "hiện tại" dưới đây giữ nguyên là số lúc thẩm định; chỗ nào đã đổi có ghi chú **[đã sửa]**.

## Kết luận ngắn

**Cốt truyện đủ tốt để làm nền cho một game triệu đô. Bản nháp v0 chưa phải là sản phẩm triệu đô.**
Ba điều quyết định "triệu đô" không nằm trong cốt truyện mà nằm ở: (1) 15 phút đầu có giữ được
người chơi không, (2) thành phố có *nhìn ra Hà Nội* ở chất lượng đủ để người ta chia sẻ clip không,
(3) phạm vi có thu lại được thành một thứ làm xong nổi không. Cốt truyện hiện tại được điểm cao ở
tiền đề, nhân vật, sự cụ thể; điểm thấp ở mở màn, hệ quả lựa chọn, và kinh tế.

## Những gì giả lập đo được

| Phép đo | Kết quả | Ý nghĩa |
| --- | --- | --- |
| Lỗi chặn chơi (bước cụt, cờ không ai đặt, thoại trỏ sai) | **0** | Logic dữ liệu sạch; chơi hết được 24/24 nhiệm vụ **[đã sửa: 25/25 sau khi thêm P0, nhánh thua và bước chờ]** |
| Mâu thuẫn giờ giấc | 3 (đồng hồ 30x) / 2 (đồng hồ 1x) **[đã sửa: 0 với đồng hồ 30x, bước chờ đặt sau khi tới nơi]** | Ngày 48 phút trên bản đồ 1:1: đi bộ 800 m từ Hàng Chiếu ra Bờ Hồ mất 5 giờ game, bước "chụp lúc 5h30-7h" trượt |
| Lựa chọn có hệ quả về sau | **2/34 cờ được đọc lại** (chỉ cặp gia vị chuẩn/rẻ) **[đã sửa: 34/34 cờ lựa chọn chương 0-1 được đọc ở 48 chỗ, 38 hệ quả ngay trong chương 1; xem 11]** | Gần như toàn bộ lựa chọn chương 1 chưa trả gì, vì chương 2-5 chưa viết. Người chơi bản v0 sẽ thấy "chọn gì cũng thế" |
| Tiền của Minh sau 90 ngày game | **âm** (dư -0,7 tr/tháng theo bảng giá GDD) **[đã sửa: -0,7 tr chỉ chạy app là chủ ý; +5,8 tr khi đi đủ bậc; góp vốn 40 tr sau 7 tháng game, xem 01]** | Mục tiêu đời của Minh (tiệm 120 tr) không thể đạt bằng vòng lặp tự do; gửi quê 6 tr/tháng nuốt hết |
| Nhiệm vụ phụ "Mũ bảo hiểm cho bé" | cần 90 ngày sạch = **72 giờ chơi thật** | Một nhiệm vụ nhỏ bị khóa sau một điều kiện của game 100 giờ |
| Quận cốt truyện chạm tới | 8/14 **[đã sửa: 14/14 qua chương 2 (PR #9) và 26 nhiệm vụ người lạ của 8 quận, xem 12]** | Cầu Giấy, Hai Bà Trưng, Hoàng Mai, Hà Đông, Bắc Từ Liêm, Gia Lâm chưa có lý do để tới |
| Địa danh có trong nhiệm vụ | 10/84 **[đã sửa: 36/84]** | 74 địa danh vừa dựng chưa có truyện |
| Tỷ lệ bước thoại/cắt cảnh | 45% | Nặng thoại so với GTA (ước 20-25%); Yakuza-like thì chấp nhận được |
| Nhiệm vụ ngắn nhất / dài nhất | 4 phút / 71 phút thật | "Họp tổ dân phố" 4 phút là một cảnh, không phải nhiệm vụ; "Khách VIP cả ngày" 71 phút cần điểm nghỉ |

## Cốt truyện có logic không?

Có, ở mức dữ liệu và ở mức kể chuyện:

- Chuỗi nguyên nhân chặt: ông Khải mất → Khôi về → lá phiếu thứ ba → Kim Long gom nhà → cô Hạnh nợ
  → tờ giấy 1957 → cuộn băng. Mỗi nhân vật chính có lý do riêng để ở cùng một địa chỉ.
- Không có nhân vật "ác vì ác": Thảo có bà ngoại bị giải tỏa, Vĩnh tin mình đang ướp phố, Hạnh bán
  vì nợ. Đây là chỗ mạnh nhất và hiếm nhất của kịch bản.
- Ba lỗ hổng logic cần vá:
  1. **Khôi không biết đi xe máy đến hết nhiệm vụ 1.1**, nhưng P3 bắt anh ra Bờ Hồ chụp lúc 5h30-7h
     và 1.2 cần anh có mặt ở Ô Quan Chưởng rồi cầu Long Biên lúc hoàng hôn. Đi bộ được, nhưng thời
     gian trong game không khớp (xem bảng). Giải pháp: hoặc đồng hồ chạy giờ thật trong nhiệm vụ, hoặc
     chỉ kiểm tra khung giờ lúc *bắt đầu* bước, hoặc thêm `wait_until` trước bước chụp.
  2. **Kinh tế của Minh**: bảng giá "trả đúng giá thật" là chủ ý tốt, nhưng cộng lại thì Minh lỗ.
     Hoặc giảm khoản gửi quê (3 tr), hoặc tăng ca đêm/giao hàng tốt hơn, hoặc nói thẳng trong truyện:
     Minh *không thể* mua tiệm nếu không có tiền truyện, và biến đó thành cám dỗ của Kim Long (hiện
     cám dỗ này đã có trong 1.3 nhưng số tiền đề nghị chưa được đặt cạnh con số lỗ hàng tháng).
  3. **Tờ giấy 1957 cháy đúng chỗ tên** là một "MacGuffin" tốt, nhưng cuộn băng 24 chỉ mở khi chụp lại
     đủ 30 ảnh: người chơi bỏ qua sưu tầm sẽ bị khóa cái kết. Cần đường thứ hai (ông Thắng kể, hoặc
     cụ Thọ nói ở hồi 4) với giá đắt hơn về cảm xúc.

## Có hấp dẫn không?

**Mạnh:**
- Tiền đề "một căn nhà, ba chủ, một lá phiếu" là tiền đề phim hay; cấu trúc ba nhân vật chuyển qua
  lại là cấu trúc GTA5 đúng nghĩa, mỗi người một nghề có minigame riêng (lái, nấu, chụp).
- Sự cụ thể: app Vồ, Alô Chat, Nghị định 168, chợ Long Biên 2h30 sáng, cầu Long Biên đi bên trái,
  tem phiếu 1984, "mậu dịch, nhà B, cây bàng" → tập thể Kim Liên. Người Hà Nội đọc sẽ tin.
- "Ký ức như dữ liệu": kho ảnh ông Khải đối chiếu cái còn và cái mất trùng khớp với chính cách dự
  án dựng thành phố từ dữ liệu thật. Đây là **điểm bán hàng độc nhất**, nên đưa lên trailer.
- Không bạo lực nhưng vẫn có áp lực thật (tiền, phạt, nợ): khác biệt rõ với GTA mà không thành
  "game mô phỏng cuộc sống hiền lành".

**Yếu:**
- **Mở màn chậm.** **[đã sửa: cold open `p0_ganh_pho_1957`, cầm điều khiển ở phút 0,4, lựa chọn đầu phút 2,6, câu hỏi lớn phút 2,6; xem 08]** P1 là một cuốc xe hướng dẫn. Câu hỏi lớn (bán hay giữ) đến ở P2, tờ giấy cháy ở
  cuối chương 1 (nhiệm vụ 1.9, sau khoảng 6-7 giờ chơi). GTA5 mở bằng vụ cướp ngân hàng; Yakuza 0 mở
  bằng một cái xác. Game này nên mở bằng **băng số 1** hoặc **cảnh cháy tờ giấy** (flash-forward), rồi
  mới quay về cuốc xe rạng đông.
- **Phản diện mềm quá mềm.** Kim Long chỉ "trả lương gấp đôi" và "gom 14 nhà". Cần một hành động
  gây tổn thất thấy được sớm: nhà ông Tư Hàng Bạc bị ép bán ở hồi 2 nên kéo lên chương 1, hoặc khách
  sạn mẫu khoét ruột làm nứt tường 49 Hàng Chiếu.
- **Lựa chọn chưa có giá.** **[đã sửa: xem 08 §5-7]** 34 cờ được đặt, 2 cờ được đọc. Dàn ý hồi 2-5 có kế hoạch trả, nhưng chừng nào
  chưa viết, bản demo không chứng minh được "lựa chọn quan trọng". Cần ít nhất 3 hệ quả *trong chương
  1* (ví dụ: `minh_nhan_viec_kim_long` → Thảo gọi Minh đi cuốc xe lúc 1.5 thay vì Tuấn; `lan_mua_gia_vi_re`
  → Mark chê ở 1.7).
- **Nhịp.** Chuỗi Lan (nấu, chợ, họp, nấu cho Mark) bốn nhiệm vụ liền toàn minigame nấu và thoại;
  xen vào một nhiệm vụ Minh chở hàng hoặc Khôi chụp sẽ đỡ mỏi.
- **Thành phố chưa là nhân vật ngoài phố cổ.** 6 quận không có cảnh nào; Thanh Xuân chỉ có phòng trọ.
  Mỗi quận cần ít nhất một "lý do đến" trong truyện chính và 3-4 nhiệm vụ người lạ.

## Có cuốn hút (giữ người chơi) không?

- Vòng ngày của ba nghề là tốt, nhưng lúc thẩm định **không có sự kiện ngẫu nhiên trên phố** (GTA5 có
  ~57), thứ làm thế giới sống giữa các nhiệm vụ. **Đã sửa:** 45 sự kiện trong `random_events.json`,
  mỗi sự kiện là một người có Khổ-Tập và một ngã rẽ có hậu quả đo được (02 §7.1).
- Hệ kỹ năng 0-100 và uy tín phe phái có, nhưng lúc thẩm định chưa có thứ gì *mở khóa* bằng kỹ năng.
  **Đã sửa:** `skills.json` khai 3 mốc cho 12 kỹ năng (36 thứ mở khóa: xe, hoạt động, cơ sở, lựa chọn
  thoại kiểu speech check, sự kiện ngẫu nhiên), cổng `min_skills` trong nội dung đặt đúng mức mốc (02 §10).
- Sưu tầm (120 ảnh xưa, 40 tem phiếu, 60 biển hiệu) là lý do tốt để đi khắp 12 quận; chỉ mới đặt
  tên, chưa có từng món. Đây là việc nội dung rẻ, hiệu quả cao.
- Ngày 48 phút trên bản đồ 1:1 là vấn đề cốt lõi của *cảm giác*: GTA5 có bản đồ 1:4 nên 48 phút khớp.
  Ở Hà Nội 1:1, một ca xe ôm 8 cuốc là hơn một ngày game. Hoặc chấp nhận "ngày dài" (đồng hồ 8x: ngày
  = 3 giờ thật, chơi tự do vẫn thấy sáng-trưa-tối), hoặc co bản đồ (trái với mục tiêu "y hệt").
  Khuyến nghị: **đồng hồ 8x ngoài phố, 1x trong nhiệm vụ**, và đo lại bằng giả lập.

## "Triệu đô" nghĩa là gì ở đây

- Doanh thu 1 triệu USD trên Steam ≈ 110-120 nghìn bản ở giá 14,99 USD sau chiết khấu và hoàn tiền,
  hoặc 60-70 nghìn bản ở 24,99 USD. Thị trường có thể với tới: người Việt trong nước và hải ngoại,
  cộng đồng thích "thành phố thật trong game" (người chơi Yakuza, Euro Truck, Cities), và báo chí game
  quốc tế vốn rất ưa chuyện "GTA ở một thành phố châu Á thật, không bắn súng". Về mặt câu chuyện và
  chất liệu, dự án có cửa ở phân khúc đó.
- Điều kiện cần không phải là cốt truyện dài hơn mà là một **lát cắt dọc chơi được**: phố cổ + hồ Gươm
  + 2 quận lân cận, 6-8 giờ truyện (mở đầu + chương 1 + chương 2 đã trả hệ quả), nhìn ra Hà Nội ở
  chất lượng trailer, chạy 60 fps trên máy tầm trung. Một thành phố 663.712 tòa nhà 1:1 với chất lượng
  ảnh thật là phạm vi AAA (nhiều chục triệu đô); phần dữ liệu đã dựng xong, phần *nhìn* mới là chỗ tốn.
- Rủi ro lớn nhất không phải truyện: (1) phạm vi, (2) chất lượng tài sản phố cổ (bộ kit mặt tiền),
  (3) hiệu năng, (4) bản quyền nhạc và tên thương hiệu (Times City, Royal City, Aeon trong dữ liệu tham
  chiếu phải đổi tên nhại trong game), (5) duyệt văn hóa.

## Bảng điểm (1-5)

| Tiêu chí | Hiện tại | Sau khi sửa 12 việc dưới | Ghi chú |
| --- | --- | --- | --- |
| Tiền đề | 5 | 5 | Căn nhà ba chủ, tờ giấy cháy, 24 cuộn băng |
| Nhân vật | 4 | 5 | Ba cung rõ; Khôi cần nói ít hơn và nhìn nhiều hơn |
| Mở màn | 2 → **5** | 5 | Lúc thẩm định: hướng dẫn lái xe. Sau khi sửa: cold open 1957/1972, bốn số đo mở màn đều đạt chuẩn (11 §3) |
| Hệ quả lựa chọn | 1 → **5** | 5 | Lúc thẩm định: 2/34 cờ được đọc. Sau khi sửa: 34/34, 48 chỗ đọc, 38 hệ quả trong chương (11 §7) |
| Logic dữ liệu | 5 | 5 | 0 lỗi chặn chơi |
| Nhịp chơi | 3 | 4 | 45% thoại, nhiệm vụ 4 phút |
| Kinh tế | 2 → **4** | 4 | Lúc thẩm định: Minh lỗ hàng tháng, mục tiêu 120 tr không bao giờ tới. Sau khi sửa: lỗ nếu chỉ chạy app (chủ ý), dư 5,8 tr nếu đi đủ bậc, góp vốn 40 tr sau 7 tháng game (01, 06) |
| Thế giới sống | 2 → **4** | 4 | Lúc thẩm định: 0 sự kiện ngẫu nhiên, 6 quận trống. Sau khi sửa: 45 sự kiện ngẫu nhiên có Khổ-Tập, 122 lựa chọn, mỗi quận ≥ 20 sự kiện có thể nổ (02 §7.1); 14/14 quận có nhiệm vụ (12) |
| Độc đáo / dễ kể cho báo chí | 5 | 5 | "Hà Nội thật, không bắn súng, ký ức như dữ liệu" |
| Khả thi thương mại | 2 | 3 | Cần lát cắt dọc trước khi nói tiếp |

## 12 việc để biến bản nháp thành bản bán được (theo thứ tự)

1. ~~Quy tắc đồng hồ: 8x ngoài phố, 1x trong nhiệm vụ; kiểm tra `hours` lúc bắt đầu bước; thêm
   `wait_until` trước ba bước chụp bị lệch. Chạy lại `tools/playtest.py` tới 0 cảnh báo.~~ **Đã làm, theo
   quyết định của chủ dự án: giữ 30x như GTA5 (ngày 48 phút thật), không có chế độ 8x.** Bước có khung giờ
   đặt sau bước đi tới nơi, kèm `wait_until` có `skip_allowed` tại chỗ (p3, c1_02, c1_04 theo
   `10-sua-chuong-1.md` M1). Giả lập: 0 cảnh báo.
2. ~~Kinh tế Minh: gửi quê 3 tr, ca đêm giao đồ ăn 20.000 đ/đơn, thưởng tuần của app; mục tiêu
   "dư 2-3 tr/tháng nếu chăm" để tiệm 120 tr thành 3-4 năm game, tức là *phải* nhờ truyện (và nói rõ).~~
   **Đã làm, theo nhân quả thay vì hạ số:** 6 tr về quê giữ nguyên nhưng tách thành 2 tr cho mẹ + 4 tr
   trả góp viện phí 180 tr (60 kỳ, có ngày hết). Chỉ chạy app vẫn âm 0,7 tr/tháng, đó là Khổ của Minh và
   là lý do anh nghe Kim Long. Bậc thang (Đạo): tối sửa xe ở tiệm Đức (+100 nghìn/ngày, mở từ c1_05),
   30 khách quen gọi điện của ông Lương (+60 nghìn, q_hd_04), thưởng tuần app 60 cuốc (+400 nghìn/tuần,
   `pay.weekly_bonus_vnd`): chăm thì dư 5,8 tr/tháng. Tiệm Đức Còi có cửa thứ hai: góp vốn 40 tr
   (`q_tx_04_gop_von_duc_coi`, 7 tháng game nếu chăm) thay vì mua đứt 120 tr (21 tháng). `01` §bậc thang, `06`.
3. ~~Mở màn mới: cold open 2 phút (băng số 1 hoặc cảnh tờ giấy cháy), rồi về P1.~~ **Đã làm:**
   `p0_ganh_pho_1957`, 4,6 phút, người chơi điều khiển cụ Thọ 1957 rồi 1972, tờ giấy cháy trước mắt
   người chơi; rồi về P1 (11 §3).
4. ~~Ba hệ quả trong chương 1 đọc lại cờ của chính chương 1 (ví dụ ở trên).~~ **Đã làm:** 35 cặp
   (nhiệm vụ, cờ) trả trong chương 1, gồm cả hai ví dụ trên và bản sửa `10-sua-chuong-1.md` (11 §5).
5. Viết chương 2 "Mùa nồm" thành dữ liệu: 9-10 nhiệm vụ, trả ít nhất 10 cờ; đưa vụ ông Tư Hàng
   Bạc lên sớm làm hành động đầu tiên của Kim Long. **Đang làm ở PR #9 (luồng "Chơi thử và thẩm định
   cốt truyện"): 8 nhiệm vụ, phủ cả 6 quận trống, điểm nhấn Giao thừa Hồ Gươm; bản nháp chương 2 của
   luồng này đã bàn giao (11 §6).**
6. ~~Mỗi quận trống một nhiệm vụ truyện hoặc người lạ: Cầu Giấy (Khôi bán ảnh cho báo ở Duy Tân), Hai
   Bà Trưng (Lan mua vải chợ Hôm, Bách Khoa), Hoàng Mai (chợ Đền Lừ 2h sáng, HH Linh Đàm), Hà Đông
   (Vạn Phúc, ga Yên Nghĩa), Bắc Từ Liêm (Tây Tựu hoa đêm, đình Chèm), Long Biên (Aeon, đê Ngọc Thụy).~~
   **Đã làm, theo yêu cầu "làm nốt 8 quận" của chủ dự án:** 26 nhiệm vụ người lạ, 15 nhân vật có
   Khổ-Tập-Diệt-Đạo, 44 cờ lựa chọn đều được đọc lại, kết ở đêm khai mạc Bảo tàng Hà Nội
   (`12-ho-so-quan.md`). Long Biên đã có s05, s06 và chương 2 (cầu Long Biên, ga Long Biên).
7. ~~40 sự kiện ngẫu nhiên thành collection `random_events` (schema mới).~~ **Đã làm:** 45 sự kiện,
   6 loại, 122 lựa chọn không trùng hậu quả, 43 NPC có Khổ-Tập, 9 lựa chọn qua minigame, 5 lựa chọn
   dẫn tới phạt theo Nghị định 168; chuẩn ghim trong tests/test_random_events.py (02 §7.1).
8. Sưu tầm thành từng món có tọa độ: 120 ảnh xưa trải đều 12 quận (đây là bản đồ thứ hai của game).
9. Đường thứ hai tới nội dung băng 24 không qua sưu tầm.
10. ~~Kỹ năng mở khóa thứ nhìn thấy được (3 mốc mỗi kỹ năng).~~ **Đã làm:** `skills.json` 12 kỹ năng x 3 mốc,
    `min_skills` trong điều kiện chung (C++ `EvaluateCondition`, playtest, validator), 25 cổng trong nội
    dung, chuẩn ghim trong tests/test_skill_unlocks.py (02 §10).
11. ~~Đổi tên nhại cho mọi thương hiệu thật trong `landmarks.json` khi xuất ra game (giữ tên thật chỉ
    trong dữ liệu tham chiếu, đã ghi chú trong từng mục).~~ **Đã làm:** Thời Gian City, Hoàng Gia City,
    Ê Ông Mall, Lốt Tê, Tháp Bảy Hai; tên thật chỉ còn ở `modelling.real_name`; tests/test_brand_names.py
    quét toàn bộ nội dung người chơi nhìn thấy (02 §4).
12. Lát cắt dọc: phố cổ + hồ Gươm + Ba Đình + Long Biên, mở đầu + chương 1 + 2, demo 60 phút cho
    người Hà Nội chơi thử và ghi lại phản ứng ở ba chỗ: cold open, cuốc xe đầu, lời mời của Thảo.
