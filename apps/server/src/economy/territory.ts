import {
  ITEMS,
  STRUCTURES,
  TERRITORY_RADIUS,
  type TerritoryInfo,
  UPKEEP_BASE,
  UPKEEP_DECAY_AFTER_DAYS,
  UPKEEP_PER_STRUCTURE,
} from '@suongdo/shared';
import { GameError } from '../db.ts';
import { damageStructure } from '../game/combat.ts';
import type { Game } from '../game/game.ts';
import type { Player } from '../game/player.ts';
import { charWallet, SYS } from './ledger.ts';

interface Row {
  id: number;
  owner: number;
  x: number;
  y: number;
  radius: number;
  auth: string;
  debt_days: number;
  last_upkeep_day: number;
}

const PLACE_PRICE: Record<string, number> = {};
for (const it of Object.values(ITEMS)) if (it.place) PLACE_PRICE[it.place] = it.price;

/** Lãnh thổ (Cột Lãnh Thổ): quyền sở hữu khu vực, phí bảo trì hằng ngày. */
export class Territories {
  private cache: TerritoryInfo[] = [];
  private debt = new Map<number, number>();

  constructor(private game: Game) {
    this.reload();
  }

  reload(): void {
    const rows = this.game.db.all<Row>('SELECT * FROM territories');
    this.cache = rows.map((r) => ({
      id: r.id,
      x: r.x,
      y: r.y,
      r: r.radius,
      o: r.owner,
      on: this.game.charName(r.owner),
      auth: JSON.parse(r.auth) as number[],
    }));
    this.debt = new Map(rows.map((r) => [r.id, r.debt_days]));
    this.game.view.territories = this.cache;
  }

  list(): TerritoryInfo[] {
    return this.cache;
  }

  private broadcast(): void {
    this.game.broadcast({ t: 'terr', l: this.cache });
  }

  create(p: Player, tx: number, ty: number): void {
    this.game.db.run(
      'INSERT INTO territories(owner, x, y, radius, auth, debt_days, last_upkeep_day, created_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?)',
      p.charId,
      tx,
      ty,
      TERRITORY_RADIUS,
      '[]',
      Date.now(),
    );
    this.reload();
    this.broadcast();
    this.game.note(p, `Đã lập lãnh thổ bán kính ${TERRITORY_RADIUS} ô. Phí bảo trì trừ tự động mỗi ngày game.`, 'good');
  }

  removeAt(tx: number, ty: number): void {
    this.game.db.run('DELETE FROM territories WHERE x = ? AND y = ?', tx, ty);
    this.reload();
    this.broadcast();
  }

  private byTotem(tx: number, ty: number): TerritoryInfo {
    const t = this.cache.find((c) => c.x === tx && c.y === ty);
    if (!t) throw new GameError('Không tìm thấy lãnh thổ.');
    return t;
  }

  structureCount(t: TerritoryInfo): number {
    return this.game.chunks.structuresAround(t.x + 0.5, t.y + 0.5, t.r).length;
  }

  upkeepCost(t: TerritoryInfo): number {
    return UPKEEP_BASE + UPKEEP_PER_STRUCTURE * this.structureCount(t);
  }

  baseValue(t: TerritoryInfo): number {
    let v = 0;
    for (const { s } of this.game.chunks.structuresAround(t.x + 0.5, t.y + 0.5, t.r)) v += PLACE_PRICE[s.id] ?? 0;
    return v;
  }

  info(p: Player, tx: number, ty: number) {
    const t = this.byTotem(tx, ty);
    if (Math.hypot(tx + 0.5 - p.x, ty + 0.5 - p.y) > 4) throw new GameError('Quá xa.');
    return {
      territory: t,
      authNames: t.auth.map((id) => ({ id, name: this.game.charName(id) })),
      upkeep: this.upkeepCost(t),
      debt: this.debt.get(t.id) ?? 0,
      structures: this.structureCount(t),
    };
  }

  setAuth(p: Player, tx: number, ty: number, name: string, add: boolean): { ok: true } {
    const t = this.byTotem(tx, ty);
    if (t.o !== p.charId) throw new GameError('Chỉ chủ lãnh thổ mới cấp quyền được.');
    const target = this.game.charIdByName(name.trim());
    if (!target) throw new GameError('Không tìm thấy người chơi.');
    if (target.id === p.charId) throw new GameError('Bạn đã là chủ.');
    const auth = new Set(t.auth);
    if (add) {
      if (auth.size >= 20) throw new GameError('Tối đa 20 người.');
      auth.add(target.id);
    } else auth.delete(target.id);
    this.game.db.run('UPDATE territories SET auth = ? WHERE id = ?', JSON.stringify([...auth]), t.id);
    this.reload();
    this.broadcast();
    return { ok: true };
  }

  /** Trừ phí bảo trì mỗi ngày game. Nợ quá 7 ngày ⇒ công trình xuống cấp dần. */
  dailyUpkeep(day: number): void {
    const rows = this.game.db.all<Row>('SELECT * FROM territories WHERE last_upkeep_day < ?', day);
    for (const r of rows) {
      const t = this.cache.find((c) => c.id === r.id);
      if (!t) continue;
      const cost = this.upkeepCost(t);
      let paid = false;
      try {
        this.game.atomic([], () => {
          this.game.ledger.transfer(charWallet(r.owner), SYS.upkeep, cost, 'upkeep', `terr#${r.id}`);
          this.game.db.run('UPDATE territories SET debt_days = 0, last_upkeep_day = ? WHERE id = ?', day, r.id);
        });
        paid = true;
      } catch {
        this.game.db.run('UPDATE territories SET debt_days = debt_days + 1, last_upkeep_day = ? WHERE id = ?', day, r.id);
      }
      const owner = this.game.byChar.get(r.owner);
      if (paid) {
        if (owner) {
          this.game.refreshWallet(owner);
          this.game.note(owner, `Đã trả ${cost} Xu phí bảo trì lãnh thổ.`, 'info');
        }
        continue;
      }
      const debt = r.debt_days + 1;
      if (owner) this.game.note(owner, `Không đủ Xu trả phí bảo trì (${cost} Xu). Nợ ${debt} ngày — quá ${UPKEEP_DECAY_AFTER_DAYS} ngày công trình sẽ xuống cấp!`, 'bad');
      if (debt > UPKEEP_DECAY_AFTER_DAYS) {
        for (const { tx, ty, s } of this.game.chunks.structuresAround(t.x + 0.5, t.y + 0.5, t.r)) {
          const max = STRUCTURES[s.id]?.hp ?? 100;
          damageStructure(this.game, tx, ty, max * 0.15);
        }
      }
    }
    this.reload();
  }
}
