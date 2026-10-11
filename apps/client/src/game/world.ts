import { chunkKey, chunkOf, localIndex, type S2C, type StructPublic, WorldGen, WorldView } from '@suongdo/shared';

type ChunkMsg = Extract<S2C, { t: 'ch' }>;
type TileMsg = Extract<S2C, { t: 'cu' }>;

/** Thế giới phía client: địa hình sinh tại chỗ từ seed + thay đổi nhận từ máy chủ. */
export class ClientWorld {
  readonly gen: WorldGen;
  readonly view: WorldView;
  myChar = 0;
  onChunk: ((cx: number, cy: number) => void) | null = null;
  onTile: ((tx: number, ty: number) => void) | null = null;

  constructor(readonly seed: number) {
    this.gen = new WorldGen(seed, 900);
    this.view = new WorldView(this.gen);
  }

  applyChunk(m: ChunkMsg): void {
    const d = this.view.ensureDelta(m.cx, m.cy);
    d.rm = new Map(m.rm);
    d.st = new Map(m.st);
    this.onChunk?.(m.cx, m.cy);
  }

  applyTile(m: TileMsg): void {
    const d = this.view.ensureDelta(chunkOf(m.tx), chunkOf(m.ty));
    const i = localIndex(m.tx, m.ty);
    if (m.rm === null) d.rm.delete(i);
    else if (m.rm !== undefined) d.rm.set(i, m.rm);
    if (m.st === null) d.st.delete(i);
    else if (m.st !== undefined) d.st.set(i, m.st);
    this.onTile?.(m.tx, m.ty);
  }

  hasChunk(cx: number, cy: number): boolean {
    return this.view.deltas.has(chunkKey(cx, cy));
  }

  structAt(tx: number, ty: number): StructPublic | undefined {
    return this.view.structureAt(tx, ty);
  }

  /** Bỏ dữ liệu chunk ở xa để tiết kiệm bộ nhớ. */
  prune(cx: number, cy: number, r: number): void {
    for (const k of this.view.deltas.keys()) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      if (Math.abs(x - cx) > r || Math.abs(y - cy) > r) this.view.deltas.delete(k);
    }
  }
}

let current: ClientWorld | null = null;

export function getWorld(): ClientWorld | null {
  return current;
}

export function initWorld(seed: number): ClientWorld {
  if (!current || current.seed !== seed) current = new ClientWorld(seed);
  return current;
}
