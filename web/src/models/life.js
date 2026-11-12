// Đồ nghề của người và xe trên phố Hà Nội, dựng thủ tục bằng G: nón lá, mẹt hoa, thúng quả, quang gánh, ghế đẩu nhựa, ba lô,
// thùng giao hàng. Dùng chung cho dòng xe (actors/fleet.js) và người đi bộ (actors/cast.js). Không phụ thuộc three.js.
import { hash } from '../core/util.js';

// Nón lá: chóp nón, mặt ngoài màu lá cọ khô, mặt trong sẫm hơn (ngước nhìn từ dưới vẫn thấy vành). Tâm vành tại (x, y, z).
export function nonLa(g, x, y, z, r = 0.25, h = 0.165, seg = 10) {
  const top = [x, y + h, z], sl = r / Math.hypot(r, h), up = h / Math.hypot(r, h);
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2, am = (a0 + a1) / 2;
    const p0 = [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r];
    // mặt ngoài: pháp tuyến mượt quanh chóp (mỗi múi hơi lệch sắc độ như các lớp lá)
    const k = 0.92 + 0.12 * hash(i, 3); g.rgb(0.72 * k, 0.6 * k, 0.33 * k);
    const a = g.v(p0[0], p0[1], p0[2], Math.cos(a0) * up, sl, Math.sin(a0) * up), b = g.v(p1[0], p1[1], p1[2], Math.cos(a1) * up, sl, Math.sin(a1) * up), c = g.v(top[0], top[1], top[2], Math.cos(am) * up, sl, Math.sin(am) * up);
    g.idx.push(a, c, b);
    g.rgb(0.34, 0.27, 0.15);
    const d = g.v(p0[0], p0[1], p0[2], 0, -1, 0), e = g.v(p1[0], p1[1], p1[2], 0, -1, 0), f = g.v(top[0], top[1] - 0.012, top[2], 0, -1, 0);
    g.idx.push(d, e, f);
  }
  return g;
}

// Mẹt / thúng tre: đĩa nông đan bằng tre, miệng tại độ cao y + depth, bán kính r. Hai mặt (nhìn nghiêng thấy thành, nhìn trên thấy lòng).
export function tray(g, x, y, z, r = 0.42, depth = 0.09, seg = 8) {
  g.color(0xb99557).gloss(0);
  const ring = (rr, yy) => { const o = []; for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; o.push([x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr]); } return o; };
  const b = ring(r * 0.72, y), t = ring(r, y + depth);
  for (let i = 0; i < seg; i++) g.quad(b[i + 1], b[i], t[i], t[i + 1]).quad(b[i], b[i + 1], t[i + 1], t[i]); // thành ngoài, thành trong
  g.shade(0.8); for (let i = 1; i < seg - 1; i++) g.tri3(b[0], b[i], b[i + 1]).tri3([b[0][0], y + 0.012, b[0][2]], [b[i + 1][0], y + 0.012, b[i + 1][2]], [b[i][0], y + 0.012, b[i][2]]); // đáy dưới, lòng trên
  return g;
}
// Bó hoa xếp trên mẹt: nền lá xanh và các cụm hoa theo mùa. Tháng 11 Hà Nội là mùa cúc hoạ mi (trắng nhuỵ vàng), xen hồng, cúc vàng, thạch thảo tím.
const BLOOM = [[0.92, 0.92, 0.86], [0.92, 0.92, 0.86], [0.86, 0.22, 0.3], [0.9, 0.7, 0.08], [0.5, 0.3, 0.72], [0.93, 0.52, 0.62], [0.92, 0.92, 0.86]];
export function flowers(g, x, y, z, r = 0.4, seed = 1, n = 7) {
  g.rgb(0.1, 0.3, 0.09).gloss(0).ball(x, y + 0.03, z, r * 0.92, 6, 3, 0.42);
  for (let i = 0; i < n; i++) {
    const a = (i / (n - 1)) * Math.PI * 2 + hash(seed, i) * 0.6, d = i === n - 1 ? 0 : r * (0.5 + hash(seed, 20 + i) * 0.16), c = BLOOM[(i + seed) % BLOOM.length];
    g.rgb(c[0], c[1], c[2]).ball(x + Math.cos(a) * d, y + r * 0.34 + hash(seed, 40 + i) * 0.07 + (d ? 0 : 0.08), z + Math.sin(a) * d, r * (0.33 + hash(seed, 60 + i) * 0.1), 5, 3, 0.75, 0.25, seed + i);
  }
  return g;
}
// Hoa quả chất đống trên thúng: cam, quýt, hồng, na, ổi... (một ụ tròn lổn nhổn và vài quả rời).
const FRUIT = [[0.9, 0.42, 0.04], [0.92, 0.62, 0.05], [0.42, 0.56, 0.12], [0.8, 0.2, 0.08]];
export function fruit(g, x, y, z, r = 0.4, seed = 1) {
  const c = FRUIT[seed % FRUIT.length];
  g.rgb(c[0], c[1], c[2]).gloss(0.15).ball(x, y + 0.02, z, r * 0.88, 7, 3, 0.5, 0.22, seed);
  for (let i = 0; i < 5; i++) { const a = i * 1.26 + hash(seed, i), d = r * 0.45, k = FRUIT[(seed + 1 + (i & 1)) % FRUIT.length]; g.rgb(k[0], k[1], k[2]).ball(x + Math.cos(a) * d, y + r * 0.36, z + Math.sin(a) * d, r * 0.2, 5, 3); }
  return g.gloss(0);
}

// Quang gánh: đòn tre dài 1,5 m đặt trên vai, hai đầu treo hai thúng bằng quang mây (3 sợi mỗi bên). Trục đòn chạy dọc x
// (đầu trước +x), tâm đòn tại (0, y, z). Hàng trong thúng vẽ riêng bằng ganhLoad để người gánh nào cũng dùng chung một đôi quang.
const GANH = { L: 0.76, sag: 0.07, drop: 0.86, rb: 0.24 };
export function quangGanh(g, y, z = 0) {
  const { L, sag, drop, rb } = GANH;
  g.color(0x9a7a42).gloss(0.1);
  g.tube([-L, y - sag, z], [-0.25, y, z], 0.016, 4, 0.02).tube([-0.25, y, z], [0.25, y, z], 0.02, 4).tube([0.25, y, z], [L, y - sag, z], 0.02, 4, 0.016); // đòn tre hơi võng ở hai đầu
  for (const s of [-1, 1]) {
    const bx = s * L, by = y - sag - drop;
    g.color(0x6e5a36);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.5; g.tube([bx, y - sag, z], [bx + Math.cos(a) * rb * 0.95, by + 0.1, z + Math.sin(a) * rb * 0.95], 0.006, 3); }
    tray(g, bx, by, z, rb, 0.1, 7);
  }
  return g;
}
// Hàng trong hai thúng: 'flowers' hoa, 'fruit' hoa quả, 'pot' nồi tào phớ / bún một bên và chồng bát, phích nước bên kia.
export function ganhLoad(g, y, z = 0, load = 'fruit', seed = 1) {
  const { L, sag, drop, rb } = GANH;
  for (const s of [-1, 1]) {
    const bx = s * L, by = y - sag - drop;
    if (load === 'flowers') flowers(g, bx, by + 0.08, z, rb * 0.95, seed + s, 4);
    else if (load === 'pot' && s > 0) g.rgb(0.55, 0.55, 0.57).gloss(0.7).cyl(bx, by + 0.03, z, 0.16, 0.17, 0.22, 7, true).gloss(0);
    else if (load === 'pot') { g.rgb(0.85, 0.84, 0.78).cyl(bx - 0.06, by + 0.03, z, 0.08, 0.09, 0.2, 6, true); g.rgb(0.3, 0.45, 0.7).cyl(bx + 0.09, by + 0.03, z + 0.03, 0.07, 0.07, 0.14, 6, true); }
    else fruit(g, bx, by + 0.07, z, rb * 0.95, seed + s + 1);
  }
  return g;
}

// Ghế đẩu nhựa thấp (cao 25 cm), đỏ hoặc xanh dương: bốn chân choãi, mặt vuông bo góc.
export function plasticStool(g, x, z, h = 0.25) {
  g.cyl(x, 0, z, 0.165, 0.125, h, 4, true);
  return g;
}
export const STOOL_RED = [0.55, 0.035, 0.03], STOOL_BLUE = [0.035, 0.14, 0.5];

// Ba lô đeo sau lưng: thân hộp, nắp trên thu nhỏ, túi trước. Tâm đáy mặt áp lưng tại (x, y, z), ba lô nhô về phía −z.
export function backpack(g, x, y, z, w = 0.3, h = 0.44, d = 0.17) {
  g.box(x - w / 2, y, z - d, x + w / 2, y + h * 0.8, z, 'xXyzZ');
  g.box(x - w * 0.42, y + h * 0.8, z - d * 0.82, x + w * 0.42, y + h, z, 'xXYzZ');
  g.shade(0.7).box(x - w * 0.32, y + h * 0.1, z - d - 0.04, x + w * 0.32, y + h * 0.5, z - d, 'xXyYz');
  return g;
}
