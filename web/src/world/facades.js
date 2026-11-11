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
    else { this.rect(x, y, w, h, '#d9d4c6'); for (let i = 0; i < 14; i++) this.rect(x + 14 + (w - 28) * (i / 13) - 7, y + 14, 14, h - 28, 'rgba(0,0,0,0.3)'); this.rect(x, y, w, 9, '#e6e1d4'); }
    return this;
  }
  plant(x, y, s = 1) { const g = this.g, k = this.k, R = this.R; this.rect(x - 10 * s, y - 14 * s, 20 * s, 14 * s, '#9a5a3c'); for (let i = 0; i < 9; i++) { g.fillStyle = ['#3f7a34', '#2f5f2a', '#55903e'][(R() * 3) | 0]; g.beginPath(); g.arc((x + (R() - 0.5) * 30 * s) * k, (y - 20 * s - R() * 26 * s) * k, (7 + R() * 7) * s * k, 0, 7); g.fill(); } return this; }
  ac(x, y) { this.rect(x, y, 66, 44, '#e3e3df').rect(x, y + 44, 66, 4, 'rgba(0,0,0,0.3)'); const g = this.g, k = this.k; g.strokeStyle = '#8f9396'; g.lineWidth = 2 * k; g.beginPath(); g.arc((x + 24) * k, (y + 22) * k, 15 * k, 0, 7); g.stroke(); this.rect(x + 48, y + 8, 12, 28, '#c9c9c4'); this.streak(x + 30, y + 48, 80, 9, 0.2); return this; }
  // biển hiệu: nền xám (shader nhuộm màu theo gian), chữ giả bằng các nét sáng
  sign(x, y, w, h) {
    this.rect(x, y, w, h, '#b4b4b4', M_SIGN).rect(x, y, w, 4, '#e6e6e6', M_SIGN).rect(x, y + h - 4, w, 4, '#8a8a8a', M_SIGN);
    const R = this.R; let cx = x + 22; const big = h * 0.42;
    while (cx < x + w - 40) { const cw = 12 + R() * 22; this.rect(cx, y + h * 0.24, cw, big, '#ffffff', M_SIGN); cx += cw + 6 + (R() < 0.22 ? 16 : 0); }
    cx = x + 40; while (cx < x + w - 60) { const cw = 8 + R() * 30; this.rect(cx, y + h * 0.76, cw, h * 0.1, '#f0f0f0', M_SIGN); cx += cw + 7; }
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
  const GREEN = '#3f6a4c', BROWN = '#6b4a30', TEAL = '#2f6f78', BLUE = '#4a78a8';

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

  // ---- 6..10 cửa hàng tầng trệt ----
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
    p.rect(120, 250, 110, 64, '#f2f2ea').text('CHO THUÊ', 175, 274, 20, '#c0392b').text('CỬA HÀNG', 175, 298, 17, '#2c3e50');
    p.step();
  });
  add(13, (p) => { // quán cà phê cửa kính
    shopBase(p);
    p.rect(30, 128, 452, 364, '#5a3d28'); p.grad(44, 142, 250, 336, '#caa56a', '#6b4a2a'); p.rect(44, 142, 250, 336, 'rgba(0,0,0,0)', M_LIT);
    p.grad(316, 142, 152, 350, '#c79b5c', '#5f3f22'); p.rect(316, 142, 152, 350, 'rgba(0,0,0,0)', M_LIT);
    p.rect(166, 142, 6, 336, '#5a3d28', 0).rect(44, 250, 250, 6, '#5a3d28', 0).rect(390, 142, 5, 350, '#5a3d28', 0);
    p.rect(70, 330, 60, 8, '#3a2a1c', M_LIT).rect(96, 338, 8, 60, '#3a2a1c', M_LIT).rect(196, 320, 70, 8, '#3a2a1c', M_LIT).rect(226, 328, 8, 70, '#3a2a1c', M_LIT);
    p.rect(60, 160, 90, 60, '#2b2b2b', M_LIT).text('CÀ PHÊ', 105, 182, 17, '#f4e8c8').text('TRỨNG', 105, 204, 15, '#f4e8c8');
    p.grad(44, 142, 424, 120, 'rgba(180,205,220,0.25)', 'rgba(180,205,220,0)'); p.plant(26, 500, 1.3).plant(486, 500, 1.2); p.step();
  });
  add(14, (p) => { // quán ăn: quầy kính, nồi nước dùng, ghế nhựa
    shopBase(p); p.rollBox(122);
    p.grad(36, 152, 440, 340, '#4a4034', '#1c1712'); p.rect(36, 152, 440, 340, 'rgba(0,0,0,0)', M_LIT);
    p.rect(70, 162, 372, 8, '#f6f8ff', M_LIT);
    p.rect(250, 200, 180, 70, '#e8e2cf', M_LIT).text('PHỞ BÒ', 340, 224, 22, '#b3261e').text('BÚN CHẢ', 340, 252, 19, '#b3261e');
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
  // ---- 11 cửa nhà trong ngõ ----
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
    p.text('KHOAN CẮT BÊ TÔNG', 150, 300, 22, 'rgba(30,30,30,0.72)').text('KHOAN CẮT BÊ TÔNG', 380, 420, 18, 'rgba(120,30,30,0.6)');
    p.rect(0, 500, 512, 12, 'rgba(0,0,0,0.12)');
  });
  add(22, (p) => {
    p.rect(0, 0, 512, 512, '#a9a79e'); p.noise(0, 0, 512, 512, 2600, ['#98968d', '#b9b7ae', '#8a887f'], 0.8, 2.6, 0.5); p.noise(0, 0, 512, 512, 18, ['#8f8d84', '#7f7d74'], 20, 70, 0.25);
    const bx = 70, by = 150; p.rect(bx, by, 190, 150, '#9a5a44');
    for (let j = 0; j < 150; j += 15) { p.rect(bx, by + j, 190, 2, '#c9c0b0'); for (let i = (j / 15) % 2 ? 0 : 19; i < 190; i += 38) p.rect(bx + i, by + j, 2, 15, '#c9c0b0'); }
    for (let i = 0; i < 7; i++) p.streak(p.R() * 512, 0, 200 + p.R() * 300, 12 + p.R() * 22, 0.16);
    p.rect(380, 0, 10, 512, '#7d827d'); p.grad(0, 400, 512, 112, 'rgba(50,70,40,0)', 'rgba(50,70,40,0.3)');
  });
  // ---- 14, 15 biệt thự, nhà phố kiểu Pháp ----
  add(31, (p) => {
    p.plaster().floorLine('#f1eee6');
    p.rect(0, 0, 44, 512, '#f1eee6').rect(468, 0, 44, 512, '#f1eee6').rect(44, 0, 3, 512, 'rgba(0,0,0,0.14)').rect(465, 0, 3, 512, 'rgba(0,0,0,0.14)');
    p.rect(0, 30, 512, 22, '#f4f1ea').rect(0, 52, 512, 5, 'rgba(0,0,0,0.22)');
    p.window(196, 110, 120, 310, { shutters: GREEN, bars: 2, rows: 4, frame: '#f4f1ea' });
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
      p.louver(cx - w / 2, 190, w / 2 - 2, 302, GREEN).louver(cx + 2, 190, w / 2 - 2, 302, GREEN);
    }
    p.dirtBase().step();
  });
  // ---- 16, 17, 18 cao ốc ----
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

  // ---- 26, 27, 28 mái (lát liền) ----
  add(81, (p) => { // mái bằng bê tông chống nóng
    p.rect(0, 0, 512, 512, '#9c9a92'); p.noise(0, 0, 512, 512, 3400, ['#8b8981', '#adaba3', '#7b7971'], 0.8, 2.6, 0.5); p.noise(0, 0, 512, 512, 30, ['#6f6d62', '#5f6a52'], 16, 60, 0.22);
    for (let i = 0; i < 512; i += 64) { p.rect(i, 0, 2, 512, 'rgba(50,50,46,0.35)').rect(0, i, 512, 2, 'rgba(50,50,46,0.35)'); }
  });
  add(82, (p) => { // ngói ta: các hàng ngói vảy cá, rêu phong
    p.rect(0, 0, 512, 512, '#6f4634');
    const g = p.g, k = p.k, R = p.R;
    for (let j = -1; j < 16; j++) for (let i = -1; i < 16; i++) {
      const x = (i + (j % 2 ? 0.5 : 0)) * 32, y = j * 32, v = R();
      g.fillStyle = `rgb(${98 + v * 44},${60 + v * 24},${46 + v * 18})`; g.beginPath(); g.moveTo(x * k, y * k); g.lineTo((x + 32) * k, y * k); g.lineTo((x + 32) * k, (y + 22) * k); g.quadraticCurveTo((x + 16) * k, (y + 42) * k, x * k, (y + 22) * k); g.fill();
      g.strokeStyle = 'rgba(40,18,12,0.55)'; g.lineWidth = 1.6 * k; g.stroke();
    }
    p.noise(0, 0, 512, 512, 70, ['#4a4a30', '#3a3a2a', '#5a4a36', '#2f2a24'], 14, 54, 0.34);
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
        float fst = floor(vFx.x + 0.5), fseed = vFx.y, ffl = vFx.z;
        vec2 fuv = vFUv; float bay = floor(fuv.x), fl = floor(fuv.y);
        bool isRoof = fst < 9.5;
        float gnd = isRoof ? 0.0 : step(fuv.y, 1.0);
        float layer = floor((gnd > 0.5 ? vVar.y : vVar.x) + 0.5);
        if (!isRoof && fuv.y >= ffl) { layer = ${L.PARAPET}.0; fuv.y -= ffl; }
        vec3 tint = PAL[int(vVar.z + 0.5)];
        float hk = hash12(vec2(bay + 11.0, fseed * 1.37));
        vec4 tx = texture(uFacade, vec3(fuv, layer));
        float shopL = step(${L.SHOP - 0.5}, layer) * step(layer, ${L.SHOP + L.N_SHOP - 0.5}) + step(${L.MOD_GND - 0.5}, layer) * step(layer, ${L.MOD_GND + 0.5});
        vec2 ff = fract(fuv);
        float mk = tx.a, fglass = mk * (1.0 - shopL), flit = mk * shopL;
        float fsign = step(${L.SHOP - 0.5}, layer) * step(layer, ${L.SHOP + L.N_SHOP - 0.5}) * step(0.045, ff.x) * step(ff.x, 0.955) * step(0.772, ff.y) * step(ff.y, 0.971);
        float lum = dot(tx.rgb, vec3(0.3, 0.59, 0.11)), sat = max(tx.r, max(tx.g, tx.b)) - min(tx.r, min(tx.g, tx.b));
        float plast = isRoof ? 1.0 : smoothstep(0.4, 0.62, lum) * (1.0 - smoothstep(0.05, 0.14, sat)) * (1.0 - mk) * (1.0 - fsign);
        vec3 fcol = tx.rgb * mix(vec3(1.0), tint, plast);
        fcol = mix(fcol, tx.rgb * SIGNC[int(vVar.w + 0.5)] * 1.5, fsign);
        // loang ố, rêu mốc: nhiễu tần số thấp theo toạ độ tường
        vec2 nuv = isRoof ? vWPos.xz * 0.035 : vec2(fuv.x * 0.27 + fseed * 0.37, fuv.y * 0.19 + fseed * 0.11);
        vec3 ns = texture(uNoise, nuv).rgb;
        fcol *= (0.74 + 0.42 * ns.r) * mix(1.0, 0.72 + 0.28 * smoothstep(0.0, 0.22, fuv.y), gnd);
        fcol = mix(fcol, fcol * vec3(0.72, 0.78, 0.6), smoothstep(0.62, 0.9, ns.b) * 0.45 * (1.0 - fglass));
        fcol = mix(fcol, vec3(0.02, 0.035, 0.05), fglass * 0.5);
        diffuseColor.rgb *= fcol;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float won = step(0.52, hash12(vec2(bay * 7.0 + fl * 13.0, fseed)));
        vec3 warm = mix(vec3(1.0, 0.74, 0.42), vec3(0.7, 0.82, 1.0), step(0.82, hash12(vec2(fl + 3.0, bay + fseed))));
        totalEmissiveRadiance += (fglass * won * warm * (0.16 + 0.5 * tx.rgb) + flit * tx.rgb * 0.9 + fsign * fcol * 0.5) * uLit;`)
      .replace('#include <opaque_fragment>', `
        { vec3 V = normalize(vWPos - cameraPosition); vec3 Rf = reflect(V, normalize(vWN));
          float fr = 0.06 + 0.94 * pow(1.0 - max(dot(-V, normalize(vWN)), 0.0), 4.0);
          outgoingLight = mix(outgoingLight, skyColor(Rf) + outgoingLight * 0.3, fglass * fr * 0.85 * (1.0 - uLit * won * 0.7)); }
        #include <opaque_fragment>`);
  };
  return mat;
}
