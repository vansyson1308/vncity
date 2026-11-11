// Nhà hát Lớn Hà Nội (1911), phỏng theo Opéra Garnier: dài 87 m, rộng 30 m, đỉnh mái cao 34 m.
// Gốc toạ độ ở tâm mặt bằng, mặt tiền quay về +z. Tường vàng kem, phào trắng, mái đá phiến xám xanh.
import { hash } from '../../core/util.js';

const lin = (h) => { const f = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)); return [f(((h >> 16) & 255) / 255), f(((h >> 8) & 255) / 255), f((h & 255) / 255)]; };
const WALL = 0xe8d9a8, TRIM = 0xf3eee0, SLATE = 0x5a6068, SLATE_D = 0x454b53, GLASS = 0x2a323b, WARM = 0x8a7450, DOOR = 0x3d2b1e, STONE = 0xb9b19c, ZINC = 0x7d8a88;
const ZF = 40, ZFOY = 28, ZAUD = -8, ZFLY = -30, ZR = -43.5, HW = 15, AW = 10.5, FW = 11.5;
const Y_PLINTH = 1.6, Y_BALC = 8.1, Y_ENT = 15.5, Y_COR = 17.6, Y_WING = 13.5, Y_AUD = 21, Y_FLY = 25.5, Y_TOP = 34;

function fanZ(g, pts, z) { const b = g.count; for (const p of pts) g.v(p[0], p[1], z, 0, 0, 1); for (let i = 1; i < pts.length - 1; i++) g.tri(b, b + i, b + i + 1); }
function archPts(cx, y0, w, hs, n = 4) { // vòm bán nguyệt trên thân chữ nhật cao hs
  const hw = w / 2, pts = [[cx - hw, y0], [cx + hw, y0]];
  for (let i = 0; i <= 2 * n; i++) { const t = (Math.PI * i) / (2 * n); pts.push([cx + hw * Math.cos(t), y0 + hs + hw * Math.sin(t)]); }
  return pts;
}
function discZ(g, cx, cy, r, z, n = 12) { const p = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } fanZ(g, p, z); }
const rect = (g, x0, y0, x1, y1, z) => g.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]);
// Mảng tường phẳng nhìn từ +z, chia cột đổi sắc nhẹ, chân tường sẫm hơn.
function wall(g, x0, y0, x1, y1, z, hexc = WALL, seed = 0, cw = 4.5, k0 = 1) {
  const c = lin(hexc), n = Math.max(1, Math.round((x1 - x0) / cw)), kb = y0 < 0.5 ? 0.8 : 0.95;
  for (let i = 0; i < n; i++) {
    const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n, k = k0 * (0.95 + 0.09 * hash(seed, i)), b = g.count;
    g.rgb(c[0] * k * kb, c[1] * k * kb, c[2] * k * kb * 0.97); g.v(xa, y0, z, 0, 0, 1); g.v(xb, y0, z, 0, 0, 1);
    g.rgb(c[0] * k, c[1] * k, c[2] * k); g.v(xb, y1, z, 0, 0, 1); g.v(xa, y1, z, 0, 0, 1);
    g.tri(b, b + 1, b + 2); g.tri(b, b + 2, b + 3);
  }
}
function rectWin(g, cx, y0, w, h, z, lit = 0) {
  g.color(TRIM); rect(g, cx - w / 2 - 0.18, y0 - 0.15, cx + w / 2 + 0.18, y0 + h + 0.25, z + 0.08);
  if (lit) g.color(WARM).glow(lit).gloss(0.3); else g.color(GLASS).gloss(0.5);
  rect(g, cx - w / 2, y0, cx + w / 2, y0 + h, z + 0.16); g.glow(0).gloss(0);
  g.color(TRIM).shade(0.92); rect(g, cx - 0.05, y0, cx + 0.05, y0 + h, z + 0.22); rect(g, cx - w / 2, y0 + h * 0.66, cx + w / 2, y0 + h * 0.66 + 0.09, z + 0.22);
}
function archWin(g, cx, y0, w, hs, z, kind = 'glass', lit = 0) {
  g.color(TRIM); fanZ(g, archPts(cx, y0 - 0.1, w + 0.44, hs + 0.1), z + 0.08);
  if (kind === 'door') g.color(DOOR); else if (lit) g.color(WARM).glow(lit).gloss(0.3); else g.color(GLASS).gloss(0.5);
  fanZ(g, archPts(cx, y0, w, hs), z + 0.16); g.glow(0).gloss(0);
  if (kind === 'door') { g.color(GLASS).gloss(0.5); fanZ(g, archPts(cx, y0 + hs, w - 0.3, 0, 3), z + 0.2); g.gloss(0); g.color(0x241910); rect(g, cx - 0.04, y0, cx + 0.04, y0 + hs, z + 0.22); }
  else { g.color(TRIM).shade(0.92); rect(g, cx - 0.05, y0, cx + 0.05, y0 + hs + w / 2, z + 0.22); rect(g, cx - w / 2, y0 + hs - 0.05, cx + w / 2, y0 + hs + 0.05, z + 0.22); }
  g.color(TRIM); g.box(cx - 0.16, y0 + hs + w / 2 + 0.05, z + 0.08, cx + 0.16, y0 + hs + w / 2 + 0.5, z + 0.3, 'xXYZy'); // đá khoá vòm
}
// Lan can con tiện: thanh trên/dưới trắng, các con tiện là dải dọc trên nền tối.
function balustrade(g, x0, x1, y, z, h = 1.0) {
  g.color(0x7d7767); rect(g, x0, y + 0.12, x1, y + h - 0.14, z - 0.06);
  g.color(TRIM); g.box(x0, y, z - 0.14, x1, y + 0.14, z + 0.14, 'YZ'); g.box(x0, y + h - 0.16, z - 0.16, x1, y + h, z + 0.16, 'YZy');
  const n = Math.max(1, Math.round((x1 - x0) / 0.42));
  for (let i = 0; i < n; i++) { const x = x0 + ((i + 0.5) * (x1 - x0)) / n; rect(g, x - 0.09, y + 0.14, x + 0.09, y + h - 0.16, z + 0.05); }
}
// Mái nhiều tầng dốc trên mặt bằng chữ nhật: profile = [[thu vào, cao], ...]; thu hết một chiều thì thành nóc.
function hipRoof(g, x0, z0, x1, z1, y, profile, hexc = SLATE, seed = 0) {
  const hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
  const ring = (p) => { const ix = Math.min(p[0], hx), iz = Math.min(p[0], hz); return [x0 + ix, x1 - ix, z0 + iz, z1 - iz, y + p[1]]; };
  for (let k = 0; k < profile.length - 1; k++) {
    const a = ring(profile[k]), b = ring(profile[k + 1]), s = 1 - 0.1 * k + 0.08 * hash(seed, k);
    g.color(hexc).shade(s); g.quad([a[0], a[4], a[3]], [a[1], a[4], a[3]], [b[1], b[4], b[3]], [b[0], b[4], b[3]]);
    g.color(hexc).shade(s * 0.96); g.quad([a[1], a[4], a[2]], [a[0], a[4], a[2]], [b[0], b[4], b[2]], [b[1], b[4], b[2]]);
    g.color(hexc).shade(s * 1.03); g.quad([a[1], a[4], a[3]], [a[1], a[4], a[2]], [b[1], b[4], b[2]], [b[1], b[4], b[3]]);
    g.color(hexc).shade(s * 0.99); g.quad([a[0], a[4], a[2]], [a[0], a[4], a[3]], [b[0], b[4], b[3]], [b[0], b[4], b[2]]);
  }
  const t = ring(profile[profile.length - 1]);
  if (t[1] - t[0] > 0.01 && t[3] - t[2] > 0.01) { g.color(hexc).shade(0.8); g.quad([t[0], t[4], t[3]], [t[1], t[4], t[3]], [t[1], t[4], t[2]], [t[0], t[4], t[2]]); }
  return t;
}
function finial(g, x, y, z, h = 2.2) {
  g.color(ZINC); g.cyl(x, y, z, 0.32, 0.2, h * 0.18, 6, false); g.color(ZINC).shade(1.15); g.ball(x, y + h * 0.3, z, h * 0.13, 6, 4);
  g.color(ZINC).shade(0.9); g.cyl(x, y + h * 0.36, z, 0.09, 0.0, h * 0.64, 5, false);
}
// Một dãy gian tường bên: trụ giả trắng giữa các gian, cửa chữ nhật tầng trệt, cửa vòm tầng trên.
function bays(g, x0, x1, z, n, yTop, seed, floors = 2) {
  const bw = (x1 - x0) / n;
  wall(g, x0, 0, x1, 1.2, z, STONE, seed + 1, bw); wall(g, x0, 1.2, x1, yTop, z, WALL, seed, bw);
  g.color(TRIM); g.box(x0, 7.0, z, x1, 7.35, z + 0.22, 'YZy'); g.box(x0, yTop - 0.55, z, x1, yTop, z + 0.4, 'YZy');
  g.color(TRIM).shade(0.97); g.box(x0, yTop - 1.0, z, x1, yTop - 0.55, z + 0.15, 'Zy');
  for (let i = 0; i <= n; i++) { const x = Math.min(x1 - 0.3, Math.max(x0 + 0.3, x0 + i * bw)); g.color(TRIM).shade(0.98); g.box(x - 0.3, 1.2, z, x + 0.3, yTop - 1.0, z + 0.14, 'xXZ'); }
  for (let i = 0; i < n; i++) {
    const c = x0 + (i + 0.5) * bw, lit = hash(seed + 7, i) < 0.3 ? 0.7 : 0;
    rectWin(g, c, 2.3, 1.5, 3.0, z, hash(seed + 9, i) < 0.2 ? 0.6 : 0);
    if (floors > 1) archWin(g, c, 8.3, 1.6, 2.6, z, 'glass', lit);
    if (floors > 2) rectWin(g, c, 8.6 + 4.6, 1.4, 1.6, z, 0);
  }
}

function pavilion(g, sx) {
  // khối đầu hồi mặt tiền: x 8.5..15, z 28..41; dựng cho bên +x rồi lật bằng sx
  const xa = sx > 0 ? 8.5 : -HW, xb = sx > 0 ? HW : -8.5, cx = (xa + xb) / 2, zf = ZF + 1;
  // mặt trước
  wall(g, xa, 0, xb, Y_PLINTH, zf, STONE, 31, 7); wall(g, xa, Y_PLINTH, xb, 7.7, zf, WALL, 32, 7, 0.97); wall(g, xa, 7.7, xb, Y_ENT, zf, WALL, 33, 7);
  g.color(0xc9bb8c); for (let i = 1; i < 7; i++) rect(g, xa, Y_PLINTH + i * 0.85, xb, Y_PLINTH + i * 0.85 + 0.07, zf + 0.04);
  archWin(g, cx, Y_PLINTH + 0.5, 1.9, 3.3, zf, 'glass', 0);
  g.color(TRIM); g.box(xa - 0.1, 7.7, zf, xb + 0.1, Y_BALC, zf + 0.45, 'xXYZy');
  for (const x of [xa + 0.45, xb - 0.45]) { g.color(TRIM); g.box(x - 0.45, Y_BALC, zf, x + 0.45, Y_ENT, zf + 0.22, 'xXZ'); g.box(x - 0.55, Y_ENT - 0.5, zf, x + 0.55, Y_ENT, zf + 0.32, 'xXZy'); }
  archWin(g, cx, Y_BALC + 0.9, 2.3, 3.4, zf, 'glass', 0.9);
  balustrade(g, cx - 1.7, cx + 1.7, Y_BALC, zf + 0.4, 0.95);
  // trán cong trên cửa
  g.color(TRIM); { const p = []; for (let i = 0; i <= 6; i++) { const t = (Math.PI * i) / 6; p.push([cx + 2.0 * Math.cos(t), 14.25 + 0.85 * Math.sin(t)]); } fanZ(g, p, zf + 0.3); g.box(cx - 2.0, 14.0, zf, cx + 2.0, 14.25, zf + 0.34, 'xXZy'); }
  g.color(WALL).shade(0.9); { const p = []; for (let i = 0; i <= 6; i++) { const t = (Math.PI * i) / 6; p.push([cx + 1.55 * Math.cos(t), 14.3 + 0.55 * Math.sin(t)]); } fanZ(g, p, zf + 0.36); }
  // mặt ngoài (bên hông), mặt trong (nhìn vào hiên cột) và mặt sau phía trên cánh bên
  g.push().rotY((sx * Math.PI) / 2);
  { const a = sx > 0 ? -zf : ZFOY, b = sx > 0 ? -ZFOY : zf; bays(g, a, b, HW, 3, Y_COR, 40 + sx); }
  g.pop();
  g.push().rotY((-sx * Math.PI) / 2);
  { const a = sx > 0 ? 37.6 : -zf, b = sx > 0 ? zf : -37.6; wall(g, a, Y_BALC, b, Y_ENT, -8.5, WALL, 45, 4, 0.9); wall(g, sx > 0 ? ZF : -zf, 0, sx > 0 ? zf : -ZF, Y_BALC, -8.5, WALL, 46, 4, 0.95); }
  g.pop();
  g.color(WALL).shade(0.85); g.quad([xb, Y_WING, ZFOY], [xa, Y_WING, ZFOY], [xa, Y_COR, ZFOY], [xb, Y_COR, ZFOY]);
  // diềm mái: dải trang trí + phào đua
  g.color(0xefe5c0); g.box(xa, Y_ENT, zf - 0.5, xb, 17.0, zf + 0.1, 'xXZ'); g.color(TRIM); g.box(xa - 0.1, 17.0, zf - 0.5, xb + 0.1, Y_COR, zf + 0.55, 'xXYZy');
  g.color(0xcdbf90); for (let i = 0; i < 4; i++) rect(g, xa + 1.0 + i * 1.3, Y_ENT + 0.35, xa + 1.6 + i * 1.3, 16.7, zf + 0.14);
  // bệ mái + vòm mái đá phiến (kiểu mansard cong) + chóp kẽm
  g.color(TRIM).shade(0.96); g.box(xa - 0.05, Y_COR, zf - 6.9, xb + 0.05, 18.5, zf + 0.15, 'xXzZ');
  const t = hipRoof(g, xa - 0.2, zf - 7.1, xb + 0.2, zf + 0.3, 18.5, [[0, 0], [0.22, 1.5], [0.7, 3.0], [1.45, 4.3], [2.5, 5.2]], SLATE, 50 + sx);
  g.color(ZINC); g.box(t[0] - 0.12, t[4], t[2] - 0.12, t[1] + 0.12, t[4] + 0.3, t[3] + 0.12);
  finial(g, cx, t[4] + 0.3, (t[2] + t[3]) / 2, 3.2);
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) { g.color(ZINC).shade(0.9); g.cyl(cx + dx * (t[1] - t[0]) / 2, t[4] + 0.3, (t[2] + t[3]) / 2 + dz * (t[3] - t[2]) / 2, 0.1, 0, 0.9, 4, false); }
  // cửa mắt bò trên mái vòm
  g.color(TRIM); discZ(g, cx, 20.2, 0.95, zf + 0.12); g.color(GLASS).gloss(0.5); discZ(g, cx, 20.2, 0.62, zf + 0.2); g.gloss(0);
}

export function build(g) {
  g.gloss(0).glow(0).sway(0);

  // ----- bậc thềm chính và bệ đèn hai bên -----
  for (let i = 0; i < 8; i++) { g.color(STONE).shade(1.02 - (i % 2) * 0.06 - i * 0.012); g.box(-8.3, 0, ZF, 8.3, Y_PLINTH - i * 0.2, ZF + 0.5 + (i + 1) * 0.375, 'xXYZ'); }
  for (const sx of [-1, 1]) {
    g.color(STONE).shade(0.92); g.box(sx * 8.9 - 0.6, 0, ZF + 1, sx * 8.9 + 0.6, 2.0, ZF + 3.5, 'xXYZ');
    g.color(0x2e3432); g.cyl(sx * 8.9, 2.0, ZF + 2.9, 0.09, 0.06, 2.3, 6, false); g.color(0xfff0c8).glow(1); g.ball(sx * 8.9, 4.5, ZF + 2.9, 0.3, 6, 4); g.glow(0);
  }

  // ----- sảnh trước: tầng trệt cửa vòm, hiên cột Ionic đôi tầng trên -----
  const CW = 8.5, zb = 37.6;
  wall(g, -CW, 0, CW, 7.7, ZF, WALL, 11, 3.4, 0.97);
  g.color(0xc9bb8c); for (let i = 1; i < 7; i++) rect(g, -CW, Y_PLINTH + i * 0.85, CW, Y_PLINTH + i * 0.85 + 0.07, ZF + 0.04);
  for (let i = -2; i <= 2; i++) archWin(g, i * 3.4, Y_PLINTH, 2.1, 3.5, ZF, 'door');
  g.color(TRIM); g.box(-CW, 7.7, zb, CW, Y_BALC, ZF + 0.5, 'YZy');
  // tường trong hiên + cửa vòm cao sáng đèn
  wall(g, -CW, Y_BALC, CW, Y_ENT, zb, WALL, 12, 3.4, 0.86);
  for (let i = -2; i <= 2; i++) archWin(g, i * 3.4, Y_BALC + 0.3, 2.0, 4.6, zb, 'glass', 1);
  // lan can và cột đôi
  const pairs = [-5.1, -1.7, 1.7, 5.1], zc = ZF - 0.15;
  { let x = -CW; for (const p of pairs) { balustrade(g, x, p - 1.0, Y_BALC, ZF + 0.25); x = p + 1.0; } balustrade(g, x, CW, Y_BALC, ZF + 0.25); }
  for (const p of pairs) {
    g.color(TRIM).shade(0.97); g.box(p - 1.0, Y_BALC, zc - 0.5, p + 1.0, Y_BALC + 1.05, zc + 0.5, 'xXYZ');
    for (const dx of [-0.5, 0.5]) {
      const x = p + dx;
      g.color(TRIM); g.cyl(x, Y_BALC + 1.05, zc, 0.42, 0.38, 0.22, 8, false); g.cyl(x, Y_BALC + 1.27, zc, 0.33, 0.28, Y_ENT - 0.55 - (Y_BALC + 1.27), 8, false);
      g.color(TRIM).shade(0.95); g.box(x - 0.47, Y_ENT - 0.55, zc - 0.3, x + 0.47, Y_ENT - 0.22, zc + 0.3, 'xXZy'); g.color(TRIM); g.box(x - 0.42, Y_ENT - 0.22, zc - 0.42, x + 0.42, Y_ENT, zc + 0.42, 'xXZy');
    }
  }
  for (const sx of [-1, 1]) { g.color(TRIM); g.box(sx * CW - 0.3, Y_BALC, zc - 0.4, sx * CW + 0.3, Y_ENT, zc + 0.4, sx > 0 ? 'xZ' : 'XZ'); }
  // diềm mái trên hàng cột: dải trang trí, phào đua, lan can mái
  g.color(0xefe5c0); g.box(-CW, Y_ENT, zb, CW, 17.0, ZF + 0.35, 'Zy'); g.color(TRIM); g.box(-CW, 17.0, zb, CW, Y_COR, ZF + 0.8, 'YZy');
  g.color(0xcdbf90); for (let i = -2; i <= 2; i++) rect(g, i * 3.4 - 1.0, Y_ENT + 0.35, i * 3.4 + 1.0, 16.7, ZF + 0.39);
  { let x = -CW; for (const p of pairs) { balustrade(g, x, p - 0.8, Y_COR, ZF + 0.3, 1.1); g.color(TRIM); g.box(p - 0.8, Y_COR, ZF - 0.1, p + 0.8, Y_COR + 1.25, ZF + 0.5, 'xXYZ'); x = p + 0.8; } balustrade(g, x, CW, Y_COR, ZF + 0.3, 1.1); }
  // mái sảnh (mansard) và hai khối đầu hồi có vòm mái
  hipRoof(g, -HW + 0.2, ZFOY, HW - 0.2, ZF - 0.2, Y_COR, [[0, 0], [1.5, 4.2], [5.9, 6.0]], SLATE, 3);
  g.color(ZINC); g.box(-HW + 6.1, Y_COR + 6.0, ZFOY + 5.8, HW - 6.1, Y_COR + 6.3, ZFOY + 6.0, 'xXYzZ');
  pavilion(g, 1); pavilion(g, -1);

  // ----- khán phòng: thân cao hơn, mái lớn; hai cánh bên thấp -----
  for (const sx of [-1, 1]) {
    g.push().rotY((sx * Math.PI) / 2);
    const lx = (wz) => -sx * wz, a = Math.min(lx(ZFOY), lx(ZFLY)), b = Math.max(lx(ZFOY), lx(ZFLY));
    bays(g, a, b, HW, 13, Y_WING, 100 + sx);
    // mái cánh bên dốc vào thân chính
    for (let i = 0; i < 13; i++) { const u = a + (i * (b - a)) / 13, v = u + (b - a) / 13; g.color(SLATE).shade(0.95 + 0.1 * hash(120 + sx, i)); g.quad([u, Y_WING, HW + 0.3], [v, Y_WING, HW + 0.3], [v, 15.6, AW], [u, 15.6, AW]); }
    // tường thân khán phòng nhô trên cánh bên, hàng cửa tròn
    const a2 = Math.min(lx(ZFOY), lx(ZAUD)), b2 = Math.max(lx(ZFOY), lx(ZAUD));
    wall(g, a2, 15.4, b2, Y_AUD, AW, WALL, 130 + sx, 4.5);
    g.color(TRIM); g.box(a2, Y_AUD - 0.5, AW, b2, Y_AUD, AW + 0.4, 'YZy');
    for (let i = 0; i < 8; i++) { const c = a2 + ((i + 0.5) * (b2 - a2)) / 8; g.color(TRIM); discZ(g, c, 18.1, 0.95, AW + 0.08); g.color(GLASS).gloss(0.5); discZ(g, c, 18.1, 0.68, AW + 0.16); g.gloss(0); }
    // tường tháp sân khấu nhô trên cánh bên
    const a3 = Math.min(lx(ZAUD), lx(ZFLY)), b3 = Math.max(lx(ZAUD), lx(ZFLY));
    wall(g, a3, 15.4, b3, Y_FLY, FW, WALL, 140 + sx, 5.5);
    g.color(TRIM); g.box(a3, Y_FLY - 0.6, FW, b3, Y_FLY, FW + 0.5, 'YZy'); g.box(a3, 20.6, FW, b3, 20.9, FW + 0.2, 'YZy');
    for (let i = 0; i < 4; i++) { const c = a3 + ((i + 0.5) * (b3 - a3)) / 4; archWin(g, c, 21.5, 1.5, 1.9, FW, 'glass', 0); rectWin(g, c, 17.0, 1.5, 2.4, FW, 0); }
    for (let i = 0; i <= 4; i++) { const c = Math.min(b3 - 0.35, Math.max(a3 + 0.35, a3 + (i * (b3 - a3)) / 4)); g.color(TRIM).shade(0.98); g.box(c - 0.35, 15.4, FW, c + 0.35, Y_FLY - 0.6, FW + 0.15, 'xXZ'); }
    // mái tháp sân khấu: hai mái dốc, nóc chạy dọc nhà
    for (let i = 0; i < 4; i++) { const u = a3 - 0.5 + (i * (b3 - a3 + 1)) / 4, v = u + (b3 - a3 + 1) / 4; g.color(SLATE).shade(0.92 + 0.12 * hash(150 + sx, i)); g.quad([u, Y_FLY - 0.1, FW + 0.7], [v, Y_FLY - 0.1, FW + 0.7], [v, Y_TOP, 0], [u, Y_TOP, 0]); }
    // phần cánh bên của khối sau
    const a4 = Math.min(lx(ZFLY), lx(ZR)), b4 = Math.max(lx(ZFLY), lx(ZR));
    bays(g, a4, b4, HW, 3, 15, 160 + sx, 3);
    g.pop();
  }
  // mặt trước/sau của thân khán phòng nhô trên mái sảnh
  wall(g, -AW, Y_COR, AW, Y_AUD, ZFOY, WALL, 170, 5, 0.92);
  g.color(TRIM); g.box(-AW, Y_AUD - 0.5, ZFOY, AW, Y_AUD, ZFOY + 0.4, 'YZy');
  const at = hipRoof(g, -AW - 0.4, ZAUD, AW + 0.4, ZFOY + 0.4, Y_AUD, [[0, 0], [1.7, 4.6], [7.2, 7.5]], SLATE, 5);
  g.color(ZINC); g.box(-0.18, at[4], at[2], 0.18, at[4] + 0.3, at[3], 'xXYzZ'); finial(g, 0, at[4] + 0.3, at[3], 2.4); finial(g, 0, at[4] + 0.3, at[2] + 3, 2.0);
  // cửa mái trên mái khán phòng (mặt trước)
  for (const x of [-5, 0, 5]) { g.color(TRIM); g.box(x - 0.8, Y_AUD + 0.6, ZFOY - 1.2, x + 0.8, Y_AUD + 2.6, ZFOY - 0.3, 'xXYZ'); g.color(GLASS).gloss(0.5); rect(g, x - 0.5, Y_AUD + 0.9, x + 0.5, Y_AUD + 2.3, ZFOY - 0.22); g.gloss(0); }

  // ----- tháp sân khấu: khối cao nhất, đầu hồi tam giác trước và sau -----
  for (const dir of [1, -1]) {
    g.push().move(0, 0, dir > 0 ? ZAUD : ZFLY).rotY(dir > 0 ? 0 : Math.PI);
    wall(g, -FW, dir > 0 ? Y_AUD - 1 : 14.5, FW, Y_FLY, 0, WALL, 180 + dir, 5.75, 0.95);
    g.color(TRIM); g.box(-FW - 0.5, Y_FLY - 0.6, 0, FW + 0.5, Y_FLY, 0.5, 'xXYZy');
    g.color(WALL).shade(0.97); g.tri3([-FW, Y_FLY, 0], [FW, Y_FLY, 0], [0, Y_TOP - 0.25, 0]);
    // phào xiên của trán tường
    const ex = FW + 0.7, ey = Y_FLY - 0.1;
    g.color(TRIM);
    g.quad([0, Y_TOP - 0.75, 0.3], [ex, ey, 0.3], [ex, ey + 0.6, 0.3], [0, Y_TOP + 0.05, 0.3]);
    g.quad([-ex, ey, 0.3], [0, Y_TOP - 0.75, 0.3], [0, Y_TOP + 0.05, 0.3], [-ex, ey + 0.6, 0.3]);
    g.color(TRIM).shade(0.85); g.quad([ex, ey, 0.3], [0, Y_TOP - 0.75, 0.3], [0, Y_TOP - 0.75, -0.3], [ex, ey, -0.3]); g.quad([0, Y_TOP - 0.75, 0.3], [-ex, ey, 0.3], [-ex, ey, -0.3], [0, Y_TOP - 0.75, -0.3]);
    g.color(TRIM); discZ(g, 0, Y_FLY + 2.9, 1.5, 0.08, 14); g.color(GLASS).gloss(0.5); discZ(g, 0, Y_FLY + 2.9, 1.1, 0.16, 14); g.gloss(0);
    if (dir < 0) for (const x of [-7, -3.5, 0, 3.5, 7]) rectWin(g, x, 20.5, 1.4, 3.2, 0, 0);
    else for (const x of [-7.5, 7.5]) rectWin(g, x, 21.6, 1.3, 2.4, 0, 0);
    g.pop();
  }
  g.color(ZINC); g.box(-0.2, Y_TOP - 0.05, ZFLY - 0.5, 0.2, Y_TOP + 0.3, ZAUD + 0.5, 'xXYzZ');
  finial(g, 0, Y_TOP + 0.3, ZAUD + 0.3, 1.8); finial(g, 0, Y_TOP + 0.3, ZFLY - 0.3, 1.8);

  // ----- khối sau (hậu trường) -----
  g.push().move(0, 0, ZR).rotY(Math.PI); bays(g, -HW, HW, 0, 7, 15, 200, 3);
  g.color(DOOR); rect(g, -1.1, 0, 1.1, 3.4, 0.24);
  g.pop();
  hipRoof(g, -HW - 0.3, ZR - 0.3, HW + 0.3, ZFLY, 15, [[0, 0], [1.4, 3.2], [6.9, 4.6]], SLATE, 7);

  g.color(0xffffff).gloss(0).glow(0).sway(0);
}
