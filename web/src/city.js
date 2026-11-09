// Dựng thành phố từ bản đồ OSM quận Hoàn Kiếm (hoankiem.json, đơn vị dm, gốc toạ độ ở Hồ Gươm).
// Trục: x hướng đông, z hướng nam, y lên trời; 1 đơn vị = 1 m.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { upperFacade, shopFront, modernFacade } from './textures.js';

export const ORIGIN = { lat: 21.0288, lon: 105.8522 };
const M_PER_LON = Math.cos(ORIGIN.lat * Math.PI / 180) * 111320;
const M_PER_LAT = 110574;
export function latLonToWorld(lat, lon) {
  return new THREE.Vector2((lon - ORIGIN.lon) * M_PER_LON, -(lat - ORIGIN.lat) * M_PER_LAT);
}
const V = (p) => new THREE.Vector2(p[0] / 10, p[1] / 10);

function signedArea(r) { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p.x * q.y - q.x * p.y; } return a / 2; }
export function pointInRing(x, y, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i].x, yi = r[i].y, xj = r[j].x, yj = r[j].y;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function hash(i, k = 0) { let h = (i * 374761393 + k * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

const VEHICLE = new Set(['primary', 'secondary', 'tertiary', 'residential', 'service', 'unclassified', 'living_street']);
const WALK = new Set(['footway', 'pedestrian', 'path', 'steps']);

// Bảng màu tường phố cổ: vàng Hà Nội, kem, trắng cũ, ve xanh, hồng phai.
const WALLS = [['#e3bf62', '#3e6b3a'], ['#ead9b4', '#6b3f22'], ['#d8d2c4', '#2f5f73'], ['#c99a52', '#3e6b3a'], ['#d9b8a7', '#4a5d3a'], ['#b7c4b5', '#5a3e2b']];

export class City {
  constructor(data, renderer, loaderTex) {
    this.data = data;
    this.renderer = renderer;
    this.group = new THREE.Group();
    this.bounds = { x0: data.bounds[0] / 10, z0: data.bounds[1] / 10, x1: data.bounds[2] / 10, z1: data.bounds[3] / 10 };
    this.texLoad = loaderTex;
    this.cell = 20;
    this.grid = new Map(); // ô 20 m → danh sách vật cản (vòng toà nhà)
    this.nightMats = [];
    this.sites = {};
  }

  tex(name, repeat = 1, srgb = true) {
    const t = this.texLoad.load(name);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  build() {
    const d = this.data;
    this.rings = { water: d.water.map((w) => ({ outer: w.outer.map(V), holes: (w.holes || []).map((h) => h.map(V)) })) };
    this.roads = d.roads.map((r) => ({ pts: r.pts.map(V), w: r.w / 10, kind: r.kind, name: r.name || null, bridge: !!r.bridge }));
    this.findSites();
    this.buildGround();
    this.buildRoads();
    this.buildWater();
    this.buildBuildings();
    this.buildGraphs();
    return this;
  }

  // Vị trí công trình có mô hình thật, theo cách craft-anything đặt chúng.
  findSites() {
    const named = (n) => this.data.buildings.find((b) => b.name === n);
    const centre = (b) => { const r = b.outer.map(V); const lo = new THREE.Vector2(1e9, 1e9), hi = new THREE.Vector2(-1e9, -1e9); r.forEach((p) => { lo.min(p); hi.max(p); }); return lo.add(hi).multiplyScalar(0.5); };
    const ns = named('Đền Ngọc Sơn'), tr = named('Tháp Rùa');
    if (ns) this.sites.den_ngoc_son = { at: centre(ns), yaw: 0 };
    if (tr) this.sites.thap_rua = { at: centre(tr), yaw: 0 };
    const th = this.roads.find((r) => r.name === 'Cầu Thê Húc');
    if (th) {
      const a = th.pts[0], b = th.pts[th.pts.length - 1];
      const [south, north] = a.y > b.y ? [a, b] : [b, a];
      const dd = north.clone().sub(south);
      this.sites.cau_the_huc = { at: south.clone().add(north).multiplyScalar(0.5), yaw: Math.atan2(-dd.x, -dd.y), a: south, b: north, w: th.w };
      if (this.sites.den_ngoc_son) {
        const t = this.sites.den_ngoc_son.at;
        const [shore, island] = a.distanceTo(t) > b.distanceTo(t) ? [a, b] : [b, a];
        const ti = island.clone().sub(shore);
        this.sites.thap_but_dai_nghien = { at: shore.clone(), yaw: Math.atan2(-ti.x, -ti.y) };
      }
    }
  }

  buildGround() {
    const { x0, z0, x1, z1 } = this.bounds;
    const pad = 400;
    const shape = new THREE.Shape([new THREE.Vector2(x0 - pad, -(z0 - pad)), new THREE.Vector2(x1 + pad, -(z0 - pad)), new THREE.Vector2(x1 + pad, -(z1 + pad)), new THREE.Vector2(x0 - pad, -(z1 + pad))]);
    // ShapeGeometry nằm trên mặt XY; xoay -90° quanh X thì y → -z, nên lật dấu z trước.
    const islands = [];
    for (const w of this.rings.water) {
      shape.holes.push(new THREE.Path(w.outer.map((p) => new THREE.Vector2(p.x, -p.y))));
      for (const h of w.holes) islands.push(new THREE.Shape(h.map((p) => new THREE.Vector2(p.x, -p.y))));
    }
    const geo = new THREE.ShapeGeometry([shape, ...islands]);
    geo.rotateX(-Math.PI / 2);
    this.worldUV(geo, 2.5);
    const mat = new THREE.MeshStandardMaterial({ map: this.tex('assets/tex/via_he_da_xam_basecolor.webp'), normalMap: this.tex('assets/tex/via_he_da_xam_normal.webp', 1, false), roughness: 0.92, color: 0xe6dccb });
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.name = 'ground';
    this.group.add(m);

    // công viên, thảm cỏ
    const parks = [];
    for (const p of this.data.parks) {
      const r = p.outer.map(V); if (r.length < 3) continue;
      parks.push(new THREE.Shape(r.map((q) => new THREE.Vector2(q.x, -q.y))));
    }
    const pg = new THREE.ShapeGeometry(parks); pg.rotateX(-Math.PI / 2); pg.translate(0, 0.03, 0); this.worldUV(pg, 4);
    const pm = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: this.tex('assets/tex/co_basecolor.webp'), normalMap: this.tex('assets/tex/co_normal.webp', 1, false), roughness: 1, color: 0xb8c8a0, polygonOffset: true, polygonOffsetFactor: -1 }));
    pm.receiveShadow = true; this.group.add(pm);
  }

  worldUV(geo, size) {
    const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / size; uv[i * 2 + 1] = p.getZ(i) / size; }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }

  ribbon(roads, y, uvSize) {
    const pos = [], idx = [];
    const disc = (c, r) => {
      const b = pos.length / 3, n = 10;
      pos.push(c.x, y, c.y);
      for (let k = 0; k <= n; k++) { const a = (k / n) * Math.PI * 2; pos.push(c.x + Math.cos(a) * r, y, c.y + Math.sin(a) * r); }
      for (let k = 1; k <= n; k++) idx.push(b, b + k + 1, b + k);
    };
    for (const r of roads) {
      const h = Math.max(r.w, 1.5) / 2;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const a = r.pts[i], b = r.pts[i + 1];
        const d = b.clone().sub(a); if (d.lengthSq() < 1e-6) continue; d.normalize();
        const n = new THREE.Vector2(-d.y, d.x).multiplyScalar(h);
        const s = pos.length / 3;
        pos.push(a.x + n.x, y, a.y + n.y, a.x - n.x, y, a.y - n.y, b.x - n.x, y, b.y - n.y, b.x + n.x, y, b.y + n.y);
        idx.push(s, s + 2, s + 1, s, s + 3, s + 2);
      }
      for (const p of r.pts) disc(p, h);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    // chuẩn hoá pháp tuyến hướng lên
    const nrm = g.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
    this.worldUV(g, uvSize);
    return g;
  }

  buildRoads() {
    const skip = (r) => r.name === 'Cầu Thê Húc' || (r.bridge && r.name === 'Cầu Long Biên');
    const car = this.roads.filter((r) => VEHICLE.has(r.kind) && !skip(r));
    const foot = this.roads.filter((r) => (r.kind === 'pedestrian' || r.kind === 'path') && !skip(r));
    const asphalt = new THREE.MeshStandardMaterial({ map: this.tex('assets/tex/duong_nhua_basecolor.webp'), normalMap: this.tex('assets/tex/duong_nhua_normal.webp', 1, false), roughness: 0.85, color: 0xd2d2d2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.asphalt = asphalt;
    const m = new THREE.Mesh(this.ribbon(car, 0.04, 6), asphalt); m.receiveShadow = true; this.group.add(m);
    const tiles = new THREE.MeshStandardMaterial({ map: this.tex('assets/tex/gach_lat_ho_basecolor.webp'), normalMap: this.tex('assets/tex/gach_lat_ho_normal.webp', 1, false), roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const f = new THREE.Mesh(this.ribbon(foot, 0.05, 3), tiles); f.receiveShadow = true; this.group.add(f);
    // vạch kẻ giữa đường trục chính
    const lines = this.roads.filter((r) => (r.kind === 'primary' || r.kind === 'secondary') && !r.bridge && r.w >= 9);
    const pos = [];
    for (const r of lines) for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1], len = a.distanceTo(b); if (len < 1) continue;
      const d = b.clone().sub(a).normalize(), n = new THREE.Vector2(-d.y, d.x).multiplyScalar(0.07);
      for (let t = 1; t + 3 < len; t += 9) {
        const p = a.clone().addScaledVector(d, t), q = a.clone().addScaledVector(d, t + 3);
        pos.push(p.x + n.x, 0.06, p.y + n.y, p.x - n.x, 0.06, p.y - n.y, q.x - n.x, 0.06, q.y - n.y, p.x + n.x, 0.06, p.y + n.y, q.x - n.x, 0.06, q.y - n.y, q.x + n.x, 0.06, q.y + n.y);
      }
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    lg.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    this.group.add(new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.7, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })));
  }

  buildWater() {
    const shapes = this.rings.water.map((w) => { const s = new THREE.Shape(w.outer.map((p) => new THREE.Vector2(p.x, -p.y))); w.holes.forEach((h) => s.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p.x, -p.y))))); return s; });
    const g = new THREE.ShapeGeometry(shapes); g.rotateX(-Math.PI / 2); g.translate(0, -0.55, 0); this.worldUV(g, 18);
    const normal = this.tex('assets/tex/nuoc_ho_normal.webp', 1, false);
    this.waterMat = new THREE.MeshStandardMaterial({ color: 0x3d5e4a, roughness: 0.06, metalness: 0.0, normalMap: normal, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.2 });
    const water = new THREE.Mesh(g, this.waterMat); water.receiveShadow = true; water.name = 'water'; this.group.add(water);
    // kè đá quanh hồ
    const pos = [];
    const wall = (ring) => { for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; pos.push(a.x, 0.06, a.y, b.x, 0.06, b.y, b.x, -0.9, b.y, a.x, 0.06, a.y, b.x, -0.9, b.y, a.x, -0.9, a.y); } };
    this.rings.water.forEach((w) => { wall(w.outer); w.holes.forEach(wall); });
    const kg = new THREE.BufferGeometry(); kg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); kg.computeVertexNormals();
    this.group.add(new THREE.Mesh(kg, new THREE.MeshStandardMaterial({ color: 0x77736a, roughness: 0.95, side: THREE.DoubleSide })));
  }

  addObstacle(ring) {
    const lo = new THREE.Vector2(1e9, 1e9), hi = new THREE.Vector2(-1e9, -1e9);
    ring.forEach((p) => { lo.min(p); hi.max(p); });
    const o = { ring, lo, hi };
    for (let cx = Math.floor(lo.x / this.cell); cx <= Math.floor(hi.x / this.cell); cx++)
      for (let cz = Math.floor(lo.y / this.cell); cz <= Math.floor(hi.y / this.cell); cz++) {
        const k = cx + ',' + cz; let l = this.grid.get(k); if (!l) this.grid.set(k, (l = [])); l.push(o);
      }
  }

  buildBuildings() {
    const R = this.renderer;
    const mats = { upper: [], shop: [], modern: [] };
    const mk = (t, rough = 0.9) => { const m = new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0, roughness: rough, vertexColors: true }); this.nightMats.push(m); return m; };
    WALLS.forEach(([w, s], i) => mats.upper.push(mk(upperFacade(R, w, s, 11 + i * 7))));
    WALLS.slice(0, 3).forEach(([w], i) => mats.shop.push(mk(shopFront(R, w, 91 + i * 13))));
    mats.modern.push(mk(modernFacade(R, '#c9c7c0', '#6f8fa3', 5), 0.4), mk(modernFacade(R, '#8f8a80', '#4b6676', 9), 0.4), mk(modernFacade(R, '#e0dccf', '#87a4ae', 17), 0.4));
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95, map: this.tex('assets/tex/concrete.jpg', 1) });
    this.buildingMats = mats;

    const MODERN = new Set(['office', 'hotel', 'hospital', 'government', 'commercial', 'apartments', 'university', 'retail']);
    const bucket = new Map(); // khoá: chunk|loại|i → mảng toạ độ
    const CH = 400;
    const push = (chunk, key, arr) => { const k = chunk + '|' + key; let b = bucket.get(k); if (!b) bucket.set(k, (b = { pos: [], uv: [], col: [], idx: [] })); return b; };
    const ns = this.sites.den_ngoc_son?.at, tr = this.sites.thap_rua?.at, gate = this.sites.thap_but_dai_nghien?.at;
    const col = new THREE.Color();

    this.data.buildings.forEach((b, bi) => {
      const ring = b.outer.map(V);
      if (ring.length > 2 && ring[0].distanceTo(ring[ring.length - 1]) < 1e-3) ring.pop();
      if (ring.length < 3) return;
      if (signedArea(ring) < 0) ring.reverse();
      const c = ring.reduce((a, p) => a.add(p), new THREE.Vector2()).multiplyScalar(1 / ring.length);
      if (b.name === 'Đền Ngọc Sơn' || b.name === 'Tháp Rùa') return;
      if (ns && c.distanceTo(ns) < 30) return;
      if (tr && c.distanceTo(tr) < 8) return;
      if (gate && c.distanceTo(gate) < 14) return;
      if (this.sites.cau_the_huc) { const { a, b } = this.sites.cau_the_huc; const ab = b.clone().sub(a); const t = THREE.MathUtils.clamp(c.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1); if (a.clone().addScaledVector(ab, t).distanceTo(c) < 8) return; }
      const h = Math.min(Math.max(b.h / 10, 3), 120);
      const roofOnly = b.kind === 'roof';
      const chunk = Math.floor(c.x / CH) + ':' + Math.floor(c.y / CH);
      const modern = h >= 24 || MODERN.has(b.kind);
      const shade = 0.82 + hash(bi, 3) * 0.22;
      if (!roofOnly) this.addObstacle(ring);
      if (!roofOnly) {
        const ground = modern ? 0 : Math.min(3.6, h);
        const upKey = modern ? 'modern' + ((hash(bi, 1) * 3) | 0) : 'upper' + ((hash(bi, 1) * WALLS.length) | 0);
        const shopKey = 'shop' + ((hash(bi, 2) * 3) | 0);
        let u = hash(bi, 5) * 8;
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], p = ring[(i + 1) % ring.length];
          const len = a.distanceTo(p); if (len < 0.05) continue;
          const quad = (key, y0, y1, uw, vh, v0) => {
            const B = push(chunk, key);
            const s = B.pos.length / 3;
            B.pos.push(a.x, y0, a.y, p.x, y0, p.y, p.x, y1, p.y, a.x, y1, a.y);
            const u0 = u / uw, u1 = (u + len) / uw, va = v0, vb = v0 + (y1 - y0) / vh;
            B.uv.push(u0, va, u1, va, u1, vb, u0, vb);
            for (let k = 0; k < 4; k++) B.col.push(shade, shade, shade);
            B.idx.push(s, s + 2, s + 1, s, s + 3, s + 2);
          };
          if (ground > 0) quad(shopKey, 0, ground, 12, 3.6, 0);
          if (h > ground) quad(upKey, ground, h, modern ? 8 : 8, 6.6, 0);
          u += len;
        }
      }
      // mái
      const shape = new THREE.Shape(ring.map((p) => new THREE.Vector2(p.x, -p.y)));
      (b.holes || []).forEach((hh) => shape.holes.push(new THREE.Path(hh.map(V).map((p) => new THREE.Vector2(p.x, -p.y)))));
      const rg = new THREE.ShapeGeometry(shape); rg.rotateX(-Math.PI / 2);
      const rp = rg.attributes.position, ri = rg.index.array;
      const B = push(chunk, 'roof');
      const s = B.pos.length / 3;
      col.setHSL(0.07 + hash(bi, 7) * 0.05, 0.12 + hash(bi, 8) * 0.2, 0.42 + hash(bi, 9) * 0.25);
      for (let k = 0; k < rp.count; k++) { B.pos.push(rp.getX(k), h, rp.getZ(k)); B.uv.push(rp.getX(k) / 6, rp.getZ(k) / 6); B.col.push(col.r, col.g, col.b); }
      for (let k = 0; k < ri.length; k++) B.idx.push(s + ri[k]);
      rg.dispose();
    });

    for (const [k, B] of bucket) {
      const key = k.split('|')[1];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3));
      g.setIndex(B.idx); g.computeVertexNormals(); g.computeBoundingSphere();
      let mat = roofMat;
      if (key.startsWith('upper')) mat = mats.upper[+key.slice(5)];
      else if (key.startsWith('shop')) mat = mats.shop[+key.slice(4)];
      else if (key.startsWith('modern')) mat = mats.modern[+key.slice(6)];
      const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
      this.group.add(m);
    }
  }

  // Đồ thị đường cho xe máy và người đi bộ: hai đường chung một đỉnh (toạ độ dm trùng nhau) thì nối.
  buildGraphs() {
    const mk = (pred) => {
      const list = this.roads.filter(pred);
      const at = new Map();
      list.forEach((r, ri) => r.pts.forEach((p, pi) => { const k = Math.round(p.x * 10) + ',' + Math.round(p.y * 10); let l = at.get(k); if (!l) at.set(k, (l = [])); l.push([ri, pi]); }));
      return { list, at };
    };
    this.carGraph = mk((r) => (r.kind === 'primary' || r.kind === 'secondary' || r.kind === 'tertiary' || r.kind === 'residential') && !r.bridge);
    this.walkGraph = mk((r) => WALK.has(r.kind) && r.kind !== 'steps' && !r.bridge);
  }

  isWater(x, z) {
    for (const w of this.rings.water) {
      if (pointInRing(x, z, w.outer) && !w.holes.some((h) => pointInRing(x, z, h))) {
        const th = this.sites.cau_the_huc;
        if (th) { // trên cầu Thê Húc thì đi được
          const ab = th.b.clone().sub(th.a), ap = new THREE.Vector2(x, z).sub(th.a);
          const t = THREE.MathUtils.clamp(ap.dot(ab) / ab.lengthSq(), 0, 1);
          if (th.a.clone().addScaledVector(ab, t).distanceTo(new THREE.Vector2(x, z)) < 1.6) return false;
        }
        return true;
      }
    }
    return false;
  }

  blocked(x, z, r = 0.3) {
    const { x0, z0, x1, z1 } = this.bounds;
    if (x < x0 || x > x1 || z < z0 || z > z1) return true;
    const k = Math.floor(x / this.cell) + ',' + Math.floor(z / this.cell);
    const l = this.grid.get(k);
    if (l) for (const o of l) {
      if (x < o.lo.x - r || x > o.hi.x + r || z < o.lo.y - r || z > o.hi.y + r) continue;
      if (pointInRing(x, z, o.ring)) return true;
    }
    return this.isWater(x, z);
  }

  roadMid(name) {
    const rs = this.roads.filter((r) => r.name === name); if (!rs.length) return null;
    let best = null, bl = -1;
    for (const r of rs) { let l = 0; for (let i = 0; i < r.pts.length - 1; i++) l += r.pts[i].distanceTo(r.pts[i + 1]); if (l > bl) { bl = l; best = r; } }
    let half = bl / 2;
    for (let i = 0; i < best.pts.length - 1; i++) { const d = best.pts[i].distanceTo(best.pts[i + 1]); if (half <= d) return best.pts[i].clone().lerp(best.pts[i + 1], half / d); half -= d; }
    return best.pts[0].clone();
  }

  // Điểm đi được gần nhất (để đặt mốc nhiệm vụ không nằm trong nhà hay giữa hồ).
  nearestFree(p, maxR = 80) {
    if (!this.blocked(p.x, p.y)) return p.clone();
    for (let r = 2; r <= maxR; r += 2) for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, x = p.x + Math.cos(a) * r, z = p.y + Math.sin(a) * r;
      if (!this.blocked(x, z, 0.8)) return new THREE.Vector2(x, z);
    }
    return p.clone();
  }

  // Bản đồ nhỏ vẽ sẵn: 1 px = 1 m.
  drawMap() {
    const { x0, z0, x1, z1 } = this.bounds;
    const c = document.createElement('canvas'); c.width = Math.ceil(x1 - x0); c.height = Math.ceil(z1 - z0);
    const g = c.getContext('2d');
    g.fillStyle = '#e9e4d8'; g.fillRect(0, 0, c.width, c.height);
    const path = (ring) => { g.beginPath(); ring.forEach((p, i) => (i ? g.lineTo(p.x - x0, p.y - z0) : g.moveTo(p.x - x0, p.y - z0))); g.closePath(); };
    g.fillStyle = '#b9d7a8'; this.data.parks.forEach((p) => { path(p.outer.map(V)); g.fill(); });
    g.fillStyle = '#7fb2d6'; this.rings.water.forEach((w) => { path(w.outer); g.fill(); g.fillStyle = '#b9d7a8'; w.holes.forEach((h) => { path(h); g.fill(); }); g.fillStyle = '#7fb2d6'; });
    g.fillStyle = '#cdbfa6'; this.data.buildings.forEach((b) => { path(b.outer.map(V)); g.fill(); });
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const r of this.roads) {
      if (!VEHICLE.has(r.kind)) continue;
      g.strokeStyle = r.kind === 'primary' ? '#f4c86a' : r.kind === 'secondary' ? '#fbe3a4' : '#ffffff';
      g.lineWidth = Math.max(r.w, 3);
      g.beginPath(); r.pts.forEach((p, i) => (i ? g.lineTo(p.x - x0, p.y - z0) : g.moveTo(p.x - x0, p.y - z0))); g.stroke();
    }
    g.strokeStyle = '#8a7a6a'; g.lineWidth = 2; g.setLineDash([6, 4]);
    for (const rl of this.data.rails) { const r = rl.map(V); g.beginPath(); r.forEach((p, i) => (i ? g.lineTo(p.x - x0, p.y - z0) : g.moveTo(p.x - x0, p.y - z0))); g.stroke(); }
    g.setLineDash([]);
    this.mapCanvas = c;
    return c;
  }
}
