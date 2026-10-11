import {
  countItem,
  type EquipSlot,
  inventoryWeight,
  ITEMS,
  type LeaderRow,
  OUTPOST_PLAZA_RADIUS,
  outpostById,
  repairCost,
  SAFE_STORAGE_UNLOCK,
  STATION_RANGE,
  STRUCTURES,
  takeItem,
  type TravelView,
  travelFee,
  upgradeCost,
  cloneSlots,
} from '@suongdo/shared';
import { GameError } from '../db.ts';
import { findFreeNear, teleport } from '../game/combat.ts';
import type { Game } from '../game/game.ts';
import type { CharacterData, Player } from '../game/player.ts';
import { charWallet, SYS } from './ledger.ts';

function itemAt(p: Player, slot: number | EquipSlot) {
  if (typeof slot === 'number') return p.inv[slot] ?? null;
  return p.eq[slot] ?? null;
}

// ───────────────────────── sửa đồ (Thợ rèn) ─────────────────────────

export function repairQuote(game: Game, p: Player, outpost: string, slot: number | EquipSlot): { cost: number } {
  game.requireAtOutpost(p, outpost);
  const it = itemAt(p, slot);
  if (!it || it.d === undefined || it.md === undefined) throw new GameError('Món này không sửa được.');
  if (it.d >= it.md - 0.5) throw new GameError('Món này còn nguyên vẹn.');
  return { cost: repairCost(it.id, it.d, it.md) };
}

export function repair(game: Game, p: Player, outpost: string, slot: number | EquipSlot): { cost: number } {
  const { cost } = repairQuote(game, p, outpost, slot);
  if (typeof slot === 'number' && p.reserved.has(slot)) throw new GameError('Vật phẩm đang trong giao dịch.');
  game.atomic([p], () => {
    game.ledger.transfer(charWallet(p.charId), SYS.services, cost, 'repair', String(slot));
    const it = itemAt(p, slot)!;
    it.md = Math.max(1, Math.floor(it.md! * 0.95));
    it.d = it.md;
  });
  game.refreshWallet(p);
  game.note(p, `Đã sửa ${ITEMS[itemAt(p, slot)!.id]?.name} (-${cost} Xu). Độ bền tối đa giảm 5%.`, 'good');
  return { cost };
}

// ───────────────────────── dịch chuyển (Người dẫn đường) ─────────────────────────

function fee(p: Player, dist: number): number {
  return travelFee(dist) + Math.round(inventoryWeight(p.inv) * 2);
}

export function travelList(game: Game, p: Player, outpost: string): TravelView[] {
  game.requireAtOutpost(p, outpost);
  const here = outpostById(game.seed, outpost)!;
  const ids = new Set([...p.discovered, '0_0']);
  return [...ids]
    .map((id) => outpostById(game.seed, id))
    .filter((o): o is NonNullable<typeof o> => !!o)
    .map((o) => {
      const d = Math.hypot(o.x - here.x, o.y - here.y);
      return { id: o.id, name: o.name, x: o.x, y: o.y, ring: o.ring, fee: o.id === here.id ? 0 : fee(p, d), here: o.id === here.id };
    })
    .sort((a, b) => a.fee - b.fee);
}

export function travel(game: Game, p: Player, outpost: string, to: string): { fee: number } {
  game.requireAtOutpost(p, outpost);
  if (to === outpost) throw new GameError('Bạn đang ở đây rồi.');
  if (to !== '0_0' && !p.discovered.has(to)) throw new GameError('Bạn chưa khám phá trạm này.');
  if (Date.now() - p.lastCombatAt < 15_000) throw new GameError('Không thể dịch chuyển khi vừa giao chiến.');
  if (p.tradeId !== null) throw new GameError('Đang giao dịch.');
  const here = outpostById(game.seed, outpost)!;
  const dest = outpostById(game.seed, to);
  if (!dest) throw new GameError('Trạm không tồn tại.');
  const cost = fee(p, Math.hypot(dest.x - here.x, dest.y - here.y));
  game.atomic([p], () => {
    game.ledger.transfer(charWallet(p.charId), SYS.services, cost, 'travel', `${outpost}->${to}`);
  });
  const pos = findFreeNear(game, dest.x + 0.5, dest.y + OUTPOST_PLAZA_RADIUS - 3, 5) ?? { x: dest.x + 0.5, y: dest.y + 8.5 };
  teleport(game, p, pos.x, pos.y);
  game.refreshWallet(p);
  game.note(p, `Đã tới ${dest.name} (-${cost} Xu).`, 'good');
  return { fee: cost };
}

// ───────────────────────── kho an toàn (Thủ kho) ─────────────────────────

export function safeOpen(game: Game, p: Player, outpost: string): { unlocked: boolean; price: number } {
  game.requireAtOutpost(p, outpost);
  if (p.safeUnlocked) {
    p.open = { kind: 'safe', key: outpost, x: p.x, y: p.y };
    p.send({ t: 'cont', c: { id: 'safe', title: 'Kho an toàn', kind: 'safe', slots: p.safe } });
  }
  return { unlocked: p.safeUnlocked, price: SAFE_STORAGE_UNLOCK };
}

export function safeUnlock(game: Game, p: Player, outpost: string): { ok: true } {
  game.requireAtOutpost(p, outpost);
  if (p.safeUnlocked) return { ok: true };
  game.atomic([p], () => {
    game.ledger.transfer(charWallet(p.charId), SYS.services, SAFE_STORAGE_UNLOCK, 'safe_unlock', '');
    p.safeUnlocked = true;
  });
  game.refreshWallet(p);
  safeOpen(game, p, outpost);
  return { ok: true };
}

// ───────────────────────── cường hóa Cấp Sương (Lò Tinh thể) ─────────────────────────

export function upgrade(game: Game, p: Player, tx: number, ty: number, slot: number): { lv: number; cost: number } {
  const s = game.chunks.structAt(tx, ty);
  if (!s || STRUCTURES[s.id]?.station !== 'crystal_forge') throw new GameError('Cần dùng Lò Tinh thể.');
  if (Math.hypot(tx + 0.5 - p.x, ty + 0.5 - p.y) > STATION_RANGE + 1) throw new GameError('Hãy đứng gần Lò Tinh thể.');
  const it = p.inv[slot];
  if (!it || p.reserved.has(slot)) throw new GameError('Chọn một món trang bị trong túi.');
  const def = ITEMS[it.id];
  if (!def || def.durability === undefined || (!def.weapon && !def.armor && !def.tool) || (def.tier ?? 0) < 1) {
    throw new GameError('Chỉ cường hóa được vũ khí, giáp, công cụ từ bậc 1 (đồ sắt) trở lên.');
  }
  const lv = it.lv ?? 0;
  const cost = upgradeCost(lv);
  const avail = p.inv.map((x, i) => (p.reserved.has(i) ? null : x));
  if (countItem(avail, 'mist_crystal') < cost) throw new GameError(`Cần ${cost} Tinh thể Sương.`);
  const work = cloneSlots(p.inv);
  takeItem(work, 'mist_crystal', cost);
  const target = work[slot];
  if (!target || target.u !== it.u) throw new GameError('Vật phẩm đã thay đổi.');
  target.lv = lv + 1;
  p.inv = work;
  game.invChanged(p);
  game.note(p, `${def.name} đã lên Cấp Sương +${lv + 1}!`, 'good');
  return { lv: lv + 1, cost };
}

// ───────────────────────── nhiên liệu ─────────────────────────

export function addFuel(game: Game, p: Player, tx: number, ty: number, item: string): { until: number } {
  const s = game.chunks.structAt(tx, ty);
  const def = s ? STRUCTURES[s.id] : undefined;
  if (!s || !def?.fuel) throw new GameError('Công trình này không cần nhiên liệu.');
  if (Math.hypot(tx + 0.5 - p.x, ty + 0.5 - p.y) > 3.5) throw new GameError('Quá xa.');
  const secs = def.fuel.items[item];
  if (!secs) throw new GameError('Không dùng được làm nhiên liệu.');
  const work = cloneSlots(p.inv).map((x, i) => (p.reserved.has(i) ? null : x));
  if (!takeItem(work, item, 1)) throw new GameError(`Cần ${ITEMS[item]?.name}.`);
  takeItem(p.inv, item, 1);
  s.fu = Math.min(game.time + def.fuel.max, Math.max(s.fu ?? 0, game.time) + secs);
  game.chunks.at(tx, ty).dirty = true;
  game.chunkUpdate(tx, ty);
  game.invChanged(p);
  return { until: s.fu };
}

// ───────────────────────── bảng xếp hạng ─────────────────────────

export function leaderboard(game: Game, kind: 'days' | 'wealth' | 'ring' | 'blood' | 'hall'): LeaderRow[] {
  if (kind === 'hall') {
    return game.db
      .all<{ name: string; days: number }>('SELECT name, days FROM hall_of_fame ORDER BY days DESC LIMIT 20')
      .map((r) => ({ name: r.name, value: Math.round(r.days * 10) / 10, alive: false }));
  }
  if (kind === 'wealth') {
    return game.db
      .all<{ name: string; balance: number }>(
        "SELECT c.name, w.balance FROM wallets w JOIN characters c ON w.id = 'c:' || c.id WHERE c.alive = 1 ORDER BY w.balance DESC LIMIT 20",
      )
      .map((r) => ({ name: r.name, value: r.balance }));
  }
  const rows = game.db.all<{ id: number; name: string; data: string }>('SELECT id, name, data FROM characters WHERE alive = 1');
  const vals = rows.map((r) => {
    const online = game.byChar.get(r.id);
    const d = online ? online.toData(game.time) : (JSON.parse(r.data) as CharacterData);
    let value = 0;
    if (kind === 'days') value = d.alive ? Math.max(0, (game.time - d.lifeStart) / 1200) : 0;
    if (kind === 'ring') value = d.stats?.maxRing ?? 0;
    if (kind === 'blood') value = d.stats?.bloodBest ?? 0;
    return { name: r.name, value: Math.round(value * 10) / 10, alive: d.alive };
  });
  return vals.sort((a, b) => b.value - a.value).slice(0, 20);
}
