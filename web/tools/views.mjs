// Chỗ đứng ngắm khi đi nhanh bằng bản đồ: mỗi điểm hộ chiếu một trường v = [x, z, hướng] (tools/build_places.mjs).
// Tới nơi thì người chơi đứng ở đó, quay mặt theo hướng ấy, camera sau lưng nhìn thấy công trình. Chọn bằng đúng va chạm của game
// (tools/reach_check.mjs), không đoán tay:
//   - chỗ đứng: đứng được, thoáng 0,6 m, đi bộ ra được đường; không ở lòng đường xe chạy (cách mép làn ≥ 0,5 m), không trên làn cầu;
//   - camera (4,4 m sau lưng, cao 2,25 m): đoạn từ người tới camera không vướng tường; không gốc cây nào trong dải 3,8 m quanh 7 m
//     đầu tầm nhìn (tán lá sát ống kính che nửa khung hình: tester vòng 3, Tháp Rùa);
//   - tầm nhìn: tia từ camera tới công trình (vài điểm trên thân, nhiều độ cao) không bị tường nhà chắn trước khi tới công trình;
//     cây đứng giữa đường nhìn bị trừ điểm; hồ thì phía trước phải là mặt nước;
//   - khoảng cách vừa với cỡ công trình, ưu tiên nhìn vào mặt tiền (công trình dựng tay có hướng mặt tiền).
// Phố và món ăn: đứng trên vỉa hè sát điểm (không giữa lòng đường), nhìn dọc phố, chếch về phía lòng đường.
import { G } from '../src/core/geo.js';
import { pointInRing, segDist2 } from '../src/core/util.js';
import { LB_TRUSS_X, CD_TRUSS_S, alongAt, roadY, chuongDuongMid } from '../src/world/data.js';

const CAM = 4.4, CAM_Y = 2.25; // camera.js: khoảng lùi mặc định khi đi bộ, độ cao ống kính (đầu 1,55 m + độ ngẩng 0,16 rad)
// Điểm hộ chiếu → công trình dựng tay cần nhìn thấy. Còn lại: toà nhà chứa toạ độ OSM của địa danh (nếu có), không thì chính toạ độ ấy.
const MODEL = { thap_rua: 'thap_rua', van_mieu: 'khue_van_cac', lang_bac: 'lang_bac', quang_truong_ba_dinh: 'lang_bac', cot_co_ha_noi: 'cot_co', cho_dong_xuan: 'cho_dong_xuan', chua_tran_quoc: 'thap_tran_quoc', nha_hat_lon: 'nha_hat_lon', nha_tho_lon: 'nha_tho_lon', chua_mot_cot: 'chua_mot_cot', o_quan_chuong: 'o_quan_chuong', ga_ha_noi: 'ga_ha_noi', thap_but_dai_nghien: 'ngoc_son_gate' };
const BRIDGE = { cau_long_bien: 'lb', bai_giua_song_hong: 'lb', cau_chuong_duong: 'cd' };
// Toà nhà cần nhìn khi tên trong dữ liệu khác tên địa danh (còn lại: toà nhà có tên trùng một phần tên địa danh trong 200 m, không
// có thì toà nhà chứa toạ độ OSM). Hoàng thành: cổng Đoan Môn; chợ Long Biên: các nhà chợ (ngành hàng hoa quả).
const BUILDING = { hoang_thanh_thang_long: 'Đoan Môn', cho_long_bien: 'Ngành hàng hoa quả' };
// Con phố của điểm "phố" (món ăn: trường street). Phố sách Hà Nội nằm trên phố 19 Tháng 12 (phố đi bộ, mở năm 2017), không phải
// phố Đinh Lễ cách đó 550 m; con đường gốm sứ chạy dọc tường đê Hồng Hà - Trần Quang Khải - Trần Nhật Duật.
const STREET = { pho_sach_dinh_le: ['Phố 19 Tháng 12'], con_duong_gom_su: ['Đường Hồng Hà', 'Đường Trần Quang Khải', 'Đường Trần Nhật Duật'] };
// Tuỳ chỉnh từng điểm: near [bán kính]: chỗ đứng phải trong vòng ấy quanh điểm đóng dấu (Bãi giữa: đứng trên bãi; quảng trường
// Ba Đình: đứng trên quảng trường nhìn về Lăng); ideal: khoảng cách đẹp tới công trình (m); water: phía trước phải là mặt hồ (Tháp Rùa đứng giữa hồ, bờ gần
// nhất cách tháp khoảng 75 m: dò tới 130 m).
const TUNE = {
  thap_rua: { ideal: 60, water: true }, ho_truc_bach: { water: true, ideal: 30 },
  quang_truong_ba_dinh: { near: 40 }, bai_giua_song_hong: { near: 45 },
  // pin: chỗ ngắm đã dò bằng GPU (đi tới từng chỗ ứng viên trong game, đếm điểm mẫu trên tường toà nhà thấy được), dùng khi phép thử
  // va chạm không đủ (phố cổ chật, nhiều mái bạt, tán cây). Vẫn soát lại bằng va chạm như mọi chỗ khác; hỏng thì tự tính lại.
  //  - đền Bạch Mã: vỉa hè đối diện trên phố Hàng Buồm, thấy trọn dãy cửa gỗ đỏ của đền (8 điểm mẫu, bề ngang 83% khung; chỗ tính
  //    bằng va chạm nhìn dọc phố Hàng Giầy, GPU đo 0 điểm);
  //  - Bưu điện Hà Nội: vỉa hè bờ hồ, nhìn sang toà nhà dài bên kia phố Đinh Tiên Hoàng (35 điểm mẫu, bề ngang 93% khung).
  den_bach_ma: { pin: [-120.6, -761.9, -2.94] }, buu_dien_bo_ho: { pin: [121, 241.2, 1.25] },
};

// Toà nhà cần nhìn: theo tên (BUILDING, hay tên toà nhà trùng một phần tên địa danh, trong 200 m quanh toạ độ OSM; lấy toà lớn nhất),
// không có thì toà chứa (hay gần nhất trong 15 m) toạ độ OSM. Dùng chung cho công cụ kiểm tầm nhìn.
const norm = (t) => (t || '').normalize('NFC').toLowerCase().trim();
export function findBuilding(world, it, x, z) {
  const alts = norm(it.name.vi).split(/[()]| - /).map((t) => t.trim()).filter((t) => t.length >= 5), want = BUILDING[it.id] && norm(BUILDING[it.id]);
  let best = null;
  for (const b of world.buildings) {
    if (Math.abs(b.cx - x) > 200 || Math.abs(b.cz - z) > 200) continue;
    const n = norm(world.names[b.name]); if (n.length < 5) continue;
    const hit = want ? n === want : alts.some((a) => a.includes(n) || n.includes(a));
    if (hit && Math.hypot(b.cx - x, b.cz - z) < 200 && (!best || b.area > best.area)) best = b;
  }
  if (!best) {
    let bd = 15;
    for (const b of world.buildings) {
      if (x < b.bb[0] - bd || x > b.bb[2] + bd || z < b.bb[1] - bd || z > b.bb[3] + bd) continue;
      const d = pointInRing(x, z, b.p) ? 0 : Math.max(0, b.bb[0] - x, x - b.bb[2], b.bb[1] - z, z - b.bb[3]);
      if (d < bd || (d === 0 && best && best.area < b.area)) { bd = d; best = b; }
    }
  }
  return best;
}
// điểm mẫu trên mặt tường ngoài của toà nhà: mỗi cạnh cách nhau chừng 2,5 m, lùi ra ngoài 0,6 m, ở hai độ cao; tối đa max điểm
export function facade(b, max = 100) {
  const p = b.p, n = p.length / 2, h = b.h || Math.max(6, (b.lv || 2) * 3.4); let area = 0;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1]; }
  const sg = area > 0 ? 1 : -1, out = []; // vòng ngược chiều kim đồng hồ (diện tích dương): pháp tuyến ngoài nằm bên phải cạnh
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, ax = p[i * 2], az = p[i * 2 + 1], ex = p[j * 2] - ax, ez = p[j * 2 + 1] - az, L = Math.hypot(ex, ez); if (L < 0.5) continue;
    const nx = (ez / L) * sg, nz = (-ex / L) * sg, m = Math.max(1, Math.round(L / 2.5));
    for (let k = 0; k < m; k++) { const t = (k + 0.5) / m, x = ax + ex * t + nx * 0.6, z = az + ez * t + nz * 0.6; for (const y of [2.2, Math.min(h * 0.6, 9)]) out.push([x, y, z]); }
  }
  if (out.length > max) { const k = out.length / max; return Array.from({ length: max }, (_, i) => out[Math.floor(i * k)]); }
  return out;
}

export async function makeViews(R, items, osmOf) {
  const { nav, world, sites } = R, out = new Map(), B = world.bounds;
  // ----- cỡ và hướng mặt tiền của công trình dựng tay -----
  const model = {};
  for (const s of sites) {
    const g = new G(); try { (await import(`../src/world/landmarks/${s.id}.js`)).build(g, { lf: new G() }); } catch { continue; }
    const p = g.pos, rs = []; let top = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < p.length; i += 3) { rs.push(Math.hypot(p[i], p[i + 2])); top = Math.max(top, p[i + 1]); x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); z0 = Math.min(z0, p[i + 2]); z1 = Math.max(z1, p[i + 2]); }
    rs.sort((a, b) => a - b);
    // hộp bao trong toạ độ mô hình (mặt tiền là phía +z), quay theo yaw như landmarks/index.js (mesh.rotation.y = yaw)
    const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
    model[s.id] = { x: s.x, z: s.z, r: Math.max(3, rs[Math.floor(rs.length * 0.9)] || 3), h: top, fx: sn, fz: c, box: [x0, z0, x1, z1],
      dist: (px, pz) => { const dx = px - s.x, dz = pz - s.z, lx = dx * c - dz * sn, lz = dx * sn + dz * c; return Math.hypot(Math.max(0, x0 - lx, lx - x1), Math.max(0, z0 - lz, lz - z1)); },
      world: (lx, lz) => [s.x + lx * c + lz * sn, s.z - lx * sn + lz * c] };
  }
  // ----- tim dàn thép hai cầu (y như landmarks/index.js): [x, z, cao độ mặt cầu, hướng x, hướng z] mỗi 10 m -----
  const truss = { lb: [], cd: [] }, o = [0, 0, 0, 0, 0];
  { const rail = world.rails.filter((r) => r.elev).sort((a, b) => b.len - a.len)[0];
    if (rail) for (let s = 0; s <= rail.len; s += 10) { alongAt(rail, s, o); if (o[0] > LB_TRUSS_X) truss.lb.push([o[0], o[1], roadY(rail, s), o[2], o[3]]); } }
  { const cd = chuongDuongMid(world); if (cd) { const { r, rev } = cd; for (let s = CD_TRUSS_S; s <= r.len; s += 10) { const q = rev ? r.len - s : s; alongAt(r, q, o); truss.cd.push([o[0], o[1], roadY(r, q), o[2], o[3]]); } } }
  const targetBuilding = (it, x, z) => findBuilding(world, it, x, z);

  // ----- các phép thử -----
  const trees = R.trees;
  // lòng đường xe chạy trên mặt đất (cầu nâng: phần đã lên cao không tính, nav.onRoad lo phần chân dốc)
  const vehAt = (x, z, pad) => { const h = nav.nearestRoad(x, z, 25, (r) => r.veh && !r.skip && !r.elev); return !!h && h.d < h.r.w / 2 + pad; };
  const onDeck = (x, z) => !!nav.elevatedAt(x, z, Infinity) && nav.eY > 0.7;
  const inMap = (x, z) => x > B.x0 + 12 && x < B.x1 - 12 && z > B.z0 + 12 && z < B.z1 - 12;
  const ground = (x, z) => inMap(x, z) && !nav.isWater(x, z) && !onDeck(x, z) && !nav.onRoad(x, z) && !vehAt(x, z, 0.5);
  // chỗ đứng nằm bên con phố có tên ấy (trong lòng đường hay trên vỉa hè hai bên, tới 6 m ngoài mép đường)
  const onNamed = (x, z, name) => { const h = nav.nearestRoad(x, z, 20, (r) => world.names[r.name] === name); return !!h && h.d < h.r.w / 2 + 6; };
  const stand = (x, z, clear = 0.6) => R.roomy(x, z, clear) && R.connected(x, z);
  // camera sau lưng: đoạn người → camera không vướng tường, chỗ camera thoáng 0,4 m
  // (camera của game tự rút ngắn khi vướng, nên chỉ cần thông 3 m; chỗ nào thông đủ 4,4 m thì được ưu tiên hơn: camRoom)
  const camOK = (x, z, ux, uz) => { const cx = x - ux * 3, cz = z - uz * 3; return nav.freeStep(x, z, cx, cz, 0.3) || (nav.raycast(x, z, -ux, -uz, 3.4, 1.6, 0.15) >= 3.4 && nav.clearAt(cx, cz, 0.35, 1.5)); };
  const camRoom = (x, z, ux, uz) => nav.freeStep(x, z, x - ux * CAM, z - uz * CAM, 0.35);
  // cây trong dải tầm nhìn: sát ống kính (7 m đầu) thì loại, giữa đường nhìn thì trừ điểm
  const treeHits = (cx, cz, ux, uz, len) => {
    let nearN = 0, midN = 0;
    for (const t of trees) {
      const dx = t[0] - cx, dz = t[1] - cz; if (Math.abs(dx) > len + 6 || Math.abs(dz) > len + 6) continue;
      const a = dx * ux + dz * uz, l = Math.abs(-dx * uz + dz * ux);
      if (a > -1.5 && a < 7.5 && l < 3.8) nearN++;
      else if (a >= 7.5 && a < len && l < 3.2) midN++;
    }
    return [nearN, midN];
  };
  // tia nhìn từ camera tới các điểm ngắm: tỉ lệ tia tới được điểm, hoặc chạm tường ngay trong vùng của chính công trình (hit(x, z))
  const sight = (cx, cz, pts, hit) => {
    let ok = 0;
    for (const [px, py, pz] of pts) {
      const dx = px - cx, dz = pz - cz, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
      const t = nav.raycast(cx, cz, ux, uz, d, CAM_Y, (py - CAM_Y) / d);
      if (t >= d - 0.5 || hit(cx + ux * t, cz + uz * t)) ok++;
    }
    return ok / pts.length;
  };
  // điểm mẫu thấy được từ camera (cx, cz) nhìn theo (ux, uz): tia tới được điểm, và điểm nằm trong khung (lệch ngang ≤ 38°, dọc ≤ 24°)
  const seen = (cx, cz, ux, uz, pts) => {
    const v = [];
    for (const q of pts) {
      const dx = q[0] - cx, dz = q[2] - cz, d = Math.hypot(dx, dz) || 1, c = (dx * ux + dz * uz) / d;
      if (c < 0.788 || Math.abs(Math.atan2(q[1] - CAM_Y, d)) > 0.42) continue;
      if (nav.raycast(cx, cz, dx / d, dz / d, d, CAM_Y, (q[1] - CAM_Y) / d) < d - 0.25) continue;
      // tán cây (bán kính chừng 3,5 m, cao từ 2,5 m) chắn tia nhìn: tia ở độ cao trên 2,5 m mà đi qua gần gốc cây thì không tính
      let leaf = false;
      for (const t of trees) {
        const tx = t[0] - cx, tz = t[1] - cz; if (Math.abs(tx) > d + 4 || Math.abs(tz) > d + 4) continue;
        const a = (tx * dx + tz * dz) / d; if (a < 0.5 || a > d - 1) continue;
        if (Math.abs((-tx * dz + tz * dx) / d) < 3.2 && CAM_Y + ((q[1] - CAM_Y) * a) / d > 2.3) { leaf = true; break; }
      }
      if (!leaf) v.push(q);
    }
    return v;
  };
  const wetAhead = (x, z, ux, uz) => { let n = 0, m = 0; for (let d = 6; d <= 40; d += 2) { m++; if (nav.isWater(x + ux * d, z + uz * d)) n++; } return n / m; };
  const r1 = (v) => +v.toFixed(1), r2 = (v) => +v.toFixed(2), DBG = process.env.VIEWS_VERBOSE ? {} : null;
  // chọn: điểm rẻ trước (cand: [điểm thô, x, z, ux, uz, ...]), 300 ứng viên tốt nhất mới thử tia nhìn và cây, rồi tới chỗ đứng, camera
  const choose = (cand, full) => {
    cand.sort((a, b) => a[0] - b[0]);
    const top = [];
    for (const c of cand.slice(0, 300)) { const f = full(c); if (f !== null) top.push([c[0] + f, c]); }
    top.sort((a, b) => a[0] - b[0]);
    // chỗ sau lưng chỉ thông 3–4,4 m cho camera thì trừ 4 điểm (camera sẽ áp gần hơn một chút)
    const ok = [];
    for (const [sc, c] of top) { if (ok.length && sc > ok[0][0] + 4) break; if (camOK(c[1], c[2], c[3], c[4]) && stand(c[1], c[2], 0.45)) { ok.push([sc + (camRoom(c[1], c[2], c[3], c[4]) ? 0 : 4), c]); ok.sort((p, q) => p[0] - q[0]); } }
    return ok.length ? [r1(ok[0][1][1]), r1(ok[0][1][2]), r2(Math.atan2(ok[0][1][3], ok[0][1][4]))] : null;
  };

  const T0 = performance.now(), verbose = process.env.VIEWS_VERBOSE;
  for (const it of items) {
    const t0 = performance.now();
    // hai điểm ở cầu Thê Húc, đền Ngọc Sơn: chỗ đứng trên cầu đã chọn tay (nhìn dọc cầu về đền), giữ nguyên
    if (it.id === 'cau_the_huc' || it.id === 'den_ngoc_son') { out.set(it.id, [it.s[0], it.s[1], r2(Math.atan2(it.x - it.s[0], it.z - it.s[1]))]); continue; }
    const tune = TUNE[it.id] || {}, street = it.kind === 'food' || it.type === 'street' || it.type === 'culture' || !!STREET[it.id];
    let pick = null, why = '';
    if (tune.pin) {
      const [x, z, yaw] = tune.pin; R.load(x, z, 30);
      if (ground(x, z) && stand(x, z, 0.45) && camOK(x, z, Math.sin(yaw), Math.cos(yaw))) { pick = tune.pin; why = 'ghim'; }
      else console.warn('  chỗ ngắm ghim của', it.id, 'không còn đứng được (dữ liệu đổi?): tính lại');
    }
    if (pick) { /* đã có */ } else if (street) { R.load(it.x, it.z, 50); pick = streetView(it); why = 'phố'; }
    else if (BRIDGE[it.id]) { pick = bridgeView(it, truss[BRIDGE[it.id]], tune); why = 'cầu'; }
    else { pick = ringView(it, tune); why = 'vòng'; }
    if (!pick) { console.warn('  không tìm được chỗ đứng ngắm cho', it.id, '— dùng chỗ đứng s', DBG ? JSON.stringify(DBG[it.id]) : ''); pick = [it.s[0], it.s[1], r2(Math.atan2(it.x - it.s[0], it.z - it.s[1]))]; }
    out.set(it.id, pick);
    if (verbose) console.log(`  ${it.id.padEnd(26)} ${why} → ${pick} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
  }
  if (verbose) console.log(`chỗ đứng ngắm: ${((performance.now() - T0) / 1000).toFixed(1)} s`);
  return out;

  // Công trình, hồ: dò vòng quanh mục tiêu.
  //  - công trình dựng tay: nhìn vào mặt tiền (chỗ đứng trong nón ±60° trước mặt tiền nếu có chỗ), cách chừng 1,3 × bán kính + 8 m;
  //  - toà nhà (không có mô hình riêng): điểm mẫu trên chính mặt tường, chọn chỗ thấy được nhiều điểm mẫu nhất trong khung, quay mặt
  //    về giữa phần tường thấy được;
  //  - hồ: đứng bờ quanh điểm đóng dấu, nhìn ra phía nhiều mặt nước nhất.
  function ringView(it, tune) {
    const m = MODEL[it.id] && model[MODEL[it.id]], lake = it.type === 'lake' && !m;
    const [ox, oz] = osmOf(it) || [it.x, it.z], bld = m || lake ? null : targetBuilding(it, ox, oz);
    let T;
    if (m) {
      // khoảng cách tính tới hộp bao của mô hình (Nhà hát Lớn, Lăng dài gấp mấy lần rộng: tính tới tâm thì đứng sát tường), khoảng cách
      // đẹp theo chiều cao (thấy được gần hết thân công trình); điểm ngắm trên mặt tiền
      T = { x: m.x, z: m.z, r: m.r, f: [m.fx, m.fz], pts: [], ideal: Math.min(45, Math.max(12, m.h * 1.15)), near: m.dist, hit: (x, z) => m.dist(x, z) < 1.5 };
      const [bx0, , bx1, bz1] = m.box;
      for (const h of [0.25, 0.6]) for (const t of [0.2, 0.5, 0.8]) { const [wx, wz] = m.world(bx0 + (bx1 - bx0) * t, bz1); T.pts.push([wx, Math.max(1.5, m.h * h), wz]); }
    } else if (bld) {
      const bb = bld.bb, r = Math.min(40, Math.hypot(bb[2] - bb[0], bb[3] - bb[1]) / 2);
      T = { x: (bb[0] + bb[2]) / 2, z: (bb[1] + bb[3]) / 2, r, fac: facade(bld), ideal: Math.min(55, Math.max(14, r * 1.4 + 6)) };
    } else T = { x: ox, z: oz, r: 6, pts: lake ? [] : [[ox, 2.5, oz], [ox, 6, oz]], ideal: 22, hit: (x, z) => Math.hypot(x - ox, z - oz) < 8 };
    if (tune.ideal) T.ideal = tune.ideal;
    const cx0 = lake || tune.near ? it.x : T.x, cz0 = lake || tune.near ? it.z : T.z, a0 = lake || tune.near ? 0 : T.r * (bld ? 0.4 : 1) + 5, a1 = lake ? 40 : tune.near || Math.max(T.ideal * 1.4, T.r + 30, tune.water ? 130 : 0);
    R.load(cx0, cz0, a1 + 20);
    const cand = [];
    for (let d = a0; d <= a1; d += 2) {
      const n = Math.max(16, Math.round((6.2832 * d) / 3));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * 6.2832, x = cx0 + Math.sin(a) * d, z = cz0 + Math.cos(a) * d;
        if (!ground(x, z) || !R.standable(x, z)) continue;
        let ux = T.x - x, uz = T.z - z; const dT = Math.hypot(ux, uz) || 1; ux /= dT; uz /= dT;
        if (lake) { let bw = -1; for (let q = 0; q < 16; q++) { const b = (q / 16) * 6.2832, w = wetAhead(x, z, Math.sin(b), Math.cos(b)); if (w > bw) { bw = w; ux = Math.sin(b); uz = Math.cos(b); } } }
        const wet = tune.water || lake ? wetAhead(x, z, ux, uz) : 0; if ((tune.water || lake) && wet < 0.5) continue;
        if (tune.street && !onNamed(x, z, tune.street)) continue;
        let sc = (lake ? 0 : Math.abs((T.near ? T.near(x, z) : dT) - T.ideal) * 0.6) - wet * 10 + Math.hypot(x - it.x, z - it.z) * 0.04;
        if (T.f) { const fd = ((x - T.x) / dT) * T.f[0] + ((z - T.z) / dT) * T.f[1]; sc += (1 - Math.max(0, fd)) * 30 + (fd < 0.5 ? 40 : 0); } // nhìn vào mặt tiền
        cand.push([sc, x, z, ux, uz, dT]);
      }
    }
    const st = DBG ? (DBG[it.id] = { cand: cand.length, vis: 0, tree: 0, cam: 0 }) : null;
    if (T.fac) { // toà nhà: chọn theo số điểm mẫu trên tường thấy được, rồi quay mặt về giữa phần tường thấy được
      cand.sort((p, q) => p[0] - q[0]);
      const top = [];
      for (const c of cand.slice(0, 200)) {
        const [, x, z] = c; let [, , , ux, uz] = c;
        let v = seen(x, z, ux, uz, T.fac); if (v.length < 4) { if (st) st.vis++; continue; }
        for (let it2 = 0; it2 < 2; it2++) { // hướng nhìn: về trọng tâm phần tường thấy được (tính từ chỗ đứng), thử lại từ camera
          let sx = 0, sz = 0; for (const q of v) { const dx = q[0] - x, dz = q[2] - z, dl = Math.hypot(dx, dz) || 1; sx += dx / dl; sz += dz / dl; }
          const l = Math.hypot(sx, sz) || 1; ux = sx / l; uz = sz / l;
          if (!camOK(x, z, ux, uz)) { v = []; break; }
          v = seen(x - ux * CAM, z - uz * CAM, ux, uz, T.fac);
          if (v.length < 4) break;
        }
        if (v.length < 4) { if (st) st.cam++; continue; }
        const [nearT, midT] = treeHits(x - ux * CAM, z - uz * CAM, ux, uz, Math.max(8, c[5] - T.r)); if (nearT) { if (st) st.tree++; continue; }
        top.push([c[0] * 0.5 - (v.length / T.fac.length) * 120 + midT * 4, x, z, ux, uz]);
      }
      top.sort((p, q) => p[0] - q[0]);
      for (const [, x, z, ux, uz] of top) if (stand(x, z, 0.45)) return [r1(x), r1(z), r2(Math.atan2(ux, uz))];
      return null;
    }
    const trace = process.env.VIEWS_TRACE === it.id;
    if (trace) { cand.sort((p, q) => p[0] - q[0]); for (const c of cand.slice(0, 25)) { const cx = c[1] - c[3] * CAM, cz = c[2] - c[4] * CAM; console.log('   ứng viên', c[1].toFixed(1), c[2].toFixed(1), 'điểm', c[0].toFixed(1), 'tầm nhìn', T.pts.length ? sight(cx, cz, T.pts, T.hit).toFixed(2) : '-', 'cây', treeHits(cx, cz, c[3], c[4], Math.max(8, c[5] - T.r)), 'cam', camOK(c[1], c[2], c[3], c[4]), 'đứng', stand(c[1], c[2], 0.45)); } }
    return choose(cand, ([, x, z, ux, uz, dT]) => {
      const cx = x - ux * CAM, cz = z - uz * CAM, vis = T.pts.length ? sight(cx, cz, T.pts, T.hit) : 1; if (vis < 0.5) { if (st) st.vis++; return null; }
      const [nearT, midT] = treeHits(cx, cz, ux, uz, lake ? 30 : Math.max(8, dT - T.r)); if (nearT) { if (st) st.tree++; return null; }
      return (1 - vis) * 40 + midT * 6;
    });
  }

  // Cầu dài vượt sông: điểm đóng dấu thường ở giữa sông. Dò dọc cả dàn cầu, đứng trên bờ, bãi (mặt đất, không trên làn cầu) cách tim
  // dàn 15–60 m, nhìn chếch dọc nhịp (lệch 35–60° so với trục cầu) tới điểm trên dàn cách đó 30 m; gần điểm đóng dấu hơn thì hơn.
  function bridgeView(it, L, tune) {
    const cand = [];
    for (let i = 0; i < L.length; i += 2) {
      const [qx, qz, , tx, tz] = L[i];
      if (tune.near && Math.hypot(qx - it.x, qz - it.z) > tune.near + 60) continue;
      for (const side of [1, -1]) for (let l = 15; l <= 60; l += 3) {
        const x = qx - tz * side * l, z = qz + tx * side * l;
        if (tune.near && Math.hypot(x - it.x, z - it.z) > tune.near) continue;
        if (!inMap(x, z) || nav.isWater(x, z)) continue;
        for (const dir of [1, -1]) {
          const j = i + dir * 3; if (j < 0 || j >= L.length) continue;
          const T = L[j], ux0 = T[0] - x, uz0 = T[1] - z, dT = Math.hypot(ux0, uz0) || 1, ux = ux0 / dT, uz = uz0 / dT;
          const c = Math.abs(ux * tx + uz * tz); // cos góc lệch với trục cầu
          cand.push([Math.abs(c - 0.7) * 25 + Math.abs(l - 30) * 0.3 + Math.hypot(x - it.x, z - it.z) * 0.05, x, z, ux, uz, dT, T]);
        }
      }
    }
    const ok = cand.filter((c) => ground(c[1], c[2]));
    if (ok.length) R.load(ok[0][1], ok[0][2], 60);
    return choose(ok, ([, x, z, ux, uz, dT, T]) => {
      const cx = x - ux * CAM, cz = z - uz * CAM, pts = [[T[0], T[2] + 3, T[1]], [T[0], T[2] + 8, T[1]]];
      const vis = sight(cx, cz, pts, () => false); if (vis < 0.5) return null;
      const [nearT, midT] = treeHits(cx, cz, ux, uz, dT - 8); if (nearT) return null;
      return (1 - vis) * 40 + midT * 6;
    });
  }

  // Phố, món ăn: đứng cạnh điểm, nhìn dọc phố về phía phố thông xa hơn. Con phố: tên trong trường street (món ăn) hay bảng STREET,
  // không thì con phố có tên nằm trong tên địa danh, phố Đường Tàu thì đường ray; cuối cùng mới là đường xe gần nhất. Phố có xe: đứng
  // trên vỉa hè (không ở lòng đường), chếch 15° về phía lòng đường (hè hẹp, camera sau lưng vướng mặt tiền thì 7,5° hay nhìn thẳng dọc
  // hè); phố đi bộ: đứng ngay trên phố; đường ray: đứng cạnh ray.
  function streetView(it) {
    const names = it.street ? [it.street] : STREET[it.id] || null, alts = norm(it.name.vi).split(/[()]| - /).map((t) => t.trim()).filter((t) => t.length >= 5);
    const nm = (r) => norm(world.names[r.name]);
    let h = null, kind = 'veh';
    if (names) h = nav.nearestRoad(it.x, it.z, 120, (r) => !r.skip && !r.elev && names.includes(world.names[r.name]));
    if (!h) h = nav.nearestRoad(it.x, it.z, 60, (r) => !r.skip && !r.elev && nm(r).length >= 5 && alts.some((a) => a.includes(nm(r))));
    let line = null;
    if (h) { line = { p: h.r.p, i: h.seg, px: h.px, pz: h.pz, w: h.r.w }; kind = h.r.veh ? 'veh' : 'walk'; }
    else if (/đường tàu/.test(norm(it.name.vi))) { // đường ray mặt đất gần nhất
      let bd = 100 * 100;
      for (const r of world.rails) { if (r.elev) continue; const p = r.p; for (let i = 0; i < p.length - 2; i += 2) { const t = [0], d = segDist2(it.x, it.z, p[i], p[i + 1], p[i + 2], p[i + 3], t); if (d < bd) { bd = d; line = { p, i, px: p[i] + (p[i + 2] - p[i]) * t[0], pz: p[i + 1] + (p[i + 3] - p[i + 1]) * t[0], w: 2.4 }; } } }
      kind = 'rail';
    }
    if (!line) { const q = nav.nearestRoad(it.x, it.z, 30, (r) => r.veh && !r.skip && !r.elev); if (q) line = { p: q.r.p, i: q.seg, px: q.px, pz: q.pz, w: q.r.w }; }
    if (!line) return null;
    const { p, i, px: hx, pz: hz, w } = line, tl = Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]) || 1, tx = (p[i + 2] - p[i]) / tl, tz = (p[i + 3] - p[i + 1]) / tl;
    R.load(hx, hz, 50);
    const offs = kind === 'walk' ? [0, 0.5] : kind === 'rail' ? [1.8, 2.4, 3] : [0.6, 0.9, 1.3, 1.8, 2.4];
    const okAt = (x, z) => inMap(x, z) && !nav.isWater(x, z) && !onDeck(x, z) && !vehAt(x, z, 0.5) && (kind !== 'veh' || !nav.onRoad(x, z));
    const best = [];
    for (const side of [1, -1]) for (const off of offs) for (let a = -8; a <= 8; a += 1) {
      const nx = -tz * side, nz = tx * side, e = kind === 'veh' ? w / 2 + off : off, x = hx + tx * a + nx * e, z = hz + tz * a + nz * e;
      if (!okAt(x, z)) continue;
      for (const dir of [1, -1]) {
        const far = Math.min(60, nav.raycast(x, z, tx * dir, tz * dir, 60, 2.5, 0)); // phố thông xa phía trước
        for (const ang of kind === 'veh' ? [0.26, 0.13, 0] : [0]) {
          const k = Math.cos(ang), q = Math.sin(ang), ux = tx * dir * k - nx * q, uz = tz * dir * k - nz * q;
          const cx = x - ux * CAM, cz = z - uz * CAM, [nearT, midT] = treeHits(cx, cz, ux, uz, 30);
          if (nearT) continue;
          // gần mép vỉa hè (0,6–0,9 m) và chếch 7,5°: camera sau lưng nằm ngoài tầm mái bạt, biển hiệu chìa ra từ mặt tiền
          best.push([-far * 0.3 + midT * 2 + Math.abs(off - (kind === 'veh' ? 0.75 : 0)) * 3 + Math.abs(a) * 0.2 + Math.abs(ang - 0.13) * 10, x, z, ux, uz]);
        }
      }
    }
    best.sort((a, b) => a[0] - b[0]);
    for (const [, x, z, ux, uz] of best) if (camOK(x, z, ux, uz) && stand(x, z, 0.45)) return [r1(x), r1(z), r2(Math.atan2(ux, uz))];
    return null;
  }
}
