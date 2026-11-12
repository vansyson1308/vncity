// Kiểm biển hiệu và số nhà trên toàn bản đồ (không cần trình duyệt): node tools/sign_check.mjs
//   1. gian do gen/buildings.js frontStubs tính riêng phải khớp đúng gian genBuildings dựng (ô bên cạnh dựa vào đó để soát qua ranh giới ô)
//   2. hai cửa hàng sát nhau không trùng chữ; trong 30 m không có hai biển giống hệt (cùng chữ, cùng vẻ)
//   3. hai nhà sát nhau cùng phố, cùng lề không trùng số nhà; số nhà không giảm dọc phố
//   4. công trình có tên, công sở, đền chùa, nhà thờ không có biển cửa hàng
// In số liệu; thoát mã 1 nếu mục 1 hoặc mục 4 sai.
import fs from 'node:fs';
import { decodeWorld, ST } from '../src/world/data.js';
import { buildContext } from '../src/world/gen/context.js';
import { genBuildings, frontStubs } from '../src/world/gen/buildings.js';
import { resolveSites } from '../src/world/landmarks/sites.js';
import { SIGNS } from '../src/world/signs.js';

const world = decodeWorld(JSON.parse(fs.readFileSync(new URL('../public/world/hanoi.json', import.meta.url), 'utf8')));
const ctx = buildContext(world, resolveSites(world));
const shops = [], numbered = []; let stubBad = 0, civicShops = 0;
for (let cx = 0; cx < world.nx; cx++) for (let cz = 0; cz < world.nz; cz++) {
  const r = genBuildings(ctx, cx, cz), stubs = new Map();
  for (const b of ctx.chunkBld.get(cx * 1000 + cz) || []) for (const q of frontStubs(ctx, b)) stubs.set(q.rk, q);
  for (const f of [...r.fronts, ...r.doors]) {
    const x = f.door ? f.x : (f.x0 + f.x1) / 2, z = f.door ? f.z : (f.z0 + f.z1) / 2;
    if (f.door || (f.shop && f.sign) || f.num) {
      const q = stubs.get(f.rk);
      if (!q || Math.abs(q.S - f.S) > 1e-3 || q.side !== f.side || Math.hypot(q.x - x, q.z - z) > 1e-3 || q.num !== f.num || (!f.door && f.vi >= 0 && q.sign !== f.sign0)) stubBad++;
      stubs.delete(f.rk);
    }
    if (f.door) continue;
    const it = { f, x, z, ck: cx * 1000 + cz, name: f.road.name >= 0 ? 'n' + f.road.name : 'r' + f.road.i };
    if (f.shop && f.sign) {
      shops.push(it);
      const b = f.b; if (b.hero || f.civic === 1 || b.style === ST.PUBLIC || b.style === ST.TEMPLE || b.style === ST.CHURCH) civicShops++;
    }
    if (f.num) numbered.push(it);
  }
  stubBad += stubs.size; // gian tính riêng mà genBuildings không dựng
}
const near = (list, R, fn) => {
  const grid = new Map(), K = (x, z) => Math.floor(x / R) + ',' + Math.floor(z / R);
  for (const q of list) { const k = K(q.x, q.z); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(q); }
  for (const a of list) {
    const gx = Math.floor(a.x / R), gz = Math.floor(a.z / R);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const b of grid.get(gx + i + ',' + (gz + j)) || []) if (b !== a && (b.x > a.x || (b.x === a.x && b.z > a.z))) { const d = Math.hypot(a.x - b.x, a.z - b.z); if (d <= R) fn(a, b, d); }
  }
};
let adj = 0, adjSame = 0, same30 = 0, pairs30 = 0, numAdj = 0, numDup = 0; const ex = [];
near(shops, 30.5, (a, b, d) => {
  pairs30++;
  if (d < (a.f.w + b.f.w) / 2 + 1) { adj++; if (a.f.sign === b.f.sign) { adjSame++; if (ex.length < 6) ex.push(`${SIGNS[a.f.sign][0]} @${a.x.toFixed(0)},${a.z.toFixed(0)}`); } }
  if (a.f.sign === b.f.sign && a.f.sv === b.f.sv) same30++;
});
near(numbered, 12, (a, b, d) => { if (a.name !== b.name || a.f.side !== b.f.side || d >= (a.f.w + b.f.w) / 2 + 1.2) return; numAdj++; if (a.f.num === b.f.num && a.f.suf === b.f.suf) numDup++; });
const bySide = new Map(); let desc = 0, suf = 0;
for (const q of numbered) { const k = q.name + q.f.side; let l = bySide.get(k); if (!l) bySide.set(k, (l = [])); l.push(q.f); if (q.f.suf) suf++; }
for (const l of bySide.values()) { l.sort((a, b) => a.S - b.S); for (let i = 1; i < l.length; i++) if (l[i].num < l[i - 1].num) desc++; }
console.log(`1. gian tính riêng lệch gian dựng: ${stubBad}`);
console.log(`2. cửa hàng ${shops.length}; cặp sát nhau ${adj}, trùng chữ ${adjSame}${ex.length ? ' (' + ex.join('; ') + ')' : ''}; cặp trong 30 m ${pairs30}, giống hệt ${same30}`);
console.log(`3. nhà có biển số ${numbered.length} (${suf} nhà mang chữ A, B...); cặp sát nhau ${numAdj}, trùng số ${numDup}; số giảm dọc phố ${desc}`);
console.log(`4. biển cửa hàng trên công trình có tên, công sở, đền chùa, nhà thờ: ${civicShops}`);
process.exit(stubBad || civicShops ? 1 : 0);
