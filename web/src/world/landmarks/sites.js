// Vị trí và hướng của các công trình dựng tay. Dùng chung cho worker (bỏ khối nhà OSM trùng chỗ) và luồng chính (đặt mô hình).
// yaw: mặt chính (+z của mô hình) quay về hướng (sin yaw, cos yaw): 0 = nam, π/2 = đông, π = bắc, -π/2 = tây.
// name: lấy tâm toà nhà OSM có tên đó; không có thì dùng at [x, z] (mét, gốc ở Hồ Gươm).
// open: người chơi đi xuyên qua được (cổng, cầu) nên không giữ va chạm của khối nhà OSM.
const H = Math.PI / 2;
export const SITES = [
  { id: 'thap_rua', name: 'Tháp Rùa', at: [10, 103], yaw: 0, clear: 14 },
  // paths: lối đi phải thông, toạ độ mô hình [x0, z0, x1, z1, nửa bề rộng]. Nhà trong dữ liệu bản đồ chắn ngang lối này thì bỏ
  // (OSM vẽ cổng Đắc Nguyệt Lâu ở đầu cầu thành một "ngôi nhà" mỏng nằm chắn giữa lối lên cầu).
  { id: 'cau_the_huc', at: [83.5, -215.5], yaw: Math.atan2(37.5 - 83.5, -220.0 + 215.5), open: true, clear: 0, paths: [[0, -26, 0, 0.5, 2.4], [0, 45.7, 0, 52, 2.4]],
    // lầu Đắc Nguyệt ở đầu cầu phía đảo (mô hình gắn vào lưới cầu, tâm ở z = 47,9): hai khối tường hai bên cửa
    solid: [[1.2, 46.01, 2.83, 49.79], [2.83, 47.63, 4.9, 48.17], [-2.83, 46.01, -1.2, 49.79], [-4.9, 47.63, -2.83, 48.17]] },
  // cổng ngoài cách đầu cầu 24 m: Nghi môn, Tháp Bút (bên trái), Đài Nghiên rồi tới cầu
  // solid: các khối đặc hai bên lối đi (toạ độ mô hình, đối xứng qua trục x = 0): trụ và tường cổng ngoài, gò Tháp Bút,
  // cổng Đài Nghiên. Lối giữa rộng ít nhất 2,4 m luôn để trống.
  { id: 'ngoc_son_gate', at: [83.5 + 0.9957 * 24, -215.5 + 0.0974 * 24], yaw: Math.atan2(0.9957, 0.0974), open: true, clear: 9,
    solid: [[1.58, -0.67, 2.92, 0.67], [2.75, -0.31, 6.35, 0.31], [6.18, -0.54, 7.26, 0.54], [-2.92, -0.67, -1.58, 0.67], [-6.35, -0.31, -2.75, 0.31], [-7.26, -0.54, -6.18, 0.54],
      [-8.9, -10.8, -3.0, -5.2],
      [1.25, -18.7, 2.7, -17.3], [2.51, -18.56, 3.63, -17.44], [3.46, -18.27, 5.6, -17.73], [-2.7, -18.7, -1.25, -17.3], [-3.63, -18.56, -2.51, -17.44], [-5.6, -18.27, -3.46, -17.73]] },
  { id: 'ly_thai_to', at: [218, 122], yaw: -H, clear: 0 },
  { id: 'nha_tho_lon', name: 'Nhà thờ Lớn', at: [-362, 25], yaw: H },
  { id: 'nha_hat_lon', name: 'Nhà hát Lớn', at: [591, 513], yaw: -H },
  { id: 'o_quan_chuong', name: 'Ô Quan Chưởng', at: [-2, -943], yaw: H, open: true, solid: [[-10, -3.5, -2.0, 3.5], [2.0, -3.5, 10, 3.5]] },
  { id: 'cho_dong_xuan', name: 'Chợ Đồng Xuân', at: [-301, -1025], yaw: -H },
  { id: 'ga_ha_noi', name: 'Ga Hà Nội', at: [-1210, 421], yaw: H },
  { id: 'lang_bac', name: 'Lăng Chủ tịch Hồ Chí Minh', at: [-1815, -881], yaw: H },
  // lift: nâng mô hình để mặt nước ao sen (y = -0,3 trong mô hình) nổi trên nền đất thành một bể xây
  { id: 'chua_mot_cot', name: 'Chùa Một Cột', at: [-1931, -780], yaw: 0, open: true, lift: 0.4, solid: [[-8.6, -8.6, 8.6, 8.6]] },
  { id: 'cot_co', name: 'Cột cờ Hà Nội', at: [-1286, -419], yaw: 0 },
  { id: 'khue_van_cac', name: 'Khuê Văn Các', at: [-1720, 39], yaw: 0, open: true, solid: [[-3.4, -3.4, -2.3, -2.3], [2.3, -3.4, 3.4, -2.3], [-3.4, 2.3, -2.3, 3.4], [2.3, 2.3, 3.4, 3.4]] },
  { id: 'thap_tran_quoc', name: 'Bảo tháp Lục độ đài sen', at: [-1567, -2121], yaw: 0 },
];

// Tìm vị trí thật trên bản đồ (cần danh sách toà nhà, tức là chạy trong worker hoặc Node).
export function resolveSites(world) {
  return SITES.map((s) => {
    let x = s.at[0], z = s.at[1], found = false;
    if (s.name && world.buildings) {
      let best = null; for (const b of world.buildings) if (world.names[b.name] === s.name && (!best || b.area > best.area)) best = b;
      if (best) { x = best.cx; z = best.cz; found = true; }
    }
    return { id: s.id, x, z, yaw: s.yaw, names: s.name ? [s.name] : null, clear: s.clear ?? 0, open: !!s.open, solid: s.solid || null, paths: s.paths || null, lift: s.lift || 0, found };
  });
}

// Các khối đặc của một công trình (khai báo `solid` trong hệ toạ độ mô hình) đổi ra đoạn va chạm thế giới
// [ax, az, bx, bz, cao] × n. Dùng chung cho game (landmarks/index.js) và công cụ kiểm tra lối đi (tools/reach_check.mjs).
export function siteSolids(s) {
  const col = []; if (!s.solid) return new Float32Array(0);
  const c = Math.cos(s.yaw), sn = Math.sin(s.yaw), W = (lx, lz) => [s.x + lx * c + lz * sn, s.z - lx * sn + lz * c];
  for (const [x0, z0, x1, z1] of s.solid) { const P = [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)]; for (let i = 0; i < 4; i++) col.push(P[i][0], P[i][1], P[(i + 1) % 4][0], P[(i + 1) % 4][1], 8); }
  return new Float32Array(col);
}
// Mặt cầu đi bộ được (cầu Thê Húc): tim cầu từ đầu bờ tới đầu đảo, rộng 2,6 m, vồng 1,25 m ở giữa.
export const THE_HUC_LEN = 46.2;
export function siteDecks(sites) {
  const th = sites.find((s) => s.id === 'cau_the_huc'); if (!th) return [];
  return [{ ax: th.x, az: th.z, bx: th.x + Math.sin(th.yaw) * THE_HUC_LEN, bz: th.z + Math.cos(th.yaw) * THE_HUC_LEN, w: 2.6, y: (t) => 0.35 + 1.25 * Math.sin(Math.PI * t) }];
}
// Các lối đi phải thông của công trình, đổi ra toạ độ thế giới: [[ax, az, bx, bz, nửa bề rộng], ...].
export function sitePaths(s) {
  if (!s.paths) return [];
  const c = Math.cos(s.yaw), sn = Math.sin(s.yaw), W = (lx, lz) => [s.x + lx * c + lz * sn, s.z - lx * sn + lz * c];
  return s.paths.map(([x0, z0, x1, z1, hw]) => [...W(x0, z0), ...W(x1, z1), hw]);
}
// Mặt bằng khối đặc của một mô hình: hộp bao (toạ độ mô hình) của mọi đỉnh ở tầm thân người (0,7 đến 3 m).
// Công trình kín (không `open`, không khai `solid`) dùng hộp này làm va chạm, để người và camera không chui vào lòng mô hình
// khi mô hình to hơn khối nhà trong dữ liệu bản đồ. pos: mảng toạ độ đỉnh [x, y, z, ...].
export function modelFootprint(pos) {
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  for (let i = 0; i < pos.length; i += 3) { const y = pos[i + 1]; if (y < 0.7 || y > 3) continue; const x = pos[i], z = pos[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  return x1 > x0 ? [x0, z0, x1, z1] : null;
}
// Đoạn va chạm của công trình s có lưới đỉnh pos: theo `solid` nếu có khai, không thì theo mặt bằng mô hình (công trình kín).
// Mặt bằng khối đặc của mô hình theo đúng hình dạng: chiếu mọi tam giác cắt tầm thân người (0,7 đến 2,1 m: mái, ô văng, dầm cửa cao
// hơn đầu người không chắn lối) xuống lưới 0,25 m, lấy đường viền các ô đã phủ (sau khi đóng hình, xem dưới; cạnh thẳng hàng liền
// nhau gộp làm một) làm tường va chạm, toạ độ mô hình [ax, az, bx, bz] × n. Một hộp bao chung cho cả mô hình chắn luôn những góc trống
// của mặt bằng chữ T, chữ L (Lăng: thân lăng với hai khán đài, tường tàng hình tới 15 m). Lưới 1 m trước đây để tường tàng hình tới
// 1 m trước mặt tường thật, và cả dải ô văng trên cửa ga Hà Nội thành tường (tester vòng 4: 1–1,85 m).
// Bình phương khoảng cách (tính bằng ô) từ mỗi ô tới ô `on` gần nhất (biến đổi khoảng cách Euclid chính xác, Felzenszwalb–Huttenlocher).
function sqDist(on, NX, NZ) {
  const INF = 1e12, n = Math.max(NX, NZ), f = new Float64Array(n), g = new Float64Array(n), v = new Int32Array(n), zk = new Float64Array(n + 1), D = new Float64Array(NX * NZ);
  const pass = (len) => { // f → g theo một hàng
    let k = 0; v[0] = 0; zk[0] = -INF; zk[1] = INF;
    for (let q = 1; q < len; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= zk[k]) { k--; s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; zk[k] = s; zk[k + 1] = INF;
    }
    k = 0; for (let q = 0; q < len; q++) { while (zk[k + 1] < q) k++; g[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  };
  for (let i = 0; i < NX; i++) { for (let j = 0; j < NZ; j++) f[j] = on[i * NZ + j] ? 0 : INF; pass(NZ); for (let j = 0; j < NZ; j++) D[i * NZ + j] = g[j]; }
  for (let j = 0; j < NZ; j++) { for (let i = 0; i < NX; i++) f[i] = D[i * NZ + j]; pass(NX); for (let i = 0; i < NX; i++) D[i * NZ + j] = g[i]; }
  return D;
}
export function modelOutline(pos, idx, C = 0.25) {
  const LO = 0.7, HI = 2.1, R = Math.round(2 / C), M = R + 3; // R: đóng khe dưới 4 m; M: lề lưới
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  const keep = (t) => { const ya = pos[idx[t] * 3 + 1], yb = pos[idx[t + 1] * 3 + 1], yd = pos[idx[t + 2] * 3 + 1]; return !(Math.max(ya, yb, yd) < LO || Math.min(ya, yb, yd) > HI); };
  for (let t = 0; t < idx.length; t += 3) { if (!keep(t)) continue; for (let k = 0; k < 3; k++) { const x = pos[idx[t + k] * 3], z = pos[idx[t + k] * 3 + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; } }
  if (!(x1 >= x0)) return [];
  const I0 = Math.floor(x0 / C) - M, J0 = Math.floor(z0 / C) - M, NX = Math.floor(x1 / C) - I0 + M + 1, NZ = Math.floor(z1 / C) - J0 + M + 1, occ = new Uint8Array(NX * NZ);
  const mark = (x, z) => { occ[(Math.floor(x / C) - I0) * NZ + Math.floor(z / C) - J0] = 1; };
  for (let t = 0; t < idx.length; t += 3) {
    if (!keep(t)) continue;
    const ax = pos[idx[t] * 3], az = pos[idx[t] * 3 + 2], bx = pos[idx[t + 1] * 3], bz = pos[idx[t + 1] * 3 + 2], dx = pos[idx[t + 2] * 3], dz = pos[idx[t + 2] * 3 + 2];
    const L = Math.max(Math.hypot(bx - ax, bz - az), Math.hypot(dx - ax, dz - az), Math.hypot(dx - bx, dz - bz)), area = Math.abs((bx - ax) * (dz - az) - (dx - ax) * (bz - az));
    if (area < L * C * 0.1) { // mặt đứng (chiếu xuống gần thành một đường): chỉ vạch ba cạnh
      for (const [px, pz, qx, qz] of [[ax, az, bx, bz], [bx, bz, dx, dz], [dx, dz, ax, az]]) { const n = Math.max(1, Math.ceil(Math.hypot(qx - px, qz - pz) / (C * 0.4))); for (let k = 0; k <= n; k++) mark(px + ((qx - px) * k) / n, pz + ((qz - pz) * k) / n); }
      continue;
    }
    const st = 1 / Math.max(1, Math.ceil(L / (C * 0.45)));
    for (let u = 0; u <= 1 + 1e-9; u += st) for (let v = 0; u + v <= 1 + 1e-9; v += st) mark(ax + (bx - ax) * u + (dx - ax) * v, az + (bz - az) * u + (dz - az) * v);
  }
  // Đóng hình: lòng nhà rỗng (mô hình chỉ có vỏ) và khe dưới 4 m (cửa vòm, ô cửa) không thành lối vào. Nở R ô, loang từ ngoài vào
  // phần chưa phủ, rồi lấy mọi ô cách phần bên ngoài quá R ô (= nở rồi co lại, lấp cả lỗ bên trong).
  const N = NX * NZ, dOcc = sqDist(occ, NX, NZ), out = new Uint8Array(N), q = [0]; out[0] = 1;
  while (q.length) { const c = q.pop(), i = Math.floor(c / NZ), j = c % NZ; for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) { if (a < 0 || b < 0 || a >= NX || b >= NZ) continue; const n = a * NZ + b; if (!out[n] && dOcc[n] > R * R) { out[n] = 1; q.push(n); } } }
  const dOut = sqDist(out, NX, NZ), cell = new Uint8Array(N); for (let c = 0; c < N; c++) cell[c] = occ[c] || dOut[c] > R * R ? 1 : 0;
  // cạnh biên: ngang (theo x) ở z = j hoặc j + 1, dọc (theo z) ở x = i hoặc i + 1; gom theo hàng rồi nối đoạn liền nhau
  const H = new Map(), V = new Map(), push = (Mp, k, v) => { let l = Mp.get(k); if (!l) Mp.set(k, (l = [])); l.push(v); }, has = (i, j) => i >= 0 && j >= 0 && i < NX && j < NZ && cell[i * NZ + j] === 1;
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
    if (!cell[i * NZ + j]) continue;
    if (!has(i, j - 1)) push(H, j, i); if (!has(i, j + 1)) push(H, j + 1, i);
    if (!has(i - 1, j)) push(V, i, j); if (!has(i + 1, j)) push(V, i + 1, j);
  }
  const res = [], X = (i) => (i + I0) * C, Z = (j) => (j + J0) * C;
  for (const [line, l] of H) { l.sort((p, r) => p - r); let s0 = l[0], e = l[0] + 1; for (let n = 1; n <= l.length; n++) { if (n < l.length && l[n] === e) { e++; continue; } res.push([X(s0), Z(line), X(e), Z(line)]); if (n < l.length) { s0 = l[n]; e = l[n] + 1; } } }
  for (const [line, l] of V) { l.sort((p, r) => p - r); let s0 = l[0], e = l[0] + 1; for (let n = 1; n <= l.length; n++) { if (n < l.length && l[n] === e) { e++; continue; } res.push([X(line), Z(s0), X(line), Z(e)]); if (n < l.length) { s0 = l[n]; e = l[n] + 1; } } }
  return res;
}
// Bậc thềm, nền thấp, dốc thoải của mô hình: các mặt ngửa lên (dốc dưới 53°) cao tới 0,7 m so với chân mô hình (cao hơn thì đã là
// tường có va chạm, xem modelOutline). Ghi vào lưới 0,25 m theo trục thế giới, mỗi ô giữ cao độ cao nhất của các mặt phủ ô đó (cm, cao độ
// thế giới, theo đúng độ dốc của mặt); nav.groundY lấy cao độ đó, nên người, xe đứng trên mặt bậc chứ không lún chân vào trong bậc
// (tester vòng 4: bậc thềm ga Hà Nội che chân tới gối). base: cao độ chân mô hình.
export function modelPads(s, pos, idx, base) {
  const c = Math.cos(s.yaw), sn = Math.sin(s.yaw), C = 0.125, W = (lx, lz) => [s.x + lx * c + lz * sn, s.z - lx * sn + lz * c], tris = [];
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, d = idx[t + 2] * 3, ya = pos[a + 1], yb = pos[b + 1], yd = pos[d + 1], hi = Math.max(ya, yb, yd);
    if (hi < 0.06 || hi > 0.7 || Math.min(ya, yb, yd) < -0.01) continue;
    const ux = pos[b] - pos[a], uy = yb - ya, uz = pos[b + 2] - pos[a + 2], vx = pos[d] - pos[a], vy = yd - ya, vz = pos[d + 2] - pos[a + 2];
    const ny = uz * vx - ux * vz, nl = Math.hypot(uy * vz - uz * vy, ny, ux * vy - uy * vx); if (!(nl > 1e-6) || Math.abs(ny) < 0.6 * nl) continue; // mặt đứng, dốc gắt
    const P = [W(pos[a], pos[a + 2]), W(pos[b], pos[b + 2]), W(pos[d], pos[d + 2])];
    tris.push(P, [ya, yb, yd]); for (const q of P) { x0 = Math.min(x0, q[0]); z0 = Math.min(z0, q[1]); x1 = Math.max(x1, q[0]); z1 = Math.max(z1, q[1]); }
  }
  if (!tris.length) return null;
  x0 = Math.floor(x0 / C) * C - C; z0 = Math.floor(z0 / C) * C - C;
  const nx = Math.ceil((x1 - x0) / C) + 2, nz = Math.ceil((z1 - z0) / C) + 2, h = new Uint8Array(nx * nz);
  // Cao độ của mỗi ô lấy tại TÂM ô (mặt cao nhất phủ lên tâm ô), không lấy mặt cao nhất chạm vào bất kỳ chỗ nào trong ô: lấy theo cả
  // ô thì ô ở mép bệ, mép bậc chỉ chạm mép mặt trên một chút cũng mang cao độ mặt trên, người đứng ngoài mép bệ mà chân lơ lửng tới
  // 0,3 m (tester vòng 5: mép bệ tháp Trấn Quốc, tượng Lý Thái Tổ). Ô 0,125 m, lấy theo tâm ô thì mép mặt bậc lệch thật nhiều nhất
  // 6 cm; mặt bậc nào cũng sâu hơn một ô nên bậc thang không bị sót bậc. (Cả bản đồ chừng 470 KB.)
  for (let k = 0; k < tris.length; k += 2) {
    const [A, B, D] = tris[k], [ya, yb, yd] = tris[k + 1];
    const e1x = B[0] - A[0], e1z = B[1] - A[1], e2x = D[0] - A[0], e2z = D[1] - A[1], det = e1x * e2z - e2x * e1z; if (Math.abs(det) < 1e-9) continue;
    const i0 = Math.max(0, Math.floor((Math.min(A[0], B[0], D[0]) - x0) / C)), i1 = Math.min(nx - 1, Math.floor((Math.max(A[0], B[0], D[0]) - x0) / C));
    const j0 = Math.max(0, Math.floor((Math.min(A[1], B[1], D[1]) - z0) / C)), j1 = Math.min(nz - 1, Math.floor((Math.max(A[1], B[1], D[1]) - z0) / C));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const px = x0 + (i + 0.5) * C - A[0], pz = z0 + (j + 0.5) * C - A[1], u = (px * e2z - e2x * pz) / det, v = (e1x * pz - px * e1z) / det;
      if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
      const q = i * nz + j, y = Math.min(255, Math.round((base + ya + (yb - ya) * u + (yd - ya) * v) * 100)); if (y > h[q]) h[q] = y;
    }
  }
  return { x0, z0, x1: x0 + nx * C, z1: z0 + nz * C, c: C, nz, h };
}

// Đoạn va chạm của công trình s (mô hình có đỉnh pos, chỉ số tam giác idx): theo `solid` nếu có khai, không thì theo mặt bằng mô hình
// (công trình kín). Khối nhà OSM tương ứng không giữ va chạm nữa (gen/buildings.js): mặt bằng OSM lệch mô hình tới 15 m, thành tường
// tàng hình trước cửa chợ Đồng Xuân, Nhà thờ Lớn, Nhà hát Lớn.
export function siteCollision(s, pos, idx = null) {
  if (s.solid) return siteSolids(s);
  if (s.open) return new Float32Array(0);
  if (idx && idx.length) {
    const L = modelOutline(pos, idx);
    if (L.length) { const c = Math.cos(s.yaw), sn = Math.sin(s.yaw), col = []; for (const [ax, az, bx, bz] of L) col.push(s.x + ax * c + az * sn, s.z - ax * sn + az * c, s.x + bx * c + bz * sn, s.z - bx * sn + bz * c, 8); return new Float32Array(col); }
  }
  const f = modelFootprint(pos); return f ? siteSolids({ ...s, solid: [f] }) : new Float32Array(0);
}

// Chỗ đứng thay thế khi điểm đặt người chơi (x, z) rơi xuống nước hay vào lòng nhà (tham số at/street/site của đường dẫn: dùng để chụp
// ảnh kiểm tra, người chơi dán lại đường dẫn cũng dùng được). Dò từng vòng quanh điểm đó, lấy chỗ gần nhất không dưới nước, không trong
// lòng khối đặc, đủ rộng cho một người và có đường, lối đi trong vòng 45 m (để không rơi lên gò đảo giữa hồ). tg: công trình cần nhìn
// {x, z} (tham số site): trong 40 m kể từ chỗ trống đầu tiên, ưu tiên chỗ còn nhìn thông tới công trình. nav: world/nav.js, các ô quanh
// điểm đặt đã nạp va chạm. Trả về [x, z], hoặc null nếu trong 120 m không có chỗ nào.
// Số hướng (trong 8 hướng) đi được 3 m từ (x, z) mà không vướng tường hay xuống nước: dưới 3 là chỗ bị vây kín (sân trong, góc rào).
export function openWays(nav, x, z) { let n = 0; for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; if (nav.freeStep(x, z, x + Math.sin(a) * 3, z + Math.cos(a) * 3, 0.3)) n++; } return n; }
export function freeSpot(nav, x0, z0, tg = null) {
  const b = nav.b, m = 10, onDeck = (x, z) => nav.decks.length > 0 && !!nav.deckAt(x, z, 0.3);
  const free = (x, z) => x > b.x0 + m && x < b.x1 - m && z > b.z0 + m && z < b.z1 - m && (!nav.isWater(x, z) || onDeck(x, z)) && nav.clearAt(x, z, 0.6) && !!nav.nearestRoad(x, z, 45, (r) => !r.bridge) && !nav.inSolid(x, z) && openWays(nav, x, z) >= 3;
  // nhìn thông: tia từ chỗ đứng, và hai tia lệch ngang 4 m xuất phát từ chỗ camera (sau lưng 4 m), để khung hình không bị một góc nhà
  // ngay cạnh che mất nửa công trình
  const sees = (x, z) => {
    const dx = tg.x - x, dz = tg.z - z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, need = Math.min(d - 10, 45); if (need <= 0) return true;
    for (const o of [0, -4, 4]) { const b = o ? 4 : 0, L = need + b; if (nav.raycast(x - ux * b - uz * o, z - uz * b + ux * o, ux, uz, L, 1.6) < L - 0.01) return false; }
    return true;
  };
  let first = null;
  for (let r = 2; r <= 120 && !(first && (!tg || r > first[2] + 40)); r += 2) for (let k = 0, n = Math.max(8, Math.round(r * 1.6)); k < n; k++) {
    const a = (k / n) * Math.PI * 2, x = x0 + Math.sin(a) * r, z = z0 + Math.cos(a) * r; if (!free(x, z)) continue;
    if (!tg || sees(x, z)) return [x, z];
    if (!first) first = [x, z, r];
  }
  return first ? [first[0], first[1]] : null;
}
