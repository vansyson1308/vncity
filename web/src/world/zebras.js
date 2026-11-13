// Vạch sang đường ở đầu các đoạn đường chạm nút giao lớn: tính MỘT lần cho cả bản đồ từ dữ liệu đường (không theo từng ô phố), dùng
// chung cho gen/ground.js (kẻ vạch, vạch dừng, mũi tên) và junctions.js (chỗ mũi xe dừng đèn đỏ, chân cột đèn). Nhờ tính chung nên:
//  - vạch dời xa nút bao nhiêu thì vạch dừng, chỗ xe dừng và cột đèn dời theo bấy nhiêu;
//  - hai vạch ở hai ô phố kề nhau không chồng lên nhau (lọc trùng trên cả bản đồ, không chỉ trong một ô).
// Vị trí mặc định: tâm vạch cách tâm nút at0 = jr + 1,2 + zl (jr = max(5; 0,55 × bề rộng lớn nhất ở nút), zl nửa chiều dài vạch:
// 1,6 m, phố từ 12 m là 2 m). Ở nút giao chéo, nhánh chụm sát nhau, đầu vạch có thể thò vào lòng một đường khác (tester vòng 3: 17/75
// nút, sâu tới 2,9 m) hay chạm một vạch khác: khi đó dời vạch ra xa nút từng 0,5 m, tới 6 m; vẫn vướng thì không kẻ.
// Phép thử ở mỗi chỗ định kẻ:
//  1. tâm vạch không nằm trong lòng một đường khác cắt qua (như trước: miệng ngõ ở nút nhỏ, mẩu nối tiếp cùng hướng thì không tính);
//  2. bốn góc và điểm giữa hai mép ngoài của dải vạch: không lấn quá 0,3 m vào lòng một đường xe khác lệch hướng > 25°, và không ra
//     ngoài lòng đường;
//  3. không chồng lên (cách dưới 0,3 m) một vạch sang đường hay vạch dừng đã kẻ, không nối đuôi một vạch đã kẻ trên cùng con phố
//     (cùng hướng, tâm cách dưới 12 m dọc phố).
// Đường lớn được xét trước (rộng hơn trước), nên ở nút chụm nhánh vạch của trục chính được giữ.
import { K, F_ONEWAY, F_REVERSE, alongAt, isVehicle } from './data.js';
import { segDist2 } from '../core/util.js';

const nk = (x, z) => Math.round(x * 10) * 100003 + Math.round(z * 10); // như gen/context.js, junctions.js

// Trả về Map: đoạn đường → [vạch ở đầu p0 | null, vạch ở đầu cuối | null]. Mỗi vạch:
//   { x, z, dx, dz: tâm và hướng dọc đoạn (chiều p0 → cuối), zl, cw: bề ngang dải vạch, at0: tâm vạch cách tâm nút (m),
//     jr, stop: { x, z, dx, dz, half, oc } | null (vạch dừng), lone: chỉ có vạch dừng, không có vạch sang đường (nS = 0) }
//   và list: mọi vạch sang đường, vạch dừng (để tra theo vùng)
// sig: các nhánh xe vào nút có đèn (junctions.js): nhánh nào cũng xét kẻ vạch, kể cả khi nút con chỉ có hai đường lớn (jr theo
// bề rộng lớn nhất ở nút con, a.nw). Gọi một lần từ junctionsOf (kết quả nằm ở junctionsOf(world).zebras).
export function zebraPlan(world, sig = [], debug = null) {
  const roads = world.roads.filter(isVehicle); // (đường xe không bao giờ bị bỏ khỏi mặt đất: r.skip chỉ có ở cầu đi bộ, bậc thang)
  // ----- nút: số đường lớn và bề rộng lớn nhất (như ctx.nodes của gen/context.js) -----
  const nodes = new Map();
  for (const r of roads) for (const e of [0, r.p.length - 2]) { const k = nk(r.p[e], r.p[e + 1]); let n = nodes.get(k); if (!n) nodes.set(k, (n = { major: 0, maxW: 0 })); if (r.kind <= K.residential) n.major++; n.maxW = Math.max(n.maxW, r.w); }
  // ----- lưới tra đường (ô 32 m) -----
  const G = 32, grid = new Map();
  for (const r of roads) {
    if (r.elev) continue;
    const b = r.bb, pad = r.w / 2 + 1;
    for (let i = Math.floor((b[0] - pad) / G); i <= Math.floor((b[2] + pad) / G); i++) for (let j = Math.floor((b[1] - pad) / G); j <= Math.floor((b[3] + pad) / G); j++) { const k = i * 65537 + j; let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(r); }
  }
  const t = [0], seen = new Set();
  // đường xe (không cầu nâng) gần (x,z) nhất trong bán kính max thoả filter: { r, seg, d, px, pz } (đối tượng mới mỗi lần)
  const nearest = (x, z, max, filter) => {
    let bd = max * max, br = null, bs = 0; seen.clear();
    for (let i = Math.floor((x - max) / G); i <= Math.floor((x + max) / G); i++) for (let j = Math.floor((z - max) / G); j <= Math.floor((z + max) / G); j++) {
      const l = grid.get(i * 65537 + j); if (!l) continue;
      for (const r of l) {
        if (seen.has(r)) continue; seen.add(r); if (filter && !filter(r)) continue;
        const p = r.p; for (let s = 0; s < p.length - 2; s += 2) { const d = segDist2(x, z, p[s], p[s + 1], p[s + 2], p[s + 3], t); if (d < bd) { bd = d; br = r; bs = s; } }
      }
    }
    if (!br) return null;
    const p = br.p; segDist2(x, z, p[bs], p[bs + 1], p[bs + 2], p[bs + 3], t);
    return { r: br, seg: bs, d: Math.sqrt(bd), px: p[bs] + (p[bs + 2] - p[bs]) * t[0], pz: p[bs + 1] + (p[bs + 3] - p[bs + 1]) * t[0] };
  };
  // mọi đường xe có lòng phủ điểm (x,z) (cách tim dưới w/2 - pad), trả về danh sách [đường, hướng đoạn x, z]
  const covering = (x, z, pad) => {
    const out = []; seen.clear();
    const l = grid.get(Math.floor(x / G) * 65537 + Math.floor(z / G)); if (!l) return out;
    for (const r of l) {
      if (seen.has(r)) continue; seen.add(r);
      const p = r.p; let bd = 1e9, bs = 0; for (let s = 0; s < p.length - 2; s += 2) { const d = segDist2(x, z, p[s], p[s + 1], p[s + 2], p[s + 3], t); if (d < bd) { bd = d; bs = s; } }
      if (Math.sqrt(bd) < r.w / 2 - pad) { const sx = p[bs + 2] - p[bs], sz = p[bs + 3] - p[bs + 1], sl = Math.hypot(sx, sz) || 1; out.push([r, sx / sl, sz / sl]); }
    }
    return out;
  };

  // ----- các chỗ cần xét: đầu đoạn chạm nút lớn, đoạn xe rộng từ 5,5 m, đường tới cấp 3 -----
  const jobs = [], has = new Set(), sigKey = new Set(sig.map((a) => a.r.i * 2 + (a.e ? 1 : 0)));
  for (const r of roads) {
    if (r.elev || r.kind > K.tertiary || r.w < 5.5) continue;
    const p = r.p, n0 = nodes.get(nk(p[0], p[1])), n1 = nodes.get(nk(p[p.length - 2], p[p.length - 1]));
    if (n0 && n0.major >= 3) { jobs.push([r, 0, Math.max(5, n0.maxW * 0.55), n0, n1]); has.add(r.i * 2); }
    if (n1 && n1.major >= 3) { jobs.push([r, 1, Math.max(5, n1.maxW * 0.55), n1, n0]); has.add(r.i * 2 + 1); }
  }
  for (const a of sig) {
    const r = a.r, end = a.e ? 1 : 0, p = r.p; if (r.elev || r.w < 5 || has.has(r.i * 2 + end)) continue; has.add(r.i * 2 + end);
    const n0 = nodes.get(nk(p[0], p[1])), n1 = nodes.get(nk(p[p.length - 2], p[p.length - 1]));
    jobs.push([r, end, Math.max(5, a.nw * 0.55), end ? n1 : n0, end ? n0 : n1]);
  }
  jobs.sort((a, b) => b[0].w - a[0].w || a[0].i - b[0].i || a[1] - b[1]);
  const plan = new Map(), list = [], o5 = [0, 0, 0, 0, 0, null];
  // chồng lên một vạch đã kẻ (hình chữ nhật quay, cách dưới 0,3 m): kiểm tra bằng các góc của cả hai
  const rect = (x, z, dx, dz, hl, hw) => [[x + dx * hl - dz * hw, z + dz * hl + dx * hw], [x + dx * hl + dz * hw, z + dz * hl - dx * hw], [x - dx * hl + dz * hw, z - dz * hl - dx * hw], [x - dx * hl - dz * hw, z - dz * hl + dx * hw], [x, z]];
  const inRect = (px, pz, q, m) => { const lx = (px - q.x) * q.dx + (pz - q.z) * q.dz, ly = -(px - q.x) * q.dz + (pz - q.z) * q.dx; return Math.abs(lx) < q.hl + m && Math.abs(ly) < q.hw + m; };
  const hits = (a) => list.some((q) => Math.abs(q.x - a.x) < 40 && Math.abs(q.z - a.z) < 40 && (rect(a.x, a.z, a.dx, a.dz, a.hl, a.hw).some(([px, pz]) => inRect(px, pz, q, 0.3)) || rect(q.x, q.z, q.dx, q.dz, q.hl, q.hw).some(([px, pz]) => inRect(px, pz, a, 0.3))));
  for (const [r, end, jr, node, farN] of jobs) {
    const p = r.p, zl = r.w >= 12 ? 2 : 1.6, base = jr + 1.2 + zl;
    // Điểm cách tâm nút sd mét theo nhánh này (y như trước trong gen/ground.js): đoạn đủ dài thì lấy trên chính đoạn; không thì kéo
    // thẳng theo hướng nhánh, chỉ khi đầu kia là nút nhỏ và chỗ đó nằm trên tim một đoạn xe nối tiếp cùng bề rộng, cùng hướng.
    const P = (sd, out) => {
      if (sd <= r.len - 0.5) { alongAt(r, end ? r.len - sd : sd, out); out[5] = null; return true; }
      if (farN && farN.major >= 3) return false;
      const i0 = end ? p.length - 2 : 0, x0 = p[i0], z0 = p[i0 + 1]; let ux = 0, uz = 0;
      for (let k = 2; k < p.length; k += 2) { const j = end ? p.length - 2 - k : k; ux = p[j] - x0; uz = p[j + 1] - z0; if (ux * ux + uz * uz >= 25) break; }
      const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
      const x = x0 + ux * sd, z = z0 + uz * sd, q = nearest(x, z, r.w / 2 + 4, (c) => c !== r);
      if (!q || q.d > 0.8 || Math.abs(q.r.w - r.w) > Math.max(1.6, r.w * 0.15)) return false;
      const qp = q.r.p, sx = qp[q.seg + 2] - qp[q.seg], sz = qp[q.seg + 3] - qp[q.seg + 1], sl = Math.hypot(sx, sz) || 1;
      if (Math.abs((sx * ux + sz * uz) / sl) < 0.94) return false;
      out[0] = x; out[1] = z; out[2] = end ? -ux : ux; out[3] = end ? -uz : uz; out[5] = q.r; return true;
    };
    const nodeK = end ? nk(p[p.length - 2], p[p.length - 1]) : nk(p[0], p[1]);
    let got = null, why = '';
    // thứ tự thử: dời ra xa nút từng 0,5 m (tới max(6 m; nửa bề rộng)); đoạn sát nút quá ngắn (đầu kia là một nút lớn khác) thì
    // thử kéo vào gần nút từng 0,5 m, tới jr × 0,7 + zl (phép thử góc vẫn chặn mọi chỗ lấn sang lòng đường cắt ngang)
    const tries = []; for (let k = 0; k <= Math.max(12, Math.round(r.w)); k++) tries.push(base + k * 0.5);
    for (let a = base - 0.5; a >= jr * 0.7 + zl; a -= 0.5) tries.push(a);
    for (const at0 of tries) {
      if (got) break;
      if (!P(at0, o5)) { why = why || 'đoạn quá ngắn'; continue; }
      const x = o5[0], z = o5[1], dx = o5[2], dz = o5[3], cont = o5[5];
      // 1. tâm vạch không nằm trong lòng một đường khác cắt qua (miệng ngõ, phố nhỏ đổ vào đoạn này hay đoạn nối tiếp ở một nút nhỏ
      //    thì không tính; đoạn cùng hướng mà tim đi qua đúng chỗ kẻ vạch là phần kéo dài của chính phố này: cũng không tính)
      const ends = new Set();
      for (const q of cont ? [r, cont] : [r]) for (const i of [0, q.p.length - 2]) { const kk = nk(q.p[i], q.p[i + 1]); if (kk !== nodeK) ends.add(kk); }
      const mouth = (q) => { for (const i of [0, q.p.length - 2]) { const kk = nk(q.p[i], q.p[i + 1]); if (ends.has(kk)) { const nd = nodes.get(kk); return !nd || nd.major < 3; } } return false; };
      const skipQ = new Set([r, cont]);
      let other = null;
      for (let tt = 0; tt < 4; tt++) {
        other = nearest(x, z, r.w / 2 + 4, (q) => !skipQ.has(q) && !mouth(q));
        if (!other || other.d >= other.r.w / 2 + 0.3) break;
        const op = other.r.p, sx = op[other.seg + 2] - op[other.seg], sz = op[other.seg + 3] - op[other.seg + 1], sl = Math.hypot(sx, sz) || 1;
        const lat = Math.abs(((x - op[other.seg]) * sz - (z - op[other.seg + 1]) * sx) / sl);
        if (Math.abs((sx * dx + sz * dz) / sl) > 0.94 && lat < 1 && Math.abs(other.r.w - r.w) <= Math.max(1.6, r.w * 0.15)) { skipQ.add(other.r); other = null; continue; }
        break;
      }
      if (other && other.d < other.r.w / 2 + 0.3) { why = 'tâm trong đường khác'; continue; }
      // 2. mép ngoài dải vạch: không lấn vào lòng đường khác, không ra ngoài lòng đường
      const cw = cont ? Math.min(r.w, cont.w) : r.w, nS = Math.max(2, Math.floor(cw - 0.9) + 1), hw = (nS - 1) / 2 + 0.2;
      let bad = false;
      for (let s = 0; s < nS && !bad; s++) for (const l of [-0.2, 0.2]) for (const a of [-zl, zl]) { // bốn góc của từng vạch
        const o = s - (nS - 1) / 2 + l, px = x + dx * a - dz * o, pz = z + dz * a + dx * o;
        if (!covering(px, pz, 0).length) { bad = 'ngoài lòng đường'; break; }
        for (const [q, qx, qz] of covering(px, pz, 0.3)) if (!skipQ.has(q) && Math.abs(qx * dx + qz * dz) < 0.906) { bad = 'lấn đường khác'; break; }
        if (bad) break;
      }
      if (bad) { why = bad; continue; }
      // 3. không chồng, không nối đuôi một vạch đã kẻ
      const z0 = { x, z, dx, dz, hl: zl, hw };
      if (hits(z0)) { why = 'chồng vạch khác'; continue; }
      if (list.some((q) => q.zebra && Math.abs(q.dx * dx + q.dz * dz) > 0.9 && Math.abs((q.x - x) * dx + (q.z - z) * dz) < 12 && Math.abs(-(q.x - x) * dz + (q.z - z) * dx) < Math.max(q.hw, hw))) { why = 'nối đuôi vạch khác'; continue; }
      got = { x, z, dx, dz, zl, cw, nS, hw, at0, jr, cont, stop: null };
    }
    if (debug && !got) debug.push([r, end, why]);
    // Nhánh vào nút có đèn mà không kẻ được vạch sang đường: vẫn kẻ vạch dừng ở chỗ mặc định (xe dừng đèn đỏ đúng ở đó: junctions.js
    // giữ a.line mặc định), nếu vạch dừng không lấn đường khác, không chồng vạch đã kẻ (reviewer: 8 nhánh có đèn không có vạch dừng)
    const lone = !got && sigKey.has(r.i * 2 + end);
    if (!got && !lone) continue;
    // vạch dừng: chỉ ở nút lớn, trên phần đường của chiều xe đi tới nút
    const oneway = r.flags & F_ONEWAY ? (r.flags & F_REVERSE ? -1 : 1) : 0, toward = end ? 1 : -1;
    let stop = null;
    if (!(node.maxW < 9 || r.w < 7 || (oneway && oneway !== toward))) {
      const sd = (got ? got.at0 : base) + zl + 2.6;
      if (sd > 4 && P(sd, o5)) {
        const sw = o5[5] ? Math.min(r.w, o5[5].w) : r.w, half = oneway ? sw / 2 - 0.25 : sw / 4 - 0.12, oc = oneway ? 0 : (toward * sw) / 4;
        stop = { x: o5[0] - o5[3] * oc, z: o5[1] + o5[2] * oc, dx: o5[2], dz: o5[3], half, oc };
        if (lone) { // vạch dừng đứng một mình: soát lấn đường khác, chồng vạch như với vạch sang đường
          const skipQ = new Set([r, o5[5]]);
          const bad = rect(stop.x, stop.z, stop.dx, stop.dz, 0.2, half).some(([px, pz]) => !covering(px, pz, 0).length || covering(px, pz, 0.3).some(([q, qx, qz]) => !skipQ.has(q) && Math.abs(qx * stop.dx + qz * stop.dz) < 0.906));
          if (bad || hits({ x: stop.x, z: stop.z, dx: stop.dx, dz: stop.dz, hl: 0.2, hw: half })) stop = null;
        }
      }
    }
    if (lone && !stop) continue;
    if (lone) got = { x: stop.x, z: stop.z, dx: stop.dx, dz: stop.dz, zl, cw: 0, nS: 0, hw: 0, at0: base, jr, cont: null, stop, lone: true };
    else got.stop = stop;
    let e = plan.get(r); if (!e) plan.set(r, (e = [null, null])); e[end] = got;
    if (!lone) list.push({ x: got.x, z: got.z, dx: got.dx, dz: got.dz, hl: zl, hw: got.hw, zebra: true, rw: got.cw / 2 });
    if (got.stop) list.push({ x: got.stop.x, z: got.stop.z, dx: got.stop.dx, dz: got.stop.dz, hl: 0.2, hw: got.stop.half + 0.1 });
  }
  return { plan, list };
}
