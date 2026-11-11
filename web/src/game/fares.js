// Cuốc xe ôm: khách đứng vẫy ở gần người chơi, đón lên, chở tới gần một điểm chưa đóng dấu (để mỗi cuốc dẫn tới
// một nơi mới), trả tiền theo quãng đường và thưởng theo độ êm. Không có đồng hồ đếm ngược, không có thất bại.
import * as THREE from 'three';
import { T, pick } from '../ui/i18n.js';
import { skyU } from '../engine/sky.js';

const NAMES = { vi: ['Chị Lan', 'Anh Tuấn', 'Bác Hoà', 'Em Vy', 'Cô Mai', 'Chú Dũng', 'Bà Tám', 'Anh Khoa', 'Chị Hương', 'Bạn Nam'], en: ['Ms Lan', 'Mr Tuấn', 'Uncle Hoà', 'Vy', 'Auntie Mai', 'Uncle Dũng', 'Granny Tám', 'Mr Khoa', 'Ms Hương', 'Nam'] };
const FACES = ['🙋‍♀️', '🙋‍♂️', '🧓', '👩', '👩‍🦱', '👨', '👵', '🧑', '👩‍💼', '🧑‍🎓'];

export class Fares {
  constructor(scene, nav, passport, crowd) {
    this.nav = nav; this.passport = passport; this.crowd = crowd;
    this.state = 'idle'; this.wait = 6; this.cust = null; this.dest = null; this.comfort = 1; this.penalty = 0; this.hits = 0; this.byeT = 0; this.total = 0; this.start = null;
    this.onEvent = null;
    // mốc vẫy khách và mốc trả khách: vòng sáng trên mặt đường
    const ring = new THREE.RingGeometry(1.5, 2.1, 28); ring.rotateX(-Math.PI / 2);
    const mk = (c) => new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
    this.pickRing = mk(0xffd23a); this.dropRing = mk(0x3ae07a); this.pickRing.visible = this.dropRing.visible = false; this.pickRing.renderOrder = this.dropRing.renderOrder = 6;
    const pg = new THREE.CylinderGeometry(0.5, 1.3, 30, 10, 1, true); pg.translate(0, 15, 0);
    this.dropBeam = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: 0x3ae07a, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false })); this.dropBeam.visible = false;
    this.pickBeam = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false })); this.pickBeam.visible = false;
    scene.add(this.pickRing, this.dropRing, this.dropBeam, this.pickBeam);
  }
  // điểm đứng trên vỉa hè cạnh một con phố xe chạy được, gần (x,z)
  curbside(x, z, rmin, rmax) {
    for (let k = 0; k < 14; k++) {
      const a = Math.random() * 6.283, r = rmin + Math.random() * (rmax - rmin), qx = x + Math.cos(a) * r, qz = z + Math.sin(a) * r;
      const h = this.nav.nearestRoad(qx, qz, 40, (rd) => rd.veh && rd.kind <= 3 && !rd.bridge); if (!h || h.d < 0.01) continue;
      const rd = h.r, i = h.seg, dx = rd.p[i + 2] - rd.p[i], dz = rd.p[i + 3] - rd.p[i + 1], L = Math.hypot(dx, dz) || 1, side = Math.random() < 0.5 ? 1 : -1;
      const px = h.px + (-dz / L) * side * (rd.w / 2 - 0.9), pz = h.pz + (dx / L) * side * (rd.w / 2 - 0.9);
      const sx = h.px + (-dz / L) * side * (rd.w / 2 + 0.8), sz = h.pz + (dx / L) * side * (rd.w / 2 + 0.8);
      const pt = { x: sx, z: sz }; if (this.nav.collide(pt, 0.3) > 0 || this.nav.isWater(sx, sz)) continue;
      return { x: px, z: pz, sx, sz, yaw: Math.atan2(-(-dz / L) * side, -(dx / L) * side) };
    }
    return null;
  }
  offer(player) {
    const c = this.curbside(player.pos.x, player.pos.z, 35, 110); if (!c) return;
    const k = Math.floor(Math.random() * FACES.length);
    this.cust = { ...c, k, face: FACES[k] }; this.state = 'offer';
    this.pickRing.position.set(c.x, 0.06, c.z); this.pickBeam.position.set(c.x, 0, c.z); this.pickRing.visible = this.pickBeam.visible = true;
    this.crowd.setGuest(c.sx, c.sz, c.yaw);
    this.onEvent && this.onEvent('offer', this);
  }
  name(l) { return NAMES[l][this.cust.k]; }
  pickup(player) {
    // điểm trả: cạnh một điểm chưa đóng dấu, cách đây 250 m trở lên nếu có
    const P = this.passport, cands = P.items.filter((i) => !P.visited.has(i.id) && !i.solemn).map((i) => ({ i, d: Math.hypot(i.x - player.pos.x, i.z - player.pos.z) })).filter((c) => c.d > 220).sort((a, b) => a.d - b.d);
    const target = cands.length ? cands[Math.floor(Math.random() * Math.min(4, cands.length))].i : P.items[Math.floor(Math.random() * P.items.length)];
    const c = this.curbside(target.x, target.z, 8, 40) || { x: target.x, z: target.z };
    this.dest = { x: c.x, z: c.z, place: target }; this.state = 'ride'; this.comfort = 1; this.penalty = 0; this.hits = 0; this.total = Math.hypot(c.x - player.pos.x, c.z - player.pos.z); this.start = { x: player.pos.x, z: player.pos.z };
    this.pickRing.visible = this.pickBeam.visible = false; this.dropRing.position.set(c.x, 0.06, c.z); this.dropBeam.position.set(c.x, 0, c.z); this.dropRing.visible = this.dropBeam.visible = true;
    this.crowd.setGuest(null); player.passenger = true;
    this.onEvent && this.onEvent('pickup', this);
  }
  fareNow() { return 15000 + Math.round((this.total * 1.25 * 55) / 1000) * 1000; } // 15k mở cửa + khoảng 5,5k mỗi 100 m đường
  // Va quệt làm khách khó chịu. Cú nhẹ (bó vỉa) thì độ êm hồi lại dần; va chạm thật (từ 0,08 trở lên) để lại hậu quả tới hết cuốc:
  // penalty cộng dồn và là trần của độ êm, nên đâm hai lần thì không thể còn năm sao.
  bump(amount) { if (this.state !== 'ride') return; this.comfort = Math.max(0, this.comfort - amount); if (amount >= 0.08) { this.penalty = Math.min(0.9, this.penalty + amount); this.hits++; } }
  cancel(player) { this.state = 'idle'; this.wait = 20; this.cust = null; this.dest = null; this.pickRing.visible = this.pickBeam.visible = this.dropRing.visible = this.dropBeam.visible = false; this.crowd.setGuest(null); if (player) player.passenger = false; }

  update(dt, player) {
    const t = skyU.uTime.value, s = 1 + Math.sin(t * 4) * 0.08;
    this.pickRing.scale.setScalar(s); this.dropRing.scale.setScalar(s);
    this.prompt = false;
    if (this.byeT > 0) { this.byeT -= dt; if (this.byeT <= 0 && this.state === 'idle') this.crowd.setGuest(null); }
    if (this.state === 'idle') { this.wait -= dt; if (this.wait <= 0) { this.wait = 8; if (player.mode === 'bike' || this.passport.visited.size >= 1) this.offer(player); } return; }
    if (this.state === 'offer') {
      const d = Math.hypot(this.cust.x - player.pos.x, this.cust.z - player.pos.z);
      if (d > 320) { this.cancel(); return; }
      if (d < 5 && player.mode === 'bike' && Math.abs(player.speed) < 2.5) this.prompt = true;
      else if (d < 4 && player.mode !== 'bike') this.promptWalk = true;
      return;
    }
    if (this.state === 'ride') {
      this.comfort = Math.min(1 - this.penalty, this.comfort + dt * 0.012);
      // phanh gấp, vọt ga quá 5 m/s² (nửa g) làm khách chúi người: trừ dần độ êm (hồi lại được)
      const g5 = Math.abs(player.accel || 0) - 5; if (g5 > 0) this.comfort = Math.max(0, this.comfort - g5 * 0.03 * dt);
      const d = Math.hypot(this.dest.x - player.pos.x, this.dest.z - player.pos.z); this.left = d;
      if (player.mode !== 'bike') { /* xuống xe giữa chừng: khách vẫn chờ trên xe */ }
      if (d < 6 && Math.abs(player.speed) < 2 && player.mode === 'bike') {
        const base = this.fareNow(), stars = this.comfort > 0.8 ? 5 : this.comfort > 0.6 ? 4 : this.comfort > 0.35 ? 3 : 2, tip = stars === 5 ? Math.round((base * 0.3) / 1000) * 1000 : stars === 4 ? Math.round((base * 0.1) / 1000) * 1000 : 0;
        const P = this.passport; P.money += base + tip; P.rides++; P.save();
        this.result = { base, tip, stars, hits: this.hits, comment: pick('c' + stars), name: this.cust.k, place: this.dest.place };
        const done = this.result, kerb = this.curbside(player.pos.x, player.pos.z, 1, 6); this.cancel(player); this.wait = 14;
        // khách xuống xe, đứng lại trên vỉa hè vẫy chào vài giây
        if (kerb) { this.crowd.setGuest(kerb.sx, kerb.sz, kerb.yaw); this.byeT = 6; }
        this.onEvent && this.onEvent('drop', this, done);
      }
    }
  }
}
export { T };
