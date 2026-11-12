// MỤC 3: SỐ HỌC BỀN. Chạy ngẫu nhiên có hạt giống 10 phút giờ game (đồng hồ ảo, không vẽ): phím thật ngẫu nhiên, chuột thật, lên
// xuống xe, đi nhanh tới các điểm hộ chiếu và các điểm ngẫu nhiên trên đường (kể cả cầu, mép bản đồ), đổi "chất lượng" không tải lại
// (độ phân giải động và các bậc của bộ điều tiết), đổi ngôn ngữ, đổi giờ, mở đóng các bảng, đổi cỡ cửa sổ, khung hình giật (dt lớn, dt ≈ 0).
// SAU MỖI KHUNG HÌNH kiểm (lib.mjs → __inv.frame): toạ độ, vận tốc, góc, cao độ của nhân vật và camera hữu hạn; nhân vật không dưới
// mặt đất, không dưới nước, không trong lòng nhà (đếm chẵn lẻ tia cắt các đoạn va chạm của game.nav), không ngoài bản đồ, không nhảy vị
// trí; xe trong dòng xe có toạ độ hữu hạn; HUD không có chữ NaN/undefined. Cuối cùng: không pageerror, không console.error.
// Dùng: node tools/qa/fuzz.mjs [hạt giống=1] [số phút giờ game=10]      Nhật ký hành động: <QA_OUT>/fuzz_<hạt giống>.log
import fs from 'node:fs';
import path from 'node:path';
import { launch, openGame, Report, invariantHelper, OUT, fx } from './lib.mjs';

const SEED = +(process.argv[2] || 1), MINUTES = +(process.argv[3] || 10);
const R = new Report(`fuzz_${SEED}`);
let a = SEED | 0; const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (l) => l[Math.floor(rnd() * l.length)], chance = (p) => rnd() < p;
const browser = await launch();
const { page, errors } = await openGame(browser, `q=low&fresh&lang=vi&h=${[7.5, 12, 17.5, 21, 3][SEED % 5]}`, { seed: SEED * 7919 + 1, init: invariantHelper, start: 'click' });
await page.evaluate(async () => { window.__norender = true; await window.__qa.virtual(); });
page.on('dialog', (d) => d.dismiss().catch(() => {}));

const targets = await page.evaluate(() => {
  const g = window.__game, W = g.world, out = { items: g.passport.items.map((it) => ({ id: it.id, s: it.s || [it.x, it.z], x: it.x, z: it.z })), roads: [], edge: [] };
  // điểm ngẫu nhiên trên tim đường xe chạy (rải đều theo danh sách đường), cầu nâng, và các điểm sát mép bản đồ
  const veh = W.roads.filter((r) => r.veh && r.len > 30 && !r.skip);
  for (let i = 0; i < veh.length; i += Math.ceil(veh.length / 160)) { const r = veh[i], k = (r.p.length >> 2) << 1; out.roads.push([r.p[k], r.p[k + 1], W.names[r.name] || '', !!r.elev]); }
  for (const r of W.roads) if (r.elev && r.veh && r.len > 80) { const k = (r.p.length >> 2) << 1; out.roads.push([r.p[k], r.p[k + 1], W.names[r.name] || '', true]); out.roads.push([r.p[0], r.p[1], (W.names[r.name] || '') + ' (đầu)', true]); }
  const b = W.bounds; for (const r of veh) { const x = r.p[0], z = r.p[1]; if (x < b.x0 + 40 || x > b.x1 - 40 || z < b.z0 + 40 || z > b.z1 - 40) out.edge.push([x, z, W.names[r.name] || '', false]); }
  return out;
});
R.note(`hạt giống ${SEED}; ${targets.items.length} điểm hộ chiếu, ${targets.roads.length} điểm trên đường (có cầu), ${targets.edge.length} điểm sát mép bản đồ`);

const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'Space'];
const held = new Set(); let mouseDown = false, mx = 480, my = 270, vp = [960, 540];
const log = [], logFile = path.join(OUT, `fuzz_${SEED}.log`);
const DT = () => { const r = rnd(); return r < 0.78 ? [1000 / 60] : r < 0.86 ? [1000 / 30] : r < 0.9 ? [1000 / 120] : r < 0.93 ? [50 + rnd() * 60] : r < 0.955 ? [250 + rnd() * 750] : r < 0.965 ? [5000] : r < 0.975 ? [0.01] : r < 0.98 ? [0] : [4 + rnd() * 36, 4 + rnd() * 36, 4 + rnd() * 36, 16.7, 90]; };

async function act() {
  const r = rnd(), st = await page.evaluate(() => { const g = window.__game; return { modal: g.hud.modal, mode: g.player.mode, fare: g.fares.state, prompt: !!g.fares.prompt, photo: g.G.photo }; });
  if (st.modal && chance(0.6)) { // bảng đang mở: phần lớn là đóng lại; đôi khi bấm các nút trong bảng
    if (st.modal === 'settings' && chance(0.5)) { const sel = pick(['#s-sound button[data-v="0"]', '#s-sound button[data-v="1"]', '#s-music button[data-v="0"]', '#s-music button[data-v="1"]', '#s-lang button[data-l="en"]', '#s-lang button[data-l="vi"]']); await page.click(sel).catch(() => {}); return `bấm ${sel}`; }
    if (st.modal === 'book' && chance(0.08)) { await page.click('#k-reset').catch(() => {}); return 'bấm Xoá dấu, chơi lại'; }
    const how = pick(['Escape', 'x', 'key']); if (how === 'x') await page.click(`#${st.modal} [data-close]`).catch(() => {}); else await page.keyboard.press(how === 'key' && st.modal === 'map' ? 'KeyM' : how === 'key' && st.modal === 'book' ? 'KeyB' : 'Escape'); return `đóng bảng ${st.modal} (${how})`;
  }
  if (r < 0.45) { // đổi tổ hợp phím di chuyển
    const k = pick(MOVE); if (held.has(k)) { await page.keyboard.up(k); held.delete(k); return `nhả ${k}`; }
    if (held.size >= 4) { const u = pick([...held]); await page.keyboard.up(u); held.delete(u); } await page.keyboard.down(k); held.add(k); return `nhấn ${k}`;
  }
  if (r < 0.53) { // chuột: kéo nhìn quanh, cuộn
    if (chance(0.25)) { await page.mouse.wheel(0, pick([-120, 120, 360, -360])); return 'cuộn chuột'; }
    if (!mouseDown) { mx = vp[0] / 2; my = vp[1] / 2; await page.mouse.move(mx, my); await page.mouse.down(); mouseDown = true; }
    const n = 1 + Math.floor(rnd() * 4); for (let i = 0; i < n; i++) { mx = Math.max(5, Math.min(vp[0] - 5, mx + (rnd() - 0.5) * 500)); my = Math.max(5, Math.min(vp[1] - 5, my + (rnd() - 0.5) * 240)); await page.mouse.move(mx, my); }
    if (chance(0.4)) { await page.mouse.up(); mouseDown = false; } return `kéo chuột tới ${mx | 0},${my | 0}`;
  }
  if (r < 0.59) { await page.evaluate(() => { window.__inv.expectJump = 3; }); await page.keyboard.press('KeyF'); return 'F (lên/xuống xe)'; } // lên xe: nhân vật được đưa tới chỗ xe dựng (trong 4 m)
  if (r < 0.71) { // chạy một mạch: giữ W (đôi khi thêm Shift) 5 đến 15 giây, thỉnh thoảng bẻ lái
    for (const k of [...held]) { await page.keyboard.up(k); held.delete(k); }
    const keys = chance(0.6) ? ['KeyW', 'ShiftLeft'] : ['KeyW']; for (const k of keys) await page.keyboard.down(k);
    const n = 5 + Math.floor(rnd() * 12); let out = null;
    for (let i = 0; i < n; i++) { const st = chance(0.35) ? pick(['KeyA', 'KeyD']) : null; if (st) await page.keyboard.down(st); out = await page.evaluate(async ([f]) => { const I = window.__inv; const q = I.run(f, [1000 / 60]); await I.settle(); return q; }, [20 + Math.floor(rnd() * 40)]); if (st) await page.keyboard.up(st); }
    for (const k of keys) await page.keyboard.up(k); return `chạy một mạch ${keys.join('+')} ${n} nhịp, tới v ${fx(out.v, 1)} m/s`;
  }
  if (r < 0.77) { // đi nhanh: điểm hộ chiếu (như bấm trên bản đồ), điểm trên đường, cầu, mép bản đồ
    if (st.fare === 'ride' && chance(0.7)) return 'bỏ qua đi nhanh (đang chở khách)';
    const q = rnd(), t = q < 0.5 ? (() => { const it = pick(targets.items); return [it.s[0], it.s[1], Math.atan2(it.x - it.s[0], it.z - it.s[1]), 'hộ chiếu ' + it.id]; })() : (() => { const p = pick(q < 0.9 || !targets.edge.length ? targets.roads : targets.edge); return [p[0], p[1], rnd() * 6.28, 'đường ' + p[2] + (p[3] ? ' [cầu]' : '')]; })();
    await page.evaluate(([x, z, yaw]) => { window.__inv.expectJump = 3; window.__game.warp(x, z, yaw); }, t); return `đi nhanh tới ${t[3]} (${fx(t[0], 1)}, ${fx(t[1], 1)})`;
  }
  if (r < 0.82) { await page.keyboard.press('KeyE'); return 'E'; }
  if (r < 0.87) { const k = pick(['KeyM', 'KeyB', 'set', 'KeyM', 'KeyB']); if (k === 'set') await page.click('#b-set').catch(() => {}); else await page.keyboard.press(k); return `mở bảng ${k}`; }
  if (r < 0.9) { await page.keyboard.press('KeyL'); return 'L (đổi ngôn ngữ)'; }
  if (r < 0.93) { await page.keyboard.press('KeyN'); return 'N (đổi giờ)'; }
  if (r < 0.95) { await page.keyboard.press(pick(['KeyH', 'KeyP', 'Escape', 'Tab', 'KeyC', 'KeyR', 'KeyV', 'KeyG', 'Enter'])); return 'phím phụ'; }
  if (r < 0.975) { // "đổi chất lượng không tải lại": độ phân giải động và các bậc của bộ điều tiết (bớt xe, bớt người, thu vùng chi tiết)
    const k = [1, 0.8, 0.62, 0.5, 0.4][Math.floor(rnd() * 5)], dpr = 0.6 + rnd() * 0.6;
    await page.evaluate(([k, dpr]) => { const g = window.__game, q = g.chunks.q; g.__base = g.__base || { near: q.near, bikes: g.traffic.maxBikes, cars: g.traffic.maxCars, crowd: g.crowd.max }; const b = g.__base; q.near = b.near * (k < 1 ? 0.8 : 1) * (k <= 0.5 ? 0.8 : 1); g.traffic.maxBikes = Math.round(b.bikes * k); g.traffic.maxCars = Math.round(b.cars * k); g.crowd.max = Math.max(6, Math.round(b.crowd * k)); g.R.setDpr(dpr); g.chunks.update(g.chunks.last.x, g.chunks.last.z, true); }, [k, dpr]); return `bậc chất lượng ×${k}, dpr ${fx(dpr)}`;
  }
  // đổi cỡ cửa sổ (xoay điện thoại, kéo cửa sổ)
  vp = pick([[960, 540], [1366, 768], [844, 390], [390, 844], [1140, 670], [320, 480]]); if (mouseDown) { await page.mouse.up(); mouseDown = false; } await page.setViewportSize({ width: vp[0], height: vp[1] }); return `cỡ cửa sổ ${vp.join('×')}`;
}

const GOAL = MINUTES * 60; let t0 = null, last = null, steps = 0, firstViol = {}, prevCount = {};
const T = { act: 0, run: 0, wait: 0 };
const cover = { warps: 0, mounts: 0, modals: 0 };
while (true) {
  let tA = Date.now(); const what = await act(); steps++; T.act += Date.now() - tA; tA = Date.now();
  if (/đi nhanh tới/.test(what)) cover.warps++; if (/^F/.test(what)) cover.mounts++; if (/mở bảng/.test(what)) cover.modals++;
  const frames = 5 + Math.floor(rnd() * 55), dts = DT();
  const res = await page.evaluate(async ([n, dts]) => { const I = window.__inv, Q = window.__qa, a = Q.realNow(); const r = I.run(n, dts); const b = Q.realNow(); const w = await I.settle(); return { ...r, w, runMs: b - a, waitMs: Q.realNow() - b }; }, [frames, dts]);
  T.run += res.runMs; T.wait += res.waitMs;
  if (t0 === null) t0 = res.t - 0; last = res;
  const line = `${String(steps).padStart(5)} t=${fx(res.t, 1)} ${what} | ${frames} khung dt=${dts.map((d) => fx(d, 1)).join('/')} → (${fx(res.x, 1)}, ${fx(res.z, 1)}, y ${fx(res.y)}) v ${fx(res.v, 1)} ${res.mode}${res.modal ? ' [' + res.modal + ']' : ''}${res.fare !== 'idle' ? ' <' + res.fare + '>' : ''}`;
  log.push(line);
  for (const [k, n] of Object.entries(res.count)) if (n !== (prevCount[k] || 0)) { if (!firstViol[k]) { firstViol[k] = { step: steps, line }; console.log(`   ! vi phạm đầu tiên "${k}" ở bước ${steps}: ${line}`); } }
  prevCount = res.count;
  if (errors.length && !firstViol.__err) { firstViol.__err = { step: steps, line }; console.log(`   ! lỗi trang đầu tiên ở bước ${steps}: ${errors[0].slice(0, 300)} :: ${line}`); }
  if (res.t >= GOAL || steps > 40000) break;
  if (steps % 250 === 0) console.log(`   … bước ${steps}, ${fx(res.t, 0)} giây giờ game, vị trí (${fx(res.x, 0)}, ${fx(res.z, 0)}), ${res.stamps} dấu`);
}
for (const k of held) await page.keyboard.up(k);
if (mouseDown) await page.mouse.up();
fs.writeFileSync(logFile, log.join('\n'));
const fin = await page.evaluate(() => { const I = window.__inv, g = window.__game; return { viol: I.viol, count: I.count, stat: I.stat, frames: I.frames, t: g.G.t, stamps: g.passport.visited.size, rides: g.passport.rides, money: g.passport.money, agents: g.traffic.agents.length, chunks: g.chunks.loaded.size, keys: [...g.input.keys] }; });

R.note(`độ phủ: ${fin.frames} khung hình, ${fx(fin.t, 0)} giây giờ game, ${steps} hành động; đi bộ ${fx(fin.stat.walk, 0)} m, đi xe ${fx(fin.stat.ride, 0)} m, vận tốc lớn nhất ${fx(fin.stat.maxV, 1)} m/s, cao độ ${fx(fin.stat.minY)}…${fx(fin.stat.maxY)} m (${fin.stat.deck} khung trên cầu), ${cover.warps} lần đi nhanh, ${cover.mounts} lần bấm F, ${cover.modals} lần mở bảng, ${fin.stamps} dấu, ${fin.rides} cuốc xe; camera áp sát đầu ${fin.stat.camNear} lần đo, camera nằm trong khối nhà ${fin.stat.insideCam} lần đo`);
R.check('độ phủ đủ: ≥ 10 phút giờ game (hoặc số phút yêu cầu), có đi bộ, có đi xe, có lên cầu, có đi nhanh', fin.t >= GOAL && fin.stat.walk > 100 && fin.stat.ride > 300 && cover.warps > 10, `${fx(fin.t, 0)} giây, đi bộ ${fx(fin.stat.walk, 0)} m, đi xe ${fx(fin.stat.ride, 0)} m, ${cover.warps} lần đi nhanh, ${fin.stat.deck} khung trên cầu`);
const KINDS = ['không hữu hạn', 'ngoài bản đồ', 'dưới mặt đất', 'chìm dưới mặt đường', 'lơ lửng trên không', 'đứng dưới nước', 'trong lòng nhà', 'nhảy vị trí', 'vận tốc phi lý', 'camera dưới chân nhân vật', 'cam.cur < 0,05', 'xe có toạ độ hỏng', 'xe có vận tốc phi lý', 'tiền hỏng', 'giờ / phơi sáng hỏng', 'HUD có chữ hỏng'];
for (const k of KINDS) { const n = fin.count[k] || 0; R.check(`bất biến: ${k}`, n === 0, n ? `${n} khung vi phạm; đầu tiên ở bước ${firstViol[k]?.step}: ${JSON.stringify(fin.viol[k].slice(0, 3))}` : ''); }
for (const k of Object.keys(fin.count)) if (!KINDS.includes(k)) R.check(`bất biến: ${k}`, false, JSON.stringify(fin.viol[k].slice(0, 3)));
R.check('không có pageerror / console.error / tài nguyên lỗi', errors.length === 0, `${errors.length} lỗi; ${errors.slice(0, 4).join(' | ')}`);
R.note('nhật ký hành động: ' + logFile);
R.note(`thời gian thật: hành động ${fx(T.act / 1000, 0)} giây, chạy khung hình ${fx(T.run / 1000, 0)} giây, chờ dựng ô phố ${fx(T.wait / 1000, 0)} giây`);
fs.writeFileSync(path.join(OUT, `fuzz_${SEED}_viol.json`), JSON.stringify({ seed: SEED, fin, firstViol, errors }, null, 1));
await browser.close();
process.exit(R.finish());
