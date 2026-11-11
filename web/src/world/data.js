// Giải mã bản đồ world/hanoi.json (xem tools/build_world.mjs) thành cấu trúc dùng trong game.
// Dùng chung cho luồng chính (đường, mặt nước, va chạm) và worker (dựng hình).
import { hash } from '../core/util.js';

export const CS = 128;        // cạnh một ô phố (m)
export const CURB = 0.16;     // vỉa hè cao hơn lòng đường (m)
export const WATER_Y = -0.55; // mặt nước hồ thấp hơn bờ kè
export const K = { primary: 0, secondary: 1, tertiary: 2, residential: 3, service: 4, pedestrian: 5, footway: 6, path: 7, steps: 8, track: 9 };
export const CAT = { house: 0, apart: 1, modern: 2, public: 3, temple: 4, church: 5, roof: 6, small: 7, station: 8, market: 9 };
export const F_ONEWAY = 1, F_BRIDGE = 2, F_PASSAGE = 4, F_REVERSE = 8;

// Kiểu mặt đứng (khớp với shader trong world/facades.js)
export const ST = { ROOF_FLAT: 0, ROOF_TILE: 1, ROOF_TIN: 2, TUBE: 10, ALLEY: 11, BLANK: 12, FRENCH: 13, MODERN: 14, APART: 15, PUBLIC: 16, TEMPLE: 17, CHURCH: 18, MARKET: 19, SMALL: 20 };

const dec = (a) => { const o = new Float32Array(a.length); let x = 0, z = 0; for (let i = 0; i < a.length; i += 2) { x += a[i]; z += a[i + 1]; o[i] = x / 10; o[i + 1] = z / 10; } return o; };
const bbox = (p) => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (let i = 0; i < p.length; i += 2) { if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i]; if (p[i + 1] < z0) z0 = p[i + 1]; if (p[i + 1] > z1) z1 = p[i + 1]; } return [x0, z0, x1, z1]; };

// Khu vực kiến trúc: quyết định kiểu nhà, số tầng mặc định, bảng màu.
export const ZONE = { city: 0, old: 1, french: 2, badinh: 3, bank: 4 };
// Khu vực trang nghiêm (Lăng Chủ tịch Hồ Chí Minh và quảng trường Ba Đình, Phủ Chủ tịch): không cửa hàng, không biển hiệu,
// không xe đỗ, không quán cóc, không nhà suy đoán. [x, z, bán kính] tính bằng mét.
export const SOLEMN = [[-1790, -885, 340], [-1845, -1163, 210]];
export const isSolemn = (x, z) => SOLEMN.some((s) => (x - s[0]) ** 2 + (z - s[1]) ** 2 < s[2] * s[2]);
export const dikeX = (z) => 193 + (z < -820 ? 0.906 : 0.43) * (z + 820);
export function zoneAt(x, z) {
  // ngoài đê sông Hồng: phía đông trục Yên Phụ - Trần Nhật Duật - Trần Quang Khải (gấp khúc ở đầu cầu Chương Dương)
  if (x > dikeX(z) + 22) return ZONE.bank;
  if (x > -700 && x < 250 && z > -1300 && z < -290) return ZONE.old;          // 36 phố phường
  if (x > -700 && x < 950 && z >= 120 && z < 1100) return ZONE.french;         // khu phố Pháp phía nam hồ
  if (x <= -700 && x > -2000 && z > -1750 && z < 250) return ZONE.badinh;      // Ba Đình, biệt thự và công sở
  return ZONE.city;
}

export function decodeWorld(W, { withBuildings = true } = {}) {
  const B = W.bounds.map((v) => v / 10);
  const world = { bounds: { x0: B[0], z0: B[1], x1: B[2], z1: B[3] }, names: W.names, origin: W.origin, mPerLon: W.mPerLon, mPerLat: W.mPerLat, attribution: W.attribution };
  world.nx = Math.ceil((B[2] - B[0]) / CS); world.nz = Math.ceil((B[3] - B[1]) / CS);

  world.roads = W.roads.map((r, i) => {
    const p = dec(r[5]); let len = 0;
    for (let k = 0; k < p.length - 2; k += 2) len += Math.hypot(p[k + 2] - p[k], p[k + 3] - p[k + 1]);
    return { i, kind: r[0], w: r[1] / 10, flags: r[2], name: r[3], layer: r[4], p, len, bb: bbox(p) };
  });
  world.water = W.water.map((w) => { const p = dec(w[1]); return { name: w[0], p, holes: (w[2] || []).map(dec), bb: bbox(p) }; });
  world.green = W.green.map((g) => { const p = dec(g[2]); return { k: g[0], name: g[1], p, holes: (g[3] || []).map(dec), bb: bbox(p) }; });
  world.rails = W.rails.map((r) => ({ flags: r[0], p: dec(r[1]) }));
  world.walls = W.walls.map((w) => { const p = dec(w[1]); return { k: w[0], p, bb: bbox(p) }; });
  const pts = (a, n = 2) => { const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = i % n < 2 ? a[i] / 10 : a[i]; return o; };
  world.trees = pts(W.trees); world.food = pts(W.food, 3); world.bench = pts(W.bench); world.fountain = pts(W.fountain);

  if (withBuildings) {
    world.buildings = W.buildings.map((b, i) => {
      const p = dec(b[4]); let cx = 0, cz = 0;
      for (let k = 0; k < p.length; k += 2) { cx += p[k]; cz += p[k + 1]; }
      cx /= p.length / 2; cz /= p.length / 2;
      let a = 0; for (let k = 0, n = p.length; k < n; k += 2) { const j = (k + 2) % n; a += p[k] * p[j + 1] - p[j] * p[k + 1]; }
      return { i, cat: b[0], lv: b[1], h: b[2] / 10, name: b[3], p, holes: (b[5] || []).map(dec), cx, cz, area: Math.abs(a) / 2, bb: bbox(p), seed: Math.floor(hash(i, 11) * 256) };
    });
  }
  return world;
}

export const isVehicle = (r) => r.kind <= K.service;
export const chunkOf = (world, x, z) => [Math.floor((x - world.bounds.x0) / CS), Math.floor((z - world.bounds.z0) / CS)];
export const latLonToXZ = (world, lat, lon) => [(lon - world.origin.lon) * world.mPerLon, -(lat - world.origin.lat) * world.mPerLat];
