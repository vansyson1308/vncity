// Chợ Đồng Xuân. Chợ xây năm 1889-1890 với năm nhà cầu, mặt tiền năm đầu hồi tam giác trổ lỗ tổ ong. Khoảng năm 1990
// hai dãy ngoài bị phá, ba dãy giữa xây lại ba tầng: mặt tiền ngày nay còn ba đầu hồi (gian giữa cao 19 m, lớn hơn hai
// gian bên), mỗi gian một cửa vòm lớn, phía trên là mảng ô thoáng tổ ong; gian giữa mang hàng chữ đỏ CHỢ ĐỒNG XUÂN.
// Hai bên là hai cánh nhà mới ba tầng mái bằng, còn giữ hai trụ ngoài cùng. Phía sau là khối nhà chợ 70 × 60 × 14 m.
// Gốc toạ độ ở tâm mặt bằng, mặt tiền quay về +z.
import { hash } from '../../core/util.js';
import { MAT } from '../../core/geo.js';

const lin = (h) => { const f = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)); return [f(((h >> 16) & 255) / 255), f(((h >> 8) & 255) / 255), f((h & 255) / 255)]; };
const CREAM = 0xeadba6, TRIM = 0xf4eedc, HOLE = 0x211d19, METAL = 0x868c92, HALLC = 0xd9cfb0, RED = 0xb3261e, BASE = 0xa9a08a;
const ZF = 30, ZH = 24, ZB = -36, HX = 35, XE = 32.5, Y_HALL = 14, Y_WING = 13.2, Z_ROOF = 10;
// ba gian đầu hồi: tâm, bề rộng, cao mép mái, cao đỉnh, cửa vòm (rộng, cao thân), cao gờ ngang
const BAYS = [
  { cx: -13.75, w: 12.5, ye: 10.2, ya: 16.4, aw: 5.0, ah: 3.4, yc: 8.0 },
  { cx: 0, w: 15, ye: 11.2, ya: 19, aw: 6.0, ah: 3.6, yc: 9.75, mid: true },
  { cx: 13.75, w: 12.5, ye: 10.2, ya: 16.4, aw: 5.0, ah: 3.4, yc: 8.0 },
];

const rect = (g, x0, y0, x1, y1, z) => g.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]);
function fanZ(g, pts, z) { const b = g.count; for (const p of pts) g.v(p[0], p[1], z, 0, 0, 1); for (let i = 1; i < pts.length - 1; i++) g.tri(b, b + i, b + i + 1); }
function archPts(cx, y0, w, hs, n = 5) { const hw = w / 2, pts = [[cx - hw, y0], [cx + hw, y0]]; for (let i = 0; i <= 2 * n; i++) { const t = (Math.PI * i) / (2 * n); pts.push([cx + hw * Math.cos(t), y0 + hs + hw * Math.sin(t)]); } return pts; }
// Tường phẳng đổi sắc nhẹ theo cột (vôi quét nhiều lớp); loang ố, chân tường ẩm do chất liệu plaster lo.
function wall(g, x0, y0, x1, y1, z, hexc, seed = 0, cw = 4, k0 = 1) {
  const c = lin(hexc), n = Math.max(1, Math.round((x1 - x0) / cw));
  for (let i = 0; i < n; i++) {
    const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n, k = k0 * (0.95 + 0.09 * hash(seed, i));
    g.rgb(c[0] * k, c[1] * k, c[2] * k * 0.97); rect(g, xa, y0, xb, y1, z);
  }
}

// ----- chữ nét khối (không có phông chữ thật): mỗi chữ là vài đường gấp khúc trong ô rộng 0,7 × cao 1, đùn nổi ra phía +z -----
const OCT = [[0.2, 0], [0.5, 0], [0.7, 0.2], [0.7, 0.8], [0.5, 1], [0.2, 1], [0, 0.8], [0, 0.2]];
const HAT = [[0.12, 1.2], [0.35, 1.4], [0.58, 1.2]], DOT = [[0.35, -0.36], [0.35, -0.22]];
const GLYPH = {
  C: [[[0.68, 0.78], [0.5, 1], [0.2, 1], [0, 0.8], [0, 0.2], [0.2, 0], [0.5, 0], [0.68, 0.22]]],
  G: [[[0.68, 0.78], [0.5, 1], [0.2, 1], [0, 0.8], [0, 0.2], [0.2, 0], [0.5, 0], [0.7, 0.18], [0.7, 0.48], [0.4, 0.48]]],
  H: [[[0, 0], [0, 1]], [[0.7, 0], [0.7, 1]], [[0, 0.5], [0.7, 0.5]]],
  N: [[[0, 0], [0, 1]], [[0.7, 0], [0.7, 1]], [[0.02, 0.98], [0.68, 0.02]]],
  X: [[[0, 0], [0.7, 1]], [[0, 1], [0.7, 0]]],
  U: [[[0, 1], [0, 0.2], [0.2, 0], [0.5, 0], [0.7, 0.2], [0.7, 1]]],
  A: [[[0, 0], [0.34, 1]], [[0.7, 0], [0.36, 1]], [[0.13, 0.33], [0.57, 0.33]]],
  O: [OCT, 1],
  'Ợ': [OCT, 1, [[0.63, 0.9], [0.84, 0.97], [0.9, 1.2]], DOT],            // O móc + dấu nặng
  'Ồ': [OCT, 1, HAT, [[0.44, 1.76], [0.66, 1.52]]],                        // Ô + dấu huyền
  'Â': [[[0, 0], [0.34, 1]], [[0.7, 0], [0.36, 1]], [[0.13, 0.33], [0.57, 0.33]], HAT],
  'Đ': [[[0, 0], [0.45, 0], [0.7, 0.22], [0.7, 0.78], [0.45, 1], [0, 1]], 1, [[-0.17, 0.5], [0.27, 0.5]]],
};
// Một nét: đường gấp khúc P (toạ độ thật), nửa bề rộng h, mặt trước ở zf, lưng ở zb.
function stroke(g, P, closed, h, zf, zb, col) {
  const n = P.length, L = [], R = [];
  const dir = (a, b) => { const dx = P[b][0] - P[a][0], dy = P[b][1] - P[a][1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
  for (let i = 0; i < n; i++) {
    const d0 = closed || i > 0 ? dir((i + n - 1) % n, i) : null, d1 = closed || i < n - 1 ? dir(i, (i + 1) % n) : null, a = d0 || d1, b = d1 || d0;
    let mx = -(a[1] + b[1]), my = a[0] + b[0]; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
    const k = Math.min(2.2, 1 / Math.max(0.2, -mx * b[1] + my * b[0])) * h;
    L.push([P[i][0] + mx * k, P[i][1] + my * k]); R.push([P[i][0] - mx * k, P[i][1] - my * k]);
  }
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % n;
    g.color(col); g.quad([R[i][0], R[i][1], zf], [R[j][0], R[j][1], zf], [L[j][0], L[j][1], zf], [L[i][0], L[i][1], zf]);
    g.color(col).shade(0.62);
    g.quad([L[i][0], L[i][1], zf], [L[j][0], L[j][1], zf], [L[j][0], L[j][1], zb], [L[i][0], L[i][1], zb]);
    g.quad([R[j][0], R[j][1], zf], [R[i][0], R[i][1], zf], [R[i][0], R[i][1], zb], [R[j][0], R[j][1], zb]);
  }
  if (!closed) {
    const e = n - 1;
    g.quad([L[0][0], L[0][1], zf], [L[0][0], L[0][1], zb], [R[0][0], R[0][1], zb], [R[0][0], R[0][1], zf]);
    g.quad([R[e][0], R[e][1], zf], [R[e][0], R[e][1], zb], [L[e][0], L[e][1], zb], [L[e][0], L[e][1], zf]);
  }
}
// Hàng chữ căn giữa tại cx, chân chữ ở y, chữ cao s.
function text(g, str, cx, y, zf, s, depth, col) {
  const adv = (ch) => (ch === ' ' ? 0.62 : 1.0);
  let w = -0.3; for (const ch of str) w += adv(ch);
  let x = cx - (w * s) / 2;
  for (const ch of str) {
    const gl = GLYPH[ch];
    if (gl) { let closed = false; for (let k = 0; k < gl.length; k++) { if (gl[k] === 1) continue; closed = gl[k + 1] === 1; stroke(g, gl[k].map((p) => [x + p[0] * s, y + p[1] * s]), closed, 0.085 * s, zf, zf - depth, col); } }
    x += adv(ch) * s;
  }
}

function bay(g, B, i) {
  const { cx, w, ye, ya, aw, ah, yc, mid } = B, x0 = cx - w / 2, x1 = cx + w / 2, z = ZF, r = aw / 2, top = ah + r + 0.2;
  const slope = (ya - ye) / (w / 2), n = 8;
  // tường: hai bên cửa, trên cửa, đầu hồi tam giác
  g.mat(MAT.plaster);
  wall(g, x0, 0, cx - r, ye, z, CREAM, 10 + i, 2.2); wall(g, cx + r, 0, x1, ye, z, CREAM, 20 + i, 2.2);
  wall(g, cx - r, top, cx + r, ye, z, CREAM, 30 + i, 3.2);
  g.color(CREAM).shade(0.98);
  for (let k = 0; k < n; k++) { const t0 = (Math.PI * k) / n, t1 = (Math.PI * (k + 1)) / n; g.quad([cx + r * Math.cos(t1), ah + r * Math.sin(t1), z], [cx + r * Math.cos(t0), ah + r * Math.sin(t0), z], [cx + r * Math.cos(t0), top, z], [cx + r * Math.cos(t1), top, z]); }
  g.color(CREAM).shade(0.96 + 0.06 * hash(40, i)); g.tri3([x0, ye, z], [x1, ye, z], [cx, ya, z]);
  // lòng cửa sâu vào trong: má cửa, lòng vòm
  g.color(CREAM).shade(0.72); g.quad([cx + r, 0, z - 1.2], [cx + r, 0, z], [cx + r, ah, z], [cx + r, ah, z - 1.2]); g.quad([cx - r, 0, z], [cx - r, 0, z - 1.2], [cx - r, ah, z - 1.2], [cx - r, ah, z]);
  for (let k = 0; k < n; k++) { const t0 = (Math.PI * k) / n, t1 = (Math.PI * (k + 1)) / n; g.color(CREAM).shade(0.5 + 0.14 * Math.abs(Math.cos((t0 + t1) / 2)));
    g.quad([cx + r * Math.cos(t0), ah + r * Math.sin(t0), z - 1.2], [cx + r * Math.cos(t0), ah + r * Math.sin(t0), z], [cx + r * Math.cos(t1), ah + r * Math.sin(t1), z], [cx + r * Math.cos(t1), ah + r * Math.sin(t1), z - 1.2]); }
  // khung vòm trắng nổi, vai vòm và đá khoá
  g.color(TRIM);
  { const R = r + 0.42, zt = z + 0.1; rect(g, cx + r, 0, cx + R, ah, zt); rect(g, cx - R, 0, cx - r, ah, zt);
    for (let k = 0; k < n; k++) { const t0 = (Math.PI * k) / n, t1 = (Math.PI * (k + 1)) / n; g.quad([cx + r * Math.cos(t0), ah + r * Math.sin(t0), zt], [cx + R * Math.cos(t0), ah + R * Math.sin(t0), zt], [cx + R * Math.cos(t1), ah + R * Math.sin(t1), zt], [cx + r * Math.cos(t1), ah + r * Math.sin(t1), zt]); }
    for (const s of [-1, 1]) g.box(cx + s * (r + 0.24) - 0.34, ah - 0.18, z, cx + s * (r + 0.24) + 0.34, ah + 0.18, z + 0.2, 'xXYZy');
    g.box(cx - 0.3, ah + r - 0.05, z, cx + 0.3, ah + r + 0.75, z + 0.24, 'xXYZy'); }
  // gờ ngang trắng dưới mảng ô thoáng
  g.color(TRIM); g.box(x0, yc - 0.25, z, x1, yc, z + 0.3, 'YZy');
  g.mat();
  // trong cửa: bóng tối nhà chợ, vài sạp hàng sáng đèn
  g.color(0x1d1915); fanZ(g, archPts(cx, 0, aw, ah, n / 2), z - 1.2);
  for (let k = 0; k < 3; k++) { g.color([0xb9773a, 0x8f3b2c, 0x3e6f8a, 0xc9a23c][(i + k) % 4]).shade(0.5).glow(0.35); rect(g, cx - r + 0.4 + k * (aw - 0.8) / 3, 0.2, cx - r + 0.2 + (k + 1) * (aw - 0.8) / 3, 1.6 + 0.5 * hash(i, k), z - 1.15); } g.glow(0);
  // hàng chữ đỏ nổi (gian giữa) hoặc ô tường lõm (gian bên)
  if (mid) text(g, 'CHỢ ĐỒNG XUÂN', cx, top + 0.58, z + 0.16, 0.98, 0.13, RED);
  else { g.mat(MAT.plaster).color(CREAM).shade(0.88); rect(g, cx - 3.8, top + 0.35, cx + 3.8, yc - 0.6, z + 0.05); g.mat(); }
  // mảng ô thoáng tổ ong: khung trắng + nền lõm hình ngũ giác theo dốc đầu hồi, lỗ lục giác so le
  const gx = w / 2 - 1.3, gy0 = yc + 0.45, lim = (x) => ya - slope * Math.abs(x) - 1.3;
  g.mat(MAT.plaster);
  g.color(TRIM).shade(0.95); fanZ(g, [[cx - gx - 0.28, gy0 - 0.28], [cx + gx + 0.28, gy0 - 0.28], [cx + gx + 0.28, lim(gx + 0.28) + 0.42], [cx, lim(0) + 0.42], [cx - gx - 0.28, lim(gx + 0.28) + 0.42]], z + 0.06);
  g.color(CREAM).shade(0.9); fanZ(g, [[cx - gx, gy0], [cx + gx, gy0], [cx + gx, lim(gx)], [cx, lim(0)], [cx - gx, lim(gx)]], z + 0.1);
  g.mat();
  const px = 0.76, py = px * 0.866, hr = 0.3;
  for (let rr = 0; gy0 + 0.5 + rr * py < ya; rr++) {
    const y = gy0 + 0.5 + rr * py, off = rr % 2 ? px / 2 : 0;
    for (let c = -10; c <= 10; c++) {
      const x = c * px + off; if (Math.abs(x) > gx - 0.4 || y + hr > lim(Math.abs(x) + 0.3) - 0.1) continue;
      g.color(HOLE).shade(0.7 + 0.9 * hash(i * 53 + rr, c));
      const b = g.count; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; g.v(cx + x + Math.cos(a) * hr, y + Math.sin(a) * hr, z + 0.14, 0, 0, 1); }
      g.tri(b, b + 1, b + 2); g.tri(b, b + 2, b + 3); g.tri(b, b + 3, b + 4); g.tri(b, b + 4, b + 5);
    }
  }
  // gờ xiên đầu hồi (trắng) và chỏm đỉnh
  g.mat(MAT.plaster).color(TRIM);
  const t = 0.55, zc = z + 0.3;
  g.quad([cx, ya - t, zc], [x1, ye - t, zc], [x1, ye + 0.15, zc], [cx, ya + 0.15, zc]); g.quad([x0, ye - t, zc], [cx, ya - t, zc], [cx, ya + 0.15, zc], [x0, ye + 0.15, zc]);
  g.color(TRIM).shade(0.8); g.quad([x1, ye - t, zc], [cx, ya - t, zc], [cx, ya - t, z], [x1, ye - t, z]); g.quad([cx, ya - t, zc], [x0, ye - t, zc], [x0, ye - t, z], [cx, ya - t, z]);
  g.color(TRIM).shade(0.97); g.box(cx - 0.45, ya - 0.2, z - 0.2, cx + 0.45, ya + 0.9, zc + 0.1); g.box(cx - 0.25, ya + 0.9, z - 0.05, cx + 0.25, ya + 1.5, zc - 0.05);
  // mái tôn hai dốc chạy ra sau mỗi gian
  const s = 0.9 + 0.12 * hash(50, i);
  g.mat(MAT.rust);
  g.color(METAL).shade(s); g.quad([cx, ya + 0.15, z + 0.3], [x1, ye + 0.15, z + 0.3], [x1, ye + 0.15, Z_ROOF], [cx, ya + 0.15, Z_ROOF]);
  g.color(METAL).shade(s * 0.93); g.quad([x0, ye + 0.15, z + 0.3], [cx, ya + 0.15, z + 0.3], [cx, ya + 0.15, Z_ROOF], [x0, ye + 0.15, Z_ROOF]);
  g.mat(MAT.plaster).color(HALLC).shade(0.85); g.tri3([x1, ye, Z_ROOF], [x0, ye, Z_ROOF], [cx, ya, Z_ROOF]);
  g.mat();
}

// Cánh nhà mới ba tầng mái bằng ở hai bên dãy đầu hồi: sạp hàng tầng trệt, hai băng cửa chớp bê tông phía trên.
function wing(g, sx) {
  const xa = sx > 0 ? 20 : -XE, xb = sx > 0 ? XE : -20, z = ZF, n = 3, bw = (xb - xa) / n;
  g.mat(MAT.plaster); wall(g, xa, 0, xb, Y_WING, z, HALLC, 300 + sx, bw);
  g.color(TRIM).shade(0.96); g.box(xa, Y_WING - 0.45, z, xb, Y_WING + 0.35, z + 0.3, 'xXYZy');
  g.color(HALLC).shade(1.04); for (let i = 1; i < n; i++) g.box(xa + i * bw - 0.35, 0, z, xa + i * bw + 0.35, Y_WING - 0.45, z + 0.18, 'xXZ');
  g.mat();
  for (let i = 0; i < n; i++) {
    const c = xa + (i + 0.5) * bw;
    stall(g, c, z, 40 + i + sx * 5, bw / 2 - 0.75, 0.55);
    for (const y of [5.3, 9.1]) {
      g.color(0x39424a).gloss(0.35); rect(g, c - bw / 2 + 0.6, y, c + bw / 2 - 0.6, y + 2.3, z + 0.05); g.gloss(0);
      g.mat(MAT.concrete).color(HALLC).shade(0.92); for (let k = 0; k < 4; k++) g.box(c - bw / 2 + 0.6, y + 0.2 + k * 0.56, z, c + bw / 2 - 0.6, y + 0.4 + k * 0.56, z + 0.16, 'YZy'); g.mat();
    }
  }
  // mái bằng, má trong nhô trên mái gian bên
  g.mat(MAT.concrete).color(0x8f8c82); g.quad([xa, Y_WING + 0.05, z], [xb, Y_WING + 0.05, z], [xb, Y_WING + 0.05, ZH], [xa, Y_WING + 0.05, ZH]);
  g.mat(MAT.plaster).color(HALLC).shade(0.85); const xi = sx * 20;
  if (sx > 0) g.quad([xi, 10.2, ZH], [xi, 10.2, z], [xi, Y_WING + 0.05, z], [xi, Y_WING + 0.05, ZH]); else g.quad([xi, 10.2, z], [xi, 10.2, ZH], [xi, Y_WING + 0.05, ZH], [xi, Y_WING + 0.05, z]);
  g.mat();
}

export function build(g) {
  g.gloss(0).glow(0).sway(0).mat();
  BAYS.forEach((B, i) => bay(g, B, i));
  wing(g, -1); wing(g, 1);
  // trụ giữa các gian và hai trụ cũ ngoài cùng (trắng kem), chân đá, mũ trụ
  for (const [x, yt] of [[-XE + 0.55, 12.6], [-20, 10.2], [-7.5, 10.2], [7.5, 10.2], [20, 10.2], [XE - 0.55, 12.6]]) {
    g.mat(MAT.plaster).color(TRIM).shade(0.97); g.box(x - 0.55, 0.9, ZF, x + 0.55, yt - 0.4, ZF + 0.4, 'xXZ');
    g.color(TRIM); g.box(x - 0.75, yt - 0.4, ZF - 0.1, x + 0.75, yt + 0.5, ZF + 0.55); g.box(x - 0.45, yt + 0.5, ZF, x + 0.45, yt + 1.3, ZF + 0.45);
    g.mat(MAT.stone).color(BASE); g.box(x - 0.65, 0, ZF, x + 0.65, 0.9, ZF + 0.5, 'xXYZ');
  }
  // bậc mái giữa gian giữa (cao) và gian bên (thấp)
  g.mat(MAT.plaster).color(HALLC).shade(0.82);
  g.quad([7.5, 10.35, ZF + 0.3], [7.5, 10.35, ZH], [7.5, 11.35, ZH], [7.5, 11.35, ZF + 0.3]); g.quad([-7.5, 10.35, ZH], [-7.5, 10.35, ZF + 0.3], [-7.5, 11.35, ZF + 0.3], [-7.5, 11.35, ZH]);
  // hai tường hồi của dãy mặt tiền
  for (const sx of [-1, 1]) { g.push().rotY((sx * Math.PI) / 2); const a = sx > 0 ? -ZF : ZH - 1, b = sx > 0 ? -ZH + 1 : ZF; wall(g, a, 0, b, Y_WING + 0.05, XE, HALLC, 60 + sx, 3.5, 0.97); g.pop(); }

  // ----- khối nhà chợ phía sau -----
  const yR = 16.6, zR = (ZH + ZB) / 2;
  const pil = (a, b, n, bw, z) => { g.mat(MAT.plaster).color(HALLC).shade(1.04); for (let i = 0; i <= n; i++) { const x = Math.max(a + 0.4, Math.min(b - 0.4, a + i * bw)); g.box(x - 0.4, 0, z, x + 0.4, Y_HALL, z + 0.2, 'xXZ'); } g.mat(); };
  g.mat(MAT.plaster); wall(g, -HX, 0, HX, Y_HALL, ZH, HALLC, 70, 5);
  g.push().rotY(Math.PI); wall(g, -HX, 0, HX, Y_HALL, -ZB, HALLC, 71, 5); g.mat();
  for (let i = 0; i < 10; i++) stall(g, -HX + (i + 0.5) * 7, -ZB, 3 + i);
  g.color(0x4b5560).gloss(0.4); rect(g, -HX + 1.5, 9.2, HX - 1.5, 11.4, -ZB + 0.08); g.gloss(0);
  pil(-HX, HX, 10, 7, -ZB);
  g.pop();
  for (const sx of [-1, 1]) {
    g.push().rotY((sx * Math.PI) / 2);
    const a = sx > 0 ? -ZH : ZB, b = sx > 0 ? -ZB : ZH, n = 9, bw = (b - a) / n;
    g.mat(MAT.plaster); wall(g, a, 0, b, Y_HALL, HX, HALLC, 80 + sx, bw);
    g.color(HALLC).shade(0.93); g.tri3([a, Y_HALL, HX], [b, Y_HALL, HX], [(a + b) / 2, yR, HX]); g.mat();
    for (let i = 0; i < n; i++) stall(g, a + (i + 0.5) * bw, HX, 20 + i + sx * 7);
    g.color(0x4b5560).gloss(0.4); rect(g, a + 1.5, 9.2, b - 1.5, 11.4, HX + 0.08); g.gloss(0);
    pil(a, b, n, bw, HX);
    g.pop();
  }
  // mái tôn xám dốc thoải, nóc chạy theo chiều ngang
  g.mat(MAT.rust);
  for (let i = 0; i < 10; i++) {
    const xa = -HX - 0.6 + (i * (2 * HX + 1.2)) / 10, xb = xa + (2 * HX + 1.2) / 10, s = 0.9 + 0.12 * hash(90, i);
    g.color(METAL).shade(s); g.quad([xa, Y_HALL - 0.05, ZH + 0.6], [xb, Y_HALL - 0.05, ZH + 0.6], [xb, yR, zR], [xa, yR, zR]);
    g.color(METAL).shade(s * 0.95); g.quad([xb, Y_HALL - 0.05, ZB - 0.6], [xa, Y_HALL - 0.05, ZB - 0.6], [xa, yR, zR], [xb, yR, zR]);
  }
  g.color(METAL).shade(0.7); g.box(-HX - 0.6, yR - 0.05, zR - 0.4, HX + 0.6, yR + 0.25, zR + 0.4, 'xXYzZ');
  g.mat().color(0xffffff).gloss(0).glow(0).sway(0);
}

// Một ô cửa hàng dưới chân tường nhà chợ: cửa tối + mái bạt màu.
function stall(g, cx, z, seed, hw = 2.2, d = 1.8) {
  g.color(0x2a2622); rect(g, cx - hw, 0, cx + hw, 3.4, z + 0.06);
  const cols = [0x2f6ea5, 0xb8432f, 0x3f8a5a, 0xd0a23a, 0x7d8a94];
  g.color(cols[Math.floor(hash(seed, 1) * cols.length)]).shade(0.85);
  g.quad([cx - hw - 0.3, 3.0, z + d], [cx + hw + 0.3, 3.0, z + d], [cx + hw + 0.3, 3.9, z + 0.05], [cx - hw - 0.3, 3.9, z + 0.05]);
  g.shade(0.6); g.quad([cx + hw + 0.3, 3.0, z + d], [cx - hw - 0.3, 3.0, z + d], [cx - hw - 0.3, 3.9, z + 0.05], [cx + hw + 0.3, 3.9, z + 0.05]);
}
