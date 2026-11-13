// MỤC 1: ĐIỀU KHIỂN (tiêu chí của chủ sản phẩm)
//   W / ↑ : nhân vật đi RA XA ống kính.       S / ↓ : đi VỀ PHÍA ống kính.
//   A / ← : sang TRÁI màn hình.               D / → : sang PHẢI màn hình.        Ở mọi góc camera 0°, 90°, 180°, 270°; đi bộ, chạy, đi xe.
// Cách đo: phím là sự kiện bàn phím THẬT của trình duyệt (page.keyboard.down/up), chuột là sự kiện chuột thật. Hướng "ra xa" và "phải
// màn hình" lấy từ chính ma trận camera mà game dùng để vẽ (cột 0 và cột 2 của camera.matrixWorld), KHÔNG lấy từ công thức trong mã.
// Độ dời của nhân vật trong từng quãng 0,1 giây được chiếu lên hai hướng đó của camera NGAY LÚC ẤY.
// Vòng lặp game chạy bằng đồng hồ ảo 60 khung hình/giây (lib.mjs): máy thử không có GPU chỉ đạt 1 đến 4 khung hình/giây thật, khi đó
// game kẹp dt = 0,05 giây và mọi ngưỡng "không đụng chuột trong x giây" của camera lệch hẳn so với máy người chơi. Phần D cuối tệp
// chạy lại vài phép bằng vòng lặp THẬT (có vẽ và không vẽ) để chắc rằng đồng hồ ảo không che mất lỗi.
// Dùng: node tools/qa/controls.mjs [a] [b] [c] [d] [e]
import { launch, openGame, Report, fx, SLOW } from './lib.mjs';

const want = (k) => process.argv.length <= 2 || process.argv.slice(2).includes(k);
const R = new Report('controls');
const browser = await launch();
const SPOT = { x: 493, z: -974 }; // bãi giữa sông Hồng: không nhà, không tường, không đường xe chạy trong 80 m (kiểm lại lúc chạy)
const AXIS = { KeyW: ['fwd', 1], ArrowUp: ['fwd', 1], KeyS: ['fwd', -1], ArrowDown: ['fwd', -1], KeyD: ['right', 1], ArrowRight: ['right', 1], KeyA: ['right', -1], ArrowLeft: ['right', -1] };
const NAME = { KeyW: 'W', KeyS: 'S', KeyA: 'A', KeyD: 'D', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };

// ----- trợ giúp chạy trong trang -----
const reset = (page, o) => page.evaluate(async (o) => {
  const g = window.__game, P = g.player, Q = window.__qa;
  const stuck = [...g.input.keys]; g.input.keys.clear(); if (g.input.held) g.input.held.clear(); g.input.dragging = false; // (held: bảng phím đang giữ, bản cũ chưa có)
  // nhả khoá con trỏ (như người chơi bấm Esc) để lần thử nào cũng bắt đầu từ cùng một trạng thái chuột
  if (document.pointerLockElement) { document.exitPointerLock(); for (let i = 0; i < 100 && g.input.locked; i++) await Q.sleep(10); }
  if (P.mode === 'bike') { P.speed = 0; P.toggleBike(); }
  if (g.hud.modal) g.hud.close();
  P.teleport(o.x, o.z, o.yaw, false); g.cam.yaw = o.camYaw; g.cam.pitch = 0.16; g.cam.zoom = 1; g.cam.snapT = 0; g.cam.wasRiding = false;
  if (o.idle !== false) g.input.lastLook = performance.now() - 60000; // người chơi không đụng chuột đã lâu
  Q.step(40);
  if (o.forceCam !== false) { g.cam.yaw = o.camYaw; Q.step(20); }
  return { stuck, snap: Q.snap(), enabled: g.input.enabled, modal: g.hud.modal };
}, o);
const run = (page, frames, every = 6) => page.evaluate(({ frames, every }) => { const Q = window.__qa, out = [Q.snap()]; for (let i = 1; i <= frames; i++) { Q.step(1); if (i % every === 0) out.push(Q.snap()); } return out; }, { frames, every });
const state = (page) => page.evaluate(() => { const g = window.__game; return { keys: [...g.input.keys], held: g.input.held ? [...g.input.held.keys()] : [], snap: window.__qa.snap(), move: { ...g.input.move }, locked: g.input.locked, dragging: g.input.dragging }; });

// Phân tích một lần giữ phím: s = dãy mẫu. Trả về quãng đường, độ dời thẳng, và thành phần hướng nhỏ nhất (theo trục mong đợi) của mọi
// quãng 0,1 giây sau tSkip giây đầu; worstAt = thời điểm của quãng tệ nhất.
function analyse(s, axis, sign, tSkip = 0.6) {
  let path = 0, minC = 1, worstAt = -1, n = 0; const t0 = s[0].t;
  for (let i = 0; i + 1 < s.length; i++) {
    const a = s[i], b = s[i + 1], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); path += d;
    if (a.t - t0 < tSkip || d < 0.004) continue;
    const f = (dx * a.fx + dz * a.fz) / d, r = (dx * a.rx + dz * a.rz) / d, c = (axis === 'fwd' ? f : r) * sign; n++;
    if (c < minC) { minC = c; worstAt = a.t - t0; }
  }
  const a = s[0], b = s[s.length - 1], dx = b.x - a.x, dz = b.z - a.z, net = Math.hypot(dx, dz);
  // độ dời tổng chiếu lên hướng camera LÚC BẮT ĐẦU giữ phím
  const f0 = net > 1e-6 ? (dx * a.fx + dz * a.fz) / net : 0, r0 = net > 1e-6 ? (dx * a.rx + dz * a.rz) / net : 0;
  let camTurn = 0; for (let i = 0; i + 1 < s.length; i++) { const d = s[i + 1].camYaw - s[i].camYaw; camTurn += Math.atan2(Math.sin(d), Math.cos(d)); }
  return { path: fx(path), net: fx(net), straight: fx(path > 0 ? net / path : 0, 3), minC: fx(n ? minC : NaN, 3), worstAt: fx(worstAt, 1), n, fwd0: fx(f0, 3), right0: fx(r0, 3), camTurn: fx(camTurn, 3), vEnd: fx(b.v) };
}

// khung nhìn rộng 2000 px: Playwright chỉ gửi được sự kiện chuột trong khung nhìn, mà xoay camera 270° cần kéo chừng 1800 px
const { page, errors } = await openGame(browser, 'q=low&fresh&h=3&lang=vi&at=' + SPOT.x + ',' + SPOT.z, { start: 'click', viewport: { width: 2000, height: 600 } });
await page.evaluate(async () => { window.__norender = true; await window.__qa.virtual(); window.__qa.step(30); });
// TỰ KIỂM bài thử: QA_MUTATE=flipx|flipy|spin cố ý làm hỏng điều khiển ngay trong trang (đảo trục, hoặc cho camera tự xoay khi đi
// ngang / đi lùi như lỗi cũ). Khi đặt biến này bài thử PHẢI đỏ; nếu vẫn xanh thì bài thử vô dụng.
const MUT = process.env.QA_MUTATE || '';
if (MUT) await page.evaluate((m) => {
  const g = window.__game, I = g.input, poll = I.poll.bind(I);
  I.poll = () => { poll(); if (m === 'flipx') I.move.x = -I.move.x; if (m === 'flipy') I.move.y = -I.move.y; if (m === 'spin' && (Math.abs(I.move.x) > 0.05 || I.move.y < -0.05)) { const b = g.player.yaw + Math.PI, d = Math.atan2(Math.sin(b - g.cam.yaw), Math.cos(b - g.cam.yaw)); g.cam.yaw += d * 0.015; } };
}, MUT);
if (MUT) R.note('ĐANG CỐ Ý LÀM HỎNG ĐIỀU KHIỂN: ' + MUT);

// điều kiện tiên quyết: chỗ thử thật sự trống
const pre = await page.evaluate(({ x, z }) => { const g = window.__game, n = g.nav; let clear = 0; for (const r of [20, 40, 60, 80]) { if (n.clearAt(x, z, r)) clear = r; else break; } const rd = n.nearestRoad(x, z, 70, (r) => r.veh); return { clear, water: n.isWater(x, z), road: rd ? +rd.d.toFixed(0) : null, missing: g.chunks.missingNear(x, z, 150)[0], y: n.groundY(x, z), noRide: !!(g.player.noRide && g.player.noRide(x, z)), started: g.G.started, enabled: g.input.enabled, pos: [g.player.pos.x, g.player.pos.z] }; }, SPOT);
R.check('tiền đề: bãi thử trống ≥ 60 m, không nước, không đường xe trong 70 m, đã vào game bằng nút Bắt đầu', pre.clear >= 60 && !pre.water && pre.road === null && pre.missing === 0 && !pre.noRide && pre.started && pre.enabled, JSON.stringify(pre));

// ===== A. ĐI BỘ và CHẠY: 4 góc camera × 8 phím × (nhấn nhanh 0,25 giây; giữ 6,5 giây), nhân vật lúc đầu quay lưng lại camera =====
if (want('a')) {
  const bad = [], rows = []; let trials = 0, stuckKeys = 0;
  for (const mode of ['walk', 'run']) for (const camDeg of [0, 90, 180, 270]) for (const key of Object.keys(AXIS)) for (const kind of ['tap', 'hold']) {
    const camYaw = (camDeg * Math.PI) / 180, [axis, sign] = AXIS[key];
    const r0 = await reset(page, { ...SPOT, yaw: camYaw + Math.PI, camYaw }); if (r0.stuck.length) stuckKeys++;
    if (mode === 'run') await page.keyboard.down('ShiftLeft');
    await page.keyboard.down(key);
    const s = await run(page, kind === 'tap' ? 15 : 390, kind === 'tap' ? 3 : 6);
    await page.keyboard.up(key);
    if (mode === 'run') await page.keyboard.up('ShiftLeft');
    const after = await run(page, 90, 6), st = await state(page);
    const a = analyse(kind === 'tap' ? [...s, ...after] : s, axis, sign, kind === 'tap' ? 0 : 0.6), end = after[after.length - 1], prev = after[after.length - 4];
    const coast = Math.hypot(end.x - prev.x, end.z - prev.z), tag = `${mode} cam ${camDeg}° ${NAME[key]} ${kind}`;
    trials++;
    let ok;
    if (kind === 'tap') { const c = (axis === 'fwd' ? a.fwd0 : a.right0) * sign; ok = a.net >= 0.03 && c >= 0.8 && coast < 0.01 && st.keys.length === 0; rows.push({ tag, net: a.net, dir: fx(c, 3), coast: fx(coast, 3) }); if (!ok) bad.push(`${tag}: dời ${a.net} m, thành phần đúng hướng ${fx(c, 3)}, còn trôi ${fx(coast, 3)} m, phím kẹt [${st.keys}]`); }
    else {
      const minPath = mode === 'run' ? 19 : 6.5; // chạy ≥ 3 m/s, đi bộ ≥ 1 m/s tính trung bình
      ok = a.path >= minPath && a.minC >= 0.9 && a.straight >= 0.97 && Math.abs(a.camTurn) < 0.15 && coast < 0.01 && st.keys.length === 0;
      rows.push({ tag, ...a }); if (!ok) bad.push(`${tag}: ${JSON.stringify(a)} trôi sau khi nhả ${fx(coast, 3)} m, phím kẹt [${st.keys}]`);
    }
  }
  R.check(`A1: đi bộ + chạy, ${trials} lần (4 góc camera × 8 phím × nhấn nhanh/giữ 6,5 giây) đều đúng hướng so với màn hình, đi thẳng, nhả phím là dừng`, bad.length === 0, bad.length ? `${bad.length} hỏng: ${bad.slice(0, 6).join(' | ')}` : `thành phần đúng hướng nhỏ nhất ${Math.min(...rows.filter((r) => r.minC !== undefined).map((r) => r.minC))}, độ thẳng nhỏ nhất ${Math.min(...rows.filter((r) => r.straight !== undefined).map((r) => r.straight))}`);
  R.check('A2: không có phím nào còn kẹt giữa các lần thử', stuckKeys === 0, `${stuckKeys} lần thấy phím còn kẹt lúc bắt đầu`);

  // A3: nhân vật lúc đầu quay mặt theo 4 hướng khác nhau so với camera (quay lưng, quay mặt, quay trái, quay phải): giữ phím 3 giây
  const bad3 = []; let n3 = 0;
  for (const face of [0, 90, 180, 270]) for (const key of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) for (const camDeg of [45, 200]) {
    const camYaw = (camDeg * Math.PI) / 180, [axis, sign] = AXIS[key];
    await reset(page, { ...SPOT, yaw: camYaw + Math.PI + (face * Math.PI) / 180, camYaw });
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down(key);
    const s = await run(page, 180, 6);
    await page.keyboard.up(key); await page.keyboard.up('ShiftLeft'); await run(page, 60, 6);
    const a = analyse(s, axis, sign, 0.7); n3++;
    if (!(a.path >= 7 && a.minC >= 0.9 && Math.abs(a.camTurn) < 0.15 && (axis === 'fwd' ? a.fwd0 : a.right0) * sign >= 0.97)) bad3.push(`mặt lệch ${face}°, cam ${camDeg}°, ${NAME[key]}: ${JSON.stringify(a)}`);
  }
  R.check(`A3: chạy 3 giây với nhân vật lúc đầu quay 4 hướng khác nhau, camera 45° và 200° (${n3} lần)`, bad3.length === 0, bad3.slice(0, 5).join(' | '));

  // A4: hai phím cùng lúc. W+D phải đi về phía trước-phải của màn hình; W+S và A+D triệt tiêu nhau (đứng yên)
  const bad4 = [];
  for (const [keys, wantF, wantR] of [[['KeyW', 'KeyD'], 1, 1], [['KeyW', 'KeyA'], 1, -1], [['KeyS', 'KeyD'], -1, 1], [['KeyS', 'KeyA'], -1, -1], [['ArrowUp', 'ArrowLeft'], 1, -1], [['KeyW', 'KeyS'], 0, 0], [['KeyA', 'KeyD'], 0, 0], [['KeyW', 'ArrowDown'], 0, 0]]) {
    const camYaw = 2.2; await reset(page, { ...SPOT, yaw: camYaw + Math.PI, camYaw });
    for (const k of keys) await page.keyboard.down(k);
    const s = await run(page, 90, 6);
    for (const k of keys) await page.keyboard.up(k); await run(page, 60, 6);
    // 1,5 giây đầu: camera chưa kịp vòng theo (camera chỉ tự vòng sau 2,5 giây không đụng chuột)
    const a = s[0], b = s[s.length - 1], dx = b.x - a.x, dz = b.z - a.z, net = Math.hypot(dx, dz), f = dx * a.fx + dz * a.fz, r = dx * a.rx + dz * a.rz;
    const ok = wantF === 0 && wantR === 0 ? net < 0.05 : net > 1 && Math.sign(f) === wantF && Math.sign(r) === wantR && Math.abs(Math.abs(f) - Math.abs(r)) < 0.25 * net;
    if (!ok) bad4.push(`${keys.join('+')}: dời ${fx(net)} m, tiến ${fx(f)} m, phải ${fx(r)} m`);
  }
  R.check('A4: hai phím cùng lúc (chéo đúng góc phần tư; hai phím ngược nhau thì đứng yên)', bad4.length === 0, bad4.join(' | '));
}

// ===== B. ĐI BỘ CÓ RÊ CHUỘT: giữ phím 6,5 giây trong lúc kéo chuột qua lại (camera xoay ±), hướng đi phải bám theo camera từng lúc =====
if (want('b')) {
  const bad = []; let n = 0; const turns = [];
  for (const key of ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) for (const pattern of ['sweep', 'jitter']) {
    const camYaw = 1.0, [axis, sign] = AXIS[key];
    await reset(page, { ...SPOT, yaw: camYaw + Math.PI, camYaw });
    await page.mouse.move(1000, 300); await page.mouse.down();
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down(key);
    const s = [(await state(page)).snap]; let mx = 1000;
    for (let i = 0; i < 65; i++) {
      // sweep: kéo đều một chiều 2 giây rồi đổi chiều (camera quay chừng 60°/giây); jitter: rung qua lại nhanh
      const dx = pattern === 'sweep' ? (Math.floor(i / 20) % 2 ? -40 : 40) : (i % 2 ? -60 : 60);
      mx += dx; await page.mouse.move(mx, 300);
      const part = await run(page, 6, 6); s.push(part[part.length - 1]);
    }
    await page.keyboard.up(key); await page.keyboard.up('ShiftLeft'); await page.mouse.up(); await run(page, 60, 6);
    const a = analyse(s, axis, sign, 0.6); n++; turns.push(a.camTurn);
    // sweep: camera phải thật sự xoay (chuột có tác dụng); hướng đi bám theo camera (cho phép trễ: ≥ 0,85)
    const moved = pattern === 'sweep' ? Math.max(...s.map((q) => Math.abs(Math.atan2(Math.sin(q.camYaw - s[0].camYaw), Math.cos(q.camYaw - s[0].camYaw))))) : 2;
    if (!(a.path >= 15 && a.minC >= 0.85 && moved > 1.5)) bad.push(`${NAME[key]} ${pattern}: ${JSON.stringify(a)} camera lệch tối đa ${fx(moved)} rad`);
  }
  const st = await state(page);
  R.check(`B1: chạy 6,5 giây trong lúc kéo chuột xoay camera (${n} lần: 8 phím × quét đều/rung nhanh), hướng đi bám theo camera từng 0,1 giây`, bad.length === 0, bad.length ? bad.slice(0, 5).join(' | ') : `con trỏ ${st.locked ? 'đã khoá' : 'kéo-thả'}`);
}

// ===== C. ĐI XE =====
if (want('c')) {
  const mount = async () => { await page.keyboard.press('KeyF'); await run(page, 3, 3); return (await state(page)).snap.mode; };
  const bad = [], info = [];
  // C1: lên xe khi camera ở sau lưng; 4 hướng thế giới. W: ra xa ống kính. S (đang đứng): lùi về phía ống kính. W+A: vòng trái. W+D: vòng phải.
  for (const camDeg of [0, 90, 180, 270]) for (const [keys, secs, exp] of [[['KeyW'], 6.5, 'fwd'], [['ArrowUp'], 4, 'fwd'], [['KeyS'], 4, 'back'], [['ArrowDown'], 4, 'back'], [['KeyW', 'KeyA'], 4, 'left'], [['KeyW', 'KeyD'], 4, 'right'], [['ArrowUp', 'ArrowLeft'], 4, 'left'], [['ArrowUp', 'ArrowRight'], 4, 'right']]) {
    const camYaw = (camDeg * Math.PI) / 180;
    await reset(page, { ...SPOT, yaw: camYaw + Math.PI, camYaw });
    const m = await mount(); if (m !== 'bike') { bad.push(`cam ${camDeg}°: bấm F không lên được xe (mode ${m})`); continue; }
    await run(page, 90, 30); // camera về sau lưng xe
    for (const k of keys) await page.keyboard.down(k);
    const s = await run(page, Math.round(secs * 60), 6);
    for (const k of keys) await page.keyboard.up(k);
    const tag = `xe cam ${camDeg}° ${keys.map((k) => NAME[k]).join('+')}`;
    if (exp === 'fwd' || exp === 'back') {
      const a = analyse(s, 'fwd', exp === 'fwd' ? 1 : -1, 0.5); info.push({ tag, ...a });
      if (!(a.path >= (exp === 'fwd' ? (secs > 5 ? 20 : 8) : 3) && a.minC >= 0.9 && a.straight >= 0.97)) bad.push(`${tag}: ${JSON.stringify(a)}`);
    } else {
      // rẽ. Trong 1,5 giây đầu xe phải lệch về bên mong đợi so với hướng camera lúc bắt đầu; và ở MỌI quãng 0,1 giây (sau 0,5 giây)
      // mũi xe phải quay về bên đó: "bên phải của mũi xe" = (−hz, hx), cùng quy ước tay với camera (kiểm lại bằng chính ma trận camera).
      const a = s[0], sg = exp === 'right' ? 1 : -1, hand = Math.abs(a.rx - -a.fz) + Math.abs(a.rz - a.fx);
      const e15 = s.find((q) => q.t - a.t >= 1.5) || s[s.length - 1], r15 = (e15.x - a.x) * a.rx + (e15.z - a.z) * a.rz, f15 = (e15.x - a.x) * a.fx + (e15.z - a.z) * a.fz;
      let wrong = 0, turn = 0;
      for (let i = 0; i + 1 < s.length; i++) { const p = s[i], q = s[i + 1]; if (p.t - a.t < 0.5) continue; const hx = Math.sin(p.yaw), hz = Math.cos(p.yaw), tr = Math.sin(q.yaw) * -hz + Math.cos(q.yaw) * hx; turn += Math.asin(Math.max(-1, Math.min(1, tr))); if (tr * sg <= 0) wrong++; }
      info.push({ tag, tien15: fx(f15), phai15: fx(r15), quayPhai_rad: fx(turn), nguoc: wrong });
      if (!(hand < 0.02 && r15 * sg > 0.3 && f15 > 1 && turn * sg > 0.8 && wrong === 0)) bad.push(`${tag}: sau 1,5 giây tiến ${fx(f15)} m, lệch phải ${fx(r15)} m; tổng góc quay phải ${fx(turn)} rad, ${wrong} quãng quay ngược`);
    }
    await page.evaluate(() => { window.__game.player.speed = 0; });
  }
  R.check('C1: đi xe, camera sau lưng, 4 hướng: W/↑ ra xa ống kính, S/↓ lùi về ống kính, W+A vòng trái màn hình, W+D vòng phải màn hình (32 lần)', bad.length === 0, bad.slice(0, 6).join(' | '));

  // C2 (lỗi chủ sản phẩm báo): lên xe lúc XE ĐANG QUAY MẶT VỀ ỐNG KÍNH (nhân vật vừa đi về phía camera rồi bấm F), bấm W ngay.
  // Yêu cầu: W ra xa ống kính. Đo: quãng xe chạy VỀ PHÍA ống kính (theo camera từng lúc) và thời điểm muộn nhất còn chạy về phía ống kính.
  const bad2 = [], rows2 = [], pre2 = [];
  for (const [camDeg, rel] of [[0, 180], [90, 180], [180, 180], [270, 180], [40, 90], [40, 270], [220, 135]]) for (const wait of [0, 20, 60]) for (const keys of [['KeyW'], ['KeyW', 'KeyD']]) {
    const camYaw = (camDeg * Math.PI) / 180;
    // rel = 180: nhân vật (và xe dựng cạnh) quay mặt thẳng về camera; 90/270: xe nằm ngang trước ống kính
    const r0 = await reset(page, { ...SPOT, yaw: camYaw + Math.PI + (rel * Math.PI) / 180, camYaw });
    const faceCam = Math.sin(r0.snap.yaw) * r0.snap.fx + Math.cos(r0.snap.yaw) * r0.snap.fz; // −1: chĩa thẳng vào ống kính
    const m = await mount(); if (m !== 'bike') { bad2.push(`cam ${camDeg}°: không lên được xe`); continue; }
    const m0 = (await state(page)).snap, dyaw = Math.abs(Math.atan2(Math.sin(m0.yaw - r0.snap.yaw), Math.cos(m0.yaw - r0.snap.yaw)));
    if (Math.abs(faceCam - Math.cos((rel * Math.PI) / 180)) > 0.05 || dyaw > 0.02) pre2.push(`cam ${camDeg}° lệch ${rel}°: cos(mũi xe, hướng nhìn) trước khi lên xe ${fx(faceCam)}, lên xe làm đổi hướng ${fx(dyaw)} rad`);
    if (wait) await run(page, wait, wait);
    for (const k of keys) await page.keyboard.down(k);
    const s = await run(page, 300, 3);
    for (const k of keys) await page.keyboard.up(k);
    let toward = 0, lastToward = -1, wrongSide = 0; const t0 = s[0].t;
    for (let i = 0; i + 1 < s.length; i++) { const a = s[i], b = s[i + 1], dx = b.x - a.x, dz = b.z - a.z, f = dx * a.fx + dz * a.fz; if (f < -0.002) { toward += -f; lastToward = b.t - t0; } }
    const a5 = analyse(s.filter((q) => q.t - t0 >= 1.5), 'fwd', 1, 0);
    // W+D: sau khi camera đã ra sau lưng (từ giây 1,5) xe phải vòng về bên PHẢI màn hình: góc mũi xe giảm dần theo chiều kim đồng hồ nhìn từ trên xuống
    if (keys.length > 1) { const q = s.filter((p) => p.t - t0 >= 1.5); for (let i = 0; i + 1 < q.length; i++) { const dy = Math.atan2(Math.sin(q[i + 1].yaw - q[i].yaw), Math.cos(q[i + 1].yaw - q[i].yaw)); const cr = Math.sin(q[i + 1].yaw) * q[i].rx + Math.cos(q[i + 1].yaw) * q[i].rz - (Math.sin(q[i].yaw) * q[i].rx + Math.cos(q[i].yaw) * q[i].rz); if (cr < -1e-4) wrongSide++; void dy; } }
    const row = { cam: camDeg, xeLech: rel, choSauKhiLenXe: fx(wait / 60), phim: keys.map((k) => NAME[k]).join('+'), vePhiaOngKinh_m: fx(toward), denGiay: fx(lastToward), minC_sau1s5: a5.minC, quangDuong: a5.path, reNguoc: wrongSide }; rows2.push(row);
    if (!(toward <= 1.0 && lastToward <= 1.0 && a5.minC >= 0.8 && a5.path > 5 && wrongSide === 0)) bad2.push(JSON.stringify(row));
    await page.evaluate(() => { window.__game.player.speed = 0; });
  }
  R.check('C2 tiền đề: lúc bấm F mũi xe đúng là đang chĩa về ống kính (hoặc nằm ngang) như tình huống định thử', pre2.length === 0, pre2.slice(0, 3).join(' | '));
  const worst = rows2.reduce((p, q) => (q.vePhiaOngKinh_m > p.vePhiaOngKinh_m ? q : p), rows2[0]);
  R.check('C2: lên xe lúc xe quay mặt về ống kính rồi bấm W (ngay, sau 0,33 giây, sau 1 giây): xe không chạy về phía ống kính quá 1 m / 1 giây, sau đó W ra xa ống kính, W+D vòng phải', bad2.length === 0, bad2.length ? `${bad2.length}/${rows2.length} hỏng: ${bad2.slice(0, 4).join(' | ')}` : `tệ nhất: ${JSON.stringify(worst)}`);

  // C3: đang đứng trên xe, người chơi dùng chuột xoay camera ra TRƯỚC mũi xe, thả chuột rồi (a) bấm W ngay, (b) chờ 2 giây mới bấm W
  const bad3 = [], rows3 = [], pre3 = [];
  for (const offDeg of [90, 180, 270]) for (const wait of [0, 120]) for (const hold of [false, true]) {
    const camYaw = 0.7;
    await reset(page, { ...SPOT, yaw: camYaw + Math.PI, camYaw });
    if ((await mount()) !== 'bike') { bad3.push('không lên được xe'); continue; }
    await run(page, 90, 30);
    // kéo chuột thật để xoay camera đi offDeg độ (độ nhạy đọc từ game để đổi độ → điểm ảnh; kết quả kiểm lại bằng góc camera đo được)
    await page.mouse.move(1950, 300); await run(page, 2, 2);
    await page.mouse.down();
    const sens = await page.evaluate(() => window.__game.cam.sens); let left = Math.round(((offDeg * Math.PI) / 180) / sens), mx = 1950;
    while (left > 0) { const d = Math.min(50, left); mx -= d; left -= d; await page.mouse.move(mx, 300); await run(page, 1, 1); }
    if (!hold) await page.mouse.up();
    // tiền đề: chuột thật sự đã đưa camera lệch khỏi SAU LƯNG XE chừng offDeg độ (cos giữa mũi xe và hướng nhìn của camera)
    const c0 = (await state(page)).snap, behind0 = Math.sin(c0.yaw) * c0.fx + Math.cos(c0.yaw) * c0.fz, off0 = Math.acos(Math.max(-1, Math.min(1, behind0)));
    if (Math.abs(behind0 - Math.cos((offDeg * Math.PI) / 180)) > 0.15) pre3.push(`muốn lệch ${offDeg}°, đo được ${fx((off0 * 180) / Math.PI, 0)}°`);
    if (wait) await run(page, wait, wait);
    await page.keyboard.down('KeyW');
    const s = [];
    for (let i = 0; i < 50; i++) { if (hold) { mx += i % 2 ? 3 : -3; await page.mouse.move(mx, 300); } const part = await run(page, 6, 6); if (!i) s.push(part[0]); s.push(part[part.length - 1]); }
    await page.keyboard.up('KeyW'); if (hold) await page.mouse.up();
    let toward = 0, lastToward = -1; const t0 = s[0].t;
    for (let i = 0; i + 1 < s.length; i++) { const a = s[i], b = s[i + 1], f = (b.x - a.x) * a.fx + (b.z - a.z) * a.fz; if (f < -0.002) { toward += -f; lastToward = b.t - t0; } }
    const tail = analyse(s.filter((q) => q.t - t0 >= 2.5), 'fwd', 1, 0);
    const row = { camLech: offDeg, camLechDo: fx((off0 * 180) / Math.PI, 0), choTruocKhiW: fx(wait / 60), vanGiuChuot: hold, vePhiaOngKinh_m: fx(toward), denGiay: fx(lastToward), minC_sau2s5: tail.minC }; rows3.push(row);
    // khi người chơi đã THẢ chuột: W phải sớm thành "ra xa ống kính". Khi vẫn giữ và rê chuột (đang chủ động nhìn quanh) thì chỉ ghi số đo.
    if (!hold && !(toward <= 1.5 && lastToward <= 1.2 && tail.minC >= 0.8)) bad3.push(JSON.stringify(row));
    await page.evaluate(() => { window.__game.player.speed = 0; });
  }
  R.check('C3 tiền đề: kéo chuột thật đã xoay camera lệch đúng góc muốn thử', pre3.length === 0, pre3.slice(0, 4).join(' | '));
  R.check('C3: đứng trên xe, kéo chuột đưa camera lệch 90°/180°/270° rồi thả, bấm W: xe không chạy về phía ống kính quá 1,5 m / 1,2 giây', bad3.length === 0, bad3.length ? `${bad3.length} hỏng: ${bad3.slice(0, 4).join(' | ')}` : '');
  for (const r of rows3.filter((q) => q.vanGiuChuot)) R.note('C3 (chỉ ghi nhận, người chơi vẫn đang rê chuột nhìn quanh): ' + JSON.stringify(r));
  await reset(page, { ...SPOT, yaw: 0, camYaw: Math.PI });
}

// ===== E. LỚP PHÍM: phím kẹt, mất tiêu điểm, hộp thoại, tự lặp phím =====
if (want('e')) {
  const camYaw = 0.3; let r;
  // E1: Shift + W, nhả Shift trước rồi nhả W (e.key đổi từ "W" sang "w" giữa chừng)
  await reset(page, { ...SPOT, yaw: camYaw + Math.PI, camYaw });
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await run(page, 30); await page.keyboard.up('ShiftLeft'); await run(page, 30); await page.keyboard.up('KeyW'); await run(page, 90);
  r = await state(page); R.check('E1: Shift+W, nhả Shift trước rồi nhả W: không phím nào kẹt, nhân vật dừng', r.keys.length === 0 && Math.abs(r.snap.v) < 0.01, `phím còn giữ [${r.keys}], vận tốc ${fx(r.snap.v)}`);
  // E2: hệ điều hành tự lặp phím (keydown repeat) trong lúc giữ: không đổi hướng, nhả là dừng
  await reset(page, { ...SPOT, yaw: camYaw + Math.PI, camYaw });
  await page.keyboard.down('KeyS'); for (let i = 0; i < 10; i++) { await page.keyboard.down('KeyS'); await run(page, 6); }
  const mid = await state(page); await page.keyboard.up('KeyS'); await run(page, 90); r = await state(page);
  R.check('E2: tự lặp phím S 10 lần trong lúc giữ: vẫn đi về phía ống kính, nhả là dừng', mid.move.y === -1 && r.keys.length === 0 && Math.abs(r.snap.v) < 0.01, `move.y lúc giữ ${mid.move.y}, phím còn [${r.keys}]`);
  // E3: mở bản đồ (M) trong lúc giữ W: nhân vật dừng; nhả W lúc bảng còn mở; đóng bảng (Esc): nhân vật KHÔNG tự đi
  await reset(page, { ...SPOT, yaw: camYaw + Math.PI, camYaw });
  await page.keyboard.down('KeyW'); await run(page, 30); await page.keyboard.press('KeyM'); await run(page, 30);
  const open = await page.evaluate(() => ({ modal: window.__game.hud.modal, v: window.__game.player.speed, my: window.__game.input.move.y }));
  await run(page, 60); const p1 = (await state(page)).snap; await page.keyboard.up('KeyW'); await run(page, 10); await page.keyboard.press('Escape'); await run(page, 90); r = await state(page);
  const closed = await page.evaluate(() => window.__game.hud.modal);
  R.check('E3: mở bản đồ lúc đang giữ W rồi nhả W khi bảng còn mở, đóng bảng: nhân vật đứng yên, không phím kẹt', open.modal === 'map' && closed === null && r.keys.length === 0 && Math.hypot(r.snap.x - p1.x, r.snap.z - p1.z) < 0.05, `bảng ${open.modal}→${closed}, phím còn [${r.keys}], trôi ${fx(Math.hypot(r.snap.x - p1.x, r.snap.z - p1.z))} m`);
  // E4: cửa sổ mất tiêu điểm lúc đang giữ W (Alt+Tab): phím được nhả, nhân vật dừng; quay lại bấm W đi tiếp bình thường
  await reset(page, { ...SPOT, yaw: camYaw + Math.PI, camYaw });
  await page.keyboard.down('KeyW'); await run(page, 30); await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await run(page, 120); r = await state(page);
  const stopped = Math.abs(r.snap.v) < 0.01 && r.keys.length === 0; await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyW'); const s4 = await run(page, 60); await page.keyboard.up('KeyW'); await run(page, 60);
  R.check('E4: mất tiêu điểm cửa sổ lúc giữ W thì dừng; bấm lại W đi tiếp', stopped && analyse(s4, 'fwd', 1, 0.3).path > 0.5, `dừng: ${stopped}, đi lại ${analyse(s4, 'fwd', 1, 0.3).path} m`);
  // E5: bấm vào nút HUD (tiêu điểm chuyển sang nút) rồi dùng WASD: vẫn điều khiển được; phím Space/Enter không bấm lại nút đó
  await reset(page, { ...SPOT, yaw: camYaw + Math.PI, camYaw });
  await page.click('#b-set'); await run(page, 10); const m1 = await page.evaluate(() => window.__game.hud.modal); await page.keyboard.press('Escape'); await run(page, 10);
  const m2 = await page.evaluate(() => ({ modal: window.__game.hud.modal, focus: document.activeElement && document.activeElement.id }));
  await page.keyboard.down('KeyW'); const s5 = await run(page, 60); await page.keyboard.up('KeyW'); await run(page, 30);
  await page.keyboard.press('Space'); await run(page, 10); const m3 = await page.evaluate(() => window.__game.hud.modal);
  R.check('E5: sau khi bấm nút ⚙️ rồi Esc, W vẫn đi tới; Space không mở lại bảng Cài đặt', m1 === 'settings' && m2.modal === null && analyse(s5, 'fwd', 1, 0.3).path > 0.5 && m3 === null, `bảng sau khi bấm ${m1}, sau Esc ${m2.modal} (tiêu điểm ở #${m2.focus}), đi được ${analyse(s5, 'fwd', 1, 0.3).path} m, sau Space bảng = ${m3}`);
}
R.check('không có pageerror / console.error trong suốt các phần A, B, C, E', errors.length === 0, errors.slice(0, 5).join(' | '));
await page.close();

// ===== D. VÒNG LẶP THẬT (không đồng hồ ảo): người chơi mới bấm "Bắt đầu" ở điểm xuất phát thật rồi bấm phím =====
if (want('d')) {
  const { page: p2, errors: e2 } = await openGame(browser, 'q=low&fresh&h=17.2&lang=vi', { start: 'click' });
  const snap = () => p2.evaluate(() => window.__qa.snap());
  const holdReal = async (key, gameSecs, norender) => {
    await p2.evaluate((nr) => { window.__norender = nr; }, norender);
    const a = await snap(); await p2.keyboard.down(key);
    await p2.evaluate((s) => window.__qa.waitGame(s), gameSecs);
    const b = await snap(); await p2.keyboard.up(key); await p2.evaluate(() => window.__qa.waitGame(0.6));
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1e-9;
    return { d: fx(d), fwd: fx((dx * a.fx + dz * a.fz) / d, 3), right: fx((dx * a.rx + dz * a.rz) / d, 3), camTurn: fx(b.camYaw - a.camYaw, 3) };
  };
  const s0 = await snap();
  // người chơi mới: camera phải ở SAU LƯNG nhân vật (nhân vật quay lưng lại ống kính)
  const facing = Math.sin(s0.yaw) * s0.fx + Math.cos(s0.yaw) * s0.fz;
  R.check('D0: lúc bắt đầu camera ở sau lưng nhân vật', facing > 0.95, `cos(góc giữa hướng mặt nhân vật và hướng nhìn camera) = ${fx(facing, 3)}`);
  const rows = [];
  for (const [key, axis, sign, nr] of [['KeyW', 'fwd', 1, false], ['KeyS', 'fwd', -1, false], ['KeyD', 'right', 1, true], ['KeyA', 'right', -1, true], ['ArrowUp', 'fwd', 1, true], ['ArrowDown', 'fwd', -1, true], ['ArrowLeft', 'right', -1, true], ['ArrowRight', 'right', 1, true]]) {
    const r = await holdReal(key, 1.5, nr); rows.push({ key, ve: !nr, ...r, ok: r.d > 0.6 && r[axis] * sign >= 0.9 });
  }
  const bad = rows.filter((r) => !r.ok);
  R.check('D1: vòng lặp thật tại điểm xuất phát (W, S có vẽ hình; còn lại tắt vẽ): 8 phím giữ 1,5 giây giờ game đều đúng hướng', bad.length === 0, bad.length ? JSON.stringify(bad) : rows.map((r) => `${NAME[r.key]} ${r.d} m`).join(', '));
  R.check('D: không có pageerror / console.error', e2.length === 0, e2.slice(0, 5).join(' | '));
  await p2.close();
}
await browser.close();
void SLOW;
process.exit(R.finish());
