// Bầu trời, mặt trời, trăng, sương mù và ánh sáng theo giờ trong ngày của Hà Nội.
// Không dùng bản đồ môi trường: kính, mặt hồ, nước sơn xe tự tính phản chiếu trời từ cùng bộ uniform (SKY_GLSL),
// nên đổi giờ không tốn một khung hình nào để dựng lại cubemap.
import * as THREE from 'three';
import { clamp, lerp, smooth } from '../core/util.js';

// Uniform dùng chung cho mọi vật liệu.
export const skyU = {
  uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGroundCol: { value: new THREE.Color() },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uMoonDir: { value: new THREE.Vector3(-0.4, 0.7, 0.5).normalize() },
  uNight: { value: 0 }, uTime: { value: 0 }, uClouds: { value: 0.45 }, uWet: { value: 0 }, uLit: { value: 0 },
  // lỗ nhìn xuyên vật che: (x, y, z) ngực nhân vật và bán kính; vật nằm chắn giữa camera và nhân vật bị đục lỗ lấm tấm
  uCut: { value: new THREE.Vector4(0, -1000, 0, 0) },
};

// Màu trời theo hướng nhìn, bản rút gọn (không mây, không sao) cho phản chiếu.
export const SKY_GLSL = /* glsl */`
uniform vec3 uZenith, uHorizon, uGroundCol, uSunDir, uSunCol, uMoonDir;
uniform float uNight, uTime, uClouds, uWet, uLit;
uniform vec4 uCut;
vec3 skyColor(vec3 d) {
  float h = d.y;
  vec3 c = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.42));
  c = mix(c, uGroundCol, smoothstep(0.0, -0.12, h));
  float s = max(dot(d, uSunDir), 0.0);
  c += uSunCol * (pow(s, 24.0) * 0.22 + pow(s, 5.0) * 0.06);
  return c;
}
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`;

const KEYS = [ // theo góc cao mặt trời (độ)
  { el: -18, zen: 0x05070f, hor: 0x141a2a, sun: 0x000000, si: 0, hemi: 0x5565a0, hg: 0x54453a, hi: 2.5, fog: 0x121826, exp: 1.3 },
  { el: -6, zen: 0x0b1226, hor: 0x2a2a44, sun: 0x000000, si: 0, hemi: 0x5c6ca6, hg: 0x574739, hi: 2.4, fog: 0x1c2234, exp: 1.26 },
  { el: -1, zen: 0x24406e, hor: 0xd98a5a, sun: 0xff7a3a, si: 0.5, hemi: 0x6a7fae, hg: 0x7a6656, hi: 2.0, fog: 0x8f7f86, exp: 1.1 },
  { el: 4, zen: 0x3a66a8, hor: 0xf0b888, sun: 0xffa35c, si: 1.9, hemi: 0x8fa6cf, hg: 0x9a8a74, hi: 1.9, fog: 0xd8b294, exp: 1.02 },
  { el: 12, zen: 0x4a80c8, hor: 0xe6d0b0, sun: 0xffd09a, si: 2.6, hemi: 0xa9c0e0, hg: 0xa69a86, hi: 1.95, fog: 0xd8cdb8, exp: 0.97 },
  { el: 30, zen: 0x4f8bd6, hor: 0xcfdbe2, sun: 0xfff0d8, si: 3.0, hemi: 0xbcd2ee, hg: 0xb0a694, hi: 1.9, fog: 0xbfcdd8, exp: 0.92 },
  { el: 65, zen: 0x4a86d4, hor: 0xcad8e2, sun: 0xfff6e8, si: 3.2, hemi: 0xc4d8f2, hg: 0xb4aa98, hi: 1.85, fog: 0xbccbd8, exp: 0.9 },
];
const cA = new THREE.Color(), cB = new THREE.Color();
const mixHex = (out, a, b, t) => out.copy(cA.setHex(a)).lerp(cB.setHex(b), t);

export class Sky {
  constructor(scene, camera, quality) {
    this.scene = scene; this.camera = camera;
    this.hours = 17.2; this.speed = 1 / 60; // một phút game mỗi giây thật
    this.exposure = 1; this.night = 0; this.elevation = 0;
    scene.fog = new THREE.FogExp2(0xc6d2da, 0.0016);
    this.fogDensity = quality.fog;

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    if (quality.shadow) {
      this.sun.castShadow = true; this.sun.shadow.mapSize.set(quality.shadow, quality.shadow);
      const R = quality.shadowRange; Object.assign(this.sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 10, far: 700 });
      this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.06; this.shadowRange = R;
    }
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
    scene.add(this.sun, this.sun.target, this.hemi);

    const mat = new THREE.ShaderMaterial({
      uniforms: skyU, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position, 0.0); gl_Position = projectionMatrix * vec4(p.xyz, 1.0); gl_Position.z = gl_Position.w; }`,
      fragmentShader: /* glsl */`
        varying vec3 vDir;
        ${SKY_GLSL}
        float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<${quality.clouds ? 4 : 2};i++){ s+=a*vnoise(p); p=p*2.03+vec2(11.3,7.1); a*=.5; } return s; }
        void main(){
          vec3 d = normalize(vDir);
          vec3 c = skyColor(d);
          float s = max(dot(d, uSunDir), 0.0);
          float disc = smoothstep(0.99955, 0.9998, s);
          c += uSunCol * (disc * 5.0 + pow(s, 600.0) * 1.2) * step(-0.02, uSunDir.y);
          // trăng và sao
          float m = max(dot(d, uMoonDir), 0.0);
          c += vec3(0.85, 0.9, 1.0) * (smoothstep(0.99975, 0.99985, m) * 1.4 + pow(m, 300.0) * 0.12) * uNight;
          vec2 sp = d.xz / (abs(d.y) + 0.35) * 220.0;
          float st = step(0.9965, hash12(floor(sp))) * smoothstep(0.05, 0.3, d.y);
          c += vec3(st) * (0.5 + 0.5 * sin(uTime * 2.0 + hash12(floor(sp)) * 40.0)) * 0.55 * uNight;
          // mây tầng cao trôi chậm
          if (d.y > 0.01) {
            vec2 cp = d.xz / (d.y + 0.12) * 1.4 + vec2(uTime * 0.006, uTime * 0.002);
            float cl = smoothstep(1.0 - uClouds, 1.0 - uClouds + 0.38, fbm(cp));
            float lit = 0.55 + 0.45 * fbm(cp * 2.3 + 4.0);
            vec3 cc = mix(uHorizon * 0.9, uSunCol * 0.22 + uZenith * 0.45 + uHorizon * 0.5, lit) + uSunCol * pow(s, 6.0) * 0.25;
            cc = mix(cc, vec3(0.045, 0.05, 0.07) + uHorizon * 0.5, uNight);
            c = mix(c, cc, cl * smoothstep(0.01, 0.16, d.y) * 0.85);
          }
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
    this.dome.frustumCulled = false; this.dome.renderOrder = -10; this.dome.matrixAutoUpdate = false;
    scene.add(this.dome);
    this.apply();
  }

  // Góc cao và phương vị mặt trời: mọc 5:45 ở hướng đông, lặn 18:15 ở hướng tây, đỉnh 62°.
  sunAngles(h) {
    const f = (h - 5.75) / 12.5;
    if (f >= 0 && f <= 1) return { el: Math.sin(Math.PI * f) * 62, az: 82 + 196 * f };
    const g = f < 0 ? f + 24 / 12.5 - 1 : f - 1; // phần đêm 0..0.92
    return { el: -Math.sin(Math.PI * clamp(g / 0.92, 0, 1)) * 40, az: 278 + 164 * (g / 0.92) };
  }

  apply() {
    const { el, az } = this.sunAngles(this.hours);
    this.elevation = el;
    let i = 0; while (i < KEYS.length - 2 && el > KEYS[i + 1].el) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = clamp((el - a.el) / (b.el - a.el), 0, 1);
    mixHex(skyU.uZenith.value, a.zen, b.zen, t); mixHex(skyU.uHorizon.value, a.hor, b.hor, t);
    mixHex(this.sun.color, a.sun, b.sun, t);
    const night = 1 - smooth(-7, 1, el); this.night = night; skyU.uNight.value = night;
    // đèn đường và cửa sổ bật lúc chạng vạng
    skyU.uLit.value = 1 - smooth(-3, 6, el);
    const er = THREE.MathUtils.degToRad(Math.max(el, 3)), ar = THREE.MathUtils.degToRad(az);
    const dir = skyU.uSunDir.value.set(Math.sin(ar) * Math.cos(er), Math.sin(er), -Math.cos(ar) * Math.cos(er));
    if (el < -1) { // đêm: ánh trăng thay mặt trời để vẫn có bóng đổ nhẹ
      dir.copy(skyU.uMoonDir.value); this.sun.color.setHex(0x8ea4d6); this.sun.intensity = 0.75 * smooth(-1, -8, el);
      skyU.uSunCol.value.setRGB(0, 0, 0);
    } else {
      this.sun.intensity = lerp(a.si, b.si, t);
      skyU.uSunCol.value.copy(this.sun.color).multiplyScalar(this.sun.intensity);
      skyU.uSunDir.value.set(Math.sin(ar) * Math.cos(THREE.MathUtils.degToRad(el)), Math.sin(THREE.MathUtils.degToRad(el)), -Math.cos(ar) * Math.cos(THREE.MathUtils.degToRad(el)));
    }
    this.lightDir = el < -1 ? skyU.uMoonDir.value : dir.clone().normalize();
    mixHex(this.hemi.color, a.hemi, b.hemi, t); mixHex(this.hemi.groundColor, a.hg, b.hg, t); this.hemi.intensity = lerp(a.hi, b.hi, t);
    mixHex(this.scene.fog.color, a.fog, b.fog, t); skyU.uGroundCol.value.copy(this.scene.fog.color);
    this.scene.fog.density = this.fogDensity * (1 + night * 0.15);
    this.exposure = lerp(a.exp, b.exp, t);
  }

  setHours(h) { this.hours = ((h % 24) + 24) % 24; this.apply(); }

  update(dt, focus) {
    skyU.uTime.value += dt;
    this.hours = (this.hours + dt * this.speed) % 24;
    this.acc = (this.acc || 0) + dt;
    if (this.acc > 0.5) { this.acc = 0; this.apply(); }
    const cam = this.camera;
    this.dome.matrix.makeScale(cam.far * 0.9, cam.far * 0.9, cam.far * 0.9).setPosition(cam.position);
    // bóng đổ bám theo người chơi, bắt vào lưới điểm ảnh của bản đồ bóng để không rung
    const L = this.lightDir, sun = this.sun;
    let fx = focus.x, fz = focus.z;
    if (this.shadowRange) { const step = (this.shadowRange * 2) / sun.shadow.mapSize.x * 4; fx = Math.round(fx / step) * step; fz = Math.round(fz / step) * step; }
    sun.target.position.set(fx, 0, fz);
    sun.position.set(fx + L.x * 300, L.y * 300, fz + L.z * 300);
  }
}
