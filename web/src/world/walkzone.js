// Phố đi bộ quanh Hồ Gươm và tuyến chợ đêm phố cổ: từ 19 giờ tới nửa đêm các tối thứ Sáu, thứ Bảy, Chủ nhật, xe không được vào
// (docs/18, mục 5 và 8). Tệp này chỉ có dữ liệu và phép thử thuần, dùng chung cho dòng xe, đám đông, người chơi và các bài kiểm tra.
// Ngày trong tuần: 0 = thứ Hai ... 6 = Chủ nhật (engine/sky.js giữ ngày hiện tại của game).
export const WALK = { from: 19, to: 24, days: [4, 5, 6] };
export const walkOn = (day, hours) => WALK.days.includes(day) && hours >= WALK.from && hours < WALK.to;

// Vòng hồ, các phố nhỏ phía đông hồ và trục chợ đêm Hàng Đào - Đồng Xuân.
const WHOLE = new Set(['Phố Đinh Tiên Hoàng', 'Phố Lê Thái Tổ', 'Phố Hàng Khay', 'Phố Hồ Hoàn Kiếm', 'Phố Hàng Dầu', 'Phố Cầu Gỗ', 'Phố Báo Khánh', 'Phố Đinh Lễ', 'Phố Nguyễn Xí',
  'Phố Hàng Đào', 'Phố Hàng Ngang', 'Phố Hàng Đường', 'Phố Đồng Xuân']);
// Các phố này chỉ đóng đoạn nằm giữa hồ và phố Lý Thái Tổ (phố Lý Thái Tổ vẫn thông xe).
const WEST_OF_LY_THAI_TO = new Set(['Phố Lê Lai', 'Phố Lê Thạch', 'Phố Trần Nguyên Hãn', 'Phố Lò Sũ']);
// hoành độ của tim phố Lý Thái Tổ tại tung độ z (phố chạy chéo từ (246, -293) tới (437, 299))
const lyThaiToX = (z) => 246 + (z + 293) * 0.3226;

// Đoạn đường r có thuộc phố đi bộ không (r: đoạn đường trong world.roads, names: world.names).
export function isWalkRoad(names, r) {
  const n = names[r.name]; if (!n) return false;
  if (WHOLE.has(n)) return true;
  const p = r.p, i = (p.length >> 2) << 1, x = p[i], z = p[i + 1]; // điểm giữa đoạn
  // cửa ngõ phía nam: phố Tràng Tiền đóng từ hồ tới ngã tư Nguyễn Xí, phố Hàng Bài đóng từ hồ tới phố Hai Bà Trưng. Nếu để hai
  // đoạn này thông xe thì cả dòng xe của Hàng Bài (một chiều về phía hồ) dồn hết sang Tràng Tiền và tắc ngay trước rào.
  if (n === 'Phố Tràng Tiền') return x < 228;
  if (n === 'Phố Hàng Bài') return z < 486;
  if (!WEST_OF_LY_THAI_TO.has(n)) return false;
  return x < lyThaiToX(z) - 6;
}
