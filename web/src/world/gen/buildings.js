// Nhà của một ô phố. Tường quay ra phố được chia thành từng gian (mỗi gian một tứ giác) để worker quyết định
// kiểu cửa, màu vôi, biển hiệu của từng gian; shader (world/facades.js) chỉ việc vẽ theo.
// Thuộc tính đỉnh: uv = (gian, tầng), fx = [kiểu, hạt giống, số tầng, cờ], var = [lớp tầng trên, lớp tầng trệt, màu vôi, màu biển].
// Cờ: bit 0 có cửa hàng, bit 1-2 tuổi nhà (0 mới sơn .. 3 cũ kỹ, shader vẽ loang mốc theo đó).
// Tường giáp nhà bên cạnh là tường trơn; khuất hẳn sau nhà cao hơn thì bỏ, không vẽ.
// Dãy nhà ống mà bản đồ vẽ gộp thành một hình lớn được cắt lại thành từng "lô" theo mặt phố: mỗi lô một số tầng, một màu vôi,
// một tuổi nhà, nhô khối riêng lên trên nền chung nên hai nhà cạnh nhau hiếm khi cao bằng nhau (art bible, dấu hiệu 2).
import earcut from 'earcut';
import { hash } from '../../core/util.js';
import { CS, K, CAT, ST, ZONE } from '../data.js';
import { L } from '../layers.js';
import { P, SIGNS, GENERIC, TRADES, SIGN_KIND } from '../signs.js';

const FLAG_SHOP = 1;
const pick = (range, r) => range[0] + Math.min(range[1] - 1, Math.floor(r * range[1]));
const choose = (list, r) => { let t = 0; for (let i = 0; i < list.length; i += 2) t += list[i + 1]; let x = r * t; for (let i = 0; i < list.length; i += 2) { x -= list[i + 1]; if (x < 0) return list[i]; } return list[list.length - 2]; };

class BB {
  constructor(ox, oz) { this.ox = ox; this.oz = oz; this.pos = []; this.nrm = []; this.uv = []; this.fx = []; this.va = []; this.idx = []; }
  get n() { return this.pos.length / 3; }
  v(x, y, z, nx, ny, nz, u, v, fx, va) { this.pos.push(x - this.ox, y, z - this.oz); this.nrm.push(nx, ny, nz); this.uv.push(u, v); this.fx.push(fx[0], fx[1], fx[2], fx[3]); this.va.push(va[0], va[1], va[2], va[3]); return this.pos.length / 3 - 1; }
  // tường đứng a→b từ y0 tới y1, pháp tuyến ngoài (nx,nz); u chạy trái → phải khi nhìn từ ngoài
  wall(ax, az, bx, bz, y0, y1, nx, nz, u0, u1, v0, v1, fx, va) {
    const s = this.n, fwd = -(bz - az) * nx + (bx - ax) * nz > 0, ua = fwd ? u0 : u1, ub = fwd ? u1 : u0;
    this.v(ax, y0, az, nx, 0, nz, ua, v0, fx, va); this.v(bx, y0, bz, nx, 0, nz, ub, v0, fx, va);
    this.v(bx, y1, bz, nx, 0, nz, ub, v1, fx, va); this.v(ax, y1, az, nx, 0, nz, ua, v1, fx, va);
    if (fwd) this.idx.push(s, s + 1, s + 2, s, s + 2, s + 3); else this.idx.push(s + 1, s, s + 3, s + 1, s + 3, s + 2);
  }
  // tứ giác bất kỳ (mái): 4 điểm [x,y,z] và uv từng điểm; tự chọn chiều quấn sao cho mặt trước hướng lên
  quadUp(q, uv, fx, va) {
    const ux = q[1][0] - q[0][0], uy = q[1][1] - q[0][1], uz = q[1][2] - q[0][2], vx = q[3][0] - q[0][0], vy = q[3][1] - q[0][1], vz = q[3][2] - q[0][2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const up = ny >= 0; if (!up) { nx = -nx; ny = -ny; nz = -nz; }
    const s = this.n; for (let i = 0; i < 4; i++) this.v(q[i][0], q[i][1], q[i][2], nx, ny, nz, uv[i][0], uv[i][1], fx, va);
    if (up) this.idx.push(s, s + 1, s + 2, s, s + 2, s + 3); else this.idx.push(s, s + 2, s + 1, s, s + 3, s + 2);
  }
  // tam giác đứng (đầu hồi): pháp tuyến ngang (nx,nz)
  triWall(q0, q1, q2, nx, nz, uv, fx, va) {
    const s = this.n; for (const [i, q] of [q0, q1, q2].entries()) this.v(q[0], q[1], q[2], nx, 0, nz, uv[i][0], uv[i][1], fx, va);
    const e1x = q1[0] - q0[0], e1y = q1[1] - q0[1], e1z = q1[2] - q0[2], e2x = q2[0] - q0[0], e2y = q2[1] - q0[1], e2z = q2[2] - q0[2];
    if ((e1y * e2z - e1z * e2y) * nx + (e1x * e2y - e1y * e2x) * nz > 0) this.idx.push(s, s + 1, s + 2); else this.idx.push(s + 1, s, s + 2);
  }
  pack() {
    const n = this.n, nrm = new Int8Array(n * 3); for (let i = 0; i < n * 3; i++) nrm[i] = Math.round(this.nrm[i] * 127);
    let y1 = 0; for (let i = 1; i < this.pos.length; i += 3) if (this.pos[i] > y1) y1 = this.pos[i];
    return { pos: new Float32Array(this.pos), nrm, uv: new Float32Array(this.uv), fx: new Uint8Array(this.fx), va: new Uint8Array(this.va), idx: n > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx), top: y1 };
  }
}

const BAY = { [ST.TUBE]: 4.0, [ST.ALLEY]: 4.0, [ST.FRENCH]: 4.6, [ST.MODERN]: 4.0, [ST.APART]: 3.6, [ST.PUBLIC]: 4.4, [ST.TEMPLE]: 4.2, [ST.CHURCH]: 5, [ST.MARKET]: 6, [ST.SMALL]: 3 };
const tintRange = (st) => (st === ST.FRENCH || st === ST.PUBLIC ? P.french : st === ST.APART || st === ST.MARKET || st === ST.SMALL ? P.apart : st === ST.MODERN ? P.glass : st === ST.TEMPLE ? P.temple : st === ST.CHURCH ? P.stone : P.tube);

// ----- dáng vẻ một nhà ống (một lô): thời xây, kiểu tầng trên, kiểu cửa hàng, màu vôi, tuổi -----
// Thời xây: 0 nhà cổ (vôi vàng, cửa gỗ, mái ngói), 1 nhà thập niên 80-90 (ốp gạch men, con tiện, chuồng cọp), 2 nhà mới, khách sạn mini.
// Phân bố số tầng mặt phố cổ theo art bible mục 3.1: 2 tầng 25%, 3 tầng 30%, 4 tầng 25%, 5-6 tầng 20%.
const LOT_FLOORS = { [ZONE.old]: [2, 25, 3, 30, 4, 25, 5, 13, 6, 7], [ZONE.french]: [2, 15, 3, 35, 4, 30, 5, 20], [ZONE.badinh]: [2, 30, 3, 40, 4, 30], [ZONE.city]: [3, 22, 4, 34, 5, 28, 6, 16], [ZONE.bank]: [2, 28, 3, 40, 4, 32] };
export const lotFloors = (zone, r) => choose(LOT_FLOORS[zone] || LOT_FLOORS[ZONE.city], r);
const UP_BY_ERA = [
  [L.UP_OLD, 44, L.UP_IRON, 24, L.UP_SHUT, 20, L.UP_WORN, 12],
  [L.UP_90S, 28, L.UP_TILE, 20, L.UP_CAGE, 22, L.UP_IRON, 12, L.UP_WORN, 12, L.UP_SHUT, 6],
  [L.UP_ALU, 46, L.UP_HOTEL, 40, L.UP_90S, 14],
];
const TINT_BY_ERA = [P.lime, P.pastel, P.neo];
export function tubeLook(zone, floors, seed) {
  const r = hash(seed, 41), old = zone === ZONE.old;
  let era = floors <= 2 ? (r < 0.62 ? 0 : r < 0.92 ? 1 : 2) : floors === 3 ? (r < 0.26 ? 0 : r < 0.74 ? 1 : 2) : floors === 4 ? (r < 0.5 ? 1 : 2) : (r < 0.18 ? 1 : 2);
  if (!old && era === 0 && hash(seed, 47) < 0.55) era = 1; // ngoài phố cổ ít nhà cổ hơn
  const up = floors >= 5 && era === 2 && hash(seed, 48) < 0.5 ? L.UP_HOTEL : choose(UP_BY_ERA[era], hash(seed, 42));
  // màu vôi: phố cổ theo bảng màu quy chế; khu khác vẫn dùng bảng chung nhiều màu hơn
  const tint = old || hash(seed, 49) < 0.5 ? pick(era === 0 && hash(seed, 50) < 0.3 ? P.old : TINT_BY_ERA[era], hash(seed, 43)) : pick(P.tube, hash(seed, 43));
  const age = era === 0 ? 2 + (hash(seed, 52) < 0.6 ? 1 : 0) : era === 1 ? 1 + (hash(seed, 52) < 0.45 ? 1 : 0) : hash(seed, 52) < 0.35 ? 1 : 0;
  return { era, up, tint, age };
}
// Tầng trệt cửa hàng khớp với biển: quán ăn, cà phê, sảnh khách sạn, cửa kính, hay hàng bày ra cửa; một phần đang đóng cửa.
function shopLayer(era, sign, seed) {
  const r = hash(seed, 53), kind = SIGN_KIND[sign] || 'G';
  if (r < 0.07) return L.S_ROLL; if (r < 0.12) return L.S_FOLD;
  if (kind === 'F') return era === 0 && r < 0.4 ? L.S_WOOD : L.S_EAT;
  if (kind === 'C') return L.S_CAFE;
  if (kind === 'H') return L.S_LOBBY;
  if (kind === 'B') return era === 0 ? (r < 0.55 ? L.S_WOOD : L.S_OPEN) : r < 0.82 ? L.S_GLASS : L.S_OPEN;
  return era === 0 ? (r < 0.6 ? L.S_WOOD : L.S_OPEN) : era === 2 && r < 0.4 ? L.S_GLASS : L.S_OPEN;
}

// Lớp tầng trên / tầng trệt của một gian theo kiểu nhà (trừ nhà ống mặt phố: xem tubeLook). r1, r2: số ngẫu nhiên của gian.
function layersFor(style, shop, r1, r2) {
  switch (style) {
    case ST.ALLEY: return [r1 < 0.45 ? L.UP_ALLEY : r1 < 0.75 ? L.UP_CAGE : L.UP_WORN, r2 < 0.6 ? L.DOOR : L.UP_ALLEY];
    case ST.BLANK: return [L.BLANK + (r1 < 0.62 ? 0 : 1), L.BLANK + (r1 < 0.62 ? 0 : 1)];
    case ST.FRENCH: return [r1 < 0.5 ? L.FR_UP : r1 < 0.82 ? L.FR_UP2 : L.UP_SHUT, shop ? L.S_CAFE : L.FR_GND];
    case ST.MODERN: return [L.MOD + (r1 < 0.5 ? 0 : 1), L.MOD_GND];
    case ST.APART: return [L.APART, shop ? L.SHOP + Math.floor(r2 * 5) : L.APART];
    case ST.PUBLIC: return [L.PUB_UP, L.PUB_GND];
    case ST.TEMPLE: return [L.TEMPLE, L.TEMPLE];
    case ST.CHURCH: return [L.CHURCH, L.CHURCH];
    case ST.MARKET: return [L.MARKET, L.MARKET];
    default: return [L.SMALL, L.SMALL];
  }
}

// Biển hiệu của gian: phố nghề thì ưu tiên biển đặc trưng của phố.
export function signFor(ctx, road, seed) {
  const name = road ? ctx.world.names[road.name] : null, trade = name && TRADES[name];
  if (trade && hash(seed, 21) < 0.68) return trade[Math.floor(hash(seed, 22) * trade.length)];
  return GENERIC[Math.floor(hash(seed, 23) * GENERIC.length)];
}

// Khoảng cách từ điểm (x,z) đi theo hướng (dx,dz) tới cạnh gần nhất của vòng ring (bỏ qua cạnh xuất phát).
function rayDepth(ring, x, z, dx, dz) {
  let best = 1e9;
  for (let k = 0, n = ring.length; k < n; k += 2) {
    const ax = ring[k], az = ring[k + 1], ex = ring[(k + 2) % n] - ax, ez = ring[(k + 3) % n] - az, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
    const t = ((ax - x) * ez - (az - z) * ex) / den, u = ((ax - x) * dz - (az - z) * dx) / den;
    if (t > 0.4 && u >= 0 && u <= 1 && t < best) best = t;
  }
  return best;
}

const notDeck = (r) => !r.elev; // mặt tiền không quay ra cầu, dốc cầu
// Trả về { mesh, col (đoạn va chạm [ax,az,bx,bz,cao]), fronts (các gian mặt phố), roofs (mái bằng để đặt bồn nước, tum thang) }
export function genBuildings(ctx, cx, cz) {
  const B = ctx.world.bounds, X0 = B.x0 + cx * CS, Z0 = B.z0 + cz * CS;
  const bb = new BB(X0, Z0), col = [], fronts = [], roofs = [];
  const list = ctx.chunkBld.get(cx * 1000 + cz) || [];
  for (const b of list) {
    if (b.ghost) { for (let k = 0, n = b.p.length; k < n; k += 2) col.push(b.p[k], b.p[k + 1], b.p[(k + 2) % n], b.p[(k + 3) % n], 12); continue; }
    const h = b.height, st = b.style, seed = b.seed, fl = b.floors, hero = b.hero || null, zone = b.zone;
    if (b.cat === CAT.roof) { canopy(bb, b); continue; }
    const rings = [b.p, ...b.holes];
    const pitched = b.roof === ST.ROOF_TILE && b.p.length === 8 && !b.holes.length && st === ST.TUBE && !hero;
    const hip = !pitched && b.roof === ST.ROOF_TILE && !b.holes.length ? hipRing(b) : null;
    const row = st === ST.TUBE && b.area > 140 && !hero; // dãy nhà gộp chung một hình: cắt thành từng lô
    const look0 = st === ST.TUBE ? tubeLook(zone, fl, b.i * 7 + 3) : null;
    const bTint = hero && hero.wall !== undefined ? hero.wall : look0 && !row ? look0.tint : pick(tintRange(st), hash(b.i, 31));
    const rk = b.roof === ST.ROOF_TILE && !pitched && !hip ? ST.ROOF_FLAT : b.roof; // mái ngói mà không dựng được mái dốc thì coi như mái bằng
    const age0 = hero ? (hero.age || 0) : look0 ? look0.age : st === ST.FRENCH || st === ST.PUBLIC ? 1 : st === ST.MODERN ? 0 : st === ST.APART || st === ST.TEMPLE || st === ST.CHURCH ? 2 : 1;
    for (let ri = 0; ri < rings.length; ri++) {
      const ring = rings[ri], n = ring.length;
      // vòng ngoài diện tích dương thì phía ngoài là (dz, -dx); lỗ sân trong thì ngược lại
      let area = 0; for (let k = 0; k < n; k += 2) { const j = (k + 2) % n; area += ring[k] * ring[j + 1] - ring[j] * ring[k + 1]; }
      const dir = (area > 0 ? 1 : -1) * (ri ? -1 : 1);
      let uoff = hash(b.i, 33) * 4;
      for (let k = 0; k < n; k += 2) {
        const ax = ring[k], az = ring[k + 1], bx = ring[(k + 2) % n], bz = ring[(k + 3) % n];
        const dx = bx - ax, dz = bz - az, Lw = Math.hypot(dx, dz); if (Lw < 0.05) continue;
        if (ri === 0) col.push(ax, az, bx, bz, h);
        const nx = (dz / Lw) * dir, nz = (-dx / Lw) * dir, mx = (ax + bx) / 2, mz = (az + bz) / 2;
        let y0 = 0;
        const nb = ri === 0 ? ctx.buildingAt(mx + nx * 0.9, mz + nz * 0.9, b) : null;
        if (nb && !nb.skip) { if (nb.height >= h - 0.3) continue; y0 = nb.height; }
        let style = st, shop = false, road = null, street = false;
        if (y0 > 0 || Lw < 1.9) style = ST.BLANK;
        else if (ri > 0) style = ST.ALLEY;
        else {
          const rd = ctx.nearestRoad(mx + nx * 2, mz + nz * 2, 15, notDeck);
          if (rd && (rd.px - mx) * nx + (rd.pz - mz) * nz > 0.5 && rd.d - rd.r.w / 2 < 8) {
            road = rd.r; street = !b.solemn && (road.kind <= K.residential || road.kind === K.pedestrian);
            if (hero) shop = !!hero.shop && street;
            else if (st === ST.TUBE) { if (street) shop = true; else style = ST.ALLEY; }
            else if (st === ST.FRENCH) shop = street && hash(b.i, 5) < (zone === ZONE.badinh ? 0.12 : 0.45);
            else if (st === ST.APART) shop = street && hash(b.i, 6) < 0.6;
          } else if (st === ST.TUBE && !hero) style = hash(b.i * 31 + k, 7) < 0.5 ? ST.ALLEY : ST.BLANK;
        }
        const par = hero && hero.parapet !== undefined ? hero.parapet : st === ST.TEMPLE || pitched || hip ? 0 : 0.9;
        if (style === ST.BLANK) {
          const u = Lw / 4, ly = layersFor(ST.BLANK, false, hash(b.i, 35), 0);
          bb.wall(ax, az, bx, bz, y0, h + par, nx, nz, uoff, uoff + u, (y0 / h) * fl, fl + (par / h) * fl, [style, seed, fl, age0 << 1], [ly[0], ly[1], bTint, 0]);
          uoff += u; continue;
        }
        // ----- chia gian. Dãy nhà gộp: gian rộng hẹp không đều (2,9 đến 5,3 m) -----
        const bays = Math.max(1, Math.round(Lw / (BAY[style] || 4))), cuts = [0];
        if (row && bays > 1) { let t = 0; const ws = []; for (let j = 0; j < bays; j++) { ws.push(2.9 + hash(b.i * 97 + k * 13 + j, 45) * 2.4); t += ws[j]; } let c = 0; for (let j = 0; j < bays; j++) { c += ws[j] / t; cuts.push(j === bays - 1 ? 1 : c); } }
        else for (let j = 1; j <= bays; j++) cuts.push(j / bays);
        // ----- lô nhô cao trên nền chung (chỉ dãy nhà gộp, tường ngoài, còn chỗ lùi vào trong) -----
        let depth = 0;
        if (row && ri === 0 && Lw >= 3) {
          depth = 7 + hash(b.i * 31 + k, 46) * 4.5;
          for (const t of [0.25, 0.5, 0.75]) depth = Math.min(depth, rayDepth(ring, ax + dx * t, az + dz * t, -nx, -nz) * 0.5);
          if (depth < 2.6) depth = 0;
        }
        const lots = [];
        for (let j = 0; j < bays; j++) {
          const bs = b.i * 97 + k * 13 + (row ? j : 0), lot = { bs, t0: cuts[j], t1: cuts[j + 1], f: fl, fh: h / fl, H: h, par, tile: false, look: look0, tint: bTint, age: age0 };
          if (row) {
            let f = depth ? lotFloors(zone, hash(bs, 44)) : fl; const fh = 3.05 + hash(bs, 54) * 0.6;
            if (f * fh < h + 0.6) { f = fl; } else { lot.f = f; lot.fh = fh; lot.H = f * fh; }
            lot.look = tubeLook(zone, f, bs); lot.age = lot.look.age;
            lot.tile = lot.H > h && lot.look.era === 0 && f <= 3 && depth >= 4 && hash(bs, 55) < 0.8;
            lot.par = lot.tile ? 0 : lot.H > h ? 0.45 + hash(bs, 56) * 0.6 : par;
          }
          if (row) lot.tint = lot.look.tint;
          lot.top = lot.H + lot.par; lots.push(lot);
        }
        for (let j = 0; j < bays; j++) {
          const lot = lots[j], bs = lot.bs, f = lot.f, top = lot.top;
          let ly;
          const sign = shop ? signFor(ctx, road, bs + j * 7) : 0;
          if (hero && hero.up !== undefined) ly = [hero.up, hero.gnd !== undefined ? hero.gnd : hero.up];
          else if (style === ST.TUBE) ly = [lot.look.up, shop ? shopLayer(lot.look.era, sign, bs + j * 7) : L.DOOR];
          else ly = layersFor(style, shop, hash(row ? bs : b.i, 41), hash(bs + j * 7, 42));
          const x0 = ax + dx * lot.t0, z0 = az + dz * lot.t0, x1 = ax + dx * lot.t1, z1 = az + dz * lot.t1, fseed = (seed + j * 37 + k * 5) & 255;
          const fx = [style, fseed, f, (shop ? FLAG_SHOP : 0) | (lot.age << 1)];
          bb.wall(x0, z0, x1, z1, 0, top, nx, nz, 0, 1, 0, f + lot.par / lot.fh, fx, [ly[0], ly[1], lot.tint, sign ? SIGNS[sign][2] : 0]);
          if (street) fronts.push({ b, x0, z0, x1, z1, nx, nz, w: (Lw * (lot.t1 - lot.t0)), h: lot.H, fh: lot.fh, floors: f, style, shop, up: ly[0], gnd: ly[1], sign, tint: lot.tint, road, seed: bs + j * 7, era: lot.look ? lot.look.era : -1, tile: lot.tile || pitched, zone, hero });
          if (lot.H <= h) continue;
          // khối lô nhô lên: hai tường hồi (chỉ phần cao hơn lô bên cạnh), tường sau, mái
          const ix = -nx * depth, iz = -nz * depth, fxB = [ST.BLANK, fseed, f, lot.age << 1], vaB = [L.BLANK + (hash(bs, 57) < 0.7 ? 0 : 1), L.BLANK, lot.tint, 0], ud = depth / 4;
          const rise = lot.tile ? Math.min(1.9, depth * 0.24) : 0;
          for (const [e, px, pz, tx, tz] of [[0, x0, z0, -dx / Lw, -dz / Lw], [1, x1, z1, dx / Lw, dz / Lw]]) {
            const o = lots[j + (e ? 1 : -1)], lo = Math.max(h, o ? o.top : 0);
            if (top > lo + 0.05) bb.wall(px, pz, px + ix, pz + iz, lo, top, tx, tz, 0, ud, lo / lot.fh, f + lot.par / lot.fh, fxB, vaB);
            if (rise && (!o || o.H + (o.tile ? Math.min(1.9, depth * 0.24) : o.par) < lot.H + rise - 0.2)) bb.triWall([px, lot.H, pz], [px + ix, lot.H, pz + iz], [px + ix / 2, lot.H + rise, pz + iz / 2], tx, tz, [[0, f - 0.4], [ud, f - 0.4], [ud / 2, f - 0.1]], fxB, vaB);
          }
          bb.wall(x0 + ix, z0 + iz, x1 + ix, z1 + iz, h, top, -nx, -nz, 0, (Lw * (lot.t1 - lot.t0)) / 4, h / lot.fh, f + lot.par / lot.fh, fxB, vaB);
          if (lot.tile) {
            const fxR = [ST.ROOF_TILE, seed, 0, 0], vaR = [L.ROOF + ST.ROOF_TILE, 0, pick(P.roof, hash(bs, 51)), 0], uu = (Lw * (lot.t1 - lot.t0)) / 2.2, vv = Math.hypot(depth / 2, rise) / 2.2, yr = lot.H + rise;
            bb.quadUp([[x0, lot.H, z0], [x1, lot.H, z1], [x1 + ix / 2, yr, z1 + iz / 2], [x0 + ix / 2, yr, z0 + iz / 2]], [[0, 0], [uu, 0], [uu, vv], [0, vv]], fxR, vaR);
            bb.quadUp([[x1 + ix, lot.H, z1 + iz], [x0 + ix, lot.H, z0 + iz], [x0 + ix / 2, yr, z0 + iz / 2], [x1 + ix / 2, yr, z1 + iz / 2]], [[0, 0], [uu, 0], [uu, vv], [0, vv]], fxR, vaR);
          } else {
            const tin = hash(bs, 58) < 0.3, kind = tin ? ST.ROOF_TIN : ST.ROOF_FLAT, fxR = [kind, seed, 0, 0], vaR = [L.ROOF + kind, 0, tin ? pick(hash(bs, 59) < 0.7 ? P.tinHot : P.tin, hash(bs, 51)) : pick(P.roof, hash(bs, 51)), 0];
            const q = [[x0, lot.H, z0], [x1, lot.H, z1], [x1 + ix, lot.H, z1 + iz], [x0 + ix, lot.H, z0 + iz]];
            bb.quadUp(q, q.map((v) => [v[0] / 4, v[2] / 4]), fxR, vaR);
            if (!tin) roofs.push({ x: (x0 + x1 + ix) / 2, z: (z0 + z1 + iz) / 2, y: lot.H, w: Lw * (lot.t1 - lot.t0), d: depth, ex: dx / Lw, ez: dz / Lw, seed: bs, tint: lot.tint });
          }
        }
      }
    }
    // ----- mái -----
    const roofTint = hero && hero.roofTint !== undefined ? hero.roofTint : rk === ST.ROOF_TIN ? pick(P.tin, hash(b.i, 51)) : pick(P.roof, hash(b.i, 51));
    if (pitched) gable(bb, b);
    else if (hip) hipRoof(bb, b, hip, roofTint);
    else {
      const flat = [], holes = [];
      for (let k = 0; k < b.p.length; k++) flat.push(b.p[k]);
      for (const hh of b.holes) { holes.push(flat.length / 2); for (let k = 0; k < hh.length; k++) flat.push(hh[k]); }
      const t = earcut(flat, holes), s = bb.n, fx = [rk, seed, 0, 0];
      const va = [L.ROOF + rk, 0, roofTint, 0];
      for (let k = 0; k < flat.length; k += 2) bb.v(flat[k], h, flat[k + 1], 0, 1, 0, flat[k] / 4, flat[k + 1] / 4, fx, va);
      for (let k = 0; k < t.length; k += 3) bb.idx.push(s + t[k], s + t[k + 2], s + t[k + 1]);
      if (rk === ST.ROOF_FLAT && (st === ST.TUBE || st === ST.APART) && !row && b.area > 28 && b.area < 420) {
        const p = b.p, ex = p[2] - p[0], ez = p[3] - p[1], el = Math.hypot(ex, ez) || 1;
        roofs.push({ x: b.cx, z: b.cz, y: h, w: Math.min(el, 8), d: Math.min(b.area / el, 10), ex: ex / el, ez: ez / el, seed: b.i, tint: bTint });
      }
    }
  }
  return { mesh: bb.pack(), col: new Float32Array(col), fronts, roofs };
}

// ----- mái ngói bốn mái (mái hông) cho biệt thự, công sở kiểu Pháp có mặt bằng bất kỳ -----
// Thu vòng tường vào trong một khoảng d (góc ghép kiểu mộng xiên) rồi nối mép tường với vòng trong bằng các mặt dốc;
// trên cùng là mảng ngói phẳng nhỏ, đứng dưới phố không thấy. Trả về null nếu hình quá mảnh hoặc quá nhiều đỉnh.
function hipRing(b) {
  const p = b.p, n = p.length / 2; if (n < 3 || n > 16 || b.area < 40) return null;
  let area = 0; for (let k = 0; k < n; k++) { const j = (k + 1) % n; area += p[k * 2] * p[j * 2 + 1] - p[j * 2] * p[k * 2 + 1]; }
  const sg = area > 0 ? 1 : -1, d = Math.min(3.4, Math.sqrt(b.area) * 0.2), q = [];
  for (let k = 0; k < n; k++) {
    const i0 = (k + n - 1) % n, i1 = (k + 1) % n, ax = p[k * 2] - p[i0 * 2], az = p[k * 2 + 1] - p[i0 * 2 + 1], bx = p[i1 * 2] - p[k * 2], bz = p[i1 * 2 + 1] - p[k * 2 + 1];
    const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz); if (la < 0.4 || lb < 0.4) return null;
    // pháp tuyến hướng vào trong của hai cạnh kề
    const n0x = (-az / la) * sg, n0z = (ax / la) * sg, n1x = (-bz / lb) * sg, n1z = (bx / lb) * sg;
    let mxx = n0x + n1x, mzz = n0z + n1z; const ml = Math.hypot(mxx, mzz); if (ml < 0.3) return null; mxx /= ml; mzz /= ml;
    const k2 = d / Math.max(0.45, mxx * n0x + mzz * n0z);
    q.push(p[k * 2] + mxx * k2, p[k * 2 + 1] + mzz * k2);
  }
  // vòng trong phải cùng chiều và các cạnh không đảo hướng
  let a2 = 0; for (let k = 0; k < n; k++) { const j = (k + 1) % n; a2 += q[k * 2] * q[j * 2 + 1] - q[j * 2] * q[k * 2 + 1]; if ((q[j * 2] - q[k * 2]) * (p[j * 2] - p[k * 2]) + (q[j * 2 + 1] - q[k * 2 + 1]) * (p[j * 2 + 1] - p[k * 2 + 1]) <= 0) return null; }
  if (a2 * sg <= 0) return null;
  return { q, d, rise: d * 0.7 };
}
function hipRoof(bb, b, hip, tint) {
  const p = b.p, n = p.length / 2, { q, rise } = hip, h = b.height, fx = [ST.ROOF_TILE, b.seed, 0, 0], va = [L.ROOF + ST.ROOF_TILE, 0, tint, 0], sl = Math.hypot(hip.d, rise) / 2.2;
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n, len = Math.hypot(p[j * 2] - p[k * 2], p[j * 2 + 1] - p[k * 2 + 1]) / 2.2, off = (len - Math.hypot(q[j * 2] - q[k * 2], q[j * 2 + 1] - q[k * 2 + 1]) / 2.2) / 2;
    bb.quadUp([[p[k * 2], h, p[k * 2 + 1]], [p[j * 2], h, p[j * 2 + 1]], [q[j * 2], h + rise, q[j * 2 + 1]], [q[k * 2], h + rise, q[k * 2 + 1]]], [[0, 0], [len, 0], [len - off, sl], [off, sl]], fx, va);
  }
  const t = earcut(q), s = bb.n;
  for (let k = 0; k < n; k++) bb.v(q[k * 2], h + rise, q[k * 2 + 1], 0, 1, 0, q[k * 2] / 2.2, q[k * 2 + 1] / 2.2, fx, va);
  for (let k = 0; k < t.length; k += 3) bb.idx.push(s + t[k], s + t[k + 2], s + t[k + 1]);
}

// Mái ngói dốc cho nhà ống bốn cạnh: nóc song song mặt phố (cạnh ngắn), chia thành nhiều lớp mái theo chiều sâu.
function gable(bb, b) {
  const p = b.p, h = b.height, seed = b.seed;
  const Q = [[p[0], p[1]], [p[2], p[3]], [p[4], p[5]], [p[6], p[7]]];
  const len = (i) => Math.hypot(Q[(i + 1) % 4][0] - Q[i % 4][0], Q[(i + 1) % 4][1] - Q[i % 4][1]);
  const o = len(0) + len(2) <= len(1) + len(3) ? 0 : 1;
  const A = Q[o], Bp = Q[(o + 1) % 4], C = Q[(o + 2) % 4], D = Q[(o + 3) % 4]; // A-B ngắn, B-C dài, C-D ngắn, D-A dài
  const depth = (len(o + 1) + len(o + 3)) / 2, width = (len(o) + len(o + 2)) / 2;
  const n = Math.max(1, Math.min(5, Math.round(depth / 7.5))), rise = Math.min(2.4, Math.max(0.9, (depth / n) * 0.28));
  const lerp2 = (a, c, t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
  const fxR = [ST.ROOF_TILE, seed, 0, 0], vaR = [L.ROOF + ST.ROOF_TILE, 0, pick(P.roof, hash(b.i, 51)), 0];
  const fxW = [ST.BLANK, seed, b.floors, 0], vaW = [L.BLANK, L.BLANK, pick(P.tube, hash(b.i, 31)), 0];
  const face = (q0, q1, q2, q3, y0, y1, y2, y3) => {
    const ux = q1[0] - q0[0], uy = y1 - y0, uz = q1[1] - q0[1], vx = q3[0] - q0[0], vy = y3 - y0, vz = q3[1] - q0[1];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const up = ny >= 0; if (!up) { nx = -nx; ny = -ny; nz = -nz; }
    const s = bb.n, uu = width / 2.2, vv = Math.hypot(depth / n / 2, rise) / 2.2;
    bb.v(q0[0], y0, q0[1], nx, ny, nz, 0, 0, fxR, vaR); bb.v(q1[0], y1, q1[1], nx, ny, nz, uu, 0, fxR, vaR);
    bb.v(q2[0], y2, q2[1], nx, ny, nz, uu, vv, fxR, vaR); bb.v(q3[0], y3, q3[1], nx, ny, nz, 0, vv, fxR, vaR);
    if (up) bb.idx.push(s, s + 1, s + 2, s, s + 2, s + 3); else bb.idx.push(s, s + 2, s + 1, s, s + 3, s + 2);
  };
  const tri = (q0, q1, q2, y0, y1, y2, nx, nz) => {
    const s = bb.n;
    bb.v(q0[0], y0, q0[1], nx, 0, nz, 0, b.floors - 0.5, fxW, vaW); bb.v(q1[0], y1, q1[1], nx, 0, nz, 1, b.floors - 0.5, fxW, vaW); bb.v(q2[0], y2, q2[1], nx, 0, nz, 0.5, b.floors - 0.1, fxW, vaW);
    const e1x = q1[0] - q0[0], e1y = y1 - y0, e1z = q1[1] - q0[1], e2x = q2[0] - q0[0], e2y = y2 - y0, e2z = q2[1] - q0[1];
    if ((e1y * e2z - e1z * e2y) * nx + (e1x * e2y - e1y * e2x) * nz > 0) bb.idx.push(s, s + 1, s + 2); else bb.idx.push(s + 1, s, s + 2);
  };
  const outward = (q0, q1) => { const dx = q1[0] - q0[0], dz = q1[1] - q0[1], Ln = Math.hypot(dx, dz) || 1; let nx = dz / Ln, nz = -dx / Ln; if (((q0[0] + q1[0]) / 2 - b.cx) * nx + ((q0[1] + q1[1]) / 2 - b.cz) * nz < 0) { nx = -nx; nz = -nz; } return [nx, nz]; };
  const nR = outward(Bp, C), nL = outward(D, A);
  for (let i = 0; i < n; i++) {
    const t0 = i / n, tm = (i + 0.5) / n, t1 = (i + 1) / n;
    const l0 = lerp2(A, D, t0), r0 = lerp2(Bp, C, t0), lm = lerp2(A, D, tm), rm = lerp2(Bp, C, tm), l1 = lerp2(A, D, t1), r1 = lerp2(Bp, C, t1);
    face(l0, r0, rm, lm, h, h, h + rise, h + rise);
    face(r1, l1, lm, rm, h, h, h + rise, h + rise);
    tri(r0, r1, rm, h, h, h + rise, nR[0], nR[1]);
    tri(l1, l0, lm, h, h, h + rise, nL[0], nL[1]);
  }
}

// Mái che (chợ, bến xe, hiên): tấm mái tôn mỏng, không có tường.
function canopy(bb, b) {
  const flat = Array.from(b.p), t = earcut(flat), y = Math.min(b.height, 5), fx = [ST.ROOF_TIN, b.seed, 0, 0], va = [L.ROOF + ST.ROOF_TIN, 0, pick(P.tin, hash(b.i, 51)), 0];
  let s = bb.n;
  for (let k = 0; k < flat.length; k += 2) bb.v(flat[k], y, flat[k + 1], 0, 1, 0, flat[k] / 4, flat[k + 1] / 4, fx, va);
  for (let k = 0; k < t.length; k += 3) bb.idx.push(s + t[k], s + t[k + 2], s + t[k + 1]);
  s = bb.n;
  for (let k = 0; k < flat.length; k += 2) bb.v(flat[k], y - 0.12, flat[k + 1], 0, -1, 0, flat[k] / 4, flat[k + 1] / 4, fx, va);
  for (let k = 0; k < t.length; k += 3) bb.idx.push(s + t[k], s + t[k + 1], s + t[k + 2]);
}
