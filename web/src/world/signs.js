// Bảng màu và biển hiệu dùng chung cho worker (chọn chỉ số) và luồng chính (vẽ bảng chữ, shader).
// Biển chỉ ghi ngành hàng theo đúng truyền thống "36 phố phường" (Hàng Bạc bán vàng bạc, Hàng Mã bán đồ mã...),
// không ghi tên cửa hàng hay thương hiệu có thật.

// Bảng màu vôi tường. Shader nhận cả mảng; worker chọn chỉ số theo kiểu nhà.
export const PAL = [
  // 0..11 nhà ống: vàng đất, vàng nhạt, kem, xanh ngọc, xanh lơ, hồng đất, ghi
  0xd6a94e, 0xe2cd8a, 0xe6dcc0, 0xc3d6b0, 0xa9cdb9, 0xb9cfe0, 0xdfbda8, 0xc4c4bc, 0xe9e6dc, 0xd29a7e, 0xd9b866, 0xdcc79a,
  // 12..17 kiểu Pháp: vàng đất thuộc địa (#E3B448 đến #D9A441), có nhà đã bạc thành vàng kem
  0xe3b448, 0xd9a441, 0xead9a0, 0xe6c877, 0xddb45e, 0xdfae4c,
  // 18..21 tập thể, kho, chợ
  0xcfc8b4, 0xbdb8a6, 0xd9cfa8, 0xc4c9c0,
  // 22..25 kính cao ốc
  0xc4e4f4, 0xd2f0e6, 0xe1e6eb, 0xb3d3f5,
  // 26..31 mái tôn
  0x4f7fb0, 0x9a4a3a, 0x9a9a9a, 0x4a7a5a, 0x8a8f96, 0xb07a4a,
  // 32..35 mái ngói, mái bằng (độ sáng)
  0xd9d9d9, 0xeeeeee, 0xc4c4c4, 0xffffff,
  // 36..37 đình chùa
  0xede0b8, 0xd9b76a,
  // 38 đá nhà thờ, 39 trắng
  0xdddddd, 0xffffff,
  // 40..42 vôi vàng nhà cổ; 43..48 bảng màu quy chế phố cổ (nâu, vàng nhạt, trắng, xám, xanh rêu nhạt, hồng nhạt); 49..51 nhà mới sơn trắng, ghi
  0xe3b448, 0xd9a441, 0xe9cc7a, 0xe8d290, 0xd9c08a, 0xc9a873, 0xb4c9a2, 0xe8c2ac, 0xd6d6cf, 0xedeae2, 0xdcdad2, 0xe6dcc4,
  // 52.. màu riêng của công trình có tên (world/gen/heroes.js gọi theo tên trong HC)
  0xf1ead6, 0xf6f3ea, 0xcfc7b4, 0x9a9d9f, 0xdccdb0, 0x7fb4e6, 0x7fc9a8, 0x4f7fc0, 0xb08f66, 0x5f646b, 0xffffff, 0xe9d28a, 0xb7ada0, 0x8a6a52, 0x74777a,
];
// Màu công trình có tên: tường kem, trắng, đá be, đá granite xám, be; kính xanh lam, xanh lục, xanh đậm, nâu đồng; mái đá phiến, ngói đỏ, vàng nhạt, đá rửa, gạch nâu, tôn ghi
export const HC = { cream: 52, white: 53, stone: 54, granite: 55, beige: 56, glassBlue: 57, glassGreen: 58, glassNavy: 59, glassBronze: 60, slate: 61, tile: 62, paleYellow: 63, washed: 64, brick: 65, zinc: 66, ochre: 12, ochre2: 13 };
export const P = { tube: [0, 12], french: [12, 6], apart: [18, 4], glass: [22, 4], tin: [26, 6], roof: [32, 4], temple: [36, 2], stone: [38, 1], white: [39, 1], lime: [40, 3], old: [40, 9], pastel: [43, 6], neo: [48, 4], tinHot: [26, 2] };
// màu nền biển hiệu
// 12: nâu gỗ chữ vàng (kiểu biển đồng bộ của các tuyến phố đã chỉnh trang)
export const SIGN_COLORS = [0xc0392b, 0x1f6fb5, 0x1e8a4c, 0xe0a81c, 0x7b3fa0, 0xd35400, 0x16a0a0, 0x2c3e50, 0xb3121f, 0xe84a8a, 0xf2efe6, 0x111111, 0x5a3a22];

// [chữ lớn, chữ nhỏ, chỉ số màu nền]
export const SIGNS = [
  null, // ô 0 để trắng: mọi hình không phải biển hiệu lấy màu từ đây
  ['PHỞ BÒ', 'GIA TRUYỀN · TÁI · CHÍN · NẠM', 0], ['BÚN CHẢ', 'NEM CUA BỂ · BÚN NEM', 3], ['CÀ PHÊ', 'CÀ PHÊ TRỨNG · NÂU ĐÁ', 7], ['TRÀ ĐÁ', 'NHÂN TRẦN · THUỐC LÀO', 2],
  ['TẠP HOÁ', 'BÁNH KẸO · NƯỚC NGỌT · THUỐC LÁ', 1], ['CẮT TÓC', 'GỘI ĐẦU · CẠO MẶT', 6], ['SỬA XE MÁY', 'THAY DẦU · VÁ SĂM · RỬA XE', 8], ['PHOTOCOPY', 'IN ẤN · ĐÁNH MÁY', 1],
  ['NHÀ NGHỈ', 'PHÒNG ĐIỀU HOÀ · NÓNG LẠNH', 4], ['KARAOKE', 'PHÒNG VIP · ÂM THANH HAY', 9], ['HIỆU THUỐC', 'THUỐC TÂY · DỤNG CỤ Y TẾ', 2], ['ĐIỆN THOẠI', 'SỬA CHỮA · PHỤ KIỆN · SIM THẺ', 5],
  ['BÁNH MÌ', 'PA TÊ · TRỨNG · XÚC XÍCH', 3], ['XÔI · CHÈ', 'XÔI XÉO · CHÈ SEN · TÀO PHỚ', 9], ['BÚN RIÊU', 'BÚN ỐC · BÁNH ĐA CUA', 0], ['MIẾN LƯƠN', 'CHÁO LƯƠN · SÚP LƯƠN', 5],
  ['NƯỚC MÍA', 'TRÀ CHANH · HƯỚNG DƯƠNG', 2], ['HOA TƯƠI', 'HOA CƯỚI · LẴNG HOA', 9], ['MAY ĐO', 'ÁO DÀI · VEST · SỬA QUẦN ÁO', 4], ['KÍNH MẮT', 'ĐO MẮT MIỄN PHÍ', 1],
  ['GIẶT LÀ', 'GIẶT KHÔ · LẤY NGAY', 6], ['CƠM BÌNH DÂN', 'CƠM RANG · PHỞ XÀO', 8], ['BIA HƠI', 'LẠC LUỘC · NEM CHUA RÁN', 8], ['KHÁCH SẠN', 'HOTEL · ROOM FOR RENT', 7],
  ['DU LỊCH', 'VÉ TÀU · VÉ MÁY BAY · VISA', 1], ['VÀNG BẠC', 'ĐÁ QUÝ · KIM HOÀN', 3], ['LỤA TƠ TẰM', 'KHĂN LỤA · ÁO DÀI MAY SẴN', 4], ['ĐỒ CHƠI', 'ĐÈN LỒNG · ĐÈN ÔNG SAO', 0],
  ['VÀNG MÃ', 'ĐỒ THỜ · HƯƠNG NẾN', 8], ['THUỐC BẮC', 'ĐÔNG Y GIA TRUYỀN', 12], ['Ô MAI', 'MỨT SẤU · MƠ GỪNG', 5], ['BÁNH KẸO', 'MỨT TẾT · HẠT DƯA', 9],
  ['CHIẾU CÓI', 'THẢM · MÀNH TRÚC', 2], ['TRANH THÊU', 'TRANH SƠN MÀI · LỤA', 4], ['ĐỒ THIẾC', 'TÔN · HÒM THƯ · ỐNG NƯỚC', 7], ['GIÀY DÉP', 'GIÀY DA · DÉP TÔNG', 1],
  ['SÁCH', 'TRUYỆN · VĂN PHÒNG PHẨM', 6], ['KEM', 'KEM CỐM · KEM ĐẬU XANH', 1], ['TRANH DÂN GIAN', 'TRANH HÀNG TRỐNG · KHUNG ẢNH', 0], ['CHẢ CÁ', 'CHẢ CÁ THÌ LÀ · BÚN · MẮM TÔM', 5],
  ['ĐỒ GỐM', 'BÁT ĐĨA · LỌ HOA BÁT TRÀNG', 6], ['KIM KHÍ', 'KHOÁ · ĐINH · DỤNG CỤ', 7], ['VẢI', 'VẢI VÓC · RÈM CỬA', 9], ['TRE NỨA', 'ĐIẾU CÀY · THANG TRE', 2],
  ['BÁNH CỐM', 'BÁNH XU XÊ · CỐM LÀNG VÒNG', 2], ['QUẦN ÁO', 'THỜI TRANG NAM NỮ', 9], ['ĐỒ ĐỒNG', 'CHUÔNG · LƯ HƯƠNG · HOÀNH PHI', 3], ['MẮM · MUỐI', 'ĐỒ KHÔ · GIA VỊ', 8],
  ['SƠN · VÔI', 'VẬT LIỆU XÂY DỰNG', 1], ['NHA KHOA', 'RĂNG SỨ · NIỀNG RĂNG', 6], ['RỬA XE', 'THAY DẦU · BƠM VÁ', 7], ['BÚN ĐẬU', 'MẮM TÔM · CHẢ CỐM', 2],
  ['LẨU · NƯỚNG', 'BIA LẠNH · MỞ ĐẾN KHUYA', 0], ['TRÀ CHANH', 'HẠT HƯỚNG DƯƠNG · NEM CHUA', 3], ['ĐỒNG HỒ', 'SỬA CHỮA · THAY PIN', 7], ['ẢNH VIỆN', 'ẢNH THẺ LẤY NGAY · ẢNH CƯỚI', 4],
  ['CHĂN GA GỐI', 'ĐỆM · RÈM', 9], ['BÁNH CUỐN', 'BÁNH CUỐN NÓNG · CHẢ QUẾ', 5], ['HƯƠNG · NẾN', 'ĐỒ LỄ · VÀNG HƯƠNG', 8], ['CÂY CẢNH', 'CHẬU · HẠT GIỐNG · CHIM CẢNH', 2],
  ['ĐỒ BẠC', 'TRANG SỨC BẠC · CHẠM KHẮC', 7], ['NGOẠI TỆ', 'THU ĐỔI · VÀNG BẠC', 3], ['ĐÈN LỒNG', 'ĐỒ GIẤY · ĐÈN ÔNG SAO · MẶT NẠ', 0], ['LEN · SỢI', 'LEN ĐAN · KIM MÓC · CÚC ÁO', 6],
  ['PHỤ LIỆU MAY', 'KHOÁ KÉO · CÚC · CHỈ · REN', 1], ['ĐỒ THỜ', 'HOÀNH PHI · CÂU ĐỐI · TƯỢNG GỖ', 8], ['DÂY THỪNG', 'BẠT · LƯỚI · DÂY BUỘC', 2], ['ĐỒ LƯU NIỆM', 'SƠN MÀI · THỔ CẨM · NÓN LÁ', 12],
  ['THỜI TRANG', 'VÁY ĐẦM · ÁO SƠ MI', 11], ['TÚI XÁCH', 'VA LI · BA LÔ · VÍ DA', 7], ['KHẮC DẤU', 'DẤU ĐỒNG · BIỂN CHỨC DANH', 0], ['PHỞ GÀ', 'MIẾN GÀ · BÚN THANG', 3],
  ['BÁNH TRÔI TÀU', 'CHÍ MÀ PHÙ · LỤC TÀU XÁ', 5], ['PHÒNG TRANH', 'TRANH SƠN DẦU · SƠN MÀI', 10],
  ['NEM CHUA RÁN', 'KHOAI TÂY CHIÊN · NGÔ CHIÊN', 5], ['ỐC LUỘC', 'ỐC XÀO · NGAO HẤP · SÒ NƯỚNG', 6], ['ĐÔNG Y', 'CHẨN TRỊ · BỐC THUỐC · CHÂM CỨU', 2], ['DƯỢC LIỆU', 'SÂM · QUẾ · TÁO ĐỎ · KỶ TỬ', 12],
  ['VĂN PHÒNG PHẨM', 'BÚT · VỞ · LỊCH · THIỆP', 1], ['ÁO DÀI', 'MAY ĐO · VẢI LỤA · ÁO DÀI CƯỚI', 9], ['ĐỒ TRANG TRÍ', 'SINH NHẬT · ĐÁM CƯỚI · LỄ TẾT', 4], ['GƯƠNG · KÍNH', 'KHUNG NHÔM · CẮT KÍNH THEO YÊU CẦU', 6],
  ['CHÈ THÁI NGUYÊN', 'TRÀ SEN · TRÀ NHÀI · TRÀ MẠN', 2], ['ĐỒ DA', 'THẮT LƯNG · VÍ · CẶP DA', 12], ['GIÀY THỂ THAO', 'GIÀY VẢI · GIÀY CHẠY BỘ', 11],
];
const idx = (t) => SIGNS.findIndex((s) => s && s[0] === t);
// Các ngành hàng chung, có ở mọi phố.
export const GENERIC = ['PHỞ BÒ', 'BÚN CHẢ', 'CÀ PHÊ', 'TRÀ ĐÁ', 'TẠP HOÁ', 'CẮT TÓC', 'SỬA XE MÁY', 'PHOTOCOPY', 'NHÀ NGHỈ', 'KARAOKE', 'HIỆU THUỐC', 'ĐIỆN THOẠI', 'BÁNH MÌ', 'XÔI · CHÈ', 'BÚN RIÊU', 'MIẾN LƯƠN', 'NƯỚC MÍA', 'HOA TƯƠI', 'MAY ĐO', 'KÍNH MẮT', 'GIẶT LÀ', 'CƠM BÌNH DÂN', 'BIA HƠI', 'KHÁCH SẠN', 'DU LỊCH', 'QUẦN ÁO', 'NHA KHOA', 'RỬA XE', 'BÚN ĐẬU', 'LẨU · NƯỚNG', 'TRÀ CHANH', 'ĐỒNG HỒ', 'ẢNH VIỆN', 'BÁNH CUỐN', 'CÂY CẢNH', 'GIÀY DÉP', 'SÁCH', 'PHỞ GÀ', 'THỜI TRANG', 'TÚI XÁCH', 'ỐC LUỘC', 'VĂN PHÒNG PHẨM', 'CHÈ THÁI NGUYÊN', 'GIÀY THỂ THAO'].map(idx);
if (GENERIC.includes(-1)) throw new Error('signs: GENERIC gọi một biển không có trong SIGNS');
// Phố nghề: tên đường OSM → các biển đặc trưng của phố, xếp theo mức đặc trưng (biển đứng đầu xuất hiện dày nhất). Mỗi biển chỉ ghi
// một lần: việc rải biển dọc phố sao cho hai nhà liền kề không trùng nhau do signAt() lo (xem cuối tệp).
const T = (...a) => a.map(idx);
export const TRADES = {
  'Phố Hàng Bạc': T('VÀNG BẠC', 'ĐỒ BẠC', 'NGOẠI TỆ', 'DU LỊCH', 'KHÁCH SẠN'), 'Phố Hàng Mã': T('VÀNG MÃ', 'ĐÈN LỒNG', 'ĐỒ CHƠI', 'HƯƠNG · NẾN', 'ĐỒ TRANG TRÍ'), 'Phố Hàng Đào': T('QUẦN ÁO', 'THỜI TRANG', 'LỤA TƠ TẰM', 'VẢI', 'ĐỒNG HỒ'),
  'Phố Hàng Ngang': T('QUẦN ÁO', 'THỜI TRANG', 'VẢI', 'TÚI XÁCH', 'GIÀY DÉP'), 'Phố Hàng Gai': T('LỤA TƠ TẰM', 'TRANH THÊU', 'MAY ĐO', 'ĐỒ LƯU NIỆM', 'ÁO DÀI'), 'Phố Hàng Thiếc': T('ĐỒ THIẾC', 'KIM KHÍ', 'GƯƠNG · KÍNH'),
  'Phố Lãn Ông': T('THUỐC BẮC', 'ĐÔNG Y', 'DƯỢC LIỆU'), 'Phố Thuốc Bắc': T('KIM KHÍ', 'THUỐC BẮC', 'ĐỒ THIẾC'), 'Phố Hàng Đường': T('Ô MAI', 'BÁNH KẸO', 'CHÈ THÁI NGUYÊN', 'BÁNH CỐM'), 'Phố Hàng Buồm': T('BÁNH KẸO', 'KHÁCH SẠN', 'CHÈ THÁI NGUYÊN', 'Ô MAI'),
  'Phố Hàng Chiếu': T('CHIẾU CÓI', 'DÂY THỪNG', 'TRE NỨA'), 'Phố Hàng Quạt': T('ĐỒ THỜ', 'ĐỒ ĐỒNG', 'KHẮC DẤU', 'HƯƠNG · NẾN'), 'Phố Hàng Dầu': T('GIÀY DÉP', 'GIÀY THỂ THAO', 'ĐỒ DA', 'TÚI XÁCH'), 'Phố Tạ Hiện': T('BIA HƠI', 'LẨU · NƯỚNG', 'NEM CHUA RÁN', 'ỐC LUỘC', 'TRÀ CHANH'),
  'Phố Lương Ngọc Quyến': T('BIA HƠI', 'KHÁCH SẠN', 'DU LỊCH', 'NEM CHUA RÁN', 'LẨU · NƯỚNG'), 'Phố Tràng Tiền': T('SÁCH', 'KEM', 'PHÒNG TRANH', 'VĂN PHÒNG PHẨM', 'ĐỒNG HỒ'), 'Phố Đinh Lễ': T('SÁCH', 'VĂN PHÒNG PHẨM', 'PHOTOCOPY'), 'Phố Hàng Bông': T('TRANH THÊU', 'MAY ĐO', 'VẢI', 'ÁO DÀI', 'CHĂN GA GỐI'),
  'Phố Hàng Trống': T('TRANH DÂN GIAN', 'PHÒNG TRANH', 'ĐỒ LƯU NIỆM', 'KHÁCH SẠN'), 'Phố Lương Văn Can': T('ĐỒ CHƠI', 'ÁO DÀI', 'MAY ĐO', 'ĐÈN LỒNG'), 'Phố Hàng Cân': T('SÁCH', 'ĐỒ CHƠI', 'VĂN PHÒNG PHẨM'), 'Phố Chả Cá': T('CHẢ CÁ', 'KHÁCH SẠN', 'CÀ PHÊ'),
  'Phố Hàng Than': T('BÁNH CỐM', 'XÔI · CHÈ', 'BÁNH KẸO'), 'Phố Hàng Khoai': T('ĐỒ GỐM', 'TRE NỨA', 'MẮM · MUỐI'), 'Phố Hàng Vải': T('TRE NỨA', 'VẢI', 'CHIẾU CÓI'), 'Phố Hàng Đồng': T('ĐỒ ĐỒNG', 'ĐỒ THỜ', 'KIM KHÍ'),
  'Phố Hàng Bồ': T('PHỤ LIỆU MAY', 'MAY ĐO', 'VẢI', 'LEN · SỢI'), 'Phố Hàng Hòm': T('SƠN · VÔI', 'KIM KHÍ', 'GƯƠNG · KÍNH'), 'Phố Hàng Điếu': T('CHĂN GA GỐI', 'Ô MAI', 'BÚN RIÊU', 'CHÈ THÁI NGUYÊN'), 'Phố Bát Đàn': T('PHỞ BÒ', 'ĐỒ GỐM', 'CƠM BÌNH DÂN'),
  'Phố Hàng Mành': T('BÚN CHẢ', 'TRE NỨA', 'CHIẾU CÓI'), 'Phố Hàng Lược': T('HOA TƯƠI', 'CÂY CẢNH'), 'Phố Đồng Xuân': T('VẢI', 'MẮM · MUỐI', 'QUẦN ÁO'), 'Phố Hàng Giấy': T('BÁNH KẸO', 'MẮM · MUỐI', 'Ô MAI', 'TẠP HOÁ'),
  'Phố Hàng Cá': T('BÁNH MÌ', 'BÁNH CUỐN', 'XÔI · CHÈ'), 'Phố Nguyễn Hữu Huân': T('CÀ PHÊ', 'KEM', 'TRÀ CHANH'), 'Phố Hàng Bè': T('MẮM · MUỐI', 'BÚN ĐẬU', 'XÔI · CHÈ'), 'Phố Cầu Gỗ': T('QUẦN ÁO', 'BÚN CHẢ', 'CÀ PHÊ'),
  'Ngõ Hàng Hành': T('CÀ PHÊ', 'KHÁCH SẠN', 'DU LỊCH'), 'Phố Hàng Bún': T('BÚN ĐẬU', 'BÚN RIÊU', 'BÚN CHẢ', 'PHỞ GÀ'), 'Phố Hàng Da': T('ĐỒ DA', 'GIÀY DÉP', 'TÚI XÁCH', 'QUẦN ÁO'),
  'Phố Phùng Hưng': T('LẨU · NƯỚNG', 'PHỞ BÒ', 'CÀ PHÊ'), 'Phố Hàng Nón': T('ĐỒ THIẾC', 'HƯƠNG · NẾN', 'GƯƠNG · KÍNH'), 'Phố Hàng Chĩnh': T('ĐỒ GỐM', 'TRE NỨA', 'MẮM · MUỐI'),
  'Phố Đinh Liệt': T('LEN · SỢI', 'QUẦN ÁO', 'PHỤ LIỆU MAY', 'MAY ĐO'), 'Phố Hàng Giầy': T('BÁNH TRÔI TÀU', 'GIÀY DÉP', 'GIÀY THỂ THAO', 'KHÁCH SẠN'), 'Phố Hàng Khay': T('ĐỒ LƯU NIỆM', 'PHÒNG TRANH', 'TRANH THÊU', 'LỤA TƠ TẰM'),
  'Phố Mã Mây': T('DU LỊCH', 'KHÁCH SẠN', 'ĐỒ LƯU NIỆM', 'CÀ PHÊ'), 'Phố Hàng Lọng': T('PHỞ GÀ', 'CƠM BÌNH DÂN', 'BÚN CHẢ'),
};
for (const k in TRADES) if (TRADES[k].includes(-1)) throw new Error('signs: phố nghề ' + k + ' gọi một biển không có trong SIGNS');
// Loại cửa hàng của từng biển, để tầng trệt vẽ khớp với biển: F quán ăn, C cà phê giải khát, H khách sạn dịch vụ, B cửa kính, còn lại là hàng bày ra cửa.
const kindOf = { F: ['PHỞ BÒ', 'BÚN CHẢ', 'BÚN RIÊU', 'MIẾN LƯƠN', 'CƠM BÌNH DÂN', 'BÚN ĐẬU', 'LẨU · NƯỚNG', 'BÁNH CUỐN', 'CHẢ CÁ', 'PHỞ GÀ', 'BÁNH TRÔI TÀU', 'XÔI · CHÈ', 'BÁNH MÌ', 'BIA HƠI', 'NEM CHUA RÁN', 'ỐC LUỘC'],
  C: ['CÀ PHÊ', 'TRÀ CHANH', 'KEM', 'TRÀ ĐÁ', 'NƯỚC MÍA'], H: ['NHÀ NGHỈ', 'KHÁCH SẠN', 'DU LỊCH', 'KARAOKE'],
  B: ['VÀNG BẠC', 'ĐỒ BẠC', 'NGOẠI TỆ', 'LỤA TƠ TẰM', 'THỜI TRANG', 'TÚI XÁCH', 'KÍNH MẮT', 'ĐỒNG HỒ', 'ĐIỆN THOẠI', 'HIỆU THUỐC', 'NHA KHOA', 'ẢNH VIỆN', 'PHÒNG TRANH', 'TRANH THÊU', 'ĐỒ LƯU NIỆM', 'GIÀY DÉP', 'QUẦN ÁO', 'MAY ĐO', 'ÁO DÀI', 'ĐỒ DA', 'GIÀY THỂ THAO'] };
export const SIGN_KIND = SIGNS.map((s) => { if (!s) return 'G'; for (const k in kindOf) if (kindOf[k].includes(s[0])) return k; return 'G'; });


// Bảng chữ 2048² chia 4 cột × 24 hàng (ô 512 × 85 điểm ảnh, tỉ lệ 6:1 khớp dải biển ngang trên cửa):
//   ô 0 trắng (mọi hình không có chữ), ô 1..N biển ngang, từ BLADE0 mỗi ô chứa 8 biển vẫy nhỏ dạng hộp đèn đứng (BLADE_N biển ngang
//   đầu tiên, tức các ngành hàng phổ biến nhất, mỗi biển có một biển vẫy cùng chữ), 4 ô TEXT0.. là chữ trên công trình có tên, ô cuối là cờ đỏ sao vàng.
// Bảng đã kín 96/96 ô: muốn thêm vẻ khác nhau cho biển thì ghép (màu, khung, chữ phụ: SIGN_VARIANTS), không thêm ô.
// Trả về [u0, v0, u1, v1] đã thu vào trong để không lem màu.
export const ATLAS = { cols: 4, rows: 24, size: 2048 };
export function signUV(i) {
  const c = i % ATLAS.cols, r = Math.floor(i / ATLAS.cols), pu = 3 / ATLAS.size, pv = 3 / ATLAS.size;
  return [c / ATLAS.cols + pu, 1 - (r + 1) / ATLAS.rows + pv, (c + 1) / ATLAS.cols - pu, 1 - r / ATLAS.rows - pv];
}
export const WHITE_UV = [0.5 / ATLAS.cols, 1 - 0.5 / ATLAS.rows];
export const FLAG_CELL = ATLAS.cols * ATLAS.rows - 1; // ô cuối: cờ đỏ sao vàng
// 4 ô ngay trước ô cờ: chữ gắn trên công trình có tên (gen/heroes.js HERO_TEXT)
export const TEXT0 = FLAG_CELL - 4;
export const BLADE0 = SIGNS.length, BLADE_PER = 8, BLADE_N = Math.min(SIGNS.length - 1, (TEXT0 - BLADE0) * BLADE_PER);
if (BLADE0 >= TEXT0 || BLADE_N < 24) throw new Error('signs: bảng chữ hết chỗ');
// Ô của biển vẫy đi kèm biển ngang thứ i (null nếu biển này không có biển vẫy).
export function bladeUV(i) {
  if (i < 1 || i > BLADE_N) return null;
  const k = i - 1, cell = BLADE0 + Math.floor(k / BLADE_PER), sub = k % BLADE_PER, uv = signUV(cell), w = (uv[2] - uv[0]) / BLADE_PER, pu = 1.5 / ATLAS.size;
  return [uv[0] + sub * w + pu, uv[1], uv[0] + (sub + 1) * w - pu, uv[3]];
}
// Chữ trên biển vẫy (hộp đèn đứng): chữ lớn của biển ngang, mỗi từ một dòng, tối đa ba dòng.
export function bladeLines(big) {
  const w = big.replace(/ · /g, ' ').split(' ');
  return w.length <= 3 ? w : [w.slice(0, 2).join(' '), ...w.slice(2, 4)];
}

// ===== Vẻ khác nhau của cùng một biển: ghép màu và kiểu bồi, không tốn thêm ô trong bảng chữ =====
// SIGN_TINTS: màu nhân vào ô chữ (chữ trắng thành vàng, nền đỏ ngả cam; hoặc ngả lạnh). SIGN_BACKS: màu tấm nền của biển bồi (ô chữ thu
// nhỏ đặt giữa một tấm nền màu khác, có nẹp); 0 là hộp đèn kín bề rộng nhà, không có tấm nền. SIGN_VARIANTS: [màu, tấm nền].
// Lề trái của phố dùng vẻ 0..2, lề phải dùng vẻ 3..5: sáu vẻ khác hẳn nhau về màu chữ và màu nền, nên hai biển cùng chữ ở hai bên
// đường hay cách nhau một quãng trên cùng một lề không bao giờ giống hệt nhau.
export const SIGN_TINTS = [[1, 1, 1], [1, 0.8, 0.24], [0.6, 0.82, 1]];
export const SIGN_BACKS = [null, 0xe9e2cc, 0x3a2416, 0xe2b02a, 0x8e9499];
export const SIGN_VARIANTS = [[0, 0], [1, 1], [2, 2], [1, 0], [0, 3], [2, 4]];

// ===== Rải biển dọc phố =====
// Yêu cầu: hai nhà liền kề không bao giờ trùng chữ; trong 30 m không có hai biển giống hệt nhau (cùng chữ, cùng vẻ); phố nghề vẫn
// đậm đặc nghề của phố. Vì mỗi ô phố được dựng riêng (và không theo thứ tự nào), biển của một gian phải tính được chỉ từ vị trí của
// nó: phố được chia thành các khe SLOT mét dọc theo chiều dài (liền mạch qua mọi đoạn cùng tên, xem streetChains), mỗi phố có một
// vòng CYC khe. Trong vòng, biển nghề của phố nằm ở các khe cố định, cùng một chữ cách nhau đúng HALF khe (11,2 m, xa hơn bề rộng một
// gian nên không bao giờ rơi vào hai nhà liền kề), mỗi lần hiện ra mang một vẻ khác (ba vẻ xoay vòng: giống hệt nhau phải cách 33,6 m).
// Các khe còn lại lấy biển chung: các ngành hàng chung của phố được chia đôi cho hai lề (cùng một chữ không bao giờ có ở cả hai bên
// đường), mỗi lề xoay vòng hết nửa của mình rồi mới lặp lại (ít nhất 19 khe, hơn 30 m).
// Gian rộng ít nhất 1,9 m nên hai gian cùng lề không bao giờ chung một khe.
const CYC = 14, HALF = 7, SLOT = 1.6, NUM_STEP = 3.4;
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h | 0; };
const h01 = (i, k) => { let h = (Math.imul(i | 0, 374761393) + Math.imul(k | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const cycles = new Map();
function cycleOf(key, trade) {
  let c = cycles.get(key); if (c) return c;
  const seed = typeof key === 'string' ? hashStr(key) : Math.imul(key | 0, 40503) ^ 0x51ed;
  const perm = (n, k) => { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(h01(seed + i * 7919, k) * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const pos = new Array(CYC).fill(-1), occ = new Array(CYC).fill(0), dbl = new Array(CYC).fill(false), fpos = new Array(CYC).fill(-1);
  const P = trade ? trade.length : 0, base = perm(HALF, 1), nTrade = Math.min(10, 2 * P); let n = 0;
  for (let a = 0; a < P && a < CYC && n < nTrade; a++, n++) pos[a < HALF ? base[a] : base[a - HALF] + HALF] = trade[a];
  for (let a = 0; a < Math.min(P, HALF) && n < nTrade; a++) { const i = base[a] + HALF; if (pos[i] < 0) { pos[i] = trade[a]; occ[i] = 1; dbl[i] = dbl[base[a]] = true; n++; } }
  let F = 0; for (let i = 0; i < CYC; i++) if (pos[i] < 0) fpos[i] = F++;
  const gen = GENERIC.filter((g) => !trade || !trade.includes(g)), mix = perm(gen.length, 2).map((i) => gen[i]), h = gen.length >> 1;
  cycles.set(key, (c = { pos, occ, dbl, fpos, F, fill: [mix.slice(0, h), mix.slice(h)] }));
  return c;
}
// Biển của gian nằm ở quãng S (m) dọc phố, lề side (0 trái, 1 phải). key: tên phố (hoặc số của đoạn đường không tên); trade: TRADES[tên].
// Trả về [chỉ số biển, vẻ (chỉ số trong SIGN_VARIANTS)].
export function signAt(key, trade, S, side) {
  const c = cycleOf(key, trade), q = Math.floor(S / SLOT) + (side ? HALF : 0) + CYC * 4096, i = q % CYC, L = Math.floor(q / CYC); // S có thể âm (nhà nằm quá đầu phố)
  let sign, o;
  if (c.pos[i] >= 0) { sign = c.pos[i]; o = c.dbl[i] ? 2 * L + c.occ[i] : L; }
  else { const l = c.fill[side ? 1 : 0]; o = L * c.F + c.fpos[i]; sign = l[o % l.length]; }
  return [sign, (side ? 3 : 0) + (o % 3)];
}
// Số nhà: lề trái số lẻ, lề phải số chẵn, tăng dần theo chiều dài phố (mỗi 3,4 m một số, hẹp hơn bề rộng phần lớn nhà ống). Hai nhà hẹp
// liền nhau rơi vào cùng một số thì nhà sau mang thêm chữ A, B... như nhà tách thửa ("12A"): gen/buildings.js settleFronts.
export const houseNumber = (S, side) => 2 * Math.max(0, Math.floor(S / NUM_STEP)) + (side ? 2 : 1);

// Quãng đường dọc cả con phố. Bản đồ cắt một phố thành nhiều đoạn; ở đây nối các đoạn cùng tên lại và đo từ đầu phố gần Hồ Gươm
// nhất (số nhà Hà Nội phần lớn đánh từ phía trung tâm ra). Trả về { s0, dir } theo chỉ số đoạn: quãng của điểm cách đầu đoạn s mét
// là s0 + (dir > 0 ? s : len - s). Đoạn không tên tự đo từ đầu của chính nó.
const chainCache = new WeakMap();
export function streetChains(world) {
  let C = chainCache.get(world); if (C) return C;
  const R = world.roads, s0 = new Float32Array(R.length), dir = new Int8Array(R.length).fill(1), byName = new Map();
  const key = (x, z) => Math.round(x * 10) * 100003 + Math.round(z * 10);
  for (const r of R) { if (r.name < 0 || r.name === undefined || r.name === null) continue; let l = byName.get(r.name); if (!l) byName.set(r.name, (l = [])); l.push(r); }
  for (const list of byName.values()) {
    const nodes = new Map(), ends = [];
    const node = (x, z) => { const k = key(x, z); let nd = nodes.get(k); if (!nd) nodes.set(k, (nd = { x, z, deg: 0, d: Infinity, comp: -1 })); nd.deg++; return nd; };
    for (const r of list) ends.push([node(r.p[0], r.p[1]), node(r.p[r.p.length - 2], r.p[r.p.length - 1])]);
    // các cụm đoạn nối liền nhau
    let nc = 0;
    for (let i = 0; i < list.length; i++) {
      if (ends[i][0].comp >= 0) continue;
      ends[i][0].comp = ends[i][1].comp = nc;
      for (let ch = true; ch;) { ch = false; for (const [a, b] of ends) if ((a.comp === nc) !== (b.comp === nc)) { a.comp = b.comp = nc; ch = true; } }
      nc++;
    }
    for (let c = 0; c < nc; c++) {
      let start = null, sd = Infinity, any = null, ad = Infinity;
      for (const nd of nodes.values()) { if (nd.comp !== c) continue; const d = nd.x * nd.x + nd.z * nd.z; if (d < ad) { ad = d; any = nd; } if (nd.deg === 1 && d < sd) { sd = d; start = nd; } }
      (start || any).d = 0;
      for (let ch = true, guard = 0; ch && guard < 400; guard++) { ch = false; for (let i = 0; i < list.length; i++) { const [a, b] = ends[i], l = list[i].len; if (a.comp !== c) continue; if (a.d + l < b.d - 1e-6) { b.d = a.d + l; ch = true; } if (b.d + l < a.d - 1e-6) { a.d = b.d + l; ch = true; } } }
    }
    for (let i = 0; i < list.length; i++) { const [a, b] = ends[i], r = list[i]; if (a.d <= b.d) { s0[r.i] = a.d; dir[r.i] = 1; } else { s0[r.i] = b.d; dir[r.i] = -1; } }
  }
  chainCache.set(world, (C = { s0, dir })); return C;
}
// Vị trí của điểm (x, z) dọc con phố r: out = [quãng đường tính từ đầu phố, lề (0 trái, 1 phải theo chiều quãng đường tăng), tx, tz].
// (tx, tz): hướng của phố tại đó theo chiều quãng đường tăng. Điểm nằm quá đầu mút của đoạn thì quãng đường kéo dài tiếp theo đường
// thẳng (không dồn cả về đầu mút), để các nhà ở cuối phố vẫn mỗi nhà một quãng.
export function alongStreet(world, r, x, z, out) {
  const C = streetChains(world), p = r.p, n = p.length; let bd = Infinity, bs = 0, cr = 0, tx = 1, tz = 0;
  for (let i = 0; i < n - 2; i += 2) {
    const ex = p[i + 2] - p[i], ez = p[i + 3] - p[i + 1], l2 = ex * ex + ez * ez; if (l2 < 1e-9) continue;
    const tu = ((x - p[i]) * ex + (z - p[i + 1]) * ez) / l2, t = Math.max(0, Math.min(1, tu)), qx = p[i] + ex * t - x, qz = p[i + 1] + ez * t - z, d = qx * qx + qz * qz;
    if (d < bd) { const l = Math.sqrt(l2), te = i === 0 && tu < 0 ? tu : i === n - 4 && tu > 1 ? tu : t; bd = d; bs = r.cum[i / 2] + te * l; cr = ex * (z - p[i + 1]) - ez * (x - p[i]); tx = ex / l; tz = ez / l; }
  }
  const d = C.dir[r.i]; out[0] = C.s0[r.i] + (d > 0 ? bs : r.len - bs); out[1] = cr * d > 0 ? 1 : 0; out[2] = tx * d; out[3] = tz * d; return out;
}

// ===== Nhà nào không bao giờ là cửa hàng =====
// Nhà được bản đồ ghi tên gần như luôn là cơ quan, trường học, ngân hàng, trạm, nhà hát, cao ốc văn phòng: không gắn biển cửa hàng,
// không bày quán. 0: nhà mặt phố thường; 1: công sở (không cửa hàng); 2: khách sạn, nhà nghỉ (một biển KHÁCH SẠN ở gian giữa).
const RX_HOTEL = /hotel|khách sạn|hostel|homestay|nhà nghỉ|residence|apartment/i;
const RX_SHOPNAME = /^(cafe|café|cà phê|coffee|kafe|bánh|cơm|phở|bún|quán|kem |tiệm)|bistro|restaurant|bakery|veston|beauty/i;
export function civicKind(name, area) {
  if (!name) return 0;
  if (RX_HOTEL.test(name)) return 2;
  if (RX_SHOPNAME.test(name) && area < 260) return 0; // hàng quán nhỏ được bản đồ ghi tên: vẫn là nhà mặt phố thường (game không hiện tên)
  return 1;
}
// Phố công sở: trụ sở, bộ ngành, ngân hàng, đại sứ quán chiếm gần hết mặt phố. Khối nhà lớn không tên trên các phố này là trụ sở
// (ví dụ trụ sở HĐND - UBND thành phố trên phố Lê Thạch, dãy nhà Bưu điện trên Đinh Tiên Hoàng), không phải dãy nhà ống buôn bán.
export const OFFICE_STREET = /Lê Thạch|Đinh Tiên Hoàng|Lý Thái Tổ|Ngô Quyền|Lê Phụng Hiểu|Tông Đản|Lê Lai|Phan Chu Trinh|Lý Thường Kiệt|Trần Hưng Đạo|Lê Thánh Tông|Phạm Ngũ Lão|Đặng Thái Thân|Tôn Đản|Lý Đạo Thành|Trần Nguyên Hãn|Trần Quang Khải|Hoàng Diệu|Điện Biên Phủ|Trần Phú|Lê Hồng Phong|Hùng Vương|Phan Đình Phùng|Chu Văn An|Tôn Thất Đàm|Bắc Sơn|Độc Lập|Nguyễn Tri Phương|Nguyễn Cảnh Chân|Hoàng Văn Thụ|Lê Duẩn|Nguyễn Thái Học/;

// ===== Bảng thực đơn, bảng nhỏ treo ở cửa (chữ nằm trong bảng đồ đạc đường phố, world/streetnames.js) =====
// Mỗi quán một bảng đúng món của biển hiệu: ba dòng, giá tính bằng nghìn đồng (mức giá Hà Nội 2026).
export const MENUS = {
  'PHỞ BÒ': ['PHỞ TÁI 50K', 'PHỞ CHÍN 50K', 'TÁI NẠM 55K'], 'BÚN CHẢ': ['BÚN CHẢ 45K', 'NEM CUA BỂ 15K', 'TRÀ ĐÁ 5K'], 'BÚN RIÊU': ['BÚN RIÊU 40K', 'BÚN ỐC 45K', 'THÊM GIÒ 10K'],
  'MIẾN LƯƠN': ['MIẾN TRỘN 50K', 'MIẾN NƯỚC 50K', 'CHÁO LƯƠN 40K'], 'CƠM BÌNH DÂN': ['CƠM SUẤT 40K', 'CƠM RANG 45K', 'PHỞ XÀO 50K'], 'BÚN ĐẬU': ['BÚN ĐẬU 40K', 'ĐẦY ĐỦ 60K', 'CHẢ CỐM 15K'],
  'LẨU · NƯỚNG': ['LẨU RIÊU CUA', 'BA CHỈ NƯỚNG', 'BIA LẠNH 15K'], 'BÁNH CUỐN': ['BÁNH CUỐN 35K', 'CHẢ QUẾ 10K', 'THÊM TRỨNG 10K'], 'CHẢ CÁ': ['CHẢ CÁ 150K', 'BÚN · LẠC RANG', 'MẮM TÔM'],
  'PHỞ GÀ': ['PHỞ GÀ 50K', 'MIẾN GÀ 50K', 'BÚN THANG 55K'], 'BÁNH TRÔI TÀU': ['BÁNH TRÔI 25K', 'CHÍ MÀ PHÙ 25K', 'LỤC TÀU XÁ 25K'], 'XÔI · CHÈ': ['XÔI XÉO 20K', 'CHÈ SEN 25K', 'TÀO PHỚ 15K'],
  'BÁNH MÌ': ['PA TÊ 25K', 'TRỨNG 20K', 'THẬP CẨM 35K'], 'BIA HƠI': ['BIA HƠI 15K', 'LẠC LUỘC 20K', 'NEM CHUA 40K'], 'NEM CHUA RÁN': ['NEM RÁN 40K', 'KHOAI CHIÊN 30K', 'TRÀ ĐÁ 5K'],
  'ỐC LUỘC': ['ỐC LUỘC 40K', 'ỐC XÀO 50K', 'NGAO HẤP 50K'], 'CÀ PHÊ': ['NÂU ĐÁ 30K', 'ĐEN ĐÁ 25K', 'CÀ PHÊ TRỨNG 40K'], 'TRÀ CHANH': ['TRÀ CHANH 20K', 'HƯỚNG DƯƠNG 15K', 'NEM CHUA 40K'],
  'KEM': ['KEM CỐM 15K', 'KEM ĐẬU XANH', 'KEM ỐC QUẾ 20K'], 'TRÀ ĐÁ': ['TRÀ ĐÁ 5K', 'NHÂN TRẦN 5K', 'KẸO LẠC 5K'], 'NƯỚC MÍA': ['NƯỚC MÍA 15K', 'TRÀ CHANH 20K', 'HƯỚNG DƯƠNG'],
};
// Bảng nhỏ khác: [dòng trên, dòng dưới]
export const BOARDS = [['CÒN', 'PHÒNG'], ['CHO THUÊ', 'CỬA HÀNG'], ['GIẢM GIÁ', 'CUỐI MÙA']];
export const BOARD = { room: 0, rent: 1, sale: 2 };
// Danh sách bảng theo thứ tự ô: thực đơn trước (theo thứ tự trong MENUS), bảng nhỏ sau. MENU_OF[chỉ số biển] = chỉ số ô, hoặc -1.
export const MENU_LIST = [...Object.values(MENUS), ...BOARDS.map((b) => [b[0], b[1]])];
export const MENU_OF = SIGNS.map((s) => (s ? Object.keys(MENUS).indexOf(s[0]) : -1));
export const BOARD0 = Object.keys(MENUS).length;
for (const k in MENUS) if (idx(k) < 0) throw new Error('signs: thực đơn của biển không có: ' + k);
