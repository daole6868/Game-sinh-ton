# Kiến trúc kỹ thuật

## Mục lục

1. [Lựa chọn công nghệ](#1-lựa-chọn-công-nghệ)
2. [Sơ đồ tổng thể](#2-sơ-đồ-tổng-thể)
3. [Cấu trúc thư mục](#3-cấu-trúc-thư-mục-monorepo)
4. [Mô hình mạng](#4-mô-hình-mạng)
5. [Thế giới vô hạn](#5-thế-giới-vô-hạn)
6. [Vòng lặp server](#6-vòng-lặp-server)
7. [Dữ liệu game](#7-dữ-liệu-game-tách-khỏi-code)
8. [Cơ sở dữ liệu](#8-cơ-sở-dữ-liệu-postgresql)
9. [Giao dịch an toàn: ví dụ khớp lệnh](#9-giao-dịch-an-toàn-ví-dụ-khớp-lệnh)
10. [Bảo mật](#10-bảo-mật)
11. [Mục tiêu hiệu năng](#11-mục-tiêu-hiệu-năng)
12. [Vận hành](#12-vận-hành)

---

## 1. Lựa chọn công nghệ

| Thành phần | Đề xuất | Lý do | Phương án thay thế |
|---|---|---|---|
| Ngôn ngữ | **TypeScript** cho cả client và server | Dùng chung kiểu dữ liệu, công thức và dữ liệu vật phẩm giữa hai phía | — |
| Engine 2D | **Phaser 3** | Ổn định, có sẵn tilemap, camera, vật lý nhẹ và WebGL, cộng đồng lớn | PixiJS (linh hoạt hơn nhưng phải tự làm nhiều thứ) |
| Giao diện menu | **React** + **Zustand**, vẽ bằng HTML đè lên canvas | Túi đồ, sàn giao dịch, bảng lọc và biểu đồ làm bằng HTML dễ hơn nhiều so với vẽ trên canvas | Svelte |
| Công cụ build | **Vite** | Nhanh, tải lại nóng (hot reload) | — |
| Server game | **Node.js + Colyseus** | Có sẵn phòng chơi, đồng bộ trạng thái kiểu chỉ gửi phần thay đổi, kết nối lại, nhóm người chơi | Tự viết bằng `uWebSockets.js` (nhanh hơn nhưng tốn công hơn nhiều) |
| API HTTP | **Fastify** | Đăng nhập, sàn giao dịch, hòm thư, bảng xếp hạng, hồ sơ | Express |
| CSDL chính | **PostgreSQL** | Giao dịch ACID (rất cần cho kinh tế), JSONB cho dữ liệu linh hoạt | — |
| Truy vấn CSDL | **Drizzle ORM** | Nhẹ, SQL rõ ràng, hỗ trợ transaction tốt | Prisma |
| Cache và nhắn tin giữa các server | **Redis** | Phiên đăng nhập, trạng thái online, chat liên server, thông báo khớp lệnh | — |
| Kiểm tra dữ liệu vào | **zod** | Kiểm tra mọi gói tin và yêu cầu từ client | — |
| Quản lý repo | **pnpm workspaces** (monorepo) | Chia sẻ package `shared` giữa client và server | Thêm Turborepo khi repo lớn |
| Kiểm thử | **Vitest** (unit), **Playwright** (end-to-end) | Nhanh, cùng hệ sinh thái Vite | — |
| Triển khai | **Docker Compose** trên VPS | Đơn giản, rẻ khi mới bắt đầu | Kubernetes hoặc Fly.io khi cần mở rộng |

---

## 2. Sơ đồ tổng thể

```
    ┌──────────────────────────────────────────────────────────────┐
    │                         Trình duyệt                          │
    │       Phaser (thế giới game) + React (menu, giao diện)       │
    └──────────────────────────────────────────────────────────────┘
                   │ WebSocket (WSS)                │ HTTPS (REST)
                   │ gói tin 20 Hz                  │ đăng nhập, sàn, thư
                   ▼                                ▼
    ┌─────────────────────────────┐  ┌─────────────────────────────┐
    │ GAME SERVER (Colyseus)      │  │ API SERVER (Fastify)        │
    │ • mô phỏng thế giới         │  │ • tài khoản, đăng nhập      │
    │ • di chuyển, chiến đấu      │  │ • sàn giao dịch, khớp lệnh  │
    │ • quái, AI, thời tiết       │  │ • hòm thư                   │
    │ • chunk, công trình         │  │ • bảng xếp hạng, bang hội   │
    │ • trao đổi trực tiếp        │  │ • công cụ quản trị          │
    │ • NPC trong trạm            │  │                             │
    └──────────────┬──────────────┘  └──────────────┬──────────────┘
                   │      ┌──────────────────┐      │
                   ├─────►│      Redis       │◄─────┤
                   │      │  pub/sub, cache  │      │
                   │      └──────────────────┘      │
                   ▼                                ▼
    ┌──────────────────────────────────────────────────────────────┐
    │                          PostgreSQL                          │
    │    tài khoản · nhân vật · vật phẩm · chunk · sàn · sổ cái    │
    └──────────────────────────────────────────────────────────────┘
```

**Chia việc giữa hai server:**
- **Game server** lo mọi thứ thời gian thực, tức những gì liên quan tới vị trí và va chạm.
- **API server** lo những việc không cần tính theo từng khung hình, như sàn giao dịch và hòm thư.
- Khi một lệnh trên sàn khớp, API server báo cho game server qua Redis, và game server hiện thông báo cho người chơi đang online.

---

## 3. Cấu trúc thư mục (monorepo)

```
game-sinh-ton/
├─ apps/
│  ├─ client/              # Vite + Phaser + React
│  │  └─ src/
│  │     ├─ scenes/        # Boot, Menu, Game, UI
│  │     ├─ render/        # vẽ tilemap, ánh sáng, hiệu ứng sương
│  │     ├─ net/           # kết nối, dự đoán, nội suy
│  │     ├─ ui/            # React: túi đồ, chế tạo, sàn, giao dịch
│  │     └─ input/         # bàn phím, chuột, cảm ứng
│  ├─ game-server/         # Colyseus
│  │  └─ src/
│  │     ├─ rooms/         # WorldRoom (theo từng cõi)
│  │     ├─ world/         # quản lý chunk, sinh địa hình, lưu delta
│  │     ├─ systems/       # di chuyển, chiến đấu, sinh tồn, chế tạo...
│  │     ├─ ai/            # máy trạng thái của quái
│  │     ├─ trade/         # trao đổi trực tiếp, NPC
│  │     └─ persistence/   # lưu/tải nhân vật, chunk
│  └─ api/                 # Fastify
│     └─ src/{auth,market,mail,clans,leaderboard,admin}/
├─ packages/
│  ├─ shared/              # kiểu dữ liệu, hằng số, công thức, giao thức gói tin,
│  │                       # hàm sinh địa hình tất định (dùng chung client/server)
│  ├─ game-data/           # định nghĩa vật phẩm, công thức, quái, biome, giá
│  └─ db/                  # schema Drizzle, migration, seed dữ liệu
├─ tools/                  # script kiểm tra dữ liệu, mô phỏng kinh tế
├─ docs/
└─ docker-compose.yml      # postgres, redis cho môi trường dev
```

---

## 4. Mô hình mạng

- **Server quyết định mọi thứ.**
  - Server chạy **20 lần mỗi giây** (mỗi lượt 50 ms).
  - Client chỉ gửi *đầu vào* (hướng đi, hành động, góc nhắm) kèm số thứ tự. Client không bao giờ tự nói "tôi đang ở vị trí X" hay "tôi có 100 gỗ".
- **Dự đoán phía client:** nhân vật của chính mình di chuyển ngay khi bấm phím, không chờ server.
  - Khi server trả về vị trí chính thức, client so lại và chỉnh nhẹ nếu lệch (reconciliation).
- **Nội suy:** người chơi và quái khác được vẽ trễ khoảng 100 ms, ở giữa hai trạng thái nhận từ server, nên chuyển động mượt.
- **Vùng quan tâm (AOI):**
  - Mỗi người chơi chỉ nhận thực thể trong bán kính khoảng 2 chunk.
  - Lợi ích: tiết kiệm băng thông, và người chơi không thể dùng hack để nhìn đồ hay người ở xa.
- **Hai loại gói tin:**
  - Hành động quan trọng (nhặt đồ, chế tạo, xây, giao dịch) được gửi kèm mã yêu cầu và **có phản hồi xác nhận**.
  - Trạng thái di chuyển thì đồng bộ liên tục, mất một gói cũng không sao.
- **Server kiểm tra gian lận:** tốc độ di chuyển tối đa, tầm đánh, thời gian hồi chiêu, va chạm tường, khoảng cách khi tương tác với vật thể.
- **Kết nối lại:** rớt mạng dưới 30 giây thì vào lại đúng chỗ cũ. Trong lúc đó nhân vật vẫn đứng trong thế giới và có thể bị tấn công, để không ai thoát game giữa trận đánh.

---

## 5. Thế giới vô hạn

### 5.1 Sinh địa hình tất định

- Hàm `generateChunk(seed, cx, cy)` nằm trong `packages/shared`. Cùng đầu vào thì luôn ra cùng kết quả.
- **Client tự sinh địa hình nền** (nước, cỏ, cát, ...). Server chỉ gửi **phần thay đổi**, như cây đã bị chặt hay công trình đã xây. Cách này tiết kiệm băng thông rất nhiều.
- **Vị trí quặng hiếm, loot và quái chỉ có ở server.** Server gửi xuống khi người chơi tới gần, nên không ai đọc code client để dò kho báu được.

### 5.2 Vòng đời của một chunk

```
 [Chưa tồn tại]
       │ người chơi tới gần
       ▼
 [Sinh từ seed + áp delta từ CSDL]
       │
       ▼
 [ĐANG CHẠY] ◄──────────────────────────┐
       │ không còn ai trong 2 chunk     │ có người quay lại
       ▼                                │
 [CHỜ 60 giây] ─────────────────────────┘
       │ hết 60 giây, vẫn không ai
       ▼
 [Lưu delta vào CSDL, giải phóng khỏi RAM]
```

- **Lưu trữ:** bảng `chunk_deltas`. Cột `data` là danh sách thay đổi ô và thực thể, nén bằng msgpack + zstd.
- **Tính bù khi tải lại:** khi một chunk được tải lại, server tính phần đã thay đổi trong thời gian không ai ở đó: cây trồng lớn lên, tài nguyên mọc lại, phí bảo trì bị trừ, đồ ăn trong rương hỏng đi. Server **không chạy mô phỏng** cho chunk vắng người.

### 5.3 Mở rộng quy mô

| Giai đoạn | Cách làm |
|---|---|
| Ban đầu | Mỗi cõi chạy trên 1 tiến trình game server, khoảng 100 người online |
| Khi đông | **Chia thế giới theo khu vực:** mỗi tiến trình quản lý một tập khu vực. Người chơi đi qua ranh giới thì được chuyển sang tiến trình khác. Các tiến trình nói chuyện qua Redis |
| Rất đông | Mở thêm cõi song song ("Máy chủ 1, 2, 3..."), mỗi cõi có kinh tế riêng |

> **Lưu ý:** cần thiết kế từ đầu để mọi thao tác với chunk đi qua một lớp `WorldManager`. Như vậy sau này chia theo khu vực sẽ không phải viết lại toàn bộ.

---

## 6. Vòng lặp server

Dùng mô hình **ECS đơn giản** (Thực thể – Thành phần – Hệ thống). Mỗi lượt (tick), các hệ thống chạy lần lượt:

```
 1. Nhận đầu vào        (xếp hàng gói tin từ client)
 2. Di chuyển + va chạm
 3. Chiến đấu           (đòn đánh, đạn, sát thương, giáp)
 4. AI quái             (máy trạng thái, tìm đường A* trên lưới, giới hạn số lần tính mỗi tick)
 5. Sinh tồn            (đói, khát, thân nhiệt, Nhiễm Sương: chạy mỗi 1 giây, không phải mỗi tick)
 6. Hiệu ứng trạng thái
 7. Thời gian & thời tiết
 8. Sinh/xóa quái theo vùng quan tâm
 9. Hàng chờ chế tạo, nấu nướng, nung quặng
10. Xây dựng, phá hủy
11. Rơi đồ, nhặt đồ, đồ trên đất tự biến mất
12. Lưu định kỳ         (theo lô, chạy không chặn vòng lặp)
13. Đồng bộ trạng thái  (Colyseus chỉ gửi phần thay đổi theo vùng quan tâm)
```

---

## 7. Dữ liệu game (tách khỏi code)

Mọi vật phẩm, công thức, quái và biome nằm trong `packages/game-data`. Nhờ vậy có thể chỉnh số liệu mà không phải sửa logic.

```ts
// packages/game-data/src/items.ts
export const ITEMS = {
  wood:      { id: 'wood', name: 'Gỗ', category: 'resource', stack: 100, weight: 0.5,
               basePrice: 10, targetStock: 10_000, elasticity: 0.7, tradable: true },
  stone_axe: { id: 'stone_axe', name: 'Rìu đá', category: 'tool', stack: 1, weight: 2,
               tier: 0, durability: 120, damage: { chop: 12, melee: 8 },
               basePrice: 60, tradable: true },
} as const;

// packages/game-data/src/recipes.ts
export const RECIPES = [
  { id: 'stone_axe', station: null, time: 3,
    inputs: { wood: 3, stone: 5, fiber: 2 }, output: { stone_axe: 1 } },
];
```

**Script kiểm tra dữ liệu** (`tools/validate-data.ts`) chạy trong CI:
- Công thức không được dùng vật phẩm không tồn tại.
- Mọi vật phẩm phải kiếm được bằng ít nhất một cách.
- **Không có vòng lặp kiếm tiền vô hạn.** Mua nguyên liệu từ hệ thống, chế tạo, rồi bán lại cho hệ thống không bao giờ được lời.
  - Ở giá gốc, với mọi công thức: `giá hệ thống MUA thành phẩm < tổng giá hệ thống BÁN nguyên liệu`.
  - Vì giá còn biến động, server **chặn thêm khi đang chạy**: `giá MUA thành phẩm ≤ 0.9 × tổng giá BÁN hiện tại của nguyên liệu` (xem mục 3.2 tài liệu Kinh tế).

**Công cụ mô phỏng kinh tế** (`tools/economy-sim.ts`):
- Chạy 1.000 "người chơi ảo" trong 90 ngày để xem lượng Xu và giá cả thay đổi thế nào.
- Chạy trước khi đổi tham số kinh tế trên server thật.

---

## 8. Cơ sở dữ liệu (PostgreSQL)

Các bảng chính (rút gọn):

```
accounts         (id, email, password_hash, created_at, status, playtime_sec, trade_unlocked_at)
realms           (id, name, mode, seed, created_at)            -- cõi: chính / hardcore / mùa giải
characters       (id, account_id, realm_id, name, x, y, hp, hunger, thirst, body_temp,
                  mist, skills JSONB, perks JSONB, spawn_point, days_survived, alive, updated_at)
wallets          (id, realm_id, owner_type, owner_id, balance BIGINT CHECK (balance >= 0))
                  -- owner_type: character | clan | system (NPC, THUẾ, PHẦN_THƯỞNG...)
ledger_entries   (id, realm_id, from_wallet, to_wallet, amount BIGINT CHECK (amount > 0),
                  reason, ref_type, ref_id, created_at)        -- sổ cái, chỉ ghi thêm, không sửa
item_instances   (id UUID, realm_id, def_id, qty CHECK (qty > 0), durability, max_durability,
                  mist_level, affixes JSONB, bound BOOL,
                  location_type, location_id, slot, created_at)
                  -- location_type: inventory | container | market_escrow | mail | ground | trade_hold
item_history     (item_id, from_location, to_location, reason, at)  -- chỉ lưu cho đồ độc nhất
chunk_deltas     (realm_id, cx, cy, data BYTEA, version, updated_at)  PRIMARY KEY (realm_id, cx, cy)
territories      (id, realm_id, owner_type, owner_id, x, y, radius, upkeep_paid_until)
system_market    (realm_id, item_def_id, stock, target_stock, base_price, elasticity, updated_at)
market_orders    (id, realm_id, character_id, side, item_def_id, item_instance_id NULL,
                  price, qty_total, qty_remaining, status, expires_at, created_at)
market_fills     (id, realm_id, buy_order_id, sell_order_id, price, qty, executed_at)
direct_trades    (id, realm_id, char_a, char_b, a_offer JSONB, b_offer JSONB, executed_at)
mail             (id, realm_id, from_char, to_char, xu, cod_price, expires_at, claimed_at)
clans, clan_members, contracts, achievements, leaderboard_snapshots
idempotency_keys (key, account_id, response JSONB, created_at)   -- tự xóa sau 24 giờ
```

**Nguyên tắc chung:**
- Tiền là `BIGINT`, đơn vị là Xu nguyên. **Không dùng số thực** cho tiền.
- Vật phẩm không bao giờ bị "xóa rồi tạo lại" khi đổi chủ. Chỉ **cập nhật vị trí** (`location_type` và `location_id`), để luôn truy vết được đồ đang ở đâu.
- Lưu trạng thái nhân vật theo lô mỗi 60 giây và khi thoát game.
- **Thay đổi về Xu và đồ trong giao dịch được ghi ngay lập tức**, không chờ tới lượt lưu định kỳ.

---

## 9. Giao dịch an toàn: ví dụ khớp lệnh

Mỗi mặt hàng trên sàn được khớp **tuần tự**, bằng cách dùng khóa tư vấn (advisory lock) theo cặp (cõi, mặt hàng):
- Không bao giờ có hai tiến trình cùng khớp lệnh cho một mặt hàng.
- Nguyên tắc "giá tốt hơn được khớp trước, cùng giá thì lệnh sớm hơn khớp trước" luôn đúng.

Đoạn code dưới đây là **mã giả**, chỉ minh họa thứ tự các bước:

```ts
// Mã giả: đặt lệnh MUA hàng xếp chồng
async function placeBuyOrder(req: BuyOrderRequest) {
  return db.transaction(async (tx) => {
    if (await isDuplicate(tx, req.idempotencyKey)) return previousResult(tx, req.idempotencyKey);

    await tx.execute(sql`SELECT pg_advisory_xact_lock(${req.realmId}, ${itemNumericId(req.itemDefId)})`);

    // 1. Thu phí đăng lệnh và ký quỹ: chuyển Xu từ ví người mua (mỗi lần chuyển đều ghi sổ cái)
    await transferXu(tx, buyerWallet, TAX_SINK, listingFee(req), 'market_listing_fee');
    await transferXu(tx, buyerWallet, MARKET_ESCROW, req.price * req.qty, 'market_buy_escrow');

    // 2. Lấy các lệnh bán có giá ≤ giá mua, rẻ nhất trước, cùng giá thì cũ nhất trước
    const asks = await tx.select().from(marketOrders)
      .where(and(eq(side, 'sell'), eq(itemDefId, req.itemDefId), eq(status, 'open'), lte(price, req.price)))
      .orderBy(asc(price), asc(createdAt))
      .for('update');

    let remaining = req.qty;
    for (const ask of asks) {
      if (remaining === 0) break;
      const qty = Math.min(remaining, ask.qtyRemaining);
      // 3. Hàng: chuyển từ kho ký gửi của sàn sang hòm thư người mua (cập nhật vị trí, không tạo đồ mới)
      await moveItems(tx, { from: escrowOf(ask), to: mailboxOf(req.buyer), qty });
      // 4. Tiền: người bán nhận giá của lệnh đặt trước, trừ thuế; trả lại phần chênh lệch giá cho người mua
      await transferXu(tx, MARKET_ESCROW, sellerWallet(ask), ask.price * qty - tax(ask.price * qty), 'market_sale');
      await transferXu(tx, MARKET_ESCROW, TAX_SINK, tax(ask.price * qty), 'market_tax');
      await transferXu(tx, MARKET_ESCROW, buyerWallet, (req.price - ask.price) * qty, 'market_refund_diff');
      await recordFill(tx, ask, req, qty);
      remaining -= qty;
    }

    // 5. Phần chưa khớp trở thành lệnh mua đang mở (Xu vẫn nằm trong ký quỹ)
    const order = await insertOpenBuyOrder(tx, req, remaining);
    await saveIdempotency(tx, req.idempotencyKey, order);
    return order;
  });
  // Sau khi COMMIT: publish sự kiện "market.fill" lên Redis để báo người chơi đang online
}
```

**Bộ test bắt buộc trước khi mở sàn:**
- Bắn **1.000 lệnh đồng thời** từ nhiều tài khoản, sau đó kiểm tra tổng Xu và tổng số lượng từng vật phẩm **không đổi** (chỉ chuyển chỗ).
- **Ngắt kết nối CSDL giữa chừng**, sau đó kiểm tra không có giao dịch nào chỉ chạy được một nửa.
- **Gửi cùng một yêu cầu 2–5 lần**, sau đó kiểm tra lệnh chỉ thực hiện đúng 1 lần.
- **Trao đổi trực tiếp:** một bên vứt đồ, một bên rớt mạng, hai giao dịch cùng dùng một món đồ. Mọi trường hợp đều phải bị từ chối an toàn.

---

## 10. Bảo mật

- **Mật khẩu:** băm bằng argon2id.
- **Phiên đăng nhập:** JWT hạn ngắn (15 phút) kèm refresh token xoay vòng. WebSocket xác thực bằng token khi vào phòng.
- **Tài khoản khách:** chơi ngay không cần đăng ký, nhưng **không dùng được sàn và hòm thư**. Liên kết email để giữ tiến trình lâu dài.
- **Kiểm tra dữ liệu vào:** mọi gói tin và yêu cầu đều được kiểm tra bằng schema (zod). Gói tin sai định dạng thì bỏ qua và ghi nhật ký.
- **Giới hạn tần suất** theo IP và tài khoản cho đăng nhập, sàn, hòm thư, chat.
- **Chat:** lọc từ ngữ xấu, chống spam, có nút báo cáo.
- **Kết nối:** chỉ dùng HTTPS và WSS. Cấu hình CORS chặt. Bí mật (khóa JWT, mật khẩu CSDL) để trong biến môi trường, **không commit vào repo**.

---

## 11. Mục tiêu hiệu năng

| Chỉ tiêu | Mục tiêu |
|---|---|
| FPS client | 60 trên laptop tầm trung, 30 trở lên trên điện thoại tầm trung |
| Dung lượng tải ban đầu | Dưới 5 MB. Ảnh và âm thanh của biome tải dần khi cần |
| Số người mỗi tiến trình game server | 100 người, mỗi tick dưới 25 ms (một nửa ngân sách 50 ms) |
| Băng thông mỗi người | Trung bình dưới 10 KB/giây |
| Độ trễ khớp lệnh trên sàn | Dưới 200 ms |
| Lưu dữ liệu | Nhân vật mỗi 60 giây và khi thoát. Chunk khi giải phóng hoặc mỗi 5 phút. Giao dịch ghi ngay |

---

## 12. Vận hành

- **Nhật ký:** ghi log có cấu trúc bằng `pino`.
- **Số liệu:** Prometheus và Grafana theo dõi:
  - người online
  - thời gian mỗi tick
  - số giao dịch mỗi phút
  - tổng lượng Xu đang lưu hành
  - kết quả kiểm tra sổ cái
- **Sao lưu:**
  - Sao lưu CSDL hằng ngày, kèm lưu WAL để khôi phục về bất kỳ thời điểm nào. Kinh tế của người chơi là tài sản thật đối với họ.
  - Thử khôi phục bản sao lưu mỗi tháng.
- **Công cụ quản trị:**
  - Tra cứu người chơi và nhật ký giao dịch.
  - Hoàn tác giao dịch, phát đồ đền bù.
  - Khóa tài khoản.
  - Chỉnh tham số kinh tế.
- **Bật/tắt tính năng:** có thể tạm dừng riêng sàn, hòm thư hoặc giao dịch trực tiếp mà không phải tắt server (đây là "nút khẩn cấp").
- **CI** (GitHub Actions) chạy ở mỗi commit:
  - lint
  - kiểm tra kiểu dữ liệu TypeScript
  - unit test
  - kiểm tra dữ liệu game
  - test chống nhân bản đồ (với PostgreSQL thật chạy trong container)
