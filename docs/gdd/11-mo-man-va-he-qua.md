# 11. Mở màn và hệ quả lựa chọn: từ 2/5 và 1/5 lên 5/5

Ngày 14/10/2026. Bản thẩm định `07-tham-dinh-trieu-do.md` chấm **Mở màn 2/5** (mở bằng một cuốc xe
hướng dẫn, câu hỏi lớn đến sau 40 phút) và **Hệ quả lựa chọn 1/5** (34 cờ được đặt, 2 cờ được đọc).
Chủ dự án yêu cầu nghiên cứu và nâng hai điểm này tới 5/5. Tài liệu này ghi: chuẩn 5/5 đo được là gì,
đã học gì từ các game tham chiếu, đã sửa gì trong dữ liệu và runtime, và số đo sau khi sửa
(`06-gia-lap-choi-thu.md` là bản in của `tools/playtest.py`, CI chạy lại mỗi lần đẩy mã).

## 1. Chuẩn 5/5 phải đo được

Điểm 2 và 1 là ý kiến; muốn lên 5 thì phải đổi ý kiến thành phép đo để không tự chấm cho mình.

**Mở màn 5/5** (đo trên 20 phút thật đầu tiên, cả bốn kiểu người chơi):

| Phép đo | Chuẩn | Lý do |
| --- | --- | --- |
| Phút thật tới lúc người chơi cầm điều khiển | < 1 phút | GTA V đưa tay cầm sau ~50 giây logo; Yakuza 0 sau ~1 phút |
| Phút tới lựa chọn đầu tiên có cờ | < 3 phút | Lựa chọn sớm là lời hứa "game này nghe anh" |
| Đoạn liên tiếp dài nhất chỉ xem, không điều khiển | ≤ 3 phút | Quá 3 phút cắt cảnh liên tục là ngưỡng người chơi bỏ tay cầm |
| Phút "câu hỏi lớn" được nói ra (nhà, tờ giấy, bán hay giữ) | < 5 phút | Trước khi hướng dẫn lái xe, người chơi phải biết mình chơi vì cái gì |

**Hệ quả lựa chọn 5/5:**

| Phép đo | Chuẩn | Lý do |
| --- | --- | --- |
| Cờ do lựa chọn đặt được đọc lại ở đâu đó | 100% | Một cờ không ai đọc là lựa chọn giả |
| Số cờ lựa chọn | ≥ 2 mỗi nhiệm vụ truyện | Đủ dày để hai người chơi kể lại hai câu chuyện khác nhau; chuẩn theo tỷ lệ để còn đúng khi chương 2-5 vào |
| Hệ quả trả **ngay trong chương** (nhiệm vụ sau đọc cờ của nhiệm vụ trước cùng chương) | ≥ 20 cặp | Trả sau 6 giờ chơi thì không ai nhớ mình đã chọn gì |
| Dòng thoại / bước chỉ một phần người chơi thấy | ≥ 100 dòng, ≥ 15 bước | Đo độ rẽ thật giữa các kiểu chơi |
| Cờ tiến trình chưa ai đọc | 0 | Sạch dữ liệu |

Cả hai bảng được mã hóa thành `tests/test_playtest.py::test_opening_and_consequence_standards`, nên
từ nay nội dung mới làm tụt chuẩn là CI đỏ.

## 2. Tham chiếu đã nghiên cứu

Mở màn:

- **GTA V, Ludendorff 2004**: cướp ngân hàng trước, tên nhân vật sau. Người chơi bắn và lái trong
  phút đầu, biết "có người phản bội" trước khi biết ai là ai. Bài học: *cho thấy cái mất trước khi
  giải thích*.
- **Yakuza 0**: mở bằng một cái xác trên khu đất trống rồi lùi về buổi tối đòi nợ; câu hỏi "ai giết,
  tại sao miếng đất này" treo suốt 10 chương. Bài học: câu hỏi lớn ở phút đầu, trả lời ở hồi cuối,
  nhưng mỗi chương trả một mảnh.
- **Red Dead Redemption 2**: mở chậm (tuyết), nhưng mỗi 2-3 phút trả tay cầm cho người chơi một việc
  nhỏ (dắt ngựa, đỡ người). Bài học: cắt cảnh dài phải xen điều khiển; chuẩn "≤ 3 phút" lấy từ đây.
- **The Last of Us**: mở bằng *người sẽ không còn* (Sarah) và cho người chơi điều khiển cô bé. Cold
  open ở đây làm đúng vậy: người chơi điều khiển **cụ Thọ năm 1957** gánh phở, ký giấy, rồi 1972 bế
  con xuống hầm. Cái mất (tờ giấy cháy, ông Khiêm đi B) được *sống* chứ không được *kể*.

Hệ quả lựa chọn:

- **Telltale (The Walking Dead)**: dòng "X sẽ nhớ điều này" rẻ nhất mà hiệu quả nhất. Ta làm bằng
  `lines[].condition`: nhân vật nhắc lại lựa chọn bằng *lời*, đúng tên việc đã làm, trong nhiệm vụ
  ngay sau (ví dụ Tuấn trách Minh nhận việc Kim Long ở 1.5, cô Hạnh nhắc Lan đối đầu ở họp tổ).
- **The Witcher 2**: một lựa chọn rẽ cả hồi (Iorveth / Roche). Ta làm một lần, đúng chỗ đắt nhất:
  `c2_03` rẽ ba đường theo cách Lan hành xử ở họp tổ dân phố (kỷ luật / thuyết trình / lời mời).
- **Mass Effect 2**: hệ quả cộng dồn từ nhiều việc nhỏ (ai sống sau nhiệm vụ cuối). Ta làm ở
  `c2_07`: phương án đêm giao thừa phụ thuộc cô Hạnh có nghe phương án tự quản hay không, mà điều đó
  lại phụ thuộc Lan bảo lãnh hay loại cô ở `c2_05`.
- **Life is Strange**: hệ quả nhỏ nhưng *nhìn thấy* (cái cây, tấm ảnh). Ta làm bằng `variant_from_flags`
  ở bước: xe để ở Ô Quan Chưởng hay không, Mark viral hay thường, Thảo gọi Minh hay Tuấn.
- **Disco Elysium**: lựa chọn mở *lựa chọn khác* chứ không khóa. Ta làm bằng `choices[].condition`:
  Lan chỉ có lựa chọn công khai danh sách nếu Minh đã kể; Minh chỉ có lựa chọn bỏ việc nếu đã nhận.

Nguyên tắc rút ra, dùng cho mọi chương sau:

1. Cho thấy cái mất trước khi giải thích. Câu hỏi lớn trước phút 5.
2. Lựa chọn đầu tiên là lựa chọn *giá trị* (tin ngay / hỏi trước; cứu giấy / cứu con), không phải
   lựa chọn chiến thuật.
3. Ba tầng hệ quả cho mỗi cờ: **nhắc** (một dòng thoại), **khóa/mở** (một lựa chọn hay nhiệm vụ phụ),
   **rẽ** (một bước, một nhánh nhiệm vụ). Mỗi cờ ít nhất tầng 1; cờ lớn đủ ba tầng.
4. Trả mỗi lựa chọn hai lần: một lần trong chương (để người chơi *thấy*), một lần ở chương sau
   (để người chơi *nhớ*).
5. Gọi đúng tên lựa chọn khi nhắc lại ("Anh nhận việc của Kim Long rồi còn gì"), không nói chung chung.
6. Khác biệt, không trừng phạt: nhánh nào cũng đi tiếp được, chỉ khác người, khác giá.

## 3. Mở màn mới: `p0_ganh_pho_1957`

Cold open 4,6 phút thật, chơi **trước** cuốc xe rạng đông của Minh, nhân vật điều khiển là cụ Thọ
năm 1957 (`characters:tho_1957`, 17 tuổi, gánh phở thuê ở Hàng Chiếu; 86 tuổi ở hiện tại).

| Phút | Bước | Loại | Người chơi làm gì |
| --- | --- | --- | --- |
| 0:00 | Ngõ 1957 | cắt cảnh 25 s | Tiếng rao, loa phường, ngõ Hàng Chiếu đen trắng |
| 0:25 | Gánh phở | minigame 60 s | **Cầm điều khiển**: gánh phở qua ngõ, giữ thăng bằng |
| 1:25 | Bát đầu tiên | thoại | Ông Khiêm (ông nội Khôi) mời góp vốn mua chung căn nhà: "Tôi có sáu cây, thiếu hai" |
| 2:36 | | **lựa chọn 1** | *Ông viết đi, cháu ký, cháu tin ông* (`tho_tin_ngay`) / *Cháu hỏi vợ đã* (`tho_hoi_truoc`) |
| 2:40 | Ký giấy | cắt cảnh 15 s | Tờ giấy 1957: "Không nhà nào bán phần mình khi nhà kia còn người ở" |
| 2:55 | Đêm 1972 | cắt cảnh 60 s | Còi báo động, ông Khiêm đã đi B, tờ giấy có dòng viết thêm |
| 3:55 | | **lựa chọn 2** | *Quay lại lấy giấy* (`tho_cuu_giay`, cụ Thọ mang sẹo bỏng) / *Kệ giấy, bế con xuống hầm* (`tho_cuu_con`) |
| 4:00 | Xuống hầm | đi | Chạy ra hầm tập thể dưới bom |
| 4:30 | Kết | cắt cảnh 15 s | Tờ giấy cháy đúng chỗ tên người nhận. Cắt sang 2026: Minh dậy, app Vồ kêu |

Sau đó P1 (cuốc xe) giữ nguyên nhưng đã có cái để chở: người chơi biết căn nhà, tờ giấy, và lời hứa
trước khi gặp Khôi. Hai cờ của cụ Thọ được trả ở `p2` (bếp lúc khuya: vết sẹo hay không), `p3` (gác
xép) và `c1_09` (bữa tối tầng 72: cụ kể lại đúng điều người chơi đã chọn); chương 2 (PR #9) đọc tiếp.

Số đo trước và sau, cùng một công cụ (`tools/playtest.py` mới chạy trên nội dung của `main` trước
khi sửa, rồi trên nội dung này); giống nhau cho cả bốn kiểu người chơi vì mở màn chưa rẽ theo tính cách:

| Phép đo (phút thật) | Trước | Sau | Chuẩn |
| --- | ---: | ---: | ---: |
| Cầm điều khiển | 2,0 (sau cắt cảnh app Vồ) | **0,4** | < 1 |
| Lựa chọn đầu | 19,6 (đèn đỏ đầu tiên của P1) | **2,6** | < 3 |
| Đoạn dài nhất chỉ xem | 2,0 | **2,4** | ≤ 3 |
| Câu hỏi lớn được nói ra | 29,1 (P2: "cô gái mặc vest hỏi bà nhà") | **2,6** ("tôi có sáu cây, thiếu hai") | < 5 |

## 4. Hệ quả lựa chọn: cơ chế dữ liệu

Ba thứ được thêm vào schema và runtime (chi tiết kỹ thuật ở `02-he-thong.md` §8):

- `dialogues.lines[].condition` và `choices[].condition` (đề xuất schema #3 của `04-danh-sach-noi-dung.md`,
  nay đã làm, nền kỹ thuật ở PR #7 của luồng chơi thử). Điều kiện dùng chung
  `common.schema.json#/$defs/condition`, có `not_flags` (không cờ nào bật) và `events_active`.
  Dòng không đủ điều kiện bị bỏ qua và **rơi xuống dòng kế tiếp trong mảng** (không theo `goto` của
  dòng bị bỏ), nên các biến thể `l05a`/`l05b`/`l05c` xếp liền nhau và dòng cuối không điều kiện làm
  mặc định. Lựa chọn không đủ điều kiện bị ẩn; `tools/validate.py` bắt mọi dòng có lựa chọn giữ ít nhất
  một lựa chọn không điều kiện, dòng cuối mỗi đoạn không điều kiện, mọi `goto` trỏ đúng, id dòng không
  trùng, và khóa điều kiện chỉ là thứ UI thoại đánh giá được giữa chừng.
- `missions.steps[].params.duration_s`: độ dài thiết kế của một bước (giây), để giả lập đo phút thật
  của mở màn thay vì ước lượng theo loại bước.
- Runtime UE5 (`02-he-thong.md` §9): `EvaluateCondition` hiểu `not_flags` và `events_active`; UI thoại
  gọi `ResolveDialogueLine` (dòng đầu tiên đủ điều kiện từ một id), `NextDialogueLine` (theo `goto`
  hoặc dòng kế rồi lọc), `GetAvailableChoices` (các lựa chọn được hiện) và `ApplyChoice`.
  `UHanoiHeatSubsystem` đọc cờ `giam_chu_y_vinh_vien_1` (phần thưởng `s12`) để hạ trần Chú ý một bậc.

Cách giả lập phân loại cờ (`tools/playtest.py`, phần "Hệ quả lựa chọn"): cờ **lựa chọn** là cờ do
`choices[].effects.set_flags` đặt hoặc do bước chỉ tới được qua bảng rẽ; cờ **tiến trình** là phần
thưởng nhiệm vụ hoặc bước thẳng. Chỗ đọc được đếm theo năm loại: `mission_gate` (requires của
nhiệm vụ), `step_branch` (bảng rẽ theo cờ), `step_variant` (`variant_from_flags`), `dialogue_line`,
`dialogue_choice`.

## 5. Hệ quả đã nối trong chương 0-1

38 cặp (nhiệm vụ, cờ) trả ngay trong chương 1 cho lựa chọn ở chương 0-1 (sau khi áp cả bản sửa `10-sua-chuong-1.md`). Những cặp người chơi cảm
được rõ nhất:

| Lựa chọn | Hệ quả thấy ngay (chương 1) | Hệ quả về sau (chương 2, đang viết ở PR #9 của luồng chơi thử, theo bảng cờ của `10-sua-chuong-1.md`) |
| --- | --- | --- |
| Minh nhận việc Kim Long (1.3) | Tuấn nói khác hẳn khi Minh cứu xe ở 1.5; Minh có thêm lựa chọn *bỏ việc* / *giữ việc*; Vĩnh biết Minh đã nói 'việc là việc' với Tuấn | Vĩnh chào Minh khác ở tầng 72; nhóm Alô Chat tra hỏi ở 2.4 |
| Minh kể Lan về danh sách 14 nhà (1.3) | Lan có lựa chọn thứ tư ở họp tổ dân phố: công khai danh sách, kéo theo `thao_nghi_minh` | Thảo nghi Minh ở tầng 72 |
| Lan mua gia vị rẻ (1.4) | Mark chê nước dùng ở 1.7, video chỉ "bình thường", doanh thu +10%/7 ngày thay vì +40%/30 ngày | Mở màn 1.8 nói về video khác nhau |
| Lan đối đầu / nói hộ cô Hạnh (1.6) | Vĩnh dùng đúng câu Lan nói trong họp để ép ở tầng 72; Thảo kết khác | Cô Hạnh ở 2.5 nghe hay không nghe phương án tự quản |
| Lan lộ thông tin mật ngân hàng (1.6) | Vĩnh nhắc tới ở tầng 72 | 2.3 rẽ sang nhánh *kỷ luật*: Lan phải sửa sai công khai |
| Khôi nghiêng về bán / ở lại / chưa quyết (1.2) | Ông Thắng chào Khôi ba cách ở họp tổ | Ông Thắng lúc chúc Tết (2.6) |
| Khôi giữ phần nhà / xin thời gian (1.6) | Vĩnh đổi hẳn phần đề nghị ở tầng 72 (bỏ qua mặc cả); Lan có hai cách phản ứng | |
| Khôi tặng ảnh cho Thảo, Linh đăng ảnh (1.8) | Thảo mở hay khép ở bàn ăn tầng 72 | Thảo trong xe đêm giao thừa (2.7) |
| Cụ Thọ tin ngay / cứu giấy (P0) | Vết sẹo ở P2, chuyện kể ở P3 | Cụ kể lại đúng ký ức ở tầng 72 và ở 2.1 |

## 6. Chương 2 "Mùa nồm": bàn giao cho luồng chơi thử

Chương 2 thuộc luồng "Chơi thử và thẩm định cốt truyện" (PR #9, phủ đủ sáu quận chưa có truyện, điểm
nhấn Giao thừa Hồ Gươm). Bản chương 2 viết ở luồng này (7 nhiệm vụ truyện + 2 phụ, 27 đoạn thoại) được
rút khỏi PR #8 và để ở `/mnt/project-files/hanoi-city/handoff/` cùng danh sách 18 cờ chương 1 mà chương
2 phải đọc; luồng kia lấy nhánh rẽ ba của phòng thẩm định (`c2_03`) và cặp kết chương cô Hạnh hoãn ký /
đã ký (`co_hanh_hoan_ky` / `co_hanh_da_ky`) ghép vào bản của họ. Ba cờ chương 1 có chỗ đọc ở chương 2
(`khoi_hoc_tu_keo_ly`, `biet_giay_1957`, `ket_thuc_chuong_1`) được ghi trong `READ_IN_CHAPTER_2` của
`tests/test_content_logic.py` và xóa dần khi PR #9 vào `main`.

## 7. Kết quả đo được

Cột "Trước" đo bằng công cụ mới trên nội dung `main` trước khi sửa (bản 07 đếm tay ra "2/34 cờ" vì
gộp cả cờ tiến trình và chỉ tính cờ đọc ở nhiệm vụ khác; công cụ mới tách cờ lựa chọn và đếm cả chỗ
đọc trong thoại).

| Phép đo | Trước | Sau | Chuẩn 5/5 |
| --- | ---: | ---: | ---: |
| Cờ lựa chọn được đọc lại | 6/24 (6 chỗ đọc) | **34/34** (48 chỗ đọc) | 100%, ≥ 2 mỗi nhiệm vụ truyện (13 nhiệm vụ → ≥ 26) |
| Loại chỗ đọc | biến thể bước 4, rẽ bước 2 | dòng thoại 32, lựa chọn 3, rẽ bước 2, biến thể bước 4 | |
| Hệ quả trả trong chương 1 | 6 | **38** | ≥ 20 |
| Dòng thoại / bước chỉ một phần người chơi thấy | 57/354 dòng, 10 bước | **129/449 dòng, 22 bước** | ≥ 100 / ≥ 15 |
| Cờ tiến trình chưa đọc | 13/14 | **3/15**, cả ba có chỗ đọc ở chương 2 (PR #9) | 0 ngoài danh sách chờ chương 2 |
| Hệ quả kích hoạt trong một lượt chơi (4 kiểu) | | 28-32 trên 64-66 kiểm tra | |
| Nhiệm vụ | 24 | **25** (13 truyện, 12 phụ) | |
| Lỗi chặn chơi / cảnh báo giờ giấc | 0 / 2 | **0 / 0** | 0 |

Khi đo cùng bản chương 2 đã bàn giao (trước khi rút), con số là 57/57 cờ, 110 chỗ đọc, 186/626 dòng
rẽ; các số đó sẽ quay lại khi PR #9 vào.

Bảng đủ 34 cờ (đặt ở đâu, đọc ở đâu, loại hệ quả) ở cuối tài liệu.

## 8. Còn lại, ngoài phạm vi lần này

- **UI thoại trong UE5** phải gọi `ResolveDialogueLine` / `NextDialogueLine` /
  `GetAvailableChoices` / `ApplyChoice` thay vì đọc mảng `lines` trực tiếp; mã C++ đã có, chưa biên dịch (không
  có UE trong môi trường này, xem `../05-tich-hop-ue5.md` §7).
- **Chủ dự án duyệt truyện**: cold open 1957/1972 và bản sửa 7 chỗ gãy chương 1 (`10-sua-chuong-1.md`,
  đã áp, gia đình Lan theo hướng A: mẹ mất 2011, bố sang Hàn 2010) là nội dung mới, chưa qua người đọc Hà Nội. Lời thoại tiếng Việt mới (~300 dòng) nên được một
  người Hà Nội đọc to.
- Đồng hồ: chủ dự án chốt 30x như GTA5 (ngày 48 phút thật). Quy tắc dữ liệu: bước có khung giờ đặt
  **sau** bước đi tới nơi, kèm một `wait_until` có `skip_allowed` tại chỗ (p3 ngủ ghế đá Bờ Hồ tới 5:30,
  c1_02 chờ nắng xiên đầu cầu Long Biên, c1_04 ninh mẻ mới 3:30 hôm sau). Giả lập còn 0 cảnh báo giờ giấc.
- Kinh tế của Minh vẫn âm (việc 2). Các quận chưa có truyện: chương 2 của PR #9 chạm cả sáu; luồng này
  viết thêm nhiệm vụ phụ / người lạ và hồ sơ quận (việc 6).

## Phụ lục: 34 cờ lựa chọn chương 0-1

| Cờ | Đặt bởi | Đọc bởi | Loại hệ quả |
| --- | --- | --- | --- |
| `khoi_chua_quyet` | dialogue:dlg_c1_02_hoang_hon | dialogue:dlg_c1_06_hop | dialogue_line |
| `khoi_giu_ban_goc` | dialogue:dlg_c1_08_thao_va_buc_anh | dialogue:dlg_c1_09_vinh | dialogue_line |
| `khoi_giu_phan` | dialogue:dlg_c1_06_hop | c1_06_hop_to_dan_pho, dialogue:dlg_c1_09_vinh | dialogue_line, step_variant |
| `khoi_nghieng_ban` | dialogue:dlg_c1_02_hoang_hon | dialogue:dlg_c1_06_hop | dialogue_line |
| `khoi_nghieng_o_lai` | dialogue:dlg_c1_02_hoang_hon | dialogue:dlg_c1_06_hop | dialogue_line |
| `khoi_tang_anh_thao` | dialogue:dlg_c1_08_thao_va_buc_anh | dialogue:dlg_c1_09_vinh | dialogue_line |
| `khoi_xin_thoi_gian` | dialogue:dlg_c1_06_hop | dialogue:dlg_c1_09_vinh | dialogue_choice, dialogue_line |
| `lan_biet_danh_sach` | c1_03_khach_vip_ca_ngay | dialogue:dlg_c1_05_tuan, dialogue:dlg_c1_06_hop, dialogue:dlg_c1_09_vinh | dialogue_choice, dialogue_line |
| `lan_cong_khai_danh_sach` | dialogue:dlg_c1_06_hop, dialogue:dlg_c1_09_vinh | dialogue:dlg_c1_09_vinh | dialogue_choice |
| `lan_de_xuat_tu_quan` | dialogue:dlg_c1_06_hop | c1_06_hop_to_dan_pho, dialogue:dlg_c1_08_thao_va_buc_anh, dialogue:dlg_c1_09_vinh | dialogue_line, step_variant |
| `lan_doi_dau_co_hanh` | dialogue:dlg_p2_co_hanh | dialogue:dlg_c1_06_hop | dialogue_line |
| `lan_lo_thong_tin_mat` | dialogue:dlg_c1_06_hop | c1_06_hop_to_dan_pho, dialogue:dlg_c1_09_vinh | dialogue_line, step_variant |
| `lan_moi_vinh_dau_tu_tu_quan` | dialogue:dlg_c1_09_vinh | dialogue:dlg_c1_09_bi_mat | dialogue_line |
| `lan_mua_gia_vi_chuan` | dialogue:dlg_c1_04_ba_lua | c1_04_cho_dong_xuan_luc_6_gio | step_branch |
| `lan_mua_gia_vi_re` | dialogue:dlg_c1_04_ba_lua | c1_04_cho_dong_xuan_luc_6_gio, c1_07_mark_an_pho, dialogue:dlg_c1_07_mark_nem | dialogue_line, step_branch |
| `lan_pho_chieu_tro` | dialogue:dlg_c1_07_mark_den | c1_07_mark_an_pho, dialogue:dlg_c1_09_bi_mat, dialogue:dlg_c1_09_vinh | dialogue_line, step_variant |
| `lan_pho_co_dien` | dialogue:dlg_c1_07_mark_den | dialogue:dlg_c1_09_vinh | dialogue_line |
| `lan_tinh_no_cho_co` | dialogue:dlg_p2_co_hanh | dialogue:dlg_c1_06_hop, dialogue:dlg_c1_09_vinh | dialogue_line |
| `lan_tu_choi_vinh` | dialogue:dlg_c1_09_vinh | dialogue:dlg_c1_09_bi_mat | dialogue_line |
| `lan_xin_thoi_gian` | dialogue:dlg_c1_09_vinh | dialogue:dlg_c1_09_bi_mat | dialogue_line |
| `linh_dang_anh_thao` | dialogue:dlg_c1_08_thao_va_buc_anh | dialogue:dlg_c1_09_vinh | dialogue_line |
| `minh_bo_viec_kim_long` | dialogue:dlg_c1_05_tuan | dialogue:dlg_c1_09_vinh | dialogue_line |
| `minh_giu_kin_danh_sach` | c1_03_khach_vip_ca_ngay | dialogue:dlg_c1_05_mua, dialogue:dlg_c1_05_tuan | dialogue_line |
| `minh_giu_viec_kim_long` | dialogue:dlg_c1_05_tuan | dialogue:dlg_c1_09_vinh | dialogue_line |
| `minh_lai_xe_khong_do_la` | dialogue:dlg_c1_03_loi_moi | dialogue:dlg_c1_09_vinh | dialogue_line |
| `minh_nhan_viec_kim_long` | dialogue:dlg_c1_03_loi_moi | dialogue:dlg_c1_05_tuan, dialogue:dlg_c1_09_vinh | dialogue_line |
| `minh_suy_nghi` | dialogue:dlg_c1_03_loi_moi | dialogue:dlg_c1_09_vinh | dialogue_line |
| `thao_nghi_minh` | dialogue:dlg_c1_06_hop, dialogue:dlg_c1_09_vinh | dialogue:dlg_c1_09_vinh | dialogue_line |
| `tho_cuu_con` | dialogue:dlg_p0_dem_1972 | dialogue:dlg_c1_09_bi_mat | dialogue_line |
| `tho_cuu_giay` | dialogue:dlg_p0_dem_1972 | dialogue:dlg_c1_09_bi_mat, dialogue:dlg_p2_bep_luc_khuya | dialogue_line |
| `tho_hoi_truoc` | dialogue:dlg_p0_bat_dau_tien | dialogue:dlg_c1_09_bi_mat | dialogue_line |
| `tho_tin_ngay` | dialogue:dlg_p0_bat_dau_tien | dialogue:dlg_c1_09_bi_mat | dialogue_line |
| `video_mark_binh_thuong` | c1_07_mark_an_pho | dialogue:dlg_c1_08_mo_dau | dialogue_line |
| `video_mark_viral` | c1_07_mark_an_pho | dialogue:dlg_c1_08_mo_dau | dialogue_line |
