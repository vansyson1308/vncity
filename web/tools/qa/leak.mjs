// MỤC 9: RÒ RỈ VÀ SỨC BỀN
//   r1) đi nhanh qua 30 nơi rồi quay lại nơi đầu: số geometry, texture (renderer.info.memory), số nút cảnh (scene.traverse), số chương trình
//       shader và số đoạn va chạm không tăng quá 15% so với lần đầu đứng ở đó. Lặp hai vòng (vòng 2 so với vòng 1 để loại phần "khởi động").
//   r2) chạy xe 5 phút giờ game dọc một tuyến dài (nối các đoạn đường xe chạy được theo đồ thị đường, đi thẳng qua các nút), lái bằng
//       phím thật: không lỗi, không vi phạm bất biến (lib.mjs → __inv), đi được quãng đường đáng kể, bộ nhớ không phình.
// Phần r1 phải vẽ thật ít nhất một khung ở mỗi nơi (geometry và texture chỉ được nạp lên GPU khi vẽ), nên chạy ở khung 320×180.
// Dùng: node tools/qa/leak.mjs [r1] [r2]
import { launch, openGame, Report, invariantHelper, fx } from './lib.mjs';

const want = (k) => process.argv.length <= 2 || process.argv.slice(2).includes(k);
const R = new Report('leak');
const browser = await launch();
const { page, errors } = await openGame(browser, 'q=low&fresh&lang=vi&h=12', { viewport: { width: 320, height: 180 }, init: invariantHelper, norender: true });
await page.evaluate(async () => {
  window.__norender = true; await window.__qa.virtual(); window.__qa.step(5);
  const g = window.__game, Q = window.__qa;
  window.__lk = {
    // chờ tới khi mọi ô phố trong tầm nhìn dựng xong (tối đa chừng 10 giây thật mỗi nơi; quá thì ghi nhận và đi tiếp), rồi vẽ thật 2 khung hình
    slow: 0, stuckDetail: 0,
    async go(x, z) { g.warp(x, z, 0); let i = 0; const done = () => !g.warping && g.chunks.missingNear(x, z, 300)[0] === 0 && g.chunks.pending.size === 0 && g.chunks.want.length === 0 && ![...g.chunks.loaded.values()].some((c) => c.detailPending); for (; i < 2500; i++) { Q.step(1); if (done()) break; await Q.sleep(4); }
      if (i >= 2500) { this.slow++; if ([...g.chunks.loaded.values()].some((c) => c.detailPending)) this.stuckDetail++; }
      Q.step(60); window.__norender = false; Q.step(2); window.__norender = true; Q.step(2); },
    stat() { let nodes = 0, meshes = 0; g.scene.traverse((o) => { nodes++; if (o.isMesh) meshes++; }); let segs = 0; for (const [, c] of g.nav.chunks) segs += c.segs.length / 5; const m = g.R.r.info.memory; return { geo: m.geometries, tex: m.textures, nodes, meshes, programs: g.R.r.info.programs.length, chunks: g.chunks.loaded.size, navChunks: g.nav.chunks.size, segs, agents: g.traffic.agents.length, people: g.crowd.people.length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }; },
  };
});

if (want('r1')) {
  const tour = await page.evaluate(() => { const g = window.__game, its = g.passport.items; const out = []; for (let i = 0; i < 30; i++) { const it = its[(i * 7 + 3) % its.length]; out.push([(it.s || [it.x, it.z])[0], (it.s || [it.x, it.z])[1], it.id]); } return out; });
  // Cách đo: mỗi lần đo ở nơi đầu đều tới từ cùng một nơi xa (cách 2 km, ngoài vùng giữ ô của nơi đầu). Ô phố đã nạp chỉ bị gỡ khi cách
  // người chơi quá tầm nhìn + 1,7 ô (vùng đệm, để đi tới đi lui không nạp lại), nên về từ một nơi gần thì các ô của nơi đó nằm trong
  // vùng đệm vẫn còn: tester vòng 5 đo "ô phố 38 → 44, đoạn va chạm +40%" sau khi về từ phố Bát Đàn cách 782 m, đúng bằng 6 ô của Bát
  // Đàn nằm trong vùng đệm của nơi đầu (về từ cầu Chương Dương cách 1,3 km thì 0). Lần đo đầu cũng sau một lượt đi xa rồi về: số geometry
  // trên GPU còn tuỳ bản gần, bản xa của từng ô đã từng được vẽ chưa (xem r3), lần đầu vào game chưa vẽ bản nào nên thấp hơn hẳn.
  const home = [114, -212], far = [-1700, -880], back = async () => { await page.evaluate(([x, z]) => window.__lk.go(x, z), far); await page.evaluate(([x, z]) => window.__lk.go(x, z), home); };
  const s = [];
  await page.evaluate(([x, z]) => window.__lk.go(x, z), home); await back(); s.push(await page.evaluate(() => window.__lk.stat()));
  for (let round = 1; round <= 2; round++) {
    let peak = { geo: 0, tex: 0, nodes: 0 };
    // vòng hai ngắn hơn (12 nơi): chỉ để xem có tăng tiếp không
    let nth = 0; for (const [x, z] of (round === 1 ? tour : tour.slice(0, 12))) { await page.evaluate(([x, z]) => window.__lk.go(x, z), [x, z]); const q = await page.evaluate(() => window.__lk.stat()); for (const k of Object.keys(peak)) if (q[k] > peak[k]) peak[k] = q[k]; if (++nth % 10 === 0) console.log(`   … vòng ${round}: ${nth} nơi, geometry ${q.geo}, texture ${q.tex}, nút cảnh ${q.nodes}`); }
    await back(); const q = await page.evaluate(() => window.__lk.stat()); q.peak = peak; s.push(q);
    console.log(`   vòng ${round}: về nơi đầu ${JSON.stringify(q)}`);
  }
  console.log('   lần đầu: ' + JSON.stringify(s[0]));
  const KEYS = ['geo', 'tex', 'nodes', 'meshes', 'programs', 'segs'];
  const grow = (a, b) => KEYS.map((k) => ({ k, a: a[k], b: b[k], pct: a[k] ? ((b[k] - a[k]) / a[k]) * 100 : 0 }));
  const g1 = grow(s[0], s[1]), g2 = grow(s[1], s[2]);
  R.check('r1: sau 30 lần đi nhanh rồi về nơi đầu: geometry, texture, nút cảnh, lưới, shader, đoạn va chạm không tăng quá 15% so với lần đầu', g1.every((q) => q.pct <= 15), g1.map((q) => `${q.k} ${q.a}→${q.b} (${q.pct >= 0 ? '+' : ''}${fx(q.pct, 1)}%)`).join(', '));
  R.check('r1: vòng thứ hai (thêm 12 lần đi nhanh): không tăng quá 5% so với vòng một (không rò rỉ tích luỹ)', g2.every((q) => q.pct <= 5), g2.map((q) => `${q.k} ${q.a}→${q.b} (${q.pct >= 0 ? '+' : ''}${fx(q.pct, 1)}%)`).join(', ') + `; heap JS ${s[0].heap}→${s[1].heap}→${s[2].heap} MB`);
  const lk = await page.evaluate(() => ({ slow: window.__lk.slow, stuck: window.__lk.stuckDetail })); R.note(`r1: ${lk.slow}/44 lần đi nhanh chưa dựng xong mọi ô trong 10 giây thật (trong đó ${lk.stuck} lần còn ô chờ lưới chi tiết)`);
  R.check('r1: số ô phố đang nạp và số ô va chạm về đúng như lần đầu (ô đã xa được gỡ)', Math.abs(s[2].chunks - s[0].chunks) <= 2 && s[2].navChunks <= s[0].navChunks + 2, `ô phố ${s[0].chunks}→${s[1].chunks}→${s[2].chunks}, ô va chạm ${s[0].navChunks}→${s[2].navChunks}`);
}

// r3) (giải thích cho r1) đi lại 6 lần giữa nơi đầu và một nơi xa: số geometry ở nơi đầu có tăng MÃI không. Số geometry trên GPU phụ thuộc
// cả vào việc bản xa/bản gần của từng ô đã từng được vẽ hay chưa, nên lần quay về đầu tiên có thể cao hơn lần đầu mà không phải rò rỉ;
// rò rỉ thật thì mỗi vòng lại tăng thêm.
if (want('r3')) {
  const home = [114, -212], far = [-1700, -880], seq = [];
  await page.evaluate(([x, z]) => window.__lk.go(x, z), home); seq.push(await page.evaluate(() => window.__lk.stat()));
  for (let k = 0; k < 6; k++) { await page.evaluate(([x, z]) => window.__lk.go(x, z), far); await page.evaluate(([x, z]) => window.__lk.go(x, z), home); seq.push(await page.evaluate(() => window.__lk.stat())); console.log(`   … lượt ${k + 1}: geometry ${seq[seq.length - 1].geo}, texture ${seq[seq.length - 1].tex}, nút cảnh ${seq[seq.length - 1].nodes}, ô phố ${seq[seq.length - 1].chunks}, heap ${seq[seq.length - 1].heap} MB`); }
  const g = seq.map((q) => q.geo), n = seq.map((q) => q.nodes), late = Math.max(...g.slice(3)) - g[2];
  R.check('r3: đi lại 6 lần giữa nơi đầu và một nơi cách 2 km: số geometry, texture, nút cảnh ở nơi đầu không tăng mãi (ba lượt cuối không cao hơn lượt thứ hai quá 5%)', Math.max(...g.slice(3)) <= g[2] * 1.05 + 2 && Math.max(...n.slice(3)) <= n[2] * 1.05 + 2 && seq[6].tex <= seq[2].tex + 1, `geometry ${g.join(' → ')}; nút cảnh ${n.join(' → ')}; texture ${seq.map((q) => q.tex).join(' → ')}; ô phố ${seq.map((q) => q.chunks).join(' → ')}; heap ${seq.map((q) => q.heap).join(' → ')} MB; tăng sau lượt 2: ${late}`);
}

if (want('r2')) {
  // tuyến dài: bắt đầu từ đoạn thẳng dài nhất của Đường Trần Quang Khải, tại mỗi nút chọn đoạn kế tiếp lệch hướng ít nhất (không quay
  // đầu), bỏ cầu và đường hẹp dưới 5 m. Đặt 3 giờ sáng (ít xe) để phép thử đo sức bền của việc chạy xe chứ không đo kẹt xe (kẹt xe đã có
  // traffic.mjs); xe tự lái của bài thử chỉ biết bẻ lái về mốc kế tiếp, không biết luồn qua nút giao đang kẹt.
  await page.evaluate(() => { window.__game.sky.setHours(3); });
  const route = await page.evaluate(() => { const g = window.__game, W = g.world, key = (x, z) => Math.round(x * 10) * 100003 + Math.round(z * 10); const at = new Map();
    const ok = (r) => r.veh && r.kind <= 3 && r.w >= 5 && !r.elev && !r.skip; for (const r of W.roads) if (ok(r)) for (const e of [0, 1]) { const i = e ? r.p.length - 2 : 0, k = key(r.p[i], r.p[i + 1]); let l = at.get(k); if (!l) at.set(k, (l = [])); l.push([r, e]); }
    let r = W.roads.filter((q) => W.names[q.name] === 'Đường Trần Quang Khải' && ok(q)).sort((a, b) => b.len - a.len)[0], e = 0; const pts = [], used = new Set(); let len = 0;
    for (let hop = 0; hop < 400 && len < 6000; hop++) { used.add(r.i); const p = r.p, n = p.length; const seq = []; for (let i = 0; i < n; i += 2) seq.push([p[i], p[i + 1]]); if (e) seq.reverse(); for (const q of seq) pts.push(q); len += r.len;
      const end = seq[seq.length - 1], prev = seq[seq.length - 2], tx = end[0] - prev[0], tz = end[1] - prev[1], tl = Math.hypot(tx, tz) || 1; let best = null, bd = -0.2;
      for (const [c, ce] of at.get(key(end[0], end[1])) || []) { if (c === r || used.has(c.i)) continue; const cp = c.p, i0 = ce ? cp.length - 2 : 0, i1 = ce ? cp.length - 4 : 2, dx = cp[i1] - cp[i0], dz = cp[i1 + 1] - cp[i0 + 1], dl = Math.hypot(dx, dz) || 1, dot = (dx * tx + dz * tz) / (dl * tl); if (dot > bd && !(g.player.noRide && g.player.noRide(cp[i1], cp[i1 + 1]))) { bd = dot; best = [c, ce]; } }
      if (!best) break; r = best[0]; e = best[1]; }
    // thưa bớt: mỗi 12 m một mốc
    const out = [pts[0]]; for (const q of pts) if (Math.hypot(q[0] - out[out.length - 1][0], q[1] - out[out.length - 1][1]) > 12) out.push(q); return { pts: out, len }; });
  R.note(`tuyến dài ${fx(route.len, 0)} m, ${route.pts.length} mốc, từ (${route.pts[0].map((v) => fx(v, 0))}) tới (${route.pts[route.pts.length - 1].map((v) => fx(v, 0))})`);
  await page.evaluate(([x, z]) => window.__lk.go(x, z), route.pts[0]);
  const m0 = await page.evaluate(() => window.__lk.stat());
  await page.evaluate(([a, b]) => { const g = window.__game, P = g.player; P.teleport(a[0], a[1], Math.atan2(b[0] - a[0], b[1] - a[1]), false); g.cam.snap(P); window.__inv.viol = {}; window.__inv.count = {}; window.__inv.last = null; window.__inv.stat.ride = 0; window.__inv.stat.walk = 0; window.__qa.step(5); }, [route.pts[0], route.pts[1]]);
  await page.evaluate(() => { window.__inv.expectJump = 3; }); await page.keyboard.press('KeyF'); await page.evaluate(() => window.__qa.step(70));
  const down = new Set(), set = async (k, on) => { if (on && !down.has(k)) { await page.keyboard.down(k); down.add(k); } else if (!on && down.has(k)) { await page.keyboard.up(k); down.delete(k); } };
  let i = 1, t = 0, stuck = 0, last = route.pts[0], maxV = 0, laps = 0, crashes = 0, unstick = 0, s = null;
  while (t < 300) {
    s = await page.evaluate(async ([tx, tz]) => { const I = window.__inv, r = I.run(12, [1000 / 60]), g = window.__game, P = g.player; if (r.miss > 0) await I.settle(); const want = Math.atan2(tx - P.pos.x, tz - P.pos.z), e = Math.atan2(Math.sin(want - P.yaw), Math.cos(want - P.yaw)); return { d: Math.hypot(tx - P.pos.x, tz - P.pos.z), e, v: P.speed, x: P.pos.x, z: P.pos.z, mode: P.mode, wob: P.wobble }; }, route.pts[i]); t += 0.2;
    if (Math.abs(s.v) > maxV) maxV = Math.abs(s.v); if (s.wob > 0.3) crashes++;
    if (s.d < 7) { i++; if (i >= route.pts.length) { i = 1; laps++; await page.evaluate(([a, b]) => { const g = window.__game, P = g.player; window.__inv.expectJump = 3; P.teleport(a[0], a[1], Math.atan2(b[0] - a[0], b[1] - a[1]), false); P.speed = 0; }, [route.pts[0], route.pts[1]]); } continue; }
    if (Math.hypot(s.x - last[0], s.z - last[1]) < 0.4) stuck += 0.2; else { stuck = 0; last = [s.x, s.z]; }
    // lái: A/D theo sai số hướng; ga W (mở hết ga trên đoạn thẳng); lệch quá thì giảm ga; kẹt 3 giây thì lùi (S) 1,5 giây rồi đi tiếp
    if (stuck > 3) { unstick++; await set('KeyW', false); await set('ShiftLeft', false); await set('KeyA', false); await set('KeyD', false); await page.keyboard.down('KeyS'); await page.evaluate(() => window.__inv.run(90, [1000 / 60])); await page.keyboard.up('KeyS'); t += 1.5; stuck = 0; if (unstick % 4 === 0) i = Math.min(route.pts.length - 1, i + 1); continue; }
    await set('KeyD', s.e < -0.1); await set('KeyA', s.e > 0.1);
    const fast = Math.abs(s.e) < 0.25; await set('KeyW', s.v < (fast ? 11 : 4)); await set('ShiftLeft', fast && s.v < 9);
  }
  for (const k of [...down]) await page.keyboard.up(k);
  const fin = await page.evaluate(() => { const I = window.__inv; window.__qa.step(30); return { count: I.count, viol: I.viol, ride: I.stat.ride, walk: I.stat.walk, stat: window.__lk.stat(), frames: I.frames }; });
  R.check('r2: chạy xe 5 phút giờ game dọc tuyến dài: đi được ≥ 1,2 km, đạt ≥ 30 km/h', fin.ride >= 1200 && maxV >= 8.3, `đi được ${fx(fin.ride, 0)} m, vận tốc lớn nhất ${fx(maxV * 3.6, 0)} km/h, tới mốc ${i}/${route.pts.length} (${laps} vòng), ${crashes} lần lảo đảo vì va chạm, ${unstick} lần phải lùi gỡ kẹt`);
  R.check('r2: suốt 5 phút không vi phạm bất biến nào (số hỏng, dưới đất, dưới nước, trong lòng nhà, nhảy vị trí, xe hỏng số, HUD hỏng chữ)', Object.keys(fin.count).length === 0, JSON.stringify(fin.count) + ' ' + JSON.stringify(Object.values(fin.viol).map((v) => v[0])).slice(0, 400));
  R.check('r2: sau 5 phút chạy xe bộ nhớ không phình (geometry, texture, nút cảnh ≤ 150% lúc xuất phát; ô phố ≤ 2 lần)', fin.stat.geo <= m0.geo * 1.5 + 20 && fin.stat.nodes <= m0.nodes * 1.5 + 20 && fin.stat.chunks <= m0.chunks * 2, `geometry ${m0.geo}→${fin.stat.geo}, texture ${m0.tex}→${fin.stat.tex}, nút cảnh ${m0.nodes}→${fin.stat.nodes}, ô phố ${m0.chunks}→${fin.stat.chunks}, heap ${m0.heap}→${fin.stat.heap} MB`);
}
R.check('không có pageerror / console.error', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close();
process.exit(R.finish());
