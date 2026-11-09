// Đặt mô hình thật (craft-anything, CC0) vào thành phố: công trình, cây, đèn lồng, đèn đường, lan can, bàn ghế.
import * as THREE from 'three';

const Y = new THREE.Vector3(0, 1, 0);
// Ma trận đặt đồ: trục X của mô hình dọc theo `along`, trục Z quay về phía `facing` (như craft-anything).
export function placeMatrix(x, y, z, along, facing, sx = 1) {
  const fz = new THREE.Vector3(facing.x, 0, facing.y).normalize();
  const ax = Y.clone().cross(fz).normalize();
  if (along && ax.dot(new THREE.Vector3(along.x, 0, along.y)) < 0) { /* giữ hệ tay phải, chỉ đổi hướng Z */ }
  const m = new THREE.Matrix4().makeBasis(ax.multiplyScalar(sx), Y.clone(), fz);
  m.setPosition(x, y, z);
  return m;
}
export function yawMatrix(x, y, z, yaw, s = 1) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(Y, yaw), new THREE.Vector3(s, s, s));
}

// Biến một cảnh glTF thành các InstancedMesh theo danh sách ma trận.
export function instance(scene, matrices, { shadow = true, cull = true } = {}) {
  const g = new THREE.Group();
  if (!matrices.length) return g;
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, matrices.length);
    const tmp = new THREE.Matrix4();
    matrices.forEach((m, i) => im.setMatrixAt(i, tmp.multiplyMatrices(m, o.matrixWorld)));
    im.castShadow = shadow; im.receiveShadow = true;
    im.computeBoundingSphere();
    if (!cull) im.frustumCulled = false;
    g.add(im);
  });
  return g;
}

function hash(i, k = 0) { let h = (i * 374761393 + k * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

export function placeLandmarks(city, glb, group) {
  for (const id of ['thap_rua', 'den_ngoc_son', 'cau_the_huc', 'thap_but_dai_nghien']) {
    const s = city.sites[id]; if (!s || !glb[id]) continue;
    const o = glb[id].scene;
    o.position.set(s.at.x, 0, s.at.y); o.rotation.y = s.yaw;
    o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    group.add(o);
  }
}

export function placeLanterns(city, glb, group, glows) {
  const red = [], yellow = [];
  let k = 0;
  for (const r of city.roads.filter((r) => r.name === 'Phố Hàng Mã')) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1];
      const d = b.clone().sub(a).normalize();
      const n = new THREE.Vector2(-d.y, d.x).multiplyScalar(r.w / 2 + 0.6);
      const steps = Math.ceil(a.distanceTo(b) / 1.6);
      for (let j = 0; j < steps; j++, k++) {
        const p = a.clone().lerp(b, j / Math.max(steps, 1));
        for (const [side, isRed] of [[1, k % 2 === 0], [-1, k % 2 === 1]]) {
          const q = p.clone().addScaledVector(n, side);
          const y = 4.6 + (k % 3) * 0.25 + 0.32;
          (isRed ? red : yellow).push(yawMatrix(q.x, y, q.y, (k * 1.7) % 6.283, 1.6));
          if (k % 5 === 0) glows.push({ at: new THREE.Vector3(q.x, y - 0.5, q.y), color: isRed ? 0xff5a3a : 0xffc65a, range: 9, power: 0.9 });
        }
      }
    }
  }
  const half = (arr, t) => arr.filter((_, i) => i % 2 === t);
  group.add(instance(glb.den_long_01.scene, half(red, 0), { shadow: false }));
  group.add(instance(glb.den_long_03.scene, half(red, 1), { shadow: false }));
  group.add(instance(glb.den_long_02.scene, yellow, { shadow: false }));
}

export function placeStreetLamps(city, glb, group, glows) {
  const ms = [];
  for (const r of city.roads) {
    if (!(r.kind === 'primary' || r.kind === 'secondary') || r.bridge) continue;
    let along = 0, next = 12, side = 1;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1], len = a.distanceTo(b); if (len < 0.5) continue;
      const d = b.clone().sub(a).divideScalar(len), n = new THREE.Vector2(-d.y, d.x);
      while (next <= along + len) {
        const p = a.clone().addScaledVector(d, next - along);
        const foot = p.clone().addScaledVector(n, side * (r.w / 2 + 0.7));
        if (!city.blocked(foot.x, foot.y, 0.2)) {
          ms.push(placeMatrix(foot.x, 0, foot.y, d, n.clone().multiplyScalar(-side)));
          glows.push({ at: new THREE.Vector3(foot.x - n.x * side * 1.2, 4.3, foot.y - n.y * side * 1.2), color: 0xffd9a0, range: 16, power: 1.2 });
        }
        side = -side; next += 30;
      }
      along += len;
    }
  }
  group.add(instance(glb.den_duong.scene, ms));
}

export function placeRailing(city, glb, group) {
  // Hồ lớn nhất là Hồ Gươm.
  let lake = null, best = 0;
  for (const w of city.rings.water) { const lo = new THREE.Vector2(1e9, 1e9), hi = new THREE.Vector2(-1e9, -1e9); w.outer.forEach((p) => { lo.min(p); hi.max(p); }); const s = (hi.x - lo.x) * (hi.y - lo.y); if (s > best && Math.abs(lo.x) < 400 && Math.abs(lo.y) < 600) { best = s; lake = w; } }
  if (!lake) return null;
  city.lake = lake;
  const ring = lake.outer.slice();
  let area = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; area += p.x * q.y - q.x * p.y; }
  const sgn = area > 0 ? 1 : -1;
  const decks = [];
  const th = city.sites.cau_the_huc; if (th) decks.push(th.a, th.b);
  const ms = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], len = a.distanceTo(b); if (len < 0.5) continue;
    const d = b.clone().sub(a).divideScalar(len);
    const out = new THREE.Vector2(d.y, -d.x).multiplyScalar(sgn);
    const pieces = Math.max(1, Math.round(len / 2.1)), step = len / pieces;
    for (let k = 0; k < pieces; k++) {
      const p = a.clone().addScaledVector(d, step * (k + 0.5)).addScaledVector(out, 0.6);
      if (decks.some((q) => q.distanceTo(p) < 6)) continue;
      ms.push(placeMatrix(p.x, 0, p.y, d, out, step / 2.1));
    }
  }
  group.add(instance(glb.hang_rao_ho.scene, ms, { shadow: false }));
  return lake;
}

// Bàn ghế nhựa trên vỉa hè các phố ăn uống.
export function placeStools(city, glb, group) {
  const streets = ['Phố Tạ Hiện', 'Phố Lương Ngọc Quyến', 'Phố Đinh Liệt', 'Phố Hàng Buồm', 'Phố Bát Đàn', 'Phố Hàng Mành', 'Phố Chả Cá', 'Phố Hàng Bạc', 'Phố Mã Mây', 'Phố Nguyễn Hữu Huân', 'Phố Cầu Gỗ', 'Phố Hàng Bè'];
  const red = [], blue = [], tables = [];
  let n = 0;
  for (const r of city.roads) {
    if (!streets.includes(r.name)) continue;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1], len = a.distanceTo(b);
      const d = b.clone().sub(a).normalize(), nn = new THREE.Vector2(-d.y, d.x);
      for (let t = 3; t < len - 2; t += 6, n++) {
        if (hash(n, 1) < 0.45) continue;
        const side = hash(n, 2) < 0.5 ? 1 : -1;
        const c = a.clone().addScaledVector(d, t).addScaledVector(nn, side * (r.w / 2 + 1.2));
        if (city.blocked(c.x, c.y, 0.6)) continue;
        tables.push(yawMatrix(c.x, 0, c.y, Math.atan2(d.x, d.y)));
        for (let s = 0; s < 4; s++) {
          const ang = s * Math.PI / 2 + hash(n, 10 + s) * 0.5;
          const q = c.clone().add(new THREE.Vector2(Math.cos(ang), Math.sin(ang)).multiplyScalar(0.62));
          (hash(n, 20 + s) < 0.5 ? red : blue).push(yawMatrix(q.x, 0, q.y, ang));
        }
      }
    }
  }
  group.add(instance(glb.ban_nhua.scene, tables), instance(glb.ghe_do.scene, red), instance(glb.ghe_xanh.scene, blue));
  return tables.length;
}

// Cây xà cừ: gần thì mô hình 3D, xa thì tấm ảnh chéo nhau (billboard).
export class Trees {
  constructor(city, glb, billboardTex, group) {
    this.pts = city.data.trees.map((p) => new THREE.Vector2(p[0] / 10, p[1] / 10)).filter((p) => !city.blocked(p.x, p.y, 0.1) || true);
    // thêm hàng cây quanh Hồ Gươm
    if (city.lake) {
      const ring = city.lake.outer; let acc = 0;
      for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; acc += a.distanceTo(b); if (acc > 14) { acc = 0; const c = a.clone().lerp(b, 0.5); const out = c.clone().sub(new THREE.Vector2(0, 0)); const p = c.clone().add(out.normalize().multiplyScalar(5)); if (!city.blocked(p.x, p.y, 1)) this.pts.push(p); } }
    }
    this.scale = this.pts.map((_, i) => 0.55 + hash(i, 4) * 0.35);
    this.yaw = this.pts.map((_, i) => hash(i, 5) * 6.283);
    this.near = [];
    this.max = 140;
    this.model = glb.xa_cu.scene; this.model.updateMatrixWorld(true);
    this.parts = [];
    this.model.traverse((o) => { if (o.isMesh) { const im = new THREE.InstancedMesh(o.geometry, o.material, this.max); im.castShadow = true; im.receiveShadow = true; im.count = 0; im.frustumCulled = false; im.userData.base = o.matrixWorld.clone(); this.parts.push(im); group.add(im); } });
    // billboard: 2 mặt phẳng chéo
    const w = 16, h = 22;
    const g1 = new THREE.PlaneGeometry(w, h); g1.translate(0, h / 2, 0);
    const g2 = g1.clone(); g2.rotateY(Math.PI / 2);
    const merged = new THREE.BufferGeometry();
    const pos = new Float32Array([...g1.attributes.position.array, ...g2.attributes.position.array]);
    const uv = new Float32Array([...g1.attributes.uv.array, ...g2.attributes.uv.array]);
    const nrm = new Float32Array(pos.length); for (let i = 0; i < nrm.length; i += 3) nrm[i + 1] = 1;
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3)); merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); merged.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    const i1 = g1.index.array, i2 = Array.from(g2.index.array, (x) => x + 4); merged.setIndex([...i1, ...i2]);
    billboardTex.colorSpace = THREE.SRGBColorSpace;
    this.bb = new THREE.InstancedMesh(merged, new THREE.MeshStandardMaterial({ map: billboardTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), this.pts.length);
    this.bb.frustumCulled = false; this.bb.castShadow = false;
    group.add(this.bb);
    this.last = new THREE.Vector2(1e9, 1e9);
  }
  update(px, pz, radius = 90) {
    if (this.last.distanceTo(new THREE.Vector2(px, pz)) < 8) return;
    this.last.set(px, pz);
    const m = new THREE.Matrix4(), tmp = new THREE.Matrix4();
    let n = 0, b = 0;
    const order = this.pts.map((p, i) => [i, (p.x - px) ** 2 + (p.y - pz) ** 2]).sort((a, c) => a[1] - c[1]);
    for (const [i, d2] of order) {
      const p = this.pts[i], s = this.scale[i];
      m.copy(yawMatrix(p.x, 0, p.y, this.yaw[i], s));
      if (d2 < radius * radius && n < this.max) {
        for (const im of this.parts) im.setMatrixAt(n, tmp.multiplyMatrices(m, im.userData.base));
        n++;
      } else this.bb.setMatrixAt(b++, m);
    }
    for (const im of this.parts) { im.count = n; im.instanceMatrix.needsUpdate = true; }
    this.bb.count = b; this.bb.instanceMatrix.needsUpdate = true;
  }
}

// Biển hiệu quán xá có thật (tên lấy từ OSM, đã bỏ thương hiệu chuỗi).
export function placeSigns(city, signs, group) {
  const W = 1024, rowH = 64, cols = 2, perCol = 16;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = 2048;
  const g = canvas.getContext('2d');
  const palettes = [['#b3121f', '#ffe08a'], ['#123c8c', '#ffffff'], ['#f2c230', '#8a1010'], ['#1d6b34', '#fff6d0'], ['#f4efe2', '#a3121a']];
  const list = signs.slice(0, cols * 32);
  list.forEach((s, i) => {
    const col = i % cols, row = (i / cols) | 0;
    const x = col * (W / cols), y = row * rowH;
    const [bg, fg] = palettes[i % palettes.length];
    g.fillStyle = bg; g.fillRect(x, y, W / cols, rowH);
    g.fillStyle = fg; g.font = 'bold 34px "Be Vietnam Pro", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(s.name.toUpperCase().slice(0, 26), x + W / cols / 2, y + rowH / 2, W / cols - 20);
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, W / cols - 4, rowH - 4);
  });
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const pos = [], uv = [], idx = [];
  list.forEach((s, i) => {
    const p = new THREE.Vector2(s.at[0] / 10, s.at[1] / 10);
    // tìm mặt tường gần nhất
    const k = Math.floor(p.x / city.cell) + ',' + Math.floor(p.y / city.cell);
    let best = null, bd = 12;
    for (const o of city.grid.get(k) || []) {
      const r = o.ring;
      for (let j = 0; j < r.length; j++) {
        const a = r[j], b = r[(j + 1) % r.length]; const ab = b.clone().sub(a); const L = ab.length(); if (L < 2.5) continue;
        const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / (L * L), 0.15, 0.85);
        const q = a.clone().addScaledVector(ab, t); const dd = q.distanceTo(p);
        if (dd < bd) { bd = dd; best = { q, d: ab.divideScalar(L) }; }
      }
    }
    if (!best) return;
    const out = new THREE.Vector2(best.d.y, -best.d.x); // pháp tuyến ra ngoài (vòng ngược chiều kim đồng hồ)
    const c = best.q.clone().addScaledVector(out, 0.08);
    const half = 1.6, y0 = 3.75, y1 = 4.55;
    const L = c.clone().addScaledVector(best.d, -half), R = c.clone().addScaledVector(best.d, half);
    const col = i % cols, row = (i / cols) | 0;
    const u0 = col / cols, u1 = (col + 1) / cols, v1 = 1 - (row * rowH) / 2048, v0 = 1 - ((row + 1) * rowH) / 2048;
    const s0 = pos.length / 3;
    pos.push(L.x, y0, L.y, R.x, y0, R.y, R.x, y1, R.y, L.x, y1, L.y);
    uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    idx.push(s0, s0 + 2, s0 + 1, s0, s0 + 3, s0 + 2);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.05, roughness: 0.6, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(geo, mat));
  return mat;
}
