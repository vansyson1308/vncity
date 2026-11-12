// Chi tiết phố phường gắn theo mặt tiền và vỉa hè: biển hiệu nổi, mái hiên bạt, ban công, cục nóng điều hoà,
// cờ, xe máy dựng vỉa hè, bàn ghế nhựa quán cóc, cột điện và búi dây, bồn nước inox trên mái, tường rào, đường ray.
// Tất cả gộp vào lưới "gần" của ô phố; lưới "xa" chỉ giữ thứ nhìn thấy từ xa.
import { G, MAT } from '../../core/geo.js';
import { hash } from '../../core/util.js';
import { CS, CURB, K, ST, ZONE, zoneAt, isSolemn, roadY } from '../data.js';
import { L } from '../layers.js';
import { SIGNS, SIGN_COLORS, signUV, bladeUV, FLAG_CELL, LED_CELL, TEXT0, PAL } from '../signs.js';
import { mainAxis } from './buildings.js';
import { stallLayout } from '../stalls.js';
import { motorbike } from '../../models/vehicles.js';

const lin = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255].map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
const SIGN_LIN = SIGN_COLORS.map(lin), PAL_LIN = PAL.map(lin);
const AWNING = [0x2f6fb0, 0x1e7a4c, 0xb3261e, 0xd9a520, 0xe9e3d0, 0x4a4f55, 0x8a3a2a, 0x2a7a7a].map(lin);
const BIKE_TINT = [[0.55, 0.03, 0.03], [0.02, 0.02, 0.025], [0.75, 0.75, 0.73], [0.05, 0.12, 0.4], [0.35, 0.36, 0.38], [0.08, 0.08, 0.09], [0.6, 0.6, 0.62], [0.02, 0.2, 0.12], [0.5, 0.1, 0.25], [0.7, 0.45, 0.05]];
export { BIKE_TINT };
let BIKES = null;
const bikes = () => BIKES || (BIKES = [motorbike(new G(), 'wave', 0), motorbike(new G(), 'scooter', 0), motorbike(new G(), 'wave', 0), motorbike(new G(), 'cub', 0)]);

const CLOTH = [0xc94a4a, 0xe9e3d0, 0x4a78a8, 0xe0b23c, 0x6aa07a, 0xd98aa8, 0xf2f2ee, 0x2c3e50, 0x8a5ac0, 0x3a3a3a].map(lin);
const LANTERN = [[0.82, 0.05, 0.03], [0.95, 0.58, 0.07], [0.88, 0.16, 0.42]];
// Đèn lồng tròn: thân vải đỏ (vàng, hồng), hai đai vàng, tua rua; ban đêm tự sáng. lo: bản rút gọn cho lưới xa.
function lantern(g, x, y, z, r, kind, lo) {
  const c = LANTERN[kind];
  g.rgb(c[0], c[1], c[2]).glow(0.34).ball(x, y, z, r, lo ? 4 : 5, lo ? 2 : 3, 0.92).glow(0);
  if (lo) return;
  g.rgb(0.75, 0.55, 0.1).glow(0.3).cyl(x, y + r * 0.8, z, r * 0.42, r * 0.42, r * 0.22, 3, false).cyl(x, y - r * 1.02, z, r * 0.42, r * 0.3, r * 0.22, 3, false).glow(0);
  g.rgb(0.7, 0.1, 0.05).quad([x - 0.02, y - r * 1.02 - 0.22, z], [x + 0.02, y - r * 1.02 - 0.22, z], [x + 0.02, y - r * 1.02, z], [x - 0.02, y - r * 1.02, z]);
}
// ----- dấu hiệu nhận biết của công trình có tên (bảng gen/heroes.js, cột feat) -----
// Cạnh dài nhất của mặt bằng quay về hướng dir: trả về { mx, mz, nx, nz, len, tx, tz } (trung điểm, pháp tuyến ngoài, chiều dài, hướng cạnh).
function mainEdge(b, dir) {
  const p = b.p, n = p.length; let area = 0, best = null, bs = -1e9;
  for (let k = 0; k < n; k += 2) { const j = (k + 2) % n; area += p[k] * p[j + 1] - p[j] * p[k + 1]; }
  const sg = area > 0 ? 1 : -1;
  for (let k = 0; k < n; k += 2) {
    const dx = p[(k + 2) % n] - p[k], dz = p[(k + 3) % n] - p[k + 1], len = Math.hypot(dx, dz); if (len < 2) continue;
    const nx = (dz / len) * sg, nz = (-dx / len) * sg, sc = (nx * dir[0] + nz * dir[1]) * Math.sqrt(len) + ((p[k] + dx / 2 - b.cx) * dir[0] + (p[k + 1] + dz / 2 - b.cz) * dir[1]) * 0.05;
    if (nx * dir[0] + nz * dir[1] > 0.5 && sc > bs) { bs = sc; best = { mx: p[k] + dx / 2, mz: p[k + 1] + dz / 2, nx, nz, len, tx: dx / len, tz: dz / len }; }
  }
  return best;
}
// vòm bán cầu trên trống tròn (mái vòm góc nhà, vòm nhà hát)
function domeAt(g, x, y, z, r, col, lo, flat = 1) {
  const seg = lo ? 6 : 12, prof = [];
  for (let i = 0, m = lo ? 3 : 5; i <= m; i++) { const a = (i / m) * Math.PI / 2; prof.push([Math.cos(a) * r, Math.sin(a) * r * flat]); }
  g.rgb(col[0] * 1.5, col[1] * 1.5, col[2] * 1.5).cyl(x, y, z, r * 1.02, r * 1.02, r * 0.3, seg, false);
  g.rgb(col[0], col[1], col[2]).gloss(0.3).lathe(x, y + r * 0.3, z, prof, seg).gloss(0);
  if (!lo) g.rgb(0.6, 0.5, 0.2).cyl(x, y + r * 0.3 + r * flat, z, r * 0.05, 0.01, r * 0.35, 4, false);
}
// mái ngói nhiều tầng chồng nhau (sảnh bát giác bảo tàng, mái công sở kiểu Đông Dương): mỗi tầng một vành mái xoè và một cổ mái
function tieredRoof(g, x, y, z, r, tiers, col, seg, yaw) {
  g.push().move(x, y, z).rotY(yaw + Math.PI / seg);
  let yy = 0, rr = r;
  for (let t = 0; t < tiers; t++) {
    g.rgb(0.78, 0.7, 0.5).cyl(0, yy, 0, rr * 0.72, rr * 0.72, rr * 0.3, seg, false);
    g.rgb(col[0], col[1], col[2]).mat(MAT.tile).cyl(0, yy + rr * 0.3, 0, rr * 1.12, t === tiers - 1 ? 0.05 : rr * 0.5, rr * (t === tiers - 1 ? 0.62 : 0.34), seg, false).mat();
    yy += rr * 0.64; rr *= 0.68;
  }
  g.pop();
}
// Chữ lớn gắn trên mặt nhà (ô chữ TEXT0 + i trong bảng chữ)
function textPanel(g, e, X0, Z0, y, w, i, out = 0.25) {
  // Chữ đọc từ trái sang phải với người đứng ngoài nhìn vào: hướng "bên phải" của người đó là (nz, -nx). Tứ giác đi từ trái sang phải
  // rồi lên trên thì pháp tuyến quay ra ngoài (n). (Bản trước chọn chiều theo hướng cạnh nên cả bốn tấm chữ đều quay mặt vào trong
  // tường và bị loại mặt sau: không ai thấy chữ.)
  const uv = signUV(TEXT0 + i), h = w / 6, x = e.mx + e.nx * out - X0, z = e.mz + e.nz * out - Z0, hx = e.nz * w / 2, hz = -e.nx * w / 2;
  const l = [x - hx, y, z - hz], r = [x + hx, y, z + hz];
  g.rgb(1, 1, 1).glow(0.25).quad(l, r, [r[0], y + h, r[2]], [l[0], y + h, l[2]], uv).glow(0);
}
function drawHero(ctx, g, b, X0, Z0, lo) {
  const hero = b.hero, F = hero.feat; if (!F) return;
  const H = b.height, p = b.p, n = p.length, cx = b.cx - X0, cz = b.cz - Z0, [ax, az] = mainAxis(b), yaw = Math.atan2(-az, ax);
  let R = 0; for (let k = 0; k < n; k += 2) R = Math.max(R, Math.hypot(p[k] - b.cx, p[k + 1] - b.cz));
  if (F.domes) { // mái vòm xám trên các góc xa tâm nhất
    const used = [];
    for (let t = 0; t < F.domes.n; t++) {
      let best = -1, bd = -1;
      for (let k = 0; k < n; k += 2) { let d = Math.hypot(p[k] - b.cx, p[k + 1] - b.cz); for (const u of used) d = Math.min(d, Math.hypot(p[k] - p[u], p[k + 1] - p[u + 1]) * 0.8); if (d > bd) { bd = d; best = k; } }
      used.push(best);
      const dx = b.cx - p[best], dz = b.cz - p[best + 1], dl = Math.hypot(dx, dz) || 1, r = F.domes.r;
      domeAt(g, p[best] + (dx / dl) * r * 1.1 - X0, H, p[best + 1] + (dz / dl) * r * 1.1 - Z0, r, F.domes.col, lo);
    }
  }
  if (F.dome) domeAt(g, cx, H, cz, F.dome.r, F.dome.col, lo, 0.55);
  if (F.cone) { // mái tôn hình nón của tháp nước: mái thoải nên đứng dưới phố chỉ thấy vành mái đua ra, mặt dưới mái đua và chóp thông hơi trên đỉnh
    const c = F.cone.col, seg = lo ? 12 : 24, r = R + 0.8, hc = F.cone.h, yv = H + hc * 0.8; // mái chính tới khoảng 24,7 m, chóp thông hơi tới 25,6 m (art bible: đỉnh mái khoảng 25 m)
    g.rgb(c[0] * 0.55, c[1] * 0.55, c[2] * 0.55).disc(cx, H + 0.02, cz, r, seg, -1);                              // mặt dưới mái đua
    g.rgb(c[0] * 0.8, c[1] * 0.8, c[2] * 0.8).cyl(cx, H, cz, r, r, 0.42, seg, false);                           // diềm mái
    g.rgb(c[0], c[1], c[2]).gloss(0.25).cyl(cx, H + 0.42, cz, r, 1.5, hc * 0.8 - 0.42, seg, false).gloss(0);    // mái nón
    g.rgb(c[0] * 0.7, c[1] * 0.7, c[2] * 0.7).cyl(cx, yv, cz, 1.5, 1.5, hc * 0.09, lo ? 6 : 10, false);         // cổ chóp thông hơi
    g.rgb(c[0], c[1], c[2]).gloss(0.25).cyl(cx, yv + hc * 0.09, cz, 1.9, 0.06, hc * 0.11, lo ? 6 : 10, false).gloss(0);
    g.rgb(0.2, 0.2, 0.2).cyl(cx, H + hc - 0.1, cz, 0.12, 0.04, 1.1, 4, false);
  }
  if (F.drum) { // phòng họp tròn nhô lên giữa khối vuông: thân loe dần lên trên, ốp kim loại màu đồng, băng kính sáng đèn ban đêm, mái phẳng
    const c = F.drum.col, seg = lo ? 16 : 32, r = F.drum.r, hd = F.drum.h;
    g.rgb(c[0], c[1], c[2]).gloss(0.4).cyl(cx, H, cz, r * 0.94, r * 0.965, hd * 0.4, seg, false);
    g.rgb(0.3, 0.29, 0.26).gloss(0.8).glow(0.3).cyl(cx, H + hd * 0.4, cz, r * 0.96, r * 0.98, hd * 0.3, seg, false).glow(0);
    g.rgb(c[0], c[1], c[2]).gloss(0.4).cyl(cx, H + hd * 0.7, cz, r * 0.985, r * 1.03, hd * 0.3, seg, true).gloss(0);
    if (!lo) { g.rgb(c[0] * 0.7, c[1] * 0.7, c[2] * 0.7); for (let i = 0; i < 32; i++) { const a = ((i + 0.5) / 32) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a); g.tube([cx + ca * r * 0.965, H + hd * 0.4, cz + sa * r * 0.965], [cx + ca * r * 0.985, H + hd * 0.7, cz + sa * r * 0.985], 0.16, 3); } } // đố đứng chia băng kính
  }
  if (F.assembly) { // Nhà Quốc hội: khối vuông ốp đá be vàng. Lam đá đứng chạy suốt chiều cao trước lớp kính, băng đá ở chân và ở mái;
    // giữa mặt chính (quay ra quảng trường) là cổng lớn lùi vào giữa hai trụ đá, có mái sảnh, mảng đá giữa cổng mang quốc huy đồng.
    // Lam dày 0,9 m, sâu 1,3 m, cách nhau 2,6 m để từ xa vẫn đọc ra hàng cột đá chứ không phải nẹp mảnh trên tường kính.
    const A = F.assembly, S = A.col, e0 = mainEdge(b, A.dir), yP = CURB + 1.4, yT = H - 4.4, yC = H + (hero.parapet || 0) + 0.15, step = lo ? 5.2 : 2.6, fw = lo ? 0.6 : 0.45, fd = 1.3, PW = A.portal / 2;
    let area = 0; for (let k = 0; k < n; k += 2) { const j = (k + 2) % n; area += p[k] * p[j + 1] - p[j] * p[k + 1]; }
    const sg = area > 0 ? 1 : -1;
    for (let k = 0; k < n; k += 2) {
      const x0 = p[k], z0 = p[k + 1], dx = p[(k + 2) % n] - x0, dz = p[(k + 3) % n] - z0, l = Math.hypot(dx, dz); if (l < 4) continue;
      const nx = (dz / l) * sg, nz = (-dx / l) * sg, mx = x0 + dx / 2, mz = z0 + dz / 2, hw = l / 2, main = !!e0 && Math.abs(mx - e0.mx) + Math.abs(mz - e0.mz) < 0.5;
      g.push().move(mx - X0, 0, mz - Z0).rotY(Math.atan2(nx, nz)); // +z cục bộ hướng ra ngoài mặt nhà
      // lớp kính màu đồng sau hàng lam (che lưới cửa sổ văn phòng của mặt đứng): ban ngày tối màu, ánh trời; ban đêm sáng vàng ấm đều từ
      // trong ra (art bible mục 7: "sáng từ trong qua kính"); bốn dải sàn sẫm màu chia năm tầng
      g.mat().rgb(0.08, 0.06, 0.035).gloss(0.5).glow(0.55).quad([-hw, yP, 0.12], [hw, yP, 0.12], [hw, yT, 0.12], [-hw, yT, 0.12]).gloss(0).glow(0);
      g.rgb(S[0] * 0.45, S[1] * 0.45, S[2] * 0.45); for (let f = 1; f < 5; f++) { const y = yP + ((yT - yP) * f) / 5; g.quad([-hw, y - 0.35, 0.16], [hw, y - 0.35, 0.16], [hw, y + 0.35, 0.16], [-hw, y + 0.35, 0.16]); }
      g.mat(MAT.stone).rgb(S[0] * 0.78, S[1] * 0.78, S[2] * 0.78).box(-hw - 0.95, CURB, -0.3, hw + 0.95, yP, fd + 0.05, 'xXYZ');   // bệ đá
      g.rgb(S[0], S[1], S[2]).box(-hw - 1, yT, -0.3, hw + 1, yC, fd + 0.1, 'xXyYZ');                                             // băng đá mái
      const m = Math.max(1, Math.round(l / step));
      for (let i = 0; i <= m; i++) { const x = -hw + (l * i) / m; if (main && Math.abs(x) < PW + 0.4) continue; g.box(x - fw, yP, 0, x + fw, yT, fd, 'xXZ'); }
      if (main) {
        const re = A.emblem, ye = yT - 1.3 - re, pw = re + 2.2;
        for (const s of [-1, 1]) g.box(s * PW - (s < 0 ? 2.4 : 0), CURB, 0, s * PW + (s > 0 ? 2.4 : 0), yT, fd + 0.6, 'xXZ'); // hai trụ đá hai bên cổng
        g.box(-pw, 8.1, 0, pw, yT, 0.7, 'xXZ');                                                                             // mảng đá giữa cổng
        g.mat().rgb(0.4, 0.27, 0.13).gloss(0.4).box(-PW, 7.4, 0, PW, 8.1, 3.6, 'xXyYZ').gloss(0);                           // mái sảnh màu đồng
        if (!lo) { g.rgb(S[0] * 0.9, S[1] * 0.9, S[2] * 0.9).mat(MAT.stone); for (const x of [-9.6, -5.2, 5.2, 9.6]) g.box(x - 0.35, CURB, 2.7, x + 0.35, 7.4, 3.4, 'xXzZ'); g.mat(); }
        // quốc huy: đĩa đồng tròn có vành, ngôi sao năm cánh phía trên, nửa bánh răng phía dưới (cách điệu, không vẽ chi tiết), đặt cao
        // ngay dưới băng đá mái; ban đêm có đèn rọi
        const sgm = lo ? 10 : 24; g.push().move(0, ye, 0.74).rotX(Math.PI / 2);
        g.mat().rgb(0.6, 0.4, 0.1).gloss(0.5).glow(0.28).disc(0, 0, 0, re, sgm, 1); g.rgb(0.34, 0.17, 0.05).glow(0.12).disc(0, 0.03, 0, re * 0.86, sgm, 1);
        g.rgb(0.9, 0.66, 0.16).glow(0.3); const c0 = g.v(0, 0.06, -re * 0.2, 0, 1, 0), s0 = g.count;
        for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2, rr = re * (i % 2 ? 0.17 : 0.42); g.v(Math.cos(a) * rr, 0.06, -re * 0.2 + Math.sin(a) * rr, 0, 1, 0); }
        for (let i = 0; i < 10; i++) g.tri(c0, s0 + i + 1, s0 + i);
        if (!lo) g.rgb(0.75, 0.52, 0.12).box(-re * 0.34, 0.03, re * 0.42, re * 0.34, 0.06, re * 0.62, 'Y');
        g.gloss(0).glow(0).pop();
      }
      g.mat().pop();
    }
  }
  if (F.tiered) { const t = F.tiered; tieredRoof(g, (t.at ? t.at[0] - X0 : cx), H - (t.at ? 1.5 : 0), (t.at ? t.at[1] - Z0 : cz), t.r, t.tiers, t.col, t.oct ? 8 : 4, yaw); }
  if (F.crown) { // băng màu chạy quanh đỉnh tháp (biển hiệu trên nóc, không vẽ logo)
    let area = 0; for (let k = 0; k < n; k += 2) { const j = (k + 2) % n; area += p[k] * p[j + 1] - p[j] * p[k + 1]; }
    const sg = area > 0 ? 1 : -1, c = F.crown.col, y1 = H + (hero.parapet || 0.9) - 0.3, y0 = y1 - F.crown.h;
    g.rgb(c[0], c[1], c[2]).glow(0.5);
    for (let k = 0; k < n; k += 2) {
      const x0 = p[k], z0 = p[k + 1], x1 = p[(k + 2) % n], z1 = p[(k + 3) % n], l = Math.hypot(x1 - x0, z1 - z0); if (l < 1.5) continue;
      const ox = ((z1 - z0) / l) * sg * 0.22, oz = (-(x1 - x0) / l) * sg * 0.22, a = [x0 + ox - X0, y0, z0 + oz - Z0], e = [x1 + ox - X0, y0, z1 + oz - Z0];
      const q = [a, e, [e[0], y1, e[2]], [a[0], y1, a[2]]]; if (sg > 0) g.quad(q[1], q[0], q[3], q[2]); else g.quad(q[0], q[1], q[2], q[3]);
    }
    g.glow(0);
  }
  if (F.bulbs) { // viền bóng đèn vàng chạy quanh mép mái và gờ tầng (art bible: Tràng Tiền Plaza đêm viền đèn vàng): ban ngày là nẹp sáng màu mảnh
    let area = 0; for (let k = 0; k < n; k += 2) { const j = (k + 2) % n; area += p[k] * p[j + 1] - p[j] * p[k + 1]; }
    const sg = area > 0 ? 1 : -1;
    g.rgb(0.88, 0.72, 0.42).glow(0.5);
    for (const y0 of F.bulbs.ys) for (let k = 0; k < n; k += 2) {
      const x0 = p[k], z0 = p[k + 1], x1 = p[(k + 2) % n], z1 = p[(k + 3) % n], l = Math.hypot(x1 - x0, z1 - z0); if (l < 1.5) continue;
      const ox = ((z1 - z0) / l) * sg * 0.1, oz = (-(x1 - x0) / l) * sg * 0.1, a = [x0 + ox - X0, y0, z0 + oz - Z0], e = [x1 + ox - X0, y0, z1 + oz - Z0], y1 = y0 + (lo ? 0.3 : 0.18);
      const q = [a, e, [e[0], y1, e[2]], [a[0], y1, a[2]]]; if (sg > 0) g.quad(q[1], q[0], q[3], q[2]); else g.quad(q[0], q[1], q[2], q[3]);
    }
    g.glow(0);
  }
  if (F.flare) { // phần trên xoè rộng dần như cánh sen: các mặt nghiêng từ tường ra mép mái
    let area = 0; for (let k = 0; k < n; k += 2) { const j = (k + 2) % n; area += p[k] * p[j + 1] - p[j] * p[k + 1]; }
    const sg = area > 0 ? 1 : -1, c = F.flare.col, y0 = H - F.flare.h, o = F.flare.out, pts = [];
    for (let k = 0; k < n; k += 2) { const dx = p[k] - b.cx, dz = p[k + 1] - b.cz, l = Math.hypot(dx, dz) || 1; pts.push([p[k] + (dx / l) * o - X0, p[k + 1] + (dz / l) * o - Z0]); }
    g.rgb(c[0], c[1], c[2]).mat(MAT.concrete);
    for (let k = 0; k < n / 2; k++) {
      const j = (k + 1) % (n / 2), a = [p[k * 2] - X0, y0, p[k * 2 + 1] - Z0], e = [p[j * 2] - X0, y0, p[j * 2 + 1] - Z0], a1 = [pts[k][0], H, pts[k][1]], e1 = [pts[j][0], H, pts[j][1]];
      if (sg > 0) g.quad(e, a, a1, e1); else g.quad(a, e, e1, a1);
      if (sg > 0) g.quad(e1, a1, [a1[0], H + 1.1, a1[2]], [e1[0], H + 1.1, e1[2]]); else g.quad(a1, e1, [e1[0], H + 1.1, e1[2]], [a1[0], H + 1.1, a1[2]]);
    }
    g.mat().prism(pts, H + 1.0, H + 1.1, true, false, false);
  }
  if (F.clock) { // tháp đồng hồ bốn mặt trên nóc, sát mặt chính; chữ tên nhà ngay dưới
    const e = mainEdge(b, F.clock.dir); if (e) {
      const tx = e.mx - e.nx * 4.2 - X0, tz = e.mz - e.nz * 4.2 - Z0, tw = 5.2, th = 8.5, yw = Math.atan2(e.nx, e.nz), wl = [0.82, 0.76, 0.55];
      g.push().move(tx, H, tz).rotY(yw);
      g.rgb(wl[0], wl[1], wl[2]).mat(MAT.plaster).box(-tw / 2, 0, -tw / 2, tw / 2, th, tw / 2, 'xXzZ').mat();
      g.rgb(0.3, 0.3, 0.32).box(-tw / 2 - 0.3, th, -tw / 2 - 0.3, tw / 2 + 0.3, th + 0.35, tw / 2 + 0.3, 'xXYzZ');
      for (let k = 0; k < (lo ? 1 : 4); k++) {
        g.push().rotY((k * Math.PI) / 2).move(0, th - 2.6, tw / 2 + 0.04).rotX(Math.PI / 2);
        g.rgb(0.92, 0.92, 0.88).glow(0.5).disc(0, 0, 0, 1.75, lo ? 8 : 16, 1).glow(0);
        g.rgb(0.03, 0.03, 0.03).box(-0.07, 0.03, -1.25, 0.07, 0.05, 0.1, 'Y').box(-0.1, 0.03, -0.1, 0.85, 0.05, 0.1, 'Y');
        g.pop();
      }
      g.pop();
      // chữ tên nhà trên mép mái mặt chính: có ở cả bản xa (một tứ giác), vì mặt nhìn ra hồ chủ yếu được ngắm từ bên kia đường, bên kia hồ
      if (F.clock.text !== undefined) textPanel(g, e, X0, Z0, H - 2.3, Math.min(e.len - 2, 19), F.clock.text);
    }
  }
  if (F.sign && !lo) { const e = mainEdge(b, F.sign.dir); if (e) textPanel(g, e, X0, Z0, Math.min(H - 1.6, 6.2), Math.min(e.len - 1, 11), F.sign.text); }
  const archOn = (e, w, h, col) => { // ô cửa vòm tối trên mặt tường
    g.push().move(e.mx + e.nx * 0.06 - X0, CURB, e.mz + e.nz * 0.06 - Z0).rotY(Math.atan2(e.nx, e.nz));
    g.rgb(col[0], col[1], col[2]).quad([-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, h - w / 2, 0], [-w / 2, h - w / 2, 0]);
    g.push().move(0, h - w / 2, 0).rotX(Math.PI / 2); const c = g.v(0, 0, 0, 0, 1, 0), s0 = g.count, seg = lo ? 4 : 8;
    for (let i = 0; i <= seg; i++) { const a = Math.PI + (i / seg) * Math.PI; g.v(Math.cos(a) * w / 2, 0, Math.sin(a) * w / 2, 0, 1, 0); }
    for (let i = 0; i < seg; i++) g.tri(c, s0 + i + 1, s0 + i);
    g.pop().pop();
  };
  if (F.arch) for (const d of F.arch.dirs) { const e = mainEdge(b, d); if (e) archOn(e, F.arch.w, F.arch.h, [0.03, 0.03, 0.035]); }
  if (F.gate) { // cổng vòm nhà tù: khối cổng nhô ra, ô cửa vòm tối, chữ ngay trên đỉnh vòm (thấp hơn tán cây vỉa hè), gờ mái cổng
    const e = mainEdge(b, F.gate.dir); if (e) {
      g.push().move(e.mx - X0, CURB, e.mz - Z0).rotY(Math.atan2(e.nx, e.nz)); g.rgb(0.6, 0.55, 0.42).mat(MAT.stone).box(-3.4, 0, 0, 3.4, 8.2, 0.7, 'xXYZ');
      g.rgb(0.5, 0.46, 0.36).box(-3.6, 7.6, 0, 3.6, 8.0, 0.95, 'xXyYZ').mat(); g.pop();
      const e2 = { ...e, mx: e.mx + e.nx * 0.7, mz: e.mz + e.nz * 0.7 }; archOn(e2, 2.6, 4.4, [0.04, 0.03, 0.03]);
      if (!lo) textPanel(g, e2, X0, Z0, 4.65, 5.6, F.gate.text, 0.05);
    }
  }
  if (F.ledges) { g.rgb(0.42, 0.34, 0.28).mat(MAT.brick); for (const y of F.ledges) g.box(b.bb[0] - 0.22 - X0, y, b.bb[1] - 0.22 - Z0, b.bb[2] + 0.22 - X0, y + 0.3, b.bb[3] + 0.22 - Z0, 'xXyYzZ'); g.box(b.cx - 0.9 - X0, H, b.cz - 0.9 - Z0, b.cx + 0.9 - X0, H + 1.5, b.cz + 0.9 - Z0, 'xXYzZ').mat(); }
  if (F.pavilion) { // vọng lâu trên nóc cổng thành: bốn cột, mái ngói bốn mái
    const w = F.pavilion.w / 2, d = F.pavilion.d / 2; g.push().move(cx, H, cz).rotY(yaw);
    g.rgb(0.35, 0.12, 0.08); for (const [x, z] of [[-w, -d], [w, -d], [-w, d], [w, d]]) g.box(x * 0.9 - 0.14, 0, z * 0.9 - 0.14, x * 0.9 + 0.14, 2.6, z * 0.9 + 0.14, 'xXzZ');
    g.rgb(0.32, 0.1, 0.06).mat(MAT.tile);
    const e = [[-w - 0.7, -d - 0.7], [w + 0.7, -d - 0.7], [w + 0.7, d + 0.7], [-w - 0.7, d + 0.7]], r0 = [-w * 0.55, 0], r1 = [w * 0.55, 0];
    g.quad([e[3][0], 2.6, e[3][1]], [e[2][0], 2.6, e[2][1]], [r1[0], 4.3, 0], [r0[0], 4.3, 0]).quad([e[1][0], 2.6, e[1][1]], [e[0][0], 2.6, e[0][1]], [r0[0], 4.3, 0], [r1[0], 4.3, 0]);
    g.tri3([e[0][0], 2.6, e[0][1]], [e[3][0], 2.6, e[3][1]], [r0[0], 4.3, 0]).tri3([e[2][0], 2.6, e[2][1]], [e[1][0], 2.6, e[1][1]], [r1[0], 4.3, 0]).mat().pop();
  }
  // hàng cột áp tường và mái hiên chạy dọc các mặt nhìn ra phố
  if ((F.colonnade || F.canopy) && !lo) {
    let area = 0; for (let k = 0; k < n; k += 2) { const j = (k + 2) % n; area += p[k] * p[j + 1] - p[j] * p[k + 1]; }
    const sg = area > 0 ? 1 : -1;
    for (let k = 0; k < n; k += 2) {
      const x0 = p[k], z0 = p[k + 1], dx = p[(k + 2) % n] - x0, dz = p[(k + 3) % n] - z0, l = Math.hypot(dx, dz); if (l < 5) continue;
      const nx = (dz / l) * sg, nz = (-dx / l) * sg, mx = x0 + dx / 2, mz = z0 + dz / 2;
      const rd = ctx.nearestRoad(mx + nx * 3, mz + nz * 3, 22, (r) => !r.elev); if (!rd || (rd.px - mx) * nx + (rd.pz - mz) * nz < 1 || ctx.buildingAt(mx + nx * 1.5, mz + nz * 1.5, b)) continue;
      if (F.colonnade) {
        const c = F.colonnade.col, hc = F.colonnade.h, m = Math.max(2, Math.round(l / 3.3)); g.rgb(c[0], c[1], c[2]).mat(MAT.stone);
        for (let i = 0; i <= m; i++) { const t = (i + 0.0) / m, x = x0 + dx * t + nx * 0.2 - X0, z = z0 + dz * t + nz * 0.2 - Z0; g.cyl(x, CURB, z, 0.5, 0.42, hc, 6, false); }
        g.push().move(mx - X0, CURB + hc, mz - Z0).rotY(Math.atan2(nx, nz)).box(-l / 2, 0, -0.1, l / 2, 0.9, 0.75, 'xXyYZ').pop().mat();
      } else {
        const c = F.canopy.col, y = CURB + 3.5, a = [x0 + nx * 0.05 - X0, y + 0.45, z0 + nz * 0.05 - Z0], e = [x0 + dx + nx * 0.05 - X0, y + 0.45, z0 + dz + nz * 0.05 - Z0], a1 = [x0 + nx * 2 - X0, y, z0 + nz * 2 - Z0], e1 = [x0 + dx + nx * 2 - X0, y, z0 + dz + nz * 2 - Z0];
        g.rgb(c[0], c[1], c[2]); if (sg > 0) g.quad(a1, e1, e, a).quad(e1, a1, a, e); else g.quad(e1, a1, a, e).quad(a1, e1, e, a);
        g.rgb(0.5, 0.42, 0.2); const f0 = [a1[0], y - 0.3, a1[2]], f1 = [e1[0], y - 0.3, e1[2]]; g.quad(f0, f1, e1, a1).quad(f1, f0, a1, e1);
      }
    }
  }
}

// ----- quảng trường mở trên nền một công trình đã phá dỡ (nhà "Hàm Cá Mập", art bible mục 3.6) -----
// Nền lát đá sáng, màn hình LED lớn dựng sát tường hồi nhà bên cạnh, bồn hoa đá có hoạ tiết ô tròn Khuê Văn Các và ghế đá quanh bồn.
function plaza(ctx, near, far, b, X0, Z0, walls, lamps) {
  const p = b.p, n = p.length, pts = []; let area = 0;
  for (let k = 0; k < n; k += 2) { pts.push([p[k] - X0, p[k + 1] - Z0]); const j = (k + 2) % n; area += p[k] * p[j + 1] - p[j] * p[k + 1]; }
  const sg = area > 0 ? 1 : -1;
  near.rgb(0.47, 0.47, 0.45).mat(MAT.pave).prism(pts, CURB, CURB + 0.02, true, false, false).mat();
  far.rgb(0.47, 0.47, 0.45).prism(pts, CURB, CURB + 0.02, true, false, false);
  // cạnh dựng màn hình: cạnh dài nhất giáp nhà bên cạnh (không có thì cạnh dài nhất)
  let best = null, bs = 0;
  for (let k = 0; k < n; k += 2) {
    const dx = p[(k + 2) % n] - p[k], dz = p[(k + 3) % n] - p[k + 1], l = Math.hypot(dx, dz); if (l < 6) continue;
    const nx = (dz / l) * sg, nz = (-dx / l) * sg, mx = p[k] + dx / 2, mz = p[k + 1] + dz / 2, nb = ctx.buildingAt(mx + nx * 0.9, mz + nz * 0.9, b), sc = l * (nb ? 3 : 1);
    if (sc > bs) { bs = sc; best = { mx, mz, nx, nz, l, tx: dx / l, tz: dz / l }; }
  }
  if (!best) return;
  const e = best, yaw = Math.atan2(-e.nx, -e.nz), W = Math.min(e.l - 4, 13), Hs = (W * 9) / 16, y0 = CURB + 2.6, uv = signUV(LED_CELL);
  for (const g of [near, far]) { // +z cục bộ quay vào lòng quảng trường
    g.push().move(e.mx - e.nx * 0.55 - X0, 0, e.mz - e.nz * 0.55 - Z0).rotY(yaw);
    g.rgb(0.06, 0.06, 0.07).box(-W / 2 - 0.25, y0 - 0.25, -0.3, W / 2 + 0.25, y0 + Hs + 0.25, 0, 'xXyYzZ');
    g.rgb(0.2, 0.21, 0.22); for (const x of [-W / 2 + 0.6, W / 2 - 0.9]) g.box(x, CURB, -0.3, x + 0.3, y0 - 0.25, 0, 'xXzZ');
    g.rgb(1, 1, 1).glow(1).quad([-W / 2, y0, 0.02], [W / 2, y0, 0.02], [W / 2, y0 + Hs, 0.02], [-W / 2, y0 + Hs, 0.02], uv).glow(0);
    g.pop();
  }
  lamps.push(e.mx - e.nx * 4, 3, e.mz - e.nz * 4, 9);
  // bồn hoa và ghế đá: một hàng song song với màn hình, cách 8,5 m
  const m = Math.max(1, Math.floor((e.l - 3) / 5.6));
  for (let i = 0; i < m; i++) {
    const s = (i - (m - 1) / 2) * 5.6, x = e.mx - e.nx * 8.5 + e.tx * s, z = e.mz - e.nz * 8.5 + e.tz * s;
    near.push().move(x - X0, CURB, z - Z0).rotY(yaw);
    near.rgb(0.62, 0.61, 0.57).mat(MAT.stone).box(-1.1, 0, -1.1, 1.1, 0.55, 1.1, 'xXzZ').box(-1.1, 0.55, -1.1, 1.1, 0.6, 1.1, 'Y').mat();
    near.rgb(0.06, 0.2, 0.05).box(-0.92, 0.6, -0.92, 0.92, 0.82, 0.92, 'xXYzZ');
    for (let k = 0; k < 7; k++) { const fx = Math.cos(k * 2.4) * 0.6, fz = Math.sin(k * 2.4) * 0.6; near.rgb(k % 2 ? 0.8 : 0.85, k % 2 ? 0.1 : 0.6, 0.06).ball(fx, 0.9, fz, 0.16, 4, 2, 0.8); }
    for (let k = 0; k < 4; k++) { // hoạ tiết ô tròn Khuê Văn Các trên bốn mặt bồn
      near.push().rotY((k * Math.PI) / 2).move(0, 0.3, 1.105).rotX(Math.PI / 2);
      near.rgb(0.8, 0.78, 0.72).disc(0, 0, 0, 0.21, 10, 1).rgb(0.3, 0.1, 0.07).disc(0, 0.004, 0, 0.15, 10, 1).rgb(0.8, 0.78, 0.72).disc(0, 0.008, 0, 0.045, 6, 1);
      near.pop();
    }
    near.rgb(0.6, 0.59, 0.55).mat(MAT.stone);
    for (const sz of [-1, 1]) { const bz = sz * 1.75; near.box(-0.9, 0.38, bz - 0.24, 0.9, 0.48, bz + 0.24, 'xXyYzZ').box(-0.78, 0, bz - 0.2, -0.56, 0.38, bz + 0.2, 'xXzZ').box(0.56, 0, bz - 0.2, 0.78, 0.38, bz + 0.2, 'xXzZ'); }
    near.mat().pop();
    far.rgb(0.55, 0.55, 0.5).cube(x - X0, CURB, z - Z0, 2.2, 0.7, 2.2, 'xXYzZ');
    const c = [[-1.1, -1.1], [1.1, -1.1], [1.1, 1.1], [-1.1, 1.1]].map(([a, d]) => [x - e.tx * a - e.nx * d, z - e.tz * a - e.nz * d]);
    for (let k = 0; k < 4; k++) walls.push(c[k][0], c[k][1], c[(k + 1) % 4][0], c[(k + 1) % 4][1]);
  }
}

// Bốt gác 1,2 × 1,2 × 2,4 m: chân tường xây, băng cửa kính ba mặt, mái tôn bốn mái xanh rêu. Gốc ở tâm đáy.
function guardBooth(g, lo) {
  g.rgb(0.78, 0.72, 0.52).mat(MAT.plaster).box(-0.6, 0, -0.6, 0.6, 0.95, 0.6, 'xXzZ').box(-0.6, 1.85, -0.6, 0.6, 2.05, 0.6, 'xXzZ').mat();
  g.rgb(0.05, 0.08, 0.1).gloss(0.6).box(-0.56, 0.95, -0.56, 0.56, 1.85, 0.56, 'xXzZ').gloss(0);
  if (!lo) { g.rgb(0.78, 0.72, 0.52); for (const [x, z] of [[-0.6, -0.6], [0.52, -0.6], [-0.6, 0.52], [0.52, 0.52]]) g.box(x, 0.95, z, x + 0.08, 1.85, z + 0.08, 'xXzZ'); }
  g.rgb(0.05, 0.13, 0.08);
  for (const [a, b] of [[[-0.78, -0.78], [0.78, -0.78]], [[0.78, -0.78], [0.78, 0.78]], [[0.78, 0.78], [-0.78, 0.78]], [[-0.78, 0.78], [-0.78, -0.78]]]) g.tri3([b[0], 2.05, b[1]], [a[0], 2.05, a[1]], [0, 2.5, 0]);
  if (!lo) g.rgb(0.5, 0.48, 0.42).quad([-0.78, 2.05, -0.78], [0.78, 2.05, -0.78], [0.78, 2.05, 0.78], [-0.78, 2.05, 0.78]);
}
function stool(g, x, z, red) { g.rgb(red ? 0.52 : 0.04, red ? 0.03 : 0.14, red ? 0.03 : 0.5).cyl(x, 0, z, 0.17, 0.13, 0.27, 4, true); }
function lowTable(g, x, z, steel) { if (steel) g.rgb(0.55, 0.56, 0.58).gloss(0.6); else g.rgb(0.05, 0.16, 0.5); g.cube(x, 0.4, z, 0.62, 0.03, 0.62).cyl(x, 0, z, 0.05, 0.05, 0.4, 4, false); g.gloss(0); }

export function decorate(ctx, env) {
  const { near, far, lamps, X0, Z0, inChunk, free, onRoad, roads, bld } = env;
  const shopPools = []; // vị trí các vệt sáng cửa hàng đã đặt trong ô này: [x, z, ...]
  const W = ctx.world, extraWalls = [];

  // ===== mặt tiền =====
  for (const f of bld.fronts) {
    const mx = (f.x0 + f.x1) / 2, mz = (f.z0 + f.z1) / 2, s = f.seed, bw = f.w, fh = f.fh;
    const g = near; g.push().move(mx - X0, CURB, mz - Z0).rotY(Math.atan2(f.nx, f.nz)); // +z cục bộ = hướng ra phố, +x = dọc tường
    const isOld = f.zone === ZONE.old, tube = f.style === ST.TUBE, up = f.up;
    // ô quá dày nhà (xóm ngoài đê): khi lưới gần đã nặng thì bớt đồ lặt vặt, rồi bỏ hẳn ban công nổi, để giữ ngân sách tam giác
    const load = near.idx.length / 3, lite = load > 46000, bare = load > 58000;
    const open = f.gnd >= L.SHOP && f.gnd < L.SHOP + L.N_SHOP && f.gnd !== L.S_ROLL && f.gnd !== L.S_FOLD;
    // dải biển trên cửa tầng 1: mép dưới 0,775 tầng, cao không quá 0,8 m (quy chế phố cổ, art bible 3.1)
    const y0 = fh * 0.775, y1 = y0 + Math.min(0.8, fh * 0.2);
    if (f.shop && f.sign) {
      const sc = SIGN_LIN[SIGNS[f.sign][2]], uv = signUV(f.sign), sw = Math.min(bw - 0.24, 4.6), d = 0.08 + hash(s, 1) * 0.1, lightbox = hash(s, 19) < 0.5;
      g.rgb(sc[0] * 0.45, sc[1] * 0.45, sc[2] * 0.45).glow(0).box(-sw / 2, y0, 0, sw / 2, y1, d, 'xXy');
      g.rgb(1, 1, 1).glow(lightbox ? 0.42 : 0.2).quad([-sw / 2, y0, d], [sw / 2, y0, d], [sw / 2, y1, d], [-sw / 2, y1, d], uv).glow(0);
      // biển vẫy vuông góc mặt nhà, cùng chữ với biển ngang. Phố cổ: hộp đèn nhỏ nằm gọn trong dải biển tầng 1; nơi khác treo ở tầng hai, to hơn.
      if (hash(s, 5) < 0.3 && (isOld || f.floors > 1) && bw > 2.6) {
        const side = hash(s, 7) < 0.5 ? -1 : 1, sx = side * (bw / 2 - 0.07), wd = isOld ? 0.82 : 1.02, bh = wd * 0.62, yb = isOld ? y0 + 0.05 : fh * 1.08 + hash(s, 6) * 0.5, z0 = 0.2, z1 = z0 + wd, uvb = bladeUV(f.sign), t = 0.05;
        g.rgb(sc[0] * 0.45, sc[1] * 0.45, sc[2] * 0.45).box(sx - t, yb, z0, sx + t, yb + bh, z1, 'yYZ');
        g.rgb(1, 1, 1).glow(0.45).quad([sx + t, yb, z1], [sx + t, yb, z0], [sx + t, yb + bh, z0], [sx + t, yb + bh, z1], uvb).quad([sx - t, yb, z0], [sx - t, yb, z1], [sx - t, yb + bh, z1], [sx - t, yb + bh, z0], uvb).glow(0);
        g.rgb(0.1, 0.1, 0.1).box(sx - 0.015, yb + bh * 0.42, 0, sx + 0.015, yb + bh * 0.58, z0, 'xXyY');
      }
      // ánh đèn cửa hàng hắt ra hè: mỗi chỗ một vệt, hai vệt không gần nhau dưới 8 m. Trước đây gian nào cũng có một vệt 13 × 13 m,
      // dọc phố cổ sáu bảy lớp trong suốt chồng lên nhau và tổng số vệt vượt sức chứa của lưới vệt sáng.
      if (open && hash(s, 8) < 0.75) { const lx = mx + f.nx * 1.6, lz = mz + f.nz * 1.6; let ok = true; for (let q = 0; q < shopPools.length; q += 2) if ((shopPools[q] - lx) ** 2 + (shopPools[q + 1] - lz) ** 2 < 64) { ok = false; break; } if (ok) { shopPools.push(lx, lz); lamps.push(lx, 3, lz, 5.2); } }
    }
    // mái hiên bạt: 40% cửa hàng. Loại nhỏ gắn ngay dưới biển, loại lớn gắn ở mép sàn tầng hai vươn 2-3 m; bạt trơn hoặc kẻ sọc
    if (f.shop && f.sign && hash(s, 2) < 0.42 && f.gnd !== L.S_ROLL && !bare) {
      const c = AWNING[Math.floor(hash(s, 3) * AWNING.length)], aw = bw - 0.16, big = hash(s, 20) < 0.25, out = (big ? 1.9 : 1.3) + hash(s, 4) * 0.9;
      const ya = big ? fh * 0.99 : y0 - 0.03, yb = big ? ya - out * 0.3 : Math.max(2.12, ya - out * 0.2), n = hash(s, 21) < 0.32 && !lite ? Math.max(4, Math.round(aw / 0.55)) : 1;
      for (let i = 0; i < n; i++) {
        const xa = -aw / 2 + (aw * i) / n, xb = -aw / 2 + (aw * (i + 1)) / n, w = i % 2 ? 0.8 : 0;
        g.rgb(c[0] + (0.78 - c[0]) * w, c[1] + (0.76 - c[1]) * w, c[2] + (0.7 - c[2]) * w).quad([xa, yb, out], [xb, yb, out], [xb, ya, 0.04], [xa, ya, 0.04]).quad([xa, yb - 0.17, out], [xb, yb - 0.17, out], [xb, yb, out], [xa, yb, out]);
      }
      g.rgb(c[0] * 0.4 + 0.05, c[1] * 0.4 + 0.05, c[2] * 0.4 + 0.05).quad([aw / 2, yb, out], [-aw / 2, yb, out], [-aw / 2, ya, 0.04], [aw / 2, ya, 0.04]).quad([aw / 2, yb - 0.17, out], [-aw / 2, yb - 0.17, out], [-aw / 2, yb, out], [aw / 2, yb, out]);
      g.rgb(0.2, 0.2, 0.2).tube([-aw / 2 + 0.05, yb, out], [-aw / 2 + 0.05, ya - 0.5, 0.04], 0.012, 3).tube([aw / 2 - 0.05, yb, out], [aw / 2 - 0.05, ya - 0.5, 0.04], 0.012, 3);
    }
    // phố Hàng Mã: đèn lồng, đồ giấy đỏ treo kín mặt tiền quanh năm (art bible, dấu hiệu 26)
    if (f.shop && f.road && W.names[f.road.name] === 'Phố Hàng Mã') {
      const n = Math.max(3, Math.round(bw / 0.78));
      for (let i = 0; i < n; i++) for (let r = 0; r < 2; r++) {
        if (hash(s + i * 3 + r, 61) < (r ? 0.45 : 0.1)) continue;
        const lx = -bw / 2 + (bw * (i + 0.5)) / n + (r ? 0.2 : 0), ly = y0 - 0.32 - r * 0.5 - hash(s + i, 62) * 0.18, lz = 0.55 + r * 0.5 + hash(s + i, 63) * 0.2, c = hash(s + i * 7 + r, 64), rad = 0.17 + hash(s + i + r, 65) * 0.07;
        lantern(g, lx, ly, lz, rad, c < 0.72 ? 0 : c < 0.9 ? 1 : 2, false);
      }
      g.rgb(0.03, 0.03, 0.03).box(-bw / 2, y0 - 0.05, 0.5, bw / 2, y0 - 0.03, 0.53, 'yZ').box(-bw / 2, y0 - 0.05, 1.02, bw / 2, y0 - 0.03, 1.05, 'yZ');
      if (hash(s, 66) < 0.5) lamps.push(mx + f.nx * 1.2, 3, mz + f.nz * 1.2, 4.2);
    }
    // ban công, chuồng cọp, cục nóng điều hoà, chậu cây, quần áo phơi (art bible, dấu hiệu 14)
    if (tube && !bare) {
      const nB = Math.min(f.floors - 1, lite ? 2 : 4), tl = PAL_LIN[f.tint], w2 = bw / 2 - 0.2;
      for (let i = 1; i <= nB; i++) {
        const y = i * fh + fh * 0.15, full = i <= 2 && !lite, sb = s * 7 + i * 131;
        let out = 0; // độ vươn của sàn ban công (0: không có sàn)
        if (up === L.UP_IRON || up === L.UP_ALU || up === L.UP_TILE || up === L.UP_OLD || up === L.UP_90S || up === L.UP_HOTEL) {
          out = up === L.UP_OLD ? 0.6 : 0.85;
          g.rgb(0.55, 0.54, 0.5).box(-w2, y - 0.1, 0, w2, y, out, 'xXyZ');
          if (up === L.UP_TILE) g.rgb(tl[0] * 0.75, tl[1] * 0.75, tl[2] * 0.75).box(-w2, y, out - 0.1, w2, y + 0.82, out, full ? 'xXYZ' : 'Z');
          else if (up === L.UP_90S) { // lan can con tiện: tay vịn xây, hàng con tiện trắng
            g.rgb(0.78, 0.76, 0.7).box(-w2, y + 0.7, out - 0.13, w2, y + 0.82, out, 'yYZ');
            if (full) for (let k = 0, nb = Math.max(3, Math.round(bw / 0.6)); k < nb; k++) { const px = -w2 + 0.1 + ((2 * w2 - 0.2) * k) / (nb - 1); g.box(px - 0.07, y, out - 0.1, px + 0.07, y + 0.7, out - 0.02, 'Z'); }
            else g.box(-w2, y, out - 0.08, w2, y + 0.7, out - 0.04, 'Z');
          } else if (up === L.UP_HOTEL) { // lan can kính, tay vịn inox
            g.rgb(0.16, 0.24, 0.26).gloss(0.9).box(-w2, y + 0.04, out - 0.03, w2, y + 0.78, out, 'Z');
            g.rgb(0.5, 0.52, 0.54).gloss(0.7).box(-w2, y + 0.78, out - 0.05, w2, y + 0.83, out + 0.01, 'yZ').gloss(0);
          } else { // lan can sắt đen, inox sáng, hoặc gỗ nâu
            if (up === L.UP_IRON) g.rgb(0.03, 0.035, 0.04); else if (up === L.UP_OLD) g.rgb(0.1, 0.055, 0.03); else g.rgb(0.5, 0.52, 0.54).gloss(0.7);
            g.box(-w2, y + 0.78, out - 0.04, w2, y + 0.83, out, 'yZ').box(-w2, y + 0.38, out - 0.03, w2, y + 0.41, out, 'Z');
            for (let k = 0, nb = full ? Math.max(3, Math.round(bw / (up === L.UP_ALU ? 1.3 : 0.7))) : 2; k < nb; k++) { const px = -w2 + ((2 * w2 - 0.04) * k) / (nb - 1); g.box(px, y, out - 0.04, px + 0.04, y + 0.8, out, k === 0 ? 'xZ' : k === nb - 1 ? 'XZ' : 'Z'); }
            if (full) g.box(-w2, y + 0.78, 0.02, -w2 + 0.03, y + 0.83, out, 'x').box(w2 - 0.03, y + 0.78, 0.02, w2, y + 0.83, out, 'X');
            g.gloss(0);
          }
        } else if (up === L.UP_CAGE) { // chuồng cọp: lồng sắt đua ra 0,7 m, mái tôn che
          out = 0.7; const ch = fh * 0.6;
          g.rgb(0.25, 0.3, 0.33).box(-w2, y - 0.05, 0, w2, y, out, 'xXyZ');
          g.rgb(0.3, 0.38, 0.46).quad([-w2 - 0.05, y + ch - 0.08, out + 0.12], [w2 + 0.05, y + ch - 0.08, out + 0.12], [w2 + 0.05, y + ch + 0.1, 0], [-w2 - 0.05, y + ch + 0.1, 0]).quad([w2 + 0.05, y + ch - 0.08, out + 0.12], [-w2 - 0.05, y + ch - 0.08, out + 0.12], [-w2 - 0.05, y + ch + 0.1, 0], [w2 + 0.05, y + ch + 0.1, 0]);
          g.rgb(0.2, 0.25, 0.28);
          for (let k = 0, nb = full ? Math.max(4, Math.round(bw / 0.45)) : 3; k < nb; k++) { const px = -w2 + ((2 * w2 - 0.03) * k) / (nb - 1); g.box(px, y, out - 0.03, px + 0.03, y + ch, out, k === 0 ? 'xZ' : k === nb - 1 ? 'XZ' : 'Z'); }
          g.box(-w2, y + ch * 0.5, out - 0.03, w2, y + ch * 0.5 + 0.03, out, 'Z');
          if (full) g.box(-w2, y + ch * 0.5, 0, -w2 + 0.03, y + ch * 0.5 + 0.03, out, 'x').box(w2 - 0.03, y + ch * 0.5, 0, w2, y + ch * 0.5 + 0.03, out, 'X');
        } else if (up === L.UP_WORN && full) { // mái che tôn trên cửa sổ
          const ya = (i + 0.74) * fh, wa = bw * 0.37;
          g.rgb(0.3, 0.38, 0.46).quad([-wa, ya - 0.2, 0.6], [wa, ya - 0.2, 0.6], [wa, ya, 0.02], [-wa, ya, 0.02]).rgb(0.14, 0.18, 0.22).quad([wa, ya - 0.2, 0.6], [-wa, ya - 0.2, 0.6], [-wa, ya, 0.02], [wa, ya, 0.02]);
        }
        if (!full) continue;
        // cục nóng điều hoà 0,8 × 0,55 × 0,3 m: nhà mới gần như nhà nào cũng có
        if (bw > 2.9 && hash(sb, 30) < (f.era === 2 ? 0.75 : f.era === 1 ? 0.5 : 0.24)) {
          const ax = (hash(sb, 40) < 0.5 ? -1 : 1) * (bw / 2 - 0.62), ay = out ? (up === L.UP_CAGE ? y + 0.02 : y + fh * 0.52) : y + fh * 0.1, az = out && up !== L.UP_CAGE ? 0.02 : 0.03;
          g.rgb(0.74, 0.74, 0.71).box(ax - 0.4, ay, az, ax + 0.4, ay + 0.55, az + 0.3, 'xXyZ');
          g.rgb(0.16, 0.17, 0.18).quad([ax - 0.3, ay + 0.08, az + 0.305], [ax + 0.1, ay + 0.08, az + 0.305], [ax + 0.1, ay + 0.47, az + 0.305], [ax - 0.3, ay + 0.47, az + 0.305]);
        }
        if (!out) continue;
        // chậu cây trên lan can, trong lồng
        const np = hash(sb, 31) < 0.5 ? 1 + Math.floor(hash(sb, 32) * 2.6) : 0;
        for (let k = 0; k < np; k++) {
          const px = (hash(sb + k, 33) - 0.5) * (2 * w2 - 0.5), py = up === L.UP_CAGE || up === L.UP_HOTEL ? y : y + 0.83, pz = up === L.UP_CAGE || up === L.UP_HOTEL ? out - 0.25 : out - 0.1, r = 0.11 + hash(sb + k, 34) * 0.09;
          g.rgb(0.42, 0.2, 0.12).cyl(px, py, pz, 0.08, 0.11, 0.17, 4, false);
          g.rgb(0.07 + hash(sb + k, 35) * 0.06, 0.24 + hash(sb + k, 36) * 0.12, 0.05).ball(px, py + 0.17 + r * 0.9, pz, r, 5, 3, 1.25, 0.35, sb + k);
        }
        // quần áo phơi trên sào: chuồng cọp gần như lúc nào cũng có
        if (hash(sb, 37) < (up === L.UP_CAGE ? 0.7 : f.era === 2 ? 0.1 : 0.26) && bw > 2.8) {
          const ry = up === L.UP_CAGE ? y + fh * 0.5 : y + 1.55, rz = out - 0.16, nc = 3 + Math.floor(hash(sb, 38) * 3), span = 2 * w2 - 0.5;
          g.rgb(0.35, 0.36, 0.38).box(-w2 + 0.1, ry, rz - 0.012, w2 - 0.1, ry + 0.024, rz + 0.012, 'yZ');
          for (let k = 0; k < nc; k++) {
            const cxp = -span / 2 + (span * (k + 0.5)) / nc, cw = 0.2 + hash(sb + k, 39) * 0.14, cl = 0.4 + hash(sb + k, 41) * 0.35, c = CLOTH[Math.floor(hash(sb + k, 42) * CLOTH.length)];
            g.rgb(c[0], c[1], c[2]).sway(0.12).quad([cxp - cw, ry - cl, rz], [cxp + cw, ry - cl, rz], [cxp + cw, ry, rz], [cxp - cw, ry, rz]).quad([cxp + cw, ry - cl, rz], [cxp - cw, ry - cl, rz], [cxp - cw, ry, rz], [cxp + cw, ry, rz]).sway(0);
          }
        }
      }
    }
    // cờ đỏ sao vàng 0,8 × 1,2 m cắm nghiêng ở ban công tầng hai (số ít nhà ngày thường)
    if ((tube || f.style === ST.FRENCH) && f.floors > 1 && hash(s, 9) < 0.07) {
      const px = (hash(s, 10) - 0.5) * (bw - 1), yb = fh * 1.25, uv = signUV(FLAG_CELL);
      g.rgb(0.6, 0.6, 0.58).tube([px, yb, 0.03], [px, yb + 1.5, 1.5], 0.014, 3);
      g.rgb(1, 1, 1).sway(0.5);
      const a = [px, yb + 0.65, 0.65], b = [px, yb + 1.5, 1.5];
      g.quad([a[0], a[1] - 0.8, a[2]], [b[0], b[1] - 0.8, b[2]], b, a, [uv[0], uv[1], uv[2], uv[3]]).quad([b[0], b[1] - 0.8, b[2]], [a[0], a[1] - 0.8, a[2]], a, b, [uv[2], uv[1], uv[0], uv[3]]).sway(0);
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
    const x = W.food[i], z = W.food[i + 1], kind = W.food[i + 2];
    if (isSolemn(x, z)) continue;
    const rd = ctx.nearestRoad(x, z, 22, (r) => r.veh && r.kind <= K.residential); if (!rd || rd.d < 0.5) continue;
    const ux = (x - rd.px) / rd.d, uz = (z - rd.pz) / rd.d, px = rd.px + ux * (rd.r.w / 2 + 1.05), pz = rd.pz + uz * (rd.r.w / 2 + 1.05);
    if (!free(px, pz) || onRoad(px, pz, 0.3)) continue;
    near.push().move(px - X0, CURB, pz - Z0).rotY(Math.atan2(ux, uz));
    // bàn và các ghế trống; khách và ghế khách ngồi do actors/crowd.js đặt theo cùng bố cục (world/stalls.js)
    const lay = stallLayout(i, kind);
    for (const tx of lay.tables) lowTable(near, tx, 0, lay.steel);
    for (const [sx, sz] of lay.spare) stool(near, sx, sz, lay.red);
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
          for (let k = 0; k < n; k++) { const t = (k + 0.5) / n * 2 - 1, lx = x - X0 - dz * hw * t, lz = z - Z0 + dx * hw * t, c = hash(seed + k, 1); lantern(g, lx, 5.25 - Math.abs(t) * 0.1, lz, g === near ? 0.24 : 0.3, c < 0.6 ? 0 : c < 0.85 ? 1 : 2, g !== near); }
        }
        lamps.push(x, 3, z, 6);
      }
      d += Ls;
    }
  }

  // ===== quảng trường trên nền nhà đã phá dỡ =====
  for (const pl of ctx.plazas) if (inChunk(pl.b.cx, pl.b.cz)) plaza(ctx, near, far, pl.b, X0, Z0, extraWalls, lamps);

  // ===== dấu hiệu nhận biết của công trình có tên: bản gần đủ chi tiết, bản xa rút gọn =====
  for (const b of bld.heroes) { drawHero(ctx, near, b, X0, Z0, false); drawHero(ctx, far, b, X0, Z0, true); near.mat(); far.mat(); }

  // ===== bồn nước inox và tum thang trên mái bằng (khoảng 70% nóc nhà ống, art bible dấu hiệu 15) =====
  for (const r of bld.roofs) {
    if (hash(r.seed, 61) > 0.7) continue;
    near.push().move(r.x - X0, r.y, r.z - Z0).rotY(Math.atan2(-r.ez, r.ex)); // +x cục bộ dọc mặt phố, ±z theo chiều sâu nhà
    const t = PAL_LIN[r.tint], hw = r.w / 2, hd = r.d / 2, sx = hash(r.seed, 62) < 0.5 ? -1 : 1;
    // tum cầu thang: khối xây nhỏ có mái đua, nằm lùi phía sau
    if (r.w > 3.2 && r.d > 5.5 && hash(r.seed, 63) < 0.8) {
      const tw = Math.min(2.8, r.w - 0.6), tx = sx * (hw - tw / 2 - 0.15), tz = -hd * 0.35;
      near.rgb(t[0] * 0.72, t[1] * 0.72, t[2] * 0.72).mat(MAT.plaster).box(tx - tw / 2, 0, tz - 1.4, tx + tw / 2, 2.4, tz + 1.4, 'xXzZ').mat();
      near.rgb(0.3, 0.3, 0.3).box(tx - tw / 2 - 0.15, 2.4, tz - 1.55, tx + tw / 2 + 0.15, 2.5, tz + 1.55, 'xXYzZ');
      near.rgb(0.12, 0.1, 0.08).quad([tx - sx * (tw / 2 + 0.01), 0, tz - 0.45], [tx - sx * (tw / 2 + 0.01), 0, tz + 0.45], [tx - sx * (tw / 2 + 0.01), 1.95, tz + 0.45], [tx - sx * (tw / 2 + 0.01), 1.95, tz - 0.45]).quad([tx - sx * (tw / 2 + 0.01), 0, tz + 0.45], [tx - sx * (tw / 2 + 0.01), 0, tz - 0.45], [tx - sx * (tw / 2 + 0.01), 1.95, tz - 0.45], [tx - sx * (tw / 2 + 0.01), 1.95, tz + 0.45]);
    }
    // bồn inox nằm Ø 1 m dài 1,6 m trên giá thép, đặt sát mặt phố
    const bx = -sx * Math.max(0, hw - 1.3) * hash(r.seed, 64), bz = hd - 0.95, len = Math.min(1.7, r.w - 0.5), rr = 0.5, by = hash(r.seed, 65) < 0.5 ? 0.9 : 1.6;
    if (len > 1.1) {
      near.rgb(0.2, 0.2, 0.22).box(bx - len / 2 + 0.1, 0, bz - 0.4, bx + len / 2 - 0.1, by - rr * 0.8, bz + 0.4, 'xX');
      near.rgb(0.62, 0.64, 0.66).gloss(0.9).tube([bx - len / 2, by, bz], [bx + len / 2, by, bz], rr, 7);
      near.rgb(0.5, 0.52, 0.54).push().move(bx - len / 2, by, bz).rotZ(Math.PI / 2).disc(0, 0, 0, rr, 7, 1).pop().push().move(bx + len / 2, by, bz).rotZ(-Math.PI / 2).disc(0, 0, 0, rr, 7, 1).pop().gloss(0);
    }
    near.pop();
  }

  // ===== tường rào, hàng rào (OSM barrier) =====
  // Tường không bao giờ chắn lối đi có trong bản đồ: để hở ở cổng (nút cổng của OSM) và ở mọi chỗ có đường, lối đi cắt qua.
  const GT = ctx.world.gates, doneGate = new Set(), booths = []; // một cổng có thể nằm trên nhiều đoạn tường: chỉ dựng cánh cổng, bốt gác một lần
  // Phía trong của một bức tường tại (x,z): phía xa đường phố hơn. (ux,uz): pháp tuyến tường. Trả về +1, -1 hoặc 0 nếu không rõ.
  const pub = (r) => r.veh && r.kind <= K.residential && !r.elev;
  const insideSide = (x, z, ux, uz) => { const a = ctx.nearestRoad(x + ux * 3, z + uz * 3, 40, pub), b = ctx.nearestRoad(x - ux * 3, z - uz * 3, 40, pub), da = a ? a.d : 99, db = b ? b.d : 99; return Math.abs(da - db) < 1.5 ? 0 : da > db ? 1 : -1; };
  for (const w of ctx.wallGrid.collect(X0, Z0, env.X1, env.Z1)) {
    const p = w.p, zw = zoneAt(p[0], p[1]), formal = zw === ZONE.badinh || zw === ZONE.french; // khu cơ quan, biệt thự: tường vàng cao 2,1 m có mũ và trụ
    // hai đoạn tường hai bên đầu cầu Thê Húc phía bờ (nối cánh cổng Đài Nghiên ra mép nước): tường lửng quét vôi trắng ngà như cổng đền,
    // không phải tường rào vàng cao quá đầu người
    const lowLime = w.k === 0 && ctx.landmarks.some((l) => l.id === 'cau_the_huc' && Math.hypot((p[0] + p[p.length - 2]) / 2 - l.x, (p[1] + p[p.length - 1]) / 2 - l.z) < 16);
    const H = lowLime ? 1.05 : w.k === 3 ? 4.2 : w.k === 1 ? (formal ? 2.0 : 1.7) : w.k === 2 ? 1.1 : formal ? 2.1 : 2.3, th = w.k === 2 ? 0.4 : w.k === 1 ? 0.03 : lowLime ? 0.2 : 0.14;
    const IRON = zw === ZONE.badinh ? [0.035, 0.085, 0.05] : [0.03, 0.035, 0.04];
    for (let i = 0; i < p.length - 2; i += 2) {
      const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], Ls = Math.hypot(bx - ax, bz - az); if (Ls < 0.3) continue;
      const dx = (bx - ax) / Ls, dz = (bz - az) / Ls, cuts = [], posts = [], gatesHere = [];
      for (let k = 0; k < GT.length; k += 2) { // cổng: hở 3,4 m, hai trụ cổng hai bên
        const gx = GT[k] - ax, gz = GT[k + 1] - az, sg = gx * dx + gz * dz;
        if (Math.abs(gx * dz - gz * dx) < 1.2 && sg > -1.7 && sg < Ls + 1.7) { cuts.push([sg - 1.7, sg + 1.7]); posts.push(sg - 1.7, sg + 1.7); gatesHere.push(sg); }
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
        // tường rào xây: vữa vôi vàng (Ba Đình, khu phố Pháp vàng đậm hơn); tường thành: đá rêu phong; hàng rào sắt xanh rêu; bờ giậu để trơn
        g.mat(w.k === 0 ? MAT.plaster : w.k === 3 ? MAT.mossy : MAT.none);
        if (lowLime) g.rgb(0.72, 0.66, 0.53); else if (w.k === 2) g.rgb(0.1, 0.22, 0.07); else if (w.k === 1) g.rgb(IRON[0], IRON[1], IRON[2]); else if (w.k === 3) g.rgb(0.42, 0.4, 0.36); else if (formal) g.rgb(0.66, 0.45, 0.16); else g.rgb(0.62, 0.48, 0.2);
      };
      for (const [a0, a1] of pieces) {
        const pax = ax + dx * a0, paz = az + dz * a0, pbx = ax + dx * a1, pbz = az + dz * a1, mx = (pax + pbx) / 2, mz = (paz + pbz) / 2; if (!inChunk(mx, mz)) continue;
        const rd = ctx.nearestRoad(mx, mz, 14, (r) => !r.elev); if (rd && rd.d < rd.r.w / 2 + 0.3) continue; // tường nằm trong lòng đường (dữ liệu lệch)
        if (ctx.buildingAt(mx, mz)) continue;
        const lx = pax - X0, lz = paz - Z0, rx = pbx - X0, rz = pbz - Z0;
        // một dải tường đứng hai mặt (và mặt trên nếu top) giữa cao độ y0, y1, dày t
        const slab = (g, y0, y1, t, top) => {
          const nx = dz * t, nz = -dx * t;
          g.quad([lx + nx, y0, lz + nz], [rx + nx, y0, rz + nz], [rx + nx, y1, rz + nz], [lx + nx, y1, lz + nz]);
          g.quad([rx - nx, y0, rz - nz], [lx - nx, y0, lz - nz], [lx - nx, y1, lz - nz], [rx - nx, y1, rz - nz]);
          if (top) g.quad([lx + nx, y1, lz + nz], [rx + nx, y1, rz + nz], [rx - nx, y1, rz - nz], [lx - nx, y1, lz - nz]);
        };
        if (w.k === 1) {
          // hàng rào sắt: bệ xây thấp, song sắt đứng, hai thanh ngang (bản xa chỉ còn bệ và hai thanh ngang)
          const PH = 0.5, y0 = CURB + PH;
          for (const g of [near, far]) {
            g.mat(MAT.plaster); if (formal) g.rgb(0.66, 0.45, 0.16); else g.rgb(0.4, 0.39, 0.36);
            slab(g, CURB, y0, 0.11, g === near);
            g.mat(MAT.none).rgb(IRON[0], IRON[1], IRON[2]); slab(g, CURB + H - 0.1, CURB + H - 0.04, 0.02, false); slab(g, y0 + 0.08, y0 + 0.13, 0.02, false);
          }
          const nb = Math.max(1, Math.round((a1 - a0) / 0.6)), bw2 = 0.018;
          for (let k = 0; k <= nb; k++) {
            const sb = a0 + ((a1 - a0) * k) / nb, x = ax + dx * sb - X0, z = az + dz * sb - Z0;
            near.quad([x - dx * bw2, y0, z - dz * bw2], [x + dx * bw2, y0, z + dz * bw2], [x + dx * bw2, CURB + H, z + dz * bw2], [x - dx * bw2, CURB + H, z - dz * bw2]).quad([x + dx * bw2, y0, z + dz * bw2], [x - dx * bw2, y0, z - dz * bw2], [x - dx * bw2, CURB + H, z - dz * bw2], [x + dx * bw2, CURB + H, z + dz * bw2]);
          }
        } else {
          for (const g of [near, far]) { paint(g); slab(g, CURB, CURB + H, th, w.k === 2 || (g === near && w.k === 3)); }
          if (w.k === 0) { // mũ tường và trụ đỡ cách quãng (tường rào cơ quan, biệt thự)
            if (lowLime) near.mat(MAT.stone).rgb(0.36, 0.34, 0.28); else if (formal) near.rgb(0.8, 0.76, 0.66); else near.rgb(0.45, 0.36, 0.17);
            slab(near, CURB + H, CURB + H + 0.09, th + 0.045, true);
            if (formal) {
              paint(near); const np = Math.floor((a1 - a0) / 3.8), ang = Math.atan2(-dz, dx);
              for (let k = 1; k <= np; k++) { const sp = a0 + ((a1 - a0) * k) / (np + 1); near.push().move(ax + dx * sp - X0, CURB, az + dz * sp - Z0).rotY(ang).box(-0.17, 0, -0.2, 0.17, H + 0.16, 0.2, 'xXYzZ').pop(); }
            }
          }
        }
        if (w.k !== 2) extraWalls.push(pax, paz, pbx, pbz);
      }
      if (w.k === 0 || w.k === 3 || (w.k === 1 && formal)) for (const sp of posts) { // trụ cổng
        if (sp < -0.2 || sp > Ls + 0.2) continue; const x = ax + dx * sp, z = az + dz * sp; if (!inChunk(x, z)) continue;
        for (const g of [near, far]) { paint(g); if (w.k === 1) g.mat(MAT.plaster).rgb(0.66, 0.45, 0.16); g.cube(x - X0, CURB, z - Z0, 0.5, H + 0.3, 0.5, 'xXzZ'); g.shade(0.8).cube(x - X0, CURB + H + 0.3, z - Z0, 0.64, 0.14, 0.64); }
        extraWalls.push(x - 0.25, z, x + 0.25, z);
      }
      near.mat(); far.mat();
      // cổng sắt hai cánh mở vào trong, bốt gác cạnh cổng cơ quan ở Ba Đình (art bible, dấu hiệu 28)
      if (w.k <= 1 && formal) for (const sg of gatesHere) {
        const gx = ax + dx * sg, gz = az + dz * sg; if (!inChunk(gx, gz)) continue;
        const sd = insideSide(gx, gz, dz, -dx); if (!sd) continue;
        const ix = dz * sd, iz = -dx * sd, seed = (Math.round(gx * 3) * 7919 + Math.round(gz * 3)) | 0;
        for (const e of [-1, 1]) { // mỗi trụ một cánh, bản lề ở mép trong của trụ
          const hs = sg + e * 1.42; if (hs < -0.2 || hs > Ls + 0.2) continue;
          const hk = Math.round((ax + dx * hs) * 2) * 100003 + Math.round((az + dz * hs) * 2); if (doneGate.has(hk)) continue; doneGate.add(hk);
          const hx = ax + dx * hs + ix * 0.2, hz = az + dz * hs + iz * 0.2, sw = 0.35 * e * (0.4 + hash(seed, 3 + e)); // cánh khép hờ vào trong
          const ex = ix * Math.cos(sw) - dx * Math.sin(sw) * sd, ez = iz * Math.cos(sw) - dz * Math.sin(sw) * sd, LW = 1.38, y0 = CURB + 0.1, y1 = CURB + H - 0.15;
          near.rgb(IRON[0], IRON[1], IRON[2]);
          const bar = (s0, s1, ya, yb) => { const p0 = [hx + ex * s0 - X0, ya, hz + ez * s0 - Z0], p1 = [hx + ex * s1 - X0, ya, hz + ez * s1 - Z0], p2 = [p1[0], yb, p1[2]], p3 = [p0[0], yb, p0[2]]; near.quad(p0, p1, p2, p3).quad(p1, p0, p3, p2); };
          bar(0, LW, y0, y0 + 0.06); bar(0, LW, y1 - 0.06, y1); bar(0, LW, (y0 + y1) / 2 - 0.03, (y0 + y1) / 2 + 0.03);
          for (let k = 0; k <= 6; k++) bar((LW * k) / 6 - 0.016, (LW * k) / 6 + 0.016, y0, y1 + (k > 0 && k < 6 ? 0.14 : 0));
        }
        if (zw !== ZONE.badinh || sg < 0 || sg >= Ls || hash(seed, 1) > 0.6 || booths.some((q) => (q[0] - gx) ** 2 + (q[1] - gz) ** 2 < 64)) continue;
        let bs = hash(seed, 2) < 0.5 ? -1 : 1;
        for (let t = 0; t < 2; t++, bs = -bs) {
          const s2 = sg + bs * 2.75, bx2 = ax + dx * s2 - ix * 0.8, bz2 = az + dz * s2 - iz * 0.8; // đứng ngoài tường, sát trụ cổng, nhìn ra phố
          if (!free(bx2, bz2) || onRoad(bx2, bz2, 1.2) || ctx.nearestRoad(bx2, bz2, 1.8)) continue;
          booths.push([gx, gz]);
          for (const g of [near, far]) { g.push().move(bx2 - X0, CURB, bz2 - Z0).rotY(Math.atan2(-dz, dx)); guardBooth(g, g === far); g.pop(); }
          extraWalls.push(bx2 - 0.6, bz2 - 0.6, bx2 + 0.6, bz2 - 0.6, bx2 + 0.6, bz2 - 0.6, bx2 + 0.6, bz2 + 0.6, bx2 + 0.6, bz2 + 0.6, bx2 - 0.6, bz2 + 0.6, bx2 - 0.6, bz2 + 0.6, bx2 - 0.6, bz2 - 0.6);
          break;
        }
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
