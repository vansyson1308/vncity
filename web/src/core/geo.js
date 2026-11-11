// Bộ dựng hình thủ tục, không phụ thuộc three.js nên chạy được cả trong worker.
// Mọi thứ không phải mô hình tải về (cây, cột đèn, xe máy, tháp, cầu...) đều dựng bằng lớp G này rồi gộp
// thành một lưới duy nhất: một lệnh vẽ cho cả một ô phố.
// Mỗi đỉnh: vị trí, pháp tuyến, màu RGBA (A: mặt nạ đổi màu của xe), uv (ô chữ trong bảng biển hiệu),
// fx = [phát sáng ban đêm, đung đưa theo gió, độ bóng, chất liệu chi tiết] (0..255).
import earcut from 'earcut';

const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const srgb2lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

// Chất liệu chi tiết: hoa văn bề mặt do shader vẽ theo vị trí (world/detail.js), không cần UV, không tốn dung lượng tải.
// Dùng: g.color(0xa8553a).mat(MAT.brick).box(...); g.mat() để trở về mặt trơn.
export const MAT = { none: 0, brick: 1, stone: 2, plaster: 3, tile: 4, wood: 5, rust: 6, concrete: 7, mossy: 8, pave: 9, lacquer: 10 };

export class G {
  constructor() {
    this.pos = []; this.nrm = []; this.col = []; this.uv = []; this.fx = []; this.idx = [];
    this.m = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]; // 3 cột xoay/co giãn + tịnh tiến
    this.stack = [];
    this.c = [1, 1, 1, 0]; this.f = [0, 0, 0, 0];
    this.u0 = G.U0; this.v0 = G.V0; // uv mặc định: tâm ô trắng của bảng chữ biển hiệu (world/signs.js WHITE_UV)
  }
  get count() { return this.pos.length / 3; }

  // ----- trạng thái -----
  push() { this.stack.push(this.m.slice()); return this; }
  pop() { this.m = this.stack.pop(); return this; }
  reset() { this.m = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]; return this; }
  move(x, y, z) { const m = this.m; m[9] += m[0] * x + m[3] * y + m[6] * z; m[10] += m[1] * x + m[4] * y + m[7] * z; m[11] += m[2] * x + m[5] * y + m[8] * z; return this; }
  scale(x, y = x, z = x) { const m = this.m; m[0] *= x; m[1] *= x; m[2] *= x; m[3] *= y; m[4] *= y; m[5] *= y; m[6] *= z; m[7] *= z; m[8] *= z; return this; }
  rotY(a) { const c = Math.cos(a), s = Math.sin(a), m = this.m; for (let i = 0; i < 3; i++) { const x = m[i], z = m[6 + i]; m[i] = x * c - z * s; m[6 + i] = x * s + z * c; } return this; }
  rotX(a) { const c = Math.cos(a), s = Math.sin(a), m = this.m; for (let i = 0; i < 3; i++) { const y = m[3 + i], z = m[6 + i]; m[3 + i] = y * c + z * s; m[6 + i] = -y * s + z * c; } return this; }
  rotZ(a) { const c = Math.cos(a), s = Math.sin(a), m = this.m; for (let i = 0; i < 3; i++) { const x = m[i], y = m[3 + i]; m[i] = x * c + y * s; m[3 + i] = -x * s + y * c; } return this; }
  // màu sRGB (0xRRGGBB) → tuyến tính; mask: phần đỉnh này đổi theo màu riêng của từng xe
  color(h, mask = 0) { const [r, g, b] = hex(h); this.c = [srgb2lin(r), srgb2lin(g), srgb2lin(b), mask]; return this; }
  rgb(r, g, b, mask = 0) { this.c = [r, g, b, mask]; return this; }
  shade(k) { this.c = [this.c[0] * k, this.c[1] * k, this.c[2] * k, this.c[3]]; return this; }
  glow(v = 1) { this.f[0] = v; return this; }
  sway(v = 1) { this.f[1] = v; return this; }
  gloss(v = 1) { this.f[2] = v; return this; }
  mat(id = 0) { this.f[3] = (id * 16) / 255; return this; } // chất liệu chi tiết (MAT.*)

  // ----- đỉnh và mặt -----
  v(x, y, z, nx, ny, nz, u, w) {
    const m = this.m;
    this.pos.push(m[0] * x + m[3] * y + m[6] * z + m[9], m[1] * x + m[4] * y + m[7] * z + m[10], m[2] * x + m[5] * y + m[8] * z + m[11]);
    let ax = m[0] * nx + m[3] * ny + m[6] * nz, ay = m[1] * nx + m[4] * ny + m[7] * nz, az = m[2] * nx + m[5] * ny + m[8] * nz;
    const l = Math.hypot(ax, ay, az) || 1; this.nrm.push(ax / l, ay / l, az / l);
    this.col.push(this.c[0], this.c[1], this.c[2], this.c[3]);
    this.uv.push(u === undefined ? this.u0 : u, w === undefined ? this.v0 : w);
    this.fx.push(this.f[0], this.f[1], this.f[2], this.f[3]);
    return this.pos.length / 3 - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  // Tứ giác phẳng qua 4 điểm [x,y,z] theo chiều ngược kim đồng hồ khi nhìn từ phía mặt trước.
  quad(p0, p1, p2, p3, uv) {
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const a = this.v(p0[0], p0[1], p0[2], nx, ny, nz, uv && uv[0], uv && uv[1]), b = this.v(p1[0], p1[1], p1[2], nx, ny, nz, uv && uv[2], uv && uv[1]);
    const c = this.v(p2[0], p2[1], p2[2], nx, ny, nz, uv && uv[2], uv && uv[3]), d = this.v(p3[0], p3[1], p3[2], nx, ny, nz, uv && uv[0], uv && uv[3]);
    this.idx.push(a, b, c, a, c, d);
    return this;
  }
  tri3(p0, p1, p2) {
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    this.idx.push(this.v(p0[0], p0[1], p0[2], nx, ny, nz), this.v(p1[0], p1[1], p1[2], nx, ny, nz), this.v(p2[0], p2[1], p2[2], nx, ny, nz));
    return this;
  }

  // ----- khối cơ bản -----
  // Hộp từ (x0,y0,z0) tới (x1,y1,z1). faces: chuỗi các mặt cần vẽ trong 'xXyYzZ' (mặc định đủ 6).
  box(x0, y0, z0, x1, y1, z1, faces = 'xXyYzZ') {
    if (faces.includes('X')) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
    if (faces.includes('x')) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
    if (faces.includes('Y')) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
    if (faces.includes('y')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
    if (faces.includes('Z')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
    if (faces.includes('z')) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
    return this;
  }
  // Hộp theo tâm đáy và kích thước.
  cube(cx, y0, cz, w, h, d, faces) { return this.box(cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h, cz + d / 2, faces); }
  // Trụ/nón cụt đứng, tâm đáy (x,y,z), bán kính đáy r0, đỉnh r1.
  cyl(x, y, z, r0, r1, h, seg = 8, capTop = true, capBot = false) {
    const base = this.count, sl = (r0 - r1) / h;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      this.v(x + c * r0, y, z + s * r0, c, sl, s); this.v(x + c * r1, y + h, z + s * r1, c, sl, s);
    }
    for (let i = 0; i < seg; i++) { const a = base + i * 2; this.idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    if (capTop && r1 > 0) this.disc(x, y + h, z, r1, seg, 1);
    if (capBot && r0 > 0) this.disc(x, y, z, r0, seg, -1);
    return this;
  }
  disc(x, y, z, r, seg = 8, dir = 1) {
    const c = this.v(x, y, z, 0, dir, 0), b = this.count;
    for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; this.v(x + Math.cos(a) * r, y, z + Math.sin(a) * r, 0, dir, 0); }
    for (let i = 0; i < seg; i++) dir > 0 ? this.idx.push(c, b + i + 1, b + i) : this.idx.push(c, b + i, b + i + 1);
    return this;
  }
  // Trụ nằm dọc theo đoạn a→b (ống, tay vịn, dây).
  tube(a, b, r, seg = 6, r1 = r) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz); if (L < 1e-6) return this;
    const ux = dx / L, uy = dy / L, uz = dz / L;
    let px = -uz, py = 0, pz = ux; let pl = Math.hypot(px, pz);
    if (pl < 1e-4) { px = 1; py = 0; pz = 0; pl = 1; } px /= pl; pz /= pl;
    const qx = uy * pz - uz * py, qy = uz * px - ux * pz, qz = ux * py - uy * px;
    const base = this.count;
    for (let i = 0; i <= seg; i++) {
      const t = (i / seg) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), nx = px * c + qx * s, ny = py * c + qy * s, nz = pz * c + qz * s;
      this.v(a[0] + nx * r, a[1] + ny * r, a[2] + nz * r, nx, ny, nz); this.v(b[0] + nx * r1, b[1] + ny * r1, b[2] + nz * r1, nx, ny, nz);
    }
    for (let i = 0; i < seg; i++) { const k = base + i * 2; this.idx.push(k, k + 3, k + 1, k, k + 2, k + 3); }
    return this;
  }
  // Mặt tròn xoay quanh trục đứng: profile = [[bán kính, cao], ...] từ dưới lên.
  lathe(x, y, z, profile, seg = 12, a0 = 0, a1 = Math.PI * 2) {
    const base = this.count, n = profile.length;
    for (let i = 0; i <= seg; i++) {
      const a = a0 + ((a1 - a0) * i) / seg, c = Math.cos(a), s = Math.sin(a);
      for (let j = 0; j < n; j++) {
        const p = profile[j], q = profile[Math.min(n - 1, j + 1)], o = profile[Math.max(0, j - 1)];
        let dr = q[0] - o[0], dy = q[1] - o[1]; const l = Math.hypot(dr, dy) || 1; dr /= l; dy /= l;
        this.v(x + c * p[0], y + p[1], z + s * p[0], c * dy, -dr, s * dy);
      }
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < n - 1; j++) { const a = base + i * n + j, b = a + n; this.idx.push(a, a + 1, b + 1, a, b + 1, b); }
    return this;
  }
  // Cầu thấp đa giác (dùng cho tán cây, mũ bảo hiểm). squash: tỉ lệ chiều cao.
  ball(x, y, z, r, seg = 8, rings = 5, squash = 1, jitter = 0, seed = 0) {
    const base = this.count;
    for (let j = 0; j <= rings; j++) {
      const ph = (j / rings) * Math.PI, sp = Math.sin(ph), cp = Math.cos(ph);
      for (let i = 0; i <= seg; i++) {
        const th = (i / seg) * Math.PI * 2, nx = Math.cos(th) * sp, nz = Math.sin(th) * sp;
        let k = 1;
        if (jitter) { const ii = i % seg; let h = Math.imul(ii + 1 + seed * 31, 374761393) ^ Math.imul(j + 7, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); k = 1 + (((h ^ (h >>> 16)) >>> 0) / 4294967296 - 0.5) * jitter * (j === 0 || j === rings ? 0 : 1); }
        this.v(x + nx * r * k, y + cp * r * squash * k, z + nz * r * k, nx, cp, nz);
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = base + j * (seg + 1) + i, b = a + seg + 1; if (j > 0) this.idx.push(a, a + 1, b); if (j < rings - 1) this.idx.push(a + 1, b + 1, b); }
    return this;
  }
  // Đùn một đa giác nằm ngang (pts: [[x,z],...]) từ y0 lên y1; có nắp trên, tuỳ chọn nắp dưới.
  prism(pts, y0, y1, capTop = true, capBot = false, sides = true) {
    const n = pts.length; let area = 0;
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
    const ccw = area > 0; // trong mặt phẳng (x,z) với z hướng nam: area > 0 là cùng chiều kim đồng hồ nhìn từ trên
    if (sides) for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      if (ccw) this.quad([q[0], y0, q[1]], [p[0], y0, p[1]], [p[0], y1, p[1]], [q[0], y1, q[1]]);
      else this.quad([p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]]);
    }
    if (capTop || capBot) {
      const flat = []; for (const p of pts) flat.push(p[0], p[1]);
      const t = earcut(flat);
      // earcut luôn trả tam giác theo một chiều cố định (vòng ngoài được chuẩn hoá), không phụ thuộc chiều của pts
      if (capTop) { const b = this.count; for (const p of pts) this.v(p[0], y1, p[1], 0, 1, 0); for (let i = 0; i < t.length; i += 3) this.idx.push(b + t[i], b + t[i + 2], b + t[i + 1]); }
      if (capBot) { const b = this.count; for (const p of pts) this.v(p[0], y0, p[1], 0, -1, 0); for (let i = 0; i < t.length; i += 3) this.idx.push(b + t[i], b + t[i + 1], b + t[i + 2]); }
    }
    return this;
  }
  // Dải mặt nối hai đường gấp khúc cùng số điểm (mái cong, vòm cầu).
  // a chạy theo +x, b lệch về +z thì mặt trước hướng lên (+y); flip để lật.
  ribbon(a, b, flip = false, smooth = true) {
    const n = a.length, base = this.count;
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
      const tx = a[i1][0] - a[i0][0], ty = a[i1][1] - a[i0][1], tz = a[i1][2] - a[i0][2];
      const sx = b[i][0] - a[i][0], sy = b[i][1] - a[i][1], sz = b[i][2] - a[i][2];
      let nx = sy * tz - sz * ty, ny = sz * tx - sx * tz, nz = sx * ty - sy * tx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      if (flip) { nx = -nx; ny = -ny; nz = -nz; }
      this.v(a[i][0], a[i][1], a[i][2], nx, ny, nz); this.v(b[i][0], b[i][1], b[i][2], nx, ny, nz);
    }
    for (let i = 0; i < n - 1; i++) { const k = base + i * 2; flip ? this.idx.push(k, k + 2, k + 3, k, k + 3, k + 1) : this.idx.push(k, k + 3, k + 2, k, k + 1, k + 3); }
    if (!smooth) { /* pháp tuyến đã đủ mượt cho mái ngói */ }
    return this;
  }
  // Gộp một G khác (đã dựng sẵn) vào theo phép biến đổi hiện tại.
  add(o, tint) {
    const base = this.count, m = this.m, n = o.pos.length / 3;
    for (let i = 0; i < n; i++) {
      const x = o.pos[i * 3], y = o.pos[i * 3 + 1], z = o.pos[i * 3 + 2];
      this.pos.push(m[0] * x + m[3] * y + m[6] * z + m[9], m[1] * x + m[4] * y + m[7] * z + m[10], m[2] * x + m[5] * y + m[8] * z + m[11]);
      const nx = o.nrm[i * 3], ny = o.nrm[i * 3 + 1], nz = o.nrm[i * 3 + 2];
      const ax = m[0] * nx + m[3] * ny + m[6] * nz, ay = m[1] * nx + m[4] * ny + m[7] * nz, az = m[2] * nx + m[5] * ny + m[8] * nz, l = Math.hypot(ax, ay, az) || 1;
      this.nrm.push(ax / l, ay / l, az / l);
      const k = tint ? o.col[i * 4 + 3] : 0;
      if (k > 0) this.col.push(o.col[i * 4] * (1 - k) + o.col[i * 4] * tint[0] * k, o.col[i * 4 + 1] * (1 - k) + o.col[i * 4 + 1] * tint[1] * k, o.col[i * 4 + 2] * (1 - k) + o.col[i * 4 + 2] * tint[2] * k, 0);
      else this.col.push(o.col[i * 4], o.col[i * 4 + 1], o.col[i * 4 + 2], o.col[i * 4 + 3]);
      this.uv.push(o.uv[i * 2], o.uv[i * 2 + 1]);
      this.fx.push(o.fx[i * 4], o.fx[i * 4 + 1], o.fx[i * 4 + 2], o.fx[i * 4 + 3]);
    }
    for (let i = 0; i < o.idx.length; i++) this.idx.push(o.idx[i] + base);
    return this;
  }

  // Đóng gói thành mảng kiểu số để chuyển giữa các luồng và nạp thẳng vào GPU.
  pack() {
    const n = this.count;
    const pos = new Float32Array(this.pos), nrm = new Int8Array(n * 3), col = new Uint8Array(n * 4), fx = new Uint8Array(n * 4), uv = new Float32Array(this.uv);
    for (let i = 0; i < n * 3; i++) nrm[i] = Math.round(this.nrm[i] * 127);
    for (let i = 0; i < n * 4; i++) { const k = i & 3; col[i] = Math.round(Math.min(1, Math.max(0, k === 3 ? this.col[i] : Math.sqrt(this.col[i]))) * 255); fx[i] = Math.round(Math.min(1, Math.max(0, this.fx[i])) * 255); }
    const idx = n > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx);
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
    for (let i = 0; i < n * 3; i += 3) { const x = pos[i], y = pos[i + 1], z = pos[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    return { pos, nrm, col, fx, uv, idx, box: n ? [x0, y0, z0, x1, y1, z1] : [0, 0, 0, 0, 0, 0] };
  }
}
G.U0 = 0.125; G.V0 = 0.96875;
export const packBuffers = (p) => [p.pos.buffer, p.nrm.buffer, p.col.buffer, p.fx.buffer, p.uv.buffer, p.idx.buffer];
