// Đồ đạc đường phố và biển báo của Hà Nội 2026 (docs/18, mục 1, 2, 8): biển tên phố thật ở các góc phố và đầu ngõ, đèn
// tín hiệu có đồng hồ đếm ngược, ô đỗ xe máy kẻ vạch trên vỉa hè, tủ điện và trạm biến áp, điểm dừng xe buýt, loa phường,
// phướn và cờ, băng rôn đỏ ngang phố, rào tôn công trường ga ngầm, ban thờ gốc cây.
// Chạy trong worker, sau gen/decor.js. Hình không có chữ gộp vào lưới "gần" (near); mọi thứ có chữ hoặc đèn đổi pha vào
// lưới pg, vẽ bằng "bảng đồ đạc" (streetnames.js, streetatlas.js): thêm đúng một lệnh vẽ cho mỗi ô phố ở gần.
// Vật đặt trên vỉa hè không cản lối đi: hoặc mảnh và sát bó vỉa, sát tường (không va chạm), hoặc chỉ đặt ở vỉa hè đủ rộng
// và có va chạm (trạm biến áp, vách nhà chờ, rào công trường).
import { G } from '../../core/geo.js';
import { hash, segDist2 } from '../../core/util.js';
import { CURB, K, ZONE, zoneAt, isSolemn, F_ONEWAY, F_REVERSE, alongAt } from '../data.js';
import { junctionsOf, nodeKey } from '../junctions.js';
import { plateLayout, PLATE_W, PLATE_H, PLATE_BLUE, INK_YELLOW, INK_DARK, sigCode } from '../streetnames.js';
import { signUV, FLAG_CELL } from '../signs.js';
import { motorbike } from '../../models/vehicles.js';
import { TREES, namePole, signPlate, signalMast, signalPost, signalFar, cabinet, kiosk, busSign, busShelter, parkSign, speakers, pennants, houseFlag, hoardingPanel, crane, excavator, siteCabin, treeShrine } from '../../models/street.js';

const BIKE_TINT = [[0.55, 0.03, 0.03], [0.02, 0.02, 0.025], [0.75, 0.75, 0.73], [0.05, 0.12, 0.4], [0.35, 0.36, 0.38], [0.08, 0.08, 0.09], [0.6, 0.6, 0.62], [0.02, 0.2, 0.12], [0.02, 0.25, 0.3]];
let BIKES = null;
const bikes = () => BIKES || (BIKES = [motorbike(new G(), 'wave', 0), motorbike(new G(), 'scooter', 0), motorbike(new G(), 'scooter', 0), motorbike(new G(), 'cub', 0)]);

// Trục du lịch, phố đi bộ: không gắn loa phường. Phố treo phướn đôi trên cột đèn. Phố đã giăng đèn lồng thì thôi băng rôn.
const NO_SPEAKER = /Đinh Tiên Hoàng|Lê Thái Tổ|Hàng Khay|Tràng Tiền|Hàng Đào|Hàng Ngang|Hàng Đường|Đồng Xuân|Hùng Vương|Điện Biên Phủ/;
const PENNANT = /Tràng Tiền|Đinh Tiên Hoàng|Điện Biên Phủ|Hùng Vương/;
const NO_BANNER = /Hàng Mã|Hàng Lược|Tạ Hiện|Lương Văn Can|Hùng Vương|Đinh Tiên Hoàng|Lê Thái Tổ/;

// Công trường có rào tôn (docs/18, mục 8). road: tên phố có rào; runs: các đoạn rào, mỗi đoạn một khung giới hạn
// [x0,z0,x1,z1] và một điểm toward ở phía trong công trường (rào dựng bên lề phía đó); off: khoảng lùi từ bó vỉa;
// text: các ô khẩu hiệu trên rào; props: máy móc [loại, x, z, góc quay, chiều dài cần].
const SITES = [
  // Ga ngầm S12 trước Ga Hà Nội, trên phố Trần Hưng Đạo: đoạn sát Lê Duẩn rào bên nam (bãi máy phía trong), đoạn tới Phan Bội Châu rào bên bắc
  { id: 's12', road: 'Phố Trần Hưng Đạo', off: 1.1, col: [0.05, 0.15, 0.3], text: [2, 1, 0],
    runs: [{ box: [-1097, 505, -1058, 545], toward: [-1085, 560] }, { box: [-1052, 505, -962, 590], toward: [-1010, 480] }],
    props: [['crane', -1084, 530.5, -0.36, 24], ['cabin', -1067.5, 537.5, -0.36]] },
  // Ga ngầm S11 Văn Miếu, lề nam phố Quốc Tử Giám
  { id: 's11', road: 'Phố Quốc Tử Giám', off: 1.2, col: [0.05, 0.15, 0.3], text: [2, 0, 1],
    runs: [{ box: [-1572, 228, -1462, 322], toward: [-1530, 320] }],
    props: [['crane', -1512, 302, 1.05, 28], ['cabin', -1503, 309.5, -0.49], ['cabin', -1559, 274, -0.49]] },
  // Khu giải toả phía đông Hồ Gươm (quảng trường, công viên tương lai): rào phía phố Lý Thái Tổ, bên trong còn máy xúc san nền
  { id: 'east', road: 'Phố Lý Thái Tổ', off: 1.4, col: [0.05, 0.3, 0.2], text: [0, 1],
    runs: [{ box: [236, -166, 345, -30], toward: [215, -90] }],
    props: [['excavator', 262, -112, 2.6], ['excavator', 238, -62, 0.7], ['cabin', 276, -70, 1.25]] },
];

export function furnish(ctx, env) {
  const { near, far, plate: pg, X0, Z0, X1, Z1, cx, cz, inChunk, free, onRoad, roads, bld, extra, occ } = env;
  const W = ctx.world, J = junctionsOf(W), L = plateLayout(W), mark = env.mark || (() => {});
  const jc = J.byChunk.get(cx * 1000 + cz), walls = [], o5 = [0, 0, 0, 0, 0];
  const clear = (x, z, r) => { for (const q of occ) if ((q[0] - x) ** 2 + (q[1] - z) ** 2 < (r + q[2]) ** 2) return false; return true; };
  const hold = (x, z, r) => occ.push([x, z, r]);
  const wallsNear = [...ctx.wallGrid.collect(X0 - 8, Z0 - 8, X1 + 8, Z1 + 8)];
  const nearWall = (x, z, r) => {
    for (const w of wallsNear) {
      if (x < w.bb[0] - r || x > w.bb[2] + r || z < w.bb[1] - r || z > w.bb[3] + r) continue;
      const p = w.p; for (let i = 0; i < p.length - 2; i += 2) if (segDist2(x, z, p[i], p[i + 1], p[i + 2], p[i + 3]) < r * r) return true;
    }
    return false;
  };

  // ===================== 1. biển tên phố ở góc phố, đầu ngõ =====================
  // Vỉa hè đủ rộng: cột thép ở góc vỉa hè, mỗi biển vươn dọc theo con phố mang tên nó (hai biển vuông góc nhau).
  // Vỉa hè hẹp (phố cổ): biển gắn thẳng lên tường nhà góc phố, ngay trên dải biển hiệu, mỗi biển trên mặt tường quay ra phố của nó.
  const ringDir = (p) => { let a = 0; for (let k = 0, n = p.length; k < n; k += 2) { const j = (k + 2) % n; a += p[k] * p[j + 1] - p[j] * p[k + 1]; } return a > 0 ? 1 : -1; };
  // mặt tường của nhà B quay về hướng (fx,fz), gần điểm (px,pz) nhất; biển đặt ở đầu tường phía nút giao (qx,qz)
  const wallSpot = (B, fx, fz, px, pz, qx, qz) => {
    const p = B.p, n = p.length, dir = ringDir(p); let best = null, bd = 49;
    for (let k = 0; k < n; k += 2) {
      const ax = p[k], az = p[k + 1], bx = p[(k + 2) % n], bz = p[(k + 3) % n], ex = bx - ax, ez = bz - az, Le = Math.hypot(ex, ez); if (Le < PLATE_W + 0.5) continue;
      const nx = (ez / Le) * dir, nz = (-ex / Le) * dir; if (nx * fx + nz * fz < 0.72) continue;
      const d = segDist2(px, pz, ax, az, bx, bz); if (d < bd) { bd = d; best = [ax, az, bx, bz, Le, nx, nz]; }
    }
    if (!best) return null;
    const [ax, az, bx, bz, Le, nx, nz] = best, nearA = (ax - qx) ** 2 + (az - qz) ** 2 < (bx - qx) ** 2 + (bz - qz) ** 2;
    const sx = nearA ? ax : bx, sz = nearA ? az : bz, k = (nearA ? 1 : -1) / Le, d = 0.32 + PLATE_W / 2, x = sx + (bx - ax) * k * d, z = sz + (bz - az) * k * d;
    if (ctx.buildingAt(x + nx * 0.45, z + nz * 0.45)) return null; // tường giáp nhà bên cạnh
    return { x, z, nx, nz };
  };
  const wallPlate = (B, sp, name) => {
    const uv = L.uvOf(name); if (!uv || !sp || B.height < 2.9) return false;
    // ngay trên dải biển hiệu cửa hàng (gen/decor.js), dưới ban công tầng hai
    const fh = B.height / Math.max(1, B.floors); let y = Math.min(fh * 0.975, fh * 0.775 + 0.95) + 0.04; if (y + PLATE_H > B.height - 0.05) y = B.height - PLATE_H - 0.12;
    pg.push().move(sp.x - X0, y, sp.z - Z0).rotY(Math.atan2(sp.nx, sp.nz));
    signPlate(pg, -PLATE_W / 2, 0, PLATE_W, PLATE_H, uv, PLATE_BLUE, { back: false, z: 0.035 }); pg.pop();
    mark('wplate', sp.x, sp.z, sp.nx, sp.nz, 0.8); return true;
  };
  const placePlates = (s) => {
    const n = s.n, a = s.a, c = s.c, M = 0.5; let px, pz, ux, uz;
    if (c) {
      const sn = Math.sin(s.g); px = n.x + (a.dx * (c.w / 2 + M) + c.dx * (a.w / 2 + M)) / sn; pz = n.z + (a.dz * (c.w / 2 + M) + c.dz * (a.w / 2 + M)) / sn;
      ux = a.dx + c.dx; uz = a.dz + c.dz; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul; // (ux,uz): từ góc vỉa hè vào trong khối phố
    } else { ux = a.dz; uz = -a.dx; px = n.x + ux * (a.w / 2 + M); pz = n.z + uz * (a.w / 2 + M); }
    const list = s.alley ? [[s.alley, s.alleyArm, s.main]] : [[s.na, a, a], [s.nc, c || s.o, c || a]]; // [tên, nhánh mang tên, nhánh mà mặt tường treo biển quay ra]
    let roomy = free(px, pz) && !onRoad(px, pz, 0.2) && !ctx.buildingAt(px + ux * 0.6, pz + uz * 0.6) && !ctx.buildingAt(px + ux * 1.2, pz + uz * 1.2);
    if (roomy && !clear(px, pz, 0.3)) { px += ux * 0.55; pz += uz * 0.55; roomy = clear(px, pz, 0.3) && !ctx.buildingAt(px + ux * 0.9, pz + uz * 0.9); }
    // nhà góc phố (trong vòng 4,5 m) và mặt tường của nó quay ra phố `face`
    let B = null; for (const d of [0, 0.5, 1, 1.6, 2.4, 3.2, 4.5]) { B = ctx.buildingAt(px + ux * d, pz + uz * d); if (B) break; }
    const onWall = () => {
      let done = 0; if (!B) return 0;
      for (const [name, , face] of list) {
        if (!name) continue;
        const k = ux * face.dx + uz * face.dz; let fx = -(ux - k * face.dx), fz = -(uz - k * face.dz); const fl = Math.hypot(fx, fz); if (fl < 0.05) continue; fx /= fl; fz /= fl;
        if (wallPlate(B, wallSpot(B, fx, fz, px, pz, n.x, n.z), name)) done++;
      }
      return done;
    };
    // phố cổ: một nửa số góc phố gắn biển thẳng lên tường nhà; đầu ngõ thì phần lớn gắn tường. Còn lại cắm cột.
    if (roomy && B && (s.alley ? hash(n.k, 21) < 0.65 : zoneAt(n.x, n.z) === ZONE.old && hash(n.k, 21) < 0.5) && onWall()) return;
    if (roomy) {
      namePole(near, px - X0, pz - Z0, CURB); hold(px, pz, 0.3); mark('plate', px, pz);
      for (const [name, arm] of list) {
        const uv = name && L.uvOf(name); if (!uv) continue;
        pg.push().move(px - X0, CURB, pz - Z0).rotY(Math.atan2(-arm.dz, arm.dx)); signPlate(pg, 0.058, 2.13, PLATE_W, PLATE_H, uv, PLATE_BLUE); pg.pop();
        mark('plate', px, pz, arm.dx, arm.dz, 0.9);
      }
      return;
    }
    if (!onWall()) mark('fail', px, pz);
  };
  if (jc) for (const s of jc.plates) placePlates(s);

  // ===================== 2. đèn tín hiệu ở nút giao lớn =====================
  // Mỗi nhánh có xe đi vào nút một cột bên phải, trước vạch dừng; nút lớn dùng cột có cần vươn, phố nhỏ dùng cột thẳng.
  if (jc) for (const sg of jc.signals) for (const ar of sg.arms) {
    if (!ar.inbound) continue;
    const rx = ar.dz, rz = -ar.dx; // bên phải của xe đang chạy vào nút
    let px = 0, pz = 0, ok = false;
    for (const [st, off] of [[ar.stop, 0.55], [ar.stop + 1.5, 0.55], [ar.stop, 0.3], [ar.stop + 3, 0.5], [ar.stop + 5, 0.5], [ar.stop + 7.5, 0.5]]) { // lùi dần ra xa nút nếu chỗ đó vướng
      px = ar.x + ar.dx * st + rx * (ar.w / 2 + off); pz = ar.z + ar.dz * st + rz * (ar.w / 2 + off);
      if (free(px, pz) && !onRoad(px, pz, 0.15) && clear(px, pz, 0.3)) { ok = true; break; }
    }
    if (!ok) continue;
    const yaw = Math.atan2(ar.dx, ar.dz), code = (kind) => sigCode(kind, ar.grp, sg.last8, sg.off);
    const mast = sg.big && ar.kind <= K.tertiary && ar.w >= 6.5, arm = Math.min(5.6, Math.max(2.6, ar.w * (ar.ow ? 0.55 : 0.36)));
    if (mast) { signalMast(near, pg, px - X0, pz - Z0, CURB, yaw, { arm, code, L }); signalFar(far, px - X0, pz - Z0, CURB, yaw, arm); }
    else signalPost(near, pg, px - X0, pz - Z0, CURB, yaw, { code, L });
    hold(px, pz, 0.35); mark('signal', px, pz, -rx, -rz, mast ? arm : 0.6);
  }

  // ===================== 3. dọc bó vỉa: điểm dừng xe buýt, trạm biến áp, tủ điện, ô đỗ xe máy =====================
  // Đi dọc từng phố theo từng khoang 6 m, mỗi bên lề; mỗi khoang nhiều nhất một thứ, chọn theo hạt giống của khoang.
  // chỗ gen/decor.js bày bàn ghế quán cóc (cùng công thức đặt chỗ): đồ đạc sát bó vỉa tránh ra
  for (const i of ctx.foodIdx.get(cx * 1000 + cz) || []) {
    const x = W.food[i], z = W.food[i + 1], rd = ctx.nearestRoad(x, z, 22, (r) => r.veh && r.kind <= K.residential); if (!rd || rd.d < 0.5) continue;
    hold(rd.px + ((x - rd.px) / rd.d) * (rd.r.w / 2 + 1.05), rd.pz + ((z - rd.pz) / rd.d) * (rd.r.w / 2 + 1.05), 1.7);
  }
  const STEP = 6, white = () => near.mat().gloss(0).glow(0).rgb(0.72, 0.72, 0.68);
  const depthAt = (kx, kz, nx, nz, max) => { let d = 0.5; for (; d <= max + 1e-6; d += 0.5) if (!free(kx + nx * d, kz + nz * d)) break; return d - 0.5; };
  const paint = (ax, az, bx, bz, w = 0.1) => { // vạch sơn trên mặt vỉa hè từ a tới b
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, hx = (-dz / l) * w / 2, hz = (dx / l) * w / 2, y = CURB + 0.012;
    near.quad([ax - X0 + hx, y, az - Z0 + hz], [bx - X0 + hx, y, bz - Z0 + hz], [bx - X0 - hx, y, bz - Z0 - hz], [ax - X0 - hx, y, az - Z0 - hz]);
  };
  let nBikes = 0;
  for (const r of roads) {
    if (!r.veh || r.kind > K.residential || r.w < 4.5 || r.len < 18) continue;
    const p = r.p, zn = zoneAt(p[0], p[1]);
    const n0 = J.nodes.get(nodeKey(p[0], p[1])), n1 = J.nodes.get(nodeKey(p[p.length - 2], p[p.length - 1]));
    const m0 = n0 && n0.arms.length >= 3 ? 11 : 3, m1 = n1 && n1.arms.length >= 3 ? 11 : 3;
    const ow = r.flags & F_ONEWAY ? (r.flags & F_REVERSE ? -1 : 1) : 0;
    const busRoad = r.kind <= K.secondary && r.w >= 8.5, bayRoad = zn === ZONE.old || zn === ZONE.french || zn === ZONE.city;
    o5[4] = 0;
    for (let k = 0, s = STEP / 2; s < r.len - m1; k++, s += STEP) {
      if (s < m0) continue;
      alongAt(r, s, o5); const x = o5[0], z = o5[1], tx = o5[2], tz = o5[3];
      for (const sd of [1, -1]) {
        const nx = -tz * sd, nz = tx * sd, kx = x + (nx * r.w) / 2, kz = z + (nz * r.w) / 2; // (kx,kz): mép bó vỉa; (nx,nz): từ lòng đường vào vỉa hè
        if (!inChunk(kx, kz) || isSolemn(kx, kz)) continue;
        const seed = (r.i * 7919 + k * 62 + (sd > 0 ? 17 : 5)) | 0, h1 = hash(seed, 1);
        const at = (d, t = 0) => [kx + nx * d + tx * t, kz + nz * d + tz * t];
        if (h1 < 0.019) { // --- điểm dừng xe buýt: cột biển sát bó vỉa; vỉa hè rộng thì thêm nhà chờ ---
          if (!busRoad || (ow && ow !== sd)) continue;
          const dep = depthAt(kx, kz, nx, nz, 4); if (dep < 1) continue;
          const yaw = Math.atan2(-nx, -nz), shelter = dep >= 3.5 && hash(seed, 2) < 0.5 && !ctx.isGreen(...at(1.5)) && !nearWall(...at(1.4), 2.6) && clear(...at(1.4), 2.4);
          const [bx, bz] = at(0.5, shelter ? 3.1 * sd : 0); if (!free(bx, bz) || !clear(bx, bz, 0.3)) continue;
          busSign(near, pg, bx - X0, bz - Z0, CURB, yaw, L.bus); hold(bx, bz, 0.3); mark('bus', bx, bz);
          if (shelter) {
            const [qx, qz] = at(1.4); busShelter(near, qx - X0, qz - Z0, CURB, yaw); hold(qx, qz, 2.3); mark('shelter', qx, qz);
            // va chạm: vách sau và hộp đèn (trong hệ của nhà chờ: +x cục bộ = (cos yaw, -sin yaw), +z = hướng ra đường)
            const ex = Math.cos(yaw), ez = -Math.sin(yaw);
            walls.push(qx - ex * 2.16 + nx * 0.71, qz - ez * 2.16 + nz * 0.71, qx + ex * 0.9 + nx * 0.71, qz + ez * 0.9 + nz * 0.71);
            walls.push(qx + ex * 2.21 + nx * 0.7, qz + ez * 2.21 + nz * 0.7, qx + ex * 2.21 - nx * 0.5, qz + ez * 2.21 - nz * 0.5);
            far.push().move(qx - X0, CURB, qz - Z0).rotY(yaw).rgb(0.42, 0.47, 0.5).box(-2.3, 2.3, -0.85, 2.3, 2.5, 0.9, 'xXYzZ').rgb(0.5, 0.55, 0.57).box(-2.16, 0.45, -0.72, 0.9, 2.1, -0.7, 'zZ').pop();
          }
        } else if (h1 >= 0.02 && h1 < 0.028) { // --- trạm biến áp kiosk 2 × 1,5 × 2 m: chỉ ở vỉa hè rộng, có va chạm ---
          const [qx, qz] = at(1.15); if (depthAt(kx, kz, nx, nz, 4) < 3.8 || ctx.isGreen(qx, qz) || onRoad(...at(3.4), 0.3) || nearWall(qx, qz, 2) || !clear(qx, qz, 1.7)) continue;
          if (depthAt(...at(0, 1.1), nx, nz, 3.5) < 3.5 || depthAt(...at(0, -1.1), nx, nz, 3.5) < 3.5) continue;
          const yaw = Math.atan2(nx, nz); kiosk(near, pg, qx - X0, qz - Z0, CURB, yaw, seed, L.warn); hold(qx, qz, 1.5); mark('kiosk', qx, qz);
          const c = [at(0.4, -1), at(0.4, 1), at(1.9, 1), at(1.9, -1)];
          for (let i = 0; i < 4; i++) walls.push(c[i][0], c[i][1], c[(i + 1) % 4][0], c[(i + 1) % 4][1]);
          far.push().move(qx - X0, CURB, qz - Z0).rotY(yaw).rgb(0.3, 0.33, 0.32).box(-1, 0, -0.75, 1, 2.1, 0.75, 'xXYzZ').pop();
        } else if (h1 >= 0.04 && h1 < 0.072) { // --- tủ điện xám kem sát bó vỉa, khoảng 100 m một cái ---
          const [qx, qz] = at(0.42); if (depthAt(kx, kz, nx, nz, 1.5) < 1.5 || !clear(qx, qz, 0.75)) continue;
          if (sd < 0 && Math.abs((((s - 9) % 27) + 40.5) % 27 - 13.5) < 1.4) continue; // tránh cột điện của gen/decor.js (bên trái, cách nhau 27 m tính từ mét thứ 9)
          cabinet(near, qx - X0, qz - Z0, CURB, Math.atan2(nx, nz), seed, hash(seed, 3) < 0.3); hold(qx, qz, 0.5); mark('cab', qx, qz);
        } else if (h1 >= 0.2 && h1 < 0.5 && bayRoad) { // --- ô đỗ xe máy kẻ vạch trắng: một hàng vuông góc bó vỉa, sâu 2 m, chừa lối đi 1,5 m ---
          if (depthAt(kx, kz, nx, nz, 4) < 3.8 || ctx.isGreen(...at(1.3)) || ctx.isGreen(...at(3)) || onRoad(...at(3.6), 0.3)) continue;
          const half = 2.25; let okBay = true;
          for (const t of [-half, -1.1, 0, 1.1, half]) if (!clear(...at(1.3, t), 0.85) || depthAt(...at(0, t), nx, nz, 3.5) < 3.5 || nearWall(...at(1.3, t), 1.3)) { okBay = false; break; }
          if (!okBay) continue;
          const d0 = 0.28, d1 = 2.28, A = at(d0, -half), Bq = at(d0, half), C = at(d1, half), D = at(d1, -half);
          white(); paint(A[0], A[1], Bq[0], Bq[1]); paint(Bq[0], Bq[1], C[0], C[1]); paint(C[0], C[1], D[0], D[1]); paint(D[0], D[1], A[0], A[1]);
          mark('bay', A[0], A[1], tx, tz, half * 2); mark('bay', D[0], D[1], tx, tz, half * 2);
          hold(...at(1.3, -1.2), 1.2); hold(...at(1.3, 1.2), 1.2);
          // xe dựng trong ô: cả hàng quay đầu cùng một hướng (vào tường hoặc ra đường)
          const cnt = Math.min(6, 2 + Math.floor(hash(seed, 4) * 5), 22 - nBikes), out = hash(seed, 5) < 0.4 ? -1 : 1, B = bikes(), slot0 = Math.floor(hash(seed, 6) * (7 - cnt));
          for (let i = 0; i < cnt; i++) {
            const [bx, bz] = at(1.3 + (hash(seed + i, 7) - 0.5) * 0.12, (slot0 + i - 2.5) * 0.72);
            near.push().move(bx - X0, CURB, bz - Z0).rotY(Math.atan2(-nz * out, nx * out) + (hash(seed + i, 8) - 0.5) * 0.14).rotX(0.16);
            near.add(B[Math.floor(hash(seed + i, 9) * B.length)], BIKE_TINT[Math.floor(hash(seed + i, 10) * BIKE_TINT.length)]); near.pop(); nBikes++;
          }
          if (hash(seed, 11) < 0.3) { const [sx, sz] = at(0.45, -half - 0.35); if (free(sx, sz) && clear(sx, sz, 0.3)) { parkSign(near, pg, sx - X0, sz - Z0, CURB, Math.atan2(-tx, -tz), L.park); hold(sx, sz, 0.3); } }
        }
      }
    }
  }

  // ===================== 4. trên cột đèn: loa phường, phướn đôi =====================
  for (const lp of env.lampPts) {
    const [x, z, dx, dz, major, r, side] = lp, nm = W.names[r.name] || '', seed = (Math.round(x * 3) * 73856093) ^ (Math.round(z * 3) * 19349663);
    if (isSolemn(x, z)) continue;
    if (major && PENNANT.test(nm) && hash(seed, 2) < 0.7) { // phướn vươn vuông góc với phố, mặt quay dọc phố
      pennants(near, pg, x - X0, z - Z0, CURB, Math.atan2(-dx * side, -dz * side), L.star, L.sickle); mark('pennant', x, z);
    } else if (r.kind >= K.secondary && !NO_SPEAKER.test(nm) && hash(seed, 1) < (major ? 0.085 : 0.11)) { // một cụm loa mỗi 300 đến 400 m phố dân cư
      speakers(near, x - X0, z - Z0, CURB, Math.atan2(-dz, dx), major ? 6.3 : 4.6); mark('speaker', x, z);
    }
  }

  // ===================== 5. cờ Tổ quốc ở ban công tầng hai (ngày thường, thêm vào số cờ sẵn có của decor.js) =====================
  const flagUV = signUV(FLAG_CELL);
  for (const f of bld.fronts) {
    if (f.floors < 2 || (f.style !== 10 && f.style !== 13) || f.w < 2.4 || hash(f.seed, 9) < 0.07 || hash(f.seed, 71) >= 0.075) continue; // hash(seed, 9) < 0.07: gian này decor.js đã treo cờ
    const mx = (f.x0 + f.x1) / 2, mz = (f.z0 + f.z1) / 2; if (!inChunk(mx, mz)) continue;
    near.push().move(mx - X0, CURB, mz - Z0).rotY(Math.atan2(f.nx, f.nz)).move((hash(f.seed, 72) - 0.5) * (f.w - 1.6), f.fh * 1.2, 0.06);
    houseFlag(near, flagUV, hash(f.seed, 73) < 0.5 ? -1 : 1); near.pop(); mark('flag', mx, mz);
  }

  // ===================== 6. băng rôn đỏ chữ vàng giăng ngang phố =====================
  for (const r of roads) {
    if (!r.veh || r.kind > K.residential || r.w < 5.5 || r.w > 14 || r.len < 44) continue;
    const nm = W.names[r.name] || ''; if (!nm || NO_BANNER.test(nm)) continue;
    o5[4] = 0;
    for (let k = 0, s = 22; s < r.len - 18; k++, s += 30) {
      const seed = (r.i * 2909 + k * 131) | 0; if (hash(seed, 1) >= 0.22) continue;
      alongAt(r, s, o5); const x = o5[0], z = o5[1], tx = o5[2], tz = o5[3], nx = -tz, nz = tx;
      if (!inChunk(x, z) || isSolemn(x, z)) continue;
      // hai đầu dây buộc vào mặt nhà hai bên phố (nhà phải cao từ 6 m)
      const anchor = (sgn) => { for (let d = r.w / 2 + 0.5; d <= r.w / 2 + 6; d += 0.5) { const B = ctx.buildingAt(x + nx * d * sgn, z + nz * d * sgn); if (B) return B.height >= 5.9 ? d - 0.25 : 0; } return 0; };
      const dr = anchor(1), dl = anchor(-1); if (!dr || !dl) continue;
      const bw = Math.min(r.w, 9), y0 = 5.0, y1 = 5.85, uv = L.banner[Math.floor(hash(seed, 2) * L.banner.length)];
      pg.push().move(x - X0, 0, z - Z0).rotY(Math.atan2(-nz, nx)).sway(0.25);
      signPlate(pg, -bw / 2, y0, bw, y1 - y0, uv, 0xc4161c, { code: INK_YELLOW, z: 0.006, gloss: 0, glow: 0.12 }); pg.sway(0).pop();
      near.push().move(x - X0, 0, z - Z0).rotY(Math.atan2(-nz, nx)).mat().rgb(0.75, 0.73, 0.66);
      for (const yy of [y0 + 0.02, y1 - 0.02]) near.tube([bw / 2, yy, 0], [dr, yy + 0.25, 0], 0.012, 3).tube([-bw / 2, yy, 0], [-dl, yy + 0.25, 0], 0.012, 3);
      near.pop(); mark('banner', x - nx * bw / 2, z - nz * bw / 2, nx, nz, bw);
    }
  }

  // ===================== 7. rào tôn công trường: ga ngầm S11, S12 và khu giải toả phía đông Hồ Gươm =====================
  for (const S of SITES) for (const run of S.runs) {
    const [bx0, bz0, bx1, bz1] = run.box; if (bx1 < X0 - 30 || bx0 > X1 + 30 || bz1 < Z0 - 30 || bz0 > Z1 + 30) continue;
    const inBox = (x, z) => x >= bx0 && x <= bx1 && z >= bz0 && z <= bz1, H = 2.3;
    for (const r of roads) {
      if (W.names[r.name] !== S.road) continue;
      o5[4] = 0; let prev = null, idx = 0;
      for (let s = 0; s <= r.len + 1e-6; s += 2) {
        alongAt(r, Math.min(s, r.len), o5); const x = o5[0], z = o5[1], tx = o5[2], tz = o5[3];
        const sd = -tz * (run.toward[0] - x) + tx * (run.toward[1] - z) > 0 ? 1 : -1, nx = -tz * sd, nz = tx * sd; // rào dựng bên lề phía công trường
        const fx = x + nx * (r.w / 2 + S.off), fz = z + nz * (r.w / 2 + S.off);
        const good = inBox(fx, fz) && free(fx, fz) && !onRoad(fx, fz, 0.5);
        const cur = good ? [fx, fz, nx, nz] : null; idx++;
        if (prev && cur) {
          const mx = (prev[0] + fx) / 2, mz = (prev[1] + fz) / 2;
          if (inChunk(mx, mz) && free(mx, mz)) {
            const a = [prev[0] - X0, prev[1] - Z0], b = [fx - X0, fz - Z0], ox = -nx, oz = -nz, seed = (r.i * 577 + idx) | 0, art = idx % 4 === 1 ? 1 + (idx >> 2) % 2 : 0;
            const tone = 0.85 + 0.3 * hash(seed, 1), col = art ? [0.72, 0.74, 0.7] : [S.col[0] * tone, S.col[1] * tone, S.col[2] * tone];
            near.push().move(0, CURB, 0); hoardingPanel(near, a, b, H, ox, oz, col, art, seed);
            near.rgb(0.2, 0.21, 0.22).cube(a[0] - ox * 0.05, 0, a[1] - oz * 0.05, 0.07, H + 0.08, 0.07, 'xXzZ').pop();
            far.rgb(col[0], col[1], col[2]).quad([a[0], CURB, a[1]], [b[0], CURB, b[1]], [b[0], CURB + H, b[1]], [a[0], CURB + H, a[1]]).quad([b[0], CURB, b[1]], [a[0], CURB, a[1]], [a[0], CURB + H, a[1]], [b[0], CURB + H, b[1]]);
            walls.push(prev[0], prev[1], fx, fz); mark('hoard', prev[0], prev[1], (fx - prev[0]) / 2, (fz - prev[1]) / 2, 2);
            if (idx % 8 === 4 && S.text.length) { // bảng khẩu hiệu trên mặt rào, 16 m một tấm
              const L2 = Math.hypot(b[0] - a[0], b[1] - a[1]), ti = S.text[(idx >> 3) % S.text.length];
              pg.push().move(mx - X0, CURB, mz - Z0).rotY(Math.atan2(ox, oz));
              signPlate(pg, -Math.min(1.9, L2), 1.2, Math.min(3.8, L2 * 2), 0.5, L.site[ti], ti === 1 ? 0xf2c500 : 0xf4f1e6, { back: false, z: 0.06, code: INK_DARK, glow: 0 }); pg.pop();
            }
          }
        }
        prev = cur;
      }
    }
  }
  for (const S of SITES) {
    for (const [kind, x, z, yaw, a] of S.props) {
      if (!inChunk(x, z) || !free(x, z) || onRoad(x, z, 1.5)) continue;
      if (kind === 'crane') { crane(near, x - X0, z - Z0, CURB, yaw, 0, a); crane(far, x - X0, z - Z0, CURB, yaw, 1, a); }
      else if (kind === 'excavator') excavator(near, x - X0, z - Z0, CURB, yaw);
      else { siteCabin(near, x - X0, z - Z0, CURB, yaw); far.push().move(x - X0, CURB, z - Z0).rotY(yaw).rgb(0.5, 0.52, 0.53).box(-3, 0.2, -1.2, 3, 2.8, 1.2, 'xXYzZ').pop(); }
      mark('hoard', x, z);
    }
  }

  // ===================== 8. ban thờ nhỏ, bát hương ở gốc đa, gốc cây cổ thụ =====================
  for (const [x, z, kind, seed] of env.treeList) {
    const big = kind === 'da'; if (!(big ? hash(seed, 77) < 0.6 : (kind === 'xacu' || kind === 'xacuco' || kind === 'sau') && hash(seed, 77) < 0.03)) continue;
    if (isSolemn(x, z) || zoneAt(x, z) === ZONE.badinh) continue;
    const rd = ctx.nearestRoad(x, z, 14, (q) => q.veh); if (!rd || rd.d < 0.5) continue;
    const T = TREES[kind], tr = T.trunk * (0.8 + hash(seed, 3) * 0.5) * 1.12;
    near.push().move(x - X0, CURB, z - Z0).rotY(Math.atan2(rd.px - x, rd.pz - z)); treeShrine(near, tr); near.pop(); mark('incense', x, z);
  }

  if (walls.length) { const old = extra.walls || new Float32Array(0), w = new Float32Array(old.length + walls.length); w.set(old); w.set(walls, old.length); extra.walls = w; }
}
