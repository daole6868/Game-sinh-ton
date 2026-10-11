import type { C2S, ReqOp } from '@suongdo/shared';
import { z } from 'zod';
import { GameError } from '../db.ts';
import {
  closeContainer,
  handleAct,
  handleCraft,
  handleDemolish,
  handleDrop,
  handleMove,
  handlePickup,
  handlePlace,
  handleSelect,
  handleUse,
  handleUseStruct,
} from '../game/actions.ts';
import { handleChat, setPvp } from '../game/chat.ts';
import { respawn } from '../game/combat.ts';
import type { Game } from '../game/game.ts';
import type { Player } from '../game/player.ts';
import { addFuel, leaderboard, repair, repairQuote, safeOpen, safeUnlock, travel, travelList, upgrade } from '../economy/services.ts';

const num = z.number().finite();
const int = z.number().int();
const eqSlot = z.enum(['head', 'body', 'mask']);
const slotRef = z.object({ c: z.enum(['inv', 'eq', 'cont']), i: z.union([int.min(0).max(64), eqSlot]) });
const moveInput = z.object({ seq: int, mx: num.min(-1.01).max(1.01), my: num.min(-1.01).max(1.01), run: z.boolean(), dash: z.boolean(), a: num });
const role = z.enum(['general', 'smith', 'doctor', 'scrap', 'board', 'keeper', 'guide', 'market']);
const str = (max: number) => z.string().max(max);
const key = str(80);
const outpost = str(24);
const slotQty = z.array(z.object({ i: int.min(0).max(31), n: int.min(1).max(100_000) })).max(12);

const C2SSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('in'), i: z.array(moveInput).max(40) }),
  z.object({ t: z.literal('sel'), s: int }),
  z.object({ t: z.literal('act'), x: num, y: num }),
  z.object({ t: z.literal('use'), i: int }),
  z.object({ t: z.literal('mv'), from: slotRef, to: slotRef, n: int.optional() }),
  z.object({ t: z.literal('drop'), i: int, n: int.optional() }),
  z.object({ t: z.literal('craft'), r: str(40), n: int }),
  z.object({ t: z.literal('place'), i: int, tx: int, ty: int }),
  z.object({ t: z.literal('demolish'), tx: int, ty: int }),
  z.object({ t: z.literal('ustruct'), tx: int, ty: int }),
  z.object({ t: z.literal('pickup'), id: int }),
  z.object({ t: z.literal('close') }),
  z.object({ t: z.literal('chat'), ch: z.enum(['local', 'global', 'trade', 'whisper', 'system']), text: str(400) }),
  z.object({ t: z.literal('respawn'), at: z.enum(['bed', 'outpost', 'random']) }),
  z.object({ t: z.literal('newchar'), name: str(32) }),
  z.object({ t: z.literal('pvp'), on: z.boolean() }),
  z.object({ t: z.literal('req'), rid: int, op: str(32), a: z.unknown() }),
]);

/** Kiểm tra tham số cho từng loại yêu cầu. */
const REQ: { [K in ReqOp]: z.ZodTypeAny } = {
  shop: z.object({ outpost, role }),
  shop_buy: z.object({ outpost, role, item: str(40), qty: int }),
  shop_sell: z.object({ outpost, role, item: str(40), qty: int }),
  market_summary: z.object({ outpost }),
  market_book: z.object({ outpost, item: str(40) }),
  market_my: z.object({ outpost }),
  market_sell: z.object({ outpost, slot: int.min(0).max(31), qty: int, price: int, confirm: z.boolean().optional(), key }),
  market_buy: z.object({ outpost, item: str(40), qty: int, price: int, confirm: z.boolean().optional(), key }),
  market_buy_unique: z.object({ outpost, order: int, key }),
  market_cancel: z.object({ outpost, order: int }),
  mail_list: z.object({ outpost }),
  mail_claim: z.object({ outpost, id: int }),
  mail_return: z.object({ outpost, id: int }),
  mail_send: z.object({ outpost, to: str(32), subject: str(80), body: str(500), slots: slotQty, xu: int.min(0), cod: int.min(0), key }),
  contracts: z.object({ outpost }),
  contract_deliver: z.object({ outpost, id: str(32) }),
  travel_list: z.object({ outpost }),
  travel: z.object({ outpost, to: str(24) }),
  repair_quote: z.object({ outpost, slot: z.union([int.min(0).max(31), eqSlot]) }),
  repair: z.object({ outpost, slot: z.union([int.min(0).max(31), eqSlot]) }),
  upgrade: z.object({ tx: int, ty: int, slot: int.min(0).max(31) }),
  safe_open: z.object({ outpost }),
  safe_unlock: z.object({ outpost }),
  stall_view: z.object({ tx: int, ty: int }),
  stall_put: z.object({ tx: int, ty: int, slot: int.min(0).max(31), qty: int, price: int }),
  stall_take: z.object({ tx: int, ty: int, slot: int.min(0).max(16) }),
  stall_buy: z.object({ tx: int, ty: int, slot: int.min(0).max(16), key }),
  totem_info: z.object({ tx: int, ty: int }),
  totem_auth: z.object({ tx: int, ty: int, name: str(32), add: z.boolean() }),
  fuel: z.object({ tx: int, ty: int, item: str(40) }),
  trade_invite: z.object({ target: int }),
  trade_respond: z.object({ from: int, accept: z.boolean() }),
  trade_offer: z.object({ slots: slotQty, xu: int.min(0) }),
  trade_lock: z.object({ lock: z.boolean() }),
  trade_confirm: z.object({}).passthrough(),
  trade_cancel: z.object({}).passthrough(),
  leaderboard: z.object({ kind: z.enum(['days', 'wealth', 'ring', 'blood', 'hall']) }),
  price_ref: z.object({ items: z.array(str(40)).max(60) }),
  player_name: z.object({ id: int }),
};

/** Thao tác chỉ đọc — được phép khi đang trao đổi trực tiếp. */
const READ_ONLY = new Set<ReqOp>([
  'shop',
  'market_summary',
  'market_book',
  'market_my',
  'mail_list',
  'contracts',
  'travel_list',
  'repair_quote',
  'stall_view',
  'totem_info',
  'leaderboard',
  'price_ref',
  'player_name',
]);

/* eslint-disable @typescript-eslint/no-explicit-any */
function runReq(game: Game, p: Player, op: ReqOp, a: any): unknown {
  if (p.tradeId !== null && !op.startsWith('trade_') && !READ_ONLY.has(op)) {
    throw new GameError('Bạn đang trao đổi trực tiếp — hãy hoàn tất hoặc hủy trước.');
  }
  switch (op) {
    case 'shop':
      return game.shop.view(p, a.outpost, a.role);
    case 'shop_buy':
      return game.shop.buy(p, a.outpost, a.role, a.item, a.qty);
    case 'shop_sell':
      return game.shop.sell(p, a.outpost, a.role, a.item, a.qty);
    case 'market_summary':
      return game.market.summary(p, a.outpost);
    case 'market_book':
      return game.market.book(p, a.outpost, a.item);
    case 'market_my':
      return game.market.my(p, a.outpost);
    case 'market_sell':
      return game.market.placeSell(p, a);
    case 'market_buy':
      return game.market.placeBuy(p, a);
    case 'market_buy_unique':
      return game.market.buyUnique(p, a);
    case 'market_cancel':
      return game.market.cancel(p, a);
    case 'mail_list':
      return game.mail.list(p, a.outpost);
    case 'mail_claim':
      return game.mail.claim(p, a.outpost, a.id);
    case 'mail_return':
      return game.mail.returnMail(p, a.outpost, a.id);
    case 'mail_send':
      return game.mail.send(p, a);
    case 'contracts':
      return game.contracts.list(p, a.outpost);
    case 'contract_deliver':
      return game.contracts.deliver(p, a.outpost, a.id);
    case 'travel_list':
      return travelList(game, p, a.outpost);
    case 'travel':
      return travel(game, p, a.outpost, a.to);
    case 'repair_quote':
      return repairQuote(game, p, a.outpost, a.slot);
    case 'repair':
      return repair(game, p, a.outpost, a.slot);
    case 'upgrade':
      return upgrade(game, p, a.tx, a.ty, a.slot);
    case 'safe_open':
      return safeOpen(game, p, a.outpost);
    case 'safe_unlock':
      return safeUnlock(game, p, a.outpost);
    case 'stall_view':
      return game.stalls.view(p, a.tx, a.ty);
    case 'stall_put':
      return game.stalls.put(p, a.tx, a.ty, a.slot, a.qty, a.price);
    case 'stall_take':
      return game.stalls.take(p, a.tx, a.ty, a.slot);
    case 'stall_buy':
      return game.stalls.buy(p, a.tx, a.ty, a.slot, a.key);
    case 'totem_info':
      return game.territories.info(p, a.tx, a.ty);
    case 'totem_auth':
      return game.territories.setAuth(p, a.tx, a.ty, a.name, a.add);
    case 'fuel':
      return addFuel(game, p, a.tx, a.ty, a.item);
    case 'trade_invite':
      return game.trades.invite(p, a.target);
    case 'trade_respond':
      return game.trades.respond(p, a.from, a.accept);
    case 'trade_offer':
      return game.trades.offer(p, a.slots, a.xu);
    case 'trade_lock':
      return game.trades.lock(p, a.lock);
    case 'trade_confirm':
      return game.trades.confirm(p);
    case 'trade_cancel':
      return game.trades.cancel(p);
    case 'leaderboard':
      return leaderboard(game, a.kind);
    case 'price_ref': {
      const out: Record<string, number> = {};
      for (const id of a.items as string[]) out[id] = game.market.refPrice(id);
      return out;
    }
    case 'player_name':
      return { name: game.charName(a.id) };
  }
}

function rateLimited(game: Game, p: Player): boolean {
  const now = Date.now();
  if (now - p.msgWindow > 1000) {
    p.msgWindow = now;
    p.msgCount = 0;
  }
  p.msgCount++;
  if (p.msgCount > 400) {
    p.send({ t: 'kick', reason: 'Gửi quá nhiều dữ liệu.' });
    p.ws?.close();
    return true;
  }
  return p.msgCount > 120;
}

export function parseMessage(raw: unknown): C2S | null {
  const r = C2SSchema.safeParse(raw);
  return r.success ? (r.data as C2S) : null;
}

export function dispatch(game: Game, p: Player, msg: C2S): void {
  if (rateLimited(game, p)) return;
  try {
    switch (msg.t) {
      case 'in':
        for (const i of msg.i) if (i.seq > p.lastSeq) p.inputs.push(i);
        return;
      case 'sel':
        handleSelect(game, p, msg.s);
        return;
      case 'act':
        handleAct(game, p, msg.x, msg.y);
        return;
      case 'use':
        handleUse(game, p, msg.i);
        return;
      case 'mv':
        handleMove(game, p, msg.from, msg.to, msg.n);
        return;
      case 'drop':
        handleDrop(game, p, msg.i, msg.n);
        return;
      case 'craft':
        handleCraft(game, p, msg.r, msg.n);
        return;
      case 'place':
        handlePlace(game, p, msg.i, msg.tx, msg.ty);
        return;
      case 'demolish':
        handleDemolish(game, p, msg.tx, msg.ty);
        return;
      case 'ustruct':
        handleUseStruct(game, p, msg.tx, msg.ty);
        return;
      case 'pickup':
        handlePickup(game, p, msg.id);
        return;
      case 'close':
        closeContainer(game, p);
        return;
      case 'chat':
        handleChat(game, p, msg.ch, msg.text);
        return;
      case 'respawn':
        respawn(game, p, msg.at);
        return;
      case 'pvp':
        setPvp(game, p, msg.on);
        return;
      case 'newchar':
        // tạo nhân vật mới chỉ xử lý trước khi vào thế giới (xem server.ts)
        return;
      case 'req': {
        const schema = REQ[msg.op as ReqOp];
        if (!schema) {
          p.send({ t: 'res', rid: msg.rid, ok: false, err: 'Yêu cầu không hợp lệ.' });
          return;
        }
        const args = schema.safeParse(msg.a ?? {});
        if (!args.success) {
          p.send({ t: 'res', rid: msg.rid, ok: false, err: 'Tham số không hợp lệ.' });
          return;
        }
        try {
          const d = runReq(game, p, msg.op as ReqOp, args.data);
          p.send({ t: 'res', rid: msg.rid, ok: true, d });
        } catch (e) {
          if (e instanceof GameError) p.send({ t: 'res', rid: msg.rid, ok: false, err: e.message });
          else {
            console.error(`[req ${msg.op}]`, e);
            p.send({ t: 'res', rid: msg.rid, ok: false, err: 'Lỗi máy chủ, vui lòng thử lại.' });
          }
        }
        return;
      }
    }
  } catch (e) {
    if (e instanceof GameError) game.note(p, e.message, 'warn');
    else console.error(`[msg ${msg.t}]`, e);
  }
}
