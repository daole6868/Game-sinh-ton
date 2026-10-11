import { ITEMS } from '@suongdo/shared';
import { ICONS } from './icons';
import { drawPixel, type PixelSprite, px } from './pixel';
import { BAG_SPRITE, CHARACTER_SPRITES, MOB_SPRITES, OBJECT_SPRITES, STRUCTURE_SPRITES } from './sprites';

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Atlas {
  canvas: HTMLCanvasElement;
  frames: Record<string, Frame>;
}

const UNKNOWN = px(
  [
    '................',
    '..kkkkkkkkkkkk..',
    '..kwwwwwwwwwwk..',
    '..kwwwkkkkwwwk..',
    '..kwwkwwwwkwwk..',
    '..kwwwwwwkwwwk..',
    '..kwwwwwkwwwwk..',
    '..kwwwwkwwwwwk..',
    '..kwwwwwwwwwwk..',
    '..kwwwwkwwwwwk..',
    '..kwwwwwwwwwwk..',
    '..kkkkkkkkkkkk..',
  ],
  { k: '#3a3a44', w: '#d8d8e0' },
);

/** Gom mọi sprite vào một atlas để Phaser vẽ theo lô (nhanh). */
export function buildAtlas(): Atlas {
  const entries: [string, PixelSprite][] = [];
  for (const [k, s] of Object.entries(OBJECT_SPRITES)) entries.push([`obj_${k}`, s]);
  for (const [k, s] of Object.entries(STRUCTURE_SPRITES)) entries.push([`st_${k}`, s]);
  for (const [k, s] of Object.entries(CHARACTER_SPRITES)) entries.push([k, s]);
  for (const [k, s] of Object.entries(MOB_SPRITES)) entries.push([`mob_${k}`, s]);
  for (const [k, s] of Object.entries(ICONS)) entries.push([`icon_${k}`, s]);
  entries.push(['bag', BAG_SPRITE]);
  entries.push(['icon_unknown', UNKNOWN]);
  entries.sort((a, b) => b[1].h - a[1].h);

  const W = 512;
  const frames: Record<string, Frame> = {};
  let x = 1;
  let y = 1;
  let rowH = 0;
  for (const [name, s] of entries) {
    if (x + s.w + 1 > W) {
      x = 1;
      y += rowH + 1;
      rowH = 0;
    }
    frames[name] = { x, y, w: s.w, h: s.h };
    x += s.w + 1;
    rowH = Math.max(rowH, s.h);
  }
  const H = y + rowH + 1;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  for (const [name, s] of entries) {
    const f = frames[name]!;
    drawPixel(ctx, s, f.x, f.y);
  }
  return { canvas, frames };
}

let atlasCache: Atlas | null = null;
export function getAtlas(): Atlas {
  atlasCache ??= buildAtlas();
  return atlasCache;
}

const iconCache = new Map<string, string>();

/** Ảnh biểu tượng vật phẩm (data URL) dùng cho giao diện React. */
export function iconUrl(itemId: string): string {
  const cached = iconCache.get(itemId);
  if (cached) return cached;
  const atlas = getAtlas();
  const f = atlas.frames[`icon_${itemId}`] ?? atlas.frames.icon_unknown!;
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const scale = Math.min(1, 16 / f.w, 16 / f.h);
  const dw = Math.max(1, Math.round(f.w * scale));
  const dh = Math.max(1, Math.round(f.h * scale));
  ctx.drawImage(atlas.canvas, f.x, f.y, f.w, f.h, Math.floor((16 - dw) / 2), Math.floor((16 - dh) / 2), dw, dh);
  const url = c.toDataURL();
  iconCache.set(itemId, url);
  return url;
}

export function hasIcon(itemId: string): boolean {
  return !!ITEMS[itemId] && `icon_${itemId}` in getAtlas().frames;
}

/** Ảnh ánh sáng hình tròn mờ dần (dùng cho lớp bóng tối ban đêm). */
export function buildLightCanvas(size = 128): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

/** Vầng sáng màu ấm cho lửa. */
export function buildGlowCanvas(size = 64, color = '255,170,80'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${color},0.55)`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

/** Kết cấu sương mù (nhiễu mờ, lặp liền mạch). */
export function buildFogCanvas(size = 128): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 10 + Math.random() * 26;
    for (const [dx, dy] of [
      [0, 0],
      [size, 0],
      [-size, 0],
      [0, size],
      [0, -size],
    ] as const) {
      const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    }
  }
  return c;
}

export function solidCanvas(w: number, h: number, color: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return c;
}
