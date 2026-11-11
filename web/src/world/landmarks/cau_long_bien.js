// Cầu Long Biên (1902): dàn thép "rồng lượn" dọc tuyến đường sắt qua sông Hồng, dựng theo đúng tuyến cầu trong OSM.
// Mặt cầu (đường sắt ở giữa, hai làn xe máy hai bên ngoài dàn) do worker dựng ở cao độ thật (gen/ground.js);
// tệp này dựng phần thép và đá: dàn nhấp nhô cao ở trụ, thấp ở giữa nhịp; trụ đá mũi nhọn giữa sông;
// công-xon đỡ làn xe; lan can sắt dọc mép ngoài.
const SPAN = 106, PANEL = SPAN / 16, W = 2.4;

// P: [[x, z], ...] tim cầu (đường sắt) đoạn có dàn thép; dựng khúc từ quãng s0 tới s1; y0: cao độ mặt cầu.
export function buildAlong(g, P, s0, s1, y0) {
  if (P.length < 2) return;
  const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = cum[cum.length - 1], at = (s) => { let i = 0; while (i < cum.length - 2 && cum[i + 1] < s) i++; const t = (s - cum[i]) / (cum[i + 1] - cum[i] || 1), dx = P[i + 1][0] - P[i][0], dz = P[i + 1][1] - P[i][1], l = Math.hypot(dx, dz) || 1; return [P[i][0] + dx * t, P[i][1] + dz * t, dx / l, dz / l]; };
  const base = y0 + 0.3;
  const top = (s) => base + 5.6 + 5.6 * (0.5 + 0.5 * Math.cos((2 * Math.PI * s) / SPAN)); // cao ở trụ (đầu nhịp), thấp giữa nhịp
  const beam = (a, b, r) => g.tube(a, b, r, 4);
  const k0 = Math.round(s0 / PANEL), k1 = Math.min(Math.round(s1 / PANEL), Math.floor(L / PANEL));
  for (let k = k0; k < k1; k++) {
    const sa = k * PANEL, sb = sa + PANEL, A = at(sa), B = at(sb), h0 = top(sa), h1 = top(sb);
    const tone = 0.85 + ((k * 7) % 5) * 0.04; g.rgb(0.1 * tone, 0.075 * tone, 0.06 * tone);
    for (const side of [-1, 1]) {
      const ax = A[0] - A[3] * W * side, az = A[1] + A[2] * W * side, bx = B[0] - B[3] * W * side, bz = B[1] + B[2] * W * side;
      beam([ax, base, az], [bx, base, bz], 0.16); beam([ax, h0, az], [bx, h1, bz], 0.15); beam([ax, base, az], [ax, h0, az], 0.11);
      if (k % 2) beam([ax, base, az], [bx, h1, bz], 0.09); else beam([ax, h0, az], [bx, base, bz], 0.09);
      // công-xon đỡ làn xe bên ngoài dàn
      if (k % 2 === 0) g.tube([ax, y0 - 1.0, az], [A[0] - A[3] * 5.6 * side, y0 - 0.12, A[1] + A[2] * 5.6 * side], 0.1, 3);
    }
    if (k % 2 === 0) beam([A[0] - A[3] * W, h0, A[1] + A[2] * W], [A[0] + A[3] * W, h0, A[1] - A[2] * W], 0.1);
    // trụ đá ở đầu mỗi nhịp: thân thuôn, hai đầu mũi nhọn rẽ nước, mũ trụ nhô ra
    if (k % 16 === 0) {
      const [x, z, tx, tz] = A, nx = -tz, nz = tx;
      // mặt bằng trụ: a dọc cầu, b ngang cầu (xuôi dòng nước), hai đầu b có mũi nhọn
      const F = (hl, hw, nose) => [[-hl, -hw], [0, -hw - nose], [hl, -hw], [hl, hw], [0, hw + nose], [-hl, hw]].map(([a, b]) => [x + tx * a + nx * b, z + tz * a + nz * b]);
      g.rgb(0.33, 0.31, 0.28); g.prism(F(1.9, 5.4, 2.4), -3, y0 - 2.0, false, false, true);
      g.rgb(0.4, 0.38, 0.34); g.prism(F(2.3, 5.9, 2.0), y0 - 2.0, y0 - 1.12, true, true, true);
    }
  }
}

// Lan can sắt dọc mép ngoài làn xe: E là dãy điểm mép [[x, y, z], ...] cách nhau vài mét.
export function buildRailing(g, E) {
  g.rgb(0.085, 0.065, 0.055);
  for (let i = 0; i < E.length; i++) {
    const a = E[i]; g.tube([a[0], a[1], a[2]], [a[0], a[1] + 1.12, a[2]], 0.045, 3);
    if (i === E.length - 1) break;
    const b = E[i + 1];
    for (const h of [1.1, 0.62, 0.2]) g.tube([a[0], a[1] + h, a[2]], [b[0], b[1] + h, b[2]], h > 1 ? 0.04 : 0.025, 3);
  }
}
