// Kiểm tra dòng xe bằng số (không cần trình duyệt): chạy đúng mô-đun mô phỏng của game (src/actors/trafficsim.js) ở vài con phố,
// vài khung giờ rồi báo cơ cấu xe, tốc độ, số xe quanh người chơi, số lần kẹt, số cặp xe chồng lên nhau, và thử cho người chơi
// bước đều qua đường xem dòng xe có tự né không. Dùng: node tools/traffic_check.mjs [low|medium|high]   (mã thoát 1 nếu lệch)
import fs from 'node:fs';
import { decodeWorld } from '../src/world/data.js';
import { Nav } from '../src/world/nav.js';
import { QUALITY } from '../src/config.js';
import { TrafficSim, TYPES, VT } from '../src/actors/trafficsim.js';

const world = decodeWorld(JSON.parse(fs.readFileSync(new URL('../public/world/hanoi.json', import.meta.url), 'utf8')), { withBuildings: false });
new Nav(world); // gắn cờ veh/skip cho đường
const q = QUALITY[process.argv[2] || 'medium'];
const street = (name, along = 0.5) => { const rs = world.roads.filter((r) => world.names[r.name] === name).sort((a, b) => b.len - a.len), r = rs[0], p = r.p, i = Math.floor((p.length / 2 - 1) * along) * 2, j = Math.min(i + 2, p.length - 2); return { x: p[i], z: p[i + 1], yaw: Math.atan2(p[j] - p[Math.max(0, j - 2)], p[j + 1] - p[Math.max(1, j - 1)]), w: r.w }; };
const SCENES = [['Phố Hàng Đào 17:12', street('Phố Hàng Đào'), 17.2], ['Phố Đinh Tiên Hoàng 20:30', street('Phố Đinh Tiên Hoàng'), 20.5], ['Hồ Gươm 6:12', { x: 60, z: -120, yaw: 0, w: 7 }, 6.2],
  ['Phố Tràng Tiền 8:00', street('Phố Tràng Tiền'), 8], ['Phố Lý Thường Kiệt 17:30', street('Phố Lý Thường Kiệt'), 17.5], ['Phố Hàng Bạc 11:00', street('Phố Hàng Bạc'), 11], ['Đường Điện Biên Phủ 9:00', street('Đường Điện Biên Phủ'), 9], ['Phố Hàng Mã 2:00', street('Phố Hàng Mã'), 2]];
const CLS = ['xe máy', 'ô tô', 'buýt', 'xe chậm'], NAME = Object.keys(VT), only = process.argv.find((a) => a.startsWith('--only='));
let bad = 0;
const check = (ok, msg) => { if (!ok) { bad++; console.log('   ✗ ' + msg); } };
for (const [name, at, hours] of SCENES) {
  if (only && !name.includes(only.slice(7))) continue;
  const sim = new TrafficSim(world, q), player = { pos: { x: at.x, z: at.z }, y: 0, yaw: at.yaw, speed: 0, mode: 'walk', passenger: false, wobble: 0 };
  const cam = { x: at.x - Math.sin(at.yaw) * 5, z: at.z - Math.cos(at.yaw) * 5, fx: Math.sin(at.yaw), fz: Math.cos(at.yaw) };
  sim.prewarm(player, cam, hours);
  const dt = 1 / 30, steps = 90 * 30, cnt = [0, 0, 0, 0], spd = [0, 0, 0, 0], byType = new Array(TYPES.length).fill(0); let near60 = 0, near30 = 0, simMs = 0, overlap = 0, offroad = 0, stopped = 0, samples = 0, hail = 0, pill = 0, taxi = 0, ev = 0, t0 = performance.now();
  const u0 = sim.stats.unstuck, r0 = sim.stats.removed, h0 = sim.stats.hits, hitLog = [];
  // nửa sau bài thử: người chơi bước đều qua lại ngang đường (1,4 m/s), đếm số khung hình bị xe chạm vào
  let touchFrames = 0, crossFrames = 0, stop1 = 0, tot1 = 0, atRed = 0; const rx = Math.cos(at.yaw), rz = -Math.sin(at.yaw), half = at.w / 2 + 1; let side = -half, dirS = 1;
  for (let i = 0; i < steps; i++) {
    const crossing = i > steps / 2;
    if (crossing) { side += dirS * 1.4 * dt; if (Math.abs(side) > half) dirS = -dirS; const bx = player.pos.x, bz = player.pos.z; player.pos.x = at.x + rx * side; player.pos.z = at.z + rz * side; player.yaw = Math.atan2(rx * dirS, rz * dirS); player.speed = 1.4;
      const hb = sim.stats.hits; sim.step(dt, player, cam, hours); crossFrames++; if (sim.stats.hits > hb && hitLog.length < 6) { const h = sim.lastHit; hitLog.push(`${NAME[h.type]} v=${h.v.toFixed(1)} f=${h.f.toFixed(1)} s=${h.s.toFixed(1)} lat=${h.lat.toFixed(1)}→${h.latT.toFixed(1)} w=${h.w} side=${side.toFixed(1)} dir=${dirS}`); }
      if (Math.hypot(player.pos.x - (at.x + rx * side), player.pos.z - (at.z + rz * side)) > 1e-6) touchFrames++; void bx; void bz;
    } else { const ts = performance.now(); sim.step(dt, player, cam, hours); simMs += performance.now() - ts; }
    if (i % 15) continue;
    samples++;
    const A = sim.agents;
    for (const a of A) {
      if (a.x > 1e8) continue;
      cnt[a.cls]++; spd[a.cls] += a.v; byType[a.type]++; if (a.v < 0.3 && !a.red) stopped++; if (a.red) atRed++; if (!crossing) { tot1++; if (a.v < 0.3 && !a.red) stop1++; }
      if ((a.x - at.x) ** 2 + (a.z - at.z) ** 2 < 3600) near60++; if ((a.x - at.x) ** 2 + (a.z - at.z) ** 2 < 900) near30++;
      if (Math.abs(a.lat) > a.e.w / 2 - a.r + 0.05) offroad++;
      if (a.hail) hail++; if (a.pill) pill++; if (a.taxi) { taxi++; if (a.type === VT.hatch) ev++; }
    }
    for (let k = 0; k < A.length; k++) for (let j = k + 1; j < A.length; j++) { const a = A[k], b = A[j]; if (a.x > 1e8 || b.x > 1e8 || Math.abs(a.y - b.y) > 2) continue; const d = Math.hypot(a.x - b.x, a.z - b.z); if (d < 0.36) overlap++; }
  }
  const ms = simMs / (steps / 2 + 1), tot = cnt.reduce((s, v) => s + v, 0) || 1;
  console.log(`\n${name}  (mật độ ${sim.density.toFixed(2)}, ${sim.near.length} cạnh quanh đó)`);
  console.log(`   số xe trung bình ${(tot / samples).toFixed(0)} (trong 60 m: ${(near60 / samples).toFixed(0)}, trong 30 m: ${(near30 / samples).toFixed(0)}), cơ cấu: ${CLS.map((c, i) => `${c} ${((cnt[i] / tot) * 100).toFixed(1)}%`).join(', ')}`);
  console.log(`   tốc độ trung bình (km/h): ${CLS.map((c, i) => `${c} ${cnt[i] ? ((spd[i] / cnt[i]) * 3.6).toFixed(1) : '-'}`).join(', ')}; đang đứng yên ${((stopped / tot) * 100).toFixed(1)}% (lúc chưa ai qua đường: ${((stop1 / Math.max(1, tot1)) * 100).toFixed(1)}%), chờ đèn đỏ ${((atRed / tot) * 100).toFixed(1)}%`);
  console.log(`   loại: ${NAME.map((n, i) => `${n} ${(byType[i] / samples).toFixed(1)}`).join(', ')}`);
  console.log(`   xe ôm công nghệ ${((hail / Math.max(1, cnt[0])) * 100).toFixed(0)}% xe máy, chở khách ${((pill / Math.max(1, cnt[0])) * 100).toFixed(0)}%; taxi ${(taxi / samples).toFixed(1)} chiếc, trong đó điện ${taxi ? ((ev / taxi) * 100).toFixed(0) : '-'}%`);
  console.log(`   co mình gỡ kẹt ${sim.stats.unstuck - u0} lần, huỷ ${sim.stats.removed - r0} xe, đè lên nhau (tâm cách dưới 36 cm) ${overlap} lần, lấn mép ${offroad} lần; người chơi bước qua đường ${(crossFrames * dt * 1.4 / (2 * half)).toFixed(0)} lượt: bị xe đang chạy tông ${sim.stats.hits - h0} lần (chạm ${touchFrames}/${crossFrames} khung hình); ${(ms * 1000).toFixed(0)} µs/bước`);
  check(offroad === 0, 'có xe lấn ra ngoài lòng đường');
  check(overlap <= 150, `xe đè lên nhau ${overlap} lần (hàng chờ đèn đỏ dồn lên nhau?)`);
  check(ms < 1.2, `mô phỏng chậm: ${ms.toFixed(2)} ms mỗi bước`);
  if (sim.zone === 1 && sim.density > 0.5) check(cnt[0] / tot > 0.78 && cnt[0] / tot < 0.9, `tỉ lệ xe máy phố cổ ${(cnt[0] / tot * 100).toFixed(0)}% (cần 80-85%)`);
  if (sim.density > 0.5) check(stop1 / Math.max(1, tot1) < 0.12, 'quá nhiều xe đứng yên khi không ai cản (tắc)'); // nút Tràng Tiền - Hàng Bài giờ cao điểm đông thật, nhưng không được khoá cứng
  if (process.argv.includes('--hits')) for (const h of hitLog) console.log('      ' + h);
  check(sim.stats.hits - h0 <= 3, 'xe đang chạy tông vào người chơi đang bước đều qua đường quá nhiều'); // người thử bước mù, không tránh xe: vài lần quệt nhẹ là chấp nhận được
}
if (bad) { console.error(`\n${bad} phép thử dòng xe không đạt`); process.exit(1); }
console.log('\nDòng xe đạt.');
