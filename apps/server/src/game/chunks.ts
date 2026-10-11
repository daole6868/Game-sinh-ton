import {
  CHUNK,
  chunkKey,
  chunkOf,
  localIndex,
  type ChunkDeltaView,
  type Slot,
  type StructPublic,
  WorldView,
  type WorldGen,
} from '@suongdo/shared';
import type { Db } from '../db.ts';

/** Công trình phía server: có thêm dữ liệu riêng (đồ trong rương) không gửi cho client. */
export interface ServerStruct extends StructPublic {
  items?: Slot[];
  /** lần cập nhật độ lớn cây trồng gần nhất (giây thế giới) */
  gl?: number;
}

export interface ServerChunk extends ChunkDeltaView {
  cx: number;
  cy: number;
  st: Map<number, ServerStruct>;
  /** máu còn lại của vật thể tự nhiên đang bị đánh dở (không lưu) */
  objHp: Map<number, number>;
  dirty: boolean;
  lastNeeded: number;
}

/** Không cho vật thể mọc lại dưới công trình. */
export const NEVER = 1e15;

interface ChunkJson {
  rm: [number, number][];
  st: [number, ServerStruct][];
}

export class ChunkStore {
  readonly chunks = new Map<string, ServerChunk>();

  constructor(
    private db: Db,
    private view: WorldView,
  ) {}

  get(cx: number, cy: number): ServerChunk {
    const key = chunkKey(cx, cy);
    let c = this.chunks.get(key);
    if (c) return c;
    const row = this.db.get<{ data: string }>('SELECT data FROM chunks WHERE cx = ? AND cy = ?', cx, cy);
    c = { cx, cy, rm: new Map(), st: new Map(), objHp: new Map(), dirty: false, lastNeeded: Date.now() };
    if (row) {
      const j = JSON.parse(row.data) as ChunkJson;
      for (const [i, at] of j.rm) c.rm.set(i, at);
      for (const [i, s] of j.st) c.st.set(i, s);
    }
    this.chunks.set(key, c);
    this.view.deltas.set(key, c);
    return c;
  }

  at(tx: number, ty: number): ServerChunk {
    return this.get(chunkOf(tx), chunkOf(ty));
  }

  structAt(tx: number, ty: number): ServerStruct | undefined {
    return this.at(tx, ty).st.get(localIndex(tx, ty));
  }

  setStruct(tx: number, ty: number, s: ServerStruct | null): void {
    const c = this.at(tx, ty);
    const i = localIndex(tx, ty);
    if (s) c.st.set(i, s);
    else c.st.delete(i);
    c.dirty = true;
  }

  setRemoved(tx: number, ty: number, respawnAt: number | null): void {
    const c = this.at(tx, ty);
    const i = localIndex(tx, ty);
    if (respawnAt === null) c.rm.delete(i);
    else c.rm.set(i, respawnAt);
    c.objHp.delete(i);
    c.dirty = true;
  }

  serialize(c: ServerChunk, now: number): string {
    const rm: [number, number][] = [];
    for (const [i, at] of c.rm) if (at > now) rm.push([i, at]);
    return JSON.stringify({ rm, st: [...c.st.entries()] } satisfies ChunkJson);
  }

  /** Ghi các chunk đã thay đổi. Trả về danh sách để đánh dấu sạch sau khi commit. */
  flush(now: number, done: (() => void)[]): void {
    for (const c of this.chunks.values()) {
      if (!c.dirty) continue;
      this.db.run(
        'INSERT INTO chunks(cx, cy, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(cx, cy) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
        c.cx,
        c.cy,
        this.serialize(c, now),
        Date.now(),
      );
      done.push(() => {
        c.dirty = false;
      });
    }
  }

  /** Giải phóng chunk không còn ai cần (đã lưu). */
  unloadIdle(needed: Set<string>, idleMs: number): void {
    const t = Date.now();
    for (const [k, c] of this.chunks) {
      if (needed.has(k)) {
        c.lastNeeded = t;
        continue;
      }
      if (!c.dirty && t - c.lastNeeded > idleMs) {
        this.chunks.delete(k);
        this.view.deltas.delete(k);
      }
    }
  }

  /** Công trình trong bán kính quanh (x, y). */
  structuresAround(x: number, y: number, r: number): { tx: number; ty: number; s: ServerStruct }[] {
    const out: { tx: number; ty: number; s: ServerStruct }[] = [];
    const x0 = Math.floor(x - r);
    const x1 = Math.floor(x + r);
    const y0 = Math.floor(y - r);
    const y1 = Math.floor(y + r);
    for (let cx = chunkOf(x0); cx <= chunkOf(x1); cx++) {
      for (let cy = chunkOf(y0); cy <= chunkOf(y1); cy++) {
        const c = this.get(cx, cy);
        for (const [i, s] of c.st) {
          const tx = cx * CHUNK + (i % CHUNK);
          const ty = cy * CHUNK + Math.floor(i / CHUNK);
          if (Math.hypot(tx + 0.5 - x, ty + 0.5 - y) <= r) out.push({ tx, ty, s });
        }
      }
    }
    return out;
  }
}

/** WorldView phía server: tự tải chunk từ CSDL khi cần. */
export class ServerWorldView extends WorldView {
  store!: ChunkStore;
  constructor(gen: WorldGen) {
    super(gen);
  }
  override delta(tx: number, ty: number): ChunkDeltaView | undefined {
    return this.store.at(tx, ty);
  }
}

export function publicStruct(s: ServerStruct): StructPublic {
  const { items: _items, gl: _gl, ...pub } = s;
  return pub;
}
