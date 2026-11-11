// Cầu Long Biên (1902): dàn thép "rồng lượn" dọc tuyến đường sắt qua sông Hồng, dựng theo đúng tuyến cầu trong OSM.
// Bản web đặt mặt cầu sát mặt đất (xem docs/17, mục giới hạn); dàn thép giữ đúng dáng nhấp nhô đặc trưng:
// cao ở trụ, thấp ở giữa nhịp. Hai làn xe máy chạy hai bên ngoài dàn như ngoài đời.
export function buildAlong(g, pts) {
  // pts: [[x, z], ...] dọc tim cầu (đường sắt). Chỉ dựng dàn ở đoạn ngoài đê (x > 420).
  const P = pts.filter((p) => p[0] > 420); if (P.length < 2) return;
  const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = cum[cum.length - 1], at = (s) => { let i = 0; while (i < cum.length - 2 && cum[i + 1] < s) i++; const t = (s - cum[i]) / (cum[i + 1] - cum[i] || 1), dx = P[i + 1][0] - P[i][0], dz = P[i + 1][1] - P[i][1], l = Math.hypot(dx, dz) || 1; return [P[i][0] + dx * t, P[i][1] + dz * t, dx / l, dz / l]; };
  const SPAN = 106, PANEL = SPAN / 16, W = 2.45, base = 0.75;
  const top = (s) => 6.2 + 5.4 * (0.5 + 0.5 * Math.cos((2 * Math.PI * s) / SPAN)); // cao ở trụ (đầu nhịp), thấp giữa nhịp
  const beam = (a, b, r) => g.tube(a, b, r, 4);
  const n = Math.floor(L / PANEL);
  for (let k = 0; k < n; k++) {
    const s0 = k * PANEL, s1 = s0 + PANEL, A = at(s0), B = at(s1), h0 = top(s0), h1 = top(s1);
    const tone = 0.85 + ((k * 7) % 5) * 0.04; g.rgb(0.1 * tone, 0.075 * tone, 0.06 * tone);
    for (const side of [-1, 1]) {
      const ax = A[0] - A[3] * W * side, az = A[1] + A[2] * W * side, bx = B[0] - B[3] * W * side, bz = B[1] + B[2] * W * side;
      beam([ax, base, az], [bx, base, bz], 0.16); beam([ax, h0, az], [bx, h1, bz], 0.15); beam([ax, base, az], [ax, h0, az], 0.11);
      if (k % 2) beam([ax, base, az], [bx, h1, bz], 0.09); else beam([ax, h0, az], [bx, base, bz], 0.09);
    }
    if (k % 2 === 0) beam([A[0] - A[3] * W, h0, A[1] + A[2] * W], [A[0] + A[3] * W, h0, A[1] - A[2] * W], 0.1);
  }
}
