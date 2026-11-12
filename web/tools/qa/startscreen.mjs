// MỤC 5 / MỤC 10 (bổ sung, tìm ra khi bài boot.mjs không bấm được nút Bắt đầu ở khung 640×360): MÀN HÌNH BẮT ĐẦU TRÊN KHUNG THẤP.
// Yêu cầu: ở mọi cỡ màn hình người chơi có thể dùng, nút "Bắt đầu dạo phố" phải nằm trọn trong khung nhìn (hoặc cuộn tới được) và bấm /
// chạm được; nếu không, người chơi không vào được game.
// Các cỡ thử: điện thoại nằm ngang (cảm ứng) ở cỡ đầy đủ và cỡ đã trừ thanh địa chỉ của trình duyệt; cửa sổ máy bàn thấp (không cảm ứng).
// Đo bằng getBoundingClientRect của nút và của tờ giấy giới thiệu; "chạm được" = document.elementFromPoint tại tâm nút trả về chính nút đó.
// Một lần tải cho mỗi loại máy (cảm ứng / bàn phím), đổi cỡ khung bằng setViewportSize khi màn hình bắt đầu còn hiện.
// Dùng: node tools/qa/startscreen.mjs
import path from 'node:path';
import { launch, openGame, Report, OUT, fx } from './lib.mjs';

const R = new Report('startscreen');
const browser = await launch();
const SETS = [
  ['cảm ứng', { hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, [[932, 430, 'iPhone 14 Pro Max ngang'], [844, 390, 'iPhone 12–14 ngang'], [844, 340, 'iPhone 12–14 ngang, trừ thanh trình duyệt'], [812, 375, 'iPhone X/11 Pro ngang'], [800, 360, 'Android 360×800 ngang'], [800, 300, 'Android 360×800 ngang, trừ thanh địa chỉ'], [740, 360, 'Android 360×740 ngang'], [667, 375, 'iPhone 8/SE2 ngang'], [640, 360, 'Android 360×640 ngang'], [568, 320, 'iPhone SE1 ngang'], [390, 844, 'iPhone dọc'], [360, 640, 'Android dọc'], [320, 568, 'iPhone SE1 dọc']]],
  ['bàn phím', {}, [[1920, 1080, 'Full HD'], [1366, 768, 'laptop'], [1280, 600, 'laptop, cửa sổ thấp'], [1024, 500, 'cửa sổ nhỏ'], [960, 540, 'nửa màn hình'], [800, 450, 'cửa sổ nhỏ'], [640, 360, 'cửa sổ rất nhỏ']]],
];
for (const [kind, ctxOpts, sizes] of SETS) for (const lang of ['vi', 'en']) {
  const o = await openGame(browser, `q=low&fresh&lang=${lang}`, { viewport: { width: sizes[0][0], height: sizes[0][1] }, ctx: ctxOpts, norender: true, start: 'none' });
  const rows = [];
  for (const [w, h, name] of sizes) {
    await o.page.setViewportSize({ width: w, height: h }); await o.page.waitForTimeout(250);
    const m = await o.page.evaluate(() => { const p = document.getElementById('play'), r = p.getBoundingClientRect(), paper = document.querySelector('#start .paper'), pr = paper.getBoundingClientRect(), st = document.getElementById('start');
      const scrollers = [paper, st, document.scrollingElement, document.body].filter((e) => e && e.scrollHeight > e.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(e).overflowY));
      // cuộn thử: sau khi gọi scrollIntoView, nút có vào trong khung không
      p.scrollIntoView({ block: 'center' }); const r2 = p.getBoundingClientRect(), cx = r2.left + r2.width / 2, cy = r2.top + r2.height / 2, hit = cx >= 0 && cy >= 0 && cx < innerWidth && cy < innerHeight ? document.elementFromPoint(cx, cy) : null;
      const h1 = document.querySelector('#start h1').getBoundingClientRect();
      return { iw: innerWidth, ih: innerHeight, btn: [r2.left, r2.top, r2.right, r2.bottom], paper: [pr.left, pr.top, pr.right, pr.bottom], scroll: scrollers.length > 0, hit: !!hit && (hit === p || p.contains(hit)), h1: [h1.top, h1.bottom], shown: !st.classList.contains('hidden') }; });
    const full = m.btn[0] >= 0 && m.btn[1] >= 0 && m.btn[2] <= m.iw && m.btn[3] <= m.ih, vis = Math.max(0, Math.min(m.btn[3], m.ih) - Math.max(m.btn[1], 0)), cut = Math.max(0, -m.paper[1]) + Math.max(0, m.paper[3] - m.ih);
    rows.push({ w, h, name, full, tappable: m.hit, visPx: fx(vis, 0), btnH: fx(m.btn[3] - m.btn[1], 0), paperCut: fx(cut, 0), titleCut: m.h1[0] < 0, scroll: m.scroll, btn: m.btn.map((v) => Math.round(v)), paper: m.paper.map((v) => Math.round(v)) });
    if (!full || cut > 40) await o.page.screenshot({ path: path.join(OUT, `start_${kind === 'cảm ứng' ? 'touch' : 'desk'}_${lang}_${w}x${h}.png`) }).catch(() => {});
  }
  for (const r of rows) console.log(`   ${kind} [${lang}] ${String(r.w).padStart(4)}×${String(r.h).padEnd(4)} ${r.name.padEnd(42)} nút ${r.full ? 'trọn trong khung' : `CHỈ THẤY ${r.visPx}/${r.btnH} px`}${r.tappable ? '' : ', KHÔNG chạm được'}; tờ giấy bị cắt ${r.paperCut} px${r.titleCut ? ' (mất tiêu đề)' : ''}${r.scroll ? ', cuộn được' : ', không cuộn được'}`);
  const blocked = rows.filter((r) => !r.tappable), partial = rows.filter((r) => r.tappable && !r.full), clipped = rows.filter((r) => r.paperCut > 2 && !r.scroll);
  R.check(`st1 ${kind} [${lang}]: ở mọi cỡ khung, nút Bắt đầu chạm/bấm được (tâm nút nằm trong khung và không bị che)`, blocked.length === 0, blocked.length ? `KHÔNG vào được game ở ${blocked.length}/${rows.length} cỡ: ${blocked.map((r) => `${r.w}×${r.h} (${r.name}; nút ở y ${r.btn[1]}…${r.btn[3]}, khung cao ${r.h})`).join('; ')}` : `${rows.length} cỡ`);
  R.check(`st2 ${kind} [${lang}]: nút Bắt đầu nằm TRỌN trong khung ở mọi cỡ`, partial.length === 0 && blocked.length === 0, [...blocked, ...partial].map((r) => `${r.w}×${r.h}: thấy ${r.visPx}/${r.btnH} px`).join('; '));
  R.check(`st3 ${kind} [${lang}]: tờ giấy giới thiệu không bị cắt (hoặc cuộn được) ở mọi cỡ`, clipped.length === 0, clipped.map((r) => `${r.w}×${r.h}: cắt ${r.paperCut} px${r.titleCut ? ', mất tiêu đề' : ''}`).join('; '));
  // bấm thật ở cỡ nhỏ nhất mà nút còn chạm được, để chắc là vào game được
  const ok = rows.filter((r) => r.tappable).sort((a, b) => a.h - b.h)[0];
  if (ok) { await o.page.setViewportSize({ width: ok.w, height: ok.h }); await o.page.waitForTimeout(200); await o.page.evaluate(() => document.getElementById('play').scrollIntoView({ block: 'center' })); const b = ok.btn; const cx = (b[0] + b[2]) / 2, cy = Math.min(ok.h - 2, Math.max(2, (Math.max(b[1], 0) + Math.min(b[3], ok.h)) / 2)); if (kind === 'cảm ứng') await o.page.touchscreen.tap(cx, cy); else await o.page.mouse.click(cx, cy); const st = await o.page.waitForFunction(() => window.__game.G.started === true, null, { timeout: 15000 }).then(() => true).catch(() => false); R.check(`st4 ${kind} [${lang}]: chạm/bấm thật vào nút ở cỡ thấp nhất còn chạm được (${ok.w}×${ok.h}) thì vào game`, st, ''); }
  R.check(`st ${kind} [${lang}]: không có pageerror / console.error`, o.errors.length === 0, o.errors.slice(0, 3).join(' | '));
  await o.ctx.close();
}
await browser.close();
process.exit(R.finish());
