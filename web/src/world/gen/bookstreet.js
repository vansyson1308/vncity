// Phố sách Hà Nội (phố 19 Tháng 12, mở năm 2017): phố đi bộ ngắn nối Hai Bà Trưng với Lý Thường Kiệt, hai bên là dãy gian hàng sách một
// tầng nằm dưới tán cây. Bản đồ chỉ có hai lối lát gạch kẹp dải cỏ (QC vòng 4: "phố sách không thấy gian sách nào"), nên dãy gian dựng
// ở đây: mỗi gian là ki-ốt 3,6 × 2,6 m cao 2,7 m, tường trắng, mái đua, biển chữ trên mép mái, giá sách nhiều màu ở vách sau, quầy bày
// sách phía trước, quay mặt ra lối đi. Gian đặt dọc mép NGOÀI của hai lối (phía nhà), cách mép lối 0,35 m, cách nhau 1,6 m; bỏ quãng 9 m
// ở hai đầu phố (lối vào từ vỉa hè hai phố ngang), bỏ chỗ vướng gốc cây, cột đèn, nhà, lối đi khác. Có va chạm (bốn vách).
// Biển chỉ dùng chữ chung (SÁCH, VĂN PHÒNG PHẨM, TRANH DÂN GIAN, CÀ PHÊ), không tên nhà xuất bản hay nhãn hiệu thật.
import { hash, segDist2 } from '../../core/util.js';
import { CURB, K, alongAt } from '../data.js';
import { SIGNS, SIGN_COLORS, signUV } from '../signs.js';

const STREET = 'Phố 19 Tháng 12';
const W = 3.6, D = 2.6, H = 2.7, GAP = 1.6, END = 9, OFF = 0.35;
const lin = (h) => { const f = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)); return [f(((h >> 16) & 255) / 255), f(((h >> 8) & 255) / 255), f((h & 255) / 255)]; };
const KINDS = ['SÁCH', 'SÁCH', 'VĂN PHÒNG PHẨM', 'SÁCH', 'TRANH DÂN GIAN', 'SÁCH', 'SÁCH', 'CÀ PHÊ'].map((t) => SIGNS.findIndex((q) => q && q[0] === t));
const BOOK = [0xc94a4a, 0xe0b23c, 0x4a78a8, 0x6aa07a, 0xe9e3d0, 0xd98aa8, 0x8a5ac0, 0xf08a3a, 0x2c3e50, 0x7a4a2a, 0x2f6f6a, 0xb03a2e].map(lin);
const ROOFS = [[0.16, 0.3, 0.22], [0.36, 0.16, 0.1], [0.2, 0.22, 0.26]];

// Hai lối đi của phố sách (cả thế giới, dò một lần): cần cả lối bên kia để biết phía nào là phía ngoài.
function paths(ctx) {
  if (!ctx._bookPaths) ctx._bookPaths = ctx.world.roads.filter((r) => r.kind === K.footway && !r.skip && ctx.world.names[r.name] === STREET);
  return ctx._bookPaths;
}
export function bookStreetBox(ctx) {
  const P = paths(ctx); if (!P.length) return null;
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const r of P) { x0 = Math.min(x0, r.bb[0]); z0 = Math.min(z0, r.bb[1]); x1 = Math.max(x1, r.bb[2]); z1 = Math.max(z1, r.bb[3]); }
  return [x0 - 8, z0 - 8, x1 + 8, z1 + 8];
}

// env: near, far, lamps, X0, Z0, X1, Z1, inChunk, extra; occ: chỗ đã có vật [x, z, bán kính] (cây, cột đèn, ki-ốt...)
export function bookStalls(ctx, env, occ) {
  const box = bookStreetBox(ctx); if (!box || box[0] > env.X1 || box[2] < env.X0 || box[1] > env.Z1 || box[3] < env.Z0) return;
  const { near, far, lamps, X0, Z0, inChunk } = env, P = paths(ctx), walls = [], o = [0, 0, 0, 0, 0];
  // chỗ đứng được cho một điểm của gian: không nhà, không nước, không thềm công trình, không đè lên lối đi hay lòng đường nào
  const solidFree = (x, z) => !ctx.buildingAt(x, z) && !ctx.isWater(x, z) && !ctx.keepOut(x, z);
  const offPaths = (x, z, pad) => { for (const r of ctx.roadGrid.collect(x - 9, z - 9, x + 9, z + 9)) { if (r.skip || r.elev) continue; const h = ctx.nearestRoad(x, z, 9, (q) => q === r); if (h && h.d < r.w / 2 + pad) return false; } return true; };
  for (const r of P) {
    const L = r.len; if (L < 2 * END + W) continue;
    for (let s = END + W / 2, k = 0; s <= L - END - W / 2; s += W + GAP, k++) {
      alongAt(r, s, o);
      const px = o[0], pz = o[1], tx = o[2], tz = o[3];
      for (const side of [-1, 1]) {
        const nx = -tz * side, nz = tx * side, e = r.w / 2 + OFF + D / 2, cx = px + nx * e, cz = pz + nz * e;
        if (!inChunk(cx, cz)) continue;
        // phía ngoài: gian không được nằm trên dải cỏ giữa hai lối (cách lối bên kia ít nhất nửa chiều sâu gian + 0,6 m)
        let inner = false;
        for (const q of P) { if (q === r) continue; const p = q.p; for (let i = 0; i < p.length - 2; i += 2) if (segDist2(cx, cz, p[i], p[i + 1], p[i + 2], p[i + 3]) < (q.w / 2 + D / 2 + 0.6) ** 2) { inner = true; break; } if (inner) break; }
        if (inner) continue;
        // bốn góc, trung điểm các cạnh và tâm: đứng được, không đè lối đi nào (kể cả chính lối của gian: mép trước cách mép lối 0,35 m)
        const fx = -nx, fz = -nz, pts = [];
        for (const a of [-0.5, 0, 0.5]) for (const b of [-0.5, 0, 0.5]) pts.push([cx + tx * W * a * 1.06 + fx * D * b * 1.06, cz + tz * W * a * 1.06 + fz * D * b * 1.06]);
        if (!pts.every(([x, z]) => solidFree(x, z) && offPaths(x, z, 0.12))) continue;
        // gốc cây, cột đèn, đồ đạc đã đặt: cách hình chữ nhật của gian ít nhất bán kính vật + 0,3 m
        let hit = false;
        for (const q of occ) {
          const dx = q[0] - cx, dz = q[1] - cz, u = Math.abs(dx * tx + dz * tz) - W / 2, v = Math.abs(dx * fx + dz * fz) - D / 2;
          const dd = Math.hypot(Math.max(u, 0), Math.max(v, 0)); if (dd < q[2] + 0.3) { hit = true; break; }
        }
        if (hit) continue;
        const seed = (r.i * 7919 + k * 131 + (side > 0 ? 17 : 0)) | 0;
        stall(near, far, cx - X0, cz - Z0, Math.atan2(fx, fz), seed);
        occ.push([cx, cz, Math.hypot(W, D) / 2]);
        // bốn vách (mép quầy phía trước cũng chắn: khách đứng ngoài quầy)
        const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [cx + tx * (W / 2) * a + fx * (D / 2) * b, cz + tz * (W / 2) * a + fz * (D / 2) * b]);
        for (let i = 0; i < 4; i++) walls.push(c[i][0], c[i][1], c[(i + 1) % 4][0], c[(i + 1) % 4][1]);
        lamps.push(cx + fx * (D / 2 + 0.8), 2.4, cz + fz * (D / 2 + 0.8), 4.2); // đèn trong gian hắt ra lối đi buổi tối
      }
    }
  }
  if (walls.length) { const old = env.extra.walls || new Float32Array(0), w = new Float32Array(old.length + walls.length); w.set(old); w.set(walls, old.length); env.extra.walls = w; }
}

// Một gian sách. Hệ cục bộ: gốc ở tâm đáy (mặt đất CURB), +z là mặt trước (quay ra lối đi), +x dọc lối đi.
function stall(g, far, x, z, yaw, s) {
  const sign = KINDS[Math.floor(hash(s, 1) * KINDS.length)], roof = ROOFS[Math.floor(hash(s, 2) * ROOFS.length)];
  const sc = lin(SIGN_COLORS[SIGNS[sign][2]]), uv = signUV(sign), hw = W / 2, hd = D / 2, t = 0.1, wall = [0.86, 0.84, 0.78];
  g.push().move(x, CURB, z).rotY(yaw).mat();
  g.rgb(0.5, 0.5, 0.48).box(-hw - 0.15, 0, -hd - 0.15, hw + 0.15, 0.12, hd + 0.25, 'xXYzZ');                      // nền lát
  g.rgb(wall[0], wall[1], wall[2]).box(-hw, 0.12, -hd, hw, H, -hd + t, 'xXzZ')                                    // vách sau
    .box(-hw, 0.12, -hd + t, -hw + t, H, hd, 'xXZ').box(hw - t, 0.12, -hd + t, hw, H, hd, 'xXZ')                 // hai vách bên
    .box(-hw + t, H - 0.32, hd - t, hw - t, H, hd, 'yZ');                                                         // lanh tô trước
  g.rgb(roof[0], roof[1], roof[2]).box(-hw - 0.3, H, -hd - 0.25, hw + 0.3, H + 0.16, hd + 0.55, 'xXyYzZ');      // mái đua
  // biển chữ trên mép mái
  const sw = 3.1, y0 = H + 0.2, y1 = y0 + 0.54, zb = hd + 0.36;
  g.rgb(sc[0] * 0.45, sc[1] * 0.45, sc[2] * 0.45).box(-sw / 2 - 0.06, H + 0.16, zb - 0.08, sw / 2 + 0.06, y1 + 0.04, zb, 'xXYz');
  g.rgb(1, 1, 1).glow(0.3).quad([-sw / 2, y0, zb + 0.005], [sw / 2, y0, zb + 0.005], [sw / 2, y1, zb + 0.005], [-sw / 2, y1, zb + 0.005], uv).glow(0);
  // giá sách vách sau: khung gỗ, bốn tầng gáy sách nhiều màu
  g.rgb(0.3, 0.2, 0.12).mat(5).box(-hw + t + 0.05, 0.12, -hd + t, hw - t - 0.05, 2.2, -hd + t + 0.02, 'Z')                       // tấm hậu của giá
    .box(-hw + t + 0.05, 0.12, -hd + t, -hw + t + 0.1, 2.2, -hd + t + 0.36, 'XZ').box(hw - t - 0.1, 0.12, -hd + t, hw - t - 0.05, 2.2, -hd + t + 0.36, 'xZ').mat(); // hai thành giá
  for (let row = 0; row < 4; row++) {
    const yb = 0.32 + row * 0.47; g.rgb(0.36, 0.25, 0.15).box(-hw + t + 0.05, yb - 0.04, -hd + t, hw - t - 0.05, yb, -hd + t + 0.36, 'YZ');
    for (let x0 = -hw + t + 0.1; x0 < hw - t - 0.2;) {
      const w = 0.06 + hash(s + row * 31 + Math.round(x0 * 50), 3) * 0.12, h = 0.24 + hash(s + row * 17 + Math.round(x0 * 50), 4) * 0.14, c = BOOK[Math.floor(hash(s + row * 7 + Math.round(x0 * 50), 5) * BOOK.length)];
      g.rgb(c[0], c[1], c[2]).box(x0, yb, -hd + t + 0.06, Math.min(x0 + w, hw - t - 0.1), yb + h, -hd + t + 0.3, 'YZ'); x0 += w + 0.01;
    }
  }
  // quầy trước bày sách nằm, chồng sách
  g.rgb(0.42, 0.29, 0.17).mat(5).box(-hw + t + 0.1, 0.12, hd - 0.8, hw - t - 0.1, 0.82, hd - 0.12, 'xXYZ').mat();
  for (let i = 0, n = 7; i < n; i++) for (let j = 0; j < 2; j++) {
    const xc = -hw + t + 0.3 + ((W - 2 * t - 0.6) * (i + 0.5)) / n, zc = hd - 0.62 + j * 0.3, c = BOOK[Math.floor(hash(s + i * 5 + j, 6) * BOOK.length)], hh = 0.03 + hash(s + i * 3 + j, 7) * 0.12;
    g.rgb(c[0], c[1], c[2]).box(xc - 0.13, 0.82, zc - 0.1, xc + 0.13, 0.82 + hh, zc + 0.1, 'xXYzZ');
  }
  g.rgb(1, 0.92, 0.75).glow(0.7).box(-hw + 0.4, H - 0.36, hd - 0.3, hw - 0.4, H - 0.33, hd - 0.24, 'y').glow(0); // đèn tuýp dưới lanh tô
  // áp phích bìa sách trên hai vách hông (nhìn dọc phố là thấy vách hông của cả dãy gian): nền màu bìa, băng tên sách sáng, mảng hình
  const panel = (sx, za, zb, ya, yb, o) => { const x = sx * (hw + o); if (sx > 0) g.quad([x, ya, zb], [x, ya, za], [x, yb, za], [x, yb, zb]); else g.quad([x, ya, za], [x, ya, zb], [x, yb, zb], [x, yb, za]); };
  for (const sx of [-1, 1]) {
    const c = BOOK[Math.floor(hash(s, sx > 0 ? 8 : 9) * BOOK.length)], c2 = BOOK[Math.floor(hash(s, sx > 0 ? 10 : 11) * BOOK.length)], za = -hd + 0.45, zb = hd - 0.45, ya = 0.75, yb = 2.35;
    g.rgb(0.25, 0.25, 0.25); panel(sx, za - 0.04, zb + 0.04, ya - 0.04, yb + 0.04, 0.004);
    g.rgb(c[0], c[1], c[2]); panel(sx, za, zb, ya, yb, 0.008);
    g.rgb(0.93, 0.91, 0.86); panel(sx, za + 0.14, zb - 0.14, yb - 0.38, yb - 0.14, 0.012);
    g.rgb(c2[0], c2[1], c2[2]); panel(sx, za + 0.26, zb - 0.26, ya + 0.3, yb - 0.55, 0.012);
  }
  g.pop();
  // bản xa: khối gian, mái, biển
  far.push().move(x, CURB, z).rotY(yaw).mat();
  far.rgb(wall[0], wall[1], wall[2]).box(-hw, 0, -hd, hw, H, hd, 'xXzZ');
  far.rgb(roof[0], roof[1], roof[2]).box(-hw - 0.3, H, -hd - 0.25, hw + 0.3, H + 0.16, hd + 0.55, 'xXYzZ');
  far.rgb(1, 1, 1).glow(0.3).quad([-sw / 2, y0, zb], [sw / 2, y0, zb], [sw / 2, y1, zb], [-sw / 2, y1, zb], uv).glow(0);
  far.pop();
}
