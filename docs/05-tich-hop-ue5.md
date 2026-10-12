# 05. Tích hợp Unreal Engine 5.8: làm gì vào ngày cài UE5

Thư mục `ue5/` là "khung" dự án Unreal cho Hanoi City. Viết và kiểm thử khi máy chưa có UE5,
nên phần C++ chưa được biên dịch lần nào. Mục tiêu là: mở project, để editor tự build, chạy
**một** script setup, rồi đi hết danh sách kiểm tra ở mục 7.

## 1. Có gì trong `ue5/`

| Đường dẫn | Nội dung |
| --- | --- |
| `HanoiCity.uproject` | `EngineAssociation: "5.8"`, module game mỏng `HanoiCity`, danh sách plugin |
| `Source/` | Target `HanoiCity` / `HanoiCityEditor` và module game chính (rỗng, chỉ để project là project C++) |
| `Config/DefaultEngine.ini` | DX12 + SM6, Lumen, Virtual Shadow Maps, Nanite, MegaLights, Python dev mode + remote execution |
| `Config/DefaultGame.ini` | Thiết lập `Hanoi City` (gốc toạ độ, bảng dữ liệu, đồng hồ, thời tiết, heat), staging `Data/City` |
| `Config/hanoi_setup.json` | Đường dẫn cho script setup (bản dựng thành phố, `game/content`, codegen, thư mục đích) |
| `Config/asset_map.json` | `Set/Kind` của điểm PCG → mesh (để trống cho tới khi có asset) |
| `Plugins/HanoiCity/` | Plugin chính: module `HanoiCityRuntime`, `HanoiCityEditor`, script Python trong `Content/Python/` |
| `Data/Generated/` | JSON nhập DataTable do `tools/codegen_ue.py` sinh ra từ `game/content` (gitignore) |

Runtime (`HanoiCityRuntime`):

| Lớp | Vai trò |
| --- | --- |
| `UHanoiCitySettings` | Project Settings > Game > Hanoi City (lưu trong `DefaultGame.ini`) |
| `UHanoiGeoSubsystem` (World) | lat/lon ↔ ENU (Transverse Mercator WGS84, chuỗi Krüger) ↔ toạ độ UE |
| `UHanoiContentSubsystem` (GameInstance) | nạp `DT_<collection>`, tra cứu `FHanoiRef`, vị trí của landmark/nhân vật/… |
| `UHanoiTimeWeatherSubsystem` (GameInstance) | đồng hồ giờ Hà Nội (UTC+7) có hệ số thời gian, đồng bộ giờ thật, thời tiết qua `IHanoiWeatherProvider`, quay mặt trời theo thuật toán NOAA |
| `UHanoiMissionSubsystem` (GameInstance) | chạy đồ thị bước nhiệm vụ từ dữ liệu, rẽ nhánh `next`, delegate cho UI, lưu tiến độ (nhiệm vụ, cờ, danh tiếng, tiền, phạt) |
| `UHanoiHeatSubsystem` (World) | "mức chú ý" của CSGT thay cho wanted level: vi phạm → heat 0-5 + tiền phạt, giảm dần khi khuất tầm nhìn |
| `AHanoiTrafficGraph` | đọc `traffic/graph.json`, tìm đường A* cho xe/NPC |
| `AHanoiPointSetActor` | HISM cho một `Set/Kind` trong một ô (từ CSV điểm PCG) |
| `Generated/HanoiContentTypes.h` | struct dòng DataTable sinh tự động từ `game/schemas` (không sửa tay) |

## 2. Phần cứng và ổ đĩa

* Windows 11 64-bit (đường chính; Linux build được nhưng MetaHumans/một số plugin kém hơn).
* CPU 8 nhân trở lên (build C++ và biên dịch shader rất nặng), RAM **64 GB** khuyến nghị (32 GB
  là tối thiểu thực tế cho World Partition cỡ thành phố), GPU hỗ trợ DX12 SM6 + ray tracing,
  VRAM ≥ 12 GB (RTX 3080/4070 trở lên) cho Nanite + Lumen + MegaLights.
* Ổ **NVMe SSD**, dành ≥ 300 GB: engine ~60-100 GB (kèm debug symbols còn nhiều hơn),
  Derived Data Cache 50-100 GB, project Hoàn Kiếm vài GB, cả Hà Nội (2,2 GB glb) sau khi nhập
  thành asset Nanite có thể 20-40 GB.

## 3. Cài đặt

1. Cài **Epic Games Launcher**, đăng nhập, tab Unreal Engine > Library > cài **5.8**. Trong
   Options chọn thêm *Editor symbols for debugging* (cần khi gỡ lỗi C++) và target Windows.
2. Cài **Visual Studio 2022** (bản Community được), workload *Game development with C++*,
   kèm *MSVC v143*, *Windows 11 SDK*, *.NET desktop* (cho UnrealBuildTool). Kiểm tra trang
   "Setting Up Visual Studio" của 5.8 xem có yêu cầu phiên bản toolchain cụ thể không.
3. Python của repo (đã có `venv`) chạy độc lập với UE. UE có Python 3.11 nhúng riêng; các
   script editor chỉ dùng thư viện chuẩn.

## 4. Mở project lần đầu

```bash
# 1) Sinh header C++ từ schema và JSON DataTable từ nội dung game (nếu schema đổi)
./venv/bin/python tools/codegen_ue.py
./venv/bin/python -m pytest tests/test_codegen_ue.py
# 2) Có sẵn một bản dựng thành phố, ví dụ out/hoankiem (build.py + pipeline)
```

1. Chuột phải `ue5/HanoiCity.uproject` > **Generate Visual Studio project files**.
2. Nhấp đúp `HanoiCity.uproject`. Editor báo thiếu module `HanoiCity`, `HanoiCityRuntime`,
   `HanoiCityEditor` > chọn **Yes** để build. Nếu build lỗi: mở `HanoiCity.sln`, cấu hình
   *Development Editor / Win64*, Build, đọc lỗi (mục 7 liệt kê các API dễ sai nhất).
3. Editor có thể báo không tìm thấy plugin tuỳ chọn (MCP, Mass…): các plugin đó được đánh dấu
   `Optional` nên project vẫn mở; bật lại bằng tay ở bước 5 nếu tên đã đổi.

## 5. Plugin

`HanoiCity.uproject` bật sẵn: `HanoiCity`, `PCG`, `PythonScriptPlugin`,
`EditorScriptingUtilities`, `Interchange`/`InterchangeEditor` (nhập glTF), `GLTFImporter`
(tuỳ chọn), `MassGameplay`, `MassAI`, `ZoneGraph` (giao thông về sau), `ModelContextProtocol` +
`AllToolsets` (MCP của Epic, thử nghiệm), `CesiumForUnreal` (**tắt**).

Kiểm tra ở Edit > Plugins: tất cả đều bật, không có cảnh báo "missing". Cesium for Unreal 2.29
hỗ trợ 5.6-5.8; chỉ bật khi muốn đặt thành phố trên quả địa cầu (Google Photorealistic 3D Tiles
làm nền tham chiếu). Khi bật Cesium, đặt `CesiumGeoreference` đúng `origin_lat/origin_lon` của
manifest; quy ước trục của chúng ta (X = đông, Y = nam, Z = lên) trùng với Cesium nên không cần
chuyển đổi thêm. Đồng thời tắt `bDriveSun` nếu dùng `CesiumSunSky`.

## 6. Chạy setup

Trong editor: **Tools > Hanoi City > Hanoi: Run Full Setup**, hoặc trong Output Log chọn chế độ
`Python` rồi:

```
py setup_project.py --city ../out/hoankiem --max-tiles 12
```

(đường dẫn tương đối so với thư mục chứa `HanoiCity.uproject`; bỏ `--max-tiles` để nhập hết).
Các bước script làm:

1. `import_content.py`: chạy bộ chuyển đổi của `tools/codegen_ue.py` → `ue5/Data/Generated/*.json`
   → tạo/cập nhật `/Game/Hanoi/Data/DT_<collection>` với struct dòng sinh tự động.
2. `import_city.py`: ghi gốc toạ độ vào `DefaultGame.ini`; tạo level `/Game/Maps/Hanoi` từ
   template Open World (World Partition); nhập `tiles/bld_*.glb` và `road_*.glb` (Nanite bật cho
   nhà); tự hiệu chỉnh trục (xem mục 7.2); đặt actor dưới thư mục Outliner `City/Buildings`,
   `City/Roads`; chép `traffic/graph.json`, `places/pois.json`, `districts.geojson` vào
   `Content/Data/City/`; đặt `AHanoiTrafficGraph` (không spatially loaded); đặt các mốc chữ
   `City/Verify`.
3. `import_pcg_points.py`: mỗi `pcg/<set>.csv` thành `DT_pcg_<set>` (struct `FHanoiPcgPointRow`,
   giữ nguyên ENU mét); với mỗi `Set/Kind` đã có mesh trong `Config/asset_map.json`, sinh một
   `AHanoiPointSetActor` (HISM) cho từng ô.

Chạy lại bất cứ lúc nào: asset bị thay, actor trong `City/*` được tạo lại.

Bản đồ ánh xạ của codegen (để đọc DataTable): `string`→`FString`, `$defs/id`→`FName`,
`$defs/ref`→`FHanoiRef{Collection, Id}`, `text`→`FHanoiText{Vi, En}`, `geo`→`FHanoiGeo{Lat, Lon,
AltM, bIsSet}`, `money_vnd`→`int64`, `hour_range`→`FHanoiHourRange{From, To}` (mặc định 0-24),
`enum`→`UENUM` có giá trị `Unset` = 0, tên PascalCase, `DisplayName` là chuỗi gốc; `oneOf geo|ref`
→`FHanoiTarget{Kind, Geo, Ref}`; `oneOf id|{khoá: id}`→`FHanoiNext{Step, Branches}`; object
tự do (`params`) → `FString` chứa JSON; thuộc tính `name` → `DisplayName` (vì DataTable JSON
dùng `"Name"` cho tên dòng), `class` → `ClassKind`, bool có tiền tố `b`.

## 7. Danh sách kiểm tra lần mở đầu tiên

### 7.1 Build: các API viết mà chưa biên dịch thử

Đánh dấu từng mục khi đã xác nhận. Nếu lỗi, sửa tại file ghi bên cạnh.

- [ ] `UTickableWorldSubsystem` (`Tick`, `GetStatId`) và `DoesSupportWorldType` override — `HanoiHeatSubsystem.h`
- [ ] Subsystem kế thừa thêm `FTickableGameObject` (`IsTickable`, `GetTickableTickType`) — `HanoiTimeWeatherSubsystem.h`, `HanoiMissionSubsystem.h`
- [ ] `Collection.InitializeDependency(UClass*)` — `HanoiMissionSubsystem.cpp`
- [ ] `UDeveloperSettings` với `UPROPERTY(config)` kiểu `double`/`int64`; `TryUpdateDefaultConfigFile()` — `HanoiCitySettings.h`, `HanoiCityEditorLibrary.cpp`
- [ ] `DECLARE_LOG_CATEGORY_EXTERN` có `HANOICITYRUNTIME_API` dùng được từ module editor
- [ ] UHT chấp nhận `TMap<FName, FName>`, `TSet<FName>`, `TArray<EHanoiWeather>`, `int64` trong USTRUCT BlueprintType; enum giá trị `Colonial1873_1954`
- [ ] Hàm `inline` ngoài UCLASS trong header sinh tự động (`HanoiGenerated::ForEachCollection`, dùng `TFunctionRef`)
- [ ] `UINTERFACE(meta=(CannotImplementInterfaceInBlueprint))` với hàm thuần ảo không phải UFUNCTION, giữ trong `TScriptInterface` UPROPERTY — `HanoiWeather.h`
- [ ] HTTP: `FHttpModule::Get().CreateRequest()` trả `TSharedRef<IHttpRequest, ESPMode::ThreadSafe>`, `OnProcessRequestComplete().BindLambda(FHttpRequestPtr, FHttpResponsePtr, bool)`, callback chạy trên game thread — `HanoiWeather.cpp`
- [ ] JSON: `TryGetArrayField(TEXT(...), const TArray<TSharedPtr<FJsonValue>>*&)`, `TryGetNumberField(..., double&)`, `FDateTime::ParseIso8601` — `HanoiTrafficGraph.cpp`, `HanoiWeather.cpp`
- [ ] `FDateTime::GetJulianDay()` (dùng cho NOAA) — `HanoiTimeWeatherSubsystem.cpp`
- [ ] `UHierarchicalInstancedStaticMeshComponent::AddInstances(TArray<FTransform>, bool)` và `SetCullDistances` (HISM có thể đã bị thay bằng ISM + "use HISM" trong 5.8) — `HanoiPointSetActor.cpp`
- [ ] `UEnum::GetValueByNameString("Drizzle")` nhận tên ngắn của enum class — `HanoiContentSubsystem.cpp`
- [ ] `UToolMenus::ExtendMenu("LevelEditor.MainMenu.Tools")`, `IPythonScriptPlugin::Get()->ExecPythonCommand` — module editor
- [ ] `TArray::HeapPush/HeapPop` với predicate — A* trong `HanoiTrafficGraph.cpp`

### 7.2 Python editor (UE 5.8 có thể đổi tên)

- [ ] `unreal.DataTableFactory` có property `struct`; `unreal.DataTableFunctionLibrary.fill_data_table_from_json_file(table, path, struct)` và `fill_data_table_from_csv_file` nhập đủ số dòng (script báo lỗi nếu thiếu)
- [ ] Bộ nhập DataTable JSON đọc được: struct lồng (object), `TMap` (object JSON), mảng enum, `int64`; không có cảnh báo "missing property" (bộ chuyển đổi ghi đủ mọi trường)
- [ ] `unreal.AssetImportTask` với glTF đi qua Interchange không bật hộp thoại khi `automated=True`; `imported_object_paths` chứa StaticMesh
- [ ] `nanite_settings.enabled`, `body_setup.collision_trace_flag`, `actor.is_spatially_loaded` (script chỉ cảnh báo nếu sai tên)
- [ ] `LevelEditorSubsystem.new_level_from_template(path, "/Engine/Maps/Templates/OpenWorld")` tạo level World Partition (nếu không: File > New Level > Open World, lưu thành `/Game/Maps/Hanoi`, chạy lại)
- [ ] Enum Python `unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE`, `unreal.HorizTextAligment.EHTA_CENTER`

### 7.3 Trục toạ độ (quan trọng nhất)

Hợp đồng: ENU mét (x đông, y bắc, z lên) → UE cm: `UE.X = 100x`, `UE.Y = −100y`, `UE.Z = 100z`,
`UE.Yaw = −yaw`. glTF của ô: X = đông, Y = lên, Z = −bắc, node mang tịnh tiến `(ox, 0, −oy)`.
Bộ nhập glTF đúng chuẩn đổi chỗ Y/Z (đồng thời đổi tay phải → tay trái) và m → cm, nên
`UE = (100·glTF.X, 100·glTF.Z, 100·glTF.Y)` và actor chỉ cần transform đơn vị.

`import_city.py` không tin giả định đó: nó đo bounding box của vài ô đã nhập, so với vùng
tâm các toà nhà (từ `bld_X_Y.json`, chiếu bằng cùng phép chiếu) và chọn trong 32 khả năng
(8 hoán vị có dấu × đơn vị m/cm × có/không giữ offset node), rồi tự bù bằng yaw/mirror/scale.

- [ ] Output Log có dòng `importer axis calibration: units=100.0 baked=True map=((1, 0), (0, -1))`. Khác dòng này nghĩa là bộ nhập 5.8 khác giả định; script đã bù, nhưng ghi lại vào đây.
- [ ] Các mốc chữ trong `City/Verify`: "Thap Rua" nằm trên đảo nhỏ giữa Hồ Gươm, "Nha hat Lon" trên Nhà hát Lớn, "Nha tho Lon" trên Nhà thờ Lớn (sai số cho phép ~20 m, toạ độ tham chiếu đo tay). Lệch đối xứng qua trục = sai dấu Y; xoay 90° = hoán vị trục.
- [ ] Nhìn từ trên xuống (Top view): phía bắc thành phố (hướng Hồ Tây) nằm về phía **−Y** của UE.
- [ ] Đường giao thông (`City/Roads`) khớp gầm nhà; `AHanoiTrafficGraph` > Details > `Draw Debug Graph` vẽ đường trùng lên mesh đường.
- [ ] Điểm PCG (khi đã có mesh) nằm trên vỉa hè, biển hiệu quay ra phố (nếu quay ngược: chỉnh `yaw_offset_deg` trong `asset_map.json`, không sửa code).

### 7.4 Runtime trong PIE

- [ ] Output Log: `Loaded N content tables from /Game/Hanoi/Data` với N = số collection có nội dung.
- [ ] Mặt trời: đặt `StartHour=7` → ánh nắng chiếu từ hướng đông (từ +X), 12:00 gần đỉnh đầu, 18:00 phía tây. Directional light phải là Movable (subsystem tự chuyển). Nếu level có nhiều directional light, gắn tag `HanoiSun` cho mặt trời.
- [ ] Thời tiết: `WeatherSource=Climatology` cho trạng thái khác nhau theo giờ; với feed thật xem mục 7.5.
- [ ] Nhiệm vụ: gọi `StartMission` trên một nhiệm vụ có bước `go_to`, đi tới đích → `OnStepCompleted`; nhiệm vụ xong → `OnMissionEnded` và có file lưu `Saved/SaveGames/HanoiSave.sav`.
- [ ] Heat: `ReportViolation(<id traffic_rules>, false, true, false)` → `OnHeatChanged`; đứng khuất tầm nhìn 20 s heat giảm dần; `PulledOver` trừ tiền phạt.

### 7.5 Feed thời tiết trực tiếp

`live/weather.py` phục vụ `GET http://127.0.0.1:8765/weather` (chạy `python -m live.weather --serve 8765`):

```json
{"time_utc": "2026-10-12T19:00:00Z", "local_hour": 2.0, "condition": "drizzle",
 "temperature_c": 24.1, "humidity": 0.86, "precip_mm_h": 0.3, "cloud_cover": 0.9,
 "wind_kmh": 9.0, "nom": false, "source": "open-meteo"}
```

`condition` thuộc enum thời tiết của `common.schema.json` (clear, cloudy, rain, storm, fog,
drizzle, hot, cold); `humidity`, `cloud_cover` trong 0-1; `nom` là đợt nồm ẩm (sàn, tường ướt).
`UHanoiHttpWeather::ParseFeed` đọc đúng dạng này vào `FHanoiWeatherState`. Bật bằng
`WeatherSource=LiveHttp` (đổi `WeatherEndpoint` nếu chạy chỗ khác, `WeatherPollSeconds` là chu kỳ
hỏi theo giây thật). Mất kết nối thì rơi về khí hậu trung bình (log cảnh báo).

- [ ] Với server đang chạy: PIE, `OnWeatherChanged` nhận đúng `condition` và `source`.
- [ ] Bản đóng gói (Shipping) gọi HTTP tới `127.0.0.1` không bị chặn; khi phát hành thật, endpoint phải là HTTPS.

### 7.6 Độ chính xác đã kiểm bằng test (không cần UE)

* Phép chiếu: bản Python giống hệt C++ (`hanoi_geo.py` ↔ `HanoiGeoSubsystem.cpp`), sai lệch
  so với pyproj < 1 µm khi chiếu xuôi trong toàn vùng Hà Nội; chiều ngược < 0,3 mm. Cả 17.688
  toà nhà Hoàn Kiếm chiếu vào đúng ô của chúng.
* Mặt trời NOAA: sai số thuật toán ~0,01° (bỏ qua khúc xạ khí quyển, ~0,5° khi sát chân trời).
* Bộ hiệu chỉnh trục: tìm lại đúng mọi cách nhập trong 32 khả năng (test tham số hoá).

## 8. Kết nối Claude Code qua MCP

**Plugin của Epic (ưu tiên)** — tên plugin `ModelContextProtocol` ("Unreal MCP"), cần thêm
`AllToolsets`; đã bật trong `.uproject` (Optional, chỉ editor). Server HTTP/SSE tại
`http://127.0.0.1:8000/mcp`, không xác thực, chỉ nghe loopback.

1. Editor Preferences > General > Model Context Protocol: bật *Auto Start Server* (hoặc lệnh
   console `ModelContextProtocol.StartServer`, hoặc chạy editor với `-ModelContextProtocolStartServer`).
2. Console: `ModelContextProtocol.GenerateClientConfig ClaudeCode` → ghi `.mcp.json` ở gốc
   project (`ue5/`, đã gitignore) với server `unreal-mcp`, kiểu `http`.
3. Mở Claude Code tại `ue5/` (hoặc thêm cùng mục đó vào `.mcp.json` ở gốc repo:
   `claude mcp add --transport http unreal-mcp http://127.0.0.1:8000/mcp`).
4. Thử: "liệt kê actor trong City/Verify", "chạy setup_project với --max-tiles 4".
   Với *Enable Tool Search* bật, Claude thấy các meta-tool `list_toolsets`, `describe_toolset`,
   `call_tool`.

**Server cộng đồng** (khi plugin Epic thiếu công cụ): các dự án `unreal-mcp` trên GitHub (ví dụ
chongdashu/unreal-mcp) dùng plugin C++ riêng mở cổng TCP và một server MCP Python. Một số khác
dùng *Python remote execution* của UE — đã bật sẵn `bRemoteExecution=True` trong
`DefaultEngine.ini`. Đọc README của server để biết cổng và lệnh `claude mcp add`.

Quy tắc khi để Claude điều khiển editor: mọi thay đổi lớn nên đi qua script trong
`Plugins/HanoiCity/Content/Python/` (lặp lại được, review được), không thao tác tay trong level.

## 9. Sau khi khung chạy: việc tiếp theo

1. **Facade kits** — mỗi `building_archetypes` có `facade.kit` (vd. `/Game/Hanoi/Kits/NhaOngPhoCo`).
   Làm module tường/cửa/ban công/mái theo lưới tầng 3,3 m; `semantics/footprints_X_Y.json` cho
   cạnh mặt tiền (`frontage`, `facing_deg`) để đặt cửa hàng đúng phía phố. Bước tiếp: script
   (hoặc PCG) thay massing glb bằng kit theo archetype, ưu tiên phố cổ quanh Hồ Gươm.
2. **PCG graphs** — đọc `DT_pcg_<set>` (hoặc CSV) + footprint: cây, cột điện và bó dây, biển
   hiệu, xe máy đỗ, hàng rong. Điền `Config/asset_map.json` để có ngay HISM, rồi chuyển dần sang
   PCG có biến thể theo `Variant`/`Seed` và phân vùng theo World Partition (PCG đã production-ready
   trong 5.8, chạy partitioned/runtime generation).
3. **Landmark hero assets** — theo `landmarks` (`modelling.priority`), dùng `overture_ids` để
   ẩn massing bị thay thế.
4. **MetaHumans** — `characters.appearance.metahuman_preset`; dùng MetaHuman Creator trong
   editor 5.8, giọng theo `voice.accent`.
5. **Giao thông Mass** — `AHanoiTrafficGraph` chỉ đủ cho nhiệm vụ/GPS và vài chục xe. Giao thông
   nền nên dùng Mass Entity + ZoneGraph: sinh ZoneGraph lane từ `traffic/graph.json` (số làn,
   một chiều, `motorbike_only`, `signal`), MassTraffic kiểu City Sample, tỉ lệ xe máy theo
   `districts.traffic_profile`. `UHanoiHeatSubsystem` nhận vi phạm từ đó.
6. **Ánh sáng đêm** — MegaLights cho đèn đường (`street_lights`) và biển neon (`shop_signs`).
7. **Địa hình** — `terrain/heightmap.png` là DSM 30 m (có cả nhà, cây), chỉ dùng làm tham khảo
   hoặc làm phẳng; manifest ghi `unreal_landscape_z_scale` nếu nhập Landscape.

## 10. Quy ước runtime cho người viết nội dung nhiệm vụ

* Bước tự hoàn thành: `go_to`, `ride`, `deliver`, `drive_passenger`, `follow` khi người chơi
  vào bán kính `params.radius_m` (mặc định 15 m) quanh `target`; `wait_until` khi giờ game nằm
  trong `params.hours` `[từ, đến]` hoặc `params.hour`; `escape_traffic_police` khi heat về 0
  (`params.heat` cộng heat lúc bắt đầu bước, mặc định 2).
* Các bước khác (`talk`, `choice`, `minigame`, `cook`, `cutscene`, `photograph`, `collect`) do
  gameplay/UI gọi `CompleteCurrentStep(<outcome>)`.
* `next`: chuỗi = bước kế; object = nhánh theo outcome, thiếu thì dùng khoá `default`; không có
  `next` = bước tiếp theo trong mảng. Id đặc biệt: `end`/`success` (hoàn thành), `fail`.
* `fail_if`: `time>N` (giây trong bước), `heat>=N` (cũng `> < <= ==`), `event:<tên>` (gameplay gọi
  `ReportEvent`), `flag:<tên>`; `params.time_limit_s` là cách viết tắt của giới hạn thời gian.
