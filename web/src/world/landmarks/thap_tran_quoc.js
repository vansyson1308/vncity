// Bảo tháp Lục độ đài sen, chùa Trấn Quốc: tháp gạch lục giác 11 tầng cao chừng 15 m, đỏ thẫm; mỗi mặt mỗi tầng có một khám
// vòm đặt tượng Phật A Di Đà bằng đá trắng; các tầng ngăn nhau bằng diềm mái cong; đỉnh là đài sen chín tầng (cửu phẩm
// liên hoa) bằng đá nhạt màu. Đế lục giác giật cấp.

const BRICK = 0x93412b, TILE = 0x5f3026, PALE = 0xcfc8b6, WHITE = 0xe9e6dc;
const C30 = Math.cos(Math.PI / 6);

// Lăng trụ lục giác (bán kính ngoại tiếp r0 → r1), một mặt phẳng hướng +z.
function hex(g, r0, r1, y0, y1, cap = true) {
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3, b = ((i + 1) * Math.PI) / 3;
    g.quad([Math.cos(b) * r0, y0, Math.sin(b) * r0], [Math.cos(a) * r0, y0, Math.sin(a) * r0], [Math.cos(a) * r1, y1, Math.sin(a) * r1], [Math.cos(b) * r1, y1, Math.sin(b) * r1]);
  }
  if (cap) { const p = []; for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; p.push([Math.cos(a) * r1, Math.sin(a) * r1]); } g.prism(p, y1, y1, true, false, false); }
}

// Một mặt của một tầng tháp trong hệ toạ độ cục bộ (mặt tường ở z = r·cos30°, rộng r): tường có khám lõm,
// tượng Phật trắng ngồi trong khám, diềm mái cong phía trên.
function face(g, r, y, hb, he, k, tier) {
  const z = r * C30, hw = r / 2;
  const nw = Math.min(0.27, hw * 0.42), n0 = y + 0.13, n1 = y + hb - 0.14, dp = 0.17;
  // tường quanh khám
  g.color(BRICK).shade(k * 0.82); g.quad([-hw, y, z], [hw, y, z], [hw, n0, z], [-hw, n0, z]);
  g.color(BRICK).shade(k);
  g.quad([-hw, n0, z], [-nw, n0, z], [-nw, n1, z], [-hw, n1, z]); g.quad([nw, n0, z], [hw, n0, z], [hw, n1, z], [nw, n1, z]);
  g.color(BRICK).shade(k * 0.7); g.quad([-hw, n1, z], [hw, n1, z], [hw, y + hb, z], [-hw, y + hb, z]);   // phần tường dưới diềm mái, sẫm bóng
  // lòng khám tối
  const zi = z - dp;
  g.rgb(0.03, 0.014, 0.01); g.quad([-nw, n0, zi], [nw, n0, zi], [nw, n1, zi], [-nw, n1, zi]);
  g.rgb(0.07, 0.028, 0.02);
  g.quad([-nw, n0, zi], [-nw, n1, zi], [-nw, n1, z], [-nw, n0, z]); g.quad([nw, n0, z], [nw, n1, z], [nw, n1, zi], [nw, n0, zi]);
  g.quad([-nw, n1, z], [-nw, n1, zi], [nw, n1, zi], [nw, n1, z]);
  g.color(BRICK).shade(k * 0.9); g.quad([-nw, n0, z], [nw, n0, z], [nw, n0, zi], [-nw, n0, zi]);
  // hai góc vát cho khám thành vòm
  const cv = nw * 0.62;
  g.color(BRICK).shade(k);
  g.tri3([-nw, n1 - cv, z + 0.004], [-nw + cv, n1, z + 0.004], [-nw, n1, z + 0.004]); g.tri3([nw, n1 - cv, z + 0.004], [nw, n1, z + 0.004], [nw - cv, n1, z + 0.004]);
  // tượng Phật ngồi bằng đá trắng: chân xếp bằng, thân, đầu (mỗi phần một nêm hai mặt hướng ra)
  const zs = z - dp * 0.72, bw = nw * 0.74, H = (n1 - n0) * 0.84, sy = n0 + 0.01;
  const wedge = (w0, w1, ya, yb, d, sh) => {
    g.color(WHITE).shade(sh).quad([-w0, ya, zs], [0, ya, zs + d], [0, yb, zs + d * 0.8], [-w1, yb, zs]);
    g.color(WHITE).shade(sh * 0.9).quad([0, ya, zs + d], [w0, ya, zs], [w1, yb, zs], [0, yb, zs + d * 0.8]);
  };
  wedge(bw, bw * 0.8, sy, sy + H * 0.22, 0.11, 0.9);                       // chân xếp bằng trên toà sen
  wedge(bw * 0.5, bw * 0.6, sy + H * 0.22, sy + H * 0.64, 0.085, 1.0);       // thân, vai
  wedge(bw * 0.27, bw * 0.22, sy + H * 0.7, sy + H, 0.07, 1.0);             // đầu
  // diềm mái cong: mép ngoài vểnh ở hai góc
  const ye = y + hb, ro = r + 0.36, n = 4, top0 = [], out = [], outB = [], inB = [];
  for (let i = 0; i <= n; i++) {
    const u = -1 + (2 * i) / n, c = Math.abs(u) ** 2.4, rr = ro + 0.1 * c;
    top0.push([(u * (r - 0.075)) / 2, ye + he, (r - 0.075) * C30]);
    out.push([(u * rr) / 2, ye + 0.02 + 0.15 * c, rr * C30]); outB.push([(u * rr) / 2, ye - 0.04 + 0.15 * c, rr * C30]);
    inB.push([(u * r) / 2, ye - 0.05, z]);
  }
  g.color(TILE).shade(tier % 2 ? 0.92 : 1.05); g.ribbon(top0, out);
  g.color(TILE).shade(0.6); g.ribbon(out, outB);
  g.color(PALE).shade(0.5); g.ribbon(inB, outB, true);
}

export function build(g) {
  g.push(); g.glow(0).sway(0).gloss(0);

  // ----- đế lục giác giật cấp -----
  g.color(0x8d857a); hex(g, 3.1, 3.1, 0, 0.3);
  g.color(0x9a9286); hex(g, 2.75, 2.75, 0.3, 0.6);
  g.color(BRICK).shade(0.75); hex(g, 2.4, 2.3, 0.6, 0.95);
  g.color(PALE).shade(0.8); hex(g, 2.36, 2.36, 0.95, 1.05);

  // ----- 11 tầng tháp -----
  const NT = 11, Y0 = 1.05, TH = 1.02, HB = 0.78;
  for (let t = 0; t < NT; t++) {
    const r = 1.86 - t * 0.058, y = Y0 + t * TH;
    for (let i = 0; i < 6; i++) {
      g.push().rotY((i * Math.PI) / 3);
      face(g, r, y, HB, TH - HB, 0.9 + ((t * 5 + i * 3) % 4) * 0.045, t);
      g.pop();
    }
  }

  // ----- đỉnh tháp: đài sen chín tầng bằng đá -----
  let y = Y0 + NT * TH;
  g.color(TILE).shade(0.9); hex(g, 1.86 - (NT - 1) * 0.058, 1.86 - (NT - 1) * 0.058, y - 0.001, y, true);   // nắp mái tầng trên cùng
  g.color(BRICK).shade(0.85); hex(g, 0.95, 0.8, y - 0.02, y + 0.22);
  y += 0.22;
  g.color(PALE).shade(0.9).cyl(0, y, 0, 0.62, 0.7, 0.14, 10, true);            // cánh sen đỡ
  g.color(PALE).cyl(0, y + 0.14, 0, 0.5, 0.36, 0.14, 10, true);
  y += 0.28;
  g.color(PALE).shade(0.8).cyl(0, y, 0, 0.13, 0.08, 1.95, 6, false);           // trục
  for (let i = 0; i < 9; i++) {
    const r = 0.56 - i * 0.043, yy = y + 0.06 + i * 0.2;
    g.color(PALE).shade(i % 2 ? 0.94 : 1.04).cyl(0, yy, 0, r * 0.82, r, 0.06, 10, false, true).cyl(0, yy + 0.06, 0, r, r * 0.86, 0.07, 10, true);
  }
  y += 0.06 + 9 * 0.2;
  g.color(PALE).shade(1.05).ball(0, y + 0.17, 0, 0.17, 8, 4, 1.15);               // bảo châu
  g.cyl(0, y + 0.32, 0, 0.05, 0, 0.28, 6, false);

  g.gloss(0).glow(0).sway(0).color(0xffffff);
  g.pop();
}
