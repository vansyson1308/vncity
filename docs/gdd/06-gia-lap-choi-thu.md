# 06. Giả lập chơi thử (dry run) bản nháp v0

Sinh tự động bởi `tools/playtest.py`: đi qua toàn bộ nhiệm vụ như một người chơi, trên bản đồ 1:1, với nhịp ngày 48 phút. Bốn kiểu người chơi: **tử tế** (chọn đúng luật, giữ, nói thật), **liều** (vượt đèn, nhận việc, bán), **tối ưu tiền** (chọn theo tiền), **ngẫu nhiên**.

## Kết quả nhanh

- Nhiệm vụ: 62 (21 cốt truyện, 41 phụ). Không chơi tới được: không có.
- Lỗi logic chặn chơi: **0**. Cảnh báo (thời gian, khoảng cách): 0. Lựa chọn chưa có hệ quả: 3.
- Quận cốt truyện đi qua: 14/14 (ba_dinh, bac_tu_liem, cau_giay, dong_da, gia_lam, ha_dong, hai_ba_trung, hoan_kiem, hoang_mai, long_bien, my_dinh, pho_co, tay_ho, thanh_xuan). Chưa bao giờ tới: không.
- Địa danh dùng trong nhiệm vụ: 36/84. Nhân vật gặp qua thoại: 57/70.

## Mỗi kiểu người chơi

| Kiểu | Ngày game | Giờ chơi thật | Nhiệm vụ xong | Tiền Minh | Tiền Lan | Tiền Khôi | Km đi |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tu_te | 101 | 50.2 h | 61 | 13.1 tr | 41.8 tr | 58.6 tr | 570 |
| lieu | 120 | 65.0 h | 60 | 7.1 tr | 76.4 tr | 69.1 tr | 549 |
| toi_uu_tien | 101 | 50.1 h | 62 | 18.2 tr | 41.8 tr | 62.1 tr | 565 |
| ngau_nhien | 105 | 50.1 h | 61 | -4.1 tr | 41.6 tr | 61.6 tr | 559 |

Mục tiêu tiền lớn (GDD): tiệm Đức Còi 120 tr, cà phê trứng 450 tr, phần nhà cô Hạnh 3 tỷ. Sau toàn bộ nội dung đã viết (mở đầu + chương 1 + 12 nhiệm vụ phụ) Minh có khoảng 13 tr: còn xa mục tiêu đầu tiên, nghĩa là vòng lặp làm việc tự do phải gánh phần lớn tiến trình, đúng với thiết kế nhưng chương 2-5 cần các cú hích tiền từ truyện.

## Kinh tế của Minh theo số liệu GDD

- Chỉ chạy xe: thu 10.5 tr/tháng. Chi: ăn uống, xăng, gửi xe 2.7 tr + trọ 2.5 tr + gửi mẹ 2 tr + trả góp viện phí 4 tr (60 tháng) = 11.2 tr. **Dư: -0.7 tr/tháng.** Đây là nỗi khổ của Minh, đúng thiết kế: một mình app không nuôi được anh.
- Chăm và đi đủ các bậc (tối sửa xe ở tiệm Đức, 30 khách quen gọi điện không mất 30% app, thưởng tuần 60 cuốc): thu 17.0 tr, **dư 5.8 tr/tháng**. Góp vốn 40 tr với anh Đức sau 6.9 tháng game (165 giờ chơi thật); mua đứt 120 tr sau 20.6 tháng nếu không có tiền truyện.
- Một lần vượt đèn đỏ (5 tr) xóa một tháng dư của người chăm; hết nợ viện phí (tháng 60) Minh dư thêm 4 tr/tháng.

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

- Cờ do lựa chọn đặt: **115**, được đọc lại: **115** (100%), tổng 227 chỗ đọc. Chưa đọc: không.
- Loại hệ quả: dialogue_choice 8, dialogue_line 113, mission_gate 2, step_branch 10, step_variant 4.
- Cờ tiến trình (không do lựa chọn): 22, chưa đọc: da_xong_dat.
- Hệ quả trả ngay trong chương 1 cho lựa chọn chương 0-1: 40 cặp (nhiệm vụ, cờ).
- Độ phân nhánh giữa các kiểu người chơi: 363/1103 dòng thoại và 45 bước chỉ một phần người chơi thấy.
| Kiểu | Hệ quả kiểm tra | Đã kích hoạt | Cờ lựa chọn đã trả |
| --- | --- | --- | --- |
| tu_te | 223 | 102 | 57 |
| lieu | 234 | 105 | 58 |
| toi_uu_tien | 229 | 105 | 59 |
| ngau_nhien | 231 | 103 | 55 |

## Nhịp chơi

- 340 bước trong 62 nhiệm vụ: 160 bước thoại/cắt cảnh (47%), 126 bước hành động (37%: lái, giao, minigame, nấu, chụp), 13 bước lựa chọn tường minh.
- Nhiệm vụ dài nhất: c2_06_cho_hoa_hang_luoc (111 phút thật); ngắn nhất: s04_thach_dau_khong_gps (4 phút). GTA5 thường 15-40 phút một nhiệm vụ truyện; các nhiệm vụ dưới 8 phút nên gộp hoặc thêm đoạn chơi.

## Lựa chọn chưa có hệ quả

- flag 'ho_so_sach_90_ngay' is set by the runtime (90 game days without a traffic violation (docs/gdd/02-he-thong.md)), required by ['s12_mu_bao_hiem_cho_be']
- flag 'minh_nghe_dien_thoai_khi_lai' is set by the runtime (gameplay: the player answered the phone while riding in c1_05 (docs/gdd/10 M2)), required by ['c1_05_mua_ngap_pho', 'dialogue:dlg_c1_05_mua', 'dialogue:dlg_c2_03_hai', 'q_md_02_dem_doi_tuyen']
- flag 'da_xong_dat' set by ['c2_08_xong_dat'] is never read (choice without consequence yet)

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
| 27 | 20.4 | c2_01_bang_so_12 | khoi | 24.5 | success (bỏ qua: ga_sai_nang, cho_sang_ga, cho_hom_mai, kim_lien_mai) |
| 30 | 13.2 | c2_02_ngan_hang_cu_goi | lan | 46.7 | success (bỏ qua: thuyet_trinh, hoi_dap, hoi_dap_truot) |
| 32 | 4.6 | c2_03_danh_sach_thu_hai | minh | 45.3 | success |
| 34 | 21.9 | c2_04_giay_uy_quyen | minh | 27.8 | success (bỏ qua: goi_cuong, goi_thao) |
| 40 | 12.7 | c2_05_ong_cong_ong_tao | lan | 110.4 | success (bỏ qua: tra_them) |
| 45 | 5.6 | c2_06_cho_hoa_hang_luoc | khoi | 110.8 | success (bỏ qua: hang_luoc_mai, chup_minh_lai) |
| 51 | 1.0 | c2_07_giao_thua_ho_guom | minh | 22.3 | success (bỏ qua: sua_mam, chup_lai_phao) |
| 54 | 6.8 | c2_08_xong_dat | minh | 22.1 | success (bỏ qua: khoi_xong) |
| 59 | 5.5 | s13_hoa_tet_tay_tuu | minh | 74.6 | success |
| 61 | 9.5 | q_btl_01_cuc_ram_thang_bay | minh | 41.4 | success (bỏ qua: chay_duong_32) |
| 62 | 2.1 | q_btl_02_nuoc_len_dinh_chem | khoi | 33.3 | success (bỏ qua: chup_lai) |
| 63 | 3.8 | q_btl_03_ga_nhon_di_lam | lan | 44.1 | success (bỏ qua: cam_lai) |
| 63 | 18.9 | q_cg_01_hoa_hong_chua_ha | minh | 10.9 | success |
| 64 | 18.7 | q_cg_02_anh_nha_rong | khoi | 5.5 | success |
| 65 | 18.2 | q_cg_03_bai_bao_xe_om | minh | 7.4 | success |
| 67 | 21.1 | q_gl_01_sau_muoi_bat | minh | 58.8 | success |
| 68 | 15.3 | q_hbt_01_tap_de_cho_hom | lan | 8.0 | success |
| 69 | 2.5 | q_hbt_02_cuon_vai_bach_khoa | minh | 9.4 | success |
| 70 | 0.6 | q_hbt_03_dem_hoa_sua | khoi | 6.0 | success |
| 71 | 11.2 | q_hd_01_tau_cuoi_yen_nghia | minh | 14.6 | success |
| 73 | 1.7 | q_hd_02_lua_that_lua_gia | lan | 33.4 | success (bỏ qua: thu_lai) |
| 74 | 6.9 | q_hd_03_anh_cho_shop_lua | khoi | 33.9 | success |
| 76 | 1.3 | q_hd_04_so_khach_quen | minh | 28.7 | success |
| 76 | 11.8 | q_hm_01_rau_den_lu | lan | 21.0 | success (bỏ qua: tra_du) |
| 78 | 8.2 | q_gl_02_ve_bat_pho_tho | lan | 31.8 | success (bỏ qua: ve_lai) |
| 79 | 22.2 | q_gl_03_tuong_than_to_ong | khoi | 31.4 | success (bỏ qua: chup_lai) |
| 81 | 17.2 | q_hm_02_thang_may_hong | minh | 30.8 | success |
| 82 | 8.5 | q_hm_03_dieu_yen_so | khoi | 30.6 | success (bỏ qua: chup_lai) |
| 83 | 17.8 | q_md_01_ben_xe_5_gio_sang | minh | 25.5 | success (bỏ qua: cho_dung) |
| 85 | 14.1 | q_md_02_dem_doi_tuyen | minh | 72.8 | success (bỏ qua: ve_som) |
| 86 | 5.8 | q_tx_01_tang_tien_tro | minh | 5.1 | success (bỏ qua: sua_bom, goi_duc) |
| 87 | 16.5 | q_tx_02_song_to_lich | khoi | 23.6 | success (bỏ qua: chup_lai) |
| 89 | 7.4 | q_md_03_bao_tang_ha_noi | khoi | 27.2 | success |
| 90 | 1.6 | q_tx_03_san_bang_royal | lan | 21.2 | success (bỏ qua: nem_lai) |
| 91 | 14.5 | q_md_04_khai_mac | lan | 26.2 | success |
| 93 | 10.4 | s01_la_dong_cho_ba_tam | minh | 10.7 | success |
| 94 | 2.2 | s02_ky_thu_bo_ho | khoi | 22.5 | success |
| 94 | 7.9 | s03_mark_qua_duong | khoi | 10.8 | success |
| 94 | 18.6 | s04_thach_dau_khong_gps | minh | 3.6 | success |
| 95 | 7.8 | s05_anh_cuoi_cau_long_bien | khoi | 5.5 | success |
| 96 | 22.5 | s06_dieu_sao_bai_giua | minh | 13.0 | success |
| 97 | 13.6 | s07_xe_chet_may_sau_mua | minh | 9.0 | success |
| 98 | 0.8 | q_tx_04_gop_von_duc_coi | minh | 8.8 | success (bỏ qua: sua_lai) |
| 98 | 15.8 | s08_tem_phieu_bao_cap | lan | 30.0 | success |
| 98 | 19.3 | s09_bien_hieu_hang_thiec | khoi | 5.5 | success |
| 99 | 17.6 | s10_vong_ho_tay_luc_5_gio | minh | 44.5 | success |
| 100 | 3.6 | s11_cu_ba_lac_duong | minh | 14.9 | success |
| 101 | 16.2 | s12_mu_bao_hiem_cho_be | minh | 12.8 | success |
