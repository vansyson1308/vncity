# 15. Kiểm chứng dữ liệu thực: mức phạt CSGT và toạ độ địa danh

Tra ngày 14/10/2026. Mục đích: hai thứ người chơi Hà Nội bắt lỗi đầu tiên là "phạt sai luật" và "đền nằm
nhầm phố". Tài liệu này ghi nguồn, những gì đã sửa, và cách CI khoá lại.

## 1. Mức phạt theo Nghị định 168/2024/NĐ-CP

**Văn bản đang hiệu lực (10/2026):** Nghị định 168/2024/NĐ-CP (hiệu lực 1/1/2025), sửa đổi bởi
Nghị định 238/2026/NĐ-CP (ký 26/6/2026, hiệu lực 15/8/2026). Nghị định 238 không sửa mức tiền hay điểm trừ
của Điều 7 (xe mô tô, xe gắn máy); nó chỉ bổ sung cụm từ vào Điều 7 khoản 1 điểm e (chuyển làn không giữ
khoảng cách an toàn) và khoản 6 điểm b (thêm "hoặc có quy định cấm của cấp có thẩm quyền đối với loại phương
tiện đang điều khiển"). Với ô tô, Nghị định 238 thêm lỗi chở trẻ dưới 10 tuổi không có ghế an toàn và lỗi
xe không kinh doanh vận tải chở khách thu tiền (12-14 triệu, trừ 6 điểm); không đụng tới các lỗi game dùng.

**Nguồn đã đối chiếu:**
- Toàn văn NĐ 168/2024 trên Cổng Xây dựng chính sách, Chính phủ (xaydungchinhsach.chinhphu.vn) và
  thuvienphapluat.vn: Điều 6, Điều 7 (từng khoản, điểm và khoản 13 trừ điểm), Điều 48 (tạm giữ phương tiện).
- Toàn văn NĐ 238/2026 trên thuvienphapluat.vn và bài giới thiệu trên xaydungchinhsach.chinhphu.vn.
- Bộ Công an, "Các mức xử phạt một số lỗi vi phạm giao thông thường gặp đối với người điều khiển xe máy"
  (bocongan.gov.vn, 26/1/2025), để kiểm chéo mức tiền.
- Luật Trật tự, an toàn giao thông đường bộ 2024, Điều 56 khoản 3 (xuất trình giấy tờ qua tài khoản định danh
  điện tử) qua bài của Liên đoàn Luật sư (lsvn.vn, 22/2/2026); Luật Xử lý vi phạm hành chính (tạm giữ tối đa
  7 ngày).

Nhân vật chính đi xe máy, nên `licence_points` là điểm trừ của xe máy; điểm trừ ô tô ghi trong `legal_basis`.
Mức trong game là giữa khung.

| Lỗi (id) | Căn cứ xe máy | Khung xe máy | Game cũ | Game mới |
| --- | --- | --- | --- | --- |
| Vượt đèn đỏ (`vuot_den_do`) | Đ7 k7 c, k13 b | 4-6 tr, trừ 4 | 5 tr, 4 | giữ |
| Không đội mũ (`khong_doi_mu_bao_hiem`) | Đ7 k2 h, i | 400-600 ng | 500 ng | giữ |
| Đi ngược chiều (`di_nguoc_chieu`) | Đ7 k7 a, k13 a | 4-6 tr, **trừ 2** | 5 tr, trừ 4 | **trừ 2** |
| Vào phố đi bộ, đường cấm (`di_vao_pho_di_bo_duong_cam`) | Đ7 k6 b, k13 a | **2-3 tr, trừ 2** | 1,5 tr, 0 | **2,5 tr, trừ 2**; ô tô 5 tr |
| Dừng, đỗ sai (`dung_do_sai_quy_dinh`) | Đ7 k2 d, e | 400-600 ng | 500 ng | giữ |
| Chở hai người (`cho_qua_so_nguoi`) | Đ7 k2 g | 400-600 ng | 500 ng | giữ; sửa tên cho đúng hành vi; chở ba là k3 b |
| Dùng điện thoại (`dung_dien_thoai_khi_lai`) | Đ7 k4 đ, k13 b | 800 ng-1 tr, trừ 4 | 900 ng, 4 | giữ |
| Cồn mức 1 (`nong_do_con_muc_1`) | Đ7 k6 a, k13 b | 2-3 tr, trừ 4 | 2,5 tr, 4 | giữ; thêm tạm giữ xe |
| Cồn mức 3 (`nong_do_con_muc_3`) | Đ7 k9 d, k12 | 8-10 tr, tước GPLX 22-24 tháng | 9 tr | giữ |
| Quá tốc độ 10-20 km/h (`vuot_toc_do_10_20`) | Đ7 k4 a | 800 ng-1 tr, **không trừ điểm** | 900 ng, trừ 2 | **0 điểm** |
| Sai làn (`di_sai_lan_vao_lan_o_to`) | Đ7 k3 d | 600-800 ng, **không trừ điểm** | 700 ng, trừ 2 | **0 điểm** |
| Không có GPLX (`khong_co_giay_phep_lai_xe`) | Đ18 | 2-4 tr (đến 125 cm³) | 3 tr | giữ; thêm tạm giữ xe |
| Không mang giấy tờ (`khong_mang_giay_to`) | Đ18 | 200-300 ng | 250 ng | giữ; không phạt nếu xuất trình trong hạn hẹn, VNeID được chấp nhận |
| Đi trên vỉa hè (`di_tren_via_he`) | Đ7 k7 a, k13 a | **4-6 tr, trừ 2** | 500 ng, 0 | **5 tr, trừ 2, Chú ý 3**; ô tô 7 tr |
| Còi 22h-5h (`bam_coi_ban_dem`) | Đ7 k1 i | **200-400 ng** | 500 ng | **300 ng**; ô tô 500 ng |
| **Mới:** phóng qua hiệu lệnh CSGT (`khong_chap_hanh_hieu_lenh_csgt`) | Đ7 k7 d, k13 b | 4-6 tr, trừ 4 | (áp nhầm lỗi tốc độ) | 5 tr, trừ 4, Chú ý 4 |

Tóm lại: 11 mức gắn `fine_unverified` đã đối chiếu xong; 6 mục sai (ba mục trừ điểm sai, ba mục sai tiền),
1 lỗi mới cho sự kiện "phóng qua chốt" (trước đây áp nhầm lỗi quá tốc độ). Mọi mục giờ gắn
`fine_verified_nd168` và ghi điều, khoản, điểm, nguồn, ngày tra trong `legal_basis`.

**Hệ quả gameplay (nhất quán với kinh tế của Minh, PR #11):** lỗi vỉa hè nay bằng hai ngày chạy xe tốt nhất của
Minh, đúng với luật thật và đúng tinh thần "cay cú": leo vỉa hè tắt đường giờ tan trường (`random_events`,
`leo_via_he`) không còn là lối tắt rẻ. Ngược lại, quá tốc độ nhẹ và sai làn chỉ mất tiền, không mất điểm;
đi ngược chiều mất ít điểm hơn trước. Thiếu giấy tờ không mất tiền ngay mà mất xe tới ngày hẹn (mất thu nhập,
lỡ hẹn nhiệm vụ), chỉ mất tiền nếu không mang giấy tới.

Thoại liên quan cũng sửa: "không bấm còi quá 11 giờ" thành "sau 10 giờ đêm" (khung cấm là 22h-5h) trong
nhiệm vụ đi bão `q_md_02_dem_doi_tuyen` và thoại của nó.

## 2. Toạ độ 84 địa danh

**Cách làm.** `tools/landmark_audit.py` tải các đối tượng có tên quanh 84 địa danh từ Overture Maps
(bản 2026-09-23.0). Các lớp nước, sử dụng đất, hạ tầng, đường và nhà của Overture là dữ liệu OpenStreetMap
(giấy phép ODbL), kèm số hiệu OSM gốc. Máy chủ OSM (Overpass, Nominatim) bị chặn từ môi trường build, Overture
trên S3 thì không. Mỗi địa danh được khớp theo tên với đối tượng OSM (hồ khớp mặt nước, cầu khớp cầu, phố
khớp đường), rồi đo khoảng cách từ ghim tới đối tượng; ghim nằm trong vùng hồ, công viên thì khoảng cách là 0.
Điểm Overture "places" (gộp nguồn Meta, Microsoft) chỉ dùng khi OSM không có gì.

**Kết quả:** 50 địa danh đã nằm trong 50 m; **34 địa danh lệch quá 50 m đã dời** lên đối tượng thật. 83/84
khớp một đối tượng OSM hoặc Overture; Keangnam (tòa 72 tầng) không có khối nhà trên OSM nên lấy trung vị 21
điểm Overture mang tên tháp (lệch 10 m). Mọi địa danh giờ gắn `coords_verified_osm`.

Lỗi lớn nhất tìm được: chùa Kim Liên cũ nằm đúng toạ độ của **chùa Tứ Liên** (sai chùa, lệch 770 m); phố đi bộ
Trịnh Công Sơn lệch 1,6 km; Ngã Tư Sở lệch 800 m về phía nam; làng hoa Tây Tựu nằm ngoài phường Tây Tựu; chùa
Hà, Bảo tàng Hà Nội, ga Nhổn, ga Yên Nghĩa, chợ đầu mối phía Nam lệch 450-700 m.

| Địa danh | Dời (m) | Khớp với | Đối tượng OSM | Ghi chú |
| --- | ---: | --- | --- | --- |
| Làng hoa Tây Tựu | 3376 | Phường Tây Tựu | relation/19341251 | ruộng hoa trải khắp phường; neo vào trong phường Tây Tựu (2025) vì đối tượng mang tên duy nhất, 'Hoa Tây Tựu', là một cửa hàng |
| Phố đi bộ Trịnh Công Sơn | 1641 | Phố Trịnh Công Sơn | way/336713598 | phố Trịnh Công Sơn cạnh đầm sen Nhật Tân; ghim cũ lệch 1,6 km, gần phố Đặng Thai Mai |
| Công viên Yên Sở | 1467 | Công viên Yên Sở | way/770299553 |  |
| Công viên Thanh Xuân (hồ Nhân Chính) | 1349 | Công viên Thanh Xuân | way/497037748 |  |
| Ngã Tư Sở | 824 | Cầu vượt Ngã Tư Sở | way/1516401717 | chính nút giao: cầu vượt Ngã Tư Sở trên giao lộ Trường Chinh, Nguyễn Trãi, Láng, Tây Sơn; ghim cũ nằm cách 800 m về phía nam trên Nguyễn Trãi |
| Chùa Kim Liên | 772 | Chùa Kim Liên | điểm Overture (places) |  |
| Ga Nhổn (depot tuyến 3) | 741 | Ga Nhổn | way/872332873 |  |
| Chùa Hà | 687 | Chùa Hà | way/1118494921 |  |
| Đê sông Hồng đoạn Ngọc Thụy | 686 | Đường Ngọc Thụy | way/709678214 | đường Ngọc Thụy, đường trên mặt đê tả Hồng đoạn Ngọc Thụy |
| Công viên Hòa Bình | 671 | Công viên Hòa Bình | way/208188482 |  |
| Cầu Nhật Tân | 580 | Cầu Nhật Tân | way/251794091 |  |
| Hồ Linh Đàm | 568 | Hồ Linh Đàm | relation/12290505 |  |
| Bảo tàng Hà Nội | 541 | Bảo tàng Hà Nội | way/208255133 |  |
| Ga Yên Nghĩa (cuối tuyến 2A) | 528 | Ga Yên Nghĩa | way/512285534 |  |
| Chợ đầu mối phía Nam (Đền Lừ) | 522 | Nhà A chợ đầu mối phía Nam | way/1533194130 | nhà A chợ đầu mối phía Nam (Đền Lừ); khớp theo tên dễ nhầm sang công viên Đền Lừ |
| Bãi đá sông Hồng | 519 | Bãi đá Sông Hồng | way/1051466849 |  |
| Khu tập thể Kim Liên | 468 | Khu tập thể Kim Liên | way/888441068 |  |
| Bãi giữa sông Hồng | 465 | Đường Bãi Giữa | way/512285548 | đường Bãi Giữa, lối đi xuyên bãi bồi dưới chân cầu Long Biên; bản thân bãi không có vùng mang tên trên OSM |
| Đình Chèm | 436 | Đình Chèm | điểm Overture (places) |  |
| Ê Ông Mall Long Biên | 354 | AEON Mall Long Biên | way/840041412 |  |
| Hồ Văn Quán | 332 | Hồ Văn Quán | way/250707925 |  |
| Công viên Thủ Lệ (Vườn thú Hà Nội) | 321 | Công viên Thủ Lệ | way/28945667 |  |
| Trung tâm Hội nghị Quốc gia | 305 | Trung tâm Hội nghị Quốc gia Việt Nam | way/208251764 |  |
| Vườn đào Nhật Tân | 258 | Làng Đào Nhật Tân | điểm Overture (places) |  |
| Công viên Cầu Giấy | 258 | Công viên Cầu Giấy | way/181575389 |  |
| Phố sách Hà Nội (19 Tháng 12) | 251 | Phố Sách Hà Nội | way/1510802054 | khối phố sách trên phố 19 Tháng 12 (chuyển từ Đinh Lễ sang năm 2017) |
| Cầu Chương Dương | 250 | Cầu Chương Dương | way/874082897 |  |
| Con đường gốm sứ ven sông Hồng | 230 | Con đường Gốm sứ | relation/16791080 |  |
| Cầu Vĩnh Tuy | 205 | Cầu Vĩnh Tuy | way/874082898 |  |
| Ngõ Khương Đình (phòng trọ của Minh) | 194 | Ngõ 320 Đường Khương Đình | way/601424451 | phòng trọ của Minh là hư cấu nên đặt vào một ngõ có thật: ngõ 320 Khương Đình, phía sông Tô Lịch |
| Gò Đống Đa và tượng đài Quang Trung | 164 | Tượng đài Quang Trung | node/5485636741 | tượng đài Quang Trung, tài sản chính của công viên gò |
| Khu tập thể Giảng Võ | 154 | Khu tập thể Giảng Võ | way/1447295878 |  |
| Chợ Hôm - Đức Viên | 131 | Chợ Hôm | relation/11623141 |  |
| Cầu Long Biên | 77 | Cầu Long Biên | way/874082896 |  |

**Toạ độ chép theo.** 76 toạ độ trong nội dung khác là bản chép đúng từng số của ghim cũ (vật sưu tầm, điểm
bắt đầu nhiệm vụ, nhà và lịch của Minh, nhóm tài xế, ông Bảy bãi giữa...); chúng được dời theo. Toạ độ chỉ
"gần" địa danh (tiệm anh Đức, homestay Tô Ngọc Vân...) là nơi riêng, giữ nguyên. Nhiệm vụ `q_btl_03` (tàu Nhổn
sáu giờ) được sửa cho đúng thực tế (vùng ngập `bai_giua_phuc_xa` của đêm bão trong `flood_layers.json` cũng dời theo ghim bãi giữa mới): Lan gọi xe ôm ra ga Cầu Giấy (ga cuối trên cao của tuyến 3, toạ độ từ
OSM) rồi đi tàu tuyến 3 tới Nhổn; bản cũ ghi "đi bộ" từ phố cổ và dùng nhầm tàu tuyến 2A Cát Linh.

**Quận và phường sau sáp nhập.** Từ 1/7/2025 Hà Nội bỏ cấp quận; game giữ tên quận cũ làm vùng chơi
(`pipeline/districts.json`). Kiểm tra tự động lấy phường 2025 chứa mỗi ghim (ranh giới phường từ OSM qua
Overture) và so với danh sách phường của vùng. 77 địa danh khớp; 7 địa danh nằm ở phường gộp từ nhiều quận cũ (Hồng Hà ven sông, Văn Miếu - Quốc Tử Giám nhận một phần Cửa Nam, Khương Đình ở Ngã Tư Sở, Yên Hòa nhận một phần Mễ Trì nơi có tòa 72 tầng) và có ghi chú giải thích trong `game/reference/landmarks_osm.json`. Không địa danh nào bị gán sai vùng.

**Gốc toạ độ chung** (21.0288, 105.8524) nằm trong mặt nước Hồ Hoàn Kiếm theo OSM (relation 198437): đúng.

**CI khoá lại.** `game/reference/landmarks_osm.json` lưu đối tượng OSM và điểm tham chiếu của từng địa danh.
`tests/test_landmark_coords.py` (chạy offline) bắt lỗi nếu: một địa danh lệch quá 50 m khỏi điểm tham chiếu,
thiếu tham chiếu, khớp không có số hiệu OSM mà không ghi nguồn, vùng chơi không khớp phường 2025 mà không có ghi
chú, hoặc gốc toạ độ rời Hồ Gươm. Sửa toạ độ tay mà không chạy lại kiểm tra là CI đỏ.

Chạy lại (cần mạng tới S3, khoảng 3 phút):

    python tools/landmark_audit.py fetch
    python tools/landmark_audit.py audit          # báo cáo
    python tools/landmark_audit.py audit --fix    # dời ghim lệch, ghi lại tệp tham chiếu

Khi tên khớp nhầm (một quán cà phê mang tên địa danh), ghim tay trong khối `overrides` của tệp tham chiếu:
`{"osm": "way/123", "reason": "..."}`.

## 3. Âm lịch 2027

Tính lại bằng thời điểm sóc (trăng mới) theo giờ Hà Nội (UTC+7), thư viện thiên văn `ephem`:

| Mốc | Kết quả | Nội dung đang dùng |
| --- | --- | --- |
| Mùng 1 Tết Đinh Mùi | Thứ Bảy 6/2/2027 (sóc 22:56 ngày 6/2) | 6/2/2027: đúng |
| Rằm tháng Giêng | Thứ Bảy 20/2/2027 | 20/2/2027, thứ Bảy: đúng |
| Tháng Bảy âm (tháng cô hồn) | 2/8 đến 31/8/2027; rằm 16/8 | "hết tháng cô hồn cuối tháng Tám": đúng |
| Năm nhuận | Không có tháng nhuận (12 tuần trăng giữa hai tháng Mười Một) | đúng |
| 10/10/2027 | Chủ nhật; 73 năm ngày Giải phóng Thủ đô (1954) | đúng |

Không phải sửa gì ở phần lịch.
