// Cụm cổng đền Ngọc Sơn phía bờ hồ (đường Đinh Tiên Hoàng).
// Gốc toạ độ: tâm cổng ngoài; mặt cổng nhìn về +z (ra phố), lối đi chạy theo -z ra cầu Thê Húc.
// Theo thứ tự dọc -z: (a) nghi môn ngoài: hai trụ biểu đội lồng đèn, hai mảng tường chữ Phúc – Lộc;
// (b) Tháp Bút năm tầng trên núi Độc Tôn ở bên +x; (c) cổng Đài Nghiên: cổng vòm đội nghiên đá hình nửa quả đào
// do ba con thiềm thừ đỡ; (d) Đắc Nguyệt Lâu: lầu cổng hai tầng, cửa sổ tròn, mái cong đầu đao.
// Lối đi dọc x = 0 thông suốt, chỗ hẹp nhất 2,4 m (lòng cổng Đắc Nguyệt Lâu); không có khối nào chắn trong dải |x| < 1,2 m.
// Chữ: chỉ dựng những chữ có thật và đọc được (福, 祿, 寫青天, 硯臺, 得月樓). Câu đối dài trên trụ không thể dựng cho đọc được
// nên để thành ô đắp nổi trơn có viền son, tuyệt đối không vẽ nét giả chữ.
import { hash, lerp } from '../../core/util.js';
import { MAT } from '../../core/geo.js';
import { floodlit } from './lighting.js';

const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lin = (h) => [s2l(((h >> 16) & 255) / 255), s2l(((h >> 8) & 255) / 255), s2l((h & 255) / 255)];

// Tháp Bút nằm bên trái lối vào khi đi từ phố Đinh Tiên Hoàng ra cầu (phía nam, tức -x trong hệ toạ độ này).
// Đắc Nguyệt Lâu ngoài đời đứng ở đầu cầu Thê Húc phía đảo, nên không dựng ở đây: world/landmarks/index.js gắn nó vào cuối cầu.
export const PEN_TOWER = { x: -6, z: -8 }, INK_GATE_Z = -18, MOON_PAVILION_Z = -30;

const LIME = 0xe3dbc7;     // tường vôi trắng ngà
const LIME_D = 0xcdc4ae;   // vôi cũ
const STONE = 0x8c887e, STONE_D = 0x6e6b63, STONE_L = 0xa29d91;
const RED = 0xb3241b;      // son chữ đại tự và câu đối
const TILE = 0x5e3b2c;     // ngói mũi hài cũ
const UNDER = 0x33221a;    // dạ mái
const INK = 0x39423f;      // đá nghiên
const GOLD = 0xb89848;
const MOSS = lin(0x55602f), SOOT = lin(0x35322c);

// Chất liệu chi tiết (vữa, đá, ngói) đã tự vẽ loang màu, vệt nước và chân tường ẩm; lớp phong hoá nướng vào màu đỉnh chỉ còn
// giữ phần chuyển sắc theo từng khối (chân mỗi khối rêu hơn, dưới mỗi gờ có vệt đen), giảm cường độ bằng WK để không tối hai lần.
const WK = 0.5;
// Phong hoá theo chiều cao: chân tường rêu ẩm, dưới gờ mái có vệt nước đen, loang lổ theo băm vị trí.
function weather(g, from, y0, y1, seed = 0, moss = 0.5, soot = 0.5) {
  for (let i = from; i < g.count; i++) {
    const x = g.pos[i * 3], y = g.pos[i * 3 + 1], z = g.pos[i * 3 + 2];
    const t = Math.min(1, Math.max(0, (y - y0) / Math.max(0.01, y1 - y0)));
    const n = hash(Math.round(x * 3.1) * 131 + Math.round(z * 3.1) * 17 + Math.round(y * 2.3) * 7, seed);
    const n2 = hash(Math.round(x * 1.3) * 57 + Math.round(z * 1.3) * 29, seed + 5);
    const low = (1 - t) * (1 - t), high = t > 0.8 ? (t - 0.8) / 0.2 : 0;
    const km = Math.min(0.5, WK * moss * (low * 1.0 + n2 * 0.22) * (0.4 + n));
    const ks = Math.min(0.5, WK * soot * (high * 0.7 + low * 0.25 + (n > 0.7 ? 0.25 : 0) + n2 * 0.1));
    const k = 0.93 + n * 0.12;
    for (let c = 0; c < 3; c++) {
      let v = g.col[i * 4 + c] * k;
      v = v * (1 - km) + MOSS[c] * km;
      g.col[i * 4 + c] = v * (1 - ks) + SOOT[c] * ks;
    }
  }
}

// Điểm của vòm (tính từ tâm chân vòm): từ chân trái qua đỉnh sang chân phải.
function archPts(a, pointed = false, K = 6) {
  const c = pointed ? a * 0.5 : 0, R = a + c, th1 = Math.acos(c / R), L = [];
  for (let k = 0; k <= K; k++) { const th = (th1 * k) / K; L.push([c - R * Math.cos(th), R * Math.sin(th)]); }
  const pts = L.slice();
  for (let k = K - 1; k >= 0; k--) pts.push([-L[k][0], L[k][1]]);
  return pts;
}

// Hộp tường chia dải theo chiều cao để phong hoá có chuyển sắc.
function wallBox(g, x0, y0, z0, x1, y1, z1, faces = 'xXzZ', bands = [0, 0.16, 0.8, 1]) {
  for (let b = 0; b < bands.length - 1; b++) g.box(x0, lerp(y0, y1, bands[b]), z0, x1, lerp(y0, y1, bands[b + 1]), z1, faces);
  if (faces.includes('Y')) g.box(x0, y1 - 0.01, z0, x1, y1, z1, 'Y');
}

// Cổng vòm xây: khối W × D × H tâm ở gốc, cửa vòm rộng ow, chân vòm cao sh, thông suốt theo trục z.
function archGate(g, W, D, H, ow, sh) {
  const a = ow / 2, zf = D / 2, arch = archPts(a);
  wallBox(g, -W / 2, 0, -zf, -a, H, zf, 'xXzZ');
  wallBox(g, a, 0, -zf, W / 2, H, zf, 'xXzZ');
  for (let k = 0; k < arch.length - 1; k++) {
    const p = arch[k], q = arch[k + 1];
    g.quad([p[0], sh + p[1], zf], [q[0], sh + q[1], zf], [q[0], H, zf], [p[0], H, zf]);
    g.quad([q[0], sh + q[1], -zf], [p[0], sh + p[1], -zf], [p[0], H, -zf], [q[0], H, -zf]);
  }
  g.quad([-W / 2, H, zf], [W / 2, H, zf], [W / 2, H, -zf], [-W / 2, H, -zf]);
  const c0 = g.c.slice();
  g.shade(0.72);
  for (let k = 0; k < arch.length - 1; k++) {
    const p = arch[k], q = arch[k + 1];
    g.quad([p[0], sh + p[1], zf], [p[0], sh + p[1], -zf], [q[0], sh + q[1], -zf], [q[0], sh + q[1], zf]);
  }
  g.c = c0;
}

// Nét chữ: các đoạn [x0,y0,x1,y1] trong ô vuông [-1,1]², vẽ trên mặt phẳng z nhìn về +z, tâm (cx,cy), nửa cạnh hs.
function glyph(g, cx, cy, z, hs, strokes, w = 0.16) {
  for (const s of strokes) {
    const ax = cx + s[0] * hs, ay = cy + s[1] * hs, bx = cx + s[2] * hs, by = cy + s[3] * hs;
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, px = (-dy / l) * w * hs * 0.5, py = (dx / l) * w * hs * 0.5;
    const ex = (dx / l) * w * hs * 0.3, ey = (dy / l) * w * hs * 0.3;
    g.quad([ax - ex + px, ay - ey + py, z], [ax - ex - px, ay - ey - py, z], [bx + ex - px, by + ey - py, z], [bx + ex + px, by + ey + py, z]);
  }
}
const RAD = [[-0.68, 0.92, -0.5, 0.74], [-0.95, 0.55, -0.3, 0.55], [-0.32, 0.55, -0.9, -0.02], [-0.6, 0.28, -0.6, -0.95], [-0.5, 0.12, -0.26, -0.08]]; // bộ thị 礻
const PHUC = RAD.concat([[-0.05, 0.86, 0.92, 0.86], [0.08, 0.6, 0.8, 0.6], [0.08, 0.6, 0.08, 0.26], [0.8, 0.6, 0.8, 0.26], [0.08, 0.26, 0.8, 0.26],
  [-0.08, 0.02, 0.95, 0.02], [-0.08, 0.02, -0.08, -0.92], [0.95, 0.02, 0.95, -0.92], [-0.08, -0.92, 0.95, -0.92], [0.44, 0.02, 0.44, -0.92], [-0.08, -0.45, 0.95, -0.45]]);
const LOC = RAD.concat([[0.12, 0.88, 0.78, 0.88], [0.78, 0.88, 0.78, 0.62], [0.05, 0.62, 0.85, 0.62], [-0.1, 0.34, 0.98, 0.34], [0.44, 0.34, 0.44, -0.95], [0.44, -0.95, 0.24, -0.8],
  [0.26, 0.12, 0.02, -0.1], [0.3, -0.22, -0.1, -0.72], [0.62, 0.12, 0.84, -0.06], [0.56, -0.2, 0.98, -0.82]]);
// 寫青天 «Tả Thanh Thiên» (viết lên trời xanh): ba chữ son trên thân Tháp Bút.
const TA = [[0, 1.0, 0.06, 0.84], [-0.9, 0.76, 0.9, 0.76], [-0.9, 0.76, -0.9, 0.52], [0.9, 0.76, 0.78, 0.54],
  [-0.5, 0.5, 0.5, 0.5], [-0.5, 0.5, -0.5, -0.08], [0.5, 0.5, 0.5, -0.08], [-0.5, -0.08, 0.5, -0.08], [-0.5, 0.2, -0.14, 0.2], [0.14, 0.2, 0.5, 0.2],
  [-0.5, -0.08, -0.8, -0.36], [-0.72, -0.34, 0.82, -0.34], [0.82, -0.34, 0.74, -0.96], [0.74, -0.96, 0.52, -0.86],
  [-0.62, -0.56, -0.74, -0.84], [-0.28, -0.56, -0.22, -0.8], [0.06, -0.56, 0.12, -0.8], [0.38, -0.56, 0.46, -0.8]];
const THANH = [[-0.55, 0.84, 0.55, 0.84], [-0.42, 0.58, 0.42, 0.58], [-0.92, 0.3, 0.92, 0.3], [0, 1.0, 0, 0.3],
  [-0.48, 0.04, -0.48, -0.98], [-0.48, 0.04, 0.48, 0.04], [0.48, 0.04, 0.48, -0.98], [0.48, -0.98, 0.3, -0.88], [-0.48, -0.3, 0.48, -0.3], [-0.48, -0.62, 0.48, -0.62]];
const THIEN = [[-0.6, 0.68, 0.6, 0.68], [-0.9, 0.12, 0.9, 0.12], [0, 0.68, 0, 0.12], [0, 0.12, -0.82, -0.92], [0.03, 0.1, 0.88, -0.92]];
// 硯臺 «Nghiên Đài» trên cổng Đài Nghiên, 得月樓 «Đắc Nguyệt Lâu» trên lầu Đón Trăng.
const NGHIEN = [[-0.98, 0.62, -0.22, 0.62], [-0.6, 0.62, -0.96, -0.12], [-0.82, 0.14, -0.3, 0.14], [-0.82, 0.14, -0.82, -0.5], [-0.3, 0.14, -0.3, -0.5], [-0.82, -0.5, -0.3, -0.5],
  [0.05, 0.92, 0.85, 0.92], [0.05, 0.92, 0.05, 0.02], [0.85, 0.92, 0.85, 0.02], [0.05, 0.02, 0.85, 0.02], [0.05, 0.62, 0.85, 0.62], [0.05, 0.32, 0.85, 0.32],
  [0.32, 0.02, 0.0, -0.95], [0.6, 0.02, 0.6, -0.82], [0.6, -0.82, 0.98, -0.82], [0.98, -0.82, 0.98, -0.6]];
const DAI = [[-0.5, 0.86, 0.5, 0.86], [0, 1.0, 0, 0.7], [-0.32, 0.7, 0.32, 0.7], [-0.3, 0.56, 0.3, 0.56], [-0.3, 0.56, -0.3, 0.36], [0.3, 0.56, 0.3, 0.36], [-0.3, 0.36, 0.3, 0.36],
  [-0.92, 0.22, 0.92, 0.22], [-0.92, 0.22, -0.92, 0.05], [0.92, 0.22, 0.84, 0.05], [-0.5, -0.02, 0.5, -0.02], [0.05, -0.02, -0.36, -0.3], [-0.36, -0.3, 0.36, -0.3], [0.28, -0.16, 0.42, -0.34],
  [-0.45, -0.62, 0.45, -0.62], [0, -0.3, 0, -0.95], [-0.92, -0.95, 0.92, -0.95]];
const DAC = [[-0.55, 0.96, -0.95, 0.56], [-0.5, 0.5, -0.98, 0.0], [-0.72, 0.26, -0.72, -0.96],
  [-0.2, 0.92, 0.75, 0.92], [-0.2, 0.92, -0.2, 0.3], [0.75, 0.92, 0.75, 0.3], [-0.2, 0.3, 0.75, 0.3], [-0.2, 0.61, 0.75, 0.61], [-0.4, 0.08, 0.98, 0.08],
  [-0.36, -0.26, 0.98, -0.26], [0.55, 0.08, 0.55, -0.96], [0.55, -0.96, 0.34, -0.84], [0.0, -0.46, 0.16, -0.64]];
const NGUYET = [[-0.5, 0.9, -0.5, -0.5], [-0.5, -0.5, -0.76, -0.96], [-0.5, 0.9, 0.55, 0.9], [0.55, 0.9, 0.55, -0.96], [0.55, -0.96, 0.34, -0.86], [-0.5, 0.4, 0.55, 0.4], [-0.5, -0.1, 0.55, -0.1]];
const LAU = [[-0.98, 0.45, -0.36, 0.45], [-0.67, 0.96, -0.67, -0.96], [-0.67, 0.4, -0.98, -0.2], [-0.6, 0.3, -0.38, 0.0],
  [0.08, 0.96, 0.72, 0.96], [0.08, 0.96, 0.08, 0.76], [0.72, 0.96, 0.72, 0.76], [0.08, 0.76, 0.72, 0.76], [-0.14, 0.62, 0.96, 0.62],
  [-0.02, 0.5, 0.82, 0.5], [-0.02, 0.5, -0.02, 0.26], [0.82, 0.5, 0.82, 0.26], [-0.02, 0.26, 0.82, 0.26], [0.4, 1.0, 0.4, 0.14],
  [0.45, 0.1, 0.12, -0.55], [0.12, -0.55, 0.86, -0.96], [0.72, 0.1, 0.3, -0.62], [0.3, -0.62, -0.06, -0.96], [-0.2, -0.2, 0.98, -0.2]];

// Tấm đắp nổi trên mặt tường z (nhìn về +z): dày t, có đủ mặt bên nên không lơ lửng và không trùng mặt với tường.
function slab(g, x0, y0, x1, y1, z, t = 0.03) { g.box(x0, y0, z, x1, y1, z + t, 'xXyYZ'); }
// Hoành phi: biển sơn then đắp nổi, chữ thếp vàng nổi thêm 3 cm. chars: các chữ theo thứ tự nhìn từ trái sang phải
// (hoành phi đọc từ phải sang trái nên truyền vào đã đảo sẵn).
function board(g, cx, y0, y1, hw, z, chars, hs, t = 0.03) {
  g.mat(MAT.lacquer).gloss(0.2).color(0x3a2a22); slab(g, cx - hw, y0, cx + hw, y1, z, t);
  g.color(GOLD).gloss(0.35);
  chars.forEach((c, i) => glyph(g, cx + (i - (chars.length - 1) / 2) * hs * 2.55, (y0 + y1) / 2, z + t + 0.03, hs, c, 0.12));
  g.mat().gloss(0);
}
// Ô câu đối để trơn: tấm vôi sáng đắp nổi 3 cm, viền son nổi thêm 3 cm. Không có chữ.
function coupletPanel(g, cx, y0, y1, hw, z) {
  g.mat(MAT.plaster).color(0xefe9da); slab(g, cx - hw, y0, cx + hw, y1, z);
  g.mat(MAT.lacquer).color(RED).shade(0.9);
  const zf = z + 0.06, t = Math.min(0.035, hw * 0.16), m = t * 1.4;
  g.box(cx - hw + m, y0 + m, zf - 0.03, cx - hw + m + t, y1 - m, zf, 'xXZ'); g.box(cx + hw - m - t, y0 + m, zf - 0.03, cx + hw - m, y1 - m, zf, 'xXZ');
  g.box(cx - hw + m + t, y0 + m, zf - 0.03, cx + hw - m - t, y0 + m + t, zf, 'yYZ'); g.box(cx - hw + m + t, y1 - m - t, zf - 0.03, cx + hw - m - t, y1 - m, zf, 'yYZ');
  g.mat();
}
// Như G.ribbon nhưng khi hàng b chụm về một điểm (đỉnh mái chóp, mái hồi) thì dựng quạt tam giác, không sinh tam giác suy biến.
function ribbonTo(g, a, b, flip) {
  const n = a.length, apex = b[0];
  if (!b.every((q) => Math.hypot(q[0] - apex[0], q[1] - apex[1], q[2] - apex[2]) < 1e-6)) { g.ribbon(a, b, flip); return; }
  const N = [];
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1), tx = a[i1][0] - a[i0][0], ty = a[i1][1] - a[i0][1], tz = a[i1][2] - a[i0][2];
    const sx = apex[0] - a[i][0], sy = apex[1] - a[i][1], sz = apex[2] - a[i][2], k = flip ? -1 : 1;
    N.push([(sy * tz - sz * ty) * k, (sz * tx - sx * tz) * k, (sx * ty - sy * tx) * k]);
  }
  for (let i = 0; i < n - 1; i++) {
    const p = g.v(a[i][0], a[i][1], a[i][2], N[i][0], N[i][1], N[i][2]), q = g.v(a[i + 1][0], a[i + 1][1], a[i + 1][2], N[i + 1][0], N[i + 1][1], N[i + 1][2]);
    const t = g.v(apex[0], apex[1], apex[2], N[i][0] + N[i + 1][0], N[i][1] + N[i + 1][1], N[i][2] + N[i + 1][2]);
    if (flip) g.tri(p, q, t); else g.tri(p, t, q);
  }
}
// Như G.lathe nhưng điểm cuối của profile là chóp nhọn (bán kính 0): phần chóp dựng bằng quạt tam giác.
function spire(g, y, profile, seg) {
  const n = profile.length - 1, p = profile[n - 1], q = profile[n];
  g.lathe(0, y, 0, profile.slice(0, n), seg);
  let dr = q[0] - p[0], dy = q[1] - p[1]; const l = Math.hypot(dr, dy) || 1; dr /= l; dy /= l;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2, am = (a0 + a1) / 2;
    const v0 = g.v(Math.cos(a0) * p[0], y + p[1], Math.sin(a0) * p[0], Math.cos(a0) * dy, -dr, Math.sin(a0) * dy);
    const v1 = g.v(Math.cos(a1) * p[0], y + p[1], Math.sin(a1) * p[0], Math.cos(a1) * dy, -dr, Math.sin(a1) * dy);
    const vt = g.v(0, y + q[1], 0, Math.cos(am) * dy, -dr, Math.sin(am) * dy);
    g.tri(v0, vt, v1);
  }
}

// Mái ngói cong bốn mái: hiên là chữ nhật nửa cạnh (a,b) ở cao độ y0, đỉnh là chữ nhật (ta,tb) cao hơn `rise`
// (tb = 0: bờ nóc dài 2·ta; ta = tb = 0: mái chóp). lift: độ vểnh của góc đao.
function roof(g, a, b, ta, tb, y0, rise, lift, o = {}) {
  const N = o.n || 6, M = o.m || 3, UR = o.under || 1, p = o.p || 1.3, seed = o.seed || 0, tile = o.tile || TILE;
  for (let f = 0; f < 4; f++) {
    const eh = f % 2 ? b : a, ez = f % 2 ? a : b, th = f % 2 ? tb : ta, tz = f % 2 ? ta : tb;
    const row = (j, dy) => {
      const u = j / M, r = [];
      for (let i = 0; i <= N; i++) { const s = -1 + (2 * i) / N; r.push([lerp(s * eh, s * th, u), y0 + rise * Math.pow(u, p) + lift * Math.pow(Math.abs(s), 3) * (1 - u) * (1 - u) + dy, lerp(ez, tz, u)]); }
      return r;
    };
    g.push().rotY((f * Math.PI) / 2);
    for (let j = 0; j < M; j++) {
      const from = g.count;
      g.mat(MAT.tile).color(tile).shade(0.95 + hash(seed + f, j) * 0.12);
      ribbonTo(g, row(j, 0), row(j + 1, 0), true);
      // từng viên ngói, hàng ngói và rêu do chất liệu vẽ; ở đây chỉ còn loang sắc độ rất nhẹ theo mảng
      for (let i = from; i < g.count; i++) { const k = 0.92 + hash(i, seed + 3) * 0.16; for (let c = 0; c < 3; c++) g.col[i * 4 + c] *= k; }
    }
    g.mat(MAT.wood).color(UNDER);
    for (let j = 0; j < UR; j++) ribbonTo(g, row(j, -0.08), row(j + 1, -0.08), false);
    g.mat(MAT.tile).color(tile).shade(0.6);
    g.ribbon(row(0, 0), row(0, -0.08));
    g.mat().pop();
  }
  // bờ dải theo bốn góc và đầu đao vểnh
  const hr = o.hip === undefined ? 0.075 : o.hip;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const P = (u) => [sx * lerp(a, ta, u), y0 + rise * Math.pow(u, p) + lift * (1 - u) * (1 - u) + 0.03, sz * lerp(b, tb, u)];
    g.mat(MAT.plaster).color(STONE_D).shade(0.95);
    if (hr > 0) for (let j = 0; j < M; j++) g.tube(P(j / M), P((j + 1) / M), hr, 4);
    const c = P(0), k = o.tip === undefined ? 1 : o.tip, d = 0.7071;
    const c1 = [c[0] + sx * 0.26 * k * d, c[1] + 0.13 * k, c[2] + sz * 0.26 * k * d], c2 = [c[0] + sx * 0.5 * k * d, c[1] + 0.48 * k, c[2] + sz * 0.5 * k * d];
    g.tube(c, c1, Math.max(hr, 0.05), 4, 0.055 * Math.max(0.7, k)); g.tube(c1, c2, 0.055 * Math.max(0.7, k), 4, 0.012);
  }
  g.mat();
}

// Tường lửng có đế đá và mái tường (bờ ngói nhỏ), chạy dọc x từ x0 tới x1 tại z = 0.
function sideWall(g, x0, x1, H, th, seed) {
  let from = g.count;
  g.mat(MAT.stone).color(STONE).shade(0.95); g.box(x0, 0, -th / 2 - 0.06, x1, 0.45, th / 2 + 0.06, 'xXYzZ');
  g.mat(MAT.plaster).color(LIME).shade(0.94 + hash(seed, 1) * 0.08);
  const n = Math.max(1, Math.round((x1 - x0) / 1.9));
  for (let i = 0; i < n; i++) wallBox(g, lerp(x0, x1, i / n), 0.45, -th / 2, lerp(x0, x1, (i + 1) / n), H, th / 2, i === 0 ? 'xzZ' : i === n - 1 ? 'XzZ' : 'zZ');
  weather(g, from, 0, H, seed, 0.6, 0.55);
  from = g.count;
  g.color(LIME_D); g.box(x0 - 0.04, H, -th / 2 - 0.08, x1 + 0.04, H + 0.1, th / 2 + 0.08);
  g.mat(MAT.tile).color(TILE).shade(0.95);
  const yb = H + 0.1, yt = H + 0.36, e = th / 2 + 0.16;
  g.quad([x0 - 0.06, yb, e], [x1 + 0.06, yb, e], [x1 + 0.06, yt, 0], [x0 - 0.06, yt, 0]);
  g.quad([x1 + 0.06, yb, -e], [x0 - 0.06, yb, -e], [x0 - 0.06, yt, 0], [x1 + 0.06, yt, 0]);
  g.mat(MAT.plaster).color(LIME_D).shade(0.9);
  g.tri3([x1 + 0.06, yb, e], [x1 + 0.06, yb, -e], [x1 + 0.06, yt, 0]); g.tri3([x0 - 0.06, yb, -e], [x0 - 0.06, yb, e], [x0 - 0.06, yt, 0]);
  g.color(STONE_D); g.box(x0 - 0.08, yt - 0.04, -0.06, x1 + 0.08, yt + 0.06, 0.06);
  weather(g, from, H - 0.6, H + 0.4, seed + 1, 0.3, 0.5);
  g.mat();
}

// Trụ vuông có đế, thân quét vôi, mũ trụ; trả về cao độ đỉnh mũ để đặt lồng đèn hay nụ sen.
// panel: có ô câu đối đắp nổi ở mặt trước và mặt sau.
function post(g, w, H, seed, panel = false) {
  let from = g.count;
  g.mat(MAT.stone).color(STONE); g.cube(0, 0, 0, w + 0.34, 0.3, w + 0.34, 'xXYzZ');
  g.color(STONE_L); g.cube(0, 0.3, 0, w + 0.18, 0.28, w + 0.18, 'xXYzZ');
  g.mat(MAT.plaster).color(LIME);
  wallBox(g, -w / 2, 0.58, -w / 2, w / 2, H, w / 2, 'xXzZ');
  weather(g, from, 0, H, seed, 0.55, 0.5);
  if (panel) for (const s of [1, -1]) { g.push(); if (s < 0) g.rotY(Math.PI); coupletPanel(g, 0, 1.0, H - 0.25, w * 0.34, w / 2); g.pop(); }
  from = g.count;
  g.mat(MAT.stone).color(STONE_L); g.cube(0, H, 0, w + 0.16, 0.12, w + 0.16);
  g.mat(MAT.plaster).color(LIME_D); g.cube(0, H + 0.12, 0, w + 0.34, 0.14, w + 0.34);
  weather(g, from, H - 0.4, H + 0.3, seed + 2, 0.2, 0.6);
  g.mat();
  return H + 0.26;
}
// Nụ sen trên đỉnh trụ.
function bud(g, y, r) {
  g.mat(MAT.plaster).color(STONE_L).shade(0.92);
  spire(g, y, [[r * 0.5, 0], [r, r * 0.8], [r * 0.9, r * 1.35], [r * 0.4, r * 2.05], [0, r * 2.5]], 6);
  g.mat();
}

// (a) Nghi môn ngoài.
function outerGate(g) {
  for (const s of [-1, 1]) {
    // trụ biểu lớn đội lồng đèn
    g.push().move(s * 2.25, 0, 0);
    const yc = post(g, 1.0, 4.9, 20 + s, true);
    // lồng đèn xây: hai vành trên dưới và bốn trụ góc ôm lấy lòng đèn thụt sâu 6 cm (ô trơn, không đề chữ)
    let from = g.count;
    g.mat(MAT.plaster).color(LIME_D);
    g.cube(0, yc, 0, 1.06, 0.13, 1.06, 'xXzZY'); g.cube(0, yc + 0.85, 0, 1.06, 0.13, 1.06, 'xXzZy');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.cube(sx * 0.46, yc + 0.13, sz * 0.46, 0.14, 0.72, 0.14, 'xXzZ');
    g.color(0x9a7a5c); g.cube(0, yc + 0.13, 0, 0.94, 0.72, 0.94, 'xXzZ');
    weather(g, from, yc - 0.5, yc + 1.2, 31 + s, 0.25, 0.5);
    from = g.count;
    g.mat(MAT.stone).color(STONE_L); g.cube(0, yc + 0.98, 0, 1.24, 0.1, 1.24);
    weather(g, from, yc, yc + 1.1, 33 + s, 0.2, 0.6);
    g.mat();
    roof(g, 0.86, 0.86, 0, 0, yc + 1.1, 0.52, 0.2, { n: 4, m: 2, seed: 40 + s, hip: 0, tip: 0.6, tile: 0x7a766c });
    g.push(); bud(g, yc + 1.58, 0.17); g.pop();
    g.pop();
    // mảng tường đại tự (祿 bên trái, 福 bên phải khi nhìn từ phố) và trụ nhỏ ngoài cùng
    g.push();
    sideWall(g, s > 0 ? 2.75 : -6.35, s > 0 ? 6.35 : -2.75, 3.55, 0.5, 50 + s);
    const cx = s * 4.55;
    g.mat(MAT.plaster).color(0xece6d6); slab(g, cx - 1.42, 0.68, cx + 1.42, 3.4, 0.25);
    g.mat(MAT.lacquer).color(RED); glyph(g, cx, 2.04, 0.31, 1.12, s > 0 ? PHUC : LOC, 0.19);
    g.mat();
    g.pop();
    g.push().move(s * 6.72, 0, 0);
    const ys = post(g, 0.74, 4.0, 60 + s);
    bud(g, ys, 0.2);
    g.pop();
  }
}

// Khối tháp vuông thót dần (4 mặt phẳng).
function frustum(g, w0, w1, y0, y1) {
  const a = w0 / 2, b = w1 / 2;
  g.quad([-a, y0, a], [a, y0, a], [b, y1, b], [-b, y1, b]);
  g.quad([a, y0, a], [a, y0, -a], [b, y1, -b], [b, y1, b]);
  g.quad([a, y0, -a], [-a, y0, -a], [-b, y1, -b], [b, y1, -b]);
  g.quad([-a, y0, -a], [-a, y0, a], [-b, y1, b], [-b, y1, -b]);
}

// (b) Tháp Bút trên núi Độc Tôn. Gốc: tâm chân núi.
export function penTower(g) {
  // núi đá xếp: các mặt phẳng lổn nhổn, rêu bám
  const SEG = 11, R = [[2.8, -0.15], [2.6, 0.75], [2.2, 1.55], [1.72, 2.3], [1.4, 2.8], [1.32, 2.95]], P = [];
  for (let j = 0; j < R.length; j++) {
    P.push([]);
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2, ii = i % SEG, k = j === 0 || j >= R.length - 2 ? 1 : 0.86 + hash(ii, 70 + j) * 0.3;
      P[j].push([Math.cos(a) * R[j][0] * k, R[j][1] + (j > 0 && j < R.length - 2 ? (hash(ii, 90 + j) - 0.5) * 0.4 : 0), -Math.sin(a) * R[j][0] * k * 0.92]);
    }
  }
  const mc = lin(0x56602f);
  g.mat(MAT.mossy);
  for (let j = 0; j < R.length - 1; j++) for (let i = 0; i < SEG; i++) {
    const n = hash(i, 110 + j), m = hash(i, 130 + j) > 0.55 ? 0.28 : 0.06;   // rêu chủ yếu do chất liệu «đá rêu» vẽ
    const [r0, g0, b0] = lin(n > 0.5 ? 0x8a867c : 0x77736a), k = 0.88 + n * 0.24;
    g.rgb((r0 * (1 - m) + mc[0] * m) * k, (g0 * (1 - m) + mc[1] * m) * k, (b0 * (1 - m) + mc[2] * m) * k);
    g.quad(P[j][i], P[j][i + 1], P[j + 1][i + 1], P[j + 1][i]);
  }
  g.color(0x7c796f); g.disc(0, 2.95, 0, 1.32, SEG, 1);
  g.mat();
  // vài khóm cây bụi mọc trên núi đá
  const from0 = g.count;
  [[1.9, 1.5, 1.4, 0.5], [-1.6, 1.3, -1.9, 0.55], [-2.2, 0.9, 1.3, 0.5]].forEach(([x, y, z, r], i) => {
    g.rgb(0.075, 0.2 + i * 0.012, 0.06).sway(0.25); g.ball(x, y + r * 0.5, z, r, 6, 3, 0.8, 0.3, i + 3);
  });
  for (let i = from0; i < g.count; i++) { const k = 0.5 + 0.6 * (g.nrm[i * 3 + 1] * 0.5 + 0.5); g.col[i * 4] *= k; g.col[i * 4 + 1] *= k; g.col[i * 4 + 2] *= k; }
  g.sway(0);

  // tháp năm tầng, thân đá xám, mỗi tầng một gờ mái mỏng
  const W = [2.3, 2.02, 1.76, 1.52, 1.3], H = [1.7, 1.5, 1.35, 1.25, 1.15];
  let y = 2.9;
  let from = g.count;
  g.mat(MAT.stone).color(STONE_D); g.cube(0, y, 0, 2.7, 0.18, 2.7, 'xXYzZ');
  weather(g, from, y, y + 0.3, 7, 0.8, 0.4);
  y += 0.14;
  for (let t = 0; t < 5; t++) {
    const w0 = W[t], w1 = w0 - 0.12, h = H[t];
    from = g.count;
    g.color(t % 2 ? 0x8f8b82 : 0x86837b).shade(0.95 + hash(t, 5) * 0.1);
    frustum(g, w0, (w0 + w1) / 2, y, y + h * 0.5); frustum(g, (w0 + w1) / 2, w1, y + h * 0.5, y + h);
    weather(g, from, y, y + h, 200 + t, 0.5 - t * 0.06, 0.65);
    if (t === 0) {                                  // khám nhỏ ở tầng dưới cùng
      for (const f of [0, 3]) {
        g.push().rotY((f * Math.PI) / 2);
        const zAt = (d) => w0 / 2 - (0.06 * d) / h + 0.03, ar = archPts(0.26, false, 4);
        g.mat().color(0x1d1a17);
        g.quad([-0.26, y + 0.3, zAt(0.3)], [0.26, y + 0.3, zAt(0.3)], [0.26, y + 0.85, zAt(0.85)], [-0.26, y + 0.85, zAt(0.85)]);
        for (let k = 0; k < ar.length - 1; k++) g.tri3([0, y + 0.85, zAt(0.85)], [ar[k + 1][0], y + 0.85 + ar[k + 1][1], zAt(0.85 + ar[k + 1][1])], [ar[k][0], y + 0.85 + ar[k][1], zAt(0.85 + ar[k][1])]);
        g.pop();
      }
      g.mat(MAT.stone);
    } else if (t >= 2) {                            // 寫青天 «Tả Thanh Thiên»: ba chữ son ở ba tầng trên, đọc từ trên xuống, mặt bắc (+x) nhìn ra lối đi
      const zc = (w0 + w1) / 4 + 0.045;
      g.push().rotY(Math.PI / 2);
      g.mat(MAT.lacquer).color(RED).shade(0.95);
      glyph(g, 0, y + h * 0.5, zc, Math.min(0.4, w1 * 0.29), t === 4 ? TA : t === 3 ? THANH : THIEN, 0.15);
      g.mat(MAT.stone).pop();
    }
    y += h;
    from = g.count;
    g.color(STONE_L).shade(0.9); g.cube(0, y, 0, w1 + 0.12, 0.045, w1 + 0.12, 'xXyzZ');
    g.color(STONE).shade(0.95); g.cube(0, y + 0.045, 0, w1 + 0.34, 0.055, w1 + 0.34);
    weather(g, from, y - 0.3, y + 0.1, 220 + t, 0.2, 0.7);
    y += 0.1;
  }
  // ngọn bút: cổ bút và đầu bút lông nhọn chĩa lên trời
  from = g.count;
  g.color(STONE).shade(0.98);
  spire(g, y, [[0.36, 0], [0.36, 0.12], [0.29, 0.2], [0.33, 0.3], [0.44, 0.52], [0.41, 0.74], [0.27, 1.08], [0.11, 1.38], [0, 1.55]], 8);
  weather(g, from, y, y + 1.55, 240, 0.15, 0.4);
  g.mat();
}

// Nghiên đá hình nửa quả đào bổ dọc, ba con thiềm thừ đội. Gốc: tâm mặt bệ.
function inkSlab(g) {
  g.gloss(0.25);
  g.color(0x3c4a3c);
  for (const [x, z] of [[-0.55, 0.2], [0.5, 0.22], [0.05, -0.3]]) {
    g.ball(x, 0.12, z, 0.2, 6, 3, 0.7); g.ball(x, 0.2, z + (z > 0 ? 0.16 : -0.16), 0.1, 4, 2, 0.8);
  }
  const out = (sc, off = 0) => { const p = []; for (let i = 0; i < 16; i++) { const t = (i / 16) * Math.PI * 2; p.push([(0.86 * Math.cos(t) - 0.06) * sc + off, 0.72 * Math.sin(t) * Math.pow(Math.abs(Math.sin(t / 2)), 0.8) * sc]); } return p; };
  g.color(INK).shade(0.9); g.prism(out(0.8), 0.24, 0.34, false, true);
  g.color(INK); g.prism(out(1.0), 0.34, 0.56, false, true);
  // mặt nghiên: vành phẳng quanh mép, lòng nghiên trũng xuống 4 cm (khoét thật, không dán một mặt tối lên trên)
  const rim = out(1.0), well = out(0.72, -0.04);
  for (let i = 0; i < 16; i++) {
    const a = rim[i], b = rim[(i + 1) % 16], c = well[(i + 1) % 16], d = well[i];
    g.color(INK).shade(1.08); g.quad([a[0], 0.56, a[1]], [d[0], 0.56, d[1]], [c[0], 0.56, c[1]], [b[0], 0.56, b[1]]);
    g.color(INK).shade(0.6); g.quad([d[0], 0.56, d[1]], [d[0], 0.52, d[1]], [c[0], 0.52, c[1]], [c[0], 0.56, c[1]]);
  }
  g.color(0x16191a); g.prism(well, 0.5, 0.52, true, false, false);
  g.color(0x4c5a3e).gloss(0.1);                                                   // cuống và lá đào
  g.tube([0.78, 0.5, 0], [1.02, 0.6, 0.02], 0.035, 4);
  g.quad([0.8, 0.57, -0.02], [0.98, 0.58, -0.3], [1.12, 0.6, -0.14], [0.96, 0.59, 0.0]);
  g.gloss(0);
}

// (c) Cổng Đài Nghiên. Gốc: tâm cổng. Lòng cổng thông suốt: x ∈ [-1,25; 1,25].
export function inkGate(g) {
  const W = 5.3, D = 1.3, H = 4.25;
  let from = g.count;
  g.mat(MAT.plaster).color(LIME).shade(0.97);
  archGate(g, W, D, H, 2.5, 1.85);
  weather(g, from, 0, H, 301, 0.65, 0.6);
  from = g.count;
  g.mat(MAT.stone).color(STONE); g.box(-W / 2 - 0.05, 0, -D / 2 - 0.05, -1.25, 0.42, D / 2 + 0.05, 'xzZY'); g.box(1.25, 0, -D / 2 - 0.05, W / 2 + 0.05, 0.42, D / 2 + 0.05, 'XzZY');
  weather(g, from, 0, 0.6, 302, 0.8, 0.3);
  // viền vòm cuốn và hai ô câu đối (để trơn) ở cả hai mặt; hoành phi 硯臺 ở mặt trước
  for (const s of [1, -1]) {
    g.push(); if (s < 0) g.rotY(Math.PI);
    const z = D / 2 + 0.03, ai = archPts(1.25, false, 6), ao = archPts(1.43, false, 6);
    g.mat(MAT.stone).color(STONE_L).shade(0.92);
    for (let k = 0; k < ai.length - 1; k++) g.quad([ai[k][0], 1.85 + ai[k][1], z], [ai[k + 1][0], 1.85 + ai[k + 1][1], z], [ao[k + 1][0], 1.85 + ao[k + 1][1], z], [ao[k][0], 1.85 + ao[k][1], z]);
    if (s > 0) board(g, 0, 3.42, 4.08, 0.78, D / 2, [DAI, NGHIEN], 0.25);
    for (const sx of [-1, 1]) coupletPanel(g, sx * 1.98, 0.75, 3.3, 0.3, D / 2);
    g.pop();
  }
  // gờ mái, tường chắn mái giật cấp và bệ nghiên
  from = g.count;
  g.mat(MAT.stone).color(STONE_L); g.cube(0, H, 0, W + 0.16, 0.1, D + 0.16);
  g.mat(MAT.plaster).color(LIME_D); g.cube(0, H + 0.1, 0, W + 0.36, 0.14, D + 0.36);
  g.color(LIME).shade(0.95); g.cube(0, H + 0.24, 0, 4.0, 0.42, D - 0.1, 'xXYzZ');
  g.color(LIME_D); g.cube(0, H + 0.66, 0, 2.5, 0.32, D - 0.2, 'xXYzZ');
  g.mat(MAT.stone).color(STONE_L); g.cube(0, H + 0.98, 0, 2.2, 0.1, D - 0.1);
  weather(g, from, H - 0.3, H + 1.1, 303, 0.25, 0.7);
  g.mat();
  g.push().move(0, H + 1.08, 0).scale(1.15); inkSlab(g); g.pop();
  // hai trụ đầu tường và tường lửng hai bên
  for (const s of [-1, 1]) {
    g.push().move(s * (W / 2 + 0.42), 0, 0);
    const yt = post(g, 0.78, 4.7, 330 + s);
    bud(g, yt, 0.2);
    g.pop();
    sideWall(g, s > 0 ? W / 2 + 0.81 : -5.6, s > 0 ? 5.6 : -W / 2 - 0.81, 2.6, 0.42, 340 + s);
  }
}

// Cửa sổ tròn (khung, lòng tối, chấn song chữ thập) trên mặt phẳng z nhìn về +z. Các lớp cách nhau 3 cm.
function roundWindow(g, cx, cy, z, r) {
  g.push().move(cx, cy, z).rotX(Math.PI / 2);
  g.mat(MAT.plaster).color(STONE_L).shade(0.95); g.lathe(0, 0, 0, [[r * 1.24, 0], [r * 1.2, 0.09], [r * 1.02, 0.09], [r, 0.03]], 12);
  g.mat().color(0x191512); g.disc(0, 0.03, 0, r, 12, 1);
  g.mat(MAT.lacquer).color(0x7b2a1e);
  g.lathe(0, 0, 0, [[r * 0.5, 0.06], [r * 0.42, 0.06]], 8);
  g.box(-r, 0.03, -0.035, -r * 0.48, 0.06, 0.035, 'zZY'); g.box(r * 0.48, 0.03, -0.035, r, 0.06, 0.035, 'zZY');
  g.box(-0.035, 0.03, -r, 0.035, 0.06, -r * 0.48, 'xXY'); g.box(-0.035, 0.03, r * 0.48, 0.035, 0.06, r, 'xXY');
  g.mat().pop();
}

// (d) Đắc Nguyệt Lâu. Gốc: tâm lầu. Lòng cổng thông suốt: x ∈ [-1,2; 1,2].
// world/landmarks/index.js đặt lầu ở đầu cầu Thê Húc phía đảo, nên mặt -z của lầu là mặt nhìn ra cầu (mặt khách đi tới).
export function moonPavilion(g) {
  const W = 5.0, D = 3.0, H = 3.5;
  let from = g.count;
  g.mat(MAT.plaster).color(LIME).shade(0.96);
  archGate(g, W, D, H, 2.4, 1.75);
  weather(g, from, 0, H, 401, 0.6, 0.6);
  from = g.count;
  g.mat(MAT.stone).color(STONE); g.box(-W / 2 - 0.05, 0, -D / 2 - 0.05, -1.2, 0.45, D / 2 + 0.05, 'xzZY'); g.box(1.2, 0, -D / 2 - 0.05, W / 2 + 0.05, 0.45, D / 2 + 0.05, 'XzZY');
  // bốn trụ góc nổi
  g.mat(MAT.plaster).color(LIME_D);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) wallBox(g, sx * (W / 2 + 0.06) - 0.27, 0.45, sz * (D / 2 + 0.06) - 0.27, sx * (W / 2 + 0.06) + 0.27, H, sz * (D / 2 + 0.06) + 0.27, 'xXzZ', [0, 0.25, 1]);
  weather(g, from, 0, H, 402, 0.7, 0.55);
  for (const s of [1, -1]) {
    g.push(); if (s < 0) g.rotY(Math.PI);
    const z = D / 2 + 0.03, ai = archPts(1.2, false, 6), ao = archPts(1.38, false, 6);
    g.mat(MAT.stone).color(STONE_L).shade(0.92);
    for (let k = 0; k < ai.length - 1; k++) g.quad([ai[k][0], 1.75 + ai[k][1], z], [ai[k + 1][0], 1.75 + ai[k + 1][1], z], [ao[k + 1][0], 1.75 + ao[k + 1][1], z], [ao[k][0], 1.75 + ao[k][1], z]);
    // hoành phi 得月樓 ở mặt nhìn ra cầu (biển dày 7 cm, phủ lên đỉnh viền vòm)
    if (s < 0) board(g, 0, 2.99, 3.47, 0.86, D / 2, [LAU, NGUYET, DAC], 0.2, 0.07);
    for (const sx of [-1, 1]) {
      // hai ô đắp nổi hai bên cửa (chỗ của bức Long Mã Hà Đồ và Thần Quy Lạc Thư): khung đá, giữa là một vòng tròn đắp nổi, không phải chữ
      g.mat(MAT.stone).color(STONE_L).shade(0.9); slab(g, sx * 1.8 - 0.38, 1.25, sx * 1.8 + 0.38, 2.45, D / 2);
      g.push().move(sx * 1.8, 1.85, D / 2 + 0.03).rotX(Math.PI / 2);
      g.mat(MAT.plaster).color(0x9a957c); g.cyl(0, 0, 0, 0.3, 0.27, 0.04, 10, true);
      g.color(0x7d7860); g.cyl(0, 0.04, 0, 0.13, 0.1, 0.035, 8, true);
      g.pop();
      coupletPanel(g, sx * (W / 2 + 0.06), 1.2, 3.3, 0.17, D / 2 + 0.33);   // ô câu đối (để trơn) trên trụ góc
    }
    g.pop();
  }
  from = g.count;
  g.mat(MAT.stone).color(STONE_L); g.cube(0, H, 0, W + 0.5, 0.1, D + 0.5);
  g.mat(MAT.plaster).color(LIME_D); g.cube(0, H + 0.1, 0, W + 0.8, 0.12, D + 0.8);
  weather(g, from, H - 0.3, H + 0.3, 403, 0.2, 0.7);
  g.mat();
  // mái tầng dưới ôm quanh chân tầng lầu
  const UW = 3.3, UD = 2.3, y1 = H + 0.22;
  roof(g, W / 2 + 0.95, D / 2 + 0.95, UW / 2 + 0.05, UD / 2 + 0.05, y1, 0.78, 0.5, { seed: 430, under: 2 });
  // tầng lầu: bốn trụ góc, tường vôi, cửa sổ tròn trước sau
  const y2 = y1 + 0.7, UH = 2.05;
  from = g.count;
  g.mat(MAT.plaster).color(LIME).shade(0.98); wallBox(g, -UW / 2, y2, -UD / 2, UW / 2, y2 + UH, UD / 2, 'xXzZ', [0, 0.2, 0.6, 1]);
  g.color(LIME_D);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) wallBox(g, sx * UW / 2 - 0.17, y2, sz * UD / 2 - 0.17, sx * UW / 2 + 0.17, y2 + UH, sz * UD / 2 + 0.17, 'xXzZ', [0, 0.3, 1]);
  weather(g, from, y2 - 0.2, y2 + UH, 404, 0.4, 0.6);
  g.mat();
  roundWindow(g, 0, y2 + 1.12, UD / 2, 0.56);
  g.push().rotY(Math.PI); roundWindow(g, 0, y2 + 1.12, UD / 2, 0.56); g.pop();
  for (const s of [-1, 1]) {                       // ô cửa nhỏ hai đầu hồi: khung đá nổi 3 cm, lòng tối nổi thêm 3 cm
    g.push().rotY((s * Math.PI) / 2);
    g.mat(MAT.stone).color(STONE_L).shade(0.9); slab(g, -0.42, y2 + 0.7, 0.42, y2 + 1.6, UW / 2);
    g.mat().color(0x191512); slab(g, -0.34, y2 + 0.78, 0.34, y2 + 1.52, UW / 2 + 0.03);
    g.pop();
  }
  from = g.count;
  g.mat(MAT.stone).color(STONE_L); g.cube(0, y2 + UH, 0, UW + 0.4, 0.1, UD + 0.4);
  weather(g, from, y2 + UH - 0.3, y2 + UH + 0.2, 405, 0.2, 0.7);
  g.mat();
  // mái trên: bốn mái, bờ nóc có hai đầu kìm và mặt nguyệt ở giữa
  const y3 = y2 + UH + 0.1, RIDGE = 1.0, RISE = 1.4;
  roof(g, UW / 2 + 1.05, UD / 2 + 1.0, RIDGE, 0, y3, RISE, 0.55, { seed: 440 });
  g.mat(MAT.plaster).color(STONE_D);
  g.box(-RIDGE - 0.2, y3 + RISE - 0.06, -0.09, RIDGE + 0.2, y3 + RISE + 0.2, 0.09);
  for (const s of [-1, 1]) {
    g.box(s * (RIDGE + 0.12) - 0.13, y3 + RISE + 0.2, -0.08, s * (RIDGE + 0.12) + 0.13, y3 + RISE + 0.42, 0.08);
    g.tube([s * (RIDGE + 0.12), y3 + RISE + 0.4, 0], [s * (RIDGE - 0.12), y3 + RISE + 0.66, 0], 0.07, 5, 0.02);
  }
  g.color(STONE_L); g.cube(0, y3 + RISE + 0.2, 0, 0.5, 0.1, 0.16);
  g.push().move(0, y3 + RISE + 0.56, 0).rotX(Math.PI / 2);
  g.mat().color(0xb9a15a); g.cyl(0, -0.04, 0, 0.26, 0.26, 0.08, 12, true, true);
  g.pop();
  // tường lửng hai bên lầu
  for (const s of [-1, 1]) sideWall(g, s > 0 ? W / 2 + 0.33 : -4.9, s > 0 ? 4.9 : -W / 2 - 0.33, 2.7, 0.42, 450 + s);
  g.mat();
}

export function build(g) {
  g.gloss(0).glow(0).sway(0);
  // lối đi lát đá xanh dọc trục, cao hơn nền 3 cm
  for (let i = 0; i < 6; i++) {
    const z0 = 2.6 - i * 3.9, z1 = z0 - 3.9;
    g.mat(MAT.stone).color(0x9a978e).shade(0.94 + hash(i, 501) * 0.1);
    g.quad([-1.5, 0.03, z0], [1.5, 0.03, z0], [1.5, 0.03, z1], [-1.5, 0.03, z1]);
  }
  g.mat();
  outerGate(g);
  // Tháp Bút nằm trong chuỗi chiếu sáng trang trí quanh hồ (art bible mục 7): đèn hắt từ chân núi Độc Tôn lên, dịu dần về ngọn bút
  const pen0 = g.count;
  g.push().move(PEN_TOWER.x, 0, PEN_TOWER.z); penTower(g); g.pop();
  floodlit(g, pen0, g.count, (x, y) => 0.11 * (1 - 0.6 * Math.min(1, Math.max(0, y / 12))));
  g.push().move(0, 0, INK_GATE_Z); inkGate(g); g.pop();

  g.color(0xffffff).gloss(0).glow(0).sway(0).mat();
}
