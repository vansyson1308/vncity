# Dữ liệu và giấy phép

Quy tắc ngắn gọn cho mọi người đóng góp vào dự án. Không phải tư vấn pháp lý; nhờ người có chuyên
môn rà lại trước khi phát hành thương mại.

## Được dùng và đưa vào game

| Nguồn | Dùng cho | Giấy phép | Nghĩa vụ |
| --- | --- | --- | --- |
| Overture Maps (buildings, transportation, base, divisions) | Khối nhà, đường, hạ tầng, ranh giới | ODbL (từng đối tượng có thể CC BY 4.0) | Ghi công; giữ script tái tạo dữ liệu đã xử lý công khai được |
| Overture Maps places | Cửa hàng thật sau biển hiệu | Phần lớn CDLA-Permissive 2.0 | Ghi công |
| OpenStreetMap (qua Overture) | Như trên | ODbL 1.0 | "© OpenStreetMap contributors" |
| Copernicus DEM GLO-30 | Địa hình | Miễn phí, ghi công | "© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved" |
| Poly Haven, ambientCG | Vật liệu, HDRI | CC0 | Không bắt buộc, nên ghi |
| Ảnh tự chụp của nhóm | Texture, photogrammetry | Của mình | Không chụp rõ mặt người lạ để làm tài sản |
| GTFS Hà Nội (World Bank) | Tuyến buýt | CC BY 4.0 | Ghi công |

## Chỉ được xem để tham khảo, không đưa vào game

| Nguồn | Lý do |
| --- | --- |
| Google Street View, Google Earth, Photorealistic 3D Tiles | Điều khoản cấm lưu, dùng offline, vẽ theo, dựng lại 3D |
| Mapillary, KartaView | Ảnh CC BY-SA 4.0: cắt ảnh làm texture sẽ kéo theo share-alike và ghi công từng ảnh |
| GlobalBuildingAtlas | CC BY-NC: cấm thương mại |
| Model mua trên RenderHub/Sketchfab không ghi rõ quyền phân phối | Không chắc được đóng gói |
| City Sample (Matrix Awakens) | Chỉ dùng trong sản phẩm Unreal; dùng code tham khảo, không dùng art |

## Thời tiết thời gian thực

Open-Meteo: dữ liệu CC BY 4.0, nhưng API miễn phí **chỉ cho phi thương mại**. `live/weather.py`
dùng nó khi phát triển và tự rơi về chế độ khí hậu (`--mode baked`) khi mất mạng. Bản phát hành
cần gói trả phí hoặc chỉ dùng chế độ khí hậu.

## Thương hiệu

Giống GTA: không dùng tên, logo, kiểu dáng nhận diện của hãng thật (Honda, Yamaha, VinFast,
Grab, Highlands…). Dùng tên nhại trong `name`; tên thật chỉ được ghi trong trường nội bộ
`inspired_by` để artist tham khảo. Tên cửa hàng lấy từ Overture places là **dữ liệu**, nhưng khi
hiển thị trên biển hiệu trong game nên thay bằng tên nhại hoặc tên chung (Phở, Cà phê, Tạp hóa…)
để tránh dùng nhãn hiệu của cửa hàng có thật.

## Địa điểm nhạy cảm

Lăng Chủ tịch Hồ Chí Minh, Phủ Chủ tịch, trụ sở cơ quan nhà nước: khắc họa trang trọng, không đặt
gameplay chế giễu, không cho vi phạm (leo trèo, đua xe) quanh khu vực. Kiểm tra quy định hiện hành
trước khi phát hành.

## Màn hình credits (bản nháp)

```
Map data © OpenStreetMap contributors, Overture Maps Foundation (ODbL / CDLA-Permissive-2.0),
Microsoft, Google Open Buildings, Esri Community Maps (CC BY 4.0).
Elevation: Copernicus DEM GLO-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH
2014-2018 provided under COPERNICUS by the European Union and ESA.
Weather: Open-Meteo.com (CC BY 4.0).  Textures: Poly Haven, ambientCG (CC0).
```
