// Vật liệu dùng chung: mặt đất (texture mảng), đồ vật (màu đỉnh + bảng chữ biển hiệu), mặt nước.
import * as THREE from 'three';
import { SKY_GLSL, skyU } from '../engine/sky.js';
import { arrayTexture, groundTextures, GROUND_SCALE, DECAL_LAYER, DECAL_GRID, noiseTexture, waterNormals, leafTexture } from './textures.js';
import { facadeTexture, facadeMaterial } from './facades.js';
import { DETAIL_GLSL } from './detail.js';

export function buildMaterials(renderer, quality, atlas) {
  const aniso = Math.min(quality.aniso, renderer.capabilities.getMaxAnisotropy());
  const noise = noiseTexture(256);
  const M = { noise };

  // ----- mặt đất -----
  // Một texture mảng cho mọi chất liệu (nhựa, đá lát, gạch, bó vỉa, sơn...) và một lớp bảng đề can (nắp hố ga, miếng vá, mũi tên).
  // Shader thêm những thứ texture lặp không làm được: mảng thảm mới và mảng bạc màu trên mặt nhựa, vết ố loang, sơn kẻ đường mòn
  // lộ nhựa bên dưới, vòng đèn LED chạy theo kè Hồ Gươm (có từ 28/8/2026).
  const gt = groundTextures(quality.texSize), gtex = arrayTexture(gt.canvases, gt.masks, { aniso });
  M.ground = new THREE.MeshLambertMaterial({ color: 0xffffff });
  M.ground.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, skyU, { uGround: { value: gtex }, uNoise: { value: noise } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLayer; varying float vLayer; varying vec3 vWPos; varying vec3 vWN; varying vec3 vDec;')
      // đề can (lớp từ 32): thuộc tính pháp tuyến chở toạ độ trong ô đề can (x, z) và lớp nền (y); pháp tuyến thật luôn hướng lên
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vDec = vec3(0.0);
        if (aLayer > 31.5) { vDec = vec3(normal.x * 0.5 + 0.5, normal.z * 0.5 + 0.5, floor(normal.y * 127.0 + 0.5)); objectNormal = vec3(0.0, 1.0, 0.0); }`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvLayer = aLayer; vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = objectNormal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        precision highp sampler2DArray; uniform sampler2DArray uGround; uniform sampler2D uNoise; varying float vLayer; varying vec3 vWPos; varying vec3 vWN; varying vec3 vDec;
        ${SKY_GLSL}
        const float GS[${GROUND_SCALE.length}] = float[${GROUND_SCALE.length}](${GROUND_SCALE.map((v) => v.toFixed(5)).join(',')});`)
      .replace('#include <map_fragment>', `
        float gl = floor(vLayer + 0.5), dcell = gl - 32.0;
        float bl = dcell > -0.5 ? floor(vDec.z + 0.5) : gl;           // lớp nền (của chính mặt này, hoặc bên dưới đề can)
        vec3 gan = abs(vWN);
        vec2 guv = gan.y > 0.5 ? vWPos.xz : vec2(gan.x > gan.z ? vWPos.z : vWPos.x, vWPos.y);
        vec4 gtx = texture(uGround, vec3(guv * GS[int(bl)], bl));
        vec3 gn = texture(uNoise, vWPos.xz * 0.011).rgb, gn2 = texture(uNoise, vWPos.xz * 0.083).rgb;
        float gvar = 0.8 + 0.4 * (gn.r * 0.6 + gn2.g * 0.4);
        // mặt cứng ngoài phố: nhựa, đá lát, bó vỉa, gạch, rãnh biên
        float ghard = step(bl, 2.5) + step(10.5, bl) * step(bl, 14.5) + step(15.5, bl) * step(bl, 16.5);
        if (bl < 0.5) { // mặt nhựa: mảng mới thảm lại sẫm màu (mép rõ như miếng vá lớn), chỗ cũ bạc màu ngả nâu vì nắng bụi
          gtx.rgb *= 1.0 - 0.11 * smoothstep(0.49, 0.54, gn2.r * 0.6 + gn.g * 0.4);
          gtx.rgb = mix(gtx.rgb, gtx.rgb * vec3(1.13, 1.1, 1.04), smoothstep(0.35, 0.7, gn.r));
        }
        gtx.rgb *= mix(gvar, 1.0, step(5.5, bl) * step(bl, 7.5) * 0.6);
        // vết dầu, vết ố loang trên mặt nhựa và vỉa hè
        gtx.rgb = mix(gtx.rgb, gtx.rgb * vec3(0.62, 0.6, 0.56), smoothstep(0.66, 0.9, gn.b) * ghard * 0.5);
        // sơn kẻ đường đã mòn: tróc từng mảng, lộ mặt nhựa bên dưới
        if (gl > 5.5 && gl < 7.5) {
          vec3 gas = texture(uGround, vec3(vWPos.xz * GS[0], 0.0)).rgb * gvar;
          float gw = texture(uNoise, vWPos.xz * 0.31).g * 0.6 + gn2.r * 0.4;
          gtx.rgb = mix(gtx.rgb, gas, smoothstep(0.4, 0.58, gw) * 0.82);
        }
        if (dcell > -0.5) { // đề can: màu và hình lấy từ bảng đề can, chỗ trong suốt giữ nguyên nền
          vec2 dq = (vec2(mod(dcell, ${DECAL_GRID}.0), floor(dcell / ${DECAL_GRID}.0)) + clamp(vDec.xy, 0.02, 0.98)) / ${DECAL_GRID}.0;
          vec4 dtx = texture(uGround, vec3(dq, ${DECAL_LAYER}.0));
          float da = dtx.a;
          if (dcell > 4.5 && dcell < 6.5 || dcell > 8.5) da *= 1.0 - 0.8 * smoothstep(0.4, 0.58, texture(uNoise, vWPos.xz * 0.31).g * 0.6 + gn2.r * 0.4); // sơn mòn
          gtx.rgb = mix(gtx.rgb, dtx.rgb * mix(gvar, 1.0, 0.4), da);
        }
        diffuseColor.rgb *= gtx.rgb;
        float gwet = uWet * ghard;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (uLit > 0.01 && bl > 14.5 && bl < 15.5) { // kè Hồ Gươm: dải LED vàng ấm dưới mép kè, sáng hắt xuống mặt kè và bậc thềm
          float gy = vWPos.y - 0.06, gled = smoothstep(0.035, 0.012, abs(gy)) * 1.7 + step(gy, 0.0) * (exp(gy * 7.0) * 0.4 + step(0.5, gan.y) * 0.2);
          totalEmissiveRadiance += vec3(1.0, 0.66, 0.34) * gled * uLit;
        }`)
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
      Object.assign(sh.uniforms, skyU, { uWind: { value: 1 }, uNoise: { value: noise } });
      const det = !!opts.detail && !opts.instanced; // chất liệu chi tiết (detail.js): chỉ cho lưới đứng yên
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\nattribute vec4 aFx; varying vec4 vFx; varying vec3 vWPos; varying vec3 vWN; uniform float uTime; uniform float uWind;${det ? ' varying vec3 vOPos; varying vec3 vON;' : ''}${opts.instanced ? '\nattribute vec3 aTint; attribute vec3 aTint2;' : ''}`)
        .replace('#include <color_vertex>', `#include <color_vertex>\nvColor.rgb *= vColor.rgb;${opts.instanced ? '\nvColor.rgb = mix(vColor.rgb, vColor.rgb * aTint, step(0.75, color.a)); vColor.rgb = mix(vColor.rgb, vColor.rgb * aTint2, step(0.25, color.a) * (1.0 - step(0.75, color.a)));' : ''}\nvColor.a = 1.0;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>${det ? '\nvOPos = position; vON = normal;' : ''}
          { float sw = aFx.y; if (sw > 0.0) { vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
            transformed.x += sw * (sin(uTime * 1.25 + wp.x * 0.31 + wp.z * 0.27) * 0.07 + sin(uTime * 3.1 + wp.x * 1.9 + wp.y) * 0.022) * uWind;
            transformed.z += sw * (cos(uTime * 1.05 + wp.z * 0.33 + wp.x * 0.19) * 0.06 + sin(uTime * 2.7 + wp.z * 1.7) * 0.02) * uWind; } }`)
        .replace('#include <project_vertex>', `#include <project_vertex>\nvFx = aFx; vWPos = (modelMatrix * ${opts.instanced ? 'instanceMatrix * ' : ''}vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * ${opts.instanced ? 'mat3(instanceMatrix) * ' : ''}objectNormal);`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec4 vFx; varying vec3 vWPos; varying vec3 vWN;\n${SKY_GLSL}${det ? '\nvarying vec3 vOPos; varying vec3 vON; uniform sampler2D uNoise;\n' + DETAIL_GLSL : ''}`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>${opts.cut ? `
          if (uCut.w > 0.0) { vec3 ab = uCut.xyz - cameraPosition; float ct = dot(vWPos - cameraPosition, ab) / dot(ab, ab);
            if (ct > 0.04 && ct < 0.88) { float cd = length(vWPos - (cameraPosition + ab * ct));
              if (1.0 - smoothstep(uCut.w * 0.5, uCut.w, cd) > hash12(gl_FragCoord.xy) * 0.94 + 0.03) discard; } }` : ''}`)
        .replace('#include <color_fragment>', `#include <color_fragment>${det ? '\n{ float mid = floor(vFx.w * 15.9375 + 0.5); if (mid > 0.5) diffuseColor.rgb = detailColor(mid, diffuseColor.rgb, vOPos, normalize(vON), uNoise); }' : ''}`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vFx.x * (${opts.alwaysGlow ? '1.0' : 'uLit'}) * 2.6;${opts.flood ? `\ntotalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.8, 0.56) * uLit * ${opts.flood.toFixed(2)} * (1.0 - 0.45 * smoothstep(2.0, 30.0, vWPos.y)) * (0.75 + 0.25 * abs(normalize(vWN).y));` : ''}${opts.alphaTest ? '\ntotalEmissiveRadiance += diffuseColor.rgb * uSunCol * 0.05 * max(dot(normalize(vWN), -uSunDir) * 0.5 + 0.5, 0.0);' : ''}`)
        .replace('#include <opaque_fragment>', `
          if (vFx.z > 0.02) { vec3 V = normalize(vWPos - cameraPosition); vec3 N = normalize(vWN); vec3 Rf = reflect(V, N);
            float fr = 0.05 + 0.95 * pow(1.0 - max(dot(-V, N), 0.0), 4.0);
            outgoingLight += skyColor(Rf) * fr * vFx.z * 0.55 + uSunCol * pow(max(dot(Rf, uSunDir), 0.0), 40.0) * vFx.z * 0.25; }
          #include <opaque_fragment>`);
    };
    return mat;
  };
  // cut: vật che giữa camera và nhân vật (cột cổng, thân cây, mái hiên) bị đục lỗ lấm tấm để vẫn thấy nhân vật
  M.prop = M.makeProp({ map: atlas, detail: true, cut: true });
  M.propSolid = M.makeProp({ map: atlas }); // cho xe của người chơi: không bao giờ bị đục lỗ
  // công trình biểu tượng: có chất liệu chi tiết, ban đêm được đèn pha hắt sáng như ngoài đời
  M.landmark = M.makeProp({ side: THREE.DoubleSide, detail: true, flood: 0.34, cut: true });
  // tán lá: thẻ lá trong suốt cắt theo alpha, hai mặt, đung đưa theo gió
  M.leaf = M.makeProp({ map: leafTexture(quality.texSize), alphaTest: 0.42, side: THREE.DoubleSide, cut: true });

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
      // Đèn phố bên kia bờ soi bóng xuống nước. Không dựng ảnh phản chiếu thật (phải vẽ cảnh hai lần): coi như quanh chân trời
      // có một dải đèn (180 cột, cột sáng cột tắt, đa số vàng sodium, ít trắng LED, hiếm hoi biển đỏ); sóng làm lệch tia phản
      // xạ nên mỗi cột đèn tự kéo thành một vệt dài đứt quãng về phía người nhìn, đúng như đèn bờ hồ ngoài đời.
      // Sát chân người nhìn thì tắt dần (ở đó ngoài đời là bóng của bờ kè, hàng cây ngay trước mặt chứ không phải đèn bờ bên kia).
      vec3 shoreLights(vec2 dir, float ry) { // dir: hướng ngang của tia phản xạ; ry: độ ngẩng của tia sau khi sóng làm lệch
        float a = atan(dir.y, dir.x) * 28.6479, ci = floor(a), h = hash12(vec2(ci, 3.7)), b = fract(h * 17.0);
        float w = smoothstep(0.3, 0.03, abs(fract(a) - 0.5 + (b - 0.5) * 0.3)) * step(0.52, h);
        float band = smoothstep(0.0, 0.015, ry) * smoothstep(0.17, 0.02, ry);
        vec3 col = mix(vec3(1.0, 0.6, 0.26), vec3(0.85, 0.93, 1.0), step(0.84, h));
        col = mix(col, vec3(1.0, 0.16, 0.1), step(0.95, h));
        return col * (w * band * (0.12 + 0.88 * b * b));
      }
      void main(){
        vec2 uv = vWPos.xz;
        vec3 n1 = texture2D(uNormal, uv * 0.11 + uTime * vec2(0.012, 0.007)).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(uNormal, uv * 0.37 - uTime * vec2(0.016, 0.021)).xyz * 2.0 - 1.0;
        float dist = length(vWPos - cameraPosition);
        vec3 N = normalize(vec3((n1.x + n2.x * 0.6) * 0.5, 3.0 + dist * 0.014, (n1.y + n2.y * 0.6) * 0.5)); // hồ lặng: sóng lăn tăn rất nhẹ
        vec3 V = normalize(cameraPosition - vWPos);
        float fr = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 Rf = reflect(-V, N); Rf.y = abs(Rf.y);
        // nước hồ đục: màu nước theo ánh trời lúc đó, cộng một chút nắng xuyên; mặt nước phản chiếu trời theo góc nhìn
        vec3 base = vCol.rgb * vCol.rgb * (uHemi * 0.9 + uSunCol * max(uSunDir.y, 0.0) * 0.22);
        vec3 c = mix(base, skyColor(Rf), fr * 0.9);
        c += uSunCol * pow(max(dot(Rf, uSunDir), 0.0), 420.0) * 2.5 * uAir.z;
        c += uGlow * pow(max(dot(Rf, uSunDir), 0.0), 24.0) * 0.6 * fr;
        // cột đèn giữ đúng phương ngang của tia nhìn (chỉ lệch nhẹ theo sóng) nên vệt sáng chạy thẳng về phía người nhìn, không vỡ thành hoa giấy
        if (uLit > 0.01) c += shoreLights(-V.xz + N.xz * 0.35, Rf.y) * (uLit * fr * 0.6 * smoothstep(10.0, 45.0, dist));
        float fx = fogDensity * vFogDepth, ff = 1.0 - exp(-fx * fx - fx * uAir.x);
        gl_FragColor = vec4(mix(c, hazeColor(-V), ff), 1.0);
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
