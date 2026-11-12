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
      const mod = await modules['./cau_long_bien.js'](), o = [0, 0, 0, 0, 0];
      const add = (g, x, z) => { if (!g.count) return; const mesh = new THREE.Mesh(propGeometry(g.pack()), mats.prop); mesh.castShadow = true; mesh.updateMatrix(); mesh.matrixAutoUpdate = false; mesh.name = 'cau_long_bien'; scene.add(mesh); out.push({ site: { id: 'cau_long_bien', x, z }, mesh }); };
      // tim cầu đoạn có dàn thép: từ mố ở mép đê (LB_TRUSS_X) ra tới mép bản đồ, cả đoạn vượt bãi lẫn đoạn giữa sông
      let sT = 0; while (sT < rail.len - 40 && alongAt(rail, sT, o)[0] <= LB_TRUSS_X) sT += 1;
      const P = [], wb = world.bounds; for (let s = sT; s <= rail.len; s += 20) { alongAt(rail, s, o); P.push([o[0], o[1]]); if (o[0] > wb.x1 + 20) break; }
      let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      // cao độ mặt cầu đường sắt dọc dàn, và cao độ làn xe máy cạnh dàn (ở đoạn dốc lên cầu ba mặt cầu chưa bằng nhau)
      const yAt = (s) => roadY(rail, Math.min(rail.len, sT + s)), tt = [0];
      const lanes = world.roads.filter((r) => r.elev && /Long Biên/.test(world.names[r.name] || ''));
      const laneY = (x, z, y) => { let bd = 9; for (const r of lanes) for (let i = 0; i < r.p.length - 2; i += 2) { const d = segDist2(x, z, r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3], tt); if (d < bd) { bd = d; y = roadY(r, r.cum[i / 2] + tt[0] * (r.cum[i / 2 + 1] - r.cum[i / 2])); } } return y; };
      const SEG = mod.LB_HIGH, n = Math.ceil(L / SEG), piers = mod.pierStations(L), col = [];
      for (let q = 0; q < n; q++) {
        const g = new G(), sa = q * SEG, sb = Math.min(L, (q + 1) * SEG); mod.buildAlong(g, P, sa, sb, yAt, laneY);
        // trụ dưới mỗi đầu nhịp. Có đường, lối đi chui qua đúng chỗ đó thì bỏ trụ (nhịp vượt liền hai khoang); trụ trên bãi có va chạm
        for (const [s, slim] of piers) {
          if (s < sa || s >= sb) continue;
          alongAt(rail, Math.min(rail.len, sT + s), o); const x = o[0], z = o[1], tx = o[2], tz = o[3], hl = slim ? 1.55 : 2.3, e = 5.6 - hl;
          if (x < wb.x0 + 4 || x > wb.x1 - 4 || z < wb.z0 + 4 || z > wb.z1 - 4) continue;
          let water = false, blocked = false;
          for (const b of [-5.2, 0, 5.2]) if (nav.isWater(x - tz * b, z + tx * b)) water = true;
          // mặt bằng trụ coi như một dải bo tròn hai đầu (bán kính hl): đường nào chạm vào dải đó thì chỗ này không dựng trụ
          for (let b = -e; b <= e + 0.01; b += e / 3) { const h = nav.nearestRoad(x - tz * b, z + tx * b, 10, (r) => !r.elev && !r.skip); if (h && h.d < h.r.w / 2 + hl + 0.4) blocked = true; }
          if (blocked) continue;
          const top = Math.min(yAt(s), laneY(x - tz * 4.1, z + tx * 4.1, 99), laneY(x + tz * 4.1, z - tx * 4.1, 99)) - 1.12; if (top < 1.2) continue;
          const F = mod.buildPier(g, [x, z, tx, tz], top, water, slim, yAt(s) - 1.12);
          if (!water) for (let i = 0; i < 4; i++) col.push(F[i][0], F[i][1], F[(i + 1) % 4][0], F[(i + 1) % 4][1], Math.max(2.6, top));
        }
        const c = P[Math.min(P.length - 1, Math.round(((q + 0.5) * SEG) / 20))]; add(g, c[0], c[1]);
      }
      if (col.length) nav.addChunk('lm:cau_long_bien', new Float32Array(col), new Float32Array(0));
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
  // đèn pha rọi công trình ban đêm: mô hình nào khai `flood` riêng (lighting.js) thì dùng một bản chất liệu công trình có mức đèn pha ấy
  const floodMats = new Map(), matFor = (f) => { if (!f || !mats.makeProp) return mats.landmark; if (!floodMats.has(f)) floodMats.set(f, mats.makeProp({ side: THREE.DoubleSide, detail: true, flood: f, cut: true })); return floodMats.get(f); };
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
    const mesh = new THREE.Mesh(propGeometry(g.pack()), matFor(mod.flood));
    mesh.position.set(s.x, CURB + (s.lift || 0), s.z); mesh.rotation.y = s.yaw; mesh.castShadow = true; mesh.receiveShadow = true; mesh.updateMatrix(); mesh.matrixAutoUpdate = false; mesh.name = s.id;
    scene.add(mesh); out.push({ site: s, mesh });
    // va chạm cho các khối đặc khai báo trong sites.js (toạ độ cục bộ)
    // va chạm: khối khai trong sites.js, hoặc mặt bằng của chính mô hình nếu là công trình kín
    { const col = siteCollision({ ...s, y: 0 }, g.pos); if (col.length) nav.addChunk('lm:' + s.id, col, new Float32Array(0)); }
  }
  return out;
}
