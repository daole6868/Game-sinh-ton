import {
  type BookView,
  fmtXu,
  isUnique,
  ITEM_LIST,
  ITEMS,
  listingFee,
  type MarketSummary,
  marketTax,
  type OrderView,
} from '@suongdo/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { call, net, newKey, ReqError } from '../../net/client';
import { askConfirm, note, openWindow, useStore } from '../../state/store';
import { ItemIcon, itemName, NumberInput, Tabs, useAsync, Window, Xu } from '../common';

function PriceChart({ history }: { history: BookView['history'] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const w = (c.width = c.clientWidth * devicePixelRatio);
    const h = (c.height = c.clientHeight * devicePixelRatio);
    ctx.clearRect(0, 0, w, h);
    if (history.length === 0) {
      ctx.fillStyle = '#7e6a6e';
      ctx.font = `${12 * devicePixelRatio}px sans-serif`;
      ctx.fillText('Chưa có giao dịch trong 14 ngày qua', 8 * devicePixelRatio, h / 2);
      return;
    }
    const maxP = Math.max(...history.map((x) => x.avg)) * 1.15;
    const maxV = Math.max(...history.map((x) => x.vol));
    const bw = w / Math.max(history.length, 7);
    history.forEach((d, i) => {
      const x = i * bw;
      const vh = (d.vol / maxV) * h * 0.35;
      ctx.fillStyle = 'rgba(224,72,92,0.25)';
      ctx.fillRect(x + bw * 0.15, h - vh, bw * 0.7, vh);
    });
    ctx.strokeStyle = '#f0c860';
    ctx.lineWidth = 2 * devicePixelRatio;
    ctx.beginPath();
    history.forEach((d, i) => {
      const x = i * bw + bw / 2;
      const y = h - (d.avg / maxP) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = '#f0e6e2';
    ctx.font = `${11 * devicePixelRatio}px sans-serif`;
    ctx.fillText(`${fmtXu(history[history.length - 1]!.avg)} Xu`, 4 * devicePixelRatio, 13 * devicePixelRatio);
  }, [history]);
  return <canvas ref={ref} className="price-chart" />;
}

async function placeWithConfirm(send: (confirm: boolean) => Promise<unknown>): Promise<boolean> {
  try {
    await send(false);
    return true;
  } catch (e) {
    if (e instanceof ReqError && e.confirm) {
      return new Promise((resolve) => {
        askConfirm(
          e.message,
          () => {
            send(true)
              .then(() => resolve(true))
              .catch((err: Error) => {
                note(err.message, 'bad');
                resolve(false);
              });
          },
          'Vẫn đặt lệnh',
        );
      });
    }
    note((e as Error).message, 'bad');
    return false;
  }
}

function BookPanel({ outpost, item, onChanged }: { outpost: string; item: string; onChanged: () => void }) {
  const [book, reload] = useAsync<BookView>(() => call('market_book', { outpost, item }), [outpost, item]);
  const inv = useStore((s) => s.inv);
  const reserved = useStore((s) => s.reserved);
  const xu = useStore((s) => s.xu);
  const tradingLv = useStore((s) => s.skills?.trading.lv ?? 1);
  const unique = isUnique(item);
  const ref = book?.avg7 ?? book?.last ?? book?.sys.sell ?? ITEMS[item]?.price ?? 1;
  const [bQty, setBQty] = useState(1);
  const [bPrice, setBPrice] = useState(0);
  const [sQty, setSQty] = useState(1);
  const [sPrice, setSPrice] = useState(0);
  const slots = inv.map((s, i) => ({ s, i })).filter((x) => x.s && x.s.id === item && !reserved.includes(x.i));
  const [slot, setSlot] = useState<number>(-1);
  useEffect(() => {
    if (!book) return;
    const bestSell = book.sells[0]?.price;
    const bestBuy = book.buys[0]?.price;
    setBPrice(bestSell ?? Math.max(1, Math.round(ref)));
    setSPrice(bestBuy ?? Math.max(1, Math.round(ref)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.item]);
  useEffect(() => {
    if (slots.length && !slots.some((x) => x.i === slot)) setSlot(slots[0]!.i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots.length, item]);
  const chosen = inv[slot];
  const after = () => {
    reload();
    onChanged();
  };
  async function doBuy() {
    const key = newKey();
    const ok = await placeWithConfirm((confirm) => net.req('market_buy', { outpost, item, qty: bQty, price: bPrice, confirm, key }));
    if (ok) note('Đã đặt lệnh mua. Hàng khớp sẽ được gửi vào hòm thư.', 'good');
    after();
  }
  async function doSell() {
    if (!chosen) return;
    const key = newKey();
    const qty = unique ? 1 : Math.min(sQty, chosen.n);
    const ok = await placeWithConfirm((confirm) => net.req('market_sell', { outpost, slot, qty, price: sPrice, confirm, key }));
    if (ok) note(unique ? 'Đã niêm yết món đồ.' : 'Đã đặt lệnh bán.', 'good');
    after();
  }
  if (!book) return <div className="dim">Đang tải...</div>;
  const buyTotal = bQty * bPrice;
  const sellValue = (unique ? 1 : Math.min(sQty, chosen?.n ?? 0)) * sPrice;
  return (
    <div style={{ flex: 1, minWidth: 340 }}>
      <div className="row" style={{ marginBottom: 6 }}>
        <ItemIcon id={item} size={32} />
        <b style={{ fontSize: 16 }}>{itemName(item)}</b>
        <span className="spacer" />
        <span className="muted" style={{ fontSize: 12 }}>
          Gần nhất: <b className="gold">{book.last !== null ? fmtXu(book.last) : '—'}</b> · TB 24h: {book.avg24 !== null ? fmtXu(book.avg24) : '—'} · TB 7 ngày:{' '}
          {book.avg7 !== null ? fmtXu(book.avg7) : '—'}
        </span>
      </div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
        Giá NPC: bán {book.sys.sell !== null ? `${fmtXu(book.sys.sell)} Xu` : '—'} · mua {book.sys.buy !== null ? `${fmtXu(book.sys.buy)} Xu` : '—'}
      </div>
      <PriceChart history={book.history} />
      {!unique ? (
        <div className="cols" style={{ marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <p className="section-title">Lệnh bán (rẻ nhất trước)</p>
            <table className="list">
              <tbody>
                {book.sells.map((r) => (
                  <tr key={r.price} className="click" onClick={() => setBPrice(r.price)}>
                    <td className="num" style={{ color: '#ff8a8a' }}>
                      {fmtXu(r.price)}
                    </td>
                    <td className="num">×{r.qty}</td>
                  </tr>
                ))}
                {book.sells.length === 0 && (
                  <tr>
                    <td className="dim">Trống</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ flex: 1 }}>
            <p className="section-title">Lệnh mua (cao nhất trước)</p>
            <table className="list">
              <tbody>
                {book.buys.map((r) => (
                  <tr key={r.price} className="click" onClick={() => setSPrice(r.price)}>
                    <td className="num" style={{ color: '#8ae09a' }}>
                      {fmtXu(r.price)}
                    </td>
                    <td className="num">×{r.qty}</td>
                  </tr>
                ))}
                {book.buys.length === 0 && (
                  <tr>
                    <td className="dim">Trống</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          <p className="section-title" style={{ marginTop: 8 }}>
            Đang niêm yết
          </p>
          <table className="list">
            <tbody>
              {book.listings.map((o) => (
                <tr key={o.id}>
                  <td>
                    <div className="item-cell">
                      <ItemIcon id={o.item} />
                      {o.unique ? itemName(o.unique) : itemName(o.item)}
                    </div>
                  </td>
                  <td className="dim" style={{ fontSize: 11 }}>
                    {o.unique?.d !== undefined ? `Bền ${Math.ceil(o.unique.d)}/${o.unique.md}` : ''} {o.unique?.q ? `· PC ×${o.unique.q.toFixed(2)}` : ''}
                  </td>
                  <td className="dim">{o.owner}</td>
                  <td className="num gold">{fmtXu(o.price)}</td>
                  <td>
                    {o.mine ? (
                      <span className="dim">của bạn</span>
                    ) : (
                      <button
                        className="small primary"
                        disabled={o.price > xu}
                        onClick={async () => {
                          const r = await call('market_buy_unique', { outpost, order: o.id, key: newKey() });
                          if (r) note('Đã mua! Món đồ được gửi vào hòm thư.', 'good');
                          after();
                        }}
                      >
                        Mua
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {book.listings.length === 0 && (
                <tr>
                  <td className="dim">Chưa có ai niêm yết món này.</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
      <div className="cols" style={{ marginTop: 12 }}>
        {!unique && (
          <div style={{ flex: 1, padding: 10, border: '1px solid var(--line)', borderRadius: 6 }}>
            <p className="section-title">Đặt lệnh mua</p>
            <div className="row">
              SL <NumberInput value={bQty} onChange={setBQty} width={70} /> Giá <NumberInput value={bPrice} onChange={setBPrice} width={80} />
            </div>
            <div className="dim" style={{ fontSize: 12, margin: '6px 0' }}>
              Tổng {fmtXu(buyTotal)} + phí {fmtXu(listingFee(buyTotal))} Xu (Xu được ký quỹ tới khi khớp)
            </div>
            <button className="primary" disabled={buyTotal + listingFee(buyTotal) > xu} onClick={() => void doBuy()}>
              Đặt mua
            </button>
          </div>
        )}
        <div style={{ flex: 1, padding: 10, border: '1px solid var(--line)', borderRadius: 6 }}>
          <p className="section-title">{unique ? 'Niêm yết bán' : 'Đặt lệnh bán'}</p>
          {slots.length === 0 ? (
            <div className="dim">Bạn không có món này trong túi.</div>
          ) : (
            <>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <select value={slot} onChange={(e) => setSlot(Number(e.target.value))}>
                  {slots.map((x) => (
                    <option key={x.i} value={x.i}>
                      Ô {x.i + 1}: {itemName(x.s!)} ×{x.s!.n}
                      {x.s!.d !== undefined ? ` (bền ${Math.ceil(x.s!.d)})` : ''}
                    </option>
                  ))}
                </select>
                {!unique && (
                  <>
                    SL <NumberInput value={sQty} onChange={setSQty} max={chosen?.n ?? 1} width={64} />
                  </>
                )}
                Giá <NumberInput value={sPrice} onChange={setSPrice} width={80} />
              </div>
              <div className="dim" style={{ fontSize: 12, margin: '6px 0' }}>
                Nhận về ~{fmtXu(sellValue - marketTax(sellValue, tradingLv))} Xu (thuế {fmtXu(marketTax(sellValue, tradingLv))}) · phí đăng {fmtXu(listingFee(sellValue))}
              </div>
              <button className="primary" disabled={!chosen} onClick={() => void doSell()}>
                {unique ? 'Niêm yết' : 'Đặt bán'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MyOrders({ outpost, version, onChanged }: { outpost: string; version: number; onChanged: () => void }) {
  const [orders, reload] = useAsync<OrderView[]>(() => call('market_my', { outpost }), [outpost, version]);
  if (!orders) return <div className="dim">Đang tải...</div>;
  if (orders.length === 0) return <div className="dim">Bạn chưa có lệnh nào đang mở.</div>;
  return (
    <table className="list">
      <thead>
        <tr>
          <th>Loại</th>
          <th>Hàng</th>
          <th className="num">Giá</th>
          <th className="num">Còn / Tổng</th>
          <th>Hết hạn</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id}>
            <td className={o.side === 'buy' ? 'good' : 'bad'}>{o.side === 'buy' ? 'MUA' : 'BÁN'}</td>
            <td>
              <div className="item-cell">
                <ItemIcon id={o.item} />
                {o.unique ? itemName(o.unique) : itemName(o.item)}
              </div>
            </td>
            <td className="num gold">{fmtXu(o.price)}</td>
            <td className="num">
              {o.qty}/{o.total}
            </td>
            <td className="dim">{Math.max(0, Math.round((o.expires - Date.now()) / 3600_000))} giờ</td>
            <td>
              <button
                className="small"
                onClick={async () => {
                  const r = await call('market_cancel', { outpost, order: o.id });
                  if (r) note('Đã hủy lệnh. Hàng/Xu còn lại được trả về.', 'info');
                  reload();
                  onChanged();
                }}
              >
                Hủy
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MarketWindow({ outpost }: { outpost: string }) {
  const [tab, setTab] = useState<'browse' | 'mine'>('browse');
  const [version, setVersion] = useState(0);
  const [summary] = useAsync<MarketSummary[]>(() => call('market_summary', { outpost }), [outpost, version]);
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const xu = useStore((s) => s.xu);
  const guest = useStore((s) => s.me?.guest);
  const rows = useMemo(() => {
    const map = new Map((summary ?? []).map((s) => [s.item, s]));
    const all = ITEM_LIST.filter((d) => !d.bound)
      .filter((d) => !q || d.name.toLowerCase().includes(q.toLowerCase()))
      .map((d) => map.get(d.id) ?? { item: d.id, bestSell: null, bestBuy: null, sellQty: 0, buyQty: 0, last: null });
    return all.sort((a, b) => b.sellQty + b.buyQty - (a.sellQty + a.buyQty) || (ITEMS[a.item]?.name ?? '').localeCompare(ITEMS[b.item]?.name ?? '', 'vi'));
  }, [summary, q]);
  return (
    <Window title="Sàn giao dịch" sub={<Xu n={xu} />} onClose={() => openWindow(null)} width={980}>
      {guest && <div className="trade-warn" style={{ marginTop: 0, marginBottom: 10 }}>Tài khoản khách chưa đặt lệnh được. Hãy đăng ký (miễn phí) để giao dịch.</div>}
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          ['browse', 'Mua bán'],
          ['mine', 'Lệnh của tôi'],
        ]}
      />
      {tab === 'browse' ? (
        <div className="cols">
          <div style={{ width: 300 }}>
            <input placeholder="Tìm vật phẩm..." value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', marginBottom: 6 }} />
            <div style={{ maxHeight: 520, overflow: 'auto' }}>
              <table className="list">
                <thead>
                  <tr>
                    <th>Hàng</th>
                    <th className="num">Bán từ</th>
                    <th className="num">Mua tới</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.item} className={`click ${sel === r.item ? 'on' : ''}`} onClick={() => setSel(r.item)}>
                      <td>
                        <div className="item-cell">
                          <ItemIcon id={r.item} size={20} />
                          <span style={{ fontSize: 12 }}>{itemName(r.item)}</span>
                        </div>
                      </td>
                      <td className="num" style={{ color: '#ff9a9a', fontSize: 15 }}>
                        {r.bestSell !== null ? fmtXu(r.bestSell) : '·'}
                      </td>
                      <td className="num" style={{ color: '#8ae09a', fontSize: 15 }}>
                        {r.bestBuy !== null ? fmtXu(r.bestBuy) : '·'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {sel ? (
            <BookPanel key={sel} outpost={outpost} item={sel} onChanged={() => setVersion((v) => v + 1)} />
          ) : (
            <div className="dim" style={{ flex: 1, padding: 20, lineHeight: 1.6 }}>
              Chọn một mặt hàng bên trái để xem sổ lệnh.
              <br />
              • Đặt <b>lệnh bán</b>: hàng được ký gửi ngay; khi có người mua, Xu vào ví bạn (trừ 5% thuế).
              <br />• Đặt <b>lệnh mua</b>: Xu được ký quỹ; hàng khớp sẽ gửi tới <b>hòm thư</b> (Thủ kho).
              <br />• Phí đăng lệnh 1% không hoàn lại. Lệnh tồn tại 72 giờ.
              <br />• Đồ có độ bền (vũ khí, giáp...) được niêm yết từng món với giá cố định.
            </div>
          )}
        </div>
      ) : (
        <MyOrders outpost={outpost} version={version} onChanged={() => setVersion((v) => v + 1)} />
      )}
    </Window>
  );
}
