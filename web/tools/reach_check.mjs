// Kiểm tra lối đi: mỗi điểm đóng dấu hộ chiếu phải có chỗ đứng được trong bán kính đóng dấu, và từ chỗ đó phải đi bộ
// ra được mạng đường xe chạy. Dùng đúng dữ liệu va chạm của game (tường nhà, tường rào, bờ nước, khối công trình,
// mặt cầu Thê Húc) và đúng hàm Nav.collide mà người chơi dùng, loang trên lưới 0,4 m.
// Dùng: node tools/reach_check.mjs [id ...] [--verbose]    Mã thoát 1 nếu có điểm không tới được.
import fs from 'node:fs';
import { decodeWorld, CS, K } from '../src/world/data.js';
import { Nav } from '../src/world/nav.js';
import { buildContext } from '../src/world/gen/context.js';
import { genGround } from '../src/world/gen/ground.js';
import { genBuildings } from '../src/world/gen/buildings.js';
import { genProps } from '../src/world/gen/props.js';
import { resolveSites, siteCollision, siteDecks } from '../src/world/landmarks/sites.js';
import { G } from '../src/core/geo.js';

const world = decodeWorld(JSON.parse(fs.readFileSync(new URL('../public/world/hanoi.json', import.meta.url), 'utf8')));
const places = JSON.parse(fs.readFileSync(new URL('../public/world/places.json', import.meta.url), 'utf8')).items;
const sites = resolveSites(world), ctx = buildContext(world, sites), nav = new Nav(world), B = world.bounds;
for (const d of siteDecks(sites)) nav.addDeck(d);
for (const s of sites) { // va chạm của công trình dựng tay, tính y như trong game (landmarks/index.js)
  const g = new G(); try { (await import(`../src/world/landmarks/${s.id}.js`)).build(g, { lf: new G() }); } catch (e) { console.warn('không dựng được', s.id, e.message); }
  const col = siteCollision(s, g.pos); if (col.length) nav.addChunk('lm:' + s.id, col, new Float32Array(0));
}

export const STEP = 0.4, R = 0.3;
const loaded = new Set();
function need(x, z) { // nạp va chạm của ô phố chứa (x,z) và các ô kề nếu ở sát mép
  for (const [dx, dz] of [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) {
    const cx = Math.floor((x + dx - B.x0) / CS), cz = Math.floor((z + dz - B.z0) / CS), k = cx * 1000 + cz;
    if (loaded.has(k) || cx < 0 || cz < 0 || cx >= world.nx || cz >= world.nz) continue; loaded.add(k);
    const b = genBuildings(ctx, cx, cz), p = genProps(ctx, cx, cz, b), g = genGround(ctx, cx, cz);
    let walls = p.extra && p.extra.walls;
    if (g.ramp.length) { const w = new Float32Array((walls ? walls.length : 0) + g.ramp.length); if (walls) w.set(walls); w.set(g.ramp, walls ? walls.length : 0); walls = w; }
    nav.addChunk(k, b.col, g.shore, walls);
  }
}
// trong lòng khối đặc của một công trình dựng tay (các hình chữ nhật va chạm của nó)
const modelRects = [];
for (const c of nav.chunks) if (String(c[0]).startsWith('lm:')) { const sg = c[1].segs; for (let i = 0; i < sg.length; i += 20) modelRects.push([sg[i], sg[i + 1], sg[i + 5], sg[i + 6], sg[i + 10], sg[i + 11], sg[i + 15], sg[i + 16]]); }
const inModel = (x, z) => modelRects.some((q) => { let s = 0; for (let k = 0; k < 4; k++) { const ax = q[k * 2], az = q[k * 2 + 1], bx = q[(k * 2 + 2) % 8], bz = q[(k * 2 + 3) % 8], c = (bx - ax) * (z - az) - (bz - az) * (x - ax); if (c > 0) s++; else if (c < 0) s--; } return Math.abs(s) === 4; });
const pt = { x: 0, z: 0 };
// Đứng được tại (x,z): không bị tường đẩy đi, không ở dưới nước (trừ khi đang trên mặt cầu đi bộ).
export function standable(x, z) {
  need(x, z); pt.x = x; pt.z = z; nav.collide(pt, R, false, 0);
  if (Math.hypot(pt.x - x, pt.z - z) > 0.02) return false;
  if (nav.deckAt(x, z, 0)) return true;
  return !nav.isWater(x, z) && !ctx.insideSolid(x, z) && !inModel(x, z);
}
// Điểm nằm trong lòng một làn xe của cầu nâng (đi xe lên được: gen_check đã kiểm tra cầu nối liền với mạng đường).
export const onBridge = (x, z) => !!nav.elevatedAt(x, z, Infinity) && nav.eY > 0.7 && nav.eIn;
const onStreet = (x, z) => { const h = nav.nearestRoad(x, z, 12, (r) => r.veh && r.kind <= K.residential && !r.elev && !r.skip); return !!h && h.d < h.r.w / 2; };

// ----- liên thông với mạng đường -----
// Lưới toàn cục bước 0,4 m. connected(x,z): từ ô này có đi bộ ra được lòng đường xe chạy không (loang một hạt giống,
// nhớ kết quả theo từng vùng liên thông nên hỏi nhiều lần vẫn nhanh).
const gi = (v) => Math.round(v / STEP), gkey = (i, j) => i * 100003 + j, good = new Set(), bad = new Set();
export function connected(x, z, maxR = 300) {
  const i0 = gi(x), j0 = gi(z), k0 = gkey(i0, j0);
  if (good.has(k0)) return true; if (bad.has(k0)) return false;
  if (!standable(i0 * STEP, j0 * STEP)) return false;
  const seen = new Set([k0]), q = [i0, j0], lim = Math.floor(maxR / STEP); let ok = false;
  for (let h = 0; h < q.length && !ok; h += 2) {
    const i = q[h], j = q[h + 1];
    if (good.has(gkey(i, j)) || onStreet(i * STEP, j * STEP)) { ok = true; break; }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const a = i + di, b = j + dj, k = gkey(a, b); if (seen.has(k) || bad.has(k) || Math.abs(a - i0) > lim || Math.abs(b - j0) > lim) continue;
      seen.add(k); if (standable(a * STEP, b * STEP)) q.push(a, b);
    }
  }
  const into = ok ? good : bad; for (let h = 0; h < q.length; h += 2) into.add(gkey(q[h], q[h + 1]));
  return ok;
}
// Chỗ đứng thoáng: cả vòng tròn bán kính `clear` quanh điểm đều đứng được (để đặt người chơi khi đi nhanh).
export function roomy(x, z, clear = 0.8) {
  if (!standable(x, z)) return false;
  for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.2832; if (!standable(x + Math.cos(a) * clear, z + Math.sin(a) * clear)) return false; }
  return true;
}
// Điểm đóng dấu (x,z) bán kính radius có tới được không: có ô đứng được nối ra đường, hoặc nằm trên làn xe của cầu nâng.
// Trả về { ok, at: ô gần tâm nhất tới được, bridge, why }.
export function reach(x, z, radius) {
  const n = Math.floor((radius - 0.6) / STEP), cells = [];
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) { const d = Math.hypot(i, j) * STEP; if (d <= radius - 0.6) cells.push([d, x + i * STEP, z + j * STEP]); }
  cells.sort((a, b) => a[0] - b[0]);
  let stand = 0;
  for (const [, cx, cz] of cells) if (onBridge(cx, cz)) return { ok: true, at: [cx, cz], bridge: true };
  for (const [, cx, cz] of cells) { if (!standable(cx, cz)) continue; stand++; if (connected(cx, cz)) return { ok: true, at: [cx, cz] }; }
  return { ok: false, why: stand ? `${stand} ô đứng được trong bán kính đóng dấu nhưng đều bị vây kín, không ra tới đường` : 'không có chỗ đứng nào trong bán kính đóng dấu' };
}
// Chỗ đứng thoáng, nối ra đường, gần (x,z) nhất trong bán kính maxR (dò theo vòng tròn lớn dần). null nếu không có.
export function anchor(x, z, maxR = 260, clear = 0.8) {
  for (let r = 0; r <= maxR; r += 1) {
    const m = Math.max(1, Math.ceil((6.2832 * r) / 1.2));
    for (let k = 0; k < m; k++) { const a = (k / m) * 6.2832, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (roomy(px, pz, clear) && connected(px, pz)) return [+px.toFixed(1), +pz.toFixed(1)]; }
  }
  return null;
}
// Dò từ (x,z) theo hướng (dx,dz) từ khoảng cách d0: chỗ đứng thoáng nối ra đường đầu tiên (đứng trước mặt công trình).
export function ahead(x, z, dx, dz, d0 = 4, d1 = 90) {
  for (let d = d0; d <= d1; d += 0.5) {
    const px = x + dx * d, pz = z + dz * d; if (!(roomy(px, pz, 1.2) && connected(px, pz))) continue;
    const qx = px + dx * 2, qz = pz + dz * 2; // lùi thêm 2 m cho thoáng nếu được
    return roomy(qx, qz, 1.2) && connected(qx, qz) ? [+qx.toFixed(1), +qz.toFixed(1)] : [+px.toFixed(1), +pz.toFixed(1)];
  }
  return null;
}
export { sites, nav, ctx, world };

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const args = process.argv.slice(2), verbose = args.includes('--verbose'), ids = args.filter((a) => !a.startsWith('--'));
  let fails = 0; const t0 = performance.now();
  for (const p of places) {
    if (ids.length && !ids.includes(p.id)) continue;
    const radius = p.kind === 'food' ? 7 : p.type === 'lake' || p.type === 'park' ? 26 : 16; // như game/passport.js
    const r = reach(p.x, p.z, radius);
    if (!r.ok) { fails++; console.error(`✗ ${p.id} (${p.x}, ${p.z}): ${r.why}`); }
    else if (verbose) console.log(`✓ ${p.id.padEnd(28)} tới được${r.bridge ? ' (trên mặt cầu)' : ''}, chỗ gần tâm nhất cách ${Math.hypot(r.at[0] - p.x, r.at[1] - p.z).toFixed(1)} m`);
    // chỗ đặt người chơi khi đi nhanh: phải thoáng, nối ra đường (hoặc trên mặt cầu), và nằm trong bán kính đóng dấu
    if (!p.s) { fails++; console.error(`✗ ${p.id}: thiếu chỗ đứng khi đi nhanh (trường s)`); }
    else if (!(onBridge(p.s[0], p.s[1]) || (roomy(p.s[0], p.s[1], 0.6) && connected(p.s[0], p.s[1])))) { fails++; console.error(`✗ ${p.id}: chỗ đứng khi đi nhanh (${p.s}) bị kẹt hoặc không nối ra đường`); }
  }
  console.log(`${places.length} điểm hộ chiếu, ${fails} lỗi (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
  if (fails) process.exit(1);
}
