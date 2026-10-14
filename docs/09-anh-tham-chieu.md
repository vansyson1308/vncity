# Ảnh tham chiếu phố cổ và công trình

`tools/ref_images.py` gom ảnh tham chiếu **hợp pháp** cho phố cổ và các công trình ưu tiên trong
`game/content/world/landmarks.json`. Artist và quy trình Codex imagegen dùng các ảnh này để làm bộ
mặt tiền (facade kit) và đạo cụ. Mặc định đây là ảnh **để nhìn**. Chỉ dùng ảnh làm texture khi giấy
phép của nó cho phép.

> Luật cứng: **không dùng ảnh Google Street View, Google Maps hay Google Earth** dưới bất kỳ hình
> thức nào, kể cả chỉ để xem rồi vẽ theo. Tool không có nguồn Google và tự loại mọi URL Google.

## Chạy tool

```bash
./venv/bin/python -m tools.ref_images --check          # chỉ kiểm tra nguồn nào truy cập được

export REFS_CONTACT="email-cua-ban@example.com"        # nên đặt; đi vào User-Agent
./venv/bin/python -m tools.ref_images \
    --landmarks thap_rua,cau_the_huc,nha_tho_lon,o_quan_chuong \
    --streets "Hàng Bạc,Tạ Hiện,Hàng Gai" --download

./venv/bin/python -m tools.ref_images --all-landmarks --all-streets --old-quarter --download
./venv/bin/python -m tools.ref_images --bbox 105.849,21.031,105.854,21.037 --bbox-name loi_pho_co
```

| Tham số | Ý nghĩa |
| --- | --- |
| `--landmarks id,id` / `--all-landmarks` | Công trình theo `id` trong `landmarks.json`. Bán kính tìm tùy loại: tượng đài 150 m, hồ 600 m |
| `--streets "Hàng Bạc,…"` / `--all-streets` | 14 phố: Hàng Bạc, Hàng Buồm, Tạ Hiện, Hàng Gai, Hàng Mã, Mã Mây, Hàng Đào, Hàng Ngang, Hàng Đường, Lương Văn Can, Hàng Bè, Đinh Liệt, Hàng Chiếu, Hàng Thiếc. Khung tọa độ đo từ đồ thị đường Overture |
| `--old-quarter` | Thêm target `pho_co`: khung bao cả 14 phố và Commons `Category:Old Quarter, Hanoi` |
| `--bbox lon,lat,lon,lat` | Một vùng tùy ý |
| `--sources commons,openverse,…` | Chỉ chạy một số nguồn |
| `--download`, `--max-download 20` | Tải ảnh thu nhỏ (rộng tối đa 1600 px) vào `out/refs/<target>/img/` |
| `--rate 1.0` | Số giây tối thiểu giữa hai request tới cùng một host |

Kết quả nằm trong `out/` và không được commit:

- `out/refs/<target>/manifest.json`: mỗi ảnh có `source`, `url`, `thumb_url`, `page_url`,
  `author`, `license`, `license_url`, `lat`/`lon`, `distance_m`, `capture_date`, `width`/`height`,
  `match` (`geo`, `category` hoặc `text`) và `usage` (`texture_ok` hoặc `reference_only`). Khối
  `sources` ghi trạng thái từng nguồn: `ok`, `skipped_no_key`, `unreachable` hoặc `error`.
- `out/refs/ATTRIBUTION.md`: bảng ghi công gộp từ mọi manifest. Bảng này được sinh lại sau mỗi lần
  chạy.

Ảnh có `match: text` đến từ tìm theo chữ, nên có thể sai chỗ. Người duyệt phải xem lại trước khi
dùng.

## Nguồn và khóa API

| Nguồn | Khóa | Lấy khóa miễn phí | Giấy phép ảnh |
| --- | --- | --- | --- |
| Wikimedia Commons | Không cần | — | Mỗi ảnh một giấy phép; tool đọc `extmetadata` |
| Openverse | Không cần (giới hạn lượt ẩn danh) | — | Mỗi ảnh một giấy phép; tool lọc sẵn `cc0,pdm,by,by-sa` |
| Mapillary | `MAPILLARY_TOKEN` | Đăng nhập mapillary.com → Dashboard → Developers → Register application → copy **Client Token** | Luôn là CC BY-SA 4.0, nên luôn `reference_only` |
| Flickr | `FLICKR_API_KEY` | Tạo tài khoản Flickr → flickr.com/services/apps/create → chọn Non-Commercial key. Dự án thương mại phải xin key Commercial | Tool chỉ nhận id giấy phép 4, 5, 9, 10, 11, 12 (CC BY, CC BY-SA, CC0, PDM) |
| KartaView | Không cần | — | CC BY-SA 4.0. API chưa kiểm được từ container, phần đọc dữ liệu viết theo kiểu phòng thủ |
| Panoramax | Không cần | — | Mỗi ảnh một giấy phép. Ảnh `etalab-2.0` bị loại vì không nằm trong danh sách cho phép |

Nguồn cần khóa mà chưa đặt biến môi trường thì tool bỏ qua và in cách lấy khóa. Nguồn bị chặn mạng
(proxy trả 403, lỗi DNS) được ghi `unreachable` trong manifest và tool chạy tiếp với các nguồn khác.

## Quy tắc giấy phép

| Giấy phép | `usage` | Được làm gì |
| --- | --- | --- |
| CC0, Public domain / PDM | `texture_ok` | Dùng tự do: làm texture, cắt, vẽ theo. Vẫn nên ghi công |
| CC BY (mọi phiên bản) | `texture_ok` | Dùng làm texture hoặc vẽ theo được, nhưng **bắt buộc ghi công** (tác giả, tên ảnh, link giấy phép) trong credits của game |
| CC BY-SA (mọi phiên bản) | `reference_only` | **Chỉ để nhìn.** Không cắt ảnh làm texture, không can nét, không chiếu ảnh lên mesh, không đưa ảnh vào làm ảnh đầu vào image-to-image |
| NC, ND, GFDL đơn thuần, "All rights reserved", không rõ | bị loại | Tool không ghi vào manifest |

Vì sao CC BY-SA chỉ để tham khảo: nhìn ảnh để hiểu tỷ lệ ô cửa, màu sơn, cách mắc dây điện thì
không tạo ra tác phẩm phái sinh. Nhưng nếu cắt, can hay chiếu ảnh lên mô hình, asset đó thành tác
phẩm phái sinh. Khi đó asset phải phát hành lại dưới CC BY-SA và phải ghi công từng ảnh. Điều này
không hợp với một game đóng gói thương mại. Xem thêm `docs/04-du-lieu-va-giay-phep.md`.

Những điểm cần kiểm thêm bằng mắt, kể cả với ảnh `texture_ok`:

- Trường `restrictions` của Commons, ví dụ quyền nhân thân hay nhãn hiệu.
- Biển hiệu và logo thật trong ảnh: chỉ được dùng tên nhại.
- Mặt người rõ nét: không dùng làm texture.

Phần này không phải tư vấn pháp lý. Trước khi phát hành thương mại, nhờ người có chuyên môn rà lại.

## Danh sách ảnh cần tự chụp (lấp chỗ trống)

Ảnh tự chụp là nguồn tốt nhất: thuộc quyền của dự án, dùng được làm texture và photogrammetry.
Người chụp ký một dòng đồng ý chuyển quyền cho dự án (ví dụ CC0 hoặc chuyển nhượng), ghi vào
`out/refs/<target>/manifest.json` với `source: "own"`.

**Với mỗi mặt tiền (mỗi số nhà) cần chụp:**

1. **Mặt đứng thẳng (elevation)**: đứng ở mép vỉa hè đối diện, máy song song với mặt nhà, lấy trọn
   từ vỉa hè tới mái. Nếu phố hẹp không lùi được, chụp hai hay ba tấm theo chiều dọc (tầng 1, tầng
   2–3, mái) với độ chồng 30%.
2. **Chi tiết tầng trệt**: cửa xếp hoặc cửa cuốn, bậc thềm, nền gạch vỉa hè, ổ khóa, bảng số nhà.
   Chụp cách 2–3 m, thẳng góc.
3. **Biển hiệu**: chụp thẳng, cả khung và giá đỡ. Biển dọc và biển ngang chụp riêng. Mục đích là lấy
   bố cục và chất liệu (bạt in, mica, đèn LED), không phải để chép tên.
4. **Ban công và lan can**: hoa sắt, chậu cây, mái tôn che, điều hòa, bình nước inox trên mái.
5. **Vật liệu cận cảnh (texture)**: tường vôi vàng bong tróc, rêu, gạch thông gió, ngói âm dương,
   gỗ cửa. Chụp thẳng góc, cách khoảng 1 m, ánh sáng đều (trời râm hoặc trong bóng râm), có một
   tấm thẻ xám hoặc tờ giấy A4 làm thang đo.
6. **Dây điện và cột**: cột bê tông chữ H, bó cáp, hộp công tơ, móc treo. Chụp cả cột từ gốc lên
   đỉnh, rồi một tấm cận cảnh búi cáp. Ghi chiều cao ước lượng.
7. **Toàn cảnh phố**: đứng giữa phố (lúc vắng, an toàn) hướng dọc phố, mỗi đầu phố một tấm, để thấy
   nhịp các mặt nhà và độ võng của dây điện.

**Độ cao máy và độ chồng ảnh:**

| Loại ảnh | Độ cao máy | Khoảng cách | Độ chồng ảnh |
| --- | --- | --- | --- |
| Mặt đứng | 1,6 m (ngang mắt). Nếu có gậy thì đặt 2,5–3 m cho ngang tầng 2 | Xa nhất có thể trên vỉa hè đối diện | 30% giữa hai tấm dọc |
| Chuỗi mặt phố (để ghép hoặc photogrammetry) | 1,6 m, giữ cố định | 3–6 m | 60–70% giữa hai tấm liền nhau; mỗi bước đi khoảng 1 m |
| Vật liệu | Ngang tâm mảng vật liệu | 0,8–1,2 m | Không cần chồng, chụp 3–5 tấm khác nhau |
| Công trình (Tháp Rùa, Ô Quan Chưởng…) | 1,6 m | Đi vòng quanh, cứ 10–15° chụp một tấm | 70% |

**Thiết lập máy:**

- Ảnh gốc JPG chất lượng cao nhất, hoặc RAW.
- Tắt chế độ chân dung, HDR mạnh và zoom số; dùng ống kính chính 1x.
- Bật vị trí GPS trong máy.
- Chụp giữa sáng hoặc trời râm, tránh nắng gắt chéo.
- Mỗi thư mục ghi tên phố, số nhà và ngày chụp.

**Lịch sự và an toàn:**

- Không chụp rõ mặt người lạ. Không chụp vào trong nhà dân.
- Hỏi chủ quán trước khi chụp cận.
- Chụp sáng sớm cho vắng người và xe.

## Đưa ảnh vào quy trình Codex imagegen

1. **Chạy tool và duyệt tay.** Xem `manifest.json` của target và giữ những ảnh đúng nơi, đúng góc.
   Loại ảnh `match: text` bị sai chỗ.
2. **Ảnh `texture_ok`** (CC0, PD, CC BY): được đưa thẳng vào Codex làm ảnh đầu vào, để sinh mặt
   đứng sạch, trích vật liệu hoặc làm ảnh tham chiếu image-to-3D. Asset sinh ra phải giữ dòng ghi
   công: copy `attribution` của ảnh vào `game/assets/sources.json` (hoặc file credits tương ứng).
3. **Ảnh `reference_only`** (CC BY-SA): **không** đưa ảnh vào làm ảnh đầu vào. Người hoặc agent chỉ
   xem ảnh rồi **viết lại bằng chữ** những gì quan sát được: số tầng, tỷ lệ ô cửa, màu sơn (mã màu
   ước lượng), kiểu lan can, vị trí biển hiệu, mật độ dây điện. Đoạn mô tả này gắn vào prompt
   (ví dụ các prompt `facade` trong `game/assets/prompts.jsonl` do `tools/asset_prompts.py` sinh).
   Ảnh do Codex sinh từ mô tả chữ không mang giấy phép của ảnh gốc.
4. **Ảnh tự chụp**: dùng như `texture_ok`, không phải ghi công bên ngoài.
5. **Ghi lại nguồn gốc.** Với mỗi ảnh hoặc asset sinh ra, ghi `refs: ["commons:12345", …]` (lấy
   theo `id` trong manifest) để sau này kiểm lại được.
6. **Đặt prompt có `negative`.** Đặt negative cho logo, chữ thương hiệu và mặt người. Biển hiệu
   trong game dùng tên nhại, như trong mục "Thương hiệu" của `docs/04-du-lieu-va-giay-phep.md`.
