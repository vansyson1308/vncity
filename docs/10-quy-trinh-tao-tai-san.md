# Quy trình tạo tài sản: từ đặc tả đến UE5

Tài liệu này nối ba thứ: **đặc tả** (mỗi mesh mà dữ liệu thành phố cần), **nguồn** (dùng lại gì,
xem [08-nguon-tai-san-3d.md](08-nguon-tai-san-3d.md)), và **ảnh tham chiếu** (xem
[09-anh-tham-chieu.md](09-anh-tham-chieu.md)). Ai làm cũng được, người hay Codex: chỉ cần nộp file đúng
tên, đúng kích thước, có nguồn gốc, là bước import UE tự đặt vào đúng chỗ.

## 1. Các file

| File | Vai trò |
| --- | --- |
| `game/assets/asset_specs.json` | Hợp đồng: 68 đạo cụ (mọi `Set/Kind` mà pipeline rải) và 13 bộ kit mặt tiền, mỗi mục có kích thước, pivot, trục, ngân sách tam giác, số biến thể, đường làm (`route`) |
| `game/assets/prompts.jsonl` | 712 prompt sinh ảnh, mỗi dòng một ảnh, có sẵn đường dẫn lưu (`out`). Sinh lại bằng `python tools/asset_prompts.py` |
| `game/assets/sources.json` | Sổ nguồn gốc: mỗi file mesh/texture nộp vào phải có một dòng (nguồn, tác giả, giấy phép) |
| `tools/check_assets.py` | Kiểm mesh nộp về theo hợp đồng: kích thước, pivot, tam giác, UV, giấy phép |
| `ue5/Config/asset_map.json` | Nối `Set/Kind` với mesh trong UE (`meshes` là danh sách biến thể) |
| `assets_work/` | Thư mục làm việc (không vào git): ảnh sinh ra, mesh thô, mesh đã sửa |

## 2. Mỗi loại tài sản đi đường nào

Trường `route` trong `asset_specs.json` nói rõ:

| `route` | Số mục | Cách làm |
| --- | --- | --- |
| `generate` | 16 (xe máy, hàng rong, ATM, máy bán nước…) | Codex sinh ảnh `ref_sheet` → image-to-3D → sửa trong Blender |
| `hand_mesh_generated_print` | 24 (biển hiệu) | Khung biển dựng tay (rất đơn giản), nền in do Codex sinh (`sign_print`), chữ do UE vẽ bằng font Be Vietnam Pro |
| `hand` | 14 (cột điện, dây, đèn, đèn giao thông, nhà chờ…) | Dựng tay hoặc spline/PCG trong UE: hình học đơn giản, AI làm còn chậm hơn |
| `hand_vegetation` | 10 (cây) | Procedural Vegetation Editor của UE hoặc Blender, vỏ và lá chụp thật; ảnh `ref_sheet` dùng làm tham chiếu dáng cây |
| `reuse_or_hand` | 4 (ghế nhựa, ghế đá) | Dùng model CC0/CC-BY phù hợp ở mục 9 của tài liệu 08, nếu không thì dựng tay |
| `hand_kit` | 13 bộ kit | Dựng tay theo lưới module; ảnh `facade` dùng làm tham chiếu và để làm trim sheet |

Vật liệu (thạch cao, ngói, bê tông, nhựa đường) lấy từ Poly Haven / ambientCG (CC0) trước; 14 prompt
`texture` chỉ để bù chỗ thiếu (gạch bông, ngói âm dương, cửa gỗ lùa).

## 3. Chạy với Codex (imagegen)

Giao cho Codex một việc như sau, mỗi lần một nhóm (ví dụ `"type": "ref_sheet"` và `"route": "generate"`):

> Đọc `game/assets/prompts.jsonl`. Với mỗi dòng có `type` = `ref_sheet` và `route` = `generate`:
> sinh một ảnh theo `prompt`, kích thước `size_px`, tránh mọi thứ trong `avoid`; lưu đúng đường dẫn
> `out`. Nếu `refs` chỉ tới ảnh trong `out/refs/<mục>/manifest.json` có `usage` = `texture_ok` thì
> được dùng làm ảnh đầu vào; ảnh `reference_only` chỉ được mô tả bằng lời. Bỏ qua ảnh đã tồn tại.
> Cuối cùng in danh sách ảnh đã sinh.

Lưu ý từ nghiên cứu (mục 7 tài liệu 08):

* imagegen chỉ ra ảnh 2D, không có nền trong suốt: ref sheet dùng nền xám phẳng, khi đưa vào
  image-to-3D thì tách nền trước (rembg hoặc công cụ tách nền của model).
* Model vẽ sai dấu tiếng Việt, nên mọi prompt `sign_print` yêu cầu **không có chữ**. Tên cửa hàng hư cấu
  nằm trong trường `text` của từng dòng; UE ghép chữ lên biển bằng Text Render hoặc material với font OFL.
* Mọi thiết kế xe là bản nhại: không logo, không chép dáng Honda Super Cub/Wave/Vision/Lead (dáng Super
  Cub là nhãn hiệu 3D đã đăng ký).

## 4. Từ ảnh sang mesh

1. **Image-to-3D** (máy có GPU, không cần trong repo):
   * TripoSG (MIT, khoảng 8 GB VRAM) cho hình khối, texture làm lại bằng vật liệu CC0. An toàn nhất về giấy phép.
   * TRELLIS.2 (MIT, khoảng 24 GB VRAM) cho cả texture PBR; khâu xuất texture dùng nvdiffrast (giấy phép
     phi thương mại), cần kiểm tra pháp lý trước khi dùng cho bản bán.
   * Không dùng Hunyuan3D (loại trừ EU, Anh, Hàn Quốc) và Stable Fast 3D / SPAR3D (giới hạn doanh thu)
     cho bản thương mại.
2. **Blender**: sửa lưới, retopo nếu cần, UV, áp vật liệu theo `material_slots`.
   Đặt pivot và trục đúng mục `conventions.axes`: +X là hướng `forward` của mục đó, +Z lên.
   Kích thước đúng `size_m` (sai dưới 30% vẫn qua kiểm tra).
3. **Xuất glTF** (.glb, +Y up, apply transforms), tên `SM_<set>_<kind>_v<n>.glb`, ví dụ
   `SM_parked_motorbikes_scooter_v0.glb`. Kit: `SM_<archetype>_<module>_v<n>.glb`.
4. **Ghi nguồn** vào `game/assets/sources.json`:

   ```json
   {"file": "SM_parked_motorbikes_scooter_v0.glb", "asset": "parked_motorbikes/scooter",
    "source": "Codex imagegen + TripoSG, sửa trong Blender", "author": "Van Sy Son",
    "licence": "generated-own", "url": "", "attribution": ""}
   ```

   Giấy phép được nhận: `CC0-1.0`, `CC-BY-4.0`, `CC-BY-3.0`, `Fab-Standard`, `Megascans-Fab`,
   `Epic-Content`, `own-work`, `generated-own`. CC-BY phải có dòng ghi công trong credits; không nhận
   NC, ND, SA, Editorial.
5. **Kiểm**: `python tools/check_assets.py assets_work/out`. Sửa đến khi mọi dòng là `OK`.

## 5. Vào UE5

1. Import các .glb vào `/Game/Hanoi/Props/<set>/` (đúng `ue_folder` trong đặc tả), bật Nanite cho mục
   có `nanite: true`.
2. Điền đường dẫn vào `ue5/Config/asset_map.json`, ví dụ:

   ```json
   "parked_motorbikes/scooter": {"meshes": ["/Game/Hanoi/Props/parked_motorbikes/SM_parked_motorbikes_scooter_v0.SM_parked_motorbikes_scooter_v0",
                                             "/Game/Hanoi/Props/parked_motorbikes/SM_parked_motorbikes_scooter_v1.SM_parked_motorbikes_scooter_v1"],
                                 "scale": 1.0, "yaw_offset_deg": 0.0, "cull_distance_m": 120}
   ```

   Khóa riêng `Set/Kind` thắng khóa `Set/*`. Mỗi điểm chọn mesh theo `Variant % số mesh`.
3. Chạy lại **Tools > Hanoi City > Import PCG Points**. Biển hiệu và mái bạt chỉ giãn theo chiều mặt
   tiền, dây điện chỉ giãn theo chiều dài nhịp (`scale_axes`), nên mesh không bị phình.
4. Nếu đạo cụ bị xoay sai đồng loạt, sửa một lần bằng `yaw_offset_deg`.

## 6. Thứ tự đề xuất

1. Kiểm tra tài khoản Epic đã nhận Megascans chưa; tải City Sample (xe hơi, nhà cao tầng, đám đông).
2. Tải ngay các model Sketchfab CC-BY đã chọn ở tài liệu 08 mục 4 (Epic sẽ đóng tải miễn phí), ghi `sources.json`.
3. Dựng tay cột điện, dây, đèn, bó vỉa: nhanh, tác động hình ảnh lớn ở phố cổ.
4. Thử trọn quy trình mục 3 và 4 với 3 mục: `street_vendors/xe_day_hoa_qua`, `infrastructure/atm`,
   `parked_motorbikes/scooter`.
5. Biển hiệu: khung + 192 nền in + chữ UE.
6. Kit `nha_ong_pho_co`, rồi các kit khác.
7. Công trình biểu tượng bằng photogrammetry tự chụp (danh sách chụp ở tài liệu 09).
