// Chỉ mục nút giao, tính một lần từ dữ liệu đường: góc phố nào cắm biển tên, nút nào có đèn tín hiệu và pha đèn của từng
// nhánh. Không phụ thuộc three.js hay ngữ cảnh của worker, nên cả worker (gen/furniture.js dựng cột biển, cột đèn) lẫn
// luồng chính (dòng xe muốn dừng đèn đỏ) đều dùng được và luôn cho cùng một kết quả.
import { K, CS, F_ONEWAY, F_REVERSE, F_BRIDGE, roadY } from './data.js';
import { hash } from '../core/util.js';
import { isPlateName, isAlleyName } from './streetnames.js';

export const nodeKey = (x, z) => Math.round(x * 10) * 100003 + Math.round(z * 10);

// Chu kỳ đèn (giây): mỗi nhóm xanh 23, vàng 3, đỏ 30 (gồm 2 giây cả hai nhóm cùng đỏ); nhóm 1 lệch nhóm 0 nửa chu kỳ.
// Shader của bảng đồ đạc (streetatlas.js) dùng đúng các số này với uTime, nên hình và logic luôn khớp.
export const SIGNAL = { cycle: 56, green: 23, amber: 3, shift: 14 };
// Trạng thái đèn của nhóm grp (0, 1) tại nút có độ lệch off (0..3), lúc t giây: 3 xanh, 2 vàng, 1 đỏ.
export function signalState(t, grp, off) {
  const tl = (((t + off * SIGNAL.shift + grp * (SIGNAL.cycle / 2)) % SIGNAL.cycle) + SIGNAL.cycle) % SIGNAL.cycle;
  return tl < SIGNAL.green ? 3 : tl < SIGNAL.green + SIGNAL.amber ? 2 : 1;
}
// Nhóm pha của một xe đang chạy theo hướng (tx,tz) vào nút có đèn sig.
export const signalGroup = (sig, tx, tz) => (Math.abs(tx * sig.ax + tz * sig.az) >= 0.707 ? 0 : 1);
// Dòng xe (actors/trafficsim.js) dùng đúng bảng signalNode, signalGroup và signalState này với đồng hồ của shader vẽ đèn.

const cache = new WeakMap();
export function junctionsOf(world) { let J = cache.get(world); if (!J) cache.set(world, (J = build(world))); return J; }

// hướng rời nút của một đoạn đường, lấy theo điểm cách nút chừng 5 m để không bị khúc gãy đầu đoạn làm lệch
function dirAt(r, e) {
  const p = r.p, n = p.length / 2, i0 = e ? n - 1 : 0, x0 = p[i0 * 2], z0 = p[i0 * 2 + 1]; let x = x0, z = z0;
  for (let k = 1; k < n; k++) { const j = e ? n - 1 - k : k; x = p[j * 2]; z = p[j * 2 + 1]; if ((x - x0) ** 2 + (z - z0) ** 2 >= 25) break; }
  const L = Math.hypot(x - x0, z - z0) || 1; return [(x - x0) / L, (z - z0) / L];
}
const gap = (a, c) => { let g = c.ang - a.ang; while (g <= 0) g += Math.PI * 2; return g; };

function build(world) {
  const nodes = new Map(), names = world.names, b = world.bounds;
  for (const r of world.roads) {
    const veh = r.kind <= K.service, bridge = !!(r.flags & F_BRIDGE);
    if (!(veh || r.kind === K.pedestrian) || (bridge && !veh)) continue;
    const ow = r.flags & F_ONEWAY ? (r.flags & F_REVERSE ? -1 : 1) : 0, nm = names[r.name] || null;
    for (const e of [0, 1]) {
      const i = e ? r.p.length - 2 : 0, x = r.p[i], z = r.p[i + 1], k = nodeKey(x, z);
      let n = nodes.get(k); if (!n) nodes.set(k, (n = { k, x, z, arms: [], high: false }));
      if (r.elev && roadY(r, e ? r.len : 0) > 0.3) n.high = true; // nút nằm trên mặt cầu nâng: không cắm gì
      const [dx, dz] = dirAt(r, e);
      // inbound: xe được phép chạy theo nhánh này VÀO nút
      n.arms.push({ r, e, dx, dz, w: r.w, kind: r.kind, veh, name: nm, ow: ow !== 0, inbound: veh && (e ? ow !== -1 : ow !== 1), ang: Math.atan2(dz, dx) });
    }
  }
  for (const n of nodes.values()) n.arms.sort((p, q) => p.ang - q.ang);

  const chunkKey = (x, z) => Math.floor((x - b.x0) / CS) * 1000 + Math.floor((z - b.z0) / CS);
  const byChunk = new Map(), bucket = (x, z) => { const k = chunkKey(x, z); let c = byChunk.get(k); if (!c) byChunk.set(k, (c = { plates: [], signals: [] })); return c; };

  // ----- biển tên phố -----
  // Cùng một tên không cắm lại trong vòng r mét ở nút khác (đường đôi, vòng xoay sinh ra nhiều nút sát nhau).
  const seen = new Map();
  const taken = (name, n, r) => { const l = seen.get(name); if (l) for (const q of l) if (q[2] !== n.k && (q[0] - n.x) ** 2 + (q[1] - n.z) ** 2 < r * r) return true; return false; };
  const take = (name, n) => { let l = seen.get(name); if (!l) seen.set(name, (l = [])); l.push([n.x, n.z, n.k]); };
  const street = (a) => (isPlateName(a.name) && !isAlleyName(a.name) ? a.name : null);
  const okGap = (g) => g >= 0.7 && g <= 2.62; // hai nhánh lệch nhau 40 đến 150 độ mới thành một góc phố
  for (const n of nodes.values()) {
    const A = n.arms, m = A.length; if (n.high || m < 2) continue;
    const S = new Set(A.map(street).filter(Boolean));
    if (S.size >= 2) {
      // các góc giữa hai phố khác tên: ngã tư chọn hai góc chéo nhau, ngã ba lấy cả hai góc
      const cs = [];
      for (let i = 0; i < m; i++) {
        const a = A[i], c = A[(i + 1) % m], g = gap(a, c), na = street(a), nc = street(c);
        if (okGap(g) && na && nc && na !== nc && a.r.len >= 2 && c.r.len >= 2) cs.push([a, c, g, na, nc]);
      }
      let pick = cs;
      if (cs.length >= 3) { const i0 = Math.floor(hash(n.k, 3) * cs.length); pick = [cs[i0], cs[(i0 + (cs.length >> 1)) % cs.length]]; }
      const used = [];
      for (const [a, c, g, na, nc] of pick) {
        const ka = !taken(na, n, 24), kc = !taken(nc, n, 24); if (!ka && !kc) continue;
        bucket(n.x, n.z).plates.push({ n, a, c, g, na: ka ? na : null, nc: kc ? nc : null }); if (ka) used.push(na); if (kc) used.push(nc);
      }
      if (!cs.length && m === 2) { // phố đổi tên giữa chừng (đầu phố này, cuối phố kia): một cột bên lề, hai biển chỉ về hai phía
        const na = street(A[0]), nc = street(A[1]);
        if (na && nc && A[0].r.len >= 8 && A[1].r.len >= 8 && !taken(na, n, 24) && !taken(nc, n, 24)) { bucket(n.x, n.z).plates.push({ n, a: A[0], c: null, o: A[1], g: 0, na, nc }); used.push(na, nc); }
      }
      for (const u of used) take(u, n);
    }
    // đầu ngõ: biển "NGÕ ..." ở góc giữa ngõ và con phố nó đổ ra
    for (let i = 0; i < m; i++) {
      const a = A[i]; if (!isAlleyName(a.name) || a.r.len < 4) continue;
      if (A.filter((q) => q.name === a.name).length !== 1 || taken(a.name, n, 14)) continue;
      const prev = A[(i + m - 1) % m], next = A[(i + 1) % m], opt = [];
      if (prev !== a && prev.name !== a.name && okGap(gap(prev, a))) opt.push([prev, a, gap(prev, a), prev]);
      if (next !== a && next.name !== a.name && okGap(gap(a, next))) opt.push([a, next, gap(a, next), next]);
      if (!opt.length) continue;
      opt.sort((p, q) => (street(q[3]) ? 1 : 0) - (street(p[3]) ? 1 : 0) || q[3].w - p[3].w);
      const o = opt.length > 1 && !!street(opt[0][3]) === !!street(opt[1][3]) && opt[0][3].w === opt[1][3].w && hash(n.k, 5 + i) < 0.5 ? opt[1] : opt[0];
      bucket(n.x, n.z).plates.push({ n, a: o[0], c: o[1], g: o[2], alley: a.name, alleyArm: a, main: o[3] }); take(a.name, n);
    }
  }

  // ----- đèn tín hiệu -----
  // Nút có đèn: từ ba nhánh đường chính (cấp ba trở lên) thuộc ít nhất hai phố cắt nhau thật sự, phố rộng nhất từ 8,5 m.
  // Các nút sát nhau (hai chiều của đường đôi cắt cùng một phố) gộp thành một nút giao chung pha.
  const cands = [];
  for (const n of nodes.values()) {
    if (n.high) continue;
    const maj = n.arms.filter((a) => a.veh && a.kind <= K.tertiary); if (maj.length < 3) continue;
    let w = 0, cross = false;
    for (const a of maj) { w = Math.max(w, a.w); for (const c of maj) if (a.name && c.name && a.name !== c.name && Math.abs(a.dx * c.dx + a.dz * c.dz) < 0.766) cross = true; }
    if (!cross || w < 8.5) continue;
    n.sw = w; cands.push(n);
  }
  cands.sort((p, q) => q.sw - p.sw || p.k - q.k);
  const prim = [], signalNode = new Map();
  for (const n of cands) {
    let host = null, bd = 900; for (const s of prim) { const d = (s.x - n.x) ** 2 + (s.z - n.z) ** 2; if (d < bd) { bd = d; host = s; } }
    if (host) host.members.push(n); else prim.push({ x: n.x, z: n.z, k: n.k, members: [n] });
  }
  for (const s of prim) {
    const keys = new Set(s.members.map((n) => n.k)), n0 = s.members[0];
    let wide = null; for (const a of n0.arms) if (a.veh && a.kind <= K.tertiary && (!wide || a.w > wide.w)) wide = a;
    const sig = { x: s.x, z: s.z, k: s.k, ax: wide.dx, az: wide.dz, off: Math.floor(hash(s.k, 9) * 4), big: n0.sw >= 9.5, last8: false, stop: 0, arms: [], keys: [...keys] };
    let maxW = 0; const nm = new Set();
    for (const n of s.members) for (const a of n.arms) {
      const p = a.r.p, j = a.e ? 0 : p.length - 2; // đầu kia của đoạn đường
      if (keys.has(nodeKey(p[j], p[j + 1]))) continue; // đoạn nối bên trong nút giao
      if (!a.veh || a.kind > K.residential || (a.kind === K.residential && a.w < 5)) continue;
      const grp = signalGroup(sig, a.dx, a.dz); maxW = Math.max(maxW, a.w); if (a.name) nm.add(a.name);
      sig.arms.push({ x: n.x, z: n.z, r: a.r, e: a.e, dx: a.dx, dz: a.dz, w: a.w, kind: a.kind, ow: a.ow, inbound: a.inbound, grp, stop: 0 });
    }
    // cột đèn đứng ngay sau vạch sang đường (gen/ground.js kẻ vạch cách tim nút max(5, 0,55 × bề rộng lớn nhất) + 2,6 m, rộng 2,8 m)
    sig.stop = Math.max(5, maxW * 0.55) + 5.0; for (const a of sig.arms) a.stop = sig.stop; // sig.stop: quãng từ tim nút tới chân cột đèn
    // sig.line: quãng từ tim nút tới chỗ mũi xe dừng khi đèn đỏ, ngay trước vạch dừng sơn trên mặt đường. gen/ground.js kẻ vạch sang
    // đường từ jr + 1,2 tới jr + 1,2 + 2·zl rồi vạch dừng ở jr + 3,8 + 2·zl (jr = max(5; 0,55 × bề rộng lớn nhất), zl = 1,6 m, phố từ 12 m là 2 m).
    sig.line = Math.max(5, maxW * 0.55) + 3.8 + 2 * (maxW >= 12 ? 2 : 1.6) + 0.4;
    // thí điểm từ 11/2025: các nút trên trục Trần Hưng Đạo và nút Hùng Vương - Trần Phú chỉ hiện 8 giây cuối
    sig.last8 = nm.has('Phố Trần Hưng Đạo') || (nm.has('Đường Hùng Vương') && nm.has('Phố Trần Phú'));
    if (sig.arms.filter((a) => a.inbound).length < 2) continue;
    bucket(s.x, s.z).signals.push(sig); for (const k of keys) signalNode.set(k, sig);
  }
  return { nodes, byChunk, signalNode, signals: prim.length };
}
