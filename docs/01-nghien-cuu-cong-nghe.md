# Nghiên cứu công nghệ (tháng 10/2026)

Mục tiêu của tài liệu: chọn đúng công nghệ để dựng một Hà Nội nhận ra ngay, theo cách một studio
cỡ Rockstar làm GTA5, nhưng chỉ dùng dữ liệu và công cụ mà ta được phép đưa vào game.
Các điểm chưa chắc chắn được đánh dấu **[cần kiểm tra]**. Đây không phải tư vấn pháp lý.

## 1. GTA5 thực sự được làm thế nào

- Los Santos **không** được import từ dữ liệu bản đồ. Rockstar dựng tay một Los Angeles đã được
  "nén" lại, dựa trên thư viện ảnh tham chiếu khổng lồ (khoảng 250.000 ảnh, theo phỏng vấn 2013).
  Quét 3D chỉ dùng cho đạo cụ, vật liệu và nhân vật.
- Thế giới được cắt thành ô (map sector), mỗi ô có nhiều mức LOD và một bản "SLOD" siêu nhẹ cho
  tầm xa. Giao thông, người đi đường, nhiệm vụ đều chạy bằng dữ liệu và script.
- Bài học cho Hà Nội: **giữ đúng tuyệt đối** hình dáng các công trình biểu tượng và mạng lưới phố,
  rồi lấp phần còn lại bằng nhà ống sinh thủ tục (procedural) với tỉ lệ đúng: mặt tiền khoảng 4 m,
  4-6 tầng, ban công, biển hiệu, bó dây điện. Pipeline của ta làm đúng điều đó, nhưng **không nén**
  bản đồ: tỉ lệ 1:1 lấy từ dữ liệu thật. Nếu sau này cần nén để gameplay nhanh hơn, ta làm ở
  tầng dữ liệu chứ không vẽ lại.

## 2. Dữ liệu thành phố được phép dùng

| Nguồn | Giấy phép | Đưa vào game thương mại? | Ghi chú Hà Nội |
| --- | --- | --- | --- |
| **Overture Maps** (release 2026-09-23.0, đang dùng) | Buildings, Transportation, Base, Divisions: ODbL. Một số nguồn con CC BY 4.0. Places phần lớn CDLA-Permissive 2.0 | Có, ghi công từng nguồn | Lớp footprint gộp tốt nhất cho Hà Nội. Chiều cao còn rất thiếu (xem mục 6) |
| **OpenStreetMap** | ODbL 1.0 | Có (game là "Produced Work") | Đường và công trình biểu tượng tốt ở Hoàn Kiếm, Ba Đình |
| **Google Open Buildings 2.5D Temporal** | CC BY 4.0 hoặc ODbL | Có | Raster chiều cao 4 m, đủ cho khối, không đủ cho mặt tiền. Phủ Việt Nam **[cần kiểm tra]** |
| **Copernicus DEM GLO-30** | Miễn phí, cần ghi công | Có | Hà Nội gần như phẳng; đê sông Hồng và dốc cầu Long Biên nên nặn tay |
| **Mapillary / KartaView** | Ảnh CC BY-SA 4.0 | **Chỉ làm tham chiếu**, không cắt ảnh làm texture | Hoàn Kiếm có nhiều ảnh nhờ đợt map Hà Nội 2024 |
| **GlobalBuildingAtlas** (TUM) | CC BY-NC 4.0 | **Không** (cấm thương mại) | Chỉ để so sánh |
| **Google Street View / Earth / Photorealistic 3D Tiles** | Điều khoản Google Maps Platform | **Không** | Xem mục 3 |
| **GTFS Hà Nội** (World Bank, 2020) | CC BY 4.0 | Có | Cũ nhưng dùng được cho tuyến buýt |

**ODbL trong game.** Game render ra là "Produced Work": chỉ cần ghi "© OpenStreetMap contributors"
(và các nguồn khác) trong màn hình credits; mã và art của game **không** bị lây share-alike.
Riêng cơ sở dữ liệu đã xử lý (ví dụ đồ thị đường `traffic/graph.json` nằm trong bản phát hành)
có thể bị coi là Derivative Database, nên ta luôn giữ script tái tạo nó công khai được. Pipeline
này chính là script đó.

## 3. Vì sao không dùng ảnh Google, kể cả để "vẽ lại y hệt"

Điều khoản Map Tiles API và hướng dẫn thương hiệu của Google cấm: lưu cache hay tải về ngoài
header cho phép, dùng offline, trích xuất dữ liệu địa lý, **số hóa hay vẽ theo (trace) Street View**,
và dùng Google Earth để **dựng lại mô hình 3D**. Vật thể của ta chỉ được đặt chồng lên tile nếu
"không được trích xuất, vẽ theo hay suy ra bằng tay hay bằng máy" từ chúng.

Hệ quả cho mong muốn "y hệt Street View":
- Được: mở Street View để **xem và cảm nhận** khi thiết kế, stream Google 3D Tiles trong editor như
  phông nền tham chiếu (có ghi công, có tính phí), không bao giờ đóng gói vào game.
- Không được: dựng mesh, cắt texture, đo vẽ mặt tiền từ ảnh Google.
- Cách đạt "y hệt" hợp pháp: **tự chụp** (một buổi đi bộ phố cổ với điện thoại là đủ cho
  photogrammetry đạo cụ và vật liệu), Mapillary làm tham chiếu, Wikimedia Commons cho công trình
  biểu tượng.

## 4. Công cụ sinh thành phố

- **UE5 PCG**: production-ready từ UE 5.7; UE 5.8 thêm chỉnh tay trên kết quả sinh, sinh nhà và
  phố. Đây là đích của pipeline: ta xuất **điểm và thuộc tính** (CSV/JSON) cho PCG đọc.
- **Houdini + SideFX Labs OSM**: chuẩn công nghiệp, nhưng trả phí (Indie rẻ). Không bắt buộc.
- **OSM2World** (mã mở, xuất glTF, 250+ tag OSM, nhiều LOD): tham khảo tốt cho mái và đường.
- **Blosm / BlenderGIS**: tiện để xem nhanh, không phải pipeline sản xuất.
- **Esri vitruvio** (CityEngine trong UE): cần giấy phép CityEngine thương mại. Bỏ qua.
- **Infinigen**: chưa có bộ sinh thành phố.

Kết luận: tự viết pipeline Python (Overture → schema riêng → glTF + điểm PCG), vì không công cụ
nào hiểu nhà ống, khu tập thể hay biển hiệu Hà Nội. Đó là phần `pipeline/` của repo.

## 5. Tái dựng bằng ảnh: Gaussian Splatting và photogrammetry

- **3D Gaussian Splatting trong UE5** vẫn là plugin bên thứ ba (YaGS của Yandex, Apache 2.0, UE
  5.5-5.7; Luma; XV3DGS; Volinga cần bản Pro để đóng gói). Hạn chế: ánh sáng xấp xỉ, cần mesh
  va chạm riêng, chưa chạy với Nanite, chưa chứng minh được ở quy mô thành phố.
  → Dùng cho **cảnh điện ảnh và công trình biểu tượng** (Tháp Rùa, Nhà hát Lớn), không cho cả thành phố.
- **RealityScan 2.0** (RealityCapture đổi tên): miễn phí khi doanh thu dưới 1 triệu USD/năm.
  COLMAP (BSD), Meshroom (MPL-2.0); OpenMVS là AGPL, chỉ dùng như công cụ.
  → Quy trình: tự chụp xe máy, gánh hàng rong, ghế nhựa, cột điện, mặt tiền mẫu → RealityScan →
  Nanite mesh.

## 6. Cấu trúc kỹ thuật một thế giới mở cỡ GTA5 trên UE5

| Hệ thống | Công nghệ UE 5.8 | Ghi chú cho Hà Nội |
| --- | --- | --- |
| Streaming | World Partition, Data Layers, One File Per Actor; plugin Fast Geometry Streaming (thử nghiệm) | Ô 500 m của pipeline khớp lưới World Partition |
| LOD xa | Nanite cho kiến trúc, HLOD cho ô xa | Xe và nhân vật vẫn cần LOD cổ điển |
| Ánh sáng | Lumen / Lumen Lite, **MegaLights** (production) | Hà Nội ban đêm: hàng nghìn đèn biển hiệu |
| Giao thông, đám đông | Mass (MassEntity, MassAI, MassCrowd), ZoneGraph; MetaHuman Crowds (thử nghiệm) | Dòng xe máy Hà Nội không đi theo làn: cần mô hình bầy đàn / sub-lane riêng trên Mass. SUMO 1.27 (sublane, xe máy) dùng để hiệu chỉnh mật độ |
| Nhiệm vụ | StateTree, Gameplay Tags, DataTable | Nhiệm vụ của ta là JSON → DataTable, xem `game/` |
| Bản đồ thật | Cesium for Unreal 2.29 (UE 5.6-5.8) | Chỉ để tham chiếu vị trí, không ship tile Google |

City Sample (Matrix Awakens) miễn phí nhưng giấy phép chỉ dùng trong sản phẩm Unreal
**[cần kiểm tra EULA Fab]**: dùng làm mẫu code Mass/ZoneGraph, không dùng art Mỹ của nó.

## 7. So sánh engine

| Engine | Chất lượng thành phố photoreal | Chi phí | Kết luận |
| --- | --- | --- | --- |
| **Unreal Engine 5.8** | Tốt nhất: Nanite, Lumen, MegaLights, PCG, World Partition, MetaHuman, Mass | 5% doanh thu trên 1 triệu USD/sản phẩm | **Chọn** |
| Unity 6.3 LTS (HDRP) | Đẹp được nhưng thiếu Nanite/Lumen/World Partition tương đương | Pro 2.310 USD/ghế/năm | Kém UE ở quy mô thành phố |
| Godot 4.7 | Chưa có hình học ảo hóa hay GI động cấp thành phố | Miễn phí, MIT | Chưa đủ |
| O3DE 26.05 | Renderer Atom, hệ sinh thái nhỏ | Miễn phí | Không cạnh tranh |
| Bevy 0.19 | Không có editor | Miễn phí | Mức nghiên cứu |

UE 5.8 là bản lớn cuối dự kiến của UE5; UE6 Early Access dự kiến cuối 2027. Vì toàn bộ tài
nguyên của ta là dữ liệu trung lập (glTF, JSON, CSV), chuyển sang UE6 sau này chỉ cần sửa harness.

**Kết nối Claude với UE5:** UE 5.8 có plugin MCP chính chủ (thử nghiệm). Cộng đồng có
`chongdashu/unreal-mcp`, `ChiR24/Unreal_mcp`, `runreal/unreal-mcp`, `flopperam/unreal-engine-mcp`.
Harness của ta không phụ thuộc vào MCP: mọi thao tác import là script Python editor, nên Claude
gọi qua MCP hay người bấm chạy đều như nhau.

## 8. Riêng cho Hà Nội

- Độ đầy đủ OSM: đường và công trình biểu tượng tốt; footprint từng thửa và chiều cao rất thiếu.
  Đo thực tế trên khung Hoàn Kiếm (Overture 2026-09-23.0): 17.688 tòa nhà, chỉ **21 tòa có chiều
  cao đo được, 216 tòa có số tầng**, còn lại 98,7% phải ước lượng. Vì vậy pipeline ước lượng theo
  **kiểu nhà Hà Nội** thay vì theo diện tích thuần.
- Không có mô hình LOD2 mở của Hà Nội.
- Metro: tuyến 2A Cát Linh - Hà Đông chạy; tuyến 3 đoạn trên cao Nhổn - Cầu Giấy chạy từ 8/2024,
  đoạn ngầm dự kiến cuối 2027.
- Thời tiết thời gian thực: Open-Meteo dữ liệu CC BY 4.0 nhưng **API miễn phí cấm thương mại**.
  Game phát hành cần gói trả phí, hoặc dùng khí hậu "nướng sẵn" (mùa mưa, mưa phùn, nồm) từ dữ
  liệu lịch sử. Harness hỗ trợ cả hai.
- Tài sản: Poly Haven, ambientCG là CC0, dùng thoải mái. Xe máy Việt (Wave, Vision, Air Blade)
  không có model CC0 tốt: tự làm, và **đổi tên thương hiệu kiểu GTA** để tránh vấn đề nhãn hiệu.
- Lăng Bác và các địa điểm chính trị: khắc họa trang trọng, không đưa gameplay chế giễu
  **[cần kiểm tra quy định trước khi phát hành]**.

## Nguồn

- Google Map Tiles API policies: https://developers.google.com/maps/documentation/tile/policies
- Cesium terms for Google content: https://cesium.com/legal/terms-for-google/
- Google geo guidelines: https://about.google/brand-resource-center/products-and-services/geo-guidelines/
- OSMF Produced Work guideline: https://osmfoundation.org/wiki/Community_Guidelines/Produced_Work_-_Guideline
- Overture attribution: https://docs.overturemaps.org/attribution/
- Google Open Buildings Temporal: https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_Research_open-buildings-temporal_v1
- GlobalBuildingAtlas: https://gee-community-catalog.org/projects/gba/
- Mapillary licenses: https://help.mapillary.com/hc/en-us/articles/115001770409-Licenses
- Cesium for Unreal releases: https://github.com/CesiumGS/cesium-unreal/releases
- UE 5.7: https://www.unrealengine.com/news/unreal-engine-5-7-is-now-available
- UE 5.8: https://www.unrealengine.com/news/unreal-engine-5-8-is-now-available
- City Sample: https://www.fab.com/listings/4898e707-7855-404b-af0e-a505ee690e68
- OSM2World: https://osm2world.org/
- vitruvio: https://github.com/Esri/vitruvio
- SideFX OSM: https://www.sidefx.com/tutorials/city-building-with-osm-data/
- YaGS: https://radiancefields.com/yags-yandex-open-sources-a-3dgs-plugin-for-unreal-engine-5.5%E2%80%935.7
- So sánh plugin splat: https://www.worldlabs.ai/labs/learn/unreal-splat-plugins
- RealityScan license: https://www.realityscan.com/license
- SUMO 1.27.1: https://zenodo.org/records/20836073
- CARLA: https://github.com/carla-simulator/carla/releases
- Unity pricing: https://unity.com/runtime-fee
- Godot: https://godotengine.org/blog/release
- Hanoi/HCMC OSM mapping: https://community.openstreetmap.org/t/hanoi-and-ho-chi-minh-city-mapping-collaboration/109534
- Biljecki 2020: https://ual.sg/post/2020/09/12/new-paper-exploration-of-open-data-in-southeast-asia-to-generate-3d-building-models/
- World Bank Hanoi GTFS: https://datacatalog.worldbank.org/search/dataset/0038236/hanoi-vietnam-general-transit-feed-specification-gtfs
- Hanoi Metro Line 3: https://en.wikipedia.org/wiki/Hanoi_Metro_Line_3
- Open-Meteo terms: https://open-meteo.com/en/terms
- Unreal MCP (cộng đồng): https://github.com/chir24/unreal_mcp
