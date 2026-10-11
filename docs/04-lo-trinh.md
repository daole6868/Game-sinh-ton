# Lộ trình phát triển

> **Giả định:** 1–2 lập trình viên làm toàn thời gian. Thời gian chỉ là ước lượng; dự án game thực tế thường kéo dài hơn dự kiến.
> **Nguyên tắc:** làm cho **vui** trước, làm cho **nhiều người chơi** sau, làm **kinh tế** khi nền móng đã vững. Mỗi giai đoạn kết thúc bằng một bản **chơi được**.

## Tổng quan

```
GĐ0 Prototype ─► GĐ1 Nhiều người ─► GĐ2 Kinh tế ─► GĐ3 Nội dung ─► GĐ4 Xã hội & PvP ─► GĐ5 Ra mắt
  3–4 tuần         5–6 tuần          4–5 tuần       6–8 tuần        4–6 tuần            4+ tuần
                                        └──────── MVP chơi thử công khai ────────┘
```

Tổng cộng khoảng **7–9 tháng** cho tới bản ra mắt đầu tiên.

---

## Giai đoạn 0: Prototype chơi đơn (3–4 tuần)

**Mục tiêu:** chứng minh vòng lặp sinh tồn **vui**, trước khi tốn công làm mạng. Mọi thứ chạy trên trình duyệt, chưa cần server.

- [ ] Dựng monorepo (pnpm, Vite, Phaser, TypeScript, ESLint/Prettier, Vitest)
- [ ] Nhân vật di chuyển, camera bám theo, va chạm với vật cản
- [ ] Thế giới vô hạn theo chunk: nhiễu tạo 3 biome (đồng cỏ, rừng, hồ); tự tải và giải phóng chunk khi di chuyển
- [ ] Thu thập: chặt cây, đập đá, nhặt cỏ sợi, quả mọng
- [ ] Túi đồ 24 ô và thanh nhanh 8 ô, xếp chồng, kéo thả
- [ ] Chế tạo: 10 công thức bậc T0, lửa trại
- [ ] Máu, đói, khát, thể lực; ăn uống
- [ ] Ngày/đêm và ánh sáng động (đuốc, lửa trại)
- [ ] 3 loại sinh vật: thỏ (bỏ chạy), sói (tấn công), Kẻ Nhiễm (ban đêm); cận chiến cơ bản
- [ ] Đặt công trình: tường gỗ, cửa, rương, lều
- [ ] Lưu và tải bằng `localStorage`

**Hoàn thành khi:** người chơi thử sống qua 3 đêm trong 30 phút liền và **muốn chơi tiếp**. Nếu chưa vui thì chỉnh tiếp ở giai đoạn này, chưa sang giai đoạn sau.

---

## Giai đoạn 1: Nhiều người chơi cốt lõi (5–6 tuần)

- [ ] Game server Colyseus. Chuyển logic sang server, dùng chung `packages/shared`
- [ ] Gửi đầu vào lên server, dự đoán phía client, nội suy, vùng quan tâm
- [ ] Đăng ký, đăng nhập, tài khoản khách; API Fastify
- [ ] PostgreSQL + Drizzle: lưu nhân vật, vật phẩm, chunk delta
- [ ] Kết nối lại sau khi rớt mạng
- [ ] Chat gần đây và toàn server
- [ ] Chết thì rơi túi hành trang, hồi sinh tại giường
- [ ] Cột Lãnh Thổ và quyền xây dựng
- [ ] Docker Compose cho môi trường dev; CI chạy lint, kiểm tra kiểu, test

**Hoàn thành khi:** 20 người chơi cùng lúc ổn định; tắt và bật lại server **không mất dữ liệu**.

---

## Giai đoạn 2: Kinh tế & Giao dịch (4–5 tuần)

- [ ] Ví Xu và **sổ cái kế toán kép**, kèm job kiểm tra tổng bằng 0
- [ ] Trạm Trung Tâm có NPC: tạp hóa, thợ rèn, y sĩ, thu mua phế liệu
- [ ] Giá thay đổi theo cung cầu, tồn kho tự hồi, trượt giá, hạn mức bán mỗi ngày
- [ ] Chặn vòng lặp kiếm lời từ chế tạo (kiểm tra trong CI và chặn khi chạy)
- [ ] **Trao đổi trực tiếp:** máy trạng thái, giữ chỗ đồ, đếm ngược, cảnh báo lệch giá, hoán đổi nguyên tử
- [ ] **Hòm thư:** gửi đồ và Xu, gửi hàng thu tiền khi nhận
- [ ] **Sàn giao dịch:** sổ lệnh cho hàng xếp chồng, niêm yết cho đồ độc nhất, ký quỹ, phí, thuế, hết hạn lệnh, biểu đồ giá
- [ ] Bảng đơn hàng của hệ thống
- [ ] Khóa chống lặp, giới hạn tần suất, khóa giao dịch với tài khoản mới
- [ ] **Bộ test chống nhân bản đồ** (xem tài liệu Kiến trúc, mục 9)
- [ ] Bảng điều khiển kinh tế nội bộ (tổng Xu, tỷ lệ sinh ra/rút ra, chỉ số giá)
- [ ] Công cụ mô phỏng kinh tế, chạy trước khi chốt tham số

**Hoàn thành khi:** 1.000 lệnh đồng thời chạy xong mà **tổng Xu và tổng vật phẩm được bảo toàn tuyệt đối**; sổ cái không lệch.

---

## Giai đoạn 3: Chiều sâu nội dung (6–8 tuần)

- [ ] Đủ 8 biome, phế tích đô thị, hang động, các địa điểm đặc biệt
- [ ] Vùng theo độ sâu (Rìa, Xám, Đỏ, Thẳm); cấp quái tăng theo Ring
- [ ] Bậc công nghệ T1–T3, nghiên cứu, bản thiết kế
- [ ] Thân nhiệt, thời tiết, 4 mùa; **Nhiễm Sương**, mặt nạ và lõi lọc
- [ ] Nông nghiệp, chăn nuôi, thức ăn hỏng dần, nấu nướng
- [ ] **Đêm Sương Đỏ** và boss đầu tiên (Gấu Sương)
- [ ] Kỹ năng và đặc tính
- [ ] Nhiệm vụ cột mốc, hướng dẫn tân thủ (30 phút đầu tiên)
- [ ] Nhiều trạm giao thương, dịch chuyển nhanh, kho an toàn
- [ ] **Sạp hàng** của người chơi

**MVP chơi thử công khai** = Giai đoạn 0–2 cộng phần cốt lõi của Giai đoạn 3: các biome cơ bản, bậc T1, Đêm Sương Đỏ, hướng dẫn tân thủ.

---

## Giai đoạn 4: Xã hội, PvP & các chế độ (4–6 tuần)

- [ ] Tổ đội; bang hội gồm chức vụ, kho chung, ngân quỹ, lãnh thổ chung, đơn hàng bang
- [ ] Luật PvP theo vùng, cờ PvP, bảo vệ khi offline, tấn công căn cứ ở Vùng Đỏ
- [ ] Chế độ **Hardcore** (cõi riêng, Bảng Vinh Danh)
- [ ] **Thế giới riêng / Co-op**
- [ ] Bảng xếp hạng, thành tựu, danh hiệu
- [ ] Sự kiện thế giới: thả hàng tiếp tế, thương nhân lưu động, boss thế giới, Sương Dâng
- [ ] Bậc T4 (Công nghệ Sương) và **Cấp Sương** không giới hạn
- [ ] Hợp đồng giữa người chơi và điểm uy tín
- [ ] Chênh lệch giá theo vùng, phí dịch chuyển theo khối lượng hàng

---

## Giai đoạn 5: Hoàn thiện & ra mắt (4+ tuần)

- [ ] Điều khiển cảm ứng cho điện thoại, tối ưu hiệu năng
- [ ] Thay tài nguyên miễn phí bằng art và âm thanh riêng
- [ ] Thử nghiệm kín (closed beta), cân bằng lại số liệu dựa trên dữ liệu thật
- [ ] Hoàn thiện chống gian lận, công cụ quản trị, sao lưu và thử khôi phục
- [ ] Test tải (mô phỏng 200 người trên một cõi)
- [ ] Triển khai production, giám sát, cảnh báo
- [ ] *(Tùy chọn)* Cửa hàng đồ trang trí, Mùa giải
- [ ] Tìm hiểu và hoàn tất thủ tục pháp lý nếu phát hành và thu tiền tại Việt Nam

---

## Rủi ro chính

| Rủi ro | Mức độ | Cách giảm thiểu |
|---|---|---|
| **Phạm vi quá lớn** so với sức đội | Cao | Làm theo giai đoạn, mỗi giai đoạn đều chơi được; sẵn sàng cắt tính năng; prototype trước |
| **Lỗi nhân bản đồ** phá hỏng kinh tế | Cao | Server quyết định mọi thứ, transaction, sổ cái, test đồng thời, nút khẩn cấp tạm dừng sàn |
| **Lạm phát** ở thế giới không reset | Trung bình | Bảng điều khiển theo dõi Xu sinh ra/rút ra, hạn mức, công cụ mô phỏng, tham số chỉnh được ngay |
| **Hiệu năng** khi thế giới vô hạn | Trung bình | Vùng quan tâm, chỉ lưu delta, giải phóng chunk, giới hạn AI mỗi tick, đo thời gian tick |
| **Ít người chơi** lúc đầu | Trung bình | NPC luôn mua bán nên kinh tế không chết khi vắng người; game vẫn vui khi chơi một mình; có Thế giới riêng |
| **Bot và gian lận** | Trung bình | Kiểm tra trên server, hạn mức, khóa giao dịch với tài khoản mới, theo dõi bất thường |
| **Pháp lý** (game online, vật phẩm ảo) | Trung bình | Không cho đổi tiền nạp ra Xu; không bán loot box; hỏi ý kiến chuyên môn trước khi thu tiền |

---

## Việc làm ngay tiếp theo

1. **Chốt 6 quyết định** trong [README](../README.md#các-quyết-định-cần-chốt-trước-khi-code): bối cảnh, đồ họa, nền tảng, PvP, quy mô đội, kiếm tiền.
2. **Tuần 1 của Giai đoạn 0:**
   - Dựng monorepo (`apps/client`, `packages/shared`, `packages/game-data`).
   - Có màn hình Phaser với nhân vật đi lại được trên thế giới chunk vô hạn.
3. **Tuần 2:** thu thập, túi đồ, chế tạo cơ bản.
4. **Tuần 3:** đói, khát, ngày/đêm, ánh sáng, quái đầu tiên.
5. **Tuần 4:** xây dựng, lưu và tải; cho vài người chơi thử rồi ghi nhận phản hồi.
