// Người trên phố Hà Nội theo giờ và theo khu (docs/18 mục 5): người đi đường, công chức, học sinh quàng khăn đỏ, khách du lịch đeo ba lô,
// người gánh hàng rong đội nón lá đi sát mép vỉa hè, công nhân môi trường, người chạy bộ quanh hồ, khách ngồi ghế đẩu nhựa cạnh quán cóc,
// các tốp tập dưỡng sinh bên hồ lúc rạng sáng. Lưới và hoạt hình nằm ở cast.js (instancing + skinning trên GPU: 6 lệnh vẽ cho tất cả).
// Mỗi khung hình mỗi người chỉ tốn một lần dò đường đi và vài phép ghi mảng; người ngồi, người tập đứng yên thì gần như không tốn gì.
import { clamp, dampAngle, hash } from '../core/util.js';
import { K, CURB, ZONE, zoneAt, isSolemn } from '../world/data.js';
import { Cast, STYLE, PROP, WALK_FRAMES, TAICHI_FRAMES, SWING_FRAMES, JOG_FRAMES } from './cast.js';
import { STOOL_RED, STOOL_BLUE } from '../models/life.js';

// ----- bảng màu (tuyến tính) -----
const SHIRTS = [[0.85, 0.85, 0.82], [0.1, 0.22, 0.5], [0.62, 0.08, 0.08], [0.1, 0.1, 0.12], [0.12, 0.35, 0.18], [0.8, 0.6, 0.08], [0.45, 0.45, 0.47], [0.7, 0.28, 0.42], [0.18, 0.5, 0.55], [0.85, 0.42, 0.1], [0.55, 0.4, 0.7], [0.9, 0.82, 0.6], [0.03, 0.03, 0.04], [0.04, 0.07, 0.2], [0.3, 0.05, 0.07], [0.16, 0.17, 0.19]];
const BRIGHT = [[0.9, 0.42, 0.08], [0.85, 0.75, 0.1], [0.15, 0.55, 0.6], [0.8, 0.2, 0.3], [0.9, 0.9, 0.86], [0.3, 0.6, 0.25], [0.2, 0.35, 0.75], [0.85, 0.5, 0.6]];
const OFFICE = [[0.88, 0.88, 0.86], [0.88, 0.88, 0.86], [0.6, 0.72, 0.85], [0.82, 0.68, 0.72], [0.05, 0.07, 0.16], [0.07, 0.07, 0.08], [0.55, 0.57, 0.6]];
const DARK = [[0.02, 0.02, 0.025], [0.02, 0.02, 0.025], [0.03, 0.05, 0.14], [0.14, 0.15, 0.17], [0.3, 0.25, 0.16], [0.12, 0.08, 0.05]];
const EARTH = [[0.2, 0.1, 0.07], [0.12, 0.08, 0.16], [0.05, 0.07, 0.16], [0.08, 0.14, 0.1], [0.25, 0.08, 0.12], [0.16, 0.13, 0.1]];
const PASTEL = [[0.9, 0.9, 0.87], [0.9, 0.9, 0.87], [0.85, 0.62, 0.7], [0.62, 0.72, 0.85], [0.85, 0.8, 0.55], [0.7, 0.85, 0.74], [0.75, 0.2, 0.2]];
const PACKS = [[0.05, 0.05, 0.06], [0.1, 0.2, 0.5], [0.55, 0.1, 0.1], [0.4, 0.35, 0.22], [0.75, 0.3, 0.5], [0.1, 0.35, 0.2]];
const pick = (l) => l[Math.floor(Math.random() * l.length)];
const KIND = { local: 0, office: 1, student: 2, tourist: 3, vendor: 4, sweeper: 5, jogger: 6, seated: 7, exercise: 8, idle: 9 };
const CLIP = { walk: 0, idle: 1, sit: 2, sit2: 3, taichi: 4, swing: 5, jog: 6, carry: 7 };

// Mật độ người và cơ cấu theo khung giờ. Trả về { f: mật độ 0..1, w: trọng số [dân phố, công chức, học sinh, khách du lịch, hàng rong, vệ sinh, chạy bộ],
// seat: phần ngồi quán, gym: phần tập thể dục bên hồ }.
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
    this.cast = new Cast(scene, humanLod, humanFar || humanLod, humanFull || humanLod, quality, { near: quality.crowd + 2, far: total, kit: total });
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
    const side = Math.random() < 0.5 ? -1 : 1, kerb = kind === KIND.vendor || kind === KIND.sweeper;
    const lat = path.foot ? (Math.random() - 0.5) * Math.max(0.4, path.r.w - 0.8) : side * (path.r.w / 2 + (kerb ? 0.42 + Math.random() * 0.15 : 0.75 + Math.random() * 0.9));
    const x = o[0] - o[3] * lat, z = o[1] + o[2] * lat, d = Math.hypot(x - px, z - pz);
    if (d < (this.warming ? 6 : 14) || d > 95) return false;
    if (cam && !this.warming && d < 45 && (x - cam.x) * cam.fx + (z - cam.z) * cam.fz > 0 && Math.random() < 0.8) return false;
    const pt = this._pt; pt.x = x; pt.z = z; if (this.nav.collide(pt, 0.3) || this.nav.isWater(x, z)) return false;
    const a = this.person(kind, x, z, Math.random() * 6.28);
    a.path = path; a.s = s; a.dir = Math.random() < 0.5 ? 1 : -1; a.lat = lat;
    if (kind === KIND.local && !path.foot && Math.random() < 0.16) { a.kind = KIND.idle; a.stat = true; a.v = 0; } // đứng chờ, đứng xem hàng
    else { a.clip = kind === KIND.vendor ? CLIP.carry : kind === KIND.jogger ? CLIP.jog : CLIP.walk; a.v = kind === KIND.vendor ? 0.85 + Math.random() * 0.25 : kind === KIND.sweeper ? 0.5 + Math.random() * 0.2 : kind === KIND.jogger ? 2.3 + Math.random() * 0.7 : kind === KIND.tourist ? 0.8 + Math.random() * 0.3 : kind === KIND.student ? 1.1 + Math.random() * 0.4 : 0.9 + Math.random() * 0.5; }
    this.dress(a); this.people.push(a); return true;
  }
  ok(x, z) { const pt = this._pt; pt.x = x; pt.z = z; return !this.nav.collide(pt, 0.32) && !this.nav.isWater(x, z) && !this.nav.onRoad(x, z); }
  visible(x, z, px, pz, cam, near) { const d = Math.hypot(x - px, z - pz); return !this.warming && cam && d < near && (x - cam.x) * cam.fx + (z - cam.z) * cam.fz > 0; }
  // Khách ngồi ghế đẩu cạnh một quán cóc: hai bên dãy bàn của quán, quay mặt vào nhau; có khi thêm một người đứng chờ.
  spawnStall(px, pz, cam) {
    // quán gần người chơi được ngồi kín trước: thử vài quán, lấy quán gần nhất còn trống
    const cx = Math.floor(px / 64), cz = Math.floor(pz / 64); let st = null, bd = 1e9;
    for (let t = 0; t < 4; t++) { const l = this.stalls.get((cx + Math.floor(Math.random() * 3) - 1) * 65537 + cz + Math.floor(Math.random() * 3) - 1); if (!l) continue; const q = l[Math.floor(Math.random() * l.length)]; if (q.used || q.bad) continue; const dq = (q.x - px) ** 2 + (q.z - pz) ** 2; if (dq < bd) { bd = dq; st = q; } }
    if (!st) return 0;
    const d = Math.hypot(st.x - px, st.z - pz); if (d > 85 || d < (this.warming ? 5 : 12) || this.visible(st.x, st.z, px, pz, cam, 40)) return 0;
    const rd = this.nav.nearestRoad(st.x, st.z, 22, (r) => r.veh && r.kind <= K.residential); if (!rd || rd.d < 0.5) { st.bad = true; return 0; }
    const ux = (st.x - rd.px) / rd.d, uz = (st.z - rd.pz) / rd.d, bx = rd.px + ux * (rd.r.w / 2 + 1.05), bz = rd.pz + uz * (rd.r.w / 2 + 1.05), tx = uz, tz = -ux; // tx,tz: dọc theo phố
    const seed = st.i * 131 + 7, n = 1 + Math.floor(hash(seed, 1) * 3.6), red = hash(st.i * 40503, 2) < 0.6; let made = 0;
    for (let k = 0; k < n; k++) {
      const sd = k % 2 ? -1 : 1, along = sd * (1.95 + Math.floor(k / 2) * 0.72 + hash(seed, 10 + k) * 0.15), out = (hash(seed, 20 + k) - 0.4) * 0.5;
      const x = bx + tx * along + ux * out, z = bz + tz * along + uz * out; if (!this.ok(x, z)) continue;
      const a = this.person(KIND.seated, x, z, Math.atan2(-tx * sd, -tz * sd) + (hash(seed, 30 + k) - 0.5) * 0.7);
      a.kind = Math.random() < 0.25 ? KIND.tourist : Math.random() < 0.4 ? KIND.office : KIND.local; this.dress(a); a.kind = KIND.seated;
      a.props = (a.props & (PROP.cap | PROP.scarf)) | PROP.stool; a.ptint = red ? STOOL_RED : STOOL_BLUE; a.clip = hash(seed, 40 + k) < 0.4 ? CLIP.sit2 : CLIP.sit; a.stat = true; a.v = 0; a.anchor = st;
      this.people.push(a); made++;
    }
    if (made && hash(seed, 3) < 0.4) { const x = bx + ux * 0.9 + tx * (hash(seed, 4) - 0.5) * 2, z = bz + uz * 0.9 + tz * (hash(seed, 4) - 0.5) * 2; if (this.ok(x, z)) { const a = this.person(KIND.idle, x, z, Math.atan2(-ux, -uz)); this.dress(a); a.stat = true; a.v = 0; a.anchor = st; this.people.push(a); made++; } }
    if (made) st.used = true; else st.bad = true;
    return made;
  }
  // Một tốp tập dưỡng sinh sát mép hồ: đứng thành hàng, quay mặt ra hồ, cùng một nhịp.
  spawnGroup(px, pz, cam, room) {
    if (!this.spots.length) return 0;
    // ưu tiên chỗ gần người chơi (trong 130 m), không có thì mới lấy chỗ xa hơn bên kia hồ
    let sp = null, cnt = 0; const lim = Math.random() < 0.75 ? 130 : 240;
    for (const q of this.spots) { if (q.used) continue; const d = Math.hypot(q.x - px, q.z - pz); if (d > lim || d < (this.warming ? 8 : 16)) continue; if (Math.random() * ++cnt < 1) sp = q; }
    if (!sp || this.visible(sp.x, sp.z, px, pz, cam, 60)) return 0;
    const n = Math.min(room, 4 + Math.floor(Math.random() * 6)), cols = n > 6 ? 4 : 3, clip = Math.random() < 0.65 ? CLIP.taichi : CLIP.swing, phase = Math.random(), yaw = Math.atan2(sp.nx, sp.nz), tx = -sp.nz, tz = sp.nx; let made = 0;
    for (let k = 0; k < n; k++) {
      const c = k % cols, rw = Math.floor(k / cols), x = sp.x + tx * (c - (cols - 1) / 2) * 1.5 + sp.nx * (4.4 - rw * 1.5) + (Math.random() - 0.5) * 0.25, z = sp.z + tz * (c - (cols - 1) / 2) * 1.5 + sp.nz * (4.4 - rw * 1.5) + (Math.random() - 0.5) * 0.25; // giữa lối dạo và mép nước
      if (!this.ok(x, z)) continue;
      const a = this.person(KIND.exercise, x, z, yaw + (Math.random() - 0.5) * 0.12); this.dress(a); a.y = this.nav.groundY(x, z); a.clip = clip; a.phase = phase + (Math.random() - 0.5) * 0.03; a.stat = true; a.v = 0; a.anchor = sp;
      this.people.push(a); made++;
    }
    if (made >= 2) sp.used = true;
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
      for (const path of this.paths) { const b = path.r.bb; if (b[0] < px + 95 && b[2] > px - 95 && b[1] < pz + 95 && b[3] > pz - 95) { const n = Math.max(1, Math.round((path.len / 40) * (path.foot ? 2.5 * (path.shore ? shoreBoost : 1) : path.zone === ZONE.old ? 2 : path.r.kind >= K.residential ? 0.6 : 1))); for (let i = 0; i < n; i++) this.near.push(path); } }
    }
    // huỷ người đã ra xa; tốp tập thể dục tan khi hết giờ (lúc khuất mắt)
    let seated = 0, gym = 0;
    const gymOn = this.mix.gym > 0;
    for (let i = P.length - 1; i >= 0; i--) {
      const a = P[i], d = Math.hypot(a.x - px, a.z - pz);
      if (d > (a.kind === KIND.exercise ? 250 : a.stat ? 118 : 105) || (a.kind === KIND.exercise && !gymOn && (d > 70 || (a.x - cam.x) * cam.fx + (a.z - cam.z) * cam.fz < 0))) { if (a.anchor) a.anchor.used = false; P[i] = P[P.length - 1]; P.pop(); continue; }
      if (a.kind === KIND.seated) seated++; else if (a.kind === KIND.exercise) gym++;
    }
    // sinh thêm cho đủ số theo giờ
    // Phần ngồi quán và phần tập thể dục có suất riêng (không bị người đi bộ chiếm hết chỗ); quanh đây không có quán, không có bờ hồ
    // thì sau vài chục lần thử hụt, suất đó trả lại cho người đi bộ trong 20 giây.
    const total = Math.round(this.max * 3.2), N = Math.max(4, Math.round(total * this.mix.f));
    const seatQ = T0 < this.seatOff ? 0 : Math.round(N * this.mix.seat), gymQ = T0 < this.gymOff ? 0 : Math.round(N * this.mix.gym), walkQ = N - Math.max(0, seatQ - seated) - Math.max(0, gymQ - gym);
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
        a.s += v * dt * a.dir; a.dist += v * dt;
        if (a.s < 0 || a.s > a.path.len) { a.dir = -a.dir; a.s = clamp(a.s, 0, a.path.len); a.lat = -a.lat; }
        this.at(a.path, a.s, o);
        const tx = o[2] * a.dir, tz = o[3] * a.dir, gx = o[0] - tz * a.lat, gz = o[1] + tx * a.lat, k = 1 - Math.exp(-dt * 5);
        a.x += (gx - a.x) * k; a.z += (gz - a.z) * k;
        if (pd2 < 484 && (i + this.frame) % 2 === 0) { const pt = this._pt; pt.x = a.x; pt.z = a.z; if (nav.collide(pt, 0.28)) { a.x = pt.x; a.z = pt.z; } }
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
