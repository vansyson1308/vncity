// Thứ tự các lớp trong texture mảng mặt đứng (world/facades.js vẽ đúng thứ tự này). Dùng chung với worker.
// Tầng trên nhà ống: UP + (0 ban công sắt cửa chớp, 1 hai cửa sổ chớp, 2 cửa nhôm kính lan can inox, 3 chuồng cọp, 4 ốp gạch men,
// 5 tường ngõ, 6 nhà cổ vôi vàng cửa gỗ, 7 nhà thập niên 90 cửa vòm con tiện, 8 khách sạn mini kính, 9 tường cũ cửa sổ nhỏ mái tôn).
// Tầng trệt cửa hàng: SHOP + (0 mở bày hàng, 1 cửa cuốn đóng, 2 cà phê kính, 3 quán ăn, 4 cửa xếp sắt, 5 cửa kính thời trang,
// 6 sảnh khách sạn, 7 cửa gỗ bức bàn nhà cổ).
export const L = {
  UP: 0, N_UP: 10, UP_IRON: 0, UP_SHUT: 1, UP_ALU: 2, UP_CAGE: 3, UP_TILE: 4, UP_ALLEY: 5, UP_OLD: 6, UP_90S: 7, UP_HOTEL: 8, UP_WORN: 9,
  SHOP: 10, N_SHOP: 8, S_OPEN: 10, S_ROLL: 11, S_CAFE: 12, S_EAT: 13, S_FOLD: 14, S_GLASS: 15, S_LOBBY: 16, S_WOOD: 17,
  DOOR: 18, BLANK: 19, FR_UP: 21, FR_GND: 22, FR_UP2: 23, MOD: 24, MOD_GND: 26, APART: 27, PUB_UP: 28, PUB_GND: 29,
  TEMPLE: 30, CHURCH: 31, MARKET: 32, SMALL: 33, RIB: 34, ROOF: 35, PARAPET: 38, STONE: 39, COUNT: 40,
};
