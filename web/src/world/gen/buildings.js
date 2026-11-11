// Nhà của một ô phố. Tường quay ra phố được chia thành từng gian (mỗi gian một tứ giác) để worker quyết định
// kiểu cửa, màu vôi, biển hiệu của từng gian; shader (world/facades.js) chỉ việc vẽ theo.
// Thuộc tính đỉnh: uv = (gian, tầng), fx = [kiểu, hạt giống, số tầng, cờ], var = [lớp tầng trên, lớp tầng trệt, màu vôi, màu biển].
// Tường giáp nhà bên cạnh là tường trơn; khuất hẳn sau nhà cao hơn thì bỏ, không vẽ.
import earcut from 'earcut';
import { hash } from '../../core/util.js';
import { CS, K, CAT, ST } from '../data.js';
import { L } from '../layers.js';
import { P, SIGNS, GENERIC, TRADES } from '../signs.js';

const FLAG_SHOP = 1;
const pick = (range, r) => range[0] + Math.min(range[1] - 1, Math.floor(r * range[1]));

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
  pack() {
    const n = this.n, nrm = new Int8Array(n * 3); for (let i = 0; i < n * 3; i++) nrm[i] = Math.round(this.nrm[i] * 127);
    let y1 = 0; for (let i = 1; i < this.pos.length; i += 3) if (this.pos[i] > y1) y1 = this.pos[i];
    return { pos: new Float32Array(this.pos), nrm, uv: new Float32Array(this.uv), fx: new Uint8Array(this.fx), va: new Uint8Array(this.va), idx: n > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx), top: y1 };
  }
}

const BAY = { [ST.TUBE]: 4.0, [ST.ALLEY]: 4.0, [ST.FRENCH]: 4.6, [ST.MODERN]: 4.0, [ST.APART]: 3.6, [ST.PUBLIC]: 4.4, [ST.TEMPLE]: 4.2, [ST.CHURCH]: 5, [ST.MARKET]: 6, [ST.SMALL]: 3 };
const tintRange = (st) => (st === ST.FRENCH || st === ST.PUBLIC ? P.french : st === ST.APART || st === ST.MARKET || st === ST.SMALL ? P.apart : st === ST.MODERN ? P.glass : st === ST.TEMPLE ? P.temple : st === ST.CHURCH ? P.stone : P.tube);

// Lớp tầng trên / tầng trệt của một gian theo kiểu nhà. r1, r2: số ngẫu nhiên của gian.
function layersFor(style, shop, r1, r2) {
  switch (style) {
    case ST.TUBE: return [L.UP + Math.floor(r1 * 5), shop ? L.SHOP + Math.floor(r2 * L.N_SHOP) : L.DOOR];
    case ST.ALLEY: return [r1 < 0.5 ? 5 : 3, r2 < 0.6 ? L.DOOR : 5];
    case ST.BLANK: return [L.BLANK + (r1 < 0.62 ? 0 : 1), L.BLANK + (r1 < 0.62 ? 0 : 1)];
    case ST.FRENCH: return [r1 < 0.75 ? L.FR_UP : 1, shop ? L.SHOP + 2 : L.FR_GND];
    case ST.MODERN: return [L.MOD + (r1 < 0.5 ? 0 : 1), L.MOD_GND];
    case ST.APART: return [L.APART, shop ? L.SHOP + Math.floor(r2 * L.N_SHOP) : L.APART];
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

// Trả về { mesh, col (đoạn va chạm [ax,az,bx,bz,cao]), fronts (các gian mặt phố), roofs (mái bằng để đặt bồn nước) }
export function genBuildings(ctx, cx, cz) {
  const B = ctx.world.bounds, X0 = B.x0 + cx * CS, Z0 = B.z0 + cz * CS;
  const bb = new BB(X0, Z0), col = [], fronts = [], roofs = [];
  const list = ctx.chunkBld.get(cx * 1000 + cz) || [];
  for (const b of list) {
    if (b.ghost) { for (let k = 0, n = b.p.length; k < n; k += 2) col.push(b.p[k], b.p[k + 1], b.p[(k + 2) % n], b.p[(k + 3) % n], 12); continue; }
    const h = b.height, st = b.style, seed = b.seed, fl = b.floors;
    if (b.cat === CAT.roof) { canopy(bb, b); continue; }
    const rings = [b.p, ...b.holes];
    const pitched = b.roof === ST.ROOF_TILE && b.p.length === 8 && !b.holes.length;
    const bTint = pick(tintRange(st), hash(b.i, 31));
    const row = st === ST.TUBE && b.area > 140; // dãy nhà gộp chung một hình: mỗi gian một màu, một kiểu
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
          const rd = ctx.nearestRoad(mx + nx * 2, mz + nz * 2, 15);
          if (rd && (rd.px - mx) * nx + (rd.pz - mz) * nz > 0.5 && rd.d - rd.r.w / 2 < 8) {
            road = rd.r; street = !b.solemn && (road.kind <= K.residential || road.kind === K.pedestrian);
            if (st === ST.TUBE) { if (street) shop = true; else style = ST.ALLEY; }
            else if (st === ST.FRENCH) shop = street && hash(b.i, 5) < 0.45;
            else if (st === ST.APART) shop = street && hash(b.i, 6) < 0.6;
          } else if (st === ST.TUBE) style = hash(b.i * 31 + k, 7) < 0.5 ? ST.ALLEY : ST.BLANK;
        }
        const par = st === ST.TEMPLE || pitched ? 0 : 0.9;
        const fx = [style, seed, fl, shop ? FLAG_SHOP : 0];
        if (style === ST.BLANK) {
          const u = Lw / 4, ly = layersFor(ST.BLANK, false, hash(b.i, 35), 0);
          bb.wall(ax, az, bx, bz, y0, h + par, nx, nz, uoff, uoff + u, (y0 / h) * fl, fl + (par / h) * fl, fx, [ly[0], ly[1], bTint, 0]);
          uoff += u; continue;
        }
        const bays = Math.max(1, Math.round(Lw / (BAY[style] || 4)));
        for (let j = 0; j < bays; j++) {
          const t0 = j / bays, t1 = (j + 1) / bays, bs = b.i * 97 + k * 13 + (row ? j : 0);
          const ly = layersFor(style, shop, hash(row ? bs : b.i, 41), hash(bs + j * 7, 42));
          const tint = row ? pick(tintRange(style), hash(bs, 43)) : (style === st ? bTint : pick(tintRange(style), hash(b.i, 31)));
          const sign = shop ? signFor(ctx, road, bs + j * 7) : 0;
          const top = h + par + (row && !pitched ? Math.floor(hash(bs, 44) * 3) * 0.55 : 0);
          const x0 = ax + dx * t0, z0 = az + dz * t0, x1 = ax + dx * t1, z1 = az + dz * t1;
          bb.wall(x0, z0, x1, z1, 0, top, nx, nz, 0, 1, 0, fl + ((top - h) / h) * fl, fx, [ly[0], ly[1], tint, sign ? SIGNS[sign][2] : 0]);
          if (street) fronts.push({ b, x0, z0, x1, z1, nx, nz, w: Lw / bays, h, fh: h / fl, floors: fl, style, shop, up: ly[0], gnd: ly[1], sign, tint, road, seed: bs + j * 7 });
        }
      }
    }
    // ----- mái -----
    if (pitched) gable(bb, b);
    else {
      const flat = [], holes = [];
      for (let k = 0; k < b.p.length; k++) flat.push(b.p[k]);
      for (const hh of b.holes) { holes.push(flat.length / 2); for (let k = 0; k < hh.length; k++) flat.push(hh[k]); }
      const t = earcut(flat, holes), s = bb.n, fx = [b.roof, seed, 0, 0];
      const va = [L.ROOF + b.roof, 0, b.roof === ST.ROOF_TIN ? pick(P.tin, hash(b.i, 51)) : pick(P.roof, hash(b.i, 51)), 0];
      for (let k = 0; k < flat.length; k += 2) bb.v(flat[k], h, flat[k + 1], 0, 1, 0, flat[k] / 4, flat[k + 1] / 4, fx, va);
      for (let k = 0; k < t.length; k += 3) bb.idx.push(s + t[k], s + t[k + 2], s + t[k + 1]);
      if (b.roof === ST.ROOF_FLAT && (st === ST.TUBE || st === ST.APART) && b.area > 28 && b.area < 420) roofs.push(b);
    }
  }
  return { mesh: bb.pack(), col: new Float32Array(col), fronts, roofs };
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
