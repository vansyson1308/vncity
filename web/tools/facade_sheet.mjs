// Chụp bảng soát các lớp mặt đứng (và bảng chữ biển hiệu) để xem lại khi vẽ: không cần vào game.
//   node tools/facade_sheet.mjs out.png ["s=512&only=6,7,8,9&px=400" | "atlas"]
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const [out, query = ''] = process.argv.slice(2);
if (!out) { console.error('Dùng: node tools/facade_sheet.mjs <out.png> [tham số]'); process.exit(2); }
const server = await createServer({ root: path.resolve(new URL('..', import.meta.url).pathname), server: { port: 5800 + Math.floor(Math.random() * 100), strictPort: false, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1300, height: 900 } }); page.on('pageerror', (e) => console.error('LỖI', e.message));
await page.goto(`http://localhost:${server.httpServer.address().port}/dev/facades.html?${query}`);
await page.waitForFunction(() => document.title === 'ready', null, { timeout: 60000 });
await page.screenshot({ path: out, fullPage: true });
await browser.close(); await server.close();
