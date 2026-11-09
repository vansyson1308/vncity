// Vẽ mặt tiền nhà ống Hà Nội bằng canvas: không cần tải ảnh, mỗi kiểu một texture màu + một texture đèn đêm.
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function tex(canvas, renderer, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

function grime(g, w, h, r, a = 0.12) {
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(40,30,20,${r() * a})`;
    const x = r() * w, y = r() * h;
    g.fillRect(x, y, 2 + r() * 10, 6 + r() * 60);
  }
}

// Tầng trên: 2 gian × 2 tầng, mỗi gian 4 m, mỗi tầng 3,3 m (512 × 512 px).
export function upperFacade(renderer, wall, shutter, seed) {
  const W = 512, H = 512, r = rng(seed);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const e = document.createElement('canvas'); e.width = W; e.height = H;
  const g = c.getContext('2d'), ge = e.getContext('2d');
  g.fillStyle = wall; g.fillRect(0, 0, W, H);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  grime(g, W, H, r);
  for (let fy = 0; fy < 2; fy++) for (let bx = 0; bx < 2; bx++) {
    const x0 = bx * 256, y0 = fy * 256;
    // gờ tầng
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x0, y0 + 244, 256, 12);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x0, y0 + 240, 256, 4);
    const style = (r() * 3) | 0;
    const ww = 110, wh = 170, wx = x0 + 73, wy = y0 + 46;
    const lit = r() < 0.45;
    // khung cửa
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(wx - 8, wy - 8, ww + 16, wh + 12);
    g.fillStyle = '#1d1a17'; g.fillRect(wx, wy, ww, wh);
    if (lit) { ge.fillStyle = r() < 0.5 ? '#ffd38a' : '#ffe9c4'; ge.fillRect(wx + 4, wy + 4, ww - 8, wh - 8); }
    if (style !== 2) {
      // cánh chớp mở hai bên
      g.fillStyle = shutter;
      g.fillRect(wx - 36, wy, 34, wh); g.fillRect(wx + ww + 2, wy, 34, wh);
      g.fillStyle = 'rgba(0,0,0,0.28)';
      for (let k = 0; k < wh; k += 9) { g.fillRect(wx - 36, wy + k, 34, 3); g.fillRect(wx + ww + 2, wy + k, 34, 3); }
    } else {
      // cửa kính khung nhôm
      g.fillStyle = '#5b6b72'; g.fillRect(wx, wy, ww, wh);
      g.fillStyle = '#9fb4bb'; g.fillRect(wx + 6, wy + 6, ww / 2 - 9, wh - 12); g.fillRect(wx + ww / 2 + 3, wy + 6, ww / 2 - 9, wh - 12);
      if (lit) { ge.fillStyle = '#ffe2a8'; ge.fillRect(wx + 6, wy + 6, ww - 12, wh - 12); }
    }
    // ban công sắt
    if (style === 0 || fy === 1) {
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x0 + 20, y0 + 200, 216, 8);
      g.strokeStyle = '#2a2a2a'; g.lineWidth = 3;
      for (let k = x0 + 24; k < x0 + 236; k += 12) { g.beginPath(); g.moveTo(k, y0 + 160); g.lineTo(k, y0 + 204); g.stroke(); }
      g.fillStyle = '#2a2a2a'; g.fillRect(x0 + 20, y0 + 156, 216, 6);
    }
    // cây cảnh, quần áo phơi
    if (r() < 0.35) {
      g.fillStyle = ['#3f7a3a', '#5c8f3c', '#2f6b47'][(r() * 3) | 0];
      g.beginPath(); g.ellipse(x0 + 40 + r() * 170, y0 + 150, 18, 14, 0, 0, 7); g.fill();
    }
    if (r() < 0.25) {
      for (let k = 0; k < 4; k++) { g.fillStyle = `hsl(${r() * 360},50%,55%)`; g.fillRect(x0 + 60 + k * 30, y0 + 165, 20, 30); }
    }
  }
  // dây điện
  g.strokeStyle = 'rgba(20,20,20,0.6)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, 470 + r() * 20); g.bezierCurveTo(170, 500, 340, 490, 512, 475); g.stroke();
  return { map: tex(c, renderer), emissiveMap: tex(e, renderer) };
}

// Tầng trệt: 3 gian hàng, mỗi gian 4 m × 3,6 m (768 × 256 px).
export function shopFront(renderer, wall, seed) {
  const W = 768, H = 256, r = rng(seed);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const e = document.createElement('canvas'); e.width = W; e.height = H;
  const g = c.getContext('2d'), ge = e.getContext('2d');
  g.fillStyle = wall; g.fillRect(0, 0, W, H);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  const signs = ['#c8102e', '#1f4e9c', '#d9a400', '#2f7d32', '#7a1f6d', '#e8e2d0'];
  for (let i = 0; i < 3; i++) {
    const x0 = i * 256;
    const open = r() < 0.7;
    // biển hiệu
    const sc = signs[(r() * signs.length) | 0];
    g.fillStyle = sc; g.fillRect(x0 + 6, 8, 244, 46);
    g.fillStyle = sc === '#e8e2d0' || sc === '#d9a400' ? '#8a1010' : '#ffe9a0';
    for (let k = 0; k < 6; k++) g.fillRect(x0 + 24 + k * 36, 22, 24 + r() * 6, 16);
    ge.fillStyle = 'rgba(255,240,200,0.35)'; ge.fillRect(x0 + 6, 8, 244, 46);
    if (open) {
      // lòng cửa hàng: tối dần vào trong, kệ hàng nhiều tầng, hàng hoá nhỏ
      const gr = g.createLinearGradient(0, 64, 0, 256); gr.addColorStop(0, '#3a2f25'); gr.addColorStop(1, '#1f1914');
      g.fillStyle = gr; g.fillRect(x0 + 14, 64, 228, 192);
      const hue = r() * 360;
      for (let sy = 90; sy < 250; sy += 34) {
        g.fillStyle = '#5a4634'; g.fillRect(x0 + 18, sy + 24, 220, 4);
        for (let sx = x0 + 20; sx < x0 + 234;) {
          const w = 5 + r() * 9, h = 8 + r() * 16;
          g.fillStyle = `hsl(${(hue + r() * 70) % 360},${15 + r() * 25}%,${32 + r() * 30}%)`;
          g.fillRect(sx, sy + 24 - h, w, h); sx += w + 1 + r() * 3;
        }
      }
      // hàng treo phía trên, người bán ngồi ghế nhựa
      for (let k = 0; k < 10; k++) { g.fillStyle = `hsl(${(hue + 180 + r() * 40) % 360},40%,50%)`; g.fillRect(x0 + 20 + k * 22, 66, 12, 10 + r() * 14); }
      ge.fillStyle = '#ffcf80'; ge.globalAlpha = 0.55; ge.fillRect(x0 + 14, 64, 228, 192); ge.globalAlpha = 1;
      ge.fillStyle = '#fff3d6'; ge.fillRect(x0 + 110, 66, 36, 4);
    } else {
      // cửa cuốn, đôi khi mở hé
      const half = r() < 0.5 ? 64 + r() * 90 : 256;
      g.fillStyle = '#2a231d'; g.fillRect(x0 + 14, 64, 228, 192);
      g.fillStyle = '#8d9396'; g.fillRect(x0 + 14, 64, 228, half - 64);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let k = 64; k < half; k += 7) g.fillRect(x0 + 14, k, 228, 2);
      if (half < 256) { ge.fillStyle = '#d9a35c'; ge.globalAlpha = 0.5; ge.fillRect(x0 + 14, half, 228, 256 - half); ge.globalAlpha = 1; }
    }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x0, 0, 6, H);
  }
  grime(g, W, H, r, 0.08);
  return { map: tex(c, renderer), emissiveMap: tex(e, renderer) };
}

// Nhà cao tầng: lưới cửa kính, 2 ô × 2 tầng (4 m × 3,3 m mỗi ô).
export function modernFacade(renderer, frame, glass, seed) {
  const W = 256, H = 256, r = rng(seed);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const e = document.createElement('canvas'); e.width = W; e.height = H;
  const g = c.getContext('2d'), ge = e.getContext('2d');
  g.fillStyle = frame; g.fillRect(0, 0, W, H);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    const x0 = x * 128, y0 = y * 128;
    const grd = g.createLinearGradient(0, y0, 0, y0 + 128);
    grd.addColorStop(0, glass); grd.addColorStop(1, '#1b2a33');
    g.fillStyle = grd; g.fillRect(x0 + 8, y0 + 14, 112, 92);
    if (r() < 0.4) { ge.fillStyle = r() < 0.5 ? '#fff1cf' : '#d8ecff'; ge.fillRect(x0 + 8, y0 + 14, 112, 92); }
  }
  return { map: tex(c, renderer), emissiveMap: tex(e, renderer) };
}

export function textSprite(text, { size = 64, color = '#fff', bg = null, font = 'bold' } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `${font} ${size}px "Be Vietnam Pro", system-ui, sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + size;
  c.width = w; c.height = size * 1.5;
  g.font = `${font} ${size}px "Be Vietnam Pro", system-ui, sans-serif`;
  if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, c.width, c.height, size * 0.3); g.fill(); }
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2 + size * 0.05);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return { tex: t, aspect: c.width / c.height };
}
