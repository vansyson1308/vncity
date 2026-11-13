// Cầu Thê Húc: cầu gỗ sơn son cong cong dẫn ra đền Ngọc Sơn.
// Chạy dọc +z từ z = 0 (đầu bờ) tới z = 46.2 (đầu đảo), tim cầu x = 0, mặt cầu rộng 2,6 m.
// Mặt ván đúng theo đường cong deckY(z) mà trò chơi dùng để cho người đi bộ: y = 0.35 + 1.25·sin(π·z/L).
// 15 nhịp → 16 vì, mỗi vì hai cột gỗ tròn cắm xuống nước (y = -1.6; mặt nước ở y = -0.5).
import { hash } from '../../core/util.js';
import { MAT } from '../../core/geo.js';

export const LENGTH = 46.2, SPANS = 15, WIDTH = 2.6;
export const deckY = (z) => 0.35 + 1.25 * Math.sin(Math.PI * (z / LENGTH));

const RED = 0xc8201a;      // son đỏ
const RED_DEEP = 0xa9180f; // son sẫm ở chỗ khuất
const PLANK = 0x93301f;    // ván mặt cầu ngả nâu vì mòn

// Thanh xiên theo dốc cầu: tiết diện chữ nhật x ∈ [xa, xb], đáy ở (z0, b0) → (z1, b1), cao h.
function beam(g, xa, xb, z0, z1, b0, b1, h, faces = 'xXyY') {
  const t0 = b0 + h, t1 = b1 + h;
  if (faces.includes('Y')) g.quad([xa, t1, z1], [xb, t1, z1], [xb, t0, z0], [xa, t0, z0]);
  if (faces.includes('y')) g.quad([xa, b0, z0], [xb, b0, z0], [xb, b1, z1], [xa, b1, z1]);
  if (faces.includes('X')) g.quad([xb, b1, z1], [xb, b0, z0], [xb, t0, z0], [xb, t1, z1]);
  if (faces.includes('x')) g.quad([xa, b0, z0], [xa, b1, z1], [xa, t1, z1], [xa, t0, z0]);
  if (faces.includes('Z')) g.quad([xa, b1, z1], [xb, b1, z1], [xb, t1, z1], [xa, t1, z1]);
  if (faces.includes('z')) g.quad([xb, b0, z0], [xa, b0, z0], [xa, t0, z0], [xb, t0, z0]);
}

export function build(g) {
  const L = LENGTH, N = SPANS, span = L / N, HW = WIDTH / 2;
  const red = (seed, k = 1) => g.color(RED).shade((0.9 + hash(seed, 1) * 0.2) * k);
  g.gloss(0.3).glow(0).sway(0).mat(MAT.lacquer);   // sơn son: mọi cấu kiện đỏ; gỗ mộc chỉ còn ở chân cột ngâm nước và ván mặt cầu

  // ----- vì cầu: hai cột tròn, xà mũ, giằng ngang và giằng chéo -----
  const PX = 1.08, PR = 0.135;
  for (let i = 0; i <= N; i++) {
    const z = i * span, yd = deckY(z), capTop = yd - 0.07 - 0.2, capBot = capTop - 0.2;
    for (const s of [-1, 1]) {
      // đoạn chân cột ngâm nước: gỗ sẫm, bám rêu
      g.gloss(0.05).mat(MAT.wood).color(0x5a3626).shade(0.85 + hash(i, 5 + s) * 0.3);
      g.cyl(s * PX, -1.6, z, PR * 1.06, PR * 1.04, 1.28, 6, false);
      g.gloss(0.3).mat(MAT.lacquer); red(i * 2 + s, 0.86);
      const from = g.count;
      g.cyl(s * PX, -0.32, z, PR * 1.02, PR * 0.94, capBot + 0.02 + 0.32, 8, false);
      // vệt ố sẫm gần mặt nước
      for (let v = from; v < g.count; v += 2) { g.col[v * 4] *= 0.55; g.col[v * 4 + 1] *= 0.6; g.col[v * 4 + 2] *= 0.55; }
    }
    // xà mũ đỡ dầm dọc, hai đầu thò ra ngoài cột
    red(i + 40, 0.92); g.box(-HW - 0.12, capBot, z - 0.1, HW + 0.12, capTop, z + 0.1);
    // giằng ngang sát mặt nước và đôi giằng chéo (chỉ ở những vì đủ cao)
    const tieY = -0.16;
    if (capBot - tieY > 0.42) {
      g.color(RED_DEEP).shade(0.85 + hash(i, 9) * 0.2);
      g.box(-PX - 0.2, tieY - 0.07, z - 0.055, PX + 0.2, tieY + 0.07, z + 0.055);
      g.tube([-PX, tieY + 0.05, z + 0.02], [PX, capBot - 0.02, z + 0.02], 0.042, 4);
      g.tube([PX, tieY + 0.05, z - 0.02], [-PX, capBot - 0.02, z - 0.02], 0.042, 4);
    }
  }

  // ----- dầm dọc và ván mặt cầu -----
  for (let i = 0; i < N; i++) {
    const z0 = i * span, z1 = z0 + span, y0 = deckY(z0), y1 = deckY(z1);
    // ba dầm dọc dưới ván
    g.color(RED_DEEP).shade(0.8 + hash(i, 21) * 0.15);
    for (const x of [-PX, 0, PX]) beam(g, x - 0.08, x + 0.08, z0, z1, y0 - 0.27, y1 - 0.27, 0.2, 'xXy');
    // mặt dưới ván
    g.color(0x5a1f15).shade(0.8); beam(g, -HW + 0.1, HW - 0.1, z0, z1, y0 - 0.07, y1 - 0.07, 0.01, 'y');
    // diềm (thanh bo mép) hai bên, mặt trên nhô hơn ván một chút
    for (const s of [-1, 1]) {
      red(i * 2 + s + 60, 0.97);
      beam(g, s > 0 ? HW - 0.11 : -HW, s > 0 ? HW : -HW + 0.11, z0, z1, y0 - 0.13, y1 - 0.13, 0.16, s > 0 ? 'XyYx' : 'xyYX');
    }
  }
  // ván lát ngang, bám sát đường cong sin. Khe ván do chất liệu gỗ vẽ (cứ 19 cm một khe theo z), nên mỗi dải hình học
  // rộng đúng hai tấm (38 cm) và đổi sắc độ theo dải: ranh giới màu luôn trùng một khe ván.
  const pl = 0.38, NP = Math.ceil(L / pl - 1e-6);
  g.gloss(0.12).mat(MAT.wood);
  for (let k = 0; k < NP; k++) {
    const z0 = k * pl, z1 = Math.min(L, z0 + pl), h = hash(k, 31);
    g.color(h < 0.12 ? 0x8a3a26 : PLANK).shade(0.92 + hash(k, 32) * 0.2);
    beam(g, -HW + 0.11, HW - 0.11, z0, z1, deckY(z0) - 0.07, deckY(z1) - 0.07, 0.07, 'Y');
  }
  g.color(PLANK).shade(0.8);
  beam(g, -HW, HW, 0, 0.01, deckY(0) - 0.13, deckY(0) - 0.13, 0.13, 'z');
  beam(g, -HW, HW, L - 0.01, L, deckY(L) - 0.13, deckY(L) - 0.13, 0.13, 'Z');
  // hai bậc đá ở mỗi đầu cầu: mặt ván ở đầu cầu cao 0,35 m trên mặt hè, bước thẳng một bước lên là quá cao (người chơi không bước lên
  // gờ cao quá 0,32 m: actors/player.js). Bậc cao 0,12 và 0,24 m, sâu 0,5 m, là mặt bậc thật (modelPads) cho người đi bộ.
  g.gloss(0.05).mat(MAT.stone);
  for (const [za, zb, h, k] of [[-1.0, -0.5, 0.12, 0.94], [-0.5, 0, 0.24, 1], [L, L + 0.5, 0.24, 1], [L + 0.5, L + 1.0, 0.12, 0.94]]) g.color(0x77736b).shade(k).box(-HW, -0.05, za, HW, h, zb, 'xXYzZ');
  g.gloss(0.3).mat(MAT.lacquer);

  // ----- lan can: trụ ở mỗi vì, tay vịn, hai thanh ngang, hàng con tiện mảnh -----
  g.gloss(0.35).glow(0.06).mat(MAT.lacquer);
  const RX = HW - 0.085;            // tim lan can
  const TOPR = 1.0, UP = 0.8, LOW = 0.15;
  for (const s of [-1, 1]) {
    const x = s * RX;
    for (let i = 0; i <= N; i++) {
      const z = i * span, y = deckY(z);
      red(i * 3 + s + 80);
      g.cube(x, y - 0.1, z, 0.15, 1.24, 0.15, 'xXzZ');
      g.color(RED_DEEP).shade(0.95); g.cube(x, y + 1.14, z, 0.2, 0.06, 0.2);
      red(i * 3 + s + 81, 1.05); g.cube(x, y + 1.2, z, 0.13, 0.1, 0.13, 'xXYzZ');
    }
    for (let i = 0; i < N; i++) {
      const z0 = i * span + 0.075, z1 = (i + 1) * span - 0.075, y0 = deckY(z0), y1 = deckY(z1);
      const yAt = (z) => y0 + ((y1 - y0) * (z - z0)) / (z1 - z0);
      red(i * 5 + s + 120, 1.04);
      beam(g, x - 0.055, x + 0.055, z0, z1, y0 + TOPR, y1 + TOPR, 0.085);          // tay vịn
      red(i * 5 + s + 121, 0.94);
      beam(g, x - 0.035, x + 0.035, z0, z1, y0 + UP, y1 + UP, 0.06);               // thanh trên
      beam(g, x - 0.035, x + 0.035, z0, z1, y0 + LOW, y1 + LOW, 0.06);             // thanh dưới
      // con tiện
      const nb = 9, bw = 0.019;
      red(i * 5 + s + 122, 0.9);
      for (let b = 1; b <= nb; b++) {
        const z = z0 + ((z1 - z0) * b) / (nb + 1), yb = yAt(z);
        g.box(x - bw, yb + LOW + 0.06, z - bw, x + bw, yb + UP, z + bw, 'xXzZ');
      }
      // hai con kê giữa thanh trên và tay vịn
      for (const f of [1 / 3, 2 / 3]) {
        const z = z0 + (z1 - z0) * f, yb = yAt(z);
        g.box(x - 0.028, yb + UP + 0.06, z - 0.05, x + 0.028, yb + TOPR, z + 0.05, 'xXzZ');
      }
    }
  }
  g.color(0xffffff).gloss(0).glow(0).sway(0).mat();
}
