import { CONTRACTS_PER_DAY, type ContractView, countItem, dayOf, ITEMS, mulberry32, NPC_LIST, pickWeighted, takeItem, cloneSlots } from '@suongdo/shared';
import { GameError } from '../db.ts';
import { giveXp } from '../game/combat.ts';
import type { Game } from '../game/game.ts';
import type { Player } from '../game/player.ts';
import { charWallet, SYS } from './ledger.ts';

interface ContractDef {
  id: string;
  item: string;
  qty: number;
  reward: number;
  rep: number;
}

interface ContractState {
  day: number;
  list: ContractDef[];
}

const CANDIDATES = [...new Set(NPC_LIST.flatMap((n) => n.buys))].filter((id) => (ITEMS[id]?.price ?? 0) >= 5);

/**
 * Bảng đơn hàng: mỗi ngày game 8 hợp đồng, ưu tiên mặt hàng hệ thống đang thiếu.
 * Mỗi người làm mỗi hợp đồng một lần/ngày. Thưởng = 85% giá NPC bán ⇒ không thể mua của NPC để giao lấy lời.
 */
export class Contracts {
  private state: ContractState;

  constructor(private game: Game) {
    this.state = game.db.getState<ContractState>('contracts') ?? { day: 0, list: [] };
  }

  ensureDay(day: number): void {
    if (this.state.day === day && this.state.list.length > 0) return;
    const rng = mulberry32((this.game.seed ^ Math.imul(day, 7919)) >>> 0);
    const shop = this.game.shop;
    const pool = [...CANDIDATES];
    const list: ContractDef[] = [];
    while (list.length < CONTRACTS_PER_DAY && pool.length > 0) {
      const item = pickWeighted(rng, pool, (id) => Math.max(0.3, (ITEMS[id]?.target ?? 500) / Math.max(1, shop.stockOf(id))))!;
      pool.splice(pool.indexOf(item), 1);
      const p0 = ITEMS[item]!.price;
      const value = 300 + rng() * 900;
      const qty = Math.max(5, Math.min(400, Math.round(value / p0 / 5) * 5));
      const reward = Math.floor(qty * shop.sellPrice(item) * 0.85);
      list.push({ id: `${day}-${list.length}`, item, qty, reward, rep: 5 + Math.floor(reward / 200) });
    }
    this.state = { day, list };
    this.game.db.setState('contracts', this.state);
  }

  list(p: Player, outpost: string): { day: number; list: ContractView[]; rep: number } {
    this.game.requireAtOutpost(p, outpost);
    const day = dayOf(this.game.time);
    this.ensureDay(day);
    const done = new Set(
      this.game.db.all<{ contract_id: string }>('SELECT contract_id FROM contracts_done WHERE char_id = ? AND day = ?', p.charId, day).map((r) => r.contract_id),
    );
    return { day, rep: p.rep, list: this.state.list.map((c) => ({ ...c, done: done.has(c.id) })) };
  }

  deliver(p: Player, outpost: string, id: string): { reward: number } {
    this.game.requireAtOutpost(p, outpost);
    const day = dayOf(this.game.time);
    this.ensureDay(day);
    const c = this.state.list.find((x) => x.id === id);
    if (!c) throw new GameError('Hợp đồng không còn hiệu lực.');
    if (this.game.db.get('SELECT 1 FROM contracts_done WHERE char_id = ? AND day = ? AND contract_id = ?', p.charId, day, id)) {
      throw new GameError('Bạn đã hoàn thành hợp đồng này hôm nay.');
    }
    const avail = p.inv.map((s, i) => (p.reserved.has(i) ? null : s));
    if (countItem(avail, c.item) < c.qty) throw new GameError(`Cần ${c.qty} ${ITEMS[c.item]?.name}.`);
    this.game.atomic([p], () => {
      const work = cloneSlots(p.inv);
      if (!takeItem(work, c.item, c.qty)) throw new GameError('Không đủ hàng.');
      p.inv = work;
      this.game.ledger.transfer(SYS.reward, charWallet(p.charId), c.reward, 'contract', id);
      this.game.db.run('INSERT INTO contracts_done(char_id, day, contract_id) VALUES (?, ?, ?)', p.charId, day, id);
      this.game.shop.addStock(c.item, c.qty);
      p.rep += c.rep;
    });
    giveXp(this.game, p, 'trading', Math.round(c.reward / 40));
    this.game.refreshWallet(p);
    this.game.sendStats(p);
    this.game.note(p, `Hoàn thành hợp đồng: +${c.reward} Xu, +${c.rep} Danh vọng.`, 'good');
    return { reward: c.reward };
  }
}
