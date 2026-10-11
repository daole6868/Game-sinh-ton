import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addStack,
  arbitrageCap,
  canAddAll,
  collides,
  emptySlots,
  ITEMS,
  makeStack,
  moveSlot,
  NPC_LIST,
  OBJECT_LIST,
  priceFactor,
  quoteBuyFromSystem,
  quoteSellToSystem,
  RECIPES,
  stepMove,
  systemBuyPrice,
  systemBuyPriceRaw,
  systemSellPrice,
  takeItem,
  targetStock,
  WorldGen,
  WorldView,
  MOB_LIST,
  QUESTS,
  STRUCTURES,
  outpostInCell,
  nearestOutpost,
  dayOf,
  isBloodNight,
  phaseOf,
} from '../src/index.ts';

describe('dữ liệu game', () => {
  it('mọi công thức chỉ dùng vật phẩm tồn tại', () => {
    for (const r of RECIPES) {
      for (const id of [...Object.keys(r.in), ...Object.keys(r.out)]) assert.ok(ITEMS[id], `${r.id}: thiếu ${id}`);
    }
  });
  it('mọi vật phẩm rơi/bán/mua đều tồn tại', () => {
    for (const o of OBJECT_LIST) for (const d of o.drops) assert.ok(ITEMS[d.item], `${o.id}: ${d.item}`);
    for (const m of MOB_LIST) for (const d of m.drops) assert.ok(ITEMS[d.item], `${m.id}: ${d.item}`);
    for (const n of NPC_LIST) for (const id of [...n.sells, ...n.buys]) assert.ok(ITEMS[id], `${n.role}: ${id}`);
    for (const q of QUESTS) for (const id of Object.keys(q.rewardItems ?? {})) assert.ok(ITEMS[id], `${q.id}: ${id}`);
  });
  it('mọi vật phẩm công trình trỏ tới công trình tồn tại', () => {
    for (const it of Object.values(ITEMS)) if (it.place) assert.ok(STRUCTURES[it.place], it.id);
  });
  it('mọi vật phẩm đều kiếm được bằng ít nhất một cách', () => {
    const sources = new Set<string>();
    for (const r of RECIPES) for (const id of Object.keys(r.out)) sources.add(id);
    for (const o of OBJECT_LIST) for (const d of o.drops) sources.add(d.item);
    for (const m of MOB_LIST) for (const d of m.drops) sources.add(d.item);
    for (const n of NPC_LIST) for (const id of n.sells) sources.add(id);
    ['raw_fish', 'carrot', 'pumpkin', 'blood_chest', 'waterskin_dirty'].forEach((x) => sources.add(x));
    for (const id of Object.keys(ITEMS)) assert.ok(sources.has(id), `không kiếm được: ${id}`);
  });
});

describe('kinh tế', () => {
  it('giá theo công thức (S*/S)^k, kẹp trong [0.5, 3]', () => {
    assert.equal(priceFactor('wood', targetStock('wood')), 1);
    assert.equal(systemSellPrice('wood', 10_000), 10);
    assert.equal(systemSellPrice('wood', 20_000), 7);
    assert.equal(systemSellPrice('wood', 2_000), 30);
    assert.equal(systemBuyPriceRaw('wood', 2_000), 16);
    assert.equal(priceFactor('wood', 1), 3);
    assert.equal(priceFactor('wood', 1e9), 0.5);
  });
  it('mua nhiều thì giá tăng dần, bán nhiều thì giá giảm dần (trượt giá)', () => {
    const b = quoteBuyFromSystem('wood', 10_000, 5000);
    assert.ok(b.unitLast > b.unitFirst);
    const s = quoteSellToSystem('wood', 10_000, 5000, () => 10_000, 1, 1e9);
    assert.ok(s.unitLast < s.unitFirst);
    assert.ok(s.total < 5000 * s.unitFirst);
  });
  it('vượt hạn mức chỉ nhận 20%', () => {
    const s = quoteSellToSystem('iron_ingot', 1500, 10, () => 1500, 1, 0);
    const normal = quoteSellToSystem('iron_ingot', 1500, 10, () => 1500, 1, 1e9);
    assert.ok(s.total <= Math.ceil(normal.total * 0.2) + 10);
    assert.equal(s.overCap, 10);
  });
  it('không có vòng lặp kiếm lời: mua nguyên liệu của NPC → chế → bán cho NPC luôn lỗ', () => {
    for (const stockMul of [0.05, 0.3, 1, 3, 30]) {
      const stockOf = (id: string) => targetStock(id) * stockMul;
      const sold = new Set(NPC_LIST.flatMap((n) => n.sells));
      const bought = new Set(NPC_LIST.flatMap((n) => n.buys));
      for (const r of RECIPES) {
        if (!Object.keys(r.in).every((id) => sold.has(id))) continue;
        let cost = 0;
        for (const [id, n] of Object.entries(r.in)) cost += n * systemSellPrice(id, stockOf(id));
        let revenue = 0;
        for (const [id, n] of Object.entries(r.out)) if (bought.has(id)) revenue += n * systemBuyPrice(id, stockOf(id), stockOf);
        assert.ok(revenue < cost || revenue === 0, `${r.id} lời: chi ${cost}, thu ${revenue} (tồn ×${stockMul})`);
      }
    }
  });
  it('giới hạn giá thu mua thành phẩm theo nguyên liệu', () => {
    // dây thừng làm từ cỏ sợi (NPC không bán) ⇒ không cần chặn
    assert.equal(arbitrageCap('rope', (id) => targetStock(id)), Infinity);
    // thuốc súng làm từ than + muối (đều mua được của NPC) ⇒ bị chặn
    const cap = arbitrageCap('gunpowder', (id) => targetStock(id));
    assert.ok(Number.isFinite(cap));
    assert.ok(systemBuyPrice('gunpowder', 1, (id) => targetStock(id)) <= cap);
  });
});

describe('túi đồ', () => {
  it('xếp chồng, lấy ra, không vượt giới hạn', () => {
    const inv = emptySlots(4);
    assert.equal(addStack(inv, makeStack('wood', 150, { now: 0 })), 0);
    assert.equal(inv[0]!.n, 100);
    assert.equal(inv[1]!.n, 50);
    const taken = takeItem(inv, 'wood', 120)!;
    assert.equal(taken.reduce((a, s) => a + s.n, 0), 120);
    assert.equal(inv.filter(Boolean).reduce((a, s) => a + s!.n, 0), 30);
    assert.equal(takeItem(inv, 'wood', 31), null);
  });
  it('đồ độc nhất không xếp chồng, có mã riêng', () => {
    let k = 0;
    const inv = emptySlots(3);
    addStack(inv, makeStack('stone_axe', 1, { now: 0, uid: () => `u${k++}` }));
    addStack(inv, makeStack('stone_axe', 1, { now: 0, uid: () => `u${k++}` }));
    assert.equal(inv.filter(Boolean).length, 2);
    assert.notEqual(inv[0]!.u, inv[1]!.u);
    assert.ok(!canAddAll(inv, [makeStack('stone_axe', 1, { now: 0 }), makeStack('stone_axe', 1, { now: 0 })]));
  });
  it('gộp đồ ăn lấy trung bình độ tươi', () => {
    const inv = emptySlots(2);
    addStack(inv, { id: 'raw_meat', n: 10, t: 0 });
    addStack(inv, { id: 'raw_meat', n: 10, t: 100 });
    assert.equal(inv[0]!.n, 20);
    assert.equal(inv[0]!.t, 50);
  });
  it('chuyển ô: gộp, hoán đổi, chia đôi', () => {
    const a = emptySlots(2);
    const b = emptySlots(2);
    a[0] = { id: 'stone', n: 10 };
    b[0] = { id: 'stone', n: 95 };
    assert.ok(moveSlot(a, 0, b, 0));
    assert.equal(b[0]!.n, 100);
    assert.equal(a[0]!.n, 5);
    a[1] = { id: 'wood', n: 4 };
    assert.ok(moveSlot(a, 1, b, 1, 2));
    assert.equal(a[1]!.n, 2);
    assert.equal(b[1]!.n, 2);
  });
});

describe('thế giới', () => {
  it('sinh thế giới tất định theo seed', () => {
    const a = new WorldGen(42).generateChunk(3, -7);
    const b = new WorldGen(42).generateChunk(3, -7);
    const c = new WorldGen(43).generateChunk(3, -7);
    assert.deepEqual(a.tiles, b.tiles);
    assert.deepEqual(a.objs, b.objs);
    assert.notDeepEqual(a.tiles, c.tiles);
  });
  it('trạm trung tâm ở (0,0), khu trạm luôn là đất liền', () => {
    const g = new WorldGen(7);
    assert.equal(outpostInCell(7, 0, 0).name, 'Trạm Trung Tâm');
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        const o = outpostInCell(7, i, j);
        assert.equal(g.tileAt(o.x, o.y), 11, `trạm ${o.id} phải là sân lát đá`);
        assert.ok(nearestOutpost(7, o.x + 3, o.y).dist < 5);
      }
    }
  });
  it('va chạm: không đi xuyên vật cản', () => {
    const solid = (tx: number, ty: number) => tx === 5;
    const s = { x: 3.5, y: 0.5, dashT: 0, dashCd: 0, dashX: 0, dashY: 0 };
    for (let i = 0; i < 60; i++) stepMove(s, { seq: i, mx: 1, my: 0, run: true, dash: false, a: 0 }, { speedMul: 1, canRun: true, canDash: true, solid, tileSpeed: () => 1 }, 1 / 30);
    assert.ok(s.x < 5 - 0.29 && s.x > 4.5, `x = ${s.x}`);
    assert.ok(!collides(s.x, s.y, 0.3, solid));
  });
  it('WorldView ẩn vật thể đã bị lấy cho tới khi mọc lại', () => {
    const g = new WorldGen(1);
    const v = new WorldView(g);
    let found: [number, number] | null = null;
    for (let x = 100; x < 200 && !found; x++) for (let y = 100; y < 130 && !found; y++) if (g.baseObjectAt(x, y)) found = [x, y];
    assert.ok(found);
    const [x, y] = found!;
    const d = v.ensureDelta(Math.floor(x / 32), Math.floor(y / 32));
    d.rm.set((y - Math.floor(y / 32) * 32) * 32 + (x - Math.floor(x / 32) * 32), 500);
    v.now = 100;
    assert.equal(v.objectAt(x, y), undefined);
    v.now = 600;
    assert.ok(v.objectAt(x, y));
  });
  it('thời gian: ngày, pha, Đêm Sương Đỏ', () => {
    assert.equal(dayOf(0), 1);
    assert.equal(dayOf(1199), 1);
    assert.equal(dayOf(1200), 2);
    assert.equal(phaseOf(10), 'dawn');
    assert.equal(phaseOf(500), 'day');
    assert.equal(phaseOf(1000), 'night');
    assert.ok(isBloodNight(6 * 1200 + 1000));
    assert.ok(!isBloodNight(6 * 1200 + 500));
    assert.ok(!isBloodNight(5 * 1200 + 1000));
  });
});
