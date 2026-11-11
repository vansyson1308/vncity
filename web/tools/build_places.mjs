// Gom các điểm đóng dấu hộ chiếu cho bản web từ nội dung game:
//   game/content/world/landmarks.json (địa danh, toạ độ đã kiểm chứng với OSM) + web/content/foods.json (món ăn theo phố)
// → web/public/world/places.json. Chỉ giữ điểm nằm trong khung bản đồ của bản web.
import fs from 'node:fs';
import path from 'node:path';

const world = JSON.parse(fs.readFileSync(path.resolve('public/world/hanoi.json'), 'utf8'));
const [x0, z0, x1, z1] = world.bounds.map((v) => v / 10), O = world.origin;
const XZ = (lat, lon) => [(lon - O.lon) * world.mPerLon, -(lat - O.lat) * world.mPerLat];
const ICON = { lake: '🌊', temple: '⛩️', pagoda: '🛕', church: '⛪', bridge: '🌉', market: '🧺', museum: '🏛️', theatre: '🎭', station: '🚉', monument: '🗿', gate: '🏯', street: '🏮', park: '🌳', colonial_building: '🏛️', other: '📍', modern_tower: '🏙️' };
// Điểm trang nghiêm: chỉ đi bộ, không nhận cuốc xe (docs/gdd/00, mục "Địa điểm trang nghiêm")
const SOLEMN = new Set(['lang_bac', 'quang_truong_ba_dinh', 'phu_chu_tich']);
// Trang hộ chiếu theo khu
function page(x, z) {
  if (z < -1300 && x < -900) return 'hotay';
  if (x < -820) return 'badinh';
  if (z > 130) return 'phophap';
  if (z < -290 || x < -330 && z < -100) return 'phoco';
  return 'hoguom';
}
const items = [];
const lm = JSON.parse(fs.readFileSync(path.resolve('../game/content/world/landmarks.json'), 'utf8')).items;
for (const l of lm) {
  const [x, z] = XZ(l.location.lat, l.location.lon);
  if (x < x0 + 40 || x > x1 - 40 || z < z0 + 40 || z > z1 - 40) continue;
  items.push({ id: l.id, kind: l.kind === 'street' ? 'culture' : 'landmark', type: l.kind, icon: ICON[l.kind] || '📍', name: l.name, desc: l.description, year: l.built_year || null, x: +x.toFixed(1), z: +z.toFixed(1), page: page(x, z), solemn: SOLEMN.has(l.id) || undefined });
}
const foods = JSON.parse(fs.readFileSync(path.resolve('content/foods.json'), 'utf8')).items;
const roads = world.roads.map((r) => { const p = []; let x = 0, z = 0; for (let i = 0; i < r[5].length; i += 2) { x += r[5][i]; z += r[5][i + 1]; p.push([x / 10, z / 10]); } return { name: world.names[r[3]], p }; });
for (const f of foods) {
  // đặt vào giữa đoạn dài nhất của con phố có tên trong OSM
  const rs = roads.filter((r) => r.name === f.street); if (!rs.length) { console.warn('Không thấy phố', f.street); continue; }
  let best = null, bl = -1;
  for (const r of rs) { let l = 0; for (let i = 0; i < r.p.length - 1; i++) l += Math.hypot(r.p[i + 1][0] - r.p[i][0], r.p[i + 1][1] - r.p[i][1]); if (l > bl) { bl = l; best = r; } }
  let half = bl / 2, pt = best.p[0];
  for (let i = 0; i < best.p.length - 1; i++) { const d = Math.hypot(best.p[i + 1][0] - best.p[i][0], best.p[i + 1][1] - best.p[i][1]); if (half <= d) { const t = half / d; pt = [best.p[i][0] + (best.p[i + 1][0] - best.p[i][0]) * t, best.p[i][1] + (best.p[i + 1][1] - best.p[i][1]) * t]; break; } half -= d; }
  items.push({ id: f.id, kind: f.kind, type: f.kind, icon: f.icon, name: f.name, desc: f.description, street: f.street, price: f.price || 0, x: +pt[0].toFixed(1), z: +pt[1].toFixed(1), page: page(pt[0], pt[1]) });
}
fs.writeFileSync(path.resolve('public/world/places.json'), JSON.stringify({ pages: ['hoguom', 'phoco', 'phophap', 'badinh', 'hotay'], items }));
const by = {}; for (const i of items) by[i.page] = (by[i.page] || 0) + 1;
console.log(items.length, 'điểm →', 'public/world/places.json', by);
