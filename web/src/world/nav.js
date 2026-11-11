// Điều hướng và va chạm ở luồng chính: tra đường gần nhất, cao độ mặt đất (lòng đường thấp hơn vỉa hè),
// đẩy người và xe ra khỏi tường nhà, bờ kè.
import { CS, CURB, K, F_BRIDGE, isVehicle, roadY } from './data.js';
import { segDist2, pointInRing, clamp } from '../core/util.js';

const CELL = 16;
export class Nav {
  constructor(world) {
    this.world = world; this.b = world.bounds;
    this.grid = new Map(); this.gc = 40;
    for (const r of world.roads) {
      r.veh = isVehicle(r); r.bridge = !!(r.flags & F_BRIDGE);
      r.skip = r.bridge && !r.veh && world.names[r.name] !== 'Cầu Thê Húc' ? true : (r.kind === K.steps && r.bridge);
      if (r.skip) continue;
      const p = r.p;
      for (let i = 0; i < p.length - 2; i += 2) {
        const pad = r.w / 2 + 1, x0 = Math.min(p[i], p[i + 2]) - pad, x1 = Math.max(p[i], p[i + 2]) + pad, z0 = Math.min(p[i + 1], p[i + 3]) - pad, z1 = Math.max(p[i + 1], p[i + 3]) + pad;
        for (let cx = Math.floor(x0 / this.gc); cx <= Math.floor(x1 / this.gc); cx++) for (let cz = Math.floor(z0 / this.gc); cz <= Math.floor(z1 / this.gc); cz++) { const k = cx * 65537 + cz; let l = this.grid.get(k); if (!l) this.grid.set(k, (l = [])); l.push(r, i); }
      }
    }
    this.hasElev = world.roads.some((r) => r.elev);
    this.chunks = new Map(); // khoá ô → { segs, cells }
    this.decks = [];         // mặt cầu đi bộ được (cầu Thê Húc): { ax, az, bx, bz, w, y(t) }
    this._t = [0]; this.hit = { r: null, seg: 0, t: 0, d: 0, px: 0, pz: 0 };
  }

  // Đường gần nhất trong bán kính max (m). Kết quả dùng chung một đối tượng, đọc ngay sau khi gọi.
  nearestRoad(x, z, max, filter) {
    let bd = max * max, br = null, bs = 0, bt = 0; const gc = this.gc, t = this._t;
    for (let cx = Math.floor((x - max) / gc); cx <= Math.floor((x + max) / gc); cx++) for (let cz = Math.floor((z - max) / gc); cz <= Math.floor((z + max) / gc); cz++) {
      const l = this.grid.get(cx * 65537 + cz); if (!l) continue;
      for (let k = 0; k < l.length; k += 2) {
        const r = l[k]; if (filter && !filter(r)) continue;
        const i = l[k + 1], p = r.p, d = segDist2(x, z, p[i], p[i + 1], p[i + 2], p[i + 3], t);
        if (d < bd) { bd = d; br = r; bs = i; bt = t[0]; }
      }
    }
    if (!br) return null;
    const h = this.hit, p = br.p; h.r = br; h.seg = bs; h.t = bt; h.d = Math.sqrt(bd);
    h.px = p[bs] + (p[bs + 2] - p[bs]) * bt; h.pz = p[bs + 1] + (p[bs + 3] - p[bs + 1]) * bt;
    return h;
  }

  addDeck(d) { d.len = Math.hypot(d.bx - d.ax, d.bz - d.az); this.decks.push(d); }
  // Mặt cầu tại (x,z), nếu có. Kết quả: this.deckT (0..1 dọc cầu), this.deckS (lệch ngang, m).
  deckAt(x, z, pad = 0) {
    for (const d of this.decks) {
      const ux = (d.bx - d.ax) / d.len, uz = (d.bz - d.az) / d.len, t = ((x - d.ax) * ux + (z - d.az) * uz) / d.len, s = (x - d.ax) * uz - (z - d.az) * ux;
      if (t > -0.02 && t < 1.02 && Math.abs(s) < d.w / 2 + pad) { this.deckT = Math.min(1, Math.max(0, t)); this.deckS = s; return d; }
    }
    return null;
  }

  // Mặt cầu nâng tại (x,z) mà một người/xe đang ở cao độ y có thể đứng lên: mặt cầu không cao hơn y quá 1,2 m
  // (cao hơn thế là đang đi dưới gầm cầu). y = Infinity: lấy mặt cầu cao nhất. Trả về đường r hoặc null;
  // ghi this.eY (cao độ mặt cầu), this.eS (lệch ngang có dấu), this.eDx/eDz (hướng dọc cầu), this.eW, this.eIn (nằm hẳn trong lòng một mặt cầu).
  elevatedAt(x, z, y, pad = 0.5) {
    const gc = this.gc, l = this.grid.get(Math.floor(x / gc) * 65537 + Math.floor(z / gc)); if (!l) return null;
    let best = null, bd = 1e9; this.eIn = false;
    for (let k = 0; k < l.length; k += 2) {
      const r = l[k]; if (!r.elev) continue;
      const i = l[k + 1], p = r.p, ax = p[i], az = p[i + 1], L = r.cum[i / 2 + 1] - r.cum[i / 2] || 1e-6, dx = (p[i + 2] - ax) / L, dz = (p[i + 3] - az) / L;
      const u = (x - ax) * dx + (z - az) * dz; // quãng dọc đoạn (m)
      if ((i === 0 && u < -1) || (i === p.length - 4 && u > L + 1)) continue; // mặt cầu không có phần tròn thò ra ở hai đầu mút
      const uc = u < 0 ? 0 : u > L ? L : u, d = Math.hypot(x - ax - dx * uc, z - az - dz * uc); if (d > r.w / 2 + pad) continue;
      const ey = roadY(r, r.cum[i / 2] + uc);
      if (y < ey - 1.2) continue;
      // ưu tiên mặt cầu chứa điểm (gần tim nhất); chênh cao độ lớn (hai cầu chồng lên nhau) mới quyết định
      const score = d / (r.w / 2) + (y === Infinity ? -ey * 10 : Math.max(0, Math.abs(ey - y) - 0.5) * 10);
      if (d <= r.w / 2 - 0.45 && (y === Infinity || Math.abs(ey - y) < 1.5)) this.eIn = true;
      if (score < bd) { bd = score; best = r; this.eY = ey; this.eDx = dx; this.eDz = dz; this.eS = (x - ax) * dz - (z - az) * dx; this.eW = r.w; }
    }
    return best;
  }

  // Cao độ mặt đất: 0 trong lòng đường, CURB trên vỉa hè, chuyển mượt 25 cm ở mép; trên cầu thì theo mặt cầu.
  // y: cao độ hiện tại của người/xe (mặc định là đang ở dưới đất), để phân biệt đang chạy trên cầu hay đi dưới gầm cầu.
  groundY(x, z, y = 0) {
    if (this.decks.length) { const d = this.deckAt(x, z, 0.3); if (d) return CURB + d.y(this.deckT); }
    if (this.hasElev && this.elevatedAt(x, z, y) && this.eY > 0.45) return this.eY;
    let best = 1e9, lift = 0; const gc = this.gc, t = this._t;
    const l = this.grid.get(Math.floor(x / gc) * 65537 + Math.floor(z / gc)); if (!l) return CURB;
    for (let k = 0; k < l.length; k += 2) {
      const r = l[k]; if (!(r.veh || r.kind === K.pedestrian)) continue;
      const i = l[k + 1], p = r.p, d = Math.sqrt(segDist2(x, z, p[i], p[i + 1], p[i + 2], p[i + 3], t)) - r.w / 2;
      if (d >= best) continue;
      let ey = 0;
      if (r.elev) { ey = roadY(r, r.cum[i / 2] + t[0] * (r.cum[i / 2 + 1] - r.cum[i / 2])); if (ey > 0.45) continue; } // khúc cầu đã lên cao: bên dưới là vỉa hè, mặt nước
      best = d; lift = ey;
    }
    const k = clamp(best / 0.25, 0, 1);
    return k * CURB + (1 - k) * lift; // chân dốc lên cầu: lòng đường nhô dần lên
  }
  onRoad(x, z) { return this.groundY(x, z) < CURB * 0.5; }

  isWater(x, z) {
    for (const w of this.world.water) if (x >= w.bb[0] && x <= w.bb[2] && z >= w.bb[1] && z <= w.bb[3] && pointInRing(x, z, w.p) && !w.holes.some((h) => pointInRing(x, z, h))) return true;
    return false;
  }

  // ----- va chạm -----
  addChunk(key, col, shore, walls) {
    const n = col.length / 5 + shore.length / 4 + (walls ? walls.length / 4 : 0);
    const segs = new Float32Array(n * 5); let o = 0;
    segs.set(col, 0); o = col.length;
    for (let i = 0; i < shore.length; i += 4) { segs[o++] = shore[i]; segs[o++] = shore[i + 1]; segs[o++] = shore[i + 2]; segs[o++] = shore[i + 3]; segs[o++] = -1; }
    if (walls) for (let i = 0; i < walls.length; i += 4) { segs[o++] = walls[i]; segs[o++] = walls[i + 1]; segs[o++] = walls[i + 2]; segs[o++] = walls[i + 3]; segs[o++] = 2.2; }
    const cells = new Map();
    for (let i = 0; i < segs.length; i += 5) {
      const x0 = Math.min(segs[i], segs[i + 2]), x1 = Math.max(segs[i], segs[i + 2]), z0 = Math.min(segs[i + 1], segs[i + 3]), z1 = Math.max(segs[i + 1], segs[i + 3]);
      for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) { const k = cx * 65537 + cz; let l = cells.get(k); if (!l) cells.set(k, (l = [])); l.push(i); }
    }
    this.chunks.set(key, { segs, cells });
  }
  removeChunk(key) { this.chunks.delete(key); }

  // Gọi fn(segs, i) cho mọi đoạn tường gần hộp (x±r, z±r).
  eachSeg(x, z, r, fn) {
    const cx0 = Math.floor((x - r) / CELL), cx1 = Math.floor((x + r) / CELL), cz0 = Math.floor((z - r) / CELL), cz1 = Math.floor((z + r) / CELL);
    for (const c of this.chunks.values()) for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) { const l = c.cells.get(cx * 65537 + cz); if (l) for (let k = 0; k < l.length; k++) fn(c.segs, l[k]); }
  }

  // Đẩy vòng tròn bán kính r tại p {x,z} ra khỏi các bức tường. Trả về số lần chạm; pháp tuyến va chạm cuối ở this.nx, this.nz.
  collide(p, r, skipWater = false, y = 0) {
    let hits = 0; const t = this._t; this.nx = 0; this.nz = 0;
    // trên mặt cầu nâng (cao hơn 0,7 m): không va vào nhà bên dưới, chỉ bị lan can giữ lại
    if (this.hasElev && y > 0.7) {
      const er = this.elevatedAt(p.x, p.z, y, 3);
      if (er && this.eY > 0.7) {
        if (!this.eIn) { const lim = this.eW / 2 - 0.45 - r * 0.5, k = Math.sign(this.eS) * lim - this.eS; if (Math.abs(this.eS) > lim) { p.x += this.eDz * k; p.z += -this.eDx * k; this.nx = -this.eDz * Math.sign(this.eS); this.nz = this.eDx * Math.sign(this.eS); hits = 1; } }
        const b = this.b, m = 6;
        if (p.x < b.x0 + m) { p.x = b.x0 + m; hits++; this.nx = 1; this.nz = 0; } else if (p.x > b.x1 - m) { p.x = b.x1 - m; hits++; this.nx = -1; this.nz = 0; }
        if (p.z < b.z0 + m) { p.z = b.z0 + m; hits++; this.nz = 1; this.nx = 0; } else if (p.z > b.z1 - m) { p.z = b.z1 - m; hits++; this.nz = -1; this.nx = 0; }
        return hits;
      }
    }
    // trên cầu đi bộ: bỏ qua bờ nước, chỉ giữ người trong lòng cầu
    const deck = this.decks.length ? this.deckAt(p.x, p.z, 0.6) : null;
    if (deck && this.deckT > 0.04 && this.deckT < 0.96) {
      const lim = deck.w / 2 - r, s = this.deckS;
      if (Math.abs(s) > lim) { const ux = (deck.bx - deck.ax) / deck.len, uz = (deck.bz - deck.az) / deck.len, k = (Math.sign(s) * lim - s); p.x += uz * k; p.z += -ux * k; this.nx = -uz * Math.sign(s); this.nz = ux * Math.sign(s); return 1; }
      return 0;
    }
    if (deck) skipWater = true;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      this.eachSeg(p.x, p.z, r + 0.05, (s, i) => {
        if (skipWater && s[i + 4] < 0) return;
        const d2 = segDist2(p.x, p.z, s[i], s[i + 1], s[i + 2], s[i + 3], t);
        if (d2 >= r * r) return;
        const qx = s[i] + (s[i + 2] - s[i]) * t[0], qz = s[i + 1] + (s[i + 3] - s[i + 1]) * t[0];
        let nx = p.x - qx, nz = p.z - qz, d = Math.sqrt(d2);
        if (d < 1e-4) { const ex = s[i + 2] - s[i], ez = s[i + 3] - s[i + 1], el = Math.hypot(ex, ez) || 1; nx = ez / el; nz = -ex / el; d = 0; } else { nx /= d; nz /= d; }
        p.x = qx + nx * r; p.z = qz + nz * r; this.nx = nx; this.nz = nz; hits++; moved = true;
      });
      if (!moved) break;
    }
    const b = this.b, m = 6;
    if (p.x < b.x0 + m) { p.x = b.x0 + m; hits++; this.nx = 1; } else if (p.x > b.x1 - m) { p.x = b.x1 - m; hits++; this.nx = -1; }
    if (p.z < b.z0 + m) { p.z = b.z0 + m; hits++; this.nz = 1; } else if (p.z > b.z1 - m) { p.z = b.z1 - m; hits++; this.nz = -1; }
    return hits;
  }

  // Tia từ (x,z) theo hướng ngang (dx,dz) dài tối đa max. Tia ở độ cao y tại gốc và lên/xuống ky mét mỗi mét ngang;
  // chỉ tính bức tường cao hơn tia ngay tại chỗ tia cắt tường. Trả về khoảng cách chạm đầu tiên.
  raycast(x, z, dx, dz, max, y = 0, ky = 0) {
    let best = max;
    const steps = Math.ceil(max / CELL) + 1;
    const seen = this._seen || (this._seen = new Set()); seen.clear();
    for (let s = 0; s <= steps; s++) {
      const px = x + dx * Math.min(max, s * CELL), pz = z + dz * Math.min(max, s * CELL);
      this.eachSeg(px, pz, CELL * 0.75, (sg, i) => {
        if (sg[i + 4] < 0) return; // bờ nước không chắn tầm nhìn
        const ax = sg[i] - x, az = sg[i + 1] - z, ex = sg[i + 2] - sg[i], ez = sg[i + 3] - sg[i + 1], den = dx * ez - dz * ex;
        if (Math.abs(den) < 1e-9) return;
        const tt = (ax * ez - az * ex) / den, u = (ax * dz - az * dx) / den;
        if (tt > 0 && tt < best && u >= 0 && u <= 1 && sg[i + 4] >= y + ky * tt) best = tt;
      });
    }
    return best;
  }

  // Điểm trống gần nhất (không trong nhà, không dưới nước) quanh (x,z): dùng khi đặt người chơi, mốc nhiệm vụ.
  nearestFree(x, z, insideTest, maxR = 90) {
    const ok = (px, pz) => !this.isWater(px, pz) && !(insideTest && insideTest(px, pz));
    const r0 = this.nearestRoad(x, z, maxR, (r) => !r.bridge);
    if (r0) { const px = r0.px, pz = r0.pz; if (ok(px, pz)) return [px, pz]; }
    for (let r = 2; r <= maxR; r += 3) for (let k = 0; k < 12; k++) { const a = (k / 12) * 6.283, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (ok(px, pz)) return [px, pz]; }
    return [x, z];
  }
}
export { CS };
