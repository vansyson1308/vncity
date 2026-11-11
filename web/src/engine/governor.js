// Bộ điều tiết hiệu năng. Độ phân giải động (engine/renderer.js) lo phần GPU tô điểm ảnh; khi đã hạ hết cỡ mà
// khung hình vẫn dưới 45/giây thì giảm dần khối lượng cảnh: bớt xe và người, thu hẹp vùng chi tiết, thưa cập nhật
// bóng đổ, cuối cùng tắt bóng đổ. Máy khoẻ thì không bao giờ chạm tới các bậc này.
export class Governor {
  constructor(R, sky, quality, traffic, crowd, chunks) { this.R = R; this.sky = sky; this.q = quality; this.traffic = traffic; this.crowd = crowd; this.chunks = chunks; this.level = 0; this.bad = 0; this.good = 0; this.base = { near: quality.near, bikes: traffic.maxBikes, cars: traffic.maxCars, crowd: crowd.max, every: quality.shadowEvery }; }
  apply() {
    const L = this.level, b = this.base, k = [1, 0.8, 0.62, 0.5, 0.4][L];
    this.q.near = b.near * (L >= 1 ? 0.8 : 1) * (L >= 3 ? 0.8 : 1); this.traffic.maxBikes = Math.round(b.bikes * k); this.traffic.maxCars = Math.round(b.cars * k); this.crowd.max = Math.max(6, Math.round(b.crowd * k));
    this.q.shadowEvery = b.every ? b.every + L * 2 : 0;
    if (this.sky.sun.castShadow !== (this.q.shadow > 0 && L < 4)) { this.sky.sun.castShadow = this.q.shadow > 0 && L < 4; }
    this.chunks.update(this.chunks.last.x, this.chunks.last.z, true);
  }
  // gọi hai lần mỗi giây với số khung hình/giây vừa đo; hidden: tab đang ẩn thì bỏ qua
  tick(fps) {
    if (document.hidden || this.R.fixedDpr) return;
    const atMin = this.R.dpr <= this.R.minDpr + 0.03;
    if (fps < 44 && atMin) { this.bad += 0.5; this.good = 0; } else if (fps > 57) { this.good += 0.5; this.bad = Math.max(0, this.bad - 0.25); } else this.bad = Math.max(0, this.bad - 0.1);
    if (this.bad >= 4 && this.level < 4) { this.level++; this.bad = 0; this.apply(); }
    else if (this.good >= 30 && this.level > 0 && this.R.dpr >= this.R.maxDpr - 0.03) { this.level--; this.good = 0; this.apply(); }
  }
}
