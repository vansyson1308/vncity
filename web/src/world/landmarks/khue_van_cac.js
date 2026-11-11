// Khuê Văn Các (1805) trong Văn Miếu – Quốc Tử Giám, biểu tượng của Hà Nội: bốn trụ gạch vuông quét vôi trắng (cạnh 1 m,
// cao 3,9 m) trên nền vuông, đỡ gác gỗ sơn son thếp vàng có bốn cửa sổ tròn với các nan toả tia (sao Khuê), lan can gỗ
// quanh gác, hai tầng mái ngói cong tám mái, đỉnh nóc có bầu rượu. Cao chừng 9 m, bên dưới để trống (đi xuyên theo trục z).

const RED = 0x92281b, RED_DK = 0x6a1c13, GOLD = 0xc9a23a, TILE = 0x74483a, WHITE = 0xd8d3c4, WOOD = 0x58241a, MORTAR = 0x9a9486;

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
    for (let j = 0; j < nv; j++) {
      g.color(tile).shade([0.82, 1.0, 0.9, 1.08, 0.86, 1.0][(j + k) % 6]);
      g.ribbon(row(P, (j + 1) / nv, 0), row(P, j / nv, 0));
    }
    g.color(tile).shade(0.6); g.ribbon(row(P, 0, 0), row(P, 0, -th));   // diềm mái
    g.color(under);                                                   // dạ mái nhìn từ dưới lên
    g.ribbon(row(P, vin, -th), row(P, vin / 2, -th), true); g.ribbon(row(P, vin / 2, -th), row(P, 0, -th), true);
    g.pop();
  }
  return (k, v, dy = 0) => { const p = side(k)(1, v, dy), a = (k * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };
}

// Bờ dải chạy theo bốn góc mái, kết thúc bằng đầu đao cong vút.
function hips(g, hip, nv, r, col, tip) {
  g.color(col);
  for (let k = 0; k < 4; k++) {
    let p = hip(k, 1, 0.04);
    for (let j = nv - 1; j >= 0; j--) { const q = hip(k, j / nv, 0.05); g.tube(p, q, r, 4, r); p = q; }
    const q0 = hip(k, 1 / nv, 0.05), d = [p[0] - q0[0], 0, p[2] - q0[2]], l = Math.hypot(d[0], d[2]) || 1;
    const t1 = [p[0] + (d[0] / l) * tip * 0.55, p[1] + tip * 0.45, p[2] + (d[2] / l) * tip * 0.55];
    const t2 = [p[0] + (d[0] / l) * tip * 0.8, p[1] + tip * 1.15, p[2] + (d[2] / l) * tip * 0.8];
    g.tube(p, t1, r, 4, r * 0.8); g.tube(t1, t2, r * 0.8, 4, r * 0.25);
  }
}

// Cửa sổ tròn "sao Khuê" trên mặt phẳng z (hệ toạ độ cục bộ, nhìn từ +z): vành thếp vàng, lòng tối, nan gỗ toả tia.
function khueWindow(g, y, z, R) {
  const n = 16, ring = (r0, r1, zz) => { for (let i = 0; i < n; i++) { const a = (i / n) * 6.28319, b = ((i + 1) / n) * 6.28319; g.quad([Math.cos(a) * r0, y + Math.sin(a) * r0, zz], [Math.cos(a) * r1, y + Math.sin(a) * r1, zz], [Math.cos(b) * r1, y + Math.sin(b) * r1, zz], [Math.cos(b) * r0, y + Math.sin(b) * r0, zz]); } };
  const fan = (r, zz) => { for (let i = 0; i < n; i++) { const a = (i / n) * 6.28319, b = ((i + 1) / n) * 6.28319; g.tri3([0, y, zz], [Math.cos(a) * r, y + Math.sin(a) * r, zz], [Math.cos(b) * r, y + Math.sin(b) * r, zz]); } };
  g.rgb(0.02, 0.014, 0.012); fan(R * 0.84, z + 0.03);
  g.color(RED_DK); ring(R * 0.84, R * 1.0, z + 0.05);
  g.color(GOLD); ring(R * 1.0, R * 1.09, z + 0.05); ring(R * 0.78, R * 0.84, z + 0.06);
  g.color(RED);
  for (let i = 0; i < 12; i++) {                                         // nan toả tia
    const a = (i / 12) * 6.28319, c = Math.cos(a), s = Math.sin(a), w = 0.035, r0 = R * 0.2, r1 = R * 0.8;
    g.quad([c * r0 + s * w, y + s * r0 - c * w, z + 0.07], [c * r1 + s * w, y + s * r1 - c * w, z + 0.07], [c * r1 - s * w, y + s * r1 + c * w, z + 0.07], [c * r0 - s * w, y + s * r0 + c * w, z + 0.07]);
  }
  g.color(GOLD); fan(R * 0.22, z + 0.08);
}

export function build(g) {
  g.push(); g.glow(0).sway(0).gloss(0);
  const B = 0.3, P = 2.75, PT = B + 3.9;

  // ----- nền gạch và bậc thềm trước, sau -----
  g.color(0x8f8676).box(-3.4, 0, -3.4, 3.4, B, 3.4);
  g.color(0x7a7265).box(-3.44, 0, -3.44, 3.44, 0.08, 3.44, 'xXYzZ');
  g.color(0x9a5f48).box(-2.25, B, -2.25, 2.25, B + 0.012, 2.25, 'Y');       // lòng nền lát gạch đỏ
  for (const s of [-1, 1]) {
    g.color(0x8f8676).shade(0.92).box(-1.75, 0, s > 0 ? 3.4 : -3.7, 1.75, 0.15, s > 0 ? 3.7 : -3.4, 'xXYzZ');
  }

  // ----- bốn trụ gạch quét vôi -----
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * P, z = sz * P;
    g.color(WHITE).shade(0.72).cube(x, B, z, 1.12, 0.32, 1.12, 'xXYzZ');      // chân trụ ố rêu
    g.color(WHITE).shade(0.9).cube(x, B + 0.32, z, 1.0, 0.9, 1.0, 'xXzZ');
    g.color(WHITE).cube(x, B + 1.22, z, 1.0, 2.33, 1.0, 'xXzZ');
    g.color(WHITE).shade(0.86);                                              // ô đắp nổi trên bốn mặt trụ
    g.box(x - 0.3, B + 0.9, z - 0.515, x + 0.3, B + 3.2, z + 0.515, 'zZ'); g.box(x - 0.515, B + 0.9, z - 0.3, x + 0.515, B + 3.2, z + 0.3, 'xX');
    g.color(WHITE).shade(1.04).cube(x, B + 3.55, z, 1.14, 0.35, 1.14, 'xXyYzZ'); // đầu trụ
  }

  // ----- sàn gác: xà gỗ trên đầu trụ, sàn vươn ra đỡ lan can -----
  const F = PT + 0.34;
  g.color(RED_DK);
  for (const s of [-1, 1]) { g.box(-3.3, PT, s * P - 0.2, 3.3, PT + 0.3, s * P + 0.2); g.box(s * P - 0.2, PT, -3.3, s * P + 0.2, PT + 0.3, 3.3); }
  g.color(WOOD).box(-3.25, PT + 0.2, -3.25, 3.25, PT + 0.22, 3.25, 'y');         // trần gỗ nhìn từ dưới
  g.color(RED).box(-3.42, PT + 0.22, -3.42, 3.42, F, 3.42, 'xXYzZ');
  g.color(GOLD).box(-3.44, F - 0.07, -3.44, 3.44, F - 0.03, 3.44, 'xXzZ');

  // lan can con tiện quanh gác
  const RL = 3.3;
  for (let k = 0; k < 4; k++) {
    g.push().rotY((k * Math.PI) / 2);
    g.color(RED).box(-RL, F + 0.44, RL - 0.06, RL, F + 0.53, RL + 0.06);
    g.color(RED_DK).box(-RL, F + 0.06, RL - 0.04, RL, F + 0.13, RL + 0.04, 'YzZ');
    for (let i = 0; i < 15; i++) {
      const x = -RL + 0.22 + i * ((2 * RL - 0.44) / 14);
      if (i % 7 === 0) { g.color(RED).box(x - 0.07, F, RL - 0.07, x + 0.07, F + 0.64, RL + 0.07); }
      else { g.color(i % 2 ? RED : GOLD).shade(i % 2 ? 1 : 0.9).box(x - 0.035, F + 0.13, RL - 0.035, x + 0.035, F + 0.44, RL + 0.035, 'xXzZ'); }
    }
    g.pop();
  }

  // ----- gác gỗ sơn son: bốn cột góc, vách có cửa sổ tròn sao Khuê -----
  const W = 2.5, WT = F + 1.9;
  g.color(RED).shade(0.92).box(-W, F, -W, W, WT + 0.1, W, 'xXzZ');
  for (let k = 0; k < 4; k++) {
    g.push().rotY((k * Math.PI) / 2);
    g.color(RED_DK).box(W - 0.14, F, W - 0.14, W + 0.07, WT, W + 0.07, 'xXzZ'); // cột góc
    g.color(RED_DK).box(-W, F, W, W, F + 0.16, W + 0.05, 'YZ').box(-W, WT - 0.2, W, W, WT, W + 0.06, 'yZ');
    khueWindow(g, F + 1.0, W, 0.64);
    for (const s of [-1, 1]) {                                                  // hai dải câu đối thếp vàng hai bên
      g.color(GOLD).box(s * 1.72 - 0.2, F + 0.3, W, s * 1.72 + 0.2, WT - 0.3, W + 0.04, 'xXyYZ');
      g.color(RED_DK).box(s * 1.72 - 0.15, F + 0.35, W + 0.04, s * 1.72 + 0.15, WT - 0.35, W + 0.05, 'Z');
    }
    g.pop();
  }

  // ----- hai tầng mái -----
  const Y1 = WT - 0.2, H1 = 0.82, N = 1.55;
  const hip1 = roof(g, { ex: 3.9, ez: 3.9, rx: N, rz: N, y0: Y1, h: H1, lift: 0.6, out: 0.3, nu: 10, nv: 3, sag: 0.16, vin: 0.66 });
  hips(g, hip1, 3, 0.075, MORTAR, 0.42);
  // cổ diêm giữa hai tầng mái, biển tên thếp vàng ở mặt trước
  const NY = Y1 + H1 - 0.06, NT = NY + 0.48;
  g.color(RED).shade(0.85).box(-N, NY, -N, N, NT + 0.06, N, 'zZ').box(-N, NY, -N, N, NT + 0.2, N, 'xX'); // vách hồi cao hơn cho kín dạ mái
  g.color(MORTAR).box(-N - 0.06, NY, -N - 0.06, N + 0.06, NY + 0.1, N + 0.06, 'xXYzZ');
  g.color(GOLD).box(-0.62, NY + 0.14, N, 0.62, NT - 0.08, N + 0.05, 'xXyYZ');
  g.color(RED_DK).box(-0.55, NY + 0.19, N + 0.05, 0.55, NT - 0.13, N + 0.06, 'Z');
  const Y2 = NT - 0.12, H2 = 0.9, RX = 0.95;
  const hip2 = roof(g, { ex: 2.7, ez: 2.7, rx: RX, rz: 0, y0: Y2, h: H2, lift: 0.5, out: 0.24, nu: 8, nv: 3, sag: 0.16, vin: 0.7 });
  hips(g, hip2, 3, 0.07, MORTAR, 0.38);
  // bờ nóc, hai đầu kìm, bầu rượu trên đỉnh
  const TY = Y2 + H2;
  g.color(MORTAR).box(-RX - 0.1, TY - 0.08, -0.1, RX + 0.1, TY + 0.2, 0.1);
  for (const s of [-1, 1]) { g.tube([s * (RX + 0.02), TY + 0.15, 0], [s * (RX + 0.2), TY + 0.4, 0], 0.085, 4, 0.06); g.tube([s * (RX + 0.2), TY + 0.4, 0], [s * (RX + 0.1), TY + 0.62, 0], 0.06, 4, 0.02); }
  g.color(MORTAR).shade(1.08).box(-0.18, TY + 0.2, -0.14, 0.18, TY + 0.28, 0.14);
  g.lathe(0, TY + 0.28, 0, [[0.09, 0], [0.18, 0.06], [0.19, 0.15], [0.1, 0.23], [0.12, 0.29], [0.08, 0.37], [0.02, 0.47], [0, 0.5]], 8);

  g.gloss(0).glow(0).sway(0).color(0xffffff);
  g.pop();
}
