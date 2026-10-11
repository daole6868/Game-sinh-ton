import { countItem, fmtXu, ITEMS, type LeaderRow, type StallView, upgradeCost, upgradeMul } from '@suongdo/shared';
import { useEffect, useRef, useState } from 'react';
import { getWorld } from '../../game/world';
import { api, call, newKey } from '../../net/client';
import { note, openWindow, saveAuth, useStore } from '../../state/store';
import { ItemIcon, itemName, NumberInput, Slot, Tabs, useAsync, Window, Xu } from '../common';
import { drawOverlay, drawWorldMap, type MapView } from '../mapRender';
import { CraftingPanel, InventoryGrid } from './InventoryWindow';

// ───────────────────────── Cột Lãnh Thổ ─────────────────────────

export function TotemWindow({ tx, ty }: { tx: number; ty: number }) {
  const [info, reload] = useAsync(() => call('totem_info', { tx, ty }), [tx, ty]);
  const me = useStore((s) => s.me);
  const [name, setName] = useState('');
  const mine = info?.territory.o === me?.id;
  return (
    <Window title="Cột Lãnh Thổ" sub={info ? `của ${info.territory.on}` : undefined} onClose={() => openWindow(null)} width={460}>
      {!info && <div className="dim">Đang tải...</div>}
      {info && (
        <div style={{ lineHeight: 1.7 }}>
          <div>
            Bán kính: <b>{info.territory.r} ô</b> · Công trình: <b>{info.structures}</b>
          </div>
          <div>
            Phí bảo trì: <b className="gold">{info.upkeep} Xu / ngày game</b> (trừ tự động từ ví chủ)
          </div>
          {info.debt > 0 && <div className="bad">Đang nợ {info.debt} ngày — quá 7 ngày công trình sẽ xuống cấp!</div>}
          <p className="section-title" style={{ marginTop: 10 }}>
            Người được cấp quyền (mở cửa, rương, xây dựng)
          </p>
          {info.authNames.length === 0 && <div className="dim">Chưa có ai.</div>}
          {info.authNames.map((a) => (
            <div key={a.id} className="row">
              <span>{a.name}</span>
              <span className="spacer" />
              {mine && (
                <button
                  className="small"
                  onClick={async () => {
                    await call('totem_auth', { tx, ty, name: a.name, add: false });
                    reload();
                  }}
                >
                  Bỏ quyền
                </button>
              )}
            </div>
          ))}
          {mine && (
            <div className="row" style={{ marginTop: 8 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên người chơi" />
              <button
                className="primary small"
                disabled={!name.trim()}
                onClick={async () => {
                  if (await call('totem_auth', { tx, ty, name: name.trim(), add: true })) setName('');
                  reload();
                }}
              >
                Cấp quyền
              </button>
            </div>
          )}
        </div>
      )}
    </Window>
  );
}

// ───────────────────────── Sạp hàng ─────────────────────────

export function StallWindow({ tx, ty }: { tx: number; ty: number }) {
  const [view, reload] = useAsync<StallView>(() => call('stall_view', { tx, ty }), [tx, ty]);
  const inv = useStore((s) => s.inv);
  const xu = useStore((s) => s.xu);
  const [pick, setPick] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(10);
  return (
    <Window title="Sạp hàng" sub={view ? `của ${view.owner}` : undefined} onClose={() => openWindow(null)} width={view?.mine ? 820 : 520}>
      {!view && <div className="dim">Đang tải...</div>}
      {view && (
        <div className="cols">
          <div style={{ minWidth: 320 }}>
            <table className="list">
              <tbody>
                {view.items.map((e) => (
                  <tr key={e.slot}>
                    <td>
                      <div className="item-cell">
                        <Slot stack={e.stack} small />
                        {itemName(e.stack)} {e.stack.n > 1 ? `×${e.stack.n}` : ''}
                      </div>
                    </td>
                    <td className="num gold">{fmtXu(e.price)}</td>
                    <td>
                      {view.mine ? (
                        <button
                          className="small"
                          onClick={async () => {
                            await call('stall_take', { tx, ty, slot: e.slot });
                            reload();
                          }}
                        >
                          Lấy lại
                        </button>
                      ) : (
                        <button
                          className="small primary"
                          disabled={e.price > xu}
                          onClick={async () => {
                            if (await call('stall_buy', { tx, ty, slot: e.slot, key: newKey() })) note('Đã mua!', 'good');
                            reload();
                          }}
                        >
                          Mua
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {view.items.length === 0 && (
                  <tr>
                    <td className="dim">Sạp đang trống.</td>
                  </tr>
                )}
              </tbody>
            </table>
            {view.mine && (
              <div style={{ marginTop: 10, padding: 10, border: '1px solid var(--line)', borderRadius: 6 }}>
                <p className="section-title">Bày hàng (thuế 3% khi bán được)</p>
                {pick === null || !inv[pick] ? (
                  <div className="dim">Bấm vào một món trong túi bên phải.</div>
                ) : (
                  <>
                    <div className="item-cell">
                      <ItemIcon id={inv[pick]!.id} /> {itemName(inv[pick]!)}
                    </div>
                    <div className="row" style={{ marginTop: 6 }}>
                      SL <NumberInput value={qty} max={inv[pick]!.n} onChange={setQty} width={60} /> Giá cả chồng <NumberInput value={price} onChange={setPrice} width={90} />
                      <button
                        className="small primary"
                        onClick={async () => {
                          await call('stall_put', { tx, ty, slot: pick, qty: Math.min(qty, inv[pick]!.n), price });
                          setPick(null);
                          reload();
                        }}
                      >
                        Bày bán
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          {view.mine && (
            <InventoryGrid
              onPick={(i, s) => {
                setPick(i);
                setQty(s.n);
                setPrice(Math.max(1, (ITEMS[s.id]?.price ?? 10) * s.n));
              }}
              highlight={(i) => i === pick}
            />
          )}
        </div>
      )}
    </Window>
  );
}

// ───────────────────────── Lò Tinh thể ─────────────────────────

export function ForgeWindow({ tx, ty }: { tx: number; ty: number }) {
  const [tab, setTab] = useState<'craft' | 'upgrade'>('upgrade');
  const inv = useStore((s) => s.inv);
  const [pick, setPick] = useState<number | null>(null);
  const it = pick !== null ? inv[pick] : null;
  const def = it ? ITEMS[it.id] : undefined;
  const ok = !!def && def.durability !== undefined && (def.tier ?? 0) >= 1 && (!!def.weapon || !!def.armor || !!def.tool);
  const lv = it?.lv ?? 0;
  const cost = upgradeCost(lv);
  const have = countItem(inv, 'mist_crystal');
  return (
    <Window title="Lò Tinh thể" sub="Chế đồ Sương · Cường hóa Cấp Sương" onClose={() => openWindow(null)}>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          ['upgrade', 'Cường hóa'],
          ['craft', 'Chế tạo đồ Sương'],
        ]}
      />
      {tab === 'craft' ? (
        <CraftingPanel only="crystal_forge" />
      ) : (
        <div className="cols">
          <div style={{ width: 300, lineHeight: 1.6 }}>
            {!it ? (
              <div className="dim">Chọn một vũ khí, giáp hoặc công cụ (bậc 1 trở lên) trong túi.</div>
            ) : (
              <>
                <div className="item-cell" style={{ fontSize: 15 }}>
                  <Slot stack={it} small /> <b>{itemName(it)}</b>
                </div>
                {!ok && <div className="bad">Món này không cường hóa được.</div>}
                {ok && (
                  <>
                    <div>
                      Cấp Sương: +{lv} → <b className="gold">+{lv + 1}</b>
                    </div>
                    <div>
                      Chỉ số: ×{upgradeMul(lv).toFixed(2)} → <b className="good">×{upgradeMul(lv + 1).toFixed(2)}</b>
                    </div>
                    <div>
                      Cần: <b className={have >= cost ? 'good' : 'bad'}>{cost} Tinh thể Sương</b> (có {have})
                    </div>
                    <button
                      className="primary"
                      style={{ marginTop: 8 }}
                      disabled={have < cost}
                      onClick={async () => {
                        const r = await call('upgrade', { tx, ty, slot: pick! });
                        if (r) note(`Cường hóa thành công: +${r.lv}!`, 'good');
                      }}
                    >
                      Cường hóa
                    </button>
                  </>
                )}
              </>
            )}
            <p className="dim" style={{ fontSize: 12, marginTop: 10 }}>
              Mỗi cấp +6% chỉ số. Chi phí tăng ×1,25 mỗi cấp — tinh thể cấp cao chỉ có ở vùng sâu hơn. Không có giới hạn cấp.
            </p>
          </div>
          <InventoryGrid onPick={(i) => setPick(i)} highlight={(i) => i === pick} />
        </div>
      )}
    </Window>
  );
}

// ───────────────────────── Bản đồ ─────────────────────────

const SCALES = [1, 2, 4, 8, 16, 32, 64];

export function MapWindow() {
  const ref = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const zone = useStore((s) => s.zone);
  const seed = useStore((s) => s.seed);
  const discovered = useStore((s) => s.discovered);
  const territories = useStore((s) => s.territories);
  const myChar = useStore((s) => s.me?.id ?? 0);
  const [view, setView] = useState<MapView>({ cx: zone.x, cy: zone.y, scale: 4 });
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const SIZE = 320;
  useEffect(() => {
    const w = getWorld();
    const c = ref.current;
    if (!w || !c) return;
    const ctx = c.getContext('2d')!;
    const gen = drawWorldMap(ctx, w, view, SIZE);
    let raf = 0;
    const step = () => {
      const t0 = performance.now();
      while (performance.now() - t0 < 10) {
        if (gen.next().done) return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [view]);
  useEffect(() => {
    const c = overlay.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, SIZE * 2, SIZE * 2);
    ctx.save();
    ctx.scale(2, 2);
    drawOverlay(ctx, seed, view, SIZE, { me: { x: zone.x, y: zone.y }, discovered: new Set(discovered), territories, myChar });
    ctx.restore();
  }, [view, zone.x, zone.y, seed, discovered, territories, myChar]);
  const zoomBy = (d: number) => {
    const i = Math.max(0, Math.min(SCALES.length - 1, SCALES.indexOf(view.scale) + d));
    setView({ ...view, scale: SCALES[i]! });
  };
  return (
    <Window title="Bản đồ" sub={`Bạn đang ở (${zone.x}, ${zone.y}) · ${zone.name}`} onClose={() => openWindow(null)}>
      <div
        style={{ position: 'relative', width: 640, height: 640, maxWidth: '80vw', maxHeight: '70vh', aspectRatio: '1', cursor: 'grab' }}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d) return;
          const el = e.currentTarget.getBoundingClientRect();
          const k = (SIZE / el.width) * view.scale;
          setView({ ...view, cx: Math.round(d.cx - (e.clientX - d.x) * k), cy: Math.round(d.cy - (e.clientY - d.y) * k) });
        }}
        onWheel={(e) => zoomBy(e.deltaY > 0 ? 1 : -1)}
      >
        <canvas ref={ref} width={SIZE} height={SIZE} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated' }} />
        <canvas ref={overlay} width={SIZE * 2} height={SIZE * 2} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="small" onClick={() => zoomBy(-1)}>
          ＋ Phóng to
        </button>
        <button className="small" onClick={() => zoomBy(1)}>
          － Thu nhỏ
        </button>
        <button className="small" onClick={() => setView({ ...view, cx: zone.x, cy: zone.y })}>
          Về vị trí của tôi
        </button>
        <button className="small" onClick={() => setView({ cx: 0, cy: 0, scale: 32 })}>
          Toàn cảnh
        </button>
        <span className="spacer" />
        <span className="dim" style={{ fontSize: 11 }}>
          ■ Trạm (vàng: đã khám phá) · Vòng: ranh giới độ sâu · Kéo để di chuyển, cuộn để phóng
        </span>
      </div>
    </Window>
  );
}

// ───────────────────────── Bảng xếp hạng ─────────────────────────

type LbKind = 'days' | 'wealth' | 'ring' | 'blood' | 'hall';
const LB_LABEL: Record<LbKind, [string, string]> = {
  days: ['Ngày sống sót', 'ngày'],
  wealth: ['Giàu nhất', 'Xu'],
  ring: ['Đi xa nhất', 'Ring'],
  blood: ['Đêm Sương Đỏ', 'đêm liên tiếp'],
  hall: ['Bảng Vinh Danh (Hardcore)', 'ngày'],
};

export function LeaderboardWindow() {
  const [kind, setKind] = useState<LbKind>('days');
  const [rows] = useAsync<LeaderRow[]>(() => call('leaderboard', { kind }), [kind]);
  const me = useStore((s) => s.me?.name);
  return (
    <Window title="Bảng xếp hạng" onClose={() => openWindow(null)} width={520}>
      <Tabs value={kind} onChange={setKind} items={(Object.keys(LB_LABEL) as LbKind[]).map((k) => [k, LB_LABEL[k][0]])} />
      <table className="list">
        <tbody>
          {(rows ?? []).map((r, i) => (
            <tr key={r.name} className={r.name === me ? 'on' : ''}>
              <td className="num" style={{ width: 40 }}>
                {i + 1}
              </td>
              <td>{r.name}</td>
              <td className="num gold">
                {kind === 'wealth' ? fmtXu(r.value) : r.value} <span className="dim" style={{ fontSize: 12 }}>{LB_LABEL[kind][1]}</span>
              </td>
            </tr>
          ))}
          {rows && rows.length === 0 && (
            <tr>
              <td className="dim">Chưa có dữ liệu.</td>
            </tr>
          )}
        </tbody>
      </table>
    </Window>
  );
}

// ───────────────────────── Trợ giúp ─────────────────────────

export function HelpWindow() {
  return (
    <Window title="Hướng dẫn" onClose={() => openWindow(null)} width={720}>
      <div className="cols" style={{ alignItems: 'flex-start', lineHeight: 1.65, fontSize: 13 }}>
        <div style={{ flex: 1 }}>
          <p className="section-title">Điều khiển</p>
          <div><kbd>W A S D</kbd> di chuyển · <kbd>Shift</kbd> chạy · <kbd>Space</kbd> lướt né</div>
          <div><kbd>Chuột trái</kbd> đánh / chặt / đặt công trình (giữ để lặp)</div>
          <div><kbd>Chuột phải</kbd> tương tác chỗ con trỏ / dùng đồ trên tay</div>
          <div><kbd>E</kbd> tương tác (NPC, rương, giường, lửa...) · <kbd>F</kbd> dùng đồ trên tay</div>
          <div><kbd>1–8</kbd> / cuộn chuột: chọn ô · <kbd>Q</kbd> vứt (Shift+Q cả chồng)</div>
          <div><kbd>Tab</kbd> túi đồ & chế tạo · <kbd>K</kbd> kỹ năng · <kbd>J</kbd> nhiệm vụ</div>
          <div><kbd>M</kbd> bản đồ · <kbd>L</kbd> xếp hạng · <kbd>B</kbd> tháo dỡ · <kbd>P</kbd> cờ PvP</div>
          <div><kbd>Enter</kbd> chat (/w tên — nhắn riêng, /stuck — thoát kẹt) · <kbd>Esc</kbd> đóng</div>
          <p className="section-title" style={{ marginTop: 10 }}>
            Sinh tồn
          </p>
          <div>• Đói, khát giảm dần. Nước hồ uống trực tiếp dễ ngộ độc — múc bằng Bình da rồi đun ở lửa trại.</div>
          <div>• Thịt sống nên nướng. Đồ ăn hỏng dần (chấm màu ở góc ô đồ).</div>
          <div>• Đêm tối và lạnh: đứng gần lửa, mặc đồ ấm. Mưa làm bạn bị ướt.</div>
          <div>• Đi xa tâm thế giới thì Sương dày dần — đeo khẩu trang / mặt nạ, mang Huyết thanh.</div>
        </div>
        <div style={{ flex: 1 }}>
          <p className="section-title">Thế giới</p>
          <div>• <b style={{ color: '#8fd18b' }}>Vùng Rìa</b> (&lt;1.000 ô): an toàn, không PvP.</div>
          <div>• <b style={{ color: '#b8b8c8' }}>Vùng Xám</b> (1.000–3.000): PvP khi cả hai bật cờ.</div>
          <div>• <b style={{ color: '#ff6b6b' }}>Vùng Đỏ</b> (3.000–6.000): PvP bật, trừ trong trạm và lãnh thổ. Phá được căn cứ.</div>
          <div>• <b style={{ color: '#c06bff' }}>Vùng Thẳm</b> (&gt;6.000, vô hạn): PvP toàn phần, quái mạnh mãi.</div>
          <div>• Cứ 7 ngày game có <b className="bad">Đêm Sương Đỏ</b>: quái tràn vào 3 đợt. Sống sót để nhận Rương Sương Đỏ.</div>
          <p className="section-title" style={{ marginTop: 10 }}>
            Kinh tế
          </p>
          <div>• NPC ở trạm mua bán với giá thay đổi theo cung cầu cả server. Có hạn mức bán mỗi ngày.</div>
          <div>• <b>Sàn giao dịch</b>: đặt lệnh mua/bán, hàng gửi qua hòm thư. Thuế 5%.</div>
          <div>• Đứng gần người khác, nhấn <kbd>E</kbd> để mời <b>giao dịch trực tiếp</b>.</div>
          <div>• <b>Hòm thư</b>: gửi đồ, gửi Xu, hoặc gửi hàng thu tiền khi nhận.</div>
          <div>• <b>Sạp hàng</b>: bày bán ở căn cứ, người khác mua được khi bạn offline.</div>
          <div>• Cột Lãnh Thổ bảo vệ căn cứ, tốn phí bảo trì mỗi ngày.</div>
        </div>
      </div>
    </Window>
  );
}

// ───────────────────────── Đăng ký tài khoản (khách) ─────────────────────────

export function AccountWindow() {
  const auth = useStore((s) => s.auth);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <Window title="Đăng ký tài khoản" onClose={() => openWindow(null)} width={400}>
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
        Giữ nguyên nhân vật, đồ đạc và Xu hiện tại. Sau khi đăng ký bạn dùng được Sàn giao dịch và Hòm thư.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!auth) return;
          try {
            const r = await api<{ username: string }>('/api/upgrade', { username: username.trim(), password }, auth.token);
            const next = { ...auth, username: r.username, guest: false };
            saveAuth(next);
            useStore.setState({ auth: next });
            note('Đăng ký thành công!', 'good');
            openWindow(null);
          } catch (ex) {
            setErr((ex as Error).message);
          }
        }}
      >
        <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <input placeholder="Tên đăng nhập (cũng là tên nhân vật)" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={16} />
          <input type="password" placeholder="Mật khẩu (≥ 6 ký tự)" value={password} onChange={(e) => setPassword(e.target.value)} />
          {err && <div className="bad">{err}</div>}
          <button className="primary" disabled={!username || password.length < 6}>
            Đăng ký
          </button>
        </div>
      </form>
    </Window>
  );
}

export { Xu };
