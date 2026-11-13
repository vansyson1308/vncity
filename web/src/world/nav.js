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
    if (!(Number.isFinite(p.x) && Number.isFinite(p.z))) return 0; // toạ độ hỏng: không đụng tới, nơi gọi tự khôi phục
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

  // Vòng tròn bán kính r tại (x,z) có trống không: không chạm bức tường nào cao từ y trở lên (bờ nước không tính).
  clearAt(x, z, r, y = 0) {
    let ok = true; const r2 = r * r;
    this.eachSeg(x, z, r + 0.05, (s, i) => { if (ok && s[i + 4] >= y && s[i + 4] >= 0 && segDist2(x, z, s[i], s[i + 1], s[i + 2], s[i + 3]) < r2) ok = false; });
    return ok;
  }

  // Bước thẳng từ (x0,z0) tới (x1,z1) có thông không: không cắt bức tường hay bờ nước nào, chỗ tới không phải mặt nước và đủ
  // rộng cho vòng tròn bán kính r. Dùng khi đặt người xuống cạnh xe, dựng xe cạnh người: `collide` chỉ đẩy ra khỏi đoạn tường
  // gần nhất nên một điểm đã lọt sang bên kia tường sẽ bị đẩy sâu thêm vào lòng nhà.
  freeStep(x0, z0, x1, z1, r) {
    if (!(Number.isFinite(x1) && Number.isFinite(z1))) return false;
    if (this.isWater(x1, z1) && !(this.decks.length && this.deckAt(x1, z1, 0.6))) return false;
    const b = this.b, m = 6; if (x1 < b.x0 + m || x1 > b.x1 - m || z1 < b.z0 + m || z1 > b.z1 - m) return false;
    let ok = true; const dx = x1 - x0, dz = z1 - z0, r2 = r * r;
    this.eachSeg((x0 + x1) / 2, (z0 + z1) / 2, Math.hypot(dx, dz) / 2 + r + 0.1, (s, i) => {
      if (!ok) return;
      const ax = s[i], az = s[i + 1], ex = s[i + 2] - ax, ez = s[i + 3] - az, den = dx * ez - dz * ex;
      if (Math.abs(den) > 1e-9) { const t = ((ax - x0) * ez - (az - z0) * ex) / den, u = ((ax - x0) * dz - (az - z0) * dx) / den; if (t >= 0 && t <= 1 && u >= 0 && u <= 1) { ok = false; return; } }
      if (segDist2(x1, z1, ax, az, s[i + 2], s[i + 3]) < r2) ok = false;
    });
    return ok;
  }

  // Chỗ đứng trống cạnh điểm (x,z) của một vật quay mặt hướng yaw: thử bên trái, bên phải, chéo trước, phía trước, rồi mới tới chéo
  // sau, phía sau (phía sau là chỗ camera đứng: dựng xe ở đó thì camera chui vào xe), mỗi phía ở khoảng cách d rồi 0,7 d. Không có
  // chỗ nào thông thì trả về chính (x,z). Kết quả ở out {x,z}.
  besideFree(x, z, yaw, d, r, out) {
    const c = Math.cos(yaw), s = Math.sin(yaw), q = Math.SQRT1_2;
    for (const k of [1, 0.7]) for (const [lx, lz] of [[c, -s], [-c, s], [(c + s) * q, (c - s) * q], [(s - c) * q, (s + c) * q], [s, c], [(c - s) * q, (-s - c) * q], [(-c - s) * q, (s - c) * q], [-s, -c]]) {
      const px = x + lx * d * k, pz = z + lz * d * k;
      if (this.freeStep(x, z, px, pz, r)) { out.x = px; out.z = pz; return true; }
    }
    out.x = x; out.z = z; return false;
  }

  // Điểm (x,z) có nằm trong lòng một khối đặc (nhà, khối giữ chỗ của công trình) không: đếm chẵn lẻ số lần bốn tia dọc trục cắt
  // các bức tường cao từ 2,5 m của những ô đã nạp (tường nhà là vòng khép kín, xếp trọn vào một ô); cần ít nhất ba tia lẻ.
  // Duyệt hết mọi đoạn tường nên chỉ gọi khi cần (lúc khôi phục vị trí đã lưu), không gọi mỗi khung hình.
  inSolid(x, z) {
    let px = 0, nx = 0, pz = 0, nz = 0;
    for (const c of this.chunks.values()) { const s = c.segs; for (let i = 0; i < s.length; i += 5) {
      if (!(s[i + 4] >= 2.5)) continue;
      const ax = s[i], az = s[i + 1], bx = s[i + 2], bz = s[i + 3];
      if ((az > z) !== (bz > z)) { const xi = ax + ((z - az) * (bx - ax)) / (bz - az); if (xi > x) px++; else nx++; }
      if ((ax > x) !== (bx > x)) { const zi = az + ((x - ax) * (bz - az)) / (bx - ax); if (zi > z) pz++; else nz++; }
    } }
    return (px & 1) + (nx & 1) + (pz & 1) + (nz & 1) >= 3;
  }

  // Như inSolid nhưng rẻ (gọi được mỗi giây vài lần): đếm chẵn lẻ số lần đoạn thẳng từ (x, z) tới tim đường xe gần nhất cắt tường cao
  // từ 2,5 m (tim đường xe nằm ngoài mọi nhà: lẻ là đang trong nhà), làm lại với đường xe gần thứ hai; cả hai lẻ mới là trong nhà
  // (một khối nhà OSM trùm lên tim đường thì chỉ làm sót, không báo nhầm). Không còn đường xe nào trong vòng r: coi là ngoài.
  // Trước đây đếm trên bốn tia dọc trục dài 20 m: tia bị cắt cụt giữa một khối nhà lớn chỉ đếm được bức tường gần, nên điểm ở sân
  // hẹp hay lối đi giữa các khối lớn bị báo nhầm là trong nhà (reviewer vòng 4: 1,5 % điểm lối đi bộ quanh phố cổ, cách nhà gần nhất
  // 4,6–8,6 m); tia dài hơn thì lại hay dừng giữa lòng một nhà ở xa, còn nhầm hơn.
  insideNear(x, z, r = 60) {
    const veh = this._vehF || (this._vehF = (q) => q.veh && !q.elev);
    const h = this.nearestRoad(x, z, r, veh); if (!h) return false;
    const r1 = h.r; // (nearestRoad trả về cùng một đối tượng mỗi lần gọi: đọc xong mới gọi tiếp)
    if (!this.oddCross(x, z, h.px, h.pz)) return false;
    const h2 = this.nearestRoad(x, z, r, (q) => q !== r1 && veh(q));
    return !h2 || this.oddCross(x, z, h2.px, h2.pz);
  }
  // Đoạn thẳng (x, z) → (qx, qz) cắt tường cao từ 2,5 m một số lẻ lần? Mỗi bức tường chỉ đếm một lần, ở ô lưới chứa giao điểm (đoạn
  // tường nằm trong nhiều ô không bị đếm hai lần); đỉnh tường nằm đúng trên đường thẳng tính theo quy tắc nửa mở (hai bức tường chung
  // đỉnh đó được đếm đúng một hay hai lần, không bao giờ một rưỡi).
  oddCross(x, z, qx, qz) {
    const dx = qx - x, dz = qz - z, L2 = dx * dx + dz * dz; if (L2 < 1e-6) return false;
    const mx0 = Math.min(x, qx), mx1 = Math.max(x, qx), mz0 = Math.min(z, qz), mz1 = Math.max(z, qz);
    const cx0 = Math.floor(mx0 / CELL), cx1 = Math.floor(mx1 / CELL), cz0 = Math.floor(mz0 / CELL), cz1 = Math.floor(mz1 / CELL);
    let n = 0;
    for (const c of this.chunks.values()) {
      const s = c.segs;
      for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
        const l = c.cells.get(cx * 65537 + cz); if (!l) continue;
        for (let k = 0; k < l.length; k++) {
          const i = l[k]; if (!(s[i + 4] >= 2.5)) continue;
          const ax = s[i], az = s[i + 1], bx = s[i + 2], bz = s[i + 3], sa = dx * (az - z) - dz * (ax - x), sb = dx * (bz - z) - dz * (bx - x);
          if (sa > 0 === sb > 0) continue; // hai đầu tường cùng một phía đường thẳng
          const u = sa / (sa - sb), ix = ax + (bx - ax) * u, iz = az + (bz - az) * u, t = ((ix - x) * dx + (iz - z) * dz) / L2;
          if (t < 0 || t >= 1) continue;
          // ô của giao điểm (kẹp vào hộp bao của cả tường lẫn đoạn thẳng: sai số làm tròn không đẩy được nó sang ô tường không ghi tên)
          const cx2 = Math.floor(clamp(clamp(ix, Math.min(ax, bx), Math.max(ax, bx)), mx0, mx1) / CELL), cz2 = Math.floor(clamp(clamp(iz, Math.min(az, bz), Math.max(az, bz)), mz0, mz1) / CELL);
          if (cx2 === cx && cz2 === cz) n++;
        }
      }
    }
    return (n & 1) === 1;
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
