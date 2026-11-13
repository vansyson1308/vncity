// MỤC 3 / MỤC 4 (bổ sung): LÊN XE, XUỐNG XE SÁT TƯỜNG. Cùng họ với lỗi ở shore.mjs: lúc xuống xe game đặt nhân vật sang bên trái xe 0,75 m,
// lúc lên xe game đưa nhân vật tới chỗ xe dựng (xe được đặt bên trái nhân vật 1,1 m mỗi lần đi nhanh / vào game).
// Yêu cầu (danh sách lỗi cũ A3: "đi nhanh không thả vào trong công trình"; và "không chui vào lòng nhà"): sau khi bấm F nhân vật không
// bao giờ nằm trong lòng một khối nhà, không đứng dưới nước.
//   x1) xuống xe khi xe dựng song song sát một bức tường nhà (cách 0,45 / 0,6 m), tường ở bên TRÁI xe; đối chứng: tường bên PHẢI;
//   x2) đi nhanh tới từng điểm trong 44 điểm hộ chiếu (đúng lời gọi của bản đồ) rồi bấm F lên xe ngay;
//   x3) đi nhanh tới một chỗ sát tường nhà (tường bên TRÁI nhân vật, đúng phía game dựng xe), bấm F lên xe; đối chứng: tường bên phải.
// "Trong lòng nhà" đo bằng phép đếm chẵn lẻ tia cắt các vòng tường khép kín của game.nav (lib.mjs → __inv.inside).
// Dùng: node tools/qa/mount.mjs [x1] [x2] [x3]
import { launch, openGame, Report, invariantHelper, fx } from './lib.mjs';

const want = (k) => process.argv.length <= 2 || process.argv.slice(2).includes(k);
const R = new Report('mount');
const browser = await launch();
const { page, errors } = await openGame(browser, 'q=low&fresh&lang=vi&h=3', { init: invariantHelper, norender: true, start: 'click' });
await page.evaluate(async () => {
  window.__norender = true; await window.__qa.virtual(); window.__qa.step(5);
  const g = window.__game, n = g.nav, Q = window.__qa, I = window.__inv;
  const minDist = (x, z, r) => { let best = r; n.eachSeg(x, z, r, (s, i) => { if (!(s[i + 4] >= 0.5)) return; const ex = s[i + 2] - s[i], ez = s[i + 3] - s[i + 1], l2 = ex * ex + ez * ez, t = l2 > 0 ? Math.max(0, Math.min(1, ((x - s[i]) * ex + (z - s[i + 1]) * ez) / l2)) : 0, d = Math.hypot(s[i] + ex * t - x, s[i + 1] + ez * t - z); if (d < best) best = d; }); return best; };
  window.__mt = {
    async go(x, z, yaw) { g.warp(x, z, yaw); for (let i = 0; i < 8000; i++) { Q.step(1); if (!g.warping && g.chunks.missingNear(x, z, 150)[0] === 0 && g.chunks.pending.size === 0) break; await Q.sleep(4); } Q.step(20); },
    // điểm giữa các đoạn tường nhà dài (≥ 6 m, cao ≥ 4 m) có phía ngoài trống 4 m: trả về điểm trên tường, pháp tuyến chỉ ra NGOÀI
    walls(cx, cz, Rr, nMax) { const out = []; for (const [key, c] of n.chunks) { if (typeof key !== 'number') continue; for (let i = 0; i < c.segs.length; i += 5) { const h = c.segs[i + 4]; if (!(h >= 4)) continue; const ax = c.segs[i], az = c.segs[i + 1], bx = c.segs[i + 2], bz = c.segs[i + 3], L = Math.hypot(bx - ax, bz - az); if (L < 6) continue; const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (Math.hypot(mx - cx, mz - cz) > Rr) continue; const tx = (bx - ax) / L, tz = (bz - az) / L; let nx = tz, nz = -tx; const ia = I.inside(mx + nx * 0.8, mz + nz * 0.8), ib = I.inside(mx - nx * 0.8, mz - nz * 0.8); if (ia === ib) continue; if (ia) { nx = -nx; nz = -nz; }
        let ok = true; for (const d of [1.2, 2.2, 3.5]) if (minDist(mx + nx * d, mz + nz * d, 0.9) < 0.9 || n.isWater(mx + nx * d, mz + nz * d) || I.inside(mx + nx * d, mz + nz * d)) ok = false; if (!ok) continue;
        if (out.every((o) => Math.hypot(o.x - mx, o.z - mz) > 25)) out.push({ x: mx, z: mz, tx, tz, nx, nz, h: +h.toFixed(1), L: +L.toFixed(1) }); } } return out.slice(0, nMax); },
    state() { const P = g.player; return { mode: P.mode, x: +P.pos.x.toFixed(2), z: +P.pos.z.toFixed(2), y: +P.y.toFixed(2), inside: P.y < 2 && I.inside(P.pos.x, P.pos.z), water: P.y < 0.45 && n.isWater(P.pos.x, P.pos.z) && !n.deckAt(P.pos.x, P.pos.z, 0.6), bike: [+P.bikePos.x.toFixed(2), +P.bikePos.z.toFixed(2)], bikeInside: I.inside(P.bikePos.x, P.bikePos.z), bikeWater: n.isWater(P.bikePos.x, P.bikePos.z) && !n.deckAt(P.bikePos.x, P.bikePos.z, 0.6) && !(n.groundY(P.bikePos.x, P.bikePos.z, P.y) > 0.7) /* trên mặt cầu nâng thì không phải dưới nước */ }; },
  };
});
const st = () => page.evaluate(() => window.__mt.state());
const pressF = async () => { await page.keyboard.press('KeyF'); await page.evaluate(() => window.__qa.step(6)); return st(); };

// ===== x1: xuống xe sát tường =====
if (want('x1')) {
  const rows = [];
  for (const [area, cx, cz] of [['Bờ Hồ', 114, -212], ['phố cổ', -100, -700], ['phố Pháp', 300, 500]]) {
    await page.evaluate(([x, z]) => window.__mt.go(x, z, 0), [cx, cz]);
    const walls = await page.evaluate(([x, z]) => window.__mt.walls(x, z, 300, 8), [cx, cz]);
    for (const w of walls) for (const side of ['trai', 'phai']) for (const gap of [0.45, 0.6]) {
      // "bên trái của mũi xe h" = (hz, −hx). Tường nằm về phía −n (n chỉ ra ngoài). Muốn tường bên trái: h = (nz, −nx).
      const sg = side === 'trai' ? 1 : -1, hx = w.nz * sg, hz = -w.nx * sg;
      await page.evaluate(([w, gap, yaw]) => { const g = window.__game, P = g.player; g.input.keys.clear(); if (P.mode === 'bike') { P.speed = 0; P.toggleBike(); } P.teleport(w.x + w.nx * 3, w.z + w.nz * 3, yaw, false); P.toggleBike(); window.__qa.step(70); P.teleport(w.x + w.nx * gap, w.z + w.nz * gap, yaw, false); P.speed = 0; g.cam.snap(P); window.__qa.step(20); }, [w, gap, Math.atan2(hx, hz)]);
      const b = await st(); if (b.mode !== 'bike' || b.inside) { rows.push({ area, side, gap, setup: 'hỏng', b }); continue; }
      const a = await pressF();
      // nếu đã lọt vào trong: thử đi ra theo 8 hướng (W thật, 3 giây mỗi hướng), xem có thoát được không
      let escaped = null; if (a.inside) { escaped = false; for (let k = 0; k < 8 && !escaped; k++) { await page.evaluate(([yaw]) => { const g = window.__game; g.cam.yaw = yaw; g.input.lastLook = performance.now(); window.__qa.step(2); }, [(k / 8) * Math.PI * 2]); await page.keyboard.down('KeyW'); await page.evaluate(() => window.__qa.step(180)); await page.keyboard.up('KeyW'); if (!(await st()).inside) escaped = true; } }
      rows.push({ area, side, gap, wall: [fx(w.x, 1), fx(w.z, 1)], h: w.h, after: a, escaped });
    }
  }
  const L = rows.filter((r) => r.side === 'trai' && !r.setup), Rr = rows.filter((r) => r.side === 'phai' && !r.setup), inL = L.filter((r) => r.after.inside), inR = Rr.filter((r) => r.after.inside);
  R.check('x1 tiền đề: đặt được xe sát tường ở ≥ 12 bức tường', L.length >= 24 && rows.filter((r) => r.setup).length === 0, `${L.length / 2} bức tường, ${rows.filter((r) => r.setup).length} lần đặt xe hỏng`);
  R.check('x1: xuống xe (F) khi xe dựng song song sát tường nhà, tường bên TRÁI xe: nhân vật không bị đặt vào trong lòng nhà', inL.length === 0, `${inL.length}/${L.length} lần lọt vào trong nhà (xe cách tường 0,45 m: ${inL.filter((r) => r.gap === 0.45).length}/${L.length / 2}; 0,6 m: ${inL.filter((r) => r.gap === 0.6).length}/${L.length / 2}); trong đó ${inL.filter((r) => r.escaped === false).length} lần KHÔNG đi ra được (kẹt hẳn trong nhà); ví dụ: ${JSON.stringify(inL.slice(0, 2).map((r) => ({ khu: r.area, tuong: r.wall, caoTuong: r.h, xeCachTuong: r.gap, nhanVatSauKhiXuong: [r.after.x, r.after.z], thoatDuoc: r.escaped })))}`);
  R.check('x1 (đối chứng): tường bên PHẢI xe: xuống xe không lọt vào nhà', inR.length === 0, `${inR.length}/${Rr.length}`);
}

// ===== x2: đi nhanh tới 44 điểm rồi lên xe ngay =====
if (want('x2')) {
  const items = await page.evaluate(() => { const g = window.__game; const all = g.passport.items.map((it) => ({ id: it.id, x: it.x, z: it.z, s: it.s || [it.x, it.z], solemn: !!it.solemn })); const out = []; let cur = { x: g.player.pos.x, z: g.player.pos.z }; while (all.length) { all.sort((a, b) => Math.hypot(a.x - cur.x, a.z - cur.z) - Math.hypot(b.x - cur.x, b.z - cur.z)); cur = all.shift(); out.push(cur); } return out; });
  const bad = [], rows = []; let forbidden = 0;
  for (const it of items) {
    await page.evaluate(async (it) => { const g = window.__game, P = g.player; g.input.keys.clear(); if (P.mode === 'bike') { P.speed = 0; P.toggleBike(); } const far = Math.hypot(it.x - it.s[0], it.z - it.s[1]) > 1.5; await window.__mt.go(it.s[0], it.s[1], far ? Math.atan2(it.x - it.s[0], it.z - it.s[1]) : undefined); }, it);
    const b = await st(), a = await pressF();
    const row = { id: it.id, truoc: [b.x, b.z], xeDung: b.bike, xeTrongNha: b.bikeInside, xeDuoiNuoc: b.bikeWater, sauF: a.mode, o: [a.x, a.z], trongNha: a.inside, duoiNuoc: a.water };
    rows.push(row); if (a.mode !== 'bike') forbidden++;
    if (a.inside || a.water || b.inside || b.water) bad.push(row);
  }
  const bikeIn = rows.filter((r) => r.xeTrongNha || r.xeDuoiNuoc);
  R.check('x2: đi nhanh tới từng điểm trong 44 điểm rồi bấm F lên xe: nhân vật không nằm trong lòng nhà, không dưới nước', bad.length === 0, `${bad.length}/44 hỏng: ${JSON.stringify(bad.slice(0, 4))}; ${forbidden} điểm thuộc khu cấm xe (không lên xe được)`);
  R.check('x2: sau khi đi nhanh, chiếc xe dựng cạnh nhân vật không nằm trong lòng nhà hay dưới nước', bikeIn.length === 0, `${bikeIn.length}/44: ${bikeIn.map((r) => `${r.id} ${r.xeTrongNha ? '(trong nhà)' : '(dưới nước)'}`).join(', ')}`);
}

// ===== x3: đi nhanh tới một chỗ sát tường rồi lên xe =====
// Game dựng xe cách nhân vật 1,1 m về bên TRÁI mỗi lần đi nhanh (đo được: xem toạ độ "xeDung" bên dưới); bấm F thì nhân vật được đưa
// tới chỗ xe. Vậy trường hợp nguy hiểm là tường (hoặc nước) nằm bên trái nhân vật trong vòng 1,1 m. Đối chứng: tường bên phải.
if (want('x3')) {
  await page.evaluate(([x, z]) => window.__mt.go(x, z, 0), [114, -212]);
  const walls = await page.evaluate(() => window.__mt.walls(114, -212, 320, 12));
  const rows = [];
  for (const w of walls) for (const side of ['trai', 'phai']) for (const gap of [0.4, 0.7, 1.0]) {
    // "bên trái của h" = (hz, −hx). Tường ở phía −n. Tường bên trái: h = (nz, −nx); tường bên phải: h = (−nz, nx).
    const sg = side === 'trai' ? 1 : -1, hx = w.nz * sg, hz = -w.nx * sg;
    await page.evaluate(async ([w, gap, yaw]) => { const g = window.__game, P = g.player; g.input.keys.clear(); if (P.mode === 'bike') { P.speed = 0; P.toggleBike(); } await window.__mt.go(w.x + w.nx * gap, w.z + w.nz * gap, yaw); }, [w, gap, Math.atan2(hx, hz)]);
    const b = await st(), a = await pressF();
    let escaped = null; if (a.inside) { escaped = false; for (let k = 0; k < 8 && !escaped; k++) { await page.evaluate(([yaw]) => { const g = window.__game; g.cam.yaw = yaw; g.input.lastLook = performance.now(); window.__qa.step(2); }, [(k / 8) * Math.PI * 2]); await page.keyboard.down('KeyW'); await page.evaluate(() => window.__qa.step(180)); await page.keyboard.up('KeyW'); if (!(await st()).inside) escaped = true; } }
    rows.push({ side, gap, wall: [fx(w.x, 1), fx(w.z, 1)], b, a, escaped });
  }
  const L = rows.filter((r) => r.side === 'trai'), Rr = rows.filter((r) => r.side === 'phai'), inL = L.filter((r) => r.a.inside), inR = Rr.filter((r) => r.a.inside), bikeIn = L.filter((r) => r.b.bikeInside);
  R.check('x3: đi nhanh tới chỗ đứng sát tường nhà (tường bên TRÁI, cách 0,4 / 0,7 / 1,0 m): chiếc xe game dựng cạnh nhân vật không nằm trong lòng nhà', L.length >= 18 && bikeIn.length === 0, `${bikeIn.length}/${L.length} lần xe nằm trong nhà (theo khoảng cách tới tường: ${[0.4, 0.7, 1.0].map((g) => `${g} m: ${bikeIn.filter((r) => r.gap === g).length}/${L.filter((r) => r.gap === g).length}`).join(', ')})`);
  R.check('x3: … rồi bấm F lên xe: nhân vật không bị đưa vào trong lòng nhà', L.length >= 18 && inL.length === 0, `${inL.length}/${L.length} lần lọt vào nhà (${[0.4, 0.7, 1.0].map((g) => `${g} m: ${inL.filter((r) => r.gap === g).length}/${L.filter((r) => r.gap === g).length}`).join(', ')}); đi xe ra được: ${inL.filter((r) => r.escaped).length}/${inL.length}; ví dụ: ${JSON.stringify(inL.slice(0, 2).map((r) => ({ tuong: r.wall, dungCachTuong: r.gap, truocF: [r.b.x, r.b.z], xeDung: r.b.bike, sauF: [r.a.x, r.a.z], thoatDuoc: r.escaped })))}`);
  R.check('x3 (đối chứng): tường bên PHẢI: lên xe không lọt vào nhà', inR.length === 0, `${inR.length}/${Rr.length}`);
}
R.check('không có pageerror / console.error', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close();
process.exit(R.finish());
