// Biển tên phố và bảng chữ thứ hai ("bảng đồ đạc đường phố"): tách tên đường thành hai dòng như biển thật
// ("PHỐ" / "HÀNG ĐÀO"), và bố cục các ô chữ. Tệp này không phụ thuộc three.js: luồng chính dùng để vẽ canvas
// (streetatlas.js), worker dùng để tính uv (gen/furniture.js). Hai bên cùng suy ra bố cục từ danh sách tên đường đã
// sắp xếp, nên không cần gửi gì qua lại.
// Bảng chỉ có MỘT kênh (độ phủ của nét chữ): màu nền lấy từ màu đỉnh, màu chữ do shader chọn. Nhờ vậy 760 biển tên phố
// ở cỡ 4096² chỉ tốn 16 MB thay vì 64 MB.

const RX = /^(Phố|Đường|Ngõ|Ngách|Hẻm) \S/;
const up = (s) => s.toLocaleUpperCase('vi');
export const isPlateName = (n) => !!n && RX.test(n);
export const isAlleyName = (n) => !!n && /^(Ngõ|Ngách|Hẻm) /.test(n);

// Hai dòng chữ trên biển: [dòng nhỏ (loại đường, kèm số ngõ), dòng lớn (tên)].
//   "Phố Hàng Đào" → PHỐ / HÀNG ĐÀO;  "Ngõ 15 Đường Nguyễn Tri Phương" → NGÕ 15 / NGUYỄN TRI PHƯƠNG;
//   "Ngách 11 Ngõ Thịnh Hào 1" → NGÁCH 11 / NGÕ THỊNH HÀO 1;  "Ngõ Bảo Khánh" → NGÕ / BẢO KHÁNH
export function plateText(name) {
  const t = name.split(' '), type = t[0];
  if (type === 'Phố' || type === 'Đường') return [up(type), up(t.slice(1).join(' '))];
  let j = -1; const low = t.map((w) => w.toLocaleLowerCase('vi')); // dữ liệu có chỗ viết "Ngõ 45 phố Nguyễn Thái Học"
  for (let i = t.length - 2; i > 0; i--) if (low[i] === 'phố' || low[i] === 'đường' || low[i] === 'ngõ') { j = i; break; }
  if (j > 0) return [up(t.slice(0, j).join(' ')), up(t.slice(low[j] === 'ngõ' ? j : j + 1).join(' '))];
  if (t.length > 2 && /^\d/.test(t[1])) return [up(`${t[0]} ${t[1]}`), up(t.slice(2).join(' '))];
  return [up(type), up(t.slice(1).join(' '))];
}

// Kích thước biển tên phố trong game (m). Biển thật 75 × 40 cm; phóng 12% cho dễ đọc ở góc nhìn người thứ ba.
export const PLATE_W = 0.84, PLATE_H = 0.45, PLATE_BLUE = 0x12408f;

// Khẩu hiệu thật, quen thuộc trên phố Hà Nội (băng rôn đỏ chữ vàng) và trên rào công trường.
export const BANNERS = [
  'XÂY DỰNG THỦ ĐÔ HÀ NỘI VĂN HIẾN - VĂN MINH - HIỆN ĐẠI',
  'TOÀN DÂN ĐOÀN KẾT XÂY DỰNG ĐỜI SỐNG VĂN HOÁ',
  'AN TOÀN GIAO THÔNG LÀ HẠNH PHÚC CỦA MỌI NHÀ',
  'ĐẢNG CỘNG SẢN VIỆT NAM QUANG VINH MUÔN NĂM',
];
export const SITE_TEXT = [
  ['CÔNG TRƯỜNG ĐANG THI CÔNG', 'XIN LỖI ĐÃ LÀM PHIỀN'],
  ['AN TOÀN LÀ TRÊN HẾT', ''],
  ['ĐƯỜNG SẮT ĐÔ THỊ THÍ ĐIỂM THÀNH PHỐ HÀ NỘI', 'ĐOẠN NHỔN - GA HÀ NỘI'],
];
export const WARN_TEXT = ['CẤM LẠI GẦN!', 'CÓ ĐIỆN NGUY HIỂM CHẾT NGƯỜI'];
export const HNUM_CHARS = '0123456789/'; // ký tự trên biển số nhà (trong ngõ ghi dạng 12/34)
export const HNUM_BLUE = 0x12408f;

// Mã ghi vào kênh alpha của màu đỉnh (0..255) để shader của bảng đồ đạc biết cách tô (streetatlas.js):
//   0: chữ trắng trên nền màu đỉnh;  INK_*: chữ màu khác;
//   1..7 (3 bit thấp): bộ phận của đèn tín hiệu, kèm nhóm pha (bit 3), "chỉ đếm 8 giây cuối" (bit 4), độ lệch chu kỳ (bit 5-6).
export const INK_YELLOW = 128, INK_RED = 64, INK_DARK = 32;
export const SIG = { red: 1, amber: 2, green: 3, tens: 4, units: 5, pedStop: 6, pedGo: 7 };
export const sigCode = (kind, grp, last8, off) => kind + (grp ? 8 : 0) + (last8 ? 16 : 0) + ((off & 3) << 5);

const COLS = 20, cache = new WeakMap();
// Bố cục bảng: các hàng đầu là biển tên (20 ô mỗi hàng, theo thứ tự tên đã sắp xếp), bốn hàng cuối là các ô phụ: hai hàng đồ đạc
// phố (chữ số đèn, biển xe buýt, khẩu hiệu), một hàng chữ số biển số nhà và bảng nhỏ treo cửa hàng, một hàng bảng thực đơn.
// uv trả về dạng [u0, v0, u1, v1] (v hướng lên như texture của WebGL), đã thu vào trong để không lem sang ô bên.
export function plateLayout(world) {
  let L = cache.get(world); if (L) return L;
  const set = new Set();
  for (const r of world.roads) { const n = world.names[r.name]; if (isPlateName(n)) set.add(n); }
  const names = [...set].sort(), index = new Map(names.map((n, i) => [n, i]));
  const nameRows = Math.ceil(names.length / COLS), rows = nameRows + 4, cw = 1 / COLS, ch = 1 / rows;
  const rect = (x0, x1, row, padU = 0.012, padV = 0.03) => [(x0 + padU) * cw, 1 - (row + 1 - padV) * ch, (x1 - padU) * cw, 1 - (row + padV) * ch];
  const E0 = nameRows, E1 = nameRows + 1, E2 = nameRows + 2, E3 = nameRows + 3;
  L = {
    names, index, cols: COLS, rows, cw, ch,
    uv: (i) => rect(i % COLS, (i % COLS) + 1, Math.floor(i / COLS)),
    uvOf: (name) => { const i = index.get(name); return i === undefined ? null : L.uv(i); },
    digit: rect(0, 0.25, E0), digitStep: 0.25 * cw,   // chữ số 0: các chữ số sau cách nhau digitStep theo u
    blank: [2.75 * cw, 1 - (E0 + 0.5) * ch],          // điểm không có nét chữ nào: cho mọi mặt trơn
    pedStop: rect(3, 3.25, E0), pedGo: rect(3.25, 3.5, E0), star: rect(3.5, 4, E0), bus: rect(4, 5, E0),
    park: rect(5, 5.5, E0), sickle: rect(5.5, 6, E0),
    site: [rect(6, 10, E0), rect(10, 14, E0), rect(14, 18, E0)], warn: rect(18, 20, E0),
    banner: [rect(0, 5, E1), rect(5, 10, E1), rect(10, 15, E1), rect(15, 20, E1)],
    // biển số nhà: 11 ký tự HNUM_CHARS, mỗi ký tự một ô hẹp cách nhau hnumStep theo u; hframe: viền trắng bo góc của biển
    hnum: rect(0, 0.2, E2, 0.01, 0.05), hnumStep: 0.2 * cw, hframe: rect(2.4, 3.4, E2),
    // bảng thực đơn và bảng nhỏ treo cửa (world/signs.js MENU_LIST): 20 ô đầu ở hàng cuối, các ô sau nối vào hàng số nhà
    menu: (i) => (i < COLS ? rect(i, i + 1, E3) : rect(4 + i - COLS, 5 + i - COLS, E2)),
  };
  cache.set(world, L); return L;
}
