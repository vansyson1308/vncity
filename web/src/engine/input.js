// Gom mọi cách điều khiển về một trạng thái chung: bàn phím + chuột (khoá con trỏ), cảm ứng (cần ảo + vuốt để nhìn),
// tay cầm. Mỗi khung hình game đọc move/look/run và các nút bấm một lần (pressed).
import { clamp } from '../core/util.js';

const KEYMAP = { e: 'interact', enter: 'interact', f: 'mount', ' ': 'horn', h: 'horn', m: 'map', n: 'time', b: 'book', p: 'photo', l: 'lang', escape: 'back', tab: 'book', c: 'camera', r: 'reset', v: 'camera', g: 'job' };

export class Input {
  constructor(canvas) {
    this.canvas = canvas; this.keys = new Set(); this.pressed = new Set();
    this.move = { x: 0, y: 0 }; this.look = { x: 0, y: 0 }; this.run = false; this.zoom = 0;
    this.touch = matchMedia('(pointer: coarse)').matches; this.locked = false; this.enabled = false; this.lastLook = 0;
    this.stick = { id: null, cx: 0, cy: 0, x: 0, y: 0 }; this.lookTouch = null; this.runToggle = false; this.dragging = false;
    this.onFirstGesture = null;

    addEventListener('keydown', (e) => {
      if (e.repeat) return; const k = e.key.toLowerCase(); this.keys.add(k);
      if (!this.enabled && !['escape', 'enter', 'e', ' ', 'm', 'b', 'tab'].includes(k)) return; // đang mở hộp thoại: chỉ nhận phím đóng
      if (KEYMAP[k]) { this.pressed.add(KEYMAP[k]); if (k === 'tab' || k === ' ') e.preventDefault(); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
    // chuột: bấm vào khung hình để khoá con trỏ (nhìn tự do như game góc ba); không khoá được thì kéo để nhìn
    canvas.addEventListener('pointerdown', (e) => {
      this.gesture();
      if (e.pointerType === 'touch') return;
      if (this.enabled && !this.locked && canvas.requestPointerLock) { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); }
      this.dragging = true;
    });
    addEventListener('pointerup', () => { this.dragging = false; });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    addEventListener('mousemove', (e) => { if (this.enabled && (this.locked || this.dragging)) { this.look.x += e.movementX; this.look.y += e.movementY; this.lastLook = performance.now(); } });
    canvas.addEventListener('wheel', (e) => { this.zoom += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // cảm ứng: nửa trái là cần điều khiển nổi (chạm ở đâu, cần hiện ở đó), nửa phải vuốt để nhìn
    canvas.addEventListener('touchstart', (e) => {
      this.gesture(); this.touch = true;
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.45 && this.stick.id === null) { Object.assign(this.stick, { id: t.identifier, cx: t.clientX, cy: t.clientY, x: 0, y: 0 }); this.showStick(true); }
        else if (!this.lookTouch) this.lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stick.id) { let dx = (t.clientX - this.stick.cx) / 56, dy = (t.clientY - this.stick.cy) / 56; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } this.stick.x = dx; this.stick.y = dy; this.showStick(true); }
        else if (this.lookTouch && t.identifier === this.lookTouch.id) { this.look.x += (t.clientX - this.lookTouch.x) * 1.6; this.look.y += (t.clientY - this.lookTouch.y) * 1.6; this.lookTouch.x = t.clientX; this.lookTouch.y = t.clientY; this.lastLook = performance.now(); }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => { for (const t of e.changedTouches) { if (t.identifier === this.stick.id) { this.stick.id = null; this.stick.x = this.stick.y = 0; this.showStick(false); } if (this.lookTouch && t.identifier === this.lookTouch.id) this.lookTouch = null; } };
    canvas.addEventListener('touchend', end); canvas.addEventListener('touchcancel', end);
    this.stickEl = document.getElementById('stick'); this.knobEl = document.getElementById('knob');
  }
  gesture() { if (this.onFirstGesture) { const f = this.onFirstGesture; this.onFirstGesture = null; f(); } }
  showStick(on) {
    if (!this.stickEl) return;
    this.stickEl.style.display = on ? 'block' : 'none';
    if (on) { this.stickEl.style.left = `${this.stick.cx - 60}px`; this.stickEl.style.top = `${this.stick.cy - 60}px`; this.knobEl.style.transform = `translate(${this.stick.x * 40}px, ${this.stick.y * 40}px)`; }
  }
  press(name) { this.pressed.add(name); }
  take(name) { if (this.pressed.has(name)) { this.pressed.delete(name); return true; } return false; }

  // gọi đầu mỗi khung hình
  poll() {
    const k = this.keys; let x = 0, y = 0;
    if (k.has('w') || k.has('arrowup')) y += 1; if (k.has('s') || k.has('arrowdown')) y -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1; if (k.has('a') || k.has('arrowleft')) x -= 1;
    x += this.stick.x; y -= this.stick.y;
    let run = k.has('shift') || this.runToggle, brake = k.has(' ');
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const dz = (v) => (Math.abs(v) < 0.16 ? 0 : v);
      x += dz(p.axes[0]); y -= dz(p.axes[1]);
      const lx = dz(p.axes[2]), ly = dz(p.axes[3]); if (lx || ly) { this.look.x += lx * 14; this.look.y += ly * 10; this.lastLook = performance.now(); }
      const B = p.buttons, was = this._pad || (this._pad = []);
      const edge = (i, name) => { const d = B[i] && B[i].pressed; if (d && !was[i]) this.pressed.add(name); was[i] = d; };
      edge(0, 'interact'); edge(3, 'mount'); edge(2, 'horn'); edge(8, 'map'); edge(9, 'back'); edge(1, 'back');
      if (B[7] && B[7].value > 0.1) y = Math.max(y, B[7].value); if (B[6] && B[6].value > 0.1) y = Math.min(y, -B[6].value);
      run = run || (B[10] && B[10].pressed) || (B[5] && B[5].pressed);
      break;
    }
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    this.move.x = this.enabled ? clamp(x, -1, 1) : 0; this.move.y = this.enabled ? clamp(y, -1, 1) : 0; this.run = run; this.brake = brake;
  }
  // gọi cuối khung hình
  endFrame() { this.look.x = 0; this.look.y = 0; this.zoom = 0; this.pressed.clear(); }
}
