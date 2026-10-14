# 13. Chương 3-5: "Nước lên", "10/10", "Bát phở cuối cùng"

Chủ dự án duyệt chương 1-2 lúc 14:47 ngày 14/10/2026 và giao làm tiếp chương 3-5 "chỉn chu theo triết lý
Tứ diệu đế". Tài liệu này ghi lại ba chương đó đã thành dữ liệu chơi được như thế nào: chuỗi nhân quả, sổ
cờ, nhân vật mới, độ khó, ma trận kết cục và nguồn tư liệu. Sáu nguyên tắc của chủ dự án (`08-nhan-qua.md`)
áp dụng nguyên vẹn: ai cũng hành động từ một động cơ, lựa chọn nào cũng có hệ quả, chương nào cũng có điểm
nhấn, vòng sau khó hơn vòng trước nhưng vẫn qua được.

Dữ liệu: `game/content/missions/story_chapter3.json`, `story_chapter4.json`, `story_chapter5.json` (19 nhiệm
vụ) và `game/content/dialogues/chapter3.json`, `chapter4.json`, `chapter5.json` (88 đoạn thoại, 623 dòng).
Chỉ có tiếng Việt; bản tiếng Anh chưa làm theo lời chủ dự án.

Hai quyết định lớn đang chờ chủ dự án trả lời trên thẻ trong luồng; nội dung đã viết theo phương án đề xuất
của cả hai thẻ và sẽ sửa nếu chủ dự án chọn khác:

1. **Bí mật băng 24: "Bé Hạnh".** Dòng chữ cháy trên tờ giấy 1957 là đoạn ông Khiêm viết thêm năm 1972
   trước khi đi B: "Ông Thọ không nhận thì để cho cháu Hạnh, con gái ông, sinh năm bảy mốt dưới mái nhà này.
   Nhà này của hai nhà; đừng nhà nào bán phần mình khi nhà kia còn người ở." Giấy cháy đúng chỗ "cháu
   Hạnh". Năm 1985 cụ Thọ cấm ông Khải sang tên cho cô bé 14 tuổi ("nó lớn lên nợ cả đời"), ông Khải giữ hộ,
   và đó là lý do năm 1998 ông không theo vợ con sang Đức. Theo luật, phần ấy là của Khôi.
2. **Kết cục: ba kết ngang hàng** (Tự quản, Thỏa hiệp, Bán). Không kết nào là "kết thật"; mỗi kết giữ
   được một thứ và mất một thứ.

## 1. Lịch thời gian

| Thời điểm (game) | Chương | Sự việc |
| --- | --- | --- |
| Sáng 20/2/2027, rằm tháng Giêng Đinh Mùi | 3 | Phủ Tây Hồ, gặp anh Tùng, người giữ giấy nợ của cô Hạnh |
| Đêm sau rằm | 3 | Lan dựng lại sáu năm chuyển khoản: gốc thật 600 triệu, không phải 1 tỷ 8 |
| Đầu tháng Ba | 3 | Mẹ Minh "ra Giêng lên" (nếu Minh đã nói thật) hoặc bố Minh ngã lần hai |
| Tháng Tư, sau mưa xuân | 3 | Vết thấm trên tường chung với số 51; bà Liên ở khu giãn dân Việt Hưng |
| Tháng Năm-Sáu | 3 | Hồ sơ vay tự quản hai mươi hộ |
| Cuối tháng Tám (hết tháng cô hồn) | 3 | Bão số 3, đêm nước lên, sáng nước rút, hạn của anh Tùng |
| Giữa tháng Chín | 4 | Giỗ đầu ông Khải; lời mời triển lãm |
| Cuối tháng Chín | 4 | Tuấn ngã xe ở Giải Phóng, cấp cứu Bạch Mai |
| Đầu tháng Mười | 4 | Thảo đi Sở Xây dựng (hoặc quay về) |
| 15 giờ thứ Bảy 9/10 | 4 | Khung ảnh 30 ở sân Cột cờ; băng 24 hoặc lời ông Thắng |
| Chủ nhật 10/10/2027 | 4 | Triển lãm ở Đoan Môn 15 giờ, bỏ phiếu tổ dân phố 19 giờ 30 |
| Đầu tháng Mười Một (gió mùa đầu tiên) | 5 | Khôi quyết phần của ông Khiêm; Minh sửa xe ở tiệm anh Đức |
| Giữa tháng Mười Một | 5 | Ngày ký; sáng hôm sau là bát phở cuối cùng |

## 2. Năm chuỗi nhân quả (Khổ, Tập, Diệt, Đạo)

**Nợ của cô Hạnh.** Khổ: sáu năm trả lãi, mỗi Tết một tờ giấy mới. Tập: tin "chỗ anh em" và tin bán nhà
là lối thoát duy nhất. Diệt: biết con số thật. Đạo: Lan đọc giấy (c3_01), dựng dòng tiền (c3_02), rồi
cả chương 3 mở hoặc đóng từng cửa cho câu trả lời cuối với anh Tùng (c3_08):

- tố cáo cần *cả* ảnh giấy vay (`lan_xin_giay_no`) *và* việc đã khuyên cô trình báo (`lan_khuyen_bao_cong_an`);
- thương lượng đúng luật cần biết gốc thật (`lan_biet_goc_that`);
- để Vĩnh mua nợ bị khóa nếu Lan từng nói "không phần nào bán" với Vĩnh (`lan_chot_khong_ban`, `lan_ram_khong_ban`);
- xin thêm ba tháng luôn mở, nhưng hạn mới rơi đúng ngày 10/10.

Số liệu: vay 600 triệu năm 2021, tờ đầu ghi "ba nghìn một triệu một ngày" (hơn 100%/năm); trả 12 triệu
mỗi tháng trong 68 tháng, tổng khoảng 820 triệu tiền lãi; lãi đúng luật 20%/năm khoảng 684 triệu; phần
trả thừa trừ vào gốc nên còn nợ khoảng 460 triệu. Anh Tùng bán tờ giấy 1 tỷ 8 cho Vĩnh với giá 900 triệu
vì biết ra tòa nó chỉ đáng 460 (c3_02, c3_08). Chương 4 (c4_06) cho tờ giấy về một trong bốn trạng thái:
đóng băng vì đã chuyển cơ quan điều tra, trả xong 460 (bằng gói vay hoặc tiền cả phố góp), về tay Vĩnh,
hoặc treo đến hạn 10/10.

**Bức tường chung số 51.** Khổ: bà Liên mất gánh nước chè vì giãn dân, nhà cũ thành "nhà mẫu Hàng Chiếu
Boutique". Tập: nhà thầu phụ cắt rãnh tường chung để đi ống mái cho nhanh. Hệ quả: đêm bão nước mái số 51
chảy thẳng vào bếp và gác số 49. Đạo: ảnh Khôi gửi cho ai (c3_04) quyết định ai biết trước mùa mưa: báo
(không đăng vì Kim Long là đối tác quảng cáo), tổ dân phố (biên bản tháng Tư, bao cát được đắp, bằng
chứng ai cũng đọc được) hay Thảo (chỉ khi cô đã từng "thấy bà ngoại"). Sau bão, Vĩnh lần đầu đi bộ vào ngõ
và nhận lỗi (c3_08); câu chuyện quay lại ở tòa soạn (c4_03), ở Sở Xây dựng (c4_04) và ở triển lãm (c4_07).

**"Con ổn".** Khổ của Minh từ chương 1: nói dối mẹ để mẹ yên tâm. Chương 3 trả lời đêm mùng Một: nếu nói
thật, mẹ lên Hà Nội và đưa sổ đỏ ba sào ruộng; nếu không, Minh biết bố ngã lần hai qua tin nhắn của hàng
xóm. Chương 4 lật gương: Tuấn ngã xe khi chạy đơn mưa (vì học Minh chạy đơn bão, hoặc vì chạy những đơn
Minh bỏ), giấu mẹ món nợ app vay, và xin Minh đừng nói. Minh phải chọn giữ lời bạn hay nói thật với mẹ
bạn, đúng điều anh từng không làm với mẹ mình. Chương 5 trả hậu quả: Tuấn về Phú Thọ hái chè với mẹ, hoặc
vẫn nằm giường trên nghe app đòi nợ gọi.

**Phần của ông Khiêm.** Khổ của Khôi: về chịu tang hai tuần, mắc lại một năm. Đêm nước lên chỉ cứu được
một thứ, như cụ Thọ năm 1972: cứu băng thì phim ngấm nước, cứu phim thì băng 24 hỏng và chỉ ông Thắng còn
biết bố đã nói gì. Lời hứa ở giỗ đầu (c4_01) được cả phố nhớ và đọc lại ở c5_01. Quyết định cuối có bốn cửa,
mỗi cửa do cả năm mở: ở lại làm lưu trữ (cần triển lãm đủ khung và còn giọng bố), tặng cho cô Hạnh (cần
biết tên đã cháy), bán cho tổ hợp tác (cần phố đã chọn tự quản), bán cho Kim Long (luôn mở).

**Vĩnh đổi hướng.** Vĩnh không phải phản diện. Khổ: làng Mỹ Đình của ông thành sân vận động năm 2001, bố
nhận tiền đền bù rồi uống hết; ông thành môi giới năm 2007 và tin "chết là chuyện bình thường". Ở triển lãm
ông thấy chính mình mười sáu tuổi bán cờ ở sân Cột cờ ngày 10/10/1994 trong ảnh ông Khải. Ông chỉ đổi hướng
khi có **cả** sức ép (thanh tra từ đơn của Thảo, bài của Hương, hay trang của Linh) **và** một lối ra không
mất mặt (tấm ảnh được tặng, lời mời góp vốn tự quản từ chương 1, hay ông đang cầm giấy nợ của cô Hạnh). Thiếu
một trong hai, ông cài lại cúc áo và đi.

## 3. Nhiệm vụ

| Id | Nhân vật | Quận | Điểm chính |
| --- | --- | --- | --- |
| c3_01_ram_thang_gieng | Lan | Tây Hồ, phố cổ | Phủ Tây Hồ rằm tháng Giêng; đọc bốn câu trả lời đêm giao thừa |
| c3_02_so_no_cua_co | Lan | Hai Bà Trưng | minigame dựng dòng tiền; gốc thật 600 triệu |
| c3_03_ra_gieng | Minh | Hoàng Mai, Thanh Xuân, phố cổ | hai nhánh theo `minh_noi_that_voi_me` |
| c3_04_tuong_chung | Khôi | phố cổ, Long Biên | chụp vết cắt; bà Liên ở Việt Hưng |
| c3_05_ho_so_hai_muoi_ho | Lan | Tây Hồ, Mỹ Đình, phố cổ | ba nhánh theo câu trả lời ở tầng 31 hồi Tết |
| c3_06_truoc_bao | Minh | Hoàng Mai, Thanh Xuân | trạm bơm Yên Sở; đơn nhân ba hay bao cát |
| **c3_07_dem_nuoc_len** | cả ba | Long Biên, phố cổ | **điểm nhấn**: bãi giữa, cầu Long Biên cấm, bếp ngập, gác ảnh |
| c3_08_nuoc_rut | Lan, Khôi | phố cổ | biên bản sau bão; Vĩnh vào ngõ; câu trả lời cho anh Tùng |
| c4_01_gio_dau | Khôi | phố cổ | cứu phim hoặc băng ướt; lời hứa trước cả phố |
| c4_02_tuan_bach_mai | Minh | Đống Đa, Hai Bà Trưng | tạm ứng mổ; mẹ Tuấn hỏi |
| c4_03_bao_khong_dang | Khôi | Cầu Giấy | Phong từ chối; ai đưa câu chuyện ra |
| c4_04_thao_va_thanh_tra | Minh | Hà Đông, Hai Bà Trưng | Thảo nộp đơn nếu có bằng chứng *và* người làm chứng |
| c4_05_bang_24 | Khôi | Ba Đình, Hoàn Kiếm | khung 30 ở Cột cờ; băng 24 hoặc ông Thắng |
| c4_06_phan_cua_be_hanh | Lan | phố cổ | tên đã cháy; bốn trạng thái của tờ giấy nợ |
| **c4_07_muoi_thang_muoi** | cả ba | Ba Đình, phố cổ | **điểm nhấn**: triển lãm Đoan Môn, Vĩnh trước khung 30, bỏ phiếu |
| c5_01_quyet_dinh_cua_khoi | Khôi | phố cổ, Hoàn Kiếm | phần của ông Khiêm, bốn cửa |
| c5_02_tiem_cua_minh | Minh | Thanh Xuân | sửa xe trước mặt anh Đức; năm con đường của Minh |
| c5_03_ngay_ky | Lan | phố cổ | ba kết cục |
| **c5_04_bat_pho_cuoi_cung** | cả ba | phố cổ | **điểm nhấn**: nồi đầu mùa lạnh không ai nếm thay, tấm ảnh cuối |

`c2_08_xong_dat` giờ mở `c3_01`; cờ `da_xong_dat` (trước đây chờ chương sau) được `c3_01` đọc ở `requires`,
nên `READ_IN_NEXT_CHAPTER` trong tests đã rỗng.

## 4. Bỏ phiếu 10/10 và ma trận kết cục

Bỏ phiếu ở `c4_07` đi qua bốn câu hỏi, mỗi câu đọc cờ của cả game:

1. **Phố có tin nhà 49 không?** Có nếu Lan đã đính chính công khai hồi Tết, hoặc đã chốt tự quản với Vĩnh,
   hoặc tối nay xin lỗi ông Khang, hoặc Khôi đưa ảnh tường chung cho tổ dân phố, hoặc ông Thắng đã kể hết
   cho Khôi (và tối nay ông nói trước tổ).
2. **Có tiền để tự quản không?** Có nếu Lan qua cuộc gọi năm điều kiện của hội đồng tín dụng (minigame
   85 điểm, một lỗi) và gói vay được duyệt có điều kiện.
3. **Phần của cô Hạnh có an toàn không?** Có nếu cô ký cam kết tự quản (chỉ ký được khi nợ đã trả xong
   hoặc đã đóng băng), hoặc tờ giấy nợ đang đóng băng.
4. Nếu câu 1 là không: còn gói vay thì phố chọn **chia**, không thì **bán**.

| Phiếu 10/10 | Khôi bán cho Kim Long? | Vĩnh đổi hướng? | Kết cục (c5_03) |
| --- | --- | --- | --- |
| Tự quản | không | bất kỳ | **A. Tự quản**: hai mươi hộ, tổ hợp tác, gói vay; số 51 thành quán nước chè của bà Liên nếu Vĩnh đổi hướng |
| Tự quản | có | bất kỳ | **B. Thỏa hiệp** |
| Chia | bất kỳ | có | **B. Thỏa hiệp**: Kim Long giữ mặt tiền mười bốn nhà, mua đúng giá thẩm định, quán phở thuê dài hạn |
| Chia | bất kỳ | không | **C. Bán** |
| Bán | bất kỳ | bất kỳ | **C. Bán**: hàng rào tôn, số 49 còn lại giữa dãy nhà mẫu (hoặc có Kim Long làm đồng chủ nếu Khôi bán) |

Ở cả ba kết, sáng hôm sau Lan nấu nồi đầu mùa lạnh không ai nếm thay và Khôi chụp tấm ảnh cuối; lời cụ Thọ
và lời mọi người đổi theo kết và theo con đường của từng nhân vật (Minh: sang tiệm, quản lý đội xe Kim Long,
về Thái Bình, chạy thêm một năm; Khôi: lưu trữ, tặng phần, bán cho phố, bay về Leipzig).

## 5. Nhân vật mới

Cả năm người đều có khối `drive` đủ Khổ-Tập-Diệt-Đạo trong `characters/story.json`.

| Id | Ai | Khổ | Đạo (việc họ làm trong game) |
| --- | --- | --- | --- |
| `ong_tung_hoa_lac` | Anh Tùng, 52, môi giới đất, chủ nợ của cô Hạnh | ôm mười hai lô đất Hòa Lạc từ 2021, chính anh cũng nợ | cho người quen vay nóng, mỗi Tết đảo giấy; sợ luật thì cắt lỗ bán giấy nợ; không ký gì trong tháng cô hồn |
| `ba_lien_so_51` | Bà Liên, 70, chủ cũ số 51 | giãn dân sang tầng chín Việt Hưng, mất gánh nước chè | sáng nào cũng đi xe buýt về ngồi đầu ngõ cũ; làm chứng chuyện cắt tường |
| `ong_bay_bai_giua` | Ông Bảy, 78, bãi giữa sông Hồng | nước lên mỗi mùa bão, già, không xe | chỉ đi khi có người ông tin đến đón và được ôm bát hương theo |
| `bs_hoa_bach_mai` | Bác sĩ Hòa, 33, cấp cứu Bạch Mai | ca trực ba mươi sáu tiếng, mùa mưa nào cũng nhận shipper ngã | nói thẳng tạm ứng và hạn; ghét người nhà nói dối về tiền |
| `me_tuan` | Mẹ Tuấn, 49, trồng chè Thanh Ba | con nói "nổi tiếng trên mạng", không kể tiền đâu ra | bắt xe xuống ngay, hỏi người bạn duy nhất bà biết tên |

## 6. Độ khó

Theo bảng `08-nhan-qua.md` §4, thêm cột chương 5.

| Thước đo | Ch. 3 | Ch. 4 | Ch. 5 |
| --- | --- | --- | --- |
| `pass_score` minigame | 80 | 85 | 90 |
| `match_threshold` ảnh | 0,8 | 0,85 | 0,9 |
| `time_limit_s` chở/giao (thật) | 300-600 | 300-420 | 240 |
| `max_faults` | 2 | 1-2 | 1 |
| Giá của thua | mất uy tín một phe (người chơi chọn phe nào chịu) hoặc một ngày | mất một lựa chọn ở kết (khung trống, mất giọng ông Khải, gói vay treo) | làm lại sáng hôm sau, ông nếm thay một lần |
| Lựa chọn bị khóa bởi quá khứ | 7 | 10 (8 lựa chọn có điều kiện, 2 nằm sau dòng chỉ hiện khi `lan_phu_nhan`) | 7 |

Ví dụ "thua có giá" ở chương 4: hỏng bước cứu phim ướt hoặc lỡ ánh sáng 15 giờ ở sân Cột cờ đặt
`trien_lam_khung_trong`; đứt băng đặt `trien_lam_mat_tieng`. Một trong hai là đủ để bảo tàng không nhận lưu
trữ kho phim, và lựa chọn "ở lại làm người lưu trữ" của Khôi biến mất ở chương 5. Trượt cuộc gọi của hội
đồng tín dụng thì gói vay treo, và phiếu bầu dù phố tin nhà 49 cũng chỉ dừng ở "chia".

## 7. Kết quả chạy thử (`tools/playtest.py`, 4 kiểu người chơi)

| Kiểu | Phiếu 10/10 | Kết | Khôi | Minh | Tờ giấy nợ |
| --- | --- | --- | --- | --- | --- |
| tử tế | tự quản | A. Tự quản | ở lại làm lưu trữ | chạy thêm một năm | trả xong 460 triệu |
| liều | tự quản | A. Tự quản, Vĩnh đổi hướng | bán cho phố | chạy thêm một năm | đóng băng (tố cáo) |
| tối ưu tiền | chia | C. Bán | bán cho Kim Long | quản lý đội xe Kim Long | treo đến 10/10 |
| ngẫu nhiên | tự quản | A. Tự quản, Vĩnh đổi hướng | bán cho phố | chạy thêm một năm | đóng băng |

Chạy thử giả định mọi minigame đều qua ở lần đầu hoặc lần làm lại, nên tỷ lệ kết A ở đây cao hơn người
chơi thật: người chơi thật trượt cuộc gọi tín dụng hoặc khung 30 sẽ rơi xuống "chia". Toàn bộ 81 nhiệm vụ
(40 truyện, 41 phụ) chạy hết, 0 lỗi, 0 cảnh báo giờ; 202 cờ lựa chọn đều có chỗ đọc.

## 8. Sổ cờ chương 3-5

Mỗi cờ chương 3-5 đặt ra đều có chỗ đọc (CI kiểm ở `tests/test_content_logic.py`). `ket_thuc_chuong_5`
là cờ để engine chạy phần kết, nằm trong `RUNTIME_READ_FLAGS`.

| Ch. | Cờ | Đặt ở | Đọc ở |
| --- | --- | --- | --- |
| 3 | `ho_so_19_ho` | c3_05_chot | c3_07_cau_thang |
| 3 | `ho_so_co_hanh_trong_goi` | c3_05_chot | c3_07_cau_thang, c3_08_tung_goi, c4_06_giai_xong, c4_06_phan_cua_be_hanh |
| 3 | `ket_thuc_chuong_3` | c3_08_nuoc_rut (thưởng) | c4_01_gio_dau |
| 3 | `khoi_cuu_bang` | c3_07_khoi_gac | c3_07_cau_thang, c3_07_dem_nuoc_len, c4_01_gio_dau, c4_01_kiem_ke, c4_05_bang_24 |
| 3 | `khoi_cuu_phim` | c3_07_khoi_gac | c3_07_cau_thang |
| 3 | `khoi_gui_bao_51` | c3_04_gui_anh | c3_07_khoi_gac, c3_08_bien_ban, c3_08_vinh, c4_01_cung_gio, c4_03_phong |
| 3 | `khoi_gui_thao_51` | c3_04_gui_anh | c3_07_khoi_gac, c3_08_bien_ban, c4_03_chon_nguoi, c4_04_o_lai, c4_04_thao_va_thanh_tra |
| 3 | `khoi_gui_to_dan_pho_51` | c3_04_gui_anh | c3_07_lan_bep, c3_07_loa_phuong, c3_08_bien_ban, c3_08_vinh, c4_01_cung_gio, c4_07_muoi_thang_muoi |
| 3 | `lan_biet_goc_that` | c3_02_so_no_cua_co.ket_qua | c3_05_chot, c3_08_tung_goi |
| 3 | `lan_bo_ngan_hang` | c3_05_xung_dot | c3_05_chot, c4_07_vay_duyet |
| 3 | `lan_bo_sot_ho_33` | c3_05_ho_so_hai_muoi_ho.bo_sot (thua minigame `tham_dinh_cheo`) | c4_07_khang |
| 3 | `lan_di_go_cua_33` | c3_05_bo_sot (Lan đi gõ cửa cùng ông Khang; -2 danh tiếng tổ dân phố, chọn tự lo qua điện thoại thì -8) | c4_07_khang |
| 3 | `lan_cho_vinh_mua_no` | c3_08_tung_goi | c4_06_phan_cua_be_hanh, c4_07_muoi_thang_muoi, c4_07_vinh_doi |
| 3 | `lan_de_co_quyet` | c3_02_ket_qua | c3_08_tung_goi |
| 3 | `lan_doi_mat_tung` | c3_01_ong_tung | c3_01_duong_ve, c3_08_tung_goi |
| 3 | `lan_dong_bep` | c3_07_lan_bep | c3_07_cau_thang, c3_08_bien_ban |
| 3 | `lan_giao_ho_so_dong_nghiep` | c3_05_xung_dot | c3_05_chot, c4_07_vay_duyet |
| 3 | `lan_goi_von_cong_dong` | c3_05_chot | c3_08_tung_goi, c4_06_giai_xong, c4_06_phan_cua_be_hanh |
| 3 | `lan_hoi_gia_tung` | c3_01_ong_tung | c3_02_ket_qua, c3_08_tung_goi |
| 3 | `lan_khuyen_bao_cong_an` | c3_02_ket_qua | c3_08_tung_goi |
| 3 | `lan_khuyen_thuong_luong` | c3_02_ket_qua | c3_08_tung_goi |
| 3 | `lan_nau_cho_nguoi_truc` | c3_07_lan_bep | c3_07_cau_thang, c3_07_dem_nuoc_len, c3_08_bien_ban |
| 3 | `lan_ram_de_co_ban` | c3_01_vinh_ram | c3_01_duong_ve, c3_08_vinh |
| 3 | `lan_ram_khong_ban` | c3_01_vinh_ram | c3_01_duong_ve, c3_08_tung_goi, c3_08_vinh |
| 3 | `lan_thuong_luong_tung` | c3_08_tung_goi | c4_06_phan_cua_be_hanh |
| 3 | `lan_to_cao_tung` | c3_08_tung_goi | c4_06_phan_cua_be_hanh |
| 3 | `lan_xin_giay_no` | c3_01_ong_tung | c3_01_duong_ve, c3_02_mo_so, c3_08_tung_goi |
| 3 | `lan_xin_tung_ba_thang` | c3_08_tung_goi | c4_06_treo |
| 3 | `minh_chay_don_bao` | c3_06_don_x3 | c3_06_truoc_bao, c3_07_ong_bay, c4_02_cuoc_goi |
| 3 | `minh_cho_bao_cat` | c3_06_don_x3 | c3_07_loa_phuong, c3_07_ong_bay |
| 3 | `minh_di_vong_chuong_duong` | c3_07_ong_bay | c3_07_cau_thang |
| 3 | `minh_giu_ruong_cho_me` | c3_03_so_do | c3_06_tuan_dem_tien, c5_02_quyet |
| 3 | `minh_goi_lai_noi_that` | c3_03_tien_o_dau | c3_06_tuan_dem_tien |
| 3 | `minh_nhan_tien_ruong` | c3_03_so_do | c3_06_don_x3, c3_06_tuan_hoi, c4_02_cap_cuu, c5_02_quyet |
| 3 | `minh_ung_tien_kim_long` | c3_03_tien_o_dau | c3_06_tuan_hoi |
| 3 | `minh_vay_duc` | c3_03_tien_o_dau | c3_06_don_x3 |
| 3 | `minh_vuot_rao_cau` | c3_07_ong_bay | c3_07_cau_thang, c3_07_dem_nuoc_len |
| 4 | `biet_ten_chay` | c4_05_bang_24.nghe_bang_24, c4_05_bang_24.ong_thang_ke | c5_01_quyet |
| 4 | `bo_phieu_ban` | c4_07_muoi_thang_muoi.ban | c4_07_dem, c5_01_sang_lanh |
| 4 | `bo_phieu_chia` | c4_07_muoi_thang_muoi.chia | c4_07_dem, c5_01_sang_lanh, c5_03_ngay_ky |
| 4 | `bo_phieu_tu_quan` | c4_07_muoi_thang_muoi.thang | c4_07_dem, c5_01_quyet, c5_01_sang_lanh, c5_03_ngay_ky |
| 4 | `co_hanh_ban_cho_vinh_co_dieu_kien` | c4_06_quyet | c5_03_sang, c5_03_thoa_hiep |
| 4 | `co_hanh_ky_cam_ket` | c4_06_quyet | c4_07_khang, c4_07_muoi_thang_muoi, c5_03_sang |
| 4 | `goi_vay_duyet` | c4_07_muoi_thang_muoi.vay_duyet | c4_07_muoi_thang_muoi |
| 4 | `ket_thuc_chuong_4` | c4_07_muoi_thang_muoi (thưởng) | c5_01_quyet_dinh_cua_khoi |
| 4 | `khoi_ban_anh_vinh` | c4_07_trien_lam | c5_04_bat_cuoi |
| 4 | `khoi_chua_hua` | c4_01_cung_gio | c5_01_sang_lanh |
| 4 | `khoi_dua_huong` | c4_03_chon_nguoi | c4_07_muoi_thang_muoi |
| 4 | `khoi_dua_linh` | c4_03_chon_nguoi | c4_07_muoi_thang_muoi |
| 4 | `khoi_dua_thao` | c4_03_chon_nguoi | c4_04_thao_va_thanh_tra |
| 4 | `khoi_giu_im` | c4_03_chon_nguoi | c4_07_trien_lam |
| 4 | `khoi_hua_ban_cho_pho` | c4_01_cung_gio | c5_01_quyet, c5_01_sang_lanh |
| 4 | `khoi_hua_o_lai` | c4_01_cung_gio | c5_01_quyet, c5_01_sang_lanh |
| 4 | `khoi_khong_dua` | c4_07_trien_lam | c5_04_bat_cuoi |
| 4 | `khoi_nghe_bang_24` | c4_05_bang_24.nghe_bang_24 | c4_06_ten_chay |
| 4 | `khoi_nghe_thang_ke_het` | c4_05_bang_24.ong_thang_ke | c4_06_ten_chay, c4_07_muoi_thang_muoi, c4_07_tu_quan |
| 4 | `khoi_tang_anh_vinh` | c4_07_trien_lam | c4_07_muoi_thang_muoi, c4_07_vinh_giu, c5_04_bat_cuoi |
| 4 | `lan_de_co_tu_quyet` | c4_06_quyet | c4_07_chia |
| 4 | `lan_khong_xin_loi` | c4_07_khang | c4_07_chia |
| 4 | `lan_xin_loi_khang` | c4_07_khang | c4_07_muoi_thang_muoi, c4_07_tu_quan |
| 4 | `minh_dung_tien_danh_dum` | c4_02_cap_cuu | c5_02_sang |
| 4 | `minh_dung_tien_ruong` | c4_02_cap_cuu | c5_02_quyet, c5_02_sang |
| 4 | `minh_giu_loi_tuan` | c4_02_me_tuan | c5_02_sang |
| 4 | `minh_goi_hoi_tai_xe` | c4_02_cap_cuu | c4_02_me_tuan, c4_02_tuan_bach_mai, c5_02_sang |
| 4 | `minh_im_lai_xe` | c4_04_cau_hoi | c4_04_o_lai |
| 4 | `minh_ke_ong_tu_cho_thao` | c4_04_cau_hoi | c4_04_nop, c4_04_thao_va_thanh_tra |
| 4 | `minh_noi_that_me_tuan` | c4_02_me_tuan | c5_02_sang |
| 4 | `minh_thu_nhan_ban_tin` | c4_04_cau_hoi | c4_04_nop, c4_04_thao_va_thanh_tra |
| 4 | `minh_ung_kim_long_lan_hai` | c4_02_cap_cuu | c5_02_sang |
| 4 | `no_co_hanh_an_toan` | c4_06_phan_cua_be_hanh.dong_bang, c4_06_phan_cua_be_hanh.giai_xong | c4_06_quyet |
| 4 | `no_co_hanh_cua_vinh` | c4_06_phan_cua_be_hanh.n_vinh | c4_06_quyet, c5_03_sang |
| 4 | `no_co_hanh_da_giai` | c4_06_phan_cua_be_hanh.giai_xong | c5_03_sang |
| 4 | `no_co_hanh_dong_bang` | c4_06_phan_cua_be_hanh.dong_bang | c4_07_muoi_thang_muoi, c5_03_sang |
| 4 | `no_co_hanh_treo` | c4_06_phan_cua_be_hanh.n_treo | c4_07_khang, c5_03_sang |
| 4 | `thao_nop_thanh_tra` | c4_04_thao_va_thanh_tra.nop | c4_07_muoi_thang_muoi, c4_07_trien_lam |
| 4 | `thao_o_lai_kim_long` | c4_04_thao_va_thanh_tra.o_lai | c4_07_ban, c4_07_trien_lam, c5_03_ban |
| 4 | `trien_lam_khung_trong` | c4_01_gio_dau.phim_hong, c4_05_bang_24.khung_trong | c4_07_sang, c5_01_quyet |
| 4 | `trien_lam_mat_tieng` | c4_01_gio_dau.bang_dut | c4_07_sang, c4_07_trien_lam, c5_01_quyet |
| 4 | `vinh_doi_huong` | c4_07_muoi_thang_muoi.vinh_doi | c4_07_dem, c5_03_ngay_ky, c5_03_thoa_hiep, c5_03_tu_quan |
| 5 | `anh_cuoi_ba_nguoi` | c5_04_bat_cuoi | c5_04_bat_cuoi |
| 5 | `anh_cuoi_ca_pho` | c5_04_bat_cuoi | c5_04_bat_cuoi |
| 5 | `anh_cuoi_tay_ong` | c5_04_bat_cuoi | c5_04_bat_cuoi |
| 5 | `ket_ban` | c5_03_ngay_ky.ket_c | c5_04_bon_gio |
| 5 | `ket_thoa_hiep` | c5_03_ngay_ky.ket_b | c5_04_bon_gio |
| 5 | `ket_thuc_chuong_5` | c5_04_bat_pho_cuoi_cung (thưởng) | engine: hiện phần kết |
| 5 | `ket_tu_quan` | c5_03_ngay_ky.ket_a | c5_04_bon_gio |
| 5 | `khoi_ban_cho_pho` | c5_01_quyet | c5_03_tu_quan, c5_04_bat_cuoi |
| 5 | `khoi_ban_kim_long` | c5_01_quyet | c5_03_ban, c5_03_ngay_ky, c5_03_thoa_hiep, c5_04_bat_cuoi |
| 5 | `khoi_o_lai_luu_tru` | c5_01_quyet | c5_03_tu_quan, c5_04_bat_cuoi |
| 5 | `khoi_trao_phan_cho_hanh` | c5_01_quyet | c5_03_ban, c5_03_sang, c5_03_tu_quan, c5_04_bat_cuoi |
| 5 | `minh_chay_tiep` | c5_02_quyet | c5_04_bat_cuoi |
| 5 | `minh_quan_ly_doi_xe` | c5_02_quyet | c5_04_bat_cuoi |
| 5 | `minh_sang_tiem` | c5_02_quyet | c5_04_bat_cuoi |
| 5 | `minh_ve_thai_binh` | c5_02_quyet | c5_04_bat_cuoi |

## 9. Nguồn tư liệu

- Lũ sông Hồng do bão Yagi 2024: mực nước ở Long Biên 10,60 m lúc 1 giờ và 10,70 m lúc 7 giờ ngày 11/9,
  vượt báo động 2 (10,5 m); 11,22 m lúc 17 giờ, dưới báo động 3 (11,5 m) 0,28 m; cấm người và xe qua cầu
  Long Biên cả hai chiều, dừng tàu; sơ tán toàn bộ dân bãi giữa; Phúc Xá, Chương Dương Độ, vườn quất Tứ
  Liên ngập. VnExpress (diễn biến mưa lũ ngày 11/9/2024), SGGP, Vietnam News.
- Mưa ngày 30/9/2025 ở Hà Nội: trạm Láng 295 mm, vượt kỷ lục 185 mm năm 1978 (Tuổi Trẻ); Ô Chợ Dừa
  527 mm, bằng 170% công suất thiết kế 310 mm/2 ngày, 116 điểm ngập; lưu vực sông Tô Lịch chỉ khoảng 77,5
  trên 313 km²; sông lên trên báo động nên nước phố không tự chảy ra được (VOV). Lời chú Sáu ở c3_06.
- Giãn dân phố cổ: kế hoạch 6.550 hộ, 26.200 người; khu tái định cư Thượng Thanh, Việt Hưng bỏ trống nhiều
  năm, người dân lo sinh kế (VietNamNet 2019, Báo Pháp luật). Bà Liên ở c3_04.
- Bộ luật Dân sự 2015 Điều 468: lãi suất thỏa thuận tối đa 20%/năm, phần vượt không có hiệu lực. Bộ luật
  Hình sự Điều 201: cho vay lãi gấp năm lần mức cao nhất trở lên, thu lợi bất chính từ 30 triệu đồng là
  tội phạm (phạt tiền 50-200 triệu hoặc cải tạo không giam giữ đến 3 năm; thu lợi từ 100 triệu thì phạt
  200 triệu-1 tỷ hoặc tù 6 tháng-3 năm) (LuatVietnam). Dùng ở c3_02, c3_08, c4_06.
- Bộ luật Dân sự 2015 Điều 623: thời hiệu yêu cầu chia di sản là 30 năm với bất động sản. Lý do "theo luật
  phần ấy là của Khôi" ở băng 24.
- Giải phóng Thủ đô: ngày 9/10/1954 bộ đội tiếp quản ga Hàng Cỏ và các điểm; sáng 10/10/1954 Đại đoàn 308
  vào thành qua các cửa ô, khoảng 200.000 người đón; 15 giờ chiều 10/10/1954 lễ chào cờ đầu tiên ở sân Cột
  cờ (nay là Đoan Môn), lá cờ "Quyết chiến quyết thắng" (Nhân Dân). Giờ và nơi của c4_05, c4_07.
- Sân vận động Quốc gia Mỹ Đình xây 2001-2003 trên đất nông nghiệp làng Mỹ Đình, khánh thành cho SEA
  Games 22 tháng 12/2003. Khổ của Vĩnh ở c4_07.
- Văn hóa đi qua việc làm (`09-giong-thoai.md` §3): lễ chay ở Phủ Tây Hồ rằm tháng Giêng, không mang vàng
  mã vào điện; tháng cô hồn (tháng Bảy âm) người làm đất kiêng chốt giao dịch; giỗ đầu với xôi gấc, gà
  luộc, cốm Vòng mùa thu; góp họ ở Hàng Chiếu năm 1957; gió mùa đông bắc đầu tiên và nồi phở đầu mùa lạnh.

## 10. Việc còn mở

- Chủ dự án trả lời hai thẻ quyết định (bí mật băng 24, ba kết ngang hàng). Nếu chọn phương án còn lại,
  phải sửa `dlg_c4_05_bang_24`, `dlg_c4_05_ong_thang`, `dlg_c4_06_ten_chay`, `dlg_c5_01_quyet` và bảng §4.
- Chủ dự án đọc lại thoại chương 3-5 (623 dòng); nhờ một người Hà Nội đọc to như với chương 2.
- ~~Kiểm lại hai điểm âm lịch năm 2027~~ Đã kiểm 14/10/2026 bằng thời điểm sóc theo giờ Hà Nội
  (docs/15 §3): Tết Đinh Mùi 6/2/2027, rằm tháng Giêng thứ Bảy 20/2, tháng Bảy âm 2/8-31/8/2027, năm
  không nhuận, 10/10/2027 là Chủ nhật. Không phải sửa.
- Runtime: xong cả hai engine. `flood_layers.json` (đêm bão `bao_so_3_2027`: mực sông Long Biên, mưa
  400 mm, 7 vùng ngập, lệnh cấm cầu Long Biên từ 20 giờ) và `minigame_modes.json` (4 chế độ, có đáp án,
  độ khó, bước cấm, sổ nợ 460 triệu) do `UHanoiFloodSubsystem`/`FloodSystem` và
  `UHanoiMinigameSubsystem`/`MinigameSystem` chạy; luật viết thành `tools/runtime_rules.py`. Thua
  `tham_dinh_cheo` nay có hệ quả: cờ `lan_bo_sot_ho_33`, danh tiếng tổ dân phố, và ông Khang nhắc lại ở
  c4_07.
- Bản tiếng Anh chương 3-5: chưa làm, theo lời chủ dự án.
