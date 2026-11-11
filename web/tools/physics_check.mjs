// Kiểm tra vật lý bằng số: mô phỏng xe máy và người bằng đúng mô-đun game dùng (src/actors/physics.js) rồi so với
// số đo ngoài đời của xe số 110 cc. Dùng: node tools/physics_check.mjs   (mã thoát 1 nếu lệch)
import { BIKE, WALK, G0, bikeStep, bikeCurvature, leanFor, bikeMass, wallHit, collide1D, stepUp } from '../src/actors/physics.js';

const dt = 1 / 120; let bad = 0;
const check = (name, v, lo, hi, unit = '') => { const ok = v >= lo && v <= hi; console.log(`${ok ? '✓' : '✗'} ${name}: ${v.toFixed(2)}${unit} (ngoài đời ${lo} đến ${hi}${unit})`); if (!ok) bad++; };
const run = (v0, fn, stop, tMax = 120) => { let v = v0, t = 0, x = 0; while (t < tMax && !stop(v, t, x)) { v = fn(v, t); x += v * dt; t += dt; } return { v, t, x }; };
const kmh = (v) => v * 3.6, m1 = bikeMass(false), m2 = bikeMass(true);

check('Tăng tốc 0 → 40 km/h, mở hết ga, một người', run(0, (v) => bikeStep(v, dt, 1, true, 0, m1), (v) => kmh(v) >= 40).t, 3, 5, ' s');
check('Tăng tốc 0 → 60 km/h, mở hết ga, một người', run(0, (v) => bikeStep(v, dt, 1, true, 0, m1), (v) => kmh(v) >= 60).t, 6.5, 11, ' s');
check('Tăng tốc 0 → 40 km/h, chở khách', run(0, (v) => bikeStep(v, dt, 1, true, 0, m2), (v) => kmh(v) >= 40).t, 4, 7, ' s');
check('Tốc độ tối đa, mở hết ga', kmh(run(0, (v) => bikeStep(v, dt, 1, true, 0, m1), () => false, 90).v), 75, 92, ' km/h');
check('Tốc độ khi giữ ga vừa (đi phố)', kmh(run(0, (v) => bikeStep(v, dt, 1, false, 0, m1), () => false, 90).v), 48, 62, ' km/h');
check('Tốc độ tối đa khi leo dốc cầu 6,5%', kmh(run(0, (v) => bikeStep(v, dt, 1, true, 0, m1, 0.065), () => false, 90).v), 55, 78, ' km/h');
check('Quãng phanh gấp 40 → 0 km/h', run(40 / 3.6, (v) => bikeStep(v, dt, 0, false, 1, m1), (v) => v <= 0).x, 7, 10.5, ' m');
check('Quãng phanh gấp 60 → 0 km/h', run(60 / 3.6, (v) => bikeStep(v, dt, 0, false, 1, m1), (v) => v <= 0).x, 16, 23, ' m');
check('Quãng phanh gấp 40 → 0 km/h, đường ướt', run(40 / 3.6, (v) => bikeStep(v, dt, 0, false, 1, m1, 0, 0, BIKE.muWet), (v) => v <= 0).x, 10.5, 15, ' m');
check('Nhả ga ở 40 km/h, sau 3 giây còn', kmh(run(40 / 3.6, (v) => bikeStep(v, dt, 0, false, 0, m1), (v, t) => t >= 3).v), 22, 32, ' km/h');
check('Thả trôi xuống dốc 6,5% từ đứng yên có ga nhẹ rồi nhả, sau 10 giây', kmh(run(1, (v) => bikeStep(v, dt, 0, false, 0, m1, -0.065), (v, t) => t >= 10).v), 3, 25, ' km/h');
check('Đứng yên trên dốc 6,5% không tự trôi', Math.abs(run(0, (v) => bikeStep(v, dt, 0, false, 0, m1, 0.065), (v, t) => t >= 3).v), 0, 0.001, ' m/s');
check('Góc nghiêng khi ôm cua bán kính 15 m ở 30 km/h', (leanFor(30 / 3.6, 1 / 15) * 180) / Math.PI, 24, 27, '°');
{ // bán kính cua nhỏ nhất ở các tốc độ: nghiêng hết cỡ 35°
  const R = (k) => 1 / bikeCurvature(k / 3.6, BIKE.leanMax, 1);
  check('Bán kính cua nhỏ nhất ở 20 km/h', R(20), 3.5, 5.5, ' m'); check('Bán kính cua nhỏ nhất ở 40 km/h', R(40), 16, 20, ' m'); check('Bán kính cua nhỏ nhất ở 60 km/h', R(60), 37, 44, ' m');
  let worst = 0; for (let v = 0.5; v < 25; v += 0.25) worst = Math.max(worst, v * v * Math.abs(bikeCurvature(v, BIKE.leanMax, 1)));
  check('Gia tốc ngang lớn nhất ở mọi tốc độ (không vượt độ bám của lốp)', worst / G0, 0.3, BIKE.mu + 0.001, ' g');
}
check('Đâm thẳng vào tường ở 30 km/h: tốc độ còn lại', kmh(wallHit(30 / 3.6, 1)[0]), 0, 0.01, ' km/h');
check('Sượt tường góc 15° ở 30 km/h: tốc độ còn lại', kmh(wallHit(30 / 3.6, Math.sin(Math.PI / 12))[0]), 22, 28, ' km/h');
{ const [a, b] = collide1D(m1, 10, 1300, 0); check('Xe máy 36 km/h đâm đuôi ô tô đứng yên: xe máy còn', kmh(a), -5, 6, ' km/h'); check('... ô tô bị đẩy tới', kmh(b), 3, 6, ' km/h');
  check('Động lượng bảo toàn (sai số)', Math.abs(m1 * 10 - (m1 * a + 1300 * b)), 0, 1e-6, ' kg·m/s'); }
check('Leo bó vỉa 16 cm ở 18 km/h: tốc độ còn lại', kmh(stepUp(5, 0.16)), 16, 17.5, ' km/h');
check('Đi bộ', kmh(WALK.speed), 4.5, 5.8, ' km/h'); check('Chạy', kmh(WALK.run), 13, 18, ' km/h');
if (bad) { console.error(`\n${bad} phép thử lệch số đo ngoài đời`); process.exit(1); }
console.log('Vật lý khớp số đo ngoài đời.');
