// Chất liệu chi tiết cho mô hình dựng thủ tục: gạch, đá, vữa vôi cũ, ngói, gỗ, thép gỉ, bê tông, đá rêu, gạch lát, sơn son.
// Hoa văn tính ngay trong fragment shader từ vị trí và pháp tuyến của điểm (hệ toạ độ của mô hình), nên:
//   - không cần UV, không cần ảnh: thêm chi tiết mà dung lượng tải không tăng một byte;
//   - mô hình chỉ cần gọi g.mat(MAT.brick) trước khi dựng khối (core/geo.js);
//   - ở xa hoa văn tự hoà về màu trung bình (dựa trên đạo hàm màn hình) nên không nhấp nháy.
// Toạ độ mặt: u chạy ngang dọc theo tường (trục x hoặc z, tuỳ tường quay hướng nào), v chạy lên theo mặt
// (chia cho sin góc dốc để hàng ngói đều nhau trên mái dốc). Mặt nằm ngang dùng (x, z).
export const DETAIL_GLSL = /* glsl */`
vec3 detailColor(float mid, vec3 base, vec3 P, vec3 N, sampler2D nzTex) {
  vec3 a = abs(N);
  float flatTop = step(0.93, a.y);
  float sl = sqrt(max(1.0 - N.y * N.y, 0.0));
  vec2 uv = mix(vec2(a.x > a.z ? P.z : P.x, P.y / max(sl, 0.35)), P.xz, flatTop);
  float px = max(length(dFdx(uv)), length(dFdy(uv)));
  vec3 n1 = texture2D(nzTex, uv * 0.07).rgb, n2 = texture2D(nzTex, uv * 0.31 + 0.37).rgb;
  float blot = n1.r * 0.6 + n2.g * 0.4;
  float streak = smoothstep(0.52, 0.9, texture2D(nzTex, vec2(uv.x * 0.9, uv.y * 0.06)).b) * (1.0 - flatTop);
  float damp = (1.0 - smoothstep(0.0, 1.5, P.y)) * (1.0 - flatTop);
  vec3 c = base;
  if (mid < 1.5) {            // gạch xây: viên 22×7 cm, mạch vữa sáng
    vec2 q = uv / vec2(0.23, 0.08); q.x += 0.5 * mod(floor(q.y), 2.0);
    vec2 id = floor(q), f = fract(q);
    float fade = clamp(1.4 - px / 0.022, 0.0, 1.0); // hàng gạch 8 cm: dưới 2,6 điểm ảnh một hàng thì hoà hẳn về màu trung bình, không sinh vân giao thoa
    float brick = smoothstep(0.0, 0.07, f.x) * (1.0 - smoothstep(0.93, 1.0, f.x)) * smoothstep(0.0, 0.17, f.y) * (1.0 - smoothstep(0.83, 1.0, f.y));
    vec3 bc = base * (0.82 + 0.36 * hash12(id)) * (0.9 + 0.2 * n2.r);
    vec3 mortar = mix(base, vec3(0.5, 0.48, 0.44), 0.6);
    c = mix(base * (0.92 + 0.14 * blot), mix(mortar, bc, brick), fade) * (1.0 - 0.18 * streak);
    c = mix(c, c * vec3(0.6, 0.66, 0.55), damp * 0.4 * n2.b);
  } else if (mid < 2.5) {     // đá hộc xẻ: khối 62×31 cm, mạch tối
    vec2 q = uv / vec2(0.62, 0.31); q.x += 0.5 * mod(floor(q.y), 2.0);
    vec2 id = floor(q), f = fract(q);
    float fade = clamp(1.7 - px / 0.09, 0.0, 1.0);
    float joint = smoothstep(0.0, 0.03, f.x) * (1.0 - smoothstep(0.97, 1.0, f.x)) * smoothstep(0.0, 0.06, f.y) * (1.0 - smoothstep(0.94, 1.0, f.y));
    c = base * mix(0.95, (0.84 + 0.3 * hash12(id)) * mix(0.55, 1.0, joint), fade) * (0.9 + 0.2 * n2.r) * (1.0 - 0.15 * streak);
  } else if (mid < 3.5) {     // vữa vôi cũ: loang màu, vệt nước mưa, chân tường ẩm mốc
    c = base * (0.86 + 0.26 * blot) * (1.0 - 0.24 * streak);
    c = mix(c, c * vec3(0.58, 0.64, 0.52), damp * (0.3 + 0.45 * n2.b));
  } else if (mid < 4.5) {     // ngói: hàng 16 cm so le, hàng trên đè bóng xuống hàng dưới, rêu bám loang lổ
    vec2 q = uv / vec2(0.15, 0.16); q.x += 0.5 * mod(floor(q.y), 2.0);
    vec2 id = floor(q), f = fract(q);
    float fade = clamp(1.4 - px / 0.04, 0.0, 1.0);
    float sh = mix(1.1, 0.62, smoothstep(0.5, 1.0, f.y)) * mix(0.72, 1.0, smoothstep(0.0, 0.1, f.x) * (1.0 - smoothstep(0.9, 1.0, f.x)));
    c = base * mix(0.92, sh * (0.84 + 0.32 * hash12(id)), fade);
    c = mix(c, vec3(0.1, 0.13, 0.07), smoothstep(0.55, 0.92, n1.b * 0.6 + n2.r * 0.4) * 0.42);
  } else if (mid < 5.5) {     // gỗ: thớ chạy dọc, khe ván
    vec2 g2 = mix(uv.yx, uv, flatTop);
    float grain = texture2D(nzTex, vec2(g2.x * 0.3, g2.y * 7.0)).r;
    float fade = clamp(1.7 - px / 0.03, 0.0, 1.0);
    float seam = smoothstep(0.0, 0.04, fract(g2.y / 0.19)) * (1.0 - smoothstep(0.96, 1.0, fract(g2.y / 0.19)));
    c = base * (0.8 + 0.4 * grain) * mix(1.0, mix(0.55, 1.0, seam), fade);
  } else if (mid < 6.5) {     // thép gỉ: mảng gỉ nâu cam, vệt gỉ chảy
    vec3 n3 = texture2D(nzTex, uv * 0.9 + 0.11).rgb;
    float r = smoothstep(0.5, 0.8, n2.r * 0.55 + n3.g * 0.3 + n1.g * 0.15);
    c = mix(base * (0.88 + 0.24 * n3.b), vec3(0.3, 0.125, 0.055) * (0.6 + 0.8 * n3.r), r * 0.6) * (1.0 - 0.22 * streak);
  } else if (mid < 7.5) {     // bê tông: vệt ố, mạch cốp pha 1,25 m
    float fade = clamp(1.7 - px / 0.2, 0.0, 1.0);
    float form = smoothstep(0.0, 0.02, abs(fract(uv.y / 1.25 + 0.5) - 0.5) * 1.25);
    c = base * (0.86 + 0.24 * blot) * mix(1.0, mix(0.72, 1.0, form), fade) * (1.0 - 0.3 * streak);
    c = mix(c, c * vec3(0.6, 0.64, 0.55), damp * 0.35 * n2.b);
  } else if (mid < 8.5) {     // đá rêu phong: khối đá nhỏ, rêu xanh bám chân và khe
    vec2 q = uv / vec2(0.46, 0.24); q.x += 0.5 * mod(floor(q.y), 2.0);
    vec2 id = floor(q), f = fract(q);
    float fade = clamp(1.7 - px / 0.07, 0.0, 1.0);
    float joint = smoothstep(0.0, 0.04, f.x) * (1.0 - smoothstep(0.96, 1.0, f.x)) * smoothstep(0.0, 0.08, f.y) * (1.0 - smoothstep(0.92, 1.0, f.y));
    c = base * mix(0.93, (0.8 + 0.36 * hash12(id)) * mix(0.5, 1.0, joint), fade) * (0.88 + 0.24 * n2.r);
    float moss = smoothstep(0.5, 0.86, n1.r * 0.5 + n2.g * 0.3 + damp * 0.4 + (1.0 - joint) * 0.2 * fade);
    c = mix(c, vec3(0.1, 0.15, 0.06) * (0.7 + 0.6 * n2.b), moss * 0.6) * (1.0 - 0.2 * streak);
  } else if (mid < 9.5) {     // gạch lát sân (gạch Bát Tràng 30 cm)
    vec2 q = uv / 0.3; vec2 id = floor(q), f = fract(q);
    float fade = clamp(1.7 - px / 0.05, 0.0, 1.0);
    float joint = smoothstep(0.0, 0.035, f.x) * (1.0 - smoothstep(0.965, 1.0, f.x)) * smoothstep(0.0, 0.035, f.y) * (1.0 - smoothstep(0.965, 1.0, f.y));
    c = base * mix(0.94, (0.84 + 0.3 * hash12(id)) * mix(0.6, 1.0, joint), fade) * (0.9 + 0.2 * blot);
  } else {                    // sơn son, sơn then: mặt sơn bóng hơi loang
    c = base * (0.9 + 0.2 * n2.r);
  }
  return c;
}`;
