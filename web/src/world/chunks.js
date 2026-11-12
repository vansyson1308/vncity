// Quản lý các ô phố 128 m: yêu cầu worker dựng ô gần người chơi (gần trước, xa sau), gỡ ô đã xa,
// đổi bản chi tiết/bản xa của đồ vật theo khoảng cách. Luồng chính chỉ việc nạp mảng vào GPU.
import * as THREE from 'three';
import { CS, CURB } from './data.js';
import { propGeometry } from './materials.js';

export class Chunks {
  constructor(scene, world, mats, nav, quality) {
    this.scene = scene; this.world = world; this.mats = mats; this.nav = nav; this.q = quality;
    this.group = new THREE.Group(); this.group.name = 'city'; scene.add(this.group);
    this.loaded = new Map(); this.pending = new Map(); this.maxPending = 3;
    this.stats = { chunks: 0, genMs: 0, built: 0 };
    this.onLamps = null; this.onMap = null; this.onError = null; this.lampsDirty = false;
    this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e) => this.onMessage(e.data);
    this.worker.onerror = (e) => this.onError && this.onError(e.message || 'worker');
    this.last = { x: 1e9, z: 1e9 }; this.want = [];
  }
  init(url, landmarks, mapPpm) {
    return new Promise((res, rej) => { this._ready = res; this._fail = rej; this.worker.postMessage({ type: 'init', url, landmarks, mapPpm }); });
  }
  onMessage(m) {
    if (m.type === 'ready') this._ready(m);
    else if (m.type === 'map') this.onMap && this.onMap(m.bitmap, m.ppm);
    else if (m.type === 'chunk') this.build(m);
    else if (m.type === 'detail') this.attachDetail(m);
    else if (m.type === 'error') { console.error('worker:', m.message); if (m.cx !== undefined) this.pending.delete(m.cx * 1000 + m.cz); else this._fail && this._fail(new Error(m.message)); this.onError && this.onError(m.message); }
  }

  build(m) {
    const key = m.cx * 1000 + m.cz; this.pending.delete(key);
    if (this.loaded.has(key)) return;
    const b = this.world.bounds, X0 = b.x0 + m.cx * CS, Z0 = b.z0 + m.cz * CS, M = this.mats;
    const c = { key, cx: m.cx, cz: m.cz, x: X0 + CS / 2, z: Z0 + CS / 2, meshes: [], lamps: m.lamps, near: null, far: null, leaf: null, plate: null, lod: -1, detail: false, detailPending: false };
    const place = (mesh, order = 0) => { mesh.position.set(X0, 0, Z0); mesh.updateMatrix(); mesh.matrixAutoUpdate = false; mesh.renderOrder = order; this.group.add(mesh); c.meshes.push(mesh); return mesh; };
    const top = Math.max(m.bld.top || 0, 12);
    const sphere = (h, pad) => new THREE.Sphere(new THREE.Vector3(CS / 2, h / 2, CS / 2), Math.hypot(CS * 0.71 + pad, h / 2));

    { // mặt đất
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(m.ground.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(m.ground.nrm, 3, true));
      g.setAttribute('aLayer', new THREE.BufferAttribute(m.ground.lay, 1)); g.setIndex(new THREE.BufferAttribute(m.ground.idx, 1));
      g.boundingSphere = sphere(2, 2);
      const mesh = place(new THREE.Mesh(g, M.ground)); mesh.receiveShadow = true;
    }
    if (m.deck) { // mặt cầu nâng: lưới riêng, có đổ bóng xuống đất
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(m.deck.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(m.deck.nrm, 3, true));
      g.setAttribute('aLayer', new THREE.BufferAttribute(m.deck.lay, 1)); g.setIndex(new THREE.BufferAttribute(m.deck.idx, 1));
      g.boundingSphere = sphere(Math.max(4, m.deckTop || 12), 8);
      const mesh = place(new THREE.Mesh(g, M.ground)); mesh.castShadow = true; mesh.receiveShadow = true;
    }
    if (m.bld.idx.length) { // nhà
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(m.bld.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(m.bld.nrm, 3, true));
      g.setAttribute('aUv', new THREE.BufferAttribute(m.bld.uv, 2)); g.setAttribute('aFx', new THREE.BufferAttribute(m.bld.fx, 4)); g.setAttribute('aVar', new THREE.BufferAttribute(m.bld.va, 4));
      g.setIndex(new THREE.BufferAttribute(m.bld.idx, 1)); g.boundingSphere = sphere(top, 70);
      const mesh = place(new THREE.Mesh(g, M.facade)); mesh.castShadow = true; mesh.receiveShadow = true;
    }
    if (m.water) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(m.water.pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(m.water.col, 4, true));
      g.setIndex(new THREE.BufferAttribute(m.water.idx, 1)); g.boundingSphere = sphere(2, 2);
      place(new THREE.Mesh(g, M.water));
    }
    c.X0 = X0; c.Z0 = Z0;
    if (m.near) this.addDetail(c, m);
    if (m.far.idx.length) { c.far = place(new THREE.Mesh(propGeometry(m.far), M.prop)); c.far.visible = false; }
    // tường chắn hai bên dốc cầu cũng là vật cản như tường rào
    let walls = m.extra && m.extra.walls;
    if (m.ramp && m.ramp.length) { const w = new Float32Array((walls ? walls.length : 0) + m.ramp.length); if (walls) w.set(walls); w.set(m.ramp, walls ? walls.length : 0); walls = w; }
    this.nav.addChunk(key, m.col, m.shore, walls);
    this.loaded.set(key, c); this.lampsDirty = true;
    this.stats.chunks = this.loaded.size; this.stats.genMs = m.ms; this.stats.built++;
    this.applyLod(c, this.last.x, this.last.z);
  }

  // lưới chi tiết bản gần (cây đủ tán, biển hiệu, ban công...) gắn vào ô đã có nền
  addDetail(c, m) {
    const mk = (pack, mat) => { const mesh = new THREE.Mesh(propGeometry(pack), mat); mesh.position.set(c.X0, 0, c.Z0); mesh.updateMatrix(); mesh.matrixAutoUpdate = false; mesh.castShadow = true; this.group.add(mesh); c.meshes.push(mesh); return mesh; };
    if (m.near.idx.length) { c.near = mk(m.near, this.mats.prop); c.near.receiveShadow = true; }
    if (m.leaf && m.leaf.idx.length) c.leaf = mk(m.leaf, this.mats.leaf);
    if (m.plate && m.plate.idx.length && this.mats.street) { c.plate = mk(m.plate, this.mats.street); c.plate.castShadow = false; } // biển tên phố, đèn tín hiệu (bảng chữ riêng)
    c.detail = true; c.detailPending = false; c.lod = -1;
  }
  attachDetail(m) { const c = this.loaded.get(m.cx * 1000 + m.cz); if (!c || c.detail) return; this.addDetail(c, m); this.applyLod(c, this.last.x, this.last.z); }
  dropDetail(c) {
    for (const k of ['near', 'leaf', 'plate']) { const mesh = c[k]; if (!mesh) continue; this.group.remove(mesh); mesh.geometry.dispose(); c.meshes.splice(c.meshes.indexOf(mesh), 1); c[k] = null; }
    c.detail = false;
  }

  applyLod(c, px, pz) {
    const d = Math.hypot(c.x - px, c.z - pz), lod = d < this.q.near ? 0 : 1;
    if (d < this.q.near + 70 && !c.detail && !c.detailPending) { c.detailPending = true; this.worker.postMessage({ type: 'chunk', cx: c.cx, cz: c.cz, only: 'detail' }); }
    else if (c.detail && d > this.q.near * 1.5 + 130) this.dropDetail(c);
    // chưa có chi tiết thì cứ để bản xa hiện, có rồi mới đổi (không bao giờ trống cây)
    const show = lod === 0 && c.detail ? 0 : 1;
    if (show === c.lod) return; c.lod = show;
    if (c.near) c.near.visible = show === 0; if (c.leaf) c.leaf.visible = show === 0; if (c.plate) c.plate.visible = show === 0; if (c.far) c.far.visible = show === 1;
  }

  unload(c) {
    for (const mesh of c.meshes) { this.group.remove(mesh); mesh.geometry.dispose(); }
    this.nav.removeChunk(c.key); this.loaded.delete(c.key); this.lampsDirty = true;
  }

  // Gọi mỗi khung hình; việc nặng chỉ làm khi người chơi đã đi được vài mét.
  update(px, pz, force = false) {
    const moved = Math.hypot(px - this.last.x, pz - this.last.z);
    if (moved > 6 || force) {
      this.last.x = px; this.last.z = pz;
      const b = this.world.bounds, R = this.q.view + CS * 0.5, want = [];
      const cx0 = Math.max(0, Math.floor((px - R - b.x0) / CS)), cx1 = Math.min(this.world.nx - 1, Math.floor((px + R - b.x0) / CS));
      const cz0 = Math.max(0, Math.floor((pz - R - b.z0) / CS)), cz1 = Math.min(this.world.nz - 1, Math.floor((pz + R - b.z0) / CS));
      for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
        const d = Math.hypot(b.x0 + (cx + 0.5) * CS - px, b.z0 + (cz + 0.5) * CS - pz);
        if (d < R && !this.loaded.has(cx * 1000 + cz)) want.push([d, cx, cz]);
      }
      want.sort((a, c) => a[0] - c[0]); this.want = want;
      for (const c of [...this.loaded.values()]) { if (Math.hypot(c.x - px, c.z - pz) > R + CS * 1.2) this.unload(c); else this.applyLod(c, px, pz); }
    }
    while (this.pending.size < this.maxPending && this.want.length) {
      const [, cx, cz] = this.want.shift(), key = cx * 1000 + cz;
      if (this.loaded.has(key) || this.pending.has(key)) continue;
      this.pending.set(key, 1); this.worker.postMessage({ type: 'chunk', cx, cz, detail: Math.hypot(this.world.bounds.x0 + (cx + 0.5) * CS - px, this.world.bounds.z0 + (cz + 0.5) * CS - pz) < this.q.near + 70 });
    }
    if (this.lampsDirty && this.onLamps && !this.pending.size) { this.lampsDirty = false; this.onLamps([...this.loaded.values()].map((c) => c.lamps)); }
  }

  // Số ô còn thiếu trong bán kính r quanh điểm (để màn hình tải biết khi nào vào game được).
  missingNear(px, pz, r) {
    const b = this.world.bounds; let n = 0, total = 0;
    for (let cx = Math.max(0, Math.floor((px - r - b.x0) / CS)); cx <= Math.min(this.world.nx - 1, Math.floor((px + r - b.x0) / CS)); cx++) for (let cz = Math.max(0, Math.floor((pz - r - b.z0) / CS)); cz <= Math.min(this.world.nz - 1, Math.floor((pz + r - b.z0) / CS)); cz++) { total++; if (!this.loaded.has(cx * 1000 + cz)) n++; }
    return [n, total];
  }
}

// Vệt sáng dưới chân đèn đường: một InstancedMesh cộng màu, chỉ hiện khi trời tối.
// Rẻ hơn rất nhiều so với đặt đèn điểm thật (mỗi đèn điểm làm mọi điểm ảnh phải tính thêm một nguồn sáng).
export class LightPools {
  constructor(scene, max = 5000) {
    const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    const tex = new THREE.CanvasTexture(cv);
    this.mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffc98a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const geo = new THREE.PlaneGeometry(2, 2); geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, this.mat, max); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 5; this.max = max;
    scene.add(this.mesh);
    this._m = new THREE.Matrix4();
  }
  set(lists) {
    let n = 0; const m = this._m;
    for (const l of lists) for (let i = 0; i < l.length && n < this.max; i += 4) {
      const r = l[i + 3] * 1.25; m.makeScale(r, 1, r); m.setPosition(l[i], l[i + 1] < 0 ? 0.06 - l[i + 1] : l[i + 1] > 5 ? 0.03 : CURB + 0.03, l[i + 2]); this.mesh.setMatrixAt(n++, m);
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true;
  }
  update(lit) { this.mat.opacity = lit * 0.5; this.mesh.visible = lit > 0.02; }
}
