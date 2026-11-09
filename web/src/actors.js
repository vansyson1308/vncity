// Người chơi (Minh đi bộ hoặc chạy xe máy), xe máy trên phố, khách đi dạo, chú chó vàng đi theo.
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';

const tmpV = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export function cleanClips(clips) {
  // Bỏ chuyển động gốc (root) để nhân vật đứng tại chỗ, game tự di chuyển.
  return clips.map((c) => { const k = c.clone(); k.tracks = k.tracks.filter((t) => !(t.name.startsWith('root.') && t.name.endsWith('.position'))); return k; });
}

class Anim {
  constructor(root, clips) {
    this.mixer = new THREE.AnimationMixer(root);
    this.actions = {};
    for (const c of clips) this.actions[c.name] = this.mixer.clipAction(c);
    this.cur = null;
  }
  play(name, fade = 0.25, speed = 1) {
    const a = this.actions[name]; if (!a) return;
    a.timeScale = speed;
    if (this.cur === a) return;
    a.reset().fadeIn(fade).play();
    if (this.cur) this.cur.fadeOut(fade);
    this.cur = a;
  }
  update(dt) { this.mixer.update(dt); }
}

function shadowAll(o) { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } }); }

export class Player {
  constructor(city, glb, clips, scene) {
    this.city = city;
    this.pos = new THREE.Vector3();
    this.yaw = 0; this.speed = 0; this.mode = 'walk';
    this.minh = glb.minh.scene; shadowAll(this.minh);
    this.anim = new Anim(this.minh, clips);
    this.anim.play('Idle_Loop', 0);
    this.bike = glb.xe_may.scene.clone(); shadowAll(this.bike); this.bike.visible = false;
    scene.add(this.minh, this.bike);
    this.walkables = [];
    this.ray = new THREE.Raycaster(); this.ray.far = 20;
    this.y = 0;
  }
  setWalkables(list) { this.walkables = list.map((o) => ({ o, box: new THREE.Box3().setFromObject(o).expandByScalar(1) })); }
  teleport(x, z, yaw = this.yaw) { this.pos.set(x, 0, z); this.yaw = yaw; this.speed = 0; }
  toggleBike() {
    this.mode = this.mode === 'walk' ? 'bike' : 'walk';
    this.minh.visible = this.mode === 'walk'; this.bike.visible = this.mode === 'bike';
    this.speed = 0;
    return this.mode;
  }
  groundAt(x, z) {
    for (const w of this.walkables) {
      if (x < w.box.min.x || x > w.box.max.x || z < w.box.min.z || z > w.box.max.z) continue;
      this.ray.set(tmpV.set(x, w.box.max.y + 1, z), new THREE.Vector3(0, -1, 0));
      const hit = this.ray.intersectObject(w.o, true)[0];
      if (hit && hit.point.y < this.y + 1.2) return Math.max(0, hit.point.y);
    }
    return 0;
  }
  // input: {x, y} trục di chuyển (-1..1), run, camYaw
  update(dt, input) {
    const c = this.city;
    let vx = 0, vz = 0;
    if (this.mode === 'walk') {
      const mag = Math.min(1, Math.hypot(input.x, input.y));
      const target = mag * (input.run ? 5.2 : 1.7);
      this.speed = THREE.MathUtils.damp(this.speed, target, 8, dt);
      if (mag > 0.05) {
        const want = Math.atan2(input.x, input.y) + input.camYaw + Math.PI;
        let d = ((want - this.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        this.yaw += d * Math.min(1, dt * 10);
      }
      vx = Math.sin(this.yaw) * this.speed; vz = Math.cos(this.yaw) * this.speed;
      const s = this.speed;
      if (s < 0.15) this.anim.play('Idle_Loop');
      else if (s < 2.4) this.anim.play('Walk_Loop', 0.25, s / 1.5);
      else this.anim.play(s > 4.4 ? 'Sprint_Loop' : 'Jog_Fwd_Loop', 0.25, s > 4.4 ? s / 5.6 : s / 3.6);
    } else {
      const throttle = input.y < 0 ? -input.y : 0, brake = input.y > 0 ? input.y : 0;
      const max = input.run ? 14 : 10;
      this.speed += (throttle * 6 - brake * 9 - this.speed * 0.35) * dt;
      if (brake > 0 && this.speed < 0.3) this.speed = Math.max(this.speed, -2);
      this.speed = THREE.MathUtils.clamp(this.speed, -2, max);
      const steer = -input.x * Math.min(1, Math.abs(this.speed) / 3) * 1.9;
      this.yaw += steer * dt * Math.sign(this.speed || 1);
      vx = Math.sin(this.yaw) * this.speed; vz = Math.cos(this.yaw) * this.speed;
    }
    const r = this.mode === 'bike' ? 0.6 : 0.3;
    const nx = this.pos.x + vx * dt, nz = this.pos.z + vz * dt;
    if (!c.blocked(nx, nz, r)) { this.pos.x = nx; this.pos.z = nz; }
    else if (!c.blocked(nx, this.pos.z, r)) this.pos.x = nx;
    else if (!c.blocked(this.pos.x, nz, r)) this.pos.z = nz;
    else if (this.mode === 'bike') this.speed *= -0.3;
    this.y = THREE.MathUtils.damp(this.y, this.groundAt(this.pos.x, this.pos.z), 14, dt);
    const o = this.mode === 'walk' ? this.minh : this.bike;
    o.position.set(this.pos.x, this.y, this.pos.z);
    o.rotation.set(0, this.yaw, this.mode === 'bike' ? -input.x * Math.min(1, this.speed / 8) * 0.25 : 0);
    if (this.mode === 'bike') o.rotation.y = this.yaw + Math.PI; // mô hình xe hướng -Z
    this.anim.update(dt);
  }
}

// Đi theo đồ thị đường (xe máy hoặc người đi bộ).
class Walker {
  constructor(graph, rnd) { this.g = graph; this.rnd = rnd; }
  spawnNear(x, z, rMin, rMax) {
    const L = this.g.list;
    for (let tries = 0; tries < 60; tries++) {
      const ri = (this.rnd() * L.length) | 0, r = L[ri];
      const si = (this.rnd() * (r.pts.length - 1)) | 0, p = r.pts[si];
      const d = Math.hypot(p.x - x, p.y - z);
      if (d >= rMin && d <= rMax) { this.ri = ri; this.si = si; this.dir = this.rnd() < 0.5 ? 1 : -1; if (this.dir < 0) this.si = Math.min(si + 1, r.pts.length - 1); this.t = 0; return true; }
    }
    return false;
  }
  seg() { const r = this.g.list[this.ri]; return [r.pts[this.si], r.pts[this.si + this.dir]]; }
  advance(dist) {
    let guard = 0;
    while (dist > 0 && guard++ < 8) {
      const r = this.g.list[this.ri];
      const nextI = this.si + this.dir;
      if (nextI < 0 || nextI >= r.pts.length) { this.turnAt(r.pts[this.si]); continue; }
      const a = r.pts[this.si], b = r.pts[nextI], L = a.distanceTo(b) || 0.01;
      const left = L * (1 - this.t);
      if (dist < left) { this.t += dist / L; dist = 0; }
      else { dist -= left; this.si = nextI; this.t = 0; if (this.rnd() < 0.35 || this.si === 0 || this.si === r.pts.length - 1) this.turnAt(b); }
    }
  }
  turnAt(p) {
    const k = Math.round(p.x * 10) + ',' + Math.round(p.y * 10);
    const opts = (this.g.at.get(k) || []).filter(([ri]) => ri !== this.ri || true);
    const r0 = this.g.list[this.ri];
    const cand = [];
    for (const [ri, pi] of opts) {
      const r = this.g.list[ri];
      if (pi + 1 < r.pts.length && !(ri === this.ri && this.dir === -1 && pi === this.si)) cand.push([ri, pi, 1]);
      if (pi - 1 >= 0 && !(ri === this.ri && this.dir === 1 && pi === this.si)) cand.push([ri, pi, -1]);
    }
    if (!cand.length) { this.dir = -this.dir; if (this.si + this.dir < 0 || this.si + this.dir >= r0.pts.length) this.dir = -this.dir; this.t = 0; return; }
    const [ri, pi, dir] = cand[(this.rnd() * cand.length) | 0];
    this.ri = ri; this.si = pi; this.dir = dir; this.t = 0;
  }
  where(offset, out) {
    const [a, b] = this.seg();
    const d = b.clone().sub(a); const L = d.length() || 1; d.divideScalar(L);
    const p = a.clone().lerp(b, this.t);
    const n = new THREE.Vector2(-d.y, d.x);
    out.set(p.x - n.x * offset, 0, p.y - n.y * offset);
    return Math.atan2(d.x, d.y);
  }
}

function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class Traffic {
  constructor(city, glb, scene, n = 70) {
    this.city = city; this.rnd = mulberry(7);
    this.bikes = [];
    const src = glb.xe_may.scene; src.updateMatrixWorld(true);
    this.parts = [];
    src.traverse((o) => { if (o.isMesh) { const im = new THREE.InstancedMesh(o.geometry, o.material, n); im.castShadow = true; im.frustumCulled = false; im.userData.base = o.matrixWorld.clone(); this.parts.push(im); scene.add(im); } });
    for (let i = 0; i < n; i++) { const w = new Walker(city.carGraph, this.rnd); w.speed = 5 + this.rnd() * 6; w.cur = w.speed; w.pos = new THREE.Vector3(); w.yaw = 0; w.ok = false; this.bikes.push(w); }
    this.m = new THREE.Matrix4(); this.tmp = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.one = new THREE.Vector3(1, 1, 1);
    this.honk = 0;
  }
  update(dt, player) {
    const px = player.pos.x, pz = player.pos.z;
    let i = 0;
    this.honk = 0;
    for (const b of this.bikes) {
      if (!b.ok || Math.hypot(b.pos.x - px, b.pos.z - pz) > 260) { b.ok = b.spawnNear(px, pz, 60, 240); if (!b.ok) continue; }
      const r = this.city.carGraph.list[b.ri];
      // chậm lại khi người chơi chắn đường phía trước
      const ahead = tmpV.set(Math.sin(b.yaw), 0, Math.cos(b.yaw));
      const dx = px - b.pos.x, dz = pz - b.pos.z;
      const fwd = dx * ahead.x + dz * ahead.z, side = Math.abs(dx * ahead.z - dz * ahead.x);
      const blockedAhead = fwd > 0 && fwd < 7 && side < 1.8;
      if (blockedAhead && fwd < 4) this.honk++;
      b.cur = THREE.MathUtils.damp(b.cur, blockedAhead ? 0 : b.speed, 4, dt);
      b.advance(b.cur * dt);
      b.yaw = b.where(Math.min(r.w / 4, 3), b.pos);
      this.q.setFromAxisAngle(UP, b.yaw + Math.PI);
      this.m.compose(b.pos, this.q, this.one);
      for (const im of this.parts) im.setMatrixAt(i, this.tmp.multiplyMatrices(this.m, im.userData.base));
      i++;
    }
    for (const im of this.parts) { im.count = i; im.instanceMatrix.needsUpdate = true; }
  }
}

export class Crowd {
  constructor(city, glb, clips, scene, n = 26) {
    this.city = city; this.rnd = mulberry(11);
    this.people = [];
    const models = [glb.khach_01, glb.khach_02, glb.khach_03];
    const walk = clips.find((c) => c.name === 'Walk_Loop'), formal = clips.find((c) => c.name === 'Walk_Formal_Loop') || walk;
    for (let i = 0; i < n; i++) {
      const o = skClone(models[i % 3].scene); shadowAll(o);
      const mixer = new THREE.AnimationMixer(o);
      const a = mixer.clipAction(this.rnd() < 0.5 ? walk : formal); a.time = this.rnd() * 2; a.play();
      const w = new Walker(city.walkGraph, this.rnd); w.speed = 1.1 + this.rnd() * 0.5; a.timeScale = w.speed / 1.3;
      w.o = o; w.mixer = mixer; w.pos = new THREE.Vector3(); w.ok = false; w.off = (this.rnd() - 0.5) * 1.6;
      scene.add(o); this.people.push(w);
    }
  }
  update(dt, player, cam) {
    const px = player.pos.x, pz = player.pos.z;
    for (const p of this.people) {
      if (!p.ok || Math.hypot(p.pos.x - px, p.pos.z - pz) > 170) { p.ok = p.spawnNear(px, pz, 25, 150); p.o.visible = p.ok; if (!p.ok) continue; }
      p.advance(p.speed * dt);
      const yaw = p.where(p.off, p.pos);
      p.o.position.copy(p.pos); p.o.rotation.y = yaw;
      const d = Math.hypot(p.pos.x - px, p.pos.z - pz);
      if (d < 90) p.mixer.update(dt);
    }
  }
}

export class Dog {
  constructor(glb, scene) {
    this.o = glb.cho_co.scene; shadowAll(this.o);
    this.anim = new Anim(this.o, glb.cho_co.animations);
    this.pos = new THREE.Vector3(); this.yaw = 0; this.speed = 0;
    scene.add(this.o);
    this.barkT = 0;
  }
  place(x, z) { this.pos.set(x + 2, 0, z + 2); }
  update(dt, player, city) {
    const to = new THREE.Vector3(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z);
    const d = to.length();
    const want = d > 3 ? Math.min(9, (d - 2.5) * 2.2) : 0;
    this.speed = THREE.MathUtils.damp(this.speed, want, 5, dt);
    if (d > 60) { this.pos.set(player.pos.x - 3, 0, player.pos.z - 3); }
    if (this.speed > 0.05) {
      const yaw = Math.atan2(to.x, to.z);
      let dd = ((yaw - this.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      this.yaw += dd * Math.min(1, dt * 6);
      const nx = this.pos.x + Math.sin(this.yaw) * this.speed * dt, nz = this.pos.z + Math.cos(this.yaw) * this.speed * dt;
      if (!city.blocked(nx, nz, 0.2) || d > 8) { this.pos.x = nx; this.pos.z = nz; }
    }
    this.o.position.set(this.pos.x, player.y > 0.3 && d < 4 ? player.y : 0, this.pos.z);
    this.o.rotation.y = this.yaw;
    this.anim.play(this.speed < 0.2 ? 'Idle' : this.speed < 3 ? 'Walk' : 'Run', 0.3, this.speed < 0.2 ? 1 : this.speed < 3 ? this.speed / 1.4 : this.speed / 5);
    this.anim.update(dt);
  }
}
