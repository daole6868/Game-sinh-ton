import { ITEMS } from '@suongdo/shared';
import { net } from '../../net/client';
import { useStore } from '../../state/store';
import { moveItem, Slot, Window } from '../common';
import { InventoryGrid } from './InventoryWindow';

export function ContainerWindow() {
  const c = useStore((s) => s.container);
  const inv = useStore((s) => s.inv);
  if (!c) return null;
  const close = () => {
    net.send({ t: 'close' });
    useStore.setState({ container: null });
  };
  const takeAll = () => {
    const work = inv.map((s) => (s ? { ...s } : null));
    c.slots.forEach((s, i) => {
      if (!s) return;
      let to = work.findIndex((w) => w && w.id === s.id && !w.u && !s.u && w.n + s.n <= (ITEMS[s.id]?.stack ?? 1));
      if (to < 0) to = work.findIndex((w) => !w);
      if (to < 0) return;
      work[to] = work[to] ? { ...work[to]!, n: work[to]!.n + s.n } : { ...s };
      net.send({ t: 'mv', from: { c: 'cont', i }, to: { c: 'inv', i: to } });
    });
  };
  const cols = c.slots.length > 16 ? 5 : 4;
  return (
    <Window title={c.title} sub={c.kind === 'bag' ? 'Túi hành trang' : c.kind === 'safe' ? 'Không bao giờ mất khi chết' : undefined} onClose={close}>
      <div className="cols">
        <div>
          <p className="section-title">{c.title}</p>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, 46px)` }}>
            {c.slots.map((s, i) => (
              <Slot
                key={i}
                stack={s}
                slotRef={{ c: 'cont', i }}
                onShiftClick={() => {
                  if (!s) return;
                  const to = inv.findIndex((w) => !w);
                  if (to >= 0) net.send({ t: 'mv', from: { c: 'cont', i }, to: { c: 'inv', i: to } });
                }}
                onDrop={c.kind === 'bag' ? undefined : (from, half) => moveItem(from.ref, { c: 'cont', i }, half, from.stack)}
              />
            ))}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="small" onClick={takeAll}>
              Lấy hết
            </button>
          </div>
        </div>
        <div>
          <p className="section-title">Túi đồ của bạn</p>
          <InventoryGrid />
        </div>
      </div>
    </Window>
  );
}
