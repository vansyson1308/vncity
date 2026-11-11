// Tượng đài Lý Thái Tổ (vườn hoa Lý Thái Tổ, bờ đông hồ Gươm), khánh thành 2004.
// Tượng đồng cao 6,8 m trên bệ đồng tròn cao 3,3 m (cả hai đúc đồng: tượng 12 tấn, bệ 20 tấn; tổng cao 10,1 m),
// đặt trên nền đá granit hai cấp (vuông ~12 m và ~8 m). Tượng nhìn về +z (ra hồ).
// Nhà vua đứng thẳng, long bào tay thụng dài chấm đất, đội mũ bình thiên (tấm phẳng trên đỉnh mũ);
// tay phải nâng cuộn Chiếu dời đô ngang ngực, tay trái đưa ra trước chỉ xuống đất Thăng Long.
import { hash } from '../../core/util.js';
import { MAT } from '../../core/geo.js';

const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lin = (h) => [s2l(((h >> 16) & 255) / 255), s2l(((h >> 8) & 255) / 255), s2l((h & 255) / 255)];

const BRONZE = 0x4d4026, BRONZE_HI = 0x62502d, BRONZE_LO = 0x3a2f1d;
const PATINA = lin(0x39503f);
const GRANITE = 0xb4b0a6;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mad = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Đồng cũ: mặt ngửa lên sáng hơn (bị mưa rửa, tay người không chạm tới), mặt úp và chỗ khuất ngả xanh rỉ đồng.
function patina(g, from, amt = 0.3) {
  for (let i = from; i < g.count; i++) {
    const ny = g.nrm[i * 3 + 1], k = 0.76 + 0.34 * (ny * 0.5 + 0.5), n = hash(Math.round(g.pos[i * 3] * 9) * 13 + Math.round(g.pos[i * 3 + 1] * 9) * 7 + Math.round(g.pos[i * 3 + 2] * 9), 3);
    const p = Math.max(0, Math.min(0.6, amt * (0.4 - ny * 0.5) + (n - 0.55) * 0.22));
    for (let c = 0; c < 3; c++) g.col[i * 4 + c] = g.col[i * 4 + c] * k * (1 - p) + PATINA[c] * p;
  }
}

// Lưới ống đi qua các vòng điểm (mỗi vòng n+1 điểm, điểm cuối trùng điểm đầu), pháp tuyến mượt theo cả hai chiều
// nên thân tượng không lộ từng khoanh. Vòng chạy theo chiều của oval() bên dưới, các vòng xếp từ dưới lên / từ gốc ra ngọn.
function skin(g, R) {
  const m = R.length, n = R[0].length, base = g.count;
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    const a = R[j][(i + n - 2) % (n - 1)], b = R[j][(i + 1) % (n - 1)], c = R[Math.max(0, j - 1)][i], d = R[Math.min(m - 1, j + 1)][i];
    const nn = cross(sub(b, a), sub(d, c)), p = R[j][i];
    g.v(p[0], p[1], p[2], nn[0], nn[1], nn[2]);
  }
  for (let j = 0; j < m - 1; j++) for (let i = 0; i < n - 1; i++) { const a = base + j * n + i, b = a + n; g.tri(a, a + 1, b); g.tri(a + 1, b + 1, b); }
}
// Vòng elip nằm ngang quanh trục đứng. fold: biên độ nếp gấp dọc của vải, nf: số nếp, ph: lệch pha (nếp hơi xiên theo chiều cao).
function oval(cx, y, cz, rx, rz, seg, fold = 0, nf = 11, ph = 0) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const a = ((i % seg) / seg) * Math.PI * 2, k = 1 + fold * Math.cos(a * nf + ph) * (0.65 + 0.35 * Math.cos(a * 2 + 1.3));
    pts.push([cx + Math.cos(a) * rx * k, y, cz - Math.sin(a) * rz * k]);
  }
  return pts;
}
// Bịt đầu ống bằng quạt tam giác phẳng quanh tâm c (ring chạy ngược kim đồng hồ khi nhìn từ phía mặt cần thấy).
function fan(g, ring, c) { for (let i = 0; i < ring.length - 1; i++) g.tri3(c, ring[i], ring[i + 1]); }

// ---------- nền đá ----------
// Nền hai cấp và bậc lên ở chính giữa mặt trước: thành bậc là đá xẻ, mặt nền lát đá tấm.
function plinth(g) {
  const from = g.count;
  g.gloss(0.1);
  const tier = (y, w, h) => {
    g.mat(MAT.stone).color(GRANITE).shade(0.9); g.cube(0, y, 0, w, h - 0.12, w, 'xXzZ');
    g.color(GRANITE).shade(1.04); g.cube(0, y + h - 0.12, 0, w + 0.14, 0.12, w + 0.14, 'xXyzZ');   // gờ mép nhô 7 cm
    g.mat(MAT.pave).color(GRANITE); g.cube(0, y + h - 0.12, 0, w + 0.14, 0.12, w + 0.14, 'Y');
  };
  tier(0, 12, 0.45); tier(0.45, 8, 0.45);
  // bậc tam cấp: từ sân lên nền dưới và từ nền dưới lên nền trên
  g.mat(MAT.stone).color(GRANITE).shade(0.97);
  g.cube(0, 0, 6.07 + 0.34, 3.6, 0.15, 0.68, 'xXYZ'); g.cube(0, 0.15, 6.07 + 0.17, 3.6, 0.15, 0.34, 'xXYZ');
  g.cube(0, 0.45, 4.07 + 0.34, 3.0, 0.15, 0.68, 'xXYZ'); g.cube(0, 0.6, 4.07 + 0.17, 3.0, 0.15, 0.34, 'xXYZ');
  // loang màu đá rất nhẹ theo mảng (hoa văn tấm lát đã do chất liệu vẽ)
  for (let i = from; i < g.count; i++) { const k = 0.95 + hash(Math.round(g.pos[i * 3] * 2) * 31 + Math.round(g.pos[i * 3 + 2] * 2), 7) * 0.08; g.col[i * 4] *= k; g.col[i * 4 + 1] *= k; g.col[i * 4 + 2] *= k; }
  g.mat();
}

// ---------- bệ đồng ----------
// Băng cánh sen: np cánh quanh thân, mỗi cánh phồng ở giữa và thắt thành khe ở mép; amp[j] là độ phồng của từng hàng.
function petals(g, y0, prof, amp, np) {
  const seg = np * 4, R = [], from = g.count;
  for (let j = 0; j < prof.length; j++) {
    const row = [];
    for (let i = 0; i <= seg; i++) {
      const a = ((i % seg) / seg) * Math.PI * 2, s = Math.abs(Math.sin((np * a) / 2)), b = 1 - (1 - s) * (1 - s), r = prof[j][0] + amp[j] * (b - 0.5);
      row.push([Math.cos(a) * r, y0 + prof[j][1], -Math.sin(a) * r]);
    }
    R.push(row);
  }
  skin(g, R);
  for (let i = from; i < g.count; i++) { const k = (i - from) % (seg + 1) % 4 === 0 ? 0.6 : 1.06; g.col[i * 4] *= k; g.col[i * 4 + 1] *= k; g.col[i * 4 + 2] *= k; }
}
// Bệ tròn thắt lưng, đúc đồng: chân bệ có băng cánh sen úp, thân có đai chạm nổi (gợi rồng mây thời Lý uốn khúc),
// vành trên là băng cánh sen ngửa đỡ mặt bệ.
function pedestal(g, y0, H) {
  const SEG = 32, from = g.count, s = H / 3.3;
  const P = (list) => list.map(([r, y]) => [r, y * s]);
  g.gloss(0.3).mat(MAT.lacquer).color(BRONZE_LO).shade(1.08);
  g.lathe(0, y0, 0, P([[2.0, 0], [2.0, 0.2], [1.95, 0.26]]), SEG);
  g.color(BRONZE).shade(0.95);
  petals(g, y0, P([[1.95, 0.26], [1.92, 0.42], [1.76, 0.62], [1.66, 0.7]]), [0.02, 0.07, 0.06, 0.0], 16);
  g.color(BRONZE_LO).shade(1.05);
  g.lathe(0, y0, 0, P([[1.66, 0.7], [1.62, 0.76], [1.62, 0.95], [1.71, 0.99], [1.71, 1.07], [1.655, 1.1]]), SEG);
  // đai chạm nổi: một sống nổi uốn lượn quanh thân bệ (thân rồng), nền đai sẫm hơn
  {
    const seg = 64, rows = 7, R = [], f0 = g.count;
    g.color(BRONZE);
    for (let j = 0; j < rows; j++) {
      const y = 1.1 + (j / (rows - 1)) * 1.0, row = [];
      for (let i = 0; i <= seg; i++) {
        const a = ((i % seg) / seg) * Math.PI * 2, yc = 1.6 + 0.26 * Math.sin(a * 8), yc2 = 1.6 - 0.3 * Math.sin(a * 8 + 0.9);
        const e = j === 0 || j === rows - 1 ? 0 : Math.exp(-Math.pow((y - yc) / 0.15, 2)) + 0.55 * Math.exp(-Math.pow((y - yc2) / 0.11, 2));
        row.push([Math.cos(a) * (1.655 + 0.05 * Math.min(1, e)), y0 + y * s, -Math.sin(a) * (1.655 + 0.05 * Math.min(1, e)), e]);
      }
      R.push(row);
    }
    skin(g, R);
    for (let i = f0; i < g.count; i++) { const e = R[Math.floor((i - f0) / (seg + 1))][(i - f0) % (seg + 1)][3], k = 0.7 + 0.5 * Math.min(1, e); g.col[i * 4] *= k; g.col[i * 4 + 1] *= k; g.col[i * 4 + 2] *= k; }
  }
  g.color(BRONZE_LO).shade(1.05);
  g.lathe(0, y0, 0, P([[1.655, 2.1], [1.71, 2.13], [1.71, 2.21], [1.62, 2.25], [1.62, 2.42], [1.66, 2.5]]), SEG);
  g.color(BRONZE).shade(0.95);
  petals(g, y0, P([[1.66, 2.5], [1.8, 2.68], [1.9, 2.92], [1.87, 3.1]]), [0.0, 0.06, 0.08, 0.03], 16);
  g.color(BRONZE_LO).shade(1.1);
  g.lathe(0, y0, 0, P([[1.87, 3.1], [1.92, 3.14], [1.92, 3.26], [1.86, 3.3]]), SEG);
  g.disc(0, y0 + H, 0, 1.86, SEG, 1);
  patina(g, from, 0.26);
}

// ---------- tượng ----------
// Ống tay áo thụng: ống đi từ vai S qua khuỷu E tới cổ tay W; tiết diện hình giọt nước, phần vải thừa rủ ra sau bắp tay
// rồi thõng xuống dưới cẳng tay, dài nhất ở miệng ống. Trả về hướng cẳng tay để đặt bàn tay.
function sleeve(g, S, E, W, seg = 16) {
  const d0 = unit(sub(E, S)), d1 = unit(sub(W, E)), db = unit([d0[0] + d1[0], d0[1] + d1[1], d0[2] + d1[2]]);
  const mid = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // [tâm, hướng, nửa rộng, bán kính phía trên, độ rủ phía dưới]
  const top = [S[0] * 0.8, S[1] + 0.24, S[2]];   // chỏm vai: ống tay khép dần vào dốc vai, không hở miệng
  const secs = [[top, d0, 0.1, 0.1, 0.1], [mid(top, S, 0.55), d0, 0.24, 0.23, 0.24], [S, d0, 0.3, 0.3, 0.3], [mid(S, E, 0.55), d0, 0.3, 0.28, 0.36], [E, db, 0.31, 0.3, 0.5], [mid(E, W, 0.5), d1, 0.3, 0.26, 0.72], [W, d1, 0.27, 0.23, 0.98]];
  const R = secs.map(([c, d, rw, ru, rd], k) => {
    // bắp tay và khuỷu: tiết diện vuông góc với ống; cẳng tay: vải rủ thẳng đứng theo trọng lực
    let e1, e2; const dx = d[0];
    if (k >= 5) { e2 = [0, 1, 0]; e1 = unit(cross(e2, d)); } else { e1 = unit([1 - dx * d[0], -dx * d[1], -dx * d[2]]); e2 = cross(d, e1); }
    const row = [];
    for (let i = 0; i <= seg; i++) {
      const a = ((i % seg) / seg) * Math.PI * 2, sn = Math.sin(a), w = Math.cos(a) * rw * (sn < 0 ? 1 - 0.5 * sn * sn : 1), h = sn * (sn >= 0 ? ru : rd);
      row.push([c[0] + e1[0] * w + e2[0] * h, c[1] + e1[1] * w + e2[1] * h, c[2] + e1[2] * w + e2[2] * h]);
    }
    return row;
  });
  skin(g, R);
  // lòng ống tay tối
  const c0 = g.c.slice();
  g.shade(0.55); fan(g, R[R.length - 1], mad(W, d1, -0.14)); g.c = c0;
  return d1;
}

// Tượng: gốc ở tâm đáy tượng, cao 6,8 đơn vị, nhìn về +z. Tay phải ở phía -x.
function statue(g) {
  const from = g.count;
  g.gloss(0.4).mat(MAT.lacquer);   // «sơn»: chỉ là lớp loang sắc độ rất nhẹ, hợp với mặt đồng đã lên nước
  // đế đồng mỏng dưới chân
  g.color(BRONZE_LO); g.cyl(0, 0, 0, 1.64, 1.6, 0.12, 28, true);

  // ----- thân: long bào dài chấm đất, gấu xoè có nếp, thon dần lên thắt lưng, ngực, vai xuôi, cổ -----
  const SEG = 44;
  g.color(BRONZE);
  const body = [ // [y, rx, rz, độ sâu nếp, tâm z]
    [0.12, 1.4, 1.14, 0.085, 0.02], [0.2, 1.4, 1.14, 0.085, 0.02], [0.7, 1.27, 1.02, 0.075, 0.02], [1.5, 1.12, 0.89, 0.055, 0.01], [2.4, 0.99, 0.78, 0.035, 0], [3.1, 0.9, 0.69, 0.016, 0],
    [3.55, 0.84, 0.63, 0, 0], [4.1, 0.85, 0.62, 0, 0], [4.65, 0.9, 0.63, 0, 0.01], [4.98, 0.9, 0.58, 0, 0], [5.17, 0.78, 0.5, 0, -0.01], [5.3, 0.5, 0.39, 0, -0.01], [5.4, 0.31, 0.31, 0, 0], [5.6, 0.25, 0.26, 0, 0.02],
  ];
  skin(g, body.map(([y, rx, rz, f, cz]) => oval(0, y, cz, rx, rz, SEG, f, 11, y * 0.12)));
  // mũi hia ló ra dưới gấu áo
  g.color(BRONZE);
  for (const s of [-1, 1]) { g.push().move(s * 0.34, 0.12, 1.06).scale(1, 0.5, 1.5); g.ball(0, 0.18, 0, 0.2, 8, 4); g.pop(); }
  // đai lưng: vòng đai cứng nổi quanh thắt lưng
  g.color(BRONZE_HI);
  skin(g, [[3.42, 0.86, 0.66], [3.46, 0.92, 0.72], [3.68, 0.92, 0.72], [3.72, 0.86, 0.65]].map(([y, rx, rz]) => oval(0, y, 0, rx, rz, 24)));
  // dải tế tất buông từ đai xuống gần gấu áo ở chính giữa thân trước (tấm dày 5 cm, nổi hẳn khỏi nếp áo)
  g.color(BRONZE_HI).shade(0.92);
  const fz = [[3.46, 0.7, 0.23], [3.1, 0.71, 0.24], [2.4, 0.8, 0.26], [1.5, 0.94, 0.28], [0.75, 1.1, 0.3]];   // [y, z mặt áo, nửa rộng]
  for (let i = 0; i < fz.length - 1; i++) {
    const p = fz[i], q = fz[i + 1], zp = p[1] + 0.06, zq = q[1] + 0.06;
    g.quad([-q[2], q[0], zq], [q[2], q[0], zq], [p[2], p[0], zp], [-p[2], p[0], zp]);
    g.quad([-q[2], q[0], zq - 0.12], [-q[2], q[0], zq], [-p[2], p[0], zp], [-p[2], p[0], zp - 0.12]);
    g.quad([q[2], q[0], zq], [q[2], q[0], zq - 0.12], [p[2], p[0], zp - 0.12], [p[2], p[0], zp]);
  }
  { const q = fz[fz.length - 1]; g.quad([-q[2], q[0], q[1] - 0.06], [q[2], q[0], q[1] - 0.06], [q[2], q[0], q[1] + 0.06], [-q[2], q[0], q[1] + 0.06]); }
  // cổ áo giao lĩnh: hai nẹp bắt chéo trước ngực, vạt trái đè lên vạt phải rồi chạy xuống đai
  g.color(BRONZE_HI);
  // mỗi nẹp là một dải rộng 13 cm bám đúng mặt cong của thân (nổi 3,5 cm), cho theo đường tim [x, y]
  const bodyZ = (x, y) => {
    let j = 0; while (j < body.length - 2 && body[j + 1][0] < y) j++;
    const p = body[j], q = body[j + 1], t = Math.min(1, Math.max(0, (y - p[0]) / (q[0] - p[0]))), rx = p[1] + (q[1] - p[1]) * t, rz = p[2] + (q[2] - p[2]) * t;
    return p[4] + (q[4] - p[4]) * t + rz * Math.sqrt(Math.max(0.02, 1 - (x * x) / (rx * rx))) + 0.035;
  };
  const lap = (pts, w = 0.13) => g.ribbon(pts.map(([x, y]) => [x - w / 2, y, bodyZ(x - w / 2, y)]), pts.map(([x, y]) => [x + w / 2, y, bodyZ(x + w / 2, y)]), true);
  lap([[0.2, 5.36], [0.2, 5.2], [0.15, 5.0], [0.03, 4.66]]);
  lap([[-0.2, 5.36], [-0.2, 5.2], [-0.15, 5.0], [-0.02, 4.64], [0.12, 4.38], [0.24, 4.1], [0.34, 3.72]]);

  // ----- tay phải (phía -x): khuỷu gập, cẳng tay đưa ra trước, nắm cuộn Chiếu dời đô ngang ngực -----
  g.color(BRONZE).shade(1.03);
  const rS = [-0.8, 4.98, 0], rE = [-1.03, 3.95, 0.16], rW = [-0.66, 4.2, 0.9];
  const rd = sleeve(g, rS, rE, rW);
  const rh = mad(rW, rd, 0.12); rh[1] += 0.06;
  g.color(BRONZE_HI);
  g.push().move(rh[0], rh[1], rh[2]).scale(0.92, 1.05, 1.1); g.ball(0, 0, 0, 0.2, 8, 5); g.pop();              // nắm tay
  g.tube([rh[0] + 0.1, rh[1] - 0.06, rh[2] + 0.1], [rh[0] + 0.14, rh[1] + 0.14, rh[2] + 0.2], 0.06, 5, 0.045);   // ngón cái ôm cuộn chiếu
  // cuộn chiếu: nằm chếch trong nắm tay, hai đầu trục nhô ra
  const ax = unit([0.42, 0.88, 0.06]), sc = [rh[0] + 0.03, rh[1], rh[2] + 0.13], sa = mad(sc, ax, -0.5), sb = mad(sc, ax, 0.62);
  g.color(0x6e5a30).gloss(0.55);
  g.tube(sa, sb, 0.115, 8);
  g.color(0x7d6836);
  const sa0 = mad(sa, ax, -0.09), sb1 = mad(sb, ax, 0.09);
  g.tube(sa0, sa, 0.14, 8); g.tube(sb, sb1, 0.14, 8);
  const ringAt = (c, r, flip) => { const e1 = unit(cross(ax, [0, 0, 1])), e2 = cross(ax, e1), o = []; for (let i = 0; i <= 8; i++) { const a = ((flip ? -i : i) / 8) * Math.PI * 2; o.push([c[0] + (e1[0] * Math.cos(a) + e2[0] * Math.sin(a)) * r, c[1] + (e1[1] * Math.cos(a) + e2[1] * Math.sin(a)) * r, c[2] + (e1[2] * Math.cos(a) + e2[2] * Math.sin(a)) * r]); } return o; };
  fan(g, ringAt(sb1, 0.14, false), sb1); fan(g, ringAt(sa0, 0.14, true), sa0);
  fan(g, ringAt(sb, 0.14, true), sb); fan(g, ringAt(sa, 0.14, false), sa);
  g.gloss(0.4);

  // ----- tay trái (phía +x): cánh tay đưa chếch ra trước, bàn tay ngửa nhẹ, ngón trỏ chỉ xuống đất -----
  g.color(BRONZE).shade(1.03);
  const lS = [0.8, 4.98, 0], lE = [1.02, 4.0, 0.2], lW = [1.06, 3.52, 0.98];
  const ld = sleeve(g, lS, lE, lW);
  const lh = mad(lW, ld, 0.14); lh[1] += 0.04;
  g.color(BRONZE_HI);
  g.push().move(lh[0], lh[1], lh[2]).scale(0.95, 0.62, 1.15); g.ball(0, 0, 0, 0.2, 8, 5); g.pop();                 // mu bàn tay
  const kn = [lh[0] - 0.04, lh[1] - 0.03, lh[2] + 0.2], tip = [kn[0] - 0.02, kn[1] - 0.3, kn[2] + 0.24];
  g.tube(kn, tip, 0.065, 6, 0.045); g.ball(tip[0], tip[1], tip[2], 0.045, 5, 3);                                     // ngón trỏ
  g.push().move(lh[0] + 0.07, lh[1] - 0.1, lh[2] + 0.15).scale(1.1, 0.8, 0.9); g.ball(0, 0, 0, 0.11, 6, 4); g.pop(); // ba ngón co lại
  g.tube([lh[0] - 0.15, lh[1] - 0.02, lh[2] + 0.02], [lh[0] - 0.2, lh[1] - 0.1, lh[2] + 0.2], 0.055, 5, 0.04);       // ngón cái

  // ----- đầu: lưới 24 múi, các nét mặt đắp ngay trên lưới (sống mũi, hốc mắt, gờ mày, gò má, cằm) để chuyển khối mềm như tượng đúc -----
  g.color(BRONZE_HI);
  const HS = 24, FR = 18;   // FR: cột chính giữa mặt (hướng +z)
  // [y, rx, rz, tâm z, {khoảng cách cột tới giữa mặt: độ đắp nổi (+) hay ấn lõm (-)}]
  const head = [[5.46, 0.1, 0.12, 0.17, {}], [5.54, 0.23, 0.25, 0.1, { 0: 0.02 }], [5.64, 0.3, 0.33, 0.06, { 0: 0.03, 1: 0.01 }], [5.73, 0.335, 0.37, 0.04, { 0: -0.012, 1: -0.012 }],
    [5.8, 0.355, 0.39, 0.03, { 0: 0.2, 1: 0.05 }], [5.9, 0.37, 0.405, 0.02, { 0: 0.135, 1: 0.012, 2: 0.014, 3: 0.016 }], [6.0, 0.375, 0.42, 0, { 0: 0.06, 1: -0.02, 2: -0.04, 3: -0.016 }],
    [6.08, 0.375, 0.42, 0, { 0: 0.02, 1: 0.026, 2: 0.03, 3: 0.02 }], [6.17, 0.365, 0.415, -0.01, {}], [6.26, 0.34, 0.39, -0.02, {}]];
  const HR = head.map(([y, rx, rz, cz, f]) => oval(0, y, cz, rx, rz, HS).map((p, i) => { const da = Math.min(Math.abs((i % HS) - FR), HS - Math.abs((i % HS) - FR)), k = 1 + (f[da] || 0) / 0.4; return [p[0] * k, y, cz + (p[2] - cz) * k]; }));
  skin(g, HR);
  fan(g, HR[0].slice().reverse(), [0, 5.44, 0.17]);
  for (const s of [-1, 1]) { g.push().move(s * 0.375, 5.9, 0.0).scale(0.4, 1, 0.65); g.ball(0, 0, 0, 0.13, 6, 4); g.pop(); }   // tai
  // mắt: hai hình hạt nhân sẫm đặt trong hốc mắt (nổi 2,5 cm trên đáy hốc, tức ngang mặt má)
  g.color(BRONZE_LO).shade(0.62);
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const out = (p) => { const l = Math.hypot(p[0], p[2]) || 1; return [p[0] + (p[0] / l) * 0.025, p[1], p[2] + (p[2] / l) * 0.025]; };
  for (const s of [-1, 1]) {
    const c = (d) => FR + s * d, inner = out(mix(HR[6][c(1)], HR[6][c(2)], 0.25)), outer = out(mix(HR[6][c(2)], HR[6][c(3)], 0.55));
    const up = out(mix(HR[6][c(2)], HR[7][c(2)], 0.42)), dn = out(mix(HR[6][c(2)], HR[5][c(2)], 0.22));
    if (s > 0) { g.tri3(inner, dn, outer); g.tri3(inner, outer, up); } else { g.tri3(inner, outer, dn); g.tri3(inner, up, outer); }
  }
  // râu: ria mép chảy hai bên và chòm râu cằm dẹt, đầu tù, nằm sát ngực
  g.color(BRONZE);
  for (const s of [-1, 1]) { g.tube([s * 0.035, 5.75, 0.44], [s * 0.15, 5.7, 0.41], 0.03, 5); g.tube([s * 0.15, 5.7, 0.41], [s * 0.2, 5.6, 0.35], 0.03, 5, 0.012); }
  const BR = [[5.62, 0.16, 0.09, 0.3], [5.5, 0.19, 0.1, 0.355], [5.36, 0.15, 0.085, 0.43], [5.22, 0.09, 0.06, 0.5], [5.13, 0.035, 0.03, 0.54]].reverse().map(([y, rx, rz, cz]) => oval(0, y, cz, rx, rz, 10));
  skin(g, BR); fan(g, BR[0].slice().reverse(), [0, 5.11, 0.545]);
  // dải mũ buông sau gáy
  g.color(BRONZE).shade(0.9);
  for (const s of [-1, 1]) g.quad([s * 0.17 - 0.12, 6.15, -0.47], [s * 0.17 - 0.14, 5.25, -0.5], [s * 0.17 + 0.14, 5.25, -0.5], [s * 0.17 + 0.12, 6.15, -0.47]);

  // ----- mũ bình thiên: thân mũ ôm đầu, trâm cài ngang, tấm «diên» phẳng dài theo chiều trước–sau, hơi chúc về trước -----
  g.color(BRONZE);
  const cap = [[6.1, 0.42, 0.47], [6.13, 0.45, 0.5], [6.25, 0.45, 0.5], [6.28, 0.41, 0.46], [6.54, 0.39, 0.43], [6.6, 0.3, 0.33]].map(([y, rx, rz]) => oval(0, y, -0.01, rx, rz, 16));
  skin(g, cap); fan(g, cap[cap.length - 1], [0, 6.62, -0.01]);
  g.color(BRONZE_HI);
  g.tube([-0.6, 6.4, -0.02], [0.6, 6.4, -0.02], 0.035, 5);
  g.ball(-0.6, 6.4, -0.02, 0.065, 5, 3); g.ball(0.6, 6.4, -0.02, 0.065, 5, 3);
  g.cube(0, 6.58, -0.01, 0.3, 0.11, 0.5, 'xXzZ');
  g.push().move(0, 6.715, -0.02).rotX(0.09);
  g.box(-0.36, -0.03, -0.68, 0.36, 0.03, 0.68);
  g.pop();
  patina(g, from, 0.36);
  g.mat();
}

export function build(g) {
  g.gloss(0).glow(0).sway(0);
  plinth(g);
  // tượng đài được rọi đèn tự động ban đêm như mọi công trình: không tự phát sáng
  pedestal(g, 0.9, 3.3);
  g.push().move(0, 4.2, 0);
  statue(g);
  g.pop();
  g.color(0xffffff).gloss(0).glow(0).sway(0).mat();
}
