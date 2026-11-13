// MỤC 7: ĐỢT 3, LUẬT GIAO THÔNG VÀ THẾ GIỚI
//  (a) tại 9 nút có đèn: trong pha đỏ không xe nào vượt vạch dừng. Vị trí từng xe đo theo thời gian (toạ độ thật của xe trong dòng xe),
//      trạng thái đèn tính bằng chính hàm signalState của world/junctions.js với đồng hồ của shader vẽ đèn (traffic.clock = uTime);
//  (b) không xe nào đang chạy nằm trên vỉa hè hay trong lòng nhà;
//  (c) cầu Long Biên: chỉ xe máy, xe đạp, và xe đi bên trái; cầu Chương Dương: lòng giữa không có xe máy, hai làn ngoài không có ô tô;
//      người chơi (đi xe, đi bộ) không băng được giữa lòng giữa và làn xe máy xuyên qua dàn thép;
//  (d) không cặp xe nào chồng lên nhau quá 2 giây;
//  (e) tỉ lệ xe máy và taxi xanh ngọc theo tài liệu mỹ thuật (docs/18 mục 4): phố cổ xe máy 80–85%, ô tô 8–12%; phố Pháp, Ba Đình xe máy
//      70–75%, ô tô 20–25%; khoảng 6/10 taxi xanh ngọc lam;
//  (f) ô phố chi tiết quanh người chơi có lưới biển tên phố; tên đọc được từ lưới (giải mã uv) phải là tên một con phố ngay cạnh biển, và
//      ngã ba, ngã tư của hai phố khác tên phải có biển mang tên phố đó trong 30 m;
//  (g) không toà nhà nào cao quá 115 m; "Hàm Cá Mập" không còn.
// Mọi phần chạy đồng hồ ảo 60 khung hình/giây, không vẽ, mức chất lượng "medium" (mặc định của máy bàn: nhiều xe hơn mức thấp).
// Dùng: node tools/qa/traffic.mjs [sig] [bridge] [mix] [plates] [tall] [pass] [sweep]     (phần b, d đo trong lúc chạy sig và mix;
// tall, pass, sweep chạy trong Node, không cần trình duyệt)
import fs from 'node:fs';
import { launch, openGame, Report, invariantHelper, fx } from './lib.mjs';
import { decodeWorld, zoneAt, ZONE } from '../../src/world/data.js';
import { junctionsOf, signalState, SIGNAL } from '../../src/world/junctions.js';
import { plateLayout, isPlateName, isAlleyName } from '../../src/world/streetnames.js';

const want = (k) => process.argv.length <= 2 || process.argv.slice(2).includes(k);
const R = new Report('traffic');
const RAW = JSON.parse(fs.readFileSync(new URL('../../public/world/hanoi.json', import.meta.url), 'utf8'));
const world = decodeWorld(RAW, { withBuildings: true });

// ===== (g) chiều cao nhà và "Hàm Cá Mập": chạy bộ sinh của game trong Node trên toàn bản đồ =====
if (want('tall')) {
  const { buildContext } = await import('../../src/world/gen/context.js');
  const { resolveSites } = await import('../../src/world/landmarks/sites.js');
  const w2 = decodeWorld(RAW, { withBuildings: true }), ctx = buildContext(w2, resolveSites(w2));
  let max = null; const over = []; let n = 0;
  for (const b of w2.buildings) { if (b.skip && !b.ghost) continue; n++; const h = b.height; if (!(h <= 115)) over.push({ name: w2.names[b.name] || null, h, at: [fx(b.cx, 0), fx(b.cz, 0)], floors: b.floors }); if (!max || h > max.height) max = b; }
  R.check('g1: không toà nhà nào cao quá 115 m (chiều cao do bộ sinh của game gán cho từng nhà)', over.length === 0 && Number.isFinite(max.height), `${n} nhà được dựng; cao nhất ${fx(max.height, 1)} m: "${w2.names[max.name] || '(không tên)'}" tại (${fx(max.cx, 0)}, ${fx(max.cz, 0)}); vượt 115 m: ${JSON.stringify(over.slice(0, 5))}`);
  // "Hàm Cá Mập": toà nhà 1-3-5 Đinh Tiên Hoàng (đầu bắc Hồ Gươm) đã phá dỡ tháng 8/2025. Tìm trong dữ liệu bản đồ theo tên và theo vị trí.
  const named = w2.buildings.filter((b) => /hàm cá mập|ham ca map|shark/i.test(w2.names[b.name] || ''));
  const atSite = w2.buildings.filter((b) => Math.hypot(b.cx - -25, b.cz - -368) < 14 && b.area > 150);
  const solid = [...named, ...atSite].filter((b) => !(b.skip && !b.ghost) && b.height > 0.5);
  R.check('g2: "Hàm Cá Mập" không còn: nhà mang tên đó, hoặc khối nhà lớn tại vị trí cũ (−25, −368), không được dựng', solid.length === 0, `trong dữ liệu: ${named.length} nhà mang tên, ${atSite.length} khối lớn tại vị trí cũ (${atSite.map((b) => `${fx(b.area, 0)} m², skip=${b.skip}, cao ${fx(b.height, 1)}`).join('; ')}); còn dựng: ${solid.length}`);
  void ctx;
}

// ===== (b bổ sung) soát toàn bản đồ trong Node: đường xe chạy nào đi xuyên qua một khối nhà đang được dựng =====
if (want('pass')) {
  const { buildContext } = await import('../../src/world/gen/context.js');
  const { resolveSites } = await import('../../src/world/landmarks/sites.js');
  const { Nav } = await import('../../src/world/nav.js');
  const { roadY, CAT, F_PASSAGE } = await import('../../src/world/data.js');
  const w3 = decodeWorld(RAW, { withBuildings: true }); new Nav(w3); buildContext(w3, resolveSites(w3));
  const solid = w3.buildings.filter((b) => !(b.skip && !b.ghost) && b.cat !== CAT.roof && b.height > 2.5), grid = new Map();
  for (const b of solid) for (let cx = Math.floor(b.bb[0] / 32); cx <= Math.floor(b.bb[2] / 32); cx++) for (let cz = Math.floor(b.bb[1] / 32); cz <= Math.floor(b.bb[3] / 32); cz++) { const k = cx * 65537 + cz; let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(b); }
  const pin = (x, z, r) => { let inside = false; for (let i = 0, n = r.length, j = n - 2; i < n; j = i, i += 2) { const zi = r[i + 1], zj = r[j + 1]; if ((zi > z) !== (zj > z) && x < ((r[j] - r[i]) * (z - zi)) / (zj - zi) + r[i]) inside = !inside; } return inside; };
  const inB = (x, z) => { const l = grid.get(Math.floor(x / 32) * 65537 + Math.floor(z / 32)); if (l) for (const b of l) if (x >= b.bb[0] && x <= b.bb[2] && z >= b.bb[1] && z <= b.bb[3] && pin(x, z, b.p) && !b.holes.some((h) => pin(x, z, h))) return b; return null; };
  const hits = []; let total = 0, roadsN = 0, lenAll = 0;
  for (const r of w3.roads) { if (!r.veh || r.kind > 3 || r.skip || r.len < 4) continue; roadsN++; lenAll += r.len; let run = 0, first = null, bld = null;
    for (let s0 = 0; s0 <= r.len; s0 += 1) { let i = 0; while (i < r.cum.length - 2 && r.cum[i + 1] < s0) i++; const L = r.cum[i + 1] - r.cum[i] || 1, t = (s0 - r.cum[i]) / L, x = r.p[i * 2] + (r.p[i * 2 + 2] - r.p[i * 2]) * t, z = r.p[i * 2 + 1] + (r.p[i * 2 + 3] - r.p[i * 2 + 1]) * t; const b = r.elev && roadY(r, s0) > 0.5 ? null : inB(x, z); if (b) { if (!run) { first = [x, z]; bld = b; } run++; } if ((!b || s0 + 1 > r.len) && run) { if (run >= 2) { hits.push({ road: w3.names[r.name] || '(không tên)', kind: r.kind, w: r.w, at: [fx(first[0], 0), fx(first[1], 0)], dai: run, passage: !!(r.flags & F_PASSAGE), nha: w3.names[bld.name] || null, caoNha: fx(bld.height, 1) }); total += run; } run = 0; } } }
  hits.sort((a, b) => b.dai - a.dai);
  R.check('b4: (soát toàn bản đồ) không đoạn đường xe chạy nào có tim đường nằm trong một khối nhà đang được dựng (từ 2 m trở lên)', hits.length === 0, `${hits.length} đoạn trên ${roadsN} con đường mà dòng xe dùng, tổng ${total} m / ${fx(lenAll / 1000, 0)} km; trong đó ${hits.filter((h) => h.passage).length} đoạn được bản đồ đánh dấu là lối xuyên nhà; dài nhất: ${JSON.stringify(hits.slice(0, 6))}`);
}

// ===== (a bổ sung) quét MỌI nút có đèn bằng chính lớp mô phỏng dòng xe của game chạy trong Node (không trình duyệt) =====
if (want('sweep')) {
  const { Nav } = await import('../../src/world/nav.js');
  const { TrafficSim } = await import('../../src/actors/trafficsim.js');
  const w4 = decodeWorld(RAW, { withBuildings: false }), nav4 = new Nav(w4), J4 = junctionsOf(w4), sg4 = [...new Set(J4.signalNode.values())];
  const realRandom = Math.random; let sd = 20261112; Math.random = () => { sd = (sd + 0x6d2b79f5) | 0; let t = Math.imul(sd ^ (sd >>> 15), 1 | sd); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rows = [];
  for (const s of sg4) {
    let px = s.x + 14, pz = s.z + 14; find: for (let d = 10; d < 46; d += 3) for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.283 + 0.4, x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d; let ok = nav4.groundY(x, z) > 0.14; for (let q = 0; q < 8 && ok; q++) if (nav4.groundY(x + Math.cos(q * 0.785) * 2.5, z + Math.sin(q * 0.785) * 2.5) <= 0.14) ok = false; if (ok) { px = x; pz = z; break find; } }
    const sim = new TrafficSim(w4, { traffic: 100, cars: 9 }), player = { pos: { x: px, z: pz }, y: 0.16, yaw: 0, speed: 0, mode: 'walk', passenger: false, wobble: 0 };
    sim.prewarm(player, null, 17.5); const prev = new Map(); let n = 0, green = 0; const red = [];
    for (let f = 0; f < 60 * 132; f++) { sim.step(1 / 60, player, null, 17.5); if (f < 1200) continue; const t = sim.time;
      for (const a of sim.agents) { if (a.x > 1e8 || (a.x - s.x) ** 2 + (a.z - s.z) ** 2 > 6400) continue; const hx = Math.sin(a.yaw), hz = Math.cos(a.yaw); let k = -1, best = -0.85, d = 0;
        for (let q = 0; q < s.arms.length; q++) { const m = s.arms[q]; if (!m.inbound) continue; const rx = a.x - m.x, rz = a.z - m.z, dd = rx * m.dx + rz * m.dz, ll = rx * m.dz - rz * m.dx; if (dd < -3 || dd > 45 || Math.abs(ll) > m.w / 2 + 0.6) continue; const dot = hx * m.dx + hz * m.dz; if (dot < best) { best = dot; k = q; d = dd; } }
        // xe đang chạy trên chính một nhánh vào của nút (đoạn đường mang cột đèn): tính theo nhánh đó, kể cả khi thân xe lọt vào hành lang
        // của nhánh bên cạnh (làn rẽ tách khỏi Trần Quang Khải chạy sát lòng đường chính: xe lấn mép trái làn rẽ bị gán nhầm vào nhánh
        // chính đang đỏ trong khi đi theo đèn xanh của làn rẽ)
        if (k >= 0) { const own = s.arms.findIndex((m) => m.inbound && m.r === a.e.r); if (own >= 0 && own !== k) { const m = s.arms[own]; k = own; d = (a.x - m.x) * m.dx + (a.z - m.z) * m.dz; } }
        if (k < 0) continue; const m = s.arms[k], front = d - a.hl, key = a.id * 16 + k, st = signalState(t, m.grp, s.off), pv = prev.get(key), p = pv !== undefined && pv[1] === f - 1 && pv[0] - front < 1 ? pv[0] : undefined;
        // (vạch của chính nhánh, m.stop: xem phần a1)
        if (p !== undefined && p > m.stop - 1 && front <= m.stop - 1) { n++; if (st === 3) green++; if (st === 1) { let redFor = 0; while (redFor < 40 && signalState(t - redFor - 0.1, m.grp, s.off) === 1) redFor += 0.1; if (redFor > 1) red.push({ arm: w4.names[m.r.name] || '?', len: +m.r.len.toFixed(1), cls: a.cls, v: +a.v.toFixed(1), attached: a.sg !== null }); } }
        prev.set(key, [front, f]); } }
    rows.push({ names: [...new Set(s.arms.map((a) => w4.names[a.r.name] || '?'))].join(' × '), at: [fx(s.x, 0), fx(s.z, 0)], stop: s.stop, n, green, red, shortArms: s.arms.filter((a) => a.inbound && a.r.len < s.stop + 0.95 + 4).length });
  }
  Math.random = realRandom;
  const bad = rows.filter((r) => r.red.length > 0).sort((a, b) => b.red.length - a.red.length), tot = rows.reduce((a, r) => a + r.n, 0), totRed = rows.reduce((a, r) => a + r.red.length, 0), un = bad.flatMap((r) => r.red).filter((e) => !e.attached).length;
  R.check(`a3: (quét ${rows.length} nút có đèn bằng mô phỏng của game trong Node, 2 chu kỳ mỗi nút) không nút nào có xe vượt đèn đỏ`, bad.length === 0, `${bad.length}/${rows.length} nút có xe vượt đèn đỏ; ${totRed}/${tot} lượt qua vạch (${fx((totRed / Math.max(1, tot)) * 100, 1)}%); ${un}/${totRed} lượt là xe KHÔNG được gắn đèn (a.sg = null); nặng nhất: ${bad.slice(0, 8).map((r) => `${r.names.slice(0, 40)} (${r.at}) ${r.red.length}/${r.n} [${[...new Set(r.red.map((e) => `${e.arm} dài ${e.len} m`))].slice(0, 3).join('; ')}]`).join(' | ')}`);
  R.note(`a3: số nút có ít nhất một nhánh vào ngắn hơn (vạch dừng + 4,95 m): ${rows.filter((r) => r.shortArms > 0).length}/${rows.length}; trong số nút có xe vượt đèn đỏ: ${bad.filter((r) => r.shortArms > 0).length}/${bad.length}`);
}
if (!['sig', 'bridge', 'mix', 'plates'].some(want)) process.exit(R.finish());

// ----- dữ liệu nút có đèn (world/junctions.js, tính trong Node) -----
const J = junctionsOf(world), allSigs = [...new Set(J.signalNode.values())];
// 9 nút: bốn ngã tư đơn giản, ba nút phức tạp nhiều nhánh, và hai nút mà lượt quét trong Node (phần sweep) cho thấy tệ nhất,
// trong đó có nút Hàng Khay - Tràng Tiền - Đinh Tiên Hoàng ở đầu nam Hồ Gươm, nơi người chơi nào cũng đi qua
const PICK = [[-735, 431], [-819, 993], [459, 624], [-460, -1245], [449, -279], [-932, 52], [-1577, -1115], [109, 366], [-1412, -263]];
const sigs = PICK.map(([x, z]) => allSigs.reduce((p, q) => (Math.hypot(q.x - x, q.z - z) < Math.hypot(p.x - x, p.z - z) ? q : p))).map((s) => ({ x: s.x, z: s.z, off: s.off, stop: s.stop, names: [...new Set(s.arms.map((a) => world.names[a.r.name] || '?'))].join(' × '), zone: zoneAt(s.x, s.z),
  arms: s.arms.map((a) => ({ x: a.x, z: a.z, dx: a.dx, dz: a.dz, w: a.w, grp: a.grp, inbound: a.inbound, len: a.r.len, stop: a.stop, ri: a.r.i, name: world.names[a.r.name] || '?' })) }));

const browser = await launch();
const { page, errors } = await openGame(browser, 'q=medium&fresh&lang=vi&h=17.5', { init: invariantHelper, norender: true, seed: 20261112 });
await page.evaluate(async () => { window.__norender = true; await window.__qa.virtual(); window.__qa.step(5); });
const info = await page.evaluate(() => { const g = window.__game; return { sigNodes: g.traffic.sig.size, agents: g.traffic.agents.length, maxBikes: g.traffic.maxBikes, maxCars: g.traffic.maxCars, clock: g.traffic.clock, hours: g.sky.hours }; });
R.note(`game: ${info.agents} xe, trần ${info.maxBikes} xe máy + ${info.maxCars} ô tô (×1,2), ${info.sigNodes} nút mang đèn, ${fx(info.hours, 1)} giờ; Node: ${allSigs.length} nút giao có đèn`);
R.check('tiền đề: danh sách nút có đèn tính trong Node khớp với game đang chạy (cùng số nút mang đèn)', info.sigNodes === J.signalNode.size, `game ${info.sigNodes}, Node ${J.signalNode.size}`);

// ----- mã theo dõi chạy trong trang -----
await page.evaluate(([fnSrc, SIG]) => {
  const g = window.__game, T = g.traffic, nav = g.nav, I = window.__inv;
  const SIGNAL = SIG; void SIGNAL; const signalState = new Function('SIGNAL', `return (${fnSrc});`)(SIG);
  // nút đồ thị có từ ba nhánh trở lên (để tách "cắt góc ở nút giao" khỏi "chạy trên vỉa hè giữa phố")
  const nodes = []; for (const [, es] of T.nodes) if (es.length >= 3) { const e = es[0], k0 = e.n0; let x = e.p[0], z = e.p[1]; for (const q of es) { if (q !== e) { const same0 = Math.round(q.p[0] * 10) === Math.round(e.p[0] * 10) && Math.round(q.p[1] * 10) === Math.round(e.p[1] * 10), n = q.p.length, same1 = Math.round(q.p[n - 2] * 10) === Math.round(e.p[0] * 10) && Math.round(q.p[n - 1] * 10) === Math.round(e.p[1] * 10); if (!same0 && !same1) { x = e.p[e.p.length - 2]; z = e.p[e.p.length - 1]; } break; } } void k0; nodes.push([x, z]); }
  const nodeGrid = new Map(); for (const n of nodes) { const k = Math.floor(n[0] / 32) * 65537 + Math.floor(n[1] / 32); let l = nodeGrid.get(k); if (!l) nodeGrid.set(k, (l = [])); l.push(n); }
  const nearNode = (x, z) => { let best = 1e9; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const l = nodeGrid.get((Math.floor(x / 32) + i) * 65537 + Math.floor(z / 32) + j); if (l) for (const n of l) { const d = Math.hypot(n[0] - x, n[1] - z); if (d < best) best = d; } } return best; };
  const NAME = ['wave', 'scooter', 'cub', 'sedan', 'hatch', 'bus', 'bicycle', 'cyclo', 'ecart'];
  const X = (window.__tr = {
    signalState, sig: null, ev: [], prev: new Map(), q: { maxQueue: 0, redStopSamples: 0, inBox: new Map(), boxLong: [] },
    tot: { vehSecs: 0, movingSamples: 0 }, walk: new Map(), walkLong: [], walkSamples: 0, walkBad: 0, inside: [], insideAll: [], insideN: 0, insideChecked: 0, pairs: new Map(), overlapLong: [], overlapNow: 0,
    seen: new Map(), // id → { cls, type, taxi, teal, zone }
    // (a) mỗi khung hình: xe nào vừa đưa mũi qua vạch dừng của một nhánh vào nút, lúc đó đèn của nhánh là gì
    frameSig() {
      const s = X.sig; if (!s) return; const t = T.clock, A = T.agents; let queue = 0;
      for (const a of A) {
        if (a.x > 1e8) continue; const ddx = a.x - s.x, ddz = a.z - s.z; if (ddx * ddx + ddz * ddz > 80 * 80) continue;
        const hx = Math.sin(a.yaw), hz = Math.cos(a.yaw);
        // Xe thuộc nhánh nào: trong các nhánh vào nút mà xe nằm trong lòng đường của nhánh và đang chạy về phía nút, lấy nhánh có hướng
        // khớp với mũi xe nhất (hai nhánh chụm nhau một góc hẹp chồng lên nhau ở sát nút; phải lệch hướng dưới 32° mới tính).
        let k = -1, bestDot = -0.85, d = 0, lat = 0;
        for (let q = 0; q < s.arms.length; q++) { const m = s.arms[q]; if (!m.inbound) continue; const rx = a.x - m.x, rz = a.z - m.z, dd = rx * m.dx + rz * m.dz, ll = rx * m.dz - rz * m.dx; if (dd < -3 || dd > 45 || Math.abs(ll) > m.w / 2 + 0.6) continue; const dot = hx * m.dx + hz * m.dz; if (dot < bestDot) { bestDot = dot; k = q; d = dd; lat = ll; } }
        // xe đang chạy trên chính một nhánh vào của nút: tính theo nhánh đó (xem phần quét a3)
        if (k >= 0) { const own = s.arms.findIndex((m) => m.inbound && m.ri === a.e.r.i); if (own >= 0 && own !== k) { const m = s.arms[own], rx = a.x - m.x, rz = a.z - m.z; k = own; d = rx * m.dx + rz * m.dz; lat = rx * m.dz - rz * m.dx; } }
        if (k < 0) continue;
        {
          const m = s.arms[k];
          const front = d - a.hl, key = a.id * 16 + k, st = signalState(t, m.grp, s.off), pv = X.prev.get(key), prev = pv !== undefined && pv[1] === I.frames - 1 && pv[0] - front < 1 ? pv[0] : undefined; // chỉ so với khung hình liền trước, cùng nhánh
          if (st === 1 && a.v < 0.3 && front >= s.stop - 1 && front < s.stop + 30) queue++;
          // vạch dừng của chính nhánh này (chân cột đèn của nhánh, m.stop): nhánh có vạch sang đường dời xa nút (zebras.js) thì chân cột
          // đèn chung của nút (s.stop) nằm sâu trong lòng nút, xe vào lúc đèn vàng đi tới đó khi đèn đã đỏ hơn 1 giây bị đếm nhầm là vượt đỏ
          // (vòng 4: một lượt ở nhánh Nguyễn Thái Học của nút Cửa Nam, cột đèn nhánh ở 16,6 m, cột chung 10,6 m)
          if (prev !== undefined && prev > m.stop - 1 && front <= m.stop - 1) {
            // mũi xe vừa vượt quá vạch dừng 1 m. Đèn đã đỏ được bao lâu?
            let redFor = 0; if (st === 1) while (redFor < 40 && signalState(t - redFor - 0.1, m.grp, s.off) === 1) redFor += 0.1;
            X.ev.push({ j: s.names, arm: m.name, armLen: +m.len.toFixed(1), type: NAME[a.type], cls: a.cls, st, redFor: +redFor.toFixed(1), v: +a.v.toFixed(1), lat: +lat.toFixed(1), id: a.id, x: +a.x.toFixed(1), z: +a.z.toFixed(1), t: +t.toFixed(1) });
          }
          // đứng yên bên trong vạch (trên vạch sang đường hoặc trong lòng nút) khi đèn của nhánh mình đang đỏ
          if (st === 1 && a.v < 0.3 && front < s.stop - 1.5 && d > 0) { const n = (X.q.inBox.get(a.id) || 0) + 1; X.q.inBox.set(a.id, n); if (n === 300) X.q.boxLong.push({ j: s.names, arm: m.name, type: NAME[a.type], front: +front.toFixed(1), stop: +s.stop.toFixed(1), x: +a.x.toFixed(1), z: +a.z.toFixed(1) }); }
          X.prev.set(key, [front, I.frames]);
        }
      }
      if (queue > X.q.maxQueue) X.q.maxQueue = queue;
    },
    // (b)(d)(e) mỗi 6 khung hình (0,1 giây)
    sample(f, zone) {
      const A = T.agents, t = g.G.t, live = [];
      for (const a of A) { if (a.x > 1e8) continue; live.push(a); if (!X.seen.has(a.id)) X.seen.set(a.id, { cls: a.cls, type: a.type, taxi: !!a.taxi, teal: !!a.taxi && a.tint[0] < 0.05 && a.tint[1] > 0.4 && a.tint[2] > 0.35, zone }); }
      X.tot.vehSecs += live.length * 0.1;
      // vỉa hè: hai mép thân xe (tâm ± (nửa bề ngang − 5 cm) theo phương ngang xe) phải nằm trong lòng đường
      for (const a of live) {
        if (a.v < 0.5 || a.y > 0.3) { X.walk.delete(a.id); continue; }
        X.tot.movingSamples++; X.walkSamples++;
        const rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw), w = a.r - 0.05; let out = 0;
        for (const sg of [1, -1]) if (nav.groundY(a.x + rx * w * sg, a.z + rz * w * sg) > 0.14) out++;
        if (nav.groundY(a.x, a.z) > 0.14) out += 2;
        if (out) { X.walkBad++; const w0 = X.walk.get(a.id) || { n: 0, max: 0, centre: 0 }; w0.n++; if (out >= 2) w0.centre++; X.walk.set(a.id, w0);
          if (w0.n === 10) { const rd = nav.nearestRoad(a.x, a.z, 30, (r) => r.veh); X.walkLong.push({ type: NAME[a.type], x: +a.x.toFixed(1), z: +a.z.toFixed(1), v: +a.v.toFixed(1), road: rd ? g.world.names[rd.r.name] || '' : '', offCentre: rd ? +(rd.d - rd.r.w / 2).toFixed(2) : null, toNode: +nearNode(a.x, a.z).toFixed(0), tamTrenHe: w0.centre >= 5, id: a.id }); }
        } else X.walk.delete(a.id);
      }
      // trong lòng nhà: mỗi giây một lần
      if (f % 60 === 0) for (const a of live) { if (a.v < 0.5 || a.y > 2) continue; X.insideChecked++; if (I.inside(a.x, a.z)) { X.insideN++; if (X.insideAll.length < 3000) X.insideAll.push({ x: +a.x.toFixed(0), z: +a.z.toFixed(0), road: g.world.names[a.e.r.name] || '' }); if (X.inside.length < 12) X.inside.push({ type: NAME[a.type], x: +a.x.toFixed(1), z: +a.z.toFixed(1), v: +a.v.toFixed(1), road: g.world.names[a.e.r.name] || '' }); } }
      // chồng lên nhau: thân xe là hình viên thuốc (đoạn dài 2·(hl − r) dọc xe, bán kính r); chồng sâu = hai trục cách nhau dưới 60% tổng bán kính
      const now = new Set(); let on = 0;
      for (let i = 0; i < live.length; i++) { const a = live[i]; for (let j = i + 1; j < live.length; j++) { const b = live[j], dx = b.x - a.x, dz = b.z - a.z; if (dx * dx + dz * dz > 49 || Math.abs(a.y - b.y) > 2) continue;
        const la = Math.max(0, a.hl - a.r), lb = Math.max(0, b.hl - b.r), ax = Math.sin(a.yaw), az = Math.cos(a.yaw), bx = Math.sin(b.yaw), bz = Math.cos(b.yaw); let best = 1e9;
        for (let u = -1; u <= 1; u += 0.5) for (let v = -1; v <= 1; v += 0.5) { const d = Math.hypot(a.x + ax * la * u - b.x - bx * lb * v, a.z + az * la * u - b.z - bz * lb * v); if (d < best) best = d; }
        if (best < (a.r + b.r) * 0.6) { on++; const key = a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id; now.add(key); const p = X.pairs.get(key) || { t0: t, told: false }; X.pairs.set(key, p);
          if (!p.told && t - p.t0 > 2) { p.told = true; X.overlapLong.push({ a: NAME[a.type], b: NAME[b.type], d: +best.toFixed(2), need: +((a.r + b.r) * 0.6).toFixed(2), va: +a.v.toFixed(1), vb: +b.v.toFixed(1), x: +a.x.toFixed(1), z: +a.z.toFixed(1), road: g.world.names[a.e.r.name] || '', red: !!(a.red || b.red), toNode: +nearNode(a.x, a.z).toFixed(0), secs: +(t - p.t0).toFixed(1) }); } } } }
      for (const k of X.pairs.keys()) if (!now.has(k)) X.pairs.delete(k);
      X.overlapNow = on;
    },
    run(frames, zone) { const Q = window.__qa; for (let i = 0; i < frames; i++) { Q.step(1); I.frames++; X.frameSig(); if (I.frames % 6 === 0) X.sample(I.frames, zone); } },
    // đi nhanh và đứng trên vỉa hè (không chắn dòng xe) gần điểm (x,z)
    // đi nhanh tới gần (x,z) và đứng XA lòng đường (mọi điểm trong vòng 2,5 m quanh chỗ đứng đều là vỉa hè) để người quan sát không
    // chắn dòng xe: xe trong game né và chờ người đứng sát mép đường. Không tìm được chỗ như thế thì đứng trên vỉa hè gần nhất.
    async go(x, z) { const Q = window.__qa; g.warp(x, z, 0); for (let i = 0; i < 8000; i++) { Q.step(1); if (!g.warping && g.chunks.missingNear(x, z, 200)[0] === 0 && g.chunks.pending.size === 0) break; await Q.sleep(4); }
      const walk = (px, pz) => nav.groundY(px, pz) > 0.14 && !nav.isWater(px, pz) && !I.inside(px, pz, 0.5) && nav.clearAt(px, pz, 0.4);
      let spot = null, clear = 0; for (const need of [2.5, 1.2, 0]) { for (let d = 10; d < 46 && !spot; d += 3) for (let k = 0; k < 16 && !spot; k++) { const a = (k / 16) * 6.283 + 0.4, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (!walk(px, pz)) continue; let ok = true; for (let q = 0; q < 8 && ok; q++) if (need > 0 && nav.groundY(px + Math.cos(q * 0.785) * need, pz + Math.sin(q * 0.785) * need) <= 0.14) ok = false; if (ok) { spot = [px, pz]; clear = need; } } if (spot) break; }
      spot = spot || [x, z]; const P = g.player; P.teleport(spot[0], spot[1], 0, false); g.cam.snap(P); Q.step(5);
      return { pos: [P.pos.x, P.pos.z], clear, d: Math.hypot(P.pos.x - x, P.pos.z - z), maxSegH: (() => { let m = 0; for (const [, c] of nav.chunks) for (let i = 4; i < c.segs.length; i += 5) if (c.segs[i] > m) m = c.segs[i]; return m; })() }; },
  });
}, [signalState.toString(), SIGNAL]);

let maxSegH = 0;
// ===== (a) đèn đỏ =====
if (want('sig')) {
  const per = [];
  for (const s of sigs) {
    const at = await page.evaluate(([x, z]) => window.__tr.go(x, z), [s.x, s.z]); if (at.maxSegH > maxSegH) maxSegH = at.maxSegH;
    const r = await page.evaluate(async ([s, zone]) => { const X = window.__tr, Q = window.__qa; X.run(20 * 60, zone); await Q.yield(); X.sig = s; X.prev.clear(); const e0 = X.ev.length; X.q.maxQueue = 0; X.q.inBox.clear();
      const box = []; // số xe đứng yên trong lòng nút (cách tim nút dưới vạch dừng − 1,5 m), đo mỗi 8 giây
      for (let k = 0; k < 14; k++) { X.run(8 * 60, zone); let n = 0; for (const a of window.__game.traffic.agents) if (a.x < 1e8 && a.v < 0.3 && Math.hypot(a.x - s.x, a.z - s.z) < s.stop - 1.5) n++; box.push(n); await Q.yield(); } // 112 giây = 2 chu kỳ đèn
      X.sig = null; const ev = X.ev.slice(e0); return { n: ev.length, green: ev.filter((e) => e.st === 3).length, amber: ev.filter((e) => e.st === 2).length, redEarly: ev.filter((e) => e.st === 1 && e.redFor <= 1).length, red: ev.filter((e) => e.st === 1 && e.redFor > 1), maxQueue: X.q.maxQueue, agents: window.__game.traffic.agents.length, box }; }, [s, s.zone]);
    per.push({ nut: s.names, at: [fx(s.x, 0), fx(s.z, 0)], nguoiDungCachMepDuong: at.clear, nhanhVao: s.arms.filter((a) => a.inbound).length, vach: fx(s.stop, 1), quaVach: r.n, xanh: r.green, vang: r.amber, doDuoi1s: r.redEarly, DO: r.red.length, hangChoDaiNhat: r.maxQueue, dungYenTrongNut: r.box, viDu: r.red.slice(0, 3), theoNhanh: Object.entries(r.red.reduce((m, e) => { const k = `${e.arm} (dài ${e.armLen} m)`; m[k] = (m[k] || 0) + 1; return m; }, {})).map(([k, v]) => `${k}: ${v}`).join('; ') });
    console.log('   nút ' + JSON.stringify(per[per.length - 1]));
  }
  const tot = per.reduce((a, p) => ({ n: a.n + p.quaVach, red: a.red + p.DO, green: a.green + p.xanh }), { n: 0, red: 0, green: 0 });
  R.check('a0: phép đo có nghĩa: mỗi nút có ≥ 10 lượt xe qua vạch lúc đèn xanh và có xe xếp hàng chờ lúc đèn đỏ', per.every((p) => p.xanh >= 10 && p.hangChoDaiNhat >= 1), per.map((p) => `${p.nut.slice(0, 28)}: ${p.xanh} xanh, hàng chờ ${p.hangChoDaiNhat}`).join(' | '));
  R.check(`a1: tại ${per.length} nút có đèn, 2 chu kỳ mỗi nút: không xe nào đưa mũi quá vạch dừng 1 m khi đèn nhánh mình đã đỏ hơn 1 giây`, tot.red === 0, `${tot.red}/${tot.n} lượt qua vạch là vượt đèn đỏ (xanh ${tot.green}); theo nút: ${per.map((p) => `${p.nut.slice(0, 24)} ${p.DO}/${p.quaVach}${p.theoNhanh ? ' [' + p.theoNhanh + ']' : ''}`).join(' | ')}; ví dụ: ${JSON.stringify(per.flatMap((p) => p.viDu).slice(0, 5))}`);
  // kẹt cứng trong lòng nút: vài xe chờ rẽ trái là bình thường; hàng chục xe đứng im giữa nút là kẹt
  const jam = per.filter((p) => Math.max(...p.dungYenTrongNut) > 8);
  R.check('a4: lòng nút giao không bị kẹt cứng: ở mọi thời điểm đo (mỗi 8 giây) không quá 8 xe đứng yên bên trong vạch dừng', jam.length === 0, `${jam.length}/${per.length} nút bị kẹt; số xe đứng yên trong lòng nút theo thời gian: ${per.map((p) => `${p.nut.slice(0, 22)}: ${p.dungYenTrongNut.join(' ')}`).join(' | ')}`);
  const box = await page.evaluate(() => window.__tr.q.boxLong);
  R.check('a2: không xe nào đứng yên quá 5 giây bên trong vạch dừng (trên vạch sang đường hoặc trong lòng nút) khi đèn nhánh mình đỏ', box.length === 0, `${box.length} xe; ví dụ: ${JSON.stringify(box.slice(0, 4))}`);
}

// ===== (e) cơ cấu xe + thêm mẫu cho (b)(d) ở phố thường =====
const mixSpots = [['Phố Hàng Đào', ZONE.old, 'phố cổ'], ['Phố Hàng Gai', ZONE.old, 'phố cổ'], ['Phố Tràng Tiền', ZONE.french, 'phố Pháp'], ['Phố Lý Thường Kiệt', ZONE.french, 'phố Pháp'], ['Đường Điện Biên Phủ', ZONE.badinh, 'Ba Đình']];
if (want('mix')) {
  const res = [];
  for (const [name, zone, label] of mixSpots) {
    const rs = world.roads.filter((r) => world.names[r.name] === name && zoneAt(r.p[(r.p.length >> 2) << 1], r.p[((r.p.length >> 2) << 1) + 1]) === zone).sort((a, b) => b.len - a.len); if (!rs.length) { R.check(`e: tìm thấy ${name} trong khu ${label}`, false, 'không có trong dữ liệu'); continue; }
    const r = rs[0], k = (r.p.length >> 2) << 1;
    const at = await page.evaluate(([x, z]) => window.__tr.go(x, z), [r.p[k], r.p[k + 1]]); if (at.maxSegH > maxSegH) maxSegH = at.maxSegH;
    const m = await page.evaluate(async ([zone]) => { const X = window.__tr, Q = window.__qa, g = window.__game; X.run(25 * 60, -1); await Q.yield(); const ids = new Set(); const snap = [0, 0, 0, 0]; let n = 0;
      for (let k = 0; k < 90; k++) { X.run(60, zone); for (const a of g.traffic.agents) { if (a.x > 1e8) continue; snap[a.cls]++; n++; ids.add(a.id); } if (k % 10 === 0) await Q.yield(); }
      const u = [0, 0, 0, 0]; for (const id of ids) { const s = X.seen.get(id); if (s) u[s.cls]++; }
      return { zoneNow: g.traffic.zone, snapShare: snap.map((v) => v / n), uniq: u, uniqN: ids.size, avgAgents: n / 90 }; }, [zone]);
    res.push({ name, label, zone, ...m });
    console.log(`   cơ cấu ${name} (${label}): xe máy ${fx(m.snapShare[0] * 100, 1)}%, ô tô ${fx(m.snapShare[1] * 100, 1)}%, buýt ${fx(m.snapShare[2] * 100, 1)}%, xe chậm ${fx(m.snapShare[3] * 100, 1)}% (trung bình ${fx(m.avgAgents, 0)} xe, ${m.uniqN} xe khác nhau)`);
  }
  const agg = (label) => { const l = res.filter((r) => r.label === label), u = [0, 0, 0, 0]; let sn = [0, 0, 0, 0], w = 0; for (const r of l) { r.uniq.forEach((v, i) => { u[i] += v; }); r.snapShare.forEach((v, i) => { sn[i] += v * r.avgAgents; }); w += r.avgAgents; } return { share: sn.map((v) => v / w), n: u.reduce((a, b) => a + b, 0) }; };
  const old = agg('phố cổ'), fr = agg('phố Pháp'), bd = agg('Ba Đình'), pct = (v) => fx(v * 100, 1) + '%';
  // khoảng của tài liệu, nới 2 điểm phần trăm mỗi đầu cho sai số lấy mẫu
  R.check('e1: phố cổ: xe máy 80–85% (±2), ô tô kể cả taxi 8–12% (±2), xe đạp + xích lô + xe điện 4–6% (±2), buýt ≤ 1% (+1)', old.share[0] >= 0.78 && old.share[0] <= 0.87 && old.share[1] >= 0.06 && old.share[1] <= 0.14 && old.share[3] >= 0.02 && old.share[3] <= 0.08 && old.share[2] <= 0.02, `xe máy ${pct(old.share[0])}, ô tô ${pct(old.share[1])}, xe chậm ${pct(old.share[3])}, buýt ${pct(old.share[2])} (${old.n} xe khác nhau)`);
  R.check('e2: trục phố Pháp: xe máy 70–75% (±2), ô tô 20–25% (±2), buýt 1–2% (±1)', fr.share[0] >= 0.68 && fr.share[0] <= 0.77 && fr.share[1] >= 0.18 && fr.share[1] <= 0.27 && fr.share[2] <= 0.03, `xe máy ${pct(fr.share[0])}, ô tô ${pct(fr.share[1])}, xe chậm ${pct(fr.share[3])}, buýt ${pct(fr.share[2])} (${fr.n} xe khác nhau)`);
  R.check('e3: Ba Đình: xe máy 70–75% (±2), ô tô 20–25% (±2), buýt 1–2% (±1)', bd.share[0] >= 0.68 && bd.share[0] <= 0.77 && bd.share[1] >= 0.18 && bd.share[1] <= 0.27 && bd.share[2] <= 0.03, `xe máy ${pct(bd.share[0])}, ô tô ${pct(bd.share[1])}, xe chậm ${pct(bd.share[3])}, buýt ${pct(bd.share[2])} (${bd.n} xe khác nhau)`);
}
if (want('sig') || want('mix')) {
  const s = await page.evaluate(() => { const X = window.__tr; let taxi = 0, teal = 0, cars = 0, tealNonTaxi = 0; for (const v of X.seen.values()) { if (v.cls === 1) cars++; if (v.taxi) { taxi++; if (v.teal) teal++; } } const O = X.overlapLong, sum = { n: O.length, nut: O.filter((o) => o.toNode <= 14).length, giuaPho: O.filter((o) => o.toNode > 14).length, dungYen: O.filter((o) => o.va < 0.5 && o.vb < 0.5).length, coXeChay: O.filter((o) => o.va >= 0.5 || o.vb >= 0.5).length, choDen: O.filter((o) => o.red).length, trungTam: O.filter((o) => o.d < 0.25).length, coOTo: O.filter((o) => /sedan|hatch|bus/.test(o.a + o.b)).length }; const places = []; for (const q of X.insideAll) { const p = places.find((w) => Math.hypot(w.x - q.x, w.z - q.z) < 15); if (p) p.n++; else places.push({ x: q.x, z: q.z, road: q.road, n: 1 }); } return { taxi, teal, cars, tealNonTaxi, uniq: X.seen.size, vehSecs: X.tot.vehSecs, walkSamples: X.walkSamples, walkBad: X.walkBad, walkLong: X.walkLong, inside: X.inside, insidePlaces: places, insideN: X.insideN, insideChecked: X.insideChecked, overlapLong: O.slice(0, 40), ov: sum, ovMid: O.filter((o) => o.toNode > 14).slice(0, 5), ovMove: O.filter((o) => o.va >= 0.5 || o.vb >= 0.5).slice(0, 5) }; });
  const p = s.taxi ? s.teal / s.taxi : 0, sd = s.taxi ? Math.sqrt(0.61 * 0.39 / s.taxi) : 1;
  R.check('e4: khoảng 6/10 taxi sơn xanh ngọc lam (61% ± 3 độ lệch chuẩn của cỡ mẫu, và cần ≥ 40 taxi)', s.taxi >= 40 && Math.abs(p - 0.61) <= 3 * sd, `${s.teal}/${s.taxi} taxi xanh ngọc = ${fx(p * 100, 1)}% (cho phép ${fx((0.61 - 3 * sd) * 100, 0)}–${fx((0.61 + 3 * sd) * 100, 0)}%); ${s.cars} ô tô, ${s.uniq} xe khác nhau`);
  // (b)
  const mid = s.walkLong.filter((w) => w.toNode > 14), corner = s.walkLong.filter((w) => w.toNode <= 14);
  R.check('b1: không xe đang chạy nào có bánh trên vỉa hè liên tục từ 1 giây trở lên (ở giữa phố, cách nút giao trên 14 m)', mid.length === 0, `${mid.length} xe giữa phố (+ ${corner.length} xe ở góc nút giao); ${s.walkBad}/${s.walkSamples} mẫu xe-đang-chạy có mép thân trên vỉa hè (${fx((s.walkBad / Math.max(1, s.walkSamples)) * 100, 2)}%); ví dụ giữa phố: ${JSON.stringify(mid.slice(0, 4))}`);
  R.check('b2: không xe nào cắt qua vỉa hè ở góc nút giao liên tục từ 1 giây trở lên (cách nút ≤ 14 m)', corner.length === 0, `${corner.length} xe; trong đó tâm xe nằm hẳn trên hè: ${corner.filter((c) => c.tamTrenHe).length}; ví dụ: ${JSON.stringify(corner.slice(0, 4))}`);
  R.check('b3: không xe đang chạy nào nằm trong lòng nhà', s.insideN === 0, `${s.insideN}/${s.insideChecked} lượt kiểm, tại ${s.insidePlaces.length} chỗ: ${JSON.stringify(s.insidePlaces.slice(0, 6))}; ví dụ: ${JSON.stringify(s.inside.slice(0, 2))}`);
  // (d)
  R.check('d1: không cặp xe nào chồng sâu lên nhau (trục hai thân xe cách nhau dưới 60% tổng nửa bề ngang) liên tục quá 2 giây', s.ov.n === 0, `${s.ov.n} cặp trong ${fx(s.vehSecs, 0)} xe·giây (${fx((s.ov.n / Math.max(1, s.vehSecs)) * 3600, 1)} cặp mỗi xe·giờ); ở nút giao (≤ 14 m): ${s.ov.nut}, giữa phố: ${s.ov.giuaPho}; cả hai xe đứng yên: ${s.ov.dungYen}, có xe đang chạy: ${s.ov.coXeChay}; đang chờ đèn đỏ: ${s.ov.choDen}; gần như trùng tâm (< 0,25 m): ${s.ov.trungTam}; có ô tô/buýt: ${s.ov.coOTo}; ví dụ giữa phố: ${JSON.stringify(s.ovMid.slice(0, 3))}; ví dụ đang chạy: ${JSON.stringify(s.ovMove.slice(0, 3))}`);
  if (maxSegH) R.check('g3: trong các khu đã đi qua không có bức tường va chạm nào cao quá 115 m', maxSegH <= 115, `cao nhất ${fx(maxSegH, 1)} m`);
}

// ===== (f) biển tên phố =====
if (want('plates')) {
  const L = plateLayout(world), nameRows = Math.ceil(L.names.length / L.cols);
  // ngã ba, ngã tư của hai phố khác tên (tính độc lập từ dữ liệu đường): nút chung của các đoạn đường mang ≥ 2 tên phố khác nhau
  const key = (x, z) => Math.round(x * 10) * 100003 + Math.round(z * 10), nodes = new Map();
  for (const r of world.roads) { if (r.kind > 5 || (r.flags & 2)) continue; const nm = world.names[r.name]; for (const e of [0, 1]) { const i = e ? r.p.length - 2 : 0, k = key(r.p[i], r.p[i + 1]); let n = nodes.get(k); if (!n) nodes.set(k, (n = { x: r.p[i], z: r.p[i + 1], names: new Set(), arms: 0 })); n.arms++; if (isPlateName(nm) && !isAlleyName(nm) && r.len >= 8) n.names.add(nm); } }
  const cross = [...nodes.values()].filter((n) => n.names.size >= 2 && n.arms >= 3).map((n) => ({ x: n.x, z: n.z, names: [...n.names] }));
  const out = [];
  for (const [name, zone, label] of [mixSpots[0], mixSpots[2], mixSpots[4]]) {
    const r = world.roads.filter((q) => world.names[q.name] === name && zoneAt(q.p[(q.p.length >> 2) << 1], q.p[((q.p.length >> 2) << 1) + 1]) === zone).sort((a, b) => b.len - a.len)[0], k = (r.p.length >> 2) << 1;
    await page.evaluate(([x, z]) => window.__tr.go(x, z), [r.p[k], r.p[k + 1]]);
    const res = await page.evaluate(async ([names, cols, rows, nameRows, cross]) => {
      const g = window.__game, Q = window.__qa, P = g.player.pos, W = g.world;
      for (let i = 0; i < 3000; i++) { Q.step(1); if (![...g.chunks.loaded.values()].some((c) => c.detailPending)) break; await Q.sleep(4); }
      const chunks = [...g.chunks.loaded.values()].filter((c) => c.detail), plates = [];
      for (const c of chunks) { if (!c.plate) continue; const pos = c.plate.geometry.attributes.position.array, uv = c.plate.geometry.attributes.uv.array, seen = new Map();
        for (let i = 0; i < uv.length / 2; i++) { const u = uv[i * 2], v = uv[i * 2 + 1], row = Math.floor((1 - v) * rows), col = Math.floor(u * cols); if (row < 0 || row >= nameRows || col < 0 || col >= cols) continue; const idx = row * cols + col; if (idx >= names.length) continue; const x = pos[i * 3] + c.X0, y = pos[i * 3 + 1], z = pos[i * 3 + 2] + c.Z0, kk = idx + ':' + Math.round(x / 1.5) + ':' + Math.round(z / 1.5); const p = seen.get(kk); if (p) { p.n++; p.x += x; p.z += z; p.y = Math.max(p.y, y); } else seen.set(kk, { idx, n: 1, x, z, y }); }
        for (const p of seen.values()) plates.push({ name: names[p.idx], x: p.x / p.n, z: p.z / p.n, y: p.y, verts: p.n, chunk: c.key }); }
      // 1) tên trên biển phải là tên một con phố nằm ngay cạnh biển (≤ 25 m)
      const wrong = []; for (const p of plates) { let best = 1e9; for (const r of W.roads) { if (W.names[r.name] !== p.name) continue; if (r.bb[0] > p.x + 30 || r.bb[2] < p.x - 30 || r.bb[1] > p.z + 30 || r.bb[3] < p.z - 30) continue; for (let i = 0; i < r.p.length - 2; i += 2) { const ax = r.p[i], az = r.p[i + 1], ex = r.p[i + 2] - ax, ez = r.p[i + 3] - az, l2 = ex * ex + ez * ez, t = l2 ? Math.max(0, Math.min(1, ((p.x - ax) * ex + (p.z - az) * ez) / l2)) : 0, d = Math.hypot(ax + ex * t - p.x, az + ez * t - p.z); if (d < best) best = d; } } p.toStreet = best; if (best > 25) wrong.push({ name: p.name, at: [+p.x.toFixed(0), +p.z.toFixed(0)], d: best > 1e8 ? null : +best.toFixed(0) }); }
      // 2) ô chi tiết có ngã ba/ngã tư hai phố khác tên thì phải có lưới biển; 3) mỗi ngã như vậy: có biển mang tên một trong các phố của nó trong 30 m
      const inChunk = (c, x, z) => x >= c.X0 && x < c.X0 + 128 && z >= c.Z0 && z < c.Z0 + 128; const noMesh = []; let chunksWith = 0;
      for (const c of chunks) { const n = cross.filter((q) => inChunk(c, q.x, q.z)).length; if (n >= 2) { chunksWith++; if (!plates.some((p) => p.chunk === c.key)) noMesh.push({ chunk: c.key, at: [c.x, c.z], nga: n }); } }
      const near = cross.filter((q) => chunks.some((c) => inChunk(c, q.x, q.z))); let any = 0, both = 0; const miss = [];
      for (const q of near) { const here = plates.filter((p) => Math.hypot(p.x - q.x, p.z - q.z) < 30), got = q.names.filter((nm) => here.some((p) => p.name === nm)); if (got.length) any++; else if (miss.length < 8) miss.push({ at: [+q.x.toFixed(0), +q.z.toFixed(0)], pho: q.names, bienGan: [...new Set(here.map((p) => p.name))] }); if (got.length >= 2) both++; }
      // 4) biển gần người chơi nhất mang tên phố người chơi đang đứng
      const rd = g.nav.nearestRoad(P.x, P.z, 20), street = rd ? W.names[rd.r.name] : null; const mine = plates.filter((p) => p.name === street).map((p) => Math.hypot(p.x - P.x, p.z - P.z)).sort((a, b) => a - b)[0];
      return { detailChunks: chunks.length, plates: plates.length, names: new Set(plates.map((p) => p.name)).size, wrong, chunksWith, noMesh, cross: near.length, any, both, miss, street, nearestOwn: mine === undefined ? null : +mine.toFixed(0), heights: [Math.min(...plates.map((p) => p.y)), Math.max(...plates.map((p) => p.y))] };
    }, [L.names, L.cols, L.rows, nameRows, cross.filter((q) => Math.hypot(q.x - r.p[k], q.z - r.p[k + 1]) < 500)]);
    out.push({ label, name, ...res });
    console.log(`   biển ${label} (${name}): ${res.detailChunks} ô chi tiết, ${res.plates} mặt biển (${res.names} tên), sai tên ${res.wrong.length}, ngã có biển ${res.any}/${res.cross} (đủ hai tên: ${res.both}), ô thiếu lưới ${res.noMesh.length}/${res.chunksWith}, biển mang tên phố đang đứng gần nhất cách ${res.nearestOwn} m`);
  }
  R.check('f1: mọi ô phố chi tiết có từ 2 ngã ba/ngã tư (hai phố khác tên) đều có lưới biển tên phố', out.every((o) => o.noMesh.length === 0) && out.every((o) => o.plates > 10), out.map((o) => `${o.label}: ${o.plates} mặt biển trên ${o.detailChunks} ô, thiếu ${o.noMesh.length}/${o.chunksWith} ${JSON.stringify(o.noMesh.slice(0, 2))}`).join(' | '));
  R.check('f2: tên đọc được trên mỗi biển là tên một con phố nằm trong 25 m quanh biển (không biển nào ghi sai phố)', out.every((o) => o.wrong.length === 0), out.map((o) => `${o.label}: ${o.wrong.length}/${o.plates} sai ${JSON.stringify(o.wrong.slice(0, 3))}`).join(' | '));
  const anyAll = out.reduce((a, o) => a + o.any, 0), crossAll = out.reduce((a, o) => a + o.cross, 0);
  R.check('f3: ít nhất 90% ngã ba/ngã tư của hai phố khác tên có biển mang tên một trong các phố đó trong vòng 30 m', crossAll > 30 && anyAll / crossAll >= 0.9, `${anyAll}/${crossAll} = ${fx((anyAll / Math.max(1, crossAll)) * 100, 0)}%; thiếu, ví dụ: ${JSON.stringify(out.flatMap((o) => o.miss).slice(0, 4))}`);
  R.check('f4: đứng giữa phố: có biển mang đúng tên con phố đang đứng trong vòng 150 m', out.every((o) => o.nearestOwn !== null && o.nearestOwn <= 150), out.map((o) => `${o.street}: ${o.nearestOwn} m`).join(' | '));
  R.check('f5: biển tên phố treo cao hơn đầu người và không cao quá tầng hai (đỉnh biển 2 đến 6 m)', out.every((o) => o.heights[0] > 2 && o.heights[1] < 6), out.map((o) => `${o.label}: ${fx(o.heights[0])}…${fx(o.heights[1])} m`).join(' | '));
}

// ===== (c) hai cây cầu =====
if (want('bridge')) {
  // --- cầu Long Biên: đứng giữa cầu 100 giây, ghi mọi xe trên mặt cầu ---
  const lb = world.roads.filter((r) => world.names[r.name] === 'Cầu Long Biên' && r.elev && r.len > 300);
  const east = lb.filter((r) => r.p[r.p.length - 2] > r.p[0]), mid = east[0], km = (mid.p.length >> 2) << 1;
  await page.evaluate(([x, z]) => window.__tr.go(x, z), [mid.p[km], mid.p[km + 1]]);
  const LB = await page.evaluate(async ([ux, uz]) => { const g = window.__game, Q = window.__qa, X = window.__tr, W = g.world, seen = new Map(), P = g.player; const py = P.y;
    for (let k = 0; k < 100; k++) { X.run(60, -1); for (const a of g.traffic.agents) { if (a.x > 1e8 || a.y < 3 || !/Long Biên/.test(W.names[a.e.r.name] || '')) continue; const hx = Math.sin(a.yaw), hz = Math.cos(a.yaw), along = hx * ux + hz * uz; if (Math.abs(along) < 0.7 || a.v < 0.5) continue; const lat = a.x * -uz + a.z * ux; /* toạ độ ngang: dương = bên PHẢI của hướng đông (phía nam) */ const s = seen.get(a.id) || { type: a.type, cls: a.cls, dir: along > 0 ? 1 : -1, lat: 0, n: 0, s: a.x * ux + a.z * uz }; s.lat += lat; s.n++; seen.set(a.id, s); } if (k % 10 === 0) await Q.yield(); }
    return { py, list: [...seen.values()].map((s) => ({ type: s.type, cls: s.cls, dir: s.dir, lat: s.lat / s.n })), onDeck: g.nav.groundY(P.pos.x, P.pos.z, Infinity) }; }, (() => { const n = mid.p.length, L = Math.hypot(mid.p[n - 2] - mid.p[0], mid.p[n - 1] - mid.p[1]); return [(mid.p[n - 2] - mid.p[0]) / L, (mid.p[n - 1] - mid.p[1]) / L]; })());
  const TN = ['wave', 'scooter', 'cub', 'sedan', 'hatch', 'bus', 'bicycle', 'cyclo', 'ecart'], badType = LB.list.filter((a) => !(a.cls === 0 || a.type === 6));
  const e = LB.list.filter((a) => a.dir > 0), w = LB.list.filter((a) => a.dir < 0), mean = (l) => l.reduce((s, a) => s + a.lat, 0) / Math.max(1, l.length);
  R.check('c1: cầu Long Biên: trong 100 giây chỉ thấy xe máy và xe đạp trên mặt cầu (≥ 15 xe)', LB.list.length >= 15 && badType.length === 0, `${LB.list.length} xe: ${Object.entries(LB.list.reduce((m, a) => { m[TN[a.type]] = (m[TN[a.type]] || 0) + 1; return m; }, {})).map(([k, v]) => `${k} ${v}`).join(', ')}; người chơi ở cao độ ${fx(LB.py)} m`);
  // đi bên TRÁI: xe đi về hướng đông phải ở bên trái (phía bắc) của xe đi về hướng tây: toạ độ ngang (dương = phải của hướng đông) nhỏ hơn
  const wrongSide = e.filter((a) => a.lat > mean(w)).length + w.filter((a) => a.lat < mean(e)).length;
  R.check('c2: cầu Long Biên: xe đi bên trái (xe về phía đông nằm bên trái xe về phía tây, nhìn theo hướng đông)', e.length >= 5 && w.length >= 5 && mean(e) < mean(w) - 2 && wrongSide === 0, `${e.length} xe hướng đông ở ngang ${fx(mean(e), 1)} m, ${w.length} xe hướng tây ở ngang ${fx(mean(w), 1)} m (chênh ${fx(mean(w) - mean(e), 1)} m; dương = xe hướng đông ở bên trái), ${wrongSide} xe lệch bên`);

  // --- cầu Chương Dương ---
  const cd = world.roads.filter((r) => world.names[r.name] === 'Cầu Chương Dương' && r.len > 300), midR = cd.find((r) => !(r.flags & 1)), outer = cd.filter((r) => r.flags & 1);
  R.check('c3 tiền đề: cầu Chương Dương có một lòng giữa hai chiều và hai làn ngoài một chiều', !!midR && outer.length === 2, `lòng giữa rộng ${midR && midR.w} m, làn ngoài rộng ${outer.map((r) => r.w).join(', ')} m`);
  const at = (r, s) => { let i = 0; while (i < r.cum.length - 2 && r.cum[i + 1] < s) i++; const L = r.cum[i + 1] - r.cum[i] || 1, t = (s - r.cum[i]) / L, dx = r.p[i * 2 + 2] - r.p[i * 2], dz = r.p[i * 2 + 3] - r.p[i * 2 + 1]; return [r.p[i * 2] + dx * t, r.p[i * 2 + 1] + dz * t, dx / L, dz / L]; };
  const sMid = (midR.p[0] < midR.p[midR.p.length - 2] ? 1 : -1), fromCity = (s) => (sMid > 0 ? s : midR.len - s); // quãng tính từ đầu phía phố
  const c0 = at(midR, fromCity(520));
  await page.evaluate(([x, z]) => window.__tr.go(x, z), [c0[0], c0[1]]);
  const roadsPts = [midR, ...outer].map((r) => ({ w: r.w, oneway: !!(r.flags & 1), p: Array.from(r.p) }));
  const CD = await page.evaluate(async ([roads]) => { const g = window.__game, Q = window.__qa, X = window.__tr, seen = new Map();
    const dist = (r, x, z) => { let best = 1e9; for (let i = 0; i < r.p.length - 2; i += 2) { const ax = r.p[i], az = r.p[i + 1], ex = r.p[i + 2] - ax, ez = r.p[i + 3] - az, l2 = ex * ex + ez * ez, t = l2 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)) : 0, d = Math.hypot(ax + ex * t - x, az + ez * t - z); if (d < best) best = d; } return best; };
    window.__cdDist = (x, z) => roads.map((r) => dist(r, x, z));
    for (let k = 0; k < 110; k++) { X.run(60, -1); for (const a of g.traffic.agents) { if (a.x > 1e8 || a.y < 4) continue; const d = roads.map((r) => dist(r, a.x, a.z)); let on = -1; for (let i = 0; i < roads.length; i++) if (d[i] < roads[i].w / 2 + 0.3 && (on < 0 || d[i] - roads[i].w / 2 < d[on] - roads[on].w / 2)) on = i; if (on < 0) continue; const s = seen.get(a.id) || { type: a.type, cls: a.cls, on: [0, 0, 0] }; s.on[on]++; seen.set(a.id, s); } if (k % 10 === 0) await Q.yield(); }
    return { list: [...seen.values()], py: g.player.y }; }, [roadsPts]);
  const onMid = CD.list.filter((a) => a.on[0] > a.on[1] + a.on[2]), onOut = CD.list.filter((a) => a.on[0] <= a.on[1] + a.on[2]);
  const bikesMid = onMid.filter((a) => a.cls === 0 || a.cls === 3), carsOut = onOut.filter((a) => a.cls === 1 || a.cls === 2);
  const cnt = (l) => Object.entries(l.reduce((m, a) => { m[TN[a.type]] = (m[TN[a.type]] || 0) + 1; return m; }, {})).map(([k, v]) => `${k} ${v}`).join(', ') || 'không xe';
  R.check('c3: cầu Chương Dương: lòng giữa không có xe máy, xe thô sơ (và có ô tô chạy: ≥ 5 xe)', onMid.length >= 5 && bikesMid.length === 0, `lòng giữa: ${cnt(onMid)}; người chơi ở cao độ ${fx(CD.py)} m`);
  R.check('c4: cầu Chương Dương: hai làn ngoài không có ô tô, xe buýt (và có xe máy chạy: ≥ 10 xe)', onOut.length >= 10 && carsOut.length === 0, `hai làn ngoài: ${cnt(onOut)}`);

  // --- người chơi không băng được giữa lòng giữa và làn xe máy qua dàn thép ---
  const trials = [];
  for (const sCity of [340, 520, 700, 880]) for (const mode of ['bike', 'walk']) for (const side of [1, -1]) for (const ang of [90, 35]) {
    const c = at(midR, fromCity(sCity)), ux = c[2], uz = c[3], nx = -uz * side, nz = ux * side; // hướng ngang cầu
    const a = (ang * Math.PI) / 180, hx = ux * Math.cos(a) + nx * Math.sin(a), hz = uz * Math.cos(a) + nz * Math.sin(a);
    await page.evaluate(([x, z, yaw, mode]) => { const g = window.__game, P = g.player; g.input.keys.clear(); if (P.mode === 'bike') { P.speed = 0; P.toggleBike(); } P.teleport(x, z, yaw, true); g.cam.snap(P); window.__qa.step(5); if (mode === 'bike') { P.toggleBike(); } window.__qa.step(60); }, [c[0], c[1], Math.atan2(hx, hz), mode]);
    const st0 = await page.evaluate(() => ({ y: window.__game.player.y, mode: window.__game.player.mode, d: window.__cdDist(window.__game.player.pos.x, window.__game.player.pos.z) }));
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
    const tr = await page.evaluate(() => { const g = window.__game, Q = window.__qa, P = g.player; let maxMid = 0, minOut = 1e9, minY = 99, maxV = 0, onOuter = 0; for (let i = 0; i < 360; i++) { Q.step(1); const d = window.__cdDist(P.pos.x, P.pos.z); if (d[0] > maxMid) maxMid = d[0]; const o = Math.min(d[1], d[2]); if (o < minOut) minOut = o; if (P.y < minY) minY = P.y; if (Math.abs(P.speed) > maxV) maxV = Math.abs(P.speed); if (o < 1.7) onOuter++; } return { maxMid, minOut, minY, maxV, onOuter, end: [P.pos.x, P.pos.z, P.y] }; });
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
    trials.push({ s: sCity, mode, side: side > 0 ? 'phải' : 'trái', goc: ang, y0: fx(st0.y, 1), d0: st0.d.map((v) => fx(v, 1)), lechGiuaMax: fx(tr.maxMid), cachLanNgoaiMin: fx(tr.minOut), vMax: fx(tr.maxV, 1), yMin: fx(tr.minY, 1), trenLanNgoai: tr.onOuter, ok: st0.mode === mode && st0.y > 5 && tr.maxMid <= midR.w / 2 + 0.05 && tr.onOuter === 0 && tr.minY > 5 });
  }
  const badT = trials.filter((t) => !t.ok);
  R.check(`c5: người chơi từ lòng giữa cầu Chương Dương (đi xe hết ga và chạy bộ, đâm vuông góc và chéo 35°, 4 vị trí trong dàn thép, ${trials.length} lần): không ra khỏi lòng giữa (lệch tim ≤ ${fx(midR.w / 2, 1)} m), không lọt sang làn xe máy, không rơi khỏi cầu`, badT.length === 0, badT.length ? `${badT.length}/${trials.length} hỏng: ${JSON.stringify(badT.slice(0, 4))}` : `lệch tim lớn nhất ${Math.max(...trials.map((t) => t.lechGiuaMax))} m, gần tim làn ngoài nhất ${Math.min(...trials.map((t) => t.cachLanNgoaiMin))} m`);
  // chiều ngược lại: từ làn xe máy đâm vào phía lòng giữa
  const trials2 = [];
  for (const sCity of [400, 700]) for (const o of outer) for (const side of [1, -1]) {
    const so = (o.p[0] < o.p[o.p.length - 2] ? sCity : o.len - sCity), c = at(o, Math.max(5, Math.min(o.len - 5, so))), nx = -c[3] * side, nz = c[2] * side;
    await page.evaluate(([x, z, yaw]) => { const g = window.__game, P = g.player; g.input.keys.clear(); if (P.mode === 'bike') { P.speed = 0; P.toggleBike(); } P.teleport(x, z, yaw, true); g.cam.snap(P); window.__qa.step(5); P.toggleBike(); window.__qa.step(60); }, [c[0], c[1], Math.atan2(nx, nz)]);
    const d0 = await page.evaluate(() => window.__cdDist(window.__game.player.pos.x, window.__game.player.pos.z));
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
    const tr = await page.evaluate(() => { const g = window.__game, Q = window.__qa, P = g.player; let minMid = 1e9, minY = 99; for (let i = 0; i < 300; i++) { Q.step(1); const d = window.__cdDist(P.pos.x, P.pos.z); if (d[0] < minMid) minMid = d[0]; if (P.y < minY) minY = P.y; } return { minMid, minY }; });
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
    trials2.push({ s: sCity, side, d0: d0.map((v) => fx(v, 1)), cachTimGiuaMin: fx(tr.minMid), yMin: fx(tr.minY, 1), ok: tr.minMid > midR.w / 2 - 0.05 && tr.minY > 5 });
  }
  const badT2 = trials2.filter((t) => !t.ok);
  R.check(`c6: người chơi đi xe trên làn xe máy cầu Chương Dương đâm ngang (${trials2.length} lần): không lọt vào lòng giữa, không rơi khỏi cầu`, badT2.length === 0, badT2.length ? JSON.stringify(badT2.slice(0, 4)) : `gần tim lòng giữa nhất ${Math.min(...trials2.map((t) => t.cachTimGiuaMin))} m (mép lòng giữa ở ${fx(midR.w / 2, 1)} m)`);
}
R.check('không có pageerror / console.error', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close();
process.exit(R.finish());
