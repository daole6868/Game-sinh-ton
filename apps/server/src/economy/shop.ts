import {
  addStack,
  canAddAll,
  cloneSlots,
  countItem,
  dailySellCap,
  freshness,
  isUnique,
  type ItemStack,
  ITEMS,
  makeStack,
  NPCS,
  type NpcRole,
  quoteBuyFromSystem,
  quoteSellToSystem,
  RESTOCK_PER_HOUR,
  type ShopView,
  SYSTEM_TRADED_ITEMS,
  systemBuyPrice,
  systemSellPrice,
  takeItem,
  targetStock,
} from '@suongdo/shared';
import { GameError } from '../db.ts';
import { giveXp } from '../game/combat.ts';
import type { Game } from '../game/game.ts';
import type { Player } from '../game/player.ts';
import { questEvent } from '../game/quests.ts';
import { charWallet, SYS } from './ledger.ts';

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Cửa hàng NPC với giá động theo tồn kho toàn server. */
export class Shop {
  private stock = new Map<string, number>();

  constructor(private game: Game) {
    const rows = game.db.all<{ item_id: string; stock: number }>('SELECT item_id, stock FROM system_market');
    for (const r of rows) this.stock.set(r.item_id, r.stock);
    game.db.tx(() => {
      for (const id of SYSTEM_TRADED_ITEMS) {
        if (!this.stock.has(id)) {
          this.stock.set(id, targetStock(id));
          game.db.run('INSERT OR IGNORE INTO system_market(item_id, stock, updated_at) VALUES (?, ?, ?)', id, targetStock(id), Date.now());
        }
      }
    });
  }

  stockOf = (id: string): number => this.stock.get(id) ?? targetStock(id);

  private setStock(id: string, v: number): void {
    this.stock.set(id, v);
    this.game.db.run(
      'INSERT INTO system_market(item_id, stock, updated_at) VALUES (?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET stock = excluded.stock, updated_at = excluded.updated_at',
      id,
      v,
      Date.now(),
    );
  }

  /** Tồn kho tự trở về mục tiêu 5% khoảng cách mỗi giờ. */
  restock(seconds: number): void {
    const f = 1 - Math.pow(1 - RESTOCK_PER_HOUR, seconds / 3600);
    this.game.db.tx(() => {
      for (const [id, s] of this.stock) {
        const t = targetStock(id);
        const ns = s + (t - s) * f;
        if (Math.abs(ns - s) > 1e-6) this.setStock(id, ns);
      }
    });
  }

  /** Giá NPC bán (người chơi mua). */
  sellPrice(id: string): number {
    return systemSellPrice(id, this.stockOf(id));
  }

  /** Giá NPC mua (người chơi bán). */
  buyPrice(id: string, tradingLv = 1): number {
    return systemBuyPrice(id, this.stockOf(id), this.stockOf, tradingLv);
  }

  /** Giá tham khảo cho cảnh báo giao dịch: giá NPC bán, hoặc giá gốc. */
  refPrice(id: string): number {
    if (this.stock.has(id)) return this.sellPrice(id);
    return ITEMS[id]?.price ?? 0;
  }

  capInfo(p: Player): { cap: number; left: number } {
    if (p.capDay !== todayKey()) {
      p.capDay = todayKey();
      p.soldToday = 0;
    }
    const cap = dailySellCap(p.skills.trading.lv, p.rep);
    return { cap, left: Math.max(0, cap - p.soldToday) };
  }

  view(p: Player, outpost: string, role: NpcRole): ShopView {
    this.game.requireAtOutpost(p, outpost);
    const npc = NPCS[role];
    if (!npc || (npc.sells.length === 0 && npc.buys.length === 0)) throw new GameError('NPC này không buôn bán.');
    const ids = [...new Set([...npc.sells, ...npc.buys])];
    const { cap, left } = this.capInfo(p);
    return {
      role,
      cap,
      capLeft: left,
      items: ids.map((id) => ({
        id,
        sell: npc.sells.includes(id) ? this.sellPrice(id) : undefined,
        buy: npc.buys.includes(id) ? this.buyPrice(id, p.skills.trading.lv) : undefined,
        stock: Math.round(this.stockOf(id)),
        target: targetStock(id),
      })),
    };
  }

  buy(p: Player, outpost: string, role: NpcRole, id: string, qty: number): { paid: number } {
    this.game.requireAtOutpost(p, outpost);
    const npc = NPCS[role];
    if (!npc?.sells.includes(id)) throw new GameError('NPC không bán mặt hàng này.');
    if (!Number.isInteger(qty) || qty < 1 || qty > 500) throw new GameError('Số lượng không hợp lệ.');
    const q = quoteBuyFromSystem(id, this.stockOf(id), qty);
    const stacks: ItemStack[] = [];
    if (isUnique(id)) for (let i = 0; i < qty; i++) stacks.push(makeStack(id, 1, { now: this.game.time, uid: () => this.game.uid() }));
    else stacks.push(makeStack(id, qty, { now: this.game.time }));
    if (!canAddAll(p.inv, stacks)) throw new GameError('Túi đồ không đủ chỗ.');
    this.game.atomic([p], () => {
      this.game.ledger.transfer(charWallet(p.charId), SYS.npc, q.total, 'npc_buy', `${id}x${qty}`);
      for (const s of stacks) addStack(p.inv, s);
      this.setStock(id, q.stock);
    });
    giveXp(this.game, p, 'trading', Math.max(1, Math.round(q.total / 80)));
    this.game.refreshWallet(p);
    questEvent(this.game, p, { kind: 'have' });
    return { paid: q.total };
  }

  sell(p: Player, outpost: string, role: NpcRole, id: string, qty: number): { got: number } {
    this.game.requireAtOutpost(p, outpost);
    const npc = NPCS[role];
    if (!npc?.buys.includes(id)) throw new GameError('NPC không mua mặt hàng này.');
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000) throw new GameError('Số lượng không hợp lệ.');
    if (ITEMS[id]?.bound) throw new GameError('Vật phẩm khóa không bán được.');
    const avail = p.inv.map((s, i) => (p.reserved.has(i) ? null : s));
    if (countItem(avail, id) < qty) throw new GameError('Bạn không có đủ hàng.');
    const { left } = this.capInfo(p);
    let total = 0;
    let overCap = 0;
    this.game.atomic([p], () => {
      const work = cloneSlots(p.inv);
      const taken = takeItem(work, id, qty)!;
      // đồ ăn ôi, hỏng bị giảm giá theo độ tươi
      let freshAvg = 0;
      for (const t of taken) freshAvg += freshness(t, this.game.time) * t.n;
      freshAvg /= qty;
      const fMul = Math.max(0.2, Math.min(1, freshAvg * 1.25));
      const q = quoteSellToSystem(id, this.stockOf(id), qty, this.stockOf, p.skills.trading.lv, left);
      total = Math.floor(q.total * fMul);
      overCap = q.overCap;
      if (total <= 0) throw new GameError('Hàng này hiện không còn giá trị với NPC.');
      p.inv = work;
      this.game.ledger.transfer(SYS.npc, charWallet(p.charId), total, 'npc_sell', `${id}x${qty}`);
      p.soldToday += total;
      this.setStock(id, q.stock);
    });
    giveXp(this.game, p, 'trading', Math.max(1, Math.round(total / 60)));
    this.game.refreshWallet(p);
    if (overCap > 0) this.game.note(p, 'Bạn đã vượt hạn mức bán cho hệ thống hôm nay — phần vượt chỉ được 20% giá. Hãy bán cho người chơi khác trên Sàn!', 'warn');
    questEvent(this.game, p, { kind: 'sell_npc' });
    return { got: total };
  }

  /** Mua vào kho hệ thống (dùng cho hợp đồng). */
  addStock(id: string, qty: number): void {
    this.setStock(id, this.stockOf(id) + qty);
  }
}
