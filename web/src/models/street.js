// Đồ vật đường phố Hà Nội dựng thủ tục bằng G (chạy trong worker): cây, cột đèn, cột điện, ghế nhựa...
import { hash } from '../core/util.js';

// Tô tối phần dưới của một khối vừa dựng (giả bóng đổ trong tán cây): nhân màu theo pháp tuyến y.
export function shadeByNormal(g, from, lo = 0.55, hi = 1.05) {
  for (let i = from; i < g.count; i++) { const k = lo + (hi - lo) * (g.nrm[i * 3 + 1] * 0.5 + 0.5); g.col[i * 4] *= k; g.col[i * 4 + 1] *= k; g.col[i * 4 + 2] *= k; }
}

// Loài cây phố Hà Nội. Màu tuyến tính [r,g,b].
export const TREES = {
  xacu: { h: [7.5, 10.5], r: [3.6, 5.0], trunk: 0.34, col: [0.145, 0.323, 0.093], blobs: 6, squash: 0.72 },   // xà cừ: cao, tán rộng
  sau: { h: [6, 8.5], r: [2.8, 3.8], trunk: 0.26, col: [0.085, 0.264, 0.068], blobs: 5, squash: 0.85 },         // sấu: tán dày, xanh thẫm
  bang: { h: [4.5, 6.5], r: [2.6, 3.4], trunk: 0.2, col: [0.187, 0.408, 0.085], blobs: 4, squash: 0.45 },        // bàng: tán xoè tầng
  banglang: { h: [4.5, 6], r: [2.0, 2.8], trunk: 0.17, col: [0.204, 0.425, 0.119], blobs: 4, squash: 0.8, flower: [0.42, 0.2, 0.5] }, // bằng lăng tím
  phuong: { h: [6, 8], r: [3.2, 4.4], trunk: 0.26, col: [0.221, 0.459, 0.102], blobs: 5, squash: 0.5, flower: [0.72, 0.1, 0.04] },    // phượng đỏ
  lieu: { h: [4.5, 6], r: [2.2, 2.8], trunk: 0.18, col: [0.340, 0.561, 0.153], blobs: 5, squash: 1.5, droop: true }, // liễu rủ ven hồ
  hoasua: { h: [6.5, 9], r: [2.4, 3.2], trunk: 0.22, col: [0.153, 0.340, 0.119], blobs: 5, squash: 1.0 },         // hoa sữa: tán cao thành tầng
};
const KINDS = Object.keys(TREES);
export const treeKind = (i) => KINDS[i % KINDS.length];

// Thẻ lá quanh một khối tán tâm (cx,cy,cz), bán kính r: nửa số thẻ nằm tiếp tuyến, nửa xuyên tâm, pháp tuyến hướng ra ngoài
// để tán bắt sáng mềm như một khối tròn. cell: ô trong texture lá (0 lá to, 1 lá nhỏ, 2 liễu, 3 hoa).
function leafCards(lf, cx, cy, cz, r, squash, n, seed, cell, col, swayBase) {
  const u0 = (cell % 2) * 0.5, v0 = cell < 2 ? 0.5 : 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, ph = Math.acos(1 - 1.7 * t), th = i * 2.39996 + hash(seed, i) * 0.8;
    let dx = Math.sin(ph) * Math.cos(th), dy = Math.cos(ph), dz = Math.sin(ph) * Math.sin(th);
    const k = 0.62 + hash(seed, 40 + i) * 0.22, px = cx + dx * r * k, py = cy + dy * r * k * squash, pz = cz + dz * r * k;
    const s = r * (0.72 + hash(seed, 60 + i) * 0.3);
    // hai trục của thẻ
    let ux, uy, uz, vx, vy, vz;
    const a = hash(seed, 80 + i) * 6.283, tx = -dz, tz = dx, tl = Math.hypot(tx, tz) || 1; // tiếp tuyến ngang
    const bx = dy * tz / tl, by = (dz * tx - dx * tz) / tl, bz = -dy * tx / tl;                  // d × t
    if (i % 2) { ux = (tx / tl) * Math.cos(a) + bx * Math.sin(a); uy = by * Math.sin(a); uz = (tz / tl) * Math.cos(a) + bz * Math.sin(a); vx = dx; vy = dy; vz = dz; }
    else { ux = tx / tl; uy = 0; uz = tz / tl; vx = bx * Math.cos(a * 0.2) + dx * 0.25; vy = by * Math.cos(a * 0.2) + dy * 0.25; vz = bz * Math.cos(a * 0.2) + dz * 0.25; }
    const sh = 0.72 + 0.42 * (dy * 0.5 + 0.5) + (hash(seed, 100 + i) - 0.5) * 0.2;
    lf.rgb(col[0] * sh, col[1] * sh, col[2] * sh).sway(swayBase);
    let nx = dx, ny = dy * 0.6 + 0.4, nz = dz; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const fu = hash(seed, 120 + i) < 0.5, ua = fu ? u0 + 0.5 : u0, ub = fu ? u0 : u0 + 0.5;
    const A = lf.v(px - ux * s - vx * s, py - uy * s - vy * s * squash, pz - uz * s - vz * s, nx, ny, nz, ua, v0);
    const B = lf.v(px + ux * s - vx * s, py + uy * s - vy * s * squash, pz + uz * s - vz * s, nx, ny, nz, ub, v0);
    const C = lf.v(px + ux * s + vx * s, py + uy * s + vy * s * squash, pz + uz * s + vz * s, nx, ny, nz, ub, v0 + 0.5);
    const D = lf.v(px - ux * s + vx * s, py - uy * s + vy * s * squash, pz - uz * s + vz * s, nx, ny, nz, ua, v0 + 0.5);
    lf.tri(A, B, C); lf.tri(A, C, D);
  }
  lf.sway(0);
}

// Cây ở (x,z). lod 0: thân, cành, lõi tán tối và các thẻ lá (ghi vào lf); lod 1: một khối tán, thân bốn cạnh.
export function tree(g, x, z, seed, kind = 'sau', lod = 0, y = 0, lf = null) {
  const T = TREES[kind] || TREES.sau, r1 = hash(seed, 1), r2 = hash(seed, 2), r3 = hash(seed, 3);
  const H = T.h[0] + (T.h[1] - T.h[0]) * r1, R = T.r[0] + (T.r[1] - T.r[0]) * r2, tr = T.trunk * (0.8 + r3 * 0.5);
  const crownY = H * (T.droop ? 0.72 : 0.68), lean = (r3 - 0.5) * 0.5, lz = (r1 - 0.5) * 0.4;
  g.push().move(x, y, z).rotY(r2 * 6.283);
  if (lf) { lf.push(); lf.m = g.m.slice(); }
  g.rgb(0.11, 0.085, 0.06).sway(0).gloss(0).glow(0);
  const tint = 0.82 + hash(seed, 9) * 0.36, c = T.col;
  if (lod > 0) {
    g.tube([0, 0, 0], [lean, crownY, lz], tr, 4, tr * 0.6);
    g.rgb(c[0] * tint * 0.8, c[1] * tint * 0.8, c[2] * tint * 0.8).sway(0.6);
    const from = g.count; g.ball(lean, crownY + R * T.squash * 0.35, lz, R * 1.02, 6, 3, T.squash * 0.95, 0.25, seed);
    shadeByNormal(g, from, 0.5, 1.08);
    g.sway(0).pop(); return;
  }
  // gốc xoè, thân, vòng vôi trắng chống sâu (rất Hà Nội)
  g.tube([0, 0, 0], [lean * 0.25, 1.3, lz * 0.25], tr * 1.25, 6, tr);
  g.tube([lean * 0.25, 1.3, lz * 0.25], [lean, crownY, lz], tr, 6, tr * 0.62);
  if (hash(seed, 12) < 0.45) { g.rgb(0.62, 0.62, 0.58); g.tube([0, 0.02, 0], [lean * 0.2, 1.05, lz * 0.2], tr * 1.27, 6, tr * 1.03); g.rgb(0.11, 0.085, 0.06); }
  const nb = T.blobs;
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * 6.283 + hash(seed, 20 + i) * 1.2, rr = i === 0 ? 0 : R * (0.45 + hash(seed, 30 + i) * 0.2);
    const bx = lean + Math.cos(a) * rr, bz = lz + Math.sin(a) * rr;
    const by = crownY + (i === 0 ? R * 0.55 : (hash(seed, 40 + i) - 0.3) * R * 0.45) * (T.droop ? 0.4 : 1);
    const br = R * (i === 0 ? 0.74 : 0.52 + hash(seed, 50 + i) * 0.16);
    if (i > 0) { g.rgb(0.11, 0.085, 0.06).sway(0.15); g.tube([lean, crownY - 0.6, lz], [bx * 0.8 + lean * 0.2, by - br * 0.3, bz * 0.8 + lz * 0.2], tr * 0.42, 4, tr * 0.2); }
    const k = tint * (0.86 + hash(seed, 60 + i) * 0.3);
    const cr = c[0] * k, cg = c[1] * k, cb = c[2] * k, sq = T.squash * (0.9 + hash(seed, 90 + i) * 0.25), sw = T.droop ? 1 : 0.55 + (by / H) * 0.45;
    if (lf) {
      // lõi tán tối để nhìn xuyên qua kẽ lá không thấy trời
      g.rgb(cr * 0.42, cg * 0.42, cb * 0.42).sway(sw);
      g.ball(bx, by - (T.droop ? br * 0.4 : 0), bz, br * 0.78, 6, 3, sq, 0.2, seed + i);
      if (T.droop) leafCards(lf, bx, by - br * 0.9, bz, br * 1.05, 1.5, 9, seed * 7 + i, 2, [cr, cg, cb], 1);
      else {
        leafCards(lf, bx, by, bz, br * 1.08, sq, 12, seed * 7 + i, kind === 'hoasua' || kind === 'banglang' ? 1 : 0, [cr, cg, cb], sw);
        if (T.flower && hash(seed, 70 + i) < 0.6) leafCards(lf, bx, by + br * 0.12, bz, br * 1.12, sq, 5, seed * 13 + i, 3, [T.flower[0] * 1.6, T.flower[1] * 1.6, T.flower[2] * 1.6], sw);
      }
    } else {
      let fr = cr, fg = cg, fb = cb;
      if (T.flower && hash(seed, 70 + i) < 0.55) { const f = 0.35 + hash(seed, 80 + i) * 0.4; fr += (T.flower[0] - fr) * f; fg += (T.flower[1] - fg) * f; fb += (T.flower[2] - fb) * f; }
      g.rgb(fr, fg, fb).sway(sw);
      const from = g.count; g.ball(bx, by - (T.droop ? br * 0.5 : 0), bz, br, 7, 4, sq, 0.32, seed + i);
      shadeByNormal(g, from, 0.5, 1.12);
    }
  }
  g.sway(0).pop(); if (lf) lf.pop();
}

// Đèn đường cao áp: cột thép côn, cần vươn, chóa đèn LED.
export function streetLamp(g, x, z, yaw, tall = true, y = 0) {
  g.push().move(x, y, z).rotY(yaw).gloss(0.4);
  const H = tall ? 8.6 : 5.6, arm = tall ? 1.9 : 1.1;
  g.rgb(0.2, 0.22, 0.23);
  g.cyl(0, 0, 0, 0.13, 0.13, 0.5, 6, false);
  g.cyl(0, 0.5, 0, 0.1, 0.055, H - 0.5, 6, false);
  g.tube([0, H - 0.05, 0], [arm, H + 0.28, 0], 0.045, 5);
  g.rgb(0.3, 0.32, 0.33).box(arm - 0.15, H + 0.2, -0.14, arm + 0.55, H + 0.33, 0.14);
  g.rgb(1, 0.86, 0.6).glow(1).quad([arm - 0.1, H + 0.19, -0.11], [arm + 0.5, H + 0.19, -0.11], [arm + 0.5, H + 0.19, 0.11], [arm - 0.1, H + 0.19, 0.11]);
  g.glow(0).gloss(0).pop();
  return [arm * Math.cos(yaw), H, -arm * Math.sin(yaw)]; // vị trí bóng đèn so với gốc cột
}

// Đèn vườn kiểu cổ quanh Hồ Gươm: cột gang đen, chụp cầu trắng.
export function parkLamp(g, x, z, y = 0) {
  g.push().move(x, y, z).gloss(0.3).rgb(0.05, 0.06, 0.055);
  g.cyl(0, 0, 0, 0.14, 0.09, 0.45, 6, false).cyl(0, 0.45, 0, 0.05, 0.04, 2.75, 6, false).cyl(0, 3.2, 0, 0.11, 0.07, 0.1, 6, true);
  g.rgb(1, 0.93, 0.78).glow(1).ball(0, 3.52, 0, 0.23, 7, 4);
  g.glow(0).gloss(0).pop();
}
