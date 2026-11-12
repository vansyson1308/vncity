// Chuyển dữ liệu OSM thô (web/.cache/osm/merged.json, tải bằng fetch_osm.mjs) thành bản đồ gọn cho game:
// web/public/world/hanoi.json. Tệp kết quả được commit, nên CI và người chơi không cần mạng tới OSM.
// Toạ độ: gốc ở Hồ Gươm, x hướng đông, z hướng nam, đơn vị đề-xi-mét (số nguyên), đường gấp khúc mã hoá delta.
// Dữ liệu © những người đóng góp OpenStreetMap, giấy phép ODbL 1.0.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const ClipperLib = createRequire(import.meta.url)('clipper-lib');
import { SOLEMN, zoneAt, ZONE } from '../src/world/data.js';
import { SITES } from '../src/world/landmarks/sites.js';
import { HEROES } from '../src/world/gen/heroes.js';

const SRC = path.resolve('.cache/osm/merged.json');
const OUT = path.resolve(process.env.WORLD_OUT || 'public/world/hanoi.json'); // WORLD_OUT: ghi ra chỗ khác để thử
if (!fs.existsSync(SRC)) { console.error('Chưa có', SRC, '- chạy node tools/fetch_osm.mjs trước'); process.exit(1); }
const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const BBOX = raw.bbox;
export const ORIGIN = { lat: 21.0288, lon: 105.8522 };
const MLON = Math.cos((ORIGIN.lat * Math.PI) / 180) * 111320, MLAT = 110574;
const X = (lon) => Math.round((lon - ORIGIN.lon) * MLON * 10), Z = (lat) => Math.round(-(lat - ORIGIN.lat) * MLAT * 10);
const B = { x0: X(BBOX.w), z0: Z(BBOX.n), x1: X(BBOX.e), z1: Z(BBOX.s) }; // dm
const PAD = 600; // 60 m: mặt nước, công viên, đường kéo quá mép một chút để mép bản đồ chìm vào sương

const nodes = new Map(), ways = new Map(), rels = [];
for (const e of raw.elements) {
  if (e.type === 'node') nodes.set(e.id, e);
  else if (e.type === 'way') ways.set(e.id, e);
  else rels.push(e);
}
const P = (id) => { const n = nodes.get(id); return n ? [X(n.lon), Z(n.lat)] : null; };
const wayPts = (w) => w.nodes.map(P).filter(Boolean);
const inBox = (p, pad = 0) => p[0] >= B.x0 - pad && p[0] <= B.x1 + pad && p[1] >= B.z0 - pad && p[1] <= B.z1 + pad;
const area = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const centroid = (r) => { let x = 0, z = 0; for (const p of r) { x += p[0]; z += p[1]; } return [x / r.length, z / r.length]; };
const closeRing = (pts) => { const r = pts.slice(); if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop(); return r; };
const dedupe = (pts) => pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);

// Bỏ điểm gần như thẳng hàng (Douglas-Peucker) để giảm dung lượng; tol tính bằng dm.
function simplify(pts, tol, closed = false) {
  if (pts.length < (closed ? 5 : 3)) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [];
  if (closed) { // vòng kín (điểm đầu trùng điểm cuối): tách tại điểm xa điểm đầu nhất
    let far = 1, fd = -1;
    for (let i = 1; i < pts.length - 1; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; far = i; } }
    keep[far] = 1; stack.push([0, far], [far, pts.length - 1]);
  } else stack.push([0, pts.length - 1]);
  while (stack.length) {
    const [a, b] = stack.pop(); let md = 0, mi = -1;
    const ax = pts[a][0], az = pts[a][1], dx = pts[b][0] - ax, dz = pts[b][1] - az, L = Math.hypot(dx, dz) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dz - (pts[i][1] - az) * dx) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const enc = (pts) => { const o = []; let px = 0, pz = 0; for (const p of pts) { o.push(p[0] - px, p[1] - pz); px = p[0]; pz = p[1]; } return o; };

// Ghép các đường thành viên của một quan hệ đa giác thành vòng kín.
function rings(memberWays) {
  const segs = memberWays.map((w) => w.nodes.slice()).filter((s) => s.length > 1), out = [];
  while (segs.length) {
    let cur = segs.pop();
    for (let guard = 0; guard < 10000 && cur[0] !== cur[cur.length - 1]; guard++) {
      const end = cur[cur.length - 1];
      const i = segs.findIndex((s) => s[0] === end || s[s.length - 1] === end);
      if (i < 0) break;
      const s = segs.splice(i, 1)[0];
      if (s[0] !== end) s.reverse();
      cur = cur.concat(s.slice(1));
    }
    const pts = cur.map(P).filter(Boolean);
    if (pts.length >= 3) out.push({ pts: closeRing(pts), closed: cur[0] === cur[cur.length - 1] });
  }
  return out;
}
function relPolys(r) {
  const get = (role) => r.members.filter((m) => m.type === 'way' && (m.role === role || (role === 'outer' && !m.role))).map((m) => ways.get(m.ref)).filter(Boolean);
  return { outers: rings(get('outer')), inners: rings(get('inner')).filter((x) => x.closed) };
}

// Cắt đa giác theo khung bản đồ (Clipper làm việc trên số nguyên, hợp với đơn vị dm).
const toC = (r) => r.map((p) => ({ X: p[0], Y: p[1] })), fromC = (r) => r.map((p) => [p.X, p.Y]);
const rect = (pad) => [{ X: B.x0 - pad, Y: B.z0 - pad }, { X: B.x1 + pad, Y: B.z0 - pad }, { X: B.x1 + pad, Y: B.z1 + pad }, { X: B.x0 - pad, Y: B.z1 + pad }];
function clipPolys(outers, inners, pad = PAD) {
  const c = new ClipperLib.Clipper();
  c.AddPaths(outers.map(toC), ClipperLib.PolyType.ptSubject, true);
  if (inners.length) c.AddPaths(inners.map(toC), ClipperLib.PolyType.ptSubject, true);
  c.AddPath(rect(pad), ClipperLib.PolyType.ptClip, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctIntersection, tree, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftNonZero);
  return ClipperLib.JS.PolyTreeToExPolygons(tree).map((e) => ({ outer: fromC(e.outer), holes: e.holes.map(fromC) }));
}

const names = [], nameIdx = new Map();
const N = (s) => { if (!s) return -1; if (!nameIdx.has(s)) { nameIdx.set(s, names.length); names.push(s); } return nameIdx.get(s); };

// ---------- toà nhà ----------
const CAT = ['house', 'apart', 'modern', 'public', 'temple', 'church', 'roof', 'small', 'station', 'market'];
function category(t) {
  const b = t.building, nm = (t.name || '').toLowerCase();
  if (b === 'roof' || b === 'carport' || t.amenity === 'shelter') return 'roof';
  if (b === 'church' || b === 'cathedral' || b === 'chapel' || (t.amenity === 'place_of_worship' && t.religion === 'christian')) return 'church';
  if (['temple', 'shrine', 'pagoda'].includes(b) || t.amenity === 'place_of_worship' || (/^(đền|chùa|đình|miếu|điện|phủ|am|văn miếu|nhà thờ họ|từ đường)\s/.test(nm) && !/^phủ (chủ tịch|thủ tướng)/.test(nm))) return 'temple'; // "Phủ Chủ tịch", "Phủ Thủ tướng" là công sở
  if (b === 'train_station' || t.railway === 'station') return 'station';
  if (t.amenity === 'marketplace' || /^chợ\s/.test(nm)) return 'market';
  if (['guardhouse', 'kiosk', 'toilets', 'garage', 'garages', 'shed', 'hut', 'service', 'cabin'].includes(b)) return 'small';
  if (['school', 'hospital', 'government', 'university', 'college', 'kindergarten', 'museum', 'civic', 'public', 'stadium'].includes(b) || ['school', 'hospital', 'university', 'townhall', 'police', 'embassy'].includes(t.amenity) || t.tourism === 'museum' || t.office === 'government') return 'public';
  if (['office', 'commercial', 'retail', 'hotel'].includes(b) || t.tourism === 'hotel') return 'modern';
  if (b === 'apartments' || b === 'dormitory') return 'apart';
  return 'house';
}
const buildings = [];
function addBuilding(t, outer, holes) {
  outer = closeRing(dedupe(outer)); if (outer.length < 3) return;
  const a = area(outer); if (Math.abs(a) < 400) return; // dưới 4 m²
  if (!inBox(centroid(outer))) return;
  if (t.building === 'houseboat' || t.building === 'construction' || t.location === 'underground') return;
  if (a < 0) outer.reverse();
  outer = simplify([...outer, outer[0]], 1.5, true).slice(0, -1); if (outer.length < 3) return;
  let lv = parseInt(t['building:levels'] || '0', 10) || 0;
  let h = parseFloat(t.height || '0') || 0;
  if (lv > 60) lv = 0; if (h > 300) h = 0;
  const cat = category(t);
  if (cat === 'modern' && !lv && !h && Math.abs(a) < 30000) { /* nhà phố làm khách sạn, cửa hàng: để runtime chọn tầng */ }
  buildings.push({ c: CAT.indexOf(cat), lv, h: Math.round(h * 10), n: N(t.name), p: outer, holes: (holes || []).map((r) => simplify([...r, r[0]], 1.5, true).slice(0, -1)).filter((r) => r.length >= 3), a: Math.abs(a) / 100 });
}
for (const w of ways.values()) if (w.tags?.building && w.nodes[0] === w.nodes[w.nodes.length - 1]) addBuilding(w.tags, wayPts(w));
for (const r of rels) if (r.tags?.type === 'multipolygon' && r.tags.building) { const { outers, inners } = relPolys(r); for (const o of outers) if (o.closed) addBuilding(r.tags, o.pts, outers.length === 1 ? inners.map((i) => i.pts) : []); }

const pip = (x, z, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > z) !== (r[j][1] > z) && x < ((r[j][0] - r[i][0]) * (z - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };
// Khu 2,14 ha giữa Đinh Tiên Hoàng, Lý Thái Tổ, Trần Nguyên Hãn và dãy nhà phía bắc (ngõ sau số 22 Lý Thái Tổ): giải toả từ cuối 2025
// làm quảng trường, công viên phía đông Hồ Gươm (docs/18 mục 8). Đa giác tính bằng dm, nằm lọt trong lòng các phố bao quanh.
const CLEARED_EAST = [[1780, -80], [3220, -210], [3260, -300], [2840, -1560], [1800, -1560]];

// Lấp chỗ OSM chưa vẽ nhà bằng nhà do máy học vẽ của Overture (tools/fetch_overture.py), nếu có.
const osmCount = buildings.length;
const ML = path.resolve('.cache/overture_ml.json');
let mlRelease = null;
if (fs.existsSync(ML)) {
  const ml = JSON.parse(fs.readFileSync(ML, 'utf8')); mlRelease = ml.release;
  const CELL = 300, grid = new Map(), key = (x, z) => Math.floor(x / CELL) * 100003 + Math.floor(z / CELL);
  const bb = (r) => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const p of r) { x0 = Math.min(x0, p[0]); z0 = Math.min(z0, p[1]); x1 = Math.max(x1, p[0]); z1 = Math.max(z1, p[1]); } return [x0, z0, x1, z1]; };
  const put = (r) => { const [x0, z0, x1, z1] = bb(r); for (let x = Math.floor(x0 / CELL); x <= Math.floor(x1 / CELL); x++) for (let z = Math.floor(z0 / CELL); z <= Math.floor(z1 / CELL); z++) { const k = x * 100003 + z; let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(r); } };
  const hit = (x, z) => (grid.get(key(x, z)) || []).some((r) => pip(x, z, r));
  for (const b of buildings) put(b.p);
  let added = 0, cleared = 0;
  for (const it of ml.items) {
    const ring = closeRing(it.p.map(([lon, lat]) => [X(lon), Z(lat)]));
    if (ring.length < 3) continue;
    const a = Math.abs(area(ring)); if (a < 1500 || a > 400000) continue; // 15 m² .. 4000 m²
    const c = centroid(ring);
    // khu vực trang nghiêm (Lăng, quảng trường Ba Đình, Phủ Chủ tịch): không thêm nhà suy đoán, chỉ giữ nhà OSM đã kiểm chứng
    if (SOLEMN.some((s) => (c[0] / 10 - s[0]) ** 2 + (c[1] / 10 - s[1]) ** 2 < s[2] * s[2])) continue;
    // trùng nhà đã có: tâm hoặc quá nửa số đỉnh nằm trong một nhà khác
    if (hit(c[0], c[1]) || ring.filter((p) => hit(p[0], p[1])).length * 2 > ring.length) continue;
    const n0 = buildings.length;
    addBuilding({ building: 'yes', height: it.h ? String(it.h) : undefined }, ring);
    if (buildings.length > n0) {
      buildings[n0].ml = 1; put(buildings[n0].p); added++;
      // khu đất đã giải toả phía đông Hồ Gươm: nhà máy học vẽ từ ảnh cũ là nhà đã phá dỡ (bản đồ OSM đã xoá các nhà đó). Bỏ, nhưng giữ chỗ
      // trong mảng để chỉ số các nhà sau nó không đổi.
      if (pip(c[0], c[1], CLEARED_EAST)) { buildings[n0].dead = true; cleared++; }
    }
  }
  console.log('Nhà ML thêm từ Overture:', added, '/', ml.items.length, '; bỏ', cleared, 'nhà trong khu giải toả phía đông Hồ Gươm');
}

// ---------- mặt nước, cây cỏ ----------
function polys(match) {
  const out = [];
  for (const w of ways.values()) if (w.tags && match(w.tags) && w.nodes[0] === w.nodes[w.nodes.length - 1]) { const pts = closeRing(wayPts(w)); if (pts.length >= 3) out.push({ t: w.tags, parts: clipPolys([pts], []) }); }
  for (const r of rels) if (r.tags?.type === 'multipolygon' && match(r.tags)) {
    const { outers, inners } = relPolys(r);
    const closed = outers.filter((o) => o.closed).map((o) => o.pts);
    if (closed.length) out.push({ t: r.tags, parts: clipPolys(closed, inners.map((i) => i.pts)) });
    else if (outers.length) console.warn('Quan hệ hở, bỏ qua:', r.id, r.tags.name || '');
  }
  return out;
}
const water = [];
for (const { t, parts } of polys((t) => t.natural === 'water' || t.waterway === 'riverbank' || t.landuse === 'basin' || t.leisure === 'swimming_pool')) {
  if (t.leisure === 'swimming_pool' || t.water === 'fountain' || t.amenity === 'fountain') continue;
  for (const e of parts) if (Math.abs(area(e.outer)) > 4000) water.push({ n: N(t.name), p: simplify([...e.outer, e.outer[0]], 2, true).slice(0, -1), holes: e.holes.map((h) => simplify([...h, h[0]], 2, true).slice(0, -1)).filter((h) => h.length >= 3) });
}
const green = []; // k: 0 cỏ, 1 rừng cây, 2 bồn hoa, 3 công viên
for (const { t, parts } of polys((t) => ['park', 'garden'].includes(t.leisure) || ['grass', 'flowerbed', 'forest', 'village_green', 'recreation_ground', 'cemetery'].includes(t.landuse) || ['wood', 'grassland', 'scrub', 'shrub'].includes(t.natural))) {
  const k = t.landuse === 'flowerbed' ? 2 : (t.natural === 'wood' || t.landuse === 'forest') ? 1 : t.leisure === 'park' ? 3 : 0;
  for (const e of parts) if (Math.abs(area(e.outer)) > 1500) green.push({ k, n: N(t.leisure === 'park' ? t.name : null), p: simplify([...e.outer, e.outer[0]], 3, true).slice(0, -1), holes: e.holes.map((h) => simplify([...h, h[0]], 3, true).slice(0, -1)).filter((h) => h.length >= 3) });
}

// Cắt đoạn a→b theo khung bản đồ nới thêm pad (Liang-Barsky). Trả về [a', b', đầuSauBịCắt] hoặc null nếu nằm ngoài.
function clipSeg(a, b, pad) {
  const x0 = B.x0 - pad, x1 = B.x1 + pad, z0 = B.z0 - pad, z1 = B.z1 + pad, dx = b[0] - a[0], dz = b[1] - a[1];
  let t0 = 0, t1 = 1;
  for (const [pp, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dz, a[1] - z0], [dz, z1 - a[1]]]) {
    if (pp === 0) { if (q < 0) return null; continue; }
    const r = q / pp; if (pp < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  const P = (t) => [Math.round(a[0] + dx * t), Math.round(a[1] + dz * t)];
  return [t0 > 0 ? P(t0) : a, t1 < 1 ? P(t1) : b, t1 < 1];
}

// ---------- đường ----------
const KIND = ['primary', 'secondary', 'tertiary', 'residential', 'service', 'pedestrian', 'footway', 'path', 'steps', 'track'];
const kindOf = (h) => ({ primary_link: 'primary', secondary_link: 'secondary', tertiary_link: 'tertiary', unclassified: 'residential', living_street: 'residential', busway: 'tertiary', trunk: 'primary', trunk_link: 'primary' }[h] || h);
const DEF_W = { primary: 150, secondary: 115, tertiary: 90, residential: 62, service: 34, pedestrian: 60, footway: 24, path: 18, steps: 22, track: 28 };
const MIN_W = { primary: 70, secondary: 62, tertiary: 55, residential: 34, service: 20, pedestrian: 30, footway: 14, path: 12, steps: 14, track: 20 };
const VEH = new Set(['primary', 'secondary', 'tertiary', 'residential', 'service']);
const hw = [];
for (const w of ways.values()) {
  const t = w.tags; if (!t?.highway) continue;
  const k = kindOf(t.highway); if (!KIND.includes(k)) continue;
  if (t.highway === 'footway' && (t.footway === 'sidewalk' || t.footway === 'crossing')) continue;
  if (t.tunnel && t.tunnel !== 'building_passage' && t.tunnel !== 'no') continue;
  if (t.indoor === 'yes' || t.level || t.access === 'private' && k === 'footway') continue;
  if (t.area === 'yes') continue;
  hw.push(w);
}
// tách tại ngã rẽ để mỗi bản ghi là một cạnh của đồ thị đường
const use = new Map();
for (const w of hw) w.nodes.forEach((n, i) => use.set(n, (use.get(n) || 0) + (i === 0 || i === w.nodes.length - 1 ? 1 : 2)));
const roads = [];
for (const w of hw) {
  const t = w.tags, k = kindOf(t.highway);
  const lanes = parseInt(t.lanes || '0', 10) || 0, tw = parseFloat(t.width || '0') || 0;
  let width = tw > 1 && tw < 40 ? tw * 10 : lanes ? Math.max(DEF_W[k] * 0.6, lanes * 31 + 8) : DEF_W[k];
  if (VEH.has(k) && lanes) width = Math.min(width, 220);
  const bridge = t.bridge && t.bridge !== 'no' ? 1 : 0;
  // 16: cấm ô tô (ngõ nhỏ, cầu Long Biên); 32: cấm xe máy (lòng giữa cầu Chương Dương)
  const flags = (t.oneway === 'yes' || t.junction === 'roundabout' ? 1 : 0) | (bridge ? 2 : 0) | (t.tunnel === 'building_passage' ? 4 : 0) | (t.oneway === '-1' ? 8 : 0)
    | (t.motorcar === 'no' ? 16 : 0) | (t.motorcycle === 'no' ? 32 : 0);
  let cur = [];
  const flush = () => {
    if (cur.length > 1) {
      // cắt theo khung bản đồ (cộng lề) bằng hình học: đoạn nào vắt qua mép thì cắt đúng tại mép, không bỏ cả đoạn
      // (cầu Long Biên chỉ có vài nút, nút kế tiếp nằm tận bờ bên kia sông)
      let part = [];
      const emit = () => { if (part.length > 1) roads.push({ k: KIND.indexOf(k), w: Math.round(width), tw: tw > 1 && tw < 40 ? 1 : 0, f: flags, n: N(t.name), layer: parseInt(t.layer || '0', 10) || 0, p: part }); part = []; };
      for (let i = 0; i < cur.length - 1; i++) {
        const c = clipSeg(cur[i].p, cur[i + 1].p, PAD);
        if (!c) { emit(); continue; }
        if (!part.length) part.push(c[0]); else if (part[part.length - 1][0] !== c[0][0] || part[part.length - 1][1] !== c[0][1]) { emit(); part.push(c[0]); }
        part.push(c[1]);
        if (c[2]) emit(); // đầu sau bị cắt: kết thúc phần này
      }
      emit();
    }
  };
  w.nodes.forEach((id, i) => {
    const p = P(id); if (!p) return;
    cur.push({ id, p });
    if (i > 0 && i < w.nodes.length - 1 && use.get(id) > 2) { flush(); cur = [{ id, p }]; }
  });
  flush();
}

// ====================================================================================================================
// Nhà và đường phải khớp nhau. Các bước dưới đây sửa dữ liệu nhà, đường ngay tại nguồn, để lưới nhà, va chạm, bản đồ nhỏ
// và places.json cùng dùng một hình:
//   1. sân quảng trường Ba Đình không có nhà lạ;  2. ngõ cụt đâm vào nhà thì cắt ngắn;  3. lòng đường phố cổ về bề rộng thật;
//   4. (sau khi thu hẹp đường) nhà đè lên lòng đường xe chạy thì cắt phần đè;  5. phố cổ: kéo mặt tiền ra sát hè.
// Nhà bị bỏ vẫn giữ chỗ trong mảng (ghi số 0) và đường không bị xoá: chỉ số nhà, chỉ số đường là hạt giống ngẫu nhiên của bộ
// sinh (số tầng, màu vôi, cây, đồ đạc phố), xê dịch chỉ số là cả thành phố đổi dạng.
// ====================================================================================================================
const CT = ClipperLib.ClipType, PT = ClipperLib.PolyType, FT = ClipperLib.PolyFillType, ET = ClipperLib.EndType, JT = ClipperLib.JoinType;
function cExec(type, subj, clipP, fs = FT.pftNonZero, fc = FT.pftNonZero) {
  const c = new ClipperLib.Clipper(); c.AddPaths(subj, PT.ptSubject, true); if (clipP && clipP.length) c.AddPaths(clipP, PT.ptClip, true);
  const tree = new ClipperLib.PolyTree(); c.Execute(type, tree, fs, fc); return ClipperLib.JS.PolyTreeToExPolygons(tree);
}
function cOffset(paths, delta, end = ET.etClosedPolygon, join = JT.jtMiter) {
  const co = new ClipperLib.ClipperOffset(2.5, 1); co.AddPaths(paths, join, end); const out = new ClipperLib.Paths(); co.Execute(out, delta); return out;
}
const exArea = (e) => Math.abs(area(fromC(e.outer))) - e.holes.reduce((s, h) => s + Math.abs(area(fromC(h))), 0);
const exPaths = (ex) => ex.flatMap((e) => [e.outer, ...e.holes]);
const bPaths = (b) => [toC(b.p), ...b.holes.map(toC)]; // dùng với pftEvenOdd
const bbOf = (r) => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const p of r) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; } return [x0, z0, x1, z1]; };
const segD = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0; return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
const lineD = (p, pts, closed) => { let d = 1e9; for (let i = 0, n = closed ? pts.length : pts.length - 1; i < n; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; d = Math.min(d, segD(p[0], p[1], a[0], a[1], b[0], b[1])); } return d; };
const keyP = (p) => p[0] * 100003 + p[1];
const plen = (p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; };
const ptAt = (p, s) => { for (let i = 1; i < p.length; i++) { const L = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (s <= L || i === p.length - 1) { const t = L ? Math.max(0, Math.min(1, s / L)) : 0; return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t]; } s -= L; } return p[0]; };
const headOf = (p, s) => { const o = [p[0]]; for (let i = 1; i < p.length; i++) { const L = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (s < L) { const q = [Math.round(p[i - 1][0] + ((p[i][0] - p[i - 1][0]) * s) / L), Math.round(p[i - 1][1] + ((p[i][1] - p[i - 1][1]) * s) / L)]; if (q[0] !== o[o.length - 1][0] || q[1] !== o[o.length - 1][1]) o.push(q); return o; } o.push(p[i]); s -= L; } return o; };
const isRoof = (b) => CAT[b.c] === 'roof';
const inOldQ = (x, z) => zoneAt(x / 10, z / 10) === ZONE.old; // khu 36 phố phường (đa giác trong src/world/data.js)
const midOld = (r) => { const m = ptAt(r.p, plen(r.p) / 2); return inOldQ(m[0], m[1]); };

// Lưới tra nhà theo hộp bao (ô 30 m). Nhà đổi hình thì gọi lại gput: mục cũ vẫn dùng được vì luôn xét theo hình hiện tại.
const BCELL = 300, bgrid = new Map();
const gput = (b) => { b.bb = bbOf(b.p); for (let x = Math.floor(b.bb[0] / BCELL); x <= Math.floor(b.bb[2] / BCELL); x++) for (let z = Math.floor(b.bb[1] / BCELL); z <= Math.floor(b.bb[3] / BCELL); z++) { const k = x * 100003 + z; let l = bgrid.get(k); if (!l) bgrid.set(k, (l = [])); if (!l.includes(b)) l.push(b); } };
for (const b of buildings) gput(b);
const inB = (b, x, z) => x >= b.bb[0] && x <= b.bb[2] && z >= b.bb[1] && z <= b.bb[3] && pip(x, z, b.p) && !b.holes.some((h) => pip(x, z, h));
const bAt = (x, z, except = null) => { const l = bgrid.get(Math.floor(x / BCELL) * 100003 + Math.floor(z / BCELL)); if (l) for (const b of l) if (!b.dead && b !== except && !isRoof(b) && inB(b, x, z)) return b; return null; };
const bNear = (bb) => { const s = new Set(); for (let x = Math.floor(bb[0] / BCELL); x <= Math.floor(bb[2] / BCELL); x++) for (let z = Math.floor(bb[1] / BCELL); z <= Math.floor(bb[3] / BCELL); z++) for (const b of bgrid.get(x * 100003 + z) || []) if (!b.dead && b.bb[0] <= bb[2] && b.bb[2] >= bb[0] && b.bb[1] <= bb[3] && b.bb[3] >= bb[1]) s.add(b); return s; };
// Gán hình mới (một ExPolygon của Clipper) cho nhà b.
const setShape = (b, e, tol = 1) => {
  const ring = (r) => { let q = closeRing(dedupe(fromC(r))); q = simplify([...q, q[0]], tol, true).slice(0, -1); return q; };
  const o = ring(e.outer); if (o.length < 3) return false; if (area(o) < 0) o.reverse();
  b.p = o; b.holes = e.holes.map(ring).filter((h) => h.length >= 3 && Math.abs(area(h)) >= 400);
  b.a = (Math.abs(area(o)) - b.holes.reduce((s, h) => s + Math.abs(area(h)), 0)) / 100; gput(b); return true;
};

// Nhà mang tên công trình dựng tay (landmarks/sites.js) hoặc thuộc bảng công trình có tên (gen/heroes.js): không đổi hình, vì game
// tìm chúng theo tên và theo toạ độ tâm.
const keepShape = new Set();
{
  const named = new Set([...SITES.map((s) => s.name), ...HEROES.flatMap((h) => h.name || [])].filter(Boolean));
  for (const b of buildings) if (b.n >= 0 && named.has(names[b.n])) keepShape.add(b);
  for (const h of HEROES) if (h.at) { let best = null, bd = ((h.r || 25) * 10) ** 2; for (const b of buildings) { if (b.dead) continue; const c = centroid(b.p), d = (c[0] - h.at[0] * 10) ** 2 + (c[1] - h.at[1] * 10) ** 2; if (d < bd) { bd = d; best = b; } } if (best) keepShape.add(best); }
}

// ----- 1. Quảng trường Ba Đình -----
// Trên sân lát đá trước Lăng (dọc đường Hùng Vương đoạn đi bộ) và thảm cỏ quảng trường chỉ có cột cờ; công trình nhỏ không tên mà bản
// đồ vẽ ở đó (bệ cột cờ gắn thẻ building=yes + man_made=tower) không phải là nhà: bỏ. Bốt gác (loại 'small') thì giữ, bộ sinh dựng thấp một tầng.
{
  const S = SOLEMN[0], inS = (c) => (c[0] / 10 - S[0]) ** 2 + (c[1] / 10 - S[1]) ** 2 < S[2] * S[2];
  const lawns = green.filter((g) => g.k === 0 && Math.abs(area(g.p)) > 2e6 && inS(centroid(g.p)));
  const parade = roads.filter((r) => KIND[r.k] === 'pedestrian' && /Hùng Vương/.test(names[r.n] || '') && inS(r.p[0]));
  const lang = SITES.find((q) => q.id === 'lang_bac').at.map((v) => v * 10), nearLang = (c) => Math.hypot(c[0] - lang[0], c[1] - lang[1]) < 1500; // sân trước Lăng: trong 150 m
  let n = 0;
  for (const b of buildings) {
    if (b.dead || b.n >= 0 || CAT[b.c] === 'small' || isRoof(b) || b.a > 150 || keepShape.has(b)) continue;
    const c = centroid(b.p); if (!inS(c)) continue;
    if (lawns.some((g) => pip(c[0], c[1], g.p) || lineD(c, g.p, true) < 150) || (nearLang(c) && parade.some((r) => lineD(c, r.p, false) < 320))) { b.dead = true; n++; console.log('  bỏ công trình nhỏ trên quảng trường Ba Đình:', (c[0] / 10).toFixed(0), (c[1] / 10).toFixed(0), b.a.toFixed(0) + ' m²'); }
  }
  console.log('Quảng trường Ba Đình: bỏ', n, 'công trình nhỏ không tên trên sân và thảm cỏ (', lawns.length, 'thảm cỏ,', parade.length, 'đoạn Hùng Vương đi bộ )');
}

// ----- 2. Ngõ cụt đâm vào nhà: cắt ngắn, dừng trước tường 0,8 m -----
{
  const deg = new Map(); for (const r of roads) for (const e of [r.p[0], r.p[r.p.length - 1]]) deg.set(keyP(e), (deg.get(keyP(e)) || 0) + 1);
  let n = 0, m = 0;
  for (const r of roads) {
    if (!VEH.has(KIND[r.k]) || (r.f & 2)) continue;
    for (const rev of [false, true]) {
      const p = rev ? r.p.slice().reverse() : r.p, end = p[p.length - 1];
      if (deg.get(keyP(end)) !== 1 || !bAt(end[0], end[1])) continue;
      const L = plen(p); let s = L; while (s > 0) { const q = ptAt(p, s); if (!bAt(q[0], q[1])) break; s -= 2; }
      if (s <= 0) continue; // cả đoạn nằm trong nhà (nhà trùm lên ngã rẽ): để bước cắt nhà xử lý
      const keep = Math.max(10, s - 8); if (keep > L - 2) continue;
      const q = headOf(p, keep); if (q.length < 2) continue;
      r.p = rev ? q.reverse() : q; n++; m += L - keep;
    }
  }
  console.log('Ngõ cụt đâm vào nhà: cắt ngắn', n, 'đoạn, tổng', (m / 10).toFixed(0), 'm');
}

// ----- 3. Lòng đường phố cổ -----
// Phố nghề trong khu 36 phố phường: lòng đường 5,5 đến 6,5 m, hè 1,5 đến 2,5 m (docs/18 mục 2.11, 3.1); trục Hàng Đào - Hàng Ngang -
// Hàng Đường - Đồng Xuân và Hàng Bông - Hàng Gai - Cầu Gỗ giữ 7 m. Thẻ lanes=2 của OSM cho mặc định 7 m ở mọi phố, rộng hơn thực tế.
// Các phố bao quanh và phố lớn (KEEP) giữ nguyên. Chỉ thu vào, không nới ra; phố đã có thẻ width thì theo thẻ.
const OLD_AXIS = /^Phố (Hàng Đào|Hàng Ngang|Hàng Đường|Đồng Xuân|Hàng Gai|Hàng Bông|Cầu Gỗ)$/, OLD_NARROW = /^Phố (Hàng Mã|Hàng Bạc)$/;
const OLD_KEEP = /Phùng Hưng|Hàng Đậu|Trần Nhật Duật|Quán Thánh|Phan Đình Phùng|Đinh Tiên Hoàng|Lê Thái Tổ|Nguyễn Hữu Huân|Lý Nam Đế|Hồ Hoàn Kiếm|Lê Văn Linh|Vòng xoay|Cầu Long Biên|Cầu Chương Dương|Hướng đi/;
const strHash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
// Phố cấp khu vực (tertiary: Lương Văn Can, Hàng Lược, Hàng Cân, Chả Cá...) để 6,5 m: dòng xe của game chỉ thả ô tô trên phố cấp này rộng
// từ 6,5 m (actors/trafficsim.js), hẹp hơn thì phố cổ mất hẳn ô tô (cần 8 đến 12%, docs/18 mục 4). Phố nhỏ: 5,5 đến 6,5 m tuỳ phố.
const oldStreetW = (name, kind) => (OLD_AXIS.test(name) ? 70 : OLD_NARROW.test(name) ? 55 : kind === 'tertiary' ? 65 : [55, 60, 60, 65][strHash(name) % 4]);
{
  let n = 0;
  for (const r of roads) {
    const k = KIND[r.k], nm = names[r.n] || '';
    if ((k !== 'tertiary' && k !== 'residential') || r.tw || (r.f & 2) || r.w < 55 || r.w > 90 || !/^(Phố|Ngõ) /.test(nm) || OLD_KEEP.test(nm) || !midOld(r)) continue;
    const w = oldStreetW(nm, k); if (w < r.w) { r.w = w; n++; }
  }
  console.log('Phố cổ: thu lòng đường', n, 'đoạn về 5,5 đến 7 m');
}

// Thu hẹp lòng đường theo khoảng trống thật giữa hai dãy nhà, để đường không ăn vào mặt tiền.
let clearance = null; // khoảng cách từ một điểm tới mép nhà gần nhất (theo hình nhà trước khi cắt, kéo)
{
  const CELL = 200, grid = new Map();
  const put = (a, b, bi) => {
    const x0 = Math.floor(Math.min(a[0], b[0]) / CELL), x1 = Math.floor(Math.max(a[0], b[0]) / CELL), z0 = Math.floor(Math.min(a[1], b[1]) / CELL), z1 = Math.floor(Math.max(a[1], b[1]) / CELL);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const key = x * 100003 + z; let l = grid.get(key); if (!l) grid.set(key, (l = [])); l.push(a[0], a[1], b[0], b[1], bi); }
  };
  buildings.forEach((b, bi) => { if (b.dead || CAT[b.c] === 'roof') return; for (let i = 0; i < b.p.length; i++) put(b.p[i], b.p[(i + 1) % b.p.length], bi); });
  const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0; return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
  clearance = (px, pz, max) => {
    let best = max; const r = Math.ceil(max / CELL), cx = Math.floor(px / CELL), cz = Math.floor(pz / CELL);
    for (let x = cx - r; x <= cx + r; x++) for (let z = cz - r; z <= cz + r; z++) { const l = grid.get(x * 100003 + z); if (!l) continue; for (let i = 0; i < l.length; i += 5) { const d = segDist(px, pz, l[i], l[i + 1], l[i + 2], l[i + 3]); if (d < best) best = d; } }
    return best;
  };
  let narrowed = 0;
  for (const r of roads) {
    if (r.f & 6) continue; // cầu, lối xuyên nhà
    const k = KIND[r.k], ds = [];
    for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 50));
      for (let s = 0; s <= n; s++) ds.push(clearance(a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n, r.w / 2 + 40));
    }
    ds.sort((a, b) => a - b);
    const clear = ds[Math.floor(ds.length * 0.2)]; r.clear = clear;
    const pavement = VEH.has(k) ? (k === 'service' ? 3 : k === 'residential' ? 9 : 16) : 0; // vỉa hè tối thiểu mỗi bên
    const w = Math.max(MIN_W[k], Math.min(r.w, Math.round(2 * (clear - pavement))));
    if (w < r.w) { r.w = w; narrowed++; }
  }
  console.log('Đường bị thu hẹp theo dãy nhà:', narrowed, '/', roads.length);
}

// ---------- đường sắt, tường rào, cây, điểm ăn uống ----------
const rails = [];
for (const w of ways.values()) if (w.tags?.railway === 'rail' && w.tags.service !== 'siding' && w.tags.service !== 'yard') {
  let part = []; const emit = () => { if (part.length > 1) rails.push({ f: w.tags.bridge && w.tags.bridge !== 'no' ? 2 : 0, p: simplify(part, 2) }); part = []; };
  const pts = wayPts(w);
  for (let i = 0; i < pts.length - 1; i++) {
    const c = clipSeg(pts[i], pts[i + 1], PAD); if (!c) { emit(); continue; }
    if (!part.length) part.push(c[0]); else if (part[part.length - 1][0] !== c[0][0] || part[part.length - 1][1] !== c[0][1]) { emit(); part.push(c[0]); }
    part.push(c[1]); if (c[2]) emit();
  }
  emit();
}
// Cầu Long Biên: hai làn xe chạy hai bên ngoài dàn thép. OSM vẽ hai làn hơi sát tim đường sắt, ở đây nắn lại cho làn xe
// cách tim đường sắt đúng 4,1 m (dàn thép rộng 4,8 m), và chêm thêm điểm để làn xe bám theo đường sắt.
{
  const LB = (r) => (r.f & 2) && /Long Biên/.test(names[r.n] || ''), key = (p) => p[0] * 100003 + p[1];
  const fixed = new Set();
  for (const r of roads) if (!LB(r) && r.k <= KIND.indexOf('service')) { fixed.add(key(r.p[0])); fixed.add(key(r.p[r.p.length - 1])); }
  const nearestRail = (p) => {
    let bd = 1e18, q = null;
    for (const rl of rails) for (let i = 0; i < rl.p.length - 1; i++) {
      const a = rl.p[i], b = rl.p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
      const x = a[0] + dx * t, z = a[1] + dz * t, d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < bd) { bd = d; q = [x, z]; }
    }
    return q && [q[0], q[1], Math.sqrt(bd)];
  };
  const move = (p) => { const q = nearestRail(p); if (!q || q[2] < 5 || q[2] > 80) return p; return [Math.round(q[0] + ((p[0] - q[0]) / q[2]) * 41), Math.round(q[1] + ((p[1] - q[1]) / q[2]) * 41)]; };
  let moved = 0;
  for (const r of roads) {
    if (!LB(r)) continue;
    const out = [];
    r.p.forEach((p, i) => {
      const end = i === 0 || i === r.p.length - 1;
      if (i > 0) { const a = r.p[i - 1], L = Math.hypot(p[0] - a[0], p[1] - a[1]), n = Math.max(1, Math.round(L / 400)); for (let k = 1; k < n; k++) out.push(move([a[0] + ((p[0] - a[0]) * k) / n, a[1] + ((p[1] - a[1]) * k) / n])); }
      out.push(end && fixed.has(key(p)) ? p : move(p));
    });
    r.p = out; r.w = 32; moved++;
  }
  console.log('Nắn làn xe cầu Long Biên:', moved, 'đoạn');
}
// Cầu Chương Dương: lòng giữa dành cho ô tô (thẻ motorcycle=no), hai làn xe máy chạy ngoài dàn thép, mỗi bên một làn
// (thẻ lanes=1, motorcycle=yes). OSM vẽ ba tuyến cách nhau 6 đến 7 m, với bề rộng mặc định 9 m thì ba mặt cầu chồng lên nhau.
// Ở đây nắn hai làn ngoài cho cách tim lòng giữa đúng 7,3 m, đặt lòng giữa rộng 10,4 m và làn xe máy rộng 3,4 m:
// giữa các mặt cầu còn khe 0,4 m, là chỗ đứng của hai mặt phẳng dàn (landmarks/cau_chuong_duong.js, CD_HALF = 5,4 m).
{
  const CD = (r) => (r.f & 2) && names[r.n] === 'Cầu Chương Dương', key = (p) => p[0] * 100003 + p[1];
  const plen = (r) => { let L = 0; for (let i = 1; i < r.p.length; i++) L += Math.hypot(r.p[i][0] - r.p[i - 1][0], r.p[i][1] - r.p[i - 1][1]); return L; };
  const long = roads.filter((r) => CD(r) && plen(r) > 3000), mid = long.find((r) => !(r.f & 1)), outer = long.filter((r) => r.f & 1);
  if (mid && outer.length === 2) {
    const fixed = new Set();
    for (const r of roads) if (!outer.includes(r) && r.k <= KIND.indexOf('service')) { fixed.add(key(r.p[0])); fixed.add(key(r.p[r.p.length - 1])); }
    const nearestMid = (p) => {
      let bd = 1e18, q = null;
      for (let i = 0; i < mid.p.length - 1; i++) {
        const a = mid.p[i], b = mid.p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
        const x = a[0] + dx * t, z = a[1] + dz * t, d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < bd) { bd = d; q = [x, z]; }
      }
      return [q[0], q[1], Math.sqrt(bd)];
    };
    const move = (p) => { const q = nearestMid(p); if (q[2] < 5) return p; return [Math.round(q[0] + ((p[0] - q[0]) / q[2]) * 73), Math.round(q[1] + ((p[1] - q[1]) / q[2]) * 73)]; };
    for (const r of outer) {
      const out = [];
      r.p.forEach((p, i) => {
        const end = i === 0 || i === r.p.length - 1;
        if (i > 0) { const a = r.p[i - 1], L = Math.hypot(p[0] - a[0], p[1] - a[1]), n = Math.max(1, Math.round(L / 400)); for (let k = 1; k < n; k++) out.push(move([a[0] + ((p[0] - a[0]) * k) / n, a[1] + ((p[1] - a[1]) * k) / n])); }
        out.push(end && fixed.has(key(p)) ? p : move(p));
      });
      r.p = dedupe(out); r.w = 34; r.f |= 16;
    }
    mid.w = 104; mid.f |= 32;
    console.log('Nắn cầu Chương Dương: lòng giữa', (plen(mid) / 10).toFixed(0), 'm, hai làn xe máy', outer.map((r) => (plen(r) / 10).toFixed(0)).join(' và '), 'm');
  } else console.log('Cầu Chương Dương: không nhận ra ba tuyến, giữ nguyên');
}
// cổng trên tường rào: nút OSM gắn thẻ cổng/lối vào nằm trên một đường tường. Bộ sinh sẽ để hở tường ở đó,
// nếu không các khuôn viên có tường bao (Văn Miếu, bảo tàng, Cột cờ) bị vây kín, người chơi không vào được.
const GATE = new Set(['gate', 'lift_gate', 'wicket_gate', 'sally_port', 'entrance', 'swing_gate', 'sliding_gate']);
const isGate = (n) => !!n?.tags && (GATE.has(n.tags.barrier) || (n.tags.entrance && n.tags.entrance !== 'no' && n.tags.entrance !== 'emergency'));
const gates = [];
const walls = [];
for (const w of ways.values()) {
  const b = w.tags?.barrier; if (!['wall', 'fence', 'city_wall', 'retaining_wall', 'hedge'].includes(b)) continue;
  for (const id of w.nodes) if (isGate(nodes.get(id))) { const g = P(id); if (g && inBox(g)) gates.push(g); }
  const pts = wayPts(w).filter((p) => inBox(p)); if (pts.length < 2) continue;
  walls.push({ k: b === 'fence' ? 1 : b === 'hedge' ? 2 : b === 'city_wall' ? 3 : 0, p: simplify(pts, 2) });
}
const trees = [];
for (const n of nodes.values()) if (n.tags?.natural === 'tree') { const p = [X(n.lon), Z(n.lat)]; if (inBox(p)) trees.push(p); }
for (const w of ways.values()) if (w.tags?.natural === 'tree_row') {
  const pts = wayPts(w);
  for (let i = 0, carry = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); let d = carry; for (; d < L; d += 80) { const p = [Math.round(a[0] + ((b[0] - a[0]) * d) / L), Math.round(a[1] + ((b[1] - a[1]) * d) / L)]; if (inBox(p)) trees.push(p); } carry = d - L; }
}
const food = [], bench = [], fountain = [];
for (const n of nodes.values()) {
  const a = n.tags?.amenity; if (!a) continue; const p = [X(n.lon), Z(n.lat)]; if (!inBox(p)) continue;
  if (['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'ice_cream'].includes(a)) food.push([p[0], p[1], ['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'ice_cream'].indexOf(a)]);
  else if (a === 'bench') bench.push(p); else if (a === 'fountain') fountain.push(p);
}

// ----- Ngõ lát liền (cờ 64) -----
// Ngõ, ngách xe chạy rộng dưới 4 m kẹp giữa hai dãy nhà không có hè, không có bó vỉa: một mặt bê tông liền từ tường tới tường.
// Bộ sinh mặt đất (gen/ground.js) vẽ lòng ngõ bằng bê tông và giấu mép dưới chân tường. Trong phố cổ, bề rộng ngõ đặt bằng
// khoảng cách tường tới tường ở chỗ hẹp (2,6 đến 3,6 m); bước 5 kéo mặt tiền hai bên ra đúng mép đó.
const F_FLUSH = 64;
{
  let n = 0, len = 0;
  for (const r of roads) {
    const k = KIND[r.k], nm = names[r.n] || '';
    if ((k !== 'service' && k !== 'residential') || (r.f & 6) || r.w >= 40 || /^(Phố|Đường|Cầu|Vòng|Hướng) /.test(nm)) continue;
    // có tường nhà kề mép ngõ (trong 1,5 m) trên ít nhất 40% chiều dài thì mới là ngõ giữa hai dãy nhà
    const L = plen(r.p), ns = Math.max(2, Math.round(L / 20)); let near = 0;
    for (let i = 0; i <= ns; i++) { const q = ptAt(r.p, (L * i) / ns); if (clearance(q[0], q[1], r.w / 2 + 15) < r.w / 2 + 15) near++; }
    if (near < 0.4 * (ns + 1)) continue;
    r.f |= F_FLUSH; n++; len += L;
    if (midOld(r)) r.w = Math.max(26, Math.min(36, Math.round(2 * r.clear)));
  }
  console.log('Ngõ lát liền từ tường tới tường:', n, 'đoạn,', (len / 10000).toFixed(1), 'km');
}

// ----- 4. Nhà đè lên lòng đường xe chạy: cắt phần đè -----
// Sau khi thu hẹp, lòng đường vẫn có chỗ ăn vào nhà (đường đã ở bề rộng tối thiểu; nhà máy học vẽ lệch; nhà trùm lên ngã rẽ;
// lối xuyên qua nhà, qua cổng). Xe trong dòng xe và người chơi đi trong lòng đường, nên phần nhà nằm trong lòng đường bị cắt đi;
// mảnh còn lại dưới 10 m² hoặc mỏng dưới 1 m thì bỏ. Đường chui qua nhà (kể cả có thẻ building_passage) thành lối hở.
// Phố trong khu phố cổ (trừ ngõ lát liền, lối vào sân) giữ thêm một dải hè tối thiểu 1,2 m (phố hẹp dưới 4,5 m: 0,9 m): nhà vẽ lấn ra
// lòng đường (tim đường OSM lệch về một bên) mà chỉ cắt tới mép lòng đường thì thành bức tường dựng ngay trên bó vỉa, không còn hè.
{
  const deg = new Map(); for (const r of roads) for (const e of [r.p[0], r.p[r.p.length - 1]]) deg.set(keyP(e), (deg.get(keyP(e)) || 0) + 1);
  const disc = (c, rad) => { const o = []; for (let i = 0; i < 12; i++) o.push({ X: Math.round(c[0] + Math.cos((i / 12) * 6.2832) * rad), Y: Math.round(c[1] + Math.sin((i / 12) * 6.2832) * rad) }); return o; };
  const minPave = (r) => (KIND[r.k] === 'service' || (r.f & F_FLUSH) || !midOld(r) ? 0 : r.w < 45 ? 9 : 12);
  const rib = [], rgrid = new Map();
  for (const r of roads) {
    if (!VEH.has(KIND[r.k]) || (r.f & 2)) continue;
    const hw = r.w / 2 + minPave(r), a = r.p[0], e = r.p[r.p.length - 1], dA = deg.get(keyP(a)) === 1, dE = deg.get(keyP(e)) === 1;
    // đầu cụt: cắt phẳng (không khoét nửa vòng tròn vào nhà ở cuối ngõ); đầu nối với đường khác: bo tròn
    let paths = cOffset([toC(r.p)], hw, dA || dE ? ET.etOpenButt : ET.etOpenRound, JT.jtRound);
    if (dA !== dE) paths = [...paths, disc(dA ? e : a, hw)];
    const bb = bbOf(r.p); bb[0] -= hw; bb[1] -= hw; bb[2] += hw; bb[3] += hw;
    const it = { bb, paths, r, hw }; rib.push(it);
    // ghi vào lưới theo từng cạnh (đường chéo dài có hộp bao rất rộng)
    for (let i = 0; i < r.p.length - 1; i++) { const x0 = Math.min(r.p[i][0], r.p[i + 1][0]) - hw, x1 = Math.max(r.p[i][0], r.p[i + 1][0]) + hw, z0 = Math.min(r.p[i][1], r.p[i + 1][1]) - hw, z1 = Math.max(r.p[i][1], r.p[i + 1][1]) + hw;
      for (let x = Math.floor(x0 / BCELL); x <= Math.floor(x1 / BCELL); x++) for (let z = Math.floor(z0 / BCELL); z <= Math.floor(z1 / BCELL); z++) { const k = x * 100003 + z; let l = rgrid.get(k); if (!l) rgrid.set(k, (l = [])); if (!l.includes(it)) l.push(it); } }
  }
  let cut = 0, dropped = 0, split = 0, lost = 0; const extra = [];
  for (const b of buildings) {
    if (b.dead || isRoof(b) || keepShape.has(b)) continue;
    const cand = new Set();
    for (let x = Math.floor(b.bb[0] / BCELL); x <= Math.floor(b.bb[2] / BCELL); x++) for (let z = Math.floor(b.bb[1] / BCELL); z <= Math.floor(b.bb[3] / BCELL); z++) for (const it of rgrid.get(x * 100003 + z) || []) if (it.bb[0] <= b.bb[2] && it.bb[2] >= b.bb[0] && it.bb[1] <= b.bb[3] && it.bb[3] >= b.bb[1]) cand.add(it);
    if (!cand.size) continue;
    // chỉ xét đường thật sự chạm nhà: tim đường cách mép nhà dưới nửa bề rộng, hoặc có điểm nằm trong nhà
    const hitRoads = [...cand].filter((it) => { const hw = it.hw, p = it.r.p; for (let i = 0; i < p.length - 1; i++) { const L = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]), ns = Math.max(1, Math.ceil(L / 10)); for (let s = 0; s <= ns; s++) { const x = p[i][0] + ((p[i + 1][0] - p[i][0]) * s) / ns, z = p[i][1] + ((p[i + 1][1] - p[i][1]) * s) / ns; if (x < b.bb[0] - hw || x > b.bb[2] + hw || z < b.bb[1] - hw || z > b.bb[3] + hw) continue; if (lineD([x, z], b.p, true) < hw || inB(b, x, z)) return true; } } return false; });
    if (!hitRoads.length) continue;
    const before = b.a * 100, ex = cExec(CT.ctDifference, bPaths(b), hitRoads.flatMap((it) => it.paths), FT.pftEvenOdd, FT.pftNonZero);
    const after = ex.reduce((s, e) => s + exArea(e), 0); if (before - after < 30) continue; // dưới 0,3 m²: coi như không chạm
    // mảnh quá nhỏ hoặc quá mỏng thì bỏ
    const parts = ex.filter((e) => exArea(e) >= 1000 && cOffset([e.outer], -5).length).sort((p, q) => exArea(q) - exArea(p));
    lost += before - parts.reduce((s, e) => s + exArea(e), 0);
    if (!parts.length || !setShape(b, parts[0], 0.5)) { b.dead = true; dropped++; continue; }
    cut++;
    for (const e of parts.slice(1)) { const nb = { ...b, n: -1, p: [], holes: [] }; if (setShape(nb, e, 0.5)) { extra.push(nb); split++; } }
  }
  for (const nb of extra) buildings.push(nb);
  console.log('Nhà đè lên lòng đường xe chạy: cắt', cut, 'nhà, bỏ hẳn', dropped, 'nhà, tách thêm', split, 'mảnh; diện tích cắt đi', (lost / 100).toFixed(0), 'm²');
}

// ----- 5. Phố cổ: kéo mặt tiền ra sát hè -----
// Mặt bằng nhà phố cổ trong OSM (và nhà máy học vẽ) thụt vào so với mặt tiền thật 2 đến 5 m, nên phố nghề rộng 13 đến 21 m từ
// tường tới tường thay vì 9 đến 12 m. Ở đây đi dọc từng con phố trong khu 36 phố phường, hai bên, cứ 25 cm bắn một tia vuông góc
// từ đường mặt tiền mong muốn (mép hè) vào trong: gặp mặt nhà nào trước thì nhà đó được nối dài ra tới đường mặt tiền, đúng trong
// phần bề ngang của nó. Mỗi nhà lệch nhau vài chục cm cho so le. Không kéo qua đường khác, lối đi bộ, tường rào, mảng xanh;
// không kéo nhà công cộng, đền chùa, công trình có tên trong bảng; phần nối không chồng lên nhà khác.
//   phố:        hè 1,6 đến 2,2 m, kéo tối đa 6 m (trục Hàng Gai - Hàng Bông - Cầu Gỗ: hè 2,0 đến 2,4 m, kéo tối đa 9 m;
//               trục Hàng Đào - Hàng Ngang - Hàng Đường - Đồng Xuân: hè 1,5 đến 2,0 m)
//   phố hẹp:    (lòng dưới 4,5 m, như Tạ Hiện) hè 1,2 đến 1,5 m, kéo tối đa 4 m
//   ngõ lát liền: tường ra đúng mép ngõ, kéo tối đa 2 m
{
  const pullSpec = (r) => {
    const k = KIND[r.k], nm = names[r.n] || ''; if (!VEH.has(k) || (r.f & 2) || r.w > 80) return null;
    if (r.f & F_FLUSH) return { off: r.w / 2, jit: 1, max: 20 };
    if (k === 'service' || OLD_KEEP.test(nm)) return null; // lối vào sân, bãi xe; phố bao quanh và phố lớn (hè rộng) giữ nguyên
    if (r.w < 45) return { off: r.w / 2 + 12, jit: 3, max: 40 };
    if (/^Phố (Hàng Gai|Hàng Bông|Cầu Gỗ)$/.test(nm)) return { off: r.w / 2 + 20, jit: 4, max: 90 }; // dãy nhà mặt phố Hàng Gai phía bắc vẽ thụt tới 8 m
    if (OLD_AXIS.test(nm)) return { off: r.w / 2 + 15, jit: 5, max: 60 }; // trục Hàng Đào - Đồng Xuân: lòng 7 m, lộ giới khoảng 10 m, hè 1,5 đến 2 m
    return { off: r.w / 2 + 16, jit: 6, max: 60 };
  };
  const ZB = [-9000, -14200, 5500, 1000]; // khung bao khu phố cổ, nới 100 m (dm)
  const inZB = (bb) => bb[0] <= ZB[2] && bb[2] >= ZB[0] && bb[1] <= ZB[3] && bb[3] >= ZB[1];
  buildings.forEach((b, i) => { b.idx = i; });
  // lưới cạnh nhà (ô 10 m) có số phiên bản: nhà đổi hình thì ghi lại cạnh với phiên bản mới, cạnh cũ tự hết hiệu lực
  const EC = 100, egrid = new Map(), ver = new Map();
  const cellsOf = (x0, z0, x1, z1, fn) => { for (let x = Math.floor(Math.min(x0, x1) / EC); x <= Math.floor(Math.max(x0, x1) / EC); x++) for (let z = Math.floor(Math.min(z0, z1) / EC); z <= Math.floor(Math.max(z0, z1) / EC); z++) fn(x * 100003 + z); };
  const eput = (b) => { const v = (ver.get(b) || 0) + 1; ver.set(b, v); for (const ring of [b.p, ...b.holes]) for (let i = 0; i < ring.length; i++) { const a = ring[i], c = ring[(i + 1) % ring.length], e = [a[0], a[1], c[0], c[1], b, v]; cellsOf(a[0], a[1], c[0], c[1], (k) => { let l = egrid.get(k); if (!l) egrid.set(k, (l = [])); l.push(e); }); } };
  for (const b of buildings) if (!b.dead && !isRoof(b) && inZB(b.bb)) eput(b);
  // tia từ O theo véc-tơ N, tham số tau trong [t0, t1]: mặt nhà gặp đầu tiên
  const rayHit = (ox, oz, nx, nz, t0, t1) => {
    let bt = t1, be = null;
    cellsOf(ox + nx * t0, oz + nz * t0, ox + nx * t1, oz + nz * t1, (k) => { const l = egrid.get(k); if (!l) return; for (const e of l) {
      if (e[4].dead || ver.get(e[4]) !== e[5]) continue;
      const ex = e[2] - e[0], ez = e[3] - e[1], den = nx * ez - nz * ex; if (Math.abs(den) < 1e-9) continue;
      const t = ((e[0] - ox) * ez - (e[1] - oz) * ex) / den, u = ((e[0] - ox) * nz - (e[1] - oz) * nx) / den;
      if (u >= 0 && u <= 1 && t >= t0 && t < bt) { bt = t; be = e; }
    } });
    return be ? { tau: bt, b: be[4], e: be } : null;
  };
  // vật cản: mọi đường khác (xe chạy lẫn đi bộ), tường rào
  const sgrid = new Map();
  const sput = (ax, az, bx, bz, r, hw) => cellsOf(ax, az, bx, bz, (k) => { let l = sgrid.get(k); if (!l) sgrid.set(k, (l = [])); l.push([ax, az, bx, bz, r, hw]); });
  for (const r of roads) { const bb = bbOf(r.p); if (!inZB(bb) || (r.f & 2)) continue; for (let i = 0; i < r.p.length - 1; i++) sput(r.p[i][0], r.p[i][1], r.p[i + 1][0], r.p[i + 1][1], r, Math.max(4, r.w / 2 - 1)); }
  for (const w of walls) { if (!inZB(bbOf(w.p))) continue; for (let i = 0; i < w.p.length - 1; i++) sput(w.p[i][0], w.p[i][1], w.p[i + 1][0], w.p[i + 1][1], null, 0.5); }
  const segSeg = (ax, az, bx, bz, cx, cz, dx, dz) => { // khoảng cách nhỏ nhất giữa hai đoạn thẳng
    const o = (px, pz, qx, qz, rx, rz) => (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
    if (o(ax, az, bx, bz, cx, cz) * o(ax, az, bx, bz, dx, dz) < 0 && o(cx, cz, dx, dz, ax, az) * o(cx, cz, dx, dz, bx, bz) < 0) return 0;
    return Math.min(segD(ax, az, cx, cz, dx, dz), segD(bx, bz, cx, cz, dx, dz), segD(cx, cz, ax, az, bx, bz), segD(dx, dz, ax, az, bx, bz));
  };
  const blocked = (ax, az, bx, bz, self) => {
    let hit = false; const m = 40;
    cellsOf(Math.min(ax, bx) - m, Math.min(az, bz) - m, Math.max(ax, bx) + m, Math.max(az, bz) + m, (k) => { if (hit) return; const l = sgrid.get(k); if (!l) return; for (const s of l) { if (s[4] === self) continue; if (segSeg(ax, az, bx, bz, s[0], s[1], s[2], s[3]) < s[5]) { hit = true; return; } } });
    return hit;
  };
  const soft = [...green.map((g) => g.p), ...water.map((w) => w.p)].filter((p) => inZB(bbOf(p))).map((p) => ({ p, bb: bbOf(p) }));
  const onSoft = (x, z) => soft.some((s) => x >= s.bb[0] && x <= s.bb[2] && z >= s.bb[1] && z <= s.bb[3] && pip(x, z, s.p));
  const pullable = (b) => !b.dead && !keepShape.has(b) && (CAT[b.c] === 'house' || CAT[b.c] === 'apart' || CAT[b.c] === 'modern');
  // dải cấm xây quanh từng con đường (bo theo bề rộng): phần nối không được lấn vào
  const ribCache = new Map();
  const noBuild = (r) => { let p = ribCache.get(r); if (!p) { const sp = midOld(r) ? pullSpec(r) : null, hw = sp ? sp.off - 0.5 : VEH.has(KIND[r.k]) ? r.w / 2 + 3 : r.w / 2 + 2; ribCache.set(r, (p = cOffset([toC(r.p)], hw, ET.etOpenRound, JT.jtRound))); } return p; };
  const roadsNear = (bb) => { const s = new Set(); cellsOf(bb[0] - 150, bb[1] - 150, bb[2] + 150, bb[3] + 150, (k) => { for (const e of sgrid.get(k) || []) if (e[4]) s.add(e[4]); }); return [...s]; };

  const STEP = 2.5, order = roads.filter((r) => pullSpec(r) && inZB(bbOf(r.p))).sort((a, b) => a.w - b.w || roads.indexOf(a) - roads.indexOf(b));
  let nB = 0, grown = 0; const touched = new Set();
  for (const r of order) {
    const sp = pullSpec(r), P = r.p, m = P.length;
    for (const side of [1, -1]) {
      // pháp tuyến từng cạnh và véc-tơ vát tại từng đỉnh (N·n = 1, để đường mặt tiền luôn song song tim đường)
      const dir = [], nrm = [];
      for (let i = 0; i < m - 1; i++) { const dx = P[i + 1][0] - P[i][0], dz = P[i + 1][1] - P[i][1], L = Math.hypot(dx, dz) || 1; dir.push([dx / L, dz / L, L]); nrm.push([(-dz / L) * side, (dx / L) * side]); }
      const miter = (j) => { if (j === 0) return nrm[0]; if (j === m - 1) return nrm[m - 2]; const a = nrm[j - 1], b = nrm[j]; let x = a[0] + b[0], z = a[1] + b[1]; const l = Math.hypot(x, z); if (l < 0.3) return b; x /= l; z /= l; const c = Math.max(0.5, x * a[0] + z * a[1]); return [x / c, z / c]; };
      const cells = [];
      for (let i = 0; i < m - 1; i++) {
        const L = dir[i][2]; if (L < 1) continue;
        const Ns = miter(i), Ne = miter(i + 1), nc = Math.max(1, Math.ceil(L / STEP));
        // phía trong của khúc cong các tia chụm lại: không nối sâu quá chỗ chúng cắt nhau
        const conv = -((Ne[0] - Ns[0]) * dir[i][0] + (Ne[1] - Ns[1]) * dir[i][1]), lim = conv > 1e-6 ? (0.9 * L) / conv : 1e9;
        const C = (u) => [P[i][0] + (P[i + 1][0] - P[i][0]) * u, P[i][1] + (P[i + 1][1] - P[i][1]) * u], N = (u) => [Ns[0] + (Ne[0] - Ns[0]) * u, Ns[1] + (Ne[1] - Ns[1]) * u];
        for (let k = 0; k < nc; k++) {
          const u0 = k / nc, u1 = (k + 1) / nc, c = C((u0 + u1) / 2), n = N((u0 + u1) / 2), cell = { a0: C(u0), a1: C(u1), n0: N(u0), n1: N(u1), d: dir[i], ns: nrm[i], lim, b: null, tau: 0, e: null };
          cells.push(cell);
          if (!inOldQ(c[0], c[1])) continue;
          const ox = c[0] + n[0] * sp.off, oz = c[1] + n[1] * sp.off;
          if (bAt(ox, oz)) continue; // nhà đã ra tới (hoặc quá) đường mặt tiền
          const h = rayHit(c[0], c[1], n[0], n[1], sp.off, sp.off + sp.jit + sp.max); if (!h || !pullable(h.b)) continue;
          const hx = c[0] + n[0] * h.tau, hz = c[1] + n[1] * h.tau;
          if (blocked(ox, oz, hx, hz, r) || onSoft((ox + hx) / 2, (oz + hz) / 2)) continue;
          cell.b = h.b; cell.tau = h.tau; cell.e = h.e;
        }
      }
      // bỏ các vệt quá hẹp (dưới 0,75 m) và vệt nhìn xuyên khe giữa hai nhà tới một nhà ở sâu phía sau
      const runs = []; for (let i = 0; i < cells.length;) { let j = i; while (j < cells.length && cells[j].b === cells[i].b) j++; runs.push([i, j]); i = j; }
      runs.forEach(([i, j], q) => {
        const b = cells[i].b; if (!b) return;
        const tMin = Math.min(...cells.slice(i, j).map((c) => c.tau)), nbT = [runs[q - 1], runs[q + 1]].filter((x) => x && cells[x[0]].b).map((x) => Math.min(...cells.slice(x[0], x[1]).map((c) => c.tau)));
        if (j - i < 3 || (j - i < 8 && nbT.length && tMin > Math.max(...nbT) + 25)) for (let k = i; k < j; k++) cells[k].b = null;
      });
      const byB = new Map(); cells.forEach((c, i) => { if (c.b) { let l = byB.get(c.b); if (!l) byB.set(c.b, (l = [])); l.push(i); } });
      for (const [b, idx] of byB) {
        if (idx.length < 4) continue;
        const T = sp.off + Math.floor((((b.idx * 2654435761) >>> 0) / 4294967296) * (sp.jit + 1)), quads = [];
        // mỗi vệt ô liền nhau thành MỘT đa giác (mép trước là đường mặt tiền, mép sau nằm trong lòng nhà): giữa các ô không có đường nối
        // nào, nên làm tròn toạ độ không tạo ra khe hở sợi tóc trên mặt tiền
        const use = idx.filter((i) => cells[i].tau - T >= 2);
        for (let q = 0; q < use.length;) {
          let e = q; while (e + 1 < use.length && use[e + 1] === use[e] + 1) e++;
          const front = [], back = [];
          for (let k = q; k <= e + 1; k++) { // các mép ô: mép k nằm giữa ô k-1 và ô k của vệt
            const a = k <= e ? cells[use[k]] : null, p = k > q ? cells[use[k - 1]] : null, c = a || p, n = a ? c.n0 : c.n1; let o = a ? c.a0 : c.a1;
            let D = Math.min(Math.max(a ? a.tau : 0, p ? p.tau : 0) + 4, Math.min(a ? a.lim : 1e9, p ? p.lim : 1e9));
            // hai đầu vệt: dời mép cho đi qua đúng góc nhà (đầu mút của cạnh mặt tiền gặp ở ô cuối), để mép bên của phần nối trùng với
            // tường bên của nhà, và hai nhà liền kề chung một góc thì hai phần nối cũng giáp nhau khít, không hở, không chồng
            // Mép sau ở đầu vệt dừng ĐÚNG tại góc nhà (không thò sâu thêm): phần nối không sinh ra đỉnh mới nào nằm trên tường chung, vì toạ độ
            // làm tròn tới dm nên một đỉnh mới trên bức tường dài 40 m sẽ kéo lệch cả bức tường vài cm sang nhà bên.
            let corner = null;
            if (!a || !p) {
              const ed = c.e, sg = a ? -1 : 1, pa = (ed[0] - o[0]) * c.d[0] + (ed[1] - o[1]) * c.d[1], pb = (ed[2] - o[0]) * c.d[0] + (ed[3] - o[1]) * c.d[1];
              const V = pa * sg > pb * sg ? [ed[0], ed[1]] : [ed[2], ed[3]], tv = (V[0] - o[0]) * c.ns[0] + (V[1] - o[1]) * c.ns[1], o2 = [V[0] - n[0] * tv, V[1] - n[1] * tv];
              if (tv > T + 1 && tv <= c.lim && Math.hypot(o2[0] - o[0], o2[1] - o[1]) <= STEP * 1.3) { o = o2; corner = V; }
            }
            if (!corner && D <= T + 1) { front.length = 0; back.length = 0; break; }
            // mép trước (đường mặt tiền) chỉ lấy điểm ở hai đầu vệt và chỗ tim đường gấp khúc: giữa hai điểm đó là một đoạn thẳng tuyệt đối,
            // không thành bậc thang 1 dm do làm tròn toạ độ; mép sau nằm trong lòng nhà nên điểm nào cũng được
            if (!a || !p || a.d !== p.d) front.push({ X: Math.round(o[0] + n[0] * T), Y: Math.round(o[1] + n[1] * T) });
            back.push(corner ? { X: corner[0], Y: corner[1] } : { X: Math.round(o[0] + n[0] * D), Y: Math.round(o[1] + n[1] * D) });
          }
          if (front.length > 1) { const poly = [...front, ...back.reverse()]; if (!ClipperLib.Clipper.Orientation(poly)) poly.reverse(); quads.push(poly); }
          q = e + 1;
        }
        if (!quads.length) continue;
        let strip = cExec(CT.ctUnion, quads, null); if (!strip.length) continue;
        const sbb = bbOf(strip.flatMap((e) => fromC(e.outer)));
        const others = [...bNear(sbb)].filter((o) => o !== b && !isRoof(o)).map((o) => toC(o.p));
        const ribs = roadsNear(sbb).flatMap(noBuild);
        if (others.length) strip = cExec(CT.ctDifference, exPaths(strip), others);
        if (strip.length && ribs.length) strip = cExec(CT.ctDifference, exPaths(strip), ribs);
        if (!strip.length) continue;
        const before = b.a * 100, ex = cExec(CT.ctUnion, bPaths(b), exPaths(strip), FT.pftEvenOdd, FT.pftNonZero).sort((p, q) => exArea(q) - exArea(p));
        if (!ex.length || exArea(ex[0]) < before + 50) continue;
        const keep = { p: b.p, holes: b.holes, a: b.a };
        if (!setShape(b, ex[0], 0.12)) { Object.assign(b, keep); gput(b); continue; } // dung sai 1,2 cm: chỉ bỏ điểm thẳng hàng, không nắn tường chung với nhà bên
        eput(b); grown += b.a * 100 - before; if (!touched.has(b)) { touched.add(b); nB++; }
      }
    }
  }
  for (const b of buildings) delete b.idx;
  console.log('Phố cổ: kéo mặt tiền', nB, 'nhà ra sát hè dọc', order.length, 'đoạn phố, ngõ; diện tích nối thêm', (grown / 100).toFixed(0), 'm²');
}

// ----- kiểm lại: tim đường xe chạy (tới cấp phố nhỏ) không còn nằm trong nhà -----
{
  let n = 0, len = 0;
  for (const r of roads) {
    if (!VEH.has(KIND[r.k]) || KIND[r.k] === 'service' || (r.f & 2)) continue;
    const L = plen(r.p); let run = 0;
    for (let s = 0; s <= L; s += 10) { const q = ptAt(r.p, s), b = bAt(q[0], q[1]); if (b && !keepShape.has(b)) run++; if ((!b || s + 10 > L) && run) { if (run >= 2) { n++; len += run; } run = 0; } }
  }
  console.log('Kiểm lại: tim đường xe chạy nằm trong nhà:', n, 'đoạn, tổng', len, 'm');
}

// ---------- ghi ----------
const flat = (a) => a.flat();
const world = {
  v: 2,
  attribution: '© OpenStreetMap contributors (ODbL 1.0)' + (mlRelease ? '; Overture Maps ' + mlRelease + ': Microsoft ML Buildings (ODbL), Google Open Buildings (CC BY 4.0)' : ''),
  fetched: raw.fetched, origin: ORIGIN, mPerLon: MLON, mPerLat: MLAT,
  bounds: [B.x0, B.z0, B.x1, B.z1],
  names, cats: CAT, kinds: KIND,
  // toà nhà: [loại, số tầng, cao dm, tên, điểm..., (lỗ...)]
  // nhà đã bỏ ghi là số 0: giữ chỗ để chỉ số các nhà khác (hạt giống của bộ sinh) không xê dịch
  buildings: buildings.map((b) => (b.dead ? 0 : b.holes.length ? [b.c, b.lv, b.h, b.n, enc(b.p), b.holes.map(enc)] : [b.c, b.lv, b.h, b.n, enc(b.p)])),
  // đường: [loại, rộng dm, cờ (1 một chiều, 2 cầu, 4 xuyên nhà, 8 ngược chiều, 16 cấm ô tô, 32 cấm xe máy, 64 ngõ lát liền), tên, tầng, điểm...]
  roads: roads.map((r) => [r.k, r.w, r.f, r.n, r.layer, enc(r.p)]),
  water: water.map((w) => (w.holes.length ? [w.n, enc(w.p), w.holes.map(enc)] : [w.n, enc(w.p)])),
  green: green.map((g) => (g.holes.length ? [g.k, g.n, enc(g.p), g.holes.map(enc)] : [g.k, g.n, enc(g.p)])),
  rails: rails.map((r) => [r.f, enc(r.p)]),
  walls: walls.map((w) => [w.k, enc(w.p)]),
  gates: flat(gates), trees: flat(trees), food: flat(food), bench: flat(bench), fountain: flat(fountain),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(world));
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`${buildings.filter((b) => !b.dead).length} nhà (${buildings.length} chỗ trong mảng), ${roads.length} đoạn đường, ${water.length} mặt nước, ${green.length} mảng xanh, ${rails.length} đường sắt, ${walls.length} tường rào, ${trees.length} cây, ${food.length} hàng quán → ${OUT} (${kb} KB)`);
