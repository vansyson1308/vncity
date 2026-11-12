// Dựng các công trình biểu tượng ở luồng chính: mỗi công trình một lưới gộp (một lệnh vẽ), đặt đúng toạ độ thật.
// Các tệp mô hình nằm cùng thư mục, mỗi tệp xuất build(g).
import * as THREE from 'three';
import { G } from '../../core/geo.js';
import { CURB, roadY, alongAt, LB_TRUSS_X, CD_TRUSS_S, CD_SPAN, chuongDuongMid } from '../data.js';
import { segDist2 } from '../../core/util.js';
import { siteCollision } from './sites.js';
import { propGeometry } from '../materials.js';

const modules = import.meta.glob('./*.js');

export async function buildLandmarks(scene, sites, mats, nav, world) {
  const out = [];
  // cầu Long Biên: dàn thép dựng dọc tuyến đường sắt trên cầu (đoạn ngoài đê), lan can dọc hai làn xe; chia khúc để khuất tầm nhìn thì không vẽ
  try {
    const rail = world.rails.filter((r) => r.elev).sort((a, b) => b.len - a.len)[0];
    if (rail && modules['./cau_long_bien.js']) {
      const mod = await modules['./cau_long_bien.js'](), o = [0, 0, 0, 0, 0], y0 = rail.elev.H;
      const add = (g, x, z) => { if (!g.count) return; const mesh = new THREE.Mesh(propGeometry(g.pack()), mats.prop); mesh.castShadow = true; mesh.updateMatrix(); mesh.matrixAutoUpdate = false; mesh.name = 'cau_long_bien'; scene.add(mesh); out.push({ site: { id: 'cau_long_bien', x, z }, mesh }); };
      // tim cầu đoạn có dàn thép: từ mép đê ra tới mép bản đồ
      const P = []; for (let s = 0; s <= rail.len; s += 20) { alongAt(rail, s, o); if (o[0] > LB_TRUSS_X) P.push([o[0], o[1]]); }
      let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      const SEG = 106 * 2, n = Math.ceil(L / SEG);
      for (let q = 0; q < n; q++) { const g = new G(); mod.buildAlong(g, P, q * SEG, Math.min(L, (q + 1) * SEG), y0); const c = P[Math.min(P.length - 1, Math.round(((q + 0.5) * SEG) / 20))]; add(g, c[0], c[1]); }
      // lan can: mép ngoài (phía xa đường sắt) của từng làn xe, chỗ mặt cầu đã lên cao
      const railD = (x, z) => { let d = 1e9; for (let i = 0; i < rail.p.length - 2; i += 2) d = Math.min(d, segDist2(x, z, rail.p[i], rail.p[i + 1], rail.p[i + 2], rail.p[i + 3])); return d; };
      for (const r of world.roads) {
        if (!r.elev || !/Long Biên/.test(world.names[r.name] || '')) continue;
        for (let a = 0; a < r.len; a += 198) {
          const E = [], b = Math.min(r.len, a + 198), m = Math.max(1, Math.round((b - a) / 6.6));
          for (let k = 0; k <= m; k++) {
            const s = a + ((b - a) * k) / m, y = roadY(r, s); if (y < 0.45) continue;
            alongAt(r, s, o); const nx = -o[3], nz = o[2], sd = railD(o[0] + nx, o[1] + nz) > railD(o[0] - nx, o[1] - nz) ? 1 : -1, e = r.w / 2 - 0.08;
            E.push([o[0] + nx * sd * e, y, o[1] + nz * sd * e]);
          }
          if (E.length > 1) { const g = new G(); mod.buildRailing(g, E); const c = E[E.length >> 1]; add(g, c[0], c[2]); }
        }
      }
    }
  } catch (e) { console.warn('cau_long_bien', e); }
  // cầu Chương Dương: dàn thép biên song song dọc lòng giữa, từ hết cầu dẫn ra tới mép bản đồ; mỗi lưới hai nhịp
  try {
    const cd = chuongDuongMid(world);
    if (cd && modules['./cau_chuong_duong.js']) {
      const mod = await modules['./cau_chuong_duong.js'](), { r, rev } = cd, o = [0, 0, 0, 0, 0], P = [];
      for (let s = CD_TRUSS_S; s <= r.len; s += 10) { alongAt(r, rev ? r.len - s : s, o); P.push([o[0], o[1]]); }
      let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      const y0 = roadY(r, r.len / 2), SEG = CD_SPAN * 2, n = Math.floor(L / CD_SPAN);
      for (let q = 0; q * SEG < n * CD_SPAN; q++) {
        const g = new G(); mod.buildAlong(g, P, q * SEG, Math.min(n * CD_SPAN, (q + 1) * SEG), y0); if (!g.count) continue;
        const c = P[Math.min(P.length - 1, Math.round(((q + 0.5) * SEG) / 10))];
        const mesh = new THREE.Mesh(propGeometry(g.pack()), mats.prop); mesh.castShadow = true; mesh.updateMatrix(); mesh.matrixAutoUpdate = false; mesh.name = 'cau_chuong_duong';
        scene.add(mesh); out.push({ site: { id: 'cau_chuong_duong', x: c[0], z: c[1] }, mesh });
      }
    }
  } catch (e) { console.warn('cau_chuong_duong', e); }
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
    // va chạm: khối khai trong sites.js, hoặc mặt bằng của chính mô hình nếu là công trình kín
    { const col = siteCollision({ ...s, y: 0 }, g.pos); if (col.length) nav.addChunk('lm:' + s.id, col, new Float32Array(0)); }
  }
  return out;
}
