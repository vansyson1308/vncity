// Chi tiết phố phường gắn theo mặt tiền và vỉa hè: biển hiệu nổi, mái hiên bạt, ban công, cục nóng điều hoà,
// cờ, xe máy dựng vỉa hè, bàn ghế nhựa quán cóc, cột điện và búi dây, bồn nước inox trên mái, tường rào, đường ray.
// Tất cả gộp vào lưới "gần" của ô phố; lưới "xa" chỉ giữ thứ nhìn thấy từ xa.
import { G, MAT } from '../../core/geo.js';
import { hash } from '../../core/util.js';
import { CS, CURB, K, ZONE, zoneAt, isSolemn, roadY } from '../data.js';
import { L } from '../layers.js';
import { SIGNS, SIGN_COLORS, signUV, FLAG_CELL, PAL } from '../signs.js';
import { motorbike } from '../../models/vehicles.js';

const lin = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255].map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
const SIGN_LIN = SIGN_COLORS.map(lin), PAL_LIN = PAL.map(lin);
const AWNING = [0x2f6fb0, 0x1e7a4c, 0xb3261e, 0xd9a520, 0xe9e3d0, 0x4a4f55, 0x8a3a2a, 0x2a7a7a].map(lin);
const BIKE_TINT = [[0.55, 0.03, 0.03], [0.02, 0.02, 0.025], [0.75, 0.75, 0.73], [0.05, 0.12, 0.4], [0.35, 0.36, 0.38], [0.08, 0.08, 0.09], [0.6, 0.6, 0.62], [0.02, 0.2, 0.12], [0.5, 0.1, 0.25], [0.7, 0.45, 0.05]];
export { BIKE_TINT };
let BIKES = null;
const bikes = () => BIKES || (BIKES = [motorbike(new G(), 'wave', 0), motorbike(new G(), 'scooter', 0), motorbike(new G(), 'wave', 0), motorbike(new G(), 'cub', 0)]);

function stool(g, x, z, red) { g.rgb(red ? 0.52 : 0.04, red ? 0.03 : 0.14, red ? 0.03 : 0.5).cyl(x, 0, z, 0.17, 0.13, 0.27, 4, true); }
function lowTable(g, x, z, steel) { if (steel) g.rgb(0.55, 0.56, 0.58).gloss(0.6); else g.rgb(0.05, 0.16, 0.5); g.cube(x, 0.4, z, 0.62, 0.03, 0.62).cyl(x, 0, z, 0.05, 0.05, 0.4, 4, false); g.gloss(0); }

export function decorate(ctx, env) {
  const { near, far, lamps, X0, Z0, inChunk, free, onRoad, roads, bld } = env;
  const W = ctx.world, extraWalls = [];

  // ===== mặt tiền =====
  for (const f of bld.fronts) {
    const mx = (f.x0 + f.x1) / 2, mz = (f.z0 + f.z1) / 2, s = f.seed, bw = f.w, fh = f.fh;
    const g = near; g.push().move(mx - X0, CURB, mz - Z0).rotY(Math.atan2(f.nx, f.nz)); // +z cục bộ = hướng ra phố, +x = dọc tường
    const open = f.gnd === L.SHOP || f.gnd === L.SHOP + 2 || f.gnd === L.SHOP + 3;
    if (f.shop && f.sign) {
      const sc = SIGN_LIN[SIGNS[f.sign][2]], uv = signUV(f.sign), sw = Math.min(bw - 0.3, 4.4), y0 = fh * 0.775, y1 = Math.min(fh * 0.975, y0 + 0.95), d = 0.1 + hash(s, 1) * 0.12;
      g.rgb(sc[0] * 0.5, sc[1] * 0.5, sc[2] * 0.5).glow(0).box(-sw / 2, y0, 0, sw / 2, y1, d, 'xXyY');
      g.rgb(1, 1, 1).glow(0.3).quad([-sw / 2, y0, d], [sw / 2, y0, d], [sw / 2, y1, d], [-sw / 2, y1, d], uv).glow(0);
      // mái hiên bạt dưới biển
      if (hash(s, 2) < 0.55) {
        const c = AWNING[Math.floor(hash(s, 3) * AWNING.length)], aw = bw - 0.2, ya = fh * 0.74, out = 1.1 + hash(s, 4) * 0.8, yb = ya - 0.28 - out * 0.12;
        g.rgb(c[0], c[1], c[2]).quad([-aw / 2, yb, out], [aw / 2, yb, out], [aw / 2, ya, 0.04], [-aw / 2, ya, 0.04]);
        g.rgb(c[0] * 0.45, c[1] * 0.45, c[2] * 0.45).quad([aw / 2, yb, out], [-aw / 2, yb, out], [-aw / 2, ya, 0.04], [aw / 2, ya, 0.04]);
        g.rgb(c[0] * 0.8 + 0.1, c[1] * 0.8 + 0.1, c[2] * 0.8 + 0.1).quad([-aw / 2, yb - 0.2, out], [aw / 2, yb - 0.2, out], [aw / 2, yb, out], [-aw / 2, yb, out]);
        g.rgb(0.2, 0.2, 0.2).tube([-aw / 2 + 0.05, yb, out], [-aw / 2 + 0.05, ya - 0.5, 0.04], 0.012, 3).tube([aw / 2 - 0.05, yb, out], [aw / 2 - 0.05, ya - 0.5, 0.04], 0.012, 3);
      }
      // biển vẫy vuông góc mặt nhà ở tầng hai
      if (f.floors > 1 && hash(s, 5) < 0.2) {
        const c2 = SIGN_LIN[Math.floor(hash(s, 6) * 10)], sx = (hash(s, 7) < 0.5 ? -1 : 1) * (bw / 2 - 0.12), yb = fh * 1.12;
        g.rgb(c2[0], c2[1], c2[2]).glow(0.35).box(sx - 0.05, yb, 0.1, sx + 0.05, yb + 1.5, 0.75).glow(0);
        g.rgb(0.9, 0.9, 0.85).glow(0.35).box(sx - 0.055, yb + 0.25, 0.2, sx + 0.055, yb + 1.25, 0.65, 'xX').glow(0);
      }
      if (open && hash(s, 8) < 0.75) lamps.push(mx + f.nx * 1.6, 3, mz + f.nz * 1.6, 4.6);
    }
    // ban công nổi cho các kiểu tầng trên có vẽ ban công
    if (f.style === 10 || f.style === 13) {
      const top = Math.min(f.floors - 1, 3);
      for (let i = 1; i <= top; i++) {
        const y = i * fh + fh * 0.15, w2 = bw / 2 - 0.22;
        if (f.up === 0 || f.up === 2 || f.up === 4) {
          g.rgb(0.55, 0.54, 0.5).box(-w2, y - 0.1, 0, w2, y, 0.8);
          if (f.up === 4) { const t = PAL_LIN[f.tint]; g.rgb(t[0] * 0.75, t[1] * 0.75, t[2] * 0.75).box(-w2, y, 0.7, w2, y + 0.82, 0.8); }
          else {
            if (f.up === 0) g.rgb(0.03, 0.035, 0.04); else g.rgb(0.5, 0.52, 0.54).gloss(0.7);
            g.box(-w2, y + 0.78, 0.76, w2, y + 0.83, 0.8, 'yYzZ').box(-w2, y + 0.4, 0.77, w2, y + 0.43, 0.8, 'zZ');
            for (const px of [-w2, 0, w2 - 0.04]) g.box(px, y, 0.76, px + 0.04, y + 0.8, 0.8, 'xXzZ');
            g.box(-w2, y, 0.02, -w2 + 0.03, y + 0.83, 0.8, 'xX').box(w2 - 0.03, y, 0.02, w2, y + 0.83, 0.8, 'xX').gloss(0);
          }
        } else if (f.up === 3) { // chuồng cọp
          g.rgb(0.25, 0.3, 0.33).box(-w2, y - 0.05, 0, w2, y, 0.55).box(-w2, y + fh * 0.62, 0, w2, y + fh * 0.62 + 0.05, 0.6);
          for (const px of [-w2, -w2 / 3, w2 / 3, w2 - 0.03]) g.box(px, y, 0.52, px + 0.03, y + fh * 0.62, 0.55, 'xXzZ');
          g.box(-w2, y + fh * 0.3, 0.52, w2, y + fh * 0.3 + 0.03, 0.55, 'zZ');
        }
        if ((f.up === 2 || hash(s, 30 + i) < 0.22) && bw > 3) { const ax = (hash(s, 40 + i) < 0.5 ? -1 : 1) * (bw / 2 - 0.55); g.rgb(0.72, 0.72, 0.7).box(ax - 0.4, y + fh * 0.55, 0.02, ax + 0.4, y + fh * 0.55 + 0.55, 0.32); }
      }
      // cờ đỏ sao vàng
      if (f.floors > 1 && hash(s, 9) < 0.07) {
        const px = (hash(s, 10) - 0.5) * (bw - 1), yb = fh * 1.25, uv = signUV(FLAG_CELL);
        g.rgb(0.6, 0.6, 0.58).tube([px, yb, 0.03], [px, yb + 1.25, 1.05], 0.014, 3);
        g.rgb(1, 1, 1).sway(0.5);
        const a = [px, yb + 0.6, 0.51], b = [px, yb + 1.22, 1.03];
        g.quad([a[0], a[1] - 0.62, a[2]], [b[0], b[1] - 0.62, b[2]], b, a, [uv[0], uv[1], uv[2], uv[3]]).quad([b[0], b[1] - 0.62, b[2]], [a[0], a[1] - 0.62, a[2]], a, b, [uv[2], uv[1], uv[0], uv[3]]).sway(0);
      }
    }
    // xe máy dựng trên vỉa hè trước cửa hàng
    if (f.shop && hash(s, 11) < 0.42 && env.nBikes < 34) {
      const rd = ctx.nearestRoad(mx + f.nx * 2, mz + f.nz * 2, 15, (q) => !q.elev);
      if (rd && rd.d + 2 - rd.r.w / 2 > 2.5) {
        const n = 1 + Math.floor(hash(s, 12) * Math.min(4, bw / 0.8)), B = bikes();
        for (let i = 0; i < n; i++) {
          const bx = (i - (n - 1) / 2) * 0.72 + (hash(s, 13) - 0.5) * 0.6;
          g.push().move(bx, 0, 1.25 + hash(s + i, 14) * 0.25).rotY(Math.PI / 2 + (hash(s + i, 15) - 0.5) * 0.3 + (hash(s, 16) < 0.3 ? Math.PI : 0)).rotX(0.16);
          g.add(B[Math.floor(hash(s + i, 17) * B.length)], BIKE_TINT[Math.floor(hash(s + i, 18) * BIKE_TINT.length)]); g.pop(); env.nBikes++;
        }
      }
    }
    g.pop();
  }

  // ===== quán cóc vỉa hè ở những chỗ OSM ghi có hàng ăn uống =====
  for (const i of ctx.foodIdx.get(env.cx * 1000 + env.cz) || []) {
    const x = W.food[i], z = W.food[i + 1], kind = W.food[i + 2], seed = (i * 40503) | 0;
    if (isSolemn(x, z)) continue;
    const rd = ctx.nearestRoad(x, z, 22, (r) => r.veh && r.kind <= K.residential); if (!rd || rd.d < 0.5) continue;
    const ux = (x - rd.px) / rd.d, uz = (z - rd.pz) / rd.d, px = rd.px + ux * (rd.r.w / 2 + 1.05), pz = rd.pz + uz * (rd.r.w / 2 + 1.05);
    if (!free(px, pz) || onRoad(px, pz, 0.3)) continue;
    near.push().move(px - X0, CURB, pz - Z0).rotY(Math.atan2(ux, uz));
    const tables = 1 + Math.floor(hash(seed, 1) * 2.4), red = hash(seed, 2) < 0.6;
    for (let t = 0; t < tables; t++) {
      const tx = (t - (tables - 1) / 2) * 1.5;
      lowTable(near, tx, 0, kind === 0 && hash(seed, 3) < 0.5);
      for (const [sx, sz] of [[-0.5, 0], [0.5, 0], [0, 0.5], [0, -0.48]]) if (hash(seed + t * 7 + sx * 3 + sz * 5, 4) < 0.8) stool(near, tx + sx, sz, red);
    }
    near.pop();
  }

  // ===== cột điện và búi dây =====
  for (const r of roads) {
    if (!r.veh || r.kind < K.tertiary || r.kind > K.residential || r.len < 30) continue;
    const zn = zoneAt(r.p[0], r.p[1]); if (zn === ZONE.french || zn === ZONE.badinh || isSolemn(r.p[0], r.p[1])) continue;
    const gap = 27, p = r.p, pts = [];
    let d = 0;
    for (let i = 0; i < p.length - 2; i += 2) {
      const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], Ls = Math.hypot(bx - ax, bz - az); if (Ls < 0.01) continue;
      const dx = (bx - ax) / Ls, dz = (bz - az) / Ls;
      for (let s = Math.ceil((d + 1e-6 - 9) / gap) * gap + 9 - d; s < Ls; s += gap) { if (s < 0) continue; const o = r.w / 2 + 0.42; pts.push([ax + dx * s + dz * o, az + dz * s - dx * o, d + s]); }
      d += Ls;
    }
    for (let i = 0; i < pts.length; i++) {
      const [x, z, dd] = pts[i]; if (dd < 6 || dd > r.len - 6) { pts[i].bad = true; continue; }
      if (!free(x, z)) { pts[i].bad = true; continue; }
      if (!inChunk(x, z)) continue;
      const seed = (r.i * 131 + i) | 0, gx = x - X0, gz = z - Z0;
      near.rgb(0.42, 0.41, 0.38).cyl(gx, CURB, gz, 0.15, 0.1, 8.6, 6, true);
      near.rgb(0.25, 0.25, 0.24).cube(gx, CURB + 7.5, gz, 1.3, 0.08, 0.08).cube(gx, CURB + 6.6, gz, 0.08, 0.08, 1.0);
      near.rgb(0.015, 0.015, 0.018).ball(gx, CURB + 5.9, gz, 0.34, 6, 4, 0.8, 0.5, seed);  // búi cáp viễn thông
      if (hash(seed, 2) < 0.3) near.rgb(0.3, 0.33, 0.36).cube(gx, CURB + 4.9, gz + 0.2, 0.5, 0.7, 0.35);
      far.rgb(0.42, 0.41, 0.38).cyl(gx, CURB, gz, 0.13, 0.1, 8.6, 3, false);
      const nx = pts[i + 1]; if (!nx || nx.bad === true) continue;
      if (!free(nx[0], nx[1]) || nx[2] > r.len - 6) continue;
      const cables = 3 + Math.floor(hash(seed, 3) * 4);
      near.rgb(0.012, 0.012, 0.015);
      for (let c = 0; c < cables; c++) {
        const h0 = 5.4 + hash(seed, 10 + c) * 2.3 + CURB, h1 = 5.4 + hash(seed + 1, 10 + c) * 2.3 + CURB, sag = 0.3 + hash(seed, 20 + c) * 0.9, oz = (hash(seed, 30 + c) - 0.5) * 0.5;
        const N = 4, a = [], b = [], a2 = [], b2 = [], th = 0.024;
        for (let k = 0; k <= N; k++) { const t = k / N, wx = gx + (nx[0] - x) * t, wz = gz + (nx[1] - z) * t + oz * Math.sin(t * Math.PI), wy = h0 + (h1 - h0) * t - sag * 4 * t * (1 - t); a.push([wx, wy - th, wz]); b.push([wx, wy + th, wz]); a2.push([wx - th, wy, wz - th]); b2.push([wx + th, wy, wz + th]); }
        near.ribbon(a, b).ribbon(a, b, true); void a2; void b2;
      }
    }
  }

  // ===== đèn lồng giăng ngang phố =====
  for (const r of roads) {
    const name = W.names[r.name]; if (name !== 'Phố Hàng Mã' && name !== 'Phố Hàng Lược' && name !== 'Phố Tạ Hiện' && name !== 'Phố Lương Văn Can') continue;
    const p = r.p; let d = 0;
    for (let i = 0; i < p.length - 2; i += 2) {
      const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], Ls = Math.hypot(bx - ax, bz - az); if (Ls < 0.01) continue;
      const dx = (bx - ax) / Ls, dz = (bz - az) / Ls;
      for (let s = Math.ceil((d + 1e-6) / 8) * 8 - d; s < Ls; s += 8) {
        const x = ax + dx * s, z = az + dz * s; if (!inChunk(x, z)) continue;
        const hw = r.w / 2 + 1.6, seed = (r.i * 977 + Math.round(d + s)) | 0;
        for (const g of [near, far]) {
          g.rgb(0.02, 0.02, 0.02).tube([x - X0 - dz * hw, 5.6, z - Z0 + dx * hw], [x - X0 + dz * hw, 5.6, z - Z0 - dx * hw], g === near ? 0.015 : 0.03, 3);
          const n = g === near ? 7 : 4;
          for (let k = 0; k < n; k++) { const t = (k + 0.5) / n * 2 - 1, lx = x - X0 - dz * hw * t, lz = z - Z0 + dx * hw * t, c = hash(seed + k, 1); if (c < 0.6) g.rgb(0.85, 0.06, 0.04); else if (c < 0.85) g.rgb(0.95, 0.6, 0.08); else g.rgb(0.9, 0.2, 0.5); g.glow(0.8).ball(lx, 5.25 - Math.abs(t) * 0.1, lz, g === near ? 0.24 : 0.3, g === near ? 7 : 4, g === near ? 4 : 2, 1.15).glow(0); }
        }
        lamps.push(x, 3, z, 6);
      }
      d += Ls;
    }
  }

  // ===== bồn nước inox và tum thang trên mái bằng =====
  for (const b of bld.roofs) {
    if (hash(b.i, 61) > 0.62) continue;
    const p = b.p, ex = p[2] - p[0], ez = p[3] - p[1], el = Math.hypot(ex, ez) || 1, h = b.height;
    near.push().move(b.cx - X0, h, b.cz - Z0).rotY(Math.atan2(-ez, ex));
    const t = PAL_LIN[Math.floor(hash(b.i, 31) * 12)];
    if (b.area > 45) near.rgb(t[0] * 0.7, t[1] * 0.7, t[2] * 0.7).cube(-0.8, 0, 0.3, 2.2, 2.3, 2.4).rgb(0.3, 0.3, 0.3).cube(-0.8, 2.3, 0.3, 2.5, 0.08, 2.7);
    near.rgb(0.3, 0.3, 0.32).box(0.7, 0, -1.1, 2.1, 0.6, -0.2, 'xXzZ');
    near.rgb(0.62, 0.64, 0.66).gloss(0.9).tube([0.6, 1.08, -0.65], [2.2, 1.08, -0.65], 0.48, 8).gloss(0);
    near.rgb(0.5, 0.52, 0.54).gloss(0.9).push().move(0.6, 1.08, -0.65).rotZ(Math.PI / 2).disc(0, 0, 0, 0.48, 8, 1).pop().push().move(2.2, 1.08, -0.65).rotZ(-Math.PI / 2).disc(0, 0, 0, 0.48, 8, 1).pop().gloss(0);
    near.pop();
  }

  // ===== tường rào, hàng rào (OSM barrier) =====
  // Tường không bao giờ chắn lối đi có trong bản đồ: để hở ở cổng (nút cổng của OSM) và ở mọi chỗ có đường, lối đi cắt qua.
  const GT = ctx.world.gates;
  for (const w of ctx.wallGrid.collect(X0, Z0, env.X1, env.Z1)) {
    const p = w.p, H = w.k === 3 ? 4.2 : w.k === 1 ? 1.7 : w.k === 2 ? 1.1 : 2.3, th = w.k === 2 ? 0.4 : w.k === 1 ? 0.03 : 0.14;
    for (let i = 0; i < p.length - 2; i += 2) {
      const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], Ls = Math.hypot(bx - ax, bz - az); if (Ls < 0.3) continue;
      const dx = (bx - ax) / Ls, dz = (bz - az) / Ls, cuts = [], posts = [];
      for (let k = 0; k < GT.length; k += 2) { // cổng: hở 3,4 m, hai trụ cổng hai bên
        const gx = GT[k] - ax, gz = GT[k + 1] - az, sg = gx * dx + gz * dz;
        if (Math.abs(gx * dz - gz * dx) < 1.2 && sg > -1.7 && sg < Ls + 1.7) { cuts.push([sg - 1.7, sg + 1.7]); posts.push(sg - 1.7, sg + 1.7); }
      }
      ctx.roadGrid.query(Math.min(ax, bx) - 1, Math.min(az, bz) - 1, Math.max(ax, bx) + 1, Math.max(az, bz) + 1, (r) => {
        if (r.skip || r.elev) return;
        const q = r.p, hw = Math.max(1.5, r.w / 2 + 0.6);
        for (let j = 0; j < q.length - 2; j += 2) {
          const ex = q[j + 2] - q[j], ez = q[j + 3] - q[j + 1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-6) continue;
          const sx = q[j] - ax, sz = q[j + 1] - az, sw = (sx * ez - sz * ex) / den, u = (sx * dz - sz * dx) / den;
          if (u >= -0.02 && u <= 1.02 && sw > -hw && sw < Ls + hw) cuts.push([sw - hw / Math.max(0.35, Math.abs(den) / Math.hypot(ex, ez)), sw + hw / Math.max(0.35, Math.abs(den) / Math.hypot(ex, ez))]);
        }
      });
      for (const [cx0, cz0, cx1, cz1, hw] of ctx.keepClear) { // lối đi phải thông của công trình dựng tay (cổng đền, đầu cầu)
        const ex = cx1 - cx0, ez = cz1 - cz0, el = Math.hypot(ex, ez) || 1, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-6) continue;
        const sx = cx0 - ax, sz = cz0 - az, sw = (sx * ez - sz * ex) / den, u = (sx * dz - sz * dx) / den, k = (hw + 0.4) / Math.max(0.35, Math.abs(den) / el);
        if (u >= -0.05 && u <= 1.05 && sw > -k && sw < Ls + k) cuts.push([sw - k, sw + k]);
      }
      cuts.sort((u, v) => u[0] - v[0]);
      const pieces = []; let s0 = 0;
      for (const [c0, c1] of cuts) { if (c0 > s0 + 0.3) pieces.push([s0, Math.min(c0, Ls)]); s0 = Math.max(s0, c1); if (s0 >= Ls) break; }
      if (s0 < Ls - 0.3) pieces.push([s0, Ls]);
      const paint = (g) => {
        // tường rào xây: vữa vôi vàng đã cũ; tường thành: đá rêu phong; hàng rào sắt, bờ giậu thì để trơn
        g.mat(w.k === 0 ? MAT.plaster : w.k === 3 ? MAT.mossy : MAT.none);
        if (w.k === 2) g.rgb(0.1, 0.22, 0.07); else if (w.k === 1) g.rgb(0.07, 0.11, 0.08); else if (w.k === 3) g.rgb(0.42, 0.4, 0.36); else g.rgb(0.62, 0.48, 0.2);
      };
      for (const [a0, a1] of pieces) {
        const pax = ax + dx * a0, paz = az + dz * a0, pbx = ax + dx * a1, pbz = az + dz * a1, mx = (pax + pbx) / 2, mz = (paz + pbz) / 2; if (!inChunk(mx, mz)) continue;
        const rd = ctx.nearestRoad(mx, mz, 14, (r) => !r.elev); if (rd && rd.d < rd.r.w / 2 + 0.3) continue; // tường nằm trong lòng đường (dữ liệu lệch)
        if (ctx.buildingAt(mx, mz)) continue;
        const nx = dz * th, nz = -dx * th, lx = pax - X0, lz = paz - Z0, rx = pbx - X0, rz = pbz - Z0;
        for (const g of [near, far]) {
          paint(g);
          g.quad([lx + nx, CURB, lz + nz], [rx + nx, CURB, rz + nz], [rx + nx, CURB + H, rz + nz], [lx + nx, CURB + H, lz + nz]);
          g.quad([rx - nx, CURB, rz - nz], [lx - nx, CURB, lz - nz], [lx - nx, CURB + H, lz - nz], [rx - nx, CURB + H, rz - nz]);
          if (g === near || w.k === 2) { g.shade(0.6); g.quad([lx + nx, CURB + H, lz + nz], [rx + nx, CURB + H, rz + nz], [rx - nx, CURB + H, rz - nz], [lx - nx, CURB + H, lz - nz]); }
        }
        if (w.k !== 2) extraWalls.push(pax, paz, pbx, pbz);
      }
      if (w.k === 0 || w.k === 3) for (const sp of posts) { // trụ cổng
        if (sp < -0.2 || sp > Ls + 0.2) continue; const x = ax + dx * sp, z = az + dz * sp; if (!inChunk(x, z)) continue;
        for (const g of [near, far]) { paint(g); g.cube(x - X0, CURB, z - Z0, 0.5, H + 0.3, 0.5, 'xXzZ'); g.shade(0.8).cube(x - X0, CURB + H + 0.3, z - Z0, 0.64, 0.14, 0.64); }
        extraWalls.push(x - 0.25, z, x + 0.25, z);
      }
      near.mat(); far.mat();
    }
  }

  // ===== đường ray (trên cầu thì bám theo cao độ mặt cầu) =====
  for (const rl of ctx.railGrid.collect(X0 - 4, Z0 - 4, env.X1 + 4, env.Z1 + 4)) {
    const p = rl.p, el = !!rl.elev; let d = 0;
    for (let i = 0; i < p.length - 2; i += 2) {
      const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], Ls = Math.hypot(bx - ax, bz - az); if (Ls < 0.05) continue;
      const dx = (bx - ax) / Ls, dz = (bz - az) / Ls, n = el ? Math.ceil(Ls / 8) : 1;
      for (let k = 0; k < n; k++) {
        const s0 = (Ls * k) / n, s1 = (Ls * (k + 1)) / n, mx = ax + dx * (s0 + s1) / 2, mz = az + dz * (s0 + s1) / 2; if (!inChunk(mx, mz)) continue;
        const ya = el ? roadY(rl, d + s0) : CURB, yb = el ? roadY(rl, d + s1) : CURB;
        for (const o of [-0.52, 0.52]) {
          const x0 = ax + dx * s0 - dz * o - X0, z0 = az + dz * s0 + dx * o - Z0, x1 = ax + dx * s1 - dz * o - X0, z1 = az + dz * s1 + dx * o - Z0, h = 0.15, w = 0.035;
          near.rgb(0.32, 0.27, 0.24).gloss(0.5).quad([x0 + dz * w, ya + h, z0 - dx * w], [x0 - dz * w, ya + h, z0 + dx * w], [x1 - dz * w, yb + h, z1 + dx * w], [x1 + dz * w, yb + h, z1 - dx * w]);
          near.gloss(0).rgb(0.14, 0.11, 0.1).quad([x0 - dz * w, ya + 0.02, z0 + dx * w], [x1 - dz * w, yb + 0.02, z1 + dx * w], [x1 - dz * w, yb + h, z1 + dx * w], [x0 - dz * w, ya + h, z0 + dx * w]).quad([x1 + dz * w, yb + 0.02, z1 - dx * w], [x0 + dz * w, ya + 0.02, z0 - dx * w], [x0 + dz * w, ya + h, z0 - dx * w], [x1 + dz * w, yb + h, z1 - dx * w]);
        }
      }
      near.rgb(0.2, 0.17, 0.14);
      for (let s = Math.ceil((d + 1e-6) / 1.25) * 1.25 - d; s < Ls; s += 1.25) {
        const x = ax + dx * s, z = az + dz * s; if (!inChunk(x, z)) continue;
        const gx = x - X0, gz = z - Z0, hl = 1.05, hw = 0.11, y = (el ? roadY(rl, d + s) : CURB) + 0.05;
        near.quad([gx - dz * hl - dx * hw, y, gz + dx * hl - dz * hw], [gx - dz * hl + dx * hw, y, gz + dx * hl + dz * hw], [gx + dz * hl + dx * hw, y, gz - dx * hl + dz * hw], [gx + dz * hl - dx * hw, y, gz - dx * hl - dz * hw]);
      }
      d += Ls;
    }
  }
  env.extra.walls = new Float32Array(extraWalls);
}
