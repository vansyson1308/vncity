# Hanoi City

Một thế giới mở kiểu GTA5 đặt ở Hà Nội, không bạo lực: nhìn là nhận ra Hà Nội, dựng từ dữ liệu
thật và cập nhật theo dữ liệu thật. Repo này chứa **mọi thứ trước khi cắm vào Unreal Engine 5**:
pipeline dựng thành phố, dữ liệu thiết kế game, và harness để nạp tất cả vào UE 5.8.

| Thư mục | Nội dung |
| --- | --- |
| `fetch.py`, `build.py` | Lấy dữ liệu mở (Overture Maps, Copernicus DEM) và dựng khối 3D theo ô |
| `pipeline/` | Lớp ngữ nghĩa: 13 kiểu nhà Hà Nội, mặt tiền hướng phố, đồ thị giao thông, đạo cụ đường phố cho PCG |
| `live/` | Thời tiết thật (hoặc khí hậu nướng sẵn), cập nhật bản đồ khi Overture ra bản mới |
| `game/schemas`, `game/content` | Thiết kế game dạng dữ liệu: quận, công trình, nhân vật, xe, việc làm, nhiệm vụ, hội thoại, sự kiện, luật giao thông |
| `ue5/` | Project UE 5.8, plugin `HanoiCity` (C++), script import Python |
| `tools/` | Kiểm tra nội dung, sinh USTRUCT từ schema, xuất bản xem trước web |
| `docs/` | Nghiên cứu, kiến trúc, giấy phép dữ liệu, hướng dẫn tích hợp UE5, lộ trình, tài liệu thiết kế game |

Đọc trước: [docs/02-kien-truc.md](docs/02-kien-truc.md), rồi [docs/06-lo-trinh.md](docs/06-lo-trinh.md). Ngày cắm UE5: [docs/05-tich-hop-ue5.md](docs/05-tich-hop-ue5.md); kết quả QC cuối: [docs/07-qc-checklist.md](docs/07-qc-checklist.md).

## Chạy nhanh

```bash
python -m venv venv && ./venv/bin/pip install -r requirements.txt -r requirements-dev.txt

# Cả pipeline cho phố cổ + hồ Gươm (~5 phút, phần lớn là tải dữ liệu)
./venv/bin/python -m pipeline.run --name hoankiem --bbox 105.840,21.020,105.860,21.042

./venv/bin/python tools/validate.py      # nội dung game khớp schema, tham chiếu đúng
./venv/bin/python -m pytest -q           # kiểm thử
./venv/bin/python -m live.weather        # thời tiết Hà Nội ngay lúc này
```

Kết quả trên khung Hoàn Kiếm (Overture 2026-09-23.0): 17.688 tòa nhà được phân loại theo 13 kiểu
nhà Hà Nội, 2.285 nút / 111 km đường xe chạy được (98,9% liên thông, 134 nút có đèn tín hiệu),
khoảng 63.000 đạo cụ đường phố (biển hiệu theo cửa hàng thật, xe máy đỗ, ghế nhựa, hàng rong, cây,
cột điện và bó dây). Xem trước 3D: `tools/export_web_demo.py` + `viewer/city.html`.

![Phố cổ và hồ Gươm, bản xem trước 3D](docs/img/preview_3d_day.png)

![Lớp ngữ nghĩa phố cổ: kiểu nhà, mặt tiền, đạo cụ](docs/img/semantic_old_quarter.png)

Nếu máy không tải được extension DuckDB từ extensions.duckdb.org, cài bản đóng gói trên PyPI:
`pip install duckdb==1.5.5 duckdb-extension-httpfs duckdb-extension-spatial` (vẫn kiểm tra chữ ký).

---

## Pipeline khối thành phố (fetch.py, build.py)

Pipeline dựng khung thành phố tỷ lệ 1:1 từ dữ liệu mở (không dùng dữ liệu Google Earth).

```bash
python -m venv venv && ./venv/bin/pip install -r requirements.txt

# Một khu vực nhỏ theo bbox (tây,nam,đông,bắc)
./venv/bin/python fetch.py --name caugiay --bbox 105.785,21.028,105.805,21.040
./venv/bin/python build.py --name caugiay --tile 500

# Cả tỉnh/thành theo mã ISO 3166-2 (ranh giới sau sáp nhập 2025)
./venv/bin/python fetch.py --name hanoi --region VN-HN
./venv/bin/python build.py --name hanoi --tile 1000
./venv/bin/python fetch.py --name saigon --region VN-SG
```

`fetch.py` đọc trực tiếp GeoParquet của Overture Maps trên S3 công khai (truy cập ẩn danh) và
Copernicus DEM GLO-30. `build.py` chia việc theo ô: tiến trình chính chỉ tính khóa ô, mỗi worker
tự đọc ô của mình, nên bộ nhớ không tăng theo kích thước thành phố.

Số đo trên máy 4 nhân, 16 GB RAM (Overture 2026-09-23.0):

| Vùng | Tòa nhà | Đoạn đường | Tải dữ liệu | Dựng | Đầu ra |
| --- | --- | --- | --- | --- | --- |
| Cầu Giấy (bbox 2,1 × 1,3 km) | 8.912 | 1.701 | 2,5 phút | 7 giây | 24 ô 500 m |
| TP Hà Nội (VN-HN) | 2.509.832 | 301.549 | ~4 phút | 17 phút | 3.512 ô 1 km, 53,2 triệu tam giác, 2,2 GB |

## Xem trên trình duyệt

```bash
./venv/bin/python package_viewer.py --name caugiay --overview out/hanoi/preview.png
python -m http.server -d site/caugiay
```

`viewer/index.html` là trình xem three.js: xoay quanh khu vực, bấm vào một tòa để xem chiều cao
và nguồn của nó. Ô được gửi dưới dạng base64 (`.glb.txt`) vì nhiều nơi lưu trữ không phục vụ
`.glb` và chặn `fetch` tới URL `data:`.

## Đầu ra (`out/<name>/`)

| File | Nội dung |
| --- | --- |
| `manifest.json` | gốc toạ độ (lat/lon), phép chiếu, danh sách ô, thống kê nguồn chiều cao, giấy phép |
| `tiles/bld_X_Y.glb` | tòa nhà đùn khối của một ô; màu đỉnh = nguồn chiều cao |
| `tiles/bld_X_Y.json` | thuộc tính từng tòa + `face_start`/`face_count` trong mesh của ô |
| `tiles/road_X_Y.glb` | dải đường bộ / đường sắt đã cắt theo ô |
| `terrain/heightmap.png` | heightmap 16-bit; manifest ghi Z scale cho UE Landscape |
| `preview.png` | ảnh nhìn từ trên xuống |

Hệ toạ độ: Transverse Mercator đặt tâm tại `origin_lat/origin_lon`, đơn vị mét.
glTF: X = đông, Y = lên, Z = −bắc. Đỉnh của mỗi ô tính tương đối với góc tây-nam của ô;
node của ô mang phép tịnh tiến `origin_m`.

## Nguồn chiều cao (`height_source`)

Theo thứ tự ưu tiên:

1. `observed`: Overture có `height`.
2. `derived_floors`: `num_floors × 3,3 m`.
3. `derived_raster`: trung vị raster chiều cao trong footprint (`--heights-tif`, ví dụ Google
   Open Buildings 2.5D Temporal xuất từ Earth Engine, đơn vị mét).
4. `estimated_archetype`: số tầng điển hình của kiểu nhà Hà Nội mà `pipeline/semantics.py` gán
   cho tòa nhà (ví dụ nhà ống phố cổ 2-4 tầng, khu tập thể 4-5 tầng).
5. `estimated`: luật theo diện tích footprint, chỉ dùng khi chưa chạy `pipeline.semantics`.

## Giấy phép

Overture Maps: giấy phép ghi theo từng đối tượng (`sources[].license`); dòng gốc OSM theo ODbL.
Copernicus DEM: © DLR e.V. 2010-2014 và © Airbus Defence and Space GmbH 2014-2018, cung cấp
theo chương trình Copernicus của ESA. Ghi nguồn đầy đủ trong phần credits của game.
