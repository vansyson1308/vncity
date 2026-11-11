// Bảng chữ biển hiệu: một canvas 2048² chia 4×16 ô, mỗi ô một biển. Ô 0 để trắng cho mọi hình không có chữ.
import * as THREE from 'three';
import { SIGNS, SIGN_COLORS, ATLAS, FLAG_CELL } from './signs.js';

const hex = (h) => '#' + h.toString(16).padStart(6, '0');
export async function signAtlas(renderer, aniso = 4) {
  // phông tiếng Việt tự lưu trữ; nếu chưa kịp tải thì canvas dùng phông hệ thống
  try { await Promise.race([Promise.all([document.fonts.load('800 60px "Be Vietnam Pro"', 'PHỞ'), document.fonts.load('600 24px "Be Vietnam Pro"', 'PHỞ')]), new Promise((r) => setTimeout(r, 2500))]); } catch { /* bỏ qua */ }
  const S = ATLAS.size, cw = S / ATLAS.cols, ch = S / ATLAS.rows, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  SIGNS.forEach((s, i) => {
    if (!s) return;
    const x = (i % ATLAS.cols) * cw, y = Math.floor(i / ATLAS.cols) * ch, bg = SIGN_COLORS[s[2]], light = s[2] === 10 || s[2] === 3;
    g.fillStyle = hex(bg); g.fillRect(x, y, cw, ch);
    const gr = g.createLinearGradient(0, y, 0, y + ch); gr.addColorStop(0, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0.2)'); g.fillStyle = gr; g.fillRect(x, y, cw, ch);
    g.strokeStyle = light ? 'rgba(120,20,20,0.9)' : 'rgba(255,230,150,0.9)'; g.lineWidth = 4; g.strokeRect(x + 8, y + 8, cw - 16, ch - 16);
    const fg = light ? '#b3121f' : i % 3 === 0 ? '#ffe27a' : '#ffffff';
    let size = 62; g.font = `800 ${size}px "Be Vietnam Pro", Arial, sans-serif`;
    while (g.measureText(s[0]).width > cw - 60 && size > 30) { size -= 3; g.font = `800 ${size}px "Be Vietnam Pro", Arial, sans-serif`; }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillText(s[0], x + cw / 2 + 2, y + ch * 0.42 + 3);
    g.fillStyle = fg; g.fillText(s[0], x + cw / 2, y + ch * 0.42);
    let s2 = 22; g.font = `600 ${s2}px "Be Vietnam Pro", Arial, sans-serif`;
    while (g.measureText(s[1]).width > cw - 50 && s2 > 13) { s2 -= 1; g.font = `600 ${s2}px "Be Vietnam Pro", Arial, sans-serif`; }
    g.fillStyle = light ? '#333' : 'rgba(255,255,255,0.92)'; g.fillText(s[1], x + cw / 2, y + ch * 0.8);
  });
  { // cờ đỏ sao vàng
    const x = (FLAG_CELL % ATLAS.cols) * cw, y = Math.floor(FLAG_CELL / ATLAS.cols) * ch;
    g.fillStyle = '#da251d'; g.fillRect(x, y, cw, ch); g.fillStyle = '#ffff00';
    const cx = x + cw / 2, cy = y + ch / 2, R = ch * 0.3, r = R * 0.382; g.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r : R; g.lineTo(cx + Math.cos(a) * rr * (cw / ch) * 0.375, cy + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(aniso, renderer.capabilities.getMaxAnisotropy()); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
