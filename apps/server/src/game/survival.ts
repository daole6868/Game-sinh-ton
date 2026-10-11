import {
  ambientTemp,
  darkness,
  dayOf,
  MAX_CARRY_WEIGHT,
  mistDensity,
  nearestOutpost,
  OUTPOST_SAFE_RADIUS,
  ringOf,
  seasonOf,
  STRUCTURES,
  TILES,
} from '@suongdo/shared';
import { killPlayer } from './combat.ts';
import type { Game } from './game.ts';
import type { Player } from './player.ts';

const HUNGER_PER_SEC = 100 / 1800;
const THIRST_PER_SEC = 100 / 1200;

/** Cập nhật các chỉ số sinh tồn của người chơi (gọi mỗi tick). */
export function updateSurvival(game: Game, p: Player, dt: number): void {
  const t = game.time;
  const now = Date.now();
  const tx = Math.floor(p.x);
  const ty = Math.floor(p.y);
  const tile = TILES[game.view.tile(tx, ty)]!;

  // Lửa và sàn: tính lại mỗi 0.5 giây
  if (game.tickN % 10 === p.id % 10) {
    let fire = 0;
    for (const { s } of game.chunks.structuresAround(p.x, p.y, 4)) {
      const def = STRUCTURES[s.id];
      if (!def?.warmth) continue;
      if (def.fuel && !(s.fu && s.fu > t)) continue;
      fire = Math.max(fire, def.warmth);
    }
    p.fireWarmth = fire;
    const st = game.chunks.structAt(tx, ty);
    p.onFloor = !!st && !!STRUCTURES[st.id]?.floor;
  }

  // Ướt khi mưa (trừ khi ở cạnh lửa)
  const raining = game.weather.kind === 'rain' || game.weather.kind === 'storm';
  if (raining && p.fireWarmth === 0) p.status.set('wet', t + 25);
  if (p.fireWarmth > 0) p.status.delete('wet');

  // ── Thân nhiệt ──
  const season = seasonOf(dayOf(t));
  let eff = ambientTemp({ tileTemp: tile.temp, tileKey: tile.key, dark: darkness(t), season, weather: game.weather.kind });
  eff += p.warmth + p.fireWarmth;
  if (p.onFloor) eff += 3;
  if (p.has('warm', t)) eff += 10;
  if (p.has('wet', t)) eff -= 6;
  if (eff > 28) eff = Math.max(28, eff - p.cooling);
  p.ambient = eff;
  let target = 37;
  if (eff < 10) target = 37 - (10 - eff) * 0.12;
  else if (eff > 30) target = 37 + (eff - 30) * 0.12;
  const rate = 0.035 * dt;
  p.bodyTemp += Math.max(-rate, Math.min(rate, target - p.bodyTemp));

  // ── Đói, khát ──
  const surv = 1 - 0.003 * (p.skills.survival.lv - 1);
  const hot = p.bodyTemp > 38 || eff > 32;
  p.hunger = Math.max(0, p.hunger - HUNGER_PER_SEC * (p.running ? 1.5 : 1) * surv * dt);
  p.thirst = Math.max(0, p.thirst - THIRST_PER_SEC * (hot ? 1.6 : 1) * surv * dt);

  // ── Thể lực ──
  const maxStamina = p.hunger <= 0 ? 50 : 100;
  if (!p.running && now - p.lastStaminaUse > 700) p.stamina = Math.min(maxStamina, p.stamina + 18 * dt);
  if (p.stamina > maxStamina) p.stamina = maxStamina;

  // ── Nhiễm Sương ──
  const ring = ringOf(p.x, p.y);
  const safe = nearestOutpost(game.seed, p.x, p.y).dist <= OUTPOST_SAFE_RADIUS;
  const density = safe ? 0 : mistDensity(ring, tile.key === 'mist');
  if (safe) {
    p.mist = Math.max(0, p.mist - 0.6 * dt);
  } else if (density > 0) {
    p.mist = Math.min(100, p.mist + density * 0.45 * (1 - p.mistProt) * dt);
    const mask = p.eq.mask;
    if (mask && mask.d !== undefined) {
      mask.d -= dt * Math.min(2, density * 2);
      if (mask.d <= 0) {
        p.eq.mask = null;
        game.note(p, 'Mặt nạ của bạn đã hỏng! Lõi lọc giúp hồi độ bền mặt nạ.', 'bad');
        game.invChanged(p);
      } else if (game.tickN % 40 === 0) {
        p.invDirty = true;
        game.sendInv(p);
      }
    }
  } else {
    p.mist = Math.max(0, p.mist - 0.12 * dt);
  }

  // ── Đuốc trên tay cháy dần ──
  const held = p.held;
  if (held?.id === 'torch' && held.d !== undefined) {
    held.d -= dt;
    if (held.d <= 0) {
      p.inv[p.sel] = null;
      game.note(p, 'Đuốc đã tàn.', 'warn');
      game.invChanged(p);
    } else if (game.tickN % 40 === 0) {
      p.invDirty = true;
      game.sendInv(p);
    }
  }

  // ── Máu ──
  p.maxHp = Math.max(30, 100 - Math.max(0, p.mist - 80) * 2.5);
  let dmg = 0;
  let cause = '';
  if (p.hunger <= 0) {
    dmg += dt / 3;
    cause = 'Chết đói';
  }
  if (p.thirst <= 0) {
    dmg += dt / 2;
    cause = 'Chết khát';
  }
  if (p.bodyTemp < 35) {
    dmg += (35 - p.bodyTemp) * 0.4 * dt;
    cause = 'Chết rét';
  }
  if (p.bodyTemp > 39.5) {
    dmg += (p.bodyTemp - 39.5) * 0.5 * dt;
    cause = 'Sốc nhiệt';
  }
  const poisoned = p.has('poison', t);
  const bleeding = p.has('bleed', t);
  if (poisoned) {
    dmg += 0.6 * dt;
    cause = 'Ngộ độc';
  }
  if (bleeding) {
    dmg += 0.8 * dt;
    cause = 'Mất máu';
  }
  if (dmg > 0) {
    p.hp -= dmg;
  } else if (p.hunger > 60 && p.thirst > 40 && p.bodyTemp > 35.5 && p.bodyTemp < 38.5) {
    p.hp += (p.has('fed', t) ? 0.5 : 0.25) * dt;
  }
  if (p.hp > p.maxHp) p.hp = p.maxHp;
  p.changed = game.tickN;

  // ── Tốc độ ──
  let speed = 1;
  if (p.weight > MAX_CARRY_WEIGHT * 1.5) speed *= 0.5;
  else if (p.weight > MAX_CARRY_WEIGHT) speed *= 0.75;
  if (p.bodyTemp < 35) speed *= 0.85;
  if (poisoned) speed *= 0.9;
  p.speedMul = speed;

  for (const [k, until] of p.status) if (until <= t) p.status.delete(k);

  if (p.mist >= 100) {
    killPlayer(game, p, 'Biến dị vì Nhiễm Sương');
    return;
  }
  if (p.hp <= 0) killPlayer(game, p, cause || 'Gục ngã');
}
