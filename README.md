# vncity: bản sao số thành phố Việt Nam cho Unreal Engine 5

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
4. `estimated`: luật theo diện tích footprint (nhà ống < 150 m² → 4 tầng…). Phải thay trước
   khi phát hành.

## Giấy phép

Overture Maps: giấy phép ghi theo từng đối tượng (`sources[].license`); dòng gốc OSM theo ODbL.
Copernicus DEM: © DLR e.V. 2010-2014 và © Airbus Defence and Space GmbH 2014-2018, cung cấp
theo chương trình Copernicus của ESA. Ghi nguồn đầy đủ trong phần credits của game.
