// Bảng màu và biển hiệu dùng chung cho worker (chọn chỉ số) và luồng chính (vẽ bảng chữ, shader).
// Biển chỉ ghi ngành hàng theo đúng truyền thống "36 phố phường" (Hàng Bạc bán vàng bạc, Hàng Mã bán đồ mã...),
// không ghi tên cửa hàng hay thương hiệu có thật.

// Bảng màu vôi tường. Shader nhận cả mảng; worker chọn chỉ số theo kiểu nhà.
export const PAL = [
  // 0..11 nhà ống: vàng đất, vàng nhạt, kem, xanh ngọc, xanh lơ, hồng đất, ghi
  0xd6a94e, 0xe2cd8a, 0xe6dcc0, 0xc3d6b0, 0xa9cdb9, 0xb9cfe0, 0xdfbda8, 0xc4c4bc, 0xe9e6dc, 0xd29a7e, 0xd9b866, 0xdcc79a,
  // 12..17 kiểu Pháp: các sắc vàng thuộc địa
  0xd8a94a, 0xc9963a, 0xead9b0, 0xe6d2a0, 0xddb45e, 0xe9dcc0,
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
];
export const P = { tube: [0, 12], french: [12, 6], apart: [18, 4], glass: [22, 4], tin: [26, 6], roof: [32, 4], temple: [36, 2], stone: [38, 1], white: [39, 1] };
// màu nền biển hiệu
export const SIGN_COLORS = [0xc0392b, 0x1f6fb5, 0x1e8a4c, 0xe0a81c, 0x7b3fa0, 0xd35400, 0x16a0a0, 0x2c3e50, 0xb3121f, 0xe84a8a, 0xf2efe6, 0x111111];

// [chữ lớn, chữ nhỏ, chỉ số màu nền]
export const SIGNS = [
  null, // ô 0 để trắng: mọi hình không phải biển hiệu lấy màu từ đây
  ['PHỞ BÒ', 'GIA TRUYỀN · TÁI · CHÍN · NẠM', 0], ['BÚN CHẢ', 'NEM CUA BỂ · BÚN NEM', 3], ['CÀ PHÊ', 'CÀ PHÊ TRỨNG · NÂU ĐÁ', 7], ['TRÀ ĐÁ', 'NHÂN TRẦN · THUỐC LÀO', 2],
  ['TẠP HOÁ', 'BÁNH KẸO · NƯỚC NGỌT · THUỐC LÁ', 1], ['CẮT TÓC', 'GỘI ĐẦU · CẠO MẶT', 6], ['SỬA XE MÁY', 'THAY DẦU · VÁ SĂM · RỬA XE', 8], ['PHOTOCOPY', 'IN ẤN · ĐÁNH MÁY', 1],
  ['NHÀ NGHỈ', 'PHÒNG ĐIỀU HOÀ · NÓNG LẠNH', 4], ['KARAOKE', 'PHÒNG VIP · ÂM THANH HAY', 9], ['HIỆU THUỐC', 'THUỐC TÂY · DỤNG CỤ Y TẾ', 2], ['ĐIỆN THOẠI', 'SỬA CHỮA · PHỤ KIỆN · SIM THẺ', 5],
  ['BÁNH MÌ', 'PA TÊ · TRỨNG · XÚC XÍCH', 3], ['XÔI · CHÈ', 'XÔI XÉO · CHÈ SEN · TÀO PHỚ', 9], ['BÚN RIÊU', 'BÚN ỐC · BÁNH ĐA CUA', 0], ['MIẾN LƯƠN', 'CHÁO LƯƠN · SÚP LƯƠN', 5],
  ['NƯỚC MÍA', 'TRÀ CHANH · HƯỚNG DƯƠNG', 2], ['HOA TƯƠI', 'HOA CƯỚI · LẴNG HOA', 9], ['MAY ĐO', 'ÁO DÀI · VEST · SỬA QUẦN ÁO', 4], ['KÍNH MẮT', 'ĐO MẮT MIỄN PHÍ', 1],
  ['GIẶT LÀ', 'GIẶT KHÔ · LẤY NGAY', 6], ['CƠM BÌNH DÂN', 'CƠM RANG · PHỞ XÀO', 8], ['BIA HƠI', 'LẠC LUỘC · NEM CHUA RÁN', 3], ['KHÁCH SẠN', 'HOTEL · ROOM FOR RENT', 7],
  ['DU LỊCH', 'VÉ TÀU · VÉ MÁY BAY · VISA', 1], ['VÀNG BẠC', 'ĐÁ QUÝ · KIM HOÀN', 3], ['LỤA TƠ TẰM', 'KHĂN LỤA · ÁO DÀI MAY SẴN', 4], ['ĐỒ CHƠI', 'ĐÈN LỒNG · ĐÈN ÔNG SAO', 0],
  ['VÀNG MÃ', 'ĐỒ THỜ · HƯƠNG NẾN', 8], ['THUỐC BẮC', 'ĐÔNG Y GIA TRUYỀN', 2], ['Ô MAI', 'MỨT SẤU · MƠ GỪNG', 5], ['BÁNH KẸO', 'MỨT TẾT · HẠT DƯA', 9],
  ['CHIẾU CÓI', 'THẢM · MÀNH TRÚC', 2], ['TRANH THÊU', 'TRANH SƠN MÀI · LỤA', 4], ['ĐỒ THIẾC', 'TÔN · HÒM THƯ · ỐNG NƯỚC', 7], ['GIÀY DÉP', 'GIÀY DA · DÉP TÔNG', 1],
  ['SÁCH', 'TRUYỆN · VĂN PHÒNG PHẨM', 6], ['KEM', 'KEM CỐM · KEM ĐẬU XANH', 1], ['TRANH DÂN GIAN', 'TRANH HÀNG TRỐNG · KHUNG ẢNH', 0], ['CHẢ CÁ', 'CHẢ CÁ LÃ VỌNG', 5],
  ['ĐỒ GỐM', 'BÁT ĐĨA · LỌ HOA BÁT TRÀNG', 6], ['KIM KHÍ', 'KHOÁ · ĐINH · DỤNG CỤ', 7], ['VẢI', 'VẢI VÓC · RÈM CỬA', 9], ['TRE NỨA', 'ĐIẾU CÀY · THANG TRE', 2],
  ['BÁNH CỐM', 'BÁNH XU XÊ · CỐM LÀNG VÒNG', 2], ['QUẦN ÁO', 'THỜI TRANG NAM NỮ', 9], ['ĐỒ ĐỒNG', 'CHUÔNG · LƯ HƯƠNG · HOÀNH PHI', 3], ['MẮM · MUỐI', 'ĐỒ KHÔ · GIA VỊ', 8],
  ['SƠN · VÔI', 'VẬT LIỆU XÂY DỰNG', 1], ['NHA KHOA', 'RĂNG SỨ · NIỀNG RĂNG', 6], ['RỬA XE', 'THAY DẦU · BƠM VÁ', 7], ['BÚN ĐẬU', 'MẮM TÔM · CHẢ CỐM', 2],
  ['LẨU · NƯỚNG', 'BIA LẠNH · MỞ ĐẾN KHUYA', 0], ['TRÀ CHANH', 'HẠT HƯỚNG DƯƠNG · NEM CHUA', 3], ['ĐỒNG HỒ', 'SỬA CHỮA · THAY PIN', 7], ['ẢNH VIỆN', 'ẢNH THẺ LẤY NGAY · ẢNH CƯỚI', 4],
  ['CHĂN GA GỐI', 'ĐỆM · RÈM', 9], ['BÁNH CUỐN', 'BÁNH CUỐN NÓNG · CHẢ QUẾ', 5], ['HƯƠNG · NẾN', 'ĐỒ LỄ · VÀNG HƯƠNG', 8], ['CÂY CẢNH', 'CHẬU · HẠT GIỐNG · CHIM CẢNH', 2],
];
const idx = (t) => SIGNS.findIndex((s) => s && s[0] === t);
// Các ngành hàng chung, có ở mọi phố.
export const GENERIC = ['PHỞ BÒ', 'BÚN CHẢ', 'CÀ PHÊ', 'TRÀ ĐÁ', 'TẠP HOÁ', 'CẮT TÓC', 'SỬA XE MÁY', 'PHOTOCOPY', 'NHÀ NGHỈ', 'KARAOKE', 'HIỆU THUỐC', 'ĐIỆN THOẠI', 'BÁNH MÌ', 'XÔI · CHÈ', 'BÚN RIÊU', 'MIẾN LƯƠN', 'NƯỚC MÍA', 'HOA TƯƠI', 'MAY ĐO', 'KÍNH MẮT', 'GIẶT LÀ', 'CƠM BÌNH DÂN', 'BIA HƠI', 'KHÁCH SẠN', 'DU LỊCH', 'QUẦN ÁO', 'NHA KHOA', 'RỬA XE', 'BÚN ĐẬU', 'LẨU · NƯỚNG', 'TRÀ CHANH', 'ĐỒNG HỒ', 'ẢNH VIỆN', 'BÁNH CUỐN', 'CÂY CẢNH', 'GIÀY DÉP', 'SÁCH'].map(idx);
// Phố nghề: tên đường OSM → các biển đặc trưng (chiếm khoảng hai phần ba số cửa hàng trên phố đó).
const T = (...a) => a.map(idx);
export const TRADES = {
  'Phố Hàng Bạc': T('VÀNG BẠC', 'VÀNG BẠC', 'DU LỊCH', 'KHÁCH SẠN'), 'Phố Hàng Mã': T('VÀNG MÃ', 'ĐỒ CHƠI', 'ĐỒ CHƠI', 'HƯƠNG · NẾN'), 'Phố Hàng Đào': T('LỤA TƠ TẰM', 'QUẦN ÁO', 'VẢI', 'ĐỒNG HỒ'),
  'Phố Hàng Ngang': T('QUẦN ÁO', 'VẢI', 'LỤA TƠ TẰM'), 'Phố Hàng Gai': T('LỤA TƠ TẰM', 'TRANH THÊU', 'MAY ĐO'), 'Phố Hàng Thiếc': T('ĐỒ THIẾC', 'ĐỒ THIẾC', 'KIM KHÍ'),
  'Phố Lãn Ông': T('THUỐC BẮC', 'THUỐC BẮC'), 'Phố Thuốc Bắc': T('KIM KHÍ', 'THUỐC BẮC', 'KIM KHÍ'), 'Phố Hàng Đường': T('Ô MAI', 'BÁNH KẸO', 'Ô MAI'), 'Phố Hàng Buồm': T('BÁNH KẸO', 'BÁNH KẸO', 'KHÁCH SẠN'),
  'Phố Hàng Chiếu': T('CHIẾU CÓI', 'TRE NỨA', 'CHIẾU CÓI'), 'Phố Hàng Quạt': T('ĐỒ ĐỒNG', 'VÀNG MÃ', 'HƯƠNG · NẾN'), 'Phố Hàng Dầu': T('GIÀY DÉP', 'GIÀY DÉP'), 'Phố Tạ Hiện': T('BIA HƠI', 'BIA HƠI', 'LẨU · NƯỚNG'),
  'Phố Lương Ngọc Quyến': T('BIA HƠI', 'KHÁCH SẠN', 'DU LỊCH'), 'Phố Tràng Tiền': T('SÁCH', 'KEM', 'SÁCH', 'TRANH THÊU'), 'Phố Đinh Lễ': T('SÁCH', 'SÁCH'), 'Phố Hàng Bông': T('TRANH THÊU', 'MAY ĐO', 'VẢI'),
  'Phố Hàng Trống': T('TRANH DÂN GIAN', 'TRANH THÊU', 'KHÁCH SẠN'), 'Phố Lương Văn Can': T('ĐỒ CHƠI', 'ĐỒ CHƠI'), 'Phố Hàng Cân': T('SÁCH', 'ĐỒ CHƠI'), 'Phố Chả Cá': T('CHẢ CÁ', 'CHẢ CÁ', 'KHÁCH SẠN'),
  'Phố Hàng Than': T('BÁNH CỐM', 'BÁNH CỐM'), 'Phố Hàng Khoai': T('ĐỒ GỐM', 'TRE NỨA', 'MẮM · MUỐI'), 'Phố Hàng Vải': T('TRE NỨA', 'TRE NỨA', 'VẢI'), 'Phố Hàng Đồng': T('ĐỒ ĐỒNG', 'ĐỒ ĐỒNG'),
  'Phố Hàng Bồ': T('MAY ĐO', 'VẢI', 'HƯƠNG · NẾN'), 'Phố Hàng Hòm': T('SƠN · VÔI', 'SƠN · VÔI'), 'Phố Hàng Điếu': T('CHĂN GA GỐI', 'Ô MAI', 'BÚN RIÊU'), 'Phố Bát Đàn': T('PHỞ BÒ', 'ĐỒ GỐM', 'PHỞ BÒ'),
  'Phố Hàng Mành': T('BÚN CHẢ', 'TRE NỨA'), 'Phố Hàng Lược': T('HOA TƯƠI', 'CÂY CẢNH'), 'Phố Đồng Xuân': T('VẢI', 'MẮM · MUỐI', 'QUẦN ÁO'), 'Phố Hàng Giấy': T('BÁNH KẸO', 'MẮM · MUỐI'),
  'Phố Hàng Cá': T('BÁNH MÌ', 'BÁNH CUỐN'), 'Phố Nguyễn Hữu Huân': T('CÀ PHÊ', 'CÀ PHÊ'), 'Phố Hàng Bè': T('MẮM · MUỐI', 'BÚN ĐẬU', 'XÔI · CHÈ'), 'Phố Cầu Gỗ': T('QUẦN ÁO', 'BÚN CHẢ', 'CÀ PHÊ'),
  'Phố Hàng Hành': T('CÀ PHÊ', 'KHÁCH SẠN', 'CÀ PHÊ'), 'Phố Bảo Khánh': T('CÀ PHÊ', 'KHÁCH SẠN'), 'Phố Hàng Bún': T('BÚN ĐẬU', 'BÚN RIÊU'), 'Phố Hàng Da': T('GIÀY DÉP', 'QUẦN ÁO'),
  'Phố Phùng Hưng': T('LẨU · NƯỚNG', 'PHỞ BÒ', 'CÀ PHÊ'), 'Phố Hàng Nón': T('ĐỒ THIẾC', 'HƯƠNG · NẾN'), 'Phố Hàng Chĩnh': T('ĐỒ GỐM', 'ĐỒ GỐM'),
};

// Ô của biển trong bảng chữ (4 cột × 16 hàng). Trả về [u0, v0, u1, v1] đã thu vào trong để không lem màu.
export const ATLAS = { cols: 4, rows: 16, size: 2048 };
export function signUV(i) {
  const c = i % ATLAS.cols, r = Math.floor(i / ATLAS.cols), pu = 3 / ATLAS.size, pv = 3 / ATLAS.size;
  return [c / ATLAS.cols + pu, 1 - (r + 1) / ATLAS.rows + pv, (c + 1) / ATLAS.cols - pu, 1 - r / ATLAS.rows - pv];
}
export const WHITE_UV = [0.5 / ATLAS.cols, 1 - 0.5 / ATLAS.rows];
export const FLAG_CELL = 63; // ô cuối: cờ đỏ sao vàng
