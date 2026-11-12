// Nghiệm thu trên trình duyệt thật (Chromium), chạy với bản build trong dist/:
//   a1  đi bộ từ trước cổng đền qua cổng, lên cầu Thê Húc, sang đảo; phải nhận đủ hai dấu cau_the_huc và den_ngoc_son
//   a2  ép nhân vật vào tường ở các điểm từng bị đen màn hình rồi xoay camera đủ 360°: không khung hình nào đen
//   a3  đi nhanh lần lượt tới cả 44 điểm: không kẹt trong vật thể, không đen màn hình
//   d1  hướng đi theo phím ở 4 góc camera, camera hồi phục sau khi sát tường, thông báo khi không có WebGL2
//   b1  (gồm cả B2, B4, C3, C5 đến C10) khách ngồi sau, HUD ở 1140 × 670, âm thanh và hai công tắc, các lỗi nhẹ
// Dùng: node tools/accept.mjs [a1] [a2] [a3] [thư mục ảnh]     (CHROME_PATH để chỉ định trình duyệt)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2), want = (k) => !args.some((a) => /^[a-d]\d+$/.test(a)) || args.includes(k);
const DIST = path.resolve('dist'), OUT = path.resolve(args.find((a) => !/^[a-d]\d+$/.test(a)) || 'shots');
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  const p = path.join(DIST, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const errors = [], fail = (m) => { errors.push(m); console.error('✗', m); }, ok = (m) => console.log('✓', m);
const SLOW = 600000;

async function open(name, query) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('console', (m) => { if (m.type() === 'error') fail(`${name}: console: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', (e) => fail(`${name}: ${e.message}`));
  await page.goto(`http://localhost:${port}/?shot&q=low&fresh&h=10${query}`);
  await page.waitForFunction(() => window.__ready === true || /error|lỗi/i.test(document.getElementById('loadtext')?.textContent || ''), null, { timeout: SLOW });
  if (!(await page.evaluate(() => window.__ready === true))) throw new Error('game không khởi động được: ' + (await page.evaluate(() => document.getElementById('loadtext')?.textContent)));
  await page.evaluate(() => {
    // Tỉ lệ điểm ảnh gần như đen của khung hình vừa vẽ (đọc ngay sau khi game vẽ, trong cùng một khung hình).
    window.__dark = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
      const gl = document.querySelector('canvas'), c = document.createElement('canvas'); c.width = 96; c.height = 54;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(gl, 0, 0, 96, 54);
      const d = x.getImageData(0, 0, 96, 54).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 24) n++;
      res(n / (d.length / 4));
    })));
    // Giữ phím tiến theo hướng a (rad) trong ms mili giây rồi nhả; trả về quãng đã đi được.
    window.__push = async (a, ms, run = true) => { const g = window.__game, p = g.player.pos, x0 = p.x, z0 = p.z, t0 = performance.now(); g.input.keys.add('w'); if (run) g.input.keys.add('shift'); while (performance.now() - t0 < ms) { g.cam.yaw = a + Math.PI; g.input.lastLook = performance.now(); await new Promise((r) => setTimeout(r, 30)); } g.input.keys.delete('w'); g.input.keys.delete('shift'); return Math.hypot(p.x - x0, p.z - z0); };
    // Đi bộ qua lần lượt các điểm bằng chính bàn phím ảo của game (giữ W, lái bằng hướng camera). Trả về chỉ số điểm bị kẹt, hoặc -1 nếu tới nơi.
    window.__walk = (pts, run = true) => new Promise((res) => {
      const g = window.__game; let i = 0, lastMove = performance.now(), lx = g.player.pos.x, lz = g.player.pos.z;
      const end = (v) => { clearInterval(iv); g.input.keys.delete('w'); g.input.keys.delete('shift'); res(v); };
      const iv = setInterval(() => {
        const p = g.player.pos, [x, z] = pts[i], d = Math.hypot(x - p.x, z - p.z);
        if (d < 1.3) { if (++i >= pts.length) end(-1); return; }
        g.cam.yaw = Math.atan2(x - p.x, z - p.z) + Math.PI; g.input.lastLook = performance.now();
        g.input.keys.add('w'); if (run) g.input.keys.add('shift');
        if (Math.hypot(p.x - lx, p.z - lz) > 0.4) { lx = p.x; lz = p.z; lastMove = performance.now(); }
        else if (performance.now() - lastMove > 6000) end(i);
      }, 25);
    });
  });
  return page;
}

// ----- A1 -----
if (want('a1')) {
  const page = await open('a1', '&at=121,-211');
  const r = await page.evaluate(async () => {
    const g = window.__game, P = g.passport, it = (id) => P.byId.get(id), site = (id) => g.sites.find((s) => s.id === id);
    const th = site('cau_the_huc'), gate = site('ngoc_son_gate'), f = (s, d) => [s.x + Math.sin(s.yaw) * d, s.z + Math.cos(s.yaw) * d];
    window.__norender = true;
    const start = it('thap_but_dai_nghien').s; g.player.teleport(start[0], start[1]);
    const pts = [f(gate, 0), f(th, -6), f(th, 0), f(th, 23), f(th, 46), it('den_ngoc_son').s];
    const stuck = await window.__walk(pts);
    window.__norender = false;
    return { stuck, at: [g.player.pos.x, g.player.pos.z].map((v) => +v.toFixed(1)), y: +g.player.y.toFixed(2), got: ['thap_but_dai_nghien', 'cau_the_huc', 'den_ngoc_son'].filter((id) => P.visited.has(id)), pts };
  });
  console.log('a1', JSON.stringify(r));
  r.stuck === -1 ? ok('A1: đi bộ từ trước cổng, qua cổng, lên cầu Thê Húc, sang tới đảo') : fail(`A1: kẹt ở chặng ${r.stuck} tại (${r.at})`);
  r.got.includes('cau_the_huc') && r.got.includes('den_ngoc_son') ? ok(`A1: nhận đủ dấu ${r.got.join(', ')}`) : fail(`A1: thiếu dấu, mới có ${r.got.join(', ') || 'không dấu nào'}`);
  await page.waitForTimeout(1500); await page.screenshot({ path: path.join(OUT, 'a1_dao_ngoc_son.png'), timeout: SLOW });
  await page.close();
}

// ----- A2 -----
if (want('a2')) {
  const page = await open('a2', '&at=121,-211');
  for (const [x, z] of [[88, -217], [86.5, -224], [107, -213], [98, -215]]) {
    const r = await page.evaluate(async ([x, z]) => {
      const g = window.__game, p = { x, z }; g.nav.collide(p, 0.3); g.player.teleport(p.x, p.z, 0, false);
      // ép vào tường: đi về bốn hướng mỗi hướng 1 giây
      window.__norender = true;
      for (const a of [0, 1.57, 3.14, 4.71]) await window.__push(a, 1000, false);
      window.__norender = false;
      let worst = 0, at = 0; const close = [];
      for (let k = 0; k < 24; k++) { g.cam.yaw = (k / 24) * Math.PI * 2; g.input.lastLook = performance.now(); const d = await window.__dark(); close.push(+g.cam.close.toFixed(2)); if (d > worst) { worst = d; at = k; } }
      return { pos: [g.player.pos.x, g.player.pos.z].map((v) => +v.toFixed(1)), worst: +worst.toFixed(3), at, minClose: Math.min(...close) };
    }, [x, z]);
    console.log('a2', x, z, JSON.stringify(r));
    r.worst < 0.5 ? ok(`A2: (${x}, ${z}) xoay 360° không đen (tối nhất ${(r.worst * 100).toFixed(0)}% điểm ảnh đen)`) : fail(`A2: (${x}, ${z}) có khung hình đen ${(r.worst * 100).toFixed(0)}% ở góc ${r.at * 15}°`);
    if (r.worst >= 0.5) { await page.evaluate((k) => { window.__game.cam.yaw = (k / 24) * Math.PI * 2; }, r.at); await page.waitForTimeout(1200); await page.screenshot({ path: path.join(OUT, `a2_den_${x}_${z}.png`), timeout: SLOW }); }
  }
  await page.screenshot({ path: path.join(OUT, 'a2_cong_den.png'), timeout: SLOW });
  await page.close();
}

// ----- A3 -----
if (want('a3')) {
  const page = await open('a3', '&at=121,-211');
  const ids = await page.evaluate(() => window.__game.passport.items.map((i) => i.id));
  let bad = 0;
  for (const id of ids) {
    const r = await page.evaluate(async (id) => {
      const g = window.__game, it = g.passport.byId.get(id), [sx, sz] = it.s || [it.x, it.z];
      window.__norender = true;
      g.warp(sx, sz, Math.atan2(it.x - sx, it.z - sz));
      await new Promise((res) => { const iv = setInterval(() => { if (!g.warping) { clearInterval(iv); res(); } }, 50); });
      await new Promise((res) => setTimeout(res, 300));
      window.__norender = false;
      const dark = await window.__dark(), p = g.player.pos, off = +Math.hypot(p.x - sx, p.z - sz).toFixed(1), close = +g.cam.close.toFixed(2);
      // còn cử động được: thử bước về bốn hướng, phải có ít nhất một hướng đi được 1 m
      window.__norender = true; let free = false;
      for (const a of [0, 1.57, 3.14, 4.71]) if ((await window.__push(a, 1200)) > 1) { free = true; break; }
      window.__norender = false;
      return { off, dark: +dark.toFixed(2), close, free, dist: +Math.hypot(it.x - sx, it.z - sz).toFixed(1), radius: it.radius };
    }, id);
    const good = r.dark < 0.5 && r.free && r.close > 0.8 && r.dist <= r.radius && r.off < 1.5; // off: bị đẩy khỏi chỗ đã tính sẵn bao xa
    if (!good) { bad++; fail(`A3: ${id} ${JSON.stringify(r)}`); await page.waitForTimeout(800); await page.screenshot({ path: path.join(OUT, `a3_${id}.png`), timeout: SLOW }); }
    else console.log('  ', id.padEnd(28), JSON.stringify(r));
  }
  if (!bad) ok(`A3: đi nhanh tới cả ${ids.length} điểm, không kẹt, không đen màn hình, đứng trong tầm đóng dấu`);
  await page.close();
}
// ----- D (đợt QC thứ hai): hướng đi theo phím, camera hồi phục, báo lỗi khi không có WebGL -----
if (want('d1')) {
  const page = await open('d1', '&at=150,-150');
  // D1: ở bốn góc camera, W đi ra xa ống kính, S đi về phía ống kính, D sang phải màn hình, A sang trái màn hình
  const r = await page.evaluate(async () => {
    const g = window.__game, P = g.player, out = [], sleep = (ms) => new Promise((r2) => setTimeout(r2, ms));
    window.__norender = true;
    { const spot = { x: 150, z: -150 }; g.nav.collide(spot, 0.4); P.teleport(spot.x, spot.z, 0, false); await window.__push(0, 800, false); } // chạy đà: bỏ khung hình đầu sau khi tắt vẽ
    for (const deg of [0, 90, 180, 270]) for (const key of ['w', 's', 'd', 'a', 'arrowup', 'arrowdown', 'arrowright', 'arrowleft']) {
      const spot = { x: 150, z: -150 }; g.nav.collide(spot, 0.4); P.teleport(spot.x, spot.z, 0, false); const yaw = (deg * Math.PI) / 180;
      // nhân vật ban đầu quay mặt về hướng nam: có hướng phải quay người 180° rồi mới đi, nên bỏ 0,9 giây đầu và đo 1 giây sau đó
      let x0 = P.pos.x, z0 = P.pos.z, marked = false; const t0 = performance.now(); g.input.keys.add(key);
      while (performance.now() - t0 < 1900) { g.cam.yaw = yaw; g.input.lastLook = performance.now(); await sleep(30); if (!marked && performance.now() - t0 > 900) { marked = true; x0 = P.pos.x; z0 = P.pos.z; } }
      g.input.keys.delete(key); await sleep(120);
      const mx = P.pos.x - x0, mz = P.pos.z - z0, len = Math.hypot(mx, mz) || 1;
      // camera ở phía (sin yaw, cos yaw) của nhân vật: hướng nhìn là (-sin, -cos), bên phải màn hình là (cos, -sin)
      const fwd = (mx * -Math.sin(yaw) + mz * -Math.cos(yaw)) / len, right = (mx * Math.cos(yaw) + mz * -Math.sin(yaw)) / len;
      out.push({ deg, key, len: +len.toFixed(2), fwd: +fwd.toFixed(2), right: +right.toFixed(2) });
    }
    window.__norender = false; return out;
  });
  const want2 = { w: ['fwd', 1], arrowup: ['fwd', 1], s: ['fwd', -1], arrowdown: ['fwd', -1], d: ['right', 1], arrowright: ['right', 1], a: ['right', -1], arrowleft: ['right', -1] };
  const wrong = r.filter((q) => q.len < 0.3 || q[want2[q.key][0]] * want2[q.key][1] < 0.9);
  wrong.length ? fail(`D1: hướng đi sai ở ${wrong.length}/${r.length} trường hợp: ${JSON.stringify(wrong.slice(0, 4))}`) : ok(`D1: ${r.length} trường hợp (4 góc camera × 8 phím) đều đi đúng hướng so với màn hình`);
  // D4: lớp sự kiện bàn phím. Phím thật qua trình duyệt, rồi các biến thể của phím W mà người dùng Việt hay gặp: Caps Lock,
  // bộ gõ đang ghép chữ (key = "Process"), Telex biến W thành "ư". Cả bốn phải đi tới như nhau vì game đọc theo vị trí phím.
  {
    const run = async (press, release) => {
      await page.evaluate(async () => { const g = window.__game, P = g.player, spot = { x: 150, z: -150 }; window.__norender = true; g.input.keys.clear(); g.nav.collide(spot, 0.4); P.teleport(spot.x, spot.z, Math.PI, false); g.cam.yaw = 0; await new Promise((r2) => setTimeout(r2, 200)); });
      await press();
      const d = await page.evaluate(async () => { const g = window.__game, P = g.player, t0 = performance.now(); let x0 = P.pos.x, z0 = P.pos.z, m = false; while (performance.now() - t0 < 1700) { g.cam.yaw = 0; g.input.lastLook = performance.now(); await new Promise((r2) => setTimeout(r2, 30)); if (!m && performance.now() - t0 > 700) { m = true; x0 = P.pos.x; z0 = P.pos.z; } } return { fwd: -(P.pos.z - z0), side: P.pos.x - x0, held: [...g.input.keys] }; });
      await release();
      const left = await page.evaluate(() => { const k = [...window.__game.input.keys]; window.__norender = false; return k; });
      return { ...d, left };
    };
    const synth = (type, key, code) => page.evaluate(([t, k, c]) => { window.dispatchEvent(new KeyboardEvent(t, { key: k, code: c, bubbles: true })); }, [type, key, code]);
    const cases = [
      ['phím W thật', () => page.keyboard.down('KeyW'), () => page.keyboard.up('KeyW')],
      ['mũi tên lên thật', () => page.keyboard.down('ArrowUp'), () => page.keyboard.up('ArrowUp')],
      ['Caps Lock (key = W)', () => synth('keydown', 'W', 'KeyW'), () => synth('keyup', 'W', 'KeyW')],
      ['bộ gõ đang ghép (key = Process)', () => synth('keydown', 'Process', 'KeyW'), () => synth('keyup', 'w', 'KeyW')],
      ['Telex (key = ư)', () => synth('keydown', 'ư', 'KeyW'), () => synth('keyup', 'ư', 'KeyW')],
    ];
    const bad = [];
    for (const [name, press, release] of cases) { const q = await run(press, release); if (!(q.fwd > 0.5 && Math.abs(q.side) < q.fwd * 0.3) || q.left.length) bad.push(`${name}: tiến ${q.fwd.toFixed(2)} m, lệch ${q.side.toFixed(2)} m, phím còn kẹt [${q.left}]`); }
    bad.length ? fail('D4: lớp bàn phím: ' + bad.join('; ')) : ok(`D4: ${cases.length} cách nhấn phím tiến (phím thật, Caps Lock, bộ gõ đang ghép, Telex) đều đi tới, nhả phím là dừng`);
    // bộ gõ nuốt phím (ký tự có dấu tới mà không kèm mã phím): hiện lời nhắc đúng một lần
    const hint = await page.evaluate(async () => { const has = () => /W A S D/.test(document.body.innerText); const before = has(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ư', code: '', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ư', code: '', bubbles: true })); await new Promise((r2) => setTimeout(r2, 2500)); return { before, after: has(), keys: [...window.__game.input.keys] }; });
    !hint.before && hint.after && !hint.keys.length ? ok('D4: bộ gõ nuốt phím thì game nhắc tắt bộ gõ hoặc dùng phím mũi tên') : fail('D4: không thấy lời nhắc về bộ gõ tiếng Việt: ' + JSON.stringify(hint));
  }
  // D5: giữ phím lâu mà KHÔNG ép góc camera (như người chơi chỉ dùng bàn phím). Chạy lùi về phía ống kính và chạy ngang phải đi
  // thẳng: nếu camera tự xoay theo thì hướng trên màn hình xoay theo từng khung hình và nhân vật chạy thành vòng tròn.
  {
    const hold = (keys, secs, bike = false, faceCam = false) => page.evaluate(async ([ks, T, bk, fc]) => {
      const g = window.__game, P = g.player, sleep = (ms) => new Promise((r2) => setTimeout(r2, ms)); window.__norender = true; g.input.keys.clear();
      if (P.mode === 'bike') { P.speed = 0; P.toggleBike(); }
      const spot = { x: 150, z: -150 }; g.nav.collide(spot, 0.4);
      // nhân vật quay mặt về phía camera (fc) hoặc quay lưng lại camera; camera ở phía (sin, cos) của góc cam.yaw
      g.cam.yaw = 0.6; P.teleport(spot.x, spot.z, fc ? 0.6 : 0.6 + Math.PI, false); g.input.lastLook = 0; await sleep(150);
      if (bk) { P.toggleBike(); await sleep(100); }
      for (const k of ks) g.input.keys.add(k);
      const pts = [], yaws = [], t0 = g.clock ? g.clock() : 0; let steps = 0, path = 0, px = P.pos.x, pz = P.pos.z; const f0 = window.__info ? window.__info.frame : 0;
      const tEnd = performance.now() + T * 1000;
      while (performance.now() < tEnd) { await sleep(40); steps++; path += Math.hypot(P.pos.x - px, P.pos.z - pz); px = P.pos.x; pz = P.pos.z; pts.push([px, pz]); yaws.push(g.cam.yaw); }
      for (const k of ks) g.input.keys.delete(k);
      const a = pts[0], b = pts[pts.length - 1], net = Math.hypot(b[0] - a[0], b[1] - a[1]);
      // hướng đi ở 30% cuối so với camera lúc đó: tiến (ra xa ống kính) và phải màn hình
      const i0 = Math.floor(pts.length * 0.7), c = pts[i0], cy = g.cam.yaw, mx = b[0] - c[0], mz = b[1] - c[1], ml = Math.hypot(mx, mz) || 1;
      let turn = 0, turnTail = 0; for (let i = 1; i < yaws.length; i++) { const d = yaws[i] - yaws[i - 1], q = Math.atan2(Math.sin(d), Math.cos(d)); turn += q; if (i > yaws.length * 0.5) turnTail += q; }
      void t0; void f0; void steps;
      const out = { net: +net.toFixed(2), path: +path.toFixed(2), turn: +turn.toFixed(2), turnTail: +turnTail.toFixed(2), fwd: +((mx * -Math.sin(cy) + mz * -Math.cos(cy)) / ml).toFixed(2), right: +((mx * Math.cos(cy) + mz * -Math.sin(cy)) / ml).toFixed(2), tail: +ml.toFixed(2), speed: +P.speed.toFixed(2) };
      if (P.mode === 'bike') { P.speed = 0; P.toggleBike(); } window.__norender = false; return out;
    }, [keys, secs, bike, faceCam]);
    const bad = [];
    const back = await hold(['s', 'shift'], 6), side = await hold(['d', 'shift'], 6), diag = await hold(['w', 'd', 'shift'], 6);
    if (!(back.path > 4 && back.net > back.path * 0.9 && Math.abs(back.turn) < 0.25)) bad.push('chạy lùi (S) không thẳng hoặc camera tự xoay: ' + JSON.stringify(back));
    if (!(side.path > 4 && side.net > side.path * 0.9 && Math.abs(side.turn) < 0.25)) bad.push('chạy ngang (D) không thẳng hoặc camera tự xoay: ' + JSON.stringify(side));
    if (!(diag.path > 4 && diag.right > 0.2 && diag.fwd > 0.2)) bad.push('chạy chéo (W + D) không đi về phía phải-trước của màn hình: ' + JSON.stringify(diag));
    // lên xe khi nhân vật đang quay mặt về phía ống kính (vừa đi lùi về phía camera rồi bấm lên xe): camera phải ra sau lưng xe,
    // giữ W thì xe chạy ra xa ống kính; W + D thì xe vòng sang phải màn hình
    const ride = await hold(['w'], 5, true, true), rideR = await hold(['w', 'd'], 4, true, true);
    if (!(ride.path > 6 && ride.fwd > 0.9)) bad.push('lên xe lúc xe quay mặt về camera, giữ W: xe không chạy ra xa ống kính: ' + JSON.stringify(ride));
    if (!(rideR.path > 3 && rideR.fwd > 0.3 && rideR.turnTail < -0.2)) bad.push('đi xe, W + D: xe không vòng sang phải: ' + JSON.stringify(rideR));
    bad.length ? fail('D5: ' + bad.join('; ')) : ok(`D5: giữ phím lâu không đụng chuột: chạy lùi thẳng ${back.net} m, chạy ngang thẳng ${side.net} m (camera không tự xoay), chạy chéo vòng dần; lên xe lúc quay mặt về camera rồi giữ W thì xe chạy ra xa ống kính (${ride.fwd}), W + D vòng phải`);
  }
  // D2: ép vào tường cho camera áp sát rồi đi ra chỗ trống, camera phải tự giãn ra lại; không có toạ độ hỏng
  const c = await page.evaluate(async () => {
    const g = window.__game, P = g.player, sleep = (ms) => new Promise((r2) => setTimeout(r2, ms)); window.__norender = true;
    const p = { x: 88, z: -217 }; g.nav.collide(p, 0.3); P.teleport(p.x, p.z, 0, false);
    let minClose = 9; for (let k = 0; k < 24; k++) { g.cam.yaw = (k / 24) * 6.2832; g.input.lastLook = performance.now(); await sleep(120); minClose = Math.min(minClose, g.cam.close); }
    const spot = { x: 150, z: -150 }; g.nav.collide(spot, 0.4); P.teleport(spot.x, spot.z, 0, false); await sleep(2500);
    const cp = g.camera.position; window.__norender = false;
    return { minClose: +minClose.toFixed(2), after: +g.cam.close.toFixed(2), finite: [cp.x, cp.y, cp.z, g.cam.yaw, g.cam.pitch, P.pos.x, P.pos.z].every(Number.isFinite), near: g.camera.near };
  });
  console.log('d2', JSON.stringify(c));
  c.after > 3 && c.finite ? ok(`D2: sát tường camera thu về ${c.minClose} m, ra chỗ trống tự giãn lại ${c.after} m, không có toạ độ hỏng`) : fail(`D2: camera không hồi phục: ${JSON.stringify(c)}`);
  await page.close();
  // D3: trình duyệt không tạo được WebGL2 thì màn hình tải nói rõ nguyên nhân và cách khắc phục
  const p2 = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await p2.addInitScript(() => { const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...a) { return /webgl/.test(type) ? null : orig.call(this, type, ...a); }; });
  await p2.goto(`http://localhost:${port}/?fresh&lang=vi`);
  await p2.waitForFunction(() => window.__bootError !== undefined, null, { timeout: 120000 }).catch(() => {});
  const e = await p2.evaluate(() => ({ code: window.__bootError, text: document.getElementById('loadtext').textContent }));
  e.code === 'NO_WEBGL2' && /WebGL2/.test(e.text) && /Tăng tốc phần cứng/.test(e.text) && !/is not a function/.test(e.text) ? ok('D3: không có WebGL2 thì báo rõ nguyên nhân và cách khắc phục') : fail(`D3: thông báo lỗi chưa đúng: ${JSON.stringify(e)}`);
  await p2.screenshot({ path: path.join(OUT, 'd3_no_webgl.png') }); await p2.close();
}

// ----- B và C: khách ngồi sau, HUD, âm thanh, các lỗi nhẹ -----
if (want('b1') || want('b2') || want('b4') || want('c1')) {
  const page = await open('bc', '&at=121,-211&lang=vi');
  await page.setViewportSize({ width: 1140, height: 670 });
  await page.mouse.click(570, 400); // thao tác đầu tiên của người chơi: mở khoá âm thanh
  const wait = (ms) => page.waitForTimeout(ms);
  // B4: âm thanh chạy, có tín hiệu ra loa, hai công tắc có tác dụng và được lưu
  {
    const peak = (ms) => page.evaluate((ms) => new Promise((res) => { const a = window.__game.audio; let m = 0; const t0 = performance.now(), iv = setInterval(() => { m = Math.max(m, a.level()); if (performance.now() - t0 > ms) { clearInterval(iv); res(m); } }, 30); }), ms);
    const st = await page.evaluate(() => { const a = window.__game.audio; a.unlock(); return { has: !!a.ctx, state: a.ctx && a.ctx.state }; });
    await wait(500);
    (await page.evaluate(() => window.__game.audio.running)) ? ok('B4: AudioContext chạy sau thao tác đầu tiên của người chơi') : fail(`B4: AudioContext không chạy (${JSON.stringify(st)})`);
    await page.evaluate(() => { const a = window.__game.audio; a.setEnabled(true); a.setMusic(true); });
    const both = await peak(9000);
    await page.evaluate(() => { const a = window.__game.audio; a.setEnabled(false); a.setMusic(false); }); await wait(400);
    const none = await peak(2500);
    await page.evaluate(() => { window.__game.audio.setMusic(true); }); await wait(300); const musicOnly = await peak(9000);
    await page.evaluate(() => { const a = window.__game.audio; a.setMusic(false); a.setEnabled(true); window.__game.player.toggleBike(); window.__game.input.keys.add('w'); }); await wait(300);
    const engine = await peak(2500);
    const saved = await page.evaluate(() => { window.__game.input.keys.delete('w'); const a = window.__game.audio; a.setEnabled(false); const s0 = localStorage.getItem('hn-sound'), m0 = localStorage.getItem('hn-music'); a.setEnabled(true); a.setMusic(true); return [s0, m0, localStorage.getItem('hn-sound'), localStorage.getItem('hn-music')]; });
    console.log('b4 mức âm (RMS đỉnh):', JSON.stringify({ both: +both.toFixed(4), none: +none.toFixed(5), musicOnly: +musicOnly.toFixed(4), engine: +engine.toFixed(4), saved }));
    both > 0.004 ? ok('B4: có tiếng khi bật cả hai') : fail(`B4: bật cả hai mà mức âm chỉ ${both}`);
    none < 0.0006 ? ok('B4: tắt cả hai thì im lặng') : fail(`B4: tắt cả hai mà vẫn có tiếng (${none})`);
    musicOnly > 0.002 ? ok('B4: công tắc Nhạc nền phát nhạc khi Âm thanh tắt') : fail(`B4: chỉ bật nhạc mà mức âm ${musicOnly}`);
    engine > 0.01 ? ok('B4: tiếng máy xe khi vặn ga') : fail(`B4: vặn ga mà mức âm ${engine}`);
    saved.join() === '0,0,1,1' ? ok('B4: hai công tắc được lưu lại') : fail(`B4: lưu công tắc sai: ${saved}`);
  }
  // B1 + C10: đón khách thì khách ngồi yên sau; đâm hai lần thì không còn năm sao; trả khách thì khách xuống xe
  {
    const r = await page.evaluate(async () => {
      const g = window.__game, F = g.fares, P = g.player, sleep = (ms) => new Promise((r2) => setTimeout(r2, ms));
      window.__norender = true; if (P.mode !== 'bike') P.toggleBike(); P.speed = 0;
      for (let i = 0; i < 40 && F.state !== 'offer'; i++) { F.wait = 0; await sleep(100); }
      if (F.state !== 'offer') return { err: 'không có khách vẫy' };
      F.pickup(P); for (let i = 0; i < 60 && P.passT < 0.97; i++) await sleep(100);
      const seated = { visible: !!(P.guest && P.guest.visible), t: +P.passT.toFixed(2), passenger: P.passenger };
      F.bump(0.25); F.bump(0.25); await sleep(300); F.comfort = 1; await sleep(600); const comfort = +F.comfort.toFixed(2);
      P.teleport(F.dest.x, F.dest.z, P.yaw, false); P.speed = 0;
      let res = null; const old = F.onEvent; F.onEvent = (ev, f, done) => { if (ev === 'drop') res = done; old && old(ev, f, done); };
      for (let i = 0; i < 50 && !res; i++) await sleep(100);
      await sleep(1000); window.__norender = false;
      return { seated, comfort, stars: res && res.stars, hits: res && res.hits, after: { visible: !!(P.guest && P.guest.visible), passenger: P.passenger } };
    });
    console.log('b1/c10', JSON.stringify(r));
    r.seated && r.seated.visible && r.seated.t > 0.9 ? ok('B1: khách hiện trên yên sau khi đang chở') : fail(`B1: khách không lên yên sau: ${JSON.stringify(r)}`);
    r.after && !r.after.visible && !r.after.passenger ? ok('B1: trả khách xong khách xuống xe') : fail(`B1: trả khách xong khách vẫn trên xe: ${JSON.stringify(r.after)}`);
    r.stars && r.stars <= 3 && r.comfort < 0.6 ? ok(`C10: đâm hai lần, cuốc xe chỉ còn ${r.stars} sao (độ êm không hồi quá ${r.comfort})`) : fail(`C10: đâm hai lần mà vẫn ${r.stars} sao, độ êm ${r.comfort}`);
  }
  // B2: ở bề rộng 1140 px các ô la bàn không bị cụm nút góc phải che, không có hai ô cùng tên
  {
    await wait(800);
    const r = await page.evaluate(() => { const R = (e) => e.getBoundingClientRect(), tr = R(document.getElementById('topright')), tl = R(document.getElementById('topleft')); const picks = [...document.querySelectorAll('#compass .pick')].filter((p) => p.style.display !== 'none'); const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; return { n: picks.length, over: picks.filter((p) => hit(R(p), tr) || hit(R(p), tl) || R(p).right > innerWidth || R(p).left < 0).length, names: picks.map((p) => p.querySelector('.nm').textContent) }; });
    console.log('b2', JSON.stringify(r));
    r.n >= 2 && r.over === 0 ? ok(`B2: ${r.n} ô la bàn không bị che ở 1140 px`) : fail(`B2: ${r.over}/${r.n} ô la bàn bị che hoặc tràn màn hình`);
    new Set(r.names).size === r.names.length ? ok('B2: không có hai ô la bàn cùng tên') : fail(`B2: ô la bàn trùng tên: ${r.names}`);
    await page.screenshot({ path: path.join(OUT, 'b2_hud_1140.png'), timeout: SLOW });
  }
  // C6: bấm đổi buổi hai lần liên tiếp, thông báo phải là của buổi vừa chuyển tới
  {
    const r = await page.evaluate(async () => { const g = window.__game, sleep = (ms) => new Promise((r2) => setTimeout(r2, ms)); const frames = (n) => new Promise((r2) => { const f = () => (n-- > 0 ? requestAnimationFrame(f) : r2()); f(); }); g.sky.setHours(17.5); g.input.press('time'); await frames(3); const first = document.getElementById('toast-text').textContent; g.input.press('time'); await frames(3); void first; void sleep; return { hours: +g.sky.hours.toFixed(1), toast: document.getElementById('toast-text').textContent }; });
    console.log('c6', JSON.stringify(r));
    r.hours > 5 && r.hours < 8 && !/đêm|night/i.test(r.toast) ? ok(`C6: ${r.hours} giờ sáng, thông báo "${r.toast}"`) : fail(`C6: ${r.hours} giờ mà thông báo là "${r.toast}"`);
  }
  // C5: đổi ngôn ngữ thì thông báo đang hiện và ô la bàn đổi theo ngay
  {
    const r = await page.evaluate(async () => { const g = window.__game, sleep = (ms) => new Promise((r2) => setTimeout(r2, ms)); g.hud.toast(document.documentElement.lang === 'vi' ? 'Phố lên đèn rồi. Hà Nội về đêm mới là đẹp nhất đấy cháu.' : '', 8, 'Chú Thắng', '🧓', true); await sleep(200); const before = document.getElementById('toast-text').textContent; g.setLang('en'); await sleep(100); const after = document.getElementById('toast-text').textContent, who = document.getElementById('toast-who').textContent; g.setLang('vi'); return { before, after, who }; });
    console.log('c5', JSON.stringify(r));
    r.after !== r.before && /Hanoi/.test(r.after) ? ok('C5: thông báo đang hiện đổi sang tiếng Anh ngay') : fail(`C5: thông báo không đổi ngôn ngữ: "${r.after}"`);
  }
  // C3 + C7: bảng Cài đặt hiện số khung hình đo lúc đang chơi; bấm lại mức chất lượng đang chọn không tải lại trang
  {
    const r = await page.evaluate(async () => { const g = window.__game, sleep = (ms) => new Promise((r2) => setTimeout(r2, ms)); window.__mark = 1; g.input.press('settings'); await sleep(1500); const perf = document.getElementById('s-perf').textContent; document.querySelector('#s-quality button.on').click(); await sleep(800); const still = window.__mark === 1, open = g.hud.modal; g.hud.close(); return { perf, fpsPlay: g.G.fpsPlay, still, open }; });
    console.log('c3/c7', JSON.stringify(r));
    r.fpsPlay > 0 && r.perf.includes(String(Math.round(r.fpsPlay))) ? ok(`C3: bảng Cài đặt ghi số đo lúc đang chơi ("${r.perf}")`) : fail(`C3: bảng ghi "${r.perf}" trong khi đo được ${r.fpsPlay}`);
    r.still ? ok('C7: bấm lại mức chất lượng đang chọn không tải lại trang') : fail('C7: trang bị tải lại');
  }
  // C8: "1 ride" (số ít) trong bản tiếng Anh
  {
    const r = await page.evaluate(async () => { const g = window.__game, sleep = (ms) => new Promise((r2) => setTimeout(r2, ms)); g.setLang('en'); void sleep; const keep = g.passport.rides; g.passport.rides = 1; g.hud.openBook(g.passport); const one = document.getElementById('rank').textContent; g.passport.rides = 2; g.hud.openBook(g.passport); const two = document.getElementById('rank').textContent; g.passport.rides = keep; g.hud.close(); g.setLang('vi'); return { one, two }; });
    /\b1 ride\b/.test(r.one) && /\b2 rides\b/.test(r.two) ? ok(`C8: "${r.one.match(/\d+ rides?/)[0]}" và "${r.two.match(/\d+ rides?/)[0]}"`) : fail(`C8: số ít/số nhiều sai: "${r.one}" | "${r.two}"`);
  }
  // C9: bảng Hộ chiếu và Bản đồ vừa khung 1140 × 670, không phải cuộn
  for (const [id, key] of [['book', null], ['map', 'map']]) {
    const r = await page.evaluate(async ([id, key]) => { const g = window.__game, sleep = (ms) => new Promise((r2) => setTimeout(r2, ms)); g.hud.close(); await sleep(100); if (key) g.input.press(key); else g.hud.open(id); await sleep(700); const p = document.querySelector(`#${id} .paper`), b = p.getBoundingClientRect(); return { h: Math.round(b.height), top: Math.round(b.top), bottom: Math.round(b.bottom), scroll: p.scrollHeight - p.clientHeight, vh: innerHeight }; }, [id, key]);
    console.log('c9', id, JSON.stringify(r));
    r.h > 200 && r.top >= 0 && r.bottom <= r.vh && r.scroll <= 1 ? ok(`C9: bảng ${id} cao ${r.h} px, vừa khung ${r.vh} px, không cuộn`) : fail(`C9: bảng ${id} không vừa khung: ${JSON.stringify(r)}`);
    await page.screenshot({ path: path.join(OUT, `c9_${id}.png`), timeout: SLOW });
  }
  await page.evaluate(() => { window.__game.hud.close(); });
  await page.close();
}
await browser.close(); server.close();
if (errors.length) { console.error(`\n${errors.length} lỗi`); process.exit(1); }
console.log('NGHIỆM THU ĐẠT, ảnh trong', OUT);
