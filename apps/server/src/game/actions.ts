import {
  addStack,
  BUILD_RANGE,
  canAddAll,
  cloneSlots,
  countItem,
  CROPS,
  dayOf,
  emptySlots,
  type EquipSlot,
  freshness,
  GATHER_RANGE,
  INTERACT_RANGE,
  type ItemStack,
  ITEMS,
  localIndex,
  makeStack,
  MAX_TOTEMS,
  nearestOutpost,
  type ObjectDef,
  OUTPOST_SAFE_RADIUS,
  PICKUP_RANGE,
  PLAYER_RADIUS,
  RECIPES_BY_ID,
  seasonOf,
  type Slot,
  type SlotRef,
  SPAWN_NO_BUILD_RADIUS,
  STATION_RANGE,
  type StationId,
  STRUCTURES,
  takeFromSlot,
  takeItem,
  takeItems,
  territoryAt,
  TERRITORY_RADIUS,
  TILES,
  upgradeMul,
  moveSlot,
  canStack,
  maxStack,
} from '@suongdo/shared';
import { GameError } from '../db.ts';
import type { ServerStruct } from './chunks.ts';
import { NEVER } from './chunks.ts';
import {
  canHurtPlayer,
  canRaid,
  damageMob,
  damagePlayer,
  damageStructure,
  destroyStructure,
  giveXp,
  rollDrops,
} from './combat.ts';
import { Bag, GroundItem, Mob } from './entities.ts';
import type { Game } from './game.ts';
import type { Player } from './player.ts';
import { questEvent } from './quests.ts';

const FIST = { dmg: 4, range: 1.3, cd: 0.45, arc: 1.4, stamina: 2 };
const COOKED = new Set(['cooked_meat', 'cooked_fish', 'cooked_mushroom', 'jerky', 'pumpkin_soup', 'canned_food']);

function reach(p: Player, tx: number, ty: number): number {
  return Math.hypot(tx + 0.5 - p.x, ty + 0.5 - p.y);
}

/** Người chơi có quyền dùng công trình/ô này không (chủ hoặc được cấp quyền trong lãnh thổ). */
export function hasAccess(game: Game, p: Player, tx: number, ty: number, s?: ServerStruct): boolean {
  if (s && s.o === p.charId) return true;
  const t = territoryAt(game.territoryList(), tx + 0.5, ty + 0.5);
  if (t) return t.o === p.charId || t.auth.includes(p.charId);
  return !s;
}

function wearTool(game: Game, p: Player, slot: number, amount = 1): void {
  const s = p.inv[slot];
  if (!s || s.d === undefined) return;
  s.d -= amount;
  if (s.d <= 0) {
    p.inv[slot] = null;
    game.note(p, `${ITEMS[s.id]?.name ?? s.id} đã hỏng!`, 'bad');
    game.invChanged(p);
  } else {
    p.invDirty = true;
  }
}

export function handleSelect(game: Game, p: Player, s: number): void {
  if (!Number.isInteger(s) || s < 0 || s > 7) return;
  p.sel = s;
  const id = p.held?.id;
  if (id !== p.lastHeldId) {
    p.lastHeldId = id;
    p.ver++;
  }
  p.dirty = true;
}

// ───────────────────────── hành động chính ─────────────────────────

export function handleAct(game: Game, p: Player, x: number, y: number): void {
  if (!p.alive) return;
  const now = Date.now();
  if (now < p.nextActionAt) return;
  if (Math.hypot(x - p.x, y - p.y) > 30) return;
  const ang = Math.atan2(y - p.y, x - p.x);
  p.a = ang;
  const held = p.held;
  const def = held ? ITEMS[held.id] : undefined;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const r = reach(p, tx, ty);

  if (def && (def.cat === 'food' || def.cat === 'drink' || def.cat === 'medicine')) {
    consume(game, p, p.sel);
    return;
  }
  if (def?.place) {
    handlePlace(game, p, p.sel, tx, ty);
    return;
  }
  if (def?.usable) {
    handleUse(game, p, p.sel);
    return;
  }
  if (def?.seed) {
    if (r <= INTERACT_RANGE + 0.6) handleUseStruct(game, p, tx, ty);
    return;
  }
  if (held?.id === 'waterskin' && game.view.isWater(tx, ty) && r <= 3) {
    const n = held.n;
    p.inv[p.sel] = { id: 'waterskin_dirty', n };
    game.note(p, `Đã múc ${n} bình nước bẩn. Đun sôi ở lửa trại cho an toàn.`, 'info');
    game.invChanged(p);
    p.nextActionAt = now + 500;
    return;
  }
  if (!held && game.view.isWater(tx, ty) && r <= 3) {
    p.thirst = Math.min(100, p.thirst + 12);
    if (Math.random() < 0.2) {
      p.status.set('poison', game.time + 25);
      game.note(p, 'Nước bẩn làm bạn đau bụng (Ngộ độc).', 'bad');
    }
    p.nextActionAt = now + 700;
    game.fx(tx + 0.5, ty + 0.5, { k: 'snd', s: 'drink', x: tx + 0.5, y: ty + 0.5 });
    questEvent(game, p, { kind: 'drink' });
    return;
  }
  if (def?.tool?.kind === 'rod') {
    if (game.view.isWater(tx, ty) && r <= 5) {
      p.nextActionAt = now + 2200;
      wearTool(game, p, p.sel);
      game.fx(tx + 0.5, ty + 0.5, { k: 'snd', s: 'splash', x: tx + 0.5, y: ty + 0.5 });
      if (Math.random() < 0.42 + p.skills.gathering.lv * 0.002) {
        game.giveOrDrop(p, makeStack('raw_fish', 1, { now: game.time }));
        game.note(p, 'Câu được một con cá!', 'good');
        giveXp(game, p, 'gathering', 3);
        game.invChanged(p);
        questEvent(game, p, { kind: 'have' });
      }
    }
    return;
  }
  const w = def?.weapon;
  if (w?.ranged) {
    shoot(game, p, held!, w, ang, now);
    return;
  }

  // ── cận chiến ──
  const weapon = w ?? FIST;
  p.nextActionAt = now + weapon.cd * 1000;
  const cost = weapon.stamina ?? 3;
  const weak = p.stamina < cost;
  p.stamina = Math.max(0, p.stamina - cost);
  p.lastStaminaUse = now;
  game.fx(p.x, p.y, { k: 'swing', i: p.id, a: ang });
  const mul = (held?.q ?? 1) * upgradeMul(held?.lv) * (1 + 0.005 * (p.skills.combat.lv - 1)) * (weak ? 0.5 : 1);
  const arc = weapon.arc ?? 1.2;
  let hits = 0;
  for (const e of game.grid.query(p.x, p.y, weapon.range + 1)) {
    if (e === p || e.removed || hits >= 3) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    let diff = Math.abs(Math.atan2(dy, dx) - ang);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (e instanceof Mob) {
      if (d > weapon.range + e.def.radius || (diff > arc / 2 && d > 0.7)) continue;
      const crit = Math.random() < 0.08;
      damageMob(game, e, weapon.dmg * mul * (0.9 + Math.random() * 0.2) * (crit ? 1.5 : 1), p, crit);
      hits++;
    } else if (e.kind === 'p') {
      const v = e as Player;
      if (d > weapon.range + 0.3 || (diff > arc / 2 && d > 0.7)) continue;
      if (!canHurtPlayer(game, p, v)) continue;
      damagePlayer(game, v, weapon.dmg * mul * (0.9 + Math.random() * 0.2), `Bị ${p.name} hạ gục`, {}, p);
      p.lastCombatAt = now;
      hits++;
    }
  }
  if (hits > 0) {
    if (held && def?.durability) wearTool(game, p, p.sel);
    return;
  }
  if (r <= GATHER_RANGE + 0.5) {
    const obj = game.view.objectAt(tx, ty);
    if (obj) {
      gather(game, p, tx, ty, obj);
      return;
    }
    const st = game.chunks.structAt(tx, ty);
    if (st && canRaid(game, p, tx, ty, st)) {
      damageStructure(game, tx, ty, weapon.dmg * mul, p);
      if (held && def?.durability) wearTool(game, p, p.sel);
    }
  }
}

function gather(game: Game, p: Player, tx: number, ty: number, obj: ObjectDef): void {
  const held = p.held;
  const tool = held ? ITEMS[held.id]?.tool : undefined;
  let power: number;
  if (obj.tool === 'any') {
    power = tool && tool.kind !== 'rod' ? tool.power : 3;
  } else if (tool?.kind === obj.tool) {
    if (tool.tier < obj.minTier) {
      game.note(p, `Cần ${obj.tool === 'axe' ? 'rìu' : 'cuốc chim'} bậc ${obj.minTier} trở lên (ví dụ đồ sắt).`, 'warn');
      return;
    }
    power = tool.power;
  } else {
    game.note(p, obj.tool === 'axe' ? `Cần rìu để chặt ${obj.name}.` : `Cần cuốc chim để đập ${obj.name}.`, 'warn');
    return;
  }
  power *= (1 + 0.005 * (p.skills.gathering.lv - 1)) * (held?.q ?? 1) * upgradeMul(held?.lv);
  if (obj.thorns && !tool) damagePlayer(game, p, obj.thorns, 'Bị gai xương rồng đâm', { pierce: true });
  const c = game.chunks.at(tx, ty);
  const i = localIndex(tx, ty);
  const hp = (c.objHp.get(i) ?? obj.hp) - power;
  game.fx(tx + 0.5, ty + 0.5, { k: 'gather', tx, ty });
  if (held && tool) wearTool(game, p, p.sel);
  if (hp > 0) {
    c.objHp.set(i, hp);
    return;
  }
  game.chunks.setRemoved(tx, ty, game.time + obj.respawn);
  game.chunkUpdate(tx, ty);
  const luck = p.skills.gathering.lv * 0.002;
  const drops = rollDrops(obj.drops, game, luck);
  if (drops[0] && Math.random() < p.skills.gathering.lv * 0.004) drops[0].n += 1;
  for (const d of drops) game.giveOrDrop(p, d);
  giveXp(game, p, 'gathering', obj.xp);
  game.invChanged(p);
  questEvent(game, p, { kind: 'have' });
}

function shoot(
  game: Game,
  p: Player,
  held: ItemStack,
  w: NonNullable<(typeof ITEMS)[string]['weapon']>,
  ang: number,
  now: number,
): void {
  const ranged = w.ranged!;
  if (countItem(p.inv, ranged.ammo) < 1) {
    game.note(p, `Hết ${ITEMS[ranged.ammo]?.name ?? ranged.ammo}.`, 'warn');
    p.nextActionAt = now + 400;
    return;
  }
  // không lấy đạn từ ô đang được đưa vào giao dịch
  takeItem(p.inv, ranged.ammo, 1);
  p.nextActionAt = now + w.cd * 1000;
  const mul = (held.q ?? 1) * upgradeMul(held.lv) * (1 + 0.005 * (p.skills.combat.lv - 1));
  const cx = Math.cos(ang);
  const cy = Math.sin(ang);
  game.projectiles.push({
    x: p.x + cx * 0.4,
    y: p.y + cy * 0.4,
    vx: cx * ranged.speed,
    vy: cy * ranged.speed,
    left: ranged.range,
    dmg: w.dmg * mul,
    owner: p.id,
    ownerChar: p.charId,
  });
  game.fx(p.x, p.y, { k: 'shot', x: p.x, y: p.y, a: ang, sp: ranged.speed, r: ranged.range, am: ranged.ammo });
  wearTool(game, p, p.sel);
  game.invChanged(p);
  if (ranged.loud) {
    for (const e of game.grid.query(p.x, p.y, 28)) {
      if (e instanceof Mob && e.def.behavior === 'hostile') {
        e.angryAt = p.id;
        e.angryUntil = now + 15_000;
      }
    }
  }
}

// ───────────────────────── dùng vật phẩm ─────────────────────────

export function consume(game: Game, p: Player, i: number): void {
  const s = p.inv[i];
  if (!s || !p.alive) return;
  const def = ITEMS[s.id];
  const food = def?.food;
  if (!def || !food) return;
  const now = Date.now();
  if (now < p.nextUseAt) return;
  if (p.reserved.has(i)) {
    game.note(p, 'Vật phẩm đang nằm trong giao dịch.', 'warn');
    return;
  }
  p.nextUseAt = now + 450;
  const t = game.time;
  const fr = freshness(s, t);
  const mul = fr >= 0.5 ? 1 : fr >= 0.2 ? 0.7 : 0.3;
  const cook = 1 + 0.005 * (p.skills.cooking.lv - 1);
  const pos = (v: number | undefined) => (v && v > 0 ? v * mul * cook : (v ?? 0));
  p.hunger = Math.max(0, Math.min(100, p.hunger + pos(food.hunger)));
  p.thirst = Math.max(0, Math.min(100, p.thirst + pos(food.thirst)));
  const heal = pos(food.hp);
  p.hp = Math.min(p.maxHp, p.hp + heal);
  if (heal > 0) game.fx(p.x, p.y, { k: 'hit', x: p.x, y: p.y, v: Math.round(heal), c: 'heal' });
  if (food.mist) p.mist = Math.max(0, Math.min(100, p.mist + food.mist));
  let poison = food.poison ?? 0;
  if (fr < 0.2) poison = Math.max(poison, 0.6);
  if (poison > 0 && Math.random() < poison) {
    p.status.set('poison', t + 30);
    game.note(p, fr < 0.2 ? 'Đồ ăn đã hỏng! Bạn bị ngộ độc.' : 'Bạn bị ngộ độc.', 'bad');
  }
  if (food.buff) p.status.set(food.buff.id, t + food.buff.secs);
  if ((food.hunger ?? 0) >= 25 && fr >= 0.5) p.status.set('fed', t + 120);
  for (const c of food.cure ?? []) p.status.delete(c);
  takeFromSlot(p.inv, i, 1);
  if (food.returns) game.giveOrDrop(p, makeStack(food.returns, 1, { now: t }));
  game.invChanged(p);
  if (COOKED.has(s.id)) questEvent(game, p, { kind: 'eat_cooked' });
  if (def.cat === 'drink') questEvent(game, p, { kind: 'drink' });
}

const BLOOD_CHEST_LOOT = [
  { item: 'mist_crystal', min: 2, max: 5, chance: 0.6 },
  { item: 'serum', min: 1, max: 1, chance: 0.3 },
  { item: 'canned_food', min: 2, max: 4, chance: 0.6 },
  { item: 'bullet', min: 6, max: 12, chance: 0.3 },
  { item: 'electronics', min: 1, max: 2, chance: 0.25 },
  { item: 'parts', min: 2, max: 3, chance: 0.4 },
  { item: 'iron_ingot', min: 3, max: 6, chance: 0.5 },
  { item: 'filter', min: 1, max: 2, chance: 0.3 },
];

export function handleUse(game: Game, p: Player, i: number): void {
  if (!p.alive || !Number.isInteger(i) || i < 0 || i >= p.inv.length) return;
  const s = p.inv[i];
  if (!s) return;
  const def = ITEMS[s.id];
  if (!def) return;
  if (p.reserved.has(i)) {
    game.note(p, 'Vật phẩm đang nằm trong giao dịch.', 'warn');
    return;
  }
  if (def.food) {
    consume(game, p, i);
    return;
  }
  if (def.armor) {
    const slot = def.armor.slot;
    const old = p.eq[slot];
    p.eq[slot] = s;
    p.inv[i] = old;
    game.invChanged(p);
    return;
  }
  if (s.id === 'filter') {
    const mask = p.eq.mask;
    if (!mask || mask.md === undefined) {
      game.note(p, 'Hãy đeo mặt nạ trước khi thay lõi lọc.', 'warn');
      return;
    }
    mask.d = mask.md;
    takeFromSlot(p.inv, i, 1);
    game.note(p, 'Đã thay lõi lọc — mặt nạ hồi đầy độ bền.', 'good');
    game.invChanged(p);
    return;
  }
  if (s.id === 'blood_chest') {
    takeFromSlot(p.inv, i, 1);
    const loot = rollDrops(BLOOD_CHEST_LOOT, game);
    if (loot.length === 0) loot.push(makeStack('canned_food', 2, { now: game.time }));
    for (const l of loot) game.giveOrDrop(p, l);
    game.note(p, `Mở Rương Sương Đỏ: ${loot.map((l) => `${ITEMS[l.id]?.name}×${l.n}`).join(', ')}`, 'good');
    game.invChanged(p);
    questEvent(game, p, { kind: 'have' });
    return;
  }
  // Công cụ, vũ khí, công trình trong túi: đưa lên ô thanh nhanh đang chọn
  if (i >= 8) {
    moveSlot(p.inv, i, p.inv, p.sel);
    game.invChanged(p);
  }
}

// ───────────────────────── chuyển đồ ─────────────────────────

interface Resolved {
  arr: Slot[];
  idx: number;
  kind: 'inv' | 'chest' | 'bag' | 'safe';
  onChange?: () => void;
}

function openContainerSlots(game: Game, p: Player): { arr: Slot[]; kind: 'chest' | 'bag' | 'safe'; onChange: () => void } | null {
  const o = p.open;
  if (!o) return null;
  if (Math.hypot(o.x - p.x, o.y - p.y) > 4.5 && o.kind !== 'safe') {
    p.open = null;
    p.send({ t: 'cont', c: null });
    return null;
  }
  if (o.kind === 'chest') {
    const [tx, ty] = o.key.split(',').map(Number) as [number, number];
    const s = game.chunks.structAt(tx, ty);
    if (!s?.items) return null;
    return {
      arr: s.items,
      kind: 'chest',
      onChange: () => {
        game.chunks.at(tx, ty).dirty = true;
        broadcastChest(game, tx, ty);
      },
    };
  }
  if (o.kind === 'bag') {
    const b = game.bags.get(Number(o.key));
    if (!b) return null;
    return {
      arr: b.slots,
      kind: 'bag',
      onChange: () => {
        game.groundDirty = true;
        if (b.isEmpty()) game.removeBag(b);
        else for (const q of game.players.values()) if (q.open?.kind === 'bag' && q.open.key === o.key) q.send({ t: 'cont', c: bagView(b) });
      },
    };
  }
  const { outpost, dist } = nearestOutpost(game.seed, p.x, p.y);
  if (outpost.id !== o.key || dist > OUTPOST_SAFE_RADIUS) {
    p.open = null;
    p.send({ t: 'cont', c: null });
    return null;
  }
  return { arr: p.safe, kind: 'safe', onChange: () => (p.dirty = true) };
}

export function bagView(b: Bag) {
  return { id: `bag:${b.id}`, title: `Túi hành trang của ${b.ownerName}`, kind: 'bag' as const, slots: b.slots };
}

function broadcastChest(game: Game, tx: number, ty: number): void {
  const s = game.chunks.structAt(tx, ty);
  for (const q of game.players.values()) {
    if (q.open?.kind === 'chest' && q.open.key === `${tx},${ty}`) {
      q.send({ t: 'cont', c: s?.items ? { id: `chest:${tx},${ty}`, title: STRUCTURES[s.id]?.name ?? 'Rương', kind: 'chest', slots: s.items } : null });
    }
  }
}

export function handleMove(game: Game, p: Player, from: SlotRef, to: SlotRef, n?: number): void {
  if (!p.alive) return;
  const cont = from.c === 'cont' || to.c === 'cont' ? openContainerSlots(game, p) : null;
  // ── trang bị ──
  if (from.c === 'eq' || to.c === 'eq') {
    if (from.c === 'eq' && to.c === 'eq') return;
    if (to.c === 'eq') {
      const slot = to.i as EquipSlot;
      if (!['head', 'body', 'mask'].includes(slot) || from.c !== 'inv') return;
      handleEquipFrom(game, p, from.i as number, slot);
      return;
    }
    const slot = from.i as EquipSlot;
    const item = p.eq[slot];
    if (!item || to.c !== 'inv') return;
    const ti = to.i as number;
    if (!Number.isInteger(ti) || ti < 0 || ti >= p.inv.length || p.reserved.has(ti)) return;
    const there = p.inv[ti];
    if (there && ITEMS[there.id]?.armor?.slot !== slot) return;
    p.inv[ti] = item;
    p.eq[slot] = there ?? null;
    game.invChanged(p);
    return;
  }
  const a = resolve(p, from, cont);
  const b = resolve(p, to, cont);
  if (!a || !b) return;
  if (a.kind === 'inv' && p.reserved.has(a.idx)) return;
  if (b.kind === 'inv' && p.reserved.has(b.idx)) return;
  if (a.kind === 'bag' && cont) {
    const bag = game.bags.get(Number(p.open!.key));
    if (bag && bag.owner !== p.charId && Date.now() < bag.ownerOnlyUntil) {
      game.note(p, 'Túi này chỉ chủ nhân được nhặt trong lúc này.', 'warn');
      return;
    }
  }
  if (b.kind === 'bag') return; // không bỏ đồ vào túi hành trang
  const qty = n !== undefined && Number.isInteger(n) && n > 0 ? n : undefined;
  if (!moveSlot(a.arr, a.idx, b.arr, b.idx, qty)) return;
  if (a.kind !== 'inv' || b.kind !== 'inv') cont?.onChange();
  game.invChanged(p);
  questEvent(game, p, { kind: 'have' });
}

function resolve(p: Player, ref: SlotRef, cont: { arr: Slot[]; kind: 'chest' | 'bag' | 'safe' } | null): Resolved | null {
  const i = ref.i as number;
  if (!Number.isInteger(i) || i < 0) return null;
  if (ref.c === 'inv') return i < p.inv.length ? { arr: p.inv, idx: i, kind: 'inv' } : null;
  if (ref.c === 'cont' && cont) return i < cont.arr.length ? { arr: cont.arr, idx: i, kind: cont.kind } : null;
  return null;
}

function handleEquipFrom(game: Game, p: Player, i: number, slot: EquipSlot): void {
  const s = p.inv[i];
  if (!s || p.reserved.has(i)) return;
  if (ITEMS[s.id]?.armor?.slot !== slot) {
    game.note(p, 'Không mặc được vào ô này.', 'warn');
    return;
  }
  p.inv[i] = p.eq[slot];
  p.eq[slot] = s;
  game.invChanged(p);
}

export function handleDrop(game: Game, p: Player, i: number, n?: number): void {
  if (!p.alive || !Number.isInteger(i) || p.reserved.has(i)) return;
  const s = p.inv[i];
  if (!s) return;
  const qty = n && n > 0 ? Math.min(n, s.n) : s.n;
  const st = takeFromSlot(p.inv, i, qty);
  if (!st) return;
  game.dropItem(st, p.x + Math.cos(p.a) * 0.9, p.y + Math.sin(p.a) * 0.9, p.charId);
  game.invChanged(p);
}

export function autoPickup(game: Game, p: Player, now: number): void {
  if (game.tickN % 3 !== p.id % 3) return;
  let got = false;
  for (const e of game.grid.query(p.x, p.y, PICKUP_RANGE)) {
    if (!(e instanceof GroundItem) || e.removed) continue;
    if (e.noPickupFor === p.charId && now < e.noPickupUntil) continue;
    const left = addStack(p.inv, { ...e.stack });
    if (left === e.stack.n) continue;
    got = true;
    if (left > 0) {
      e.stack.n = left;
      e.ver++;
      game.groundDirty = true;
    } else {
      game.removeItemEntity(e);
    }
  }
  if (got) {
    game.fx(p.x, p.y, { k: 'snd', s: 'pickup', x: p.x, y: p.y });
    game.invChanged(p);
    questEvent(game, p, { kind: 'have' });
  }
}

export function handlePickup(game: Game, p: Player, id: number): void {
  const b = game.bags.get(id);
  if (!b || !p.alive) return;
  if (Math.hypot(b.x - p.x, b.y - p.y) > INTERACT_RANGE + 0.5) return;
  if (b.owner !== p.charId && Date.now() < b.ownerOnlyUntil) {
    game.note(p, `Đây là túi của ${b.ownerName}. Người khác chỉ nhặt được sau ${Math.ceil((b.ownerOnlyUntil - Date.now()) / 60000)} phút.`, 'warn');
    return;
  }
  p.open = { kind: 'bag', key: String(b.id), x: b.x, y: b.y };
  p.send({ t: 'cont', c: bagView(b) });
}

export function closeContainer(_game: Game, p: Player): void {
  p.open = null;
}

// ───────────────────────── chế tạo ─────────────────────────

export function nearStation(game: Game, p: Player, station: StationId): boolean {
  for (const { s } of game.chunks.structuresAround(p.x, p.y, STATION_RANGE)) {
    const def = STRUCTURES[s.id];
    if (def?.station !== station) continue;
    if (def.fuel && !(s.fu && s.fu > game.time)) continue;
    return true;
  }
  return false;
}

export function handleCraft(game: Game, p: Player, recipeId: string, n: number): void {
  if (!p.alive) return;
  const r = RECIPES_BY_ID[recipeId];
  if (!r) return;
  if (p.tradeId !== null) throw new GameError('Đang giao dịch — hãy hoàn tất hoặc hủy trước.');
  const times = Math.max(1, Math.min(50, Math.floor(n)));
  if (r.station && !nearStation(game, p, r.station)) {
    throw new GameError(r.station === 'campfire' ? 'Cần đứng gần một lửa trại đang cháy.' : `Cần đứng gần ${STRUCTURES[r.station]?.name ?? r.station}.`);
  }
  // không dùng đồ đang nằm trong giao dịch
  const avail = cloneSlots(p.inv).map((s, i) => (p.reserved.has(i) ? null : s));
  for (const [id, need] of Object.entries(r.in)) {
    if (countItem(avail, id) < need * times) throw new GameError(`Thiếu ${ITEMS[id]?.name ?? id}.`);
  }
  const work = cloneSlots(p.inv);
  const taken = takeItems(work, r.in, times)!;
  void taken;
  const outputs: ItemStack[] = [];
  const lv = p.skills[r.skill].lv;
  for (let k = 0; k < times; k++) {
    for (const [id, cnt] of Object.entries(r.out)) {
      if (ITEMS[id]?.durability !== undefined) {
        for (let j = 0; j < cnt; j++) {
          const q = Math.min(1.2, 0.9 + Math.random() * 0.2 + lv * 0.001);
          outputs.push(makeStack(id, 1, { now: game.time, uid: () => game.uid(), quality: q }));
        }
      } else outputs.push(makeStack(id, cnt, { now: game.time }));
    }
  }
  if (!canAddAll(work, outputs)) throw new GameError('Túi đồ không đủ chỗ.');
  for (const o of outputs) addStack(work, o);
  p.inv = work;
  giveXp(game, p, r.skill, r.xp * times);
  game.invChanged(p);
  for (const id of Object.keys(r.out)) questEvent(game, p, { kind: 'craft', item: id });
  questEvent(game, p, { kind: 'have' });
}

// ───────────────────────── xây dựng ─────────────────────────

export function handlePlace(game: Game, p: Player, slot: number, tx: number, ty: number): void {
  if (!p.alive || !Number.isInteger(slot) || !Number.isInteger(tx) || !Number.isInteger(ty)) return;
  const s = p.inv[slot];
  if (!s || p.reserved.has(slot)) return;
  const itemDef = ITEMS[s.id];
  const sid = itemDef?.place;
  if (!sid) return;
  const def = STRUCTURES[sid]!;
  const now = Date.now();
  if (now < p.nextActionAt) return;
  if (reach(p, tx, ty) > BUILD_RANGE) throw new GameError('Quá xa để xây.');
  const tile = TILES[game.view.tile(tx, ty)]!;
  if (tile.solid || tile.water) throw new GameError('Không xây được trên mặt nước.');
  if (game.chunks.structAt(tx, ty)) throw new GameError('Ô này đã có công trình.');
  if (game.view.objectAt(tx, ty)) throw new GameError('Hãy dọn vật cản ở ô này trước.');
  const { dist } = nearestOutpost(game.seed, tx + 0.5, ty + 0.5);
  if (dist <= OUTPOST_SAFE_RADIUS + 4) throw new GameError('Không được xây trong khu vực trạm giao thương.');
  if (Math.hypot(tx, ty) < SPAWN_NO_BUILD_RADIUS) throw new GameError('Không được xây ở trung tâm thế giới.');
  const terr = territoryAt(game.territoryList(), tx + 0.5, ty + 0.5);
  if (terr && terr.o !== p.charId && !terr.auth.includes(p.charId)) throw new GameError(`Đây là lãnh thổ của ${terr.on}.`);
  if (def.solid) {
    for (const e of game.grid.query(tx + 0.5, ty + 0.5, 1.4)) {
      if (e.removed || e.kind === 'i' || e.kind === 'b') continue;
      const r = e.kind === 'm' ? (e as Mob).def.radius : PLAYER_RADIUS;
      if (e.x + r > tx && e.x - r < tx + 1 && e.y + r > ty && e.y - r < ty + 1) throw new GameError('Có người hoặc quái đang đứng ở đó.');
    }
  }
  if (def.totem) {
    const mine = game.territories.list().filter((t) => t.o === p.charId).length;
    if (mine >= MAX_TOTEMS) throw new GameError(`Mỗi người chỉ được có ${MAX_TOTEMS} Cột Lãnh Thổ.`);
    for (const t of game.territories.list()) {
      if (Math.hypot(t.x - tx, t.y - ty) < t.r + TERRITORY_RADIUS + 2) throw new GameError('Quá gần lãnh thổ khác.');
    }
    if (dist <= OUTPOST_SAFE_RADIUS + TERRITORY_RADIUS + 4) throw new GameError('Quá gần trạm giao thương.');
  }
  const hp = Math.round(def.hp * (1 + 0.005 * (p.skills.building.lv - 1)));
  const st: ServerStruct = { id: sid, hp, o: p.charId };
  if (def.fuel) st.fu = game.time + def.fuel.initial;
  if (def.container) st.items = emptySlots(def.container);
  if (def.totem || def.stall) st.on = p.name;
  if (def.farm) st.g = 0;
  takeFromSlot(p.inv, slot, 1);
  game.chunks.setStruct(tx, ty, st);
  // vật thể tự nhiên không được mọc lại dưới công trình
  const c = game.chunks.at(tx, ty);
  if (game.gen.baseObjectAt(tx, ty)) c.rm.set(localIndex(tx, ty), NEVER);
  if (def.totem) game.territories.create(p, tx, ty);
  if (def.spawn) {
    p.spawn = { tx, ty };
    game.note(p, 'Đã đặt điểm hồi sinh tại đây.', 'good');
  }
  p.nextActionAt = now + 200;
  game.chunkUpdate(tx, ty);
  giveXp(game, p, 'building', 2 + Math.round((itemDef.price ?? 10) / 50));
  game.invChanged(p);
  questEvent(game, p, { kind: 'place', structure: sid });
}

export function handleDemolish(game: Game, p: Player, tx: number, ty: number): void {
  if (!p.alive) return;
  const s = game.chunks.structAt(tx, ty);
  if (!s) return;
  if (reach(p, tx, ty) > BUILD_RANGE) throw new GameError('Quá xa.');
  if (!hasAccess(game, p, tx, ty, s) || (s.o !== p.charId && STRUCTURES[s.id]?.totem)) throw new GameError('Bạn không có quyền tháo công trình này.');
  const def = STRUCTURES[s.id]!;
  if (s.items?.some(Boolean)) throw new GameError('Hãy lấy hết đồ trong rương trước.');
  if (def.stall && !game.stalls.isEmpty(tx, ty)) throw new GameError('Hãy lấy hết hàng trên sạp trước.');
  const refund = s.hp >= def.hp * 0.5;
  destroyStructure(game, tx, ty, false);
  if (refund) {
    const item = Object.values(ITEMS).find((d) => d.place === s.id);
    if (item) game.giveOrDrop(p, makeStack(item.id, 1, { now: game.time }));
    game.invChanged(p);
  }
  if (p.spawn && p.spawn.tx === tx && p.spawn.ty === ty) p.spawn = null;
}

/** Cập nhật độ lớn cây trồng theo thời gian đã trôi qua. */
export function updateCrop(game: Game, s: ServerStruct): void {
  if (!s.cr) return;
  const crop = CROPS[s.cr];
  if (!crop) return;
  const last = s.gl ?? game.time;
  const dt = Math.max(0, game.time - last);
  const winter = seasonOf(dayOf(game.time)) === 3;
  const rate = (1 / crop.grow) * (winter ? 0.2 : 1) * (game.weather.kind === 'rain' ? 1.2 : 1);
  s.g = Math.min(1, (s.g ?? 0) + dt * rate);
  s.gl = game.time;
}

export function handleUseStruct(game: Game, p: Player, tx: number, ty: number): void {
  if (!p.alive) return;
  const s = game.chunks.structAt(tx, ty);
  if (!s) return;
  if (reach(p, tx, ty) > INTERACT_RANGE + 0.8) return;
  const def = STRUCTURES[s.id]!;
  if (def.container) {
    if (!hasAccess(game, p, tx, ty, s)) throw new GameError('Rương này đã khóa.');
    p.open = { kind: 'chest', key: `${tx},${ty}`, x: tx + 0.5, y: ty + 0.5 };
    p.send({ t: 'cont', c: { id: `chest:${tx},${ty}`, title: def.name, kind: 'chest', slots: s.items ?? [] } });
    return;
  }
  if (def.spawn) {
    if (!hasAccess(game, p, tx, ty, s)) throw new GameError('Đây không phải giường của bạn.');
    p.spawn = { tx, ty };
    p.dirty = true;
    game.note(p, 'Đã đặt điểm hồi sinh tại đây.', 'good');
    return;
  }
  if (def.fuel) {
    for (const [fuel, secs] of Object.entries(def.fuel.items)) {
      if (countItem(p.inv.map((x, i) => (p.reserved.has(i) ? null : x)), fuel) < 1) continue;
      takeItem(p.inv, fuel, 1);
      const base = Math.max(s.fu ?? 0, game.time);
      s.fu = Math.min(game.time + def.fuel.max, base + secs);
      game.chunks.at(tx, ty).dirty = true;
      game.chunkUpdate(tx, ty);
      game.invChanged(p);
      game.note(p, `Đã thêm ${ITEMS[fuel]?.name}. Cháy thêm ${Math.round(secs / 60)} phút.`, 'info');
      return;
    }
    throw new GameError(`Cần ${Object.keys(def.fuel.items).map((f) => ITEMS[f]?.name).join(' hoặc ')} làm nhiên liệu.`);
  }
  if (def.farm) {
    if (!hasAccess(game, p, tx, ty, s)) throw new GameError('Luống trồng này không phải của bạn.');
    updateCrop(game, s);
    if (s.cr) {
      if ((s.g ?? 0) < 1) {
        game.note(p, `${CROPS[s.cr]?.name}: đã lớn ${Math.floor((s.g ?? 0) * 100)}%.`, 'info');
        return;
      }
      const crop = CROPS[s.cr]!;
      const bonus = 1 + 0.005 * (p.skills.farming.lv - 1);
      for (const y of crop.yield) {
        if (y.chance !== undefined && Math.random() >= y.chance) continue;
        const n = Math.round((y.min + Math.floor(Math.random() * (y.max - y.min + 1))) * bonus);
        if (n > 0) game.giveOrDrop(p, makeStack(y.item, n, { now: game.time }));
      }
      s.cr = undefined;
      s.g = 0;
      giveXp(game, p, 'farming', 8);
      game.note(p, `Thu hoạch ${crop.name}!`, 'good');
    } else {
      const held = p.held;
      const seed = held ? ITEMS[held.id]?.seed : undefined;
      if (!seed) throw new GameError('Cầm hạt giống trên tay rồi bấm vào luống để gieo.');
      if (p.reserved.has(p.sel)) return;
      takeFromSlot(p.inv, p.sel, 1);
      s.cr = seed;
      s.g = 0;
      s.gl = game.time;
      giveXp(game, p, 'farming', 2);
      game.note(p, `Đã gieo ${CROPS[seed]?.name}.${seasonOf(dayOf(game.time)) === 3 ? ' (Mùa đông: cây lớn rất chậm)' : ''}`, 'info');
    }
    game.chunks.at(tx, ty).dirty = true;
    game.chunkUpdate(tx, ty);
    game.invChanged(p);
    questEvent(game, p, { kind: 'have' });
  }
}

/** Cập nhật cây trồng trong các chunk đang tải (gọi định kỳ) và báo client khi đổi giai đoạn. */
export function tickCrops(game: Game): void {
  for (const c of game.chunks.chunks.values()) {
    for (const [i, s] of c.st) {
      if (!s.cr) continue;
      const before = Math.floor((s.g ?? 0) * 3);
      updateCrop(game, s);
      if (Math.floor((s.g ?? 0) * 3) !== before) {
        c.dirty = true;
        game.chunkUpdate(c.cx * 32 + (i % 32), c.cy * 32 + Math.floor(i / 32));
      }
    }
  }
}

export function canStackAny(a: ItemStack, b: ItemStack): boolean {
  return canStack(a, b) && b.n < maxStack(b.id);
}
