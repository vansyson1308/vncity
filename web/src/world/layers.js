// Thứ tự các lớp trong texture mảng mặt đứng (world/facades.js vẽ đúng thứ tự này). Dùng chung với worker.
// Tầng trên nhà ống: UP + (0 ban công sắt cửa chớp, 1 hai cửa sổ chớp, 2 cửa nhôm kính lan can inox, 3 chuồng cọp, 4 ốp gạch men,
// 5 tường ngõ, 6 nhà cổ vôi vàng cửa gỗ, 7 nhà thập niên 90 cửa vòm con tiện, 8 khách sạn mini kính, 9 tường cũ cửa sổ nhỏ mái tôn).
// Tầng trệt cửa hàng: SHOP + (0 mở bày hàng, 1 cửa cuốn đóng, 2 cà phê kính, 3 quán ăn, 4 cửa xếp sắt, 5 cửa kính thời trang,
// 6 sảnh khách sạn, 7 cửa gỗ bức bàn nhà cổ, 8 hàng vải quần áo, 9 tranh thêu đồ lưu niệm, 10 hàng khô tạp hoá, 11 hàng mã đèn lồng,
// 12 tiệm sửa xe, 13 tiệm cắt tóc, 14 hàng hoa cây cảnh).
export const L = {
  UP: 0, N_UP: 10, UP_IRON: 0, UP_SHUT: 1, UP_ALU: 2, UP_CAGE: 3, UP_TILE: 4, UP_ALLEY: 5, UP_OLD: 6, UP_90S: 7, UP_HOTEL: 8, UP_WORN: 9,
  SHOP: 10, N_SHOP: 15, S_OPEN: 10, S_ROLL: 11, S_CAFE: 12, S_EAT: 13, S_FOLD: 14, S_GLASS: 15, S_LOBBY: 16, S_WOOD: 17,
  S_CLOTH: 18, S_ART: 19, S_STORE: 20, S_PAPER: 21, S_GARAGE: 22, S_SALON: 23, S_FLORA: 24,
  DOOR: 25, BLANK: 26, FR_UP: 28, FR_GND: 29, FR_UP2: 30, MOD: 31, MOD_GND: 33, APART: 34, PUB_UP: 35, PUB_GND: 36,
  TEMPLE: 37, CHURCH: 38, MARKET: 39, SMALL: 40, RIB: 41, ROOF: 42, PARAPET: 45, STONE: 46, COUNT: 47,
};
