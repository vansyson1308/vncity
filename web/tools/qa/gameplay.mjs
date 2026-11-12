// MỤC 4: LỐI CHƠI CŨ KHÔNG ĐƯỢC HỎNG (các lỗi A1, A3, B1 của lượt kiểm thử trước + lưu tiến độ)
//   a) đi bộ THẬT (giữ W, lái bằng chuột thật) từ điểm xuất phát qua cổng đền, lên cầu Thê Húc, tới đảo; nhận dấu cầu và dấu đền;
//      lặp lại với đường đi lệch trái, lệch phải 0,7 m và chạy (Shift);
//   b) đi nhanh tới cả 44 điểm hộ chiếu (đúng lời gọi mà bản đồ dùng), tới nơi phải: nhận dấu (hoặc lời mời ăn), không nằm trong nhà,
//      không dưới nước, camera không nằm trong khối đặc, và bước được ≥ 2,5 m theo ít nhất 3 trong 8 hướng (giữ W thật, 3 giây);
//      thêm một lần bấm chuột thật lên bản đồ lớn vào một điểm đã có dấu;
//   c) một cuốc xe ôm trọn vẹn: chạy xe thật (W/A/D/phanh) tới chỗ khách vẫy, bấm E, khách hiện trên yên sau, chạy xe thật tới điểm trả,
//      khách xuống xe, tiền và số cuốc tăng, bảng cuốc xe hiện rồi ẩn;
//   d) tải lại trang: dấu, tiền, số cuốc còn nguyên; không có ?fresh thì trở lại gần chỗ cũ.
// Dùng: node tools/qa/gameplay.mjs [a] [b] [c] [d]
import { launch, openGame, Report, invariantHelper, fx } from './lib.mjs';

const want = (k) => process.argv.length <= 2 || process.argv.slice(2).includes(k);
const R = new Report('gameplay');
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
let { page, errors } = await openGame(browser, 'q=low&fresh&lang=vi&h=3', { init: invariantHelper, context: ctx, start: 'click' });
const virt = (p) => p.evaluate(async () => { window.__norender = true; await window.__qa.virtual(); window.__qa.step(5); });
await virt(page);

// Lái bằng CHUỘT THẬT: kéo ngang sao cho camera quay về phía điểm đích (đi bộ: W đi theo hướng camera). Trả về sai số góc còn lại.
// Kéo-thả không khoá con trỏ: ngay sau khi nhấn chuột, nhả khoá con trỏ (như người chơi bấm Esc) để lúc đưa chuột về giữa màn hình
// (chuột đã nhả) camera không quay theo; Playwright chỉ gửi được sự kiện chuột trong khung nhìn nên phải đưa chuột về giữa khi sát mép.
async function grab(p, m) { m.x = 640; await p.mouse.move(m.x, 400); await p.mouse.down(); await p.evaluate(async () => { const g = window.__game; for (let i = 0; i < 100 && !g.input.locked && i < 5; i++) await window.__qa.sleep(10); if (document.pointerLockElement) { document.exitPointerLock(); for (let i = 0; i < 100 && g.input.locked; i++) await window.__qa.sleep(10); } }); }
async function steerMouse(p, m, tx, tz) {
  const e = await p.evaluate(([tx, tz]) => { const g = window.__game, P = g.player.pos, wantYaw = Math.atan2(tx - P.x, tz - P.z) + Math.PI; const d = Math.atan2(Math.sin(wantYaw - g.cam.yaw), Math.cos(wantYaw - g.cam.yaw)); return { d, sens: g.cam.sens, locked: g.input.locked }; }, [tx, tz]);
  let dx = -e.d / e.sens; dx = Math.max(-220, Math.min(220, dx)); // yaw -= look.x * sens
  if (Math.abs(dx) >= 1) { if (m.x + dx < 100 || m.x + dx > 1180 || e.locked) { await p.mouse.up(); await grab(p, m); } m.x += dx; await p.mouse.move(m.x, 400); }
  return e.d;
}

// ===== a) cổng đền → cầu Thê Húc → đảo =====
if (want('a')) {
  const geo = await page.evaluate(() => { const g = window.__game, d = g.nav.decks[0], gate = g.sites.find((s) => s.id === 'ngoc_son_gate'), it = (id) => { const i = g.passport.byId.get(id); return i ? { x: i.x, z: i.z, r: i.radius, s: i.s } : null; }; return { start: [g.player.pos.x, g.player.pos.z], gate: { x: gate.x, z: gate.z, yaw: gate.yaw }, deck: d ? { ax: d.ax, az: d.az, bx: d.bx, bz: d.bz, w: d.w } : null, cau: it('cau_the_huc'), den: it('den_ngoc_son'), visited: [...g.passport.visited] }; });
  R.check('a0: có cổng đền, mặt cầu Thê Húc đi bộ được và hai điểm hộ chiếu cau_the_huc, den_ngoc_son', !!(geo.deck && geo.cau && geo.den), JSON.stringify({ start: geo.start.map((v) => fx(v, 1)), deck: geo.deck && [fx(geo.deck.ax, 1), fx(geo.deck.az, 1), fx(geo.deck.bx, 1), fx(geo.deck.bz, 1)] }));
  if (geo.deck && geo.den) {
    const D = geo.deck, ux = (D.bx - D.ax) / Math.hypot(D.bx - D.ax, D.bz - D.az), uz = (D.bz - D.az) / Math.hypot(D.bx - D.ax, D.bz - D.az), nx = uz, nz = -ux; // dọc cầu, và bên phải
    for (const [name, off, run] of [['đi giữa lối', 0, false], ['lệch trái 0,7 m', -0.7, false], ['lệch phải 0,7 m', 0.7, false], ['chạy (Shift), giữa lối', 0, true]]) {
      // các điểm mốc: trước cổng 3 m, giữa cổng, đầu cầu, giữa cầu, cuối cầu, rồi tới điểm đền trên đảo. Lệch ngang chỉ áp dụng trên bờ
      // (trên cầu lòng cầu chỉ rộng 2,6 m nên lệch 0,4 m).
      const o2 = Math.sign(off) * Math.min(Math.abs(off), 0.4);
      const pts = [[geo.gate.x - ux * 3 + nx * off, geo.gate.z - uz * 3 + nz * off], [geo.gate.x + nx * off, geo.gate.z + nz * off], [D.ax - ux * 4 + nx * off, D.az - uz * 4 + nz * off], [D.ax + nx * o2, D.az + nz * o2], [(D.ax + D.bx) / 2 + nx * o2, (D.az + D.bz) / 2 + nz * o2], [D.bx + nx * o2, D.bz + nz * o2], [D.bx + ux * 4, D.bz + uz * 4]];
      // gọi lại điểm xuất phát thật của người chơi mới và xoá dấu (bấm nút "Xoá dấu, chơi lại" trong hộ chiếu)
      await page.keyboard.press('KeyB'); await page.evaluate(() => window.__qa.step(3)); await page.click('#k-reset'); await page.keyboard.press('Escape');
      await page.evaluate(([x, z]) => { const g = window.__game; g.input.keys.clear(); g.player.teleport(x, z, g.sites.find((s) => s.id === 'ngoc_son_gate').yaw + Math.PI, false); g.cam.yaw = g.player.yaw + Math.PI; g.cam.pitch = 0.16; window.__inv.viol = {}; window.__inv.count = {}; window.__inv.last = null; window.__qa.step(20); }, geo.start);
      const m = { x: 640 }; await grab(page, m);
      if (run) await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
      let i = 0, t = 0, stuckT = 0, maxY = 0, lastPos = geo.start, reached = false, water = 0, log = [];
      while (t < 150 && !reached) {
        const err = await steerMouse(page, m, pts[i][0], pts[i][1]);
        const s = await page.evaluate(() => { const I = window.__inv, r = I.run(6, [1000 / 60]), g = window.__game; return { ...r, visited: [...g.passport.visited], water: g.nav.isWater(r.x, r.z) && r.y < 0.45 }; }); t += 0.1;
        if (s.y > maxY) maxY = s.y; if (s.water) water++;
        if (Math.hypot(s.x - pts[i][0], s.z - pts[i][1]) < 1.0) { log.push(`mốc ${i} lúc ${fx(t, 1)} giây`); if (++i >= pts.length) reached = true; }
        if (Math.hypot(s.x - lastPos[0], s.z - lastPos[1]) < 0.05) stuckT += 0.1; else { stuckT = 0; lastPos = [s.x, s.z]; }
        if (stuckT > 5) break; void err;
      }
      await page.keyboard.up('KeyW'); if (run) await page.keyboard.up('ShiftLeft'); await page.mouse.up();
      const end = await page.evaluate(() => { const g = window.__game; window.__qa.step(30); return { pos: [g.player.pos.x, g.player.pos.z], y: g.player.y, visited: [...g.passport.visited], count: { ...window.__inv.count }, hud: document.getElementById('count').textContent, card: document.getElementById('c-name').textContent }; });
      const ok = reached && end.visited.includes('cau_the_huc') && end.visited.includes('den_ngoc_son') && maxY > 1.2 && water === 0 && Object.keys(end.count).length === 0;
      R.check(`a: ${name}: tới đảo, nhận dấu cầu Thê Húc và đền Ngọc Sơn`, ok, `${reached ? 'tới nơi' : `kẹt ở mốc ${i}/${pts.length} tại (${fx(end.pos[0], 1)}, ${fx(end.pos[1], 1)})`} sau ${fx(t, 0)} giây; cao nhất trên cầu ${fx(maxY)} m; dấu: ${end.visited.join(', ') || 'không'}; HUD ${end.hud}; vi phạm bất biến: ${JSON.stringify(end.count)}`);
    }
  }
}

// ===== b) đi nhanh tới cả 44 điểm =====
if (want('b')) {
  await page.keyboard.press('KeyB'); await page.evaluate(() => window.__qa.step(3)); await page.click('#k-reset'); await page.keyboard.press('Escape');
  const items = await page.evaluate(() => { const g = window.__game; const all = g.passport.items.map((it) => ({ id: it.id, x: it.x, z: it.z, s: it.s || null, radius: it.radius, kind: it.kind, price: it.price || 0, solemn: !!it.solemn })); const out = []; let cur = { x: g.player.pos.x, z: g.player.pos.z }; while (all.length) { all.sort((a, b) => Math.hypot(a.x - cur.x, a.z - cur.z) - Math.hypot(b.x - cur.x, b.z - cur.z)); cur = all.shift(); out.push(cur); } return out; }); // thứ tự: láng giềng gần nhất (đỡ phải dựng lại ô phố)
  R.check('b0: hộ chiếu có đủ 44 điểm, điểm nào cũng có chỗ đứng tính sẵn (s)', items.length === 44 && items.every((i) => i.s), `${items.length} điểm, thiếu chỗ đứng: ${items.filter((i) => !i.s).map((i) => i.id).join(', ') || 'không'}`);
  const bad = [], rows = [];
  for (const it of items) {
    const [tx, tz] = it.s || [it.x, it.z];
    const arr = await page.evaluate(async ([tx, tz, ix, iz, id]) => {
      const g = window.__game, Q = window.__qa, I = window.__inv, far = Math.hypot(ix - tx, iz - tz) > 1.5;
      g.input.keys.clear(); if (g.player.mode === 'bike') { g.player.speed = 0; g.player.toggleBike(); }
      g.warp(tx, tz, far ? Math.atan2(ix - tx, iz - tz) : undefined); // đúng lời gọi của bản đồ lớn (main.js, openMap)
      let n = 0; for (; n < 8000; n++) { Q.step(1); if (!g.warping) break; await Q.sleep(4); }
      Q.step(45); // 0,75 giây sau khi tới nơi
      const P = g.player, c = g.camera.position, sees = Math.sin(P.yaw) * (ix - P.pos.x) + Math.cos(P.yaw) * (iz - P.pos.z);
      return { off: Math.hypot(P.pos.x - tx, P.pos.z - tz), y: P.y, inside: I.inside(P.pos.x, P.pos.z), water: g.nav.isWater(P.pos.x, P.pos.z) && P.y < 0.45, camIn: c.y < 30 && I.inside(c.x, c.z, Math.max(0.5, c.y)), cur: g.cam.cur, close: g.cam.close, stamped: g.passport.visited.has(id), pending: !!(g.passport.pending && g.passport.pending.id === id), dist: Math.hypot(ix - P.pos.x, iz - P.pos.z), facing: sees > 0, bad: Q.finite(), money: g.passport.money };
    }, [tx, tz, it.x, it.z, it.id]);
    // bước thử theo 8 hướng: phím W thật, 3 giây mỗi hướng, từ đúng chỗ vừa tới
    const walk = [];
    for (let k = 0; k < 8; k++) {
      await page.evaluate(([x, z, yaw]) => { const g = window.__game; g.player.teleport(x, z, yaw + Math.PI, false); g.cam.yaw = yaw; g.input.lastLook = performance.now(); window.__qa.step(2); }, [tx, tz, (k / 8) * Math.PI * 2]);
      const p0 = await page.evaluate(() => [window.__game.player.pos.x, window.__game.player.pos.z]);
      await page.keyboard.down('KeyW'); const p1 = await page.evaluate(() => { window.__qa.step(180); return [window.__game.player.pos.x, window.__game.player.pos.z]; }); await page.keyboard.up('KeyW');
      walk.push(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]));
    }
    await page.evaluate(() => window.__qa.step(20));
    const free = walk.filter((d) => d >= 2.5).length, got = it.kind === 'food' && it.price ? (arr.stamped || arr.pending) : arr.stamped;
    const row = { id: it.id, lech: fx(arr.off), cachDiem: fx(arr.dist, 1), banKinh: it.radius, nhanDau: got, trongNha: arr.inside, duoiNuoc: arr.water, camTrongKhoi: arr.camIn, cam: fx(arr.close), huongDiDuoc: free, buoc: walk.map((d) => fx(d, 1)).join(' ') };
    rows.push(row);
    const ok = got && !arr.inside && !arr.water && !arr.camIn && arr.close > 0.8 && free >= 3 && arr.off < 1.5 && arr.bad.length === 0;
    if (!ok) bad.push(row);
    console.log(`   ${ok ? '✓' : '✗'} ${it.id.padEnd(26)} ${JSON.stringify(row)}`);
  }
  R.check('b1: đi nhanh tới cả 44 điểm: tới đúng chỗ, nhận dấu (món ăn: hiện lời mời), không trong nhà, không dưới nước, camera không trong khối đặc và cách đầu trên 0,8 m, bước được ≥ 2,5 m theo ≥ 3/8 hướng', bad.length === 0, bad.length ? `${bad.length}/44 hỏng: ${JSON.stringify(bad.slice(0, 5))}` : `ít hướng đi được nhất: ${Math.min(...rows.map((r) => r.huongDiDuoc))}/8 (${rows.filter((r) => r.huongDiDuoc < 5).map((r) => r.id + ' ' + r.huongDiDuoc).join(', ') || 'mọi điểm ≥ 5'})`);
  // bấm chuột thật lên bản đồ lớn vào một điểm đã có dấu ở xa: phải đi nhanh tới đó
  const far = await page.evaluate(() => { const g = window.__game, P = g.player.pos; const v = g.passport.items.filter((i) => g.passport.visited.has(i.id)).sort((a, b) => Math.hypot(b.x - P.x, b.z - P.z) - Math.hypot(a.x - P.x, a.z - P.z))[0]; return v ? { id: v.id, x: v.x, z: v.z, s: v.s } : null; });
  if (far) {
    await page.keyboard.press('KeyM'); await page.evaluate(() => window.__qa.step(3));
    const click = await page.evaluate((f) => { const c = document.getElementById('bigmap'), r = c.getBoundingClientRect(), b = window.__game.world.bounds; c.scrollIntoView({ block: 'nearest', inline: 'nearest' }); return { x: r.left + ((f.x - b.x0) / (b.x1 - b.x0)) * r.width, y: r.top + ((f.z - b.z0) / (b.z1 - b.z0)) * r.height, rect: [r.left, r.top, r.width, r.height], modal: window.__game.hud.modal }; }, far);
    await page.mouse.click(click.x, click.y);
    const res = await page.evaluate(async (f) => { const g = window.__game, Q = window.__qa; const started = g.warping; let n = 0; for (; n < 8000; n++) { Q.step(1); if (!g.warping) break; await Q.sleep(4); } Q.step(10); return { started, modal: g.hud.modal, d: Math.hypot(g.player.pos.x - f.s[0], g.player.pos.z - f.s[1]) }; }, far);
    R.check('b2: bấm chuột thật lên bản đồ lớn vào một điểm đã có dấu: bảng đóng lại và người chơi được đưa tới chỗ đứng của điểm đó', click.modal === 'map' && res.started && res.modal === null && res.d < 1.5, `điểm ${far.id}, bấm tại (${fx(click.x, 0)}, ${fx(click.y, 0)}), bắt đầu đi nhanh: ${res.started}, cách chỗ đứng ${fx(res.d)} m`);
  }
}

// ===== c) một cuốc xe ôm trọn vẹn, chạy xe thật =====
// Lái tự động bằng PHÍM THẬT: A/D theo sai số hướng tới đích, W khi còn xa, phanh (Space) khi tới gần. Trả về khi cách đích dưới stopR và chậm.
async function rideTo(p, tx, tz, stopR, maxSecs = 60) {
  const down = new Set(), set = async (k, on) => { if (on && !down.has(k)) { await p.keyboard.down(k); down.add(k); } else if (!on && down.has(k)) { await p.keyboard.up(k); down.delete(k); } };
  let t = 0, minD = 1e9, s;
  for (; t < maxSecs; t += 0.1) {
    s = await p.evaluate(([tx, tz]) => { const I = window.__inv, r = I.run(6, [1000 / 60]), g = window.__game, P = g.player; const want = Math.atan2(tx - P.pos.x, tz - P.pos.z), e = Math.atan2(Math.sin(want - P.yaw), Math.cos(want - P.yaw)); return { d: Math.hypot(tx - P.pos.x, tz - P.pos.z), e, v: P.speed, fare: g.fares.state, prompt: !!g.fares.prompt, x: P.pos.x, z: P.pos.z }; }, [tx, tz]);
    if (s.d < minD) minD = s.d;
    if (s.d < stopR && Math.abs(s.v) < 1.5) break;
    // yaw giảm là rẽ phải (đo ở controls.mjs): sai số âm → bấm D
    await set('KeyD', s.e < -0.08); await set('KeyA', s.e > 0.08);
    const brakeDist = stopR + s.v * s.v / 8 + 1.5;
    await set('Space', s.d < brakeDist && s.v > 1.2); await set('KeyW', !(s.d < brakeDist) && s.v < (Math.abs(s.e) > 0.5 ? 2.5 : 7) || (s.d >= stopR && s.v < 0.8));
  }
  for (const k of [...down]) await p.keyboard.up(k);
  await p.evaluate(() => window.__inv.run(20, [1000 / 60]));
  return { t, minD, ...s };
}
if (want('c')) {
  // chọn một con phố xe chạy được, thẳng và dài, không gần khu trang nghiêm; lên xe bằng phím F
  const st = await page.evaluate(async () => { const g = window.__game, Q = window.__qa; const it = g.passport.byId.get('thap_but_dai_nghien'); g.warp(it.s[0], it.s[1]); for (let n = 0; n < 8000; n++) { Q.step(1); if (!g.warping) break; await Q.sleep(4); } Q.step(30); return { visited: g.passport.visited.size, money: g.passport.money, rides: g.passport.rides, pos: [g.player.pos.x, g.player.pos.z] }; });
  await page.evaluate(() => { window.__inv.expectJump = 3; }); await page.keyboard.press('KeyF'); await page.evaluate(() => window.__qa.step(10));
  const mode = await page.evaluate(() => window.__game.player.mode);
  R.check('c0: đã có ít nhất một dấu và lên được xe bằng phím F', st.visited >= 1 && mode === 'bike', `dấu ${st.visited}, mode ${mode}`);
  // chờ khách vẫy (game tự mời sau vài giây)
  const offer = await page.evaluate(() => { const g = window.__game, Q = window.__qa; let n = 0; for (; n < 60 * 40 && g.fares.state !== 'offer'; n++) Q.step(1); const c = g.fares.cust; return { state: g.fares.state, secs: n / 60, cust: c ? { x: c.x, z: c.z, sx: c.sx, sz: c.sz } : null, d: c ? Math.hypot(c.x - g.player.pos.x, c.z - g.player.pos.z) : null, ring: g.fares.pickRing.visible, guest: g.crowd.guest ? true : null }; });
  R.check('c1: lên xe thì trong 40 giây có khách vẫy (vòng vàng hiện trên đường)', offer.state === 'offer' && offer.ring, JSON.stringify({ state: offer.state, sau: fx(offer.secs, 1), cach: fx(offer.d, 0) }));
  if (offer.state === 'offer') {
    // tới gần khách: đặt xe cách khách 25 m trên chính con phố khách đứng, rồi CHẠY XE THẬT tới
    const ap = await page.evaluate((c) => { const g = window.__game, n = g.nav, P = g.player; const h = n.nearestRoad(c.x, c.z, 12, (r) => r.veh); if (!h) return null; const r = h.r, i = h.seg, dx = r.p[i + 2] - r.p[i], dz = r.p[i + 3] - r.p[i + 1], L = Math.hypot(dx, dz) || 1; let best = null; for (const sg of [1, -1]) for (const d of [25, 18, 12]) { const x = c.x + (dx / L) * sg * d, z = c.z + (dz / L) * sg * d; if (n.onRoad(x, z) && !window.__inv.inside(x, z) && window.__cam === undefined) { best = [x, z, Math.atan2(-dx * sg, -dz * sg)]; break; } if (best) break; } if (!best) return null; window.__inv.expectJump = 3; P.teleport(best[0], best[1], best[2], false); g.cam.snap(P); window.__qa.step(5); return best; }, offer.cust);
    const r1 = ap ? await rideTo(page, offer.cust.x, offer.cust.z, 4.2, 40) : null;
    const pr = await page.evaluate(() => { const g = window.__game; window.__qa.step(10); return { prompt: !!g.fares.prompt, text: document.getElementById('prompt').textContent, hidden: document.getElementById('prompt').classList.contains('hidden'), d: Math.hypot(g.fares.cust.x - g.player.pos.x, g.fares.cust.z - g.player.pos.z), v: g.player.speed }; });
    R.check('c2: chạy xe thật tới chỗ khách (25 m), dừng trong vòng 5 m: hiện lời nhắc bấm E để đón', !!ap && pr.prompt && !pr.hidden && /E/.test(pr.text), `cách khách ${fx(pr.d, 1)} m, vận tốc ${fx(pr.v, 1)}, lời nhắc "${pr.text}"; chạy ${r1 ? fx(r1.t, 0) : '-'} giây`);
    await page.keyboard.press('KeyE');
    const pick = await page.evaluate(() => { const g = window.__game, Q = window.__qa, P = g.player; Q.step(2); const t0 = { state: g.fares.state, passenger: P.passenger }; Q.step(60); return { t0, state: g.fares.state, passenger: P.passenger, guestVisible: !!(P.guest && P.guest.visible), passT: P.passT, guestOnBike: !!(P.guest && P.guest.parent === P.bike), farePanel: !document.getElementById('fare').classList.contains('hidden'), dest: g.fares.dest ? { x: g.fares.dest.x, z: g.fares.dest.z, name: g.fares.dest.place.name.vi } : null, fareText: document.getElementById('fare').innerText.replace(/\n+/g, ' | '), total: g.fares.total }; });
    R.check('c3: bấm E: vào trạng thái chở khách, khách hiện trên yên sau (gắn vào xe), bảng cuốc xe hiện điểm đến và tiền', pick.state === 'ride' && pick.passenger && pick.guestVisible && pick.passT > 0.95 && pick.guestOnBike && pick.farePanel && !!pick.dest, JSON.stringify({ state: pick.state, khach: pick.guestVisible, passT: fx(pick.passT), bang: pick.fareText, quang: fx(pick.total, 0) }));
    if (pick.state === 'ride') {
      // tới điểm trả: đặt xe cách điểm trả 35 m trên chính con phố đó (không tự lái qua cả khu phố), rồi chạy xe thật tới và dừng
      const before = await page.evaluate(() => ({ money: window.__game.passport.money, rides: window.__game.passport.rides }));
      const ap2 = await page.evaluate((c) => { const g = window.__game, n = g.nav, P = g.player, Q = window.__qa; return (async () => { g.chunks.update(c.x, c.z, true); for (let k = 0; k < 8000 && g.chunks.missingNear(c.x, c.z, 150)[0] > 0; k++) { await Q.sleep(4); g.chunks.update(c.x, c.z); } const h = n.nearestRoad(c.x, c.z, 14, (r) => r.veh); if (!h) return null; const r = h.r, i = h.seg, dx = r.p[i + 2] - r.p[i], dz = r.p[i + 3] - r.p[i + 1], L = Math.hypot(dx, dz) || 1; for (const sg of [1, -1]) for (const d of [35, 25, 15]) { const x = c.x + (dx / L) * sg * d, z = c.z + (dz / L) * sg * d; if (n.onRoad(x, z) && !window.__inv.inside(x, z)) { window.__inv.expectJump = 3; P.teleport(x, z, Math.atan2(-dx * sg, -dz * sg), false); g.cam.snap(P); Q.step(5); return [x, z]; } } return null; })(); }, pick.dest);
      const r2 = ap2 ? await rideTo(page, pick.dest.x, pick.dest.z, 4.5, 50) : null;
      const drop = await page.evaluate(() => { const g = window.__game, Q = window.__qa, P = g.player; Q.step(10); const a = { state: g.fares.state, passenger: P.passenger, toast: document.getElementById('toast-text').textContent, toastHidden: document.getElementById('toast').classList.contains('hidden') }; Q.step(90); return { ...a, guestVisible: !!(P.guest && P.guest.visible), passT: P.passT, money: g.passport.money, rides: g.passport.rides, hudMoney: document.getElementById('money').textContent, farePanel: !document.getElementById('fare').classList.contains('hidden'), result: g.fares.result ? { base: g.fares.result.base, tip: g.fares.result.tip, stars: g.fares.result.stars } : null, saved: JSON.parse(localStorage.getItem('hn-save-v2') || '{}') }; });
      const gain = drop.money - before.money;
      R.check('c4: chạy xe thật tới điểm trả (35 m), dừng trong vòng 6 m: khách xuống xe, tiền tăng đúng bằng cước + thưởng, số cuốc +1, bảng cuốc ẩn, có lời nhắn kèm sao, đã lưu', !!ap2 && drop.state === 'idle' && !drop.passenger && !drop.guestVisible && drop.result && gain === drop.result.base + drop.result.tip && gain >= 15000 && drop.rides === before.rides + 1 && !drop.farePanel && /★/.test(drop.toast) && drop.saved.rides === drop.rides && drop.saved.money === drop.money, JSON.stringify({ state: drop.state, khachConTrenXe: drop.guestVisible, tienTang: gain, ketQua: drop.result, cuoc: `${before.rides}→${drop.rides}`, hud: drop.hudMoney, loiNhan: drop.toast, chay: r2 ? `${fx(r2.t, 0)} giây, còn cách ${fx(r2.d, 1)} m` : 'không đặt được xe' }));
    }
  }
}

// ===== d) lưu qua tải lại trang =====
if (want('d')) {
  const before = await page.evaluate(() => { const g = window.__game; window.__qa.step(60 * 11); return { visited: [...g.passport.visited].sort(), money: g.passport.money, rides: g.passport.rides, pos: [g.player.pos.x, g.player.pos.z], hours: g.sky.hours, hud: document.getElementById('count').textContent, raw: localStorage.getItem('hn-save-v2') }; }); // 11 giây: quá chu kỳ tự lưu vị trí 10 giây
  R.check('d0: trước khi tải lại đã có tiến độ để lưu (≥ 1 dấu) và dữ liệu đã nằm trong localStorage mà không cần sự kiện đóng trang', before.visited.length >= 1 && !!before.raw && JSON.parse(before.raw).visited.length === before.visited.length, `dấu ${before.visited.length}, tiền ${before.money}, cuốc ${before.rides}`);
  await page.close();
  // 1) tải lại KHÔNG có ?fresh, không có ?h: vào màn hình "chơi tiếp", trở lại gần chỗ cũ
  let o = await openGame(browser, 'q=low&lang=vi', { init: invariantHelper, context: ctx, start: 'none' });
  const a1 = await o.page.evaluate(() => { const g = window.__game; return { visited: [...g.passport.visited].sort(), money: g.passport.money, rides: g.passport.rides, pos: [g.player.pos.x, g.player.pos.z], play: document.getElementById('play').textContent, startShown: !document.getElementById('start').classList.contains('hidden'), hud: document.getElementById('count').textContent }; });
  const dpos = Math.hypot(a1.pos[0] - before.pos[0], a1.pos[1] - before.pos[1]);
  R.check('d1: tải lại trang: dấu, tiền, số cuốc còn nguyên; nút đổi thành "chơi tiếp"; nhân vật trở lại trong vòng 15 m chỗ cũ', JSON.stringify(a1.visited) === JSON.stringify(before.visited) && a1.money === before.money && a1.rides === before.rides && a1.startShown && a1.play !== 'Bắt đầu dạo phố' && dpos < 15, `dấu ${a1.visited.length}/${before.visited.length}, tiền ${a1.money}/${before.money}, cuốc ${a1.rides}/${before.rides}, nút "${a1.play}", HUD ${a1.hud}, lệch chỗ cũ ${fx(dpos, 1)} m`);
  errors = errors.concat(o.errors); await o.page.close();
  // 2) dữ liệu lưu hỏng (người dùng sửa tay, bản cũ): game vẫn phải vào được
  for (const [name, val] of [['chuỗi rác', '{oops'], ['kiểu sai', '{"visited":"abc","money":"x","rides":null,"flags":7}'], ['id lạ + vị trí hỏng', '{"visited":["khong_co","thap_rua"],"money":123,"rides":2,"flags":{"pos":[null,"a",1e99]}}']]) {
    const c2 = await browser.newContext({ viewport: { width: 960, height: 540 } });
    await c2.addInitScript((v) => { try { localStorage.setItem('hn-save-v2', v); } catch { /* */ } }, val);
    let res; try { const q = await openGame(browser, 'q=low&lang=vi', { init: invariantHelper, context: c2, start: 'click' }); res = await q.page.evaluate(() => { const g = window.__game; return { ok: true, bad: window.__qa.finite(), money: g.passport.money, visited: g.passport.visited.size, hud: document.getElementById('hud').innerText.replace(/\s+/g, ' ').slice(0, 80), pos: [g.player.pos.x, g.player.pos.z] }; }); res.errors = q.errors; } catch (e) { res = { ok: false, err: String(e.message).slice(0, 200) }; }
    R.check(`d2: dữ liệu lưu hỏng (${name}): game vẫn vào được, không số hỏng, không lỗi`, res.ok && res.bad.length === 0 && res.errors.length === 0 && Number.isFinite(res.money) && !/NaN|undefined|null/.test(res.hud), JSON.stringify(res).slice(0, 400));
    await c2.close();
  }
}
R.check('không có pageerror / console.error', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close();
process.exit(R.finish());
