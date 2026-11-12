// Bầu trời, mặt trời, trăng, lớp mù và ánh sáng theo giờ trong ngày của Hà Nội.
// Không dùng bản đồ môi trường: kính, mặt hồ, nước sơn xe tự tính phản chiếu trời từ cùng bộ uniform (SKY_GLSL),
// nên đổi giờ không tốn một khung hình nào để dựng lại cubemap.
//
// Không khí (art bible mục 7): trời Hà Nội là trời MÙ. Ban ngày xám trắng, mặt trời như cái đĩa mờ, bóng đổ nhạt, phố xa
// bạc dần vào màu trời. Ban đêm thành phố nằm dưới một quầng sáng nâu xám ấm (đèn phố hắt lên lớp mù), gần như không có sao.
// Vì vậy sương ở đây không có một màu cố định: mọi điểm ảnh ở xa tan vào ĐÚNG màu trời phía sau nó (hazeColor), nên mép
// vùng dựng hình không bao giờ lộ ra thành một dải đen hay một bức tường khác màu trời.
import * as THREE from 'three';
import { clamp, lerp, smooth } from '../core/util.js';

// Uniform dùng chung cho mọi vật liệu.
export const skyU = {
  uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGroundCol: { value: new THREE.Color() },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uMoonDir: { value: new THREE.Vector3(-0.4, 0.7, 0.5).normalize() },
  uNight: { value: 0 }, uTime: { value: 0 }, uClouds: { value: 0.45 }, uWet: { value: 0 }, uLit: { value: 0 },
  // lỗ nhìn xuyên vật che: (x, y, z) ngực nhân vật và bán kính; vật nằm chắn giữa camera và nhân vật bị đục lỗ lấm tấm
  uCut: { value: new THREE.Vector4(0, -1000, 0, 0) },
  // quầng tán xạ quanh mặt trời trong lớp mù (màu × cường độ)
  uGlow: { value: new THREE.Color(0, 0, 0) },
  // không khí: x = phần mù tuyến tính (phố xa bạc màu sớm), y = số mũ dải chân trời (lớn = dải mù dày),
  // z = độ rõ đĩa mặt trời, w = độ tương phản của mây
  uAir: { value: new THREE.Vector4(0.3, 0.6, 1, 0.8) },
};

// Màu trời theo hướng nhìn, bản rút gọn (không mây, không sao) cho phản chiếu, và màu lớp mù cho sương.
export const SKY_GLSL = /* glsl */`
#define HN_SKY
uniform vec3 uZenith, uHorizon, uGroundCol, uSunDir, uSunCol, uMoonDir, uGlow;
uniform float uNight, uTime, uClouds, uWet, uLit;
uniform vec4 uCut, uAir;
// nền trời: dải mù sáng ở chân trời chuyển dần lên đỉnh trời, cộng quầng sáng quanh mặt trời
vec3 skyBase(vec3 d) {
  vec3 c = mix(uHorizon, uZenith, pow(clamp(d.y, 0.0, 1.0), uAir.y));
  float s = max(dot(d, uSunDir), 0.0), s2 = s * s, s8 = s2 * s2; s8 *= s8;
  return c + uGlow * (s8 * s8 * s8 * 0.55 + s8 * 0.28 + s2 * 0.1);
}
// màu lớp mù theo hướng nhìn: vật ở xa tan vào đúng màu trời phía sau nó
vec3 hazeColor(vec3 d) { return skyBase(d); }
vec3 skyColor(vec3 d) { return mix(skyBase(d), uGroundCol, smoothstep(0.0, -0.12, d.y)); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`;

// ----- Sương kiểu Hà Nội cho MỌI vật liệu: thay bốn đoạn mã sương của three.js -----
// 1) Hình dạng: exp(-(ρd)² - λρd). Phần bình phương che mép vùng dựng hình như cũ; phần tuyến tính λ thêm phối cảnh không khí
//    ngay từ vài chục mét (phố xa bạc màu) mà không phải tăng mật độ.
// 2) Màu: vật liệu nào có SKY_GLSL thì dùng màu trời theo hướng nhìn (hazeColor); vật liệu khác dùng fogColor (= màu chân trời).
THREE.ShaderChunk.fog_pars_vertex = /* glsl */`
#ifdef USE_FOG
  varying float vFogDepth; varying vec3 vFogDir;
#endif`;
THREE.ShaderChunk.fog_vertex = /* glsl */`
#ifdef USE_FOG
  vFogDepth = - mvPosition.z; vFogDir = (vec4(mvPosition.xyz, 0.0) * viewMatrix).xyz;
#endif`;
THREE.ShaderChunk.fog_pars_fragment = /* glsl */`
#ifdef USE_FOG
  uniform vec3 fogColor; varying float vFogDepth; varying vec3 vFogDir;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear; uniform float fogFar;
  #endif
#endif`;
THREE.ShaderChunk.fog_fragment = /* glsl */`
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogX = fogDensity * vFogDepth;
    #ifdef HN_SKY
      float fogFactor = 1.0 - exp(-fogX * fogX - fogX * uAir.x);
      vec3 fogTint = hazeColor(normalize(vFogDir));
      // three.js pha sương SAU bước ánh xạ tông và mã hoá màu. Khi vẽ thẳng ra màn hình (mức Nhẹ, không hậu kỳ) màu mù phải đi
      // qua đúng hai bước đó như vòm trời, nếu không vật ở xa sẽ tan vào một màu tối hơn trời (ban đêm thành đen).
      #ifdef TONE_MAPPING
        fogTint = toneMapping(fogTint);
      #endif
      fogTint = linearToOutputTexel(vec4(fogTint, 1.0)).rgb;
    #else
      float fogFactor = 1.0 - exp(-fogX * fogX - fogX * 0.3);
      vec3 fogTint = fogColor;
    #endif
  #else
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth); vec3 fogTint = fogColor;
  #endif
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogTint, fogFactor);
#endif`;

// Khoá màu theo góc cao mặt trời (độ). Đêm: quầng sáng đô thị nâu xám ấm, không đen. Chạng vạng đi qua cam hồng (#F2A65A)
// rồi tím xám (#8E7F9B) trong chừng 20 đến 25 phút game như ngoài đời. Ngày: màu trời trong; lớp mù của "thời tiết" phủ lên sau.
const KEYS = [
  { el: -18, zen: 0x25232b, hor: 0x4d423c, sun: 0x000000, si: 0, hemi: 0x6c7190, hg: 0x5e5146, hi: 2.3, exp: 1.3 },
  { el: -10, zen: 0x27252e, hor: 0x51453f, sun: 0x000000, si: 0, hemi: 0x6c7190, hg: 0x5e5146, hi: 2.3, exp: 1.28 },
  { el: -5.5, zen: 0x343852, hor: 0x7d7088, sun: 0x000000, si: 0, hemi: 0x7079a0, hg: 0x675a52, hi: 2.2, exp: 1.2 },
  { el: -1.5, zen: 0x4e608c, hor: 0xe29c62, sun: 0xff6a34, si: 0.3, hemi: 0x7d8cb2, hg: 0x86705c, hi: 2.0, exp: 1.1 },
  { el: 4, zen: 0x5c84be, hor: 0xf0bc8c, sun: 0xffa35c, si: 1.9, hemi: 0x8fa6cf, hg: 0x9a8a74, hi: 1.9, exp: 1.02 },
  { el: 12, zen: 0x5788cc, hor: 0xe6d2b4, sun: 0xffd09a, si: 2.6, hemi: 0xa9c0e0, hg: 0xa69a86, hi: 1.95, exp: 0.97 },
  { el: 30, zen: 0x4f8bd6, hor: 0xcfdbe2, sun: 0xfff0d8, si: 3.0, hemi: 0xbcd2ee, hg: 0xb0a694, hi: 1.9, exp: 0.92 },
  { el: 65, zen: 0x4a86d4, hor: 0xcad8e2, sun: 0xfff6e8, si: 3.2, hemi: 0xc4d8f2, hg: 0xb4aa98, hi: 1.85, exp: 0.9 },
];

// Thời tiết theo mùa (art bible mục 7). haze: độ mù làm bạc màu trời; sun, hemi: hệ số nắng và ánh trời (mù thì nắng yếu,
// trời sáng đều, bóng nhạt); fog: hệ số mật độ sương (không hạ nhiều: sương còn phải che mép vùng dựng hình); lin: phần mù
// tuyến tính; tint: màu lớp mù; warm: nắng ngả vàng mật; clouds: lượng mây; wet: mặt đường ướt bóng.
// Mặc định là "mu": game lấy mốc cuối năm 2026, trời đầu đông xám trắng.
export const WEATHER = {
  mu: { haze: 0.72, sun: 0.6, hemi: 1.2, fog: 1.0, lin: 0.24, tint: 0xc9cccf, warm: 0, clouds: 0.5, wet: 0 },   // đông: mù bụi, trời xám trắng
  thu: { haze: 0.12, sun: 1.0, hemi: 1.0, fog: 0.92, lin: 0.1, tint: 0xd4dde4, warm: 0.5, clouds: 0.38, wet: 0 }, // thu: trong nhất năm, nắng vàng mật
  he: { haze: 0.34, sun: 1.12, hemi: 0.95, fog: 0.95, lin: 0.16, tint: 0xdde6ea, warm: 0, clouds: 0.55, wet: 0 },  // hè: nắng gắt, trời xanh nhạt hơi trắng
  nom: { haze: 0.95, sun: 0.2, hemi: 1.5, fog: 1.1, lin: 0.55, tint: 0xbec2c4, warm: 0, clouds: 0.9, wet: 0.85 }, // xuân: mưa phùn, nồm, ánh sáng phẳng
};

const cA = new THREE.Color(), cB = new THREE.Color(), cT = new THREE.Color();
const mixHex = (out, a, b, t) => out.copy(cA.setHex(a)).lerp(cB.setHex(b), t);
const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
// kéo màu c về màu lớp mù (giữ nguyên độ sáng của c nhân với gain)
const hazeTo = (c, tint, k, gain = 1) => { const g = (lum(c) * gain) / Math.max(1e-4, lum(tint)); return c.lerp(cT.copy(tint).multiplyScalar(g), k); };

export class Sky {
  constructor(scene, camera, quality) {
    this.scene = scene; this.camera = camera;
    this.hours = 17.2; this.speed = 1 / 60; // một phút game mỗi giây thật
    this.exposure = 1; this.night = 0; this.elevation = 0;
    scene.fog = new THREE.FogExp2(0xc6d2da, 0.0016);
    this.fogDensity = quality.fog;
    let w = 'mu'; try { w = new URLSearchParams(location.search).get('weather') || w; } catch { /* worker, node */ }
    this.weatherName = WEATHER[w] ? w : 'mu'; this.weather = WEATHER[this.weatherName]; this.hazeTint = new THREE.Color(this.weather.tint);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    if (quality.shadow) {
      this.sun.castShadow = true; this.sun.shadow.mapSize.set(quality.shadow, quality.shadow);
      const R = quality.shadowRange; Object.assign(this.sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 10, far: 700 });
      this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.06; this.shadowRange = R;
      this.sun.shadow.radius = 2.2; // mép bóng mềm: nắng qua lớp mù không sắc cạnh
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
          vec3 c = skyBase(d);
          float s = max(dot(d, uSunDir), 0.0);
          // đĩa mặt trời: trong mù chỉ là cái đĩa mờ có quầng, chìm vào lớp mù trước khi chạm chân trời
          float disc = smoothstep(0.99955, 0.9998, s);
          c += uSunCol * (disc * 5.0 + pow(s, 600.0) * 1.2) * uAir.z;
          // trăng mờ sau lớp mù
          float m = max(dot(d, uMoonDir), 0.0);
          c += vec3(0.92, 0.9, 0.82) * (smoothstep(0.99975, 0.99985, m) * 0.9 + pow(m, 300.0) * 0.1 + pow(m, 24.0) * 0.012) * uNight;
          // sao: trời Hà Nội gần như không thấy sao, chỉ vài chấm lẻ ở cao trên đỉnh đầu
          vec2 sp = d.xz / (abs(d.y) + 0.6) * 46.0, si = floor(sp);
          float sh = hash12(si);
          if (sh > 0.9955 && d.y > 0.3) {
            vec2 so = vec2(hash12(si + 7.3), hash12(si + 3.1)) * 0.6 + 0.2;
            float tw = 0.6 + 0.4 * sin(uTime * 1.7 + sh * 900.0);
            c += vec3(0.8, 0.82, 0.9) * smoothstep(0.075, 0.0, length(fract(sp) - so)) * smoothstep(0.3, 0.62, d.y) * tw * 0.22 * uNight;
          }
          // mây tầng cao trôi chậm; ban đêm mây bắt sáng đèn thành phố từ dưới hắt lên
          if (d.y > 0.01) {
            vec2 cp = d.xz / (d.y + 0.12) * 1.4 + vec2(uTime * 0.006, uTime * 0.002);
            float cl = smoothstep(1.0 - uClouds, 1.0 - uClouds + 0.38, fbm(cp));
            float lit = 0.55 + 0.45 * fbm(cp * 2.3 + 4.0);
            vec3 cc = mix(uHorizon * 0.9, uSunCol * 0.22 + uZenith * 0.45 + uHorizon * 0.5, lit) + uGlow * pow(s, 6.0) * 0.8;
            cc = mix(cc, uHorizon * (0.72 + 0.3 * lit), uNight);
            c = mix(c, cc, cl * smoothstep(0.01, 0.16, d.y) * uAir.w);
          }
          // phố xa ngoài tầm dựng hình: một dải mái nhà mờ trong mù sát chân trời, ban đêm lấm tấm đèn (chỉ tính trong dải hẹp đó)
          if (d.y > -0.035 && d.y < 0.04) {
            vec2 hd = normalize(d.xz + vec2(1e-5, 0.0));
            float sk = 0.004 + 0.016 * vnoise(hd * 11.0 + 3.0) + 0.012 * vnoise(hd * 37.0 + 9.0);
            float band = smoothstep(sk, sk - 0.005, d.y) * smoothstep(-0.03, -0.004, d.y);
            c = mix(c, c * mix(0.86, 0.8, uNight), band);
            vec2 lc = vec2(floor(hd.x * 420.0) + floor(hd.y * 420.0) * 57.0, floor(d.y * 700.0));
            float lh = hash12(lc);
            float lamp = step(0.86, lh) * smoothstep(sk + 0.004, sk - 0.004, d.y) * smoothstep(-0.012, -0.002, d.y) * (0.35 + 0.65 * vnoise(hd * 23.0 + 5.0));
            vec3 lcol = mix(vec3(1.0, 0.62, 0.3), vec3(0.85, 0.92, 1.0), step(0.93, lh));
            c += lcol * lamp * (0.35 + 0.25 * sin(uTime * 0.9 + lh * 70.0)) * 0.5 * uLit;
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

  // Đổi thời tiết (tên trong WEATHER). Cũng chọn được bằng tham số địa chỉ ?weather=thu|he|nom|mu.
  setWeather(name) { if (!WEATHER[name]) return false; this.weatherName = name; this.weather = WEATHER[name]; this.hazeTint.setHex(this.weather.tint); this.apply(); return true; }

  // Góc cao và phương vị mặt trời: mọc 5:45 ở hướng đông, lặn 18:15 ở hướng tây, đỉnh 62°.
  sunAngles(h) {
    const f = (h - 5.75) / 12.5;
    if (f >= 0 && f <= 1) return { el: Math.sin(Math.PI * f) * 62, az: 82 + 196 * f };
    const g = f < 0 ? f + 24 / 12.5 - 1 : f - 1; // phần đêm 0..0.92
    return { el: -Math.sin(Math.PI * clamp(g / 0.92, 0, 1)) * 40, az: 278 + 164 * (g / 0.92) };
  }

  apply() {
    const { el, az } = this.sunAngles(this.hours), W = this.weather, U = skyU;
    this.elevation = el;
    let i = 0; while (i < KEYS.length - 2 && el > KEYS[i + 1].el) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = clamp((el - a.el) / (b.el - a.el), 0, 1);
    const zen = mixHex(U.uZenith.value, a.zen, b.zen, t), hor = mixHex(U.uHorizon.value, a.hor, b.hor, t);
    mixHex(this.sun.color, a.sun, b.sun, t);
    const night = 1 - smooth(-7, 1, el); this.night = night; U.uNight.value = night;
    // đèn đường và cửa sổ bật lúc chạng vạng
    U.uLit.value = 1 - smooth(-3, 6, el);

    // ----- lớp mù của thời tiết: ban ngày làm trời bạc trắng; lúc chạng vạng vẫn để sắc cam hồng, tím xám đi qua -----
    const day = smooth(-5, 12, el), hz = W.haze * (0.25 + 0.75 * day), tint = this.hazeTint;
    hazeTo(hor, tint, hz * 0.8);
    zen.lerp(cA.copy(hor), hz * 0.32); hazeTo(zen, tint, hz * 0.4, 1 + 0.25 * hz * day); // trời mù: đỉnh trời cũng sáng và bạc
    if (W.warm) this.sun.color.lerp(cA.setHex(0xffd9a0), W.warm * smooth(2, 20, el) * (1 - smooth(35, 60, el) * 0.6));
    const sunI = lerp(a.si, b.si, t) * smooth(-1.2, 1.5, el) * lerp(1, W.sun, day);
    U.uAir.value.set(W.lin, lerp(0.42, 0.78, hz), lerp(1, 0.5, hz) * lerp(1, smooth(0.5, 9, el), W.haze), lerp(0.85, 0.5, hz));
    U.uClouds.value = W.clouds; U.uWet.value = W.wet;

    const er = THREE.MathUtils.degToRad, ar = er(az), e3 = er(Math.max(el, 3)), e0 = er(el);
    if (el < -1.2) { // đêm: ánh trăng yếu qua lớp mù thay mặt trời, để vật vẫn có khối
      this.lightDir = U.uMoonDir.value; U.uSunDir.value.copy(U.uMoonDir.value);
      this.sun.color.setHex(0xa3aac6); this.sun.intensity = 0.5 * smooth(-1.2, -8, el);
      U.uSunCol.value.setRGB(0, 0, 0); U.uGlow.value.setRGB(0, 0, 0);
    } else {
      this.sun.intensity = sunI;
      U.uSunCol.value.copy(this.sun.color).multiplyScalar(sunI);
      U.uGlow.value.copy(this.sun.color).multiplyScalar(lerp(a.si, b.si, t) * smooth(-1.2, 1.5, el) * (0.16 + 0.3 * hz));
      U.uSunDir.value.set(Math.sin(ar) * Math.cos(e0), Math.sin(e0), -Math.cos(ar) * Math.cos(e0));
      this.lightDir = (this._ld || (this._ld = new THREE.Vector3())).set(Math.sin(ar) * Math.cos(e3), Math.sin(e3), -Math.cos(ar) * Math.cos(e3));
    }
    mixHex(this.hemi.color, a.hemi, b.hemi, t); mixHex(this.hemi.groundColor, a.hg, b.hg, t);
    hazeTo(this.hemi.color, tint, hz * 0.6);
    // nắng thấp xuyên lớp mù nhuộm cả vòm trời: ánh trời lúc sáng sớm và chiều muộn ngả ấm theo màu nắng
    this.hemi.color.lerp(cA.copy(this.sun.color).multiplyScalar(lum(this.hemi.color) / Math.max(0.05, lum(this.sun.color))), hz * 0.5 * smooth(-1, 5, el) * (1 - smooth(14, 30, el)));
    this.hemi.intensity = lerp(a.hi, b.hi, t) * lerp(1, W.hemi, day);
    // sương: màu dự phòng (vật liệu không có SKY_GLSL) là màu chân trời; phản chiếu nhìn xuống đất thì tối hơn một chút
    this.scene.fog.color.copy(hor); U.uGroundCol.value.copy(hor).multiplyScalar(0.82);
    this.scene.fog.density = this.fogDensity * W.fog * (1 + night * 0.15);
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
