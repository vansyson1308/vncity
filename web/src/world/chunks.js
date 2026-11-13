// Quản lý các ô phố 128 m: yêu cầu worker dựng ô gần người chơi (gần trước, xa sau), gỡ ô đã xa,
// đổi bản chi tiết/bản xa của đồ vật theo khoảng cách. Luồng chính chỉ việc nạp mảng vào GPU.
import * as THREE from 'three';
import { CS } from './data.js';
import { propGeometry } from './materials.js';
import { lampU, LAMP_STORE, WEATHER } from '../engine/sky.js';

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
    // mùa của cây đi theo thời tiết của game (tham số ?weather=, mặc định "mu" = mùa đông): worker tô lá, hoa theo mùa này
    let w = 'mu'; try { w = new URLSearchParams(location.search).get('weather') || w; } catch { /* node */ }
    this.season = WEATHER[w] ? w : 'mu';
  }
  init(url, landmarks, mapPpm) {
    return new Promise((res, rej) => { this._ready = res; this._fail = rej; this.worker.postMessage({ type: 'init', url, landmarks, mapPpm, season: this.season }); });
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
    // Ô đặt dựng ở chỗ cũ mà tới nơi khi người chơi đã đi nhanh đi xa: bỏ luôn. Việc gỡ ô xa chỉ chạy khi người chơi đi thêm vài mét, nên
    // trước đây những ô tới muộn này nằm lại cùng các đoạn va chạm của chúng tới khi người chơi rời chỗ (tester vòng 5, tools/qa/leak.mjs:
    // về lại nơi đầu sau 42 lần đi nhanh còn thừa 6 ô phố, đoạn va chạm +40%).
    { const wb = this.world.bounds, R = this.q.view + CS * 0.5; if (Math.hypot(wb.x0 + (m.cx + 0.5) * CS - this.last.x, wb.z0 + (m.cz + 0.5) * CS - this.last.z) > R + CS * 1.2) return; }
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
    if (this.lampsDirty && this.onLamps && !this.pending.size) { this.lampsDirty = false; this.onLamps([...this.loaded.values()].sort((a, b) => (a.x - px) ** 2 + (a.z - pz) ** 2 - (b.x - px) ** 2 - (b.z - pz) ** 2).map((c) => c.lamps)); } // ô gần trước: nếu vượt sức chứa thì phần bị bỏ là vệt sáng ở xa nhất
  }

  // Số ô còn thiếu trong bán kính r quanh điểm (để màn hình tải biết khi nào vào game được).
  missingNear(px, pz, r) {
    const b = this.world.bounds; let n = 0, total = 0;
    for (let cx = Math.max(0, Math.floor((px - r - b.x0) / CS)); cx <= Math.min(this.world.nx - 1, Math.floor((px + r - b.x0) / CS)); cx++) for (let cz = Math.max(0, Math.floor((pz - r - b.z0) / CS)); cz <= Math.min(this.world.nz - 1, Math.floor((pz + r - b.z0) / CS)); cz++) { total++; if (!this.loaded.has(cx * 1000 + cz)) n++; }
    return [n, total];
  }
}

import { ZONE, zoneAt } from './data.js'; // (để riêng ở đây cho phần vệt sáng, tránh đụng dòng import đầu tệp)

// Ánh đèn phố hắt xuống mặt đất và đồ vật: bản đồ ánh sáng nhìn từ trên xuống (xem LAMP_GLSL trong engine/sky.js).
// Mỗi nguồn sáng [x, y, z, bán kính] do bộ sinh đồ vật ghi lại (props.js, decor.js) là một tấm vuông vẽ CỘNG màu vào một
// texture 8 bit phủ ±LAMP_HALF mét quanh người chơi; chỉ vẽ lại khi danh sách đèn đổi (nạp, gỡ ô phố) hoặc người chơi đã đi xa
// tâm bản đồ. Rẻ hơn rất nhiều so với đèn điểm thật (mỗi đèn điểm làm mọi điểm ảnh phải tính thêm một nguồn sáng) và cũng rẻ hơn
// cách cũ (hàng nghìn tấm trong suốt vẽ chồng lên mặt đường mỗi khung hình).
// Vật liệu NHÂN độ sáng của chính nó với (1 + đèn) nên vân đá lát, vạch sơn, miếng vá vẫn rõ dưới đèn; tổng đèn được nén mềm
// (LAMP_CAP) nên chỗ nhiều đèn chồng nhau không cháy.
// Màu theo loại đèn (art bible mục 7): trục chính dùng LED trắng trung tính, phố nhỏ và phố cổ còn đèn sodium vàng cam,
// đèn vườn quanh hồ vàng ấm, tuýp LED cửa hàng trắng lạnh hắt ra vỉa hè, phố đèn lồng thì đỏ cam.
// Loại đèn suy từ bán kính vệt sáng mà bộ sinh đồ vật ghi trong danh sách [x, y, z, bán kính] (props.js, decor.js).
const POOL = { led: [4.0, 3.8, 3.0], sodium: [5.4, 2.9, 0.8], park: [4.2, 2.9, 1.5], shop: [2.6, 2.3, 1.8], lantern: [3.0, 1.2, 0.45] };
const poolKind = (x, z, r) => (r >= 11 ? (zoneAt(x, z) === ZONE.old ? POOL.sodium : POOL.led) : r >= 8 ? POOL.sodium : r >= 6.5 ? POOL.park : r >= 5.5 ? POOL.lantern : POOL.shop);
const LAMP_HALF = 400, LAMP_SNAP = 16, LAMP_MOVE = 56; // nửa bề rộng bản đồ (m); tâm bắt vào lưới 16 m; đi xa tâm quá 56 m thì vẽ lại
export class LightPools {
  constructor(renderer, quality, max = 6000) {
    this.r = renderer; this.max = max; this.n = 0; this.dirty = false; this.cx = 1e9; this.cz = 1e9;
    const size = quality && quality.name === 'low' ? 512 : 1024;
    this.rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: false, type: THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    lampU.uLampTex.value = this.rt.texture;
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.aPool = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); this.aTint = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    geo.setAttribute('aPool', this.aPool); geo.setAttribute('aTint', this.aTint); geo.instanceCount = 0;
    // Hình vệt sáng tính bằng công thức (không cần texture): sáng nhất dưới chân đèn, toả rộng và tắt êm ở rìa để hai đèn liền nhau
    // nối được vệt sáng. Cộng cả bốn kênh (RGB: đèn dưới đất; A: đèn trên mặt cầu nâng).
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: new THREE.Vector3(0, 0, 1) } }, depthTest: false, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
      vertexShader: /* glsl */`
        attribute vec4 aPool; attribute vec3 aTint; uniform vec3 uMap; varying vec2 vP; varying vec4 vTint;
        void main(){
          vP = position.xy; vTint = vec4(aTint * (1.0 - aPool.w), aPool.w) * ${(1 / LAMP_STORE).toFixed(4)};
          gl_Position = vec4((aPool.xy + position.xy * aPool.z - uMap.xy) * (uMap.z * 2.0), 0.0, 1.0); }`,
      fragmentShader: /* glsl */`
        varying vec2 vP; varying vec4 vTint;
        void main(){ float k = max(1.0 - dot(vP, vP), 0.0); gl_FragColor = vTint * (k * sqrt(k)); }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(this.mesh); this.cam = new THREE.Camera(); this._c = new THREE.Color();
  }
  set(lists) {
    let n = 0; const P = this.aPool.array, T = this.aTint.array;
    for (const l of lists) for (let i = 0; i < l.length && n < this.max; i += 4) {
      const c = poolKind(l[i], l[i + 2], l[i + 3]);
      P[n * 4] = l[i]; P[n * 4 + 1] = l[i + 2]; P[n * 4 + 2] = l[i + 3] * 1.4; P[n * 4 + 3] = l[i + 1] < 0 ? 1 : 0; // cao độ âm: đèn trên mặt cầu nâng
      T[n * 3] = c[0]; T[n * 3 + 1] = c[1]; T[n * 3 + 2] = c[2]; n++;
    }
    this.n = n; this.mesh.geometry.instanceCount = n; this.aPool.needsUpdate = true; this.aTint.needsUpdate = true; this.dirty = true;
  }
  // Gọi mỗi khung hình: lit = độ bật đèn 0..1 (uLit), (px, pz) = chỗ người chơi. Chỉ vẽ lại bản đồ khi cần.
  update(lit, px, pz) {
    if (lit <= 0.01 || !Number.isFinite(px) || !Number.isFinite(pz)) return;
    if (!this.dirty && Math.abs(px - this.cx) < LAMP_MOVE && Math.abs(pz - this.cz) < LAMP_MOVE) return;
    const r = this.r, cx = Math.round(px / LAMP_SNAP) * LAMP_SNAP, cz = Math.round(pz / LAMP_SNAP) * LAMP_SNAP, inv = 1 / (LAMP_HALF * 2);
    this.cx = cx; this.cz = cz; this.dirty = false; this.mat.uniforms.uMap.value.set(cx, cz, inv);
    const prev = r.getRenderTarget(), col = r.getClearColor(this._c), alpha = r.getClearAlpha(), auto = r.autoClear, shadow = r.shadowMap.needsUpdate;
    r.shadowMap.needsUpdate = false; // không để lần vẽ phụ này "tiêu" mất lượt cập nhật bóng đổ của cảnh chính
    r.setRenderTarget(this.rt); r.setClearColor(0x000000, 0); r.autoClear = true; r.render(this.scene, this.cam);
    r.setRenderTarget(prev); r.setClearColor(col, alpha); r.autoClear = auto; r.shadowMap.needsUpdate = shadow;
    lampU.uLampMap.value.set(cx, cz, inv);
  }
}
