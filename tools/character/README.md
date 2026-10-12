# Nhân vật đi bộ

`viewer/assets/walker.glb` là nhân vật `Male_Adult_09` của
[Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) (MIT, xem
`viewer/assets/ROCKETBOX_LICENSE.md`) cùng bốn chuyển động quay bằng motion capture: đứng
(`idle`), đi (`walk`), chạy (`run`), chạy chậm (`jog`). Chuyển động đã bỏ phần trôi ngang của
gốc, nên trình duyệt tự điều khiển vị trí.

Dựng lại từ nguồn (~4 GB):

```bash
GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/microsoft/Microsoft-Rocketbox /tmp/rocketbox
./venv/bin/python tools/character/prepare.py /tmp/rocketbox /tmp/walker
python -m http.server 8767 -d /tmp/walker &
node tools/character/convert.mjs viewer/assets/walker.glb
```

`convert.html` đọc FBX bằng three.js, thay vật liệu Phong bằng PBR với texture màu và normal map,
chỉ giữ các track xoay cùng vị trí của `Bip01` (GLTFExporter bỏ cả clip nếu một track trỏ tới nút
không có), rồi xuất GLB. Thang đo: centimet của 3ds Max nhân 0,01 thành mét.
