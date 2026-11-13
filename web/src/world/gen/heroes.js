// Bảng công trình có tên (art bible mục 3.5, 3.6): ghi đè số tầng, chiều cao, màu tường, màu mái, kiểu mặt đứng và một dấu hiệu nhận biết.
// Khoá theo tên toà nhà trong OpenStreetMap (name), hoặc theo toạ độ tâm (at, mét, gốc Hồ Gươm) khi bản đồ không ghi tên.
// 14 công trình dựng tay trong world/landmarks/ không nằm ở đây. Số tầng, màu, dấu hiệu lấy từ art bible; mặt bằng lấy từ bản đồ.
//   style: kiểu mặt đứng (ST.*)        floors, h, fh: số tầng, chiều cao (m), chiều cao tầng
//   wall, roofTint: chỉ số màu (HC.*)   up, gnd: lớp tầng trên, tầng trệt (L.*)      parapet: tường chắn mái (m)
//   roof: ST.ROOF_*; slate: mái dốc lợp đá phiến xám thay cho ngói đỏ
//   towers: khối tháp mọc trên khối đế [{ at: [x, z] hoặc bỏ trống (tâm nhà), w, d, floors, fh, wall, up }]
//   feat: dấu hiệu nhận biết, dựng ở gen/decor.js (drawHero)
//   gone: công trình đã phá dỡ, bỏ khỏi bản đồ và để lại quảng trường (mục 3.6)
import { ST } from '../data.js';
import { L } from '../layers.js';
import { HC } from '../signs.js';

export const HERO_TEXT = ['BƯU ĐIỆN HÀ NỘI', 'GA LONG BIÊN', 'CHỢ HÀNG DA', 'MAISON CENTRALE'];
export const HEROES = [
  // ----- quanh Hồ Gươm, khu phố Pháp -----
  { name: 'Tràng Tiền Plaza', style: ST.PUBLIC, floors: 6, h: 30, wall: HC.cream, up: L.FR_UP, gnd: L.MOD_GND, parapet: 1.2, roof: ST.ROOF_FLAT, roofTint: HC.slate, age: 0, feat: { domes: { n: 3, r: 4.2, col: [0.3, 0.32, 0.35] }, bulbs: { ys: [5.0, 30.95] } } },
  { name: 'Tòa nhà trung tâm Bưu điện Hà Nội', style: ST.PUBLIC, floors: 5, h: 25, wall: HC.paleYellow, up: L.RIB, gnd: L.PUB_GND, parapet: 1, roof: ST.ROOF_FLAT, age: 1, feat: { clock: { dir: [-1, 0], text: 0 } } },
  { at: [403, 363], label: 'Sofitel Legend Metropole', style: ST.FRENCH, floors: 4, fh: 3.9, wall: HC.white, up: L.FR_UP, gnd: L.FR_GND, roof: ST.ROOF_TILE, slate: true, roofTint: HC.slate, age: 0, feat: { canopy: { col: [0.03, 0.03, 0.035] } } },
  { name: 'Ngân hàng Nhà nước Việt Nam', style: ST.PUBLIC, floors: 3, h: 20, wall: HC.washed, up: L.RIB, gnd: L.STONE, parapet: 1.4, roof: ST.ROOF_FLAT, age: 1, feat: { tiered: { tiers: 2, r: 9, col: [0.2, 0.21, 0.23] } } },
  { name: 'Bắc Bộ Phủ', style: ST.FRENCH, floors: 2, fh: 5, wall: HC.paleYellow, up: L.FR_UP, gnd: L.FR_GND, roof: ST.ROOF_TILE, slate: true, roofTint: HC.slate, age: 0 },
  { at: [791, 483], label: 'Bảo tàng Lịch sử Quốc gia', style: ST.PUBLIC, floors: 2, h: 13, wall: HC.ochre, up: L.PUB_UP, gnd: L.PUB_GND, roof: ST.ROOF_TILE, age: 1, feat: { tiered: { at: [786, 465], tiers: 3, r: 8.5, oct: true, col: [0.32, 0.1, 0.06] } } },
  { name: 'Hilton Hanoi Opera', style: ST.PUBLIC, floors: 7, fh: 3.5, wall: HC.cream, up: L.PUB_UP, gnd: L.FR_GND, parapet: 1.1, roof: ST.ROOF_FLAT, roofTint: HC.slate, age: 0, feat: { colonnade: { h: 7.2, col: [0.82, 0.78, 0.68] } } },
  { name: 'Nhà hát Hồ Gươm', style: ST.PUBLIC, floors: 6, h: 26, wall: HC.stone, up: L.RIB, gnd: L.RIB, parapet: 1.2, roof: ST.ROOF_FLAT, age: 0, feat: { colonnade: { h: 18, col: [0.74, 0.71, 0.63] }, dome: { r: 13, col: [0.42, 0.44, 0.46] } } },
  { name: 'Nhà hàng Thủy Tạ', style: ST.FRENCH, floors: 2, fh: 3.8, wall: HC.cream, up: L.FR_UP, gnd: L.S_CAFE, roof: ST.ROOF_TILE, age: 0 },
  { at: [-14, -367], r: 3, label: 'Nhà 7 Đinh Tiên Hoàng', style: ST.FRENCH, floors: 4, fh: 3.6, wall: HC.cream, up: L.FR_UP2, gnd: L.FR_GND, roof: ST.ROOF_TILE, age: 0 },
  { at: [-5, -366], r: 3, label: 'Nhà 9 Đinh Tiên Hoàng', style: ST.FRENCH, floors: 4, fh: 3.6, wall: HC.paleYellow, up: L.FR_UP, gnd: L.FR_GND, roof: ST.ROOF_TILE, age: 0 },
  { name: 'Tháp Hòa Phong', style: ST.PUBLIC, floors: 3, h: 10, wall: HC.brick, up: L.STONE, gnd: L.STONE, parapet: 0.4, roof: ST.ROOF_FLAT, age: 3, feat: { ledges: [3.6, 7], arch: { dirs: [[1, 0], [-1, 0], [0, 1], [0, -1]], w: 1.5, h: 2.6 } } },
  // ----- cao ốc -----
  { name: 'Tòa nhà Vietcombank', style: ST.MODERN, floors: 22, h: 88, wall: HC.glassBlue, up: L.MOD, gnd: L.MOD_GND, parapet: 2, age: 0, feat: { crown: { h: 3.2, col: [0.02, 0.33, 0.14] } } },
  { name: 'BIDV Tower', style: ST.MODERN, floors: 25, h: 100, wall: HC.stone, up: L.MOD + 1, gnd: L.MOD_GND, parapet: 2, age: 0 },
  { name: 'Tháp Hà Nội', label: 'Hanoi Towers', style: ST.MODERN, floors: 5, h: 20, wall: HC.beige, up: L.MOD + 1, gnd: L.MOD_GND, age: 1, towers: [{ at: [-656, 342], w: 22, d: 22, floors: 27, fh: 3.5, wall: HC.beige, up: L.MOD + 1 }, { at: [-626, 334], w: 22, d: 22, floors: 27, fh: 3.5, wall: HC.beige, up: L.MOD + 1 }, { at: [-640, 367], w: 28, d: 18, floors: 14, fh: 3.6, wall: HC.glassBronze, up: L.MOD }] },
  { name: 'Meliá Hà Nội', style: ST.MODERN, floors: 3, h: 14, wall: HC.white, up: L.MOD + 1, gnd: L.MOD_GND, age: 0, towers: [{ w: 50, d: 28, floors: 22, fh: 3.5, wall: HC.glassGreen, up: L.MOD }] },
  { name: 'Tòa nhà Pacific Place', style: ST.MODERN, floors: 19, h: 70, wall: HC.beige, up: L.MOD + 1, gnd: L.MOD_GND, parapet: 1.6, age: 0 }, // mặt bằng chữ U trong bản đồ không tách được khối đế và tháp
  { name: 'Capital Tower', style: ST.MODERN, floors: 23, h: 92, wall: HC.glassNavy, up: L.MOD, gnd: L.MOD_GND, parapet: 2, age: 0 },
  { name: 'Nhà tù Hỏa Lò', style: ST.PUBLIC, floors: 2, h: 7.5, wall: HC.stone, up: L.STONE, gnd: L.STONE, roof: ST.ROOF_TILE, age: 3, feat: { gate: { dir: [1, 0], text: 3 } } },
  // ----- phố cổ và phía bắc -----
  { name: 'Chợ Hàng Da', style: ST.PUBLIC, floors: 4, fh: 4.5, wall: HC.paleYellow, up: L.FR_UP2, gnd: L.MOD_GND, parapet: 1.2, roof: ST.ROOF_FLAT, roofTint: HC.slate, age: 1, feat: { domes: { n: 2, r: 3, col: [0.3, 0.32, 0.35] }, sign: { dir: [0, -1], text: 2 } } },
  // Chợ Long Biên (chợ đầu mối): các dãy lán bán buôn bản đồ ghi là nhà thương mại (building=retail) nên từng dựng thành nhà kính văn
  // phòng (QC vòng 4: "chợ trông như khu văn phòng"). Ngoài đời là lán một tầng mái tôn, cửa cuốn mở ra lối đi: kiểu mặt đứng chợ.
  // Bốn lán không tên trong cùng khu chợ khoá theo tâm mặt bằng.
  { name: ['Ngành hàng hoa quả', 'Ngành hàng trầu cau vỏ', 'Ngành hàng thuỷ sản'], style: ST.MARKET, roof: ST.ROOF_TIN, age: 2 },
  ...[[-193.18, -1427.14], [-155.8, -1444.23], [-149.63, -1416.85], [-208.2, -1399.92]].map((at) => ({ at, r: 2, label: 'Chợ Long Biên: lán không tên', style: ST.MARKET, roof: ST.ROOF_TIN, age: 2 })),
  { name: 'Ga Long Biên', style: ST.PUBLIC, floors: 2, h: 9, wall: HC.ochre, up: L.PUB_UP, gnd: L.PUB_GND, roof: ST.ROOF_TILE, age: 2, feat: { sign: { dir: [0, 1], text: 1 } } },
  { name: 'Tháp nước Hàng Đậu', style: ST.CHURCH, floors: 3, h: 21, wall: HC.washed, up: L.CHURCH, gnd: L.STONE, parapet: 0, roof: ST.ROOF_FLAT, age: 3, feat: { cone: { h: 4.6, col: [0.15, 0.155, 0.16] } } }, // mái tôn sẫm cho tách khỏi nền trời mù
  { name: 'Cửa Bắc', style: ST.PUBLIC, floors: 2, h: 8.7, wall: HC.brick, up: L.STONE, gnd: L.STONE, parapet: 0.7, roof: ST.ROOF_FLAT, age: 3, feat: { arch: { dirs: [[0, 1], [0, -1]], w: 3.4, h: 5.2 }, pavilion: { w: 6, d: 4 } } },
  // ----- Ba Đình -----
  { name: 'Phủ Chủ Tịch', style: ST.FRENCH, floors: 3, fh: 4.6, wall: HC.ochre, up: L.FR_UP, gnd: L.FR_GND, roof: ST.ROOF_TILE, slate: true, roofTint: HC.slate, age: 0 },
  // Nhà Quốc hội (art bible bảng 3.5: vuông 102 m, cao 39 m, đá be sáng, kính, kim loại màu đồng): tường là lớp kính ánh đồng, phía trước là
  // hàng lam đá be vàng cao suốt mặt đứng, băng đá chân và mái, cổng chính có quốc huy nhìn ra quảng trường (phía tây), phòng họp tròn nhô
  // lên giữa mái (cao hơn băng mái chừng 8 m để từ giữa quảng trường còn thấy). Bề rộng cổng, cỡ quốc huy (đường kính 6 m), bước lam,
  // chiều cao phòng họp là ước lượng, chưa đối chiếu bản vẽ.
  { name: 'Nhà Quốc hội', style: ST.PUBLIC, floors: 5, h: 39, wall: HC.glassBronze, up: L.MOD, gnd: L.MOD, parapet: 1.5, roof: ST.ROOF_FLAT, age: 0, feat: { drum: { r: 26, h: 10, col: [0.5, 0.36, 0.2] }, assembly: { dir: [-1, 0], col: [0.69, 0.56, 0.33], portal: 26, emblem: 3 } } },
  { name: 'Bảo tàng Hồ Chí Minh', style: ST.PUBLIC, floors: 3, h: 20, wall: HC.white, up: L.RIB, gnd: L.STONE, parapet: 0, roof: ST.ROOF_FLAT, age: 0, feat: { flare: { h: 6.5, out: 3.2, col: [0.86, 0.85, 0.82] } } },
  { name: 'Bộ Ngoại giao', style: ST.PUBLIC, floors: 3, fh: 4.5, wall: HC.ochre, up: L.PUB_UP, gnd: L.PUB_GND, roof: ST.ROOF_TILE, age: 1, feat: { tiered: { tiers: 2, r: 7, col: [0.32, 0.1, 0.06] } } },
  // hai lễ đài hai bên Lăng: khối đá granite thấp, không phải nhà nhiều tầng
  { at: [-1821, -820], r: 12, label: 'Lễ đài bắc', style: ST.PUBLIC, floors: 1, h: 3.4, wall: HC.granite, up: L.STONE, gnd: L.STONE, parapet: 0, roof: ST.ROOF_FLAT, age: 0 },
  { at: [-1798, -940], r: 12, label: 'Lễ đài nam', style: ST.PUBLIC, floors: 1, h: 3.4, wall: HC.granite, up: L.STONE, gnd: L.STONE, parapet: 0, roof: ST.ROOF_FLAT, age: 0 },
  // ----- đã phá dỡ -----
  { at: [-25, -368], r: 9, label: 'Hàm Cá Mập (1-3-5 Đinh Tiên Hoàng, phá dỡ tháng 8/2025)', gone: true },
];
// Công trình trong art bible không có trong dữ liệu bản đồ dưới dạng toà nhà (đã soát tên và toạ độ): Sân vận động Hàng Đẫy, Đoan Môn.

// world → Map(toà nhà → mục trong bảng). Tên trùng nhiều toà thì dấu hiệu nhận biết chỉ gắn cho toà lớn nhất.
export function resolveHeroes(world) {
  const map = new Map();
  for (const h of HEROES) {
    if (h.name) {
      const names = Array.isArray(h.name) ? h.name : [h.name], hit = world.buildings.filter((b) => b.name >= 0 && names.includes(world.names[b.name])).sort((a, b) => b.area - a.area);
      hit.forEach((b, i) => map.set(b, i ? { ...h, feat: null, towers: null } : h));
    } else if (h.at) {
      let best = null, bd = (h.r || 25) ** 2;
      for (const b of world.buildings) { const d = (b.cx - h.at[0]) ** 2 + (b.cz - h.at[1]) ** 2; if (d < bd) { bd = d; best = b; } }
      if (best) map.set(best, h);
    }
  }
  return map;
}
