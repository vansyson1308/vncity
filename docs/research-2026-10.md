# Nghiên cứu: từ khung bản đồ đến Hà Nội góc nhìn thứ ba (10/2026)

Mục tiêu: người chơi đi bộ trong game có cảm giác như đang ở Hà Nội thật, chân thật hơn
bản demo Project Long Quân. Tài liệu này tổng hợp ba hướng nghiên cứu và chốt lựa chọn công nghệ.
Những điểm chưa kiểm chứng được đánh dấu **[chưa kiểm chứng]**.

## 1. Google Earth không phải đích để nhắm tới

- Ảnh 3D của Google Earth dựng bằng photogrammetry từ ảnh máy bay, tối ưu cho góc nhìn trên cao.
  Xuống mặt đất thì mặt tiền bị "chảy", xe và cây dính vào mesh. Cảm giác chân thật ở mặt đất mà
  ta thấy khi zoom sát là từ **Street View**, vốn là ảnh toàn cảnh 2D chứ không phải mô hình 3D.
- Cả hai đều bị chính sách Map Tiles API cấm trích xuất, lưu offline hay dựng mô hình dò theo.
- Kết luận: độ chân thật ở mặt đất phải đến từ **khảo sát mặt đất của chính mình** cộng với
  hệ thống sinh nội dung theo quy tắc, giống cách các game thật làm.

## 2. Game thật dựng thành phố thật như thế nào

| Dự án | Cách làm |
| --- | --- |
| The Matrix Awakens / City Sample (Epic) | Houdini sinh ~7.000 tòa từ mô-đun; 260 km đường, 512 km vỉa hè; texture Quixel cộng bẩn thủ tục |
| Marvel's Spider-Man | Công cụ Houdini sinh mặt đất, nhà, giao thông, cảnh phố |
| Forza Horizon 5 / 6 (Tokyo) | Photogrammetry tại chỗ, chuyên gia địa phương, đường nhiều tầng sinh thủ tục |
| Saigon Alley (Lenz Monath, Fab) | Quét RealityScan, kit mô-đun, decal quét, dây điện đặt tay, MegaLights. Gần nhất với phong cách ta cần |

Không game nào quét nguyên cả thành phố. Công thức chung: **bố cục thật + kit asset quét thật +
sinh thủ tục + vài con phố "hero" làm tay + lớp sự sống (xe, người, âm thanh)**.

## 3. Công nghệ chốt

| Hạng mục | Lựa chọn | Lý do |
| --- | --- | --- |
| Engine | **Unreal Engine 5.8** (6/2026, bản UE5 cuối) | MegaLights, Lumen, Nanite, PCG production-ready, Mass được làm lại |
| Sinh phố | **PCG + đồ thị City Sample PCG** (cập nhật 27/8/2026) + **PCGEx** (MIT) | City Sample có sẵn chuỗi Roads → Lots → Sidewalks → Buildings; ta thay bước sinh bố cục bằng dữ liệu thật của `vncity` |
| Điều khiển editor từ Claude Code | **Unreal MCP chính thức của Epic** (UE 5.8, Experimental) + **ChiR24/Unreal_mcp** (MIT) cho PCG, import, Python | Epic có sẵn lệnh sinh cấu hình cho Claude Code; ChiR24 bổ sung phần docs của Epic chưa nói rõ |
| Mặt tiền | Kit mô-đun nhà ống / biệt thự Pháp / khu tập thể tự quét bằng **RealityScan** (miễn phí dưới 1 triệu USD doanh thu) | Kit quét thật là nguồn chân thật lớn nhất; chưa có pack Hà Nội trên Fab |
| Phố hero | Photogrammetry đã làm sạch, Nanite | Vài con phố nơi diễn ra nhiệm vụ chính |
| Gaussian Splatting | Chỉ dùng cho cảnh xa, tham chiếu look-dev | Ánh sáng nướng sẵn, không va chạm, không đổ bóng; plugin UE đều thử nghiệm hoặc ngừng phát triển |
| Giao thông xe máy | **Mass** tự viết processor đi lệch làn, chen khe; hiệu chỉnh offline với **SUMO sublane model** | Không có hệ thống nào làm sẵn được "bầy xe máy" Hà Nội |
| Người đi bộ | MassCrowd / MetaHuman Crowd (Experimental ở 5.8) | |

Không chọn: CityEngine (thuê từ 2.200 USD/năm, chưa có bản cho 5.8), Houdini (chỉ cần nếu
họa sĩ muốn, PCG đã làm được), CARLA (mô phỏng xe tự lái, quá nặng cho game).

## 4. Vai trò của repo này

`vncity` cung cấp **bố cục thật** cho bước PCG:

- `build.py` xuất footprint, chiều cao kèm nguồn gốc, dải đường theo cấp, **vỉa hè** và
  **"công thức mặt tiền"** từng tòa: cạnh nào quay ra phố, giáp loại đường nào, bao nhiêu tầng.
  Đây đúng là đầu vào mà grammar mặt tiền của PCG cần.
- `viewer/walk.html` là bản chơi thử góc nhìn thứ ba trên trình duyệt, dựng từ đúng dữ liệu đó.
  Dùng để kiểm tra bố cục, tỷ lệ, cảm giác đi bộ trước khi đưa vào Unreal. Nó không nhắm tới
  chất lượng hình ảnh cuối cùng.

## 5. Khảo sát một đoạn phố ~500 m (thí điểm)

- Thiết bị: máy ảnh full-frame + ống 24 mm, sào carbon 5–7 m (với tới tầng trên nhà ống),
  Insta360 X5 (~550 USD), bảng màu. Máy xử lý RTX 5090 32 GB, 128 GB RAM. **[giá ước lượng]**
- Khối lượng: ~3.000–5.000 ảnh mặt tiền và chi tiết; ~40 phút video 360 cho splat tham chiếu.
- Nhân sự: 3 người (chụp, sào/360, người địa phương lo xin phép và trông xe). 2 buổi sáng sớm
  cuối tuần + 1 buổi chụp bù. Xử lý ~4 tuần. **[thời gian ước lượng]**
- Pháp lý (không phải tư vấn pháp lý, cần luật sư xác nhận):
  - Drone: Nghị định 288/2025/NĐ-CP. Cần đăng ký, chứng chỉ, giấy phép bay của Bộ Quốc phòng.
    Thuê đơn vị có phép hoặc bỏ chụp mái, dùng footprint + mái sinh thủ tục.
  - Hình ảnh cá nhân: Bộ luật Dân sự 2015 Điều 32; Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15
    (hiệu lực 1/1/2026) Điều 32. Che mặt người và biển số trước khi dựng, xóa dữ liệu thô sau khi
    xong, xin phép UBND phường và chủ nhà có mặt tiền, biển hiệu nhận diện rõ.
  - Xe máy dùng thiết kế chung chung, không dùng logo hay kiểu dáng đặc trưng của hãng.

## 6. Thứ tự làm

1. Cài UE 5.8, City Sample, Unreal MCP + ChiR24/Unreal_mcp; nối Claude Code.
2. Viết importer: `manifest.json` + `bld_*.json` → spline footprint (có `MaxHeight`, số tầng,
   cạnh mặt tiền) và spline đường (cấp, độ rộng) làm đầu vào PCG.
3. Thay grammar nhà Mỹ của City Sample bằng kit nhà ống Hà Nội (bản đầu dùng kit tạm).
4. Thí điểm khảo sát một đoạn phố Cầu Giấy, dựng kit quét đầu tiên.
5. Mass motorbike traffic.

## 7. Ảnh đường phố thật

**Khổ:** ở mặt đất, phố chưa giống Hà Nội. **Tập:** ta có hình học nhưng không có diện mạo thật
của từng mặt tiền. **Diệt:** có ảnh thật cho từng mặt tiền. **Đạo:** ảnh đường phố mở, biết tư thế
máy ảnh, rồi chiếu lên đúng bức tường hoặc dựng lại 3D từ ảnh.

| Nguồn | Giấy phép | Cầu Giấy | Ghi chú |
| --- | --- | --- | --- |
| Google Street View | Điều khoản Google cấm tải, lưu, dựng lại, kể cả phi thương mại | – | Không dùng |
| KartaView | CC BY-SA 4.0 | 344 ảnh, 107 ảnh cầu 360° (2019–2023) | Đã tích hợp; GPS điện thoại, 67/107 ảnh không có hướng |
| Mapillary | CC BY-SA 4.0 | 4.319 ảnh 360°, 2.068 có tư thế SfM (2022–2025) | Đã tích hợp (`streetview.py mapillary`); tư thế SfM lấy được qua tileset `mly1_computed_public`, nhưng Graph API chưa trả ảnh với token hiện tại |
| Panoramax | Mở | 0 ảnh | – |
| Wikimedia Commons | CC, theo từng ảnh | Có ảnh gắn tọa độ quanh Chùa Hà | Ảnh lẻ, không đủ cho dựng mặt tiền |

Kết quả đo được: kéo ảnh về làn đường và lấy hướng từ chuỗi / la bàn / bầu trời đã giúp chiếu
được ảnh thật lên 297 tòa, nhưng ảnh chưa nắn thẳng vào mặt tường. Gốc rễ còn lại là **tư thế
máy ảnh chưa đủ chính xác** (cần cỡ 0,5 m và 1–2°, đang ở mức vài mét và vài độ). Thứ tự xử lý:

1. Mapillary (11/10/2026): đã tìm được 4.319 ảnh 360° trong Cầu Giấy qua vector tile, 2.068 ảnh
   có tư thế SfM. SfM dời vị trí trung vị 2,0 m so với GPS. Graph API v4 trả `{"data": []}` cho mọi
   truy vấn ảnh (theo bbox, theo id, kể cả ở Paris) với token hiện tại, nên chưa có
   `thumb_original_url` để tải ảnh. Việc tiếp theo: bật quyền read cho ứng dụng Mapillary, tải ảnh,
   rồi dùng `streetview.py check` xem tường có nằm đúng trên ảnh không. Nếu tọa độ SfM vẫn lệch
   cỡ mét so với footprint, căn thêm bằng `computed_rotation` và đám mây điểm `sfm_cluster`.
2. Chạy SfM (OpenSfM/COLMAP) trên các chuỗi KartaView để căn tương đối giữa các ảnh, rồi căn
   cả đám điểm vào footprint.
3. Tự chụp: một vòng xe máy với Insta360 (GPS + IMU) qua Cầu Giấy, xử lý bằng cùng pipeline.
   Dự án phi thương mại, riêng tư; vẫn nên làm mờ mặt người và biển số như KartaView.

## Nguồn

- https://developers.google.com/maps/documentation/tile/policies
- https://www.sidefx.com/learn/talks/the-matrix-awakens-generating-a-world/
- https://80.lv/articles/marvels-spider-man-a-technical-postmortem
- https://80.lv/articles/creating-an-environment-to-capture-the-atmosphere-of-the-back-alleys-of-vietnam
- https://dev.epicgames.com/documentation/unreal-engine/city-sample-pcg-for-unreal-engine?lang=en-US
- https://www.unrealengine.com/learning/city-sample-gets-a-major-update-with-pcg-and-unreal-mcp-workflows
- https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor?lang=en-US
- https://github.com/EpicGames/unreal-engine-skills-for-claude-code-plugin
- https://github.com/ChiR24/Unreal_mcp
- https://github.com/PCGEx/PCGExtendedToolkit
- https://www.unrealengine.com/news/unreal-engine-5-8-is-now-available
- https://www.realityscan.com/license
- https://arxiv.org/html/2406.12080v1
- https://radiancefields.com/yags-yandex-open-sources-a-3dgs-plugin-for-unreal-engine-5.5%E2%80%935.7
- https://sumo.dlr.de/docs/Simulation/SublaneModel.html
- https://www.cgchannel.com/2026/07/esri-releases-cityengine-2026/
- https://english.luatvietnam.vn/decree-no-288-2025-nd-cp-dated-november-5-2025-of-the-government-providing-the-management-of-unmanned-aircraft-and-other-aerial-vehicles-418028-doc1.html
- https://hethongphapluat.com/luat-bao-ve-du-lieu-ca-nhan-2025/dieu-32
- https://wiki.openstreetmap.org/wiki/KartaView
- https://www.mapillary.com/developer/api-documentation
