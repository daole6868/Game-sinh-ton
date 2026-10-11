# Sương Đỏ — Game sinh tồn vô hạn trên web *(tên tạm)*

Game sinh tồn 2D góc nhìn từ trên xuống, chơi ngay trên trình duyệt. Thế giới vô hạn được sinh tự động. Nhiều người chơi cùng một thế giới, có nền kinh tế: người chơi mua bán với nhau và với hệ thống (NPC).

> **Trạng thái:** đang lên ý tưởng và kế hoạch, **chưa có code**.

## Tài liệu thiết kế

| # | Tài liệu | Nội dung |
|---|---|---|
| 1 | [Thiết kế game (GDD)](docs/01-thiet-ke-game.md) | Bối cảnh, vòng lặp chơi, các chế độ chơi, chỉ số sinh tồn, thế giới vô hạn, chế tạo, xây dựng, chiến đấu, tiến trình nhân vật, giao diện |
| 2 | [Kinh tế & Giao dịch](docs/02-kinh-te-giao-dich.md) | Tiền tệ, mua bán với hệ thống (giá thay đổi theo cung cầu), giao dịch giữa người chơi (trao đổi trực tiếp, sàn, sạp hàng, thư), chống gian lận, chống lạm phát |
| 3 | [Kiến trúc kỹ thuật](docs/03-kien-truc-ky-thuat.md) | Công nghệ, client/server, mạng, thế giới vô hạn, cơ sở dữ liệu, bảo mật |
| 4 | [Lộ trình phát triển](docs/04-lo-trinh.md) | Các giai đoạn, MVP, rủi ro, việc cần làm đầu tiên |

## Tóm tắt nhanh

- **Bối cảnh:** một màn sương đỏ bí ẩn đã làm sụp đổ nền văn minh. Đi càng xa thì sương càng dày, quái càng mạnh và tài nguyên càng quý. Thế giới không có điểm cuối.
- **Chế độ chính, Sinh tồn Vô hạn:** một thế giới chung không bao giờ bị xóa làm lại. Cứ 7 ngày trong game có một **Đêm Sương Đỏ**, khi đó quái tràn vào tấn công căn cứ.
- **Chế độ phụ:** Thế giới riêng / Co-op, Hardcore (chết là mất nhân vật), Mùa giải, Thủ thành, Sáng tạo.
- **Kinh tế:**
  - Tiền trong game là **Xu**.
  - NPC mua bán với giá thay đổi theo lượng hàng tồn của hệ thống.
  - Người chơi giao dịch với nhau qua 4 kênh: trao đổi trực tiếp, sàn giao dịch có khớp lệnh, sạp hàng bán cả khi chủ offline, và thư gửi hàng có thu tiền khi nhận.
  - Thuế và phí được dùng để rút bớt tiền khỏi nền kinh tế, chống lạm phát.
- **Công nghệ đề xuất:** TypeScript, Phaser 3 + React (client), Node.js + Colyseus (server game), PostgreSQL, Redis.

## Các quyết định cần chốt trước khi code

1. **Bối cảnh:** hậu tận thế với Sương Đỏ *(đề xuất)*, nguyên thủy/giả tưởng, hay zombie hiện đại?
2. **Đồ họa:** pixel art 2D nhìn từ trên xuống *(đề xuất, phù hợp sức làm của đội nhỏ)* hay 2.5D isometric?
3. **Nền tảng ưu tiên:** PC trên trình duyệt *(đề xuất)* hay điện thoại?
4. **Mức độ PvP:** PvE là chính, PvP chỉ ở vùng xa *(đề xuất)*; PvP toàn bản đồ; hay chỉ PvE?
5. **Quy mô đội và thời gian:** bao nhiêu người, làm toàn thời gian hay bán thời gian?
6. **Kiếm tiền:** chỉ bán trang trí *(đề xuất)* hay không kiếm tiền?
