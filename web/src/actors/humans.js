// Tiện ích cho mô hình người: nướng một tư thế thành lưới tĩnh (người lái xe trong dòng xe)
// và nướng hoạt hình thành texture ma trận xương (đám đông người đi bộ vẽ bằng instancing, skinning trên GPU).
import * as THREE from 'three';

const _v = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1), _q = new THREE.Quaternion();
const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

function texPixels(map) {
  if (!map || !map.image) return null;
  const img = map.image, c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  return { d: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
}
function prepare(gltf) {
  const root = gltf.scene, bones = {}, meshes = [];
  root.traverse((o) => { if (o.isBone) bones[o.name] = o; if (o.isSkinnedMesh) meshes.push(o); });
  const mixer = new THREE.AnimationMixer(root);
  return { root, bones, meshes, mixer };
}
function applyPose(H, gltf, clip, time, extra) {
  H.mixer.stopAllAction();
  const c = gltf.animations.find((a) => a.name === clip);
  if (c) { for (const t of c.tracks) if (t.name === 'Bip01.position') { const v = t.values; for (let i = 3; i < v.length; i += 3) { v[i] = v[0]; v[i + 2] = v[2]; } } const a = H.mixer.clipAction(c); a.play(); H.mixer.setTime(time); }
  if (extra) for (const [name, ang] of extra) { const b = H.bones[name]; if (b) b.quaternion.multiply(_q.setFromAxisAngle(_z, ang)); }
  H.root.updateMatrixWorld(true);
  for (const m of H.meshes) m.skeleton.update();
}

// Nướng mô hình ở một tư thế thành mảng đỉnh có màu (lấy từ ảnh da/quần áo). Áo tối màu được đánh dấu mặt nạ 0,5
// và tô xám sáng để mỗi người lái nhuộm một màu áo riêng.
export function bakePose(gltf, clip, time, extraPose) {
  const H = prepare(gltf); applyPose(H, gltf, clip, time, extraPose);
  const pos = [], col = [], idx = []; let head = [0, 1.65, 0];
  if (H.bones.Bip01_Head) { H.bones.Bip01_Head.getWorldPosition(_v); head = [_v.x, _v.y, _v.z]; }
  for (const m of H.meshes) {
    const geo = m.geometry, P = geo.attributes.position, UV = geo.attributes.uv, tex = texPixels(m.material.map), base = pos.length / 3, body = m.material.name === 'body';
    for (let i = 0; i < P.count; i++) {
      const restY = P.getY(i);
      m.getVertexPosition(i, _v); _v.applyMatrix4(m.matrixWorld); pos.push(_v.x, _v.y, _v.z);
      let r = 0.6, g = 0.5, b = 0.45;
      if (tex && UV) { const x = Math.min(tex.w - 1, Math.max(0, Math.floor(UV.getX(i) * tex.w))), y = Math.min(tex.h - 1, Math.max(0, Math.floor(UV.getY(i) * tex.h))), o = (y * tex.w + x) * 4; r = s2l(tex.d[o] / 255); g = s2l(tex.d[o + 1] / 255); b = s2l(tex.d[o + 2] / 255); }
      const lum = 0.3 * r + 0.59 * g + 0.11 * b, sat = Math.max(r, g, b) - Math.min(r, g, b);
      void restY;
      if (body && lum < 0.06 && sat < 0.03 && _v.y > head[1] - 0.72) col.push(0.75, 0.75, 0.75, 0.5); else col.push(r, g, b, 0);
    }
    const I = geo.index.array; for (let i = 0; i < I.length; i++) idx.push(I[i] + base);
  }
  // pháp tuyến mượt tính lại từ lưới đã uốn
  const nrm = new Float32Array(pos.length);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { nrm[k] += nx; nrm[k + 1] += ny; nrm[k + 2] += nz; }
  }
  return { pos, nrm, col, idx, head };
}
// Ghép lưới đã nướng vào một G theo phép biến đổi hiện tại của G.
export function appendBaked(g, b) {
  const base = g.count, c0 = g.c;
  for (let i = 0; i < b.pos.length; i += 3) { g.c = [b.col[(i / 3) * 4], b.col[(i / 3) * 4 + 1], b.col[(i / 3) * 4 + 2], b.col[(i / 3) * 4 + 3]]; g.v(b.pos[i], b.pos[i + 1], b.pos[i + 2], b.nrm[i], b.nrm[i + 1], b.nrm[i + 2]); }
  for (let i = 0; i < b.idx.length; i++) g.idx.push(b.idx[i] + base);
  g.c = c0;
}

// Nướng hoạt hình: mỗi hàng của texture là một khung hình, mỗi xương chiếm 4 điểm ảnh RGBA32F (ma trận 4×4).
// Ma trận đã gộp sẵn bind → không gian mô hình nên shader chỉ việc nhân với vị trí gốc.
export function bakeAnimation(gltf, clips, fps = 24) {
  const H = prepare(gltf), mesh0 = H.meshes[0], nb = mesh0.skeleton.bones.length;
  const ranges = {}; let rows = 0;
  for (const [name, frames] of clips) { ranges[name] = [rows, frames]; rows += frames; }
  const data = new Float32Array(rows * nb * 16), heads = new Float32Array(rows * 3), m = new THREE.Matrix4(), bm = new THREE.Matrix4();
  let row = 0;
  for (const [name, frames] of clips) {
    const clip = gltf.animations.find((a) => a.name === name), dur = clip ? clip.duration : 1;
    for (let f = 0; f < frames; f++) {
      applyPose(H, gltf, name, frames > 1 ? (f / frames) * dur : 0);
      const sk = mesh0.skeleton;
      for (let b = 0; b < nb; b++) {
        bm.fromArray(sk.boneMatrices, b * 16);
        m.copy(mesh0.matrixWorld).multiply(mesh0.bindMatrixInverse).multiply(bm).multiply(mesh0.bindMatrix);
        m.toArray(data, (row * nb + b) * 16);
      }
      if (H.bones.Bip01_Head) { H.bones.Bip01_Head.getWorldPosition(_v); heads[row * 3] = _v.x; heads[row * 3 + 1] = _v.y; heads[row * 3 + 2] = _v.z; }
      row++;
    }
    void fps;
  }
  const tex = new THREE.DataTexture(data, nb * 4, rows, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  // gộp các mảnh lưới theo vật liệu (thân, đầu, tóc) để mỗi vật liệu một lệnh vẽ
  const byMat = new Map();
  for (const sm of H.meshes) { const k = sm.material.name || sm.material.uuid; let e = byMat.get(k); if (!e) byMat.set(k, (e = { material: sm.material, parts: [] })); e.parts.push(sm.geometry); }
  const groups = [];
  for (const e of byMat.values()) {
    let nv = 0, ni = 0; for (const g of e.parts) { nv += g.attributes.position.count; ni += g.index.count; }
    const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), si = new Uint8Array(nv * 4), sw = new Float32Array(nv * 4), idx = new Uint16Array(ni); let vo = 0, io = 0;
    for (const g of e.parts) {
      const a = g.attributes, n = a.position.count;
      for (let i = 0; i < n; i++) {
        pos[(vo + i) * 3] = a.position.getX(i); pos[(vo + i) * 3 + 1] = a.position.getY(i); pos[(vo + i) * 3 + 2] = a.position.getZ(i);
        nrm[(vo + i) * 3] = a.normal.getX(i); nrm[(vo + i) * 3 + 1] = a.normal.getY(i); nrm[(vo + i) * 3 + 2] = a.normal.getZ(i);
        uv[(vo + i) * 2] = a.uv.getX(i); uv[(vo + i) * 2 + 1] = a.uv.getY(i);
        for (let k = 0; k < 4; k++) { si[(vo + i) * 4 + k] = a.skinIndex.getComponent(i, k); sw[(vo + i) * 4 + k] = a.skinWeight.getComponent(i, k); }
      }
      for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo;
      vo += n; io += g.index.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('aSkinI', new THREE.BufferAttribute(si, 4)); geo.setAttribute('aSkinW', new THREE.BufferAttribute(sw, 4)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 1e5);
    groups.push({ geo, map: e.material.map, name: e.material.name });
  }
  return { tex, ranges, bones: nb, rows, heads, groups };
}

// Vật liệu Lambert có skinning từ texture hoạt hình, theo từng instance (aAnim.x = hàng khung hình).
export const SKIN_PARS = /* glsl */`
  attribute vec4 aSkinI; attribute vec4 aSkinW; attribute vec4 aAnim; uniform highp sampler2D uAnimTex;
  mat4 hnBone(float b, float f) { int x = int(b + 0.5) * 4, y = int(f + 0.5); return mat4(texelFetch(uAnimTex, ivec2(x, y), 0), texelFetch(uAnimTex, ivec2(x + 1, y), 0), texelFetch(uAnimTex, ivec2(x + 2, y), 0), texelFetch(uAnimTex, ivec2(x + 3, y), 0)); }
  mat4 hnSkin() { float f = aAnim.x; return aSkinW.x * hnBone(aSkinI.x, f) + aSkinW.y * hnBone(aSkinI.y, f) + aSkinW.z * hnBone(aSkinI.z, f) + aSkinW.w * hnBone(aSkinI.w, f); }`;
