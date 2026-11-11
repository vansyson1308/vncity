// Danh mục mô hình cho xưởng vẽ (/dev/studio.html, tools/studio.mjs) và trình xem cũ (/dev/model.html).
// Không phụ thuộc three.js hay trình duyệt: tools/studio.mjs nạp tệp này trong Node để soát lỗi.
import { motorbike, car, bus, cyclo } from '../src/models/vehicles.js';
import { tree, streetLamp, parkLamp, namePole, signPlate, signalMast, signalPost, cabinet, kiosk, busSign, busShelter, parkSign, speakers, pennants, houseFlag, hoardingPanel, crane, excavator, siteCabin, treeShrine } from '../src/models/street.js';
import { G } from '../src/core/geo.js';
import { PLATE_W, PLATE_H, PLATE_BLUE, sigCode } from '../src/world/streetnames.js';
import { SITES } from '../src/world/landmarks/sites.js';
import { MAT } from '../src/core/geo.js';

export const REGISTRY = {
  bike: (g) => { g.push().move(-1.2, 0, 0); motorbike(g, 'wave', 1); g.pop().push().move(1.2, 0, 0); motorbike(g, 'scooter', 1); g.pop().push().move(0, 0, 1.4); motorbike(g, 'cub', 0); g.pop(); },
  car: (g) => { g.push().move(0, 0, -1.4); car(g, false); g.pop().push().move(0, 0, 1.4); car(g, true); g.pop(); },
  bus: (g) => bus(g), cyclo: (g) => cyclo(g),
  trees: (g, { lf }) => { ['xacu', 'sau', 'bang', 'banglang', 'phuong', 'lieu', 'hoasua'].forEach((k, i) => { tree(g, i * 9 - 27, 0, 100 + i * 7, k, 0, 0, lf); tree(g, i * 9 - 27, 14, 100 + i * 7, k, 1); }); },
  lamps: (g) => { streetLamp(g, -3, 0, 0, true); streetLamp(g, 0, 0, 0, false); parkLamp(g, 3, 0); },
  // cây theo phố thêm ở đợt 3: nhội, xà cừ cổ thụ, cơm nguội vàng, đa, lộc vừng, cây non có cọc chống
  trees2: (g, { lf }) => { ['nhoi', 'xacuco', 'comnguoi', 'da', 'locvung', 'non'].forEach((k, i) => { tree(g, i * 13 - 32, 0, 300 + i * 7, k, 0, 0, lf, 1); tree(g, i * 13 - 32, 18, 300 + i * 7, k, 1, 0, null, 1); }); },
  // đồ đạc đường phố (src/world/gen/furniture.js). Phần có chữ, có đèn nằm ở lưới riêng dùng bảng đồ đạc; ở xưởng vẽ gộp chung
  // vào một lưới và cho mọi ô chữ trỏ vào ô trắng, nên biển chỉ hiện màu nền.
  furniture: (g) => {
    const pg = new G(), u = [g.u0, g.v0, g.u0, g.v0], L = { digit: u, pedStop: u, pedGo: u }, code = (k) => sigCode(k, 0, false, 0);
    pg.u0 = g.u0; pg.v0 = g.v0;
    namePole(g, -12, 0); for (const a of [0, -Math.PI / 2]) { pg.push().move(-12, 0, 0).rotY(a); signPlate(pg, 0.058, 2.13, PLATE_W, PLATE_H, u, PLATE_BLUE); pg.pop(); }
    signalMast(g, pg, -7, 0, 0, 0, { arm: 4.6, code, L }); signalPost(g, pg, -9.5, 0, 0, 0, { code, L });
    cabinet(g, -5, 0, 0, 0, 3, false); cabinet(g, -3.6, 0, 0, 0, 4, true); kiosk(g, pg, -0.8, 0, 0, 0, 2, u);
    busSign(g, pg, 1.6, 1.2, 0, Math.PI, u); busShelter(g, 4.6, 0, 0, 0); parkSign(g, pg, 8, 0, 0, 0, u);
    streetLamp(g, 10, 0, 0, true); speakers(g, 10, 0, 0, 0, 6.3); streetLamp(g, 13, 0, 0, true); pennants(g, pg, 13, 0, 0, Math.PI / 2, u, u);
    g.push().move(15.5, 4, 0); houseFlag(g, u, 1); g.pop();
    for (let i = 0; i < 4; i++) hoardingPanel(g, [-12 + i * 2, -6], [-10 + i * 2, -6], 2.3, 0, 1, i % 2 ? [0.72, 0.74, 0.7] : [0.04, 0.17, 0.4], i === 1 ? 1 : i === 3 ? 2 : 0, i);
    siteCabin(g, 0, -8, 0, 0); excavator(g, 8, -8, 0, 0); crane(g, 16, -8, 0, 0, 0, 22);
    tree(g, -18, 0, 5, 'da', 0, 0, null, 0); g.push().move(-18, 0, 0); treeShrine(g, 0.5); g.pop();
    g.add(pg);
  },
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
export const BUDGET = { bike: 6000, car: 3000, bus: 2500, cyclo: 2500, trees: 40000, trees2: 40000, lamps: 1500, mats: 2000, furniture: 6000 };
export const LANDMARKS = [...new Set(SITES.map((s) => s.id))];
export const ALL = [...LANDMARKS.map((id) => 'lm:' + id), ...Object.keys(REGISTRY)];

// Dựng mô hình tên `name` vào g (và lf cho tán lá). load: hàm nạp mô-đun công trình theo id.
export async function buildModel(name, g, lf, load) {
  if (name.startsWith('lm:')) { const mod = await load(name.slice(3)); mod.build(g, { lf }); return; }
  await REGISTRY[name](g, { lf });
}
// xe cộ vẽ bằng instancing nên không gắn chất liệu chi tiết; cây và đèn chủ yếu là tán lá, kim loại sơn
export const PLAIN_OK = new Set(['bike', 'car', 'bus', 'cyclo', 'trees', 'trees2', 'lamps', 'furniture']);
