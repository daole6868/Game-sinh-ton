import { OUTPOST_CELL, outpostInCell, RING_SIZE, STRUCTURES, TILES, type TerritoryInfo } from '@suongdo/shared';
import type { ClientWorld } from '../game/world';

const TILE_RGB = TILES.map((t) => [(t.color >> 16) & 255, (t.color >> 8) & 255, t.color & 255] as const);

/** Vẽ bản đồ nhỏ quanh (cx, cy): mỗi pixel = 1 ô (dùng chunk đã sinh sẵn). */
export function drawMinimap(ctx: CanvasRenderingContext2D, w: ClientWorld, cx: number, cy: number, size: number): void {
  const img = ctx.createImageData(size, size);
  const half = Math.floor(size / 2);
  const x0 = Math.floor(cx) - half;
  const y0 = Math.floor(cy) - half;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tx = x0 + x;
      const ty = y0 + y;
      const t = w.gen.tileAt(tx, ty);
      let [r, g, b] = TILE_RGB[t] ?? [0, 0, 0];
      const obj = w.view.objectAt(tx, ty);
      if (obj?.solid) {
        r *= 0.72;
        g *= 0.72;
        b *= 0.72;
      }
      const st = w.view.structureAt(tx, ty);
      if (st) {
        const mine = st.o === w.myChar;
        [r, g, b] = mine ? [255, 220, 120] : STRUCTURES[st.id]?.solid ? [220, 220, 220] : [170, 150, 120];
      }
      const i = (y * size + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export interface MapView {
  /** tâm (ô) */
  cx: number;
  cy: number;
  /** số ô mỗi pixel */
  scale: number;
}

/**
 * Vẽ bản đồ lớn theo từng dải (gọi lặp lại tới khi xong). Dùng computeTile trực tiếp
 * (không sinh cả chunk) nên vẽ được vùng rất rộng.
 */
export function* drawWorldMap(ctx: CanvasRenderingContext2D, w: ClientWorld, view: MapView, size: number): Generator<number> {
  const img = ctx.createImageData(size, 1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tx = Math.floor(view.cx + (x - size / 2) * view.scale);
      const ty = Math.floor(view.cy + (y - size / 2) * view.scale);
      const t = view.scale <= 1 ? w.gen.tileAt(tx, ty) : w.gen.computeTile(tx, ty);
      const [r, g, b] = TILE_RGB[t] ?? [0, 0, 0];
      const i = x * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, y);
    if (y % 6 === 5) yield y;
  }
}

export function toScreen(view: MapView, size: number, tx: number, ty: number): { x: number; y: number } {
  return { x: (tx - view.cx) / view.scale + size / 2, y: (ty - view.cy) / view.scale + size / 2 };
}

/** Lớp chồng: vòng độ sâu, trạm, lãnh thổ, người chơi. */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  seed: number,
  view: MapView,
  size: number,
  opts: { me: { x: number; y: number }; discovered: Set<string>; territories: TerritoryInfo[]; myChar: number; bed?: { x: number; y: number } | null },
): void {
  ctx.save();
  // vòng độ sâu
  const c = toScreen(view, size, 0, 0);
  for (let r = 1; r <= 12; r++) {
    const rad = (r * RING_SIZE) / view.scale;
    if (rad > size * 3) break;
    ctx.strokeStyle = r >= 6 ? 'rgba(200,110,255,0.55)' : r >= 3 ? 'rgba(255,90,100,0.55)' : 'rgba(220,220,230,0.4)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // lãnh thổ
  for (const t of opts.territories) {
    const p = toScreen(view, size, t.x, t.y);
    ctx.strokeStyle = t.o === opts.myChar ? 'rgba(255,220,120,0.9)' : 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(2, t.r / view.scale), 0, Math.PI * 2);
    ctx.stroke();
  }
  // trạm giao thương
  const span = (size / 2) * view.scale;
  const i0 = Math.floor((view.cx - span) / OUTPOST_CELL) - 1;
  const i1 = Math.ceil((view.cx + span) / OUTPOST_CELL) + 1;
  const j0 = Math.floor((view.cy - span) / OUTPOST_CELL) - 1;
  const j1 = Math.ceil((view.cy + span) / OUTPOST_CELL) + 1;
  ctx.font = '11px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'center';
  if ((i1 - i0) * (j1 - j0) < 400) {
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const o = outpostInCell(seed, i, j);
        const p = toScreen(view, size, o.x, o.y);
        if (p.x < -20 || p.y < -20 || p.x > size + 20 || p.y > size + 20) continue;
        const known = opts.discovered.has(o.id) || o.id === '0_0';
        ctx.fillStyle = known ? '#ffd860' : '#9a8a70';
        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
        ctx.strokeStyle = '#000';
        ctx.strokeRect(p.x - 3.5, p.y - 3.5, 7, 7);
        if (known || view.scale <= 4) {
          ctx.fillStyle = known ? '#fff3c8' : '#c8bca8';
          ctx.strokeStyle = 'rgba(0,0,0,0.8)';
          ctx.lineWidth = 3;
          ctx.strokeText(o.name, p.x, p.y - 7);
          ctx.fillText(o.name, p.x, p.y - 7);
          ctx.lineWidth = 1;
        }
      }
    }
  }
  if (opts.bed) {
    const b = toScreen(view, size, opts.bed.x, opts.bed.y);
    ctx.fillStyle = '#ff7ab0';
    ctx.fillRect(b.x - 2, b.y - 2, 5, 5);
  }
  // người chơi
  const m = toScreen(view, size, opts.me.x, opts.me.y);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#c02040';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
