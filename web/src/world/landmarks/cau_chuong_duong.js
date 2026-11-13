// Cầu Chương Dương (1985): dàn thép biên song song qua sông Hồng. Hai mặt phẳng dàn đứng hai bên lòng cầu ô tô;
// hai làn xe máy chạy ngoài dàn, mỗi bên một làn (đúng như thẻ OSM: làn ngoài chỉ cho xe máy, lòng giữa cho ô tô).
// Mặt cầu, lan can bê tông và trụ do worker dựng (gen/ground.js); tệp này chỉ dựng phần thép.
// Nhịp dàn 89,28 m chia 12 khoang, cao 10,2 m: kích thước ước lượng theo ảnh, chưa đối chiếu bản vẽ.
import { MAT } from '../../core/geo.js';
import { CD_SPAN } from '../data.js';

export const CD_HALF = 5.4; // khoảng cách từ tim cầu tới mỗi mặt phẳng dàn (khe giữa lòng ô tô và làn xe máy)
const NP = 12, PANEL = CD_SPAN / NP, HT = 10.2;

// P: [[x, z], ...] tim lòng cầu giữa, đoạn có dàn thép; dựng khúc từ quãng s0 tới s1 (bội số của nhịp); y0: cao độ mặt cầu.
export function buildAlong(g, P, s0, s1, y0, half = CD_HALF) {
  if (P.length < 2) return;
  const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = cum[cum.length - 1];
  const at = (s) => { let i = 0; while (i < cum.length - 2 && cum[i + 1] < s) i++; const t = (s - cum[i]) / (cum[i + 1] - cum[i] || 1), dx = P[i + 1][0] - P[i][0], dz = P[i + 1][1] - P[i][1], l = Math.hypot(dx, dz) || 1; return [P[i][0] + dx * t, P[i][1] + dz * t, dx / l, dz / l]; };
  const base = y0 + 0.3, top = base + HT;
  const k0 = Math.round(s0 / PANEL), k1 = Math.min(Math.round(s1 / PANEL), Math.floor(L / PANEL));
  const S = (A, sd, y) => [A[0] - A[3] * half * sd, y, A[1] + A[2] * half * sd]; // điểm trên mặt phẳng dàn bên sd
  for (let k = k0; k < k1; k++) {
    const A = at(k * PANEL), B = at((k + 1) * PANEL), j = ((k % NP) + NP) % NP, first = j === 0, last = j === NP - 1;
    const tone = 0.92 + ((k * 5) % 4) * 0.035; g.mat(MAT.rust).rgb(0.2 * tone, 0.245 * tone, 0.27 * tone); // sơn xám xanh đã cũ
    for (const sd of [-1, 1]) {
      g.tube(S(A, sd, base), S(B, sd, base), 0.26, 4);                       // biên dưới
      g.tube(S(A, sd, top), S(B, sd, top), 0.24, 4);                         // biên trên
      g.tube(S(A, sd, base), S(A, sd, top), first ? 0.24 : 0.13, 4);         // thanh đứng (cổng đầu nhịp to hơn)
      if (last) g.tube(S(B, sd, base), S(B, sd, top), 0.24, 4);
      if (j % 2) g.tube(S(A, sd, base), S(B, sd, top), 0.17, 4); else g.tube(S(A, sd, top), S(B, sd, base), 0.17, 4); // thanh xiên chữ W
    }
    // giằng trên: thanh ngang ở mỗi nút, giằng chéo chữ X trong từng khoang
    g.tube(S(A, -1, top), S(A, 1, top), 0.12, 4);
    if (last) g.tube(S(B, -1, top), S(B, 1, top), 0.12, 4);
    g.tube(S(A, -1, top), S(B, 1, top), 0.07, 3); g.tube(S(A, 1, top), S(B, -1, top), 0.07, 3);
    // cổng đầu nhịp: xà ngang thấp hơn, có thanh chống xiên
    for (const [E, on] of [[A, first], [B, last]]) {
      if (!on) continue;
      g.tube(S(E, -1, top - 2.6), S(E, 1, top - 2.6), 0.12, 4);
      for (const sd of [-1, 1]) g.tube(S(E, sd, top - 4.4), [E[0] - E[3] * (half - 1.8) * sd, top - 2.6, E[1] + E[2] * (half - 1.8) * sd], 0.08, 3);
    }
  }
  g.mat();
}
