# Đạo cụ dựng bằng code: tích hợp sand3d

[sand3d](https://github.com/Sandflow-ai/sand3d) là thư viện Python để viết một vật thể 3D thành một
chương trình ngắn (hình phẳng, khối, cắt gọt, ghép, khớp chuyển động) chạy trên `bpy` của Blender.
Nó được làm cho LLM viết: toàn bộ API khoảng 3.600 token, chi tiết gọi bằng tên, cùng chương trình thì
ra đúng một lưới, từng bit. Xuất được GLB, URDF, USDA, OBJ, STL.

## 1. Giấy phép: dùng thương mại được

| Thành phần | Giấy phép | Ý nghĩa với game bán |
| --- | --- | --- |
| sand3d (thư viện) | Apache-2.0 | Được dùng thương mại, sửa, phân phối; chỉ cần giữ thông báo bản quyền nếu phân phối chính thư viện. Ta không phân phối nó, chỉ chạy nó trong pipeline |
| `bpy` (Blender) | GPL | GPL ràng buộc phần mềm Blender, không ràng buộc file Blender xuất ra. Game không kèm `bpy`, chỉ kèm GLB nên không bị GPL lây sang |
| Dataset sand3d trên Hugging Face | CC BY 4.0 | Không dùng. Nếu sau này lấy chương trình từ dataset thì phải ghi công trong credits và ghi `CC-BY-4.0` trong `sources.json` |
| GLB ta build ra | `own-work` | Mỗi file có dòng riêng trong `game/assets/sources.json` |

Kết luận: không có rủi ro giấy phép như Hunyuan3D hay Stable Fast 3D (tài liệu 08). sand3d chỉ là
công cụ trong pipeline tài sản, không nằm trong runtime UE5 hay Unity.

## 2. Vì sao đặt ở pipeline tài sản

Hợp đồng tài sản (`game/assets/asset_specs.json`) có nhiều đạo cụ hình học đơn giản mà trước đây ghi
`route: hand` (dựng tay trong Blender): cột điện, đèn đường, đèn giao thông, nhà chờ xe buýt, cổng ngõ,
ghế đá, bó vỉa, mái bạt, bàn ghế vỉa hè. Image-to-3D làm những thứ này kém (cạnh méo, kích thước sai),
còn dựng tay thì chậm. Một chương trình sand3d 20-40 dòng ra đúng kích thước hợp đồng, đúng pivot, đổi
biến thể bằng tham số, và Claude Code viết hoặc sửa được trong một lượt.

Không chọn tích hợp vào Unity Editor hay plugin UE5 vì `bpy` là một Blender đầy đủ (vài trăm MB),
chỉ chạy trên Python 3.11 hoặc 3.13; đặt nó trong engine sẽ kéo GPL và Python vào project. Engine chỉ
nhận GLB như mọi nguồn tài sản khác.

## 3. Các file

| File | Vai trò |
| --- | --- |
| `game/assets/sand3d/<set>_<kind>.py` | Mỗi file một mục hợp đồng: hằng `SLOT` và hàm `build(variant)` trả về gốc vật thể, đơn vị mm, +X là `forward`, +Z lên |
| `tools/sand3d_build.py` | Chạy mọi chương trình cho mọi biến thể, xuất GLB, gộp lưới theo vật liệu, thêm UV chiếu hộp (1 đơn vị UV mỗi mét), ghi `assets_work/out/sand3d/SM_<set>_<kind>_v<n>.glb` |
| `requirements-sand3d.txt` | `sand3d==1.6.2` (kéo theo `bpy` 5.2 trên Python 3.13) và `trimesh` |
| `tests/test_sand3d.py` | Không cần bpy: mỗi chương trình khớp một mục `route: sand3d`, chỉ gọi động từ và vật liệu có thật của sand3d, có nguồn trong `sources.json`; bước gộp và UV qua được `check_assets.py` |
| CI job `sand3d-assets` | Cài sand3d, build hết, chạy `tools/check_assets.py`, đính kèm GLB vào lượt chạy (artifact `sand3d-props`) |

Mỗi mục chuyển sang sand3d giữ đường cũ ở `route_before_sand3d`, nên nếu một mục cần đẹp hơn mức hình
khối (ví dụ cột điện có dây rối, chữ nổi), vẫn dựng tay hoặc đi image-to-3D như cũ và nộp file đè lên.

## 4. 13 mục đã viết (33 file GLB)

| Mục | Biến thể | Ghi chú |
| --- | --- | --- |
| `pavement_seating/pho_quan` | 4 | Bàn inox thấp, 3-4 ghế nhựa đỏ/xanh, lọ tương ớt, ống đũa, hộp giấy |
| `pavement_seating/tra_da` | 4 | Băng gỗ thông, phích nước, 4-5 ghế nhựa |
| `pavement_seating/bia_hoi` | 4 | Bàn nhựa xanh, ghế đỏ, cốc bia, xô đá |
| `infrastructure/bench` | 1 | Ghế đá mài |
| `infrastructure/kerb` | 1 | Bó vỉa granite 1 m, bo cạnh trên |
| `infrastructure/traffic_signals` | 1 | Cột, hộp ba đèn có mái che, bảng đếm ngược; đèn là vật liệu phát sáng riêng |
| `infrastructure/bus_stop` | 1 | Khung thép, mái, vách kính, ghế, bảng lộ trình |
| `infrastructure/gate` | 1 | Cổng ngõ hai trụ, xà, biển tên (chữ do engine vẽ) |
| `power_poles/concrete_round` | 4 | Cột ly tâm; mức lộn xộn 0-3 = hộp nối, băng dán quảng cáo |
| `power_poles/concrete_h` | 4 | Cột chữ H, giằng, xà sứ; từ mức 2 có trạm biến áp treo |
| `street_lights/single` | 1 | Cột một cần, đầu LED phát sáng |
| `street_lights/boulevard` | 1 | Cột đôi giữa dải phân cách, đế trang trí |
| `awnings/canvas` | 6 | Bạt dốc, diềm, tay đỡ; 6 màu |

Hợp đồng được chỉnh ba chỗ cho khớp thực tế: `street_lights/single` có pivot ở chân cột (`base_pole`)
thay vì tâm khung bao, vì cần đèn vươn 1,6 m ra một phía; `infrastructure/traffic_signals` có 4 khe
vật liệu (khung, đèn đỏ, vàng, xanh); `infrastructure/bus_stop` có 3 khe (thép, kính, bảng).
`tools/check_assets.py` trước đây đếm mỗi lưới là một vật liệu, nay đếm theo tên vật liệu.

## 5. Chạy trên máy

Cần Python 3.13 (hoặc 3.11; không có `bpy` cho 3.12). Trên Windows:

```powershell
cd C:\vncity
py -3.13 -m venv venv-sand3d
venv-sand3d\Scripts\pip install -r requirements-sand3d.txt
venv-sand3d\Scripts\python tools\sand3d_build.py --check
```

GLB ra ở `assets_work\out\sand3d\`. Không muốn cài thì tải artifact `sand3d-props` của lượt CI mới
nhất trên GitHub (tab Actions). Từ đó vào UE5 theo mục 5 tài liệu 10, hoặc vào Unity bằng glTFast
(tài liệu 13).

Một mục: `python tools/sand3d_build.py --only infrastructure/bench --check`. Danh sách:
`python tools/sand3d_build.py --list` (không cần bpy).

## 6. Thêm một mục mới

1. Chọn một mục trong `asset_specs.json` có hình khối rõ ràng; đổi `route` thành `sand3d`, chép
   đường cũ sang `route_before_sand3d`.
2. Viết `game/assets/sand3d/<set>_<kind>.py` theo mẫu có sẵn. Đưa
   [docs/api.md của sand3d](https://github.com/Sandflow-ai/sand3d/blob/main/docs/api.md) cho Claude
   cùng mục hợp đồng (kích thước, pivot, `forward`, `material_slots`) là đủ để nó viết. Giữ số vật
   liệu khác nhau (loại + màu) không quá số khe.
3. `python tools/sand3d_build.py --write-sources`, rồi `--only <mục> --check`.
4. `python -m pytest tests/test_sand3d.py`.

## 7. Giới hạn

* Hình khối sạch, chưa có vết bẩn, rêu, dây rối: phần "sống" của phố cổ vẫn đến từ vật liệu CC0
  (Poly Haven, ambientCG), decal và PCG trong engine.
* UV chiếu hộp đủ cho vật liệu lặp (bê tông, thép sơn, nhựa); mục cần texture riêng (biển in) vẫn đi
  `hand_mesh_generated_print`.
* Không có LOD: các mục này nhỏ (dưới vài nghìn tam giác), dùng Nanite trong UE hoặc LOD Group của Unity.
* Không dùng sand3d cho xe máy, người, cây, công trình biểu tượng.
