import {
  DAILY_SELL_CAP,
  MARKET_LISTING_FEE,
  MARKET_TAX,
  MARKET_TAX_MIN,
  PRICE_MAX_FACTOR,
  PRICE_MIN_FACTOR,
  SYSTEM_SPREAD,
} from './constants.ts';
import { ITEMS } from './data/items.ts';
import { NPC_LIST } from './data/npcs.ts';
import { RECIPES_BY_OUTPUT } from './data/recipes.ts';
import { tradeTaxRate } from './data/skills.ts';

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function targetStock(itemId: string): number {
  return ITEMS[itemId]?.target ?? 500;
}

export function elasticity(itemId: string): number {
  return ITEMS[itemId]?.k ?? 0.6;
}

/** Hệ số giá = clamp((S* / max(S, 1)) ^ k, 0.5, 3.0) */
export function priceFactor(itemId: string, stock: number): number {
  const target = targetStock(itemId);
  const k = elasticity(itemId);
  return clamp(Math.pow(target / Math.max(stock, 1), k), PRICE_MIN_FACTOR, PRICE_MAX_FACTOR);
}

/** Giá hệ thống BÁN cho người chơi (1 đơn vị). */
export function systemSellPrice(itemId: string, stock: number): number {
  const p0 = ITEMS[itemId]?.price ?? 0;
  return Math.max(1, Math.ceil(p0 * priceFactor(itemId, stock)));
}

/** Giá hệ thống MUA từ người chơi (1 đơn vị), chưa tính chặn vòng lặp và hạn mức. */
export function systemBuyPriceRaw(itemId: string, stock: number): number {
  const p0 = ITEMS[itemId]?.price ?? 0;
  return Math.floor(p0 * priceFactor(itemId, stock) * SYSTEM_SPREAD);
}

export const SYSTEM_SOLD_ITEMS: Set<string> = new Set(NPC_LIST.flatMap((n) => n.sells));

/**
 * Chặn vòng lặp kiếm lời: hệ thống không mua thành phẩm cao hơn
 * 0.9 × tổng giá bán hiện tại của nguyên liệu (khi mọi nguyên liệu đều mua được từ hệ thống).
 */
export function arbitrageCap(itemId: string, stockOf: (id: string) => number): number {
  let cap = Infinity;
  for (const r of RECIPES_BY_OUTPUT[itemId] ?? []) {
    const ins = Object.entries(r.in);
    if (!ins.every(([id]) => SYSTEM_SOLD_ITEMS.has(id))) continue;
    let cost = 0;
    for (const [id, n] of ins) cost += n * systemSellPrice(id, stockOf(id));
    // trừ phần giá trị của vật phẩm phụ trả lại (ví dụ bình rỗng)
    for (const [id, n] of Object.entries(r.out)) {
      if (id !== itemId) cost -= n * systemBuyPriceRaw(id, stockOf(id));
    }
    const per = cost / (r.out[itemId] ?? 1);
    cap = Math.min(cap, Math.floor(0.9 * per));
  }
  return cap;
}

export function systemBuyPrice(itemId: string, stock: number, stockOf: (id: string) => number, tradingLv = 1): number {
  const raw = Math.floor(systemBuyPriceRaw(itemId, stock) * (1 + 0.001 * (tradingLv - 1)));
  return Math.max(0, Math.min(raw, arbitrageCap(itemId, stockOf)));
}

export interface Quote {
  total: number;
  /** tồn kho sau giao dịch */
  stock: number;
  unitFirst: number;
  unitLast: number;
}

/** Báo giá người chơi MUA qty đơn vị từ hệ thống (giá tăng dần theo từng đơn vị). */
export function quoteBuyFromSystem(itemId: string, stock: number, qty: number): Quote {
  let total = 0;
  let s = stock;
  let first = 0;
  let last = 0;
  for (let i = 0; i < qty; i++) {
    const p = systemSellPrice(itemId, s);
    if (i === 0) first = p;
    last = p;
    total += p;
    s -= 1;
  }
  return { total, stock: s, unitFirst: first, unitLast: last };
}

/**
 * Báo giá người chơi BÁN qty đơn vị cho hệ thống. Giá giảm dần (trượt giá).
 * remainingCap: số Xu còn được nhận trong hạn mức ngày; vượt hạn mức chỉ nhận 20%.
 */
export function quoteSellToSystem(
  itemId: string,
  stock: number,
  qty: number,
  stockOf: (id: string) => number,
  tradingLv: number,
  remainingCap: number,
  overCapFactor = 0.2,
): Quote & { overCap: number } {
  let total = 0;
  let s = stock;
  let first = 0;
  let last = 0;
  let cap = remainingCap;
  let overCap = 0;
  for (let i = 0; i < qty; i++) {
    let p = systemBuyPrice(itemId, s, (id) => (id === itemId ? s : stockOf(id)), tradingLv);
    if (cap <= 0) {
      p = Math.floor(p * overCapFactor);
      overCap++;
    } else if (p > cap) {
      p = cap + Math.floor((p - cap) * overCapFactor);
    }
    cap -= p;
    if (i === 0) first = p;
    last = p;
    total += p;
    s += 1;
  }
  return { total, stock: s, unitFirst: first, unitLast: last, overCap };
}

/** Hạn mức doanh thu bán cho hệ thống mỗi ngày. */
export function dailySellCap(tradingLv: number, reputation: number): number {
  return DAILY_SELL_CAP + 20 * (tradingLv - 1) + 5 * Math.min(reputation, 400);
}

export function listingFee(value: number): number {
  return Math.max(1, Math.ceil(value * MARKET_LISTING_FEE));
}

export function marketTax(value: number, tradingLv: number): number {
  return Math.floor(value * tradeTaxRate(tradingLv, MARKET_TAX, MARKET_TAX_MIN));
}

/** Phí sửa: 30% giá gốc × phần độ bền bị mất. */
export function repairCost(itemId: string, d: number, md: number): number {
  const def = ITEMS[itemId];
  if (!def || !def.durability || md <= 0) return 0;
  const missing = Math.max(0, md - d) / md;
  return Math.max(1, Math.ceil(def.price * 0.3 * missing));
}

export function travelFee(dist: number): number {
  return 30 + Math.floor(dist / 20);
}

/** Hàm định dạng tiền: 12450 → "12.450" */
export function fmtXu(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
