import { fmtXu, MAIL_FEE_PER_STACK, type MailView } from '@suongdo/shared';
import { useState } from 'react';
import { call, newKey } from '../../net/client';
import { askConfirm, note, openWindow, useStore } from '../../state/store';
import { ItemIcon, itemName, NumberInput, Slot, Tabs, useAsync, Window, Xu } from '../common';
import { InventoryGrid } from './InventoryWindow';

function Inbox({ outpost }: { outpost: string }) {
  const [mails, reload] = useAsync<MailView[]>(() => call('mail_list', { outpost }), [outpost]);
  const xu = useStore((s) => s.xu);
  if (!mails) return <div className="dim">Đang tải...</div>;
  if (mails.length === 0) return <div className="dim">Hòm thư trống.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 460, overflow: 'auto' }}>
      {mails.map((m) => (
        <div key={m.id} style={{ padding: 10, border: '1px solid var(--line)', borderRadius: 6 }}>
          <div className="row">
            <b>{m.subject}</b>
            <span className="spacer" />
            <span className="dim" style={{ fontSize: 12 }}>
              từ {m.from} · còn {Math.max(0, Math.round((m.expires - Date.now()) / 3600_000))} giờ
            </span>
          </div>
          {m.body && <div className="muted" style={{ fontSize: 12, margin: '4px 0' }}>{m.body}</div>}
          <div className="row" style={{ flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {m.items.map((it, i) => (
              <Slot key={i} stack={it} small />
            ))}
            {m.xu > 0 && <Xu n={m.xu} />}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            {m.cod > 0 && (
              <span className="bad" style={{ fontSize: 13 }}>
                Thu tiền khi nhận: {fmtXu(m.cod)} Xu
              </span>
            )}
            <span className="spacer" />
            {m.cod > 0 && (
              <button
                className="small"
                onClick={async () => {
                  if (await call('mail_return', { outpost, id: m.id })) note('Đã trả thư về người gửi.', 'info');
                  reload();
                }}
              >
                Từ chối
              </button>
            )}
            <button
              className="small primary"
              disabled={m.cod > xu}
              onClick={() => {
                const go = async () => {
                  if (await call('mail_claim', { outpost, id: m.id })) note('Đã nhận thư.', 'good');
                  reload();
                };
                if (m.cod > 0) askConfirm(`Trả ${fmtXu(m.cod)} Xu cho ${m.from} để nhận hàng?`, () => void go(), 'Trả tiền & nhận');
                else void go();
              }}
            >
              {m.cod > 0 ? `Trả ${fmtXu(m.cod)} & nhận` : 'Nhận'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SendMail({ outpost }: { outpost: string }) {
  const inv = useStore((s) => s.inv);
  const xuHave = useStore((s) => s.xu);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [xu, setXu] = useState(0);
  const [cod, setCod] = useState(0);
  const [slots, setSlots] = useState<{ i: number; n: number }[]>([]);
  const fee = MAIL_FEE_PER_STACK * Math.max(1, slots.length) + (xu > 0 ? Math.ceil(xu * 0.01) : 0);
  async function send() {
    const r = await call('mail_send', { outpost, to, subject, body, slots, xu, cod, key: newKey() });
    if (r) {
      note(`Đã gửi thư cho ${to} (cước ${r.fee} Xu).`, 'good');
      setSlots([]);
      setXu(0);
      setCod(0);
      setSubject('');
      setBody('');
    }
  }
  return (
    <div className="cols">
      <div style={{ width: 320 }}>
        <label className="muted" style={{ fontSize: 12 }}>
          Người nhận
        </label>
        <input value={to} onChange={(e) => setTo(e.target.value)} style={{ width: '100%' }} placeholder="Tên nhân vật" />
        <label className="muted" style={{ fontSize: 12 }}>
          Tiêu đề
        </label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: '100%' }} maxLength={80} />
        <label className="muted" style={{ fontSize: 12 }}>
          Lời nhắn
        </label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} style={{ width: '100%', height: 60 }} maxLength={500} />
        <p className="section-title" style={{ marginTop: 8 }}>
          Đính kèm ({slots.length}/12)
        </p>
        <div className="row" style={{ flexWrap: 'wrap', gap: 4, minHeight: 40 }}>
          {slots.map((s) => (
            <div key={s.i} onClick={() => setSlots(slots.filter((x) => x.i !== s.i))} title="Bấm để bỏ">
              <Slot stack={inv[s.i] ? { ...inv[s.i]!, n: s.n } : null} small />
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          Gửi Xu <NumberInput value={xu} min={0} max={xuHave} onChange={setXu} width={90} />
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          Thu tiền khi nhận <NumberInput value={cod} min={0} onChange={setCod} width={90} />
        </div>
        <div className="dim" style={{ fontSize: 12, margin: '6px 0' }}>
          Cước: {fee} Xu. Thư thu tiền khi nhận sẽ tự trả về sau 72 giờ nếu người nhận không lấy.
        </div>
        <button className="primary" disabled={!to || (slots.length === 0 && xu === 0) || (cod > 0 && slots.length === 0)} onClick={() => void send()}>
          Gửi thư
        </button>
      </div>
      <div>
        <p className="section-title">Bấm vào vật phẩm để đính kèm</p>
        <InventoryGrid
          onPick={(i, s) => {
            if (slots.some((x) => x.i === i) || slots.length >= 12) return;
            setSlots([...slots, { i, n: s.n }]);
          }}
          highlight={(i) => slots.some((x) => x.i === i)}
        />
      </div>
    </div>
  );
}

function SafeStorage({ outpost }: { outpost: string }) {
  const [info, reload] = useAsync(() => call('safe_open', { outpost }), [outpost]);
  if (!info) return <div className="dim">Đang tải...</div>;
  if (info.unlocked) return <div className="muted">Kho an toàn đã mở (cửa sổ kho).</div>;
  return (
    <div style={{ maxWidth: 420, lineHeight: 1.6 }}>
      <p>Kho an toàn giữ 16 ô đồ không bao giờ mất khi bạn chết. Mở được ở mọi trạm giao thương.</p>
      <button
        className="primary"
        onClick={async () => {
          if (await call('safe_unlock', { outpost })) note('Đã mở khóa kho an toàn!', 'good');
          reload();
        }}
      >
        Mở khóa — {fmtXu(info.price)} Xu
      </button>
    </div>
  );
}

export function KeeperWindow({ outpost }: { outpost: string }) {
  const [tab, setTab] = useState<'inbox' | 'send' | 'safe'>('inbox');
  const guest = useStore((s) => s.me?.guest);
  return (
    <Window title="Ông Ba — Thủ kho & Hòm thư" sub={<Xu n={useStore.getState().xu} />} onClose={() => openWindow(null)} width={860}>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          ['inbox', 'Hòm thư'],
          ['send', 'Gửi thư'],
          ['safe', 'Kho an toàn'],
        ]}
      />
      {guest && tab === 'send' && <div className="trade-warn" style={{ marginTop: 0, marginBottom: 10 }}>Tài khoản khách chưa gửi thư được.</div>}
      {tab === 'inbox' && <Inbox outpost={outpost} />}
      {tab === 'send' && <SendMail outpost={outpost} />}
      {tab === 'safe' && <SafeStorage outpost={outpost} />}
    </Window>
  );
}

export function ContractsWindow({ outpost }: { outpost: string }) {
  const [data, reload] = useAsync(() => call('contracts', { outpost }), [outpost]);
  const inv = useStore((s) => s.inv);
  const count = (id: string) => inv.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);
  return (
    <Window title="Bảng đơn hàng" sub={data ? `Ngày ${data.day} · Danh vọng ${data.rep}` : undefined} onClose={() => openWindow(null)} width={640}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        Trạm cần những mặt hàng đang thiếu. Mỗi đơn làm được một lần mỗi ngày game. Thưởng cao hơn bán cho NPC và tăng Danh vọng.
      </div>
      {!data && <div className="dim">Đang tải...</div>}
      {data && (
        <table className="list">
          <thead>
            <tr>
              <th>Cần</th>
              <th className="num">Có</th>
              <th className="num">Thưởng</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.list.map((c) => {
              const have = count(c.item);
              return (
                <tr key={c.id} style={{ opacity: c.done ? 0.45 : 1 }}>
                  <td>
                    <div className="item-cell">
                      <ItemIcon id={c.item} />
                      {itemName(c.item)} ×{c.qty}
                    </div>
                  </td>
                  <td className={`num ${have >= c.qty ? 'good' : ''}`}>{have}</td>
                  <td className="num gold">
                    {fmtXu(c.reward)} <span className="dim" style={{ fontSize: 12 }}>+{c.rep} DV</span>
                  </td>
                  <td>
                    {c.done ? (
                      <span className="good">✔ Xong</span>
                    ) : (
                      <button
                        className="small primary"
                        disabled={have < c.qty}
                        onClick={async () => {
                          await call('contract_deliver', { outpost, id: c.id });
                          reload();
                        }}
                      >
                        Giao hàng
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Window>
  );
}

export function TravelWindow({ outpost }: { outpost: string }) {
  const [list] = useAsync(() => call('travel_list', { outpost }), [outpost]);
  const xu = useStore((s) => s.xu);
  return (
    <Window title="Anh Dũng — Người dẫn đường" sub={<Xu n={xu} />} onClose={() => openWindow(null)} width={560}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        Dịch chuyển tới các trạm bạn đã khám phá. Phí tăng theo khoảng cách và khối lượng hàng mang theo.
      </div>
      {!list && <div className="dim">Đang tải...</div>}
      {list && (
        <table className="list">
          <tbody>
            {list.map((o) => (
              <tr key={o.id}>
                <td>
                  <b>{o.name}</b>
                  <div className="dim" style={{ fontSize: 11 }}>
                    ({o.x}, {o.y}) · Ring {o.ring}
                  </div>
                </td>
                <td>
                  {o.here ? (
                    <span className="dim">Bạn đang ở đây</span>
                  ) : (
                    <button
                      className="small primary"
                      disabled={o.fee > xu}
                      onClick={async () => {
                        if (await call('travel', { outpost, to: o.id })) openWindow(null);
                      }}
                    >
                      Đi — {fmtXu(o.fee)} Xu
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Window>
  );
}
