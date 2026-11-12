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
export function siteCollision(s, pos) {
  if (s.solid) return siteSolids(s);
  if (s.open) return new Float32Array(0);
  const f = modelFootprint(pos); return f ? siteSolids({ ...s, solid: [f] }) : new Float32Array(0);
}

// Chỗ đứng thay thế khi điểm đặt người chơi (x, z) rơi xuống nước hay vào lòng nhà (tham số at/street/site của đường dẫn: dùng để chụp
// ảnh kiểm tra, người chơi dán lại đường dẫn cũng dùng được). Dò từng vòng quanh điểm đó, lấy chỗ gần nhất không dưới nước, không trong
// lòng khối đặc, đủ rộng cho một người và có đường, lối đi trong vòng 45 m (để không rơi lên gò đảo giữa hồ). tg: công trình cần nhìn
// {x, z} (tham số site): trong 40 m kể từ chỗ trống đầu tiên, ưu tiên chỗ còn nhìn thông tới công trình. nav: world/nav.js, các ô quanh
// điểm đặt đã nạp va chạm. Trả về [x, z], hoặc null nếu trong 120 m không có chỗ nào.
export function freeSpot(nav, x0, z0, tg = null) {
  const b = nav.b, m = 10, onDeck = (x, z) => nav.decks.length > 0 && !!nav.deckAt(x, z, 0.3);
  const free = (x, z) => x > b.x0 + m && x < b.x1 - m && z > b.z0 + m && z < b.z1 - m && (!nav.isWater(x, z) || onDeck(x, z)) && nav.clearAt(x, z, 0.6) && !!nav.nearestRoad(x, z, 45, (r) => !r.bridge) && !nav.inSolid(x, z);
  const sees = (x, z) => { const dx = tg.x - x, dz = tg.z - z, d = Math.hypot(dx, dz) || 1, need = Math.min(d - 10, 45); return need <= 0 || nav.raycast(x, z, dx / d, dz / d, need, 1.6) >= need - 0.01; };
  let first = null;
  for (let r = 2; r <= 120 && !(first && (!tg || r > first[2] + 40)); r += 2) for (let k = 0, n = Math.max(8, Math.round(r * 1.6)); k < n; k++) {
    const a = (k / n) * Math.PI * 2, x = x0 + Math.sin(a) * r, z = z0 + Math.cos(a) * r; if (!free(x, z)) continue;
    if (!tg || sees(x, z)) return [x, z];
    if (!first) first = [x, z, r];
  }
  return first ? [first[0], first[1]] : null;
}
