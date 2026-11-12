// Rào chắn ở các đầu phố đi bộ (luồng chính): một lưới gộp cho mọi cửa rào, chỉ hiện trong giờ đóng phố.
// Vị trí rào do mô phỏng dòng xe tính (actors/trafficsim.js, setWalk): đầu mỗi đoạn phố bị đóng giáp với phố còn thông xe.
import * as THREE from 'three';
import { G } from '../core/geo.js';
import { propGeometry } from './materials.js';

// Một tấm rào thép di động rộng 2 m, cao 1,1 m: khung ống, song đứng, hai chân; mặt trước gắn dải phản quang trắng đỏ.
function panel(g) {
  const t = (a, b, r = 0.02) => g.tube(a, b, r, 4);
  g.rgb(0.42, 0.44, 0.46).gloss(0.4);
  t([-1, 1.1, 0], [1, 1.1, 0], 0.024); t([-1, 0.18, 0], [1, 0.18, 0], 0.024); t([-1, 0, 0], [-1, 1.1, 0], 0.024); t([1, 0, 0], [1, 1.1, 0], 0.024);
  for (let x = -0.75; x < 0.8; x += 0.25) t([x, 0.18, 0], [x, 1.1, 0], 0.012);
  for (const x of [-0.8, 0.8]) t([x, 0.02, -0.3], [x, 0.02, 0.3], 0.02);
  g.gloss(0);
  for (let k = 0; k < 8; k++) { g.rgb(k % 2 ? 0.75 : 0.62, k % 2 ? 0.75 : 0.04, k % 2 ? 0.73 : 0.04).box(-1 + k * 0.25, 0.62, -0.03, -0.75 + k * 0.25, 0.86, 0.03); }
}
// Biển "đường cấm" (hình tròn nền trắng viền đỏ) trên cột, đặt giữa cửa rào, quay mặt ra phía xe tới (+z).
function sign(g) {
  g.rgb(0.5, 0.5, 0.52).cyl(0, 0, 0, 0.035, 0.035, 2.25, 6, false);
  g.rgb(0.2, 0.2, 0.22).cyl(0, 0, 0, 0.22, 0.18, 0.06, 8, true);
  const disc = (r, z, col) => { g.rgb(...col); const n = 16, c = g.v(0, 2.2, z, 0, 0, 1); let prev = null, first = null; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, v = g.v(Math.cos(a) * r, 2.2 + Math.sin(a) * r, z, 0, 0, 1); if (prev !== null) g.tri(c, prev, v); else first = v; prev = v; } g.tri(c, prev, first); };
  disc(0.36, 0.045, [0.62, 0.03, 0.03]); disc(0.27, 0.05, [0.82, 0.82, 0.8]);
  g.rgb(0.35, 0.36, 0.38).box(-0.36, 1.84, 0.0, 0.36, 2.56, 0.04, 'xXyYz');
}

export class WalkStreet {
  constructor(scene, mats) { this.scene = scene; this.mats = mats; this.mesh = null; this.key = ''; this.on = false; }
  // gates: [{ x, z, tx, tz, w }], tx/tz là hướng đi VÀO phố bị đóng. Dựng lại lưới khi danh sách rào đổi.
  set(on, gates) {
    this.on = on;
    if (on && gates.length) {
      const key = gates.length + ':' + gates[0].x.toFixed(1) + ',' + gates[gates.length - 1].z.toFixed(1);
      if (key !== this.key) {
        this.dispose(); this.key = key;
        const g = new G();
        for (const q of gates) {
          const n = Math.max(1, Math.floor((q.w - 0.4) / 2.25)), yaw = Math.atan2(-q.tx, -q.tz); // mặt rào quay ra phía xe tới
          for (let k = 0; k < n; k++) { const off = (k - (n - 1) / 2) * 2.25; g.push().move(q.x - q.tz * off, 0.02, q.z + q.tx * off).rotY(yaw); panel(g); g.pop(); }
          g.push().move(q.x - q.tx * 0.9, 0.02, q.z - q.tz * 0.9).rotY(yaw); sign(g); g.pop();
        }
        this.mesh = new THREE.Mesh(propGeometry(g.pack()), this.mats.prop); this.mesh.castShadow = true; this.mesh.matrixAutoUpdate = false; this.mesh.updateMatrix(); this.mesh.frustumCulled = false; this.mesh.name = 'walkstreet';
        this.scene.add(this.mesh);
      }
    }
    if (this.mesh) this.mesh.visible = on;
  }
  dispose() { if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh = null; this.key = ''; } }
}
