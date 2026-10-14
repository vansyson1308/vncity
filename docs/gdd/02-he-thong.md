# 02. Các hệ thống

## 1. Chú ý CSGT (thay mức truy nã)

Mức **Chú ý** từ 0 đến 5 sao. Mỗi lỗi trong `traffic_rules.json` cộng `heat` sao khi bị phát hiện.
Phát hiện = CSGT nhìn thấy (xác suất `base_notice_chance`, giảm theo khoảng cách, mưa, đêm) hoặc
camera (`camera_enforced`: lỗi được ghi "phạt nguội", không có ai đuổi theo nhưng tiền phạt xuất hiện
trong app *Tra cứu phạt nguội*).

| Sao | Phản ứng của thế giới |
| --- | --- |
| 0 | Bình thường |
| 1 | CSGT gần đó ra hiệu dừng nếu thấy bạn; không ai theo dõi chủ động |
| 2 | Một tổ tuần tra hai xe máy để ý khu vực; chốt giờ cao điểm kiểm tra kỹ hơn |
| 3 | Chốt chặn xuất hiện trên tuyến chính quanh vị trí cuối cùng bị thấy |
| 4 | Chốt ở các cầu và cửa ngõ quận; app Vồ tạm khóa tài khoản tài xế (Minh) |
| 5 | Chỉ đạt được với lỗi nặng (nồng độ cồn mức 3): mọi chốt trong thành phố có ảnh xe của bạn |

**Không có rượt đuổi.** Cách duy nhất để giảm Chú ý là:

1. **Tuân thủ**: chạy đúng luật, ra khỏi tầm nhìn tổ tuần tra; sao giảm dần sau 60-120 giây. Phóng
   nhanh, lạng lách, không dừng khi được ra hiệu là lỗi mới (cộng thêm sao).
2. **Dừng xe chấp hành**: bị lập biên bản, nộp phạt (mức trong `fine_vnd`, dùng mức giữa khung),
   trừ điểm giấy phép (`licence_points`), có thể bị tạm giữ xe (lấy lại ở bãi sau 7 ngày game, mất
   phí bãi). Chú ý về 0 ngay.
3. **Đổi phương tiện hợp pháp**: gửi xe, đi bộ hoặc gọi xe. Xe vẫn bị nhận diện ở mức 3 trở lên.

Hối lộ: người chơi có thể chọn câu thoại "bồi dưỡng". NPC CSGT luôn từ chối và cộng 2 sao (thông điệp
rõ ràng, không giáo điều).

**Điểm giấy phép lái xe**: mỗi nhân vật có 12 điểm (theo Luật Trật tự, an toàn giao thông đường bộ
2024). Hết điểm thì không được lái cho đến khi thi lại phần lý thuyết (minigame trắc nghiệm luật).
Điểm phục hồi đủ 12 nếu giữ hồ sơ sạch đủ lâu (luật thật: 12 tháng không bị trừ điểm, cần kiểm
tra; game nén thành 60 ngày game). Giữ sạch 90 ngày game mở nhiệm vụ phụ tích cực với CSGT
(`s12_mu_bao_hiem_cho_be`): runtime tự đặt cờ `ho_so_sach_90_ngay` khi đủ
`Settings.CleanRecordDays` (mặc định 90) ngày game kể từ lần bị phạt gần nhất
(`State.LastFineGameTime`, ghi bởi `apply_fine` của nhiệm vụ và `UHanoiHeatSubsystem::AddFine`; ván
mới tính từ ngày đầu). Bị phạt là cờ bị xóa và đếm lại. Không nhiệm vụ hay thoại nào đặt cờ này.

Nồng độ cồn: mọi đồ uống có cồn cộng `nong_do_con`. Chốt đo nồng độ xuất hiện tối 21h-1h. Thiết kế
khuyến khích gọi xe về sau bia hơi (hoạt động bia hơi gợi ý sẵn).

Mức phạt lấy theo Nghị định 168/2024/NĐ-CP theo hiểu biết hiện tại; mục nào chưa chắc gắn
`fine_unverified` và **phải đối chiếu văn bản gốc trước khi khóa nội dung**.

## 2. Thời gian và thời tiết từ dữ liệu thật

- Hai chế độ: **Nhịp game** (1 ngày = 48 phút) và **Đồng bộ thật** (giờ game = giờ Hà Nội, UTC+7).
- Ở chế độ đồng bộ, thời tiết lấy trực tiếp từ nguồn sống: nhiệt độ, độ ẩm, mưa theo giờ, gió (dùng
  cho thả diều), AQI. Ở chế độ nhịp game, phát lại dữ liệu thật của một ngày gần đây cùng mùa, nên
  mùa nồm, mùa hoa sữa, rét đậm vẫn đúng mùa.
- Adapter sống (`live_feed`) mà `events.json` dùng: `weather.heavy_rain`, `weather.storm`,
  `weather.nom_am`, `weather.heatwave`, `weather.cold_snap`, `air.aqi_unhealthy`. Ngưỡng đề xuất:
  mưa trên ~50 mm trong vài giờ thì bật lớp ngập; nồm khi độ ẩm trên 90% và điểm sương sát nhiệt độ.
- **Ngập**: lớp ngập theo điểm trũng đã biết (Nguyễn Khuyến, Phan Bội Châu, Thái Hà, Nguyễn Trãi...)
  cộng mô hình độ cao DEM. Xe số qua nước sâu có xác suất chết máy; tay ga dễ chết hơn.
- Lịch âm: sự kiện `lunar_date` cần bộ đổi âm-dương lịch Việt Nam (múi giờ UTC+7, khác lịch Trung
  Quốc ở một số năm). "30-12" nghĩa là **ngày cuối tháng Chạp** (có năm chỉ có 29).
- `weekday` dùng 0 = thứ Hai. Phố đi bộ Hồ Gươm: thứ Sáu = 4, thứ Bảy = 5, Chủ nhật = 6.

## 3. Bầy giao thông

- Đồ thị đường từ `traffic/graph.json` (pipeline). Tỉ lệ xe máy/ô tô theo `traffic_profile` từng
  quận (phố cổ 88% xe máy, Mỹ Đình 66%), giờ cao điểm theo `peak_hours`.
- Xe máy mô phỏng như **bầy** (boids có luật): giữ khoảng cách, len vào khe, dồn lên vạch dừng khi
  đèn đỏ, nhích lên vỉa hè khi tắc (NPC cũng có thể bị phạt nếu bị CSGT thấy, tạo cảnh phố sống).
- Mật độ thật: ngã tư lớn giờ cao điểm 300-600 xe máy trong một chu kỳ đèn. Dùng LOD hành vi: gần
  người chơi mô phỏng đầy đủ, xa thì dòng chảy thống kê.
- Luật riêng có dữ liệu: cầu Long Biên đi bên trái; phố đi bộ cấm xe theo lịch; làn ô tô trên các
  trục lớn; đường một chiều phố cổ; tàu Thống Nhất qua phố đường tàu theo giờ chạy.
- Người đi bộ sang đường kiểu Hà Nội: đi đều, xe vòng qua. Người chơi chạy ngang bất ngờ thì xe
  phanh gấp, tăng nguy cơ va chạm.
- Phương tiện công cộng: xe buýt theo GTFS, tàu điện 2A Cát Linh - Hà Đông chạy trên cao dùng làm
  "di chuyển nhanh" có vé (8.000 - 15.000 đ, cần kiểm tra).

## 4. Điện thoại và ứng dụng (tên parody)

| App | Nhại | Chức năng |
| --- | --- | --- |
| Vồ | App gọi xe | Nhận cuốc xe ôm, giao hàng (Minh); gọi xe cho mọi nhân vật |
| Đói | App giao đồ ăn | Đơn giao đồ ăn; Phở Thọ lên app để có đơn |
| Bản Đồ Ơi | App bản đồ | Dẫn đường, đôi khi chỉ vào ngõ cụt; vô dụng khi đã thuộc đường |
| Alô Chat | App nhắn tin | Nhiệm vụ, nhóm tổ dân phố, nhóm tài xế báo chốt, tin nhắn của mẹ Minh |
| MặtBook | Mạng xã hội | Dư luận, hội nhóm "Phố Cũ Còn Đây", tin rao sang nhượng |
| Tóp Tóp | Video ngắn | Đăng clip quán, ảnh; viral thay đổi doanh thu |
| Ví Heo | Ví điện tử | Quét QR trả tiền, nhận tiền cuốc |
| Sổ Tay Bán Hàng | App quản lý | Sổ sách các cơ sở kinh doanh |
| Trời Hà Nội | App thời tiết | Thời tiết, AQI từ dữ liệu thật, cảnh báo ngập |
| Tra cứu phạt nguội | Tra cứu thật | Lỗi do camera ghi, nộp phạt trực tuyến |
| Máy ảnh / Kho phim | Camera | Chế độ chụp ảnh, chồng ảnh xưa (Khôi) |
| Băng cát-sét | Trình phát | 24 cuộn băng của ông Khải |

Dùng điện thoại khi xe đang chạy (mở app, nghe gọi) là lỗi `dung_dien_thoai_khi_lai`. Muốn nhận cuốc
phải tấp vào lề: một lựa chọn rủi ro nhỏ lặp lại hàng trăm lần.

## 5. Uy tín và phe phái

Mỗi phe trong `factions.json` có thanh uy tín -100 đến 100 chung cho cả ba nhân vật (phố biết họ là
một nhóm). Uy tín thay đổi qua `reward.reputation` của nhiệm vụ và `effect` của lựa chọn thoại.

| Phe | Uy tín cao mở ra | Đối địch |
| --- | --- | --- |
| Hội xe ôm Ô Quan Chưởng | Chỗ đỗ ở phố cổ, khách quen giới thiệu | Cộng đồng tài xế app |
| Cộng đồng tài xế và shipper | Báo chốt, báo ngập, cứu hộ miễn phí | Hội xe ôm truyền thống |
| Hội Người cao tuổi phường | Ký ức (mở thêm ảnh xưa), phiếu ủng hộ ở tổ dân phố | |
| Tổ dân phố số 5 Hàng Chiếu | Kết quả bỏ phiếu về dự án | Kim Long Land |
| Ban quản lý chợ Đồng Xuân | Giá sỉ tốt, quyền thuê sạp | |
| Những người bán hàng rong | Tin đồn, nguồn tem phiếu và đồ cổ | |
| Nhóm "Phố Cũ Còn Đây" | Truyền thông, hồ sơ di sản, kiến nghị | Kim Long Land |
| Kim Long Land | Hợp đồng, việc làm lương cao | Bảo tồn, tổ dân phố |
| Làng cờ bờ hồ | Thách đấu cụ Bảo, chuyện xưa | |
| CLB Phượt Thủ Đô | Tuyến đường dài, đua xe đạp | |

Không phe nào "ác". Uy tín Kim Long Land cao là con đường chơi hợp lệ (tiền nhiều, phố giận).

## 6. Kinh doanh

- Cơ sở trong `businesses.json` có giá sang nhượng, thu/chi mỗi ngày, nâng cấp (`income_bonus`).
- Mỗi ngày game, `business_tick` tính doanh thu theo: chất lượng (điểm minigame gần nhất), uy tín,
  thời tiết (rét thì phở đông, mưa ngập thì vắng), sự kiện (Tết đóng cửa, Trung thu đông), mạng xã
  hội (video viral +30% trong 3 tuần).
- Nhân viên NPC có độ hài lòng; trả lương thấp thì họ nghỉ (như "thằng giao hàng nghỉ" ở chương 1).
- Lỗ 3 tháng liền thì phải sang nhượng lại.
- Một cơ sở có thể có bản **góp vốn** là một mục riêng (`tiem_sua_xe_duc_coi_gop_von`: giá 40%, thu
  40%, mở bằng cờ lựa chọn); nâng cấp "sang nốt phần còn lại" đưa nó thành sở hữu đủ.

## 7. Sự kiện

Sự kiện trong `events.json` kích hoạt theo lịch âm, lịch dương, ngày trong tuần hoặc dữ liệu sống,
và áp `world_changes` (tag cho hệ thống dựng cảnh: cờ, đèn lồng, cấm xe, đổi doanh thu...). Sự kiện
có thể mở nhiệm vụ riêng (`missions`). Danh sách hiện có: Tết, Giao thừa, Ông Công ông Táo, Rằm
tháng Giêng, Giỗ Tổ, Trung thu, Vu Lan, Quốc khánh, Giải phóng Thủ đô, 30/4-1/5, phố đi bộ cuối tuần
(buổi tối thứ Sáu đến Chủ nhật, và ban ngày thứ Bảy, Chủ nhật: hai mục), mùa hoa sữa, mùa loa kèn,
nồm, mưa ngập, nắng nóng, rét đậm, bụi mịn, bão (20 mục).

### 7.1 Sự kiện ngẫu nhiên trên phố (`random_events.json`)

Giữa hai nhiệm vụ, phố không được trống. Collection `random_events` (45 mục, schema
`random_events.schema.json`) là phần tương đương "random events" và "Strangers and Freaks" không
người giao của GTA5: xe chết máy giữa làn ô tô, cụ bà không sang được đường, khách để quên điện
thoại trên yên, cây đổ sau bão, rạp cưới chắn ngõ, đám tang, chốt CSGT đột xuất, khách Tây say ở Tạ
Hiện, bà xôi trả thừa tiền, rước đèn Hàng Mã, ông đồ Văn Miếu, bông hồng cài áo lễ Vu Lan...

- **Cách nổ**: mỗi giờ game, runtime (`UHanoiRandomEventSubsystem`, chưa viết) duyệt các sự kiện có
  `spawn` khớp quận, địa danh (trong 150 m), loại đường (`ngo`, `pho`, `duong_lon`, `de`, `cau`,
  `via_he`, `cho`, `ben_xe`), giờ, thời tiết, sự kiện lịch đang bật, nhân vật đang điều khiển, đang
  đi xe hay đi bộ; rồi tung `chance_per_game_hour`. `cooldown_days` và `max_per_playthrough` chặn lặp.
- **Mỗi sự kiện là một người**: trường `motive` (Khổ, Tập) nói vì sao NPC làm thế, theo cùng khung
  Tứ diệu đế của nhân vật truyện (08 §1). Cô bán hoa ế không "ngẫu nhiên" đứng đó: hoa lấy ở Tây Tựu 3
  giờ sáng, không bán hết thành rác, phải về trước 6 giờ nấu cơm cho mẹ chồng.
- **Mỗi sự kiện là một ngã rẽ thật**: ít nhất 2 lựa chọn, không hai lựa chọn nào cùng hậu quả, có cả
  lựa chọn đi qua (`ignore_effect`). Hậu quả là tức thì và đo được: tiền (có thể âm), uy tín với phe,
  Chú ý CSGT, mức phạt theo `traffic_rules`, vật phẩm, kỹ năng được luyện, phút game. Lựa chọn có
  `minigame` chơi một hoạt động để quyết định `effect` hay `fail_effect`.
- **Hậu quả dài** ghi ở `note` cho runtime và người viết: khách để quên điện thoại mà đem bán thì app
  bị khoá hai ngày; tranh khách ở ga Hà Nội thì bến ấy không cho Minh đứng nữa; trả lại đồng hồ cho
  bà tập dưỡng sinh thì mở hoạt động tập ở công viên đó miễn phí.
- **Chuẩn**: ≥ 40 sự kiện, đủ 6 loại (`giup_nguoi`, `giao_thong`, `hiem_hoa`, `co_hoi`, `van_hoa`,
  `kinh_te`), mỗi quận có ≥ 15 sự kiện có thể nổ, xác suất ≤ 0,5/giờ (tests/test_random_events.py).

## 8. Quy ước cho dữ liệu nhiệm vụ

Mọi khóa trong `steps[].params` đều được khai báo có kiểu trong `missions.schema.json`
(`additionalProperties: false`, validator bắt khóa lạ). Mỗi khóa có `x-consumer`:
`runtime` = `UHanoiMissionSubsystem` tự đọc; `gameplay` = code minigame/UI/xe đọc qua
`GetActiveStepParamNumber/String/Bool` hoặc `GetActiveStepParamsJson`. Test
`test_every_mission_param_is_typed_and_has_a_consumer` giữ danh sách `runtime` khớp đúng với C++.

- **Rẽ nhánh**: `next` là bảng `{khóa: bước}`; runtime chọn theo `Outcome` truyền vào
  `CompleteCurrentStep`, thiếu thì dùng khóa `default`. Nguồn khóa (`params.branch_source`):
  - `"flag"`: runtime tự chọn khóa đầu tiên trùng một cờ đang bật (cờ do lựa chọn thoại
    `from_dialogue` đặt, ví dụ `lan_mua_gia_vi_chuan` / `lan_mua_gia_vi_re` ở `c1_04`), không có thì
    `default` — validator bắt buộc có `default`;
  - `"player_input"` (hoặc bước `choice` không ghi nguồn): runtime phát `OnChoiceRequested(mission,
    bước, params.player_input, các khóa)`; UI hiện lựa chọn rồi gọi `CompleteCurrentStep(khóa)`;
  - minigame có `pass_score`: gameplay truyền `dat`/`chua_dat`.
- **Bước không có `next` chạy sang bước kế tiếp trong mảng**; bước cuối mảng kết thúc nhiệm vụ. Id
  đặc biệt của `next` (`common.schema.json#/$defs/step_id`): `end`/`success` = hoàn thành, `fail` =
  thất bại. Validator kiểm mọi đích `next` là bước của cùng nhiệm vụ hoặc một trong ba id này.
- **`set_flags` của bước** (trường riêng, không nằm trong `params`): đặt cờ ngay khi bước hoàn
  thành, trước khi chọn bước kế (nên dùng được cho `branch_source: "flag"` ngay sau đó).
  `reward.set_flags` vẫn chỉ áp khi xong cả nhiệm vụ.
- **`fail_if`** có pattern chặt: `event:<tên>` (gameplay gọi `ReportEvent`), `flag:<tên>`,
  `time<op>N` (giây trong bước), `heat<op>N`, với `op` là `>= <= == > <`, N số (có thể thập phân).
  Runtime cảnh báo trong Output Log nếu gặp quy tắc không hiểu. `params.time_limit_s` = `time>N`;
  `params.deadline_hour` làm bước thất bại (`deadline`) khi đồng hồ game vượt giờ đó (tính tiến từ
  lúc vào bước).
- **Runtime đọc**: `radius_m` (bán kính tới đích, mặc định 15 m); `wait_until`: `hours`
  `[từ, đến)` hoặc `until_hour`/`hour` (cửa sổ một giờ); `escape_traffic_police`: `heat` (cộng khi
  vào bước, mặc định 2); `requires_event` (`events:<id>`: bước không hoàn thành được cho tới khi
  gameplay gọi `SetWorldEventActive(id, true)`; phát `OnStepWaitingForEvent`; ở **bước đầu tiên**
  nó còn chặn cả `CanStartMission`/`GetAvailableMissions` cho tới khi sự kiện đang diễn ra, để
  người chơi không bị khóa trong nhiệm vụ chờ Trung thu hay chờ tối thứ Sáu); `apply_fine`
  (`traffic_rules:<id>`: lúc vào bước cộng tiền phạt xe máy và trừ điểm bằng vào phạt chưa nộp;
  phát `OnFineApplied`); `protagonist` (đổi nhân vật điều khiển khi vào bước) và
  `switch_protagonist_on_line` (`{dòng thoại: characters:<id>}`; UI thoại gọi
  `NotifyDialogueLine(dòng)`); cả hai phát `OnProtagonistSwitched`; `minimap: false` ẩn bản đồ
  nhỏ trong bước (`OnMinimapVisibilityChanged`, tự bật lại khi sang bước khác/hết nhiệm vụ).
- **Thoại có điều kiện**: xem §9. `tools/playtest.py` đi thoại theo đúng `ResolveDialogueLine` /
  `GetAvailableChoices` và đếm hệ quả đã kích hoạt (`docs/gdd/06`, `08`).
- **Cờ engine đọc**: `giam_chu_y_vinh_vien_1` (phần thưởng `s12`) do `UHanoiHeatSubsystem` đọc để
  hạ trần Chú ý một sao vĩnh viễn; nội dung không cần đọc lại.
- **Nhân vật của nhiệm vụ**: `StartMission` đổi sang mục đầu của `protagonists` nếu nhân vật đang
  điều khiển không nằm trong danh sách (phát `OnProtagonistSwitched`), nên "Nồi nước dùng lúc bốn
  giờ" luôn chơi bằng Lan dù người chơi đang là Minh. Nhiệm vụ nhiều nhân vật đổi tiếp bằng
  `params.protagonist` / `switch_protagonist_on_line`.
- **Gameplay đọc** (ví dụ): đua xe `scripted_winner_npc` + `max_player_rank` (NPC luôn thắng,
  người chơi tối đa hạng đó), `rivals`, `vehicle`, `passenger`, `cargo`, `recipe`, `pass_score`,
  `match_threshold`, `time_of_day` (giờ dàn cảnh)… xem mô tả từng khóa trong schema.

## 9. Thoại có điều kiện: lựa chọn để lại dấu vết

Nguyên tắc của chủ dự án: *lựa chọn không có hệ quả là lựa chọn vô nghĩa*. Hệ quả rẻ nhất và
"người" nhất là **nhân vật nhớ** việc người chơi đã làm và nói khác đi. Dữ liệu hỗ trợ việc đó bằng
một khối `condition` (cùng kiểu với `requires` của nhiệm vụ, `common.schema.json#/$defs/condition`)
đặt trên **dòng thoại** hoặc trên **lựa chọn** trong `dialogues`:

```json
{"id": "chao_2", "speaker": "characters:ba_hanh", "condition": {"flags": ["minh_tra_lai_vi"]},
 "text": {"vi": "Thằng cu trả ví hôm nọ đấy à? Vào đây bà bảo."}, "goto": "vao_viec"},
{"id": "chao_3", "speaker": "characters:ba_hanh", "condition": {"not_flags": ["minh_tra_lai_vi"]},
 "text": {"vi": "Cháu hỏi ai?"}}
```

- `condition` có đủ các khóa của `requires`: `missions_completed`, `min_reputation`, `hours`,
  `weather`, `protagonist`, `flags` (tất cả phải bật), và hai khóa mới dùng chung cho cả nhiệm vụ:
  `not_flags` (không cờ nào được bật) và `events_active` (`events:<id>` đang diễn ra, do gameplay gọi
  `SetWorldEventActive`).
- **Dòng** có `condition` không thỏa thì runtime **bỏ qua và chạy tiếp dòng kế trong mảng** (bỏ cả
  `goto`/`choices` của dòng đó). Nên viết dòng có điều kiện *trước*, dòng mặc định *sau*, như ví dụ
  trên. Dòng cuối của một đoạn thoại không được có điều kiện (validator bắt), kẻo thoại kết thúc
  trong im lặng.
- **Lựa chọn** có `condition` không thỏa thì không hiện. Mỗi dòng có `choices` phải giữ ít nhất
  một lựa chọn không điều kiện (validator bắt) để UI luôn có thứ để hiện.
- Runtime (`UHanoiMissionSubsystem`): `ResolveDialogueLine(dialogue, dòng)` trả dòng đầu tiên hợp
  lệ từ đó trở đi; `NextDialogueLine` đi tiếp theo `goto` hoặc thứ tự mảng; `GetAvailableChoices`
  lọc lựa chọn; `ApplyChoice` áp `effect` (tiền, uy tín, đồ, `set_flags`). UI thoại chỉ cần gọi bốn
  hàm này thay vì tự duyệt mảng.
- Công cụ: `tools/validate.py` kiểm hai quy tắc trên; `tools/playtest.py` chơi theo đúng ngữ nghĩa
  (bỏ dòng không thỏa, chỉ chọn trong lựa chọn đang hiện) và đếm cờ trong `condition` là *cờ được
  đọc*, nên một lựa chọn đặt cờ mà về sau có dòng thoại đọc cờ đó không còn bị báo "không hệ quả".
