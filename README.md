# Sương Đỏ — Game sinh tồn vô hạn trên web *(tên tạm)*

Game sinh tồn 2D góc nhìn từ trên xuống, chơi ngay trên trình duyệt.
- Thế giới vô hạn, được sinh tự động từ một seed.
- Nhiều người chơi cùng một thế giới.
- Có nền kinh tế: người chơi mua bán với nhau và với hệ thống (NPC).

> **Trạng thái:** đã có bản chơi được (v0.1). Phần lõi trong [lộ trình](docs/04-lo-trinh.md), giai đoạn 0–3 và một phần giai đoạn 4, đã được code. Xem [Tình trạng tính năng](#tình-trạng-tính-năng).

## Chạy game

Cần **Node.js ≥ 22.13** (máy chủ dùng `node:sqlite` có sẵn trong Node, không cần cài cơ sở dữ liệu riêng).

```bash
npm install

# Chế độ phát triển: máy chủ game (cổng 8787) + Vite (cổng 5173), tự tải lại khi sửa code
npm run dev
# → mở http://localhost:5173

# Chế độ chạy thật: build giao diện rồi để máy chủ game phục vụ luôn file tĩnh
npm run build
npm start
# → mở http://localhost:8787

npm test          # 41 bài kiểm thử (dữ liệu, kinh tế, lối chơi)
npm run typecheck # kiểm tra kiểu TypeScript cho cả 3 gói
```

Có thể bấm **"Chơi ngay"** để vào bằng tài khoản khách. Khi đã chơi được một lúc, tài khoản khách có thể nâng cấp thành tài khoản thường mà vẫn giữ nguyên nhân vật.

Muốn chơi cùng bạn bè trong mạng LAN: chạy `npm run build && npm start`, rồi cho bạn bè mở `http://<IP-máy-bạn>:8787`.

### Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `8787` | Cổng HTTP + WebSocket |
| `HOST` | `0.0.0.0` | Địa chỉ lắng nghe |
| `DB_PATH` | `data/world.db` (`data/hardcore.db` khi Hardcore) | File SQLite lưu thế giới |
| `SEED` | ngẫu nhiên | Seed thế giới. Chỉ dùng khi tạo thế giới mới; thế giới đã có thì giữ seed cũ |
| `HARDCORE` | `0` | `1` = chế độ Hardcore: chết là mất nhân vật, tên được ghi vào Bảng Vinh Danh |
| `REALM_NAME` | `Sinh Tồn Vô Hạn` | Tên cõi hiển thị |
| `MAX_PLAYERS` | `200` | Số người chơi tối đa cùng lúc |
| `TRADE_MIN_PLAYTIME_MIN` | `30` | Số phút chơi tối thiểu trước khi được dùng Sàn và Hòm thư (chống tài khoản rác) |
| `SAVE_INTERVAL_SEC` | `10` | Chu kỳ lưu dữ liệu xuống đĩa |
| `ADMIN_TOKEN` | *(trống = tắt)* | Bật API quản trị qua header `x-admin-token`: `GET /api/admin/economy` (cung tiền, kiểm toán sổ cái), `POST /api/admin/flags` (tắt/bật sàn, thư, giao dịch, sạp) |
| `DEV_COMMANDS` | `0` | `1` = bật lệnh chat cho nhà phát triển: `/tp x y`, `/give id n`, `/xu n`, `/time t`, `/spawn mob`, `/weather loại`. **Không bật trên server thật.** |
| `TIME_SCALE` | `1` | Tăng tốc thời gian trong game (để thử nghiệm) |

Một ngày trong game dài 20 phút thật. Dữ liệu được lưu liên tục và lưu lần cuối khi tắt máy chủ (Ctrl+C).

### Điều khiển

| Phím | Tác dụng |
|---|---|
| `W A S D` · `Shift` · `Space` | Di chuyển · chạy · lướt né |
| Chuột trái (giữ để lặp) | Đánh / chặt / đào / đặt công trình |
| Chuột phải · `E` · `F` | Tương tác chỗ con trỏ · tương tác gần nhất (NPC, rương, lửa, người chơi khác) · dùng đồ trên tay |
| `1–8` / cuộn chuột · `Q` | Chọn ô thanh nhanh · vứt đồ (Shift+Q: cả chồng) |
| `Tab` · `K` · `J` · `M` · `L` | Túi đồ & chế tạo · kỹ năng · nhiệm vụ · bản đồ · xếp hạng |
| `B` · `P` · `Enter` · `Esc` | Tháo dỡ · bật/tắt cờ PvP · chat · đóng cửa sổ |

Lệnh chat: `/w tên nội dung` (nhắn riêng), `/stuck` (thoát kẹt), `/online`, `/pvp`.

Trên thiết bị cảm ứng, game tự hiện cần điều khiển ảo và nút bấm (bản cơ bản; PC vẫn là nền tảng chính).

## Cấu trúc mã nguồn

```
packages/shared/   Code dùng chung cho client và server
  src/data/        Dữ liệu game: ~95 vật phẩm, công thức, công trình, quái, NPC, nhiệm vụ, kỹ năng
  src/worldgen.ts  Sinh địa hình tất định từ seed (Simplex noise), biome, phế tích, trạm giao thương
  src/movement.ts  Di chuyển + va chạm (client dự đoán, server xác thực bằng cùng một hàm)
  src/economy.ts   Công thức giá động của hệ thống, chống lách giá (arbitrage)
  src/protocol.ts  Toàn bộ thông điệp client ↔ server
apps/server/       Máy chủ Node.js: HTTP API, WebSocket, vòng lặp game 20 Hz, SQLite
  src/game/        Thế giới, chunk, người chơi, sinh tồn, chiến đấu, AI quái, nhiệm vụ, chat
  src/economy/     Sổ cái kép, cửa hàng NPC, sàn khớp lệnh, hòm thư, trao đổi trực tiếp,
                   hợp đồng, lãnh thổ, sạp hàng, dịch vụ (sửa đồ, dịch chuyển, kho, nâng Cấp Sương)
  src/net/         Kiểm tra dữ liệu gửi lên (zod), giới hạn tần suất, chống gửi lặp (idempotency)
  test/            Kiểm thử kinh tế và lối chơi
apps/client/       Giao diện trình duyệt
  src/game/        Phaser 3: vẽ bản đồ theo chunk, nhân vật, ánh sáng ngày đêm, thời tiết, âm thanh
  src/game/art/    Toàn bộ hình pixel art được vẽ bằng code (không cần file ảnh ngoài)
  src/ui/          React: HUD, túi đồ, chế tạo, cửa hàng, sàn, hòm thư, giao dịch, bản đồ...
docs/              Tài liệu thiết kế
```

## Tình trạng tính năng

### Đã làm

**Thế giới và sinh tồn**
- Thế giới vô hạn sinh theo chunk từ seed. Địa hình gồm đồng cỏ, rừng, sa mạc, đầm lầy, tuyết, núi đá, bãi cát, nước nông/sâu và Vùng Sương. Có phế tích chứa thùng tiếp tế.
- 4 vùng theo độ sâu (Rìa, Xám, Đỏ, Thẳm). Đi càng xa thì quái càng mạnh và tài nguyên càng quý, không có giới hạn.
- Trạm giao thương trên lưới 1.500 ô. Mỗi trạm là vùng an toàn, có 8 NPC.
- Chỉ số: máu, đói, khát, thể lực, thân nhiệt, Nhiễm Sương.
- Trạng thái: ướt, ngộ độc, chảy máu, sưởi ấm, no bụng.
- Đồ ăn hỏng dần, nấu nướng, đun nước.
- Ngày–đêm, 4 mùa, thời tiết (mưa — thành tuyết vào mùa đông, bão, sương mù, nắng nóng).
- **Đêm Sương Đỏ** mỗi 7 ngày: 3 đợt quái kéo tới, kết thúc bằng boss Sứ Giả Sương Đỏ. Sống sót được thưởng Rương Sương Đỏ.

**Chế tạo, xây dựng, chiến đấu**
- 5 loại trạm chế tạo, từ lửa trại tới Lò Tinh thể.
- Công cụ và vũ khí có độ bền. Sửa đồ làm giảm dần độ bền tối đa.
- Nâng **Cấp Sương** cho trang bị, không giới hạn cấp.
- Xây dựng:
  - tường, cửa, sàn, rương, giường (điểm hồi sinh), bẫy, đèn;
  - luống trồng: cây lớn theo thời gian thực, kể cả khi không có ai ở gần.
- **Cột Lãnh Thổ** khóa rương và chặn người lạ xây/phá trong lãnh thổ. Cột tốn phí bảo trì mỗi ngày.
- Đánh cận chiến, cung, nỏ, súng tự chế. Có lướt né.
- 14 loại quái với AI riêng: thú hoang, Kẻ Nhiễm, Kẻ Phình tự nổ, boss Gấu Sương...
- Chết thì rơi túi đồ và hồi sinh ở giường hoặc ở trạm.
- PvP theo vùng: Vùng Xám chỉ đánh nhau khi cả hai bên bật cờ; Vùng Đỏ và Vùng Thẳm luôn bật PvP.
- 8 kỹ năng lên cấp khi sử dụng, và 18 nhiệm vụ cột mốc dẫn dắt người mới.

**Kinh tế** (chi tiết trong [docs/02](docs/02-kinh-te-giao-dich.md))
- Mọi đồng Xu đi qua **sổ cái kép**. Tổng tất cả ví luôn bằng 0, nên không thể "in tiền" qua lỗi.
- Mọi thao tác được bọc trong transaction SQLite, kèm khóa chống gửi lặp.
- Cửa hàng NPC:
  - giá thay đổi theo lượng hàng tồn của cả server;
  - có hạn mức bán mỗi ngày;
  - có chặn vòng lặp mua rẻ bán đắt.
- **Sàn giao dịch** khớp lệnh mua/bán theo thứ tự giá rồi thời gian. Phí đặt lệnh 1%, thuế 5% (giảm còn 3% khi kỹ năng Buôn bán đạt tối đa). Hàng và tiền được gửi qua hòm thư.
- **Hòm thư:** gửi đồ, gửi Xu, hoặc gửi hàng thu tiền khi nhận.
- **Trao đổi trực tiếp:**
  - mời người đứng gần;
  - hai bên khóa đề nghị, chờ đếm ngược 3 giây rồi cùng xác nhận;
  - hệ thống cảnh báo khi giá trị hai bên chênh lệch nhiều.
- **Sạp hàng** bày bán ngay cả khi chủ offline (thuế 3%).
- **Bảng hợp đồng** ở trạm.
- Dịch vụ tốn Xu (cũng là cách rút bớt tiền khỏi nền kinh tế): sửa đồ, dịch chuyển giữa các trạm, kho an toàn.

**Khác**
- Tài khoản khách và tài khoản thường (mật khẩu băm bằng scrypt).
- Chế độ Hardcore.
- Bảng xếp hạng: ngày sống sót, tài sản, độ sâu, chuỗi Đêm Sương Đỏ, Bảng Vinh Danh.
- Chat theo các kênh gần đây, toàn server, giao dịch và nhắn riêng.
- Bản đồ thế giới và bản đồ nhỏ.
- Âm thanh được tổng hợp trực tiếp bằng WebAudio.
- Có điều khiển cảm ứng cơ bản.

### Chưa làm (theo thứ tự ưu tiên đề xuất)

1. **Tổ đội và bang hội:** kho chung, lãnh thổ chung, chiến tranh bang.
2. **Bậc công nghệ T3 (Điện):** máy phát điện, đèn điện, tháp súng tự động. Cũng chưa có hệ thống nghiên cứu và bản thiết kế.
3. **Thuần hóa vật nuôi**, nhà kính, sâu bệnh cây trồng.
4. **Hang động có boss, trại cướp, tổ quái.** Hiện chỉ có phế tích với thùng tiếp tế.
5. **Sự kiện thế giới khác:** thả hàng tiếp tế, thương nhân lưu động, mưa thiên thạch, Sương Dâng.
6. **Chế độ khác:** thế giới riêng có giao diện tạo phòng (hiện chỉ làm được bằng cách tự chạy một server riêng), mùa giải, thủ thành, sáng tạo.
7. **Đồ trang trí và cửa hàng trang trí** (phần kiếm tiền).
8. Danh sách bạn bè, chặn, báo cáo; trang quản trị có giao diện.

## Khác biệt so với tài liệu kiến trúc

Bản code hiện tại cố ý **đơn giản hóa** so với [docs/03](docs/03-kien-truc-ky-thuat.md) để một máy là chạy được, không cần cài thêm dịch vụ nào:

| Tài liệu đề xuất | Bản hiện tại | Lý do |
|---|---|---|
| PostgreSQL + Redis | **SQLite** (`node:sqlite`, chế độ WAL), trạng thái nóng giữ trong RAM | Không cần cài đặt. Một tiến trình xử lý tốt vài trăm người chơi. Lớp `Db` và sổ cái được viết để dễ chuyển sang PostgreSQL |
| Colyseus | **`ws`** + giao thức tự viết (`packages/shared/src/protocol.ts`) | Cần kiểm soát chi tiết việc đồng bộ theo vùng nhìn thấy (AOI), dự đoán chuyển động, nén dữ liệu thực thể |
| API server và game server tách riêng | **Một tiến trình** chạy cả HTTP API, WebSocket và phục vụ file tĩnh | Đơn giản khi triển khai. Khi cần mở rộng có thể tách theo vùng thế giới như mô tả ở docs/03 mục 5.3 |
| pnpm + Turborepo | **npm workspaces** | Có sẵn cùng Node |
| Vitest | **`node:test`** | Có sẵn cùng Node, không thêm phụ thuộc |
| Ảnh sprite vẽ tay | **Pixel art sinh bằng code** (`apps/client/src/game/art`) | Không cần họa sĩ để chạy được. Có thể thay bằng ảnh thật mà không đổi logic |

Những nguyên tắc chính của docs/03 vẫn giữ nguyên:
- máy chủ là nơi quyết định mọi thứ;
- địa hình sinh tất định, chỉ lưu phần người chơi đã thay đổi;
- mọi giao dịch đều nguyên tử và có khóa chống gửi lặp;
- client dự đoán chuyển động rồi đối chiếu lại với máy chủ;
- máy chủ chỉ gửi những gì nằm trong vùng nhìn thấy (AOI).

## Tài liệu thiết kế

| # | Tài liệu | Nội dung |
|---|---|---|
| 1 | [Thiết kế game (GDD)](docs/01-thiet-ke-game.md) | Bối cảnh, vòng lặp chơi, các chế độ chơi, chỉ số sinh tồn, thế giới vô hạn, chế tạo, xây dựng, chiến đấu, tiến trình nhân vật, giao diện |
| 2 | [Kinh tế & Giao dịch](docs/02-kinh-te-giao-dich.md) | Tiền tệ, mua bán với hệ thống (giá thay đổi theo cung cầu), giao dịch giữa người chơi (trao đổi trực tiếp, sàn, sạp hàng, thư), chống gian lận, chống lạm phát |
| 3 | [Kiến trúc kỹ thuật](docs/03-kien-truc-ky-thuat.md) | Công nghệ, client/server, mạng, thế giới vô hạn, cơ sở dữ liệu, bảo mật |
| 4 | [Lộ trình phát triển](docs/04-lo-trinh.md) | Các giai đoạn, MVP, rủi ro, việc cần làm đầu tiên |

Các quyết định đã chốt:
- bối cảnh hậu tận thế với Sương Đỏ;
- pixel art 2D nhìn từ trên xuống;
- ưu tiên PC trên trình duyệt;
- PvE là chính, PvP chỉ ở vùng xa;
- chỉ kiếm tiền bằng đồ trang trí.
