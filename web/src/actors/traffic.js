// Dòng xe Hà Nội: đàn xe máy (có người lái đội mũ bảo hiểm), ô tô, taxi, xe buýt chạy trên đồ thị đường thật.
// Mỗi loại xe là một InstancedMesh (một lệnh vẽ cho cả trăm chiếc). Xe đi bên phải, lách nhau trong làn,
// chậm lại sau xe trước, tự né người đi bộ: cứ bước đều qua đường là dòng xe sẽ chảy quanh bạn.
import * as THREE from 'three';
import { G } from '../core/geo.js';
import { clamp, damp, dampAngle, hash, segDist2 } from '../core/util.js';
import { K, F_ONEWAY, F_REVERSE, roadY } from '../world/data.js';
import { collide1D, bikeMass } from './physics.js';

const MASS = [165, 170, 150, 1350, 1400, 11000]; // khối lượng từng loại xe trong dòng xe (kg): ba kiểu xe máy có người, ô tô, taxi, xe buýt
import { motorbike, car, bus } from '../models/vehicles.js';
import { propGeometry } from '../world/materials.js';
import { bakePose, appendBaked } from './humans.js';
import { RIDE_POSE } from './player.js';

const BIKE_COLORS = [[0.5, 0.03, 0.03], [0.02, 0.02, 0.025], [0.7, 0.7, 0.68], [0.05, 0.12, 0.4], [0.3, 0.31, 0.33], [0.07, 0.07, 0.08], [0.55, 0.55, 0.57], [0.02, 0.2, 0.12], [0.45, 0.08, 0.2], [0.6, 0.38, 0.04], [0.02, 0.25, 0.3]];
const SHIRT_COLORS = [[0.9, 0.9, 0.88], [0.1, 0.25, 0.6], [0.7, 0.1, 0.1], [0.08, 0.08, 0.1], [0.15, 0.4, 0.2], [0.85, 0.65, 0.1], [0.5, 0.5, 0.52], [0.75, 0.3, 0.45], [0.2, 0.55, 0.6], [0.02, 0.5, 0.25], [0.9, 0.45, 0.1]];
const CAR_COLORS = [[0.75, 0.75, 0.76], [0.03, 0.03, 0.035], [0.45, 0.46, 0.48], [0.5, 0.05, 0.05], [0.05, 0.1, 0.3], [0.85, 0.85, 0.83]];
const TAXI_COLORS = [[0.02, 0.45, 0.22], [0.85, 0.85, 0.83], [0.0, 0.5, 0.55], [0.9, 0.75, 0.05]];
// loại: 0 xe số, 1 xe ga, 2 cúp, 3 ô tô, 4 SUV, 5 xe buýt
const TYPES = [
  { r: 0.45, len: 1.9, vmul: 1 }, { r: 0.48, len: 1.9, vmul: 1.02 }, { r: 0.45, len: 1.8, vmul: 0.8 },
  { r: 0.95, len: 4.3, vmul: 0.92 }, { r: 1.0, len: 4.5, vmul: 0.92 }, { r: 1.3, len: 10.5, vmul: 0.75 },
];

export class Traffic {
  constructor(scene, world, nav, mats, humanFar, quality) {
    this.nav = nav; this.world = world; this.q = quality;
    this.maxBikes = quality.traffic; this.maxCars = quality.cars;
    // ----- đồ thị đường -----
    this.edges = []; this.nodes = new Map();
    const key = (x, z) => Math.round(x * 10) * 100003 + Math.round(z * 10);
    for (const r of world.roads) {
      if (!r.veh || r.kind > K.residential || r.skip || r.len < 4) continue;
      const p = r.p, cum = [0]; for (let i = 0; i < p.length - 2; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]));
      const e = { r, p, cum, len: cum[cum.length - 1], w: r.w, kind: r.kind, oneway: r.flags & F_ONEWAY ? (r.flags & F_REVERSE ? -1 : 1) : 0, n0: key(p[0], p[1]), n1: key(p[p.length - 2], p[p.length - 1]), i: this.edges.length, load: 0 };
      this.edges.push(e);
      for (const n of [e.n0, e.n1]) { let l = this.nodes.get(n); if (!l) this.nodes.set(n, (l = [])); l.push(e); }
    }
    // ----- lưới hình: xe + người lái nướng sẵn -----
    const rider = bakePose(humanFar, 'idle', 0, RIDE_POSE);
    const withRider = (kind) => {
      const g = new G(); motorbike(g, kind, 0);
      g.push().move(-0.3, -0.09, 0).rotY(Math.PI / 2); appendBaked(g, rider);
      // mũ bảo hiểm nửa đầu, cùng màu xe
      g.color(0xdddddd, 1).gloss(0.7).lathe(rider.head[0], rider.head[1] + 0.085, rider.head[2], [[0.128, -0.02], [0.134, 0.02], [0.122, 0.09], [0.088, 0.14], [0.035, 0.162], [0, 0.165]], 8).gloss(0);
      g.pop(); return g;
    };
    const geos = [withRider('wave'), withRider('scooter'), withRider('cub'), car(new G(), false), car(new G(), true), bus(new G())];
    // bản xa: vài khối hộp là đủ khi xe chỉ còn vài điểm ảnh (xe máy ngoài 60 m, ô tô ngoài 90 m)
    const bikeFar = new G(); bikeFar.color(0xd8d8d8, 1).box(-0.85, 0.3, -0.15, 0.5, 0.78, 0.15).rgb(0.03, 0.03, 0.03).box(0.38, 0, -0.05, 0.9, 0.56, 0.05).box(-0.88, 0, -0.05, -0.34, 0.56, 0.05)
      .rgb(0.75, 0.75, 0.75, 0.5).box(-0.45, 0.78, -0.2, -0.1, 1.42, 0.2).rgb(0.25, 0.3, 0.38).box(-0.42, 0.42, -0.2, 0.12, 0.8, 0.2).color(0xdddddd, 1).box(-0.38, 1.42, -0.13, -0.12, 1.68, 0.13)
      .rgb(1, 0.95, 0.8).glow(0.85).box(0.5, 0.84, -0.08, 0.52, 0.98, 0.08, 'X').rgb(0.9, 0.05, 0.03).glow(0.7).box(-0.87, 0.58, -0.08, -0.85, 0.7, 0.08, 'x').glow(0);
    const carFar = new G(); carFar.color(0xdcdcdc, 1).box(-2.15, 0.2, -0.88, 2.15, 0.82, 0.88).rgb(0.03, 0.05, 0.07).gloss(1).box(-1.5, 0.82, -0.8, 0.9, 1.45, 0.8, 'xXzZ').gloss(0).color(0xdcdcdc, 1).box(-1.5, 1.45, -0.8, 0.9, 1.47, 0.8, 'Y')
      .rgb(1, 0.96, 0.85).glow(0.8).box(2.15, 0.5, -0.75, 2.16, 0.7, 0.75, 'X').rgb(0.9, 0.04, 0.03).glow(0.7).box(-2.16, 0.5, -0.75, -2.15, 0.7, 0.75, 'x').glow(0);
    geos.push(bikeFar, carFar);
    const mat = mats.makeProp({ instanced: true });
    this.meshes = geos.map((g, t) => {
      const cap = t < 3 || t === 6 ? this.maxBikes : t === 5 ? 4 : this.maxCars, geo = propGeometry(g.pack());
      geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3));
      geo.setAttribute('aTint2', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3));
      const m = new THREE.InstancedMesh(geo, mat, cap); m.count = 0; m.frustumCulled = false; m.castShadow = quality.shadow > 0 && t < 6; m.receiveShadow = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); return m;
    });
    this.agents = []; this.grid = new Map(); this.near = []; this.nearT = 0; this.honks = []; this.density = 1; this.seed = 1;
    this.touch = 0; // số lần xe người chơi chạm xe khác (cho lối chơi)
  }

  // điểm trên cạnh e cách đầu mút xuất phát một đoạn d theo chiều đi dir; ghi vào out [x,z,tx,tz]
  sample(e, d, dir, out) {
    const p = e.p, cum = e.cum, s = clamp(dir > 0 ? d : e.len - d, 0, e.len);
    let i = 0; while (i < cum.length - 2 && cum[i + 1] < s) i++;
    const L = cum[i + 1] - cum[i] || 1, t = (s - cum[i]) / L, ax = p[i * 2], az = p[i * 2 + 1], bx = p[i * 2 + 2], bz = p[i * 2 + 3];
    out[0] = ax + (bx - ax) * t; out[1] = az + (bz - az) * t; out[2] = ((bx - ax) / L) * dir; out[3] = ((bz - az) / L) * dir;
  }

  spawn(px, pz, cam, type) {
    if (!this.near.length) return false;
    for (let tries = 0; tries < 6; tries++) {
      const e = this.near[Math.floor(Math.random() * this.near.length)];
      if (type >= 3 && (e.w < 6.5 || e.kind > K.tertiary)) continue;
      if (type === 5 && e.kind > K.secondary) continue;
      const dir = e.oneway ? e.oneway : Math.random() < 0.5 ? 1 : -1, s = Math.random() * e.len, o = [0, 0, 0, 0];
      this.sample(e, s, dir, o);
      const d = Math.hypot(o[0] - px, o[1] - pz); if (d < 45 || d > 230) continue;
      // không hiện ra ngay trước mắt: phải ở xa hoặc sau lưng camera
      if (cam && !this.warming && d < 110 && (o[0] - cam.x) * cam.fx + (o[1] - cam.z) * cam.fz > 0) continue;
      const T = TYPES[type], a = { e, dir, s, type, v: 3 + Math.random() * 3, x: o[0], z: o[1], yaw: Math.atan2(o[2], o[3]), lean: 0, lat: 0, latT: 0, y: 0, pace: (0.75 + Math.random() * 0.45) * T.vmul, pref: 0.25 + Math.random() * 0.7, r: T.r, wait: 0, honk: Math.random() * 4, tint: 0, tint2: 0, alive: true };
      a.tint = type < 3 ? BIKE_COLORS[Math.floor(Math.random() * BIKE_COLORS.length)] : type === 5 ? [1, 1, 1] : type === 4 ? TAXI_COLORS[Math.floor(Math.random() * TAXI_COLORS.length)] : CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]; // loại 4 là taxi (có hộp đèn trên nóc): luôn sơn màu hãng taxi
      a.tint2 = SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)];
      this.lane(a); a.lat = a.latT; a.x -= o[3] * a.lat; a.z += o[2] * a.lat;
      this.agents.push(a); return true;
    }
    return false;
  }
  // vị trí ngang mong muốn trong lòng đường (dương = bên phải hướng đi)
  lane(a) {
    const hw = a.e.w / 2, m = a.r + 0.25;
    if (a.e.oneway) a.latT = clamp((a.pref * 2 - 1) * (hw - m), -(hw - m), hw - m);
    else a.latT = clamp(m * 0.6 + a.pref * (hw - m * 1.6), 0.35, Math.max(0.4, hw - m));
    if (a.type >= 3) a.latT = a.e.oneway ? clamp(a.latT, -(hw - 1.2), hw - 1.2) : Math.max(1.05, Math.min(hw - 1.1, hw * 0.5));
  }
  nextEdge(a) {
    const node = a.dir > 0 ? a.e.n1 : a.e.n0, list = this.nodes.get(node) || [], o = [0, 0, 0, 0];
    this.sample(a.e, a.e.len, a.dir, o); const tx = o[2], tz = o[3];
    let best = null, bw = 0, tot = 0;
    for (const e of list) {
      if (e === a.e) continue;
      const dir = e.n0 === node ? 1 : -1; if (e.oneway && e.oneway !== dir) continue;
      if (a.type >= 3 && e.w < 5.5) continue;
      this.sample(e, 0, dir, o);
      const w = Math.max(0.03, 0.2 + o[2] * tx + o[3] * tz) * (e.kind <= K.secondary ? 2.2 : e.kind === K.tertiary ? 1.6 : 1) * (e.r.name === a.e.r.name ? 2 : 1);
      tot += w; if (Math.random() * tot < w) { best = e; bw = dir; }
    }
    if (!best) { if (a.e.oneway) return false; a.dir = -a.dir; a.s = 0; this.lane(a); return true; } // ngõ cụt: quay đầu
    a.e = best; a.dir = bw; a.s = 0; this.lane(a); return true;
  }

  // Chạy trước vài chục giây mô phỏng (không vẽ) để lúc vào game phố đã đông xe sẵn.
  prewarm(player, camera, hours) { this.warming = true; for (let i = 0; i < 160; i++) this.update(0.12, player, camera, hours, true); this.warming = false; this.honks.length = 0; this.touch = 0; }

  // Bóp còi: xe phía trước trong 14 m dạt sang bên, nhường đường.
  scare(x, z, fx, fz) {
    for (const a of this.agents) { const dx = a.x - x, dz = a.z - z, f = dx * fx + dz * fz; if (f < 0.5 || f > 14 || dx * dx + dz * dz > 200) continue; const s = dx * fz - dz * fx; if (Math.abs(s) > 2.2) continue; a.latT += 1.4; a.v *= 0.85; }
  }
  countNear(x, z, r) { let n = 0; for (const a of this.agents) if ((a.x - x) ** 2 + (a.z - z) ** 2 < r * r) n++; return n; }

  update(dt, player, camera, hours, simOnly = false) {
    const px = player.pos.x, pz = player.pos.z, A = this.agents, o = this._o || (this._o = [0, 0, 0, 0]);
    // danh sách cạnh quanh người chơi, làm mới mỗi giây
    this.nearT -= dt;
    if (this.nearT <= 0) {
      this.nearT = 1; this.near.length = 0;
      for (const e of this.edges) { const b = e.r.bb; if (b[0] < px + 220 && b[2] > px - 220 && b[1] < pz + 220 && b[3] > pz - 220) { const n = Math.max(1, Math.round((e.len / 40) * (e.kind <= K.secondary ? 3 : e.kind === K.tertiary ? 2 : 1))); for (let i = 0; i < n; i++) this.near.push(e); } }
      const h = hours, g = (m, s) => Math.exp(-((h - m) ** 2) / (2 * s * s));
      this.density = clamp(0.42 + 0.58 * Math.max(g(8, 1.4), g(17.9, 1.7)) + 0.2 * g(12, 2), 0.15, 1) * (h > 22.5 || h < 5 ? 0.3 : 1);
    }
    // sinh và huỷ
    let bikes = 0, cars = 0, buses = 0;
    for (let i = A.length - 1; i >= 0; i--) {
      const a = A[i]; if (Math.hypot(a.x - px, a.z - pz) > 250) { A[i] = A[A.length - 1]; A.pop(); continue; }
      if (a.type < 3) bikes++; else if (a.type === 5) buses++; else cars++;
    }
    const fwd = camera.getWorldDirection(this._d || (this._d = new THREE.Vector3())), cam = { x: camera.position.x, z: camera.position.z, fx: fwd.x, fz: fwd.z };
    const wantB = Math.round(this.maxBikes * this.density), wantC = Math.round(this.maxCars * this.density);
    for (let k = 0; k < (this.warming ? 12 : 4) && bikes < wantB; k++) if (this.spawn(px, pz, cam, Math.random() < 0.55 ? 0 : Math.random() < 0.85 ? 1 : 2)) bikes++;
    if (cars < wantC) this.spawn(px, pz, cam, Math.random() < 0.6 ? 3 : 4);
    if (buses < Math.min(3, Math.ceil(wantC / 6)) && Math.random() < 0.05) this.spawn(px, pz, cam, 5);

    // lưới 5 m để tìm xe lân cận
    const grid = this.grid; grid.clear();
    for (const a of A) { const k = Math.floor(a.x / 5) * 65537 + Math.floor(a.z / 5); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(a); }
    const pv = player.speed, pfx = Math.sin(player.yaw), pfz = Math.cos(player.yaw), pr = player.mode === 'bike' ? 0.5 : 0.35;

    for (const a of A) {
      const e = a.e; this.sample(e, a.s, a.dir, o);
      a.y = e.r.elev ? roadY(e.r, a.dir > 0 ? a.s : e.len - a.s) : 0;
      const tx = o[2], tz = o[3], rx = -tz, rz = tx;
      let target = (e.kind <= K.secondary ? 9.6 : e.kind === K.tertiary ? 7.8 : 5.6) * a.pace;
      // gần nút giao thì chậm lại
      const rem = e.len - a.s; if (rem < 9) target = Math.min(target, 3.2 + rem * 0.45);
      const gap = 1.6 + a.v * 0.85 + a.r; let blocked = false, shift = 0;
      const cx = Math.floor((a.x + tx * gap * 0.5) / 5), cz = Math.floor((a.z + tz * gap * 0.5) / 5);
      for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gz = cz - 1; gz <= cz + 1; gz++) {
        const l = grid.get(gx * 65537 + gz); if (!l) continue;
        for (const b of l) {
          if (b === a || Math.abs((b.y || 0) - a.y) > 2) continue;
          const dx = b.x - a.x, dz = b.z - a.z, f = dx * tx + dz * tz, s = dx * rx + dz * rz, wsum = a.r + b.r + 0.12;
          if (f > 0.2 && f < gap + b.r && Math.abs(s) < wsum) {
            const bv = b.v * (Math.sin(b.yaw) * tx + Math.cos(b.yaw) * tz);
            target = Math.min(target, Math.max(0, bv - 0.4 + (f - a.r - b.r - 0.8) * 1.2)); blocked = true;
            shift += (s > 0 ? -1 : 1) * (a.type < 3 ? 1 : 0.4); // lách sang bên trống (ô tô lách ít hơn)
          }
        }
      }
      // người chơi: né khi đi bộ, giữ khoảng cách khi cùng chạy xe
      if (Math.abs(player.y - a.y) < 2) {
        const dx = px - a.x, dz = pz - a.z, f = dx * tx + dz * tz, s = dx * rx + dz * rz, wsum = a.r + pr + 0.35;
        if (f > -0.3 && f < gap + 1.5 && Math.abs(s) < wsum + 0.9) {
          if (Math.abs(s) < wsum) { const along = pv * (pfx * tx + pfz * tz); target = Math.min(target, Math.max(0, (player.mode === 'bike' ? along : 0) - 0.3 + (f - a.r - pr - 0.9) * 1.3)); blocked = true; if (target < 0.6) a.wait += dt; }
          if (a.type < 3) shift += s > 0 ? -1.6 : 1.6;
        }
        // chạm vào nhau: đẩy người chơi ra, xe dừng lại
        const d2 = dx * dx + dz * dz, rr = a.r + pr;
        if (d2 < rr * rr && d2 > 1e-4 && !this.warming) { const d = Math.sqrt(d2), push = (rr - d) * 0.6; player.pos.x += (dx / d) * push; player.pos.z += (dz / d) * push; a.wait += dt * 2;
          // va chạm theo bảo toàn động lượng dọc hướng xe người chơi: xe nặng (ô tô, xe buýt) gần như không suy suyển, xe máy thì cả hai cùng khựng
          if (player.mode === 'bike' && (a.hitT || 0) <= 0) {
            const cosA = Math.sin(a.yaw) * pfx + Math.cos(a.yaw) * pfz, u2 = a.v * cosA, rel = pv - u2, ahead = (-dx) * pfx + (-dz) * pfz > 0;
            if ((ahead && rel > 0.8) || (!ahead && rel < -0.8)) {
              const [v1, v2] = collide1D(bikeMass(!!player.passenger), pv, MASS[a.type], u2);
              player.speed = v1; a.v = Math.max(0, a.v + (v2 - u2) * cosA); a.hitT = 0.5;
              if (Math.abs(rel) > 2) { player.wobble = Math.max(player.wobble, Math.min(1, Math.abs(rel) / 6)); this.touch += Math.min(3, Math.abs(rel) / 3); }
            }
          } else if (player.mode !== 'bike') a.v *= 0.5;
        }
        if (a.hitT > 0) a.hitT -= dt;
      }
      if (a.wait > 1.1 && a.honk <= 0) { this.honks.push([a.x, a.z, a.type]); a.honk = 2.5 + Math.random() * 3; a.wait = 0; }
      if (!blocked) a.wait = Math.max(0, a.wait - dt);
      // kẹt cứng quá 7 giây ở chỗ người chơi không nhìn thấy: cho xe biến mất để gỡ nút thắt
      if (blocked && a.v < 0.4) a.stuck = (a.stuck || 0) + dt; else a.stuck = 0;
      if (a.stuck > 7 && (a.x - px) ** 2 + (a.z - pz) ** 2 > 1600) { a.x = 1e9; continue; }
      a.honk -= dt;
      // lách: dịch vị trí ngang mong muốn, rồi trôi dần về làn quen
      const hw = e.w / 2 - a.r - 0.15, lo = e.oneway ? -hw : (a.type < 3 ? -0.4 : 0.6);
      if (shift) a.latT = clamp(a.latT + Math.sign(shift) * dt * 2.4, lo, hw);
      else if (Math.random() < dt * 0.25) this.lane(a);
      a.lat = damp(a.lat, a.latT, 2.2, dt);
      a.v = damp(a.v, target, target < a.v ? 4.5 : 1.6, dt);
      a.s += a.v * dt;
      if (a.s >= e.len) { const over = a.s - e.len; if (!this.nextEdge(a)) { a.x = 1e9; continue; } a.s = over; }
      this.sample(a.e, a.s, a.dir, o);
      const gxp = o[0] - o[3] * a.lat, gzp = o[1] + o[2] * a.lat;
      const ox = a.x, oz = a.z, k = 1 - Math.exp(-dt * 7);
      a.x += (gxp - a.x) * k; a.z += (gzp - a.z) * k;
      const mvx = a.x - ox, mvz = a.z - oz;
      if (mvx * mvx + mvz * mvz > 1e-6) { const ny = Math.atan2(mvx, mvz), dy = ny - a.yaw; a.yaw = dampAngle(a.yaw, ny, 9, dt); const turn = Math.atan2(Math.sin(dy), Math.cos(dy)); a.lean = damp(a.lean, a.type < 3 ? clamp(-turn * a.v * 0.9, -0.45, 0.45) : 0, 5, dt); }
    }

    if (simOnly) return;
    // ----- ghi ma trận instance -----
    const counts = [0, 0, 0, 0, 0, 0, 0, 0], ccx = camera.position.x, ccz = camera.position.z;
    for (const a of A) {
      const d2 = (a.x - ccx) ** 2 + (a.z - ccz) ** 2, mi = a.type < 3 ? (d2 > 3600 ? 6 : a.type) : a.type < 5 ? (d2 > 8100 ? 7 : a.type) : a.type;
      const m = this.meshes[mi], i = counts[mi]; if (i >= m.instanceMatrix.count) continue; counts[mi]++;
      const arr = m.instanceMatrix.array, off = i * 16, fx = Math.sin(a.yaw), fz = Math.cos(a.yaw), rx = -fz, rz = fx, cl = Math.cos(a.lean), sl = Math.sin(a.lean);
      // cột: X = hướng tới, Y = lên (nghiêng), Z = phải (nghiêng)
      arr[off] = fx; arr[off + 1] = 0; arr[off + 2] = fz; arr[off + 3] = 0;
      arr[off + 4] = rx * sl; arr[off + 5] = cl; arr[off + 6] = rz * sl; arr[off + 7] = 0;
      arr[off + 8] = rx * cl; arr[off + 9] = -sl; arr[off + 10] = rz * cl; arr[off + 11] = 0;
      arr[off + 12] = a.x; arr[off + 13] = a.y || 0; arr[off + 14] = a.z; arr[off + 15] = 1;
      const t1 = m.geometry.attributes.aTint.array, t2 = m.geometry.attributes.aTint2.array;
      t1[i * 3] = a.tint[0]; t1[i * 3 + 1] = a.tint[1]; t1[i * 3 + 2] = a.tint[2]; t2[i * 3] = a.tint2[0]; t2[i * 3 + 1] = a.tint2[1]; t2[i * 3 + 2] = a.tint2[2];
    }
    this.meshes.forEach((m, t) => { m.count = counts[t]; m.instanceMatrix.needsUpdate = true; m.geometry.attributes.aTint.needsUpdate = true; m.geometry.attributes.aTint2.needsUpdate = true; });
  }
}
export { hash, segDist2 };
