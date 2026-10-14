# 06. Giả lập chơi thử (dry run) bản nháp v0

Sinh tự động bởi `tools/playtest.py`: đi qua toàn bộ nhiệm vụ như một người chơi, trên bản đồ 1:1, với nhịp ngày 48 phút. Bốn kiểu người chơi: **tử tế** (chọn đúng luật, giữ, nói thật), **liều** (vượt đèn, nhận việc, bán), **tối ưu tiền** (chọn theo tiền), **ngẫu nhiên**.

## Kết quả nhanh

- Nhiệm vụ: 34 (20 cốt truyện, 14 phụ). Không chơi tới được: không có.
- Lỗi logic chặn chơi: **0**. Cảnh báo (thời gian, khoảng cách): 2. Lựa chọn chưa có hệ quả: 1.
- Quận cốt truyện đi qua: 9/14 (ba_dinh, dong_da, hoan_kiem, hoang_mai, long_bien, my_dinh, pho_co, tay_ho, thanh_xuan). Chưa bao giờ tới: bac_tu_liem, cau_giay, gia_lam, ha_dong, hai_ba_trung.
- Địa danh dùng trong nhiệm vụ: 11/84. Nhân vật gặp qua thoại: 34/51.

## Mỗi kiểu người chơi

| Kiểu | Ngày game | Giờ chơi thật | Nhiệm vụ xong | Tiền Minh | Tiền Lan | Tiền Khôi | Km đi |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tu_te | 90 | 63.9 h | 33 | -6.0 tr | 98.9 tr | 80.6 tr | 203 |
| lieu | 120 | 87.6 h | 32 | -11.7 tr | 158.3 tr | 95.6 tr | 200 |
| toi_uu_tien | 90 | 63.3 h | 34 | -1.5 tr | 95.9 tr | 79.6 tr | 222 |
| ngau_nhien | 90 | 63.4 h | 34 | -6.5 tr | 95.9 tr | 79.6 tr | 222 |

Mục tiêu tiền lớn (GDD): tiệm Đức Còi 120 tr, cà phê trứng 450 tr, phần nhà cô Hạnh 3 tỷ. Sau toàn bộ nội dung đã viết (mở đầu + chương 1 + 12 nhiệm vụ phụ) Minh có khoảng -6 tr: còn xa mục tiêu đầu tiên, nghĩa là vòng lặp làm việc tự do phải gánh phần lớn tiến trình, đúng với thiết kế nhưng chương 2-5 cần các cú hích tiền từ truyện.

## Kinh tế của Minh theo số liệu GDD

- Thu một tháng chạy xe chăm: 10.5 tr. Chi: ăn uống, xăng, gửi xe 2.7 tr + trọ 2,5 tr + gửi về quê 6 tr = 11.2 tr. **Dư: -0.7 tr/tháng.**
- Với số liệu này Minh **không bao giờ** tự gom được 120 tr mua tiệm Đức Còi bằng chạy xe; mục tiêu đời của nhân vật chính chỉ đạt được qua tiền thưởng cốt truyện. Hoặc là chủ ý (chương 2-5 phải trả), hoặc là phải nâng thu nhập ngày / giảm khoản gửi quê (hiện gần bằng cả tháng dư).

## Hai cách chạy đồng hồ trong nhiệm vụ

- Đồng hồ 30x trong nhiệm vụ (như ngoài phố): 2 cảnh báo giờ/khoảng cách.
- Đồng hồ 1x trong nhiệm vụ: 3 cảnh báo: clock is 6.2h but the step wants [16.5, 17.75] (persona tu_te); clock is 6.1h but the step wants [8, 11] (persona tu_te); clock is 5.0h but the step wants [5.25, 6.5] (persona tu_te).
- Đề xuất: trong nhiệm vụ cốt truyện, đồng hồ chạy giờ thật (1x) hoặc dừng khi đang thoại; khung giờ (`hours`) chỉ kiểm tra lúc bắt đầu bước; nhiệm vụ cần hoàng hôn/bình minh thêm `wait_until` trước bước chụp.

## Mở màn

| Kiểu | Phút thật tới lúc cầm lái | Tới lựa chọn đầu | Đoạn dài nhất không điều khiển (20 phút đầu) | Phút biết câu hỏi lớn (nhà, tờ giấy) |
| --- | --- | --- | --- | --- |
| tu_te | 0.4 | 2.6 | 2.4 | 2.6 |
| lieu | 0.4 | 2.6 | 2.4 | 2.6 |
| toi_uu_tien | 0.4 | 2.6 | 2.4 | 2.6 |
| ngau_nhien | 0.4 | 2.6 | 2.4 | 2.6 |

Chuẩn 5/5 (docs/gdd/07): cầm lái trước phút 1, lựa chọn đầu trước phút 3, không quá 3 phút liên tiếp chỉ xem, câu hỏi lớn được nói ra trước phút 5.

## Hệ quả lựa chọn

- Cờ do lựa chọn đặt: **57**, được đọc lại: **57** (100%), tổng 110 chỗ đọc. Chưa đọc: không.
- Loại hệ quả: dialogue_choice 5, dialogue_line 53, mission_gate 2, step_branch 5, step_variant 5.
- Cờ tiến trình (không do lựa chọn): 21, chưa đọc: không.
- Hệ quả trả ngay trong chương 1 cho lựa chọn chương 0-1: 35 cặp (nhiệm vụ, cờ).
- Độ phân nhánh giữa các kiểu người chơi: 188/635 dòng thoại và 22 bước chỉ một phần người chơi thấy.
| Kiểu | Hệ quả kiểm tra | Đã kích hoạt | Cờ lựa chọn đã trả |
| --- | --- | --- | --- |
| tu_te | 139 | 53 | 29 |
| lieu | 139 | 61 | 32 |
| toi_uu_tien | 141 | 58 | 31 |
| ngau_nhien | 139 | 61 | 31 |

## Nhịp chơi

- 192 bước trong 34 nhiệm vụ: 92 bước thoại/cắt cảnh (47%), 67 bước hành động (34%: lái, giao, minigame, nấu, chụp), 7 bước lựa chọn tường minh.
- Nhiệm vụ dài nhất: c2_07_giao_thua_ho_guom (62 phút thật); ngắn nhất: s04_thach_dau_khong_gps (4 phút). GTA5 thường 15-40 phút một nhiệm vụ truyện; các nhiệm vụ dưới 8 phút nên gộp hoặc thêm đoạn chơi.

## Cảnh báo thời gian và khoảng cách

Đồng hồ game chạy nhanh 30 lần (ngày 48 phút) trên bản đồ 1:1: một cuốc 5 km mất 13 phút thật = **6,5 giờ game**. Mọi bước có giờ cố định sau một chuyến đi dài đều bị lệch; đây là mâu thuẫn thiết kế lớn nhất mà giả lập phát hiện.

- `p3_tu_sat_tren_gac` / `chup_lai`: clock is 12.2h but the step wants [5.5, 7]
- `c1_02_xich_lo_va_buc_anh_1989` / `chup`: clock is 8.6h but the step wants [16.5, 17.75]

## Lựa chọn chưa có hệ quả

- flag 'ho_so_sach_90_ngay' is set by the runtime (90 game days without a traffic violation (docs/gdd/02-he-thong.md)), required by ['s12_mu_bao_hiem_cho_be']

## Dòng thời gian (kiểu tử tế)

| Ngày | Giờ | Nhiệm vụ | NV | Phút thật | Kết quả |
| --- | --- | --- | --- | --- | --- |
| 2 | 23.6 | p0_ganh_pho_1957 | tho_1957 | 4.6 | success |
| 3 | 19.6 | p1_cuoc_xe_luc_rang_dong | minh | 29.1 | success (bỏ qua: bi_thoi) |
| 5 | 10.8 | p2_noi_nuoc_dung_4_gio | lan | 38.0 | success (bỏ qua: che, sua_nuoc_dung) |
| 6 | 15.8 | p3_tu_sat_tren_gac | khoi | 24.5 | success |
| 8 | 10.1 | c1_01_hoc_lai_xe_may | khoi | 56.2 | success |
| 9 | 10.6 | c1_02_xich_lo_va_buc_anh_1989 | khoi | 8.8 | success |
| 12 | 12.9 | c1_03_khach_vip_ca_ngay | minh | 58.8 | success (bỏ qua: ve_tro) |
| 15 | 9.9 | c1_04_cho_dong_xuan_luc_6_gio | lan | 15.2 | success (bỏ qua: ve_quan_re, nem_re) |
| 17 | 12.3 | c1_05_mua_ngap_pho | minh | 55.1 | success |
| 18 | 21.6 | c1_06_hop_to_dan_pho | lan | 4.2 | success |
| 19 | 15.2 | c1_07_mark_an_pho | lan | 12.5 | success (bỏ qua: viral_vua) |
| 21 | 3.7 | c1_08_pho_di_bo_toi_thu_bay | khoi | 17.4 | success |
| 23 | 23.0 | c1_09_bua_toi_tang_72 | khoi | 56.0 | success |
| 24 | 20.8 | c2_01_cai_de_cua_ong_tu | minh | 25.6 | success |
| 27 | 3.5 | c2_02_ba_tam_anh_mot_cuon_bang | khoi | 41.3 | success |
| 28 | 14.9 | c2_03_phong_tham_dinh | lan | 12.8 | success (bỏ qua: thuyet_trinh, hoi_dap, loi_moi) |
| 29 | 19.9 | c2_04_nhom_anh_em_vo | minh | 25.8 | success |
| 30 | 17.2 | c2_05_ong_cong_ong_tao | lan | 15.9 | success |
| 33 | 19.8 | c2_06_chuc_tet | lan | 35.5 | success |
| 36 | 4.4 | c2_07_giao_thua_ho_guom | khoi | 61.7 | success (bỏ qua: da_ky) |
| 38 | 5.8 | s14_sang_mung_mot | minh | 47.5 | success |
| 39 | 10.3 | s01_la_dong_cho_ba_tam | minh | 10.7 | success |
| 40 | 1.5 | s02_ky_thu_bo_ho | khoi | 21.0 | success |
| 40 | 7.1 | s03_mark_qua_duong | khoi | 10.8 | success |
| 40 | 17.9 | s04_thach_dau_khong_gps | minh | 3.6 | success |
| 41 | 7.8 | s05_anh_cuoi_cau_long_bien | khoi | 5.5 | success |
| 42 | 22.5 | s06_dieu_sao_bai_giua | minh | 13.0 | success |
| 43 | 13.6 | s07_xe_chet_may_sau_mua | minh | 9.0 | success |
| 44 | 4.6 | s08_tem_phieu_bao_cap | lan | 30.0 | success |
| 44 | 8.1 | s09_bien_hieu_hang_thiec | khoi | 5.5 | success |
| 45 | 5.6 | s10_vong_ho_tay_luc_5_gio | minh | 43.0 | success |
| 46 | 3.6 | s11_cu_ba_lac_duong | minh | 14.9 | success |
| 90 | 16.2 | s12_mu_bao_hiem_cho_be | minh | 12.8 | success |
