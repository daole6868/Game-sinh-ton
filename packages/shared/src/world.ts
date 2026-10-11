import { CHUNK } from './constants.ts';
import { OBJECT_BY_NUM, type ObjectDef } from './data/objects.ts';
import { STRUCTURES } from './data/structures.ts';
import { TILES } from './data/tiles.ts';
import { chunkKey, chunkOf, localIndex, type WorldGen } from './worldgen.ts';

/** Trạng thái công trình được gửi cho client. */
export interface StructPublic {
  /** id định nghĩa công trình */
  id: string;
  hp: number;
  /** id nhân vật chủ sở hữu */
  o: number;
  /** đang cháy tới thời điểm (giây thế giới) — cho công trình cần nhiên liệu */
  fu?: number;
  /** cây trồng */
  cr?: string;
  /** độ lớn của cây 0..1 */
  g?: number;
  /** tên chủ (sạp hàng, cột lãnh thổ) */
  on?: string;
}

/** Thay đổi của người chơi trên một chunk. */
export interface ChunkDeltaView {
  /** vật thể tự nhiên đã bị lấy: localIndex → thời điểm mọc lại */
  rm: Map<number, number>;
  /** công trình: localIndex → trạng thái */
  st: Map<number, StructPublic>;
}

export interface TerritoryInfo {
  id: number;
  x: number;
  y: number;
  r: number;
  /** chủ */
  o: number;
  on: string;
  /** người được cấp quyền */
  auth: number[];
}

export function territoryAt(list: readonly TerritoryInfo[], x: number, y: number): TerritoryInfo | undefined {
  for (const t of list) if (Math.hypot(t.x + 0.5 - x, t.y + 0.5 - y) <= t.r) return t;
  return undefined;
}

export function hasTerritoryAccess(list: readonly TerritoryInfo[], x: number, y: number, who: number): boolean {
  const t = territoryAt(list, x, y);
  return !t || t.o === who || t.auth.includes(who);
}

/** Lớp tra cứu thế giới = sinh thủ tục + thay đổi của người chơi. Dùng chung client & server. */
export class WorldView {
  readonly gen: WorldGen;
  readonly deltas = new Map<string, ChunkDeltaView>();
  territories: TerritoryInfo[] = [];
  /** thời gian thế giới hiện tại (để biết vật thể đã mọc lại chưa) */
  now = 0;

  constructor(gen: WorldGen) {
    this.gen = gen;
  }

  delta(tx: number, ty: number): ChunkDeltaView | undefined {
    return this.deltas.get(chunkKey(chunkOf(tx), chunkOf(ty)));
  }

  ensureDelta(cx: number, cy: number): ChunkDeltaView {
    const k = chunkKey(cx, cy);
    let d = this.deltas.get(k);
    if (!d) {
      d = { rm: new Map(), st: new Map() };
      this.deltas.set(k, d);
    }
    return d;
  }

  tile(tx: number, ty: number): number {
    return this.gen.tileAt(tx, ty);
  }

  objectAt(tx: number, ty: number): ObjectDef | undefined {
    const num = this.gen.baseObjectAt(tx, ty);
    if (!num) return undefined;
    const d = this.delta(tx, ty);
    if (d) {
      const at = d.rm.get(localIndex(tx, ty));
      if (at !== undefined && at > this.now) return undefined;
    }
    return OBJECT_BY_NUM[num];
  }

  structureAt(tx: number, ty: number): StructPublic | undefined {
    return this.delta(tx, ty)?.st.get(localIndex(tx, ty));
  }

  canPassDoor(st: StructPublic, tx: number, ty: number, who: number): boolean {
    if (who <= 0) return false;
    if (st.o === who) return true;
    const t = territoryAt(this.territories, tx + 0.5, ty + 0.5);
    return !!t && (t.o === who || t.auth.includes(who));
  }

  /** Ô có cản đường với nhân vật `who` không (who = 0: quái). */
  isSolid(tx: number, ty: number, who: number): boolean {
    const tile = TILES[this.tile(tx, ty)];
    if (!tile || tile.solid) return true;
    const st = this.structureAt(tx, ty);
    if (st) {
      const def = STRUCTURES[st.id];
      if (def?.solid) {
        if (def.door && this.canPassDoor(st, tx, ty, who)) return false;
        return true;
      }
    }
    const obj = this.objectAt(tx, ty);
    return !!obj?.solid;
  }

  tileSpeed(tx: number, ty: number): number {
    const st = this.structureAt(tx, ty);
    if (st && STRUCTURES[st.id]?.floor) return 1.1;
    return TILES[this.tile(tx, ty)]?.speed || 1;
  }

  isWater(tx: number, ty: number): boolean {
    return !!TILES[this.tile(tx, ty)]?.water;
  }
}

export function chunkOrigin(cx: number, cy: number): { x: number; y: number } {
  return { x: cx * CHUNK, y: cy * CHUNK };
}
