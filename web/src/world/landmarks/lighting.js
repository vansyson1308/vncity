// Chiếu sáng đêm cho công trình dựng tay (art bible mục 7: Tháp Rùa vàng ấm từ chân tháp, Lăng trắng ấm đều mặt trước, Nhà thờ Lớn
// trắng ấm, Cột cờ...). Game không có đèn điểm: mọi công trình dùng chung chất liệu `landmark`, shader tự cộng một lớp đèn pha vàng ấm
// nhạt (mức `flood`, mặc định 0,34) và phần tự sáng của từng đỉnh (`glow`, không nhuộm màu). Hai cách làm một công trình sáng hơn ban đêm:
//   - mô hình xuất `export const flood = <mức>`: landmarks/index.js cấp cho nó một bản chất liệu có mức đèn pha ấy (ánh vàng ấm);
//   - gọi floodlit() sau khi dựng xong phần được rọi đèn: nâng `glow` của các đỉnh trong khoảng [from, to) (ánh trắng, theo màu vật liệu).
// Mức sáng giữ vừa phải: phần phát sáng cộng lại không quá khoảng 1,1 lần màu vật liệu, để hậu kỳ không làm cháy trắng.

// level(x, y, z, nx, ny, nz) → glow 0..1 cho một đỉnh (toạ độ và pháp tuyến trong hệ của mô hình lúc gọi). Đỉnh đã sáng hơn thì giữ nguyên.
export function floodlit(g, from, to, level) {
  for (let i = from; i < to; i++) {
    const v = level(g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2], g.nrm[i * 3], g.nrm[i * 3 + 1], g.nrm[i * 3 + 2]);
    if (v > g.fx[i * 4]) g.fx[i * 4] = v;
  }
}
