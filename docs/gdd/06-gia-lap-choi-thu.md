# 06. Giả lập chơi thử (dry run) bản nháp v0

Sinh tự động bởi `tools/playtest.py`: đi qua toàn bộ nhiệm vụ như một người chơi, trên bản đồ 1:1, với nhịp ngày 48 phút. Bốn kiểu người chơi: **tử tế** (chọn đúng luật, giữ, nói thật), **liều** (vượt đèn, nhận việc, bán), **tối ưu tiền** (chọn theo tiền), **ngẫu nhiên**.

## Kết quả nhanh

- Nhiệm vụ: 25 (13 cốt truyện, 12 phụ). Không chơi tới được: không có.
- Lỗi logic chặn chơi: **0**. Cảnh báo (thời gian, khoảng cách): 0. Lựa chọn chưa có hệ quả: 5.
- Quận cốt truyện đi qua: 8/14 (ba_dinh, dong_da, hoan_kiem, long_bien, my_dinh, pho_co, tay_ho, thanh_xuan). Chưa bao giờ tới: bac_tu_liem, cau_giay, gia_lam, ha_dong, hai_ba_trung, hoang_mai.
- Địa danh dùng trong nhiệm vụ: 10/84. Nhân vật gặp qua thoại: 30/49.

## Mỗi kiểu người chơi

| Kiểu | Ngày game | Giờ chơi thật | Nhiệm vụ xong | Tiền Minh | Tiền Lan | Tiền Khôi | Km đi |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tu_te | 90 | 63.3 h | 25 | 3.8 tr | 106.4 tr | 77.6 tr | 138 |
| lieu | 120 | 86.8 h | 24 | -1.9 tr | 150.8 tr | 92.6 tr | 135 |
| toi_uu_tien | 90 | 63.3 h | 25 | 3.8 tr | 106.4 tr | 77.6 tr | 138 |
| ngau_nhien | 90 | 63.8 h | 25 | 3.9 tr | 106.4 tr | 77.6 tr | 144 |

Mục tiêu tiền lớn (GDD): tiệm Đức Còi 120 tr, cà phê trứng 450 tr, phần nhà cô Hạnh 3 tỷ. Sau toàn bộ nội dung đã viết (mở đầu + chương 1 + 12 nhiệm vụ phụ) Minh có khoảng 4 tr: còn xa mục tiêu đầu tiên, nghĩa là vòng lặp làm việc tự do phải gánh phần lớn tiến trình, đúng với thiết kế nhưng chương 2-5 cần các cú hích tiền từ truyện.

## Kinh tế của Minh theo số liệu GDD

- Thu một tháng chạy xe chăm: 10.5 tr. Chi: ăn uống, xăng, gửi xe 2.7 tr + trọ 2,5 tr + gửi về quê 6 tr = 11.2 tr. **Dư: -0.7 tr/tháng.**
- Với số liệu này Minh **không bao giờ** tự gom được 120 tr mua tiệm Đức Còi bằng chạy xe; mục tiêu đời của nhân vật chính chỉ đạt được qua tiền thưởng cốt truyện. Hoặc là chủ ý (chương 2-5 phải trả), hoặc là phải nâng thu nhập ngày / giảm khoản gửi quê (hiện gần bằng cả tháng dư).

## Hai cách chạy đồng hồ trong nhiệm vụ

- Đồng hồ 30x trong nhiệm vụ (như ngoài phố): 0 cảnh báo giờ/khoảng cách.
- Đồng hồ 1x trong nhiệm vụ: 1 cảnh báo: clock is 5.0h but the step wants [5.25, 6.5] (persona tu_te).
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

- Cờ do lựa chọn đặt: **34**, được đọc lại: **34** (100%), tổng 48 chỗ đọc. Chưa đọc: không.
- Loại hệ quả: dialogue_choice 3, dialogue_line 32, step_branch 2, step_variant 4.
- Cờ tiến trình (không do lựa chọn): 15, chưa đọc: biet_giay_1957, ket_thuc_chuong_1, khoi_hoc_tu_keo_ly.
- Hệ quả trả ngay trong chương 1 cho lựa chọn chương 0-1: 38 cặp (nhiệm vụ, cờ).
- Độ phân nhánh giữa các kiểu người chơi: 129/449 dòng thoại và 22 bước chỉ một phần người chơi thấy.
| Kiểu | Hệ quả kiểm tra | Đã kích hoạt | Cờ lựa chọn đã trả |
| --- | --- | --- | --- |
| tu_te | 64 | 28 | 19 |
| lieu | 65 | 32 | 20 |
| toi_uu_tien | 66 | 31 | 20 |
| ngau_nhien | 64 | 31 | 18 |

## Nhịp chơi

- 141 bước trong 25 nhiệm vụ: 65 bước thoại/cắt cảnh (46%), 49 bước hành động (34%: lái, giao, minigame, nấu, chụp), 6 bước lựa chọn tường minh.
- Nhiệm vụ dài nhất: c1_03_khach_vip_ca_ngay (59 phút thật); ngắn nhất: s04_thach_dau_khong_gps (4 phút). GTA5 thường 15-40 phút một nhiệm vụ truyện; các nhiệm vụ dưới 8 phút nên gộp hoặc thêm đoạn chơi.

## Lựa chọn chưa có hệ quả

- flag 'ho_so_sach_90_ngay' is set by the runtime (90 game days without a traffic violation (docs/gdd/02-he-thong.md)), required by ['s12_mu_bao_hiem_cho_be']
- flag 'minh_nghe_dien_thoai_khi_lai' is set by the runtime (gameplay: the player answered the phone while riding in c1_05 (docs/gdd/10 M2)), required by ['c1_05_mua_ngap_pho', 'dialogue:dlg_c1_05_mua']
- flag 'biet_giay_1957' set by ['c1_09_bua_toi_tang_72'] is never read (choice without consequence yet)
- flag 'ket_thuc_chuong_1' set by ['c1_09_bua_toi_tang_72'] is never read (choice without consequence yet)
- flag 'khoi_hoc_tu_keo_ly' set by ['c1_08_pho_di_bo_toi_thu_bay'] is never read (choice without consequence yet)

## Dòng thời gian (kiểu tử tế)

| Ngày | Giờ | Nhiệm vụ | NV | Phút thật | Kết quả |
| --- | --- | --- | --- | --- | --- |
| 2 | 23.6 | p0_ganh_pho_1957 | tho_1957 | 4.6 | success |
| 3 | 19.6 | p1_cuoc_xe_luc_rang_dong | minh | 29.1 | success (bỏ qua: bi_thoi) |
| 5 | 10.8 | p2_noi_nuoc_dung_4_gio | lan | 31.0 | success (bỏ qua: che, sua_nuoc_dung) |
| 6 | 9.0 | p3_tu_sat_tren_gac | khoi | 24.5 | success |
| 8 | 10.1 | c1_01_hoc_lai_xe_may | khoi | 56.2 | success (bỏ qua: thi_lai) |
| 9 | 18.5 | c1_02_xich_lo_va_buc_anh_1989 | khoi | 8.8 | success |
| 12 | 12.9 | c1_03_khach_vip_ca_ngay | minh | 58.8 | success (bỏ qua: ve_tro) |
| 16 | 4.2 | c1_04_cho_dong_xuan_luc_6_gio | lan | 15.2 | success (bỏ qua: ve_quan_re, sang_hom_sau_re, nem_re) |
| 18 | 11.1 | c1_05_mua_ngap_pho | minh | 52.6 | success (bỏ qua: chu_y_csgt) |
| 19 | 21.6 | c1_06_hop_to_dan_pho | lan | 4.2 | success |
| 20 | 15.2 | c1_07_mark_an_pho | lan | 12.5 | success (bỏ qua: viral_vua) |
| 22 | 3.7 | c1_08_pho_di_bo_toi_thu_bay | khoi | 17.4 | success |
| 24 | 23.0 | c1_09_bua_toi_tang_72 | khoi | 56.0 | success |
| 27 | 10.4 | s01_la_dong_cho_ba_tam | minh | 10.7 | success |
| 28 | 2.2 | s02_ky_thu_bo_ho | khoi | 22.5 | success |
| 28 | 7.9 | s03_mark_qua_duong | khoi | 10.8 | success |
| 28 | 18.6 | s04_thach_dau_khong_gps | minh | 3.6 | success |
| 29 | 7.8 | s05_anh_cuoi_cau_long_bien | khoi | 5.5 | success |
| 30 | 22.5 | s06_dieu_sao_bai_giua | minh | 13.0 | success |
| 31 | 13.6 | s07_xe_chet_may_sau_mua | minh | 9.0 | success |
| 32 | 4.6 | s08_tem_phieu_bao_cap | lan | 30.0 | success |
| 32 | 8.1 | s09_bien_hieu_hang_thiec | khoi | 5.5 | success |
| 33 | 6.4 | s10_vong_ho_tay_luc_5_gio | minh | 44.5 | success |
| 34 | 3.6 | s11_cu_ba_lac_duong | minh | 14.9 | success |
| 90 | 16.2 | s12_mu_bao_hiem_cho_be | minh | 12.8 | success |
