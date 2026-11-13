// Vật lý chuyển động theo đơn vị thật (mét, giây, kilôgam, niutơn). Không phụ thuộc three.js: chạy được trong Node để kiểm tra
// bằng số (tools/physics_check.mjs). Mọi hằng số là số đo ngoài đời của một chiếc xe số 110 phân khối và một người lớn.
export const G0 = 9.81;        // gia tốc trọng trường (m/s²)
export const RHO = 1.2;        // khối lượng riêng không khí (kg/m³)

export const BIKE = {
  mass: 100,          // xe số 110 cc đổ đầy xăng (kg)
  rider: 65,          // người lái (kg)
  passenger: 58,      // khách ngồi sau (kg)
  power: 4800,        // công suất tại bánh sau (W): máy 6,1 kW trừ hao truyền động
  thrust: 520,        // lực kéo lớn nhất ở số thấp (N), bị giới hạn bởi mô-men và độ bám bánh sau
  cruise: 0.42,       // phần công suất khi chỉ vặn ga vừa (giữ W); giữ thêm Shift là mở hết ga
  launch: 0.8,        // phần lực kéo khi vặn ga vừa
  cdA: 0.6,           // hệ số cản gió × diện tích cản (m²), người ngồi thẳng
  crr: 0.02,          // hệ số cản lăn của lốp xe máy trên nhựa
  inertia: 1.06,      // khối lượng quy đổi của bánh xe, máy đang quay
  engineBrake: [55, 8], // lực hãm của máy khi nhả ga: 55 N + 8 N cho mỗi m/s
  mu: 0.75,           // hệ số bám lốp, đường nhựa khô
  muWet: 0.5,         // đường ướt
  wheelbase: 1.23,    // khoảng cách hai trục bánh (m)
  steerMax: 0.6,      // góc bẻ ghi-đông lớn nhất (rad)
  leanMax: 0.61,      // góc nghiêng lớn nhất khi vào cua (35°)
  rollRate: 1.7,      // tốc độ ngả xe lớn nhất (rad/s)
  reverse: 1.2,       // lùi xe bằng chân (m/s)
};
export const WALK = { speed: 1.45, run: 4.4, accel: 3.5, decel: 5.5 }; // người lớn: đi bộ 5,2 km/h, chạy 16 km/h
// Bước lên cao nhất mỗi bước chân (m): bậc thang 0,15–0,2 m đi được, gờ bệ tượng, mép nền 0,45–0,9 m thì không (tester vòng 5: người
// chơi "bật" thẳng lên gờ 0,44–0,5 m trong 0,25 s ở bệ tượng Lý Thái Tổ, nền Lăng). Bước xuống thì không giới hạn. Dùng chung cho người
// chơi (actors/player.js) và phép loang lối đi của tools/reach_check.mjs.
export const STEP_UP = 0.32;

export const bikeMass = (passenger) => BIKE.mass + BIKE.rider + (passenger ? BIKE.passenger : 0);

// Gia tốc dọc của xe (m/s²).
//   v: vận tốc hiện tại (m/s, dương là tiến)        thr: tay ga 0..1         full: mở hết ga (true) hay vặn vừa
//   brake: lực phanh 0..1 so với giới hạn bám        m: tổng khối lượng (kg)   slope: độ dốc mặt đường theo hướng chạy (dy/ds)
//   aLat: gia tốc ngang đang dùng khi vào cua (m/s²) mu: hệ số bám
export function bikeAccel(v, thr, full, brake, m, slope = 0, aLat = 0, mu = BIKE.mu) {
  const B = BIKE, s = v >= 0 ? 1 : -1, av = Math.abs(v);
  // lực kéo: ở tốc độ thấp bị giới hạn bởi lực kéo lớn nhất, ở tốc độ cao bị giới hạn bởi công suất (F = P / v)
  const drive = thr > 0 && v > -0.2 ? thr * Math.min(B.thrust * (full ? 1 : B.launch), (B.power * (full ? 1 : B.cruise)) / Math.max(av, 0.5)) : 0;
  const cos = 1 / Math.sqrt(1 + slope * slope);
  const roll = av > 0.02 ? B.crr * m * G0 * cos : 0;                 // cản lăn
  const aero = 0.5 * RHO * B.cdA * v * v;                           // cản gió, tỉ lệ với v²
  const eng = thr <= 0 && av > 0.3 ? B.engineBrake[0] + B.engineBrake[1] * av : 0; // nhả ga: máy hãm xe
  const grav = m * G0 * slope * cos;                                 // thành phần trọng lực dọc dốc (lên dốc thì cản)
  // phanh: tổng lực bám của lốp là có hạn (vòng tròn ma sát); đang vào cua thì phần còn lại cho phanh ít đi
  const grip = m * G0 * mu * cos, used = m * aLat, room = Math.sqrt(Math.max(0, grip * grip - used * used));
  const brk = brake * room;
  return (drive - grav - s * (roll + aero + eng + brk)) / (m * B.inertia);
}

// Tích phân một bước dt. Lực cản và phanh chỉ làm xe dừng lại, không đẩy xe chạy ngược.
export function bikeStep(v, dt, thr, full, brake, m, slope = 0, aLat = 0, mu = BIKE.mu) {
  const a = bikeAccel(v, thr, full, brake, m, slope, aLat, mu);
  let nv = v + a * dt;
  if (thr <= 0 && v !== 0 && nv * v <= 0) {
    // vừa dừng hẳn: người lái chống chân, bóp phanh giữ xe (dốc tới 12% vẫn giữ được), không tự trôi ngược
    nv = 0;
  }
  if (thr <= 0 && v === 0) { const hold = (BIKE.mu * G0) / 4; if (Math.abs(G0 * slope) < hold) nv = 0; }
  return nv;
}

// Độ cong quỹ đạo (1/m, cùng dấu với tay lái) từ góc nghiêng phi và tay lái st (-1..1) ở vận tốc v.
// Chạy chậm: xe rẽ theo góc ghi-đông (tan δ / chiều dài cơ sở). Chạy nhanh: xe rẽ nhờ nghiêng, lực hướng tâm cân với
// trọng lực: v²·κ = g·tan φ. Giữa hai chế độ là đoạn chuyển tiếp từ 2 tới 5,5 m/s.
export function bikeCurvature(v, phi, st) {
  const B = BIKE, av = Math.abs(v), kMax = Math.tan(B.steerMax) / B.wheelbase;
  const low = Math.tan(st * B.steerMax) / B.wheelbase, lean = av > 0.5 ? (G0 * Math.tan(phi)) / (av * av) : low;
  const t = Math.min(1, Math.max(0, (av - 2) / 3.5)), w = t * t * (3 - 2 * t);
  // không bao giờ đòi lực hướng tâm quá sức bám của lốp: v²·κ ≤ g·tan(góc nghiêng lớn nhất)
  const cap = Math.min(kMax, (G0 * Math.tan(B.leanMax)) / Math.max(av * av, 0.01));
  return Math.max(-cap, Math.min(cap, low * (1 - w) + lean * w));
}
// Góc nghiêng cân bằng khi chạy vận tốc v trên cung có độ cong k: tan φ = v²·k / g.
export const leanFor = (v, k) => Math.atan((v * v * k) / G0);

// Va vào vật cứng (tường, lan can) với góc tới có sin = into (0: sượt dọc, 1: đâm thẳng).
// Thành phần vuông góc mất gần hết (va chạm mềm, hệ số đàn hồi e = 0,15); thành phần dọc tường bị ma sát ăn bớt
// tỉ lệ với xung lực vuông góc (μ = 0,35). Trả về [vận tốc sau va chạm, thành phần vuông góc trước va chạm].
export function wallHit(v, into) {
  const av = Math.abs(v), vn = av * into, vt = av * Math.sqrt(Math.max(0, 1 - into * into));
  return [Math.sign(v) * Math.max(0, vt - 0.35 * 1.15 * vn), vn];
}
// Va chạm thẳng giữa hai vật khối lượng m1, m2 chạy cùng phương với vận tốc v1, v2 (bảo toàn động lượng, e = 0,2).
export function collide1D(m1, v1, m2, v2, e = 0.2) {
  const p = m1 * v1 + m2 * v2, M = m1 + m2;
  return [(p + m2 * e * (v2 - v1)) / M, (p + m1 * e * (v1 - v2)) / M];
}
// Leo lên bậc cao dh (m): động năng đổi thành thế năng, v² giảm 2·g·dh. Xuống bậc thì giảm xóc hấp thụ, không tăng tốc.
export const stepUp = (v, dh) => (dh > 0 ? Math.sign(v) * Math.sqrt(Math.max(0, v * v - 2 * G0 * dh)) : v);
// Tiến tới vận tốc đích với gia tốc có hạn (người đi bộ).
export const approach = (v, target, up, down, dt) => (target > v ? Math.min(target, v + up * dt) : Math.max(target, v - down * dt));
