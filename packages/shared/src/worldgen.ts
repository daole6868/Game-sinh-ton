import { CHUNK, OUTPOST_PLAZA_RADIUS, OUTPOST_SAFE_RADIUS, RING_SIZE } from './constants.ts';
import { OBJECTS } from './data/objects.ts';
import { T } from './data/tiles.ts';
import { Simplex2 } from './noise.ts';
import { outpostsAround, type Outpost } from './outposts.ts';
import { rand2 } from './rng.ts';

export interface ChunkData {
  cx: number;
  cy: number;
  /** loại nền cho 32×32 ô */
  tiles: Uint8Array;
  /** số thứ tự vật thể tự nhiên (0 = trống) */
  objs: Uint8Array;
}

export function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

export function chunkOf(t: number): number {
  return Math.floor(t / CHUNK);
}

export function localIndex(tx: number, ty: number): number {
  const lx = tx - Math.floor(tx / CHUNK) * CHUNK;
  const ly = ty - Math.floor(ty / CHUNK) * CHUNK;
  return ly * CHUNK + lx;
}

type ObjTable = [string, number][];

/** Bảng xác suất vật thể theo loại nền. */
const OBJECT_TABLES: Partial<Record<T, ObjTable>> = {
  [T.GRASS]: [['grass_tuft', 0.06], ['twig', 0.025], ['pebble', 0.02], ['bush', 0.02], ['tree', 0.03], ['rock', 0.008], ['herb_plant', 0.003]],
  [T.FOREST]: [['tree', 0.14], ['pine', 0.02], ['twig', 0.03], ['pebble', 0.012], ['mushroom_patch', 0.015], ['bush', 0.02], ['grass_tuft', 0.02], ['rock', 0.01], ['herb_plant', 0.006]],
  [T.SWAMP]: [['reeds', 0.07], ['herb_plant', 0.02], ['mushroom_patch', 0.015], ['clay_pit', 0.02], ['tree', 0.03], ['dead_tree', 0.015], ['grass_tuft', 0.02]],
  [T.DESERT]: [['cactus', 0.03], ['bones', 0.008], ['dead_tree', 0.01], ['rock', 0.015], ['iron_rock', 0.004], ['pebble', 0.012]],
  [T.SNOW]: [['pine', 0.07], ['rock', 0.02], ['iron_rock', 0.012], ['coal_rock', 0.008], ['pebble', 0.01], ['twig', 0.01]],
  [T.ROCK]: [['rock', 0.08], ['iron_rock', 0.03], ['coal_rock', 0.025], ['pebble', 0.03], ['pine', 0.01]],
  [T.RUINS]: [['scrap_pile', 0.05], ['wreck', 0.015], ['crate', 0.006], ['dead_tree', 0.01], ['pebble', 0.01], ['grass_tuft', 0.01]],
  [T.SAND]: [['reeds', 0.02], ['pebble', 0.015], ['twig', 0.01], ['bones', 0.002]],
  [T.MIST]: [['blood_tree', 0.08], ['crystal_node', 0.015], ['mushroom_patch', 0.02], ['dead_tree', 0.02], ['rock', 0.01]],
  [T.SHALLOW]: [['reeds', 0.03]],
};

const ROCK_DEEP_EXTRA: ObjTable = [['crystal_node', 0.004]];

function minDist(ops: Outpost[], x: number, y: number): number {
  let best = Infinity;
  for (const o of ops) {
    const d = Math.hypot(o.x - x, o.y - y);
    if (d < best) best = d;
  }
  return best;
}

function smoothstep(a: number, b: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Bộ sinh thế giới tất định. Client và server cùng dùng → cùng seed ra cùng thế giới.
 */
export class WorldGen {
  readonly seed: number;
  private elev: Simplex2;
  private elev2: Simplex2;
  private moist: Simplex2;
  private temp: Simplex2;
  private ruins: Simplex2;
  private mist: Simplex2;
  private cache = new Map<string, ChunkData>();
  private cacheLimit: number;

  constructor(seed: number, cacheLimit = 400) {
    this.seed = seed >>> 0;
    this.elev = new Simplex2(this.seed ^ 0x1234);
    this.elev2 = new Simplex2(this.seed ^ 0x5678);
    this.moist = new Simplex2(this.seed ^ 0x9abc);
    this.temp = new Simplex2(this.seed ^ 0xdef0);
    this.ruins = new Simplex2(this.seed ^ 0x2468);
    this.mist = new Simplex2(this.seed ^ 0x1357);
    this.cacheLimit = cacheLimit;
  }

  /** Tính loại nền tại ô (tx, ty) trực tiếp từ hàm nhiễu. */
  computeTile(tx: number, ty: number, ops: Outpost[] = outpostsAround(this.seed, tx, ty)): T {
    const x = tx + 0.5;
    const y = ty + 0.5;
    const d = Math.hypot(x, y);
    const ring = Math.floor(d / RING_SIZE);

    const od = minDist(ops, x, y);
    if (od <= OUTPOST_PLAZA_RADIUS) return T.PLAZA;

    let e = this.elev.fbm(x / 240, y / 240, 5) * 0.8 + this.elev2.noise(x / 1100, y / 1100) * 0.35;
    // Trạm và khu xuất phát luôn là đất liền
    const landBoost = Math.max(1 - smoothstep(OUTPOST_SAFE_RADIUS, OUTPOST_SAFE_RADIUS + 14, od), 1 - smoothstep(40, 70, d));
    if (landBoost > 0) e = e * (1 - landBoost) + Math.max(e, 0.05) * landBoost;

    if (e < -0.36) return T.DEEP;
    if (e < -0.26) return T.SHALLOW;
    if (e < -0.21) return T.SAND;

    // Khu xuất phát ôn hòa: nhiệt độ bị kéo về 0 gần tâm
    const mild = smoothstep(150, 450, d);
    const t = this.temp.fbm(x / 700, y / 700, 3) * 1.25 * mild;
    const m = this.moist.fbm(x / 380, y / 380, 3);

    if (ring >= 3) {
      const mn = this.mist.fbm(x / 260, y / 260, 3);
      const threshold = Math.max(-0.25, 0.3 - 0.05 * (ring - 3));
      if (mn > threshold) return T.MIST;
    }
    if (t < -0.3) return T.SNOW;
    if (e > 0.4) return T.ROCK;
    if (t > 0.28 && m < 0.08) return T.DESERT;
    if (m > 0.28 && e < 0.1) return T.SWAMP;
    const r = this.ruins.fbm(x / 170, y / 170, 2);
    if (r > 0.38 && d > 60) return T.RUINS;
    if (m > -0.02) return T.FOREST;
    return T.GRASS;
  }

  private computeObject(tx: number, ty: number, tile: T, ops: Outpost[]): number {
    const table = OBJECT_TABLES[tile];
    if (!table) return 0;
    const x = tx + 0.5;
    const y = ty + 0.5;
    const d = Math.hypot(x, y);
    if (d < 5) return 0;
    if (minDist(ops, x, y) <= OUTPOST_SAFE_RADIUS - 2) return 0;
    let r = rand2(this.seed, tx, ty, 7);
    for (const [id, p] of table) {
      if (r < p) return OBJECTS[id]!.num;
      r -= p;
    }
    if (tile === T.ROCK && Math.floor(d / RING_SIZE) >= 2) {
      for (const [id, p] of ROCK_DEEP_EXTRA) {
        if (r < p) return OBJECTS[id]!.num;
        r -= p;
      }
    }
    return 0;
  }

  generateChunk(cx: number, cy: number): ChunkData {
    const tiles = new Uint8Array(CHUNK * CHUNK);
    const objs = new Uint8Array(CHUNK * CHUNK);
    const ox = cx * CHUNK;
    const oy = cy * CHUNK;
    const ops = outpostsAround(this.seed, ox + CHUNK / 2, oy + CHUNK / 2);
    for (let ly = 0; ly < CHUNK; ly++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const i = ly * CHUNK + lx;
        const tile = this.computeTile(ox + lx, oy + ly, ops);
        tiles[i] = tile;
        objs[i] = this.computeObject(ox + lx, oy + ly, tile, ops);
      }
    }
    return { cx, cy, tiles, objs };
  }

  getChunk(cx: number, cy: number): ChunkData {
    const key = chunkKey(cx, cy);
    let c = this.cache.get(key);
    if (c) {
      // làm mới vị trí trong LRU
      this.cache.delete(key);
      this.cache.set(key, c);
      return c;
    }
    c = this.generateChunk(cx, cy);
    this.cache.set(key, c);
    if (this.cache.size > this.cacheLimit) {
      const first = this.cache.keys().next().value as string;
      this.cache.delete(first);
    }
    return c;
  }

  tileAt(tx: number, ty: number): T {
    return this.getChunk(chunkOf(tx), chunkOf(ty)).tiles[localIndex(tx, ty)]! as T;
  }

  /** Vật thể tự nhiên gốc (chưa áp thay đổi của người chơi). */
  baseObjectAt(tx: number, ty: number): number {
    return this.getChunk(chunkOf(tx), chunkOf(ty)).objs[localIndex(tx, ty)]!;
  }
}
