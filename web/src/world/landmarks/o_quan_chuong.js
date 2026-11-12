// Ô Quan Chưởng (Đông Hà Môn, 1749, sửa 1817): cửa ô cuối cùng còn lại của thành Thăng Long.
// Cổng thành hai tầng, cả vọng lâu cao khoảng 10 m (art bible bảng 3.5: "2 tầng, khoảng 9 m", rộng khoảng 20 m; con số 9 m ở đó là
// ước lượng). Khối gạch rộng 20 m, sâu 7 m, cao 7 m tới đỉnh lan can; ba cửa vòm thông suốt theo trục z (cửa giữa rộng 3,4 m cao
// 3,3 m cho xe chạy qua, hai cửa phụ rộng 1,8 m cao 2,5 m), trên có vọng lâu mái ngói đầu đao cong cao chừng 3,2 m.
// (Bản trước dựng khối gạch cao 9 m và vọng lâu 6,9 m, tổng 14,8 m: cao gấp rưỡi ngoài đời.)
// Trên cửa chính là khung biển 3 × 1 m đắp nổi ba chữ Hán 東河門 (Đông Hà Môn) bằng mảnh sứ xanh, viết từ phải sang trái;
// tường bên trái cửa chính gắn bia đá của Tổng đốc Hoàng Diệu (1881). Lan can mặt thành trổ ô lục lăng, ô trám.
// Gốc toạ độ ở tâm mặt bằng, mặt chính quay về +z. Mạch gạch do shader vẽ (MAT.brick), mô hình chỉ đặt màu nền.
import { MAT } from '../../core/geo.js';

const lin = (h) => { const f = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)); return [f(((h >> 16) & 255) / 255), f(((h >> 8) & 255) / 255), f((h & 255) / 255)]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const BRICK = lin(0x6c4c3e), SOOT = lin(0x38302c), PLASTER = lin(0x9d927f), MOSS = lin(0x4a4a33);
const TILE = 0x5e3a2e, WOOD = 0x3a2a20, LIME = 0xb3ac9c, BLUE = 0x2a5688;
const HW = 10, HD = 3.5, Y_DECK = 5.9, Y_TOP = 7;
const ARCHES = [{ cx: -5.7, w: 1.8, hs: 1.6 }, { cx: 0, w: 3.4, hs: 1.6 }, { cx: 5.7, w: 1.8, hs: 1.6 }];

// Màu nền gạch cũ theo chiều cao: chân tường rêu ẩm, sát gờ đỉnh sẫm muội nước mưa (chuyển sắc mượt, không loang ô).
function brickCol(g, y, k0 = 1, top = Y_DECK) {
  let c = BRICK;
  if (y > top - 1.6) c = mix(c, SOOT, 0.55 * Math.min(1, (y - top + 1.6) / 1.6));
  if (y < 1.3) c = mix(c, MOSS, (1 - y / 1.3) * 0.5);
  g.rgb(c[0] * k0, c[1] * k0, c[2] * k0);
}
// Mặt tường gạch nhìn từ +z, có khoét các cửa vòm bán nguyệt.
function brickFace(g, x0, x1, y0, y1, z, arches, k0 = 1) {
  g.mat(MAT.brick);
  const P = (x, y) => { brickCol(g, y, k0, y1); return g.v(x, y, z, 0, 0, 1); };
  const cell = (xa, xb, ya, yb) => { const a = P(xa, ya), b = P(xb, ya), c = P(xb, yb), d = P(xa, yb); g.tri(a, b, c); g.tri(a, c, d); };
  const grid = (xa, xb, ya, yb) => {
    if (xb - xa < 0.01 || yb - ya < 0.01) return;
    const ys = [ya, 0.65, 1.3, y1 - 1.6, y1 - 0.8, yb].filter((y, i, l) => y >= ya && y <= yb && (i === 0 || y > l[i - 1] + 0.01)).sort((p, q) => p - q);
    for (let j = 0; j < ys.length - 1; j++) cell(xa, xb, ys[j], ys[j + 1]);
  };
  let x = x0;
  for (const A of arches) {
    const r = A.w / 2, l = A.cx - r, rr = A.cx + r, top = A.hs + r + 0.3, n = 8;
    grid(x, l, y0, y1); grid(l, rr, top, y1);
    for (let i = 0; i < n; i++) {
      const t0 = (Math.PI * i) / n, t1 = (Math.PI * (i + 1)) / n;
      const a = P(A.cx + r * Math.cos(t1), A.hs + r * Math.sin(t1)), b = P(A.cx + r * Math.cos(t0), A.hs + r * Math.sin(t0)), c = P(A.cx + r * Math.cos(t0), top), d = P(A.cx + r * Math.cos(t1), top);
      g.tri(a, b, c); g.tri(a, c, d);
    }
    // dải lót phía sau các đường nối lưới (che khe hở do chia ô không trùng đỉnh)
    brickCol(g, top, k0 * 0.9, y1);
    for (const sx of [l, rr]) g.quad([sx - 0.06, A.hs, z - 0.03], [sx + 0.06, A.hs, z - 0.03], [sx + 0.06, y1, z - 0.03], [sx - 0.06, y1, z - 0.03]);
    g.quad([l, top - 0.06, z - 0.03], [rr, top - 0.06, z - 0.03], [rr, top + 0.06, z - 0.03], [l, top + 0.06, z - 0.03]);
    x = rr;
  }
  grid(x, x1, y0, y1);
}
// Vành gạch quanh cửa vòm (nhô nhẹ) trên mặt z.
function archBand(g, A, z, bw = 0.3) {
  const r = A.w / 2, n = 8, c = lin(0x8a6452); g.mat(MAT.brick);
  const band = (p0, p1, p2, p3, k) => { g.rgb(c[0] * k, c[1] * k, c[2] * k); g.quad(p0, p1, p2, p3); };
  band([A.cx + r, 0, z], [A.cx + r + bw, 0, z], [A.cx + r + bw, A.hs, z], [A.cx + r, A.hs, z], 0.62);
  band([A.cx - r - bw, 0, z], [A.cx - r, 0, z], [A.cx - r, A.hs, z], [A.cx - r - bw, A.hs, z], 0.62);
  for (let i = 0; i < n; i++) {
    const t0 = (Math.PI * i) / n, t1 = (Math.PI * (i + 1)) / n, R = r + bw;
    band([A.cx + r * Math.cos(t0), A.hs + r * Math.sin(t0), z], [A.cx + R * Math.cos(t0), A.hs + R * Math.sin(t0), z], [A.cx + R * Math.cos(t1), A.hs + R * Math.sin(t1), z], [A.cx + r * Math.cos(t1), A.hs + r * Math.sin(t1), z], 0.7 + 0.06 * (i % 2));
  }
}
// Lòng cửa vòm thông suốt từ z1 (trước) tới z0 (sau): pháp tuyến hướng vào trong, giữa hầm tối hơn.
function tunnel(g, A, z0, z1) {
  const r = A.w / 2, n = 8, pts = [[A.cx + r, 0, -1, 0], [A.cx + r, A.hs, -1, 0]];
  for (let i = 1; i <= n; i++) { const t = (Math.PI * i) / n; pts.push([A.cx + r * Math.cos(t), A.hs + r * Math.sin(t), -Math.cos(t), -Math.sin(t)]); }
  pts.push([A.cx - r, 0, 1, 0]); pts[n + 1][2] = 1; pts[n + 1][3] = 0;
  const zs = [z0, (z0 + z1) / 2, z1], ks = [0.7, 0.36, 0.7];
  g.mat(MAT.brick);
  for (let i = 0; i < pts.length - 1; i++) for (let s = 0; s < 2; s++) {
    const p = pts[i], q = pts[i + 1], e = s === 0 ? 0 : 2, m = 1;   // e: đầu hầm, m: giữa hầm (đỉnh giữa hầm luôn đứng đầu tam giác)
    // đoạn thẳng đứng dùng pháp tuyến ngang; đoạn vòm dùng pháp tuyến hướng tâm
    const np = i === 0 ? [-1, 0] : i === pts.length - 2 ? [1, 0] : [p[2], p[3]], nq = i === 0 ? [-1, 0] : i === pts.length - 2 ? [1, 0] : [q[2], q[3]];
    brickCol(g, p[1], ks[m]); const a = g.v(p[0], p[1], zs[m], np[0], np[1], 0);
    brickCol(g, q[1], ks[m]); const b = g.v(q[0], q[1], zs[m], nq[0], nq[1], 0);
    brickCol(g, q[1], ks[e]); const c = g.v(q[0], q[1], zs[e], nq[0], nq[1], 0);
    brickCol(g, p[1], ks[e]); const d = g.v(p[0], p[1], zs[e], np[0], np[1], 0);
    if (s === 0) { g.tri(a, b, c); g.tri(a, c, d); } else { g.tri(a, c, b); g.tri(a, d, c); }
  }
}
// Một mặt mái ngói cong (nhìn từ +z): diềm mái nửa rộng ea ở z=eb, đỉnh nửa rộng ta ở z=tb; góc mái vênh lên lift.
function roofFace(g, ea, eb, ta, tb, y0, h, lift, under = 0) {
  const nu = 8, nv = 4;
  const P = (i, j) => { const u = (i / nu) * 2 - 1, v = j / nv, w = 1 - v; return [(ea + (ta - ea) * v) * u, y0 + h * Math.pow(v, 1.5) + lift * Math.abs(u * u * u) * w * w, eb + (tb - eb) * v]; };
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    g.mat(MAT.tile).color(TILE).shade(0.96 + 0.05 * (j % 2));
    g.quad(P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1));
  }
  // dạ mái gỗ nằm thấp hơn mặt ngói 9 cm (trước đây trùng khít mặt ngói nên nhấp nháy)
  const U = (i, j) => { const p = P(i, j); return [p[0], p[1] - 0.09, p[2]]; };
  g.mat(MAT.wood).color(WOOD); for (let j = 0; j < under; j++) for (let i = 0; i < nu; i++) g.quad(U(i + 1, j), U(i, j), U(i, j + 1), U(i + 1, j + 1));
  // viền diềm mái (đầu ngói) sáng hơn
  g.mat(MAT.plaster).color(LIME).shade(0.62); for (let i = 0; i < nu; i++) { const a = P(i, 0), b = P(i + 1, 0); g.quad([a[0], a[1] - 0.12, a[2]], [b[0], b[1] - 0.12, b[2]], [b[0], b[1] + 0.02, b[2] + 0.01], [a[0], a[1] + 0.02, a[2] + 0.01]); }
}
function curvedRoof(g, ea, eb, ta, tb, y0, h, lift, under) {
  for (let f = 0; f < 4; f++) { g.push().rotY((f * Math.PI) / 2); if (f % 2) roofFace(g, eb, ea, tb, ta, y0, h, lift, under); else roofFace(g, ea, eb, ta, tb, y0, h, lift, under); g.pop(); }
  // bờ dải dọc bốn góc mái + đầu đao cong vút
  g.mat(MAT.plaster).color(LIME).shade(0.8);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    let p = null;
    for (let j = 0; j <= 4; j++) { const v = j / 4, w = 1 - v, q = [sx * (ea + (ta - ea) * v), y0 + h * Math.pow(v, 1.5) + lift * w * w + 0.06, sz * (eb + (tb - eb) * v)]; if (p) g.tube(p, q, 0.09, 4); p = q; }
    const c = [sx * ea, y0 + lift + 0.06, sz * eb];
    g.tube(c, [sx * (ea + 0.3), y0 + lift + 0.28, sz * (eb + 0.3)], 0.09, 4, 0.06); g.tube([sx * (ea + 0.3), y0 + lift + 0.28, sz * (eb + 0.3)], [sx * (ea + 0.46), y0 + lift + 0.7, sz * (eb + 0.46)], 0.06, 4, 0.01);
  }
}
function fanZ(g, pts, z) { const b = g.count; for (const p of pts) g.v(p[0], p[1], z, 0, 0, 1); for (let i = 1; i < pts.length - 1; i++) g.tri(b, b + i, b + i + 1); }
function archPts(cx, y0, w, hs, n = 4) { const hw = w / 2, pts = [[cx - hw, y0], [cx + hw, y0]]; for (let i = 0; i <= 2 * n; i++) { const t = (Math.PI * i) / (2 * n); pts.push([cx + hw * Math.cos(t), y0 + hs + hw * Math.sin(t)]); } return pts; }

// Ba chữ Hán 東河門 dựng bằng nét chữ nhật và nét xiên trên ô vuông đơn vị (x sang phải, y lên trên).
// 4 số: chữ nhật [x0,y0,x1,y1]; 8 số: tứ giác xiên (ngược chiều kim đồng hồ).
const HAN = {
  dong: [[0.06, 0.8, 0.94, 0.88], [0.455, 0, 0.545, 1], [0.2, 0.36, 0.28, 0.7], [0.72, 0.36, 0.8, 0.7], [0.2, 0.63, 0.8, 0.7], [0.28, 0.5, 0.72, 0.56], [0.2, 0.36, 0.8, 0.43],
    [0.02, 0.04, 0.12, 0.0, 0.46, 0.3, 0.4, 0.36], [0.88, 0.0, 0.98, 0.04, 0.6, 0.36, 0.54, 0.3]],
  ha: [[0.02, 0.9, 0.17, 0.76, 0.23, 0.83, 0.08, 0.97], [0.0, 0.6, 0.15, 0.46, 0.21, 0.53, 0.06, 0.67], [0.0, 0.06, 0.09, 0.0, 0.25, 0.3, 0.17, 0.34],
    [0.3, 0.84, 1.0, 0.92], [0.36, 0.34, 0.44, 0.66], [0.62, 0.34, 0.7, 0.66], [0.36, 0.59, 0.7, 0.66], [0.36, 0.34, 0.7, 0.41], [0.82, 0, 0.91, 0.84], [0.68, 0, 0.82, 0.08]],
  mon: [[0.04, 0, 0.14, 1], [0.14, 0.91, 0.44, 1], [0.14, 0.71, 0.44, 0.78], [0.14, 0.5, 0.44, 0.58], [0.36, 0.5, 0.44, 1],
    [0.86, 0, 0.96, 1], [0.56, 0.91, 0.86, 1], [0.56, 0.71, 0.86, 0.78], [0.56, 0.5, 0.86, 0.58], [0.56, 0.5, 0.64, 1], [0.72, 0, 0.86, 0.08]],
};
function han(g, strokes, x0, y0, w, h, z) {
  for (const r of strokes) {
    if (r.length === 4) g.quad([x0 + r[0] * w, y0 + r[1] * h, z], [x0 + r[2] * w, y0 + r[1] * h, z], [x0 + r[2] * w, y0 + r[3] * h, z], [x0 + r[0] * w, y0 + r[3] * h, z]);
    else g.quad([x0 + r[0] * w, y0 + r[1] * h, z], [x0 + r[2] * w, y0 + r[3] * h, z], [x0 + r[4] * w, y0 + r[5] * h, z], [x0 + r[6] * w, y0 + r[7] * h, z]);
  }
}

// Lan can xây quanh mặt thành (nhìn từ +z, mặt ngoài ở z): tường gạch thấp trổ ô lục lăng và ô trám xen kẽ, mũ tường trát vữa.
function parapet(g, hw, z, n, k0) {
  const T = 0.42, yc = Y_TOP - 0.13;
  brickFace(g, -hw, hw, Y_DECK, yc, z, [], k0);
  g.mat(MAT.brick).color(0x5a3a30); g.quad([hw - T, Y_DECK, z - T], [-hw + T, Y_DECK, z - T], [-hw + T, yc, z - T], [hw - T, yc, z - T]);
  g.mat(MAT.plaster).color(LIME).shade(0.66); g.box(-hw - 0.05, yc, z - T - 0.05, hw + 0.05, Y_TOP, z + 0.05);
  g.mat().color(0x17120f);
  const pitch = (2 * hw) / n, y = Y_DECK + 0.52, a = 0.2;
  for (let i = 0; i < n; i++) {
    const x = -hw + (i + 0.5) * pitch;
    for (const [zz, s] of [[z + 0.03, 1], [z - T - 0.03, -1]]) {
      const pts = i % 2 ? [[x - a, y], [x, y - a], [x + a, y], [x, y + a]] : [[x - a * 1.1, y], [x - a * 0.55, y - a * 0.95], [x + a * 0.55, y - a * 0.95], [x + a * 1.1, y], [x + a * 0.55, y + a * 0.95], [x - a * 0.55, y + a * 0.95]];
      for (let q = 1; q < pts.length - 1; q++) s > 0 ? g.tri3([pts[0][0], pts[0][1], zz], [pts[q][0], pts[q][1], zz], [pts[q + 1][0], pts[q + 1][1], zz]) : g.tri3([pts[0][0], pts[0][1], zz], [pts[q + 1][0], pts[q + 1][1], zz], [pts[q][0], pts[q][1], zz]);
    }
  }
}

export function build(g) {
  g.gloss(0).glow(0).sway(0).mat();

  // ----- khối cổng gạch: hai mặt chính khoét ba cửa vòm, hai mặt hồi đặc -----
  for (const dir of [1, -1]) {
    g.push().rotY(dir > 0 ? 0 : Math.PI);
    brickFace(g, -HW, HW, 0, Y_DECK, HD, ARCHES);
    for (const A of ARCHES) archBand(g, A, HD + 0.08, A.w > 3 ? 0.36 : 0.26);
    // chân tường đá và gờ dưới lan can
    g.mat(MAT.stone).color(0x6a645a); g.box(-HW - 0.12, 0, HD, -ARCHES[0].w / 2 + ARCHES[0].cx - 0.3, 0.45, HD + 0.14, 'YZ'); g.box(ARCHES[2].cx + ARCHES[2].w / 2 + 0.3, 0, HD, HW + 0.12, 0.45, HD + 0.14, 'YZ');
    g.box(ARCHES[0].cx + 1.2, 0, HD, -2.1, 0.45, HD + 0.14, 'YZxX'); g.box(2.1, 0, HD, ARCHES[2].cx - 1.2, 0.45, HD + 0.14, 'YZxX');
    g.mat(MAT.brick).color(0x70503f); g.box(-HW - 0.15, Y_DECK - 0.55, HD, HW + 0.15, Y_DECK - 0.3, HD + 0.16, 'YZy'); g.color(0x7c5c4a); g.box(-HW - 0.25, Y_DECK - 0.3, HD, HW + 0.25, Y_DECK, HD + 0.28, 'YZy');
    // khung biển trên cửa chính: nền vữa bạc, ba chữ 東河門 đắp sứ xanh, đọc từ phải sang trái
    g.mat(MAT.plaster).color(0x6a5a4d); g.box(-1.75, 3.85, HD, 1.75, 5.25, HD + 0.14, 'xXYZy');
    g.color(0xb0a58e); g.quad([-1.55, 4.02, HD + 0.17], [1.55, 4.02, HD + 0.17], [1.55, 5.08, HD + 0.17], [-1.55, 5.08, HD + 0.17]);
    g.mat().gloss(0.3).color(BLUE);
    ['mon', 'ha', 'dong'].forEach((k, i) => han(g, HAN[k], -1.35 + i * 0.98, 4.18, 0.74, 0.74, HD + 0.2));
    g.gloss(0);
    // ô đắp trơn trên hai cửa nhỏ
    for (const sx of [-1, 1]) {
      g.mat(MAT.plaster).color(0x64503f); g.box(sx * 5.7 - 1.15, 3.1, HD, sx * 5.7 + 1.15, 4.3, HD + 0.1, 'xXYZy');
      g.color(0x8a7a66); g.quad([sx * 5.7 - 0.98, 3.26, HD + 0.13], [sx * 5.7 + 0.98, 3.26, HD + 0.13], [sx * 5.7 + 0.98, 4.14, HD + 0.13], [sx * 5.7 - 0.98, 4.14, HD + 0.13]);
    }
    // bia đá cấm lính gác sách nhiễu dân (Hoàng Diệu, 1881) gắn bên trái cửa chính, mặt trước
    if (dir > 0) { g.mat(MAT.plaster).color(0x4c4a46); g.box(-3.15, 1.3, HD, -2.35, 2.5, HD + 0.1, 'xXYZy'); g.mat(MAT.lacquer).color(0x6c6a64); g.quad([-3.05, 1.4, HD + 0.13], [-2.45, 1.4, HD + 0.13], [-2.45, 2.4, HD + 0.13], [-3.05, 2.4, HD + 0.13]); }
    g.pop();
  }
  for (const sx of [-1, 1]) {
    g.push().rotY((sx * Math.PI) / 2);
    brickFace(g, -HD, HD, 0, Y_DECK, HW, []);
    g.mat(MAT.stone).color(0x6a645a); g.box(-HD - 0.12, 0, HW, HD + 0.12, 0.45, HW + 0.14, 'YZxX');
    g.mat(MAT.brick).color(0x70503f); g.box(-HD - 0.15, Y_DECK - 0.55, HW, HD + 0.15, Y_DECK - 0.3, HW + 0.16, 'YZy'); g.color(0x7c5c4a); g.box(-HD - 0.25, Y_DECK - 0.3, HW, HD + 0.25, Y_DECK, HW + 0.28, 'YZy');
    g.pop();
  }
  for (let i = 0; i < 3; i++) tunnel(g, ARCHES[i], -HD, HD);

  // ----- mặt thành lát gạch và lan can xây trổ ô -----
  g.mat(MAT.pave).color(0x6f5a4c); g.quad([-HW, Y_DECK, HD], [HW, Y_DECK, HD], [HW, Y_DECK, -HD], [-HW, Y_DECK, -HD]);
  for (const dir of [1, -1]) { g.push().rotY(dir > 0 ? 0 : Math.PI); parapet(g, HW, HD, 15, 0.95); g.pop(); }
  for (const sx of [-1, 1]) { g.push().rotY((sx * Math.PI) / 2); parapet(g, HD, HW, 5, 0.95); g.pop(); }

  // ----- vọng lâu: thân gạch trát vữa, hai tầng mái ngói cong -----
  // Các cao độ dưới đây viết cho vọng lâu cao 6,9 m đặt trên mặt thành cũ (7,9 m); cả khối được ép theo chiều đứng còn 3,2 m và hạ
  // xuống mặt thành mới, giữ nguyên mặt bằng và độ vươn của mái.
  g.push().move(0, Y_DECK, 0).scale(1, 0.46, 1).move(0, -7.9, 0);
  const PW = 3.1, PD = 2.0, yP = 7.9, yE1 = 10.5;
  for (let f = 0; f < 4; f++) {
    g.push().rotY((f * Math.PI) / 2);
    const w = f % 2 ? PD : PW, d = f % 2 ? PW : PD;
    { const c = mix(PLASTER, BRICK, 0.3), b = g.count; g.mat(MAT.plaster);
      g.rgb(c[0] * 0.66, c[1] * 0.66, c[2] * 0.66); g.v(-w, yP, d, 0, 0, 1); g.v(w, yP, d, 0, 0, 1);
      g.rgb(c[0] * 0.9, c[1] * 0.9, c[2] * 0.9); g.v(w, yE1 + 0.3, d, 0, 0, 1); g.v(-w, yE1 + 0.3, d, 0, 0, 1); g.tri(b, b + 1, b + 2); g.tri(b, b + 2, b + 3); }
    if (f % 2 === 0) {
      g.mat(MAT.brick).color(0x6a5546); fanZ(g, archPts(0, yP, 1.7, 1.45), d + 0.07); g.mat().color(0x17120f); fanZ(g, archPts(0, yP, 1.3, 1.35), d + 0.13);
      for (const x of [-2.1, 2.1]) { g.mat(MAT.brick).color(0x6a5546); g.quad([x - 0.45, yP + 0.9, d + 0.07], [x + 0.45, yP + 0.9, d + 0.07], [x + 0.45, yP + 1.9, d + 0.07], [x - 0.45, yP + 1.9, d + 0.07]); g.mat().color(0x17120f); g.quad([x - 0.32, yP + 1.02, d + 0.13], [x + 0.32, yP + 1.02, d + 0.13], [x + 0.32, yP + 1.78, d + 0.13], [x - 0.32, yP + 1.78, d + 0.13]); }
    } else { g.mat(MAT.brick).color(0x6a5546); fanZ(g, archPts(0, yP + 0.8, 1.0, 0.6), d + 0.07); g.mat().color(0x17120f); fanZ(g, archPts(0, yP + 0.9, 0.74, 0.55), d + 0.13); }
    g.pop();
  }
  curvedRoof(g, 4.55, 3.45, 2.2, 1.35, yE1, 1.25, 0.55, 2);
  // cổ diêm (tầng trên thấp) và mái trên
  const yU = yE1 + 1.1, yE2 = 12.35;
  g.mat(MAT.wood).color(0x5a4638); g.box(-2.0, yU, -1.2, 2.0, yE2 + 0.2, 1.2, 'xXzZ');
  g.mat().color(0x2a211b); for (const dz of [-1, 1]) for (let i = -2; i <= 2; i++) { const x = i * 0.72; if (dz > 0) g.quad([x - 0.24, yU + 0.3, 1.26], [x + 0.24, yU + 0.3, 1.26], [x + 0.24, yE2 - 0.1, 1.26], [x - 0.24, yE2 - 0.1, 1.26]); else g.quad([x + 0.24, yU + 0.3, -1.26], [x - 0.24, yU + 0.3, -1.26], [x - 0.24, yE2 - 0.1, -1.26], [x + 0.24, yE2 - 0.1, -1.26]); }
  curvedRoof(g, 3.2, 2.4, 1.2, 0, yE2, 1.5, 0.5, 2);
  // bờ nóc và đầu kìm
  const yR = yE2 + 1.5;
  g.mat(MAT.plaster).color(LIME).shade(0.85); g.box(-1.45, yR - 0.08, -0.13, 1.45, yR + 0.3, 0.13);
  for (const sx of [-1, 1]) { g.box(sx * 1.45 - 0.16, yR + 0.1, -0.15, sx * 1.45 + 0.16, yR + 0.62, 0.15); g.tube([sx * 1.45, yR + 0.6, 0], [sx * 1.2, yR + 0.95, 0], 0.1, 4, 0.02); }
  g.color(LIME).shade(0.95); g.push().move(0, yR + 0.3, 0); g.cyl(0, 0, 0, 0.26, 0.16, 0.2, 6, false); g.ball(0, 0.42, 0, 0.24, 6, 4); g.pop();
  g.mat().pop();

  // ----- cột cờ và cờ đỏ sao vàng -----
  const fx = 7.2, fz = 0, fy = Y_DECK;
  g.color(0x6b665c); g.cube(fx, fy, fz, 0.5, 0.3, 0.5); g.color(0x8a8f92); g.cyl(fx, fy + 0.3, fz, 0.05, 0.035, 3.9, 6, true);
  const y0 = fy + 2.85, fw = 1.8, fh = 1.2;
  g.color(0xd01f1f);
  for (const s of [1, -1]) {
    const b = g.count;
    g.sway(0); g.v(fx + 0.05, y0, fz, 0, 0, s); g.sway(1); g.v(fx + 0.05 + fw, y0, fz, 0, 0, s); g.v(fx + 0.05 + fw, y0 + fh, fz, 0, 0, s); g.sway(0); g.v(fx + 0.05, y0 + fh, fz, 0, 0, s);
    if (s > 0) { g.tri(b, b + 1, b + 2); g.tri(b, b + 2, b + 3); } else { g.tri(b, b + 2, b + 1); g.tri(b, b + 3, b + 2); }
  }
  g.color(0xffd21e).sway(0.5);
  for (const s of [1, -1]) {
    const cx = fx + 0.05 + fw / 2, cy = y0 + fh / 2, z = fz + s * 0.015, b = g.count; g.v(cx, cy, z, 0, 0, s);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, r = i % 2 ? 0.14 : 0.36; g.v(cx + Math.sin(a) * r, cy + Math.cos(a) * r, z, 0, 0, s); }
    for (let i = 0; i < 10; i++) { const p = b + 1 + i, q = b + 1 + ((i + 1) % 10); if (s > 0) g.tri(b, q, p); else g.tri(b, p, q); }
  }
  g.color(0xffffff).mat().gloss(0).glow(0).sway(0);
}
