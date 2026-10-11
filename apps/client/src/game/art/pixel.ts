/** Ảnh pixel định nghĩa bằng chuỗi ký tự + bảng màu. '.' là trong suốt, ':' là bóng mờ. */
export interface PixelSprite {
  w: number;
  h: number;
  rows: string[];
  pal: Record<string, string>;
}

export const SHADOW = 'rgba(0,0,0,0.28)';

export function px(rows: string[], pal: Record<string, string>): PixelSprite {
  const w = Math.max(...rows.map((r) => r.length));
  return { w, h: rows.length, rows: rows.map((r) => r.padEnd(w, '.')), pal: { ':': SHADOW, ...pal } };
}

/** Đổi bảng màu (giữ hình). */
export function recolor(s: PixelSprite, pal: Record<string, string>): PixelSprite {
  return { ...s, pal: { ...s.pal, ...pal } };
}

/** Phóng to ×2. */
export function scale2(s: PixelSprite): PixelSprite {
  const rows: string[] = [];
  for (const r of s.rows) {
    const line = [...r].map((c) => c + c).join('');
    rows.push(line, line);
  }
  return { w: s.w * 2, h: s.h * 2, rows, pal: s.pal };
}

/** Thêm khoảng trống phía trên để sprite cao bằng h. */
export function padTop(s: PixelSprite, h: number): PixelSprite {
  if (s.h >= h) return s;
  const empty = '.'.repeat(s.w);
  return { ...s, h, rows: [...Array(h - s.h).fill(empty), ...s.rows] };
}

/** Chồng sprite b lên a (ký tự khác '.' của b đè lên a). */
export function overlay(a: PixelSprite, b: PixelSprite, dx = 0, dy = 0): PixelSprite {
  const rows = a.rows.map((r) => [...r]);
  const pal = { ...a.pal };
  const map: Record<string, string> = {};
  let n = Object.keys(a.pal).length;
  for (const [k, v] of Object.entries(b.pal)) {
    if (k === ':') continue;
    const key = String.fromCharCode(0x2460 + n++);
    map[k] = key;
    pal[key] = v;
  }
  b.rows.forEach((r, y) => {
    [...r].forEach((c, x) => {
      const ty = y + dy;
      const tx = x + dx;
      if (c === '.' || ty < 0 || ty >= rows.length || tx < 0 || tx >= a.w) return;
      rows[ty]![tx] = c === ':' ? ':' : (map[c] ?? c);
    });
  });
  return { ...a, rows: rows.map((r) => r.join('')), pal };
}

export function drawPixel(ctx: CanvasRenderingContext2D, s: PixelSprite, ox: number, oy: number, scale = 1): void {
  for (let y = 0; y < s.h; y++) {
    const row = s.rows[y]!;
    for (let x = 0; x < s.w; x++) {
      const c = row[x]!;
      if (c === '.') continue;
      const col = s.pal[c];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
  }
}
