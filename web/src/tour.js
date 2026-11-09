// Hộ chiếu du lịch: đi tới từng địa danh, món ăn để đóng dấu, đọc giới thiệu song ngữ.
import * as THREE from 'three';
import { latLonToWorld } from './city.js';

const KEY = 'hn-passport-v1';
const ICONS = { lake: '🌊', monument: '🗼', bridge: '🌉', temple: '⛩️', theatre: '🎭', church: '⛪', station: '🚉', market: '🛍️', gate: '🏯', street: '🛵', museum: '🏛️', other: '📍', food: '🍜', culture: '🏮', place: '📍' };
const KIND = {
  vi: { lake: 'Hồ', monument: 'Di tích', bridge: 'Cầu', temple: 'Đền', theatre: 'Nhà hát', church: 'Nhà thờ', station: 'Nhà ga', market: 'Chợ', gate: 'Cửa ô', street: 'Phố', museum: 'Bảo tàng', other: 'Địa danh', food: 'Ẩm thực', culture: 'Văn hoá' },
  en: { lake: 'Lake', monument: 'Monument', bridge: 'Bridge', temple: 'Temple', theatre: 'Theatre', church: 'Church', station: 'Station', market: 'Market', gate: 'City gate', street: 'Street', museum: 'Museum', other: 'Landmark', food: 'Food', culture: 'Culture' },
};
// Công trình có mô hình 3D: mốc đặt cạnh mô hình thay vì toạ độ gốc.
const MODEL_SITES = { thap_rua: 'thap_rua', den_ngoc_son: 'den_ngoc_son', cau_the_huc: 'cau_the_huc', thap_but_dai_nghien: 'thap_but_dai_nghien' };

function iconTexture(emoji, color) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = color; g.beginPath(); g.arc(64, 58, 50, 0, 7); g.fill();
  g.beginPath(); g.moveTo(40, 98); g.lineTo(88, 98); g.lineTo(64, 126); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(64, 58, 50, 0, 7); g.stroke();
  g.font = '58px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(emoji, 64, 62);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Tour {
  constructor(city, landmarks, foods, scene) {
    this.city = city;
    this.items = [];
    const B = city.bounds;
    for (const l of landmarks) {
      let p = latLonToWorld(l.location.lat, l.location.lon);
      let radius = l.kind === 'lake' ? 140 : l.kind === 'street' ? 30 : 24;
      const site = MODEL_SITES[l.id] && city.sites[MODEL_SITES[l.id]];
      if (site) { p = site.at.clone(); radius = l.id === 'den_ngoc_son' ? 22 : 14; }
      if (l.id === 'ho_hoan_kiem') p = city.lake ? this.shorePoint(p) : p;
      if (p.x < B.x0 + 20 || p.x > B.x1 - 20 || p.y < B.z0 + 20 || p.y > B.z1 - 20) continue;
      if (l.kind === 'lake') radius = 22;
      const at = city.nearestFree(p, 60);
      this.items.push({ id: l.id, kind: l.kind, name: l.name, desc: l.description, year: l.built_year, at, radius, icon: ICONS[l.kind] || '📍' });
    }
    for (const f of foods) {
      const m = city.roadMid(f.street); if (!m) continue;
      this.items.push({ id: f.id, kind: f.kind, name: f.name, desc: f.description, at: m, radius: 14, icon: f.icon, street: f.street });
    }
    this.visited = new Set();
    try { JSON.parse(localStorage.getItem(KEY) || '[]').forEach((id) => this.visited.add(id)); } catch { /* chế độ ẩn danh */ }
    this.group = new THREE.Group(); scene.add(this.group);
    const beamGeo = new THREE.CylinderGeometry(0.7, 0.7, 70, 16, 1, true); beamGeo.translate(0, 35, 0);
    for (const it of this.items) {
      const color = it.kind === 'food' ? '#e4572e' : it.kind === 'culture' ? '#c2185b' : '#1565c0';
      const beam = new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { c: { value: new THREE.Color(color) }, t: { value: 0 }, f: { value: 1 } },
        vertexShader: 'varying float vy; void main(){ vy = position.y/70.0; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: 'uniform vec3 c; uniform float t; uniform float f; varying float vy; void main(){ float a = f*(1.0-vy)*(0.35+0.1*sin(t*2.0+vy*12.0)); gl_FragColor = vec4(c*1.6, a);}',
      }));
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(it.icon, color), depthTest: true, sizeAttenuation: true }));
      sp.scale.set(3.2, 3.2, 1); sp.position.y = 7;
      const g = new THREE.Group(); g.position.set(it.at.x, 0, it.at.y); g.add(beam, sp);
      it.marker = g; it.beam = beam; it.sprite = sp; this.group.add(g);
      this.refresh(it);
    }
    this.onStamp = null;
    this.cooldown = new Set();
  }
  shorePoint(c) {
    // điểm trên bờ hồ gần Bưu điện Bờ Hồ (phía đông nam), đi bộ tới được
    let best = null, bd = 1e9; const target = latLonToWorld(21.0263, 105.854);
    for (const p of this.city.lake.outer) { const d = p.distanceTo(target); if (d < bd) { bd = d; best = p; } }
    return best ? best.clone() : c;
  }
  refresh(it) {
    const done = this.visited.has(it.id);
    it.beam.visible = !done;
    it.sprite.material.opacity = done ? 0.45 : 1; it.sprite.material.transparent = true;
    it.sprite.position.y = done ? 4 : 7;
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify([...this.visited])); } catch { /* bỏ qua */ } }
  reset() { this.visited.clear(); this.save(); this.items.forEach((i) => this.refresh(i)); }
  kindLabel(it, lang) { return KIND[lang][it.kind] || it.kind; }
  nearest(p, unvisited = true) {
    let best = null, bd = 1e9;
    for (const it of this.items) { if (unvisited && this.visited.has(it.id)) continue; const d = Math.hypot(it.at.x - p.x, it.at.y - p.z); if (d < bd) { bd = d; best = it; } }
    return best ? { it: best, d: bd } : null;
  }
  update(dt, t, playerPos) {
    for (const it of this.items) {
      it.beam.material.uniforms.t.value = t;
      it.sprite.position.y = (this.visited.has(it.id) ? 4 : 7) + Math.sin(t * 2 + it.at.x) * 0.3;
      const d = Math.hypot(it.at.x - playerPos.x, it.at.y - playerPos.z);
      it.beam.material.uniforms.f.value = THREE.MathUtils.clamp((d - 4) / 30, 0.08, 1);
      if (d < it.radius) {
        if (!this.cooldown.has(it.id)) {
          this.cooldown.add(it.id);
          const first = !this.visited.has(it.id);
          if (first) { this.visited.add(it.id); this.save(); this.refresh(it); }
          this.onStamp && this.onStamp(it, first);
        }
      } else if (d > it.radius + 10) this.cooldown.delete(it.id);
    }
  }
}
