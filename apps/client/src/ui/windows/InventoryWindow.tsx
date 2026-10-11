import {
  countItem,
  EQUIP_SLOTS,
  type EquipSlot,
  HOTBAR_SIZE,
  INVENTORY_SIZE,
  ITEMS,
  QUESTS,
  type Recipe,
  RECIPES,
  SKILL_DESC,
  SKILL_IDS,
  SKILL_NAMES,
  STATION_RANGE,
  type StationId,
  STRUCTURES,
  type ItemStack,
  xpToNext,
} from '@suongdo/shared';
import { useMemo, useState } from 'react';
import { getWorld } from '../../game/world';
import { net } from '../../net/client';
import { openWindow, useStore } from '../../state/store';
import { ItemIcon, itemName, moveItem, Slot, stationName, Tabs, Window } from '../common';

const EQ_LABEL: Record<EquipSlot, string> = { head: 'Đầu', body: 'Thân', mask: 'Mặt nạ' };

/** Lưới 32 ô túi đồ (8 ô đầu là thanh nhanh). */
export function InventoryGrid({ onPick, highlight }: { onPick?: (i: number, s: ItemStack) => void; highlight?: (i: number) => boolean }) {
  const inv = useStore((s) => s.inv);
  const sel = useStore((s) => s.sel);
  const reserved = useStore((s) => s.reserved);
  const container = useStore((s) => s.container);
  const quickMove = (i: number) => {
    const s = inv[i];
    if (!s) return;
    if (container) {
      // chuyển sang rương: ô cùng loại còn chỗ, hoặc ô trống đầu tiên
      const target = container.slots.findIndex((c) => c && c.id === s.id && !c.u && (ITEMS[c.id]?.stack ?? 1) > c.n);
      const empty = container.slots.findIndex((c) => !c);
      const to = target >= 0 ? target : empty;
      if (to >= 0 && container.kind !== 'bag') net.send({ t: 'mv', from: { c: 'inv', i }, to: { c: 'cont', i: to } });
      return;
    }
    const range = i < HOTBAR_SIZE ? [HOTBAR_SIZE, INVENTORY_SIZE] : [0, HOTBAR_SIZE];
    for (let j = range[0]!; j < range[1]!; j++) {
      if (!inv[j]) {
        net.send({ t: 'mv', from: { c: 'inv', i }, to: { c: 'inv', i: j } });
        return;
      }
    }
  };
  return (
    <div>
      <div className="grid">
        {Array.from({ length: INVENTORY_SIZE }, (_, i) => (
          <Slot
            key={i}
            stack={inv[i] ?? null}
            slotRef={{ c: 'inv', i }}
            selected={i === sel || highlight?.(i)}
            reserved={reserved.includes(i)}
            hotkey={i < HOTBAR_SIZE ? String(i + 1) : undefined}
            onClick={() => (onPick && inv[i] ? onPick(i, inv[i]!) : i < HOTBAR_SIZE && useStore.setState({ sel: i }))}
            onRightClick={() => net.send({ t: 'use', i })}
            onShiftClick={() => quickMove(i)}
            onDrop={(from, half) => moveItem(from.ref, { c: 'inv', i }, half, from.stack)}
          />
        ))}
      </div>
      <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>
        Kéo thả để sắp xếp · Ctrl+thả: chia đôi · Shift+bấm: chuyển nhanh · Chuột phải: dùng / mặc · Q: vứt (Shift+Q cả chồng)
      </div>
    </div>
  );
}

export function EquipmentPanel() {
  const eq = useStore((s) => s.eq);
  return (
    <div className="row" style={{ gap: 6 }}>
      {EQUIP_SLOTS.map((k) => (
        <div key={k} style={{ textAlign: 'center' }}>
          <Slot
            stack={eq[k]}
            slotRef={{ c: 'eq', i: k }}
            placeholder={EQ_LABEL[k]}
            onRightClick={() => {
              const inv = useStore.getState().inv;
              const empty = inv.findIndex((s, i) => !s && i >= HOTBAR_SIZE);
              const to = empty >= 0 ? empty : inv.findIndex((s) => !s);
              if (to >= 0) net.send({ t: 'mv', from: { c: 'eq', i: k }, to: { c: 'inv', i: to } });
            }}
            onDrop={(from) => from.ref.c === 'inv' && net.send({ t: 'mv', from: from.ref, to: { c: 'eq', i: k } })}
          />
          <div className="dim" style={{ fontSize: 10 }}>
            {EQ_LABEL[k]}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Trạm chế tạo đang ở gần (tính phía client để lọc công thức). */
function useNearStations(): Set<StationId> {
  const zone = useStore((s) => s.zone);
  const wt = useStore((s) => s.worldTime);
  const snap = useStore((s) => s.snap);
  return useMemo(() => {
    const out = new Set<StationId>();
    const w = getWorld();
    if (!w || !snap) return out;
    const r = Math.ceil(STATION_RANGE);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const tx = Math.floor(snap.x) + dx;
        const ty = Math.floor(snap.y) + dy;
        const st = w.view.structureAt(tx, ty);
        if (!st) continue;
        const def = STRUCTURES[st.id];
        if (!def?.station) continue;
        if (Math.hypot(tx + 0.5 - snap.x, ty + 0.5 - snap.y) > STATION_RANGE) continue;
        if (def.fuel && !(st.fu && st.fu > wt)) continue;
        out.add(def.station);
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone.x, zone.y, Math.floor(wt / 5)]);
}

type StationFilter = 'all' | 'hand' | StationId;

export function CraftingPanel({ only }: { only?: StationId }) {
  const inv = useStore((s) => s.inv);
  const reserved = useStore((s) => s.reserved);
  const near = useNearStations();
  const [filter, setFilter] = useState<StationFilter>(only ?? 'all');
  const [canOnly, setCanOnly] = useState(false);
  const [q, setQ] = useState('');
  const avail = inv.map((s, i) => (reserved.includes(i) ? null : s));
  const list = RECIPES.filter((r) => {
    if (only && r.station !== only) return false;
    if (filter === 'hand' && r.station) return false;
    if (filter !== 'all' && filter !== 'hand' && r.station !== filter) return false;
    const outId = Object.keys(r.out)[0]!;
    if (q && !(ITEMS[outId]?.name ?? '').toLowerCase().includes(q.toLowerCase())) return false;
    if (canOnly && !canCraft(r)) return false;
    return true;
  });
  function canCraft(r: Recipe, times = 1): boolean {
    if (r.station && !near.has(r.station)) return false;
    return Object.entries(r.in).every(([id, n]) => countItem(avail, id) >= n * times);
  }
  return (
    <div>
      {!only && (
        <Tabs<StationFilter>
          value={filter}
          onChange={setFilter}
          items={[
            ['all', 'Tất cả'],
            ['hand', 'Tay'],
            ['campfire', `Lửa trại${near.has('campfire') ? ' •' : ''}`],
            ['workbench', `Bàn chế tạo${near.has('workbench') ? ' •' : ''}`],
            ['furnace', `Lò nung${near.has('furnace') ? ' •' : ''}`],
            ['mech_bench', `Cơ khí${near.has('mech_bench') ? ' •' : ''}`],
            ['crystal_forge', `Lò Tinh thể${near.has('crystal_forge') ? ' •' : ''}`],
          ]}
        />
      )}
      <div className="row" style={{ marginBottom: 8 }}>
        <input placeholder="Tìm công thức..." value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
        <label className="row muted" style={{ fontSize: 12, gap: 4 }}>
          <input type="checkbox" checked={canOnly} onChange={(e) => setCanOnly(e.target.checked)} /> Chế được
        </label>
      </div>
      <div className="recipes">
        {list.map((r) => {
          const outId = Object.keys(r.out)[0]!;
          const ok = canCraft(r);
          const stationOk = !r.station || near.has(r.station);
          return (
            <div key={r.id} className={`recipe ${ok ? '' : 'off'}`}>
              <div className="slot small" style={{ cursor: 'default' }}>
                <ItemIcon id={outId} size={28} />
                {r.out[outId]! > 1 && <span className="n">{r.out[outId]}</span>}
              </div>
              <div>
                <div className="name">{itemName(outId)}</div>
                <div className="ins">
                  {Object.entries(r.in).map(([id, n]) => {
                    const have = countItem(avail, id);
                    return (
                      <span key={id} className={have < n ? 'miss' : ''}>
                        {ITEMS[id]?.name} {have}/{n}
                      </span>
                    );
                  })}
                </div>
                {r.station && (
                  <div style={{ fontSize: 11 }} className={stationOk ? 'good' : 'bad'}>
                    {stationOk ? '✓' : '✗'} {stationName(r.station)}
                    {r.station === 'campfire' ? ' (đang cháy)' : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <button className="small primary" disabled={!ok} onClick={() => net.send({ t: 'craft', r: r.id, n: 1 })}>
                  Chế
                </button>
                <button className="small" disabled={!canCraft(r, 5)} onClick={() => net.send({ t: 'craft', r: r.id, n: 5 })}>
                  ×5
                </button>
              </div>
            </div>
          );
        })}
        {list.length === 0 && <div className="dim">Không có công thức phù hợp.</div>}
      </div>
    </div>
  );
}

function SkillsPanel() {
  const skills = useStore((s) => s.skills);
  const stats = useStore((s) => s.stats);
  const snap = useStore((s) => s.snap);
  if (!skills) return null;
  return (
    <div style={{ width: 560, maxWidth: '100%' }}>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
        <span>
          Sống sót: <b className="gold">{stats.days.toFixed(1)} ngày</b>
        </span>
        <span>
          Hạ quái: <b>{stats.kills}</b>
        </span>
        <span>
          Xa nhất: <b>Ring {stats.maxRing}</b>
        </span>
        <span>
          Đêm Sương Đỏ liên tiếp: <b>{stats.blood}</b>
        </span>
        <span>
          Danh vọng: <b>{stats.rep}</b>
        </span>
        <button className="small" onClick={() => snap && net.send({ t: 'pvp', on: !snap.pvp })}>
          Cờ PvP: {snap?.pvp ? 'BẬT' : 'tắt'} (P)
        </button>
      </div>
      {SKILL_IDS.map((id) => {
        const s = skills[id];
        const need = xpToNext(s.lv);
        return (
          <div key={id} style={{ marginBottom: 8 }}>
            <div className="row">
              <b style={{ width: 120 }}>{SKILL_NAMES[id]}</b>
              <span className="pixel gold" style={{ fontSize: 18, width: 60 }}>
                Cấp {s.lv}
              </span>
              <div className="bar" style={{ flex: 1, gridTemplateColumns: '1fr 80px', margin: 0 }}>
                <div className="track">
                  <div className="fill" style={{ width: `${s.lv >= 100 ? 100 : (s.xp / need) * 100}%`, background: '#c8a040' }} />
                </div>
                <span className="val" style={{ fontSize: 13 }}>
                  {s.lv >= 100 ? 'TỐI ĐA' : `${Math.floor(s.xp)}/${need}`}
                </span>
              </div>
            </div>
            <div className="dim" style={{ fontSize: 11, marginLeft: 120 }}>
              {SKILL_DESC[id]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuestsPanel() {
  const q = useStore((s) => s.quest);
  return (
    <div style={{ width: 560, maxWidth: '100%' }}>
      {QUESTS.map((d, i) => (
        <div key={d.id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: i > q.idx ? 0.45 : 1 }}>
          <div className="row">
            <span style={{ width: 20 }}>{i < q.idx ? '✔' : i === q.idx ? '➤' : '·'}</span>
            <b className={i < q.idx ? 'good' : i === q.idx ? 'gold' : ''}>{d.title}</b>
            <span className="spacer" />
            <span className="gold pixel" style={{ fontSize: 16 }}>
              {d.reward} Xu
            </span>
          </div>
          {i <= q.idx && (
            <div className="muted" style={{ fontSize: 12, marginLeft: 20 }}>
              {d.hint}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function InventoryWindow({ tab }: { tab: 'craft' | 'skills' | 'quests' }) {
  const snap = useStore((s) => s.snap);
  return (
    <Window
      title="Nhân vật"
      sub={snap ? `Mang ${snap.w.toFixed(0)}/120 kg` : undefined}
      onClose={() => openWindow(null)}
    >
      <Tabs
        value={tab}
        onChange={(t) => openWindow({ kind: 'inventory', tab: t })}
        items={[
          ['craft', 'Túi đồ & Chế tạo'],
          ['skills', 'Kỹ năng'],
          ['quests', 'Nhiệm vụ'],
        ]}
      />
      {tab === 'craft' && (
        <div className="cols">
          <div>
            <p className="section-title">Trang bị</p>
            <EquipmentPanel />
            <p className="section-title" style={{ marginTop: 12 }}>
              Túi đồ
            </p>
            <InventoryGrid />
          </div>
          <div>
            <p className="section-title">Chế tạo</p>
            <CraftingPanel />
          </div>
        </div>
      )}
      {tab === 'skills' && <SkillsPanel />}
      {tab === 'quests' && <QuestsPanel />}
    </Window>
  );
}
