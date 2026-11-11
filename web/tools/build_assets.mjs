// Đóng gói mô hình người (viewer/assets/walker.glb, Microsoft Rocketbox, giấy phép MIT) cho bản web:
//   public/models/human.glb      nhân vật người chơi (ảnh WebP 1024, nén meshopt)
//   public/models/human_lod.glb  bản nhẹ cho người đi bộ (lưới rút gọn, ảnh 256)
//   public/models/human_far.glb  bản rất nhẹ cho người lái xe trong dòng xe (màu lấy theo đỉnh)
// Kết quả được commit; chỉ chạy lại khi đổi mô hình gốc: node tools/build_assets.mjs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, textureCompress, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('../viewer/assets/walker.glb');
const OUT = path.resolve('public/models');
fs.mkdirSync(OUT, { recursive: true });
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

// Rút gọn mọi mảnh lưới của mô hình trong MỘT lần gọi meshoptimizer (chung bộ đỉnh): thuật toán coi các đỉnh trùng
// vị trí là một nên đường nối giữa các mảnh (cổ áo, thắt lưng) không bị hở như khi rút gọn từng mảnh riêng.
const simplifyTogether = (ratio, error) => (doc) => {
  for (const mesh of doc.getRoot().listMeshes()) {
    const prims = mesh.listPrimitives(); let total = 0, n = 0;
    const offs = prims.map((p) => { const o = total; total += p.getAttribute('POSITION').getCount(); n += p.getIndices().getCount(); return o; });
    const pos = new Float32Array(total * 3), idx = new Uint32Array(n); let k = 0;
    prims.forEach((p, i) => { pos.set(p.getAttribute('POSITION').getArray(), offs[i] * 3); const a = p.getIndices().getArray(); for (let j = 0; j < a.length; j++) idx[k++] = a[j] + offs[i]; });
    const [out] = MeshoptSimplifier.simplify(idx, pos, 3, Math.floor((n * ratio) / 3) * 3, error, []);
    prims.forEach((p, i) => {
      const lo = offs[i], hi = lo + p.getAttribute('POSITION').getCount(), remap = new Map(), ni = [];
      for (let j = 0; j < out.length; j += 3) { if (out[j] < lo || out[j] >= hi) continue; for (let c = 0; c < 3; c++) { const v = out[j + c] - lo; if (!remap.has(v)) remap.set(v, remap.size); ni.push(remap.get(v)); } }
      if (!ni.length) { p.dispose(); return; }
      for (const sem of p.listSemantics()) {
        const acc = p.getAttribute(sem), m = acc.getElementSize(), src = acc.getArray(), dst = new src.constructor(remap.size * m);
        for (const [from, to] of remap) for (let c = 0; c < m; c++) dst[to * m + c] = src[from * m + c];
        p.setAttribute(sem, acc.clone().setArray(dst));
      }
      p.setIndices(p.getIndices().clone().setArray(new Uint16Array(ni)));
    });
  }
};

async function variant(file, { tex, ratio, clips, error = 0.02, poseOnly = false }) {
  const doc = await io.read(SRC);
  for (const a of doc.getRoot().listAnimations()) {
    if (!clips.includes(a.getName())) { a.dispose(); continue; }
    // đoạn đứng yên dài 11 giây: chỉ giữ tư thế đầu (hai khoá) cho các bản nhẹ
    if (a.getName() === 'idle' && poseOnly) for (const sm of a.listSamplers()) {
      const inp = sm.getInput(), out = sm.getOutput(), n = out.getElementSize();
      sm.setInput(inp.clone().setArray(new Float32Array([0, 1]))); const o = out.getArray();
      const two = new o.constructor(n * 2); two.set(o.subarray(0, n), 0); two.set(o.subarray(0, n), n); sm.setOutput(out.clone().setArray(two));
    }
  }
  const steps = [dedup(), weld(), resample()];
  if (ratio < 1) steps.push(simplifyTogether(ratio, error));
  steps.push(prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 80 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await doc.transform(...steps);
  await io.write(path.join(OUT, file), doc);
  let tris = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
  console.log(file, (fs.statSync(path.join(OUT, file)).size / 1024).toFixed(0), 'KB,', tris, 'tam giác');
}
await variant('human.glb', { tex: 1024, ratio: 1, clips: ['idle', 'walk', 'run', 'jog'] });
await variant('human_lod.glb', { tex: 256, ratio: 0.3, clips: ['idle', 'walk'], poseOnly: true });
await variant('human_far.glb', { tex: 64, ratio: 0.085, error: 0.08, clips: ['idle'], poseOnly: true });
fs.copyFileSync(path.resolve('../viewer/assets/ROCKETBOX_LICENSE.md'), path.join(OUT, 'ROCKETBOX_LICENSE.md'));
