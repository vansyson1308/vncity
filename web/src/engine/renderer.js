// Renderer WebGL2, hậu kỳ (MSAA + bloom + ACES + làm tối góc) và điều chỉnh độ phân giải động:
// khi khung hình vượt ngân sách thời gian thì giảm tỉ lệ điểm ảnh, khi dư thì tăng lại, để game luôn mượt.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uExposure: { value: 1 }, uVignette: { value: 0.32 }, uSat: { value: 1.08 }, uTint: { value: new THREE.Vector3(1, 1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uExposure, uVignette, uSat; uniform vec3 uTint; varying vec2 vUv;
    // ACES (Stephen Hill), cùng công thức với ACESFilmicToneMapping của three.js
    vec3 hnFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
    vec3 hnAces(vec3 c){
      const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      c *= uExposure / 0.6; c = I * c; c = hnFit(c); c = O * c; return clamp(c, 0.0, 1.0);
    }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb * uTint;
      c = hnAces(c);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, uSat);
      vec2 q = vUv - 0.5; c *= 1.0 - uVignette * smoothstep(0.25, 0.95, dot(q, q) * 2.2);
      c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      // nhiễu hạt rất nhẹ để xoá dải màu trên nền trời
      float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      gl_FragColor = vec4(c + (n - 0.5) / 255.0, 1.0);
    }`,
};

export class Renderer {
  constructor(canvas, quality, params) {
    this.q = quality;
    const r = this.r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: params.has('shot') });
    r.shadowMap.enabled = quality.shadow > 0; r.shadowMap.type = quality.name === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = false;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
    r.info.autoReset = false;
    this.maxDpr = Math.min(window.devicePixelRatio || 1, quality.dpr); this.dpr = this.maxDpr; this.minDpr = Math.min(quality.minDpr, this.maxDpr);
    this.fixedDpr = params.has('shot') || params.has('dpr'); if (params.has('dpr')) this.dpr = +params.get('dpr');
    this.frame = 0; this.avg = 16; this.cool = 0;
    this.scene = null; this.camera = null;
  }

  setup(scene, camera) {
    this.scene = scene; this.camera = camera; const r = this.r, q = this.q;
    r.setPixelRatio(this.dpr); r.setSize(innerWidth, innerHeight);
    if (q.post) {
      const size = r.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: q.msaa, depthBuffer: true });
      this.composer = new EffectComposer(r, rt);
      this.composer.addPass(new RenderPass(scene, camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.2, 0.55, 1.0);
      this.composer.addPass(this.bloom);
      this.final = new ShaderPass(FinalShader); this.composer.addPass(this.final);
    }
    addEventListener('resize', () => this.resize());
  }
  resize() {
    const r = this.r; this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    r.setPixelRatio(this.dpr); r.setSize(innerWidth, innerHeight);
    if (this.composer) { this.composer.setPixelRatio(this.dpr); this.composer.setSize(innerWidth, innerHeight); }
  }

  // exposure: phơi sáng theo giờ; night 0..1 để chỉnh bloom
  render(dtMs, exposure, night) {
    const r = this.r, q = this.q; this.frame++;
    if (q.shadow && (q.shadowEvery <= 1 || this.frame % q.shadowEvery === 0)) r.shadowMap.needsUpdate = true;
    r.info.reset();
    if (this.composer) {
      this.final.uniforms.uExposure.value = exposure;
      this.bloom.strength = 0.14 + night * 0.3; this.bloom.threshold = 1.0 - night * 0.25; this.bloom.radius = 0.45 + night * 0.2;
      this.composer.render();
    } else { r.toneMappingExposure = exposure; r.render(this.scene, this.camera); }
    this.adapt(dtMs);
  }

  // Độ phân giải động: giữ thời gian khung hình quanh 16,7 ms (60 Hz).
  adapt(dtMs) {
    if (this.fixedDpr || dtMs > 250) return;
    this.avg += (dtMs - this.avg) * 0.05; this.cool -= dtMs;
    if (this.cool > 0) return;
    let next = this.dpr;
    const vsync30 = this.avg > 31.5 && this.avg < 35.5; // màn hình khoá 30 Hz (tiết kiệm pin): hạ độ phân giải cũng không nhanh hơn
    if (vsync30) { this.cool = 1000; return; }
    if (this.avg > 21 && this.dpr > this.minDpr) next = Math.max(this.minDpr, this.dpr * (this.avg > 30 ? 0.8 : 0.9));
    else if (this.avg < 17.4 && this.dpr < this.maxDpr) next = Math.min(this.maxDpr, this.dpr * 1.06);
    if (Math.abs(next - this.dpr) > 0.02) { this.dpr = next; this.resize(); this.cool = 1500; this.avg = 17; } else this.cool = 500;
  }
}
