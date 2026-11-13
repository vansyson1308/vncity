// MỤC 3 (bổ sung, tìm ra nhờ fuzz hạt giống 1, bước 177–178): MÉP NƯỚC.
// Yêu cầu: nhân vật không bao giờ đứng trên mặt nước ("vật lý như ngoài đời"). Bờ hồ phải chặn người đi bộ và xe ở mọi cách tiếp cận:
//   s1) đi bộ thẳng vào bờ;     s2) chạy xe hết ga vào bờ (cả khi khung hình giật 20 khung/giây);
//   s3) dựng xe song song sát mép nước rồi bấm F xuống xe (game cho nhân vật bước xuống bên trái xe 0,75 m);
//   s4) nếu đã lọt ra phía nước: thử đi tiếp ra giữa hồ.
// Đo: nhân vật có nằm trong đa giác mặt nước của bản đồ không (nav.isWater), và sâu bao nhiêu mét tính từ mép đa giác (tự tính ở đây).
// Chỗ thử: các đoạn bờ quanh Hồ Gươm, Hồ Tây, hồ Trúc Bạch lấy từ dữ liệu va chạm của game.nav (đoạn có cao độ âm).
// Dùng: node tools/qa/shore.mjs
import { launch, openGame, Report, invariantHelper, fx } from './lib.mjs';

const R = new Report('shore');
const browser = await launch();
const { page, errors } = await openGame(browser, 'q=low&fresh&lang=vi&h=3', { init: invariantHelper, norender: true, start: 'click' });
await page.evaluate(async () => {
  window.__norender = true; await window.__qa.virtual(); window.__qa.step(5);
  const g = window.__game, n = g.nav, W = g.world, Q = window.__qa;
  // độ sâu vào trong đa giác mặt nước: 0 nếu ở ngoài; ngược lại là khoảng cách tới mép đa giác gần nhất
  const depth = (x, z) => { if (!n.isWater(x, z)) return 0; let best = 1e9; for (const w of W.water) { if (x < w.bb[0] - 60 || x > w.bb[2] + 60 || z < w.bb[1] - 60 || z > w.bb[3] + 60) continue; for (const p of [w.p, ...w.holes]) for (let i = 0, m = p.length; i < m; i += 2) { const ax = p[i], az = p[i + 1], ex = p[(i + 2) % m] - ax, ez = p[(i + 3) % m] - az, l2 = ex * ex + ez * ez, t = l2 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)) : 0, d = Math.hypot(ax + ex * t - x, az + ez * t - z); if (d < best) best = d; } } return best; };
  window.__sh = {
    depth,
    async go(x, z) { g.warp(x, z, 0); for (let i = 0; i < 8000; i++) { Q.step(1); if (!g.warping && g.chunks.missingNear(x, z, 200)[0] === 0 && g.chunks.pending.size === 0) break; await Q.sleep(4); } Q.step(3); },
    // các đoạn bờ (cao độ âm trong nav) quanh (cx,cz): trả về điểm giữa đoạn, hướng dọc bờ và pháp tuyến chỉ về phía ĐẤT
    shores(cx, cz, Rr, nMax) { const out = []; for (const [, c] of n.chunks) for (let i = 0; i < c.segs.length; i += 5) { if (!(c.segs[i + 4] < 0)) continue; const ax = c.segs[i], az = c.segs[i + 1], bx = c.segs[i + 2], bz = c.segs[i + 3], L = Math.hypot(bx - ax, bz - az); if (L < 5) continue; const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (Math.hypot(mx - cx, mz - cz) > Rr) continue; const tx = (bx - ax) / L, tz = (bz - az) / L; let nx = tz, nz = -tx; const wa = n.isWater(mx + nx * 1.5, mz + nz * 1.5), wb = n.isWater(mx - nx * 1.5, mz - nz * 1.5); if (wa === wb) continue; if (wa) { nx = -nx; nz = -nz; } // pháp tuyến về phía đất
        // phía đất phải trống 6 m (không tường, không nhà, không phải cầu) để phép thử chỉ đo riêng mép nước
        let ok = true; for (const d of [0.6, 1.5, 3, 5]) if (!n.clearAt(mx + nx * d, mz + nz * d, 0.5) || n.isWater(mx + nx * d, mz + nz * d) || window.__inv.inside(mx + nx * d, mz + nz * d, 0.5) || n.deckAt(mx + nx * d, mz + nz * d, 1)) ok = false; if (!ok || n.deckAt(mx, mz, 3)) continue;
        if (out.every((o) => Math.hypot(o.x - mx, o.z - mz) > 35)) out.push({ x: mx, z: mz, tx, tz, nx, nz, L: +L.toFixed(1) }); }
      return out.slice(0, nMax); },
    setWalk(x, z, yaw) { const P = g.player; g.input.keys.clear(); if (P.mode === 'bike') { P.speed = 0; P.toggleBike(); } P.teleport(x, z, yaw, false); g.cam.yaw = yaw + Math.PI; g.cam.pitch = 0.16; g.input.lastLook = performance.now() - 60000; Q.step(10); },
    track(frames, dt = 1000 / 60) { const P = g.player; let maxDepth = 0, at = null, wet = 0; for (let i = 0; i < frames; i++) { Q.step(1, dt); const d = P.y < 0.45 ? depth(P.pos.x, P.pos.z) : 0; if (d > 0) wet++; if (d > maxDepth) { maxDepth = d; at = [+P.pos.x.toFixed(1), +P.pos.z.toFixed(1)]; } } return { maxDepth, at, wet, end: [P.pos.x, P.pos.z, P.y], v: P.speed, mode: P.mode }; },
  };
});

const rows = [];
for (const [lake, cx, cz, Rr] of [['Hồ Gươm (bờ nam)', 60, 300, 260], ['Hồ Gươm (bờ bắc)', 60, -250, 260], ['Hồ Trúc Bạch', -1000, -1850, 330], ['Hồ Tây', -1500, -2150, 330]]) {
  await page.evaluate(([x, z]) => window.__sh.go(x, z), [cx, cz]);
  const shores = await page.evaluate(([x, z, r]) => window.__sh.shores(x, z, r, 5), [cx, cz, Rr]);
  R.note(`${lake}: ${shores.length} đoạn bờ thử được`);
  for (const s of shores) {
    const row = { lake, at: [fx(s.x, 1), fx(s.z, 1)] };
    // s1: đi bộ thẳng vào bờ từ 4 m (giữ W thật 6 giây), rồi chạy (Shift)
    for (const [key, run] of [['s1_diBo', false], ['s1_chay', true]]) {
      await page.evaluate(([s]) => window.__sh.setWalk(s.x + s.nx * 4, s.z + s.nz * 4, Math.atan2(-s.nx, -s.nz)), [s]);
      if (run) await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
      const r = await page.evaluate(() => window.__sh.track(360)); await page.keyboard.up('KeyW'); if (run) await page.keyboard.up('ShiftLeft');
      row[key] = fx(r.maxDepth);
    }
    // s2: chạy xe hết ga vào bờ từ 30 m (nếu phía đất đủ trống), ở 60 và 20 khung hình/giây
    for (const [key, dt] of [['s2_xe60', 1000 / 60], ['s2_xe20', 50]]) {
      const ok = await page.evaluate(([s]) => { const g = window.__game, n = g.nav; let far = 4; for (const d of [8, 12, 16, 20, 25, 30]) { if (!n.clearAt(s.x + s.nx * d, s.z + s.nz * d, 0.8) || n.isWater(s.x + s.nx * d, s.z + s.nz * d)) break; far = d; } window.__sh.setWalk(s.x + s.nx * far, s.z + s.nz * far, Math.atan2(-s.nx, -s.nz)); return far; }, [s]);
      await page.keyboard.press('KeyF'); await page.evaluate(() => window.__qa.step(70));
      await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
      const r = await page.evaluate(([dt]) => window.__sh.track(Math.round(7000 / dt), dt), [dt]); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
      row[key] = fx(r.maxDepth); row[key + '_tu'] = ok;
      await page.evaluate(() => { const P = window.__game.player; P.speed = 0; if (P.mode === 'bike') P.toggleBike(); window.__qa.step(5); });
    }
    // s3: xe dựng song song mép nước, cách mép gap mét; bấm F xuống xe. Rồi s4: giữ W đi tiếp ra phía nước 8 giây.
    // Hai chiều đỗ: bên TRÁI xe là nước (game cho nhân vật bước xuống bên trái) và, để đối chứng, bên PHẢI xe là nước.
    for (const side of ['trai', 'phai']) for (const gap of [0.45, 0.6, 0.9]) {
      // "bên trái của mũi xe h" = (hz, −hx) (cùng quy ước đã đo ở controls.mjs). Muốn bên trái chỉ về phía nước (−n) thì h = (nz, −nx).
      const sg = side === 'trai' ? 1 : -1, hx = s.nz * sg, hz = -s.nx * sg;
      await page.evaluate(([s, gap, yaw]) => { const g = window.__game, P = g.player; window.__sh.setWalk(s.x + s.nx * 3, s.z + s.nz * 3, yaw); P.toggleBike(); window.__qa.step(70); P.teleport(s.x + s.nx * gap, s.z + s.nz * gap, yaw, false); P.speed = 0; g.cam.snap(P); window.__qa.step(20); }, [s, gap, Math.atan2(hx, hz)]);
      const before = await page.evaluate(([s]) => { const P = window.__game.player, hx = Math.sin(P.yaw), hz = Math.cos(P.yaw); return { mode: P.mode, depth: window.__sh.depth(P.pos.x, P.pos.z), leftToWater: -(hz * s.nx - hx * s.nz), toShore: (P.pos.x - s.x) * s.nx + (P.pos.z - s.z) * s.nz }; }, [s]);
      if (before.mode !== 'bike' || Math.abs(before.leftToWater - sg) > 0.05) { row.s3_loiDatXe = JSON.stringify(before); continue; }
      await page.keyboard.press('KeyF');
      const after = await page.evaluate(() => { window.__qa.step(5); const P = window.__game.player; return { mode: P.mode, depth: P.y < 0.45 ? window.__sh.depth(P.pos.x, P.pos.z) : 0, pos: [+P.pos.x.toFixed(2), +P.pos.z.toFixed(2)], y: P.y }; });
      // s4: quay mặt ra phía nước, đi tiếp
      await page.evaluate(([s]) => { const g = window.__game; g.cam.yaw = Math.atan2(-s.nx, -s.nz) + Math.PI; g.input.lastLook = performance.now(); window.__qa.step(3); }, [s]);
      await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
      const r = await page.evaluate(() => window.__sh.track(480)); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
      row[`s3_${side}_${gap}`] = fx(after.depth); row[`s4_${side}_${gap}`] = fx(r.maxDepth); if (r.maxDepth > 1 && !row.s4_toi) { row.s4_toi = r.at; row.s4_xuongTai = after.pos; }
      row[`s3_${side}_${gap}_xeCachMep`] = fx(before.toShore);
    }
    rows.push(row); console.log('   ' + JSON.stringify(row));
  }
}
const mx = (k) => Math.max(0, ...rows.map((r) => r[k] || 0)), cnt = (k, lim) => rows.filter((r) => (r[k] || 0) > lim).length;
R.check('s0: đủ chỗ thử (≥ 8 đoạn bờ ở ≥ 3 hồ)', rows.length >= 8 && new Set(rows.map((r) => r.lake.split(' (')[0])).size >= 3, `${rows.length} đoạn bờ`);
R.check('s1: đi bộ và chạy thẳng vào bờ: không vào mặt nước quá 0,1 m', mx('s1_diBo') <= 0.1 && mx('s1_chay') <= 0.1, `sâu nhất: đi bộ ${mx('s1_diBo')} m, chạy ${mx('s1_chay')} m`);
R.check('s2: chạy xe hết ga vào bờ (60 và 20 khung hình/giây): không vào mặt nước quá 0,1 m', mx('s2_xe60') <= 0.1 && mx('s2_xe20') <= 0.1, `sâu nhất: 60 khung/giây ${mx('s2_xe60')} m (${cnt('s2_xe60', 0.1)}/${rows.length} đoạn), 20 khung/giây ${mx('s2_xe20')} m (${cnt('s2_xe20', 0.1)}/${rows.length} đoạn)`);
const G3 = [0.45, 0.6, 0.9];
for (const [side, label] of [['trai', 'bên TRÁI xe là nước'], ['phai', 'bên PHẢI xe là nước (đối chứng)']]) {
  const s3 = G3.map((g) => `xe cách mép ${g} m: ${cnt(`s3_${side}_${g}`, 0.1)}/${rows.length} đoạn, sâu nhất ${mx(`s3_${side}_${g}`)} m`);
  R.check(`s3: xuống xe (F) khi xe dựng song song sát mép nước, ${label}: nhân vật không bị đặt xuống mặt nước (sâu quá 0,1 m)`, G3.every((g) => mx(`s3_${side}_${g}`) <= 0.1), s3.join('; '));
  const s4 = G3.map((g) => `xe cách mép ${g} m: ${cnt(`s4_${side}_${g}`, 1)}/${rows.length} đoạn ra được quá 1 m, xa nhất ${mx(`s4_${side}_${g}`)} m`);
  const ex = rows.find((r) => r.s4_toi);
  R.check(`s4: sau khi xuống xe như trên (${label}), giữ Shift+W về phía hồ 8 giây: không đi được ra mặt hồ (sâu quá 1 m tính từ mép nước)`, G3.every((g) => mx(`s4_${side}_${g}`) <= 1), s4.join('; ') + (ex && side === 'trai' ? `; ví dụ: bờ ${JSON.stringify(ex.at)}, xuống xe đứng tại ${JSON.stringify(ex.s4_xuongTai)}, đi ra tới ${JSON.stringify(ex.s4_toi)}` : ''));
}
const setupBad = rows.filter((r) => r.s3_loiDatXe).length; if (setupBad) R.check('s3 tiền đề: đặt được xe đúng hướng ở mọi đoạn bờ', false, `${setupBad} đoạn đặt xe sai: ${rows.find((r) => r.s3_loiDatXe).s3_loiDatXe}`);
R.check('không có pageerror / console.error', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close();
process.exit(R.finish());
