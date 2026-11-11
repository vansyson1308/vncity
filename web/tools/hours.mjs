// Chụp CÙNG một góc nhìn ở nhiều giờ trong ngày chỉ với một lần nạp game, ghép thành một bảng, và đo độ sáng từng khung
// (bắt lỗi "khung hình đen", phơi sáng nhảy). Dùng khi chỉnh bầu trời, sương, đèn đêm (src/engine/sky.js).
//   node tools/hours.mjs outdir/ "q=medium&at=60,-120"                 đủ 24 giờ (0..23)
//   node tools/hours.mjs outdir/ "q=medium&street=Phố Tràng Tiền" 5,5.75,6,17.5,18,18.25,18.5,19   các giờ tự chọn
// Tham số game như tools/shot.mjs (thêm weather=mu|thu|he|nom). Biến môi trường: W, H (cỡ ảnh, mặc định 960×540), CHROME_PATH.
// Kết quả: outdir/hNN.NN.png, outdir/sheet.png (bảng ghép) và một dòng số liệu cho mỗi giờ; thoát mã 1 nếu có khung quá tối.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const [out, query, list] = process.argv.slice(2);
if (!out || !query) { console.error('Dùng: node tools/hours.mjs <outdir/> "<tham số>" [giờ,giờ,...]'); process.exit(2); }
const hours = list ? list.split(',').map(Number) : Array.from({ length: 24 }, (_, i) => i);
fs.mkdirSync(out, { recursive: true });
const W = +(process.env.W || 960), H = +(process.env.H || 540);
const server = await createServer({ root: path.resolve(new URL('..', import.meta.url).pathname), server: { port: 5300 + Math.floor(Math.random() * 400), strictPort: false, hmr: false, watch: null }, logLevel: 'error' });
await server.listen(); const base = `http://localhost:${server.httpServer.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } }); const errs = [];
page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); }); // phông chữ nối tắt từ thư mục khác bị Vite từ chối: bỏ qua
await page.goto(`${base}/?shot&fresh&h=${hours[0]}&${query.replace(/^[?&]/, '')}`);
try { await page.waitForFunction(() => window.__ready === true || window.__bootError !== undefined, null, { timeout: 600000 }); } catch { errs.push('quá thời gian chờ dựng cảnh'); }
let bad = 0; const shots = [];
for (const h of hours) {
  // đổi giờ rồi chờ vài khung hình cho bóng đổ, đèn, sương cập nhật xong
  const m = await page.evaluate((hh) => new Promise((res) => {
    const g = window.__game; g.sky.setHours(hh);
    let n = 0; const f = () => {
      if (++n < 9) return requestAnimationFrame(f); // đủ lâu để đồng hồ trên màn hình cũng kịp đổi
      const cv = document.getElementById('game'), c = document.createElement('canvas'); c.width = 160; c.height = 90;
      const x = c.getContext('2d'); x.drawImage(cv, 0, 0, 160, 90); const d = x.getImageData(0, 0, 160, 90).data;
      let sum = 0, dark = 0, top = 0; for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; sum += l; if (l < 10) dark++; if (i < 160 * 30 * 4) top += l; }
      res({ mean: sum / (d.length / 4), dark: dark / (d.length / 4), sky: top / (160 * 30), exp: g.sky.exposure, el: g.sky.elevation, fog: '#' + g.scene.fog.color.getHexString(), dens: g.scene.fog.density });
    }; requestAnimationFrame(f);
  }), h);
  const file = path.join(out, `h${h.toFixed(2).padStart(5, '0')}.png`); await page.screenshot({ path: file, timeout: 600000 }); shots.push([h, file]);
  // khung hình đen: độ sáng trung bình dưới 14/255 hoặc hơn 55% điểm ảnh gần như đen; phơi sáng phải hữu hạn
  const fail = !(m.mean >= 14) || m.dark > 0.55 || !Number.isFinite(m.exp); if (fail) bad++;
  console.log(`${fail ? '✗' : '✓'} ${String(h).padStart(5)}h  mặt trời ${m.el.toFixed(1).padStart(6)}°  sáng TB ${m.mean.toFixed(1).padStart(5)}  trời ${m.sky.toFixed(1).padStart(5)}  điểm đen ${(m.dark * 100).toFixed(0).padStart(3)}%  phơi sáng ${m.exp.toFixed(2)}  sương ${m.fog} ρ=${m.dens.toFixed(5)}`);
}
if (errs.length) { console.log('lỗi trang:', [...new Set(errs)].slice(0, 3).join(' | ')); bad++; }
// bảng ghép: 6 cột
const cols = Math.min(6, shots.length), tw = 320, th = Math.round((tw * H) / W), rows = Math.ceil(shots.length / cols);
const sheet = await browser.newPage({ viewport: { width: cols * tw, height: rows * th } });
await sheet.setContent(`<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(${cols},${tw}px)">${shots.map(([h, f]) => `<div style="position:relative;width:${tw}px;height:${th}px"><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}" style="width:100%;height:100%;display:block"><b style="position:absolute;right:4px;bottom:2px;font:bold 15px sans-serif;color:#fff;text-shadow:0 0 3px #000,0 0 3px #000">${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}</b></div>`).join('')}</body>`);
await sheet.screenshot({ path: path.join(out, 'sheet.png') });
await browser.close(); await server.close();
process.exit(bad ? 1 : 0);
