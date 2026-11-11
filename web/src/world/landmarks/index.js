// Dựng các công trình biểu tượng ở luồng chính: mỗi công trình một lưới gộp (một lệnh vẽ), đặt đúng toạ độ thật.
// Các tệp mô hình nằm cùng thư mục, mỗi tệp xuất build(g).
import * as THREE from 'three';
import { G } from '../../core/geo.js';
import { CURB } from '../data.js';
import { propGeometry } from '../materials.js';

const modules = import.meta.glob('./*.js');

export async function buildLandmarks(scene, sites, mats, nav, world) {
  const out = [];
  // cầu Long Biên: dựng dọc tuyến đường sắt trên cầu, chia bốn đoạn để khuất tầm nhìn thì không vẽ
  try {
    const rail = world.rails.filter((r) => r.flags & 2).sort((a, b) => b.p.length - a.p.length)[0];
    if (rail && modules['./cau_long_bien.js']) {
      const mod = await modules['./cau_long_bien.js'](), pts = []; for (let i = 0; i < rail.p.length; i += 2) pts.push([rail.p[i], rail.p[i + 1]]);
      // nội suy thêm điểm để chia đoạn theo chiều dài
      const dense = []; for (let i = 0; i < pts.length - 1; i++) { const n = Math.max(1, Math.round(Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) / 40)); for (let k = 0; k < n; k++) dense.push([pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * k) / n, pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * k) / n]); } dense.push(pts[pts.length - 1]);
      const per = Math.ceil(dense.length / 4);
      for (let q = 0; q < 4; q++) {
        const part = dense.slice(Math.max(0, q * per - 0), Math.min(dense.length, (q + 1) * per + 1)); if (part.length < 2) continue;
        const g = new G(); mod.buildAlong(g, part); if (!g.count) continue;
        const mesh = new THREE.Mesh(propGeometry(g.pack()), mats.prop); mesh.position.y = CURB; mesh.updateMatrix(); mesh.matrixAutoUpdate = false; mesh.name = 'cau_long_bien';
        scene.add(mesh); const c = part[Math.floor(part.length / 2)]; out.push({ site: { id: 'cau_long_bien', x: c[0], z: c[1] }, mesh });
      }
    }
  } catch (e) { console.warn('cau_long_bien', e); }
  for (const s of sites) {
    const load = modules[`./${s.id}.js`]; if (!load) continue;
    let mod; try { mod = await load(); } catch (e) { console.warn('landmark', s.id, e); continue; }
    if (!mod.build) continue;
    const g = new G(), lf = new G();
    try {
      mod.build(g, { lf });
      // Đắc Nguyệt Lâu (lầu Đón Trăng) đứng ở đầu cầu Thê Húc phía đảo
      if (s.id === 'cau_the_huc' && modules['./ngoc_son_gate.js']) { const gate = await modules['./ngoc_son_gate.js'](); if (gate.moonPavilion) { g.push().move(0, 0, 46.2 + 1.7); gate.moonPavilion(g); g.pop(); } }
    } catch (e) { console.warn('landmark build', s.id, e); continue; }
    if (!g.count) continue;
    const mesh = new THREE.Mesh(propGeometry(g.pack()), mats.landmark);
    mesh.position.set(s.x, CURB + (s.lift || 0), s.z); mesh.rotation.y = s.yaw; mesh.castShadow = true; mesh.receiveShadow = true; mesh.updateMatrix(); mesh.matrixAutoUpdate = false; mesh.name = s.id;
    scene.add(mesh); out.push({ site: s, mesh });
    // va chạm cho các khối đặc khai báo trong sites.js (toạ độ cục bộ)
    if (s.solid) {
      const col = [], c = Math.cos(s.yaw), sn = Math.sin(s.yaw), W = (lx, lz) => [s.x + lx * c + lz * sn, s.z - lx * sn + lz * c];
      for (const [x0, z0, x1, z1] of s.solid) { const P = [W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)]; for (let i = 0; i < 4; i++) col.push(P[i][0], P[i][1], P[(i + 1) % 4][0], P[(i + 1) % 4][1], 8); }
      nav.addChunk('lm:' + s.id, new Float32Array(col), new Float32Array(0));
    }
  }
  return out;
}
