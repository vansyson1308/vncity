# 08. Nhân quả: động cơ, hệ quả, điểm nhấn, độ khó

Chủ dự án đặt sáu nguyên tắc cho toàn bộ phần truyện (14/10/2026). Tài liệu này biến chúng thành
quy tắc dữ liệu mà `tools/validate.py`, `tests/test_content_logic.py` và `tools/playtest.py`
kiểm được, để không ai (kể cả Claude ở luồng khác) viết nội dung lệch khỏi chúng.

| # | Nguyên tắc của chủ dự án | Quy tắc dữ liệu | Ai kiểm |
| --- | --- | --- | --- |
| 1 | Logic tuyệt đối: ai làm gì cũng có động cơ và mục đích, nhân quả như Tứ diệu đế | Mọi nhân vật (47, kể cả 20 mẫu NPC đường phố) có khối `drive` bốn phần Khổ-Tập-Diệt-Đạo; mọi lời thoại/hành động phải truy được về khối đó | schema bắt buộc; `test_every_character_has_a_drive` |
| 2 | Thoại bắt trend nhưng mang văn hóa | Bảng giọng từng nhân vật và kho từ lóng 2025 có nguồn trong `09-giong-thoai.md` | soát tay theo bảng |
| 3 | Lựa chọn không hệ quả là vô nghĩa | Mỗi cờ do lựa chọn đặt phải được **đọc** ít nhất một lần (điều kiện thoại, `branch_source: flag`, `requires`, `fail_if`) trong vòng tối đa một chương | `test_every_choice_flag_is_read`; playtest đếm `flags_read` |
| 4 | Mỗi chương có điểm nhấn | Mỗi chương khai báo một nhiệm vụ `tags: ["set_piece"]` với ba nhân vật hoặc một sự kiện thành phố | `test_every_chapter_has_a_set_piece` |
| 5 | Vòng sau khó hơn vòng trước, vẫn vượt qua được, hồi hộp và cay cú | Bảng độ khó §4: giới hạn giờ ngắn dần, `pass_score` tăng, mọi minigame có nhánh thua với cái giá (tiền, uy tín, một ngày) nhưng không bao giờ chặn truyện | `test_minigames_have_a_fail_branch` (từ chương 2) |
| 6 | Có nhiều thời gian, nghiên cứu kỹ | Mọi chi tiết văn hóa/luật trong truyện ghi nguồn ở cuối tài liệu liên quan | soát tay |

## 1. Khối `drive` (Tứ diệu đế) trong `characters`

```json
"drive": {
  "kho":  {"vi": "Điều đang làm họ khổ, ngay bây giờ."},
  "tap":  {"vi": "Nguyên nhân: điều họ bám víu, tin, sợ."},
  "diet": {"vi": "Trạng thái họ tin sẽ hết khổ = mục đích của họ trong game."},
  "dao":  {"vi": "Con đường họ chọn = hành vi ta thấy trên màn hình."},
  "tell": "Dấu hiệu lộ ra trong thoại hay cử chỉ (cho người viết thoại và animator)."
}
```

Cách dùng khi viết thoại hoặc nhiệm vụ:

1. **Trước khi cho nhân vật nói**, đọc `diet` và `dao` của họ: câu đó có đưa họ tới gần `diet`
   không? Nếu không, câu đó chỉ là lời tác giả, cắt.
2. **Khi nhân vật đổi ý** (Thảo báo cáo công ty, cô Hạnh ngừng bán), phải có một sự kiện trong game
   chạm vào `tap` của họ (nguyên nhân thay đổi thì quả mới đổi). Ví dụ Thảo chỉ nộp hồ sơ sai phạm
   sau khi thấy bà cụ Hàng Bạc bị ép bán y như bà ngoại cô (chương 2, `c2_04`).
3. **NPC đường phố** cũng theo `drive`: shipper rẽ ẩu vì sợ phạt trễ đơn, CSGT chốt dày khi 'Chú ý'
   cao, bà bán xôi bê thúng chạy khi thấy xe trật tự. Hành vi AI của mẫu NPC lấy từ `dao`.
4. Nhân vật chính có hai `diet`: cái họ nói ra ở đầu game (Minh: trả nợ) và cái thật (Minh: không
   phải nói dối mẹ). Cung nhân vật là hành trình từ cái thứ nhất sang cái thứ hai; chương 4 là lúc
   `diet` thật lộ ra.

## 2. Hệ quả của lựa chọn

Ba cấp hệ quả, từ rẻ tới đắt; mọi lựa chọn phải có ít nhất cấp 1, lựa chọn ở nhiệm vụ truyện phải
có cấp 2, hạn chót chương phải có cấp 3.

| Cấp | Cơ chế | Chi phí viết | Ví dụ |
| --- | --- | --- | --- |
| 1. Người ta nhớ | `condition` trên dòng thoại/lựa chọn (`02-he-thong.md` §9) | 1-2 dòng thoại | `lan_mua_gia_vi_re` → bà Lụa chương 2: "Lần trước cháu lấy hàng rẻ, bà không gói hàng ngon cho người không cần nó" và giá cao hơn |
| 2. Đường đi đổi | `branch_source: "flag"`, `requires.flags`/`not_flags`, `fail_if flag:` | một bước hoặc một nhiệm vụ | `minh_nhan_viec_kim_long` → chương 2 Minh nhận danh sách thứ hai thay vì được Thảo hỏi ý |
| 3. Thế giới đổi | `reward.set_flags` + `unlocks`, `business_effect`, uy tín phe | một nhiệm vụ hoặc một sự kiện | kết chương 2: tổ dân phố ủng hộ hay không quyết định ai đứng cạnh Lan đêm giao thừa |

**Sổ cờ (ledger).** Mỗi cờ mới phải có dòng trong bảng dưới trước khi gộp PR, ghi nơi đặt và nơi
đọc. `tools/playtest.py` in `flags_written` / `flags_read`; chênh lệch phải bằng không với cờ của
lựa chọn (cờ trạng thái như `ket_thuc_chuong_1` được phép chỉ đọc ở chương sau).

Cờ chương 0-1 và nơi chương 2 đọc chúng:

| Cờ (đặt ở) | Chương 2 đọc ở |
| --- | --- |
| `lan_doi_dau_co_hanh`, `lan_tinh_no_cho_co` (P2) | `c2_05` ông Công ông Táo: cô Hạnh mở lời khác nhau, số nợ thật chỉ lộ nếu từng được hỏi số liệu |
| `lan_mua_gia_vi_chuan` / `lan_mua_gia_vi_re` (1.4) | `c2_05` bà Lụa bán hàng Tết: giá và lời |
| `minh_lai_xe_khong_do_la` / `minh_nhan_viec_kim_long` / `minh_suy_nghi` (1.3) | `c2_03` Thảo giao danh sách thứ hai: ba lối vào khác nhau |
| `lan_biet_danh_sach` / `minh_giu_kin_danh_sach` (1.3) | `c2_03` Lan biết hay không khi Minh gặp rắc rối; `c2_07` ai gọi ai lúc 23:30 |
| `lan_lo_thong_tin_mat` (1.6) | `c2_02` ngân hàng cũ gọi: điều tra thay vì mời về |
| `lan_de_xuat_tu_quan` (1.6) | `c2_07` lựa chọn "Phương án tự quản" mở với Vĩnh |
| `khoi_xin_thoi_gian` / `khoi_giu_phan` (1.6) | `c2_01` ông Thắng, `c2_07` Vĩnh nói với ai trước |
| `lan_pho_co_dien` / `lan_pho_chieu_tro`, `video_mark_viral` (1.7) | `c2_05` khách Tết đông hay vắng, Mark quay lại hay không |
| `khoi_tang_anh_thao` / `khoi_giu_ban_goc`, `linh_dang_anh_thao` (1.8) | `c2_06` Thảo ở Hà Đông: có mở cửa cho Khôi không |
| `lan_tu_choi_vinh` / `lan_xin_thoi_gian` / `lan_moi_vinh_dau_tu_tu_quan` (1.9) | `c2_07` Vĩnh nhắc lại đúng câu Lan đã nói |
| `khoi_nghieng_o_lai` / `khoi_nghieng_ban` / `khoi_chua_quyet` (1.2) | `c2_01` ông Thắng nhắc; `c2_08` cụ Thọ chọn ai xông đất |
| `duoc_do_o_quan_chuong` (S4), `quen_ong_thang` (1.2), `tang_tem_phieu_bao_tang` (S8) | `c2_04` hội xe ôm giúp Minh hay không; `c2_01`; `c2_05` |

## 3. Điểm nhấn từng chương

| Chương | Điểm nhấn (set piece) | Cơ chế mới người chơi gặp lần đầu |
| --- | --- | --- |
| 0 Mở đầu | (luồng "Dựng đủ các quận" viết cold open) | lái xe trong 60 giây đầu |
| 1 Phố cũ, người mới | Tối thứ Bảy phố đi bộ (1.8): ba nhân vật ba việc trong một sự kiện thành phố | đổi nhân vật giữa nhiệm vụ |
| 2 Mùa nồm / Tết | **Giao thừa Hồ Gươm** (`c2_07`): ba nhân vật ở ba nơi 23:00, hạn chót của Vĩnh 23:30, gặp nhau ở Tháp Rùa đúng 0:00 pháo hoa; câu trả lời phụ thuộc toàn bộ chương 1-2 | lựa chọn bị khóa/mở bằng điều kiện, đếm ngược theo đồng hồ game |
| 3 Nước lên | Đêm ngập lịch sử: cứu kho ảnh trên gác, phố cổ không điện, thuyền trong ngõ | thời tiết thật đổi luật chơi |
| 4 Ngày 10/10 | Triển lãm ảnh ông Khải và bỏ phiếu tổ dân phố; băng số 24 | kết quả tính từ uy tín và cờ cả game |
| 5 Phố mất người hay không | Bát phở cuối cùng: ba kết, thế giới mở tiếp tục | không có game over |

## 4. Độ khó: vòng sau khó hơn vòng trước, vẫn qua được

Đồng hồ game theo chuẩn GTA5: 1 phút game = 2 giây thật, một ngày = 48 phút thật
(`Settings.TimeScale = 30`). Giới hạn giây trong bước (`time_limit_s`) là giây **thật**;
`deadline_hour` và `hours` là giờ **game**. Khi viết bước có giờ phải tính cả hai: 10 phút thật =
5 giờ game, nên "chở hàng về trước giờ ninh" 600 giây là cả một buổi sáng trong game, quá rộng.

| Thước đo | Ch. 0 | Ch. 1 | Ch. 2 | Ch. 3 | Ch. 4 |
| --- | --- | --- | --- | --- | --- |
| `pass_score` minigame | 70 | 70 | 75 | 80 | 85 |
| `time_limit_s` chở/giao (thật) | không | 600-2400 | 240-900 | 180-600 | 120-480 |
| Lỗi được phép (`max_faults`, "x lần") | 5 | 3-5 | 2-3 | 2 | 1-2 |
| Bước thua có nhánh `chua_dat` | không | không | tất cả | tất cả | tất cả |
| Giá của thua | không | làm lại | mất tiền/một ngày game | mất uy tín phe | mất một lựa chọn ở kết |
| Lựa chọn bị khóa bởi quá khứ | 0 | 0 | 4 | 6 | 10 |

Quy ước nhánh thua (bắt buộc từ chương 2): minigame/cook/photograph có `next` dạng bảng
`{"dat": ..., "chua_dat": ..., "default": "<chua_dat>"}`; nhánh `chua_dat` **không** kết thúc
nhiệm vụ bằng `fail`, mà dẫn tới một bước làm lại có giá (`cost_vnd`, `wait_until` hôm sau,
`reputation` âm trong thoại) rồi quay về bước chính. Người chơi luôn qua được, nhưng mất thứ gì đó
và nghe một câu khiến họ cay (bà Lụa: "Lần sau mang tiền đủ rồi hãy mặc cả").

Hồi hộp đến từ **đếm ngược có nhìn thấy**: `deadline_hour` hiển thị trên HUD như đồng hồ, không
phải thanh thời gian ẩn; và từ **không biết trước câu trả lời**: lựa chọn của đêm giao thừa chỉ hiện
khi điều kiện đủ, người chơi thấy số lựa chọn ít hơn mong đợi và hiểu vì sao.

## 5. Nguồn tham khảo cho phần luật trong truyện

- Bộ luật Dân sự 2015, Điều 218 (định đoạt tài sản chung): bán nhà thuộc sở hữu chung phải có sự
  đồng ý của tất cả chủ sở hữu chung; chủ sở hữu chung theo phần được bán phần của mình, các chủ
  sở hữu chung khác có quyền ưu tiên mua trong 3 tháng (bất động sản). Đây là lý do Vĩnh phải mua
  phần cô Hạnh **trước** rồi mới ép phần cụ Thọ và phần nhà Khải, và là lý do Lan còn cửa mua lại
  phần của cô (chương 3).
- Nghị định 168/2024/NĐ-CP (mức phạt giao thông từ 1/1/2025): xem `traffic_rules.json`, mục
  "Việc kiểm chứng còn treo" trong `04-danh-sach-noi-dung.md`.
