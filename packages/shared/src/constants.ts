/** Kích thước một ô (tile) khi vẽ, tính bằng pixel thế giới. */
export const TILE_PX = 16;
/** Số ô mỗi cạnh chunk. */
export const CHUNK = 32;
/** Bán kính (theo chunk) server gửi dữ liệu chunk cho client. */
export const CHUNK_VIEW_RADIUS = 2;

/** Server mô phỏng 20 lượt/giây. */
export const TICK_RATE = 20;
export const TICK_DT = 1 / TICK_RATE;
/** Client mô phỏng di chuyển theo bước cố định 30 Hz (khớp với server khi đối chiếu). */
export const INPUT_DT = 1 / 30;
/** Server gửi ảnh chụp trạng thái 10 lần/giây. */
export const SNAPSHOT_EVERY_TICKS = 2;
/** Bán kính vùng quan tâm (ô). */
export const AOI_RADIUS = 40;

/** Một ngày game = 20 phút thực. */
export const DAY_LENGTH = 1200;
export const DAWN_END = 60;
export const DAY_END = 840;
export const DUSK_END = 900;
/** Mỗi mùa 7 ngày game. */
export const DAYS_PER_SEASON = 7;
/** Cứ 7 ngày có một Đêm Sương Đỏ. */
export const BLOOD_NIGHT_EVERY = 7;

/** Độ rộng mỗi vòng độ sâu (Ring) tính bằng ô. */
export const RING_SIZE = 1000;
/** Kích thước ô lưới trạm giao thương. */
export const OUTPOST_CELL = 1500;
export const OUTPOST_PLAZA_RADIUS = 14;
export const OUTPOST_SAFE_RADIUS = 24;
/** Không cho xây trong bán kính này quanh tâm thế giới (khu xuất phát). */
export const SPAWN_NO_BUILD_RADIUS = 30;

export const PLAYER_RADIUS = 0.3;
export const WALK_SPEED = 4;
export const RUN_SPEED = 6.5;
export const DASH_SPEED = 13;
export const DASH_TIME = 0.18;
export const DASH_COOLDOWN = 0.9;
export const DASH_STAMINA = 22;
export const SHALLOW_WATER_MUL = 0.55;

export const INVENTORY_SIZE = 32; // 0..7 là thanh nhanh, 8..31 là túi
export const HOTBAR_SIZE = 8;
export const CHEST_SIZE = 20;
export const STALL_SIZE = 8;
export const SAFE_STORAGE_SIZE = 16;
export const MAX_CARRY_WEIGHT = 120;

export const INTERACT_RANGE = 2.4;
export const GATHER_RANGE = 2.2;
export const BUILD_RANGE = 5;
export const STATION_RANGE = 3.5;
export const PICKUP_RANGE = 0.9;

export const START_XU = 100;
export const BAG_LIFETIME_MS = 30 * 60 * 1000;
export const BAG_OWNER_ONLY_MS = 10 * 60 * 1000;

export const TERRITORY_RADIUS = 16;
export const MAX_TOTEMS = 1;
export const UPKEEP_BASE = 10;
export const UPKEEP_PER_STRUCTURE = 1;
export const UPKEEP_DECAY_AFTER_DAYS = 7;

/** Kinh tế */
export const SYSTEM_SPREAD = 0.55; // giá hệ thống mua = giá bán × 0.55
export const PRICE_MIN_FACTOR = 0.5;
export const PRICE_MAX_FACTOR = 3.0;
export const RESTOCK_PER_HOUR = 0.05;
export const DAILY_SELL_CAP = 3000;
export const OVER_CAP_FACTOR = 0.2;
export const MARKET_LISTING_FEE = 0.01;
export const MARKET_TAX = 0.05;
export const MARKET_TAX_MIN = 0.03;
export const STALL_TAX = 0.03;
export const MARKET_ORDER_HOURS = 72;
export const MARKET_MAX_ORDERS = 10;
export const MAIL_KEEP_DAYS = 30;
export const MAIL_COD_HOURS = 72;
export const MAIL_FEE_PER_STACK = 5;
export const TRADE_MAX_DISTANCE = 8;
export const TRADE_INVITE_DISTANCE = 5;
export const TRADE_CONFIRM_DELAY_MS = 3000;
export const TRADE_TIMEOUT_MS = 3 * 60 * 1000;
export const TRADE_COMBAT_LOCK_MS = 10_000;
export const SAFE_STORAGE_UNLOCK = 200;
export const CONTRACTS_PER_DAY = 8;
