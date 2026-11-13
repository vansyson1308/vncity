// Giao diện trong game (DOM): hộ chiếu, la bàn ba gợi ý, thẻ địa danh không chặn màn hình, lời chú Thắng,
// đồng hồ cuốc xe, hộp thoại bản đồ, cài đặt. Mọi thông tin phụ nằm sau một nút bấm; thế giới là chính.
import { T, lang, setLang, money, dist, count, retranslate } from './i18n.js';

const $ = (id) => document.getElementById(id);
const DIRS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
export const compassWord = (dx, dz) => T('dir_' + DIRS[((Math.round(Math.atan2(dx, -dz) / (Math.PI / 4)) % 8) + 8) % 8]);
// Chữ "sống": lời nhắn (và tên người nói) có thể là một chuỗi hoặc một hàm trả về chuỗi theo ngôn ngữ đang chọn. Hàm được gọi lại
// khi người chơi đổi ngôn ngữ, nên lời nhắn ghép từ nhiều phần (tên khách, tên điểm đến, số tiền) cũng đổi theo ngay. Chuỗi thường
// thì được tra ngược trong bảng chữ (retranslate).
const say = (v) => (typeof v === 'function' ? v() : v) ?? '';
const GUIDE = () => T('guide');
const replay = (el) => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }; // chạy lại hoạt hình CSS của một khối
// Tên gọn cho ô la bàn và bảng cuốc xe: bỏ phần chú thích trong ngoặc ở cuối ("Hồ Hoàn Kiếm (Hồ Gươm)" → "Hồ Hoàn Kiếm").
// Tên đầy đủ vẫn có trên thẻ địa danh, lời nhắn đón khách và trong hộ chiếu.
export const shortName = (s) => s.replace(/\s*\([^)]*\)\s*$/, '') || s;

export class Hud {
  constructor(input) {
    this.input = input; this.modal = null; this.toastT = 0; this.cardT = 0; this.cardItem = null; this.queue = []; this.onClose = null; this.touch = input.touch;
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.close()));
    document.querySelectorAll('.modal').forEach((m) => m.addEventListener('pointerdown', (e) => { if (e.target === m) this.close(); }));
    $('c-close').addEventListener('click', () => this.hideCard());
    $('card').addEventListener('click', (e) => { if (e.target.id !== 'c-close') { $('card').classList.toggle('open'); this.fitCard(); } this.cardT = 30; });
    if (this.touch) this.setTouch();
    const tb = (id, name) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); input.press(name); });
    tb('t-horn', 'horn'); tb('t-use', 'interact'); tb('t-bike', 'mount');
    $('t-run').addEventListener('pointerdown', () => { input.runToggle = !input.runToggle; $('t-run').classList.toggle('on', input.runToggle); });
    tb('b-map', 'map'); tb('b-photo', 'photo'); tb('b-time', 'time'); tb('b-book', 'book'); $('b-set').addEventListener('click', () => input.press('settings'));
    tb('ph-shoot', 'photo'); tb('ph-exit', 'back'); this.drawPhotoHint(); // thanh của chế độ chụp ảnh: chụp (như phím P) và thoát (như Esc)
  }
  drawPhotoHint() { $('photo-hint').textContent = T(this.touch ? 'photoHintT' : 'photoHint'); }
  // máy cảm ứng: hiện bốn nút chạm và gợi ý chạm; gọi lúc khởi động, hoặc ngay khi ngón tay đầu tiên chạm vào khung hình (máy lai)
  setTouch() { this.touch = true; $('hud').classList.add('touch'); $('touchbtns').classList.remove('hidden'); $('keys-desktop').classList.add('hidden'); $('keys-touch').classList.remove('hidden'); this._prompt = null; if (this.cardItem) this.drawCard(); this.drawPhotoHint(); }
  show() { $('hud').classList.remove('hidden'); }
  open(id) { this.close(); $(id).classList.remove('hidden'); this.modal = id; this.input.enabled = false; if (document.pointerLockElement) document.exitPointerLock(); }
  close() { if (!this.modal) return false; $(this.modal).classList.add('hidden'); const m = this.modal; this.modal = null; this.input.enabled = true; this.onClose && this.onClose(m); return true; }

  setCounts(v, t, m) { $('count').textContent = `${v}/${t}`; $('money').textContent = money(m); }
  setClock(h, day) { const hh = Math.floor(h), mm = Math.floor((h - hh) * 60); if (day !== undefined) $('clock-day').textContent = T('day' + day); $('clock-time').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; $('clock-icon').textContent = h < 5.5 || h >= 19 ? '🌙' : h < 8 ? '🌅' : h < 16.5 ? '☀️' : '🌇'; }
  setStreet(name) { if (name !== this._street) { this._street = name; $('street').textContent = name || ''; } }
  setSpeed(kmh) { $('speedo').classList.toggle('hidden', kmh === null); if (kmh !== null) $('kmh').textContent = Math.round(kmh); }

  // la bàn: tối đa ba gợi ý, mũi tên chỉ hướng so với hướng nhìn
  setCompass(sugs, px, pz, camYaw) {
    const el = $('compass'), L = lang();
    while (el.children.length < sugs.length) { const d = document.createElement('div'); d.className = 'pick'; d.innerHTML = '<span class="ic"></span><span class="nm"></span><b></b><span class="arr">➤</span>'; el.appendChild(d); }
    for (let i = 0; i < el.children.length; i++) {
      const c = el.children[i], sg = sugs[i]; c.style.display = sg ? '' : 'none'; if (!sg) continue;
      c.classList.toggle('first', i === 0);
      const ic = c.children[0], nm = c.children[1]; if (ic.textContent !== sg.icon) ic.textContent = sg.icon; const name = shortName(sg.name[L] || sg.name.vi); if (nm.textContent !== name) nm.textContent = name;
      c.children[2].textContent = dist(sg.d);
      // góc so với hướng nhìn: 0 là thẳng phía trước
      const a = Math.atan2(sg.x - px, sg.z - pz) - (camYaw + Math.PI);
      c.children[3].style.transform = `rotate(${-a - Math.PI / 2}rad)`;
    }
  }

  showCard(it, next) {
    this.cardItem = it; this.cardNext = next || null; this.drawCard();
    const c = $('card'); c.classList.remove('open', 'hidden'); c.firstElementChild.scrollTop = 0; replay(c.firstElementChild); replay($('stampmark'));
    this.cardT = 9; this.fitCard();
  }
  // lời mời "đọc thêm" chỉ hiện khi lời giới thiệu đang bị thu gọn (còn dòng chưa hiện)
  fitCard() { const d = $('c-desc'); $('c-hint').classList.toggle('hidden', $('card').classList.contains('open') || d.scrollHeight <= d.clientHeight + 1); }
  // chữ trên thẻ theo ngôn ngữ đang chọn (gọi lại khi đổi ngôn ngữ); dòng nào trống thì ẩn hẳn
  drawCard() {
    const it = this.cardItem, next = this.cardNext, L = lang(), put = (id, text) => { const e = $(id); e.textContent = text; e.classList.toggle('hidden', !text); };
    // dòng loại · trang: hai cụm không tự ngắt giữa chừng, nên chỗ chật thì xuống dòng sau dấu ·, không tách đôi tên "Hồ / Gươm"
    const kind = $('c-kind'), k1 = document.createElement('span'), k2 = document.createElement('span'); k1.textContent = `${it.icon} ${T('kind_' + it.kind)} ·`; k2.textContent = T('page_' + it.page); kind.replaceChildren(k1, ' ', k2);
    $('c-name').textContent = it.name[L] || it.name.vi; put('c-desc', it.desc?.[L] || it.desc?.vi || '');
    put('c-extra', [it.year ? `${T('built')} ${it.year}` : '', it.street || ''].filter(Boolean).join(' · '));
    put('c-next', next ? `${T('nearby')} ${next.it.icon} ${next.it.name[L] || next.it.name.vi}, ${dist(next.d)} ${T('toward')} ${compassWord(next.it.x - it.x, next.it.z - it.z)}` : '');
    $('stampmark').textContent = T('stamped'); $('c-hint').textContent = this.touch ? T('readTouch') : T('read');
  }
  toggleCard() { if (this.cardItem && !$('card').classList.contains('hidden')) { $('card').classList.toggle('open'); this.fitCard(); this.cardT = 30; return true; } return false; }
  hideCard() { $('card').classList.add('hidden'); this.cardT = 0; }

  // lời nhắn ngắn, không chặn màn hình; who: tên người nói (mặc định chú Thắng). text và who nhận chuỗi hoặc hàm trả về chuỗi (chữ "sống").
  // now: thông báo thay ngay cho cái đang hiện và xoá hàng chờ (đổi buổi trong ngày: chỉ thông báo mới nhất còn đúng)
  // tag: loại thông báo; thông báo mới cùng loại thay ngay cho cái cũ đang hiện và bỏ cái cũ còn trong hàng chờ (đi nhanh hai lần liền
  // từng hiện "Xe ôm chở tới" tên điểm trước: QC vòng 3)
  toast(text, secs = 5, who = GUIDE, face = '🧓', now = false, tag = null) {
    const shown = say(text);
    if (tag) this.queue = this.queue.filter((q) => q[5] !== tag);
    if (now) this.queue.length = 0;
    else if (this.toastT > 0.4 && this._toastText !== shown && !(tag && this._toastTag === tag)) { if (this.queue.length < 3) this.queue.push([text, secs, who, face, false, tag]); return; }
    this._toastTag = tag; this._toastSrc = [text, who]; this._toastText = shown; this._toastWho = say(who); $('toast-face').textContent = face; this.drawToast();
    const t = $('toast'); t.classList.remove('hidden'); replay(t.firstElementChild); this.toastT = secs;
  }
  drawToast() { $('toast-who').textContent = this._toastWho ? this._toastWho + ':' : ''; $('toast-text').textContent = this._toastText; }
  bubble(text) { const b = $('bubble'); b.textContent = text; b.classList.remove('hidden'); replay(b); clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.add('hidden'), 900); }
  prompt(key, text) {
    const p = $('prompt'); if (!text) { if (this._promptOn) { p.classList.add('hidden'); this._promptOn = false; this._prompt = null; } return; }
    if (this._prompt === text) return; this._prompt = text; this._promptOn = true;
    p.innerHTML = ''; if (!this.touch) { const b = document.createElement('b'); b.textContent = key; p.appendChild(b); } p.appendChild(document.createTextNode(text)); p.classList.remove('hidden');
  }
  fare(f, name) {
    const el = $('fare'); if (!f || f.state !== 'ride') { el.classList.add('hidden'); return; }
    el.classList.remove('hidden'); const L = lang();
    $('fare-face').textContent = f.cust ? f.cust.face : '🙋'; $('fare-name').textContent = name; $('fare-dest').textContent = `${T('fare_to')} ${shortName(f.dest.place.name[L] || f.dest.place.name.vi)}`;
    $('fare-dist').textContent = dist(f.left || 0); $('fare-money').textContent = money(f.fareNow()); $('fare-comfort').style.width = `${Math.round(f.comfort * 100)}%`;
  }
  // Đổi ngôn ngữ: mọi chữ đang hiển thị đổi theo ngay. Lời nhắn "sống" (hàm) được gọi lại; lời nhắn là chuỗi thường thì tra ngược trong
  // bảng chữ; thẻ địa danh vẽ lại đủ các dòng (kể cả dòng "Gần đây"); lời nhắc phím, tên phố, bảng cuốc xe, ô la bàn do vòng lặp game
  // ghi lại ở khung hình kế tiếp.
  relang(from) {
    if (this.toastT > 0 && this._toastSrc) { const [t, w] = this._toastSrc; this._toastText = typeof t === 'function' ? say(t) : retranslate(this._toastText, from); this._toastWho = typeof w === 'function' ? say(w) : retranslate(this._toastWho, from); this.drawToast(); }
    for (const q of this.queue) { if (typeof q[0] !== 'function') q[0] = retranslate(q[0], from); if (typeof q[2] !== 'function') q[2] = retranslate(q[2], from); }
    this._prompt = null; this._street = null; this.drawPhotoHint();
    if (this.cardItem && !$('card').classList.contains('hidden')) { this.drawCard(); this.fitCard(); }
    const b = $('bubble'); if (!b.classList.contains('hidden')) b.textContent = retranslate(b.textContent, from);
  }
  flash() { const f = $('flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }
  update(dt) {
    if (!this.touch && this.input.touch) this.setTouch();
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) { $('toast').classList.add('hidden'); const n = this.queue.shift(); if (n) this.toast(...n); } }
    if (this.cardT > 0) { this.cardT -= dt; if (this.cardT <= 0) this.hideCard(); }
  }

  openBook(passport) {
    const L = lang(), el = $('pages'); el.innerHTML = '';
    const r = passport.rides, rk = r >= 25 ? 3 : r >= 10 ? 2 : r >= 3 ? 1 : 0;
    $('rank').innerHTML = ''; $('rank').append(`${T('rank')}: `); const b = document.createElement('b'); b.textContent = T('rank' + rk); $('rank').append(b, ` · ${count(r, 'rides')} · ${money(passport.money)}`);
    for (const pg of passport.pages) {
      const items = passport.pageOf(pg), done = items.filter((i) => passport.visited.has(i.id)).length;
      const d = document.createElement('div'); d.className = 'page'; const h = document.createElement('h3'); h.textContent = T('page_' + pg); const sp = document.createElement('span'); sp.textContent = `${done}/${items.length}`; h.appendChild(sp); d.appendChild(h);
      const grid = document.createElement('div'); grid.className = 'stamps';
      for (const it of items) { const ok = passport.visited.has(it.id), s = document.createElement('div'); s.className = 'st' + (ok ? ' ok' : ''); const i = document.createElement('i'); i.textContent = it.icon; const sp2 = document.createElement('span'); sp2.textContent = ok ? (it.name[L] || it.name.vi) : '? ? ?'; s.append(i, sp2); grid.appendChild(s); }
      d.appendChild(grid); el.appendChild(d);
    }
    this.open('book');
  }
  openSettings(quality, audio, perf, bak = null, beacons = true) {
    const mark = (id, attr, val) => document.querySelectorAll(`#${id} button`).forEach((b) => b.classList.toggle('on', b.dataset[attr] === String(val)));
    mark('s-quality', 'q', quality); mark('s-sound', 'v', audio.enabled ? 1 : 0); mark('s-music', 'v', audio.music ? 1 : 0); mark('s-beacons', 'v', beacons ? 1 : 0); mark('s-lang', 'l', lang());
    // tiến độ cũ bị ?fresh cất đi: hiện nút khôi phục
    $('s-restore-row').classList.toggle('hidden', !bak); if (bak) $('s-restore').textContent = T('restore', { s: count(bak.stamps, 'stampn') });
    $('s-perf').textContent = perf; this.open('settings');
  }
}
export { setLang, $ };
