// Cụm cổng đền Ngọc Sơn phía bờ hồ (đường Đinh Tiên Hoàng).
// Gốc toạ độ: tâm cổng ngoài; mặt cổng nhìn về +z (ra phố), lối đi chạy theo -z ra cầu Thê Húc.
// Theo thứ tự dọc -z: (a) nghi môn ngoài: hai trụ biểu đội lồng đèn, hai mảng tường chữ Phúc – Lộc;
// (b) Tháp Bút năm tầng trên núi Độc Tôn ở bên +x; (c) cổng Đài Nghiên: cổng vòm đội nghiên đá hình nửa quả đào
// do ba con thiềm thừ đỡ; (d) Đắc Nguyệt Lâu: lầu cổng hai tầng, cửa sổ tròn, mái cong đầu đao.
// Lối đi dọc x = 0 thông suốt, chỗ hẹp nhất 2,4 m.
import { hash, lerp } from '../../core/util.js';

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

// Phong hoá theo chiều cao: chân tường rêu ẩm, dưới gờ mái có vệt nước đen, loang lổ theo băm vị trí.
function weather(g, from, y0, y1, seed = 0, moss = 0.5, soot = 0.5) {
  for (let i = from; i < g.count; i++) {
    const x = g.pos[i * 3], y = g.pos[i * 3 + 1], z = g.pos[i * 3 + 2];
    const t = Math.min(1, Math.max(0, (y - y0) / Math.max(0.01, y1 - y0)));
    const n = hash(Math.round(x * 3.1) * 131 + Math.round(z * 3.1) * 17 + Math.round(y * 2.3) * 7, seed);
    const n2 = hash(Math.round(x * 1.3) * 57 + Math.round(z * 1.3) * 29, seed + 5);
    const low = (1 - t) * (1 - t), high = t > 0.8 ? (t - 0.8) / 0.2 : 0;
    const km = Math.min(0.75, moss * (low * 1.0 + n2 * 0.22) * (0.4 + n));
    const ks = Math.min(0.7, soot * (high * 0.7 + low * 0.25 + (n > 0.7 ? 0.3 : 0) + n2 * 0.1));
    const k = 0.86 + n * 0.22;
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
const MARKS = [
  [[-0.7, 0.6, 0.7, 0.6], [0, 0.9, 0, -0.9], [-0.8, -0.8, 0.8, -0.8]],
  [[-0.7, 0.7, 0.7, 0.7], [-0.7, 0.7, -0.7, -0.7], [0.7, 0.7, 0.7, -0.7], [-0.7, -0.7, 0.7, -0.7]],
  [[-0.8, 0.4, 0.8, 0.4], [0, 0.9, 0, 0.4], [-0.1, 0.4, -0.8, -0.8], [0.1, 0.4, 0.8, -0.8]],
  [[-0.5, 0.8, -0.5, -0.8], [0.1, 0.6, 0.8, 0.6], [0.45, 0.9, 0.45, -0.8], [0.1, -0.1, 0.8, -0.1]],
];
// Một hàng chữ dọc (câu đối) hay ngang (hoành phi) bằng các nét trừu tượng.
function column(g, cx, yTop, z, hs, n, seed, vertical = true, w = 0.2) {
  for (let i = 0; i < n; i++) {
    const m = MARKS[(i * 3 + Math.floor(hash(seed, i) * 4) + Math.abs(seed)) % 4];
    if (vertical) glyph(g, cx, yTop - hs - i * hs * 2.5, z, hs, m, w); else glyph(g, cx + (i - (n - 1) / 2) * hs * 2.6, yTop, z, hs, m, w);
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
      g.color(tile).shade(0.85 + hash(seed + f, j) * 0.3);
      g.ribbon(row(j, 0), row(j + 1, 0), true);
      // ngói cũ: loang rêu và mảng sẫm
      for (let i = from; i < g.count; i++) {
        const n = hash(i, seed + 3), km = n > 0.7 ? 0.35 : n < 0.2 ? 0.15 : 0, k = 0.8 + n * 0.4;
        for (let c = 0; c < 3; c++) g.col[i * 4 + c] = g.col[i * 4 + c] * k * (1 - km) + MOSS[c] * km * 0.8;
      }
    }
    g.color(UNDER);
    for (let j = 0; j < UR; j++) g.ribbon(row(j, -0.08), row(j + 1, -0.08));
    g.color(tile).shade(0.55);
    g.ribbon(row(0, 0), row(0, -0.08));
    g.pop();
  }
  // bờ dải theo bốn góc và đầu đao vểnh
  const hr = o.hip === undefined ? 0.075 : o.hip;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const P = (u) => [sx * lerp(a, ta, u), y0 + rise * Math.pow(u, p) + lift * (1 - u) * (1 - u) + 0.03, sz * lerp(b, tb, u)];
    g.color(STONE_D).shade(0.9);
    if (hr > 0) for (let j = 0; j < M; j++) g.tube(P(j / M), P((j + 1) / M), hr, 4);
    const c = P(0), k = o.tip === undefined ? 1 : o.tip, d = 0.7071;
    const c1 = [c[0] + sx * 0.26 * k * d, c[1] + 0.13 * k, c[2] + sz * 0.26 * k * d], c2 = [c[0] + sx * 0.5 * k * d, c[1] + 0.48 * k, c[2] + sz * 0.5 * k * d];
    g.tube(c, c1, Math.max(hr, 0.05), 4, 0.055 * Math.max(0.7, k)); g.tube(c1, c2, 0.055 * Math.max(0.7, k), 4, 0.012);
  }
}

// Tường lửng có đế đá và mái tường (bờ ngói nhỏ), chạy dọc x từ x0 tới x1 tại z = 0.
function sideWall(g, x0, x1, H, th, seed) {
  let from = g.count;
  g.color(STONE).shade(0.95); g.box(x0, 0, -th / 2 - 0.06, x1, 0.45, th / 2 + 0.06, 'xXYzZ');
  g.color(LIME).shade(0.94 + hash(seed, 1) * 0.08);
  const n = Math.max(1, Math.round((x1 - x0) / 1.9));
  for (let i = 0; i < n; i++) wallBox(g, lerp(x0, x1, i / n), 0.45, -th / 2, lerp(x0, x1, (i + 1) / n), H, th / 2, i === 0 ? 'xzZ' : i === n - 1 ? 'XzZ' : 'zZ');
  weather(g, from, 0, H, seed, 0.6, 0.55);
  from = g.count;
  g.color(LIME_D); g.box(x0 - 0.04, H, -th / 2 - 0.08, x1 + 0.04, H + 0.1, th / 2 + 0.08);
  g.color(TILE).shade(0.9);
  const yb = H + 0.1, yt = H + 0.36, e = th / 2 + 0.16;
  g.quad([x0 - 0.06, yb, e], [x1 + 0.06, yb, e], [x1 + 0.06, yt, 0], [x0 - 0.06, yt, 0]);
  g.quad([x1 + 0.06, yb, -e], [x0 - 0.06, yb, -e], [x0 - 0.06, yt, 0], [x1 + 0.06, yt, 0]);
  g.tri3([x1 + 0.06, yb, e], [x1 + 0.06, yb, -e], [x1 + 0.06, yt, 0]); g.tri3([x0 - 0.06, yb, -e], [x0 - 0.06, yb, e], [x0 - 0.06, yt, 0]);
  g.color(STONE_D); g.box(x0 - 0.08, yt - 0.04, -0.06, x1 + 0.08, yt + 0.06, 0.06);
  weather(g, from, H - 0.6, H + 0.4, seed + 1, 0.3, 0.5);
}

// Trụ vuông có đế, thân quét vôi, mũ trụ; trả về cao độ đỉnh mũ để đặt lồng đèn hay nụ sen.
function post(g, w, H, seed, couplet = 0) {
  let from = g.count;
  g.color(STONE); g.cube(0, 0, 0, w + 0.34, 0.3, w + 0.34, 'xXYzZ');
  g.color(STONE_L); g.cube(0, 0.3, 0, w + 0.18, 0.28, w + 0.18, 'xXYzZ');
  g.color(LIME);
  wallBox(g, -w / 2, 0.58, -w / 2, w / 2, H, w / 2, 'xXzZ');
  weather(g, from, 0, H, seed, 0.55, 0.5);
  if (couplet > 0) {
    // ô câu đối: nền trắng, viền và chữ son
    const y0 = 1.0, y1 = H - 0.25, hw = w * 0.34;
    for (const s of [1, -1]) {
      g.push(); if (s < 0) g.rotY(Math.PI);
      g.color(0xefe9da); g.quad([-hw, y0, w / 2 + 0.012], [hw, y0, w / 2 + 0.012], [hw, y1, w / 2 + 0.012], [-hw, y1, w / 2 + 0.012]);
      g.color(RED).shade(0.9);
      const z = w / 2 + 0.022, t = 0.03;
      g.box(-hw, y0, z - 0.004, -hw + t, y1, z, 'Z'); g.box(hw - t, y0, z - 0.004, hw, y1, z, 'Z');
      g.box(-hw, y0, z - 0.004, hw, y0 + t, z, 'Z'); g.box(-hw, y1 - t, z - 0.004, hw, y1, z, 'Z');
      g.color(RED);
      const hs = Math.min(hw * 0.72, (y1 - y0 - 0.2) / (couplet * 2.5));
      column(g, 0, y1 - 0.12, z, hs, couplet, seed * 3 + s);
      g.pop();
    }
  }
  from = g.count;
  g.color(STONE_L); g.cube(0, H, 0, w + 0.16, 0.12, w + 0.16);
  g.color(LIME_D); g.cube(0, H + 0.12, 0, w + 0.34, 0.14, w + 0.34);
  weather(g, from, H - 0.4, H + 0.3, seed + 2, 0.2, 0.6);
  return H + 0.26;
}
// Nụ sen trên đỉnh trụ.
function bud(g, y, r) {
  g.color(STONE_L).shade(0.92);
  g.lathe(0, y, 0, [[r * 0.5, 0], [r, r * 0.8], [r * 0.9, r * 1.35], [r * 0.4, r * 2.05], [0, r * 2.5]], 6);
}

// (a) Nghi môn ngoài.
function outerGate(g) {
  for (const s of [-1, 1]) {
    // trụ biểu lớn đội lồng đèn
    g.push().move(s * 2.25, 0, 0);
    const yc = post(g, 1.0, 4.9, 20 + s, 6);
    let from = g.count;
    g.color(LIME_D); g.cube(0, yc, 0, 1.06, 0.98, 1.06, 'xXzZ');
    weather(g, from, yc - 0.5, yc + 1.2, 31 + s, 0.25, 0.5);
    for (let f = 0; f < 4; f++) {            // bốn ô lồng đèn: khung son, lòng đắp nổi sẫm màu
      g.push().rotY((f * Math.PI) / 2);
      g.color(0x8a7a5e); g.quad([-0.38, yc + 0.13, 0.54], [0.38, yc + 0.13, 0.54], [0.38, yc + 0.85, 0.54], [-0.38, yc + 0.85, 0.54]);
      g.color(0x5c5a4c); g.quad([-0.3, yc + 0.2, 0.548], [0.3, yc + 0.2, 0.548], [0.3, yc + 0.78, 0.548], [-0.3, yc + 0.78, 0.548]);
      g.color(RED).shade(0.8); glyph(g, 0, yc + 0.49, 0.556, 0.22, MARKS[1], 0.22);
      g.pop();
    }
    from = g.count;
    g.color(STONE_L); g.cube(0, yc + 0.98, 0, 1.24, 0.1, 1.24);
    weather(g, from, yc, yc + 1.1, 33 + s, 0.2, 0.6);
    roof(g, 0.86, 0.86, 0, 0, yc + 1.1, 0.52, 0.2, { n: 4, m: 2, seed: 40 + s, hip: 0, tip: 0.6, tile: 0x6a665c });
    g.push(); bud(g, yc + 1.58, 0.17); g.pop();
    g.pop();
    // mảng tường đại tự và trụ nhỏ ngoài cùng
    g.push();
    sideWall(g, s > 0 ? 2.75 : -6.35, s > 0 ? 6.35 : -2.75, 3.55, 0.5, 50 + s);
    const cx = s * 4.55, z = 0.25 + 0.014;
    g.color(0xece6d6); g.quad([cx - 1.42, 0.68, z - 0.004], [cx + 1.42, 0.68, z - 0.004], [cx + 1.42, 3.4, z - 0.004], [cx - 1.42, 3.4, z - 0.004]);
    g.color(RED); glyph(g, cx, 2.04, z + 0.006, 1.12, s > 0 ? PHUC : LOC, 0.19);
    g.pop();
    g.push().move(s * 6.72, 0, 0);
    const ys = post(g, 0.74, 4.0, 60 + s, 0);
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
  for (let j = 0; j < R.length - 1; j++) for (let i = 0; i < SEG; i++) {
    const n = hash(i, 110 + j), m = hash(i, 130 + j) > 0.55 ? 0.55 : 0.12;
    const [r0, g0, b0] = lin(n > 0.5 ? 0x77736a : 0x64615a), k = 0.8 + n * 0.4;
    g.rgb((r0 * (1 - m) + mc[0] * m) * k, (g0 * (1 - m) + mc[1] * m) * k, (b0 * (1 - m) + mc[2] * m) * k);
    g.quad(P[j][i], P[j][i + 1], P[j + 1][i + 1], P[j + 1][i]);
  }
  g.color(0x6c695f); g.disc(0, 2.95, 0, 1.32, SEG, 1);
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
  g.color(STONE_D); g.cube(0, y, 0, 2.7, 0.18, 2.7, 'xXYzZ');
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
        const zAt = (d) => w0 / 2 - (0.06 * d) / h + 0.014, ar = archPts(0.26, false, 4);
        g.color(0x1d1a17);
        g.quad([-0.26, y + 0.3, zAt(0.3)], [0.26, y + 0.3, zAt(0.3)], [0.26, y + 0.85, zAt(0.85)], [-0.26, y + 0.85, zAt(0.85)]);
        for (let k = 0; k < ar.length - 1; k++) g.tri3([0, y + 0.85, zAt(0.85)], [ar[k + 1][0], y + 0.85 + ar[k + 1][1], zAt(0.85 + ar[k + 1][1])], [ar[k][0], y + 0.85 + ar[k][1], zAt(0.85 + ar[k][1])]);
        g.pop();
      }
    } else if (t <= 3) {                            // ba chữ «Tả Thanh Thiên» son đỏ, mỗi tầng một chữ
      const zc = (w0 + w1) / 4 + 0.03;
      g.color(RED).shade(0.95);
      glyph(g, 0, y + h * 0.5, zc, Math.min(0.42, w1 * 0.3), MARKS[(t + 1) % 4], 0.22);
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
  g.lathe(0, y, 0, [[0.36, 0], [0.36, 0.12], [0.29, 0.2], [0.33, 0.3], [0.44, 0.52], [0.41, 0.74], [0.27, 1.08], [0.11, 1.38], [0, 1.55]], 8);
  weather(g, from, y, y + 1.55, 240, 0.15, 0.4);
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
  g.color(INK); g.prism(out(1.0), 0.34, 0.56, true, true);
  g.color(0x16191a); g.prism(out(0.72, -0.04), 0.561, 0.566, true, false, false);   // lòng nghiên trũng
  g.color(0x4c5a3e).gloss(0.1);                                                   // cuống và lá đào
  g.tube([0.78, 0.5, 0], [1.02, 0.6, 0.02], 0.035, 4);
  g.quad([0.8, 0.57, -0.02], [0.98, 0.58, -0.3], [1.12, 0.6, -0.14], [0.96, 0.59, 0.0]);
  g.gloss(0);
}

// (c) Cổng Đài Nghiên. Gốc: tâm cổng.
export function inkGate(g) {
  const W = 5.3, D = 1.3, H = 4.25;
  let from = g.count;
  g.color(LIME).shade(0.97);
  archGate(g, W, D, H, 2.5, 1.85);
  weather(g, from, 0, H, 301, 0.65, 0.6);
  from = g.count;
  g.color(STONE); g.box(-W / 2 - 0.05, 0, -D / 2 - 0.05, -1.25, 0.42, D / 2 + 0.05, 'xzZY'); g.box(1.25, 0, -D / 2 - 0.05, W / 2 + 0.05, 0.42, D / 2 + 0.05, 'XzZY');
  weather(g, from, 0, 0.6, 302, 0.8, 0.3);
  // viền vòm cuốn, hoành phi «Đài Nghiên», hai ô câu đối
  for (const s of [1, -1]) {
    g.push(); if (s < 0) g.rotY(Math.PI);
    const z = D / 2 + 0.012, ai = archPts(1.25, false, 6), ao = archPts(1.43, false, 6);
    g.color(STONE_L).shade(0.92);
    for (let k = 0; k < ai.length - 1; k++) g.quad([ai[k][0], 1.85 + ai[k][1], z], [ai[k + 1][0], 1.85 + ai[k + 1][1], z], [ao[k + 1][0], 1.85 + ao[k + 1][1], z], [ao[k][0], 1.85 + ao[k][1], z]);
    g.color(0x3a2a22); g.quad([-0.95, 3.5, z], [0.95, 3.5, z], [0.95, 4.0, z], [-0.95, 4.0, z]);
    g.color(GOLD); column(g, 0, 3.75, z + 0.008, 0.17, 3, 310 + s, false);
    for (const sx of [-1, 1]) {
      g.color(0xefe9da); g.quad([sx * 1.98 - 0.3, 0.75, z], [sx * 1.98 + 0.3, 0.75, z], [sx * 1.98 + 0.3, 3.3, z], [sx * 1.98 - 0.3, 3.3, z]);
      g.color(RED); column(g, sx * 1.98, 3.2, z + 0.008, 0.2, 5, 320 + s + sx);
    }
    g.pop();
  }
  // gờ mái, tường chắn mái giật cấp và bệ nghiên
  from = g.count;
  g.color(STONE_L); g.cube(0, H, 0, W + 0.16, 0.1, D + 0.16); g.color(LIME_D); g.cube(0, H + 0.1, 0, W + 0.36, 0.14, D + 0.36);
  g.color(LIME).shade(0.95); g.cube(0, H + 0.24, 0, 4.0, 0.42, D - 0.1, 'xXYzZ');
  g.color(LIME_D); g.cube(0, H + 0.66, 0, 2.5, 0.32, D - 0.2, 'xXYzZ');
  g.color(STONE_L); g.cube(0, H + 0.98, 0, 2.2, 0.1, D - 0.1);
  weather(g, from, H - 0.3, H + 1.1, 303, 0.25, 0.7);
  g.push().move(0, H + 1.08, 0).scale(1.15); inkSlab(g); g.pop();
  // hai trụ đầu tường và tường lửng hai bên
  for (const s of [-1, 1]) {
    g.push().move(s * (W / 2 + 0.42), 0, 0);
    const yt = post(g, 0.78, 4.7, 330 + s, 0);
    bud(g, yt, 0.2);
    g.pop();
    sideWall(g, s > 0 ? W / 2 + 0.81 : -5.6, s > 0 ? 5.6 : -W / 2 - 0.81, 2.6, 0.42, 340 + s);
  }
}

// Cửa sổ tròn (khung, lòng tối, chấn song chữ thập) trên mặt phẳng z nhìn về +z.
function roundWindow(g, cx, cy, z, r) {
  g.push().move(cx, cy, z).rotX(Math.PI / 2);
  g.color(STONE_L).shade(0.95); g.lathe(0, 0, 0, [[r * 1.24, 0], [r * 1.2, 0.07], [r * 1.02, 0.07], [r, 0.02]], 12);
  g.color(0x191512); g.disc(0, 0.02, 0, r, 12, 1);
  g.color(0x7b2a1e);
  g.lathe(0, 0, 0, [[r * 0.5, 0.035], [r * 0.42, 0.035]], 8);
  g.box(-r, 0.025, -0.035, -r * 0.48, 0.04, 0.035, 'Y'); g.box(r * 0.48, 0.025, -0.035, r, 0.04, 0.035, 'Y');
  g.box(-0.035, 0.025, -r, 0.035, 0.04, -r * 0.48, 'Y'); g.box(-0.035, 0.025, r * 0.48, 0.035, 0.04, r, 'Y');
  g.pop();
}

// (d) Đắc Nguyệt Lâu. Gốc: tâm lầu.
export function moonPavilion(g) {
  const W = 5.0, D = 3.0, H = 3.5;
  let from = g.count;
  g.color(LIME).shade(0.96);
  archGate(g, W, D, H, 2.4, 1.75);
  weather(g, from, 0, H, 401, 0.6, 0.6);
  from = g.count;
  g.color(STONE); g.box(-W / 2 - 0.05, 0, -D / 2 - 0.05, -1.2, 0.45, D / 2 + 0.05, 'xzZY'); g.box(1.2, 0, -D / 2 - 0.05, W / 2 + 0.05, 0.45, D / 2 + 0.05, 'XzZY');
  // bốn trụ góc nổi
  g.color(LIME_D);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) wallBox(g, sx * (W / 2 + 0.06) - 0.27, 0.45, sz * (D / 2 + 0.06) - 0.27, sx * (W / 2 + 0.06) + 0.27, H, sz * (D / 2 + 0.06) + 0.27, 'xXzZ', [0, 0.25, 1]);
  weather(g, from, 0, H, 402, 0.7, 0.55);
  for (const s of [1, -1]) {
    g.push(); if (s < 0) g.rotY(Math.PI);
    const z = D / 2 + 0.012, ai = archPts(1.2, false, 6), ao = archPts(1.38, false, 6);
    g.color(STONE_L).shade(0.92);
    for (let k = 0; k < ai.length - 1; k++) g.quad([ai[k][0], 1.75 + ai[k][1], z], [ai[k + 1][0], 1.75 + ai[k + 1][1], z], [ao[k + 1][0], 1.75 + ao[k + 1][1], z], [ao[k][0], 1.75 + ao[k][1], z]);
    // hoành phi «Đắc Nguyệt Lâu»
    g.color(0x3a2a22); g.quad([-0.85, 3.02, z + 0.03], [0.85, 3.02, z + 0.03], [0.85, 3.42, z + 0.03], [-0.85, 3.42, z + 0.03]);
    g.color(GOLD); column(g, 0, 3.22, z + 0.038, 0.14, 3, 410 + s, false);
    // hai bức đắp nổi Long Mã Hà Đồ, Thần Quy Lạc Thư và câu đối trên trụ góc
    for (const sx of [-1, 1]) {
      g.color(STONE_L).shade(0.9); g.quad([sx * 1.75 - 0.42, 1.25, z], [sx * 1.75 + 0.42, 1.25, z], [sx * 1.75 + 0.42, 2.45, z], [sx * 1.75 - 0.42, 2.45, z]);
      g.color(0x8f8a70); g.quad([sx * 1.75 - 0.34, 1.33, z + 0.006], [sx * 1.75 + 0.34, 1.33, z + 0.006], [sx * 1.75 + 0.34, 2.37, z + 0.006], [sx * 1.75 - 0.34, 2.37, z + 0.006]);
      g.color(0x6f6a54); glyph(g, sx * 1.75, 1.85, z + 0.012, 0.26, MARKS[2], 0.3);
      g.color(RED).shade(0.95); column(g, sx * (W / 2 + 0.06), 3.25, D / 2 + 0.34, 0.15, 6, 420 + s + sx);
    }
    g.pop();
  }
  from = g.count;
  g.color(STONE_L); g.cube(0, H, 0, W + 0.5, 0.1, D + 0.5); g.color(LIME_D); g.cube(0, H + 0.1, 0, W + 0.8, 0.12, D + 0.8);
  weather(g, from, H - 0.3, H + 0.3, 403, 0.2, 0.7);
  // mái tầng dưới ôm quanh chân tầng lầu
  const UW = 3.3, UD = 2.3, y1 = H + 0.22;
  roof(g, W / 2 + 0.95, D / 2 + 0.95, UW / 2 + 0.05, UD / 2 + 0.05, y1, 0.78, 0.5, { seed: 430, under: 2 });
  // tầng lầu: bốn trụ góc, tường vôi, cửa sổ tròn trước sau
  const y2 = y1 + 0.7, UH = 2.05;
  from = g.count;
  g.color(LIME).shade(0.98); wallBox(g, -UW / 2, y2, -UD / 2, UW / 2, y2 + UH, UD / 2, 'xXzZ', [0, 0.2, 0.6, 1]);
  g.color(LIME_D);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) wallBox(g, sx * UW / 2 - 0.17, y2, sz * UD / 2 - 0.17, sx * UW / 2 + 0.17, y2 + UH, sz * UD / 2 + 0.17, 'xXzZ', [0, 0.3, 1]);
  weather(g, from, y2 - 0.2, y2 + UH, 404, 0.4, 0.6);
  roundWindow(g, 0, y2 + 1.12, UD / 2 + 0.005, 0.56);
  g.push().rotY(Math.PI); roundWindow(g, 0, y2 + 1.12, UD / 2 + 0.005, 0.56); g.pop();
  for (const s of [-1, 1]) {                       // ô cửa nhỏ hai đầu hồi
    g.push().rotY((s * Math.PI) / 2);
    g.color(STONE_L).shade(0.9); g.quad([-0.42, y2 + 0.7, UW / 2 + 0.008], [0.42, y2 + 0.7, UW / 2 + 0.008], [0.42, y2 + 1.6, UW / 2 + 0.008], [-0.42, y2 + 1.6, UW / 2 + 0.008]);
    g.color(0x191512); g.quad([-0.34, y2 + 0.78, UW / 2 + 0.016], [0.34, y2 + 0.78, UW / 2 + 0.016], [0.34, y2 + 1.52, UW / 2 + 0.016], [-0.34, y2 + 1.52, UW / 2 + 0.016]);
    g.pop();
  }
  from = g.count;
  g.color(STONE_L); g.cube(0, y2 + UH, 0, UW + 0.4, 0.1, UD + 0.4);
  weather(g, from, y2 + UH - 0.3, y2 + UH + 0.2, 405, 0.2, 0.7);
  // mái trên: bốn mái, bờ nóc có hai đầu kìm và mặt nguyệt ở giữa
  const y3 = y2 + UH + 0.1, RIDGE = 1.0, RISE = 1.4;
  roof(g, UW / 2 + 1.05, UD / 2 + 1.0, RIDGE, 0, y3, RISE, 0.55, { seed: 440 });
  g.color(STONE_D);
  g.box(-RIDGE - 0.2, y3 + RISE - 0.06, -0.09, RIDGE + 0.2, y3 + RISE + 0.2, 0.09);
  for (const s of [-1, 1]) {
    g.box(s * (RIDGE + 0.12) - 0.13, y3 + RISE + 0.2, -0.08, s * (RIDGE + 0.12) + 0.13, y3 + RISE + 0.42, 0.08);
    g.tube([s * (RIDGE + 0.12), y3 + RISE + 0.4, 0], [s * (RIDGE - 0.12), y3 + RISE + 0.66, 0], 0.07, 5, 0.02);
  }
  g.color(STONE_L); g.cube(0, y3 + RISE + 0.2, 0, 0.5, 0.1, 0.16);
  g.push().move(0, y3 + RISE + 0.56, 0).rotX(Math.PI / 2);
  g.color(0xb9a15a); g.cyl(0, -0.04, 0, 0.26, 0.26, 0.08, 12, true, true);
  g.pop();
  // tường lửng hai bên lầu
  for (const s of [-1, 1]) sideWall(g, s > 0 ? W / 2 + 0.33 : -4.9, s > 0 ? 4.9 : -W / 2 - 0.33, 2.7, 0.42, 450 + s);
}

export function build(g) {
  g.gloss(0).glow(0).sway(0);
  // lối đi lát đá xanh dọc trục, cao hơn nền 3 cm
  for (let i = 0; i < 6; i++) {
    const z0 = 2.6 - i * 3.9, z1 = z0 - 3.9;
    g.color(0x8d8a82).shade(0.88 + hash(i, 501) * 0.2);
    g.quad([-1.5, 0.03, z0], [1.5, 0.03, z0], [1.5, 0.03, z1], [-1.5, 0.03, z1]);
  }
  outerGate(g);
  g.push().move(PEN_TOWER.x, 0, PEN_TOWER.z); penTower(g); g.pop();
  g.push().move(0, 0, INK_GATE_Z); inkGate(g); g.pop();

  g.color(0xffffff).gloss(0).glow(0).sway(0);
}
