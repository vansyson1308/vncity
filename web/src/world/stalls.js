// Bố cục một quán cóc vỉa hè (bàn thấp, ghế đẩu) tính từ vị trí của quán trong dữ liệu bản đồ. Dùng chung cho bộ sinh đồ vật
// (worker dựng bàn và các ghế trống) và đám đông (luồng chính đặt khách ngồi), để khách ngồi quanh bàn, quay mặt vào bàn, cùng
// màu ghế với quán, thay vì mỗi bên tự xếp một kiểu rồi ghế đè lên bàn, khách ngồi trùng ghế.
// i: chỉ số của quán trong mảng world.food (bội số của 3); kind: loại quán. Toạ độ cục bộ (mét): x dọc theo phố, z hướng từ lòng
// đường vào phía nhà, gốc ở cách mép đường 1,05 m.
import { hash } from '../core/util.js';

export function stallLayout(i, kind = 1) {
  const seed = (i * 40503) | 0, n = 1 + Math.floor(hash(seed, 1) * 2.4), red = hash(seed, 2) < 0.6, steel = kind === 0 && hash(seed, 3) < 0.5;
  const tables = [], spare = [], seats = [];
  for (let t = 0; t < n; t++) {
    const tx = (t - (n - 1) / 2) * 1.5; tables.push(tx);
    // bốn chỗ quanh mỗi bàn; chỗ nào có ghế thì hoặc là ghế trống dựng sẵn (spare), hoặc là chỗ của khách (seats, khách ngồi ghế của mình)
    [[-0.5, 0], [0.5, 0], [0, 0.5], [0, -0.48]].forEach(([sx, sz], k) => {
      if (hash(seed + t * 7 + k * 3, 4) >= 0.8) return;
      (hash(seed + t * 7 + k * 3, 5) < 0.35 ? spare : seats).push([tx + sx, sz, tx]); // [x, z, x của bàn]
    });
  }
  return { seed, red, steel, tables, spare, seats };
}
