// Soát lỗi mô hình thủ tục (dùng chung cho trang xưởng vẽ và tools/studio.mjs, chạy được trong Node).
// Đầu vào là gói G.pack(): { pos, nrm, col, fx, idx, box }.
import { MAT } from '../src/core/geo.js';

export const MAT_NAMES = Object.fromEntries(Object.entries(MAT).map(([k, v]) => [v, k]));

// plainOk: mô hình vẽ bằng instancing (xe cộ) không dùng được chất liệu chi tiết, bề mặt trơn là đúng thiết kế
export function lint(p, { budget = 6000, ground = true, plainOk = false } = {}) {
  const { pos, idx, fx } = p, nt = idx.length / 3, out = { tris: nt, verts: pos.length / 3, warn: [], err: [] };
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9, nan = 0;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2]; if (!Number.isFinite(x + y + z)) { nan++; continue; }
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  out.size = [x1 - x0, y1 - y0, z1 - z0].map((v) => +v.toFixed(2)); out.minY = +y0.toFixed(2);
  // diện tích theo chất liệu, tam giác suy biến, mặt phẳng trùng nhau (nguy cơ nhấp nháy khi nhìn xa)
  const area = {}; let total = 0, degenerate = 0;
  const planes = new Map(); // khoá: pháp tuyến lượng tử + khoảng cách tới gốc (bước 1 cm)
  for (let t = 0; t < nt; t++) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz), ar = l / 2;
    if (ar < 1e-7) { degenerate++; continue; }
    const m = Math.round(fx[idx[t * 3] * 4 + 3] / 16); area[m] = (area[m] || 0) + ar; total += ar;
    if (ar < 0.02) continue; // mảnh nhỏ không đáng lo
    nx /= l; ny /= l; nz /= l;
    const d = nx * pos[a] + ny * pos[a + 1] + nz * pos[a + 2];
    const key = `${Math.round(nx * 20)},${Math.round(ny * 20)},${Math.round(nz * 20)},${Math.round(d * 100)}`;
    const bb = [Math.min(pos[a], pos[b], pos[c]), Math.min(pos[a + 1], pos[b + 1], pos[c + 1]), Math.min(pos[a + 2], pos[b + 2], pos[c + 2]), Math.max(pos[a], pos[b], pos[c]), Math.max(pos[a + 1], pos[b + 1], pos[c + 1]), Math.max(pos[a + 2], pos[b + 2], pos[c + 2])];
    let list = planes.get(key); if (!list) planes.set(key, (list = [])); list.push({ bb, ar, q: Math.floor(t / 2), col: p.col[idx[t * 3] * 4] + p.col[idx[t * 3] * 4 + 1] * 256 + p.col[idx[t * 3] * 4 + 2] * 65536 });
  }
  // hai mảnh khác màu cùng nằm trên một mặt phẳng (lệch dưới 1 cm) và chồng lên nhau: sẽ tranh nhau từng điểm ảnh
  let fight = 0; const fights = [];
  for (const list of planes.values()) {
    if (list.length < 2 || list.length > 400) continue;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const A = list[i], B = list[j]; if (A.q === B.q) continue;
      // màu gần giống nhau (lệch sắc độ nhẹ giữa các mảng tường) thì có tranh nhau cũng không thấy
      if (Math.abs((A.col & 255) - (B.col & 255)) + Math.abs(((A.col >> 8) & 255) - ((B.col >> 8) & 255)) + Math.abs((A.col >> 16) - (B.col >> 16)) < 40) continue;
      const ox = Math.min(A.bb[3], B.bb[3]) - Math.max(A.bb[0], B.bb[0]), oy = Math.min(A.bb[4], B.bb[4]) - Math.max(A.bb[1], B.bb[1]), oz = Math.min(A.bb[5], B.bb[5]) - Math.max(A.bb[2], B.bb[2]);
      if (ox < -1e-4 || oy < -1e-4 || oz < -1e-4) continue;
      const dims = [ox, oy, oz].map((v) => Math.max(v, 0)).sort((a, b) => b - a); // hai chiều lớn nhất của phần chồng
      if (dims[0] * dims[1] > 0.04) { const f = Math.min(A.ar, B.ar, dims[0] * dims[1]); fight += f; fights.push({ f: +f.toFixed(2), at: [Math.max(A.bb[0], B.bb[0]), Math.max(A.bb[1], B.bb[1]), Math.max(A.bb[2], B.bb[2])].map((v) => +v.toFixed(2)), to: [Math.min(A.bb[3], B.bb[3]), Math.min(A.bb[4], B.bb[4]), Math.min(A.bb[5], B.bb[5])].map((v) => +v.toFixed(2)) }); }
    }
  }
  out.fight = +fight.toFixed(2); out.fights = fights.sort((a, b) => b.f - a.f).slice(0, 8); // các chỗ trùng lớn nhất: hộp bao phần chồng [từ] → [đến]
  out.mats = Object.fromEntries(Object.entries(area).map(([k, v]) => [MAT_NAMES[k] || k, Math.round((v / total) * 100)]));
  out.plain = out.mats.none || 0;
  if (nan) out.err.push(`${nan} đỉnh NaN`);
  if (nt > budget) out.err.push(`${nt} tam giác, vượt ngân sách ${budget}`);
  if (degenerate > nt * 0.02) out.warn.push(`${degenerate} tam giác suy biến`);
  if (ground && y0 > 0.3) out.warn.push(`lơ lửng: điểm thấp nhất cao ${y0.toFixed(2)} m`);
  if (ground && y0 < -3.5) out.warn.push(`chìm sâu: điểm thấp nhất ${y0.toFixed(2)} m`);
  if (fight > 0.5) out.warn.push(`${fight.toFixed(1)} m² mặt trùng nhau khác màu (dễ nhấp nháy): tách ra ít nhất 3 cm`);
  if (out.plain > 60 && !plainOk) out.warn.push(`${out.plain}% bề mặt còn trơn (chưa gắn chất liệu)`);
  return out;
}
