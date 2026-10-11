import {
  isBloodNight,
  isNight,
  MOB_LIST,
  MOBS,
  type MobDef,
  mobDmg,
  mobHp,
  mobLevel,
  moveWithCollision,
  nearestOutpost,
  OUTPOST_SAFE_RADIUS,
  pickWeighted,
  ringOf,
  STRUCTURES,
  territoryAt,
  TILES,
  phaseOf,
} from '@suongdo/shared';
import { damagePlayer, damageStructure, damageMob, inSafeZone } from './combat.ts';
import { Mob, MOB_STATE } from './entities.ts';
import type { Game } from './game.ts';
import type { Player } from './player.ts';

export function spawnMob(game: Game, def: MobDef, x: number, y: number, blood = false): Mob {
  const ring = ringOf(x, y);
  const lv = mobLevel(ring, Math.random());
  const m = new Mob(game.newId(), def, lv, x, y, mobHp(def.hp, lv), mobDmg(def.dmg, lv));
  const { outpost } = nearestOutpost(game.seed, x, y);
  m.safeX = outpost.x + 0.5;
  m.safeY = outpost.y + 0.5;
  m.blood = blood;
  m.a = Math.random() * Math.PI * 2;
  game.addMob(m);
  return m;
}

function mobSolid(game: Game, m: Mob) {
  const r = OUTPOST_SAFE_RADIUS + 1;
  return (tx: number, ty: number): boolean => {
    if (game.view.isSolid(tx, ty, 0)) return true;
    const dx = tx + 0.5 - m.safeX;
    const dy = ty + 0.5 - m.safeY;
    return dx * dx + dy * dy <= r * r;
  };
}

function nearestPlayer(game: Game, x: number, y: number, maxD: number, filter?: (p: Player) => boolean): { p: Player; d: number } | null {
  let best: Player | null = null;
  let bd = maxD;
  for (const p of game.players.values()) {
    if (!p.alive) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= bd && (!filter || filter(p))) {
      bd = d;
      best = p;
    }
  }
  return best ? { p: best, d: bd } : null;
}

export function updateMobs(game: Game, dt: number, now: number): void {
  const night = isNight(game.time) || phaseOf(game.time) === 'dusk';
  for (const m of game.mobs.values()) {
    try {
      updateMob(game, m, dt, now, night);
    } catch (e) {
      console.error('[mob]', e);
      game.removeMob(m);
    }
  }
}

function updateMob(game: Game, m: Mob, dt: number, now: number, night: boolean): void {
  const def = m.def;
  const closest = nearestPlayer(game, m.x, m.y, 70);
  if (!closest) {
    if (!m.farSince) m.farSince = now;
    else if (now - m.farSince > 20_000) game.removeMob(m);
    return;
  }
  m.farSince = 0;

  // Quái chỉ ra ban đêm tan biến dưới ánh mặt trời
  if (def.night && !night && !m.blood) {
    m.hp -= m.maxHp * 0.08 * dt;
    m.changed = game.tickN;
    if (m.hp <= 0) {
      game.fx(m.x, m.y, { k: 'die', i: m.id });
      game.removeMob(m);
      return;
    }
  }

  // Bẫy chông
  if (game.tickN % 20 === m.id % 20) {
    const tx = Math.floor(m.x);
    const ty = Math.floor(m.y);
    const st = game.chunks.structAt(tx, ty);
    const trap = st ? STRUCTURES[st.id]?.trap : undefined;
    if (st && trap) {
      st.hp -= 4;
      game.chunks.at(tx, ty).dirty = true;
      if (st.hp <= 0) damageStructure(game, tx, ty, 1);
      damageMob(game, m, trap, game.byChar.get(st.o) ?? null);
      if (m.removed) return;
    }
  }

  // ── Chọn mục tiêu ──
  let target: Player | null = null;
  const angry = m.angryAt !== null && now < m.angryUntil;
  if (def.behavior === 'hostile' || angry) {
    if (angry) {
      const a = game.players.get(m.angryAt!);
      if (a && a.alive && Math.hypot(a.x - m.x, a.y - m.y) < 25 && !inSafeZone(game, a.x, a.y)) target = a;
    }
    if (!target && def.behavior === 'hostile') {
      const sightBase = m.blood ? 45 : def.sight * (night ? 1.25 : 1);
      const found = nearestPlayer(game, m.x, m.y, sightBase * 1.3, (p) => {
        if (inSafeZone(game, p.x, p.y)) return false;
        const sight = sightBase * (p.running ? 1.3 : 1) * (p.dashT > 0 ? 1.2 : 1);
        return Math.hypot(p.x - m.x, p.y - m.y) <= sight;
      });
      target = found?.p ?? null;
    }
  }

  let mx = 0;
  let my = 0;
  let speed = def.speed;
  let state: number = MOB_STATE.idle;

  // Thú hiền bỏ chạy
  if (!target && def.behavior !== 'hostile') {
    const threat = closest.d < def.sight * 0.6 && (closest.p.running || closest.d < 3) ? closest.p : null;
    if (threat || now < m.fleeUntil) {
      const from = threat ?? game.players.get(m.angryAt ?? -1) ?? closest.p;
      const dx = m.x - from.x;
      const dy = m.y - from.y;
      const l = Math.hypot(dx, dy) || 1;
      mx = dx / l;
      my = dy / l;
      speed *= 1.15;
      state = MOB_STATE.flee;
      if (threat) m.fleeUntil = now + 2500;
    }
  }

  if (target) {
    const dx = target.x - m.x;
    const dy = target.y - m.y;
    const d = Math.hypot(dx, dy);
    m.a = Math.atan2(dy, dx);
    // Đòn đập đất của trùm
    if (def.slam) {
      if (m.slamAt && now >= m.slamAt) {
        m.slamAt = 0;
        for (const p of game.players.values()) {
          if (p.alive && Math.hypot(p.x - m.x, p.y - m.y) <= def.slam.radius) {
            damagePlayer(game, p, def.slam.dmg * (m.dmg / Math.max(1, def.dmg)), `Bị ${def.name} nghiền nát`, { mist: def.mist });
          }
        }
      } else if (!m.slamAt && now >= m.nextSlam && d <= def.slam.radius) {
        m.slamAt = now + 800;
        m.nextSlam = now + def.slam.cd * 1000;
        game.fx(m.x, m.y, { k: 'slam', x: m.x, y: m.y, r: def.slam.radius });
      }
    }
    if (d <= def.attackRange + 0.3) {
      state = MOB_STATE.attack;
      if (now >= m.nextAttack) {
        m.nextAttack = now + def.attackCd * 1000;
        if (def.explode) {
          explode(game, m);
          return;
        }
        const dmg = m.dmg * (0.85 + Math.random() * 0.3);
        damagePlayer(game, target, dmg, `Bị ${def.name} giết`, { poison: def.poison, bleed: def.bleed, mist: def.mist });
        game.fx(m.x, m.y, { k: 'swing', i: m.id, a: m.a });
      }
    } else {
      state = MOB_STATE.chase;
      mx = dx / d;
      my = dy / d;
      if (m.blood) speed *= 1.1;
    }
  } else if (state === MOB_STATE.idle) {
    // Đi lang thang
    if (now >= m.wanderUntil) {
      if (Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2;
        m.wx = Math.cos(a);
        m.wy = Math.sin(a);
      } else {
        m.wx = 0;
        m.wy = 0;
      }
      m.wanderUntil = now + 1500 + Math.random() * 3500;
    }
    mx = m.wx;
    my = m.wy;
    speed *= 0.35;
    if (mx || my) state = MOB_STATE.wander;
  }

  // Né vật cản đơn giản: khi bị kẹt thì đi chéo sang bên một lúc
  if ((mx || my) && now < m.sideStepUntil) {
    const px = -my * m.sideDir;
    const py = mx * m.sideDir;
    mx = mx * 0.3 + px;
    my = my * 0.3 + py;
    const l = Math.hypot(mx, my) || 1;
    mx /= l;
    my /= l;
  }

  if (mx || my) {
    const ox = m.x;
    const oy = m.y;
    moveWithCollision(m, mx * speed * dt, my * speed * dt, def.radius, mobSolid(game, m));
    if (state === MOB_STATE.wander || state === MOB_STATE.flee) m.a = Math.atan2(my, mx);
    const moved = Math.hypot(m.x - ox, m.y - oy);
    if (moved < speed * dt * 0.3) {
      m.stuckT += dt;
      if (state === MOB_STATE.chase && m.stuckT > 0.4) {
        // Kẻ thù bị tường chặn: phá công trình phía trước
        const fx = Math.floor(m.x + mx * (def.radius + 0.6));
        const fy = Math.floor(m.y + my * (def.radius + 0.6));
        const st = game.chunks.structAt(fx, fy);
        if (st && STRUCTURES[st.id]?.solid) {
          state = MOB_STATE.attack;
          if (now >= m.nextAttack) {
            m.nextAttack = now + def.attackCd * 1000;
            damageStructure(game, fx, fy, m.dmg * (m.blood ? 2 : 1.2));
            game.fx(m.x, m.y, { k: 'swing', i: m.id, a: m.a });
          }
        } else if (m.stuckT > 0.8) {
          m.sideDir = Math.random() < 0.5 ? 1 : -1;
          m.sideStepUntil = now + 700;
          m.stuckT = 0;
        }
      } else if (state === MOB_STATE.wander && m.stuckT > 0.5) {
        m.wanderUntil = 0;
        m.stuckT = 0;
      }
    } else {
      m.stuckT = 0;
    }
    m.changed = game.tickN;
    game.grid.update(m);
  }
  if (m.state !== state) {
    m.state = state;
    m.changed = game.tickN;
  }
}

function explode(game: Game, m: Mob): void {
  const ex = m.def.explode!;
  game.fx(m.x, m.y, { k: 'boom', x: m.x, y: m.y, r: ex.radius });
  const mul = m.dmg > 0 ? 1 : mobDmg(1, m.lv);
  for (const p of game.players.values()) {
    if (p.alive && Math.hypot(p.x - m.x, p.y - m.y) <= ex.radius) {
      damagePlayer(game, p, ex.dmg * mul, `Bị ${m.def.name} nổ tung`, { poison: 0.7, mist: ex.mist });
    }
  }
  for (const { tx, ty } of game.chunks.structuresAround(m.x, m.y, ex.radius)) damageStructure(game, tx, ty, ex.dmg * 3);
  game.removeMob(m);
}

// ───────────────────────── sinh quái ─────────────────────────

function mobsNear(game: Game, x: number, y: number, r: number): Mob[] {
  return game.grid.query(x, y, r).filter((e): e is Mob => e instanceof Mob);
}

export function spawnTick(game: Game, _now: number): void {
  const night = isNight(game.time);
  const blood = isBloodNight(game.time);
  for (const p of game.players.values()) {
    if (!p.alive || !p.ws) continue;
    if (game.mobs.size > 600) return;
    const near = mobsNear(game, p.x, p.y, 40);
    const cap = (blood ? 24 : night ? 13 : 8) + Math.min(6, p.ring);
    if (near.length >= cap) continue;
    if (Math.random() > (night ? 0.75 : 0.5)) continue;
    trySpawnAround(game, p, night);
  }
}

function trySpawnAround(game: Game, p: Player, night: boolean): void {
  const ang = Math.random() * Math.PI * 2;
  const d = 22 + Math.random() * 16;
  const x = p.x + Math.cos(ang) * d;
  const y = p.y + Math.sin(ang) * d;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const tile = TILES[game.view.tile(tx, ty)]!;
  if (tile.solid || game.view.isSolid(tx, ty, 0)) return;
  if (nearestOutpost(game.seed, x, y).dist < OUTPOST_SAFE_RADIUS + 10) return;
  if (territoryAt(game.territoryList(), x, y)) return;
  const ring = ringOf(x, y);
  const cands = MOB_LIST.filter((m) => m.weight > 0 && m.tiles.includes(tile.key) && ring >= m.minRing && (!m.night || night));
  const def = pickWeighted(Math.random, cands, (m) => m.weight * (m.nocturnal ? (night ? 3 : 0.4) : 1) * (m.night ? 1.5 : 1));
  if (!def) return;
  if (def.boss) {
    // một trùm trong bán kính 150 ô
    for (const m of game.mobs.values()) if (m.def.boss && Math.hypot(m.x - x, m.y - y) < 150) return;
    game.broadcastNear(x, y, 80, { t: 'chat', ch: 'system', from: 'Hệ thống', text: `⚠ Có tiếng gầm vang dội... ${def.name} đang ở gần!`, ts: Date.now() });
  }
  const [a, b] = def.pack ?? [1, 1];
  const n = a + Math.floor(Math.random() * (b - a + 1));
  for (let i = 0; i < n; i++) {
    const sx = x + (Math.random() - 0.5) * 2;
    const sy = y + (Math.random() - 0.5) * 2;
    if (game.view.isSolid(Math.floor(sx), Math.floor(sy), 0)) continue;
    spawnMob(game, def, sx, sy);
  }
}

// ───────────────────────── Đêm Sương Đỏ ─────────────────────────

const bloodPoints = new Map<number, number>();

export function onBloodNightStart(game: Game): void {
  game.systemChat('🌕 ĐÊM SƯƠNG ĐỎ bắt đầu! Quái vật sẽ tràn tới theo 3 đợt. Hãy sống sót tới bình minh!');
  bloodPoints.clear();
  for (const p of game.players.values()) {
    if (!p.alive || !p.ws) continue;
    p.bloodAlive = true;
    let baseValue = 0;
    for (const t of game.territories.list()) {
      if (t.o !== p.charId) continue;
      baseValue += game.territories.baseValue(t);
    }
    const pts = (60 + 15 * p.stats.bloodStreak + 0.02 * baseValue) * (1 + 0.3 * ringOf(p.x, p.y));
    bloodPoints.set(p.charId, pts);
  }
}

export function onBloodNightWave(game: Game, idx: number): void {
  const share = [0.3, 0.35, 0.35][idx] ?? 0.3;
  game.systemChat(`Đợt quái thứ ${idx + 1}/3 đang tràn tới!`);
  for (const p of game.players.values()) {
    if (!p.alive || !p.ws || !p.bloodAlive) continue;
    let pts = (bloodPoints.get(p.charId) ?? 60) * share;
    const ring = ringOf(p.x, p.y);
    const pool = ['infected', 'wolf', ...(ring >= 1 ? ['runner'] : []), ...(ring >= 2 ? ['bloater'] : [])].map((id) => MOBS[id]!);
    if (idx === 2 && ring >= 3 && (bloodPoints.get(p.charId) ?? 0) > 300) {
      spawnBloodMob(game, p, MOBS.blood_herald!);
      pts -= 300;
    }
    let guard = 0;
    while (pts > 0 && guard++ < 60) {
      const def = pool[Math.floor(Math.random() * pool.length)]!;
      spawnBloodMob(game, p, def);
      pts -= def.waveCost ?? 10;
    }
  }
}

function spawnBloodMob(game: Game, p: Player, def: MobDef): void {
  for (let i = 0; i < 10; i++) {
    const ang = Math.random() * Math.PI * 2;
    const d = 16 + Math.random() * 10;
    const x = p.x + Math.cos(ang) * d;
    const y = p.y + Math.sin(ang) * d;
    if (game.view.isSolid(Math.floor(x), Math.floor(y), 0)) continue;
    if (nearestOutpost(game.seed, x, y).dist < OUTPOST_SAFE_RADIUS + 4) continue;
    const m = spawnMob(game, def, x, y, true);
    m.target = p.id;
    return;
  }
}
