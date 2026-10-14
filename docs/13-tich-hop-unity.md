# 13. Tích hợp Unity 6: phương án build thứ hai

Thư mục `unity/` là "khung" dự án Unity cho Hanoi City, song song với `ue5/` (xem
`05-tich-hop-ue5.md`). Nó dùng **cùng dữ liệu** (`game/content` JSON, ô thành phố glb, điểm PCG
CSV, `traffic/graph.json`) và chạy **cùng luật** nhiệm vụ, thoại, cờ, phạt CSGT. Khác với `ue5/`:

* Phần lõi C# không phụ thuộc Unity, nên **đã được biên dịch và chạy test thật** trong cloud
  bằng .NET 8 (108 test, gồm chạy tự động hết 62 nhiệm vụ thật). CI chạy lại mỗi lần đẩy code.
* Phần dính vào Unity (MonoBehaviour, editor, import glTF) **đã biên dịch thử** với thư viện tham
  chiếu của Unity 2021.3 (không có Unity 6 trong cloud) và **chưa chạy trong Unity lần nào**.
  Danh sách kiểm tra ở mục 6.
* Có thêm các hệ thống mà bản UE chưa có runtime: sự kiện ngẫu nhiên ngoài phố, đồ sưu tầm và
  băng 22-24, kỹ năng theo nhân vật, kinh tế (quán, cuốc xe, hoá đơn tháng), lịch âm và lịch sự
  kiện tự bật (Tết, Trung thu, phố đi bộ, nồm).

Chọn engine nào cho máy của bạn: xem `14-chon-engine.md` và chạy `tools/check_machine.ps1`
(Windows) hoặc `tools/check_machine.sh` (macOS).

## 1. Có gì trong `unity/`

| Đường dẫn | Nội dung |
| --- | --- |
| `Packages/manifest.json` | Gói Unity: HDRP, glTFast, Newtonsoft JSON, Input System, Cinemachine, Splines, Test Framework, và gói nhúng `com.vncity.hanoicity` |
| `ProjectSettings/ProjectVersion.txt` | Unity 6 (6000.0); mở bằng bản Unity 6 LTS mới hơn cũng được, Unity tự nâng cấp |
| `hanoi_setup.json` | Đường dẫn cho Run Full Setup (bản dựng thành phố, `game/content`, `pipeline/districts.json`, đích) |
| `hanoi_asset_map.json` | `Set/Kind` của điểm PCG → prefab (cùng khoá với `ue5/Config/asset_map.json`, có test kiểm) |
| `Packages/com.vncity.hanoicity/Runtime/Core/` | Lõi C# thuần (assembly `HanoiCity.Core`, `noEngineReferences`): nội dung, toạ độ, đồng hồ, thời tiết, mọi hệ thống game |
| `Packages/com.vncity.hanoicity/Runtime/Core/Generated/HanoiContentTypes.cs` | 49 lớp và 24 enum sinh từ `game/schemas` bằng `tools/codegen_unity.py` (không sửa tay) |
| `Packages/com.vncity.hanoicity/Runtime/Unity/` | Lớp Unity (assembly `HanoiCity.Unity`): bootstrap, người chơi, gốc toạ độ trôi, mặt trời, thời tiết HTTP, đồ thị giao thông, vẽ đạo cụ instanced |
| `Packages/com.vncity.hanoicity/Editor/` | Menu **Tools > Hanoi City** (assembly `HanoiCity.Editor`): chép dữ liệu, kiểm nội dung, nhập ô glb, hiệu chỉnh trục, điểm PCG, mốc kiểm |
| `Packages/com.vncity.hanoicity/Tests/Core/` | Test NUnit của lõi (chạy được cả trong Unity Test Runner lẫn `dotnet test`) |
| `dotnet/` | `HanoiCity.sln` để build và test lõi bằng .NET 8, không cần Unity |

Lõi (`HanoiCity.Core`), tương ứng với subsystem của UE:

| Lớp C# | Vai trò | Bên UE |
| --- | --- | --- |
| `HanoiContentDatabase` | nạp thẳng `game/content/**/*.json` vào lớp sinh tự động, **chặt**: khoá lạ, enum sai, thiếu khoá bắt buộc, trùng id đều báo lỗi | `UHanoiContentSubsystem` + DataTable |
| `HanoiGeoFrame`, `HanoiTransverseMercator` | lat/lon ↔ ENU (Krüger, giống hệt `hanoi_geo.py`) ↔ toạ độ Unity, gốc trôi | `UHanoiGeoSubsystem` |
| `HanoiClock`, `HanoiSun` | giờ Hà Nội UTC+7, hệ số 30x, sự kiện mỗi giờ/ngày đi qua, mặt trời NOAA | `UHanoiTimeWeatherSubsystem` |
| `VietnameseLunarCalendar`, `WorldEventCalendar` | âm lịch Việt Nam (thuật toán Hồ Ngọc Đức, UTC+7), tự bật/tắt `events` theo ngày âm/dương, thứ, giờ, thời tiết | chưa có |
| `HanoiClimatologyWeather`, `HanoiWeatherFeed` | thời tiết khí hậu trung bình và đọc feed `live/weather.py` | `UHanoiHttpWeather` |
| `MissionRunner` | đồ thị bước nhiệm vụ, `next`, `fail_if`, 14 khoá `params` runtime, phạt, đổi nhân vật | `UHanoiMissionSubsystem` |
| `DialogueRunner` | `ResolveLine`, `NextLine`, `AvailableChoices`, `ApplyChoice` theo `condition` | `ResolveDialogueLine`… |
| `HeatSystem` | mức chú ý CSGT 0-5, phạt, bị tuýt còi, giảm khi khuất | `UHanoiHeatSubsystem` |
| `SkillSystem` | 12 kỹ năng × 3 bậc, mở khoá hoạt động/xe/lựa chọn | chỉ có `min_skills` |
| `RandomEventSystem` | 46 sự kiện ngoài phố: tung xác suất mỗi giờ game, điều kiện quận/giờ/thời tiết/xe/đường, lựa chọn, minigame, hậu quả | chưa có |
| `CollectibleSystem` | 220 đồ sưu tầm theo toạ độ thật, ảnh so khớp ≥ 0,85, tem phiếu giấu trong 20 m, băng 22/23/24 | chưa có |
| `EconomySystem` | mua quán, nâng cấp, lãi theo ngày (Tết đóng cửa, phở trời lạnh, lụt, Trung thu, viral), cuốc xe, thưởng tuần, hoá đơn tháng của Minh | chưa có |
| `HanoiTrafficGraph`, `HanoiPcgCsv`, `HanoiCityManifest`, `HanoiTilePlacement` | đọc dữ liệu thành phố, A* có một chiều và đường chỉ xe máy, hiệu chỉnh trục ô | `AHanoiTrafficGraph`, `import_city.py` |
| `HanoiWorld` | mặt tiền gom mọi thứ: `Tick`, `EvaluateCondition`, `ApplyReward`, cờ, tiền, lưu/nạp JSON | GameInstance |

Lớp Unity (`HanoiCity.Unity`):

| Component | Vai trò |
| --- | --- |
| `HanoiGame` | Một cái mỗi scene. Nạp nội dung từ `StreamingAssets/Hanoi/Content`, tạo `HanoiWorld`, gọi `Tick` mỗi frame, tự lưu khi xong nhiệm vụ (`Application.persistentDataPath/hanoi_save.json`) |
| `HanoiSettings` | ScriptableObject (Assets > Create > Hanoi City > Settings, đặt trong `Resources/HanoiSettings`): đường dẫn, hệ số giờ, feed thời tiết, ngưỡng gốc trôi |
| `HanoiPlayerAdapter` | Gắn lên nhân vật: báo vị trí ENU, đang đi xe, đi ô tô, loại đường cho lõi |
| `HanoiFloatingOrigin`, `HanoiGeoAnchor` | Gốc toạ độ trôi (mục 6.3) |
| `HanoiSunDriver` | Xoay directional light theo mặt trời thật của Hà Nội, mờ theo mây |
| `HanoiWebWeatherProvider` | Feed thời tiết qua `UnityWebRequest`, lỗi thì về khí hậu trung bình |
| `HanoiTrafficGraphView` | Nạp `traffic/graph.json`, vẽ gizmo (một chiều xanh, chỉ xe máy cam, đèn đỏ) |
| `HanoiPointSetRenderer` | Cây, cột điện, dây, biển hiệu, mái hiên, xe máy đỗ, ghế nhựa: `Graphics.RenderMeshInstanced` theo lô 1023, cắt theo khoảng cách |

## 2. Phần cứng và ổ đĩa

Tóm tắt (chi tiết và so sánh với UE ở `14-chon-engine.md`):

* Windows 10/11 64-bit hoặc macOS 13+ (Apple Silicon). Linux chạy được editor nhưng không phải
  đường chính.
* RAM tối thiểu **16 GB**, khuyến nghị 32 GB khi nhập nhiều quận. CPU 4 nhân trở lên.
* GPU cho HDRP: VRAM ≥ 6 GB (GTX 1660 / RTX 2060 / RX 6600 trở lên); dưới mức đó dùng URP (mục 9).
* Ổ SSD, dành **60 GB** (khuyến nghị 120 GB): Unity Editor + module build ~10-15 GB, Visual
  Studio hoặc Rider ~5-10 GB, thư mục `unity/Library` sau khi nhập Hoàn Kiếm vài GB, cả 12 quận
  nội thành (1.744 ô, 22 triệu tam giác) có thể 20-40 GB.

## 3. Cài đặt

### 3.1 Windows (đường chính)

1. Cài **Unity Hub** (unity.com/download), đăng nhập (giấy phép Personal miễn phí khi doanh thu
   dưới ngưỡng của Unity; xem lại điều khoản lúc phát hành).
2. Hub > Installs > **Install Editor** > chọn bản **Unity 6 LTS** mới nhất. Module: *Microsoft
   Visual Studio Community* (nếu chưa có IDE), *Windows Build Support (IL2CPP)*, *Documentation*
   tuỳ ý. Không cần Android/iOS.
3. IDE: Visual Studio 2022 với workload **Game development with Unity**, hoặc JetBrains Rider.
4. **.NET 8 SDK** (dotnet.microsoft.com) nếu muốn chạy test lõi ngoài Unity như CI:
   `dotnet test unity/dotnet`.
5. Clone repo vào đường dẫn **ngắn, không dấu, không dấu cách** (ví dụ `D:\vncity`), giống UE.
6. Python của repo (`venv`) dùng cho pipeline và `tools/codegen_unity.py`; Unity không cần Python.

### 3.2 macOS

1. Unity Hub cho Mac, cài Unity 6 LTS bản **Apple silicon**, module *Mac Build Support (IL2CPP)*
   (cần Xcode nếu build IL2CPP).
2. Rider hoặc VS Code với extension *Unity*.
3. HDRP chạy trên Metal; một số tính năng ray tracing của HDRP không có trên Mac (mục 6.4).

### 3.3 Bố cục thư mục

Đường dẫn trong `unity/hanoi_setup.json` tính từ `unity/` (thư mục gốc project Unity):

| Khoá | Mặc định | Là gì |
| --- | --- | --- |
| `city_build` | `../out/hoankiem` | bản dựng thành phố (`manifest.json`, `tiles/`, `semantics/`, `pcg/`, `traffic/`) |
| `game_content` | `../game/content` | nội dung game |
| `pipeline_districts` | `../pipeline/districts.json` | khung các quận, để sự kiện ngẫu nhiên biết người chơi đang ở quận nào |
| `asset_map` | `hanoi_asset_map.json` | điểm PCG → prefab |
| `scene` | `Assets/Scenes/Hanoi.unity` | scene setup tạo hoặc mở |
| `tiles_dest` | `Assets/HanoiCity/Tiles` | nơi chép glb để glTFast nhập (gitignore) |
| `streaming_dest` | `Assets/StreamingAssets/Hanoi` | dữ liệu runtime đọc lúc chơi (gitignore) |
| `max_tiles` | `64` | số ô gần hồ Gươm nhất được nhập; `0` = tất cả |

Giữ `unity/` bên trong repo, cạnh `game/`, `out/`, `pipeline/`. Dữ liệu được **chép** vào
`StreamingAssets` (không sửa ở đó, nguồn thật là `game/content`); chạy lại setup sau mỗi lần
nội dung đổi.

## 4. Mở project lần đầu

**Bước 0, ngoài Unity, ở gốc repo:**

```bash
# Lớp C# phải khớp game/schemas (lệnh --check thoát 1 nếu cũ)
./venv/bin/python tools/codegen_unity.py
./venv/bin/python tools/codegen_unity.py --check
# Lõi C# biên dịch và qua test (cần .NET 8 SDK; không cần Unity)
dotnet test unity/dotnet
# Cần một bản dựng thành phố, mặc định out/hoankiem (xem README)
ls out/hoankiem/manifest.json out/hoankiem/tiles out/hoankiem/semantics out/hoankiem/pcg
```

**Bước 1:** Unity Hub > Projects > **Add** > **Add project from disk** > chọn thư mục `unity/`.
Hub báo phiên bản trong `ProjectVersion.txt` khác bản đã cài thì chọn bản Unity 6 LTS đã cài và
đồng ý nâng cấp.

**Bước 2:** lần mở đầu Unity tải gói (vài phút) rồi biên dịch script. Console phải không có lỗi
đỏ. Lỗi thì đọc lỗi **đầu tiên**, đối chiếu mục 6.1. Unity tự sinh file `.meta` cho gói nhúng
`com.vncity.hanoicity`; commit các file `.meta` đó ở lần đầu để GUID ổn định.

**Bước 3:** Window > Rendering > **HDRP Wizard** > *Fix All* (tạo HDRP Asset, Volume Profile mặc
định, đặt Color Space Linear). Mở lại project nếu Wizard yêu cầu.

**Bước 4, kiểm nhanh:**
* Menu **Tools > Hanoi City** có các mục Run Full Setup, Copy Runtime Data, Validate Content,
  Import City Tiles, Import PCG Points, Spawn Verify Markers.
* Window > General > **Test Runner** > EditMode: nhóm `HanoiCity.Core.Tests` chạy hết, xanh
  (cùng 108 test như CI).

**Khi đổi schema:** chạy lại `tools/codegen_unity.py`, quay lại Unity, chờ biên dịch lại. Không
sửa tay `HanoiContentTypes.cs`.

## 5. Chạy setup

**Tools > Hanoi City > Run Full Setup**, hoặc dòng lệnh không mở giao diện:

```bat
"C:\Program Files\Unity\Hub\Editor\<phiên bản>\Editor\Unity.exe" -batchmode -quit -projectPath D:\vncity\unity ^
  -executeMethod HanoiCity.EditorTools.HanoiCitySetup.RunFullSetupBatch -hanoiMaxTiles 12 -logFile setup.log
```

(cờ khác: `-hanoiCity <dir>`, `-hanoiContent <dir>`; trên Mac thay bằng
`/Applications/Unity/Hub/Editor/<phiên bản>/Unity.app/Contents/MacOS/Unity`.) Các bước:

1. **Chép dữ liệu** vào `Assets/StreamingAssets/Hanoi/`: `Content/` (toàn bộ `game/content`),
   `districts.json`, `City/manifest.json`, `City/traffic/graph.json`, `City/places/pois.json`,
   `City/districts.geojson`, `City/pcg/*.csv`.
2. **Kiểm nội dung**: nạp chặt vào lớp sinh tự động; lỗi là dừng (không im lặng bỏ qua nhiệm vụ).
3. **Scene**: mở hoặc tạo `Assets/Scenes/Hanoi.unity`; thêm `HanoiGame` + `HanoiFloatingOrigin`,
   mặt trời (`Light` + `HanoiSunDriver`), người chơi tạm (capsule + `CharacterController` +
   `HanoiPlayerAdapter`) ở bờ hồ cạnh Tháp Rùa.
4. **Ô thành phố**: chép `tiles/bld_*.glb`, `road_*.glb` của `max_tiles` ô gần gốc nhất vào
   `Assets/HanoiCity/Tiles/<ô>/` (ô âm viết `m1_m2`), để glTFast nhập; đo khung của tối đa 16 ô,
   chọn quy ước trục (mục 6.2), đặt mỗi ô dưới `City/Buildings` hoặc `City/Roads` với một
   `HanoiGeoAnchor`.
5. **Điểm PCG**: với mỗi `Set/Kind/ô` đã có prefab trong `hanoi_asset_map.json`, một
   `HanoiPointSetRenderer` dưới `City/Points/<set>` (bật GPU Instancing cho material). Chưa có
   prefab thì chỉ ghi log số điểm bị bỏ, an toàn khi chưa có asset.
6. **Đồ thị giao thông** `City/Systems/HanoiTrafficGraph` và **mốc kiểm** `City/Verify` (Tháp
   Rùa, Nhà hát Lớn, Nhà thờ Lớn và mọi `landmarks` của nội dung, cao 40 m).
7. Lưu scene.

Chạy lại lúc nào cũng được: các thư mục `City/*` được xoá và tạo lại.

## 6. Danh sách kiểm tra lần mở đầu tiên

### 6.1 Biên dịch: các API viết mà chưa chạy trong Unity 6

Lớp Unity và editor đã biên dịch thử với thư viện tham chiếu Unity **2021.3** (gói NuGet
`UnityEngine.Modules`) cộng `UnityEditor.dll` 2021.1, không phải Unity 6. Những chỗ có thể lỗi:

- [ ] Assembly `HanoiCity.Core` dùng `overrideReferences` + `precompiledReferences:
  ["Newtonsoft.Json.dll"]`: nếu Unity báo không tìm thấy Newtonsoft, kiểm gói
  `com.unity.nuget.newtonsoft-json` đã cài (Package Manager), hoặc bỏ `overrideReferences`.
- [ ] Tên assembly của glTFast trong `HanoiCity.Editor.asmdef` (`glTFast`, `glTFast.Editor`): mã
  hiện không gọi API glTFast trực tiếp (chỉ dựa vào importer của nó cho `.glb`), nên nếu tên khác
  thì xoá hai tham chiếu này.
- [ ] Phiên bản gói trong `manifest.json` (HDRP 17.0.3, glTFast 6.0.1, Input System 1.11.2,
  Cinemachine 3.1.2, Splines 2.7.2): mở bằng Unity 6.x mới hơn, Package Manager có thể nâng HDRP
  theo editor; glTFast nên nâng lên bản mới nhất (Package Manager > Unity Registry > glTFast > Update).
- [ ] `Object.FindAnyObjectByType`, `FindObjectsByType(FindObjectsSortMode.None)` (thay cho
  `FindObjectOfType` cũ) — `HanoiGame.cs`, `HanoiCitySetup.cs`.
- [ ] `Graphics.RenderMeshInstanced(RenderParams, Mesh, int, Matrix4x4[], int)` vẽ được trong HDRP
  (material phải bật *Enable GPU Instancing*; shader HDRP/Lit hỗ trợ) — `HanoiPointSetRenderer.cs`.
  Nếu Unity 6 khuyên dùng BatchRendererGroup / GPU Resident Drawer thì vẫn chạy được, tối ưu sau.
- [ ] `UnityWebRequest.SendWebRequest().completed` gọi trên main thread — `HanoiWebWeatherProvider.cs`.
- [ ] `AssetDatabase.StartAssetEditing/StopAssetEditing` rồi `Refresh` để glTFast nhập một loạt glb;
  `AssetDatabase.LoadAssetAtPath<GameObject>("...glb")` trả về object gốc của glTFast;
  `PrefabUtility.InstantiatePrefab` trên asset đó — `HanoiCitySetup.ImportTiles`.
- [ ] `File.Replace` khi lưu (Windows/macOS) — `HanoiGame.Save`.
- [ ] Trong namespace `HanoiCity.*`, chữ `Time` một mình là namespace `HanoiCity.Time`, không
  phải `UnityEngine.Time`: viết đầy đủ `UnityEngine.Time.deltaTime` (lỗi CS0234 nếu quên).
- [ ] IL2CPP: `link.xml` giữ nguyên `HanoiCity.Core` và `Newtonsoft.Json` (Newtonsoft dựng lớp nội
  dung bằng reflection; thiếu là lỗi "no parameterless constructor" chỉ ở bản build).

### 6.2 Trục toạ độ (quan trọng nhất)

Hợp đồng: ENU mét (x đông, y bắc, z lên) → Unity: **X = đông, Y = lên, Z = bắc**, mét, trừ gốc
trôi. `Unity.yaw = −yaw` (yaw ENU tính ngược chiều kim đồng hồ từ hướng đông; yaw Unity quay
từ +Z sang +X), giả định model nhìn về +X.

glb của ô: X = đông, Y = lên, Z = −bắc, node mang tịnh tiến của ô. **glTFast lật trục X** để
chuyển sang hệ tay trái, nên trong Unity một ô nhập vào có mặt bằng `(−đông, −bắc)`, tức xoay
180° quanh Y. `HanoiTilePlacement` không tin giả định này: nó đo khung mặt bằng của tối đa 16 ô,
so với khung chính xác từ `semantics/footprints_X_Y.json`, chọn trong 16 khả năng (8 hoán vị có
dấu × có/không giữ offset node) theo tổng IoU, rồi đặt yaw/mirror tương ứng. Hoà thì giữ giả
định glTFast.

- [ ] Console có dòng `tile axes: ((-1, 0), (0, -1)) baked=True (IoU 0.9x...)`. Khác dòng này nghĩa
  là importer khác giả định; setup đã tự bù, nhưng ghi lại vào đây. `AMBIGUOUS` thì nhập thêm ô và
  kiểm kỹ các mốc.
- [ ] Mốc `City/Verify`: "Thap Rua" trên đảo nhỏ giữa hồ Gươm, "Nha hat Lon" trên Nhà hát Lớn,
  "Nha tho Lon" trên Nhà thờ Lớn (sai số cho phép ~20 m).
- [ ] Nhìn từ trên xuống (Scene view, trục Y): Hồ Tây (phía bắc) nằm về phía **+Z**.
- [ ] Đường (`City/Roads`) khớp gầm nhà; gizmo của `HanoiTrafficGraph` trùng mặt đường (Hoàn Kiếm:
  2285 nút, 2721 cạnh, Console in số này).
- [ ] Khi có prefab đạo cụ: biển hiệu quay ra phố. Quay ngược thì sửa `yaw_offset_deg` trong
  `hanoi_asset_map.json` (model glTF nhìn về +X sau glTFast thường cần 180), không sửa code.

### 6.3 Gốc toạ độ trôi

Hà Nội nội thành rộng ~24 × 21 km. `float` của Unity còn chính xác ~1 mm ở 8 km nhưng vật lý và
animation rung từ ~10 km. Cách làm:

* Logic game không bao giờ dùng `transform.position` để so khoảng cách: lõi dùng ENU `double`
  (`IHanoiPlayerQuery.PositionEnu`, `HanoiWorld.ResolveEnu`).
* `HanoiFloatingOrigin` theo dõi người chơi; xa gốc Unity quá `floatingOriginThresholdM`
  (mặc định 2 km) thì dời `Geo.RebaseEnu` tới vị trí người chơi (làm tròn 100 m), mọi
  `HanoiGeoAnchor` tự đặt lại từ toạ độ `double`, các root trong `unanchoredRoots` (camera, xe, NPC)
  bị trừ cùng một độ dời, rồi `Physics.SyncTransforms()`.
* Đồ vật tĩnh (ô, mốc) mang `HanoiGeoAnchor`. Đồ động sinh lúc chạy thì thêm vào
  `unanchoredRoots` hoặc nghe sự kiện `HanoiFloatingOrigin.Shifted`.
* HDRP bật sẵn *camera-relative rendering* nên phần hiển thị không rung; gốc trôi lo phần vật lý.

- [ ] Đi xa hồ Gươm hơn 2 km: không giật hình, không rơi qua sàn, mốc vẫn đúng chỗ.

### 6.4 HDRP và hình ảnh

- [ ] HDRP Wizard sạch lỗi. Volume có *Physically Based Sky* + *Exposure* tự động (mặt trời đặt
  100.000 lux lúc trưa trời quang, `HanoiSunDriver.clearNoonLux`).
- [ ] Mặt trời: `startHour = 7` thì nắng chiếu từ hướng đông (+X), 12:00 gần đỉnh đầu, 18:00 phía
  tây. Một ngày game dài 48 phút thật nên **không dùng lightmap nướng sẵn**; xem
  `14-chon-engine.md` mục 4 về GI động (APV với nhiều kịch bản ánh sáng, SSGI, RTGI nếu GPU có
  ray tracing).
- [ ] Trên Mac: không có ray tracing HDRP; SSGI và APV vẫn dùng được.

### 6.5 Runtime trong Play mode

- [ ] Console: `[HanoiCity] N content rows, 62 missions; <ngày giờ> Hanoi` (N = tổng số dòng nội
  dung, test `EveryContentFileLoadsStrictlyIntoTheGeneratedClasses` đếm cùng số).
- [ ] `HanoiGame.Instance.World.Missions.StartMission("c1_01_...")` từ một script thử; đi tới đích
  → sự kiện `StepCompleted`; xong nhiệm vụ → file lưu trong `Application.persistentDataPath`.
- [ ] Sự kiện ngẫu nhiên: đứng ở phố cổ, tua giờ (`World.Clock.Advance(TimeSpan.FromHours(1))`) →
  `RandomEvents.Started` thỉnh thoảng bắn (test chạy một tuần game ở phố cổ thấy 5 đến 168 lần).
- [ ] Lịch: đặt giờ tối thứ Sáu → `World.IsWorldEventActive("pho_di_bo_cuoi_tuan")` là true.

### 6.6 Feed thời tiết trực tiếp

Cùng feed với UE: `python -m live.weather --serve 8765` phục vụ
`GET http://127.0.0.1:8765/weather` (dạng JSON ở `05-tich-hop-ue5.md` mục 7.5).
`HanoiSettings.weatherEndpoint` để trống thì chỉ dùng khí hậu trung bình.

- [ ] Server đang chạy: `World.WeatherChanged` nhận `source = "open-meteo"`.
- [ ] Bản build gọi HTTP `127.0.0.1` được (Project Settings > Player > *Allow downloads over HTTP*
  nếu Unity chặn); phát hành thật thì dùng HTTPS.

### 6.7 Build thử

- [ ] File > Build Profiles > Windows (hoặc macOS), IL2CPP, Development: build xong không lỗi.
- [ ] Chạy bản build: log (`%USERPROFILE%\AppData\LocalLow\<công ty>\<sản phẩm>\Player.log`) có dòng
  content rows như trong editor; `StreamingAssets/Hanoi` có trong thư mục build.

## 7. Độ chính xác đã kiểm bằng test (không cần Unity)

`dotnet test unity/dotnet` (CI job `unity-core`), 108 test:

* Nội dung: mọi file `game/content` nạp chặt vào lớp sinh tự động, số dòng khớp JSON gốc; khoá lạ
  và enum sai bị từ chối; danh sách khoá `params` runtime khớp `x-consumer: runtime` của schema.
* Phép chiếu: trùng `hanoi_geo.py` tới 1 µm (bản Python trùng pyproj); mặt trời trùng bản Python
  tới 10⁻⁵ độ.
* Âm lịch: Tết 2024-2027 và 2030 (2/2/2030 ở Việt Nam, Trung Quốc là 3/2 vì sóc lúc 23:07 giờ Hà
  Nội), tháng 6 nhuận 2025, Trung thu 2026 (25/9), giao thừa 2026 22:00-01:00.
* Nhiệm vụ: rẽ nhánh, cờ, thưởng, đổi nhân vật, `fail_if heat`, chờ sự kiện, phạt, hạn giờ,
  hồ sơ sạch 90 ngày, lưu/nạp; **cả 62 nhiệm vụ thật chạy tới hết** dưới một "người chơi tự động".
* Thoại: cả 160 đoạn đi tới kết thúc, không đoạn nào giấu hết lựa chọn.
* Sự kiện ngẫu nhiên: mọi lựa chọn của cả 46 sự kiện đều kết thúc; mọi quận có ≥ 15 sự kiện có thể
  xảy ra; tâm mỗi quận được nhận đúng quận.
* Sưu tầm, kỹ năng, quán, cuốc xe, hoá đơn, Tết đóng cửa, đặt ô theo mọi giả định trục, A*.

## 8. Khác biệt so với bản UE (cố ý)

* **Không có bước chuyển đổi DataTable**: Unity đọc thẳng `game/content`; `codegen_unity.py` chỉ
  sinh lớp C#. Chặt hơn UE: một khoá gõ sai trong nội dung làm game dừng với thông báo rõ.
* **Kỹ năng lưu theo từng nhân vật** (Minh lái xe giỏi không làm Lan lái xe giỏi); UE lưu một
  bảng chung. `min_skills` đọc kỹ năng của nhân vật đang điều khiển.
* **`deadline_hour` bắt đầu đúng giờ hạn** (ví dụ nhận nhiệm vụ lúc 07:00, hạn 7 giờ sáng) tính là
  24 giờ, không phải 0. Đây không còn là khác biệt: PR này sửa cả bên UE
  (`HanoiMissionSubsystem.cpp`), trước đó `s09_bien_hieu_hang_thiec` thất bại ngay nếu nhận đúng 07:00.
  Test `test_deadline_at_its_own_hour_means_tomorrow_in_both_engines` giữ hai bên cùng luật.
* Lịch sự kiện (`WorldEventCalendar`) tự bật `events` theo ngày; `SetWorldEventActive` vẫn ghi đè
  bằng tay. UE chỉ có bật tay.
* Hệ thống mới chỉ có ở đây: sự kiện ngẫu nhiên, sưu tầm và băng, kinh tế, hoá đơn tháng.
  Các con số chỉnh được nằm ở `HanoiRules.cs`, mỗi số ghi nguồn (GDD hoặc playtest).
* Thời tiết `air.*` (bụi mịn) chưa có feed, chỉ bật tay.

## 9. Nếu GPU yếu: URP

HDRP cần VRAM ≥ 6 GB. Với GPU tích hợp hoặc 4 GB: đổi `com.unity.render-pipelines.high-definition`
trong `manifest.json` thành `com.unity.render-pipelines.universal`, tạo URP Asset, chuyển material
(Edit > Rendering > Materials > Convert). Lõi và editor không đổi; chỉ `HanoiSunDriver` cần đặt
cường độ theo đơn vị URP (khoảng 1-3 thay vì lux). Hình ảnh kém hơn rõ (không có volumetric fog,
GI thấp), đủ để làm gameplay và nhiệm vụ.

## 10. Claude Code điều khiển Unity qua MCP (chưa kiểm chứng)

Có vài server MCP cho Unity Editor (gói của Unity trong Unity AI, và các dự án cộng đồng như
"Unity MCP" trên GitHub mở một cổng cục bộ từ trong editor). Chưa thử cái nào trên máy có Unity:
khi cài, chọn một server, thêm bằng `claude mcp add`, gõ `/mcp` trong Claude Code để xác nhận
*connected*, rồi ghi lại tên gói và lệnh vào mục này. Quy tắc như bên UE: thay đổi lớn đi qua
menu/script trong `Editor/` (lặp lại được), không thao tác tay trong scene.

## 11. Việc tiếp theo khi khung chạy

1. **Stream theo ô**: 1.744 ô không thể nằm cùng một scene. Unity không có World Partition: chia
   mỗi ô (hoặc nhóm 2×2 ô) thành một scene Addressable, nạp/thả theo khoảng cách người chơi
   (`HanoiCityManifest.TilesByDistance` đã có), LOD và HLOD cho ô xa.
2. **Bộ kit mặt tiền** theo `building_archetypes` như mục 9.1 của tài liệu UE; prefab thay
   massing glb.
3. **Giao thông**: ECS (Entities) hoặc job system đọc `HanoiTrafficGraph`, tỉ lệ xe máy theo quận.
4. **UI**: nối `Missions.StepStarted`, `ChoiceRequested`, `RandomEvents.Started`, `Collectibles.TapeUnlocked`,
   `Economy.BillCharged` vào UI Toolkit.
