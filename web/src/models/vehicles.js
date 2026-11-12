// Xe cộ dựng thủ tục bằng G: xe số, xe ga, xích lô, ô tô, xe buýt. Trục: x hướng tới trước, y lên, z sang phải.
// Phần vỏ nhựa có mặt nạ đổi màu (color(..., 1)) để mỗi xe trong dòng xe một màu mà vẫn chung một lưới.
// Xe được vẽ bằng instancing nên KHÔNG gắn chất liệu chi tiết (g.mat): hình khối và màu đỉnh phải tự đủ.
import earcut from 'earcut';
import { tray, flowers, fruit } from './life.js';

// Hộp vát: hình chiếu cạnh pts [x, y] (ngược kim đồng hồ) đùn sang hai bên, đáy rộng hw0, đỉnh hẹp hw1.
function side2(g, pts, hw0, hw1) { let y0 = 1e9, y1 = -1e9; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); } hull(g, pts.map((p) => [p[0], p[1], hw0 + ((hw1 - hw0) * (p[1] - y0)) / (y1 - y0 || 1)]), () => {}); }

// ----- vỏ xe đùn từ hình chiếu cạnh -----
// Một tấm trên cạnh a→b của hình chiếu cạnh (đỉnh [x, y, nửa bề ngang], vòng ngược kim đồng hồ khi nhìn từ bên phải xe):
// f0..f1 là phần bề ngang (−1 trái, 1 phải), t0..t1 là đoạn dọc theo cạnh, off đẩy tấm ra ngoài (biển số, đèn nổi).
function panel(g, a, b, f0 = -1, f1 = 1, t0 = 0, t1 = 1, off = 0) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, ox = (dy / l) * off, oy = (-dx / l) * off;
  const p = (t, f) => [a[0] + dx * t + ox, a[1] + dy * t + oy, (a[2] + (b[2] - a[2]) * t) * f];
  return g.quad(p(t0, f1), p(t0, f0), p(t1, f0), p(t1, f1));
}
// Tấm có sống lưng: phần giữa (|f| < e) nhô cao hơn hai mép ca, cb mét (nắp ca-pô, nóc, cốp hơi vồng nên bắt sáng ba mảng).
function crowned(g, a, b, ca, cb, e = 0.7) {
  const p = (t, f) => { const q = t ? b : a; return [q[0], q[1] + (Math.abs(f) < 0.99 ? (t ? cb : ca) : 0), q[2] * f]; };
  for (const [f0, f1] of [[-1, -e], [-e, e], [e, 1]]) g.quad(p(0, f1), p(0, f0), p(1, f0), p(1, f1));
  return g;
}
// Vỏ xe: P là hình chiếu cạnh khép kín [x, y, nửa bề ngang, kiểu, độ vồng]; mỗi cạnh thành một tấm chạy suốt bề ngang, hai bên
// bịt bằng chính hình chiếu (đỉnh nào hẹp hơn thì hông xe vát vào: mũi xe, đuôi xe bo tròn khi nhìn từ trên).
// kiểu của đỉnh i áp cho cạnh i→i+1: không có = tấm màu thân; 0 = bỏ; hàm (g, a, b) = tự vẽ rồi trả lại màu thân.
function hull(g, P, paint, caps = true) {
  const n = P.length; let ar = 0;
  for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; ar += a[0] * b[1] - b[0] * a[1]; }
  if (ar < 0) { const Q = P.slice().reverse(); P = Q.map((p, j) => [p[0], p[1], p[2], Q[(j + 1) % n][3], p[4]]); } // vòng thuận kim: đảo lại, kiểu cạnh đi theo cạnh
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n], k = a[3];
    if (k === 0) continue;
    if (typeof k === 'function') { k(g, a, b); paint(g); } else if (a[4] || b[4]) crowned(g, a, b, a[4] || 0, b[4] || 0); else panel(g, a, b);
  }
  if (!caps) return;
  const flat = []; for (const p of P) flat.push(p[0], p[1]);
  const t = earcut(flat);
  for (let i = 0; i < t.length; i += 3) {
    let a = P[t[i]], b = P[t[i + 1]], c = P[t[i + 2]];
    if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0) { const s = b; b = c; c = s; } // ngược kim đồng hồ: pháp tuyến +z
    g.tri3([a[0], a[1], a[2]], [b[0], b[1], b[2]], [c[0], c[1], c[2]]).tri3([a[0], a[1], -a[2]], [c[0], c[1], -c[2]], [b[0], b[1], -b[2]]);
  }
}
// Tứ giác trên hông xe (mặt phẳng z = ±z), các điểm [x, y] ngược kim đồng hồ khi nhìn từ bên phải; s = ±1 chọn bên.
function flank(g, s, z, a, b, c, d) { return s > 0 ? g.quad([a[0], a[1], z], [b[0], b[1], z], [c[0], c[1], z], [d[0], d[1], z]) : g.quad([d[0], d[1], -z], [c[0], c[1], -z], [b[0], b[1], -z], [a[0], a[1], -z]); }
const rect = (g, s, z, x0, y0, x1, y1) => flank(g, s, z, [x0, y0], [x1, y0], [x1, y1], [x0, y1]);
// Vòm bánh trong hình chiếu cạnh: 7 đỉnh từ sau ra trước (đi dọc gầm xe), tâm bánh (x, r), khe hở gap; y0 là mép gầm.
function arch(x, r, gap, y0, hw, kind) {
  const R = r + gap, out = [[x - R, y0, hw, kind]];
  for (const d of [162, 126, 90, 54, 18]) { const a = (d * Math.PI) / 180; out.push([x + Math.cos(a) * R, r + Math.sin(a) * R, hw, kind]); }
  out.push([x + R, y0, hw]);
  return out;
}
// Đa giác đều n cạnh trong mặt phẳng z (tâm (x, y), bán kính r), quạt tam giác không đỉnh tâm, quay mặt về dir·z.
// Cạnh đáy nằm ngang khi n chẵn (bánh xe đứng yên trông "đặt" trên mặt đường).
function ngon(g, x, y, z, r, n, dir) {
  const o = n % 4 ? 0 : 0.5, P = (k) => { const a = ((k + o) / n) * Math.PI * 2; return [x + Math.cos(a) * r, y + Math.sin(a) * r, z]; };
  for (let k = 1; k < n - 1; k++) dir > 0 ? g.tri3(P(0), P(k), P(k + 1)) : g.tri3(P(0), P(k + 1), P(k));
}
// Bánh xe: lốp n cạnh (mặt lăn pháp tuyến mượt), hai má lốp, vành/la-zăng bán kính hub·r ở má ngoài (side = ±1) hoặc cả hai má.
function tyre(g, x, z, r, w, side, n = 8, hub = 0.58, both = false, tone = 0.42) {
  const zo = z + (side * w) / 2, zi = z - (side * w) / 2, o = n % 4 ? 0 : 0.5;
  g.rgb(0.022, 0.022, 0.025).gloss(0);
  const base = g.count;
  for (let k = 0; k <= n; k++) { const a = ((k + o) / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); g.v(x + c * r, r + s * r, zo, c, s, 0); g.v(x + c * r, r + s * r, zi, c, s, 0); }
  for (let k = 0; k < n; k++) { const q = base + k * 2; side > 0 ? g.idx.push(q, q + 1, q + 3, q, q + 3, q + 2) : g.idx.push(q, q + 3, q + 1, q, q + 2, q + 3); }
  ngon(g, x, r, zo, r, n, side); ngon(g, x, r, zi, r, n, -side);
  g.rgb(tone, tone + 0.01, tone + 0.03).gloss(0.7); ngon(g, x, r, zo + side * 0.012, r * hub, n, side); if (both) ngon(g, x, r, zi - side * 0.012, r * hub, n, -side);
  g.gloss(0);
}
// Bánh nan hoa mảnh (xích lô): lốp là vành chữ V n cạnh, vài nan hoa dẹt hai mặt.
function spoked(g, x, z, r, n = 10, spokes = 3) {
  const t = 0.05, hw = 0.022, P = (k, rr, zz) => { const a = (k / n) * Math.PI * 2; return [x + Math.cos(a) * rr, r + Math.sin(a) * rr, zz]; };
  g.rgb(0.03, 0.03, 0.033).gloss(0);
  for (let k = 0; k < n; k++) g.quad(P(k, r - t, z + hw), P(k, r, z), P(k + 1, r, z), P(k + 1, r - t, z + hw)).quad(P(k + 1, r - t, z - hw), P(k + 1, r, z), P(k, r, z), P(k, r - t, z - hw));
  g.rgb(0.5, 0.5, 0.52).gloss(0.6);
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI + 0.3, c = Math.cos(a) * (r - t * 0.7), q = Math.sin(a) * (r - t * 0.7), nx = -Math.sin(a) * 0.008, ny = Math.cos(a) * 0.008;
    const A = [x - c - nx, r - q - ny, z], B = [x + c - nx, r + q - ny, z], C = [x + c + nx, r + q + ny, z], D = [x - c + nx, r - q + ny, z];
    g.quad(A, B, C, D).quad(D, C, B, A);
  }
}
// Chắn bùn: dải cong hai mặt quanh tâm bánh (x, y, z), từ góc a0 tới a1 (độ, 0 = phía trước, 90 = đỉnh bánh).
function fender(g, x, y, z, r, a0, a1, n, hw) {
  const P = (i, zz) => { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; return [x + Math.cos(a) * r, y + Math.sin(a) * r, zz]; };
  for (let i = 0; i < n; i++) g.quad(P(i, z + hw), P(i, z - hw), P(i + 1, z - hw), P(i + 1, z + hw)).quad(P(i, z - hw), P(i, z + hw), P(i + 1, z + hw), P(i + 1, z - hw));
}

// Xe máy. kind: 'wave' xe số (Wave Alpha, Dream), 'scooter' xe ga, 'cub' Cúp 82. detail 1: xe của người chơi (bánh tròn hơn,
// có gương, giảm xóc, biển số); detail 0: xe trong dòng xe và xe đỗ (khoảng 200 tam giác).
// Giữ nguyên: trục bánh (0,63 và −0,6), mặt yên, vị trí tay lái: người lái được đặt theo các mốc này.
// opt.exhaustPart: mã bộ phận (g.mat) gắn cho ống xả để dòng xe ẩn nó đi ở xe điện (chỉ dùng cho lưới instancing của dòng xe).
export function motorbike(g, kind = 'wave', detail = 1, opt = {}) {
  const sc = kind === 'scooter', cub = kind === 'cub', D = detail ? undefined : 0; // D: cạnh khuất, chỉ vẽ ở bản chi tiết
  const wr = sc ? 0.24 : 0.29, fx = 0.63, rx = -0.6, n = detail ? 12 : 8;
  // bánh: xe số vành 17 inch lốp mảnh, xe ga vành nhỏ lốp béo
  for (const [x, w] of [[fx, 0.085], [rx, 0.095]]) {
    tyre(g, x, 0, wr, sc ? w + 0.02 : w, 1, n, sc ? 0.6 : 0.73, true, 0.17);
    if (detail) { g.rgb(0.4, 0.41, 0.43).gloss(0.6); for (const s of [-1, 1]) ngon(g, x, wr, s * (w / 2 + 0.03), wr * 0.27, 6, s); }
  }
  // phuộc trước, tay lái
  g.rgb(0.3, 0.31, 0.33).gloss(0.5);
  for (const s of [-1, 1]) g.tube([fx, wr, s * 0.07], [0.42, 0.92, s * 0.06], 0.022, detail ? 4 : 3);
  g.rgb(0.06, 0.06, 0.07).gloss(0.2).tube([0.4, 1.03, -0.3], [0.4, 1.03, 0.3], 0.018, detail ? 4 : 3);
  if (detail) {
    g.tube([0.4, 1.03, -0.22], [0.36, 1.2, -0.27], 0.008, 3).tube([0.4, 1.03, 0.22], [0.36, 1.2, 0.27], 0.008, 3);
    g.cube(0.36, 1.18, -0.28, 0.02, 0.07, 0.11).cube(0.36, 1.18, 0.28, 0.02, 0.07, 0.11);
    g.rgb(0.03, 0.03, 0.03).tube([0.4, 1.03, -0.3], [0.4, 1.03, -0.2], 0.024, 5).tube([0.4, 1.03, 0.2], [0.4, 1.03, 0.3], 0.024, 5);
  }
  const paint = (q) => q.color(0xd8d8d8, 1).gloss(0.7), black = (q) => q.rgb(0.03, 0.03, 0.035).gloss(0.15);
  const lamp = (r, gr, b, gl, f) => (q, a, c) => { if (detail) { panel(q, a, c, -1, -f); panel(q, a, c, f, 1); } q.rgb(r, gr, b).glow(gl).gloss(1); panel(q, a, c, detail ? -f : -1, detail ? f : 1); q.glow(0); };
  // đầu xe có đèn pha, chắn bùn trước, yếm
  paint(g);
  const head = [[0.33, 0.86, 0.13, 0], [0.5, 0.83, 0.11], [0.565, 0.9, 0.095, lamp(1, 0.95, 0.8, 0.85, 0.8)], [0.55, 1.02, 0.095], [0.47, 1.08, 0.12], [0.35, 1.06, 0.13]];
  if (!detail) head.splice(4, 1);
  hull(g, head, paint);
  hull(g, detail ? [[0.42, wr + 0.25, 0.06], [fx, wr + 0.31, 0.06], [fx + 0.21, wr + 0.22, 0.05], [fx + 0.23, wr + 0.26, 0.05], [fx, wr + 0.36, 0.06], [0.4, wr + 0.3, 0.06]] : [[0.4, wr + 0.27, 0.06, 0], [fx, wr + 0.31, 0.06, 0], [fx + 0.23, wr + 0.23, 0.05], [fx, wr + 0.36, 0.06]], paint);
  const yw = sc ? 0.21 : 0.19;
  hull(g, sc ? [[0.25, 0.3, yw, 0], [0.4, 0.28, yw], [0.52, 0.84, yw - 0.03, 0], [0.38, 0.88, yw - 0.03]] : [[0.25, 0.3, yw, 0], [0.34, 0.27, yw], [0.47, 0.86, yw - 0.03, 0], [0.4, 0.88, yw - 0.03]], paint);
  const tail = lamp(0.9, 0.05, 0.03, 0.7, 0.75);
  if (sc) {
    // thân xe ga: sàn để chân phẳng, cốp dưới yên, đuôi thon; yên; cụm máy và truyền động nằm bên trái bánh sau
    hull(g, [[-0.74, 0.3, 0.17], [-0.2, 0.18, 0.19], [0.34, 0.2, 0.19], [0.3, 0.3, 0.19], [-0.04, 0.34, 0.19], [-0.14, 0.74, 0.17, D], [-0.9, 0.76, 0.13, (q, a, b) => { panel(q, a, b, -1, 1, 0.5, 1); tail(q, [a[0], a[1], a[2]], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]); }], [-0.96, 0.52, 0.12]], paint);
    black(g); hull(g, [[-0.86, 0.76, 0.16, 0], [-0.14, 0.74, 0.12], [-0.12, 0.8, 0.12], [-0.3, 0.85, 0.17], [-0.84, 0.86, 0.16]], black);
    g.rgb(0.2, 0.2, 0.22).gloss(0.4).box(-0.72, 0.14, -0.2, -0.16, 0.34, -0.09, detail ? 'xXyYz' : 'xXYz');
  } else {
    // thân xe số: gầm thấp trước yên (để bước qua), ốp sườn thon dần và hất lên về đuôi; yên dài; khối máy nằm ngang
    const bw = cub ? 0.12 : 0.14;
    hull(g, [[-0.9, 0.63, 0.08], [-0.6, 0.55, bw], [-0.28, 0.4, bw], [0.12, 0.36, bw], [0.36, 0.48, bw], [0.28, 0.56, bw], [0.02, 0.56, bw], [-0.15, 0.72, bw, D], [-0.88, 0.76, 0.11], [-0.95, 0.72, 0.08, tail]], paint);
    black(g); hull(g, [[-0.8, 0.75, 0.14, 0], [-0.15, 0.72, 0.11, 0], [0.0, 0.72, 0.09], [-0.02, 0.78, 0.09], [-0.3, 0.84, 0.14], [-0.78, 0.83, 0.14]], black);
    const eng = (q) => q.rgb(0.2, 0.2, 0.22).gloss(0.4);
    eng(g); hull(g, [[-0.28, 0.2, 0.13], [0.14, 0.2, 0.13], [0.18, 0.36, 0.13, 0], [-0.3, 0.42, 0.13]], eng);
    if (detail) { // hộp xích bên trái, hai giảm xóc sau, gác chân
      g.box(-0.6, 0.26, -0.165, -0.2, 0.35, -0.1, 'xXyYz');
      g.rgb(0.45, 0.45, 0.47).gloss(0.7); for (const s of [-1, 1]) g.tube([rx + 0.01, wr + 0.02, s * 0.155], [rx + 0.1, 0.58, s * 0.155], 0.02, 3);
      g.rgb(0.08, 0.08, 0.09).gloss(0.2).tube([0.0, 0.27, -0.23], [0.0, 0.27, 0.23], 0.016, 3);
    }
    if (cub) { const sh = (q) => q.color(0xe8e8e0, 0).gloss(0.5); sh(g); hull(g, [[0.1, 0.3, 0.2, 0], [0.3, 0.3, 0.2], [0.36, 0.7, 0.2, 0], [0.14, 0.7, 0.2]], sh); }
  }
  // ống xả bên phải (cổ nhỏ, bầu to dần về sau), baga, biển số
  g.rgb(0.45, 0.45, 0.47).gloss(0.8); if (opt.exhaustPart) g.mat(opt.exhaustPart);
  sc ? g.tube([-0.28, 0.2, 0.2], [-0.86, 0.34, 0.2], 0.035, detail ? 6 : 3, 0.05) : g.tube([-0.08, 0.24, 0.17], [-0.86, 0.36, 0.18], 0.028, detail ? 6 : 3, 0.05);
  if (opt.exhaustPart) g.mat(0);
  g.rgb(0.08, 0.08, 0.09).gloss(0.3).box(-1.02, sc ? 0.765 : 0.76, -0.12, -0.8, sc ? 0.785 : 0.78, 0.12, detail ? 'xXyYzZ' : 'xyY');
  { // chắn bùn sau đỡ biển số (biển xe máy 19 × 14 cm, nền trắng chữ đen; bản rút gọn chỉ còn tấm biển)
    const px = sc ? -0.955 : -0.9, py = sc ? 0.5 : 0.62;
    if (detail) g.quad([px, py, 0.07], [px, py, -0.07], [px - 0.075, py - 0.2, -0.1], [px - 0.075, py - 0.2, 0.1]).quad([px, py, -0.07], [px, py, 0.07], [px - 0.075, py - 0.2, 0.1], [px - 0.075, py - 0.2, -0.1]);
    g.rgb(0.8, 0.8, 0.75).gloss(0).quad([px - 0.08, py - 0.19, -0.095], [px - 0.08, py - 0.19, 0.095], [px - 0.03, py - 0.055, 0.095], [px - 0.03, py - 0.055, -0.095]);
    // chữ trên biển: hai dòng kiểu "29-B1 / 123.45" (mã tỉnh, sê-ri, số thứ tự), nổi 2 mm trước mặt biển. u ngang (trái → phải khi
    // nhìn từ sau xe, tức +z), v dọc theo mặt biển nghiêng từ mép dưới lên mép trên.
    const P = (u, v) => [px - 0.08 + 0.05 * v - 0.938 * 0.002, py - 0.19 + 0.135 * v + 0.347 * 0.002, -0.095 + 0.19 * u];
    plateText(g, P, detail ? [[0.14, 0.86, 0.56, 0.86, '29-B1'], [0.08, 0.92, 0.14, 0.44, '123.45']] : [[0.14, 0.86, 0.6, 0.82, '29-B1'], [0.08, 0.92, 0.18, 0.4, '123.45']], detail);
  }
  g.gloss(0);
  return g;
}

// Chữ trên biển số: P(u, v) là điểm trên mặt biển (u ngang trái → phải, v từ dưới lên, cả hai từ 0 tới 1, đã đẩy nổi trước mặt biển).
// rows: [u0, u1, v0, v1, chuỗi]. Bản chi tiết vẽ từng ký tự bằng nét kiểu bảy đoạn (đủ để đọc ra chữ số ở tầm vài mét); bản rút gọn
// (dòng xe, xe đỗ: hàng trăm chiếc) chỉ còn mỗi nhóm ký tự một vạch xám, từ xa vẫn ra một biển có chữ mà chỉ thêm vài tam giác.
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', A: 'abcefg', B: 'abcdefg', H: 'bcefg', K: 'bcefg', F: 'aefg', '-': 'g' };
function plateText(g, P, rows, detail) {
  const q = (u0, v0, u1, v1) => g.quad(P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1));
  for (const [u0, u1, v0, v1, s] of rows) {
    const n = s.length, cw = (u1 - u0) / n;
    if (!detail) { g.rgb(0.32, 0.32, 0.33); let a = 0; for (let i = 0; i <= n; i++) if (i === n || s[i] === '-' || s[i] === '.') { if (i > a) q(u0 + a * cw + cw * 0.1, v0 + (v1 - v0) * 0.1, u0 + i * cw - cw * 0.1, v1 - (v1 - v0) * 0.1); a = i + 1; } continue; }
    g.rgb(0.05, 0.05, 0.06);
    for (let i = 0; i < n; i++) {
      const c = s[i], x0 = u0 + i * cw + cw * 0.14, x1 = u0 + (i + 1) * cw - cw * 0.14, tw = (x1 - x0) * 0.24, th = (v1 - v0) * 0.13, ym = (v0 + v1) / 2;
      if (c === '.') { q((x0 + x1) / 2 - tw / 2, v0, (x0 + x1) / 2 + tw / 2, v0 + th); continue; }
      for (const sg of SEG[c] || '') {
        if (sg === 'a') q(x0, v1 - th, x1, v1); else if (sg === 'd') q(x0, v0, x1, v0 + th); else if (sg === 'g') q(x0, ym - th / 2, x1, ym + th / 2);
        else if (sg === 'f') q(x0, ym, x0 + tw, v1); else if (sg === 'e') q(x0, v0, x0 + tw, ym); else if (sg === 'b') q(x1 - tw, ym, x1, v1); else q(x1 - tw, v0, x1, ym);
      }
    }
  }
}

// Chữ cho biển số vẽ bằng panel(g, a, b, f0, f1, t0, t1, ...) trên một cạnh hình chiếu cạnh, nổi off mét. up: cạnh đi từ dưới lên
// (mũi xe: nhìn thẳng vào biển thì +z ở bên trái); không thì cạnh đi từ trên xuống (đuôi xe: +z ở bên phải).
function edgePlate(g, a, b, f0, f1, t0, t1, off, up, rows) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, ox = (dy / l) * off, oy = (-dx / l) * off;
  plateText(g, (u, v) => { const t = up ? t0 + (t1 - t0) * v : t1 + (t0 - t1) * v, f = up ? f1 + (f0 - f1) * u : f0 + (f1 - f0) * u; return [a[0] + dx * t + ox, a[1] + dy * t + oy, (a[2] + (b[2] - a[2]) * t) * f]; }, rows, 1);
}

// Mặt nạ đổi màu thứ ba trong dòng xe (kênh alpha của màu đỉnh): 1 = màu sơn thân (aTint), 0,5 = màu áo / màu phụ (aTint2),
// 0,15 = màu riêng thứ ba (mũ bảo hiểm, biển số: aVar.rgb). Ngoài dòng xe (xưởng vẽ, xe đỗ) các mặt nạ này không có tác dụng.
export const M3 = 0.15;

// Hộp đèn "mào" trên nóc taxi: đế đen, hộp nhựa sáng. part: mã bộ phận để dòng xe ẩn đi ở xe không phải taxi.
function roofSign(g, H, part = 0) {
  if (part) g.mat(part);
  g.rgb(0.025, 0.025, 0.03).gloss(0.1).box(-0.3, H - 0.005, -0.3, -0.08, H + 0.04, 0.3, 'xXzZ');
  g.rgb(1, 0.93, 0.55).glow(0.55).gloss(0.5); side2(g, [[-0.31, H + 0.04], [-0.07, H + 0.04], [-0.11, H + 0.16], [-0.27, H + 0.16]], 0.27, 0.24);
  g.glow(0).gloss(0); if (part) g.mat(0);
}

// Ô tô con. Mặc định là sedan hạng B (Vios, Accent: xe gia đình và taxi xăng phổ biến nhất Hà Nội); opt.kind = 'hatch' là xe gầm cao
// cỡ nhỏ, đuôi cụt (kiểu hatchback / SUV đô thị: dáng của phần lớn taxi điện). taxi: thêm hộp đèn trên nóc, biển vàng.
// Thân xe có mặt nạ đổi màu (mỗi xe một màu sơn). opt.fleet (lưới của dòng xe): biển số mang mặt nạ M3 để mỗi xe một màu biển
// (trắng: xe cá nhân, vàng: xe kinh doanh vận tải, xanh dương: xe cơ quan), hộp đèn nóc mang mã bộ phận opt.roofPart để ẩn được.
export function car(g, taxi = false, opt = {}) {
  const hatch = opt.kind === 'hatch', fleet = !!opt.fleet;
  const L = hatch ? 3.98 : taxi ? 4.5 : 4.3, W = hatch ? 1.74 : 1.76, H = hatch ? 1.6 : 1.45, hl = L / 2, w = W / 2, ax = hl - (hatch ? 0.74 : 0.85), wr = hatch ? 0.345 : 0.33, R = wr + 0.07;
  const body = (q) => q.color(0xdcdcdc, 1).gloss(0.8), dark = (q) => q.rgb(0.025, 0.025, 0.03).gloss(0.1), glass = (q) => q.rgb(0.03, 0.05, 0.07).gloss(1);
  for (const x of [ax, -ax]) for (const s of [-1, 1]) tyre(g, x, s * (w - 0.115), wr, 0.19, s, 10);
  const K = (q, a, b) => { dark(q); panel(q, a, b); }; // gầm, hốc bánh
  const cowl = hatch ? [0.8, 1.04] : [0.9 + (taxi ? 0.07 : 0), 0.96], deck = hatch ? [-hl + 0.2, 1.12] : [-hl + 0.66, 1.01];
  const F4 = hatch ? [hl - 0.36, 0.95, w, , 0.035] : [hl - 0.42, 0.86, w, , 0.035], Rd = hatch ? [-hl + 0.13, 1.1, w, , 0] : [-hl + 0.42, 1.0, w, , 0.02];
  const yN = hatch ? 0.66 : 0.58, yN2 = hatch ? 0.85 : 0.76, yT = hatch ? 0.8 : 0.76;
  const lamp = (q, a, b, f, r, gr, bl, gl) => { panel(q, a, b, -f, f); q.rgb(r, gr, bl).glow(gl).gloss(1); panel(q, a, b, -1, -f); panel(q, a, b, f, 1); q.glow(0); };
  body(g);
  // mũi xe: gầm, cản dưới (khe gió), cản trước, dải đèn pha + lưới tản nhiệt, mép nắp ca-pô
  const nose = [
    [ax + R, 0.21, w, K],
    [hl - 0.15, 0.21, w - 0.1, (q, a, b) => { panel(q, a, b, -1, -0.55); panel(q, a, b, 0.55, 1); dark(q); panel(q, a, b, -0.55, 0.55); }],
    [hl - 0.01, 0.35, w - 0.13],
    [hl, yN, w - 0.12, (q, a, b) => { dark(q); lamp(q, a, b, 0.45, 0.45, 0.46, 0.44, 1); }],
    [hl - 0.07, yN2, w - 0.09],
    [...F4.slice(0, 3), 0, F4[4]],
  ];
  hull(g, nose, body);
  // thân giữa: nắp ca-pô, vai xe dưới khoang kính, nắp cốp, gầm và hai hốc bánh
  const mid = [F4, [cowl[0], cowl[1], w, , 0.03], [deck[0], deck[1], w, , hatch ? 0 : 0.02], [...Rd.slice(0, 3), 0, Rd[4]], ...arch(-ax, wr, R - wr, 0.21, w, K), ...arch(ax, wr, R - wr, 0.21, w, K)];
  mid[10][3] = K; mid[17][3] = 0;
  hull(g, mid, body);
  // đuôi xe: mép cốp, dải đèn hậu, cản sau
  const tail = [
    Rd,
    [-hl + 0.07, Rd[1] - 0.01, w - 0.08, (q, a, b) => lamp(q, a, b, 0.52, 0.8, 0.03, 0.02, 0.7)],
    [-hl, yT, w - 0.11],
    [-hl + 0.01, 0.38, w - 0.12],
    [-hl + 0.13, 0.22, w - 0.09, K],
    [-ax - R, 0.21, w, 0],
  ];
  hull(g, tail, body);
  // khoang kính: hai bên nghiêng vào (mặt phẳng qua vai xe), cột A, cột C và mép nóc màu thân, cột B đen
  const zs = w - 0.075, zt = w - 0.23, yb = (x) => cowl[1] + ((deck[1] - cowl[1]) * (x - cowl[0])) / (deck[0] - cowl[0]);
  const zc = (x, y) => zs - ((zs - zt) * (y - yb(x))) / (H - cowl[1] - 0.025);
  const C1 = [cowl[0] - (hatch ? 0.56 : 0.62), H - 0.07], Cm = [hatch ? -0.5 : -0.42, H - 0.03], C2 = [deck[0] + (hatch ? 0.36 : 0.5), H - (hatch ? 0.09 : 0.07)];
  const Af = [cowl[0] - 0.11, yb(cowl[0] - 0.11)], At = [C1[0] - 0.05, C1[1] - 0.05], Mt = [Cm[0], Cm[1] - 0.055], Ct = [C2[0] + 0.07, C2[1] - 0.055], Cb = [deck[0] + (hatch ? 0.22 : 0.27), yb(deck[0] + (hatch ? 0.22 : 0.27))];
  const yt = (x) => At[1] + ((Mt[1] - At[1]) * (x - At[0])) / (Mt[0] - At[0]);
  const B0 = [-0.16, yb(-0.16)], B1 = [-0.25, yb(-0.25)], B0t = [-0.16, yt(-0.16)], B1t = [-0.25, yt(-0.25)];
  for (const s of [1, -1]) {
    // kính liền một tấm; các cột và mép nóc là tấm ốp nổi 1,2 cm (không cắt lỗ: không hở, không tranh điểm ảnh)
    let o = 0; const v = (p) => [p[0], p[1], s * (zc(p[0], p[1]) + o)], q4 = (a, b, c, d) => (s > 0 ? g.quad(v(a), v(b), v(c), v(d)) : g.quad(v(d), v(c), v(b), v(a)));
    glass(g); for (const [a, b] of [[C1, Cm], [Cm, C2], [C2, deck]]) s > 0 ? g.tri3(v(cowl), v(a), v(b)) : g.tri3(v(cowl), v(b), v(a));
    o = 0.012; body(g); q4(cowl, C1, At, Af); q4(C1, Cm, Mt, At); q4(Cm, C2, Ct, Mt); q4(C2, deck, Cb, Ct);
    g.rgb(0.012, 0.012, 0.014).gloss(0.3); q4(B0, B0t, B1t, B1);
  }
  const z3 = (p) => [p[0], p[1], zc(p[0], p[1])];
  glass(g); panel(g, z3(cowl), z3(C1)); panel(g, z3(C2), z3(deck));
  body(g); crowned(g, z3(C1), z3(Cm), 0, 0.03); crowned(g, z3(Cm), z3(C2), 0.03, 0);
  // gương chiếu hậu
  for (const s of [-1, 1]) g.box(cowl[0] - 0.2, yb(cowl[0]) + 0.02, s * (w - 0.03) - 0.06, cowl[0] - 0.12, yb(cowl[0]) + 0.14, s * (w - 0.03) + 0.06, s > 0 ? 'xXyYZ' : 'xXyYz');
  // khe cửa và tay nắm cửa
  g.rgb(0.03, 0.03, 0.035).gloss(0.2);
  const hy = hatch ? 0.93 : 0.84;
  for (const s of [-1, 1]) {
    for (const x of [cowl[0] - 0.13, -0.2, -ax + R + 0.03]) rect(g, s, w + 0.006, x - 0.007, 0.25, x + 0.007, yb(x) - 0.01);
    for (const x of [-0.04, -ax + R + 0.18]) rect(g, s, w + 0.012, x - 0.14, hy, x, hy + 0.035);
  }
  if (hatch) { // ốp nhựa đen quanh gầm (dáng xe gầm cao), thanh giá nóc
    for (const s of [-1, 1]) { rect(g, s, w + 0.008, -ax + R + 0.02, 0.215, ax - R - 0.02, 0.33); g.box(-0.95, H - 0.02, s * (zt - 0.05) - 0.02, 0.2, H + 0.035, s * (zt - 0.05) + 0.02, 'xXYzZ'); }
  }
  // biển số: xe thường nền trắng, xe kinh doanh vận tải (taxi) nền vàng; trong dòng xe màu biển theo từng xe
  fleet ? g.rgb(0.9, 0.9, 0.86, M3) : taxi ? g.rgb(0.95, 0.68, 0.03) : g.rgb(0.9, 0.9, 0.86); g.gloss(0.2);
  panel(g, nose[2], nose[3], -0.34, 0.34, 0.22, 0.75, 0.02); panel(g, tail[2], tail[3], -0.24, 0.24, 0.08, 0.5, 0.02);
  // chữ biển số: biển dài một dòng ở mũi xe ("30K-123.45"), biển ngắn hai dòng ở đuôi xe. Cạnh mũi xe đi từ dưới lên, cạnh đuôi xe đi
  // từ trên xuống, nên v (từ dưới lên) và u (trái sang phải khi nhìn thẳng vào biển) đổi chiều theo cạnh.
  edgePlate(g, nose[2], nose[3], -0.34, 0.34, 0.22, 0.75, 0.023, true, [[0.05, 0.95, 0.2, 0.8, '30K-123.45']]);
  edgePlate(g, tail[2], tail[3], -0.24, 0.24, 0.08, 0.5, 0.023, false, [[0.26, 0.74, 0.56, 0.88, '30K'], [0.08, 0.92, 0.12, 0.44, '123.45']]);
  if (taxi || opt.roofPart) roofSign(g, H, opt.roofPart || 0);
  g.glow(0).gloss(0);
  return g;
}

// Xe buýt nội đô Hà Nội (Transerco, cỡ 10,5 m kiểu Daewoo BC095 / Thaco City): váy vàng, dải đỏ, thân trên trắng,
// cửa kính lớn, hộp đèn LED báo tuyến trên kính lái, hai cửa lên xuống bên phải, gương "tai thỏ", cục điều hoà trên nóc.
// opt.fleet: váy xe và dải màu mang mặt nạ đổi màu (aTint, aTint2) để mỗi xe buýt trong dòng xe một bộ màu theo nhóm tuyến.
export function bus(g, opt = {}) {
  const L = 10.5, W = 2.45, H = 3.05, cl = 0.32, hl = L / 2, w = W / 2, xf = hl - 2.2, xr = -hl + 2.6, wr = 0.48, R = wr + 0.07;
  const white = (q) => q.color(0xf2efe4).gloss(0.5), yellow = (q) => (opt.fleet ? q.color(0xe0e0e0, 1) : q.color(0xe2a512)).gloss(0.5), red = (q) => (opt.fleet ? q.color(0xe0e0e0, 0.5) : q.color(0xc2211b)).gloss(0.5);
  const dark = (q) => q.rgb(0.025, 0.025, 0.03).gloss(0.1), glass = (q) => q.rgb(0.03, 0.05, 0.07).gloss(1);
  for (const x of [xf, xr]) for (const s of [-1, 1]) tyre(g, x, s * (w - 0.16), wr, 0.28, s, 10, 0.52);
  const K = (q, a, b) => { dark(q); panel(q, a, b); }, B = (q, a, b) => { q.rgb(0.06, 0.06, 0.07).gloss(0.25); panel(q, a, b); }; // gầm; cản nhựa đen
  // váy xe vàng có hốc bánh, cản trước và sau
  const sk = [[hl - 0.08, cl, w, B], [hl, 0.4, w, B], [hl, 0.62, w], [hl, 1.1, w, 0], [-hl, 1.1, w], [-hl, 0.62, w, B], [-hl, 0.4, w, B], [-hl + 0.08, cl, w, K], ...arch(xr, wr, R - wr, cl, w, K), ...arch(xf, wr, R - wr, cl, w, K)];
  sk[14][3] = K; sk[21][3] = K;
  yellow(g); hull(g, sk, yellow);
  // thân trên: mặt trước (dải đỏ, kính lái hơi ngả, hộp đèn báo tuyến), nóc vát hai mép, mặt sau có kính
  const yR = 1.38, y0 = 1.5, y1 = 2.5, yT = 2.82, yF = 2.95, rk = 0.1, ch = 0.16;
  const RED = (q, a, b) => { red(q); panel(q, a, b); };
  const up = [
    [hl, 1.1, w, RED],
    [hl, yR, w, (q, a, b) => { panel(q, a, b, -1, -0.93, 0, 1, 0.012); panel(q, a, b, 0.93, 1, 0, 1, 0.012); glass(q); panel(q, a, b); }],
    [hl - rk, y1, w, (q, a, b) => { panel(q, a, b); q.rgb(0.015, 0.015, 0.02).gloss(0.6); panel(q, a, b, -0.86, 0.86, 0.08, 0.94, 0.012); }],
    [hl - rk, yT, w],
    [hl - rk - 0.2, yF, w - ch],
    [-hl + 0.2, yF, w - ch],
    [-hl, yT, w, (q, a, b) => { panel(q, a, b); glass(q); panel(q, a, b, -0.8, 0.8, 0.24, 0.8, 0.012); }],
    [-hl, yR, w, RED],
    [-hl, 1.1, w, 0],
  ];
  white(g); hull(g, up, white, false);
  const xF = (y) => (y <= yR ? hl : y >= y1 ? hl - rk : hl - (rk * (y - yR)) / (y1 - yR));
  for (const s of [1, -1]) {
    // q: tứ giác trên hông, đáy (xa..xb, ya, z), đỉnh (xat..xbt, yb, zt)
    const q = (xa, ya, xb, yb, z = w, zt = z, xat = xa, xbt = xb) => (s > 0 ? g.quad([xa, ya, z], [xb, ya, z], [xbt, yb, zt], [xat, yb, zt]) : g.quad([xat, yb, -zt], [xbt, yb, -zt], [xb, ya, -z], [xa, ya, -z]));
    red(g); q(-hl, 1.1, hl, yR);
    white(g); q(-hl, yR, hl, y0, w, w, -hl, xF(y0)); q(-hl, y1, hl - rk, yT); q(-hl, yT, hl - rk, yF, w, w - ch, -hl + 0.2, hl - rk - 0.2);
    glass(g); q(-hl, y0, xF(y0), y1, w, w, -hl, xF(y1));
    // trụ giữa các ô kính: ốp nổi 1,2 cm trên dải kính liền
    white(g); const zp = w + 0.012;
    q(xF(y0) - 0.16, y0, xF(y0), y1, zp, zp, xF(y1) - 0.16, xF(y1)); q(-hl, y0, -hl + 0.45, y1, zp);
    for (let i = 1; i <= 6; i++) { const x = hl - 0.25 - i * 1.4; q(x - 0.045, y0, x + 0.045, y1, zp); }
    if (s > 0) for (const [xa, xb] of [[hl - 1.5, hl - 0.4], [-0.95, 0.25]]) { // cửa lên xuống hai cánh (bên phải)
      const xm = (xa + xb) / 2;
      g.rgb(0.07, 0.07, 0.08).gloss(0.3); q(xa, 0.42, xb, 2.46, w + 0.03);
      glass(g); q(xa + 0.07, 0.62, xm - 0.03, 2.38, w + 0.045); q(xm + 0.03, 0.62, xb - 0.07, 2.38, w + 0.045);
    }
    // gương chiếu hậu "tai thỏ" treo trước kính lái
    g.rgb(0.05, 0.05, 0.06).gloss(0.3).tube([hl - rk - 0.04, 2.72, s * (w - 0.08)], [hl + 0.22, 2.44, s * (w - 0.05)], 0.022, 3);
    g.box(hl + 0.19, 2.02, s * (w - 0.05) - 0.09, hl + 0.25, 2.46, s * (w - 0.05) + 0.09);
  }
  // cục điều hoà trên nóc
  g.color(0xdcdad2).gloss(0.3).box(-2.1, yF, -0.78, 0.5, H, 0.78, 'xXYzZ');
  // đèn pha, đèn hậu, biển số nền vàng (xe kinh doanh vận tải), chữ LED báo tuyến màu hổ phách
  g.rgb(0.85, 0.83, 0.74).glow(0.8).gloss(1); for (const s of [-1, 1]) panel(g, sk[2], sk[3], s > 0 ? 0.5 : -0.86, s > 0 ? 0.86 : -0.5, 0.17, 0.6, 0.015);
  g.rgb(0.8, 0.03, 0.02).glow(0.7); for (const s of [-1, 1]) panel(g, sk[4], sk[5], s > 0 ? 0.7 : -0.9, s > 0 ? 0.9 : -0.7, 0.2, 0.8, 0.015);
  g.rgb(0.95, 0.68, 0.03).glow(0).gloss(0.2); panel(g, sk[1], sk[2], -0.2, 0.2, 0.22, 0.78, 0.015); panel(g, sk[5], sk[6], -0.2, 0.2, 0.22, 0.78, 0.015);
  edgePlate(g, sk[1], sk[2], -0.2, 0.2, 0.22, 0.78, 0.018, true, [[0.05, 0.95, 0.25, 0.75, '29B-123.45']]); edgePlate(g, sk[5], sk[6], -0.2, 0.2, 0.22, 0.78, 0.018, false, [[0.05, 0.95, 0.25, 0.75, '29B-123.45']]);
  g.rgb(1, 0.5, 0.04).glow(1); panel(g, up[2], up[3], -0.74, 0.32, 0.3, 0.7, 0.025); panel(g, up[2], up[3], 0.44, 0.74, 0.24, 0.76, 0.025);
  g.glow(0).gloss(0);
  return g;
}

// Xích lô Hà Nội: khách ngồi ghế nệm phía TRƯỚC giữa hai bánh, mui vải gập gọn sau lưng ghế, người đạp ngồi yên cao phía sau
// trên bánh thứ ba, tay lái là thanh ngang sau lưng ghế. Ba bánh nan hoa mảnh.
export function cyclo(g) {
  g.push();
  const steel = (q) => q.rgb(0.3, 0.31, 0.33).gloss(0.6), wr = 0.33;
  for (const z of [-0.42, 0.42]) spoked(g, 0.75, z, wr);
  spoked(g, -0.95, 0, wr);
  // thùng ghế khách: sàn để chân có mép chắn phía trước, bệ ghế, lưng ghế ngả
  const tub = (q) => q.color(0xa3141e).gloss(0.3);
  tub(g); hull(g, [[1.16, 0.26, 0.33], [1.23, 0.41, 0.33], [1.13, 0.31, 0.33], [0.82, 0.31, 0.33], [0.8, 0.5, 0.33], [0.36, 0.5, 0.33], [0.24, 1.02, 0.33], [0.17, 1.02, 0.33], [0.27, 0.26, 0.33]], tub);
  // nệm ghế và nệm lưng bọc vải trắng ngà
  const seat = (q) => q.color(0xe9e2cf).gloss(0.05);
  seat(g); hull(g, [[0.8, 0.5, 0.29], [0.8, 0.585, 0.29], [0.44, 0.585, 0.29], [0.31, 1.0, 0.29], [0.245, 1.0, 0.29, 0], [0.36, 0.5, 0.29, 0]], seat);
  // mui vải gập sau lưng ghế
  const hood = (q) => q.color(0x7d0f18).gloss(0.1);
  hood(g); hull(g, [[0.2, 0.9, 0.34], [0.29, 1.03, 0.34], [0.26, 1.11, 0.34], [0.06, 1.14, 0.34], [-0.05, 0.98, 0.34]], hood);
  // chắn bùn (hai chắn bùn trước cũng là chỗ tì tay của khách)
  steel(g);
  for (const z of [-0.42, 0.42]) fender(g, 0.75, wr, z, wr + 0.045, 35, 160, 3, 0.032);
  fender(g, -0.95, wr, 0, wr + 0.045, 30, 165, 3, 0.035);
  // khung: trục bánh trước, đà dọc, ống yên, ống trên, càng sau, tay lái
  g.tube([0.75, wr, -0.42], [0.75, wr, 0.42], 0.016, 3);
  g.tube([0.3, 0.31, 0], [-0.42, 0.3, 0], 0.025, 4).tube([-0.42, 0.3, 0], [-0.56, 0.955, 0], 0.02, 3).tube([0.22, 0.62, 0], [-0.52, 0.8, 0], 0.02, 3);
  for (const s of [-1, 1]) g.tube([-0.42, 0.3, s * 0.04], [-0.95, wr, s * 0.07], 0.014, 3).tube([-0.54, 0.86, s * 0.03], [-0.95, wr, s * 0.07], 0.012, 3);
  g.tube([0.21, 0.76, 0], [-0.13, 0.9, 0], 0.016, 3).tube([-0.13, 0.9, -0.3], [-0.13, 0.9, 0.3], 0.016, 3);
  // đùi đĩa, bàn đạp
  g.tube([-0.42, 0.3, 0.1], [-0.3, 0.19, 0.1], 0.012, 3).tube([-0.42, 0.3, -0.1], [-0.54, 0.41, -0.1], 0.012, 3);
  g.rgb(0.05, 0.05, 0.055).gloss(0.1).cube(-0.3, 0.18, 0.16, 0.09, 0.02, 0.1, 'yY').cube(-0.54, 0.4, -0.16, 0.09, 0.02, 0.1, 'yY');
  // yên người đạp
  hull(g, [[-0.44, 0.955, 0.035], [-0.44, 1.0, 0.035], [-0.7, 1.01, 0.1], [-0.7, 0.95, 0.1]], () => {});
  g.gloss(0).pop(); return g;
}

// Xe đạp phố (xe mini, xe Thống Nhất cũ): khung thép mảnh, hai bánh nan hoa, chắn bùn, yên, baga sau. Trục bánh 0,57 và −0,5.
// opt.fleet: khung mang mặt nạ đổi màu. opt.parts = { basket, tray, flowers, fruit }: mã bộ phận (g.mat) cho giỏ trước, mẹt sau yên,
// hoa và quả trên mẹt, để dòng xe hiện/ẩn theo từng xe (xe đạp thường, xe đạp bán hoa, xe đạp bán quả dùng chung một lưới).
export function bicycle(g, opt = {}) {
  const wr = 0.335, fx = 0.57, rx = -0.5, P = opt.parts || {};
  spoked(g, fx, 0, wr, 10, 3); spoked(g, rx, 0, wr, 10, 3);
  const bb = [-0.04, 0.29, 0], sc = [-0.19, 0.8, 0], hb = [0.38, 0.64, 0], ht = [0.33, 0.88, 0];
  (opt.fleet ? g.color(0xd8d8d8, 1) : g.color(0x2a5a8c)).gloss(0.5);
  g.tube(bb, sc, 0.018, 3).tube(sc, ht, 0.016, 3).tube(bb, hb, 0.02, 3).tube(hb, [0.3, 1.03, 0], 0.018, 3);
  for (const s of [-1, 1]) g.tube([hb[0], hb[1], s * 0.04], [fx, wr, s * 0.045], 0.012, 3).tube([bb[0], bb[1], s * 0.03], [rx, wr, s * 0.05], 0.011, 3).tube([sc[0], sc[1], s * 0.02], [rx, wr, s * 0.05], 0.01, 3);
  const steel = (q) => q.rgb(0.42, 0.43, 0.45).gloss(0.6);
  steel(g).tube(sc, [-0.215, 0.9, 0], 0.012, 3).tube([0.3, 1.03, -0.27], [0.3, 1.03, 0.27], 0.012, 3);
  fender(g, fx, wr, 0, wr + 0.03, 25, 150, 3, 0.028); fender(g, rx, wr, 0, wr + 0.03, 25, 178, 3, 0.028);
  // yên, tay nắm, đùi đĩa và bàn đạp (bàn đạp phải ở dưới, trái ở trên: khớp tư thế người đạp)
  g.rgb(0.05, 0.05, 0.055).gloss(0.2); hull(g, [[-0.37, 0.9, 0.085], [-0.09, 0.9, 0.03], [-0.09, 0.94, 0.03], [-0.37, 0.955, 0.085]], () => {});
  g.tube([0.3, 1.03, -0.29], [0.3, 1.03, -0.19], 0.017, 3).tube([0.3, 1.03, 0.19], [0.3, 1.03, 0.29], 0.017, 3);
  steel(g).tube([bb[0], bb[1], 0.07], [bb[0] + 0.02, bb[1] - 0.17, 0.07], 0.01, 3).tube([bb[0], bb[1], -0.07], [bb[0] - 0.02, bb[1] + 0.17, -0.07], 0.01, 3);
  g.rgb(0.05, 0.05, 0.055).cube(bb[0] + 0.02, bb[1] - 0.185, 0.13, 0.09, 0.02, 0.09, 'yY').cube(bb[0] - 0.02, bb[1] + 0.16, -0.13, 0.09, 0.02, 0.09, 'yY');
  // baga sau: mặt đỡ và hai thanh chống xuống trục bánh
  g.rgb(0.16, 0.16, 0.18).gloss(0.3).box(rx - 0.28, 0.715, -0.065, rx + 0.2, 0.73, 0.065, 'xyYzZ');
  for (const s of [-1, 1]) g.tube([rx - 0.2, 0.715, s * 0.055], [rx, wr, s * 0.055], 0.008, 3);
  if (P.basket !== undefined) { // giỏ trước bằng nhựa/mây
    g.mat(P.basket).rgb(0.2, 0.17, 0.12).gloss(0.1).box(0.44, 0.8, -0.17, 0.7, 1.0, 0.17, 'xXyzZ').shade(0.6).quad([0.44, 0.83, 0.17], [0.7, 0.83, 0.17], [0.7, 0.83, -0.17], [0.44, 0.83, -0.17]).mat(0);
  }
  if (P.tray !== undefined) { // mẹt lớn Ø 0,8 m buộc trên baga, lùi về sau lưng người đạp
    g.mat(P.tray); tray(g, rx - 0.26, 0.735, 0, 0.4, 0.09, 8); g.mat(0);
    if (P.flowers !== undefined) { g.mat(P.flowers); flowers(g, rx - 0.26, 0.8, 0, 0.38, 3); g.mat(0); }
    if (P.fruit !== undefined) { g.mat(P.fruit); fruit(g, rx - 0.26, 0.79, 0, 0.38, 2); g.mat(0); }
  }
  g.gloss(0);
  return g;
}

// Xe điện du lịch phố cổ: xe bốn bánh hở sườn, mui che trên sáu cột, bốn hàng ghế băng (hàng đầu là ghế lái, vô lăng bên trái),
// thân trắng kem, mui xanh rêu, biển vàng (xe kinh doanh vận tải). Dài 4,5 m, rộng 1,52 m, cao 2,05 m.
// Các hàng ghế: mép trước mặt ghế ở x = 1,17; 0,32; −0,53; −1,38, mặt ghế cao 0,8 m (dùng để đặt người ngồi nướng sẵn).
export const ECART_ROWS = [0.96, 0.11, -0.74, -1.59], ECART_SEAT = 0.8;
export function ecart(g) {
  const hl = 2.25, w = 0.76, wr = 0.25;
  for (const x of [1.52, -1.5]) for (const s of [-1, 1]) tyre(g, x, s * (w - 0.1), wr, 0.16, s, 8, 0.55);
  const cream = (q) => q.color(0xefe8d6).gloss(0.45), green = (q) => q.color(0x2f5d3a).gloss(0.3), vinyl = (q) => q.color(0x5a1a14).gloss(0.2), dark = (q) => q.rgb(0.03, 0.03, 0.035).gloss(0.1);
  // sàn xe (mép sàn là bậc lên xuống), gầm tối
  cream(g).box(-hl, 0.3, -w, 1.5, 0.48, w, 'xXYzZ'); dark(g).box(-hl + 0.1, 0.2, -w + 0.12, 1.4, 0.3, w - 0.12, 'xXzZ');
  // đầu xe: nắp trước vát, dải đèn pha, lưới tản nhiệt giả, biển số vàng
  cream(g); hull(g, [
    [1.5, 0.3, w], [2.18, 0.3, w - 0.06, (q, a, b) => { dark(q); panel(q, a, b); }],
    [2.25, 0.44, w - 0.08, (q, a, b) => { panel(q, a, b, -0.5, 0.5); q.rgb(1, 0.95, 0.8).glow(0.85).gloss(1); panel(q, a, b, -0.92, -0.5, 0.25, 0.8, 0.01); panel(q, a, b, 0.5, 0.92, 0.25, 0.8, 0.01); q.glow(0); panel(q, a, b, -1, -0.5); panel(q, a, b, 0.5, 1); }],
    [2.22, 0.84, w - 0.08], [1.76, 1.0, w - 0.03], [1.5, 1.0, w, 0],
  ], cream);
  g.rgb(0.95, 0.68, 0.03).gloss(0.2); panel(g, [2.25, 0.44, w - 0.08], [2.22, 0.84, w - 0.08], -0.26, 0.26, 0.08, 0.36, 0.014);
  // bảng táp-lô, trụ lái và vô lăng (tay lái bên trái)
  dark(g).box(1.44, 0.86, -w + 0.05, 1.52, 1.0, w - 0.05, 'xYzZ').tube([1.48, 0.9, -0.36], [1.3, 1.1, -0.36], 0.018, 3);
  g.tube([1.33, 1.2, -0.36], [1.27, 1.0, -0.36], 0.02, 3).tube([1.3, 1.1, -0.52], [1.3, 1.1, -0.2], 0.02, 3);
  // ghế băng: chân ghế màu thân, mặt và lưng bọc da nâu đỏ
  for (const x0 of ECART_ROWS) {
    cream(g).box(x0 - 0.16, 0.48, -w + 0.1, x0 + 0.14, 0.72, w - 0.1, 'xXzZ');
    vinyl(g).box(x0 - 0.21, 0.72, -w + 0.06, x0 + 0.21, ECART_SEAT, w - 0.06).box(x0 - 0.27, ECART_SEAT, -w + 0.06, x0 - 0.19, 1.24, w - 0.06);
    // tay vịn đầu băng ghế
    for (const s of [-1, 1]) { cream(g).box(x0 - 0.25, 0.48, s * w - (s > 0 ? 0.045 : 0), x0 + 0.02, 0.98, s * w + (s > 0 ? 0 : 0.045), s > 0 ? 'xXYZz' : 'xXYzZ'); }
  }
  // đuôi xe: tấm chắn sau, đèn hậu, biển vàng
  cream(g).box(-hl, 0.48, -w, -hl + 0.06, 1.0, w);
  g.rgb(0.8, 0.03, 0.02).glow(0.7).gloss(1); for (const s of [-1, 1]) g.quad([-hl - 0.008, 0.62, s * 0.62 - 0.09], [-hl - 0.008, 0.62, s * 0.62 + 0.09], [-hl - 0.008, 0.76, s * 0.62 + 0.09], [-hl - 0.008, 0.76, s * 0.62 - 0.09]);
  g.glow(0).rgb(0.95, 0.68, 0.03).gloss(0.2).quad([-hl - 0.008, 0.6, -0.2], [-hl - 0.008, 0.6, 0.2], [-hl - 0.008, 0.76, 0.2], [-hl - 0.008, 0.76, -0.2]);
  // mui: tấm mui có diềm, sáu cột, khung kính chắn gió (không lắp kính đặc: xe mở, khách nhìn ra tứ phía)
  green(g).box(-hl - 0.02, 1.98, -w - 0.05, 1.74, 2.05, w + 0.05); cream(g).box(-hl, 1.9, -w - 0.03, 1.72, 1.98, w + 0.03, 'xXzZ');
  g.rgb(0.75, 0.75, 0.72).gloss(0.5);
  for (const s of [-1, 1]) {
    g.tube([1.74, 1.0, s * (w - 0.04)], [1.6, 1.92, s * (w - 0.02)], 0.022, 3).tube([ECART_ROWS[1] - 0.23, 0.98, s * (w - 0.02)], [ECART_ROWS[1] - 0.23, 1.92, s * (w - 0.02)], 0.02, 3);
    g.tube([ECART_ROWS[3] - 0.23, 0.98, s * (w - 0.02)], [ECART_ROWS[3] - 0.23, 1.92, s * (w - 0.02)], 0.02, 3).tube([-hl + 0.03, 1.0, s * (w - 0.02)], [-hl + 0.03, 1.92, s * (w - 0.02)], 0.02, 3);
  }
  g.tube([1.74, 1.0, -w + 0.04], [1.74, 1.0, w - 0.04], 0.018, 3);
  g.gloss(0);
  return g;
}
