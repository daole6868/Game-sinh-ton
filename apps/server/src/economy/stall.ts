import { addStack, canAddAll, INTERACT_RANGE, type ItemStack, ITEMS, marketTax, STALL_SIZE, STALL_TAX, type StallView, STRUCTURES, takeFromSlot } from '@suongdo/shared';
import { GameError } from '../db.ts';
import type { Game } from '../game/game.ts';
import type { Player } from '../game/player.ts';
import { charWallet, SYS } from './ledger.ts';

interface Entry {
  slot: number;
  stack: ItemStack;
  price: number;
}

/** Sạp hàng của người chơi: bày bán, người khác mua được cả khi chủ offline (thuế 3%). */
export class Stalls {
  constructor(private game: Game) {}

  private key(tx: number, ty: number): string {
    return `${tx},${ty}`;
  }

  private entries(tx: number, ty: number): Entry[] {
    const r = this.game.db.get<{ items: string }>('SELECT items FROM stalls WHERE key = ?', this.key(tx, ty));
    return r ? (JSON.parse(r.items) as Entry[]) : [];
  }

  private save(tx: number, ty: number, owner: number, items: Entry[]): void {
    this.game.db.run(
      'INSERT INTO stalls(key, owner, items) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET items = excluded.items, owner = excluded.owner',
      this.key(tx, ty),
      owner,
      JSON.stringify(items),
    );
  }

  private stall(p: Player, tx: number, ty: number) {
    const s = this.game.chunks.structAt(tx, ty);
    if (!s || !STRUCTURES[s.id]?.stall) throw new GameError('Không có sạp hàng ở đây.');
    if (Math.hypot(tx + 0.5 - p.x, ty + 0.5 - p.y) > INTERACT_RANGE + 1) throw new GameError('Hãy lại gần sạp hơn.');
    return s;
  }

  isEmpty(tx: number, ty: number): boolean {
    return this.entries(tx, ty).length === 0;
  }

  view(p: Player, tx: number, ty: number): StallView {
    const s = this.stall(p, tx, ty);
    return { key: this.key(tx, ty), owner: this.game.charName(s.o), mine: s.o === p.charId, items: this.entries(tx, ty) };
  }

  put(p: Player, tx: number, ty: number, slot: number, qty: number, price: number): { ok: true } {
    if (!this.game.flags.stall) throw new GameError('Sạp hàng đang tạm dừng.');
    const s = this.stall(p, tx, ty);
    if (s.o !== p.charId) throw new GameError('Đây không phải sạp của bạn.');
    if (!Number.isInteger(price) || price < 1 || price > 10_000_000) throw new GameError('Giá không hợp lệ.');
    const it = p.inv[slot];
    if (!it || p.reserved.has(slot) || !Number.isInteger(qty) || qty < 1 || qty > it.n) throw new GameError('Vật phẩm không hợp lệ.');
    if (ITEMS[it.id]?.bound) throw new GameError('Vật phẩm khóa không bán được.');
    const items = this.entries(tx, ty);
    const used = new Set(items.map((e) => e.slot));
    let free = -1;
    for (let i = 0; i < STALL_SIZE; i++) if (!used.has(i)) {
      free = i;
      break;
    }
    if (free < 0) throw new GameError(`Sạp chỉ bày được ${STALL_SIZE} món.`);
    this.game.atomic([p], () => {
      const st = takeFromSlot(p.inv, slot, qty)!;
      items.push({ slot: free, stack: st, price });
      this.save(tx, ty, p.charId, items);
    });
    return { ok: true };
  }

  take(p: Player, tx: number, ty: number, slot: number): { ok: true } {
    const s = this.stall(p, tx, ty);
    if (s.o !== p.charId) throw new GameError('Đây không phải sạp của bạn.');
    const items = this.entries(tx, ty);
    const e = items.find((x) => x.slot === slot);
    if (!e) throw new GameError('Không có món này.');
    if (!canAddAll(p.inv, [e.stack])) throw new GameError('Túi đồ không đủ chỗ.');
    this.game.atomic([p], () => {
      addStack(p.inv, e.stack);
      this.save(tx, ty, p.charId, items.filter((x) => x !== e));
    });
    return { ok: true };
  }

  buy(p: Player, tx: number, ty: number, slot: number, key: string): { ok: true } {
    return this.game.idempotent(p, key, () => {
      if (!this.game.flags.stall) throw new GameError('Sạp hàng đang tạm dừng.');
      const s = this.stall(p, tx, ty);
      if (s.o === p.charId) throw new GameError('Đây là sạp của bạn.');
      const items = this.entries(tx, ty);
      const e = items.find((x) => x.slot === slot);
      if (!e) throw new GameError('Món này vừa được bán.');
      if (p.xu < e.price) throw new GameError('Không đủ Xu.');
      if (!canAddAll(p.inv, [e.stack])) throw new GameError('Túi đồ không đủ chỗ.');
      const tax = Math.max(0, Math.floor(e.price * STALL_TAX));
      void marketTax;
      this.game.atomic([p], () => {
        this.game.ledger.transfer(charWallet(p.charId), charWallet(s.o), e.price - tax, 'stall_sale', `stall@${tx},${ty}`);
        if (tax > 0) this.game.ledger.transfer(charWallet(p.charId), SYS.tax, tax, 'stall_tax', `stall@${tx},${ty}`);
        addStack(p.inv, e.stack);
        this.save(tx, ty, s.o, items.filter((x) => x !== e));
      });
      this.game.refreshWallet(p);
      const owner = this.game.byChar.get(s.o);
      if (owner) {
        this.game.refreshWallet(owner);
        this.game.note(owner, `${p.name} đã mua ${ITEMS[e.stack.id]?.name} ×${e.stack.n} ở sạp của bạn (+${e.price - tax} Xu).`, 'good');
      }
      return { ok: true as const };
    });
  }

  /** Sạp bị phá: trả hàng về hòm thư của chủ. */
  destroyed(tx: number, ty: number, owner: number): void {
    const items = this.entries(tx, ty);
    if (items.length > 0) {
      this.game.mail.sendSystem(owner, 'Sạp hàng bị phá', 'Hàng còn trên sạp được gửi trả về hòm thư.', items.map((e) => e.stack), 0, 'system');
    }
    this.game.db.run('DELETE FROM stalls WHERE key = ?', this.key(tx, ty));
  }
}
