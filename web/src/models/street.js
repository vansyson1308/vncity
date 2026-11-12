// Đồ vật đường phố Hà Nội dựng thủ tục bằng G (chạy trong worker): cây, cột đèn, cột điện, ghế nhựa...
import { hash } from '../core/util.js';
import { MAT } from '../core/geo.js';
import { SIG, INK_RED, INK_YELLOW } from '../world/streetnames.js';

// Tô tối phần dưới của một khối vừa dựng (giả bóng đổ trong tán cây): nhân màu theo pháp tuyến y.
export function shadeByNormal(g, from, lo = 0.55, hi = 1.05) {
  for (let i = from; i < g.count; i++) { const k = lo + (hi - lo) * (g.nrm[i * 3 + 1] * 0.5 + 0.5); g.col[i * 4] *= k; g.col[i * 4 + 1] *= k; g.col[i * 4 + 2] *= k; }
}

// Loài cây phố Hà Nội. Màu tuyến tính [r,g,b].
// Dáng tán (để hai loài đứng cạnh nhau không lẫn vào nhau): blobs = số khối tán; squash = độ dẹt (<1) hay thuôn cao (>1) của mỗi
// khối; spread = các khối quanh xoè xa tâm bao nhiêu (× bán kính tán R); top = khối giữa nhô cao bao nhiêu (× R); vert = các khối
// quanh rải theo chiều đứng bao nhiêu (× R); crown = tán bắt đầu ở mấy phần chiều cao cây; clear = độ cao thông thoáng dưới tán
// (mét: cây phố được cắt tỉa cho người và xe đi dưới, lá không bao giờ sà xuống ngang mặt người); cell = ô lá trong texture (0 lá to,
// 1 lá nhỏ); limb = cành cái to bằng mấy phần thân; cards = số thẻ lá mỗi khối.
export const TREES = {
  // xà cừ: rất cao, thân to vỏ bong từng mảng sáng màu, cành cái lớn vươn ngang, tán XOÈ RỘNG như cái ô và thưa, lá to xanh ô liu
  xacu: { h: [9.5, 12.5], r: [4.4, 5.6], trunk: 0.4, col: [0.165, 0.31, 0.075], blobs: 6, squash: 0.58, spread: 0.66, top: 0.3, vert: 0.3, crown: 0.74, clear: 4.2, limb: 0.6, cell: 0, cards: 11, bark: [0.3, 0.265, 0.21] },
  // sấu: thân thẳng có bạnh gốc, vỏ nâu xám sẫm, tán DÀY hình trứng thuôn cao, lá kép nhỏ xanh thẫm ngả lam
  sau: { h: [8, 10.5], r: [2.5, 3.2], trunk: 0.27, col: [0.05, 0.185, 0.075], blobs: 6, squash: 1.12, spread: 0.24, top: 1.0, vert: 0.95, crown: 0.6, clear: 3.2, limb: 0.34, cell: 1, cards: 12, bark: [0.125, 0.1, 0.08], buttress: true },
  bang: { h: [4.5, 6.5], r: [2.6, 3.4], trunk: 0.2, col: [0.187, 0.408, 0.085], blobs: 4, squash: 0.45, clear: 2.5, bark: [0.18, 0.155, 0.125] },        // bàng: tán xoè tầng
  banglang: { h: [4.8, 6.2], r: [2.0, 2.8], trunk: 0.17, col: [0.204, 0.425, 0.119], blobs: 4, squash: 0.8, clear: 2.5, cell: 1, flower: [0.42, 0.2, 0.5], bark: [0.25, 0.2, 0.15] }, // bằng lăng tím
  phuong: { h: [6, 8], r: [3.2, 4.4], trunk: 0.26, col: [0.221, 0.459, 0.102], blobs: 5, squash: 0.5, clear: 2.9, cell: 1, flower: [0.72, 0.1, 0.04], bark: [0.2, 0.17, 0.135] },    // phượng đỏ
  lieu: { h: [4.8, 6.2], r: [2.2, 2.8], trunk: 0.18, col: [0.340, 0.561, 0.153], blobs: 5, squash: 1.5, clear: 1.9, droop: true, bark: [0.11, 0.085, 0.06] }, // liễu rủ ven hồ
  hoasua: { h: [6.5, 9], r: [2.4, 3.2], trunk: 0.22, col: [0.153, 0.340, 0.119], blobs: 5, squash: 1.0, clear: 3.0, cell: 1, flower: [0.4, 0.47, 0.3], bark: [0.19, 0.17, 0.145] }, // hoa sữa: tán cao thành tầng, cuối thu nở chùm hoa trắng xanh
  // --- theo từng phố (docs/18, mục 6) ---
  nhoi: { h: [8, 11], r: [3.4, 4.6], trunk: 0.3, col: [0.11, 0.3, 0.075], blobs: 6, squash: 0.8, clear: 3.4, bark: [0.2, 0.15, 0.11] },               // nhội (Phan Đình Phùng đoạn đông, Trần Hưng Đạo): cao, tán tròn dày
  xacuco: { h: [13, 17], r: [5.6, 7.2], trunk: 0.52, col: [0.155, 0.295, 0.07], blobs: 7, squash: 0.62, spread: 0.66, top: 0.3, vert: 0.3, crown: 0.74, clear: 5.5, limb: 0.6, cell: 0, cards: 11, bark: [0.3, 0.265, 0.21] }, // xà cừ cổ thụ phố Hoàng Diệu: thân Ø hơn 1 m, tán trùm cả lòng đường
  comnguoi: { h: [6, 8], r: [2.6, 3.4], trunk: 0.2, col: [0.2, 0.39, 0.09], blobs: 5, squash: 0.85, clear: 2.9, cell: 1, bark: [0.3, 0.28, 0.24] },   // cơm nguội vàng (Lý Thường Kiệt): cuối năm lá ngả vàng (xem SEASON)
  da: { h: [7, 9.5], r: [4.2, 5.6], trunk: 0.5, col: [0.09, 0.25, 0.07], blobs: 6, squash: 0.55, clear: 2.7, bark: [0.22, 0.2, 0.17], roots: true },   // đa, si: gốc to nhiều rễ phụ buông, tán thấp xoè rộng
  locvung: { h: [4.5, 6], r: [3, 4], trunk: 0.24, col: [0.16, 0.36, 0.08], blobs: 5, squash: 0.6, clear: 2.3, flower: [0.6, 0.06, 0.08], strings: true, bark: [0.16, 0.13, 0.1] }, // lộc vừng ven Hồ Gươm: thân nghiêng ra mặt nước, tháng 10-11 buông hoa đỏ
  non: { h: [3.6, 4.6], r: [0.9, 1.3], trunk: 0.055, col: [0.2, 0.45, 0.1], blobs: 3, squash: 1.1, clear: 1.9, bark: [0.25, 0.2, 0.14], stakes: true }, // cây non trồng dặm sau bão Yagi, có ba cọc chống
};
const KINDS = Object.keys(TREES);
export const treeKind = (i) => KINDS[i % KINDS.length];

// Lá và hoa theo MÙA (art bible mục 6, bảng "Lịch hoa và lá"). Mùa đi theo thời tiết của game (engine/sky.js WEATHER):
//   mu = đông (tháng 11 đến tháng 1, mặc định của game), nom = xuân nồm ẩm (2 đến 4), he = hè (5 đến 8), thu = thu (9 đến 10).
// Mỗi dòng: alt = màu lá đổi mùa, mix = bao nhiêu phần tán mang màu đó, thin = tán còn bao nhiêu phần lá (cây đang rụng lá),
// flower = bao nhiêu phần khối tán có chùm hoa. Không ghi gì = lá xanh quanh năm, KHÔNG có hoa.
// Hoa chỉ nở đúng mùa: phượng và bằng lăng tháng 5-6 (hè); hoa sữa tháng 10-11; lộc vừng buông hoa đỏ tháng 10-11.
const YELLOW = [0.55, 0.43, 0.07], RUSSET = [0.5, 0.17, 0.05], REDLEAF = [0.52, 0.085, 0.04], FRESH = [0.32, 0.55, 0.1];
export const SEASON = {
  mu: {
    banglang: { alt: RUSSET, mix: 0.6, thin: 0.85 },   // bằng lăng: lá ngả đỏ vàng trước khi rụng, không hoa
    phuong: { alt: YELLOW, mix: 0.3, thin: 0.7 },       // phượng: chỉ còn lá, tán thưa, điểm lá vàng
    bang: { alt: REDLEAF, mix: 0.75 },                  // bàng lá đỏ
    comnguoi: { alt: YELLOW, mix: 0.85 },               // cơm nguội vàng lá
    hoasua: { flower: 0.22 },                           // hoa sữa cuối mùa: còn lác đác vài chùm
    locvung: { flower: 0.4 },                           // lộc vừng còn buông dây hoa đỏ (tháng 10-11)
    lieu: { alt: [0.42, 0.5, 0.12], mix: 0.35 },        // liễu cuối năm ngả vàng nhẹ
    non: { alt: YELLOW, mix: 0.2 },
  },
  thu: {
    hoasua: { flower: 0.75 }, locvung: { flower: 0.6 },
    comnguoi: { alt: YELLOW, mix: 0.3 }, bang: { alt: REDLEAF, mix: 0.15 }, banglang: { alt: RUSSET, mix: 0.12 },
  },
  he: { phuong: { flower: 0.65 }, banglang: { flower: 0.65 } },
  nom: {
    sau: { alt: YELLOW, mix: 0.3, alt2: FRESH },              // sấu trút lá vàng và ra lộc xanh non cùng lúc
    xacu: { alt: YELLOW, mix: 0.25, thin: 0.75 }, xacuco: { alt: YELLOW, mix: 0.25, thin: 0.75 }, // xà cừ rụng lá
    locvung: { alt: RUSSET, mix: 0.6 },                       // lộc vừng thay lá vàng đỏ
    bang: { alt: FRESH, mix: 0.9, thin: 0.6 },                // bàng vừa trụi lá, đang nhú lộc non
    banglang: { alt: FRESH, mix: 0.6, thin: 0.8 }, phuong: { alt: FRESH, mix: 0.5, thin: 0.6 }, comnguoi: { alt: FRESH, mix: 0.5 },
    nhoi: { alt: FRESH, mix: 0.3 }, lieu: { alt: FRESH, mix: 0.4 }, non: { alt: FRESH, mix: 0.5 },
  },
};
const EVERGREEN = {};
export const seasonOf = (kind, season) => (SEASON[season] || SEASON.mu)[kind] || EVERGREEN;

// Thẻ lá quanh một khối tán tâm (cx,cy,cz), bán kính r. cell: ô trong texture lá (0 lá to, 1 lá nhỏ, 2 liễu, 3 hoa).
// Mỗi thẻ quay một hướng riêng (pháp tuyến = hướng ra ngoài tán trộn với một hướng ngẫu nhiên) nên không có hai thẻ song song,
// và được GẬP theo đường chéo thành hình mái (hai tam giác lệch nhau 40-60 độ): nhìn từ hướng nào cũng còn ít nhất nửa thẻ
// quay mặt về mắt, hết cảnh cả thẻ nằm nghiêng thành vệt sọc. Pháp tuyến chiếu sáng vẫn hướng ra ngoài tán cho bóng đổ mềm.
// hang: thẻ treo đứng (sợi liễu rủ), mép trên của ô texture luôn ở trên.
// col2, p2: một phần thẻ (tỉ lệ p2) mang màu thứ hai (lá đổi mùa lốm đốm trong tán). minY: không đỉnh nào thấp hơn độ cao này
// (toạ độ của cây; tán được "cắt tỉa" phẳng ở độ cao thông thoáng thay vì sà xuống mặt người đi đường).
function leafCards(lf, cx, cy, cz, r, squash, n, seed, cell, col, swayBase, hang = false, col2 = null, p2 = 0, minY = -1e9) {
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
    const sh = 0.72 + 0.42 * (dy * 0.5 + 0.5) + (hash(seed, 100 + i) - 0.5) * 0.2, cc = col2 && hash(seed, 200 + i) < p2 ? col2 : col;
    lf.rgb(cc[0] * sh, cc[1] * sh, cc[2] * sh).sway(swayBase);
    let nx = dx, ny = dy * 0.6 + 0.4, nz = dz; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const fu = hash(seed, 120 + i) < 0.5, ua = fu ? u0 + 0.5 : u0, ub = fu ? u0 : u0 + 0.5;
    // gập: hai góc B, D lùi vào trong theo −m; sống mái là đường chéo A–C
    const f = s * (hang ? 0.35 : 0.75 + hash(seed, 180 + i) * 0.3), fx = -mx * f, fy = -my * f * sy, fz = -mz * f;
    const yA = py + (-uy - vy) * s * sy, yB = py + (uy - vy) * s * sy + fy, yC = py + (uy + vy) * s * sy, yD = py + (-uy + vy) * s * sy + fy;
    const lo = hang ? minY + hash(seed, 220 + i) * 0.9 : minY; // sợi liễu: mỗi sợi dài ngắn một khác, không cắt bằng một đường
    if (Math.max(yA, yB, yC, yD) < lo + 0.25) continue; // cả thẻ nằm dưới độ cao thông thoáng: bỏ
    const A = lf.v(px - ux * s - vx * s, Math.max(yA, lo), pz - uz * s - vz * s, nx, ny, nz, ua, v0);
    const B = lf.v(px + ux * s - vx * s + fx, Math.max(yB, lo), pz + uz * s - vz * s + fz, nx, ny, nz, ub, v0);
    const C = lf.v(px + ux * s + vx * s, Math.max(yC, lo), pz + uz * s + vz * s, nx, ny, nz, ub, v0 + 0.5);
    const D = lf.v(px - ux * s + vx * s + fx, Math.max(yD, lo), pz - uz * s + vz * s + fz, nx, ny, nz, ua, v0 + 0.5);
    lf.tri(A, B, C); lf.tri(A, C, D);
  }
  lf.sway(0);
}

// Ống uốn cong liền mạch qua các điểm pts (bán kính rad[i] tại từng điểm): các vòng đỉnh dùng chung giữa hai đoạn nên chỗ thân
// cây đổi hướng không hở khe như khi nối nhiều ống thẳng. Không nắp hai đầu (gốc cắm xuống đất, ngọn chìm trong tán).
function pipe(g, pts, rad, seg = 6) {
  const base = g.count, n = pts.length;
  let px = 1, py = 0, pz = 0; // trục ngang của vòng trước: giữ cho các vòng không xoắn
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    const d = px * tx + py * ty + pz * tz; px -= tx * d; py -= ty * d; pz -= tz * d;
    let pl = Math.hypot(px, py, pz); if (pl < 1e-4) { px = -tz; py = 0; pz = tx; pl = Math.hypot(px, pz) || 1; } px /= pl; py /= pl; pz /= pl;
    const qx = ty * pz - tz * py, qy = tz * px - tx * pz, qz = tx * py - ty * px;
    for (let k = 0; k <= seg; k++) { const t = (k / seg) * 6.283185, c = Math.cos(t), s = Math.sin(t), nx = px * c + qx * s, ny = py * c + qy * s, nz = pz * c + qz * s; g.v(pts[i][0] + nx * rad[i], pts[i][1] + ny * rad[i], pts[i][2] + nz * rad[i], nx, ny, nz); }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < seg; k++) { const a = base + i * (seg + 1) + k, b = a + seg + 1; g.idx.push(a, b + 1, b, a, a + 1, b + 1); }
  return g;
}

// Cây ở (x,z). lod 0: thân, cành, lõi tán tối và các thẻ lá (ghi vào lf); lod 1: một khối tán, thân bốn cạnh.
// lime: gốc quét vôi trắng (1 có, 0 không, -1 tuỳ hạt giống). Dải vôi cao 1,2 m, có cả ở bản xa để nhìn từ xa vẫn ra hàng cây Hà Nội.
// season: 'mu' | 'thu' | 'he' | 'nom' (xem SEASON). tilt: [dx, dz] (mét, toạ độ thế giới) = tán lệch khỏi gốc bao nhiêu về phía
// nào: cây ven hồ nghiêng thân ra mặt nước (lộc vừng gần như nằm ngang trên mặt hồ). Gốc cây luôn ở đúng (x, z) trên bờ.
const LIME_H = 1.2;
export function tree(g, x, z, seed, kind = 'sau', lod = 0, y = 0, lf = null, lime = -1, season = 'mu', tilt = null) {
  const T = TREES[kind] || TREES.sau, S = seasonOf(TREES[kind] ? kind : 'sau', season), r1 = hash(seed, 1), r2 = hash(seed, 2), r3 = hash(seed, 3);
  const H = T.h[0] + (T.h[1] - T.h[0]) * r1, R = T.r[0] + (T.r[1] - T.r[0]) * r2, tr = T.trunk * (0.8 + r3 * 0.5);
  const yaw = r2 * 6.283, tl = tilt ? Math.hypot(tilt[0], tilt[1]) : 0, leaning = tl > 0.6;
  let crownY = H * (T.crown || (T.droop ? 0.72 : 0.68)), lean = (r3 - 0.5) * 0.5, lz = (r1 - 0.5) * 0.4;
  if (tl > 0) { // đưa hướng nghiêng (thế giới) về hệ toạ độ đã xoay của cây; thân càng ngả thì tán càng thấp
    const c = Math.cos(yaw), s = Math.sin(yaw); lean += tilt[0] * c - tilt[1] * s; lz += tilt[0] * s + tilt[1] * c;
    crownY = Math.max(crownY - tl * 0.42, Math.min(crownY, 2.7));
  }
  const clear = leaning ? Math.max(1.9, (T.clear || 2.5) - tl * 0.2) : T.clear || 2.5;
  g.push().move(x, y, z).rotY(yaw);
  if (lf) { lf.push(); lf.m = g.m.slice(); }
  const bk = T.bark || [0.11, 0.085, 0.06], bark = () => g.rgb(bk[0], bk[1], bk[2]).mat(MAT.wood); // vỏ cây: thớ dọc, khe nứt
  bark().sway(0).gloss(0).glow(0);
  const tint = 0.82 + hash(seed, 9) * 0.36, c = T.col, alt = S.alt || null, mixP = alt ? S.mix : 0, thin = S.thin || 1, flowerP = T.flower ? S.flower || 0 : 0;
  const limed = !T.stakes && !T.roots && (lime < 0 ? hash(seed, 12) < 0.45 : lime > 0);
  // thân nghiêng: uốn cong dần từ gốc (gốc gần như thẳng đứng, càng lên càng ngả ra), điểm trên đường cong ở độ cao h
  const bend = (h) => { const t = Math.min(1, h / crownY), k = leaning ? t * t * (0.55 + 0.45 * t) : t; return [lean * k, h, lz * k]; };
  if (lod > 0) {
    const cm = [c[0] + ((alt ? alt[0] : c[0]) - c[0]) * mixP, c[1] + ((alt ? alt[1] : c[1]) - c[1]) * mixP, c[2] + ((alt ? alt[2] : c[2]) - c[2]) * mixP];
    if (flowerP > 0) { const f = flowerP * (T.strings ? 0.15 : 0.5); cm[0] += (T.flower[0] - cm[0]) * f; cm[1] += (T.flower[1] - cm[1]) * f; cm[2] += (T.flower[2] - cm[2]) * f; }
    const mid = leaning ? bend(crownY * 0.55) : null;
    if (mid) pipe(g, [[0, 0, 0], bend(crownY * 0.3), mid, bend(crownY * 0.8), [lean, crownY, lz]], [tr * 1.1, tr, tr * 0.85, tr * 0.7, tr * 0.6], 4);
    else if (limed) { const b0 = bend(LIME_H); g.mat().rgb(0.66, 0.66, 0.62).tube([0, 0, 0], b0, tr * 1.2, 4, tr * 1.02); bark().tube(b0, [lean, crownY, lz], tr, 4, tr * 0.6); }
    else g.tube([0, 0, 0], [lean, crownY, lz], tr, 4, tr * 0.6);
    g.mat().rgb(cm[0] * tint * 0.8, cm[1] * tint * 0.8, cm[2] * tint * 0.8).sway(0.6);
    // một khối tán: rộng, cao và đặt theo đúng dáng loài (xà cừ dẹt xoè, sấu thuôn cao) để từ xa hàng cây đã ra đúng loài
    const wide = R * (0.6 + (T.spread ?? 0.45) * 0.95) * (0.85 + 0.15 * thin);
    let cy = crownY + R * T.squash * 0.35, tall = T.squash * 0.95;
    if (!T.droop) { const yb = Math.max(clear, crownY - R * (0.3 * (T.vert ?? 0.45) + 0.6 * T.squash)), yt = crownY + R * ((T.top ?? 0.55) + 0.7 * T.squash); cy = (yb + yt) / 2; tall = (yt - yb) / 2 / wide; }
    const from = g.count; g.ball(lean, cy, lz, wide, 6, 3, tall, 0.25, seed);
    shadeByNormal(g, from, 0.5, 1.08);
    g.sway(0).pop(); return;
  }
  // gốc xoè, thân, vòng vôi trắng chống sâu (rất Hà Nội)
  // (vòng vôi là chính đoạn gốc đổi màu, không ốp chồng lên thân: hai mặt gần trùng nhau sẽ nhấp nháy)
  const yl = LIME_H, rl = tr * 1.04, pL = bend(yl), p13 = bend(1.3);
  if (leaning) { // thân nghiêng: một ống uốn cong liền mạch, thon dần từ gốc lên tán (cây ven hồ không quét vôi)
    const pts = [[0, 0, 0], bend(0.65), p13], rad = [tr * 1.28, tr * 1.08, tr];
    for (let q = 1; q <= 5; q++) { pts.push(q === 5 ? [lean, crownY, lz] : bend(1.3 + ((crownY - 1.3) * q) / 5)); rad.push(tr * (1 - 0.076 * q)); }
    pipe(g, pts, rad, 6);
  } else {
    if (limed) { g.rgb(0.86, 0.86, 0.82).mat(MAT.plaster).tube([0, 0, 0], pL, tr * 1.3, 6, rl); bark().tube(pL, p13, rl, 6, tr); }
    else g.tube([0, 0, 0], p13, tr * 1.25, 6, tr);
    g.tube(p13, [lean, crownY, lz], tr, 6, tr * 0.62);
  }
  if (T.buttress) { // bạnh gốc của sấu: bốn sống rễ ngắn, dày, áp sát chân thân (quét vôi cùng với gốc)
    if (limed) g.rgb(0.86, 0.86, 0.82).mat(MAT.plaster);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.283 + hash(seed, 250) * 1.5, rr = tr * (1.75 + hash(seed, 251 + i) * 0.4); g.tube([Math.cos(a) * rr, -0.05, Math.sin(a) * rr], [Math.cos(a) * tr * 0.72, 0.6 + hash(seed, 255 + i) * 0.25, Math.sin(a) * tr * 0.72], tr * 0.5, 4, tr * 0.3); }
    bark();
  }
  if (T.roots) { // rễ phụ của đa, si: vài sợi buông từ cành xuống đất quanh gốc, và bạnh gốc
    for (let i = 0; i < 5; i++) { const a = hash(seed, 200 + i) * 6.283, rr = tr * (1.5 + hash(seed, 210 + i) * 2.6), top = crownY * (0.62 + hash(seed, 220 + i) * 0.3), bt = bend(top); g.tube([Math.cos(a) * rr, 0, Math.sin(a) * rr], [bt[0] * (leaning ? 1 : 0.6) + Math.cos(a) * rr * 0.75, top, bt[2] * (leaning ? 1 : 0.6) + Math.sin(a) * rr * 0.75], 0.05 + hash(seed, 230 + i) * 0.05, 3, 0.03); }
    for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.283 + hash(seed, 240) * 1.5; g.tube([Math.cos(a) * tr * 1.9, 0, Math.sin(a) * tr * 1.9], [Math.cos(a) * tr * 0.5, 1.5, Math.sin(a) * tr * 0.5], tr * 0.42, 4, tr * 0.2); }
  }
  if (T.stakes) { // ba cọc tre chống và đai buộc
    g.mat(MAT.wood).rgb(0.42, 0.33, 0.17);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * 6.283 + 0.4; g.tube([Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62], [lean * 0.3 + Math.cos(a) * 0.07, 1.75, lz * 0.3 + Math.sin(a) * 0.07], 0.028, 3); }
    g.mat().rgb(0.05, 0.05, 0.05).cyl(lean * 0.28, 1.6, lz * 0.28, 0.09, 0.09, 0.07, 5, false);
  }
  const nb = T.blobs, spread = T.spread ?? 0.45, top = T.top ?? 0.55, vert = T.vert ?? 0.45, limb = T.limb || 0.42;
  const nCards = Math.max(4, Math.round((T.cards || 12) * thin)), cell = T.cell || 0, fork = bend(crownY - 0.6);
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * 6.283 + hash(seed, 20 + i) * 1.2, rr = i === 0 ? 0 : R * (spread + hash(seed, 30 + i) * 0.2);
    const bx = lean + Math.cos(a) * rr, bz = lz + Math.sin(a) * rr;
    const br = R * (i === 0 ? 0.74 : 0.52 + hash(seed, 50 + i) * 0.16), sq = T.squash * (0.9 + hash(seed, 90 + i) * 0.25);
    // khối tán không sà xuống dưới độ cao thông thoáng (liễu thì thả sợi rủ xuống, chỉ giữ khối tán ở trên)
    const by = Math.max(crownY + (i === 0 ? R * top : (hash(seed, 40 + i) - 0.3) * R * vert) * (T.droop ? 0.4 : 1), clear + br * sq * (T.droop ? 0.2 : 0.8));
    if (i > 0) { bark().sway(0.15); g.tube(fork, [bx * 0.8 + lean * 0.2, by - br * 0.3, bz * 0.8 + lz * 0.2], tr * limb, 4, tr * limb * 0.48); }
    const k = tint * (0.86 + hash(seed, 60 + i) * 0.3), turned = hash(seed, 300 + i) < mixP; // turned: khối tán này đã đổi màu theo mùa
    const m1 = turned ? alt : c, m2 = turned ? (S.alt2 || c) : alt;
    const cr = m1[0] * k, cg = m1[1] * k, cb = m1[2] * k, sw = T.droop ? 1 : 0.55 + (by / H) * 0.45;
    const col2 = m2 ? [m2[0] * k, m2[1] * k, m2[2] * k] : null, p2 = !m2 ? 0 : turned ? 0.3 : mixP * 0.3;
    g.mat();
    if (lf) {
      // lõi tán tối để nhìn xuyên qua kẽ lá không thấy trời
      g.rgb(cr * 0.42, cg * 0.42, cb * 0.42).sway(sw);
      // (liễu: lõi nhỏ, dẹt, nằm trên cao chỗ các sợi rủ xuất phát; không để một khối tối to treo ngang tầm mắt sau rèm lá thưa)
      if (T.droop) g.ball(bx, Math.max(by + br * 0.15, clear + 1.2 + br * 0.45), bz, br * 0.62, 6, 3, 0.7, 0.2, seed + i);
      else g.ball(bx, Math.max(by, clear + br * 0.78 * sq), bz, br * 0.78 * (0.55 + 0.45 * thin), 6, 3, sq, 0.2, seed + i);
      if (T.droop) leafCards(lf, bx, by - br * 0.9, bz, br * 1.05, 1.5, Math.round(9 * thin), seed * 7 + i, 2, [cr, cg, cb], 1, true, col2, p2, clear);
      else {
        leafCards(lf, bx, by, bz, br * 1.08, sq, nCards, seed * 7 + i, cell, [cr, cg, cb], sw, false, col2, p2, clear);
        if (flowerP > 0 && hash(seed, 70 + i) < flowerP) {
          // lộc vừng: hoa là những dây đỏ buông thõng dưới tán (thẻ treo đứng, ô sợi rủ); loài khác: chùm hoa phủ mặt ngoài tán
          if (T.strings) leafCards(lf, bx, by - br * 0.75, bz, br * 0.8, 1.1, 4, seed * 13 + i, 2, [T.flower[0] * 1.3, T.flower[1] * 1.3, T.flower[2] * 1.3], 1, true, null, 0, clear - 0.9);
          else leafCards(lf, bx, by + br * 0.12, bz, br * 1.12, sq, 5, seed * 13 + i, 3, [T.flower[0] * 1.6, T.flower[1] * 1.6, T.flower[2] * 1.6], sw, false, null, 0, clear);
        }
      }
    } else {
      let fr = cr, fg = cg, fb = cb;
      if (flowerP > 0 && hash(seed, 70 + i) < flowerP) { const f = (0.35 + hash(seed, 80 + i) * 0.4) * (T.strings ? 0.3 : 1); fr += (T.flower[0] - fr) * f; fg += (T.flower[1] - fg) * f; fb += (T.flower[2] - fb) * f; }
      g.rgb(fr, fg, fb).sway(sw);
      const from = g.count; g.ball(bx, Math.max(by - (T.droop ? br * 0.5 : 0), clear + br * sq), bz, br * (0.7 + 0.3 * thin), 7, 4, sq, 0.32, seed + i);
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

// Cột biển tên phố: thép tròn Ø 10 cm, đỉnh cao 2,6 m. Biển gắn sau bằng signPlate.
export function namePole(g, x, z, y = 0) {
  g.push().move(x, y, z).glow(0).mat();
  g.rgb(0.3, 0.3, 0.29).gloss(0).cyl(0, 0, 0, 0.1, 0.085, 0.06, 5, true);
  g.rgb(0.33, 0.35, 0.37).gloss(0.4).cyl(0, 0.06, 0, 0.052, 0.048, 2.58, 6, true);
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
  for (const s of [-1, 1]) {
    g.rgb(0.5, 0.52, 0.52).tube([s * 0.1, 0.02, 0.2], [s * 0.2, 0.04, 0.2], 0.085, 6).tube([s * 0.2, 0.04, 0.2], [s * 0.62, 0.09, 0.2], 0.06, 8, 0.23);
    // miệng loa nhìn chính diện: vành xám, lòng loa tối, củ loa ở giữa
    g.push().move(s * 0.612, 0.089, 0.2).rotZ(-s * Math.PI / 2).disc(0, 0, 0, 0.235, 8, 1).rgb(0.06, 0.06, 0.065).disc(0, 0.008, 0, 0.185, 8, 1).rgb(0.42, 0.44, 0.44).disc(0, 0.016, 0, 0.055, 6, 1).pop();
  }
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
