// Đồ vật tĩnh của một ô phố, gộp sẵn thành lưới: bản gần (đủ chi tiết) và bản xa (cây một khối, bỏ đồ nhỏ).
import { G } from '../../core/geo.js';
import { hash, hash2, pointInRing } from '../../core/util.js';
import { CS, CURB, K, ZONE, zoneAt, roadY, alongAt } from '../data.js';
import { tree, streetLamp, parkLamp } from '../../models/street.js';
import { decorate } from './decor.js';
import { furnish } from './furniture.js';
import { WHITE_UV } from '../signs.js';
import { plateLayout } from '../streetnames.js';
import { treePit } from './pits.js';

// Loài cây theo từng phố có tên (docs/18, mục 6): [mẫu tên phố, [[loài, tỉ lệ cộng dồn], ...]].
// Phan Đình Phùng xử lý riêng trong kindFor (sấu ở đoạn tây, nhội từ Cửa Bắc về Hàng Đậu).
const STREET_TREES = [
  [/Hoàng Diệu/, [['xacuco', 1]]],
  [/Trần Phú|Lê Hồng Phong/, [['sau', 1]]],
  [/Điện Biên Phủ/, [['xacu', 0.5], ['sau', 1]]],
  [/Hùng Vương/, [['xacu', 0.6], ['sau', 1]]],
  [/Trần Hưng Đạo|Hai Bà Trưng/, [['sau', 0.6], ['nhoi', 1]]],
  [/Lý Thường Kiệt/, [['sau', 0.5], ['comnguoi', 1]]],
  [/Bà Triệu/, [['sau', 0.65], ['nhoi', 1]]], // chẹo chưa có mô hình riêng: dùng nhội (cùng dáng cao, tán tròn)
  [/Quán Sứ/, [['sau', 0.6], ['banglang', 1]]],
  [/Nguyễn Du/, [['hoasua', 0.9], ['sau', 1]]],
  [/Thanh Niên/, [['phuong', 0.45], ['banglang', 0.8], ['lieu', 1]]],
  [/Quán Thánh/, [['sau', 0.6], ['hoasua', 1]]],
];
// Các phố bị bão Yagi (9/2024) quật đổ nhiều cây: hàng cổ thụ có chỗ trống, xen cây non có cọc chống.
const YAGI = /Phan Đình Phùng|Hoàng Diệu|Điện Biên Phủ|Đinh Tiên Hoàng|Lê Thái Tổ|Thanh Niên|Cửa Bắc|Hàng Bông/;
const CUA_BAC_X = -880; // nút Phan Đình Phùng - Cửa Bắc

// opt.mark(kind, x, z, dx, dz, len): công cụ soi vị trí (ngoài game) nhận dấu của từng món đồ đạc; trong game không dùng.
export function genProps(ctx, cx, cz, bld, opt = {}) {
  const W = ctx.world, B = W.bounds, X0 = B.x0 + cx * CS, Z0 = B.z0 + cz * CS, X1 = X0 + CS, Z1 = Z0 + CS;
  const near = new G(), far = new G(), leaf = new G(), plate = new G(), extra = {};
  near.u0 = far.u0 = WHITE_UV[0]; near.v0 = far.v0 = WHITE_UV[1];
  { const b = plateLayout(W).blank; plate.u0 = b[0]; plate.v0 = b[1]; } // lưới biển tên phố, đèn tín hiệu: bảng chữ riêng (streetnames.js)
  const lamps = []; // [x,y,z, bán kính vệt sáng] toạ độ thế giới
  const occ = [], treeList = [], lampPts = []; // chỗ đã có vật [x, z, bán kính]; cây [x, z, loài, hạt giống]; cột đèn đường
  const inChunk = (x, z) => x >= X0 && x < X1 && z >= Z0 && z < Z1;
  const free = (x, z) => !ctx.buildingAt(x, z) && !ctx.isWater(x, z);
  const onRoad = (x, z, pad = 0.4) => { const r = ctx.nearestRoad(x, z, 14, (q) => q.veh || q.kind === K.pedestrian); return r && r.d < r.r.w / 2 + pad; };

  // ----- cây -----
  const placed = [];
  // lime: gốc quét vôi trắng (cây dọc phố gần như cây nào cũng quét, cây trong công viên thì ít)
  const addTree = (x, z, kind, seed, lime = hash(seed, 12) < 0.2) => {
    for (const p of placed) if ((p[0] - x) ** 2 + (p[1] - z) ** 2 < 16) return;
    placed.push([x, z]); occ.push([x, z, 0.55]); treeList.push([x, z, kind, seed]);
    treePit(near, ctx, x, z, X0, Z0, seed); // ô cây trên vỉa hè (gen/pits.js)
    // ô nào quá nhiều cây (rừng, công viên) thì từ cây thứ 56 dùng luôn bản một khối để giữ số tam giác
    if (placed.length <= 56) tree(near, x - X0, z - Z0, seed, kind, 0, CURB, leaf, lime ? 1 : 0); else tree(near, x - X0, z - Z0, seed, kind, 1, CURB, null, lime ? 1 : 0);
    tree(far, x - X0, z - Z0, seed, kind, 1, CURB, null, lime ? 1 : 0);
  };
  // name: tên con phố mà cây đứng dọc theo (nếu có). Phố có trong bảng thì theo bảng, còn lại theo khu.
  const kindFor = (x, z, seed, name) => {
    const zn = zoneAt(x, z), r = hash(seed, 5);
    if (name) {
      if (/Phan Đình Phùng/.test(name)) return x < CUA_BAC_X ? 'sau' : 'nhoi';
      for (const [rx, mix] of STREET_TREES) if (rx.test(name)) { for (const [k, p] of mix) if (r < p) return k; }
    }
    const nearLake = ctx.isWater(x + 9, z) || ctx.isWater(x - 9, z) || ctx.isWater(x, z + 9) || ctx.isWater(x, z - 9);
    // quanh hồ: liễu, lộc vừng nghiêng ra mặt nước, phượng, sấu, bằng lăng, đa
    if (nearLake) return r < 0.3 ? 'lieu' : r < 0.46 ? 'locvung' : r < 0.6 ? 'phuong' : r < 0.73 ? 'sau' : r < 0.85 ? 'banglang' : r < 0.92 ? 'da' : 'xacu';
    if (zn === ZONE.french || zn === ZONE.badinh) return r < 0.5 ? 'sau' : r < 0.8 ? 'xacu' : r < 0.9 ? 'hoasua' : 'banglang';
    // phố cổ: cây thưa và nhỏ (bàng, sữa, bằng lăng), thỉnh thoảng một gốc đa, si mọc sát tường
    if (zn === ZONE.old) return r < 0.36 ? 'bang' : r < 0.62 ? 'banglang' : r < 0.76 ? 'sau' : r < 0.9 ? 'hoasua' : 'da';
    return r < 0.3 ? 'xacu' : r < 0.55 ? 'sau' : r < 0.75 ? 'banglang' : r < 0.9 ? 'hoasua' : 'phuong';
  };
  for (const i of ctx.treeIdx.get(cx * 1000 + cz) || []) {
    const x = W.trees[i], z = W.trees[i + 1], seed = (i * 2654435761) | 0;
    if (!free(x, z) || onRoad(x, z, 0.2)) continue;
    const rd = ctx.nearestRoad(x, z, 12, (q) => q.veh), street = !!rd && rd.d < rd.r.w / 2 + 6; // cây vỉa hè hay cây trong sân, công viên
    addTree(x, z, kindFor(x, z, seed, street ? W.names[rd.r.name] : null), seed, hash(seed, 12) < (street ? 0.85 : 0.2));
  }
  const roads = [...ctx.roadGrid.collect(X0 - 6, Z0 - 6, X1 + 6, Z1 + 6)].filter((r) => !r.skip && !r.bridge);
  for (const r of roads) {
    if (!r.veh || r.kind > K.residential || r.w < 5.5) continue;
    const p = r.p, zn = zoneAt(p[0], p[1]), name = W.names[r.name] || null, yagi = !!name && YAGI.test(name);
    const leafy = zn === ZONE.french || zn === ZONE.badinh;
    if (r.kind === K.residential && !leafy && zn !== ZONE.old) continue;
    const gap = zn === ZONE.old ? 19 : leafy ? 9.5 : 12, prob = zn === ZONE.old ? 0.45 : zn === ZONE.bank ? 0.3 : 0.85;
    const pdp = !!name && /Phan Đình Phùng/.test(name);
    let d = 0;
    for (let i = 0; i < p.length - 2; i += 2) {
      const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], L = Math.hypot(bx - ax, bz - az); if (L < 0.01) continue;
      const dx = (bx - ax) / L, dz = (bz - az) / L;
      for (let s = Math.ceil((d + 1e-6) / gap) * gap - d; s < L; s += gap) {
        const dd = d + s; if (dd < 9 || dd > r.len - 9) continue;
        for (const side of [-1, 1]) {
          const seed = (r.i * 7919 + Math.round(dd) * 31 + side) | 0;
          if (hash(seed, 1) > prob) continue;
          const o = (r.w / 2 + 1.25) * side, x = ax + dx * s - dz * o + (hash(seed, 2) - 0.5) * 1.5 * dx, z = az + dz * s + dx * o + (hash(seed, 2) - 0.5) * 1.5 * dz;
          // Phan Đình Phùng đoạn tây: vỉa hè phía nam có hai hàng sấu
          if (pdp && dx * side > 0.3) { const o2 = o + 3.6 * side, x2 = ax + dx * (s + gap / 2) - dz * o2, z2 = az + dz * (s + gap / 2) + dx * o2; if (x2 < CUA_BAC_X && inChunk(x2, z2) && free(x2, z2) && !onRoad(x2, z2) && !ctx.buildingAt(x2 - dz * side * 1.2, z2 + dx * side * 1.2)) addTree(x2, z2, 'sau', seed ^ 0x5bd1, true); }
          if (!inChunk(x, z) || !free(x, z) || onRoad(x, z)) continue;
          let kind = kindFor(x, z, r.i * 13 + (leafy && !name ? 0 : Math.round(dd / 40)), name);
          if (yagi) { const h = hash(seed, 6); if (h < 0.1) continue; if (h < 0.24) kind = 'non'; } // chỗ cây đổ còn trống, hoặc cây non trồng dặm
          addTree(x, z, kind, seed, hash(seed, 12) < 0.88);
        }
      }
      d += L;
    }
  }
  // rừng cây, công viên: rải ngẫu nhiên có hạt giống
  for (const g of ctx.greenGrid.collect(X0, Z0, X1, Z1)) {
    if (g.k !== 1 && g.k !== 3) continue;
    const step = g.k === 1 ? 7.5 : 15;
    for (let x = Math.ceil(Math.max(g.bb[0], X0) / step) * step; x < Math.min(g.bb[2], X1); x += step) for (let z = Math.ceil(Math.max(g.bb[1], Z0) / step) * step; z < Math.min(g.bb[3], Z1); z += step) {
      const seed = (Math.round(x) * 73856093) ^ (Math.round(z) * 19349663);
      const px = x + (hash(seed, 1) - 0.5) * step * 0.8, pz = z + (hash(seed, 2) - 0.5) * step * 0.8;
      if (hash(seed, 3) > (g.k === 1 ? 0.8 : 0.5) || !inChunk(px, pz)) continue;
      if (!pointInRing(px, pz, g.p) || g.holes.some((h) => pointInRing(px, pz, h)) || !free(px, pz)) continue;
      if (ctx.nearestRoad(px, pz, 3)) continue;
      addTree(px, pz, kindFor(px, pz, seed, null), seed);
    }
  }

  // ----- đèn đường -----
  for (const r of roads) {
    if (!r.veh || r.kind > K.residential || r.len < 20) continue;
    const major = r.kind <= K.tertiary, gap = major ? 34 : 44, p = r.p;
    let d = 0;
    for (let i = 0; i < p.length - 2; i += 2) {
      const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], L = Math.hypot(bx - ax, bz - az); if (L < 0.01) continue;
      const dx = (bx - ax) / L, dz = (bz - az) / L;
      // cột đèn ở các mốc gap/2, 3·gap/2, ... tính theo chiều dài CỘNG DỒN của cả con đường. (Bản trước lấy "bội số gap kế tiếp
      // của đoạn thẳng này rồi cộng nửa gap" nên mốc nào rơi vào một đoạn thẳng ngắn hơn nửa gap là bị bỏ: đường nhiều khúc gấp
      // chỉ còn một phần ba số đèn, cả dãy phố tối om ban đêm.)
      for (let s = Math.ceil((d - gap / 2 - 1e-6) / gap) * gap + gap / 2 - d; s < L; s += gap) {
        const k = Math.floor((d + s) / gap), side = major ? (k % 2 ? 1 : -1) : 1;
        const o = (r.w / 2 + 0.55) * side, x = ax + dx * s - dz * o, z = az + dz * s + dx * o;
        if (!inChunk(x, z) || !free(x, z)) continue;
        // cần đèn vươn ra lòng đường: hướng từ cột về tim đường là side·(dz, -dx)
        const head = streetLamp(near, x - X0, z - Z0, Math.atan2(dx * side, dz * side), major, CURB);
        occ.push([x, z, 0.3]); lampPts.push([x, z, dx, dz, major ? 1 : 0, r, side]); if (opt.mark) opt.mark('lamp', x, z, major ? 1 : 0);
        lamps.push(x + head[0], head[1] + CURB, z + head[2], major ? 13 : 9);
        far.push().move(x - X0, CURB, z - Z0).rgb(0.2, 0.22, 0.23).cyl(0, 0, 0, 0.1, 0.06, major ? 8.6 : 5.6, 4, false);
        far.rgb(1, 0.86, 0.6).glow(1).cube(head[0], head[1] + 0.12, head[2], 0.5, 0.12, 0.3).glow(0).pop();
      }
      d += L;
    }
  }
  // đèn trên cầu nâng (cầu Chương Dương, cầu vượt): cột đứng trên lan can mép ngoài, cách nhau 40 m
  for (const r of ctx.elevRoads) {
    if (r.w < 8 || r.len < 30 || r.bb[0] > X1 || r.bb[2] < X0 || r.bb[1] > Z1 || r.bb[3] < Z0) continue;
    const o = [0, 0, 0, 0, 0];
    for (let s = 20; s < r.len; s += 40) {
      const y = roadY(r, s); if (y < 1.5) continue;
      alongAt(r, s, o);
      for (const side of [-1, 1]) {
        const e = (r.w / 2 - 0.13) * side, x = o[0] - o[3] * e, z = o[1] + o[2] * e; if (!inChunk(x, z)) continue;
        if (ctx.deckAt(o[0] - o[3] * (e + 0.6 * side), o[1] + o[2] * (e + 0.6 * side), 0, r) > y - 1.5) continue; // mép này liền với mặt cầu khác
        const head = streetLamp(near, x - X0, z - Z0, Math.atan2(o[2] * side, o[3] * side), true, y + 0.85);
        lamps.push(x + head[0], -y, z + head[2], 13); // cao độ âm: vệt sáng nằm trên mặt cầu ở độ cao y
        far.push().move(x - X0, y + 0.85, z - Z0).rgb(0.2, 0.22, 0.23).cyl(0, 0, 0, 0.1, 0.06, 8.6, 4, false);
        far.rgb(1, 0.86, 0.6).glow(1).cube(head[0], head[1] + 0.12, head[2], 0.5, 0.12, 0.3).glow(0).pop();
      }
    }
  }
  // đèn vườn dọc lối dạo trong công viên và quanh hồ
  for (const r of roads) {
    if (r.veh || r.kind === K.steps || r.len < 12) continue;
    const p = r.p; let d = 0;
    for (let i = 0; i < p.length - 2; i += 2) {
      const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], L = Math.hypot(bx - ax, bz - az); if (L < 0.01) continue;
      const dx = (bx - ax) / L, dz = (bz - az) / L;
      for (let s = Math.ceil((d - 13 - 1e-6) / 26) * 26 + 13 - d; s < L; s += 26) { // mốc 13, 39, 65 m... theo chiều dài cộng dồn (như đèn đường)
        const o = r.w / 2 + 0.5, x = ax + dx * s - dz * o, z = az + dz * s + dx * o;
        if (!inChunk(x, z) || !free(x, z) || !ctx.isGreen(x, z) || onRoad(x, z)) continue;
        parkLamp(near, x - X0, z - Z0, CURB); lamps.push(x, 3.6, z, 7);
        far.push().move(x - X0, CURB, z - Z0).rgb(1, 0.93, 0.78).glow(1).cube(0, 3.3, 0, 0.4, 0.4, 0.4).glow(0).pop();
      }
      d += L;
    }
  }

  const env = { near, far, lamps, X0, Z0, X1, Z1, cx, cz, inChunk, free, onRoad, roads, bld, extra, nBikes: 0 };
  decorate(ctx, env);
  furnish(ctx, { ...env, plate, occ, treeList, lampPts, mark: opt.mark });
  return { near: near.pack(), far: far.pack(), leaf: leaf.pack(), plate: plate.pack(), lamps: new Float32Array(lamps), extra };
}
export { hash2 };
