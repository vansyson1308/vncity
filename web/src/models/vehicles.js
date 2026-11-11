// Xe cộ dựng thủ tục bằng G: xe số, xe ga, xích lô, ô tô, xe buýt. Trục: x hướng tới trước, y lên, z sang phải.
// Phần vỏ nhựa có mặt nạ đổi màu (color(..., 1)) để mỗi xe trong dòng xe một màu mà vẫn chung một lưới.
// Xe được vẽ bằng instancing nên KHÔNG gắn chất liệu chi tiết (g.mat): hình khối và màu đỉnh phải tự đủ.
import earcut from 'earcut';

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
export function motorbike(g, kind = 'wave', detail = 1) {
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
  g.rgb(0.45, 0.45, 0.47).gloss(0.8);
  sc ? g.tube([-0.28, 0.2, 0.2], [-0.86, 0.34, 0.2], 0.035, detail ? 6 : 3, 0.05) : g.tube([-0.08, 0.24, 0.17], [-0.86, 0.36, 0.18], 0.028, detail ? 6 : 3, 0.05);
  g.rgb(0.08, 0.08, 0.09).gloss(0.3).box(-1.02, sc ? 0.765 : 0.76, -0.12, -0.8, sc ? 0.785 : 0.78, 0.12, detail ? 'xXyYzZ' : 'xyY');
  if (detail) { // chắn bùn sau đỡ biển số (biển xe máy 19 × 14 cm, nền trắng)
    const px = sc ? -0.955 : -0.9, py = sc ? 0.5 : 0.62;
    g.quad([px, py, 0.07], [px, py, -0.07], [px - 0.075, py - 0.2, -0.1], [px - 0.075, py - 0.2, 0.1]).quad([px, py, -0.07], [px, py, 0.07], [px - 0.075, py - 0.2, 0.1], [px - 0.075, py - 0.2, -0.1]);
    g.rgb(0.8, 0.8, 0.75).gloss(0).quad([px - 0.08, py - 0.19, -0.095], [px - 0.08, py - 0.19, 0.095], [px - 0.03, py - 0.055, 0.095], [px - 0.03, py - 0.055, -0.095]);
  }
  g.gloss(0);
  return g;
}

// Ô tô con kiểu sedan hạng B (Vios, Accent: xe gia đình và taxi phổ biến nhất Hà Nội). taxi: thêm hộp đèn trên nóc, biển vàng.
// Thân xe có mặt nạ đổi màu (mỗi xe một màu sơn).
export function car(g, taxi = false) {
  const L = taxi ? 4.5 : 4.3, W = 1.76, H = 1.45, hl = L / 2, w = W / 2, ax = hl - 0.85, wr = 0.33, R = wr + 0.07;
  const body = (q) => q.color(0xdcdcdc, 1).gloss(0.8), dark = (q) => q.rgb(0.025, 0.025, 0.03).gloss(0.1), glass = (q) => q.rgb(0.03, 0.05, 0.07).gloss(1);
  for (const x of [ax, -ax]) for (const s of [-1, 1]) tyre(g, x, s * (w - 0.115), wr, 0.19, s, 10);
  const K = (q, a, b) => { dark(q); panel(q, a, b); }; // gầm, hốc bánh
  const cowl = [0.9 + (taxi ? 0.07 : 0), 0.96], deck = [-hl + 0.66, 1.01], F4 = [hl - 0.42, 0.86, w, , 0.035], Rd = [-hl + 0.42, 1.0, w, , 0.02];
  const lamp = (q, a, b, f, r, gr, bl, gl) => { panel(q, a, b, -f, f); q.rgb(r, gr, bl).glow(gl).gloss(1); panel(q, a, b, -1, -f); panel(q, a, b, f, 1); q.glow(0); };
  body(g);
  // mũi xe: gầm, cản dưới (khe gió), cản trước, dải đèn pha + lưới tản nhiệt, mép nắp ca-pô
  hull(g, [
    [ax + R, 0.21, w, K],
    [hl - 0.15, 0.21, w - 0.1, (q, a, b) => { panel(q, a, b, -1, -0.55); panel(q, a, b, 0.55, 1); dark(q); panel(q, a, b, -0.55, 0.55); }],
    [hl - 0.01, 0.35, w - 0.13],
    [hl, 0.58, w - 0.12, (q, a, b) => { dark(q); lamp(q, a, b, 0.45, 0.45, 0.46, 0.44, 1); }],
    [hl - 0.07, 0.76, w - 0.09],
    [...F4.slice(0, 3), 0, F4[4]],
  ], body);
  // thân giữa: nắp ca-pô, vai xe dưới khoang kính, nắp cốp, gầm và hai hốc bánh
  const mid = [F4, [cowl[0], cowl[1], w, , 0.03], [deck[0], deck[1], w, , 0.02], [...Rd.slice(0, 3), 0, Rd[4]], ...arch(-ax, wr, R - wr, 0.21, w, K), ...arch(ax, wr, R - wr, 0.21, w, K)];
  mid[10][3] = K; mid[17][3] = 0;
  hull(g, mid, body);
  // đuôi xe: mép cốp, dải đèn hậu, cản sau
  const tail = [
    Rd,
    [-hl + 0.07, 0.99, w - 0.08, (q, a, b) => lamp(q, a, b, 0.52, 0.8, 0.03, 0.02, 0.7)],
    [-hl, 0.76, w - 0.11],
    [-hl + 0.01, 0.38, w - 0.12],
    [-hl + 0.13, 0.22, w - 0.09, K],
    [-ax - R, 0.21, w, 0],
  ];
  hull(g, tail, body);
  // khoang kính: hai bên nghiêng vào (mặt phẳng qua vai xe), cột A, cột C và mép nóc màu thân, cột B đen
  const zs = w - 0.075, zt = w - 0.23, yb = (x) => cowl[1] + ((deck[1] - cowl[1]) * (x - cowl[0])) / (deck[0] - cowl[0]);
  const zc = (x, y) => zs - ((zs - zt) * (y - yb(x))) / (H - 0.985);
  const C1 = [cowl[0] - 0.62, H - 0.07], Cm = [-0.42, H - 0.03], C2 = [deck[0] + 0.5, H - 0.07];
  const Af = [cowl[0] - 0.11, yb(cowl[0] - 0.11)], At = [C1[0] - 0.05, C1[1] - 0.05], Mt = [Cm[0], Cm[1] - 0.055], Ct = [C2[0] + 0.07, C2[1] - 0.055], Cb = [deck[0] + 0.27, yb(deck[0] + 0.27)];
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
  for (const s of [-1, 1]) {
    for (const x of [cowl[0] - 0.13, -0.2, -ax + R + 0.03]) rect(g, s, w + 0.006, x - 0.007, 0.25, x + 0.007, yb(x) - 0.01);
    for (const x of [-0.04, -ax + R + 0.18]) rect(g, s, w + 0.012, x - 0.14, 0.84, x, 0.875);
  }
  // biển số: xe thường nền trắng, xe kinh doanh vận tải (taxi) nền vàng
  taxi ? g.rgb(0.95, 0.68, 0.03) : g.rgb(0.9, 0.9, 0.86); g.gloss(0.2);
  panel(g, [hl - 0.01, 0.35, w - 0.13], [hl, 0.58, w - 0.12], -0.34, 0.34, 0.22, 0.75, 0.02); panel(g, tail[2], tail[3], -0.24, 0.24, 0.08, 0.5, 0.02);
  if (taxi) { // hộp đèn "mào" trên nóc: đế đen, hộp nhựa sáng
    dark(g); g.box(-0.3, H - 0.005, -0.3, -0.08, H + 0.04, 0.3, 'xXzZ');
    g.rgb(1, 0.93, 0.55).glow(0.55).gloss(0.5); side2(g, [[-0.31, H + 0.04], [-0.07, H + 0.04], [-0.11, H + 0.16], [-0.27, H + 0.16]], 0.27, 0.24);
  }
  g.glow(0).gloss(0);
  return g;
}

// Xe buýt nội đô Hà Nội (Transerco, cỡ 10,5 m kiểu Daewoo BC095 / Thaco City): váy vàng, dải đỏ, thân trên trắng,
// cửa kính lớn, hộp đèn LED báo tuyến trên kính lái, hai cửa lên xuống bên phải, gương "tai thỏ", cục điều hoà trên nóc.
export function bus(g) {
  const L = 10.5, W = 2.45, H = 3.05, cl = 0.32, hl = L / 2, w = W / 2, xf = hl - 2.2, xr = -hl + 2.6, wr = 0.48, R = wr + 0.07;
  const white = (q) => q.color(0xf2efe4).gloss(0.5), yellow = (q) => q.color(0xe2a512).gloss(0.5), red = (q) => q.color(0xc2211b).gloss(0.5);
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
