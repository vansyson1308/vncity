// Worker dựng hình: nạp bản đồ một lần, sau đó sinh lưới cho từng ô phố theo yêu cầu của luồng chính.
// Nhờ vậy vòng lặp vẽ không bao giờ phải dừng lại để tính hình học.
import { decodeWorld } from './data.js';
import { buildContext } from './gen/context.js';
import { genGround } from './gen/ground.js';
import { genBuildings } from './gen/buildings.js';
import { genProps } from './gen/props.js';
import { drawMap } from './gen/mapdraw.js';
import { packBuffers } from '../core/geo.js';
import { resolveSites } from './landmarks/sites.js';

let ctx = null;
self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'init') {
      const W = await (await fetch(m.url)).json();
      const world = decodeWorld(W);
      const sites = resolveSites(world);
      ctx = buildContext(world, sites);
      self.postMessage({ type: 'ready', buildings: world.buildings.length, sites });
      if (m.mapPpm) { const bmp = drawMap(world, m.mapPpm); self.postMessage({ type: 'map', bitmap: bmp, ppm: m.mapPpm }, [bmp]); }
    } else if (m.type === 'chunk') {
      // Ô nền (mặt đất, nhà, đồ vật bản xa, va chạm). Chi tiết bản gần chỉ gửi khi được yêu cầu (m.detail),
      // vì phần lớn các ô ở xa không bao giờ cần tới nó: đỡ bộ nhớ GPU, tầm nhìn xa hơn.
      const t0 = performance.now();
      const b = genBuildings(ctx, m.cx, m.cz);
      const p = genProps(ctx, m.cx, m.cz, b);
      if (m.only === 'detail') { self.postMessage({ type: 'detail', cx: m.cx, cz: m.cz, near: p.near, leaf: p.leaf, plate: p.plate }, [...packBuffers(p.near), ...packBuffers(p.leaf), ...packBuffers(p.plate)]); return; }
      const g = genGround(ctx, m.cx, m.cz);
      const out = { type: 'chunk', cx: m.cx, cz: m.cz, ground: g.ground, deck: g.deck, deckTop: g.deckTop, ramp: g.ramp, water: g.water, shore: g.shore, bld: b.mesh, col: b.col, far: p.far, lamps: p.lamps, extra: p.extra || null, ms: performance.now() - t0 };
      const tr = [g.ground.pos.buffer, g.ground.nrm.buffer, g.ground.lay.buffer, g.ground.idx.buffer, g.shore.buffer, b.mesh.pos.buffer, b.mesh.nrm.buffer, b.mesh.uv.buffer, b.mesh.fx.buffer, b.mesh.va.buffer, b.mesh.idx.buffer, b.col.buffer, ...packBuffers(p.far), p.lamps.buffer];
      if (m.detail) { out.near = p.near; out.leaf = p.leaf; out.plate = p.plate; tr.push(...packBuffers(p.near), ...packBuffers(p.leaf), ...packBuffers(p.plate)); }
      if (p.extra && p.extra.walls) tr.push(p.extra.walls.buffer);
      if (g.water) tr.push(g.water.pos.buffer, g.water.col.buffer, g.water.idx.buffer);
      if (g.deck) tr.push(g.deck.pos.buffer, g.deck.nrm.buffer, g.deck.lay.buffer, g.deck.idx.buffer);
      tr.push(g.ramp.buffer);
      self.postMessage(out, tr);
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err && err.stack || err), cx: m.cx, cz: m.cz });
  }
};
