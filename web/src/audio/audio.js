// Âm thanh của game, tổng hợp hoàn toàn bằng Web Audio: không tải tệp âm thanh nào (xem CREDITS.md).
//   - Xe máy: tiếng máy một xi-lanh bốn thì theo vòng tua thật (hộp số 4 cấp, sang số thì tiếng tụt xuống), tiếng gió và lốp
//     theo tốc độ, tiếng phanh rít khi phanh gấp, còi.
//   - Người: bước chân, tiếng đóng dấu, tiếng tiền.
//   - Phố: nền xe cộ theo mật độ xe quanh mình, còi xa, chuông hàng rong, chim sẻ và ve ban ngày, dế ban đêm.
//   - Nhạc nền tự sáng tác: thang ngũ cung, ba âm sắc gợi đàn bầu (luyến, rung), đàn tranh (gảy, láy), sáo trúc (hơi thổi);
//     ban ngày điệu Bắc tươi sáng, ban đêm điệu Nam trầm và chậm hơn. Giai điệu sinh ngẫu nhiên theo câu nhạc bốn nhịp
//     nên không lặp lại, không dùng giai điệu của bài hát nào.
// Hai công tắc độc lập trong Cài đặt, cả hai được lưu trong localStorage:
//   "Hiệu ứng âm thanh" (enabled): tiếng xe, bước chân, còi, nền phố. Mọi nguồn loại này đều đi qua nút âm lượng this.sfx.
//   "Nhạc nền" (music): ba nhạc cụ và tiếng vang đều đi qua nút âm lượng this.musicGain.
// Tắt công tắc nào thì nút âm lượng của nhánh đó về 0, nên không tiếng nào của nhánh đó ra loa. Nút tổng this.master luôn để 1 vì
// nó chung cho cả hai nhánh (tắt hiệu ứng thì nhạc vẫn phải nghe được); nó chỉ là điểm gom trước bộ nén, không phải công tắc.
// Khi tắt hiệu ứng, các tiếng ngắn (còi, bước chân, đóng dấu) cũng không được tạo ra nữa, khỏi tốn máy.
// Trình duyệt chỉ cho phát tiếng sau thao tác đầu tiên của người chơi: unlock() được gọi lại ở mỗi lần bấm, chạm, gõ phím
// cho tới khi AudioContext thật sự chạy.

const GEARS = [5.6, 11.2, 16.8, 24];          // tốc độ lên số của xe số 110 cc (m/s): 20, 40, 60 km/h
const DAY = [0, 2, 5, 7, 9], NIGHT = [0, 3, 5, 7, 10]; // ngũ cung điệu Bắc (đô rê fa sol la) và điệu Nam (đô mi♭ fa sol si♭)
const hz = (semi) => 261.63 * Math.pow(2, semi / 12);

export class Audio {
  constructor() {
    this.ctx = null; this.enabled = true; this.music = true;
    try { this.enabled = localStorage.getItem('hn-sound') !== '0'; this.music = localStorage.getItem('hn-music') !== '0'; } catch { /* */ }
    this.gear = 0; this.rpm = 1400; this.birdT = 2; this.hornT = 5; this.bellT = 20; this.cicada = 0; this.side = 1;
    this.mus = { next: 0, bar: 0, deg: 2, night: false, phrase: null };
    const unlock = () => this.unlock();
    for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, unlock, { passive: true, capture: true });
  }
  get running() { return !!this.ctx && this.ctx.state === 'running'; }
  unlock() { if (!this.ctx) this.start(); else if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }

  start() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    // đường ra: hai nhánh (hiệu ứng, nhạc) → nén chống vỡ tiếng → loa; kèm bộ đo mức để kiểm thử tự động
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master = c.createGain(); this.master.gain.value = 1; this.master.connect(comp); comp.connect(c.destination);
    this.meter = c.createAnalyser(); this.meter.fftSize = 2048; comp.connect(this.meter); this._buf = new Float32Array(2048);
    this.sfx = c.createGain(); this.sfx.gain.value = this.enabled ? 1 : 0; this.sfx.connect(this.master);
    this.musicGain = c.createGain(); this.musicGain.gain.value = this.music ? 0.6 : 0; this.musicGain.connect(this.master);
    // vang nhẹ cho nhạc: đáp ứng xung là tạp âm tắt dần 2,2 giây
    const ir = c.createBuffer(2, c.sampleRate * 2.2, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.6); }
    this.reverb = c.createConvolver(); this.reverb.buffer = ir; const wet = c.createGain(); wet.gain.value = 0.32; this.reverb.connect(wet).connect(this.musicGain);
    // tạp âm dùng chung
    const len = c.sampleRate * 2, bb = c.createBuffer(1, len, c.sampleRate), bd = bb.getChannelData(0); let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; bd[i] = b * 3.5; }
    this.brown = bb;
    const wb = c.createBuffer(1, len, c.sampleRate), wd = wb.getChannelData(0); for (let i = 0; i < len; i++) wd[i] = Math.random() * 2 - 1; this.white = wb;
    const loop = (buf, type, f, q) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(this.sfx); s.start(); return { g, fl }; };
    this.bed = loop(bb, 'bandpass', 420, 0.5);       // nền xe cộ
    this.wind = loop(wb, 'bandpass', 900, 0.6);      // gió và lốp theo tốc độ
    this.squeal = loop(wb, 'bandpass', 2600, 14);    // phanh rít
    this.intake = loop(wb, 'bandpass', 1700, 1.2);   // tiếng hút gió của máy khi vặn ga
    this.crick = loop(wb, 'bandpass', 4600, 18);     // dế
    this.cic = loop(wb, 'bandpass', 5600, 9);        // ve
    // dế và ve kêu theo nhịp: nhân biên độ với sóng vuông chậm
    const pulse = (target, f, depth) => { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f; const g = c.createGain(); g.gain.value = depth; o.connect(g).connect(target); o.start(); };
    const cg = c.createGain(); cg.gain.value = 0.5; this.crick.g.disconnect(); this.crick.g.connect(cg).connect(this.sfx); pulse(cg.gain, 5.5, 0.5);
    const vg = c.createGain(); vg.gain.value = 0.6; this.cic.g.disconnect(); this.cic.g.connect(vg).connect(this.sfx); pulse(vg.gain, 38, 0.4);
    // máy xe: răng cưa ở tần số quay trục khuỷu + vuông ở tần số nổ (một xi-lanh bốn thì nổ một lần mỗi hai vòng),
    // bóp méo nhẹ cho gắt, lọc cộng hưởng ống xả, biên độ phập phồng theo từng tiếng nổ
    const o1 = c.createOscillator(); o1.type = 'sawtooth'; const o2 = c.createOscillator(); o2.type = 'square'; const o3 = c.createOscillator(); o3.type = 'sawtooth';
    const sh = c.createWaveShaper(), curve = new Float32Array(257); for (let i = 0; i < 257; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.6); } sh.curve = curve;
    const pre = c.createGain(); pre.gain.value = 0.5; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 70;
    const am = c.createGain(); am.gain.value = 1; const lfo = c.createOscillator(); lfo.type = 'sawtooth'; const lg = c.createGain(); lg.gain.value = 0.4; lfo.connect(lg).connect(am.gain);
    this.engGain = c.createGain(); this.engGain.gain.value = 0;
    const g3 = c.createGain(); g3.gain.value = 0.35;
    o1.connect(pre); o2.connect(pre); o3.connect(g3).connect(pre); pre.connect(sh).connect(bp).connect(hp).connect(am).connect(this.engGain).connect(this.sfx);
    o1.start(); o2.start(); o3.start(); lfo.start();
    this.eng = { o1, o2, o3, bp, lfo, lg };
    this.mus.next = c.currentTime + 1.5;
  }
  setEnabled(v) { this.enabled = !!v; try { localStorage.setItem('hn-sound', v ? '1' : '0'); } catch { /* */ } if (this.sfx) this.sfx.gain.setTargetAtTime(v ? 1 : 0, this.ctx.currentTime, 0.03); }
  setMusic(v) { this.music = !!v; try { localStorage.setItem('hn-music', v ? '1' : '0'); } catch { /* */ } if (this.musicGain) this.musicGain.gain.setTargetAtTime(v ? 0.6 : 0, this.ctx.currentTime, 0.05); }
  // Mức tín hiệu ra loa (RMS, 0..1) trong khoảng 40 ms vừa qua: dùng cho kiểm thử tự động.
  level() { if (!this.meter) return 0; this.meter.getFloatTimeDomainData(this._buf); let s = 0; for (let i = 0; i < this._buf.length; i++) s += this._buf[i] * this._buf[i]; return Math.sqrt(s / this._buf.length); }

  // ----- viên gạch cơ bản -----
  env(g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  tone(freq, dur, type = 'sine', vol = 0.2, pan = 0, slide = 0, dest = this.sfx, at = 0) {
    const c = this.ctx; if (!c || (!this.enabled && dest === this.sfx)) return; const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    this.env(g, t, 0.008, dur, vol); let out = g; if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
    o.connect(g); out.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, freq, q, vol, type = 'bandpass', at = 0, pan = 0) {
    const c = this.ctx; if (!c || !this.enabled) return; const t = c.currentTime + at, s = c.createBufferSource(); s.buffer = this.white; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); this.env(g, t, 0.004, dur, vol);
    let out = g; if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    s.connect(f).connect(g); out.connect(this.sfx); s.start(t, Math.random() * 0.5, dur + 0.1);
  }

  // ----- hiệu ứng -----
  horn(pan = 0, vol = 0.22, car = false) { const f = car ? 330 : 470 + Math.random() * 60, n = Math.random() < 0.5 ? 2 : 1; for (let i = 0; i < n; i++) { this.tone(f, 0.17, 'square', vol * 0.5, pan, 0, this.sfx, i * 0.21); this.tone(f * 1.26, 0.17, 'square', vol * 0.4, pan, 0, this.sfx, i * 0.21); } }
  stamp() { this.tone(170, 0.24, 'sine', 0.7, 0, -110); this.noise(0.07, 900, 0.8, 0.45, 'lowpass'); this.tone(880, 0.5, 'sine', 0.2, 0, 0, this.sfx, 0.11); this.tone(1320, 0.7, 'sine', 0.12, 0, 0, this.sfx, 0.11); if (navigator.vibrate) navigator.vibrate(40); }
  coin() { this.tone(1245, 0.09, 'square', 0.1); this.tone(1661, 0.28, 'square', 0.1, 0, 0, this.sfx, 0.085); this.tone(2490, 0.3, 'sine', 0.05, 0, 0, this.sfx, 0.085); }
  click() { this.tone(620, 0.05, 'triangle', 0.16); }
  thud(v = 0.4) { this.tone(95, 0.2, 'sine', v, 0, -50); this.noise(0.09, 320, 0.7, v * 0.7, 'lowpass'); this.noise(0.05, 2200, 1.5, v * 0.25); }
  footstep(run) { this.side = -this.side; this.tone(run ? 125 : 105, 0.07, 'sine', run ? 0.16 : 0.1, this.side * 0.15, -40); this.noise(0.045, run ? 1700 : 1250, 1.1, run ? 0.1 : 0.065, 'bandpass', 0, this.side * 0.15); }
  bell() { for (const [f, v] of [[196, 0.26], [392, 0.12], [587, 0.07], [789, 0.05]]) this.tone(f, 3.2, 'sine', v); }
  shutter() { this.noise(0.03, 3000, 1, 0.35); this.noise(0.05, 2000, 1, 0.3, 'bandpass', 0.07); }
  vendorBell(pan) { for (let i = 0; i < 3; i++) { this.tone(2093, 0.35, 'sine', 0.035, pan, 0, this.sfx, i * 0.22); this.tone(3136, 0.25, 'sine', 0.02, pan, 0, this.sfx, i * 0.22); } } // chuông leng keng của xe hàng rong

  // ----- nhạc cụ -----
  // đàn tranh: gảy, tiếng sáng, tắt nhanh; nhấn dây làm cao độ rướn nhẹ lên rồi về
  tranh(f, t, vol = 0.1, pan = 0.25) {
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(), p = c.createStereoPanner ? c.createStereoPanner() : null;
    o.type = 'triangle'; o2.type = 'sine'; o.frequency.setValueAtTime(f * 1.015, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07); o2.frequency.value = f * 2.003;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 1.1);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
    const g2 = c.createGain(); g2.gain.value = 0.35; o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g);
    if (p) { p.pan.value = pan; g.connect(p); p.connect(this.musicGain); p.connect(this.reverb); } else { g.connect(this.musicGain); g.connect(this.reverb); }
    o.start(t); o2.start(t); o.stop(t + 2); o2.stop(t + 2);
  }
  // đàn bầu: một dây, luyến từ nốt trước sang nốt này (from), ngân dài, rung sâu dần
  bau(f, t, dur, from = f, vol = 0.085) {
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), vib = c.createOscillator(), vg = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : null;
    o.type = 'sine'; o2.type = 'triangle'; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(f, t + Math.min(0.28, dur * 0.4)); o2.frequency.setValueAtTime(from * 2, t); o2.frequency.exponentialRampToValueAtTime(f * 2, t + Math.min(0.28, dur * 0.4));
    vib.frequency.value = 5.4; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.7); vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.setValueAtTime(vol, t + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
    const g2 = c.createGain(); g2.gain.value = 0.16; o.connect(g); o2.connect(g2).connect(g);
    if (p) { p.pan.value = -0.2; g.connect(p); p.connect(this.musicGain); p.connect(this.reverb); } else { g.connect(this.musicGain); g.connect(this.reverb); }
    o.start(t); o2.start(t); vib.start(t); const end = t + dur + 0.6; o.stop(end); o2.stop(end); vib.stop(end);
  }
  // sáo trúc: tiếng tròn có hơi thổi, vào tiếng mềm
  sao(f, t, dur, vol = 0.05) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), n = c.createBufferSource(), nf = c.createBiquadFilter(), ng = c.createGain(), vib = c.createOscillator(), vg = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * 0.985, t); o.frequency.linearRampToValueAtTime(f, t + 0.08); vib.frequency.value = 4.6; vg.gain.setValueAtTime(0, t + dur * 0.3); vg.gain.linearRampToValueAtTime(f * 0.006, t + dur); vib.connect(vg).connect(o.frequency);
    n.buffer = this.white; n.loop = true; nf.type = 'bandpass'; nf.frequency.value = f * 2; nf.Q.value = 3; ng.gain.value = 0.25;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.07); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
    o.connect(g); n.connect(nf).connect(ng).connect(g); g.connect(this.musicGain); g.connect(this.reverb);
    o.start(t); n.start(t, Math.random()); vib.start(t); const end = t + dur + 0.25; o.stop(end); n.stop(end); vib.stop(end);
  }

  // Soạn một câu nhạc bốn nhịp (nhịp 4/4) rồi đặt lịch phát. Hai nhịp đầu đàn bầu hát giai điệu, hai nhịp sau đàn tranh đáp
  // bằng nốt rải và láy; ban ngày thỉnh thoảng sáo trúc chen một câu. Giai điệu đi liền bậc trên thang ngũ cung, kết câu ở
  // chủ âm hoặc bậc năm. Mỗi lần gọi sinh một câu khác.
  compose(t0, night, calm) {
    const sc = night ? NIGHT : DAY, beat = (night ? 1.05 : 0.86) * (calm ? 1.12 : 1), M = this.mus, R = Math.random;
    const note = (d, oct = 0) => hz(sc[((d % 5) + 5) % 5] + 12 * (Math.floor(d / 5) + oct));
    const walk = () => { M.deg += R() < 0.72 ? (R() < 0.5 ? 1 : -1) : (R() < 0.5 ? 2 : -2); M.deg = Math.max(-2, Math.min(7, M.deg)); return M.deg; };
    // đàn bầu: 3 đến 5 nốt ngân trong hai nhịp đầu
    let t = t0, prev = note(M.deg, -1); const nb = 3 + Math.floor(R() * 3), durs = nb === 3 ? [3, 2, 3] : nb === 4 ? [2, 2, 1, 3] : [2, 1, 1, 1, 3];
    for (let i = 0; i < nb; i++) { const d = i === nb - 1 ? (R() < 0.6 ? 0 : 3) + (M.deg > 3 ? 5 : 0) : walk(); if (i === nb - 1) M.deg = d; const f = note(d, -1), L = durs[i] * beat; this.bau(f, t, L * 0.92, prev); prev = f; t += L; }
    // nhịp gõ song loan rất khẽ ở đầu nhịp 1 và 3
    for (const k of [0, 8]) { const tt = t0 + k * beat; this.tickAt(tt, 0.02); }
    // đàn tranh đáp: rải bốn nốt đi lên rồi vài nốt láy
    t = t0 + 8 * beat; const base = M.deg - 2;
    for (let i = 0; i < 4; i++) this.tranh(note(base + i, 0), t + i * 0.09, 0.07 + i * 0.012, 0.3);
    t += beat * 1.5; const nt = 4 + Math.floor(R() * 4);
    for (let i = 0; i < nt; i++) { const d = i === nt - 1 ? (R() < 0.5 ? 5 : 3) : walk() + (R() < 0.25 ? 5 : 0); this.tranh(note(d, 0), t, 0.075 + R() * 0.035, 0.2 + R() * 0.3); if (R() < 0.3) this.tranh(note(d + 1, 0), t + 0.07, 0.04, 0.3); t += beat * (R() < 0.35 ? 0.5 : 1); if (t > t0 + 15.2 * beat) break; }
    // sáo trúc: ban ngày, khoảng một phần ba số câu, thổi ba bốn nốt cao ở nhịp cuối
    if (!night && R() < 0.36) { let ts = t0 + 12 * beat; for (let i = 0; i < 3 + Math.floor(R() * 2); i++) { const L = beat * (i === 0 ? 1.5 : 0.75); this.sao(note(walk() + 5, 0), ts, L * 0.9); ts += L; } }
    // ban đêm: thêm một nốt trầm ngân dưới đáy mỗi câu
    if (night) this.bau(hz(sc[0] - 24), t0, beat * 14, hz(sc[0] - 24), 0.05);
    return t0 + 16 * beat;
  }
  tickAt(t, vol) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.value = 1150; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); o.connect(g).connect(this.musicGain); o.start(t); o.stop(t + 0.07); }

  // Mỗi khung hình. s = { riding, speed (m/s), throttle (0..1), full (mở hết ga), brake (0..1), agentsNear, night (0..1), green (0..1), calm, hours }
  update(dt, s) {
    const c = this.ctx; if (!c || c.state !== 'running') return; const t = c.currentTime;
    const v = Math.abs(s.speed), thr = Math.max(0, s.throttle || 0);
    // hộp số: lên số ở tốc độ GEARS, về số khi chậm lại (có khoảng trễ để không sang số liên tục)
    if (this.gear < 3 && v > GEARS[this.gear]) this.gear++; else if (this.gear > 0 && v < GEARS[this.gear - 1] * 0.8) this.gear--;
    const lo = this.gear ? GEARS[this.gear - 1] * 0.62 : 0, target = s.riding ? 1400 + Math.max(0, (v - lo) / (GEARS[this.gear] - lo)) * 6200 + (thr > 0 && v < 1.5 ? 900 : 0) : 1400;
    this.rpm += (target - this.rpm) * Math.min(1, dt * 9);
    const rot = this.rpm / 60, E = this.eng, load = thr * (s.full ? 1 : 0.6);
    E.o1.frequency.setTargetAtTime(rot, t, 0.03); E.o2.frequency.setTargetAtTime(rot / 2, t, 0.03); E.o3.frequency.setTargetAtTime(rot * 2.01, t, 0.03); E.lfo.frequency.setTargetAtTime(rot / 2, t, 0.03);
    E.lg.gain.setTargetAtTime(0.45 - Math.min(0.3, this.rpm / 20000), t, 0.1);
    E.bp.frequency.setTargetAtTime(260 + this.rpm * 0.085 + load * 380, t, 0.06);
    this.engGain.gain.setTargetAtTime(s.riding ? 0.11 + load * 0.16 + Math.min(0.08, this.rpm / 90000) : 0, t, 0.08);
    this.intake.g.gain.setTargetAtTime(s.riding ? load * (0.012 + this.rpm / 260000) : 0, t, 0.08);
    this.wind.g.gain.setTargetAtTime(Math.min(0.11, v * v * 0.00028), t, 0.2); this.wind.fl.frequency.setTargetAtTime(600 + v * 45, t, 0.2);
    this.squeal.g.gain.setTargetAtTime(s.riding && (s.brake || 0) > 0.8 && v > 4 ? Math.min(0.05, v * 0.004) : 0, t, 0.04); this.squeal.fl.frequency.setTargetAtTime(2100 + v * 60, t, 0.1);
    // nền phố: ban ngày ồn hơn ban đêm; càng nhiều xe quanh mình càng ồn
    const night = s.night || 0, busy = Math.min(1, (s.agentsNear || 0) / 14);
    this.bed.g.gain.setTargetAtTime((0.05 + busy * 0.2) * (1 - night * 0.55), t, 0.6); this.bed.fl.frequency.setTargetAtTime(380 + busy * 260, t, 0.6);
    this.crick.g.gain.setTargetAtTime(night * (0.012 + (s.green || 0) * 0.03), t, 1);
    const noon = s.hours > 9.5 && s.hours < 16.5 ? 1 : 0; this.cicada += ((noon * (s.green || 0) > 0.3 ? 1 : 0) - this.cicada) * Math.min(1, dt * 0.3);
    this.cic.g.gain.setTargetAtTime(this.cicada * 0.012 * (1 - night), t, 1.5);
    this.birdT -= dt;
    if (this.birdT <= 0) { this.birdT = 1.5 + Math.random() * 5; if (night < 0.3 && (s.green || 0) > 0.15) { const n = 2 + Math.floor(Math.random() * 4), f = 2600 + Math.random() * 1600, pan = Math.random() * 2 - 1; for (let i = 0; i < n; i++) this.tone(f + Math.random() * 300, 0.07, 'sine', 0.04 * s.green + 0.014, pan, 500 + Math.random() * 600, this.sfx, i * (0.09 + Math.random() * 0.04)); } }
    this.hornT -= dt; // còi xa vọng lại: ban ngày vài giây một tiếng, ban đêm thưa hẳn
    if (this.hornT <= 0) { this.hornT = (night > 0.5 ? 14 : 4) + Math.random() * (night > 0.5 ? 20 : 9); if (busy > 0.1 || night < 0.5) this.horn(Math.random() * 2 - 1, 0.035 + Math.random() * 0.03, Math.random() < 0.25); }
    this.bellT -= dt; // chuông hàng rong: chỉ ban ngày, ở phố có người
    if (this.bellT <= 0) { this.bellT = 25 + Math.random() * 40; if (night < 0.4 && busy > 0.15) this.vendorBell(Math.random() * 2 - 1); }
    // nhạc nền: đặt lịch từng câu, sớm hơn nửa giây để không hụt nhịp khi khung hình giật. Đang tắt nhạc thì không soạn câu mới và giữ
    // nguyên mốc M.next (lúc câu đang dở kết thúc): bật lại giữa chừng thì câu mới chỉ vào sau khi câu cũ đã hết, hai câu không chồng nhau.
    const M = this.mus;
    if (this.music) { if (M.next < t) M.next = t + 0.3; if (M.next - t < 0.6) { M.night = night > 0.5; M.next = this.compose(M.next, M.night, !!s.calm) + (Math.random() < 0.3 ? 2.5 : 0.6); M.bar++; } }
  }
}
