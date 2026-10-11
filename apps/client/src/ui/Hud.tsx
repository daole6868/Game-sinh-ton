import {
  type ChatChannel,
  daysUntilBloodNight,
  dayOf,
  formatClock,
  isBloodNight,
  phaseOf,
  QUESTS,
  SEASON_NAMES,
  seasonOf,
  type StatusId,
  HOTBAR_SIZE,
} from '@suongdo/shared';
import { useEffect, useRef, useState } from 'react';
import { getScene } from '../game/PhaserGame';
import { isTyping } from '../game/input';
import { getWorld } from '../game/world';
import { isMuted, setMuted, sfx } from '../game/sound';
import { call, net } from '../net/client';
import { openWindow, useStore } from '../state/store';
import { DragLayer, moveItem, Slot } from './common';
import { drawMinimap } from './mapRender';
import { WindowRouter } from './WindowRouter';
import { TouchControls } from './TouchControls';

const STATUS_NAMES: Record<StatusId, [string, 'bad' | 'good']> = {
  poison: ['Ngộ độc', 'bad'],
  bleed: ['Chảy máu', 'bad'],
  wet: ['Ướt', 'bad'],
  warm: ['Ấm áp', 'good'],
  fed: ['No nê', 'good'],
};

const WEATHER_NAMES: Record<string, string> = { clear: 'Trời quang', rain: 'Mưa', fog: 'Sương mù', storm: 'Giông bão', heat: 'Nắng gắt' };

export function Hud() {
  return (
    <div className="hud">
      <StatBars />
      <div className="right-col">
        <Minimap />
        <QuestTracker />
      </div>
      <Hotbar />
      <WalletBox />
      <MenuButtons />
      <Chat />
      <Toasts />
      <Prompt />
      <Fps />
      <TradeInvite />
      <WindowRouter />
      <DeathScreen />
      <ConfirmDialog />
      <DragLayer />
      <TouchControls />
      <Hotkeys />
    </div>
  );
}

function Bar({ label, value, max, color, text }: { label: string; value: number; max: number; color: string; text?: string }) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div className="bar">
      <span>{label}</span>
      <div className="track">
        <div className="fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="val">{text ?? Math.round(value)}</span>
    </div>
  );
}

function StatBars() {
  const s = useStore((st) => st.snap);
  if (!s) return null;
  const tempPct = ((s.bt - 32) / 10) * 100;
  const tempColor = s.bt < 35 ? '#6ab0ff' : s.bt > 39 ? '#ff7a3a' : '#e8d070';
  return (
    <div className="stats">
      <Bar label="Máu" value={s.hp} max={s.mhp} color="linear-gradient(90deg,#b02a3a,#ff5a6a)" text={`${Math.round(s.hp)}`} />
      <Bar label="Đói" value={s.hu} max={100} color="linear-gradient(90deg,#9a5a1a,#f0a040)" />
      <Bar label="Khát" value={s.th} max={100} color="linear-gradient(90deg,#1a5aa0,#4aa8f0)" />
      <Bar label="Thể lực" value={s.st} max={100} color="linear-gradient(90deg,#3a8a3a,#7ad05a)" />
      <Bar label="Thân nhiệt" value={tempPct} max={100} color={tempColor} text={`${s.bt.toFixed(1)}°`} />
      {s.mi > 0.5 && <Bar label="Nhiễm Sương" value={s.mi} max={100} color="linear-gradient(90deg,#6a1a3a,#ff3a6a)" text={`${Math.round(s.mi)}%`} />}
      <div className="status-row">
        {s.fx.map((f) => (
          <span key={f} className={`chip ${STATUS_NAMES[f]?.[1] ?? ''}`}>
            {STATUS_NAMES[f]?.[0] ?? f}
          </span>
        ))}
        {s.w > 120 && <span className="chip bad">Quá tải {Math.round(s.w)}kg</span>}
        {s.pvp && <span className="chip bad">⚔ PvP</span>}
        <span className="chip">Cảm nhận {s.amb}°C</span>
      </div>
    </div>
  );
}

function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const zone = useStore((s) => s.zone);
  const wt = useStore((s) => s.worldTime);
  const weather = useStore((s) => s.weather);
  const day = dayOf(wt);
  const until = daysUntilBloodNight(day);
  const blood = isBloodNight(wt);
  useEffect(() => {
    const id = setInterval(() => {
      const w = getWorld();
      const c = ref.current;
      const z = useStore.getState().zone;
      if (!w || !c) return;
      const ctx = c.getContext('2d')!;
      drawMinimap(ctx, w, z.x, z.y, 90);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(44, 44, 3, 3);
      ctx.fillStyle = '#e0304a';
      ctx.fillRect(45, 45, 1, 1);
    }, 500);
    return () => clearInterval(id);
  }, []);
  const phase = phaseOf(wt);
  return (
    <div className="mini">
      <canvas ref={ref} width={90} height={90} onClick={() => openWindow({ kind: 'map' })} title="Mở bản đồ (M)" />
      <div className="row">
        <span className="zone" style={{ color: zone.color }}>
          {zone.name}
        </span>
        <span>Ring {zone.ring}</span>
      </div>
      <div className="row">
        <span>{zone.biome}</span>
        <span>
          {zone.x}, {zone.y}
        </span>
      </div>
      <div className="row">
        <span>
          Ngày {day} · {SEASON_NAMES[seasonOf(day)]}
        </span>
        <span className="clock">
          {formatClock(wt)}
          {phase === 'night' ? ' ☾' : ''}
        </span>
      </div>
      <div className="row">
        <span>{WEATHER_NAMES[weather] ?? weather}</span>
      </div>
      <div className="blood">{blood ? '🌕 ĐÊM SƯƠNG ĐỎ!' : until === 0 ? '⚠ Đêm Sương Đỏ: ĐÊM NAY' : `Đêm Sương Đỏ: còn ${until} ngày`}</div>
    </div>
  );
}

function QuestTracker() {
  const q = useStore((s) => s.quest);
  const def = QUESTS[q.idx];
  return (
    <div className="quest">
      {def ? (
        <>
          <h4>
            ✦ {def.title} {q.progress ? `(${q.progress})` : ''}
          </h4>
          <p>{def.hint}</p>
          <p className="gold" style={{ marginTop: 4 }}>
            Thưởng: {def.reward} Xu
          </p>
        </>
      ) : (
        <>
          <h4>✦ Huyền thoại</h4>
          <p>Bạn đã hoàn thành mọi nhiệm vụ cột mốc. Hãy tiến sâu hơn vào Sương!</p>
        </>
      )}
    </div>
  );
}

function Hotbar() {
  const inv = useStore((s) => s.inv);
  const sel = useStore((s) => s.sel);
  const reserved = useStore((s) => s.reserved);
  return (
    <div className="hotbar">
      {Array.from({ length: HOTBAR_SIZE }, (_, i) => (
        <Slot
          key={i}
          stack={inv[i] ?? null}
          slotRef={{ c: 'inv', i }}
          selected={sel === i}
          reserved={reserved.includes(i)}
          hotkey={String(i + 1)}
          onClick={() => useStore.setState({ sel: i })}
          onRightClick={() => net.send({ t: 'use', i })}
          onDrop={(from, half) => moveItem(from.ref, { c: 'inv', i }, half, from.stack)}
        />
      ))}
    </div>
  );
}

function WalletBox() {
  const xu = useStore((s) => s.xu);
  const prev = useRef(xu);
  useEffect(() => {
    if (xu > prev.current) sfx('coin');
    prev.current = xu;
  }, [xu]);
  return (
    <div className="wallet" title="Xu — tiền tệ trong game">
      {xu.toLocaleString('vi-VN')} <small>Xu</small>
    </div>
  );
}

function MenuButtons() {
  const mail = useStore((s) => s.mailUnread);
  const guest = useStore((s) => s.me?.guest);
  const [muted, setM] = useState(isMuted());
  return (
    <div className="menu-btns">
      <button onClick={() => openWindow({ kind: 'inventory', tab: 'craft' })} title="Túi đồ & chế tạo (Tab)">
        🎒 Túi
      </button>
      <button onClick={() => openWindow({ kind: 'inventory', tab: 'skills' })} title="Kỹ năng (K)">
        ★
      </button>
      <button onClick={() => openWindow({ kind: 'map' })} title="Bản đồ (M)">
        🗺
      </button>
      <button onClick={() => openWindow({ kind: 'leaderboard' })} title="Bảng xếp hạng (L)">
        🏆
      </button>
      <button title={mail ? `${mail} thư chờ nhận ở Thủ kho` : 'Hòm thư (ở trạm)'}>
        ✉{mail > 0 && <span className="badge">{mail}</span>}
      </button>
      {guest && (
        <button className="primary" onClick={() => openWindow({ kind: 'account' })} title="Đăng ký để giữ tiến trình">
          Đăng ký
        </button>
      )}
      <button
        onClick={() => {
          setMuted(!muted);
          setM(!muted);
        }}
        title="Âm thanh"
      >
        {muted ? '🔇' : '🔊'}
      </button>
      <button onClick={() => openWindow({ kind: 'help' })} title="Trợ giúp (H)">
        ?
      </button>
    </div>
  );
}

const CH_LABEL: Record<ChatChannel, string> = { local: 'Gần', global: 'Toàn', trade: 'Mua bán', whisper: 'Riêng', system: '' };

function Chat() {
  const lines = useStore((s) => s.chat);
  const open = useStore((s) => s.chatOpen);
  const [ch, setCh] = useState<ChatChannel>('local');
  const [text, setText] = useState('');
  const [active, setActive] = useState(Date.now());
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
    setActive(Date.now());
  }, [lines.length]);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 2000);
    return () => clearInterval(id);
  }, []);
  const faded = !open && Date.now() - active > 12_000;
  const shown = open ? lines.slice(-60) : lines.slice(-8);
  return (
    <div className="chat">
      <div className={`chat-log ${faded ? 'faded' : ''}`} ref={logRef} style={{ opacity: faded ? 0.35 : 1 }}>
        {shown.map((l) => (
          <div key={l.id} className={`chat-line ${l.ch}`}>
            {l.ch !== 'system' && <span className="ch dim">[{CH_LABEL[l.ch]}] </span>}
            {l.ch === 'system' ? (
              <span style={{ whiteSpace: 'pre-wrap' }}>{l.text}</span>
            ) : (
              <>
                <span className="from">{l.from}:</span> {l.text}
              </>
            )}
          </div>
        ))}
      </div>
      {open && (
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) net.send({ t: 'chat', ch, text: text.trim() });
            setText('');
            useStore.setState({ chatOpen: false });
            inputRef.current?.blur();
          }}
        >
          <div className="chat-tabs">
            {(['local', 'global', 'trade'] as ChatChannel[]).map((c) => (
              <button type="button" key={c} className={ch === c ? 'on' : ''} onClick={() => setCh(c)}>
                {CH_LABEL[c]}
              </button>
            ))}
          </div>
          <input
            ref={inputRef}
            value={text}
            maxLength={200}
            placeholder="Nhập tin nhắn... (/help xem lệnh)"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                useStore.setState({ chatOpen: false });
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        </form>
      )}
    </div>
  );
}

function Toasts() {
  const notes = useStore((s) => s.notes);
  return (
    <div className="toasts">
      {notes.map((n) => (
        <div key={n.id} className={`toast ${n.kind}`}>
          {n.text}
        </div>
      ))}
    </div>
  );
}

function Prompt() {
  const p = useStore((s) => s.prompt);
  const demolish = useStore((s) => s.demolish);
  if (demolish)
    return (
      <div className="prompt" style={{ borderColor: 'var(--bad)' }}>
        <kbd>B</kbd> Chế độ tháo dỡ — bấm vào công trình để tháo
      </div>
    );
  if (!p) return null;
  return (
    <div className="prompt">
      <kbd>E</kbd>
      {p}
    </div>
  );
}

function Fps() {
  const fps = useStore((s) => s.fps);
  return <div className="fps">{fps} FPS</div>;
}

function TradeInvite() {
  const inv = useStore((s) => s.tradeInvite);
  if (!inv) return null;
  const respond = (accept: boolean) => {
    void call('trade_respond', { from: inv.id, accept });
    useStore.setState({ tradeInvite: null });
  };
  return (
    <div className="invite">
      <span>
        <b>{inv.name}</b> muốn giao dịch với bạn.
      </span>
      <button className="good small" onClick={() => respond(true)}>
        Đồng ý
      </button>
      <button className="small" onClick={() => respond(false)}>
        Từ chối
      </button>
    </div>
  );
}

function DeathScreen() {
  const dead = useStore((s) => s.dead);
  if (!dead) return null;
  return (
    <div className="death">
      <div className="death-card">
        <h2>BẠN ĐÃ GỤC NGÃ</h2>
        <p className="muted">{dead.cause}</p>
        {dead.days > 0 && <p>Sống sót được {dead.days.toFixed(1)} ngày.</p>}
        {dead.hardcore ? (
          <>
            <p className="bad">Chế độ Hardcore: nhân vật đã chết vĩnh viễn.</p>
            <NewCharInline />
          </>
        ) : (
          <>
            <p className="dim">Túi hành trang đã rơi tại chỗ chết (giữ 30 phút). Trang bị đang mặc mất 10% độ bền.</p>
            <div className="btns">
              {dead.bed && (
                <button className="primary" onClick={() => net.send({ t: 'respawn', at: 'bed' })}>
                  Hồi sinh tại giường / túi ngủ
                </button>
              )}
              <button className={dead.bed ? '' : 'primary'} onClick={() => net.send({ t: 'respawn', at: 'outpost' })}>
                Hồi sinh ở trạm gần nhất
              </button>
              <button onClick={() => net.send({ t: 'respawn', at: 'random' })}>Hồi sinh ngẫu nhiên ở Vùng Rìa</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NewCharInline() {
  const [name, setName] = useState('');
  return (
    <form
      className="btns"
      onSubmit={(e) => {
        e.preventDefault();
        net.send({ t: 'newchar', name: name.trim() });
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên nhân vật mới" maxLength={16} />
      <button className="primary" disabled={name.trim().length < 3}>
        Bắt đầu lại
      </button>
    </form>
  );
}

function ConfirmDialog() {
  const c = useStore((s) => s.confirm);
  if (!c) return null;
  const close = () => useStore.setState({ confirm: null });
  return (
    <div className="dialog" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="dialog-card">
        <p>{c.text}</p>
        <div className="btns">
          <button onClick={close}>Hủy</button>
          <button
            className="primary"
            autoFocus
            onClick={() => {
              close();
              c.ok();
            }}
          >
            {c.okLabel ?? 'Đồng ý'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Phím tắt mở/đóng cửa sổ. */
function Hotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState();
      if (e.key === 'Escape') {
        if (st.confirm) useStore.setState({ confirm: null });
        else if (st.container) {
          net.send({ t: 'close' });
          useStore.setState({ container: null });
        } else if (st.window) useStore.setState({ window: null });
        else if (st.demolish) useStore.setState({ demolish: false });
        return;
      }
      if (isTyping(e) || st.chatOpen) return;
      const toggle = (w: Parameters<typeof openWindow>[0]) => {
        const cur = useStore.getState().window;
        openWindow(cur && w && cur.kind === w.kind && (!('tab' in w) || (cur as { tab?: string }).tab === w.tab) ? null : w);
      };
      switch (e.code) {
        case 'Enter':
          e.preventDefault();
          useStore.setState({ chatOpen: true });
          break;
        case 'Tab':
        case 'KeyI':
        case 'KeyC':
          e.preventDefault();
          toggle({ kind: 'inventory', tab: 'craft' });
          break;
        case 'KeyK':
          toggle({ kind: 'inventory', tab: 'skills' });
          break;
        case 'KeyJ':
          toggle({ kind: 'inventory', tab: 'quests' });
          break;
        case 'KeyM':
          toggle({ kind: 'map' });
          break;
        case 'KeyL':
          toggle({ kind: 'leaderboard' });
          break;
        case 'KeyH':
        case 'F1':
          e.preventDefault();
          toggle({ kind: 'help' });
          break;
        case 'KeyP': {
          const s = st.snap;
          if (s) net.send({ t: 'pvp', on: !s.pvp });
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // giữ scene biết đang mở cửa sổ (để không đánh nhầm khi bấm vào giao diện)
  useEffect(() => {
    void getScene;
  }, []);
  return null;
}
