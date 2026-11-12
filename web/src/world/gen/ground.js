// Mặt đất của một ô phố: lòng đường nhựa, vỉa hè nâng 16 cm có bó vỉa vát và rãnh biên, bãi cỏ, lối dạo, kè hồ, vạch sơn,
// nắp hố ga, song chắn rác, miếng vá mặt đường (art bible mục 2.4, 2.11).
// Cách làm: gộp các dải đường (đệm theo bề rộng) bằng Clipper, phần còn lại của ô là khối phố (vỉa hè, sân, công viên).
// Chi tiết nhỏ không tốn hình học riêng: chất liệu là các lớp của một texture mảng, đề can là tứ giác trong cùng lưới.
import earcut from 'earcut';
import { CL, clip, union, inter, diff, offset, toEx, rectPath, toPath } from './context.js';
import { CS, CURB, WATER_Y, K, ZONE, zoneAt, isSolemn, F_ONEWAY, F_REVERSE, roadY, lowSpans, subPath, alongAt, LB_TRUSS_X, CD_TRUSS_S, CD_SPAN } from '../data.js';
import { hash2 } from '../../core/util.js';

// Lớp chất liệu: phải khớp thứ tự vẽ trong world/textures.js (groundTextures).
export const LAYER = { asphalt: 0, paving: 1, curb: 2, grass: 3, path: 4, dirt: 5, white: 6, yellow: 7, stone: 8, flower: 9, gravel: 10, plaza: 11, granite: 12, brick: 13, terrazzo: 14, quay: 15, gutter: 16 };
// Ô trong bảng đề can (lớp cuối của texture mảng).
export const DECAL = { manhole: 0, cable: 1, grate: 2, patchNew: 3, patchOld: 4, arrow: 5, arrowRight: 6, cover: 7, oil: 8, paint: 9 };
const HO_GUOM = /Hoàn Kiếm|Hồ Gươm/;

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
  // Đề can nằm theo mặt đất: tâm (x,z), trục dài (dx,dz) nửa dài hl, nửa rộng hw, cao độ y0 ở đầu sau và y1 ở đầu trước.
  // Lưới mặt đất không có UV, nên toạ độ trong ô đề can đi nhờ thuộc tính pháp tuyến: (x, z) = vị trí trong ô (±us, ±vs quanh tâm ô),
  // y = lớp nền bên dưới (shader lấy lại hoa văn nền ở chỗ đề can trong suốt). Pháp tuyến thật của đề can luôn là hướng lên.
  decal(cell, x, z, dx, dz, hl, hw, y0, y1, base, us = 0.8, vs = 0.8) {
    const px = -dz * hw, pz = dx * hw, lx = dx * hl, lz = dz * hl, s = this.n, L = 32 + cell, b = base / 127;
    this.v(x - lx - px, y0, z - lz - pz, -us, b, -vs, L); this.v(x + lx - px, y1, z + lz - pz, us, b, -vs, L);
    this.v(x + lx + px, y1, z + lz + pz, us, b, vs, L); this.v(x - lx + px, y0, z - lz + pz, -us, b, vs, L);
    this.idx.push(s, s + 2, s + 1, s, s + 3, s + 2);
  }
  pack() {
    const n = this.n, nrm = new Int8Array(n * 3); for (let i = 0; i < n * 3; i++) nrm[i] = Math.round(this.nrm[i] * 127);
    return { pos: new Float32Array(this.pos), nrm, lay: new Uint8Array(this.lay), idx: n > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx) };
  }
}

const ringArea = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p.X * q.Y - q.X * p.Y; } return a / 2; };

// Màu nước theo từng hồ, sông (căn của màu tuyến tính ×255): Hồ Gươm xanh lục đục, sông Hồng đỏ phù sa, hồ khác xanh xám.
function waterColor(ctx, w) {
  const name = ctx.world.names[w.name] || '';
  if (HO_GUOM.test(name)) return [70, 100, 58, 255];
  if (/Sông Hồng|sông Hồng|Red River/.test(name) || (w.bb[2] - w.bb[0]) * (w.bb[3] - w.bb[1]) > 2.5e6 && w.bb[2] > 600) return [112, 74, 48, 200];
  return [44, 70, 72, 255];
}

// ===== chất liệu lát hè theo khu (art bible 2.11) =====
// Quanh Hồ Gươm (60 m quanh mép nước): granite xám sáng lát lại năm 2020.
function lakeRing(ctx) {
  if (ctx._lakeRing !== undefined) return ctx._lakeRing;
  const lakes = ctx.water.filter((w) => HO_GUOM.test(ctx.world.names[w.name] || ''));
  if (!lakes.length) return (ctx._lakeRing = null);
  const paths = offset(lakes.flatMap((w) => w.paths), 600, false, 4), bb = [1e9, 1e9, -1e9, -1e9];
  for (const q of paths) for (const pt of q) { bb[0] = Math.min(bb[0], pt.X / 10); bb[1] = Math.min(bb[1], pt.Y / 10); bb[2] = Math.max(bb[2], pt.X / 10); bb[3] = Math.max(bb[3], pt.Y / 10); }
  return (ctx._lakeRing = { paths, bb });
}
// Ngoài vòng hồ, xét theo ô 32 m: trục phố chính ở phố cổ, khu phố Pháp, Ba Đình lát đá tự nhiên xanh xám; phố nhỏ và các khu
// khác còn gạch block đỏ tự chèn hoặc gạch terrazzo cũ (đổi kiểu theo từng mảng 128 m, như các đợt lát hè khác nhau ngoài đời).
function cellPaving(ctx, x, z) {
  const zn = zoneAt(x, z), h = hash2(Math.floor(x / 128), Math.floor(z / 128), 7);
  const rd = ctx.nearestRoad(x, z, 40, (r) => r.veh && r.kind <= K.residential), main = rd && rd.r.kind <= K.tertiary;
  if (zn === ZONE.old || zn === ZONE.french || zn === ZONE.badinh) return main || h < 0.55 ? LAYER.paving : h < 0.8 ? LAYER.terrazzo : LAYER.brick;
  if (zn === ZONE.bank) return h < 0.6 ? LAYER.brick : LAYER.terrazzo;
  return main ? (h < 0.4 ? LAYER.paving : LAYER.terrazzo) : h < 0.65 ? LAYER.brick : LAYER.terrazzo;
}
const cellMid = (v) => Math.floor(v / 32) * 32 + 16;
// Lớp lát hè tại điểm (x,z): dùng cho đề can nằm trên hè (phải trùng với lớp nền thật bên dưới).
function pavingAt(ctx, x, z) {
  const ring = lakeRing(ctx);
  if (ring && x > ring.bb[0] && x < ring.bb[2] && z > ring.bb[1] && z < ring.bb[3]) { const pt = { X: Math.round(x * 10), Y: Math.round(z * 10) }; let inside = 0; for (const q of ring.paths) if (CL.Clipper.PointInPolygon(pt, q)) inside += CL.Clipper.Orientation(q) ? 1 : -1; if (inside > 0) return LAYER.granite; }
  return cellPaving(ctx, cellMid(x), cellMid(z));
}
// Chia đa giác vỉa hè của một ô phố thành các phần theo chất liệu: [[lớp, paths], ...]
function pavingParts(ctx, paved, X0, Z0) {
  if (!paved.length) return [];
  const cells = new Map();
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const L = cellPaving(ctx, X0 + i * 32 + 16, Z0 + j * 32 + 16); let l = cells.get(L); if (!l) cells.set(L, (l = []));
    l.push(rectPath(Math.round((X0 + i * 32) * 10), Math.round((Z0 + j * 32) * 10), Math.round((X0 + i * 32 + 32) * 10), Math.round((Z0 + j * 32 + 32) * 10)));
  }
  let parts = [];
  if (cells.size === 1) parts.push([cells.keys().next().value, paved]);
  else for (const [L, rects] of cells) { const q = inter(paved, rects); if (q.length) parts.push([L, q]); }
  const ring = lakeRing(ctx);
  if (ring && ring.bb[0] < X0 + CS && ring.bb[2] > X0 && ring.bb[1] < Z0 + CS && ring.bb[3] > Z0) {
    const gran = inter(paved, ring.paths);
    if (gran.length) { parts = parts.map(([L, q]) => [L, diff(q, ring.paths)]).filter(([, q]) => q.length); parts.push([LAYER.granite, gran]); }
  }
  return parts;
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
    // Cầu Chương Dương, đoạn có dàn thép: trụ đứng đúng đầu mỗi nhịp dàn (CD_SPAN), một trụ rộng đỡ cả lòng giữa lẫn hai làn xe máy;
    // hai làn ngoài không có trụ riêng trên đoạn đó.
    const cd = !rail && ctx.cdMid && r.len > 500 && ctx.world.names[r.name] === 'Cầu Chương Dương' ? ctx.cdMid : null, cdS = (s) => (cd.rev ? r.len - s : s);
    const gap = rail ? 9 : r.len > 500 ? 36 : 24, pos = [];
    for (let s = gap / 2; s < r.len; s += gap) { if (cd) { if (cd.r === r) { if (cdS(s) > CD_TRUSS_S - gap / 2) continue; } else { alongAt(r, s, o); if (o[0] > cd.x0) continue; } } pos.push(s); }
    if (cd && cd.r === r) for (let q = CD_TRUSS_S; q <= r.len; q += CD_SPAN) pos.push(-cdS(q) - 1e-3); // dấu âm: trụ rộng ở đầu nhịp dàn
    for (let s of pos) {
      const wide = s < 0; if (wide) s = -s;
      const hl = rail ? 1.3 : wide ? 1.5 : 0.65, pw = wide ? 9.6 : Math.max(0.8, hw - (rail ? 0.25 : 0.9));
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

// Kích thước bó vỉa vát và rãnh biên (m): chân mặt vát nhô ra lòng đường BEV, rãnh bê tông rộng tới GUT tính từ mép hè.
const BEV = 0.1, GUT = 0.38, PAINT_Y = 0.016, DECAL_Y = 0.022;

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
  const inner = offset(block, -2); // viên bó vỉa rộng 20 cm tính cả mặt vát
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
  for (const [layer, part] of pavingParts(ctx, paved, X0, Z0)) gb.fill(toEx(part), CURB, layer);
  gb.fill(toEx(grass), CURB, LAYER.grass);
  if (pathP.length) gb.fill(toEx(pathP), CURB, LAYER.path);
  if (flower.length) gb.fill(toEx(flower), CURB + 0.12, LAYER.flower);
  if (dirt.length) gb.fill(toEx(dirt), CURB, LAYER.dirt);
  if (gravel.length) gb.fill(toEx(gravel), CURB + 0.01, LAYER.gravel);

  // ----- bó vỉa, rãnh biên và kè hồ: cạnh của khối phố không nằm trên mép ô -----
  // Bó vỉa vát (xe máy leo được, đúng kiểu phố Hà Nội): mặt nghiêng từ mép hè xuống chân cách 10 cm; sát chân là rãnh biên bê tông
  // sáng màu hơn mặt nhựa, cứ chừng 30 m có một cửa thu nước song gang. Va chạm không đổi: mép hè vẫn ở đúng cạnh khối phố.
  const shore = []; // đoạn bờ nước [ax,az,bx,bz] cho va chạm
  const onBorder = (a, b) => (a.X === b.X && (a.X === dX0 || a.X === dX1)) || (a.Y === b.Y && (a.Y === dZ0 || a.Y === dZ1));
  for (const e of toEx(block)) {
    const rings = [[e.outer, false], ...e.holes.map((h) => [h, true])];
    for (const [ring, isHole] of rings) {
      const s = ringArea(ring) > 0 ? 1 : -1, dir = isHole ? -s : s;
      let run = 12 + hash2(ring[0].X, ring[0].Y, 3) * 20; // quãng đã đi dọc bó vỉa kể từ cửa thu nước trước
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length]; if (onBorder(a, b)) continue;
        const ax = a.X / 10, az = a.Y / 10, bx = b.X / 10, bz = b.Y / 10, dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 0.02) continue;
        const nx = (dz / L) * dir, nz = (-dx / L) * dir;
        const wet = wat.length ? ctx.isWater((ax + bx) / 2 + nx * 0.3, (az + bz) / 2 + nz * 0.3) : null;
        if (wet) {
          shore.push(ax, az, bx, bz);
          if (HO_GUOM.test(ctx.world.names[wet.name] || '')) {
            // kè Hồ Gươm: cấu kiện bê tông đúc sẵn, thấp, không lan can: mặt kè hơi choãi, một bậc thềm sát mặt nước rồi mới tới chân kè
            const P = (o, y) => [[ax + nx * o, y, az + nz * o], [bx + nx * o, y, bz + nz * o]];
            const [a0, b0] = P(0, CURB), [a1, b1] = P(0.1, -0.2), [a2, b2] = P(0.52, -0.23), [a3, b3] = P(0.58, WATER_Y - 0.7);
            gb.quad(a1, b1, b0, a0, nx * 0.96, 0.27, nz * 0.96, LAYER.quay);
            gb.quad(a1, b1, b2, a2, 0, 1, 0, LAYER.quay);
            gb.quad(a3, b3, b2, a2, nx, 0, nz, LAYER.quay);
          } else gb.wall(ax, az, bx, bz, WATER_Y - 0.7, CURB, nx, nz, LAYER.stone);
          continue;
        }
        gb.quad([ax + nx * BEV, 0, az + nz * BEV], [bx + nx * BEV, 0, bz + nz * BEV], [bx, CURB, bz], [ax, CURB, az], nx * 0.85, 0.53, nz * 0.85, LAYER.curb);
        gb.quad([ax + nx * BEV, 0.004, az + nz * BEV], [bx + nx * BEV, 0.004, bz + nz * BEV], [bx + nx * GUT, 0.013, bz + nz * GUT], [ax + nx * GUT, 0.013, az + nz * GUT], 0, 1, 0, LAYER.gutter);
        run += L;
        if (run > 30 && L > 1.3) { // cửa thu nước: song gang 30×100 cm nằm trong rãnh
          run = hash2(a.X, a.Y, 5) * 10; const o = (BEV + GUT) / 2 + 0.01;
          gb.decal(DECAL.grate, (ax + bx) / 2 + nx * o, (az + bz) / 2 + nz * o, dx / L, dz / L, 0.5, 0.135, DECAL_Y, DECAL_Y, LAYER.gutter, 0.8, 0.26);
        }
      }
    }
  }

  // ----- mặt cầu nâng (lưới riêng để đổ bóng xuống đất) -----
  const db = new GB(X0, Z0), ramp = [];
  const deckTop = ctx.elevRoads.length || ctx.elevRails.length ? genDecks(ctx, db, X0, Z0, X1, Z1, ramp) : 0;

  // ----- vạch sơn theo QCVN 41 (art bible 2.4) -----
  // Tim đường hai chiều màu VÀNG rộng 15 cm (đứt nét 2 m hở 4 m; liền trên đường từ 4 làn; vàng đôi trên trục lớn); vạch chia làn
  // cùng chiều màu TRẮNG đứt nét 3 m hở 6 m. Phố cổ rộng dưới 8 m không kẻ vạch dọc, chỉ có vạch sang đường ở ngã tư.
  // Vạch sang đường: các vạch trắng rộng 40 cm cách nhau 60 cm, dài 3 đến 4 m. Nút lớn có vạch dừng 40 cm cách vạch sang đường
  // 2,4 m, chỉ kẻ trên nửa đường của chiều xe đi tới (đi bên phải), và mũi tên chỉ hướng trên từng làn.
  const inChunk = (x, z) => x >= X0 && x < X1 && z >= Z0 && z < Z1, zebras = [], o5 = [0, 0, 0, 0, 0];
  for (const r of roads) {
    if (!r.veh || r.kind > K.tertiary || r.w < 5.5 || r.len < 14) continue;
    const p = r.p, oneway = r.flags & F_ONEWAY ? (r.flags & F_REVERSE ? -1 : 1) : 0, el = !!r.elev, mb = el ? db : gb;
    const old = zoneAt(p[0], p[1]) === ZONE.old, lines = r.w >= 6.5 && !(old && r.w < 8);
    const n0 = ctx.nodes.get(ctx.nodeKey(p[0], p[1])), n1 = ctx.nodes.get(ctx.nodeKey(p[p.length - 2], p[p.length - 1]));
    const j0 = n0 && n0.major >= 3 && !el ? Math.max(5, n0.maxW * 0.55) : 0, j1 = n1 && n1.major >= 3 && !el ? Math.max(5, n1.maxW * 0.55) : 0;
    // vạch dọc: [lệch khỏi tim, lớp, đoạn kẻ, chu kỳ] (đoạn = chu kỳ nghĩa là vạch liền, chia khúc 4 m để từng khúc thuộc về một ô phố)
    const offs = [];
    if (lines && !oneway) {
      if (r.w >= 14) offs.push([-0.13, LAYER.yellow, 4, 4], [0.13, LAYER.yellow, 4, 4]); else if (r.w >= 10.5) offs.push([0, LAYER.yellow, 4, 4]); else offs.push([0, LAYER.yellow, 2, 6]);
      if (r.w >= 12.5) { const n = Math.max(2, Math.round(r.w / 7)); for (let l = 1; l < n; l++) for (const sd of [-1, 1]) offs.push([(sd * (r.w / 2) * l) / n, LAYER.white, 3, 9]); }
    } else if (lines) { const lanes = Math.max(1, Math.round(r.w / 3.4)); for (let l = 1; l < lanes; l++) offs.push([-r.w / 2 + (r.w * l) / lanes, LAYER.white, 3, 9]); }
    const s0 = j0 ? j0 + 9 : 0, s1 = r.len - (j1 ? j1 + 9 : 0);
    let d = 0;
    for (let i = 0; i < p.length - 2 && offs.length; i += 2) {
      const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], L = Math.hypot(bx - ax, bz - az); if (L < 0.01) continue;
      const dx = (bx - ax) / L, dz = (bz - az) / L;
      for (const [o, layer, dash, period] of offs) {
        // vạch đứt giữ nhịp theo quãng đường tính từ đầu đoạn; vạch liền thì chia khúc ngay từ đầu mỗi cạnh để không hở ở chỗ gấp khúc
        for (let s = dash >= period ? 0 : Math.ceil((d + 1e-6) / period) * period - d; s < L; s += period) {
          const dd = d + s, len = Math.min(dash, L - s); if (len < 0.3 || dd < s0 || dd + len > s1 + 0.01) continue;
          const h = len / 2, x = ax + dx * (s + h), z = az + dz * (s + h); if (!inChunk(x, z)) continue;
          const y0 = el ? roadY(r, dd) + 0.035 : PAINT_Y, y1 = el ? roadY(r, dd + 2 * h) + 0.035 : PAINT_Y;
          mb.slopeQuad(x - dz * o, z + dx * o, dx, dz, h, 0.075, y0, y1, layer);
        }
      }
      d += L;
    }
    if (el) continue;
    // hai đầu đoạn: vạch sang đường, vạch dừng, mũi tên
    for (const [jr, end, node] of [[j0, 0, n0], [j1, 1, n1]]) {
      if (!jr || r.len < 2 * jr + 16) continue;
      const zl = r.w >= 12 ? 2 : 1.6, at = end ? r.len - jr - 1.2 - zl : jr + 1.2 + zl; // tâm vạch sang đường
      alongAt(r, at, o5); const x = o5[0], z = o5[1], dx = o5[2], dz = o5[3]; if (!inChunk(x, z)) continue;
      // nút giao phức tạp (vòng xoay, nhiều nhánh sát nhau): nếu có lòng đường khác cắt qua chỗ định kẻ vạch, hoặc đã có một
      // vạch qua đường khác trong vòng 7 m, thì thôi không kẻ, kẻo các vạch chồng chéo lên nhau
      const other = ctx.nearestRoad(x, z, r.w / 2 + 6, (q) => q !== r && q.veh && !q.skip && !q.elev);
      if (other && other.d < other.r.w / 2 + 1.6) continue;
      if (zebras.some((q) => (q[0] - x) ** 2 + (q[1] - z) ** 2 < 49)) continue; zebras.push([x, z]);
      const nS = Math.max(2, Math.floor(r.w - 0.9) + 1);
      for (let k = 0; k < nS; k++) { const o = k - (nS - 1) / 2; gb.flatQuad(x - dz * o, z + dx * o, dx, dz, zl, 0.2, PAINT_Y, LAYER.white); }
      // vạch dừng và mũi tên: chỉ ở nút lớn, trên phần đường của chiều xe đang đi tới nút
      const toward = end ? 1 : -1; // chiều xe đi tới nút, tính theo chiều đoạn
      if (node.maxW < 9 || r.w < 7 || (oneway && oneway !== toward)) continue;
      const sAt = at - toward * (zl + 2.4 + 0.2); alongAt(r, sAt, o5);
      const half = oneway ? r.w / 2 - 0.25 : r.w / 4 - 0.12, oc = oneway ? 0 : (toward * r.w) / 4;
      if (sAt > 4 && sAt < r.len - 4) gb.flatQuad(o5[0] - o5[3] * oc, o5[1] + o5[2] * oc, o5[2], o5[3], 0.2, half, PAINT_Y, LAYER.white);
      if (r.w < 10 || r.len < 2 * jr + 50) continue;
      const aAt = sAt - toward * 7.5; alongAt(r, aAt, o5);
      const nl = oneway ? Math.max(1, Math.round(r.w / 3.4)) : Math.max(1, Math.round(r.w / 7)), wl = (oneway ? r.w : r.w / 2) / nl;
      for (let l = 0; l < nl; l++) { // làn tính từ tim đường ra mép phải của chiều xe
        const o = oneway ? toward * (-r.w / 2 + wl * (l + 0.5)) : toward * wl * (l + 0.5);
        gb.decal(l === nl - 1 && nl > 1 ? DECAL.arrowRight : DECAL.arrow, o5[0] - o5[3] * o, o5[1] + o5[2] * o, o5[2] * toward, o5[3] * toward, 1.6, 1.2, DECAL_Y, DECAL_Y, LAYER.asphalt, 0.8, 0.6);
      }
    }
  }

  // ----- nắp hố ga, miếng vá mặt đường, nắp bể cáp trên hè (art bible 2.11) -----
  // Rải theo quãng dọc từng đoạn đường bằng số băm của đoạn (tất định). Đề can trên lòng đường lấy nền nhựa; trên hè lấy đúng lớp lát ở đó.
  const nearRoad = (x, z, pad) => { const q = ctx.nearestRoad(x, z, 16, (g) => (g.veh || g.kind === K.pedestrian) && !g.elev); return !!q && q.d < q.r.w / 2 + pad; };
  const onAsphalt = (x, z, pad) => nearRoad(x, z, -pad);
  const freePave = (x, z, pad) => !nearRoad(x, z, pad) && !ctx.buildingAt(x, z) && !ctx.isGreen(x, z) && !ctx.isWater(x, z);
  for (const r of roads) {
    if (!r.veh || r.elev || r.bridge || r.kind > K.service || r.w < 3.4 || r.len < 12) continue;
    const seed = r.i * 31 + 7, H = (k) => hash2(seed, k, 11);
    let k = 0;
    for (let s = 5 + H(0) * 12; s < r.len - 5; k++) {
      const t = H(k * 5 + 1), side = H(k * 5 + 2) < 0.5 ? -1 : 1; alongAt(r, s, o5);
      const dx = o5[2], dz = o5[3], at = (o) => [o5[0] - dz * o, o5[1] + dx * o];
      if (t < 0.34) { // nắp hố ga: gang tròn Ø 65 cm, đôi khi là nắp vuông hai cánh, nằm lệch tim đường
        const o = side * Math.min(r.w / 2 - 0.9, r.w * (0.12 + H(k * 5 + 3) * 0.2)), [x, z] = at(o);
        if (inChunk(x, z) && onAsphalt(x, z, 0.6)) { if (H(k * 5 + 4) < 0.72) gb.decal(DECAL.manhole, x, z, dx, dz, 0.33, 0.33, DECAL_Y, DECAL_Y, LAYER.asphalt); else gb.decal(DECAL.cover, x, z, dx, dz, 0.4, 0.4, DECAL_Y, DECAL_Y, LAYER.asphalt); }
      } else if (t < 0.8) { // miếng vá: dải đào rãnh cáp chạy dọc hoặc cắt ngang đường, hoặc mảng vá ổ gà
        const across = H(k * 5 + 3) < 0.22 && r.w < 9, hl = across ? r.w / 2 - 0.5 : 1 + H(k * 5 + 4) * 3.2, hw = across ? 0.35 + H(k * 5 + 4) * 0.3 : 0.4 + H(k * 5 + 3) * 0.7;
        const o = across ? 0 : side * Math.max(0, Math.min(r.w / 2 - hw - 0.55, r.w * (0.1 + H(k * 5 + 2) * 0.28))), [x, z] = at(o);
        if (inChunk(x, z) && (across ? onAsphalt(x, z, 0.3) : onAsphalt(x - dx * hl, z - dz * hl, hw + 0.5) && onAsphalt(x + dx * hl, z + dz * hl, hw + 0.5)))
          gb.decal(H(k * 5 + 4) < 0.5 ? DECAL.patchNew : DECAL.patchOld, x, z, across ? -dz : dx, across ? dx : dz, hl, hw, DECAL_Y - 0.004, DECAL_Y - 0.004, LAYER.asphalt, 0.86, 0.86);
      } else if (t < 0.9) { // vệt dầu máy loang sát mép đường, chỗ xe hay dừng đỗ
        const hs = 0.5 + H(k * 5 + 3) * 0.6, [x, z] = at(side * (r.w / 2 - 0.5 - hs));
        if (inChunk(x, z) && onAsphalt(x, z, hs + 0.3)) gb.decal(DECAL.oil, x, z, dx, dz, hs * 1.3, hs, DECAL_Y - 0.005, DECAL_Y - 0.005, LAYER.asphalt, 0.8, 0.8);
      } else if (r.kind <= K.residential) { // nắp bể cáp viễn thông chữ nhật trên vỉa hè, sát bó vỉa
        const [x, z] = at(side * (r.w / 2 + 0.85));
        if (inChunk(x, z) && freePave(x, z, 0.7) && zoneAt(x, z) !== ZONE.bank)
          gb.decal(DECAL.cable, x, z, dx, dz, 0.55, 0.55, CURB + 0.008, CURB + 0.008, pavingAt(ctx, x, z), 0.8, 0.8);
      }
      s += 14 + H(k * 5 + 5) * 26;
    }
  }

  // ----- ô đỗ xe kẻ sơn trắng (art bible 2.5) -----
  // Xe máy: trên vỉa hè, một dải sâu 2 m tính từ bó vỉa (xe dựng một hàng vuông góc với bó vỉa), chỉ kẻ khi hè rộng từ 3,5 m để còn
  // lối đi bộ 1,5 m; phố cổ và khu phố Pháp (phường Hoàn Kiếm, Cửa Nam) có nhiều nhất. Ô tô: trên lòng đường rộng, dọc bó vỉa,
  // mỗi ô 2,2 × 5,5 m. Khu trang nghiêm ở Ba Đình không có.
  for (const r of roads) {
    if (!r.veh || r.elev || r.bridge || r.kind > K.residential || r.w < 5.5 || r.len < 44) continue;
    const zn = zoneAt(r.p[0], r.p[1]); if (zn === ZONE.bank || isSolemn(r.p[0], r.p[1])) continue;
    const pBike = zn === ZONE.old || zn === ZONE.french ? 0.5 : zn === ZONE.city ? 0.28 : 0.1;
    for (const side of [-1, 1]) for (let s = 14, k = 0; s + 12 < r.len - 14; s += 18, k++) {
      const h = hash2(r.i * 2 + (side > 0 ? 1 : 0), k, 21), pt = (ss, o) => { alongAt(r, ss, o5); return [o5[0] - o5[3] * o * side, o5[1] + o5[2] * o * side, o5[2], o5[3]]; };
      if (h < pBike) {
        const e = r.w / 2; let ok = true;
        for (const ss of [s, s + 6, s + 12]) { const a = pt(ss, e + 2), b = pt(ss, e + 3.5); if (!freePave(a[0], a[1], 1.2) || !freePave(b[0], b[1], 2.6)) { ok = false; break; } }
        if (!ok) continue;
        const paint = (q, hl, hw, across) => { if (inChunk(q[0], q[1])) gb.decal(DECAL.paint, q[0], q[1], across ? -q[3] : q[2], across ? q[2] : q[3], hl, hw, CURB + 0.008, CURB + 0.008, pavingAt(ctx, q[0], q[1]), 0.9, 0.9); };
        for (let ss = s + 2; ss < s + 12; ss += 4) paint(pt(ss, e + 2), 2, 0.05, false);
        for (const ss of [s, s + 12]) paint(pt(ss, e + 1.12), 0.93, 0.05, true);
      } else if (h > 0.88 && r.w >= 10 && r.kind <= K.tertiary) {
        const e = r.w / 2, a = pt(s + 5.5, e - 2.2); if (!onAsphalt(a[0], a[1], 1.9)) continue;
        for (let ss = s + 2.75; ss < s + 11; ss += 5.5) { const q = pt(ss, e - 2.2); if (inChunk(q[0], q[1])) gb.flatQuad(q[0], q[1], q[2], q[3], 2.75, 0.05, PAINT_Y, LAYER.white); }
        for (const ss of [s, s + 5.5, s + 11]) { const q = pt(ss, e - 1.31); if (inChunk(q[0], q[1])) gb.flatQuad(q[0], q[1], -q[3], q[2], 0.89, 0.05, PAINT_Y, LAYER.white); }
      }
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
