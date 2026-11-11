// Vật liệu dùng chung: mặt đất (texture mảng), đồ vật (màu đỉnh + bảng chữ biển hiệu), mặt nước.
import * as THREE from 'three';
import { SKY_GLSL, skyU } from '../engine/sky.js';
import { arrayTexture, groundTextures, GROUND_SCALE, noiseTexture, waterNormals, leafTexture } from './textures.js';
import { facadeTexture, facadeMaterial } from './facades.js';

export function buildMaterials(renderer, quality, atlas) {
  const aniso = Math.min(quality.aniso, renderer.capabilities.getMaxAnisotropy());
  const noise = noiseTexture(256);
  const M = { noise };

  // ----- mặt đất -----
  const gtex = arrayTexture(groundTextures(quality.texSize), null, { aniso });
  M.ground = new THREE.MeshLambertMaterial({ color: 0xffffff });
  M.ground.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, skyU, { uGround: { value: gtex }, uNoise: { value: noise } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLayer; varying float vLayer; varying vec3 vWPos; varying vec3 vWN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvLayer = aLayer; vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = objectNormal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        precision highp sampler2DArray; uniform sampler2DArray uGround; uniform sampler2D uNoise; varying float vLayer; varying vec3 vWPos; varying vec3 vWN;
        ${SKY_GLSL}
        const float GS[${GROUND_SCALE.length}] = float[${GROUND_SCALE.length}](${GROUND_SCALE.map((v) => v.toFixed(5)).join(',')});`)
      .replace('#include <map_fragment>', `
        float gl = floor(vLayer + 0.5);
        vec2 guv = abs(vWN.y) > 0.5 ? vWPos.xz : vec2(vWPos.x + vWPos.z, vWPos.y);
        vec4 gtx = texture(uGround, vec3(guv * GS[int(gl)], gl));
        vec3 gn = texture(uNoise, vWPos.xz * 0.011).rgb, gn2 = texture(uNoise, vWPos.xz * 0.083).rgb;
        float gvar = 0.8 + 0.4 * (gn.r * 0.6 + gn2.g * 0.4);
        // vết dầu, vết ố loang trên mặt nhựa và vỉa hè
        gtx.rgb *= mix(gvar, 1.0, step(5.5, gl) * step(gl, 7.5) * 0.6);
        gtx.rgb = mix(gtx.rgb, gtx.rgb * vec3(0.62, 0.6, 0.56), smoothstep(0.66, 0.9, gn.b) * step(gl, 2.5) * 0.5);
        diffuseColor.rgb *= gtx.rgb;
        float gwet = uWet * step(gl, 2.5);`)
      .replace('#include <opaque_fragment>', `
        if (gwet > 0.01) { vec3 V = normalize(vWPos - cameraPosition); vec3 Rf = reflect(V, vec3(0.0, 1.0, 0.0));
          float fr = 0.04 + 0.96 * pow(1.0 - max(-V.y, 0.0), 5.0);
          outgoingLight = mix(outgoingLight * (1.0 - 0.35 * gwet), skyColor(Rf), fr * gwet * 0.7); }
        #include <opaque_fragment>`);
  };

  // ----- nhà -----
  M.facadeTex = facadeTexture(quality.texSize, aniso);
  M.facade = facadeMaterial(M.facadeTex, noise);

  // ----- đồ vật (cây, đèn, biển, xe đỗ, công trình dựng tay) -----
  M.makeProp = (opts = {}) => {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, map: opts.map || null, side: opts.side || THREE.FrontSide, alphaTest: opts.alphaTest || 0 });
    if (opts.alphaTest && quality.msaa) mat.alphaToCoverage = true;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, skyU, { uWind: { value: 1 } });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\nattribute vec4 aFx; varying vec4 vFx; varying vec3 vWPos; varying vec3 vWN; uniform float uTime; uniform float uWind;${opts.instanced ? '\nattribute vec3 aTint; attribute vec3 aTint2;' : ''}`)
        .replace('#include <color_vertex>', `#include <color_vertex>\nvColor.rgb *= vColor.rgb;${opts.instanced ? '\nvColor.rgb = mix(vColor.rgb, vColor.rgb * aTint, step(0.75, color.a)); vColor.rgb = mix(vColor.rgb, vColor.rgb * aTint2, step(0.25, color.a) * (1.0 - step(0.75, color.a)));' : ''}\nvColor.a = 1.0;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          { float sw = aFx.y; if (sw > 0.0) { vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
            transformed.x += sw * (sin(uTime * 1.25 + wp.x * 0.31 + wp.z * 0.27) * 0.07 + sin(uTime * 3.1 + wp.x * 1.9 + wp.y) * 0.022) * uWind;
            transformed.z += sw * (cos(uTime * 1.05 + wp.z * 0.33 + wp.x * 0.19) * 0.06 + sin(uTime * 2.7 + wp.z * 1.7) * 0.02) * uWind; } }`)
        .replace('#include <project_vertex>', `#include <project_vertex>\nvFx = aFx; vWPos = (modelMatrix * ${opts.instanced ? 'instanceMatrix * ' : ''}vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * ${opts.instanced ? 'mat3(instanceMatrix) * ' : ''}objectNormal);`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec4 vFx; varying vec3 vWPos; varying vec3 vWN;\n${SKY_GLSL}`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vFx.x * (${opts.alwaysGlow ? '1.0' : 'uLit'}) * 2.6;${opts.alphaTest ? '\ntotalEmissiveRadiance += diffuseColor.rgb * uSunCol * 0.05 * max(dot(normalize(vWN), -uSunDir) * 0.5 + 0.5, 0.0);' : ''}`)
        .replace('#include <opaque_fragment>', `
          if (vFx.z > 0.02) { vec3 V = normalize(vWPos - cameraPosition); vec3 N = normalize(vWN); vec3 Rf = reflect(V, N);
            float fr = 0.05 + 0.95 * pow(1.0 - max(dot(-V, N), 0.0), 4.0);
            outgoingLight += skyColor(Rf) * fr * vFx.z * 0.55 + uSunCol * pow(max(dot(Rf, uSunDir), 0.0), 40.0) * vFx.z * 0.25; }
          #include <opaque_fragment>`);
    };
    return mat;
  };
  M.prop = M.makeProp({ map: atlas });
  M.landmark = M.makeProp({ side: THREE.DoubleSide });
  // tán lá: thẻ lá trong suốt cắt theo alpha, hai mặt, đung đưa theo gió
  M.leaf = M.makeProp({ map: leafTexture(quality.texSize), alphaTest: 0.42, side: THREE.DoubleSide });

  // ----- mặt nước -----
  const wn = waterNormals(256);
  M.water = new THREE.ShaderMaterial({
    uniforms: { ...skyU, uNormal: { value: wn }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0.001 }, uHemi: { value: new THREE.Color(1, 1, 1) } },
    fog: true,
    vertexShader: /* glsl */`
      attribute vec4 aCol; varying vec4 vCol; varying vec3 vWPos; varying float vFogDepth;
      void main(){ vCol = aCol; vec4 wp = modelMatrix * vec4(position, 1.0); vWPos = wp.xyz; vec4 mv = viewMatrix * wp; vFogDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uNormal; uniform vec3 fogColor; uniform float fogDensity; uniform vec3 uHemi;
      varying vec4 vCol; varying vec3 vWPos; varying float vFogDepth;
      ${SKY_GLSL}
      void main(){
        vec2 uv = vWPos.xz;
        vec3 n1 = texture2D(uNormal, uv * 0.11 + uTime * vec2(0.012, 0.007)).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(uNormal, uv * 0.37 - uTime * vec2(0.016, 0.021)).xyz * 2.0 - 1.0;
        float dist = length(vWPos - cameraPosition);
        vec3 N = normalize(vec3((n1.x + n2.x * 0.6) * 0.5, 2.2 + dist * 0.012, (n1.y + n2.y * 0.6) * 0.5));
        vec3 V = normalize(cameraPosition - vWPos);
        float fr = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 Rf = reflect(-V, N); Rf.y = abs(Rf.y);
        vec3 base = vCol.rgb * vCol.rgb * (uHemi * 0.9 + uSunCol * max(uSunDir.y, 0.0) * 0.22);
        vec3 c = mix(base, skyColor(Rf), fr * 0.9);
        c += uSunCol * pow(max(dot(Rf, uSunDir), 0.0), 420.0) * 2.5;
        c += vec3(1.0, 0.82, 0.55) * uLit * 0.02 * (0.5 + 0.5 * n2.x); // ánh đèn phố hắt xuống hồ ban đêm
        float ff = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
        gl_FragColor = vec4(mix(c, fogColor, ff), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return M;
}

// Lưới từ gói dữ liệu của worker (G.pack()).
export function propGeometry(p) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(p.nrm, 3, true));
  g.setAttribute('color', new THREE.BufferAttribute(p.col, 4, true));
  g.setAttribute('uv', new THREE.BufferAttribute(p.uv, 2));
  g.setAttribute('aFx', new THREE.BufferAttribute(p.fx, 4, true));
  g.setIndex(new THREE.BufferAttribute(p.idx, 1));
  const b = p.box; g.boundingBox = new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5]));
  g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
  return g;
}
