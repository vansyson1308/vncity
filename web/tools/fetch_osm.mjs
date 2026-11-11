// Tải dữ liệu OpenStreetMap (ODbL) cho vùng trung tâm Hà Nội qua API chính thức của OSM,
// lưu thô vào web/.cache/osm/ (không commit). Chạy một lần khi muốn làm mới bản đồ:
//   node tools/fetch_osm.mjs && node tools/build_world.mjs
// Sau máy chủ proxy: NODE_USE_ENV_PROXY=1 node tools/fetch_osm.mjs
import fs from 'node:fs';
import path from 'node:path';

// Khung bản đồ: Hồ Gươm, phố cổ, khu phố Pháp, Ba Đình, Văn Miếu, mép nam Hồ Tây, đầu cầu Long Biên.
export const BBOX = { w: 105.83, s: 21.019, e: 105.864, n: 21.05 };
const API = 'https://api.openstreetmap.org/api/0.6';
const OUT = path.resolve('.cache/osm');
const UA = 'hanoi-dao-pho-build/2.0 (one-off map extract)';
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
      if (r.status === 400) return { tooBig: true };
      if (r.ok) return { json: await r.json() };
      console.warn(r.status, url);
    } catch (e) { console.warn(String(e.cause || e), url); }
    await sleep(2000 * 2 ** i);
  }
  throw new Error('Không tải được ' + url);
}

async function tile(w, s, e, n, depth = 0) {
  const name = `t_${w.toFixed(5)}_${s.toFixed(5)}_${e.toFixed(5)}_${n.toFixed(5)}.json`;
  const file = path.join(OUT, name);
  if (fs.existsSync(file)) return [file];
  const r = await get(`${API}/map.json?bbox=${w},${s},${e},${n}`);
  if (r.tooBig) {
    if (depth > 3) throw new Error('Ô quá dày đặc');
    const mx = (w + e) / 2, my = (s + n) / 2, out = [];
    for (const [a, b, c, d] of [[w, s, mx, my], [mx, s, e, my], [w, my, mx, n], [mx, my, e, n]]) out.push(...await tile(a, b, c, d, depth + 1));
    return out;
  }
  fs.writeFileSync(file, JSON.stringify(r.json));
  console.log(name, r.json.elements.length, 'phần tử');
  await sleep(1200);
  return [file];
}

const NX = 4, NY = 4;
const files = [];
for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++) {
  const w = BBOX.w + ((BBOX.e - BBOX.w) * ix) / NX, e = BBOX.w + ((BBOX.e - BBOX.w) * (ix + 1)) / NX;
  const s = BBOX.s + ((BBOX.n - BBOX.s) * iy) / NY, n = BBOX.s + ((BBOX.n - BBOX.s) * (iy + 1)) / NY;
  files.push(...await tile(w, s, e, n));
}

// Gộp, bỏ trùng theo loại + id.
const seen = new Map();
for (const f of files) for (const el of JSON.parse(fs.readFileSync(f, 'utf8')).elements) seen.set(el.type[0] + el.id, el);

// Quan hệ đa giác (hồ, sông, công viên, toà nhà có sân trong) bị cắt ở mép khung: tải đủ thành viên.
const need = [];
for (const el of seen.values()) {
  if (el.type !== 'relation' || el.tags?.type !== 'multipolygon') continue;
  const t = el.tags;
  if (!(t.natural === 'water' || t.waterway || t.leisure === 'park' || t.landuse || t.building)) continue;
  if (el.members.some((m) => m.type === 'way' && !seen.has('w' + m.ref))) need.push(el.id);
}
console.log('Quan hệ cần tải đủ:', need.length);
for (const id of need) {
  const file = path.join(OUT, `rel_${id}.json`);
  if (!fs.existsSync(file)) {
    const r = await get(`${API}/relation/${id}/full.json`);
    if (!r.json) continue;
    fs.writeFileSync(file, JSON.stringify(r.json));
    await sleep(1200);
  }
  for (const el of JSON.parse(fs.readFileSync(file, 'utf8')).elements) if (!seen.has(el.type[0] + el.id)) seen.set(el.type[0] + el.id, el);
}

const all = [...seen.values()];
fs.writeFileSync(path.join(OUT, 'merged.json'), JSON.stringify({ bbox: BBOX, fetched: new Date().toISOString().slice(0, 10), elements: all }));
const count = (t) => all.filter((e) => e.type === t).length;
console.log(`Xong: ${count('node')} nút, ${count('way')} đường, ${count('relation')} quan hệ → ${path.join(OUT, 'merged.json')}`);
