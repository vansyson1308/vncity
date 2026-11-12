// Chỉ mục không gian và các thuộc tính suy ra (số tầng, kiểu nhà) tính một lần khi worker khởi động.
import ClipperLib from 'clipper-lib';
import { hash, pointInRing, segDist2 } from '../../core/util.js';
import { CS, K, CAT, ST, ZONE, zoneAt, F_BRIDGE, isVehicle, isSolemn, roadY, alongAt, chuongDuongMid, CD_TRUSS_S } from '../data.js';
import { sitePaths } from '../landmarks/sites.js';
import { resolveHeroes } from './heroes.js';

export const CL = ClipperLib;
const PT = CL.PolyType, CT = CL.ClipType, FT = CL.PolyFillType;
export const toPath = (p) => { const o = new Array(p.length / 2); for (let i = 0; i < o.length; i++) o[i] = { X: Math.round(p[i * 2] * 10), Y: Math.round(p[i * 2 + 1] * 10) }; return o; };
export function clip(type, subj, clipP, fill = FT.pftNonZero) {
  const c = new CL.Clipper();
  if (subj.length) c.AddPaths(subj, PT.ptSubject, true);
  if (clipP && clipP.length) c.AddPaths(clipP, PT.ptClip, true);
  const out = new CL.Paths(); c.Execute(type, out, fill, fill); return out;
}
export const union = (a, b) => clip(CT.ctUnion, a, b);
export const inter = (a, b) => (a.length && b.length ? clip(CT.ctIntersection, a, b) : []);
export const diff = (a, b) => (a.length && b.length ? clip(CT.ctDifference, a, b) : a);
export function offset(paths, delta, open = false, arc = 1.2) {
  if (!paths.length) return [];
  const co = new CL.ClipperOffset(2, arc);
  co.AddPaths(paths, CL.JoinType.jtRound, open ? CL.EndType.etOpenRound : CL.EndType.etClosedPolygon);
  const out = new CL.Paths(); co.Execute(out, delta); return out;
}
export function toEx(paths) {
  if (!paths.length) return [];
  const c = new CL.Clipper(); c.AddPaths(paths, PT.ptSubject, true);
  const tree = new CL.PolyTree(); c.Execute(CT.ctUnion, tree, FT.pftNonZero, FT.pftNonZero);
  return CL.JS.PolyTreeToExPolygons(tree);
}
export const rectPath = (x0, z0, x1, z1) => [{ X: x0, Y: z0 }, { X: x1, Y: z0 }, { X: x1, Y: z1 }, { X: x0, Y: z1 }];

class Grid {
  constructor(cell) { this.cell = cell; this.m = new Map(); }
  key(cx, cz) { return cx * 65537 + cz; }
  addBox(x0, z0, x1, z1, v) {
    const c = this.cell;
    for (let cx = Math.floor(x0 / c); cx <= Math.floor(x1 / c); cx++) for (let cz = Math.floor(z0 / c); cz <= Math.floor(z1 / c); cz++) { const k = this.key(cx, cz); let l = this.m.get(k); if (!l) this.m.set(k, (l = [])); l.push(v); }
  }
  // gọi fn cho mọi phần tử trong các ô chạm hộp (có thể lặp nếu phần tử nằm trên nhiều ô)
  query(x0, z0, x1, z1, fn) {
    const c = this.cell;
    for (let cx = Math.floor(x0 / c); cx <= Math.floor(x1 / c); cx++) for (let cz = Math.floor(z0 / c); cz <= Math.floor(z1 / c); cz++) { const l = this.m.get(this.key(cx, cz)); if (l) for (let i = 0; i < l.length; i++) fn(l[i]); }
  }
  collect(x0, z0, x1, z1) { const s = new Set(); this.query(x0, z0, x1, z1, (v) => s.add(v)); return s; }
}

const FLOORS = {
  [ZONE.old]: [2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 6], // art bible 3.1: 2 tầng 25%, 3 tầng 30%, 4 tầng 25%, 5-6 tầng 20%
  [ZONE.french]: [2, 3, 3, 4, 4, 5], [ZONE.badinh]: [2, 2, 3, 3, 4], [ZONE.city]: [3, 4, 4, 5, 5, 6], [ZONE.bank]: [2, 3, 3, 4],
};

// Khoảng cách nhỏ nhất giữa hai đoạn thẳng 2D (0 nếu cắt nhau).
function segSegDist(ax, az, bx, bz, cx, cz, dx, dz) {
  const o = (px, pz, qx, qz, rx, rz) => (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
  if (o(ax, az, bx, bz, cx, cz) * o(ax, az, bx, bz, dx, dz) < 0 && o(cx, cz, dx, dz, ax, az) * o(cx, cz, dx, dz, bx, bz) < 0) return 0;
  return Math.sqrt(Math.min(segDist2(ax, az, cx, cz, dx, dz), segDist2(bx, bz, cx, cz, dx, dz), segDist2(cx, cz, ax, az, bx, bz), segDist2(dx, dz, ax, az, bx, bz)));
}

export function buildContext(world, landmarks = []) {
  const ctx = { world, landmarks };
  const { roads, buildings, water, green } = world;

  // ----- đường -----
  ctx.roadGrid = new Grid(48);
  for (const r of roads) {
    r.veh = isVehicle(r); r.bridge = !!(r.flags & F_BRIDGE);
    // cầu đi bộ vượt đường (không phải cầu Thê Húc): bỏ khỏi mặt đất và va chạm
    r.skip = r.bridge && !r.veh && world.names[r.name] !== 'Cầu Thê Húc' ? true : (r.kind === K.steps && r.bridge);
    r.path = toPath(r.p);
    ctx.roadGrid.addBox(r.bb[0] - r.w, r.bb[1] - r.w, r.bb[2] + r.w, r.bb[3] + r.w, r);
  }
  // ngã ba, ngã tư: đếm số đường xe chạy tại mỗi đầu mút
  ctx.nodes = new Map();
  const nk = (x, z) => Math.round(x * 10) * 100003 + Math.round(z * 10);
  ctx.nodeKey = nk;
  for (const r of roads) {
    if (!r.veh || r.skip) continue;
    for (const e of [0, r.p.length - 2]) { const k = nk(r.p[e], r.p[e + 1]); let n = ctx.nodes.get(k); if (!n) ctx.nodes.set(k, (n = { deg: 0, major: 0, maxW: 0 })); n.deg++; if (r.kind <= K.residential) n.major++; n.maxW = Math.max(n.maxW, r.w); }
  }
  // Đường gần điểm (x,z) nhất trong bán kính max. Trả về { r, d, t..., px, pz } hoặc null.
  const tOut = [0];
  ctx.nearestRoad = (x, z, max, filter) => {
    let best = null, bd = max * max;
    ctx.roadGrid.query(x - max, z - max, x + max, z + max, (r) => {
      if (r.skip || (filter && !filter(r))) return;
      const p = r.p;
      for (let i = 0; i < p.length - 2; i += 2) {
        const d = segDist2(x, z, p[i], p[i + 1], p[i + 2], p[i + 3], tOut);
        if (d < bd) { bd = d; best = best || {}; best.r = r; best.seg = i; best.t = tOut[0]; }
      }
    });
    if (!best) return null;
    const p = best.r.p, i = best.seg;
    best.px = p[i] + (p[i + 2] - p[i]) * best.t; best.pz = p[i + 1] + (p[i + 3] - p[i + 1]) * best.t; best.d = Math.sqrt(bd);
    return best;
  };

  // ----- cầu nâng: đường bộ và đường sắt có cao độ (xem computeElevation trong data.js) -----
  ctx.elevRoads = roads.filter((r) => r.elev && !r.skip); ctx.elevRails = world.rails.filter((r) => r.elev);
  // lòng giữa cầu Chương Dương và hoành độ chỗ dàn thép bắt đầu (bộ dựng mặt cầu đặt trụ theo nhịp dàn từ đó ra sông)
  { const cd = chuongDuongMid(world); if (cd && cd.r.elev && cd.r.len > CD_TRUSS_S) { const o = [0, 0, 0, 0, 0]; alongAt(cd.r, cd.rev ? cd.r.len - CD_TRUSS_S : CD_TRUSS_S, o); ctx.cdMid = { r: cd.r, rev: cd.rev, x0: o[0] }; } else ctx.cdMid = null; }
  const elevAll = [...ctx.elevRoads, ...ctx.elevRails];
  // Cao độ mặt cầu cao nhất phủ lên điểm (x,z) (cộng lề pad), 0 nếu không có cầu. except: bỏ qua đoạn này.
  ctx.deckAt = (x, z, pad = 0, except = null, only = null) => {
    let y = 0;
    for (const r of only ? [only] : elevAll) {
      if (r === except) continue;
      const m = r.w / 2 + pad; if (x < r.bb[0] - m || x > r.bb[2] + m || z < r.bb[1] - m || z > r.bb[3] + m) continue;
      const p = r.p;
      for (let i = 0; i < p.length - 2; i += 2) {
        if (segDist2(x, z, p[i], p[i + 1], p[i + 2], p[i + 3], tOut) > m * m) continue;
        const ey = roadY(r, r.cum[i / 2] + tOut[0] * (r.cum[i / 2 + 1] - r.cum[i / 2])); if (ey > y) y = ey;
      }
    }
    return y;
  };
  // nút nối giữa các đoạn cầu: để vát mép mặt cầu cho liền nhau
  ctx.elevNodes = new Map();
  for (const r of ctx.elevRoads) for (const e of [0, 1]) {
    const p = r.p, i = e ? p.length - 2 : 0, j = e ? p.length - 4 : 2, L = Math.hypot(p[j] - p[i], p[j + 1] - p[i + 1]) || 1, k = nk(p[i], p[i + 1]);
    let l = ctx.elevNodes.get(k); if (!l) ctx.elevNodes.set(k, (l = [])); l.push({ r, lx: (p[j] - p[i]) / L, lz: (p[j + 1] - p[i + 1]) / L }); // (lx,lz): hướng rời nút
  }

  // ----- mặt nước, mảng xanh (đa giác Clipper đã chuẩn hoá) -----
  const norm = (polys) => polys.map((w) => ({ ...w, paths: clip(CT.ctUnion, [toPath(w.p), ...w.holes.map(toPath)], null, FT.pftEvenOdd) }));
  ctx.water = norm(water); ctx.green = norm(green);
  ctx.waterGrid = new Grid(CS); ctx.water.forEach((w) => ctx.waterGrid.addBox(...w.bb, w));
  ctx.greenGrid = new Grid(CS); ctx.green.forEach((g) => ctx.greenGrid.addBox(...g.bb, g));
  ctx.isWater = (x, z) => {
    let hit = null;
    ctx.waterGrid.query(x, z, x, z, (w) => { if (!hit && x >= w.bb[0] && x <= w.bb[2] && z >= w.bb[1] && z <= w.bb[3] && pointInRing(x, z, w.p) && !w.holes.some((h) => pointInRing(x, z, h))) hit = w; });
    return hit;
  };
  ctx.isGreen = (x, z) => {
    let hit = null;
    ctx.greenGrid.query(x, z, x, z, (g) => { if (!hit && x >= g.bb[0] && x <= g.bb[2] && z >= g.bb[1] && z <= g.bb[3] && pointInRing(x, z, g.p) && !g.holes.some((h) => pointInRing(x, z, h))) hit = g; });
    return hit;
  };

  // ----- toà nhà -----
  // Nhà có bị mặt cầu nâng (cao hơn 0,8 m) phủ lên không: thử các đỉnh nhà, rồi dò dọc tim cầu và hai mép cầu xem có lọt vào nhà.
  // Lối đi phải thông của các công trình dựng tay (sites.js `paths`): nhà nào chạm vào lối thì bỏ hẳn, không giữ va chạm.
  const keepClear = landmarks.flatMap(sitePaths); ctx.keepClear = keepClear; ctx.ghosts = [];
  const blocksPath = (b) => {
    for (const [ax, az, bx, bz, hw] of keepClear) {
      if (b.bb[0] > Math.max(ax, bx) + hw || b.bb[2] < Math.min(ax, bx) - hw || b.bb[1] > Math.max(az, bz) + hw || b.bb[3] < Math.min(az, bz) - hw) continue;
      const L = Math.hypot(bx - ax, bz - az) || 1;
      for (let s = 0; s <= L; s += 0.5) { const x = ax + ((bx - ax) * s) / L, z = az + ((bz - az) * s) / L; if (pointInRing(x, z, b.p)) return true; }
      for (let i = 0; i < b.p.length; i += 2) { const j = (i + 2) % b.p.length; if (segSegDist(b.p[i], b.p[i + 1], b.p[j], b.p[j + 1], ax, az, bx, bz) < hw) return true; }
    }
    return false;
  };
  const underDeck = (b) => {
    for (const r of elevAll) {
      const m = r.w / 2 + 1.5; if (b.bb[0] > r.bb[2] + m || b.bb[2] < r.bb[0] - m || b.bb[1] > r.bb[3] + m || b.bb[3] < r.bb[1] - m) continue;
      for (let i = 0; i < b.p.length; i += 2) if (ctx.deckAt(b.p[i], b.p[i + 1], 0.8, null, r) > 0.8) return true;
      const p = r.p, hw = r.w / 2;
      for (let i = 0; i < p.length - 2; i += 2) {
        const L = r.cum[i / 2 + 1] - r.cum[i / 2], dx = (p[i + 2] - p[i]) / (L || 1), dz = (p[i + 3] - p[i + 1]) / (L || 1);
        for (let s = 0; s <= L; s += 2) {
          const x = p[i] + dx * s, z = p[i + 1] + dz * s; if (x < b.bb[0] - hw || x > b.bb[2] + hw || z < b.bb[1] - hw || z > b.bb[3] + hw) continue;
          if (roadY(r, r.cum[i / 2] + s) < 0.8) continue;
          if (pointInRing(x, z, b.p) || pointInRing(x - dz * hw, z + dx * hw, b.p) || pointInRing(x + dz * hw, z - dx * hw, b.p)) return true;
        }
      }
    }
    return false;
  };
  ctx.bldGrid = new Grid(32);
  ctx.chunkBld = new Map();
  const { x0, z0 } = world.bounds;
  // công trình có tên (bảng gen/heroes.js): ghi đè số tầng, màu, kiểu mặt đứng; nhà đã phá dỡ thì bỏ hẳn
  const heroes = resolveHeroes(world); ctx.heroes = heroes; ctx.plazas = [];
  for (const b of buildings) {
    b.zone = zoneAt(b.cx, b.cz);
    const hero = heroes.get(b) || null;
    if (hero && hero.gone) { b.skip = true; b.ghost = false; b.height = 0; ctx.plazas.push({ b, hero }); continue; }
    // công trình có mô hình dựng tay thì bỏ khối nhà OSM tương ứng
    const lm = landmarks.find((l) => (l.names && l.names.includes(world.names[b.name])) || (l.clear && Math.hypot(b.cx - l.x, b.cz - l.z) < l.clear));
    b.skip = !!lm; b.ghost = lm && !lm.open;
    // nhà nằm dưới gầm cầu hoặc bị cầu cắt ngang (dữ liệu vẽ nhà sát mép cầu, có khi nhận nhầm chính cây cầu là nhà): bỏ
    if (!lm && ((elevAll.length && underDeck(b)) || (keepClear.length && blocksPath(b)))) { b.skip = true; b.ghost = false; b.height = 0; continue; }
    if (b.skip) {
      b.height = 12;
      if (b.ghost) { ctx.ghosts.push(b); const k = Math.floor((b.cx - x0) / CS) * 1000 + Math.floor((b.cz - z0) / CS); let l = ctx.chunkBld.get(k); if (!l) ctx.chunkBld.set(k, (l = [])); l.push(b); }
      continue;
    }
    const r = hash(b.i, 1), r2 = hash(b.i, 2);
    let style, fh = 3.3, floors = 0;
    switch (b.cat) {
      case CAT.apart: style = ST.APART; fh = 3.2; floors = 5; break;
      case CAT.modern: style = ST.MODERN; fh = 3.5; floors = b.area > 600 ? 6 + Math.floor(r * 7) : 4 + Math.floor(r * 4); break;
      case CAT.public: style = ST.PUBLIC; fh = 3.8; floors = 2 + Math.floor(r * 3); break;
      case CAT.temple: style = ST.TEMPLE; fh = 4.6; floors = 1; break;
      case CAT.church: style = ST.CHURCH; fh = 5; floors = 3; break;
      case CAT.market: case CAT.station: style = ST.MARKET; fh = 4.5; floors = 2; break;
      case CAT.small: style = ST.SMALL; fh = 3; floors = 1; break;
      case CAT.roof: style = ST.ROOF_TIN; fh = 4; floors = 1; break;
      default: {
        const f = FLOORS[b.zone]; floors = f[Math.floor(r * f.length)];
        if (b.area < 22) floors = Math.min(floors, 2); else if (b.area > 260) floors = Math.min(Math.max(floors, 3), 5);
        const colonial = b.zone === ZONE.french ? 0.42 : b.zone === ZONE.badinh ? 0.55 : b.zone === ZONE.old ? 0.08 : 0.05;
        style = r2 < colonial ? ST.FRENCH : ST.TUBE; if (style === ST.FRENCH) { fh = 3.8; floors = Math.min(floors, 4); }
        // nhà ống: mỗi nhà một chiều cao tầng; dãy nhà vẽ gộp thì nền chung chỉ 2 tầng, từng lô nhô cao riêng (gen/buildings.js)
        else { fh = 3.05 + hash(b.i, 8) * 0.6; if (b.area > 140) floors = 2; }
      }
    }
    if (b.lv > 0) floors = b.lv;
    let h = b.h > 0 ? b.h : floors * fh + (style === ST.TEMPLE ? 0 : 0.4);
    if (b.h > 0 && !b.lv) floors = Math.max(1, Math.round(b.h / fh));
    b.solemn = isSolemn(b.cx, b.cz);
    if (b.solemn && (style === ST.TUBE || style === ST.APART || style === ST.MODERN)) { style = ST.FRENCH; fh = 3.8; floors = Math.min(floors, 3); h = b.h > 0 ? Math.min(b.h, 14) : floors * fh + 0.4; }
    if (b.cat === CAT.house && floors >= 9) style = ST.MODERN;       // nhà cao tầng gắn thẻ building=yes
    if (style === ST.MODERN && floors < 6 && b.area < 400) style = ST.TUBE; // khách sạn, cửa hàng trong nhà ống
    if (hero) { // bảng công trình có tên
      if (hero.style !== undefined) style = hero.style;
      if (hero.floors) floors = hero.floors;
      if (hero.h) h = hero.h; else if (hero.floors) h = hero.floors * (hero.fh || fh) + 0.4;
      b.hero = hero;
    }
    b.style = style; b.floors = Math.max(1, Math.min(floors, 80)); b.height = Math.min(h, 260);
    // mái: nhà ống phố cổ hay lợp ngói dốc, nhà mới mái bằng hoặc tôn
    const r3 = hash(b.i, 3);
    const leafy = b.zone === ZONE.french || b.zone === ZONE.badinh, rowTube = style === ST.TUBE && b.area > 140;
    b.roof = style === ST.TEMPLE || style === ST.CHURCH ? ST.ROOF_TILE
      : style === ST.MARKET || b.cat === CAT.roof ? ST.ROOF_TIN
      : style === ST.FRENCH && b.floors <= 4 && r3 < (leafy ? 0.88 : 0.6) ? ST.ROOF_TILE       // biệt thự Pháp: mái ngói đỏ bốn mái
      : style === ST.PUBLIC && leafy && b.floors <= 4 && b.area < 3000 && r3 < 0.62 ? ST.ROOF_TILE // công sở, trường học thời Pháp
      : style === ST.TUBE && !rowTube && b.floors <= 4 && r3 < (b.zone === ZONE.old ? 0.4 : leafy ? 0.5 : 0.15) ? ST.ROOF_TILE
      : r3 > 0.86 ? ST.ROOF_TIN : ST.ROOF_FLAT;
    if (hero && hero.roof !== undefined) b.roof = hero.roof;
    ctx.bldGrid.addBox(...b.bb, b);
    const k = Math.floor((b.cx - x0) / CS) * 1000 + Math.floor((b.cz - z0) / CS);
    let l = ctx.chunkBld.get(k); if (!l) ctx.chunkBld.set(k, (l = [])); l.push(b);
  }
  // Toà nhà chứa điểm (x,z), bỏ qua toà `self`.
  ctx.buildingAt = (x, z, self) => {
    let hit = null;
    ctx.bldGrid.query(x, z, x, z, (b) => { if (!hit && b !== self && b.cat !== CAT.roof && x >= b.bb[0] && x <= b.bb[2] && z >= b.bb[1] && z <= b.bb[3] && pointInRing(x, z, b.p)) hit = b; });
    return hit;
  };

  // Điểm (x,z) nằm trong lòng một khối nhà có va chạm (kể cả khối giữ chỗ của công trình dựng tay).
  ctx.insideSolid = (x, z) => !!ctx.buildingAt(x, z) || ctx.ghosts.some((b) => x >= b.bb[0] && x <= b.bb[2] && z >= b.bb[1] && z <= b.bb[3] && pointInRing(x, z, b.p));

  // điểm rời rạc theo ô: cây OSM, hàng quán, ghế, đài phun
  const bucket = (arr, n) => { const m = new Map(); for (let i = 0; i < arr.length; i += n) { const k = Math.floor((arr[i] - x0) / CS) * 1000 + Math.floor((arr[i + 1] - z0) / CS); let l = m.get(k); if (!l) m.set(k, (l = [])); l.push(i); } return m; };
  ctx.treeIdx = bucket(world.trees, 2); ctx.foodIdx = bucket(world.food, 3); ctx.benchIdx = bucket(world.bench, 2); ctx.fountainIdx = bucket(world.fountain, 2);
  ctx.wallGrid = new Grid(CS); world.walls.forEach((w) => ctx.wallGrid.addBox(...w.bb, w));
  ctx.railGrid = new Grid(CS); world.rails.forEach((r) => { const p = r.p; let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (let i = 0; i < p.length; i += 2) { a = Math.min(a, p[i]); b = Math.min(b, p[i + 1]); c = Math.max(c, p[i]); d = Math.max(d, p[i + 1]); } ctx.railGrid.addBox(a, b, c, d, r); });
  return ctx;
}
