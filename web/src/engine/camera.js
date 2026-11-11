// Camera góc ba: xoay quanh nhân vật bằng chuột/cảm ứng, tự về sau lưng khi đang chạy xe, không chui vào tường.
import * as THREE from 'three';
import { clamp, damp, dampAngle, wrapAngle } from '../core/util.js';

export class FollowCamera {
  constructor(camera, nav) {
    this.cam = camera; this.nav = nav;
    this.yaw = 0; this.pitch = 0.2; this.dist = 4.6; this.zoom = 1; this.cur = 4.6;
    this.target = new THREE.Vector3(); this.shake = 0; this.fov = 58; this.cine = null; this._first = true;
    this.sens = 0.0026;
  }
  snap(player) { this.yaw = player.yaw + Math.PI; this._first = true; }

  update(dt, player, input) {
    const riding = player.mode === 'bike', speed = Math.abs(player.speed);
    if (input) {
      this.yaw -= input.look.x * this.sens; this.pitch = clamp(this.pitch + input.look.y * this.sens * 0.8, -0.35, 1.25);
      if (input.zoom) this.zoom = clamp(this.zoom * (1 + input.zoom * 0.12), 0.55, 2.6);
      // đang chạy mà không đụng chuột thì camera trôi về sau lưng
      const idle = (performance.now() - input.lastLook) / 1000;
      if (idle > (riding ? 0.9 : 2.5) && speed > (riding ? 1.2 : 2.2)) this.yaw = dampAngle(this.yaw, player.yaw + Math.PI, riding ? 2.4 : 0.9, dt);
    }
    const want = (riding ? 5.6 + speed * 0.12 : 4.4) * this.zoom;
    this.dist = damp(this.dist, want, 4, dt);
    const head = riding ? 1.45 : 1.55;
    const tx = player.pos.x, ty = player.y + head, tz = player.pos.z;
    if (this._first || this.target.distanceToSquared({ x: tx, y: ty, z: tz }) > 400) { this.target.set(tx, ty, tz); this._first = false; }
    else { this.target.x = damp(this.target.x, tx, 18, dt); this.target.z = damp(this.target.z, tz, 18, dt); this.target.y = damp(this.target.y, ty, 9, dt); }
    const cp = Math.cos(this.pitch), dx = Math.sin(this.yaw) * cp, dy = Math.sin(this.pitch), dz = Math.cos(this.yaw) * cp;
    // va chạm: tia ngang từ đầu nhân vật ra vị trí camera, chỉ tính tường cao hơn tầm mắt camera
    let d = this.dist; const flat = Math.hypot(dx, dz);
    if (flat > 0.05) { const hit = this.nav.raycast(tx, tz, dx / flat, dz / flat, d * flat + 0.4, ty + dy * d * 0.5); d = Math.min(d, Math.max(0.6, (hit - 0.35) / flat)); }
    this.cur = d < this.cur ? d : damp(this.cur, d, 5, dt);
    const c = this.cam;
    // lệch nhẹ sang phải để nhân vật không che giữa màn hình
    const side = riding ? 0 : 0.38 * Math.min(1, this.cur / 3), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    c.position.set(tx + dx * this.cur + rx * side, Math.max(player.y + 0.35, ty + dy * this.cur), tz + dz * this.cur + rz * side);
    if (this.shake > 0.001) { c.position.x += (Math.random() - 0.5) * this.shake; c.position.y += (Math.random() - 0.5) * this.shake; this.shake *= Math.exp(-dt * 9); }
    c.lookAt(tx + rx * side, ty + 0.1, tz + rz * side);
    const fov = 58 + clamp(speed - 3, 0, 14) * 0.85;
    if (Math.abs(fov - this.fov) > 0.05) { this.fov = damp(this.fov, fov, 3, dt); c.fov = this.fov; c.updateProjectionMatrix(); }
  }
}
export { wrapAngle };
