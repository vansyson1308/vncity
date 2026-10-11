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

`viewer/walk.html` là bản chơi thử **góc nhìn thứ ba**: đi bộ trên vỉa hè thật của khu vực
(WASD, Shift để chạy, kéo chuột để xoay, thanh giờ đặt mặt trời theo vĩ độ Hà Nội). Mặt tiền,
cửa cuốn, biển hiệu, ban công, điều hòa, téc nước, cây, cột điện và dây, xe máy đỗ, ghế nhựa
đều sinh trong trình duyệt từ "công thức mặt tiền" của từng tòa. Thêm `#lite` vào URL để tắt
bóng đổ trên máy yếu. Lựa chọn công nghệ cho bản Unreal: [docs/research-2026-10.md](docs/research-2026-10.md).

`viewer/index.html` là trình xem three.js: xoay quanh khu vực, bấm vào một tòa để xem chiều cao
và nguồn của nó. Ô được gửi dưới dạng base64 (`.glb.txt`) vì nhiều nơi lưu trữ không phục vụ
`.glb` và chặn `fetch` tới URL `data:`.

## Ảnh đường phố thật (`streetview.py`)

Ảnh 360° mở của [KartaView](https://kartaview.org) (CC BY-SA 4.0, mặt người và biển số đã được
KartaView làm mờ) cho diện mạo thật ở mặt đất mà dữ liệu bản đồ không có.

```bash
./venv/bin/python streetview.py harvest   --name caugiay   # danh sách ảnh trong khu vực
./venv/bin/python streetview.py download  --name caugiay   # ảnh cầu 360° đầy đủ (~23 MB/ảnh)
./venv/bin/python streetview.py sequences --name caugiay   # chuỗi chụp, để suy hướng di chuyển
./venv/bin/python streetview.py pose      --name caugiay   # sửa tư thế GPS điện thoại
./venv/bin/python streetview.py facades   --name caugiay   # chiếu ảnh lên mặt tiền (thử nghiệm)
./venv/bin/python streetview.py viewer    --name caugiay --site site/caugiay
```

`pose` kéo mỗi ảnh về làn đường bên phải gần nhất, vì người chụp luôn đi trên đường. Hướng
lấy theo thứ tự tin cậy: hướng di chuyển trong chuỗi, la bàn ghi kèm, rồi chỗ bầu trời lộ ra so
với mô hình khối nhà. KartaView để trống hướng khi thiết bị không ghi; trống được giữ là trống,
không bị đọc thành hướng Bắc. Mỗi ảnh mang nhãn `quality`; ảnh `uncertain` không dùng để dán
mặt tiền.

Trong `walk.html`, cột xanh đánh dấu điểm chụp; đứng gần rồi bấm `P` để nhìn ảnh 360° tại đúng
chỗ đó.

Cầu Giấy (11/10/2026): 344 ảnh, 107 ảnh cầu 360°, 72 chuỗi (59 chuỗi chỉ một ảnh). Sau `pose`:
56 ảnh có hướng từ chuỗi, 31 từ la bàn, 23 từ bầu trời, 5 chưa chắc. `facades` cho 332 mặt tiền
trên 297 tòa, nhưng kiểm tra bằng mắt cho thấy đa số chưa nắn thẳng được: sai số tư thế còn vài
mét và vài độ, footprint máy học và chiều cao ước lượng cũng lệch. Vì vậy mặt tiền ảnh chưa được
bật trong bản chơi. Cần căn ảnh bằng chính hình ảnh (SfM) mới đủ chính xác; xem
[docs/research-2026-10.md](docs/research-2026-10.md#7-ảnh-đường-phố-thật).

## Đầu ra (`out/<name>/`)

| File | Nội dung |
| --- | --- |
| `manifest.json` | gốc toạ độ (lat/lon), phép chiếu, danh sách ô, thống kê nguồn chiều cao, giấy phép |
| `tiles/bld_X_Y.glb` | tòa nhà đùn khối của một ô; màu đỉnh = nguồn chiều cao |
| `tiles/bld_X_Y.json` | thuộc tính từng tòa + `face_start`/`face_count` trong mesh của ô; `footprint`, `floors` và `street_edges` (cạnh quay ra phố, loại đường) cho việc sinh mặt tiền |
| `tiles/road_X_Y.glb` | dải đường bộ / đường sắt đã cắt theo ô |
| `tiles/walk_X_Y.glb` | vỉa hè nâng 15 cm giữa lòng đường và chỉ giới nhà (độ rộng giả định theo cấp đường) |
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
