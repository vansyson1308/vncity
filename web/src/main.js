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
import { siteDecks } from './world/landmarks/sites.js';
import { signAtlas } from './world/atlas.js';
import { Player } from './actors/player.js';
import { Traffic } from './actors/traffic.js';
import { Crowd } from './actors/crowd.js';
import { Passport } from './game/passport.js';
import { Fares } from './game/fares.js';
import { Hud, $ } from './ui/hud.js';
import { Minimap } from './ui/minimap.js';
import { T, lang, setLang as setLangRaw, money, pick, both } from './ui/i18n.js';
import { Audio } from './audio/audio.js';
import { Governor } from './engine/governor.js';
import '@fontsource/be-vietnam-pro/vietnamese-400.css';
import '@fontsource/be-vietnam-pro/vietnamese-600.css';
import '@fontsource/be-vietnam-pro/vietnamese-800.css';
import '@fontsource/be-vietnam-pro/latin-400.css';
import '@fontsource/be-vietnam-pro/latin-600.css';
import '@fontsource/be-vietnam-pro/latin-800.css';

const params = new URLSearchParams(location.search);
const quality = pickQuality(params);
const canvas = $('game');
const progress = (f, text) => { $('bar').style.width = `${Math.round(f * 100)}%`; if (text) $('loadtext').textContent = text; };
setLangRaw(params.get('lang') || (() => { try { return localStorage.getItem('hn-lang'); } catch { return null; } })() || ((navigator.language || 'vi').startsWith('vi') ? 'vi' : 'en'));
$('lang').textContent = lang() === 'vi' ? 'English' : 'Tiếng Việt';

async function boot() {
  progress(0.05, T('loading'));
  const R = new Renderer(canvas, quality, params);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.3, 2400);
  R.setup(scene, camera);
  const sky = new Sky(scene, camera, quality);
  sky.speed = 1 / 360; // một giờ game dài sáu phút thật: từ chiều vàng tới lúc phố lên đèn mất chừng tám phút
  const fixedTime = params.has('h'); if (fixedTime) sky.setHours(+params.get('h'));
  const input = new Input(canvas), audio = new Audio(), hud = new Hud(input);
  input.onFirstGesture = () => audio.start();

  const base = (p) => new URL(p, document.baseURI).href;
  const json = (u) => fetch(base(u)).then((r) => { if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); });
  const gltfLoader = new GLTFLoader(); gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  const [W, places, humanGltf, humanFar, humanLod] = await Promise.all([json('world/hanoi.json'), json('world/places.json'), gltfLoader.loadAsync(base('models/human.glb')), gltfLoader.loadAsync(base('models/human_far.glb')), gltfLoader.loadAsync(base('models/human_lod.glb'))]);
  progress(0.3, T('building'));
  const world = decodeWorld(W, { withBuildings: false });
  const nav = new Nav(world);
  const atlas = await signAtlas(R.r, quality.aniso);
  const mats = buildMaterials(R.r, quality, atlas);
  const chunks = new Chunks(scene, world, mats, nav, quality);
  const pools = new LightPools(scene);
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
  const crowd = new Crowd(scene, world, nav, humanLod, quality);
  const passport = new Passport(scene, nav, places);
  const fares = new Fares(scene, nav, passport, crowd);
  const governor = new Governor(R, sky, quality, traffic, crowd, chunks);
  // vị trí các điểm đóng dấu đã được neo vào mô hình và vào chỗ tới được ngay trong places.json (tools/build_places.mjs)
  passport.refresh();
  // khu vực trang nghiêm: không chạy xe
  const solemn = passport.items.filter((i) => i.solemn).map((i) => ({ x: i.x, z: i.z, r: i.id === 'quang_truong_ba_dinh' ? 150 : 100 }));
  player.noRide = (x, z) => solemn.some((s) => (x - s.x) ** 2 + (z - s.z) ** 2 < s.r * s.r);

  // ----- điểm xuất phát: bờ hồ, trước cổng đền Ngọc Sơn, nhìn về cầu Thê Húc lúc chiều vàng -----
  let sx = 124, sz = -211, syaw = -1.67, resumed = false;
  const gate = site('ngoc_son_gate'); // bắt đầu trước cổng đền Ngọc Sơn
  if (gate) { sx = gate.x + Math.sin(gate.yaw) * 7; sz = gate.z + Math.cos(gate.yaw) * 7; syaw = gate.yaw + Math.PI; }
  const saved = passport.flags.pos;
  if (saved && passport.visited.size > 0 && !params.has('fresh')) { [sx, sz, syaw] = saved; resumed = true; if (!fixedTime && passport.flags.hours) sky.setHours(passport.flags.hours); }
  if (params.get('at')) { [sx, sz] = params.get('at').split(',').map(Number); resumed = false; }
  if (params.get('street')) {
    const name = params.get('street'), rs = world.roads.filter((r) => world.names[r.name] === name).sort((a, b) => b.len - a.len);
    if (rs.length) { const r = rs[Math.min(rs.length - 1, +(params.get('n') || 0))], p = r.p, i = Math.floor((p.length / 2 - 1) * +(params.get('along') || 0.5)) * 2, j = Math.min(i + 2, p.length - 2); sx = p[i]; sz = p[i + 1]; syaw = Math.atan2(p[j] - p[Math.max(0, j - 2)], p[j + 1] - p[Math.max(1, j - 1)]) + (params.has('rev') ? Math.PI : 0); }
  }
  if (params.get('site') && site(params.get('site'))) { // đứng trước mặt một công trình, nhìn vào nó (để chụp ảnh kiểm tra)
    const s = site(params.get('site')), d = +(params.get('back') || 45); sx = s.x + Math.sin(s.yaw) * d; sz = s.z + Math.cos(s.yaw) * d; syaw = s.yaw + Math.PI; resumed = false; }
  if (params.has('yaw')) syaw = +params.get('yaw');
  chunks.update(sx, sz, true);
  await new Promise((res) => { const t = setInterval(() => { chunks.update(sx, sz); const [miss, tot] = chunks.missingNear(sx, sz, 150); progress(0.45 + 0.55 * (1 - miss / tot)); if (miss === 0) { clearInterval(t); res(); } }, 50); });
  const onDeck = (x, z) => !!nav.elevatedAt(x, z, Infinity) && nav.eY > 0.7; // điểm nằm trên mặt cầu: không đẩy theo tường nhà dưới đất
  if (!onDeck(sx, sz)) { const p = { x: sx, z: sz }; nav.collide(p, 0.4); sx = p.x; sz = p.z; }
  player.teleport(sx, sz, syaw);
  if (params.has('bike')) player.toggleBike();
  cam.snap(player); cam.pitch = +(params.get('pitch') || 0.16);
  if (params.has('camyaw')) cam.yaw = +params.get('camyaw');
  if (params.has('zoom')) cam.zoom = +params.get('zoom');

  camera.position.set(player.pos.x - Math.sin(player.yaw) * 5, 3, player.pos.z - Math.cos(player.yaw) * 5); camera.lookAt(player.pos.x, 1.5, player.pos.z); camera.updateMatrixWorld();
  traffic.prewarm(player, camera, sky.hours); crowd.prewarm(player, camera);

  // ----- trạng thái và sự kiện lối chơi -----
  const G = { started: false, photo: false, t: 0, saveT: 0, slowT: 0, wasNight: sky.night > 0.5, crossT: 0, fps: 60 };
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
  passport.onPage = (pg) => { setTimeout(() => { hud.toast(T('g_page', { p: T('page_' + pg), m: money(50000) }), 6); audio.coin(); counts(); }, 1800); };
  fares.onEvent = (ev, f, res) => {
    if (ev === 'offer') { if (flag('g_fare')) hud.toast(T('g_fare'), 7); }
    else if (ev === 'pickup') { audio.click(); hud.toast(`${T('fare_to')} ${f.dest.place.name[lang()] || f.dest.place.name.vi}!`, 4, f.name(lang()), f.cust.face); }
    else if (ev === 'drop') { audio.coin(); counts(); hud.toast(`${'★'.repeat(res.stars)}${'☆'.repeat(5 - res.stars)} ${res.comment} ${money(res.base)}${res.tip ? ' + ' + money(res.tip) : ''}`, 6, '', '💵'); }
  };
  player.onCrash = (v) => { hud.bubble(pick('crash')); audio.thud(Math.min(0.6, 0.2 + v * 0.04)); cam.shake = Math.min(0.5, v * 0.05); fares.bump(Math.min(0.5, 0.12 + v * 0.03)); }; // v: vận tốc đâm vuông góc vào tường (m/s)
  player.onCurb = () => { audio.thud(0.12); fares.bump(0.025); };
  player.onStep = (v) => audio.footstep(v > 3.6);

  // ----- hộp thoại -----
  const openMap = () => {
    const toWorld = minimap.drawBig($('bigmap'), player, passport, fares); hud.open('map');
    $('bigmap').onclick = (e) => {
      const [wx, wz] = toWorld(e.clientX, e.clientY); let best = null, bd = 70;
      for (const it of passport.items) { if (!passport.visited.has(it.id)) continue; const d = Math.hypot(it.x - wx, it.z - wz); if (d < bd) { bd = d; best = it; } }
      if (!best || fares.state === 'ride') return;
      // chỗ đứng thoáng cạnh địa danh đã tính sẵn và kiểm tra bằng va chạm thật (tools/build_places.mjs, reach_check.mjs);
      // tới nơi thì quay mặt về địa danh
      const [tx, tz] = best.s || [best.x, best.z], far = Math.hypot(best.x - tx, best.z - tz) > 1.5;
      hud.close(); warp(tx, tz, far ? Math.atan2(best.x - tx, best.z - tz) : undefined); hud.toast(`${T('xeom')} ${best.name[lang()] || best.name.vi}`, 3, '', '🛵');
    };
  };
  let warpTo = null;
  const warp = (x, z, yaw) => { warpTo = [x, z, yaw]; chunks.update(x, z, true); };
  const shareText = () => T('shareText', { n: passport.visited.size, t: passport.items.length });
  const share = async () => { const url = location.origin + location.pathname; try { if (navigator.share) await navigator.share({ title: document.title, text: shareText(), url }); else { await navigator.clipboard.writeText(`${shareText()} ${url}`); hud.toast(T('copied'), 3, '', '🔗'); } } catch { /* người dùng huỷ */ } };
  $('k-share').addEventListener('click', share); $('d-share').addEventListener('click', share);
  $('k-reset').addEventListener('click', () => { passport.reset(); counts(); hud.openBook(passport); });
  document.querySelectorAll('#s-quality button').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.q === quality.name) return; // bấm lại mức đang dùng: không làm gì, không tải lại
    if (!window.confirm(T('q_confirm', { q: T('q_' + b.dataset.q) }))) return;
    try { localStorage.setItem('hn-quality', b.dataset.q); } catch { /* */ } savePos(); const u = new URL(location.href); u.searchParams.delete('q'); location.href = u;
  }));
  document.querySelectorAll('#s-sound button').forEach((b) => b.addEventListener('click', () => { audio.start(); audio.setEnabled(b.dataset.v === '1'); settings(); }));
  document.querySelectorAll('#s-music button').forEach((b) => b.addEventListener('click', () => { audio.start(); audio.setMusic(b.dataset.v === '1'); settings(); }));
  document.querySelectorAll('#s-lang button').forEach((b) => b.addEventListener('click', () => { setLang(b.dataset.l); settings(); }));
  // số khung hình hiển thị là số đo lúc đang chơi (trước khi mở bảng: khi bảng mở, cảnh 3D tạm dừng vẽ)
  const settings = () => hud.openSettings(quality.name, audio, G.fpsPlay ? T('perf', { f: Math.round(G.fpsPlay), d: Math.round((R.dpr / (window.devicePixelRatio || 1)) * 100) }) : T('perf_wait'));
  // đổi ngôn ngữ: mọi chữ đang hiện trên màn hình đổi theo ngay
  const setLang = (l) => { const from = lang(); setLangRaw(l); if (from !== lang()) { hud.relang(from); sugT = 0; } };
  const savePos = () => { passport.flags.pos = [+player.pos.x.toFixed(1), +player.pos.z.toFixed(1), +player.yaw.toFixed(2)]; passport.flags.hours = +sky.hours.toFixed(2); passport.save(); };
  addEventListener('pagehide', savePos);
  // card đồ hoạ bị ngắt giữa chừng (máy ngủ, driver khởi động lại): giữ vị trí, báo cho người chơi, có lại thì tải lại trang
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); savePos(); hud.toast(T('gl_lost'), 30, '', '⚠️', true); });
  canvas.addEventListener('webglcontextrestored', () => location.reload());
  const TIMES = [6.3, 12, 17.2, 20.5], TNAME = ['time_morning', 'time_noon', 'time_golden', 'time_night'];
  const nextTime = () => { const i = TIMES.findIndex((h) => h > sky.hours + 0.3), k = i < 0 ? 0 : i; sky.setHours(TIMES[k]); hud.toast(T(TNAME[k]), 2.5, '', k === 3 ? '🌙' : k === 2 ? '🌇' : k === 0 ? '🌅' : '☀️', true); G.wasNight = sky.night > 0.5; };
  const capture = () => {
    R.render(16, sky.exposure, sky.night);
    canvas.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ha-noi-dao-pho-${Date.now()}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }, 'image/png');
    hud.flash(); audio.shutter();
  };

  // ----- màn hình bắt đầu -----
  $('loading').classList.add('hidden');
  const begin = () => { G.started = true; $('start').classList.add('hidden'); hud.show(); input.enabled = true; audio.start(); canvas.focus(); if (!resumed && passport.visited.size === 0) setTimeout(() => hud.toast(T('g_first'), 8), 1200); };
  if (params.has('shot')) begin(); else { $('start').classList.remove('hidden'); if (resumed) $('play').textContent = T('resume'); }
  $('play').addEventListener('click', begin);
  $('lang').addEventListener('click', () => { setLang(lang() === 'vi' ? 'en' : 'vi'); $('lang').textContent = lang() === 'vi' ? 'English' : 'Tiếng Việt'; if (resumed) $('play').textContent = T('resume'); });

  // ----- vòng lặp -----
  const dbg = params.has('debug') ? Object.assign(document.body.appendChild(document.createElement('div')), { style: 'position:fixed;left:8px;bottom:8px;color:#fff;font:12px monospace;text-shadow:0 1px 2px #000;z-index:50;white-space:pre' }) : null;
  const auto = params.get('auto');
  let last = performance.now(), frames = 0, acc = 0, jsAcc = 0, sugT = 0, sugs = [];
  function loop(now) {
    requestAnimationFrame(loop);
    const dtMs = now - last, dt = Math.min(dtMs / 1000, 0.05); last = now; G.t += dt;
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
      if (input.take('mount')) { const r = player.toggleBike(); if (r === 'fast') hud.toast(T('g_fast'), 3); else if (r === 'forbidden') hud.toast(T('g_solemn'), 4); else audio.click(); }
      if (input.take('horn') && player.mode === 'bike' && !player.inNoRide) { audio.horn(0, 0.3); traffic.scare(player.pos.x, player.pos.z, Math.sin(player.yaw), Math.cos(player.yaw)); }
      if (input.take('interact')) {
        if (fares.prompt) fares.pickup(player);
        else if (passport.pending) { if (!passport.eat(passport.pending)) hud.toast(T('g_poor'), 5); else counts(); }
        else hud.toggleCard();
      }
    } else if (hud.modal) { if ((input.take('map') && hud.modal === 'map') || (input.take('book') && hud.modal === 'book')) hud.close(); }

    const frozen = !G.started || !!hud.modal;
    if (frozen) { input.move.x = input.move.y = 0; }
    if (warpTo && chunks.missingNear(warpTo[0], warpTo[1], 100)[0] === 0) { const p = { x: warpTo[0], z: warpTo[1] }; if (!onDeck(p.x, p.z)) nav.collide(p, 0.4); player.teleport(p.x, p.z, warpTo[2] ?? player.yaw); cam.snap(player); warpTo = null; }
    const wasX = player.pos.x, wasZ = player.pos.z;
    player.update(dt, input, cam.yaw);
    traffic.update(dt, player, camera, sky.hours);
    crowd.update(dt, player, camera);
    if (traffic.touch) { fares.bump(0.1 * traffic.touch); traffic.touch = 0; }
    for (const h of traffic.honks) { const dx = h[0] - player.pos.x, dz = h[1] - player.pos.z, d = Math.hypot(dx, dz); if (d < 60) audio.horn(Math.max(-1, Math.min(1, (dx * Math.cos(cam.yaw) - dz * Math.sin(cam.yaw)) / 20)), 0.26 / (1 + d * 0.12), h[2] >= 3); }
    traffic.honks.length = 0;
    if (G.started && !G.photo) { passport.update(player.pos.x, player.pos.z); fares.update(dt, player); }
    cam.update(dt, player, frozen ? null : input);
    // camera áp sát đầu (bị dồn vào góc tường) thì ẩn nhân vật để không nhìn xuyên vào trong người
    { const near = cam.close < 0.8; player.root.visible = !near; player.helmet.visible = player.mode === 'bike' && !near;
      skyU.uCut.value.set(player.pos.x, player.y + 1.25, player.pos.z, near || G.photo ? 0 : 0.62); }
    // đang đi nhanh tới nơi khác thì dựng các ô quanh điểm đến trước
    if (warpTo) chunks.update(warpTo[0], warpTo[1]); else chunks.update(player.pos.x, player.pos.z);
    sky.update(fixedTime || frozen ? 0 : dt, player.root.position); if (fixedTime || frozen) skyU.uTime.value += dt;
    mats.water.uniforms.uHemi.value.copy(sky.hemi.color).multiplyScalar(sky.hemi.intensity * 0.5);
    pools.update(skyU.uLit.value);

    // ----- giao diện -----
    if (G.started) {
      sugT -= dt;
      if (sugT <= 0) {
        sugT = 0.4; sugs = passport.suggestions(player.pos.x, player.pos.z).map((s) => ({ x: s.it.x, z: s.it.z, d: s.d, icon: s.it.icon, name: s.it.name, kind: s.it.kind }));
        if (fares.state === 'ride') sugs = sugs.filter((q) => !(Math.hypot(q.x - fares.dest.place.x, q.z - fares.dest.place.z) < 1)); // điểm trả khách trùng địa danh gợi ý: chỉ giữ một ô
        if (fares.state === 'ride') sugs = [{ x: fares.dest.x, z: fares.dest.z, d: fares.left || 0, icon: '🏁', name: fares.dest.place.name, kind: 'fare', color: '#3ae07a', big: true }, ...sugs.slice(0, 2)];
        else if (fares.state === 'offer') sugs = [...sugs.slice(0, 2), { x: fares.cust.x, z: fares.cust.z, d: Math.hypot(fares.cust.x - player.pos.x, fares.cust.z - player.pos.z), icon: '🙋', name: both('fare_wait'), kind: 'fare', color: '#ffd23a', big: true }];
        const rd = nav.nearestRoad(player.pos.x, player.pos.z, 14); hud.setStreet(rd && rd.r.name >= 0 ? world.names[rd.r.name] : '');
        hud.setClock(sky.hours); hud.fare(fares, fares.cust ? fares.name(lang()) : ''); counts();
        // lời nhắc theo tình huống
        const night = sky.night > 0.5; if (night && !G.wasNight && flag('g_night')) hud.toast(T('g_night'), 6); G.wasNight = night;
        if (player.inNoRide && G.t - G.slowT > 20) { G.slowT = G.t; hud.toast(T('g_solemn'), 5); }
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
