// Giải mã bản đồ world/hanoi.json (xem tools/build_world.mjs) thành cấu trúc dùng trong game.
// Dùng chung cho luồng chính (đường, mặt nước, va chạm) và worker (dựng hình).
import { hash, pointInRing } from '../core/util.js';

export const CS = 128;        // cạnh một ô phố (m)
export const CURB = 0.16;     // vỉa hè cao hơn lòng đường (m)
export const WATER_Y = -0.55; // mặt nước hồ thấp hơn bờ kè
export const K = { primary: 0, secondary: 1, tertiary: 2, residential: 3, service: 4, pedestrian: 5, footway: 6, path: 7, steps: 8, track: 9 };
export const CAT = { house: 0, apart: 1, modern: 2, public: 3, temple: 4, church: 5, roof: 6, small: 7, station: 8, market: 9 };
export const F_ONEWAY = 1, F_BRIDGE = 2, F_PASSAGE = 4, F_REVERSE = 8, F_NOCAR = 16, F_NOBIKE = 32, F_FLUSH = 64; // 16: cấm ô tô, 32: cấm xe máy
// 64: ngõ lát liền từ tường tới tường, không hè, không bó vỉa (bề rộng ghi trong dữ liệu là khoảng cách giữa hai dãy tường)

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
// Khu 36 phố phường (docs/18 mục 3.1): tây là phố Phùng Hưng, bắc là Hàng Đậu, đông là đê (Trần Nhật Duật, Trần Quang Khải), nam là
// Hàng Bông - Hàng Gai - Cầu Gỗ - Hàng Thùng. Khu phố xoay chéo so với trục bản đồ nên phải là đa giác (khung chữ nhật cũ bỏ sót cả
// góc tây nam: Hàng Bông, Hàng Da, Yên Thái, Tạm Thương, và dải phía đông sát đê). Ranh nam lấy rộng ra: tính cả dãy nhà mặt phố phía nam
// Hàng Bông, Hàng Gai (22 m) và mấy phố sát bờ bắc Hồ Gươm (Lò Sũ, Hàng Dầu, đầu Đinh Tiên Hoàng) vốn cùng một kiểu phố.
const OLD_Q = [-781, 4, -792, -15, -775, -131, -742, -282, -719, -405, -696, -528, -674, -644, -652, -760, -631, -870, -615, -949, -588, -1095, -568, -1203,
  -522, -1227, -378, -1270, -238, -1314, 700, -1314, 700, -290, -285, -290, -307, -259, -730, -24];
export function zoneAt(x, z) {
  // ngoài đê sông Hồng: phía đông trục Yên Phụ - Trần Nhật Duật - Trần Quang Khải (gấp khúc ở đầu cầu Chương Dương)
  if (x > dikeX(z) + 22) return ZONE.bank;
  if (x > -800 && z > -1320 && z < 10 && pointInRing(x, z, OLD_Q)) return ZONE.old; // 36 phố phường
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
    const cum = new Float32Array(p.length / 2); len = 0;
    for (let k = 0; k < p.length - 2; k += 2) { len += Math.hypot(p[k + 2] - p[k], p[k + 3] - p[k + 1]); cum[k / 2 + 1] = len; }
    return { i, kind: r[0], w: r[1] / 10, flags: r[2], name: r[3], layer: r[4], p, len, cum, bb: bbox(p), elev: null };
  });
  world.water = W.water.map((w) => { const p = dec(w[1]); return { name: w[0], p, holes: (w[2] || []).map(dec), bb: bbox(p) }; });
  world.green = W.green.map((g) => { const p = dec(g[2]); return { k: g[0], name: g[1], p, holes: (g[3] || []).map(dec), bb: bbox(p) }; });
  world.rails = W.rails.map((r) => { const p = dec(r[1]), cum = new Float32Array(p.length / 2); let len = 0; for (let k = 0; k < p.length - 2; k += 2) { len += Math.hypot(p[k + 2] - p[k], p[k + 3] - p[k + 1]); cum[k / 2 + 1] = len; } return { flags: r[0], p, len, cum, w: 4.8, bb: bbox(p), elev: null }; });
  world.walls = W.walls.map((w) => { const p = dec(w[1]); return { k: w[0], p, bb: bbox(p) }; });
  const pts = (a, n = 2) => { const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = i % n < 2 ? a[i] / 10 : a[i]; return o; };
  world.gates = pts(W.gates || []); // cổng trên tường rào [x, z, ...]
  world.trees = pts(W.trees); world.food = pts(W.food, 3); world.bench = pts(W.bench); world.fountain = pts(W.fountain);

  computeElevation(world);
  if (withBuildings) {
    // phần tử 0 là nhà đã bỏ lúc dựng dữ liệu (giữ chỗ để chỉ số i, hạt giống của bộ sinh, không xê dịch)
    world.buildings = W.buildings.map((b, i) => {
      if (!b) return null;
      const p = dec(b[4]); let cx = 0, cz = 0;
      for (let k = 0; k < p.length; k += 2) { cx += p[k]; cz += p[k + 1]; }
      cx /= p.length / 2; cz /= p.length / 2;
      let a = 0; for (let k = 0, n = p.length; k < n; k += 2) { const j = (k + 2) % n; a += p[k] * p[j + 1] - p[j] * p[k + 1]; }
      return { i, cat: b[0], lv: b[1], h: b[2] / 10, name: b[3], p, holes: (b[5] || []).map(dec), cx, cz, area: Math.abs(a) / 2, bb: bbox(p), seed: Math.floor(hash(i, 11) * 256) };
    }).filter(Boolean);
  }
  return world;
}

export const isVehicle = (r) => r.kind <= K.service;
export const chunkOf = (world, x, z) => [Math.floor((x - world.bounds.x0) / CS), Math.floor((z - world.bounds.z0) / CS)];
export const latLonToXZ = (world, lat, lon) => [(lon - world.origin.lon) * world.mPerLon, -(lat - world.origin.lat) * world.mPerLat];

// ----- cầu có độ cao -----
// Các đoạn đường gắn thẻ cầu nối liền nhau thành một cây cầu. Cầu dài từ 150 m trở lên được nâng lên: mặt cầu dốc dần
// từ chỗ nối với đường thường (6,5%) cho tới độ cao H rồi đi ngang. Cầu ngắn (cầu nhỏ qua hồ Trúc Bạch) để sát mặt đất.
// Cùng một hàm chạy ở luồng chính (đi lại, dòng xe) và trong worker (dựng mặt cầu) nên hai bên luôn khớp nhau.
const SLOPE = 0.065;
function elevate(list, attached, bounds, heightOf) {
  const key = (x, z) => Math.round(x * 10) * 100003 + Math.round(z * 10);
  const at = new Map();
  for (const r of list) for (const e of [0, 1]) { const i = e ? r.p.length - 2 : 0, k = key(r.p[i], r.p[i + 1]); let l = at.get(k); if (!l) at.set(k, (l = [])); l.push(r); }
  const seen = new Set();
  for (const r0 of list) {
    if (seen.has(r0)) continue;
    const comp = [], stack = [r0]; seen.add(r0);
    while (stack.length) { const a = stack.pop(); comp.push(a); for (const i of [0, a.p.length - 2]) for (const b of at.get(key(a.p[i], a.p[i + 1])) || []) if (!seen.has(b)) { seen.add(b); stack.push(b); } }
    let len = 0; for (const a of comp) len += a.len;
    if (len < 150) continue;
    const H = heightOf(comp, len), dist = new Map(), nodes = new Set();
    for (const a of comp) for (const i of [0, a.p.length - 2]) nodes.add(key(a.p[i], a.p[i + 1]));
    // đầu cầu chạm đất: nút có đường thường nối vào, hoặc đầu cụt nằm hẳn trong bản đồ
    for (const a of comp) for (const i of [0, a.p.length - 2]) {
      const x = a.p[i], z = a.p[i + 1], k = key(x, z), inside = x > bounds.x0 + 60 && x < bounds.x1 - 60 && z > bounds.z0 + 60 && z < bounds.z1 - 60;
      if (attached(k) || (inside && at.get(k).length === 1)) dist.set(k, 0);
    }
    for (let changed = true, guard = 0; changed && guard < 200; guard++) { // Bellman-Ford trên vài chục cạnh
      changed = false;
      for (const a of comp) { const k0 = key(a.p[0], a.p[1]), k1 = key(a.p[a.p.length - 2], a.p[a.p.length - 1]), d0 = dist.get(k0) ?? Infinity, d1 = dist.get(k1) ?? Infinity; if (d0 + a.len < d1) { dist.set(k1, d0 + a.len); changed = true; } if (d1 + a.len < d0) { dist.set(k0, d1 + a.len); changed = true; } }
    }
    for (const a of comp) a.elev = { d0: dist.get(key(a.p[0], a.p[1])) ?? Infinity, d1: dist.get(key(a.p[a.p.length - 2], a.p[a.p.length - 1])) ?? Infinity, H };
  }
}
export function computeElevation(world) {
  const key = (x, z) => Math.round(x * 10) * 100003 + Math.round(z * 10), b = world.bounds;
  const ground = new Set();
  for (const r of world.roads) if (r.kind <= K.service && !(r.flags & F_BRIDGE)) { ground.add(key(r.p[0], r.p[1])); ground.add(key(r.p[r.p.length - 2], r.p[r.p.length - 1])); }
  elevate(world.roads.filter((r) => r.kind <= K.service && (r.flags & F_BRIDGE)), (k) => ground.has(k), b, (comp, len) => (comp.some((a) => /Long Biên/.test(world.names[a.name] || '')) ? 9 : len > 500 ? 8 : 6));
  const gr = new Set();
  for (const r of world.rails) if (!(r.flags & 2)) { gr.add(key(r.p[0], r.p[1])); gr.add(key(r.p[r.p.length - 2], r.p[r.p.length - 1])); }
  elevate(world.rails.filter((r) => r.flags & 2), (k) => gr.has(k), b, () => 9);
}
// Cao độ mặt cầu tại quãng s (m) tính từ đầu đoạn; 0 nếu không phải cầu nâng. Chân dốc được vuốt cong 8 m đầu.
export function roadY(r, s) {
  const e = r.elev; if (!e) return 0;
  const d = Math.min(e.d0 + s, e.d1 + r.len - s);
  return Math.min(e.H, d < 8 ? (SLOPE * d * d) / 16 : SLOPE * (d - 4));
}
// Quãng đường từ chân dốc tới chỗ mặt cầu đạt độ cao y (hàm ngược của roadY trên đoạn dốc).
export const rampDist = (y) => (y < SLOPE * 4 ? Math.sqrt((16 * y) / SLOPE) : y / SLOPE + 4);
// Các khúc của đoạn cầu r còn nằm sát đất (mặt cầu thấp hơn yMax): trả về danh sách [s0, s1] theo quãng dọc đoạn.
export function lowSpans(r, yMax) {
  const e = r.elev; if (!e) return [[0, r.len]];
  if (e.H <= yMax) return [[0, r.len]];
  const d = rampDist(yMax), out = [];
  if (e.d0 < d) out.push([0, Math.min(r.len, d - e.d0)]);
  if (e.d1 < d) out.push([Math.max(0, r.len - (d - e.d1)), r.len]);
  return out;
}
// Điểm và hướng tại quãng s dọc polyline có cum: ghi vào out [x, z, tx, tz, chỉ số đoạn].
export function alongAt(r, s, out) {
  const p = r.p, c = r.cum; let i = out[4] | 0; if (i > c.length - 2 || c[i] > s) i = 0;
  while (i < c.length - 2 && c[i + 1] < s) i++;
  const L = c[i + 1] - c[i] || 1, t = (s - c[i]) / L, dx = p[i * 2 + 2] - p[i * 2], dz = p[i * 2 + 3] - p[i * 2 + 1];
  out[0] = p[i * 2] + dx * t; out[1] = p[i * 2 + 1] + dz * t; out[2] = dx / L; out[3] = dz / L; out[4] = i; return out;
}
// Khúc polyline từ quãng s0 tới s1, dạng [x, z, x, z, ...].
export function subPath(r, s0, s1) {
  const o = [0, 0, 0, 0, 0], out = []; alongAt(r, s0, o); out.push(o[0], o[1]);
  for (let i = 1; i < r.cum.length - 1; i++) if (r.cum[i] > s0 + 0.05 && r.cum[i] < s1 - 0.05) out.push(r.p[i * 2], r.p[i * 2 + 1]);
  alongAt(r, s1, o); out.push(o[0], o[1]); return out;
}
// Dàn thép cầu Long Biên bắt đầu từ mép đê (x > LB_TRUSS_X); phía trong là cầu dẫn bằng đá.
export const LB_TRUSS_X = 420;
// Dàn thép cầu Chương Dương: bắt đầu cách đầu cầu phía phố CD_TRUSS_S mét (phần trước đó là cầu dẫn bê tông), nhịp CD_SPAN mét.
export const CD_TRUSS_S = 290, CD_SPAN = 89.28;
// Lòng giữa cầu Chương Dương (tuyến hai chiều dài nhất mang tên cầu), hướng từ phố ra sông: { r, rev } hoặc null.
export function chuongDuongMid(world) {
  let best = null;
  for (const r of world.roads) if ((r.flags & F_BRIDGE) && !(r.flags & F_ONEWAY) && r.len > 300 && world.names[r.name] === 'Cầu Chương Dương' && (!best || r.len > best.len)) best = r;
  return best ? { r: best, rev: best.p[0] > best.p[best.p.length - 2] } : null;
}
