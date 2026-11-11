// Tiện ích toán dùng chung cho luồng chính và worker (không phụ thuộc three.js).
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const TAU = Math.PI * 2;
export const wrapAngle = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
export const damp = (cur, target, rate, dt) => lerp(cur, target, 1 - Math.exp(-rate * dt));
export const dampAngle = (cur, target, rate, dt) => cur + wrapAngle(target - cur) * (1 - Math.exp(-rate * dt));

// Băm số nguyên → [0,1). Tất định, dùng để nhà nào cũng ra cùng màu, cùng số tầng ở mọi lần chơi.
export function hash(i, k = 0) {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(k | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export const hash2 = (x, z, k = 0) => hash(Math.imul(Math.round(x * 7), 73856093) ^ Math.imul(Math.round(z * 7), 19349663), k);

// Bộ sinh số giả ngẫu nhiên có hạt giống (mulberry32).
export function rng(seed) {
  let a = seed | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function pointInRing(x, z, r) { // r: mảng phẳng [x0,z0,x1,z1,...]
  let inside = false;
  for (let i = 0, n = r.length, j = n - 2; i < n; j = i, i += 2) {
    const zi = r[i + 1], zj = r[j + 1];
    if ((zi > z) !== (zj > z) && x < ((r[j] - r[i]) * (z - zi)) / (zj - zi) + r[i]) inside = !inside;
  }
  return inside;
}
export function ringArea(r) { let a = 0; for (let i = 0, n = r.length; i < n; i += 2) { const j = (i + 2) % n; a += r[i] * r[j + 1] - r[j] * r[i + 1]; } return a / 2; }

// Khoảng cách từ điểm tới đoạn thẳng; trả về bình phương khoảng cách, ghi t vào out[0].
export function segDist2(px, pz, ax, az, bx, bz, out) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0;
  if (out) out[0] = t;
  const qx = ax + dx * t - px, qz = az + dz * t - pz;
  return qx * qx + qz * qz;
}
