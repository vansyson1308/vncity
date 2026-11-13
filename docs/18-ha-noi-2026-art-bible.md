# 18. Art bible: Hà Nội trung tâm năm 2026 (tài liệu tham chiếu dựng cảnh và QC)

Phạm vi: lon 105,830–105,864, lat 21,019–21,050 (Hồ Gươm, phố cổ, khu phố Pháp, Ba Đình, Văn Miếu, mép nam
Hồ Tây và Trúc Bạch, đầu cầu Long Biên và Chương Dương phía tây). Mốc thời gian của game: **cuối năm 2026**.
Tra cứu ngày 11/11/2026.

Cách đọc:

- Mỗi dòng có nhãn tin cậy: **[chắc chắn]** = có trong nguồn đáng tin đã đọc; **[khá chắc]** = nhiều nguồn
  không chính thức hoặc hiểu biết phổ thông khớp nhau; **[suy đoán]** = người viết tự suy ra, cần kiểm lại.
- Số trong `[^n]` trỏ tới danh sách nguồn cuối file. Không có ảnh nào được tải về hay dùng lại; công cụ tra
  cứu chỉ đọc được chữ, nên phần mô tả hình dáng dựa trên lời mô tả của nguồn và hiểu biết phổ thông.
- **Mã hex đều là ước lượng của người viết** (coi như [suy đoán]) để lập trình viên có điểm xuất phát.
- Từ 1/7/2025 Hà Nội bỏ cấp quận. Trong khung bản đồ nay là các phường: Hoàn Kiếm (1,91 km², khoảng 105 nghìn
  dân, trụ sở UBND ở 126 Hàng Trống), Cửa Nam (phía nam hồ: Hàng Bài, Trần Hưng Đạo, Phan Chu Trinh), Ba Đình,
  Hồng Hà (ngoài đê), Văn Miếu - Quốc Tử Giám, một phần Ngọc Hà và Tây Hồ [chắc chắn với Hoàn Kiếm, Cửa Nam;
  khá chắc với các phường còn lại][^75]. Tài liệu vẫn gọi "Hoàn Kiếm", "Ba Đình" theo nghĩa khu vực.

## 1. 30 dấu hiệu khiến một con phố "ra Hà Nội" ngay (xếp theo tác động ở tầm mắt người đi đường)

| # | Dấu hiệu | Thông số kiểm được | Gợi ý dựng một dòng | Tin cậy |
|---|---|---|---|---|
| 1 | Dòng xe máy dày | Xe máy chiếm khoảng 80–85% số xe trong phố cổ; chạy 15–30 km/h; khoảng cách ngang giữa hai xe 0,5–1 m; không giữ làn | Instanced xe máy, mật độ 1 xe/6–10 m² lòng đường giờ cao điểm, lệch ngang ngẫu nhiên ±0,6 m | [khá chắc] số xe đăng ký[^13]; tỉ lệ trên phố [suy đoán] |
| 2 | Nhà ống so le | Mặt tiền 2–5 m, sâu 20–60 m, cao 2–6 tầng, hai nhà cạnh nhau hiếm khi cùng chiều cao | Chia mặt phố theo gian 3–5 m, random số tầng theo từng gian, không dùng chiều cao cả khối | [chắc chắn][^37][^38] |
| 3 | Biển hiệu chồng lớp | Dải biển ngang kín bề rộng nhà, cao 0,6–1,2 m, mép dưới cao 3–3,6 m; thêm biển vẫy vuông góc nhô 0,6–1 m | Mỗi gian một biển ngang + 30% gian có biển vẫy; chữ Việt có dấu, kèm "ĐT: 09xx" | [khá chắc] |
| 4 | Dây cáp đen trên cột bê tông | Bó cáp đường kính 10–30 cm, võng 0,5–1 m giữa hai cột cách nhau 25–35 m, cao 5–7 m; hộp cáp xám trên cột | Vẽ ở ngõ và phố nhỏ; phố chính quanh hồ và trục Tràng Tiền đã hạ ngầm thì bỏ | [khá chắc]; chương trình hạ ngầm còn dang dở[^42] |
| 5 | Cây cổ thụ, gốc quét vôi | Vôi trắng từ mặt đất lên 1,0–1,3 m; cây cách nhau 5–10 m, cách mép bó vỉa 1,0–1,2 m | Dải màu trắng trên thân, không phải vòng sơn mảnh | [chắc chắn] khoảng cách[^36]; vôi [khá chắc] |
| 6 | Ghế nhựa thấp vỉa hè | Ghế đẩu nhựa cao 22–26 cm, màu đỏ `#C62828` hoặc xanh dương `#1E63B5`; bàn nhựa thấp 45–50 cm | Cụm 4–10 ghế quanh 1–2 bàn, sát tường nhà, mỗi 30–60 m ở phố cổ | [khá chắc] |
| 7 | Biển tên phố xanh chữ trắng | 75 × 40 cm, nền xanh lam sẫm, viền trắng, dòng nhỏ "PHỐ", dòng lớn tên phố | Xem mục 2.1 | [chắc chắn][^30] |
| 8 | Người đi xe: mũ nửa đầu, áo chống nắng, khẩu trang | Gần như 100% đội mũ; nữ mùa hè trùm áo chống nắng có mũ + váy quây + khẩu trang | 3–4 biến thể người lái nướng sẵn; mùa hè tăng tỉ lệ "ninja" lên khoảng 40% nữ | [khá chắc] |
| 9 | Cờ đỏ sao vàng, băng rôn đỏ chữ vàng | Cờ 0,8 × 1,2 m cắm nghiêng khoảng 45° ở ban công tầng 2; băng rôn ngang phố cao 5–6 m | Bật theo "ngày lễ" (2/9, 10/10, Tết, 30/4); ngày thường giữ 10–20% nhà treo cờ | [khá chắc] |
| 10 | Tường vàng, cửa chớp xanh, mái ngói đỏ | Vàng đất `#E3B448`–`#D9A441`, phào trắng `#F4EFE2`, cửa chớp xanh lục `#2F5D3A`, ngói `#9B4A32` | Bộ màu riêng cho khu phố Pháp và Ba Đình | [khá chắc] |
| 11 | Hàng rong | Quang gánh (đòn tre 1,4–1,6 m, hai thúng Ø 45–50 cm), xe đạp chở hoa, nón lá | 1 người bán rong mỗi 80–150 m phố cổ, đi bộ 3–4 km/h sát mép đường | [khá chắc] |
| 12 | Xe máy đỗ trên vỉa hè theo vạch | Một hàng vuông góc bó vỉa, sâu khoảng 2 m, trong vạch sơn trắng; chừa lối đi bộ tối thiểu 1,5 m | Hàng xe máy tĩnh instanced, quay đầu vào tường hoặc ra đường nhất quán theo đoạn | [khá chắc][^76] |
| 13 | Vỉa hè lát đá xám, bó vỉa vát | Đá tự nhiên 30 × 30 đến 40 × 60 cm; bó vỉa vát 26 × 23 cm, mặt hè cao hơn lòng đường từ 12,5 cm | Bó vỉa vát 45° để xe máy leo được; hạ còn 5 cm trước cửa nhà | [chắc chắn][^36] |
| 14 | Ban công kín đồ | Lồng sắt "chuồng cọp" nhô 0,6–1 m, cục nóng điều hòa 0,8 × 0,55 × 0,3 m, chậu cây, quần áo phơi | Decal/hình hộp gắn theo tầng, xác suất 50–70% mỗi ô ban công | [khá chắc] |
| 15 | Bồn nước inox và "tum" trên mái | Bồn trụ nằm Ø 0,96–1,2 m dài 1,4–1,8 m trên giá thép; tum cầu thang 3 × 3 × 2,5 m | 1 bồn + 1 tum trên 70% nóc nhà ống | [khá chắc] |
| 16 | Mái hiên bạt | Bạt xanh dương, xanh lá hoặc sọc, vươn 1,5–3 m, mép thấp 2,3–2,8 m | Mặt phẳng nghiêng 15–25° trên 40% cửa hàng | [khá chắc] |
| 17 | Xe ôm công nghệ theo màu áo | Xanh lá, vàng, xanh ngọc lam, cam (không logo) | Tô màu áo + mũ theo 4 nhóm, chiếm 10–15% xe máy đang chạy | [khá chắc][^80] |
| 18 | Taxi điện xanh ngọc lam | Khoảng 61% taxi Hà Nội là xe điện (8.800/14.300 xe) | 6/10 taxi sơn xanh ngọc lam, biển vàng | [chắc chắn] tỉ lệ[^60] |
| 19 | Đèn tín hiệu có đồng hồ đếm ngược | Hộp số LED 2 chữ số cạnh đèn; trục Trần Hưng Đạo chỉ hiện 8 giây cuối | Xem mục 2.3 | [chắc chắn] thí điểm 8 giây[^33] |
| 20 | Hồ + Tháp Rùa + cầu đỏ | Hồ 11,5 ha, kè 1.452 m không lan can; cầu Thê Húc sơn đỏ `#C8102E` | Mép kè thấp, người ngồi sát nước | [chắc chắn] kè[^12] |
| 21 | Trời mù | Mùa đông tầm nhìn 2–5 km, trời xám trắng `#C9CCCF`; mùa thu trong, nắng vàng | Sương cự ly theo mùa (mục 7) | [khá chắc][^71][^72] |
| 22 | Ngõ hẹp | Rộng 1–3 m, biển "NGÕ …" xanh ở đầu ngõ, biển số nhà dạng "12/34" | Cổng ngõ là khe tối giữa hai nhà, có biển và dây điện chui vào | [khá chắc] |
| 23 | Chữ phun sơn "KHOAN CẮT BÊ TÔNG 09xx…" | Chữ đen hoặc xanh khuôn đục, cao 5–8 cm, dày đặc trên tường ngõ, cột điện, tủ điện | Decal lặp ngẫu nhiên ở độ cao 1–2 m trên tường bên và tường rào | [khá chắc] |
| 24 | Tủ điện, trạm biến áp trên vỉa hè | Tủ xám kem 0,8 × 0,4 × 1,4 m; trạm kiosk 2 × 1,5 × 2 m; nhiều cái vẽ hoa | 1 tủ mỗi 80–120 m, sát mép bó vỉa | [khá chắc] |
| 25 | Xích lô và xe điện du lịch | Xích lô 3 bánh khách ngồi trước; xe điện mui trần 7–14 chỗ | Chạy 8–15 km/h quanh hồ và trục Hàng Đào - Đồng Xuân | [chắc chắn] sức chứa[^64] |
| 26 | Đèn lồng đỏ | Hàng Mã treo kín mặt tiền; dây đèn lồng ngang phố dịp Tết, Trung thu | Bật theo mùa; Hàng Mã bật quanh năm | [khá chắc] |
| 27 | Vòm đá đường sắt và cầu thép | 131 vòm đá dọc Phùng Hưng - Gầm Cầu; cầu Long Biên thép nâu gỉ | Vòm bán nguyệt lặp, mỗi vòm rộng khoảng 6 m [suy đoán] | [chắc chắn] số vòm[^21] |
| 28 | Tường rào vàng, cổng sắt, bốt gác (Ba Đình) | Tường rào 1,8–2,2 m, bốt gác 1,2 × 1,2 × 2,4 m, lính gác | Bao quanh mọi lô cơ quan ở Ba Đình | [khá chắc] |
| 29 | Lư hương, bàn thờ nhỏ gốc cây; đốt vàng mã | Bát hương dưới gốc đa, si; lò hóa vàng bằng thùng sắt trên vỉa hè ngày rằm, mùng một | Prop nhỏ ở 5% gốc cây cổ thụ | [khá chắc] |
| 30 | Rào tôn công trường | Rào tôn cao 2–2,5 m quanh ga ngầm S11, S12 và khu phía đông hồ | Xem mục 8 | [chắc chắn][^24][^5] |

## 2. Đồ đạc đường phố và biển báo

### 2.1 Biển tên phố

| Hạng mục | Thông số | Tin cậy |
|---|---|---|
| Kích thước, màu | Hình chữ nhật 75 × 40 cm; nền xanh lam sẫm (gợi ý `#12408F`); chữ in hoa không chân màu trắng; đường viền trắng rộng 0,5 cm chạy cách mép 3–3,5 cm, bốn góc viền lượn vào trong; sắt tráng men hoặc nhôm dập, sơn phản quang | [chắc chắn][^30] |
| Nội dung | Dòng trên chữ nhỏ là loại đường: "PHỐ", "ĐƯỜNG" hoặc "NGÕ"; dòng dưới chữ lớn là tên: "HÀNG ĐÀO". Tức biển đọc là "PHỐ / HÀNG ĐÀO". Quy định cho phép in biểu trưng thành phố màu trắng ở góc trên trái; không xác minh được biển Hà Nội có in hay không, nên game không vẽ biểu trưng | [chắc chắn] bố cục[^30]; biểu trưng [không xác minh] |
| Dòng quận/phường | Mẫu chuẩn **không có** dòng quận hay phường. Không tìm thấy văn bản hay bài báo nào nói Hà Nội phải thay biển tên phố sau 1/7/2025. Kết luận dùng cho game: biển tên phố không ghi quận, phường | [khá chắc]; không xác minh được bằng nguồn trực tiếp |
| Lắp đặt | Cột thép tròn Ø ≥ 10 cm, đỉnh cột cao khoảng 2,5 m, đặt ở góc vỉa hè tại mỗi giao lộ và ở đầu, cuối phố; hai biển của hai phố gắn vuông góc nhau trên cùng một cột; được phép gắn vào cột điện sẵn có | [chắc chắn][^30] |
| Biến thể phố cổ | Nhiều biển gắn thẳng lên tường nhà góc phố ở độ cao 2,5–3,5 m | [khá chắc] |
| Biển phụ mã QR | Từ 9/2024 thí điểm biển phụ có mã QR trên 139 cột biển tên phố ở Hoàn Kiếm; khu này có 593 biển tên phố và 668 biển báo giao thông. Kích thước biển phụ không tìm thấy, gợi ý 20 × 20 cm ngay dưới biển chính | [chắc chắn] số lượng[^31]; kích thước [suy đoán] |
| Địa chỉ trên biển hiệu cửa hàng | Sau sáp nhập, biển hiệu tư nhân lẫn lộn kiểu cũ "Q. Hoàn Kiếm" và kiểu mới "P. Hoàn Kiếm, Hà Nội". Gợi ý: 60% biển vẫn ghi kiểu cũ | [suy đoán] |

### 2.2 Biển số nhà

- Nền xanh lam sẫm, chữ số và viền trắng, sắt tráng men hoặc nhôm dập dày 1 mm; nhà mặt đường có 1–2 chữ số
  dùng biển 200 × 150 mm [chắc chắn][^32]. Biển 3–4 chữ số rộng hơn, khoảng 230–260 mm [khá chắc].
- Gắn cạnh cửa chính, cao khoảng 2 m so với vỉa hè; một bên phố số lẻ, bên kia số chẵn; trong ngõ ghi dạng
  "12/34" [khá chắc]. Nhiều nhà cũ còn biển men lồi cỡ nhỏ đã bạc màu [khá chắc].

### 2.3 Đèn tín hiệu

| Hạng mục | Thông số | Tin cậy |
|---|---|---|
| Kiểu cột | Nút lớn: cột thép mạ xám cao 6–6,5 m có cần vươn ngang 4–6 m mang cụm đèn 3 màu xếp dọc (đỏ trên, vàng giữa, xanh dưới), bóng Ø 30 cm, kèm đèn lặp Ø 20 cm trên thân cột ở độ cao 2,5–3 m. Nút nhỏ phố cổ: cột thẳng 3–3,5 m ở góc vỉa hè | [khá chắc] |
| Đồng hồ đếm ngược | Hộp LED vuông 2 chữ số cạnh hoặc dưới cụm đèn, số đỏ khi đèn đỏ, xanh khi đèn xanh. Kế hoạch 2025 thay 505 bộ đếm lùi trên toàn thành phố | [khá chắc] |
| Thay đổi 2025–2026 | Từ tháng 11/2025 thí điểm chỉ hiện **8 giây cuối** ở các nút Trần Hưng Đạo giao Phan Chu Trinh, Ngô Quyền, Hàng Bài, Bà Triệu, Quang Trung, Lê Thánh Tông, rồi mở rộng sang Phố Huế - Hàng Bài và Hùng Vương - Trần Phú (đều trong khung bản đồ). Nơi khác vẫn đếm đủ | [chắc chắn][^33] |
| Đèn đi bộ | Hình người đỏ đứng, xanh bước. Riêng quảng trường Đông Kinh Nghĩa Thục có đèn sang đường bấm nút | [chắc chắn] nút bấm[^2] |
| Camera, bảng điện tử | Nhiều cụm camera trên cần vươn; 36 màn hình LED báo ùn tắc vận hành từ 15/7/2026 trên giá long môn (không xác minh được cái nào nằm trong khung) | [chắc chắn][^34] |

### 2.4 Biển báo, vạch sơn (QCVN 41:2024/BGTVT, hiệu lực 1/1/2025)[^35]

Các con số dưới đây người viết nhớ từ bản 2019 mà bản 2024 kế thừa; không mở được phụ lục kích thước của bản
2024 nên xếp **[khá chắc]**. Có dự thảo QCVN 41:2026 của Bộ Xây dựng, chưa xác minh hiệu lực.

| Hạng mục | Thông số |
|---|---|
| Kích thước biển (hệ số 1, đường đô thị) | Biển tròn Ø 70 cm; tam giác cạnh 70 cm; bát giác STOP rộng 60 cm |
| Cột và độ cao | Cột thép Ø 8–9 cm sơn khoang trắng đỏ, mỗi khoang 25–30 cm; mép dưới biển cao 2,0 m trong khu dân cư; mép biển cách mép lòng đường tối thiểu 0,5 m |
| Biển hay gặp trong khung | Cấm đi ngược chiều (tròn đỏ, vạch ngang trắng) ở gần như mọi đầu phố một chiều; cấm đỗ, cấm dừng và đỗ (nền xanh viền đỏ gạch chéo), kèm biển phụ ngày chẵn/lẻ; cấm rẽ trái, phải; cấm ô tô khách, xe tải kèm biển phụ giờ "6h–9h, 16h–19h30"; tốc độ tối đa 40 hoặc 50; đường một chiều (chữ nhật xanh, mũi tên trắng); người đi bộ sang ngang (vuông xanh, tam giác trắng); biển "P" nơi đỗ xe; biển tam giác vàng "trẻ em" trước cổng trường |
| Vạch tim đường | Màu **vàng**, rộng 15 cm; đứt nét (đoạn 1–3 m, hở 2–6 m) hoặc liền; vàng đôi trên trục lớn |
| Vạch chia làn cùng chiều | Màu trắng, rộng 15 cm, đứt nét (đoạn 1–3 m, hở 3–6 m) |
| Vạch sang đường | Các vạch trắng song song rộng 40 cm, cách nhau 60 cm, dài tối thiểu 3 m |
| Vạch dừng | Trắng liền, rộng 40 cm, cách vạch sang đường 2–3 m |
| Điểm dừng xe buýt | Vạch chữ chi màu vàng trên lòng đường dài khoảng 20–30 m |
| Phố cổ | Phần lớn phố rộng 5–8 m **không có vạch tim đường**, chỉ có vạch sang đường ở ngã tư |

### 2.5 Đỗ xe trên vỉa hè và lòng đường

- Xe máy: ô kẻ sơn trắng trên vỉa hè, một hàng vuông góc với bó vỉa, sâu khoảng 2 m; phần còn lại cho người
  đi bộ tối thiểu 1,5 m [khá chắc]. Đầu năm 2026 phần lớn các phố ở Hoàn Kiếm có vỉa hè được cấp phép trông
  giữ xe máy; điểm trông xe phải niêm yết giá và số đường dây nóng trên biển [chắc chắn][^76].
- Ô tô: ô sơn trắng dọc bó vỉa, 2,0–2,5 × 5–6 m, có biển "P" xanh kèm giá [khá chắc].
- Hiện trạng sau các đợt ra quân 11/2025–2026: nhiều đoạn vỉa hè thoáng hơn, hàng quán thu vào trong, nhưng
  không đều; tháng 4/2026 báo vẫn ghi nhận nhiều phố bị chiếm cả ngày lẫn đêm [chắc chắn][^76][^77]. Gợi ý:
  60% chiều dài vỉa hè phố cổ còn hàng hóa hoặc xe máy chiếm, 40% thông thoáng [suy đoán].

### 2.6 Điểm dừng và nhà chờ xe buýt

- Nội thành có 1.078 điểm dừng, chỉ 365 điểm có nhà chờ mái che (khoảng 1/3) [chắc chắn][^39].
- Điểm không mái: một cột biển chữ nhật nền xanh dương, hình xe buýt trắng và danh sách số tuyến, cao khoảng
  2,5 m, cắm sát bó vỉa [khá chắc].
- Nhà chờ: khung thép xám dài 4–5 m, sâu 1,5 m, cao 2,5 m, mái nhựa trong hoặc tôn cong, vách sau dán sơ đồ
  tuyến, một đầu là hộp đèn quảng cáo, ghế băng 2–3 chỗ [khá chắc về kiểu; kích thước suy đoán].
- Trong khung có điểm trung chuyển Long Biên (đường Yên Phụ, sát ga Long Biên): dãy mái che dài cho nhiều
  tuyến [khá chắc]. Bãi đỗ trên Đinh Tiên Hoàng cạnh quảng trường Đông Kinh Nghĩa Thục đã bị dời khi chỉnh
  trang 2025 [chắc chắn][^1][^2].

### 2.7 Thùng rác và thu gom rác

- Hoàn Kiếm đã bỏ toàn bộ 45 điểm tập kết rác ban ngày; xe chuyên dụng và công nhân đi thu trực tiếp sau
  19 giờ (thí điểm từ 12/2024); phân loại rác tại nguồn áp dụng từ 8/1/2026 [chắc chắn][^40][^82].
- Hệ quả hình ảnh: ban ngày không có đống rác hay dãy xe gom ở góc phố; từ 19 giờ có túi rác trước cửa nhà và
  xe gom đẩy tay (thùng tôn 400–500 lít trên khung 3 bánh, màu xanh lá hoặc cam) [khá chắc].
- Quanh Hồ Gươm có thùng rác công cộng (được thay khi chỉnh trang 2020) [chắc chắn][^12]. Màu và kiểu không
  tìm được nguồn; gợi ý thùng thép 2 ngăn xám đậm hoặc xanh rêu, cao 0,9 m, cách nhau 50–80 m [suy đoán].
- Trên các phố cổ gần như không có thùng rác công cộng cố định [khá chắc].

### 2.8 Tủ điện, trạm biến áp, cột điện, cột đèn

| Loại | Thông số | Tin cậy |
|---|---|---|
| Tủ phân phối, tủ cáp | Hộp thép xám kem `#CFCBBE`, 0,8 × 0,4 × 1,4 m, đặt sát bó vỉa; hay bị dán quảng cáo, điện lực đang bóc và sơn chống dán | [khá chắc] |
| Trạm biến áp kiosk | Hộp thép 2 × 1,5 × 2 m màu xám hoặc xanh rêu, có biển tam giác vàng cảnh báo điện | [khá chắc] |
| Trạm một cột | Trụ thép đơn Ø 0,5 m, máy biến áp đặt trên cao 3–4 m | [khá chắc] |
| Vẽ hoa trên tủ, trạm | Nhiều tủ và trạm ở nội thành được vẽ hoa (hướng dương, sen, loa kèn) từ khoảng 2020. Không tìm được nguồn trong lượt tra cứu này | [khá chắc] |
| Cột điện | Cột bê tông ly tâm tròn xám Ø 25–35 cm, cao 8–10 m, cách nhau 25–35 m, chủ yếu ở ngõ và phố nhỏ | [khá chắc] |
| Cột đèn phố chính | Cột thép bát giác 8–10 m, cần đơn hoặc đôi, cách nhau 30–35 m | [khá chắc] |
| Đèn phố cổ | Đèn gắn tường nhà hoặc cột thấp, cao 5–6 m | [khá chắc] |
| Đèn kiểu cổ | Cột gang đen hoặc xanh rêu cao 3,5–4 m, 1–4 chao cầu, quanh Hồ Gươm, Nhà hát Lớn, Tràng Tiền | [khá chắc] |

### 2.9 Loa phường

Các quận trung tâm đã cắt giảm mạnh: mỗi phường giữ khoảng 5–10 cụm loa, phát ngắn, chủ yếu thông báo
[chắc chắn][^41]. Tình trạng 2025–2026 không xác minh được. Gợi ý: cụm 2 loa nén hình phễu màu xám trên cột
điện cao 6–7 m, 1 cụm mỗi 300–400 m ở phố dân cư, không đặt trên trục du lịch [suy đoán].

### 2.10 Cờ, băng rôn, pa nô cổ động

- Cờ Tổ quốc đỏ `#DA251D` sao vàng `#FFFF00`, cỡ phổ biến 0,8 × 1,2 m, cán tre hoặc inox dài 2–2,5 m cắm
  nghiêng ở ban công tầng 2 hoặc ống sắt hàn sẵn trên tường. Ngày lễ gần như nhà nào mặt phố cũng treo
  [khá chắc]. Mặt nhà phía hồ ở Đông Kinh Nghĩa Thục treo cờ sau chỉnh trang [chắc chắn][^2].
- Phướn dọc 0,8 × 2,5 m treo đôi trên cột đèn (cờ Tổ quốc và cờ búa liềm) dọc Tràng Tiền, Đinh Tiên Hoàng,
  Điện Biên Phủ, Hùng Vương [khá chắc].
- Băng rôn ngang phố: vải đỏ chữ vàng in hoa, 0,8–1 m × hết bề rộng lòng đường, cao 5–6 m [khá chắc].
- Pa nô cổ động: khung thép 2 × 3 m đến 4 × 6 m ở ngã tư lớn và vườn hoa; tranh phẳng tông đỏ, vàng, xanh
  dương; chữ in hoa kiểu "NHIỆT LIỆT CHÀO MỪNG…" [khá chắc].
- Màn hình LED cỡ lớn dựng trên nền nhà "Hàm Cá Mập" cũ [chắc chắn][^2].

### 2.11 Mặt vỉa hè, bó vỉa, ô cây, nắp hố ga

Nguồn chính là thiết kế mẫu hè đường của Hà Nội (QĐ 4340/2014, đã được QĐ 1303/2019 thay thế; nội dung bản
2019 không đọc được nên các con số theo bản 2014) [chắc chắn về bản 2014][^36].

| Khu | Mặt lát | Màu gợi ý |
|---|---|---|
| Quanh Hồ Gươm | Đá granite tự nhiên (lát lại 2020, kể cả bồn hoa); kè hồ 1.452 m bằng bê tông cốt sợi đúc sẵn[^12] | Xám sáng `#B5B5B0` |
| Phố cổ, phố Pháp, Ba Đình, quanh Hoàng thành | Đá tự nhiên dày ≥ 3 cm (≥ 4 cm nếu cạnh > 30 cm), viên rộng 10–40 cm, dài 20–60 cm, mặt nhám; có nơi còn gạch terrazzo 20–40 cm | Đá xanh xám `#8C9296`; terrazzo xám lốm đốm |
| Phố nhỏ, ngõ, mép Tây Hồ | Gạch block tự chèn 10 × 20 × 6 cm | Đỏ gạch `#A8483A`, xám, vàng nhạt |
| Dải dẫn hướng người khiếm thị | Vàng sẫm, có gân dọc (dẫn hướng) hoặc chấm tròn (cảnh báo); quy định rộng ≥ 60 cm, thực tế hay gặp 30–40 cm | `#D8A200` |

- Bó vỉa: đá tự nhiên; kiểu đứng 18 × 22 cm hoặc 15 × 22 cm; kiểu vát 26 × 23 cm ở phố nhiều nhà dân. Đỉnh bó
  vỉa cao hơn mép lòng đường tối thiểu 12,5 cm; trước cửa nhà hạ còn khoảng 5 cm, vát xiên; tại vạch sang
  đường và điểm buýt hạ còn ≤ 2 cm, dốc không quá 1:12 [chắc chắn][^36]. Game đang dùng 16 cm: chấp nhận được.
- Ô cây: vuông cạnh ≥ 1,4 m (hè rộng 3–5 m) hoặc ≥ 1,6 m (hè > 5 m), viền đá xẻ 10 × 15 cm; mặt ô là đất,
  cỏ hoặc tấm đan [chắc chắn][^36].
- Trụ chắn: không có kiểu bollard cố định phổ biến. Phố đi bộ dùng hàng rào thép di động sơn trắng đỏ cao
  1,1 m; Đông Kinh Nghĩa Thục dùng bồn hoa họa tiết Khuê Văn Các và bồn hoa di động để ngăn xe
  [chắc chắn về bồn hoa][^2]; nơi khác [khá chắc].
- Nắp hố ga: gang tròn Ø 60–70 cm màu đen xám trên lòng đường; nắp chữ nhật composite hoặc bê tông của cáp
  viễn thông trên vỉa hè; cửa thu nước dọc bó vỉa có song gang 30 × 100 cm; nắp phải bằng mặt hè
  [chắc chắn về yêu cầu bằng mặt][^36]; kích thước [khá chắc].

## 3. Nhà cửa và mặt đứng theo khu

### 3.1 Phố cổ (nhà ống)

| Hạng mục | Thông số | Tin cậy |
|---|---|---|
| Ranh giới | Khoảng 82 ha, 79 phố, 83 ô phố. Bắc: Hàng Đậu; đông: Trần Nhật Duật, Trần Quang Khải; tây: Phùng Hưng; nam: Hàng Bông, Hàng Gai, Cầu Gỗ, Hàng Thùng | [chắc chắn][^37] |
| Bề rộng, chiều sâu | Mặt tiền 2–4 m (quy chế ghi điển hình 3–5 m), sâu 20–60 m, có nhà gần 100 m; cấm gộp hai nhà ống | [chắc chắn][^37][^38] |
| Chiều cao theo quy chế | Lớp mặt phố 1–3 tầng (6–12 m) hoặc 2–4 tầng (8–16 m); lớp sau 2–5 tầng (đến 20 m); dọc Trần Nhật Duật tới 5–7 tầng; cạnh di tích trong 10 m tối đa 2 tầng (8 m) | [chắc chắn][^37] |
| Thực tế | Xen kẽ nhà cổ 2 tầng mái ngói với nhà xây lại 4–6 tầng và khách sạn mini 6–9 tầng lùi vào trong. Gợi ý phân bố mặt phố: 2 tầng 25%, 3 tầng 30%, 4 tầng 25%, 5–6 tầng 20% | [suy đoán] |
| Màu tường | Bảng màu quy chế: nâu, vàng nhạt, trắng, xám, xanh rêu nhạt, hồng nhạt; cấm màu chói. Gợi ý: `#E9D9A6`, `#D8C9A3`, `#C9B28A`, `#BFC8B0`, `#E6CFC2`, `#D9D9D4`; phủ vệt mốc đen chảy dọc dưới ban công | [chắc chắn] bảng màu[^37]; hex [suy đoán] |
| Vật liệu cấm | Kính màu sẫm, kính phản quang, ốp đá hoặc gạch trang trí mặt tiền, tấm kim loại bóng, ngói men tối màu | [chắc chắn][^37] |
| Mái | Mái dốc ngói đỏ nâu ở nhà cổ; nhà xây lại mái bằng có tum, phủ tôn chống nóng màu đỏ hoặc xanh dương | [khá chắc] |
| Ban công, ô văng | Vươn tối đa 0,9 m (phố rộng 6–12 m) hoặc 1,2 m (phố > 12 m); phố < 6 m không được nhô; lan can gỗ hoặc bê tông hoa văn đơn giản, thực tế nhiều lan can sắt | [chắc chắn] quy chế[^37] |
| Tầng 1 | Mở hết bề rộng nhà làm cửa hàng; cửa cuốn tôn xám hoặc cửa xếp sắt; hàng hóa bày tràn 0,5–1,5 m ra hè | [khá chắc] |
| Quy tắc biển hiệu phố cổ | Chỉ đặt ở tầng 1, áp sát tường phía trên cửa, không gắn lên ban công hay mái đua; cao tối đa **0,8 m** (1 m ở quảng trường); không dùng mảng màu chói; không gắn đèn kín mặt đứng; chữ nước ngoài đặt dưới, nhỏ hơn chữ Việt | [chắc chắn][^37] |
| Mức tuân thủ | Vài tuyến đã chỉnh trang có biển đồng bộ nền nâu hoặc đỏ sẫm chữ vàng (Tạ Hiện, Lãn Ông); phần lớn phố còn biển to, nhiều màu, phủ cả tầng 2 | [khá chắc] |
| Quy định chung về biển hiệu | Biển ngang cao tối đa 2 m, không dài quá mặt tiền; biển dọc ngang tối đa 1 m, cao tối đa 4 m (Luật Quảng cáo 2012; chưa đối chiếu luật sửa đổi 2025) | [khá chắc] |
| Màu biển hiệu hay gặp | Nền đỏ chữ vàng hoặc trắng; nền vàng chữ đỏ; nền xanh dương chữ trắng; nền trắng chữ đỏ. Nội dung: tên hiệu (lớn), mặt hàng, địa chỉ, "ĐT" | [khá chắc] |
| Nghề theo phố (đã có trong game, để QC đối chiếu) | Hàng Mã: đồ giấy, đèn lồng; Hàng Bạc: bạc, đổi tiền; Hàng Gai: lụa; Hàng Đào, Hàng Ngang: quần áo; Hàng Đường: ô mai; Lãn Ông: thuốc bắc; Hàng Thiếc: đồ tôn; Hàng Bồ: phụ liệu may; Hàng Chiếu: chiếu, thừng; Hàng Buồm: bánh kẹo; Hàng Quạt: đồ thờ; Lương Văn Can: đồ chơi; Hàng Dầu: giày dép; Tạ Hiện: bia; Đinh Liệt: len | [khá chắc] |

### 3.2 Khu phố Pháp (nam và đông Hồ Gươm, Trần Hưng Đạo, Lý Thường Kiệt, Phan Chu Trinh, Ngô Quyền)

- Biệt thự 2–3 tầng, tầng cao 3,6–4,5 m, lô rộng 15–25 m, lùi sau sân trước 3–6 m; tường rào xây đặc 0,8 m
  phía dưới, song sắt phía trên, tổng cao 1,8–2,2 m; cổng sắt hai cánh rộng 3–4 m [khá chắc].
- Màu: tường vàng đất `#E3B448`–`#D9A441` (nhiều nhà bạc thành vàng kem `#EAD9A0`), phào chỉ và khung cửa
  trắng `#F4EFE2`, cửa chớp lá sách xanh lục `#2F5D3A` hoặc nâu `#5B3A29`; cửa sổ cao hẹp 1,0–1,2 × 2,0–2,4 m
  [khá chắc].
- Mái: ngói đỏ nâu `#9B4A32` dốc 30–45°, có ống khói và cửa mái; công sở lớn dùng mái mansard lợp đá phiến
  xám đen `#4A4F55` [khá chắc; Nhà hát Lớn lợp đá phiến đen là chắc chắn][^54].
- Đường: lòng đường 10–15 m, vỉa hè 4–6 m, cây lớn hai bên; nhiều biệt thự bị cơi nới, tầng 1 thành cửa
  hàng, ngân hàng, quán cà phê [khá chắc].

### 3.3 Ba Đình

- Công sở kiểu Pháp sơn vàng (Phủ Chủ tịch, Bộ Ngoại giao ở 1 Tôn Thất Đàm với mái ngói nhiều lớp kiểu Đông
  Dương) [khá chắc]; khối hiện đại kính và đá (Nhà Quốc hội) [chắc chắn][^50]; khối đá xám kiểu Xô viết
  (Lăng) [chắc chắn][^45].
- Mọi lô có tường rào vàng hoặc hàng rào sắt xanh rêu cao khoảng 2 m, bốt gác, biển "Cấm quay phim, chụp
  ảnh" ở một số cổng; vỉa hè rộng 5–8 m, rất ít hàng quán, không có ghế nhựa [khá chắc].
- Quảng trường Ba Đình: thảm cỏ dài khoảng 380 m chia 240 ô vuông, lối đi giữa các ô rộng khoảng 1,4 m; 79
  cây vạn tuế quanh Lăng; hai hàng tre phía bắc và nam; cột cờ trước Lăng cao khoảng 29 m [chắc chắn về 240 ô,
  79 cây vạn tuế, tre][^45]; [khá chắc] về bề rộng lối đi và cột cờ.

### 3.4 Khu tập thể

Trong khung bản đồ khu tập thể không nhiều, chủ yếu ở góc tây nam (Văn Chương, quanh Quốc Tử Giám, Tôn Đức
Thắng) và vài khối lẻ trong khu phố Pháp [khá chắc]. Hình dáng: khối tấm 4–5 tầng, dài 40–60 m, sâu 9–12 m,
vữa vàng đất loang mốc đen, mỗi căn một "chuồng cọp" sắt nhô 0,6–1,2 m, mái che tôn, bồn nước inox, tầng 1
thành cửa hàng, dây điện chằng chịt [khá chắc].

### 3.5 Công trình có tên trong khung bản đồ (hiện trạng 2026)

| Công trình | Vị trí | Tầng, chiều cao | Mặt bằng | Màu, vật liệu | Dấu hiệu nhận biết | Tin cậy |
|---|---|---|---|---|---|---|
| Tháp Rùa | Gò giữa Hồ Gươm | 3 tầng + đỉnh, khoảng 8,8 m | 6,28 × 4,54 m | Gạch trát xám nâu rêu | Cửa vòm nhọn, lỗ mọt, chòi vuông trên đỉnh | [khá chắc] |
| Cầu Thê Húc, Tháp Bút, đền Ngọc Sơn | Bờ đông bắc hồ | Cầu cong 15 nhịp, 32 cột gỗ; Tháp Bút 5 tầng đá, khoảng 9 m | Cầu dài khoảng 45 m, rộng 2,6 m | Cầu sơn đỏ `#C8102E` | Ba chữ "Tả Thanh Thiên" trên Tháp Bút | [khá chắc] |
| Tháp Hòa Phong | Vỉa hè Đinh Tiên Hoàng phía hồ, đối diện Bưu điện | 3 tầng gạch, khoảng 10 m | Khoảng 3 × 3 m | Gạch xám nâu | Tháp cổng 4 cửa vòm đứng lẻ loi | [chắc chắn] còn đó[^5]; kích thước [suy đoán] |
| Tràng Tiền Plaza | 24 Hai Bà Trưng | 6 tầng nổi + 1 hầm, khoảng 30 m | Chiếm trọn ô phố 4.346 m² giữa Tràng Tiền, Hàng Bài, Hai Bà Trưng | Trắng kem, mái vòm xám ở các góc | Mũi nhọn nhìn ra hồ; đêm viền đèn vàng | [chắc chắn] tầng, diện tích[^43]; còn lại [khá chắc] |
| Bưu điện Hà Nội | 75 Đinh Tiên Hoàng | Khối 5 tầng, khoảng 25 m | Khoảng 60 × 20 m | Vàng kem, mặt đứng sọc dọc | Tháp đồng hồ trên nóc, chữ "BƯU ĐIỆN HÀ NỘI" | [chắc chắn] được giữ lại[^5]; kích thước [suy đoán] |
| Sofitel Legend Metropole | 15 Ngô Quyền | Cánh cổ (1901) 4 tầng; cánh mới 7 tầng | Chiếm gần hết ô phố | Tường trắng, cửa chớp xanh lục, mái hiên sắt đen | Hiên cà phê vỉa hè, xe cổ, xích lô trưng bày trước cửa | [khá chắc][^65] |
| Ngân hàng Nhà nước | 49 Lý Thái Tổ | 3 tầng cao, khoảng 20 m (1930, Art Deco) | Khoảng 70 × 40 m | Xám đá rửa | Sảnh chính mái nhiều lớp, nhìn ra vườn hoa và đài phun nước | [khá chắc] |
| Bắc Bộ Phủ (Nhà khách Chính phủ) | 12 Ngô Quyền, 2 Lê Thạch | 2 tầng chính + áp mái (1918–1919; Wikipedia ghi "5 tầng" nếu tính hầm và áp mái) | Khoảng 50 × 25 m | Vàng kem, phào trắng, mái đá phiến xám | Mái sảnh kính sắt xòe hình quạt | [chắc chắn] năm[^47]; hình dáng [khá chắc] |
| Nhà hát Lớn | 1 Tràng Tiền | Đỉnh mái 34 m | 87 × 30 m | Vàng nhạt, trắng; mái đá phiến đen | Hàng cột Ionic, hai chóp mái hai bên | [chắc chắn][^54] |
| Bảo tàng Lịch sử Quốc gia | 1 Tràng Tiền (sau Nhà hát Lớn) | 2 tầng trên tầng trệt thấp 2,5 m (1926–1932) | Sảnh bát giác cạnh tới 11 m + cánh dài | Vàng đất, ngói đỏ nâu | Sảnh bát giác mái 3 lớp kiểu gác chuông chùa | [chắc chắn] hình khối[^48]; màu [khá chắc] |
| Hilton Hanoi Opera | 1 Lê Thánh Tông | 7 tầng | Mặt cong ôm Nhà hát Lớn | Kem, hàng cột | Mặt đứng cong lõm | [khá chắc] |
| Vietcombank Tower | 198 Trần Quang Khải | 22 tầng, khoảng 85–95 m | Mặt bằng cong, khoảng 45 × 35 m | Kính xanh lam, ốp nhôm xám trắng | Thân cong, biển hiệu xanh lá trên đỉnh | [khá chắc] số tầng[^57]; chiều cao [suy đoán] |
| BIDV Tower | 194 Trần Quang Khải | 25 tầng + 2 hầm, khoảng 100 m | Khoảng 40 × 35 m | Kính xanh, ốp đá sáng | Đứng sát Vietcombank Tower, thành cặp tháp ven đê | [chắc chắn] số tầng[^56]; chiều cao [suy đoán] |
| Hanoi Towers và di tích Hỏa Lò | 49 Hai Bà Trưng | Khối văn phòng 14 tầng; khối căn hộ đôi 27 tầng (1997) | Trọn ô Hai Bà Trưng, Quán Sứ, Thợ Nhuộm, Hỏa Lò | Be, kính nâu; tường Hỏa Lò đá xám vàng cao khoảng 4 m | Cổng vòm "MAISON CENTRALE" trên phố Hỏa Lò | [chắc chắn] số tầng[^44]; màu [khá chắc] |
| Melia Hanoi | 44B Lý Thường Kiệt | 22 tầng | Khoảng 50 × 30 m | Kính xanh lục, ốp trắng | Khối cao nhất đoạn Lý Thường Kiệt | [khá chắc] |
| Pacific Place | 83B Lý Thường Kiệt | 18–19 tầng | Khối đế + tháp | Kính xanh lam, đá be | Khối đế thương mại 4 tầng | [khá chắc] |
| Capital Tower | 109 Trần Hưng Đạo | Khoảng 23 tầng | Khoảng 40 × 40 m | Kính xanh đậm | Gần Ga Hà Nội | [khá chắc] |
| Nhà hát Hồ Gươm | 40 Hàng Bài | 6 tầng nổi + 3 hầm (mở 9/7/2023) | Khu đất khoảng 5.000 m² | Đá sáng, kính | 52 cột đá nguyên khối cao 18 m, mái vòm; cổng trại Bảo an binh cũ giữ bên cạnh | [chắc chắn][^49] |
| Nhà thờ Lớn | 40 Nhà Chung | Hai tháp chuông 31,5 m | 64,5 × 20,5 m | Vữa xám loang cũ | Đồng hồ giữa mặt tiền, tượng Đức Mẹ kim loại ở quảng trường | [chắc chắn] kích thước[^53]; màu [khá chắc] |
| Chợ Đồng Xuân | Phố Đồng Xuân | Khối chợ 3 tầng | Khoảng 110 × 60 m | Vàng nhạt, trắng | Ba vòm tam giác mặt tiền thời Pháp | [khá chắc] |
| Chợ Hàng Da | Góc Hàng Da, Phùng Hưng | 4–5 tầng nổi + 2 hầm (xây lại 2010) | Trọn ô phố | Vàng kem giả cổ, mái xám | Trung tâm thương mại vắng khách | [khá chắc] |
| Ô Quan Chưởng | Đầu phố Hàng Chiếu | 2 tầng, khoảng 9 m | Rộng khoảng 20 m | Gạch trần nâu đỏ | 3 cửa vòm, vọng lâu mái ngói; xe máy chạy xuyên qua | [khá chắc]; kích thước [suy đoán] |
| Ga Long Biên | 1 Gầm Cầu | Nhà ga ở cao độ cầu dẫn, khoảng 6 m trên phố | 500 m², lên bằng cầu thang 23 bậc | Vàng | Sân ga nằm ngay đầu cầu | [chắc chắn][^55] |
| Cầu Long Biên (đầu tây) | Từ Trần Nhật Duật ra sông | 19 nhịp dàn thép; mặt cầu rộng 13,5 m | Phần qua sông 2.290 m; cầu dẫn đá 896 m | Thép nâu gỉ lẫn mảng sơn xám | Vài nhịp gốc dàn cao nhấp nhô, nhịp thay thế dàn thấp | [chắc chắn][^20] |
| Cầu Chương Dương (đầu tây) | Từ Trần Nhật Duật, Trần Quang Khải | Dàn thép, mặt cầu 4 làn ô tô + 2 làn xe máy hai bên | Dài khoảng 1,2 km | Thép sơn xám xanh | Dàn thép đều nhịp, nút giao nhiều nhánh ở đầu cầu | [khá chắc] |
| Tháp nước (bốt) Hàng Đậu | Nút Hàng Đậu, Quán Thánh, Phan Đình Phùng | 3 tầng; thân 21 m, tới đỉnh mái khoảng 25 m (1894) | Trụ tròn Ø 19 m | Đá đục xám nâu, mái tôn hình nón | 54 ô cửa hẹp như lỗ châu mai | [chắc chắn][^51] |
| Cửa Bắc | Phan Đình Phùng | Cao 8,71 m | Rộng 17,08 m | Gạch đá xám nâu | Hai vết đạn pháo 1882 có bảng ghi ngày | [khá chắc] |
| Đoan Môn | Hoàng thành (Hoàng Diệu) | Thân cổng khoảng 6 m + lầu 2 tầng | Chữ U, dài khoảng 46,5 m | Gạch vồ và đá, lầu vàng mái ngói | 5 cửa vòm | [khá chắc] |
| Cột cờ Hà Nội | Điện Biên Phủ | 33,4 m, tính cả cán cờ hơn 40 m | Ba tầng đế vuông cạnh 42,5; 27; 12,8 m | Gạch xám nâu | Thân bát giác, cờ đỏ sao vàng lớn | [chắc chắn][^52] |
| Lăng Chủ tịch Hồ Chí Minh | Quảng trường Ba Đình | 21,6 m | Rộng 41,2 m | Đá granite xám `#8A8D8F`, chữ đỏ mận | Hàng cột vuông bốn mặt, 2 lính gác trước cửa | [chắc chắn][^45] |
| Phủ Chủ tịch | Hùng Vương | 3 tầng (1900–1906) | Khoảng 60 × 30 m | Vàng `#E3B448`, phào trắng | Cổng sắt, bốt gác hai bên, hàng xoài trong vườn | [chắc chắn] năm, màu[^46]; kích thước [suy đoán] |
| Nhà Quốc hội | 1 Độc Lập | 39 m, 5 tầng nổi + 2 hầm (2014) | 102 × 102 m | Đá be sáng, kính, kim loại màu đồng | Khối vuông ôm phòng họp tròn; quốc huy đồng 2,5 tấn giữa mặt chính | [chắc chắn][^50] |
| Bảo tàng Hồ Chí Minh | 19 Ngọc Hà | Khoảng 20 m | Khối vuông xoay 45° | Trắng | Dáng bông sen cách điệu | [khá chắc] |
| Chùa Một Cột | Sau Lăng | Trụ đá cao 4 m, Ø 1,2 m | Đài gỗ 3 × 3 m | Gỗ nâu, ngói đỏ | Chùa trên một trụ giữa ao vuông | [khá chắc] |
| Văn Miếu, Khuê Văn Các | 58 Quốc Tử Giám | Khuê Văn Các 2 tầng, khoảng 9 m | Khu hơn 54.000 m², tường bao khoảng 3 m | Gạch vồ đỏ nâu, gỗ sơn đỏ | Gác vuông trên 4 trụ gạch, cửa sổ tròn | [khá chắc] |
| Ga Hà Nội | 120 Lê Duẩn | 3 tầng | Dài khoảng 100 m | Hai cánh vàng kiểu Pháp, khối giữa bê tông sọc dọc | Chữ "GA HÀ NỘI" đỏ; rào công trường ga S12 trước mặt | [khá chắc] |
| Chùa Trấn Quốc | Đường Thanh Niên | Bảo tháp 11 tầng, 15 m | Lục giác | Gạch đỏ, tượng trắng | Mỗi ô tháp một tượng Phật | [khá chắc] |
| Sân Hàng Đẫy | Mép tây khung bản đồ | Khán đài khoảng 20 m, 4 cột đèn khoảng 40 m | Khoảng 190 × 130 m | Bê tông xám | 4 cột đèn cao nhìn thấy từ xa | [khá chắc] |

Ghi chú bắt buộc cho đội dựng:

- Mọi kích thước mặt bằng ghi "khoảng a × b m" mà không có chú thích nguồn là [suy đoán], kể cả khi cột tin
  cậy của dòng đó ghi [khá chắc] cho số tầng và màu. Lấy footprint thật từ dữ liệu bản đồ của game.
- **Không có** Lotte Center (272 m), Keangnam, Landmark 72 trong khung; chúng ở phía tây, cách mép bản đồ từ
  2 km. Nếu vẽ đường chân trời thì chỉ là bóng mờ phía tây [khá chắc].
- Trong khung không có tòa nào cao quá khoảng 110 m; cao nhất là Hanoi Towers (27 tầng) và BIDV Tower (25
  tầng) [khá chắc].
- Bảo tàng Lịch sử Quân sự ở 28A Điện Biên Phủ đã đóng cửa 30/9/2024 và chuyển ra đại lộ Thăng Long; khu đất
  cũ nhập vào Hoàng thành. Không xác minh được sân còn máy bay, xe tăng hay không: **đừng dựng** chiếc MiG và
  đống xác máy bay ngoài sân [chắc chắn về việc chuyển][^79][^52]; hiện trạng sân [không xác minh].

### 3.6 "Hàm Cá Mập" và quảng trường Đông Kinh Nghĩa Thục

| Câu hỏi | Trả lời | Tin cậy |
|---|---|---|
| Tòa nhà còn không? | **Không.** Tòa 6 tầng ở 1-3-5 Đinh Tiên Hoàng bị phá dỡ trong khoảng một tháng mùa hè 2025, xong đầu tháng 8/2025, cùng hai trạm điện; nền đất trống còn hơn 310 m² | [chắc chắn][^1] |
| Trên nền cũ có gì? | Một màn hình LED cỡ lớn làm điểm nhấn tuyên truyền | [chắc chắn][^2] |
| Quảng trường nay thế nào? | Khoảng 1,4 ha thông thoáng nối phố cổ với hồ; giữ nguyên cây cũ; nhiều ghế đá đặt quanh bồn hoa họa tiết Khuê Văn Các (bồn hoa đồng thời ngăn người đi bộ với dòng xe); đèn sang đường bấm nút | [chắc chắn][^2] |
| Nhà xung quanh | Mặt nhà 7-9 Đinh Tiên Hoàng (Hapro) được làm lại mặt đứng và tầng mái, treo cờ; nhà hàng Thủy Tạ 2 tầng bỏ phần cơi nới, phục hồi mái dốc như ban đầu; dân tự sửa mái hiên, mái dốc dãy nhà mặt phố | [chắc chắn][^1][^2] |
| Đài phun nước giữa nút | Vẫn là tâm vòng xuyến | [khá chắc] |
| Đinh Tiên Hoàng | Bãi đỗ xe trên phố đã dời; dải phân cách giữa được tổ chức lại (nguồn mâu thuẫn: bỏ hẳn hay sửa rồi lắp lại) | [chắc chắn] dời bãi[^1][^2] |
| "Khải hoàn môn" 36 m | Chỉ là **đề xuất** trong đồ án lấy ý kiến 7–26/9/2026, bị phản đối; chưa duyệt, chưa xây. Không dựng | [chắc chắn][^7][^8] |
| Giai đoạn 2 | Nghiên cứu không gian ngầm; ngày 28/10/2026 HĐND thành phố thông qua chủ trương dự án tái thiết quanh hồ khoảng 22.229 tỉ đồng, có trung tâm thương mại 4 tầng hầm, dự kiến xong 2029. Cuối 2026 chưa thấy tin khởi công phần ngầm | [chắc chắn][^6] |

## 4. Xe cộ năm 2026

| Hạng mục | Thông số | Tin cậy |
|---|---|---|
| Cơ cấu xe đăng ký trong Vành đai 1 (6/2026) | 511.418 xe máy (96,1% chạy xăng) và 58.272 ô tô (76,2% xăng; 20,4% dầu; 3,4% điện, hybrid). Tức khoảng 9 xe máy trên 1 ô tô | [chắc chắn][^13] |
| Toàn thành phố | Hơn 7 triệu xe máy, khoảng 1,1 triệu ô tô | [khá chắc] |
| Tỉ lệ trên đường (gợi ý cho AI giao thông) | Phố cổ: xe máy 80–85%, ô tô kể cả taxi 8–12%, xe đạp + xích lô + xe điện du lịch 4–6%, buýt ≤ 1%. Trục phố Pháp và Ba Đình: xe máy 70–75%, ô tô 20–25%, buýt 1–2% | [suy đoán] |
| Mẫu xe máy phổ biến | Honda chiếm khoảng 83–85% doanh số của hiệp hội VAMM. Xe ga: Honda Vision (bán chạy nhất), Air Blade, Lead, SH, SH Mode; Yamaha Janus, Grande. Xe số: Honda Wave Alpha, Wave RSX, Future, Dream cũ; Yamaha Sirius. Côn tay: Yamaha Exciter, Honda Winner X. Thêm Vespa và Super Cub cũ | [chắc chắn] thị phần, mẫu chủ lực[^58][^59] |
| Kích thước xe ga chuẩn | Dài 1,87 m, rộng 0,69 m, cao 1,10 m (Honda Vision) | [khá chắc] |
| Màu xe máy (gợi ý) | Đen 30%, trắng 20%, đỏ 15%, xám bạc 12%, xanh dương và xanh xám 10%, còn lại 13% (nâu, vàng cát, xanh ngọc) | [suy đoán] |
| Xe máy điện | Năm 2025 cả nước bán gần 700 nghìn xe điện trên tổng hơn 3,4 triệu xe hai bánh (khoảng 1/5 xe mới); VinFast bán 406.453 xe, vượt Yamaha lên thứ hai. Trong Vành đai 1 xe điện mới khoảng 4% số xe đăng ký. Gợi ý: 6–10% xe máy đang chạy là xe điện (không ống xả, không tiếng máy), học sinh đi xe điện nhỏ rất nhiều giờ tan trường | [chắc chắn] doanh số[^58]; tỉ lệ trên đường [suy đoán] |
| Xe ôm, giao hàng công nghệ | Bốn màu áo và mũ chủ đạo: xanh lá cây, vàng (viền đen), xanh ngọc lam (đi xe điện cùng màu), cam (giao đồ ăn, thùng hàng cam sau xe). Hãng áo đỏ pha xanh lá đã rời Việt Nam từ 9/2024 nên **không** còn màu này. Từ 2027 mới dự kiến hạn chế xe công nghệ chạy xăng trong vùng thí điểm | [khá chắc][^80][^13] |
| Taxi | Khoảng 14.300 taxi, gần 8.800 là xe điện (khoảng 61%); mục tiêu 100% vào 2030. Xe điện chủ yếu là hatchback và SUV cỡ nhỏ sơn xanh ngọc lam (gợi ý `#12C3B4`). Taxi xăng còn lại: sedan, MPV màu xanh lá đậm (gợi ý `#0B8F4D`), trắng hoặc bạc có sọc. Hộp đèn "TAXI" trên nóc, số điện thoại lớn bên sườn | [chắc chắn] số lượng[^60]; màu [khá chắc] |
| Xe buýt | Khoảng 130–140 tuyến, đến 4/2026 có 49 tuyến dùng năng lượng sạch. Màu theo nhóm: xanh dương đậm (xe lớn từ 55 chỗ của tổng công ty vận tải thành phố), xanh lá (xe nhỏ đến 30 chỗ và buýt điện), cam (tuyến sân bay), đỏ pha vàng (các tuyến còn lại, tuyến kế cận). Thân xe có hình chim bồ câu và Khuê Văn Các. Ưu đãi, miễn vé cho chuyến trong Vành đai 1 từ 1/7/2026 (hai nguồn ghi hạn khác nhau: 30/6/2027 và 30/6/2028). Kích thước gợi ý: xe lớn 12 × 2,5 × 3,2 m, xe vừa 9 m, xe nhỏ 7 m | [khá chắc] màu, số tuyến[^61]; [khá chắc] miễn vé[^13][^14]; kích thước [suy đoán] |
| Buýt hai tầng du lịch | Mui trần, sơn đỏ, chạy vòng Hồ Gươm, Nhà hát Lớn, Lăng, Văn Miếu | [khá chắc] |
| Xe điện du lịch phố cổ | Xe điện 4 bánh hở sườn, mỗi lượt chở 7–14 khách; bến ở đoạn đường đôi Đinh Tiên Hoàng sát Bờ Hồ; lộ trình mẫu: Đinh Tiên Hoàng, Hàng Đào, Hàng Ngang, Hàng Buồm, Mã Mây, Hàng Bạc, Hàng Đường, Đồng Xuân, Hàng Giấy, Quán Thánh, Nguyễn Biểu, Hoàng thành; khoảng 20 xe phục vụ tuyến nối Hoàng thành. Màu xe không xác minh được; gợi ý thân trắng kem, mui tối màu, dài 4–5 m, rộng 1,5 m | [chắc chắn] sức chứa, lộ trình[^64]; màu [suy đoán] |
| Xích lô | Ba bánh, khách ngồi trước dưới mui gập, người đạp phía sau; chạy Hàng Ngang, Hàng Đào, Hàng Bạc, Lãn Ông, quanh hồ và trước Nhà hát Lớn; hay đi thành đoàn 5–15 chiếc. Gợi ý: khung đen hoặc mạ sáng, đệm và mui đỏ sẫm, dài 2,6 m, rộng 1,1 m | [chắc chắn] địa bàn[^65]; hình dáng [khá chắc] |
| Xe đạp | Xe đạp công cộng: 44 trạm, 456 xe ở Hoàn Kiếm và Cửa Nam (xe trắng xanh lá, trạm là hàng trụ khóa trên vỉa hè); xe đạp điện công cộng thí điểm từ 12/2025. Xe đạp bán hoa: giỏ mẹt đường kính khoảng 0,8 m sau yên. Xe đạp thể thao theo tốp quanh Hồ Tây 5–7 giờ sáng | [chắc chắn] trạm[^14][^66]; còn lại [khá chắc] |
| Biển số | Xe máy: 190 × 140 mm, hai dòng, kiểu "29-B1" trên và "123.45" dưới. Ô tô: biển dài 520 × 110 mm hoặc biển ngắn 330 × 165 mm. Màu: trắng chữ đen (cá nhân); **vàng chữ đen** (xe kinh doanh vận tải: taxi, buýt, xe hợp đồng); xanh dương chữ trắng (cơ quan nhà nước, công an); đỏ chữ trắng (quân đội); trắng có chữ "NG" đỏ hoặc "NN" đen (ngoại giao, nước ngoài, gặp nhiều ở Ba Đình). Mã Hà Nội: 29, 30, 31, 32, 33, 40; đầu 80 là cơ quan trung ương | [chắc chắn] màu, mã[^62]; kích thước[^63] |

Luật chạy xe để AI mô phỏng: đi bên phải (riêng cầu Long Biên đi bên trái, mục 8); xe máy rẽ phải khi đèn đỏ
chỉ ở nơi có đèn phụ mũi tên xanh; bấm còi thường xuyên; người đi bộ băng qua chậm và đều, xe tự né [khá chắc].

## 5. Con người và nhịp phố theo giờ

| Khung giờ | Hồ Gươm, phố Pháp | Phố cổ | Ba Đình, Hồ Tây | Tin cậy |
|---|---|---|---|---|
| 4:30–7:00 | Người cao tuổi tập dưỡng sinh, thái cực quyền, quạt, kiếm gỗ; nhóm aerobic và khiêu vũ theo loa kéo; cầu lông, đá cầu trên lối dạo; chạy bộ vòng hồ. Đông nhất 5–7 giờ, 9 giờ thì thưa | Chợ sớm, gánh hàng, hàng phở, xôi mở từ 5:30; cửa cuốn kéo lên dần | Lễ thượng cờ ở Lăng lúc 6 giờ (mùa lạnh 6:30); xe đạp vòng Hồ Tây | [chắc chắn] tập sáng[^73][^74]; giờ thượng cờ [khá chắc] |
| 7:00–9:00 | Cao điểm xe máy; công chức, học sinh; cà phê vỉa hè kín ghế | Phụ huynh chở con; hàng ăn sáng đông nhất | Xe biển xanh, xe ngoại giao; khách xếp hàng vào Lăng (Lăng mở sáng thứ 3, 4, 5, 7, CN) | [chắc chắn] lịch Lăng[^45]; còn lại [khá chắc] |
| 9:00–11:30 | Khách du lịch theo đoàn, chụp áo dài ở Nhà thờ Lớn, Tràng Tiền | Buôn bán cao điểm, xe chở hàng, xích lô đoàn | Khách tham quan Văn Miếu, Hoàng thành | [khá chắc] |
| 11:30–13:30 | Dân văn phòng ăn trưa, trà đá | Quán bún chả, cơm bình dân kín chỗ; vỉa hè đầy ghế nhựa | Vắng | [khá chắc] |
| 13:30–17:00 | Vắng nhất mùa hè; người bán rong nghỉ dưới bóng cây | Chủ hàng ngủ trưa trên ghế gấp | Vắng | [khá chắc] |
| 17:00–19:30 | Cao điểm chiều, tắc ở Tràng Tiền, Hàng Bài, Trần Hưng Đạo | Bia hơi, quán nướng dọn bàn ra hè; từ 19 giờ xe rác đi thu | Hạ cờ ở Lăng 21 giờ; người đi bộ, tập thể dục ở quảng trường | [khá chắc] |
| 19:30–23:00 | Dạo hồ, ăn kem Tràng Tiền; cuối tuần là phố đi bộ | Tạ Hiện, Lương Ngọc Quyến, Mã Mây kín khách (30–50% là khách nước ngoài); cuối tuần có chợ đêm | Đường Thanh Niên: hẹn hò, bánh tôm, thuyền đạp nước; đảo Ngũ Xã: phố ẩm thực đêm | [khá chắc]; Ngũ Xã[^78] |
| 23:00–4:30 | Vắng, xe rửa đường, taxi | Quán đóng dần sau 24 giờ; hàng phở đêm, xe ôm đợi khách | Vắng | [khá chắc] |

Trang phục và đạo cụ người:

- Mũ bảo hiểm nửa đầu, đủ màu, là bắt buộc; trẻ em ngồi trước hoặc kẹp giữa hai người lớn [khá chắc].
- Mùa hè (5–9): nữ đi xe máy mặc áo chống nắng dài tay có mũ trùm, váy quây chống nắng, khẩu trang vải, kính
  râm, găng tay; nam áo phông, áo sơ mi. Mùa đông (12–2): áo phao, áo khoác tối màu, khăn, áo mưa cánh dơi
  nhiều màu khi mưa phùn [khá chắc].
- Khẩu trang: khoảng 40–60% người đi xe máy đeo, nhiều hơn vào ngày ô nhiễm mùa đông [suy đoán].
- Nón lá: người bán rong, công nhân vệ sinh, người làm vườn hoa; ít thấy ở người đi đường thường [khá chắc].
- Mũ cối xanh rêu trên đầu đàn ông lớn tuổi, xe ôm truyền thống [khá chắc].
- Áo dài: chụp ảnh quanh hồ, Nhà thờ Lớn, Phan Đình Phùng, nhiều nhất vào mùa thu và trước Tết [khá chắc].
- Đồng phục: cảnh sát giao thông màu vàng cát; công nhân môi trường áo xanh lá hoặc cam có dải phản quang
  và nón lá; học sinh áo trắng, khăn quàng đỏ; bảo vệ áo xanh dương [khá chắc].
- Khách du lịch: khách Tây ba lô, khách Hàn, Trung đi đoàn có cờ hướng dẫn. Gợi ý 20–30% người đi bộ ở lõi
  phố cổ và quanh hồ [suy đoán].

Người bán hàng:

- Quang gánh: đòn tre 1,4–1,6 m, hai thúng hoặc mẹt Ø 45–50 cm treo bằng quang mây; hàng là hoa quả theo mùa,
  bánh rán, tào phớ, xôi [khá chắc]. Một số gánh hàng nay có mã QR thanh toán treo ở quang [khá chắc][^81].
- Xe đạp hoa: mẹt hoa theo tháng (loa kèn tháng 4, sen tháng 6–7, cúc họa mi tháng 11, đào và violet trước
  Tết) [khá chắc].
- Trà đá: một bàn nhựa thấp hoặc khay, phích, ấm, cốc thủy tinh, lọ kẹo lạc, điếu cày; 6–12 ghế nhựa đỏ
  hoặc xanh dương cao 22–26 cm; đặt sát tường, gốc cây hoặc cổng cơ quan [khá chắc].
- Bia hơi: bàn nhựa hoặc inox thấp, ghế nhựa đỏ, két bia, cốc thủy tinh xanh nhạt có bọt khí [khá chắc].
- Xe đẩy: bánh mì, ngô và khoai nướng (mùa đông), nước mía, kem; thợ sửa xe với bơm và chậu nước ở góc phố
  [khá chắc].

Phố đi bộ và chợ đêm:

| Hạng mục | Thông số | Tin cậy |
|---|---|---|
| Lịch phố đi bộ quanh hồ | Từ 19 giờ thứ Sáu liên tục đến 24 giờ Chủ nhật hằng tuần (mùa đông mở từ 18 giờ thứ Sáu); dịp lễ kéo dài hoặc mở sớm; có tuần tạm dừng (ví dụ 13–20/3/2026 vì bầu cử). Wikipedia lại ghi "ba buổi tối 19–24 giờ" | [khá chắc][^15][^16][^17] |
| Phố trong vùng đi bộ quanh hồ | Đinh Tiên Hoàng, Hàng Khay, Lê Thái Tổ, Lê Lai, Lê Thạch, Trần Nguyên Hãn, Đinh Lễ, Nguyễn Xí, Tràng Tiền (Nhà hát Lớn đến Hàng Bài), Lò Sũ, Hàng Dầu, phố Hồ Hoàn Kiếm, Lương Văn Can (đoạn nam), Hàng Bài (đến Hai Bà Trưng), Bảo Khánh | [chắc chắn][^15] |
| Phố đi bộ phố cổ | 19–24 giờ thứ Sáu, Bảy, Chủ nhật: Hàng Đào, Hàng Ngang, Hàng Đường, Đồng Xuân (trục chợ đêm), Hàng Buồm, Mã Mây, Tạ Hiện, Lương Ngọc Quyến, Đào Duy Từ, Hàng Giầy; mở rộng từ cuối 2020: Đinh Liệt, Gia Ngư, Cầu Gỗ, Hàng Bè, Hàng Bạc, Ô Quan Chưởng và vài ngõ | [chắc chắn] phần mở rộng[^15]; nhóm đầu [khá chắc] |
| Vùng phát thải thấp trùng lịch | Từ 1/7 đến 31/12/2026, 19–24 giờ thứ Sáu, Bảy, Chủ nhật, cấm xe máy và ô tô (trừ xe quân đội, công an) trong "khu vực 1" quanh hồ và trục chợ đêm; bắt đầu áp dụng thực tế từ tối 3/7/2026 | [chắc chắn][^14] |
| Rào chắn | Hàng rào thép di động và người gác ở mỗi đầu phố dẫn vào; xe máy gửi kín vỉa hè các phố vòng ngoài (Lý Thái Tổ, Hai Bà Trưng, Hàng Trống) | [khá chắc] |
| Hoạt động | Trẻ em thuê ô tô điện và xe thăng bằng trên Đinh Tiên Hoàng; đá cầu, nhảy dây, kéo co; nhóm nhạc đường phố mỗi 50–100 m; vẽ chân dung; tò he; bóng bay. Ngày thường 3–5 nghìn người, tối cuối tuần 15–20 nghìn | [chắc chắn] số người[^15]; hoạt động [khá chắc] |
| Chợ đêm phố cổ | Tối thứ Sáu, Bảy, Chủ nhật, từ khoảng 18–19 giờ đến 23–24 giờ, dọc Hàng Đào, Hàng Ngang, Hàng Đường đến cổng chợ Đồng Xuân (gần 1 km); hai dãy sạp khung thép 2 × 2 m mái bạt giữa lòng đường, lối đi hai bên; bán quần áo, đồ lưu niệm, đồ ăn vặt | [khá chắc] |
| Đảo Ngũ Xã (Trúc Bạch) | Phố ẩm thực đêm kết hợp đi bộ trên hai phố Ngũ Xã và Nguyễn Khắc Hiếu, mở từ cuối 2022. Giờ hoạt động 2026 không xác minh được | [chắc chắn] có tồn tại[^78] |

## 6. Cây xanh theo phố

Quy tắc chung: cây thành hàng cách nhau 5–10 m, thân cách mép bó vỉa 1,0–1,2 m, không trồng trong 10 m gần
ngã tư; cây trồng mới có đường kính thân từ 15 cm, cao 6–8 m [chắc chắn][^36]. Gốc quét vôi trắng cao 1–1,3 m;
mỗi cây có thẻ số nhỏ đóng ở độ cao khoảng 2 m [khá chắc].

| Phố, khu | Loài hiện có | Định hướng công bố 10/2026 | Tin cậy |
|---|---|---|---|
| Phan Đình Phùng | Sấu cổ thụ (đoạn Mai Xuân Thưởng đến Cửa Bắc, vỉa hè phía nam có hai hàng); nhội (đoạn Cửa Bắc đến Hàng Đậu) | Giữ nguyên, có thể thêm cỏ nhung, nguyệt quế dưới gốc | [chắc chắn][^67] |
| Hoàng Diệu | Xà cừ cổ thụ (thân Ø 1–1,5 m, cao 25–30 m) | Bổ sung quếch, thàn mát; dải giữa trồng cây sang, chuông vàng | [chắc chắn][^67]; kích thước [khá chắc] |
| Trần Phú, Lê Hồng Phong | Sấu | | [chắc chắn] Lê Hồng Phong[^67] |
| Điện Biên Phủ | Xà cừ, sấu | Cây sang, sao đen, hoa theo mùa | [chắc chắn] định hướng[^67]; hiện có [khá chắc] |
| Hùng Vương | Cây bóng mát lớn hai bên | Dầu rái, thảm cỏ nhung | [chắc chắn] định hướng[^67] |
| Trần Hưng Đạo, Hai Bà Trưng | Sấu, nhội | Giữ, thêm cây bụi và hoa thấp | [khá chắc] |
| Lý Thường Kiệt | Sấu, cơm nguội vàng | | [khá chắc] |
| Bà Triệu | Chẹo, sấu | Sấu, lộc vừng, lát hoa | [chắc chắn] định hướng[^67]; chẹo [khá chắc] |
| Quán Sứ | Sấu, bằng lăng | | [khá chắc] |
| Nguyễn Du (mép nam khung) | Hoa sữa | Thêm hoặc thay bằng sao đen (đang gây tranh luận) | [chắc chắn][^67][^68] |
| Quanh Hồ Gươm | Lộc vừng nghiêng ra mặt nước (hai cây cổ nổi tiếng), liễu, sấu, bằng lăng, phượng, muồng hoàng yến, đa, si, sưa, một cây gạo cổ cạnh đền Ngọc Sơn | Lộc vừng, sấu, bằng lăng, thêm cây leo và hoa theo mùa | [chắc chắn][^67][^70] |
| Đường Thanh Niên | Phượng, liễu, bằng lăng | Phượng và ban trắng; dải giữa tường vi | [chắc chắn] định hướng[^67] |
| Phố cổ | Cây thưa và nhỏ: bàng, sữa, bằng lăng, đa, si mọc sát tường; nhiều đoạn 50–100 m không có cây | | [khá chắc] |
| Quanh Lăng | 79 cây vạn tuế, tre, hai cây đại | | [chắc chắn][^45] |

Dấu vết bão Yagi (7/9/2024): hơn 40 nghìn cây gãy đổ toàn thành phố; các phố trong khung bị nặng gồm Phan
Đình Phùng, Hoàng Diệu, Điện Biên Phủ, Đinh Tiên Hoàng, Lê Thái Tổ, Thanh Niên, Cửa Bắc, Hàng Bông
[chắc chắn][^69]. Thể hiện trong game: hàng cổ thụ có chỗ trống, xen cây non Ø 15–20 cm có 3–4 cọc chống
[khá chắc].

Lịch hoa và lá (gợi ý cho hệ thống mùa) [khá chắc]:

| Tháng | Hiện tượng | Nơi thấy rõ trong khung |
|---|---|---|
| 1–2 | Đào hồng, quất vàng trên xe máy; bàng trụi lá | Phố cổ, Hàng Lược |
| 3 | Hoa gạo đỏ, hoa sưa trắng, lộc vừng thay lá vàng đỏ | Bờ hồ cạnh đền Ngọc Sơn, quanh Lăng |
| Cuối 3–4 | Sấu trút lá vàng và ra lộc xanh non cùng lúc; xà cừ rụng lá; hoa loa kèn trên xe đạp | Phan Đình Phùng, Trần Phú, Hoàng Diệu |
| 5–6 | Phượng đỏ, bằng lăng tím, muồng hoàng yến vàng | Thanh Niên, quanh hồ, Lý Thường Kiệt |
| 6–7 | Sen | Mép Hồ Tây |
| 10–11 | Hoa sữa trắng xanh (mùi nồng ban đêm), cúc họa mi; lộc vừng nở hoa đỏ rủ | Nguyễn Du, Quán Thánh, bờ hồ |
| 11–12 | Cơm nguội vàng lá; bàng lá đỏ | Lý Thường Kiệt, phố cổ |

Mép nước:

- Hồ Gươm: kè bê tông cốt sợi đúc sẵn dài 1.452 m, mép thấp sát mặt nước, không có lan can; đường dạo và bồn
  hoa lát granite; có hệ thống tưới tự động, ghế ngồi, vòi nước uống; cáp điện chiếu sáng đã đi ngầm
  [chắc chắn][^12]. Nước xanh lục đục (gợi ý `#5E7F4E`) [khá chắc].
- Từ 8/10 đến 2/12/2026 ở vườn hoa bờ tây (dọc Lê Thái Tổ, tây nam Tháp Rùa) có công trình tạm "Dải lụa ký
  ức": cầu cạn khung sắt, sàn gỗ, nâng nhẹ khỏi mặt đất, uốn lượn giữa các thân cây, kèm khung gương và đèn;
  sau đó tháo dỡ [chắc chắn][^10][^11]. Game lấy mốc cuối 2026 có thể dựng như sự kiện theo mùa.
- Đường Thanh Niên: hè hai bên sát nước, lan can thấp, dải phân cách có cây; Trúc Bạch có thuyền đạp vịt
  [khá chắc].

## 7. Ánh sáng và không khí

| Mùa | Trời và tầm nhìn | Ánh sáng | Gợi ý tham số |
|---|---|---|---|
| Đông (11–1) | Trời xám trắng, nhiều ngày mù bụi; đợt nặng AQI trên 150–200, sáng sớm có lúc gần 300; tầm nhìn 2–5 km | Mặt trời mờ như đĩa, bóng đổ nhạt; mọc khoảng 6:25, lặn khoảng 17:20 | Sương bắt đầu 150–300 m, mờ hẳn 2–3 km, màu `#C9CCCF`; cường độ nắng 40–60% |
| Xuân (2–4) | Mưa phùn, nồm ẩm, mặt đường và tường ướt bóng; trời thấp xám | Ánh sáng phẳng, không bóng | Tăng độ bóng mặt đường; sương 300–500 m, mờ hẳn 3–4 km |
| Hè (5–8) | Nắng gắt 33–38°C, trời xanh nhạt hơi trắng, mây dông chiều, mưa rào ngắn | Bóng gắt, tương phản cao; mọc khoảng 5:15, lặn khoảng 18:40 | Sương 800 m trở ra, mờ hẳn 8–10 km; sau mưa đường đọng nước |
| Thu (9–10) | Trời trong nhất năm, xanh lam, gió nhẹ | Nắng vàng mật, bóng dài | Màu nắng `#FFD9A0`; sương từ 1 km, mờ hẳn 10 km trở lên |

- Chất lượng không khí: PM2.5 trung bình năm khoảng 45–47 µg/m³ (2024); tháng 12/2025 nhiều ngày ở mức xấu,
  31/12/2025 AQI 186 [chắc chắn][^71][^72]. Mô tả trời theo mùa và giờ mặt trời mọc, lặn là [khá chắc]; các
  tham số sương, cường độ nắng là [suy đoán].
- Hoàng hôn: mặt trời đỏ cam chìm trong lớp mù trước khi tới chân trời; trời chuyển cam hồng `#F2A65A` rồi
  tím xám `#8E7F9B` trong khoảng 20–25 phút [khá chắc].
- Đèn đường: trục chính dùng LED trắng trung tính đến trắng lạnh (4000–5000 K), ngõ và phố nhỏ còn đèn sodium
  vàng cam (2000–2200 K) [suy đoán]. Không tìm được số liệu tỉ lệ chuyển đổi; năm 2026 có dự án nâng cấp
  chiếu sáng trên nhiều trục, đặt rào chắn ban đêm từ 30/5 đến 30/8/2026 [khá chắc].
- Ánh sáng cửa hàng: tuýp LED trắng lạnh 6500 K hắt ra vỉa hè; biển hộp đèn đỏ, vàng, xanh; quán bia và cà
  phê dùng dây bóng vàng ấm [khá chắc].
- **Hồ Gươm từ 28/8/2026 có hệ chiếu sáng trang trí mới**: hơn 3.000 bộ đèn LED, bật theo chuỗi từ cây đa
  sang Tháp Rùa rồi cầu Thê Húc, tháp Hòa Phong, đền Bà Kiệu, Tháp Bút, và một vòng sáng chạy theo bờ kè.
  Nhiệt độ màu đổi theo mùa: vàng ấm mùa đông, trắng mát mùa hè, trung tính xuân và thu
  [chắc chắn][^9]. Gợi ý: đông 2700–3000 K, hè 5000–5700 K, xuân thu 4000 K [suy đoán].
- Công trình chiếu sáng đêm: Tháp Rùa (vàng ấm), cầu Thê Húc (đỏ), Nhà hát Lớn (vàng ấm), Tràng Tiền Plaza
  (viền bóng vàng), Nhà thờ Lớn (trắng ấm), Lăng (trắng), Cột cờ, Nhà Quốc hội (sáng từ trong qua kính)
  [khá chắc]. Cầu Long Biên chỉ có đèn đường thưa, tối [suy đoán].
- Phố đèn lồng: Hàng Mã treo đèn lồng đỏ, đèn ông sao kín mặt tiền, đỉnh điểm trước Trung thu và Tết; đèn
  lồng lụa nhiều màu ở quán trên Mã Mây, Hàng Bạc, Tạ Hiện; dây đèn LED trên cây dọc Tràng Tiền và Đinh
  Tiên Hoàng dịp lễ [khá chắc].

## 8. Hạ tầng thay đổi đến 2026 trong khung bản đồ

| Hạng mục | Hiện trạng cuối 2026 | Dựng trong game | Tin cậy |
|---|---|---|---|
| Metro đang chạy | **Không có ga nào đang hoạt động trong khung.** Ga Cát Linh (tuyến 2A) nằm ngoài mép tây khoảng 250 m; đoạn trên cao tuyến 3 (Nhổn đến Cầu Giấy) ở xa phía tây | Không dựng ga, không có tàu | [khá chắc] |
| Tuyến 3 đoạn ngầm (4 km, ga S9–S12) | Đào hầm xong: máy thứ nhất về đích 1/12/2025, máy thứ hai 13/4/2026; khối lượng phần ngầm khoảng 76% (2/2026); hạn dự án 2027, chưa chạy tàu. Trong khung có **S11 Văn Miếu** (rào trên phố Quốc Tử Giám, đã thu hẹp 100 m, trả lại 7–9 m lòng đường) và **S12 Ga Hà Nội** (rào trên Trần Hưng Đạo trước ga, đã thu hẹp 1–2 m, mặt ngoài rào ốp tấm trang trí). S10 Cát Linh nằm sát ngoài mép tây | Rào tôn cao 2–2,5 m chiếm một phần lòng đường ở hai vị trí, cần cẩu, cổng công trường; mặt rào có tranh trang trí | [chắc chắn][^24][^25]; chiều cao rào [suy đoán] |
| Tuyến 2 (Nam Thăng Long - Trần Hưng Đạo) | Khởi công 9/10/2025 tại depot (ngoài khung), mục tiêu 2030. Ga trong khung theo thiết kế: C8 (Hàng Đậu), C9 (dưới Đinh Tiên Hoàng, 4 tầng ngầm, khoảng 7.700 m²), C10 (nút Trần Hưng Đạo - Hàng Bài). Không tìm thấy tin đã rào thi công các ga này tính đến 11/2026 | Không dựng rào cho C8, C9, C10 | [chắc chắn] thiết kế[^26][^27]; chưa rào [không xác minh] |
| Quảng trường Đông Kinh Nghĩa Thục | Xem mục 3.6 | Không có "Hàm Cá Mập"; có màn hình LED, ghế đá, bồn hoa | [chắc chắn][^1][^2] |
| Quảng trường, công viên phía đông hồ | Khu 2,14 ha giữa Đinh Tiên Hoàng, Lý Thái Tổ, Trần Nguyên Hãn và dãy nhà dân phía bắc. Giải tỏa từ cuối 2025; đã phá khách sạn Điện Lực 9 tầng, trụ sở điện lực Hoàn Kiếm, dãy nhà mặt Đinh Tiên Hoàng (có hàng phở cũ). Được giữ hoặc xem xét giữ: tòa nhà Sở Văn hóa và Thể thao, Viện Văn học, một tòa Art Deco của ngành điện. Bưu điện, tháp Hòa Phong, trụ sở HĐND - UBND, Ngân hàng Nhà nước ở xung quanh vẫn còn. **Ngày 11/11/2026**: một phần rào đã tháo, lộ các khoảng sân lát đá rộng và hàng cây; nơi khác máy xúc, xe lu còn san nền, công nhân dựng kết cấu tre trang trí | Bãi phẳng lát đá xám một phần, một phần đất san, rào tôn ở phía Lý Thái Tổ, vài tòa cũ còn lại đứng lẻ; không có nhà cao tầng | [chắc chắn][^3][^4][^5] |
| Tầng ngầm phía đông hồ | Mới ở mức chủ trương (3–4 tầng hầm, nối ga C9), dự kiến xong 2029 | Không dựng hố đào | [chắc chắn][^4][^6] |
| Trụ sở UBND mới 9 tầng, tháp tài chính, bảo tàng mới ven hồ | Chỉ là đề xuất gây tranh luận tháng 9/2026 | Không dựng | [chắc chắn][^8] |
| Vùng phát thải thấp | Giai đoạn 1 từ 1/7 đến 31/12/2026 ở phường Hoàn Kiếm. Khu vực 1 (quanh hồ và phố cổ phía đông, giới hạn bởi Tràng Tiền, Hàng Khay, Lê Thái Tổ, Hàng Đào, Hàng Ngang, Hàng Buồm, Mã Mây, Hàng Bạc, Hàng Mắm, Nguyễn Hữu Huân, Lý Thái Tổ, Ngô Quyền): cấm xe máy, ô tô 19–24 giờ thứ Sáu đến Chủ nhật. Khu vực 2 (cả phố cổ, trong vòng Hàng Đậu, Phùng Hưng, Tràng Thi, Hàng Khay, Tràng Tiền, Trần Quang Khải, Trần Nhật Duật): mới khuyến khích, **chưa cấm** xe máy xăng ngày thường. Cấm xe máy xăng không đạt chuẩn trong cả Vành đai 1 lùi sang 1/1/2028 | Ngày thường xe xăng vẫn chạy bình thường; chỉ đóng phố tối cuối tuần | [chắc chắn][^13][^14] |
| Cầu Long Biên: luật đi | Mặt cầu chỉ cho **xe máy, xe thô sơ, người đi bộ**; ô tô không được lên. Xe **đi bên trái** (ngược cả nước): lối lên từ phía Hoàn Kiếm nằm bên trái đường sắt. Mỗi bên một làn rộng 2,6 m, lề đi bộ khoảng 0,4 m lát tấm đan; đường sắt đơn ở giữa | Spline hai làn hẹp, hướng xe đảo trái, tốc độ 20–30 km/h | [chắc chắn][^20][^18] |
| Cầu Long Biên: đóng mở | Cấm xe 1/11–31/12/2025, mở lại 1/1/2026; cấm tiếp 28/3–27/5/2026 để sửa lối đi bộ và làn xe máy; thông xe lại từ 0 giờ 28/5/2026 theo phương án cũ | Cuối 2026: mở cho xe máy | [chắc chắn][^18][^19] |
| Đường sắt qua phố | Tháng 2/2026 Bộ Xây dựng và thành phố thống nhất dừng tàu hàng, giảm tàu khách đoạn Ga Hà Nội - Long Biên - Gia Lâm và chuyển hạ tầng (kể cả cầu Long Biên) cho thành phố để chỉnh trang; mục tiêu chốt trước 1/7/2026. **Không xác minh được** đến 11/2026 tàu khách còn chạy mấy chuyến | Gợi ý: tàu khách rất thưa (1–2 chuyến mỗi buổi tối), không có tàu hàng | [chắc chắn] chủ trương[^21][^22]; hiện trạng [không xác minh] |
| Cầu dẫn đá và 131 vòm | Cầu dẫn 896 m đỡ đường sắt trên cao dọc Gầm Cầu, Phùng Hưng; 131 ô vòm đá, thành phố định khai thác làm văn hóa, dịch vụ. Đoạn Phùng Hưng (Hàng Cót đến Lê Văn Linh) có 19 vòm vẽ bích họa từ 2018 | Vòm bán nguyệt đá xám nâu, phần lớn xây bịt; 19 vòm có tranh | [chắc chắn] số vòm, chiều dài[^20][^21]; bích họa [khá chắc] |
| "Phố cà phê đường tàu" | Đoạn Điện Biên Phủ, Trần Phú, Phùng Hưng (trong khung): nhà 2–3 tầng cách ray 1,5–2 m, quán cà phê hai bên. Công an từng dựng rào ở các lối vào từ Trần Phú, Phùng Hưng, Điện Biên Phủ và cắm biển cấm tụ tập (đợt gần nhất khoảng 9/2025); 3/2026 lại chấn chỉnh; nhưng 8/2026 quán vẫn mở đón khách | Rào sắt và biển cấm ở lối vào từ Trần Phú, Phùng Hưng, Điện Biên Phủ; bên trong vẫn có bàn ghế, đèn lồng, khách | [chắc chắn] quán còn mở 8/2026[^21][^23]; ngày dựng rào [khá chắc] |
| Cầu Trần Hưng Đạo (mới) | Đang thi công từ cuối 2025, lắp dầm thép từ 8/2026, đích 2027; rào chắn và phân luồng quanh Trần Khánh Dư đến hết 30/12/2026. Đầu cầu ở sát mép đông nam khung bản đồ, có thể nằm ngay ngoài khung | Nếu chạm khung: rào công trường và cần cẩu ở cuối phố Trần Hưng Đạo | [chắc chắn][^28][^29] |
| Vỉa hè, trật tự đô thị | Ra quân mạnh từ 11/2025 (phường Hoàn Kiếm xử lý 2.425 trường hợp đến 27/3/2026), phạt nguội qua camera | Xem mục 2.5 | [chắc chắn][^76] |
| Rác | Bỏ điểm tập kết ban ngày, thu sau 19 giờ | Xem mục 2.7 | [chắc chắn][^40] |
| Dây cáp | Kế hoạch 2026: thanh thải, bó gọn cáp treo toàn thành phố; phường Ba Đình có 6 dự án hạ ngầm phải xong trước 30/6/2026; hơn 450 phố đã hạ ngầm nhưng ngõ nhỏ vẫn chằng chịt | Phố chính Ba Đình và quanh hồ không có dây; ngõ và phố cổ nhỏ có dây | [chắc chắn] kế hoạch[^42]; từng phố [suy đoán] |
| Địa giới hành chính | Bỏ cấp quận từ 1/7/2025 | Biển trụ sở ghi "UBND PHƯỜNG HOÀN KIẾM"; không còn biển "UBND QUẬN" | [chắc chắn][^75] |
| Bảo tàng Lịch sử Quân sự cũ | Đóng 30/9/2024, đất nhập về Hoàng thành | Không dựng sân trưng bày máy bay | [chắc chắn][^79] |

## 9. Âm thanh theo giờ (cho đội âm thanh)

| Khung giờ | Âm đặc trưng | Ghi chú dựng |
|---|---|---|
| 4:30–6:30 | Chổi tre quét đường; chim; nhạc dưỡng sinh và nhạc khiêu vũ từ loa kéo quanh hồ; tiếng đếm nhịp tập; quả cầu lông, cầu đá; xe đạp; tiếng cửa cuốn sắt kéo lên | Loa kéo là nguồn điểm, nghe trong bán kính 40–60 m |
| 6:00 | Quốc ca trong lễ thượng cờ ở quảng trường Ba Đình (mùa lạnh 6:30) | Một lần mỗi ngày; 21 giờ hạ cờ |
| 6:30–9:00 | Nền xe máy rì rào liên tục (tay ga 110–125 cc, đều, không gầm), còi ngắn dồn dập, còi hơi xe buýt, tiếng phanh; tiếng bát đũa hàng phở; loa phường (nếu còn) phát ngắn | Còi: 1 tiếng mỗi 3–6 giây ở ngã tư đông |
| Cả ngày | Tiếng rao thu sẵn từ loa trên xe đạp, xe máy: "bánh khúc", "bánh mì nóng giòn", "ai đồng nát… ti vi, tủ lạnh hỏng bán đi"; tiếng kéo cắt tóc, máy khoan, máy cắt sắt từ nhà đang sửa; điều hòa nhỏ giọt | Rao là nguồn di chuyển 5–15 km/h; tiếng khoan cắt ngẫu nhiên 1 điểm mỗi 200–300 m |
| Theo giờ | Chuông Nhà thờ Lớn (bộ 5 chuông: 4 nhỏ, 1 lớn, nối với đồng hồ mặt tiền) điểm giờ và trước lễ; chuông đồng hồ Bưu điện Bờ Hồ | Nghe rõ trong bán kính khoảng 300 m [suy đoán] |
| Trưa | Lắng hẳn; quạt điện, tivi vọng từ nhà; ve kêu rất to trên cây sấu, xà cừ (tháng 5–8) | Ve là lớp nền mùa hè, tắt khi mưa |
| 17:00–19:30 | Cao điểm: xe máy dày nhất, còi nhiều nhất; còi tàu và tiếng bánh sắt trên cầu dẫn Phùng Hưng nếu có tàu; chuông leng keng và loa của xe rác từ 19 giờ | Tàu: còi dài, rung nền, 1–2 lần mỗi tối |
| 19:30–23:00 | Tạ Hiện: tiếng cụng cốc, hô "một, hai, ba, dzô", nhạc quán chồng lên nhau; phố đi bộ: nhạc sống (guitar, violin, nhạc cụ dân tộc), tiếng trẻ con, xe điện đồ chơi; chợ đêm: mời hàng, mặc cả | Mỗi 50–100 m một nguồn nhạc khác nhau, chồng lấn |
| Sau 23:00 | Xe máy lẻ, tiếng rao "bánh khúc đây, xôi lạc bánh khúc", xe rửa đường, tiếng mèo, tiếng gõ của hàng mì, phở đêm | Vắng, vang |
| Thời tiết | Mưa rào rơi trên mái tôn rất ồn; mưa phùn gần như không tiếng; sấm chiều hè; gió mùa đông bắc rít qua dây điện | |
| Riêng cầu Long Biên | Tiếng lốp lạch cạch trên tấm đan và khe thép, gió sông, còi tàu | |
| Xe điện | Xe máy điện và taxi điện gần như không tiếng máy, chỉ còn tiếng lốp và còi; chiếm khoảng 6–10% xe máy và 6/10 taxi | Giảm lớp tiếng máy tương ứng |

Toàn bộ mục 9 là [khá chắc] (hiểu biết phổ thông), trừ: bộ chuông Nhà thờ Lớn [chắc chắn][^53], xe rác sau
19 giờ [chắc chắn][^40], tập sáng quanh hồ [chắc chắn][^73].

## 10. Bảng kiểm cho QC (40 quan sát có/không)

| # | Quan sát trong game | Mục |
|---|---|---|
| 1 | Biển tên phố nền xanh lam sẫm, chữ trắng in hoa, có viền trắng | 2.1 |
| 2 | Biển tên phố có hai dòng: dòng nhỏ "PHỐ" (hoặc "ĐƯỜNG", "NGÕ") và dòng lớn tên phố, không có dòng quận hay phường | 2.1 |
| 3 | Biển tên phố tỉ lệ ngang:dọc gần 75:40 và ở độ cao khoảng 2,5–3,5 m tại góc phố | 2.1 |
| 4 | Biển số nhà nền xanh chữ trắng, cạnh cửa, cao khoảng 2 m | 2.2 |
| 5 | Tại ngã tư lớn có đồng hồ đếm ngược cạnh đèn tín hiệu | 2.3 |
| 6 | Vạch tim đường màu vàng, vạch chia làn cùng chiều màu trắng | 2.4 |
| 7 | Vạch sang đường là các vạch trắng song song rộng khoảng 40 cm | 2.4 |
| 8 | Phố cổ rộng dưới 8 m không có vạch tim đường | 2.4 |
| 9 | Cột biển báo sơn khoang trắng đỏ | 2.4 |
| 10 | Có hàng xe máy đỗ vuông góc trên vỉa hè trong vạch sơn trắng | 2.5 |
| 11 | Vỉa hè phố cổ và quanh hồ lát đá xám, không phải bê tông trơn | 2.11 |
| 12 | Bó vỉa đá, vát ở phố nhiều nhà, mặt hè cao hơn lòng đường khoảng 12–16 cm | 2.11 |
| 13 | Ô cây vuông cạnh khoảng 1,4–1,6 m có viền đá | 2.11 |
| 14 | Gốc cây cổ thụ quét vôi trắng cao khoảng 1–1,3 m | 6 |
| 15 | Phan Đình Phùng là hàng sấu lớn; Hoàng Diệu là xà cừ lớn | 6 |
| 16 | Hàng cổ thụ có chỗ khuyết và cây non có cọc chống | 6 |
| 17 | Quanh Hồ Gươm không có lan can; có cây nghiêng ra mặt nước | 6 |
| 18 | Không có tòa "Hàm Cá Mập" ở đầu bắc Hồ Gươm | 3.6 |
| 19 | Trên nền "Hàm Cá Mập" cũ có màn hình LED; quảng trường có ghế đá và bồn hoa | 3.6 |
| 20 | Không có cổng "Khải hoàn môn" 36 m ở bất cứ đâu quanh hồ | 3.6 |
| 21 | Phía đông hồ (giữa Đinh Tiên Hoàng và Lý Thái Tổ) là bãi trống lát đá dở dang có rào, không phải dãy nhà | 8 |
| 22 | Bưu điện Hà Nội (có đồng hồ trên nóc) và tháp Hòa Phong vẫn còn | 3.5 |
| 23 | Mặt tiền phố cổ chia gian rộng 2–5 m, chiều cao các gian liền kề khác nhau | 3.1 |
| 24 | Trên nóc nhà ống có bồn nước inox và tum | 1 |
| 25 | Ở ngõ và phố nhỏ có bó dây cáp đen trên cột bê tông; quanh hồ thì không | 1, 8 |
| 26 | Khu phố Pháp và Ba Đình có nhà tường vàng, cửa chớp xanh lục, mái ngói đỏ nâu | 3.2 |
| 27 | Nhà Quốc hội là khối vuông đá be và kính, có quốc huy ở giữa mặt chính | 3.5 |
| 28 | Lăng bằng đá xám, trước Lăng là thảm cỏ chia ô vuông | 3.3, 3.5 |
| 29 | Không thấy tòa nhà nào cao trên khoảng 110 m trong khung bản đồ | 3.5 |
| 30 | Xe máy chiếm áp đảo (ít nhất 7/10 xe đang chạy) | 4 |
| 31 | Khoảng 6/10 taxi sơn xanh ngọc lam (taxi điện) | 4 |
| 32 | Taxi và xe buýt mang biển số nền vàng; xe cá nhân biển trắng | 4 |
| 33 | Biển số xe máy hai dòng, bắt đầu bằng 29 (hoặc 30–33, 40) | 4 |
| 34 | Người lái xe công nghệ mặc áo xanh lá, vàng, xanh ngọc lam hoặc cam; không có áo đỏ pha xanh lá | 4 |
| 35 | Trên cầu Long Biên chỉ có xe máy, xe đạp, người đi bộ, và xe đi bên trái | 8 |
| 36 | Có rào công trường metro trên Quốc Tử Giám (trước Văn Miếu) và trên Trần Hưng Đạo (trước Ga Hà Nội) | 8 |
| 37 | Không có ga metro đang hoạt động hay tàu metro trong bản đồ | 8 |
| 38 | Tối thứ Sáu đến Chủ nhật, quanh Hồ Gươm không có xe cơ giới và có rào ở các đầu phố | 5 |
| 39 | Quán vỉa hè dùng ghế nhựa thấp màu đỏ hoặc xanh dương | 5 |
| 40 | Mùa đông trời xám mù, vật cách 2–3 km gần như không thấy; mùa thu trời trong | 7 |

## Phụ lục A. Những điều không xác minh được (nói thẳng, không bịa)

- Có hay không việc thay biển tên phố sau khi bỏ cấp quận: không tìm thấy nguồn; kết luận dựa trên mẫu biển.
- Kích thước cụ thể trong QCVN 41:2024 (vạch, biển, độ cao): không mở được phụ lục, dùng số của bản 2019.
- Thiết kế mẫu hè đường bản 2019 (QĐ 1303): chỉ đọc được bản 2014 mà nó thay thế.
- Kiểu dáng, màu thùng rác công cộng; kích thước nhà chờ xe buýt; màu xe điện du lịch; số lượng xích lô.
- Chiều cao bằng mét của Vietcombank Tower, BIDV Tower, Melia, Pacific Place, Capital Tower, Nhà hát Hồ Gươm.
- Tình trạng loa phường 2025–2026; tỉ lệ đèn đường LED so với sodium và nhiệt độ màu thật.
- Đến 11/2026 còn bao nhiêu chuyến tàu chạy qua phố cổ và cầu Long Biên.
- Ga C8, C9, C10 của tuyến metro số 2 đã dựng rào thi công hay chưa.
- Sân bảo tàng quân sự cũ ở 28A Điện Biên Phủ còn hiện vật ngoài trời hay không.
- Giờ hoạt động năm 2026 của phố ẩm thực đảo Ngũ Xã; ranh giới chính xác của các phường mới ngoài Hoàn Kiếm.
- Mọi mã hex và mọi tỉ lệ phần trăm ghi [suy đoán].

## Nguồn

[^1]: VnExpress, "Hoàn thành phá dỡ tòa nhà 'Hàm cá mập'", 9/8/2025. <https://vnexpress.net/hoan-thanh-pha-do-toa-nha-ham-ca-map-4924778.html>
[^2]: VnBusiness, "Diện mạo mới sau cải tạo quảng trường Đông Kinh Nghĩa Thục", 11/9/2025. <https://vnbusiness.vn/dien-mao-moi-sau-cai-tao-quang-truong-dong-kinh-nghia-thuc.html>
[^3]: VTC News, quảng trường hơn 2 ha sát Hồ Gươm sau 5 tháng giải phóng mặt bằng, 30/4/2026. <https://vtcnews.vn/quang-truong-hon-2ha-sat-ho-guom-dan-lo-dien-sau-5-thang-giai-phong-mat-bang-ar1015628.html>
[^4]: Tuổi Trẻ, khu đất làm quảng trường phía đông Hồ Gươm sau phá dỡ, 28/4/2026. <https://tuoitre.vn/lo-dien-khu-dat-kim-cuong-lam-quang-truong-phia-dong-ho-guom-khi-vua-pha-do-loat-cong-trinh-20260428140234258.htm>
[^5]: Sức khỏe & Đời sống, cận cảnh phía đông Hồ Gươm sau khi tháo rào, 11/11/2026. <https://suckhoedoisong.vn/can-canh-khu-vuc-phia-dong-ho-guom-sau-khi-thao-do-rao-chan-169261111090529789.htm>
[^6]: CafeF (dẫn Đại Đoàn Kết), tái thiết hồ Hoàn Kiếm, 9/11/2026. <https://cafef.vn/tai-thiet-ho-hoan-kiem-tao-du-dia-moi-phat-trien-thu-do-188261109072003517.chn>
[^7]: VnExpress Góc nhìn, "'Khải hoàn môn' ở Hồ Gươm", 8/9/2026. <https://vnexpress.net/khai-hoan-mon-o-ho-guom-5118083.html>
[^8]: VnExpress Góc nhìn, "'Hoành tráng hóa' Hồ Gươm", 13/9/2026. <https://vnexpress.net/hoanh-trang-hoa-ho-guom-5119620.html>
[^9]: Tiền Phong, chiếu sáng trang trí quanh hồ Hoàn Kiếm, 29/8/2026. <https://tienphong.vn/ho-hoan-kiem-khoac-len-minh-lop-ao-anh-sang-dieu-ky-post1872157.tpo>
[^10]: CafeF (dẫn VTC News), "dải lụa" quanh Hồ Gươm, 3/10/2026. <https://cafef.vn/cong-nhan-gap-rut-hoan-thien-dai-lua-uon-luon-quanh-ho-guom-188261003063951914.chn>
[^11]: Tiền Phong, cầu cạn hình dải lụa ở hồ Hoàn Kiếm, 8/10/2026. <https://tienphong.vn/cau-can-hinh-dai-lua-o-ho-hoan-kiem-huyen-ao-ve-dem-post1883189.tpo>
[^12]: VnExpress, "Hoàn thành kè và lát đá Hồ Gươm", 10/10/2020. <https://vnexpress.net/hoan-thanh-ke-va-lat-da-ho-guom-4174598.html>
[^13]: VnEconomy, Hà Nội triển khai vùng phát thải thấp từ 1/7, 15/6/2026. <https://vneconomy.vn/ha-noi-bat-dau-trien-khai-vung-phat-thai-thap-tu-17.htm>
[^14]: Sài Gòn Giải Phóng, Hà Nội bắt đầu thí điểm vùng phát thải thấp, 1/7/2026. <https://www.sggp.org.vn/ha-noi-bat-dau-thi-diem-vung-phat-thai-thap-post860196.html>
[^15]: Wikipedia tiếng Việt, "Phố đi bộ Hồ Gươm". <https://vi.wikipedia.org/wiki/Phố_đi_bộ_Hồ_Gươm>
[^16]: Thời báo Tài chính Việt Nam, điều chỉnh thời gian không gian đi bộ Hoàn Kiếm, 7/3/2025. <https://thoibaotaichinhvietnam.vn/ha-noi-dieu-chinh-thoi-gian-hoat-dong-khong-gian-di-bo-quan-hoan-kiem-171994.html>
[^17]: Vietnam Airlines, cẩm nang phố đi bộ Hà Nội. <https://www.vietnamairlines.com/vn/vi/plan-book/travel/travel-guide/pho-di-bo-ha-noi>
[^18]: Tuổi Trẻ, cấm xe qua cầu Long Biên 2 tháng để sửa chữa, 26/3/2026. <https://tuoitre.vn/ha-noi-cam-xe-di-qua-cau-long-bien-trong-2-thang-de-sua-chua-20260326083632435.htm>
[^19]: Nhân Dân, khôi phục tổ chức giao thông trên cầu Long Biên từ 28/5/2026. <https://nhandan.vn/khoi-phuc-phuong-an-to-chuc-giao-thong-tren-cau-long-bien-tu-285-post964788.html>
[^20]: Wikipedia tiếng Việt, "Cầu Long Biên". <https://vi.wikipedia.org/wiki/Cầu_Long_Biên>
[^21]: Tuổi Trẻ, Hà Nội đề xuất dừng chạy tàu qua tuyến "cà phê đường tàu", 6/1/2026. <https://tuoitre.vn/ha-noi-de-xuat-dung-chay-tau-qua-tuyen-ca-phe-duong-tau-de-chinh-trang-tai-thiet-pho-co-20260106173529269.htm>
[^22]: VnEconomy, giảm tàu qua cầu Long Biên, dừng tàu hàng, 28/2/2026. <https://vneconomy.vn/ha-noi-giam-tau-qua-cau-long-bien-dung-tau-hang-khu-pho-ca-phe-duong-tau.htm>
[^23]: Tuổi Trẻ, trang chủ đề "đường ray" (các bài 2025–8/2026 về phố cà phê đường tàu). <https://tuoitre.vn/duong-ray.html>
[^24]: Báo Pháp luật Việt Nam, metro Nhổn - Ga Hà Nội thu hẹp rào chắn đoạn ngầm, 28/2/2026. <https://baophapluat.vn/metro-nhon-ga-ha-noi-tang-toc-doan-ngam-hoan-thien-den-dau-tra-lai-mat-bang-den-do.html>
[^25]: VnEconomy, hoàn thành toàn bộ khoan hầm đoạn ngầm metro Nhổn - Ga Hà Nội, 4/2026. <https://vneconomy.vn/tuyen-metro-nhon-ga-ha-noi-hoan-thanh-toan-bo-khoan-ham-doan-ngam.htm>
[^26]: Wikipedia tiếng Việt, "Tuyến 2 (Đường sắt đô thị Hà Nội)". <https://vi.wikipedia.org/wiki/Tuyến_2_(Đường_sắt_đô_thị_Hà_Nội)>
[^27]: An ninh Thủ đô, ga C9 xây ngầm dưới đường Đinh Tiên Hoàng, 2025. <https://anninhthudo.vn/ga-c9-tuyen-metro-nam-thang-long-tran-hung-dao-se-xay-dung-ngam-duoi-duong-dinh-tien-hoang-post621998.antd>
[^28]: Tiền Phong, điều chỉnh giao thông phục vụ thi công cầu Trần Hưng Đạo, 2026. <https://tienphong.vn/ha-noi-dieu-chinh-giao-thong-tren-nhieu-tuyen-duong-phuc-vu-thi-cong-cau-tran-hung-dao-post1868350.tpo>
[^29]: VietnamFinance, trụ cầu Trần Hưng Đạo, 2026. <https://vietnamfinance.vn/can-canh-nhung-tru-cau-tran-hung-dao-moc-len-tu-day-song-hong-d146306.html>
[^30]: Luật Hoàng Anh, quy định về biển tên đường, phố (theo quy chế kèm Nghị định 91/2005/NĐ-CP). <https://luathoanganh.vn/van-hoa-the-thao-va-du-lich/quy-dinh-ve-bien-ten-duong-pho-lha23420.html>
[^31]: Tạp chí Công Thương, thí điểm gắn mã QR biển tên phố từ 9/2024. <https://tapchicongthuong.vn/tu-thang-9-2024--ha-noi-thi-diem-gan-ma-qr-ten-duong-pho-bang-bien-phu-tai-hang-tram-tuyen-pho-125190.htm>
[^32]: Thư viện Pháp luật, cấu tạo các loại biển số nhà (Quyết định 05/2006/QĐ-BXD). <https://thuvienphapluat.vn/hoi-dap-phap-luat/cau-tao-cac-loai-bien-so-nha-264604.html>
[^33]: Nhân Dân, đèn tín hiệu chỉ hiển thị 8 giây cuối, 18/11/2025. <https://nhandan.vn/nguoi-dan-ha-noi-ung-ho-dieu-chinh-den-tin-hieu-chi-hien-thi-8-giay-cuoi-post924048.html>
[^34]: VietnamPlus, vận hành 36 màn hình LED cảnh báo giao thông, 7/2026. <https://www.vietnamplus.vn/ha-noi-chinh-thuc-van-hanh-36-man-hinh-led-canh-bao-giao-thong-post1124290.vnp>
[^35]: LuatVietnam, QCVN 41:2024/BGTVT về báo hiệu đường bộ (hiệu lực 1/1/2025). <https://luatvietnam.vn/giao-thong/quy-chuan-qcvn-412024-bgtvt-bao-hieu-duong-bo-376856-d3.html>
[^36]: Quyết định 4340/QĐ-UBND năm 2014 của Hà Nội về thiết kế mẫu hè đường đô thị. <https://hethongphapluat.com/quyet-dinh-4340-qd-ubnd-nam-2014-ve-thiet-ke-mau-he-duong-do-thi-tren-dia-ban-thanh-pho-ha-noi.html>
[^37]: Quyết định 6398/QĐ-UBND năm 2013, quy chế quản lý quy hoạch - kiến trúc khu phố cổ Hà Nội. <https://hethongphapluat.com/quyet-dinh-6398-qd-ubnd-nam-2013-ve-quy-che-quan-ly-quy-hoach-kien-truc-khu-pho-co-ha-noi.html>
[^38]: Wikipedia tiếng Anh, "Tube house". <https://en.wikipedia.org/wiki/Tube_house>
[^39]: Đại biểu Nhân dân, nhiều điểm chờ xe buýt không mái che, 8/2025. <https://daibieunhandan.vn/ha-noi-nhieu-diem-cho-khong-mai-che-nguoi-dan-doi-nang-mua-cho-xe-buyt-10382173.html>
[^40]: Báo Văn Hóa, Hoàn Kiếm xóa bỏ điểm tập kết rác. <https://baovanhoa.vn/doi-song/hoan-kiem-tiep-tuc-xoa-bo-diem-tap-ket-rac-126240.html>
[^41]: Sài Gòn Giải Phóng, Hà Nội chưa có kế hoạch loại bỏ loa phường. <https://www.sggp.org.vn/ha-noi-chua-bao-gio-co-ke-hoach-loai-bo-he-thong-loa-phuong-post645411.html>
[^42]: Báo Đấu thầu, kế hoạch thanh thải, bó gọn cáp treo năm 2026. <https://baodauthau.vn/ha-noi-trien-khai-ke-hoach-thanh-thai-bo-gon-cap-treo-tren-toan-dia-ban-nam-2026-post193491.html>
[^43]: Wikipedia tiếng Việt, "Tràng Tiền Plaza". <https://vi.wikipedia.org/wiki/Tràng_Tiền_Plaza>
[^44]: Wikipedia tiếng Anh, "Hanoi Towers". <https://en.wikipedia.org/wiki/Hanoi_Towers>
[^45]: Wikipedia tiếng Việt, "Lăng Chủ tịch Hồ Chí Minh". <https://vi.wikipedia.org/wiki/Lăng_Chủ_tịch_Hồ_Chí_Minh>
[^46]: Wikipedia tiếng Anh, "Presidential Palace, Hanoi". <https://en.wikipedia.org/wiki/Presidential_Palace,_Hanoi>
[^47]: Wikipedia tiếng Việt, "Bắc Bộ phủ". <https://vi.wikipedia.org/wiki/Bắc_Bộ_phủ>
[^48]: Wikipedia tiếng Việt, "Bảo tàng Lịch sử Quốc gia (Việt Nam)". <https://vi.wikipedia.org/wiki/Bảo_tàng_Lịch_sử_Quốc_gia_(Việt_Nam)>
[^49]: Wikipedia tiếng Việt, "Nhà hát Hồ Gươm". <https://vi.wikipedia.org/wiki/Nhà_hát_Hồ_Gươm>
[^50]: Wikipedia tiếng Việt, "Tòa nhà Quốc hội Việt Nam". <https://vi.wikipedia.org/wiki/Tòa_nhà_Quốc_hội_Việt_Nam>
[^51]: Wikipedia tiếng Việt, "Tháp nước Hàng Đậu". <https://vi.wikipedia.org/wiki/Tháp_nước_Hàng_Đậu>
[^52]: Wikipedia tiếng Việt, "Cột cờ Hà Nội". <https://vi.wikipedia.org/wiki/Cột_cờ_Hà_Nội>
[^53]: Wikipedia tiếng Việt, "Nhà thờ Lớn Hà Nội". <https://vi.wikipedia.org/wiki/Nhà_thờ_Lớn_Hà_Nội>
[^54]: Wikipedia tiếng Việt, "Nhà hát Lớn Hà Nội". <https://vi.wikipedia.org/wiki/Nhà_hát_Lớn_Hà_Nội>
[^55]: Wikipedia tiếng Việt, "Ga Long Biên". <https://vi.wikipedia.org/wiki/Ga_Long_Biên>
[^56]: CBRE Việt Nam, BIDV Tower. <https://www.cbrevietnam.com/properties/office-for-lease/ha-noi/hoan-kiem-district/bidv-tower>
[^57]: Cushman & Wakefield, Vietcombank Tower Hà Nội. <https://www.cushmanwakefield.com/en/vietnam/properties/for-lease/office/hoan-kiem-district/hanoi/198-tran-quang-khai/hoan-kiem-office-for-lease-vietcombank-tower-hanoi-l>
[^58]: VnEconomy, xe máy điện lập kỷ lục doanh số năm 2025. <https://vneconomy.vn/automotive/xe-may-dien-lap-ky-luc-doanh-so-thong-tri-thi-truong-viet-nam-2025.htm>
[^59]: VietNamNet, thị trường xe máy Việt năm 2025. <https://vietnamnet.vn/xe-may-viet-lap-ky-luc-san-xuat-trong-nam-2025-tao-da-dinh-hinh-thi-truong-2026-2479242.html>
[^60]: VietnamFinance, chuyển đổi 100% taxi Hà Nội sang xe điện, 2026. <https://vietnamfinance.vn/chuyen-doi-100-taxi-o-ha-noi-sang-xe-dien-gan-28000-tai-xe-duoc-ho-tro-gi-d140856.html>
[^61]: Wikipedia tiếng Việt, "Xe buýt Hà Nội". <https://vi.wikipedia.org/wiki/Xe_buýt_Hà_Nội>
[^62]: Wikipedia tiếng Anh, "Vehicle registration plates of Vietnam". <https://en.wikipedia.org/wiki/Vehicle_registration_plates_of_Vietnam>
[^63]: Thư viện Pháp luật, kích thước biển số xe mô tô theo QCVN 08:2024/BCA. <https://thuvienphapluat.vn/hoi-dap-phap-luat/kich-thuoc-bien-so-xe-mo-to-la-bao-nhieu-theo-qcvn-08-2024bca-138041438.html>
[^64]: Nhân Dân, kết nối Hoàng thành Thăng Long và phố cổ bằng xe điện. <https://nhandan.vn/post-795319.html>
[^65]: VOV, xích lô Hà Nội, 13/7/2026. <https://vov.vn/du-lich/san-tour/xich-lo-ha-noi-tu-phuong-tien-muu-sinh-den-goi-mo-ve-du-lich-di-san-post1312784.vov>
[^66]: Báo Văn Hóa, xe đạp điện công cộng ở Hà Nội. <https://baovanhoa.vn/doi-song/tien-loi-va-con-do-nhung-bat-loi-187140.html>
[^67]: Tiền Phong, mỗi tuyến phố Hà Nội sẽ có loài cây xanh chủ đạo, 12/10/2026. <https://tienphong.vn/moi-tuyen-pho-ha-noi-se-co-loai-cay-xanh-chu-dao-post1884468.tpo>
[^68]: Tiền Phong, bổ sung sao đen trên phố Nguyễn Du, 10/2026. <https://tienphong.vn/ha-noi-bo-sung-them-sao-den-ngoai-cay-hoa-sua-tren-pho-nguyen-du-post1885978.tpo>
[^69]: VTC News, hơn 40.000 cây gãy đổ do bão Yagi, 23/10/2024. <https://www.vtcnews.vn/hon-40-000-cay-gay-do-do-bao-yagi-ha-noi-du-kien-cuu-duoc-3-000-cay-ar895793.html>
[^70]: VnExpress, hoa lộc vừng Hồ Gươm. <https://vnexpress.net/hoa-loc-vung-ho-guom-do-ruc-cuoi-thu-2206149.html>
[^71]: Việt Nam News, chất lượng không khí Hà Nội, cuối 2025. <https://vietnamnews.vn/environment/1763251/ha-noi-must-tighten-emissions-control-improve-daily-air-quality-index-experts.html>
[^72]: VnEconomy, ô nhiễm không khí tăng, Hà Nội kích hoạt biện pháp khẩn cấp, 12/2025. <https://vneconomy.vn/o-nhiem-khong-khi-tiep-tuc-tang-ha-noi-kich-hoat-cac-bien-phap-khan-cap.htm>
[^73]: VietNamNet, tập thể dục từ 4 giờ sáng bên Hồ Gươm. <https://vietnamnet.vn/gio-rit-tung-con-ron-rang-tap-the-duc-tu-4h-sang-ben-ho-guom-422498.html>
[^74]: Vietnam Tourism, hồ Hoàn Kiếm theo giờ trong ngày. <https://www.vietnamtourism.com/vi/ho-hoan-kiem-o-ha-noi-xem-gi-pho-i-bo-va-thoi-iem-tot-nhat-e>
[^75]: Thư viện Nhà đất, bản đồ phường Hoàn Kiếm sau sáp nhập (Nghị quyết 1656/NQ-UBTVQH15). <https://thuviennhadat.vn/bat-dong-san/chi-tiet-ban-do-phuong-hoan-kiem-sau-sap-nhap-21995.html>
[^76]: Nông nghiệp và Môi trường, Hoàn Kiếm xử lý vi phạm trật tự đô thị, 2026. <https://nongnghiepmoitruong.vn/hoan-kiem-quyet-liet-xu-ly-vi-pham-ve-trat-tu-do-thi-d804345.html>
[^77]: VTC News, nhiều tuyến vỉa hè vẫn bị chiếm, 25/4/2026. <https://vtcnews.vn/nhieu-tuyen-via-he-ha-noi-van-bi-hang-quan-bai-xe-nuot-chung-ca-ngay-lan-dem-ar1014591.html>
[^78]: Việt Nam News, phố ẩm thực - đi bộ trên hồ Trúc Bạch. <https://vietnamnews.vn/society/1440893/ha-noi-opens-food-pedestrian-zone-on-truc-bach-lake.html>
[^79]: MIA, Bảo tàng Lịch sử Quân sự Việt Nam (đóng cửa cơ sở 28A Điện Biên Phủ 30/9/2024). <https://mia.vn/cam-nang-du-lich/bao-tang-lich-su-quan-su-viet-nam-ha-noi-16952>
[^80]: B&Company, thị trường gọi xe Việt Nam 2025. <https://b-company.jp/?p=23124>
[^81]: Lao Động, gánh hàng rong Hà Nội dùng thanh toán số (chỉ đọc được tiêu đề), 2026. <https://news.laodong.vn/du-lich/kham-pha/ganh-hang-ha-noi-chuyen-minh-voi-thanh-toan-so-hut-khach-du-lich-1677602.html>
[^82]: Nông nghiệp và Môi trường, thích ứng với giờ đổ rác mới, 5/2026. <https://nongnghiepmoitruong.vn/thay-doi-dien-mao-thu-do-bai-3-thich-ung-voi-gio-do-rac-moi-d812606.html>
