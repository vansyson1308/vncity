# 14. Chọn engine cho máy cá nhân: Unreal Engine 5.8 hay Unity 6

**Ngày:** 14/10/2026 · **Trạng thái:** cả hai đã có khung (`ue5/`, `unity/`); chốt khi đã chạy
script kiểm tra trên máy thật (mục 7).

Quyết định gốc ở `03-quyet-dinh-engine.md` vẫn đúng về **chất lượng**: UE 5.8 là đích. Tài liệu
này trả lời câu hỏi khác: **máy đang có chạy nổi engine nào**, và nếu chỉ chạy nổi Unity thì
được gì, mất gì. Dữ liệu (glTF, JSON, CSV) trung lập nên chọn engine nào cũng không bỏ phí việc
đã làm; chỉ phần trong `ue5/` hoặc `unity/` là riêng.

## 1. Khối lượng phải dựng

Bản dựng 12 quận nội thành (`12-cac-quan.md`), toạ độ 1:1:

| Đại lượng | Giá trị |
| --- | --- |
| Toà nhà | 626.998 |
| Ô 500 m | 1.744 |
| Tam giác (khối nhà thô, chưa có kit mặt tiền) | ~22 triệu |
| Điểm PCG (cây, cột điện, dây, biển hiệu, mái hiên, xe máy đỗ, ghế nhựa) | 2.470.821 |
| Khung bao | ~24 × 21 km |
| Nội dung game | 62 nhiệm vụ, 160 đoạn thoại, 46 sự kiện ngẫu nhiên, 220 đồ sưu tầm, 73 nhân vật |
| Đồng hồ | 30x: một ngày game = 48 phút thật, mặt trời đi 7,5° mỗi phút thật |

Toàn tỉnh Hà Nội (README) lớn hơn nhiều: 2,5 triệu nhà, 53 triệu tam giác, 2,2 GB glb. Hai điểm
quyết định engine: (a) khi thay khối thô bằng kit mặt tiền, số tam giác nhân lên hàng trăm lần;
(b) đồng hồ 30x làm **ánh sáng nướng sẵn (lightmap) vô dụng**, cần GI động.

## 2. Yêu cầu máy

Đây cũng là ngưỡng mà `tools/check_machine.ps1` / `.sh` dùng (hai script có test bắt giữ giống nhau).

| | UE 5.8 tối thiểu | UE 5.8 khuyến nghị | Unity 6 HDRP tối thiểu | Unity 6 HDRP khuyến nghị | Unity 6 URP |
| --- | --- | --- | --- | --- | --- |
| RAM | 32 GB | 64 GB | 16 GB | 32 GB | 16 GB |
| VRAM | 8 GB | 12 GB | 6 GB | 8 GB | dưới 6 GB, kể cả GPU tích hợp |
| GPU ví dụ | RTX 2070 / RX 6700 | RTX 4070 / 3080 trở lên | GTX 1660 / RTX 2060 / RX 6600 | RTX 3060 12 GB trở lên | Intel Iris Xe, GTX 1050 |
| Ổ trống (SSD) | 150 GB | 300 GB | 60 GB | 120 GB | 60 GB |
| CPU | 6 nhân | 8 nhân trở lên | 4 nhân | 6-8 nhân | 4 nhân |
| Ổ HDD | không được (DDC, shader, stream) | | chạy được nhưng chậm | | |
| macOS | Apple Silicon, RAM ≥ 64 GB | | Apple Silicon (16 GB trở lên) | 32 GB | |

Vì sao ổ đĩa chênh nhiều:

| Phần | UE 5.8 | Unity 6 |
| --- | --- | --- |
| Engine | 50-70 GB (Launcher, Windows); +40-60 GB nếu bật debug symbols | 8-15 GB (Hub + Editor + IL2CPP) |
| IDE và toolchain | Visual Studio 2022 C++ + Windows SDK: 20-40 GB | VS 2022 workload Unity hoặc Rider: 5-10 GB |
| Cache | Derived Data Cache 50-100 GB | `Library/` 5-15 GB |
| Thành phố đã nhập | Nanite: 20-40 GB cho 12 quận | 20-40 GB (mesh + LOD) |
| Tổng thực tế | 150-300 GB | 60-120 GB |

Chủ dự án từng không cài được UE vì **thiếu ổ cứng**: đây là ngưỡng hay hỏng nhất, script in dung
lượng trống của mọi ổ để chọn ổ đặt repo.

## 3. Thời gian cài đặt (ước tính, mạng 100 Mb/s)

| Bước | UE 5.8 | Unity 6 |
| --- | --- | --- |
| Tải và cài engine | 1,5-3 giờ | 20-40 phút |
| IDE/toolchain | 30-60 phút | 15-30 phút |
| Build C++ lần đầu | 10-30 phút | không có (C# biên dịch vài chục giây) |
| Biên dịch shader lần đầu | 30 phút đến vài giờ | 10-30 phút |
| Run Full Setup với Hoàn Kiếm | 10-30 phút | 5-20 phút |
| **Tổng đến lúc đi được trong phố cổ** | **nửa ngày đến một ngày** | **1,5-3 giờ** |
| Khi đổi code | build C++ 1-5 phút, đổi struct phải đóng editor | C# domain reload 5-30 giây |

## 4. Đồ hoạ đạt được với Hà Nội 1:1

| Hạng mục | UE 5.8 | Unity 6 HDRP |
| --- | --- | --- |
| Hình học | **Nanite**: hàng tỉ tam giác, không cần LOD tay; kit mặt tiền chi tiết cho cả 627k nhà là khả thi | Không có hình học ảo hoá: cần LOD (tự sinh hoặc meshoptimizer/Simplygon), HLOD cho ô xa, impostor cho nhà ở xa; **GPU Resident Drawer** và GPU occlusion culling của Unity 6 giảm draw call. Chi tiết mặt tiền phải giới hạn quanh người chơi |
| Ánh sáng toàn cục với đồng hồ 30x | **Lumen**: GI và phản xạ động hoàn toàn, mặt trời đi nhanh vẫn đúng | Không có Lumen. Kết hợp: **Adaptive Probe Volumes** với nhiều kịch bản ánh sáng (ví dụ 6 mốc trong ngày, trộn giữa chúng), **SSGI** (chỉ thấy trong màn hình), RTGI nếu GPU có ray tracing (nặng). Bình minh, hoàng hôn, trong ngõ tối kém tự nhiên hơn rõ |
| Đèn đêm (đèn đường, biển neon, quán) | **MegaLights**: hàng nghìn đèn có bóng | Giới hạn số đèn có bóng mỗi khung hình; phần lớn đèn đêm phải không bóng hoặc dùng emissive + GI giả |
| Thế giới mở | **World Partition** + HLOD + streaming có sẵn | Không có tương đương: tự viết stream ô bằng Addressables + scene cộng dồn (mục 11 của `13-tich-hop-unity.md`), HLOD tự làm |
| Đạo cụ PCG 2,47 triệu điểm | PCG (production) + HISM/Nanite, sinh theo vùng lúc chạy | `HanoiPointSetRenderer` (instancing, cắt theo khoảng cách) hoặc GPU Resident Drawer; chỉ vẽ trong vài trăm mét |
| Giao thông, đám đông | Mass Entity + ZoneGraph (City Sample làm mẫu) | Entities (ECS) + job system, phải tự viết nhiều hơn |
| Nhân vật | MetaHuman miễn phí trong engine | Không có tương đương; nhân vật mua hoặc tự làm |
| Khí hậu (mưa, nồm, sương) | Volumetric cloud/fog, Niagara | Volumetric cloud/fog của HDRP, VFX Graph: đủ tốt |
| Mac | Chạy được, nhiều tính năng hạ cấp, chậm hơn Windows | HDRP chạy trên Metal, ổn định hơn; không có ray tracing |

Tóm lại: với **khối nhà thô hiện có (22 triệu tam giác)** cả hai đều chạy mượt. Khoảng cách xuất
hiện khi thêm kit mặt tiền, đèn đêm và GI theo giờ: UE gần "phim" hơn, Unity đạt mức game thế
giới mở tốt nếu chấp nhận chi tiết giảm ở xa và ánh sáng chuyển giờ kém mềm. Theo thẩm định ở
`11-tham-dinh-choi-thu.md`, sản phẩm bán được nhờ cốt truyện và phố cổ dày đặc, không nhờ ảnh
chân thực của cả thành phố, nên Unity là phương án **chấp nhận được** cho bản demo 60-90 phút
(phố cổ + hồ Gươm, vài trăm ô), còn UE vẫn là đích nếu máy và thời gian cho phép.

Giấy phép (kiểm lại lúc phát hành): UE miễn phí tới 1 triệu USD doanh thu trọn đời của sản phẩm,
sau đó 5% phần vượt. Unity Personal miễn phí khi doanh thu/vốn 12 tháng dưới 200.000 USD; vượt
thì cần Unity Pro theo ghế mỗi năm, không thu theo doanh thu.

## 5. Quy tắc chọn

Hai script áp đúng quy tắc này (theo thứ tự):

1. Đạt **mọi** ngưỡng UE tối thiểu (RAM 32, VRAM 8, ổ trống 150 GB, 6 nhân, không phải HDD; trên
   Mac: Apple Silicon và RAM ≥ 64 GB) → **`ue5`**. Đạt cả ngưỡng khuyến nghị → mức `recommended`.
   Làm theo `05-tich-hop-ue5.md`.
2. Không đạt UE nhưng đạt Unity HDRP (RAM 16, VRAM 6, ổ 60 GB, 4 nhân) → **`unity_hdrp`**. Làm
   theo `13-tich-hop-unity.md`.
3. Đạt RAM 16 và ổ 60 GB nhưng GPU yếu → **`unity_urp`** (`13-tich-hop-unity.md` mục 9): đủ để làm
   gameplay, nhiệm vụ, thoại; hình ảnh không dùng để quảng bá.
4. Dưới nữa → **`none`**: tiếp tục phần không cần engine, hoặc mục 6.

Hai trường hợp nên xét bằng tay dù script nói gì:

* **Thiếu ổ là lý do duy nhất chặn UE**: mua SSD NVMe 1 TB rẻ hơn nhiều so với công viết lại phần
  stream và GI bên Unity. Nên mua ổ và chọn UE.
* **Máy đạt UE mức tối thiểu (32 GB RAM)**: UE chạy được nhưng World Partition cỡ thành phố sẽ
  chậm; vẫn nên chọn UE, nhập theo cụm quận.

## 6. Máy không đủ

* Máy trạm đám mây có GPU (ví dụ các dịch vụ thuê máy Windows có RTX theo giờ, hoặc AWS G5/G6,
  Azure NV): chạy UE 5.8 qua remote desktop, giá theo giờ; repo và dữ liệu đồng bộ qua git.
* Hoặc làm tiếp mọi phần không cần engine: nội dung chương 3-5, pipeline, test, và chạy lõi Unity
  bằng `dotnet test` (không cần GPU).

## 7. Cách kiểm tra máy

Windows (PowerShell, không cần quyền admin, chỉ đọc):

```bat
cd D:\vncity
powershell -ExecutionPolicy Bypass -File tools\check_machine.ps1
REM đo ổ khác nếu định đặt repo ở đó:
powershell -ExecutionPolicy Bypass -File tools\check_machine.ps1 -Disk E:\
```

macOS (Terminal):

```bash
cd ~/vncity && bash tools/check_machine.sh
```

Kết quả là các dòng `khoá=giá trị` (hệ điều hành, CPU, số nhân, RAM, GPU, VRAM, ổ trống, SSD hay
HDD, đã cài UE/Unity/Visual Studio chưa, danh sách ổ), rồi `ue_blockers`, `unity_blockers`,
`recommendation` (`ue5`, `unity_hdrp`, `unity_urp`, `none`), `tier` và một câu giải thích tiếng
Việt. Gửi nguyên phần `khoá=giá trị` vào thread là đủ để chốt. Nếu script không đọc được GPU (máy
lạ, driver cũ), sửa dòng `vram_gb=` trong file đó rồi chạy lại với `--facts <file>` (Mac) hoặc
`-Facts <file>` (Windows) để ra khuyến nghị mà không đo lại.

Ghi chú đo đạc: trên Windows VRAM đọc từ registry của driver (`HardwareInformation.qwMemorySize`,
vì `Win32_VideoController.AdapterRAM` dừng ở 4 GB) hoặc `nvidia-smi`; trên Mac Apple Silicon,
VRAM tính bằng 2/3 bộ nhớ hợp nhất (phần Metal cho GPU dùng).

## 8. Đổi engine về sau tốn gì

| Phần | Dùng chung | Phải làm lại |
| --- | --- | --- |
| Thành phố (glb, footprint, PCG CSV, đồ thị đường) | có | nhập lại bằng script setup của engine kia |
| Nội dung game (JSON + schema) | có | không (mỗi engine có codegen riêng từ cùng schema) |
| Luật game (nhiệm vụ, thoại, phạt, thời gian, thời tiết) | có test chung dữ liệu | C++ bên UE, C# bên Unity; lõi C# đầy đủ hơn (mục 8 của `13-tich-hop-unity.md`) |
| Tài sản 3D (kit, nhân vật) | glTF/FBX dùng được cả hai | material, shader, LOD |
| Ánh sáng, stream, giao thông, UI | không | viết riêng |

Nên chốt engine **trước khi** làm kit mặt tiền và UI, vì đó là phần tốn công nhất mà không chuyển được.
