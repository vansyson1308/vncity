// Người đi bộ trên vỉa hè và lối dạo quanh hồ. Tất cả dùng chung một mô hình, vẽ bằng instancing với skinning trên GPU
// (hoạt hình nướng sẵn thành texture), nên vài chục người chỉ tốn ba lệnh vẽ. Mỗi người một màu áo, một chiều cao,
// một số người đội nón lá.
import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../core/util.js';
import { K, CURB, ZONE, zoneAt } from '../world/data.js';
import { bakeAnimation, SKIN_PARS } from './humans.js';
import { skyU } from '../engine/sky.js';

const SHIRTS = [[0.85, 0.85, 0.82], [0.1, 0.22, 0.5], [0.62, 0.08, 0.08], [0.1, 0.1, 0.12], [0.12, 0.35, 0.18], [0.8, 0.6, 0.08], [0.45, 0.45, 0.47], [0.7, 0.28, 0.42], [0.18, 0.5, 0.55], [0.85, 0.42, 0.1], [0.55, 0.4, 0.7], [0.9, 0.82, 0.6]];
const WALK_FRAMES = 24, STRIDE = 1.21; // một chu kỳ bước đi được 1,21 m

export class Crowd {
  constructor(scene, world, nav, humanLod, quality) {
    this.nav = nav; this.world = world; this.max = quality.crowd;
    const bake = bakeAnimation(humanLod, [['walk', WALK_FRAMES], ['idle', 1]]);
    this.bake = bake; this.idleRow = bake.ranges.idle[0];
    const cap = this.max, anim = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); anim.setUsage(THREE.DynamicDrawUsage);
    this.anim = anim; this.meshes = [];
    const patchV = (sh) => {
      sh.uniforms.uAnimTex = { value: bake.tex };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${SKIN_PARS}\nvarying vec3 vTint; varying float vH;`)
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nmat4 hm = hnSkin(); objectNormal = mat3(hm) * objectNormal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = (hm * vec4(transformed, 1.0)).xyz; vTint = aAnim.yzw; vH = transformed.y;');
    };
    let first = null;
    for (const g of bake.groups) {
      const body = g.name === 'body';
      const mat = new THREE.MeshLambertMaterial({ map: g.map });
      mat.onBeforeCompile = (sh) => {
        patchV(sh); Object.assign(sh.uniforms, { uLit: skyU.uLit });
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTint; varying float vH;')
          .replace('#include <map_fragment>', `#include <map_fragment>\n${body ? `{ float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); float mx = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)), mn = min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
            float shirt = (1.0 - smoothstep(0.035, 0.075, lum)) * (1.0 - smoothstep(0.02, 0.05, mx - mn)) * step(0.88, vH);
            diffuseColor.rgb = mix(diffuseColor.rgb, vTint * (0.3 + lum * 9.0), shirt); }` : ''}`);
      };
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
      depth.onBeforeCompile = (sh) => {
        sh.uniforms.uAnimTex = { value: bake.tex };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${SKIN_PARS}`).replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = (hnSkin() * vec4(transformed, 1.0)).xyz;');
      };
      g.geo.setAttribute('aAnim', anim);
      const m = new THREE.InstancedMesh(g.geo, mat, cap); m.count = 0; m.frustumCulled = false; m.castShadow = quality.shadow > 0; m.customDepthMaterial = depth;
      if (first) m.instanceMatrix = first.instanceMatrix; else { first = m; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
      scene.add(m); this.meshes.push(m);
    }
    // nón lá
    const hat = new THREE.ConeGeometry(0.26, 0.15, 14, 1, true); hat.translate(0, 0.075, 0);
    this.hats = new THREE.InstancedMesh(hat, new THREE.MeshLambertMaterial({ color: 0xd8c48c, side: THREE.DoubleSide }), cap); this.hats.count = 0; this.hats.frustumCulled = false; this.hats.castShadow = quality.shadow > 0; scene.add(this.hats);
    this.hats.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // các tuyến đi bộ: vỉa hè hai bên phố và lối dạo
    this.paths = [];
    for (const r of world.roads) {
      if (r.skip || r.bridge || r.len < 12) continue;
      const foot = !r.veh; if (r.veh && r.kind > K.residential) continue; if (r.kind === K.steps) continue;
      const p = r.p, cum = [0]; for (let i = 0; i < p.length - 2; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]));
      this.paths.push({ r, p, cum, len: cum[cum.length - 1], foot });
    }
    this.guest = null; // khách xe ôm đang đứng vẫy
    this.people = []; this.near = []; this.nearT = 0; this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
  }

  at(path, s, out) {
    const p = path.p, cum = path.cum; let i = 0; while (i < cum.length - 2 && cum[i + 1] < s) i++;
    const L = cum[i + 1] - cum[i] || 1, t = clamp((s - cum[i]) / L, 0, 1);
    out[0] = p[i * 2] + (p[i * 2 + 2] - p[i * 2]) * t; out[1] = p[i * 2 + 1] + (p[i * 2 + 3] - p[i * 2 + 1]) * t; out[2] = (p[i * 2 + 2] - p[i * 2]) / L; out[3] = (p[i * 2 + 3] - p[i * 2 + 1]) / L;
  }
  spawn(px, pz, cam) {
    if (!this.near.length) return;
    const path = this.near[Math.floor(Math.random() * this.near.length)], o = [0, 0, 0, 0], s = Math.random() * path.len;
    this.at(path, s, o);
    const side = Math.random() < 0.5 ? -1 : 1, lat = path.foot ? (Math.random() - 0.5) * Math.max(0.4, path.r.w - 0.8) : side * (path.r.w / 2 + 0.75 + Math.random() * 0.9);
    const x = o[0] - o[3] * lat, z = o[1] + o[2] * lat, d = Math.hypot(x - px, z - pz);
    if (d < (this.warming ? 6 : 14) || d > 95) return;
    if (cam && !this.warming && d < 45 && (x - cam.x) * cam.fx + (z - cam.z) * cam.fz > 0 && Math.random() < 0.8) return;
    const pt = { x, z }; if (this.nav.collide(pt, 0.3) || this.nav.isWater(x, z)) return;
    const idle = !path.foot && Math.random() < 0.22;
    this.people.push({ path, s, dir: Math.random() < 0.5 ? 1 : -1, lat, x, z, yaw: Math.random() * 6.28, v: idle ? 0 : 0.85 + Math.random() * 0.5, idle, phase: Math.random(), scale: 0.9 + Math.random() * 0.16, tint: SHIRTS[Math.floor(Math.random() * SHIRTS.length)], hat: Math.random() < 0.2, dist: 0, pause: 0 });
  }

  prewarm(player, camera) { this.warming = true; for (let i = 0; i < 60; i++) this.update(0.1, player, camera); this.warming = false; }
  setGuest(x, z, yaw) { this.guest = x === null || x === undefined ? null : { x, z, yaw, idle: true, scale: 1, tint: [0.95, 0.75, 0.1], hat: false, path: null }; }

  update(dt, player, camera) {
    const px = player.pos.x, pz = player.pos.z, P = this.people, o = this._o || (this._o = [0, 0, 0, 0]);
    this.nearT -= dt;
    if (this.nearT <= 0) {
      this.nearT = 1.5; this.near.length = 0;
      for (const path of this.paths) { const b = path.r.bb; if (b[0] < px + 95 && b[2] > px - 95 && b[1] < pz + 95 && b[3] > pz - 95) { const zn = zoneAt(path.p[0], path.p[1]); const n = Math.max(1, Math.round((path.len / 40) * (path.foot ? 2.5 : zn === ZONE.old ? 2 : path.r.kind >= K.residential ? 0.6 : 1))); for (let i = 0; i < n; i++) this.near.push(path); } }
    }
    for (let i = P.length - 1; i >= 0; i--) if (Math.hypot(P[i].x - px, P[i].z - pz) > 105) { P[i] = P[P.length - 1]; P.pop(); }
    const fwd = camera.getWorldDirection(this._d || (this._d = new THREE.Vector3())), cam = { x: camera.position.x, z: camera.position.z, fx: fwd.x, fz: fwd.z };
    for (let k = 0; k < 3 && P.length < this.max; k++) this.spawn(px, pz, cam);

    const A = this.anim.array, M = this.meshes[0].instanceMatrix.array, m = this._m, heads = this.bake.heads; let n = 0, nh = 0;
    const all = this.guest ? [this.guest, ...P] : P;
    for (const a of all) {
      if (n >= this.max) break;
      let row = this.idleRow;
      if (!a.idle) {
        const pd = Math.hypot(px - a.x, pz - a.z);
        let v = a.v; if (a.pause > 0) { a.pause -= dt; v = 0; }
        // nhường đường: người chơi đứng chắn phía trước thì bước chậm và né sang bên
        if (pd < 1.3) { const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw), ahead = (px - a.x) * fx + (pz - a.z) * fz; if (ahead > 0) { v *= 0.3; a.lat += (((px - a.x) * fz - (pz - a.z) * fx) > 0 ? -1 : 1) * dt * 0.8; } }
        a.s += v * dt * a.dir; a.dist += v * dt;
        if (a.s < 0 || a.s > a.path.len) { a.dir = -a.dir; a.s = clamp(a.s, 0, a.path.len); a.lat = -a.lat; }
        this.at(a.path, a.s, o);
        const tx = o[2] * a.dir, tz = o[3] * a.dir, gx = o[0] - tz * a.lat, gz = o[1] + tx * a.lat, k = 1 - Math.exp(-dt * 5);
        a.x += (gx - a.x) * k; a.z += (gz - a.z) * k;
        if (pd < 40) { const pt = this._pt || (this._pt = { x: 0, z: 0 }); pt.x = a.x; pt.z = a.z; if (this.nav.collide(pt, 0.28)) { a.x = pt.x; a.z = pt.z; } }
        if (v > 0.05) a.yaw = dampAngle(a.yaw, Math.atan2(tx, tz), 6, dt);
        row = v > 0.05 ? Math.floor((((a.dist / (STRIDE * a.scale) + a.phase) % 1) + 1) % 1 * WALK_FRAMES) : this.idleRow;
        if (Math.random() < dt * 0.01) a.pause = 1 + Math.random() * 4;
      }
      const y = this.nav.groundY(a.x, a.z);
      this._q.setFromAxisAngle(this._up, a.yaw); this._s.set(a.scale, a.scale, a.scale); this._p.set(a.x, y, a.z);
      m.compose(this._p, this._q, this._s); m.toArray(M, n * 16);
      A[n * 4] = row; A[n * 4 + 1] = a.tint[0]; A[n * 4 + 2] = a.tint[1]; A[n * 4 + 3] = a.tint[2];
      if (a.hat) { const hx = heads[row * 3], hy = heads[row * 3 + 1], hz = heads[row * 3 + 2], c = Math.cos(a.yaw), s = Math.sin(a.yaw); this._p.set(a.x + (hx * c + hz * s) * a.scale, y + (hy + 0.13) * a.scale, a.z + (-hx * s + hz * c) * a.scale); m.compose(this._p, this._q, this._s); m.toArray(this.hats.instanceMatrix.array, nh * 16); nh++; }
      n++;
    }
    for (const mesh of this.meshes) mesh.count = n;
    this.meshes[0].instanceMatrix.needsUpdate = true; this.anim.needsUpdate = true;
    this.hats.count = nh; this.hats.instanceMatrix.needsUpdate = true;
  }
}
export { damp, CURB };
