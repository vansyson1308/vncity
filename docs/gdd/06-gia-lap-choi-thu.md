# 06. Giả lập chơi thử (dry run) bản nháp v0

Sinh tự động bởi `tools/playtest.py`: đi qua toàn bộ nhiệm vụ như một người chơi, trên bản đồ 1:1, với nhịp ngày 48 phút. Bốn kiểu người chơi: **tử tế** (chọn đúng luật, giữ, nói thật), **liều** (vượt đèn, nhận việc, bán), **tối ưu tiền** (chọn theo tiền), **ngẫu nhiên**.

## Kết quả nhanh

- Nhiệm vụ: 24 (12 cốt truyện, 12 phụ). Không chơi tới được: không có.
- Lỗi logic chặn chơi: **0**. Cảnh báo (thời gian, khoảng cách): 3. Lựa chọn chưa có hệ quả: 33.
- Quận cốt truyện đi qua: 8/14 (ba_dinh, dong_da, hoan_kiem, long_bien, my_dinh, pho_co, tay_ho, thanh_xuan). Chưa bao giờ tới: bac_tu_liem, cau_giay, gia_lam, ha_dong, hai_ba_trung, hoang_mai.
- Địa danh dùng trong nhiệm vụ: 10/84. Nhân vật gặp qua thoại: 27/44.

## Mỗi kiểu người chơi

| Kiểu | Ngày game | Giờ chơi thật | Nhiệm vụ xong | Tiền Minh | Tiền Lan | Tiền Khôi | Km đi |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tu_te | 90 | 67.4 h | 24 | 4.6 tr | 110.8 tr | 79.1 tr | 174 |
| lieu | 120 | 91.1 h | 23 | -1.1 tr | 155.2 tr | 94.1 tr | 170 |
| toi_uu_tien | 90 | 67.4 h | 24 | 4.6 tr | 110.8 tr | 79.1 tr | 174 |
| ngau_nhien | 90 | 67.3 h | 24 | 4.7 tr | 110.8 tr | 79.1 tr | 173 |

Mục tiêu tiền lớn (GDD): tiệm Đức Còi 120 tr, cà phê trứng 450 tr, phần nhà cô Hạnh 3 tỷ. Sau toàn bộ nội dung đã viết (mở đầu + chương 1 + 12 nhiệm vụ phụ) Minh có khoảng 5 tr: còn xa mục tiêu đầu tiên, nghĩa là vòng lặp làm việc tự do phải gánh phần lớn tiến trình, đúng với thiết kế nhưng chương 2-5 cần các cú hích tiền từ truyện.

## Kinh tế của Minh theo số liệu GDD

- Thu một tháng chạy xe chăm: 10.5 tr. Chi: ăn uống, xăng, gửi xe 2.7 tr + trọ 2,5 tr + gửi về quê 6 tr = 11.2 tr. **Dư: -0.7 tr/tháng.**
- Với số liệu này Minh **không bao giờ** tự gom được 120 tr mua tiệm Đức Còi bằng chạy xe; mục tiêu đời của nhân vật chính chỉ đạt được qua tiền thưởng cốt truyện. Hoặc là chủ ý (chương 2-5 phải trả), hoặc là phải nâng thu nhập ngày / giảm khoản gửi quê (hiện gần bằng cả tháng dư).

## Hai cách chạy đồng hồ trong nhiệm vụ

- Đồng hồ 30x trong nhiệm vụ (như ngoài phố): 3 cảnh báo giờ/khoảng cách.
- Đồng hồ 1x trong nhiệm vụ: 2 cảnh báo: clock is 6.2h but the step wants [16.5, 17.75] (persona tu_te); clock is 5.1h but the step wants [5.25, 6.5] (persona tu_te).
- Đề xuất: trong nhiệm vụ cốt truyện, đồng hồ chạy giờ thật (1x) hoặc dừng khi đang thoại; khung giờ (`hours`) chỉ kiểm tra lúc bắt đầu bước; nhiệm vụ cần hoàng hôn/bình minh thêm `wait_until` trước bước chụp.

## Nhịp chơi

- 126 bước trong 24 nhiệm vụ: 57 bước thoại/cắt cảnh (45%), 49 bước hành động (38%: lái, giao, minigame, nấu, chụp), 4 bước lựa chọn tường minh.
- Nhiệm vụ dài nhất: c1_03_khach_vip_ca_ngay (71 phút thật); ngắn nhất: c1_06_hop_to_dan_pho (4 phút). GTA5 thường 15-40 phút một nhiệm vụ truyện; các nhiệm vụ dưới 8 phút nên gộp hoặc thêm đoạn chơi.

## Cảnh báo thời gian và khoảng cách

Đồng hồ game chạy nhanh 30 lần (ngày 48 phút) trên bản đồ 1:1: một cuốc 5 km mất 13 phút thật = **6,5 giờ game**. Mọi bước có giờ cố định sau một chuyến đi dài đều bị lệch; đây là mâu thuẫn thiết kế lớn nhất mà giả lập phát hiện.

- `p3_tu_sat_tren_gac` / `chup_lai`: clock is 12.2h but the step wants [5.5, 7]
- `c1_02_xich_lo_va_buc_anh_1989` / `chup`: clock is 8.6h but the step wants [16.5, 17.75]
- `s05_anh_cuoi_cau_long_bien` / `chup_cuoi`: clock is 7.2h but the step wants [5.25, 6.5]

## Lựa chọn chưa có hệ quả

- flag 'ho_so_sach_90_ngay' is set by the runtime (90 game days without a traffic violation (docs/gdd/02-he-thong.md)), required by ['s12_mu_bao_hiem_cho_be']
- flag 'biet_chuyen_ban_nha' set by ['p2_noi_nuoc_dung_4_gio'] is never read (choice without consequence yet)
- flag 'biet_giay_1957' set by ['c1_09_bua_toi_tang_72'] is never read (choice without consequence yet)
- flag 'da_hop_to_dan_pho' set by ['c1_06_hop_to_dan_pho'] is never read (choice without consequence yet)
- flag 'duoc_do_o_quan_chuong' set by ['s04_thach_dau_khong_gps'] is never read (choice without consequence yet)
- flag 'gap_khoi' set by ['p1_cuoc_xe_luc_rang_dong'] is never read (choice without consequence yet)
- flag 'gap_lan' set by ['p1_cuoc_xe_luc_rang_dong'] is never read (choice without consequence yet)
- flag 'giam_chu_y_vinh_vien_1' set by ['s12_mu_bao_hiem_cho_be'] is never read (choice without consequence yet)
- flag 'giay_khen_an_toan_giao_thong' set by ['s12_mu_bao_hiem_cho_be'] is never read (choice without consequence yet)
- flag 'ket_thuc_chuong_1' set by ['c1_09_bua_toi_tang_72'] is never read (choice without consequence yet)
- flag 'khoi_chua_quyet' set by ['dialogue:dlg_c1_02_hoang_hon'] is never read (choice without consequence yet)
- flag 'khoi_co_bang_a1' set by ['c1_01_hoc_lai_xe_may'] is never read (choice without consequence yet)
- flag 'khoi_giu_ban_goc' set by ['dialogue:dlg_c1_08_thao_va_buc_anh'] is never read (choice without consequence yet)
- flag 'khoi_nghieng_ban' set by ['dialogue:dlg_c1_02_hoang_hon'] is never read (choice without consequence yet)
- flag 'khoi_nghieng_o_lai' set by ['dialogue:dlg_c1_02_hoang_hon'] is never read (choice without consequence yet)
- flag 'khoi_tang_anh_thao' set by ['dialogue:dlg_c1_08_thao_va_buc_anh'] is never read (choice without consequence yet)
- flag 'khoi_xin_thoi_gian' set by ['dialogue:dlg_c1_06_hop'] is never read (choice without consequence yet)
- flag 'lan_biet_danh_sach' set by ['c1_03_khach_vip_ca_ngay'] is never read (choice without consequence yet)
- flag 'lan_doi_dau_co_hanh' set by ['dialogue:dlg_p2_co_hanh'] is never read (choice without consequence yet)
- flag 'lan_moi_vinh_dau_tu_tu_quan' set by ['dialogue:dlg_c1_09_vinh'] is never read (choice without consequence yet)
- flag 'lan_pho_co_dien' set by ['dialogue:dlg_c1_07_mark_den'] is never read (choice without consequence yet)
- flag 'lan_tinh_no_cho_co' set by ['dialogue:dlg_p2_co_hanh'] is never read (choice without consequence yet)
- flag 'lan_tu_choi_vinh' set by ['dialogue:dlg_c1_09_vinh'] is never read (choice without consequence yet)
- flag 'lan_xin_thoi_gian' set by ['dialogue:dlg_c1_09_vinh'] is never read (choice without consequence yet)
- flag 'linh_dang_anh_thao' set by ['dialogue:dlg_c1_08_thao_va_buc_anh'] is never read (choice without consequence yet)
- flag 'minh_giu_kin_danh_sach' set by ['c1_03_khach_vip_ca_ngay'] is never read (choice without consequence yet)
- flag 'minh_lai_xe_khong_do_la' set by ['dialogue:dlg_c1_03_loi_moi'] is never read (choice without consequence yet)
- flag 'minh_nhan_viec_kim_long' set by ['dialogue:dlg_c1_03_loi_moi'] is never read (choice without consequence yet)
- flag 'minh_suy_nghi' set by ['dialogue:dlg_c1_03_loi_moi'] is never read (choice without consequence yet)
- flag 'mo_kho_anh' set by ['p3_tu_sat_tren_gac'] is never read (choice without consequence yet)
- flag 'quen_ong_thang' set by ['c1_02_xich_lo_va_buc_anh_1989'] is never read (choice without consequence yet)
- flag 'tang_tem_phieu_bao_tang' set by ['s08_tem_phieu_bao_cap'] is never read (choice without consequence yet)
- flag 'video_mark_viral' set by ['c1_07_mark_an_pho'] is never read (choice without consequence yet)

## Dòng thời gian (kiểu tử tế)

| Ngày | Giờ | Nhiệm vụ | NV | Phút thật | Kết quả |
| --- | --- | --- | --- | --- | --- |
| 1 | 19.6 | p1_cuoc_xe_luc_rang_dong | minh | 29.1 | success (bỏ qua: bi_thoi) |
| 4 | 10.8 | p2_noi_nuoc_dung_4_gio | lan | 38.0 | success (bỏ qua: che, sua_nuoc_dung) |
| 6 | 15.8 | p3_tu_sat_tren_gac | khoi | 24.5 | success |
| 9 | 10.1 | c1_01_hoc_lai_xe_may | khoi | 56.2 | success |
| 10 | 10.6 | c1_02_xich_lo_va_buc_anh_1989 | khoi | 8.8 | success |
| 13 | 18.9 | c1_03_khach_vip_ca_ngay | minh | 70.7 | success (bỏ qua: ve_tro) |
| 16 | 9.9 | c1_04_cho_dong_xuan_luc_6_gio | lan | 15.7 | success (bỏ qua: ve_quan_re, nem_re) |
| 18 | 18.6 | c1_05_mua_ngap_pho | minh | 60.6 | success |
| 19 | 21.7 | c1_06_hop_to_dan_pho | lan | 4.4 | success |
| 20 | 15.0 | c1_07_mark_an_pho | lan | 12.0 | success |
| 22 | 3.7 | c1_08_pho_di_bo_toi_thu_bay | khoi | 17.4 | success |
| 24 | 23.0 | c1_09_bua_toi_tang_72 | khoi | 56.0 | success |
| 26 | 19.1 | s01_la_dong_cho_ba_tam | minh | 28.3 | success |
| 28 | 2.6 | s02_ky_thu_bo_ho | khoi | 23.1 | success |
| 28 | 8.2 | s03_mark_qua_duong | khoi | 10.8 | success |
| 28 | 20.3 | s04_thach_dau_khong_gps | minh | 21.2 | success |
| 29 | 9.2 | s05_anh_cuoi_cau_long_bien | khoi | 8.4 | success |
| 30 | 9.1 | s06_dieu_sao_bai_giua | minh | 34.2 | success |
| 31 | 0.2 | s07_xe_chet_may_sau_mua | minh | 9.0 | success |
| 31 | 24.0 | s08_tem_phieu_bao_cap | lan | 30.0 | success |
| 32 | 4.3 | s09_bien_hieu_hang_thiec | khoi | 7.0 | success |
| 33 | 9.8 | s10_vong_ho_tay_luc_5_gio | minh | 43.0 | success |
| 34 | 3.6 | s11_cu_ba_lac_duong | minh | 14.9 | success |
| 90 | 16.2 | s12_mu_bao_hiem_cho_be | minh | 12.8 | success |
