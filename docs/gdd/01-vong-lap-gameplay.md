# 01. Vòng lặp gameplay

## Ba vòng lặp lồng nhau

| Vòng | Thời lượng | Nội dung | Ví dụ |
| --- | --- | --- | --- |
| Khoảnh khắc | 30 giây - 3 phút | Lái xe qua phố đông, lách đúng luật, nấu một bát phở, chụp một tấm ảnh | Tránh ổ gà ngập trên Nguyễn Khuyến khi chở 30 suất phở |
| Phiên chơi | 20 - 60 phút | Một ca chạy xe, một buổi bán hàng, một nhiệm vụ cốt truyện, một vòng sưu tầm | Ca sáng của Minh: 8 cuốc, 1 lần bị Chú ý, 380.000 đồng |
| Tiến trình | Nhiều giờ | Gom tiền mua tiệm, tăng uy tín phe phái, mở khóa chương truyện, quyết định số phận căn nhà | Minh gom đủ 120 triệu sang lại tiệm Đức Còi |

Một ngày trong game dài 48 phút thật (như GTA5). Người chơi có thể chọn chế độ **đồng bộ giờ thật**
cho trải nghiệm chậm (xem `02-he-thong.md`).

## Ba nhân vật chính

Như GTA5, người chơi chuyển qua lại giữa ba người bất cứ lúc nào ngoài nhiệm vụ. Khi chuyển, camera
kéo lên cao trên thành phố rồi hạ xuống chỗ người kia đang làm gì đó theo lịch riêng (đang ninh
xương, đang ngủ trưa, đang tráng phim).

| | Minh (23) | Lan (29) | Khôi (38) |
| --- | --- | --- | --- |
| Nghề | Xe ôm công nghệ | Chủ quán phở bất đắc dĩ | Phóng viên ảnh Việt kiều |
| Nhà | Phòng trọ 12 m², Khương Đình | Tầng dưới 49 Hàng Chiếu | Gác trên 49 Hàng Chiếu |
| Xe đầu game | Hồng Đạt Sóng Alpha (xe số) | Hồng Đạt Tầm Nhìn (tay ga) | Đi bộ, xe đạp Thống Nhứt; xe máy sau khi thi A1 |
| Kỹ năng mạnh | `lai_xe`, `thuoc_duong`, `an_noi` | `kinh_doanh`, `mac_ca`, `giao_tiep` | `chup_anh`, `ngoai_ngu` |
| Kỹ năng yếu | `nau_an`, `chup_anh` | `lai_xe`, `chup_anh` | `lai_xe`, `thuoc_duong` |
| Năng lực đặc biệt (thay "special ability" GTA) | **Thuộc đường**: tắt bản đồ, tô sáng đường tắt và ngõ xuyên trong 30 giây | **Tính nhẩm**: làm chậm thời gian khi mặc cả và phục vụ giờ cao điểm | **Mắt nhà nghề**: làm chậm thời gian, tô sáng khoảnh khắc đáng chụp |
| Vòng lặp riêng | Nhận cuốc, giao hàng, sửa xe | Đi chợ, nấu, quản lý quán | Chụp lại ảnh xưa, bán ảnh, dẫn tour |
| Mục tiêu đời | Trả nợ viện phí, mở tiệm sửa xe | Giữ quán và căn nhà của ông | Hiểu người bố, quyết định ở hay đi |

Kỹ năng tăng theo cách chơi (thang 0-100 trong `characters/*.json`, mỗi hoạt động khai báo
`skills_trained`). Khôi bắt đầu gần như không biết lái xe máy ở Hà Nội: tiến trình lái xe của anh là
một vòng học thật (nhiệm vụ "Thầy Minh", thi sát hạch A1). Mỗi kỹ năng có ba mốc mở khóa thứ nhìn thấy
được (xe, hoạt động, cơ sở, lựa chọn thoại): `skills.json`, 02 §10.

## Kinh tế và cân bằng VND

Nguyên tắc: **công việc thường ngày trả đúng giá thật**, để người Hà Nội chơi thấy hợp lý. Những bước
nhảy lớn (mua tiệm, giữ nhà) đến từ cốt truyện, kinh doanh và cộng đồng, giống cách GTA dùng phi vụ,
nhưng hợp pháp.

### Thu nhập tham khảo (số tiền người chơi thực nhận)

| Hoạt động | Mức trả trong game | Một phiên điển hình |
| --- | --- | --- |
| Xe ôm công nghệ | 13.500 đ mở cửa + 4.300 đ/km, tip tới 30.000 đ | 8 cuốc ≈ 250.000 - 400.000 đ |
| Giao đồ ăn | 15.000 đ + 5.000 đ/km | 10 đơn ≈ 250.000 đ |
| Bán hàng rong | 15.000 đ/lượt bán | 1 gánh ≈ 300.000 đ |
| Sửa xe | 30.000 đ/việc + tip | 11 xe ≈ 330.000 đ |
| Chụp ảnh phố bán báo | 300.000 - 1.000.000 đ/ảnh được duyệt | 1-2 ảnh/ngày |
| Dẫn tour đi bộ | 400.000 đ + tip | 1 tour/buổi |
| Xích lô du lịch | 150.000 đ/giờ + tip | 2-3 lượt/buổi |
| Phở Thọ (quán) | thu 3,5 triệu/ngày, chi 1,8 triệu/ngày | lãi ≈ 50 triệu/tháng trước sự kiện |

### Chi tiêu tham khảo

| Khoản | Giá |
| --- | --- |
| Bát phở bò | 55.000 đ |
| Xôi xéo / bánh mì | 20.000 - 25.000 đ |
| Trà đá | 5.000 đ |
| Gửi xe máy | 5.000 đ ngày, 10.000 đ tối |
| Phòng trọ của Minh | 2,5 triệu/tháng + điện 4.000 đ/số |
| Tiền gửi về quê | 6 triệu/tháng = 2 triệu cho mẹ + 4 triệu trả góp viện phí của bố (180 triệu, 60 kỳ; hết nợ thì Minh dư thêm 4 triệu/tháng) |
| Mũ bảo hiểm đạt chuẩn | 350.000 đ |
| Phạt vượt đèn đỏ (xe máy) | 4 - 6 triệu (game dùng 5 triệu) |

Một ngày chạy xe chăm của Minh lãi ròng khoảng 300.000 - 400.000 đ sau xăng và ăn uống. Một lần vượt
đèn đỏ ăn mất hơn hai tuần tiết kiệm: luật giao thông là một **áp lực kinh tế**, không chỉ là hình phạt.

### Bậc thang thu nhập của Minh (sửa theo thẩm định `07` mục 2)

Chỉ chạy app, Minh **âm 0,7 triệu/tháng** (10,5 triệu thu; 2,7 triệu ăn, xăng; 2,5 triệu trọ; 6 triệu
về quê). Đó là nỗi khổ (Khổ) mở đầu game và là lý do anh nghe lời mời của Kim Long (Tập): một mình app
không nuôi được anh. Con đường ra (Đạo) là những thứ cốt truyện mở, không phải tiền từ truyện:

| Bậc | Mở ở đâu | Thêm mỗi ngày | Dữ liệu |
| --- | --- | --- | --- |
| Tối sửa xe ở tiệm Đức Còi, 2 giờ, 3 xe | `c1_05` mở `act_sua_xe_may` | +100.000 đ | `activities.json` pay 30.000 + tip |
| 30 khách quen gọi điện, không mất 30% app | nhận sổ của ông Lương (`q_hd_04`) | +60.000 đ | cờ `hd_minh_nhan_so_khach` |
| Thưởng tuần của app Vồ: 60 cuốc/tuần, sao ≥ 4,8 | luôn có, mất khi bị phạt | +400.000 đ/tuần | `pay.weekly_bonus_vnd` |
| Chở hàng ba gác đêm | `act_cho_hang_ba_gac` | 250.000 đ/chuyến, thỉnh thoảng | |

Đi đủ bậc: thu khoảng 17 triệu, **dư 5,8 triệu/tháng**. Giả lập `tools/playtest.py` (06) in hai con số
này. Mục tiêu tiệm Đức Còi có hai cửa, mở ở `q_tx_04_gop_von_duc_coi`: **góp vốn 40 triệu** (40% lãi,
tên tiệm giữ nguyên, hai năm sau sang nốt bằng lãi; khoảng 7 tháng game nếu chăm) hoặc **mua đứt 120
triệu** như Minh vẫn tính (khoảng 21 tháng, hoặc nhanh hơn bằng tiền của người mặc vest, với cái giá
của chương 1-2). Chọn mua đứt là Tập của Minh ("không muốn nợ ai, kể cả anh Đức"); chọn góp vốn là
chấp nhận giúp đỡ, đúng điều mẹ anh và anh Đức vẫn chờ.

### Mục tiêu tiền lớn

| Mục tiêu | Giá | Nguồn tiền chính |
| --- | --- | --- |
| Tiệm sửa xe Đức Còi (Minh) | 120 triệu mua đứt, hoặc góp vốn 40 triệu (40%) rồi sang nốt bằng lãi | Chạy xe, sửa xe tối, khách quen, thưởng tuần; thưởng nhiệm vụ |
| Quán cà phê trứng Hàng Gai | 450 triệu (sang nhượng) | Lãi Phở Thọ, ảnh của Khôi |
| Homestay Tô Ngọc Vân | 600 triệu (góp vốn) | Kết hợp cả ba |
| Sạp gia vị chợ Đồng Xuân | 800 triệu, cần uy tín chợ 60 | Kinh doanh |
| Karaoke Kim Liên | 900 triệu | Cuối game |
| Mua lại phần nhà của cô Hạnh | khoảng 3 tỷ (chương 3-4) | Kinh doanh + vay + cộng đồng góp vốn + triển lãm ảnh |

Ghi chú: ở Hà Nội người ta "sang nhượng" quán (mua lại kinh doanh, thuê mặt bằng), không mua đứt
nhà phố cổ. Giá trong `businesses.json` là tiền sang nhượng; tiền thuê nằm trong `upkeep_per_day_vnd`.

### Tiền cũng bị hút ra

Tiền nhà, tiền gửi về quê, xăng, sửa xe, phạt, nhập hàng, lương nhân viên, thuế khoán, quà biếu Tết.
Mục tiêu cân bằng: một người chơi bình thường mua được cơ sở kinh doanh đầu tiên vào cuối chương 2,
không sớm hơn.

## Vòng lặp từng nhân vật

**Minh**: bật app Vồ → nhận cuốc (máy sinh `ride_request`) → đón → chở (điểm êm, đúng giờ, không vi
phạm) → sao đánh giá → tiền. Rủi ro: CSGT, mưa ngập, khách hủy. Đêm: sửa xe ở tiệm Đức.

**Lan**: 3:30 ninh xương → 6:00 mở hàng (minigame `pho_order`) → 10:00 đi chợ/mặc cả → chiều sổ
sách trên app Sổ Tay → tối ca hai. Rủi ro: nguyên liệu đắt, đánh giá xấu, sự kiện thời tiết.

**Khôi**: chọn một tấm ảnh trong kho của bố → tìm địa điểm, giờ, mùa đúng → chụp lại (chồng ảnh) →
nghe băng cát-sét mở ra → bán ảnh, triển lãm. Đây là vòng sưu tầm chính của game (120 khung ảnh,
24 băng), dẫn người chơi đi khắp bản đồ.

## Nhịp chơi một ngày điển hình

| Giờ trong game | Minh | Lan | Khôi |
| --- | --- | --- | --- |
| 03:30 | ngủ | ninh nước dùng | ngủ chập chờn (lệch múi giờ) |
| 05:30 | cuốc sớm ra ga, bến xe | mở hàng | chụp bình minh Hồ Gươm |
| 10:00 | trà đá chờ cuốc | chợ Đồng Xuân | phân loại phim |
| 14:00 | ngủ trưa | sổ sách | đi tìm địa điểm ảnh xưa |
| 17:00 | cao điểm chiều | ca tối | cà phê với ông Thắng |
| 21:00 | sửa xe với Đức | đóng quán | tráng phim |
