// Mô phỏng dòng xe Hà Nội 2026 trên đồ thị đường thật. Không phụ thuộc three.js: chạy được trong Node để kiểm tra bằng số
// (tools/traffic_check.mjs). Phần vẽ nằm ở actors/fleet.js, lớp nối hai bên là actors/traffic.js.
// Cơ cấu xe theo docs/18 mục 4: phố cổ xe máy 80-85%, ô tô kể cả taxi 8-12%, xe đạp + xích lô + xe điện du lịch 4-6%, buýt dưới 1%;
// khu phố Pháp và Ba Đình xe máy 70-75%, ô tô 20-25%. Khoảng 6/10 taxi là xe điện xanh ngọc lam, biển vàng.
// Xe đi bên phải, không giữ làn, lách nhau, chạy 15-30 km/h trong phố cổ, tự vòng ra sau lưng người đang bước qua đường.
import { clamp, damp, dampAngle, segDist2 } from '../core/util.js';
import { K, F_ONEWAY, F_REVERSE, F_NOCAR, F_NOBIKE, roadY, ZONE, zoneAt } from '../world/data.js';
import { junctionsOf, signalGroup, signalState, SIGNAL } from '../world/junctions.js';
import { walkOn, isWalkRoad } from '../world/walkzone.js';
import { collide1D, bikeMass } from './physics.js';

// chỗ tối thiểu sau vạch dừng (m) để một cạnh được coi là chứa được hàng xe chờ đèn
const QUEUE = 4;   // chỗ cho vài xe xếp hàng sau vạch dừng (m): trong khoảng này không sinh xe mới
const SEE = 18;    // xe nhận ra vạch dừng từ khi còn cách nó chừng này (m), kể cả khi vạch nằm ở cạnh phía trước
export const VT = { wave: 0, scooter: 1, cub: 2, sedan: 3, hatch: 4, bus: 5, bicycle: 6, cyclo: 7, ecart: 8 };
// r: nửa bề ngang (m); hl: nửa chiều dài; vmul: hệ số so với tốc độ của phố; vmax: tốc độ riêng của xe thô sơ (m/s); mass: kg (kể cả người);
// cls: 0 xe máy, 1 ô tô, 2 xe buýt, 3 xe chậm (xe đạp, xích lô, xe điện du lịch)
export const TYPES = [
  { r: 0.45, hl: 0.95, vmul: 1, mass: 165, cls: 0 }, { r: 0.48, hl: 0.95, vmul: 1.02, mass: 170, cls: 0 }, { r: 0.45, hl: 0.9, vmul: 0.8, mass: 150, cls: 0 },
  { r: 0.95, hl: 2.2, vmul: 0.92, mass: 1350, cls: 1 }, { r: 0.95, hl: 2.0, vmul: 0.92, mass: 1400, cls: 1 }, { r: 1.3, hl: 5.3, vmul: 0.75, mass: 11000, cls: 2 },
  { r: 0.38, hl: 0.9, vmax: 3.6, mass: 85, cls: 3 }, { r: 0.6, hl: 1.3, vmax: 3.0, mass: 240, cls: 3 }, { r: 0.8, hl: 2.25, vmax: 4.0, mass: 1300, cls: 3 },
];
// nhóm xe có cùng luật được đi trên cạnh nào (fit): xe máy, ô tô, buýt, xe đạp, xích lô, xe điện du lịch; FITK: loại xe → nhóm
const FIT_GROUPS = [0, 3, 5, 6, 7, 8], FITK = [0, 0, 0, 1, 1, 2, 3, 4, 5];
// bit bộ phận hiện/ẩn theo từng xe (khớp mã bộ phận trong actors/fleet.js) và bit kiểu áo
export const BIT = { box: 1, mask: 2, maskDark: 4, hood: 8, exhaust: 16, sleeve: 256, roof: 1, basket: 1, tray: 2, flowers: 4, fruit: 8, nonla: 16, cap: 32, guest: 1, row2: 1, row3: 2 };

// ----- bảng màu (tuyến tính) -----
// xe máy: đen 30%, trắng 20%, đỏ 15%, xám bạc 12%, xanh dương và xanh xám 10%, còn lại nâu, vàng cát, xanh ngọc
const BIKE_COLORS = [[0.02, 0.02, 0.025, 30], [0.72, 0.72, 0.7, 20], [0.5, 0.03, 0.03, 15], [0.42, 0.43, 0.45, 12], [0.05, 0.12, 0.4, 5], [0.2, 0.27, 0.34, 5], [0.22, 0.12, 0.06, 4], [0.62, 0.52, 0.34, 4], [0.02, 0.28, 0.3, 3], [0.45, 0.08, 0.2, 2]];
// áo khoác cuối thu: tối màu là chính, xen vài màu tươi
const JACKETS = [[0.03, 0.03, 0.04], [0.03, 0.03, 0.04], [0.04, 0.07, 0.2], [0.16, 0.17, 0.19], [0.3, 0.31, 0.33], [0.07, 0.16, 0.1], [0.3, 0.05, 0.07], [0.5, 0.42, 0.3], [0.8, 0.8, 0.78], [0.2, 0.35, 0.6], [0.7, 0.3, 0.42], [0.6, 0.08, 0.08], [0.14, 0.24, 0.42], [0.75, 0.6, 0.12]];
// áo chống nắng: màu phấn, hoa nhí
const SUNCOATS = [[0.85, 0.62, 0.7], [0.62, 0.72, 0.85], [0.7, 0.85, 0.74], [0.85, 0.8, 0.62], [0.72, 0.64, 0.84], [0.62, 0.62, 0.66]];
const HELMETS = [[0.8, 0.8, 0.78], [0.03, 0.03, 0.035], [0.6, 0.05, 0.05], [0.06, 0.14, 0.5], [0.85, 0.45, 0.55], [0.85, 0.65, 0.08], [0.35, 0.36, 0.38], [0.4, 0.62, 0.8], [0.22, 0.12, 0.06], [0.1, 0.35, 0.18], [0.8, 0.8, 0.78], [0.03, 0.03, 0.035]];
// xe ôm, giao hàng công nghệ: bốn màu áo và mũ chủ đạo, không logo (xanh lá, vàng, xanh ngọc lam đi xe điện cùng màu, cam giao đồ ăn)
const HAIL = [{ c: [0.02, 0.5, 0.2], w: 40, box: 0.25, guest: 0.45 }, { c: [0.92, 0.7, 0.03], w: 20, box: 0.3, guest: 0.4 }, { c: [0.02, 0.56, 0.52], w: 20, box: 0.1, guest: 0.5, ev: true }, { c: [0.95, 0.36, 0.03], w: 20, box: 1, guest: 0 }];
const CAR_COLORS = [[0.8, 0.8, 0.79], [0.8, 0.8, 0.79], [0.03, 0.03, 0.035], [0.03, 0.03, 0.035], [0.42, 0.43, 0.45], [0.62, 0.63, 0.65], [0.45, 0.04, 0.05], [0.05, 0.1, 0.3], [0.3, 0.2, 0.12]];
const TAXI_EV = [0.005, 0.5, 0.45], TAXI_GAS = [[0.01, 0.27, 0.075], [0.82, 0.82, 0.8], [0.6, 0.61, 0.63]];
const PLATE = { white: [1, 1, 1], yellow: [1.05, 0.62, 0.02], blue: [0.05, 0.16, 0.62], red: [0.75, 0.04, 0.04] };
// xe buýt theo nhóm tuyến: [váy xe, dải màu]: đỏ pha vàng, xanh dương đậm, xanh lá (buýt điện, xe nhỏ), cam (tuyến sân bay)
const BUS_LIVERY = [[[0.76, 0.38, 0.01], [0.55, 0.02, 0.02]], [[0.76, 0.38, 0.01], [0.55, 0.02, 0.02]], [[0.03, 0.1, 0.42], [0.35, 0.55, 0.8]], [[0.03, 0.42, 0.16], [0.8, 0.8, 0.78]], [[0.9, 0.35, 0.03], [0.8, 0.8, 0.78]]];
const BICYCLE_COLORS = [[0.03, 0.03, 0.035], [0.08, 0.18, 0.42], [0.4, 0.06, 0.06], [0.3, 0.31, 0.33], [0.1, 0.3, 0.16]];
const WHITE = [1, 1, 1];
const pickW = (list) => { let t = 0; for (const c of list) t += c[3]; let r = Math.random() * t; for (const c of list) { r -= c[3]; if (r <= 0) return c; } return list[0]; };
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Trục xích lô và xe điện du lịch: quanh Hồ Gươm và trục Hàng Đào - Đồng Xuân cùng các phố vòng trong phố cổ (docs/18 mục 4).
const ROUTE = new Set(['Phố Đinh Tiên Hoàng', 'Phố Lê Thái Tổ', 'Phố Hàng Khay', 'Phố Tràng Tiền', 'Phố Lê Lai', 'Phố Lê Thạch', 'Phố Hàng Đào', 'Phố Hàng Ngang', 'Phố Hàng Đường',
  'Phố Đồng Xuân', 'Phố Hàng Giấy', 'Phố Hàng Bạc', 'Phố Hàng Buồm', 'Phố Mã Mây', 'Phố Lãn Ông', 'Phố Hàng Gai', 'Phố Cầu Gỗ', 'Phố Hàng Bè', 'Phố Lương Văn Can', 'Phố Hàng Dầu', 'Phố Lò Sũ', 'Phố Hàng Cân', 'Phố Hàng Bồ', 'Phố Hàng Trống', 'Phố Lý Thái Tổ', 'Phố Ngô Quyền']);

// Xe ở xa chỉ là vài khối hộp (76 tam giác) nên cho phép đông hơn con số trong config 20%: phố mới ra dáng "dòng xe máy dày".
export const BOOST = 1.2;
const PCU = [1, 5.5, 12, 2]; // chỗ chiếm trên đường tính theo xe máy: ô tô 5,5; xe buýt 12; xe thô sơ 2
// Mật độ xe theo giờ (0..1): cao điểm sáng 7-8 giờ và chiều 17-18 giờ, trưa vừa, tối thưa dần, đêm vắng.
const DENSITY = [[0, 0.12], [4.5, 0.12], [6, 0.35], [7.5, 1], [9, 0.8], [11.5, 0.75], [13, 0.6], [16, 0.75], [17.5, 1], [19, 0.85], [21, 0.55], [23, 0.25], [24, 0.12]];
export function densityAt(h) { for (let i = 1; i < DENSITY.length; i++) if (h <= DENSITY[i][0]) { const a = DENSITY[i - 1], b = DENSITY[i]; return a[1] + ((b[1] - a[1]) * (h - a[0])) / (b[0] - a[0]); } return 0.12; }
// Cơ cấu xe theo khu và giờ: phần ô tô, xe buýt, xe chậm trong tổng số xe (còn lại là xe máy) và phần taxi trong số ô tô.
export function mixAt(zone, h) {
  const night = h >= 22.5 || h < 5, eve = h >= 21 || h < 5.5;
  const m = zone === ZONE.old ? { car: 0.095, bus: 0.008, slow: 0.055, taxi: 0.5 } : zone === ZONE.french || zone === ZONE.badinh ? { car: 0.21, bus: 0.02, slow: 0.03, taxi: 0.35 } : { car: 0.15, bus: 0.015, slow: 0.035, taxi: 0.35 };
  if (night) { m.taxi = 0.65; m.bus = 0; m.slow *= 0.2; } else if (eve) m.slow *= 0.5;
  return m;
}

// Chọn dáng vẻ cho một xe mới: màu sơn, áo, mũ, bộ phận hiện/ẩn. Ghi vào a.tint, a.tint2, a.tint3, a.bits và khách ngồi sau a.pill.
export function dress(a, zone, h) {
  const t = a.type; a.bits = 0; a.pill = 0; a.tint = WHITE; a.tint2 = WHITE; a.tint3 = WHITE;
  if (t <= VT.cub) {
    a.tint = pickW(BIKE_COLORS); a.tint2 = pick(JACKETS); a.tint3 = pick(HELMETS);
    let ev = t === VT.scooter && Math.random() < 0.09, guest = 0.2;
    if (Math.random() < 0.72) a.bits |= BIT.sleeve;
    if (Math.random() < 0.5) a.bits |= Math.random() < 0.6 ? BIT.mask : BIT.maskDark;
    if (t !== VT.cub && Math.random() < 0.13) { // xe ôm, giao hàng công nghệ: 10-15% xe máy đang chạy
      let g = HAIL[0], rr = Math.random() * 100; for (const q of HAIL) { rr -= q.w; if (rr <= 0) { g = q; break; } }
      a.tint2 = g.c; a.tint3 = g.c; a.bits |= BIT.sleeve; a.hail = true;
      if (g.ev && t === VT.scooter) { ev = true; a.tint = g.c; }
      if (Math.random() < g.box) { a.bits |= BIT.box; guest = 0; } else guest = g.guest;
    } else if (t !== VT.cub && Math.random() < 0.12) { // áo chống nắng trùm đầu, váy quây, khẩu trang
      a.tint2 = pick(SUNCOATS); a.bits |= BIT.hood | BIT.sleeve | BIT.mask; a.bits &= ~BIT.maskDark; guest = 0.1;
    }
    if (!ev) a.bits |= BIT.exhaust;
    if (Math.random() < guest) { // khách ngồi sau (đội mũ cùng hãng nếu là xe ôm công nghệ), một phần là trẻ con
      a.pill = !a.hail && Math.random() < 0.22 ? 2 : 1; a.ptint2 = pick(a.pill === 2 ? SUNCOATS : JACKETS); a.ptint3 = a.hail ? a.tint3 : pick(HELMETS);
      a.pbits = (Math.random() < 0.7 ? BIT.sleeve : 0) | (Math.random() < 0.45 ? BIT.mask : 0);
    }
  } else if (t === VT.sedan || t === VT.hatch) {
    a.tint3 = PLATE.white;
    if (a.taxi) { a.bits |= BIT.roof; a.tint3 = PLATE.yellow; a.tint = t === VT.hatch ? TAXI_EV : pick(TAXI_GAS); }
    else {
      a.tint = pick(CAR_COLORS);
      const r = Math.random();
      if (zone === ZONE.badinh && r < 0.16) { a.tint3 = PLATE.blue; a.tint = Math.random() < 0.7 ? CAR_COLORS[2] : CAR_COLORS[0]; } // xe cơ quan nhà nước
      else if (r < 0.14) a.tint3 = PLATE.yellow; // xe hợp đồng, xe công nghệ: biển vàng
    }
  } else if (t === VT.bus) { const l = pick(BUS_LIVERY); a.tint = l[0]; a.tint2 = l[1]; }
  else if (t === VT.bicycle) {
    a.tint = pick(BICYCLE_COLORS); a.tint2 = pick(JACKETS); a.tint3 = pick(HELMETS);
    if (a.vendor) { a.bits |= BIT.tray | (a.vendor === 1 ? BIT.flowers : BIT.fruit) | BIT.nonla | BIT.sleeve; a.tint2 = pick([[0.2, 0.1, 0.07], [0.12, 0.1, 0.2], [0.25, 0.08, 0.14], [0.1, 0.16, 0.12]]); }
    else { if (Math.random() < 0.3) { a.tint = [0.75, 0.78, 0.74]; a.bits |= BIT.basket; } else if (Math.random() < 0.5) a.bits |= BIT.basket; // xe đạp công cộng trắng xanh, xe mini có giỏ
      if (Math.random() < 0.6) a.bits |= BIT.sleeve; if (Math.random() < 0.35) a.bits |= BIT.cap; }
  } else if (t === VT.cyclo) {
    a.tint2 = pick([[0.03, 0.05, 0.16], [0.06, 0.06, 0.07], [0.16, 0.17, 0.19]]); a.tint3 = [0.2, 0.26, 0.14]; a.bits |= BIT.sleeve; // người đạp: áo tối, mũ cối xanh rêu
    if (Math.random() < 0.8) { a.bits |= BIT.guest; a.ptint2 = pick(SUNCOATS); }
    a.tint = a.ptint2;
  } else if (t === VT.ecart) { a.tint2 = pick(JACKETS); a.tint = pick(SUNCOATS); a.tint3 = pick(JACKETS); if (Math.random() < 0.85) a.bits |= BIT.row2; if (Math.random() < 0.7) a.bits |= BIT.row3; }
  void h;
}

export class TrafficSim {
  constructor(world, quality) {
    this.world = world; this.maxBikes = quality.traffic; this.maxCars = quality.cars;
    // ----- đồ thị đường -----
    this.edges = []; this.nodes = new Map();
    const key = (x, z) => Math.round(x * 10) * 100003 + Math.round(z * 10);
    // Đoạn đường rất ngắn (dưới 4 m: mẩu nối giữa hai chiều của đường đôi, khúc gãy trong lòng nút giao) không thành cạnh riêng,
    // hai đầu của nó được coi là MỘT nút. Nếu chỉ bỏ các đoạn đó đi thì đồ thị đứt thành gần 200 nút cụt giả giữa những phố lớn:
    // xe chạy tới đó phải quay đầu tại chỗ hoặc biến mất.
    const par = new Map(), find = (k) => { let r = k; while (par.has(r)) r = par.get(r); while (par.has(k)) { const n = par.get(k); par.set(k, r); k = n; } return r; };
    const usable = (r) => r.veh && r.kind <= K.residential && !r.skip;
    for (const r of world.roads) { if (!usable(r) || r.len >= 4) continue; const a = find(key(r.p[0], r.p[1])), b = find(key(r.p[r.p.length - 2], r.p[r.p.length - 1])); if (a !== b) par.set(a, b); }
    this.nodeOf = (x, z) => find(key(x, z));
    for (const r of world.roads) {
      if (!usable(r) || r.len < 4) continue;
      const p = r.p, cum = [0]; for (let i = 0; i < p.length - 2; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]));
      const mi = (p.length >> 2) << 1, zone = zoneAt(p[mi], p[mi + 1]);
      // tốc độ dòng xe của phố (m/s): phố cổ 15-30 km/h, trục chính 30-40 km/h
      const vb = zone === ZONE.old ? (r.kind <= K.tertiary ? 6.6 : 5.4) : r.kind <= K.secondary ? 9.6 : r.kind === K.tertiary ? 7.8 : 5.6;
      const e = { r, p, cum, len: cum[cum.length - 1], w: r.w, kind: r.kind, oneway: r.flags & F_ONEWAY ? (r.flags & F_REVERSE ? -1 : 1) : 0, n0: find(key(p[0], p[1])), n1: find(key(p[p.length - 2], p[p.length - 1])), i: this.edges.length, zone, vb,
        route: ROUTE.has(world.names[r.name]) && r.w >= 6, cx: (r.bb[0] + r.bb[2]) / 2, cz: (r.bb[1] + r.bb[3]) / 2, wt: 0.5, wn: 0.5, cor: false };
      this.edges.push(e);
      for (const n of [e.n0, e.n1]) { let l = this.nodes.get(n); if (!l) this.nodes.set(n, (l = [])); l.push(e); }
    }
    // ----- chiều chạy vô nghĩa -----
    // Bản đồ có những mẩu đường hai chiều mà đi hết thì chỉ gặp đường một chiều ngược lại (đầu phố Tràng Tiền sát Hồ Gươm), và
    // những ngõ cụt chỉ dài vài chục mét. Xe chạy vào đó phải quay đầu tại chỗ, ngay trong lòng nút giao thì khoá cứng cả nút.
    // bad: các (cạnh, chiều) không dẫn tới đâu: đi tiếp kiểu gì cũng cụt, không ra được mép bản đồ, và không phải một ngõ cụt đủ dài
    // (từ 60 m) để có lý do chạy vào. Xe không chọn rẽ vào và không được sinh ra trên các chiều này.
    this.bad = new Set();
    {
      const b = world.bounds, code = (e, d) => e.i * 2 + (d > 0 ? 1 : 0), okDir = (e, d) => !e.oneway || e.oneway === d;
      const dead = new Set();
      for (let changed = true; changed;) { changed = false;
        for (const e of this.edges) for (const d of [1, -1]) { if (!okDir(e, d) || dead.has(code(e, d))) continue; const n = d > 0 ? e.n1 : e.n0; let out = false;
          for (const f of this.nodes.get(n)) { if (f === e) continue; const df = f.n0 === n ? 1 : -1; if (okDir(f, df) && !dead.has(code(f, df))) { out = true; break; } }
          if (!out) { dead.add(code(e, d)); changed = true; } } }
      // với mỗi chiều cụt: có ra được mép bản đồ không (exit), và quãng dài nhất đi được trước khi hết đường (len; −1: vướng một chiều)
      const info = new Map();
      const visit = (e, d, depth) => {
        const c = code(e, d), got = info.get(c); if (got) return got; const r = { exit: false, len: -1 }; info.set(c, r); if (depth > 60) return r;
        const n = d > 0 ? e.n1 : e.n0, i = d > 0 ? e.p.length - 2 : 0, x = e.p[i], z = e.p[i + 1], list = this.nodes.get(n); let any = false, best = -1;
        for (const f of list) { if (f === e) continue; const df = f.n0 === n ? 1 : -1; if (!okDir(f, df)) continue; any = true; const q = visit(f, df, depth + 1); if (q.exit) r.exit = true; if (q.len > best) best = q.len; }
        if (list.length === 1) { r.len = e.len; if (x < b.x0 + 40 || x > b.x1 - 40 || z < b.z0 + 40 || z > b.z1 - 40) r.exit = true; }
        else if (any && best >= 0) r.len = e.len + best;
        return r;
      };
      for (const e of this.edges) for (const d of [1, -1]) { const c = code(e, d); if (!dead.has(c)) continue; const r = visit(e, d, 0); if (!r.exit && r.len < 60) this.bad.add(c); }
      // dead: mọi chiều cụt (xe đã vào một ngõ cụt dài thì được chạy nốt tới cuối ngõ, kể cả qua những cạnh cuối tự nó là "vô nghĩa");
      // exits: các nút cụt nằm sát mép bản đồ, tức đường còn chạy tiếp ra ngoài vùng dựng: xe tới đó là ra khỏi bản đồ, không quay đầu
      this.dead = dead; this.exits = new Set();
      for (const e of this.edges) for (const d of [1, -1]) { const n = d > 0 ? e.n1 : e.n0; if (this.nodes.get(n).length !== 1) continue; const i = d > 0 ? e.p.length - 2 : 0, x = e.p[i], z = e.p[i + 1]; if (x < b.x0 + 40 || x > b.x1 - 40 || z < b.z0 + 40 || z > b.z1 - 40) this.exits.add(n); }
    }
    // Chiều cụt theo từng nhóm xe: như bad/dead ở trên nhưng lối đi tiếp phải hợp với chính loại xe đó (fit > 0: bề rộng, biển cấm
    // ô tô hay xe máy, trục xích lô). Không có bảng này thì ô tô chạy vào một đường một chiều mà cuối đường chỉ còn ngõ xe máy sẽ tới
    // đó không đi đâu được (bị xoá ngay trước mắt người chơi), trên đường hai chiều thì quay đầu giữa nút.
    // badC[k], deadC[k]: nhóm xe k = FITK[loại xe]. Ở nút không còn lối hợp loại xe: đường hai chiều coi như ngõ cụt (quay đầu được,
    // dài từ 60 m thì vẫn được chạy vào), đường một chiều thì cụt hẳn (trừ khi ra mép bản đồ).
    this.badC = []; this.deadC = [];
    {
      const code = (e, d) => e.i * 2 + (d > 0 ? 1 : 0), N = this.edges.length * 2;
      for (const type of FIT_GROUPS) {
        const ok = (e, d) => (!e.oneway || e.oneway === d) && this.fit(type, e, true) > 0;
        // đếm lối đi tiếp hợp lệ của từng (cạnh, chiều); chiều nào hết lối thì cụt, rồi lan ngược về các chiều dẫn tới nó
        const cnt = new Int32Array(N), pred = new Map(), dead = new Set(), queue = [];
        for (const e of this.edges) for (const d of [1, -1]) {
          if (!ok(e, d)) continue; const c = code(e, d), n = d > 0 ? e.n1 : e.n0;
          for (const f of this.nodes.get(n)) { if (f === e) continue; const df = f.n0 === n ? 1 : -1; if (!ok(f, df)) continue; cnt[c]++; const q = code(f, df); let l = pred.get(q); if (!l) pred.set(q, (l = [])); l.push(c); }
          if (cnt[c] === 0) { dead.add(c); queue.push(c); }
        }
        while (queue.length) { const t = queue.pop(), l = pred.get(t); if (l) for (const c of l) if (!dead.has(c) && --cnt[c] === 0) { dead.add(c); queue.push(c); } }
        const info = new Map();
        const visit = (e, d, depth) => {
          const c = code(e, d), got = info.get(c); if (got) return got; const r = { exit: false, len: -1 }; info.set(c, r); if (depth > 60) return r;
          const n = d > 0 ? e.n1 : e.n0, list = this.nodes.get(n); let any = false, best = -1;
          for (const f of list) { if (f === e) continue; const df = f.n0 === n ? 1 : -1; if (!ok(f, df)) continue; any = true; const q = visit(f, df, depth + 1); if (q.exit) r.exit = true; if (q.len > best) best = q.len; }
          if (!any) { if (this.exits.has(n)) r.exit = true; else if (!e.oneway) r.len = e.len; }
          else if (best >= 0) r.len = e.len + best;
          return r;
        };
        const bad = new Set(); for (const c of dead) { const e = this.edges[c >> 1], r = visit(e, c & 1 ? 1 : -1, 0); if (!r.exit && r.len < 60) bad.add(c); }
        this.badC.push(bad); this.deadC.push(dead);
      }
    }
    // ----- đèn tín hiệu: dùng đúng các nút có cột đèn vẽ ngoài phố và đúng chu kỳ của chúng (world/junctions.js), để xe dừng khi
    // người chơi thấy đèn đỏ và chạy khi thấy đèn xanh. Không có đèn thì hai dòng xe dày cắt nhau sẽ khoá cứng nút; có đèn thì xe
    // dồn hàng trước vạch dừng rồi ùa đi như ngoài phố. clock: đồng hồ của shader vẽ đèn (lớp vẽ gán mỗi khung hình);
    // chạy trong Node hoặc lúc rải xe ban đầu thì dùng đồng hồ riêng của mô phỏng.
    this.sig = new Map(); for (const [k, sg] of junctionsOf(world).signalNode) this.sig.set(find(k), sg);
    this.clock = null;
    // Vạch dừng là một CHỖ trên mặt đường (cách tim nút sg.line mét dọc theo nhánh vào nút), không phải thuộc tính của một cạnh:
    // bản đồ cắt đường thành nhiều đoạn ngắn quanh nút giao (làn rẽ, chỗ tách dải phân cách), nên vạch dừng có thể nằm trên cạnh
    // sát nút, hoặc trên cạnh phía trước nó vài đoạn. ahead: (cạnh, chiều) → { sg, X, grp } cho mọi cạnh có vạch dừng trong tầm SEE
    // phía trước: chạy hết cạnh rồi đi thêm X mét nữa thì tới nút có đèn sg, vào nút theo nhóm pha grp. Xe ở bất cứ cạnh nào trong
    // bảng này đều tính quãng còn lại tới nút theo cùng một cách, nên dừng đúng một chỗ dù tới từ cạnh dài hay qua chuỗi cạnh ngắn.
    // Cạnh nối hai nút cùng một nút giao (lòng nút giao lớn) không có vạch dừng: xe đã vào nút thì đi nốt cho thoát.
    this.ahead = new Map();
    {
      const members = new Map(), o = [0, 0, 0, 0], code = (e, d) => e.i * 2 + (d > 0 ? 1 : 0);
      for (const [n, sg] of this.sig) { let m = members.get(sg); if (!m) members.set(sg, (m = new Set())); m.add(n); }
      // đầu mút của cạnh e ở phía xuất phát (end = 0) hoặc phía tới (end = 1) khi đi theo chiều d
      const tip = (e, d, end) => { const i = (d > 0) === (end === 1) ? e.p.length - 2 : 0; return [e.p[i], e.p[i + 1]]; };
      // L: quãng từ nút tới chỗ mũi xe dừng (vạch dừng sơn của đúng nhánh này); S: quãng từ nút tới chân cột đèn của nhánh
      const walk = (e, d, sg, X, grp, L, S) => {
        const c = code(e, d), old = this.ahead.get(c); if (old && old.X <= X) return;
        this.ahead.set(c, { sg, X, grp, L, S });
        const up = d > 0 ? e.n0 : e.n1, X2 = X + e.len; if (X2 >= L + SEE || this.sig.has(up)) return;
        const [sx, sz] = tip(e, d, 0);
        // hai cạnh gặp nhau ở một nút đã gộp có thể cách nhau một mẩu đường ngắn (dưới 4 m) không thành cạnh: cộng cả mẩu đó
        for (const f of this.nodes.get(up) || []) { if (f === e || f.n0 === f.n1) continue; const df = f.n1 === up ? 1 : -1; if (f.oneway && f.oneway !== df) continue; const [fx, fz] = tip(f, df, 1); walk(f, df, sg, X2 + Math.hypot(fx - sx, fz - sz), grp, L, S); }
      };
      const JN = junctionsOf(world).nodes;
      for (const [n, sg] of this.sig) {
        const mem = members.get(sg);
        for (const e of this.nodes.get(n) || []) {
          if (e.n0 === e.n1) continue;
          const d = e.n1 === n ? 1 : -1; if ((e.oneway && e.oneway !== d) || mem.has(d > 0 ? e.n0 : e.n1)) continue;
          // nhóm pha: lấy đúng nhóm của nhánh có cột đèn vẽ ngoài phố (cùng đoạn đường, cùng đầu mút); nhánh nhỏ không có cột đèn
          // thì tính theo hướng vào nút, đo trên 5 m cuối như world/junctions.js
          const arm = sg.arms.find((m) => m.r === e.r && m.e === (d > 0 ? 1 : 0));
          let grp; if (arm) grp = arm.grp; else { this.sample(e, Math.max(0, e.len - 5), d, o); const ax = o[0], az = o[1]; this.sample(e, e.len, d, o); const L = Math.hypot(o[0] - ax, o[1] - az) || 1; grp = signalGroup(sg, (o[0] - ax) / L, (o[1] - az) / L); }
          // cạnh kết thúc cách nút có đèn một mẩu đường ngắn đã gộp: quãng tới nút tính tới đúng chỗ đặt nút
          let X0 = 0; if (!arm) { const [ex, ez] = tip(e, d, 1); X0 = 1e9; for (const k of sg.keys) { const q = JN.get(k); if (q) X0 = Math.min(X0, Math.hypot(q.x - ex, q.z - ez)); } if (!(X0 < 8)) X0 = 0; }
          walk(e, d, sg, X0, grp, arm ? arm.line : sg.line, arm ? arm.stop : sg.stop);
        }
      }
    }
    // ----- phố đi bộ tối cuối tuần (world/walkzone.js): day là thứ trong tuần của game (lớp ngoài gán), walk là trạng thái đang đóng phố,
    // gates là chỗ dựng rào ở các đầu phố bị đóng: [{ x, z, tx, tz, w }]
    for (const e of this.edges) { e.walk = isWalkRoad(world.names, e.r); e.closed = false; }
    this.day = 3; this.walk = false; this.gates = []; this.noEntry = null;
    this.agents = []; this.grid = new Map(); this.merge = new Map(); this.near = []; this.nearW = 0; this.nearT = 0; this.honks = []; this.density = 1; this.seq = 1; this.time = 0;
    this.mix = mixAt(ZONE.old, 12); this.zone = ZONE.old; this.hours = 12;
    this.touch = 0; this.flow = 1; // touch: số lần xe người chơi chạm xe khác (cho lối chơi)
    this.frame = 1; this.rays = 2; this.corRoom = true; this.corRoute = false; this.jamT = -1; this.blind = false; this.cullT = 0.5; this.corW = 0.5; this.corCap = 0.5; this.warming = false;
    this.occluded = null; // hàm (x, z) → true nếu điểm đó khuất sau nhà so với camera (lớp vẽ gắn vào)
    this.stats = { spawned: 0, removed: 0, unstuck: 0, hits: 0 }; this.lastHit = null;
    this._o = [0, 0, 0, 0]; this._ux = 0; this._uz = 0;
  }

  // điểm trên cạnh e cách đầu mút xuất phát một đoạn d theo chiều đi dir; ghi vào out [x,z,tx,tz]
  sample(e, d, dir, out) {
    const p = e.p, cum = e.cum, s = clamp(dir > 0 ? d : e.len - d, 0, e.len);
    let i = 0; while (i < cum.length - 2 && cum[i + 1] < s) i++;
    const L = cum[i + 1] - cum[i] || 1, t = (s - cum[i]) / L, ax = p[i * 2], az = p[i * 2 + 1], bx = p[i * 2 + 2], bz = p[i * 2 + 3];
    out[0] = ax + (bx - ax) * t; out[1] = az + (bz - az) * t; out[2] = ((bx - ax) / L) * dir; out[3] = ((bz - az) / L) * dir;
  }
  // loại xe type có được chạy trên cạnh e không (0: không; lớn hơn: mức ưa thích)
  fit(type, e, ghost = false) {
    if (e.closed && !ghost) return 0; // phố đi bộ đang đóng: chỉ xe còn kẹt trong khu lúc đóng phố (ghost) được chạy nốt ra
    const c = TYPES[type].cls, fl = e.r.flags;
    if (fl & (F_NOCAR | F_NOBIKE)) { // đường có biển cấm theo loại xe (thẻ OSM): lòng giữa cầu Chương Dương cấm xe máy, xe thô sơ; cầu Long Biên, ngõ nhỏ cấm ô tô
      if ((fl & F_NOBIKE) && (c === 0 || c === 3)) return 0;
      if ((fl & F_NOCAR) && (c === 1 || c === 2 || type === VT.ecart)) return 0;
    }
    if (c === 0) return 1;
    if (c === 1) return e.w >= 5.5 ? 1 : 0;
    if (c === 2) return e.w < 6.5 ? 0 : e.kind <= K.secondary ? 1 : 0.06;
    if (type === VT.bicycle) return e.w >= 4.5 ? 1 : 0.2;
    return e.route ? 8 : e.w >= 6 ? 0.25 : 0;
  }

  // Làm mới mỗi giây: các cạnh quanh người chơi và trọng số sinh xe. Ngân sách xe có hạn nên dồn xe về nơi người chơi nhìn thấy:
  // "hành lang" là con phố đang đứng (đi thẳng theo phố tới 230 m về hai phía) và các nhánh trong 35 m; hành lang được chia tới
  // 62% số xe (1 xe mỗi 4 m phố rộng 7 m lúc cao điểm), phần còn lại rải quanh đó, thưa dần theo khoảng cách.
  refresh(px, pz, hours) {
    this.near.length = 0; let tot = 0, cap = 0, ctot = 0, start = null, bd = 900, shut = false;
    for (const e of this.edges) {
      const b = e.r.bb; e.cor = false; if (e.closed || !(b[0] < px + 230 && b[2] > px - 230 && b[1] < pz + 230 && b[3] > pz - 230)) continue;
      this.near.push(e);
      if (b[0] > px + 30 || b[2] < px - 30 || b[1] > pz + 30 || b[3] < pz - 30) continue;
      const p = e.p; for (let i = 0; i < p.length - 2; i += 2) { const d = segDist2(px, pz, p[i], p[i + 1], p[i + 2], p[i + 3]); if (d < bd) { bd = d; start = e; } if (d < 1225) e.cor = true; }
    }
    if (start) { // đi thẳng theo phố về hai phía (shut: đi thẳng thì gặp rào phố đi bộ)
      start.cor = true; const o = this._o;
      for (const d0 of [1, -1]) {
        let e = start, dir = d0, len = 0;
        for (let hop = 0; hop < 14 && len < 170; hop++) {
          const node = dir > 0 ? e.n1 : e.n0; this.sample(e, e.len, dir, o); const tx = o[2], tz = o[3]; let best = null, bdot = 0.8, bdir = 1;
          for (const c of this.nodes.get(node) || []) { if (c === e) continue; const cd = c.n0 === node ? 1 : -1; if (c.closed) { this.sample(c, 0, cd, o); if (o[2] * tx + o[3] * tz > 0.8) shut = true; continue; } this.sample(c, 0, cd, o); const dot = o[2] * tx + o[3] * tz + (c.r.name === e.r.name ? 0.08 : 0); if (dot > bdot) { bdot = dot; best = c; bdir = cd; } }
          if (!best || best.cor && best !== start && hop > 2) break;
          e = best; dir = bdir; e.cor = true; len += e.len;
        }
      }
    }
    for (const e of this.near) {
      const lanes = (e.kind <= K.secondary ? 3 : e.kind === K.tertiary ? 2 : 1) * (e.w < 4.5 ? 0.3 : 1);
      if (e.cor) { const d = Math.hypot(e.cx - px, e.cz - pz); e.wt = e.len * Math.max(1, e.w / 7) * (d > 200 ? 0.4 : 1); ctot += e.wt; cap += (e.len * Math.max(1, e.w - 1)) / (e.oneway ? 17 : 38); e.wn = 0; } // sức chứa tính bằng "xe máy quy đổi": phố hai chiều chứa ít hơn
      else { const d = Math.hypot(e.cx - px, e.cz - pz); e.wn = e.len * lanes * (d < 60 ? 1 : Math.max(0.06, 1 - (d - 60) / 130)); tot += e.wn; e.wt = 0; }
    }
    this.nearW = tot; this.corW = ctot; this.hours = hours; this.density = densityAt(hours); this.corRoute = !!start && start.route;
    // giờ cao điểm cả dòng xe chạy chậm lại (15 đến 30 km/h theo docs/18 mục 4), đêm vắng thì chạy đúng tốc độ của phố
    this.flow = 1 - 0.25 * clamp((this.density - 0.5) * 2, 0, 1);
    this.corCap = cap * this.density * (shut ? 0.4 : 1); // phố người chơi đứng bị rào chắn ngang phía trước: xe tới đó phải rẽ hết, không dồn xe vào nhiều
    this.zone = zoneAt(px, pz); this.mix = mixAt(this.zone, hours);
  }

  pickType(cls) {
    if (cls === 0) { const r = Math.random(); return r < 0.52 ? VT.scooter : r < 0.93 ? VT.wave : VT.cub; }
    if (cls === 1) return Math.random() < 0.5 ? VT.sedan : VT.hatch;
    if (cls === 2) return VT.bus;
    const r = Math.random(); return r < 0.45 ? VT.bicycle : r < 0.8 ? VT.cyclo : VT.ecart;
  }

  // cor: sinh trên hành lang (con phố người chơi đang đứng) hay ở các phố quanh đó
  spawn(px, pz, cam, cls, cor = false) {
    if (!this.near.length) return false;
    if (this.jamT > 0 && !this.blind) cor = false;
    if (cor && !(this.corW > 0)) cor = false; if (!cor && !(this.nearW > 0)) { if (!(this.corW > 0)) return false; cor = true; }
    let type = this.pickType(cls), taxi = false;
    if (cls === 1 && Math.random() < this.mix.taxi) { taxi = true; type = Math.random() < 0.61 ? VT.hatch : VT.sedan; } // 61% taxi Hà Nội là xe điện
    const o = this._o;
    for (let tries = 0, nt = this.blind ? 6 : 4; tries < nt; tries++) {
      let r = Math.random() * (cor ? this.corW : this.nearW), e = null; for (const q of this.near) { r -= cor ? q.wt : q.wn; if (r <= 0) { e = q; break; } }
      if (!e) continue;
      let f = this.fit(type, e);
      if (cls === 3 && type !== VT.bicycle && !e.route) { if (tries < 3) continue; type = VT.bicycle; f = this.fit(type, e); } // không gần trục xích lô: chỉ còn xe đạp
      if (!f || (cls === 1 && (e.w < 6.5 || e.kind > K.tertiary)) || (cls === 2 && e.kind > K.secondary)) continue;
      const dir = e.oneway ? e.oneway : Math.random() < 0.5 ? 1 : -1, s = Math.random() * e.len; if (this.barred(e, dir) || this.bad.has(e.i * 2 + (dir > 0 ? 1 : 0)) || this.badC[FITK[type]].has(e.i * 2 + (dir > 0 ? 1 : 0))) continue;
      this.sample(e, s, dir, o);
      const d = Math.hypot(o[0] - px, o[1] - pz); if (d < (this.warming ? 10 : 30) || d > 225) continue;
      // tầm sinh phải nằm trong tầm giữ xe (xem chỗ huỷ xe ở step): ngoài hành lang là 200 m phía trước, 150 m phía sau ống kính
      if (!e.cor && d > (cam && (o[0] - cam.x) * cam.fx + (o[1] - cam.z) * cam.fz > 0 ? 190 : 142)) continue;
      // không sinh xe ở quãng từ vạch dừng (kèm chỗ xếp hàng) vào tới nút có đèn: xe hiện ra ở đó sẽ băng qua nút lúc đèn đỏ
      { const ah = this.ahead.get(e.i * 2 + (dir > 0 ? 1 : 0)); if (ah && e.len - s + ah.X < ah.L + 2.5 + QUEUE) continue; }
      // xe sinh trên hành lang nên là xe sắp chạy ngang qua người chơi, ít khi là xe đang chạy ra xa
      if (cor && !this.warming && d > 40 && (px - o[0]) * o[2] + (pz - o[1]) * o[3] < 0 && Math.random() < 0.75) continue;
      // không hiện ra ngay trước mắt: phải ở xa, ngoài góc nhìn, hoặc khuất sau dãy nhà
      if (cam && !this.blind && d < 115) {
        const cx = o[0] - cam.x, cz = o[1] - cam.z, cd = Math.hypot(cx, cz) || 1;
        if ((cx * cam.fx + cz * cam.fz) / cd > 0.42 && !(this.occluded && cd > 18 && this.rays-- > 0 && this.occluded(o[0], o[1]))) continue; // dò tia có hạn mức mỗi khung hình
      }
      const a = this.make(type, e, dir, s, o, taxi);
      if (a.vown && type === VT.bicycle && Math.random() < 0.4 && e.zone === ZONE.old) { a.vendor = Math.random() < 0.6 ? 1 : 2; a.vown = 1.7 + Math.random() * 0.5; } // xe đạp bán hoa, bán quả: đạp thong thả sát lề
      dress(a, e.zone, this.hours);
      this.lane(a); a.lat = a.latT; a.x -= o[3] * a.lat; a.z += o[2] * a.lat;
      // chỗ đó đã có xe khác thì thôi (tránh chồng lên nhau lúc sinh)
      if (this.clash(a)) continue;
      this.plan(a); this.agents.push(a); this.put(a); this.stats.spawned++;
      // xích lô hay đi thành đoàn: thêm một, hai chiếc nối đuôi
      if (type === VT.cyclo && !this.warming && Math.random() < 0.5 && s > 9) this.follow(a, 4.2);
      return true;
    }
    return false;
  }
  // Tạo một xe. Mọi trường đều có mặt ngay từ đầu, số thực được khởi tạo bằng số thực, để mọi xe chung một hình dạng đối tượng.
  make(type, e, dir, s, o, taxi) {
    const T = TYPES[type], Z = 1e-9;
    return { id: this.seq++, e, dir, s, type, cls: T.cls, taxi, v: T.vmax ? T.vmax * 0.8 : 3 + Math.random() * 3, x: o[0], z: o[1], yaw: Math.atan2(o[2], o[3]), lean: Z, lat: Z, latT: Z, y: Z,
      pace: (0.78 + Math.random() * 0.4) * (T.vmul || 1), vown: T.vmax ? T.vmax * (0.8 + Math.random() * 0.3) : 0, pref: 0.25 + Math.random() * 0.7, r: T.r, hl: T.hl, wait: Z, honk: Math.random() * 4, stuck: Z, sq: -Z, slowT: Z, over: -Z, hitT: -Z,
      wob: Math.random() * 6.28, wobF: 0.5 + Math.random() * 0.7, wobA: T.cls === 0 ? 0.15 + Math.random() * 0.3 : T.cls === 3 ? 0.08 : 0.04, ne: null, nd: 1, vj: 3.2, sg: null, sgG: 0, sgX: 0, sgL: 0, sgS: 0, hold: false, pushT: -Z, pushB: null, blk: null, ghost: false, gT: 0, red: false, vendor: 0,
      bits: 0, pill: 0, pbits: 0, hail: false, tint: WHITE, tint2: WHITE, tint3: WHITE, ptint2: WHITE, ptint3: WHITE };
  }
  follow(lead, back) {
    const o = this._o; this.sample(lead.e, lead.s - back, lead.dir, o);
    const a = this.make(lead.type, lead.e, lead.dir, lead.s - back, o, false);
    a.lat = a.latT = lead.lat; a.pref = lead.pref; a.vown = lead.vown; a.honk = 9; a.x = o[0] - o[3] * a.lat; a.z = o[1] + o[2] * a.lat;
    if (this.clash(a, lead)) return;
    dress(a, a.e.zone, this.hours); this.plan(a); this.agents.push(a); this.put(a);
  }
  // xe a (vừa tạo, chưa vào danh sách) có chồng lên xe nào đang có không: tâm quá gần, hoặc thân xe (nới thêm một chút) lồng vào thân
  // xe kia. Xét 5 × 5 ô lưới quanh xe để không sót xe buýt dài có tâm ở xa. skip: xe được phép đứng sát (xe dẫn đoàn).
  clash(a, skip = null) {
    const cx = Math.floor(a.x / 5), cz = Math.floor(a.z / 5);
    for (let gx = cx - 2; gx <= cx + 2; gx++) for (let gz = cz - 2; gz <= cz + 2; gz++) {
      const l = this.cellAt(gx * 65537 + gz); if (!l) continue;
      for (let i = 0; i < l.n; i++) { const b = l.a[i]; if (b === skip || b.x > 1e8 || Math.abs(b.y - a.y) >= 2) continue; if ((b.x - a.x) ** 2 + (b.z - a.z) ** 2 < (a.hl + b.hl + 0.6) ** 2 || this.overlap(a.x, a.z, a.yaw, a.r + 0.15, a.hl + 0.3, b) > 0) return true; }
    }
    return false;
  }
  // lưới 5 m: các ô được giữ lại giữa các khung hình (đỡ cấp phát), ô nào chưa ghi trong khung hình này thì coi như rỗng
  cell(k) { let l = this.grid.get(k); if (!l) this.grid.set(k, (l = { f: this.frame, n: 0, a: [] })); else if (l.f !== this.frame) { l.n = 0; l.f = this.frame; } return l; }
  cellAt(k) { const l = this.grid.get(k); return l !== undefined && l.f === this.frame ? l : null; }
  mlist(k) { let l = this.merge.get(k); if (!l) this.merge.set(k, (l = { f: this.frame, n: 0, a: [] })); else if (l.f !== this.frame) { l.n = 0; l.f = this.frame; } return l; }
  mlistAt(k) { const l = this.merge.get(k); return l !== undefined && l.f === this.frame ? l : null; }
  put(a) { const l = this.cell(Math.floor(a.x / 5) * 65537 + Math.floor(a.z / 5)); l.a[l.n++] = a; }

  // vị trí ngang mong muốn trong lòng đường (dương = bên phải hướng đi)
  lane(a) {
    const hw = a.e.w / 2, m = a.r + 0.25;
    if (a.cls === 3) { a.latT = Math.max(a.e.oneway ? -hw : 0.3, hw - m - (a.type === VT.bicycle ? a.pref * 0.5 : 0.08)); return; } // xe thô sơ đi sát mép phải
    if (a.e.oneway) a.latT = clamp((a.pref * 2 - 1) * (hw - m), -(hw - m), hw - m);
    else a.latT = clamp(m * 0.6 + a.pref * (hw - m * 1.6), 0.58, Math.max(0.6, hw - m));
    if (a.cls === 1) a.latT = a.e.oneway ? clamp(a.latT, -(hw - 1.2), hw - 1.2) : Math.max(1.05, Math.min(hw - 1.1, hw * 0.5));
    else if (a.cls === 2) a.latT = a.e.oneway ? clamp(a.latT, -Math.max(0, hw - 1.6), Math.max(0, hw - 1.6)) : Math.max(1.4, Math.min(hw - 1.45, hw * 0.5));
  }
  // chọn trước cạnh kế tiếp ở cuối cạnh đang đi: a.ne, a.nd và tốc độ qua nút a.vj (đi thẳng thì nhanh, rẽ thì chậm)
  plan(a) {
    const node = a.dir > 0 ? a.e.n1 : a.e.n0, list = this.nodes.get(node) || [], o = this._o;
    this.sample(a.e, a.e.len, a.dir, o); const tx = o[2], tz = o[3];
    let best = null, bd = 1, bdot = 1, tot = 0, n = 0;
    const cc = a.e.i * 2 + (a.dir > 0 ? 1 : 0), committed = this.dead.has(cc); // đang ở trong một ngõ cụt: chạy nốt tới cuối
    const fk = FITK[a.type], badC = this.badC[fk], inC = this.deadC[fk].has(cc); // như trên nhưng chỉ tính lối hợp loại xe này
    for (const e of list) {
      if (e === a.e) continue;
      const dir = e.n0 === node ? 1 : -1; if (e.oneway && e.oneway !== dir) continue;
      const ec = e.i * 2 + (dir > 0 ? 1 : 0); if ((this.bad.has(ec) && !committed) || (badC.has(ec) && !inC)) continue;
      const shut = e.closed || this.barred(e, dir); if (shut && !a.ghost) continue;
      const f = this.fit(a.type, e, a.ghost) * (shut ? 0.05 : 1); if (!f) continue; // xe đang ra khỏi phố đi bộ: ưu tiên rẽ ra phố còn mở
      this.sample(e, 0, dir, o); const dot = o[2] * tx + o[3] * tz; n++;
      const w = Math.max(0.03, 0.2 + dot) * (e.kind <= K.secondary ? 2.2 : e.kind === K.tertiary ? 1.6 : 1) * (e.r.name === a.e.r.name ? 2 : 1) * f * (e.cor && !a.e.cor && this.corRoom ? 2.5 : 1);
      tot += w; if (Math.random() * tot < w) { best = e; bd = dir; bdot = dot; }
    }
    a.ne = best; a.nd = bd;
    // Đèn tín hiệu phía trước (bảng ahead ở hàm dựng): xe dừng sao cho mũi xe ở ngay trước vạch dừng. sgX: quãng từ cuối cạnh đang đi
    // tới nút có đèn; sgL: quãng từ tâm xe tới tim nút lúc dừng. Xe đã qua vạch rồi (kể cả xe rẽ từ ngõ ra ngay sát nút) thì đi nốt.
    { const ah = this.ahead.get(a.e.i * 2 + (a.dir > 0 ? 1 : 0)); if (ah) { a.sg = ah.sg; a.sgG = ah.grp; a.sgX = ah.X; a.sgL = ah.L + a.hl; a.sgS = ah.S; } else { a.sg = null; a.sgG = 0; a.sgX = 0; a.sgL = 0; a.sgS = 0; } }
    a.vj = !best ? 2 : list.length <= 2 && bdot > 0.8 ? 99 : 3 + 3.6 * Math.max(0, bdot) * (n > 1 ? 1 : 1.4);
  }
  // Các "chiều cụt": cặp (cạnh, chiều) mà xe chạy hết cạnh theo chiều đó thì không còn lối đi tiếp (mọi cạnh ở nút cuối đều đóng,
  // ngược chiều một chiều, hoặc cũng là chiều cụt). Trả về tập mã e.i * 2 + (chiều > 0 ? 1 : 0).
  deadDirs() {
    const dead = new Set(), code = (e, d) => e.i * 2 + (d > 0 ? 1 : 0), okDir = (e, d) => !e.closed && (!e.oneway || e.oneway === d);
    for (let changed = true; changed;) {
      changed = false;
      for (const e of this.edges) for (const d of [1, -1]) {
        if (!okDir(e, d) || dead.has(code(e, d))) continue;
        const n = d > 0 ? e.n1 : e.n0; let out = false;
        for (const f of this.nodes.get(n)) { if (f === e) continue; const df = f.n0 === n ? 1 : -1; if (okDir(f, df) && !dead.has(code(f, df))) { out = true; break; } }
        if (!out) { dead.add(code(e, d)); changed = true; }
      }
    }
    return dead;
  }
  // Đóng hoặc mở phố đi bộ. Khi đóng: các cạnh thuộc phố đi bộ không nhận xe. Chiều chạy nào vì thế mà thành cụt (trước khi đóng
  // phố thì không cụt) cũng không nhận xe, để không có xe chạy tới trước rào rồi quay đầu hay dồn ứ ở đó; cạnh cụt cả hai chiều
  // thì coi như đóng hẳn. Ngõ cụt thật và đường ra khỏi bản đồ vẫn như cũ. Xe đang ở trong khu được chạy nốt ra ngoài.
  setWalk(on) {
    const P = on ? this.walkPlan() : null;
    this.walk = on; this.gates = P ? P.gates : []; this.noEntry = P ? P.no : null;
    for (const e of this.edges) e.closed = P !== null && P.closed[e.i] === 1;
    for (const e of this.edges) e.r.shut = e.closed; // cho lớp ngoài: đoạn đường này đang nằm sau rào (người chơi không chạy xe vào được)
    for (const a of this.agents) { a.ghost = on && (a.e.closed || this.barred(a.e, a.dir)); a.gT = 0; if (a.ne && !a.ghost && (a.ne.closed || this.barred(a.ne, a.nd))) this.plan(a); }
    this.nearT = 0;
  }
  // Bố trí lúc phố đi bộ đóng (cạnh đóng, chiều cấm vào, chỗ đặt rào) chỉ phụ thuộc mạng đường nên tính một lần rồi dùng lại:
  // tính mất 50–140 ms (dò hai lượt hướng cụt trên cả mạng đường), để tới lúc 19:00 cuối tuần mới tính là game khựng một nhịp.
  // main.js gọi sẵn lúc đang tải.
  walkPlan() {
    if (this._walkPlan) return this._walkPlan;
    const o = this._o, was = this.edges.map((e) => e.closed);
    for (const e of this.edges) e.closed = false;
    const natural = this.deadDirs();
    for (const e of this.edges) e.closed = e.walk;
    const dead = this.deadDirs(), no = new Set(); for (const c of dead) if (!natural.has(c)) no.add(c);
    const okDir = (e, d) => !e.oneway || e.oneway === d;
    for (const e of this.edges) { if (e.closed) continue; let live = 0; for (const d of [1, -1]) if (okDir(e, d) && !no.has(e.i * 2 + (d > 0 ? 1 : 0))) live++; if (!live) e.closed = true; }
    const gates = [], closed = new Uint8Array(this.edges.length);
    for (const e of this.edges) {
      if (!e.closed) continue;
      closed[e.i] = 1;
      for (const [n, dir] of [[e.n0, 1], [e.n1, -1]]) { if (!this.nodes.get(n).some((f) => !f.closed)) continue; this.sample(e, Math.min(4.5, e.len * 0.4), dir, o); gates.push({ x: o[0], z: o[1], tx: o[2], tz: o[3], w: e.w }); }
    }
    this.edges.forEach((e, i) => { e.closed = was[i]; });
    return (this._walkPlan = { closed, no, gates });
  }
  // chiều chạy dir trên cạnh e đang bị cấm vào vì dẫn tới rào phố đi bộ
  barred(e, dir) { return this.noEntry !== null && this.noEntry.has(e.i * 2 + (dir > 0 ? 1 : 0)); }
  // Vị trí ngang của xe a ngay khi rẽ vào cạnh ne: thu vào trong lòng phố mới (phố hẹp hơn thì các xe chạy song song dồn về cùng
  // một vệt). Luật nhường nhau lúc nhập làn (ở step) dùng đúng hàm này để biết trước hai xe có chiếm cùng một vệt không.
  entryLat(a, ne) { const hw2 = Math.max(0, ne.w / 2 - a.r - 0.15); return clamp(a.lat, -hw2, hw2); }
  nextEdge(a) {
    if (!a.ne) { if (a.e.oneway || this.exits.has(a.dir > 0 ? a.e.n1 : a.e.n0)) return false; a.dir = -a.dir; a.s = 0; this.lane(a); this.plan(a); return true; } // ngõ cụt: quay đầu; mép bản đồ: xe chạy ra ngoài
    if (this.trace) { a.pe = a.e; a.te = this.time; a.pl = a.lat; }
    const lat = this.entryLat(a, a.ne);
    a.e = a.ne; a.dir = a.nd; a.s = 0; if (a.ghost && !a.e.closed && !this.barred(a.e, a.dir)) a.ghost = false; this.lane(a); this.plan(a);
    a.lat = lat; a.over = 0; a.hold = false;
    return true;
  }

  // Chạy trước vài chục giây mô phỏng (không vẽ) để lúc vào game phố đã đông xe sẵn.
  // Hai chặng: (1) rải xe nhanh khắp nơi; (2) 20 giây chạy thật theo đúng luật lúc chơi (dồn xe về con phố người chơi đứng, đèn tín hiệu,
  // xe ra khỏi vùng thì sinh xe mới chạy tới) nhưng chưa cần giấu chỗ xe hiện ra, để khung hình đầu tiên đã là dòng xe ổn định.
  // clockEnd: giờ của đồng hồ đèn ngoài (đồng hồ shader trong game) lúc rải xe xong. Có thì đồng hồ đèn chạy suốt quãng rải xe
  // (27,2 s) và dừng đúng ở clockEnd: bước đầu tiên sau đó đèn nối tiếp liền mạch, không nhảy pha (xe đã được cho đi vào nút
  // không bỗng gặp đèn đỏ ngay giữa lòng nút). Không có thì dùng đồng hồ riêng của mô phỏng như cũ.
  prewarm(player, cam, hours, clockEnd = null) {
    const p0x = player.pos.x, p0z = player.pos.z, ext = Number.isFinite(clockEnd);
    if (ext) this.clock = clockEnd - (60 * 0.12 + 200 * 0.1);
    const run = (dt) => { this.step(dt, player, cam, hours); if (ext) this.clock += dt; };
    this.blind = true; this.warming = true; for (let i = 0; i < 60; i++) run(0.12);
    this.warming = false; for (let i = 0; i < 200; i++) run(0.1);
    if (ext) this.clock = clockEnd;
    this.blind = false; this.honks.length = 0; this.touch = 0; player.pos.x = p0x; player.pos.z = p0z;
  }

  // Bóp còi: xe phía trước trong 14 m dạt sang bên, nhường đường.
  scare(x, z, fx, fz) {
    for (const a of this.agents) { const dx = a.x - x, dz = a.z - z, f = dx * fx + dz * fz; if (f < 0.5 || f > 14 || dx * dx + dz * dz > 200) continue; const s = dx * fz - dz * fx; if (Math.abs(s) > 2.2) continue; a.latT += 1.4; a.v *= 0.85; }
  }
  countNear(x, z, r) { let n = 0; for (const a of this.agents) if ((a.x - x) ** 2 + (a.z - z) ** 2 < r * r) n++; return n; }

  // Một bước mô phỏng. player: { pos: {x, z}, y, yaw, speed, mode, passenger, wobble }; cam: { x, z, fx, fz } hoặc null.
  step(dt, player, cam, hours) {
    const px = player.pos.x, pz = player.pos.z, A = this.agents, o = this._o;
    this.time += dt;
    // danh sách cạnh quanh người chơi, mật độ và cơ cấu xe: làm mới mỗi giây
    this.nearT -= dt;
    { const on = walkOn(this.day, hours); if (on !== this.walk) this.setWalk(on); }
    if (this.nearT <= 0) { this.nearT = 1; this.refresh(px, pz, hours); }
    // huỷ xe đã ra xa (xe ngoài hành lang chỉ giữ trong 150 m, hoặc 200 m nếu đang ở trước ống kính), đếm theo nhóm
    const cnt = this._cnt || (this._cnt = [0, 0, 0, 0]); cnt[0] = cnt[1] = cnt[2] = cnt[3] = 0; let nc = 0, pcu = 0, jam = 0;
    for (let i = A.length - 1; i >= 0; i--) {
      const a = A[i], dx = a.x - px, dz = a.z - pz, d2 = dx * dx + dz * dz, front = cam && (a.x - cam.x) * cam.fx + (a.z - cam.z) * cam.fz > 0;
      if (d2 > 60000 || (!a.e.cor && d2 > (front ? 40000 : 22500))) { A[i] = A[A.length - 1]; A.pop(); this.stats.removed++; continue; }
      if (a.ghost) { a.gT += dt; if (a.gT > 12 && (!front || (d2 > 2500 && this.occluded && this.occluded(a.x, a.z)))) { A[i] = A[A.length - 1]; A.pop(); this.stats.removed++; continue; } } // xe còn sót trong phố đi bộ: khuất mắt người chơi thì cho biến mất
      cnt[a.cls]++; if (a.e.cor) { nc++; pcu += PCU[a.cls]; if (a.stuck > 1.5) jam++; }
    }
    // nhiều xe trên hành lang đang kẹt: ngừng dồn thêm xe vào cho tới khi thông
    if (jam > Math.max(3, nc * 0.1)) this.jamT = 5; else if (this.jamT > 0) this.jamT -= dt;
    // lưới 5 m để tìm xe lân cận (xe dài ghi vào cả ô đầu và ô đuôi)
    this.frame++; if (this.grid.size > 6000) this.grid.clear();
    // Sổ nhập làn, lập lại mỗi khung hình: với mỗi (cạnh, chiều), `head` là các xe đang ở 14 m đầu cạnh, `inc` là các xe ở cạnh khác
    // sắp rẽ vào nó (còn dưới 16 m tới nút). Lưới 5 m chỉ thấy xe ngay trước mũi theo hướng đang chạy; xe ở sau góc rẽ và xe
    // chạy song song cùng rẽ vào một phố hẹp hơn thì phải tra sổ này, không thì cả hai bị dồn vào đúng một vệt và nằm đè lên nhau.
    const mg = this.merge; if (mg.size > 4000) mg.clear();
    for (const a of A) {
      if (a.x > 1e8) continue;
      if (a.s < 14) { const l = this.mlist(a.e.i * 4 + (a.dir > 0 ? 1 : 0)); l.a[l.n++] = a; }
      if (a.ne !== null && a.e.len - a.s < 16) { const l = this.mlist(a.ne.i * 4 + (a.nd > 0 ? 1 : 0) + 2); l.a[l.n++] = a; }
    }
    for (const a of A) {
      this.put(a);
      if (a.hl > 2.4) { const fx = Math.sin(a.yaw) * (a.hl - 1), fz = Math.cos(a.yaw) * (a.hl - 1); for (let k = -1; k <= 1; k += 2) { const l = this.cell(Math.floor((a.x + fx * k) / 5) * 65537 + Math.floor((a.z + fz * k) / 5)); if (l.n === 0 || l.a[l.n - 1] !== a) l.a[l.n++] = a; } }
    }
    // sinh xe cho đủ số theo mật độ và cơ cấu; hành lang được bù trước
    const N = Math.round((this.maxBikes + this.maxCars) * BOOST * this.density), m = this.mix, total = cnt[0] + cnt[1] + cnt[2] + cnt[3];
    const want = this._want || (this._want = [0, 0, 0, 0]); want[1] = Math.round(N * m.car); want[2] = m.bus > 0 ? Math.max(N > 40 ? 1 : 0, Math.min(3, Math.round(N * m.bus))) : 0; want[3] = Math.round(N * m.slow); want[0] = Math.max(0, N - want[1] - want[2] - want[3]);
    const wantCor = N * 0.7; let needCor = nc < wantCor && pcu < this.corCap && this.jamT <= 0;
    this.rays = 1;
    for (let k = 0; k < (this.warming ? 14 : this.blind ? 6 : 3) && cnt[0] < want[0]; k++) { if (this.spawn(px, pz, cam, 0, needCor)) { cnt[0]++; if (needCor && (++nc >= wantCor || ++pcu >= this.corCap)) needCor = false; } else if (needCor && k > 0) needCor = false; }
    needCor = nc < wantCor && pcu < this.corCap - 3 && this.jamT <= 0; this.corRoom = needCor;
    if (cnt[1] < want[1]) this.spawn(px, pz, cam, 1, needCor && Math.random() < 0.6);
    if (cnt[3] < want[3] && Math.random() < 0.3) this.spawn(px, pz, cam, 3, this.corRoute ? Math.random() < 0.8 : needCor && Math.random() < 0.6); // đang đứng trên trục xích lô thì xe chậm ưu tiên hiện ngay trên phố này
    if (cnt[2] < want[2] && Math.random() < 0.06) this.spawn(px, pz, cam, 2, Math.random() < 0.5);
    // hành lang còn thiếu mà đã đủ số xe: rút bớt xe ở xa, khuất mắt để dồn về
    if (needCor && nc < wantCor - 3 && total >= N && !this.warming) { this.cullT += dt; if (this.cullT > (this.blind ? 0.05 : 0.25)) { this.cullT = 0; let far = -1, fd = 6400; for (let i = 0; i < A.length; i++) { const a = A[i]; if (a.e.cor || a.cls !== 0) continue; const d2 = (a.x - px) ** 2 + (a.z - pz) ** 2; if (d2 > fd && (this.blind || !(cam && (a.x - cam.x) * cam.fx + (a.z - cam.z) * cam.fz > 0 && d2 < 14400))) { fd = d2; far = i; } } if (far >= 0) { A[far].x = 1e9; } } }

    const pv = player.speed, pfx = Math.sin(player.yaw), pfz = Math.cos(player.yaw), walking = player.mode !== 'bike', pr = walking ? 0.35 : 0.5, T = this.time, ST = this.clock === null ? T : this.clock;
    const bk = player.bikePos && Math.abs(player.bikePos.x - px) + Math.abs(player.bikePos.z - pz) > 0.05 ? player.bikePos : null;
    for (const a of A) {
      if (a.x > 1e8) continue;
      const e = a.e; this.sample(e, a.s, a.dir, o);
      a.y = e.r.elev ? roadY(e.r, a.dir > 0 ? a.s : e.len - a.s) : 0;
      const tx = o[2], tz = o[3], rx = -tz, rz = tx, bike = a.cls === 0;
      let target = a.vown || e.vb * a.pace * this.flow; const free = target;
      // gần nút giao thì chậm lại (đi thẳng qua nút vắng thì gần như không giảm)
      const rem = e.len - a.s; if (rem < 9) target = Math.min(target, a.vj + rem * 0.45);
      // đèn đỏ: dừng trước vạch (xe đã qua vạch thì đi nốt cho thoát nút)
      let red = false, atLine = 99; // atLine: đèn đang cho đi và mũi xe còn cách vạch dừng chừng này (99: không ở trước vạch nào)
      if (a.sg !== null && rem < 40) {
        const st = signalState(ST, a.sgG, a.sg.off), rs = rem + a.sgX, dl = rs - a.sgL; // dl: mũi xe còn cách vạch dừng bao xa
        // Đèn còn xanh nhưng sắp hết: xe chưa tới vạch mà chạy chậm (đang nối đuôi hàng xe vừa lăn bánh) không kịp qua hết lòng nút
        // trước khi dòng cắt ngang được đi thì dừng lại ở vạch, không chui vào nằm giữa nút. left: số giây tới lúc dòng kia có đèn xanh.
        let go = st === 3 || (st === 2 && dl < a.v * 1.1);
        if (st === 3 && dl > -1.2) { const tl = (((ST + a.sg.off * SIGNAL.shift + a.sgG * (SIGNAL.cycle / 2)) % SIGNAL.cycle) + SIGNAL.cycle) % SIGNAL.cycle, left = SIGNAL.cycle / 2 - tl; if ((dl + a.sgL + 6) / Math.max(a.v, 3) > left) go = false; }
        if (go) { a.hold = false; if (dl > -1.2 && dl < 4) atLine = dl; }
        else if (dl > -1.2) { red = true; target = Math.min(target, Math.max(0, dl * 1.2)); }
        // đã lỡ qua vạch dừng (qua lúc đèn vàng, hoặc từ ngõ rẽ ra ngay sát nút) mà đèn đã đỏ: còn kịp thì dừng trước vạch sang đường
        // và đứng yên đó tới khi đèn xanh; không kịp nữa thì đi nốt cho thoát nút
        else if (st === 1 && (a.hold || rs - a.hl - a.sgS + 1.4 > a.v * 0.25 + 0.15)) { red = true; target = 0; a.hold = true; }
      }
      if (a.pushT > 0) { a.pushT -= dt; target = Math.min(target, 2.4); if (a.pushT <= 0) a.pushB = null; }
      const gap = 1.4 + a.v * 0.8 + a.hl, sq = a.sq > 0 ? 0.3 : 0;
      // nửa bề dọc của thân xe a theo hướng phố, tính theo đúng hướng đầu xe (cho luật đoán trước xe cắt ngang)
      const aLx = Math.sin(a.yaw), aLz = Math.cos(a.yaw), aT = a.hl * Math.abs(aLx * tx + aLz * tz) + a.r * Math.abs(aLz * tx - aLx * tz); let blocked = false, shift = 0, side = 0, sep = 0, sepX = 0, lead = null, leadF = 1e9, lb = false, rb = false, blk = null;
      const cx = Math.floor((a.x + tx * gap * 0.5) / 5), cz = Math.floor((a.z + tz * gap * 0.5) / 5);
      for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gz = cz - 1; gz <= cz + 1; gz++) {
        const l = this.cellAt(gx * 65537 + gz); if (!l) continue;
        for (let bi = 0; bi < l.n; bi++) {
          const b = l.a[bi]; if (b === a || Math.abs(b.y - a.y) > 2) continue;
          const dx = b.x - a.x, dz = b.z - a.z, f = dx * tx + dz * tz, s = dx * rx + dz * rz, ov = a.hl + b.hl;
          const cosB = Math.sin(b.yaw) * tx + Math.cos(b.yaw) * tz; // +1 cùng chiều, −1 ngược chiều, 0 cắt ngang
          // xe cắt ngang chiếm bề ngang bằng chiều dài của nó
          const wsum = a.r + (cosB > -0.6 && cosB < 0.6 ? Math.max(b.r, b.hl * 0.8) : b.r) + 0.1 - (cosB < -0.6 ? 0.15 : 0) - (cosB < 0.6 ? sq : 0);
          const cross = cosB > -0.6 && cosB < 0.6;
          // xe cắt chéo: thân xe kia chìa về phía mình thêm một khúc bằng nửa chiều dài nhân với độ chéo (không chỉ nửa bề ngang)
          const bext = cross ? b.r + b.hl * Math.abs(cosB) : 0;
          // Xe cắt ngang đang chạy tới từ bên hông, chưa vào trước mũi: đoán trước tới 2 giây theo vận tốc hiện tại của hai xe. Nó sẽ
          // vào vệt đường của a trước lúc a tới chỗ đó (và chưa ra khỏi vệt khi a tới) thì a nhả ga như gặp một xe đứng ở đúng chỗ nó
          // sẽ cắt qua; a tới trước thì a đi (xe kia tự tính cùng cách và nhường). Không có luật này thì xe chỉ thấy xe cắt ngang khi
          // nó đã lọt vào trước mũi, lúc đó không còn kịp phanh nên hai thân xe lồng vào nhau giữa lòng nút.
          if (cross && b.v > 0.4 && a.v > 0.4 && f > 0 && Math.abs(s) >= wsum) {
            const bLx = Math.sin(b.yaw), bLz = Math.cos(b.yaw), vbs = b.v * (bLx * rx + bLz * rz);
            if (s * vbs < 0) { // đang tiến lại gần vệt của a
              const t1 = (Math.abs(s) - wsum) / Math.abs(vbs), t2c = (Math.abs(s) + wsum) / Math.abs(vbs);
              if (t1 < 2) {
                const bT = b.hl * Math.abs(bLx * tx + bLz * tz) + b.r * Math.abs(bLz * tx - bLx * tz); // phần thân b chìa theo hướng phố
                const L = aT + bT + 0.3, fr = f + b.v * cosB * t1, ua = (fr - L) / a.v; // fr: chỗ dọc phố của b lúc nó vào vệt; ua: lúc mũi a tới đó
                if (fr > L && ua > t1 - 0.25 && ua < t2c + 0.25) { const tt = Math.max(0, (fr - L - 0.45) * 1.2 - 0.3); if (tt < target) { target = tt; blk = b; } }
              }
            }
          }
          if (f > 0.2 && f < (cross ? a.hl + bext + 1 + a.v * 0.45 : gap + b.hl) && Math.abs(s) < wsum) {
            // Gỡ thế khoá: hai xe cắt ngang hoặc đối đầu đứng chắn mũi nhau thì không xe nào tự thoát được. Xe có số thứ tự nhỏ hơn
            // lách qua trước (coi như xe kia né mũi cho qua) sau 1,2 giây; kẹt quá 9 giây sau một xe đứng chắn ngang thì xe nào cũng
            // lách. Không áp dụng cho xe cùng chiều phía trước (xếp hàng thì chờ).
            if (cosB < 0.6 && b.v < 0.3) {
              if (a.pushB === b && a.pushT > 0) continue;
              // (hai thân xe đã chạm nhau thì gỡ ngay, không chờ)
              if (a.stuck > 9 || (a.id < b.id && (a.stuck > 1.2 || dx * dx + dz * dz < (a.r + b.r + 0.3) ** 2) && (cosB < -0.6 || this.facing(b, a)))) { a.pushB = b; a.pushT = 2.5; if (a.v < 1.6) a.v = 1.6; continue; }
            }
            const bv = b.v * cosB, room = f - (cross ? a.hl + bext : ov) - 0.45;
            let t2 = Math.max(0, bv + room * 1.2 - 0.3);
            // xe cắt ngang hoặc đi ngược đang chắn nhau: xe có số thứ tự nhỏ hơn được lách qua trước (không đứng nhìn nhau mãi)
            if (cosB < 0.6 && room > 0.15 && (a.id < b.id || b.v < 0.3 && a.sq > 0)) t2 = Math.max(t2, 1.5);
            if (a.sq > 0 && room > 0.1) t2 = Math.max(t2, 0.9);
            // vòng chờ nhau (hai xe cùng hướng đứng cạnh nhau ở chỗ đường tách đôi, mỗi xe coi xe kia là xe trước; hoặc vòng dài hơn):
            // xe có số thứ tự nhỏ nhất trong vòng bỏ qua xe chắn để đi trước, các xe còn lại chờ như thường
            if (b.v < 0.3 && a.stuck > 0.8 && this.cycle(a, b)) continue;
            if (t2 < target) { target = t2; blk = b; if (this.trace) a.blc = cosB; }
            blocked = true;
            shift += (s > 0.06 ? -1 : s < -0.06 ? 1 : a.latT > 0 ? -1 : 1) * (bike ? 1 : 0.4); // lách sang bên trống (ô tô lách ít hơn)
            if (cosB > 0.6 && f < leadF) { lead = b; leadF = f; }
          } else if (f > -ov - 0.2 && f <= 0.2 + ov && Math.abs(s) < wsum + 0.3 && cosB > 0) { if (Math.abs(s) < wsum + 0.12) side += s > 0.01 ? -1 : s < -0.01 ? 1 : a.id < b.id ? -1 : 1; if (s > 0) rb = true; else lb = true; } // đi song song quá sát: dạt ra, không lách thêm về phía đó
          // hai thân xe cùng chiều đang lồng vào nhau (bị dồn khi nhập làn, khi xếp hàng): tách ngang ra ngay, xe nhẹ nhường xe nặng
          const share = a.cls === b.cls ? 0.5 : (a.cls === 0 || a.cls === 3) && b.cls !== 0 && b.cls !== 3 ? 1 : b.cls === 0 || b.cls === 3 ? 0.1 : 0.5;
          if (cosB > 0.6 && Math.abs(f) < ov * 0.9 && Math.abs(s) < a.r + b.r) { const need = a.r + b.r - Math.abs(s); sep += (s > 0.01 ? -1 : s < -0.01 ? 1 : a.id < b.id ? -1 : 1) * need * share; }
          // Hai thân xe cắt chéo hay đối đầu đã lồng vào nhau (xe cắt ngang lao vào lòng nút, dồn ngang lúc rẽ sang phố hẹp hơn): mỗi xe
          // dạt theo phương ngang của chính nó phần độ lồng chiếu lên phương đó (trục tách ngắn nhất của hai hình chữ nhật). Xe cắt ngang
          // thì phương ngang của xe này gần trùng phương dọc của xe kia, nên hai xe tự tách đúng hướng. Không huỷ bước tiến nào nên
          // không gây tắc; chỉ lấy phần lồng quá 12 cm (khung va chạm xe máy rộng hơn hình vẽ chừng 10 cm mỗi bên).
          else if (cosB <= 0.6 && dx * dx + dz * dz < (a.hl + b.hl + a.r + b.r) ** 2) {
            const dp = this.overlap(a.x, a.z, a.yaw, a.r, a.hl, b);
            if (dp > 0.12) { const ur = this._ux * rx + this._uz * rz; if (Math.abs(ur) > 0.25) sepX -= Math.sign(ur) * (dp - 0.12) * Math.abs(ur) * share * 2; }
          }
        }
      }
      a.blk = blk; // xe đang chắn a (đọc bởi cycle() của các xe khác)
      // Nhập làn ở cuối cạnh: (1) chỗ sắp rẽ vào đang có xe thì coi xe đó là xe trước mặt, tính theo quãng đường dọc lối rẽ;
      // (2) xe khác cũng sắp rẽ vào cùng phố mà gần nút hơn (hoặc ngang nhau mà số thứ tự nhỏ hơn) và sẽ chiếm cùng vệt thì nhường nó.
      // Vệt của mỗi xe trên phố mới tính bằng entryLat.
      if (a.ne !== null && rem < 16) {
        const ne = a.ne, c4 = ne.i * 4 + (a.nd > 0 ? 1 : 0), la = this.entryLat(a, ne);
        const H = this.mlistAt(c4);
        if (H !== null) for (let i = 0; i < H.n; i++) { const b = H.a[i], pf = rem + b.s; if (b === a || pf > gap + b.hl || Math.abs(la - b.lat) >= a.r + b.r + 0.1) continue;
          if (b.v < 0.3 && a.stuck > 0.8 && this.cycle(a, b)) continue;
          const t2 = Math.max(0, b.v + (pf - a.hl - b.hl - 0.45) * 1.2 - 0.3); if (t2 < target) { target = t2; a.blk = b; } blocked = true; }
        const I = this.mlistAt(c4 + 2);
        if (I !== null) for (let i = 0; i < I.n; i++) { const b = I.a[i]; if (b === a) continue; const rb2 = b.e.len - b.s, d = rem - rb2; if (d < 0 || (d < 1e-3 && b.id > a.id) || d > a.hl + b.hl + 0.5 + a.v * 0.4) continue;
          if (Math.abs(la - this.entryLat(b, ne)) >= a.r + b.r + 0.1) continue;
          // xe kia cùng cạnh và đang ở ngay trước mũi thì luật bám đuôi thường đã lo; ở đây lo trường hợp chạy song song hoặc tới từ cạnh khác
          if (b.v < 0.3 && a.stuck > 0.8 && this.cycle(a, b)) continue;
          const t2 = Math.max(0, b.v + (d - a.hl - b.hl - 0.3) * 1.2 - 0.3); if (t2 < target) { target = t2; a.blk = b; } blocked = true; }
      }
      // không chui vào lòng nút khi xe ngay phía trước còn nằm chắn trong đó: chờ ở vạch tới khi nó chạy thoát
      if (atLine < 99 && lead !== null && lead.v < 1.2 && leadF > atLine + a.hl + 0.5 && !(a.stuck > 0.8 && this.cycle(a, lead))) { const t2 = Math.max(0, atLine * 1.2); if (t2 < target) { target = t2; a.blk = lead; } }
      // xe trước chậm hẳn (xích lô, xe đạp, xe buýt đang rù rì): tìm cách vượt, ô tô chỉ lấn sang phần đường ngược chiều khi thoáng
      // (trên đường hai chiều: chỉ khi phần đường ngược chiều thoáng và không ở sát nút giao; trong lòng nút mà lấn trái là hai dòng
      // ngược chiều đâm đầu vào nhau rồi khoá cứng)
      const mid = e.oneway || (rem > 28 && a.s > 10 && a.sg === null);
      if (lead && a.cls !== 3 && lead.v < free * 0.62 && !red && !lead.red && mid) { a.slowT += dt; if (a.slowT > 1 && a.over <= 0 && (e.oneway || this.clearLeft(a, tx, tz, rx, rz))) a.over = 3.5; } else a.slowT = 0;
      if (a.over > 0) { a.over -= dt; if (!e.oneway && rem < 16) a.over = 0; }
      // người chơi: xe đoán chỗ người chơi sẽ tới, vòng ra sau lưng người đang bước; chắn ngay trước mũi thì dừng chờ
      let pblock = false;
      if (Math.abs(player.y - a.y) < 2) {
        const dx = px - a.x, dz = pz - a.z, f = dx * tx + dz * tz, s = dx * rx + dz * rz, wsum = a.r + pr + (e.w < 5 ? 0.04 : pv > 0.3 ? 0.35 : 0.22); // trong ngõ hẹp xe len sát qua người
        if (f > -0.3 && f < gap + 2 + (walking ? a.v * 0.7 : 0) && Math.abs(s) < e.w) {
          const pvf = pv * (pfx * tx + pfz * tz), pvs = walking ? pv * (pfx * rx + pfz * rz) : 0;
          const tArr = clamp((f - a.hl) / Math.max(a.v - pvf, 1), 0, 2.2), sp = s + pvs * tArr, cross = s * sp < 0;
          if (cross || Math.abs(sp) < wsum + 0.8 || Math.abs(s) < wsum + 0.5) {
            const dirS = Math.abs(pvs) > 0.35 ? (pvs > 0 ? -1 : 1) : s > 0 ? -1 : 1;
            shift += dirS * (bike ? 1.8 : 0.6);
            const creep = a.wait > 2.2 && Math.abs(s) > a.r + pr - 0.1; // người chơi đứng chắn mãi: len thật chậm qua sát bên
            if (creep) target = Math.min(target, 1); else
            if (Math.abs(s) < wsum || (cross && tArr < 1.3) || (Math.abs(sp) < wsum && tArr < 1)) {
              target = Math.min(target, Math.max(0, (walking ? 0 : pvf) - 0.3 + (f - a.hl - pr - 0.6) * 1.3)); blocked = true; pblock = true; if (target < 0.6) a.wait += dt;
            } else target = Math.min(target, e.w < 5 ? 2 : Math.max(2.4, free * 0.7)); // lướt qua sát người đi bộ thì giảm ga
          }
        }
        // chạm vào nhau: đẩy người chơi ra, xe dừng lại (thân xe là hình viên thuốc dài theo chiều xe)
        const fc = clamp(f, -(a.hl - a.r), a.hl - a.r), qx = dx - tx * fc, qz = dz - tz * fc, d2 = qx * qx + qz * qz, rr = a.r + pr;
        if (d2 < rr * rr && d2 > 1e-4 && !this.blind) {
          const d = Math.sqrt(d2), push = (rr - d) * 0.6; player.pos.x += (qx / d) * push; player.pos.z += (qz / d) * push; a.wait += dt * 2;
          if (a.v > 1.2 && a.hitT <= 0 && f > a.hl - a.r - 0.3) { this.stats.hits++; this.lastHit = { type: a.type, v: a.v, f, s, lat: a.lat, latT: a.latT, w: e.w, oneway: e.oneway }; if (walking) a.hitT = 0.5; }
          // va chạm theo bảo toàn động lượng dọc hướng xe người chơi: xe nặng (ô tô, xe buýt) gần như không suy suyển, xe máy thì cả hai cùng khựng
          if (!walking && a.hitT <= 0) {
            const cosA = Math.sin(a.yaw) * pfx + Math.cos(a.yaw) * pfz, u2 = a.v * cosA, rel = pv - u2, ahead = (-dx) * pfx + (-dz) * pfz > 0;
            if ((ahead && rel > 0.8) || (!ahead && rel < -0.8)) {
              const [v1, v2] = collide1D(bikeMass(!!player.passenger), pv, TYPES[a.type].mass, u2);
              player.speed = v1; a.v = Math.max(0, a.v + (v2 - u2) * cosA); a.hitT = 0.5;
              if (Math.abs(rel) > 2) { player.wobble = Math.max(player.wobble, Math.min(1, Math.abs(rel) / 6)); this.touch += Math.min(3, Math.abs(rel) / 3); }
            }
          } else if (walking) a.v *= 0.5;
        }
        if (a.hitT > 0) a.hitT -= dt;
        // xe máy của người chơi dựng giữa đường cũng là vật cản: lách qua, sát quá thì dừng
        if (walking && bk) { const bx = bk.x - a.x, bz = bk.z - a.z, f2 = bx * tx + bz * tz, s2 = bx * rx + bz * rz, w2 = a.r + 0.62;
          if (f2 > -0.5 && f2 < gap + 2 && Math.abs(s2) < w2 + 0.5) { shift += (s2 > 0 ? -1 : 1) * (bike ? 1.6 : 0.6); if (Math.abs(s2) < w2) { target = Math.min(target, Math.max(0, (f2 - a.hl - 1.5) * 1.3)); blocked = true; pblock = true; } } }
      }
      if (a.wait > 1.1 && a.honk <= 0 && !a.red && a.type !== VT.bicycle && a.type !== VT.cyclo) { this.honks.push([a.x, a.z, a.cls === 0 ? 0 : 3]); a.honk = 2.5 + Math.random() * 3; a.wait = 0; }
      if (!blocked) a.wait = Math.max(0, a.wait - dt);
      // kẹt: sau 3 giây thì co mình lách qua khe hẹp; kẹt cứng quá 7 giây ở chỗ người chơi không nhìn thấy thì cho xe biến mất để gỡ nút thắt
      a.red = (red && a.v < 1.5) || (lead !== null && lead.red && lead.v < 0.8); // đang chờ đèn đỏ (kể cả xếp hàng sau xe chờ đèn) thì không tính là kẹt
      if (blocked && a.v < 0.4 && !a.red) a.stuck += dt; else a.stuck = Math.max(0, a.stuck - dt * 3);
      if (a.sq > 0) a.sq -= dt; else if (a.stuck > 3 && !pblock) { a.sq = 2.5; this.stats.unstuck++; }
      if (a.stuck > 7) { const d2 = (a.x - px) ** 2 + (a.z - pz) ** 2; const back = cam && (a.x - cam.x) * cam.fx + (a.z - cam.z) * cam.fz < -2; if (this.blind || (d2 > 200 && back) || d2 > 32400 || (d2 > 1600 && (!cam || a.stuck > 25 || (this.occluded && this.occluded(a.x, a.z))))) { a.x = 1e9; continue; } } // ở xa mà kẹt quá 25 giây thì gỡ cả khi đang trong tầm nhìn, kẻo nút thắt tồn tại mãi
      a.honk -= dt;
      // lách: dịch vị trí ngang mong muốn, rồi trôi dần về làn quen; xe máy lạng nhẹ qua lại
      const hw = e.w / 2 - a.r - 0.15, lo = e.oneway ? -hw : a.over > 0 ? -hw * 0.75 : bike ? 0.5 : a.cls === 3 ? 0.4 : a.cls === 2 ? 1.36 : 1.0;
      if (a.over > 0 && lead && !shift) shift = -1;
      if (((shift < 0 && lb) || (shift > 0 && rb)) && !(pblock && a.wait > 0.5)) shift = 0; // bị người chơi chắn lâu thì cứ ép sang, xe bên cạnh sẽ dạt ra
      // mép trái phần đường của mình; đang có xe đứng sát bên phải (vừa vượt lên đầu hàng chờ) thì không ép dạt về đè lên xe đó
      const loE = rb ? Math.min(lo, hw, a.lat) : Math.min(lo, hw);
      if (shift) a.latT = clamp(a.latT + Math.sign(shift) * dt * (bike ? 2.4 : 1.5), loE, hw);
      else if (side) a.latT = clamp(a.latT + Math.sign(side) * dt * 1.1, loE, hw);
      else if (Math.random() < dt * 0.25) this.lane(a);
      // có xe chạy song song sát bên thì không trôi thêm về phía đó (kẻo đè lên nhau lúc xếp hàng chờ đèn)
      if (lb && a.latT < a.lat) a.latT = a.lat; if (rb && a.latT > a.lat) a.latT = a.lat;
      // đang ở phần đường ngược chiều của đường hai chiều (vừa rẽ vào, vừa vượt xong): về bên phải nhanh hơn
      // xe đứng yên trong hàng chờ thì không trượt ngang (trôi ngang lúc dừng là chui vào sườn xe bên cạnh); riêng xe đang chờ người
      // đi bộ chắn trước mũi hoặc đang co mình gỡ kẹt thì vẫn dắt ngang được (người lái chống chân lách qua)
      const latRate = a.v > 1.2 || pblock || a.sq > 0 ? 1 : a.v / 1.2;
      a.lat = damp(a.lat, clamp(a.latT + (lb || rb ? 0 : Math.sin(T * a.wobF + a.wob) * a.wobA), loE, hw), (!e.oneway && a.lat < 0.2 && a.over <= 0 ? 5 : 2.2) * latRate, dt);
      // phần dạt ngang để tách thân xe lồng nhau không bao giờ đẩy xe về phía người chơi đang đứng sát bên
      if (sepX !== 0) { const dx = px - a.x, dz = pz - a.z, pf = dx * tx + dz * tz, ps = dx * rx + dz * rz; if (!(Math.abs(player.y - a.y) < 2 && Math.abs(pf) < a.hl + 1 && Math.abs(ps) < a.r + pr + 1.2 && ps * sepX > 0)) sep += sepX; }
      if (sep !== 0) { const lim = e.oneway ? -hw : Math.max(-hw, -0.4); a.lat = clamp(a.lat + clamp(sep, -1.6 * dt, 1.6 * dt), Math.min(lim, a.lat), Math.max(hw, a.lat)); if ((sep < 0 && a.latT > a.lat) || (sep > 0 && a.latT < a.lat)) a.latT = a.lat; }
      a.v = damp(a.v, target, target < a.v ? 4.5 : a.cls === 3 ? 1 : 1.6, dt);
      a.s += a.v * dt;
      if (a.s >= e.len) { const over = a.s - e.len; if (!this.nextEdge(a)) { a.x = 1e9; continue; } a.s = over; }
      this.sample(a.e, a.s, a.dir, o);
      const gxp = o[0] - o[3] * a.lat, gzp = o[1] + o[2] * a.lat;
      const ox = a.x, oz = a.z, k = 1 - Math.exp(-dt * 7);
      a.x += (gxp - a.x) * k; a.z += (gzp - a.z) * k;
      const mvx = a.x - ox, mvz = a.z - oz;
      // hướng đầu xe: theo hướng đang trôi nhưng không lệch khỏi hướng phố quá góc đánh lái của loại xe đó
      // (xe bò chậm mà dạt ngang thì không được quay ngang ra giữa đường); gần như đứng yên thì giữ nguyên hướng
      if (mvx * mvx + mvz * mvz > (0.25 * dt) ** 2) {
        // xe bò chậm mà dạt ngang (xếp hàng, lách khe) thì người lái chống chân dắt xe sang, đầu xe gần như vẫn thẳng theo phố: góc
        // lệch tối đa giảm theo tốc độ (quay đầu 37° lúc đứng gần như yên là chúi mũi sang sườn xe bên cạnh)
        const ty = Math.atan2(o[2], o[3]), lim = (a.cls === 0 ? 0.65 : a.cls === 2 ? 0.22 : a.cls === 1 ? 0.32 : 0.5) * clamp(a.v / 4, 0.2, 1);
        let dev = Math.atan2(mvx, mvz) - ty; dev = Math.atan2(Math.sin(dev), Math.cos(dev));
        const ny = ty + clamp(dev, -lim, lim), dy = ny - a.yaw; a.yaw = dampAngle(a.yaw, ny, a.cls === 0 ? 9 : 5, dt);
        const turn = Math.atan2(Math.sin(dy), Math.cos(dy)); a.lean = damp(a.lean, bike || a.type === VT.bicycle ? clamp(-turn * a.v * 0.9, -0.45, 0.45) : 0, 5, dt);
      } else a.lean = damp(a.lean, 0, 5, dt);
    }
  }
  // Độ lồng (m) giữa hai thân xe hình chữ nhật (nửa ngang r, nửa dọc hl, trục dọc theo yaw), theo định lý trục tách; âm là còn hở.
  // Trục tách ngắn nhất (hướng từ a sang b) ghi vào this._ux, this._uz.
  overlap(ax, az, ayaw, ar, ahl, b) {
    const sa = Math.sin(ayaw), ca = Math.cos(ayaw), sb = Math.sin(b.yaw), cb = Math.cos(b.yaw), dx = b.x - ax, dz = b.z - az; let best = 1e9;
    // bốn trục: dọc a (sa, ca), ngang a (ca, -sa), dọc b, ngang b
    for (let k = 0; k < 4; k++) {
      const ux = k === 0 ? sa : k === 1 ? ca : k === 2 ? sb : cb, uz = k === 0 ? ca : k === 1 ? -sa : k === 2 ? cb : -sb;
      const ra = ahl * Math.abs(sa * ux + ca * uz) + ar * Math.abs(ca * ux - sa * uz), rb = b.hl * Math.abs(sb * ux + cb * uz) + b.r * Math.abs(cb * ux - sb * uz);
      const d = dx * ux + dz * uz, ov = ra + rb - Math.abs(d); if (ov < best) { best = ov; const sg = d < 0 ? -1 : 1; this._ux = ux * sg; this._uz = uz * sg; if (best <= 0) return best; }
    }
    return best;
  }
  // b đang chắn a; theo chuỗi "ai chắn ai" từ b có quay về a không (tối đa 6 bước). Có thì trả true nếu a có số thứ tự nhỏ nhất vòng.
  cycle(a, b) {
    let q = b, min = a.id;
    for (let k = 0; k < 6 && q; k++) { if (q === a) return a.id === min; if (q.id < min) min = q.id; if (q.v >= 0.3) return false; q = q.blk; }
    return false;
  }
  // Xe b có đang nằm chắn ngay trước mũi xe a không (trong hành lang a sắp đi qua, tính thân xe b theo chiều dài của nó).
  facing(a, b) {
    const hx = Math.sin(a.yaw), hz = Math.cos(a.yaw), dx = b.x - a.x, dz = b.z - a.z, f = dx * hx + dz * hz, s = dx * hz - dz * hx;
    return f > 0 && f < a.hl + b.r + 2.5 && Math.abs(s) < a.r + Math.max(b.r, b.hl * 0.8) + 0.3;
  }
  // Phần đường bên trái (ngược chiều) có thoáng trong 30 m tới không: ô tô, xe buýt chỉ vượt khi không có xe đi ngược lại.
  clearLeft(a, tx, tz, rx, rz) {
    for (const b of this.agents) {
      const dx = b.x - a.x, dz = b.z - a.z; if (dx * dx + dz * dz > 1300) continue;
      const f = dx * tx + dz * tz, s = dx * rx + dz * rz;
      if (f > -2 && f < 34 && s < -0.3 && s > -a.e.w && Math.sin(b.yaw) * tx + Math.cos(b.yaw) * tz < 0.3) return false;
    }
    return true;
  }
}
