// Tháp Rùa trên gò Rùa giữa hồ Hoàn Kiếm.
// Gốc toạ độ: tâm gò, y = 0 là mặt bờ hồ (mặt nước ở y = -0.5). Hai mặt dài của tháp (ba cửa) nhìn về ±z.
// Số đo thật: tầng một 6,28 × 4,54 m; tầng hai 4,8 × 3,64 m; tầng ba 2,97 × 1,9 m; vọng lâu trên đỉnh vuông ~2 m;
// từ nền gò lên đỉnh 8,8 m. Hai tầng dưới cửa vòm nhọn (ba cửa mặt dài, hai cửa mặt ngắn), tầng ba mỗi mặt một cửa vòm tròn.
import { hash } from '../../core/util.js';
import { MAT } from '../../core/geo.js';

const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lin = (h) => [s2l(((h >> 16) & 255) / 255), s2l(((h >> 8) & 255) / 255), s2l((h & 255) / 255)];

const TOP = 0.9;            // cao độ mặt gò
const WALL = 0x979286;      // vữa xám nâu đã bạc
const WALL_HI = 0xaea68f;   // mảng vữa còn sáng
const TRIM = 0x827e74;      // gờ chỉ
const DARK = 0x16130f;      // lòng cửa
const MOSS = lin(0x4f5a2c);
const SOOT = lin(0x2e2b25);

// Chất liệu chi tiết (vữa cũ, đá rêu) đã tự vẽ loang màu, vệt nước mưa và chân tường ẩm, nên lớp phong hoá nướng vào màu đỉnh
// chỉ giữ phần mà shader không biết: sẫm dần về chân TỪNG tầng và ngay dưới từng gờ mái. WK: hệ số giảm để không tối hai lần.
const WK = 0.7;
// Phong hoá: các đỉnh từ `from` tới hết được làm tối dần về phía chân (y0) và ngay dưới gờ (y1), loang rêu và vệt đen theo băm vị trí.
function weather(g, from, y0, y1, seed = 0, moss = 0.5, soot = 0.5) {
  for (let i = from; i < g.count; i++) {
    const x = g.pos[i * 3], y = g.pos[i * 3 + 1], z = g.pos[i * 3 + 2];
    const t = Math.min(1, Math.max(0, (y - y0) / Math.max(0.01, y1 - y0)));
    const n = hash(Math.round(x * 3.1) * 131 + Math.round(z * 3.1) * 17 + Math.round(y * 2.3) * 7, seed);
    const n2 = hash(Math.round(x * 1.3) * 57 + Math.round(z * 1.3) * 29, seed + 5);
    const low = (1 - t) * (1 - t);                       // ẩm, rêu ở chân tường
    const high = t > 0.8 ? (t - 0.8) / 0.2 : 0;          // vệt nước đen chảy từ gờ xuống
    const km = Math.min(0.5, WK * moss * (low * 1.0 + n2 * 0.25) * (0.4 + n));
    const ks = Math.min(0.5, WK * soot * (high * 0.7 + low * 0.22 + (n > 0.66 ? 0.3 : 0) + n2 * 0.12));
    const k = 0.92 + n * 0.14;
    for (let c = 0; c < 3; c++) {
      let v = g.col[i * 4 + c] * k;
      v = v * (1 - km) + MOSS[c] * km;
      v = v * (1 - ks) + SOOT[c] * ks;
      g.col[i * 4 + c] = v;
    }
  }
}

// Nửa vòm: các điểm [dx, dy] từ chân trái qua đỉnh sang chân phải. a: nửa bề rộng; nhọn: tâm cung lệch sang bên kia (kiểu Gô-tích).
function archPts(a, pointed, K = 5) {
  const c = pointed ? a * 0.5 : 0, R = a + c, th1 = Math.acos(c / R), L = [];
  for (let k = 0; k <= K; k++) { const th = (th1 * k) / K; L.push([c - R * Math.cos(th), R * Math.sin(th)]); }
  const pts = L.slice();
  for (let k = K - 1; k >= 0; k--) pts.push([-L[k][0], L[k][1]]);
  return pts;
}

// Một mặt tường có dãy cửa vòm, dựng trong hệ cục bộ: mặt tường ở z = 0 nhìn về +z, x ∈ [-W/2, W/2], y ∈ [y0, y0+H].
// n cửa rộng ow, chân vòm cao sh; th: bề dày tường (độ sâu hốc cửa). Trả về danh sách tâm cửa.
function arcade(g, W, y0, H, n, ow, sh, pointed, th, seed) {
  const gap = (W - n * ow) / (n + 1), a = ow / 2, yT = y0 + H, ys = y0 + sh, arch = archPts(a, pointed);
  let x = -W / 2;
  for (let i = 0; i <= n; i++) {
    // trụ tường giữa các cửa: mỗi trụ một sắc độ để mặt tường không phẳng lì
    g.color(hash(seed, i) < 0.35 ? WALL_HI : WALL).shade(0.9 + hash(seed, 10 + i) * 0.2);
    const yb = [y0, y0 + H * 0.16, y0 + H * 0.5, y0 + H * 0.8, yT];
    for (let b = 0; b < 4; b++) g.box(x, yb[b], -th, x + gap, yb[b + 1], 0, 'xXZ');
    x += gap;
    if (i === n) break;
    const cx = x + a;
    // mảng tường trên vòm
    for (let k = 0; k < arch.length - 1; k++) {
      const p = arch[k], q = arch[k + 1];
      g.quad([cx + p[0], ys + p[1], 0], [cx + q[0], ys + q[1], 0], [cx + q[0], yT, 0], [cx + p[0], yT, 0]);
    }
    // lòng vòm (mặt dưới cuốn)
    g.color(TRIM).shade(0.62);
    for (let k = 0; k < arch.length - 1; k++) {
      const p = arch[k], q = arch[k + 1];
      g.quad([cx + p[0], ys + p[1], 0], [cx + p[0], ys + p[1], -th], [cx + q[0], ys + q[1], -th], [cx + q[0], ys + q[1], 0]);
    }
    // ngưỡng cửa và lòng tháp tối phía sau
    // ngưỡng cửa: cao hơn mặt gờ bên dưới 5 cm (trước đây 2 cm, trùng đúng mặt trên của gờ chân tầng)
    g.color(TRIM).shade(0.7).quad([cx - a, y0 + 0.05, 0], [cx + a, y0 + 0.05, 0], [cx + a, y0 + 0.05, -th], [cx - a, y0 + 0.05, -th]);
    g.mat().color(DARK).quad([cx - a, y0, -th], [cx + a, y0, -th], [cx + a, ys + arch[(arch.length - 1) / 2][1] + 0.02, -th], [cx - a, ys + arch[(arch.length - 1) / 2][1] + 0.02, -th]);
    g.mat(MAT.plaster);
    x += ow;
  }
}

// Một tầng tháp hình hộp chữ nhật W (theo x) × D (theo z), bốn mặt có cửa vòm.
function storey(g, W, D, y0, H, nLong, nShort, owL, owS, sh, pointed, th, seed) {
  const from = g.count;
  for (let f = 0; f < 4; f++) {
    g.push().rotY((f * Math.PI) / 2);
    if (f % 2 === 0) { g.move(0, 0, D / 2); arcade(g, W, y0, H, nLong, owL, sh, pointed, th, seed + f * 7); }
    else { g.move(0, 0, W / 2); arcade(g, D - th * 2, y0, H, nShort, owS, sh, pointed, th, seed + f * 7); }
    g.pop();
  }
  weather(g, from, y0, y0 + H, seed, 0.55, 0.6);
}

// Gờ mái: tấm đua ra quanh tầng, bốn góc có đầu đao nhỏ vểnh lên.
function cornice(g, W, D, y, h, out, seed, horn = 0.3) {
  const from = g.count;
  g.color(TRIM).shade(0.92);
  g.cube(0, y, 0, W + out * 0.9, h * 0.45, D + out * 0.9, 'xXyzZ');
  g.color(WALL_HI).shade(0.95);
  g.cube(0, y + h * 0.45, 0, W + out * 2, h * 0.55, D + out * 2);
  weather(g, from, y - 0.3, y + h, seed, 0.25, 0.75);
  if (horn > 0) {
    g.color(TRIM).shade(0.7);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const cx = sx * (W / 2 + out * 0.8), cz = sz * (D / 2 + out * 0.8), yy = y + h * 0.75;
      g.tube([cx, yy, cz], [cx + sx * horn * 0.6, yy + horn * 0.18, cz + sz * horn * 0.6], 0.085, 4, 0.06);
      g.tube([cx + sx * horn * 0.6, yy + horn * 0.18, cz + sz * horn * 0.6], [cx + sx * horn, yy + horn * 0.62, cz + sz * horn], 0.06, 4, 0.012);
    }
  }
}

// Bụi cây thấp: vài khối cầu méo, mặt dưới tối.
function shrub(g, x, y, z, r, seed) {
  const from = g.count, n = 2 + Math.floor(hash(seed, 1) * 2);
  for (let i = 0; i < n; i++) {
    const a = hash(seed, 10 + i) * 6.283, d = i === 0 ? 0 : r * 0.6, k = 0.75 + hash(seed, 20 + i) * 0.4;
    g.rgb(0.07 * k, 0.2 * k, 0.055 * k).sway(0.25);
    g.ball(x + Math.cos(a) * d, y + r * 0.55 * (i === 0 ? 1 : 0.75), z + Math.sin(a) * d, r * (i === 0 ? 1 : 0.7), 7, 4, 0.8, 0.3, seed + i);
  }
  for (let i = from; i < g.count; i++) { const k = 0.5 + 0.6 * (g.nrm[i * 3 + 1] * 0.5 + 0.5); g.col[i * 4] *= k; g.col[i * 4 + 1] *= k; g.col[i * 4 + 2] *= k; }
  g.sway(0);
}

// Gò Rùa: elip 26 × 18 m, kè đá thấp quanh mép nước, mặt cỏ vồng nhẹ lên tới TOP.
function islet(g) {
  const A = 13, B = 9, SEG = 36;
  const rings = [ // [tỉ lệ bán kính, cao độ, màu, hệ số sáng]
    [1.0, -1.3, 0x5b574c, 0.7], [0.995, -0.42, 0x6a6558, 0.8], [0.975, 0.12, 0x7b7566, 1], [0.95, 0.2, 0x6f6a55, 1],
    [0.93, 0.28, 0x5f6a38, 0.9], [0.74, 0.62, 0x5a6c34, 0.95], [0.45, 0.84, 0x62733a, 0.95], [0.02, TOP, 0x66743c, 0.95],
  ];
  const ring = (j) => {
    const [k, y] = rings[j], pts = [];
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2, w = 1 + (j > 0 && j < 7 ? (hash(i % SEG, 3) - 0.5) * 0.035 : 0);
      pts.push([Math.cos(a) * A * k * w, y + (j > 3 && j < 7 ? (hash(i % SEG, 40 + j) - 0.5) * 0.06 : 0), -Math.sin(a) * B * k * w]);
    }
    return pts;
  };
  for (let j = 0; j < rings.length - 1; j++) {
    const from = g.count;
    // kè đá quanh mép nước: đá rêu. Mặt cỏ: dùng lớp loang màu của «vữa» (trên mặt gần phẳng nó chỉ còn là các mảng đậm nhạt,
    // không có vệt chảy hay chân ẩm) để thảm cỏ không phẳng lì.
    g.mat(j < 3 ? MAT.mossy : MAT.plaster).color(rings[j][2]).shade(rings[j][3]);
    g.ribbon(ring(j + 1), ring(j));
    // tô lại hàng đỉnh trong theo màu vòng kế để chuyển sắc mượt, thêm loang lổ cỏ/đất
    const ci = lin(rings[j + 1][2]), ks = rings[j + 1][3];
    for (let i = from; i < g.count; i++) {
      const inner = (i - from) % 2 === 0, n = 0.86 + hash(i, 77 + j) * 0.28;
      if (inner) { g.col[i * 4] = ci[0] * ks * n; g.col[i * 4 + 1] = ci[1] * ks * n; g.col[i * 4 + 2] = ci[2] * ks * n; }
      else { g.col[i * 4] *= n; g.col[i * 4 + 1] *= n; g.col[i * 4 + 2] *= n; }
    }
  }
  g.mat();
}

export function build(g) {
  g.gloss(0).glow(0).sway(0);
  islet(g);

  g.push().move(0, TOP - 0.06, 0);
  // Ban đêm tháp được rọi đèn tự động như mọi công trình (không tự phát sáng).

  // nền móng hai cấp
  let from = g.count;
  g.mat(MAT.mossy);
  g.color(0x8a8476); g.cube(0, 0, 0, 7.7, 0.26, 5.95, 'xXYzZ');
  g.color(0x958f80); g.cube(0, 0.26, 0, 7.0, 0.3, 5.26, 'xXYzZ');
  weather(g, from, 0, 0.56, 3, 0.5, 0.4);
  g.mat(MAT.plaster);

  // tầng một: 6,28 × 4,54 m, ba cửa vòm nhọn mặt dài, hai cửa mặt ngắn
  const y1 = 0.56, H1 = 2.72;
  storey(g, 6.28, 4.54, y1, H1, 3, 2, 1.12, 1.06, 1.42, true, 0.4, 11);
  cornice(g, 6.28, 4.54, y1 + H1, 0.3, 0.2, 12, 0.34);

  // tầng hai: 4,8 × 3,64 m, lặp lại nhỏ hơn
  const y2 = y1 + H1 + 0.3, H2 = 1.95;
  from = g.count; g.color(TRIM).cube(0, y2 - 0.02, 0, 5.1, 0.14, 3.94, 'xXYzZ'); weather(g, from, y2, y2 + 0.2, 5, 0.6, 0.6);
  storey(g, 4.8, 3.64, y2 + 0.1, H2 - 0.1, 3, 2, 0.84, 0.8, 0.9, true, 0.34, 23);
  cornice(g, 4.8, 3.64, y2 + H2, 0.26, 0.17, 24, 0.3);

  // tầng ba: 2,97 × 1,9 m, mỗi mặt một cửa vòm tròn
  const y3 = y2 + H2 + 0.26, H3 = 1.36;
  from = g.count; g.color(TRIM).cube(0, y3 - 0.02, 0, 3.2, 0.12, 2.13, 'xXYzZ'); weather(g, from, y3, y3 + 0.2, 6, 0.6, 0.6);
  storey(g, 2.97, 1.9, y3 + 0.08, H3 - 0.08, 1, 1, 0.72, 0.6, 0.56, false, 0.28, 37);
  cornice(g, 2.97, 1.9, y3 + H3, 0.22, 0.14, 38, 0.26);

  // vọng lâu trên đỉnh: khối vuông nhỏ, mỗi mặt một ô cửa, gờ mái đầu đao và hàng trụ lan can như tường chắn mái
  const y4 = y3 + H3 + 0.22, S = 1.8, H4 = 0.86;
  storey(g, S, S, y4, H4, 1, 1, 0.5, 0.5, 0.3, false, 0.2, 51);
  cornice(g, S, S, y4 + H4, 0.2, 0.15, 52, 0.3);
  const y5 = y4 + H4 + 0.2;
  from = g.count;
  g.color(WALL).shade(0.95);
  const M = 0.3, half = S / 2 + 0.02;
  for (let i = 0; i < 4; i++) {            // 4 ụ mỗi cạnh (ụ góc dùng chung)
    const p = -half + M / 2 + (i * (half * 2 - M)) / 3;
    for (const s of [-1, 1]) {
      g.cube(p, y5, s * (half - M / 2), M, i === 0 || i === 3 ? 0.4 : 0.3, M);
      if (i > 0 && i < 3) g.cube(s * (half - M / 2), y5, p, M, 0.3, M);
    }
  }
  g.color(TRIM); g.cube(0, y5, 0, S - M * 1.2, 0.14, S - M * 1.2, 'xXYzZ');
  g.color(WALL_HI).shade(0.9); g.cube(0, y5 + 0.14, 0, 0.5, 0.2, 0.5);
  g.color(TRIM); g.cyl(0, y5 + 0.34, 0, 0.13, 0.04, 0.3, 6);
  weather(g, from, y5, y5 + 0.6, 9, 0.2, 0.7);

  g.glow(0).mat().pop();

  // vài bụi cây và khóm cỏ cao quanh gò
  const bushes = [[-9.2, 1.6, 1.0], [-7.4, -3.6, 0.8], [8.6, -2.4, 1.1], [9.6, 1.2, 0.7], [5.6, 5.2, 0.75], [-4.6, 5.9, 0.6], [2.2, -6.6, 0.7], [-10.6, -0.8, 0.6]];
  bushes.forEach(([x, z, r], i) => {
    const e = Math.hypot(x / 13, z / 9), y = e > 0.74 ? 0.62 - (e - 0.74) * 1.6 : 0.84 - e * 0.3;
    shrub(g, x, y - 0.1, z, r, 100 + i * 13);
  });
  g.color(0xffffff).gloss(0).glow(0).sway(0).mat();
}
