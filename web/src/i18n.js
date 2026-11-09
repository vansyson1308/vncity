// Chữ giao diện hai thứ tiếng. Nút nào có data-i18n thì đổi theo.
const S = {
  vi: {
    tagline: 'Hồ Gươm và phố cổ 3D, ngay trên trình duyệt', loading: 'Đang tải', building: 'Đang dựng 15.000 ngôi nhà phố cổ…', error: 'Lỗi tải:',
    intro: 'Bạn đi cùng Minh, anh xe ôm phố cổ, và chú chó vàng Bơ. Đi tới các cột sáng để đóng dấu hộ chiếu: địa danh màu xanh, món ăn màu cam, văn hoá màu hồng. Đủ dấu thì nhận chứng nhận "Người Hà Nội danh dự".',
    k_move: 'đi', k_run: 'chạy', k_bike: 'lên/xuống xe máy', k_map: 'bản đồ, đi nhanh', k_time: 'sáng, chiều, hoàng hôn, đêm', k_look: 'kéo để nhìn, lăn để gần xa',
    play: 'Bắt đầu dạo phố', credit: 'Bản đồ © OpenStreetMap (ODbL). Mô hình 3D CC0 từ craft-anything. Không quảng cáo, không thu dữ liệu.',
    stamps: 'dấu', continue: 'Đi tiếp', map: 'Bản đồ Hoàn Kiếm', maphelp: 'Bấm vào một điểm để xe ôm chở tới ngay.', book: 'Hộ chiếu du lịch', reset: 'Xoá dấu, chơi lại',
    certk: 'Chứng nhận', cert: 'Người Hà Nội danh dự', certp: 'Bạn đã đi khắp Hồ Gươm và phố cổ, đóng đủ dấu hộ chiếu. Hà Nội ngoài đời còn đẹp hơn thế: hẹn bạn ở Bờ Hồ!', share: 'Chia sẻ',
    stamped: 'ĐÃ ĐẾN', again: 'ĐÃ CÓ DẤU', built: 'Xây năm', bikeOn: '🛵 Lên xe! W ga, S phanh, A/D lái. F để xuống.', bikeOff: '🚶 Xuống xe đi bộ.',
    hint: 'Đi theo mũi tên vàng tới cột sáng gần nhất. Bấm M để mở bản đồ.', xeom: 'Xe ôm chở tới', allDone: 'Bạn đã đóng đủ dấu!',
    shareText: 'Mình vừa đóng {n} dấu hộ chiếu ở Hồ Gươm và phố cổ trong Hà Nội Dạo Phố!', copied: 'Đã chép đường dẫn.',
  },
  en: {
    tagline: 'Hoàn Kiếm Lake and the Old Quarter in 3D, right in your browser', loading: 'Loading', building: 'Raising 15,000 Old Quarter houses…', error: 'Load error:',
    intro: 'You walk with Minh, an Old Quarter motorbike-taxi driver, and Bơ the yellow dog. Head to the light beams to stamp your passport: blue for landmarks, orange for food, pink for culture. Collect them all to become an "Honorary Hanoian".',
    k_move: 'walk', k_run: 'run', k_bike: 'hop on/off the motorbike', k_map: 'map, fast travel', k_time: 'morning, afternoon, sunset, night', k_look: 'drag to look, wheel to zoom',
    play: 'Start exploring', credit: 'Map © OpenStreetMap (ODbL). CC0 3D models from craft-anything. No ads, no tracking.',
    stamps: 'stamps', continue: 'Keep going', map: 'Hoàn Kiếm map', maphelp: 'Tap a spot and a xe ôm takes you there.', book: 'Travel passport', reset: 'Clear stamps, start over',
    certk: 'Certificate', cert: 'Honorary Hanoian', certp: 'You walked all around Hoàn Kiếm Lake and the Old Quarter and filled your passport. The real Hanoi is even better: see you by the lake!', share: 'Share',
    stamped: 'VISITED', again: 'STAMPED', built: 'Built', bikeOn: '🛵 On the bike! W throttle, S brake, A/D steer. F to get off.', bikeOff: '🚶 Back on foot.',
    hint: 'Follow the yellow arrow to the nearest light beam. Press M for the map.', xeom: 'Xe ôm ride to', allDone: 'Passport complete!',
    shareText: 'I just collected {n} passport stamps around Hoàn Kiếm Lake in Hanoi Stroll!', copied: 'Link copied.',
  },
};
let cur = 'vi';
export const lang = () => cur;
export const T = (k) => S[cur][k] ?? S.vi[k] ?? k;
export function setLang(l) {
  cur = S[l] ? l : 'vi';
  document.documentElement.lang = cur;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = T(el.dataset.i18n); });
  document.title = cur === 'vi' ? 'Hà Nội Dạo Phố' : 'Hanoi Stroll';
}
