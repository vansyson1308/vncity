// MỤC 10: KHỞI ĐỘNG
//   k1) mở ở cả ba mức chất lượng (low, medium, high), CÓ VẼ THẬT, theo đúng đường người chơi đi (màn hình tải → nút Bắt đầu):
//       không lỗi console, không pageerror, không tài nguyên 404; game vẽ được khung hình không đen;
//   k2) trình duyệt không tạo được WebGL2 (getContext trả null; getContext ném lỗi; chỉ có WebGL1): màn hình tải hiện lời giải thích
//       dễ hiểu bằng đúng ngôn ngữ, có hướng dẫn khắc phục, không có chữ kỹ thuật kiểu "is not a function";
//   k3) tải lại 5 lần liên tiếp, lần nào cũng vào được game;
//   k4) bộ nhớ trình duyệt bị chặn (localStorage ném lỗi, như chế độ riêng tư nghiêm ngặt): vẫn vào được game;
//   k5) tệp bản đồ không tải được: có báo lỗi trên màn hình tải, không treo im lặng.
// Dùng: node tools/qa/boot.mjs [k1] [k2] [k3] [k4] [k5]
import path from 'node:path';
import { launch, openGame, Report, frameStats, OUT, BASE, SLOW, fx } from './lib.mjs';

const want = (k) => process.argv.length <= 2 || process.argv.slice(2).includes(k);
const R = new Report('boot');
const browser = await launch();

if (want('k1')) for (const q of ['low', 'medium', 'high']) {
  const t0 = Date.now();
  let o; try { o = await openGame(browser, `q=${q}&fresh&lang=vi&h=10`, { start: 'click', viewport: { width: 960, height: 540 } }); } catch (e) { R.check(`k1 ${q}: vào được game qua nút Bắt đầu`, false, String(e.message).slice(0, 300)); continue; }
  const page = o.page;
  // cho game vẽ thêm vài khung hình thật rồi đọc số liệu
  await page.evaluate(() => window.__qa.waitFrames(4));
  const info = await page.evaluate(() => ({ ...window.__info, started: window.__game.G.started, q: window.__game.chunks.q.name, hud: !document.getElementById('hud').classList.contains('hidden'), bad: window.__qa.finite(), lost: window.__game.R.r.getContext().isContextLost(), programs: window.__game.R.r.info.programs.length }));
  await page.screenshot({ path: path.join(OUT, `boot_${q}.png`), timeout: SLOW }).catch(() => {});
  R.check(`k1 ${q}: vào được game qua nút Bắt đầu, đúng mức chất lượng, HUD hiện, có ô phố và lệnh vẽ`, info.started && info.q === q && info.hud && info.chunks >= 12 && info.calls > 10 && info.tris > 10000 && !info.lost && info.bad.length === 0, `${fx((Date.now() - t0) / 1000, 0)} giây; ${JSON.stringify({ chunks: info.chunks, calls: info.calls, tris: info.tris, programs: info.programs, agents: info.agents, people: info.people, fps: info.fps })}`);
  R.check(`k1 ${q}: không lỗi console, không pageerror, không tài nguyên lỗi`, o.errors.length === 0, `${o.errors.length} lỗi: ${o.errors.slice(0, 4).join(' | ')}`);
  await o.ctx.close();
  // cùng mức đó với ?shot (giữ bộ đệm vẽ) để đo điểm ảnh: khung hình không đen, không cháy trắng
  try {
    const s = await openGame(browser, `q=${q}&fresh&lang=vi&h=10`, { viewport: { width: 640, height: 360 } });
    await s.page.evaluate(() => window.__qa.waitFrames(3)); const fs2 = await frameStats(s.page);
    R.check(`k1 ${q}: khung hình lúc 10 giờ sáng ở điểm xuất phát không đen, không cháy trắng (độ sáng trung bình 40–235/255, điểm ảnh đen < 20%)`, fs2.mean > 40 && fs2.mean < 235 && fs2.dark < 0.2 && s.errors.length === 0, `độ sáng ${fx(fs2.mean, 1)}, đen ${fx(fs2.dark * 100, 1)}%, lỗi: ${s.errors.slice(0, 2).join(' | ') || 'không'}`);
    await s.ctx.close();
  } catch (e) { R.check(`k1 ${q}: khung hình đo được`, false, String(e.message).slice(0, 200)); }
}

if (want('k2')) {
  const cases = [
    ['getContext trả null cho mọi webgl', () => { const o = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : o.call(this, t, ...a); }; }],
    ['getContext("webgl2") ném lỗi', () => { const o = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { if (t === 'webgl2') throw new Error('Failed to create WebGL2 context'); return /webgl/.test(t) ? null : o.call(this, t, ...a); }; }],
    ['chỉ có WebGL1 (webgl2 null, webgl dùng được)', () => { const o = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return t === 'webgl2' ? null : o.call(this, t, ...a); }; }],
  ];
  for (const [name, init] of cases) for (const [lang, vp] of [['vi', { width: 960, height: 540 }], ['en', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp }), page = await ctx.newPage(), errs = [];
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    await page.addInitScript(init);
    await page.goto(`${BASE}?fresh&lang=${lang}`, { timeout: SLOW });
    await page.waitForFunction(() => window.__bootError !== undefined || window.__ready === true, null, { timeout: 180000 }).catch(() => {});
    const e = await page.evaluate(() => { const lt = document.getElementById('loadtext'), r = lt.getBoundingClientRect(), ld = document.getElementById('loading'); return { code: window.__bootError, ready: window.__ready === true, text: lt.textContent, rect: [r.left, r.top, r.right, r.bottom], loadingShown: !ld.classList.contains('hidden'), startShown: !document.getElementById('start').classList.contains('hidden'), bar: getComputedStyle(document.getElementById('bar')).backgroundColor, iw: innerWidth, ih: innerHeight, sw: document.documentElement.scrollWidth }; });
    await page.screenshot({ path: path.join(OUT, `boot_nowebgl_${lang}_${cases.findIndex((c) => c[0] === name)}.png`) }).catch(() => {});
    const tech = /is not a function|TypeError|ReferenceError|undefined|null|NaN|\[object|at \w+ \(|stack|getContext|\.js:\d+/i.test(e.text);
    const explains = /WebGL/i.test(e.text) && e.text.length > 60, hasFix = lang === 'vi' ? /(trình duyệt|tăng tốc|cập nhật|bật|thử)/i.test(e.text) : /(browser|hardware|acceleration|update|enable|try)/i.test(e.text);
    const rightLang = lang === 'vi' ? /[ăâđêôơưàáạảãèéẹẻẽìíịòóọỏõùúụủũ]/i.test(e.text) : !/[ăđơưạảãẹẻẽịọỏõụủũ]/i.test(e.text);
    const fits = e.rect[0] >= 0 && e.rect[2] <= e.iw + 1 && e.rect[3] <= e.ih + 1 && e.sw <= e.iw + 1;
    R.check(`k2 [${lang}, ${vp.width}×${vp.height}] ${name}: báo lỗi dễ hiểu, đúng ngôn ngữ, có cách khắc phục, không chữ kỹ thuật, nằm gọn trong khung`, e.code === 'NO_WEBGL2' && !e.ready && e.loadingShown && !e.startShown && explains && hasFix && rightLang && !tech && fits && errs.length === 0, `mã ${e.code}; chữ: "${e.text.replace(/\s+/g, ' ').slice(0, 220)}"; khung chữ [${e.rect.map((v) => fx(v, 0))}] trong ${e.iw}×${e.ih}; ${errs.join(' | ')}`);
    await ctx.close();
  }
}

if (want('k3')) {
  const o = await openGame(browser, 'q=low&fresh&lang=vi&h=10', { start: 'click', viewport: { width: 960, height: 540 } });
  const times = []; let okN = 0;
  for (let i = 1; i <= 5; i++) {
    const t0 = Date.now();
    try {
      await o.page.reload({ timeout: SLOW });
      await o.page.waitForFunction(() => window.__ready === true || window.__bootError !== undefined, null, { timeout: SLOW });
      const be = await o.page.evaluate(() => window.__bootError); if (be !== undefined) throw new Error('lỗi khởi động: ' + be);
      await o.page.click('#play', { timeout: SLOW }); await o.page.waitForFunction(() => window.__game.G.started === true, null, { timeout: SLOW });
      const s = await o.page.evaluate(async () => { await window.__qa.waitFrames(2); return { chunks: window.__info.chunks, bad: window.__qa.finite(), calls: window.__info.calls }; });
      if (s.chunks >= 12 && s.bad.length === 0 && s.calls > 10) okN++; times.push(fx((Date.now() - t0) / 1000, 0));
    } catch (e) { times.push('HỎNG: ' + String(e.message).slice(0, 80)); }
  }
  R.check('k3: tải lại 5 lần liên tiếp, lần nào cũng vào được game và vẽ được, không lỗi', okN === 5 && o.errors.length === 0, `${okN}/5; thời gian mỗi lần (giây): ${times.join(', ')}; lỗi: ${o.errors.slice(0, 3).join(' | ') || 'không'}`);
  await o.ctx.close();
}

if (want('k4')) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } }); // (ở 640×360 nút Bắt đầu nằm ngoài khung: xem startscreen.mjs)
  await ctx.addInitScript(() => { const boom = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); }; Object.defineProperty(window, 'localStorage', { get: boom, configurable: true }); });
  let res; try { const o = await openGame(browser, 'q=low&lang=vi&h=10', { context: ctx, start: 'click', norender: true }); res = await o.page.evaluate(async () => { const g = window.__game; await window.__qa.virtual(); const it = g.passport.byId.get('thap_but_dai_nghien'); g.player.teleport(it.x + 1, it.z + 1); window.__qa.step(30); return { started: g.G.started, stamps: g.passport.visited.size, bad: window.__qa.finite() }; }); res.errors = o.errors; } catch (e) { res = { err: String(e.message).slice(0, 300) }; }
  R.check('k4: localStorage bị chặn (ném SecurityError): vẫn vào được game, vẫn đóng được dấu, không lỗi', !!res.started && res.stamps >= 1 && res.bad.length === 0 && res.errors.length === 0, JSON.stringify(res).slice(0, 400));
  await ctx.close();
}

if (want('k5')) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } }), page = await ctx.newPage();
  await page.route('**/world/hanoi.json', (r) => r.fulfill({ status: 404, body: 'not found' }));
  await page.goto(`${BASE}?fresh&lang=vi&q=low`, { timeout: SLOW });
  await page.waitForFunction(() => window.__bootError !== undefined || window.__ready === true, null, { timeout: 120000 }).catch(() => {});
  const e = await page.evaluate(() => ({ code: window.__bootError, ready: window.__ready === true, text: document.getElementById('loadtext').textContent, bar: document.getElementById('bar').style.background }));
  R.check('k5: tệp bản đồ không tải được (404): màn hình tải báo lỗi (không treo im lặng ở "Đang tải…")', e.code !== undefined && !e.ready && /lỗi|không tải/i.test(e.text), `mã "${e.code}"; chữ: "${e.text.slice(0, 160)}"`);
  await ctx.close();
}
await browser.close();
process.exit(R.finish());
