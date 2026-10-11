import {
  type EquipSlot,
  fmtXu,
  freshLabel,
  freshness,
  ITEMS,
  type ItemStack,
  type SlotRef,
  STATION_NAMES,
  upgradeMul,
} from '@suongdo/shared';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { iconUrl } from '../game/art/atlas';
import { net } from '../net/client';
import { useStore } from '../state/store';

// ───────────────────────── kéo thả ─────────────────────────

export interface DragFrom {
  ref: SlotRef;
  stack: ItemStack;
}

interface DragState {
  drag: DragFrom | null;
  x: number;
  y: number;
  tip: { stack: ItemStack; x: number; y: number; extra?: ReactNode } | null;
}

export const useDrag = create<DragState>(() => ({ drag: null, x: 0, y: 0, tip: null }));

let dragStart: { from: DragFrom; x: number; y: number } | null = null;

window.addEventListener('pointermove', (e) => {
  if (dragStart && !useDrag.getState().drag && Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) > 5) {
    useDrag.setState({ drag: dragStart.from, tip: null });
  }
  if (useDrag.getState().drag) useDrag.setState({ x: e.clientX, y: e.clientY });
});
window.addEventListener('pointerup', () => {
  dragStart = null;
  // thả ra ngoài ô nào: hủy kéo
  setTimeout(() => useDrag.setState({ drag: null }), 0);
});

export function DragLayer() {
  const { drag, x, y, tip } = useDrag();
  return (
    <>
      {drag && <img className="drag-ghost" src={iconUrl(drag.stack.id)} style={{ left: x, top: y }} alt="" />}
      {tip && !drag && <Tooltip stack={tip.stack} x={tip.x} y={tip.y} extra={tip.extra} />}
    </>
  );
}

function refEq(a: SlotRef, b: SlotRef): boolean {
  return a.c === b.c && a.i === b.i;
}

export function moveItem(from: SlotRef, to: SlotRef, half = false, stack?: ItemStack): void {
  if (refEq(from, to)) return;
  const n = half && stack && stack.n > 1 ? Math.ceil(stack.n / 2) : undefined;
  net.send({ t: 'mv', from, to, n });
}

// ───────────────────────── biểu tượng & ô đồ ─────────────────────────

export function ItemIcon({ id, size = 24 }: { id: string; size?: number }) {
  return <img src={iconUrl(id)} width={size} height={size} style={{ imageRendering: 'pixelated' }} alt={ITEMS[id]?.name ?? id} />;
}

export function itemName(s: ItemStack | string): string {
  const id = typeof s === 'string' ? s : s.id;
  const base = ITEMS[id]?.name ?? id;
  return typeof s !== 'string' && s.lv ? `${base} +${s.lv}` : base;
}

const RARITY_COLOR = (s: ItemStack): string => {
  const tier = ITEMS[s.id]?.tier ?? 0;
  if ((s.lv ?? 0) >= 5 || tier >= 4) return '#ff9a50';
  if (tier >= 3) return '#c890ff';
  if (tier >= 2) return '#7ab8ff';
  if (tier >= 1 || (s.q ?? 1) >= 1.1) return '#8ae09a';
  return '#f0e6e2';
};

interface SlotProps {
  stack: ItemStack | null;
  slotRef?: SlotRef;
  selected?: boolean;
  reserved?: boolean;
  hotkey?: string;
  placeholder?: string;
  small?: boolean;
  draggable?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onRightClick?: () => void;
  onShiftClick?: () => void;
  /** nhận đồ kéo tới */
  onDrop?: (from: DragFrom, half: boolean) => void;
  tipExtra?: ReactNode;
}

export function Slot(p: SlotProps) {
  const { stack } = p;
  const drag = useDrag((s) => s.drag);
  const now = useStore((s) => s.worldTime);
  const timer = useRef<number | null>(null);
  const def = stack ? ITEMS[stack.id] : undefined;
  const durPct = stack?.d !== undefined && stack.md ? Math.max(0, stack.d / stack.md) : null;
  const fr = stack && def?.food?.spoil ? freshness(stack, now) : null;
  const droppable = !!drag && !!p.onDrop && (!p.slotRef || !drag || !refEq(drag.ref, p.slotRef));
  return (
    <div
      className={`slot ${p.small ? 'small' : ''} ${p.selected ? 'sel' : ''} ${p.reserved ? 'reserved' : ''} ${droppable ? 'drop-ok' : ''}`}
      onPointerDown={(e) => {
        if (e.button !== 0 || !stack || !p.slotRef || p.draggable === false) return;
        dragStart = { from: { ref: p.slotRef, stack }, x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const d = useDrag.getState().drag;
        if (d && p.onDrop) {
          p.onDrop(d, e.ctrlKey || e.altKey);
          useDrag.setState({ drag: null });
          dragStart = null;
          e.stopPropagation();
        }
      }}
      onClick={(e) => {
        if (useDrag.getState().drag) return;
        if (e.shiftKey && p.onShiftClick) p.onShiftClick();
        else p.onClick?.(e);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        p.onRightClick?.();
      }}
      onPointerEnter={(e) => {
        if (!stack) return;
        const x = e.clientX;
        const y = e.clientY;
        timer.current = window.setTimeout(() => useDrag.setState({ tip: { stack, x, y, extra: p.tipExtra } }), 220);
      }}
      onPointerMove={(e) => {
        const t = useDrag.getState().tip;
        if (t) useDrag.setState({ tip: { ...t, x: e.clientX, y: e.clientY } });
      }}
      onPointerLeave={() => {
        if (timer.current) clearTimeout(timer.current);
        useDrag.setState({ tip: null });
      }}
    >
      {p.hotkey && <span className="key">{p.hotkey}</span>}
      {stack ? (
        <>
          <img src={iconUrl(stack.id)} alt="" draggable={false} />
          {stack.n > 1 && <span className="n">{stack.n}</span>}
          {!!stack.lv && <span className="lv">+{stack.lv}</span>}
          {durPct !== null && (
            <span className="dur">
              <i style={{ width: `${durPct * 100}%`, background: durPct > 0.5 ? '#6ad07a' : durPct > 0.2 ? '#f0b040' : '#ff5050' }} />
            </span>
          )}
          {fr !== null && <span className="fresh" style={{ background: fr >= 0.5 ? '#6ad07a' : fr >= 0.2 ? '#f0b040' : '#a04030' }} />}
        </>
      ) : (
        p.placeholder && <span className="ph">{p.placeholder}</span>
      )}
    </div>
  );
}

const CAT_NAMES: Record<string, string> = {
  resource: 'Tài nguyên',
  material: 'Vật liệu',
  food: 'Thức ăn',
  drink: 'Đồ uống',
  medicine: 'Thuốc',
  tool: 'Công cụ',
  weapon: 'Vũ khí',
  ammo: 'Đạn',
  armor: 'Trang bị',
  placeable: 'Công trình',
  seed: 'Hạt giống',
  special: 'Đặc biệt',
};

const SLOT_NAMES: Record<EquipSlot, string> = { head: 'Đầu', body: 'Thân', mask: 'Mặt nạ' };

export function Tooltip({ stack, x, y, extra }: { stack: ItemStack; x: number; y: number; extra?: ReactNode }) {
  const now = useStore((s) => s.worldTime);
  const def = ITEMS[stack.id];
  if (!def) return null;
  const mul = (stack.q ?? 1) * upgradeMul(stack.lv);
  const left = Math.min(x + 16, window.innerWidth - 290);
  const top = Math.min(y + 16, window.innerHeight - 220);
  const lines: ReactNode[] = [];
  if (def.weapon) {
    lines.push(
      <div key="w" className="stat">
        Sát thương {Math.round(def.weapon.dmg * mul)}
        {def.weapon.ranged ? ` · tầm ${def.weapon.ranged.range} ô · cần ${ITEMS[def.weapon.ranged.ammo]?.name}` : ` · tầm ${def.weapon.range} ô`}
        {` · hồi ${def.weapon.cd}s`}
      </div>,
    );
  }
  if (def.tool && def.tool.kind !== 'rod') lines.push(<div key="t" className="stat">Khai thác {Math.round(def.tool.power * mul)} · bậc {def.tool.tier}</div>);
  if (def.armor) {
    const a = def.armor;
    const parts = [`Ô: ${SLOT_NAMES[a.slot]}`];
    if (a.armor) parts.push(`Giáp ${Math.round(a.armor * mul)}`);
    if (a.warmth) parts.push(`Ấm +${a.warmth}°`);
    if (a.cooling) parts.push(`Mát −${a.cooling}°`);
    if (a.mist) parts.push(`Lọc Sương ${Math.round(a.mist * 100)}%`);
    lines.push(<div key="a" className="stat">{parts.join(' · ')}</div>);
  }
  if (def.food) {
    const f = def.food;
    const parts: string[] = [];
    if (f.hunger) parts.push(`Đói ${f.hunger > 0 ? '+' : ''}${f.hunger}`);
    if (f.thirst) parts.push(`Khát ${f.thirst > 0 ? '+' : ''}${f.thirst}`);
    if (f.hp) parts.push(`Máu ${f.hp > 0 ? '+' : ''}${f.hp}`);
    if (f.mist) parts.push(`Sương ${f.mist}%`);
    if (f.poison) parts.push(`Ngộ độc ${Math.round(f.poison * 100)}%`);
    if (parts.length) lines.push(<div key="f" className="stat">{parts.join(' · ')}</div>);
    if (f.spoil) {
      const fr = freshness(stack, now);
      lines.push(
        <div key="fr" style={{ color: fr >= 0.5 ? '#8ae09a' : fr >= 0.2 ? '#f0b040' : '#ff6a6a' }}>
          {freshLabel(fr)} ({Math.round(fr * 100)}%)
        </div>,
      );
    }
  }
  if (stack.d !== undefined && stack.md) lines.push(<div key="d">Độ bền {Math.ceil(stack.d)}/{stack.md}</div>);
  if (stack.q && stack.q !== 1) lines.push(<div key="q">Phẩm chất ×{stack.q.toFixed(2)}</div>);
  if (stack.lv) lines.push(<div key="lv" style={{ color: 'var(--accent-2)' }}>Cấp Sương +{stack.lv} (chỉ số ×{upgradeMul(stack.lv).toFixed(2)})</div>);
  if (def.place) lines.push(<div key="p" className="dim">Chọn trên thanh nhanh rồi bấm chuột để đặt.</div>);
  return (
    <div className="tooltip" style={{ left, top }}>
      <h5 style={{ color: RARITY_COLOR(stack) }}>
        {itemName(stack)}
        {stack.n > 1 ? ` ×${stack.n}` : ''}
      </h5>
      <div className="cat">
        {CAT_NAMES[def.cat] ?? def.cat}
        {def.tier !== undefined ? ` · Bậc ${def.tier}` : ''} · ~{fmtXu(def.price)} Xu
        {def.bound ? ' · Khóa' : ''}
      </div>
      {lines}
      {def.desc && <div className="desc">{def.desc}</div>}
      {extra}
    </div>
  );
}

// ───────────────────────── cửa sổ ─────────────────────────

export function Window({ title, sub, onClose, children, width }: { title: string; sub?: ReactNode; onClose: () => void; children: ReactNode; width?: number }) {
  return (
    <div
      className="window-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="window" style={{ width }} onPointerDown={(e) => e.stopPropagation()}>
        <div className="window-head">
          <h3>{title}</h3>
          {sub && <span className="sub">{sub}</span>}
          <button className="small ghost" onClick={onClose} title="Đóng (Esc)">
            ✕
          </button>
        </div>
        <div className="window-body">{children}</div>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, ReactNode][] }) {
  return (
    <div className="tabs">
      {items.map(([k, label]) => (
        <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Xu({ n }: { n: number }) {
  return (
    <span className="gold pixel" style={{ fontSize: 17 }}>
      {fmtXu(n)} Xu
    </span>
  );
}

export function useAsync<T>(fn: () => Promise<T | null>, deps: unknown[]): [T | null, () => void, boolean] {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fn().then((d) => {
      if (alive) {
        setData(d);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return [data, () => setTick((t) => t + 1), loading];
}

export function stationName(s?: string): string {
  return s ? (STATION_NAMES as Record<string, string>)[s] ?? s : 'Tay không';
}

export function NumberInput({ value, onChange, min = 1, max = 1_000_000, width = 80 }: { value: number; onChange: (n: number) => void; min?: number; max?: number; width?: number }) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : ''}
      min={min}
      max={max}
      style={{ width }}
      onChange={(e) => {
        const n = Math.floor(Number(e.target.value));
        onChange(Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min);
      }}
    />
  );
}
