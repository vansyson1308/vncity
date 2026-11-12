// "Bảng đồ đạc đường phố": bảng chữ thứ hai, vẽ bằng canvas lúc khởi động (luồng chính), gồm biển tên của MỌI con phố,
// ngõ có trong bản đồ (bố cục ở streetnames.js, worker tự tính được uv), chữ số đồng hồ đếm ngược, hình người đi bộ,
// biển xe buýt, biển P, khẩu hiệu băng rôn và rào công trường.
// Bảng chỉ có một kênh (R8): giá trị là độ phủ của nét chữ. Màu nền lấy từ màu đỉnh, màu chữ do shader chọn theo mã ghi
// trong kênh alpha của màu đỉnh; cùng mã đó điều khiển bóng đèn tín hiệu và số đếm ngược chạy theo uTime, không cần một
// dòng JavaScript nào mỗi khung hình.
import * as THREE from 'three';
import { plateLayout, plateText, BANNERS, SITE_TEXT, WARN_TEXT } from './streetnames.js';
import { SIGNAL } from './junctions.js';

const FONT = '"Be Vietnam Pro", Arial, sans-serif';

// Viết một dòng chữ vừa bề rộng maxW: trước hết ép hẹp chữ (biển thật dùng chữ hẹp), hết mức mới giảm cỡ.
function fitText(g, text, cx, baseY, size, weight, maxW, minSx = 0.62) {
  g.font = `${weight} ${size}px ${FONT}`;
  let w = g.measureText(text).width, sx = 1;
  if (w > maxW) { sx = Math.max(minSx, maxW / w); if (w * sx > maxW) { size *= maxW / (w * sx); g.font = `${weight} ${size}px ${FONT}`; w = g.measureText(text).width; } }
  g.save(); g.translate(cx, baseY); g.scale(sx, 1); g.fillText(text, 0, 0); g.restore();
}

// Biển tên phố: viền trắng mảnh chạy cách mép, bốn góc viền lượn vào trong; dòng nhỏ loại đường, dòng lớn tên phố.
function drawPlate(g, x, y, w, h, top, name) {
  const m = w * 0.043, r = h * 0.12, x0 = x + m, y0 = y + m, x1 = x + w - m, y1 = y + h - m;
  g.lineWidth = Math.max(1.4, w * 0.011); g.beginPath();
  g.moveTo(x0 + r, y0); g.lineTo(x1 - r, y0); g.arc(x1, y0, r, Math.PI, Math.PI / 2, true);
  g.lineTo(x1, y1 - r); g.arc(x1, y1, r, -Math.PI / 2, Math.PI, true);
  g.lineTo(x0 + r, y1); g.arc(x0, y1, r, 0, -Math.PI / 2, true);
  g.lineTo(x0, y0 + r); g.arc(x0, y0, r, Math.PI / 2, 0, true); g.closePath(); g.stroke();
  fitText(g, top, x + w / 2, y + h * 0.345, h * 0.17, 600, w * 0.7, 0.7);
  fitText(g, name, x + w / 2, y + h * 0.785, h * 0.37, 800, w * 0.82);
}
// chữ số kiểu đèn LED bảy thanh trong ô (x, y, w, h)
const SEG = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abfgcd'];
function drawDigit(g, x, y, w, h, d) {
  const t = w * 0.2, x0 = x + w * 0.16, x1 = x + w * 0.84, y0 = y + h * 0.1, y1 = y + h * 0.9, ym = (y0 + y1) / 2, s = SEG[d], e = t * 0.25;
  const H = (yy) => g.fillRect(x0 + e, yy - t / 2, x1 - x0 - 2 * e, t), V = (xx, ya, yb) => g.fillRect(xx - t / 2, ya + e, t, yb - ya - 2 * e);
  if (s.includes('a')) H(y0 + t / 2); if (s.includes('g')) H(ym); if (s.includes('d')) H(y1 - t / 2);
  if (s.includes('f')) V(x0 + t / 2, y0, ym); if (s.includes('b')) V(x1 - t / 2, y0, ym); if (s.includes('e')) V(x0 + t / 2, ym, y1); if (s.includes('c')) V(x1 - t / 2, ym, y1);
}
// hình người của đèn đi bộ: đứng (đỏ) hoặc đang bước (xanh)
function drawMan(g, x, y, w, h, walk) {
  const cx = x + w / 2, u = h / 10; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.arc(cx + (walk ? u * 0.3 : 0), y + u * 1.7, u * 0.85, 0, 7); g.fill();
  g.lineWidth = u * 1.25; g.beginPath(); g.moveTo(cx + (walk ? u * 0.2 : 0), y + u * 3.2); g.lineTo(cx, y + u * 5.9); g.stroke();
  g.lineWidth = u * 0.85; g.beginPath();
  if (walk) { g.moveTo(cx, y + u * 5.8); g.lineTo(cx - u * 1.6, y + u * 9.2); g.moveTo(cx, y + u * 5.8); g.lineTo(cx + u * 1.5, y + u * 7.6); g.lineTo(cx + u * 1.8, y + u * 9.2); g.moveTo(cx + u * 0.2, y + u * 3.4); g.lineTo(cx - u * 1.6, y + u * 4.9); g.moveTo(cx + u * 0.2, y + u * 3.4); g.lineTo(cx + u * 1.7, y + u * 4.6); }
  else { g.moveTo(cx - u * 0.45, y + u * 5.8); g.lineTo(cx - u * 0.5, y + u * 9.2); g.moveTo(cx + u * 0.45, y + u * 5.8); g.lineTo(cx + u * 0.5, y + u * 9.2); g.moveTo(cx - u * 0.9, y + u * 3.3); g.lineTo(cx - u * 1.05, y + u * 5.6); g.moveTo(cx + u * 0.9, y + u * 3.3); g.lineTo(cx + u * 1.05, y + u * 5.6); }
  g.stroke();
}
function drawStar(g, cx, cy, R) { g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? R * 0.382 : R; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fill(); }
function drawSickle(g, cx, cy, R) { // búa liềm cách điệu
  g.lineCap = 'round'; g.lineWidth = R * 0.2;
  g.beginPath(); g.arc(cx + R * 0.05, cy - R * 0.05, R * 0.62, -Math.PI * 0.62, Math.PI * 0.72); g.stroke(); // lưỡi liềm
  g.beginPath(); g.moveTo(cx - R * 0.36, cy + R * 0.42); g.lineTo(cx - R * 0.62, cy + R * 0.7); g.stroke();   // cán liềm
  g.lineWidth = R * 0.17; g.beginPath(); g.moveTo(cx + R * 0.62, cy + R * 0.72); g.lineTo(cx - R * 0.3, cy - R * 0.2); g.stroke(); // cán búa
  g.save(); g.translate(cx - R * 0.38, cy - R * 0.28); g.rotate(-Math.PI / 4); g.fillRect(-R * 0.3, -R * 0.14, R * 0.6, R * 0.28); g.restore(); // đầu búa
}
// biển điểm dừng xe buýt (đứng 0,5 × 0,75 m): hình xe buýt, chữ "ĐIỂM DỪNG XE BUÝT". Vẽ trong khung (0,0)-(w,h) đã xoay sẵn.
function drawBus(g, w, h) {
  const bx = w * 0.14, by = h * 0.1, bw = w * 0.72, bh = h * 0.4, r = w * 0.07;
  g.beginPath(); if (g.roundRect) g.roundRect(bx, by, bw, bh, r); else g.rect(bx, by, bw, bh); g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.fillRect(bx + bw * 0.1, by + bh * 0.14, bw * 0.8, bh * 0.36); // kính trước
  g.beginPath(); g.arc(bx + bw * 0.2, by + bh * 0.76, bw * 0.07, 0, 7); g.arc(bx + bw * 0.8, by + bh * 0.76, bw * 0.07, 0, 7); g.fill(); // đèn
  g.globalCompositeOperation = 'source-over';
  g.fillRect(bx + bw * 0.08, by + bh, bw * 0.18, h * 0.04); g.fillRect(bx + bw * 0.74, by + bh, bw * 0.18, h * 0.04); // bánh xe
  g.fillRect(bx - w * 0.05, by + bh * 0.22, w * 0.035, bh * 0.25); g.fillRect(bx + bw + w * 0.015, by + bh * 0.22, w * 0.035, bh * 0.25); // gương
  g.textAlign = 'center';
  fitText(g, 'ĐIỂM DỪNG', w / 2, h * 0.72, h * 0.105, 800, w * 0.84);
  fitText(g, 'XE BUÝT', w / 2, h * 0.86, h * 0.105, 800, w * 0.84);
}

// Dựng texture. Vẽ từng hàng ô vào một canvas dải rồi chép kênh đỏ sang mảng một kênh (không bao giờ cần canvas 4096²).
export async function streetAtlas(renderer, world, quality) {
  try { await Promise.race([Promise.all([document.fonts.load(`800 40px ${FONT}`, 'PHỐ'), document.fonts.load(`600 20px ${FONT}`, 'PHỐ')]), new Promise((r) => setTimeout(r, 5000))]); } catch { /* dùng phông hệ thống */ }
  const L = plateLayout(world), S = quality.name === 'low' || renderer.capabilities.maxTextureSize < 4096 ? 2048 : 4096;
  const data = new Uint8Array(S * S), rowH = Math.ceil(S * L.ch) + 2;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = rowH;
  const g = cv.getContext('2d', { willReadFrequently: true });
  // ô chữ [u0,v0,u1,v1] → khung điểm ảnh trên bảng (gốc trên trái)
  const px = (uv) => [uv[0] * S, (1 - uv[3]) * S, (uv[2] - uv[0]) * S, (uv[3] - uv[1]) * S];
  const rows = Array.from({ length: L.rows }, () => []);
  const add = (uv, fn) => { const q = px(uv); rows[Math.min(L.rows - 1, Math.floor(((q[1] + q[3] / 2) / S) * L.rows))].push(() => fn(...q)); };
  L.names.forEach((name, i) => { const [top, big] = plateText(name); add(L.uv(i), (x, y, w, h) => drawPlate(g, x, y, w, h, top, big)); });
  for (let d = 0; d < 10; d++) add([L.digit[0] + d * L.digitStep, L.digit[1], L.digit[2] + d * L.digitStep, L.digit[3]], (x, y, w, h) => drawDigit(g, x, y, w, h, d));
  add(L.pedStop, (x, y, w, h) => drawMan(g, x, y, w, h, false)); add(L.pedGo, (x, y, w, h) => drawMan(g, x, y, w, h, true));
  add(L.star, (x, y, w, h) => drawStar(g, x + w / 2, y + h * 0.52, Math.min(w, h) * 0.4));
  add(L.sickle, (x, y, w, h) => drawSickle(g, x + w / 2, y + h / 2, Math.min(w, h) * 0.46));
  add(L.bus, (x, y, w, h) => { g.save(); g.translate(x + w, y); g.rotate(Math.PI / 2); drawBus(g, h, w); g.restore(); }); // biển đứng vẽ xoay 90 độ trong ô nằm
  add(L.park, (x, y, w, h) => fitText(g, 'P', x + w / 2, y + h * 0.86, h * 1.0, 800, w * 0.9));
  L.site.forEach((uv, i) => add(uv, (x, y, w, h) => { const [a, b] = SITE_TEXT[i]; if (b) { fitText(g, a, x + w / 2, y + h * 0.47, h * 0.38, 800, w * 0.96); fitText(g, b, x + w / 2, y + h * 0.9, h * 0.34, 800, w * 0.96); } else fitText(g, a, x + w / 2, y + h * 0.74, h * 0.62, 800, w * 0.96); }));
  add(L.warn, (x, y, w, h) => { fitText(g, WARN_TEXT[0], x + w / 2, y + h * 0.44, h * 0.42, 800, w * 0.94); fitText(g, WARN_TEXT[1], x + w / 2, y + h * 0.9, h * 0.36, 800, w * 0.96); });
  L.banner.forEach((uv, i) => add(uv, (x, y, w, h) => fitText(g, BANNERS[i], x + w / 2, y + h * 0.74, h * 0.6, 800, w * 0.95)));

  for (let row = 0; row < L.rows; row++) {
    const y0 = Math.floor((row * S) / L.rows), y1 = Math.min(S, Math.floor(((row + 1) * S) / L.rows));
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, S, rowH);
    g.setTransform(1, 0, 0, 1, 0, -y0); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    for (const fn of rows[row]) fn();
    const img = g.getImageData(0, 0, S, y1 - y0).data;
    for (let y = y0; y < y1; y++) { const dst = (S - 1 - y) * S, src = (y - y0) * S * 4; for (let x = 0; x < S; x++) data[dst + x] = img[src + x * 4]; } // hàng trên cùng của canvas là v = 1
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.unpackAlignment = 1;
  tex.anisotropy = Math.min(Math.max(4, quality.aniso), renderer.capabilities.getMaxAnisotropy()); tex.needsUpdate = true;
  return tex;
}

// Vật liệu của lưới biển tên phố, đèn tín hiệu: vật liệu đồ vật chuẩn (mats.makeProp) cộng thêm phần đọc bảng một kênh.
export async function streetMaterial(mats, renderer, world, quality) {
  const tex = await streetAtlas(renderer, world, quality), L = plateLayout(world), f = (v) => v.toFixed(6);
  const mat = mats.makeProp({ map: tex }), base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    base(sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vSig;').replace('#include <color_vertex>', '#include <color_vertex>\nvSig = color.a;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vSig;')
      .replace('#include <map_fragment>', 'vec3 sgEmit = vec3(0.0);')
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
        { float sgCode = floor(vSig * 255.0 + 0.5), sgKind = mod(sgCode, 8.0); vec2 sgUv = vMapUv;
          if (sgKind > 0.5) {
            // đèn tín hiệu: pha của nhóm này theo đồng hồ chung (khớp world/junctions.js signalState)
            float grp = mod(floor(sgCode / 8.0), 2.0), last8 = mod(floor(sgCode / 16.0), 2.0), off = mod(floor(sgCode / 32.0), 4.0);
            float tl = mod(uTime + off * ${f(SIGNAL.shift)} + grp * ${f(SIGNAL.cycle / 2)}, ${f(SIGNAL.cycle)});
            float st = tl < ${f(SIGNAL.green)} ? 3.0 : tl < ${f(SIGNAL.green + SIGNAL.amber)} ? 2.0 : 1.0; // 3 xanh, 2 vàng, 1 đỏ
            float rem = st > 2.5 ? ${f(SIGNAL.green)} - tl : ${f(SIGNAL.cycle)} - tl;
            if (sgKind < 3.5) { // bóng đèn: sáng khi đúng pha, tắt thì chỉ còn màu kính sẫm
              float on = 1.0 - step(0.5, abs(st - sgKind));
              sgEmit = diffuseColor.rgb * on * 1.2; diffuseColor.rgb *= mix(0.07, 1.0, on);
            } else if (sgKind < 5.5) { // hai chữ số đếm ngược: đỏ khi đèn đỏ, xanh khi đèn xanh, tắt khi đèn vàng
              float n = min(ceil(rem), 99.0), show = step(st, 1.5) + step(2.5, st);
              if (last8 > 0.5 && n > 8.0) show = 0.0; // thí điểm chỉ hiện 8 giây cuối
              float dg = sgKind < 4.5 ? floor(n / 10.0) : mod(n, 10.0);
              if (sgKind < 4.5 && n < 9.5) show = 0.0;
              sgUv.x += dg * ${f(L.digitStep)};
              float ink = texture2D(map, sgUv).r * show; vec3 lc = st > 2.5 ? vec3(0.02, 1.0, 0.25) : vec3(1.0, 0.03, 0.015);
              diffuseColor.rgb = mix(vec3(0.006), lc, ink); sgEmit = lc * ink * 1.6;
            } else { // đèn đi bộ: người đỏ đứng khi xe của nhánh này đang được đi, người xanh bước khi xe dừng
              float on = sgKind < 6.5 ? step(1.5, st) : 1.0 - step(1.5, st);
              float ink = texture2D(map, sgUv).r; vec3 lc = sgKind < 6.5 ? vec3(1.0, 0.1, 0.05) : vec3(0.08, 1.0, 0.35);
              diffuseColor.rgb = mix(vec3(0.006), lc * mix(0.06, 1.0, on), ink); sgEmit = lc * ink * on * 1.8;
            }
          } else { // chữ trên nền màu đỉnh: trắng, hoặc vàng, đỏ, xanh sẫm theo mã
            float ink = texture2D(map, sgUv).r;
            vec3 ic = sgCode > 127.5 ? vec3(1.0, 0.8, 0.02) : sgCode > 63.5 ? vec3(0.62, 0.02, 0.02) : sgCode > 31.5 ? vec3(0.02, 0.05, 0.2) : vec3(0.93);
            diffuseColor.rgb = mix(diffuseColor.rgb, ic, ink);
          }
        }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += sgEmit;');
  };
  mat.customProgramCacheKey = () => 'street-furniture-1';
  return mat;
}
