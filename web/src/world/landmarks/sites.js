// Vị trí và hướng của các công trình dựng tay. Dùng chung cho worker (bỏ khối nhà OSM trùng chỗ) và luồng chính (đặt mô hình).
// yaw: mặt chính (+z của mô hình) quay về hướng (sin yaw, cos yaw): 0 = nam, π/2 = đông, π = bắc, -π/2 = tây.
// name: lấy tâm toà nhà OSM có tên đó; không có thì dùng at [x, z] (mét, gốc ở Hồ Gươm).
// open: người chơi đi xuyên qua được (cổng, cầu) nên không giữ va chạm của khối nhà OSM.
const H = Math.PI / 2;
export const SITES = [
  { id: 'thap_rua', name: 'Tháp Rùa', at: [10, 103], yaw: 0, clear: 14 },
  { id: 'cau_the_huc', at: [83.5, -215.5], yaw: Math.atan2(37.5 - 83.5, -220.0 + 215.5), open: true, clear: 0 },
  // cổng ngoài cách đầu cầu 24 m: Nghi môn, Tháp Bút (bên trái), Đài Nghiên rồi tới cầu
  { id: 'ngoc_son_gate', at: [83.5 + 0.9957 * 24, -215.5 + 0.0974 * 24], yaw: Math.atan2(0.9957, 0.0974), open: true, clear: 9 },
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
    return { id: s.id, x, z, yaw: s.yaw, names: s.name ? [s.name] : null, clear: s.clear ?? 0, open: !!s.open, solid: s.solid || null, lift: s.lift || 0, found };
  });
}
