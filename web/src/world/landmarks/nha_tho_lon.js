// Nhà thờ Lớn Hà Nội (1886), tân Gothic: dài 64,5 m, rộng 20,5 m, hai tháp chuông vuông cao 31,5 m.
// Mặt bằng chữ thập: gian giữa cao, hai gian bên thấp, cánh ngang (transept) gần cung thánh, hậu cung đa giác.
// Tường gạch trát vữa xi măng ám khói (MAT.plaster nền xám thẫm, vệt đen chảy từ gờ xuống), trụ tường và chân
// tường rêu mốc (MAT.mossy), gờ bê tông, mái ngói đất nung sẫm. Gốc toạ độ ở tâm mặt bằng, mặt tiền quay về +z.
import { hash } from '../../core/util.js';
import { MAT } from '../../core/geo.js';
import { floodlit } from './lighting.js';

const lin = (h) => { const f = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)); return [f(((h >> 16) & 255) / 255), f(((h >> 8) & 255) / 255), f((h & 255) / 255)]; };
const STONE = lin(0x767472), TRIM = 0x807e79, ROOF = 0x57403a, GLASS = 0x18233c, DOOR = 0x2b1d15;
const W = 20.5, ZF = 32.25, TW = 6.6, NAVE = 4.75, ZT = ZF - TW, ZA = -26, ZAP = -27.5, XT = W / 2 + 0.5;
const Y_AISLE = 9.2, Y_LEAN = 11.6, Y_NAVE = 17, Y_RIDGE = 22.2;
const TIERS = [0, 8.2, 13.6, 19.4, 25.2, 30.5];

const stone = (g, k, t = 0) => g.rgb(STONE[0] * k * (1 + 0.05 * t), STONE[1] * k, STONE[2] * k * (1 - 0.06 * t));

// Đa giác lồi nhìn từ +z (ngược chiều kim đồng hồ) trên mặt phẳng z.
function fanZ(g, pts, z) {
  const b = g.count; for (const p of pts) g.v(p[0], p[1], z, 0, 0, 1);
  for (let i = 1; i < pts.length - 1; i++) g.tri(b, b + i, b + i + 1);
}
// Viền vòm nhọn: rộng w, chân vòm cao hs, đỉnh cao ha (tính từ y0).
function archPts(cx, y0, w, hs, ha, n = 3) {
  const r = ha - hs, hw = w / 2, pts = [[cx - hw, y0], [cx + hw, y0]];
  const c = Math.max(0, (r * r - hw * hw) / w), R = hw + c, t1 = Math.acos(c / R);
  for (let i = 0; i <= n; i++) { const t = (t1 * i) / n; pts.push([cx - c + R * Math.cos(t), y0 + hs + R * Math.sin(t)]); }
  for (let i = n - 1; i >= 0; i--) { const t = (t1 * i) / n; pts.push([cx + c - R * Math.cos(t), y0 + hs + R * Math.sin(t)]); }
  return pts;
}
// Mảng tường đá loang lổ: màu theo đỉnh, tối dần lên sát gờ, có cột vệt muội đen.
function streakWall(g, x0, y0, x1, y1, z, seed, cw = 1.25, ch = 2.7, k0 = 1) {
  const nx = Math.max(1, Math.round((x1 - x0) / cw)), ny = Math.max(1, Math.round((y1 - y0) / ch));
  const K = (i, j) => {
    const t = j / ny, s = hash(seed * 31 + i, 1), p = hash(seed * 31 + i * 17 + j * 101, 2);
    let k = 0.62 + 0.4 * p;
    if (s < 0.45) k *= 1 - 0.72 * t;
    k *= 1 - 0.5 * t * t;
    if (p > 0.8) k *= 1.4;
    if (j === 0 && y0 < 0.7) k *= 0.7;
    return k * k0;
  };
  const T = (i, j) => hash(seed * 7 + i * 5 + j * 3, 9) * 2 - 1;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const xa = x0 + ((x1 - x0) * i) / nx, xb = x0 + ((x1 - x0) * (i + 1)) / nx, ya = y0 + ((y1 - y0) * j) / ny, yb = y0 + ((y1 - y0) * (j + 1)) / ny;
    const b = g.count;
    stone(g, K(i, j), T(i, j)); g.v(xa, ya, z, 0, 0, 1);
    stone(g, K(i + 1, j), T(i + 1, j)); g.v(xb, ya, z, 0, 0, 1);
    stone(g, K(i + 1, j + 1), T(i + 1, j + 1)); g.v(xb, yb, z, 0, 0, 1);
    stone(g, K(i, j + 1), T(i, j + 1)); g.v(xa, yb, z, 0, 0, 1);
    g.tri(b, b + 1, b + 2); g.tri(b, b + 2, b + 3);
  }
}
// Cửa/cửa sổ vòm nhọn trên mặt z: khung đá sáng hơn, lòng tối. kind: glass | louvre | blind | door
function lancet(g, cx, y0, w, hs, ha, z, kind = 'glass', seed = 0) {
  g.mat(MAT.plaster).color(TRIM).shade(0.72 + 0.2 * hash(seed, 4));
  fanZ(g, archPts(cx, y0 - 0.12, w + 0.4, hs + 0.12, ha + 0.36), z + 0.1);
  g.mat(kind === 'door' ? MAT.wood : MAT.none);
  if (kind === 'glass') g.color(GLASS).gloss(0.45).glow(0.7);
  else if (kind === 'door') g.color(DOOR);
  else if (kind === 'louvre') g.color(0x121212);
  else g.color(0x2c2c2b);
  fanZ(g, archPts(cx, y0, w, hs, ha), z + 0.2);
  g.gloss(0).glow(0).mat();
  if (kind === 'louvre') {
    g.color(0x55534e);
    const n = Math.floor((hs + (ha - hs) * 0.35) / 0.62);
    for (let i = 0; i < n; i++) { const y = y0 + 0.28 + i * 0.62, t = Math.max(0, (y - y0 - hs) / (ha - hs)), hw = (w / 2) * (1 - 0.75 * t) - 0.04; g.quad([cx - hw, y, z + 0.3], [cx + hw, y, z + 0.3], [cx + hw, y + 0.2, z + 0.3], [cx - hw, y + 0.2, z + 0.3]); }
  } else if (kind === 'glass' && w > 1.3) {
    g.color(TRIM).shade(0.6); g.quad([cx - 0.07, y0, z + 0.3], [cx + 0.07, y0, z + 0.3], [cx + 0.07, y0 + hs + (ha - hs) * 0.8, z + 0.3], [cx - 0.07, y0 + hs + (ha - hs) * 0.8, z + 0.3]);
  } else if (kind === 'door') {
    g.color(0x17100c); g.quad([cx - 0.05, y0, z + 0.3], [cx + 0.05, y0, z + 0.3], [cx + 0.05, y0 + hs, z + 0.3], [cx - 0.05, y0 + hs, z + 0.3]);
    g.color(TRIM).shade(0.55); g.quad([cx - w / 2, y0 + hs - 0.12, z + 0.3], [cx + w / 2, y0 + hs - 0.12, z + 0.3], [cx + w / 2, y0 + hs + 0.12, z + 0.3], [cx - w / 2, y0 + hs + 0.12, z + 0.3]);
  }
  g.mat(MAT.plaster);
}
// Đĩa tròn nhìn từ +z.
function discZ(g, cx, cy, r, z, n = 16) { const p = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } fanZ(g, p, z); }
// Thánh giá đá, chân ở (x,y,z), cao h.
function cross(g, x, y, z, h) {
  const t = h * 0.1; g.mat(MAT.concrete).color(0x7a7872);
  g.cube(x, y, z, t * 2.4, t * 1.2, t * 2.4); g.cube(x, y + t * 1.2, z, t, h - t * 1.2, t); g.cube(x, y + h * 0.62, z, h * 0.56, t, t); g.mat(MAT.plaster);
}

function tower(g, seed, inner) {
  const hw = TW / 2;
  for (let f = 0; f < 4; f++) {
    // f: 0 mặt trước (+z), 1 mặt +x, 2 mặt sau, 3 mặt -x; inner: mặt quay vào gian giữa
    g.push().rotY((f * Math.PI) / 2);
    const isInner = f === inner, isBack = f === 2, isFront = f === 0;
    for (let t = 0; t < 5; t++) {
      const y0 = TIERS[t], y1 = TIERS[t + 1];
      if ((isInner && t < 2) || (isBack && t < 1)) continue;
      streakWall(g, -hw + 0.45, y0, hw - 0.45, y1, hw, seed * 50 + f * 10 + t, 1.0, 2.8, [1, 0.96, 0.9, 0.8, 0.66][t]);
      const hidden = (isInner && t < 3) || (isBack && t < 3);
      if (hidden) continue;
      const s = seed * 97 + f * 13 + t;
      if (t === 0) { if (isFront) lancet(g, 0, 0.6, 2.3, 3.3, 5.6, hw, 'door', s); else lancet(g, 0, 2.6, 1.3, 2.4, 3.9, hw, 'blind', s); }
      else if (t === 1) lancet(g, 0, y0 + 0.9, 1.7, 2.3, 3.8, hw, isFront ? 'glass' : 'blind', s);
      else if (t === 2) { lancet(g, -1.2, y0 + 0.8, 0.95, 2.9, 4.1, hw, 'blind', s); lancet(g, 1.2, y0 + 0.8, 0.95, 2.9, 4.1, hw, 'blind', s + 1); }
      else { const h = t === 3 ? 4.5 : 4.1; lancet(g, -1.25, y0 + 0.75, 1.25, h - 1.1, h, hw, 'louvre', s); lancet(g, 1.25, y0 + 0.75, 1.25, h - 1.1, h, hw, 'louvre', s + 1); }
    }
    // trụ góc (hai mặt ngoài của một góc)
    for (let t = 0; t < 5; t++) {
      const k = (0.92 - t * 0.07) * (0.85 + 0.25 * hash(seed * 11 + f, t)), ya = TIERS[t], yb = TIERS[t + 1], p = 0.22 - t * 0.02;
      for (const sx of [-1, 1]) {
        const xa = sx < 0 ? -hw - p : hw - 0.45, xb = sx < 0 ? -hw + 0.45 : hw + p, b = g.count;
        stone(g, k * 1.05); g.v(xa, ya, hw + p, 0, 0, 1); g.v(xb, ya, hw + p, 0, 0, 1);
        stone(g, k * 0.6); g.v(xb, yb, hw + p, 0, 0, 1); g.v(xa, yb, hw + p, 0, 0, 1);
        g.tri(b, b + 1, b + 2); g.tri(b, b + 2, b + 3);
      }
      stone(g, k * 0.7);
      g.quad([-hw + 0.45, ya, hw], [-hw + 0.45, ya, hw + p], [-hw + 0.45, yb, hw + p], [-hw + 0.45, yb, hw]);
      g.quad([hw - 0.45, ya, hw + p], [hw - 0.45, ya, hw], [hw - 0.45, yb, hw], [hw - 0.45, yb, hw + p]);
    }
    g.pop();
  }
  // gờ phân tầng
  g.mat(MAT.concrete);
  for (let t = 1; t <= 5; t++) { stone(g, t === 5 ? 0.95 : 1.02 - t * 0.06); g.cube(0, TIERS[t] - 0.28, 0, TW + 0.9, 0.28, TW + 0.9); stone(g, 0.5); g.cube(0, TIERS[t] - 0.5, 0, TW + 0.55, 0.22, TW + 0.55, 'xXzZy'); }
  g.mat(MAT.plaster);
  // lan can mái tháp, chóp nhỏ bốn góc, thánh giá
  const yT = TIERS[5];
  stone(g, 0.62); g.cube(0, yT, 0, TW + 0.2, 1.0, TW + 0.2, 'xXzZ'); stone(g, 0.5); g.cube(0, yT + 0.75, 0, TW - 0.4, 0.05, TW - 0.4, 'Y');
  stone(g, 0.3); // mặt trong lan can
  g.quad([hw - 0.3, yT + 0.75, -hw + 0.3], [hw - 0.3, yT + 0.75, hw - 0.3], [hw - 0.3, yT + 1.0, hw - 0.3], [hw - 0.3, yT + 1.0, -hw + 0.3]);
  g.quad([-hw + 0.3, yT + 0.75, hw - 0.3], [-hw + 0.3, yT + 0.75, -hw + 0.3], [-hw + 0.3, yT + 1.0, -hw + 0.3], [-hw + 0.3, yT + 1.0, hw - 0.3]);
  g.quad([-hw + 0.3, yT + 0.75, -hw + 0.3], [hw - 0.3, yT + 0.75, -hw + 0.3], [hw - 0.3, yT + 1.0, -hw + 0.3], [-hw + 0.3, yT + 1.0, -hw + 0.3]);
  g.quad([hw - 0.3, yT + 0.75, hw - 0.3], [-hw + 0.3, yT + 0.75, hw - 0.3], [-hw + 0.3, yT + 1.0, hw - 0.3], [hw - 0.3, yT + 1.0, hw - 0.3]);
  // nắp trên của lan can (vành)
  stone(g, 0.78);
  g.quad([-hw - 0.1, yT + 1, hw + 0.1], [hw + 0.1, yT + 1, hw + 0.1], [hw - 0.3, yT + 1, hw - 0.3], [-hw + 0.3, yT + 1, hw - 0.3]);
  g.quad([hw + 0.1, yT + 1, -hw - 0.1], [-hw - 0.1, yT + 1, -hw - 0.1], [-hw + 0.3, yT + 1, -hw + 0.3], [hw - 0.3, yT + 1, -hw + 0.3]);
  g.quad([hw + 0.1, yT + 1, hw + 0.1], [hw + 0.1, yT + 1, -hw - 0.1], [hw - 0.3, yT + 1, -hw + 0.3], [hw - 0.3, yT + 1, hw - 0.3]);
  g.quad([-hw - 0.1, yT + 1, -hw - 0.1], [-hw - 0.1, yT + 1, hw + 0.1], [-hw + 0.3, yT + 1, hw - 0.3], [-hw + 0.3, yT + 1, -hw + 0.3]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { stone(g, 0.66); g.cube(sx * hw, yT, sz * hw, 0.9, 1.3, 0.9); stone(g, 0.5); g.push().move(sx * hw, yT + 1.3, sz * hw).rotY(Math.PI / 4); g.cyl(0, 0, 0, 0.6, 0, 1.5, 4, false); g.pop(); }
  stone(g, 0.6); g.cube(0, yT + 0.75, 0, 1.5, 0.5, 1.5);
  cross(g, 0, yT + 1.25, 0, 3.0);
}

export function build(g) {
  g.gloss(0).glow(0).sway(0);
  // ----- bậc thềm -----
  g.mat(MAT.mossy);
  for (let i = 0; i < 3; i++) { stone(g, 1.25 - i * 0.08, 0.3); g.box(-W / 2 - 0.3, 0, ZF - 1, W / 2 + 0.3, 0.2 * (3 - i), ZF + 0.6 + i * 0.45, 'xXYZ'); }
  g.mat(MAT.plaster);

  // ----- hai tháp chuông -----
  for (const sx of [-1, 1]) { g.push().move(sx * (W / 2 - TW / 2), 0, ZF - TW / 2); tower(g, sx < 0 ? 3 : 7, sx < 0 ? 1 : 3); g.pop(); }

  // ----- gian giữa mặt tiền: cổng chính, cửa sổ lớn có hoa hồng, đồng hồ, đầu hồi nhọn và thánh giá -----
  const cw = W / 2 - TW, zc = ZF - 0.55, yG = 22.2, yApex = 26.6;
  streakWall(g, -cw, 0, cw, 8.2, zc, 501, 1.25, 2.8);
  streakWall(g, -cw, 8.2, cw, 18.4, zc, 502, 1.25, 2.6);
  streakWall(g, -cw, 18.4, cw, yG, zc, 503, 1.25, 2, 0.9);
  { const b = g.count; stone(g, 0.7); g.v(-cw, yG, zc, 0, 0, 1); g.v(cw, yG, zc, 0, 0, 1); stone(g, 0.42); g.v(0, yApex, zc, 0, 0, 1); g.tri(b, b + 1, b + 2); }
  // viền đầu hồi
  stone(g, 0.95);
  g.quad([0, yApex - 0.55, zc + 0.12], [cw, yG - 0.55, zc + 0.12], [cw, yG, zc + 0.12], [0, yApex + 0.1, zc + 0.12]);
  g.quad([-cw, yG - 0.55, zc + 0.12], [0, yApex - 0.55, zc + 0.12], [0, yApex + 0.1, zc + 0.12], [-cw, yG, zc + 0.12]);
  g.quad([0, yApex + 0.1, zc + 0.12], [cw, yG, zc + 0.12], [cw, yG, zc - 0.7], [0, yApex + 0.1, zc - 0.7]);
  g.quad([-cw, yG, zc + 0.12], [0, yApex + 0.1, zc + 0.12], [0, yApex + 0.1, zc - 0.7], [-cw, yG, zc - 0.7]);
  // mặt sau đầu hồi (nhô trên mái gian giữa)
  stone(g, 0.5); g.quad([cw, Y_NAVE - 1, zc - 0.7], [-cw, Y_NAVE - 1, zc - 0.7], [-cw, yG, zc - 0.7], [cw, yG, zc - 0.7]); g.tri3([cw, yG, zc - 0.7], [-cw, yG, zc - 0.7], [0, yApex + 0.1, zc - 0.7]);
  cross(g, 0, yApex - 0.1, zc - 0.3, 2.6);
  // gờ ngang
  g.mat(MAT.concrete); stone(g, 0.98); g.box(-cw, 7.95, zc, cw, 8.25, zc + 0.35, 'YZy'); g.box(-cw, 18.15, zc, cw, 18.45, zc + 0.35, 'YZy'); g.mat(MAT.plaster);
  // cổng chính
  lancet(g, 0, 0.6, 3.3, 4.0, 6.7, zc, 'door', 21);
  // cửa sổ lớn: vòm nhọn kính màu, trong đầu vòm có hoa hồng tròn
  lancet(g, 0, 9.3, 3.7, 5.0, 8.1, zc, 'glass', 22);
  g.mat(); g.color(TRIM).shade(0.7); for (const x of [-0.62, 0.62]) g.quad([x - 0.06, 9.3, zc + 0.3], [x + 0.06, 9.3, zc + 0.3], [x + 0.06, 13.6, zc + 0.3], [x - 0.06, 13.6, zc + 0.3]);
  g.color(TRIM).shade(0.78); discZ(g, 0, 14.9, 1.42, zc + 0.3, 16);
  g.color(0x24345c).gloss(0.45).glow(0.8); discZ(g, 0, 14.9, 1.16, zc + 0.36, 16); g.gloss(0).glow(0);
  g.color(TRIM).shade(0.7);
  for (let i = 0; i < 4; i++) { g.push().move(0, 14.9, zc + 0.42).rotZ((i * Math.PI) / 4); g.quad([-1.16, -0.045, 0], [1.16, -0.045, 0], [1.16, 0.045, 0], [-1.16, 0.045, 0]); g.pop(); }
  discZ(g, 0, 14.9, 0.3, zc + 0.46, 8);
  // đồng hồ
  g.color(0x2a2a2a); discZ(g, 0, 20.5, 1.38, zc + 0.16, 16);
  g.color(0xe9e4d2).glow(0.5); discZ(g, 0, 20.5, 1.18, zc + 0.21, 16); g.glow(0);
  g.color(0x151515);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.push().move(Math.sin(a) * 1.0, 20.5 + Math.cos(a) * 1.0, zc + 0.26).rotZ(a); g.quad([-0.035, -0.11, 0], [0.035, -0.11, 0], [0.035, 0.11, 0], [-0.035, 0.11, 0]); g.pop(); }
  g.push().move(0, 20.5, zc + 0.28).rotZ(1.05); g.quad([-0.05, -0.1, 0], [0.05, -0.1, 0], [0.05, 0.62, 0], [-0.05, 0.62, 0]); g.pop();
  g.push().move(0, 20.5, zc + 0.28).rotZ(-0.9); g.quad([-0.035, -0.1, 0], [0.035, -0.1, 0], [0.035, 0.92, 0], [-0.035, 0.92, 0]); g.pop();
  g.mat(MAT.plaster);

  // ----- thân nhà thờ: gian giữa cao, hai gian bên thấp, trụ tường, cửa sổ vòm nhọn; cánh ngang chiếm hai gian gần cung thánh -----
  const nb = 10, bay = (ZT - ZA) / nb, ZT0 = ZA + bay, ZT1 = ZA + 3 * bay, yTA = Y_RIDGE + 0.6, yTG = Y_NAVE + 0.5;
  const roofQ = (p0, p1, p2, p3, k) => { g.mat(MAT.tile).color(ROOF).shade(k); g.quad(p0, p1, p2, p3); g.mat(MAT.plaster); };
  for (const sx of [-1, 1]) {
    g.push().rotY((sx * Math.PI) / 2);
    const lx = (wz) => -sx * wz;
    const xa = Math.min(lx(ZT), lx(ZA)), xb = Math.max(lx(ZT), lx(ZA));
    const xn0 = Math.min(lx(ZF - 1.2), lx(ZAP)), xn1 = Math.max(lx(ZF - 1.2), lx(ZAP));
    const ta = Math.min(lx(ZT0), lx(ZT1)), tb = Math.max(lx(ZT0), lx(ZT1)), tc = (ta + tb) / 2, inT = (x) => x > ta - 0.01 && x < tb + 0.01;
    // tường gian bên + tầng cửa sổ trên của gian giữa
    streakWall(g, xa, 0, xb, Y_AISLE, W / 2, 600 + sx, bay / 2, 3.1);
    streakWall(g, xn0, Y_LEAN - 0.2, xn1, Y_NAVE, NAVE, 620 + sx, bay / 2, 2.8);
    // đoạn tường gian giữa sau gian bên (tới hậu cung)
    streakWall(g, Math.min(lx(ZA), lx(ZAP)), 0, Math.max(lx(ZA), lx(ZAP)), Y_LEAN - 0.2, NAVE, 640 + sx, 1.5, 3);
    // mái gian bên, mái gian giữa
    for (let i = 0; i < nb; i++) {
      const a = xa + i * bay, b = a + bay; if (inT(a + bay / 2)) continue;
      roofQ([a, Y_AISLE, W / 2 + 0.35], [b, Y_AISLE, W / 2 + 0.35], [b, Y_LEAN, NAVE], [a, Y_LEAN, NAVE], 0.85 + 0.3 * hash(700 + sx, i));
    }
    const nr = 12, rl = (xn1 - xn0) / nr;
    for (let i = 0; i < nr; i++) {
      const a = xn0 + i * rl, b = a + rl;
      roofQ([a, Y_NAVE - 0.1, NAVE + 0.4], [b, Y_NAVE - 0.1, NAVE + 0.4], [b, Y_RIDGE, 0], [a, Y_RIDGE, 0], 0.82 + 0.34 * hash(720 + sx, i));
    }
    // gờ mái
    g.mat(MAT.concrete); stone(g, 0.85); g.box(xa, Y_AISLE - 0.3, W / 2, xb, Y_AISLE, W / 2 + 0.3, 'Zy'); g.box(xn0, Y_NAVE - 0.35, NAVE, xn1, Y_NAVE - 0.1, NAVE + 0.3, 'Zy'); g.mat(MAT.plaster);
    // cửa sổ và trụ tường
    for (let i = 0; i < nb; i++) {
      const c = xa + (i + 0.5) * bay; if (inT(c)) continue;
      lancet(g, c, 2.4, 1.5, 3.6, 5.2, W / 2, 'glass', 800 + i + sx * 20);
      lancet(g, c, Y_LEAN + 0.9, 1.3, 2.2, 3.4, NAVE, 'glass', 840 + i + sx * 20);
    }
    const buttress = (c, z0, z1, h, k) => { // trụ tường có mũ dốc; rêu mốc bám nhiều nhất ở đây
      g.mat(MAT.mossy);
      stone(g, k * 0.95); g.box(c - 0.4, 0, z0, c + 0.4, h, z1, 'xX'); g.tri3([c + 0.4, h, z1], [c + 0.4, h, z0], [c + 0.4, h + 1.5, z0]); g.tri3([c - 0.4, h, z0], [c - 0.4, h, z1], [c - 0.4, h + 1.5, z0]);
      const b = g.count; stone(g, k * 0.8); g.v(c - 0.4, 0, z1, 0, 0, 1); g.v(c + 0.4, 0, z1, 0, 0, 1); stone(g, k * 1.3); g.v(c + 0.4, h, z1, 0, 0, 1); g.v(c - 0.4, h, z1, 0, 0, 1); g.tri(b, b + 1, b + 2); g.tri(b, b + 2, b + 3);
      stone(g, k * 1.35); g.quad([c - 0.4, h, z1], [c + 0.4, h, z1], [c + 0.4, h + 1.5, z0], [c - 0.4, h + 1.5, z0]);
      g.mat(MAT.plaster);
    };
    for (let i = 0; i <= nb; i++) {
      const c = xa + i * bay;
      if ((sx > 0 && i === nb) || (sx < 0 && i === 0) || inT(c)) continue; // sát tháp, hoặc trong cánh ngang
      buttress(c, W / 2, W / 2 + 1.0, 7.0, 0.75 + 0.3 * hash(900 + sx, i));
    }
    // ----- cánh ngang: đầu hồi nhô 0,5 m khỏi tường gian bên, cửa sổ vòm nhọn lớn, cửa tròn trên đầu hồi -----
    streakWall(g, ta, 0, tb, Y_NAVE, XT, 660 + sx, 1.3, 2.9);
    { const b = g.count; stone(g, 0.66); g.v(ta, Y_NAVE, XT, 0, 0, 1); g.v(tb, Y_NAVE, XT, 0, 0, 1); stone(g, 0.42); g.v(tc, yTA, XT, 0, 0, 1); g.tri(b, b + 1, b + 2); }
    g.mat(MAT.concrete); stone(g, 0.95);
    g.quad([tc, yTA - 0.55, XT + 0.12], [tb, yTG - 0.55, XT + 0.12], [tb, yTG, XT + 0.12], [tc, yTA + 0.1, XT + 0.12]);
    g.quad([ta, yTG - 0.55, XT + 0.12], [tc, yTA - 0.55, XT + 0.12], [tc, yTA + 0.1, XT + 0.12], [ta, yTG, XT + 0.12]);
    g.quad([tc, yTA + 0.1, XT + 0.12], [tb, yTG, XT + 0.12], [tb, yTG, XT - 0.6], [tc, yTA + 0.1, XT - 0.6]);
    g.quad([ta, yTG, XT + 0.12], [tc, yTA + 0.1, XT + 0.12], [tc, yTA + 0.1, XT - 0.6], [ta, yTG, XT - 0.6]);
    stone(g, 0.9); g.box(ta, 3.6, XT, tb, 3.85, XT + 0.3, 'YZy');
    g.mat(MAT.plaster);
    lancet(g, tc, 4.7, 3.2, 6.4, 9.4, XT, 'glass', 670 + sx);
    g.mat(); g.color(TRIM).shade(0.7); for (const x of [-0.55, 0.55]) g.quad([tc + x - 0.06, 4.7, XT + 0.3], [tc + x + 0.06, 4.7, XT + 0.3], [tc + x + 0.06, 11.6, XT + 0.3], [tc + x - 0.06, 11.6, XT + 0.3]);
    g.color(TRIM).shade(0.75); discZ(g, tc, 18.6, 1.05, XT + 0.1, 12); g.color(0x24345c).gloss(0.45).glow(0.7); discZ(g, tc, 18.6, 0.8, XT + 0.16, 12); g.gloss(0).glow(0);
    g.mat(MAT.plaster);
    cross(g, tc, yTA, XT - 0.25, 1.6);
    buttress(ta + 0.4, XT, XT + 0.5, 11.5, 0.8); buttress(tb - 0.4, XT, XT + 0.5, 11.5, 0.86);
    // hai mái dốc của cánh ngang, nóc cao bằng nóc gian giữa
    roofQ([ta - 0.4, Y_NAVE - 0.1, 0], [ta - 0.4, Y_NAVE - 0.1, XT - 0.2], [tc, Y_RIDGE, XT - 0.2], [tc, Y_RIDGE, 0], 1.0);
    roofQ([tb + 0.4, Y_NAVE - 0.1, XT - 0.2], [tb + 0.4, Y_NAVE - 0.1, 0], [tc, Y_RIDGE, 0], [tc, Y_RIDGE, XT - 0.2], 0.9);
    g.mat().color(0x1d1b1b); g.box(tc - 0.15, Y_RIDGE - 0.05, 0, tc + 0.15, Y_RIDGE + 0.22, XT - 0.6, 'xXY'); g.mat(MAT.plaster);
    // hai tường bên của cánh ngang (nhô trên mái gian bên), mỗi bên một cửa sổ cao
    for (const e of [-1, 1]) {
      g.push().move(e < 0 ? ta : tb, 0, 0).rotY((e * Math.PI) / 2);
      const u0 = e < 0 ? NAVE : -XT, u1 = e < 0 ? XT : -NAVE;
      streakWall(g, u0, 0, u1, Y_NAVE, 0, 680 + sx * 3 + e, 1.5, 2.9);
      g.mat(MAT.concrete); stone(g, 0.85); g.box(u0, Y_NAVE - 0.35, 0, u1, Y_NAVE - 0.1, 0.3, 'Zy'); g.mat(MAT.plaster);
      lancet(g, (u0 + u1) / 2 + (e < 0 ? 0.6 : -0.6), Y_LEAN + 0.9, 1.3, 2.2, 3.4, 0, 'glass', 690 + sx * 3 + e);
      g.pop();
    }
    g.pop();
  }
  // sống mái
  g.mat().color(0x1d1b1b); g.box(-0.15, Y_RIDGE - 0.05, ZAP, 0.15, Y_RIDGE + 0.22, ZF - 1.2, 'xXY'); g.mat(MAT.plaster);
  // đầu hồi gian bên phía sau
  for (const sx of [-1, 1]) {
    g.push().move(0, 0, ZA).rotY(Math.PI);
    const a = sx < 0 ? -W / 2 : NAVE, b = sx < 0 ? -NAVE : W / 2;
    streakWall(g, a, 0, b, Y_AISLE, 0, 950 + sx, 1.4, 3.1);
    stone(g, 0.5); if (sx < 0) g.tri3([a, Y_AISLE, 0], [b, Y_AISLE, 0], [b, Y_LEAN, 0]); else g.tri3([a, Y_AISLE, 0], [b, Y_AISLE, 0], [a, Y_LEAN, 0]);
    lancet(g, (a + b) / 2, 2.4, 1.4, 3.4, 4.9, 0, 'glass', 960 + sx);
    g.pop();
  }
  // ----- hậu cung đa giác (mỗi mặt một dải tường liền từ chân tới gờ mái) -----
  const na = 5, ap = NAVE * Math.cos(Math.PI / (2 * na)), sw = 2 * NAVE * Math.sin(Math.PI / (2 * na));
  for (let i = 0; i < na; i++) {
    const am = ((i + 0.5) * Math.PI) / na, a0 = (i * Math.PI) / na, a1 = ((i + 1) * Math.PI) / na;
    g.push().move(Math.cos(am) * ap, 0, ZAP - Math.sin(am) * ap).rotY(Math.atan2(Math.cos(am), -Math.sin(am)));
    streakWall(g, -sw / 2, 0, sw / 2, Y_NAVE, 0, 1000 + i, 1.5, 100, 0.85);
    lancet(g, 0, 4.2, 1.15, 6.2, 7.6, 0, 'glass', 1010 + i);
    g.mat(MAT.concrete); stone(g, 0.85); g.box(-sw / 2, Y_NAVE - 0.35, 0, sw / 2, Y_NAVE - 0.1, 0.3, 'Zy');
    g.mat(MAT.mossy); stone(g, 0.75); g.box(-sw / 2 - 0.25, 0, 0, -sw / 2 + 0.25, 13, 0.55, 'xXZY'); if (i === na - 1) g.box(sw / 2 - 0.25, 0, 0, sw / 2 + 0.25, 13, 0.55, 'xXZY');
    g.mat(MAT.plaster);
    g.pop();
    const p0 = [Math.cos(a0) * (NAVE + 0.4), Y_NAVE - 0.1, ZAP - Math.sin(a0) * (NAVE + 0.4)], p1 = [Math.cos(a1) * (NAVE + 0.4), Y_NAVE - 0.1, ZAP - Math.sin(a1) * (NAVE + 0.4)];
    g.mat(MAT.tile).color(ROOF).shade(0.8 + 0.4 * hash(1030, i)); g.tri3(p0, p1, [0, Y_RIDGE, ZAP]); g.mat(MAT.plaster);
  }
  cross(g, 0, Y_RIDGE + 0.1, ZAP, 1.8);
  // đèn pha trắng ấm rọi mặt tiền và hai tháp chuông (art bible mục 7); thân nhà thờ phía sau chỉ hửng nhẹ
  floodlit(g, 0, g.count, (x, y, z, nx, ny, nz) => (ny > 0.5 ? 0.03 : nz > 0.5 ? 0.2 : z > ZT - 1 ? 0.12 : 0.05));
  g.mat().color(0xffffff).gloss(0).glow(0).sway(0);
}
