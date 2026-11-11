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
  ['SÁCH', 'TRUYỆN · VĂN PHÒNG PHẨM', 6], ['KEM', 'KEM CỐM · KEM ĐẬU XANH', 1], ['TRANH DÂN GIAN', 'TRANH HÀNG TRỐNG · KHUNG ẢNH', 0], ['CHẢ CÁ', 'CHẢ CÁ LÃ VỌNG', 5],
  ['ĐỒ GỐM', 'BÁT ĐĨA · LỌ HOA BÁT TRÀNG', 6], ['KIM KHÍ', 'KHOÁ · ĐINH · DỤNG CỤ', 7], ['VẢI', 'VẢI VÓC · RÈM CỬA', 9], ['TRE NỨA', 'ĐIẾU CÀY · THANG TRE', 2],
  ['BÁNH CỐM', 'BÁNH XU XÊ · CỐM LÀNG VÒNG', 2], ['QUẦN ÁO', 'THỜI TRANG NAM NỮ', 9], ['ĐỒ ĐỒNG', 'CHUÔNG · LƯ HƯƠNG · HOÀNH PHI', 3], ['MẮM · MUỐI', 'ĐỒ KHÔ · GIA VỊ', 8],
  ['SƠN · VÔI', 'VẬT LIỆU XÂY DỰNG', 1], ['NHA KHOA', 'RĂNG SỨ · NIỀNG RĂNG', 6], ['RỬA XE', 'THAY DẦU · BƠM VÁ', 7], ['BÚN ĐẬU', 'MẮM TÔM · CHẢ CỐM', 2],
  ['LẨU · NƯỚNG', 'BIA LẠNH · MỞ ĐẾN KHUYA', 0], ['TRÀ CHANH', 'HẠT HƯỚNG DƯƠNG · NEM CHUA', 3], ['ĐỒNG HỒ', 'SỬA CHỮA · THAY PIN', 7], ['ẢNH VIỆN', 'ẢNH THẺ LẤY NGAY · ẢNH CƯỚI', 4],
  ['CHĂN GA GỐI', 'ĐỆM · RÈM', 9], ['BÁNH CUỐN', 'BÁNH CUỐN NÓNG · CHẢ QUẾ', 5], ['HƯƠNG · NẾN', 'ĐỒ LỄ · VÀNG HƯƠNG', 8], ['CÂY CẢNH', 'CHẬU · HẠT GIỐNG · CHIM CẢNH', 2],
  ['ĐỒ BẠC', 'TRANG SỨC BẠC · CHẠM KHẮC', 7], ['NGOẠI TỆ', 'THU ĐỔI · VÀNG BẠC', 3], ['ĐÈN LỒNG', 'ĐỒ GIẤY · ĐÈN ÔNG SAO · MẶT NẠ', 0], ['LEN · SỢI', 'LEN ĐAN · KIM MÓC · CÚC ÁO', 6],
  ['PHỤ LIỆU MAY', 'KHOÁ KÉO · CÚC · CHỈ · REN', 1], ['ĐỒ THỜ', 'HOÀNH PHI · CÂU ĐỐI · TƯỢNG GỖ', 8], ['DÂY THỪNG', 'BẠT · LƯỚI · DÂY BUỘC', 2], ['ĐỒ LƯU NIỆM', 'SƠN MÀI · THỔ CẨM · NÓN LÁ', 12],
  ['THỜI TRANG', 'VÁY ĐẦM · ÁO SƠ MI', 11], ['TÚI XÁCH', 'VA LI · BA LÔ · VÍ DA', 7], ['KHẮC DẤU', 'DẤU ĐỒNG · BIỂN CHỨC DANH', 0], ['PHỞ GÀ', 'MIẾN GÀ · BÚN THANG', 3],
  ['BÁNH TRÔI TÀU', 'CHÍ MÀ PHÙ · LỤC TÀU XÁ', 5], ['PHÒNG TRANH', 'TRANH SƠN DẦU · SƠN MÀI', 10],
];
const idx = (t) => SIGNS.findIndex((s) => s && s[0] === t);
// Các ngành hàng chung, có ở mọi phố.
export const GENERIC = ['PHỞ BÒ', 'BÚN CHẢ', 'CÀ PHÊ', 'TRÀ ĐÁ', 'TẠP HOÁ', 'CẮT TÓC', 'SỬA XE MÁY', 'PHOTOCOPY', 'NHÀ NGHỈ', 'KARAOKE', 'HIỆU THUỐC', 'ĐIỆN THOẠI', 'BÁNH MÌ', 'XÔI · CHÈ', 'BÚN RIÊU', 'MIẾN LƯƠN', 'NƯỚC MÍA', 'HOA TƯƠI', 'MAY ĐO', 'KÍNH MẮT', 'GIẶT LÀ', 'CƠM BÌNH DÂN', 'BIA HƠI', 'KHÁCH SẠN', 'DU LỊCH', 'QUẦN ÁO', 'NHA KHOA', 'RỬA XE', 'BÚN ĐẬU', 'LẨU · NƯỚNG', 'TRÀ CHANH', 'ĐỒNG HỒ', 'ẢNH VIỆN', 'BÁNH CUỐN', 'CÂY CẢNH', 'GIÀY DÉP', 'SÁCH', 'PHỞ GÀ', 'THỜI TRANG', 'TÚI XÁCH'].map(idx);
// Phố nghề: tên đường OSM → các biển đặc trưng (chiếm khoảng hai phần ba số cửa hàng trên phố đó).
const T = (...a) => a.map(idx);
export const TRADES = {
  'Phố Hàng Bạc': T('VÀNG BẠC', 'ĐỒ BẠC', 'NGOẠI TỆ', 'VÀNG BẠC', 'DU LỊCH', 'KHÁCH SẠN'), 'Phố Hàng Mã': T('VÀNG MÃ', 'ĐÈN LỒNG', 'ĐÈN LỒNG', 'ĐỒ CHƠI', 'HƯƠNG · NẾN'), 'Phố Hàng Đào': T('QUẦN ÁO', 'THỜI TRANG', 'LỤA TƠ TẰM', 'VẢI', 'ĐỒNG HỒ'),
  'Phố Hàng Ngang': T('QUẦN ÁO', 'THỜI TRANG', 'VẢI'), 'Phố Hàng Gai': T('LỤA TƠ TẰM', 'LỤA TƠ TẰM', 'TRANH THÊU', 'MAY ĐO', 'ĐỒ LƯU NIỆM'), 'Phố Hàng Thiếc': T('ĐỒ THIẾC', 'ĐỒ THIẾC', 'KIM KHÍ'),
  'Phố Lãn Ông': T('THUỐC BẮC', 'THUỐC BẮC'), 'Phố Thuốc Bắc': T('KIM KHÍ', 'THUỐC BẮC', 'KIM KHÍ'), 'Phố Hàng Đường': T('Ô MAI', 'BÁNH KẸO', 'Ô MAI'), 'Phố Hàng Buồm': T('BÁNH KẸO', 'BÁNH KẸO', 'KHÁCH SẠN'),
  'Phố Hàng Chiếu': T('CHIẾU CÓI', 'DÂY THỪNG', 'CHIẾU CÓI', 'TRE NỨA'), 'Phố Hàng Quạt': T('ĐỒ THỜ', 'ĐỒ THỜ', 'ĐỒ ĐỒNG', 'KHẮC DẤU'), 'Phố Hàng Dầu': T('GIÀY DÉP', 'GIÀY DÉP'), 'Phố Tạ Hiện': T('BIA HƠI', 'BIA HƠI', 'LẨU · NƯỚNG'),
  'Phố Lương Ngọc Quyến': T('BIA HƠI', 'KHÁCH SẠN', 'DU LỊCH'), 'Phố Tràng Tiền': T('SÁCH', 'KEM', 'PHÒNG TRANH', 'SÁCH'), 'Phố Đinh Lễ': T('SÁCH', 'SÁCH'), 'Phố Hàng Bông': T('TRANH THÊU', 'MAY ĐO', 'VẢI'),
  'Phố Hàng Trống': T('TRANH DÂN GIAN', 'PHÒNG TRANH', 'ĐỒ LƯU NIỆM', 'KHÁCH SẠN'), 'Phố Lương Văn Can': T('ĐỒ CHƠI', 'ĐỒ CHƠI'), 'Phố Hàng Cân': T('SÁCH', 'ĐỒ CHƠI'), 'Phố Chả Cá': T('CHẢ CÁ', 'CHẢ CÁ', 'KHÁCH SẠN'),
  'Phố Hàng Than': T('BÁNH CỐM', 'BÁNH CỐM'), 'Phố Hàng Khoai': T('ĐỒ GỐM', 'TRE NỨA', 'MẮM · MUỐI'), 'Phố Hàng Vải': T('TRE NỨA', 'TRE NỨA', 'VẢI'), 'Phố Hàng Đồng': T('ĐỒ ĐỒNG', 'ĐỒ ĐỒNG'),
  'Phố Hàng Bồ': T('PHỤ LIỆU MAY', 'PHỤ LIỆU MAY', 'MAY ĐO', 'VẢI'), 'Phố Hàng Hòm': T('SƠN · VÔI', 'SƠN · VÔI'), 'Phố Hàng Điếu': T('CHĂN GA GỐI', 'Ô MAI', 'BÚN RIÊU'), 'Phố Bát Đàn': T('PHỞ BÒ', 'ĐỒ GỐM', 'PHỞ BÒ'),
  'Phố Hàng Mành': T('BÚN CHẢ', 'TRE NỨA'), 'Phố Hàng Lược': T('HOA TƯƠI', 'CÂY CẢNH'), 'Phố Đồng Xuân': T('VẢI', 'MẮM · MUỐI', 'QUẦN ÁO'), 'Phố Hàng Giấy': T('BÁNH KẸO', 'MẮM · MUỐI'),
  'Phố Hàng Cá': T('BÁNH MÌ', 'BÁNH CUỐN'), 'Phố Nguyễn Hữu Huân': T('CÀ PHÊ', 'CÀ PHÊ'), 'Phố Hàng Bè': T('MẮM · MUỐI', 'BÚN ĐẬU', 'XÔI · CHÈ'), 'Phố Cầu Gỗ': T('QUẦN ÁO', 'BÚN CHẢ', 'CÀ PHÊ'),
  'Ngõ Hàng Hành': T('CÀ PHÊ', 'KHÁCH SẠN', 'CÀ PHÊ'), 'Phố Hàng Bún': T('BÚN ĐẬU', 'BÚN RIÊU'), 'Phố Hàng Da': T('GIÀY DÉP', 'QUẦN ÁO'),
  'Phố Phùng Hưng': T('LẨU · NƯỚNG', 'PHỞ BÒ', 'CÀ PHÊ'), 'Phố Hàng Nón': T('ĐỒ THIẾC', 'HƯƠNG · NẾN'), 'Phố Hàng Chĩnh': T('ĐỒ GỐM', 'ĐỒ GỐM'),
  'Phố Đinh Liệt': T('LEN · SỢI', 'LEN · SỢI', 'QUẦN ÁO'), 'Phố Hàng Giầy': T('BÁNH TRÔI TÀU', 'GIÀY DÉP', 'KHÁCH SẠN'), 'Phố Hàng Khay': T('ĐỒ LƯU NIỆM', 'PHÒNG TRANH'),
  'Phố Mã Mây': T('DU LỊCH', 'KHÁCH SẠN', 'ĐỒ LƯU NIỆM', 'CÀ PHÊ'), 'Phố Hàng Lọng': T('PHỞ GÀ', 'CƠM BÌNH DÂN'),
};
// Loại cửa hàng của từng biển, để tầng trệt vẽ khớp với biển: F quán ăn, C cà phê giải khát, H khách sạn dịch vụ, B cửa kính, còn lại là hàng bày ra cửa.
const kindOf = { F: ['PHỞ BÒ', 'BÚN CHẢ', 'BÚN RIÊU', 'MIẾN LƯƠN', 'CƠM BÌNH DÂN', 'BÚN ĐẬU', 'LẨU · NƯỚNG', 'BÁNH CUỐN', 'CHẢ CÁ', 'PHỞ GÀ', 'BÁNH TRÔI TÀU', 'XÔI · CHÈ', 'BÁNH MÌ', 'BIA HƠI'],
  C: ['CÀ PHÊ', 'TRÀ CHANH', 'KEM', 'TRÀ ĐÁ', 'NƯỚC MÍA'], H: ['NHÀ NGHỈ', 'KHÁCH SẠN', 'DU LỊCH', 'KARAOKE'],
  B: ['VÀNG BẠC', 'ĐỒ BẠC', 'NGOẠI TỆ', 'LỤA TƠ TẰM', 'THỜI TRANG', 'TÚI XÁCH', 'KÍNH MẮT', 'ĐỒNG HỒ', 'ĐIỆN THOẠI', 'HIỆU THUỐC', 'NHA KHOA', 'ẢNH VIỆN', 'PHÒNG TRANH', 'TRANH THÊU', 'ĐỒ LƯU NIỆM', 'GIÀY DÉP', 'QUẦN ÁO', 'MAY ĐO'] };
export const SIGN_KIND = SIGNS.map((s) => { if (!s) return 'G'; for (const k in kindOf) if (kindOf[k].includes(s[0])) return k; return 'G'; });


// Bảng chữ 2048² chia 4 cột × 24 hàng (ô 512 × 85 điểm ảnh, tỉ lệ 6:1 khớp dải biển ngang trên cửa):
//   ô 0 trắng (mọi hình không có chữ), ô 1..N biển ngang, từ BLADE0 mỗi ô chứa 4 biển vẫy nhỏ (mỗi biển ngang một biển vẫy cùng chữ),
//   ô LED_CELL là hình trên màn hình LED quảng trường, ô cuối là cờ đỏ sao vàng.
// Trả về [u0, v0, u1, v1] đã thu vào trong để không lem màu.
export const ATLAS = { cols: 4, rows: 24, size: 2048 };
export function signUV(i) {
  const c = i % ATLAS.cols, r = Math.floor(i / ATLAS.cols), pu = 3 / ATLAS.size, pv = 3 / ATLAS.size;
  return [c / ATLAS.cols + pu, 1 - (r + 1) / ATLAS.rows + pv, (c + 1) / ATLAS.cols - pu, 1 - r / ATLAS.rows - pv];
}
export const WHITE_UV = [0.5 / ATLAS.cols, 1 - 0.5 / ATLAS.rows];
export const FLAG_CELL = ATLAS.cols * ATLAS.rows - 1; // ô cuối: cờ đỏ sao vàng
export const LED_CELL = FLAG_CELL - 1;
export const BLADE0 = SIGNS.length, BLADE_PER = 4;
if (BLADE0 + Math.ceil((SIGNS.length - 1) / BLADE_PER) > LED_CELL) throw new Error('signs: bảng chữ hết chỗ');
// Ô của biển vẫy đi kèm biển ngang thứ i.
export function bladeUV(i) {
  const k = i - 1, cell = BLADE0 + Math.floor(k / BLADE_PER), sub = k % BLADE_PER, uv = signUV(cell), w = (uv[2] - uv[0]) / BLADE_PER, pu = 2 / ATLAS.size;
  return [uv[0] + sub * w + pu, uv[1], uv[0] + (sub + 1) * w - pu, uv[3]];
}
// Chữ trên biển vẫy: chữ lớn của biển ngang ngắt làm tối đa hai dòng.
export function bladeLines(big) {
  const w = big.replace(/ · /g, ' ').split(' ');
  if (w.length === 1) return [big];
  if (w.length === 2) return w;
  let best = 1, bd = 1e9; for (let k = 1; k < w.length; k++) { const d = Math.abs(w.slice(0, k).join(' ').length - w.slice(k).join(' ').length); if (d < bd) { bd = d; best = k; } }
  return [w.slice(0, best).join(' '), w.slice(best).join(' ')];
}
