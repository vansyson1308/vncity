// Danh mục mô hình cho xưởng vẽ (/dev/studio.html, tools/studio.mjs) và trình xem cũ (/dev/model.html).
// Không phụ thuộc three.js hay trình duyệt: tools/studio.mjs nạp tệp này trong Node để soát lỗi.
import { motorbike, car, bus, cyclo } from '../src/models/vehicles.js';
import { tree, streetLamp, parkLamp } from '../src/models/street.js';
import { SITES } from '../src/world/landmarks/sites.js';
import { MAT } from '../src/core/geo.js';

export const REGISTRY = {
  bike: (g) => { g.push().move(-1.2, 0, 0); motorbike(g, 'wave', 1); g.pop().push().move(1.2, 0, 0); motorbike(g, 'scooter', 1); g.pop().push().move(0, 0, 1.4); motorbike(g, 'cub', 0); g.pop(); },
  car: (g) => { g.push().move(0, 0, -1.4); car(g, false); g.pop().push().move(0, 0, 1.4); car(g, true); g.pop(); },
  bus: (g) => bus(g), cyclo: (g) => cyclo(g),
  trees: (g, { lf }) => { ['xacu', 'sau', 'bang', 'banglang', 'phuong', 'lieu', 'hoasua'].forEach((k, i) => { tree(g, i * 9 - 27, 0, 100 + i * 7, k, 0, 0, lf); tree(g, i * 9 - 27, 14, 100 + i * 7, k, 1); }); },
  lamps: (g) => { streetLamp(g, -3, 0, 0, true); streetLamp(g, 0, 0, 0, false); parkLamp(g, 3, 0); },
  // bảng mẫu chất liệu chi tiết: mỗi chất liệu một mảng tường 3 × 3 m, một mái dốc, một cột tròn và một ô sàn
  mats: (g) => {
    const S = [['brick', 0xa5553c], ['stone', 0x9a968c], ['plaster', 0xd9b25a], ['tile', 0x9a4a32], ['wood', 0x6b4226], ['rust', 0x4a3a34], ['concrete', 0x9b9a94], ['mossy', 0x8d8a7c], ['pave', 0xa8553f], ['lacquer', 0x8e1b16]];
    S.forEach(([k, col], i) => {
      const x = (i - (S.length - 1) / 2) * 4.2;
      g.push().move(x, 0, 0).color(col).mat(MAT[k]);
      g.box(-1.5, 0, -0.15, 1.5, 3, 0.15);                                             // tường
      g.quad([-1.5, 3, 0.15], [1.5, 3, 0.15], [1.5, 4.4, -1.6], [-1.5, 4.4, -1.6]);     // mái dốc
      g.cyl(0, 0, 1.6, 0.28, 0.28, 2.4, 14);                                           // cột tròn
      g.quad([-1.5, 0.02, 3.6], [1.5, 0.02, 3.6], [1.5, 0.02, 0.6], [-1.5, 0.02, 0.6]); // sàn
      g.mat().pop();
    });
  },
};
// ngân sách tam giác cho từng loại (công trình mặc định 8.000)
export const BUDGET = { bike: 6000, car: 3000, bus: 2500, cyclo: 2500, trees: 40000, lamps: 1500, mats: 2000 };
export const LANDMARKS = [...new Set(SITES.map((s) => s.id))];
export const ALL = [...LANDMARKS.map((id) => 'lm:' + id), ...Object.keys(REGISTRY)];

// Dựng mô hình tên `name` vào g (và lf cho tán lá). load: hàm nạp mô-đun công trình theo id.
export async function buildModel(name, g, lf, load) {
  if (name.startsWith('lm:')) { const mod = await load(name.slice(3)); mod.build(g, { lf }); return; }
  await REGISTRY[name](g, { lf });
}
