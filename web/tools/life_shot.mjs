// Chụp trang soi người và xe (dev/life.html) không cần build:   node tools/life_shot.mjs outdir/ "set=bikes" "set=cars&h=20.5" ...
// Tham số xem chú thích đầu dev/life.html. Biến môi trường: W, H (cỡ ảnh, mặc định 1500×900), CHROME_PATH.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const [out, ...queries] = process.argv.slice(2);
if (!out || !queries.length) { console.error('Dùng: node tools/life_shot.mjs <outdir/> "<tham số>" ...'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ root: path.resolve(new URL('..', import.meta.url).pathname), server: { port: 5700 + Math.floor(Math.random() * 200), strictPort: false, hmr: false, watch: null }, logLevel: 'silent' });
await server.listen(); const base = `http://localhost:${server.httpServer.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let bad = 0;
for (const qs of queries) {
  const page = await browser.newPage({ viewport: { width: +(process.env.W || 1500), height: +(process.env.H || 900) } }); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/403|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 400)); });
  await page.goto(`${base}/dev/life.html?${qs}`);
  try { await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 }); } catch { errs.push('quá thời gian chờ'); }
  await page.waitForTimeout(+(process.env.WAIT || 300));
  const file = path.join(out, qs.replace(/[^a-z0-9.\-]+/gi, '_') + '.jpg');
  await page.screenshot({ path: file, type: 'jpeg', quality: 88, timeout: 240000 });
  const tris = await page.evaluate(() => window.__tris || null);
  console.log(errs.length ? `✗ ${file}: ${[...new Set(errs)].slice(0, 3).join(' | ')}` : `✓ ${file}`, tris ? JSON.stringify(tris) : ''); if (errs.length) bad++;
  await page.close();
}
await browser.close(); await server.close();
process.exit(bad ? 1 : 0);
