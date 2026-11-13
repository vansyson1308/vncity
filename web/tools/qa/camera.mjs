// MỤC 2: CAMERA. Yêu cầu (tiêu chí 4 của chủ sản phẩm + lỗi A2/BUG-02 cũ): đứng sát tường, trong ngõ hẹp, dưới mái, cạnh cột cổng,
// trên cầu, cạnh rào công trường, cổng cơ quan (bốt gác), trạm biến áp / nhà chờ; xoay camera đủ 360° và ngửa / cúi:
//   (P) không khung hình nào quá 60% điểm ảnh đen (tổng R+G+B < 24), đo trên khung hình vẽ thật lúc 10 giờ sáng;
//   (L) camera không nằm trong lòng khối đặc, tia nhìn từ camera tới đầu nhân vật không bị tường cao hơn tia chắn;
//   (R) rời tường thì khoảng cách camera hồi lại trên 3 m trong 2 giây; không bao giờ kẹt ở 0,05.
// Chỗ thử do bài thử TỰ CHỌN lúc chạy từ dữ liệu va chạm của game.nav (đoạn tường, bề rộng ngõ, khối công trình), không dùng danh sách
// toạ độ của nhóm dev. Phép (L) dùng phép cắt đoạn thẳng viết riêng ở đây, không gọi nav.raycast / nav.clearAt của game.
// Phần L chạy đồng hồ ảo, không vẽ (hàng trăm chỗ × 36 góc × 5 độ ngửa). Phần P vẽ thật ở 480×270 (máy không GPU), 40 khung mỗi chỗ.
// Dùng: node tools/qa/camera.mjs [l] [p] [r]
import path from 'node:path';
import { launch, openGame, Report, invariantHelper, OUT, fx } from './lib.mjs';

const want = (k) => process.argv.length <= 2 || process.argv.slice(2).includes(k);
const R = new Report('camera');
const browser = await launch();
const { page, errors } = await openGame(browser, 'q=low&fresh&lang=vi&h=10', { init: invariantHelper, viewport: { width: 480, height: 270 } });
await page.evaluate(async () => { window.__norender = true; await window.__qa.virtual(); window.__qa.step(5); });

// ----- trợ giúp trong trang -----
await page.evaluate(() => {
  const g = window.__game, nav = g.nav, Q = window.__qa, I = window.__inv;
  const segs = (x, z, r, fn) => { const seen = new Set(); for (const [key, c] of nav.chunks) for (let cx = Math.floor((x - r) / 16); cx <= Math.floor((x + r) / 16); cx++) for (let cz = Math.floor((z - r) / 16); cz <= Math.floor((z + r) / 16); cz++) { const l = c.cells.get(cx * 65537 + cz); if (!l) continue; for (const i of l) { const id = key + ':' + i; if (seen.has(id)) continue; seen.add(id); fn(c.segs, i, key); } } };
  // khoảng cách dọc tia ngang (dx,dz) từ (x,z) tới bức tường đầu tiên cao từ minH (bờ nước không tính)
  const ray = (x, z, dx, dz, max, minH = 0.5) => { let best = max; segs(x + dx * max / 2, z + dz * max / 2, max / 2 + 1, (s, i) => { if (!(s[i + 4] >= minH)) return; const ax = s[i] - x, az = s[i + 1] - z, ex = s[i + 2] - s[i], ez = s[i + 3] - s[i + 1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) return; const t = (ax * ez - az * ex) / den, u = (ax * dz - az * dx) / den; if (t > 0 && t < best && u >= 0 && u <= 1) best = t; }); return best; };
  // tia nhìn từ đầu nhân vật (hx,hy,hz) tới camera (cx,cy,cz) có bị tường cao hơn tia chắn không
  const sight = (hx, hy, hz, cx, cy, cz) => { const dx = cx - hx, dz = cz - hz, L = Math.hypot(dx, dz); if (L < 0.05) return null; let hit = null; segs((hx + cx) / 2, (hz + cz) / 2, L / 2 + 1, (s, i, key) => { if (!(s[i + 4] >= 0)) return; const ax = s[i] - hx, az = s[i + 1] - hz, ex = s[i + 2] - s[i], ez = s[i + 3] - s[i + 1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) return; const t = (ax * ez - az * ex) / den, u = (ax * dz - az * dx) / den; if (t > 0.02 && t < 0.98 && u >= 0 && u <= 1 && s[i + 4] > hy + (cy - hy) * t + 0.05) { if (!hit || t < hit.t) hit = { t: +t.toFixed(2), h: +s[i + 4].toFixed(1), key }; } }); return hit; };
  const minDist = (x, z, r, minH = 0.5) => { let best = r; segs(x, z, r, (s, i) => { if (!(s[i + 4] >= minH)) return; const ex = s[i + 2] - s[i], ez = s[i + 3] - s[i + 1], l2 = ex * ex + ez * ez, t = l2 > 0 ? Math.max(0, Math.min(1, ((x - s[i]) * ex + (z - s[i + 1]) * ez) / l2)) : 0, d = Math.hypot(s[i] + ex * t - x, s[i + 1] + ez * t - z); if (d < best) best = d; }); return best; };
  window.__cam = {
    ray, sight, minDist,
    // đi nhanh tới (x,z) và chờ các ô phố quanh đó dựng xong
    async go(x, z, yaw = 0) { g.warp(x, z, yaw); for (let i = 0; i < 6000; i++) { Q.step(1); if (!g.warping && g.chunks.missingNear(x, z, 150)[0] === 0 && g.chunks.pending.size === 0) break; await Q.sleep(4); } Q.step(3); return [g.player.pos.x, g.player.pos.z]; },
    // chỗ đứng sát tường nhà: cách mặt tường 0,33 m về phía ngoài, quanh (cx,cz) trong bán kính Rr; lọc theo bộ lọc đoạn tường f(h, len)
    wallSpots(cx, cz, Rr, n, f, gap = 25) {
      const cand = []; segs(cx, cz, Rr, (s, i) => { const h = s[i + 4], ex = s[i + 2] - s[i], ez = s[i + 3] - s[i + 1], len = Math.hypot(ex, ez); if (!f(h, len)) return; const mx = (s[i] + s[i + 2]) / 2, mz = (s[i + 1] + s[i + 3]) / 2; if (Math.hypot(mx - cx, mz - cz) > Rr) return; const nx = ez / len, nz = -ex / len; for (const sg of [1, -1]) { const px = mx + nx * sg * 0.33, pz = mz + nz * sg * 0.33; if (I.inside(px, pz, 0.5) || nav.isWater(px, pz) || minDist(px, pz, 0.3) < 0.29) continue; cand.push({ x: px, z: pz, nx: nx * sg, nz: nz * sg, h: +h.toFixed(1), len: +len.toFixed(1) }); } });
      const out = []; for (let k = 0; k < cand.length && out.length < n; k++) { const c = cand[(k * 7919) % cand.length]; if (out.every((o) => Math.hypot(o.x - c.x, o.z - c.z) > gap)) out.push(c); } return out;
    },
    // ngõ hẹp: điểm trên tim các lối đi rộng không quá 3,2 m mà hai bên đều có tường cao từ 3 m trong vòng 2 m
    alleySpots(cx, cz, Rr, n) {
      const out = []; for (const r of g.world.roads) { if (r.w > 3.2 || r.skip || r.len < 12) continue; const k = (r.p.length >> 2) << 1, x = r.p[k], z = r.p[k + 1]; if (Math.hypot(x - cx, z - cz) > Rr) continue; const j = Math.min(k + 2, r.p.length - 2), i0 = j - 2, tx = r.p[j] - r.p[i0], tz = r.p[j + 1] - r.p[i0 + 1], L = Math.hypot(tx, tz) || 1, nx = tz / L, nz = -tx / L; const a = ray(x, z, nx, nz, 2.5, 3), b = ray(x, z, -nx, -nz, 2.5, 3); if (a < 2 && b < 2 && a > 0.35 && b > 0.35 && !I.inside(x, z, 0.5) && out.every((o) => Math.hypot(o.x - x, o.z - z) > 30)) out.push({ x, z, nx, nz, width: +(a + b).toFixed(1), name: g.world.names[r.name] || '' }); if (out.length >= n) break; } return out;
    },
    // góc lõm: từ một chỗ sát tường, trượt dọc tường tới khi có bức tường thứ hai chắn ngang trong 0,5 m
    cornerSpots(cx, cz, Rr, n) {
      const out = []; for (const w of this.wallSpots(cx, cz, Rr, 60, (h, len) => h >= 4 && len >= 3, 8)) { const tx = -w.nz, tz = w.nx; for (const sg of [1, -1]) { const d = ray(w.x, w.z, tx * sg, tz * sg, 12, 3); if (d < 11.5) { const x = w.x + tx * sg * (d - 0.33), z = w.z + tz * sg * (d - 0.33); if (minDist(x, z, 0.3) >= 0.29 && !I.inside(x, z, 0.5) && ray(x, z, w.nx, w.nz, 3, 3) > 1 && out.every((o) => Math.hypot(o.x - x, o.z - z) > 25)) { out.push({ x, z, nx: w.nx, nz: w.nz }); break; } } } if (out.length >= n) break; } return out;
    },
    // đặt nhân vật tại chỗ thử (đứng yên), trả về tình trạng
    place(s, deck = false) { const P = g.player; if (P.mode === 'bike') { P.speed = 0; P.toggleBike(); } P.teleport(s.x, s.z, Math.atan2(-(s.nx || 0), -(s.nz || 1)), deck); g.cam.yaw = P.yaw + Math.PI; g.cam.pitch = 0.16; g.cam.zoom = 1; Q.step(20); return { x: P.pos.x, z: P.pos.z, y: P.y }; },
    // đo một tư thế camera: ép góc, cho game chạy k khung, rồi kiểm bằng phép đo độc lập
    probe(yaw, pitch, k = 4) {
      g.cam.yaw = yaw; g.cam.pitch = pitch; g.input.lastLook = performance.now(); Q.step(k);
      const P = g.player, c = g.camera.position, hy = P.y + 1.55, bad = Q.finite();
      // khối đặc = vòng tường khép kín (nhà, khối công trình: cao từ 2,5 m) cao hơn camera. Tường rào, rào tôn cao 2,2 m là đường hở,
      // không đếm chẵn lẻ được: chúng thuộc phép kiểm tia nhìn (sight) bên dưới.
      const inSolid = c.y < 40 && I.inside(c.x, c.z, Math.max(2.5, c.y));
      const blk = sight(P.pos.x, hy, P.pos.z, c.x, c.y, c.z);
      return { cur: g.cam.cur, close: g.cam.close, bad, inSolid, blk, cam: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)], near: g.camera.near };
    },
    sweep(yaws, pitches) { const out = { n: 0, minCur: 9, at005: 0, inSolid: [], blocked: [], bad: [], close: [] }; for (const p of pitches) for (let k = 0; k < yaws; k++) { const yaw = (k / yaws) * Math.PI * 2, r = this.probe(yaw, p); out.n++; if (r.cur < out.minCur) out.minCur = r.cur; if (r.cur <= 0.06) out.at005++; out.close.push(r.close); if (r.bad.length) out.bad.push({ yaw: k, p, bad: r.bad }); if (r.inSolid && out.inSolid.length < 6) out.inSolid.push({ yawDeg: Math.round((k / yaws) * 360), pitch: p, cam: r.cam, cur: +r.cur.toFixed(2) }); if (r.blk && r.close > 0.8 && out.blocked.length < 6) out.blocked.push({ yawDeg: Math.round((k / yaws) * 360), pitch: p, cam: r.cam, cur: +r.cur.toFixed(2), ...r.blk }); if (r.inSolid) out.nSolid = (out.nSolid || 0) + 1; if (r.blk && r.close > 0.8) out.nBlocked = (out.nBlocked || 0) + 1; } return out; },
    // chỗ trống gần nhất (không tường nào trong r mét) quanh (x,z)
    open(x, z, r = 7) { for (let d = 6; d < 150; d += 6) for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.283, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (minDist(px, pz, r) >= r - 0.01 && !nav.isWater(px, pz) && !I.inside(px, pz, 0.5) && nav.groundY(px, pz) < 0.5) return [px, pz]; } return null; },
  };
});

// ----- chọn chỗ thử theo từng khu (mỗi khu một lần đi nhanh) -----
const AREAS = [
  { name: 'Bờ Hồ, cổng đền Ngọc Sơn', at: [114, -212] },
  { name: 'Phố cổ, Ô Quan Chưởng', at: [-10, -930] },
  { name: 'Ba Đình, cổng cơ quan', at: [-1500, -700] },
  { name: 'Văn Miếu, Khuê Văn Các', at: [-1700, 60] },
];
const spots = []; // { cat, area, x, z, nx, nz, deck }
const logic = { n: 0, spots: 0, inSolid: [], blocked: [], bad: [], at005: 0, minCur: 9, noRecover: [] };

async function logicAt(s) {
  const r = await page.evaluate((s) => { const C = window.__cam, g = window.__game, Q = window.__qa; const at = C.place(s, !!s.deck);
    // chỗ thử phải là chỗ người chơi đứng được thật: nếu chính nhân vật đang nằm trong một vòng tường khép kín (bài thử chọn nhầm chỗ
    // nằm giữa khối nhà OSM và khối công trình dựng tay) thì bỏ chỗ này, không tính
    if (!s.deck && window.__inv.inside(at.x, at.z, 2.5)) return { skip: true, at };
    const sw = C.sweep(36, [-0.35, 0, 0.3, 0.8, 1.25]);
    // (R) rời tường: đưa nhân vật ra chỗ trống gần nhất rồi cho game chạy 2 giây
    const o = C.open(s.x, s.z); let rec = null; if (o) { g.player.teleport(o[0], o[1], 0, false); g.cam.pitch = 0.16; Q.step(120); rec = { cur: g.cam.cur, close: g.cam.close, at: o }; }
    return { at, sw, rec }; }, s);
  if (r.skip) { logic.skipped = (logic.skipped || 0) + 1; return r; }
  logic.n += r.sw.n; logic.spots++; logic.at005 += r.sw.at005; logic.minCur = Math.min(logic.minCur, r.sw.minCur);
  const tag = `${s.cat} (${fx(s.x, 1)}, ${fx(s.z, 1)})`;
  if (r.sw.nSolid) logic.inSolid.push({ tag, n: r.sw.nSolid, ex: r.sw.inSolid.slice(0, 2) });
  if (r.sw.nBlocked) logic.blocked.push({ tag, n: r.sw.nBlocked, ex: r.sw.blocked.slice(0, 2) });
  if (r.sw.bad.length) logic.bad.push({ tag, ex: r.sw.bad.slice(0, 2) });
  if (r.rec && !(r.rec.cur > 3 && r.rec.close > 3)) logic.noRecover.push({ tag, ...r.rec });
  return r;
}

// cầu: mặt cầu Thê Húc (giữa cầu, đầu đảo cạnh lầu Đắc Nguyệt), cầu Long Biên, cầu Chương Dương, và dưới mái (nhà loại "roof" trong bản đồ)
const BR = [{ name: 'giữa cầu Thê Húc', area: 'Bờ Hồ, cổng đền Ngọc Sơn', calc: () => { const g = window.__game, d = g.nav.decks[0]; return { x: d.ax + (d.bx - d.ax) * 0.5, z: d.az + (d.bz - d.az) * 0.5, nx: 0, nz: 1, deck: true }; } },
  { name: 'cầu Thê Húc, đầu đảo (lầu Đắc Nguyệt)', area: 'Bờ Hồ, cổng đền Ngọc Sơn', calc: () => { const g = window.__game, d = g.nav.decks[0]; return { x: d.ax + (d.bx - d.ax) * 0.97, z: d.az + (d.bz - d.az) * 0.97, nx: 0, nz: 1, deck: true }; } }];
async function pixelsFor(A) {
  const mine = spots.filter((q) => q.area === A.name), pickN = (cat, n) => mine.filter((q) => q.cat === cat).slice(0, n);
  const list = [...pickN('wall', 2), ...pickN('alley', 2), ...pickN('corner', 1), ...pickN('pillar', 2), ...pickN('fence', 1), ...pickN('small', 1), ...pickN('gate', 1)];
  if (A.name.startsWith('Bờ Hồ')) for (const b of BR) list.push({ cat: b.name, area: A.name, ...(await page.evaluate(b.calc)) });
  for (const s of list) await pixelAt(s);
}
const pix = [];
async function pixelAt(s) {
  const at = await page.evaluate((s) => window.__cam.place(s, !!s.deck), s);
  const frames = [];
  for (const [pitch, n] of [[0.16, 24], [-0.3, 8], [1.0, 8]]) for (let k = 0; k < n; k++) {
    const yaw = (k / n) * Math.PI * 2;
    const r = await page.evaluate(([yaw, pitch]) => {
      const g = window.__game, Q = window.__qa; window.__norender = true; const pr = window.__cam.probe(yaw, pitch, 4);
      window.__norender = false; Q.step(1); window.__norender = true; // đúng một khung hình vẽ thật
      const gl = document.getElementById('game'), c = window.__c2 || (window.__c2 = document.createElement('canvas')); c.width = 96; c.height = 54;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(gl, 0, 0, 96, 54); const d = x.getImageData(0, 0, 96, 54).data; let dark = 0, sum = 0; const n = d.length / 4, hist = new Map();
      for (let i = 0; i < d.length; i += 4) { if (d[i] + d[i + 1] + d[i + 2] < 24) dark++; sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; const key = (d[i] >> 3) * 1024 + (d[i + 1] >> 3) * 32 + (d[i + 2] >> 3); hist.set(key, (hist.get(key) || 0) + 1); }
      let top = 0; for (const v of hist.values()) if (v > top) top = v;
      return { dark: dark / n, mean: sum / n, flat: top / n, cur: pr.cur, close: pr.close, inSolid: pr.inSolid, blk: !!pr.blk && pr.close > 0.8 };
    }, [yaw, pitch]);
    frames.push({ yawDeg: Math.round((k / n) * 360), pitch, ...r });
  }
  const worst = frames.reduce((p, q) => (q.dark > p.dark ? q : p)), flat = frames.reduce((p, q) => (q.flat > p.flat ? q : p));
  const row = { cat: s.cat, area: s.area, x: fx(s.x, 1), z: fx(s.z, 1), y: fx(at.y), n: frames.length, worstDark: fx(worst.dark, 3), worstAt: `${worst.yawDeg}°/${worst.pitch}`, worstFlat: fx(flat.flat, 3), flatAt: `${flat.yawDeg}°/${flat.pitch}`, minMean: fx(Math.min(...frames.map((f) => f.mean)), 1), minCur: fx(Math.min(...frames.map((f) => f.cur))) };
  pix.push(row); console.log('   px ' + JSON.stringify(row));
  // lưu ảnh khung tệ nhất (đen nhất) và khung "phẳng" nhất để người đọc báo cáo tự xem
  for (const [f, tag] of [[worst, 'den'], [flat, 'phang']]) if ((tag === 'den' && f.dark > 0.3) || (tag === 'phang' && f.flat > 0.85)) {
    await page.evaluate(([yaw, pitch]) => { window.__norender = true; window.__cam.probe(yaw, pitch, 4); window.__norender = false; window.__qa.step(1); window.__norender = true; }, [(f.yawDeg * Math.PI) / 180, f.pitch]);
    await page.screenshot({ path: path.join(OUT, `camera_${tag}_${pix.length}_${String(s.cat).replace(/[^a-z0-9]+/gi, '_')}.png`) }).catch(() => {});
  }
}

for (const A of AREAS) {
  await page.evaluate(([x, z]) => window.__cam.go(x, z), A.at);
  const found = await page.evaluate(([x, z]) => { const C = window.__cam, g = window.__game, W = g.world;
    const out = { wall: C.wallSpots(x, z, 300, 14, (h, len) => h >= 4 && len >= 3), alley: C.alleySpots(x, z, 320, 8), corner: C.cornerSpots(x, z, 280, 8), fence: C.wallSpots(x, z, 320, 6, (h, len) => Math.abs(h - 2.2) < 0.01 && len >= 2, 40), small: C.wallSpots(x, z, 320, 6, (h, len) => Math.abs(h - 2.2) < 0.01 && len < 2, 40), pillar: [], gate: [] };
    // khối đặc của công trình dựng tay (trụ cổng, lầu, cột): đứng sát từng khối
    for (const [key, c] of g.nav.chunks) { if (typeof key !== 'string') continue; const s = c.segs; let n = 0; for (let i = 0; i < s.length && n < 3; i += 20) { const mx = (s[i] + s[i + 2]) / 2, mz = (s[i + 1] + s[i + 3]) / 2; if (Math.hypot(mx - x, mz - z) > 320) continue; const ex = s[i + 2] - s[i], ez = s[i + 3] - s[i + 1], L = Math.hypot(ex, ez) || 1; for (const sg of [1, -1]) { const px = mx + (ez / L) * sg * 0.33, pz = mz - (ex / L) * sg * 0.33; if (!window.__inv.inside(px, pz, 0.5) && C.minDist(px, pz, 0.3) >= 0.29) { out.pillar.push({ x: px, z: pz, nx: (ez / L) * sg, nz: (-ex / L) * sg, key }); n++; break; } } } }
    // cổng trên tường rào (cổng cơ quan, có nơi có bốt gác): đứng ngay trong lòng cổng
    const G = W.gates; for (let i = 0; i + 1 < G.length && out.gate.length < 4; i += 2) if (Math.hypot(G[i] - x, G[i + 1] - z) < 300 && !window.__inv.inside(G[i], G[i + 1], 0.5) && out.gate.every((o) => Math.hypot(o.x - G[i], o.z - G[i + 1]) > 40)) { const p = { x: G[i], z: G[i + 1] }; g.nav.collide(p, 0.3); out.gate.push({ x: p.x, z: p.z, nx: 0, nz: 1 }); }
    return out; }, A.at);
  for (const [cat, list] of Object.entries(found)) for (const s of list) spots.push({ cat, area: A.name, ...s });
  R.note(`${A.name}: ${Object.entries(found).map(([k, v]) => `${k} ${v.length}`).join(', ')}`);
  if (want('l')) for (const s of spots.filter((q) => q.area === A.name)) await logicAt(s);
  // (P) chụp thật ở vài chỗ của khu này: xem dưới
  if (want('p')) await pixelsFor(A);
}


// hai cây cầu lớn (mỗi cầu một lần đi nhanh): đứng trên mặt cầu, sát lan can
for (const [name, x, z] of [['mặt cầu Long Biên', 701.6, -1616.2], ['mặt cầu Chương Dương', 1009.8, -1047.9]]) {
  await page.evaluate(([x, z]) => window.__cam.go(x, z), [x, z]);
  const s = await page.evaluate(([x, z]) => { const g = window.__game, P = g.player; return { x: P.pos.x, z: P.pos.z, y: P.y, nx: 0, nz: 1, deck: true }; }, [x, z]);
  spots.push({ cat: name, area: name, ...s }); R.note(`${name}: nhân vật ở cao độ ${fx(s.y)} m`);
  if (want('l')) await logicAt({ cat: name, ...s });
  if (want('p')) { await pixelAt({ cat: name, area: name, ...s });
    // sát lan can: đi ngang tới khi bị lan can chặn
    const e = await page.evaluate(() => { const g = window.__game, P = g.player, n = g.nav; n.elevatedAt(P.pos.x, P.pos.z, P.y); const p = { x: P.pos.x + n.eDz * 30, z: P.pos.z - n.eDx * 30 }; n.collide(p, 0.3, false, P.y); return { x: p.x, z: p.z, nx: 0, nz: 1, deck: true }; });
    await pixelAt({ cat: name + ', sát lan can', area: name, ...e }); }
}

if (want('l')) {
  R.check(`L0: đủ chỗ thử do bài thử tự chọn từ nav (≥ 60 chỗ, đủ loại)`, logic.spots >= 60 && ['wall', 'alley', 'corner', 'pillar', 'fence'].every((c) => spots.some((s) => s.cat === c)), `${logic.spots} chỗ hợp lệ (bỏ ${logic.skipped || 0} chỗ mà nhân vật bị đặt vào trong khối đặc): ${Object.entries(spots.reduce((m, s) => { m[s.cat] = (m[s.cat] || 0) + 1; return m; }, {})).map(([k, v]) => `${k} ${v}`).join(', ')}; ${logic.n} tư thế camera`);
  R.check('L1: mọi tư thế camera đều có toạ độ hữu hạn', logic.bad.length === 0, JSON.stringify(logic.bad.slice(0, 3)));
  R.check('L2: camera không bao giờ nằm trong lòng khối đặc khép kín (nhà, trụ cổng, khối công trình) cao hơn nó', logic.inSolid.length === 0, `${logic.inSolid.length}/${logic.spots} chỗ, ${logic.inSolid.reduce((a, b) => a + b.n, 0)}/${logic.n} tư thế; ví dụ: ${JSON.stringify(logic.inSolid.slice(0, 4))}`);
  R.check('L3: tia nhìn từ camera tới đầu nhân vật không bị tường cao hơn tia chắn (khi camera cách đầu trên 0,8 m)', logic.blocked.length === 0, `${logic.blocked.length}/${logic.spots} chỗ, ${logic.blocked.reduce((a, b) => a + b.n, 0)}/${logic.n} tư thế; ví dụ: ${JSON.stringify(logic.blocked.slice(0, 4))}`);
  R.check('L4: khoảng cách camera không bao giờ rơi về 0,05 (kẹt sát đầu)', logic.at005 === 0, `${logic.at005} tư thế có cur ≤ 0,06; nhỏ nhất ${fx(logic.minCur, 3)} m`);
  R.check('R1: rời tường ra chỗ trống, sau 2 giây camera giãn lại trên 3 m (mọi chỗ thử)', logic.noRecover.length === 0, JSON.stringify(logic.noRecover.slice(0, 4)));
}
if (want('p')) {
  const bad = pix.filter((p) => p.worstDark > 0.6), cats = new Set(pix.map((p) => p.cat));
  R.check(`P1: ${pix.length} chỗ × 40 khung hình vẽ thật (24 góc ngang ở độ ngửa mặc định, 8 góc khi ngửa hết, 8 góc khi cúi): không khung nào quá 60% điểm ảnh đen`, pix.length >= 12 && bad.length === 0, bad.length ? JSON.stringify(bad) : `${pix.length} chỗ, ${cats.size} loại; khung đen nhất ${Math.max(...pix.map((p) => p.worstDark))}`);
  const flat = pix.filter((p) => p.worstFlat > 0.9);
  R.check('P2 (phụ, ngoài tiêu chí): không khung nào bị một mảng màu phẳng phủ quá 90% (camera úp mặt vào tường)', flat.length === 0, flat.length ? `${flat.length} chỗ: ${JSON.stringify(flat.slice(0, 5))}` : `lớn nhất ${Math.max(...pix.map((p) => p.worstFlat))}`);
}

// ----- (R2) rời tường BẰNG PHÍM: đứng sát tường nhìn ra, camera bị ép giữa lưng và tường; giữ W đi ra xa tường -----
if (want('r')) {
  await page.evaluate(([x, z]) => window.__cam.go(x, z), [114, -212]);
  const res = await page.evaluate(() => { const C = window.__cam, out = []; for (const w of C.wallSpots(114, -212, 330, 80, (h, len) => h >= 5 && len >= 4, 10)) { let room = 0; for (let d = 1; d <= 14; d += 1) { if (C.minDist(w.x + w.nx * d, w.z + w.nz * d, 0.9) < 0.9 || window.__game.nav.isWater(w.x + w.nx * d, w.z + w.nz * d)) break; room = d; } if (room >= 12 && window.__game.nav.nearestRoad(w.x, w.z, 12, (r) => r.veh) === null) out.push(w); if (out.length >= 5) break; } return out; });
  const rows = [];
  for (const w of res) {
    // nhân vật quay lưng vào tường (mặt nhìn theo pháp tuyến ra ngoài), camera ở sau lưng = phía tường
    await page.evaluate((w) => { const g = window.__game, P = g.player, Q = window.__qa; P.teleport(w.x, w.z, Math.atan2(w.nx, w.nz), false); g.cam.yaw = P.yaw + Math.PI; g.cam.pitch = 0.16; g.input.keys.clear(); Q.step(30); }, w);
    const before = await page.evaluate(() => ({ cur: window.__game.cam.cur, close: window.__game.cam.close }));
    await page.keyboard.down('KeyW');
    const tr = await page.evaluate((w) => { const g = window.__game, Q = window.__qa, out = []; for (let i = 0; i < 360; i++) { Q.step(1); const P = g.player.pos, back = window.__cam.ray(P.x, P.z, -w.nx, -w.nz, 12, 2.5); out.push([+(i / 60).toFixed(2), +back.toFixed(2), +g.cam.cur.toFixed(2), +Math.hypot(P.x - w.x, P.z - w.z).toFixed(2)]); } return out; }, w);
    await page.keyboard.up('KeyW'); await page.evaluate(() => window.__qa.step(30));
    // thời điểm sau lưng đã trống ≥ 5,2 m (đủ cho camera 4,4 m + 0,4 m cách tường), và thời điểm cur vượt 3 m
    const tRoom = tr.find((q) => q[1] >= 5.2), tCur = tr.find((q) => q[2] > 3), minCur = Math.min(...tr.map((q) => q[2]));
    rows.push({ at: [fx(w.x, 1), fx(w.z, 1)], curSatTuong: fx(before.cur), minCur: fx(minCur), tDuCho: tRoom ? tRoom[0] : null, tCur3: tCur ? tCur[0] : null, cuoi: tr[tr.length - 1] });
  }
  const bad = rows.filter((r) => r.tDuCho === null || r.tCur3 === null || r.tCur3 - r.tDuCho > 2 || r.minCur <= 0.06);
  R.check(`R2: đứng lưng sát tường rồi giữ W đi ra (${rows.length} bức tường): camera giãn trên 3 m không muộn hơn 2 giây sau khi sau lưng đủ chỗ; không kẹt ở 0,05`, rows.length >= 3 && bad.length === 0, bad.length ? JSON.stringify(bad) : rows.map((r) => `sát tường ${r.curSatTuong} m → trên 3 m lúc ${r.tCur3} giây (đủ chỗ lúc ${r.tDuCho} giây)`).join('; '));
}
R.check('không có pageerror / console.error', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close();
process.exit(R.finish());
