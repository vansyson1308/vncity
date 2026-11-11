// Kiểm thử khói: mở bản build trong Chromium, chờ game dựng xong, kiểm tra thế giới, công trình, lối chơi cơ bản,
// chụp ảnh và báo lỗi console. Dùng: node tools/smoke.mjs [thư mục ảnh]   (CHROME_PATH để chỉ định trình duyệt)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist'), OUT = path.resolve(process.argv[2] || 'shots');
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = http.createServer((req, res) => {
  const p = path.join(DIST, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [], fail = (m) => { errors.push(m); console.error('✗', m); }, ok = (m) => console.log('✓', m);
const SLOW = 300000; // máy CI không có GPU: một khung hình có thể mất cả giây

async function open(name, query) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('console', (m) => { if (m.type() === 'error') fail(`${name}: console: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', (e) => fail(`${name}: ${e.message}`));
  await page.goto(`http://localhost:${port}/?shot&q=low&fresh${query}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: SLOW });
  return page;
}
const info = (page) => page.evaluate(() => { const g = window.__game, i = g.R.r.info; return { ...window.__info, sites: g.sites.length, items: g.passport.items.length, visited: g.passport.visited.size, mode: g.player.mode, x: g.player.pos.x, z: g.player.pos.z, programs: i.programs.length }; });

// 1. Bắt đầu ở Bờ Hồ lúc chiều vàng: thế giới dựng xong, đủ công trình, trong ngân sách
{
  const page = await open('start', '&h=17.2');
  const a = await info(page); console.log('start', JSON.stringify(a));
  a.chunks >= 20 ? ok(`dựng ${a.chunks} ô phố`) : fail(`chỉ dựng được ${a.chunks} ô phố`);
  a.landmarks >= a.sites && a.sites >= 14 ? ok(`${a.landmarks} lưới công trình biểu tượng cho ${a.sites} vị trí`) : fail(`thiếu công trình: ${a.landmarks}/${a.sites}`);
  a.items >= 40 ? ok(`${a.items} điểm đóng dấu`) : fail(`thiếu điểm đóng dấu: ${a.items}`);
  a.calls < 260 ? ok(`${a.calls} lệnh vẽ`) : fail(`quá nhiều lệnh vẽ: ${a.calls}`);
  a.tris < 700000 ? ok(`${a.tris} tam giác`) : fail(`quá nhiều tam giác: ${a.tris}`);
  a.agents > 10 ? ok(`${a.agents} xe trong dòng xe`) : fail(`dòng xe trống: ${a.agents}`);
  await page.screenshot({ path: path.join(OUT, 'start.png'), timeout: SLOW });
  // đi tới Tháp Bút là có dấu đầu tiên; lên xe được
  await page.evaluate(() => { const g = window.__game, it = g.passport.byId.get('thap_but_dai_nghien'); g.player.teleport(it.x + 1, it.z + 1); });
  await page.waitForFunction(() => window.__game.passport.visited.size >= 1, null, { timeout: SLOW });
  ok('đóng được dấu đầu tiên');
  await page.keyboard.press('f');
  await page.waitForFunction(() => window.__game.player.mode === 'bike', null, { timeout: SLOW });
  ok('lên xe máy được');
  const b0 = await info(page);
  await page.keyboard.down('w');
  await page.waitForFunction((p) => Math.hypot(window.__game.player.pos.x - p[0], window.__game.player.pos.z - p[1]) > 1.5, [b0.x, b0.z], { timeout: SLOW });
  await page.keyboard.up('w');
  ok('xe chạy được');
  await page.screenshot({ path: path.join(OUT, 'bike.png'), timeout: SLOW });
  await page.close();
}
// 2. Phố cổ ban đêm và khu Ba Đình ban ngày: không lỗi shader, có đèn, có nhà
for (const [name, q] of [['hang_ma_dem', '&street=Phố Hàng Mã&h=20.5'], ['ba_dinh', '&at=-1700,-880&h=9']]) {
  const page = await open(name, q);
  const a = await info(page); console.log(name, JSON.stringify(a));
  a.chunks >= 12 ? ok(`${name}: ${a.chunks} ô phố`) : fail(`${name}: chỉ ${a.chunks} ô phố`);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), timeout: SLOW });
  await page.close();
}
// 3. Cầu có độ cao thật: đứng giữa cầu Chương Dương thì ở trên mặt cầu, đi xe dọc cầu không rơi; dưới gầm cầu vẫn là mặt đất, mặt nước
{
  const page = await open('cau_chuong_duong', '&at=1009.8,-1047.9&yaw=1.97&bike&h=10');
  const a = await page.evaluate(() => { const g = window.__game, n = g.nav; return { y: g.player.y, top: n.groundY(1009.8, -1047.9, Infinity), under: n.groundY(1009.8, -1047.9, 0), lb: n.groundY(701.6, -1616.2, Infinity), water: n.isWater(1009.8, -1047.9) }; });
  console.log('cầu', JSON.stringify(a));
  a.y > 6 && a.top > 6 ? ok(`mặt cầu Chương Dương cao ${a.top.toFixed(1)} m, người chơi đứng trên cầu`) : fail(`cầu Chương Dương không có độ cao: y=${a.y}, mặt cầu=${a.top}`);
  a.under < 0.5 && a.water ? ok('dưới gầm cầu là mặt sông') : fail(`gầm cầu sai: cao độ ${a.under}, nước ${a.water}`);
  a.lb > 7 ? ok(`mặt cầu Long Biên cao ${a.lb.toFixed(1)} m`) : fail(`cầu Long Biên không có độ cao: ${a.lb}`);
  await page.keyboard.down('w');
  await page.waitForFunction(() => Math.hypot(window.__game.player.pos.x - 1009.8, window.__game.player.pos.z + 1047.9) > 4, null, { timeout: SLOW });
  await page.keyboard.up('w');
  const y = await page.evaluate(() => window.__game.player.y);
  y > 6 ? ok('xe chạy dọc mặt cầu') : fail(`xe rơi khỏi mặt cầu: y=${y}`);
  await page.screenshot({ path: path.join(OUT, 'cau_chuong_duong.png'), timeout: SLOW });
  await page.close();
}
await browser.close(); server.close();
if (errors.length) { console.error(`\n${errors.length} lỗi`); process.exit(1); }
console.log('OK, ảnh trong', OUT);
