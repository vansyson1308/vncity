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

### 3.1 Windows (đường chính)

1. Cài **Epic Games Launcher**, đăng nhập, tab Unreal Engine > Library > **+** > chọn **5.8** >
   Install. Trong *Options* giữ *Starter Content* tuỳ ý, bật *Editor symbols for debugging*
   (cần khi gỡ lỗi C++, thêm ~40-60 GB) và target platform *Windows*.
2. Cài **Visual Studio 2022** (Community được; nếu ghi chú phát hành 5.8 yêu cầu bản mới hơn thì
   theo ghi chú đó). Trong Visual Studio Installer chọn:
   * workload **Game development with C++**, bên phải đánh dấu thêm *Unreal Engine installer*,
     *IDE support for Unreal Engine*, *Unreal Engine Test Adapter* (nếu có);
   * workload **Desktop development with C++**;
   * tab *Individual components*: **MSVC v143 – VS 2022 C++ x64/x86 build tools (Latest)**,
     **Windows 11 SDK** (10.0.22621 trở lên), **.NET 8.0 Runtime** / *.NET desktop development*
     (UnrealBuildTool và AutomationTool chạy trên .NET).
   Xem trang "Setting Up Visual Studio for Unreal Engine" của 5.8 để biết đúng phiên bản
   toolchain được hỗ trợ; dùng MSVC quá mới hoặc quá cũ là lỗi build phổ biến nhất.
3. Clone repo này vào đường dẫn **ngắn, không dấu, không dấu cách** (ví dụ `D:\vncity`): đường
   dẫn dài vượt giới hạn 260 ký tự của Windows khi build, và tên có dấu tiếng Việt làm hỏng
   một số công cụ.
4. Python của repo (`venv`) chạy độc lập với UE. UE có Python 3.11 nhúng riêng; các script
   editor chỉ dùng thư viện chuẩn, không cần `pip install` gì trong UE.

### 3.2 macOS (phụ)

1. Epic Games Launcher > cài 5.8 (Apple Silicon được hỗ trợ).
2. Cài **Xcode** đúng phiên bản mà ghi chú phát hành 5.8 yêu cầu (App Store hoặc
   developer.apple.com), mở Xcode một lần để chấp nhận license, rồi
   `sudo xcode-select -s /Applications/Xcode.app`.
3. Thay "Generate Visual Studio project files" ở mục 4 bằng chuột phải `HanoiCity.uproject` >
   *Services* > **Generate Xcode Project**, hoặc chạy
   `"/Users/Shared/Epic Games/UE_5.8/Engine/Build/BatchFiles/Mac/GenerateProjectFiles.sh" -project="$PWD/ue5/HanoiCity.uproject" -game`.
   Lumen phần cứng / MegaLights trên Mac hạn chế hơn; không cần sửa ini, engine tự hạ cấp.

### 3.3 Bố cục thư mục mà script setup cần

Script setup tìm dữ liệu theo **đường dẫn tương đối so với thư mục chứa `HanoiCity.uproject`**
(tức `ue5/`), khai báo trong `ue5/Config/hanoi_setup.json`:

| Khoá | Mặc định | Là gì |
| --- | --- | --- |
| `city_build` | `../out/hoankiem` | bản dựng thành phố của pipeline (`manifest.json`, `tiles/`, `semantics/`, `pcg/`, `traffic/`) |
| `game_content` | `../game/content` | nội dung game (JSON) |
| `codegen` | `../tools/codegen_ue.py` | bộ sinh mã/chuyển đổi (script editor import trực tiếp file này) |
| `data_json_out` | `Data/Generated` | nơi ghi JSON DataTable (`ue5/Data/Generated`, gitignore) |

Vì vậy **giữ nguyên `ue5/` bên trong repo** (cạnh `out/`, `game/`, `tools/`). Nếu đặt bản dựng
thành phố ở chỗ khác thì sửa `city_build` (đường dẫn tuyệt đối cũng được) hoặc truyền
`--city <đường dẫn>` khi chạy setup. Không cần chép tay gì vào `Content/`: setup tự chép
`traffic/graph.json`, `places/pois.json`, `districts.geojson`, `manifest.json` vào
`ue5/Content/Data/City/` (runtime đọc từ đó, và thư mục này được đóng gói kèm game).

## 4. Mở project lần đầu

Làm đúng thứ tự; mỗi bước có cách kiểm tra.

**Bước 0 — chuẩn bị dữ liệu (ngoài UE, ở gốc repo):**

```bash
# Header C++ phải khớp game/schemas TRƯỚC khi build (lệnh --check thoát 1 nếu cũ)
./venv/bin/python tools/codegen_ue.py
./venv/bin/python tools/codegen_ue.py --check
./venv/bin/python -m pytest -q tests/test_codegen_ue.py
# Cần một bản dựng thành phố, mặc định out/hoankiem (build.py + pipeline, xem README)
ls out/hoankiem/manifest.json out/hoankiem/tiles out/hoankiem/semantics out/hoankiem/pcg out/hoankiem/traffic/graph.json
```

(Trên Windows: `venv\Scripts\python tools\codegen_ue.py`.)

**Bước 1 — sinh project file:** chuột phải `ue5/HanoiCity.uproject` > **Generate Visual Studio
project files** (trên Windows 11 có thể nằm trong *Show more options*). Nếu menu không có (chưa
liên kết file .uproject với engine), chạy:

```bat
"C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\Build.bat" -projectfiles -project="D:\vncity\ue5\HanoiCity.uproject" -game -engine
```

Kết quả: `ue5/HanoiCity.sln`.

**Bước 2 — build editor:** mở `HanoiCity.sln`, cấu hình **Development Editor**, nền tảng
**Win64**, project khởi động `HanoiCity`, Build (Ctrl+Shift+B). Lần đầu mất 5-20 phút. Hoặc
dòng lệnh:

```bat
"C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\Build.bat" HanoiCityEditor Win64 Development -Project="D:\vncity\ue5\HanoiCity.uproject" -WaitMutex
```

Build lỗi: đọc lỗi **đầu tiên** trong cửa sổ Output (không phải Error List), đối chiếu mục 7.1.
Lỗi UHT (`*.generated.h`, "Unrecognized type", "Nested containers") nghĩa là header sinh ra
không hợp lệ: sửa `tools/codegen_ue.py`, chạy lại bước 0, không sửa tay `HanoiContentTypes.h`.

**Bước 3 — mở editor:** nhấp đúp `HanoiCity.uproject` (hoặc F5 trong Visual Studio). Nếu bỏ
qua bước 2, editor hỏi build các module `HanoiCity`, `HanoiCityRuntime`, `HanoiCityEditor` >
**Yes** (lỗi thì quay lại bước 2 để xem log). Lần đầu biên dịch shader rất lâu (có thể hàng
giờ, xem góc phải dưới).

Những cảnh báo **bình thường** ở lần mở đầu:
* "Failed to load map /Game/Maps/Hanoi": level chưa có, setup ở mục 6 sẽ tạo.
* Plugin tuỳ chọn không tìm thấy (MCP, Mass…): được đánh dấu `Optional` nên project vẫn mở.
* Hỏi khởi động lại để bật plugin: chọn *Restart Now*.

**Bước 4 — kiểm tra nhanh trước khi setup:**
* Output Log (Window > Output Log) có dòng `[HanoiCity] editor scripts ready` (Python plugin
  chạy, thấy được `Content/Python` của plugin).
* Menu **Tools** có mục **Hanoi City** (module editor đã nạp).
* Edit > Project Settings > Game > **Hanoi City** hiện các thiết lập (module runtime đã nạp).
* Edit > Editor Preferences > Python: đã bật *Developer Mode* (từ `DefaultEngine.ini`).

**Khi đổi C++ hoặc schema về sau:** đóng editor, chạy lại `tools/codegen_ue.py` nếu schema
đổi, build lại ở bước 2, rồi mở editor. Live Coding (Ctrl+Alt+F11) chỉ dùng cho sửa thân hàm;
thêm/đổi `UPROPERTY`, `UFUNCTION`, struct hay enum thì phải đóng editor và build đầy đủ.

## 5. Plugin

`HanoiCity.uproject` bật sẵn: `HanoiCity`, `PCG`, `PythonScriptPlugin`,
`EditorScriptingUtilities`, `Interchange`/`InterchangeEditor` (nhập glTF/glb), `MassGameplay`,
`MassAI`, `ZoneGraph` (giao thông về sau), `ModelContextProtocol` + `AllToolsets` (MCP của Epic,
thử nghiệm), `CesiumForUnreal` (**tắt**). Plugin `GLTFImporter` cũ (Datasmith) cố ý **không**
bật: nếu nó cũng đăng ký đuôi `.glb` thì không rõ bộ nhập nào chạy; Interchange là bộ nhập glTF
chuẩn của UE 5.x.

Kiểm tra ở Edit > Plugins (ô tìm kiếm): `HanoiCity`, `PCG`, `Python Editor Script Plugin`,
`Editor Scripting Utilities`, `Interchange` đều bật — năm plugin này là bắt buộc. Các plugin
`Optional` (Mass, ZoneGraph, MCP) nếu tên trong 5.8 khác thì editor bỏ qua im lặng: tìm tên
mới trong Edit > Plugins, bật tay, rồi sửa tên trong `HanoiCity.uproject`. Cesium for Unreal 2.29
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

(đường dẫn tương đối so với thư mục chứa `HanoiCity.uproject`, xem mục 3.3; bỏ `--max-tiles` để
nhập hết; nên để ít nhất 2 ô để bộ hiệu chỉnh trục có đủ dữ kiện). Các cờ khác: `--content
<dir>`, `--skip-tiles`, `--skip-points`, `--skip-content`. Menu Tools chạy với giá trị mặc định
trong `Config/hanoi_setup.json`. Kết quả từng bước in ở cuối Output Log (`setup summary`,
`OK`/`FAIL`). Các bước script làm:

1. `import_content.py`: chạy bộ chuyển đổi của `tools/codegen_ue.py` → `ue5/Data/Generated/*.json`
   → tạo/cập nhật `/Game/Hanoi/Data/DT_<collection>` với struct dòng sinh tự động.
2. `import_city.py`: ghi gốc toạ độ vào `DefaultGame.ini`; tạo level `/Game/Maps/Hanoi` từ
   template Open World (World Partition); nhập `tiles/bld_*.glb` và `road_*.glb` (Nanite bật cho
   nhà; mỗi file vào thư mục riêng `/Game/Hanoi/City/Tiles/<ô>/<bld|road>`, ô âm viết `m1_m2`);
   tự hiệu chỉnh trục (xem mục 7.3); đặt actor dưới thư mục Outliner `City/Buildings`,
   `City/Roads`; chép `traffic/graph.json`, `places/pois.json`, `districts.geojson`,
   `manifest.json` vào `Content/Data/City/`; đặt `AHanoiTrafficGraph` (không spatially loaded);
   đặt các mốc chữ `City/Verify`; lưu level.
3. `import_pcg_points.py`: mỗi `pcg/<set>.csv` thành `DT_pcg_<set>` (struct `FHanoiPcgPointRow`,
   giữ nguyên ENU mét); với mỗi `Set/Kind` đã có mesh trong `Config/asset_map.json`, sinh một
   `AHanoiPointSetActor` (HISM) cho từng ô.

Chạy lại bất cứ lúc nào: asset bị thay, actor trong `City/*` được tạo lại (script nạp toàn bộ
actor World Partition trước khi xoá để không bị trùng; nếu Output Log cảnh báo không nạp được,
mở cửa sổ World Partition, chọn hết ô > *Load Region From Selection* rồi chạy lại).

Sau setup: **File > Save All**, đóng và mở lại editor một lần (để `DefaultGame.ini` có gốc toạ độ
mới được đọc lại sạch sẽ), rồi đi danh sách kiểm tra mục 7.

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
- [ ] `USceneComponent::Mobility` truy cập trực tiếp (public) và `SetMobility` lúc chạy — `HanoiTimeWeatherSubsystem.cpp` (`FindSun`)
- [ ] `FRegexPattern`/`FRegexMatcher` (kiểm `fail_if`), delegate động 4 tham số có `const TArray<FName>&` (`OnChoiceRequested`), `TryGetObjectField` — `HanoiMissionSubsystem.cpp/.h`
- [ ] UFUNCTION trả struct theo giá trị (`GetWeather`, `GetPlayerState`); nút `Reload Graph` (CallInEditor, không tham số, không giá trị trả về) hiện trong Details của `AHanoiTrafficGraph`
- [ ] Không có cảnh báo C4244/C4458 (double→float, che biến thành viên): `BuildSettingsVersion.Latest` có thể biến chúng thành lỗi
- [ ] Đóng gói: `DefaultGame.ini` có `+DirectoriesToAlwaysCook=(Path="/Game/Hanoi/Data")` (DataTable nạp bằng đường dẫn) và `+DirectoriesToAlwaysStageAsUFS=(Path="Data/City")` (graph.json đọc bằng `FFileHelper`)

### 7.2 Python editor (UE 5.8 có thể đổi tên)

- [ ] `unreal.DataTableFactory` có property `struct`; `unreal.DataTableFunctionLibrary.fill_data_table_from_json_file(table, path, struct)` và `fill_data_table_from_csv_file` nhập đủ số dòng (script báo lỗi nếu thiếu)
- [ ] Bộ nhập DataTable JSON đọc được: struct lồng (object), `TMap` (object JSON), mảng enum, `int64`; không có cảnh báo "missing property" (bộ chuyển đổi ghi đủ mọi trường)
- [ ] `unreal.AssetImportTask` với glTF đi qua Interchange không bật hộp thoại khi `automated=True`; mỗi `.glb` cho đúng **một** StaticMesh (script đọc `imported_object_paths`, rồi `get_objects()`, rồi liệt kê thư mục đích; cảnh báo "produced no StaticMesh" nghĩa là cả ba cách đều rỗng)
- [ ] `unreal.WorldPartitionBlueprintLibrary.get_actor_descs()` / `load_actors()` dùng được (nếu không, xem cảnh báo ở mục 6)
- [ ] `nanite_settings.enabled`, `body_setup.collision_trace_flag`, `actor.is_spatially_loaded` (script chỉ cảnh báo nếu sai tên)
- [ ] `LevelEditorSubsystem.new_level_from_template(path, "/Engine/Maps/Templates/OpenWorld")` tạo level World Partition (nếu không: File > New Level > Open World, lưu thành `/Game/Maps/Hanoi`, chạy lại)
- [ ] Enum Python `unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE`, `unreal.HorizTextAligment.EHTA_CENTER`

### 7.3 Trục toạ độ (quan trọng nhất)

Hợp đồng: ENU mét (x đông, y bắc, z lên) → UE cm: `UE.X = 100x`, `UE.Y = −100y`, `UE.Z = 100z`,
`UE.Yaw = −yaw`. glTF của ô: X = đông, Y = lên, Z = −bắc, node mang tịnh tiến `(ox, 0, −oy)`.
Bộ nhập glTF đúng chuẩn đổi chỗ Y/Z (đồng thời đổi tay phải → tay trái) và m → cm, nên
`UE = (100·glTF.X, 100·glTF.Z, 100·glTF.Y)` và actor chỉ cần transform đơn vị.

`import_city.py` không tin giả định đó: nó đo bounding box của tối đa 16 ô đã nhập, so với
khung mặt bằng chính xác của các footprint (`semantics/footprints_X_Y.json`; thiếu thì dùng tâm
toà nhà trong `tiles/bld_X_Y.json` cộng lề) và chọn trong 32 khả năng (8 hoán vị có dấu × đơn vị
m/cm × có/không giữ offset node) theo **tổng** IoU trên mọi ô, rồi tự bù bằng yaw/mirror/scale.
(Chấm điểm chung là bắt buộc: các ô quanh gốc gần như vuông nên một ô riêng lẻ không phân biệt
được phép xoay 90°; test `test_real_tiles_calibrate_*` kiểm điều này trên dữ liệu Hoàn Kiếm.)

- [ ] Output Log có dòng `importer axis calibration: units=100.0 baked=True map=((1, 0), (0, -1)) (N tiles, IoU 0.99-1.00, ...)`. Khác dòng này nghĩa là bộ nhập 5.8 khác giả định; script đã bù, nhưng ghi lại vào đây. Cảnh báo "ambiguous" thì nhập thêm ô (`--max-tiles` lớn hơn) và kiểm kỹ các mốc.
- [ ] Các mốc chữ trong `City/Verify`: "Thap Rua" nằm trên đảo nhỏ giữa Hồ Gươm, "Nha hat Lon" trên Nhà hát Lớn, "Nha tho Lon" trên Nhà thờ Lớn (sai số cho phép ~20 m, toạ độ tham chiếu đo tay). Lệch đối xứng qua trục = sai dấu Y; xoay 90° = hoán vị trục.
- [ ] Nhìn từ trên xuống (Top view): phía bắc thành phố (hướng Hồ Tây) nằm về phía **−Y** của UE.
- [ ] Đường giao thông (`City/Roads`) khớp gầm nhà; `AHanoiTrafficGraph` > Details > `Reload Graph` rồi `Draw Debug Graph` vẽ đường trùng lên mesh đường (đồ thị Hoàn Kiếm: 2285 nút, 2721 cạnh — Output Log in số này).
- [ ] Điểm PCG (khi đã có mesh) nằm trên vỉa hè, biển hiệu quay ra phố (nếu quay ngược: chỉnh `yaw_offset_deg` trong `asset_map.json`, không sửa code).

### 7.4 Runtime trong PIE

- [ ] Output Log: `Loaded N content tables from /Game/Hanoi/Data` với N = số collection có nội dung.
- [ ] Mặt trời: đặt `StartHour=7` → ánh nắng chiếu từ hướng đông (từ +X), 12:00 gần đỉnh đầu, 18:00 phía tây. Directional light phải là Movable (subsystem tự chuyển). Nếu level có nhiều directional light, gắn tag `HanoiSun` cho mặt trời.
- [ ] Thời tiết: `WeatherSource=Climatology` cho trạng thái khác nhau theo giờ; với feed thật xem mục 7.5.
- [ ] Nhiệm vụ: gọi `StartMission` trên một nhiệm vụ có bước `go_to`, đi tới đích → `OnStepCompleted`; nhiệm vụ xong → `OnMissionEnded` và có file lưu `Saved/SaveGames/HanoiSave.sav`.
- [ ] Tham số bước: nhiệm vụ `c1_03` phát `OnChoiceRequested` ở bước `co_hoi_khong`; `p1` bước `bi_thoi` phát `OnFineApplied` (vuot_den_do); `s04` bước `nam_dia_chi` phát `OnMinimapVisibilityChanged(false)`; `s11` bước `gap_ba` chờ `SetWorldEventActive("trung_thu", true)`.
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

### 7.6 Đóng gói thử (khi 7.1-7.4 đã xong)

- [ ] Platforms > Windows > *Package Project* (Development) chạy hết, không lỗi cook.
- [ ] Chạy bản đóng gói: Log (`Saved/Logs`) có `Loaded N content tables` với N như trong PIE và
  `Traffic graph: 2285 nodes, 2721 edges` (nếu N = 0: thiếu `DirectoriesToAlwaysCook`; nếu
  graph lỗi: thiếu `DirectoriesToAlwaysStageAsUFS`).

### 7.7 Độ chính xác đã kiểm bằng test (không cần UE)

* Phép chiếu: bản Python giống hệt C++ (`hanoi_geo.py` ↔ `HanoiGeoSubsystem.cpp`), sai lệch
  so với pyproj < 1 µm khi chiếu xuôi trong toàn vùng Hà Nội; chiều ngược < 0,3 mm. Cả 17.688
  toà nhà Hoàn Kiếm chiếu vào đúng ô của chúng.
* Mặt trời NOAA: sai số thuật toán ~0,01° (bỏ qua khúc xạ khí quyển, ~0,5° khi sát chân trời).
* Bộ hiệu chỉnh trục: tìm lại đúng mọi cách nhập trong 32 khả năng (test tham số hoá), và trên
  glb thật của Hoàn Kiếm (mô phỏng bộ nhập chuẩn) cho đúng transform đơn vị với 1, 2, 4, 7, 16 ô.
* Dữ liệu thật đi qua đúng bộ đọc: mọi dòng JSON DataTable khớp tên `UPROPERTY` đọc từ chính
  file header; mọi CSV điểm PCG khớp `FHanoiPcgPointRow` (Seed vượt int32 → `int64`, khoá ô âm
  như `-1_-2`); `traffic/graph.json` thoả các giả định của `AHanoiTrafficGraph::LoadGraph`;
  footprint trong `semantics/` khớp phép chiếu tới vài mm.

## 8. Kết nối Claude Code qua MCP

Tên plugin, lệnh console và cổng dưới đây **chưa kiểm chứng trên máy có UE 5.8**: nếu khác,
tìm "MCP" trong Edit > Plugins và Editor Preferences, sửa lại mục này và tên trong
`HanoiCity.uproject`. Cách kiểm tra cuối cùng luôn là: trong Claude Code gõ `/mcp`, server
`unreal-mcp` ở trạng thái *connected* và liệt kê được công cụ.

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

Quy ước đầy đủ (mọi khóa `params`, ai đọc khóa nào) ở `docs/gdd/02-he-thong.md` §8 và trong mô tả
từng khóa của `game/schemas/missions.schema.json`. Tóm tắt phía UE:

* Bước tự hoàn thành: `go_to`, `ride`, `deliver`, `drive_passenger`, `follow` khi người chơi
  vào bán kính `params.radius_m` (mặc định 15 m) quanh `target`; `wait_until` khi giờ game nằm
  trong `params.hours` `[từ, đến)` hoặc `params.until_hour`/`params.hour`; `escape_traffic_police`
  khi heat về 0 (`params.heat` cộng heat lúc bắt đầu bước, mặc định 2).
* Các bước khác (`talk`, `choice`, `minigame`, `cook`, `cutscene`, `photograph`, `collect`) do
  gameplay/UI gọi `CompleteCurrentStep(<outcome>)`. Bước có `params.requires_event` chỉ hoàn thành
  khi `SetWorldEventActive(<event>, true)` đã được gọi; nếu đó là bước đầu tiên thì nhiệm vụ cũng
  chưa bắt đầu được (`CanStartMission` trả "waits for event").
* `StartMission` tự đổi sang `protagonists[0]` khi nhân vật đang điều khiển không thuộc nhiệm vụ.
* Cờ `ho_so_sach_90_ngay` do runtime đặt sau `Settings.CleanRecordDays` ngày game không bị phạt
  (`State.LastFineGameTime`; gameplay phạt ngoài nhiệm vụ phải đi qua `UHanoiHeatSubsystem` hoặc
  gọi `RecordFine()`).
* `next`: chuỗi = bước kế; object = nhánh theo outcome, thiếu thì dùng khoá `default`; không có
  `next` = bước tiếp theo trong mảng. Id đặc biệt: `end`/`success` (hoàn thành), `fail`.
  `choice` với `branch_source: "flag"` tự rẽ theo cờ; còn lại phát `OnChoiceRequested`.
* `steps[].set_flags` áp khi bước hoàn thành.
* `fail_if`: `time>N` (giây trong bước), `heat>=N` (cũng `> < <= ==`), `event:<tên>` (gameplay gọi
  `ReportEvent`), `flag:<tên>`; `params.time_limit_s` = giới hạn giây; `params.deadline_hour` = giờ
  game chót.
* Delegate cho UI/gameplay trên `UHanoiMissionSubsystem`: `OnStepStarted`, `OnStepCompleted`,
  `OnMissionEnded`, `OnStateChanged`, `OnChoiceRequested`, `OnFineApplied`,
  `OnProtagonistSwitched`, `OnMinimapVisibilityChanged`, `OnStepWaitingForEvent`. Gọi vào:
  `CompleteCurrentStep`, `ReportEvent`, `NotifyDialogueLine`, `SetWorldEventActive`,
  `GetActiveStepParamNumber/String/Bool`, `GetActiveStepParamsJson`, `IsMinimapAllowed`.
