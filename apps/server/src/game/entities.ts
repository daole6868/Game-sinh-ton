import type { EntFull, EntKind, EntUpd, ItemStack, MobDef, Slot } from '@suongdo/shared';

export abstract class Entity {
  abstract readonly kind: EntKind;
  x = 0;
  y = 0;
  /** tăng khi thông tin tĩnh thay đổi (client cần nhận bản đầy đủ) */
  ver = 1;
  /** tick gần nhất có thay đổi động (vị trí, máu...) */
  changed = 0;
  removed = false;
  constructor(readonly id: number) {}
  abstract full(): EntFull;
  abstract upd(): EntUpd;
}

export class GroundItem extends Entity {
  readonly kind = 'i' as const;
  despawnAt: number;
  /** người vừa vứt không tự nhặt lại ngay */
  noPickupFor = 0;
  noPickupUntil = 0;
  constructor(
    id: number,
    public stack: ItemStack,
    x: number,
    y: number,
    now: number,
  ) {
    super(id);
    this.x = x;
    this.y = y;
    this.despawnAt = now + 5 * 60_000;
  }
  full(): EntFull {
    return { i: this.id, k: 'i', x: this.x, y: this.y, it: this.stack.id, q: this.stack.n };
  }
  upd(): EntUpd {
    return [this.id, Math.round(this.x * 100), Math.round(this.y * 100), 0, 100, 0];
  }
}

export class Bag extends Entity {
  readonly kind = 'b' as const;
  constructor(
    id: number,
    public owner: number,
    public ownerName: string,
    public slots: Slot[],
    x: number,
    y: number,
    public expiresAt: number,
    public ownerOnlyUntil: number,
  ) {
    super(id);
    this.x = x;
    this.y = y;
  }
  full(): EntFull {
    return { i: this.id, k: 'b', x: this.x, y: this.y, n: this.ownerName };
  }
  upd(): EntUpd {
    return [this.id, Math.round(this.x * 100), Math.round(this.y * 100), 0, 100, 0];
  }
  isEmpty(): boolean {
    return this.slots.every((s) => !s);
  }
}

export const MOB_STATE = { idle: 0, chase: 1, attack: 2, flee: 3, wander: 4 } as const;

export class Mob extends Entity {
  readonly kind = 'm' as const;
  hp: number;
  maxHp: number;
  dmg: number;
  a = 0;
  state: number = MOB_STATE.idle;
  target: number | null = null;
  /** công trình đang phá (tx, ty) */
  breakTile: { tx: number; ty: number } | null = null;
  nextAttack = 0;
  nextSlam = 0;
  slamAt = 0;
  wanderUntil = 0;
  wx = 0;
  wy = 0;
  /** bị đánh: thú trung lập nổi giận tới thời điểm này */
  angryUntil = 0;
  angryAt: number | null = null;
  fleeUntil = 0;
  lastX = 0;
  lastY = 0;
  stuckT = 0;
  sideStepUntil = 0;
  sideDir = 1;
  farSince = 0;
  blood = false;
  /** tâm trạm gần nhất (quái không vào vùng an toàn) */
  safeX = 0;
  safeY = 0;
  /** người gây sát thương: id nhân vật → sát thương */
  hitters = new Map<number, number>();
  constructor(
    id: number,
    public def: MobDef,
    public lv: number,
    x: number,
    y: number,
    hp: number,
    dmg: number,
  ) {
    super(id);
    this.x = x;
    this.y = y;
    this.lastX = x;
    this.lastY = y;
    this.hp = hp;
    this.maxHp = hp;
    this.dmg = dmg;
  }
  full(): EntFull {
    return {
      i: this.id,
      k: 'm',
      x: this.x,
      y: this.y,
      a: this.a,
      m: this.def.id,
      l: this.lv,
      h: Math.round((this.hp / this.maxHp) * 100),
      s: this.state,
    };
  }
  upd(): EntUpd {
    return [
      this.id,
      Math.round(this.x * 100),
      Math.round(this.y * 100),
      Math.round(this.a * 100),
      Math.max(0, Math.round((this.hp / this.maxHp) * 100)),
      this.state,
    ];
  }
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  left: number;
  dmg: number;
  owner: number; // id thực thể người bắn
  ownerChar: number;
}

/** Lưới không gian để tìm thực thể ở gần nhanh. */
export class SpatialGrid<T extends Entity> {
  private cells = new Map<number, Set<T>>();
  private where = new Map<T, number>();
  constructor(private size = 8) {}

  private key(x: number, y: number): number {
    const cx = Math.floor(x / this.size) + 32768;
    const cy = Math.floor(y / this.size) + 32768;
    return cx * 65536 + cy;
  }

  update(e: T): void {
    const k = this.key(e.x, e.y);
    const old = this.where.get(e);
    if (old === k) return;
    if (old !== undefined) this.cells.get(old)?.delete(e);
    let set = this.cells.get(k);
    if (!set) {
      set = new Set();
      this.cells.set(k, set);
    }
    set.add(e);
    this.where.set(e, k);
  }

  remove(e: T): void {
    const old = this.where.get(e);
    if (old !== undefined) {
      const set = this.cells.get(old);
      set?.delete(e);
      if (set && set.size === 0) this.cells.delete(old);
    }
    this.where.delete(e);
  }

  query(x: number, y: number, r: number, out: T[] = []): T[] {
    const s = this.size;
    const x0 = Math.floor((x - r) / s);
    const x1 = Math.floor((x + r) / s);
    const y0 = Math.floor((y - r) / s);
    const y1 = Math.floor((y + r) / s);
    const r2 = r * r;
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const set = this.cells.get((cx + 32768) * 65536 + (cy + 32768));
        if (!set) continue;
        for (const e of set) {
          const dx = e.x - x;
          const dy = e.y - y;
          if (dx * dx + dy * dy <= r2) out.push(e);
        }
      }
    }
    return out;
  }
}
