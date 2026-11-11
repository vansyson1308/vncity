// Vẽ bản đồ toàn vùng một lần trong worker (OffscreenCanvas) rồi chuyển về luồng chính dưới dạng ImageBitmap.
// Bảng màu tối kiểu bản đồ dẫn đường để các mốc và lộ trình nổi lên.
import { K, CAT } from '../data.js';

export const MAP_COLORS = { bg: '#262b33', block: '#2c323b', building: '#39414c', landmark: '#6b5a3c', water: '#2f5f86', green: '#2f4a38', road: '#566070', major: '#8a94a3', minor: '#444c58', foot: '#3b4350', rail: '#1c2026' };

export function drawMap(world, ppm) {
  const B = world.bounds, w = Math.ceil((B.x1 - B.x0) * ppm), h = Math.ceil((B.z1 - B.z0) * ppm);
  const c = new OffscreenCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = MAP_COLORS.bg; g.fillRect(0, 0, w, h);
  g.scale(ppm, ppm); g.translate(-B.x0, -B.z0);
  const ring = (p) => { g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); };
  const poly = (o, fill) => { g.beginPath(); ring(o.p); for (const hh of o.holes) ring(hh); g.fillStyle = fill; g.fill('evenodd'); };
  for (const gr of world.green) poly(gr, MAP_COLORS.green);
  for (const wt of world.water) poly(wt, MAP_COLORS.water);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const stroke = (r, col, width) => { const p = r.p; g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.strokeStyle = col; g.lineWidth = width; g.stroke(); };
  for (const r of world.roads) if (r.kind > K.pedestrian && r.kind !== K.steps && !(r.flags & 2)) stroke(r, MAP_COLORS.foot, Math.max(1.6, r.w));
  for (const r of world.roads) if (r.kind === K.service) stroke(r, MAP_COLORS.minor, Math.max(2.2, r.w));
  g.fillStyle = MAP_COLORS.building;
  g.beginPath(); for (const b of world.buildings) if (b.cat !== CAT.roof && !b.skip && b.cat !== CAT.temple && b.cat !== CAT.church) ring(b.p); g.fill();
  g.fillStyle = MAP_COLORS.landmark;
  g.beginPath(); for (const b of world.buildings) if (b.cat === CAT.temple || b.cat === CAT.church || b.skip) ring(b.p); g.fill();
  for (const r of world.roads) if (r.kind === K.residential || r.kind === K.pedestrian) stroke(r, MAP_COLORS.road, Math.max(3.5, r.w));
  for (const r of world.roads) if (r.kind === K.tertiary) stroke(r, MAP_COLORS.road, Math.max(5, r.w));
  for (const r of world.roads) if (r.kind <= K.secondary) stroke(r, MAP_COLORS.major, Math.max(6.5, r.w));
  g.setLineDash([5, 4]);
  for (const r of world.rails) stroke(r, MAP_COLORS.rail, 2.2);
  g.setLineDash([]);
  return c.transferToImageBitmap();
}
