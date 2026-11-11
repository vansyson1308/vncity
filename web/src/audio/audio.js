// Âm thanh tổng hợp bằng WebAudio, không tải tệp nào: tiếng máy xe của Minh, nền dòng xe, còi, bước chân,
// tiếng dấu đóng, chim ven hồ ban ngày, dế ban đêm và mấy nốt đàn ngũ cung làm nhạc nền.
export class Audio {
  constructor() { this.ctx = null; this.enabled = true; this.music = true; try { this.enabled = localStorage.getItem('hn-sound') !== '0'; this.music = localStorage.getItem('hn-music') !== '0'; } catch { /* */ } this.t = 0; this.birdT = 2; this.noteT = 1; this.step = 0; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.enabled ? 0.9 : 0; this.master.connect(c.destination);
    // tạp âm dùng chung
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = b * 3.5; } // nâu
    this.brown = buf;
    const wb = c.createBuffer(1, c.sampleRate, c.sampleRate), wd = wb.getChannelData(0); for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1; this.white = wb;
    // nền dòng xe
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true; const bp = c.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 420;
    this.trafficGain = c.createGain(); this.trafficGain.gain.value = 0; src.connect(bp).connect(this.trafficGain).connect(this.master); src.start();
    // máy xe: răng cưa + vuông trầm qua lọc thông thấp, rung nhẹ theo vòng tua
    const o1 = c.createOscillator(); o1.type = 'sawtooth'; const o2 = c.createOscillator(); o2.type = 'square';
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 1.2;
    this.engGain = c.createGain(); this.engGain.gain.value = 0; const am = c.createGain(); am.gain.value = 1;
    const lfo = c.createOscillator(); lfo.frequency.value = 22; const lg = c.createGain(); lg.gain.value = 0.35; lfo.connect(lg).connect(am.gain);
    o1.connect(lp); o2.connect(lp); lp.connect(am).connect(this.engGain).connect(this.master); o1.start(); o2.start(); lfo.start();
    this.eng = { o1, o2, lp, lfo };
    // dế đêm
    const cs = c.createBufferSource(); cs.buffer = wb; cs.loop = true; const cb = c.createBiquadFilter(); cb.type = 'bandpass'; cb.frequency.value = 4600; cb.Q.value = 18;
    const cam = c.createGain(); cam.gain.value = 0; const cl = c.createOscillator(); cl.type = 'square'; cl.frequency.value = 5.5; const clg = c.createGain(); clg.gain.value = 0.5; cl.connect(clg).connect(cam.gain);
    this.cricketGain = c.createGain(); this.cricketGain.gain.value = 0; cs.connect(cb).connect(cam).connect(this.cricketGain).connect(this.master); cs.start(); cl.start();
    this.musicGain = c.createGain(); this.musicGain.gain.value = this.music ? 0.5 : 0; this.musicGain.connect(this.master);
  }
  setEnabled(v) { this.enabled = v; try { localStorage.setItem('hn-sound', v ? '1' : '0'); } catch { /* */ } if (this.master) this.master.gain.value = v ? 0.9 : 0; }
  setMusic(v) { this.music = v; try { localStorage.setItem('hn-music', v ? '1' : '0'); } catch { /* */ } if (this.musicGain) this.musicGain.gain.value = v ? 0.5 : 0; }

  env(node, t, a, d, peak) { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  tone(freq, dur, type = 'sine', vol = 0.2, pan = 0, slide = 0, dest = this.master) {
    const c = this.ctx; if (!c || !this.enabled) return; const t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    this.env(g, t, 0.008, dur, vol); let out = g; if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
    o.connect(g); out.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, freq, q, vol, type = 'bandpass') { const c = this.ctx; if (!c || !this.enabled) return; const t = c.currentTime, s = c.createBufferSource(); s.buffer = this.white; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); this.env(g, t, 0.004, dur, vol); s.connect(f).connect(g).connect(this.master); s.start(t, Math.random() * 0.5, dur + 0.1); }

  horn(pan = 0, vol = 0.22, car = false) { const f = car ? 330 : 470 + Math.random() * 60; this.tone(f, 0.16, 'square', vol * 0.5, pan); this.tone(f * 1.26, 0.16, 'square', vol * 0.4, pan); if (Math.random() < 0.5) setTimeout(() => { this.tone(f, 0.2, 'square', vol * 0.5, pan); this.tone(f * 1.26, 0.2, 'square', vol * 0.4, pan); }, 210); }
  stamp() { this.tone(170, 0.22, 'sine', 0.6, 0, -110); this.noise(0.06, 900, 0.8, 0.35, 'lowpass'); setTimeout(() => { this.tone(880, 0.5, 'sine', 0.16); this.tone(1320, 0.7, 'sine', 0.1); }, 110); if (navigator.vibrate) navigator.vibrate(40); }
  coin() { this.tone(1245, 0.09, 'square', 0.08); setTimeout(() => this.tone(1661, 0.25, 'square', 0.08), 85); }
  click() { this.tone(620, 0.05, 'triangle', 0.12); }
  thud(v = 0.4) { this.tone(90, 0.18, 'sine', v, 0, -50); this.noise(0.08, 300, 0.7, v * 0.6, 'lowpass'); }
  footstep(run) { this.noise(0.05, run ? 1400 : 1000, 1.2, run ? 0.07 : 0.045); }
  bell() { for (const [f, v] of [[196, 0.22], [392, 0.1], [587, 0.06], [789, 0.04]]) this.tone(f, 3.2, 'sine', v); }
  shutter() { this.noise(0.03, 3000, 1, 0.3); setTimeout(() => this.noise(0.05, 2000, 1, 0.25), 70); }
  pluck(freq, vol = 0.12) { const c = this.ctx; if (!c || !this.music) return; const t = c.currentTime, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = freq; o2.frequency.value = freq * 2.01; f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.9); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6); o.frequency.setValueAtTime(freq * 1.012, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.08); o.connect(f); o2.connect(f); f.connect(g).connect(this.musicGain); o.start(t); o2.start(t); o.stop(t + 1.7); o2.stop(t + 1.7); }

  // Mỗi khung hình: s = { riding, speed, throttle, agentsNear, night, green (0..1 gần cây/hồ), calm }
  update(dt, s) {
    const c = this.ctx; if (!c) return; const t = c.currentTime;
    const sp = Math.abs(s.speed), rpm = s.riding ? 62 + sp * 9.5 + (s.throttle > 0 ? 14 : 0) : 60;
    this.eng.o1.frequency.setTargetAtTime(rpm, t, 0.08); this.eng.o2.frequency.setTargetAtTime(rpm * 0.5, t, 0.08); this.eng.lfo.frequency.setTargetAtTime(rpm / 3, t, 0.1);
    this.eng.lp.frequency.setTargetAtTime(380 + sp * 60 + (s.throttle > 0 ? 300 : 0), t, 0.1);
    this.engGain.gain.setTargetAtTime(s.riding ? 0.05 + Math.min(0.08, sp * 0.006) + (s.throttle > 0 ? 0.025 : 0) : 0, t, 0.15);
    this.trafficGain.gain.setTargetAtTime(Math.min(0.5, 0.05 + s.agentsNear * 0.022), t, 0.6);
    this.cricketGain.gain.setTargetAtTime(s.night * (0.012 + s.green * 0.03), t, 1);
    // chim hót ban ngày ở chỗ có cây
    this.birdT -= dt;
    if (this.birdT <= 0) { this.birdT = 1.5 + Math.random() * 5; if (s.night < 0.3 && s.green > 0.15 && this.enabled) { const n = 2 + Math.floor(Math.random() * 4), f = 2600 + Math.random() * 1600, pan = Math.random() * 2 - 1; for (let i = 0; i < n; i++) setTimeout(() => this.tone(f + Math.random() * 300, 0.07, 'sine', 0.035 * s.green + 0.012, pan, 500 + Math.random() * 600), i * (90 + Math.random() * 40)); } }
    // nhạc nền: ngũ cung Bắc (đô rê fa sol la), thưa và chậm; gần hồ thì chậm hơn nữa
    this.noteT -= dt;
    if (this.noteT <= 0 && this.music) {
      const scale = [261.6, 293.7, 349.2, 392.0, 440.0, 523.3, 587.3, 698.5], calm = s.calm;
      this.step += Math.random() < 0.6 ? (Math.random() < 0.5 ? 1 : -1) : Math.floor(Math.random() * 5) - 2; this.step = Math.max(0, Math.min(scale.length - 1, this.step));
      if (Math.random() < 0.82) this.pluck(scale[this.step] * (Math.random() < 0.15 ? 0.5 : 1), 0.07 + Math.random() * 0.04);
      if (Math.random() < 0.18) setTimeout(() => this.pluck(scale[Math.max(0, this.step - 2)] * 0.5, 0.06), 140);
      this.noteT = (Math.random() < 0.25 ? 1.4 : 0.48) * (calm ? 1.5 : 1) * (0.9 + Math.random() * 0.4);
    }
  }
}
