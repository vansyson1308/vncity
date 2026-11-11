// Ga Hà Nội (ga Hàng Cỏ): mặt tiền dài 100 m đối xứng. Hai cánh kiểu Pháp thuộc địa (2 tầng, tường vàng,
// cửa chớp xanh, mái xám) và khối giữa xây lại năm 1976 kiểu hiện đại: khung bê tông trơn, sảnh kính lùi sâu,
// đồng hồ ở giữa và hàng chữ đỏ GA HÀ NỘI trên mái. Giữa cao khoảng 18 m, cánh 12 m, sâu 22 m. Mặt tiền quay về +z.
import { hash } from '../../core/util.js';

const lin = (h) => { const f = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)); return [f(((h >> 16) & 255) / 255), f(((h >> 8) & 255) / 255), f((h & 255) / 255)]; };
const YEL = 0xe6c467, TRIM = 0xf3ecd8, ROOF = 0x6c7074, GLASS = 0x2c3a44, SHUT = 0x47684f, CONC = 0xdcd6c6, HALL = 0x3d5a66, RED = 0xc8201c, STONE = 0x9c9788;
const CX = 18, WX = 50, ZW = 10, ZC = 11, ZBK = -11, Y_WALL = 9, Y_C = 16;

const rect = (g, x0, y0, x1, y1, z) => g.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]);
function fanZ(g, pts, z) { const b = g.count; for (const p of pts) g.v(p[0], p[1], z, 0, 0, 1); for (let i = 1; i < pts.length - 1; i++) g.tri(b, b + i, b + i + 1); }
function archPts(cx, y0, w, hs, n = 3) { const hw = w / 2, pts = [[cx - hw, y0], [cx + hw, y0]]; for (let i = 0; i <= 2 * n; i++) { const t = (Math.PI * i) / (2 * n); pts.push([cx + hw * Math.cos(t), y0 + hs + hw * Math.sin(t)]); } return pts; }
function discZ(g, cx, cy, r, z, n = 16) { const p = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } fanZ(g, p, z); }
function wall(g, x0, y0, x1, y1, z, hexc, seed = 0, cw = 4, k0 = 1) {
  const c = lin(hexc), n = Math.max(1, Math.round((x1 - x0) / cw)), kb = y0 < 0.7 ? 0.8 : 0.96;
  for (let i = 0; i < n; i++) {
    const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n, k = k0 * (0.94 + 0.1 * hash(seed, i)), b = g.count;
    g.rgb(c[0] * k * kb, c[1] * k * kb, c[2] * k * kb * 0.95); g.v(xa, y0, z, 0, 0, 1); g.v(xb, y0, z, 0, 0, 1);
    g.rgb(c[0] * k, c[1] * k, c[2] * k); g.v(xb, y1, z, 0, 0, 1); g.v(xa, y1, z, 0, 0, 1);
    g.tri(b, b + 1, b + 2); g.tri(b, b + 2, b + 3);
  }
}
function hipRoof(g, x0, z0, x1, z1, y, profile, hexc, seed = 0) {
  const hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
  const ring = (p) => { const ix = Math.min(p[0], hx), iz = Math.min(p[0], hz); return [x0 + ix, x1 - ix, z0 + iz, z1 - iz, y + p[1]]; };
  for (let k = 0; k < profile.length - 1; k++) {
    const a = ring(profile[k]), b = ring(profile[k + 1]), s = 1 - 0.08 * k + 0.08 * hash(seed, k);
    g.color(hexc).shade(s); g.quad([a[0], a[4], a[3]], [a[1], a[4], a[3]], [b[1], b[4], b[3]], [b[0], b[4], b[3]]);
    g.color(hexc).shade(s * 0.96); g.quad([a[1], a[4], a[2]], [a[0], a[4], a[2]], [b[0], b[4], b[2]], [b[1], b[4], b[2]]);
    g.color(hexc).shade(s * 1.03); g.quad([a[1], a[4], a[3]], [a[1], a[4], a[2]], [b[1], b[4], b[2]], [b[1], b[4], b[3]]);
    g.color(hexc).shade(s * 0.99); g.quad([a[0], a[4], a[2]], [a[0], a[4], a[3]], [b[0], b[4], b[3]], [b[0], b[4], b[2]]);
  }
  const t = ring(profile[profile.length - 1]);
  if (t[1] - t[0] > 0.01 && t[3] - t[2] > 0.01) { g.color(hexc).shade(0.82); g.quad([t[0], t[4], t[3]], [t[1], t[4], t[3]], [t[1], t[4], t[2]], [t[0], t[4], t[2]]); }
}
// Cửa sổ cao có cánh chớp xanh mở hai bên (tầng trên) hoặc cửa vòm (tầng trệt).
function shutterWin(g, cx, y0, w, h, z, lit = 0) {
  g.color(TRIM); rect(g, cx - w / 2 - 0.16, y0 - 0.16, cx + w / 2 + 0.16, y0 + h + 0.3, z + 0.08);
  if (lit) g.color(0x8a7450).glow(lit); else g.color(GLASS).gloss(0.45);
  rect(g, cx - w / 2, y0, cx + w / 2, y0 + h, z + 0.16); g.glow(0).gloss(0);
  g.color(TRIM).shade(0.94); rect(g, cx - 0.045, y0, cx + 0.045, y0 + h, z + 0.2);
  for (const s of [-1, 1]) { const xa = cx + s * (w / 2 + 0.05), xb = cx + s * (w / 2 + 0.6); g.color(SHUT).shade(0.9 + 0.2 * hash(Math.round(cx * 3), s + 2)); rect(g, Math.min(xa, xb), y0, Math.max(xa, xb), y0 + h, z + 0.22); }
}
function archDoor(g, cx, y0, w, hs, z, kind = 0) {
  g.color(TRIM); fanZ(g, archPts(cx, y0 - 0.05, w + 0.4, hs + 0.05), z + 0.08);
  if (kind === 1) g.color(SHUT).shade(0.85); else g.color(GLASS).gloss(0.45);
  fanZ(g, archPts(cx, y0, w, hs), z + 0.16); g.gloss(0);
  g.color(TRIM).shade(0.94); rect(g, cx - 0.045, y0, cx + 0.045, y0 + hs, z + 0.2); rect(g, cx - w / 2, y0 + hs - 0.05, cx + w / 2, y0 + hs + 0.05, z + 0.2);
}
// Một mặt tường cánh kiểu Pháp nhìn từ +z: chân đá, gờ tầng, phào mái, mỗi gian một cửa vòm dưới và cửa chớp trên.
function wingFace(g, x0, x1, z, n, yTop, seed) {
  const bw = (x1 - x0) / n;
  wall(g, x0, 0, x1, 0.7, z, STONE, seed + 1, bw); wall(g, x0, 0.7, x1, yTop, z, YEL, seed, bw);
  g.color(TRIM); g.box(x0, 4.55, z, x1, 4.85, z + 0.2, 'YZy'); g.box(x0 - 0.1, yTop - 0.5, z, x1 + 0.1, yTop, z + 0.45, 'xXYZy');
  g.color(TRIM).shade(0.97); g.box(x0, yTop - 0.85, z, x1, yTop - 0.5, z + 0.15, 'Zy');
  for (let i = 0; i < n; i++) {
    const c = x0 + (i + 0.5) * bw;
    archDoor(g, c, 0.7, 1.5, 2.5, z, hash(seed + 3, i) < 0.25 ? 1 : 0);
    shutterWin(g, c, 5.35, 1.15, 2.45, z, hash(seed + 5, i) < 0.25 ? 0.7 : 0);
  }
}

// Chữ điểm ảnh 5×7 cho bảng GA HÀ NỘI (không có phông chữ thật).
const FONT = {
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'], A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
};
const TEXT = [['G'], ['A'], null, ['H'], ['A', [[1, -3], [2, -2]]], null, ['N'], ['O', [[2, -3], [1, -2], [3, -2], [2, 8]]], ['I']];
function pixText(g, text, cx, yTop, z, px, dir = 1) {
  let x = -(text.length * 6 - 1) * px * 0.5;
  const q = (xa, ya, xb, yb) => { if (dir > 0) rect(g, cx + xa, ya, cx + xb, yb, z); else g.quad([cx + xb, ya, z], [cx + xa, ya, z], [cx + xa, yb, z], [cx + xb, yb, z]); };
  for (const t of text) {
    if (t) {
      const rows = FONT[t[0]];
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
        if (rows[r][c] !== '#') continue; let e = c; while (e < 4 && rows[r][e + 1] === '#') e++;
        q(x + c * px, yTop - (r + 1) * px, x + (e + 1) * px, yTop - r * px); c = e;
      }
      for (const d of t[1] || []) q(x + d[0] * px, yTop - (d[1] + 1) * px, x + (d[0] + 1) * px, yTop - d[1] * px);
    }
    x += 6 * px;
  }
}

export function build(g) {
  g.gloss(0).glow(0).sway(0);

  // ===== hai cánh kiểu Pháp =====
  for (const sx of [-1, 1]) {
    const xa = sx > 0 ? CX : -WX, xb = sx > 0 ? WX : -CX;      // toàn cánh
    const pa = sx > 0 ? WX - 9 : -WX, pb = sx > 0 ? WX : -WX + 9; // khối đầu hồi nhô ra
    const ma = sx > 0 ? CX : -WX + 9, mb = sx > 0 ? WX - 9 : -CX; // đoạn giữa
    // mặt trước
    wingFace(g, ma, mb, ZW, 7, Y_WALL, 100 + sx);
    wingFace(g, pa, pb, ZC, 3, Y_WALL + 0.6, 110 + sx);
    // mặt sau
    g.push().rotY(Math.PI); wingFace(g, -xb, -xa, -ZBK, 10, Y_WALL, 120 + sx); g.pop();
    // đầu hồi ngoài + má trong của khối nhô
    g.push().rotY((sx * Math.PI) / 2); wingFace(g, sx > 0 ? -ZC : ZBK, sx > 0 ? -ZBK : ZC, WX, 6, Y_WALL + 0.6, 130 + sx); g.pop();
    g.push().rotY((-sx * Math.PI) / 2); wall(g, sx > 0 ? ZW : -ZC, 0, sx > 0 ? ZC : -ZW, Y_WALL + 0.6, -(WX - 9), YEL, 140, 2, 0.93); wall(g, sx > 0 ? ZBK : -ZC, Y_WALL - 0.4, sx > 0 ? ZC : -ZBK, Y_WALL + 0.6, -(WX - 9), YEL, 141, 8, 0.93); g.pop();
    // mái: đoạn giữa (chui vào khối trung tâm) và mái khối đầu hồi cao hơn
    hipRoof(g, sx > 0 ? CX - 6 : ma - 3, ZBK - 0.5, sx > 0 ? mb + 3 : -CX + 6, ZW + 0.5, Y_WALL, [[0, 0], [3.6, 2.5], [10.5, 3.1]], ROOF, 150 + sx);
    hipRoof(g, pa - 0.5 * (sx < 0 ? 1 : 0), ZBK - 0.5, pb + 0.5 * (sx > 0 ? 1 : 0), ZC + 0.5, Y_WALL + 0.6, [[0, 0], [2.2, 3.0], [4.75, 3.9]], ROOF, 160 + sx);
    // ống khói nhỏ
    g.color(YEL).shade(0.85); g.cube((ma + mb) / 2, Y_WALL + 2.2, -3, 0.9, 1.7, 0.9); g.color(STONE); g.cube((ma + mb) / 2, Y_WALL + 3.9, -3, 1.1, 0.2, 1.1);
  }

  // ===== khối giữa hiện đại (1976) =====
  const RX = 14.2, ZG = 8.6, yB = 12.6, yCan = 4.4; // lòng sảnh lùi: |x|<RX, cao tới yB, kính ở z=ZG
  // khung bê tông mặt trước: hai trụ lớn + dầm trán
  for (const sx of [-1, 1]) { const a = sx > 0 ? RX : -CX, b = sx > 0 ? CX : -RX; wall(g, a, 0, b, yB, ZC, CONC, 200 + sx, 4, 0.98);
    g.color(CONC).shade(0.86); for (let j = 0; j < 4; j++) rect(g, (a + b) / 2 - 0.5, 2.2 + j * 2.6, (a + b) / 2 + 0.5, 3.6 + j * 2.6, ZC + 0.05);
    g.color(GLASS).gloss(0.45); for (let j = 0; j < 4; j++) rect(g, (a + b) / 2 - 0.36, 2.34 + j * 2.6, (a + b) / 2 + 0.36, 3.46 + j * 2.6, ZC + 0.1); g.gloss(0); }
  wall(g, -CX, yB, CX, Y_C, ZC, CONC, 210, 6, 1.02);
  g.color(CONC).shade(0.88); rect(g, -CX, Y_C - 0.35, CX, Y_C, ZC + 0.05);
  // má trong, trần và nền của sảnh lùi
  g.color(CONC).shade(0.78); g.quad([RX, 0, ZG], [RX, 0, ZC], [RX, yB, ZC], [RX, yB, ZG]); g.quad([-RX, 0, ZC], [-RX, 0, ZG], [-RX, yB, ZG], [-RX, yB, ZC]);
  g.color(CONC).shade(0.6); g.quad([-RX, yB, ZG], [-RX, yB, ZC], [RX, yB, ZC], [RX, yB, ZG]);
  // vách kính lớn (sáng đèn ban đêm) + đố ngang
  g.color(HALL).gloss(0.6).glow(0.45); rect(g, -RX, yCan, RX, yB, ZG); g.color(0x2a3338).glow(0.25); rect(g, -RX, 0, RX, yCan, ZG); g.gloss(0).glow(0);
  g.color(CONC).shade(0.9); for (const y of [7.1, 9.85]) g.box(-RX, y - 0.09, ZG, RX, y + 0.09, ZG + 0.12, 'YZy');
  // các lam bê tông đứng chia sảnh thành 9 gian
  const nf = 9, fw = (2 * RX) / nf;
  for (let i = 1; i < nf; i++) { const x = -RX + i * fw; g.color(CONC).shade(0.94 + 0.05 * (i % 2)); g.box(x - 0.2, 0, ZG, x + 0.2, yB, ZC - 0.25, 'xXZ'); }
  // cửa vào: khung cửa sáng giữa các lam
  for (let i = 0; i < nf; i++) { const x = -RX + (i + 0.5) * fw; g.color(0x8f8a7c); rect(g, x - 1.05, 0, x + 1.05, 2.9, ZG + 0.06); g.color(0x1f2a30).gloss(0.5); rect(g, x - 0.95, 0, x - 0.04, 2.8, ZG + 0.1); rect(g, x + 0.04, 0, x + 0.95, 2.8, ZG + 0.1); g.gloss(0); }
  // mái đón (ô văng) trên cửa
  g.color(CONC).shade(1.0); g.box(-RX - 0.4, yCan - 0.2, ZG, RX + 0.4, yCan + 0.25, ZC + 2.2);
  g.color(CONC).shade(0.8); for (const x of [-RX + fw, -RX + 3 * fw, 0 - fw * 1.5, fw * 1.5, RX - 3 * fw, RX - fw]) g.box(x - 0.18, 0, ZC + 1.6, x + 0.18, yCan - 0.2, ZC + 1.96, 'xXZz');
  // bậc thềm
  for (let i = 0; i < 3; i++) { g.color(STONE).shade(1.0 - i * 0.06); g.box(-CX - 0.5, 0, ZC, CX + 0.5, 0.45 - i * 0.15, ZC + 2.6 + i * 0.4, 'xXYZ'); }
  // đồng hồ giữa dầm trán
  g.color(0x30343a); discZ(g, 0, 14.3, 1.42, ZC + 0.08); g.color(0xf4f0e2).glow(0.8); discZ(g, 0, 14.3, 1.22, ZC + 0.14); g.glow(0);
  g.color(0x16181c);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.push().move(Math.sin(a) * 1.03, 14.3 + Math.cos(a) * 1.03, ZC + 0.2).rotZ(a); rect(g, -0.04, -0.12, 0.04, 0.12, 0); g.pop(); }
  g.push().move(0, 14.3, ZC + 0.22).rotZ(1.0); rect(g, -0.055, -0.1, 0.055, 0.66, 0); g.pop(); g.push().move(0, 14.3, ZC + 0.22).rotZ(-1.2); rect(g, -0.04, -0.1, 0.04, 0.96, 0); g.pop();
  // hai mặt hồi (nhô trên mái cánh) và mặt sau của khối giữa
  for (const sx of [-1, 1]) { g.push().rotY((sx * Math.PI) / 2); wall(g, -ZC, Y_WALL, ZC, Y_C, CX, CONC, 220 + sx, 5.5, 0.95);
    g.color(GLASS).gloss(0.45); for (let i = 0; i < 4; i++) rect(g, -8.2 + i * 5.0, 12.4, -6.8 + i * 5.0, 14.4, CX + 0.08); g.gloss(0); g.pop(); }
  g.push().rotY(Math.PI); wall(g, -CX, 0, CX, Y_C, -ZBK, CONC, 230, 4, 0.95);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 9; i++) { const x = -CX + (i + 0.5) * 4, y = 1.6 + j * 4.6; g.color(CONC).shade(0.86); rect(g, x - 1.25, y - 0.15, x + 1.25, y + 2.75, -ZBK + 0.06); g.color(GLASS).gloss(0.45); rect(g, x - 1.1, y, x + 1.1, y + 2.6, -ZBK + 0.12); g.gloss(0); }
  g.pop();
  // mái bằng + tường chắn mái
  g.color(0x8d8a80); g.quad([-CX, Y_C - 0.4, ZC], [CX, Y_C - 0.4, ZC], [CX, Y_C - 0.4, ZBK], [-CX, Y_C - 0.4, ZBK]);
  g.color(CONC).shade(0.72);
  g.quad([CX - 0.3, Y_C - 0.4, ZC - 0.3], [-CX + 0.3, Y_C - 0.4, ZC - 0.3], [-CX + 0.3, Y_C, ZC - 0.3], [CX - 0.3, Y_C, ZC - 0.3]); g.quad([-CX + 0.3, Y_C - 0.4, ZBK + 0.3], [CX - 0.3, Y_C - 0.4, ZBK + 0.3], [CX - 0.3, Y_C, ZBK + 0.3], [-CX + 0.3, Y_C, ZBK + 0.3]);
  g.quad([CX - 0.3, Y_C - 0.4, ZBK + 0.3], [CX - 0.3, Y_C - 0.4, ZC - 0.3], [CX - 0.3, Y_C, ZC - 0.3], [CX - 0.3, Y_C, ZBK + 0.3]); g.quad([-CX + 0.3, Y_C - 0.4, ZC - 0.3], [-CX + 0.3, Y_C - 0.4, ZBK + 0.3], [-CX + 0.3, Y_C, ZBK + 0.3], [-CX + 0.3, Y_C, ZC - 0.3]);
  g.color(CONC).shade(0.95);
  g.quad([-CX, Y_C, ZC], [CX, Y_C, ZC], [CX - 0.3, Y_C, ZC - 0.3], [-CX + 0.3, Y_C, ZC - 0.3]); g.quad([CX, Y_C, ZBK], [-CX, Y_C, ZBK], [-CX + 0.3, Y_C, ZBK + 0.3], [CX - 0.3, Y_C, ZBK + 0.3]);
  g.quad([CX, Y_C, ZC], [CX, Y_C, ZBK], [CX - 0.3, Y_C, ZBK + 0.3], [CX - 0.3, Y_C, ZC - 0.3]); g.quad([-CX, Y_C, ZBK], [-CX, Y_C, ZC], [-CX + 0.3, Y_C, ZC - 0.3], [-CX + 0.3, Y_C, ZBK + 0.3]);
  // hàng chữ đỏ GA HÀ NỘI đứng trên mái (có giá đỡ), sáng đèn ban đêm
  const px = 0.3, yT = Y_C + 0.75 + 7 * px, zs = ZC - 0.9;
  g.color(0x4a4f55); g.box(-9.2, Y_C + 0.38, zs - 0.12, 9.2, Y_C + 0.5, zs - 0.02, 'xXYZzy');
  for (let i = 0; i <= 8; i++) { const x = -9 + i * 2.25; g.box(x - 0.05, Y_C, zs - 0.12, x + 0.05, Y_C + 2.9, zs - 0.03, 'xXZz'); g.quad([x - 0.05, Y_C, zs - 1.5], [x + 0.05, Y_C, zs - 1.5], [x + 0.05, Y_C + 2.6, zs - 0.12], [x - 0.05, Y_C + 2.6, zs - 0.12]); }
  g.box(-9.2, Y_C + 2.78, zs - 0.12, 9.2, Y_C + 2.9, zs - 0.02, 'xXYZzy');
  g.color(RED).glow(0.9); pixText(g, TEXT, 0, yT, zs, px, 1); g.glow(0);
  g.color(RED).shade(0.45); pixText(g, TEXT, 0, yT, zs - 0.14, px, -1);
  g.color(0xffffff).gloss(0).glow(0).sway(0);
}
