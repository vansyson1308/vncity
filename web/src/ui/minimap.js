// Bản đồ nhỏ góc màn hình (xoay theo hướng nhìn) và bản đồ lớn. Nền là ảnh worker vẽ sẵn; đường gần người chơi
// được vẽ lại bằng nét vẽ để luôn sắc nét khi phóng to.
import { K } from '../world/data.js';
import { MAP_COLORS } from '../world/gen/mapdraw.js';

const KIND_COL = { landmark: '#35a7ff', food: '#ff8a2a', culture: '#ff5fa2' };
export class Minimap {
  constructor(canvas, world, nav) { this.c = canvas; this.g = canvas.getContext('2d'); this.world = world; this.nav = nav; this.bitmap = null; this.ppm = 1; this.R = 120; this.tick = 0; }
  setBitmap(bmp, ppm) { this.bitmap = bmp; this.ppm = ppm; }

  draw(player, camYaw, marks, riding) {
    if (++this.tick % 2) return;
    const g = this.g, S = this.c.width, h = S / 2, b = this.world.bounds, px = player.pos.x, pz = player.pos.z;
    this.R += ((riding ? 190 : 115) - this.R) * 0.05; const R = this.R, s = h / R;
    g.save(); g.clearRect(0, 0, S, S);
    g.beginPath(); g.arc(h, h, h, 0, 7); g.clip();
    g.fillStyle = MAP_COLORS.bg; g.fillRect(0, 0, S, S);
    g.translate(h, h); g.rotate(camYaw); g.scale(s, s); g.translate(-px, -pz);
    if (this.bitmap) { g.imageSmoothingEnabled = true; g.drawImage(this.bitmap, b.x0, b.z0, this.bitmap.width / this.ppm, this.bitmap.height / this.ppm); }
    // đường gần đây, nét sắc
    g.lineCap = 'round'; g.lineJoin = 'round';
    const seen = this._seen || (this._seen = new Set()); seen.clear();
    const gc = this.nav.gc, x0 = Math.floor((px - R) / gc), x1 = Math.floor((px + R) / gc), z0 = Math.floor((pz - R) / gc), z1 = Math.floor((pz + R) / gc);
    for (let pass = 0; pass < 2; pass++) {
      for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
        const l = this.nav.grid.get(cx * 65537 + cz); if (!l) continue;
        for (let k = 0; k < l.length; k += 2) {
          const r = l[k]; if (!r.veh || r.kind > K.residential) continue; const major = r.kind <= K.secondary;
          if ((pass === 1) !== major) continue; const key = r.i * 2 + pass; if (seen.has(key)) continue; seen.add(key);
          const p = r.p; g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
          g.strokeStyle = major ? '#a8b2c0' : '#6b7584'; g.lineWidth = Math.max(r.w, major ? 7 : 4.5); g.stroke();
        }
      }
    }
    // mốc: gợi ý đóng dấu, khách, điểm trả
    for (const m of marks) {
      let dx = m.x - px, dz = m.z - pz; const d = Math.hypot(dx, dz), edge = d > R * 0.9;
      if (edge) { dx *= (R * 0.9) / d; dz *= (R * 0.9) / d; }
      g.beginPath(); g.arc(px + dx, pz + dz, (m.big ? 7 : 5) / s * (edge ? 0.8 : 1), 0, 7); g.fillStyle = m.color || KIND_COL[m.kind] || '#fff'; g.fill(); g.lineWidth = 2 / s; g.strokeStyle = '#fff'; g.stroke();
    }
    g.restore();
    // mũi tên người chơi và chữ B (bắc)
    g.save(); g.translate(h, h); g.rotate(camYaw + Math.PI - player.yaw);
    g.fillStyle = '#ffd23a'; g.strokeStyle = '#1d2330'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -17); g.lineTo(11, 13); g.lineTo(0, 6); g.lineTo(-11, 13); g.closePath(); g.fill(); g.stroke(); g.restore();
    g.fillStyle = '#fff'; g.font = '800 22px "Be Vietnam Pro", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('B', h + Math.sin(camYaw) * (h - 20), h - Math.cos(camYaw) * (h - 20));
  }

  // Bản đồ lớn: trả về hàm đổi toạ độ điểm bấm → toạ độ thế giới.
  drawBig(canvas, player, passport, fares) {
    const b = this.world.bounds, W = b.x1 - b.x0, H = b.z1 - b.z0, px = Math.min(1400, Math.round(innerWidth * 1.4));
    canvas.width = px; canvas.height = Math.round((px * H) / W); const g = canvas.getContext('2d'), s = px / W;
    g.fillStyle = MAP_COLORS.bg; g.fillRect(0, 0, canvas.width, canvas.height);
    if (this.bitmap) g.drawImage(this.bitmap, 0, 0, canvas.width, canvas.height);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const it of passport.items) {
      const x = (it.x - b.x0) * s, y = (it.z - b.z0) * s, ok = passport.visited.has(it.id);
      g.beginPath(); g.arc(x, y, 13, 0, 7); g.fillStyle = ok ? '#f7f1e3' : 'rgba(29,35,48,0.85)'; g.fill(); g.lineWidth = 3; g.strokeStyle = KIND_COL[it.kind]; g.stroke();
      g.font = ok ? '16px sans-serif' : '800 15px "Be Vietnam Pro", sans-serif'; g.fillStyle = '#fff'; g.fillText(ok ? it.icon : '?', x, y + 1);
    }
    if (fares.state === 'offer') { g.beginPath(); g.arc((fares.cust.x - b.x0) * s, (fares.cust.z - b.z0) * s, 9, 0, 7); g.fillStyle = '#ffd23a'; g.fill(); }
    if (fares.state === 'ride') { g.beginPath(); g.arc((fares.dest.x - b.x0) * s, (fares.dest.z - b.z0) * s, 10, 0, 7); g.fillStyle = '#3ae07a'; g.fill(); g.strokeStyle = '#fff'; g.stroke(); }
    const x = (player.pos.x - b.x0) * s, y = (player.pos.z - b.z0) * s;
    g.save(); g.translate(x, y); g.rotate(Math.PI - player.yaw); g.fillStyle = '#ffd23a'; g.strokeStyle = '#1d2330'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -14); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.closePath(); g.fill(); g.stroke(); g.restore();
    return (cx, cy) => { const r = canvas.getBoundingClientRect(); return [((cx - r.left) / r.width) * W + b.x0, ((cy - r.top) / r.height) * H + b.z0]; };
  }
}
