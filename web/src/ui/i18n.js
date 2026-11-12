// Chữ giao diện hai thứ tiếng. Phần tử có data-i18n tự đổi theo ngôn ngữ.
const S = {
  vi: {
    tagline: 'Một buổi chiều tối thong dong ở Hà Nội', loading: 'Đang tải bản đồ', building: 'Đang dựng phố phường', error: 'Lỗi tải:', no_webgl: 'Trình duyệt này chưa bật được đồ hoạ 3D (WebGL2) nên game không chạy được.\nCách khắc phục: bật "Tăng tốc phần cứng" trong cài đặt trình duyệt rồi mở lại; cập nhật trình duyệt và driver card màn hình; hoặc mở bằng Chrome, Edge, Firefox bản mới trên máy khác.', gl_lost: 'Đồ hoạ vừa bị ngắt. Game sẽ tự tải lại khi card màn hình hoạt động trở lại; vị trí của bạn đã được lưu.',
    goal: 'Đóng đầy cuốn hộ chiếu Hà Nội: đi tới các địa danh và món ngon, mỗi nơi một con dấu.',
    intro: 'Bạn là Minh, chạy xe ôm phố cổ. Dạo bộ quanh Hồ Gươm, lên xe luồn qua dòng xe máy, chở khách kiếm tiền ăn phở. Không thua, không đồng hồ đếm ngược: cứ thong thả.',
    k_move: 'đi, lái', k_run: 'chạy, tăng ga', k_bike: 'lên, xuống xe', k_use: 'đón khách, đọc thẻ', k_horn: 'bóp còi, phanh', k_map: 'bản đồ', k_time: 'đổi giờ', k_photo: 'chụp ảnh',
    t_move: 'nửa trái: di chuyển', t_look: 'nửa phải: nhìn quanh',
    play: 'Bắt đầu dạo phố', resume: 'Dạo tiếp', credit: 'Bản đồ © OpenStreetMap (ODbL) và Overture Maps. Nhân vật: Microsoft Rocketbox (MIT). Không quảng cáo, không thu thập dữ liệu.',
    map: 'Bản đồ Hà Nội', maphelp: 'Bấm vào một điểm đã có dấu để xe ôm chở tới ngay. Điểm chưa đến hiện dấu hỏi.', book: 'Hộ chiếu Hà Nội', reset: 'Xoá dấu, chơi lại', share: 'Chia sẻ hộ chiếu', continue: 'Đi tiếp',
    settings: 'Cài đặt', s_restore: 'Tiến độ cũ', stampn: 'dấu', restore: 'Khôi phục ({s})', restore_confirm: 'Thay tiến độ hiện tại bằng tiến độ cũ ({s}, {r})? Game sẽ tải lại.', s_quality: 'Chất lượng hình', s_sound: 'Hiệu ứng âm thanh', s_music: 'Nhạc nền', s_lang: 'Ngôn ngữ', q_low: 'Nhẹ', q_medium: 'Vừa', q_high: 'Đẹp', on: 'Bật', off: 'Tắt',
    certk: 'Chứng nhận', cert: 'Người Hà Nội danh dự', certp: 'Bạn đã đi khắp Hồ Gươm, phố cổ, khu phố Pháp, Ba Đình và Hồ Tây, đóng đủ dấu hộ chiếu. Hà Nội ngoài đời còn đẹp hơn thế: hẹn bạn ở Bờ Hồ!',
    stamped: 'ĐÃ ĐẾN', built: 'Xây năm', kind_landmark: 'Địa danh', kind_food: 'Món ngon', kind_culture: 'Văn hoá', nearby: 'Gần đây:', read: 'E · đọc thêm', readTouch: 'Chạm để đọc thêm',
    page_hoguom: 'Hồ Gươm', page_phoco: 'Phố cổ', page_phophap: 'Khu phố Pháp', page_badinh: 'Ba Đình', page_hotay: 'Hồ Tây', pageDone: 'Đủ dấu trang {p}! Thưởng {m}.',
    dir_n: 'bắc', dir_ne: 'đông bắc', dir_e: 'đông', dir_se: 'đông nam', dir_s: 'nam', dir_sw: 'tây nam', dir_w: 'tây', dir_nw: 'tây bắc', toward: 'về phía', north1: 'B',
    p_mount: 'Lên xe', p_dismount: 'Xuống xe', p_pick: 'Đón khách', p_eat: 'Ăn {d} ({m})', p_read: 'Đọc thêm',
    guide: 'Chú Thắng', g_first: 'Qua cổng đền Ngọc Sơn đóng con dấu đầu tiên đi cháu: Tháp Bút ngay trước mặt, rồi ra cầu Thê Húc.', g_bike: 'Giỏi! Giờ bấm F lên xe, làm một vòng quanh hồ. Cứ đi đều tay, xe khác tự tránh.',
    ime_hint: 'Bộ gõ tiếng Việt đang bật nên phím W A S D có thể không ăn. Tắt bộ gõ (chuyển sang chế độ E) hoặc dùng bốn phím mũi tên.',
    g_bikeT: 'Giỏi! Giờ bấm 🛵 lên xe, làm một vòng quanh hồ. Cứ đi đều tay, xe khác tự tránh.', g_fare: 'Thấy người giơ tay vẫy không? Tạt vào đón khách kiếm tiền ăn phở.', g_food: 'Đói chưa? Mũi tên cam là hàng ăn. Có tiền thì tạt vào làm bát.',
    day0: 'T2', day1: 'T3', day2: 'T4', day3: 'T5', day4: 'T6', day5: 'T7', day6: 'CN',
    g_walk_on: 'Bảy giờ tối cuối tuần rồi: quanh Hồ Gươm và dọc chợ đêm thành phố đi bộ, xe không vào được nữa. Cứ thong thả mà dạo.',
    g_walk: 'Phố đi bộ đấy cháu, không chạy xe trong này được. Dắt xe ra ngoài rào rồi hẵng đi.',
    g_night: 'Phố lên đèn rồi. Hà Nội về đêm mới là đẹp nhất đấy cháu.', g_cross: 'Sang đường thì cứ bước đều, đừng chạy, đừng lùi. Xe tự lách.', g_solemn: 'Khu vực trang nghiêm: mình dắt xe, đi chậm cháu nhé.', g_poor: 'Chưa đủ tiền rồi. Chở một cuốc xe ôm là có ngay.',
    g_fast: 'Giảm ga rồi hẵng xuống xe cháu ơi.', g_edge: 'Hết bản đồ rồi, quay lại thôi cháu.', g_page: 'Đủ dấu {p} rồi! Chú thưởng {m}.', g_stamp3: 'Ba dấu rồi đấy. Mở hộ chiếu (B) mà xem còn những đâu.',
    crash: ['Ối!', 'Úi giời!', 'Từ từ thôi!', 'Ối giời ơi!'], horn: 'Bíp bíp!',
    fare_to: 'Tới', fare_paid: '{n} trả {m}', fare_tip: 'thưởng thêm {m}', fare_wait: 'Khách đang chờ', fare_none: 'Lên xe đã rồi mới đón khách được.',
    c5: ['Êm quá, cảm ơn anh!', 'Đi với anh như ngồi xích lô.', 'Năm sao luôn!'], c4: ['Cũng được, cảm ơn anh.', 'Đường đông mà anh đi khéo đấy.'], c2: ['Đâm quệt thế này em sợ lắm, lần sau anh đi cẩn thận nhé.', 'Tới nơi rồi, may quá. Anh chạy ẩu quá.'], c3: ['Hơi xóc, nhưng tới nơi là được.', 'Lần sau đi chậm chút anh nhé.'],
    rank: 'Hạng xe ôm', rank0: 'Xe ôm tập sự', rank1: 'Xe ôm phố cổ', rank2: 'Xe ôm thạo đường', rank3: 'Thổ địa Hà Nội', rides: 'cuốc',
    time_morning: 'Sáng sớm', time_noon: 'Giữa trưa', time_golden: 'Chiều vàng', time_night: 'Phố đêm',
    photo: 'Đã lưu ảnh. Bấm P hoặc chạm để tiếp tục.', photoHint: 'Kéo để chọn góc · Enter hoặc bấm 📷 để chụp · Esc để thoát', photoHintT: 'Kéo để chọn góc · chạm 📷 để chụp · ✕ để thoát',
    shareText: 'Mình đã đóng {n}/{t} dấu hộ chiếu ở Hà Nội Dạo Phố.', copied: 'Đã chép đường dẫn.', xeom: 'Xe ôm chở tới', perf: 'Khung hình: {f}/giây · độ phân giải {d}%',
    money: (v) => `${Math.round(v / 1000)}k`, km: 'km', m: 'm', quality: 'Đổi chất lượng sẽ tải lại trang.', q_confirm: 'Đổi chất lượng hình sang mức "{q}"? Game sẽ tải lại, vị trí và các dấu đã đóng vẫn được giữ.', perf_wait: 'Khung hình: đang đo…', credits_audio: 'Âm thanh và nhạc nền do game tự tổng hợp, không dùng bản ghi của ai. Chi tiết trong CREDITS.md.',
  },
  en: {
    tagline: 'An easy evening loose in Hanoi', loading: 'Loading the map', building: 'Raising the streets', error: 'Load error:', no_webgl: 'This browser could not start 3D graphics (WebGL2), so the game cannot run.\nTo fix: turn on "hardware acceleration" in the browser settings and reopen; update the browser and graphics driver; or try a recent Chrome, Edge or Firefox on another device.', gl_lost: 'Graphics were interrupted. The game reloads by itself when the graphics card is back; your position is saved.',
    goal: 'Fill your Hanoi passport: reach landmarks and street food, one stamp each.',
    intro: 'You are Minh, a motorbike-taxi driver from the Old Quarter. Stroll around Hoàn Kiếm lake, hop on and thread the motorbike swarm, carry passengers to pay for your phở. No losing, no countdowns: take your time.',
    k_move: 'walk, ride', k_run: 'run, throttle up', k_bike: 'get on/off the bike', k_use: 'pick up, read card', k_horn: 'horn, brake', k_map: 'map', k_time: 'change time', k_photo: 'photo',
    t_move: 'left half: move', t_look: 'right half: look around',
    play: 'Start exploring', resume: 'Keep exploring', credit: 'Map © OpenStreetMap (ODbL) and Overture Maps. Character: Microsoft Rocketbox (MIT). No ads, no tracking.',
    map: 'Map of Hanoi', maphelp: 'Tap a stamped place and a xe ôm takes you there. Unvisited places show a question mark.', book: 'Hanoi passport', reset: 'Clear stamps, start over', share: 'Share passport', continue: 'Keep going',
    settings: 'Settings', s_restore: 'Earlier progress', stampn: 'stamps', stampn1: 'stamp', restore: 'Restore ({s})', restore_confirm: 'Replace your current progress with the earlier one ({s}, {r})? The game will reload.', s_quality: 'Graphics', s_sound: 'Sound effects', s_music: 'Music', s_lang: 'Language', q_low: 'Light', q_medium: 'Medium', q_high: 'Pretty', on: 'On', off: 'Off',
    certk: 'Certificate', cert: 'Honorary Hanoian', certp: 'You went all over Hoàn Kiếm lake, the Old Quarter, the French Quarter, Ba Đình and West Lake and filled your passport. The real Hanoi is even better: see you by the lake!',
    stamped: 'VISITED', built: 'Built', kind_landmark: 'Landmark', kind_food: 'Street food', kind_culture: 'Culture', nearby: 'Nearby:', read: 'E · read more', readTouch: 'Tap to read more',
    page_hoguom: 'Hoàn Kiếm lake', page_phoco: 'Old Quarter', page_phophap: 'French Quarter', page_badinh: 'Ba Đình', page_hotay: 'West Lake', pageDone: '{p} page complete! Bonus {m}.',
    dir_n: 'north', dir_ne: 'north-east', dir_e: 'east', dir_se: 'south-east', dir_s: 'south', dir_sw: 'south-west', dir_w: 'west', dir_nw: 'north-west', toward: 'to the', north1: 'N',
    p_mount: 'Get on', p_dismount: 'Get off', p_pick: 'Pick up', p_eat: 'Eat {d} ({m})', p_read: 'Read more',
    guide: 'Uncle Thắng', g_first: 'Walk through the temple gate for your first stamp, kid: the Pen Tower is right ahead, then Thê Húc bridge.', g_bike: 'Nice! Now press F for the bike and do a lap of the lake. Keep it steady, the others flow around you.',
    ime_hint: 'A Vietnamese input method is on, so W A S D may not respond. Switch it off or use the arrow keys.',
    g_bikeT: 'Nice! Now tap 🛵 for the bike and do a lap of the lake. Keep it steady, the others flow around you.', g_fare: 'See someone waving? Pull over and pick them up, that pays for your phở.', g_food: 'Hungry? Orange arrows are food. Got cash, go have a bowl.',
    day0: 'Mon', day1: 'Tue', day2: 'Wed', day3: 'Thu', day4: 'Fri', day5: 'Sat', day6: 'Sun',
    g_walk_on: 'Seven on a weekend evening: the streets around Hoàn Kiếm lake and the night market are now for walking only. Take your time.',
    g_walk: 'This is a walking street tonight, kid: no riding in here. Push the bike out past the barriers first.',
    g_night: 'Lights are coming on. Hanoi is at its best at night, kid.', g_cross: 'To cross, walk steadily. Do not run, do not step back. The bikes flow around you.', g_solemn: 'A solemn place: walk the bike and go slowly here.', g_poor: 'Not enough cash yet. One xe ôm fare will cover it.',
    g_fast: 'Slow down before you hop off, kid.', g_edge: 'That is the edge of the map, turn back.', g_page: '{p} page complete! Here is {m} from me.', g_stamp3: 'Three stamps already. Open the passport (B) to see what is left.',
    crash: ['Oops!', 'Whoa!', 'Easy there!', 'Oh dear!'], horn: 'Beep beep!',
    fare_to: 'To', fare_paid: '{n} paid {m}', fare_tip: 'plus a {m} tip', fare_wait: 'A passenger is waiting', fare_none: 'Get on the bike before picking anyone up.',
    c5: ['So smooth, thank you!', 'Like riding a cyclo.', 'Five stars!'], c4: ['Fine ride, thanks.', 'Busy streets, well handled.'], c2: ['That was scary. Please ride more carefully.', 'We made it, somehow. Too reckless.'], c3: ['A bit bumpy, but we made it.', 'Slower next time, please.'],
    rank: 'Xe ôm rank', rank0: 'Trainee xe ôm', rank1: 'Old Quarter xe ôm', rank2: 'Street-smart xe ôm', rank3: 'Hanoi insider', rides: 'rides', rides1: 'ride',
    time_morning: 'Early morning', time_noon: 'Midday', time_golden: 'Golden hour', time_night: 'Night streets',
    photo: 'Photo saved. Press P or tap to continue.', photoHint: 'Drag to frame · Enter or click 📷 to shoot · Esc to leave', photoHintT: 'Drag to frame · tap 📷 to shoot · ✕ to leave',
    shareText: 'I have {n}/{t} passport stamps in Hanoi Stroll.', copied: 'Link copied.', xeom: 'Xe ôm ride to', perf: 'Frame rate: {f}/s · resolution {d}%',
    money: (v) => `${Math.round(v / 1000)}k₫`, km: 'km', m: 'm', quality: 'Changing quality reloads the page.', q_confirm: 'Switch graphics to "{q}"? The game will reload; your position and stamps are kept.', perf_wait: 'Frame rate: measuring…', credits_audio: 'All sound and music is synthesised by the game itself; no recordings are used. See CREDITS.md.',
  },
};
let cur = 'vi';
export const lang = () => cur;
export const T = (k, vars) => { let s = S[cur][k] ?? S.vi[k] ?? k; if (vars && typeof s === 'string') for (const v in vars) s = s.replace(`{${v}}`, vars[v]); return s; };
// Chuỗi theo cả hai ngôn ngữ (cho những nhãn tự đổi theo ngôn ngữ đang chọn, như ô la bàn).
export const both = (k) => ({ vi: S.vi[k], en: S.en[k] ?? S.vi[k] });
// Số đếm kèm danh từ: tiếng Anh chia số ít, số nhiều (khoá k và k + '1'); tiếng Việt không chia.
export const count = (n, k) => `${n} ${n === 1 && S[cur][k + '1'] ? S[cur][k + '1'] : T(k)}`;
// Dịch lại một chuỗi đang hiển thị sang ngôn ngữ hiện tại: tìm xem nó là chuỗi nào trong bảng của ngôn ngữ cũ.
export function retranslate(text, from) {
  const A = S[from], B = S[cur]; if (!A || from === cur) return text;
  for (const k in A) { const v = A[k]; if (v === text) return typeof B[k] === 'string' ? B[k] : text; if (Array.isArray(v)) { const i = v.indexOf(text); if (i >= 0 && Array.isArray(B[k])) return B[k][Math.min(i, B[k].length - 1)]; } }
  return text;
}
export const pick = (k) => { const a = T(k); return Array.isArray(a) ? a[Math.floor(Math.random() * a.length)] : a; };
export const money = (v) => S[cur].money(v);
export const dist = (d) => (d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d / 5) * 5} m`);
export function setLang(l) {
  cur = S[l] ? l : 'vi';
  document.documentElement.lang = cur;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = T(el.dataset.i18n); });
  const other = document.getElementById('lang'); if (other) other.textContent = cur === 'vi' ? 'English' : 'Tiếng Việt'; // nút ở màn hình bắt đầu ghi tên ngôn ngữ còn lại
  document.title = cur === 'vi' ? 'Hà Nội Dạo Phố' : 'Hanoi Stroll';
  try { localStorage.setItem('hn-lang', cur); } catch { /* chế độ riêng tư */ }
}
