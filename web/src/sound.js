// Âm thanh phố tổng hợp bằng WebAudio: tiếng xe xa, còi xe máy, tiếng chuông đóng dấu. Không cần tệp âm thanh.
export class Sound {
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(ctx.destination);
    // tiếng ồn nâu lọc thấp: dòng xe xa
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    this.hum = ctx.createGain(); this.hum.gain.value = 0.25;
    src.connect(lp).connect(this.hum).connect(this.master); src.start();
    // tiếng máy xe khi lái
    this.eng = ctx.createOscillator(); this.eng.type = 'sawtooth'; this.eng.frequency.value = 40;
    const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 300;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.eng.connect(ef).connect(this.engGain).connect(this.master); this.eng.start();
    this.nextHorn = ctx.currentTime + 3;
  }
  horn(vol = 0.12) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime, g = ctx.createGain(); g.connect(this.master);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.setValueAtTime(vol, t + 0.18); g.gain.linearRampToValueAtTime(0, t + 0.25);
    for (const f of [420 + Math.random() * 80, 520 + Math.random() * 80]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; const lp = ctx.createBiquadFilter(); lp.frequency.value = 1800; o.connect(lp).connect(g); o.start(t); o.stop(t + 0.3); }
  }
  setTraffic(honking, bikeSpeed) {
    const ctx = this.ctx; if (!ctx) return;
    if (honking && ctx.currentTime > this.nextHorn) { this.horn(0.14); this.nextHorn = ctx.currentTime + 1.2; }
    if (ctx.currentTime > this.nextHorn + 4) { this.horn(0.03 + Math.random() * 0.04); this.nextHorn = ctx.currentTime + 2 + Math.random() * 6; }
    const s = Math.abs(bikeSpeed);
    this.engGain.gain.setTargetAtTime(s > 0.1 ? 0.05 + s * 0.006 : 0, ctx.currentTime, 0.2);
    this.eng.frequency.setTargetAtTime(38 + s * 7, ctx.currentTime, 0.2);
  }
  chime() {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    [784, 988, 1175].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t + i * 0.09); g.gain.linearRampToValueAtTime(0.2, t + i * 0.09 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.9); o.connect(g).connect(this.master); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 1); });
  }
}
