// Thư viện dùng chung cho bộ kiểm thử độc lập (đợt 3). Không phụ thuộc mã game: chỉ mở bản build qua HTTP bằng Chromium
// (Playwright) và đọc trạng thái qua window.__game. Mỗi tệp thử trong thư mục này chạy độc lập:
//   node tools/qa/<tên>.mjs            (QA_URL=http://localhost:5192/ mặc định; CHROME_PATH chỉ định trình duyệt)
// Mã thoát khác 0 khi có phép kiểm hỏng. Mọi phép kiểm in ra số đo.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

export const BASE = process.env.QA_URL || 'http://localhost:5192/';
export const SLOW = 600000;
export const OUT = path.resolve(process.env.QA_OUT || '.cache/qa'); // nhật ký và ảnh của bộ thử (thư mục .cache không đưa vào kho mã)
fs.mkdirSync(OUT, { recursive: true });

export const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
export async function launch(extra = []) {
  return chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: [...GL_ARGS, ...extra] });
}

// ----- bảng kết quả -----
export class Report {
  constructor(name) { this.name = name; this.rows = []; this.t0 = Date.now(); }
  // ok: true/false; 'skip' = không kiểm được (không tính là đạt)
  check(id, ok, detail = '') {
    this.rows.push({ id, ok, detail });
    const mark = ok === true ? 'ĐẠT ' : ok === 'skip' ? 'BỎ  ' : 'HỎNG';
    console.log(`[${mark}] ${id}${detail ? ' :: ' + detail : ''}`);
    return ok === true;
  }
  note(msg) { console.log('   · ' + msg); }
  finish() {
    const bad = this.rows.filter((r) => r.ok === false), skip = this.rows.filter((r) => r.ok === 'skip');
    console.log(`\n== ${this.name}: ${this.rows.length - bad.length - skip.length} đạt, ${bad.length} hỏng, ${skip.length} không kiểm được, ${((Date.now() - this.t0) / 1000).toFixed(0)} giây`);
    for (const b of bad) console.log('   HỎNG: ' + b.id + ' :: ' + b.detail);
    try { fs.writeFileSync(path.join(OUT, `${this.name}.json`), JSON.stringify({ name: this.name, rows: this.rows, secs: (Date.now() - this.t0) / 1000 }, null, 1)); } catch { /* */ }
    return bad.length ? 1 : 0;
  }
}

// ----- mã chạy trong trang TRƯỚC mã game -----
// __qa.seed(n): thay Math.random bằng bộ sinh có hạt giống (mulberry32) để lần chạy lặp lại được.
// __qa.virtual(): chuyển vòng lặp game sang đồng hồ ảo; __qa.step(n, dtMs) chạy n khung hình, mỗi khung dtMs mili giây giờ game
//   (performance.now và requestAnimationFrame cùng theo đồng hồ ảo, nên mọi phép tính thời gian của game nhất quán).
// Ở chế độ thật (mặc định) không có gì bị thay đổi ngoài việc đếm khung hình.
export function pageHelper(seed) {
  const realRAF = window.requestAnimationFrame.bind(window), realNow = performance.now.bind(performance);
  let virt = null, switching = false, queue = [], id = 1e6, frames = 0, lastT = 0;
  window.requestAnimationFrame = (f) => { if (virt === null && !switching) return realRAF((t) => { frames++; lastT = t; f(t); }); queue.push(f); return ++id; };
  performance.now = () => (virt === null ? realNow() : virt);
  const Q = (window.__qa = {
    realNow, get frames() { return frames; }, get isVirtual() { return virt !== null; },
    seed(n) { let a = n | 0; Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
    // chuyển sang đồng hồ ảo: chờ khung hình thật đang treo chạy xong để vòng lặp game rơi vào hàng đợi ảo, rồi cho đồng hồ ảo bắt đầu
    // từ mốc thời gian của khung hình thật cuối cùng (đồng hồ không bao giờ chạy lùi)
    async virtual() { if (virt !== null) return; switching = true; for (let i = 0; i < 3000 && !queue.length; i++) await new Promise((r) => setTimeout(r, 10)); if (!queue.length) throw new Error('vòng lặp game không vào hàng đợi ảo'); virt = Math.max(realNow(), lastT); switching = false; },
    step(n = 1, dtMs = 1000 / 60) { for (let i = 0; i < n; i++) { virt += dtMs; frames++; const q = queue; queue = []; for (const f of q) f(virt); } },
    yield: () => new Promise((r) => setTimeout(r, 0)),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    // chờ n khung hình thật
    waitFrames: (n) => new Promise((res) => { const f0 = frames; const tick = () => (frames - f0 >= n ? res() : realRAF(tick)); tick(); }),
    // chờ cho tới khi giờ game (G.t, đã kẹp dt ≤ 0,05 giây mỗi khung) trôi thêm s giây
    waitGame: (s) => new Promise((res) => { const G = window.__game.G, t0 = G.t; const tick = () => (G.t - t0 >= s ? res(G.t - t0) : realRAF(tick)); tick(); }),
    // hướng nhìn và hướng "phải màn hình" của camera trên mặt phẳng ngang, lấy từ chính ma trận camera dùng để vẽ
    basis() { const c = window.__game.camera; c.updateMatrixWorld(); const e = c.matrixWorld.elements; const rl = Math.hypot(e[0], e[2]) || 1, fl = Math.hypot(e[8], e[10]) || 1; return { rx: e[0] / rl, rz: e[2] / rl, fx: -e[8] / fl, fz: -e[10] / fl, cx: e[12], cy: e[13], cz: e[14] }; },
    snap() { const g = window.__game, P = g.player, b = Q.basis(); return { t: g.G.t, x: P.pos.x, z: P.pos.z, y: P.y, yaw: P.yaw, v: P.speed, mode: P.mode, camYaw: g.cam.yaw, pitch: g.cam.pitch, cur: g.cam.cur, close: g.cam.close, ...b }; },
    finite() { const g = window.__game, P = g.player, c = g.camera, q = c.quaternion; const vals = { px: P.pos.x, pz: P.pos.z, py: P.y, pyaw: P.yaw, pv: P.speed, camYaw: g.cam.yaw, camPitch: g.cam.pitch, camCur: g.cam.cur, camDist: g.cam.dist, cx: c.position.x, cy: c.position.y, cz: c.position.z, qx: q.x, qy: q.y, qz: q.z, qw: q.w, fov: c.fov, near: c.near }; const bad = Object.entries(vals).filter(([, v]) => !Number.isFinite(v)).map(([k, v]) => `${k}=${v}`); return bad; },
  });
  if (seed !== null && seed !== undefined) Q.seed(seed);
}

// Mở game. opts: viewport, seed, start ('shot' = vào thẳng game bằng tham số ?shot; 'click' = bấm nút Bắt đầu như người chơi thật),
// ctx (tuỳ chọn ngữ cảnh trình duyệt: hasTouch, isMobile...), init (hàm chạy thêm trong trang trước mã game), norender (tắt vẽ từ đầu),
// context (dùng lại một ngữ cảnh đã có, để giữ localStorage qua các lần tải lại).
// Trả về { page, ctx, errors } ; errors gom pageerror và console.error.
export async function openGame(browser, query = '', opts = {}) {
  const ctx = opts.context || await browser.newContext({ viewport: opts.viewport || { width: 960, height: 540 }, ...(opts.ctx || {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 400)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message).slice(0, 600)));
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText || '')));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
  await page.addInitScript(pageHelper, opts.seed ?? null);
  if (opts.norender) await page.addInitScript(() => { window.__norender = true; }); // bài thử logic: không vẽ ngay từ khung hình đầu (khởi động nhanh hơn nhiều trên máy không GPU)
  if (opts.init) await page.addInitScript(opts.init);
  const start = opts.start || 'shot';
  const url = `${BASE}?${start === 'shot' ? 'shot&' : ''}${query.replace(/^&/, '')}`;
  await page.goto(url, { timeout: SLOW });
  if (opts.noWait) return { page, ctx, errors, url };
  await page.waitForFunction(() => window.__ready === true || window.__bootError !== undefined, null, { timeout: SLOW });
  const boot = await page.evaluate(() => window.__bootError);
  if (boot !== undefined) throw new Error('game không khởi động được: ' + boot);
  if (start === 'click') { await page.click('#play', { timeout: SLOW }); await page.waitForFunction(() => window.__game.G.started === true, null, { timeout: SLOW }); }
  return { page, ctx, errors, url };
}

// Tỉ lệ điểm ảnh đen và độ sáng trung bình của khung hình vừa vẽ (cần ?shot để giữ bộ đệm vẽ). Thu nhỏ về 96×54.
export const frameStats = (page) => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
  const gl = document.getElementById('game'), c = document.createElement('canvas'); c.width = 96; c.height = 54;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(gl, 0, 0, 96, 54);
  const d = x.getImageData(0, 0, 96, 54).data; let dark = 0, sum = 0, top = 0, nt = 0; const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; sum += l; if (d[i] + d[i + 1] + d[i + 2] < 24) dark++; if (i / 4 < 96 * 18) { top += l; nt++; } }
  res({ dark: dark / n, mean: sum / n, topMean: top / nt });
}))));

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const deg = (r) => (r * 180) / Math.PI;
export const fx = (v, n = 2) => (typeof v === 'number' ? +v.toFixed(n) : v);

// ----- bộ kiểm bất biến chạy trong trang (dùng cho fuzz và các bài chạy dài) -----
// __inv.inside(x, z): điểm có nằm TRONG một khối đặc không (nhà, khối công trình): đếm số lần bốn tia ±x, ±z cắt các đoạn va chạm
// cao từ 2,5 m của game.nav (mọi khối đặc là vòng khép kín nên số lần cắt lẻ = ở trong); cần ít nhất 3/4 tia lẻ.
// __inv.frame(): kiểm một khung hình, ghi vi phạm vào __inv.viol (theo loại, giữ 12 mẫu đầu) và __inv.count.
export function invariantHelper() {
  const I = (window.__inv = {
    viol: {}, count: {}, frames: 0, expectJump: 0, last: null, stat: { walk: 0, ride: 0, maxV: 0, maxY: 0, minY: 9, sunkT: 0, floatT: 0, insideCam: 0, camNear: 0, deck: 0 },
    add(kind, o) { I.count[kind] = (I.count[kind] || 0) + 1; const l = I.viol[kind] || (I.viol[kind] = []); if (l.length < 12) l.push({ f: I.frames, t: +window.__game.G.t.toFixed(2), ...o }); },
    inside(x, z, minH = 2.5) {
      const g = window.__game, nav = g.nav, CELL = 16, CS = 128, wb = g.world.bounds, PAD = 160; let odd = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let n = 0;
        for (const [key, c] of nav.chunks) {
          // tia phải đi hết vùng đã dựng (nếu cắt ngắn, tia dừng giữa một ngôi nhà khác sẽ làm sai tính chẵn lẻ): với mỗi ô, chỉ xét
          // khúc tia nằm trong hộp của ô đó nới thêm PAD mét (nhà được xếp vào ô theo tâm nên có thể thò ra ngoài ô)
          let s0 = 0, s1 = 4000;
          if (typeof key === 'number') {
            const X0 = wb.x0 + Math.floor(key / 1000) * CS - PAD, X1 = X0 + CS + 2 * PAD, Z0 = wb.z0 + (key % 1000) * CS - PAD, Z1 = Z0 + CS + 2 * PAD;
            if (dx !== 0) { if (z < Z0 || z > Z1) continue; if (dx > 0) { if (x > X1) continue; s0 = Math.max(0, X0 - x); s1 = X1 - x; } else { if (x < X0) continue; s0 = Math.max(0, x - X1); s1 = x - X0; } }
            else { if (x < X0 || x > X1) continue; if (dz > 0) { if (z > Z1) continue; s0 = Math.max(0, Z0 - z); s1 = Z1 - z; } else { if (z < Z0) continue; s0 = Math.max(0, z - Z1); s1 = z - Z0; } }
          } else s1 = 400; // khối công trình dựng tay: nhỏ, nằm gần
          const seen = new Set();
          for (let s = s0; s <= s1 + CELL; s += CELL) {
            const l = c.cells.get(Math.floor((x + dx * s) / CELL) * 65537 + Math.floor((z + dz * s) / CELL)); if (!l) continue;
            for (let k = 0; k < l.length; k++) {
              const i = l[k]; if (seen.has(i)) continue; seen.add(i);
              const sg = c.segs; if (!(sg[i + 4] >= minH)) continue;
              const ax = sg[i], az = sg[i + 1], bx = sg[i + 2], bz = sg[i + 3];
              if (dx !== 0) { if ((az > z) !== (bz > z)) { const xi = ax + ((z - az) / (bz - az)) * (bx - ax); if ((xi - x) * dx > 0) n++; } }
              else if ((ax > x) !== (bx > x)) { const zi = az + ((x - ax) / (bx - ax)) * (bz - az); if ((zi - z) * dz > 0) n++; }
            }
          }
        }
        if (n & 1) odd++;
      }
      return odd >= 3;
    },
    frame() {
      const g = window.__game, P = g.player, Q = window.__qa, n = g.nav, b = g.world.bounds, f = ++I.frames;
      const bad = Q.finite(); if (bad.length) I.add('không hữu hạn', { bad: bad.join(','), mode: P.mode });
      const x = P.pos.x, z = P.pos.z, y = P.y;
      if (!(x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1)) I.add('ngoài bản đồ', { x, z });
      if (y < -0.05) I.add('dưới mặt đất', { x, z, y });
      const S = I.stat; if (Math.abs(P.speed) > S.maxV) S.maxV = Math.abs(P.speed); if (y > S.maxY) S.maxY = y; if (y < S.minY) S.minY = y; if (y > 2) S.deck++;
      if (Math.abs(P.speed) > 35) I.add('vận tốc phi lý', { v: P.speed, mode: P.mode });
      if (I.last) {
        const d = Math.hypot(x - I.last.x, z - I.last.z);
        if (I.expectJump > 0) I.expectJump--; else if (P.mode === 'bike') S.ride += d; else S.walk += d;
        if (I.expectJump > 0) { /* vừa đi nhanh hoặc lên xe: được phép đổi chỗ */ } else if (d > 2.5 && d > Math.abs(I.last.v) * 0.06 * 3 + 1) I.add('nhảy vị trí', { from: [+I.last.x.toFixed(1), +I.last.z.toFixed(1)], to: [+x.toFixed(1), +z.toFixed(1)], d: +d.toFixed(1), mode: P.mode });
      }
      I.last = { x, z, v: P.speed };
      if (f % 4 === 0 && Number.isFinite(x) && Number.isFinite(z)) {
        const gy = n.groundY(x, z, y);
        if (y < gy - 0.6) { S.sunkT++; if (S.sunkT === 8) I.add('chìm dưới mặt đường', { x, z, y, gy }); } else S.sunkT = 0;
        if (y > gy + 1.5) { S.floatT++; if (S.floatT === 15) I.add('lơ lửng trên không', { x, z, y, gy }); } else S.floatT = 0;
        if (y < 0.45 && n.isWater(x, z) && !n.deckAt(x, z, 0.6)) I.add('đứng dưới nước', { x, z, y });
        if (y < 2 && I.inside(x, z)) I.add('trong lòng nhà', { x: +x.toFixed(2), z: +z.toFixed(2), y: +y.toFixed(2), mode: P.mode, v: +P.speed.toFixed(1) });
        const c = g.camera.position; if (Number.isFinite(c.x) && c.y < 6 && y < 2 && I.inside(c.x, c.z)) S.insideCam++;
        if (c.y < y + 0.2) I.add('camera dưới chân nhân vật', { cy: c.y, y });
        if (!(g.cam.cur >= 0.05)) I.add('cam.cur < 0,05', { cur: g.cam.cur });
        if (g.cam.close < 0.3) S.camNear++;
      }
      if (f % 30 === 0) {
        for (const a of g.traffic.agents) { if (a.x > 1e8) continue; if (!(Number.isFinite(a.x) && Number.isFinite(a.z) && Number.isFinite(a.v) && Number.isFinite(a.yaw) && Number.isFinite(a.lat))) { I.add('xe có toạ độ hỏng', { type: a.type, x: a.x, z: a.z, v: a.v, yaw: a.yaw }); break; } if (a.v < -0.01 || a.v > 30) { I.add('xe có vận tốc phi lý', { type: a.type, v: a.v }); break; } }
        const m = g.passport.money; if (!Number.isFinite(m) || m < 0) I.add('tiền hỏng', { m });
        if (!(g.sky.hours >= 0 && g.sky.hours <= 24) || !Number.isFinite(g.sky.exposure)) I.add('giờ / phơi sáng hỏng', { h: g.sky.hours, e: g.sky.exposure });
        const hud = document.getElementById('hud').innerText; if (/NaN|undefined|Infinity|\[object|null/.test(hud)) I.add('HUD có chữ hỏng', { text: (hud.match(/.{0,20}(NaN|undefined|Infinity|\[object|null).{0,20}/) || [''])[0] });
      }
    },
    // chạy n khung hình với dãy dt (ms) lặp vòng, kiểm bất biến sau mỗi khung
    run(n, dts) { const Q = window.__qa; for (let i = 0; i < n; i++) { Q.step(1, dts[i % dts.length]); I.frame(); } const g = window.__game, P = g.player; return { t: g.G.t, f: I.frames, x: P.pos.x, z: P.pos.z, y: P.y, v: P.speed, mode: P.mode, count: { ...I.count }, modal: g.hud.modal, warping: g.warping, fare: g.fares.state, stamps: g.passport.visited.size, pend: g.chunks.pending.size + g.chunks.want.length, miss: Number.isFinite(P.pos.x) ? g.chunks.missingNear(P.pos.x, P.pos.z, 150)[0] : -1 }; },
    // chờ (thời gian thật) cho các ô phố quanh người chơi / quanh điểm đi nhanh dựng xong, vừa chờ vừa cho game chạy từng khung
    async settle(max = 4000) { const g = window.__game, Q = window.__qa; let n = 0; for (; n < max; n++) { const P = g.player.pos; if (!g.warping && (!Number.isFinite(P.x) || g.chunks.missingNear(P.x, P.z, 150)[0] === 0)) break; await Q.sleep(4); if (g.warping) { I.expectJump = 3; Q.step(1); I.frame(); } } return n; },
  });
}
