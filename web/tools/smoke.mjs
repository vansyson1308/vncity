// Kiểm thử khói: mở bản build trong Chromium, chờ game dựng xong, chụp ảnh, báo lỗi console.
// Dùng: node tools/smoke.mjs [thư mục ảnh]
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist'), OUT = path.resolve(process.argv[2] || 'shots');
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  const p = path.join(DIST, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const views = (process.env.VIEWS || 'start,night,oldquarter').split(',');
const VIEW = {
  start: '',
  night: '&time=night',
  oldquarter: '&at=-60,-560&time=afternoon',
  opera: '&at=480,560&time=sunset',
};
for (const v of views) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${v}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${v}: ${e.message}`));
  await page.goto(`http://localhost:${port}/?shot&q=low${VIEW[v] ?? ''}`);
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 240000 });
  await page.waitForTimeout(4000);
  if (v === 'walk') { await page.keyboard.down('w'); await page.waitForTimeout(3000); await page.keyboard.up('w'); }
  await page.screenshot({ path: path.join(OUT, `${v}.png`) });
  const info = await page.evaluate(() => ({ items: window.__game.tour.items.length, calls: window.__game.renderer.info.render.calls, tris: window.__game.renderer.info.render.triangles, pos: window.__game.player.pos }));
  console.log(v, JSON.stringify(info));
  await page.close();
}
await browser.close(); server.close();
if (errors.length) { console.error('Lỗi:\n' + errors.join('\n')); process.exit(1); }
console.log('OK, ảnh trong', OUT);
