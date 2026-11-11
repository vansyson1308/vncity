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
    if (!(Number.isFinite(this.yaw) && Number.isFinite(this.pitch))) { this.yaw = player.yaw + Math.PI; this.pitch = 0.2; }
    if (!Number.isFinite(this.dist) || !Number.isFinite(this.cur)) { this.dist = 4.6; this.cur = 4.6; }
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
    // Va chạm. Camera luôn nằm trên đoạn thẳng từ đầu nhân vật tới vị trí mong muốn (đã cộng độ lệch ngang) và chỉ rút ngắn
    // đoạn đó, không bao giờ bị đẩy ngang: nhờ vậy nó không thể sang phía bên kia một bức tường, và hướng đi theo phím
    // luôn khớp với hướng nhìn. Hai phép thử dọc đoạn thẳng:
    //   1. tia cắt tường (tính cả độ cao tường tại chỗ cắt): dừng trước tường 0,4 m;
    //   2. khoảng hở hai bên: lấy điểm xa nhất mà vòng tròn 0,4 m quanh camera không chạm tường nào (khe hẹp thì thử 0,2 m).
    // Không còn chỗ thì camera áp vào đầu nhân vật, nhân vật được ẩn đi; rời tường là camera tự giãn ra lại.
    const want3 = this.dist, rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const sideW = riding ? 0 : 0.38 * Math.min(1, this.cur / 3);
    const ox = dx * want3 + rx * sideW, oz = dz * want3 + rz * sideW, oy = dy * want3, ol = Math.hypot(ox, oz);
    let lim = want3, tight = false;
    if (ol > 0.05) {
      const ux = ox / ol, uz = oz / ol, ky = oy / ol, nav = this.nav;
      const free = Math.min(ol, nav.raycast(tx, tz, ux, uz, ol + 0.45, ty, ky) - 0.4);
      const far = (r) => { let g = 0; for (let q = 0.3; q <= free + 1e-3; q += 0.3) if (nav.clearAt(tx + ux * q, tz + uz * q, r, Math.max(player.y + 0.35, ty + ky * q) - 0.2)) g = q; return g; };
      let good = free >= ol - 1e-3 && nav.clearAt(tx + ox, tz + oz, 0.4, Math.max(player.y + 0.35, ty + oy) - 0.2) ? ol : far(0.4);
      if (good < 0.9 && free > 0.9) { const g2 = far(0.2); if (g2 > good) { good = g2; tight = true; } }
      if (good < 0.3) { good = Math.max(0.12, Math.min(free, 0.25)); tight = true; }
      lim = (good / ol) * want3;
    }
    this.cur = lim < this.cur ? lim : damp(this.cur, lim, 5, dt);
    if (!(this.cur > 0.05)) this.cur = 0.05;
    const c = this.cam, k = this.cur / want3, side = sideW * k;
    const cy = Math.max(player.y + 0.35, ty + oy * k);
    c.position.set(tx + ox * k, cy, tz + oz * k);
    this.close = Math.hypot(ox * k, oz * k, cy - ty); // main.js ẩn nhân vật khi camera áp sát (dưới 0,8 m)
    // sát tường thì thu mặt cắt gần của ống kính lại để không cắt vào nhà
    const near = this.close < 1.3 || tight ? 0.08 : 0.3;
    if (near !== c.near) { c.near = near; c.updateProjectionMatrix(); }
    if (this.shake > 0.001) { c.position.x += (Math.random() - 0.5) * this.shake; c.position.y += (Math.random() - 0.5) * this.shake; this.shake *= Math.exp(-dt * 9); }
    if (this.close < 0.5) c.lookAt(c.position.x - dx * 4, c.position.y - dy * 4 + 0.1, c.position.z - dz * 4); else c.lookAt(tx + rx * side, ty + 0.1, tz + rz * side);
    const fov = 58 + clamp(speed - 3, 0, 14) * 0.85;
    if (Math.abs(fov - this.fov) > 0.05) { this.fov = damp(this.fov, fov, 3, dt); c.fov = this.fov; c.updateProjectionMatrix(); }
  }
}
export { wrapAngle };
