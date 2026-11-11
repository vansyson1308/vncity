// Danh mục mô hình cho trình xem /dev/model.html
import { motorbike, car, bus, cyclo } from '../src/models/vehicles.js';
import { tree, streetLamp, parkLamp } from '../src/models/street.js';
export const REGISTRY = {
  bike: (g) => { g.push().move(-1.2, 0, 0); motorbike(g, 'wave', 1); g.pop().push().move(1.2, 0, 0); motorbike(g, 'scooter', 1); g.pop().push().move(0, 0, 1.4); motorbike(g, 'cub', 0); g.pop(); },
  car: (g) => { g.push().move(0, 0, -1.4); car(g, false); g.pop().push().move(0, 0, 1.4); car(g, true); g.pop(); },
  bus: (g) => bus(g), cyclo: (g) => cyclo(g),
  trees: (g, { lf }) => { ['xacu', 'sau', 'bang', 'banglang', 'phuong', 'lieu', 'hoasua'].forEach((k, i) => { tree(g, i * 9 - 27, 0, 100 + i * 7, k, 0, 0, lf); tree(g, i * 9 - 27, 14, 100 + i * 7, k, 1); }); },
  lamps: (g) => { streetLamp(g, -3, 0, 0, true); streetLamp(g, 0, 0, 0, false); parkLamp(g, 3, 0); },
};
