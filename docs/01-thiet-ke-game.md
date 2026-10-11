# Tài liệu thiết kế game (GDD): Sương Đỏ

> Các con số trong tài liệu này là **giá trị khởi điểm**. Chúng sẽ được chỉnh lại khi chơi thử.

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Bối cảnh & cốt truyện](#2-bối-cảnh--cốt-truyện)
3. [Vòng lặp chơi cốt lõi](#3-vòng-lặp-chơi-cốt-lõi)
4. [Các chế độ chơi](#4-các-chế-độ-chơi)
5. [Cơ chế sinh tồn](#5-cơ-chế-sinh-tồn)
6. [Thế giới vô hạn](#6-thế-giới-vô-hạn)
7. [Vật phẩm & chế tạo](#7-vật-phẩm--chế-tạo)
8. [Xây dựng & căn cứ](#8-xây-dựng--căn-cứ)
9. [Nông nghiệp & chăn nuôi](#9-nông-nghiệp--chăn-nuôi)
10. [Chiến đấu & kẻ thù](#10-chiến-đấu--kẻ-thù)
11. [Nhân vật & tiến trình](#11-nhân-vật--tiến-trình)
12. [Cái chết & hồi sinh](#12-cái-chết--hồi-sinh)
13. [Xã hội](#13-xã-hội)
14. [Nhiệm vụ, sự kiện, xếp hạng](#14-nhiệm-vụ-sự-kiện-xếp-hạng)
15. [30 phút đầu tiên](#15-30-phút-đầu-tiên)
16. [Giao diện & điều khiển](#16-giao-diện--điều-khiển)
17. [Hình ảnh & âm thanh](#17-hình-ảnh--âm-thanh)
18. [Kiếm tiền (tùy chọn)](#18-kiếm-tiền-tùy-chọn)

---

## 1. Tổng quan

| Mục | Nội dung |
|---|---|
| Tên tạm | **Sương Đỏ** |
| Thể loại | Sinh tồn, chế tạo, xây dựng, nhập vai nhẹ, nhiều người chơi (MMO quy mô nhỏ) |
| Nền tảng | Trình duyệt web. Ưu tiên PC, có hỗ trợ cảm ứng trên điện thoại |
| Góc nhìn | 2D nhìn từ trên xuống, pixel art |
| Phiên chơi | Mỗi lần chơi 15–60 phút, nhưng tiến trình kéo dài nhiều tháng |
| Đối tượng | Người thích Don't Starve, Rust, Minecraft, Project Zomboid và các game .io |

**Điểm khác biệt:**

1. **Thế giới vô hạn có "độ sâu Sương".** Càng đi xa điểm xuất phát thì càng nguy hiểm và càng giàu tài nguyên, nên lúc nào cũng còn chỗ mới để khám phá.
2. **Kinh tế sống.** Giá NPC thay đổi theo cung cầu của cả server. Người chơi chuyên môn hóa (nông dân, thợ săn, thợ rèn, thương nhân) nên phải dựa vào nhau.
3. **Đêm Sương Đỏ.** Cứ 7 ngày trong game có một đêm quái tràn vào căn cứ. Đây là mục tiêu ngắn hạn lặp lại đều đặn.
4. **Không cần cài đặt.** Bấm link là vào chơi, có thể chơi nhanh bằng tài khoản khách.

---

## 2. Bối cảnh & cốt truyện

Một ngày nọ, một màn **sương đỏ** không rõ nguồn gốc phủ kín Trái Đất (gọi là "Đại Biến"). Người và vật hít phải sương đều bị đột biến. Chỉ một số ít người miễn nhiễm được một phần, và người chơi là một trong số đó.

Vài chục năm sau, rừng rậm đã phủ kín các thành phố cũ. Ở **Vùng Rìa**, nơi người chơi xuất hiện, sương còn mỏng. Đi càng xa thì sương càng đặc và quái càng khủng khiếp. Có lời đồn rằng tâm sương chứa **Lõi Sương**, nguồn gốc của thảm họa, nhưng chưa ai đến được đó vì thế giới không có điểm cuối.

**Cách kể chuyện:**
- Nhật ký nhặt được trong phế tích.
- Lời kể của NPC ở các trạm giao thương.
- Chuỗi nhiệm vụ cột mốc dẫn người chơi vào các vùng sâu hơn.

Không có đoạn phim dài, câu chuyện lộ ra dần trong lúc chơi.

---

## 3. Vòng lặp chơi cốt lõi

```
     ┌──────► KHÁM PHÁ ───────► THU THẬP ─────────┐
     │    (đi xa, vùng sâu) (gỗ, đá, săn, loot)   │
     │                                            │
     │                                            ▼
 GIAO DỊCH ◄──── SỐNG SÓT ◄──── XÂY DỰNG ◄──── CHẾ TẠO
 (bán hàng,     (đêm, quái,     (căn cứ,      (công cụ,
  mua đồ cần)    thời tiết)      phòng thủ)    vũ khí, giáp)
```

| Vòng lặp | Thời lượng | Người chơi làm gì |
|---|---|---|
| Ngắn | 30 giây – 2 phút | Chặt cây, đập đá, ăn uống, đánh quái, chạy về đống lửa khi trời tối |
| Trung | 1 ngày game (~20 phút) | Chuẩn bị đồ, đi một chuyến khám phá, mang hàng về bán, chế đồ mới |
| Dài | Nhiều ngày đến nhiều tuần | Mở khóa bậc công nghệ, mở rộng căn cứ, chuẩn bị Đêm Sương Đỏ, tiến vào vùng sâu hơn, xây bang hội, leo bảng xếp hạng |

---

## 4. Các chế độ chơi

Mỗi **Cõi** (realm) có nền kinh tế riêng: ví Xu riêng, sàn giao dịch riêng, giá hệ thống riêng. Đồ không mang được từ cõi này sang cõi khác, để không ai cày đồ ở thế giới dễ rồi đem sang thế giới chính.

| Chế độ | Mô tả | Số người | Khi chết | Giao dịch | Giai đoạn |
|---|---|---|---|---|---|
| **Sinh tồn Vô hạn** *(chính)* | Thế giới chung, tồn tại vĩnh viễn, không bao giờ reset, rộng vô hạn | 50–200 / server | Rơi túi đồ, hồi sinh | Đầy đủ: hệ thống và người chơi | MVP |
| **Thế giới riêng / Co-op** | Thế giới riêng với seed tùy chọn, mời bạn bè, chỉnh độ khó. Vẫn vô hạn | 1–8 | Tùy chỉnh | Chỉ với hệ thống và trong nhóm | 4 |
| **Hardcore** | Chỉ có một mạng. Chết là nhân vật bị xóa và tên được ghi vào Bảng Vinh Danh | 50–100 | Mất nhân vật | Đầy đủ (cõi riêng) | 4 |
| **Mùa giải** | Server mở lại sau mỗi 8–12 tuần với luật đặc biệt (ví dụ "thức ăn hỏng gấp đôi"). Phần thưởng trang trí giữ lại trong tài khoản | 50–200 | Như Vô hạn | Đầy đủ (cõi riêng) | 5 |
| **Thủ thành** | Chế độ ngắn: 1–4 người giữ một căn cứ dựng sẵn trước các đợt quái liên tiếp, tính điểm theo số đợt | 1–4 | Kết thúc trận | Không | Sau ra mắt |
| **Sáng tạo** | Không giới hạn tài nguyên, dùng để thiết kế và chia sẻ mẫu căn cứ | 1–8 | Không chết | Không | Sau ra mắt |

### "Vô hạn" theo hai nghĩa

1. **Không gian:** thế giới không có biên. Đi càng xa thì "độ sâu" (Ring) càng tăng.
2. **Thời gian:** thế giới chính không bao giờ reset. Bộ đếm "Ngày sống sót" của nhân vật tăng mãi cho tới khi chết.

### Độ khó tăng dần

- **Thế giới chung:** cấp quái phụ thuộc vào **vị trí**, tức độ sâu Ring, chứ không phụ thuộc thời gian. Nhờ vậy người mới và người cũ chơi chung một thế giới mà vẫn công bằng.
  - `Cấp quái = 1 + 4 × Ring + ngẫu nhiên(0..2)`
  - `Máu quái = Máu gốc × (1 + 0.1 × (Cấp − 1))^1.5`
  - `Sát thương quái = ST gốc × (1 + 0.08 × (Cấp − 1))`
- **Thế giới riêng / Hardcore:** cộng thêm yếu tố thời gian, `+1 cấp quái cho mỗi 10 ngày`.
- **Đêm Sương Đỏ:** độ mạnh tăng theo giá trị căn cứ và số lần đã vượt qua (xem [mục 8](#8-xây-dựng--căn-cứ)).

Chỉ số quái tăng nhanh hơn trang bị, vì trang bị tăng theo đường tuyến tính (xem "Cấp Sương" ở [mục 7](#7-vật-phẩm--chế-tạo)). Kết quả là luôn có một **biên giới mềm**: người giỏi nhất đẩy được biên giới ra xa dần nhờ kỹ năng, đồng đội và vật phẩm tiêu hao, nhưng không bao giờ "phá đảo".

---

## 5. Cơ chế sinh tồn

### 5.1 Chỉ số

| Chỉ số | Thang | Giảm do | Hồi bằng | Khi cạn hoặc quá ngưỡng |
|---|---|---|---|---|
| **Máu** | 0–100 | Sát thương, đói/khát cạn, quá lạnh/nóng, nhiễm Sương | Tự hồi khi no > 60%, băng gạc, thuốc, ngủ | 0 = chết |
| **Đói** | 0–100 | Theo thời gian, cạn sau ~1,5 ngày game (~30 phút thực); vận động mạnh làm giảm nhanh hơn | Ăn | 0: mất 1 máu/3 giây, thể lực tối đa giảm |
| **Khát** | 0–100 | Theo thời gian, cạn sau ~1 ngày game (~20 phút thực); trời nóng làm giảm nhanh hơn | Uống nước sạch hoặc đã đun sôi | 0: mất 1 máu/2 giây |
| **Thể lực** | 0–100 | Chạy, đánh, né, chặt cây | Đứng yên hoặc đi bộ | 0: không chạy hay né được, đánh chậm |
| **Thân nhiệt** | °C, chuẩn 37 | Bị kéo theo nhiệt độ môi trường (biome, đêm, mưa, mùa) | Quần áo, lửa trại, nhà có mái, đồ ăn nóng/lạnh | < 35: chậm, mất máu. > 39: khát gấp đôi, mất máu |
| **Nhiễm Sương** | 0–100% | Ở vùng sương dày mà không đeo mặt nạ, bị quái biến dị cắn | Huyết thanh, ở trong nhà có máy lọc khí, ngủ ở Vùng Rìa | > 50%: ảo giác (quái giả, nhiễu bản đồ). > 80%: máu tối đa giảm. 100%: chết |

> **Nhiễm Sương** là cơ chế riêng của game. Nó **giới hạn tự nhiên** việc đi sâu: muốn vào vùng sâu hơn phải có mặt nạ, lõi lọc và huyết thanh. Những thứ này lại là mặt hàng giao dịch quan trọng.

### 5.2 Hiệu ứng trạng thái

- **Chảy máu:** mất máu liên tục, chữa bằng băng gạc.
- **Gãy chân:** đi chậm, chữa bằng nẹp.
- **Ngộ độc thực phẩm:** nôn mửa, đói và khát giảm nhanh. Nguyên nhân là ăn đồ sống hoặc đồ đã hỏng.
- **Cảm lạnh:** thể lực hồi chậm.
- **Ướt:** mất nhiệt nhanh, hết khi hong khô bên lửa.
- **No nê / Ấm áp / Nghỉ ngơi tốt:** các hiệu ứng có lợi khi ăn đồ nấu ngon, ở gần lửa hoặc ngủ trên giường.

### 5.3 Thức ăn & nấu nướng

- Thức ăn hỏng dần qua 3 mức: **Tươi → Ôi → Hỏng**. Có thể kéo dài hạn dùng bằng muối, hun khói, sấy khô hoặc tủ lạnh (cần điện).
- Món nấu từ nhiều nguyên liệu cho hiệu ứng có lợi dài hơn và tốt hơn. Ví dụ, súp nấm thịt cho thêm +20% thể lực tối đa trong 10 phút.
- Hệ quả kinh tế: thức ăn không tích trữ mãi được, nên người chơi phải liên tục mua bán. Đầu bếp giỏi là một nghề có giá trị.

### 5.4 Ngày – đêm, mùa, thời tiết

**Một ngày game = 20 phút thực:** ban ngày 13 phút, hoàng hôn 1 phút, ban đêm 5 phút, bình minh 1 phút.

- **Ban đêm:** tầm nhìn giảm mạnh. Quái đông hơn và mạnh hơn. Ánh sáng (đuốc, lửa trại, đèn) trở thành tài nguyên sống còn.

**Bốn mùa, mỗi mùa 7 ngày game:**

| Mùa | Ảnh hưởng |
|---|---|
| Xuân | Cây mọc nhanh, mưa nhiều |
| Hạ | Nắng nóng, khát nhanh, có hạn hán |
| Thu | Mùa thu hoạch, sương mù nhiều |
| Đông | Lạnh, tuyết rơi, không trồng được ngoài trời |

Mùa đông làm thức ăn khan hiếm, nên giá tăng tự nhiên. Người biết tích trữ sẽ có lãi.

**Thời tiết:**

| Loại | Tác động |
|---|---|
| Mưa | Làm đầy bình hứng nước, giảm thân nhiệt, làm ướt |
| Giông | Sét có thể làm cháy cây |
| Nắng gắt | Tăng thân nhiệt |
| Bão tuyết | Giảm tầm nhìn, rất lạnh |
| Mưa axit | Chỉ ở vùng sâu, làm hỏng trang bị |
| Sương Dâng | Sự kiện: sương lan ra Vùng Xám trong vài giờ |

---

## 6. Thế giới vô hạn

### 6.1 Cách thế giới được tạo

- Bản đồ là **lưới ô** (tile 32 px), chia thành **chunk** 32×32 ô.
- Mỗi chunk được sinh từ **seed** của thế giới bằng hàm nhiễu (simplex noise). Ba lớp nhiễu là độ cao, độ ẩm và nhiệt độ; kết hợp lại cho ra **biome**. Lên trên đó là lớp vật thể: cây, đá, phế tích.
- Cơ sở dữ liệu **chỉ lưu những gì người chơi đã thay đổi** (chặt cây, xây nhà). Nhờ vậy thế giới vô hạn mà dung lượng lưu trữ vẫn nhỏ.
- Tài nguyên tự mọc lại: cây sau ~3 ngày game, quặng sau ~5 ngày, chỉ áp dụng ở chunk không có công trình.

### 6.2 Các vùng theo độ sâu (Ring)

`Ring = floor(khoảng cách từ tâm thế giới / 1.000 ô)`

| Vùng | Khoảng cách | Sương | PvP | Đặc điểm |
|---|---|---|---|---|
| **Vùng Rìa** (Ring 0) | 0 – 1.000 ô | Không có | Tắt | Khu tân thủ, có Trạm Trung Tâm. Tài nguyên bậc 0–1 |
| **Vùng Xám** (Ring 1–2) | 1.000 – 3.000 | Mỏng | Chỉ khi cả hai bên bật cờ PvP | Tài nguyên bậc 1–2, phế tích đô thị |
| **Vùng Đỏ** (Ring 3–5) | 3.000 – 6.000 | Dày | Bật ở mọi nơi, trừ trong trạm và lãnh thổ | Tài nguyên bậc 3, Tinh thể Sương cấp thấp, boss |
| **Vùng Thẳm** (Ring 6 trở đi, vô hạn) | > 6.000 | Rất dày, đặc dần theo Ring | Bật toàn phần | Bậc 4 trở lên, Tinh thể Sương cấp cao. Cấp quái tăng mãi |

> Ở tốc độ đi bộ ~4 ô/giây, ra tới rìa Vùng Đỏ mất khoảng 12 phút. Vì vậy cần có ngựa, xe và **dịch chuyển nhanh giữa các trạm** (mất phí).

### 6.3 Biome

| Biome | Tài nguyên đặc trưng | Mối nguy |
|---|---|---|
| Đồng cỏ | Cỏ sợi, đá nhỏ, thỏ, gà rừng | Rất ít |
| Rừng rậm | Gỗ, nấm, quả mọng, nai | Sói (theo bầy, ban đêm) |
| Đầm lầy | Lau sậy, đất sét, thảo dược | Rắn, đỉa, bệnh tật |
| Sa mạc | Cát (làm thủy tinh), xương rồng (nước), dầu thô | Nóng, bọ cạp |
| Núi tuyết | Quặng sắt, than, lông thú | Lạnh, gấu |
| Bờ biển / Hồ | Cá, muối, cát, rong biển | Cua đột biến |
| Phế tích đô thị | Phế liệu, linh kiện điện tử, thuốc, đạn | Kẻ Nhiễm, bẫy cũ, chuột đàn |
| Rừng Sương *(chỉ ở vùng sâu)* | Tinh thể Sương, Gỗ Huyết | Quái biến dị cấp cao |

### 6.4 Địa điểm đặc biệt (POI)

- **Trạm giao thương (tiền đồn):** khoảng một trạm cho mỗi khu 1.500×1.500 ô. Trạm là vùng an toàn, có NPC, sàn giao dịch, hòm thư, kho an toàn, điểm dịch chuyển và khu chợ sạp hàng.
- **Hầm trú ẩn, bệnh viện, trạm xăng, căn cứ quân sự, xác máy bay:** chứa loot theo chủ đề.
- **Hang động:** hầm ngục nhỏ có boss, cấu trúc sinh ngẫu nhiên.
- **Trại cướp:** NPC thù địch canh giữ kho đồ.
- **Tổ quái:** phá được tổ thì quái quanh đó ngừng sinh ra.

---

## 7. Vật phẩm & chế tạo

### 7.1 Nhóm vật phẩm

Tài nguyên thô · Vật liệu tinh chế · Công cụ · Vũ khí · Đạn · Giáp/quần áo · Thức ăn · Thuốc · Công trình · Hạt giống · Linh kiện · Bản thiết kế · Vật phẩm đặc biệt

- **Độ hiếm:** Thường (trắng) · Tốt (xanh lá) · Hiếm (xanh dương) · Sử thi (tím) · Huyền thoại (cam).
- **Độ bền:** công cụ, vũ khí và giáp mòn dần khi dùng.
  - Sửa đồ tốn vật liệu và làm giảm 5% độ bền tối đa. Đồ cuối cùng sẽ hỏng hẳn.
  - Cơ chế này là "phễu tiêu hao" quan trọng của kinh tế: đồ cũ biến mất nên luôn có người cần mua đồ mới.
- **Chỉ số dao động:** đồ tự chế có chỉ số ±10% tùy kỹ năng chế tạo. Đồ hiếm có thêm 1–3 dòng thuộc tính phụ. Vì vậy hai thanh kiếm cùng loại có thể khác giá.
- **Túi đồ:** 24 ô và thanh nhanh 8 ô. Ba lô giúp mở rộng thêm.
  - Mỗi loại vật phẩm có giới hạn xếp chồng (stack) 1, 20, 50 hoặc 100.
  - Mang quá **tải trọng** thì đi chậm.

### 7.2 Các bậc công nghệ

| Bậc | Tên | Trạm chế tạo | Ví dụ mở khóa |
|---|---|---|---|
| T0 | Nguyên thủy | Tay không, lửa trại | Rìu đá, cuốc đá, giáo gỗ, túi ngủ, lều lá, đuốc |
| T1 | Rèn | Bàn chế tạo, lò nung | Công cụ sắt, cung, giáp da, tường gỗ, rương, bình nước |
| T2 | Cơ khí | Bàn cơ khí | Nỏ, súng tự chế, bẫy lò xo, máy hứng nước, xe đẩy, cửa khóa mã |
| T3 | Điện | Bàn điện tử, máy phát điện | Đèn, hàng rào điện, tháp súng tự động, tủ lạnh, máy lọc khí, radio |
| T4 | Công nghệ Sương | Lò Tinh thể | Mặt nạ cấp cao, giáp Sương, vũ khí năng lượng, cổng dịch chuyển của bang |
| T5+ | Tinh luyện | Lò Tinh thể cấp N | Nâng **Cấp Sương** cho trang bị, không giới hạn |

**Mở khóa công thức** bằng ba cách:
1. Có trạm chế tạo đủ bậc.
2. **Nghiên cứu:** phân tách đồ nhặt được để lấy điểm nghiên cứu.
3. **Bản thiết kế hiếm** nhặt trong phế tích. Bản thiết kế **giao dịch được**, nên là món hàng giá trị.

### 7.3 Tiến trình vô hạn của trang bị: "Cấp Sương"

- Trang bị bậc T4 trở lên có thể cường hóa lên +1, +2, ... không giới hạn.
- Nguyên liệu là **Tinh thể Sương**. Cấp càng cao càng cần tinh thể cấp cao, mà tinh thể cấp cao chỉ có ở Ring sâu hơn.
- `Chỉ số = Chỉ số gốc × (1 + 0.06 × Cấp Sương)` (tăng tuyến tính)
- `Số tinh thể cần = 10 × 1.25^Cấp` (chi phí tăng theo cấp số nhân)
- Kết quả: lúc nào cũng có mục tiêu tiếp theo, nhưng sức mạnh không tăng vọt. Tinh thể Sương trở thành "hàng hóa xa xỉ" chính của nền kinh tế.

---

## 8. Xây dựng & căn cứ

- **Đặt công trình trên lưới.** Vật liệu từ yếu đến mạnh: Gỗ → Đá → Kim loại → Bê tông cốt thép → Hợp kim Sương. Mỗi loại có máu và khả năng kháng riêng.
- **Các loại công trình:**
  - Nền, tường, cửa (khóa mã hoặc khóa chìa), cửa sổ.
  - Mái: che mưa và giữ ấm.
  - Rương, trạm chế tạo, giường (điểm hồi sinh).
  - Ruộng, chuồng nuôi, bẫy, tháp canh, đèn, máy phát điện, sạp hàng.
- **Cột Lãnh Thổ:**
  - Khi đặt xuống, cột xác lập một vùng sở hữu bán kính 16 ô, nâng cấp được tới 48 ô.
  - Trong vùng này, chỉ chủ và người được cấp quyền mới được xây, mở rương hay mở cửa.
  - Lãnh thổ tốn **phí bảo trì** mỗi ngày, trả bằng Xu hoặc vật liệu. Nợ quá 7 ngày thì công trình bắt đầu xuống cấp và cuối cùng biến mất.
  - Mục đích: dọn căn cứ bỏ hoang khỏi thế giới, đồng thời rút bớt Xu khỏi nền kinh tế.
- **Tấn công căn cứ (raid):**
  - Ở Vùng Rìa và Vùng Xám, người chơi **không thể** phá công trình của người khác.
  - Ở Vùng Đỏ và Vùng Thẳm thì được phá, nhưng có **bảo vệ khi offline**: nếu không thành viên nào online, công trình nhận ít hơn 80% sát thương.

### Đêm Sương Đỏ (mỗi 7 ngày game)

- Trăng đỏ mọc, quái tràn về các căn cứ thành nhiều đợt.
- `Điểm đợt quái = (50 + 10 × số Đêm đã vượt qua liên tiếp + 0.02 × Giá trị căn cứ) × (1 + 0.3 × Ring)`
- Nếu không thành viên nào online, quái chỉ đánh tường ngoài và không phá kho đồ.
- Vượt qua được thì nhận **Rương Sương Đỏ**. Chuỗi Đêm vượt qua liên tiếp được ghi lên bảng xếp hạng.
- Người chơi có thể **thuê lính đánh thuê** (người chơi khác) để giữ căn cứ. Đây là một kiểu giao dịch dịch vụ.

---

## 9. Nông nghiệp & chăn nuôi

- **Trồng trọt:** cày đất, gieo hạt, tưới nước, bón phân.
  - Mỗi loại cây hợp với một số mùa nhất định.
  - **Nhà kính** cho phép trồng trong mùa đông.
  - Cây bị bệnh hoặc sâu hại có thể lan sang cây bên cạnh.
- **Thuần hóa vật nuôi:**

  | Vật nuôi | Công dụng |
  |---|---|
  | Gà | Đẻ trứng |
  | Dê | Cho sữa |
  | Chó | Bảo vệ, đánh hơi loot |
  | Ngựa | Đi nhanh, chở thêm đồ |

- **Tăng trưởng tính theo thời gian thực** kể cả khi không có người ở gần. Khi chunk được tải lại, server tính bù phần đã lớn thêm. Vì vậy ngoài giờ online, nông trại vẫn tiếp tục làm ra sản phẩm.

---

## 10. Chiến đấu & kẻ thù

### 10.1 Cách đánh

- **Cận chiến:** vung vũ khí theo hướng chuột. Đòn thường có thể nối thành chuỗi; đòn mạnh cần giữ chuột và tốn thể lực.
- **Đánh xa:** cung, nỏ, súng tự chế, đồ ném (lựu đạn tự chế, bom xăng).
  - **Đạn hiếm**, nên đạn là mặt hàng có giá cao.
- **Né (lăn):** tốn thể lực, có một khoảnh khắc ngắn không nhận sát thương.
- **Giáp:** giảm sát thương theo loại (chém, đâm, đạn, nhiệt, Sương).
- **Âm thanh thu hút quái.** Chạy và bắn súng gây tiếng động; đi rón rén và dùng cung thì yên lặng. Lẩn tránh vì vậy có ý nghĩa.

### 10.2 Kẻ thù

| Nhóm | Ví dụ | Hành vi |
|---|---|---|
| Động vật | Thỏ, nai, sói, gấu, cá sấu | Thỏ và nai bỏ chạy, sói đi săn theo bầy |
| Biến dị | **Kẻ Nhiễm** (chậm, nghe tiếng động), **Kẻ Chạy Sương** (nhanh, chỉ ra ban đêm), **Kẻ Phình** (tự nổ ra khí độc), chuột đàn, nhện sương | Tấn công, kéo bầy |
| Con người | Băng cướp NPC | Có trại, biết nấp, bắn từ xa |
| Boss | Gấu Sương (núi tuyết), Mẹ Bầy (tổ nhện), Khổng Lồ Phế Tích, Sứ Giả Sương Đỏ (Đêm Sương Đỏ ở vùng sâu) | Có nhiều giai đoạn và kỹ năng riêng. Boss thế giới xuất hiện theo lịch và cần nhiều người cùng đánh |

**AI theo trạng thái:** Lang thang → Cảnh giác → Truy đuổi → Tấn công → Bỏ chạy. Quái phát hiện người chơi bằng thị giác (góc nhìn, ánh sáng) và thính giác.

---

## 11. Nhân vật & tiến trình

- **Không chọn lớp nhân vật cố định.** Làm gì nhiều thì kỹ năng đó tăng.

  | Kỹ năng | Tác dụng chính |
  |---|---|
  | Thu hoạch | Lấy được nhiều tài nguyên hơn mỗi lần |
  | Săn bắn | Thịt, da nhiều hơn; dễ tiếp cận con mồi |
  | Cận chiến | Sát thương và tốc độ đánh gần |
  | Bắn | Độ chính xác, tốc độ nạp đạn |
  | Chế tạo | Chỉ số đồ chế cao hơn |
  | Xây dựng | Công trình bền hơn, rẻ hơn |
  | Nấu ăn | Hiệu ứng món ăn tốt và lâu hơn |
  | Nông nghiệp | Cây lớn nhanh, thu hoạch nhiều |
  | Y tế | Hồi máu tốt hơn, tự chữa trạng thái xấu |
  | Thương lượng | Giảm thuế sàn, được giá tốt hơn với NPC, tăng hạn mức bán cho hệ thống |
  | Sinh tồn | Chịu đói, khát, lạnh tốt hơn |

- **Cấp kỹ năng 1–100.** Ở các mốc 10/25/50/75/100, người chơi chọn **1 trong 2 đặc tính** (perk).
  - Ví dụ ở Nấu ăn cấp 25: "Món ăn hỏng chậm 50%" hoặc "Nấu 2 phần trong 1 lần".
  - Khó giỏi mọi thứ cùng lúc, nên người chơi chuyên môn hóa và trao đổi với nhau.
- **Khi chết:** mất 5% kinh nghiệm của cấp hiện tại, không bị tụt cấp.
- **Thành tựu và danh hiệu:** "Sống sót 100 ngày", "Thương nhân bạc triệu", "Kẻ đi xa nhất", ...
- **Tiến trình tài khoản:** ngoại hình, danh hiệu và hồ sơ dùng chung cho mọi chế độ.

---

## 12. Cái chết & hồi sinh

**Chế độ Vô hạn:**

- Khi chết, **túi hành trang** rơi tại chỗ và tồn tại 30 phút thực.
  - Ở Vùng Rìa và Vùng Xám, chỉ chủ nhặt được trong 10 phút đầu.
  - Ở Vùng Đỏ và Vùng Thẳm, ai cũng nhặt được ngay.
- Trang bị đang mặc mất 10% độ bền.
- **Xu không rơi.** Xu là số dư trong ví, không phải vật phẩm (xem tài liệu Kinh tế).
- **Hồi sinh** tại một trong các nơi sau:
  - Giường hoặc túi ngủ đã đặt (có thời gian hồi).
  - Trạm giao thương đã khám phá gần nhất.
  - Điểm ngẫu nhiên ở Vùng Rìa.
- **Kho an toàn** ở trạm giao thương: đồ gửi ở đây không bao giờ mất, phải trả phí thuê.

**Hardcore:** chết là nhân vật bị xóa vĩnh viễn, kể cả đồ trong kho. Tên và số ngày sống sót được ghi vào Bảng Vinh Danh.

---

## 13. Xã hội

- **Kênh chat:** Gần đây · Toàn server · Tổ đội · Bang hội · Riêng · **Giao dịch** (kênh riêng cho rao bán, không làm loãng kênh chung).
- **Tổ đội (tối đa 6 người):** thấy vị trí nhau trên bản đồ, không gây sát thương lên nhau, chia kinh nghiệm khi đánh boss.
- **Bang hội:**
  - Tên và biểu tượng riêng; các chức vụ có quyền hạn khác nhau.
  - Kho đồ chung và ngân quỹ chung bằng Xu.
  - Lãnh thổ chung, nhiệm vụ bang, đơn hàng lớn của bang.
  - Chiến tranh bang hội ở Vùng Đỏ (giai đoạn sau).
- **Khác:** danh sách bạn bè, chặn, báo cáo vi phạm, biểu cảm (emote), đánh dấu chung trên bản đồ.

---

## 14. Nhiệm vụ, sự kiện, xếp hạng

- **Hướng dẫn tân thủ:** 15 phút đầu dạy chơi qua các nhiệm vụ tự nhiên, không chặn màn hình bằng chữ (xem [mục 15](#15-30-phút-đầu-tiên)).
- **Nhiệm vụ cột mốc (cốt truyện):** dẫn người chơi vào từng vùng sâu hơn, mở dần bí ẩn về Lõi Sương.
- **Nhiệm vụ hằng ngày/tuần** từ NPC và **bảng đơn hàng** ở trạm (xem tài liệu Kinh tế).
- **Sự kiện thế giới:**

  | Sự kiện | Mô tả |
  |---|---|
  | Đêm Sương Đỏ | Mỗi 7 ngày game, quái tấn công căn cứ |
  | Thả hàng tiếp tế | Một chiếc máy bay thả thùng hàng xuống, người chơi tranh nhau lấy |
  | Thương nhân lưu động | Xuất hiện ngẫu nhiên ngoài hoang dã, bán đồ hiếm |
  | Boss thế giới | Xuất hiện theo lịch, cần nhiều người cùng đánh |
  | Mưa thiên thạch tinh thể | Tinh thể Sương rơi xuống một khu vực |
  | Sương Dâng | Sương tạm thời lan rộng ra Vùng Xám |
  | Lễ hội | Dịp Tết, Trung thu: phần thưởng trang trí |

- **Bảng xếp hạng:**
  - Ngày sống sót (Hardcore)
  - Tài sản
  - Độ sâu xa nhất đã tới
  - Chuỗi Đêm Sương Đỏ liên tiếp
  - Số boss đã hạ
  - Bang hội mạnh nhất

---

## 15. 30 phút đầu tiên

| Phút | Người chơi trải nghiệm |
|---|---|
| 0–2 | Tỉnh dậy ở Vùng Rìa. Nhiệm vụ đầu tiên: nhặt cành cây, đá, cỏ sợi, rồi chế **rìu đá** |
| 2–8 | Chặt cây, dựng **lửa trại**, ăn quả mọng, đun nước suối cho vào bình. Học về đói, khát và thể lực |
| 8–13 | Trời ngả hoàng hôn. Nhiệm vụ gợi ý làm **đuốc** và **lều lá**. Lần đầu nghe tiếng Kẻ Nhiễm gầm trong bóng tối |
| 13–18 | Đêm đầu tiên. Thủ bên đống lửa, hạ con quái đầu tiên, thấy tầm quan trọng của ánh sáng |
| 18–24 | Trời sáng. Nhiệm vụ dẫn tới **Trạm Trung Tâm**. Bán da thỏ, nhận những đồng Xu đầu tiên, nhìn thấy sàn giao dịch và các sạp hàng của người chơi khác |
| 24–30 | Mua **hạt giống**, làm **bàn chế tạo**, chọn chỗ cắm **Cột Lãnh Thổ**: căn cứ đầu tiên ra đời. Bộ đếm hiện "Đêm Sương Đỏ: còn 6 ngày" |

Mục tiêu là sau 30 phút người chơi đã làm quen với **cả sáu trụ cột**: sinh tồn, chế tạo, chiến đấu, xây dựng, giao dịch, mục tiêu dài hạn.

---

## 16. Giao diện & điều khiển

### 16.1 Màn hình chơi (HUD)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Máu ████████░░ 86   Đói ██████░░░░ 64   Khát ████░░░░░░ 41                 │
│ Thể lực █████████░  Thân nhiệt 36.8°C   Nhiễm Sương 12%                    │
│                                                 ┌────────────────────────┐ │
│                                                 │   [ Bản đồ nhỏ ]       │ │
│                                                 │ Vùng Xám · Ring 2      │ │
│       ( Thế giới game )                         │ Ngày 47 · 21:30 (Đêm)  │ │
│                                                 │ Đêm Sương Đỏ: 2 ngày   │ │
│                                                 └────────────────────────┘ │
│ ┌─[Gần][Toàn server][Bang][Giao dịch]──┐        Nhiệm vụ: Mang 20 da       │
│ │ Minh: Bán 200 quặng sắt, 9 Xu/cái    │        thỏ tới Trạm (12/20)       │
│ │ Lan: Cần mua hạt bí ngô              │                                   │
│ └──────────────────────────────────────┘                                   │
│       [1][2][3][4][5][6][7][8]                          Ví: 12.450 Xu      │
└────────────────────────────────────────────────────────────────────────────┘
```

**Các màn hình chính:** Túi đồ, Chế tạo (có tìm kiếm và lọc theo trạm), Xây dựng, Bản đồ lớn, Kỹ năng, Nhiệm vụ, Giao dịch trực tiếp, Sàn giao dịch, Hòm thư, Bang hội, Cài đặt.

### 16.2 Điều khiển

| Hành động | PC | Điện thoại |
|---|---|---|
| Di chuyển | W A S D | Cần điều khiển ảo bên trái |
| Tấn công / dùng đồ | Chuột trái | Nút tấn công (tự nhắm mục tiêu gần nhất) |
| Đòn phụ / đỡ | Chuột phải | Nút phụ |
| Chạy | Giữ Shift | Đẩy cần điều khiển hết cỡ |
| Né | Space | Nút né |
| Tương tác / nhặt | E | Chạm vào vật thể |
| Túi đồ | Tab hoặc I | Nút túi |
| Chế tạo / Xây dựng | C / B | Nút tương ứng |
| Bản đồ | M | Chạm bản đồ nhỏ |
| Chat | Enter | Nút chat |
| Thanh nhanh | 1–8 hoặc cuộn chuột | Chạm vào ô |

**Hỗ trợ người chơi:** chỉnh cỡ chữ, chế độ cho người mù màu (độ hiếm phân biệt bằng cả biểu tượng, không chỉ màu), đổi phím tắt.

---

## 17. Hình ảnh & âm thanh

- **Pixel art 32×32.**
  - Vùng Rìa dùng tông màu ấm và tươi.
  - Đi vào sâu thì màu ngả dần sang đỏ và tím, kèm hiệu ứng sương động (shader).
- **Ánh sáng động ban đêm** (lightmap): bóng tối thật sự đáng sợ, ánh lửa thật sự ấm áp. Đây là điểm nhấn hình ảnh chính của game.
- **Trong giai đoạn prototype,** dùng tài nguyên miễn phí (Kenney.nl, OpenGameArt; cần kiểm tra giấy phép từng gói). Sau đó thay bằng art riêng.
- **Âm thanh:**
  - Nhạc nền đổi theo biome và thời điểm trong ngày.
  - Âm thanh có hướng: nghe được tiếng sói tru ở phía nào.
  - Đêm Sương Đỏ có nhạc dồn dập riêng.
  - Âm thanh trong trẻo ở Vùng Rìa, méo dần khi vào sâu trong sương.

---

## 18. Kiếm tiền (tùy chọn)

Nguyên tắc: **không trả tiền để mạnh hơn (no pay-to-win).**

- **Chỉ bán đồ trang trí:** trang phục nhân vật, kiểu dáng công trình, biểu cảm, khung hồ sơ, Thẻ Mùa giải (chỉ có phần thưởng trang trí).
- **Tiền nạp (Ngọc):**
  - **Không đổi được** sang Xu hay vật phẩm dùng để chơi.
  - **Không giao dịch được** giữa người chơi.
  - Lý do: tránh mua bán vật phẩm bằng tiền thật, giữ kinh tế trong game lành mạnh.
- **Không bán hộp quà ngẫu nhiên** (loot box) bằng tiền thật.
- **Pháp lý:** trước khi ra mắt và thu tiền tại Việt Nam, cần tìm hiểu quy định về trò chơi điện tử trực tuyến. Hai vấn đề chính:
  - Phân loại và cấp phép game nhiều người chơi kết nối server.
  - Quy định về vật phẩm ảo và thanh toán.

  Hỏi ý kiến người có chuyên môn pháp lý về vấn đề này.
