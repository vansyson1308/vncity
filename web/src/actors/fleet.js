// Đoàn xe của dòng xe Hà Nội: dựng lưới cho từng loại xe (xe máy có người lái nướng sẵn, ô tô, taxi, buýt, xe đạp, xích lô, xe điện
// du lịch) và vẽ bằng instancing: mỗi loại xe và mỗi mức chi tiết đúng một lệnh vẽ. Một lưới phục vụ nhiều dáng vẻ nhờ ba thứ gửi
// theo từng xe: ba màu (sơn thân, áo, mũ/biển số) và một dãy bit bật tắt bộ phận (thùng giao hàng, khẩu trang, áo chống nắng, ống xả,
// hộp đèn taxi, mẹt hoa...): đỉnh của bộ phận bị tắt co về một điểm ngay trong vertex shader nên không tốn điểm ảnh nào.
// Ban đêm thêm MỘT lệnh vẽ cho toàn bộ quầng đèn pha, đèn hậu và vệt sáng trên mặt đường (không dùng đèn điểm).
import * as THREE from 'three';
import { G } from '../core/geo.js';
import { motorbike, car, bus, cyclo, bicycle, ecart, M3, ECART_ROWS, ECART_SEAT } from '../models/vehicles.js';
import { nonLa } from '../models/life.js';
import { propGeometry } from '../world/materials.js';
import { SKY_GLSL, skyU } from '../engine/sky.js';
import { bakePose, appendBaked } from './humans.js';
import { VT } from './trafficsim.js';

// Tư thế ngồi (xoay thêm quanh trục z của xương, radian), áp lên tư thế đứng yên của mô hình người.
const RIDE = [['Bip01_L_Thigh', 1.18], ['Bip01_R_Thigh', 1.18], ['Bip01_L_Calf', -1.2], ['Bip01_R_Calf', -1.2], ['Bip01_L_UpperArm', -0.98], ['Bip01_R_UpperArm', -0.98], ['Bip01_L_Forearm', -0.3], ['Bip01_R_Forearm', -0.3], ['Bip01_Spine', 0.1]];
const PILLION = [['Bip01_L_Thigh', 1.22], ['Bip01_R_Thigh', 1.22], ['Bip01_L_Calf', -1.3], ['Bip01_R_Calf', -1.3], ['Bip01_L_UpperArm', -0.72], ['Bip01_R_UpperArm', -0.72], ['Bip01_L_Forearm', -0.55], ['Bip01_R_Forearm', -0.55], ['Bip01_Spine', 0.04]];
const PEDAL = [['Bip01_L_Thigh', 1.2], ['Bip01_L_Calf', -1.7], ['Bip01_R_Thigh', 0.33], ['Bip01_R_Calf', -0.25], ['Bip01_L_UpperArm', -0.92], ['Bip01_R_UpperArm', -0.92], ['Bip01_L_Forearm', -0.25], ['Bip01_R_Forearm', -0.25], ['Bip01_Spine', 0.2]];
const CYCLO_MAN = [['Bip01_L_Thigh', 0.97], ['Bip01_L_Calf', -1.8], ['Bip01_R_Thigh', 0.45], ['Bip01_R_Calf', -0.3], ['Bip01_L_UpperArm', -0.62], ['Bip01_R_UpperArm', -0.62], ['Bip01_L_Forearm', -0.2], ['Bip01_R_Forearm', -0.2], ['Bip01_Spine', 0.32]];
const LOUNGE = [['Bip01_L_Thigh', 1.75], ['Bip01_R_Thigh', 1.75], ['Bip01_L_Calf', -1.25], ['Bip01_R_Calf', -1.25], ['Bip01_L_UpperArm', -0.3], ['Bip01_R_UpperArm', -0.3], ['Bip01_L_Forearm', -0.85], ['Bip01_R_Forearm', -0.85], ['Bip01_Spine', -0.14]];
const BENCH = [['Bip01_L_Thigh', 1.6], ['Bip01_R_Thigh', 1.6], ['Bip01_L_Calf', -1.6], ['Bip01_R_Calf', -1.6], ['Bip01_L_UpperArm', -0.28], ['Bip01_R_UpperArm', -0.28], ['Bip01_L_Forearm', -0.9], ['Bip01_R_Forearm', -0.9]];
const DRIVE = [['Bip01_L_Thigh', 1.6], ['Bip01_R_Thigh', 1.6], ['Bip01_L_Calf', -1.45], ['Bip01_R_Calf', -1.45], ['Bip01_L_UpperArm', -1.0], ['Bip01_R_UpperArm', -1.0], ['Bip01_L_Forearm', -0.5], ['Bip01_R_Forearm', -0.5]];

// mã bộ phận (g.mat) → bit thứ (mã − 1) trong aVar.w; khớp với BIT trong trafficsim.js
const P = { box: 1, mask: 2, maskDark: 3, hood: 4, exhaust: 5, roof: 1, basket: 1, tray: 2, flowers: 3, fruit: 4, nonla: 5, cap: 6, guest: 1, row2: 1, row3: 2 };
export const MESH = { wave: 0, scooter: 1, cub: 2, sedan: 3, hatch: 4, bus: 5, bicycle: 6, cyclo: 7, ecart: 8, bikeMid: 9, bikeFar: 10, carFar: 11, pillion: 12 };
const HELMET = [[0.128, -0.02], [0.134, 0.02], [0.122, 0.09], [0.088, 0.14], [0.035, 0.162], [0, 0.165]];

// ----- đồ đội, đồ đeo của người ngồi xe (toạ độ theo mô hình người: mặt quay về +z, h là vị trí xương đầu) -----
function helmet(g, h, seg = 8) {
  g.rgb(0.86, 0.86, 0.86, M3).gloss(0.7).lathe(h[0], h[1] + 0.085, h[2] + 0.005, HELMET, seg).gloss(0);
  g.rgb(0.3, 0.3, 0.3, M3).quad([h[0] - 0.085, h[1] + 0.085, h[2] + 0.1], [h[0] + 0.085, h[1] + 0.085, h[2] + 0.1], [h[0] + 0.06, h[1] + 0.07, h[2] + 0.178], [h[0] - 0.06, h[1] + 0.07, h[2] + 0.178]) // lưỡi trai ngắn, sẫm hơn vỏ mũ
    .quad([h[0] + 0.085, h[1] + 0.08, h[2] + 0.1], [h[0] - 0.085, h[1] + 0.08, h[2] + 0.1], [h[0] - 0.06, h[1] + 0.065, h[2] + 0.178], [h[0] + 0.06, h[1] + 0.065, h[2] + 0.178]);
}
// mũ cối, mũ lưỡi trai: chỏm thấp có vành
function capHat(g, h, part) {
  if (part) g.mat(part);
  g.rgb(0.86, 0.86, 0.86, M3).lathe(h[0], h[1] + 0.105, h[2] + 0.01, [[0.15, -0.012], [0.112, 0.0], [0.108, 0.05], [0.07, 0.085], [0, 0.095]], 7);
  if (part) g.mat(0);
}
function faceMask(g, h, dark, part) {
  g.mat(part); dark ? g.rgb(0.045, 0.045, 0.055) : g.rgb(0.6, 0.76, 0.85);
  const y0 = h[1] - 0.045, y1 = h[1] + 0.072, cz = h[2] + 0.012, Q = (a, y, r) => [h[0] + Math.sin(a) * r, y, cz + Math.cos(a) * r];
  const R = [0.1, 0.132, 0.132, 0.1], A = [-1.15, -0.34, 0.34, 1.15]; // nhô ra ở giữa để trùm kín mũi
  for (let i = 0; i < 3; i++) g.quad(Q(A[i], y0, R[i] - 0.014), Q(A[i + 1], y0, R[i + 1] - 0.014), Q(A[i + 1], y1, R[i + 1]), Q(A[i], y1, R[i]));
  g.quad(Q(A[1], y1, R[1]), Q(A[2], y1, R[2]), Q(A[2], y1 + 0.012, R[2] - 0.05), Q(A[1], y1 + 0.012, R[1] - 0.05));
  g.mat(0);
}
// áo chống nắng: mũ trùm ôm gáy, tai và cổ dưới vành mũ bảo hiểm, tấm che mặt, váy quây che đùi và ống chân (màu theo áo)
function sunKit(g, h, part) {
  g.mat(part).rgb(0.72, 0.72, 0.72, 0.5);
  g.lathe(h[0], h[1] - 0.15, h[2] - 0.005, [[0.2, 0], [0.135, 0.07], [0.122, 0.15], [0.136, 0.215]], 7, Math.PI / 2 + 0.8, Math.PI * 2.5 - 0.8);
  const w = 0.255, S = [[0.02, 0.95], [0.1, 0.965], [0.44, 0.83], [0.49, 0.6], [0.46, 0.4]], F = [0.22, 0.42], B = [0.0, 0.62];
  for (let i = 0; i < S.length - 1; i++) g.quad([w, S[i][1], S[i][0]], [-w, S[i][1], S[i][0]], [-w, S[i + 1][1], S[i + 1][0]], [w, S[i + 1][1], S[i + 1][0]]);
  g.shade(0.85);
  for (const s of [-1, 1]) { const pts = [S[1], S[2], S[3], S[4], F, B].map((q) => [s * w, q[1], q[0]]); for (let i = 1; i < pts.length - 1; i++) s > 0 ? g.tri3(pts[0], pts[i], pts[i + 1]) : g.tri3(pts[0], pts[i + 1], pts[i]); }
  g.mat(0);
}
// người làm bằng khối hộp cho mức chi tiết vừa (30-75 m): thân, đầu, mũ, hai tay, hai chân; mask: mặt nạ màu áo
function boxRider(g, o) {
  const { hip = [0, 0.9, 0], lean = 0.12, hands = [0.27, 1.06, 0.4], knee = [0.13, 0.76, 0.36], foot = [0.13, 0.34, 0.34], mask = 0.5, hat = true } = o;
  const sh = [0, hip[1] + 0.5, hip[2] + lean];
  g.rgb(0.75, 0.75, 0.75, mask); g.quad([-0.17, hip[1] - 0.04, hip[2] - 0.1], [-0.19, sh[1], sh[2] - 0.1], [0.19, sh[1], sh[2] - 0.1], [0.17, hip[1] - 0.04, hip[2] - 0.1]).quad([0.17, hip[1] - 0.04, hip[2] + 0.1], [0.19, sh[1], sh[2] + 0.09], [-0.19, sh[1], sh[2] + 0.09], [-0.17, hip[1] - 0.04, hip[2] + 0.1]);
  for (const s of [-1, 1]) g.quad([s * 0.17, hip[1] - 0.04, hip[2] - s * 0.1], [s * 0.19, sh[1], sh[2] - s * 0.1], [s * 0.19, sh[1], sh[2] + s * 0.09], [s * 0.17, hip[1] - 0.04, hip[2] + s * 0.1]);
  g.quad([-0.19, sh[1], sh[2] + 0.09], [0.19, sh[1], sh[2] + 0.09], [0.19, sh[1], sh[2] - 0.1], [-0.19, sh[1], sh[2] - 0.1]);
  const hd = [0, sh[1] + 0.13, sh[2] + 0.03];
  g.rgb(0.55, 0.36, 0.26).ball(hd[0], hd[1], hd[2], 0.1, 5, 3);
  if (hat) g.rgb(0.86, 0.86, 0.86, M3).gloss(0.6).lathe(hd[0], hd[1] + 0.02, hd[2], [[0.13, -0.02], [0.12, 0.07], [0, 0.125]], 6).gloss(0);
  for (const s of [-1, 1]) {
    g.rgb(0.55, 0.36, 0.26, mask === 0.5 ? 0.35 : 0).tube([s * 0.21, sh[1] - 0.05, sh[2]], [s * hands[0], hands[1], hands[2]], 0.05, 3, 0.04);
    g.rgb(0.07, 0.09, 0.14).tube([s * 0.1, hip[1], hip[2]], [s * knee[0], knee[1], knee[2]], 0.08, 3, 0.065).tube([s * knee[0], knee[1], knee[2]], [s * foot[0], foot[1], foot[2]], 0.06, 3, 0.05);
  }
}

// Vật liệu của dòng xe: Lambert màu đỉnh, ba màu theo từng xe, bộ phận bật tắt theo bit, đèn tự sáng khi lên đèn, nước sơn bắt trời.
function fleetMaterial() {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, skyU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec4 aFx; attribute vec3 aTint; attribute vec3 aTint2; attribute vec4 aVar; varying vec4 vFx; varying vec3 vWPos; varying vec3 vWN;`)
      .replace('#include <color_vertex>', `#include <color_vertex>
        vColor.rgb *= vColor.rgb;
        { float ma = color.a, bits = aVar.w;
          if (ma >= 0.75) vColor.rgb *= aTint;                                       // màu sơn thân
          else if (ma >= 0.42) vColor.rgb *= aTint2;                                 // áo
          else if (ma >= 0.25) { if (mod(floor(bits / 256.0), 2.0) > 0.5) vColor.rgb = vec3(0.5625) * aTint2; } // da tay hoặc tay áo dài
          else if (ma >= 0.08) vColor.rgb *= aVar.rgb; }                             // mũ bảo hiểm, biển số
        vColor.a = 1.0;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${HIDE}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\nvFx = aFx; vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec4 vFx; varying vec3 vWPos; varying vec3 vWN;\n${SKY_GLSL}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vFx.x * uLit * 2.6;`)
      .replace('#include <opaque_fragment>', `
        if (vFx.z > 0.02) { vec3 V = normalize(vWPos - cameraPosition); vec3 N = normalize(vWN); vec3 Rf = reflect(V, N);
          float fr = 0.05 + 0.95 * pow(1.0 - max(dot(-V, N), 0.0), 4.0);
          outgoingLight += skyColor(Rf) * fr * vFx.z * 0.55 + uSunCol * pow(max(dot(Rf, uSunDir), 0.0), 40.0) * vFx.z * 0.25; }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'hn-fleet';
  return mat;
}
// bộ phận mang mã pid (kênh aFx.w) chỉ hiện khi bit (pid − 1) của aVar.w bật
const HIDE = `{ float pid = floor(aFx.w * 15.9375 + 0.5); if (pid > 0.5 && mod(floor(aVar.w / exp2(pid - 1.0)), 2.0) < 0.5) transformed = vec3(0.0); }`;
function fleetDepth() {
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  d.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aFx; attribute vec4 aVar;').replace('#include <begin_vertex>', `#include <begin_vertex>\n${HIDE}`); };
  d.customProgramCacheKey = () => 'hn-fleet-depth';
  return d;
}

// Dựng lưới của mọi loại xe. human: gltf mô hình người bản nhẹ (human_far). Trả về mảng G theo thứ tự MESH.
export function buildFleetGeometry(human) {
  const B = (pose, opt) => bakePose(human, 'idle', 0, pose, { sleeves: true, ...opt });
  const rider = B(RIDE), pill = B(PILLION), pedal = B(PEDAL), cman = B(CYCLO_MAN), lounge = B(LOUNGE, { shirtMask: 1, bare: true }), drive = B(DRIVE);
  const benchA = B(BENCH, { shirtMask: 1, bare: true }), benchB = B(BENCH, { shirtMask: M3, bare: true });
  const out = [];
  // ----- xe máy có người lái -----
  for (const kind of ['wave', 'scooter', 'cub']) {
    const g = new G(); motorbike(g, kind, 0, { exhaustPart: P.exhaust });
    g.push().move(-0.3, -0.09, 0).rotY(Math.PI / 2); appendBaked(g, rider);
    helmet(g, rider.head); faceMask(g, rider.head, false, P.mask); faceMask(g, rider.head, true, P.maskDark);
    if (kind !== 'cub') sunKit(g, rider.head, P.hood);
    g.pop();
    // thùng giao hàng sau lưng (màu theo áo, nắp sẫm hơn)
    g.mat(P.box).rgb(0.75, 0.75, 0.75, 0.5).box(-1.06, 0.86, -0.23, -0.62, 1.3, 0.23, 'xXyzZ').shade(0.55).box(-1.07, 1.3, -0.24, -0.61, 1.35, 0.24).mat(0);
    out.push(g);
  }
  // ----- ô tô: sedan và xe gầm cao đuôi cụt, dùng chung cho xe nhà và taxi -----
  out.push(car(new G(), false, { fleet: true, roofPart: P.roof }), car(new G(), false, { kind: 'hatch', fleet: true, roofPart: P.roof }), bus(new G(), { fleet: true }));
  // ----- xe đạp: người đạp, giỏ trước, mẹt hoa / quả sau yên, nón lá hoặc mũ lưỡi trai -----
  { const g = new G(); bicycle(g, { fleet: true, parts: { basket: P.basket, tray: P.tray, flowers: P.flowers, fruit: P.fruit } });
    g.push().move(-0.2, 0.06, 0).rotY(Math.PI / 2); appendBaked(g, pedal);
    g.mat(P.nonla); nonLa(g, pedal.head[0], pedal.head[1] + 0.1, pedal.head[2] + 0.01, 0.26, 0.17, 9); g.mat(0); capHat(g, pedal.head, P.cap);
    g.pop(); out.push(g); }
  // ----- xích lô: người đạp đội mũ cối ngồi sau, khách ngồi trước (ẩn được) -----
  { const g = new G(); cyclo(g);
    g.push().move(-0.6, 0.1, 0).rotY(Math.PI / 2); appendBaked(g, cman); capHat(g, cman.head, 0); g.pop();
    const n0 = g.count; g.push().move(0.5, -0.215, 0).rotY(Math.PI / 2); appendBaked(g, lounge); g.pop();
    for (let i = n0; i < g.count; i++) g.fx[i * 4 + 3] = (P.guest * 16) / 255;
    out.push(g); }
  // ----- xe điện du lịch: lái xe và bốn khách ở hai hàng ghế giữa (ẩn được theo hàng) -----
  { const g = new G(); ecart(g);
    const sit = (b, x, z, part) => { const n0 = g.count; g.push().move(x - 0.08, ECART_SEAT + 0.1 - 0.895, z).rotY(Math.PI / 2); appendBaked(g, b); g.pop(); if (part) for (let i = n0; i < g.count; i++) g.fx[i * 4 + 3] = (part * 16) / 255; };
    sit(drive, ECART_ROWS[0], -0.36, 0); sit(benchA, ECART_ROWS[1], -0.33, P.row2); sit(benchB, ECART_ROWS[1], 0.33, P.row2); sit(benchB, ECART_ROWS[2], -0.33, P.row3); sit(benchA, ECART_ROWS[2], 0.33, P.row3);
    out.push(g); }
  // ----- xe máy mức vừa: xe thật, người bằng khối; khách ngồi sau và thùng hàng là bộ phận ẩn được -----
  { const g = new G(); motorbike(g, 'scooter', 0);
    g.push().move(-0.3, -0.09, 0).rotY(Math.PI / 2); boxRider(g, {}); g.pop();
    g.mat(P.box).rgb(0.75, 0.75, 0.75, 0.5).box(-1.06, 0.86, -0.23, -0.62, 1.3, 0.23, 'xXYzZ').mat(0);
    const n0 = g.count; g.push().move(-0.72, -0.07, 0).rotY(Math.PI / 2); boxRider(g, { mask: M3, lean: 0.05, hands: [0.2, 1.12, 0.3] }); g.pop();
    for (let i = n0; i < g.count; i++) g.fx[i * 4 + 3] = (2 * 16) / 255; // bit 2 (mã 2) ở mức vừa = có khách ngồi sau
    out.push(g); }
  // ----- bản xa: vài khối hộp là đủ khi xe chỉ còn vài điểm ảnh -----
  const bikeFar = new G(); bikeFar.color(0xd8d8d8, 1).box(-0.85, 0.3, -0.15, 0.5, 0.78, 0.15).rgb(0.03, 0.03, 0.03).box(0.38, 0, -0.05, 0.9, 0.56, 0.05).box(-0.88, 0, -0.05, -0.34, 0.56, 0.05)
    .rgb(0.75, 0.75, 0.75, 0.5).box(-0.45, 0.78, -0.2, -0.1, 1.42, 0.2).rgb(0.1, 0.12, 0.17).box(-0.42, 0.42, -0.2, 0.12, 0.8, 0.2).rgb(0.86, 0.86, 0.86, M3).box(-0.38, 1.42, -0.13, -0.12, 1.68, 0.13)
    .rgb(1, 0.95, 0.8).glow(0.85).box(0.5, 0.84, -0.08, 0.52, 0.98, 0.08, 'X').rgb(0.9, 0.05, 0.03).glow(0.7).box(-0.87, 0.58, -0.08, -0.85, 0.7, 0.08, 'x').glow(0);
  const carFar = new G(); carFar.color(0xdcdcdc, 1).box(-2.15, 0.2, -0.88, 2.15, 0.82, 0.88).rgb(0.03, 0.05, 0.07).gloss(1).box(-1.5, 0.82, -0.8, 0.9, 1.45, 0.8, 'xXzZ').gloss(0).color(0xdcdcdc, 1).box(-1.5, 1.45, -0.8, 0.9, 1.47, 0.8, 'Y')
    .rgb(1, 0.96, 0.85).glow(0.8).box(2.15, 0.5, -0.75, 2.16, 0.7, 0.75, 'X').rgb(0.9, 0.04, 0.03).glow(0.7).box(-2.16, 0.5, -0.75, -2.15, 0.7, 0.75, 'x').glow(0);
  out.push(bikeFar, carFar);
  // ----- khách ngồi sau xe máy: một lưới riêng dùng chung cho mọi kiểu xe máy -----
  { const g = new G(); g.push().move(-0.72, -0.07, 0).scale(0.94).rotY(Math.PI / 2); appendBaked(g, pill); helmet(g, pill.head); faceMask(g, pill.head, false, P.mask); g.pop(); out.push(g); }
  return out;
}

// đèn của từng loại xe: [mũi xe (m trước tâm), đuôi xe, cao đèn pha, nửa khoảng cách hai đèn (0: một đèn), cao đèn hậu]
const LAMPS = [[0.56, 0.9, 0.92, 0, 0.72], [0.56, 0.93, 0.92, 0, 0.72], [0.56, 0.9, 0.92, 0, 0.7], [2.15, 2.15, 0.67, 0.62, 0.86], [2.0, 2.0, 0.75, 0.62, 0.92], [5.26, 5.26, 0.85, 0.85, 0.85], null, null, [2.26, 2.26, 0.62, 0.52, 0.69]];

export class Fleet {
  // caps: { bikes, cars } số xe tối đa (để cấp bộ đệm instance)
  constructor(scene, human, quality, caps) {
    const geos = buildFleetGeometry(human), mat = fleetMaterial(), depth = fleetDepth(), nb = caps.bikes, nc = Math.max(6, Math.ceil((caps.bikes + caps.cars) * 0.3));
    const cap = [nb, nb, Math.ceil(nb / 3), nc, nc, 4, 12, 10, 4, nb, nb, nc + 8, Math.ceil(nb / 2)];
    this.tris = geos.map((g) => g.idx.length / 3);
    this.meshes = geos.map((g, t) => {
      const geo = propGeometry(g.pack()), n = cap[t];
      geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3));
      geo.setAttribute('aTint2', new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3));
      geo.setAttribute('aVar', new THREE.InstancedBufferAttribute(new Float32Array(n * 4).fill(1), 4));
      const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; m.receiveShadow = false;
      m.castShadow = quality.shadow > 0 && t !== MESH.bikeFar && t !== MESH.carFar; m.customDepthMaterial = depth;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.userData.ids = new Int32Array(n); m.userData.cap = n; scene.add(m); return m;
    });
    this.counts = new Int32Array(geos.length); this.dirty = new Uint8Array(geos.length);
    // mức chi tiết theo khoảng cách (bình phương mét): xe máy đủ chi tiết / mức vừa / khối hộp; ô tô đủ chi tiết / khối hộp
    const q = quality.name; this.near2 = (q === 'high' ? 40 : q === 'low' ? 20 : 29) ** 2; this.mid2 = (q === 'high' ? 100 : q === 'low' ? 55 : 78) ** 2; this.car2 = (q === 'low' ? 60 : 90) ** 2;
    this.glare = new Glare(scene, caps.bikes + caps.cars * 2 + 30);
  }
  begin() { this.counts.fill(0); this.glare.n = 0; }
  slot(mi, a) {
    const m = this.meshes[mi], i = this.counts[mi]; if (i >= m.userData.cap) return -1; this.counts[mi] = i + 1;
    return i;
  }
  // ghi ma trận: cột X = hướng tới, Y = lên (nghiêng), Z = phải (nghiêng)
  mat(mi, i, a, sc = 1) {
    const arr = this.meshes[mi].instanceMatrix.array, off = i * 16, fx = Math.sin(a.yaw), fz = Math.cos(a.yaw), rx = -fz, rz = fx, cl = Math.cos(a.lean), sl = Math.sin(a.lean);
    arr[off] = fx * sc; arr[off + 1] = 0; arr[off + 2] = fz * sc; arr[off + 3] = 0;
    arr[off + 4] = rx * sl * sc; arr[off + 5] = cl * sc; arr[off + 6] = rz * sl * sc; arr[off + 7] = 0;
    arr[off + 8] = rx * cl * sc; arr[off + 9] = -sl * sc; arr[off + 10] = rz * cl * sc; arr[off + 11] = 0;
    arr[off + 12] = a.x; arr[off + 13] = a.y || 0; arr[off + 14] = a.z; arr[off + 15] = 1;
  }
  look(mi, i, key, t1, t2, t3, bits) {
    const m = this.meshes[mi], ids = m.userData.ids; if (ids[i] === key) return; ids[i] = key; this.dirty[mi] = 1;
    const A = m.geometry.attributes, a1 = A.aTint.array, a2 = A.aTint2.array, v = A.aVar.array, j = i * 3, k = i * 4;
    a1[j] = t1[0]; a1[j + 1] = t1[1]; a1[j + 2] = t1[2]; a2[j] = t2[0]; a2[j + 1] = t2[1]; a2[j + 2] = t2[2]; v[k] = t3[0]; v[k + 1] = t3[1]; v[k + 2] = t3[2]; v[k + 3] = bits;
  }
  // đặt một xe vào khung hình. d2: bình phương khoảng cách tới camera; lit: đang lên đèn
  add(a, d2, lit) {
    const t = a.type; let mi = t;
    if (t <= VT.cub) mi = d2 > this.mid2 ? MESH.bikeFar : d2 > this.near2 ? MESH.bikeMid : t;
    else if (t === VT.sedan || t === VT.hatch || t === VT.ecart) { if (d2 > this.car2) mi = MESH.carFar; }
    else if (t === VT.bicycle || t === VT.cyclo) { if (d2 > this.mid2) mi = MESH.bikeFar; }
    let i = this.slot(mi, a);
    if (i < 0 && t <= VT.cub && mi === t) { mi = MESH.bikeMid; i = this.slot(mi, a); } // hết chỗ ở mức gần: lùi xuống mức vừa
    if (i < 0) return;
    this.mat(mi, i, a);
    let bits = a.bits;
    if (mi === MESH.bikeMid) bits = (a.bits & 257) | (a.pill ? 2 : 0); // mức vừa: thùng hàng (bit 1), khách sau (bit 2), tay áo
    this.look(mi, i, a.id * 4 + (mi === t ? 0 : mi === MESH.bikeMid ? 1 : 2), a.tint, a.tint2, mi === MESH.bikeMid && a.pill ? a.ptint2 : a.tint3, bits);
    if (a.pill && mi === t && t <= VT.cub) { // khách ngồi sau (trẻ con thì nhỏ hơn)
      const pi = this.slot(MESH.pillion, a);
      if (pi >= 0) { this.mat(MESH.pillion, pi, a, a.pill === 2 ? 0.74 : 1); if (a.pill === 2) { const arr = this.meshes[MESH.pillion].instanceMatrix.array, o = pi * 16; arr[o + 12] -= Math.sin(a.yaw) * 0.16; arr[o + 14] -= Math.cos(a.yaw) * 0.16; arr[o + 13] += 0.2; }
        this.look(MESH.pillion, pi, a.id, a.tint, a.ptint2, a.ptint3, a.pbits); }
    }
    if (lit && LAMPS[t] && d2 < 62500) this.glare.add(a, LAMPS[t]);
  }
  end(lit) {
    for (let t = 0; t < this.meshes.length; t++) {
      const m = this.meshes[t], n = this.counts[t]; m.count = n; m.visible = n > 0;
      if (n) m.instanceMatrix.needsUpdate = true;
      if (this.dirty[t]) { this.dirty[t] = 0; const A = m.geometry.attributes; A.aTint.needsUpdate = A.aTint2.needsUpdate = A.aVar.needsUpdate = true; }
    }
    this.glare.end(lit);
  }
}

// Quầng đèn xe ban đêm: mỗi đèn pha là một tấm luôn quay về camera (sáng nhất khi nhìn thẳng vào mũi xe, to dần theo khoảng cách
// như đèn loá trong sương), đèn hậu đỏ nhìn từ phía sau, và một vệt sáng ấm trải trên mặt đường trước mũi xe. Cộng màu, một lệnh vẽ.
class Glare {
  constructor(scene, max) {
    const geo = new THREE.InstancedBufferGeometry(), pos = [], idx = [];
    for (let k = 0; k < 3; k++) { const b = k * 4; pos.push(-1, -1, k, 1, -1, k, 1, 1, k, -1, 1, k); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
    this.aP = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); this.aL = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.aP.setUsage(THREE.DynamicDrawUsage); this.aL.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aP', this.aP); geo.setAttribute('aL', this.aL);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { ...skyU, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0.001 } }, fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute vec4 aP; attribute vec4 aL; uniform float uLit;
        varying vec3 vQ; varying float vI; varying float vFogDepth;
        void main() {
          float kind = position.z; vec2 c = position.xy;
          float sy = sin(aP.w), cy = cos(aP.w); vec3 fwd = vec3(sy, 0.0, cy), rgt = vec3(-cy, 0.0, sy);
          float side = aL.w, two = step(0.01, abs(side));
          vec3 base = aP.xyz + rgt * side;
          vec3 toCam = cameraPosition - base; float dist = length(toCam); float facing = dot(toCam / max(dist, 0.001), fwd);
          float front = aL.x, hh = aL.z; vec4 mv; float inten;
          if (kind < 1.5) {
            float tail = step(0.5, kind);
            vec3 lp = base + fwd * mix(front, -aL.y, tail) + vec3(0.0, mix(fract(hh), floor(hh) * 0.01, tail), 0.0);
            float r = mix(0.2 + dist * 0.006, 0.12 + dist * 0.0035, tail);
            inten = mix(smoothstep(-0.05, 0.55, facing), smoothstep(-0.1, 0.45, -facing) * 0.85, tail);
            mv = viewMatrix * vec4(lp, 1.0); mv.xy += c * r * step(0.004, inten); mv.z += min(0.6, dist * 0.25);
          } else {
            float len = 3.4 + front * 0.7, wid = (0.9 + front * 0.12) * (1.0 + two * 0.5), t = c.y * 0.5 + 0.5;
            vec3 gp = aP.xyz + fwd * (front + 0.2 + t * 2.0 * len) + rgt * c.x * wid * (0.55 + 0.75 * t); gp.y = aP.y + 0.04;
            inten = (1.0 - smoothstep(55.0, 95.0, dist)) * (two > 0.5 && side < 0.0 ? 0.0 : 1.0);
            mv = viewMatrix * vec4(gp, 1.0);
          }
          vQ = vec3(c, kind); vI = inten * uLit; vFogDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float fogDensity; varying vec3 vQ; varying float vI; varying float vFogDepth;
        void main() {
          vec3 col; float d2 = dot(vQ.xy, vQ.xy);
          if (vQ.z < 1.5) {
            float a = exp(-d2 * 9.0) * 1.3 + exp(-d2 * 2.2) * 0.22; a *= 1.0 - smoothstep(0.6, 1.0, d2);
            col = (vQ.z < 0.5 ? vec3(1.0, 0.9, 0.72) * 2.4 : vec3(1.0, 0.07, 0.03) * 1.9) * a;
          } else {
            float t = vQ.y * 0.5 + 0.5, a = pow(1.0 - vQ.x * vQ.x, 2.0) * smoothstep(0.0, 0.12, t) * pow(1.0 - t, 1.6);
            col = vec3(1.0, 0.86, 0.62) * a * 0.3;
          }
          float ff = exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
          gl_FragColor = vec4(col * vI * ff, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 6; this.mesh.visible = false; scene.add(this.mesh);
    this.max = max; this.n = 0; this.geo = geo;
  }
  // l: [mũi xe, đuôi xe, cao đèn pha, nửa khoảng cách hai đèn, cao đèn hậu]
  add(a, l) {
    for (let s = l[3] ? -1 : 1; s <= 1; s += 2) {
      if (this.n >= this.max) return; const k = this.n++ * 4, P = this.aP.array, L = this.aL.array;
      P[k] = a.x; P[k + 1] = a.y || 0; P[k + 2] = a.z; P[k + 3] = a.yaw;
      L[k] = l[0]; L[k + 1] = l[1]; L[k + 2] = l[2] + Math.round(l[4] * 100); L[k + 3] = l[3] * s; // cao đèn pha (phần lẻ) + cao đèn hậu (phần nguyên, cm)
    }
  }
  end(lit) {
    this.mesh.visible = lit > 0.02 && this.n > 0; this.geo.instanceCount = this.n;
    if (this.mesh.visible) { this.aP.needsUpdate = true; this.aL.needsUpdate = true; }
  }
}
