// Đóng gói tài nguyên cho bản web từ repo craft-anything (examples/game-hanoi-city/assets).
// Dùng: CRAFT_DIR=/đường/dẫn/craft-anything node tools/build_assets.mjs
// Ra: web/public/assets/ (không commit, CI tự build lại).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, textureCompress, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const CRAFT = process.env.CRAFT_DIR || path.resolve('../../vansyson1308/craft-anything');
const SRC = path.join(CRAFT, 'examples/game-hanoi-city/assets');
const OUT = path.resolve('public/assets');
if (!fs.existsSync(SRC)) { console.error('Không thấy', SRC, '- đặt CRAFT_DIR'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

// [nguồn, đích, cạnh ảnh tối đa]
const MODELS = [
  ['hq/landmarks/thap_rua.glb', 'thap_rua.glb', 1024],
  ['hq/landmarks/den_ngoc_son.glb', 'den_ngoc_son.glb', 1024],
  ['hq/landmarks/cau_the_huc.glb', 'cau_the_huc.glb', 1024],
  ['hq/landmarks/thap_but_dai_nghien.glb', 'thap_but_dai_nghien.glb', 1024],
  ['hq/people/minh_lod1.glb', 'minh.glb', 512],
  ['hq/people/nguoi_di_duong_01_lod2.glb', 'khach_01.glb', 256],
  ['hq/people/nguoi_di_duong_02_lod2.glb', 'khach_02.glb', 256],
  ['hq/people/nguoi_di_duong_03_lod2.glb', 'khach_03.glb', 256],
  ['hq/animals/cho_co_lod1.glb', 'cho_co.glb', 512],
  ['hq/street/xe_may_01_chay_lod1.glb', 'xe_may.glb', 512],
  ['hq/street/den_long_01_lod1.glb', 'den_long_01.glb', 256],
  ['hq/street/den_long_02_lod1.glb', 'den_long_02.glb', 256],
  ['hq/street/den_long_03_lod1.glb', 'den_long_03.glb', 256],
  ['hq/street/den_duong_01_lod1.glb', 'den_duong.glb', 256],
  ['hq/street/hang_rao_ho_lod1.glb', 'hang_rao_ho.glb', 256],
  ['hq/street/ghe_nhua_do_lod1.glb', 'ghe_do.glb', 256],
  ['hq/street/ghe_nhua_xanh_lod1.glb', 'ghe_xanh.glb', 256],
  ['hq/street/ban_nhua_lod1.glb', 'ban_nhua.glb', 256],
  ['hq/street/cot_bien_ten_pho_lod1.glb', 'bien_ten_pho.glb', 256],
  ['hq/trees/xa_cu_lod1.glb', 'xa_cu.glb', 512],
];

async function model([src, dst, size]) {
  const doc = await io.read(path.join(SRC, src));
  await doc.transform(dedup(), weld(), resample(), prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(path.join(OUT, dst), doc);
}

// Chỉ giữ các động tác cần dùng, bỏ lưới của anim.glb.
const CLIPS = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Driving_Loop', 'Sitting_Idle_Loop', 'Dance_Loop', 'Interact', 'Idle_Talking_Loop', 'Walk_Formal_Loop'];
async function anims() {
  const doc = await io.read(path.join(SRC, 'anim.glb'));
  const root = doc.getRoot();
  for (const a of root.listAnimations()) if (!CLIPS.includes(a.getName())) a.dispose();
  for (const n of root.listNodes()) { if (n.getMesh()) n.setMesh(null); n.setSkin(null); }
  for (const m of root.listMeshes()) m.dispose();
  await doc.transform(prune({ keepLeaves: true }), resample(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(path.join(OUT, 'anim.glb'), doc);
}

const MATS = ['duong_nhua', 'via_he_da_xam', 'gach_lat_ho', 'co'];
async function mats() {
  fs.mkdirSync(path.join(OUT, 'tex'), { recursive: true });
  for (const m of MATS) for (const k of ['basecolor', 'normal']) {
    await sharp(path.join(SRC, 'hq/materials', m, k + '.png')).resize(1024, 1024).webp({ quality: 85 }).toFile(path.join(OUT, 'tex', `${m}_${k}.webp`));
  }
  await sharp(path.join(SRC, 'hq/materials/nuoc_ho/normal.png')).resize(512, 512).webp({ quality: 90 }).toFile(path.join(OUT, 'tex/nuoc_ho_normal.webp'));
  await sharp(path.join(SRC, 'hq/trees/xa_cu_billboard.png')).resize({ width: 512 }).webp({ quality: 85, alphaQuality: 90 }).toFile(path.join(OUT, 'tex/xa_cu_billboard.webp'));
  for (const t of ['asphalt', 'paving', 'concrete', 'grass']) fs.copyFileSync(path.join(SRC, 'tex', t + '.jpg'), path.join(OUT, 'tex', t + '.jpg'));
}

// Bản đồ OSM (ODbL): giữ nguyên dữ liệu, chỉ thu gọn JSON.
function city() {
  const c = JSON.parse(fs.readFileSync(path.join(SRC, 'hoankiem.json'), 'utf8'));
  fs.writeFileSync(path.join(OUT, 'hoankiem.json'), JSON.stringify(c));
  fs.copyFileSync(path.join(SRC, 'signs.json'), path.join(OUT, 'signs.json'));
  for (const a of ['ui_bam.ogg', 'ui_meo.ogg', 'cho_sua_01.ogg']) fs.copyFileSync(path.join(SRC, 'hq/audio', a), path.join(OUT, a));
}

await MeshoptEncoder.ready;
// Địa danh lấy từ nội dung game vncity (game/content/world/landmarks.json), song ngữ.
function tour() {
  const src = path.resolve('../game/content/world/landmarks.json');
  const items = JSON.parse(fs.readFileSync(src, 'utf8')).items
    .map(({ id, kind, name, description, location, built_year }) => ({ id, kind, name, description, location, built_year }));
  fs.writeFileSync(path.join(OUT, 'landmarks.json'), JSON.stringify(items));
}

const t0 = Date.now();
city();
tour();
await mats();
await anims();
for (const m of MODELS) { await model(m); process.stdout.write('.'); }
let total = 0;
for (const f of fs.readdirSync(OUT, { recursive: true })) { const p = path.join(OUT, f); if (fs.statSync(p).isFile()) total += fs.statSync(p).size; }
console.log(`\nXong ${((Date.now() - t0) / 1000).toFixed(0)} s, ${(total / 1e6).toFixed(1)} MB trong ${OUT}`);
