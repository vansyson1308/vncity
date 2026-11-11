// Mặt đất của một ô phố: lòng đường nhựa, vỉa hè nâng 16 cm có bó vỉa đá, bãi cỏ, lối dạo, kè hồ, vạch sơn.
// Cách làm: gộp các dải đường (đệm theo bề rộng) bằng Clipper, phần còn lại của ô là khối phố (vỉa hè, sân, công viên).
import earcut from 'earcut';
import { CL, clip, union, inter, diff, offset, toEx, rectPath, toPath } from './context.js';
import { CS, CURB, WATER_Y, K, ZONE, zoneAt, F_ONEWAY } from '../data.js';
import { hash2 } from '../../core/util.js';

export const LAYER = { asphalt: 0, paving: 1, curb: 2, grass: 3, path: 4, dirt: 5, white: 6, yellow: 7, stone: 8, flower: 9, gravel: 10, plaza: 11 };

class GB {
  constructor(ox, oz) { this.ox = ox; this.oz = oz; this.pos = []; this.nrm = []; this.lay = []; this.idx = []; }
  get n() { return this.pos.length / 3; }
  v(x, y, z, nx, ny, nz, layer) { this.pos.push(x - this.ox, y, z - this.oz); this.nrm.push(nx, ny, nz); this.lay.push(layer); return this.pos.length / 3 - 1; }
  // mặt trên của các đa giác (toạ độ dm) ở độ cao y
  fill(ex, y, layer) {
    for (const e of ex) {
      const flat = [], holes = [];
      for (const p of e.outer) flat.push(p.X / 10, p.Y / 10);
      for (const h of e.holes) { holes.push(flat.length / 2); for (const p of h) flat.push(p.X / 10, p.Y / 10); }
      const t = earcut(flat, holes), b = this.n;
      for (let i = 0; i < flat.length; i += 2) this.v(flat[i], y, flat[i + 1], 0, 1, 0, layer);
      for (let i = 0; i < t.length; i += 3) this.idx.push(b + t[i], b + t[i + 2], b + t[i + 1]);
    }
  }
  // tường đứng dọc cạnh a→b, mặt quay về phía (nx,nz)
  wall(ax, az, bx, bz, y0, y1, nx, nz, layer) {
    const s = this.n, dx = bx - ax, dz = bz - az;
    const fwd = -dz * nx + dx * nz > 0; // (b-a) × up cùng hướng với pháp tuyến?
    this.v(ax, y0, az, nx, 0, nz, layer); this.v(bx, y0, bz, nx, 0, nz, layer); this.v(bx, y1, bz, nx, 0, nz, layer); this.v(ax, y1, az, nx, 0, nz, layer);
    if (fwd) this.idx.push(s, s + 1, s + 2, s, s + 2, s + 3); else this.idx.push(s + 1, s, s + 3, s + 1, s + 3, s + 2);
  }
  // tứ giác nằm ngang: tâm (x,z), nửa dài hl theo hướng (dx,dz), nửa rộng hw
  flatQuad(x, z, dx, dz, hl, hw, y, layer) {
    const px = -dz * hw, pz = dx * hw, lx = dx * hl, lz = dz * hl, s = this.n;
    this.v(x - lx - px, y, z - lz - pz, 0, 1, 0, layer); this.v(x + lx - px, y, z + lz - pz, 0, 1, 0, layer);
    this.v(x + lx + px, y, z + lz + pz, 0, 1, 0, layer); this.v(x - lx + px, y, z - lz + pz, 0, 1, 0, layer);
    this.idx.push(s, s + 2, s + 1, s, s + 3, s + 2);
  }
  pack() {
    const n = this.n, nrm = new Int8Array(n * 3); for (let i = 0; i < n * 3; i++) nrm[i] = Math.round(this.nrm[i] * 127);
    return { pos: new Float32Array(this.pos), nrm, lay: new Uint8Array(this.lay), idx: n > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx) };
  }
}

const ringArea = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p.X * q.Y - q.X * p.Y; } return a / 2; };

// Màu nước theo từng hồ, sông (tuyến tính ×255): Hồ Gươm xanh lục, sông Hồng đỏ phù sa, hồ khác xanh xám.
function waterColor(ctx, w) {
  const name = ctx.world.names[w.name] || '';
  if (/Hoàn Kiếm|Hồ Gươm/.test(name)) return [38, 74, 40, 255];
  if (/Sông Hồng|sông Hồng|Red River/.test(name) || (w.bb[2] - w.bb[0]) * (w.bb[3] - w.bb[1]) > 2.5e6 && w.bb[2] > 600) return [112, 74, 48, 200];
  return [44, 70, 72, 255];
}

export function genGround(ctx, cx, cz) {
  const B = ctx.world.bounds, X0 = B.x0 + cx * CS, Z0 = B.z0 + cz * CS, X1 = X0 + CS, Z1 = Z0 + CS, M = 32;
  const dX0 = Math.round(X0 * 10), dZ0 = Math.round(Z0 * 10), dX1 = Math.round(X1 * 10), dZ1 = Math.round(Z1 * 10);
  const R = [rectPath(dX0, dZ0, dX1, dZ1)];
  const gb = new GB(X0, Z0);
  const roads = [...ctx.roadGrid.collect(X0 - M, Z0 - M, X1 + M, Z1 + M)].filter((r) => !r.skip);

  // ----- lòng đường -----
  const byW = new Map(), footByW = new Map();
  for (const r of roads) {
    const m = r.veh || r.kind === K.pedestrian ? byW : footByW, k = Math.round(r.w * 5);
    let l = m.get(k); if (!l) m.set(k, (l = [])); l.push(r.path);
  }
  let car = [];
  for (const [k, paths] of byW) car = union(car, offset(paths, k, true));
  let foot = [];
  for (const [k, paths] of footByW) foot = union(foot, offset(paths, k, true, 2));

  // ----- mặt nước (cầu đường bộ sát mặt đất thì coi như đắp qua) -----
  const waters = [...ctx.waterGrid.collect(X0, Z0, X1, Z1)].filter((w) => w.bb[0] < X1 && w.bb[2] > X0 && w.bb[1] < Z1 && w.bb[3] > Z0);
  const bridges = roads.filter((r) => r.bridge && r.veh).map((r) => offset([r.path], r.w * 5 + 8, true, 2)).flat();
  let wat = [];
  const waterParts = [];
  for (const w of waters) {
    let p = inter(w.paths, R); if (bridges.length) p = diff(p, bridges);
    if (p.length) { waterParts.push({ w, p }); wat = union(wat, p); }
  }
  const land = wat.length ? diff(R, wat) : R;
  const asphalt = wat.length ? inter(car, land) : inter(car, R);
  const block = diff(land, car);
  const inner = offset(block, -3);
  const curbTop = diff(block, inner);

  // ----- cây cỏ, lối dạo, bồn hoa, đất bãi sông -----
  const greens = [...ctx.greenGrid.collect(X0, Z0, X1, Z1)].filter((g) => g.bb[0] < X1 && g.bb[2] > X0 && g.bb[1] < Z1 && g.bb[3] > Z0);
  let gAll = [], gFlower = [];
  for (const g of greens) { if (g.k === 2) gFlower = union(gFlower, g.paths); gAll = union(gAll, g.paths); }
  let grass = inter(inner, gAll), paved = gAll.length ? diff(inner, gAll) : inner;
  const pathP = inter(foot, grass); if (pathP.length) grass = diff(grass, foot);
  const flower = inter(grass, gFlower); if (flower.length) grass = diff(grass, gFlower);
  // ô 32 m ở bãi sông mà quanh đó không có nhà: đất phù sa, cỏ dại (đường đi qua vẫn là nhựa)
  const wild = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const mx = X0 + i * 32 + 16, mz = Z0 + j * 32 + 16;
    if (zoneAt(mx, mz) !== ZONE.bank) continue;
    let built = false; ctx.bldGrid.query(mx - 44, mz - 44, mx + 44, mz + 44, (b) => { if (Math.hypot(b.cx - mx, b.cz - mz) < 44) built = true; });
    if (!built) wild.push(rectPath(Math.round((mx - 16) * 10), Math.round((mz - 16) * 10), Math.round((mx + 16) * 10), Math.round((mz + 16) * 10)));
  }
  let dirt = [];
  if (wild.length) { dirt = inter(paved, wild); paved = diff(paved, wild); }
  // nền đá balát dưới đường sắt
  const rails = [...ctx.railGrid.collect(X0 - 8, Z0 - 8, X1 + 8, Z1 + 8)].filter((r) => !(r.flags & 2));
  let gravel = [];
  if (rails.length) { const ru = offset(rails.map((r) => toPath(r.p)), 17, true, 2); gravel = inter(ru, inner); paved = diff(paved, ru); grass = diff(grass, ru); }

  gb.fill(toEx(asphalt), 0, LAYER.asphalt);
  gb.fill(toEx(curbTop), CURB, LAYER.curb);
  gb.fill(toEx(paved), CURB, LAYER.paving);
  gb.fill(toEx(grass), CURB, LAYER.grass);
  if (pathP.length) gb.fill(toEx(pathP), CURB, LAYER.path);
  if (flower.length) gb.fill(toEx(flower), CURB + 0.12, LAYER.flower);
  if (dirt.length) gb.fill(toEx(dirt), CURB, LAYER.dirt);
  if (gravel.length) gb.fill(toEx(gravel), CURB + 0.01, LAYER.gravel);

  // ----- bó vỉa và kè hồ: cạnh của khối phố không nằm trên mép ô -----
  const shore = []; // đoạn bờ nước [ax,az,bx,bz] cho va chạm
  const onBorder = (a, b) => (a.X === b.X && (a.X === dX0 || a.X === dX1)) || (a.Y === b.Y && (a.Y === dZ0 || a.Y === dZ1));
  for (const e of toEx(block)) {
    const rings = [[e.outer, false], ...e.holes.map((h) => [h, true])];
    for (const [ring, isHole] of rings) {
      const s = ringArea(ring) > 0 ? 1 : -1, dir = isHole ? -s : s;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length]; if (onBorder(a, b)) continue;
        const ax = a.X / 10, az = a.Y / 10, bx = b.X / 10, bz = b.Y / 10, dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 0.02) continue;
        const nx = (dz / L) * dir, nz = (-dx / L) * dir;
        const wet = wat.length && ctx.isWater((ax + bx) / 2 + nx * 0.3, (az + bz) / 2 + nz * 0.3);
        if (wet) { gb.wall(ax, az, bx, bz, WATER_Y - 0.7, CURB, nx, nz, LAYER.stone); shore.push(ax, az, bx, bz); } else gb.wall(ax, az, bx, bz, 0, CURB, nx, nz, LAYER.curb);
      }
    }
  }

  // ----- vạch sơn: tim đường, làn xe, vạch người đi bộ -----
  const inChunk = (x, z) => x >= X0 && x < X1 && z >= Z0 && z < Z1;
  for (const r of roads) {
    if (!r.veh || r.kind > K.tertiary || r.w < 6.5 || r.len < 14) continue;
    const p = r.p, oneway = r.flags & F_ONEWAY;
    const n0 = ctx.nodes.get(ctx.nodeKey(p[0], p[1])), n1 = ctx.nodes.get(ctx.nodeKey(p[p.length - 2], p[p.length - 1]));
    const j0 = n0 && n0.major >= 3 ? Math.max(5, n0.maxW * 0.55) : 0, j1 = n1 && n1.major >= 3 ? Math.max(5, n1.maxW * 0.55) : 0;
    const lanes = oneway ? Math.max(1, Math.round(r.w / 3.4)) : 2;
    const offs = []; // vị trí vạch dọc tính từ tim đường
    if (!oneway) offs.push([0, LAYER.yellow]); else for (let l = 1; l < lanes; l++) offs.push([-r.w / 2 + (r.w * l) / lanes, LAYER.white]);
    let d = 0;
    for (let i = 0; i < p.length - 2; i += 2) {
      const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], L = Math.hypot(bx - ax, bz - az); if (L < 0.01) continue;
      const dx = (bx - ax) / L, dz = (bz - az) / L;
      // vạch đứt 3 m, hở 6 m, tránh khu vực nút giao
      for (let s = Math.ceil((d + 1e-6) / 9) * 9 - d; s < L; s += 9) {
        const dd = d + s; if (dd < j0 + 9 || dd > r.len - j1 - 9) continue;
        const x = ax + dx * s, z = az + dz * s; if (!inChunk(x, z)) continue;
        for (const [o, layer] of offs) gb.flatQuad(x - dz * o, z + dx * o, dx, dz, 1.5, 0.07, 0.016, layer);
      }
      // vạch sang đường (ngựa vằn) ở hai đầu đoạn nếu là nút giao
      for (const [jr, at] of [[j0, j0 + 2.6], [j1, r.len - j1 - 2.6]]) {
        if (!jr || r.len < 2 * jr + 16 || at < d || at >= d + L) continue;
        const s = at - d, x = ax + dx * s, z = az + dz * s; if (!inChunk(x, z)) continue;
        for (let o = -r.w / 2 + 0.55; o < r.w / 2 - 0.3; o += 0.95) gb.flatQuad(x - dz * o, z + dx * o, dx, dz, 1.4, 0.22, 0.016, LAYER.white);
      }
      d += L;
    }
  }

  // ----- mặt nước -----
  let water = null;
  if (waterParts.length) {
    const pos = [], col = [], idx = [];
    for (const { w, p } of waterParts) {
      const c = waterColor(ctx, w);
      for (const e of toEx(p)) {
        const flat = [], holes = [];
        for (const q of e.outer) flat.push(q.X / 10, q.Y / 10);
        for (const h of e.holes) { holes.push(flat.length / 2); for (const q of h) flat.push(q.X / 10, q.Y / 10); }
        const t = earcut(flat, holes), b = pos.length / 3;
        for (let i = 0; i < flat.length; i += 2) { pos.push(flat[i] - X0, WATER_Y, flat[i + 1] - Z0); col.push(c[0], c[1], c[2], c[3]); }
        for (let i = 0; i < t.length; i += 3) idx.push(b + t[i], b + t[i + 2], b + t[i + 1]);
      }
    }
    water = { pos: new Float32Array(pos), col: new Uint8Array(col), idx: new Uint32Array(idx) };
  }
  return { ground: gb.pack(), water, shore: new Float32Array(shore) };
}
