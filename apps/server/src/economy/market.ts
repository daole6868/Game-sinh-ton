import {
  type BookView,
  freshness,
  isPerishable,
  isUnique,
  type ItemStack,
  ITEMS,
  listingFee,
  MARKET_MAX_ORDERS,
  MARKET_ORDER_HOURS,
  type MarketSummary,
  marketTax,
  NPC_LIST,
  type OrderView,
  takeFromSlot,
} from '@suongdo/shared';
import { GameError } from '../db.ts';
import { giveXp } from '../game/combat.ts';
import type { Game } from '../game/game.ts';
import type { CharacterData, Player } from '../game/player.ts';
import { questEvent } from '../game/quests.ts';
import { charWallet, SYS } from './ledger.ts';

interface OrderRow {
  id: number;
  char_id: number;
  char_name: string;
  side: 'buy' | 'sell';
  item_id: string;
  uniq: number;
  stack: string | null;
  price: number;
  qty_total: number;
  qty_remaining: number;
  status: string;
  created_at: number;
  expires_at: number;
}

const MAX_PRICE = 10_000_000;
const SOLD_BY_NPC = new Set(NPC_LIST.flatMap((n) => n.sells));
const BOUGHT_BY_NPC = new Set(NPC_LIST.flatMap((n) => n.buys));

export class Market {
  /** người chơi cần được báo sau khi giao dịch xong */
  private touched = new Set<number>();

  constructor(private game: Game) {}

  private ensureOpen(): void {
    if (!this.game.flags.market) throw new GameError('Sàn giao dịch đang tạm dừng để bảo trì.');
  }

  tradingLvOf(charId: number): number {
    const online = this.game.byChar.get(charId);
    if (online) return online.skills.trading.lv;
    const row = this.game.db.get<{ data: string }>('SELECT data FROM characters WHERE id = ?', charId);
    if (!row) return 1;
    return (JSON.parse(row.data) as CharacterData).skills?.trading?.lv ?? 1;
  }

  avgPrice(item: string, sinceMs: number): number | null {
    const r = this.game.db.get<{ v: number | null }>(
      'SELECT SUM(price * qty) * 1.0 / SUM(qty) AS v FROM market_fills WHERE item_id = ? AND created_at >= ?',
      item,
      sinceMs,
    );
    return r?.v ? Math.round(r.v) : null;
  }

  /** Giá tham khảo: trung bình 7 ngày trên sàn, nếu chưa có thì giá NPC hoặc giá gốc. */
  refPrice(item: string): number {
    return this.avgPrice(item, Date.now() - 7 * 86400_000) ?? this.game.shop.refPrice(item);
  }

  private toView(r: OrderRow, me: number): OrderView {
    return {
      id: r.id,
      side: r.side,
      item: r.item_id,
      price: r.price,
      qty: r.qty_remaining,
      total: r.qty_total,
      owner: r.char_name,
      mine: r.char_id === me,
      unique: r.uniq ? (JSON.parse(r.stack!) as ItemStack) : undefined,
      created: r.created_at,
      expires: r.expires_at,
    };
  }

  summary(p: Player, outpost: string): MarketSummary[] {
    this.game.requireAtOutpost(p, outpost);
    const rows = this.game.db.all<{ item_id: string; side: string; mn: number; mx: number; qty: number }>(
      "SELECT item_id, side, MIN(price) AS mn, MAX(price) AS mx, SUM(qty_remaining) AS qty FROM market_orders WHERE status = 'open' GROUP BY item_id, side",
    );
    const lasts = this.game.db.all<{ item_id: string; price: number }>(
      'SELECT f.item_id, f.price FROM market_fills f JOIN (SELECT item_id, MAX(id) AS mid FROM market_fills GROUP BY item_id) l ON f.id = l.mid',
    );
    const m = new Map<string, MarketSummary>();
    const get = (id: string) => {
      let s = m.get(id);
      if (!s) {
        s = { item: id, bestSell: null, bestBuy: null, sellQty: 0, buyQty: 0, last: null };
        m.set(id, s);
      }
      return s;
    };
    for (const r of rows) {
      const s = get(r.item_id);
      if (r.side === 'sell') {
        s.bestSell = r.mn;
        s.sellQty = r.qty;
      } else {
        s.bestBuy = r.mx;
        s.buyQty = r.qty;
      }
    }
    for (const l of lasts) get(l.item_id).last = l.price;
    return [...m.values()].sort((a, b) => (ITEMS[a.item]?.name ?? '').localeCompare(ITEMS[b.item]?.name ?? '', 'vi'));
  }

  book(p: Player, outpost: string, item: string): BookView {
    this.game.requireAtOutpost(p, outpost);
    if (!ITEMS[item]) throw new GameError('Không có vật phẩm này.');
    const db = this.game.db;
    const sells = db.all<{ price: number; qty: number }>(
      "SELECT price, SUM(qty_remaining) AS qty FROM market_orders WHERE item_id = ? AND side = 'sell' AND status = 'open' AND uniq = 0 GROUP BY price ORDER BY price ASC LIMIT 12",
      item,
    );
    const buys = db.all<{ price: number; qty: number }>(
      "SELECT price, SUM(qty_remaining) AS qty FROM market_orders WHERE item_id = ? AND side = 'buy' AND status = 'open' GROUP BY price ORDER BY price DESC LIMIT 12",
      item,
    );
    const last = db.get<{ price: number }>('SELECT price FROM market_fills WHERE item_id = ? ORDER BY id DESC LIMIT 1', item)?.price ?? null;
    const now = Date.now();
    const history = db.all<{ day: string; avg: number; vol: number }>(
      "SELECT date(created_at / 1000, 'unixepoch') AS day, ROUND(SUM(price * qty) * 1.0 / SUM(qty)) AS avg, SUM(qty) AS vol FROM market_fills WHERE item_id = ? AND created_at >= ? GROUP BY day ORDER BY day",
      item,
      now - 14 * 86400_000,
    );
    const listings = db.all<OrderRow>(
      "SELECT * FROM market_orders WHERE item_id = ? AND uniq = 1 AND status = 'open' ORDER BY price ASC LIMIT 60",
      item,
    );
    return {
      item,
      sells,
      buys,
      last,
      avg24: this.avgPrice(item, now - 86400_000),
      avg7: this.avgPrice(item, now - 7 * 86400_000),
      sys: {
        sell: SOLD_BY_NPC.has(item) ? this.game.shop.sellPrice(item) : null,
        buy: BOUGHT_BY_NPC.has(item) ? this.game.shop.buyPrice(item) : null,
      },
      history,
      listings: listings.map((r) => this.toView(r, p.charId)),
    };
  }

  my(p: Player, outpost: string): OrderView[] {
    this.game.requireAtOutpost(p, outpost);
    return this.game.db
      .all<OrderRow>("SELECT * FROM market_orders WHERE char_id = ? AND status = 'open' ORDER BY created_at DESC", p.charId)
      .map((r) => this.toView(r, p.charId));
  }

  private checkCommon(p: Player, outpost: string, price: number): void {
    this.ensureOpen();
    this.game.requireAtOutpost(p, outpost);
    this.game.requireTradeUnlocked(p);
    if (!Number.isInteger(price) || price < 1 || price > MAX_PRICE) throw new GameError('Giá không hợp lệ.');
    const open = this.game.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM market_orders WHERE char_id = ? AND status = 'open'", p.charId)!.n;
    const max = MARKET_MAX_ORDERS + Math.floor(p.rep / 50);
    if (open >= max) throw new GameError(`Bạn đã có ${open}/${max} lệnh đang mở.`);
  }

  // ───────────────────────── đặt lệnh BÁN ─────────────────────────

  placeSell(p: Player, a: { outpost: string; slot: number; qty: number; price: number; confirm?: boolean; key: string }) {
    return this.game.idempotent(p, a.key, () => {
      this.checkCommon(p, a.outpost, a.price);
      const s = p.inv[a.slot];
      if (!s || p.reserved.has(a.slot)) throw new GameError('Ô đồ không hợp lệ.');
      const def = ITEMS[s.id];
      if (!def || def.bound) throw new GameError('Vật phẩm này không giao dịch được.');
      const unique = isUnique(s.id) || !!s.u;
      const qty = unique ? 1 : a.qty;
      if (!Number.isInteger(qty) || qty < 1 || qty > s.n) throw new GameError('Số lượng không hợp lệ.');
      if (isPerishable(s.id) && freshness(s, this.game.time) < 0.5) throw new GameError('Đồ ăn đã ôi/hỏng không được bán trên sàn.');
      const ref = this.refPrice(s.id);
      if (!a.confirm && ref > 0 && a.price < ref * 0.3) {
        throw new GameError(`CONFIRM:Giá bạn đặt (${a.price}) thấp hơn nhiều so với giá tham khảo (~${ref} Xu). Bạn chắc chắn chứ?`);
      }
      const fee = listingFee(a.price * qty);
      if (p.xu < fee) throw new GameError(`Cần ${fee} Xu phí đăng lệnh.`);
      let orderId = 0;
      let filled = 0;
      this.game.atomic([p], () => {
        const stack = takeFromSlot(p.inv, a.slot, qty)!;
        this.game.ledger.transfer(charWallet(p.charId), SYS.tax, fee, 'market_listing_fee', s.id);
        const now = Date.now();
        orderId = this.game.db.run(
          `INSERT INTO market_orders(char_id, char_name, side, item_id, uniq, stack, price, qty_total, qty_remaining, status, created_at, expires_at)
           VALUES (?, ?, 'sell', ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
          p.charId,
          p.name,
          s.id,
          unique ? 1 : 0,
          JSON.stringify({ ...stack, n: unique ? 1 : 0 }),
          a.price,
          qty,
          qty,
          now,
          now + MARKET_ORDER_HOURS * 3600_000,
        ).lastInsertRowid;
        if (!unique) filled = this.matchIncomingSell(orderId);
      });
      this.afterTrade(p);
      questEvent(this.game, p, { kind: 'market_order' });
      return { order: filled >= qty ? null : orderId, filled };
    });
  }

  /** Khớp lệnh bán mới với các lệnh mua có giá ≥ giá bán (giá cao trước, cũ trước). Giá khớp = giá lệnh mua (đặt trước). */
  private matchIncomingSell(sellId: number): number {
    const db = this.game.db;
    const sell = db.get<OrderRow>('SELECT * FROM market_orders WHERE id = ?', sellId)!;
    let filled = 0;
    const buys = db.all<OrderRow>(
      "SELECT * FROM market_orders WHERE item_id = ? AND side = 'buy' AND status = 'open' AND price >= ? AND char_id != ? ORDER BY price DESC, created_at ASC, id ASC",
      sell.item_id,
      sell.price,
      sell.char_id,
    );
    let remaining = sell.qty_remaining;
    for (const buy of buys) {
      if (remaining <= 0) break;
      const q = Math.min(remaining, buy.qty_remaining);
      this.fill(sell, buy, q, buy.price);
      remaining -= q;
      filled += q;
    }
    return filled;
  }

  // ───────────────────────── đặt lệnh MUA ─────────────────────────

  placeBuy(p: Player, a: { outpost: string; item: string; qty: number; price: number; confirm?: boolean; key: string }) {
    return this.game.idempotent(p, a.key, () => {
      this.checkCommon(p, a.outpost, a.price);
      const def = ITEMS[a.item];
      if (!def || def.bound) throw new GameError('Vật phẩm này không giao dịch được.');
      if (isUnique(a.item)) throw new GameError('Đồ độc nhất chỉ mua được qua danh sách niêm yết.');
      if (!Number.isInteger(a.qty) || a.qty < 1 || a.qty > 100_000) throw new GameError('Số lượng không hợp lệ.');
      const ref = this.refPrice(a.item);
      if (!a.confirm && ref > 0 && a.price > ref * 3) {
        throw new GameError(`CONFIRM:Giá mua (${a.price}) cao hơn nhiều so với giá tham khảo (~${ref} Xu). Bạn chắc chắn chứ?`);
      }
      const total = a.price * a.qty;
      const fee = listingFee(total);
      if (p.xu < total + fee) throw new GameError(`Cần ${total + fee} Xu (gồm ${fee} Xu phí).`);
      let orderId = 0;
      let filled = 0;
      this.game.atomic([p], () => {
        this.game.ledger.transfer(charWallet(p.charId), SYS.tax, fee, 'market_listing_fee', a.item);
        this.game.ledger.transfer(charWallet(p.charId), SYS.escrow, total, 'market_buy_escrow', a.item);
        const now = Date.now();
        orderId = this.game.db.run(
          `INSERT INTO market_orders(char_id, char_name, side, item_id, uniq, stack, price, qty_total, qty_remaining, status, created_at, expires_at)
           VALUES (?, ?, 'buy', ?, 0, NULL, ?, ?, ?, 'open', ?, ?)`,
          p.charId,
          p.name,
          a.item,
          a.price,
          a.qty,
          a.qty,
          now,
          now + MARKET_ORDER_HOURS * 3600_000,
        ).lastInsertRowid;
        filled = this.matchIncomingBuy(orderId);
      });
      this.afterTrade(p);
      questEvent(this.game, p, { kind: 'market_order' });
      return { order: filled >= a.qty ? null : orderId, filled };
    });
  }

  /** Khớp lệnh mua mới với lệnh bán có giá ≤ giá mua (rẻ trước, cũ trước). Giá khớp = giá lệnh bán. */
  private matchIncomingBuy(buyId: number): number {
    const db = this.game.db;
    const buy = db.get<OrderRow>('SELECT * FROM market_orders WHERE id = ?', buyId)!;
    const sells = db.all<OrderRow>(
      "SELECT * FROM market_orders WHERE item_id = ? AND side = 'sell' AND status = 'open' AND uniq = 0 AND price <= ? AND char_id != ? ORDER BY price ASC, created_at ASC, id ASC",
      buy.item_id,
      buy.price,
      buy.char_id,
    );
    let remaining = buy.qty_remaining;
    let filled = 0;
    for (const sell of sells) {
      if (remaining <= 0) break;
      const q = Math.min(remaining, sell.qty_remaining);
      this.fill(sell, { ...buy, qty_remaining: remaining }, q, sell.price);
      remaining -= q;
      filled += q;
    }
    return filled;
  }

  /**
   * Thực hiện một lần khớp. Tiền người mua đang nằm trong ký quỹ với giá của lệnh mua.
   * Người bán nhận giá khớp trừ thuế; phần chênh (nếu giá khớp < giá mua) trả lại người mua.
   */
  private fill(sell: OrderRow, buy: OrderRow, qty: number, price: number): void {
    const db = this.game.db;
    const ledger = this.game.ledger;
    const value = price * qty;
    const tax = marketTax(value, this.tradingLvOf(sell.char_id));
    ledger.transfer(SYS.escrow, charWallet(sell.char_id), value - tax, 'market_sale', `buy#${buy.id}/sell#${sell.id}`);
    if (tax > 0) ledger.transfer(SYS.escrow, SYS.tax, tax, 'market_tax', `sell#${sell.id}`);
    if (buy.price > price) ledger.transfer(SYS.escrow, charWallet(buy.char_id), (buy.price - price) * qty, 'market_refund_diff', `buy#${buy.id}`);
    const tmpl = JSON.parse(sell.stack!) as ItemStack;
    const stack: ItemStack = { ...tmpl, n: qty };
    this.game.mail.sendSystem(
      buy.char_id,
      `Sàn: đã mua ${ITEMS[sell.item_id]?.name ?? sell.item_id} ×${qty}`,
      `Mua từ ${sell.char_name} giá ${price} Xu/cái.`,
      [stack],
      0,
      'market',
    );
    for (const [o, left] of [
      [sell, sell.qty_remaining - qty],
      [buy, buy.qty_remaining - qty],
    ] as const) {
      db.run(
        "UPDATE market_orders SET qty_remaining = ?, status = CASE WHEN ? <= 0 THEN 'filled' ELSE status END WHERE id = ?",
        left,
        left,
        o.id,
      );
    }
    sell.qty_remaining -= qty;
    db.run(
      'INSERT INTO market_fills(item_id, price, qty, buy_order, sell_order, buyer, seller, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      sell.item_id,
      price,
      qty,
      buy.id,
      sell.id,
      buy.char_id,
      sell.char_id,
      Date.now(),
    );
    this.touched.add(sell.char_id);
    this.touched.add(buy.char_id);
  }

  // ───────────────────────── mua đồ độc nhất ─────────────────────────

  buyUnique(p: Player, a: { outpost: string; order: number; key: string }) {
    return this.game.idempotent(p, a.key, () => {
      this.ensureOpen();
      this.game.requireAtOutpost(p, a.outpost);
      this.game.requireTradeUnlocked(p);
      const o = this.game.db.get<OrderRow>("SELECT * FROM market_orders WHERE id = ? AND status = 'open' AND uniq = 1 AND side = 'sell'", a.order);
      if (!o) throw new GameError('Món này đã được bán hoặc gỡ.');
      if (o.char_id === p.charId) throw new GameError('Không thể tự mua đồ của mình.');
      if (p.xu < o.price) throw new GameError('Không đủ Xu.');
      this.game.atomic([p], () => {
        const tax = marketTax(o.price, this.tradingLvOf(o.char_id));
        this.game.ledger.transfer(charWallet(p.charId), charWallet(o.char_id), o.price - tax, 'market_sale', `unique#${o.id}`);
        if (tax > 0) this.game.ledger.transfer(charWallet(p.charId), SYS.tax, tax, 'market_tax', `unique#${o.id}`);
        this.game.db.run("UPDATE market_orders SET qty_remaining = 0, status = 'filled' WHERE id = ?", o.id);
        this.game.db.run(
          'INSERT INTO market_fills(item_id, price, qty, buy_order, sell_order, buyer, seller, created_at) VALUES (?, ?, 1, NULL, ?, ?, ?, ?)',
          o.item_id,
          o.price,
          o.id,
          p.charId,
          o.char_id,
          Date.now(),
        );
        const stack = JSON.parse(o.stack!) as ItemStack;
        this.game.mail.sendSystem(p.charId, `Sàn: đã mua ${ITEMS[o.item_id]?.name}`, `Mua từ ${o.char_name} giá ${o.price} Xu.`, [{ ...stack, n: 1 }], 0, 'market');
        this.touched.add(o.char_id);
        this.touched.add(p.charId);
      });
      this.afterTrade(p);
      return { ok: true as const };
    });
  }

  // ───────────────────────── hủy & hết hạn ─────────────────────────

  private closeOrder(o: OrderRow, status: 'cancelled' | 'expired'): void {
    if (o.qty_remaining > 0) {
      if (o.side === 'sell') {
        const stack = JSON.parse(o.stack!) as ItemStack;
        this.game.mail.sendSystem(
          o.char_id,
          status === 'expired' ? 'Sàn: lệnh bán hết hạn' : 'Sàn: đã hủy lệnh bán',
          `Trả lại ${ITEMS[o.item_id]?.name} ×${o.qty_remaining}.`,
          [{ ...stack, n: o.uniq ? 1 : o.qty_remaining }],
          0,
          'market',
        );
      } else {
        this.game.ledger.transfer(SYS.escrow, charWallet(o.char_id), o.price * o.qty_remaining, 'market_buy_refund', `buy#${o.id}`);
      }
    }
    this.game.db.run('UPDATE market_orders SET status = ? WHERE id = ?', status, o.id);
    this.touched.add(o.char_id);
  }

  cancel(p: Player, a: { outpost: string; order: number }) {
    this.game.requireAtOutpost(p, a.outpost);
    const o = this.game.db.get<OrderRow>("SELECT * FROM market_orders WHERE id = ? AND status = 'open'", a.order);
    if (!o || o.char_id !== p.charId) throw new GameError('Không tìm thấy lệnh.');
    this.game.atomic([p], () => this.closeOrder(o, 'cancelled'));
    this.afterTrade(p);
    return { ok: true as const };
  }

  expire(): void {
    const rows = this.game.db.all<OrderRow>("SELECT * FROM market_orders WHERE status = 'open' AND expires_at < ? LIMIT 200", Date.now());
    if (rows.length === 0) return;
    this.game.atomic([], () => {
      for (const o of rows) this.closeOrder(o, 'expired');
    });
    this.afterTrade(null);
  }

  /** Báo cho người chơi online liên quan: cập nhật ví, số thư chưa đọc. */
  private afterTrade(actor: Player | null): void {
    if (actor) {
      giveXp(this.game, actor, 'trading', 2);
      this.touched.add(actor.charId);
    }
    for (const id of this.touched) {
      const q = this.game.byChar.get(id);
      if (!q) continue;
      this.game.refreshWallet(q);
      q.send({ t: 'mail', unread: this.game.mail.unreadCount(id) });
      if (q !== actor) this.game.note(q, 'Một lệnh của bạn trên Sàn vừa khớp hoặc thay đổi.', 'good');
    }
    this.touched.clear();
  }
}
