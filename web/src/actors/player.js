// Minh, anh xe ôm phố cổ: đi bộ, chạy, lên xuống xe máy. Xe chạy kiểu arcade: dễ lái, nghiêng khi vào cua,
// đâm vào tường chỉ khựng lại và lảo đảo chứ không ngã, không hỏng (xem docs/17, mục thiết kế).
import * as THREE from 'three';
import { clamp, damp, dampAngle, wrapAngle, lerp } from '../core/util.js';
import { CURB } from '../world/data.js';
import { G } from '../core/geo.js';
import { motorbike } from '../models/vehicles.js';
import { propGeometry } from '../world/materials.js';

// Tốc độ gốc của các đoạn hoạt hình (m/s), đo từ chuyển động gốc trong tệp mô hình.
const CLIP_SPEED = { walk: 1.01, jog: 2.4, run: 2.9 };
// Tư thế ngồi lái: xoay thêm quanh trục z cục bộ của xương (radian), áp lên tư thế đứng yên.
export const RIDE_POSE = [['Bip01_L_Thigh', 1.18], ['Bip01_R_Thigh', 1.18], ['Bip01_L_Calf', -1.2], ['Bip01_R_Calf', -1.2], ['Bip01_L_UpperArm', -0.98], ['Bip01_R_UpperArm', -0.98], ['Bip01_L_Forearm', -0.3], ['Bip01_R_Forearm', -0.3], ['Bip01_Spine', 0.1]];

// Bỏ chuyển động tịnh tiến ngang của xương gốc để nhân vật không trôi rồi giật về.
export function stripRootMotion(clips) {
  for (const c of clips) for (const t of c.tracks) if (t.name === 'Bip01.position') { const v = t.values; for (let i = 3; i < v.length; i += 3) { v[i] = v[0]; v[i + 2] = v[2]; } }
  return clips;
}
export function tintMasked(g, tint) { for (let i = 0; i < g.count; i++) { const k = g.col[i * 4 + 3]; if (k > 0) { g.col[i * 4] *= lerp(1, tint[0], k); g.col[i * 4 + 1] *= lerp(1, tint[1], k); g.col[i * 4 + 2] *= lerp(1, tint[2], k); } } return g; }

const _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1), _v = new THREE.Vector3();

export class Player {
  constructor(scene, nav, gltf, mats) {
    this.nav = nav; this.scene = scene;
    this.pos = { x: 0, z: 0 }; this.y = CURB; this.yaw = 0; this.speed = 0; this.vx = 0; this.vz = 0;
    this.mode = 'walk'; this.lean = 0; this.steer = 0; this.wobble = 0; this.bump = 0; this.passenger = false;
    this.onCrash = null; this.onStep = null; this.onCurb = null; this.stepPhase = 0;
    this.noRide = null; // hàm (x,z) → true nếu khu vực cấm xe

    this.root = new THREE.Group(); this.root.rotation.order = 'YXZ'; scene.add(this.root);
    this.model = gltf.scene; this.root.add(this.model);
    this.bones = {};
    this.model.traverse((o) => { if (o.isBone) this.bones[o.name] = o; if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    this.mixer = new THREE.AnimationMixer(this.model);
    this.act = {};
    for (const c of stripRootMotion(gltf.animations)) { const a = this.mixer.clipAction(c); a.play(); a.setEffectiveWeight(c.name === 'idle' ? 1 : 0); this.act[c.name] = a; }
    this.w = { idle: 1, walk: 0, jog: 0, run: 0 };

    // xe của Minh: xe số đỏ
    const g = tintMasked(motorbike(new G(), 'wave', 1), [0.62, 0.03, 0.03]);
    this.bike = new THREE.Mesh(propGeometry(g.pack()), mats.prop); this.bike.castShadow = true; this.bike.rotation.order = 'YXZ';
    scene.add(this.bike);
    this.bikePos = { x: 0, z: 0, yaw: 0 };
    // mũ bảo hiểm (đội khi lên xe)
    const hg = new G(); hg.rgb(0.8, 0.62, 0.06).gloss(0.8).lathe(0, 0, 0, [[0.128, -0.02], [0.134, 0.02], [0.122, 0.09], [0.088, 0.14], [0.035, 0.162], [0, 0.165]], 12).gloss(0);
    hg.rgb(0.05, 0.05, 0.05).box(-0.09, -0.02, 0.1, 0.09, 0.0, 0.2); // lưỡi trai
    this.helmet = new THREE.Mesh(propGeometry(hg.pack()), mats.makeProp({ side: THREE.DoubleSide })); this.helmet.visible = false; scene.add(this.helmet);
    this._col = { x: 0, z: 0 };
  }

  teleport(x, z, yaw = this.yaw, onDeck = true) {
    // onDeck: đặt lên mặt cầu nếu điểm đó có cầu (đi nhanh tới một điểm trên cầu); mặc định đặt xuống đất
    this.pos.x = x; this.pos.z = z; this.yaw = yaw; this.speed = 0; this.vx = this.vz = 0; this.y = this.nav.groundY(x, z, onDeck ? Infinity : 0);
    if (this.mode === 'walk') { this.bikePos.x = x + Math.cos(yaw) * 1.1; this.bikePos.z = z - Math.sin(yaw) * 1.1; this.bikePos.yaw = yaw; this.bikePos.y = undefined; }
    this.sync(0);
  }

  toggleBike() {
    if (this.mode === 'bike') {
      if (Math.abs(this.speed) > 3) return 'fast';
      this.mode = 'walk'; this.bikePos.x = this.pos.x; this.bikePos.z = this.pos.z; this.bikePos.y = this.y; this.bikePos.yaw = this.yaw; this.speed = 0;
      // bước xuống bên trái xe
      const p = this._col; p.x = this.pos.x + Math.cos(this.yaw) * 0.75; p.z = this.pos.z - Math.sin(this.yaw) * 0.75; this.nav.collide(p, 0.3, false, this.y); this.pos.x = p.x; this.pos.z = p.z;
      this.helmet.visible = false; return 'off';
    }
    if (this.noRide && this.noRide(this.pos.x, this.pos.z)) return 'forbidden';
    // xe ở xa thì Minh dắt xe lại: đặt xe ngay chỗ đang đứng
    this.mode = 'bike'; this.speed = 0; this.lean = 0; this.helmet.visible = true;
    if (Math.hypot(this.bikePos.x - this.pos.x, this.bikePos.z - this.pos.z) < 4) { this.pos.x = this.bikePos.x; this.pos.z = this.bikePos.z; this.yaw = this.bikePos.yaw; }
    return 'on';
  }

  update(dt, input, camYaw) {
    if (this.mode === 'bike') this.updateBike(dt, input, camYaw); else this.updateWalk(dt, input, camYaw);
    this.sync(dt);
  }

  updateWalk(dt, input, camYaw) {
    const mx = input.move.x, my = input.move.y, m = Math.min(1, Math.hypot(mx, my));
    const target = m * (input.run ? 5.4 : 3.3);
    if (m > 0.05) {
      // hướng đi theo hướng nhìn của camera
      const wx = Math.cos(camYaw) * mx - Math.sin(camYaw) * my, wz = -Math.sin(camYaw) * mx - Math.cos(camYaw) * my;
      this.yaw = dampAngle(this.yaw, Math.atan2(wx, wz), 11, dt);
    }
    this.speed = damp(this.speed, target, target > this.speed ? 7 : 10, dt);
    const p = this._col, step = this.speed * dt;
    p.x = this.pos.x + Math.sin(this.yaw) * step; p.z = this.pos.z + Math.cos(this.yaw) * step;
    if (this.nav.collide(p, 0.3, false, this.y)) this.speed *= 0.9;
    this.pos.x = p.x; this.pos.z = p.z;
    this.y = damp(this.y, this.nav.groundY(p.x, p.z, this.y), 14, dt);
    this.lean = 0;
    // nhịp bước chân cho âm thanh
    if (this.speed > 0.4) { this.stepPhase += dt * (this.speed < 2 ? this.speed / 1.01 / 0.6 : this.speed / 2.4 / 0.385); if (this.stepPhase >= 1) { this.stepPhase -= 1; this.onStep && this.onStep(this.speed); } }
  }

  updateBike(dt, input, camYaw) {
    let thr = input.move.y, st = input.move.x;
    const max = (input.run ? 17 : 12.5) * (this.passenger ? 0.92 : 1);
    let v = this.speed;
    if (input.brake) v = damp(v, 0, 5, dt);
    else if (thr > 0.05) v += thr * (v < 0 ? 16 : 7.5 * Math.max(0.08, 1 - v / max)) * dt;
    else if (thr < -0.05) v += thr * (v > 0.3 ? 15 : 3.2) * dt;
    else v = damp(v, 0, 0.55, dt);
    v = clamp(v, -3.2, 17);
    // tay lái: càng nhanh càng bẻ ít
    this.steer = damp(this.steer, st, 9, dt);
    const maxAng = lerp(0.62, 0.11, clamp(Math.abs(v) / 15, 0, 1)), curv = Math.tan(this.steer * maxAng) / 1.23;
    this.yaw = wrapAngle(this.yaw - curv * v * dt);
    const steps = Math.max(1, Math.ceil((Math.abs(v) * dt) / 0.35)), p = this._col; let hitN = 0;
    for (let i = 0; i < steps; i++) {
      p.x = this.pos.x + (Math.sin(this.yaw) * v * dt) / steps; p.z = this.pos.z + (Math.cos(this.yaw) * v * dt) / steps;
      if (this.nav.collide(p, 0.42, false, this.y)) {
        // trượt dọc tường; mất tốc theo độ vuông góc của cú chạm
        const into = Math.max(0, -(Math.sin(this.yaw) * this.nav.nx + Math.cos(this.yaw) * this.nav.nz));
        if (into > 0.3 && Math.abs(v) > 4) { hitN = Math.max(hitN, into * Math.abs(v)); }
        v *= 1 - into * 0.85;
        // xoay đầu xe dọc theo tường
        const tx = -this.nav.nz, tz = this.nav.nx, side = Math.sin(this.yaw) * tx + Math.cos(this.yaw) * tz >= 0 ? 1 : -1;
        this.yaw = dampAngle(this.yaw, Math.atan2(tx * side, tz * side), 6 * into, dt);
      }
      this.pos.x = p.x; this.pos.z = p.z;
    }
    if (hitN > 2.5) { this.wobble = Math.min(1, hitN / 8); this.onCrash && this.onCrash(hitN); }
    if (this.noRide && this.noRide(this.pos.x, this.pos.z)) { v = Math.min(v, 1.5); this.inNoRide = true; } else this.inNoRide = false;
    this.speed = v;
    const gy = this.nav.groundY(this.pos.x, this.pos.z, this.y);
    if (Math.abs(gy - this.y) > 0.07 && Math.abs(gy - this.y) < 0.4 && Math.abs(v) > 2) { this.bump = 0.05; this.onCurb && this.onCurb(Math.abs(v)); }
    this.y = damp(this.y, gy, 20, dt);
    this.lean = damp(this.lean, clamp(Math.atan((v * v * curv) / 9.81), -0.62, 0.62), 7, dt); // dương: nghiêng sang phải
    this.wobble *= Math.exp(-dt * 2.6); this.bump *= Math.exp(-dt * 10);
  }

  // cập nhật hình: vị trí, hoạt hình, tư thế lái
  sync(dt) {
    const r = this.root, riding = this.mode === 'bike', t = performance.now() / 1000;
    const wob = Math.sin(t * 17) * this.wobble * 0.22;
    r.position.set(this.pos.x, this.y + (riding ? this.bump : 0), this.pos.z);
    r.rotation.set(0, this.yaw, riding ? this.lean + wob : 0);
    // trọng số hoạt hình theo tốc độ
    const s = Math.abs(this.speed), w = this.w;
    let ti, tw, tj, tr;
    if (riding) { ti = 1; tw = tj = tr = 0; }
    else { tw = clamp(s / 0.5, 0, 1) * (1 - clamp((s - 1.5) / 0.7, 0, 1)); tj = clamp((s - 1.5) / 0.7, 0, 1) * (1 - clamp((s - 3.9) / 0.8, 0, 1)); tr = clamp((s - 3.9) / 0.8, 0, 1); ti = 1 - clamp(s / 0.5, 0, 1); }
    const k = dt > 0 ? 1 - Math.exp(-dt * 12) : 1;
    w.idle += (ti - w.idle) * k; w.walk += (tw - w.walk) * k; w.jog += (tj - w.jog) * k; w.run += (tr - w.run) * k;
    const A = this.act;
    A.idle.setEffectiveWeight(w.idle); A.walk.setEffectiveWeight(w.walk); A.jog.setEffectiveWeight(w.jog); A.run.setEffectiveWeight(w.run);
    A.walk.timeScale = clamp(s / CLIP_SPEED.walk, 0.7, 1.7); A.jog.timeScale = clamp(s / CLIP_SPEED.jog, 0.8, 1.6); A.run.timeScale = clamp(s / CLIP_SPEED.run, 0.9, 1.9);
    this.mixer.update(dt);
    if (riding) {
      this.model.position.set(0, -0.09, -0.3);
      for (const [name, a] of RIDE_POSE) { const b = this.bones[name]; if (b) b.quaternion.multiply(_q.setFromAxisAngle(_z, a)); }
      this.bike.position.copy(r.position); this.bike.rotation.set(0, this.yaw - Math.PI / 2, 0); this.bike.rotateX(this.lean + wob);
    } else {
      this.model.position.set(0, 0, 0);
      this.bike.position.set(this.bikePos.x, this.nav.groundY(this.bikePos.x, this.bikePos.z, this.bikePos.y ?? 0), this.bikePos.z); this.bike.rotation.set(0.17, this.bikePos.yaw - Math.PI / 2, 0);
    }
    if (this.helmet.visible) {
      const h = this.bones.Bip01_Head; r.updateMatrixWorld(true); h.getWorldPosition(_v);
      this.helmet.position.set(_v.x, _v.y + 0.085, _v.z); this.helmet.rotation.set(0, this.yaw, 0);
    }
  }
}
