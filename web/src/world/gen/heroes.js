// Bảng công trình có tên (art bible mục 3.5, 3.6): ghi đè số tầng, chiều cao, màu tường, màu mái, kiểu mặt đứng và một dấu hiệu nhận biết.
// Khoá theo tên toà nhà trong OpenStreetMap, hoặc theo toạ độ (mét, gốc Hồ Gươm) khi bản đồ không ghi tên.
// 14 công trình dựng tay trong world/landmarks/ không nằm ở đây.
export const HEROES = [];

// world → Map(toà nhà → mục trong bảng)
export function resolveHeroes(world) {
  const map = new Map();
  for (const h of HEROES) {
    if (h.name) { const names = Array.isArray(h.name) ? h.name : [h.name]; for (const b of world.buildings) if (b.name >= 0 && names.includes(world.names[b.name])) map.set(b, h); }
    if (h.at) { let best = null, bd = (h.r || 25) ** 2; for (const b of world.buildings) { const d = (b.cx - h.at[0]) ** 2 + (b.cz - h.at[1]) ** 2; if (d < bd) { bd = d; best = b; } } if (best) map.set(best, h); }
  }
  return map;
}
