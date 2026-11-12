// Bảng chữ biển hiệu: một canvas 2048² chia 4×24 ô (xem bố cục trong world/signs.js). Ô 0 để trắng cho mọi hình không có chữ.
// Màn hình LED quảng trường không còn nằm ở đây: nó dựng bằng hình khối màu trong gen/decor.js.
import * as THREE from 'three';
import { SIGNS, SIGN_COLORS, ATLAS, FLAG_CELL, BLADE0, BLADE_PER, BLADE_N, TEXT0, bladeLines } from './signs.js';
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
    // biển vẫy đi kèm (BLADE_N biển đầu): hộp đèn đứng 64 × 85 điểm ảnh, chữ lớn mỗi từ một dòng
    if (i > BLADE_N) return;
    const k = i - 1, cell = BLADE0 + Math.floor(k / BLADE_PER), bw = cw / BLADE_PER, bx = (cell % ATLAS.cols) * cw + (k % BLADE_PER) * bw, by = Math.floor(cell / ATLAS.cols) * ch, lines = bladeLines(s[0]), n = lines.length;
    g.fillStyle = hex(SIGN_COLORS[ci]); g.fillRect(bx, by, bw, ch + 1);
    g.strokeStyle = light ? 'rgba(120,20,20,0.85)' : 'rgba(255,240,200,0.9)'; g.lineWidth = 1.5; g.strokeRect(bx + 3, by + 3, bw - 6, ch - 6);
    g.fillStyle = fg;
    lines.forEach((t, j) => { // chữ dài thì ép hẹp trước (tới 60%) rồi mới giảm cỡ, để hộp đèn nhỏ vẫn đọc được
      const size = n === 3 ? 19 : 22, maxW = bw - 11; g.font = `800 ${size}px ${FONT}`; const sx = Math.max(0.6, Math.min(1, maxW / g.measureText(t).width));
      fit(t, 800, size, 8, maxW / sx); g.save(); g.translate(bx + bw / 2, by + ch * (n === 1 ? 0.52 : n === 2 ? 0.34 + j * 0.34 : 0.25 + j * 0.26)); g.scale(sx, 1); g.fillText(t, 0, 0); g.restore();
    });
  });
  HERO_TEXT.forEach((t, i) => { // chữ nổi trên công trình có tên: nền kem, chữ đỏ sẫm
    const x = ((TEXT0 + i) % ATLAS.cols) * cw, y = Math.floor((TEXT0 + i) / ATLAS.cols) * ch;
    g.fillStyle = '#efe6cf'; g.fillRect(x, y, cw, ch + 1); g.strokeStyle = 'rgba(110,30,25,0.8)'; g.lineWidth = 3; g.strokeRect(x + 5, y + 5, cw - 10, ch - 10);
    fit(t, 800, 50, 24, cw - 40); g.fillStyle = '#8e1b16'; g.fillText(t, x + cw / 2, y + ch * 0.53);
  });
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
  try { await Promise.race([Promise.all([document.fonts.load('800 60px "Be Vietnam Pro"', 'PHỞ'), document.fonts.load('600 24px "Be Vietnam Pro"', 'PHỞ')]), new Promise((r) => setTimeout(r, 5000))]); } catch { /* bỏ qua */ }
  const t = new THREE.CanvasTexture(drawSignAtlas(document.createElement('canvas'))); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(aniso, renderer.capabilities.getMaxAnisotropy()); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
