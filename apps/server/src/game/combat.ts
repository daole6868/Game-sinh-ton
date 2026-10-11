import {
  addSkillXp,
  armorReduction,
  type Drop,
  ITEMS,
  makeStack,
  nearestOutpost,
  OUTPOST_PLAZA_RADIUS,
  OUTPOST_SAFE_RADIUS,
  outpostById,
  ringOf,
  STRUCTURES,
  territoryAt,
  xpToNext,
  zoneOf,
  type SkillId,
  isBloodNight,
  type ItemStack,
  localIndex,
} from '@suongdo/shared';
import { Mob, MOB_STATE } from './entities.ts';
import type { Game } from './game.ts';
import type { Player } from './player.ts';
import { questEvent } from './quests.ts';
import type { ServerStruct } from './chunks.ts';
import { NEVER } from './chunks.ts';

export function inSafeZone(game: Game, x: number, y: number): boolean {
  return nearestOutpost(game.seed, x, y).dist <= OUTPOST_SAFE_RADIUS;
}

/** Người chơi a có được gây sát thương lên b không (luật PvP theo vùng). */
export function canHurtPlayer(game: Game, a: Player, b: Player): boolean {
  if (a === b || !b.alive || !a.alive) return false;
  if (inSafeZone(game, a.x, a.y) || inSafeZone(game, b.x, b.y)) return false;
  const zone = zoneOf(ringOf(b.x, b.y));
  switch (zone.pvp) {
    case 'off':
      return false;
    case 'flag':
      return a.pvp && b.pvp;
    case 'on':
      return !territoryAt(game.territoryList(), b.x, b.y);
    case 'full':
      return true;
  }
}

export function giveXp(game: Game, p: Player, skill: SkillId, xp: number): void {
  if (xp <= 0) return;
  const ups = addSkillXp(p.skills[skill], xp);
  if (ups > 0) {
    game.fx(p.x, p.y, { k: 'lvl', s: skill, lv: p.skills[skill].lv });
    p.send({ t: 'skills', s: p.skills });
  } else if (game.tickN % 4 === 0) {
    p.send({ t: 'skills', s: p.skills });
  }
  p.dirty = true;
}

export interface DamageOpts {
  poison?: number;
  bleed?: number;
  mist?: number;
  pierce?: boolean;
}

export function damagePlayer(game: Game, p: Player, amount: number, cause: string, opts: DamageOpts = {}, killer?: Player): void {
  if (!p.alive || amount <= 0) return;
  const t = game.time;
  const red = opts.pierce ? 0 : armorReduction(p.armor);
  const dmg = amount * (1 - red);
  p.hp -= dmg;
  p.lastCombatAt = Date.now();
  p.changed = game.tickN;
  // giáp mòn
  let broke = false;
  for (const slot of ['head', 'body'] as const) {
    const s = p.eq[slot];
    if (s && s.d !== undefined) {
      s.d -= 1;
      if (s.d <= 0) {
        p.eq[slot] = null;
        broke = true;
        game.note(p, `${ITEMS[s.id]?.name ?? s.id} đã hỏng!`, 'bad');
      }
    }
  }
  if (broke) game.invChanged(p);
  if (opts.poison && Math.random() < opts.poison) p.status.set('poison', t + 30);
  if (opts.bleed && Math.random() < opts.bleed) p.status.set('bleed', t + 20);
  if (opts.mist) p.mist = Math.min(100, p.mist + opts.mist * (1 - p.mistProt));
  game.fx(p.x, p.y, { k: 'hit', x: p.x, y: p.y, v: Math.round(dmg), c: 'p' });
  if (p.tradeId !== null) game.trades.cancelFor(p, 'Giao dịch bị hủy vì có người bị tấn công.');
  if (p.hp <= 0) killPlayer(game, p, cause, killer);
}

export function killPlayer(game: Game, p: Player, cause: string, killer?: Player): void {
  if (!p.alive) return;
  const t = game.time;
  p.alive = false;
  p.hp = 0;
  p.deathCause = cause;
  game.trades.cancelFor(p, `${p.name} đã gục ngã.`);
  if (p.open) {
    p.open = null;
    p.send({ t: 'cont', c: null });
  }
  // Rơi túi hành trang (toàn bộ túi đồ). Trang bị đang mặc giữ lại nhưng mất 10% độ bền.
  const slots = p.inv.map((s) => s);
  game.spawnBag(p, slots);
  p.inv = p.inv.map(() => null);
  for (const slot of ['head', 'body', 'mask'] as const) {
    const s = p.eq[slot];
    if (s && s.d !== undefined && s.md !== undefined) s.d = Math.max(1, s.d - s.md * 0.1);
  }
  // Mất 5% kinh nghiệm của cấp hiện tại
  for (const sk of Object.values(p.skills)) sk.xp = Math.max(0, sk.xp - Math.floor(xpToNext(sk.lv) * 0.05));
  p.stats.deaths++;
  if (isBloodNight(t)) p.stats.bloodStreak = 0;
  p.bloodAlive = false;
  p.nightAlive = false;
  p.status.clear();
  game.grid.remove(p);
  game.fx(p.x, p.y, { k: 'die', i: p.id });
  const days = (t - p.lifeStart) / 1200;
  if (killer) {
    killer.stats.kills++;
    game.broadcastNear(p.x, p.y, 60, { t: 'chat', ch: 'system', from: 'Hệ thống', text: `${p.name} đã bị ${killer.name} hạ gục.`, ts: Date.now() });
  } else {
    game.broadcastNear(p.x, p.y, 60, { t: 'chat', ch: 'system', from: 'Hệ thống', text: `${p.name} đã gục ngã (${cause}).`, ts: Date.now() });
  }
  if (game.cfg.hardcore) {
    game.db.tx(() => {
      game.db.run('UPDATE characters SET alive = 0 WHERE id = ?', p.charId);
      game.db.run('INSERT INTO hall_of_fame(name, days, cause, died_at) VALUES (?, ?, ?, ?)', p.name, days, cause, Date.now());
    });
    game.systemChat(`☠ ${p.name} đã chết vĩnh viễn sau ${days.toFixed(1)} ngày sống sót (${cause}).`);
  }
  p.dirty = true;
  game.invChanged(p);
  p.send({ t: 'skills', s: p.skills });
  p.send({ t: 'dead', cause, bed: !!p.spawn, hardcore: game.cfg.hardcore, days });
}

/** Tìm ô trống gần (x, y). */
export function findFreeNear(game: Game, x: number, y: number, maxR = 8): { x: number; y: number } | null {
  for (let r = 0; r <= maxR; r++) {
    for (let i = 0; i < 12 + r * 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const tx = Math.floor(x + Math.cos(a) * r);
      const ty = Math.floor(y + Math.sin(a) * r);
      if (game.isFreeTile(tx, ty)) return { x: tx + 0.5, y: ty + 0.5 };
    }
  }
  return null;
}

export function teleport(game: Game, p: Player, x: number, y: number): void {
  p.x = x;
  p.y = y;
  p.dashT = 0;
  p.inputs = [];
  p.ver++;
  p.changed = game.tickN;
  game.grid.update(p);
  game.updateChunkSubs(p, true);
  p.dirty = true;
}

export function respawn(game: Game, p: Player, at: 'bed' | 'outpost' | 'random'): void {
  if (p.alive) return;
  if (game.cfg.hardcore) {
    game.note(p, 'Chế độ Hardcore: hãy tạo nhân vật mới.', 'bad');
    return;
  }
  let pos: { x: number; y: number } | null = null;
  if (at === 'bed') {
    if (p.spawn) {
      const s = game.chunks.structAt(p.spawn.tx, p.spawn.ty);
      if (s && STRUCTURES[s.id]?.spawn) pos = findFreeNear(game, p.spawn.tx + 0.5, p.spawn.ty + 0.5, 3);
    }
    if (!pos) {
      p.spawn = null;
      game.note(p, 'Giường/túi ngủ của bạn không còn. Hồi sinh ở trạm gần nhất.', 'warn');
    }
  }
  if (!pos && at !== 'random') {
    let best = outpostById(game.seed, '0_0')!;
    let bd = Math.hypot(best.x - p.x, best.y - p.y);
    for (const id of p.discovered) {
      const o = outpostById(game.seed, id);
      if (!o) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    pos = findFreeNear(game, best.x + 0.5, best.y + OUTPOST_PLAZA_RADIUS - 3, 4);
  }
  if (!pos) pos = game.findSpawnPoint();
  p.alive = true;
  p.hp = 70;
  p.hunger = Math.max(p.hunger, 60);
  p.thirst = Math.max(p.thirst, 60);
  p.stamina = 100;
  p.bodyTemp = 37;
  p.mist = 0;
  p.status.clear();
  p.lifeStart = game.time;
  p.deathCause = '';
  teleport(game, p, pos.x, pos.y);
  p.send({ t: 'alive' });
  game.sendStats(p);
}

// ───────────────────────── quái ─────────────────────────

export function rollDrops(drops: Drop[], game: Game, luck = 0): ItemStack[] {
  const out: ItemStack[] = [];
  for (const d of drops) {
    if (d.chance !== undefined && Math.random() >= d.chance + luck) continue;
    let n = d.min + Math.floor(Math.random() * (d.max - d.min + 1));
    if (n <= 0) continue;
    if (ITEMS[d.item]?.durability !== undefined) {
      for (; n > 0; n--) out.push(makeStack(d.item, 1, { now: game.time, uid: () => game.uid() }));
    } else {
      out.push(makeStack(d.item, n, { now: game.time }));
    }
  }
  return out;
}

export function damageMob(game: Game, m: Mob, amount: number, attacker: Player | null, crit = false): void {
  if (m.removed || amount <= 0) return;
  m.hp -= amount;
  m.changed = game.tickN;
  game.fx(m.x, m.y, { k: 'hit', x: m.x, y: m.y, v: Math.round(amount), c: crit ? 'crit' : 'm' });
  if (attacker) {
    m.hitters.set(attacker.charId, (m.hitters.get(attacker.charId) ?? 0) + amount);
    if (m.def.behavior === 'neutral' || m.def.behavior === 'hostile') {
      m.angryAt = attacker.id;
      m.angryUntil = Date.now() + 20_000;
      m.target = attacker.id;
    } else {
      m.fleeUntil = Date.now() + 5000;
      m.angryAt = attacker.id;
      m.state = MOB_STATE.flee;
    }
  }
  if (m.hp <= 0) killMob(game, m, attacker);
}

export function killMob(game: Game, m: Mob, killer: Player | null): void {
  if (m.removed) return;
  const luck = killer ? killer.skills.gathering.lv * 0.001 : 0;
  for (const st of rollDrops(m.def.drops, game, luck)) game.dropItem(st, m.x, m.y);
  if (killer) {
    giveXp(game, killer, 'combat', Math.round(m.def.xp * (1 + (m.lv - 1) * 0.05)));
    if (m.def.behavior === 'hostile') {
      killer.stats.kills++;
      questEvent(game, killer, { kind: 'kill', mob: m.def.id, count: 1 });
    }
    if (m.def.boss) game.systemChat(`🏆 ${killer.name} đã hạ gục ${m.def.name} cấp ${m.lv}!`);
  }
  game.fx(m.x, m.y, { k: 'die', i: m.id });
  game.removeMob(m);
}

// ───────────────────────── công trình ─────────────────────────

/** Có phá được công trình của người khác ở đây không (chỉ Vùng Đỏ trở đi, ngoài trạm). */
export function canRaid(game: Game, p: Player, tx: number, ty: number, s: ServerStruct): boolean {
  if (s.o === p.charId) return false;
  if (ringOf(tx, ty) < 3) return false;
  if (inSafeZone(game, tx, ty)) return false;
  const terr = territoryAt(game.territoryList(), tx + 0.5, ty + 0.5);
  if (terr && (terr.o === p.charId || terr.auth.includes(p.charId))) return false;
  return true;
}

export function damageStructure(game: Game, tx: number, ty: number, amount: number, byPlayer?: Player): void {
  const s = game.chunks.structAt(tx, ty);
  if (!s) return;
  let dmg = amount;
  if (byPlayer && !game.byChar.get(s.o)?.ws) dmg *= 0.2; // bảo vệ khi chủ offline
  const before = s.hp;
  s.hp -= dmg;
  game.chunks.at(tx, ty).dirty = true;
  game.fx(tx + 0.5, ty + 0.5, { k: 'hit', x: tx + 0.5, y: ty + 0.5, v: Math.round(dmg), c: 'struct' });
  if (s.hp <= 0) {
    destroyStructure(game, tx, ty, true);
    return;
  }
  const max = STRUCTURES[s.id]?.hp ?? 100;
  if (Math.floor((before / max) * 10) !== Math.floor((s.hp / max) * 10)) game.chunkUpdate(tx, ty);
}

export function destroyStructure(game: Game, tx: number, ty: number, broken: boolean): void {
  const s = game.chunks.structAt(tx, ty);
  if (!s) return;
  const def = STRUCTURES[s.id];
  if (s.items) for (const it of s.items) if (it) game.dropItem(it, tx + 0.5, ty + 0.5);
  if (def?.totem) game.territories.removeAt(tx, ty);
  if (def?.stall) game.stalls.destroyed(tx, ty, s.o);
  game.chunks.setStruct(tx, ty, null);
  // cho phép vật thể tự nhiên mọc lại nếu trước đó bị chặn
  const at = game.chunks.at(tx, ty).rm.get(localIndex(tx, ty));
  if (at !== undefined && at >= NEVER) game.chunks.setRemoved(tx, ty, game.time + 1200);
  game.chunkUpdate(tx, ty);
  // đóng rương nếu đang mở
  for (const p of game.players.values()) {
    if (p.open?.kind === 'chest' && p.open.key === `${tx},${ty}`) {
      p.open = null;
      p.send({ t: 'cont', c: null });
    }
  }
  if (broken) game.fx(tx + 0.5, ty + 0.5, { k: 'snd', s: 'break', x: tx + 0.5, y: ty + 0.5 });
}

// ───────────────────────── đạn ─────────────────────────

export function updateProjectiles(game: Game, dt: number): void {
  if (game.projectiles.length === 0) return;
  const keep = [];
  for (const pr of game.projectiles) {
    let alive = true;
    const step = 0.25;
    let dist = Math.hypot(pr.vx, pr.vy) * dt;
    const sx = (pr.vx / Math.hypot(pr.vx, pr.vy)) * step;
    const sy = (pr.vy / Math.hypot(pr.vx, pr.vy)) * step;
    while (dist > 0 && alive) {
      const d = Math.min(step, dist);
      pr.x += sx * (d / step);
      pr.y += sy * (d / step);
      dist -= d;
      pr.left -= d;
      const tx = Math.floor(pr.x);
      const ty = Math.floor(pr.y);
      const st = game.chunks.structAt(tx, ty);
      if (st && STRUCTURES[st.id]?.solid) {
        alive = false;
        break;
      }
      const obj = game.view.objectAt(tx, ty);
      if (obj?.solid) {
        alive = false;
        break;
      }
      const shooter = game.players.get(pr.owner);
      for (const e of game.grid.query(pr.x, pr.y, 0.8)) {
        if (e.id === pr.owner || e.removed) continue;
        if (e instanceof Mob) {
          if (Math.hypot(e.x - pr.x, e.y - pr.y) <= e.def.radius + 0.2) {
            damageMob(game, e, pr.dmg, shooter ?? null);
            alive = false;
            break;
          }
        } else if (e.kind === 'p') {
          const victim = e as Player;
          if (shooter && canHurtPlayer(game, shooter, victim) && Math.hypot(e.x - pr.x, e.y - pr.y) <= 0.5) {
            damagePlayer(game, victim, pr.dmg, `Bị ${shooter.name} bắn hạ`, {}, shooter);
            alive = false;
            break;
          }
        }
      }
      if (pr.left <= 0) alive = false;
    }
    if (alive) keep.push(pr);
  }
  game.projectiles = keep;
}
