// Chụp ảnh trong game (không cần build): tự bật máy chủ dev của Vite ở một cổng trống, mở game với tham số cho trước,
// chờ dựng xong rồi chụp. Dùng để nhìn kết quả thật trong game khi làm đồ hoạ và khi QC.
//   node tools/shot.mjs out.png "q=medium&h=17.2&street=Phố Hàng Đào"          một ảnh
//   node tools/shot.mjs outdir/ "h=10&at=120,-210" "h=20.5&at=120,-210&yaw=1.5"  nhiều ảnh (0.png, 1.png, ...)
// Tham số game: q=low|medium|high, h=giờ, at=x,z (mét, gốc Hồ Gươm), street=Tên phố (&along=0..1), site=id công trình (&back=m),
//   yaw, bike, pitch, camyaw, zoom, lang. Luôn tự thêm shot&fresh. Biến môi trường: W, H (cỡ ảnh, mặc định 1280×720),
//   WAIT (ms chờ thêm sau khi dựng xong, mặc định 2500), EVAL (JavaScript chạy trong trang trước khi chụp),
//   CHROME_PATH. Máy không có GPU dựng bằng phần mềm nên mỗi ảnh mất một đến vài phút: chạy từng lệnh một.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const [out, ...queries] = process.argv.slice(2);
if (!out || !queries.length) { console.error('Dùng: node tools/shot.mjs <out.png | outdir/> "<tham số>" ...'); process.exit(2); }
const multi = queries.length > 1 || out.endsWith('/'); if (multi) fs.mkdirSync(out, { recursive: true }); else fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
const server = await createServer({ root: path.resolve(new URL('..', import.meta.url).pathname), server: { port: 5300 + Math.floor(Math.random() * 400), strictPort: false, hmr: false, watch: null }, logLevel: 'error' });
await server.listen(); const base = `http://localhost:${server.httpServer.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let bad = 0;
for (let i = 0; i < queries.length; i++) {
  const page = await browser.newPage({ viewport: { width: +(process.env.W || 1280), height: +(process.env.H || 720) } }); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await page.goto(`${base}/?shot&fresh&${queries[i].replace(/^[?&]/, '')}`);
  try { await page.waitForFunction(() => window.__ready === true || window.__bootError !== undefined, null, { timeout: 600000 }); } catch { errs.push('quá thời gian chờ dựng cảnh'); }
  if (process.env.EVAL) await page.evaluate(process.env.EVAL).catch((e) => errs.push('EVAL: ' + e.message));
  await page.waitForTimeout(+(process.env.WAIT || 2500));
  const file = multi ? path.join(out, `${i}.png`) : out;
  await page.screenshot({ path: file, timeout: 600000 });
  const info = await page.evaluate(() => (window.__info ? { calls: window.__info.calls, tris: window.__info.tris, js: window.__info.js, pos: window.__info.pos } : null));
  console.log(errs.length ? `✗ ${file}: ${[...new Set(errs)].slice(0, 3).join(' | ')}` : `✓ ${file}`, info ? JSON.stringify(info) : ''); if (errs.length) bad++;
  await page.close();
}
await browser.close(); await server.close();
process.exit(bad ? 1 : 0);
