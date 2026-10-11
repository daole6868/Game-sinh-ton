# Kinh tế & Giao dịch

> Thế giới chính tồn tại vĩnh viễn, nên kinh tế phải **ổn định trong nhiều năm**. Mọi quyết định trong tài liệu này đều xoay quanh bốn mục tiêu dưới đây.

## Mục lục

1. [Mục tiêu thiết kế](#1-mục-tiêu-thiết-kế)
2. [Tiền tệ](#2-tiền-tệ)
3. [Giao dịch với hệ thống (NPC)](#3-giao-dịch-với-hệ-thống-npc)
4. [Giao dịch giữa người chơi](#4-giao-dịch-giữa-người-chơi)
5. [Nguồn vào & nguồn ra: chống lạm phát](#5-nguồn-vào--nguồn-ra-chống-lạm-phát)
6. [An toàn & chống gian lận](#6-an-toàn--chống-gian-lận)
7. [Kịch bản minh họa](#7-kịch-bản-minh-họa)

---

## 1. Mục tiêu thiết kế

1. **Giao dịch phải có ý nghĩa.** Có ba điều khiến người chơi cần nhau:
   - Họ chuyên môn hóa kỹ năng.
   - Tài nguyên quý nằm ở vùng nguy hiểm.
   - Hàng hóa khan hiếm theo mùa.
2. **Không lạm phát.** Lượng Xu sinh ra và lượng Xu bị rút khỏi nền kinh tế phải cân bằng.
3. **An toàn tuyệt đối.** Không thể nhân bản đồ (dupe), không thể giao dịch "một chiều" do lỗi, và khó lừa đảo.
4. **Dễ hiểu.** Người mới biết ngay mình nên bán gì, bán ở đâu, giá bao nhiêu.

---

## 2. Tiền tệ

| Loại | Cách kiếm | Dùng để | Giao dịch được? |
|---|---|---|---|
| **Xu** | Bán hàng cho hệ thống hoặc người chơi, làm hợp đồng, nhiệm vụ, nhặt từ quái hoặc phế tích (ít) | Mua của hệ thống hoặc người chơi, trả phí, thuế, sửa đồ, bảo trì lãnh thổ, dịch chuyển | **Có** |
| **Danh vọng** (riêng cho từng trạm/phe) | Làm hợp đồng và nhiệm vụ cho trạm | Mở khóa hàng đặc biệt của NPC, giảm giá, tăng hạn mức bán | Không |
| **Ngọc** *(nếu có kiếm tiền)* | Nạp tiền thật | Chỉ mua đồ trang trí | Không |

**Quy ước về Xu:**
- Xu là **số dư trong ví**, không phải vật phẩm trong túi đồ. Vì vậy Xu không rơi khi chết, không bị cướp, và không thể bị nhân bản qua lỗi túi đồ.
- Xu luôn là số nguyên, lưu kiểu `BIGINT`, không bao giờ âm.
- Mỗi Cõi (thế giới chính, Hardcore, từng Mùa giải) có ví riêng.

---

## 3. Giao dịch với hệ thống (NPC)

Hệ thống có hai vai trò:
1. **Giữ cho thị trường luôn có người mua người bán**, kể cả khi server vắng người.
2. **Tạo giá sàn và giá trần tham khảo** cho chợ của người chơi.

### 3.1 Nơi giao dịch

Mỗi **trạm giao thương** (vùng an toàn) có các NPC sau:

| NPC | Bán | Thu mua | Dịch vụ |
|---|---|---|---|
| **Chủ tạp hóa** | Lương thực cơ bản, hạt giống, muối, đuốc | Tài nguyên thô, thức ăn | — |
| **Thợ rèn** | Công cụ và vũ khí cơ bản (bậc ≤ T1) | Quặng, kim loại, phế liệu kim loại | Sửa đồ (mất phí) |
| **Y sĩ** | Băng gạc, thuốc, huyết thanh, lõi lọc mặt nạ | Thảo dược, da sạch | Chữa trạng thái xấu |
| **Thu mua phế liệu** | — | Phế liệu, linh kiện điện tử, đồ hỏng | Phân tách đồ |
| **Bảng đơn hàng** | — | Theo đơn (xem mục 3.3) | — |
| **Thủ kho** | — | — | Kho an toàn, hòm thư nhận hàng |
| **Người dẫn đường** | — | — | Dịch chuyển nhanh tới trạm khác đã khám phá |

**Thương nhân lưu động:**
- Xuất hiện ngẫu nhiên ngoài hoang dã 1–2 lần mỗi ngày game.
- Bán đồ hiếm: bản thiết kế, hạt giống lạ, mặt nạ tốt.
- Nhận trao đổi **hàng đổi hàng**.
- Có thể bị quái tấn công. Người chơi hộ tống đoàn tới trạm sẽ được thưởng.

**Trạm ở vùng sâu** bán đồ bậc cao hơn và thu mua đặc sản của vùng đó.

### 3.2 Giá thay đổi theo cung cầu

Mỗi mặt hàng có 4 tham số:

| Tham số | Ý nghĩa |
|---|---|
| `P0` | Giá gốc |
| `S` | Tồn kho hiện tại của hệ thống |
| `S*` | Tồn kho mục tiêu |
| `k` | Độ nhạy của giá, từ 0,3 đến 1,0 |

**Công thức giá:**

```
Hệ số   = clamp( (S* / max(S, 1)) ^ k , 0.5 , 3.0 )
Giá BÁN của hệ thống (người chơi mua)     = ceil ( P0 × Hệ số )
Giá MUA của hệ thống (người chơi bán)     = floor( P0 × Hệ số × 0.55 )
```

**Tồn kho thay đổi khi:**
- Người chơi bán cho hệ thống: `S` tăng, giá giảm.
- Người chơi mua của hệ thống: `S` giảm, giá tăng.
- Mỗi giờ thực, tồn kho tự trở về gần mục tiêu: `S ← S + (S* − S) × 0.05`.

**Chênh lệch 45% giữa giá mua và giá bán:**
- Hệ thống không thể bị dùng để "mua rẻ bán đắt" kiếm lời vô hạn.
- Giá trên chợ người chơi thường nằm giữa giá mua và giá bán của hệ thống, nên **mua bán với nhau luôn có lợi hơn cho cả hai bên**.

**Trượt giá khi bán số lượng lớn:**
- Giá được tính theo từng phần nhỏ, không áp một giá cho cả lô.
- Ví dụ: bán 5.000 gỗ trong một lần sẽ nhận ít hơn 5.000 × giá hiện tại, vì giá tụt dần trong lúc bán.
- Vì vậy không có lợi khi gom hàng thật lớn để xả một lần.

**Ví dụ: Gỗ** (`P0 = 10 Xu`, `S* = 10.000`, `k = 0.7`)

| Tình huống | Tồn kho S | Hệ số | Hệ thống bán | Hệ thống mua |
|---|---|---|---|---|
| Bình thường | 10.000 | 1,00 | 10 Xu | 5 Xu |
| Thừa gỗ (ai cũng bán) | 20.000 | 0,62 | 7 Xu | 3 Xu |
| Khan hiếm (mùa đông) | 2.000 | 3,00 (chạm trần) | 30 Xu | 16 Xu |

**Chặn vòng lặp kiếm lời từ chế tạo:**
- Hệ thống không bao giờ thu mua một thành phẩm với giá cao hơn `0.9 × tổng giá bán hiện tại của nguyên liệu làm ra nó`.
- Vì vậy không thể "mua nguyên liệu của NPC, chế tạo, rồi bán lại cho NPC" để in tiền.
- Chế tạo vẫn có lãi khi **bán cho người chơi khác**, hoặc khi nguyên liệu do mình tự khai thác.

Biểu đồ giá hệ thống trong 7 ngày được hiển thị công khai. Nhờ đó người chơi đọc được thị trường và nhận ra cơ hội.

### 3.3 Bảng đơn hàng (hợp đồng hệ thống)

- Mỗi trạm có 6–10 đơn hàng, làm mới mỗi ngày game.
  - Ví dụ: *"Giao 200 Thịt hun khói → 1.500 Xu + 20 Danh vọng"*.
- Đơn hàng **ưu tiên những mặt hàng hệ thống đang thiếu**, nên nền kinh tế tự cân bằng.
- **Đơn hàng lớn cho bang hội:** số lượng lớn, thời hạn 3 ngày, thưởng cao.
- Bảng đơn hàng vừa rút vật phẩm khỏi nền kinh tế, vừa là nguồn Xu **có kiểm soát** (số đơn mỗi ngày có hạn).

### 3.4 Hạn mức chống cày tiền

- **Hạn mức doanh thu khi bán cho hệ thống:** mỗi nhân vật mỗi ngày thực được bán tối đa **N Xu** cho hệ thống.
  - Mặc định N = 3.000.
  - Kỹ năng Thương lượng và Danh vọng làm tăng N.
- Vượt hạn mức vẫn bán được, nhưng giá chỉ còn 20%.
- Mục đích: bot cày tài nguyên không thể in tiền vô hạn, còn người chơi bình thường gần như không chạm tới hạn mức.
- Người chơi muốn bán nhiều hơn phải bán cho **người chơi khác**. Điều này đẩy người chơi ra chợ.

### 3.5 Chênh lệch giá theo vùng *(giai đoạn sau)*

- **Hàng của vùng sâu bán được giá cao hơn ở Vùng Rìa** (vì hiếm ở đó).
- **Đồ cơ bản như thức ăn và gỗ bán được giá cao hơn ở trạm vùng sâu** (vì khó mang vào).
- `Giá thu mua tại trạm = Giá mua × (1 + 0.08 × |Ring của trạm − Ring gốc của hàng|)`, tối đa ×1,5.
- **Dịch chuyển nhanh** có phí tăng theo khối lượng hàng mang theo. Vì vậy chở hàng bằng đường bộ (xe, ngựa, có hộ tống) là một nghề buôn chuyến thực sự.

### 3.6 Dịch vụ hệ thống (nơi Xu bị rút ra)

- Sửa đồ ở thợ rèn
- Dịch chuyển nhanh
- Thuê kho an toàn
- Thuê ô sạp ở chợ trạm
- Phí bảo trì lãnh thổ
- Cước gửi thư
- Đặt lại điểm đặc tính
- Đổi tên nhân vật hoặc bang hội
- Nâng cấp bang hội
- Đồ trang trí mua bằng Xu (số lượng có hạn)

---

## 4. Giao dịch giữa người chơi

### Tổng quan các kênh

| Kênh | Dùng khi | Phí | Điều kiện | Giai đoạn |
|---|---|---|---|---|
| **Trao đổi trực tiếp** | Hai người đứng cạnh nhau, muốn đổi ngay | Miễn phí | Cả hai online, cách nhau ≤ 5 ô | MVP |
| **Sàn giao dịch** | Mua bán khi không cần gặp mặt, hàng số lượng lớn | Phí đăng 1% + thuế 5% | Thao tác tại trạm giao thương | MVP |
| **Hòm thư** | Gửi đồ hoặc Xu cho bạn, gửi hàng thu tiền khi nhận | Cước theo số ô hàng | Tại trạm | MVP |
| **Sạp hàng** | Mở cửa hàng, bán cả khi mình offline | Thuế 3% (+ phí thuê nếu đặt ở chợ trạm) | Có công trình Sạp | Giai đoạn 3 |
| **Hợp đồng người chơi** | Đặt hàng, thuê dịch vụ, có ký quỹ | 2% | Tại trạm | Giai đoạn 4 |

### 4.1 Trao đổi trực tiếp

```
 A gửi lời mời ─► B chấp nhận ─► MỞ cửa sổ giao dịch (2 cột: A đưa | B đưa)
                                     │
            hai bên thêm/bớt đồ và Xu (MỌI thay đổi ⇒ cả hai bị BỎ KHÓA)
                                     │
                     A bấm KHÓA, B bấm KHÓA (không sửa được nữa)
                                     │
                  nút XÁC NHẬN hiện ra sau 3 giây đếm ngược
                                     │
                       A XÁC NHẬN + B XÁC NHẬN
                                     │
           Server kiểm tra lại toàn bộ, rồi hoán đổi NGUYÊN TỬ (1 giao dịch CSDL)
                                     │
                         HOÀN TẤT  (hoặc thất bại ⇒ không ai mất gì)
```

**Trạng thái** (do server quản lý):

`MỜI → MỞ → (A_KHÓA | B_KHÓA) → CẢ_HAI_KHÓA → (A_XÁC_NHẬN | B_XÁC_NHẬN) → THỰC_HIỆN → XONG`

Phiên giao dịch bị **HỦY** khi:
- Một trong hai bấm hủy.
- Hai người đi xa nhau quá 8 ô.
- Một người bị tấn công.
- Một người mất kết nối quá 10 giây.
- Phiên kéo dài quá 3 phút.

**Quy tắc an toàn:**
- Đồ đã đặt vào cửa sổ giao dịch bị **giữ chỗ**: không dùng, không vứt, không đặt vào rương được.
- Mỗi món hiển thị đủ thông tin: tên, số lượng, độ bền, chỉ số, Cấp Sương và **giá tham khảo trên sàn**.
- **Cảnh báo lệch giá:** nếu giá trị hai bên chênh nhau quá 70%, hiện cảnh báo đỏ.
  - Ví dụ: *"Bạn đưa đồ trị giá ~5.000 Xu và nhận về ~200 Xu. Bạn chắc chắn chứ?"*
- **Không giao dịch khi đang chiến đấu** (vừa gây hoặc nhận sát thương trong 10 giây).
- Server kiểm tra **cả hai túi đồ còn đủ chỗ** trước khi hoán đổi.
- Nhật ký giao dịch được lưu vĩnh viễn để giải quyết khiếu nại.

### 4.2 Sàn giao dịch

Sàn có hai kiểu, tùy loại hàng.

**A. Hàng xếp chồng (gỗ, quặng, thịt, đạn, tinh thể, ...) dùng sổ lệnh.**

```
      LỆNH BÁN (giá ↑)                    LỆNH MUA (giá ↓)
   12 Xu × 300  (Hùng)                9 Xu × 500  (Lan)
   11 Xu × 120  (Minh)                8 Xu × 1.000 (Bang Rồng Đỏ)
   10 Xu × 50   (An)    ◄── chênh ──► 7 Xu × 200  (Tú)
```

- Người chơi đặt **lệnh bán** (giá, số lượng) hoặc **lệnh mua** (giá, số lượng).
- **Khớp tự động:**
  - Khi có lệnh mua với giá cao hơn hoặc bằng lệnh bán rẻ nhất thì hai lệnh khớp.
  - Giá khớp là giá của **lệnh đặt trước**.
  - Lệnh nào giá tốt hơn được khớp trước; cùng giá thì lệnh đặt sớm hơn được khớp trước.
  - Có thể khớp một phần.
- Có nút **"Mua ngay / Bán ngay"**: khớp với các lệnh tốt nhất đang có, hiển thị trước tổng giá và mức trượt giá.

**B. Đồ độc nhất (vũ khí và giáp có chỉ số riêng, bản thiết kế, ...) dùng niêm yết từng món.**

- Niêm yết với **giá cố định** để người khác "Mua ngay".
- Có bộ lọc theo loại, bậc, Cấp Sương, độ bền và thuộc tính phụ.
- *Giai đoạn sau:* đấu giá có thời hạn cho đồ Huyền thoại.

**Quy tắc chung của sàn:**

| Quy tắc | Chi tiết |
|---|---|
| **Ký quỹ** | Đặt lệnh bán thì đồ bị chuyển ngay từ túi đồ vào kho ký gửi. Đặt lệnh mua thì Xu bị tạm giữ. Không ai bán được thứ mình không có |
| **Thời hạn** | Lệnh tồn tại 72 giờ thực. Hết hạn thì đồ hoặc Xu được trả về **Hòm thư** |
| **Nhận hàng** | Hàng mua được gửi vào Hòm thư, nhận ở **bất kỳ trạm nào** |
| **Phí đăng lệnh** | 1% giá trị (tối thiểu 1 Xu), **không hoàn lại**, để chống spam lệnh rồi hủy |
| **Thuế giao dịch** | 5%, trừ vào tiền người bán nhận. Kỹ năng Thương lượng giảm xuống tối thiểu 3% |
| **Số lệnh tối đa** | 10 lệnh cùng lúc, tăng theo Danh vọng |
| **Giá tham khảo** | Giá khớp gần nhất, trung bình 24 giờ, biểu đồ 7 và 30 ngày, giá mua/bán của hệ thống làm mốc |
| **Chống nhập nhầm** | Đặt bán thấp hơn 30% hoặc đặt mua cao hơn 300% so với trung bình 7 ngày thì phải xác nhận lại. Việc này chống gõ thừa hoặc thiếu số 0, và chống chuyển tiền trá hình |
| **Hủy lệnh** | Được hủy bất cứ lúc nào. Phần chưa khớp được trả về Hòm thư, phí đăng không hoàn lại |

### 4.3 Hòm thư

- Gửi **đồ và/hoặc Xu** cho người chơi khác tại bất kỳ trạm nào. Cước tính theo số ô hàng.
- **Gửi hàng thu tiền khi nhận:** người gửi đặt giá X Xu, người nhận phải trả X Xu mới lấy được hàng.
  - Nếu người nhận từ chối hoặc để quá 72 giờ, hàng quay về người gửi.
  - Đây là cách giao dịch **an toàn từ xa** giữa hai người đã thỏa thuận qua chat.
- Thư chưa nhận được giữ 30 ngày.

### 4.4 Sạp hàng *(giai đoạn 3)*

- Là công trình đặt trong lãnh thổ của mình, hoặc thuê ô ở **Khu Chợ** của trạm (phí thuê theo ngày; các ô gần cổng trạm đắt hơn).
- Chủ sạp bày hàng và đặt giá. Người khác tới tận nơi mua, **kể cả khi chủ offline**.
- Tiền chuyển thẳng vào ví chủ sau khi trừ 3% thuế. Sạp lưu lịch sử bán hàng.
- Sạp **không thể bị phá hay cướp**, kể cả ở Vùng Đỏ.
- Kênh này tạo ra lối chơi "chủ tiệm", khuyến khích người chơi ghé thăm căn cứ của nhau, và cho phép bán rẻ hơn sàn (thuế thấp hơn) với đổi lại là khách phải tự tới.

### 4.5 Hợp đồng người chơi *(giai đoạn 4)*

- **Đặt hàng:** *"Cần 1.000 quặng sắt, trả 8.000 Xu."* Xu được ký quỹ. Ai giao đủ hàng tại trạm thì nhận tiền tự động (cho phép giao từng phần).
- **Thuê dịch vụ:**
  - Hộ tống đoàn hàng.
  - Giữ căn cứ trong Đêm Sương Đỏ.
  - Chế tạo theo yêu cầu: người đặt gửi nguyên liệu và tiền công, thợ chế xong thì đồ tự gửi về.
- **Uy tín:** sau mỗi hợp đồng hai bên chấm điểm cho nhau. Điểm uy tín hiển thị trên hồ sơ.

### 4.6 Vật phẩm khóa (không giao dịch được)

- Đồ khởi đầu cho người mới.
- Phần thưởng nhiệm vụ cốt truyện.
- Đồ trang trí mua bằng tiền thật.
- Một số phần thưởng thành tựu.
- Biểu tượng **ổ khóa** hiển thị rõ trên ô đồ. Bán cho hệ thống thì chỉ được giá cố định rất thấp.

---

## 5. Nguồn vào & nguồn ra: chống lạm phát

### 5.1 Xu

| Nguồn vào (tạo ra Xu) | Nguồn ra (rút Xu khỏi nền kinh tế) |
|---|---|
| Bán cho hệ thống (có hạn mức/ngày) | Mua của hệ thống |
| Bảng đơn hàng (số lượng có hạn) | Thuế 3–5% và phí đăng lệnh trên sàn |
| Nhiệm vụ hằng ngày và cột mốc | Phí bảo trì lãnh thổ |
| Xu rơi từ quái, phế tích (ít) | Sửa đồ ở NPC, dịch chuyển nhanh |
| Phần thưởng sự kiện, Đêm Sương Đỏ | Thuê kho, thuê sạp, cước thư |
| | Nâng cấp bang hội, đổi tên, đặt lại đặc tính |
| | Đồ trang trí bán bằng Xu, công trình cộng đồng (cả server cùng góp Xu) |

> Giao dịch **giữa người chơi** chỉ chuyển Xu từ người này sang người kia, không tạo thêm Xu (trừ phần thuế bị rút ra).

### 5.2 Vật phẩm

| Nguồn vào | Nguồn ra |
|---|---|
| Thu thập, săn bắn, nhặt loot | **Độ bền**: đồ hỏng thì biến mất |
| Chế tạo, trồng trọt, chăn nuôi | **Tiêu thụ**: thức ăn, thuốc, đạn, nhiên liệu, lõi lọc |
| Phần thưởng nhiệm vụ, sự kiện | Thức ăn hỏng |
| | Bán cho hệ thống hoặc giao đơn hàng (đồ rời khỏi tay người chơi) |
| | Cường hóa Cấp Sương (tiêu tốn tinh thể) |
| | Túi hành trang không ai nhặt, căn cứ bỏ hoang xuống cấp |

### 5.3 Theo dõi sức khỏe kinh tế (bảng điều khiển nội bộ)

- **Tổng lượng Xu** đang lưu hành và lượng Xu trung bình của mỗi người chơi hoạt động.
- **Tỷ lệ Xu sinh ra / Xu bị rút ra** mỗi ngày. Mục tiêu từ 0,9 đến 1,1.
- **Chỉ số giá:** giá trung bình của một rổ 20 mặt hàng thiết yếu (giống chỉ số giá tiêu dùng).
- Số giao dịch mỗi ngày và tốc độ quay vòng của Xu.
- Phân bố tài sản (hệ số Gini) và top 50 người giàu nhất, để phát hiện bất thường.
- **Kiểm tra sổ cái:** tổng mọi bút toán phải bằng 0. Lệch dù 1 Xu cũng phải báo động ngay.

### 5.4 Công cụ điều chỉnh khi lệch

| Tình trạng | Biện pháp |
|---|---|
| Lạm phát (quá nhiều Xu) | Tăng nhẹ thuế, giảm hạn mức bán cho hệ thống, mở sự kiện tiêu Xu (đồ trang trí giới hạn, công trình cộng đồng), tăng phí bảo trì ở mức cao |
| Giảm phát (thiếu Xu) | Thêm đơn hàng, thưởng sự kiện, giảm phí |
| Một mặt hàng bị cày quá mức | Giảm `S*` hoặc `P0` của mặt hàng đó, tăng tốc độ hồi tài nguyên tương ứng |

Mọi tham số kinh tế nằm trong **cấu hình**, chỉnh được ngay mà không cần cập nhật game.

---

## 6. An toàn & chống gian lận

| Mối đe dọa | Biện pháp |
|---|---|
| **Nhân bản đồ (dupe)** | Server có toàn quyền: client chỉ gửi *ý định* ("đặt bán 50 gỗ giá 8"), server tự kiểm tra và thực hiện. Mọi thay đổi Xu và đồ nằm trong **một giao dịch CSDL**, khóa bản ghi theo thứ tự cố định. CSDL có ràng buộc `CHECK (số dư ≥ 0)` và `CHECK (số lượng > 0)` |
| **Gửi yêu cầu lặp** (bấm 2 lần, mạng chập chờn) | Mỗi yêu cầu giao dịch mang một **khóa chống lặp** (idempotency key). Yêu cầu trùng thì trả lại kết quả cũ, không thực hiện lần nữa |
| **Sai lệch tiền** | **Sổ cái kế toán kép:** mọi biến động Xu ghi thành bút toán từ ví A sang ví B, kèm lý do và mã tham chiếu. Hệ thống có các ví đặc biệt như `HỆ_THỐNG_NPC`, `THUẾ`, `PHẦN_THƯỞNG`. Tổng luôn bằng 0 |
| **Đồ quý bị nhân bản** | Mỗi món đồ độc nhất có **UUID** và lịch sử chủ sở hữu. Định kỳ quét tìm UUID trùng |
| **Bot, tài khoản phụ đẩy đồ** | Tài khoản mới chưa được dùng sàn và hòm thư cho tới khi chơi đủ 5 giờ và đạt cấp tài khoản 5. Theo dõi các luồng chuyển giá trị lớn một chiều lặp lại, nhiều tài khoản cùng thiết bị/IP chuyển cho một người |
| **Lừa đảo khi trao đổi trực tiếp** | Đồ được giữ chỗ; mọi thay đổi bỏ khóa; đếm ngược 3 giây; cảnh báo lệch giá; hiển thị đủ chỉ số |
| **Spam lệnh, thao túng giá** | Phí đăng lệnh không hoàn lại, giới hạn số lệnh, giới hạn tốc độ gọi API |
| **Lỗi nghiêm trọng khi đang vận hành** | Có **"nút khẩn cấp"** tạm dừng sàn, hòm thư hoặc giao dịch trực tiếp riêng từng cái mà không phải tắt server. Có công cụ quản trị để tra nhật ký, hoàn tác giao dịch và đền bù |
| **Mua bán tiền thật** | Ngọc không giao dịch được và không đổi được ra Xu. Điều khoản sử dụng cấm mua bán tài khoản và vật phẩm bằng tiền thật |

---

## 7. Kịch bản minh họa

> Ví dụ cho thấy người chơi chuyên môn hóa thì cần giao dịch với nhau thế nào.

1. **Lan** (thích trồng trọt) lên Nông nghiệp và Nấu ăn. Cả mùa thu, Lan trồng bí và hun khói thịt. Đến mùa đông, tồn kho thức ăn của hệ thống giảm nên giá tăng. Lan đặt lệnh bán thịt hun khói trên sàn, rẻ hơn giá NPC một chút nên bán rất chạy.
2. **Minh** (thích phiêu lưu) mua 50 phần thịt hun khói và 10 lõi lọc rồi vào Vùng Đỏ. Minh hạ một Gấu Sương, nhặt được da Gấu Sương và 40 Tinh thể Sương. Minh dịch chuyển về trạm (trả phí theo khối lượng hàng) và đặt bán tinh thể trên sàn.
3. **Hùng** (thợ rèn) đặt sẵn lệnh mua tinh thể ở 95 Xu/viên nên khớp ngay với Minh. Hùng chế **Giáp Lông Sương +3** rồi bày bán ở **sạp hàng** trước căn cứ.
4. **Bang Rồng Đỏ** nhận đơn hàng lớn của trạm: *"5.000 gạch đá trong 3 ngày"*. Bang đặt lệnh mua 5.000 đá trên sàn. Người chơi mới ở Vùng Rìa đập đá bán cho bang, kiếm được những đồng Xu đầu tiên.
5. Sắp tới Đêm Sương Đỏ, **Tú** (thiện xạ) nhận **hợp đồng thuê giữ căn cứ** của Lan với giá 2.000 Xu.

Kết quả: mỗi người làm đúng việc mình thích, ai cũng cần người khác, và Xu cùng vật phẩm lưu thông liên tục. Thuế, độ bền, đồ ăn hỏng và đạn tiêu hao rút bớt Xu và đồ ra để nền kinh tế không bị lạm phát.
