// Xưởng vẽ, bản dòng lệnh: soát lỗi mọi mô hình thủ tục và (tuỳ chọn) chụp bảng 6 góc nhìn của từng mô hình.
//   node tools/studio.mjs                      soát lỗi tất cả (chạy thuần Node, dùng trong CI)
//   node tools/studio.mjs lm:thap_rua bike     chỉ vài mô hình; thêm --verbose để in toạ độ các chỗ trùng mặt
//   node tools/studio.mjs --shots out/ [tên]   chụp bảng 6 góc (cần Chromium; CHROME_PATH để chỉ định), thêm --query "&tags" nếu muốn
// Mã thoát 1 nếu có mô hình vượt ngân sách tam giác hoặc có toạ độ hỏng.
import fs from 'node:fs';
import path from 'node:path';
import { G } from '../src/core/geo.js';
import { ALL, BUDGET, buildModel } from '../dev/models.js';
import { lint } from '../dev/lint.js';

const args = process.argv.slice(2), opt = {}; const names = [];
for (let i = 0; i < args.length; i++) { if (args[i] === '--shots') opt.shots = args[++i]; else if (args[i] === '--query') opt.query = args[++i]; else if (args[i] === '--verbose') opt.verbose = true; else names.push(args[i]); }
const list = names.length ? names : ALL;
let failed = 0; const rows = [];
for (const name of list) {
  const g = new G(), lf = new G();
  try { await buildModel(name, g, lf, (id) => import(`../src/world/landmarks/${id}.js`)); }
  catch (e) { console.error(`LỖI dựng ${name}: ${e.message}`); failed++; continue; }
  const rep = lint(g.pack(), { budget: BUDGET[name] || 8000 });
  rows.push([name, rep]); if (rep.err.length) failed++;
}
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('mô hình', 22), pad('tam giác', 9), pad('rộng×cao×sâu (m)', 24), pad('trơn', 6), pad('trùng mặt', 10), 'ghi chú');
for (const [name, r] of rows) { if (opt.verbose && r.fights.length) console.log('   chỗ trùng mặt lớn nhất của', name + ':\n' + r.fights.map((f) => `     ${f.f} m²  từ [${f.at}] tới [${f.to}]`).join('\n')); }
for (const [name, r] of rows) console.log(pad(name, 22), pad(r.tris, 9), pad(r.size.join(' × '), 24), pad(r.plain + '%', 6), pad(r.fight + ' m²', 10), [...r.err.map((e) => 'LỖI: ' + e), ...r.warn].join(' | ') || '✓');

if (opt.shots) {
  const { chromium } = await import('playwright'), { createServer } = await import('vite');
  const out = path.resolve(opt.shots); fs.mkdirSync(out, { recursive: true });
  const server = await createServer({ root: path.resolve(new URL('..', import.meta.url).pathname), server: { port: 5199, strictPort: false }, logLevel: 'error' }); await server.listen();
  const port = server.config.server.port, addr = server.httpServer.address(), base = `http://localhost:${addr.port || port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const name of list) {
    const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } }); const errs = [];
    page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
    await page.goto(`${base}/dev/studio.html?m=${encodeURIComponent(name)}${opt.query || ''}`);
    try { await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 }); } catch { errs.push('quá thời gian chờ'); }
    const file = path.join(out, name.replace(/[:/]/g, '_') + '.jpg');
    await page.screenshot({ path: file, type: 'jpeg', quality: 86, timeout: 240000 });
    console.log(errs.length ? `✗ ${name}: ${errs[0]}` : `✓ ${file}`); if (errs.length) failed++;
    await page.close();
  }
  await browser.close(); await server.close();
}
if (failed) { console.error(`\n${failed} mô hình có lỗi`); process.exit(1); }
