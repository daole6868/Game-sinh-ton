import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { addStack, countItem, type ItemStack, makeStack, targetStock } from '@suongdo/shared';
import { loadConfig } from '../src/config.ts';
import { Db, GameError } from '../src/db.ts';
import { charWallet, SYS } from '../src/economy/ledger.ts';
import { Game } from '../src/game/game.ts';
import type { Player } from '../src/game/player.ts';

let game: Game;

function setup(): Game {
  const cfg = loadConfig({ dbPath: ':memory:', seed: 12345, tradeMinPlaytimeMin: 0, saveIntervalSec: 99999 });
  return new Game(cfg, new Db(':memory:'));
}

function addPlayer(name: string, x = 0.5, y = 3.5): Player {
  const id = game.db.run('INSERT INTO accounts(username, pass_hash, is_guest, created_at) VALUES (?, ?, 0, ?)', name, 'x', Date.now()).lastInsertRowid;
  const ws = { readyState: 1, send() {}, close() {} };
  const p = game.join(ws as never, { id, username: name, is_guest: 0, playtime_sec: 0 })!;
  p.x = x;
  p.y = y;
  return p;
}

function give(p: Player, id: string, n: number): void {
  const left = addStack(p.inv, makeStack(id, n, { now: game.time, uid: () => game.uid() }));
  assert.equal(left, 0);
  p.dirty = true;
}

function grant(p: Player, xu: number): void {
  game.atomic([p], () => game.ledger.transfer(SYS.reward, charWallet(p.charId), xu, 'test'));
  game.refreshWallet(p);
}

function bal(p: Player): number {
  return game.ledger.balance(charWallet(p.charId));
}

/** Tổng số lượng vật phẩm trong mọi kho: túi, ký gửi sàn, hòm thư chưa nhận. */
function totalOf(id: string): number {
  let n = 0;
  for (const p of game.players.values()) n += countItem(p.inv, id) + countItem(p.safe, id);
  for (const r of game.db.all<{ qty_remaining: number; uniq: number }>("SELECT qty_remaining, uniq FROM market_orders WHERE side = 'sell' AND status = 'open' AND item_id = ?", id)) n += r.qty_remaining;
  for (const r of game.db.all<{ items: string }>('SELECT items FROM mail WHERE claimed_at IS NULL')) {
    for (const s of JSON.parse(r.items) as ItemStack[]) if (s.id === id) n += s.n;
  }
  return n;
}

function auditOk(): void {
  const a = game.ledger.audit();
  assert.ok(a.ok, `sổ cái lệch: ${JSON.stringify(a)}`);
}

beforeEach(() => {
  game = setup();
});

describe('cửa hàng NPC', () => {
  it('mua làm giảm tồn kho và tăng giá; bán thì ngược lại', () => {
    const a = addPlayer('An');
    grant(a, 1000);
    const before = game.shop.sellPrice('salt');
    const r = game.shop.buy(a, '0_0', 'general', 'salt', 50);
    assert.ok(r.paid > 0);
    assert.equal(countItem(a.inv, 'salt'), 50);
    assert.ok(game.shop.stockOf('salt') < targetStock('salt'));
    assert.ok(game.shop.sellPrice('salt') >= before);
    give(a, 'wood', 100);
    const xu0 = bal(a);
    const s = game.shop.sell(a, '0_0', 'general', 'wood', 100);
    assert.equal(bal(a), xu0 + s.got);
    assert.equal(countItem(a.inv, 'wood'), 0);
    auditOk();
  });
  it('phải đứng trong trạm', () => {
    const a = addPlayer('Binh', 300, 300);
    assert.throws(() => game.shop.view(a, '0_0', 'general'), GameError);
  });
  it('không đủ tiền thì không mất gì', () => {
    const a = addPlayer('Cuc');
    const xu0 = bal(a);
    assert.throws(() => game.shop.buy(a, '0_0', 'smith', 'iron_sword', 5), GameError);
    assert.equal(bal(a), xu0);
    assert.equal(countItem(a.inv, 'iron_sword'), 0);
    auditOk();
  });
});

describe('sàn giao dịch', () => {
  it('khớp lệnh theo giá của lệnh đặt trước, trả lại phần chênh, thu thuế', () => {
    const seller = addPlayer('Hung');
    const buyer = addPlayer('Lan');
    give(seller, 'wood', 50);
    grant(buyer, 5000);
    const s0 = bal(seller);
    const b0 = bal(buyer);
    const sell = game.market.placeSell(seller, { outpost: '0_0', slot: seller.inv.findIndex((x) => x?.id === 'wood'), qty: 50, price: 12, key: 'k1' });
    assert.ok(sell.order);
    const sellFee = s0 - bal(seller);
    assert.equal(sellFee, 6); // 1% của 600
    const buy = game.market.placeBuy(buyer, { outpost: '0_0', item: 'wood', qty: 30, price: 15, key: 'k2' });
    assert.equal(buy.filled, 30);
    assert.equal(buy.order, null);
    // người mua trả 30×12 + phí 1% của 450
    assert.equal(b0 - bal(buyer), 30 * 12 + 5);
    // người bán nhận 360 trừ 5% thuế
    assert.equal(bal(seller), s0 - sellFee + 360 - 18);
    assert.equal(totalOf('wood'), 50);
    // nhận hàng
    const mail = game.mail.list(buyer, '0_0');
    assert.equal(mail.length, 1);
    game.mail.claim(buyer, '0_0', mail[0]!.id);
    assert.equal(countItem(buyer.inv, 'wood'), 30);
    // hủy phần còn lại
    game.market.cancel(seller, { outpost: '0_0', order: sell.order! });
    const back = game.mail.list(seller, '0_0');
    game.mail.claim(seller, '0_0', back[0]!.id);
    assert.equal(countItem(seller.inv, 'wood'), 20);
    assert.equal(totalOf('wood'), 50);
    auditOk();
  });

  it('lệnh mua đặt trước: lệnh bán đến sau khớp theo giá mua', () => {
    const a = addPlayer('Minh');
    const b = addPlayer('Tu');
    grant(a, 5000);
    give(b, 'iron_ore', 40);
    game.market.placeBuy(a, { outpost: '0_0', item: 'iron_ore', qty: 40, price: 40, key: 'x1' });
    const escrow = game.ledger.balance(SYS.escrow);
    assert.equal(escrow, 1600);
    const r = game.market.placeSell(b, { outpost: '0_0', slot: b.inv.findIndex((x) => x?.id === 'iron_ore'), qty: 25, price: 30, key: 'x2' });
    assert.equal(r.filled, 25);
    assert.equal(game.ledger.balance(SYS.escrow), 1600 - 25 * 40);
    assert.equal(totalOf('iron_ore'), 40);
    auditOk();
  });

  it('niêm yết và mua đồ độc nhất', () => {
    const a = addPlayer('Dung');
    const b = addPlayer('Hoa');
    give(a, 'stone_axe', 1);
    grant(b, 1000);
    const slot = a.inv.findIndex((x) => x?.id === 'stone_axe');
    const uid = a.inv[slot]!.u;
    const r = game.market.placeSell(a, { outpost: '0_0', slot, qty: 1, price: 100, key: 'u1' });
    const a0 = bal(a);
    game.market.buyUnique(b, { outpost: '0_0', order: r.order!, key: 'u2' });
    assert.equal(bal(a), a0 + 95);
    const m = game.mail.list(b, '0_0');
    assert.equal(m[0]!.items[0]!.u, uid);
    assert.throws(() => game.market.buyUnique(b, { outpost: '0_0', order: r.order!, key: 'u3' }), GameError);
    auditOk();
  });

  it('gửi lặp cùng khóa chỉ thực hiện một lần', () => {
    const a = addPlayer('Khoa');
    grant(a, 5000);
    const r1 = game.market.placeBuy(a, { outpost: '0_0', item: 'stone', qty: 10, price: 9, key: 'same' });
    const r2 = game.market.placeBuy(a, { outpost: '0_0', item: 'stone', qty: 10, price: 9, key: 'same' });
    assert.deepEqual(r1, r2);
    assert.equal(game.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM market_orders WHERE status = 'open'")!.n, 1);
    auditOk();
  });

  it('giá bất thường cần xác nhận', () => {
    const a = addPlayer('Phuc');
    give(a, 'iron_ingot', 5);
    grant(a, 100);
    const slot = a.inv.findIndex((x) => x?.id === 'iron_ingot');
    assert.throws(() => game.market.placeSell(a, { outpost: '0_0', slot, qty: 5, price: 1, key: 'c1' }), /CONFIRM:/);
    const r = game.market.placeSell(a, { outpost: '0_0', slot, qty: 5, price: 1, key: 'c2', confirm: true });
    assert.ok(r.order);
  });

  it('nhiều lệnh ngẫu nhiên: tiền và hàng luôn bảo toàn', () => {
    const ps = ['P1', 'P2', 'P3', 'P4'].map((n) => addPlayer(n));
    for (const p of ps) {
      grant(p, 20_000);
      give(p, 'coal', 100);
    }
    const coal0 = totalOf('coal');
    let rnd = 7;
    const rand = () => ((rnd = (rnd * 1103515245 + 12345) >>> 0) % 1000) / 1000;
    for (let k = 0; k < 120; k++) {
      const p = ps[Math.floor(rand() * ps.length)]!;
      const price = 10 + Math.floor(rand() * 30);
      try {
        if (rand() < 0.5) {
          game.market.placeBuy(p, { outpost: '0_0', item: 'coal', qty: 1 + Math.floor(rand() * 20), price, key: `b${k}`, confirm: true });
        } else {
          const slot = p.inv.findIndex((x) => x?.id === 'coal');
          if (slot < 0) continue;
          game.market.placeSell(p, { outpost: '0_0', slot, qty: Math.min(p.inv[slot]!.n, 1 + Math.floor(rand() * 20)), price, key: `s${k}`, confirm: true });
        }
      } catch (e) {
        if (!(e instanceof GameError)) throw e;
      }
      if (k % 30 === 29) {
        for (const q of ps) for (const m of game.mail.list(q, '0_0')) game.mail.claim(q, '0_0', m.id);
      }
      assert.equal(totalOf('coal'), coal0, `lệch hàng ở bước ${k}`);
    }
    auditOk();
    // tiền ký quỹ đúng bằng tổng lệnh mua đang mở
    const open = game.db.get<{ s: number }>("SELECT COALESCE(SUM(price * qty_remaining), 0) AS s FROM market_orders WHERE side = 'buy' AND status = 'open'")!.s;
    assert.equal(game.ledger.balance(SYS.escrow), open);
  });
});

describe('hòm thư', () => {
  it('gửi hàng thu tiền khi nhận', () => {
    const a = addPlayer('Gui');
    const b = addPlayer('Nhan');
    give(a, 'iron_ore', 10);
    grant(b, 500);
    const a0 = bal(a);
    const r = game.mail.send(a, { outpost: '0_0', to: 'Nhan', subject: 'Quặng', body: '', slots: [{ i: a.inv.findIndex((x) => x?.id === 'iron_ore'), n: 10 }], xu: 0, cod: 200, key: 'm1' });
    assert.equal(bal(a), a0 - r.fee);
    const m = game.mail.list(b, '0_0')[0]!;
    assert.equal(m.cod, 200);
    const b0 = bal(b);
    game.mail.claim(b, '0_0', m.id);
    assert.equal(bal(b), b0 - 200);
    assert.equal(bal(a), a0 - r.fee + 200);
    assert.equal(countItem(b.inv, 'iron_ore'), 10);
    auditOk();
  });

  it('từ chối thì hàng và Xu quay về người gửi', () => {
    const a = addPlayer('Gui2');
    const b = addPlayer('Nhan2');
    give(a, 'leather', 3);
    grant(a, 1000);
    game.mail.send(a, { outpost: '0_0', to: 'Nhan2', subject: 'Da', body: '', slots: [{ i: a.inv.findIndex((x) => x?.id === 'leather'), n: 3 }], xu: 100, cod: 50, key: 'm2' });
    const m = game.mail.list(b, '0_0')[0]!;
    game.mail.returnMail(b, '0_0', m.id);
    const back = game.mail.list(a, '0_0')[0]!;
    assert.equal(back.items[0]!.n, 3);
    assert.equal(back.xu, 100);
    const a0 = bal(a);
    game.mail.claim(a, '0_0', back.id);
    assert.equal(bal(a), a0 + 100);
    assert.equal(game.ledger.balance(SYS.mail), 0);
    auditOk();
  });
});

describe('trao đổi trực tiếp', () => {
  it('hoán đổi nguyên tử đồ + Xu', () => {
    const a = addPlayer('TraA', 50.5, 50.5);
    const b = addPlayer('TraB', 51.5, 50.5);
    give(a, 'wood', 30);
    give(b, 'stone_axe', 1);
    grant(a, 500);
    game.trades.invite(a, b.id);
    game.trades.respond(b, a.id, true);
    game.trades.offer(a, [{ i: a.inv.findIndex((x) => x?.id === 'wood'), n: 20 }], 100);
    game.trades.offer(b, [{ i: b.inv.findIndex((x) => x?.id === 'stone_axe'), n: 1 }], 0);
    game.trades.lock(a, true);
    game.trades.lock(b, true);
    // bỏ qua 3 giây chờ
    const s = (game.trades as unknown as { sessions: Map<number, { confirmAt: number }> }).sessions;
    for (const x of s.values()) x.confirmAt = 0;
    const a0 = bal(a);
    const b0 = bal(b);
    game.trades.confirm(a);
    game.trades.confirm(b);
    assert.equal(countItem(a.inv, 'wood'), 10);
    assert.equal(countItem(b.inv, 'wood'), 20);
    assert.equal(countItem(a.inv, 'stone_axe'), 1);
    assert.equal(countItem(b.inv, 'stone_axe'), 0);
    assert.equal(bal(a), a0 - 100);
    assert.equal(bal(b), b0 + 100);
    assert.equal(a.tradeId, null);
    auditOk();
  });

  it('đổi đề nghị sẽ bỏ khóa của cả hai', () => {
    const a = addPlayer('TrC', 60.5, 60.5);
    const b = addPlayer('TrD', 61.5, 60.5);
    give(a, 'wood', 5);
    game.trades.invite(a, b.id);
    game.trades.respond(b, a.id, true);
    game.trades.lock(a, true);
    game.trades.lock(b, true);
    game.trades.offer(a, [{ i: a.inv.findIndex((x) => x?.id === 'wood'), n: 5 }], 0);
    assert.throws(() => game.trades.confirm(a), GameError);
  });

  it('thiếu Xu lúc thực hiện ⇒ hủy, không ai mất gì', () => {
    const a = addPlayer('TrE', 70.5, 70.5);
    const b = addPlayer('TrF', 71.5, 70.5);
    give(b, 'wood', 10);
    grant(a, 300);
    game.trades.invite(a, b.id);
    game.trades.respond(b, a.id, true);
    game.trades.offer(a, [], 300);
    game.trades.offer(b, [{ i: b.inv.findIndex((x) => x?.id === 'wood'), n: 10 }], 0);
    // a tiêu bớt tiền trước khi xác nhận
    game.atomic([a], () => game.ledger.transfer(charWallet(a.charId), SYS.services, 250, 'test'));
    game.trades.lock(a, true);
    game.trades.lock(b, true);
    const s = (game.trades as unknown as { sessions: Map<number, { confirmAt: number }> }).sessions;
    for (const x of s.values()) x.confirmAt = 0;
    game.trades.confirm(a);
    game.trades.confirm(b);
    assert.equal(countItem(b.inv, 'wood'), 10);
    assert.equal(countItem(a.inv, 'wood'), 0);
    assert.equal(a.tradeId, null);
    auditOk();
  });
});

describe('lưu trữ', () => {
  it('lưu và nạp lại nhân vật', () => {
    const a = addPlayer('Luu');
    give(a, 'wood', 42);
    game.saveAll();
    const row = game.db.get<{ data: string }>('SELECT data FROM characters WHERE id = ?', a.charId)!;
    assert.equal(countItem(JSON.parse(row.data).inv, 'wood'), 42);
  });
});
