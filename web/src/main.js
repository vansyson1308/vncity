// Hà Nội Dạo Phố: điểm vào. Nạp bản đồ, dựng renderer và thế giới, chạy vòng lặp game, nối lối chơi với giao diện.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { pickQuality } from './config.js';
import { Renderer } from './engine/renderer.js';
import { Sky, skyU } from './engine/sky.js';
import { Input } from './engine/input.js';
import { FollowCamera } from './engine/camera.js';
import { decodeWorld } from './world/data.js';
import { Nav } from './world/nav.js';
import { buildMaterials } from './world/materials.js';
import { Chunks, LightPools } from './world/chunks.js';
import { buildLandmarks } from './world/landmarks/index.js';
import { siteDecks, freeSpot, openWays } from './world/landmarks/sites.js';
import { signAtlas } from './world/atlas.js';
import { streetMaterial } from './world/streetatlas.js';
import { Player } from './actors/player.js';
import { Traffic } from './actors/traffic.js';
import { Crowd } from './actors/crowd.js';
import { Passport } from './game/passport.js';
import { Fares } from './game/fares.js';
import { Hud, $ } from './ui/hud.js';
import { Minimap } from './ui/minimap.js';
import { T, lang, setLang as setLangRaw, money, pick, both, count } from './ui/i18n.js';
import { Audio } from './audio/audio.js';
import { Governor } from './engine/governor.js';
import { walkOn, isWalkRoad } from './world/walkzone.js';
import { WalkStreet } from './world/walkstreet.js';
import '@fontsource/be-vietnam-pro/vietnamese-400.css';
import '@fontsource/be-vietnam-pro/vietnamese-600.css';
import '@fontsource/be-vietnam-pro/vietnamese-800.css';
import '@fontsource/be-vietnam-pro/latin-400.css';
import '@fontsource/be-vietnam-pro/latin-600.css';
import '@fontsource/be-vietnam-pro/latin-800.css';

const params = new URLSearchParams(location.search);
// tham số số trên đường dẫn: thiếu, rỗng hay không phải số (at=abc, h=x) thì dùng giá trị mặc định, có thì kẹp vào khoảng hợp lệ
const pnum = (k, d, lo = -Infinity, hi = Infinity) => { const t = params.get(k), v = t === null || t.trim() === '' ? NaN : Number(t); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
const quality = pickQuality(params);
const canvas = $('game');
const progress = (f, text) => { $('bar').style.width = `${Math.round(f * 100)}%`; if (text) $('loadtext').textContent = text; };
setLangRaw(params.get('lang') || (() => { try { return localStorage.getItem('hn-lang'); } catch { return null; } })() || ((navigator.language || 'vi').startsWith('vi') ? 'vi' : 'en'));

async function boot() {
  progress(0.05, T('loading'));
  const R = new Renderer(canvas, quality, params);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.3, 2400);
  R.setup(scene, camera);
  const sky = new Sky(scene, camera, quality);
  sky.speed = 1 / 360; // một giờ game dài sáu phút thật: từ chiều vàng tới lúc phố lên đèn mất chừng tám phút
  const fixedTime = Number.isFinite(pnum('h', NaN)); if (fixedTime) sky.setHours(pnum('h', 17.5));
  if (params.has('day')) sky.day = Math.floor(pnum('day', 0, 0, 6)); // thứ trong tuần: 0 = thứ Hai ... 6 = Chủ nhật
  const input = new Input(canvas), audio = new Audio(), hud = new Hud(input);
  input.onFirstGesture = () => audio.start();
  input.onIme = () => hud.toast(T('ime_hint'), 10); // bộ gõ tiếng Việt nuốt phím: báo một lần

  const base = (p) => new URL(p, document.baseURI).href;
  const json = (u) => fetch(base(u)).then((r) => { if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); });
  const gltfLoader = new GLTFLoader(); gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  const [W, places, humanGltf, humanFar, humanLod] = await Promise.all([json('world/hanoi.json'), json('world/places.json'), gltfLoader.loadAsync(base('models/human.glb')), gltfLoader.loadAsync(base('models/human_far.glb')), gltfLoader.loadAsync(base('models/human_lod.glb'))]);
  progress(0.3, T('building'));
  const world = decodeWorld(W, { withBuildings: false });
  const nav = new Nav(world);
  const atlas = await signAtlas(R.r, quality.aniso);
  const mats = buildMaterials(R.r, quality, atlas);
  mats.street = await streetMaterial(mats, R.r, world, quality); // biển tên phố, đèn tín hiệu, băng rôn
  const chunks = new Chunks(scene, world, mats, nav, quality);
  const pools = new LightPools(R.r, quality);
  chunks.onLamps = (l) => pools.set(l);
  const minimap = new Minimap($('minimap'), world, nav);
  chunks.onMap = (bmp, ppm) => minimap.setBitmap(bmp, ppm);
  const ready = await chunks.init(base('world/hanoi.json'), null, quality.name === 'low' ? 0.5 : 0.75);
  const sites = ready.sites, site = (id) => sites.find((s) => s.id === id);
  progress(0.45);

  // cầu Thê Húc: mặt cầu vòm đi bộ được
  for (const d of siteDecks(sites)) nav.addDeck(d);
  const landmarks = await buildLandmarks(scene, sites, mats, nav, world);

  const player = new Player(scene, nav, humanGltf, mats, humanLod);
  const cam = new FollowCamera(camera, nav);
  const traffic = new Traffic(scene, world, nav, mats, humanFar, quality);
  traffic.walkPlan(); // tính sẵn bố trí phố đi bộ lúc đang tải (tính lúc phố đóng thì game khựng một nhịp)
  const crowd = new Crowd(scene, world, nav, humanLod, quality, humanFar, humanGltf);
  const passport = new Passport(scene, nav, places, params.has('fresh')); // ?fresh: không nạp tiến độ đã lưu, xoá bản lưu cũ ngay lúc tải
  const fares = new Fares(scene, nav, passport, crowd);
  const governor = new Governor(R, sky, quality, traffic, crowd, chunks);
  // vị trí các điểm đóng dấu đã được neo vào mô hình và vào chỗ tới được ngay trong places.json (tools/build_places.mjs)
  passport.refresh();
  // khu vực trang nghiêm: không chạy xe
  const solemn = passport.items.filter((i) => i.solemn).map((i) => ({ x: i.x, z: i.z, r: i.id === 'quang_truong_ba_dinh' ? 150 : 100 }));
  // phố đi bộ tối cuối tuần (world/walkzone.js): trong giờ đóng phố, các đoạn đường sau rào cũng là khu không chạy xe
  for (const r of world.roads) r.walk = isWalkRoad(world.names, r);
  const walkStreet = new WalkStreet(scene, mats);
  // Sau rào: đường xe gần nhất là đoạn đang đóng, và điểm không nằm trước vạch của một rào gần đó (phía phố còn mở). Ở nút giao,
  // một điểm trên làn của phố còn mở có thể gần tim đoạn phố đóng hơn tim phố mở (reviewer vòng 3: xe người chơi bị chặn đứng khi chỉ
  // đi ngang miệng Đinh Lễ trên Ngô Quyền); rào đặt trong phố đóng, cách nút max(4,5 m; nửa bề rộng lớn nhất của các đường còn mở ở
  // nút + 1,5 m) (trafficsim walkPlan), nên xe chỉ dừng khi qua đúng vạch rào nhìn thấy.
  // Trong bề ngang một rào: qua vạch (tới 6 m) là sau rào, trước vạch là phía phố mở. Ngoài mọi rào thì chỉ tính là sau rào khi điểm
  // không nằm trên lòng một đường đang mở (đi sát lề phố mở ngang qua miệng phố đóng vẫn là đi trên phố mở); trong vòng 12 m quanh
  // một rào thì cả vỉa hè phố mở (tới 2,5 m ngoài mép đường) cũng là phố mở: chạy trên hè phố mở ngang góc phố đóng không bị chặn
  // (reviewer vòng 4: 13/56 vệt cách mép đường 1 m bị chặn ở 9 nút).
  const behindGate = (x, z) => {
    let front = false, near = false;
    for (const g of traffic.gates) {
      const dx = x - g.x, dz = z - g.z, along = dx * g.tx + dz * g.tz, side = -dx * g.tz + dz * g.tx;
      if (Math.abs(side) < g.w / 2 + 1.5 && along > -6 && along < 6) { if (along >= 0) return true; front = true; } else if (dx * dx + dz * dz < 144) near = true;
    }
    if (front) return false;
    const h = nav.nearestRoad(x, z, 16, (rd) => rd.veh); if (!h || !h.r.shut) return false;
    // nằm trên lòng (hay vỉa hè, gần rào) một trong ba đường đang mở gần nhất (tim gần nhất có khi là một ngõ hẹp bên cạnh, không phải
    // phố đang đi) (nav.nearestRoad trả về cùng một đối tượng mỗi lần gọi: đọc h xong mới gọi tiếp)
    const seen = new Set(), pad = near ? 2.5 : 0.3;
    for (let i = 0; i < 3; i++) { const o = nav.nearestRoad(x, z, 16, (rd) => rd.veh && !rd.shut && !seen.has(rd)); if (!o) break; if (o.d < o.r.w / 2 + pad) return false; seen.add(o.r); }
    return true;
  };
  const inSolemn = (x, z) => solemn.some((s) => (x - s.x) ** 2 + (z - s.z) ** 2 < s.r * s.r);
  player.noRide = (x, z) => inSolemn(x, z) || (traffic.walk && behindGate(x, z));
  player.noEnter = (x, z) => traffic.walk && behindGate(x, z);
  // cuốc xe ôm không đón, không trả trong phố đi bộ khi phố đang đóng hoặc sắp đóng trong 45 phút tới
  fares.avoid = (x, z) => { if (!walkOn(sky.day, sky.hours) && !walkOn(sky.day, sky.hours + 0.75)) return false; const h = nav.nearestRoad(x, z, 30, (rd) => rd.veh); return !!h && (!!h.r.walk || !!h.r.shut); }; // shut: cả những đoạn đóng theo vì chỉ dẫn vào phố đi bộ

  // ----- điểm xuất phát: bờ hồ, trước cổng đền Ngọc Sơn, nhìn về cầu Thê Húc lúc chiều vàng -----
  let sx = 124, sz = -211, syaw = -1.67, resumed = false;
  const gate = site('ngoc_son_gate'); // bắt đầu trước cổng đền Ngọc Sơn
  if (gate) { sx = gate.x + Math.sin(gate.yaw) * 7; sz = gate.z + Math.cos(gate.yaw) * 7; syaw = gate.yaw + Math.PI; }
  // vị trí đã lưu chỉ dùng khi là ba số hữu hạn nằm trong bản đồ (bản lưu hỏng hay bị sửa tay không được làm game dừng lúc tải)
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  const sp = passport.flags.pos, wb = world.bounds;
  const saved = Array.isArray(sp) && num(sp[0]) && num(sp[1]) && sp[0] > wb.x0 + 8 && sp[0] < wb.x1 - 8 && sp[1] > wb.z0 + 8 && sp[1] < wb.z1 - 8 ? [sp[0], sp[1], num(sp[2]) ? sp[2] : 0] : null;
  if (saved && passport.visited.size > 0 && !params.has('fresh')) { [sx, sz, syaw] = saved; resumed = true; const fh = passport.flags.hours; if (!fixedTime && num(fh) && fh > 0 && fh < 24) sky.setHours(fh); const fd = passport.flags.day; if (!params.has('day') && Number.isInteger(fd) && fd >= 0 && fd <= 6) sky.day = fd; }
  const at = (params.get('at') || '').split(',').map((t) => (t.trim() === '' ? NaN : Number(t)));
  if (at.length >= 2 && num(at[0]) && num(at[1]) && at[0] > wb.x0 + 8 && at[0] < wb.x1 - 8 && at[1] > wb.z0 + 8 && at[1] < wb.z1 - 8) { [sx, sz] = at; resumed = false; }
  if (params.get('street')) {
    const name = params.get('street'), rs = world.roads.filter((r) => world.names[r.name] === name).sort((a, b) => b.len - a.len);
    if (rs.length) { const r = rs[Math.floor(pnum('n', 0, 0, rs.length - 1))], p = r.p, i = Math.floor((p.length / 2 - 1) * pnum('along', 0.5, 0, 1)) * 2, j = Math.min(i + 2, p.length - 2); sx = p[i]; sz = p[i + 1]; syaw = Math.atan2(p[j] - p[Math.max(0, j - 2)], p[j + 1] - p[Math.max(1, j - 1)]) + (params.has('rev') ? Math.PI : 0); }
  }
  if (params.get('site') && site(params.get('site'))) { // đứng trước mặt một công trình, nhìn vào nó (để chụp ảnh kiểm tra)
    const s = site(params.get('site')), d = pnum('back', 45, 1, 600); sx = s.x + Math.sin(s.yaw) * d; sz = s.z + Math.cos(s.yaw) * d; syaw = s.yaw + Math.PI; resumed = false; }
  const yawSet = Number.isFinite(pnum('yaw', NaN)); if (yawSet) syaw = pnum('yaw', 0);
  chunks.update(sx, sz, true);
  await new Promise((res) => { const t = setInterval(() => { chunks.update(sx, sz); const [miss, tot] = chunks.missingNear(sx, sz, 150); progress(0.45 + 0.55 * (1 - miss / tot)); if (miss === 0) { clearInterval(t); res(); } }, 50); });
  const onDeck = (x, z) => !!nav.elevatedAt(x, z, Infinity) && nav.eY > 0.7; // điểm nằm trên mặt cầu: không đẩy theo tường nhà dưới đất
  if (!onDeck(sx, sz)) {
    const wet = (x, z) => nav.isWater(x, z) && !(nav.decks.length && nav.deckAt(x, z, 0.3)); // đứng trên cầu Thê Húc thì không phải đang ở dưới nước
    // bản lưu cũ có thể nằm trong lòng một ngôi nhà hay trên mặt hồ (lỗi xuống xe sát tường của bản trước): đưa ra chỗ trống gần nhất
    if (resumed && (nav.inSolid(sx, sz) || wet(sx, sz))) [sx, sz] = nav.nearestFree(sx, sz, (x, z) => nav.inSolid(x, z) || !nav.clearAt(x, z, 0.45));
    // tham số at/street/site (đường dẫn chụp ảnh, người chơi dán lại cũng dùng được) cũng có thể rơi xuống hồ hay vào lòng nhà: dò từng vòng
    // quanh điểm đó lấy chỗ trống gần nhất có đường đi tới (không lấy gò đảo giữa hồ); với `site` thì ưu tiên chỗ còn nhìn thấy công trình
    // và quay mặt về phía nó
    // (chỗ bị vây kín, đi ra không được theo 3 trong 8 hướng, cũng phải dời). Không có chỗ nào trong 120 m (giữa mặt nước rộng) thì
    // lấy điểm gần nhất trên một con đường.
    const linked = !resumed && (params.get('at') || params.get('street') || params.get('site'));
    const tg = params.get('site') ? site(params.get('site')) : null, inside = (x, z) => nav.inSolid(x, z) || !nav.clearAt(x, z, 0.45);
    const relocate = (x, z) => { const to = freeSpot(nav, x, z, tg) || nav.nearestFree(x, z, inside, 600); if (tg && !yawSet) syaw = Math.atan2(tg.x - to[0], tg.z - to[1]); return to; };
    if (linked && (wet(sx, sz) || nav.inSolid(sx, sz) || openWays(nav, sx, sz) < 3)) [sx, sz] = relocate(sx, sz);
    const p = { x: sx, z: sz }; nav.collide(p, 0.4); sx = p.x; sz = p.z;
    // bước đẩy khỏi tường ở trên có thể đẩy một chỗ sát bờ xuống mặt nước hay vào khe tường: soát lại lần cuối
    if ((linked || resumed) && (wet(sx, sz) || nav.inSolid(sx, sz))) [sx, sz] = linked ? relocate(sx, sz) : nav.nearestFree(sx, sz, inside);
  }
  player.teleport(sx, sz, syaw);
  // trạng thái phố đi bộ phải có trước khi lên xe theo ?bike: vào game giữa phố đang đóng thì không ngồi sẵn trên xe
  traffic.day = sky.day; traffic.setWalk(walkOn(sky.day, sky.hours));
  if (params.has('bike')) player.toggleBike();
  const PITCH0 = pnum('pitch', 0.16, -0.35, 1.25); cam.snap(player); cam.pitch = PITCH0;
  if (Number.isFinite(pnum('camyaw', NaN))) { cam.yaw = pnum('camyaw', 0); cam.wasRiding = player.mode === 'bike'; } // góc camera đặt sẵn: không tự quay ra sau xe lúc vào game
  cam.zoom = pnum('zoom', cam.zoom, 0.55, 2.6);

  // camera tạm để rải xe, người trước khung hình đầu: đặt đúng hướng camera thật sẽ nhìn (cam.yaw, kể cả khi đường dẫn có camyaw), vì
  // dòng xe và đám đông dựa vào nó để không sinh ngay trước ống kính và để đặt tốp tập dưỡng sinh trong tầm mắt
  camera.position.set(player.pos.x + Math.sin(cam.yaw) * 5, 3, player.pos.z + Math.cos(cam.yaw) * 5); camera.lookAt(player.pos.x, 1.5, player.pos.z); camera.updateMatrixWorld();
  traffic.day = sky.day; crowd.walkOn = walkOn(sky.day, sky.hours);
  traffic.prewarm(player, camera, sky.hours); crowd.prewarm(player, camera, sky.hours);

  // ----- trạng thái và sự kiện lối chơi -----
  const G = { started: false, home: null, photo: false, t: 0, saveT: 0, slowT: 0, wasNight: sky.night > 0.5, crossT: 0, fps: 60, walk: false };
  const flag = (k) => { if (passport.flags[k]) return false; passport.flags[k] = 1; passport.save(); return true; };
  const counts = () => hud.setCounts(passport.visited.size, passport.items.length, passport.money);
  counts();
  passport.onStamp = (it) => {
    audio.stamp(); if (it.kind !== 'food') setTimeout(() => audio.coin(), 350);
    hud.showCard(it, passport.nearestUnvisited(it.x, it.z, it)); counts();
    const n = passport.visited.size;
    if (n === 1 && flag('g_bike')) hud.toast(T(input.touch ? 'g_bikeT' : 'g_bike'), 8);
    else if (n === 3 && flag('g_stamp3')) hud.toast(T('g_stamp3'), 6);
    if (passport.complete) setTimeout(() => { hud.open('done'); audio.bell(); }, 2500);
  };
  passport.onPage = (pg) => { setTimeout(() => { hud.toast(() => T('g_page', { p: T('page_' + pg), m: money(50000) }), 6); audio.coin(); counts(); }, 1800); };
  fares.onEvent = (ev, f, res) => {
    if (ev === 'offer') { if (flag('g_fare')) hud.toast(T('g_fare'), 7); }
    else if (ev === 'pickup') { audio.click(); const to = f.dest.place.name, who = { vi: f.name('vi'), en: f.name('en') }; hud.toast(() => `${T('fare_to')} ${to[lang()] || to.vi}!`, 4, () => who[lang()] || who.vi, f.cust.face); } // lời nhắn "sống": đổi ngôn ngữ thì chữ đang hiện đổi theo
    else if (ev === 'drop') { audio.coin(); counts(); const ci = Math.max(0, [].concat(T('c' + res.stars)).indexOf(res.comment)), said = () => { const cs = [].concat(T('c' + res.stars)); return cs[Math.min(ci, cs.length - 1)]; }; hud.toast(() => `${'★'.repeat(res.stars)}${'☆'.repeat(5 - res.stars)} ${said()} ${money(res.base)}${res.tip ? ' + ' + money(res.tip) : ''}`, 6, '', '💵'); }
  };
  player.onCrash = (v) => { hud.bubble(pick('crash')); audio.thud(Math.min(0.6, 0.2 + v * 0.04)); cam.shake = Math.min(0.5, v * 0.05); fares.bump(Math.min(0.5, 0.12 + v * 0.03)); }; // v: vận tốc đâm vuông góc vào tường (m/s)
  player.onCurb = () => { audio.thud(0.12); fares.bump(0.025); };
  player.onStep = (v) => audio.footstep(v > 3.6);

  // ----- hộp thoại -----
  const openMap = () => {
    hud.open('map'); const toWorld = minimap.drawBig($('bigmap'), player, passport, fares); // mở bảng trước: bản đồ vẽ mốc theo cỡ hiển thị thật
    $('bigmap').onclick = (e) => {
      const [wx, wz] = toWorld(e.clientX, e.clientY); let best = null, bd = toWorld.hit;
      for (const it of passport.items) { if (!passport.visited.has(it.id)) continue; const d = Math.hypot(it.x - wx, it.z - wz); if (d < bd) { bd = d; best = it; } }
      if (!best || fares.state === 'ride') return;
      // chỗ đứng ngắm đã tính sẵn bằng va chạm thật (tools/views.mjs): ngoài lòng đường xe chạy, camera sau lưng có chỗ, nhìn thấy
      // công trình; tới nơi thì quay mặt theo hướng đã tính. Bản places.json cũ không có v: đứng chỗ s, quay về điểm đóng dấu.
      hud.close();
      if (best.v) warp(best.v[0], best.v[1], best.v[2], null, best.v[3]); // v[3]: độ ngẩng camera khi tới (tháp chuông, tháp đồng hồ cao hơn khung hình mặc định)
      else { const [tx, tz] = best.s || [best.x, best.z], far = Math.hypot(best.x - tx, best.z - tz) > 1.5; warp(tx, tz, far ? Math.atan2(best.x - tx, best.z - tz) : undefined, far ? [best.x, best.z] : null); }
      hud.toast(() => `${T('xeom')} ${best.name[lang()] || best.name.vi}`, 3, '', '🛵', false, 'travel');
    };
  };
  let warpTo = null;
  // look: [x, z] của địa danh cần nhìn thấy khi tới nơi (đi nhanh bằng bản đồ); pitch: độ ngẩng camera khi tới. Tới nơi camera về sau lưng
  // (cam.snap) và về độ ngẩng mặc định, trừ chỗ có độ ngẩng riêng: không thì độ ngẩng của Bưu điện (ngước nhìn tháp) dính sang chỗ sau.
  // thẻ địa danh đang mở thuộc chỗ cũ ("Gần đây: ... 45 m về phía tây" sai ngay khi tới nơi khác): đóng lại
  const warp = (x, z, yaw, look = null, pitch) => { warpTo = [x, z, yaw, look, pitch]; chunks.update(x, z, true); G.home = null; hud.hideCard(); }; // đi nhanh tới đâu là đóng dấu ở đó ngay
  const shareText = () => T('shareText', { n: passport.visited.size, t: passport.items.length });
  const share = async () => { const url = location.origin + location.pathname; try { if (navigator.share) await navigator.share({ title: document.title, text: shareText(), url }); else { await navigator.clipboard.writeText(`${shareText()} ${url}`); hud.toast(T('copied'), 3, '', '🔗'); } } catch { /* người dùng huỷ */ } };
  $('k-share').addEventListener('click', share); $('d-share').addEventListener('click', share);
  $('k-reset').addEventListener('click', () => { passport.reset(); counts(); hud.openBook(passport); });
  document.querySelectorAll('#s-quality button').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.q === quality.name) return; // bấm lại mức đang dùng: không làm gì, không tải lại
    if (!window.confirm(T('q_confirm', { q: T('q_' + b.dataset.q) }))) return;
    try { localStorage.setItem('hn-quality', b.dataset.q); } catch { /* */ } savePos(); const u = new URL(location.href); u.searchParams.delete('q'); u.searchParams.delete('fresh'); location.href = u; // bỏ ?fresh: tải lại không được xoá tiến độ vừa lưu
  }));
  document.querySelectorAll('#s-sound button').forEach((b) => b.addEventListener('click', () => { audio.start(); audio.setEnabled(b.dataset.v === '1'); settings(); }));
  document.querySelectorAll('#s-music button').forEach((b) => b.addEventListener('click', () => { audio.start(); audio.setMusic(b.dataset.v === '1'); settings(); }));
  document.querySelectorAll('#s-beacons button').forEach((b) => b.addEventListener('click', () => { passport.setBeacons(b.dataset.v === '1'); settings(); }));
  document.querySelectorAll('#s-lang button').forEach((b) => b.addEventListener('click', () => { setLang(b.dataset.l); settings(); }));
  // số khung hình hiển thị là số đo lúc đang chơi (trước khi mở bảng: khi bảng mở, cảnh 3D tạm dừng vẽ)
  $('s-restore').addEventListener('click', () => {
    const b = Passport.backup(); if (!b || !window.confirm(T('restore_confirm', { s: count(b.stamps, 'stampn'), r: count(b.rides, 'rides') }))) return;
    if (!Passport.restore()) return;
    // tải lại không có ?fresh (có thì bản vừa khôi phục lại bị cất đi) và không đè vị trí đã lưu trong bản khôi phục
    removeEventListener('pagehide', savePos); const u = new URL(location.href); u.searchParams.delete('fresh'); location.href = u;
  });
  const settings = () => hud.openSettings(quality.name, audio, G.fpsPlay ? T('perf', { f: Math.round(G.fpsPlay), d: Math.round((R.dpr / (window.devicePixelRatio || 1)) * 100) }) : T('perf_wait'), Passport.backup(), passport.beaconsOn);
  // đổi ngôn ngữ: mọi chữ đang hiện trên màn hình đổi theo ngay
  const setLang = (l) => { const from = lang(); setLangRaw(l); if (from !== lang()) { hud.relang(from); sugT = 0; } };
  const savePos = () => { passport.flags.pos = [+player.pos.x.toFixed(1), +player.pos.z.toFixed(1), +player.yaw.toFixed(2)]; passport.flags.hours = +sky.hours.toFixed(2); passport.flags.day = sky.day; passport.save(); };
  addEventListener('pagehide', savePos);
  // card đồ hoạ bị ngắt giữa chừng (máy ngủ, driver khởi động lại): giữ vị trí, báo cho người chơi, có lại thì tải lại trang
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); savePos(); hud.toast(T('gl_lost'), 30, '', '⚠️', true); });
  canvas.addEventListener('webglcontextrestored', () => { const u = new URL(location.href); if (!u.searchParams.has('fresh')) return location.reload(); u.searchParams.delete('fresh'); location.replace(u); });
  const TIMES = [6.3, 12, 17.2, 20.5], TNAME = ['time_morning', 'time_noon', 'time_golden', 'time_night'];
  const nextTime = () => { const i = TIMES.findIndex((h) => h > sky.hours + 0.3), k = i < 0 ? 0 : i; sky.setHours(TIMES[k], true); hud.toast(T(TNAME[k]), 2.5, '', k === 3 ? '🌙' : k === 2 ? '🌇' : k === 0 ? '🌅' : '☀️', true); G.wasNight = sky.night > 0.5; };
  const capture = () => {
    R.render(16, sky.exposure, sky.night);
    canvas.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ha-noi-dao-pho-${Date.now()}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }, 'image/png');
    hud.flash(); audio.shutter();
  };

  // ----- màn hình bắt đầu -----
  $('loading').classList.add('hidden');
  // Điểm xuất phát (trước cổng đền Ngọc Sơn) nằm trong tầm đóng dấu của Tháp Bút: chỉ đóng dấu khi người chơi đã đi khỏi chỗ vào game
  // vài bước (hay đã đi nhanh tới đâu đó), để lời dẫn "đi qua cổng đền lấy con dấu đầu tiên" không bị lời khen chen ngang ngay giây đầu.
  const begin = () => { G.home = [player.pos.x, player.pos.z]; G.started = true; $('start').classList.add('hidden'); hud.show(); input.enabled = true; audio.start(); canvas.focus(); if (!resumed && passport.visited.size === 0) setTimeout(() => hud.toast(T('g_first'), 8), 1200); };
  if (resumed) { $('play').dataset.i18n = 'resume'; $('play').textContent = T('resume'); }
  if (params.has('shot')) begin(); else $('start').classList.remove('hidden');
  $('play').addEventListener('click', begin);
  $('lang').addEventListener('click', () => setLang(lang() === 'vi' ? 'en' : 'vi'));

  // ----- vòng lặp -----
  const dbg = params.has('debug') ? Object.assign(document.body.appendChild(document.createElement('div')), { style: 'position:fixed;left:8px;bottom:8px;color:#fff;font:12px monospace;text-shadow:0 1px 2px #000;z-index:50;white-space:pre' }) : null;
  const auto = params.get('auto');
  let last = performance.now(), frames = 0, acc = 0, jsAcc = 0, sugT = 0, sugs = [];
  function loop(now) {
    requestAnimationFrame(loop);
    // Dấu thời gian của requestAnimationFrame là lúc khung hình bắt đầu, có thể sớm hơn lần đo trước (performance.now() lúc khởi động
    // xong một tác vụ dài, hoặc khung trước): dt âm làm mọi phép damp ngoại suy bùng nổ (nhân vật, camera bay lên hàng trăm mét).
    const dtMs = Math.max(0, now - last), dt = Math.min(dtMs / 1000, 0.05); last = Math.max(last, now); G.t += dt;
    const t0 = performance.now();
    input.poll();
    if (auto && G.started) { input.move.y = auto.includes('w') ? 1 : 0; input.move.x = auto.includes('d') ? 0.35 : auto.includes('a') ? -0.35 : 0; input.run = auto.includes('r'); }
    // phím chung
    if (input.take('back')) { if (G.photo) { G.photo = false; $('hud').classList.remove('photo'); } else if (!hud.close()) { if (document.pointerLockElement) document.exitPointerLock(); } }
    if (G.started && !hud.modal) {
      if (input.take('map')) openMap();
      if (input.take('book')) hud.openBook(passport);
      if (input.take('settings')) settings();
      if (input.take('time')) nextTime();
      if (input.take('lang')) setLang(lang() === 'vi' ? 'en' : 'vi');
      if (input.take('photo')) { if (!G.photo) { G.photo = true; $('hud').classList.add('photo'); hud.bubble('📷'); } else capture(); }
      if (G.photo && input.take('interact')) capture();
      if (input.take('mount')) { const r = player.toggleBike(); if (r === 'fast') hud.toast(T('g_fast'), 3); else if (r === 'forbidden') hud.toast(T(inSolemn(player.pos.x, player.pos.z) ? 'g_solemn' : 'g_walk'), 4); else audio.click(); }
      if (input.take('horn') && player.mode === 'bike' && !player.inNoRide) { audio.horn(0, 0.3); traffic.scare(player.pos.x, player.pos.z, Math.sin(player.yaw), Math.cos(player.yaw)); }
      if (input.take('interact')) {
        if (fares.prompt) fares.pickup(player);
        else if (passport.pending) { if (!passport.eat(passport.pending)) hud.toast(T('g_poor'), 5); else counts(); }
        else hud.toggleCard();
      }
    } else if (hud.modal) { if ((input.take('map') && hud.modal === 'map') || (input.take('book') && hud.modal === 'book')) hud.close(); }

    const frozen = !G.started || !!hud.modal;
    if (frozen) { input.move.x = input.move.y = 0; }
    if (warpTo && chunks.missingNear(warpTo[0], warpTo[1], 100)[0] === 0) { const p = { x: warpTo[0], z: warpTo[1] }, look = warpTo[3]; let yaw = warpTo[2];
      // Chỗ đứng tính sẵn sát địa danh (vài mét, cạnh bậc thềm): camera sau lưng chỉ thấy chân tường (QC vòng 2: Nhà hát Lớn, Nhà thờ Lớn).
      // Lùi ra tới 24 m kể từ mốc, theo hướng từ mốc về chỗ đứng, nếu đường lùi thông (không vướng tường, rào, mặt nước) và chỗ mới không
      // ở lòng đường xe chạy; không được thì đứng chỗ cũ. Rồi quay mặt về địa danh.
      // Chỗ mới phải còn 4,6 m thông phía sau lưng cho camera (không thì camera bị tường ép sát lưng, lại chỉ thấy chân công trình);
      // không chỗ nào đủ thì lấy chỗ xa nhất đi tới được.
      if (look) { const ux = p.x - look[0], uz = p.z - look[1], d0 = Math.hypot(ux, uz) || 1, vx = ux / d0, vz = uz / d0; let pick = null;
        for (let d = 24; d > d0 + 1; d -= 2) { const cx = look[0] + vx * d, cz = look[1] + vz * d; if (!nav.freeStep(p.x, p.z, cx, cz, 0.4) || nav.onRoad(cx, cz)) continue;
          if (!pick) pick = [cx, cz]; if (nav.freeStep(cx, cz, cx + vx * 4.6, cz + vz * 4.6, 0.3)) { pick = [cx, cz]; break; } }
        if (pick) { p.x = pick[0]; p.z = pick[1]; yaw = Math.atan2(look[0] - p.x, look[1] - p.z); } }
      if (!onDeck(p.x, p.z)) nav.collide(p, 0.4); player.teleport(p.x, p.z, yaw ?? player.yaw); cam.snap(player); cam.pitch = Number.isFinite(warpTo[4]) ? warpTo[4] : PITCH0; warpTo = null;
      // tới nơi là phố đã đông sẵn như lúc vào game (không thì dòng xe chỉ sinh dần từ chỗ khuất mắt, con phố vắng tanh nửa phút đầu)
      camera.position.set(player.pos.x + Math.sin(cam.yaw) * 5, 3, player.pos.z + Math.cos(cam.yaw) * 5); camera.lookAt(player.pos.x, 1.5, player.pos.z); camera.updateMatrixWorld();
      traffic.agents.length = 0; traffic.prewarm(player, camera, sky.hours); crowd.prewarm(player, camera, sky.hours); }
    const wasX = player.pos.x, wasZ = player.pos.z;
    // đang chờ dựng các ô ở nơi đi nhanh tới: nhân vật đứng yên tại chỗ. Các ô quanh chỗ cũ có thể đã bị cất (cùng các đoạn va chạm
    // của chúng), xe còn trớn mà lăn tiếp thì trôi qua bờ hồ, qua tường (tester vòng 4, fuzz hạt 2: lọt 1 cm xuống mép Hồ Gươm).
    if (warpTo) { player.speed = 0; player.sync(dt); } else player.update(dt, input, cam.yaw);
    traffic.day = sky.day; traffic.update(dt, player, camera, sky.hours);
    if (traffic.walk !== G.walk) { G.walk = traffic.walk; crowd.walkOn = G.walk; walkStreet.set(G.walk, traffic.gates); if (G.walk && G.started && !fixedTime) hud.toast(T('g_walk_on'), 10); } // phố đi bộ vừa đóng hoặc mở: dựng hoặc cất rào
    crowd.update(dt, player, camera, sky.hours);
    if (traffic.touch) { fares.bump(0.1 * traffic.touch); traffic.touch = 0; }
    for (const h of traffic.honks) { const dx = h[0] - player.pos.x, dz = h[1] - player.pos.z, d = Math.hypot(dx, dz); if (d < 60) audio.horn(Math.max(-1, Math.min(1, (dx * Math.cos(cam.yaw) - dz * Math.sin(cam.yaw)) / 20)), 0.26 / (1 + d * 0.12), h[2] >= 3); }
    traffic.honks.length = 0;
    if (G.home && Math.hypot(player.pos.x - G.home[0], player.pos.z - G.home[1]) > 2.5) G.home = null;
    if (G.started && !G.photo) { if (!G.home) passport.update(player.pos.x, player.pos.z); fares.update(dt, player); }
    cam.update(dt, player, frozen ? null : input);
    // camera áp sát đầu (bị dồn vào góc tường) thì ẩn nhân vật để không nhìn xuyên vào trong người
    { const near = cam.close < 0.8; player.root.visible = !near; player.helmet.visible = player.mode === 'bike' && !near;
      skyU.uCut.value.set(player.pos.x, player.y + 1.25, player.pos.z, near || G.photo ? 0 : 0.62); }
    // đang đi nhanh tới nơi khác thì dựng các ô quanh điểm đến trước
    if (warpTo) chunks.update(warpTo[0], warpTo[1]); else chunks.update(player.pos.x, player.pos.z);
    sky.update(fixedTime || frozen ? 0 : dt, player.root.position); if (fixedTime || frozen) skyU.uTime.value += dt;
    mats.water.uniforms.uHemi.value.copy(sky.hemi.color).multiplyScalar(sky.hemi.intensity * 0.5);
    pools.update(skyU.uLit.value, player.pos.x, player.pos.z);

    // ----- giao diện -----
    if (G.started) {
      sugT -= dt;
      if (sugT <= 0) {
        sugT = 0.4; sugs = passport.suggestions(player.pos.x, player.pos.z).map((s) => ({ x: s.it.x, z: s.it.z, d: s.d, icon: s.it.icon, name: s.it.name, kind: s.it.kind }));
        if (fares.state === 'ride') sugs = sugs.filter((q) => !(Math.hypot(q.x - fares.dest.place.x, q.z - fares.dest.place.z) < 1)); // điểm trả khách trùng địa danh gợi ý: chỉ giữ một ô
        if (fares.state === 'ride') sugs = [{ x: fares.dest.x, z: fares.dest.z, d: fares.left || 0, icon: '🏁', name: fares.dest.place.name, kind: 'fare', color: '#3ae07a', big: true }, ...sugs.slice(0, 2)];
        else if (fares.state === 'offer') sugs = [...sugs.slice(0, 2), { x: fares.cust.x, z: fares.cust.z, d: Math.hypot(fares.cust.x - player.pos.x, fares.cust.z - player.pos.z), icon: '🙋', name: both('fare_wait'), kind: 'fare', color: '#ffd23a', big: true }];
        const rd = nav.nearestRoad(player.pos.x, player.pos.z, 14); hud.setStreet(rd && rd.r.name >= 0 ? world.names[rd.r.name] : '');
        hud.setClock(sky.hours, sky.day); hud.fare(fares, fares.cust ? fares.name(lang()) : ''); counts();
        // lời nhắc theo tình huống
        const night = sky.night > 0.5; if (night && !G.wasNight && flag('g_night')) hud.toast(T('g_night'), 6); G.wasNight = night;
        if (player.barred) { player.barred = false; if (G.t - G.slowT > 8) { G.slowT = G.t; hud.toast(T('g_walk_stop'), 5); } }
        if (player.inNoRide && G.t - G.slowT > 20) { G.slowT = G.t; hud.toast(T(inSolemn(player.pos.x, player.pos.z) ? 'g_solemn' : 'g_walk'), 5); }
        if (player.mode === 'walk' && nav.onRoad(player.pos.x, player.pos.z) && traffic.countNear(player.pos.x, player.pos.z, 14) >= 3 && flag('g_cross')) hud.toast(T('g_cross'), 7);
        if (passport.visited.size >= 2 && passport.money >= 45000 && ![...passport.visited].some((id) => passport.byId.get(id).kind === 'food') && flag('g_food')) hud.toast(T('g_food'), 6);
        const b = world.bounds; if ((player.pos.x < b.x0 + 12 || player.pos.x > b.x1 - 12 || player.pos.z < b.z0 + 12 || player.pos.z > b.z1 - 12) && G.t - (G.edgeT || -99) > 12) { G.edgeT = G.t; hud.toast(T('g_edge'), 4); }
        G.saveT += 0.4; if (G.saveT > 10) { G.saveT = 0; savePos(); }
      }
      for (const s of sugs) s.d = Math.hypot(s.x - player.pos.x, s.z - player.pos.z);
      hud.setCompass(sugs, player.pos.x, player.pos.z, cam.yaw);
      hud.setSpeed(player.mode === 'bike' ? Math.abs(player.speed) * 3.6 : null);
      if (fares.prompt) hud.prompt('E', T('p_pick'));
      else if (passport.pending) hud.prompt('E', T('p_eat', { d: passport.pending.name[lang()] || passport.pending.name.vi, m: money(passport.pending.price) }));
      else hud.prompt(null);
      if (!G.photo) minimap.draw(player, cam.yaw, sugs, player.mode === 'bike');
      hud.update(dt);
      const moved = Math.hypot(player.pos.x - wasX, player.pos.z - wasZ) / Math.max(dt, 1e-3);
      audio.update(dt, { riding: player.mode === 'bike', speed: player.speed, throttle: input.move.y, full: !!input.run, brake: player.mode === 'bike' ? player.braking || 0 : 0, hours: sky.hours, agentsNear: traffic.countNear(player.pos.x, player.pos.z, 30), night: sky.night, green: G.green || 0, calm: (G.green || 0) > 0.4 && moved < 4 });
      if (!G.greenT || G.t - G.greenT > 1.5) { G.greenT = G.t; G.green = nav.isWater(player.pos.x + 25, player.pos.z) || nav.isWater(player.pos.x - 25, player.pos.z) || nav.isWater(player.pos.x, player.pos.z + 25) || nav.isWater(player.pos.x, player.pos.z - 25) ? 0.8 : 0.2; }
    }
    input.endFrame();
    jsAcc += performance.now() - t0;
    // bảng đang mở: cảnh 3D đứng yên phía sau, vẽ thêm vài khung cho xong rồi thôi (đỡ tốn máy, quạt không rú)
    G.modalFrames = hud.modal ? (G.modalFrames || 0) + 1 : 0;
    if (!window.__norender && G.modalFrames < 4) R.render(dtMs, sky.exposure, sky.night); // __norender: bài nghiệm thu tự động tắt vẽ để chạy nhanh trên máy không có GPU
    frames++; acc += dtMs;
    if (acc > 500) {
      const i = R.r.info.render; G.fps = (1000 * frames) / acc; if (G.started && !hud.modal && !document.hidden) G.fpsPlay = G.fps;
      window.__info = { fps: +G.fps.toFixed(1), js: +(jsAcc / frames).toFixed(2), calls: i.calls, tris: i.triangles, chunks: chunks.loaded.size, pending: chunks.pending.size, geo: R.r.info.memory.geometries, tex: R.r.info.memory.textures, pos: [+player.pos.x.toFixed(1), +player.pos.z.toFixed(1)], speed: +player.speed.toFixed(1), agents: traffic.agents.length, people: crowd.people.length, dpr: +R.dpr.toFixed(2), stamps: passport.visited.size, landmarks: landmarks.length, level: governor.level };
      if (!hud.modal) governor.tick(G.fps);
      // công trình ở quá xa (khuất trong sương) thì khỏi vẽ
      for (const l of landmarks) l.mesh.visible = (l.site.x - player.pos.x) ** 2 + (l.site.z - player.pos.z) ** 2 < (quality.view + 260) ** 2;
      if (dbg) dbg.textContent = Object.entries(window.__info).map(([k, v]) => `${k} ${v}`).join('  ');
      frames = 0; acc = 0; jsAcc = 0;
      if (!chunks.pending.size && !chunks.want.length) document.title = lang() === 'vi' ? 'Hà Nội Dạo Phố' : 'Hanoi Stroll', window.__ready = true;
    }
  }
  window.__game = { audio, G, setLang, chunks, sky, nav, world, cam, R, scene, camera, player, input, traffic, crowd, passport, fares, hud, landmarks, sites, warp, get warping() { return !!warpTo; }, ready: true };
  requestAnimationFrame(loop);
}

boot().catch((e) => {
  console.error(e);
  // không tạo được WebGL2: nói rõ nguyên nhân và cách khắc phục thay vì một dòng lỗi kỹ thuật
  $('loadtext').textContent = e && e.code === 'NO_WEBGL2' ? T('no_webgl') : `${T('error')} ${e && e.message ? e.message : e}`;
  $('loadtext').style.whiteSpace = 'pre-line'; $('bar').style.background = '#b3121f'; window.__bootError = e && (e.code || e.message);
});
