// Ô cây trên vỉa hè (art bible mục 2.11): ô vuông cạnh 1,4 m, viền đá xẻ rộng 10 cm nhô nhẹ khỏi mặt hè, mặt ô là đất.
// Gọi từ gen/props.js ngay chỗ đặt cây, nên cây dời đi đâu thì ô theo đó. Cây trong công viên, bãi cỏ thì không có ô.
// Ô xoay theo hướng con phố gần nhất; cây đứng quá sát mép hè (ô sẽ đè lên bó vỉa) thì bỏ qua.
import { MAT } from '../../core/geo.js';
import { hash } from '../../core/util.js';
import { CURB, K } from '../data.js';

const SIZE = 1.4, RIM = 0.1, LIFT = 0.04;

// g: lưới "gần" của ô phố; (x, z): toạ độ thế giới của gốc cây; (X0, Z0): gốc ô phố.
export function treePit(g, ctx, x, z, X0, Z0, seed = 0) {
  if (ctx.isGreen(x, z) || ctx.isWater(x, z)) return false;
  const rd = ctx.nearestRoad(x, z, 14, (r) => r.veh || r.kind === K.pedestrian);
  let yaw = 0;
  if (rd) {
    if (rd.d < rd.r.w / 2 + SIZE / 2 + 0.32) return false; // sát bó vỉa hoặc nằm trong lòng đường
    const p = rd.r.p, i = rd.seg; yaw = Math.atan2(p[i + 2] - p[i], p[i + 3] - p[i + 1]);
  }
  const h = SIZE / 2, q = h - RIM, y = LIFT, k = 0.85 + hash(seed, 71) * 0.3;
  g.push().move(x - X0, CURB, z - Z0).rotY(yaw).glow(0).gloss(0).sway(0);
  // đất trong ô: nâu sẫm, hơi ẩm
  g.mat(MAT.none).rgb(0.085 * k, 0.062 * k, 0.04 * k).quad([-q, 0.012, q], [q, 0.012, q], [q, 0.012, -q], [-q, 0.012, -q]);
  // viền đá xẻ: bốn thanh, mặt trên và mặt ngoài
  g.mat(MAT.concrete).rgb(0.36, 0.36, 0.34);
  for (let s = 0; s < 4; s++) {
    g.push().rotY((s * Math.PI) / 2);
    g.quad([-h, y, h], [h, y, h], [q, y, q], [-q, y, q]);          // mặt trên (hình thang, bốn thanh khép kín thành khung)
    g.quad([-h, 0, h], [h, 0, h], [h, y, h], [-h, y, h]);          // mặt ngoài
    g.pop();
  }
  g.mat(MAT.none).pop();
  return true;
}
