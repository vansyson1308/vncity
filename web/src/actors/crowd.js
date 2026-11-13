// Người trên phố Hà Nội theo giờ và theo khu (docs/18 mục 5): người đi đường, công chức, học sinh quàng khăn đỏ, khách du lịch đeo ba lô,
// người gánh hàng rong đội nón lá đi sát mép vỉa hè, công nhân môi trường, người chạy bộ quanh hồ, khách ngồi ghế đẩu nhựa cạnh quán cóc,
// các tốp tập dưỡng sinh bên hồ lúc rạng sáng. Lưới và hoạt hình nằm ở cast.js (instancing + skinning trên GPU: 6 lệnh vẽ cho tất cả).
// Mỗi khung hình mỗi người chỉ tốn một lần dò đường đi và vài phép ghi mảng; người ngồi, người tập đứng yên thì gần như không tốn gì.
import { clamp, dampAngle, hash } from '../core/util.js';
import { K, CURB, ZONE, zoneAt, isSolemn } from '../world/data.js';
import { Cast, STYLE, PROP, WALK_FRAMES, TAICHI_FRAMES, SWING_FRAMES, JOG_FRAMES } from './cast.js';
import { STOOL_RED, STOOL_BLUE } from '../models/life.js';
import { stallLayout } from '../world/stalls.js';

// ----- bảng màu (tuyến tính) -----
const SHIRTS = [[0.85, 0.85, 0.82], [0.1, 0.22, 0.5], [0.62, 0.08, 0.08], [0.1, 0.1, 0.12], [0.12, 0.35, 0.18], [0.8, 0.6, 0.08], [0.45, 0.45, 0.47], [0.7, 0.28, 0.42], [0.18, 0.5, 0.55], [0.85, 0.42, 0.1], [0.55, 0.4, 0.7], [0.9, 0.82, 0.6], [0.03, 0.03, 0.04], [0.04, 0.07, 0.2], [0.3, 0.05, 0.07], [0.16, 0.17, 0.19]];
const BRIGHT = [[0.9, 0.42, 0.08], [0.85, 0.75, 0.1], [0.15, 0.55, 0.6], [0.8, 0.2, 0.3], [0.9, 0.9, 0.86], [0.3, 0.6, 0.25], [0.2, 0.35, 0.75], [0.85, 0.5, 0.6]];
const OFFICE = [[0.88, 0.88, 0.86], [0.88, 0.88, 0.86], [0.6, 0.72, 0.85], [0.82, 0.68, 0.72], [0.05, 0.07, 0.16], [0.07, 0.07, 0.08], [0.55, 0.57, 0.6]];
const DARK = [[0.02, 0.02, 0.025], [0.02, 0.02, 0.025], [0.03, 0.05, 0.14], [0.14, 0.15, 0.17], [0.3, 0.25, 0.16], [0.12, 0.08, 0.05]];
const EARTH = [[0.2, 0.1, 0.07], [0.12, 0.08, 0.16], [0.05, 0.07, 0.16], [0.08, 0.14, 0.1], [0.25, 0.08, 0.12], [0.16, 0.13, 0.1]];
const PASTEL = [[0.9, 0.9, 0.87], [0.9, 0.9, 0.87], [0.85, 0.62, 0.7], [0.62, 0.72, 0.85], [0.85, 0.8, 0.55], [0.7, 0.85, 0.74], [0.75, 0.2, 0.2]];
const PACKS = [[0.05, 0.05, 0.06], [0.1, 0.2, 0.5], [0.55, 0.1, 0.1], [0.4, 0.35, 0.22], [0.75, 0.3, 0.5], [0.1, 0.35, 0.2]];
const pick = (l) => l[Math.floor(Math.random() * l.length)];
const BEER = [-31.2, -696.6]; // ngã tư Tạ Hiện - Lương Ngọc Quyến (điểm hộ chiếu pho_ta_hien, public/world/places.json)
const KIND = { local: 0, office: 1, student: 2, tourist: 3, vendor: 4, sweeper: 5, jogger: 6, seated: 7, exercise: 8, idle: 9 };
const CLIP = { walk: 0, idle: 1, sit: 2, sit2: 3, taichi: 4, swing: 5, jog: 6, carry: 7 };

// Mật độ người và cơ cấu theo khung giờ. Trả về { f: mật độ 0..1, w: trọng số [dân phố, công chức, học sinh, khách du lịch, hàng rong, vệ sinh, chạy bộ],
// seat: phần ngồi quán, gym: phần tập thể dục bên hồ }.
// Tuyến đi bộ trong lòng quảng trường Đông Kinh Nghĩa Thục: [x0, z0, x1, z1, bề rộng] (m, gốc Hồ Gươm). Cách hàng bồn hoa quanh mép
// (gen/decor.js SQUARE.rows) ít nhất 3 m; cả vùng x -77..-30, z -372..-352 không chạm lòng đường, nhà, mặt nước (đã kiểm bằng ctx).
const PLAZA_LINES = [[-76, -370, -32, -370, 5], [-76, -365, -32, -365, 5], [-76, -360, -32, -360, 5], [-76, -355, -32, -355, 5], [-66, -371.5, -66, -352.5, 6], [-46, -371.5, -46, -352.5, 6]];
export function crowdMix(zone, h, lake) {
  let f, w, seat, gym = 0;
  if (h < 4.5 || h >= 23) { f = 0.12; w = [1, 0, 0, 0.4, 0.1, 0.5, 0]; seat = 0.06; }
  else if (h < 6.6) { f = lake ? 1 : 0.4; w = [2, 0.2, 0, 0.2, 3, 1, lake ? 3 : 0.3]; seat = 0.08; gym = lake ? 0.5 : 0; }       // rạng sáng: gánh hàng, tập dưỡng sinh, chạy bộ quanh hồ
  else if (h < 9) { f = 0.85; w = [2, 3, 2.5, 0.5, 1.5, 0.4, lake ? 1 : 0]; seat = 0.25; gym = lake && h < 7.6 ? 0.25 : 0; }      // cao điểm sáng: công chức, học sinh, quán ăn sáng kín ghế
  else if (h < 11.5) { f = 0.8; w = [3, 1, 0.2, 3, 1.5, 0.3, 0]; seat = 0.12; }                                                   // khách du lịch theo đoàn, buôn bán
  else if (h < 13.5) { f = 0.8; w = [2.5, 3, 0.4, 1.5, 0.8, 0.2, 0]; seat = 0.4; }                                               // trưa: dân văn phòng ăn trưa, trà đá
  else if (h < 17) { f = 0.5; w = [2, 0.8, 0.3, 2, 0.6, 0.3, 0]; seat = 0.12; }                                                   // đầu giờ chiều vắng
  else if (h < 19.5) { f = 0.9; w = [3, 2.5, 1.5, 2, 0.8, 0.5, lake ? 1 : 0]; seat = 0.3; gym = lake ? 0.08 : 0; }              // cao điểm chiều, bia hơi dọn bàn ra hè
  else { f = zone === ZONE.old || lake ? 1 : 0.5; w = [3, 0.5, 0.3, 4, 0.3, 0.8, lake ? 0.4 : 0]; seat = lake ? 0.15 : 0.35; }                  // tối: dạo hồ, phố cổ kín khách
  if (zone === ZONE.french) { w[1] *= 1.5; w[3] *= 0.8; w[4] *= 0.5; } else if (zone === ZONE.badinh) { w[1] *= 1.3; w[3] *= h >= 9 && h < 11.5 ? 1.5 : 0.5; w[4] *= 0.2; f *= 0.7; seat *= 0.4; }
  else if (zone !== ZONE.old) { w[0] *= 1.5; w[3] *= lake ? 1 : 0.3; f *= lake ? 1 : 0.75; }
  if (lake) w[3] *= 1.4;
  return { f, w, seat, gym };
}

export class Crowd {
  constructor(scene, world, nav, humanLod, quality, humanFar, humanFull) {
    this.nav = nav; this.world = world; this.max = quality.crowd; // max: số người vẽ đủ chi tiết; tổng số người gấp 3,2 lần (người ở xa là lưới 630 tam giác)
    const total = Math.round(quality.crowd * 3.2) + 2;
    const cap = Math.round(total * 3); // tối phố đi bộ đông gấp ba ngày thường (step: boost)
    this.cast = new Cast(scene, humanLod, humanFar || humanLod, humanFull || humanLod, quality, { near: quality.crowd + 2, far: cap, kit: cap });
    this.nearR2 = (quality.name === 'high' ? 22 : quality.name === 'low' ? 11 : 16) ** 2;
    this.bake = this.cast.bake; this.idleRow = this.cast.rows.idle[0];
    // các tuyến đi bộ: vỉa hè hai bên phố và lối dạo
    this.paths = [];
    for (const r of world.roads) {
      if (r.skip || r.bridge || r.len < 12) continue;
      const foot = !r.veh; if (r.veh && r.kind > K.residential) continue; if (r.kind === K.steps) continue;
      const p = r.p, cum = [0]; for (let i = 0; i < p.length - 2; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]));
      this.paths.push({ r, p, cum, len: cum[cum.length - 1], foot, zone: zoneAt(p[0], p[1]), shore: false });
    }
    // Quảng trường Đông Kinh Nghĩa Thục (nền nhà Hàm Cá Mập đã phá, gen/decor.js SQUARE): bản đồ không có lối đi nào trong lòng quảng
    // trường nên người chỉ men theo vỉa hè quanh mép, tối cuối tuần quảng trường trống trơn (QC vòng 2). Các tuyến đi bộ dựng thêm cắt
    // ngang lòng quảng trường (trong hàng bồn hoa): ngày thường có người băng qua, đứng xem màn hình; tối phố đi bộ đông như phố đi bộ.
    for (const [x0, z0, x1, z1, w] of PLAZA_LINES) {
      const len = Math.hypot(x1 - x0, z1 - z0), r = { p: [x0, z0, x1, z1], w, veh: false, walk: false, kind: K.pedestrian, bb: [Math.min(x0, x1) - w / 2, Math.min(z0, z1) - w / 2, Math.max(x0, x1) + w / 2, Math.max(z0, z1) + w / 2], len };
      this.paths.push({ r, p: r.p, cum: [0, len], len, foot: true, plaza: true, zone: zoneAt(x0, z0), shore: false });
    }
    // hồ lớn (Hồ Gươm, Hồ Tây, Trúc Bạch...): lối dạo ven hồ và các chỗ tập thể dục buổi sáng sát mép nước
    this.lakes = world.water.filter((w) => (w.bb[2] - w.bb[0]) * (w.bb[3] - w.bb[1]) > 20000 && zoneAt((w.bb[0] + w.bb[2]) / 2, (w.bb[1] + w.bb[3]) / 2) !== ZONE.bank && w.bb[2] - w.bb[0] < 1000);
    this.spots = [];
    for (const path of this.paths) {
      if (!path.foot || !this.lakeNear(path.r.bb[0], path.r.bb[1], 40) && !this.lakeNear(path.r.bb[2], path.r.bb[3], 40)) continue;
      const o = [0, 0, 0, 0];
      for (let s = 6; s < path.len - 4; s += 26) {
        this.at(path, s, o); if (nav.isWater(o[0], o[1])) continue;
        for (const sd of [1, -1]) { const nx = -o[3] * sd, nz = o[2] * sd; if (nav.isWater(o[0] + nx * 9, o[1] + nz * 9) || nav.isWater(o[0] + nx * 15, o[1] + nz * 15)) { path.shore = true; this.spots.push({ x: o[0], z: o[1], nx, nz, used: false, id: this.spots.length }); break; } }
      }
    }
    // quán cóc (điểm ăn uống trong dữ liệu bản đồ): lưới 64 m để tìm nhanh quanh người chơi
    this.stalls = new Map();
    for (let i = 0; i < world.food.length; i += 3) { const x = world.food[i], z = world.food[i + 1]; if (isSolemn(x, z)) continue; const k = Math.floor(x / 64) * 65537 + Math.floor(z / 64); let l = this.stalls.get(k); if (!l) this.stalls.set(k, (l = [])); l.push({ x, z, i: i / 3, used: false, bad: false }); }
    this.guest = null; // khách xe ôm đang đứng vẫy
    this.people = []; this.near = []; this.nearT = 0; this.time = 0; this.frame = 0; this.mix = crowdMix(ZONE.old, 12, false); this.lake = false; this.hours = 12; this.seatMiss = 0; this.gymMiss = 0; this.seatOff = -1; this.gymOff = -1;
    this._o = [0, 0, 0, 0]; this._pt = { x: 0, z: 0 }; this._cam = { x: 0, z: 0, fx: 0, fz: 1 };
    this.walkOn = false; // phố đi bộ đang mở (lớp ngoài gán): trên các phố đó người đi cả dưới lòng đường
    this.walkNear = false; this.beer = false; // đang ở gần phố đi bộ đang mở / phố bia Tạ Hiện buổi tối (tính lại 1,5 giây một lần)
  }
  lakeNear(x, z, pad) { for (const w of this.lakes) if (x > w.bb[0] - pad && x < w.bb[2] + pad && z > w.bb[1] - pad && z < w.bb[3] + pad) return true; return false; }

  at(path, s, out) {
    const p = path.p, cum = path.cum; let i = 0; while (i < cum.length - 2 && cum[i + 1] < s) i++;
    const L = cum[i + 1] - cum[i] || 1, t = clamp((s - cum[i]) / L, 0, 1);
    out[0] = p[i * 2] + (p[i * 2 + 2] - p[i * 2]) * t; out[1] = p[i * 2 + 1] + (p[i * 2 + 3] - p[i * 2 + 1]) * t; out[2] = (p[i * 2 + 2] - p[i * 2]) / L; out[3] = (p[i * 2 + 3] - p[i * 2 + 1]) / L;
  }
  // Một người: mọi trường có mặt ngay từ đầu (một hình dạng đối tượng duy nhất).
  person(kind, x, z, yaw) {
    return { kind, path: null, s: 0.5, dir: 1, lat: 0.5, x, z, y: CURB, yaw, v: 0.5, clip: CLIP.idle, phase: Math.random(), scale: 0.9 + Math.random() * 0.16, tint: pick(SHIRTS), tint2: null, style: 0, props: 0, ptint: null, dist: 0.5, pause: 0.5, anchor: null, stat: false, life: 1e9 };
  }
  // Quần áo, đồ mang theo kiểu người.
  dress(a) {
    const r = Math.random, k = a.kind, T = STYLE.tone;
    let style = (r() < 0.55 ? STYLE.sleeve : 0) | (r() < 0.55 ? STYLE.noTail : 0) | (r() < 0.1 ? T * 3 : 0); // cuối thu: quá nửa mặc áo dài tay; một số người lớn tuổi tóc bạc
    a.tint2 = r() < 0.4 ? null : pick(DARK);
    if (k === KIND.office) { a.tint = pick(OFFICE); a.tint2 = pick(DARK); style = STYLE.sleeve | (r() < 0.7 ? STYLE.noTail : 0); if (r() < 0.35) { a.props |= PROP.bag; a.ptint = pick(DARK); } a.scale = 0.94 + r() * 0.1; }
    else if (k === KIND.student) { a.tint = OFFICE[0]; a.tint2 = DARK[2]; style = r() < 0.5 ? STYLE.noTail : 0; a.scale = 0.74 + r() * 0.12; if (r() < 0.7) a.props |= PROP.scarf; if (r() < 0.8) { a.props |= PROP.backpack; a.ptint = pick(PACKS); } }
    else if (k === KIND.tourist) { a.tint = pick(BRIGHT); a.tint2 = r() < 0.5 ? null : pick([[0.5, 0.42, 0.28], [0.16, 0.17, 0.19], [0.45, 0.45, 0.42]]); const t = r(); style = (r() < 0.5 ? STYLE.shorts : 0) | (r() < 0.25 ? STYLE.sleeve : 0) | (r() < 0.45 ? STYLE.noTail : 0) | (t < 0.4 ? T : t < 0.7 ? T * 2 : 0);
      a.scale = 1.02 + r() * 0.11; if (r() < 0.65) { a.props |= PROP.backpack; a.ptint = pick(PACKS); } const hh = r(); if (hh < 0.14) a.props |= PROP.nonla; else if (hh < 0.4) { a.props |= PROP.cap; if (!a.ptint) a.ptint = pick(PACKS); } }
    else if (k === KIND.vendor) { a.tint = pick(EARTH); a.tint2 = pick(DARK); style = STYLE.sleeve | (r() < 0.3 ? STYLE.noTail : 0); const l = r(); a.props = PROP.nonla | PROP.ganh | (l < 0.45 ? PROP.fruit : l < 0.8 ? PROP.flowers : PROP.pot); a.scale = 0.88 + r() * 0.08; }
    else if (k === KIND.sweeper) { a.tint = r() < 0.6 ? [0.95, 0.4, 0.04] : [0.1, 0.5, 0.2]; a.tint2 = DARK[2]; style = STYLE.sleeve | STYLE.noTail; a.props = PROP.nonla; a.scale = 0.9 + r() * 0.08; }
    else if (k === KIND.jogger) { a.tint = pick(BRIGHT); a.tint2 = DARK[0]; style = (r() < 0.65 ? STYLE.shorts : 0) | (r() < 0.6 ? STYLE.noTail : 0) | (r() < 0.25 ? T * 3 : 0); }
    else if (k === KIND.exercise) { a.tint = pick(PASTEL); a.tint2 = r() < 0.5 ? DARK[0] : PASTEL[0]; style = (r() < 0.7 ? STYLE.sleeve : 0) | (r() < 0.6 ? T * 3 : 0) | (r() < 0.5 ? STYLE.noTail : 0); a.scale = 0.88 + r() * 0.1; }
    else if (r() < 0.12) { a.props |= r() < 0.6 ? PROP.bag : PROP.cap; a.ptint = pick(PACKS); }
    // Người chơi (Minh) mặc áo đen, buộc tóc, cùng mẫu người với đám đông: không cho người đi đường trùng đúng tổ hợp ấy (QC vòng 3 thấy
    // một "bản sao" đứng ngay cạnh người chơi). Áo tối màu thì không buộc tóc.
    if (a.tint && a.tint[0] * 0.3 + a.tint[1] * 0.59 + a.tint[2] * 0.11 < 0.2) style |= STYLE.noTail;
    a.style = style;
  }

  // ----- sinh người -----
  spawnWalker(px, pz, cam) {
    if (!this.near.length) return false;
    const path = this.near[Math.floor(Math.random() * this.near.length)], o = this._o, s = Math.random() * path.len;
    this.at(path, s, o);
    // chọn kiểu người theo trọng số của khung giờ
    const w = this.mix.w; let tot = 0; for (let i = 0; i < 7; i++) tot += w[i]; let rr = Math.random() * tot, kind = 0; for (let i = 0; i < 7; i++) { rr -= w[i]; if (rr <= 0) { kind = i; break; } }
    if (kind === KIND.jogger && !path.shore) kind = KIND.local;
    if ((kind === KIND.vendor || kind === KIND.sweeper) && path.foot) kind = KIND.local;
    const side = Math.random() < 0.5 ? -1 : 1, kerb = kind === KIND.vendor || kind === KIND.sweeper, mall = this.walkOn && !!path.r.walk && !kerb;
    const lat = path.foot || mall ? (Math.random() - 0.5) * Math.max(0.4, path.r.w - 0.8) : side * (path.r.w / 2 + (kerb ? 0.42 + Math.random() * 0.15 : 0.75 + Math.random() * 0.9));
    const x = o[0] - o[3] * lat, z = o[1] + o[2] * lat, d = Math.hypot(x - px, z - pz);
    // người dạo phố đi bộ sinh trong 55 m, đi xa quá 70 m thì bỏ (cùng số người mà quanh người chơi đông hơn hẳn: QC vòng 3 thấy lòng
    // phố Đinh Tiên Hoàng tối thứ Bảy thưa vì người rải khắp vùng 95 m)
    if (d < (this.warming ? 6 : 14) || d > (mall ? 55 : 95)) return false;
    if (cam && !this.warming && d < 45 && (x - cam.x) * cam.fx + (z - cam.z) * cam.fz > 0 && Math.random() < 0.8) return false;
    const pt = this._pt; pt.x = x; pt.z = z; if (this.nav.collide(pt, 0.3) || this.nav.isWater(x, z)) return false;
    // lối đi bộ trong dữ liệu có khúc chạy xuyên qua lòng nhà (lối không tên ở phố Hàng Bạc, tester vòng 3): không sinh người ở đó
    if (path.foot && this.nav.insideNear(x, z)) return false;
    // người trên vỉa hè: từ mép đường tới chỗ đứng không cắt bức tường nào (hè hẹp thì làn đi xa mép đường đã nằm trong nhà)
    if (!path.foot && !mall && !this.nav.freeStep(o[0] - o[3] * Math.sign(lat) * (path.r.w / 2 + 0.2), o[1] + o[2] * Math.sign(lat) * (path.r.w / 2 + 0.2), x, z, 0.25)) return false;
    const a = this.person(kind, x, z, Math.random() * 6.28);
    a.path = path; a.s = s; a.dir = Math.random() < 0.5 ? 1 : -1; a.lat = lat; a.mall = mall;
    // đứng chờ, đứng xem hàng, đứng chuyện trên quảng trường: chỉ khi chỗ đó không thuộc lòng đường xe chạy (lối đi bộ vẽ đè lên lòng
    // đường, miệng nút giao loe rộng: tester vòng 3 thấy người đứng yên 0,6–0,7 m trong lòng đường Lê Thái Tổ, Hàng Trống)
    if ((kind === KIND.local || kind === KIND.tourist) && (path.plaza ? Math.random() < 0.3 : kind === KIND.local && !path.foot && Math.random() < 0.16) && !this.onCarriage(x, z)) { a.kind = KIND.idle; a.stat = true; a.v = 0; }
    else { a.clip = kind === KIND.vendor ? CLIP.carry : kind === KIND.jogger ? CLIP.jog : CLIP.walk; a.v = kind === KIND.vendor ? 0.85 + Math.random() * 0.25 : kind === KIND.sweeper ? 0.5 + Math.random() * 0.2 : kind === KIND.jogger ? 2.3 + Math.random() * 0.7 : kind === KIND.tourist ? 0.8 + Math.random() * 0.3 : kind === KIND.student ? 1.1 + Math.random() * 0.4 : 0.9 + Math.random() * 0.5; }
    this.dress(a); this.people.push(a); return true;
  }
  // chỗ đặt người đứng yên: không chạm tường, không dưới nước, không trong lòng đường; có (kx, kz) thì từ đó tới chỗ đứng không cắt
  // tường (khách quán cóc trên hè hẹp từng bị đặt vào trong nhà: tester vòng 3, (−32,7; −486,5), (−26,1; −393,1))
  ok(x, z, kx, kz) { const pt = this._pt; pt.x = x; pt.z = z; return !this.nav.collide(pt, 0.32) && !this.nav.isWater(x, z) && !this.nav.onRoad(x, z) && (kx === undefined || this.nav.freeStep(kx, kz, x, z, 0.2)); }
  // (x, z) nằm trong lòng một đường xe chạy (mặt đường thấp hơn vỉa hè, hay cách tim một đường xe dưới nửa bề rộng + 0,2 m)
  onCarriage(x, z) { if (this.nav.onRoad(x, z)) return true; const h = this.nav.nearestRoad(x, z, 15, (r) => r.veh && !r.elev); return !!h && h.d < h.r.w / 2 + 0.2; }
  visible(x, z, px, pz, cam, near) { const d = Math.hypot(x - px, z - pz); return !this.warming && cam && d < near && (x - cam.x) * cam.fx + (z - cam.z) * cam.fz > 0; }
  // Khách ngồi ghế đẩu cạnh một quán cóc: hai bên dãy bàn của quán, quay mặt vào nhau; có khi thêm một người đứng chờ.
  spawnStall(px, pz, cam) {
    // quán gần người chơi được ngồi kín trước: lấy quán còn trống gần nhất trong chín ô lưới quanh đó (bỏ quán đang nằm ngay trước ống kính)
    const cx = Math.floor(px / 64), cz = Math.floor(pz / 64), dmin = this.warming ? 5 : 12; let st = null, bd = 85 * 85;
    for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gz = cz - 1; gz <= cz + 1; gz++) { const l = this.stalls.get(gx * 65537 + gz); if (!l) continue;
      for (const q of l) { if (q.used || q.bad) continue; const dq = (q.x - px) ** 2 + (q.z - pz) ** 2; if (dq < bd && dq > dmin * dmin && !this.visible(q.x, q.z, px, pz, cam, 40)) { bd = dq; st = q; } } }
    if (!st) return 0;
    const rd = this.nav.nearestRoad(st.x, st.z, 22, (r) => r.veh && r.kind <= K.residential); if (!rd || rd.d < 0.5) { st.bad = true; return 0; }
    const ux = (st.x - rd.px) / rd.d, uz = (st.z - rd.pz) / rd.d, bx = rd.px + ux * (rd.r.w / 2 + 1.05), bz = rd.pz + uz * (rd.r.w / 2 + 1.05), tx = uz, tz = -ux; // tx,tz: dọc theo phố
    const kx = rd.px + ux * (rd.r.w / 2 + 0.25), kz = rd.pz + uz * (rd.r.w / 2 + 0.25); // mép vỉa hè ngay trước quán
    // khách ngồi vào các chỗ quanh bàn của đúng quán này (cùng bố cục với bàn ghế dựng sẵn: world/stalls.js), quay mặt vào bàn
    const lay = stallLayout(st.i * 3), seed = st.i * 131 + 7, red = lay.red, n = this.beer ? lay.seats.length : Math.min(lay.seats.length, 1 + Math.floor(hash(seed, 1) * 3.6)), first = Math.floor(hash(seed, 2) * lay.seats.length); let made = 0;
    for (let k = 0; k < n; k++) {
      const [lx, lz, tbl] = lay.seats[(first + k) % lay.seats.length], x = bx + tx * lx + ux * lz, z = bz + tz * lx + uz * lz; if (!this.ok(x, z, kx + tx * lx, kz + tz * lx)) continue;
      const fx = tx * (tbl - lx) - ux * lz, fz = tz * (tbl - lx) - uz * lz; // hướng từ ghế tới bàn
      const a = this.person(KIND.seated, x, z, Math.atan2(fx, fz) + (hash(seed, 30 + k) - 0.5) * 0.5);
      a.kind = Math.random() < 0.25 ? KIND.tourist : Math.random() < 0.4 ? KIND.office : KIND.local; this.dress(a); a.kind = KIND.seated;
      a.props = (a.props & (PROP.cap | PROP.scarf)) | PROP.stool; a.ptint = red ? STOOL_RED : STOOL_BLUE; a.clip = hash(seed, 40 + k) < 0.4 ? CLIP.sit2 : CLIP.sit; a.stat = true; a.v = 0; a.anchor = st;
      this.people.push(a); made++;
    }
    if (made && hash(seed, 3) < 0.4) { const x = bx + ux * 0.9 + tx * (hash(seed, 4) - 0.5) * 2, z = bz + uz * 0.9 + tz * (hash(seed, 4) - 0.5) * 2; if (this.ok(x, z, kx + tx * (hash(seed, 4) - 0.5) * 2, kz + tz * (hash(seed, 4) - 0.5) * 2)) { const a = this.person(KIND.idle, x, z, Math.atan2(-ux, -uz)); this.dress(a); a.stat = true; a.v = 0; a.anchor = st; this.people.push(a); made++; } }
    if (made) st.used = true; else st.bad = true;
    return made;
  }
  // Một tốp tập dưỡng sinh sát mép hồ: đứng thành hàng, quay mặt ra hồ, cùng một nhịp.
  spawnGroup(px, pz, cam, room) {
    if (!this.spots.length) return 0;
    // ưu tiên chỗ gần người chơi (trong 130 m), không có thì mới lấy chỗ xa hơn bên kia hồ
    let sp = null, cnt = 0, viewOnly = false; const lim = Math.random() < 0.75 ? 130 : 240;
    // lúc rải người ban đầu (vào game, đi nhanh tới nơi) chỗ tập nằm trong khung hình được chọn trước: ra tới bờ hồ lúc rạng sáng là
    // thấy ngay các tốp tập, không phải quay camera tìm
    // (chỗ tập cách một tốp đang tập dưới 12 m thì bỏ: hai tốp đứng sát nhau thì người hai tốp chồng lên nhau, tester vòng 3)
    const busy = this.spots.filter((q) => q.used && Math.abs(q.x - px) < lim + 12 && Math.abs(q.z - pz) < lim + 12);
    for (const q of this.spots) { if (q.used) continue; const d = Math.hypot(q.x - px, q.z - pz); if (d > lim || d < (this.warming ? 8 : 16) || busy.some((u) => (u.x - q.x) ** 2 + (u.z - q.z) ** 2 < 144)) continue;
      // trong khung hình: tâm tốp (lùi 3 m ra phía mặt nước) lệch hướng nhìn dưới 37° (nửa khung ngang chừng 44°), trong 60 m
      const gx = q.x + q.nx * 3, gz = q.z + q.nz * 3, gd = Math.hypot(gx - cam?.x, gz - cam?.z);
      // lúc rải người ban đầu: có chỗ tập trong khung thì chỉ chọn trong số đó (trọng số thôi thì có lần không tốp nào lọt khung)
      const inView = this.warming && cam && gd < 60 && (gx - cam.x) * cam.fx + (gz - cam.z) * cam.fz > 0.8 * gd;
      if (inView && !viewOnly) { viewOnly = true; cnt = 0; sp = null; }
      if (viewOnly && !inView) continue;
      cnt += 1; if (Math.random() * cnt < 1) sp = q; }
    if (!sp || this.visible(sp.x, sp.z, px, pz, cam, 60)) return 0;
    const n = Math.min(room, 4 + Math.floor(Math.random() * 6)), cols = n > 6 ? 4 : 3, clip = Math.random() < 0.65 ? CLIP.taichi : CLIP.swing, phase = Math.random(), yaw = Math.atan2(sp.nx, sp.nz), tx = -sp.nz, tz = sp.nx; let made = 0;
    // hàng đầu (sát mặt nước) cách mép nước ít nhất 1,2 m (bờ hẹp thì cả tốp lùi vào phía lối dạo)
    let wd = 12; for (let d = 1; d <= 12; d += 0.5) if (this.nav.isWater(sp.x + sp.nx * d, sp.z + sp.nz * d)) { wd = d; break; }
    const row0 = clamp(wd - 1.2, 1.5, 4.4);
    for (let k = 0; k < n; k++) {
      const c = k % cols, rw = Math.floor(k / cols), fw = Math.max(-1.2, row0 - rw * 1.5), x = sp.x + tx * (c - (cols - 1) / 2) * 1.5 + sp.nx * fw + (Math.random() - 0.5) * 0.25, z = sp.z + tz * (c - (cols - 1) / 2) * 1.5 + sp.nz * fw + (Math.random() - 0.5) * 0.25; // giữa lối dạo và mép nước
      // vướng (gốc cây, ghế đá, mép nước) thì thử dịch 0,6 m sang hai bên hay lùi vào trước khi bỏ chỗ
      let qx = x, qz = z, good = this.ok(x, z);
      for (const [a2, b2] of [[0.6, 0], [-0.6, 0], [0, -0.6], [0.6, -0.6], [-0.6, -0.6]]) { if (good) break; qx = x + tx * a2 + sp.nx * b2; qz = z + tz * a2 + sp.nz * b2; good = this.ok(qx, qz); }
      if (!good) continue;
      const a = this.person(KIND.exercise, qx, qz, yaw + (Math.random() - 0.5) * 0.12); this.dress(a); a.y = this.nav.groundY(qx, qz); a.clip = clip; a.phase = phase + (Math.random() - 0.5) * 0.03; a.stat = true; a.v = 0; a.anchor = sp;
      this.people.push(a); made++;
    }
    if (made) sp.used = true; // (kể cả tốp chỉ đặt được một người: không để tốp khác đứng chồng lên cùng chỗ)
    return made;
  }

  prewarm(player, camera, hours) { this.warming = true; for (let i = 0; i < 90; i++) this.step(0.1, player, camera, hours === undefined ? 17.2 : hours, false); this.warming = false; }
  setGuest(x, z, yaw) { if (x === null || x === undefined) { this.guest = null; return; } const g = this.person(KIND.idle, x, z, yaw); g.scale = 1; g.tint = [0.95, 0.75, 0.1]; g.stat = true; this.guest = g; }

  update(dt, player, camera, hours) { this.step(dt, player, camera, hours === undefined ? this.hours : hours, true); }
  step(dt, player, camera, hours, draw) {
    const px = player.pos.x, pz = player.pos.z, P = this.people, o = this._o, cam = this._cam, R = this.cast.rows;
    this.time += dt; this.frame++; this.hours = hours; const T0 = this.time;
    { const e = camera.matrixWorld.elements; cam.x = e[12]; cam.z = e[14]; cam.fx = -e[8]; cam.fz = -e[10]; }
    this.nearT -= dt;
    if (this.nearT <= 0) {
      this.nearT = 1.5; this.near.length = 0;
      const zone = zoneAt(px, pz); this.lake = this.lakeNear(px, pz, 150); this.mix = crowdMix(zone, hours, this.lake);
      const shoreBoost = this.lake && (hours < 7.6 || hours >= 17) ? 2.2 : 1;
      this.walkNear = false;
      for (const path of this.paths) { const b = path.r.bb; if (b[0] < px + 95 && b[2] > px - 95 && b[1] < pz + 95 && b[3] > pz - 95) { const n = Math.max(1, Math.round((path.len / 40) * (path.foot ? 2.5 * (path.shore ? shoreBoost : 1) : path.zone === ZONE.old ? 2 : path.r.kind >= K.residential ? 0.6 : 1))); const mall = this.walkOn && (path.r.walk || path.plaza); if (mall && path.r.walk) this.walkNear = true; for (let i = 0, m = mall ? n * 10 : n; i < m; i++) this.near.push(path); } }
      // phố bia Tạ Hiện (ngã tư Tạ Hiện - Lương Ngọc Quyến, toạ độ của điểm hộ chiếu pho_ta_hien): tối nào cũng kín ghế nhựa
      this.beer = (hours >= 18 || hours < 0.5) && Math.hypot(px - BEER[0], pz - BEER[1]) < 160;
    }
    // huỷ người đã ra xa; tốp tập thể dục tan khi hết giờ (lúc khuất mắt)
    let seated = 0, gym = 0;
    const gymOn = this.mix.gym > 0;
    for (let i = P.length - 1; i >= 0; i--) {
      const a = P[i], d = Math.hypot(a.x - px, a.z - pz);
      if (a.gone || d > (a.kind === KIND.exercise ? 250 : a.stat ? 118 : a.mall ? 70 : 105) || (a.kind === KIND.exercise && !gymOn && (d > 70 || (a.x - cam.x) * cam.fx + (a.z - cam.z) * cam.fz < 0))) { if (a.anchor) a.anchor.used = false; P[i] = P[P.length - 1]; P.pop(); continue; }
      if (a.kind === KIND.seated) seated++; else if (a.kind === KIND.exercise) gym++;
    }
    // sinh thêm cho đủ số theo giờ
    // Phần ngồi quán và phần tập thể dục có suất riêng (không bị người đi bộ chiếm hết chỗ); quanh đây không có quán, không có bờ hồ
    // thì sau vài chục lần thử hụt, suất đó trả lại cho người đi bộ trong 20 giây.
    // Tối phố đi bộ (phố đi bộ đang mở ở gần) đông gấp ba, phố bia Tạ Hiện buổi tối đông gấp 2,5 và quá nửa là khách ngồi quán (QC vòng
    // 3: tối thứ Bảy lòng phố Đinh Tiên Hoàng chỉ 3–4 người, Hàng Đào chừng 5; Tạ Hiện 21 giờ thứ Tư gần như vắng). Người ở xa là lưới
    // 630 tam giác dựng chung một lệnh vẽ, nên thêm người chủ yếu tốn phần cập nhật vị trí (chừng 3 µs một người mỗi khung).
    const boost = this.walkNear ? 3 : this.beer ? 2.5 : this.walkOn && this.lake ? 1.5 : 1;
    const total = Math.round(this.max * 3.2 * boost), N = Math.max(4, Math.round(total * this.mix.f));
    const seatQ = T0 < this.seatOff ? 0 : Math.round(N * (this.beer ? Math.max(0.55, this.mix.seat) : this.mix.seat)), gymQ = T0 < this.gymOff ? 0 : Math.round(N * this.mix.gym), walkQ = N - Math.max(0, seatQ - seated) - Math.max(0, gymQ - gym);
    for (let k = 0; k < (this.warming ? 6 : 3); k++) {
      if (gym < gymQ && P.length < total) { const m = this.spawnGroup(px, pz, cam, Math.min(total - P.length, gymQ - gym + 3)); gym += m; if (m) this.gymMiss = 0; else if (++this.gymMiss > 30) { this.gymMiss = 0; this.gymOff = T0 + 20; } }
      if (seated < seatQ && P.length < total) { const m = this.spawnStall(px, pz, cam); seated += m; if (m) this.seatMiss = 0; else if (++this.seatMiss > 60) { this.seatMiss = 0; this.seatOff = T0 + 20; } }
      if (P.length < walkQ) this.spawnWalker(px, pz, cam);
    }

    const T = this.time, C = this.cast, nav = this.nav; let nNear = 0;
    if (draw) C.begin();
    if (draw && this.guest) { const g = this.guest; C.put(g, nav.groundY(g.x, g.z), this.idleRow, true); nNear++; }
    for (let i = 0; i < P.length; i++) {
      const a = P[i]; let row;
      const dx = px - a.x, dz = pz - a.z, pd2 = dx * dx + dz * dz;
      if (!a.stat) {
        let v = a.v; if (a.pause > 0) { a.pause -= dt; v = 0; }
        // nhường đường: người chơi đứng chắn phía trước thì bước chậm và né sang bên
        if (pd2 < 1.7) { const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw), ahead = dx * fx + dz * fz; if (ahead > 0) { v *= 0.3; a.lat += ((dx * fz - dz * fx) > 0 ? -1 : 1) * dt * 0.8; } }
        // hết giờ phố đi bộ: người còn đang ở giữa lòng đường tạt dần vào vỉa hè
        if (a.mall && !this.walkOn) { const want = (a.lat < 0 ? -1 : 1) * (a.path.r.w / 2 + 0.9), d = want - a.lat; if (Math.abs(d) < 0.05) a.mall = false; else a.lat += clamp(d, -dt * 1.1, dt * 1.1); }
        a.s += v * dt * a.dir; a.dist += v * dt;
        if (a.s < 0 || a.s > a.path.len) { a.dir = -a.dir; a.s = clamp(a.s, 0, a.path.len); a.lat = -a.lat; }
        this.at(a.path, a.s, o);
        const tx = o[2] * a.dir, tz = o[3] * a.dir, gx = o[0] - tz * a.lat, gz = o[1] + tx * a.lat, k = 1 - Math.exp(-dt * 5);
        a.x += (gx - a.x) * k; a.z += (gz - a.z) * k;
        // va chạm tường: trong 22 m quanh người chơi hai khung một lần, xa hơn tám khung một lần (người ở xa từng đi lấn vào tường nhà
        // 0,2–2 m chỗ hè hẹp: tester vòng 3). Vướng tường thì làn đi dạt dần về phía mép đường (không thấp hơn mép vỉa hè + 0,4 m).
        // đi theo lối bộ vào tới khúc xuyên lòng nhà (khuất trong tường, không ai thấy): bỏ người đó, bước sau sinh người khác
        if (a.path.foot && (i + this.frame) % 16 === 0 && (nav.insideNear(a.x, a.z) || nav.insideNear(a.x + tx * 1.5, a.z + tz * 1.5))) a.gone = true;
        if ((i + this.frame) % (pd2 < 484 ? 2 : 8) === 0) { const pt = this._pt; pt.x = a.x; pt.z = a.z; if (nav.collide(pt, 0.28)) { a.x = pt.x; a.z = pt.z; if (!a.path.foot && !a.mall) { const m = a.path.r.w / 2 + 0.4, al = Math.abs(a.lat); if (al > m) a.lat = Math.sign(a.lat) * Math.max(m, al - 0.15); } } }
        // không đi xuyên qua người chơi (sau bước va chạm tường, để bước đó không đẩy người ngược vào vòng: QC vòng 3 đo được người lướt
        // qua cách tâm người chơi 0,436 m): đi bộ thì ai lọt vào vòng 0,55 m quanh người chơi bị đẩy ra mép vòng; ngồi trên xe thì đẩy ra
        // khỏi hình con nhộng bán kính 0,5 m bọc thân xe (đoạn ±0,85 m dọc hướng xe): vòng tròn quanh tâm không phủ hai đầu xe, người đi
        // ngang sát bánh trước, bánh sau từng lọt qua thân xe (tester vòng 3: 56 lượt-khung cách trục xe 0,05 m)
        if (Math.abs((player.y || 0) - a.y) < 1.5) {
          const ex = a.x - px, ez = a.z - pz, ox = a.x, oz = a.z;
          if (player.mode === 'bike') {
            const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw), t = clamp(ex * fx + ez * fz, -0.85, 0.85), qx = px + fx * t, qz = pz + fz * t, rx = a.x - qx, rz = a.z - qz, e2 = rx * rx + rz * rz;
            if (e2 < 0.25) { const e = Math.sqrt(e2); if (e > 1e-3) { a.x = qx + (rx / e) * 0.5; a.z = qz + (rz / e) * 0.5; } else { const sd = -ex * fz + ez * fx >= 0 ? 1 : -1; a.x = qx - fz * sd * 0.5; a.z = qz + fx * sd * 0.5; } }
          } else { const e2 = ex * ex + ez * ez; if (e2 < 0.3025) { const e = Math.sqrt(e2) || 1e-3; a.x = px + (ex / e) * 0.55; a.z = pz + (ez / e) * 0.55; } }
          // vừa bị đẩy thì soát tường lại (không bị đẩy vào tường nhà khi người chơi đứng sát hè hẹp)
          if (a.x !== ox || a.z !== oz) { const pt = this._pt; pt.x = a.x; pt.z = a.z; if (nav.collide(pt, 0.28)) { a.x = pt.x; a.z = pt.z; } }
        }
        if (v > 0.05) a.yaw = dampAngle(a.yaw, Math.atan2(tx, tz), 6, dt);
        if (v <= 0.05) row = this.idleRow;
        else if (a.clip === CLIP.jog) row = R.jog[0] + Math.floor((((a.dist / (C.jogStride * a.scale) + a.phase) % 1) + 1) % 1 * JOG_FRAMES);
        else row = (a.clip === CLIP.carry ? R.carry[0] : R.walk[0]) + Math.floor((((a.dist / (C.stride * a.scale) + a.phase) % 1) + 1) % 1 * WALK_FRAMES);
        if (Math.random() < dt * (a.kind === KIND.tourist || a.kind === KIND.sweeper ? 0.05 : a.kind === KIND.jogger ? 0 : 0.01)) a.pause = 1 + Math.random() * 4;
        if (pd2 < 625 || (i + this.frame) % 4 === 0) a.y = nav.groundY(a.x, a.z);
      } else {
        row = a.clip === CLIP.sit ? R.sit[0] : a.clip === CLIP.sit2 ? R.sit2[0] : a.clip === CLIP.taichi ? R.taichi[0] + Math.floor((((T / 8 + a.phase) % 1) + 1) % 1 * TAICHI_FRAMES) : a.clip === CLIP.swing ? R.swing[0] + Math.floor((((T / 1.6 + a.phase) % 1) + 1) % 1 * SWING_FRAMES) : this.idleRow;
        if ((i + this.frame) % 16 === 0) a.y = nav.groundY(a.x, a.z);
      }
      if (!draw) continue;
      const cx = a.x - cam.x, cz = a.z - cam.z, near = cx * cx + cz * cz < this.nearR2 && nNear < this.max; if (near) nNear++;
      C.put(a, a.y, row, near);
    }
    if (draw) C.end();
  }
}
