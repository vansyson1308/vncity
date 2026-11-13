// MỤC 8: THỜI GIAN VÀ BẦU TRỜI. Quét 24 giờ (mỗi giờ một khung hình vẽ thật) ở 3 nơi: phố cổ (Phố Hàng Đào), mặt cầu Chương Dương,
// Ba Đình (Đường Điện Biên Phủ), mức chất lượng "low", khung 480×270, nhìn dọc theo phố/cầu.
// Phép đo (trên khung hình thu về 96×54, độ chói Rec.709 0…255):
//   t1) độ sáng trung bình của cả khung hình không bao giờ dưới 6 và không vượt 245;
//   t2) "cảnh xa ban đêm không đen kịt" (BUG-04 cũ): với các giờ đêm 20, 21, …, 4: xét DẢI CHÂN TRỜI, là các hàng điểm ảnh từ 30% tới 55%
//       chiều cao khung (nơi dãy phố xa và trời gặp nhau khi camera nhìn ngang): độ sáng trung bình của dải ≥ 5, và không quá 60% điểm
//       ảnh của dải là "đen kịt" (độ chói < 4);
//   t3) (phụ) ban ngày (9 đến 15 giờ) khung hình sáng hơn ban đêm (0 đến 3 giờ) ít nhất 1,3 lần: chu kỳ ngày đêm thật sự đổi ánh sáng;
//   t4) (phụ) độ sáng đổi liền mạch: trong giờ đổi nhanh nhất, đo lại từng 6 phút giờ game, mỗi bước không chênh quá 30 đơn vị;
//   t5) phơi sáng (sky.exposure) hữu hạn ở mọi giờ.
// Giờ được đặt bằng sky.setHours (đúng hàm mà phím N gọi). Dùng: node tools/qa/sky.mjs
import path from 'node:path';
import { launch, openGame, Report, OUT, fx } from './lib.mjs';

const R = new Report('sky');
const browser = await launch();
const { page, errors } = await openGame(browser, 'q=low&fresh&lang=vi', { viewport: { width: 480, height: 270 }, norender: true });
await page.evaluate(async () => { window.__norender = true; await window.__qa.virtual(); window.__qa.step(5); });
const places = await page.evaluate(() => { const g = window.__game, W = g.world; const mid = (name, pred) => { const r = W.roads.filter((q) => W.names[q.name] === name && (!pred || pred(q))).sort((a, b) => b.len - a.len)[0]; const k = (r.p.length >> 2) << 1, j = Math.min(k + 2, r.p.length - 2); return { name, x: r.p[k], z: r.p[k + 1], yaw: Math.atan2(r.p[j] - r.p[j - 2], r.p[j + 1] - r.p[j - 1]) }; }; return [mid('Phố Hàng Đào'), mid('Cầu Chương Dương', (q) => !(q.flags & 1)), mid('Đường Điện Biên Phủ')]; });
const all = [];
for (const P of places) {
  await page.evaluate(async (P) => { const g = window.__game, Q = window.__qa; g.warp(P.x, P.z, P.yaw); for (let i = 0; i < 8000; i++) { Q.step(1); if (!g.warping && g.chunks.missingNear(P.x, P.z, 250)[0] === 0 && g.chunks.pending.size === 0) break; await Q.sleep(4); } g.cam.snap(g.player); g.cam.pitch = 0.1; Q.step(30); }, P);
  const rows = [];
  for (let h = 0; h < 24; h++) {
    const r = await page.evaluate((h) => { const g = window.__game, Q = window.__qa; g.sky.setHours(h + 0.01); g.cam.yaw = g.player.yaw + Math.PI; g.cam.pitch = 0.1; g.input.lastLook = performance.now(); Q.step(4); window.__norender = false; Q.step(1); window.__norender = true;
      const gl = document.getElementById('game'), c = window.__c2 || (window.__c2 = document.createElement('canvas')); c.width = 96; c.height = 54; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(gl, 0, 0, 96, 54); const d = x.getImageData(0, 0, 96, 54).data;
      let sum = 0, band = 0, bandN = 0, bandBlack = 0, black = 0, max = 0; for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2], row = Math.floor(i / 4 / 96); sum += l; if (l > max) max = l; if (l < 4) black++; if (row >= 16 && row < 30) { band += l; bandN++; if (l < 4) bandBlack++; } }
      return { h, mean: sum / (96 * 54), band: band / bandN, bandBlack: bandBlack / bandN, black: black / (96 * 54), max, exp: g.sky.exposure, night: g.sky.night, y: g.player.y }; }, h);
    rows.push(r);
    if ([0, 3, 12, 21].includes(h)) await page.screenshot({ path: path.join(OUT, `sky_${P.name.replace(/[^A-Za-z]+/g, '')}_${String(h).padStart(2, '0')}.png`) }).catch(() => {});
  }
  // giờ đổi sáng nhanh nhất: đo lại từng 0,1 giờ (6 phút giờ game) để xem có bước nhảy đột ngột không
  { let jump = 0, at = 0; for (let i = 0; i < 24; i++) { const d = Math.abs(rows[(i + 1) % 24].mean - rows[i].mean); if (d > jump) { jump = d; at = i; } }
    const seq = []; for (let k = 0; k <= 10; k++) seq.push(await page.evaluate((h) => { const g = window.__game, Q = window.__qa; g.sky.setHours(h); g.cam.yaw = g.player.yaw + Math.PI; g.cam.pitch = 0.1; g.input.lastLook = performance.now(); Q.step(4); window.__norender = false; Q.step(1); window.__norender = true; const gl = document.getElementById('game'), c = window.__c2; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(gl, 0, 0, 96, 54); const d = x.getImageData(0, 0, 96, 54).data; let sum = 0; for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return sum / (96 * 54); }, at + k / 10));
    P.fine = { at, hour: jump, seq, jump: Math.max(...seq.slice(1).map((v, i) => Math.abs(v - seq[i]))) }; }
  all.push({ P, rows });
  console.log(`   ${P.name}: độ sáng theo giờ ${rows.map((r) => Math.round(r.mean)).join(' ')} | dải chân trời ban đêm ${rows.filter((r) => r.h >= 20 || r.h <= 4).map((r) => `${r.h}h:${fx(r.band, 1)}/${Math.round(r.bandBlack * 100)}%`).join(' ')}`);
}
for (const { P, rows } of all) {
  const lo = rows.reduce((a, b) => (b.mean < a.mean ? b : a)), hi = rows.reduce((a, b) => (b.mean > a.mean ? b : a));
  R.check(`t1 ${P.name}: độ sáng trung bình cả 24 giờ nằm trong 6…245`, lo.mean >= 6 && hi.mean <= 245, `tối nhất ${fx(lo.mean, 1)} lúc ${lo.h} giờ, sáng nhất ${fx(hi.mean, 1)} lúc ${hi.h} giờ`);
  const night = rows.filter((r) => r.h >= 20 || r.h <= 4), badN = night.filter((r) => r.band < 5 || r.bandBlack > 0.6);
  R.check(`t2 ${P.name}: cảnh xa ban đêm không đen kịt (dải chân trời: độ sáng ≥ 5, đen kịt ≤ 60%)`, badN.length === 0, badN.length ? badN.map((r) => `${r.h} giờ: dải ${fx(r.band, 1)}, đen kịt ${fx(r.bandBlack * 100, 0)}%`).join('; ') : `dải tối nhất ${fx(Math.min(...night.map((r) => r.band)), 1)}, đen kịt nhiều nhất ${fx(Math.max(...night.map((r) => r.bandBlack)) * 100, 0)}%`);
  const day = rows.filter((r) => r.h >= 9 && r.h <= 15).reduce((a, r) => a + r.mean, 0) / 7, nt = rows.filter((r) => r.h <= 3).reduce((a, r) => a + r.mean, 0) / 4;
  R.check(`t3 ${P.name}: chu kỳ ngày đêm có đổi ánh sáng thật: ban ngày (9–15 giờ) sáng hơn ban đêm (0–3 giờ) ít nhất 1,3 lần`, day > nt * 1.3, `ngày ${fx(day, 1)}, đêm ${fx(nt, 1)} (gấp ${fx(day / nt, 2)} lần)`);
  R.check(`t4 ${P.name}: độ sáng đổi liền mạch: trong giờ đổi nhanh nhất, mỗi bước 6 phút giờ game (36 giây thật) không chênh quá 30`, P.fine.jump <= 30, `giờ đổi nhanh nhất ${P.fine.at}–${(P.fine.at + 1) % 24} giờ (chênh ${fx(P.fine.hour, 1)}); bước 6 phút chênh lớn nhất ${fx(P.fine.jump, 1)}: ${P.fine.seq.map((v) => Math.round(v)).join(' ')}`);
  R.check(`t5 ${P.name}: phơi sáng hữu hạn và dương ở mọi giờ`, rows.every((r) => Number.isFinite(r.exp) && r.exp > 0), `${fx(Math.min(...rows.map((r) => r.exp)))}…${fx(Math.max(...rows.map((r) => r.exp)))}`);
}
R.check('không có pageerror / console.error', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close();
process.exit(R.finish());
