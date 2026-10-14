# 12. Hồ sơ tám quận: nhiệm vụ người lạ và nhân vật theo Tứ diệu đế

Trả lời yêu cầu của chủ dự án (14/10/2026): "6/14 quận chưa có truyện thì phải làm nốt 8 quận còn lại
cho đủ... sửa đổi nó theo triết lý Tứ diệu đế của Đức Phật". Chương 2 (PR #9) đã đưa cốt truyện đi qua
cả 14 quận; tài liệu này bổ sung phần còn thiếu: **mỗi quận có người của quận đó, với nỗi khổ của quận
đó, và 3-4 nhiệm vụ mà người chơi phải xuống xe**. Dữ liệu: `game/content/missions/side_districts.json`
(27 nhiệm vụ), `game/content/dialogues/side_districts.json` (59 đoạn thoại), 15 nhân vật mới trong
`characters/story.json`, mỗi người có khối `drive` (Khổ-Tập-Diệt-Đạo-tell) như `08-nhan-qua.md` §1.

## 1. Nguyên tắc áp cho cả tám quận

1. **Khổ của quận là khổ thật.** Mỗi quận chọn một vết đau có thật, đang diễn ra, kiểm chứng được
   (xem nguồn ở §11): HH Linh Đàm một vạn căn không sổ đỏ, Tô Lịch nạo vét trước hạn tháng 9/2025,
   Vạn Phúc bán lụa Quảng Châu dán tên làng, Bát Tràng bỏ lò than, bến Mỹ Đình cò vây khách tỉnh,
   Yên Nghĩa xe ôm mất khách vì tàu điện và app, Tây Tựu nợ nhà màng sau bão, chợ Hôm sạp vải lỗ,
   chùa Hà cầu duyên và ship hoa.
2. **Tập là cái người ta bám vào**, không phải "tính xấu": bà Cúc bám giá một lời, ông Phúc bám việc
   không về phố, chú Bình bám tờ đơn, cô Thắm bám im lặng, Tí bám lượt xem. Thoại của họ chỉ nói
   điều khối `tap` cho phép.
3. **Diệt là mục đích họ tin**, và người chơi có thể giúp hoặc không giúp họ tới đó. Không có nhân vật
   "cần một cuốc xe".
4. **Đạo là hành vi trong game**: cái họ làm khi người chơi đến và sau khi người chơi đi. Mọi dòng thoại
   có điều kiện đọc lại cờ đều là một mẩu "đạo" của nhân vật.
5. **Mỗi lựa chọn có hệ quả**: 44 cờ lựa chọn mới, mỗi cờ được đọc lại ít nhất một lần trong cung
   của quận và một lần ở quận khác hoặc ở đêm khai mạc (§10). `tools/playtest.py`: 113/113 cờ lựa
   chọn toàn game được đọc, 220 chỗ đọc, 0 lỗi, 0 cảnh báo. Kiểm tra trong `tests/test_playtest.py`.
6. **Khó dần, thua có giá, không chết**: minigame mặc cả, đốt sợi lụa, cắm hoa, vẽ men, sửa máy bơm,
   nấu phở, ba lần chụp ngược sáng/mưa/bùn đều có nhánh `chua_dat`: làm lại, mất tiền, hoặc mất
   mặt, không bao giờ `fail`.
7. **Đồng hồ 30x**: không đặt `deadline_hour` lên bước đi đường (9 km mất 14 giờ game); áp lực giờ
   dùng `time_limit_s` (giây thật) trên bước đi, và `hours` ở `requires` để nhiệm vụ chỉ nhận lúc
   đúng giờ (chợ đêm 1-2h30, tàu cuối 21h45-22h15, xe Lào Cai 4h30-5h).

## 2. Cầu Giấy: người trẻ mới lên phố

| | |
|---|---|
| Khổ của quận | Sinh viên trọ quanh Đại học Quốc gia và Học viện Báo chí: tiền trọ tăng, làm thêm ship hoa cho người đi lễ chùa Hà cầu duyên (mùng Một, bảy bông hồng đỏ); Bảo tàng Dân tộc học có nhà rông Ba Na mang từ Kon Tum ra, người bảo vệ cấm chân máy |
| Hương (sinh viên Báo chí, 21) | Khổ: trọ tăng, bài xấu, sợ bị gọi "làm màu". Tập: tin nổi nhanh là thành công. Diệt: được công nhận vì bài của mình. Đạo: ship hoa, bật ghi âm, xin ảnh, học khi bị từ chối |
| Ông Phúc (bảo vệ bảo tàng, 63) | Khổ: người đầu tiên bán nhà ở dãy 23 Hàng Bạc (1995), mang tiếng, ba mươi năm không về phố. Tập: coi việc không quay lại là hình phạt. Diệt: xin lỗi được ông Thọ, số 49 không phải nhà cuối. Đạo: cấm chân máy, kể "hồi ở Hàng Bạc" rồi im, gửi lời qua con ông Khải |

| Nhiệm vụ | Ai | Giờ | Lựa chọn → cờ | Đọc lại ở |
|---|---|---|---|---|
| q_cg_01 Hoa hồng cho chùa Hà | Minh | 5-6h30 | đòi mũ cho Hương / không; nói thật với khách về bó hoa dập / giấu | q_cg_02 (Hương kể với Khôi, ba biến thể), q_cg_03 |
| q_cg_02 Nhà rông giữa Cầu Giấy | Khôi | 8h30-16h | cho Hương năm khung / dạy chụp | q_cg_03 (điểm bài), q_md_03 (chị Quỳnh biết qua giảng viên) |
| q_cg_03 Bài báo về xe ôm | Minh | 6-7h | nói thật app cắt 30% / "ổn" | q_hd_01 (ông Lương đọc báo), q_tx_01 (bà chủ trọ đọc báo), q_md_02 |

## 3. Hai Bà Trưng: chợ truyền thống và trường kỹ thuật

| | |
|---|---|
| Khổ của quận | Chợ Hôm tầng hai: sạp vải khách già đi, khách trẻ mua online; Bách Khoa cách chợ một cây số, sinh viên dựng sân khấu hội trường; mùa hoa sữa hồ Thiền Quang |
| Bà Nhung (sạp vải 214, 58) | Khổ: lỗ ba tháng, chồng mất. Tập: đóng sạp là chồng mất lần hai. Diệt: sạp còn người hỏi. Đạo: bán bằng tay sờ, thêu tên không lấy tiền, thử livestream nếu người lạ rủ |
| Đạt (Bách Khoa, 22) | Khổ: cộng sổ thấy mẹ lỗ, nói thì mẹ khóc. Tập: số liệu cứu được mẹ. Diệt: mẹ được nghỉ hoặc sạp sống thật. Đạo: nhờ người lạ nói hộ, dựng live đầu tiên |

| Nhiệm vụ | Ai | Giờ | Lựa chọn → cờ | Đọc lại ở |
|---|---|---|---|---|
| q_hbt_01 Sáu cái tạp dề | Lan | 8-16h30 | lụa Vạn Phúc / vải pha | q_hbt_02, q_hbt_03, q_hd_02 (cô Thắm là người dệt tấm ấy), q_md_04 |
| q_hbt_02 Bốn mươi cân vải | Minh | 13-17h | giúp livestream / từ chối | q_hbt_03 (ai dựng đèn) |
| q_hbt_03 Đêm hoa sữa Thiền Quang | Khôi | 18h30-20h | tặng ảnh chợ Hôm 1989 / giữ | q_md_03 (bà Nhung cho mượn hay phải đi xe buýt ra Mỹ Đình xem mẹ chồng) |

## 4. Hoàng Mai: chợ đêm và chung cư vạn dân

| | |
|---|---|
| Khổ của quận | Chợ đầu mối Đền Lừ họp 1-5h sáng; công viên Yên Sở xây trên ruộng rau Yên Sở (lấy đất 2009); tổ hợp HH Linh Đàm 12 tòa, gần một vạn căn chưa có sổ đỏ, thang máy sự cố liên tục |
| Bà Cúc (rau đêm Đền Lừ, 61) | Khổ: mất ba sào rau 2009, thuê ruộng xa, bị gọi "rau Tàu". Tập: rau nhà phải bán đúng giá rau nhà, chỉ xuống giá một lần. Diệt: có người mua vì biết rau ở đâu ra. Đạo: không mặc cả quá một giá, nhớ mặt khách tử tế |
| Chú Bình (bảo vệ HH4C, 49) | Khổ: bán ruộng Hải Dương mua căn 45 m², chín năm không sổ, không dám kể với anh em. Tập: nhà là của mình khi cầm tờ sổ. Diệt: có sổ để con gái không nghe "nhà không giấy". Đạo: gom chữ ký, nhờ người ngoài làm chứng |

| Nhiệm vụ | Ai | Giờ | Lựa chọn → cờ | Đọc lại ở |
|---|---|---|---|---|
| q_hm_01 Rau nhà, một giờ sáng | Lan | 1-2h30 | rau bà Cúc / rau rẻ không rõ nguồn (mặc cả quá một giá: bà quay đi, trả đủ giá đầu) | q_hm_03 (bà Cúc bên hồ Yên Sở), q_gl_02 (mở khóa) |
| q_hm_02 Tầng 36, thang máy hỏng | Minh | 17-19h | khiêng gas lấy 300 nghìn / không lấy tiền | q_hm_03 (chú Bình trả tiền ảnh hay nhờ không), q_md_04 (biên bản họp dân) |
| q_hm_03 Mười hai tòa nhìn từ Yên Sở | Khôi | 15h30-17h30 | ảnh cho đơn cư dân / cho trang nhất của Phong | q_btl_02 (ông Tám đọc báo), q_md_03 (ai giữ bản quyền) |

Đọc thêm cờ cũ: `video_mark_viral`, `lan_mua_gia_vi_chuan/re` (bà Cúc biết Lan qua bà Lụa Đồng Xuân).

## 5. Hà Đông: lụa thật, lụa giả và bến xe mất khách

| | |
|---|---|
| Khổ của quận | Vạn Phúc: cả làng sang máy dệt, khung cửi gỗ dệt ngày một mét, lụa Quảng Châu dán tem "Vạn Phúc" (sau vụ Khaisilk 2017); bến Yên Nghĩa cuối tuyến 2A: xe ôm truyền thống còn hai người; hồ Văn Quán nơi mẹ Thảo bán nước chè (chương 2) |
| Ông Lương (xe ôm Yên Nghĩa, 61) | Khổ: tàu điện và app lấy hết, ngày ba cuốc, con bảo về trông cháu. Tập: khách quen gọi điện là tài sản, là bằng chứng còn được cần. Diệt: nghỉ mà không bị thương hại, giao khách cho người xứng đáng. Đạo: đọc báo về đối thủ, thử lòng "thằng áo xanh" |
| Cô Thắm (thợ dệt, 54) | Khổ: con gái bán lụa Tàu dán tên làng, cô biết ba năm. Tập: im lặng giữ được cả con lẫn nghề. Diệt: khách sờ vào biết đâu là lụa Vạn Phúc. Đạo: dạy đốt sợi, đợi người ngoài nói hộ |
| Ngân (shop lụa online, 27) | Khổ: lụa mẹ dệt không đủ bán, sợ một bài tố cáo. Tập: "tên làng là của làng, mình là người làng". Diệt: shop sống mà mẹ không phải nhìn đi chỗ khác. Đạo: né câu "dệt ở đâu", đợi ai bắt mình ghi đúng tên |

| Nhiệm vụ | Ai | Giờ | Lựa chọn → cờ | Đọc lại ở |
|---|---|---|---|---|
| q_hd_01 Chuyến cuối ở Yên Nghĩa | Minh | 21h45-22h15 | nhường cuốc Ba La cho ông Lương (hủy app) / nhận | q_hd_04, q_md_01 (chú Hòa: "ông Lương khoe như con đỗ đại học") |
| q_hd_02 Đốt một sợi lụa | Lan | 9-11h | nói với cô Thắm về kho của Ngân / im | q_hd_03 (Ngân đã đổi tên shop hay chưa), q_hd_04 |
| q_hd_03 Ảnh cho shop lụa | Khôi | 14-16h | tay cô Thắm chỉ lên lụa cô dệt / chụp thêm theo ý Ngân / trả tiền, giữ bộ lụa in | q_hd_04 (ông Lương tin bạn Minh hay chưa), q_md_03 |
| q_hd_04 Sổ khách quen | Minh | 4h45-5h15 | nhận sổ 30 khách gọi điện / từ chối | q_md_01, q_md_04 (được xếp vào tổ áo vàng) |

## 6. Bắc Từ Liêm: làng hoa, đình ven sông, ga cuối tuyến 3

| | |
|---|---|
| Khổ của quận | Tây Tựu: hoa cúc, nhà màng gãy sau bão, cắt hoa nửa đêm chở ra chợ Quảng Bá; đình Chèm hai nghìn năm bên sông Hồng, trùng tu 2018 gây tranh cãi, mùa nước lên sát sân; ga Nhổn depot tuyến 3 nối sinh viên và người ngoại thành vào phố |
| Chị Loan (trồng cúc, 38) | Khổ: nợ 200 triệu nhà màng, con bỏ học, chồng xa. Tập: kịp giờ chợ là trả được nợ, đi tắt, "cố thêm một đêm". Diệt: trả hết nợ, con có việc ở phố không phải nói dối. Đạo: nhờ xe ôm chạy đê, không bao giờ bán hoa héo nói là tươi |
| Nhi (19) | Khổ: bỏ học vì tiền, bị quỵt lương. Tập: ra phố gần khách Tây là đổi đời. Diệt: việc trả lương đúng ngày, mẹ thôi nhìn mình như thất bại. Đạo: nói dối tuổi nghề, nhưng tay cắm hoa không giấu được |
| Ông Tám (thủ từ đình Chèm, 74) | Khổ: cột lim gian giữa nứt, báo lên thì bị "sửa" kiểu 2018, không báo thì gãy. Tập: đình chỉ còn là đình khi gỗ còn là gỗ cũ. Diệt: thợ hiểu gỗ, không phải dự án. Đạo: canh nước, cho chụp nhưng xin đừng đăng vết nứt |

| Nhiệm vụ | Ai | Giờ | Lựa chọn → cờ | Đọc lại ở |
|---|---|---|---|---|
| q_btl_01 Cúc rằm tháng Bảy (sự kiện Vu Lan) | Minh | 3-3h30 | đi đê Liên Mạc tối om (nhanh, dập hoa) / đường 32 có đèn (chậm, bán rẻ trăm bó) | cuối nhiệm vụ (giá hoa), q_btl_03 (Nhi: "mẹ em nhắc cả tuần") |
| q_btl_02 Nước lên đình Chèm (sự kiện mưa ngập) | Khôi | 8-10h | giữ lời, không đăng cột nứt / đăng kèm câu ông Tám | q_tx_02 (chú Sáu đọc trên điện thoại dưới lòng sông), q_md_03 (ban quản lý cử thợ gỗ hay ông Tám gọi cảm ơn) |
| q_btl_03 Tàu Nhổn sáu giờ sáng | Lan | 5h45-6h15 | nhận Nhi vào quán / khuyên về học nốt | q_gl_02 (ông Cả bảo cho Nhi sang học vẽ), q_md_04 (chị Loan: lương mùng 5 hay nộp lại hồ sơ) |

## 7. Gia Lâm: làng gốm sau lò than

| | |
|---|---|
| Khổ của quận | Bát Tràng bỏ lò than sang lò gas từ 2006 (giải quyết ô nhiễm), tường dán than tổ ong chỉ còn vài bức làm điểm chụp ảnh; bát vẽ tay thua decal; người trẻ quay video gốm nhiều hơn vuốt gốm |
| Ông Cả Dậu (thợ lò, 66) | Khổ: tường than sắp dỡ, bát vẽ tay thua decal, cháu không biết vuốt. Tập: gốm đáng tiền chỉ khi tay người chạm từng lớp; decal và video là một thứ giả như nhau. Diệt: một người trẻ cầm bút lông, tường than còn trong một tấm ảnh thật. Đạo: không bán bát nứt, dạy ai ngồi được hai tiếng |
| Tí (16) | Khổ: ông bắt vuốt, mình chỉ giỏi quay; giấu bát nứt vì sợ ông. Tập: lượt xem là một thứ nghề. Diệt: ông xem một video và gật. Đạo: đóng hàng thay ông, nói dối số lượng, xin người lạ nói hộ |

| Nhiệm vụ | Ai | Giờ | Lựa chọn → cờ | Đọc lại ở |
|---|---|---|---|---|
| q_gl_01 Sáu mươi cái bát | Minh | 7-8h | nói thật với nhà hàng là Tí xếp bát nứt / đổ cho cầu Chương Dương, trừ tiền xe | q_gl_02 (ông Cả biết lò hỏng mẻ hay không) |
| q_gl_02 Vẽ bát Phở Thọ | Lan | 8h30-10h | bát men lam tự vẽ, chữ nghiêng / mẫu decal chữ đỏ của Tí | q_gl_03, q_tx_03 (mall muốn in cái nghiêng), q_md_04 |
| q_gl_03 Bức tường than tổ ong | Khôi | 6h30-7h30 | nói ông quay mặt lại cho clip của Tí / giữ tấm phim, quay tường đừng quay ông | q_md_03 (hai triệu lượt xem hay bản in thứ ba) |

## 8. Thanh Xuân: phòng trọ, lòng sông, tầng hầm

| | |
|---|---|
| Khổ của quận | Ngõ Khương Đình: dãy trọ tăng giá, máy bơm hỏng; sông Tô Lịch nạo vét tổng thể hạn tháng 8-9/2025 trước khi bổ cập nước sông Hồng, công nhân thoát nước làm đêm; Royal City: khu ẩm thực ngầm, thương hiệu phở "chuẩn" từ bếp trung tâm |
| Chú Sáu (công nhân thoát nước, 55) | Khổ: ba mươi năm dưới lòng sông thối, con gái xấu hổ. Tập: làm việc thối thì đừng để ai thấy mặt. Diệt: sông sạch, con không phải giấu nghề bố. Đạo: kéo khẩu trang lên khi có máy ảnh, kể về sông cho ai chịu đứng gần mùi |
| Bà chủ trọ, anh Đức (đã có) | dùng lại với khối `drive` sẵn có |

| Nhiệm vụ | Ai | Giờ | Lựa chọn → cờ | Đọc lại ở |
|---|---|---|---|---|
| q_tx_01 Tăng năm trăm | Minh | 20-21h | trả thêm, "ổn" / mặc cả bằng việc sửa máy bơm (minigame, hỏng thì gọi anh Đức mất 100 nghìn) | cuối nhiệm vụ, q_tx_03 (bà chủ trọ nói với Lan), q_md_04 |
| q_tx_02 Năm giờ sáng dưới lòng Tô Lịch | Khôi | 4h45-5h30 | ghi tên Nguyễn Văn Sáu / để bóng người | q_md_03 (con gái chú xin bản in / chú thích "11 người") |
| q_tx_03 Một ki-ốt dưới lòng đất | Lan | 15-16h30 | ký cho mượn tên Phở Thọ, 20% / không ký | q_md_04 (bà Nhung, ông Cả) |
| q_tx_04 Góp vốn hay mua đứt | Minh | 20-21h | góp 40 triệu làm chung với anh Đức / tự gom 120 triệu mua đứt | q_md_04 (Minh tự nói trước tấm số 49), mở `businesses:tiem_sua_xe_duc_coi_gop_von` |

## 9. Mỹ Đình: bến xe, sân vận động, kim tự tháp ngược

| | |
|---|---|
| Khổ của quận | Bến xe Mỹ Đình 5h sáng: xe đêm Lào Cai, Sa Pa xuống, cò xe vây khách tỉnh, tổ xe ôm tự quản áo vàng; sân Mỹ Đình đêm đội tuyển, "đi bão"; Bảo tàng Hà Nội xây 2010, mười năm vắng khách |
| Chú Hòa (tổ trưởng xe ôm bến, 58) | Khổ: app lấy khách trẻ, cò lấy khách già. Tập: bến còn trật tự là nhờ tổ áo vàng. Diệt: người xuống bến không sợ. Đạo: quát cò, chỉ giá công khai, nhớ ai từng nhường cuốc ở bến khác |
| Dũng (thợ xây Lào Cai, 24) | Khổ: lần đầu xuống Hà Nội, không biết ai thật, sợ bị quỵt lương. Tập: ai nói chậm với mình là người tốt. Diệt: một người ở Hà Nội gọi được khi gặp chuyện, một lần đứng trong sân Mỹ Đình. Đạo: nhớ ơn lâu, rủ đi xem bóng như trả ơn |
| Chị Quỳnh (phụ trách trưng bày, 36) | Khổ: bảo tàng to nhất thành phố mà vắng. Tập: một triển lãm đúng sẽ kéo người Hà Nội vào. Diệt: người Hà Nội nhận ra người trong ảnh quận mình. Đạo: hỏi ai đứng sau mỗi tấm trước khi hỏi tấm đẹp hay không |

| Nhiệm vụ | Ai | Giờ | Lựa chọn → cờ | Đọc lại ở |
|---|---|---|---|---|
| q_md_01 Xe Lào Cai xuống lúc năm giờ | Minh | 4h30-5h | nhận cuốc app 20 nghìn / nhường chú Hòa, hủy cuốc | q_md_02 (Dũng kể chú Hòa đã xếp Minh vào đâu) |
| q_md_02 Đêm đội tuyển | Minh | 18h30-19h15 | đi bão đúng luật (mũ, chậm, không còi sau 23h) / về công trường | q_md_04 (chú Hòa) |
| q_md_03 Mười bốn quận trong kim tự tháp ngược | Khôi | 9-10h30 | tên triển lãm "Khải & Khôi" / "Nguyễn Văn Khôi" | q_md_04 (ông Phúc) |
| q_md_04 Khai mạc: mười bốn người (điểm nhấn, ba nhân vật) | Khôi, Minh, Lan | 18-18h45 | không có lựa chọn: đêm này chỉ trả lại | đọc 17 cờ của tám quận |

## 10. Chuỗi hệ quả xuyên quận

- Bài báo của Hương (Cầu Giấy) được ông Lương (Hà Đông) và bà chủ trọ (Thanh Xuân) đọc; Minh nói
  "ổn" với báo thì bà chủ trọ hỏi "ổn thì thêm năm trăm chắc cũng ổn".
- Lan chọn lụa thật ở chợ Hôm (HBT) thì cô Thắm (Hà Đông) là người dệt tấm ấy; chọn vải pha thì cô
  hỏi "quán ổn hay chưa ổn".
- Minh nhường cuốc ở Yên Nghĩa (Hà Đông) thì chú Hòa (Mỹ Đình) đã nghe ông Lương khoe; nhận sổ khách
  quen thì bà Thịnh được chở trước khi Minh ra bến Mỹ Đình.
- Khôi đưa ảnh HH Linh Đàm cho báo (Hoàng Mai) thì ông Tám đình Chèm (Bắc Từ Liêm) hỏi "cột của tôi
  cậu tính sao"; Khôi đăng cột nứt thì chú Sáu (Thanh Xuân) hỏi "người ta về sửa chưa".
- Minh nói thật về bát nứt (Gia Lâm) thì ông Cả Dậu làm bát cho Lan vì "cô quen người nói thật".
- Lan chọn bát men lam chữ nghiêng (Gia Lâm) thì quản lý mall (Thanh Xuân) muốn in cái nghiêng ấy;
  bà Nhung (HBT) và ông Cả đến khai mạc nói về cùng cái bát.
- Lan nhận Nhi (Bắc Từ Liêm) thì ông Cả (Gia Lâm) bảo cho Nhi sang học vẽ; chị Loan đến khai mạc nói
  về lương mùng 5 hoặc hồ sơ Cao đẳng.
- Đêm khai mạc (Mỹ Đình) đọc lại 17 cờ của 8 quận và 3 cờ chương 1 (`khoi_giu_ban_goc`,
  `khoi_tang_anh_thao`, `cg_minh_noi_that_app`), chỗ trống cho tấm "số 49, năm nay" chờ cô Hạnh ký.

## 11. Nguồn đã dùng cho nỗi khổ của từng quận

- HH Linh Đàm: gần 10.000 căn chưa được cấp sổ đỏ, cư dân phải chọn trả nhà hay lấy lại tiền
  (vnbusiness.vn, vietnamfinance.vn 2025); thang máy "chung cư vạn dân" gặp sự cố (tienphong.vn).
- Sông Tô Lịch: nạo vét tổng thể hoàn thành tháng 8/2025, cải tạo hai bờ trước 30/8/2025, rồi bổ cập
  nước sông Hồng (daibieunhandan.vn, vneconomy.vn, baovanhoa.vn, nongnghiepmoitruong.vn).
- Đình Chèm: lễ hội 14-16/5 âm lịch có rước nước giữa sông Hồng; tranh cãi trùng tu 2018 và cây đa bị
  chặt (nhandan.vn, vietnamnet.vn, sggp.org.vn, vietnamcoracle.com 2025).
- Bát Tràng: bỏ lò than sang lò gas, làng nghề thành "hình mẫu giải quyết ô nhiễm"; "vua lò", người
  trẻ dấn thân với gốm (tapchicongthuong.vn, vnbusiness.vn, nhandan.vn).
- Bến xe Mỹ Đình: xe dù, bến cóc, cò khách quanh bến; tuyến Hà Nội - Sa Pa (tienphong.vn, baolaocai.vn).
- Vạn Phúc và lụa giả nhãn, chợ Hôm, chùa Hà cầu duyên, Tây Tựu và chợ hoa Quảng Bá đêm, chợ đầu mối
  Đền Lừ: nghiên cứu ở lượt trước của luồng này (ghi trong lịch sử luồng), chưa có bản trích dẫn
  trong repo; cần người Hà Nội đọc lại các chi tiết giá, giờ họp chợ, số sạp.

## 12. Còn mở

1. **Giá trong lựa chọn**: schema `effect` của lựa chọn là `reward` (tiền ≥ 0), nên 11 lựa chọn mua
   bán (lụa, rau, bát, tiền trọ, hủy cuốc) chưa trừ tiền người chơi. Đề xuất thêm `cost_vnd` vào
   `common.schema.json#/$defs/reward` (ghi vào `04` §đề xuất schema). Minigame sửa bơm, mặc cả đã có
   `cost_vnd`/`budget_vnd` ở cấp bước.
2. **Minigame mới chưa có activity**: đốt sợi lụa (`test: dot_soi_lua`), cắm hoa (`cam_hoa_ban_quan`),
   vẽ men lam (`ve_men_lam`) dùng `test` tự do; nếu muốn tính vào kỹ năng thì thêm activity.
3. **Người đọc Hà Nội**: 56 đoạn thoại mới (~360 dòng) cần người Hà Nội đọc giọng Hà Đông, Lào Cai,
   Hải Dương, Thường Tín.
4. ~~Kinh tế Minh (mục 2 của `07`) vẫn âm 0,7 triệu/tháng trong giả lập; làm tiếp sau PR này.~~ Đã làm:
   bậc thang thu nhập và `q_tx_04_gop_von_duc_coi` (góp vốn 40 triệu hay mua đứt 120), xem `01` và `07` mục 2.
