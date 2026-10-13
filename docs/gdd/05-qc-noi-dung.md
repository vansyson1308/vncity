# 05. Nhật ký QC nội dung (vòng cuối trước khi nạp vào UE5)

*Ngày 13/10/2026, nhánh `feat/final-qc`. Phạm vi: `game/content/**` và `docs/gdd/*.md`. Không sửa
`game/schemas/`.*

## Kết quả

- `./venv/bin/python tools/validate.py`: **0 lỗi**, 363 mục (activities 24, businesses 11,
  characters 47, dialogues 57, events 20, factions 10, items 52, missions 24, radio 7,
  traffic_rules 15, vehicles 26, building_archetypes 13, districts 13, landmarks 44).
- Kiểm tra sâu (script riêng, đối chiếu với `UHanoiMissionSubsystem`): 0 lỗi.
- `tests/test_codegen_ue.py` phần chuyển nội dung (`convert_*`): đạt.

## Đã kiểm tra

1. **Đồ thị nhiệm vụ**: mọi `next`/nhánh trỏ tới bước có thật; không bước nào không tới được; mọi
   đường đi đều kết thúc; kiểm theo đúng ngữ nghĩa runtime (bước không có `next` chạy sang bước kế
   tiếp trong mảng). Khóa nhánh khớp nguồn (cờ thoại, đầu vào người chơi, điểm minigame). Dòng
   `switch_protagonist_on_line` tồn tại và đổi sang nhân vật chính của nhiệm vụ.
2. **Thoại**: `goto`/lựa chọn trỏ tới dòng có thật; mọi dòng tới được; không vòng lặp không lối ra;
   57/57 đoạn thoại được nhiệm vụ dùng; người nói tồn tại.
3. **Tiến trình**: `requires.missions_completed` không có chu trình; từ ván mới đi được hết 24 nhiệm vụ
   theo thứ tự P1 → P2 → P3 → 1.1 ... 1.9 và các nhiệm vụ phụ. Cờ bắt buộc duy nhất không do dữ liệu
   đặt là `ho_so_sach_90_ngay` (runtime đặt, đã ghi trong `02-he-thong.md`).
4. **Tham chiếu**: phần thưởng (vật phẩm, mở khóa), hoạt động, cơ sở kinh doanh, địa danh, nhân vật
   chính đều tồn tại; khóa uy tín là id phe; `era_mix` dùng id kiểu kiến trúc và tổng bằng 1; khoảng
   giờ hợp lệ; `weekday` dùng 0 = thứ Hai ở cả dữ liệu và tài liệu.
5. **Toạ độ**: tất cả nằm trong khung Hà Nội; 24 địa danh `coords_verified_overture` không bị đổi toạ độ.
6. **Nhất quán**: tên, tuổi, quan hệ giữa `characters`, thoại, nhiệm vụ và `03-cot-truyen-ban-nhap-v0.md`;
   tiền VND 2026; mức phạt so với Nghị định 168/2024/NĐ-CP.
7. **Ngôn ngữ**: quét 1.119 chuỗi `vi` (thiếu dấu, lặp từ, khoảng trắng, chuỗi tiếng Anh lọt vào `vi`),
   đọc lại toàn bộ thoại; mọi mục đều có `en`; quét tên thương hiệu thật trong chữ hiện cho người chơi.
8. **Địa điểm trang nghiêm**: Lăng, Quảng trường Ba Đình, Phủ Chủ tịch không có nhiệm vụ hay hoạt
   động; sự kiện Quốc khánh chỉ cho xem lễ từ khu vực công cộng.

## Lỗi đã sửa

### Logic nhiệm vụ (khớp runtime)

| # | Chỗ | Lỗi | Sửa |
| --- | --- | --- | --- |
| 1 | `c1_03` bước `gap_lan` | Không có `next` nên runtime chạy tiếp sang `ve_tro` (kể cho Lan rồi vẫn "về trọ im lặng") | `"next": "end"` |
| 2 | `c1_04` bước `nem` | Chạy tiếp sang `nem_re`: cụ Thọ khen rồi lại chê | `"next": "end"` |
| 3 | 14 bước `fail_if` | Token trần (`nga_xe_3_lan`...) bị runtime bỏ qua | Đổi thành `event:<tên>` |
| 4 | `p3` bước `cho_sang` | `wait_until` dùng `until_hour`, runtime đọc `hour`/`hours` | Thêm `hour: 5.5` |
| 5 | `c1_05` bước `chu_y_csgt` | `heat_start` không được đọc | Đổi thành `heat` |
| 6 | `c1_04` bước `chon_gia_vi` | Khóa `que_yen_bai`/`que_re` không khớp cờ của thoại | Đổi thành `lan_mua_gia_vi_chuan`/`lan_mua_gia_vi_re`, ghi `branch_source` |
| 7 | `c1_03` hai bước `choice` | Không ghi nguồn khóa nhánh | Thêm `params.player_input` |
| 8 | `c1_08` | Bắt đầu 18:00 nhưng sự kiện phố đi bộ tối chỉ chạy từ 19:00 | Bắt đầu 19:00, gian triển lãm 20-23 giờ |
| 9 | `c1_08` | Gửi xe "ngoài Đinh Tiên Hoàng", nhưng phố này nằm trong phố đi bộ | Gửi ngoài rào chắn, dời điểm đích |
| 10 | `c1_05` | Từ Thái Hà về tiệm Đức Còi khoảng 2,5 km nhưng minigame dắt xe 900 m | Tuấn kẹt ở Nguyễn Trãi đoạn Khương Trung (cách tiệm khoảng 900 m) |
| 11 | `s01` | Cho cả Lan chơi nhưng thoại cứng là Minh | Chỉ Minh |
| 12 | `s01`, `s06` | `params.item` là id trần của vật phẩm không tồn tại | Tạo `items:la_dong`, `items:dieu_cua_be` và tham chiếu đúng |
| 13 | `s10` | Thoại cứng "về thứ hai", minigame cho phép về nhất | `scripted_winner_npc`, `max_player_rank: 2` |
| 14 | `s12` | Ghi "xe tay ga" dù Minh đi xe số; thoại mặc định Minh đã bị phạt | Bỏ "xe tay ga", câu thoại trung tính |
| 15 | `c1_09` | `no_minimap` lệch với `minimap` ở `s04` | Thống nhất `minimap: false` |
| 16 | `act_nau_pho` | Địa điểm là chợ Đồng Xuân | `businesses:pho_tho_hang_chieu` |

### Nhất quán truyện và số liệu

| # | Chỗ | Lỗi | Sửa |
| --- | --- | --- | --- |
| 17 | P1, thoại và thưởng | Cuốc ga Hà Nội → Hàng Chiếu 52.000 đ, lệch công thức Vồ (13.500 + 4.300 đ/km, khoảng 4 km) | 32.000 đ |
| 18 | `dlg_p1_den_hang_chieu`, quan hệ Lan–Khôi | Lan 29 tuổi (sinh 1997) "khóc đòi kem" khi Khôi đi năm 1998 | Khôi mười tuổi hay bế Lan còn bé tí |
| 19 | Tiểu sử cụ Thọ | "Thuê nửa gian nhà", trái với việc hai nhà góp tiền mua chung năm 1957 | Sửa vi/en |
| 20 | `dlg_s08_xong` | Cô Hạnh "lên ba" năm 1984, nhưng cô 55 tuổi (sinh 1971) | Mười ba tuổi |
| 21 | Chị Mai | 40 tuổi nhưng là bạn cấp ba của Lan (29), xưng mày/tao | 29 tuổi |
| 22 | Quan hệ của Minh | "Gặp Lan khi giao nhầm phở", "bị Hải phạt hai lần" trái phần mở đầu | Sửa ghi chú |
| 23 | `dlg_c1_09_bi_mat` | Minh nhắc chuyện đèn ông sao mà anh không có mặt khi Khôi kể | Câu thoại mới |
| 24 | `dlg_c1_09_vinh` | Vĩnh nói Lan là "một trong ba chữ ký"; người đứng tên là Thọ, Hạnh, Khải | "Tên cô không có trong sổ đỏ. Tên cô Hạnh thì có." |
| 25 | `dlg_c1_07_mark_nem` | Lan (dân ngân hàng) hỏi ông nội dịch tiếng Anh | Câu hỏi chuyển cho cụ Thọ |
| 26 | Tiểu sử Khôi | "Chợ Đồng Xuân Leipzig" (Đồng Xuân Center ở Berlin) | "Khu chợ đầu mối của người Việt ở Leipzig" |
| 27 | Sự kiện Vu Lan | "Cúng giỗ" sai nghĩa | "Làm lễ Vu Lan" |
| 28 | GPLX A1 | Lệ phí 235.000 đ | 265.000 đ (60.000 + 70.000 + 135.000), vẫn ghi cần kiểm tra |

### Ngôn ngữ và thương hiệu

| # | Chỗ | Lỗi | Sửa |
| --- | --- | --- | --- |
| 29 | Thoại P2, tiểu sử Lan, Tuấn | Excel, TikToker | "bảng tính", "nhà sáng tạo nội dung trên Tóp Tóp" |
| 30 | `dlg_s03_duong_tau`, kiểu dân cư | Instagram, Instagrammers, xe đạp Phượng Hoàng, tên bài hát có bản quyền | Tóp Tóp, mô tả chung |
| 31 | `landmarks` | Tên hiện "Landmark 72", "Lotte Center" | "Tòa tháp 72 tầng Phạm Hùng", "Tòa tháp Liễu Giai" (id giữ nguyên) |
| 32 | `districts` | Aeon Mall, Royal City, Times City, Vinhomes, Ecopark (cả tên quận Gia Lâm) | Mô tả chung |
| 33 | Phe, vật phẩm, nhân vật | "(hư cấu)/(fictional)" và chữ "parody" trong tên hiện cho người chơi | Bỏ khỏi tên, giữ ở mô tả |
| 34 | `radio` | "Kênh Đường Thông 91.0" trùng tần số thật của kênh giao thông Hà Nội | 91.5 |
| 35 | Lời Mark (11 dòng) | `vi` là tiếng Anh nguyên văn | Thêm phụ đề tiếng Việt trong ngoặc vuông |
| 36 | `dlg_c1_06_hop` l05 | Bản `en` sai ngữ pháp | Sửa |
| 37 | `districts.hoan_kiem` | Trùng "Tràng Tiền" trong `overture_division_names` | Bỏ bản trùng |

### Nội dung còn thiếu so với GDD

| # | Chỗ | Sửa |
| --- | --- | --- |
| 38 | `02-he-thong.md` hứa 12 app; `items.json` có 10 | Thêm `app_may_anh` (Máy ảnh / Kho phim), `app_bang_cat_set` (Băng cát-sét) |

### Tài liệu

| # | Chỗ | Sửa |
| --- | --- | --- |
| 39 | `02` mục 8 | Ghi "bước không có `next` là kết thúc", trái runtime | Viết lại quy ước theo runtime (`end`, `fail_if`, `hour`, `heat`, nguồn khóa nhánh) |
| 40 | `00`, `04` | "Mọi toạ độ gắn `coords_unverified`" | 24 đã khớp Overture, 20 còn ước lượng |
| 41 | `04` | Số vật phẩm 48 | 52; thêm đề xuất schema 11-12 |
| 42 | `02`, `03` | Danh sách sự kiện thiếu mục ban ngày; dòng 1.4 lệch giờ | Cập nhật |

`03-cot-truyen-ban-nhap-v0.md` vẫn ghi rõ **bản nháp v0**. Các tài liệu GDD không dùng liên kết
markdown; mọi đường dẫn file nhắc tới đều tồn tại.

## Cần người kiểm tra

1. **Người Hà Nội đọc lại toàn bộ thoại**: xưng hô, từ lóng Gen Z của Linh, giọng Thái Bình (Minh,
   mẹ Minh), Nam Định (cụ Thọ), Phú Thọ (Tuấn), Hưng Yên (Đức); phụ đề tiếng Việt cho lời Mark.
2. **11 mức phạt `fine_unverified`**: đã đối chiếu theo hiểu biết những mục chắc chắn (vượt đèn đỏ,
   mũ bảo hiểm, nồng độ cồn mức 1 và 3, không có tag). 11 mục còn lại có vẻ hợp lý nhưng phải đối
   chiếu đúng điều, khoản, điểm của Nghị định 168/2024/NĐ-CP; riêng số điểm trừ của lỗi dùng điện
   thoại và chạy quá tốc độ với xe máy cần kiểm tra.
3. **Địa giới sau 1/7/2025**: Hà Nội không còn cấp quận; mô tả `districts` còn chữ "Quận..." và tên
   phường gắn `division_names_need_check`.
4. **Giá lịch sử**: 12.000 đ công chở cây quất năm 1989, ấm trà 600 đ năm 1996, tem dầu hỏa 1984.
5. **20 địa danh `coords_unverified`** và tâm 13 quận: chạy `pipeline/verify_landmarks.py`.
6. **Bản quyền âm nhạc**: đài "Sân Đình" vẫn `licensed_tbd`.
7. **Gió trong thoại `dlg_s06_xong`** ghi cứng "cấp ba, đông nam" trong khi minigame lấy gió thật:
   cần điều kiện cho dòng thoại (đề xuất schema 3) hoặc câu chung chung hơn.
8. **Runtime chưa đọc** nhiều khóa `params` mà dữ liệu đã dùng: `requires_event`, `apply_fine`,
   `switch_protagonist_on_line`, `set_flags` theo bước, `business_effect`, `force_weather`,
   `force_event`, `time_of_day`, `player_input`, `branch_source`. UI/gameplay phải truyền đúng
   `Outcome` cho `CompleteCurrentStep` và gọi `ReportEvent` cho các `fail_if` dạng `event:`.
9. **Chi tiết nén cho gameplay**: ở `c1_01` Khôi lái ra phố ngay sau khi thi đỗ A1 (ngoài đời phải
   chờ cấp bằng).
