// Cầu Long Biên (1902): dàn thép dọc tuyến đường sắt qua sông Hồng, dựng theo đúng tuyến cầu trong OSM.
// Mặt cầu (đường sắt ở giữa, hai làn xe máy hai bên ngoài dàn) do worker dựng ở cao độ thật (gen/ground.js);
// tệp này dựng phần thép và đá, suốt từ mép đê ra tới mép bản đồ:
//   - "nhịp kép" gốc còn lại ở phía Hà Nội (212 m đầu): dàn cao nhấp nhô, hai đỉnh nhọn đứng trên hai trụ đá, võng xuống giữa nhịp;
//   - phần còn lại: các nhịp dàn thấp biên song song (nhịp bán vĩnh cửu thay cho nhịp bị bom đánh sập), mỗi nhịp 53 m,
//     đặt trên trụ đá gốc xen với trụ bê tông dựng thêm;
//   - trụ dưới mọi đầu nhịp, cả trên bãi lẫn giữa sông (giữa sông có mũi rẽ nước); công-xon đỡ làn xe; lan can sắt mép ngoài.
// Art bible (bảng 3.5, mục 8) chỉ ghi "19 nhịp dàn thép, vài nhịp gốc dàn cao nhấp nhô, nhịp thay thế dàn thấp"; chiều cao dàn
// (đỉnh 15 m, dàn thấp 5,6 m), chiều dài nhịp thay thế và vị trí từng trụ ở đây là ước lượng, chưa đối chiếu bản vẽ.
import { MAT } from '../../core/geo.js';

export const LB_SPAN = 106;           // nhịp gốc (m)
export const LB_HIGH = 2 * LB_SPAN;   // chiều dài nhịp kép gốc tính từ mố phía Hà Nội
export const LB_LOW = LB_SPAN / 2;    // nhịp dàn thấp thay thế
const PANEL = LB_SPAN / 16, W = 2.4, H_LOW = 5.6, H_PEAK = 15;

// Chiều cao dàn (biên trên so với biên dưới) tại quãng s tính từ mố: hai đỉnh nhọn ở s = 53 và 159 m, ngoài ra là dàn thấp.
export function trussH(s) {
  if (s <= 0 || s >= LB_HIGH) return H_LOW;
  const t = Math.min(1, Math.min(Math.abs(s - LB_SPAN / 2), Math.abs(s - LB_SPAN * 1.5)) / (LB_SPAN / 2));
  return H_LOW + (H_PEAK - H_LOW) * Math.pow(1 - t, 1.6);
}
// Các đầu nhịp có trụ trên đoạn dài L: [[quãng s, trụ dựng thêm (mảnh, bê tông) hay trụ đá gốc], ...].
export function pierStations(L) {
  const out = [[0, false], [LB_SPAN / 2, false], [LB_SPAN * 1.5, false]];
  for (let i = 0, s = LB_HIGH; s <= L + 0.01; s += LB_LOW, i++) out.push([s, i % 2 === 1]);
  return out;
}

// P: [[x, z], ...] tim cầu (đường sắt) đoạn có dàn thép, P[0] là mố phía Hà Nội; dựng khúc từ quãng s0 tới s1.
// yAt(s): cao độ mặt cầu đường sắt tại quãng s; laneY(x, z, y): cao độ làn xe máy tại điểm (x, z), không có làn thì trả về y.
export function buildAlong(g, P, s0, s1, yAt, laneY) {
  if (P.length < 2) return;
  const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = cum[cum.length - 1], at = (s) => { let i = 0; while (i < cum.length - 2 && cum[i + 1] < s) i++; const t = (s - cum[i]) / (cum[i + 1] - cum[i] || 1), dx = P[i + 1][0] - P[i][0], dz = P[i + 1][1] - P[i][1], l = Math.hypot(dx, dz) || 1; return [P[i][0] + dx * t, P[i][1] + dz * t, dx / l, dz / l]; };
  const beam = (a, b, r) => g.tube(a, b, r, 4);
  const k0 = Math.round(s0 / PANEL), k1 = Math.min(Math.round(s1 / PANEL), Math.floor(L / PANEL)), KH = Math.round(LB_HIGH / PANEL);
  for (let k = k0; k < k1; k++) {
    const sa = k * PANEL, sb = sa + PANEL, A = at(sa), B = at(sb), ya = yAt(sa) + 0.3, yb = yAt(sb) + 0.3, ha = trussH(sa), hb = trussH(sb);
    const old = k < KH, joint = old ? k === 0 || k === 8 || k === 24 : (k - KH) % 8 === 0, tall = Math.max(ha, hb) > 8.6;
    // thép nâu gỉ, lẫn những khoang còn mảng sơn xám (nhịp thay thế còn nhiều sơn hơn)
    const tone = 0.85 + ((k * 7) % 5) * 0.04, grey = (k * 13) % 11 < (old ? 2 : 4);
    g.mat(MAT.rust); if (grey) g.rgb(0.12 * tone, 0.118 * tone, 0.11 * tone); else g.rgb(0.1 * tone, 0.075 * tone, 0.06 * tone);
    for (const side of [-1, 1]) {
      const ax = A[0] - A[3] * W * side, az = A[1] + A[2] * W * side, bx = B[0] - B[3] * W * side, bz = B[1] + B[2] * W * side;
      beam([ax, ya, az], [bx, yb, bz], 0.16); beam([ax, ya + ha, az], [bx, yb + hb, bz], 0.15); beam([ax, ya, az], [ax, ya + ha, az], joint ? 0.2 : 0.11);
      if (k % 2) beam([ax, ya, az], [bx, yb + hb, bz], 0.09); else beam([ax, ya + ha, az], [bx, yb, bz], 0.09);
      if (tall) { // khoang cao của nhịp gốc: thêm thanh ngang lưng chừng và thanh xiên ngược thành hoa chữ X
        beam([ax, ya + ha * 0.5, az], [bx, yb + hb * 0.5, bz], 0.07);
        if (k % 2) beam([ax, ya + ha, az], [bx, yb, bz], 0.06); else beam([ax, ya, az], [bx, yb + hb, bz], 0.06);
      }
      // công-xon đỡ làn xe bên ngoài dàn (ở đoạn dốc lên cầu làn xe thấp hơn đường sắt: thêm thanh treo từ biên dưới xuống)
      if (k % 2 === 0) {
        const ly = laneY(A[0] - A[3] * 4.1 * side, A[1] + A[2] * 4.1 * side, ya - 0.3);
        g.tube([ax, ly - 1.0, az], [A[0] - A[3] * 5.6 * side, ly - 0.12, A[1] + A[2] * 5.6 * side], 0.1, 3);
        if (ly < ya - 1.1) g.tube([ax, ya, az], [ax, ly - 1.0, az], 0.08, 3);
      }
    }
    // giằng ngang trên đỉnh; khoang cao có thêm xà cổng ngay trên khổ tàu
    if (k % 2 === 0 || joint) beam([A[0] - A[3] * W, ya + ha, A[1] + A[2] * W], [A[0] + A[3] * W, ya + ha, A[1] - A[2] * W], 0.1);
    if (ha > 8.6 && (k % 2 === 0 || joint)) beam([A[0] - A[3] * W, ya + 6.1, A[1] + A[2] * W], [A[0] + A[3] * W, ya + 6.1, A[1] - A[2] * W], 0.09);
  }
  g.mat();
}

// Một trụ cầu tại điểm A = [x, z, tx, tz] (tim cầu và hướng dọc cầu), đỉnh mũ trụ ở cao độ top (sát đáy dầm thấp nhất).
// water: trụ giữa sông, chân chìm dưới nước, hai đầu có mũi nhọn rẽ nước. slim: trụ bê tông dựng thêm sau chiến tranh (mảnh hơn).
// railTop: cao độ đáy dầm đường sắt; ở đoạn dốc lên cầu nó cao hơn mũ trụ thì xây thêm một bệ đá hẹp dưới riêng đường sắt.
// Trả về mặt bằng chân trụ [[x, z] × 4] để làm va chạm.
export function buildPier(g, A, top, water, slim, railTop = top) {
  const [x, z, tx, tz] = A, nx = -tz, nz = tx;
  // mặt bằng trụ: a dọc cầu, b ngang cầu (xuôi dòng nước), hai đầu b có mũi nhọn
  const F = (hl, hw, nose) => [[-hl, -hw], [0, -hw - nose], [hl, -hw], [hl, hw], [0, hw + nose], [-hl, hw]].map(([a, b]) => [x + tx * a + nx * b, z + tz * a + nz * b]);
  const hl = slim ? 1.15 : 1.9, hw = water ? 5.4 : 5.1, nose = water ? 2.4 : 0.35, y0 = water ? -3 : -0.3, yc = Math.max(y0 + 0.4, top - 0.88);
  if (slim) g.mat(MAT.concrete).rgb(0.36, 0.36, 0.34); else g.mat(MAT.stone).rgb(0.33, 0.31, 0.28);
  g.prism(F(hl, hw, nose), y0, yc, false, false, true);
  if (slim) g.rgb(0.42, 0.42, 0.4); else g.rgb(0.4, 0.38, 0.34);
  g.prism(F(hl + 0.4, hw + 0.5, nose * 0.83), yc, top, true, true, true);
  if (railTop > top + 0.3) g.prism([[-hl, -2.3], [hl, -2.3], [hl, 2.3], [-hl, 2.3]].map(([a, b]) => [x + tx * a + nx * b, z + tz * a + nz * b]), top, railTop, true, false, true);
  g.mat();
  const e = hl + 0.4, w = hw + 0.5 + nose * 0.83;
  return [[-e, -w], [e, -w], [e, w], [-e, w]].map(([a, b]) => [x + tx * a + nx * b, z + tz * a + nz * b]);
}

// Lan can sắt dọc mép ngoài làn xe: E là dãy điểm mép [[x, y, z], ...] cách nhau vài mét.
export function buildRailing(g, E) {
  g.mat(MAT.rust).rgb(0.085, 0.065, 0.055);
  for (let i = 0; i < E.length; i++) {
    const a = E[i]; g.tube([a[0], a[1], a[2]], [a[0], a[1] + 1.12, a[2]], 0.045, 3);
    if (i === E.length - 1) break;
    const b = E[i + 1];
    for (const h of [1.1, 0.62, 0.2]) g.tube([a[0], a[1] + h, a[2]], [b[0], b[1] + h, b[2]], h > 1 ? 0.04 : 0.025, 3);
  }
  g.mat();
}
