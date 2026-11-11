// Chùa Một Cột (Liên Hoa Đài): toà gỗ vuông 3 m trên một cột đá đường kính 1,25 m cao 4 m, dựng giữa hồ sen vuông
// chừng 16 m có lan can thấp; tám thanh chống xoè như cánh sen; mái ngói cong đầu đao, bờ nóc "lưỡng long chầu nguyệt";
// bậc đá có tường gạch hai bên đi lên từ phía +z.
// Chất liệu: gỗ lim (MAT.wood), ngói mũi hài (MAT.tile), cột và bậc đá (MAT.plaster/stone), lan can xây trát vữa, kè hồ rêu.
// sites.js nâng mô hình 0,4 m để mặt nước (y = -0,3) nổi trên nền đất, nên bờ hồ có tường ngoài xuống tới y = -0,45.
import { MAT } from '../../core/geo.js';

const WOOD = 0x3d2418, WOOD_LT = 0x55301f, TILE = 0x6b3f2c, STONE = 0xb5b0a2, BRICK = 0x7f5645, LIME = 0xa9a393;

// Mái ngói cong kiểu Việt, bốn mái, đầu đao vểnh. Nửa bề rộng diềm ex×ez, nửa bề rộng đỉnh rx×rz (rz = 0: bờ nóc dọc x),
// diềm ở cao độ y0, mái cao h, đầu đao vểnh thêm lift và vươn ra out. Trả về hàm điểm trên đường bờ dải (góc k, v).
function roof(g, o) {
  const { ex, ez, rx, rz, y0, h, lift, out = 0, nu = 8, nv = 4, sag = 0.2, th = 0.12, tile = TILE, under = WOOD, vin = 0.55 } = o;
  const side = (k) => {
    const odd = k & 1, EX = odd ? ez : ex, EZ = odd ? ex : ez, RX = Math.max(odd ? rz : rx, 0.02), RZ = odd ? rx : rz; // RX > 0 để hàng đỉnh của mái hồi vẫn có pháp tuyến
    return (u, v, dy = 0) => {
      const c = Math.pow(Math.abs(u), 2.6), s = Math.sign(u), e = (1 - v) * (1 - v);
      const xe = u * EX + s * out * c, ze = EZ + out * c;
      return [xe + (u * RX - xe) * v, y0 + h * (v - sag * Math.sin(Math.PI * v)) + lift * c * e + dy, ze + (RZ - ze) * v];
    };
  };
  const row = (P, v, dy) => { const r = []; for (let i = 0; i <= nu; i++) r.push(P(-1 + (2 * i) / nu, v, dy)); return r; };
  for (let k = 0; k < 4; k++) {
    const P = side(k);
    g.push().rotY((k * Math.PI) / 2);
    for (let j = 0; j < nv; j++) {                      // mặt ngói, mỗi hàng một sắc độ (rêu, ngói cũ mới)
      g.mat(MAT.tile).color(tile).shade(0.94 + 0.04 * ((j + k) % 2));
      g.ribbon(row(P, (j + 1) / nv, 0), row(P, j / nv, 0));
    }
    g.mat().color(tile).shade(0.62); g.ribbon(row(P, 0, 0), row(P, 0, -th));   // diềm mái
    g.mat(MAT.wood).color(under);                                                    // dạ mái (rui gỗ) nhìn từ dưới lên
    g.ribbon(row(P, vin, -th), row(P, vin / 2, -th), true); g.ribbon(row(P, vin / 2, -th), row(P, 0, -th), true);
    g.pop();
  }
  return (k, v, dy = 0) => { const p = side(k)(1, v, dy), a = (k * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };
}

// Bờ dải chạy theo bốn góc mái, kết thúc bằng đầu đao cong vút.
function hips(g, hip, nv, r, col, tip) {
  g.mat(MAT.plaster).color(col);
  for (let k = 0; k < 4; k++) {
    let p = hip(k, 1, 0.04);
    for (let j = nv - 1; j >= 0; j--) { const q = hip(k, j / nv, 0.05); g.tube(p, q, r, 4, r); p = q; }
    const q0 = hip(k, 1 / nv, 0.05), d = [p[0] - q0[0], 0, p[2] - q0[2]], l = Math.hypot(d[0], d[2]) || 1;
    const t1 = [p[0] + (d[0] / l) * tip * 0.55, p[1] + tip * 0.45, p[2] + (d[2] / l) * tip * 0.55];
    const t2 = [p[0] + (d[0] / l) * tip * 0.8, p[1] + tip * 1.15, p[2] + (d[2] / l) * tip * 0.8];
    g.tube(p, t1, r, 4, r * 0.8); g.tube(t1, t2, r * 0.8, 4, r * 0.25);
  }
}

// Một đoạn lan can hồ dọc trục x từ x0 tới x1 tại z (dày 0,4): trụ xây trát vữa, chân tường gạch, ô gạch men xanh, mũ tường.
function balustrade(g, x0, x1, z, n) {
  const d = 0.2, L = (x1 - x0) / n;
  g.mat(MAT.brick).color(BRICK).shade(0.9).box(x0, 0, z - d, x1, 0.22, z + d, 'YzZ');
  for (let i = 0; i < n; i++) {
    const a = x0 + i * L + 0.25, b = x0 + (i + 1) * L - 0.25;
    g.mat(MAT.pave).gloss(0.35).color(i % 2 ? 0x2c6652 : 0x327058).box(a, 0.22, z - 0.09, b, 0.66, z + 0.09, 'zZ');
    g.gloss(0);
  }
  g.mat(MAT.plaster).color(LIME).shade(0.95).box(x0, 0.66, z - d - 0.03, x1, 0.8, z + d + 0.03, 'yYzZ');
  for (let i = 0; i <= n; i++) {
    const x = x0 + i * L;
    g.color(LIME).shade(i % 3 === 1 ? 0.86 : 0.9).box(x - 0.25, 0, z - 0.25, x + 0.25, 0.95, z + 0.25, 'xXzZ');
    g.color(LIME).shade(1.02).box(x - 0.29, 0.95, z - 0.29, x + 0.29, 1.05, z + 0.29);
  }
  g.mat();
}

export function build(g) {
  g.push(); g.glow(0).sway(0).gloss(0);
  const W = 8, WY = -0.3;

  // ----- hồ sen -----
  g.gloss(0.5).color(0x24452a).quad([-W, WY, W], [W, WY, W], [W, WY, -W], [-W, WY, -W]);
  g.gloss(0).mat(MAT.mossy).color(LIME).shade(0.7);                     // kè hồ đá rêu sát mặt nước
  g.quad([-W, WY - 0.3, -W], [W, WY - 0.3, -W], [W, 0, -W], [-W, 0, -W]);
  g.quad([W, WY - 0.3, W], [-W, WY - 0.3, W], [-W, 0, W], [W, 0, W]);
  g.quad([-W, WY - 0.3, W], [-W, WY - 0.3, -W], [-W, 0, -W], [-W, 0, W]);
  g.quad([W, WY - 0.3, -W], [W, WY - 0.3, W], [W, 0, W], [W, 0, -W]);
  const E = W + 0.9;
  g.mat(MAT.pave).color(0x9a6f5a).shade(0.9);                           // bờ hồ lát gạch Bát Tràng
  g.box(-E, 0, W, E, 0.03, E, 'Y'); g.box(-E, 0, -E, E, 0.03, -W, 'Y');
  g.box(-E, 0, -W, -W, 0.03, W, 'Y'); g.box(W, 0, -W, E, 0.03, W, 'Y');
  g.mat(MAT.stone).color(STONE).shade(0.78).box(-E, -0.45, -E, E, 0.03, E, 'xXzZ');   // tường ngoài của bể (mô hình được nâng 0,4 m)
  g.color(STONE).shade(0.9).box(-1.6, -0.45, E, 1.6, -0.2, E + 0.4, 'xXYZ');            // bậc bước lên bờ hồ trước lối vào
  g.mat();
  const bz = W + 0.22;
  g.push(); balustrade(g, -bz, bz, -bz, 8); g.pop();
  g.push().rotY(Math.PI / 2); balustrade(g, -bz, bz, bz, 8); g.pop();
  g.push().rotY(-Math.PI / 2); balustrade(g, -bz, bz, bz, 8); g.pop();
  balustrade(g, -bz, -1.25, bz, 3); balustrade(g, 1.25, bz, bz, 3);     // phía trước chừa lối lên bậc
  // lá sen, nụ sen
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39996, rr = 2.6 + ((i * 37) % 11) * 0.42, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (Math.abs(x) < 1.6 && z > 0) continue;
    g.color(i % 3 ? 0x3f7a3c : 0x4f8a40).shade(0.85 + (i % 4) * 0.07).disc(x, WY + 0.04 + (i % 3) * 0.015, z, 0.34 + (i % 5) * 0.07, 7);
    if (i % 4 === 0) { g.color(0x4b7a3a).tube([x + 0.3, WY, z + 0.2], [x + 0.36, WY + 0.5, z + 0.24], 0.018, 3); g.color(0xd98aa0).cyl(x + 0.36, WY + 0.48, z + 0.24, 0.085, 0, 0.26, 5, false); }
  }

  // ----- cột đá -----
  g.mat(MAT.mossy).color(STONE).shade(0.75).cyl(0, WY, 0, 0.66, 0.635, 0.6, 12, false);   // chân cột ố rêu
  g.mat(MAT.plaster).color(STONE).shade(0.9).cyl(0, WY + 0.6, 0, 0.635, 0.625, 1.2, 12, false);
  g.color(STONE).cyl(0, 1.5, 0, 0.625, 0.625, 2.5, 12, false);

  // ----- hệ gỗ đỡ đài sen: tám thanh chống cong xoè ra, dầm xuyên cột -----
  g.mat(MAT.wood);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a), R = i % 2 ? 2.25 : 1.72;
    g.color(i % 2 ? WOOD : WOOD_LT);
    g.tube([c * 0.55, 1.75, s * 0.55], [c * (0.55 + (R - 0.55) * 0.62), 2.6, s * (0.55 + (R - 0.55) * 0.62)], 0.12, 4);
    g.tube([c * (0.55 + (R - 0.55) * 0.62), 2.6, s * (0.55 + (R - 0.55) * 0.62)], [c * R, 3.66, s * R], 0.12, 4, 0.1);
    g.ball(c * (0.55 + (R - 0.55) * 0.62), 2.6, s * (0.55 + (R - 0.55) * 0.62), 0.135, 5, 3);   // khớp nối che khe giữa hai đoạn
    g.push().rotY(-a); g.color(WOOD).box(0.5, 3.62, -0.1, R + 0.06, 3.84, 0.1, 'XyYzZ'); g.pop();
  }
  g.color(WOOD).cyl(0, 1.62, 0, 0.7, 0.7, 0.22, 12, true, true);           // đai gỗ ôm cột
  g.color(WOOD_LT).shade(0.9).box(-1.78, 3.84, -1.78, 1.78, 4.02, 1.78);  // sàn

  // ----- toà gỗ: cột hiên, lan can, khám thờ -----
  const F = 4.02, T = 5.72, c0 = 1.5;
  for (const [x, z] of [[-c0, -c0], [c0, -c0], [-c0, c0], [c0, c0], [-0.55, c0], [0.55, c0], [-0.55, -c0], [0.55, -c0], [-c0, 0], [c0, 0]]) {
    g.color(WOOD).box(x - 0.09, F, z - 0.09, x + 0.09, T, z + 0.09, 'xXzZ');
  }
  g.color(WOOD).shade(0.9);                                              // xà đầu cột
  g.box(-1.62, T - 0.2, c0 - 0.08, 1.62, T, c0 + 0.08, 'yzZ'); g.box(-1.62, T - 0.2, -c0 - 0.08, 1.62, T, -c0 + 0.08, 'yzZ');
  g.box(c0 - 0.08, T - 0.2, -1.62, c0 + 0.08, T, 1.62, 'xXy'); g.box(-c0 - 0.08, T - 0.2, -1.62, -c0 + 0.08, T, 1.62, 'xXy');
  // lan can gỗ thấp quanh hiên (trừ gian giữa phía trước)
  const rail = (x0, z0, x1, z1) => {
    const xa = Math.min(x0, x1) - 0.04, xb = Math.max(x0, x1) + 0.04, za = Math.min(z0, z1) - 0.04, zb = Math.max(z0, z1) + 0.04;
    g.color(WOOD_LT).box(xa, F + 0.46, za, xb, F + 0.54, zb); g.color(0x5a2a1c).box(xa + 0.015, F + 0.06, za + 0.015, xb - 0.015, F + 0.46, zb - 0.015, 'xXzZ');
  };
  rail(-c0, c0, -0.55, c0); rail(0.55, c0, c0, c0); rail(-c0, -c0, c0, -c0); rail(-c0, -c0, -c0, c0); rail(c0, -c0, c0, c0);
  // khám thờ: vách gỗ ba mặt, mặt trước mở thấy ban thờ sơn son và tượng Quan Âm thếp vàng
  g.color(WOOD).shade(0.8).box(-1.05, F, -1.2, 1.05, T - 0.1, 0.5, 'xXz');
  g.mat().color(0x1a0d09).box(-1.05, F + 0.03, -1.2, 1.05, T - 0.1, 0.5, 'y');
  g.color(0x220e0a).quad([-1.05, F, -1.15], [1.05, F, -1.15], [1.05, T - 0.1, -1.15], [-1.05, T - 0.1, -1.15]);
  g.mat(MAT.lacquer).color(0x6e1712).box(-1.05, F, 0.42, -0.62, T - 0.1, 0.5, 'XZ').box(0.62, F, 0.42, 1.05, T - 0.1, 0.5, 'xZ');
  g.color(0x7d1a14).box(-0.6, F, -1.0, 0.6, F + 0.5, -0.35, 'xXYzZ');       // ban thờ
  g.mat().glow(0.12).color(0xc79a35).cyl(0, F + 0.5, -0.7, 0.26, 0.14, 0.5, 6, false).ball(0, F + 1.12, -0.7, 0.13, 6, 4); // tượng
  g.cyl(0, F + 0.5, -0.7, 0.34, 0.3, 0.07, 8, true); g.glow(0);
  // hoành phi sơn son thếp vàng dưới hiên trước
  g.gloss(0.3).color(0xb8902f).box(-0.62, T - 0.52, c0 + 0.09, 0.62, T - 0.16, c0 + 0.13, 'xXyYZ');
  g.mat(MAT.lacquer).color(0x7a1712).box(-0.56, T - 0.47, c0 + 0.13, 0.56, T - 0.21, c0 + 0.16, 'Z'); g.gloss(0);

  // ----- mái -----
  const RY = 5.42, RH = 1.75, RX = 0.95;
  const hip = roof(g, { ex: 2.75, ez: 2.75, rx: RX, rz: 0, y0: RY, h: RH, lift: 0.78, out: 0.42, nu: 10, nv: 4, sag: 0.2, vin: 0.7 });
  g.mat(MAT.wood).color(WOOD).shade(0.7).box(-1.5, T, -1.5, 1.5, T + 0.02, 1.5, 'y');     // trần
  hips(g, hip, 4, 0.085, 0x8f887a, 0.55);
  // bờ nóc và "lưỡng long chầu nguyệt": mặt nguyệt giữa hai rồng uốn
  const ty = RY + RH;
  g.mat(MAT.plaster);
  g.color(0x8f887a).box(-RX - 0.12, ty - 0.08, -0.11, RX + 0.12, ty + 0.2, 0.11);
  g.color(0x6f695e);
  for (const s of [-1, 1]) {
    const pts = [[s * (RX + 0.1), ty + 0.15], [s * (RX + 0.22), ty + 0.5], [s * (RX - 0.05), ty + 0.74], [s * 0.55, ty + 0.62], [s * 0.42, ty + 0.36], [s * 0.3, ty + 0.5]];
    for (let i = 0; i < pts.length - 1; i++) g.tube([pts[i][0], pts[i][1], 0], [pts[i + 1][0], pts[i + 1][1], 0], 0.085 - i * 0.008, 5, 0.077 - i * 0.008);
  }
  g.push().move(0, ty + 0.5, 0).rotX(Math.PI / 2);
  g.color(0x9a9282).cyl(0, -0.05, 0, 0.21, 0.21, 0.1, 10, true, true); g.pop();
  g.color(0x8f887a).tube([0, ty + 0.68, 0], [0, ty + 0.98, 0], 0.07, 4, 0.01); // ngọn lửa trên mặt nguyệt
  g.color(0x8f887a).box(-0.16, ty + 0.2, -0.09, 0.16, ty + 0.32, 0.09);

  // ----- bậc đá lên chùa (phía +z): mố gạch nhô ra từ bờ hồ, bậc dốc có tường gạch trát vữa hai bên -----
  const n = 13, zs = 5.9, ze = 1.78, run = (zs - ze) / n, rise = F / n, sw = 0.65, yb = WY - 0.3;
  g.mat(MAT.brick).color(BRICK).shade(0.8).box(-1.45, yb, zs - 0.35, 1.45, 0, W, 'xXz');
  g.mat(MAT.pave).color(0x9a6f5a).shade(0.9).box(-1.45, 0, zs - 0.35, 1.45, 0.03, W, 'xXYz');
  g.mat(MAT.plaster);
  for (const s of [-1, 1]) {                                               // lan can thấp hai bên mố
    g.color(LIME).shade(0.88).box(s * 1.3 - 0.15, 0.03, zs + 0.5, s * 1.3 + 0.15, 0.6, W - 0.05);
    g.color(LIME).shade(1.0).box(s * 1.3 - 0.19, 0.6, zs + 0.46, s * 1.3 + 0.19, 0.69, W - 0.05, 'xXYZ');
  }
  g.mat(MAT.stone);
  for (let i = 0; i < n; i++) {
    const z1 = zs - i * run, y = rise * (i + 1);
    g.color(STONE).shade(0.78 + ((i * 5) % 3) * 0.05).box(-sw, y - rise, z1 - run, sw, y, z1, 'YZ');
  }
  for (const s of [-1, 1]) {
    const xa = s > 0 ? sw : -sw - 0.3, xb = xa + 0.3, h0 = 0.55, lo = -0.2, zf = zs + 0.12, in_ = 0.05;
    g.mat(MAT.plaster).color(LIME).shade(0.72);                            // khối xây trát vữa dưới bậc, lùi vào 5 cm so với tường bậc
    g.quad([xb - in_, yb, zf], [xb - in_, yb, ze], [xb - in_, F + lo, ze], [xb - in_, lo, zf]);
    g.quad([xa + in_, yb, ze], [xa + in_, yb, zf], [xa + in_, lo, zf], [xa + in_, F + lo, ze]);
    g.quad([xa + in_, yb, zf - in_], [xb - in_, yb, zf - in_], [xb - in_, lo, zf - in_], [xa + in_, lo, zf - in_]);
    g.mat(MAT.plaster).color(LIME).shade(0.86);                            // tường bậc trát vữa
    g.quad([xb, lo, zf], [xb, F + lo, ze], [xb, F + h0, ze], [xb, h0, zf]);
    g.quad([xa, F + lo, ze], [xa, lo, zf], [xa, h0, zf], [xa, F + h0, ze]);
    g.quad([xa, lo, zf], [xb, lo, zf], [xb, h0, zf], [xa, h0, zf]);
    g.quad([xa, lo, zf], [xa, F + lo, ze], [xb, F + lo, ze], [xb, lo, zf]);  // mặt dưới gờ tường
    g.color(LIME).shade(1.02);                                             // mũ tường
    g.quad([xa - 0.04, h0, zf + 0.04], [xb + 0.04, h0, zf + 0.04], [xb + 0.04, F + h0, ze], [xa - 0.04, F + h0, ze]);
    g.color(LIME).shade(0.78);
    g.quad([xb + 0.04, h0 - 0.1, zf + 0.04], [xb + 0.04, F + h0 - 0.1, ze], [xb + 0.04, F + h0, ze], [xb + 0.04, h0, zf + 0.04]);
    g.quad([xa - 0.04, F + h0 - 0.1, ze], [xa - 0.04, h0 - 0.1, zf + 0.04], [xa - 0.04, h0, zf + 0.04], [xa - 0.04, F + h0, ze]);
    g.quad([xa - 0.04, h0 - 0.1, zf + 0.04], [xb + 0.04, h0 - 0.1, zf + 0.04], [xb + 0.04, h0, zf + 0.04], [xa - 0.04, h0, zf + 0.04]);
    g.color(LIME).shade(0.86).quad([xb, F + lo, ze], [xa, F + lo, ze], [xa, F + h0, ze], [xb, F + h0, ze]); // đầu tường phía chùa
  }
  // mặt sau khối xây (nhìn từ phía cột)
  g.mat(MAT.plaster).color(LIME).shade(0.66).quad([sw + 0.25, yb, ze + 0.03], [-sw - 0.25, yb, ze + 0.03], [-sw - 0.25, F - rise, ze + 0.03], [sw + 0.25, F - rise, ze + 0.03]);

  g.mat().gloss(0).glow(0).sway(0).color(0xffffff);
  g.pop();
}
