// Đồ vật đường phố Hà Nội dựng thủ tục bằng G (chạy trong worker): cây, cột đèn, cột điện, ghế nhựa...
import { hash } from '../core/util.js';
import { MAT } from '../core/geo.js';
import { SIG, INK_RED, INK_YELLOW } from '../world/streetnames.js';

// Tô tối phần dưới của một khối vừa dựng (giả bóng đổ trong tán cây): nhân màu theo pháp tuyến y.
export function shadeByNormal(g, from, lo = 0.55, hi = 1.05) {
  for (let i = from; i < g.count; i++) { const k = lo + (hi - lo) * (g.nrm[i * 3 + 1] * 0.5 + 0.5); g.col[i * 4] *= k; g.col[i * 4 + 1] *= k; g.col[i * 4 + 2] *= k; }
}

// Loài cây phố Hà Nội. Màu tuyến tính [r,g,b].
export const TREES = {
  xacu: { h: [7.5, 10.5], r: [3.6, 5.0], trunk: 0.34, col: [0.145, 0.323, 0.093], blobs: 6, squash: 0.72, bark: [0.17, 0.135, 0.1] },   // xà cừ: cao, tán rộng
  sau: { h: [6, 8.5], r: [2.8, 3.8], trunk: 0.26, col: [0.085, 0.264, 0.068], blobs: 5, squash: 0.85, bark: [0.14, 0.11, 0.08] },         // sấu: tán dày, xanh thẫm
  bang: { h: [4.5, 6.5], r: [2.6, 3.4], trunk: 0.2, col: [0.187, 0.408, 0.085], blobs: 4, squash: 0.45, bark: [0.18, 0.155, 0.125] },        // bàng: tán xoè tầng
  banglang: { h: [4.5, 6], r: [2.0, 2.8], trunk: 0.17, col: [0.204, 0.425, 0.119], blobs: 4, squash: 0.8, flower: [0.42, 0.2, 0.5], bark: [0.25, 0.2, 0.15] }, // bằng lăng tím
  phuong: { h: [6, 8], r: [3.2, 4.4], trunk: 0.26, col: [0.221, 0.459, 0.102], blobs: 5, squash: 0.5, flower: [0.72, 0.1, 0.04], bark: [0.2, 0.17, 0.135] },    // phượng đỏ
  lieu: { h: [4.5, 6], r: [2.2, 2.8], trunk: 0.18, col: [0.340, 0.561, 0.153], blobs: 5, squash: 1.5, droop: true, bark: [0.11, 0.085, 0.06] }, // liễu rủ ven hồ
  hoasua: { h: [6.5, 9], r: [2.4, 3.2], trunk: 0.22, col: [0.153, 0.340, 0.119], blobs: 5, squash: 1.0, flower: [0.4, 0.47, 0.3], bark: [0.19, 0.17, 0.145] }, // hoa sữa: tán cao thành tầng, cuối thu nở chùm hoa trắng xanh
  // --- theo từng phố (docs/18, mục 6) ---
  nhoi: { h: [8, 11], r: [3.4, 4.6], trunk: 0.3, col: [0.11, 0.3, 0.075], blobs: 6, squash: 0.8, bark: [0.2, 0.15, 0.11] },               // nhội (Phan Đình Phùng đoạn đông, Trần Hưng Đạo): cao, tán tròn dày
  xacuco: { h: [13, 17], r: [5.6, 7.2], trunk: 0.52, col: [0.13, 0.3, 0.085], blobs: 7, squash: 0.7, bark: [0.17, 0.135, 0.1] },          // xà cừ cổ thụ phố Hoàng Diệu: thân Ø hơn 1 m, tán trùm cả lòng đường
  comnguoi: { h: [6, 8], r: [2.6, 3.4], trunk: 0.2, col: [0.4, 0.4, 0.085], blobs: 5, squash: 0.85, bark: [0.3, 0.28, 0.24] },           // cơm nguội vàng (Lý Thường Kiệt): cuối năm lá ngả vàng
  da: { h: [7, 9.5], r: [4.2, 5.6], trunk: 0.5, col: [0.09, 0.25, 0.07], blobs: 6, squash: 0.55, bark: [0.22, 0.2, 0.17], roots: true },   // đa, si: gốc to nhiều rễ phụ buông, tán thấp xoè rộng
  locvung: { h: [4.5, 6], r: [3, 4], trunk: 0.24, col: [0.16, 0.36, 0.08], blobs: 5, squash: 0.6, flower: [0.6, 0.06, 0.08], bark: [0.16, 0.13, 0.1] }, // lộc vừng ven Hồ Gươm: tháng 10-11 buông hoa đỏ
  non: { h: [3.6, 4.6], r: [0.9, 1.3], trunk: 0.055, col: [0.2, 0.45, 0.1], blobs: 3, squash: 1.1, bark: [0.25, 0.2, 0.14], stakes: true }, // cây non trồng dặm sau bão Yagi, có ba cọc chống
};
const KINDS = Object.keys(TREES);
export const treeKind = (i) => KINDS[i % KINDS.length];

// Thẻ lá quanh một khối tán tâm (cx,cy,cz), bán kính r. cell: ô trong texture lá (0 lá to, 1 lá nhỏ, 2 liễu, 3 hoa).
// Mỗi thẻ quay một hướng riêng (pháp tuyến = hướng ra ngoài tán trộn với một hướng ngẫu nhiên) nên không có hai thẻ song song,
// và được GẬP theo đường chéo thành hình mái (hai tam giác lệch nhau 40-60 độ): nhìn từ hướng nào cũng còn ít nhất nửa thẻ
// quay mặt về mắt, hết cảnh cả thẻ nằm nghiêng thành vệt sọc. Pháp tuyến chiếu sáng vẫn hướng ra ngoài tán cho bóng đổ mềm.
// hang: thẻ treo đứng (sợi liễu rủ), mép trên của ô texture luôn ở trên.
function leafCards(lf, cx, cy, cz, r, squash, n, seed, cell, col, swayBase, hang = false) {
  const u0 = (cell % 2) * 0.5, v0 = cell < 2 ? 0.5 : 0, sy = hang ? Math.min(1.5, squash) : 1;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, ph = Math.acos(1 - 1.7 * t), th = i * 2.39996 + hash(seed, i) * 0.8;
    const dx = Math.sin(ph) * Math.cos(th), dy = Math.cos(ph), dz = Math.sin(ph) * Math.sin(th);
    const k = 0.62 + hash(seed, 40 + i) * 0.22, px = cx + dx * r * k, py = cy + dy * r * k * squash, pz = cz + dz * r * k;
    const s = r * (0.72 + hash(seed, 60 + i) * 0.3), a = hash(seed, 80 + i) * 6.283;
    // m: pháp tuyến thẻ; u, v: hai trục trong mặt thẻ
    let mx, my, mz, ux, uy, uz;
    if (hang) {
      mx = dx * 0.5 + Math.cos(a); my = (hash(seed, 140 + i) - 0.5) * 0.5; mz = dz * 0.5 + Math.sin(a);
      const ml = Math.hypot(mx, my, mz) || 1; mx /= ml; my /= ml; mz /= ml;
      ux = mz; uy = 0; uz = -mx; // phương ngang: v = m × u hướng lên
    } else {
      const qy = hash(seed, 140 + i) * 2 - 1, qr = Math.sqrt(1 - qy * qy), b = hash(seed, 160 + i) * 6.283;
      mx = dx * 0.6 + qr * Math.cos(b); my = dy * 0.45 + qy * 0.6; mz = dz * 0.6 + qr * Math.sin(b); // hơi ngả về phương ngang: người đi đường nhìn tán từ bên cạnh
      const ml = Math.hypot(mx, my, mz); if (ml < 0.05) { mx = dx; my = dy; mz = dz; } else { mx /= ml; my /= ml; mz /= ml; }
      // một hướng bất kỳ trong mặt thẻ: chiếu (cos a, 0.3, sin a) xuống mặt phẳng vuông góc với m
      const ex = Math.cos(a), ey = 0.3, ez = Math.sin(a), em = ex * mx + ey * my + ez * mz;
      ux = ex - mx * em; uy = ey - my * em; uz = ez - mz * em;
    }
    const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    const vx = my * uz - mz * uy, vy = mz * ux - mx * uz, vz = mx * uy - my * ux;
    const sh = 0.72 + 0.42 * (dy * 0.5 + 0.5) + (hash(seed, 100 + i) - 0.5) * 0.2;
    lf.rgb(col[0] * sh, col[1] * sh, col[2] * sh).sway(swayBase);
    let nx = dx, ny = dy * 0.6 + 0.4, nz = dz; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const fu = hash(seed, 120 + i) < 0.5, ua = fu ? u0 + 0.5 : u0, ub = fu ? u0 : u0 + 0.5;
    // gập: hai góc B, D lùi vào trong theo −m; sống mái là đường chéo A–C
    const f = s * (hang ? 0.35 : 0.75 + hash(seed, 180 + i) * 0.3), fx = -mx * f, fy = -my * f * sy, fz = -mz * f;
    const A = lf.v(px - ux * s - vx * s, py + (-uy - vy) * s * sy, pz - uz * s - vz * s, nx, ny, nz, ua, v0);
    const B = lf.v(px + ux * s - vx * s + fx, py + (uy - vy) * s * sy + fy, pz + uz * s - vz * s + fz, nx, ny, nz, ub, v0);
    const C = lf.v(px + ux * s + vx * s, py + (uy + vy) * s * sy, pz + uz * s + vz * s, nx, ny, nz, ub, v0 + 0.5);
    const D = lf.v(px - ux * s + vx * s + fx, py + (-uy + vy) * s * sy + fy, pz - uz * s + vz * s + fz, nx, ny, nz, ua, v0 + 0.5);
    lf.tri(A, B, C); lf.tri(A, C, D);
  }
  lf.sway(0);
}

// Cây ở (x,z). lod 0: thân, cành, lõi tán tối và các thẻ lá (ghi vào lf); lod 1: một khối tán, thân bốn cạnh.
// lime: gốc quét vôi trắng (1 có, 0 không, -1 tuỳ hạt giống). Dải vôi cao 1,2 m, có cả ở bản xa để nhìn từ xa vẫn ra hàng cây Hà Nội.
const LIME_H = 1.2;
export function tree(g, x, z, seed, kind = 'sau', lod = 0, y = 0, lf = null, lime = -1) {
  const T = TREES[kind] || TREES.sau, r1 = hash(seed, 1), r2 = hash(seed, 2), r3 = hash(seed, 3);
  const H = T.h[0] + (T.h[1] - T.h[0]) * r1, R = T.r[0] + (T.r[1] - T.r[0]) * r2, tr = T.trunk * (0.8 + r3 * 0.5);
  const crownY = H * (T.droop ? 0.72 : 0.68), lean = (r3 - 0.5) * 0.5, lz = (r1 - 0.5) * 0.4;
  g.push().move(x, y, z).rotY(r2 * 6.283);
  if (lf) { lf.push(); lf.m = g.m.slice(); }
  const bk = T.bark || [0.11, 0.085, 0.06], bark = () => g.rgb(bk[0], bk[1], bk[2]).mat(MAT.wood); // vỏ cây: thớ dọc, khe nứt
  bark().sway(0).gloss(0).glow(0);
  const tint = 0.82 + hash(seed, 9) * 0.36, c = T.col;
  const limed = !T.stakes && !T.roots && (lime < 0 ? hash(seed, 12) < 0.45 : lime > 0);
  if (lod > 0) {
    if (limed) { const k = LIME_H / crownY; g.mat().rgb(0.66, 0.66, 0.62).tube([0, 0, 0], [lean * k, LIME_H, lz * k], tr * 1.2, 4, tr * 1.02); bark().tube([lean * k, LIME_H, lz * k], [lean, crownY, lz], tr, 4, tr * 0.6); }
    else g.tube([0, 0, 0], [lean, crownY, lz], tr, 4, tr * 0.6);
    g.mat().rgb(c[0] * tint * 0.8, c[1] * tint * 0.8, c[2] * tint * 0.8).sway(0.6);
    const from = g.count; g.ball(lean, crownY + R * T.squash * 0.35, lz, R * 1.02, 6, 3, T.squash * 0.95, 0.25, seed);
    shadeByNormal(g, from, 0.5, 1.08);
    g.sway(0).pop(); return;
  }
  // gốc xoè, thân, vòng vôi trắng chống sâu (rất Hà Nội)
  // (vòng vôi là chính đoạn gốc đổi màu, không ốp chồng lên thân: hai mặt gần trùng nhau sẽ nhấp nháy)
  const yl = LIME_H, kl = yl / 1.3, rl = tr * 1.04;
  if (limed) { g.rgb(0.86, 0.86, 0.82).mat(MAT.plaster).tube([0, 0, 0], [lean * 0.25 * kl, yl, lz * 0.25 * kl], tr * 1.3, 6, rl); bark().tube([lean * 0.25 * kl, yl, lz * 0.25 * kl], [lean * 0.25, 1.3, lz * 0.25], rl, 6, tr); }
  else g.tube([0, 0, 0], [lean * 0.25, 1.3, lz * 0.25], tr * 1.25, 6, tr);
  g.tube([lean * 0.25, 1.3, lz * 0.25], [lean, crownY, lz], tr, 6, tr * 0.62);
  if (T.roots) { // rễ phụ của đa, si: vài sợi buông từ cành xuống đất quanh gốc, và bạnh gốc
    for (let i = 0; i < 5; i++) { const a = hash(seed, 200 + i) * 6.283, rr = tr * (1.5 + hash(seed, 210 + i) * 2.6), top = crownY * (0.62 + hash(seed, 220 + i) * 0.3); g.tube([Math.cos(a) * rr, 0, Math.sin(a) * rr], [lean * 0.6 + Math.cos(a) * rr * 0.75, top, lz * 0.6 + Math.sin(a) * rr * 0.75], 0.05 + hash(seed, 230 + i) * 0.05, 3, 0.03); }
    for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.283 + hash(seed, 240) * 1.5; g.tube([Math.cos(a) * tr * 1.9, 0, Math.sin(a) * tr * 1.9], [Math.cos(a) * tr * 0.5, 1.5, Math.sin(a) * tr * 0.5], tr * 0.42, 4, tr * 0.2); }
  }
  if (T.stakes) { // ba cọc tre chống và đai buộc
    g.mat(MAT.wood).rgb(0.42, 0.33, 0.17);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * 6.283 + 0.4; g.tube([Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62], [lean * 0.3 + Math.cos(a) * 0.07, 1.75, lz * 0.3 + Math.sin(a) * 0.07], 0.028, 3); }
    g.mat().rgb(0.05, 0.05, 0.05).cyl(lean * 0.28, 1.6, lz * 0.28, 0.09, 0.09, 0.07, 5, false);
  }
  const nb = T.blobs;
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * 6.283 + hash(seed, 20 + i) * 1.2, rr = i === 0 ? 0 : R * (0.45 + hash(seed, 30 + i) * 0.2);
    const bx = lean + Math.cos(a) * rr, bz = lz + Math.sin(a) * rr;
    const by = crownY + (i === 0 ? R * 0.55 : (hash(seed, 40 + i) - 0.3) * R * 0.45) * (T.droop ? 0.4 : 1);
    const br = R * (i === 0 ? 0.74 : 0.52 + hash(seed, 50 + i) * 0.16);
    if (i > 0) { bark().sway(0.15); g.tube([lean, crownY - 0.6, lz], [bx * 0.8 + lean * 0.2, by - br * 0.3, bz * 0.8 + lz * 0.2], tr * 0.42, 4, tr * 0.2); }
    const k = tint * (0.86 + hash(seed, 60 + i) * 0.3);
    const cr = c[0] * k, cg = c[1] * k, cb = c[2] * k, sq = T.squash * (0.9 + hash(seed, 90 + i) * 0.25), sw = T.droop ? 1 : 0.55 + (by / H) * 0.45;
    g.mat();
    if (lf) {
      // lõi tán tối để nhìn xuyên qua kẽ lá không thấy trời
      g.rgb(cr * 0.42, cg * 0.42, cb * 0.42).sway(sw);
      g.ball(bx, by - (T.droop ? br * 0.4 : 0), bz, br * 0.78, 6, 3, sq, 0.2, seed + i);
      if (T.droop) leafCards(lf, bx, by - br * 0.9, bz, br * 1.05, 1.5, 9, seed * 7 + i, 2, [cr, cg, cb], 1, true);
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
  g.mat().sway(0).pop(); if (lf) lf.pop();
}

// Đèn đường cao áp: đế bê tông, chân cột có cửa thăm, cột thép mạ kẽm côn, cần vươn cong, chóa đèn LED dẹt.
// Trả về vị trí bóng đèn so với gốc cột (để đặt vệt sáng trên mặt đường).
export function streetLamp(g, x, z, yaw, tall = true, y = 0) {
  g.push().move(x, y, z).rotY(yaw).glow(0);
  const H = tall ? 8.6 : 5.6, arm = tall ? 1.9 : 1.1;
  g.rgb(0.42, 0.42, 0.4).gloss(0).mat(MAT.concrete).cube(0, 0, 0, 0.4, 0.1, 0.4, 'xXYzZ');
  g.rgb(0.3, 0.32, 0.33).gloss(0.3).mat(MAT.rust).cyl(0, 0.1, 0, 0.125, 0.115, 0.95, 6, true); // chân cột hay hoen gỉ
  g.rgb(0.36, 0.38, 0.39).gloss(0.45).mat();
  g.cyl(0, 1.05, 0, 0.09, 0.05, H - 1.1, 6, false);
  // cần đèn uốn cong lên rồi vươn ngang
  const a0 = [0, H - 0.08, 0], a1 = [arm * 0.22, H + 0.2, 0], a2 = [arm * 0.62, H + 0.31, 0], a3 = [arm + 0.02, H + 0.29, 0];
  g.tube(a0, a1, 0.048, 5, 0.042).tube(a1, a2, 0.042, 5, 0.038).tube(a2, a3, 0.038, 5, 0.036);
  // chóa đèn: thân dẹt, dày ở cổ, mỏng dần ra đầu
  g.rgb(0.25, 0.27, 0.28).gloss(0.5).push().rotX(-Math.PI / 2);
  g.prism([[arm - 0.15, H + 0.22], [arm + 0.55, H + 0.2], [arm + 0.56, H + 0.25], [arm + 0.15, H + 0.34], [arm - 0.15, H + 0.33]], -0.14, 0.14, true, true).pop();
  g.rgb(1, 0.86, 0.6).glow(1).gloss(0.2).quad([arm - 0.08, H + 0.185, -0.11], [arm + 0.5, H + 0.185, -0.11], [arm + 0.5, H + 0.185, 0.11], [arm - 0.08, H + 0.185, 0.11]);
  g.glow(0).gloss(0).pop();
  return [arm * Math.cos(yaw), H, -arm * Math.sin(yaw)]; // vị trí bóng đèn so với gốc cột
}

// Đèn vườn kiểu cổ quanh Hồ Gươm: cột gang đúc sơn đen (đế loe nhiều gờ, thân thon, đài đỡ), chụp cầu thuỷ tinh mờ.
export function parkLamp(g, x, z, y = 0) {
  g.push().move(x, y, z).glow(0).gloss(0.35).rgb(0.045, 0.06, 0.055).mat(MAT.lacquer);
  g.lathe(0, 0, 0, [[0.17, 0], [0.17, 0.07], [0.12, 0.13], [0.11, 0.42], [0.065, 0.55], [0.05, 0.62], [0.036, 2.96], [0.07, 3.02], [0.036, 3.1], [0.036, 3.2], [0.1, 3.29], [0.12, 3.3]], 6);
  g.cyl(0, 3.71, 0, 0.06, 0, 0.1, 6, false); // chóp trên chụp đèn
  g.mat().rgb(1, 0.93, 0.78).glow(1).gloss(0.3).ball(0, 3.52, 0, 0.23, 8, 5);
  g.glow(0).gloss(0).pop();
}

// =====================================================================================================================
// Đồ đạc đường phố Hà Nội 2026 (docs/18, mục 2). Mỗi hàm nhận g (lưới đồ vật thường) và, nếu có chữ hay đèn đổi pha,
// pg: lưới riêng dùng "bảng đồ đạc" (world/streetnames.js, streetatlas.js). Trong pg, màu đỉnh là màu NỀN, bảng chữ chỉ
// cho biết chỗ nào có nét chữ; kênh alpha của màu đỉnh mang mã để shader chọn màu chữ hoặc bật tắt bóng đèn tín hiệu.
// =====================================================================================================================

// Biển chữ nhật trong mặt phẳng XY cục bộ: x từ x0 tới x0+w, y từ y0 tới y0+h, mặt chữ quay về +z ở độ sâu o.z.
// o.back: mặt sau cũng có chữ (biển treo cột, đọc được từ hai phía); o.code: mã màu chữ; o.rot: ô chữ vẽ xoay 90 độ.
export function signPlate(pg, x0, y0, w, h, uv, bg, o = {}) {
  const z = o.z ?? 0.012, back = o.back !== false, zb = back ? -z : 0, x1 = x0 + w, y1 = y0 + h, q = o.rot ? quadRot : (g, a, b, c, d, u) => g.quad(a, b, c, d, u);
  pg.color(bg, (o.code || 0) / 255).gloss(o.gloss ?? 0.25).glow(o.glow ?? 0.2);
  q(pg, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], uv);
  if (back) q(pg, [x1, y0, zb], [x0, y0, zb], [x0, y1, zb], [x1, y1, zb], uv);
  pg.shade(0.55).box(x0, y0, zb, x1, y1, z, 'xXyY').glow(0).gloss(0); // mép biển
}
// Như G.quad nhưng ô chữ xoay 90 độ: chiều đứng của biển chạy dọc chiều ngang của ô (cho biển đứng trong ô nằm).
function quadRot(g, p0, p1, p2, p3, uv) {
  const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  const a = g.v(p0[0], p0[1], p0[2], nx, ny, nz, uv[0], uv[3]), b = g.v(p1[0], p1[1], p1[2], nx, ny, nz, uv[0], uv[1]);
  const c = g.v(p2[0], p2[1], p2[2], nx, ny, nz, uv[2], uv[1]), d = g.v(p3[0], p3[1], p3[2], nx, ny, nz, uv[2], uv[3]);
  g.idx.push(a, b, c, a, c, d);
}
// Đĩa tròn đứng, mặt quay về +z (bóng đèn, bông hoa vẽ trên tủ điện).
function faceDisc(g, x, y, z, r, seg = 8) { g.push().move(x, y, z).rotX(Math.PI / 2).disc(0, 0, 0, r, seg, 1).pop(); }

// Cột biển tên phố: thép tròn Ø 10 cm, đỉnh cao 2,6 m, hai đai kẹp biển. Biển gắn sau bằng signPlate.
export function namePole(g, x, z, y = 0) {
  g.push().move(x, y, z).glow(0).mat();
  g.rgb(0.3, 0.3, 0.29).gloss(0).cyl(0, 0, 0, 0.1, 0.085, 0.06, 6, true);
  g.rgb(0.33, 0.35, 0.37).gloss(0.4).cyl(0, 0.06, 0, 0.052, 0.048, 2.56, 6, false).cyl(0, 2.62, 0, 0.06, 0.02, 0.05, 6, true);
  g.rgb(0.2, 0.21, 0.22).cyl(0, 2.2, 0, 0.062, 0.062, 0.05, 6, false).cyl(0, 2.47, 0, 0.062, 0.062, 0.05, 6, false);
  g.gloss(0).pop();
}

// ----- đèn tín hiệu -----
const SIG_COL = [null, [0.95, 0.012, 0.006], [1, 0.48, 0.0], [0.0, 0.85, 0.28]];
// ba bóng xếp dọc: đỏ trên, vàng giữa, xanh dưới. code(kind) trả về mã (0..255) của bộ phận trong pha đèn của nhánh này.
function lampStack(g, pg, x, yTop, z, r, gap, code, hood) {
  for (let k = 0; k < 3; k++) {
    const ly = yTop - k * gap, c = SIG_COL[k + 1];
    if (hood) g.box(x - r - 0.05, ly + r + 0.015, z - 0.008, x + r + 0.05, ly + r + 0.04, z + hood, 'yYZ');
    pg.rgb(c[0], c[1], c[2], code(k + 1) / 255); faceDisc(pg, x, ly, z, r);
  }
}
// hai chữ số đếm ngược (ô chữ số 0 của bảng; shader tự dịch sang chữ số đang đếm)
function countdown(pg, cx, cy, z, w, h, code, uv) {
  const y0 = cy - h / 2, y1 = cy + h / 2;
  pg.rgb(0, 0, 0, code(SIG.tens) / 255).quad([cx - w - 0.012, y0, z], [cx - 0.012, y0, z], [cx - 0.012, y1, z], [cx - w - 0.012, y1, z], uv);
  pg.rgb(0, 0, 0, code(SIG.units) / 255).quad([cx + 0.012, y0, z], [cx + w + 0.012, y0, z], [cx + w + 0.012, y1, z], [cx + 0.012, y1, z], uv);
}
// Cột đèn tín hiệu nút lớn: cột thép mạ 6,2 m, cần vươn o.arm mét mang cụm ba bóng Ø 30 và hộp đếm ngược, đèn lặp Ø 20 trên
// thân cột, đèn đi bộ quay sang bên kia đường. Gốc ở chân cột trên vỉa hè; +z cục bộ là hướng mặt đèn (về phía xe đang tới),
// cần vươn về -x (ra giữa lòng đường). L: bố cục bảng đồ đạc.
export function signalMast(g, pg, x, z, y, yaw, o) {
  const La = o.arm, code = o.code, L = o.L;
  g.push().move(x, y, z).rotY(yaw).glow(0).mat(); pg.push(); pg.m = g.m.slice(); pg.gloss(0).glow(0);
  g.rgb(0.42, 0.42, 0.4).mat(MAT.concrete).cube(0, 0, 0, 0.46, 0.12, 0.46, 'xXYzZ').mat();
  g.rgb(0.36, 0.38, 0.4).gloss(0.4).cyl(0, 0.12, 0, 0.11, 0.075, 6.1, 6, true);
  g.tube([0, 5.9, 0], [-La - 0.1, 6.12, 0], 0.062, 5, 0.045).tube([0, 5.0, 0], [-La * 0.32, 5.97, 0], 0.03, 4);
  // cụm đèn chính treo đầu cần, hộp đếm ngược bên cạnh
  const hx = -La + 0.05, hz = 0.07;
  g.rgb(0.025, 0.028, 0.03).gloss(0.2).box(hx - 0.21, 5.02, hz, hx + 0.21, 6.26, hz + 0.26);
  lampStack(g, pg, hx, 6.04, hz + 0.27, 0.15, 0.41, code, 0.2);
  const bx = hx + 0.55; g.box(bx - 0.28, 5.5, hz + 0.02, bx + 0.28, 6.02, hz + 0.24);
  countdown(pg, bx, 5.76, hz + 0.25, 0.22, 0.38, code, L.digit);
  // đèn lặp trên thân cột
  g.box(-0.13, 2.52, 0.08, 0.13, 3.3, 0.26); lampStack(g, pg, 0, 3.16, 0.27, 0.1, 0.25, code, 0.1);
  // đèn đi bộ: hình người đỏ đứng, xanh bước; quay về -x cho người đứng ở vỉa hè đối diện
  if (o.ped !== false) {
    g.box(-0.32, 2.02, -0.14, -0.13, 2.6, 0.14);
    const f = (ya, yb, kind, uv) => pg.rgb(0, 0, 0, code(kind) / 255).quad([-0.33, ya, -0.11], [-0.33, ya, 0.11], [-0.33, yb, 0.11], [-0.33, yb, -0.11], uv);
    f(2.33, 2.57, SIG.pedStop, L.pedStop); f(2.05, 2.29, SIG.pedGo, L.pedGo);
  }
  g.gloss(0).pop(); pg.pop();
}
// Cột đèn tín hiệu nút nhỏ (phố cổ): cột thẳng 3,4 m ở mép vỉa hè, cụm ba bóng Ø 20 trên đỉnh, hộp đếm ngược bên cạnh.
export function signalPost(g, pg, x, z, y, yaw, o) {
  const code = o.code, L = o.L;
  g.push().move(x, y, z).rotY(yaw).glow(0).mat(); pg.push(); pg.m = g.m.slice(); pg.gloss(0).glow(0);
  g.rgb(0.36, 0.38, 0.4).gloss(0.4).cyl(0, 0, 0, 0.075, 0.06, 2.55, 6, false);
  g.rgb(0.025, 0.028, 0.03).gloss(0.2).box(-0.15, 2.5, -0.1, 0.15, 3.42, 0.1);
  lampStack(g, pg, 0, 3.24, 0.11, 0.1, 0.29, code, 0.1);
  g.box(-0.56, 2.94, -0.08, -0.18, 3.34, 0.08); countdown(pg, -0.37, 3.14, 0.09, 0.15, 0.27, code, L.digit);
  g.gloss(0).pop(); pg.pop();
}
// bản xa của cột đèn tín hiệu: cột, cần, hộp đèn
export function signalFar(g, x, z, y, yaw, arm) {
  g.push().move(x, y, z).rotY(yaw).rgb(0.3, 0.32, 0.34).cyl(0, 0, 0, 0.11, 0.08, 6.2, 3, false);
  if (arm) g.box(-arm, 5.95, -0.05, 0, 6.08, 0.05, 'yYzZ').rgb(0.03, 0.03, 0.03).box(-arm - 0.16, 5.02, 0.07, -arm + 0.26, 6.26, 0.33);
  g.pop();
}

// ----- tủ điện, trạm biến áp -----
function sunflower(g, x, y, z, r) { // hoa hướng dương vẽ trên tủ: cánh vàng, nhuỵ nâu, cuống xanh
  g.rgb(0.12, 0.3, 0.06).box(x - 0.012, y - r * 3.4, z, x + 0.012, y, z + 0.002, 'Z').box(x, y - r * 2.2, z, x + r * 0.9, y - r * 1.7, z + 0.002, 'Z');
  g.rgb(0.95, 0.62, 0.02); faceDisc(g, x, y, z + 0.004, r, 8);
  g.rgb(0.2, 0.09, 0.03); faceDisc(g, x, y, z + 0.008, r * 0.42, 6);
}
// Tủ phân phối, tủ cáp: hộp thép xám kem 0,8 × 0,4 × 1,4 m trên bệ bê tông. Cửa quay về +z. art: vẽ hoa (nhiều tủ nội thành được vẽ từ 2020).
export function cabinet(g, x, z, y, yaw, seed, art = false) {
  g.push().move(x, y, z).rotY(yaw).glow(0);
  g.rgb(0.4, 0.4, 0.38).mat(MAT.concrete).cube(0, 0, 0, 0.92, 0.12, 0.52, 'xXYzZ').mat();
  const k = 0.88 + hash(seed, 1) * 0.2;
  if (art) g.rgb(0.12 * k, 0.42 * k, 0.62 * k); else g.rgb(0.6 * k, 0.58 * k, 0.5 * k); // #CFCBBE, hoặc nền xanh da trời của tranh hoa
  g.gloss(0.15).box(-0.4, 0.12, -0.2, 0.4, 1.5, 0.2, 'xXzZ');
  g.shade(0.75).box(-0.44, 1.5, -0.24, 0.44, 1.56, 0.24).gloss(0);
  g.rgb(0.1, 0.1, 0.1).box(-0.008, 0.2, 0.2, 0.008, 1.44, 0.204, 'Z').rgb(0.25, 0.25, 0.25).box(0.05, 0.78, 0.2, 0.09, 0.9, 0.225, 'xXyYZ'); // khe cửa, tay nắm
  if (art) { sunflower(g, -0.2, 1.12, 0.2, 0.13); sunflower(g, 0.18, 0.92, 0.2, 0.11); }
  else { g.rgb(0.9, 0.68, 0.02).tri3([-0.3, 1.14, 0.204], [-0.1, 1.14, 0.204], [-0.2, 1.31, 0.204]); g.rgb(0.05, 0.05, 0.05).box(-0.208, 1.18, 0.206, -0.192, 1.26, 0.208, 'Z'); } // tem tam giác vàng cảnh báo điện
  g.pop();
}
// Trạm biến áp kiosk: hộp thép 2 × 1,5 × 2 m xám hoặc xanh rêu, mái nhô, cửa chớp thông gió, biển tam giác vàng và biển chữ cảnh báo.
// Mặt cửa quay về +z. uvWarn: ô chữ "CẤM LẠI GẦN! CÓ ĐIỆN NGUY HIỂM CHẾT NGƯỜI".
export function kiosk(g, pg, x, z, y, yaw, seed, uvWarn) {
  g.push().move(x, y, z).rotY(yaw).glow(0); pg.push(); pg.m = g.m.slice();
  const green = hash(seed, 1) < 0.5, art = hash(seed, 2) < 0.35;
  g.rgb(0.4, 0.4, 0.38).mat(MAT.concrete).cube(0, 0, 0, 2.16, 0.16, 1.66, 'xXYzZ').mat();
  if (green) g.rgb(0.12, 0.2, 0.13); else g.rgb(0.42, 0.44, 0.44);
  g.gloss(0.15).box(-1, 0.16, -0.75, 1, 2.06, 0.75, 'xXzZ').shade(0.7).box(-1.08, 2.06, -0.83, 1.08, 2.16, 0.83).gloss(0);
  g.rgb(0.05, 0.05, 0.05).box(-0.008, 0.24, 0.75, 0.008, 2.0, 0.755, 'Z'); // khe giữa hai cánh cửa
  for (const sx of [-0.5, 0.5]) for (let i = 0; i < 4; i++) g.rgb(0.06, 0.07, 0.07).box(sx - 0.3, 0.42 + i * 0.09, 0.75, sx + 0.3, 0.46 + i * 0.09, 0.756, 'Z'); // cửa chớp
  g.rgb(0.9, 0.68, 0.02).tri3([-0.68, 1.5, 0.756], [-0.32, 1.5, 0.756], [-0.5, 1.81, 0.756]); g.rgb(0.05, 0.05, 0.05).box(-0.512, 1.57, 0.758, -0.488, 1.71, 0.76, 'Z');
  signPlate(pg, 0.05, 1.5, 0.9, 0.25, uvWarn, 0xf2efe6, { back: false, z: 0.765, code: INK_RED, glow: 0 });
  // mặt sau (quay ra lòng đường): cửa chớp, tam giác vàng, biển chữ
  g.push().rotY(Math.PI); pg.push().rotY(Math.PI);
  for (const sx of [-0.5, 0.5]) for (let i = 0; i < 4; i++) g.rgb(0.06, 0.07, 0.07).box(sx - 0.3, 0.42 + i * 0.09, 0.75, sx + 0.3, 0.46 + i * 0.09, 0.756, 'Z');
  g.rgb(0.9, 0.68, 0.02).tri3([-0.68, 1.5, 0.756], [-0.32, 1.5, 0.756], [-0.5, 1.81, 0.756]); g.rgb(0.05, 0.05, 0.05).box(-0.512, 1.57, 0.758, -0.488, 1.71, 0.76, 'Z');
  signPlate(pg, 0.05, 1.5, 0.9, 0.25, uvWarn, 0xf2efe6, { back: false, z: 0.765, code: INK_RED, glow: 0 });
  g.pop(); pg.pop();
  if (art) { g.push().rotY(Math.PI / 2); sunflower(g, -0.3, 1.5, 1.0, 0.2); sunflower(g, 0.25, 1.2, 1.0, 0.17); g.pop(); }
  g.pop(); pg.pop();
}

// ----- xe buýt -----
// Cột biển điểm dừng xe buýt: cột thép 2,6 m, biển 0,5 × 0,75 m nền xanh dương, hình xe buýt và chữ trắng; biển vuông góc
// với +z cục bộ (+z là hướng ra lòng đường), đọc được từ hai chiều đi dọc phố.
export function busSign(g, pg, x, z, y, yaw, uv) {
  g.push().move(x, y, z).rotY(yaw).glow(0).mat(); pg.push(); pg.m = g.m.slice();
  g.rgb(0.33, 0.35, 0.37).gloss(0.4).cyl(0, 0, 0, 0.04, 0.035, 2.66, 5, true).gloss(0);
  pg.push().rotY(Math.PI / 2); signPlate(pg, -0.25, 1.86, 0.5, 0.75, uv, 0x1565c0, { rot: true, z: 0.045 }); pg.pop();
  g.pop(); pg.pop();
}
// Nhà chờ xe buýt: khung thép xám 4,5 × 1,5 × 2,5 m, mái cong, vách sau, ghế băng, một đầu là hộp đèn. Mặt mở quay về +z (lòng đường).
export function busShelter(g, x, z, y, yaw) {
  g.push().move(x, y, z).rotY(yaw).glow(0).mat();
  g.rgb(0.3, 0.32, 0.34).gloss(0.4);
  for (const px of [-2.2, 0, 2.2]) g.cube(px, 0, -0.7, 0.07, 2.3, 0.07, 'xXzZ').tube([px, 2.28, -0.7], [px, 2.52, 0.75], 0.03, 3);
  g.box(-2.25, 2.24, -0.74, 2.25, 2.3, -0.66); // xà dọc
  // mái cong bằng tôn nhựa mờ
  const a = [], b = [], a2 = [], b2 = [];
  for (let i = 0; i <= 3; i++) { const t = i / 3, zz = -0.85 + t * 1.75, yy = 2.34 + Math.sin(t * 2.2) * 0.26; a.push([-2.3, yy, zz]); b.push([2.3, yy, zz]); a2.push([-2.3, yy - 0.03, zz]); b2.push([2.3, yy - 0.03, zz]); }
  g.rgb(0.5, 0.56, 0.6).gloss(0.6).ribbon(b, a).rgb(0.36, 0.4, 0.43).gloss(0).ribbon(b2, a2, true);
  // vách sau: kính mờ, dán sơ đồ tuyến
  g.rgb(0.55, 0.6, 0.62).gloss(0.5).box(-2.16, 0.45, -0.72, 0.9, 2.1, -0.7, 'zZ').gloss(0);
  g.rgb(0.85, 0.85, 0.8).box(-1.5, 0.95, -0.69, -0.2, 1.85, -0.685, 'Z').rgb(0.08, 0.3, 0.6).box(-1.5, 1.7, -0.684, -0.2, 1.85, -0.68, 'Z');
  // ghế băng
  g.rgb(0.34, 0.36, 0.38).gloss(0.4).box(-1.7, 0.44, -0.6, 0.3, 0.49, -0.25).gloss(0).cube(-1.5, 0, -0.42, 0.06, 0.44, 0.3, 'xXzZ').cube(0.1, 0, -0.42, 0.06, 0.44, 0.3, 'xXzZ');
  // hộp đèn ở đầu nhà chờ (tấm pa nô sáng, không quảng cáo thương hiệu)
  g.rgb(0.2, 0.21, 0.22).box(2.14, 0.2, -0.72, 2.28, 2.2, 0.5, 'xXyYzZ');
  for (const [sx, f] of [[2.285, 'X'], [2.135, 'x']]) g.rgb(0.75, 0.82, 0.86).glow(0.55).box(sx - 0.002, 0.4, -0.6, sx + 0.002, 2.05, 0.38, f).rgb(0.75, 0.1, 0.08).box(sx - 0.004, 1.62, -0.6, sx + 0.004, 2.05, 0.38, f).glow(0);
  g.pop();
}
// Biển "P" nơi đỗ xe: cột thép, biển vuông 0,6 m nền xanh dương chữ P trắng; mặt biển quay về +z.
export function parkSign(g, pg, x, z, y, yaw, uv) {
  g.push().move(x, y, z).rotY(yaw).glow(0).mat(); pg.push(); pg.m = g.m.slice();
  g.rgb(0.33, 0.35, 0.37).gloss(0.4).cyl(0, 0, 0, 0.038, 0.034, 2.75, 5, true).gloss(0);
  signPlate(pg, -0.3, 2.1, 0.6, 0.6, uv, 0x1558b0, { z: 0.042 });
  g.pop(); pg.pop();
}

// ----- loa phường, phướn, cờ -----
// Cụm hai loa nén hình phễu màu xám gắn trên cột đèn ở độ cao h, hai loa quay ngược nhau dọc phố (trục x cục bộ).
export function speakers(g, x, z, y, yaw, h) {
  g.push().move(x, y + h, z).rotY(yaw).glow(0).mat().rgb(0.2, 0.21, 0.22).gloss(0.2);
  g.box(-0.3, -0.03, 0.05, 0.3, 0.03, 0.11).box(-0.03, -0.03, 0, 0.03, 0.03, 0.11);
  g.rgb(0.5, 0.52, 0.52).gloss(0.3);
  for (const s of [-1, 1]) g.tube([s * 0.1, 0.02, 0.2], [s * 0.2, 0.04, 0.2], 0.085, 6).tube([s * 0.2, 0.04, 0.2], [s * 0.6, 0.09, 0.2], 0.06, 7, 0.21).rgb(0.1, 0.1, 0.1).tube([s * 0.56, 0.085, 0.2], [s * 0.3, 0.05, 0.2], 0.19, 7, 0.03).rgb(0.5, 0.52, 0.52);
  g.gloss(0).pop();
}
// Đôi phướn dọc 0,8 × 2,5 m treo hai bên cột đèn: cờ đỏ sao vàng và cờ đỏ búa liềm. Cột ở gốc; trục x cục bộ dọc phố.
export function pennants(g, pg, x, z, y, yaw, uvStar, uvSickle) {
  g.push().move(x, y, z).rotY(yaw).glow(0).mat(); pg.push(); pg.m = g.m.slice();
  g.rgb(0.3, 0.32, 0.34).gloss(0.3).box(-1.02, 6.0, -0.02, 1.02, 6.05, 0.02).box(-1.02, 3.42, -0.02, 1.02, 3.46, 0.02).gloss(0);
  for (const [s, uv] of [[-1, uvStar], [1, uvSickle]]) {
    const x0 = s < 0 ? -0.98 : 0.18, x1 = x0 + 0.8;
    pg.color(0xda251d, INK_YELLOW / 255).gloss(0).glow(0.12).sway(0);
    for (const [ya, yb, u] of [[3.5, 4.75, null], [4.75, 5.55, uv], [5.55, 6.0, null]]) {
      pg.quad([x0, ya, 0.004], [x1, ya, 0.004], [x1, yb, 0.004], [x0, yb, 0.004], u || undefined).quad([x1, ya, -0.004], [x0, ya, -0.004], [x0, yb, -0.004], [x1, yb, -0.004], u || undefined);
    }
  }
  pg.glow(0); g.pop(); pg.pop();
}
// Cờ Tổ quốc 0,8 × 1,2 m trên cán inox 2,3 m cắm nghiêng 45 độ ở ban công. Gốc cán tại (0,0,0), cán vươn theo +z (ra phố).
// uv: ô cờ trong bảng biển hiệu (signs.js FLAG_CELL), vì cờ có hai màu nên dùng bảng màu của lưới thường.
export function houseFlag(g, uv, side = 1) {
  const c = Math.SQRT1_2, tip = [0, 2.3 * c, 2.3 * c], a = [0, 1.5 * c, 1.5 * c];
  g.rgb(0.6, 0.6, 0.58).gloss(0.5).tube([0, 0, 0], tip, 0.014, 4).gloss(0);
  // lá cờ rủ từ cán: cạnh ngắn (0,8 m) bám dọc cán, cạnh dài (1,2 m) buông chéo xuống một bên; chiều u của ô cờ chạy theo cạnh dài
  const d = [0.76 * side, -0.9, 0.12], a1 = [a[0] + d[0], a[1] + d[1], a[2] + d[2]], t1 = [tip[0] + d[0], tip[1] + d[1], tip[2] + d[2]];
  g.rgb(1, 1, 1).sway(0.55).quad(a, a1, t1, tip, uv).quad(a1, a, tip, t1, [uv[2], uv[1], uv[0], uv[3]]).sway(0);
}

// ----- rào công trường -----
// Một tấm rào tôn từ a tới b ([x,z]) cao h, chân rào bê tông. (nx,nz): hướng mặt ngoài (phía người đi đường nhìn vào).
// art: 0 tôn trơn; 1, 2: tấm trang trí vẽ phẳng (sóng nước với mặt trời hoặc búp sen).
export function hoardingPanel(g, a, b, h, nx, nz, col, art, seed) {
  if (-(b[1] - a[1]) * nx + (b[0] - a[0]) * nz < 0) { const q = a; a = b; b = q; } // xếp a→b sao cho mặt trước của các tứ giác quay về (nx,nz)
  const t = 0.03, ox = nx * t, oz = nz * t;
  g.mat().gloss(0.2).rgb(col[0], col[1], col[2]);
  g.quad([a[0] + ox, 0.14, a[1] + oz], [b[0] + ox, 0.14, b[1] + oz], [b[0] + ox, h, b[1] + oz], [a[0] + ox, h, a[1] + oz]);
  g.shade(0.7).quad([b[0] - ox, 0.14, b[1] - oz], [a[0] - ox, 0.14, a[1] - oz], [a[0] - ox, h, a[1] - oz], [b[0] - ox, h, b[1] - oz]);
  g.gloss(0).rgb(0.45, 0.45, 0.43).mat(MAT.concrete).quad([a[0] + ox * 3, 0, a[1] + oz * 3], [b[0] + ox * 3, 0, b[1] + oz * 3], [b[0] + ox * 3, 0.16, b[1] + oz * 3], [a[0] + ox * 3, 0.16, a[1] + oz * 3]).mat();
  if (art) { // tấm trang trí: dải sóng nước và mặt trời (hoặc búp sen) vẽ phẳng
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, e = 0.012, P = (s, y) => [a[0] + ux * s + nx * (t + e), y, a[1] + uz * s + nz * (t + e)];
    g.rgb(0.1, 0.36, 0.6).quad(P(0, 0.2), P(L, 0.2), P(L, 0.75 + hash(seed, 2) * 0.2), P(0, 0.6 + hash(seed, 1) * 0.3));
    if (art === 1) { g.rgb(0.95, 0.6, 0.05); const cx = L * (0.3 + hash(seed, 3) * 0.4), cy = 1.45; for (let i = 0; i < 10; i++) { const p = (i / 10) * 6.2832, q = ((i + 1) / 10) * 6.2832; g.tri3(P(cx, cy), P(cx + Math.cos(p) * 0.34, cy + Math.sin(p) * 0.34), P(cx + Math.cos(q) * 0.34, cy + Math.sin(q) * 0.34)); } }
    else { g.rgb(0.85, 0.35, 0.5); const cx = L * 0.5; g.tri3(P(cx - 0.3, 0.95), P(cx + 0.3, 0.95), P(cx, 1.75)).tri3(P(cx - 0.62, 1.0), P(cx - 0.1, 0.95), P(cx - 0.4, 1.5)).tri3(P(cx + 0.1, 0.95), P(cx + 0.62, 1.0), P(cx + 0.4, 1.5)); }
  }
}
// Cần cẩu bánh xích ở công trường ga ngầm: thân máy vàng, cần dàn dài vươn chéo, cáp và móc. lod 1: chỉ còn thân và cần.
export function crane(g, x, z, y, yaw, lod = 0, boom = 26) {
  g.push().move(x, y, z).rotY(yaw).glow(0).mat();
  const tipX = boom * 0.42, tipY = 1.9 + boom * 0.9;
  g.rgb(0.75, 0.52, 0.03).gloss(0.2).box(-2.2, 0.9, -1.4, 1.6, 2.5, 1.4).gloss(0);
  g.rgb(0.75, 0.52, 0.03).tube([1.2, 2.2, 0], [tipX, tipY, 0], lod ? 0.3 : 0.26, lod ? 3 : 4, 0.14);
  if (!lod) {
    g.rgb(0.07, 0.07, 0.07).mat(MAT.rust).box(-2.6, 0, -1.9, 2.4, 0.9, -1.2).box(-2.6, 0, 1.2, 2.4, 0.9, 1.9).mat();
    g.rgb(0.08, 0.1, 0.12).gloss(0.8).box(0.5, 1.5, 0.6, 1.62, 2.45, 1.42, 'XZ').gloss(0);
    g.rgb(0.3, 0.3, 0.3).box(-2.7, 1.0, -1.2, -2.2, 2.2, 1.2); // đối trọng
    g.rgb(0.03, 0.03, 0.03).tube([-1.6, 2.5, 0], [tipX, tipY, 0], 0.025, 3).tube([tipX, tipY, 0], [tipX, tipY - boom * 0.55, 0], 0.02, 3);
    g.rgb(0.6, 0.1, 0.05).cube(tipX, tipY - boom * 0.55 - 0.5, 0, 0.3, 0.5, 0.3);
  }
  g.pop();
}
// Máy xúc đào bánh xích màu cam, cần gập (bãi giải toả phía đông Hồ Gươm).
export function excavator(g, x, z, y, yaw) {
  g.push().move(x, y, z).rotY(yaw).glow(0).mat();
  g.rgb(0.07, 0.07, 0.07).mat(MAT.rust).box(-1.6, 0, -1.25, 1.6, 0.6, -0.75).box(-1.6, 0, 0.75, 1.6, 0.6, 1.25).mat();
  g.rgb(0.8, 0.36, 0.03).gloss(0.2).box(-1.5, 0.7, -1.1, 1.2, 1.7, 1.1).gloss(0);
  g.rgb(0.08, 0.1, 0.12).gloss(0.8).box(0.1, 1.7, 0.2, 1.2, 2.6, 1.1, 'xXzZ').gloss(0).rgb(0.8, 0.36, 0.03).box(0.1, 2.6, 0.2, 1.2, 2.66, 1.1);
  g.tube([0.9, 1.5, -0.4], [3.2, 4.0, -0.4], 0.2, 4, 0.16).tube([3.2, 4.0, -0.4], [4.9, 1.6, -0.4], 0.15, 4, 0.12);
  g.rgb(0.2, 0.2, 0.2).mat(MAT.rust).box(4.5, 0.75, -0.75, 5.3, 1.6, -0.05).mat();
  g.pop();
}
// Thùng container văn phòng công trường.
export function siteCabin(g, x, z, y, yaw, col = [0.55, 0.57, 0.58]) {
  g.push().move(x, y, z).rotY(yaw).glow(0).mat().rgb(col[0], col[1], col[2]).gloss(0.15);
  g.box(-3, 0.2, -1.2, 3, 2.8, 1.2).gloss(0).rgb(0.08, 0.1, 0.12).gloss(0.7).box(-2.2, 1.3, 1.2, -1.2, 2.2, 1.21, 'Z').box(0.2, 1.3, 1.2, 1.2, 2.2, 1.21, 'Z').gloss(0);
  g.rgb(0.3, 0.3, 0.3).box(1.8, 0.2, 1.2, 2.6, 2.3, 1.21, 'Z');
  g.pop();
}

// ----- bát hương, bàn thờ nhỏ gốc cây -----
// Ban thờ nhỏ sơn đỏ gắn vào thân cây cổ thụ (bán kính thân r), bát hương sứ, ba nén hương đang cháy; mặt quay về +z.
export function treeShrine(g, r) {
  g.glow(0).mat();
  const z0 = r + 0.02, y0 = 1.0;
  g.rgb(0.42, 0.04, 0.03).mat(MAT.lacquer).box(-0.24, y0, z0 - 0.06, 0.24, y0 + 0.035, z0 + 0.3).box(-0.24, y0 + 0.035, z0 - 0.06, 0.24, y0 + 0.42, z0 - 0.03).box(-0.24, y0 + 0.035, z0 - 0.03, -0.215, y0 + 0.36, z0 + 0.26, 'xXZ').box(0.215, y0 + 0.035, z0 - 0.03, 0.24, y0 + 0.36, z0 + 0.26, 'xXZ');
  g.quad([-0.3, y0 + 0.36, z0 + 0.34], [0.3, y0 + 0.36, z0 + 0.34], [0.3, y0 + 0.52, z0 - 0.07], [-0.3, y0 + 0.52, z0 - 0.07]).mat(); // mái
  g.rgb(0.75, 0.74, 0.68).gloss(0.4).lathe(0, y0 + 0.035, z0 + 0.13, [[0.04, 0], [0.075, 0.035], [0.085, 0.09], [0.07, 0.1]], 6).rgb(0.35, 0.33, 0.3).gloss(0).disc(0, y0 + 0.125, z0 + 0.13, 0.07, 6, 1);
  for (const [dx, dz] of [[-0.025, 0], [0.02, 0.02], [0.005, -0.025]]) {
    g.rgb(0.5, 0.08, 0.05).tube([dx, y0 + 0.12, z0 + 0.13 + dz], [dx * 2.4, y0 + 0.32, z0 + 0.13 + dz * 2.4], 0.004, 3);
    g.rgb(1, 0.45, 0.1).glow(1).cube(dx * 2.4, y0 + 0.32, z0 + 0.13 + dz * 2.4, 0.012, 0.012, 0.012).glow(0);
  }
  // lò hoá vàng nhỏ bằng thùng sắt dưới gốc
  g.rgb(0.12, 0.1, 0.09).mat(MAT.rust).cyl(0.55, 0, z0 + 0.25, 0.17, 0.19, 0.4, 6, false).mat();
}
