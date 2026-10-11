/** Hàm băm số nguyên 32-bit (dựa trên lowbias32). */
export function hash32(n: number): number {
  n = n | 0;
  n ^= n >>> 16;
  n = Math.imul(n, 0x7feb352d);
  n ^= n >>> 15;
  n = Math.imul(n, 0x846ca68b);
  n ^= n >>> 16;
  return n >>> 0;
}

/** Băm tất định cho (seed, x, y, salt) → số nguyên 32-bit. */
export function hash2(seed: number, x: number, y: number, salt = 0): number {
  let h = hash32(seed ^ Math.imul(salt + 1, 0x9e3779b1));
  h = hash32(h ^ Math.imul(x | 0, 0x85ebca6b));
  h = hash32(h ^ Math.imul(y | 0, 0xc2b2ae35));
  return h;
}

/** Băm tất định → số thực trong [0, 1). */
export function rand2(seed: number, x: number, y: number, salt = 0): number {
  return hash2(seed, x, y, salt) / 4294967296;
}

/** Bộ sinh số ngẫu nhiên có seed (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Băm chuỗi → số nguyên 32-bit (FNV-1a). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pickWeighted<T>(rng: () => number, items: readonly T[], weight: (t: T) => number): T | undefined {
  let total = 0;
  for (const it of items) total += Math.max(0, weight(it));
  if (total <= 0) return undefined;
  let r = rng() * total;
  for (const it of items) {
    r -= Math.max(0, weight(it));
    if (r < 0) return it;
  }
  return items[items.length - 1];
}
