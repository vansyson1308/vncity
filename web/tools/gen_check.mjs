// Kiểm tra nhanh bộ sinh hình (không cần trình duyệt): dựng mọi ô phố, báo thời gian và số tam giác.
// Dùng: node tools/gen_check.mjs [tất cả | cx,cz ...]
import fs from 'node:fs';
import { decodeWorld, CS } from '../src/world/data.js';
import { buildContext } from '../src/world/gen/context.js';
import { genGround } from '../src/world/gen/ground.js';
import { genBuildings } from '../src/world/gen/buildings.js';
import { genProps } from '../src/world/gen/props.js';
import { resolveSites } from '../src/world/landmarks/sites.js';

const t0 = performance.now();
const world = decodeWorld(JSON.parse(fs.readFileSync(new URL('../public/world/hanoi.json', import.meta.url), 'utf8')));
const sites = resolveSites(world);
const ctx = buildContext(world, sites);
console.log('công trình:', sites.map((s) => `${s.id}${s.names && !s.found ? ' (KHÔNG THẤY trong OSM, dùng toạ độ dự phòng)' : ''}`).join(', '));
console.log(`khởi tạo ${(performance.now() - t0).toFixed(0)} ms, lưới ${world.nx}×${world.nz} ô`);
const args = process.argv.slice(2);
const list = [];
if (args.length && args[0] !== 'all') for (const a of args) list.push(a.split(',').map(Number));
else for (let cx = 0; cx < world.nx; cx++) for (let cz = 0; cz < world.nz; cz++) list.push([cx, cz]);
let worst = 0, total = 0, tris = { ground: 0, bld: 0, near: 0, far: 0 }, maxTris = { ground: 0, bld: 0, near: 0, far: 0 }, errors = 0;
for (const [cx, cz] of list) {
  const t = performance.now();
  try {
    const g = genGround(ctx, cx, cz), b = genBuildings(ctx, cx, cz), p = genProps(ctx, cx, cz, b);
    const n = { ground: g.ground.idx.length / 3, bld: b.mesh.idx.length / 3, near: p.near.idx.length / 3, far: p.far.idx.length / 3 };
    for (const k in n) { tris[k] += n[k]; maxTris[k] = Math.max(maxTris[k], n[k]); }
    for (const arr of [g.ground.pos, b.mesh.pos, p.near.pos, p.far.pos]) for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) { throw new Error('NaN trong toạ độ'); }
    if (args.length && args[0] !== 'all') console.log(cx, cz, n, `${(performance.now() - t).toFixed(1)} ms`);
  } catch (e) { errors++; console.error('LỖI ô', cx, cz, e.stack.split('\n').slice(0, 4).join('\n')); if (errors > 5) break; }
  const ms = performance.now() - t; worst = Math.max(worst, ms); total += ms;
}
const f = (o) => Object.entries(o).map(([k, v]) => `${k} ${Math.round(v)}`).join(', ');
console.log(`${list.length} ô: trung bình ${(total / list.length).toFixed(1)} ms, chậm nhất ${worst.toFixed(0)} ms, lỗi ${errors}`);
console.log('tam giác trung bình mỗi ô:', f(Object.fromEntries(Object.entries(tris).map(([k, v]) => [k, v / list.length]))));
console.log('tam giác nhiều nhất một ô:', f(maxTris));
// ngân sách: một ô phố dày đặc nhất cũng không được vượt các mức này (xem docs/17, mục hiệu năng)
const BUDGET = { ground: 6000, bld: 9000, near: 70000, far: 12000 };
for (const k in BUDGET) if (maxTris[k] > BUDGET[k]) { console.error(`VƯỢT NGÂN SÁCH ${k}: ${maxTris[k]} > ${BUDGET[k]}`); errors++; }
if (worst > 2500) { console.error(`Ô chậm nhất ${worst.toFixed(0)} ms: quá chậm`); errors++; }
if (errors) process.exit(1);
