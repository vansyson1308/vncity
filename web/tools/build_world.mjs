// Chuyển dữ liệu OSM thô (web/.cache/osm/merged.json, tải bằng fetch_osm.mjs) thành bản đồ gọn cho game:
// web/public/world/hanoi.json. Tệp kết quả được commit, nên CI và người chơi không cần mạng tới OSM.
// Toạ độ: gốc ở Hồ Gươm, x hướng đông, z hướng nam, đơn vị đề-xi-mét (số nguyên), đường gấp khúc mã hoá delta.
// Dữ liệu © những người đóng góp OpenStreetMap, giấy phép ODbL 1.0.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const ClipperLib = createRequire(import.meta.url)('clipper-lib');
import { SOLEMN } from '../src/world/data.js';

const SRC = path.resolve('.cache/osm/merged.json');
const OUT = path.resolve('public/world/hanoi.json');
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
  if (['temple', 'shrine', 'pagoda'].includes(b) || t.amenity === 'place_of_worship' || /^(đền|chùa|đình|miếu|điện|phủ|am|văn miếu|nhà thờ họ|từ đường)\s/.test(nm)) return 'temple';
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

// Lấp chỗ OSM chưa vẽ nhà bằng nhà do máy học vẽ của Overture (tools/fetch_overture.py), nếu có.
const osmCount = buildings.length;
const ML = path.resolve('.cache/overture_ml.json');
let mlRelease = null;
if (fs.existsSync(ML)) {
  const ml = JSON.parse(fs.readFileSync(ML, 'utf8')); mlRelease = ml.release;
  const CELL = 300, grid = new Map(), key = (x, z) => Math.floor(x / CELL) * 100003 + Math.floor(z / CELL);
  const bb = (r) => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const p of r) { x0 = Math.min(x0, p[0]); z0 = Math.min(z0, p[1]); x1 = Math.max(x1, p[0]); z1 = Math.max(z1, p[1]); } return [x0, z0, x1, z1]; };
  const put = (r) => { const [x0, z0, x1, z1] = bb(r); for (let x = Math.floor(x0 / CELL); x <= Math.floor(x1 / CELL); x++) for (let z = Math.floor(z0 / CELL); z <= Math.floor(z1 / CELL); z++) { const k = x * 100003 + z; let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(r); } };
  const pip = (x, z, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > z) !== (r[j][1] > z) && x < ((r[j][0] - r[i][0]) * (z - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };
  const hit = (x, z) => (grid.get(key(x, z)) || []).some((r) => pip(x, z, r));
  for (const b of buildings) put(b.p);
  let added = 0;
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
    if (buildings.length > n0) { buildings[n0].ml = 1; put(buildings[n0].p); added++; }
  }
  console.log('Nhà ML thêm từ Overture:', added, '/', ml.items.length);
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
  const flags = (t.oneway === 'yes' || t.junction === 'roundabout' ? 1 : 0) | (bridge ? 2 : 0) | (t.tunnel === 'building_passage' ? 4 : 0) | (t.oneway === '-1' ? 8 : 0);
  let cur = [];
  const flush = () => {
    if (cur.length > 1) {
      // cắt theo khung bản đồ (cộng lề) bằng hình học: đoạn nào vắt qua mép thì cắt đúng tại mép, không bỏ cả đoạn
      // (cầu Long Biên chỉ có vài nút, nút kế tiếp nằm tận bờ bên kia sông)
      let part = [];
      const emit = () => { if (part.length > 1) roads.push({ k: KIND.indexOf(k), w: Math.round(width), f: flags, n: N(t.name), layer: parseInt(t.layer || '0', 10) || 0, p: part }); part = []; };
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

// Thu hẹp lòng đường theo khoảng trống thật giữa hai dãy nhà, để đường không ăn vào mặt tiền.
{
  const CELL = 200, grid = new Map();
  const put = (a, b, bi) => {
    const x0 = Math.floor(Math.min(a[0], b[0]) / CELL), x1 = Math.floor(Math.max(a[0], b[0]) / CELL), z0 = Math.floor(Math.min(a[1], b[1]) / CELL), z1 = Math.floor(Math.max(a[1], b[1]) / CELL);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const key = x * 100003 + z; let l = grid.get(key); if (!l) grid.set(key, (l = [])); l.push(a[0], a[1], b[0], b[1], bi); }
  };
  buildings.forEach((b, bi) => { if (CAT[b.c] === 'roof') return; for (let i = 0; i < b.p.length; i++) put(b.p[i], b.p[(i + 1) % b.p.length], bi); });
  const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0; return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
  const clearance = (px, pz, max) => {
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
    const clear = ds[Math.floor(ds.length * 0.2)];
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
const walls = [];
for (const w of ways.values()) {
  const b = w.tags?.barrier; if (!['wall', 'fence', 'city_wall', 'retaining_wall', 'hedge'].includes(b)) continue;
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

// ---------- ghi ----------
const flat = (a) => a.flat();
const world = {
  v: 2,
  attribution: '© OpenStreetMap contributors (ODbL 1.0)' + (mlRelease ? '; Overture Maps ' + mlRelease + ': Microsoft ML Buildings (ODbL), Google Open Buildings (CC BY 4.0)' : ''),
  fetched: raw.fetched, origin: ORIGIN, mPerLon: MLON, mPerLat: MLAT,
  bounds: [B.x0, B.z0, B.x1, B.z1],
  names, cats: CAT, kinds: KIND,
  // toà nhà: [loại, số tầng, cao dm, tên, điểm..., (lỗ...)]
  buildings: buildings.map((b) => (b.holes.length ? [b.c, b.lv, b.h, b.n, enc(b.p), b.holes.map(enc)] : [b.c, b.lv, b.h, b.n, enc(b.p)])),
  // đường: [loại, rộng dm, cờ (1 một chiều, 2 cầu, 4 xuyên nhà, 8 ngược chiều), tên, tầng, điểm...]
  roads: roads.map((r) => [r.k, r.w, r.f, r.n, r.layer, enc(r.p)]),
  water: water.map((w) => (w.holes.length ? [w.n, enc(w.p), w.holes.map(enc)] : [w.n, enc(w.p)])),
  green: green.map((g) => (g.holes.length ? [g.k, g.n, enc(g.p), g.holes.map(enc)] : [g.k, g.n, enc(g.p)])),
  rails: rails.map((r) => [r.f, enc(r.p)]),
  walls: walls.map((w) => [w.k, enc(w.p)]),
  trees: flat(trees), food: flat(food), bench: flat(bench), fountain: flat(fountain),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(world));
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`${buildings.length} nhà, ${roads.length} đoạn đường, ${water.length} mặt nước, ${green.length} mảng xanh, ${rails.length} đường sắt, ${walls.length} tường rào, ${trees.length} cây, ${food.length} hàng quán → ${OUT} (${kb} KB)`);
