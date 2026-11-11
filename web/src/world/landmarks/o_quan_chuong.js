// Ô Quan Chưởng (Đông Hà Môn, 1749, sửa 1817): cửa ô cuối cùng còn lại của thành Thăng Long.
// Khối gạch rộng 20 m, sâu 7 m, cao 9 m tới đỉnh tường chắn; ba cửa vòm thông suốt theo trục z
// (cửa giữa rộng 3,4 m cao 4 m cho xe chạy qua), trên có vọng lâu hai tầng mái ngói đầu đao cong.
// Gốc toạ độ ở tâm mặt bằng, mặt chính quay về +z.
import { hash } from '../../core/util.js';

const lin = (h) => { const f = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)); return [f(((h >> 16) & 255) / 255), f(((h >> 8) & 255) / 255), f((h & 255) / 255)]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const BRICK_A = lin(0x7f5545), BRICK_B = lin(0x5e433a), SOOT = lin(0x352d29), PLASTER = lin(0x9d927f), MOSS = lin(0x45432f);
const TILE = 0x5e3a2e, WOOD = 0x3a2a20, LIME = 0xb3ac9c;
const HW = 10, HD = 3.5, Y_DECK = 7.9, Y_TOP = 9;
const ARCHES = [{ cx: -5.7, w: 1.8, hs: 1.8 }, { cx: 0, w: 3.4, hs: 2.3 }, { cx: 5.7, w: 1.8, hs: 1.8 }];

const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
function vn(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, h = (i, j) => hash(i * 157 + j * 31 + s * 1013, 7);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1), u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// Màu gạch cũ tại (x,y) của một mặt tường: đỏ nâu loang, vệt muội chảy từ trên xuống, mảng vữa bạc, chân tường rêu ẩm.
function brickCol(g, x, y, seed, k0 = 1, top = Y_DECK) {
  let c = mix(BRICK_A, BRICK_B, vn(x / 1.0, y / 0.8, seed));
  const streak = sstep(0.42, 0.78, vn(x / 0.75 + 9, y / 4.0, seed + 1)) * (0.35 + 0.75 * Math.min(1, y / top));
  c = mix(c, SOOT, streak * 0.85);
  c = mix(c, PLASTER, sstep(0.68, 0.86, vn(x / 1.5 + 5, y / 1.2 + 3, seed + 2)) * 0.5);
  if (y < 1.3) c = mix(c, MOSS, (1 - y / 1.3) * 0.65);
  let k = k0; if (y > top - 1.3) k *= 1 - 0.35 * ((y - top + 1.3) / 1.3);
  g.rgb(c[0] * k, c[1] * k, c[2] * k);
}
// Mặt tường gạch nhìn từ +z, có khoét các cửa vòm bán nguyệt.
function brickFace(g, x0, x1, y0, y1, z, arches, seed, k0 = 1) {
  const P = (x, y) => { brickCol(g, x, y, seed, k0, y1); return g.v(x, y, z, 0, 0, 1); };
  const cell = (xa, xb, ya, yb) => { const a = P(xa, ya), b = P(xb, ya), c = P(xb, yb), d = P(xa, yb); g.tri(a, b, c); g.tri(a, c, d); };
  const grid = (xa, xb, ya, yb) => {
    if (xb - xa < 0.01 || yb - ya < 0.01) return;
    const nx = Math.max(1, Math.round((xb - xa) / 0.9)), ny = Math.max(1, Math.round((yb - ya) / 0.9));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) cell(xa + ((xb - xa) * i) / nx, xa + ((xb - xa) * (i + 1)) / nx, ya + ((yb - ya) * j) / ny, ya + ((yb - ya) * (j + 1)) / ny);
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
    brickCol(g, A.cx, top, seed, k0 * 0.9, y1);
    for (const sx of [l, rr]) g.quad([sx - 0.06, A.hs, z - 0.03], [sx + 0.06, A.hs, z - 0.03], [sx + 0.06, y1, z - 0.03], [sx - 0.06, y1, z - 0.03]);
    g.quad([l, top - 0.06, z - 0.03], [rr, top - 0.06, z - 0.03], [rr, top + 0.06, z - 0.03], [l, top + 0.06, z - 0.03]);
    x = rr;
  }
  grid(x, x1, y0, y1);
}
// Vành gạch quanh cửa vòm (nhô nhẹ) trên mặt z.
function archBand(g, A, z, bw = 0.3) {
  const r = A.w / 2, n = 8, c = lin(0x8a6452);
  const band = (p0, p1, p2, p3, k) => { g.rgb(c[0] * k, c[1] * k, c[2] * k); g.quad(p0, p1, p2, p3); };
  band([A.cx + r, 0, z], [A.cx + r + bw, 0, z], [A.cx + r + bw, A.hs, z], [A.cx + r, A.hs, z], 0.62);
  band([A.cx - r - bw, 0, z], [A.cx - r, 0, z], [A.cx - r, A.hs, z], [A.cx - r - bw, A.hs, z], 0.62);
  for (let i = 0; i < n; i++) {
    const t0 = (Math.PI * i) / n, t1 = (Math.PI * (i + 1)) / n, R = r + bw;
    band([A.cx + r * Math.cos(t0), A.hs + r * Math.sin(t0), z], [A.cx + R * Math.cos(t0), A.hs + R * Math.sin(t0), z], [A.cx + R * Math.cos(t1), A.hs + R * Math.sin(t1), z], [A.cx + r * Math.cos(t1), A.hs + r * Math.sin(t1), z], 0.68 + 0.22 * hash(i, Math.round(A.cx * 10)));
  }
}
// Lòng cửa vòm thông suốt từ z1 (trước) tới z0 (sau): pháp tuyến hướng vào trong, giữa hầm tối hơn.
function tunnel(g, A, z0, z1, seed) {
  const r = A.w / 2, n = 8, pts = [[A.cx + r, 0, -1, 0], [A.cx + r, A.hs, -1, 0]];
  for (let i = 1; i <= n; i++) { const t = (Math.PI * i) / n; pts.push([A.cx + r * Math.cos(t), A.hs + r * Math.sin(t), -Math.cos(t), -Math.sin(t)]); }
  pts.push([A.cx - r, 0, 1, 0]); pts[n + 1][2] = 1; pts[n + 1][3] = 0;
  const zs = [z0, (z0 + z1) / 2, z1], ks = [0.62, 0.3, 0.62];
  for (let i = 0; i < pts.length - 1; i++) for (let s = 0; s < 2; s++) {
    const p = pts[i], q = pts[i + 1];
    // đoạn thẳng đứng dùng pháp tuyến ngang; đoạn vòm dùng pháp tuyến hướng tâm
    const np = i === 0 ? [-1, 0] : i === pts.length - 2 ? [1, 0] : [p[2], p[3]], nq = i === 0 ? [-1, 0] : i === pts.length - 2 ? [1, 0] : [q[2], q[3]];
    brickCol(g, p[0] + zs[s], p[1], seed, ks[s] * (p[1] < 0.1 ? 0.7 : 1)); const a = g.v(p[0], p[1], zs[s], np[0], np[1], 0);
    brickCol(g, p[0] + zs[s + 1], p[1], seed, ks[s + 1] * (p[1] < 0.1 ? 0.7 : 1)); const b = g.v(p[0], p[1], zs[s + 1], np[0], np[1], 0);
    brickCol(g, q[0] + zs[s + 1], q[1], seed, ks[s + 1]); const c = g.v(q[0], q[1], zs[s + 1], nq[0], nq[1], 0);
    brickCol(g, q[0] + zs[s], q[1], seed, ks[s]); const d = g.v(q[0], q[1], zs[s], nq[0], nq[1], 0);
    g.tri(a, b, c); g.tri(a, c, d);
  }
}
// Một mặt mái ngói cong (nhìn từ +z): diềm mái nửa rộng ea ở z=eb, đỉnh nửa rộng ta ở z=tb; góc mái vênh lên lift.
function roofFace(g, ea, eb, ta, tb, y0, h, lift, under = 0) {
  const nu = 8, nv = 4;
  const P = (i, j) => { const u = (i / nu) * 2 - 1, v = j / nv, w = 1 - v; return [(ea + (ta - ea) * v) * u, y0 + h * Math.pow(v, 1.5) + lift * Math.abs(u * u * u) * w * w, eb + (tb - eb) * v]; };
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    g.color(TILE).shade(0.82 + 0.12 * j + 0.2 * hash(i * 7 + j, Math.round(ea * 10 + y0)));
    g.quad(P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1));
  }
  g.color(WOOD); for (let j = 0; j < under; j++) for (let i = 0; i < nu; i++) g.quad(P(i + 1, j), P(i, j), P(i, j + 1), P(i + 1, j + 1));
  // viền diềm mái (đầu ngói) sáng hơn
  g.color(LIME).shade(0.62); for (let i = 0; i < nu; i++) { const a = P(i, 0), b = P(i + 1, 0); g.quad([a[0], a[1] - 0.12, a[2]], [b[0], b[1] - 0.12, b[2]], [b[0], b[1] + 0.02, b[2] + 0.01], [a[0], a[1] + 0.02, a[2] + 0.01]); }
}
function curvedRoof(g, ea, eb, ta, tb, y0, h, lift, under) {
  for (let f = 0; f < 4; f++) { g.push().rotY((f * Math.PI) / 2); if (f % 2) roofFace(g, eb, ea, tb, ta, y0, h, lift, under); else roofFace(g, ea, eb, ta, tb, y0, h, lift, under); g.pop(); }
  // bờ dải dọc bốn góc mái + đầu đao cong vút
  g.color(LIME).shade(0.8);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    let p = null;
    for (let j = 0; j <= 4; j++) { const v = j / 4, w = 1 - v, q = [sx * (ea + (ta - ea) * v), y0 + h * Math.pow(v, 1.5) + lift * w * w + 0.06, sz * (eb + (tb - eb) * v)]; if (p) g.tube(p, q, 0.09, 4); p = q; }
    const c = [sx * ea, y0 + lift + 0.06, sz * eb];
    g.tube(c, [sx * (ea + 0.3), y0 + lift + 0.28, sz * (eb + 0.3)], 0.09, 4, 0.06); g.tube([sx * (ea + 0.3), y0 + lift + 0.28, sz * (eb + 0.3)], [sx * (ea + 0.46), y0 + lift + 0.7, sz * (eb + 0.46)], 0.06, 4, 0.01);
  }
}
function fanZ(g, pts, z) { const b = g.count; for (const p of pts) g.v(p[0], p[1], z, 0, 0, 1); for (let i = 1; i < pts.length - 1; i++) g.tri(b, b + i, b + i + 1); }
function archPts(cx, y0, w, hs, n = 4) { const hw = w / 2, pts = [[cx - hw, y0], [cx + hw, y0]]; for (let i = 0; i <= 2 * n; i++) { const t = (Math.PI * i) / (2 * n); pts.push([cx + hw * Math.cos(t), y0 + hs + hw * Math.sin(t)]); } return pts; }

export function build(g) {
  g.gloss(0).glow(0).sway(0);

  // ----- khối cổng gạch: hai mặt chính khoét ba cửa vòm, hai mặt hồi đặc -----
  for (const dir of [1, -1]) {
    g.push().rotY(dir > 0 ? 0 : Math.PI);
    const seed = dir > 0 ? 3 : 11;
    brickFace(g, -HW, HW, 0, Y_DECK, HD, ARCHES, seed);
    for (const A of ARCHES) archBand(g, A, HD + 0.08, A.w > 3 ? 0.36 : 0.26);
    // chân tường đá và gờ dưới tường chắn mái
    g.color(0x5b554c); g.box(-HW - 0.12, 0, HD, -ARCHES[0].w / 2 + ARCHES[0].cx - 0.3, 0.45, HD + 0.14, 'YZ'); g.box(ARCHES[2].cx + ARCHES[2].w / 2 + 0.3, 0, HD, HW + 0.12, 0.45, HD + 0.14, 'YZ');
    g.box(ARCHES[0].cx + 1.2, 0, HD, -2.1, 0.45, HD + 0.14, 'YZxX'); g.box(2.1, 0, HD, ARCHES[2].cx - 1.2, 0.45, HD + 0.14, 'YZxX');
    g.color(0x7a5a4a); g.box(-HW - 0.15, Y_DECK - 0.55, HD, HW + 0.15, Y_DECK - 0.3, HD + 0.16, 'YZy'); g.color(0x8a6a58); g.box(-HW - 0.25, Y_DECK - 0.3, HD, HW + 0.25, Y_DECK, HD + 0.28, 'YZy');
    // biển đề ba chữ trên cửa chính (nền vữa bạc, chữ là ba khối tối)
    g.color(0x5a4c42); g.box(-1.75, 5.05, HD, 1.75, 6.45, HD + 0.14, 'xXYZy');
    g.color(0xa39780); g.quad([-1.55, 5.22, HD + 0.16], [1.55, 5.22, HD + 0.16], [1.55, 6.28, HD + 0.16], [-1.55, 6.28, HD + 0.16]);
    g.color(0x7b6f5c); for (const x of [-0.98, 0, 0.98]) {
      const zc = HD + 0.2, q = (xa, ya, xb, yb) => g.quad([x + xa, 5.75 + ya, zc], [x + xb, 5.75 + ya, zc], [x + xb, 5.75 + yb, zc], [x + xa, 5.75 + yb, zc]);
      q(-0.3, 0.24, 0.3, 0.31); q(-0.24, 0.04, 0.24, 0.1); q(-0.3, -0.33, 0.3, -0.26); q(-0.035, -0.33, 0.035, 0.31); q(-0.3, -0.33, -0.24, 0.1); q(0.24, -0.33, 0.3, 0.1);
    }
    // ô trang trí trên hai cửa nhỏ
    for (const sx of [-1, 1]) {
      g.color(0x644a3e); g.box(sx * 5.7 - 1.15, 4.3, HD, sx * 5.7 + 1.15, 5.5, HD + 0.1, 'xXYZy');
      g.color(0x80705e).shade(0.85 + 0.15 * hash(sx + 5, dir + 3)); g.quad([sx * 5.7 - 0.98, 4.46, HD + 0.12], [sx * 5.7 + 0.98, 4.46, HD + 0.12], [sx * 5.7 + 0.98, 5.34, HD + 0.12], [sx * 5.7 - 0.98, 5.34, HD + 0.12]);
    }
    // bia đá cấm lính gác sách nhiễu dân (1882) gắn bên trái cửa chính, mặt trước
    if (dir > 0) { g.color(0x4c4a46); g.box(-3.15, 1.3, HD, -2.35, 2.5, HD + 0.1, 'xXYZy'); g.color(0x6c6a64); g.quad([-3.05, 1.4, HD + 0.12], [-2.45, 1.4, HD + 0.12], [-2.45, 2.4, HD + 0.12], [-3.05, 2.4, HD + 0.12]); }
    g.pop();
  }
  for (const sx of [-1, 1]) {
    g.push().rotY((sx * Math.PI) / 2);
    brickFace(g, -HD, HD, 0, Y_DECK, HW, [], 20 + sx);
    g.color(0x5b554c); g.box(-HD - 0.12, 0, HW, HD + 0.12, 0.45, HW + 0.14, 'YZxX');
    g.color(0x7a5a4a); g.box(-HD - 0.15, Y_DECK - 0.55, HW, HD + 0.15, Y_DECK - 0.3, HW + 0.16, 'YZy'); g.color(0x8a6a58); g.box(-HD - 0.25, Y_DECK - 0.3, HW, HD + 0.25, Y_DECK, HW + 0.28, 'YZy');
    g.pop();
  }
  for (let i = 0; i < 3; i++) tunnel(g, ARCHES[i], -HD, HD, 30 + i);

  // ----- mặt thành và tường chắn có lỗ châu mai -----
  g.color(0x5f5a4c); g.quad([-HW, Y_DECK, HD], [HW, Y_DECK, HD], [HW, Y_DECK, -HD], [-HW, Y_DECK, -HD]);
  const T = 0.42, yM = 8.5;
  for (const dir of [1, -1]) {
    g.push().rotY(dir > 0 ? 0 : Math.PI);
    brickFace(g, -HW, HW, Y_DECK, yM, HD, [], 40 + dir, 0.95);
    g.color(0x5a3a30); g.quad([HW - T, Y_DECK, HD - T], [-HW + T, Y_DECK, HD - T], [-HW + T, yM, HD - T], [HW - T, yM, HD - T]);
    const n = 15, pitch = (2 * HW) / n, mw = pitch * 0.6;
    for (let i = 0; i < n; i++) {
      const x = -HW + (i + 0.5) * pitch; brickCol(g, x, 8.2, 44 + dir, 1.0, 12);
      g.box(x - mw / 2, yM, HD - T, x + mw / 2, Y_TOP, HD, 'xXYZz');
    }
    g.color(0x6a4a3c); g.quad([-HW, yM, HD], [HW, yM, HD], [HW, yM, HD - T], [-HW, yM, HD - T]);
    g.pop();
  }
  for (const sx of [-1, 1]) {
    g.push().rotY((sx * Math.PI) / 2);
    brickFace(g, -HD, HD, Y_DECK, yM, HW, [], 50 + sx, 0.95);
    g.color(0x5a3a30); g.quad([HD - T, Y_DECK, HW - T], [-HD + T, Y_DECK, HW - T], [-HD + T, yM, HW - T], [HD - T, yM, HW - T]);
    const n = 5, pitch = (2 * HD) / n, mw = pitch * 0.6;
    for (let i = 0; i < n; i++) { const x = -HD + (i + 0.5) * pitch; brickCol(g, x, 8.2, 54 + sx, 1.0, 12); g.box(x - mw / 2, yM, HW - T, x + mw / 2, Y_TOP, HW, 'xXYZz'); }
    g.color(0x6a4a3c); g.quad([-HD, yM, HW], [HD, yM, HW], [HD, yM, HW - T], [-HD, yM, HW - T]);
    g.pop();
  }

  // ----- vọng lâu: thân gạch trát vữa, hai tầng mái ngói cong -----
  const PW = 3.1, PD = 2.0, yP = Y_DECK, yE1 = 10.5;
  for (let f = 0; f < 4; f++) {
    g.push().rotY((f * Math.PI) / 2);
    const w = f % 2 ? PD : PW, d = f % 2 ? PW : PD;
    { const c = mix(PLASTER, BRICK_B, 0.35), k = 0.8 + 0.15 * hash(f, 60), b = g.count;
      g.rgb(c[0] * k * 0.7, c[1] * k * 0.7, c[2] * k * 0.7); g.v(-w, yP, d, 0, 0, 1); g.v(w, yP, d, 0, 0, 1);
      g.rgb(c[0] * k, c[1] * k, c[2] * k); g.v(w, yE1 + 0.3, d, 0, 0, 1); g.v(-w, yE1 + 0.3, d, 0, 0, 1); g.tri(b, b + 1, b + 2); g.tri(b, b + 2, b + 3); }
    if (f % 2 === 0) {
      g.color(0x6a5546); fanZ(g, archPts(0, yP, 1.7, 1.45), d + 0.07); g.color(0x17120f); fanZ(g, archPts(0, yP, 1.3, 1.35), d + 0.13);
      for (const x of [-2.1, 2.1]) { g.color(0x6a5546); g.quad([x - 0.45, yP + 0.9, d + 0.07], [x + 0.45, yP + 0.9, d + 0.07], [x + 0.45, yP + 1.9, d + 0.07], [x - 0.45, yP + 1.9, d + 0.07]); g.color(0x17120f); g.quad([x - 0.32, yP + 1.02, d + 0.13], [x + 0.32, yP + 1.02, d + 0.13], [x + 0.32, yP + 1.78, d + 0.13], [x - 0.32, yP + 1.78, d + 0.13]); }
    } else { g.color(0x6a5546); fanZ(g, archPts(0, yP + 0.8, 1.0, 0.6), d + 0.07); g.color(0x17120f); fanZ(g, archPts(0, yP + 0.9, 0.74, 0.55), d + 0.13); }
    g.pop();
  }
  curvedRoof(g, 4.55, 3.45, 2.2, 1.35, yE1, 1.25, 0.55, 2);
  // cổ diêm (tầng trên thấp) và mái trên
  const yU = yE1 + 1.1, yE2 = 12.35;
  g.color(0x5a4638); g.box(-2.0, yU, -1.2, 2.0, yE2 + 0.2, 1.2, 'xXzZ');
  g.color(0x2a211b); for (const dz of [-1, 1]) for (let i = -2; i <= 2; i++) { const x = i * 0.72; if (dz > 0) g.quad([x - 0.24, yU + 0.3, 1.26], [x + 0.24, yU + 0.3, 1.26], [x + 0.24, yE2 - 0.1, 1.26], [x - 0.24, yE2 - 0.1, 1.26]); else g.quad([x + 0.24, yU + 0.3, -1.26], [x - 0.24, yU + 0.3, -1.26], [x - 0.24, yE2 - 0.1, -1.26], [x + 0.24, yE2 - 0.1, -1.26]); }
  curvedRoof(g, 3.2, 2.4, 1.2, 0, yE2, 1.5, 0.5, 2);
  // bờ nóc và đầu kìm
  const yR = yE2 + 1.5;
  g.color(LIME).shade(0.85); g.box(-1.45, yR - 0.08, -0.13, 1.45, yR + 0.3, 0.13);
  for (const sx of [-1, 1]) { g.box(sx * 1.45 - 0.16, yR + 0.1, -0.15, sx * 1.45 + 0.16, yR + 0.62, 0.15); g.tube([sx * 1.45, yR + 0.6, 0], [sx * 1.2, yR + 0.95, 0], 0.1, 4, 0.02); }
  g.color(LIME).shade(0.95); g.push().move(0, yR + 0.3, 0); g.cyl(0, 0, 0, 0.26, 0.16, 0.2, 6, false); g.ball(0, 0.42, 0, 0.24, 6, 4); g.pop();

  // ----- cột cờ và cờ đỏ sao vàng -----
  const fx = 7.2, fz = 0, fy = Y_DECK;
  g.color(0x6b665c); g.cube(fx, fy, fz, 0.5, 0.3, 0.5); g.color(0x8a8f92); g.cyl(fx, fy + 0.3, fz, 0.05, 0.035, 6.0, 6, true);
  const y0 = fy + 4.9, fw = 1.8, fh = 1.2;
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
  g.color(0xffffff).gloss(0).glow(0).sway(0);
}
