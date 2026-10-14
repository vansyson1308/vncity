# 10. Bản sửa chương 0-1: bảy chỗ gãy và nối hệ quả, từng dòng

Đây là **đặc tả để áp vào dữ liệu**, không phải bàn luận. Mỗi mục ghi file, id, dòng, nội dung
mới. Luồng "Dựng đủ các quận Hà Nội" đang giữ quyền sửa `game/content` chương 0-1 (mở màn + nối cờ),
nên bản này được chuyển qua đó để áp; luồng chơi thử không sửa trực tiếp để tránh xung đột file.
Mọi cú pháp `condition` theo `02-he-thong.md` §9 (PR #7). Đồng hồ game 30x (1 phút game = 2 giây
thật) áp cho mọi giờ giấc dưới đây.

Mã chỗ gãy theo `docs/11-tham-dinh-choi-thu.md` §3.

## M1. Giờ giấc 1.4 "Chợ lúc sáu giờ": gia vị mua lúc 6:00 là cho mẻ **hôm sau**

`game/content/missions/story_chapter1.json`, `c1_04_cho_dong_xuan_luc_6_gio`:

1. Bước `ve_quan` và `ve_quan_re`: bỏ `time_limit_s: 600` (600 giây thật = 5 giờ game, vô nghĩa);
   thay bằng `"deadline_hour": 7.0` và `objective.vi`: "Chở hàng về quán trước giờ cao điểm 7 giờ".
2. Chèn **hai** bước `wait_until` (một cho mỗi nhánh) ngay sau `ve_quan` / `ve_quan_re`:
   ```json
   {"id": "sang_hom_sau", "kind": "wait_until",
    "objective": {"vi": "Ninh mẻ xương mới lúc 3:30 sáng hôm sau với gia vị vừa mua"},
    "target": {"lat": 21.03745, "lon": 105.8512},
    "params": {"until_hour": 3.5, "hour": 3.5, "skip_allowed": true}, "next": "nem"}
   ```
   và `sang_hom_sau_re` giống hệt, `next: "nem_re"`. `ve_quan.next = "sang_hom_sau"`,
   `ve_quan_re.next = "sang_hom_sau_re"`.
3. Bước `nem` / `nem_re`: `objective.vi` → "6 giờ sáng hôm sau, ông nếm thìa đầu tiên của mẻ mới".

`game/content/dialogues/chapter1.json`, `dlg_c1_04_ba_lua`:

4. `l09` (Lan): "Cháu cảm ơn bà. Cháu phải về kịp giờ ninh." → **"Cháu cảm ơn bà. Cháu về trước
   giờ tắc, mai ninh mẻ mới, ông nếm là biết ngay."**
5. `dlg_c1_04_cu_tho_khen` dòng đầu và `dlg_c1_04_cu_tho_che` dòng đầu: thêm mốc thời gian vào
   `context`: "6 giờ sáng hôm sau, thìa đầu tiên của mẻ mới."

## M2. Chú ý 2 sao ở 1.5 chỉ khi Minh **thật sự** nghe điện thoại lúc đang chạy

`story_chapter1.json`, `c1_05_mua_ngap_pho`:

1. Bước `hai_cuoc_goi` (cutscene): gameplay đã có `auto_violation_if_answered_moving`. Quy ước
   mới cho gameplay: khi vi phạm đó kích hoạt, gọi `SetFlag("minh_nghe_dien_thoai_khi_lai", true)`.
   Ghi vào mô tả khóa `auto_violation_if_answered_moving` trong `missions.schema.json`:
   "...và đặt cờ `minh_nghe_dien_thoai_khi_lai`".
2. `giao_kim_ma.next` → `"co_bi_chu_y"`. Chèn bước:
   ```json
   {"id": "co_bi_chu_y", "kind": "choice",
    "objective": {"vi": "Tổ tuần tra có nhìn thấy bạn nghe điện thoại không?"},
    "target": {"lat": 21.0315, "lon": 105.8215},
    "params": {"branch_source": "flag"},
    "next": {"minh_nghe_dien_thoai_khi_lai": "chu_y_csgt", "default": "cuu_tuan"}}
   ```
3. `dlg_c1_05_mua` thêm dòng cuối có điều kiện, **trước** `l06` hiện tại đổi thành dòng mặc định:
   - `l06` mới (Minh, `condition: {"flags": ["minh_nghe_dien_thoai_khi_lai"]}`): "Em đang dừng... à
     không. Em tấp vào lề... (tiếng còi) Thôi chết, chốt Kim Mã."
   - `l07` (Minh, không điều kiện): "Em tấp vào lề rồi ạ. Chị đóng bình đi, mười phút nữa em
     tới."
   Cờ `minh_nghe_dien_thoai_khi_lai` được đọc lại ở chương 2 (`c2_03`: Thượng úy Hải nhắc).

## M4 + §5.1. 1.9 phải nhớ 1.6 và 1.3 (nối hệ quả chương 1)

`dlg_c1_09_vinh`:

1. Mở đầu có điều kiện, chèn trước `l01`:
   - `l00a` (Vĩnh, `condition: {"flags": ["lan_lo_thong_tin_mat"]}`): "Cô Lan làm tôi mất một
     khoản vay ở ngân hàng cũ của cô. Tôi vẫn mời cô trà. Người làm ăn không giận người giỏi."
   - `l00b` (Vĩnh, `condition: {"flags": ["lan_de_xuat_tu_quan"]}`): "Tôi đã đọc biên bản họp tổ
     dân phố. 'Tự quản'. Hai chữ đắt đấy, cô Lan."
   Cả hai `goto: "l01"`.
2. `l05` (Vĩnh): tách phần nói với Khôi thành dòng riêng `l05b` có
   `condition: {"not_flags": ["khoi_giu_phan"]}`: "Anh Khôi có một phòng trưng bày ảnh của bố ở
   sảnh."; và `l05c` (`condition: {"flags": ["khoi_giu_phan"]}`, Vĩnh quay sang Lan và Minh, không
   nhìn Khôi): "Anh Khôi đã nói rõ ở tổ dân phố, tôi không mời anh ấy thêm lần nữa." Cả hai
   `goto: "l06"`. `l05` giữ phần còn lại.
3. `l11` (Vĩnh): tách thành `l11a` (`condition: {"flags": ["khoi_xin_thoi_gian"]}`): "Anh Khôi xin
   thời gian ở tổ dân phố rồi. Cô Lan trả lời thay cả nhà được không?" và `l11` mặc định giữ nguyên.
4. `l12` lựa chọn "Không. Câu trả lời của nhà tôi là không." thêm
   `condition: {"not_flags": ["khoi_xin_thoi_gian"]}` (Lan không thể nói "nhà tôi" khi Khôi vừa
   xin hoãn). Lựa chọn "Chúng tôi sẽ trả lời trước Tết." giữ không điều kiện. Thêm lựa chọn thứ tư
   (`condition: {"flags": ["lan_biet_danh_sach"]}`): **"Mười bốn số nhà trong danh sách của chị
   Thảo, tôi đã đọc hết trước tổ dân phố. Anh còn gì để mời?"** → `goto: "l13d"`,
   `effect: {"reputation": {"to_dan_pho_hang_chieu": 15, "kim_long_land": -25}, "set_flags":
   ["lan_cong_khai_danh_sach"]}`. `l13d` (Vĩnh): "Thì ra anh Minh. (rót trà cho Minh) Danh sách
   là của chị Thảo, anh Minh ạ. Chị ấy sẽ hỏi anh." → `goto: "l16"`.
5. `l16` (Thảo) tách ba biến thể, đặt trước dòng mặc định:
   - `l16a` (`condition: {"flags": ["linh_dang_anh_thao"]}`): "Anh Khôi. Tôi đã xem bài đăng của
     cô Linh. Bà tôi ở trên mạng với tám mươi nghìn người lạ. Tôi không tiễn anh được."
   - `l16b` (`condition: {"flags": ["lan_lo_thong_tin_mat"]}`): "(không tiễn ra thang máy; nói
     với Lan) Chị không nên nói chuyện hồ sơ vay ở chỗ đông người. Tôi nói với tư cách người
     cũng có sếp."
   - `l16` mặc định giữ nguyên.

`dlg_c1_05_tuan`:

6. `l03` tách: `l03a` (`condition: {"flags": ["minh_nhan_viec_kim_long"]}`): "...Thằng Hùng Hàng
   Đậu nhận rồi đấy. Mà mày cũng nhận rồi còn gì, chị Thảo khoe trong nhóm." `goto: "l05"`;
   `l03` mặc định giữ nguyên.
7. `l06` lựa chọn "Tao không làm cái đấy." thêm `condition: {"not_flags":
   ["minh_nhan_viec_kim_long"]}`; "Để tao tính." giữ không điều kiện.
8. Thêm `l02b` (Lan gọi, `condition: {"flags": ["minh_giu_kin_danh_sach"]}`), chèn sau `l02`:
   "[Tin nhắn Lan] Phở giao xong chưa? Tiền chị chuyển rồi." (lạnh, không cảm ơn); và `l02c`
   (`condition: {"flags": ["lan_biet_danh_sach"]}`): "[Tin nhắn Lan] Về cẩn thận. Chị cảm ơn
   chuyện hôm nọ." Cả hai `goto: "l03"`.

`dlg_c1_06_hop`, `l07` (Lan chọn): thêm lựa chọn thứ tư `condition: {"flags": ["lan_biet_danh_sach"]}`:
**"Đọc mười bốn số nhà trong danh sách của Kim Long trước cả tổ."** → `effect: {"reputation":
{"to_dan_pho_hang_chieu": 15, "kim_long_land": -25}, "set_flags": ["lan_cong_khai_danh_sach"]}`,
`goto` tới dòng ông Khang: "Bà con trật tự. Số nhà 49 cũng trong danh sách. Ghi biên bản."

## M5. Khôi được **thấy** là người của năm 1998, không chỉ được kể

`dlg_p1_don_khoi`:

1. `l03` (xe ôm): "...Việt kiều à? Nói tiếng Việt sõi thế." → **"Việt kiều à? Giọng thì ngõ Hàng
   Chiếu mà từ thì như ông tớ."**
2. Thêm `l06b` (Khôi) sau `l06`: "Bốn trăm nghìn... (tính) hồi tôi đi, bốn trăm là một chỉ vàng."
   `l06c` (Minh): "Giờ là hai bát phở với một cốc trà sữa anh ạ." `goto: "l07"`.

`dlg_c1_01_bai_hoc`:

3. `l07` (Minh) giữ; thêm `l07b` (Khôi): "Sát hạch là thi? Và A1 là... hạng bét?" `l07c` (Minh):
   "Là hạng xe máy anh ạ. Bét thì bét, không có là mất xe." `goto: "l08"`.

`dlg_c1_08_mo_dau` (Linh phân việc):

4. Chèn sau dòng Linh dùng từ lóng đầu tiên: `lx1` (Khôi): "Keo... lỳ?" `lx2` (Minh): "Là bám
   chắc, anh. Cô ấy khen đấy." `lx3` (Linh): "Ra đường em nể mỗi anh." `lx4` (Khôi, chêm Đức):
   "Na gut." Đặt `effect.set_flags: ["khoi_hoc_tu_keo_ly"]` lên một lựa chọn không có hoặc đặt
   qua `steps[].set_flags` của bước `phan_viec`; chương 2 Khôi được phép dùng "keo lỳ" đúng một
   lần nếu cờ bật (`09-giong-thoai.md` §1).

`dlg_c1_09_vinh`, `l02` (Minh thì thầm "Ông ấy biết cả chuyện nồng độ cồn."): thêm `l02b` (Khôi
thì thầm lại): "Nồng độ... cồn? Hồi tôi đi uống bia xong vẫn đạp xe về." `l02c` (Minh): "Giờ là
mất bằng, anh. Im."

## M6. Bố mẹ Lan: một gia đình đủ nhân quả

Đề xuất (chủ dự án duyệt một trong hai hướng; dòng thoại viết theo hướng A):

- **A (đề xuất):** Mẹ Lan mất năm 2009 (Lan 12 tuổi). Bố Lan, con trai duy nhất của cụ Thọ, đi
  xuất khẩu lao động Hàn Quốc năm 2010, lập gia đình mới ở Busan, gửi tiền về đều đến 2019 rồi
  thưa dần. Phần nhà của bố Lan đã sang tên cho cô Hạnh năm 2010 "để em ở nhà chăm bố". Nhân quả:
  Lan lớn lên bằng tiền gửi từ xa đúng ngày mỗi tháng → tin con số là thứ tình cảm đếm được
  (`drive.tap`); cô Hạnh ôm phần nhà của anh kèm nghĩa vụ chăm bố → bán nhà là phản bội cả hai, vì
  thế cô khóc nhanh (`drive.tell`); cụ Thọ mất con trai theo cách không ai chết → giữ căn nhà
  như giữ đứa con.
- **B:** Bố mẹ Lan ly hôn, cả hai ở Sài Gòn; Lan về ở với ông từ 2015. Ít nhân quả hơn, không dùng.

Áp theo A, `dlg_p2_co_hanh`:

1. `l04` (Lan): "...Nhà này ba người đứng tên. Ông, cô, và bác Khải." → **"Nhà này ba người
   đứng tên. Ông, cô, và bác Khải. Phần của cô là phần của bố cháu, cô nhớ chứ. Bác Khải mới mất
   được ba tuần."**
2. `l05` (cô Hạnh) thêm đầu câu: "Bố cháu ở Busan mười lăm năm có về nhìn ông lần nào không mà
   cháu nhắc? ..." (giữ phần sau).
3. Thêm `l11b` (Lan, một mình, sau `l11`): "(nhìn điện thoại, mục 'Bố') Hai câu một năm. Mùng
   một và sinh nhật ông."

`dlg_c1_04_ba_lua`, `l05` (bà Lụa): thêm cuối câu: "...Mẹ cháu ngày xưa cũng đứng đây mặc cả với
bà, giỏi hơn cháu."

## M7. "Cuối tuần" ở P2

`dlg_p2_co_hanh`, `l10`: "...Cuối tuần họ giới thiệu dự án với tổ dân phố đấy, cả nhà nên đến
nghe." → **"...Sắp tới họ giới thiệu dự án với tổ dân phố đấy, ông Khang sẽ báo, cả nhà nên đến
nghe."** (1.6 mở sau 1.2 và 1.4, không có ngày cố định.)

## M8. Rút ngắn mở đầu cho người chơi quen GTA

`story_prologue.json`, `p2_noi_nuoc_dung_4_gio`: gộp `nuong_gung_hanh` + `rang_gia_vi` thành một
bước `cook` `so_che` ("Nướng gừng, hành; rang quế, hồi, thảo quả" với `params.stage:
"so_che"`), `next: "vot_bot"`; giữ `vot_bot` → `nem_thu`. Tổng bước nấu trước lựa chọn: 2 thay vì
4. `p3_tu_sat_tren_gac`: giữ `cho_sang` (đã `skip_allowed`), HUD phải hiện nút "Ngủ đến 5:30"
ngay khi vào bước (đồng hồ 30x: không skip là 28 phút thật). Luồng cold open quyết định P1.

## S4 (một phần). Nhánh thua cho ba minigame chương 1

- `c1_01.thi_sat_hach`: `next: {"dat": "ra_pho", "chua_dat": "thi_lai", "default": "thi_lai"}`;
  bước `thi_lai` (`wait_until` hôm sau 8:00, `params.cost_vnd: 100000`, objective "Trượt vòng số
  tám. Mai thi lại, lệ phí 100 nghìn"), `next: "thi_sat_hach"`.
- `s02.van_1..3`: thua → `talk` `mat_tra` (cụ Bảo mời trà, `dlg_s02_thua`: "Nước này cậu ăn hay
  nhịn? Cậu nhịn, nên cậu đói."), `next: "end"`; nhiệm vụ không `fail`, chơi lại hôm sau.
- `s10.dua`: ngoài top 3 → `talk` `ve_bet` (Tuấn vẫn có content, không thưởng), `next: "end"`.

## Cờ chương 1 mà chương 2 đọc (không đổi tên)

`lan_doi_dau_co_hanh`, `lan_tinh_no_cho_co`, `lan_mua_gia_vi_chuan`, `lan_mua_gia_vi_re`,
`minh_lai_xe_khong_do_la`, `minh_nhan_viec_kim_long`, `minh_suy_nghi`, `lan_biet_danh_sach`,
`minh_giu_kin_danh_sach`, `lan_lo_thong_tin_mat`, `lan_de_xuat_tu_quan`, `lan_cong_khai_danh_sach`
(mới), `khoi_xin_thoi_gian`, `khoi_giu_phan`, `lan_pho_co_dien`, `lan_pho_chieu_tro`,
`video_mark_viral`, `khoi_tang_anh_thao`, `khoi_giu_ban_goc`, `linh_dang_anh_thao`,
`lan_tu_choi_vinh`, `lan_xin_thoi_gian`, `lan_moi_vinh_dau_tu_tu_quan`, `khoi_nghieng_o_lai`,
`khoi_nghieng_ban`, `khoi_chua_quyet`, `duoc_do_o_quan_chuong`, `quen_ong_thang`,
`tang_tem_phieu_bao_tang`, `minh_nghe_dien_thoai_khi_lai` (mới), `khoi_hoc_tu_keo_ly` (mới),
`ket_thuc_chuong_1`, `biet_giay_1957`.
