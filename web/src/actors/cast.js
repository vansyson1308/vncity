// Dàn người của phố Hà Nội: lưới, vật liệu và hoạt hình cho đám đông, vẽ bằng instancing với skinning trên GPU.
// Cả dự án chỉ có MỘT mô hình người, nên sự đa dạng đến từ: màu áo, màu quần, tay áo dài/cộc, quần đùi (shader tô theo vùng cơ thể),
// màu tóc và da, chiều cao, tư thế (đi, đứng, ngồi ghế đẩu, tập dưỡng sinh, chạy bộ, gánh hàng) và đồ đội, đồ mang (nón lá, quang gánh,
// ba lô, mũ lưỡi trai, khăn quàng đỏ, túi xách, ghế nhựa) gắn cứng vào xương. Số lệnh vẽ: 3 cho người ở gần (thân, đầu, tóc),
// 1 cho người ở xa (lưới rút gọn tô màu đỉnh), 1 cho đồ đội, đồ mang nhẹ và 1 cho quang gánh (bộ phận bật tắt theo bit như ở dòng xe).
import * as THREE from 'three';
import { G } from '../core/geo.js';
import { nonLa, quangGanh, ganhLoad, plasticStool, backpack } from '../models/life.js';
import { bakeAnimation, attachToBone, SKIN_PARS } from './humans.js';
import { skyU } from '../engine/sky.js';

export const WALK_FRAMES = 24, TAICHI_FRAMES = 24, SWING_FRAMES = 12, JOG_FRAMES = 16;
// bit kiểu áo quần (aLook.w) và bit đồ mang (aLook2.w)
export const STYLE = { sleeve: 1, shorts: 2, noTail: 4, tone: 8 }; // tone: 0 tóc đen, 1 nâu (da sáng), 2 vàng, 3 bạc → nhân 8
export const PROP = { nonla: 1, ganh: 2, fruit: 4, flowers: 8, backpack: 16, stool: 32, cap: 64, scarf: 128, pot: 256, bag: 512 };
const PID = { nonla: 1, ganh: 2, fruit: 3, flowers: 4, backpack: 5, stool: 6, cap: 7, scarf: 8, pot: 9, bag: 10 };

const both = (name, a, ax) => [[`Bip01_L_${name}`, a, ax], [`Bip01_R_${name}`, a, ax]];
const SIT = [...both('Thigh', 1.95), ...both('Calf', -1.95), ['Bip01_Spine', 0.3], ...both('UpperArm', -0.6), ...both('Forearm', -0.9)];
const SIT2 = [...both('Thigh', 1.9), ...both('Calf', -1.9), ['Bip01_Spine', 0.14], ['Bip01_L_UpperArm', -0.55], ['Bip01_L_Forearm', -0.95], ['Bip01_R_UpperArm', -0.85], ['Bip01_R_Forearm', -1.75]];
// Dưỡng sinh, thái cực quyền: hai tay từ từ nâng ra trước tới ngang vai rồi hạ xuống, gối hơi khuỵu theo nhịp (một vòng 8 giây).
const taichi = (f, n) => { const t = (f / n) * Math.PI * 2, up = 0.5 - 0.5 * Math.cos(t), k = 0.35 + 0.65 * up;
  return [['Bip01_L_UpperArm', -0.2 - 1.25 * up], ['Bip01_R_UpperArm', -0.2 - 1.25 * up], ['Bip01_L_UpperArm', -0.3 * Math.sin(t), 'y'], ['Bip01_R_UpperArm', 0.3 * Math.sin(t), 'y'], ...both('Forearm', -0.3 - 0.35 * (1 - up)), ...both('Thigh', 0.26 * k), ...both('Calf', -0.52 * k), ['Bip01_Spine', 0.04]]; };
// Vẩy tay: hai tay đánh đều ra trước ra sau, nhún nhẹ (một vòng 1,6 giây).
const swing = (f, n) => { const t = (f / n) * Math.PI * 2, a = Math.sin(t);
  return [...both('UpperArm', -0.3 - 0.75 * a), ...both('Forearm', -0.12), ...both('Thigh', 0.08 + 0.05 * Math.cos(t * 2)), ...both('Calf', -0.16 - 0.1 * Math.cos(t * 2))]; };
const CARRY = [['Bip01_R_UpperArm', -1.2], ['Bip01_R_Forearm', -1.75]];

function clipSpecs(self, walkFrom, full) {
  const src = (g) => (g === self ? undefined : g);
  return [
    { name: 'walk', frames: WALK_FRAMES, clip: 'walk', from: src(walkFrom) }, { name: 'idle', frames: 1 },
    { name: 'sit', frames: 1, pose: () => SIT, lift: -0.555 }, { name: 'sit2', frames: 1, pose: () => SIT2, lift: -0.555 },
    { name: 'taichi', frames: TAICHI_FRAMES, pose: taichi, lift: (f, n) => -0.035 * (0.35 + 0.65 * (0.5 - 0.5 * Math.cos((f / n) * Math.PI * 2))) },
    { name: 'swing', frames: SWING_FRAMES, pose: swing, lift: -0.008 },
    { name: 'jog', frames: JOG_FRAMES, clip: 'jog', from: full },
    { name: 'carry', frames: WALK_FRAMES, clip: 'walk', from: src(walkFrom), hold: ['Bip01_R_UpperArm', 'Bip01_R_Forearm', 'Bip01_R_Hand'], pose: () => CARRY },
  ];
}

// GLSL dùng chung: bit kiểu áo, màu tóc, màu da theo aLook.w
const LOOK_GLSL = /* glsl */`
  float hnBit(float v, float b) { return mod(floor((v + 0.5) / b), 2.0); } // +0,5: giá trị nội suy qua tam giác có thể lệch một chút khỏi số nguyên
  float hnTone(float v) { return mod(floor((v + 0.5) / 8.0), 4.0); }
  vec3 hnHair(vec3 c, float tone) { return tone < 0.5 ? c : tone < 1.5 ? c * vec3(3.4, 2.2, 1.3) + vec3(0.012, 0.007, 0.003) : tone < 2.5 ? c * vec3(8.5, 6.2, 3.0) + vec3(0.07, 0.05, 0.02) : vec3(dot(c, vec3(3.0))) + 0.3; }
  vec3 hnSkinTone(float tone) { return tone > 0.5 && tone < 2.5 ? vec3(1.14, 1.07, 1.03) : vec3(1.0); }`;
const SKIN_COL = 'vec3(0.56, 0.33, 0.23)';

export class Cast {
  // caps: { near, far, kit } số người tối đa ở gần, ở xa và số người có đồ mang
  constructor(scene, lod, far, full, quality, caps) {
    const walkLen = (g) => { const c = g.animations.find((a) => a.name === 'walk'); return c ? c.duration : 1.2; }, jog = full.animations.find((a) => a.name === 'jog');
    this.stride = 1.01 * walkLen(lod); this.jogStride = 2.4 * (jog ? jog.duration : 0.77);
    const bn = bakeAnimation(lod, clipSpecs(lod, lod, full)), bf = bakeAnimation(far, clipSpecs(far, lod, full), { merge: true });
    this.bake = bn; this.rows = bn.ranges; this.heads = bn.heads; this.caps = caps; this.shadow = quality.shadow > 0;
    const mk = (n) => ({ n: 0, cap: n, anim: this.inst(n, 4), look: this.inst(n, 4), mat: null, meshes: [] });
    this.near = mk(caps.near); this.far = mk(caps.far); this.kit = mk(caps.kit); this.kit.look2 = this.inst(caps.kit, 4);
    this.pole = mk(Math.ceil(caps.kit / 4) + 2); this.pole.look2 = this.inst(this.pole.cap, 4); // quang gánh: lưới riêng vì nặng mà ít người mang
    // ----- người ở gần: ba lưới theo vật liệu, ảnh da và quần áo gốc, shader tô lại áo, tay áo, quần theo từng người -----
    for (const g of bn.groups) this.add(scene, this.near, g.geo, this.nearMaterial(g, bn.tex), this.depthMaterial(bn.tex, g.name === 'hair'), true);
    // ----- người ở xa: một lưới 630 tam giác tô màu đỉnh -----
    for (const g of bf.groups) this.add(scene, this.far, g.geo, this.farMaterial(bf.tex), this.depthMaterial(bf.tex, false), quality.name === 'high'); // người ở xa chỉ đổ bóng ở mức Đẹp
    // ----- đồ đội, đồ mang -----
    const kitMat = this.kitMaterial(bn.tex), kitDepth = this.kitDepth(bn.tex);
    this.add(scene, this.kit, this.kitGeometry(bn, false), kitMat, kitDepth, true, true); this.add(scene, this.pole, this.kitGeometry(bn, true), kitMat, kitDepth, true, true);
    this.tris = { near: bn.groups.reduce((s, g) => s + g.geo.index.count / 3, 0), far: bf.groups[0].geo.index.count / 3, kit: this.kit.meshes[0].geometry.index.count / 3, pole: this.pole.meshes[0].geometry.index.count / 3 };
  }
  inst(n, size) { const a = new THREE.InstancedBufferAttribute(new Float32Array(n * size), size); a.setUsage(THREE.DynamicDrawUsage); return a; }
  add(scene, set, geo, mat, depth, shadow, kit = false) {
    geo.setAttribute('aAnim', set.anim); if (kit) geo.setAttribute('aLook2', set.look2); else geo.setAttribute('aLook', set.look);
    const m = new THREE.InstancedMesh(geo, mat, set.cap); m.count = 0; m.frustumCulled = false; m.castShadow = this.shadow && shadow; m.customDepthMaterial = depth;
    if (set.meshes.length) m.instanceMatrix = set.meshes[0].instanceMatrix; else m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m); set.meshes.push(m); set.mat = set.meshes[0].instanceMatrix;
  }

  nearMaterial(g, tex) {
    const kind = g.name, mat = new THREE.MeshLambertMaterial({ map: g.map, alphaTest: kind === 'hair' ? 0.4 : 0 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uAnimTex: { value: tex }, uLit: skyU.uLit });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${SKIN_PARS}\n${LOOK_GLSL}\nattribute float aReg; attribute vec4 aLook; varying vec3 vTint; varying float vReg; varying vec4 vLook;`)
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nmat4 hm = hnSkin(); objectNormal = mat3(hm) * objectNormal;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed = (hm * vec4(transformed, 1.0)).xyz; vTint = aAnim.yzw; vReg = aReg; vLook = aLook;${kind === 'hair' ? '\nif (hnBit(aLook.w, 4.0) > 0.5) transformed = vec3(0.0);' : ''}`);
      const paint = kind === 'body' ? `
        { vec3 c = diffuseColor.rgb; float lum = dot(c, vec3(0.3, 0.59, 0.11)), sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)), reg = floor(vReg + 0.5);
          float dark = (1.0 - smoothstep(0.05, 0.1, lum)) * (1.0 - smoothstep(0.03, 0.06, sat)), tone = hnTone(vLook.w);
          if (reg > 0.5 && reg < 1.5) c = mix(vLook.r >= 0.0 && c.b > c.r * 1.08 && lum > 0.06 ? vLook.rgb * (0.45 + lum * 3.4) : c, vTint * (0.3 + lum * 9.0), dark); // áo trên thân (cạp quần theo màu quần)
          else if (reg < 2.5 && reg > 1.5) c = mix(hnBit(vLook.w, 1.0) > 0.5 ? vTint * (0.4 + lum * 0.5) : c * hnSkinTone(tone), vTint * (0.3 + lum * 9.0), dark); // tay áo cộc, tay áo dài hoặc da tay
          else if (reg > 2.5 && reg < 3.5) c *= hnSkinTone(tone);                                                           // bàn tay
          else if (reg > 4.5 && reg < 6.5) {
            if (reg > 5.5 && hnBit(vLook.w, 2.0) > 0.5) c = ${SKIN_COL} * (0.85 + lum * 1.2) * hnSkinTone(tone);              // quần đùi: ống chân để trần
            else if (vLook.r >= 0.0) c = vLook.rgb * (0.45 + lum * 3.4); }                                                    // quần màu khác (âm: giữ quần bò)
          diffuseColor.rgb = c; }` : kind === 'head' ? `
        { vec3 c = diffuseColor.rgb; float lum = dot(c, vec3(0.3, 0.59, 0.11)), tone = hnTone(vLook.w);
          diffuseColor.rgb = mix(c * hnSkinTone(tone), hnHair(c, tone), 1.0 - smoothstep(0.035, 0.09, lum)); }` : `
        diffuseColor.rgb = hnHair(diffuseColor.rgb, hnTone(vLook.w));`;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${LOOK_GLSL}\nvarying vec3 vTint; varying float vReg; varying vec4 vLook;`)
        .replace('#include <map_fragment>', `#include <map_fragment>\n${paint}`);
    };
    mat.customProgramCacheKey = () => 'hn-cast-' + kind;
    return mat;
  }
  farMaterial(tex) {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uAnimTex: { value: tex } });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${SKIN_PARS}\n${LOOK_GLSL}\nattribute float aReg; attribute vec4 aLook;`)
        .replace('#include <color_vertex>', `#include <color_vertex>
          { vec3 c = color; float lum = dot(c, vec3(0.3, 0.59, 0.11)), reg = aReg, tone = hnTone(aLook.w);
            if (reg < 0.5) {} else if (reg < 1.5) c = aAnim.yzw * (0.3 + lum * 9.0);
            else if (reg < 2.5) c = hnBit(aLook.w, 1.0) > 0.5 ? aAnim.yzw * (0.4 + lum * 0.5) : c * hnSkinTone(tone);
            else if (reg < 3.5) c *= hnSkinTone(tone);
            else if (reg < 6.5) { if (reg > 5.5 && hnBit(aLook.w, 2.0) > 0.5) c = ${SKIN_COL} * (0.85 + lum * 1.2) * hnSkinTone(tone); else if (aLook.r >= 0.0) c = aLook.rgb * (0.45 + lum * 3.4); }
            else if (reg < 7.5) {} else if (reg < 8.5 || reg > 9.5) c = hnHair(c, tone); else c *= hnSkinTone(tone);
            vColor.rgb = c; }`)
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nmat4 hm = hnSkin(); objectNormal = mat3(hm) * objectNormal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = (hm * vec4(transformed, 1.0)).xyz; if (aReg > 9.5 && hnBit(aLook.w, 4.0) > 0.5) transformed = vec3(0.0);');
    };
    mat.customProgramCacheKey = () => 'hn-cast-far';
    return mat;
  }
  depthMaterial(tex, hair) {
    const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    d.onBeforeCompile = (sh) => {
      sh.uniforms.uAnimTex = { value: tex };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${SKIN_PARS}${hair ? '\nattribute vec4 aLook;' : ''}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed = (hnSkin() * vec4(transformed, 1.0)).xyz;${hair ? '\nif (mod(floor(aLook.w / 4.0), 2.0) > 0.5) transformed = vec3(0.0);' : ''}`);
    };
    d.customProgramCacheKey = () => 'hn-cast-depth' + (hair ? '-hair' : '');
    return d;
  }

  // Bộ đồ đội, đồ mang: mỗi món dựng theo tư thế đứng yên (ghế nhựa theo tư thế ngồi) rồi gắn vào một xương.
  kitGeometry(bake, pole) {
    const idle = bake.ranges.idle[0], sit = bake.ranges.sit[0], A = (n, r = idle) => [bake.anchors[n][r * 3], bake.anchors[n][r * 3 + 1], bake.anchors[n][r * 3 + 2]];
    const head = A('Bip01_Head'), neck = A('Bip01_Neck'), sp = A('Bip01_Spine2'), hand = A('Bip01_R_Hand'), pel = A('Bip01_Pelvis', sit);
    const parts = [], part = (bone, row, pid, fn) => { if ((pid === PID.ganh || pid === PID.fruit || pid === PID.flowers || pid === PID.pot) !== pole) return; const g = new G(); g.mat(pid); fn(g); parts.push({ g, at: attachToBone(bake, g, bone, row) }); };
    const TINT = 1; // mặt nạ: nhân với màu đồ mang của từng người (aLook2.rgb)
    part('Bip01_Head', idle, PID.nonla, (g) => nonLa(g, head[0], head[1] + 0.115, head[2] + 0.012, 0.275, 0.17, 10));
    part('Bip01_Head', idle, PID.cap, (g) => { g.rgb(0.85, 0.85, 0.85, TINT).lathe(head[0], head[1] + 0.13, head[2] + 0.008, [[0.114, -0.012], [0.112, 0.035], [0.078, 0.078], [0, 0.092]], 8);
      g.shade(0.8).quad([head[0] - 0.08, head[1] + 0.126, head[2] + 0.09], [head[0] + 0.08, head[1] + 0.126, head[2] + 0.09], [head[0] + 0.055, head[1] + 0.112, head[2] + 0.2], [head[0] - 0.055, head[1] + 0.112, head[2] + 0.2])
        .quad([head[0] + 0.08, head[1] + 0.122, head[2] + 0.09], [head[0] - 0.08, head[1] + 0.122, head[2] + 0.09], [head[0] - 0.055, head[1] + 0.108, head[2] + 0.2], [head[0] + 0.055, head[1] + 0.108, head[2] + 0.2]); });
    // quang gánh trên vai phải: đòn chạy dọc trước sau, hai thúng ngang gối
    const onShoulder = (g, fn) => { g.push().move(sp[0] - 0.15, 0, sp[2] + 0.02).rotY(-Math.PI / 2); fn(g, neck[1] - 0.025); g.pop(); };
    part('Bip01_Spine2', idle, PID.ganh, (g) => onShoulder(g, (q, y) => quangGanh(q, y)));
    part('Bip01_Spine2', idle, PID.fruit, (g) => onShoulder(g, (q, y) => ganhLoad(q, y, 0, 'fruit', 3)));
    part('Bip01_Spine2', idle, PID.flowers, (g) => onShoulder(g, (q, y) => ganhLoad(q, y, 0, 'flowers', 5)));
    part('Bip01_Spine2', idle, PID.pot, (g) => onShoulder(g, (q, y) => ganhLoad(q, y, 0, 'pot', 1)));
    part('Bip01_Spine2', idle, PID.backpack, (g) => { g.rgb(0.8, 0.8, 0.8, TINT); backpack(g, sp[0], sp[1] - 0.27, sp[2] - 0.115, 0.3, 0.46, 0.17);
      g.rgb(0.05, 0.05, 0.055); for (const s of [-1, 1]) g.box(sp[0] + s * 0.13 - 0.025, sp[1] - 0.2, sp[2] - 0.12, sp[0] + s * 0.13 + 0.025, sp[1] + 0.2, sp[2] + 0.125, 'xXYZ'); }); // hai quai đeo vắt qua vai
    part('Bip01_Neck', idle, PID.scarf, (g) => { g.rgb(0.7, 0.03, 0.03).lathe(neck[0], neck[1] - 0.012, neck[2] + 0.012, [[0.082, 0], [0.07, 0.045]], 7);
      g.tri3([neck[0] - 0.085, neck[1] - 0.005, neck[2] + 0.075], [neck[0], neck[1] - 0.21, neck[2] + 0.13], [neck[0] + 0.085, neck[1] - 0.005, neck[2] + 0.075]); });
    part('Bip01_R_Hand', idle, PID.bag, (g) => { g.rgb(0.85, 0.85, 0.85, TINT).box(hand[0] - 0.05, hand[1] - 0.44, hand[2] - 0.11, hand[0] + 0.05, hand[1] - 0.17, hand[2] + 0.11);
      g.shade(0.7).box(hand[0] - 0.012, hand[1] - 0.17, hand[2] - 0.05, hand[0] + 0.012, hand[1] - 0.06, hand[2] + 0.05, 'xXzZ'); });
    part('Bip01_Pelvis', sit, PID.stool, (g) => { g.rgb(0.9, 0.9, 0.9, TINT).gloss(0.3); plasticStool(g, pel[0], pel[2] - 0.03, 0.25); });
    let nv = 0, ni = 0; for (const p of parts) { nv += p.g.count; ni += p.g.idx.length; }
    const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), col = new Float32Array(nv * 3), pm = new Float32Array(nv * 2), si = new Uint8Array(nv * 4), sw = new Float32Array(nv * 4), idx = new Uint16Array(ni); let vo = 0, io = 0;
    for (const p of parts) {
      const g = p.g, n = g.count; pos.set(p.at.pos, vo * 3); nrm.set(p.at.nrm, vo * 3);
      for (let i = 0; i < n; i++) { col[(vo + i) * 3] = g.col[i * 4]; col[(vo + i) * 3 + 1] = g.col[i * 4 + 1]; col[(vo + i) * 3 + 2] = g.col[i * 4 + 2]; pm[(vo + i) * 2] = Math.round(g.fx[i * 4 + 3] * 255 / 16); pm[(vo + i) * 2 + 1] = g.col[i * 4 + 3]; si[(vo + i) * 4] = p.at.bone; sw[(vo + i) * 4] = 1; }
      for (let i = 0; i < g.idx.length; i++) idx[io + i] = g.idx[i] + vo;
      vo += n; io += g.idx.length;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aPm', new THREE.BufferAttribute(pm, 2)); geo.setAttribute('aSkinI', new THREE.BufferAttribute(si, 4)); geo.setAttribute('aSkinW', new THREE.BufferAttribute(sw, 4)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 1e5);
    return geo;
  }
  kitMaterial(tex) {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uAnimTex = { value: tex };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${SKIN_PARS}\nattribute vec2 aPm; attribute vec4 aLook2;`)
        .replace('#include <color_vertex>', '#include <color_vertex>\nvColor.rgb = mix(color, color * aLook2.rgb, aPm.y);')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nmat4 hm = hnBone(aSkinI.x, aAnim.x); objectNormal = mat3(hm) * objectNormal;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed = (hm * vec4(transformed, 1.0)).xyz; ${KIT_HIDE}`);
    };
    mat.customProgramCacheKey = () => 'hn-cast-kit';
    return mat;
  }
  kitDepth(tex) {
    const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    d.onBeforeCompile = (sh) => {
      sh.uniforms.uAnimTex = { value: tex };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${SKIN_PARS}\nattribute vec2 aPm; attribute vec4 aLook2;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed = (hnBone(aSkinI.x, aAnim.x) * vec4(transformed, 1.0)).xyz; ${KIT_HIDE}`);
    };
    d.customProgramCacheKey = () => 'hn-cast-kit-depth';
    return d;
  }

  begin() { this.near.n = this.far.n = this.kit.n = this.pole.n = 0; }
  // Đặt một người vào khung hình. p: { x, z, yaw, scale, tint, tint2, style, props, ptint }; y: cao độ chân; row: hàng tư thế; near: vẽ bản đủ chi tiết
  put(p, y, row, near) {
    let set = near ? this.near : this.far; if (set.n >= set.cap) { set = near ? this.far : this.near; if (set.n >= set.cap) return; }
    const i = set.n++, s = p.scale, c = Math.cos(p.yaw) * s, sn = Math.sin(p.yaw) * s;
    this.write(set, i, p, y, row, c, sn, s);
    const L = set.look.array, k = i * 4, t2 = p.tint2;
    if (t2) { L[k] = t2[0]; L[k + 1] = t2[1]; L[k + 2] = t2[2]; } else L[k] = -1;
    L[k + 3] = p.style;
    if (p.props & ~POLE_BITS && this.kit.n < this.kit.cap) this.prop(this.kit, p, y, row, c, sn, s);
    if (p.props & POLE_BITS && this.pole.n < this.pole.cap) this.prop(this.pole, p, y, row, c, sn, s);
  }
  prop(set, p, y, row, c, sn, s) { const j = set.n++, K = set.look2.array, q = j * 4, pt = p.ptint || WHITE; this.write(set, j, p, y, row, c, sn, s); K[q] = pt[0]; K[q + 1] = pt[1]; K[q + 2] = pt[2]; K[q + 3] = p.props; }
  write(set, i, p, y, row, c, sn, s) {
    const M = set.mat.array, o = i * 16, A = set.anim.array, k = i * 4, t = p.tint;
    M[o] = c; M[o + 1] = 0; M[o + 2] = -sn; M[o + 3] = 0; M[o + 4] = 0; M[o + 5] = s; M[o + 6] = 0; M[o + 7] = 0; M[o + 8] = sn; M[o + 9] = 0; M[o + 10] = c; M[o + 11] = 0; M[o + 12] = p.x; M[o + 13] = y; M[o + 14] = p.z; M[o + 15] = 1;
    A[k] = row; A[k + 1] = t[0]; A[k + 2] = t[1]; A[k + 3] = t[2];
  }
  end() {
    for (const set of [this.near, this.far, this.kit, this.pole]) {
      for (const m of set.meshes) { m.count = set.n; m.visible = set.n > 0; }
      if (set.n) { set.mat.needsUpdate = true; set.anim.needsUpdate = true; if (set.look2) set.look2.needsUpdate = true; else set.look.needsUpdate = true; }
    }
  }
}
const WHITE = [1, 1, 1], POLE_BITS = PROP.ganh | PROP.fruit | PROP.flowers | PROP.pot;
const KIT_HIDE = 'if (mod(floor(aLook2.w / exp2(aPm.x - 1.0)), 2.0) < 0.5) transformed = vec3(0.0);';

// Hàng mẫu cho trang soi (dev/life.html?set=people): mỗi kiểu người một dáng, hoạt hình chạy thật.
export function buildCastPreview(scene, lod, far, full, quality, query) {
  const cast = new Cast(scene, lod, far, full, quality, { near: 40, far: 40, kit: 40 }), R = cast.rows;
  const C = { white: [0.85, 0.85, 0.82], navy: [0.03, 0.05, 0.14], brown: [0.2, 0.1, 0.07], red: [0.62, 0.08, 0.08], teal: [0.18, 0.5, 0.55], grey: [0.3, 0.31, 0.33], black: [0.03, 0.03, 0.035], khaki: [0.5, 0.42, 0.28], pink: [0.8, 0.45, 0.55], blue: [0.1, 0.22, 0.5], orange: [0.9, 0.4, 0.05], green: [0.1, 0.45, 0.2], yellow: [0.85, 0.65, 0.1] };
  const farRow = query.has('far'), P = [];
  const add = (x, z, o) => P.push({ x, z, yaw: 0, scale: 1, tint: C.white, tint2: null, style: 0, props: 0, ptint: null, clip: 'idle', speed: 0, ...o });
  // hàng trước: người phố
  add(-6, 0, { clip: 'walk', tint: C.teal, style: STYLE.noTail });                                                                 // người đi đường
  add(-4.8, 0, { clip: 'walk', tint: [0.75, 0.82, 0.9], tint2: C.navy, style: STYLE.sleeve | STYLE.noTail, props: PROP.bag, ptint: C.black });      // công chức
  add(-3.6, 0, { clip: 'walk', tint: C.white, tint2: C.navy, style: STYLE.noTail, props: PROP.scarf | PROP.backpack, ptint: C.blue, scale: 0.82 }); // học sinh
  add(-2.4, 0, { clip: 'walk', tint: C.orange, style: STYLE.shorts | STYLE.noTail | STYLE.tone * 2, props: PROP.backpack | PROP.cap, ptint: C.khaki, scale: 1.08 }); // khách Tây
  add(-1.2, 0, { clip: 'walk', tint: C.pink, tint2: C.khaki, style: STYLE.shorts | STYLE.tone, props: PROP.nonla | PROP.backpack, ptint: C.red, scale: 1.03 }); // khách du lịch đội nón lá
  add(0.4, 0, { clip: 'carry', tint: C.brown, tint2: C.black, style: STYLE.sleeve, props: PROP.nonla | PROP.ganh | PROP.fruit });      // gánh hoa quả
  add(2.6, 0, { clip: 'carry', tint: [0.2, 0.12, 0.25], tint2: C.black, style: STYLE.sleeve, props: PROP.nonla | PROP.ganh | PROP.flowers }); // gánh hoa
  add(4.8, 0, { clip: 'carry', tint: C.navy, tint2: C.brown, style: STYLE.sleeve, props: PROP.nonla | PROP.ganh | PROP.pot });         // gánh tào phớ
  add(6.4, 0, { clip: 'walk', tint: C.orange, tint2: C.navy, style: STYLE.sleeve | STYLE.noTail, props: PROP.nonla });                 // công nhân môi trường
  // hàng sau: ngồi ghế đẩu, tập dưỡng sinh, chạy bộ
  add(-6, -2.5, { clip: 'sit', tint: C.grey, tint2: C.black, style: STYLE.sleeve | STYLE.noTail, props: PROP.stool, ptint: [0.55, 0.035, 0.03], yaw: 0.5 });
  add(-5, -2.3, { clip: 'sit2', tint: C.white, style: STYLE.noTail, props: PROP.stool, ptint: [0.035, 0.14, 0.5], yaw: -0.6 });
  add(-3.8, -2.5, { clip: 'sit', tint: C.red, tint2: C.khaki, style: STYLE.tone * 3 | STYLE.noTail, props: PROP.stool | PROP.cap, ptint: [0.55, 0.035, 0.03], yaw: 0.2 });
  for (let i = 0; i < 4; i++) add(-2 + i * 1.3, -2.5, { clip: 'taichi', tint: [C.white, C.pink, C.yellow, C.white][i], tint2: [C.white, C.black, C.navy, C.black][i], style: STYLE.sleeve | STYLE.tone * 3 | (i % 2 ? 0 : STYLE.noTail) });
  add(3.6, -2.5, { clip: 'swing', tint: C.green, tint2: C.black, style: STYLE.tone * 3 | STYLE.noTail });
  add(5, -2.5, { clip: 'jog', tint: C.yellow, tint2: C.black, style: STYLE.shorts | STYLE.noTail });
  add(6.2, -2.5, { clip: 'idle', tint: C.black, tint2: C.grey, style: STYLE.sleeve });
  let t = 0;
  const update = (dt) => {
    t += dt; cast.begin();
    for (const p of P) { const r = R[p.clip], dur = p.clip === 'taichi' ? 8 : p.clip === 'swing' ? 1.6 : p.clip === 'jog' ? 0.77 : 1.2; cast.put(p, 0, r[0] + (r[1] > 1 ? Math.floor(((t / dur) % 1) * r[1]) : 0), !farRow); }
    cast.end();
  };
  return { update, target: new THREE.Vector3(0.2, 0.9, -1), radius: 7.5, cast, info: `tam giác: gần ${cast.tris.near}, xa ${cast.tris.far}, đồ mang ${cast.tris.kit}, quang gánh ${cast.tris.pole}` };
}
