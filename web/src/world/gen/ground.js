// Mặt đất của một ô phố: lòng đường nhựa, vỉa hè nâng 16 cm có bó vỉa đá, bãi cỏ, lối dạo, kè hồ, vạch sơn.
// Cách làm: gộp các dải đường (đệm theo bề rộng) bằng Clipper, phần còn lại của ô là khối phố (vỉa hè, sân, công viên).
import earcut from 'earcut';
import { CL, clip, union, inter, diff, offset, toEx, rectPath, toPath } from './context.js';
import { CS, CURB, WATER_Y, K, ZONE, zoneAt, F_ONEWAY, roadY, lowSpans, subPath, alongAt, LB_TRUSS_X } from '../data.js';
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
  // tứ giác bất kỳ a,b,c,d ([x,y,z]) với pháp tuyến cho trước; tự chọn chiều quấn theo pháp tuyến
  quad(a, b, c, d, nx, ny, nz, layer) {
    const s = this.n, ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    const f = (uy * vz - uz * vy) * nx + (uz * vx - ux * vz) * ny + (ux * vy - uy * vx) * nz > 0;
    this.v(a[0], a[1], a[2], nx, ny, nz, layer); this.v(b[0], b[1], b[2], nx, ny, nz, layer); this.v(c[0], c[1], c[2], nx, ny, nz, layer); this.v(d[0], d[1], d[2], nx, ny, nz, layer);
    if (f) this.idx.push(s, s + 1, s + 2, s, s + 2, s + 3); else this.idx.push(s + 1, s, s + 3, s + 1, s + 3, s + 2);
  }
  // vạch sơn nằm theo mặt dốc: tâm (x,z), cao độ y0 ở đầu sau, y1 ở đầu trước
  slopeQuad(x, z, dx, dz, hl, hw, y0, y1, layer) {
    const px = -dz * hw, pz = dx * hw, lx = dx * hl, lz = dz * hl, s = this.n;
    this.v(x - lx - px, y0, z - lz - pz, 0, 1, 0, layer); this.v(x + lx - px, y1, z + lz - pz, 0, 1, 0, layer);
    this.v(x + lx + px, y1, z + lz + pz, 0, 1, 0, layer); this.v(x - lx + px, y0, z - lz + pz, 0, 1, 0, layer);
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

// ===== mặt cầu nâng =====
// Mỗi đoạn cầu là một dải chia khúc ngắn bám theo cao độ roadY: mặt nhựa, hai thành bên, lan can, đáy dầm, trụ.
// Khúc dốc thấp (dưới 2,6 m) đắp đặc như dốc dẫn có tường chắn; cao hơn thì là dầm trên trụ, bên dưới đi lại được.
const SOLID = 2.6, GIRD = 1.1, PARAPET = 0.85;
function genDecks(ctx, db, X0, Z0, X1, Z1, ramp) {
  const inChunk = (x, z) => x >= X0 && x < X1 && z >= Z0 && z < Z1, M = 14, o = [0, 0, 0, 0, 0];
  const near = (r) => r.bb[0] - M < X1 && r.bb[2] + M > X0 && r.bb[1] - M < Z1 && r.bb[3] + M > Z0;
  let top = 0;
  const strip = (r, rail) => {
    const p = r.p, nv = p.length / 2, hw = r.w / 2, lb = !rail && /Long Biên/.test(ctx.world.names[r.name] || '');
    // pháp tuyến ngang tại từng đỉnh (có vát góc); hai đầu mút vát theo đoạn cầu nối tiếp
    const N = new Float32Array(nv * 2), seg = (i) => { const dx = p[i * 2 + 2] - p[i * 2], dz = p[i * 2 + 3] - p[i * 2 + 1], L = Math.hypot(dx, dz) || 1; return [dx / L, dz / L]; };
    for (let i = 0; i < nv; i++) {
      let a = i > 0 ? seg(i - 1) : null, b = i < nv - 1 ? seg(i) : null; const own = b || a;
      if (!rail && (!a || !b)) {
        const l = ctx.elevNodes.get(ctx.nodeKey(p[i * 2], p[i * 2 + 1]));
        if (l && l.length === 2) { const ot = l[0].r === r ? l[1] : l[0]; if (ot.r !== r && Math.abs(ot.r.w - r.w) < 0.6) { if (!a) a = [-ot.lx, -ot.lz]; else b = [ot.lx, ot.lz]; } }
      }
      a = a || b; b = b || a;
      let tx = a[0] + b[0], tz = a[1] + b[1]; const L = Math.hypot(tx, tz);
      if (L < 0.6) { tx = own[0]; tz = own[1]; } else { tx /= L; tz /= L; }
      const k = Math.min(1.6, 1 / Math.max(0.3, tx * own[0] + tz * own[1]));
      N[i * 2] = -tz * k; N[i * 2 + 1] = tx * k;
    }
    // các mặt cắt dọc dải: quãng s, tâm, pháp tuyến ngang, cao độ
    const step = r.len < 200 ? 3 : 6, st = [];
    for (let i = 0; i < nv - 1; i++) {
      const a = r.cum[i], b = r.cum[i + 1], n = Math.max(1, Math.ceil((b - a) / step)), t = seg(i);
      for (let k = i ? 1 : 0; k <= n; k++) {
        const f = k / n, x = p[i * 2] + (p[i * 2 + 2] - p[i * 2]) * f, z = p[i * 2 + 1] + (p[i * 2 + 3] - p[i * 2 + 1]) * f;
        const nx = k === 0 ? N[i * 2] : k === n ? N[i * 2 + 2] : -t[1], nz = k === 0 ? N[i * 2 + 1] : k === n ? N[i * 2 + 3] : t[0];
        st.push([a + (b - a) * f, x, z, nx, nz, roadY(r, a + (b - a) * f)]);
      }
    }
    const lay = rail ? LAYER.gravel : LAYER.asphalt, side = rail ? LAYER.stone : LAYER.curb;
    for (let q = 0; q < st.length - 1; q++) {
      const A = st[q], B = st[q + 1], mx = (A[1] + B[1]) / 2, mz = (A[2] + B[2]) / 2; if (!inChunk(mx, mz)) continue;
      const ya = A[5] + 0.012, yb = B[5] + 0.012, ym = (ya + yb) / 2; if (ym < 0.02) continue;
      top = Math.max(top, ym + 1.2);
      const E = (S, sd, y, inset = 0) => [S[1] + S[3] * (hw - inset) * sd, y, S[2] + S[4] * (hw - inset) * sd];
      db.quad(E(A, 1, ya), E(B, 1, yb), E(B, -1, yb), E(A, -1, ya), 0, 1, 0, lay);
      const solid = ym <= (rail ? 1.5 : SOLID);
      if (!solid) db.quad(E(A, 1, ya - GIRD), E(B, 1, yb - GIRD), E(B, -1, yb - GIRD), E(A, -1, ya - GIRD), 0, -1, 0, side);
      const mnx = (A[3] + B[3]) / 2, mnz = (A[4] + B[4]) / 2, ml = Math.hypot(mnx, mnz) || 1;
      for (const sd of [1, -1]) {
        const ox = (mnx / ml) * sd, oz = (mnz / ml) * sd; // hướng ra ngoài
        if (ctx.deckAt(mx + ox * (hw + 0.4), mz + oz * (hw + 0.4), 0, r) > ym - 1.5) continue; // liền với mặt cầu khác
        db.quad(E(A, sd, solid ? 0 : ya - GIRD), E(B, sd, solid ? 0 : yb - GIRD), E(B, sd, yb), E(A, sd, ya), ox, 0, oz, side);
        if (solid && ym > 0.45 && !rail) ramp.push(A[1] + A[3] * hw * sd, A[2] + A[4] * hw * sd, B[1] + B[3] * hw * sd, B[2] + B[4] * hw * sd);
        if (!rail && !lb && ym > 0.45) { // lan can bê tông
          const h = Math.min(PARAPET, (ym - 0.45) * 3 + 0.25);
          db.quad(E(A, sd, ya), E(B, sd, yb), E(B, sd, yb + h), E(A, sd, ya + h), ox, 0, oz, LAYER.curb);
          db.quad(E(A, sd, ya, 0.26), E(B, sd, yb, 0.26), E(B, sd, yb + h, 0.26), E(A, sd, ya + h, 0.26), -ox, 0, -oz, LAYER.curb);
          db.quad(E(A, sd, ya + h), E(B, sd, yb + h), E(B, sd, yb + h, 0.26), E(A, sd, ya + h, 0.26), 0, 1, 0, LAYER.curb);
        }
      }
    }
    // trụ: cầu đường bộ cách 24 đến 36 m; cầu dẫn đường sắt là dãy trụ đá dày cách 9 m (vòm cầu dẫn phố Gầm Cầu).
    // Phần dàn thép Long Biên ngoài đê có trụ đá riêng dựng cùng dàn (landmarks/cau_long_bien.js).
    const gap = rail ? 9 : r.len > 500 ? 36 : 24, hl = rail ? 1.3 : 0.65, pw = Math.max(0.8, hw - (rail ? 0.25 : 0.9));
    for (let s = gap / 2; s < r.len; s += gap) {
      alongAt(r, s, o); const x = o[0], z = o[1], tx = o[2], tz = o[3];
      if (!inChunk(x, z) || ((rail || lb) && x >= LB_TRUSS_X)) continue;
      const y = roadY(r, s) - GIRD; if (y < (rail ? 0.6 : SOLID - GIRD + 0.5)) continue;
      const under = ctx.nearestRoad(x, z, pw + 6, (g) => !g.elev && !g.skip); if (under && under.d < under.r.w / 2 + hl + 0.8) continue; // đường chui qua gầm cầu
      const y0 = ctx.isWater(x, z) ? WATER_Y - 2 : 0, C = (a, b, yy) => [x + tx * a * hl - tz * b * pw, yy, z + tz * a * hl + tx * b * pw];
      for (const [a0, b0, a1, b1, nx, nz] of [[1, -1, 1, 1, tx, tz], [-1, 1, -1, -1, -tx, -tz], [1, 1, -1, 1, -tz, tx], [-1, -1, 1, -1, tz, -tx]])
        db.quad(C(a0, b0, y0), C(a1, b1, y0), C(a1, b1, y), C(a0, b0, y), nx, 0, nz, rail ? LAYER.stone : LAYER.curb);
    }
  };
  for (const r of ctx.elevRoads) if (near(r)) strip(r, false);
  for (const r of ctx.elevRails) if (near(r)) strip(r, true);
  return top;
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
    let l = m.get(k); if (!l) m.set(k, (l = []));
    // cầu nâng: chỉ khúc chân dốc còn sát đất mới là lòng đường; phần đã lên cao thì bên dưới là vỉa hè, mặt nước
    if (r.elev) for (const [s0, s1] of lowSpans(r, 0.45)) l.push(toPath(subPath(r, s0, s1))); else l.push(r.path);
  }
  let car = [];
  for (const [k, paths] of byW) car = union(car, offset(paths, k, true));
  let foot = [];
  for (const [k, paths] of footByW) foot = union(foot, offset(paths, k, true, 2));

  // ----- mặt nước (cầu nhỏ sát mặt đất thì coi như đắp qua; cầu nâng thì nước chảy bên dưới) -----
  const waters = [...ctx.waterGrid.collect(X0, Z0, X1, Z1)].filter((w) => w.bb[0] < X1 && w.bb[2] > X0 && w.bb[1] < Z1 && w.bb[3] > Z0);
  const bridges = roads.filter((r) => r.bridge && r.veh && !r.elev).map((r) => offset([r.path], r.w * 5 + 8, true, 2)).flat();
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

  // ----- mặt cầu nâng (lưới riêng để đổ bóng xuống đất) -----
  const db = new GB(X0, Z0), ramp = [];
  const deckTop = ctx.elevRoads.length || ctx.elevRails.length ? genDecks(ctx, db, X0, Z0, X1, Z1, ramp) : 0;

  // ----- vạch sơn: tim đường, làn xe, vạch người đi bộ -----
  const inChunk = (x, z) => x >= X0 && x < X1 && z >= Z0 && z < Z1;
  for (const r of roads) {
    if (!r.veh || r.kind > K.tertiary || r.w < 6.5 || r.len < 14) continue;
    const p = r.p, oneway = r.flags & F_ONEWAY, el = !!r.elev, mb = el ? db : gb;
    const n0 = ctx.nodes.get(ctx.nodeKey(p[0], p[1])), n1 = ctx.nodes.get(ctx.nodeKey(p[p.length - 2], p[p.length - 1]));
    const j0 = n0 && n0.major >= 3 && !el ? Math.max(5, n0.maxW * 0.55) : 0, j1 = n1 && n1.major >= 3 && !el ? Math.max(5, n1.maxW * 0.55) : 0;
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
        const y0 = el ? roadY(r, dd - 1.5) + 0.035 : 0.016, y1 = el ? roadY(r, dd + 1.5) + 0.035 : 0.016;
        for (const [o, layer] of offs) mb.slopeQuad(x - dz * o, z + dx * o, dx, dz, 1.5, 0.07, y0, y1, layer);
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
  return { ground: gb.pack(), deck: db.n ? db.pack() : null, deckTop, ramp: new Float32Array(ramp), water, shore: new Float32Array(shore) };
}
