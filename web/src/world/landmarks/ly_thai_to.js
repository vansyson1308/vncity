// Tượng đài Lý Thái Tổ (vườn hoa Lý Thái Tổ, bờ đông hồ Gươm).
// Tượng đồng cao 6,8 m trên bệ cao 3,4 m, đặt trên nền đá granit hai cấp (vuông ~12 m và ~8 m). Tượng nhìn về +z.
// Nhà vua đứng, áo bào dài, đội mũ phẳng đỉnh; tay phải cầm Chiếu dời đô, tay trái buông chỉ xuống đất Thăng Long.
import { hash } from '../../core/util.js';

const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lin = (h) => [s2l(((h >> 16) & 255) / 255), s2l(((h >> 8) & 255) / 255), s2l((h & 255) / 255)];

const BRONZE = 0x4a3a22, BRONZE_HI = 0x5e4a2a, BRONZE_LO = 0x35291a;
const PATINA = lin(0x3c4a3a);

// Đồng cũ: mặt ngửa lên sáng hơn, mặt úp và chỗ khuất ngả xanh rỉ đồng.
function patina(g, from, amt = 0.3) {
  for (let i = from; i < g.count; i++) {
    const ny = g.nrm[i * 3 + 1], k = 0.72 + 0.4 * (ny * 0.5 + 0.5), n = hash(i, 3);
    const p = Math.max(0, amt * (0.35 - ny * 0.5) + (n - 0.6) * 0.25);
    for (let c = 0; c < 3; c++) g.col[i * 4 + c] = g.col[i * 4 + c] * k * (1 - p) + PATINA[c] * p;
  }
}

// Vòng điểm elip quanh trục đứng, chạy theo chiều mà ribbon(vòng trên, vòng dưới) cho mặt hướng ra ngoài.
// fold: biên độ nếp gấp dọc (áo bào), nf: số nếp.
function ring(cx, y, cz, rx, rz, seg, fold = 0, nf = 9, ph = 0) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2, k = 1 + fold * Math.cos(a * nf + ph);
    pts.push([cx + Math.cos(a) * rx * k, y, cz - Math.sin(a) * rz * k]);
  }
  return pts;
}
// Thân tròn xoay tiết diện elip từ danh sách [y, rx, rz, fold].
function loft(g, cx, cz, prof, seg = 18, nf = 9) {
  for (let j = 0; j < prof.length - 1; j++) {
    const p = prof[j], q = prof[j + 1];
    g.ribbon(ring(cx, q[0], cz, q[1], q[2], seg, q[3] || 0, nf), ring(cx, p[0], cz, p[1], p[2], seg, p[3] || 0, nf));
  }
}

// Nền hai cấp và bậc lên ở chính giữa mặt trước.
function plinth(g) {
  const from = g.count;
  g.gloss(0.12);
  g.color(0xa9a59c); g.cube(0, 0, 0, 12, 0.14, 12, 'xXzZ');
  g.color(0xb9b5ab); g.cube(0, 0.14, 0, 12.16, 0.31, 12.16);
  g.color(0xa39f96); g.cube(0, 0.45, 0, 8, 0.14, 8, 'xXzZ');
  g.color(0xbdb8ae); g.cube(0, 0.59, 0, 8.14, 0.31, 8.14);
  // bậc tam cấp: nền dưới và từ nền dưới lên nền trên
  g.color(0xb2aea4);
  g.cube(0, 0, 6.08 + 0.34, 3.6, 0.15, 0.68); g.cube(0, 0.15, 6.08 + 0.17, 3.6, 0.15, 0.34);
  g.cube(0, 0.45, 4.07 + 0.34, 3.0, 0.15, 0.68); g.cube(0, 0.6, 4.07 + 0.17, 3.0, 0.15, 0.34);
  // loang màu đá
  for (let i = from; i < g.count; i++) { const k = 0.9 + hash(Math.round(g.pos[i * 3] * 2) * 31 + Math.round(g.pos[i * 3 + 2] * 2), 7) * 0.16; g.col[i * 4] *= k; g.col[i * 4 + 1] *= k; g.col[i * 4 + 2] *= k; }
}

// Bệ tượng tròn thắt lưng, đá sẫm màu; vành trên loe như đài sen, thân có đai chạm nổi.
function pedestal(g, y0, H) {
  const SEG = 32;
  let from = g.count;
  g.gloss(0.28).color(0x4a4640);
  const prof = [[1.96, 0], [1.96, 0.3], [1.86, 0.38], [1.82, 0.6], [1.7, 0.7], [1.63, 0.8], [1.6, 1.0], [1.6, H - 0.85], [1.63, H - 0.75], [1.72, H - 0.6],
    [1.8, H - 0.35], [1.8, H - 0.08], [1.74, H]];
  g.lathe(0, y0, 0, prof, SEG);
  // các đai: chân bệ và vành trên sáng hơn, thân sẫm; vành loe tô xen kẽ gợi hàng cánh sen
  for (let i = from; i < g.count; i++) {
    const y = g.pos[i * 3 + 1] - y0, seg = Math.floor((i - from) / prof.length), n = hash(i, 11) * 0.1;
    let k = y < 0.3 ? 1.3 : y < 0.75 ? 1.08 : y > H - 0.35 ? 1.3 : 0.94;
    if (y > H - 0.8 && y < H - 0.3) k = seg % 2 ? 1.45 : 0.85;
    if (y > 0.3 && y < 0.75) k *= seg % 2 ? 1.18 : 0.9;
    g.col[i * 4] *= k + n; g.col[i * 4 + 1] *= k + n; g.col[i * 4 + 2] *= k + n * 0.9;
  }
  g.color(0x3d3a35); g.disc(0, y0 + H, 0, 1.74, SEG, 1);
  // đai chạm nổi giữa thân (gợi hoa văn rồng mây thời Lý)
  from = g.count;
  g.color(0x5a554b).gloss(0.32);
  g.lathe(0, y0, 0, [[1.6, 1.32], [1.66, 1.4], [1.66, 1.48], [1.63, 1.52], [1.63, 2.08], [1.66, 2.12], [1.66, 2.2], [1.6, 2.28]], SEG);
  for (let i = from; i < g.count; i++) {
    const j = (i - from) % 8, seg = Math.floor((i - from) / 8), k = j >= 3 && j <= 4 ? 0.82 + hash(seg, 21 + j) * 0.5 : 1.1;
    g.col[i * 4] *= k; g.col[i * 4 + 1] *= k; g.col[i * 4 + 2] *= k;
  }
}

// Đĩa phẳng tâm c, pháp tuyến theo hướng d (bịt miệng ống tay áo).
function capDisc(g, c, d, r, seg = 8) {
  const l = Math.hypot(d[0], d[1], d[2]), n = [d[0] / l, d[1] / l, d[2] / l];
  let u = [-n[2], 0, n[0]]; const ul = Math.hypot(u[0], u[2]) || 1; u = [u[0] / ul, 0, u[2] / ul];
  const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  const P = (a) => [c[0] + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * r, c[1] + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * r, c[2] + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * r];
  for (let i = 0; i < seg; i++) {
    const p = P((i / seg) * Math.PI * 2), q = P(((i + 1) / seg) * Math.PI * 2);
    const nx = (p[1] - c[1]) * (q[2] - c[2]) - (p[2] - c[2]) * (q[1] - c[1]), ny = (p[2] - c[2]) * (q[0] - c[0]) - (p[0] - c[0]) * (q[2] - c[2]), nz = (p[0] - c[0]) * (q[1] - c[1]) - (p[1] - c[1]) * (q[0] - c[0]);
    if (nx * n[0] + ny * n[1] + nz * n[2] > 0) g.tri3(c, p, q); else g.tri3(c, q, p);
  }
}

// Ống tay áo rộng rủ xuống: nón dẹt treo dưới cẳng tay.
function drape(g, x, yTop, z, len, w, th, lean = 0) {
  g.push().move(x, yTop - len, z).scale(th / w, 1, 1);
  g.tube([lean, 0, 0.05], [0, len, 0], w * 0.55, 8, w);
  g.disc(lean, 0, 0.05, w * 0.55, 8, -1); g.disc(0, len, 0, w, 8, 1);
  g.pop();
}

// Tượng: gốc ở tâm đáy tượng, cao 6,8 đơn vị, nhìn về +z. Tay phải ở phía -x.
function statue(g) {
  const from = g.count;
  g.gloss(0.42);
  // đế đồng mỏng dưới chân
  g.color(BRONZE_LO); g.cyl(0, 0, 0, 1.62, 1.56, 0.14, 24, true);
  // áo bào dài chấm đất: gấu xoè có nếp, thon dần lên thắt lưng
  g.color(BRONZE);
  loft(g, 0, 0, [[0.14, 1.4, 1.1, 0.05], [0.6, 1.29, 1.02, 0.045], [1.8, 1.12, 0.87, 0.03], [3.0, 0.99, 0.76, 0.014], [3.7, 0.94, 0.7], [4.0, 0.94, 0.68]], 24, 8);
  // đai lưng
  g.color(BRONZE_HI);
  loft(g, 0, 0, [[3.3, 0.975, 0.75], [3.38, 1.0, 0.775], [3.54, 1.0, 0.775], [3.62, 0.965, 0.74]], 24);
  // dải áo giữa thân trước, bám theo mặt áo
  g.color(BRONZE_HI).shade(0.9);
  const fz = [[0.2, 1.18], [0.6, 1.1], [1.8, 0.93], [3.0, 0.8], [3.3, 0.775]];
  for (let i = 0; i < fz.length - 1; i++) {
    const p = fz[i], q = fz[i + 1], wp = 0.25 - i * 0.02, wq = 0.23 - i * 0.02;
    g.quad([-wp, p[0], p[1]], [wp, p[0], p[1]], [wq, q[0], q[1]], [-wq, q[0], q[1]]);
  }
  // áo choàng phủ vai và cánh tay: vai xuôi từ cổ, rộng nhất ở ngang khuỷu rồi thu vào thân
  g.color(BRONZE).shade(1.04);
  loft(g, 0, -0.02, [[3.62, 0.97, 0.72], [3.78, 1.4, 0.82], [4.2, 1.44, 0.8], [4.7, 1.3, 0.72], [5.02, 1.04, 0.6], [5.2, 0.72, 0.46], [5.33, 0.42, 0.33], [5.44, 0.28, 0.27]], 24);
  // tà áo choàng buông dài sau lưng xuống gần gấu áo
  g.color(BRONZE).shade(0.96);
  const cape = [[3.82, 1.38, 0.79, 0.0, 1.0, 0], [3.2, 1.03, 0.92, 0.0, 1.0, 0.012], [2.2, 1.12, 1.01, 0.0, 1.0, 0.025], [0.9, 1.29, 1.17, 0.0, 1.0, 0.035]];
  const arc = ([y, rx, rz, a0, a1, fold]) => {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const a = (a0 + ((a1 - a0) * i) / 14) * Math.PI, k = 1 + fold * Math.cos(a * 9) * Math.sin(a); pts.push([Math.cos(a) * rx * k, y, -Math.sin(a) * rz * k]); }
    return pts;
  };
  for (let j = 0; j < cape.length - 1; j++) { g.ribbon(arc(cape[j]), arc(cape[j + 1])); g.ribbon(arc(cape[j]), arc(cape[j + 1]), true); }
  // nẹp cổ áo và hai vạt áo choàng mở trước ngực
  g.color(BRONZE_HI).shade(0.95);
  loft(g, 0, 0, [[5.3, 0.4, 0.34], [5.36, 0.4, 0.35], [5.46, 0.3, 0.29]], 16);
  g.color(BRONZE_LO).shade(1.1);
  g.quad([-0.14, 3.8, 0.835], [0.14, 3.8, 0.835], [0.1, 4.75, 0.725], [-0.1, 4.75, 0.725]);
  g.quad([-0.1, 4.75, 0.725], [0.1, 4.75, 0.725], [0.06, 5.2, 0.5], [-0.06, 5.2, 0.5]);

  // ----- tay phải (phía -x): cẳng tay đưa ra trước, nâng cuộn Chiếu dời đô ngang ngực -----
  g.color(BRONZE);
  const re = [-1.02, 3.98, 0.42], rh = [-0.66, 4.12, 1.12];
  g.tube(re, rh, 0.34, 8, 0.4);
  g.color(BRONZE).shade(0.8); capDisc(g, rh, [rh[0] - re[0], rh[1] - re[1], rh[2] - re[2]], 0.4);   // miệng ống tay
  g.color(BRONZE).shade(0.9);
  drape(g, -0.85, 3.95, 0.76, 1.45, 0.36, 0.24, -0.04);
  g.color(BRONZE_HI);
  g.push().move(rh[0] + 0.04, rh[1] + 0.04, rh[2] + 0.12).scale(0.85, 1.15, 1); g.ball(0, 0, 0, 0.19, 7, 4); g.pop();
  // cuộn chiếu
  g.color(0x6b562c).gloss(0.6);
  const sa = [-0.82, 3.84, 1.3], sb = [-0.36, 4.72, 1.32];
  g.tube(sa, sb, 0.125, 8);
  g.color(0x7a6532);
  const sd = [(sb[0] - sa[0]) * 0.07, (sb[1] - sa[1]) * 0.07, (sb[2] - sa[2]) * 0.07];
  const sa0 = [sa[0] - sd[0], sa[1] - sd[1], sa[2] - sd[2]], sb1 = [sb[0] + sd[0], sb[1] + sd[1], sb[2] + sd[2]];
  g.tube(sa0, sa, 0.15, 8); g.tube(sb, sb1, 0.15, 8);
  capDisc(g, sb1, sd, 0.15); capDisc(g, sa0, [-sd[0], -sd[1], -sd[2]], 0.15);
  g.gloss(0.42);

  // ----- tay trái (phía +x): buông chếch ra trước, bàn tay chỉ xuống đất -----
  g.color(BRONZE);
  const le = [1.08, 3.95, 0.3], lh = [1.16, 3.1, 0.82];
  g.tube(le, lh, 0.34, 8, 0.4);
  g.color(BRONZE).shade(0.8); capDisc(g, lh, [lh[0] - le[0], lh[1] - le[1], lh[2] - le[2]], 0.4);
  g.color(BRONZE).shade(0.9);
  drape(g, 1.12, 3.45, 0.58, 1.3, 0.34, 0.24, 0.04);
  g.color(BRONZE_HI);
  g.push().move(lh[0], lh[1] - 0.2, lh[2] + 0.14).rotX(-0.5).scale(0.8, 1.6, 0.6); g.ball(0, 0, 0, 0.19, 7, 4); g.pop();

  // ----- cổ, đầu, mũ -----
  g.color(BRONZE_HI);
  g.cyl(0, 5.4, 0.02, 0.25, 0.23, 0.24, 10, false);
  g.ball(0, 5.93, 0.04, 0.41, 10, 6, 1.12);
  g.cube(0, 5.85, 0.42, 0.08, 0.17, 0.07);            // sống mũi: cho biết hướng mặt
  g.color(BRONZE);
  g.push().move(0, 5.5, 0.33).scale(0.62, 1.25, 0.34); g.ball(0, 0, 0, 0.27, 7, 4); g.pop();   // chòm râu
  // mũ phẳng đỉnh: vành mũ, thân mũ loe nhẹ, trâm cài ngang, dải mũ buông sau gáy
  g.color(BRONZE);
  g.cyl(0, 6.1, 0, 0.45, 0.45, 0.17, 12, true);
  g.cyl(0, 6.27, 0, 0.39, 0.455, 0.47, 12, true);
  g.color(BRONZE_HI); g.cyl(0, 6.74, 0, 0.485, 0.475, 0.06, 12, true, true);
  g.tube([-0.6, 6.48, 0], [0.6, 6.48, 0], 0.035, 5);
  g.ball(-0.6, 6.48, 0, 0.06, 5, 3); g.ball(0.6, 6.48, 0, 0.06, 5, 3);
  g.color(BRONZE).shade(0.9);
  g.quad([-0.04, 6.15, -0.45], [-0.3, 6.15, -0.43], [-0.36, 5.22, -0.47], [-0.06, 5.22, -0.49]);
  g.quad([0.3, 6.15, -0.43], [0.04, 6.15, -0.45], [0.06, 5.22, -0.49], [0.36, 5.22, -0.47]);
  patina(g, from, 0.32);
}

export function build(g) {
  g.gloss(0).glow(0).sway(0);
  plinth(g);
  // ban đêm tượng đài được rọi đèn: cho bệ và tượng hắt sáng nhẹ
  g.glow(0.1); pedestal(g, 0.9, 3.4);
  g.push().move(0, 4.3, 0);
  g.glow(0.18); statue(g);
  g.pop();
  g.color(0xffffff).gloss(0).glow(0).sway(0);
}
