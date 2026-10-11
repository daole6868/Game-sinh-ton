import {
  countItem,
  type EquipSlot,
  fmtXu,
  ITEMS,
  NPCS,
  type NpcRole,
  quoteBuyFromSystem,
  repairCost,
  type ShopView,
  type ItemStack,
} from '@suongdo/shared';
import { useState } from 'react';
import { call } from '../../net/client';
import { note, openWindow, useStore } from '../../state/store';
import { ItemIcon, itemName, NumberInput, Tabs, useAsync, Window, Xu } from '../common';

function stockLabel(stock: number, target: number): [string, string] {
  const r = stock / Math.max(1, target);
  if (r < 0.4) return ['Khan hiếm', 'bad'];
  if (r < 0.8) return ['Hơi thiếu', 'gold'];
  if (r > 1.6) return ['Dư thừa', 'good'];
  return ['Bình thường', 'muted'];
}

export function ShopWindow({ outpost, role }: { outpost: string; role: NpcRole }) {
  const npc = NPCS[role];
  const [tab, setTab] = useState<'buy' | 'sell' | 'repair'>('buy');
  const [view, reload] = useAsync<ShopView>(() => call('shop', { outpost, role }), [outpost, role]);
  const inv = useStore((s) => s.inv);
  const reserved = useStore((s) => s.reserved);
  const xu = useStore((s) => s.xu);
  const [qty, setQty] = useState<Record<string, number>>({});
  const avail = inv.map((s, i) => (reserved.includes(i) ? null : s));
  const q = (id: string) => qty[id] ?? 1;

  async function buy(id: string) {
    const r = await call('shop_buy', { outpost, role, item: id, qty: q(id) });
    if (r) note(`Đã mua ${ITEMS[id]?.name} ×${q(id)} (−${fmtXu(r.paid)} Xu)`, 'good');
    reload();
  }
  async function sell(id: string, n: number) {
    const r = await call('shop_sell', { outpost, role, item: id, qty: n });
    if (r) note(`Đã bán ${ITEMS[id]?.name} ×${n} (+${fmtXu(r.got)} Xu)`, 'good');
    reload();
  }

  const tabs: ['buy' | 'sell' | 'repair', string][] = [
    ['buy', 'Mua'],
    ['sell', 'Bán'],
  ];
  if (role === 'smith') tabs.push(['repair', 'Sửa đồ']);

  return (
    <Window title={`${npc.name} — ${npc.title}`} sub={<Xu n={xu} />} onClose={() => openWindow(null)} width={640}>
      <Tabs value={tab} onChange={setTab} items={tabs} />
      {!view && <div className="dim">Đang tải...</div>}
      {view && tab === 'buy' && (
        <table className="list">
          <thead>
            <tr>
              <th>Hàng</th>
              <th>Tình trạng</th>
              <th className="num">Giá</th>
              <th>SL</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {view.items
              .filter((it) => it.sell !== undefined)
              .map((it) => {
                const [lbl, cls] = stockLabel(it.stock, it.target);
                const total = quoteBuyFromSystem(it.id, it.stock, q(it.id)).total;
                return (
                  <tr key={it.id}>
                    <td>
                      <div className="item-cell">
                        <ItemIcon id={it.id} />
                        {itemName(it.id)}
                      </div>
                    </td>
                    <td className={cls}>{lbl}</td>
                    <td className="num gold">{fmtXu(it.sell!)}</td>
                    <td>
                      <NumberInput value={q(it.id)} max={ITEMS[it.id]?.durability ? 5 : 500} onChange={(n) => setQty({ ...qty, [it.id]: n })} width={64} />
                    </td>
                    <td>
                      <button className="small primary" disabled={total > xu} onClick={() => void buy(it.id)}>
                        Mua {fmtXu(total)}
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      )}
      {view && tab === 'sell' && (
        <>
          <div className="muted" style={{ marginBottom: 8, fontSize: 12 }}>
            Hạn mức bán cho hệ thống hôm nay: <b className="gold">{fmtXu(view.cap - view.capLeft)}</b> / {fmtXu(view.cap)} Xu. Vượt hạn mức chỉ được 20% giá — hãy bán cho người chơi trên Sàn giao dịch.
          </div>
          <table className="list">
            <thead>
              <tr>
                <th>Hàng</th>
                <th>Tình trạng</th>
                <th className="num">Giá thu</th>
                <th className="num">Bạn có</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {view.items
                .filter((it) => it.buy !== undefined)
                .sort((a, b) => countItem(avail, b.id) - countItem(avail, a.id))
                .map((it) => {
                  const have = countItem(avail, it.id);
                  const [lbl, cls] = stockLabel(it.stock, it.target);
                  return (
                    <tr key={it.id} style={{ opacity: have ? 1 : 0.45 }}>
                      <td>
                        <div className="item-cell">
                          <ItemIcon id={it.id} />
                          {itemName(it.id)}
                        </div>
                      </td>
                      <td className={cls}>{lbl}</td>
                      <td className="num gold">{fmtXu(it.buy!)}</td>
                      <td className="num">{have}</td>
                      <td>
                        <div className="row" style={{ gap: 4 }}>
                          <button className="small" disabled={!have} onClick={() => void sell(it.id, 1)}>
                            Bán 1
                          </button>
                          <button className="small primary" disabled={!have} onClick={() => void sell(it.id, have)}>
                            Bán hết
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </>
      )}
      {tab === 'repair' && <RepairPanel outpost={outpost} />}
    </Window>
  );
}

function RepairPanel({ outpost }: { outpost: string }) {
  const inv = useStore((s) => s.inv);
  const eq = useStore((s) => s.eq);
  const items: { slot: number | EquipSlot; s: ItemStack }[] = [];
  inv.forEach((s, i) => s && s.d !== undefined && s.md && s.d < s.md - 0.5 && items.push({ slot: i, s }));
  (['head', 'body', 'mask'] as EquipSlot[]).forEach((k) => {
    const s = eq[k];
    if (s && s.d !== undefined && s.md && s.d < s.md - 0.5) items.push({ slot: k, s });
  });
  if (items.length === 0) return <div className="dim">Không có món nào cần sửa.</div>;
  return (
    <>
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        Mỗi lần sửa, độ bền tối đa giảm 5% — đồ cũ rồi cũng sẽ hỏng hẳn.
      </div>
      <table className="list">
        <tbody>
          {items.map(({ slot, s }) => {
            const cost = repairCost(s.id, s.d!, s.md!);
            return (
              <tr key={String(slot)}>
                <td>
                  <div className="item-cell">
                    <ItemIcon id={s.id} />
                    {itemName(s)}
                  </div>
                </td>
                <td className="num">
                  {Math.ceil(s.d!)}/{s.md}
                </td>
                <td>
                  <button className="small primary" onClick={() => void call('repair', { outpost, slot })}>
                    Sửa — {fmtXu(cost)} Xu
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
