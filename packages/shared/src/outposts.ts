import { OUTPOST_CELL, OUTPOST_SAFE_RADIUS } from './constants.ts';
import { hash2, rand2 } from './rng.ts';
import { ringOf } from './scaling.ts';

export interface Outpost {
  id: string;
  i: number;
  j: number;
  x: number;
  y: number;
  name: string;
  ring: number;
}

const PREFIX = ['Bến', 'Đồi', 'Hòn', 'Gò', 'Bãi', 'Suối', 'Đèo', 'Rạch', 'Cồn', 'Truông', 'Làng', 'Xóm', 'Mỏm', 'Thung'];
const SUFFIX = ['Đá', 'Thông', 'Khói', 'Sậy', 'Muối', 'Gió', 'Sắt', 'Tro', 'Lau', 'Mây', 'Trăng', 'Cát', 'Mộc', 'Sương', 'Tre', 'Đỏ', 'Bạc', 'Hoang'];

export function outpostInCell(seed: number, i: number, j: number): Outpost {
  if (i === 0 && j === 0) {
    return { id: '0_0', i: 0, j: 0, x: 0, y: 0, name: 'Trạm Trung Tâm', ring: 0 };
  }
  const jx = Math.floor((rand2(seed, i, j, 101) - 0.5) * 800);
  const jy = Math.floor((rand2(seed, i, j, 102) - 0.5) * 800);
  const x = i * OUTPOST_CELL + jx;
  const y = j * OUTPOST_CELL + jy;
  const h = hash2(seed, i, j, 103);
  const name = `${PREFIX[h % PREFIX.length]} ${SUFFIX[(h >>> 8) % SUFFIX.length]}`;
  return { id: `${i}_${j}`, i, j, x, y, name: `Trạm ${name}`, ring: ringOf(x, y) };
}

export function outpostById(seed: number, id: string): Outpost | null {
  const m = /^(-?\d+)_(-?\d+)$/.exec(id);
  if (!m) return null;
  return outpostInCell(seed, Number(m[1]), Number(m[2]));
}

/** Các trạm ở 3×3 ô lưới quanh vị trí. */
export function outpostsAround(seed: number, x: number, y: number): Outpost[] {
  const ci = Math.round(x / OUTPOST_CELL);
  const cj = Math.round(y / OUTPOST_CELL);
  const out: Outpost[] = [];
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) out.push(outpostInCell(seed, ci + di, cj + dj));
  return out;
}

export function nearestOutpost(seed: number, x: number, y: number): { outpost: Outpost; dist: number } {
  let best: Outpost | null = null;
  let bd = Infinity;
  for (const o of outpostsAround(seed, x, y)) {
    const d = Math.hypot(o.x - x, o.y - y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return { outpost: best!, dist: bd };
}

/** Trả về trạm nếu vị trí nằm trong vùng an toàn của trạm. */
export function safeOutpostAt(seed: number, x: number, y: number, extra = 0): Outpost | null {
  const { outpost, dist } = nearestOutpost(seed, x, y);
  return dist <= OUTPOST_SAFE_RADIUS + extra ? outpost : null;
}
