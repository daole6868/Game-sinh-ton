import { useRef, useState } from 'react';
import { getScene } from '../game/PhaserGame';
import { openWindow, useStore } from '../state/store';

const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || window.matchMedia?.('(pointer: coarse)').matches);

/** Cần điều khiển ảo và nút bấm cho điện thoại. */
export function TouchControls() {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const base = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<number | null>(null);
  if (!isTouch) return null;
  const R = 44;
  const move = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    setKnob({ x: dx, y: dy });
    const l = Math.hypot(dx, dy) / R;
    useStore.setState({ touchMove: l < 0.15 ? null : { x: dx / R, y: dy / R } });
  };
  const end = () => {
    setKnob({ x: 0, y: 0 });
    useStore.setState({ touchMove: null });
  };
  const startPrimary = () => {
    getScene()?.touchAction('primary');
    holdTimer.current = window.setInterval(() => getScene()?.touchAction('primary'), 450);
  };
  const stopPrimary = () => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null;
  };
  return (
    <div className="touch">
      <div
        className="joystick"
        ref={base}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={(e) => e.buttons && move(e)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="touch-btns">
        <button onPointerDown={startPrimary} onPointerUp={stopPrimary} onPointerLeave={stopPrimary}>
          Đánh
        </button>
        <button onPointerDown={() => getScene()?.touchAction('interact')}>Tương tác</button>
        <button onPointerDown={() => getScene()?.touchAction('dash')}>Lướt</button>
        <button onPointerDown={() => openWindow({ kind: 'inventory', tab: 'craft' })}>Túi</button>
      </div>
    </div>
  );
}
