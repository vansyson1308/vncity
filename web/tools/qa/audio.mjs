// MỤC 6: ÂM THANH
//   m1) trước khi người chơi thao tác: không có lỗi hay cảnh báo AudioContext trong console, không có tiếng phát ra;
//   m2) sau cú bấm đầu tiên (nút Bắt đầu, bấm chuột thật): AudioContext chạy; có tín hiệu ra loa (RMS) khi bật cả hai công tắc;
//   m3) tắt "Âm thanh" (bấm thật trong bảng Cài đặt): nhánh hiệu ứng về 0, nhạc vẫn còn; tắt "Nhạc nền": nhánh nhạc về 0, hiệu ứng vẫn còn;
//       tắt cả hai: đường ra loa im lặng;
//   m4) lựa chọn được lưu: tải lại trang, bảng Cài đặt hiện đúng trạng thái đã chọn và âm thanh theo đúng trạng thái đó.
// Cách đo độc lập với bộ đo của game: bài thử gắn AnalyserNode riêng vào mọi nút nối ra loa (chặn AudioNode.connect tới destination từ
// trước khi mã game chạy), và vào hai nhánh âm lượng "hiệu ứng" và "nhạc" của game. Không dùng cờ --autoplay-policy: chính sách tự phát
// của trình duyệt giữ nguyên như máy người chơi. Vòng lặp thật (âm thanh chạy theo thời gian thật), tắt vẽ.
// Dùng: node tools/qa/audio.mjs
import { launch, openGame, Report, fx, sleep } from './lib.mjs';

const R = new Report('audio');
const browser = await launch();
const tapInit = () => {
  window.__audio = { taps: [], ctxs: [], log: [] };
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...a) {
    const r = orig.call(this, dest, ...a);
    try { if (dest instanceof AudioDestinationNode) { const c = this.context; if (!c.__tap) { c.__tap = c.createAnalyser(); c.__tap.fftSize = 2048; window.__audio.taps.push(c.__tap); window.__audio.ctxs.push(c); window.__audio.log.push({ t: performance.now(), state: c.state, active: navigator.userActivation ? navigator.userActivation.hasBeenActive : null }); } orig.call(this, c.__tap); } } catch (e) { window.__audio.log.push({ err: String(e) }); }
    return r;
  };
  const buf = new Float32Array(2048);
  const rms = (an) => { an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return Math.sqrt(s / buf.length); };
  // đỉnh RMS trong ms mili giây của: đường ra loa, nhánh hiệu ứng, nhánh nhạc
  window.__audio.peak = (ms) => new Promise((res) => {
    const A = window.__game.audio, c = A.ctx; if (!c) return res({ out: 0, sfx: 0, music: 0, state: 'none' });
    if (!A.__qs) { A.__qs = c.createAnalyser(); A.__qm = c.createAnalyser(); A.__qs.fftSize = A.__qm.fftSize = 2048; orig.call(A.sfx, A.__qs); orig.call(A.musicGain, A.__qm); }
    const m = { out: 0, sfx: 0, music: 0, n: 0 }, t0 = performance.now(), iv = setInterval(() => { m.out = Math.max(m.out, ...window.__audio.taps.map(rms)); m.sfx = Math.max(m.sfx, rms(A.__qs)); m.music = Math.max(m.music, rms(A.__qm)); m.n++; if (performance.now() - t0 > ms) { clearInterval(iv); res({ ...m, state: c.state, time: c.currentTime }); } }, 25);
  });
};

const ctx = await browser.newContext({ viewport: { width: 1140, height: 670 } });
const msgs = []; // mọi thông điệp console có nhắc tới âm thanh, kể cả cảnh báo
let o = await openGame(browser, 'q=low&fresh&lang=vi&h=12', { context: ctx, init: tapInit, norender: true, start: 'none' });
let page = o.page; page.on('console', (m) => { if (/audio/i.test(m.text())) msgs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });

// ----- m1: trước mọi thao tác -----
await sleep(1500);
const pre = await page.evaluate(() => ({ ctxs: window.__audio.ctxs.length, states: window.__audio.ctxs.map((c) => c.state), gameCtx: window.__game.audio.ctx ? window.__game.audio.ctx.state : null, active: navigator.userActivation ? navigator.userActivation.hasBeenActive : null, log: window.__audio.log }));
R.check('m1: trước khi người chơi thao tác: game không tạo AudioContext đang chạy, không lỗi/cảnh báo âm thanh trong console, không pageerror', (pre.gameCtx === null || pre.gameCtx === 'suspended') && msgs.length === 0 && o.errors.length === 0, JSON.stringify({ ...pre, console: msgs, errors: o.errors.slice(0, 2) }));
// Trình duyệt thử (Chromium không đầu, do Playwright điều khiển) coi trang là "đã có thao tác" ngay từ lúc tải, nên KHÔNG kiểm được việc
// trình duyệt thật chặn âm thanh trước thao tác; chỉ kiểm được rằng game tự nó không mở âm thanh trước cú bấm.
R.check('m1b: môi trường thử có chặn âm thanh trước thao tác như trình duyệt của người chơi (để phép thử m1 có đủ nghĩa)', pre.active === false ? true : 'skip', `navigator.userActivation.hasBeenActive trước mọi thao tác = ${pre.active}`);

// ----- m2: cú bấm đầu tiên -----
await page.click('#play'); await page.waitForFunction(() => window.__game.G.started === true, null, { timeout: 60000 });
await sleep(800);
const st = await page.evaluate(() => { const A = window.__game.audio; return { has: !!A.ctx, state: A.ctx && A.ctx.state, enabled: A.enabled, music: A.music, taps: window.__audio.taps.length, ls: [localStorage.getItem('hn-sound'), localStorage.getItem('hn-music')] }; });
R.check('m2: sau khi bấm nút Bắt đầu: AudioContext đang chạy, mặc định bật cả Âm thanh lẫn Nhạc nền', st.has && st.state === 'running' && st.enabled && st.music && st.taps >= 1, JSON.stringify(st));
const both = await page.evaluate(() => window.__audio.peak(9000));
R.check('m2: bật cả hai: có tín hiệu ra loa, ở nhánh hiệu ứng và ở nhánh nhạc (đỉnh RMS trong 9 giây)', both.out > 0.003 && both.sfx > 0.0005 && both.music > 0.0005, `loa ${fx(both.out, 4)}, hiệu ứng ${fx(both.sfx, 4)}, nhạc ${fx(both.music, 4)} (đồng hồ âm thanh ${fx(both.time, 1)} giây)`);

// ----- m3: từng công tắc, bấm thật trong bảng Cài đặt -----
// vòng lặp thật ở máy thử chỉ vài khung hình/giây: phím Esc và nút ⚙️ có tác dụng ở khung hình kế tiếp, nên luôn chờ trạng thái bảng
const closeModal = async () => { if (await page.evaluate(() => window.__game.hud.modal !== null)) { await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__game.hud.modal === null, null, { timeout: 30000 }); } };
const openSettings = async () => { await closeModal(); await page.click('#b-set'); await page.waitForFunction(() => window.__game.hud.modal === 'settings', null, { timeout: 30000 }); };
const setSwitch = async (group, v) => { await openSettings(); await page.click(`#${group} button[data-v="${v}"]`); await sleep(300); };
const ui = () => page.evaluate(() => ({ sound: document.querySelector('#s-sound button.on')?.dataset.v, music: document.querySelector('#s-music button.on')?.dataset.v, ls: [localStorage.getItem('hn-sound'), localStorage.getItem('hn-music')], flags: [window.__game.audio.enabled, window.__game.audio.music] }));
await setSwitch('s-sound', 0); const u1 = await ui(); await closeModal(); await sleep(3200); // chờ đuôi vang 2,2 giây tắt hẳn
const sOff = await page.evaluate(() => window.__audio.peak(8000));
R.check('m3: tắt "Âm thanh": nhánh hiệu ứng im (RMS < 0,0002), nhạc vẫn phát; nút và bộ nhớ ghi đúng', sOff.sfx < 0.0002 && sOff.music > 0.0005 && sOff.out > 0.0005 && u1.sound === '0' && u1.music === '1' && u1.ls[0] === '0', `hiệu ứng ${fx(sOff.sfx, 5)}, nhạc ${fx(sOff.music, 4)}, loa ${fx(sOff.out, 4)}; ${JSON.stringify(u1)}`);
await setSwitch('s-sound', 1); await setSwitch('s-music', 0); await closeModal(); await sleep(3200);
// lên xe và vặn ga để chắc chắn có hiệu ứng (tiếng máy)
await page.keyboard.press('KeyF'); await page.waitForFunction(() => window.__game.player.mode === 'bike', null, { timeout: 30000 }); await page.keyboard.down('KeyW');
const mOff = await page.evaluate(() => window.__audio.peak(6000)); await page.keyboard.up('KeyW');
R.check('m3: tắt "Nhạc nền": nhánh nhạc im (RMS < 0,0002), hiệu ứng (tiếng máy xe khi vặn ga) vẫn có', mOff.music < 0.0002 && mOff.sfx > 0.002 && mOff.out > 0.002, `nhạc ${fx(mOff.music, 5)}, hiệu ứng ${fx(mOff.sfx, 4)}, loa ${fx(mOff.out, 4)}`);
await setSwitch('s-sound', 0); await closeModal(); await sleep(3200);
await page.keyboard.down('KeyW'); const none = await page.evaluate(() => window.__audio.peak(4000)); await page.keyboard.up('KeyW');
R.check('m3: tắt cả hai: đường ra loa im lặng (RMS < 0,0002) kể cả khi đang vặn ga', none.out < 0.0002 && none.sfx < 0.0002 && none.music < 0.0002, `loa ${fx(none.out, 5)}, hiệu ứng ${fx(none.sfx, 5)}, nhạc ${fx(none.music, 5)}`);

// ----- m4: lưu qua tải lại -----
await setSwitch('s-music', 1); await closeModal(); // trạng thái để lưu: Âm thanh TẮT, Nhạc nền BẬT
const errs1 = o.errors.slice();
await page.close();
o = await openGame(browser, 'q=low&lang=vi&h=12', { context: ctx, init: tapInit, norender: true, start: 'click' }); page = o.page;
await sleep(800); await openSettings(); const u2 = await ui(); await closeModal(); await sleep(2500);
const re = await page.evaluate(() => window.__audio.peak(8000));
R.check('m4: tải lại trang: bảng Cài đặt vẫn hiện Âm thanh TẮT, Nhạc nền BẬT; âm thanh phát đúng theo đó (hiệu ứng im, nhạc có)', u2.sound === '0' && u2.music === '1' && u2.flags[0] === false && u2.flags[1] === true && re.sfx < 0.0002 && re.music > 0.0005, `${JSON.stringify(u2)}; hiệu ứng ${fx(re.sfx, 5)}, nhạc ${fx(re.music, 4)}`);
R.check('không có pageerror / console.error, không thông điệp console nào về âm thanh', errs1.length === 0 && o.errors.length === 0 && msgs.length === 0, [...errs1, ...o.errors, ...msgs].slice(0, 4).join(' | '));
await browser.close();
process.exit(R.finish());
