// Lăng Chủ tịch Hồ Chí Minh (1975): cao 21,6 m, mặt bằng vuông 41,2 m, mặt chính quay +z (quảng trường Ba Đình).
// Ba lớp: bệ tam cấp có lễ đài, khối giữa với hàng cột vuông ốp đá hoa cương bao quanh phòng thi hài, mái tam cấp.
// Dựng nghiêm trang, giản dị: chỉ đá xám, đá đỏ mận ở cửa, lễ đài và dòng chữ trên mái.
// Chất liệu: bệ, khán đài, mái ốp đá hoa cương xám xẻ khối (MAT.stone); cột, diềm mái và tường phòng thi hài là đá tấm lớn
// mài nhẵn (MAT.lacquer màu xám, mạch ghép ngang dựng bằng hình); đá đỏ mận mài bóng ở cửa, lễ đài và dòng chữ.
// Ban đêm lòng hiên cột hắt ánh vàng ấm (glow nhẹ trên tường trong và trần hiên); mặt ngoài được đèn pha trắng ấm rọi đều, sáng nhất ở
// mặt chính nhìn ra quảng trường (art bible mục 7).
import { MAT } from '../../core/geo.js';
import { floodlit } from './lighting.js';

const GRANITE = 0x8e8c88, DARK = 0x5e5c5a, PLUM = 0x5c1c26, PLUM_DK = 0x43141c, PLUM_LT = 0x6b1a26, WARM = 0x918b82;

// Khối vuông tâm gốc, nửa cạnh h, không vẽ đáy.
const sq = (g, h, y0, y1, faces = 'xXYzZ') => g.box(-h, y0, -h, h, y1, h, faces);

// Khối chóp cụt vuông (mái vát).
function frustum(g, h0, h1, y0, y1) {
  g.quad([-h0, y0, h0], [h0, y0, h0], [h1, y1, h1], [-h1, y1, h1]);
  g.quad([h0, y0, h0], [h0, y0, -h0], [h1, y1, -h1], [h1, y1, h1]);
  g.quad([h0, y0, -h0], [-h0, y0, -h0], [-h1, y1, -h1], [h1, y1, -h1]);
  g.quad([-h0, y0, -h0], [-h0, y0, h0], [-h1, y1, h1], [-h1, y1, -h1]);
  g.quad([-h1, y1, h1], [h1, y1, h1], [h1, y1, -h1], [-h1, y1, -h1]);
}

// Mạch ghép đá: các vạch mảnh sẫm màu trên bốn mặt của khối vuông nửa cạnh h.
function joints(g, h, y0, y1, rows, step) {
  const e = 0.03, w = 0.035; g.mat();
  for (let i = 1; i <= rows; i++) { const y = y0 + ((y1 - y0) * i) / (rows + 1); g.box(-h - e, y - w, -h - e, h + e, y + w, h + e, 'xXzZ'); }
  if (step) for (let x = -Math.floor((h - 0.5) / step) * step; x < h - 0.4; x += step) {
    g.box(x - w, y0, -h - e, x + w, y1, h + e, 'zZ');
    g.box(-h - e, y0, x - w, h + e, y1, x + w, 'xX');
  }
}

// Chữ khắc kiểu chữ in đậm không chân, mỗi nét là một hình chữ nhật [x0,y0,x1,y1] trên lưới cao 5 đơn vị
// (8 số: tứ giác xiên cho dấu). Phần tử đầu là bề rộng chữ.
const A = (...r) => r;
// 4 số: chữ nhật; 6 số: tam giác (vát góc chữ tròn); 8 số: tứ giác xiên (nét chéo, dấu).
const GLYPH = {
  C: A(3, [0, 0.5, 1, 4.5], [0.5, 4, 3, 5], [0.5, 0, 3, 1], [0, 4.5, 0.5, 4.5, 0.5, 5], [0, 0.5, 0.5, 0, 0.5, 0.5]),
  H: A(3, [0, 0, 1, 5], [2, 0, 3, 5], [1, 2, 2, 3]),
  U: A(3, [0, 0.5, 1, 5], [2, 0.5, 3, 5], [0.5, 0, 2.5, 1], [0, 0.5, 0.5, 0, 0.5, 0.5], [2.5, 0, 3, 0.5, 2.5, 0.5]),
  T: A(3, [0, 4, 3, 5], [1, 0, 2, 4]),
  I: A(1, [0, 0, 1, 5]),
  O: A(3, [0, 0.5, 1, 4.5], [2, 0.5, 3, 4.5], [0.5, 4, 2.5, 5], [0.5, 0, 2.5, 1], [0, 4.5, 0.5, 4.5, 0.5, 5], [0, 0.5, 0.5, 0, 0.5, 0.5], [2.5, 0, 3, 0.5, 2.5, 0.5], [2.5, 4.5, 3, 4.5, 2.5, 5]),
  M: A(5, [0, 0, 1, 5], [4, 0, 5, 5], [1, 3.5, 2.5, 1.3, 2.5, 2.8, 1, 5], [2.5, 1.3, 4, 3.5, 4, 5, 2.5, 2.8]),
  N: A(4, [0, 0, 1, 5], [3, 0, 4, 5], [1, 3.3, 3, 0, 3, 1.7, 1, 5]),
  '-': A(2, [0, 2, 2, 2.9]),
  ' ': A(2),
};
GLYPH['Ủ'] = [...GLYPH.U, [0.9, 6.2, 2.1, 6.65], [1.65, 5.55, 2.1, 6.2]];                       // dấu hỏi
GLYPH['Ị'] = [...GLYPH.I, [0, -1.45, 1, -0.6]];                                               // dấu nặng
GLYPH['Ồ'] = [...GLYPH.O, [0.3, 5.45, 0.9, 5.45, 1.5, 6.0, 1.5, 6.5], [1.5, 6.0, 2.1, 5.45, 2.7, 5.45, 1.5, 6.5], [2.35, 6.65, 2.8, 6.65, 2.25, 7.35, 1.8, 7.35]]; // mũ + dấu huyền
GLYPH['Í'] = [...GLYPH.I, [-0.25, 5.5, 0.3, 5.5, 1.25, 6.45, 0.7, 6.45]];                      // dấu sắc
const TEXT = ['C', 'H', 'Ủ', ' ', 'T', 'Ị', 'C', 'H', ' ', 'H', 'Ồ', '-', 'C', 'H', 'Í', '-', 'M', 'I', 'N', 'H'];

function inscription(g, cx, y, z, u) {
  let w = -1; for (const k of TEXT) w += GLYPH[k][0] + 1;
  let x = cx - (w * u) / 2;
  for (const k of TEXT) {
    const gl = GLYPH[k];
    for (let i = 1; i < gl.length; i++) {
      const r = gl[i];
      if (r.length === 4) g.quad([x + r[0] * u, y + r[1] * u, z], [x + r[2] * u, y + r[1] * u, z], [x + r[2] * u, y + r[3] * u, z], [x + r[0] * u, y + r[3] * u, z]);
      else if (r.length === 6) g.tri3([x + r[0] * u, y + r[1] * u, z], [x + r[2] * u, y + r[3] * u, z], [x + r[4] * u, y + r[5] * u, z]);
      else g.quad([x + r[0] * u, y + r[1] * u, z], [x + r[2] * u, y + r[3] * u, z], [x + r[4] * u, y + r[5] * u, z], [x + r[6] * u, y + r[7] * u, z]);
    }
    x += (gl[0] + 1) * u;
  }
}

// Khán đài hai bên: các bậc đá thấp dài, cao dần về phía sau. side = ±1.
function stand(g, side) {
  const x0 = 20.6, x1 = 40.0, zf = 20.6, n = 6, run = 1.55, rise = 0.5;
  const X0 = Math.min(side * x0, side * x1), X1 = Math.max(side * x0, side * x1);
  for (let i = 0; i < n; i++) {
    const za = zf - i * run, y = rise * (i + 1);
    g.mat(MAT.stone).color(GRANITE).shade(0.9 + (i % 2) * 0.05);
    g.box(X0, 0, za - run, X1, y, za, 'xXYZ');
    g.mat(MAT.stone).color(DARK).shade(1.05).box(X0, y - 0.07, za, X1, y, za + 0.03, 'Z'); // mũi bậc
  }
  const zb = zf - n * run, hb = rise * n + 1.1;
  g.mat(MAT.stone).color(GRANITE).shade(0.84).box(X0, 0, zb - 0.9, X1, hb, zb);                    // tường hậu
  g.mat(MAT.stone).color(DARK).box(X0 - 0.04, hb, zb - 0.94, X1 + 0.04, hb + 0.22, zb + 0.04);       // mũ tường
  g.mat(MAT.lacquer).color(PLUM).box(X0 + 0.6, hb - 0.75, zb, X1 - 0.6, hb - 0.3, zb + 0.04, 'Z');     // dải đá đỏ mận
  // trụ đầu hồi phía ngoài
  const xe = side * x1;
  g.mat(MAT.stone).color(GRANITE).shade(0.8).box(Math.min(xe, xe + side * 1.2), 0, zb - 0.9, Math.max(xe, xe + side * 1.2), hb + 0.22, zf + 0.3);
  g.mat(MAT.stone).color(DARK).shade(0.8).box(X0, 0, zf, X1, 0.12, zf + 0.25, 'xXYZ');
}

export function build(g) {
  g.push(); g.glow(0).sway(0).gloss(0.12).mat(MAT.stone);

  // ----- bệ tam cấp -----
  g.mat(MAT.stone).color(GRANITE).shade(0.88); sq(g, 20.6, 0, 1.4);
  g.mat(MAT.stone).color(DARK).shade(0.85); sq(g, 20.64, 0, 0.3, 'xXzZ');                       // chân bệ sẫm (ố nước mưa)
  g.mat(MAT.stone).color(DARK); joints(g, 20.6, 0.3, 1.4, 1, 4.12);
  g.mat(MAT.stone).color(GRANITE).shade(0.97); sq(g, 18.5, 1.4, 5.4);
  g.mat(MAT.stone).color(DARK); joints(g, 18.5, 1.4, 5.4, 3, 3.7);
  g.mat(MAT.stone).color(DARK).shade(0.9); sq(g, 18.54, 1.4, 1.62, 'xXzZ');
  // lan can quanh sân tầng hai (mặt trước chừa đoạn giữa thông ra lễ đài), mũ lan can sẫm
  const wall = (x0, z0, x1, z1) => {
    g.mat(MAT.stone).color(GRANITE).shade(1.03).box(x0, 5.4, z0, x1, 6.3, z1, 'xXzZ');
    g.mat(MAT.stone).color(DARK).box(x0 - 0.05, 6.3, z0 - 0.05, x1 + 0.05, 6.42, z1 + 0.05);
  };
  wall(-18.5, 18.05, -11, 18.5); wall(11, 18.05, 18.5, 18.5); wall(-18.5, -18.5, 18.5, -18.05);
  wall(-18.5, -18.05, -18.05, 18.05); wall(18.05, -18.05, 18.5, 18.05);
  // bệ đỡ hàng cột
  g.mat(MAT.stone).color(GRANITE).shade(0.9); sq(g, 16.0, 5.4, 6.9);
  g.mat(MAT.stone).color(DARK); sq(g, 16.03, 6.72, 6.9, 'xXzZ');

  // ----- lễ đài nhô ra phía trước, cửa lăng -----
  const ZP = 20.2;
  g.mat(MAT.stone).color(GRANITE).shade(1.0).box(-11, 1.4, 18.5, 11, 5.4, ZP, 'xXYZ');
  wall(-11, ZP - 0.42, 11, ZP); wall(-11, 18.5, -10.58, ZP - 0.42); wall(10.58, 18.5, 11, ZP - 0.42);
  g.mat(MAT.lacquer).color(PLUM).box(-11.02, 4.75, 18.5, 11.02, 5.2, ZP + 0.03, 'xXZ');            // dải đá đỏ mận của lễ đài
  g.mat(MAT.stone).color(DARK); g.mat(); for (let x = -8.8; x < 9; x += 2.2) if (Math.abs(x) > 2.5) g.box(x - 0.035, 1.4, ZP - 0.1, x + 0.035, 4.75, ZP + 0.03, 'Z');
  // cửa: khuôn đá đỏ mận, lòng cửa tối
  g.mat(MAT.lacquer).color(PLUM).box(-2.5, 1.4, ZP - 0.1, 2.5, 4.6, ZP + 0.12, 'xXYZ');
  g.mat(MAT.lacquer).color(PLUM_DK).box(-2.5, 4.3, ZP, 2.5, 4.6, ZP + 0.16, 'xXyYZ');
  g.mat().gloss(0).rgb(0.012, 0.011, 0.011).box(-1.6, 1.4, ZP, 1.6, 4.0, ZP + 0.14, 'Z');
  g.mat(MAT.wood).color(0x2a1a12).box(-1.6, 1.4, ZP, -1.05, 4.0, ZP + 0.16, 'XZ').box(1.05, 1.4, ZP, 1.6, 4.0, ZP + 0.16, 'xZ'); // hai cánh cửa gỗ mở
  g.gloss(0.12);
  // bậc thềm trước cửa
  for (let i = 0; i < 7; i++) {
    const y = 1.4 - i * 0.2, z = ZP + i * 0.4;
    g.mat(MAT.stone).color(GRANITE).shade(1.02 - (i % 2) * 0.06).box(-4.2, 0, z, 4.2, y, z + 0.4, 'xXYZ');
  }
  g.mat(MAT.lacquer).color(PLUM).box(-1.5, 1.405, ZP, 1.5, 1.41, ZP + 0.4, 'Y');
  for (const s of [-1, 1]) { g.mat(MAT.stone).color(GRANITE).shade(0.86).box(s * 4.2 - 0.45, 0, ZP, s * 4.2 + 0.45, 1.75, ZP + 2.9); g.mat(MAT.stone).color(DARK).box(s * 4.2 - 0.5, 1.75, ZP, s * 4.2 + 0.5, 1.87, ZP + 2.95); }

  // ----- khối giữa: phòng thi hài và hàng cột vuông (5 gian mỗi mặt) -----
  g.mat(MAT.lacquer).color(WARM).shade(0.8).glow(0.19); sq(g, 11.6, 6.9, 15.4, 'xXzZ');   // tường phòng thi hài: đêm hắt ánh đèn vàng ấm sau hàng cột
  g.glow(0);
  g.mat(MAT.stone).color(DARK); joints(g, 11.6, 6.9, 15.4, 4, 3.3);
  g.mat().color(DARK).shade(0.6).box(-2.1, 6.9, 11.6, 2.1, 12.4, 11.66, 'xXYZ');        // cửa trong sau hàng cột
  const cw = 0.78, co = 13.85;
  for (let i = 0; i < 6; i++) {
    const t = -co + (i * 2 * co) / 5;
    for (const [x, z] of i === 0 || i === 5 ? [[t, co], [t, -co]] : [[t, co], [t, -co], [co, t], [-co, t]]) { // cột góc chỉ dựng một lần
      g.mat(MAT.lacquer).gloss(0.2).color(GRANITE).shade(1.0 - ((i * 7) % 3) * 0.02).box(x - cw, 6.9, z - cw, x + cw, 15.4, z + cw, 'xXzZ');
      g.mat().gloss(0).color(DARK).shade(0.95);                                   // mạch ghép ngang giữa các tấm đá ốp cột
      for (let j = 1; j <= 5; j++) { const y = 7.2 + j * 1.367; g.box(x - cw - 0.012, y - 0.02, z - cw - 0.012, x + cw + 0.012, y + 0.02, z + cw + 0.012, 'xXzZ'); }
      g.mat(MAT.lacquer).gloss(0.12).color(DARK).shade(1.1).box(x - cw - 0.04, 6.9, z - cw - 0.04, x + cw + 0.04, 7.2, z + cw + 0.04, 'xXYzZ');
    }
  }
  g.mat().color(WARM).shade(0.6).glow(0.13).quad([-14.7, 15.39, -14.7], [14.7, 15.39, -14.7], [14.7, 15.39, 14.7], [-14.7, 15.39, 14.7]); // trần hiên

  g.glow(0);
  // ----- diềm mái mang dòng chữ, mái tam cấp -----
  g.mat(MAT.lacquer).color(GRANITE).shade(1.0); g.box(-15.3, 15.4, -15.3, 15.3, 18.3, 15.3, 'xXyzZ');
  g.mat(MAT.lacquer).color(DARK); sq(g, 15.33, 15.4, 15.62, 'xXzZ');
  g.mat(MAT.lacquer).color(GRANITE).shade(1.06); g.box(-15.65, 18.3, -15.65, 15.65, 18.7, 15.65);
  g.mat(MAT.stone).color(GRANITE).shade(0.93); frustum(g, 14.0, 13.3, 18.7, 19.7);
  g.mat(MAT.stone).color(GRANITE).shade(0.98); frustum(g, 11.7, 11.0, 19.7, 20.65);
  g.mat(MAT.stone).color(GRANITE).shade(1.03); frustum(g, 9.4, 8.7, 20.65, 21.6);
  g.gloss(0.25).mat(MAT.lacquer).color(PLUM_LT); inscription(g, 0, 16.15, 15.34, 0.3);
  g.gloss(0.12).mat(MAT.stone);

  // ----- khán đài hai bên -----
  stand(g, 1); stand(g, -1);

  // đèn pha trắng ấm rọi đều: mặt chính sáng nhất, ba mặt còn lại và khán đài dịu hơn, mặt nằm ngang chỉ hửng nhẹ
  floodlit(g, 0, g.count, (x, y, z, nx, ny, nz) => (ny > 0.5 ? 0.05 : ny < -0.5 ? 0 : (nz > 0.5 ? 0.2 : 0.11) * (Math.abs(x) > 20.7 ? 0.6 : 1)));

  // ----- hai hàng cây cảnh thấp trước bệ -----
  g.gloss(0);
  for (const s of [-1, 1]) {
    g.mat(MAT.stone);
    const xa = s > 0 ? 5.6 : -19.6, xb = s > 0 ? 19.6 : -5.6;
    g.color(0x6f6c66).box(xa - 0.2, 0, 21.0, xb + 0.2, 0.22, 23.9, 'xXYzZ');
    g.mat().color(0x2c4a29).box(xa, 0.22, 21.25, xb, 0.75, 22.0, 'xXYzZ');
    for (let i = 0; i < 8; i++) {
      const x = xa + 0.9 + (i * (xb - xa - 1.8)) / 7;
      g.color(i % 2 ? 0x2b4d2b : 0x325630).ball(x, 0.72, 23.05, 0.62, 6, 4, 0.85);
    }
  }
  g.mat().gloss(0).glow(0).sway(0).color(0xffffff);
  g.pop();
}
