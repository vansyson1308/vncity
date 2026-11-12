// Bảng chữ biển hiệu: một canvas 2048² chia 4×24 ô (xem bố cục trong world/signs.js). Ô 0 để trắng cho mọi hình không có chữ.
import * as THREE from 'three';
import { SIGNS, SIGN_COLORS, ATLAS, FLAG_CELL, LED_CELL, BLADE0, BLADE_PER, TEXT0, bladeLines } from './signs.js';
import { HERO_TEXT } from './gen/heroes.js';

const hex = (h) => '#' + h.toString(16).padStart(6, '0');
const FONT = '"Be Vietnam Pro", Arial, sans-serif';
// màu chữ theo nền: nền sáng (kem, vàng) chữ đỏ; nền nâu gỗ chữ vàng kim; còn lại chữ trắng hoặc vàng nhạt
const ink = (ci, i) => (ci === 10 || ci === 3 ? '#b3121f' : ci === 12 ? '#f2d27a' : i % 3 === 0 ? '#ffe27a' : '#ffffff');

export function drawSignAtlas(c) {
  const S = ATLAS.size, cw = S / ATLAS.cols, ch = S / ATLAS.rows; c.width = c.height = S;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const fit = (txt, weight, size, min, maxW) => { g.font = `${weight} ${size}px ${FONT}`; while (g.measureText(txt).width > maxW && size > min) { size -= 1; g.font = `${weight} ${size}px ${FONT}`; } return size; };
  SIGNS.forEach((s, i) => {
    if (!s) return;
    const x = (i % ATLAS.cols) * cw, y = Math.floor(i / ATLAS.cols) * ch, ci = s[2], light = ci === 10 || ci === 3, fg = ink(ci, i);
    g.fillStyle = hex(SIGN_COLORS[ci]); g.fillRect(x, y, cw, ch + 1);
    const gr = g.createLinearGradient(0, y, 0, y + ch); gr.addColorStop(0, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(0,0,0,0.2)'); g.fillStyle = gr; g.fillRect(x, y, cw, ch + 1);
    g.strokeStyle = light ? 'rgba(120,20,20,0.85)' : ci === 12 ? 'rgba(242,210,122,0.85)' : 'rgba(255,230,150,0.85)'; g.lineWidth = 2.5; g.strokeRect(x + 6, y + 6, cw - 12, ch - 12);
    fit(s[0], 800, 46, 26, cw - 44);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillText(s[0], x + cw / 2 + 1.5, y + ch * 0.4 + 2);
    g.fillStyle = fg; g.fillText(s[0], x + cw / 2, y + ch * 0.4);
    fit(s[1], 600, 16, 10, cw - 36);
    g.fillStyle = light ? '#333' : ci === 12 ? '#f2d27a' : 'rgba(255,255,255,0.92)'; g.fillText(s[1], x + cw / 2, y + ch * 0.8);
    // biển vẫy đi kèm: hộp đèn nhỏ, chữ lớn ngắt hai dòng
    const k = i - 1, cell = BLADE0 + Math.floor(k / BLADE_PER), bw = cw / BLADE_PER, bx = (cell % ATLAS.cols) * cw + (k % BLADE_PER) * bw, by = Math.floor(cell / ATLAS.cols) * ch, lines = bladeLines(s[0]);
    g.fillStyle = hex(SIGN_COLORS[ci]); g.fillRect(bx, by, bw, ch + 1);
    g.strokeStyle = light ? 'rgba(120,20,20,0.85)' : 'rgba(255,240,200,0.9)'; g.lineWidth = 2; g.strokeRect(bx + 4, by + 4, bw - 8, ch - 8);
    g.fillStyle = fg;
    lines.forEach((t, j) => { fit(t, 800, lines.length === 1 ? 30 : 27, 12, bw - 14); g.fillText(t, bx + bw / 2, by + ch * (lines.length === 1 ? 0.52 : j ? 0.72 : 0.32)); });
  });
  HERO_TEXT.forEach((t, i) => { // chữ nổi trên công trình có tên: nền kem, chữ đỏ sẫm
    const x = ((TEXT0 + i) % ATLAS.cols) * cw, y = Math.floor((TEXT0 + i) / ATLAS.cols) * ch;
    g.fillStyle = '#efe6cf'; g.fillRect(x, y, cw, ch + 1); g.strokeStyle = 'rgba(110,30,25,0.8)'; g.lineWidth = 3; g.strokeRect(x + 5, y + 5, cw - 10, ch - 10);
    fit(t, 800, 50, 24, cw - 40); g.fillStyle = '#8e1b16'; g.fillText(t, x + cw / 2, y + ch * 0.53);
  });
  { // màn hình LED quảng trường Đông Kinh Nghĩa Thục: nền đỏ, sao vàng, chữ vàng (ô 6:1 căng lên màn hình 16:9 nên vẽ nén chiều dọc)
    const x = (LED_CELL % ATLAS.cols) * cw, y = Math.floor(LED_CELL / ATLAS.cols) * ch, k = ch / 288;
    const gr = g.createLinearGradient(x, 0, x + cw, 0); gr.addColorStop(0, '#b3121f'); gr.addColorStop(0.5, '#e02a1f'); gr.addColorStop(1, '#b3121f'); g.fillStyle = gr; g.fillRect(x, y, cw, ch + 1);
    g.save(); g.translate(x, y); g.scale(1, k);
    g.fillStyle = '#ffe14a'; g.beginPath();
    for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + (j * Math.PI) / 5, rr = j % 2 ? 21 : 55; g.lineTo(256 + Math.cos(a) * rr, 76 + Math.sin(a) * rr); }
    g.closePath(); g.fill();
    g.font = `800 76px ${FONT}`; g.fillText('HÀ NỘI', 256, 178);
    g.font = `700 34px ${FONT}`; g.fillText('THÀNH PHỐ VÌ HÒA BÌNH', 256, 248);
    g.restore();
  }
  { // cờ đỏ sao vàng (ô 6:1 căng lên lá cờ 3:2)
    const x = (FLAG_CELL % ATLAS.cols) * cw, y = Math.floor(FLAG_CELL / ATLAS.cols) * ch;
    g.fillStyle = '#da251d'; g.fillRect(x, y, cw, ch + 1); g.fillStyle = '#ffff00';
    const cx = x + cw / 2, cy = y + ch / 2, R = ch * 0.3, r = R * 0.382; g.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r : R; g.lineTo(cx + Math.cos(a) * rr * (cw / ch) / 1.5, cy + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }
  return c;
}

export async function signAtlas(renderer, aniso = 4) {
  // phông tiếng Việt tự lưu trữ; nếu chưa kịp tải thì canvas dùng phông hệ thống
  try { await Promise.race([Promise.all([document.fonts.load('800 60px "Be Vietnam Pro"', 'PHỞ'), document.fonts.load('600 24px "Be Vietnam Pro"', 'PHỞ')]), new Promise((r) => setTimeout(r, 2500))]); } catch { /* bỏ qua */ }
  const t = new THREE.CanvasTexture(drawSignAtlas(document.createElement('canvas'))); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(aniso, renderer.capabilities.getMaxAnisotropy()); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
