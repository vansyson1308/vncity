// Hộ chiếu du lịch: danh sách điểm đóng dấu theo từng trang (khu), cột sáng đánh dấu điểm chưa tới,
// kiểm tra người chơi đã tới nơi, tiền mừng, lưu tiến độ vào trình duyệt.
import * as THREE from 'three';
import { skyU } from '../engine/sky.js';

const SAVE = 'hn-save-v2';
const COLORS = { landmark: 0x35a7ff, food: 0xff8a2a, culture: 0xff5fa2 };
export const REWARD = { landmark: 20000, culture: 20000, page: 50000 };

export class Passport {
  // fresh: bắt đầu từ trạng thái trắng (tham số ?fresh của các công cụ thử và QC): không nạp tiến độ đã lưu và xoá luôn bản lưu cũ;
  // sau đó game lưu bình thường, lần tải sau không có ?fresh sẽ nạp lại tiến độ mới.
  constructor(scene, nav, places, fresh = false) {
    this.nav = nav; this.pages = places.pages;
    this.items = places.items.map((p) => ({ ...p, radius: p.kind === 'food' ? 7 : p.type === 'lake' || p.type === 'park' ? 26 : 16 }));
    this.byId = new Map(this.items.map((i) => [i.id, i]));
    this.visited = new Set(); this.money = 50000; this.rides = 0; this.flags = {};
    if (fresh) { try { localStorage.removeItem(SAVE); } catch { /* bộ nhớ bị chặn */ } } else this.load();
    this.onStamp = null; this.onPage = null; this.pending = null; // pending: món ăn đang đứng cạnh, chờ bấm E để ăn
    // cột sáng: một InstancedMesh hình trụ trong suốt, màu theo loại
    const geo = new THREE.CylinderGeometry(1.1, 1.6, 1, 12, 1, true); geo.translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: skyU.uTime, uNight: skyU.uNight }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: 'attribute vec3 aCol; varying vec3 vC; varying float vY; void main(){ vC = aCol; vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uTime, uNight; varying vec3 vC; varying float vY; void main(){ float a = pow(1.0 - vY, 2.2) * (0.5 + 0.12 * sin(uTime * 2.5 + vY * 9.0)); gl_FragColor = vec4(vC * (0.55 + uNight * 0.5), a * (0.4 + uNight * 0.35)); }',
    });
    const n = this.items.length; this.beacons = new THREE.InstancedMesh(geo, mat, n); this.beacons.frustumCulled = false; this.beacons.renderOrder = 6;
    this.col = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); geo.setAttribute('aCol', this.col);
    scene.add(this.beacons); this._m = new THREE.Matrix4(); this.refresh();
  }
  load() {
    try { const s = JSON.parse(localStorage.getItem(SAVE) || 'null'); if (s) { this.visited = new Set((s.visited || []).filter((id) => this.byId.has(id))); if (typeof s.money === 'number' && Number.isFinite(s.money)) this.money = Math.max(0, Math.round(s.money)); if (Number.isInteger(s.rides) && s.rides > 0) this.rides = s.rides; if (s.flags && typeof s.flags === 'object' && !Array.isArray(s.flags)) this.flags = s.flags; } } catch { /* bộ nhớ bị chặn: chơi không lưu */ }
  }
  save() { try { localStorage.setItem(SAVE, JSON.stringify({ visited: [...this.visited], money: this.money, rides: this.rides, flags: this.flags })); } catch { /* */ } }
  reset() { this.visited.clear(); this.money = 50000; this.rides = 0; this.flags = {}; this.save(); this.refresh(); }

  // Đặt mốc vào chỗ đi tới được (không nằm trong nhà hay giữa hồ), gọi sau khi biết va chạm quanh đó.
  place(it, x, z) { it.x = x; it.z = z; }
  refresh() {
    let n = 0; const m = this._m, c = new THREE.Color();
    for (const it of this.items) {
      if (this.visited.has(it.id)) continue;
      const h = it.kind === 'food' ? 26 : 46; m.makeScale(it.kind === 'food' ? 0.8 : 1.3, h, it.kind === 'food' ? 0.8 : 1.3); m.setPosition(it.x, 0.1, it.z); this.beacons.setMatrixAt(n, m);
      c.setHex(COLORS[it.kind] || COLORS.landmark); this.col.setXYZ(n, c.r, c.g, c.b); n++;
    }
    this.beacons.count = n; this.beacons.instanceMatrix.needsUpdate = true; this.col.needsUpdate = true;
  }
  pageOf(id) { return this.items.filter((i) => i.page === id); }
  pageDone(id) { return this.pageOf(id).every((i) => this.visited.has(i.id)); }
  get complete() { return this.visited.size === this.items.length; }

  stamp(it) {
    if (this.visited.has(it.id)) return false;
    const pageWas = this.pageDone(it.page);
    this.visited.add(it.id);
    if (it.kind !== 'food') this.money += REWARD[it.kind] || 0;
    this.refresh(); this.save();
    this.onStamp && this.onStamp(it);
    if (!pageWas && this.pageDone(it.page)) { this.money += REWARD.page; this.save(); this.onPage && this.onPage(it.page); }
    return true;
  }
  // Mỗi khung hình: tới gần địa danh là đóng dấu ngay; món ăn thì chờ người chơi bấm ăn (và đủ tiền).
  update(px, pz) {
    this.pending = null;
    for (const it of this.items) {
      if (this.visited.has(it.id)) continue;
      const d = Math.hypot(it.x - px, it.z - pz); if (d > it.radius) continue;
      if (it.kind === 'food' && it.price) { this.pending = it; continue; }
      this.stamp(it);
    }
  }
  eat(it) { if (this.money < it.price) return false; this.money -= it.price; this.stamp(it); return true; }

  // Ba gợi ý gần nhất chưa tới, ưu tiên khác loại nhau (không liệt kê hết để người chơi khỏi rối).
  suggestions(px, pz, max = 3) {
    const rest = this.items.filter((i) => !this.visited.has(i.id)).map((i) => ({ it: i, d: Math.hypot(i.x - px, i.z - pz) })).sort((a, b) => a.d - b.d);
    const out = [], kinds = new Set();
    for (const r of rest) { if (out.length >= max) break; if (out.length && kinds.has(r.it.kind) && rest.some((q) => !kinds.has(q.it.kind) && q.d < r.d * 2.5 && !out.includes(q))) continue; out.push(r); kinds.add(r.it.kind); }
    for (const r of rest) { if (out.length >= max) break; if (!out.includes(r)) out.push(r); }
    return out.sort((a, b) => a.d - b.d);
  }
  // Điểm chưa tới gần một vị trí nhất (cho câu "Gần đây: ..." trên thẻ và điểm trả khách).
  nearestUnvisited(x, z, except) { let best = null, bd = 1e9; for (const i of this.items) { if (this.visited.has(i.id) || i === except) continue; const d = Math.hypot(i.x - x, i.z - z); if (d < bd) { bd = d; best = i; } } return best ? { it: best, d: bd } : null; }
}
