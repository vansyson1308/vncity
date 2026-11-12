// Dòng xe Hà Nội 2026: đàn xe máy (người lái đội mũ nửa đầu, áo khoác, khẩu trang, xe ôm công nghệ, khách ngồi sau, thùng giao hàng),
// ô tô, taxi điện xanh ngọc biển vàng, xe buýt, xe đạp bán hoa, xích lô và xe điện du lịch quanh Hồ Gươm và trục Hàng Đào - Đồng Xuân.
// Tệp này chỉ nối hai nửa: mô phỏng (trafficsim.js, chạy được trong Node) và phần vẽ bằng instancing (fleet.js).
// Xe đi bên phải, lách nhau trong lòng đường, chậm lại sau xe trước, tự né người đi bộ: cứ bước đều qua đường là dòng xe chảy quanh bạn.
import * as THREE from 'three';
import { TrafficSim, BOOST } from './trafficsim.js';
import { Fleet } from './fleet.js';
import { skyU } from '../engine/sky.js';

export class Traffic extends TrafficSim {
  constructor(scene, world, nav, mats, humanFar, quality) {
    super(world, quality);
    this.nav = nav; this.q = quality;
    this.fleet = new Fleet(scene, humanFar, quality, { bikes: Math.ceil(quality.traffic * BOOST), cars: Math.ceil(quality.cars * BOOST) });
    this._d = new THREE.Vector3(); this._cam = { x: 0, z: 0, fx: 0, fz: 1 };
    // điểm (x, z) có khuất sau dãy nhà so với camera không: xe được phép hiện ra ở đó dù nằm trong góc nhìn
    this.occluded = (x, z) => { const c = this._cam, dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz); return d > 1 && nav.raycast(c.x, c.z, dx / d, dz / d, d, 1.4) < d - 1.5; };
  }
  cam(camera) { const f = camera.getWorldDirection(this._d), c = this._cam; c.x = camera.position.x; c.z = camera.position.z; c.fx = f.x; c.fz = f.z; return c; }
  // lúc rải xe ban đầu mô phỏng chạy trước mấy chục giây bằng đồng hồ riêng (đèn vẫn đổi pha); sau đó theo đồng hồ của shader vẽ đèn
  prewarm(player, camera, hours) { this.clock = null; super.prewarm(player, this.cam(camera), hours); }

  update(dt, player, camera, hours, simOnly = false) {
    this.clock = skyU.uTime.value; // đèn tín hiệu: cùng đồng hồ với shader vẽ bóng đèn và số đếm ngược
    this.step(dt, player, this.cam(camera), hours);
    if (simOnly) return;
    const F = this.fleet, cx = camera.position.x, cz = camera.position.z, lit = skyU.uLit.value > 0.02;
    F.begin();
    for (const a of this.agents) { if (a.x > 1e8) continue; const dx = a.x - cx, dz = a.z - cz; F.add(a, dx * dx + dz * dz, lit); }
    F.end(skyU.uLit.value);
  }
}
