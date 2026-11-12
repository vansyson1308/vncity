// Tiện ích cho mô hình người: nướng một tư thế thành lưới tĩnh (người lái xe trong dòng xe)
// và nướng hoạt hình thành texture ma trận xương (đám đông người đi bộ vẽ bằng instancing, skinning trên GPU).
import * as THREE from 'three';

const _v = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1), _x = new THREE.Vector3(1, 0, 0), _y = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion();
const AXIS = { x: _x, y: _y, z: _z };
// Vùng cơ thể của một đỉnh theo xương chi phối nó: 1 thân, 2 cánh tay, 3 bàn tay, 4 đùi, 5 ống chân, 6 bàn chân, 7 đầu cổ.
export const REG = { torso: 1, arm: 2, hand: 3, thigh: 4, calf: 5, foot: 6, head: 7 };
const boneRegion = (n) => (/UpperArm|Forearm/.test(n) ? 2 : /Hand|Finger/.test(n) ? 3 : /Thigh/.test(n) ? 4 : /Calf/.test(n) ? 5 : /Foot|Toe/.test(n) ? 6 : /Head|Neck|Eye|Mouth|Lip|Jaw|Tongue|Cheek|Nose|[Bb]row|Masseter|Caninus/.test(n) ? 7 : 1);
function vertexRegion(m, i) { const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight; let b = 0, w = -1; for (let k = 0; k < 4; k++) { const ww = sw.getComponent(i, k); if (ww > w) { w = ww; b = si.getComponent(i, k); } } return boneRegion(m.skeleton.bones[b].name); }
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
  if (extra) for (const [name, ang, ax] of extra) { const b = H.bones[name]; if (b) b.quaternion.multiply(_q.setFromAxisAngle(AXIS[ax] || _z, ang)); }
  H.root.updateMatrixWorld(true);
  for (const m of H.meshes) m.skeleton.update();
}

// Nướng mô hình ở một tư thế thành mảng đỉnh có màu (lấy từ ảnh da/quần áo). Áo tối màu được đánh dấu mặt nạ 0,5
// và tô xám sáng để mỗi người lái nhuộm một màu áo riêng. opt.sleeves: da cánh tay mang mặt nạ 0,35 (dòng xe tô thành tay áo dài
// cho người mặc áo khoác); opt.shirtMask: mặt nạ khác cho áo (khách ngồi xích lô nhuộm theo màu khác người đạp).
export function bakePose(gltf, clip, time, extraPose, opt = {}) {
  const H = prepare(gltf); applyPose(H, gltf, clip, time, extraPose);
  const pos = [], col = [], idx = []; let head = [0, 1.65, 0];
  if (H.bones.Bip01_Head) { H.bones.Bip01_Head.getWorldPosition(_v); head = [_v.x, _v.y, _v.z]; }
  for (const m of H.meshes) {
    const geo = m.geometry, P = geo.attributes.position, UV = geo.attributes.uv, tex = texPixels(m.material.map), base = pos.length / 3, body = m.material.name === 'body';
    for (let i = 0; i < P.count; i++) {
      const restY = P.getY(i);
      m.getVertexPosition(i, _v); _v.applyMatrix4(m.matrixWorld);
      if (opt.sleeves && m.material.name === 'head' && UV && mouthUV(UV.getX(i), UV.getY(i))) _v.set(head[0], head[1] + 0.06, head[2] + 0.03); // lưỡi, răng: giấu vào trong đầu
      pos.push(_v.x, _v.y, _v.z);
      let r = 0.6, g = 0.5, b = 0.45;
      if (tex && UV) { const x = Math.min(tex.w - 1, Math.max(0, Math.floor(UV.getX(i) * tex.w))), y = Math.min(tex.h - 1, Math.max(0, Math.floor(UV.getY(i) * tex.h))), o = (y * tex.w + x) * 4; r = s2l(tex.d[o] / 255); g = s2l(tex.d[o + 1] / 255); b = s2l(tex.d[o + 2] / 255); }
      const lum = 0.3 * r + 0.59 * g + 0.11 * b, sat = Math.max(r, g, b) - Math.min(r, g, b);
      void restY;
      if (opt.sleeves) { // phân vùng theo xương: áo là phần vải tối trên thân và tay, da tay là phần còn lại của cánh tay
        const reg = body ? vertexRegion(m, i) : 0;
        if ((reg === 1 || reg === 2) && lum < 0.09 && sat < 0.045) col.push(0.75, 0.75, 0.75, opt.shirtMask || 0.5);
        else if (reg === 2 && !opt.bare) col.push(r, g, b, 0.35); else col.push(r, g, b, 0);
      } else if (body && lum < 0.06 && sat < 0.03 && _v.y > head[1] - 0.72) col.push(0.75, 0.75, 0.75, 0.5); else col.push(r, g, b, 0);
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
// clips: mỗi phần tử là [tên đoạn, số khung] (đoạn có sẵn trong tệp mô hình) hoặc một tư thế / đoạn tự dựng:
//   { name, frames, clip: đoạn nền (mặc định 'idle'), from: gltf khác chứa đoạn nền (cùng bộ xương), pose: (f, n) => [[xương, góc, trục]...]
//     xoay thêm ở khung f, hold: [xương...] đưa về tư thế đứng yên trước khi xoay (tay không vung theo bước), lift: số hoặc (f, n) => số
//     nâng/hạ cả người (ngồi ghế thấp thì hạ hông xuống) }.
// opt.merge: gộp mọi mảnh thành MỘT lưới màu đỉnh (màu lấy từ ảnh tại từng đỉnh) cho mức chi tiết xa: một lệnh vẽ.
// Mỗi đỉnh mang mã vùng aReg: 0 khác, 1 thân, 2 cánh tay, 3 bàn tay, 5 đùi, 6 ống chân, 7 bàn chân, 8 tóc, 9 da mặt cổ, 10 tóc đuôi gà
// (mã liền nhau cho các vùng kề nhau để chỗ nội suy giữa hai vùng không nhảy sang vùng lạ).
// vùng ảnh của khoang miệng (lưỡi, răng) trên ảnh đầu: góc trên trái
const mouthUV = (u, v) => u < 0.195 && v < 0.42;
const ANCHORS = ['Bip01_Head', 'Bip01_Neck', 'Bip01_Spine2', 'Bip01_Pelvis', 'Bip01_R_Hand', 'Bip01_L_Hand'];
export function bakeAnimation(gltf, clips, opt = {}) {
  const H = prepare(gltf), mesh0 = H.meshes[0], nb = mesh0.skeleton.bones.length;
  applyPose(H, gltf, 'idle', 0); const idleQ = {}; for (const n in H.bones) idleQ[n] = H.bones[n].quaternion.clone();
  const specs = clips.map((c) => (Array.isArray(c) ? { name: c[0], frames: c[1], clip: c[0] } : c));
  const ranges = {}; let rows = 0;
  for (const c of specs) { ranges[c.name] = [rows, c.frames]; rows += c.frames; }
  const data = new Float32Array(rows * nb * 16), heads = new Float32Array(rows * 3), m = new THREE.Matrix4(), bm = new THREE.Matrix4();
  const anchors = {}; for (const n of ANCHORS) anchors[n] = new Float32Array(rows * 3);
  let row = 0;
  for (const c of specs) {
    const src = c.from || gltf, base = c.clip || 'idle', clip = src.animations.find((a) => a.name === base), dur = clip ? clip.duration : 1;
    for (let f = 0; f < c.frames; f++) {
      applyPose(H, src, base, c.frames > 1 && clip && base !== 'idle' ? (f / c.frames) * dur : 0);
      if (c.hold || c.pose) {
        if (c.hold) for (const n of c.hold) if (H.bones[n]) H.bones[n].quaternion.copy(idleQ[n]);
        if (c.pose) for (const [name, ang, ax] of c.pose(f, c.frames)) { const b = H.bones[name]; if (b) b.quaternion.multiply(_q.setFromAxisAngle(AXIS[ax] || _z, ang)); }
        H.root.updateMatrixWorld(true); for (const sm of H.meshes) sm.skeleton.update();
      }
      const lift = typeof c.lift === 'function' ? c.lift(f, c.frames) : c.lift || 0, sk = mesh0.skeleton;
      for (let b = 0; b < nb; b++) {
        bm.fromArray(sk.boneMatrices, b * 16);
        m.copy(mesh0.matrixWorld).multiply(mesh0.bindMatrixInverse).multiply(bm).multiply(mesh0.bindMatrix);
        m.elements[13] += lift;
        m.toArray(data, (row * nb + b) * 16);
      }
      for (const n of ANCHORS) if (H.bones[n]) { H.bones[n].getWorldPosition(_v); anchors[n][row * 3] = _v.x; anchors[n][row * 3 + 1] = _v.y + lift; anchors[n][row * 3 + 2] = _v.z; }
      heads[row * 3] = anchors.Bip01_Head[row * 3]; heads[row * 3 + 1] = anchors.Bip01_Head[row * 3 + 1]; heads[row * 3 + 2] = anchors.Bip01_Head[row * 3 + 2];
      row++;
    }
  }
  const tex = new THREE.DataTexture(data, nb * 4, rows, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  const boneIndex = {}; mesh0.skeleton.bones.forEach((b, i) => { boneIndex[b.name] = i; });
  // gộp các mảnh lưới theo vật liệu (thân, đầu, tóc) để mỗi vật liệu một lệnh vẽ; opt.merge: gộp tất cả làm một
  const byMat = new Map();
  for (const sm of H.meshes) { const k = opt.merge ? 'all' : sm.material.name || sm.material.uuid; let e = byMat.get(k); if (!e) byMat.set(k, (e = { material: sm.material, parts: [] })); e.parts.push(sm); }
  const groups = [];
  for (const e of byMat.values()) {
    let nv = 0, ni = 0; for (const sm of e.parts) { nv += sm.geometry.attributes.position.count; ni += sm.geometry.index.count; }
    const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), si = new Uint8Array(nv * 4), sw = new Float32Array(nv * 4), reg = new Float32Array(nv), col = opt.merge ? new Float32Array(nv * 3) : null, idx = new Uint16Array(ni); let vo = 0, io = 0;
    const hide = [], hc = [0, 0, 0, 0]; // đỉnh trong khoang miệng (lưỡi, răng) và tâm khối mặt để giấu chúng vào
    for (const sm of e.parts) {
      const g = sm.geometry, a = g.attributes, n = a.position.count, kind = sm.material.name, tex2 = texPixels(sm.material.map);
      for (let i = 0; i < n; i++) {
        pos[(vo + i) * 3] = a.position.getX(i); pos[(vo + i) * 3 + 1] = a.position.getY(i); pos[(vo + i) * 3 + 2] = a.position.getZ(i);
        nrm[(vo + i) * 3] = a.normal.getX(i); nrm[(vo + i) * 3 + 1] = a.normal.getY(i); nrm[(vo + i) * 3 + 2] = a.normal.getZ(i);
        uv[(vo + i) * 2] = a.uv.getX(i); uv[(vo + i) * 2 + 1] = a.uv.getY(i);
        for (let k = 0; k < 4; k++) { si[(vo + i) * 4 + k] = a.skinIndex.getComponent(i, k); sw[(vo + i) * 4 + k] = a.skinWeight.getComponent(i, k); }
        // màu tại đỉnh và mã vùng
        let r = 0.6, gg = 0.5, b = 0.45;
        if (tex2) { const x = Math.min(tex2.w - 1, Math.max(0, Math.floor(a.uv.getX(i) * tex2.w))), y = Math.min(tex2.h - 1, Math.max(0, Math.floor(a.uv.getY(i) * tex2.h))), o = (y * tex2.w + x) * 4; r = s2l(tex2.d[o] / 255); gg = s2l(tex2.d[o + 1] / 255); b = s2l(tex2.d[o + 2] / 255); }
        const lum = 0.3 * r + 0.59 * gg + 0.11 * b, sat = Math.max(r, gg, b) - Math.min(r, gg, b), skin = r > b * 1.25 && sat > 0.05 && lum > 0.08, dark = lum < 0.09 && sat < 0.05;
        let code = 0;
        if (kind === 'hair') code = 10; else if (kind === 'head') code = lum < 0.07 ? 8 : 9;
        else { const br = vertexRegion(sm, i); code = br === 1 ? 1 : br === 2 ? 2 : br === 3 ? 3 : br === 4 ? 5 : br === 5 ? 6 : br === 6 ? 7 : 0; }
        if (opt.merge) { // mức xa: quyết định ngay loại vải ở từng đỉnh
          if (code === 1) code = dark ? 1 : skin ? 9 : 5; // thân: áo tối màu, da cổ, hoặc cạp quần
          else if (code === 2) code = dark ? 1 : 2; else if (code === 7) code = 0;
          col[(vo + i) * 3] = r; col[(vo + i) * 3 + 1] = gg; col[(vo + i) * 3 + 2] = b;
        }
        reg[vo + i] = code;
        if (kind === 'head') { if (mouthUV(a.uv.getX(i), a.uv.getY(i))) hide.push(vo + i); else if (a.skinWeight.getX(i) > 0.9 && code === 9) { hc[0] += pos[(vo + i) * 3]; hc[1] += pos[(vo + i) * 3 + 1]; hc[2] += pos[(vo + i) * 3 + 2]; hc[3]++; } }
      }
      for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo;
      vo += n; io += g.index.count;
    }
    // bản rút gọn làm môi hở, lưỡi và răng thò ra ngoài: thu các đỉnh trong khoang miệng về giữa khối mặt cho khuất
    if (hc[3]) for (const i of hide) { pos[i * 3] = hc[0] / hc[3]; pos[i * 3 + 1] = hc[1] / hc[3]; pos[i * 3 + 2] = hc[2] / hc[3]; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('aSkinI', new THREE.BufferAttribute(si, 4)); geo.setAttribute('aSkinW', new THREE.BufferAttribute(sw, 4)); geo.setAttribute('aReg', new THREE.BufferAttribute(reg, 1)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
    if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 1e5);
    groups.push({ geo, map: e.material.map, name: opt.merge ? 'all' : e.material.name });
  }
  return { tex, ranges, bones: nb, rows, heads, groups, data, boneIndex, anchors };
}

// Gắn cứng một đồ vật dựng bằng G (toạ độ theo mô hình người ở hàng tư thế refRow) vào một xương: trả về vị trí, pháp tuyến đã đưa
// về không gian gốc của xương đó, để shader skinning (một xương, trọng số 1) kéo đồ vật đi theo xương ở mọi khung hình.
export function attachToBone(bake, g, bone, refRow) {
  const bi = bake.boneIndex[bone] ?? 0, M = new THREE.Matrix4().fromArray(bake.data, (refRow * bake.bones + bi) * 16), inv = M.clone().invert(), n3 = new THREE.Matrix3().setFromMatrix4(inv);
  const n = g.pos.length / 3, pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.set(g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2]).applyMatrix4(inv); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    v.set(g.nrm[i * 3], g.nrm[i * 3 + 1], g.nrm[i * 3 + 2]).applyMatrix3(n3).normalize(); nrm[i * 3] = v.x; nrm[i * 3 + 1] = v.y; nrm[i * 3 + 2] = v.z;
  }
  return { pos, nrm, bone: bi };
}

// Vật liệu Lambert có skinning từ texture hoạt hình, theo từng instance (aAnim.x = hàng khung hình).
export const SKIN_PARS = /* glsl */`
  attribute vec4 aSkinI; attribute vec4 aSkinW; attribute vec4 aAnim; uniform highp sampler2D uAnimTex;
  mat4 hnBone(float b, float f) { int x = int(b + 0.5) * 4, y = int(f + 0.5); return mat4(texelFetch(uAnimTex, ivec2(x, y), 0), texelFetch(uAnimTex, ivec2(x + 1, y), 0), texelFetch(uAnimTex, ivec2(x + 2, y), 0), texelFetch(uAnimTex, ivec2(x + 3, y), 0)); }
  mat4 hnSkin() { float f = aAnim.x; return aSkinW.x * hnBone(aSkinI.x, f) + aSkinW.y * hnBone(aSkinI.y, f) + aSkinW.z * hnBone(aSkinI.z, f) + aSkinW.w * hnBone(aSkinI.w, f); }`;
