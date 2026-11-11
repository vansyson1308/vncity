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
export const GROUND_SCALE = [1 / 5, 1 / 3.6, 1 / 2, 1 / 4, 1 / 2.4, 1 / 5, 1 / 3, 1 / 3, 1 / 2.4, 1 / 3, 1 / 3, 1 / 4.8, 1 / 3.6, 1 / 2.4, 1 / 3.2, 1 / 2, 1 / 2.5, 1];
// Lớp cuối là bảng đề can 4×4 ô (nắp hố ga, song chắn rác, miếng vá, mũi tên, vệt dầu, sơn kẻ ô đỗ xe), có kênh alpha; xem DECAL trong gen/ground.js.
export const DECAL_LAYER = GROUND_SCALE.length - 1, DECAL_GRID = 4;

export function groundTextures(S = 512) {
  const R = rng(20261111), out = [], masks = [];
  const mk = (base, fn) => { const c = makeCanvas(S), g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, S, S); fn(g); out.push(c); };
  const k = S / 512;
  const grey = (v, dr = 0, dg = 0, db = 0) => `rgb(${Math.round(v + dr)},${Math.round(v + dg)},${Math.round(v + db)})`;
  // đường nứt ngoằn ngoèo
  const crack = (g, x, y, n, step, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(x, y); let a = R() * 6.28; for (let j = 0; j < n; j++) { a += (R() - 0.5) * 1.3; x += Math.cos(a) * step; y += Math.sin(a) * step; g.lineTo(x, y); } g.stroke(); };
  // 0 nhựa đường đã cũ: hạt đá dăm lộ, mảng bạc màu, vết nứt trám nhựa đen (miếng vá lớn do đề can và shader lo, ở đây chỉ là hạt)
  mk('#6b6b6c', (g) => {
    speckle(g, S, R, 5600, ['#7e7e7f', '#5a5a5c', '#8c8b89', '#4f4f52', '#737274', '#96938d'], 0.5 * k, 1.6 * k, 0.9);
    speckle(g, S, R, 22, ['#525255', '#7c7b7a'], 18 * k, 60 * k, 0.13);
    for (let i = 0; i < 3; i++) crack(g, R() * S, R() * S, 7, 26 * k, 'rgba(30,30,32,0.35)', 1.2 * k);
    for (let i = 0; i < 2; i++) crack(g, R() * S, R() * S, 5, 30 * k, 'rgba(22,22,24,0.5)', 2.2 * k); // vết nứt đã trám nhựa
  });
  // 1 vỉa hè đá tự nhiên xanh xám (phố cổ, phố Pháp, Ba Đình): viên 40×60 cm lát so le, mặt nhám, mạch hẹp (9 hàng × 6 viên trên 3,6 m)
  mk('#878c8e', (g) => {
    const rows = 9, cols = 6, rh = S / rows, cw = S / cols;
    for (let j = 0; j < rows; j++) for (let i = -1; i < cols; i++) {
      const v = 128 + R() * 24, x = (i + (j % 2) * 0.5) * cw, old = R() < 0.12;
      g.fillStyle = old ? grey(v - 16, 2, 2, 0) : grey(v, -4, 1, 5); g.fillRect(x, j * rh, cw, rh);
      const gr = g.createLinearGradient(x, j * rh, x + cw, (j + 1) * rh); gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.07)'); g.fillStyle = gr; g.fillRect(x, j * rh, cw, rh);
      g.strokeStyle = 'rgba(44,47,50,0.85)'; g.lineWidth = 1.6 * k; g.strokeRect(x, j * rh, cw, rh);
    }
    speckle(g, S, R, 4200, ['#767b7e', '#9ca1a3', '#686d70', '#a9adae'], 0.4 * k, 1.3 * k, 0.5);
    speckle(g, S, R, 16, ['#55595b'], 8 * k, 30 * k, 0.16);                 // vết ố
    speckle(g, S, R, 40, ['#3c3d3c', '#2f302f'], 1.4 * k, 3.2 * k, 0.5);     // bã kẹo, vết dầu nhỏ
  });
  // 2 bó vỉa đá: granite xám sáng đục nhám, không vẽ mạch (mạch theo lưới thế giới sẽ lệch hướng với bó vỉa chạy chéo)
  mk('#a9a8a1', (g) => {
    speckle(g, S, R, 6200, ['#8e8d86', '#bdbcb4', '#77766f', '#cfcec6', '#9d9c95'], 0.5 * k, 1.5 * k, 0.75);
    speckle(g, S, R, 18, ['#77766f', '#c2c1b9'], 14 * k, 44 * k, 0.14);
    speckle(g, S, R, 26, ['#55544f'], 2 * k, 6 * k, 0.3);
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
  // 6, 7 sơn kẻ đường trắng, vàng (độ mòn do shader khoét theo nhiễu, để lộ nhựa bên dưới)
  mk('#d9d7cd', (g) => speckle(g, S, R, 900, ['#aeada6', '#c4c3bb'], 0.6 * k, 3 * k, 0.5));
  mk('#d8b23c', (g) => speckle(g, S, R, 900, ['#ae9038', '#c6a43e'], 0.6 * k, 3 * k, 0.5));
  // 8 kè đá hộc (hồ Tây, Trúc Bạch, mương): các viên đá xếp, mạch vữa; rêu xanh đen bám quanh mực nước.
  // Mặt đứng: v = cao độ / 2,4 m, cao độ 0 ở mép trên canvas và ĐI XUỐNG là đi ngược từ đáy canvas lên.
  const wallStain = (g, tile, yTop, yBot, col, full = 0.45) => { // dải bẩn đậm dần từ cao độ yTop xuống yBot (m, âm = dưới mặt hè); full: chỗ đạt đủ đậm
    const a = S * (1 + yTop / tile), b = S * (1 + yBot / tile), gr = g.createLinearGradient(0, a, 0, b);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(full, col); gr.addColorStop(1, col); g.fillStyle = gr; g.fillRect(0, b, S, a - b);
  };
  mk('#6f6d66', (g) => {
    const rows = 6, rh = S / rows;
    for (let j = 0; j < rows; j++) { let x = -R() * 40 * k; while (x < S) { const w = (50 + R() * 60) * k, v = 96 + ((R() * 44) | 0); g.fillStyle = `rgb(${v},${v - 2},${v - 8})`; g.fillRect(x + 2 * k, j * rh + 2 * k, w - 4 * k, rh - 4 * k); x += w; } }
    speckle(g, S, R, 3000, ['#5a5852', '#8d8b83', '#4b5a3c'], 0.5 * k, 1.8 * k, 0.5);
    wallStain(g, 2.4, -0.3, -1.3, 'rgba(34,48,28,0.65)', 0.25);
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
  // 12 đá granite xám sáng quanh Hồ Gươm (lát lại 2020): xen một hàng viên 60×60 với một hàng viên 30×60 lát so le (3,6 m)
  mk('#b3b3ae', (g) => {
    const u = S / 12; // 30 cm
    const slab = (x, y, w, h) => { const v = 168 + R() * 22; g.fillStyle = grey(v, 0, 0, -4); g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(88,88,84,0.75)'; g.lineWidth = 1.3 * k; g.strokeRect(x, y, w, h); };
    for (let j = 0; j < 4; j++) { const y = j * 3 * u; for (let i = 0; i < 6; i++) slab(i * 2 * u, y, 2 * u, 2 * u); for (let i = -1; i < 6; i++) slab((i + 0.5) * 2 * u, y + 2 * u, 2 * u, u); }
    speckle(g, S, R, 5200, ['#9c9c97', '#c9c9c3', '#8a8a86', '#d6d6d0', '#77777a'], 0.4 * k, 1.1 * k, 0.55); // hạt muối tiêu của granite khò lửa
    speckle(g, S, R, 10, ['#8e8e88'], 10 * k, 30 * k, 0.12);
  });
  // 13 gạch block tự chèn 10×20 cm xếp xương cá (phố nhỏ, ngõ, ngoài đê): đỏ gạch đã bạc, lẫn viên xám và vàng nhạt, mạch cát
  mk('#6f5a50', (g) => {
    const n = 24, u = S / n; // 24 ô 10 cm = 2,4 m; hoa văn xương cá lặp mỗi 4 ô
    const brick = (x, y, w, h) => {
      const r = R(), v = R() * 22;
      g.fillStyle = r < 0.8 ? `rgb(${150 + v},${78 + v * 0.6},${62 + v * 0.5})` : r < 0.92 ? grey(128 + v, 0, -2, -6) : `rgb(${176 + v},${150 + v},${104 + v})`;
      for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) g.fillRect(x * u + ox + 0.8 * k, y * u + oy + 0.8 * k, w * u - 1.6 * k, h * u - 1.6 * k);
    };
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const d = (((x - y) % 4) + 4) % 4; if (d === 0) brick(x, y, 2, 1); else if (d === 3) brick(x, y, 1, 2); }
    speckle(g, S, R, 3000, ['#7d4a3c', '#b98672', '#5e4a42'], 0.4 * k, 1.2 * k, 0.4);
    speckle(g, S, R, 14, ['#4e4640'], 10 * k, 34 * k, 0.2);
  });
  // 14 gạch terrazzo cũ 40×40 cm: xám kem lốm đốm hạt đá, có viên thay mới lệch màu, viên nứt góc
  mk('#a19d92', (g) => {
    const n = 8, c = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = 150 + R() * 20, r = R(); g.fillStyle = r < 0.1 ? `rgb(${v + 14},${v + 8},${v - 14})` : r < 0.18 ? grey(v - 24) : grey(v, 2, 0, -8); g.fillRect(i * c, j * c, c, c);
      if (R() < 0.14) { g.save(); g.beginPath(); g.rect(i * c, j * c, c, c); g.clip(); crack(g, (i + R()) * c, (j + R()) * c, 4, c * 0.3, 'rgba(50,48,44,0.7)', 1.2 * k); g.restore(); }
    }
    speckle(g, S, R, 5200, ['#c9c5ba', '#7f7b72', '#5c5a55', '#b9a98a', '#d8d4ca'], 0.6 * k, 1.7 * k, 0.6);
    speckle(g, S, R, 16, ['#6b6860'], 10 * k, 34 * k, 0.16);
    g.strokeStyle = 'rgba(58,56,52,0.85)'; g.lineWidth = 2 * k;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * c, 0); g.lineTo(i * c, S); g.moveTo(0, i * c); g.lineTo(S, i * c); g.stroke(); }
  });
  // 15 kè Hồ Gươm: cấu kiện bê tông cốt sợi đúc sẵn, xám sáng, mạch đứng mỗi mét; nước ố và rêu bám quanh mực nước (mặt đứng, 2 m)
  mk('#b4b2aa', (g) => {
    speckle(g, S, R, 4200, ['#a3a199', '#c4c2ba', '#96948c'], 0.5 * k, 1.5 * k, 0.6);
    for (let i = 0; i < 26; i++) { const x = R() * S, w = (3 + R() * 8) * k, h = (40 + R() * 150) * k, y = S * 0.93 - R() * 20 * k, gr = g.createLinearGradient(0, y - h, 0, y); gr.addColorStop(0, 'rgba(70,70,62,0)'); gr.addColorStop(1, 'rgba(70,70,62,0.2)'); g.fillStyle = gr; g.fillRect(x, y - h, w, h); } // vệt nước chảy
    g.fillStyle = 'rgba(60,60,56,0.7)'; for (let i = 0; i < 2; i++) g.fillRect((i * S) / 2 - k, 0, 2 * k, S);
    g.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < 2; i++) g.fillRect((i * S) / 2 + k, 0, 2 * k, S);
    wallStain(g, 2, -0.24, -0.5, 'rgba(96,98,72,0.5)', 0.8); wallStain(g, 2, -0.42, -1.3, 'rgba(38,52,34,0.85)', 0.12);
  });
  // 16 rãnh biên bê tông dọc bó vỉa: xám sáng, bụi đất và vệt nước đọng (không có hoa văn theo hướng)
  mk('#7b7a76', (g) => {
    speckle(g, S, R, 5200, ['#6d6c68', '#8b8a85', '#62615d', '#96958f'], 0.5 * k, 1.6 * k, 0.7);
    speckle(g, S, R, 46, ['#514e48', '#5d574c'], 8 * k, 26 * k, 0.3);
    speckle(g, S, R, 60, ['#403e3a'], 1.5 * k, 4 * k, 0.4);
  });
  // 17 bảng đề can 4×4 (màu ở canvas, hình ở mặt nạ alpha). Mỗi ô chừa lề 10% để mipmap không lem sang ô bên.
  {
    const c = makeCanvas(S), g = c.getContext('2d'), mc = makeCanvas(S), m = mc.getContext('2d'), C = S / DECAL_GRID, kk = C / 128;
    g.fillStyle = '#3a3a3c'; g.fillRect(0, 0, S, S); m.fillStyle = '#000'; m.fillRect(0, 0, S, S);
    const cell = (i, fn) => { for (const x of [g, m]) { x.save(); x.translate((i % DECAL_GRID) * C, Math.floor(i / DECAL_GRID) * C); x.beginPath(); x.rect(0, 0, C, C); x.clip(); } fn(C); g.restore(); m.restore(); };
    const fillCell = (col) => { g.fillStyle = col; g.fillRect(0, 0, C, C); };
    const P = 0.1 * C, I = C - 2 * P; // lề và cạnh vùng vẽ
    // 0 nắp hố ga gang tròn Ø 65 cm trên lòng đường: vành, mặt gân caro, hai lỗ móc
    cell(0, () => {
      fillCell('#343436'); m.fillStyle = '#fff'; m.beginPath(); m.arc(C / 2, C / 2, I / 2, 0, 7); m.fill();
      g.fillStyle = '#2a2a2c'; g.beginPath(); g.arc(C / 2, C / 2, I / 2, 0, 7); g.fill();
      g.fillStyle = '#48484a'; g.beginPath(); g.arc(C / 2, C / 2, I * 0.43, 0, 7); g.fill();
      g.save(); g.beginPath(); g.arc(C / 2, C / 2, I * 0.4, 0, 7); g.clip(); g.strokeStyle = '#2c2c2e'; g.lineWidth = 2.2 * kk;
      for (let t = -C; t < C * 2; t += 9 * kk) { g.beginPath(); g.moveTo(t, 0); g.lineTo(t + C, C); g.moveTo(t, C); g.lineTo(t + C, 0); g.stroke(); }
      g.restore(); g.fillStyle = '#18181a'; g.fillRect(C / 2 - 12 * kk, C / 2 - 2 * kk, 5 * kk, 4 * kk); g.fillRect(C / 2 + 7 * kk, C / 2 - 2 * kk, 5 * kk, 4 * kk);
      g.strokeStyle = 'rgba(120,96,70,0.35)'; g.lineWidth = 2 * kk; g.beginPath(); g.arc(C / 2, C / 2, I * 0.46, 0.4, 2.6); g.stroke(); // gỉ
    });
    // 1 nắp bể cáp viễn thông chữ nhật trên vỉa hè: khung thép, hai tấm bê tông, lỗ móc
    cell(1, () => {
      fillCell('#77756f'); m.fillStyle = '#fff'; m.fillRect(P, P + I * 0.15, I, I * 0.7);
      g.fillStyle = '#4a4a48'; g.fillRect(P, P + I * 0.15, I, I * 0.7);
      for (const i of [0, 1]) { const x = P + 3 * kk + i * (I / 2), w = I / 2 - 6 * kk; g.fillStyle = i ? '#8f8d85' : '#9a9890'; g.fillRect(x, P + I * 0.15 + 3 * kk, w, I * 0.7 - 6 * kk); g.fillStyle = '#3a3a38'; g.fillRect(x + w / 2 - 5 * kk, C / 2 - 2 * kk, 10 * kk, 4 * kk); }
      for (let i = 0; i < 160; i++) { g.fillStyle = R() < 0.5 ? 'rgba(60,60,56,0.35)' : 'rgba(190,188,180,0.35)'; g.fillRect(P + R() * I, P + I * 0.15 + R() * I * 0.7, 1.5 * kk, 1.5 * kk); }
    });
    // 2 song chắn rác gang 30×100 cm ở cửa thu nước dọc bó vỉa (ô dài theo chiều u)
    cell(2, () => {
      fillCell('#2e2e30'); const y0 = C / 2 - I * 0.17, h = I * 0.34; m.fillStyle = '#fff'; m.fillRect(P, y0, I, h);
      g.fillStyle = '#0c0c0d'; g.fillRect(P, y0, I, h); g.fillStyle = '#4c4c4e';
      g.fillRect(P, y0, I, 3 * kk); g.fillRect(P, y0 + h - 3 * kk, I, 3 * kk); g.fillRect(P, y0, 3 * kk, h); g.fillRect(P + I - 3 * kk, y0, 3 * kk, h); g.fillRect(C / 2 - 1.5 * kk, y0, 3 * kk, h);
      for (let x = P + 6 * kk; x < P + I - 4 * kk; x += 7 * kk) g.fillRect(x, y0, 3 * kk, h);
      g.fillStyle = 'rgba(96,84,60,0.5)'; for (let i = 0; i < 9; i++) g.fillRect(P + R() * I, y0 + R() * h, 6 * kk, 3 * kk); // lá, rác mắc ở song
    });
    // 3, 4 miếng vá mặt đường: nhựa mới sẫm màu mép lởm chởm, và miếng vá cũ bạc màu có đường trám nhựa viền quanh
    const patch = (i, col, a, seam) => cell(i, () => {
      fillCell(col); const pts = []; for (let t = 0; t < 28; t++) { const q = t / 28, e = 3 * kk * (R() - 0.5) * 2; const [x, y] = q < 0.25 ? [P + q * 4 * I, P + e] : q < 0.5 ? [P + I + e, P + (q - 0.25) * 4 * I] : q < 0.75 ? [P + I - (q - 0.5) * 4 * I, P + I + e] : [P + e, P + I - (q - 0.75) * 4 * I]; pts.push([x, y]); }
      const path = (x) => { x.beginPath(); pts.forEach((p, j) => (j ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath(); };
      m.fillStyle = `rgb(${a},${a},${a})`; path(m); m.fill(); if (seam) { m.strokeStyle = '#fff'; m.lineWidth = 3 * kk; path(m); m.stroke(); g.strokeStyle = '#161618'; g.lineWidth = 3 * kk; path(g); g.stroke(); }
      for (let t = 0; t < 420; t++) { g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.1)'; g.fillRect(R() * C, R() * C, 1.6 * kk, 1.6 * kk); }
    });
    patch(3, '#3f3f42', 215, false); patch(4, '#807e7a', 150, true);
    // 5, 6 mũi tên sơn trắng trên làn xe: đi thẳng, và đi thẳng kết hợp rẽ phải (ô dài theo chiều u, mũi về phía +u)
    const paint = '#d9d7cd';
    const arrow = (x) => { x.beginPath(); x.moveTo(P, C / 2 - 4 * kk); x.lineTo(P + I * 0.62, C / 2 - 4 * kk); x.lineTo(P + I * 0.62, C / 2 - 13 * kk); x.lineTo(P + I, C / 2); x.lineTo(P + I * 0.62, C / 2 + 13 * kk); x.lineTo(P + I * 0.62, C / 2 + 4 * kk); x.lineTo(P, C / 2 + 4 * kk); x.closePath(); x.fill(); };
    cell(5, () => { fillCell(paint); m.fillStyle = '#e6e6e6'; arrow(m); });
    cell(6, () => {
      fillCell(paint); m.fillStyle = '#e6e6e6'; arrow(m);
      m.beginPath(); m.moveTo(P + I * 0.3, C / 2); m.lineTo(P + I * 0.3, C / 2 + 20 * kk); m.lineTo(P + I * 0.2, C / 2 + 20 * kk); m.lineTo(P + I * 0.36, C / 2 + 36 * kk); m.lineTo(P + I * 0.52, C / 2 + 20 * kk); m.lineTo(P + I * 0.42, C / 2 + 20 * kk); m.lineTo(P + I * 0.42, C / 2); m.closePath(); m.fill();
    });
    // 7 nắp hố ga vuông hai cánh (thoát nước) 80×80 cm
    cell(7, () => {
      fillCell('#3a3a3c'); m.fillStyle = '#fff'; m.fillRect(P, P, I, I); g.fillStyle = '#2c2c2e'; g.fillRect(P, P, I, I);
      for (const i of [0, 1]) { g.fillStyle = '#505052'; g.fillRect(P + 4 * kk + i * (I / 2), P + 4 * kk, I / 2 - 8 * kk, I - 8 * kk); }
      g.fillStyle = '#2f2f31'; for (let y = P + 10 * kk; y < P + I - 8 * kk; y += 9 * kk) for (let x = P + 10 * kk; x < P + I - 8 * kk; x += 9 * kk) g.fillRect(x, y, 4 * kk, 4 * kk);
    });
    // 8 vệt dầu máy, nước bẩn loang trên mặt nhựa chỗ xe hay đỗ
    cell(8, () => {
      fillCell('#232326'); for (let i = 0; i < 9; i++) { const x = C / 2 + (R() - 0.5) * I * 0.5, y = C / 2 + (R() - 0.5) * I * 0.5, r = I * (0.1 + R() * 0.16), gr = m.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); m.fillStyle = gr; m.fillRect(0, 0, C, C); }
    });
    // 9 vạch sơn trắng đặc (ô đỗ xe, vạch trên vỉa hè): cả ô là sơn, mòn lấm tấm
    cell(9, () => { fillCell(paint); m.fillStyle = '#d8d8d8'; m.fillRect(0, 0, C, C); for (let i = 0; i < 90; i++) { m.fillStyle = `rgba(0,0,0,${0.3 + R() * 0.5})`; m.beginPath(); m.arc(R() * C, R() * C, (1 + R() * 4) * kk, 0, 7); m.fill(); } });
    out.push(c); masks[out.length - 1] = mc;
  }
  if (out.length !== GROUND_SCALE.length) throw new Error(`ground: ${out.length} lớp, cần ${GROUND_SCALE.length}`);
  return { canvases: out, masks };
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
