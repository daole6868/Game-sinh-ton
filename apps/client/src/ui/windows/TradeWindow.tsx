import type { TradeOfferView } from '@suongdo/shared';
import { useEffect, useState } from 'react';
import { call } from '../../net/client';
import { useStore } from '../../state/store';
import { itemName, NumberInput, Slot, Window, Xu } from '../common';
import { InventoryGrid } from './InventoryWindow';

function OfferList({ o, editable, onRemove }: { o: TradeOfferView; editable: boolean; onRemove?: (i: number) => void }) {
  return (
    <div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 4, minHeight: 50 }}>
        {o.items.map((it, k) => (
          <div key={k} title={itemName(it)} onClick={() => editable && onRemove?.(o.slots[k]!.i)}>
            <Slot stack={it} small />
          </div>
        ))}
        {o.items.length === 0 && <span className="dim">Chưa có vật phẩm</span>}
      </div>
      <div style={{ marginTop: 6 }}>
        + <Xu n={o.xu} />
      </div>
      <div className="dim" style={{ fontSize: 11 }}>
        Giá trị tham khảo ~{o.value.toLocaleString('vi-VN')} Xu
      </div>
    </div>
  );
}

export function TradeWindow() {
  const t = useStore((s) => s.trade);
  const inv = useStore((s) => s.inv);
  const xuHave = useStore((s) => s.xu);
  const [xu, setXu] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (t) setXu(t.mine.xu);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.id]);
  if (!t) return null;
  const mine = t.mine.slots;
  const sendOffer = (slots: { i: number; n: number }[], x = xu) => void call('trade_offer', { slots, xu: x });
  const add = (i: number) => {
    const s = inv[i];
    if (!s || t.myLock) return;
    if (mine.some((m) => m.i === i)) return;
    sendOffer([...mine, { i, n: s.n }]);
  };
  const remove = (i: number) => sendOffer(mine.filter((m) => m.i !== i));
  const a = t.mine.value;
  const b = t.theirs.value;
  const lopsided = a > 0 && b < a * 0.3;
  const waiting = t.confirmAt > now ? Math.ceil((t.confirmAt - now) / 1000) : 0;
  return (
    <Window title={`Giao dịch với ${t.other.name}`} sub="Mọi thay đổi sẽ bỏ khóa của cả hai bên" onClose={() => void call('trade_cancel', {})}>
      <div className="trade-cols">
        <div className={`trade-side ${t.myLock ? 'locked' : ''}`}>
          <p className="section-title">Bạn đưa {t.myLock && '🔒'}</p>
          <OfferList o={t.mine} editable={!t.myLock} onRemove={remove} />
          <div className="row" style={{ marginTop: 8 }}>
            <span className="muted">Xu:</span>
            <NumberInput value={xu} min={0} max={xuHave} onChange={setXu} width={110} />
            <button className="small" disabled={t.myLock} onClick={() => sendOffer(mine, xu)}>
              Đặt Xu
            </button>
          </div>
        </div>
        <div className={`trade-side ${t.theirLock ? 'locked' : ''}`}>
          <p className="section-title">
            {t.other.name} đưa {t.theirLock && '🔒'}
          </p>
          <OfferList o={t.theirs} editable={false} />
        </div>
      </div>
      {lopsided && (
        <div className="trade-warn">
          ⚠ Cảnh báo: bạn đưa đồ trị giá ~{a.toLocaleString('vi-VN')} Xu nhưng chỉ nhận về ~{b.toLocaleString('vi-VN')} Xu. Hãy kiểm tra kỹ!
        </div>
      )}
      <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
        <button onClick={() => void call('trade_cancel', {})}>Hủy</button>
        <button onClick={() => void call('trade_lock', { lock: !t.myLock })}>{t.myLock ? 'Mở khóa' : 'Khóa đề nghị'}</button>
        <button className="primary" disabled={!t.myLock || !t.theirLock || waiting > 0 || t.myConfirm} onClick={() => void call('trade_confirm', {})}>
          {t.myConfirm ? 'Đã xác nhận — chờ đối phương' : waiting > 0 ? `Xác nhận (${waiting})` : 'Xác nhận giao dịch'}
        </button>
      </div>
      <p className="section-title" style={{ marginTop: 14 }}>
        Bấm vào vật phẩm trong túi để đưa vào giao dịch
      </p>
      <InventoryGrid onPick={(i) => add(i)} highlight={(i) => mine.some((m) => m.i === i)} />
    </Window>
  );
}
