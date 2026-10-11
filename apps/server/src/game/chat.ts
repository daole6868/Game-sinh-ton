import type { ChatChannel } from '@suongdo/shared';
import { collides, ITEMS, makeStack, MOBS, PLAYER_RADIUS } from '@suongdo/shared';
import { charWallet, SYS } from '../economy/ledger.ts';
import { findFreeNear, teleport } from './combat.ts';
import { spawnMob } from './mobs.ts';
import type { Game } from './game.ts';
import type { Player } from './player.ts';

const BAD_WORDS = ['đm', 'dm', 'đéo', 'địt', 'vcl', 'vkl', 'cặc', 'lồn', 'fuck', 'shit'];

function filter(text: string): string {
  let out = text;
  for (const w of BAD_WORDS) {
    const re = new RegExp(`(^|[^\\p{L}])(${w})(?=[^\\p{L}]|$)`, 'giu');
    out = out.replace(re, (_m, pre: string, word: string) => pre + '*'.repeat(word.length));
  }
  return out;
}

const HELP = [
  'Lệnh chat:',
  '/w <tên> <tin nhắn> — nhắn riêng',
  '/pvp on|off — bật/tắt cờ PvP (Vùng Xám)',
  '/stuck — thoát khi bị kẹt',
  '/online — xem ai đang online',
].join('\n');

export function handleChat(game: Game, p: Player, ch: ChatChannel, raw: string): void {
  const now = Date.now();
  if (now - p.chatAt < 800) {
    game.note(p, 'Bạn gửi tin quá nhanh.', 'warn');
    return;
  }
  p.chatAt = now;
  const text = filter(String(raw).replace(/\s+/g, ' ').trim().slice(0, 200));
  if (!text) return;
  if (text.startsWith('/')) {
    command(game, p, text);
    return;
  }
  const msg = { t: 'chat' as const, ch, from: p.name, text, ts: now };
  if (ch === 'local') game.broadcastNear(p.x, p.y, 40, msg);
  else if (ch === 'global' || ch === 'trade') game.broadcast(msg);
}

function command(game: Game, p: Player, text: string): void {
  const [cmd, ...rest] = text.split(' ');
  switch (cmd!.toLowerCase()) {
    case '/w':
    case '/whisper': {
      const name = rest.shift() ?? '';
      const body = rest.join(' ');
      const to = game.playerByName(name);
      if (!to || !to.ws) {
        game.note(p, `${name} không online.`, 'warn');
        return;
      }
      to.send({ t: 'chat', ch: 'whisper', from: p.name, text: body, ts: Date.now() });
      p.send({ t: 'chat', ch: 'whisper', from: `→ ${to.name}`, text: body, ts: Date.now() });
      return;
    }
    case '/pvp':
      setPvp(game, p, (rest[0] ?? '').toLowerCase() === 'on');
      return;
    case '/stuck': {
      if (Date.now() - p.lastCombatAt < 30_000) {
        game.note(p, 'Không dùng được khi vừa giao chiến.', 'warn');
        return;
      }
      if (!collides(p.x, p.y, PLAYER_RADIUS, (tx, ty) => game.view.isSolid(tx, ty, p.charId))) {
        game.note(p, 'Bạn không bị kẹt.', 'info');
        return;
      }
      const pos = findFreeNear(game, p.x, p.y, 10);
      if (pos) teleport(game, p, pos.x, pos.y);
      return;
    }
    case '/online': {
      const names = [...game.players.values()].filter((q) => q.ws).map((q) => q.name);
      game.note(p, `${names.length} người online: ${names.slice(0, 40).join(', ')}`, 'info');
      return;
    }
    default:
      if (game.cfg.devCommands && devCommand(game, p, cmd!.toLowerCase(), rest)) return;
      p.send({ t: 'chat', ch: 'system', from: 'Hệ thống', text: HELP, ts: Date.now() });
  }
}

/** Lệnh thử nghiệm — chỉ hoạt động khi máy chủ chạy với DEV_COMMANDS=1. */
function devCommand(game: Game, p: Player, cmd: string, args: string[]): boolean {
  switch (cmd) {
    case '/tp': {
      const x = Number(args[0]);
      const y = Number(args[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !p.alive) return false;
      const pos = findFreeNear(game, x, y, 12) ?? { x, y };
      teleport(game, p, pos.x, pos.y);
      return true;
    }
    case '/give': {
      const id = args[0] ?? '';
      const n = Math.max(1, Math.min(1000, Number(args[1] ?? 1) || 1));
      if (!ITEMS[id]) return false;
      for (let i = 0; i < (ITEMS[id]!.durability ? n : 1); i++) game.giveOrDrop(p, makeStack(id, ITEMS[id]!.durability ? 1 : n, { now: game.time, uid: () => game.uid() }));
      game.invChanged(p);
      return true;
    }
    case '/time': {
      const t = Number(args[0]);
      if (!Number.isFinite(t)) return false;
      game.time = t;
      game.broadcast({ t: 'world', w: game.worldInfo() });
      return true;
    }
    case '/xu': {
      const n = Math.max(1, Math.min(1_000_000, Number(args[0] ?? 1000) || 1000));
      game.atomic([p], () => game.ledger.transfer(SYS.reward, charWallet(p.charId), n, 'dev'));
      game.refreshWallet(p);
      return true;
    }
    case '/spawn': {
      const def = MOBS[args[0] ?? ''];
      if (!def) return false;
      spawnMob(game, def, p.x + 3, p.y);
      return true;
    }
    case '/weather': {
      const k = args[0] as 'clear' | 'rain' | 'fog' | 'storm' | 'heat';
      if (!['clear', 'rain', 'fog', 'storm', 'heat'].includes(k)) return false;
      game.weather = { kind: k, until: Date.now() + 10 * 60_000 };
      game.broadcast({ t: 'world', w: game.worldInfo() });
      return true;
    }
  }
  return false;
}

export function setPvp(game: Game, p: Player, on: boolean): void {
  if (Date.now() - p.lastCombatAt < 10_000) {
    game.note(p, 'Không đổi cờ PvP khi vừa giao chiến.', 'warn');
    return;
  }
  p.pvp = on;
  p.ver++;
  p.dirty = true;
  game.note(p, on ? 'Đã BẬT cờ PvP: ở Vùng Xám bạn có thể đánh và bị đánh bởi người cũng bật cờ.' : 'Đã TẮT cờ PvP.', on ? 'warn' : 'info');
}
