# 17. Bản web three.js: "Hà Nội Dạo Phố"

Bản chơi ngay trên trình duyệt để quảng bá du lịch Hà Nội: đi bộ hoặc chạy xe máy quanh Hồ Gươm và
phố cổ, tới từng địa danh, món ăn để đóng dấu hộ chiếu, đọc giới thiệu song ngữ Việt và Anh. Không
cướp bóc, không bắn súng. Mã nguồn ở `web/`, bản chạy được đưa lên GitHub Pages:
<https://vansyson1308.github.io/vncity/>.

## 1. Vì sao three.js

| Lựa chọn | Ưu | Nhược | Kết luận |
|---|---|---|---|
| **three.js** (WebGL2, có WebGPURenderer) | Thư viện 3D web phổ biến nhất, tài liệu và ví dụ nhiều nhất; tải nhẹ (khoảng 200 KB gzip cả game); đọc glTF, meshopt, KTX2 sẵn; chạy cả điện thoại | Không phải engine trọn gói: vật lý, AI, âm thanh phải tự viết hoặc ghép thư viện | **Chọn** cho bản quảng bá |
| Babylon.js | Engine trọn gói hơn (vật lý, GUI, inspector) | Tải nặng hơn, cộng đồng làm "web đẹp" ít hơn | Dự phòng |
| PlayCanvas | Trình biên tập trên mây tốt | Trình biên tập là dịch vụ đóng, khó điều khiển bằng Claude Code | Không chọn |
| Bevy + WASM (cách của craft-anything) | Cùng một mã Rust chạy máy tính và web, WebGPU | File WASM lớn, biên dịch lâu, chỉ chạy tốt trên máy tính | Giữ cho bản game đầy đủ |
| Unity WebGL / UE Pixel Streaming | Dùng lại dự án engine | Unity WebGL tải hàng chục MB, kém trên điện thoại; Pixel Streaming tốn tiền máy chủ GPU cho mỗi người chơi | Không hợp để quảng bá đại trà |

Những trang three.js "nhìn mượt và thật" thường dựa vào cùng một bộ kỹ thuật. Bản này dùng phần lớn
bộ đó:

1. **Vật liệu PBR + ánh sáng môi trường HDR**: bầu trời vật lý (`Sky`) được chuyển thành bản đồ môi
   trường (PMREM) nên mặt hồ, kính, kim loại phản chiếu đúng màu trời từng giờ.
2. **Tone mapping ACES + gamma đúng (sRGB)**: màu không bị bệt, nắng chiều có chiều sâu.
3. **Bóng đổ mềm** từ mặt trời, khung bóng đi theo người chơi để bóng luôn nét ở gần.
4. **Hậu kỳ**: bloom cho đèn lồng, đèn cửa hàng ban đêm.
5. **Nén tài nguyên**: ảnh WebP thu theo kích thước cần dùng, hình học nén meshopt. 334 MB tài nguyên
   gốc của craft-anything còn khoảng 21 MB.
6. **Instancing và LOD**: hàng trăm đèn lồng, đèn đường, bàn ghế nhựa, xe máy vẽ bằng một lệnh vẽ mỗi
   loại; cây gần là mô hình 3D, cây xa là tấm ảnh.
7. **Gộp hình học theo ô 400 m**: 15.192 ngôi nhà thành vài chục lưới, khoảng 300 đến 400 lệnh vẽ mỗi
   khung hình.

Bước tiếp theo nếu cần đẹp hơn nữa: ảnh nén KTX2/Basis (giảm bộ nhớ GPU 4 đến 6 lần), `WebGPURenderer`
của three.js khi Safari và Firefox bật WebGPU mặc định, SSAO và TAA ở mức chất lượng cao, ánh sáng
nướng sẵn (lightmap) cho khu Hồ Gươm.

## 2. Dữ liệu và tài nguyên dùng lại

| Nguồn | Dùng gì | Giấy phép |
|---|---|---|
| vncity `game/content/world/landmarks.json` | 25 địa danh trong khung bản đồ Hoàn Kiếm, tên và mô tả song ngữ, năm xây | Nội dung của dự án |
| `web/src/data/foods.json` (mới) | 7 điểm ẩm thực + phố đèn lồng Hàng Mã, chỉ ghi món và phố, không ghi tên quán | Nội dung của dự án |
| craft-anything `examples/game-hanoi-city/assets/hoankiem.json` | Bản đồ OSM quận Hoàn Kiếm: 15.192 toà nhà có chiều cao, 3.662 đoạn đường, hồ, công viên, 1.463 cây | ODbL, ghi "© OpenStreetMap" trong game |
| craft-anything `assets/hq/` | Tháp Rùa, đền Ngọc Sơn, cầu Thê Húc, Tháp Bút, Minh, 3 khách đi đường, chó vàng, xe máy có người lái, đèn lồng, đèn đường, lan can hồ, ghế đỏ, ghế xanh, bàn nhựa, cây xà cừ, vật liệu đường, vỉa hè, gạch lát hồ, cỏ, nước | CC0 |
| craft-anything `assets/anim.glb` | 10 động tác (đứng, đi, chạy, lái xe…) dùng chung khung xương 65 xương | CC0 (Quaternius) |
| craft-anything `assets/signs.json` | Tên quán xá có thật trên biển hiệu (đã bỏ chuỗi thương hiệu) | ODbL |

CI tải craft-anything ở commit ghim sẵn (`CRAFT_REF` trong `.github/workflows/web.yml`), không chép
tài nguyên vào repo vncity.

## 3. Lối chơi

- **Hộ chiếu du lịch**: 33 điểm có cột sáng (xanh: địa danh, cam: món ăn, hồng: văn hoá). Đi tới là
  đóng dấu và hiện thẻ giới thiệu. Đủ dấu nhận chứng nhận "Người Hà Nội danh dự", có nút chia sẻ.
  Tiến độ lưu trong trình duyệt.
- **Mũi tên vàng** chỉ điểm chưa đến gần nhất; bản đồ nhỏ xoay theo camera.
- **Xe ôm đi nhanh**: bản đồ lớn (M), bấm vào điểm nào thì tới ngay điểm đó.
- **Xe máy** (F): lên xe, chạy trên phố cùng dòng xe máy; xe máy khác bóp còi và dừng khi bạn chắn đường.
- **Chú chó vàng Bơ** đi theo; khách đi dạo trên các lối đi bộ quanh hồ.
- **Bốn thời điểm** (N): sáng, chiều, hoàng hôn, đêm. Đêm thì phố Hàng Mã sáng đèn lồng, cửa hàng hắt
  đèn ra phố.
- **Song ngữ** (L), **điện thoại**: cần điều khiển bên trái, vuốt bên phải để nhìn.
- **Chất lượng** (nút ⚙️ hoặc `?q=low`): bản thấp tắt khử răng cưa, giảm bóng, ít xe và người hơn.

## 4. Chạy trên máy

```sh
cd web
npm ci
CRAFT_DIR=/đường/dẫn/craft-anything npm run assets   # ra web/public/assets (khoảng 21 MB)
npm run dev                                         # mở http://localhost:5173
npm run build && npm test                           # build vào web/dist và kiểm thử khói trong Chromium
```

Tham số đường dẫn để chụp ảnh và dò lỗi: `?time=night|sunset|morning|afternoon`, `?street=Phố Hàng Mã`,
`?at=x,z` (mét, gốc ở Hồ Gươm, x hướng đông, z hướng nam), `?yaw=1.6`, `?lang=en`, `?shot` (bỏ màn hình
chào, dùng cho kiểm thử).

## 5. Cấu trúc mã

| Tệp | Việc |
|---|---|
| `web/src/city.js` | Đọc bản đồ OSM, dựng nền, đường, hồ và kè đá, nhà ống (mặt tiền vẽ bằng canvas, tầng trệt là cửa hàng), mái, va chạm, đồ thị đường, bản đồ nhỏ |
| `web/src/textures.js` | Vẽ mặt tiền nhà ống, cửa hàng, nhà cao tầng và bản đèn đêm tương ứng |
| `web/src/props.js` | Đặt công trình thật đúng chỗ (theo cách của craft-anything), đèn lồng Hàng Mã, đèn đường mỗi 30 m, lan can hồ, bàn ghế nhựa, biển hiệu, cây |
| `web/src/actors.js` | Minh (đi bộ, xe máy), dòng xe máy, khách đi dạo, chó Bơ |
| `web/src/tour.js` | Hộ chiếu du lịch, cột sáng, đóng dấu |
| `web/src/main.js` | Renderer, bầu trời, thời điểm trong ngày, camera, điều khiển, giao diện |
| `web/tools/build_assets.mjs` | Đóng gói tài nguyên từ craft-anything và vncity |
| `web/tools/smoke.mjs` | Kiểm thử khói bằng Playwright |

## 6. Giới hạn hiện tại

- Mặt tiền nhà là ảnh vẽ bằng canvas, chưa dùng các mô-đun mặt tiền 3D của craft-anything
  (`mat_tien_*.glb`); đây là việc đáng làm tiếp nhất để phố cổ thật hơn.
- Nhà hát Lớn, Nhà thờ Lớn, Ô Quan Chưởng mới là khối nhà theo bản đồ, chưa có mô hình riêng.
- Chưa có nhạc nền; tiếng phố là âm thanh tổng hợp (tiếng xe xa, còi xe máy).
- Bản đồ chỉ gồm quận Hoàn Kiếm (khung bản đồ của craft-anything). 12 quận nội thành của vncity có thể
  nối vào sau theo từng ô.
