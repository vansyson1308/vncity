// MỤC 5: GIAO DIỆN ở 1920×1080, 1366×768, 1140×670, 844×390 (điện thoại ngang, cảm ứng) và 390×844 (điện thoại dọc, cảm ứng)
//   u1) màn hình bắt đầu: nút "Bắt đầu" nằm trong khung (hoặc cuộn tới được) và bấm được;
//   u2) HUD ở trạng thái đông nhất (đang chở khách: bảng cuốc xe + đồng hồ tốc độ + 3 ô la bàn + lời nhắn dài + thẻ địa danh tên dài nhất +
//       lời nhắc phím), tiếng Việt và tiếng Anh: không phần tử nào tràn khỏi khung, không cặp phần tử nào đè lên nhau
//       (getBoundingClientRect), chữ không bị cắt (scrollWidth > clientWidth khi overflow ẩn);
//   u3) bảng Bản đồ, Hộ chiếu, Cài đặt, Chứng nhận: tờ giấy nằm gọn trong khung, nút đóng nằm trong khung và bấm/chạm là đóng;
//   u4) đổi ngôn ngữ: mọi chữ có khoá dịch đang hiện đều đổi, đổi lại thì về đúng chữ cũ; không còn câu tiếng Việt trong bản tiếng Anh
//       (trừ tên riêng);
//   u5) màn cảm ứng: chạm nửa trái hiện cần ảo ngay chỗ chạm, đẩy lên thì nhân vật đi ra xa ống kính, đẩy phải thì sang phải màn hình,
//       nhả là dừng; vuốt nửa phải thì camera quay; các nút 🛵 🏃 chạm được.
// Không cần vẽ 3D: tắt vẽ từ đầu, đồng hồ ảo. Dùng: node tools/qa/ui.mjs [1920x1080] [844x390] …
import path from 'node:path';
import { launch, openGame, Report, OUT, fx } from './lib.mjs';

const R = new Report('ui');
const ALL = [{ w: 1920, h: 1080 }, { w: 1366, h: 768 }, { w: 1140, h: 670 }, { w: 844, h: 390, touch: true }, { w: 390, h: 844, touch: true }];
const args = process.argv.slice(2), VPS = args.length ? ALL.filter((v) => args.includes(`${v.w}x${v.h}`)) : ALL;
const browser = await launch();

// các khối HUD cần xét (mỗi khối là một "phần tử" với người chơi)
const collect = () => {
  const vis = (e) => { if (!e) return false; const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const out = [], add = (name, e) => { if (vis(e) && vis(e.parentElement)) { const r = e.getBoundingClientRect(); out.push({ name, l: r.left, t: r.top, r: r.right, b: r.bottom, text: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 50) }); } };
  const hud = document.getElementById('hud'); if (hud.classList.contains('hidden')) return { els: out, clipped: [] };
  [...document.querySelectorAll('#topleft > *')].forEach((e, i) => add('topleft#' + (e.id || i), e));
  [...document.querySelectorAll('#compass .pick')].forEach((e, i) => add('compass#' + i, e));
  [...document.querySelectorAll('#topright > *')].forEach((e) => add('topright#' + e.id, e));
  for (const id of ['minimap', 'street', 'speedo', 'fare', 'card', 'prompt', 'toast', 'bubble']) add(id, document.getElementById(id));
  [...document.querySelectorAll('#touchbtns > *')].forEach((e) => add('touch#' + e.id, e));
  if (document.getElementById('stick').style.display === 'block') add('stick', document.getElementById('stick'));
  // chữ bị cắt: phần tử có chữ, overflow ẩn, nội dung rộng/cao hơn khung
  const clipped = [];
  for (const e of document.querySelectorAll('#hud *, .modal:not(.hidden) *, #start:not(.hidden) *')) { if (!vis(e) || !e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue; const s = getComputedStyle(e); const hid = (v) => v === 'hidden' || v === 'clip'; if ((hid(s.overflowX) && e.scrollWidth > e.clientWidth + 1) || (hid(s.overflowY) && e.scrollHeight > e.clientHeight + 1)) clipped.push({ el: e.id || e.className || e.tagName, text: e.textContent.trim().slice(0, 40), sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight, ellipsis: s.textOverflow === 'ellipsis' }); }
  return { els: out, clipped };
};
function analyse(c, vp) {
  const outside = c.els.filter((e) => e.l < -1 || e.t < -1 || e.r > vp.w + 1 || e.b > vp.h + 1).map((e) => `${e.name} [${fx(e.l, 0)},${fx(e.t, 0)},${fx(e.r, 0)},${fx(e.b, 0)}]`);
  const over = [];
  for (let i = 0; i < c.els.length; i++) for (let j = i + 1; j < c.els.length; j++) { const a = c.els[i], b = c.els[j], w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t); if (w > 2 && h > 2) over.push(`${a.name} × ${b.name} (${fx(w, 0)}×${fx(h, 0)} px)`); }
  return { outside, over };
}

for (const vp of VPS) {
  const tag = `${vp.w}×${vp.h}${vp.touch ? ' cảm ứng' : ''}`;
  const o = await openGame(browser, 'q=low&fresh&lang=vi&h=17.2', { viewport: { width: vp.w, height: vp.h }, ctx: vp.touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}, norender: true, start: 'none' });
  const page = o.page; page.on('dialog', (d) => d.dismiss().catch(() => {}));
  const shot = (name) => page.screenshot({ path: path.join(OUT, `ui_${vp.w}x${vp.h}_${name}.png`) }).catch(() => {});
  // ----- u1: màn hình bắt đầu -----
  const st = await page.evaluate(() => { const p = document.getElementById('play'), r = p.getBoundingClientRect(), paper = document.querySelector('#start .paper'), pr = paper.getBoundingClientRect(), sc = document.getElementById('start'); const scroller = [paper, sc, document.scrollingElement].find((e) => e && e.scrollHeight > e.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(e).overflowY)); return { play: [r.left, r.top, r.right, r.bottom], paper: [pr.left, pr.top, pr.right, pr.bottom], scrollable: !!scroller, touchKeys: !document.getElementById('keys-touch').classList.contains('hidden'), deskKeys: !document.getElementById('keys-desktop').classList.contains('hidden'), coarse: matchMedia('(pointer: coarse)').matches, touchFlag: window.__game.input.touch, iw: innerWidth, ih: innerHeight }; });
  const playIn = st.play[0] >= 0 && st.play[1] >= 0 && st.play[2] <= vp.w && st.play[3] <= vp.h, paperIn = st.paper[0] >= -1 && st.paper[1] >= -1 && st.paper[2] <= vp.w + 1 && st.paper[3] <= vp.h + 1;
  await shot('start');
  R.check(`u1 ${tag}: màn hình bắt đầu vừa khung, nút Bắt đầu nằm trong khung (hoặc cuộn tới được)`, st.iw === vp.w && (playIn || st.scrollable) && (paperIn || st.scrollable), `nút [${st.play.map((v) => fx(v, 0))}], tờ giấy [${st.paper.map((v) => fx(v, 0))}], cuộn được: ${st.scrollable}; gợi ý phím: ${st.touchKeys ? 'cảm ứng' : ''}${st.deskKeys ? 'bàn phím' : ''}`);
  if (vp.touch) R.check(`u1 ${tag}: máy cảm ứng được nhận ra (pointer: coarse), hiện gợi ý chạm thay cho gợi ý phím`, st.coarse && st.touchFlag && st.touchKeys && !st.deskKeys, JSON.stringify({ coarse: st.coarse, touch: st.touchFlag, touchKeys: st.touchKeys, deskKeys: st.deskKeys }));
  await page.evaluate(() => document.getElementById('play').scrollIntoView({ block: 'center' }));
  if (vp.touch) await page.tap('#play'); else await page.click('#play');
  await page.waitForFunction(() => window.__game.G.started === true, null, { timeout: 60000 }).catch(() => {});
  const started = await page.evaluate(async () => { const ok = window.__game.G.started; await window.__qa.virtual(); window.__qa.step(30); return ok; });
  R.check(`u1 ${tag}: bấm/chạm nút Bắt đầu thì vào game`, started, '');

  // ----- u2: HUD ở ba trạng thái có thật, từ thường gặp tới đông nhất -----
  await page.evaluate(() => { const g = window.__game, P = g.player, F = g.fares, Q = window.__qa;
    const longest = (k) => g.passport.items.reduce((a, b) => ((b.name[k] || '').length > (a.name[k] || '').length ? b : a));
    const TXT = { vi: { first: 'Qua cổng đền Ngọc Sơn đóng con dấu đầu tiên đi cháu: Tháp Bút ngay trước mặt, rồi ra cầu Thê Húc.', bike: 'Giỏi! Giờ bấm F lên xe, làm một vòng quanh hồ. Cứ đi đều tay, xe khác tự tránh.', guide: 'Chú Thắng', to: 'Tới', eat: 'Ăn ' }, en: { first: 'Walk through the temple gate for your first stamp, kid: the Pen Tower is right ahead, then Thê Húc bridge.', bike: 'Nice! Now press F for the bike and do a lap of the lake. Keep it steady, the others flow around you.', guide: 'Uncle Thắng', to: 'To', eat: 'Eat ' } };
    const clear = () => { g.hud.hideCard(); g.hud.queue.length = 0; g.hud.toastT = 0; document.getElementById('toast').classList.add('hidden'); g.hud.prompt(null); };
    const ride = () => { if (P.mode !== 'bike') P.toggleBike(); P.speed = 0; if (F.state === 'ride') return true; for (let i = 0; i < 4000 && F.state !== 'offer'; i++) { F.wait = 0; Q.step(1); } if (F.state !== 'offer') return false; F.pickup(P); Q.step(3); return true; };
    window.__ui = { TXT, longest,
      // S2: đang chở khách, vừa đón: bảng cuốc xe + đồng hồ tốc độ + la bàn + lời nhắn "Tới <điểm đến>!" (đúng như game hiện lúc đón khách)
      ride(lang) { g.setLang(lang); clear(); const ok = ride(); clear(); if (ok) g.hud.toast(`${TXT[lang].to} ${F.dest.place.name[lang] || F.dest.place.name.vi}!`, 600, F.name(lang), F.cust.face, true); Q.step(40); return ok; },
      // S3: đi bộ, vừa đóng con dấu đầu tiên: thẻ địa danh (thu gọn, tên dài nhất) + lời chú Thắng "bấm F lên xe" (game hiện cả hai cùng lúc)
      stamp(lang) { g.setLang(lang); clear(); F.cancel(P); P.speed = 0; if (P.mode === 'bike') P.toggleBike(); const it = longest(lang); g.hud.showCard(it, g.passport.nearestUnvisited(it.x, it.z, it)); g.hud.cardT = 600; g.hud.toast(TXT[lang].bike, 600, TXT[lang].guide, '🧓', true); Q.step(40); return true; },
      // S4: đông nhất: đang chở khách, tới một địa danh (thẻ mở rộng), có lời nhắn dài của chú Thắng, đứng cạnh hàng ăn (lời mời ăn)
      worst(lang) { g.setLang(lang); clear(); const ok = ride(); clear(); const it = longest(lang); g.hud.showCard(it, g.passport.nearestUnvisited(it.x, it.z, it)); document.getElementById('card').classList.add('open'); g.hud.cardT = 600; g.hud.toast(TXT[lang].first, 600, TXT[lang].guide, '🧓', true); Q.step(40); return ok; },
      // giữ thẻ và lời nhắn khỏi tự ẩn; đặt lời nhắc phím (game tự đặt lại mỗi khung hình, nên gọi ngay trước khi đo)
      hold(lang, prompt) { g.hud.cardT = Math.max(g.hud.cardT, 500); if (g.hud.toastT > 0) g.hud.toastT = 500; if (prompt) { const f = g.passport.items.filter((i) => i.kind === 'food' && i.price).reduce((a, b) => ((b.name[lang] || b.name.vi).length > (a.name[lang] || a.name.vi).length ? b : a)); g.hud.prompt('E', TXT[lang].eat + (f.name[lang] || f.name.vi) + ' · 45.000 ₫'); } },
    };
  });
  for (const lang of ['vi', 'en']) for (const [stName, label, needs] of [['ride', 'S2 đang chở khách + lời nhắn đón khách', ['fare', 'speedo', 'toast', 'minimap']], ['stamp', 'S3 vừa đóng dấu: thẻ thu gọn + lời chú Thắng', ['card', 'toast', 'minimap']], ['worst', 'S4 đông nhất: chở khách + thẻ mở + lời nhắn dài + lời mời ăn', ['fare', 'speedo', 'toast', 'card', 'prompt', 'minimap']]]) {
    const okSetup = await page.evaluate(([st, lang]) => window.__ui[st](lang), [stName, lang]);
    await page.waitForTimeout(900); // thẻ và lời nhắn hiện ra bằng hoạt hình CSS (thời gian thật): chờ xong rồi mới đo
    await page.evaluate(([lang, pr]) => window.__ui.hold(lang, pr), [lang, stName === 'worst']);
    const m = await page.evaluate(collect), a = analyse(m, vp), names = m.els.map((e) => e.name);
    await shot(`hud_${stName}_${lang}`);
    const have = needs.every((n) => names.includes(n)) && names.filter((n) => n.startsWith('compass#')).length >= 2 && (!vp.touch || names.filter((n) => n.startsWith('touch#')).length === 4);
    R.check(`u2 ${tag} [${lang}] ${label}: dựng được trạng thái (đủ các khối cần có)`, okSetup && have, `${names.length} khối: ${names.join(', ')}`);
    R.check(`u2 ${tag} [${lang}] ${label}: không khối HUD nào tràn khỏi khung`, a.outside.length === 0, a.outside.join('; '));
    R.check(`u2 ${tag} [${lang}] ${label}: không cặp khối HUD nào đè lên nhau`, a.over.length === 0, `${a.over.length} cặp: ${a.over.slice(0, 10).join('; ')}`);
    const clip = m.clipped.filter((q) => !q.ellipsis), ell = m.clipped.filter((q) => q.ellipsis);
    // rút gọn bằng dấu … mà còn hiện được từ nửa chữ trở lên thì chỉ ghi nhận; mất quá nửa (tên địa danh còn vài chữ cái) thì tính là bị cắt
    const half = ell.filter((q) => q.cw < q.sw * 0.5);
    R.check(`u2 ${tag} [${lang}] ${label}: chữ trên HUD không bị cắt cụt, không bị rút gọn mất quá nửa`, clip.length === 0 && half.length === 0, `${clip.length} chỗ bị cắt cụt: ${JSON.stringify(clip.slice(0, 3))}; ${half.length} chỗ rút gọn mất quá nửa: ${half.map((q) => `"${q.text}" (cần ${q.sw} px, có ${q.cw} px)`).slice(0, 4).join(' | ')}; rút gọn nhẹ: ${ell.length - half.length}`);
  }
  // S1: đi bộ, không cuốc xe, không thẻ, không lời nhắn (trạng thái thường gặp nhất)
  {
    await page.evaluate(() => { const g = window.__game, Q = window.__qa; g.setLang('vi'); g.fares.cancel(g.player); g.player.speed = 0; if (g.player.mode === 'bike') g.player.toggleBike(); g.hud.hideCard(); g.hud.queue.length = 0; g.hud.toastT = 0; document.getElementById('toast').classList.add('hidden'); Q.step(30); g.hud.prompt(null); });
    await page.waitForTimeout(700); const c2 = await page.evaluate(collect), a2 = analyse(c2, vp); await shot('hud_walk_vi');
    R.check(`u2 ${tag} S1 đi bộ thường (không thẻ, không lời nhắn): không tràn, không đè`, a2.outside.length === 0 && a2.over.length === 0, `tràn: ${a2.outside.join('; ') || 'không'}; đè: ${a2.over.join('; ') || 'không'}`);
    const bad2 = c2.clipped.filter((q) => !q.ellipsis || q.cw < q.sw * 0.5); R.check(`u2 ${tag} S1 đi bộ thường: chữ không bị cắt cụt, không bị rút gọn mất quá nửa`, bad2.length === 0, `${bad2.map((q) => `"${q.text}" (cần ${q.sw} px, có ${q.cw} px${q.ellipsis ? ', dấu …' : ''})`).slice(0, 4).join(' | ')}; rút gọn nhẹ: ${c2.clipped.length - bad2.length}`);
  }

  // ----- u3: các bảng -----
  for (const [id, how] of [['map', 'b-map'], ['book', 'b-book'], ['settings', 'b-set'], ['done', null]]) {
    for (const lang of ['vi', 'en']) {
      await page.evaluate((lang) => { const g = window.__game; g.hud.close(); g.setLang(lang); window.__qa.step(3); }, lang);
      if (how) { if (vp.touch) await page.tap('#' + how).catch(() => {}); else await page.click('#' + how).catch(() => {}); } else await page.evaluate(() => window.__game.hud.open('done'));
      await page.evaluate(() => window.__qa.step(4));
      const r = await page.evaluate((id) => { const m = document.getElementById(id), p = m.querySelector('.paper'), b = p.getBoundingClientRect(), x = m.querySelector('[data-close]'), xr = x ? x.getBoundingClientRect() : null; const s = getComputedStyle(p); return { modal: window.__game.hud.modal, hidden: m.classList.contains('hidden'), paper: [b.left, b.top, b.right, b.bottom], close: xr && [xr.left, xr.top, xr.right, xr.bottom], scrollY: p.scrollHeight - p.clientHeight, scrollX: p.scrollWidth - p.clientWidth, canScroll: /auto|scroll/.test(s.overflowY), inner: [...p.querySelectorAll('*')].filter((e) => { const q = e.getBoundingClientRect(); return q.width > 0 && (q.right > innerWidth + 1 || q.left < -1); }).map((e) => e.id || e.className || e.tagName).slice(0, 5) }; }, id);
      if (lang === 'vi') await shot(`modal_${id}`);
      const pin = r.paper[0] >= -1 && r.paper[1] >= -1 && r.paper[2] <= vp.w + 1 && r.paper[3] <= vp.h + 1, cin = r.close && r.close[0] >= 0 && r.close[1] >= 0 && r.close[2] <= vp.w && r.close[3] <= vp.h;
      R.check(`u3 ${tag} [${lang}]: bảng ${id} mở bằng ${how ? 'nút #' + how : 'lệnh'} và tờ giấy nằm gọn trong khung, không tràn ngang`, r.modal === id && !r.hidden && pin && r.scrollX <= 1 && r.inner.length === 0 && (r.scrollY <= 1 || r.canScroll), `bảng đang mở: ${r.modal}; tờ giấy [${r.paper.map((v) => fx(v, 0))}]; nội dung dài hơn khung ${fx(r.scrollY, 0)} px (${r.canScroll ? 'cuộn được' : 'KHÔNG cuộn được'}); phần tử tràn ngang: ${r.inner.join(', ') || 'không'}`);
      // đóng: bấm/chạm nút ✕ (hoặc nút "Đi tiếp" của bảng chứng nhận)
      if (r.modal === id) {
        const sel = `#${id} [data-close]`; let closed = false;
        if (cin) { if (vp.touch) await page.tap(sel).catch(() => {}); else await page.click(sel).catch(() => {}); await page.evaluate(() => window.__qa.step(3)); closed = (await page.evaluate(() => window.__game.hud.modal)) === null; }
        R.check(`u3 ${tag} [${lang}]: bảng ${id}: nút đóng nằm trong khung và bấm/chạm là đóng`, cin && closed, `nút đóng [${r.close ? r.close.map((v) => fx(v, 0)) : 'không có'}], đã đóng: ${closed}`);
        if (!closed) await page.evaluate(() => window.__game.hud.close());
      }
    }
  }

  // ----- u4: đổi ngôn ngữ -----
  {
    const texts = () => page.evaluate(() => { const out = []; const vis = (e) => { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }; const walk = (root, where) => { for (const e of root.querySelectorAll('*')) { if (!vis(e)) continue; for (const n of e.childNodes) if (n.nodeType === 3 && n.textContent.trim().length > 1) out.push({ where, key: e.dataset.i18n || null, id: e.id || e.className || e.tagName, text: n.textContent.trim() }); } }; walk(document.getElementById('hud'), 'hud'); for (const m of document.querySelectorAll('.modal:not(.hidden)')) walk(m, m.id); return out; });
    const VI = /[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i;
    const bad = [], unchanged = []; let keyed = 0;
    const openIn = (modal) => page.evaluate((modal) => { const g = window.__game, Q = window.__qa; g.hud.close(); if (g.player.mode !== 'bike') g.player.toggleBike(); window.__ui.worst(document.documentElement.lang); window.__ui.hold(document.documentElement.lang, false); Q.step(20); if (modal === 'book') g.input.press('book'); else if (modal === 'settings') g.input.press('settings'); else if (modal === 'map') g.input.press('map'); else if (modal) g.hud.open(modal); Q.step(5); return g.hud.modal; }, modal);
    const compare = (vi, en, where) => { for (const t of en) { const same = vi.find((v) => v.where === t.where && v.id === t.id && v.text === t.text); if (t.key) { keyed++; if (same && VI.test(t.text)) bad.push(`${where} [data-i18n=${t.key}] vẫn là "${t.text}"`); } else if (same && VI.test(t.text) && / /.test(t.text) && !['street', 'prompt'].includes(t.id)) unchanged.push(`${where} #${String(t.id).slice(0, 18)}: "${t.text.slice(0, 60)}"`); } };
    // (1) đổi ngôn ngữ NGAY LÚC ĐANG HIỆN, theo hai đường người chơi có: phím L khi không mở bảng (máy cảm ứng: nút trong Cài đặt), và nút
    //     English trong bảng Cài đặt
    for (const modal of [null, 'settings']) {
      await page.evaluate(() => window.__game.setLang('vi')); await openIn(modal);
      const vi = await texts();
      if (modal === 'settings') { if (vp.touch) await page.tap('#s-lang button[data-l="en"]'); else await page.click('#s-lang button[data-l="en"]'); } else if (!vp.touch) await page.keyboard.press('KeyL'); else await page.evaluate(() => window.__game.setLang('en'));
      await page.evaluate(() => window.__qa.step(30));
      const en = await texts(), lang = await page.evaluate(() => document.documentElement.lang);
      if (lang !== 'en') bad.push(`${modal || 'hud'}: thuộc tính lang của trang vẫn là "${lang}" sau khi đổi sang tiếng Anh`);
      compare(vi, en, modal || 'hud');
      // đổi lại tiếng Việt: chữ có khoá dịch phải về đúng như cũ
      if (modal === 'settings') { if (vp.touch) await page.tap('#s-lang button[data-l="vi"]'); else await page.click('#s-lang button[data-l="vi"]'); } else await page.evaluate(() => window.__game.setLang('vi'));
      await page.evaluate(() => window.__qa.step(30)); const vi2 = await texts();
      for (const t of vi.filter((q) => q.key)) if (!vi2.some((v) => v.where === t.where && v.key === t.key && v.text === t.text)) bad.push(`${modal || 'hud'} [data-i18n=${t.key}] không về lại "${t.text.slice(0, 30)}"`);
    }
    // (1b) lời nhắn do game tự ghép (đón khách: "Tới <điểm đến>!") đang hiện mà đổi ngôn ngữ thì cũng phải đổi theo
    {
      const before = await page.evaluate(() => { const g = window.__game, F = g.fares, P = g.player, Q = window.__qa; g.hud.close(); g.setLang('vi'); F.cancel(P); if (P.mode !== 'bike') P.toggleBike(); for (let i = 0; i < 3000 && F.state !== 'offer'; i++) { F.wait = 0; Q.step(1); } if (F.state !== 'offer') return null; g.hud.toastT = 0; g.hud.queue.length = 0; Q.step(2); F.pickup(P); Q.step(5); return { text: document.getElementById('toast-text').textContent, who: document.getElementById('toast-who').textContent, shown: !document.getElementById('toast').classList.contains('hidden') }; });
      if (before && before.shown) {
        if (!vp.touch) await page.keyboard.press('KeyL'); else await page.evaluate(() => window.__game.setLang('en'));
        const after = await page.evaluate(() => { window.__qa.step(10); return { text: document.getElementById('toast-text').textContent, who: document.getElementById('toast-who').textContent, shown: !document.getElementById('toast').classList.contains('hidden'), lang: document.documentElement.lang, dest: document.getElementById('fare-dest').textContent }; });
        R.check(`u4 ${tag}: lời nhắn đón khách đang hiện ("${before.text}") đổi sang tiếng Anh khi đổi ngôn ngữ`, after.lang === 'en' && after.shown && after.text !== before.text && !/^Tới /.test(after.text), `trước: "${before.who} ${before.text}"; sau: "${after.who} ${after.text}" (bảng cuốc xe lúc đó ghi "${after.dest}")`);
      } else R.check(`u4 ${tag}: tạo được lời nhắn đón khách để thử`, false, JSON.stringify(before));
      await page.evaluate(() => window.__game.setLang('vi'));
    }
    // (2) các bảng khác không đổi ngôn ngữ được khi đang mở: so bảng mở ở tiếng Việt với bảng mở ở tiếng Anh
    for (const modal of ['map', 'book', 'done']) {
      await page.evaluate(() => window.__game.setLang('vi')); await openIn(modal); const vi = (await texts()).filter((t) => t.where === modal);
      await page.evaluate(() => { window.__game.hud.close(); window.__game.setLang('en'); }); await openIn(modal); const en = (await texts()).filter((t) => t.where === modal);
      compare(vi, en, modal);
    }
    R.check(`u4 ${tag}: đổi sang tiếng Anh: mọi chữ có khoá dịch đang hiện (HUD, Cài đặt; và Bản đồ, Hộ chiếu, Chứng nhận khi mở lại) đều đổi; đổi lại thì về đúng chữ cũ`, bad.length === 0 && keyed > 10, `${keyed} chữ có khoá; ${bad.length} lỗi: ${bad.slice(0, 5).join(' | ')}`);
    const uniq = [...new Set(unchanged)], sent = uniq.filter((u) => { const t = u.slice(u.indexOf('"')); return t.split(/\s+/).length >= 4 && /(^|[\s"])(và|của|là|không|đã|cho|tới|ở|có|một|các|đang|để|với|này|thì|đi|về)([\s",.!]|$)/i.test(t); });
    R.check(`u4 ${tag}: bản tiếng Anh không còn CÂU tiếng Việt (chữ có dấu, từ 4 từ trở lên, có hư từ, giữ nguyên sau khi chuyển ngôn ngữ)`, sent.length === 0, `${sent.length} câu: ${sent.slice(0, 6).join(' | ')}`);
    if (uniq.length - sent.length > 0) R.note(`u4 ${tag}: ${uniq.length - sent.length} cụm có dấu tiếng Việt giữ nguyên ở bản tiếng Anh (tên riêng? cần người xem): ${uniq.filter((u) => !sent.includes(u)).slice(0, 10).join(' | ')}`);
    await page.evaluate(() => { const g = window.__game; g.hud.close(); g.setLang('vi'); g.fares.cancel(g.player); g.player.speed = 0; if (g.player.mode === 'bike') g.player.toggleBike(); g.hud.hideCard(); window.__qa.step(10); });
  }

  // ----- u5: cần điều khiển ảo -----
  if (vp.touch) {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 8, radiusY: 8, force: 1 })) });
    const snap = () => page.evaluate(() => { const s = window.__qa.snap(), st = document.getElementById('stick'), r = st.getBoundingClientRect(), g = window.__game; return { ...s, stick: st.style.display === 'block', sx: r.left + r.width / 2, sy: r.top + r.height / 2, move: { ...g.input.move } }; });
    // đứng ở bãi trống để đo hướng (không tường, không xe)
    await page.evaluate(async () => { const g = window.__game, Q = window.__qa; g.warp(493, -974, 0); for (let i = 0; i < 8000; i++) { Q.step(1); if (!g.warping) break; await Q.sleep(4); } Q.step(20); });
    // tìm một điểm chạm ở nửa trái không dính nút HUD nào
    const spot = await page.evaluate(() => { for (let y = innerHeight * 0.6; y > innerHeight * 0.3; y -= 20) for (let x = innerWidth * 0.2; x < innerWidth * 0.42; x += 20) { const e = document.elementFromPoint(x, y); if (e && e.id === 'game') return [x, y]; } return null; });
    const look = await page.evaluate(() => { for (let y = innerHeight * 0.55; y > innerHeight * 0.3; y -= 20) for (let x = innerWidth * 0.6; x < innerWidth * 0.9; x += 20) { const e = document.elementFromPoint(x, y), e2 = document.elementFromPoint(x - 60, y); if (e && e.id === 'game' && e2 && e2.id === 'game') return [x, y]; } return null; });
    R.check(`u5 ${tag}: nửa trái và nửa phải màn hình có chỗ trống (không bị HUD che) để đặt ngón tay`, !!spot && !!look, `trái ${JSON.stringify(spot)}, phải ${JSON.stringify(look)}`);
    if (spot && look) {
      const [x0, y0] = spot; const s0 = await snap();
      await touch('touchStart', [[x0, y0, 1]]); await page.evaluate(() => window.__qa.step(3)); const s1 = await snap();
      await touch('touchMove', [[x0, y0 - 60, 1]]); await page.evaluate(() => window.__qa.step(150)); const s2 = await snap();
      const d1 = [s2.x - s1.x, s2.z - s1.z], f1 = d1[0] * s1.fx + d1[1] * s1.fz, r1 = d1[0] * s1.rx + d1[1] * s1.rz;
      await touch('touchMove', [[x0 + 60, y0, 1]]); await page.evaluate(() => window.__qa.step(40)); const s3 = await snap(); await page.evaluate(() => window.__qa.step(120)); const s4 = await snap();
      const d2 = [s4.x - s3.x, s4.z - s3.z], f2 = d2[0] * s3.fx + d2[1] * s3.fz, r2 = d2[0] * s3.rx + d2[1] * s3.rz;
      await touch('touchEnd', []); await page.evaluate(() => window.__qa.step(60)); const s5 = await snap(); await page.evaluate(() => window.__qa.step(30)); const s6 = await snap();
      R.check(`u5 ${tag}: chạm nửa trái thì cần ảo hiện đúng chỗ chạm`, !s0.stick && s1.stick && Math.hypot(s1.sx - x0, s1.sy - y0) < 12, `trước ${s0.stick}, sau ${s1.stick}, tâm cần (${fx(s1.sx, 0)}, ${fx(s1.sy, 0)}) so với chỗ chạm (${x0}, ${y0})`);
      R.check(`u5 ${tag}: đẩy cần lên: nhân vật đi ra xa ống kính; đẩy sang phải: sang phải màn hình; nhả tay: dừng, cần ẩn`, f1 > 1.5 && Math.abs(r1) < 0.3 * f1 && r2 > 1 && Math.abs(f2) < 0.4 * r2 && !s5.stick && Math.hypot(s6.x - s5.x, s6.z - s5.z) < 0.02, `lên: tiến ${fx(f1)} m, lệch ${fx(r1)} m; phải: sang phải ${fx(r2)} m, tiến ${fx(f2)} m; sau khi nhả còn trôi ${fx(Math.hypot(s6.x - s5.x, s6.z - s5.z), 3)} m, cần ${s5.stick ? 'còn hiện' : 'đã ẩn'}`);
      // vuốt nửa phải: camera quay
      const [lx, ly] = look; await touch('touchStart', [[lx, ly, 2]]); await touch('touchMove', [[lx - 60, ly, 2]]); await page.evaluate(() => window.__qa.step(5)); await touch('touchEnd', []); const s7 = await snap();
      R.check(`u5 ${tag}: vuốt ngang nửa phải thì camera quay`, Math.abs(s7.camYaw - s6.camYaw) > 0.1, `góc camera đổi ${fx(s7.camYaw - s6.camYaw, 3)} rad khi vuốt 60 px`);
      // hai ngón cùng lúc: tay trái đẩy cần, tay phải vuốt nhìn
      await touch('touchStart', [[x0, y0, 1]]); await touch('touchMove', [[x0, y0 - 60, 1]]); await page.evaluate(() => window.__qa.step(20)); await touch('touchStart', [[x0, y0 - 60, 1], [lx, ly, 2]]); await touch('touchMove', [[x0, y0 - 60, 1], [lx + 50, ly, 2]]); await page.evaluate(() => window.__qa.step(60)); const s8 = await snap(); await touch('touchEnd', []); await page.evaluate(() => window.__qa.step(40));
      R.check(`u5 ${tag}: hai ngón cùng lúc (trái đẩy cần, phải vuốt): vẫn đi và camera vẫn quay`, s8.move.y > 0.9 && Math.abs(s8.camYaw - s7.camYaw) > 0.05 && s8.v > 0.8, `move.y ${fx(s8.move.y)}, vận tốc ${fx(s8.v)}, camera đổi ${fx(s8.camYaw - s7.camYaw, 3)} rad`);
    }
    // nút chạm: 🛵 lên xe, 🏃 bật/tắt chạy
    await page.tap('#t-bike'); const m1 = await page.evaluate(() => { window.__qa.step(5); return window.__game.player.mode; });
    await page.tap('#t-bike'); const m2 = await page.evaluate(() => { window.__qa.step(5); return window.__game.player.mode; });
    await page.tap('#t-run'); const run1 = await page.evaluate(() => { window.__qa.step(3); return { on: window.__game.input.runToggle, cls: document.getElementById('t-run').classList.contains('on') }; }); await page.tap('#t-run');
    R.check(`u5 ${tag}: nút 🛵 chạm là lên xe, chạm nữa là xuống; nút 🏃 bật chế độ chạy và đổi màu`, m1 === 'bike' && m2 === 'walk' && run1.on && run1.cls, `sau chạm 1: ${m1}, sau chạm 2: ${m2}, chạy: ${JSON.stringify(run1)}`);
  }
  R.check(`${tag}: không có pageerror / console.error`, o.errors.length === 0, o.errors.slice(0, 3).join(' | '));
  await o.ctx.close();
}
await browser.close();
process.exit(R.finish());
