import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  addStack,
  countItem,
  makeStack,
  MOBS,
  OBJECTS,
  type S2C,
  STRUCTURES,
  TILES,
} from '@suongdo/shared';
import { loadConfig } from '../src/config.ts';
import { Db } from '../src/db.ts';
import { Game } from '../src/game/game.ts';
import { damagePlayer } from '../src/game/combat.ts';
import { spawnMob } from '../src/game/mobs.ts';
import { Mob } from '../src/game/entities.ts';
import type { Player } from '../src/game/player.ts';

let game: Game;
let seq = 1;

function setup(): Game {
  const cfg = loadConfig({ dbPath: ':memory:', seed: 4242, tradeMinPlaytimeMin: 0, saveIntervalSec: 99999 });
  return new Game(cfg, new Db(':memory:'));
}

function join(name: string): { p: Player; msgs: S2C[] } {
  const id = game.db.run('INSERT INTO accounts(username, pass_hash, is_guest, created_at) VALUES (?, ?, 0, ?)', name, 'x', Date.now()).lastInsertRowid;
  const msgs: S2C[] = [];
  const ws = { readyState: 1, send: (s: string) => msgs.push(JSON.parse(s) as S2C), close() {} };
  const p = game.join(ws as never, { id, username: name, is_guest: 0, playtime_sec: 0 })!;
  return { p, msgs };
}

/** Đi tới gần (x, y) bằng các lệnh di chuyển thật (qua va chạm của máy chủ). */
function walkTo(p: Player, x: number, y: number, reach = 1.4): boolean {
  let stuck = 0;
  let side = 0;
  let lastX = p.x;
  let lastY = p.y;
  for (let i = 0; i < 1500; i++) {
    const dx = x - p.x;
    const dy = y - p.y;
    const d = Math.hypot(dx, dy);
    if (d <= reach) return true;
    let mx = dx / d;
    let my = dy / d;
    if (side > 0) {
      const s = side % 2 ? 1 : -1;
      [mx, my] = [mx * 0.3 - my * s, my * 0.3 + mx * s];
      side--;
    }
    p.inputs.push({ seq: seq++, mx, my, run: false, dash: false, a: Math.atan2(dy, dx) });
    p.inputs.push({ seq: seq++, mx, my, run: false, dash: false, a: Math.atan2(dy, dx) });
    game.tick();
    if (Math.hypot(p.x - lastX, p.y - lastY) < 0.02) {
      if (++stuck > 4) {
        side = 12 + Math.floor(Math.random() * 10);
        stuck = 0;
      }
    } else stuck = 0;
    lastX = p.x;
    lastY = p.y;
    p.stamina = 100;
    p.hunger = 90;
    p.thirst = 90;
  }
  return false;
}

/** Ô có vật thể loại id gần nhất. */
function findObject(p: Player, ids: string[], maxR = 40): { tx: number; ty: number } | null {
  let best: { tx: number; ty: number } | null = null;
  let bd = Infinity;
  for (let dy = -maxR; dy <= maxR; dy++) {
    for (let dx = -maxR; dx <= maxR; dx++) {
      const tx = Math.floor(p.x) + dx;
      const ty = Math.floor(p.y) + dy;
      const o = game.view.objectAt(tx, ty);
      if (!o || !ids.includes(o.id)) continue;
      const d = Math.hypot(dx, dy);
      if (d < bd) {
        bd = d;
        best = { tx, ty };
      }
    }
  }
  return best;
}

function hit(p: Player, tx: number, ty: number, times = 1): void {
  for (let i = 0; i < times; i++) {
    p.nextActionAt = 0;
    game.handle(p, { t: 'act', x: tx + 0.5, y: ty + 0.5 });
    game.tick();
  }
}

function gather(p: Player, ids: string[], item: string, want: number): void {
  for (let guard = 0; guard < 60 && countItem(p.inv, item) < want; guard++) {
    const o = findObject(p, ids);
    assert.ok(o, `không tìm thấy ${ids.join('/')}`);
    walkTo(p, o.tx + 0.5, o.ty + 0.5, 1.6);
    const def = game.view.objectAt(o.tx, o.ty);
    hit(p, o.tx, o.ty, Math.ceil((def?.hp ?? 1) / 3) + 2);
  }
  assert.ok(countItem(p.inv, item) >= want, `thu thập ${item}: ${countItem(p.inv, item)}/${want}`);
}

function freeTileNear(p: Player): { tx: number; ty: number } {
  for (let r = 2; r < 6; r++) {
    for (let a = 0; a < 16; a++) {
      const tx = Math.floor(p.x + Math.cos((a / 16) * Math.PI * 2) * r);
      const ty = Math.floor(p.y + Math.sin((a / 16) * Math.PI * 2) * r);
      const tile = TILES[game.view.tile(tx, ty)]!;
      if (!tile.water && !tile.solid && !game.view.objectAt(tx, ty) && !game.chunks.structAt(tx, ty)) return { tx, ty };
    }
  }
  throw new Error('không có ô trống');
}

beforeEach(() => {
  game = setup();
  seq = 1;
});

describe('lối chơi cơ bản', () => {
  it('nhặt đồ → chế rìu → chặt cây → đặt lửa trại → nấu ăn (chuỗi nhiệm vụ)', () => {
    const { p } = join('Sinh');
    const xu0 = p.xu;
    gather(p, ['twig'], 'wood', 6);
    gather(p, ['pebble'], 'stone', 6);
    gather(p, ['grass_tuft'], 'fiber', 4);
    assert.ok(p.quest.idx >= 1, 'nhiệm vụ 1 phải hoàn thành');
    game.handle(p, { t: 'craft', r: 'stone_axe', n: 1 });
    assert.equal(countItem(p.inv, 'stone_axe'), 1);
    assert.ok(p.quest.idx >= 2, 'nhiệm vụ rìu đá');
    // chặt cây bằng rìu
    const axe = p.inv.findIndex((s) => s?.id === 'stone_axe');
    game.handle(p, { t: 'sel', s: axe });
    const wood0 = countItem(p.inv, 'wood');
    const tree = findObject(p, ['tree', 'pine', 'dead_tree']);
    assert.ok(tree);
    walkTo(p, tree.tx + 0.5, tree.ty + 0.5, 1.6);
    hit(p, tree.tx, tree.ty, 8);
    assert.equal(game.view.objectAt(tree.tx, tree.ty), undefined, 'cây phải bị chặt');
    assert.ok(countItem(p.inv, 'wood') > wood0);
    assert.ok(p.inv[axe]!.d! < p.inv[axe]!.md!, 'rìu phải mòn');
    // lửa trại
    gather(p, ['twig', 'tree'], 'wood', 6);
    gather(p, ['pebble'], 'stone', 4);
    game.handle(p, { t: 'craft', r: 'campfire', n: 1 });
    const slot = p.inv.findIndex((s) => s?.id === 'campfire');
    assert.ok(slot >= 0);
    const at = freeTileNear(p);
    game.handle(p, { t: 'place', i: slot, tx: at.tx, ty: at.ty });
    const st = game.chunks.structAt(at.tx, at.ty);
    assert.equal(st?.id, 'campfire');
    assert.ok(st.fu! > game.time);
    assert.ok(p.quest.idx >= 3, 'nhiệm vụ lửa trại');
    // nấu & ăn
    addStack(p.inv, makeStack('raw_meat', 1, { now: game.time }));
    walkTo(p, at.tx + 0.5, at.ty + 0.5, 2);
    game.handle(p, { t: 'craft', r: 'cooked_meat', n: 1 });
    const cm = p.inv.findIndex((s) => s?.id === 'cooked_meat');
    assert.ok(cm >= 0, 'phải nướng được thịt');
    p.hunger = 40;
    p.nextUseAt = 0;
    game.handle(p, { t: 'use', i: cm });
    assert.ok(p.hunger > 60);
    assert.ok(p.quest.idx >= 4, 'nhiệm vụ ăn đồ nấu chín');
    assert.ok(p.xu > xu0);
    assert.ok(game.ledger.audit().ok);
  });

  it('chết rơi túi hành trang, hồi sinh ở trạm', () => {
    const { p, msgs } = join('Chet');
    addStack(p.inv, makeStack('wood', 30, { now: game.time }));
    damagePlayer(game, p, 500, 'Thử nghiệm', { pierce: true });
    assert.equal(p.alive, false);
    assert.equal(countItem(p.inv, 'wood'), 0);
    const bag = [...game.bags.values()].find((b) => b.owner === p.charId);
    assert.ok(bag);
    assert.equal(countItem(bag.slots, 'wood'), 30);
    assert.ok(msgs.some((m) => m.t === 'dead'));
    game.handle(p, { t: 'respawn', at: 'outpost' });
    assert.equal(p.alive, true);
    assert.ok(Math.hypot(p.x, p.y) < 30, 'hồi sinh ở Trạm Trung Tâm');
  });

  it('xây tường chặn người khác, tháo dỡ hoàn lại vật phẩm', () => {
    const { p } = join('Xay');
    const { p: q } = join('Khach');
    addStack(p.inv, makeStack('wood_wall', 1, { now: game.time }));
    const at = freeTileNear(p);
    game.handle(p, { t: 'place', i: p.inv.findIndex((s) => s?.id === 'wood_wall'), tx: at.tx, ty: at.ty });
    assert.equal(game.chunks.structAt(at.tx, at.ty)?.id, 'wood_wall');
    assert.ok(game.view.isSolid(at.tx, at.ty, q.charId));
    game.handle(p, { t: 'demolish', tx: at.tx, ty: at.ty });
    assert.equal(game.chunks.structAt(at.tx, at.ty), undefined);
    assert.equal(countItem(p.inv, 'wood_wall'), 1);
  });

  it('đánh quái rơi đồ, tự nhặt khi đi qua', () => {
    const { p } = join('San');
    const m = spawnMob(game, MOBS.rabbit!, p.x + 1, p.y);
    m.hp = 5;
    for (let i = 0; i < 5 && !m.removed; i++) {
      p.nextActionAt = 0;
      game.handle(p, { t: 'act', x: m.x, y: m.y });
    }
    assert.ok(m.removed, 'thỏ phải chết');
    const drop = [...game.items.values()][0];
    assert.ok(drop, 'phải rơi đồ');
    walkTo(p, drop.x, drop.y, 0.3);
    for (let i = 0; i < 6; i++) game.tick();
    assert.ok(countItem(p.inv, 'raw_meat') >= 1);
    assert.ok(p.skills.combat.xp > 0 || p.skills.combat.lv > 1);
  });

  it('cột lãnh thổ: chỉ chủ mở rương, trừ phí bảo trì mỗi ngày', () => {
    const { p } = join('Chu');
    const { p: q } = join('Trom');
    addStack(p.inv, makeStack('totem', 1, { now: game.time }));
    addStack(p.inv, makeStack('chest', 1, { now: game.time }));
    const at = freeTileNear(p);
    game.handle(p, { t: 'place', i: p.inv.findIndex((s) => s?.id === 'totem'), tx: at.tx, ty: at.ty });
    assert.equal(game.territories.list().length, 1);
    const c = freeTileNear(p);
    p.nextPlaceAt = 0;
    game.handle(p, { t: 'place', i: p.inv.findIndex((s) => s?.id === 'chest'), tx: c.tx, ty: c.ty });
    assert.equal(game.chunks.structAt(c.tx, c.ty)?.id, 'chest');
    q.x = c.tx + 1.5;
    q.y = c.ty + 0.5;
    const notes: S2C[] = [];
    q.ws = { readyState: 1, send: (s: string) => notes.push(JSON.parse(s) as S2C), close() {} } as never;
    game.handle(q, { t: 'ustruct', tx: c.tx, ty: c.ty });
    assert.equal(q.open, null, 'người lạ không mở được rương');
    const xu0 = game.ledger.balance(`c:${p.charId}`);
    game.territories.dailyUpkeep(99);
    assert.ok(game.ledger.balance(`c:${p.charId}`) < xu0, 'phải trừ phí bảo trì');
    assert.ok(game.ledger.audit().ok);
  });

  it('Đêm Sương Đỏ sinh quái theo đợt', () => {
    const { p } = join('Dem');
    game.time = 6 * 1200 + 899;
    for (let i = 0; i < 4; i++) game.tick();
    game.time = 6 * 1200 + 906;
    game.tick();
    assert.ok(p.bloodAlive, 'người chơi online được tính tham gia Đêm Sương Đỏ');
    const blood = [...game.mobs.values()].filter((m: Mob) => m.blood);
    assert.ok(blood.length > 0, 'phải có quái Đêm Sương Đỏ');
  });

  it('công trình cần nhiên liệu tắt khi hết, thêm gỗ thì cháy lại', () => {
    const { p } = join('Lua');
    addStack(p.inv, makeStack('campfire', 1, { now: game.time }));
    addStack(p.inv, makeStack('wood', 5, { now: game.time }));
    const at = freeTileNear(p);
    game.handle(p, { t: 'place', i: p.inv.findIndex((s) => s?.id === 'campfire'), tx: at.tx, ty: at.ty });
    const st = game.chunks.structAt(at.tx, at.ty)!;
    game.time += STRUCTURES.campfire!.fuel!.initial + 10;
    assert.ok(st.fu! < game.time, 'lửa phải tắt');
    walkTo(p, at.tx + 0.5, at.ty + 0.5, 1.8);
    game.handle(p, { t: 'ustruct', tx: at.tx, ty: at.ty });
    assert.ok(st.fu! > game.time, 'lửa phải cháy lại');
    assert.equal(countItem(p.inv, 'wood'), 4);
  });

  it('dữ liệu vật thể hợp lệ', () => {
    assert.ok(OBJECTS.tree && OBJECTS.pebble && OBJECTS.twig);
  });
});
