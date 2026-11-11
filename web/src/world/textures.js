// Chất liệu vẽ thủ tục bằng canvas: mặt đường, vỉa hè, cỏ, đá kè... gói thành một texture mảng (sampler2DArray)
// để cả mặt đất của một ô phố chỉ cần một lệnh vẽ. Không tải ảnh nào từ mạng.
import * as THREE from 'three';
import { rng } from '../core/util.js';

export function makeCanvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Gộp các canvas cùng cỡ thành DataArrayTexture có mipmap. masks[i] (nếu có) đi vào kênh alpha.
export function arrayTexture(canvases, masks, { srgb = true, aniso = 4 } = {}) {
  const w = canvases[0].width, h = canvases[0].height, n = canvases.length;
  const data = new Uint8Array(w * h * 4 * n);
  canvases.forEach((c, i) => {
    const px = c.getContext('2d').getImageData(0, 0, w, h).data;
    data.set(px, i * w * h * 4);
    if (masks && masks[i]) { const m = masks[i].getContext('2d').getImageData(0, 0, w, h).data; for (let k = 0, o = i * w * h * 4; k < w * h * 4; k += 4) data[o + k + 3] = m[k]; }
    else for (let k = 3, o = i * w * h * 4; k < w * h * 4; k += 4) data[o + k] = masks ? 0 : 255;
  });
  const t = new THREE.DataArrayTexture(data, w, h, n);
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

// Vẽ lặp qua mép để hoạ tiết ghép liền khi lát.
function wrapDraw(g, S, x, y, r, fn) {
  for (const ox of x < r ? [0, S] : x > S - r ? [0, -S] : [0]) for (const oy of y < r ? [0, S] : y > S - r ? [0, -S] : [0]) fn(x + ox, y + oy);
}
function speckle(g, S, R, n, colors, rmin, rmax, alpha = 1) {
  for (let i = 0; i < n; i++) {
    const x = R() * S, y = R() * S, r = rmin + R() * (rmax - rmin);
    g.fillStyle = colors[(R() * colors.length) | 0]; g.globalAlpha = alpha * (0.4 + R() * 0.6);
    wrapDraw(g, S, x, y, r, (px, py) => { g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); });
  }
  g.globalAlpha = 1;
}

// Thứ tự phải khớp LAYER trong gen/ground.js. scale = số lần lặp trên mỗi mét.
export const GROUND_SCALE = [1 / 5, 1 / 3.2, 1 / 2, 1 / 4, 1 / 2.4, 1 / 5, 1 / 3, 1 / 3, 1 / 2.4, 1 / 3, 1 / 3, 1 / 4.8];

export function groundTextures(S = 512) {
  const R = rng(20261111), out = [];
  const mk = (base, fn) => { const c = makeCanvas(S), g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, S, S); fn(g); out.push(c); };
  const k = S / 512;
  // 0 nhựa đường: hạt đá dăm, vết vá, vết nứt
  mk('#646669', (g) => {
    speckle(g, S, R, 5200, ['#77797c', '#56585b', '#858789', '#4c4e51', '#6c6e71'], 0.5 * k, 1.6 * k, 0.9);
    speckle(g, S, R, 26, ['#4b4d50', '#5d5f62'], 18 * k, 60 * k, 0.16);
    g.strokeStyle = 'rgba(40,41,43,0.22)'; g.lineWidth = 0.9 * k;
    for (let i = 0; i < 3; i++) { let x = R() * S, y = R() * S; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (R() - 0.5) * 40 * k; y += (R() - 0.3) * 34 * k; g.lineTo(x, y); } g.stroke(); }
  });
  // 1 vỉa hè lát đá xanh xám 40×40 cm (8×8 viên trên 3,2 m)
  mk('#8b8c86', (g) => {
    const n = 8, c = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = 142 + ((R() * 22) | 0), t = (R() * 8) | 0;
      g.fillStyle = `rgb(${v + t - 2},${v + 2},${v - 6})`; g.fillRect(i * c, j * c, c, c);
    }
    speckle(g, S, R, 3600, ['#7a7b76', '#a2a39c', '#6e6f6a'], 0.4 * k, 1.3 * k, 0.5);
    speckle(g, S, R, 14, ['#5e5f5a'], 10 * k, 34 * k, 0.14);
    g.strokeStyle = 'rgba(52,53,50,0.85)'; g.lineWidth = 2 * k;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * c, 0); g.lineTo(i * c, S); g.moveTo(0, i * c); g.lineTo(S, i * c); g.stroke(); }
  });
  // 2 bó vỉa đá granite: mạch nối mỗi mét
  mk('#a5a49c', (g) => {
    speckle(g, S, R, 5200, ['#8e8d86', '#bdbcb4', '#77766f', '#cfcec6'], 0.5 * k, 1.5 * k, 0.75);
    g.strokeStyle = 'rgba(60,60,56,0.7)'; g.lineWidth = 2 * k;
    for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo((i * S) / 2, 0); g.lineTo((i * S) / 2, S); g.moveTo(0, (i * S) / 2); g.lineTo(S, (i * S) / 2); g.stroke(); }
  });
  // 3 cỏ
  mk('#4d6b2f', (g) => {
    speckle(g, S, R, 60, ['#5b7a35', '#3f5c27', '#667f3a'], 16 * k, 50 * k, 0.3);
    g.lineWidth = 1 * k;
    for (let i = 0; i < 9000; i++) { const x = R() * S, y = R() * S, a = R() * 6.28, l = (2 + R() * 4) * k; g.strokeStyle = ['#6f8f3d', '#3a5524', '#58773a', '#84a04a', '#2f4a1f'][(R() * 5) | 0]; g.globalAlpha = 0.7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    g.globalAlpha = 1;
  });
  // 4 lối dạo công viên: gạch block đỏ nâu xếp so le
  mk('#9a6f5a', (g) => {
    const nx = 12, ny = 24, cw = S / nx, ch = S / ny;
    for (let j = 0; j < ny; j++) for (let i = -1; i < nx; i++) {
      const v = (R() * 26) | 0; g.fillStyle = `rgb(${142 + v},${98 + v * 0.7},${80 + v * 0.6})`;
      g.fillRect((i + (j % 2) * 0.5) * cw + k, j * ch + k, cw - 2 * k, ch - 2 * k);
    }
    speckle(g, S, R, 2400, ['#7d5645', '#b58a74'], 0.4 * k, 1.2 * k, 0.4);
  });
  // 5 đất bãi sông: phù sa, cỏ dại
  mk('#7d6a4c', (g) => {
    speckle(g, S, R, 5000, ['#8d7958', '#6c5a40', '#9a8763'], 0.5 * k, 1.8 * k, 0.7);
    speckle(g, S, R, 70, ['#5d6b34', '#6b7a3c', '#4f5f2e'], 8 * k, 30 * k, 0.4);
  });
  // 6, 7 sơn kẻ đường trắng, vàng (đã mòn)
  mk('#d8d6cc', (g) => speckle(g, S, R, 900, ['#9c9b94', '#bdbcb4'], 0.6 * k, 3 * k, 0.5));
  mk('#d9b340', (g) => speckle(g, S, R, 900, ['#a88a36', '#c6a43e'], 0.6 * k, 3 * k, 0.5));
  // 8 kè đá hộc: các viên đá xếp, mạch vữa
  mk('#6f6d66', (g) => {
    const rows = 6, rh = S / rows;
    for (let j = 0; j < rows; j++) { let x = -R() * 40 * k; while (x < S) { const w = (50 + R() * 60) * k, v = 96 + ((R() * 44) | 0); g.fillStyle = `rgb(${v},${v - 2},${v - 8})`; g.fillRect(x + 2 * k, j * rh + 2 * k, w - 4 * k, rh - 4 * k); x += w; } }
    speckle(g, S, R, 3000, ['#5a5852', '#8d8b83', '#4b5a3c'], 0.5 * k, 1.8 * k, 0.5);
    const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(30,45,25,0.4)'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  });
  // 9 bồn hoa: lá xanh điểm hoa
  mk('#3f6a2c', (g) => {
    speckle(g, S, R, 2400, ['#4d7d34', '#356026', '#5c8c3c'], 3 * k, 8 * k, 0.8);
    speckle(g, S, R, 900, ['#e8c53a', '#d84a5a', '#f0f0e6', '#e07ab0', '#f09a3a'], 1.6 * k, 3.4 * k, 1);
  });
  // 10 đá balát đường sắt
  mk('#6a655d', (g) => speckle(g, S, R, 5200, ['#8a857c', '#57534c', '#787268', '#4a463f', '#9a958c'], 2 * k, 5 * k, 0.95));
  // 11 quảng trường lát đá lớn
  mk('#9a9a94', (g) => {
    const n = 6, c = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 140 + ((R() * 26) | 0); g.fillStyle = `rgb(${v},${v},${v - 5})`; g.fillRect(i * c, j * c, c, c); }
    speckle(g, S, R, 3000, ['#85857f', '#b0b0a9'], 0.4 * k, 1.3 * k, 0.5);
    g.strokeStyle = 'rgba(60,60,56,0.8)'; g.lineWidth = 2 * k;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * c, 0); g.lineTo(i * c, S); g.moveTo(0, i * c); g.lineTo(S, i * c); g.stroke(); }
  });
  return out;
}

// Nhiễu mịn lát liền: R, G hai tần số khác nhau (làm loang màu, phá cảm giác lặp gạch).
export function noiseTexture(S = 256) {
  const R = rng(77), data = new Uint8Array(S * S * 4);
  const layer = (cells) => {
    const g = new Float32Array(cells * cells); for (let i = 0; i < g.length; i++) g[i] = R();
    return (x, y) => { const fx = (x / S) * cells, fy = (y / S) * cells, ix = Math.floor(fx), iy = Math.floor(fy); let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty); const a = g[(iy % cells) * cells + (ix % cells)], b = g[(iy % cells) * cells + ((ix + 1) % cells)], c = g[((iy + 1) % cells) * cells + (ix % cells)], d = g[((iy + 1) % cells) * cells + ((ix + 1) % cells)]; return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty; };
  };
  const a = layer(8), b = layer(16), c = layer(32), d = layer(64), e = layer(5);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    data[i] = 255 * (a(x, y) * 0.5 + b(x, y) * 0.3 + c(x, y) * 0.2);
    data[i + 1] = 255 * (c(x, y) * 0.55 + d(x, y) * 0.45);
    data[i + 2] = 255 * e(x, y); data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, S, S); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

// Bản đồ pháp tuyến sóng lăn tăn cho mặt hồ, lát liền, tính từ trường độ cao tổng các sóng sin.
export function waterNormals(S = 256) {
  const R = rng(4242), waves = [];
  for (let i = 0; i < 22; i++) { const kx = Math.round((R() - 0.5) * 14), ky = Math.round((R() - 0.5) * 14); if (kx || ky) waves.push([kx, ky, R() * 6.28, 1 / (1 + Math.hypot(kx, ky))]); }
  const H = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { let h = 0; for (const [kx, ky, p, a] of waves) h += Math.sin(((x * kx + y * ky) / S) * 6.28318 + p) * a; H[y * S + x] = h; }
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (H[y * S + ((x + 1) % S)] - H[y * S + ((x + S - 1) % S)]) * 6, dy = (H[((y + 1) % S) * S + x] - H[((y + S - 1) % S) * S + x]) * 6, l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
    data[i] = 127.5 - (dx / l) * 127.5; data[i + 1] = 127.5 - (dy / l) * 127.5; data[i + 2] = (1 / l) * 255; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, S, S); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

// Tán lá: 4 ô (2×2) trên nền trong suốt. 0 chùm lá to, 1 chùm lá nhỏ, 2 rèm liễu rủ, 3 chùm hoa (trắng, nhuộm màu theo đỉnh).
// Lá vẽ gần như đơn sắc sáng để màu đỉnh quyết định sắc xanh của từng loài.
export function leafTexture(S = 512) {
  const c = makeCanvas(S), g = c.getContext('2d'), R = rng(909), h = S / 2;
  const leaf = (x, y, a, l, w, col) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, l, w, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-l, 0); g.lineTo(l, 0); g.stroke(); g.restore(); };
  const tones = ['#c9d8b4', '#e4eed2', '#a9bd92', '#f2f7e6', '#b8cc9e', '#8fa67a', '#d6e4c0', '#768c62', '#9db288'];
  const cluster = (ox, oy, n, l, w, spread) => {
    g.save(); g.beginPath(); g.rect(ox, oy, h, h); g.clip();
    for (let i = 0; i < n; i++) { const a = R() * 6.283, r = Math.pow(R(), 0.62) * spread * (0.82 + 0.18 * Math.sin(a * 5 + ox)), x = ox + h / 2 + Math.cos(a) * r, y = oy + h / 2 + Math.sin(a) * r * 0.92; leaf(x, y, R() * 6.283, l * (0.7 + R() * 0.6), w * (0.7 + R() * 0.6), tones[(R() * tones.length) | 0]); }
    g.restore();
  };
  cluster(0, 0, 520, 17, 8.5, h * 0.47);
  cluster(h, 0, 1300, 9, 4.6, h * 0.47);
  // liễu: các sợi rủ từ trên xuống
  g.save(); g.beginPath(); g.rect(0, h, h, h); g.clip();
  for (let i = 0; i < 46; i++) { let x = 10 + R() * (h - 20), y = h + R() * 20; const len = h * (0.55 + R() * 0.42); for (let t = 0; t < len; t += 7) { leaf(x + Math.sin(t * 0.05 + i) * 3, y + t, 1.57 + (R() - 0.5) * 0.9, 7, 2.4, tones[(R() * tones.length) | 0]); } }
  g.restore();
  // hoa: lá thưa + cánh hoa trắng
  cluster(h, h, 200, 13, 6, h * 0.44);
  g.save(); g.beginPath(); g.rect(h, h, h, h); g.clip();
  for (let i = 0; i < 170; i++) { const a = R() * 6.283, r = Math.sqrt(R()) * h * 0.42; g.fillStyle = R() < 0.5 ? '#ffffff' : '#f4f4f4'; g.beginPath(); g.arc(h + h / 2 + Math.cos(a) * r, h + h / 2 + Math.sin(a) * r, 3 + R() * 4.5, 0, 7); g.fill(); }
  g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4;
  return t;
}
