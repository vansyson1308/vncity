// Hà Nội Dạo Phố: bản web three.js quảng bá du lịch, dùng dữ liệu vncity và mô hình craft-anything.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { City } from './city.js';
import { placeLandmarks, placeLanterns, placeStreetLamps, placeRailing, placeStools, placeSigns, Trees } from './props.js';
import { Player, Traffic, Crowd, Dog, cleanClips } from './actors.js';
import { Tour } from './tour.js';
import foods from './data/foods.json';
import { T, setLang, lang } from './i18n.js';
import { Sound } from './sound.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const canvas = $('game');
const touch = matchMedia('(pointer: coarse)').matches;
let quality = params.get('q') || (touch ? 'low' : 'high');

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shot') });
renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.75 : 1));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.2, 2600);
scene.fog = new THREE.Fog(0xc9d6df, 180, 1500);

const sky = new Sky(); sky.scale.setScalar(4000); scene.add(sky);
const su = sky.material.uniforms;
su.turbidity.value = 6; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.006; su.mieDirectionalG.value = 0.85;
const sunDir = new THREE.Vector3();
const sun = new THREE.DirectionalLight(0xfff1dc, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(quality === 'high' ? 4096 : 1024, quality === 'high' ? 4096 : 1024);
Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 10, far: 500 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x8a7a66, 0.9); scene.add(hemi);
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.25, 0.6, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

// ---------- thời gian trong ngày ----------
const TIMES = [
  { id: 'morning', el: 18, az: 110, sun: 2.6, hemi: 0.9, exp: 0.55, fog: 0xd3dde3, night: false, icon: '🌤️' },
  { id: 'afternoon', el: 38, az: 200, sun: 3.2, hemi: 1.0, exp: 0.5, fog: 0xcad7e0, night: false, icon: '☀️' },
  { id: 'sunset', el: 4, az: 255, sun: 1.8, hemi: 0.55, exp: 0.62, fog: 0xd9a77c, night: false, icon: '🌅' },
  { id: 'night', el: -8, az: 290, sun: 0.0, hemi: 0.55, exp: 1.0, fog: 0x1a2233, night: true, icon: '🌙' },
];
let timeIdx = Math.max(0, TIMES.findIndex((t) => t.id === params.get('time')));
if (!params.get('time')) timeIdx = 1;
const moon = new THREE.DirectionalLight(0x9fb4ff, 0.7);
scene.add(moon);
let glows = [];
const lamps = [];
for (let i = 0; i < (quality === 'high' ? 12 : 6); i++) { const l = new THREE.PointLight(0xffd29a, 0, 14, 1.6); scene.add(l); lamps.push(l); }

function applyTime() {
  const t = TIMES[timeIdx];
  const phi = THREE.MathUtils.degToRad(90 - Math.max(t.el, -4)), theta = THREE.MathUtils.degToRad(t.az);
  sunDir.setFromSphericalCoords(1, phi, theta);
  su.sunPosition.value.copy(sunDir);
  su.rayleigh.value = t.night ? 0.4 : t.id === 'sunset' ? 2.6 : 1.6;
  sun.intensity = t.sun; sun.color.set(t.id === 'sunset' ? 0xffb37a : 0xfff1dc);
  sun.visible = !t.night;
  moon.visible = t.night; moon.position.set(-200, 300, 120);
  hemi.intensity = t.hemi; hemi.color.set(t.night ? 0x4a5d8a : 0xcfe3ff);
  renderer.toneMappingExposure = t.exp;
  scene.fog.color.set(t.fog);
  sky.visible = true;
  // môi trường phản chiếu lấy từ bầu trời
  const envScene = new THREE.Scene(); const s2 = new Sky(); s2.scale.setScalar(1000); envScene.add(s2);
  Object.keys(su).forEach((k) => { if (s2.material.uniforms[k]) s2.material.uniforms[k].value = su[k].value.clone ? su[k].value.clone() : su[k].value; });
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(envScene, 0.02);
  scene.environment = envRT.texture;
  scene.environmentIntensity = t.night ? 0.35 : 0.8;
  if (t.night) { scene.background = new THREE.Color(0x101a30); sky.visible = false; } else scene.background = null;
  bloom.strength = t.night ? 0.9 : 0.15; bloom.threshold = t.night ? 0.6 : 0.95;
  if (city) {
    city.nightMats.forEach((m) => (m.emissiveIntensity = t.night ? 0.75 : t.id === 'sunset' ? 0.25 : 0));
    if (signMat) signMat.emissiveIntensity = t.night ? 0.8 : 0.05;
  }
  lamps.forEach((l) => (l.visible = t.night));
  $('b-time').textContent = t.icon;
}

// ---------- tải tài nguyên ----------
const manager = new THREE.LoadingManager();
manager.onProgress = (_u, done, total) => { $('bar').style.width = `${(done / total) * 100}%`; $('loadtext').textContent = `${T('loading')} ${done}/${total}`; };
const gltf = new GLTFLoader(manager); gltf.setMeshoptDecoder(MeshoptDecoder);
const texLoader = new THREE.TextureLoader(manager);
const MODELS = ['thap_rua', 'den_ngoc_son', 'cau_the_huc', 'thap_but_dai_nghien', 'minh', 'khach_01', 'khach_02', 'khach_03', 'cho_co', 'xe_may', 'den_long_01', 'den_long_02', 'den_long_03', 'den_duong', 'hang_rao_ho', 'ghe_do', 'ghe_xanh', 'ban_nhua', 'xa_cu', 'anim'];

let city, player, traffic, crowd, dog, tour, trees, signMat, sound;
const sound0 = new Sound();

async function boot() {
  setLang(params.get('lang') || localStorage.getItem('hn-lang') || 'vi');
  const json = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u); return r.json(); });
  const [data, signs, landmarks, ...glbs] = await Promise.all([
    json('assets/hoankiem.json'), json('assets/signs.json'), json('assets/landmarks.json'),
    ...MODELS.map((m) => gltf.loadAsync(`assets/${m}.glb`)),
  ]);
  const glb = Object.fromEntries(MODELS.map((m, i) => [m, glbs[i]]));
  $('loadtext').textContent = T('building');
  await new Promise((r) => setTimeout(r, 30));

  city = new City(data, renderer, texLoader).build();
  scene.add(city.group);
  const props = new THREE.Group(); scene.add(props);
  placeLandmarks(city, glb, props);
  placeRailing(city, glb, props);
  placeLanterns(city, glb, props, glows);
  placeStreetLamps(city, glb, props, glows);
  placeStools(city, glb, props);
  signMat = placeSigns(city, signs, props);
  trees = new Trees(city, glb, texLoader.load('assets/tex/xa_cu_billboard.webp'), props);

  const clips = cleanClips(glb.anim.animations);
  player = new Player(city, glb, clips, scene);
  player.setWalkables(['cau_the_huc', 'den_ngoc_son', 'thap_but_dai_nghien'].map((k) => glb[k].scene));
  traffic = new Traffic(city, glb, scene, quality === 'high' ? 80 : 40);
  crowd = new Crowd(city, glb, clips, scene, quality === 'high' ? 30 : 14);
  dog = new Dog(glb, scene);
  tour = new Tour(city, landmarks, foods.items, scene);
  tour.onStamp = onStamp;

  // điểm xuất phát: bờ hồ cạnh Tháp Bút, nhìn ra cầu Thê Húc
  const gate = city.sites.thap_but_dai_nghien;
  if (gate) {
    const th = city.sites.cau_the_huc;
    const away = gate.at.clone().sub(th.a.distanceTo(gate.at) < 1 ? th.b : th.a).normalize();
    const start = city.nearestFree(gate.at.clone().addScaledVector(away, 16));
    player.teleport(start.x, start.y, Math.atan2(-away.x, -away.y));
    cam.yaw = player.yaw + Math.PI;
  }
  const saved = params.get('at');
  if (saved) { const [x, z] = saved.split(',').map(Number); const f = city.nearestFree(new THREE.Vector2(x, z), 120); player.teleport(f.x, f.y); if (params.has('yaw')) { player.yaw = +params.get('yaw'); cam.yaw = player.yaw + Math.PI; } }
  if (params.get('street')) { const m = city.roadMid(params.get('street')); if (m) { player.teleport(m.x, m.y, +(params.get('yaw') || 0)); cam.yaw = player.yaw + Math.PI; } }
  dog.place(player.pos.x, player.pos.z);
  city.drawMap();
  applyTime();
  trees.update(player.pos.x, player.pos.z);
  updateCount();
  $('loading').classList.add('hidden');
  if (params.has('shot')) { started = true; $('hud').classList.remove('hidden'); }
  else $('start').classList.remove('hidden');
  window.__game = { city, player, tour, camera, renderer, cam, setTime: (i) => { timeIdx = i; applyTime(); }, ready: true };
  requestAnimationFrame(loop);
}

// ---------- camera ----------
const cam = { yaw: 0, pitch: 0.32, dist: 7, target: new THREE.Vector3() };
function updateCamera(dt) {
  const bike = player.mode === 'bike';
  if (bike && !dragging && Math.abs(player.speed) > 1) {
    let d = ((player.yaw + Math.PI - cam.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    cam.yaw += d * Math.min(1, dt * 2.5);
  }
  const want = new THREE.Vector3(player.pos.x, player.y + 1.55, player.pos.z);
  if (cam.target.distanceTo(want) > 15) cam.target.copy(want); else cam.target.lerp(want, 1 - Math.exp(-dt * 12));
  let dist = cam.dist * (bike ? 1.25 : 1);
  const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
  // không cho camera chui vào trong nhà
  for (let s = 0.8; s <= dist; s += 0.4) {
    const p = cam.target.clone().addScaledVector(dir, s);
    if (p.y < 30 && city.blocked(p.x, p.z, 0.2) && !city.isWater(p.x, p.z)) { dist = Math.max(0.8, s - 0.4); break; }
  }
  camera.position.copy(cam.target).addScaledVector(dir, dist);
  if (camera.position.y < 0.4) camera.position.y = 0.4;
  camera.lookAt(cam.target);
}

// ---------- điều khiển ----------
const keys = new Set();
let dragging = false, lastX = 0, lastY = 0, started = false, modalOpen = false;
addEventListener('keydown', (e) => {
  if (!started) return;
  const k = e.key.toLowerCase();
  if (modalOpen) { if (k === 'escape' || k === 'enter' || k === 'e' || k === ' ') closeModals(); if (k === 'm' && !$('map').classList.contains('hidden')) closeModals(); return; }
  keys.add(k);
  if (k === 'f') toggleBike();
  if (k === 'm') openMap();
  if (k === 'n') { timeIdx = (timeIdx + 1) % TIMES.length; applyTime(); }
  if (k === 'b') openBook();
  if (k === 'l') toggleLang();
  if (k === 'h') $('hud').classList.toggle('photo');
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') return; dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); sound0.start(); });
canvas.addEventListener('pointermove', (e) => { if (!dragging) return; cam.yaw -= (e.clientX - lastX) * 0.005; cam.pitch = THREE.MathUtils.clamp(cam.pitch + (e.clientY - lastY) * 0.004, -0.15, 1.3); lastX = e.clientX; lastY = e.clientY; });
canvas.addEventListener('pointerup', () => (dragging = false));
canvas.addEventListener('wheel', (e) => { cam.dist = THREE.MathUtils.clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), 2.5, 40); e.preventDefault(); }, { passive: false });

// cảm ứng: cần điều khiển bên trái, vuốt bên phải để nhìn
const stick = { x: 0, y: 0, id: null, cx: 0, cy: 0 };
let runToggle = false, look = null;
$('stick').addEventListener('pointerdown', (e) => { const r = $('stick').getBoundingClientRect(); stick.id = e.pointerId; stick.cx = r.left + r.width / 2; stick.cy = r.top + r.height / 2; $('stick').setPointerCapture(e.pointerId); sound0.start(); moveStick(e); });
$('stick').addEventListener('pointermove', (e) => e.pointerId === stick.id && moveStick(e));
$('stick').addEventListener('pointerup', () => { stick.id = null; stick.x = stick.y = 0; $('knob').style.transform = ''; });
function moveStick(e) {
  let dx = (e.clientX - stick.cx) / 55, dy = (e.clientY - stick.cy) / 55; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
  stick.x = dx; stick.y = dy; $('knob').style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
}
canvas.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; look = { id: t.identifier, x: t.clientX, y: t.clientY }; }, { passive: true });
canvas.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (look && t.identifier === look.id) { cam.yaw -= (t.clientX - look.x) * 0.008; cam.pitch = THREE.MathUtils.clamp(cam.pitch + (t.clientY - look.y) * 0.006, -0.15, 1.3); look.x = t.clientX; look.y = t.clientY; } }, { passive: true });
canvas.addEventListener('touchend', () => (look = null));
$('t-run').addEventListener('pointerdown', () => { runToggle = !runToggle; $('t-run').classList.toggle('on', runToggle); });

function input() {
  let x = 0, y = 0;
  if (keys.has('w') || keys.has('arrowup')) y -= 1;
  if (keys.has('s') || keys.has('arrowdown')) y += 1;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  x += stick.x; y += stick.y;
  return { x: THREE.MathUtils.clamp(x, -1, 1), y: THREE.MathUtils.clamp(y, -1, 1), run: keys.has('shift') || runToggle, camYaw: cam.yaw };
}

function toggleBike() {
  const m = player.toggleBike();
  $('b-bike').classList.toggle('on', m === 'bike');
  toast(T(m === 'bike' ? 'bikeOn' : 'bikeOff'));
}

// ---------- giao diện ----------
let toastT = 0;
function toast(msg, s = 3) { $('toast').textContent = msg; $('toast').classList.remove('hidden'); toastT = s; }
function updateCount() {
  $('count').textContent = `${tour.visited.size}/${tour.items.length}`;
}
function onStamp(it, first) {
  const L = lang();
  $('s-kind').textContent = tour.kindLabel(it, L);
  $('s-name').textContent = it.name[L] || it.name.vi;
  $('s-desc').textContent = it.desc?.[L] || it.desc?.vi || '';
  $('s-extra').textContent = [it.year ? `${T('built')} ${it.year}` : '', it.street || ''].filter(Boolean).join(' · ');
  $('stampmark').textContent = T(first ? 'stamped' : 'again');
  $('stampmark').style.animation = 'none'; void $('stampmark').offsetWidth; $('stampmark').style.animation = '';
  if (!first) { toast(`${it.icon} ${it.name[L]}`); return; }
  openModal('stamp');
  sound0.chime();
  updateCount();
}
function openModal(id) { closeModals(); $(id).classList.remove('hidden'); modalOpen = true; keys.clear(); }
function closeModals() {
  const wasStamp = !$('stamp').classList.contains('hidden');
  ['stamp', 'map', 'book', 'done'].forEach((m) => $(m).classList.add('hidden')); modalOpen = false;
  if (wasStamp && tour.visited.size === tour.items.length && !tour.certShown) { tour.certShown = true; openModal('done'); sound0.chime(); }
}
['s-close', 'm-close', 'k-close', 'd-close'].forEach((b) => $(b).addEventListener('click', closeModals));
document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closeModals(); }));
$('b-bike').addEventListener('click', toggleBike);
$('b-map').addEventListener('click', openMap);
$('b-time').addEventListener('click', () => { timeIdx = (timeIdx + 1) % TIMES.length; applyTime(); });
$('b-book').addEventListener('click', openBook);
$('b-lang').addEventListener('click', toggleLang);
$('lang').addEventListener('click', toggleLang);
$('b-q').addEventListener('click', () => { const q = quality === 'high' ? 'low' : 'high'; const u = new URL(location.href); u.searchParams.set('q', q); u.searchParams.set('at', `${player.pos.x.toFixed(1)},${player.pos.z.toFixed(1)}`); location.href = u; });
$('k-reset').addEventListener('click', () => { tour.reset(); tour.certShown = false; updateCount(); openBook(); });
$('d-share').addEventListener('click', async () => {
  const text = T('shareText').replace('{n}', tour.visited.size);
  try { if (navigator.share) await navigator.share({ title: 'Hà Nội Dạo Phố', text, url: location.origin + location.pathname }); else { await navigator.clipboard.writeText(`${text} ${location.origin + location.pathname}`); toast(T('copied')); } } catch { /* người dùng huỷ */ }
});
$('play').addEventListener('click', () => {
  started = true; $('start').classList.add('hidden'); $('hud').classList.remove('hidden'); sound0.start(); canvas.focus();
  toast(T('hint'), 6);
});
function toggleLang() { setLang(lang() === 'vi' ? 'en' : 'vi'); try { localStorage.setItem('hn-lang', lang()); } catch { /* */ } $('b-lang').textContent = lang().toUpperCase(); $('lang').textContent = lang() === 'vi' ? 'English' : 'Tiếng Việt'; updateCount(); if (!$('book').classList.contains('hidden')) openBook(); }

function openBook() {
  const L = lang();
  $('booklist').innerHTML = '';
  for (const it of tour.items) {
    const d = document.createElement('div'); d.className = 'entry' + (tour.visited.has(it.id) ? ' ok' : '');
    d.innerHTML = `<span>${it.icon}</span> <b></b><span class="muted small"></span>`;
    d.querySelector('b').textContent = it.name[L] || it.name.vi;
    d.querySelector('.small').textContent = (tour.visited.has(it.id) ? '✓ ' : '') + tour.kindLabel(it, L);
    $('booklist').appendChild(d);
  }
  openModal('book');
}

function openMap() {
  const c = $('bigmap'), src = city.mapCanvas, B = city.bounds;
  c.width = src.width / 2; c.height = src.height / 2;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0, c.width, c.height);
  for (const it of tour.items) {
    const x = (it.at.x - B.x0) / 2, y = (it.at.y - B.z0) / 2;
    g.font = '22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = tour.visited.has(it.id) ? 'rgba(255,255,255,0.7)' : '#fff'; g.beginPath(); g.arc(x, y, 15, 0, 7); g.fill();
    g.strokeStyle = it.kind === 'food' ? '#e4572e' : '#1565c0'; g.lineWidth = 3; g.stroke();
    g.fillText(it.icon, x, y + 1);
  }
  const px = (player.pos.x - B.x0) / 2, py = (player.pos.z - B.z0) / 2;
  g.fillStyle = '#b3121f'; g.beginPath(); g.arc(px, py, 9, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
  c.onclick = (e) => {
    const r = c.getBoundingClientRect();
    const wx = ((e.clientX - r.left) / r.width) * c.width * 2 + B.x0, wz = ((e.clientY - r.top) / r.height) * c.height * 2 + B.z0;
    let best = null, bd = 60;
    for (const it of tour.items) { const d = Math.hypot(it.at.x - wx, it.at.y - wz); if (d < bd) { bd = d; best = it; } }
    let target = best ? best.at.clone() : new THREE.Vector2(wx, wz);
    if (best) { const off = new THREE.Vector2(player.pos.x - target.x, player.pos.z - target.y).normalize().multiplyScalar(best.radius + 6); target = city.nearestFree(target.clone().add(off)); }
    else target = city.nearestFree(target);
    player.teleport(target.x, target.y); dog.place(target.x, target.y);
    trees.update(player.pos.x, player.pos.z);
    closeModals();
    toast(`🛵 ${T('xeom')} ${best ? best.name[lang()] : ''}`);
  };
  openModal('map');
}

const mm = $('minimap').getContext('2d');
function drawMinimap() {
  const S = 200, B = city.bounds, scale = 1.2; // px mỗi m
  mm.save();
  mm.clearRect(0, 0, S, S);
  mm.beginPath(); mm.arc(S / 2, S / 2, S / 2, 0, 7); mm.clip();
  mm.translate(S / 2, S / 2); mm.rotate(cam.yaw - Math.PI); mm.scale(scale, scale);
  mm.drawImage(city.mapCanvas, B.x0 - player.pos.x, B.z0 - player.pos.z);
  for (const it of tour.items) {
    const dx = it.at.x - player.pos.x, dz = it.at.y - player.pos.z;
    if (Math.abs(dx) > 120 || Math.abs(dz) > 120) continue;
    mm.fillStyle = tour.visited.has(it.id) ? '#9e9e9e' : it.kind === 'food' ? '#e4572e' : '#1565c0';
    mm.beginPath(); mm.arc(dx, dz, 5, 0, 7); mm.fill();
  }
  mm.restore();
  mm.save(); mm.translate(S / 2, S / 2);
  mm.fillStyle = '#b3121f'; mm.strokeStyle = '#fff'; mm.lineWidth = 2;
  mm.rotate(-(player.yaw - cam.yaw) + Math.PI);
  mm.beginPath(); mm.moveTo(0, -9); mm.lineTo(6, 7); mm.lineTo(0, 3); mm.lineTo(-6, 7); mm.closePath(); mm.fill(); mm.stroke();
  mm.restore();
  mm.fillStyle = '#b3121f'; mm.font = 'bold 13px sans-serif'; mm.textAlign = 'center';
  // chữ N: hướng -z của thế giới sau khi xoay bản đồ
  const a = cam.yaw - Math.PI;
  mm.fillText('N', S / 2 + Math.sin(a) * 86, S / 2 - Math.cos(a) * 86 + 4);
}

function updateObjective() {
  const n = tour.nearest(player.pos);
  if (!n) { $('objname').textContent = T('allDone'); $('objdist').textContent = ''; return; }
  $('objname').textContent = `${n.it.icon} ${n.it.name[lang()] || n.it.name.vi}`;
  $('objdist').textContent = n.d > 1000 ? `${(n.d / 1000).toFixed(1)} km` : `${Math.round(n.d)} m`;
  const ang = Math.atan2(n.it.at.x - player.pos.x, n.it.at.y - player.pos.z);
  const rel = -(ang - cam.yaw - Math.PI) - Math.PI / 2;
  $('arrow').style.transform = `rotate(${rel}rad)`;
}

// ---------- vòng lặp ----------
const clock = new THREE.Clock();
let acc = 0, tGlobal = 0;
function updateLamps() {
  if (!TIMES[timeIdx].night) return;
  const p = player.pos;
  const near = glows.map((g) => [g, (g.at.x - p.x) ** 2 + (g.at.z - p.z) ** 2]).sort((a, b) => a[1] - b[1]).slice(0, lamps.length);
  lamps.forEach((l, i) => { const g = near[i]?.[0]; if (!g) { l.intensity = 0; return; } l.position.copy(g.at); l.color.set(g.color); l.distance = g.range; l.intensity = g.power * 25; });
}
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  tGlobal += dt; acc += dt;
  if (started && !modalOpen) player.update(dt, input());
  else player.update(dt, { x: 0, y: 0, run: false, camYaw: cam.yaw });
  traffic.update(dt, player);
  crowd.update(dt, player, camera);
  dog.update(dt, player, city);
  if (started && !modalOpen && !params.has('shot')) tour.update(dt, tGlobal, player.pos); else tour.update(0, tGlobal, { x: 1e9, z: 1e9 });
  city.waterMat.normalMap.offset.set(tGlobal * 0.004, tGlobal * 0.006);
  updateCamera(dt);
  // ánh nắng và bóng đổ đi theo người chơi
  sun.target.position.set(player.pos.x, 0, player.pos.z);
  sun.position.copy(sun.target.position).addScaledVector(sunDir, 250);
  if (acc > 0.25) {
    acc = 0;
    trees.update(player.pos.x, player.pos.z);
    updateLamps();
    updateObjective();
    sound0.setTraffic(traffic.honk, player.mode === 'bike' ? player.speed : 0);
  }
  if (started) drawMinimap();
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.add('hidden'); }
  if (quality === 'high' || TIMES[timeIdx].night) composer.render(); else renderer.render(scene, camera);
}

boot().catch((e) => { console.error(e); $('loadtext').textContent = `${T('error')} ${e.message}`; });
