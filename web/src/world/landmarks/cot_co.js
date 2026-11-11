// Cột cờ Hà Nội (Kỳ đài, 1812): ba tầng đế vuông hình chóp cụt xây gạch (cạnh đáy 42,5 m, 27 m, 12,8 m; cao 3,1 m, 3,7 m,
// 5,1 m), thân cột bát giác cao 18,2 m thon dần có các ô cửa hoa thị và dẻ quạt, lầu vọng canh bát giác 3,3 m,
// trụ treo cờ đỏ sao vàng. Tổng cao chừng 41 m. Bậc gạch lên tầng một ở mặt trước (+z, hướng nam).
// Tầng hai có bốn cửa vòm (Hướng Minh phía nam, Nghênh Húc phía đông, Hồi Quang phía tây, cửa bắc không đề chữ; biển để trơn),
// lối lên nằm trong lòng cửa; tầng ba chỉ có một cửa trông về phía bắc (-z) dẫn vào cầu thang xoáy trong thân cột.
// Gạch phong hoá do shader vẽ (MAT.brick): mô hình chỉ đặt màu nền nâu đỏ sẫm, ngả rêu xám dần về chân mỗi tầng đế.
import { MAT } from '../../core/geo.js';

const BRICK = [0.152, 0.095, 0.07];   // gạch cũ nâu đỏ sẫm (tuyến tính)
const GREY = [0.105, 0.098, 0.088];   // mảng xám đen do mưa nắng
const MOSS = [0.07, 0.088, 0.048];    // rêu
const TRIM = 0x8a7466, DARK = [0.012, 0.01, 0.009];

// Màu nền gạch: k độ sáng, damp mức ẩm/rêu (0..1), age mức xám đen do mưa nắng (0..1). Không còn chia ô ngẫu nhiên.
function tone(k = 1, damp = 0, age = 0.35) {
  return [0, 1, 2].map((i) => ((BRICK[i] * (1 - age) + GREY[i] * age) * (1 - damp) + MOSS[i] * damp) * k);
}
function weather(g, k = 1, damp = 0, age = 0.35) { g.rgb(...tone(k, damp, age)); }
// Tứ giác có màu chân (c0) và màu đỉnh (c1) khác nhau: chuyển sắc mượt theo chiều cao.
function gquad(g, p0, p1, p2, p3, c0, c1) {
  const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  g.rgb(...c0); const a = g.v(p0[0], p0[1], p0[2], nx, ny, nz), b = g.v(p1[0], p1[1], p1[2], nx, ny, nz);
  g.rgb(...c1); const c = g.v(p2[0], p2[1], p2[2], nx, ny, nz), d = g.v(p3[0], p3[1], p3[2], nx, ny, nz);
  g.tri(a, b, c); g.tri(a, c, d);
}

// Tường chóp cụt vuông, nửa cạnh h0 (đáy) → h1 (đỉnh): chân tường rêu ẩm (moss), lên cao khô dần, sát gờ đỉnh sẫm nước mưa.
function walls(g, h0, h1, y0, y1, moss) {
  const rows = [[0, 0.72, moss, 0.5], [Math.min(0.45, 1.5 / (y1 - y0)), 0.93, moss * 0.4, 0.42], [0.86, 1.02, 0.03, 0.32], [1, 0.84, 0.05, 0.5]];
  g.mat(MAT.brick);
  for (let k = 0; k < 4; k++) {
    g.push().rotY((k * Math.PI) / 2);
    for (let j = 0; j < rows.length - 1; j++) {
      const A = rows[j], B = rows[j + 1], ha = h0 + (h1 - h0) * A[0], hb = h0 + (h1 - h0) * B[0], ya = y0 + (y1 - y0) * A[0], yb = y0 + (y1 - y0) * B[0];
      gquad(g, [-ha, ya, ha], [ha, ya, ha], [hb, yb, hb], [-hb, yb, hb], tone(A[1], A[2], A[3]), tone(B[1], B[2], B[3]));
    }
    g.pop();
  }
}

// Tường hoa (lan can gạch có ô trổ) quanh mép sân một tầng; gap: nửa bề rộng lối lên ở mặt trước (0 = kín).
function parapet(g, h, y, n, gap = 0) {
  const t = 0.4, H = 0.95;
  for (let k = 0; k < 4; k++) {
    g.push().rotY((k * Math.PI) / 2);
    const segs = k === 0 && gap ? [[-h, -gap], [gap, h]] : [[-h, h]];
    for (const [a, b] of segs) {
      g.mat(MAT.brick); weather(g, 0.95, 0.06); g.box(a, y, h - t, b, y + H, h, 'xXzZ');
      g.mat(MAT.plaster).color(TRIM).shade(0.8).box(a - 0.03, y + H, h - t - 0.04, b + 0.03, y + H + 0.12, h + 0.05);
    }
    g.mat().rgb(...DARK);
    for (let i = 0; i < n; i++) {
      const x = -h + ((i + 0.5) * 2 * h) / n; if (k === 0 && Math.abs(x) < gap + 0.35) continue;
      g.quad([x - 0.2, y + 0.3, h + 0.03], [x + 0.2, y + 0.3, h + 0.03], [x + 0.2, y + 0.7, h + 0.03], [x - 0.2, y + 0.7, h + 0.03]);
    }
    g.pop();
  }
}

// Cửa vòm tối trên mặt tường nghiêng: đặt trong hệ toạ độ của mặt tường (gốc ở chân tường, z vuông góc tường).
function archDoor(g, k, h0, h1, y0, y1, w, hd, plaque) {
  g.push().rotY((k * Math.PI) / 2).move(0, y0, h0).rotX(-Math.atan2(h0 - h1, y1 - y0));
  const arch = (hw, hs, z, x0 = 0) => {
    g.quad([x0 - hw, 0, z], [x0 + hw, 0, z], [x0 + hw, hs, z], [x0 - hw, hs, z]);
    const n = 6; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI, b = ((i + 1) / n) * Math.PI; g.tri3([x0, hs, z], [x0 + Math.cos(a) * hw, hs + Math.sin(a) * hw, z], [x0 + Math.cos(b) * hw, hs + Math.sin(b) * hw, z]); }
  };
  g.mat(MAT.brick).color(TRIM).shade(0.75); arch(w / 2 + 0.28, hd - w / 2, 0.04);
  g.mat().rgb(...DARK); arch(w / 2, hd - w / 2, 0.08);
  if (plaque) g.mat(MAT.plaster).color(TRIM).shade(0.95).quad([-0.75, hd + 0.5, 0.05], [0.75, hd + 0.5, 0.05], [0.75, hd + 1.0, 0.05], [-0.75, hd + 1.0, 0.05]); // biển đá đề tên cửa
  g.pop();
}

// Bậc gạch áp vào mặt tường: đỉnh bậc ở (z0, y1), đi xuống về +z tới y0.
function stairs(g, z0, y0, y1, run, hw, n) {
  const dz = run / n, dy = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    const za = z0 + i * dz, y = y1 - i * dy;
    g.mat(MAT.brick); weather(g, 1.15 - (i % 2) * 0.08, 0.05); g.box(-hw, y0, za, hw, y, za + dz, 'YZ');
  }
  for (const s of [-1, 1]) {
    const xa = s > 0 ? hw : -hw - 0.45, xb = xa + 0.45, zb = z0 + run + 0.3, hh = 0.8;
    g.mat(MAT.brick); weather(g, 0.9, 0.15);
    g.quad([xb, y0, zb], [xb, y0, z0], [xb, y1 + hh, z0], [xb, y0 + hh, zb]);
    g.quad([xa, y0, z0], [xa, y0, zb], [xa, y0 + hh, zb], [xa, y1 + hh, z0]);
    g.quad([xa, y0, zb], [xb, y0, zb], [xb, y0 + hh, zb], [xa, y0 + hh, zb]);
    g.mat(MAT.plaster).color(TRIM).shade(0.85).quad([xa - 0.03, y0 + hh, zb + 0.03], [xb + 0.03, y0 + hh, zb + 0.03], [xb + 0.03, y1 + hh, z0], [xa - 0.03, y1 + hh, z0]);
  }
}

// Vành đa giác n cạnh (chóp cụt), mặt i hướng góc rot + (i + 0.5)·2π/n; col(i) đặt màu từng mặt.
function ngon(g, n, r0, r1, y0, y1, rot, col, cap = false) {
  for (let i = 0; i < n; i++) {
    const a = rot + (i * 2 * Math.PI) / n, b = rot + ((i + 1) * 2 * Math.PI) / n;
    if (col) col(i);
    g.quad([Math.cos(b) * r0, y0, Math.sin(b) * r0], [Math.cos(a) * r0, y0, Math.sin(a) * r0], [Math.cos(a) * r1, y1, Math.sin(a) * r1], [Math.cos(b) * r1, y1, Math.sin(b) * r1]);
  }
  if (cap) { const p = []; for (let i = 0; i < n; i++) { const a = rot + (i * 2 * Math.PI) / n; p.push([Math.cos(a) * r1, Math.sin(a) * r1]); } g.prism(p, y1, y1, true, false, false); }
}

function flag(g, x0, y0, w, h) {
  const nx = 8, wave = (x) => 0.14 * Math.sin((x - x0) * 1.1) * ((x - x0) / w);
  g.mat().color(0xd3201c);
  const top = [], bot = [];
  for (let i = 0; i <= nx; i++) { const x = x0 + (w * i) / nx; top.push([x, y0 + h, wave(x)]); bot.push([x, y0, wave(x)]); }
  g.ribbon(top, bot); g.ribbon(top, bot, true);                       // hai mặt
  const cx = x0 + w / 2, cy = y0 + h / 2, R = h * 0.3, r = R * 0.382;
  g.color(0xf7d417);
  for (const s of [1, -1]) {
    const pt = (i) => { const a = Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? r : R, x = cx + Math.cos(a) * q; return [x, cy + Math.sin(a) * q, wave(x) + s * 0.06]; };
    const c = [cx, cy, wave(cx) + s * 0.06];
    for (let i = 0; i < 10; i++) s > 0 ? g.tri3(c, pt(i), pt(i + 1)) : g.tri3(c, pt(i + 1), pt(i));
  }
}

export function build(g) {
  g.push(); g.glow(0).sway(0).gloss(0);
  const OCT = Math.PI / 8;

  // ----- ba tầng đế -----
  const T = [[21.25, 20.6, 0, 3.1, 0.7], [13.5, 13.0, 3.1, 6.8, 0.5], [6.4, 5.9, 6.8, 11.9, 0.32]];
  T.forEach(([h0, h1, y0, y1, moss]) => {
    walls(g, h0, h1, y0, y1, moss);
    g.mat(MAT.plaster).color(TRIM).shade(0.7).box(-h1 - 0.1, y1 - 0.22, -h1 - 0.1, h1 + 0.1, y1, h1 + 0.1, 'xXzZ');   // gờ chỉ đỉnh tường
    g.mat(MAT.pave); weather(g, 1.25, 0.12, 0.3); g.quad([-h1, y1, h1], [h1, y1, h1], [h1, y1, -h1], [-h1, y1, -h1]); // sân gạch
    g.mat(MAT.mossy).rgb(GREY[0] * 0.8, GREY[1] * 0.8, GREY[2] * 0.75).box(-h0 - 0.05, y0, -h0 - 0.05, h0 + 0.05, y0 + 0.22, h0 + 0.05, 'xXYzZ'); // chân tường đá rêu
  });
  parapet(g, 20.6, 3.1, 30, 1.75);
  parapet(g, 13.0, 6.8, 18, 0);
  parapet(g, 5.9, 11.9, 8, 0);
  for (const k of [0, 1, 2, 3]) archDoor(g, k, 13.5, 13.0, 3.1, 6.8, 1.5, 2.3, true);  // tầng hai: cửa vòm bốn mặt, trên có biển đá
  archDoor(g, 2, 6.4, 5.9, 6.8, 11.9, 1.3, 2.4, false);                                // tầng ba: một cửa trông về phía bắc
  stairs(g, 20.6, 0, 3.1, 5.2, 1.75, 14);

  // ----- thân cột bát giác -----
  const Y0 = 11.9, H = 18.2, R0 = 2.61, R1 = 2.12, nb = 7;
  g.mat(MAT.brick); weather(g, 0.8, 0.25); ngon(g, 8, 3.05, 2.95, Y0, Y0 + 0.9, OCT, null, true);            // đế cột
  g.mat(MAT.plaster).color(TRIM).shade(0.7); ngon(g, 8, 3.12, 3.12, Y0 + 0.9, Y0 + 1.05, OCT, null, true);
  g.mat(MAT.brick);
  for (let j = 0; j < nb; j++) {
    const ta = j / nb, tb = (j + 1) / nb;
    ngon(g, 8, R0 + (R1 - R0) * ta, R0 + (R1 - R0) * tb, Y0 + 1.05 + (H - 1.05) * ta, Y0 + 1.05 + (H - 1.05) * tb, OCT, (i) => weather(g, 0.94 + ((i * 3 + j) % 3) * 0.035, j === 0 ? 0.2 : 0.05, 0.3 + ((i + j * 3) % 4) * 0.04));
  }
  // ô cửa lấy sáng xếp dọc giữa mỗi mặt (5 ô một mặt): hoa thị bốn cánh, trên cùng là ô dẻ quạt (6 mặt), hai mặt còn lại toàn hoa thị
  g.mat().rgb(...DARK);
  for (let i = 0; i < 8; i++) {
    g.push().rotY((i * Math.PI) / 4);
    for (let j = 0; j < 5; j++) {
      const t = 0.15 + j * 0.175, y = Y0 + H * t, z = (R0 + (R1 - R0) * t) * Math.cos(OCT) + 0.035;
      if (j < 4 || i % 4 === 1) { const s = 0.27, w = 0.085; g.quad([0, y - s, z], [w, y, z], [0, y + s, z], [-w, y, z]); g.quad([-s, y, z], [0, y - w, z], [s, y, z], [0, y + w, z]); }
      else { const s = 0.38, n = 5; for (let q = 0; q < n; q++) { const a = (q / n) * Math.PI, b = ((q + 1) / n) * Math.PI; g.tri3([0, y - 0.12, z], [Math.cos(a) * s, y - 0.12 + Math.sin(a) * s, z], [Math.cos(b) * s, y - 0.12 + Math.sin(b) * s, z]); } }
    }
    g.pop();
  }

  // ----- lầu vọng canh -----
  const L0 = Y0 + H, L1 = L0 + 3.3;
  g.mat(MAT.plaster).color(TRIM).shade(0.72); ngon(g, 8, 2.2, 2.62, L0 - 0.35, L0, OCT, null, true);                   // gờ đỡ loe ra
  ngon(g, 8, 2.62, 2.62, L0, L0 + 0.18, OCT, null, true);
  g.mat(MAT.brick); weather(g, 1.0, 0.04); ngon(g, 8, 2.4, 2.4, L0 + 0.18, L1 - 0.3, OCT, null);
  g.mat().rgb(...DARK);
  for (let i = 0; i < 8; i++) {
    g.push().rotY((i * Math.PI) / 4); const z = 2.4 * Math.cos(OCT) + 0.035;
    g.quad([-0.38, L0 + 0.95, z], [0.38, L0 + 0.95, z], [0.38, L0 + 2.2, z], [-0.38, L0 + 2.2, z]);
    g.pop();
  }
  g.mat(MAT.plaster).color(TRIM).shade(0.72);
  { const p = []; for (let i = 0; i < 8; i++) { const a = OCT + (i * Math.PI) / 4; p.push([Math.cos(a) * 2.66, Math.sin(a) * 2.66]); } g.prism(p, L1 - 0.3, L1, true, true); }
  g.mat(MAT.brick); weather(g, 0.9, 0.08); g.cyl(0, L1, 0, 1.1, 0.5, 0.45, 8, true);                              // bệ trụ cờ

  // ----- trụ cờ và cờ đỏ sao vàng -----
  const P1 = L1 + 7.75;
  g.mat().gloss(0.3).color(0x6a6d70).cyl(0, L1 + 0.45, 0, 0.11, 0.07, P1 - L1 - 0.45, 6, true);
  g.gloss(0).color(0xc9a534).ball(0, P1 + 0.1, 0, 0.14, 6, 4);
  g.sway(0.6).glow(0.1);
  flag(g, 0.09, P1 - 4.15, 6, 4);
  g.sway(0).glow(0);

  g.mat().gloss(0).glow(0).sway(0).color(0xffffff);
  g.pop();
}
