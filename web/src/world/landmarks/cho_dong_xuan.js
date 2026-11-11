// Chợ Đồng Xuân: mặt tiền kiểu Pháp gồm năm gian đầu hồi tam giác liền nhau (mỗi gian rộng 13 m, cao 19 m),
// mỗi gian có mảng ô thoáng hình tổ ong lớn trên đầu hồi và một cửa vòm ở giữa; gian giữa mang dòng chữ CHỢ ĐỒNG XUÂN.
// Phía sau là khối nhà chợ 70 × 60 × 14 m mái tôn xám dốc thoải. Gốc toạ độ ở tâm mặt bằng, mặt tiền quay về +z.
import { hash } from '../../core/util.js';

const lin = (h) => { const f = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)); return [f(((h >> 16) & 255) / 255), f(((h >> 8) & 255) / 255), f((h & 255) / 255)]; };
const CREAM = 0xecdfb4, TRIM = 0xf6f1e2, HOLE = 0x2a2520, METAL = 0x8a9096, HALLC = 0xd9cfb0, RED = 0xb3261e, PALE = 0xf4ecd2;
const BW = 13, NB = 5, ZF = 30, ZH = 24, ZB = -36, HX = 35, Y_EAVE = 12, Y_APEX = 19, Y_HALL = 14, Z_ROOF = 10;

const rect = (g, x0, y0, x1, y1, z) => g.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]);
function fanZ(g, pts, z) { const b = g.count; for (const p of pts) g.v(p[0], p[1], z, 0, 0, 1); for (let i = 1; i < pts.length - 1; i++) g.tri(b, b + i, b + i + 1); }
function archPts(cx, y0, w, hs, n = 5) { const hw = w / 2, pts = [[cx - hw, y0], [cx + hw, y0]]; for (let i = 0; i <= 2 * n; i++) { const t = (Math.PI * i) / (2 * n); pts.push([cx + hw * Math.cos(t), y0 + hs + hw * Math.sin(t)]); } return pts; }
// Tường phẳng đổi sắc nhẹ theo cột, chân tường bám bụi.
function wall(g, x0, y0, x1, y1, z, hexc, seed = 0, cw = 4, k0 = 1) {
  const c = lin(hexc), n = Math.max(1, Math.round((x1 - x0) / cw)), kb = y0 < 0.5 ? 0.78 : 0.96;
  for (let i = 0; i < n; i++) {
    const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n, k = k0 * (0.94 + 0.1 * hash(seed, i)), b = g.count;
    g.rgb(c[0] * k * kb, c[1] * k * kb, c[2] * k * kb * 0.95); g.v(xa, y0, z, 0, 0, 1); g.v(xb, y0, z, 0, 0, 1);
    g.rgb(c[0] * k, c[1] * k, c[2] * k); g.v(xb, y1, z, 0, 0, 1); g.v(xa, y1, z, 0, 0, 1);
    g.tri(b, b + 1, b + 2); g.tri(b, b + 2, b + 3);
  }
}

// Chữ điểm ảnh 5×7 (không có phông chữ thật): mỗi dòng là một hàng điểm, dấu thanh/dấu mũ thêm bằng các điểm rời.
const FONT = {
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'], H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'], G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'], U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
};
const HAT = [[2, -2], [1, -1], [3, -1]], DOT = [[2, 8]];
// [chữ gốc, các điểm dấu]: CHỢ ĐỒNG XUÂN
const TEXT = [['C'], ['H'], ['O', [[5, -1], [5, 0], ...DOT]], null, ['D', [[-1, 3], [1, 3]]], ['O', [...HAT, [4, -3], [5, -2]]], ['N'], ['G'], null, ['X'], ['U'], ['A', HAT], ['N']];
function pixText(g, text, cx, yTop, z, px) {
  let x = cx - (text.length * 6 - 1) * px * 0.5;
  for (const t of text) {
    if (t) {
      const rows = FONT[t[0]];
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
        if (rows[r][c] !== '#') continue; let e = c; while (e < 4 && rows[r][e + 1] === '#') e++;
        rect(g, x + c * px, yTop - (r + 1) * px, x + (e + 1) * px, yTop - r * px, z); c = e;
      }
      for (const d of t[1] || []) rect(g, x + d[0] * px, yTop - (d[1] + 1) * px, x + (d[0] + 1) * px, yTop - d[1] * px, z);
    }
    x += 6 * px;
  }
}

function bay(g, i) {
  const cx = (i - (NB - 1) / 2) * BW, x0 = cx - BW / 2, x1 = cx + BW / 2, mid = i === (NB - 1) / 2, z = ZF;
  const A = { w: 5.2, hs: 3.9 }; // cửa vòm giữa
  // tường: hai bên cửa, trên cửa, đầu hồi tam giác
  wall(g, x0, 0, cx - A.w / 2, Y_EAVE, z, CREAM, 10 + i, 2.0); wall(g, cx + A.w / 2, 0, x1, Y_EAVE, z, CREAM, 20 + i, 2.0);
  wall(g, cx - A.w / 2, A.hs + A.w / 2 + 0.2, cx + A.w / 2, Y_EAVE, z, CREAM, 30 + i, 2.6);
  { const n = 6, r = A.w / 2, top = A.hs + r + 0.2; g.color(CREAM).shade(0.97);
    for (let k = 0; k < n; k++) { const t0 = (Math.PI * k) / n, t1 = (Math.PI * (k + 1)) / n; g.quad([cx + r * Math.cos(t1), A.hs + r * Math.sin(t1), z], [cx + r * Math.cos(t0), A.hs + r * Math.sin(t0), z], [cx + r * Math.cos(t0), top, z], [cx + r * Math.cos(t1), top, z]); } }
  { const c = lin(CREAM), k = 0.95 + 0.07 * hash(40, i), b = g.count; g.rgb(c[0] * k, c[1] * k, c[2] * k); g.v(x0, Y_EAVE, z, 0, 0, 1); g.v(x1, Y_EAVE, z, 0, 0, 1); g.rgb(c[0] * k * 1.04, c[1] * k * 1.04, c[2] * k * 1.04); g.v(cx, Y_APEX, z, 0, 0, 1); g.tri(b, b + 1, b + 2); }
  // lòng cửa tối, sâu vào trong; khung vòm trắng
  g.color(0x1d1915); fanZ(g, archPts(cx, 0, A.w, A.hs), z - 1.2);
  g.color(CREAM).shade(0.7); g.quad([cx + A.w / 2, 0, z - 1.2], [cx + A.w / 2, 0, z], [cx + A.w / 2, A.hs, z], [cx + A.w / 2, A.hs, z - 1.2]); g.quad([cx - A.w / 2, 0, z], [cx - A.w / 2, 0, z - 1.2], [cx - A.w / 2, A.hs, z - 1.2], [cx - A.w / 2, A.hs, z]);
  { const n = 6, r = A.w / 2; for (let k = 0; k < n; k++) { const t0 = (Math.PI * k) / n, t1 = (Math.PI * (k + 1)) / n; g.color(CREAM).shade(0.55 + 0.1 * Math.abs(Math.cos(t0)));
      g.quad([cx + r * Math.cos(t0), A.hs + r * Math.sin(t0), z - 1.2], [cx + r * Math.cos(t0), A.hs + r * Math.sin(t0), z], [cx + r * Math.cos(t1), A.hs + r * Math.sin(t1), z], [cx + r * Math.cos(t1), A.hs + r * Math.sin(t1), z - 1.2]); } }
  g.color(TRIM);
  { const n = 6, r = A.w / 2, R = r + 0.4, zt = z + 0.1; rect(g, cx + r, 0, cx + R, A.hs, zt); rect(g, cx - R, 0, cx - r, A.hs, zt);
    for (let k = 0; k < n; k++) { const t0 = (Math.PI * k) / n, t1 = (Math.PI * (k + 1)) / n; g.quad([cx + r * Math.cos(t0), A.hs + r * Math.sin(t0), zt], [cx + R * Math.cos(t0), A.hs + R * Math.sin(t0), zt], [cx + R * Math.cos(t1), A.hs + R * Math.sin(t1), zt], [cx + r * Math.cos(t1), A.hs + r * Math.sin(t1), zt]); } }
  // hàng quán thấp thoáng trong cửa: vài mảng màu ấm
  for (let k = 0; k < 3; k++) { g.color([0xb9773a, 0x8f3b2c, 0x3e6f8a, 0xc9a23c][(i + k) % 4]).shade(0.5).glow(0.35); rect(g, cx - 2.2 + k * 1.55, 0.2, cx - 0.9 + k * 1.55, 1.6 + 0.5 * hash(i, k), z - 1.15); } g.glow(0);
  // dải chữ / gờ ngang trên cửa
  g.color(TRIM); g.box(x0, 8.75, z, x1, 9.0, z + 0.3, 'YZy');
  if (mid) { g.color(RED); rect(g, cx - 5.5, 6.95, cx + 5.5, 8.7, z + 0.1); g.color(PALE).glow(0.25); pixText(g, TEXT, cx, 8.28, z + 0.2, 0.125); g.glow(0); }
  else { g.color(CREAM).shade(0.9); rect(g, cx - 4.2, 7.2, cx + 4.2, 8.4, z + 0.08); }
  // mảng ô thoáng tổ ong: khung lõm hình ngũ giác + các lỗ lục giác so le
  const gx = 4.9, gy0 = 9.5, slope = (Y_APEX - Y_EAVE) / (BW / 2), lim = (x) => Y_EAVE + slope * (BW / 2 - Math.abs(x)) - 1.75;
  g.color(TRIM).shade(0.93); fanZ(g, [[cx - gx - 0.3, gy0 - 0.3], [cx + gx + 0.3, gy0 - 0.3], [cx + gx + 0.3, lim(gx + 0.3) + 0.55], [cx, lim(0) + 0.6], [cx - gx - 0.3, lim(gx + 0.3) + 0.55]], z + 0.08);
  g.color(0xe2d5aa); fanZ(g, [[cx - gx, gy0], [cx + gx, gy0], [cx + gx, lim(gx) + 0.3], [cx, lim(0) + 0.3], [cx - gx, lim(gx) + 0.3]], z + 0.14);
  g.color(HOLE);
  const px = 0.98, py = 0.85, hr = 0.4;
  for (let r = 0; gy0 + 0.5 + r * py < Y_APEX; r++) {
    const y = gy0 + 0.52 + r * py, off = r % 2 ? px / 2 : 0;
    for (let c = -6; c <= 6; c++) {
      const x = c * px + off; if (Math.abs(x) > gx - 0.42 || y + hr > lim(Math.abs(x) + 0.36) + 0.3) continue;
      const b = g.count; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; g.v(cx + x + Math.cos(a) * hr, y + Math.sin(a) * hr, z + 0.2, 0, 0, 1); }
      g.tri(b, b + 1, b + 2); g.tri(b, b + 2, b + 3); g.tri(b, b + 3, b + 4); g.tri(b, b + 4, b + 5);
    }
  }
  // gờ xiên đầu hồi (trắng) và chỏm đỉnh
  g.color(TRIM);
  const t = 0.55, zc = z + 0.3;
  g.quad([cx, Y_APEX - t, zc], [x1, Y_EAVE - t, zc], [x1, Y_EAVE + 0.15, zc], [cx, Y_APEX + 0.15, zc]); g.quad([x0, Y_EAVE - t, zc], [cx, Y_APEX - t, zc], [cx, Y_APEX + 0.15, zc], [x0, Y_EAVE + 0.15, zc]);
  g.color(TRIM).shade(0.8); g.quad([x1, Y_EAVE - t, zc], [cx, Y_APEX - t, zc], [cx, Y_APEX - t, z], [x1, Y_EAVE - t, z]); g.quad([cx, Y_APEX - t, zc], [x0, Y_EAVE - t, zc], [x0, Y_EAVE - t, z], [cx, Y_APEX - t, z]);
  g.color(TRIM).shade(0.97); g.box(cx - 0.45, Y_APEX - 0.2, z - 0.2, cx + 0.45, Y_APEX + 0.9, zc + 0.1); g.box(cx - 0.25, Y_APEX + 0.9, z - 0.05, cx + 0.25, Y_APEX + 1.5, zc - 0.05);
  // mái hai dốc chạy ra sau mỗi gian
  const s = 0.9 + 0.12 * hash(50, i);
  g.color(METAL).shade(s); g.quad([cx, Y_APEX + 0.15, z + 0.3], [x1, Y_EAVE + 0.15, z + 0.3], [x1, Y_EAVE + 0.15, Z_ROOF], [cx, Y_APEX + 0.15, Z_ROOF]);
  g.color(METAL).shade(s * 0.93); g.quad([x0, Y_EAVE + 0.15, z + 0.3], [cx, Y_APEX + 0.15, z + 0.3], [cx, Y_APEX + 0.15, Z_ROOF], [x0, Y_EAVE + 0.15, Z_ROOF]);
  g.color(HALLC).shade(0.85); g.tri3([x1, Y_EAVE, Z_ROOF], [x0, Y_EAVE, Z_ROOF], [cx, Y_APEX, Z_ROOF]);
}

export function build(g) {
  g.gloss(0).glow(0).sway(0);
  for (let i = 0; i < NB; i++) bay(g, i);
  // trụ giữa các gian (trắng kem), có mũ trụ
  for (let i = 0; i <= NB; i++) {
    const x = (i - NB / 2) * BW;
    g.color(TRIM).shade(0.97); g.box(x - 0.55, 0.9, ZF, x + 0.55, Y_EAVE - 0.4, ZF + 0.4, 'xXZ');
    g.color(0xbdb39a); g.box(x - 0.65, 0, ZF, x + 0.65, 0.9, ZF + 0.5, 'xXYZ');
    g.color(TRIM); g.box(x - 0.75, Y_EAVE - 0.4, ZF - 0.1, x + 0.75, Y_EAVE + 0.5, ZF + 0.55); g.box(x - 0.45, Y_EAVE + 0.5, ZF, x + 0.45, Y_EAVE + 1.3, ZF + 0.45);
  }
  // hai tường hồi của dãy mặt tiền
  const XE = (NB * BW) / 2;
  for (const sx of [-1, 1]) { g.push().rotY((sx * Math.PI) / 2); const a = sx > 0 ? -ZF : ZH - 1, b = sx > 0 ? -ZH + 1 : ZF; wall(g, a, 0, b, Y_EAVE + 0.15, XE, CREAM, 60 + sx, 3.5, 0.95); g.pop(); }

  // ----- khối nhà chợ phía sau -----
  const yR = 16.6, zR = (ZH + ZB) / 2;
  wall(g, -HX, 0, HX, Y_HALL, ZH, HALLC, 70, 5);
  g.push().rotY(Math.PI); wall(g, -HX, 0, HX, Y_HALL, -ZB, HALLC, 71, 5);
  for (let i = 0; i < 10; i++) { const x = -HX + (i + 0.5) * 7; stall(g, x, -ZB, 3 + i); }
  g.color(0x4b5560).gloss(0.4); rect(g, -HX + 1.5, 9.2, HX - 1.5, 11.4, -ZB + 0.08); g.gloss(0);
  g.color(HALLC).shade(1.04); for (let i = 0; i <= 10; i++) { const x = Math.max(-HX + 0.4, Math.min(HX - 0.4, -HX + i * 7)); g.box(x - 0.4, 0, -ZB, x + 0.4, Y_HALL, -ZB + 0.2, 'xXZ'); }
  g.pop();
  for (const sx of [-1, 1]) {
    g.push().rotY((sx * Math.PI) / 2);
    const a = sx > 0 ? -ZH : ZB, b = sx > 0 ? -ZB : ZH, n = 9, bw = (b - a) / n;
    wall(g, a, 0, b, Y_HALL, HX, HALLC, 80 + sx, bw);
    g.color(HALLC).shade(0.93); g.tri3([a, Y_HALL, HX], [b, Y_HALL, HX], [(a + b) / 2, yR, HX]);
    for (let i = 0; i < n; i++) stall(g, a + (i + 0.5) * bw, HX, 20 + i + sx * 7);
    g.color(0x4b5560).gloss(0.4); rect(g, a + 1.5, 9.2, b - 1.5, 11.4, HX + 0.08); g.gloss(0);
    g.color(HALLC).shade(1.04); for (let i = 0; i <= n; i++) { const x = Math.max(a + 0.4, Math.min(b - 0.4, a + i * bw)); g.box(x - 0.4, 0, HX, x + 0.4, Y_HALL, HX + 0.2, 'xXZ'); }
    g.pop();
  }
  // mái tôn xám dốc thoải, nóc chạy theo chiều ngang
  for (let i = 0; i < 10; i++) {
    const xa = -HX - 0.6 + (i * (2 * HX + 1.2)) / 10, xb = xa + (2 * HX + 1.2) / 10, s = 0.9 + 0.12 * hash(90, i);
    g.color(METAL).shade(s); g.quad([xa, Y_HALL - 0.05, ZH + 0.6], [xb, Y_HALL - 0.05, ZH + 0.6], [xb, yR, zR], [xa, yR, zR]);
    g.color(METAL).shade(s * 0.95); g.quad([xb, Y_HALL - 0.05, ZB - 0.6], [xa, Y_HALL - 0.05, ZB - 0.6], [xa, yR, zR], [xb, yR, zR]);
  }
  g.color(METAL).shade(0.7); g.box(-HX - 0.6, yR - 0.05, zR - 0.4, HX + 0.6, yR + 0.25, zR + 0.4, 'xXYzZ');
  g.color(0xffffff).gloss(0).glow(0).sway(0);
}

// Một ô cửa hàng dưới chân tường nhà chợ: cửa tối + mái bạt màu.
function stall(g, cx, z, seed) {
  g.color(0x2a2622); rect(g, cx - 2.2, 0, cx + 2.2, 3.4, z + 0.06);
  const cols = [0x2f6ea5, 0xb8432f, 0x3f8a5a, 0xd0a23a, 0x7d8a94];
  g.color(cols[Math.floor(hash(seed, 1) * cols.length)]).shade(0.85);
  g.quad([cx - 2.5, 3.0, z + 1.8], [cx + 2.5, 3.0, z + 1.8], [cx + 2.5, 3.9, z + 0.05], [cx - 2.5, 3.9, z + 0.05]);
  g.shade(0.6); g.quad([cx + 2.5, 3.0, z + 1.8], [cx - 2.5, 3.0, z + 1.8], [cx - 2.5, 3.9, z + 0.05], [cx + 2.5, 3.9, z + 0.05]);
}
