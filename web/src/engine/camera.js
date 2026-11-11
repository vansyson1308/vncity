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
    // Va chạm. Người chơi luôn đứng ngoài mọi khối đặc, nên camera chỉ cần không vượt qua bức tường nào tính từ đầu nhân vật:
    // bắn tia từ đầu nhân vật tới đúng vị trí camera muốn đứng (đã cộng độ lệch ngang), dừng trước tường 0,35 m.
    // Sau đó coi camera là một vòng tròn bán kính 0,5 m và đẩy nó ra khỏi tường bên cạnh, để mặt cắt gần của ống kính
    // (0,3 m) không bao giờ cắt vào trong khối nhà. Camera có thể áp sát đầu nhân vật; khi đó nhân vật được ẩn đi.
    const want3 = this.dist, flat = Math.hypot(dx, dz);
    const sideW = riding ? 0 : 0.38 * Math.min(1, this.cur / 3), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let d = want3;
    if (flat > 0.02) {
      const ox = dx * want3 + rx * sideW, oz = dz * want3 + rz * sideW, ol = Math.hypot(ox, oz) || 1;
      const hit = this.nav.raycast(tx, tz, ox / ol, oz / ol, ol + 0.5, ty, (dy * want3) / ol);
      if (hit < ol + 0.5) d = Math.max(0.05, ((hit - 0.35) / ol) * want3);
    }
    this.cur = d < this.cur ? d : damp(this.cur, d, 5, dt);
    const c = this.cam, side = sideW * Math.min(1, this.cur / Math.max(0.5, want3));
    const P = this._p || (this._p = { x: 0, z: 0 });
    P.x = tx + dx * this.cur + rx * side; P.z = tz + dz * this.cur + rz * side;
    const cy = Math.max(player.y + 0.35, ty + dy * this.cur);
    if (cy < 9) { // dưới tầm mái nhà: giữ khoảng hở với tường hai bên
      const bx = P.x, bz = P.z; this.nav.collide(P, 0.5, true, player.y > 0.7 ? player.y : 0);
      // nếu bị đẩy sang phía bên kia một bức tường (góc hẹp) thì lui hẳn về sát đầu nhân vật
      const mx = P.x - tx, mz = P.z - tz, ml = Math.hypot(mx, mz);
      if ((P.x !== bx || P.z !== bz) && ml > 0.3 && this.nav.raycast(tx, tz, mx / ml, mz / ml, ml + 0.3, ty, (cy - ty) / ml) < ml + 0.3) { P.x = tx + dx * 0.05; P.z = tz + dz * 0.05; this.cur = 0.05; }
    }
    c.position.set(P.x, cy, P.z);
    this.close = Math.hypot(P.x - tx, P.z - tz, cy - ty); // main.js ẩn nhân vật khi camera áp sát (dưới 0,8 m)
    if (this.shake > 0.001) { c.position.x += (Math.random() - 0.5) * this.shake; c.position.y += (Math.random() - 0.5) * this.shake; this.shake *= Math.exp(-dt * 9); }
    if (this.close < 0.5) c.lookAt(tx - dx * 4, ty - dy * 4 + 0.1, tz - dz * 4); else c.lookAt(tx + rx * side, ty + 0.1, tz + rz * side);
    const fov = 58 + clamp(speed - 3, 0, 14) * 0.85;
    if (Math.abs(fov - this.fov) > 0.05) { this.fov = damp(this.fov, fov, 3, dt); c.fov = this.fov; c.updateProjectionMatrix(); }
  }
}
export { wrapAngle };
