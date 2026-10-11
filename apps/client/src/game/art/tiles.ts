import { mulberry32, TILE_COUNT, TILE_PX } from '@suongdo/shared';

export const TILE_VARIANTS = 4;
export const TILESET_COLS = 8;

type Painter = (ctx: CanvasRenderingContext2D, rnd: () => number, v: number) => void;

function fill(ctx: CanvasRenderingContext2D, c: string): void {
  ctx.fillStyle = c;
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
}

function dots(ctx: CanvasRenderingContext2D, rnd: () => number, colors: string[], n: number, size = 1): void {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)]!;
    ctx.fillRect(Math.floor(rnd() * TILE_PX), Math.floor(rnd() * TILE_PX), size, size);
  }
}

function blades(ctx: CanvasRenderingContext2D, rnd: () => number, colors: string[], n: number): void {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)]!;
    const x = Math.floor(rnd() * TILE_PX);
    const y = Math.floor(rnd() * (TILE_PX - 1));
    ctx.fillRect(x, y, 1, 2);
  }
}

function waves(ctx: CanvasRenderingContext2D, rnd: () => number, color: string, n: number): void {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x = Math.floor(rnd() * (TILE_PX - 4));
    const y = Math.floor(rnd() * TILE_PX);
    ctx.fillRect(x, y, 3 + Math.floor(rnd() * 2), 1);
  }
}

const PAINTERS: Painter[] = [
  // 0 nước sâu
  (ctx, r) => {
    fill(ctx, '#1d4670');
    dots(ctx, r, ['#1a3f66', '#22507c'], 30);
    waves(ctx, r, '#2e6496', 3);
  },
  // 1 nước nông
  (ctx, r) => {
    fill(ctx, '#3a7db4');
    dots(ctx, r, ['#3576aa', '#4389c0'], 30);
    waves(ctx, r, '#7ab8e4', 3);
  },
  // 2 cát
  (ctx, r) => {
    fill(ctx, '#d8c088');
    dots(ctx, r, ['#c8ae74', '#e6d29c', '#cbb27a'], 26);
  },
  // 3 cỏ
  (ctx, r, v) => {
    fill(ctx, '#5c9a43');
    dots(ctx, r, ['#56923e', '#62a249'], 40);
    blades(ctx, r, ['#4a8436', '#74b456'], 10);
    if (v === 3) dots(ctx, r, ['#f0e060', '#ffffff', '#e8a0c0'], 2);
  },
  // 4 đất rừng
  (ctx, r, v) => {
    fill(ctx, '#3c7034');
    dots(ctx, r, ['#36682f', '#42783a', '#4a6a2a'], 40);
    blades(ctx, r, ['#2f5e2a', '#4f8a40'], 8);
    if (v === 2) dots(ctx, r, ['#6a4a2a'], 3);
  },
  // 5 bùn lầy
  (ctx, r, v) => {
    fill(ctx, '#4a5634');
    dots(ctx, r, ['#424e2e', '#56623c', '#3e4a30'], 40);
    if (v % 2 === 0) {
      ctx.fillStyle = '#3a5250';
      ctx.fillRect(3 + Math.floor(r() * 6), 4 + Math.floor(r() * 6), 5, 2);
      ctx.fillRect(4 + Math.floor(r() * 4), 6 + Math.floor(r() * 4), 4, 2);
    }
  },
  // 6 sa mạc
  (ctx, r) => {
    fill(ctx, '#dfae66');
    dots(ctx, r, ['#d4a05a', '#e8bc78'], 30);
    ctx.fillStyle = '#c99550';
    for (let i = 0; i < 2; i++) {
      const y = Math.floor(r() * TILE_PX);
      ctx.fillRect(Math.floor(r() * 6), y, 6 + Math.floor(r() * 5), 1);
    }
  },
  // 7 tuyết
  (ctx, r) => {
    fill(ctx, '#e6edf2');
    dots(ctx, r, ['#d4dee6', '#dbe4ea'], 30);
    dots(ctx, r, ['#ffffff'], 6);
  },
  // 8 đá núi
  (ctx, r) => {
    fill(ctx, '#88837e');
    dots(ctx, r, ['#7c7772', '#948f8a', '#a6a19c'], 40);
    ctx.fillStyle = '#66615c';
    let x = Math.floor(r() * 10);
    let y = Math.floor(r() * 10);
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(x, y, 1, 1);
      x += r() < 0.5 ? 1 : 0;
      y += 1;
    }
  },
  // 9 phế tích (nhựa đường)
  (ctx, r, v) => {
    fill(ctx, '#54545a');
    dots(ctx, r, ['#4a4a50', '#5e5e64', '#66666c'], 40);
    if (v === 1) {
      ctx.fillStyle = '#a89a4a';
      ctx.fillRect(7, 2, 2, 5);
      ctx.fillRect(7, 10, 2, 4);
    }
    ctx.fillStyle = '#3c3c42';
    let x = Math.floor(r() * 12);
    for (let y = 0; y < TILE_PX; y += 2) {
      if (r() < 0.6) ctx.fillRect(x, y, 1, 2);
      x = Math.max(0, Math.min(15, x + (r() < 0.5 ? -1 : 1)));
    }
  },
  // 10 đất Sương
  (ctx, r) => {
    fill(ctx, '#55223a');
    dots(ctx, r, ['#4c1e34', '#5e2842', '#682c48'], 40);
    dots(ctx, r, ['#a83a56', '#c84a66'], 3);
    ctx.fillStyle = '#76304c';
    let x = Math.floor(r() * 16);
    for (let y = 0; y < 16; y++) {
      if (r() < 0.5) ctx.fillRect(x, y, 1, 1);
      x = (x + (r() < 0.5 ? 1 : 15)) % 16;
    }
  },
  // 11 sân lát đá
  (ctx, r) => {
    fill(ctx, '#b6a488');
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        const shade = ['#b2a084', '#bcaa8e', '#ae9c80', '#c0ae92'][Math.floor(r() * 4)]!;
        ctx.fillStyle = shade;
        ctx.fillRect(x * 8 + 1, y * 8 + 1, 7, 7);
      }
    }
    ctx.fillStyle = '#968670';
    ctx.fillRect(0, 0, 16, 1);
    ctx.fillRect(0, 8, 16, 1);
    ctx.fillRect(0, 0, 1, 16);
    ctx.fillRect(8, 0, 1, 16);
    dots(ctx, r, ['#a69478'], 6);
  },
];

/** Tạo ảnh tileset: mỗi loại nền có 4 biến thể. Chỉ số = loại × 4 + biến thể. */
export function buildTileset(): HTMLCanvasElement {
  const total = TILE_COUNT * TILE_VARIANTS;
  const rows = Math.ceil(total / TILESET_COLS);
  const canvas = document.createElement('canvas');
  canvas.width = TILESET_COLS * TILE_PX;
  canvas.height = rows * TILE_PX;
  const ctx = canvas.getContext('2d')!;
  for (let t = 0; t < TILE_COUNT; t++) {
    for (let v = 0; v < TILE_VARIANTS; v++) {
      const idx = t * TILE_VARIANTS + v;
      const ox = (idx % TILESET_COLS) * TILE_PX;
      const oy = Math.floor(idx / TILESET_COLS) * TILE_PX;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.beginPath();
      ctx.rect(0, 0, TILE_PX, TILE_PX);
      ctx.clip();
      PAINTERS[t]!(ctx, mulberry32(t * 1000 + v * 77 + 13), v);
      ctx.restore();
    }
  }
  return canvas;
}

export function tileIndex(type: number, x: number, y: number): number {
  const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
  return type * TILE_VARIANTS + (h % TILE_VARIANTS);
}
