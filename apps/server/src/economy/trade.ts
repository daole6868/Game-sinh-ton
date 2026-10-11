import {
  addStack,
  canAddAll,
  cloneSlots,
  type ItemStack,
  ITEMS,
  takeFromSlot,
  TRADE_COMBAT_LOCK_MS,
  TRADE_CONFIRM_DELAY_MS,
  TRADE_INVITE_DISTANCE,
  TRADE_MAX_DISTANCE,
  TRADE_TIMEOUT_MS,
  type TradeOfferView,
  type TradeView,
} from '@suongdo/shared';
import { GameError } from '../db.ts';
import type { Game } from '../game/game.ts';
import type { Player } from '../game/player.ts';
import { charWallet } from './ledger.ts';

interface Offer {
  slots: { i: number; n: number }[];
  xu: number;
}

interface Session {
  id: number;
  a: Player;
  b: Player;
  offers: Map<number, Offer>;
  locked: Set<number>;
  confirmed: Set<number>;
  confirmAt: number;
  created: number;
}

/**
 * Trao đổi trực tiếp: MỜI → MỞ → (hai bên KHÓA) → đếm ngược 3 giây → (hai bên XÁC NHẬN) → hoán đổi nguyên tử.
 * Mọi thay đổi đề nghị đều bỏ khóa của cả hai bên.
 */
export class Trades {
  private sessions = new Map<number, Session>();
  private nextId = 1;

  constructor(private game: Game) {}

  private get(p: Player): Session {
    const s = p.tradeId !== null ? this.sessions.get(p.tradeId) : undefined;
    if (!s) throw new GameError('Bạn không ở trong giao dịch nào.');
    return s;
  }

  invite(p: Player, targetEntity: number): { ok: true } {
    if (!this.game.flags.trade) throw new GameError('Giao dịch trực tiếp đang tạm dừng.');
    const t = this.game.players.get(targetEntity);
    if (!t || !t.ws || !t.alive || t === p) throw new GameError('Người chơi không hợp lệ.');
    if (!p.alive) throw new GameError('Bạn đã gục ngã.');
    if (Math.hypot(t.x - p.x, t.y - p.y) > TRADE_INVITE_DISTANCE) throw new GameError('Hãy đứng gần người kia hơn (≤ 5 ô).');
    if (p.tradeId !== null || t.tradeId !== null) throw new GameError('Một trong hai người đang giao dịch.');
    const now = Date.now();
    if (now - p.lastCombatAt < TRADE_COMBAT_LOCK_MS || now - t.lastCombatAt < TRADE_COMBAT_LOCK_MS) throw new GameError('Không thể giao dịch khi đang chiến đấu.');
    t.invites.set(p.id, now + 30_000);
    t.send({ t: 'trade_invite', from: { id: p.id, name: p.name } });
    this.game.note(p, `Đã gửi lời mời giao dịch tới ${t.name}.`, 'info');
    return { ok: true };
  }

  respond(p: Player, fromEntity: number, accept: boolean): { ok: true } {
    const exp = p.invites.get(fromEntity);
    p.invites.delete(fromEntity);
    const from = this.game.players.get(fromEntity);
    if (!exp || exp < Date.now() || !from || !from.ws) throw new GameError('Lời mời đã hết hạn.');
    if (!accept) {
      this.game.note(from, `${p.name} đã từ chối giao dịch.`, 'warn');
      return { ok: true };
    }
    if (p.tradeId !== null || from.tradeId !== null) throw new GameError('Một trong hai người đang giao dịch.');
    if (Math.hypot(from.x - p.x, from.y - p.y) > TRADE_MAX_DISTANCE) throw new GameError('Hai người đứng quá xa.');
    const s: Session = {
      id: this.nextId++,
      a: from,
      b: p,
      offers: new Map([
        [from.charId, { slots: [], xu: 0 }],
        [p.charId, { slots: [], xu: 0 }],
      ]),
      locked: new Set(),
      confirmed: new Set(),
      confirmAt: 0,
      created: Date.now(),
    };
    this.sessions.set(s.id, s);
    from.tradeId = s.id;
    p.tradeId = s.id;
    this.push(s);
    return { ok: true };
  }

  offer(p: Player, slots: { i: number; n: number }[], xu: number): { ok: true } {
    const s = this.get(p);
    const clean: { i: number; n: number }[] = [];
    const seen = new Set<number>();
    for (const sl of slots.slice(0, 12)) {
      const it = p.inv[sl.i];
      if (!it || seen.has(sl.i) || !Number.isInteger(sl.n) || sl.n < 1 || sl.n > it.n) throw new GameError('Vật phẩm không hợp lệ.');
      if (ITEMS[it.id]?.bound) throw new GameError(`${ITEMS[it.id]?.name} là vật phẩm khóa, không giao dịch được.`);
      seen.add(sl.i);
      clean.push({ i: sl.i, n: sl.n });
    }
    const x = Math.floor(xu);
    if (!(x >= 0) || x > p.xu) throw new GameError('Không đủ Xu.');
    s.offers.set(p.charId, { slots: clean, xu: x });
    // Đổi đề nghị ⇒ bỏ khóa & xác nhận của cả hai
    s.locked.clear();
    s.confirmed.clear();
    s.confirmAt = 0;
    this.updateReserved(s);
    this.push(s);
    return { ok: true };
  }

  lock(p: Player, lock: boolean): { ok: true } {
    const s = this.get(p);
    if (lock) s.locked.add(p.charId);
    else {
      s.locked.delete(p.charId);
      s.confirmed.clear();
    }
    s.confirmAt = s.locked.size === 2 ? Date.now() + TRADE_CONFIRM_DELAY_MS : 0;
    this.push(s);
    return { ok: true };
  }

  confirm(p: Player): { ok: true } {
    const s = this.get(p);
    if (s.locked.size < 2) throw new GameError('Cả hai bên phải khóa trước.');
    if (Date.now() < s.confirmAt) throw new GameError('Hãy kiểm tra kỹ — chờ vài giây rồi xác nhận.');
    s.confirmed.add(p.charId);
    if (s.confirmed.size === 2) this.execute(s);
    else this.push(s);
    return { ok: true };
  }

  cancel(p: Player): { ok: true } {
    if (p.tradeId === null) return { ok: true };
    this.cancelFor(p, `${p.name} đã hủy giao dịch.`);
    return { ok: true };
  }

  cancelFor(p: Player, reason: string): void {
    if (p.tradeId === null) return;
    const s = this.sessions.get(p.tradeId);
    if (!s) {
      p.tradeId = null;
      return;
    }
    this.close(s, reason);
  }

  private close(s: Session, reason: string | null): void {
    this.sessions.delete(s.id);
    for (const q of [s.a, s.b]) {
      q.tradeId = null;
      q.reserved.clear();
      q.invDirty = true;
      this.game.sendInv(q);
      q.send({ t: 'trade', v: null });
      if (reason) this.game.note(q, reason, 'warn');
    }
  }

  /** Kiểm tra định kỳ: khoảng cách, thời hạn, sống/chết, kết nối. */
  tick(now: number): void {
    for (const s of this.sessions.values()) {
      const { a, b } = s;
      if (!a.ws || !b.ws || !a.alive || !b.alive) this.close(s, 'Giao dịch bị hủy.');
      else if (Math.hypot(a.x - b.x, a.y - b.y) > TRADE_MAX_DISTANCE) this.close(s, 'Giao dịch bị hủy vì hai người đi quá xa nhau.');
      else if (now - s.created > TRADE_TIMEOUT_MS) this.close(s, 'Giao dịch hết thời gian.');
    }
    for (const p of this.game.players.values()) for (const [k, exp] of p.invites) if (exp < now) p.invites.delete(k);
  }

  private updateReserved(s: Session): void {
    for (const q of [s.a, s.b]) {
      q.reserved.clear();
      for (const sl of s.offers.get(q.charId)!.slots) q.reserved.set(sl.i, sl.n);
      q.invDirty = true;
      this.game.sendInv(q);
    }
  }

  private offerView(q: Player, o: Offer): TradeOfferView {
    const items = o.slots.map((sl) => ({ ...(q.inv[sl.i] as ItemStack), n: sl.n }));
    let value = o.xu;
    for (const it of items) value += this.game.market.refPrice(it.id) * it.n;
    return { slots: o.slots, items, xu: o.xu, value: Math.round(value) };
  }

  private push(s: Session): void {
    for (const [me, other] of [
      [s.a, s.b],
      [s.b, s.a],
    ] as const) {
      const v: TradeView = {
        id: s.id,
        other: { id: other.id, name: other.name },
        mine: this.offerView(me, s.offers.get(me.charId)!),
        theirs: this.offerView(other, s.offers.get(other.charId)!),
        myLock: s.locked.has(me.charId),
        theirLock: s.locked.has(other.charId),
        myConfirm: s.confirmed.has(me.charId),
        theirConfirm: s.confirmed.has(other.charId),
        confirmAt: s.confirmAt,
      };
      me.send({ t: 'trade', v });
    }
  }

  /** Hoán đổi nguyên tử: kiểm tra lại toàn bộ, chuyển đồ + Xu trong một transaction. */
  private execute(s: Session): void {
    const { a, b } = s;
    const oa = s.offers.get(a.charId)!;
    const ob = s.offers.get(b.charId)!;
    try {
      if (Math.hypot(a.x - b.x, a.y - b.y) > TRADE_MAX_DISTANCE) throw new GameError('Hai người đứng quá xa.');
      this.game.atomic([a, b], () => {
        const ia = cloneSlots(a.inv);
        const ib = cloneSlots(b.inv);
        const fromA: ItemStack[] = [];
        const fromB: ItemStack[] = [];
        for (const sl of oa.slots) {
          const t = takeFromSlot(ia, sl.i, sl.n);
          if (!t) throw new GameError(`${a.name} không còn đủ vật phẩm đã đưa ra.`);
          fromA.push(t);
        }
        for (const sl of ob.slots) {
          const t = takeFromSlot(ib, sl.i, sl.n);
          if (!t) throw new GameError(`${b.name} không còn đủ vật phẩm đã đưa ra.`);
          fromB.push(t);
        }
        if (!canAddAll(ia, fromB)) throw new GameError(`Túi của ${a.name} không đủ chỗ.`);
        if (!canAddAll(ib, fromA)) throw new GameError(`Túi của ${b.name} không đủ chỗ.`);
        for (const it of fromB) addStack(ia, it);
        for (const it of fromA) addStack(ib, it);
        this.game.ledger.transfer(charWallet(a.charId), charWallet(b.charId), oa.xu, 'trade', `trade#${s.id}`);
        this.game.ledger.transfer(charWallet(b.charId), charWallet(a.charId), ob.xu, 'trade', `trade#${s.id}`);
        a.inv = ia;
        b.inv = ib;
        this.game.db.run(
          'INSERT INTO trades(a, b, a_offer, b_offer, created_at) VALUES (?, ?, ?, ?, ?)',
          a.charId,
          b.charId,
          JSON.stringify({ items: fromA, xu: oa.xu }),
          JSON.stringify({ items: fromB, xu: ob.xu }),
          Date.now(),
        );
      });
    } catch (e) {
      this.close(s, e instanceof GameError ? `Giao dịch thất bại: ${e.message}` : 'Giao dịch thất bại.');
      if (!(e instanceof GameError)) console.error('[trade]', e);
      return;
    }
    this.close(s, null);
    for (const q of [a, b]) {
      this.game.refreshWallet(q);
      this.game.note(q, 'Giao dịch thành công!', 'good');
    }
  }
}
