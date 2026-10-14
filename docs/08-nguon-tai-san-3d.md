# Nguồn tài sản 3D: dùng lại trước, tự làm sau (tháng 10/2026)

Mục tiêu: với từng key trong `game/assets/asset_specs.json`, tìm asset có sẵn, miễn phí hoặc mở,
đưa được vào một game UE 5.8 có thể bán thương mại. Chỉ khi không có mới sinh bằng AI hoặc dựng tay.
Mọi asset nhận vào đều phải có một dòng trong `game/assets/sources.json`, gồm source, author,
licence và url. Các điểm chưa chắc được đánh dấu **[cần kiểm tra]**. Đây không phải tư vấn pháp lý.

## 0. Kết luận nhanh

1. **Không có kho nào có sẵn "Hà Nội".** Gần như mọi thứ đặc trưng đều phải tự làm: nhà ống, cột
   điện chữ H, xe máy kiểu Việt, gánh hàng, biển hiệu. Kho mở chỉ lấp được phần chung chung, như vật
   liệu, ghế nhựa, ghế đá, đèn và đồ lặt vặt.
2. **Vật liệu là phần dùng lại tốt nhất.** Poly Haven và ambientCG là CC0, có đủ thạch cao, sơn
   bong, ngói đất nung, bê tông và nhựa đường. Megascans đã nhận trên Fab cũng dùng được.
3. **Epic cho nhiều thứ, nhưng phần lớn chỉ dùng được trong UE.** City Sample (nhà modular,
   13 xe, đám đông) và MetaHuman đều hợp lệ cho game UE thương mại. Phong cách của chúng là Mỹ, nên
   chỉ hợp làm khung hoặc xe hơi nền.
4. **Sketchfab có vài model Việt Nam CC-BY đáng xem**: Tháp Rùa, cầu Long Biên, xe bánh mì, xe hủ
   tiếu, xe nước, nhà Việt. Hầu hết là low-poly hoặc không rõ nguồn gốc. Chỉ nên làm blockout hay
   tham chiếu, sau khi đã xác minh tác giả.
5. **Cây nhiệt đới đúng loài (xà cừ, sấu, hoa sữa…) không có bản miễn phí.** Megaplants chỉ có loài
   ôn đới. Hướng đi: Procedural Vegetation Editor của UE 5.7+ (experimental) hoặc dựng bằng Blender,
   kết hợp texture lá và vỏ tự chụp.
6. **Đường sinh AI dùng được, có điều kiện.** Nên dùng TRELLIS.2 (MIT) hoặc TripoSG (MIT).
   **Không** dùng Hunyuan3D cho game bán ở EU hay UK. Phải lưu ý `nvdiffrast` (NVIDIA, giấy phép
   chỉ cho phi thương mại) nằm trong pipeline texture của TRELLIS.2.
7. **Bộ kit mặt tiền (13 archetype) nên dựng tay theo lưới module**, dùng trim sheet và vật liệu
   CC0. AI image-to-3D cho ra mesh liền khối, không chia module được.

## 1. Thang giấy phép áp dụng cho dự án

| Mức | Giấy phép | Dùng trong game bán? | Nghĩa vụ |
| --- | --- | --- | --- |
| A | CC0 / Public Domain | Có | Không có (vẫn ghi `sources.json`) |
| A | Fab Standard License (kể cả Megascans và đồ free trên Fab) | Có, ở mọi engine | Không cần ghi công. Không phân phối lại asset thô. Phải chọn đúng tier Personal (doanh thu ≤ 100k USD/12 tháng) hay Professional |
| A | Epic Content License, loại "UE-Only Content" | Có, **chỉ trong sản phẩm dựa trên UE** | Asset phải nằm trong bản build dạng object code. Không bán lẻ asset |
| B | CC BY 4.0 | Có | Ghi công ở màn hình credits và ghi rõ đã chỉnh sửa. Xem cảnh báo DRM ở mục 8 |
| B | Royalty Free của BlenderKit, CGTrader, TurboSquid | Có, nếu asset không bị đánh dấu Editorial | Không bán lại asset ở dạng gốc. TurboSquid còn yêu cầu asset trong game không trích ra được dễ dàng |
| C | CC BY-SA | Tránh dùng | Bản chỉnh sửa phải phát hành theo cùng giấy phép |
| ✗ | CC BY-NC, CC BY-ND, NC-ND, "Editorial", "Personal use" | **Không** | Không dùng, kể cả làm placeholder trong repo |

Quy tắc của repo: asset mức C và ✗ không được commit. Tham chiếu ảnh thì theo
`docs/09-anh-tham-chieu.md`.

## 2. Fab và Epic

### 2.1 Megascans trên Fab
- Từ cuối 2024, Megascans chuyển sang Fab. Asset nào đã **thêm vào thư viện Fab** trước khi ưu đãi
  miễn phí kết thúc thì dùng vĩnh viễn theo **Fab Standard License**, ở mọi engine
  ([CG Channel](https://www.cgchannel.com/2024/10/epic-games-has-made-megascans-free-to-all-but-only-until-the-end-of-2024/)).
- Từ 2025, phần lớn Megascans phải trả tiền. Giá khởi điểm khoảng 0,99 USD cho một asset và 24,99 USD
  cho một pack. Một số bộ vẫn miễn phí. Bản tải bằng Bridge theo Epic Content License cũ là loại
  **UE-only**. Với dự án này điều đó chấp nhận được.
- **Việc cần làm ngay:** kiểm tra tài khoản Epic của chủ dự án xem đã "claim" Megascans năm 2024
  chưa **[cần kiểm tra]**. Nếu có rồi, toàn bộ thư viện bề mặt (thạch cao, bê tông, nhựa đường, gạch,
  rêu) và decal (vết bẩn, vết nứt, rác) đã có sẵn và hợp lệ.
- Fab cấm dùng asset gắn tag NoAI làm đầu vào cho AI tạo sinh. Vì vậy đừng đưa ảnh render Megascans
  vào image-to-3D, trừ khi đã kiểm tra tag
  ([Fab licences](https://dev.epicgames.com/documentation/fab/licenses-and-pricing-in-fab),
  [Epic Content EULA](https://www.unrealengine.com/eula/content)).

### 2.2 Đồ miễn phí theo đợt trên Fab
- Fab tặng vài pack vào thứ Ba tuần thứ nhất và thứ ba mỗi tháng. Đã nhận trong hai tuần đó thì giữ
  vĩnh viễn. Một số pack mới chỉ cấp **Personal License**, nên phải đọc tier trước khi nhận
  ([GameFromScratch](https://gamefromscratch.com/massive-changes-to-the-unreal-engine-fab-marketplace-giveaways/),
  [trang free của Epic](https://www.unrealengine.com/fabfreecontent)).
- Nên giao một người kiểm tra mỗi hai tuần, tìm đồ châu Á, đồ phố và cây nhiệt đới.

### 2.3 Sample project của Epic

| Gói | Giấy phép | Có gì dùng được cho Hà Nội |
| --- | --- | --- |
| [City Sample Buildings](https://www.fab.com/listings/008fe959-5511-428e-93bd-f99b1179f6d5) | UE-Only Content, miễn phí | Hơn 2.000 mảnh nhà modular (tầng trệt, tầng giữa, góc, lối vào). Phong cách Mỹ. Dùng được cho `van_phong_cao_tang` và `chung_cu_cao_tang`, cũng như học cách chia module |
| City Sample (project đầy đủ, kèm City Sample Vehicles) | UE-only, thương mại được ([CG Channel](https://www.cgchannel.com/2022/04/download-epic-games-free-city-sample-assets-for-ue5)) | 13 xe lái được: sedan, pickup, xe tải, taxi, **bus**, van. Hệ thống MassTraffic, MassCrowd và nhân vật đám đông. Không có xe máy, xích lô hay đồ phố châu Á |
| [Electric Dreams](https://dev.epicgames.com/documentation/unreal-engine/electric-dreams-environment-in-unreal-engine) | UE-only **[cần kiểm tra trên listing]** | Đồ thị PCG mẫu, rừng ôn đới. Đáng học PCG, không hợp về thực vật |
| Megaplants ([Quixel](https://quixel.com/news/quixel-on-fab-new-megascans-and-megaplants)) | Fab Standard, miễn phí | Cây Nanite đẹp nhưng chỉ có loài **ôn đới** (sồi, thông…) |
| MetaHuman | Từ UE 5.6, dùng được ở engine khác và bán được ([CG Channel](https://www.cgchannel.com/2025/06/you-can-now-sell-metahumans-or-use-them-in-unity-or-godot/)) | Nhân vật chính và NPC gần camera. Trang phục Việt (áo dài, nón lá, áo mưa) phải tự làm |

### 2.4 Pack trả phí trên Fab đáng cân nhắc (không miễn phí)
- [Asian Street Food Carts & Stalls: Low Poly Pack](https://www.fab.com/listings/4b3c94bc-7c45-4fac-9164-9a6df775b95e)
  của AlleyBits: có xe bánh mì, ghế nhựa, cột điện, mặt nhà có cửa cuốn. Pack low-poly và **do AI
  tạo**, chỉ hợp để blockout.
- [HONG KONG Urban Market Chaos](https://www.fab.com/listings/b363ebe2-9a61-47d1-aee8-a5c25e8fdd41)
  của Indus North: phố châu Á realistic, neon, 423 mesh. Mua được nếu ngân sách cho phép, rồi
  re-dress thành biển hiệu Việt.
- Giá và tier giấy phép của hai pack trên không hiện trên trang **[cần kiểm tra]**.

## 3. Thư viện CC0

### 3.1 Poly Haven (CC0, [polyhaven.com](https://polyhaven.com))
- **Ngói:** `clay_roof_tiles`, `clay_roof_tiles_02`, `clay_roof_tiles_03`, `roof_tiles`,
  `ceramic_roof_01`, dùng cho ngói đất nung. `corrugated_iron` và `box_profile_metal_sheet` dùng cho
  mái tôn (rất phổ biến ở Hà Nội).
- **Thạch cao và sơn:** `painted_plaster_wall`, `beige_wall_001/002`, `blue_plaster_wall` (sơn nứt),
  `damaged_plaster`, `grey_plaster_01..03`, `concrete_wall_001/003` (sơn tróc).
- **Bê tông và đường:** `concrete_pavement`, `cracked_concrete`, `concrete_tile_facade`,
  `asphalt_floor`, `interlocking_concrete_pavers` (gần giống gạch lát vỉa hè Hà Nội).
- **Model:** `plastic_monobloc_chair_01`, `chinese_stool`, `painted_wooden_bench`,
  `modular_street_seating`, `wooden_stool_01/02`, `metal_stool_01..03`, `Barrel_01/02`, `hand_truck`,
  `korean_public_payphone_01`, `CoffeeCart_01`, cùng vài cây cảnh nhiệt đới trong chậu
  (`calathea_orbifolia_01`, `anthurium_botany_01`).
- **HDRI:** dùng cho look-dev. Bầu trời trong game nên dùng Sky Atmosphere của UE.

### 3.2 ambientCG (CC0, [ambientcg.com](https://ambientcg.com))
- `RoofingTiles001…015`, `Plaster0xx`, `PaintedPlaster0xx`, `Concrete0xx`, `Asphalt0xx`,
  `PavingStones0xx`, `Rust0xx`, `Metal0xx`, cùng decal vết bẩn. Có bản 8K. Đây là nguồn chính để làm
  **trim sheet** cho bộ kit mặt tiền.

### 3.3 Kenney, Quaternius, Smithsonian, OpenGameArt
- **Kenney** ([kenney.nl](https://kenney.nl), CC0) có City Kit và Car Kit. **Quaternius**
  ([quaternius.com](https://quaternius.com), CC0) có các pack city và xe. Cả hai đều low-poly cách
  điệu, chỉ hợp để **greybox** hoặc làm proxy cho kiểm thử PCG. Không dùng trong bản phát hành
  realistic.
- **Smithsonian Open Access 3D** ([3d.si.edu](https://3d.si.edu)) có phần lớn là CC0, nhưng toàn đồ
  bảo tàng. Không có gì về phố Hà Nội.
- **OpenGameArt** có giấy phép khác nhau theo từng file (CC0, CC-BY, GPL, CC-BY-SA). Ít đồ realistic.
  Chỉ lấy file CC0.

## 4. Sketchfab: các ứng viên cụ thể

Sketchfab vẫn cho tải model CC (tháng 10/2026, API vẫn trả `isDownloadable: true`). Epic đã báo sẽ
ngừng tải miễn phí "có báo trước", nên **tải về và lưu bản gốc ngay** những model đã chọn
([Sketchfab blog](https://sketchfab.com/blogs/community/sketchfab-update-what-you-need-to-know-now-that-fabs-live/)).
Link dạng `https://sketchfab.com/3d-models/<uid>`.

| Dùng cho | Model (uid) | Giấy phép | Mặt (tris) | Đánh giá |
| --- | --- | --- | --- | --- |
| `thap_rua` | Tháp Rùa - Turtle Tower on Hoan Kiem Lake (`a22adcd051914e2e911debf0730cab28`) | CC BY 4.0 | 59k | Tốt nhất để blockout. Không rõ nguồn gốc, phải hỏi tác giả xem có dựng từ Google Earth không |
| `thap_rua` | Bản trùng của Techjam (`e202de861af04b2584ed20d539336197`) | CC BY | 59k | Có vẻ là bản tải lại của model trên. **Không dùng** |
| `cau_long_bien` | Cau Long Bien, SEAP VR (`7e77bc555a944bd28d37b27289166fa0`) | CC BY 4.0 | 44k | Tham chiếu tỷ lệ nhịp cầu. Cầu thật phải dựng lại theo dữ liệu OSM, dài khoảng 2,3 km |
| Văn Miếu | Khuê Văn các (`bd978368dc0444058c6c61336ed8f2d0`) | CC BY | 281k | Xuất từ Minecraft (Mineways), kiểu khối vuông. **Không dùng được** |
| Chùa Một Cột | One Pillar Pagoda (`8475a13cd0ce41ffacd977eea63ac245`) | CC BY | 13k | Low-poly, chỉ dùng tham chiếu |
| `xe_day_banh_mi` | BanhMi Cart, ngdkh (`f45b8dfd3a874779ac18323399a10258`) | CC BY | 7k | Đúng hình dáng. Phải làm lại texture |
| `xe_day_banh_mi`, `tra_da_via_he` | Vietnamese Food Cart (`6ab245fb362f44f28f443fa893fc5c92`) | CC BY | 253k | Chi tiết cao. Đáng thử nhất trong nhóm |
| `tra_da_via_he` | STREET SOFT DRINK VIETNAM (`bb36c67963b340168f8d4ab9c194ed5e`) | CC BY | 33k | Xe nước kiểu miền Nam. Làm tham chiếu |
| `xe_day_*` | Vietnamese Hu Tieu Cart, stylized (`8175f874da5b4aec88db69e8b1e3c61a`) | CC BY | 7k | Cách điệu. Chỉ dùng tham chiếu |
| `cho` (sạp) | Vietnamese Vegetable Market, ngdkh (`a3c935d758624c8f866bc27776f86712`) | CC BY | 7k | Blockout sạp chợ |
| `nha_ong_hien_dai` | Vietnamese House in 2000s, ngdkh (`582936c8eac641a885343e91766e71b1`) | CC BY | 8k | Tham chiếu hình khối |
| `pavement_seating` | Plastic stool (`8e53e79610284392a2cda485ec028d92`), plastic_stool (`2f7eef3500c846b8a112433be9912118`), Small Plastic Stool Chair (`41bbea8692ca45729a4ef31ca00074fd`) | CC BY | 0,7–11k | Ghế đẩu nhựa thấp. Rất đơn giản, tự dựng cũng nhanh |
| NPC (nón lá) | Asian Conical Hat (`4eed68df8fb84284a91f42a6c6e4569c`), (`d407409ab62543669aac4a30dcb744b5`) | CC BY | 3k | Dùng được cho phụ kiện MetaHuman |
| `manual` | Honda Super Cub (`dfac2b92b05746709674bea223ee596d`), (`9ce554228fc746c89f6d02b995f43c41`) | CC BY | 136k, 334k | **Không dùng trực tiếp** vì vướng trade dress Honda (mục 8). Chỉ dùng tham chiếu tỷ lệ |
| Xe buýt | 2017 Hyundai County (`5001010220954384a926756f0cfd1c4e`), Thaco 2025 (`437fa0a40e954548872b236e0f824970`) | CC BY | 75k, 1,3M | Xe của hãng thật. Chỉ dùng tham chiếu |
| Tránh | Hanu White House, Hanoi (Bastue), "A Small Corner of Hanoi" | NC-ND / NC-SA | | **Không dùng** |
| Tránh | "Hanoi Street Circuit" (`fd942c0f4fc044f4bd5f8091ead9f540`) | CC BY | 681k | Bản đầy đủ nằm trên link Mega bên ngoài và không rõ nguồn gốc. **Không dùng** |

Lưu ý: nhãn CC-BY trên Sketchfab là **do người tải lên tự khai**. Model công trình thường được rip
từ Google Earth hay từ game khác. Trước khi nhận một model, phải xem mô tả, xem lưới (lưới
photogrammetry đều đặn kiểu Google 3D Tiles là dấu hiệu xấu) và nhắn hỏi tác giả. Lưu ảnh chụp
trang model vào `sources.json` (trường `evidence`).

## 5. Các kho khác

- **BlenderKit** ([licences](https://www.blendkit.com/docs/licenses/)): mọi asset tải về đều dùng
  thương mại được, theo **Royalty Free** hoặc **CC0**. Royalty Free cấm bán lại asset ở dạng gốc,
  nhưng đặt trong game đã build thì được. Tier miễn phí có hàng chục nghìn model và vật liệu. Phải tải
  qua add-on Blender. Hợp để lấy vật liệu và đồ lặt vặt.
- **CGTrader free**: thường theo Royalty Free. Có model gắn **Editorial**, nhất là xe có hãng.
  Lọc bỏ những model đó.
- **TurboSquid free** ([licence](https://www.turbosquid.com/licensing)): dùng trong game được. Model
  phải ở dạng không trích ra được nếu không reverse engineering, mà `.pak` của UE có mã hóa thì đạt.
  Model miễn phí **không được bồi thường** (indemnify). Model Editorial thì cấm dùng thương mại. Cấm
  đưa vào AI hay ML nếu chưa có phép.
- **Objaverse / Objaverse-XL**: giấy phép tính theo **từng object**, phần lớn lấy lại từ Sketchfab
  (CC-BY, có cả NC). Không dùng như một kho chung. Nếu tìm được một object, hãy lần về trang gốc trên
  Sketchfab và xử lý như mục 4.

## 6. Số hóa di sản Việt Nam

- Huế có Google Arts & Culture dựng 3D lăng Tự Đức và vài dự án với đối tác Mỹ. Dữ liệu chỉ để
  xem, **không có giấy phép mở**
  ([VietnamNet](https://vietnamnet.vn/en/digital-project-helps-preserve-hue-historical-monuments-E203455.html)).
- Hà Nội có các dự án số hóa và tour 3D cho du lịch (Văn Miếu, Hoàng thành), nhưng không tìm thấy
  bộ dữ liệu nào tải được với giấy phép mở
  ([Tạp chí Công Thương](https://tapchicongthuong.vn/ha-noi--cong-nghe-so-ket-noi-du-khach-va-di-san-129156.htm)).
  CyArk và Open Heritage 3D chưa có công trình Hà Nội, và dữ liệu của họ thường là NC
  **[cần kiểm tra]**.
- **Kết luận:** landmark phải tự làm. Cách hợp pháp và nhanh nhất là **tự chụp photogrammetry**
  bằng RealityScan (Epic, miễn phí cho cá nhân và công ty doanh thu dưới 1 triệu USD
  **[cần kiểm tra điều khoản 2026]**). Sau đó retopo thành mesh Nanite rồi dựng lại các chi tiết. Công
  trình thời Pháp (Nhà hát Lớn 1911, Nhà thờ Lớn 1886, cầu Long Biên 1902) và Tháp Rùa (khoảng 1886)
  đã hết bảo hộ quyền tác giả về kiến trúc. **Lăng Bác** (1975) có thể vẫn còn bảo hộ và là địa
  điểm nhạy cảm (xem `docs/04-du-lieu-va-giay-phep.md`). Nên làm ở mức "nhận ra được", trang trọng,
  và xin ý kiến pháp lý trước khi bán.

## 7. Đường sinh AI: Codex imagegen, rồi image-to-3D

### 7.1 Codex `$imagegen` cho ra gì
- Chỉ ra **ảnh 2D PNG**, không ra mesh. Model mặc định là **gpt-image-2**. Ảnh 2K ổn định, 4K đang
  beta. Tỷ lệ khung từ 3:1 đến 1:3. Có inpaint bằng mask. **Không có nền trong suốt.** Phải sinh trên
  nền chroma (`#00ff00`) rồi tách nền bằng script
  ([danielvaughan.com](https://codex.danielvaughan.com/2026/04/27/codex-cli-image-generation-gpt-image-2-visual-development-workflows/)).
- Image turn tiêu hạn mức gói Codex nhanh hơn khoảng 3–5 lần. Theo giá API, ảnh 1024² chất lượng
  cao tốn khoảng 0,21 USD.
- Dùng tốt cho: concept, ảnh đầu vào image-to-3D (một vật thể, nền phẳng, ánh sáng đều, góc 3/4 hoặc
  chính diện), **texture phẳng** (mặt tiền chính diện, biển hiệu, decal), và bản vẽ chiếu
  trước/hông/sau để dựng tay.
- Dùng không tốt cho: chữ tiếng Việt có dấu trên biển hiệu (dễ sai dấu). Biển hiệu nên sinh **nền và
  khung** bằng AI, còn chữ render bằng font OFL (ví dụ Be Vietnam Pro) qua material hoặc Text3D trong
  UE. Prompt có sẵn trong `game/assets/prompts.jsonl` (`tools/asset_prompts.py`).

### 7.2 Model image-to-3D mở (tình hình tháng 10/2026)

| Model | Giấy phép | Đầu ra | VRAM | Nhận xét |
| --- | --- | --- | --- | --- |
| **TRELLIS.2-4B** (Microsoft, 12/2025) ([HF](https://huggingface.co/microsoft/TRELLIS.2-4B)) | Code và weights MIT | Mesh + **PBR** (base color, roughness, metallic, opacity), GLB texture 4K | ≥ 24 GB, chỉ thử trên Linux | Chất lượng mở tốt nhất cho đạo cụ. Phần xuất texture dùng **nvdiffrast**, mà giấy phép nvdiffrast chỉ cho "non-commercial, research or evaluation" ([LICENSE](https://github.com/NVlabs/nvdiffrast/blob/main/LICENSE.txt)). Phải xem kỹ trước khi dùng cho game bán **[cần kiểm tra pháp lý]** |
| **TripoSG** (VAST, 3/2025) ([HF](https://huggingface.co/VAST-AI/TripoSG)) | MIT | Chỉ hình học | > 8 GB | Mesh sạch. Texture tự làm (bake, projection) hoặc dùng vật liệu CC0 |
| **Step1X-3D** (StepFun, 5/2025) | Apache 2.0 | Mesh kín + texture | 27–29 GB | Thay thế được TRELLIS.2. Phải kiểm tra giấy phép các dependency |
| **Direct3D-S2** (5/2025) | MIT | Hình học 1024³ | 10–24 GB | Hình học chi tiết, không có texture |
| **Pixal3D** (Tencent ARC, 5/2026) | MIT (theo tổng hợp) **[cần kiểm tra]** | Mesh + PBR, khớp theo pixel | Có chế độ VRAM thấp | Mới, đáng thử khi đã ổn định |
| **Hunyuan3D 2.0 / 2.1 / Omni / Part** ([LICENSE](https://huggingface.co/tencent/Hunyuan3D-2/blob/main/LICENSE)) | Tencent Community License | Mesh + PBR (2.1) | 10 GB (hình) / 29 GB (cả hai) | **Loại trừ EU, UK và Hàn Quốc.** Cấm dùng đầu ra ngoài vùng đó. Có trần 1 triệu MAU. Game bán toàn cầu trên Steam thì **không dùng** |
| Hunyuan3D 2.5 / 3.0 / 3.1 | Không mở weights, chỉ có dịch vụ | | | Không phải lựa chọn tự host |
| **Stable Fast 3D / SPAR3D** (Stability) ([licence](https://stability.ai/license)) | Stability Community License | Mesh + texture nhanh, chất lượng vừa | ~6–10 GB | Miễn phí khi doanh thu năm dưới 1 triệu USD. Vượt ngưỡng phải mua Enterprise |
| PartPacker (NVIDIA) | Phi thương mại | | | **Không dùng** |
| SAM 3D Objects (Meta) | SAM License | Gaussian splat | | Không ra mesh game |

Từ cùng nguồn tổng hợp còn có **UniRig** (MIT, rig tự động) và **Hi3DGen** (MIT) hữu ích
([cinevva timeline](https://app.cinevva.com/guides/ai-3d-model-generation-timeline-2026)).
Dịch vụ thương mại (Tripo, Meshy, Rodin) thường giao quyền đầu ra cho gói trả phí. Cần đọc điều
khoản từng gói **[cần kiểm tra]**.

### 7.3 Pipeline đề xuất (đạo cụ: xe đẩy, gánh hàng, ATM, máy bán nước, xe máy kiểu nhại)
1. **Ảnh đầu vào:** `$imagegen` với prompt trong `prompts.jsonl`. Một vật thể, nền chroma, góc 3/4,
   ánh sáng đều, không logo, không chữ. Sinh thêm ảnh chính diện, hông và sau để kiểm tỷ lệ.
2. **Mesh:** chạy TripoSG (chỉ hình học, sạch về giấy phép) hoặc TRELLIS.2 ở 1024³, trên GPU 24 GB
   thuê theo giờ (A100/L40S/4090).
3. **Dọn mesh trong Blender:** chỉnh kích thước đúng `size_m` và pivot theo `asset_specs.json`.
   Remesh (QuadriFlow hoặc Instant Meshes), decimate về `tris_lod0`, tách các phần cần chuyển động
   (bánh xe, quang gánh).
4. **UV và texture:** smart UV hoặc xatlas. Bake màu từ mesh AI **hoặc**, tốt hơn, gán vật liệu CC0
   (Poly Haven, ambientCG) cộng mask và decal. Xuất ORM gộp kênh theo quy ước.
5. **Xuất `.glb`,** chạy `tools/check_assets.py`, rồi import vào UE bằng Interchange. Bật **Nanite**
   cho mesh đục. Vật trong suốt hoặc có alpha (lá, kính) dùng LOD thường hoặc Nanite foliage
   (5.7+).
6. **Ghi nguồn:** dòng trong `sources.json` gồm `generator: trellis2|triposg`, prompt và `refs` ảnh,
   theo đúng `docs/09-anh-tham-chieu.md`.

**Không dùng AI cho:** bộ kit mặt tiền (cần module khít lưới), cột điện, dây điện, đèn đường, kerb.
Những thứ này là hình học đơn giản hoặc procedural, dựng tay hoặc dùng spline và PCG nhanh và sạch
hơn.

## 8. Cạm bẫy pháp lý

- **Trade dress xe máy.** Hình dáng **Honda Super Cub** là nhãn hiệu 3D đã đăng ký ở Nhật từ 2014
  ([Honda](https://global.honda/en/newsroom/news/2014/c140526eng.html)). Vision, Lead và Wave cũng
  dễ nhận ra. Xe `scooter`, `manual` và `electric` phải là thiết kế nhại: đổi đèn, ốp và yếm, không
  logo, không tên thật. Model Sketchfab của xe thật chỉ được dùng để xem tỷ lệ. Xe hơi và xe buýt
  cũng vậy: không dùng lưới tản nhiệt hay logo Hyundai, Thaco, VinFast. Livery xe buýt Hà Nội
  (vàng đỏ, VinBus) nên được cách điệu.
- **CC-BY:** phải có tên tác giả, tên tác phẩm, link và giấy phép trong credits, kèm dòng "đã chỉnh
  sửa". Điều 2(a)(5)(C) của CC BY 4.0 cấm áp "biện pháp kỹ thuật" hạn chế quyền của người nhận. Việc
  đóng gói vào `.pak` mã hóa hay Steam DRM có vi phạm không vẫn còn tranh cãi **[cần kiểm tra]**.
  Vì vậy với mọi key, ưu tiên CC0 hoặc Fab trước. CC-BY chỉ dùng khi không có lựa chọn khác.
- **NC, ND và SA:** không dùng. Nhãn "Free Standard" trên Sketchfab tương đương giấy phép Standard
  (thương mại được) nhưng phải xem model có cờ **Editorial** không. Editorial nghĩa là chỉ dùng cho
  tin tức hoặc học thuật, thường áp cho xe và sản phẩm có thương hiệu.
- **Nguồn gốc model:** nhãn giấy phép do người tải tự khai. Model công trình có thể rip từ Google
  Earth, mà điều khoản Google cấm (xem `docs/01-nghien-cuu-cong-nghe.md`, mục 3).
- **UE-only:** City Sample, MetaHuman (trước 5.6) và Megascans tải bằng Bridge chỉ hợp lệ khi game
  vẫn dùng UE. Nếu sau này đổi engine thì phải thay. Ghi `ue_only: true` trong `sources.json`.
- **Hunyuan3D:** vướng lệnh loại trừ EU, UK và Hàn Quốc như đã nêu.
- **Dependency NC trong pipeline AI:** nvdiffrast (TRELLIS.2) và PartPacker. Đầu ra không phải tác
  phẩm phái sinh của code, nhưng việc **dùng** công cụ để làm sản phẩm bán có thể đã là "commercial
  use". Cần luật sư xem, hoặc dùng TripoSG cộng texture tự làm.
- **AI và Fab NoAI:** không đưa asset Fab gắn NoAI, ảnh TurboSquid hay ảnh CC-BY-SA vào làm đầu vào
  cho AI.
- **Nhãn hiệu cửa hàng:** biển hiệu dùng tên nhại hoặc tên chung (Phở, Cà phê, Tạp hóa), theo
  `docs/04-du-lieu-va-giay-phep.md`.

## 9. Bảng khuyến nghị theo từng key

Nguồn: **R** = dùng lại (ghi tên kho), **M** = Megascans hoặc vật liệu CC0, **G** = sinh AI
(imagegen rồi 3D), **H** = dựng tay (Blender, PCG, spline). Độ tin cậy: Cao / TB / Thấp.

| Key | Nguồn đề xuất | Tin cậy | Ghi chú |
| --- | --- | --- | --- |
| `street_trees/xa_cu` | H (PVE UE 5.7+ hoặc Blender) + M (vỏ, lá tự chụp) | TB | Thân thẳng cao, vòng sơn trắng |
| `street_trees/phuong_vi` | H + M | TB | Tán dù, 2 biến thể hoa và lá |
| `street_trees/bang_lang` | H + M | TB | Hoa tím |
| `street_trees/bang` | H + M | TB | Cành tầng ngang đặc trưng |
| `street_trees/sau` | H + M | TB | |
| `street_trees/hoa_sua` | H + M | TB | Cành dạng vòng |
| `street_trees/sao_den` | H + M | TB | |
| `street_trees/liu` | R (Fab: liễu rủ, nếu có bản free hoặc rẻ) / H | TB | Liễu rủ không phải loài riêng của Việt Nam |
| `street_trees/loc_vung` | H + M | Thấp | Cây ven hồ, thân nghiêng |
| `street_trees/so` | H + M | Thấp | |
| `power_poles/concrete_h` | H | Cao | Bê tông ly tâm chữ H, hình học đơn giản |
| `power_poles/concrete_round` | H | Cao | |
| `cable_spans/bundle_0..3` | H (procedural: spline, catenary trong UE) | Cao | Không dùng mesh tĩnh sinh AI |
| `street_lights/boulevard` | H | Cao | Đèn đôi dải phân cách |
| `street_lights/single` | H | Cao | |
| `shop_signs/*` và `*_vertical` (12 nhóm × 2) | H (mesh khung) + G (nền, hình) + font OFL | Cao | Chữ render bằng font, không để AI vẽ |
| `awnings/canvas` | H + M (vải CC0) | Cao | Mesh cloth đơn giản |
| `parked_motorbikes/scooter` | G (thiết kế nhại) rồi H tinh chỉnh | TB | Không giống Vision hay Lead |
| `parked_motorbikes/manual` | G rồi H | TB | Tránh dáng Super Cub, Wave |
| `parked_motorbikes/electric` | G rồi H | TB | Tránh dáng VinFast |
| `pavement_seating/pho_quan` | R (Poly Haven `chinese_stool`, Sketchfab ghế nhựa CC-BY) / H | Cao | Ghế đẩu nhựa đỏ, xanh và bàn inox, dễ tự dựng |
| `pavement_seating/tra_da` | H + R (Poly Haven) | Cao | |
| `pavement_seating/bia_hoi` | H + R | Cao | Thêm cốc và can bia |
| `street_vendors/ganh_hang` | G + H | TB | Quang gánh tách rời để làm hoạt cảnh |
| `street_vendors/tra_da_via_he` | R (Sketchfab `6ab245fb…`, tham chiếu) / G | TB | |
| `street_vendors/xe_day_hoa_qua` | G | TB | |
| `street_vendors/xe_day_banh_mi` | R (Sketchfab `f45b8dfd…`, CC-BY, làm lại texture) / G | TB | |
| `street_vendors/xe_dap_hoa` | G + H (xe đạp khung cơ bản) | TB | |
| `infrastructure/crossing` | H (decal) + M | Cao | |
| `infrastructure/atm` | G | Cao | Không logo ngân hàng |
| `infrastructure/traffic_signals` | H | Cao | Đèn có đồng hồ đếm ngược kiểu Việt Nam |
| `infrastructure/gate` | H | TB | |
| `infrastructure/bus_stop` | H | Cao | Theo mẫu nhà chờ Hà Nội |
| `infrastructure/toilets` | G / H | TB | |
| `infrastructure/bench` | R (Poly Haven `painted_wooden_bench`) / H (ghế đá) | Cao | Ghế đá Hồ Gươm phải tự dựng |
| `infrastructure/kerb` | H + M | Cao | Spline mesh |
| `infrastructure/vending_machine` | G | Cao | |
| `infrastructure/information`, `bicycle_rental`, `drinking_water`, `parking_entrance`, `artwork` | G / H | TB | Ưu tiên thấp |
| Kit `nha_ong_pho_co` | H + M (trim sheet ambientCG/Poly Haven + texture tự chụp) | Cao | Mái ngói, ban công, cửa gỗ lùa |
| Kit `nha_ong_hien_dai` | H + M | Cao | |
| Kit `biet_thu_phap` | H + M | TB | Chi tiết trang trí kiểu Pháp |
| Kit `cong_trinh_phap_cong` | H + M | TB | |
| Kit `khu_tap_the` | H + M | Cao | Chuồng cọp, panel bê tông |
| Kit `chung_cu_cao_tang` | R (City Sample Buildings, UE-only) + H | TB | Re-skin bằng vật liệu Việt |
| Kit `van_phong_cao_tang` | R (City Sample Buildings) | Cao | Kính và bê tông chung chung |
| Kit `lien_ke_kdt` | H + M | Cao | |
| Kit `dinh_chua` | H + M (ngói, gỗ sơn son) | TB | Đầu đao, mái cong |
| Kit `cho` | H + M | TB | |
| Kit `cong_trinh_cong_cong` | H + M | TB | |
| Kit `nha_xuong` | R (City Sample, kho Fab free) / H + M (tôn Poly Haven) | Cao | |
| Kit `nha_thap_tang` | H + M | Cao | |
| `thap_rua` | H (photogrammetry tự chụp + retopo); Sketchfab `a22adcd…` để blockout | TB | |
| `cau_the_huc` | H | Cao | Cầu gỗ cong sơn đỏ, dễ dựng |
| `den_ngoc_son` | H + photogrammetry | TB | |
| `nha_hat_lon` | H (theo ảnh tự chụp) | TB | Nhiều chi tiết, làm lâu |
| `nha_tho_lon` | H | TB | |
| `cau_long_bien` | H (procedural lặp nhịp dầm thép) | Cao | Sketchfab `7e77bc55…` để tham chiếu |
| `cho_dong_xuan` | H + M | TB | |
| `o_quan_chuong` | H + photogrammetry | Cao | |
| Lăng Bác, Văn Miếu (ưu tiên 2) | H | TB | Lăng Bác: nhạy cảm, xem mục 6 |
| Xe hơi, taxi | R (City Sample Vehicles, UE-only) | Cao | Đổi biển số và màu, bỏ dấu hiệu Mỹ |
| Xe buýt | R (bus của City Sample) + re-livery / H | TB | Livery cách điệu |
| Xích lô | G + H | TB | Không tìm thấy model mở dùng được |
| Người | MetaHuman + City Sample crowd | Cao | Trang phục Việt và nón lá tự làm hoặc dùng CC-BY |
| Vật liệu: thạch cao, sơn bong, ngói, bê tông, nhựa đường | M (Poly Haven, ambientCG, Megascans đã nhận) | Cao | Nguồn mạnh nhất |
| Thực vật nhiệt đới (bụi, cỏ, dây leo) | M (Megascans đã nhận) + Poly Haven + tự chụp | TB | |

**Thứ tự làm:** (1) kiểm tra Megascans đã nhận và tải City Sample; (2) tải ngay các model Sketchfab
đã chọn ở mục 4 rồi ghi `sources.json`; (3) dựng tay cột điện, dây điện, đèn và kerb (Cao, nhanh);
(4) thử pipeline AI với 3 đạo cụ (`xe_day_hoa_qua`, `atm`, `scooter`); (5) kit `nha_ong_pho_co`;
(6) landmark bằng photogrammetry tự chụp.

## Tài sản bổ sung cho 12 quận nội thành

Khi dựng rộng ra 12 quận (Ba Đình, Hoàn Kiếm, Đống Đa, Hai Bà Trưng, Tây Hồ, Cầu Giấy, Thanh Xuân,
Hoàng Mai, Long Biên, Nam Từ Liêm, Bắc Từ Liêm, Hà Đông), `game/assets/asset_specs.json` có thêm 38 đạo cụ
trong 11 set mới (tổng 106 đạo cụ, 13 kit mặt tiền giữ nguyên) và key `district_sets` ghi set nào cần nhất ở
quận nào (id quận theo `pipeline/districts.json`). `ue5/Config/asset_map.json` đã có slot trống cho từng set;
`prompts.jsonl` sinh lại được 750 prompt. Ký hiệu nguồn như bảng mục 9 (R/M/G/H).

| Set | Nội dung | Nguồn đề xuất |
| --- | --- | --- |
| `metro_rail` | Trụ cầu cạn, nhịp dầm chữ U 30 m (scale X), mô-đun ga trên cao 24 m (2 biến thể: tuyến 2A Cát Linh–Hà Đông, tuyến 3 Nhổn–ga Hà Nội) | H (procedural theo spline, lặp nhịp như cầu Long Biên) + M bê tông |
| `national_rail` | Đoạn ray khổ 1 m (scale X, tà vẹt bê tông/gỗ), chắn tàu sọc đỏ trắng kèm chòi gác | H + M; ray và ba-lát CC0 có sẵn, chắn tàu dựng tay |
| `river_dike` | Tường đê bê tông 1 m (scale X; biến thể gốm sứ Con đường gốm sứ), cửa khẩu đê, bậc xuống chân đê | H + M; mảng gốm sứ dùng texture tự chụp hoặc G (hoa văn không chữ) |
| `lakeside` | Lan can ven hồ (3 kiểu: Hồ Tây, Hồ Gươm, hồ mới), thuyền thiên nga, mảng sen, ghế đá có giàn hoa giấy, chỗ câu cá | H cho lan can; G cho thuyền và chỗ câu; sen làm bằng PVE/Blender (H + M) |
| `rooftop_clutter` | Bồn nước inox trên giá, máy nước nóng mặt trời, cụm cục nóng điều hoà gắn tường | H (hình trụ, khung đơn giản); cục nóng G rồi H tinh chỉnh; tuyệt đối không chữ hãng |
| `kdt_moi` | Cổng khu đô thị có barie và chòi bảo vệ, barie bãi xe, rào tôn công trường 2,4 m (scale X, in áp phích không chữ), cần trục tháp | H; cần trục R (nhiều model CC0, đổi màu vàng, bỏ chữ); áp phích rào tôn G |
| `road_structures` | Cầu vượt bộ hành thép, pano quảng cáo cột đơn 12×6 m, nhà chờ BRT giữa đường 20 m, rào dải phân cách 1 m (scale X) | H; mặt pano G theo cách biển hiệu (khung tay, nền sinh, chữ render trong UE) |
| `ktt_addons` | Chuồng cọp cơi nới (6 biến thể, gắn mặt tường), loa phường trên cột, trạm biến áp kiosk | H + M (tôn, sắt gỉ Poly Haven); chuồng cọp là add-on cho kit `khu_tap_the` |
| `lang_trong_pho` | Cổng làng (3 kiểu), giếng làng, lan can ao làng 2 m (scale X), cây đa đầu làng | H + M; cây đa H (PVE/Blender) + vỏ, rễ tự chụp; bảng tên cổng để trống, render chữ trong UE |
| `cho_coc` | Sạp chợ cóc có bạt (6 loại hàng), xe đẩy chè, xe đẩy bắp luộc/khoai nướng | G (imagegen rồi image-to-3D) như `street_vendors`; người bán là nhân vật riêng |
| `pavement_clutter` | Xe ba gác đồng nát, lò hoá vàng, thùng rác công cộng (3 kiểu), xe gom rác đẩy tay | G cho xe; thùng rác R (CC0 wheelie bin, đổi màu xanh) / H; lò hoá vàng H |

Ghi chú: các mục scale theo một trục (`scale_axes: "x"`) dựng như `cable_spans` — một đoạn chuẩn có hai đầu
khớp nhau, PCG kéo dài bằng Scale. `billboard_pano` và `hoarding_panel` dùng `route` =
`hand_mesh_generated_print` nhưng không có dòng `sign_print` trong `prompts.jsonl` (generator chỉ sinh print
cho `shop_signs`); viết prompt mặt in bằng tay khi làm. Thuyền thiên nga chỉ đặt ở hồ công viên (Bảy Mẫu,
Thủ Lệ, Trúc Bạch) vì Hồ Tây đã dừng dịch vụ này.
