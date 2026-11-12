// Mặt đứng nhà Hà Nội vẽ thủ tục: mỗi lớp là một gian × một tầng (nhà ống, cửa hàng, biệt thự Pháp, tập thể...).
// Shader chọn lớp theo từng gian, từng tầng và nhuộm màu vôi theo hạt giống của nhà, nên mỗi nhà một vẻ
// mà toàn bộ nhà của một ô phố vẫn chỉ là một lệnh vẽ.
import * as THREE from 'three';
import { rng } from '../core/util.js';
import { makeCanvas } from './textures.js';
import { SKY_GLSL, skyU } from '../engine/sky.js';
import { L } from './layers.js';
import { PAL, SIGN_COLORS } from './signs.js';

// Kênh alpha là mặt nạ 'kính / trong nhà sáng đèn' (0..1, pha trộn mượt qua mipmap). Lớp cửa hàng thì alpha là
// phần trong nhà hắt sáng ban đêm; lớp khác thì là kính phản chiếu trời. Dải biển hiệu nằm ở vị trí cố định (SIGN_*).
const M_SIGN = 0, M_LIT = 255, M_GLASS = 255;
const PLASTER = '#e9e5dc';

class Pen {
  constructor(S, seed) {
    this.S = S; this.k = S / 512; this.R = rng(seed);
    this.c = makeCanvas(S); this.m = makeCanvas(S);
    this.g = this.c.getContext('2d'); this.mg = this.m.getContext('2d');
    this.mg.fillStyle = '#000'; this.mg.fillRect(0, 0, S, S);
  }
  // toạ độ thiết kế 512×512, gốc ở góc trên trái, y hướng xuống
  rect(x, y, w, h, col, mask) {
    const k = this.k; this.g.fillStyle = col; this.g.fillRect(x * k, y * k, w * k, h * k);
    if (mask !== undefined) { this.mg.fillStyle = `rgb(${mask},${mask},${mask})`; this.mg.fillRect(x * k, y * k, w * k, h * k); }
    return this;
  }
  grad(x, y, w, h, c0, c1, horiz = false) {
    const k = this.k, gr = horiz ? this.g.createLinearGradient(x * k, 0, (x + w) * k, 0) : this.g.createLinearGradient(0, y * k, 0, (y + h) * k);
    gr.addColorStop(0, c0); gr.addColorStop(1, c1); this.g.fillStyle = gr; this.g.fillRect(x * k, y * k, w * k, h * k); return this;
  }
  line(x0, y0, x1, y1, col, w = 2) { const k = this.k, g = this.g; g.strokeStyle = col; g.lineWidth = w * k; g.beginPath(); g.moveTo(x0 * k, y0 * k); g.lineTo(x1 * k, y1 * k); g.stroke(); return this; }
  noise(x, y, w, h, n, cols, r0 = 0.6, r1 = 2, alpha = 0.5) {
    const k = this.k, g = this.g, R = this.R;
    for (let i = 0; i < n; i++) { g.globalAlpha = alpha * (0.3 + R() * 0.7); g.fillStyle = cols[(R() * cols.length) | 0]; const r = (r0 + R() * (r1 - r0)) * k; g.beginPath(); g.arc((x + R() * w) * k, (y + R() * h) * k, r, 0, 7); g.fill(); }
    g.globalAlpha = 1; return this;
  }
  // vệt nước mưa chảy từ (x,y) xuống
  streak(x, y, len, w = 10, a = 0.22) {
    const k = this.k, g = this.g, gr = g.createLinearGradient(0, y * k, 0, (y + len) * k);
    gr.addColorStop(0, `rgba(60,58,48,${a})`); gr.addColorStop(1, 'rgba(60,58,48,0)'); g.fillStyle = gr; g.fillRect((x - w / 2) * k, y * k, w * k, len * k); return this;
  }
  text(s, x, y, size, col, font = 'bold', align = 'center') { const g = this.g; g.font = `${font} ${size * this.k}px "Be Vietnam Pro", Arial, sans-serif`; g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = col; g.fillText(s, x * this.k, y * this.k); return this; }

  // ----- cấu kiện -----
  plaster(col = PLASTER) {
    this.rect(0, 0, 512, 512, col);
    this.noise(0, 0, 512, 512, 900, ['#d9d5cb', '#f2efe8', '#cfcbc0'], 0.6, 2.2, 0.35);
    this.noise(0, 0, 512, 512, 10, ['#c9c5b8'], 14, 46, 0.12);
    return this;
  }
  floorLine(col = '#cfcabd') { this.rect(0, 496, 512, 16, col).rect(0, 494, 512, 3, 'rgba(0,0,0,0.25)'); return this; }
  // cửa sổ kính có khung; shutters: màu cánh chớp mở sang hai bên (hoặc null)
  window(x, y, w, h, { frame = '#f4f1ea', glass = '#1f2a33', bars = 2, rows = 2, shutters = null, grille = false, sill = true } = {}) {
    const f = 7;
    this.rect(x - f, y - f, w + 2 * f, h + 2 * f, frame);
    this.rect(x, y, w, h, glass, M_GLASS);
    this.grad(x, y, w, h * 0.5, 'rgba(160,190,210,0.28)', 'rgba(160,190,210,0)');
    for (let i = 1; i < bars; i++) this.rect(x + (w * i) / bars - 2, y, 4, h, frame, 0);
    for (let j = 1; j < rows; j++) this.rect(x, y + (h * j) / rows - 2, w, 4, frame, 0);
    if (grille) { for (let i = 0; i <= 6; i++) this.rect(x + (w * i) / 6 - 1, y, 2, h, '#2d3136', 0); for (let j = 1; j < 4; j++) this.rect(x, y + (h * j) / 4 - 1, w, 2, '#2d3136', 0); }
    if (shutters) for (const sx of [x - f - w * 0.46, x + w + f]) this.louver(sx, y - f + 2, w * 0.46, h + 2 * f - 4, shutters);
    if (sill) { this.rect(x - f - 6, y + h + f, w + 2 * f + 12, 8, '#d8d4c8'); this.rect(x - f - 6, y + h + f + 8, w + 2 * f + 12, 3, 'rgba(0,0,0,0.22)'); this.streak(x + w * 0.2, y + h + f + 10, 70, 8, 0.16).streak(x + w * 0.8, y + h + f + 10, 54, 7, 0.14); }
    return this;
  }
  louver(x, y, w, h, col) {
    this.rect(x, y, w, h, col, 0);
    for (let j = y + 6; j < y + h - 4; j += 9) this.rect(x + 4, j, w - 8, 3, 'rgba(0,0,0,0.3)');
    this.rect(x, y, w, 3, 'rgba(255,255,255,0.15)').rect(x, y, 2, h, 'rgba(0,0,0,0.25)').rect(x + w - 2, y, 2, h, 'rgba(0,0,0,0.25)');
    return this;
  }
  // ban công: sàn đua ra và lan can
  balcony(y, h, kind = 'iron', col = '#2b2f33', x = 26, w = 460) {
    this.rect(x - 8, y + h, w + 16, 16, '#cdc8bb').rect(x - 8, y + h + 16, w + 16, 9, 'rgba(0,0,0,0.38)');
    this.streak(x + 30, y + h + 24, 60, 14, 0.18).streak(x + w - 60, y + h + 24, 46, 12, 0.16);
    if (kind === 'iron') { for (let i = 0; i <= 26; i++) this.rect(x + (w * i) / 26 - 1.5, y, 3, h, col); this.rect(x, y, w, 6, col).rect(x, y + h * 0.55, w, 3, col).rect(x, y + h - 5, w, 5, col); }
    else if (kind === 'inox') { for (let j = 0; j < 4; j++) this.rect(x, y + (h * j) / 4, w, 5, '#b9bfc4'); for (let i = 0; i <= 4; i++) this.rect(x + (w * i) / 4 - 3, y, 6, h, '#aeb4b9'); }
    else if (kind === 'glass') { this.rect(x, y + 6, w, h - 6, 'rgba(120,160,170,0.55)'); this.rect(x, y, w, 7, '#b9bfc4'); }
    else if (kind === 'wood') { for (let i = 0; i <= 20; i++) this.rect(x + (w * i) / 20 - 3, y + 6, 6, h - 6, col); this.rect(x, y, w, 9, col).rect(x, y + h - 8, w, 8, col).rect(x, y + 9, w, 3, 'rgba(0,0,0,0.3)'); }
    else if (kind === 'baluster') { // con tiện sứ trắng: thân phình giữa, tay vịn xây
      this.rect(x, y, w, h, '#3d4246');
      for (let i = 0; i < 15; i++) { const cx = x + 16 + ((w - 32) * i) / 14; this.rect(cx - 5, y + 10, 10, h - 14, '#eeeae0'); this.rect(cx - 9, y + h * 0.42, 18, h * 0.3, '#f4f1e8'); this.rect(cx - 9, y + h * 0.72, 18, 3, 'rgba(0,0,0,0.2)'); }
      this.rect(x - 4, y - 2, w + 8, 13, '#e9e5da').rect(x - 4, y + 11, w + 8, 3, 'rgba(0,0,0,0.25)');
    }
    else { this.rect(x, y, w, h, '#d9d4c6'); for (let i = 0; i < 14; i++) this.rect(x + 14 + (w - 28) * (i / 13) - 7, y + 14, 14, h - 28, 'rgba(0,0,0,0.3)'); this.rect(x, y, w, 9, '#e6e1d4'); }
    return this;
  }
  // ô cửa đầu vòm bán nguyệt: tâm cx, rộng w, đỉnh vòm yTop, chân yBot
  arch(cx, w, yTop, yBot, col, mask) {
    const k = this.k, r = w / 2;
    for (const [gg, c] of [[this.g, col], [this.mg, mask === undefined ? null : `rgb(${mask},${mask},${mask})`]]) {
      if (!c) continue; gg.fillStyle = c; gg.beginPath(); gg.moveTo((cx - r) * k, yBot * k); gg.lineTo((cx - r) * k, (yTop + r) * k); gg.arc(cx * k, (yTop + r) * k, r * k, Math.PI, 0); gg.lineTo((cx + r) * k, yBot * k); gg.fill();
    }
    return this;
  }
  plant(x, y, s = 1) { const g = this.g, k = this.k, R = this.R; this.rect(x - 10 * s, y - 14 * s, 20 * s, 14 * s, '#9a5a3c'); for (let i = 0; i < 9; i++) { g.fillStyle = ['#3f7a34', '#2f5f2a', '#55903e'][(R() * 3) | 0]; g.beginPath(); g.arc((x + (R() - 0.5) * 30 * s) * k, (y - 20 * s - R() * 26 * s) * k, (7 + R() * 7) * s * k, 0, 7); g.fill(); } return this; }
  ac(x, y) { this.rect(x, y, 66, 44, '#e3e3df').rect(x, y + 44, 66, 4, 'rgba(0,0,0,0.3)'); const g = this.g, k = this.k; g.strokeStyle = '#8f9396'; g.lineWidth = 2 * k; g.beginPath(); g.arc((x + 24) * k, (y + 22) * k, 15 * k, 0, 7); g.stroke(); this.rect(x + 48, y + 8, 12, 28, '#c9c9c4'); this.streak(x + 30, y + 48, 80, 9, 0.2); return this; }
  // dải biển hiệu: nền xám để shader nhuộm màu theo gian. Không vẽ chữ giả: chữ thật nằm trên biển nổi của lưới gần (gen/decor.js),
  // ở xa dải này chỉ còn là một băng màu có viền.
  sign(x, y, w, h) {
    this.rect(x, y, w, h, '#b4b4b4', M_SIGN).rect(x, y, w, 4, '#e6e6e6', M_SIGN).rect(x, y + h - 4, w, 4, '#8a8a8a', M_SIGN);
    this.rect(x + 9, y + 11, w - 18, 2, '#d6d6d6', M_SIGN).rect(x + 9, y + h - 13, w - 18, 2, '#d6d6d6', M_SIGN).rect(x + 9, y + 11, 2, h - 24, '#d6d6d6', M_SIGN).rect(x + w - 11, y + 11, 2, h - 24, '#d6d6d6', M_SIGN);
    this.rect(x, y + h, w, 6, 'rgba(0,0,0,0.35)');
    return this;
  }
  rollBox(y) { this.rect(30, y, 452, 26, '#8d9499').rect(30, y + 26, 452, 4, 'rgba(0,0,0,0.4)'); return this; }
  step() { this.rect(0, 492, 512, 20, '#a9a79f').rect(0, 490, 512, 3, 'rgba(0,0,0,0.3)'); return this; }
  dirtBase() { this.grad(0, 400, 512, 112, 'rgba(70,64,50,0)', 'rgba(70,64,50,0.34)'); return this; }
}

export function facadeLayers(S = 512) {
  const out = [], masks = [];
  const add = (seed, fn) => { const p = new Pen(S, seed); fn(p); out.push(p.c); masks.push(p.m); };
  const GREEN = '#3f6a4c', GREEN_FR = '#2f5d3a', BROWN = '#6b4a30', WOOD = '#4b3322', WOOD2 = '#5e4230';

  // ---- 0..5 tầng trên nhà ống ----
  add(1, (p) => { // ban công sắt, cửa gỗ chớp
    p.plaster().floorLine();
    p.rect(176, 110, 160, 300, '#f1ede4'); p.louver(184, 150, 70, 260, GREEN).louver(258, 150, 70, 260, GREEN);
    p.rect(184, 118, 144, 26, '#22303a', M_GLASS).rect(254, 118, 4, 26, '#f1ede4', 0);
    p.window(60, 190, 70, 120, { bars: 2, rows: 2, grille: true });
    p.balcony(330, 104, 'iron'); p.plant(80, 432, 0.9).plant(430, 432, 1.1); p.rect(0, 60, 512, 10, '#d9d5c9').rect(0, 70, 512, 3, 'rgba(0,0,0,0.18)');
  });
  add(2, (p) => { // hai cửa sổ cao, cánh chớp mở
    p.plaster().floorLine();
    p.window(98, 120, 96, 270, { shutters: GREEN, bars: 2, rows: 3 }); p.window(318, 120, 96, 270, { shutters: GREEN, bars: 2, rows: 3 });
    p.rect(0, 56, 512, 14, '#dcd8cc').rect(0, 70, 512, 4, 'rgba(0,0,0,0.2)'); p.streak(250, 74, 120, 16, 0.14);
  });
  add(3, (p) => { // nhà mới: cửa kính nhôm, lan can inox, cục nóng điều hoà
    p.plaster('#ece9e2').floorLine('#d4d0c6');
    p.rect(70, 96, 372, 320, '#dfe3e6'); p.rect(78, 104, 356, 304, '#27343d', M_GLASS); p.grad(78, 104, 356, 150, 'rgba(170,200,215,0.32)', 'rgba(170,200,215,0)');
    for (const x of [164, 254, 344]) p.rect(x, 104, 5, 304, '#dfe3e6', 0); p.rect(78, 160, 356, 5, '#dfe3e6', 0);
    p.balcony(330, 96, 'inox'); p.ac(440, 60);
  });
  add(4, (p) => { // chuồng cọp: lồng sắt đua ra, quần áo phơi
    p.plaster('#e4e0d4').floorLine();
    p.window(120, 150, 270, 190, { bars: 3, rows: 2, sill: false });
    p.rect(86, 108, 340, 16, '#7f8a92').rect(86, 124, 340, 5, 'rgba(0,0,0,0.3)');
    const cols = ['#c94a4a', '#e9e3d0', '#4a78a8', '#e0b23c', '#6aa07a', '#d98aa8', '#f2f2ee'];
    for (let i = 0; i < 7; i++) p.rect(104 + i * 44, 150 + p.R() * 14, 34, 70 + p.R() * 60, cols[(p.R() * cols.length) | 0]);
    for (let i = 0; i <= 17; i++) p.rect(86 + i * 20 - 1.5, 124, 3, 250, '#5d6a72'); for (let j = 0; j < 5; j++) p.rect(86, 124 + j * 62, 340, 3, '#5d6a72');
    p.rect(80, 374, 352, 12, '#77828a').rect(80, 386, 352, 6, 'rgba(0,0,0,0.3)'); p.streak(150, 392, 90, 16, 0.24).streak(360, 392, 70, 14, 0.2);
    p.ac(20, 250); p.plant(250, 372, 0.8);
  });
  add(5, (p) => { // ốp gạch men, ban công xây
    p.plaster('#e6e3da');
    for (let i = 0; i < 512; i += 32) p.rect(i, 0, 1.5, 512, 'rgba(120,118,108,0.35)'); for (let j = 0; j < 512; j += 16) p.rect(0, j, 512, 1.5, 'rgba(120,118,108,0.3)');
    p.floorLine();
    p.rect(90, 120, 150, 290, '#ece8de'); p.rect(98, 128, 134, 282, '#5b3f2a'); p.rect(104, 136, 58, 150, '#22303a', M_GLASS).rect(168, 136, 58, 150, '#22303a', M_GLASS);
    p.window(300, 160, 130, 150, { bars: 2, rows: 2 });
    p.balcony(330, 100, 'concrete'); p.plant(330, 330, 0.9);
  });
  add(6, (p) => { // tường ngõ: cửa sổ nhỏ có song, mái che tôn, ống nước
    p.plaster('#e2ded2').floorLine();
    p.window(180, 170, 150, 170, { bars: 2, rows: 2, grille: true });
    p.rect(150, 130, 210, 20, '#6f8296').rect(150, 150, 210, 5, 'rgba(0,0,0,0.3)');
    p.rect(440, 0, 12, 512, '#8f958f').rect(452, 0, 3, 512, 'rgba(0,0,0,0.2)');
    p.rect(60, 380, 50, 70, '#c8ccc8').rect(66, 388, 38, 30, '#3a4044'); p.streak(255, 362, 90, 18, 0.2);
    p.line(0, 100, 512, 86, '#22262a', 3).line(0, 112, 512, 104, '#22262a', 2);
  });

  add(7, (p) => { // nhà cổ: tường vôi loang, bốn cánh cửa gỗ lá sách, ban công gỗ hẹp
    p.plaster('#e8e4d8').floorLine('#cfcabc'); p.noise(0, 0, 512, 512, 18, ['#b9b29c', '#a9a48e', '#c4bda6'], 18, 60, 0.26);
    p.rect(0, 34, 512, 20, '#ddd8ca').rect(0, 54, 512, 5, 'rgba(0,0,0,0.25)');
    p.rect(88, 104, 336, 322, '#efebe0');
    p.rect(98, 114, 316, 34, '#241c15', M_GLASS); for (let i = 1; i < 6; i++) p.rect(98 + i * 52.6 - 2, 114, 4, 34, WOOD, 0);
    p.rect(98, 152, 316, 274, '#17110c', M_GLASS);
    p.louver(98, 152, 78, 274, WOOD).louver(178, 152, 62, 274, WOOD2).louver(274, 152, 62, 274, WOOD2).louver(336, 152, 78, 274, WOOD);
    p.balcony(346, 86, 'wood', WOOD);
    p.streak(120, 60, 40, 12, 0.2).streak(300, 60, 36, 10, 0.18).streak(470, 60, 120, 16, 0.2).streak(40, 290, 110, 18, 0.2);
  });
  add(8, (p) => { // nhà thập niên 90: cửa vòm khung nhôm kính màu trà, lan can con tiện, chỉ vữa ngang
    p.plaster('#ebe7de').floorLine('#d6d1c6');
    for (const y of [64, 78]) p.rect(0, y, 512, 4, 'rgba(0,0,0,0.13)');
    p.arch(256, 236, 96, 432, '#f4f1ea').arch(256, 208, 110, 432, '#c3c7ca').arch(256, 196, 116, 432, '#33443f', M_GLASS);
    p.grad(158, 116, 196, 140, 'rgba(175,205,200,0.3)', 'rgba(175,205,200,0)');
    p.rect(158, 214, 196, 6, '#c3c7ca', 0).rect(253, 214, 6, 218, '#c3c7ca', 0).rect(204, 220, 4, 212, '#c3c7ca', 0).rect(304, 220, 4, 212, '#c3c7ca', 0);
    for (let i = 1; i < 4; i++) p.line(256, 214, 256 + Math.cos(Math.PI * (1 - i / 4)) * 98, 214 - Math.sin(Math.PI * (1 - i / 4)) * 98, '#c3c7ca', 4);
    p.window(40, 190, 56, 140, { bars: 1, rows: 2, grille: true }); p.window(416, 190, 56, 140, { bars: 1, rows: 2, grille: true });
    p.balcony(338, 96, 'baluster'); p.streak(90, 462, 34, 12, 0.18).streak(400, 462, 30, 12, 0.16);
  });
  add(9, (p) => { // khách sạn mini, nhà mới xây: cửa kính lớn khung đen, lan can kính, rèm trắng
    p.plaster('#efede8').floorLine('#dad7d0');
    p.rect(0, 0, 54, 512, '#e3e0d8').rect(54, 0, 3, 512, 'rgba(0,0,0,0.12)').rect(458, 0, 54, 512, '#e3e0d8').rect(455, 0, 3, 512, 'rgba(0,0,0,0.12)');
    p.rect(92, 92, 328, 340, '#2b2f33'); p.rect(100, 100, 312, 324, '#1f2a33', M_GLASS); p.grad(100, 100, 312, 150, 'rgba(170,200,215,0.3)', 'rgba(170,200,215,0)');
    p.rect(110, 150, 84, 274, 'rgba(238,232,216,0.5)').rect(330, 150, 74, 274, 'rgba(238,232,216,0.42)');
    p.rect(253, 100, 6, 324, '#2b2f33', 0).rect(100, 144, 312, 5, '#2b2f33', 0);
    p.balcony(340, 94, 'glass'); p.rect(470, 110, 16, 26, '#f6e7b0').rect(468, 104, 20, 6, '#3a3f44'); p.ac(440, 300);
  });
  add(10, (p) => { // nhà cũ cơi nới: cửa sổ gỗ có song sắt, mái che tôn, ống nước, dây điện, giá cây cảnh
    p.plaster('#e0dccf').floorLine('#c9c4b5'); p.noise(0, 0, 512, 512, 24, ['#aaa590', '#b9b49e', '#9a9a84'], 18, 64, 0.28);
    p.louver(84, 184, 62, 202, WOOD).louver(326, 184, 62, 202, WOOD);
    p.window(154, 190, 164, 190, { frame: WOOD2, bars: 2, rows: 2, grille: true });
    p.rect(64, 134, 384, 24, '#6f8296'); for (let i = 64; i < 448; i += 12) p.rect(i, 134, 2, 24, 'rgba(0,0,0,0.18)'); p.rect(64, 158, 384, 6, 'rgba(0,0,0,0.32)');
    p.rect(34, 0, 12, 512, '#8f958f').rect(46, 0, 3, 512, 'rgba(0,0,0,0.2)'); p.ac(416, 56);
    p.rect(140, 400, 196, 8, '#5d6a72').rect(140, 408, 196, 4, 'rgba(0,0,0,0.3)'); p.plant(176, 400, 0.8).plant(240, 400, 1.0).plant(300, 400, 0.75);
    p.line(0, 104, 512, 88, '#22262a', 3).line(0, 116, 512, 108, '#22262a', 2); p.streak(120, 164, 90, 14, 0.2).streak(380, 164, 110, 16, 0.2).streak(250, 412, 70, 16, 0.2);
  });

  // ---- cửa hàng tầng trệt (L.SHOP ...) ----
  const shopBase = (p) => { p.plaster('#dedad0'); p.sign(22, 14, 468, 104); };
  add(11, (p) => { // cửa hàng mở, hàng bày ra
    shopBase(p); p.rollBox(122);
    p.grad(36, 152, 440, 340, '#3a3026', '#15110d'); p.rect(36, 152, 440, 340, 'rgba(0,0,0,0)', M_LIT);
    p.rect(60, 164, 392, 8, '#fff6d8', M_LIT);
    const cols = ['#c94a4a', '#e0b23c', '#4a78a8', '#6aa07a', '#e9e3d0', '#d98aa8', '#8a5ac0', '#f08a3a'];
    for (let r = 0; r < 4; r++) { p.rect(50, 200 + r * 62, 412, 5, '#7a6248', M_LIT); for (let i = 0; i < 14; i++) p.rect(54 + i * 29, 206 + r * 62 - 44 + p.R() * 8, 24, 40 - p.R() * 8, cols[(p.R() * cols.length) | 0], M_LIT); }
    for (let i = 0; i < 6; i++) p.rect(46 + i * 72, 440 + p.R() * 10, 62, 52, cols[(p.R() * cols.length) | 0], M_LIT);
    p.step();
  });
  add(12, (p) => { // cửa cuốn đóng
    shopBase(p); p.rollBox(122);
    p.rect(36, 152, 440, 340, '#8b98a3'); for (let j = 152; j < 492; j += 14) p.rect(36, j, 440, 3, 'rgba(0,0,0,0.22)').rect(36, j + 3, 440, 2, 'rgba(255,255,255,0.14)');
    p.rect(36, 470, 440, 22, '#6f7b85'); p.noise(36, 300, 440, 190, 220, ['#6f6a5a'], 1, 4, 0.25);
    p.step();
  });
  add(13, (p) => { // quán cà phê cửa kính
    shopBase(p);
    p.rect(30, 128, 452, 364, '#5a3d28'); p.grad(44, 142, 250, 336, '#caa56a', '#6b4a2a'); p.rect(44, 142, 250, 336, 'rgba(0,0,0,0)', M_LIT);
    p.grad(316, 142, 152, 350, '#c79b5c', '#5f3f22'); p.rect(316, 142, 152, 350, 'rgba(0,0,0,0)', M_LIT);
    p.rect(166, 142, 6, 336, '#5a3d28', 0).rect(44, 250, 250, 6, '#5a3d28', 0).rect(390, 142, 5, 350, '#5a3d28', 0);
    // quầy pha chế: thân quầy gỗ, máy pha cà phê, hàng cốc; kệ lọ trên tường. Chỉ vẽ khối đặc, không vẽ bàn ghế mảnh (nhìn xa, bóng
    // bàn ghế mảnh trên nền sáng thành một hàng "chữ" giả)
    p.rect(50, 366, 238, 10, '#5a3d28', M_LIT).rect(56, 376, 226, 102, '#3a2a1c', M_LIT).rect(56, 420, 226, 4, '#5a3d28', M_LIT);
    p.rect(78, 318, 54, 48, '#6c7378', M_LIT).rect(86, 326, 38, 14, '#2a2e30', M_LIT).rect(96, 346, 18, 20, '#8a9196', M_LIT);
    for (let i = 0; i < 6; i++) p.rect(176 + i * 20, 350, 13, 16, i % 3 ? '#e9e3d0' : '#c94a4a', M_LIT);
    p.rect(184, 214, 104, 6, '#5a3d28', M_LIT); for (let i = 0; i < 6; i++) p.rect(190 + i * 16, 186 + p.R() * 8, 11, 28 - p.R() * 8, ['#8a5a34', '#d9c9a0', '#6a7a4a', '#a8442e'][(p.R() * 4) | 0], M_LIT);
    p.rect(330, 300, 124, 6, '#5a3d28', M_LIT); for (let i = 0; i < 7; i++) p.rect(334 + i * 17, 268 + p.R() * 8, 12, 32 - p.R() * 8, ['#8a5a34', '#d9c9a0', '#e0b23c', '#a8442e'][(p.R() * 4) | 0], M_LIT);
    p.grad(44, 142, 424, 120, 'rgba(180,205,220,0.25)', 'rgba(180,205,220,0)'); p.plant(26, 500, 1.3).plant(486, 500, 1.2); p.step();
  });
  add(14, (p) => { // quán ăn: quầy kính, nồi nước dùng, ghế nhựa
    shopBase(p); p.rollBox(122);
    p.grad(36, 152, 440, 340, '#4a4034', '#1c1712'); p.rect(36, 152, 440, 340, 'rgba(0,0,0,0)', M_LIT);
    p.rect(70, 162, 372, 8, '#f6f8ff', M_LIT);
    p.rect(50, 330, 190, 162, '#c9ced2', M_LIT).rect(56, 300, 178, 36, 'rgba(190,220,230,0.75)', M_LIT).rect(50, 330, 190, 8, '#eef1f3', M_LIT);
    for (let i = 0; i < 3; i++) { p.rect(70 + i * 56, 306, 40, 26, ['#d9b46a', '#c94a3a', '#7aa05a'][i], M_LIT); }
    p.rect(150, 262, 60, 44, '#9aa0a5', M_LIT).rect(144, 256, 72, 8, '#b9bfc4', M_LIT);
    for (let i = 0; i < 4; i++) { const x = 270 + i * 52; p.rect(x, 448, 34, 8, i % 2 ? '#c8372d' : '#2f6fb0', M_LIT).rect(x + 4, 456, 5, 34, i % 2 ? '#a82c24' : '#265a90', M_LIT).rect(x + 25, 456, 5, 34, i % 2 ? '#a82c24' : '#265a90', M_LIT); }
    p.rect(300, 410, 90, 8, '#d9d9d2', M_LIT).rect(340, 418, 8, 70, '#b0b0aa', M_LIT);
    p.step();
  });
  add(15, (p) => { // cửa xếp sắt
    shopBase(p); p.rollBox(122);
    p.rect(36, 152, 440, 340, '#55626c');
    const g = p.g, k = p.k; g.strokeStyle = '#8a98a4'; g.lineWidth = 2.5 * k;
    for (let i = -8; i < 16; i++) { g.beginPath(); g.moveTo((36 + i * 34) * k, 152 * k); g.lineTo((36 + i * 34 + 170) * k, 492 * k); g.stroke(); g.beginPath(); g.moveTo((36 + i * 34 + 170) * k, 152 * k); g.lineTo((36 + i * 34) * k, 492 * k); g.stroke(); }
    p.rect(0, 152, 36, 340, '#dedad0').rect(476, 152, 36, 340, '#dedad0'); p.rect(36, 152, 440, 8, '#3f4a52').rect(36, 484, 440, 8, '#3f4a52').rect(252, 152, 8, 340, '#3f4a52');
    p.dirtBase().step();
  });
  add(17, (p) => { // cửa hàng mặt kính lớn khung trắng, đèn sáng: kệ hàng sát tường, tủ quầy kính (kim hoàn, đồng hồ, hiệu thuốc, thời trang...).
    // Không vẽ ma-nơ-canh ở đây nữa (hiệu thuốc, tiệm đồng hồ cũng dùng lớp này): cửa hàng quần áo bày ma-nơ-canh ra hè bằng hình nổi (gen/decor.js).
    shopBase(p); p.rect(26, 126, 460, 366, '#f4f4f0');
    p.grad(38, 138, 282, 340, '#f8f1e0', '#cfc0a2'); p.rect(38, 138, 282, 340, 'rgba(0,0,0,0)', M_LIT);
    p.grad(334, 138, 140, 354, '#f1e8d4', '#bbac8e'); p.rect(334, 138, 140, 354, 'rgba(0,0,0,0)', M_LIT);
    const cols = ['#c94a4a', '#e0b23c', '#4a78a8', '#6aa07a', '#2c3e50', '#d98aa8', '#8a5ac0', '#f2f2ee'];
    p.rect(48, 168, 262, 5, '#8a8f94', M_LIT);
    for (let r = 0; r < 3; r++) { p.rect(48, 226 + r * 52, 262, 5, '#8a8f94', M_LIT); for (let i = 0; i < 9; i++) { const h = 26 + p.R() * 14; p.rect(54 + i * 28, 226 + r * 52 - h, 21, h, cols[(p.R() * cols.length) | 0], M_LIT); } }
    p.rect(52, 384, 256, 84, '#b9c9cf', M_LIT).rect(52, 384, 256, 7, '#eef1f3', M_LIT).rect(52, 461, 256, 7, '#8a8f94', M_LIT); for (let i = 1; i < 4; i++) p.rect(52 + i * 64 - 2, 391, 4, 70, '#8a8f94', M_LIT);
    for (let i = 0; i < 8; i++) { const h = 12 + p.R() * 12; p.rect(62 + i * 30, 440 - h, 18, h, cols[(p.R() * cols.length) | 0], M_LIT); }
    p.rect(404, 138, 5, 354, '#f4f4f0', 0).rect(392, 300, 6, 64, '#b9bfc4', M_LIT).rect(415, 300, 6, 64, '#b9bfc4', M_LIT);
    p.grad(38, 138, 436, 110, 'rgba(190,215,230,0.22)', 'rgba(190,215,230,0)'); p.step();
  });
  add(18, (p) => { // sảnh khách sạn mini, văn phòng du lịch: ốp nan gỗ, cửa kính đôi, quầy lễ tân
    shopBase(p); p.rect(26, 126, 460, 366, '#6a5846'); for (let i = 26; i < 486; i += 23) p.rect(i, 126, 3, 366, 'rgba(0,0,0,0.25)');
    p.grad(146, 140, 220, 352, '#f5e6c0', '#b89a66'); p.rect(146, 140, 220, 352, 'rgba(0,0,0,0)', M_LIT);
    p.rect(178, 392, 150, 70, '#7a5230', M_LIT).rect(172, 382, 162, 12, '#4a321e', M_LIT).rect(300, 214, 46, 62, '#fff3c8', M_LIT).rect(196, 330, 26, 54, '#3a4a5a', M_LIT);
    p.rect(253, 140, 6, 352, '#3a2e22', 0).rect(146, 140, 220, 7, '#3a2e22', 0).rect(240, 300, 5, 64, '#d9c27a', M_LIT).rect(267, 300, 5, 64, '#d9c27a', M_LIT);
    p.grad(392, 220, 74, 150, '#e9d9b0', '#a88a5a'); p.rect(392, 220, 74, 150, 'rgba(0,0,0,0)', M_LIT); p.rect(427, 220, 4, 150, '#3a2e22', 0);
    p.grad(146, 140, 220, 100, 'rgba(190,215,230,0.22)', 'rgba(190,215,230,0)'); p.plant(60, 498, 1.4).plant(456, 498, 1.3); p.step();
  });
  add(19, (p) => { // nhà cổ buôn bán: cửa gỗ ván lùa tháo dở, xà gỗ, trong nhà tối có ánh đèn vàng
    shopBase(p); p.rect(30, 122, 452, 16, WOOD).rect(30, 138, 452, 4, 'rgba(0,0,0,0.4)');
    p.grad(36, 142, 440, 350, '#3a2e20', '#120e0a'); p.rect(36, 142, 440, 350, 'rgba(0,0,0,0)', M_LIT);
    p.rect(170, 168, 180, 7, '#fbe9b0', M_LIT);
    const jars = ['#8a5a34', '#b08a52', '#6a7a4a', '#a8442e', '#d9c9a0', '#4a3a2a'];
    for (let r = 0; r < 3; r++) { p.rect(160, 250 + r * 66, 196, 5, '#6a4a30', M_LIT); for (let i = 0; i < 7; i++) p.rect(166 + i * 27, 250 + r * 66 - 30 - p.R() * 12, 20, 30 + p.R() * 12, jars[(p.R() * jars.length) | 0], M_LIT); }
    for (const x of [36, 93, 363, 420]) p.rect(x, 142, 56, 350, WOOD2, 0).rect(x, 142, 3, 350, 'rgba(0,0,0,0.4)').rect(x + 53, 142, 3, 350, 'rgba(0,0,0,0.3)').rect(x + 10, 166, 36, 136, 'rgba(0,0,0,0.17)').rect(x + 10, 322, 36, 150, 'rgba(0,0,0,0.14)');
    p.rect(36, 478, 440, 14, '#3a2a1c', 0); p.dirtBase().step();
  });
  // ---- cửa nhà trong ngõ (L.DOOR) ----
  add(16, (p) => {
    p.plaster('#e2ded2');
    p.rect(60, 150, 170, 342, '#efebe1'); p.rect(70, 160, 72, 332, BROWN).rect(148, 160, 72, 332, BROWN);
    for (const x of [78, 156]) { p.rect(x, 172, 56, 130, 'rgba(0,0,0,0.22)').rect(x, 316, 56, 150, 'rgba(0,0,0,0.18)'); }
    p.rect(138, 320, 8, 30, '#c9a64a');
    p.window(300, 210, 140, 160, { bars: 2, rows: 2, grille: true });
    p.rect(250, 150, 30, 44, '#c8ccc8').rect(254, 154, 22, 20, '#30363a'); p.line(0, 120, 512, 132, '#22262a', 3);
    p.rect(40, 120, 210, 14, '#7c8c9a').rect(40, 134, 210, 5, 'rgba(0,0,0,0.3)');
    p.plant(270, 500, 1.2); p.dirtBase().step();
  });
  // ---- 12, 13 tường trơn (tường hồi, tường giáp ranh) ----
  add(21, (p) => {
    p.plaster('#dcd8cc'); p.noise(0, 0, 512, 512, 26, ['#b9b4a4', '#c9c4b4', '#a9a696'], 20, 70, 0.22);
    for (let i = 0; i < 9; i++) p.streak(p.R() * 512, 0, 180 + p.R() * 300, 10 + p.R() * 26, 0.12 + p.R() * 0.12);
    p.grad(0, 380, 512, 132, 'rgba(60,80,45,0)', 'rgba(60,80,45,0.28)');
    p.text('KHOAN CẮT BÊ TÔNG', 120, 262, 12, 'rgba(30,30,30,0.75)').text('KHOAN CẮT BÊ TÔNG', 388, 300, 11, 'rgba(30,50,110,0.7)').text('KHOAN RÚT LÕI', 250, 330, 11, 'rgba(30,30,30,0.6)').text('THÔNG TẮC CỐNG', 110, 372, 12, 'rgba(120,30,30,0.62)').text('KHOAN CẮT BÊ TÔNG', 400, 398, 12, 'rgba(30,30,30,0.7)').text('HÚT BỂ PHỐT', 262, 420, 11, 'rgba(30,50,110,0.6)');
    p.rect(0, 500, 512, 12, 'rgba(0,0,0,0.12)');
  });
  add(22, (p) => {
    p.rect(0, 0, 512, 512, '#a9a79e'); p.noise(0, 0, 512, 512, 2600, ['#98968d', '#b9b7ae', '#8a887f'], 0.8, 2.6, 0.5); p.noise(0, 0, 512, 512, 18, ['#8f8d84', '#7f7d74'], 20, 70, 0.25);
    for (let i = 0; i < 7; i++) p.streak(p.R() * 512, 0, 200 + p.R() * 300, 12 + p.R() * 22, 0.16);
    p.rect(380, 0, 10, 512, '#7d827d'); p.grad(0, 400, 512, 112, 'rgba(50,70,40,0)', 'rgba(50,70,40,0.3)');
  });
  // ---- 14, 15 biệt thự, nhà phố kiểu Pháp ----
  add(31, (p) => {
    p.plaster().floorLine('#f1eee6');
    p.rect(0, 0, 44, 512, '#f1eee6').rect(468, 0, 44, 512, '#f1eee6').rect(44, 0, 3, 512, 'rgba(0,0,0,0.14)').rect(465, 0, 3, 512, 'rgba(0,0,0,0.14)');
    p.rect(0, 30, 512, 22, '#f4f1ea').rect(0, 52, 512, 5, 'rgba(0,0,0,0.22)');
    p.window(196, 110, 120, 310, { shutters: GREEN_FR, bars: 2, rows: 4, frame: '#f4f1ea' });
    const g = p.g, k = p.k; g.fillStyle = '#f4f1ea'; g.beginPath(); g.ellipse(256 * k, 104 * k, 74 * k, 22 * k, 0, Math.PI, 0); g.fill();
    for (let i = 0; i <= 10; i++) p.rect(176 + i * 16 - 1.5, 400, 3, 46, '#22262a'); p.rect(170, 398, 172, 5, '#22262a').rect(170, 444, 172, 5, '#22262a');
  });
  add(32, (p) => {
    p.plaster();
    for (let j = 300; j < 512; j += 34) p.rect(0, j, 512, 4, 'rgba(0,0,0,0.16)');
    p.rect(0, 0, 512, 24, '#f4f1ea').rect(0, 24, 512, 5, 'rgba(0,0,0,0.2)');
    const g = p.g, k = p.k, mg = p.mg;
    for (const [cx, w] of [[140, 150], [372, 150]]) {
      g.fillStyle = '#f4f1ea'; g.beginPath(); g.ellipse(cx * k, 190 * k, (w / 2 + 12) * k, 84 * k, 0, Math.PI, 0); g.fill(); p.rect(cx - w / 2 - 12, 190, w + 24, 302, '#f4f1ea');
      g.fillStyle = '#1f2a33'; g.beginPath(); g.ellipse(cx * k, 190 * k, (w / 2) * k, 72 * k, 0, Math.PI, 0); g.fill(); mg.fillStyle = '#fff'; mg.beginPath(); mg.ellipse(cx * k, 190 * k, (w / 2) * k, 72 * k, 0, Math.PI, 0); mg.fill();
      p.louver(cx - w / 2, 190, w / 2 - 2, 302, GREEN_FR).louver(cx + 2, 190, w / 2 - 2, 302, GREEN_FR);
    }
    p.dirtBase().step();
  });
  add(33, (p) => { // biệt thự Pháp, biến thể: hai cửa sổ cao cánh chớp khép, phào răng cưa, trụ giả giữa gian
    p.plaster().floorLine('#f1eee6');
    p.rect(0, 26, 512, 26, '#f4f1ea').rect(0, 52, 512, 5, 'rgba(0,0,0,0.22)'); for (let i = 8; i < 512; i += 32) p.rect(i, 57, 16, 10, '#f4f1ea').rect(i, 67, 16, 3, 'rgba(0,0,0,0.18)');
    for (const cx of [140, 372]) {
      p.rect(cx - 62, 112, 124, 320, '#f4f1ea').rect(cx - 72, 98, 144, 15, '#f4f1ea').rect(cx - 72, 113, 144, 4, 'rgba(0,0,0,0.2)');
      p.louver(cx - 52, 124, 50, 298, GREEN_FR).louver(cx + 2, 124, 50, 298, GREEN_FR);
      p.rect(cx - 74, 430, 148, 11, '#e9e5da').rect(cx - 74, 441, 148, 4, 'rgba(0,0,0,0.22)'); p.streak(cx - 30, 446, 46, 8, 0.14);
    }
    p.rect(246, 72, 20, 424, '#f1eee6').rect(266, 72, 3, 424, 'rgba(0,0,0,0.12)');
  });
  // ---- cao ốc (L.MOD, L.MOD_GND) ----
  add(41, (p) => {
    p.rect(0, 0, 512, 512, '#2c4250', M_GLASS); p.grad(0, 0, 512, 512, 'rgba(150,190,210,0.4)', 'rgba(60,90,110,0.1)');
    p.rect(0, 420, 512, 92, '#33434c', 0); for (let i = 0; i <= 4; i++) p.rect(i * 128 - 4, 0, 8, 512, '#59646b', 0); p.rect(0, 0, 512, 7, '#59646b', 0).rect(0, 414, 512, 7, '#59646b', 0);
  });
  add(42, (p) => {
    p.plaster('#dcdcd6'); p.rect(0, 150, 512, 230, '#24323c', M_GLASS); p.grad(0, 150, 512, 120, 'rgba(160,195,215,0.35)', 'rgba(160,195,215,0)');
    for (let i = 0; i <= 4; i++) p.rect(i * 128 - 3, 150, 6, 230, '#c9c9c3', 0); p.rect(0, 144, 512, 8, '#c4c4be').rect(0, 380, 512, 10, '#c4c4be').rect(0, 390, 512, 4, 'rgba(0,0,0,0.22)');
    p.streak(120, 394, 80, 14, 0.14).streak(380, 394, 100, 16, 0.14);
  });
  add(43, (p) => {
    p.rect(0, 0, 512, 512, '#7f7f7a'); p.rect(0, 0, 512, 70, '#9a9a94').rect(0, 70, 512, 8, 'rgba(0,0,0,0.4)');
    p.grad(20, 90, 472, 402, '#c8b88a', '#5a5040'); p.rect(20, 90, 472, 402, 'rgba(0,0,0,0)', M_LIT); p.grad(20, 90, 472, 160, 'rgba(190,215,230,0.3)', 'rgba(190,215,230,0)');
    for (const x of [130, 250, 262, 382]) p.rect(x, 90, 6, 402, '#3a3f44', 0); p.rect(20, 200, 472, 6, '#3a3f44', 0); p.step();
  });
  // ---- 19 khu tập thể ----
  add(51, (p) => {
    p.plaster('#d9d4c2').floorLine('#bdb8a6'); p.noise(0, 0, 512, 512, 22, ['#a9a48f', '#b9b49f'], 18, 60, 0.25);
    p.rect(40, 110, 432, 290, '#3a4044'); p.rect(60, 130, 160, 200, '#243038', M_GLASS).rect(138, 130, 5, 200, '#cfcabb', 0);
    p.rect(250, 130, 110, 250, '#5d4630'); const cols = ['#c94a4a', '#e9e3d0', '#4a78a8', '#e0b23c', '#6aa07a'];
    for (let i = 0; i < 5; i++) p.rect(378 + (i % 3) * 30, 140 + p.R() * 20, 24, 80 + p.R() * 50, cols[(p.R() * 5) | 0]);
    for (let i = 0; i <= 22; i++) p.rect(40 + i * 19.6 - 1.5, 110, 3, 290, '#6f7d86'); for (let j = 0; j <= 4; j++) p.rect(40, 110 + j * 72, 432, 3, '#6f7d86');
    p.rect(30, 398, 452, 14, '#8e99a0').rect(30, 412, 452, 7, 'rgba(0,0,0,0.35)'); p.rect(30, 92, 452, 16, '#7f96a8').rect(30, 108, 452, 5, 'rgba(0,0,0,0.3)');
    for (let i = 0; i < 6; i++) p.streak(60 + i * 80, 418, 70 + p.R() * 30, 16, 0.26);
  });
  // ---- 20, 21 công sở, trường học kiểu thuộc địa ----
  add(61, (p) => {
    p.plaster().floorLine('#f1eee6'); p.rect(0, 40, 512, 16, '#f4f1ea').rect(0, 56, 512, 4, 'rgba(0,0,0,0.2)');
    p.window(70, 130, 110, 250, { shutters: null, bars: 2, rows: 3, frame: GREEN, glass: '#22303a' }); p.window(332, 130, 110, 250, { shutters: null, bars: 2, rows: 3, frame: GREEN, glass: '#22303a' });
    p.rect(250, 60, 12, 440, '#f1eee6').rect(262, 60, 3, 440, 'rgba(0,0,0,0.12)');
  });
  add(62, (p) => {
    p.plaster(); for (let j = 380; j < 512; j += 30) p.rect(0, j, 512, 4, 'rgba(0,0,0,0.14)');
    p.window(70, 130, 110, 230, { bars: 2, rows: 3, frame: GREEN, glass: '#22303a', grille: true }); p.window(332, 130, 110, 230, { bars: 2, rows: 3, frame: GREEN, glass: '#22303a', grille: true });
    p.rect(250, 0, 12, 512, '#f1eee6'); p.dirtBase().step();
  });
  // ---- 22 đình chùa: tường vôi, cửa bức bàn sơn son ----
  add(71, (p) => {
    p.plaster('#e8e2cf'); p.noise(0, 0, 512, 512, 14, ['#b9b29a', '#a8a890'], 20, 60, 0.25);
    p.rect(0, 0, 512, 44, '#5a2f22').rect(0, 44, 512, 6, 'rgba(0,0,0,0.4)');
    p.rect(70, 110, 372, 382, '#3a1f18');
    for (let i = 0; i < 4; i++) { const x = 80 + i * 90; p.rect(x, 120, 82, 372, '#8a2a1e'); p.rect(x + 8, 132, 66, 150, '#5e1c14'); for (let j = 0; j < 7; j++) p.rect(x + 8 + j * 10, 132, 3, 150, '#a8382a'); p.rect(x + 8, 300, 66, 170, '#7a241a').rect(x + 16, 312, 50, 146, '#8f2e22'); }
    p.rect(60, 96, 392, 16, '#6a3a22'); p.rect(20, 110, 40, 382, '#7a2a1e').rect(452, 110, 40, 382, '#7a2a1e');
    p.grad(0, 400, 512, 112, 'rgba(50,70,40,0)', 'rgba(50,70,40,0.25)'); p.step();
  });
  // ---- 23 nhà thờ đá ----
  add(72, (p) => {
    p.rect(0, 0, 512, 512, '#8f8c84'); p.noise(0, 0, 512, 512, 3000, ['#7d7a72', '#a09d95', '#6d6a62'], 0.8, 2.6, 0.5);
    for (let j = 0; j < 512; j += 42) { p.rect(0, j, 512, 3, 'rgba(40,40,36,0.5)'); for (let i = (j / 42) % 2 ? 0 : 48; i < 512; i += 96) p.rect(i, j, 3, 42, 'rgba(40,40,36,0.45)'); }
    const g = p.g, mg = p.mg, k = p.k;
    for (const gg of [g, mg]) { gg.fillStyle = gg === g ? '#1a2230' : '#fff'; gg.beginPath(); gg.moveTo(206 * k, 440 * k); gg.lineTo(206 * k, 200 * k); gg.quadraticCurveTo(206 * k, 110 * k, 256 * k, 80 * k); gg.quadraticCurveTo(306 * k, 110 * k, 306 * k, 200 * k); gg.lineTo(306 * k, 440 * k); gg.fill(); }
    p.rect(253, 100, 6, 340, '#6d6a62', 0).rect(206, 260, 100, 6, '#6d6a62', 0);
    for (let i = 0; i < 8; i++) p.streak(p.R() * 512, 0, 260 + p.R() * 240, 14 + p.R() * 20, 0.2);
  });
  // ---- 24 chợ, nhà ga, kho ----
  add(73, (p) => {
    p.plaster('#d6d1c0'); p.rect(40, 60, 432, 90, '#27333b', M_GLASS); for (let i = 0; i <= 8; i++) p.rect(40 + i * 54 - 2, 60, 4, 90, '#bdb8a8', 0); for (let j = 0; j < 90; j += 12) p.rect(40, 60 + j, 432, 3, 'rgba(200,200,190,0.6)');
    p.rect(110, 220, 292, 272, '#6f7d87'); for (let j = 220; j < 492; j += 16) p.rect(110, j, 292, 3, 'rgba(0,0,0,0.22)');
    p.rect(0, 180, 512, 14, '#bcb7a6').rect(0, 194, 512, 4, 'rgba(0,0,0,0.25)'); p.dirtBase().step();
  });
  // ---- 25 chòi, ki-ốt ----
  add(74, (p) => { p.plaster('#dad6ca'); p.window(280, 170, 150, 140, { bars: 2, rows: 1 }); p.rect(80, 150, 130, 342, '#eeeae0').rect(90, 160, 110, 332, '#4a6a82'); p.rect(0, 30, 512, 18, '#8a949a').rect(0, 48, 512, 5, 'rgba(0,0,0,0.3)'); p.dirtBase().step(); });

  add(44, (p) => { // công sở hiện đại giữa thế kỷ 20: sườn bê tông đứng, băng cửa kính lùi sau (L.RIB)
    p.plaster('#e6e3da'); p.rect(0, 112, 512, 262, '#22303a', M_GLASS); p.grad(0, 112, 512, 120, 'rgba(160,195,215,0.32)', 'rgba(160,195,215,0)');
    p.rect(0, 238, 512, 6, '#cfcbbf', 0).rect(0, 374, 512, 8, '#d4d0c4', 0).rect(0, 382, 512, 4, 'rgba(0,0,0,0.2)', 0);
    for (let i = 0; i < 8; i++) p.rect(i * 64 + 20, 0, 24, 512, '#efece4', 0).rect(i * 64 + 44, 0, 4, 512, 'rgba(0,0,0,0.24)', 0);
    p.floorLine('#d6d2c6');
  });
  // ---- mái (lát liền): L.ROOF + 0 mái bằng, 1 ngói, 2 tôn ----
  add(81, (p) => { // mái bằng bê tông chống nóng
    p.rect(0, 0, 512, 512, '#9c9a92'); p.noise(0, 0, 512, 512, 3400, ['#8b8981', '#adaba3', '#7b7971'], 0.8, 2.6, 0.5); p.noise(0, 0, 512, 512, 30, ['#6f6d62', '#5f6a52'], 16, 60, 0.22);
    for (let i = 0; i < 512; i += 64) { p.rect(i, 0, 2, 512, 'rgba(50,50,46,0.35)').rect(0, i, 512, 2, 'rgba(50,50,46,0.35)'); }
  });
  add(82, (p) => { // ngói ta: các hàng ngói vảy cá, rêu phong
    p.rect(0, 0, 512, 512, '#7a4632');
    const g = p.g, k = p.k, R = p.R;
    for (let j = -1; j < 16; j++) for (let i = -1; i < 16; i++) {
      const x = (i + (j % 2 ? 0.5 : 0)) * 32, y = j * 32, v = R();
      g.fillStyle = `rgb(${114 + v * 44},${60 + v * 22},${44 + v * 16})`; g.beginPath(); g.moveTo(x * k, y * k); g.lineTo((x + 32) * k, y * k); g.lineTo((x + 32) * k, (y + 22) * k); g.quadraticCurveTo((x + 16) * k, (y + 42) * k, x * k, (y + 22) * k); g.fill();
      g.strokeStyle = 'rgba(40,18,12,0.55)'; g.lineWidth = 1.6 * k; g.stroke();
    }
    p.noise(0, 0, 512, 512, 60, ['#4a4a30', '#3a3a2a', '#5a4a36', '#2f2a24'], 14, 54, 0.28);
  });
  add(83, (p) => { // tôn sóng (shader nhuộm xanh, đỏ, ghi)
    p.rect(0, 0, 512, 512, '#d0d0d0');
    for (let i = 0; i < 512; i += 16) { p.grad(i, 0, 8, 512, '#e9e9e9', '#bcbcbc', true); p.grad(i + 8, 0, 8, 512, '#a8a8a8', '#d6d6d6', true); }
    p.noise(0, 0, 512, 512, 26, ['#8a6a4a', '#7a7a7a'], 12, 46, 0.2); for (let j = 0; j < 512; j += 128) p.rect(0, j, 512, 3, 'rgba(0,0,0,0.25)');
  });
  // ---- 29 tường chắn mái: mũ tường ở 27% từ dưới lên ----
  add(84, (p) => {
    p.plaster('#e4e0d6'); const y = 512 - 512 * 0.27;
    p.rect(0, y - 4, 512, 14, '#cfcabd').rect(0, y + 10, 512, 4, 'rgba(0,0,0,0.25)');
    for (let i = 0; i < 9; i++) p.streak(p.R() * 512, y + 12, 60 + p.R() * 70, 10 + p.R() * 16, 0.2);
    p.rect(0, 0, 512, y - 4, '#8a8a84');
  });
  add(91, (p) => { // đá xẻ khối lớn, mạch vữa: tường thành, lễ đài, nhà tù, chân công sở (L.STONE)
    p.rect(0, 0, 512, 512, '#dcd9d0'); p.noise(0, 0, 512, 512, 2200, ['#c9c6bc', '#e8e5dc', '#b9b6ac'], 0.8, 2.4, 0.45); p.noise(0, 0, 512, 512, 16, ['#b0ada2', '#a5a297'], 20, 64, 0.2);
    for (let j = 0; j < 512; j += 64) { p.rect(0, j, 512, 3, 'rgba(60,58,50,0.4)'); for (let i = (j / 64) % 2 ? 0 : 64; i < 512; i += 128) p.rect(i, j, 3, 64, 'rgba(60,58,50,0.36)'); }
    for (let i = 0; i < 6; i++) p.streak(p.R() * 512, 0, 200 + p.R() * 300, 12 + p.R() * 20, 0.14);
  });
  if (out.length !== L.COUNT) throw new Error(`facades: ${out.length} lớp, cần ${L.COUNT}`);
  return { canvases: out, masks };
}

// Gộp canvas màu + mặt nạ thành texture mảng; lật dọc để v = 0 là chân tầng.
export function facadeTexture(S, aniso) {
  const { canvases, masks } = facadeLayers(S), n = canvases.length, data = new Uint8Array(S * S * 4 * n);
  for (let i = 0; i < n; i++) {
    const px = canvases[i].getContext('2d').getImageData(0, 0, S, S).data, mk = masks[i].getContext('2d').getImageData(0, 0, S, S).data, o = i * S * S * 4;
    for (let y = 0; y < S; y++) { const src = (S - 1 - y) * S * 4, dst = o + y * S * 4; for (let x = 0; x < S * 4; x += 4) { data[dst + x] = px[src + x]; data[dst + x + 1] = px[src + x + 1]; data[dst + x + 2] = px[src + x + 2]; data[dst + x + 3] = mk[src + x]; } }
  }
  const t = new THREE.DataArrayTexture(data, S, S, n);
  t.format = THREE.RGBAFormat; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = aniso; t.needsUpdate = true;
  return t;
}

const col = (h) => { const c = new THREE.Color(h); return `vec3(${c.r.toFixed(3)},${c.g.toFixed(3)},${c.b.toFixed(3)})`; };
const palette = (name, list) => `const vec3 ${name}[${list.length}] = vec3[${list.length}](${list.map(col).join(',')});`;

export function facadeMaterial(tex, noise) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, skyU, { uFacade: { value: tex }, uNoise: { value: noise } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec2 aUv; attribute vec4 aFx; attribute vec4 aVar; varying vec2 vFUv; varying vec4 vFx; varying vec4 vVar; varying vec3 vWPos; varying vec3 vWN;`)
      .replace('#include <project_vertex>', `#include <project_vertex>\nvFUv = aUv; vFx = aFx; vVar = aVar; vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        precision highp sampler2DArray;
        uniform sampler2DArray uFacade; uniform sampler2D uNoise;
        varying vec2 vFUv; varying vec4 vFx; varying vec4 vVar; varying vec3 vWPos; varying vec3 vWN;
        ${SKY_GLSL}
        ${palette('PAL', PAL)}
        ${palette('SIGNC', SIGN_COLORS)}`)
      .replace('#include <map_fragment>', `
        float fst = floor(vFx.x + 0.5), fseed = vFx.y, ffl = vFx.z, fflag = floor(vFx.w + 0.5);
        float fage = mod(floor(fflag / 2.0), 4.0) / 3.0;                 // tuổi nhà: 0 mới sơn .. 1 cũ kỹ (gen/buildings.js)
        float fmod = step(13.5, fst) * step(fst, 14.5);                  // cao ốc kính
        vec2 fuv = vFUv; float bay = floor(fuv.x), fl = floor(fuv.y);
        // Đạo hàm lấy từ toạ độ liền mạch vFUv, không từ fuv: fuv bị lật trong gian (fflip), gấp lại ở tường trơn và dời gốc ở tường
        // chắn mái, nên ngay mép gian hai điểm ảnh cạnh nhau lệch cả một ô ảnh; GPU tưởng ảnh bị nén cực mạnh, lấy mức mip thô nhất
        // và vẽ thành một đường kẻ dọc (ngang) ở mỗi mép gian. Mọi lần lấy mẫu dưới đây dùng textureGrad với đạo hàm này.
        vec2 gx = dFdx(vFUv), gy = dFdy(vFUv), wgx = dFdx(vWPos.xz), wgy = dFdy(vWPos.xz);
        bool isRoof = fst < 9.5;
        // Mỗi gian một vẻ dù chung một lớp vẽ: nửa số gian lật trái phải (cửa, cục nóng, ống nước đổi bên). Tường trơn có chữ phun sơn
        // (kiểu 12) và mái thì không lật. Trong lớp cửa hàng không còn chữ nào: bảng, biển thật là hình nổi của lưới gần.
        float fflip = (!isRoof && abs(fst - 12.0) > 0.5) ? step(0.5, fract(fseed * 0.6180339 + 0.31)) : 0.0;
        vec2 tgx = gx, tgy = gy;
        if (fflip > 0.5) { fuv.x = bay + 1.0 - fract(fuv.x); tgx.x = -tgx.x; tgy.x = -tgy.x; }
        float gnd = isRoof ? 0.0 : step(fuv.y, 1.0);
        float layer = floor((gnd > 0.5 ? vVar.y : vVar.x) + 0.5);
        if (!isRoof && fuv.y >= ffl) { layer = ${L.PARAPET}.0; fuv.y -= ffl; }
        // tường trơn: chữ phun sơn, mảng gạch lộ, chân tường ẩm chỉ có ở tầng trệt; các tầng trên chỉ lấy nửa trên (trơn) của lớp
        else if (!isRoof && layer > ${L.BLANK - 0.5} && layer < ${L.BLANK + 1.5} && fuv.y >= 1.0) { fuv.y = fl + 0.53 + fract(fuv.y) * 0.45; tgx.y *= 0.45; tgy.y *= 0.45; }
        vec3 tint = PAL[int(vVar.z + 0.5)];
        // nắng và tone mapping làm bạc màu vôi: đẩy độ no màu lên để vàng ra vàng, xanh ra xanh như ngoài phố
        if (!isRoof) { float tl = dot(tint, vec3(0.3, 0.59, 0.11)); tint = max(vec3(tl) + (tint - vec3(tl)) * 1.85, vec3(0.0)) * 0.9; }
        vec4 tx = textureGrad(uFacade, vec3(fuv, layer), tgx, tgy);
        float shopL = step(${L.SHOP - 0.5}, layer) * step(layer, ${L.SHOP + L.N_SHOP - 0.5}) + step(${L.MOD_GND - 0.5}, layer) * step(layer, ${L.MOD_GND + 0.5});
        vec2 ff = fract(fuv);
        float mk = tx.a, fglass = mk * (1.0 - shopL), flit = mk * shopL;
        float fsign = step(${L.SHOP - 0.5}, layer) * step(layer, ${L.SHOP + L.N_SHOP - 0.5}) * step(0.045, ff.x) * step(ff.x, 0.955) * step(0.772, ff.y) * step(ff.y, 0.971);
        float lum = dot(tx.rgb, vec3(0.3, 0.59, 0.11)), sat = max(tx.r, max(tx.g, tx.b)) - min(tx.r, min(tx.g, tx.b));
        float plast = isRoof ? 1.0 : smoothstep(0.4, 0.62, lum) * (1.0 - smoothstep(0.05, 0.14, sat)) * (1.0 - mk) * (1.0 - fsign);
        vec3 fcol = tx.rgb * mix(vec3(1.0), tint, plast);
        // hàng bày trong cửa hàng: mỗi gian ngả một màu khác (hàng vải, hàng giấy đỏ, hàng nhựa xanh...) để các gian liền nhau không y hệt
        // (lớp hàng bày và lớp tủ kính: món hàng có màu được hoán kênh màu theo gian, nên kệ hàng hai nhà liền nhau không cùng một bảng màu)
        if (shopL > 0.5 && fsign < 0.5) {
          float gh = fract(fseed * 0.7548777 + 0.11), gp = fract(fseed * 0.5698403 + 0.37);
          if (sat > 0.25 && mk > 0.5 && (abs(layer - ${L.S_OPEN}.0) < 0.5 || abs(layer - ${L.S_GLASS}.0) < 0.5)) fcol = gp < 0.34 ? fcol : gp < 0.67 ? fcol.gbr : fcol.brg;
          vec3 gt = gh < 0.25 ? vec3(1.0, 0.86, 0.7) : gh < 0.5 ? vec3(0.78, 0.92, 1.0) : gh < 0.75 ? vec3(1.0, 0.76, 0.76) : vec3(0.86, 1.0, 0.8); fcol *= mix(vec3(1.0), gt, mk * 0.75);
        }
        fcol = mix(fcol, tx.rgb * SIGNC[int(vVar.w + 0.5)] * 1.5, fsign);
        // Mảng vữa bong lộ gạch: chỉ ở nhà cũ (tuổi từ 2), vị trí và hình dạng lấy từ nhiễu theo hạt giống của từng gian nên hai nhà
        // liền kề không bao giờ có cùng một mảng; một phần nhà cũ không có mảng nào. Ở xa hoa văn gạch hoà về màu gạch trung bình.
        // (Mẫu nhiễu và đạo hàm lấy ngoài nhánh rẽ để mức mip luôn xác định trên mọi GPU.)
        float bsd = fract(fseed * 0.3183099 + 0.07);
        float bn = textureGrad(uNoise, vec2(fuv.x * 0.21 + fseed * 0.613, fuv.y * 0.17 + bsd * 3.7), tgx * vec2(0.21, 0.17), tgy * vec2(0.21, 0.17)).r * 0.75 + textureGrad(uNoise, vec2(fuv.x * 0.83 - bsd, fuv.y * 0.71 + fseed * 0.37), tgx * vec2(0.83, 0.71), tgy * vec2(0.83, 0.71)).g * 0.25;
        vec2 bq = vec2(fuv.x * 17.0, fuv.y * 44.0); float bfade = clamp(1.0 - (abs(tgx.y) + abs(tgy.y)) * 44.0 * 1.2, 0.0, 1.0);
        if (!isRoof && fage > 0.6 && fst < 12.5) {
          float bthr = mix(0.63, 0.74, bsd) + 0.1 * smoothstep(1.4, 3.0, fuv.y);
          float bm = smoothstep(bthr, bthr + 0.012, bn) * plast * step(0.3, bsd);
          bq.x += step(1.0, mod(bq.y, 2.0)) * 0.5;
          vec2 bf = fract(bq);
          float bmort = max(step(bf.x, 0.07), step(bf.y, 0.16)) * bfade;
          vec3 bcol = mix(vec3(0.3, 0.1, 0.06) * (0.8 + 0.4 * hash12(floor(bq) + fseed)), vec3(0.5, 0.46, 0.38), bmort * 0.85);
          fcol = mix(fcol, bcol, bm); fcol *= 1.0 - 0.3 * smoothstep(bthr - 0.03, bthr, bn) * (1.0 - bm) * plast;
        }
        // loang ố, rêu mốc: nhiễu tần số thấp theo toạ độ tường; nhà càng cũ càng loang, càng nhiều vệt nước mưa chảy dọc
        vec2 nuv = isRoof ? vWPos.xz * 0.035 : vec2(fuv.x * 0.27 + fseed * 0.37, fuv.y * 0.19 + fseed * 0.11);
        vec3 ns = textureGrad(uNoise, nuv, isRoof ? wgx * 0.035 : tgx * vec2(0.27, 0.19), isRoof ? wgy * 0.035 : tgy * vec2(0.27, 0.19)).rgb;
        float wall = isRoof ? 0.0 : (1.0 - mk) * (1.0 - fsign);
        fcol *= mix(0.92 + 0.18 * ns.r, 0.66 + 0.52 * ns.r, isRoof ? 0.6 : 0.2 + 0.8 * fage) * mix(1.0, 0.72 + 0.28 * smoothstep(0.0, 0.22, fuv.y), gnd);
        float rain = textureGrad(uNoise, vec2(fuv.x * 1.9 + fseed * 0.71, fuv.y * 0.045 + fseed * 0.05), tgx * vec2(1.9, 0.045), tgy * vec2(1.9, 0.045)).g;
        fcol *= 1.0 - wall * fage * 0.34 * smoothstep(0.52, 0.8, rain) * (1.0 - gnd * 0.6);
        fcol = mix(fcol, fcol * vec3(0.7, 0.76, 0.58), smoothstep(0.66 - 0.22 * fage, 0.92 - 0.1 * fage, ns.b) * (0.25 + 0.3 * fage) * (1.0 - fglass));
        vec3 gtint = mix(vec3(1.0), tint, fmod * step(layer, ${L.MOD + 0.5}));  // chỉ lớp toàn kính mới nhuộm màu kính theo toà nhà
        fcol = mix(fcol, vec3(0.02, 0.035, 0.05) * mix(vec3(1.0), gtint * 1.5, 0.85), fglass * 0.5);
        diffuseColor.rgb *= fcol;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // cửa sổ sáng đèn: khoảng một nửa số ô ở nhà dân, một phần ba ở cao ốc; pha đèn vàng ấm, đèn tuýp trắng xanh, ánh ti vi
        float wr = hash12(vec2(bay * 7.0 + fl * 13.0, fseed)), wc = hash12(vec2(fl * 5.0 + bay * 3.0 + 3.0, fseed + 7.0));
        float won = step(mix(0.46, 0.64, fmod), wr);
        vec3 warm = wc < 0.46 ? vec3(1.0, 0.7, 0.38) : wc < 0.68 ? vec3(1.0, 0.86, 0.6) : wc < 0.93 ? vec3(0.76, 0.92, 1.0) : vec3(0.42, 0.58, 1.0);
        warm = mix(warm, vec3(0.86, 0.94, 1.0), fmod * 0.7);
        float wbr = 0.4 + 0.9 * fract(wr * 37.0);
        totalEmissiveRadiance += (fglass * won * warm * wbr * (0.42 + 1.3 * tx.rgb) * (0.75 + 0.5 * ff.y) + flit * tx.rgb * 0.9 + fsign * fcol * 0.5) * uLit;`)
      .replace('#include <opaque_fragment>', `
        { vec3 V = normalize(vWPos - cameraPosition); vec3 Rf = reflect(V, normalize(vWN));
          float fr = 0.06 + 0.94 * pow(clamp(1.0 - dot(-V, normalize(vWN)), 0.0, 1.0), 4.0);
          outgoingLight = mix(outgoingLight, skyColor(Rf) * mix(vec3(1.0), gtint * 1.25, 0.8) + outgoingLight * 0.3, fglass * fr * mix(0.85, 1.0, fmod) * (1.0 - uLit * won * 0.7)); }
        #include <opaque_fragment>`);
  };
  return mat;
}
