import { CHUNK, chunkKey, chunkOf, localIndex, OBJECT_BY_NUM, STRUCTURES, type StructPublic, TILE_PX } from '@suongdo/shared';
import Phaser from 'phaser';
import { tileIndex } from '../art/tiles';
import type { ClientWorld } from '../world';

export interface LightSource {
  x: number;
  y: number;
  /** bán kính (ô) */
  r: number;
  fire?: boolean;
}

interface StView {
  img: Phaser.GameObjects.Image;
  crop?: Phaser.GameObjects.Image;
  st: StructPublic;
  tx: number;
  ty: number;
}

const GROUND_R = 2;
const OBJ_R = 1;

function stDepth(id: string, tx: number, ty: number): number {
  const def = STRUCTURES[id];
  if (def?.floor) return -50_000 + ty;
  if (def?.low) return ty * TILE_PX + 1;
  return (ty + 1) * TILE_PX - 1;
}

/** Vẽ nền (tilemap theo chunk), vật thể tự nhiên và công trình quanh người chơi. */
export class TerrainRenderer {
  private ground = new Map<string, { map: Phaser.Tilemaps.Tilemap; layer: Phaser.Tilemaps.TilemapLayer }>();
  private objs = new Map<string, Map<number, Phaser.GameObjects.Image>>();
  private sts = new Map<string, Map<number, StView>>();
  private queue: { key: string; kind: 'ground' | 'objs' }[] = [];
  private cx = NaN;
  private cy = NaN;
  private animT = 0;
  private animFrame = 0;
  private respawnT = 0;
  myChar = 0;

  constructor(
    private scene: Phaser.Scene,
    private layer: Phaser.GameObjects.Layer,
    private cw: ClientWorld,
  ) {
    cw.onChunk = (cx, cy) => this.rebuildChunk(cx, cy);
    cw.onTile = (tx, ty) => this.updateTile(tx, ty);
  }

  update(px: number, py: number, worldTime: number, dt: number): void {
    const cx = chunkOf(Math.floor(px));
    const cy = chunkOf(Math.floor(py));
    if (cx !== this.cx || cy !== this.cy) {
      this.cx = cx;
      this.cy = cy;
      this.plan();
    }
    // xây dần, tối đa 2 chunk mỗi khung hình
    for (let n = 0; n < 2 && this.queue.length > 0; n++) {
      const job = this.queue.shift()!;
      const [x, y] = job.key.split(',').map(Number) as [number, number];
      if (job.kind === 'ground') this.buildGround(x, y);
      else this.buildObjects(x, y);
    }
    this.animT += dt;
    if (this.animT > 0.18) {
      this.animT = 0;
      this.animFrame ^= 1;
      for (const m of this.sts.values()) for (const v of m.values()) if (v.st.id === 'campfire') this.styleStruct(v, worldTime);
    }
    this.respawnT += dt;
    if (this.respawnT > 2) {
      this.respawnT = 0;
      this.checkRespawns(worldTime);
    }
  }

  private plan(): void {
    const want = new Set<string>();
    for (let dx = -GROUND_R; dx <= GROUND_R; dx++) {
      for (let dy = -GROUND_R; dy <= GROUND_R; dy++) {
        const k = chunkKey(this.cx + dx, this.cy + dy);
        want.add(k);
        if (!this.ground.has(k) && !this.queue.some((q) => q.key === k && q.kind === 'ground')) {
          // ưu tiên chunk gần
          const job = { key: k, kind: 'ground' as const };
          if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) this.queue.unshift(job);
          else this.queue.push(job);
        }
      }
    }
    for (let dx = -OBJ_R; dx <= OBJ_R; dx++) {
      for (let dy = -OBJ_R; dy <= OBJ_R; dy++) {
        const k = chunkKey(this.cx + dx, this.cy + dy);
        if (!this.objs.has(k) && !this.queue.some((q) => q.key === k && q.kind === 'objs')) this.queue.push({ key: k, kind: 'objs' });
      }
    }
    for (const [k, g] of this.ground) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      if (Math.abs(x - this.cx) > GROUND_R + 1 || Math.abs(y - this.cy) > GROUND_R + 1) {
        g.layer.destroy();
        g.map.destroy();
        this.ground.delete(k);
      }
    }
    for (const k of [...this.objs.keys()]) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      if (Math.abs(x - this.cx) > OBJ_R + 1 || Math.abs(y - this.cy) > OBJ_R + 1) this.destroyObjects(k);
    }
    this.queue = this.queue.filter((q) => {
      const [x, y] = q.key.split(',').map(Number) as [number, number];
      const r = q.kind === 'ground' ? GROUND_R + 1 : OBJ_R + 1;
      return Math.abs(x - this.cx) <= r && Math.abs(y - this.cy) <= r;
    });
    this.cw.prune(this.cx, this.cy, 5);
  }

  private buildGround(cx: number, cy: number): void {
    const key = chunkKey(cx, cy);
    if (this.ground.has(key)) return;
    const c = this.cw.gen.getChunk(cx, cy);
    const data: number[][] = [];
    for (let ly = 0; ly < CHUNK; ly++) {
      const row: number[] = [];
      for (let lx = 0; lx < CHUNK; lx++) row.push(tileIndex(c.tiles[ly * CHUNK + lx]!, cx * CHUNK + lx, cy * CHUNK + ly));
      data.push(row);
    }
    const map = this.scene.make.tilemap({ data, tileWidth: TILE_PX, tileHeight: TILE_PX });
    const ts = map.addTilesetImage('tiles', 'tiles', TILE_PX, TILE_PX, 0, 0)!;
    const layer = map.createLayer(0, ts, cx * CHUNK * TILE_PX, cy * CHUNK * TILE_PX)!;
    layer.setDepth(-100_000);
    this.layer.add(layer);
    this.ground.set(key, { map, layer });
  }

  private objImage(tx: number, ty: number, num: number): Phaser.GameObjects.Image | null {
    const def = OBJECT_BY_NUM[num];
    if (!def) return null;
    const img = this.scene.add.image(tx * TILE_PX + TILE_PX / 2, (ty + 1) * TILE_PX, 'atlas', `obj_${def.id}`);
    img.setOrigin(0.5, 1);
    img.setDepth(def.solid ? (ty + 1) * TILE_PX - 2 : ty * TILE_PX + 2);
    this.layer.add(img);
    return img;
  }

  private buildObjects(cx: number, cy: number): void {
    const key = chunkKey(cx, cy);
    if (this.objs.has(key)) return;
    const c = this.cw.gen.getChunk(cx, cy);
    const om = new Map<number, Phaser.GameObjects.Image>();
    const sm = new Map<number, StView>();
    for (let i = 0; i < CHUNK * CHUNK; i++) {
      const num = c.objs[i];
      if (!num) continue;
      const tx = cx * CHUNK + (i % CHUNK);
      const ty = cy * CHUNK + Math.floor(i / CHUNK);
      if (!this.cw.view.objectAt(tx, ty)) continue;
      const img = this.objImage(tx, ty, num);
      if (img) om.set(i, img);
    }
    const d = this.cw.view.deltas.get(key);
    if (d) {
      for (const [i, st] of d.st) {
        const tx = cx * CHUNK + (i % CHUNK);
        const ty = cy * CHUNK + Math.floor(i / CHUNK);
        sm.set(i, this.makeStruct(st, tx, ty));
      }
    }
    this.objs.set(key, om);
    this.sts.set(key, sm);
  }

  private destroyObjects(key: string): void {
    for (const img of this.objs.get(key)?.values() ?? []) img.destroy();
    for (const v of this.sts.get(key)?.values() ?? []) {
      v.img.destroy();
      v.crop?.destroy();
    }
    this.objs.delete(key);
    this.sts.delete(key);
  }

  private makeStruct(st: StructPublic, tx: number, ty: number): StView {
    const img = this.scene.add.image(tx * TILE_PX + TILE_PX / 2, (ty + 1) * TILE_PX, 'atlas', `st_${st.id}`);
    img.setOrigin(0.5, 1);
    img.setDepth(stDepth(st.id, tx, ty));
    this.layer.add(img);
    const v: StView = { img, st, tx, ty };
    this.styleStruct(v, this.cw.view.now);
    return v;
  }

  private styleStruct(v: StView, t: number): void {
    const { st, img } = v;
    if (st.id === 'campfire') {
      const lit = !!st.fu && st.fu > t;
      img.setFrame(lit ? (this.animFrame ? 'st_campfire_2' : 'st_campfire_1') : 'st_campfire');
    } else if (st.id === 'lamp') {
      img.setTint(st.fu && st.fu > t ? 0xffffff : 0x8a8a8a);
    } else if (STRUCTURES[st.id]?.door) {
      img.setAlpha(this.cw.view.canPassDoor(st, v.tx, v.ty, this.myChar) ? 0.92 : 1);
    }
    const def = STRUCTURES[st.id];
    if (def?.farm) {
      const g = st.g ?? 0;
      const frame = !st.cr ? null : g < 0.34 ? 'st_crop_sprout' : g < 1 ? `st_crop_${st.cr}_1` : `st_crop_${st.cr}_2`;
      if (frame) {
        if (!v.crop) {
          v.crop = this.scene.add.image(img.x, img.y - 1, 'atlas', frame).setOrigin(0.5, 1);
          v.crop.setDepth(img.depth + 1);
          this.layer.add(v.crop);
        } else v.crop.setFrame(frame);
      } else if (v.crop) {
        v.crop.destroy();
        v.crop = undefined;
      }
    }
    // công trình hư hại: hơi đỏ
    const max = def?.hp ?? 100;
    if (st.id !== 'lamp' && st.hp < max * 0.5) img.setTint(0xffb0b0);
    else if (st.id !== 'lamp') img.clearTint();
  }

  /** Dữ liệu chunk mới tới từ máy chủ: dựng lại vật thể và công trình. */
  rebuildChunk(cx: number, cy: number): void {
    const key = chunkKey(cx, cy);
    if (!this.objs.has(key)) return;
    this.destroyObjects(key);
    this.buildObjects(cx, cy);
  }

  updateTile(tx: number, ty: number): void {
    const key = chunkKey(chunkOf(tx), chunkOf(ty));
    const om = this.objs.get(key);
    const sm = this.sts.get(key);
    if (!om || !sm) return;
    const i = localIndex(tx, ty);
    const present = !!this.cw.view.objectAt(tx, ty);
    const img = om.get(i);
    if (present && !img) {
      const ni = this.objImage(tx, ty, this.cw.gen.baseObjectAt(tx, ty));
      if (ni) om.set(i, ni);
    } else if (!present && img) {
      this.scene.tweens.add({ targets: img, alpha: 0, scaleY: 0.6, duration: 160, onComplete: () => img.destroy() });
      om.delete(i);
    }
    const st = this.cw.view.structureAt(tx, ty);
    const v = sm.get(i);
    if (st && v && v.st.id === st.id) {
      v.st = st;
      this.styleStruct(v, this.cw.view.now);
    } else {
      if (v) {
        v.img.destroy();
        v.crop?.destroy();
        sm.delete(i);
      }
      if (st) sm.set(i, this.makeStruct(st, tx, ty));
    }
  }

  private checkRespawns(t: number): void {
    for (const [key, om] of this.objs) {
      const d = this.cw.view.deltas.get(key);
      if (!d) continue;
      const [cx, cy] = key.split(',').map(Number) as [number, number];
      for (const [i, at] of d.rm) {
        if (at > t) continue;
        d.rm.delete(i);
        if (om.has(i)) continue;
        const tx = cx * CHUNK + (i % CHUNK);
        const ty = cy * CHUNK + Math.floor(i / CHUNK);
        const img = this.objImage(tx, ty, this.cw.gen.baseObjectAt(tx, ty));
        if (img) om.set(i, img);
      }
    }
  }

  /** Rung nhẹ vật thể khi bị đánh. */
  shake(tx: number, ty: number): void {
    const img = this.objs.get(chunkKey(chunkOf(tx), chunkOf(ty)))?.get(localIndex(tx, ty));
    if (!img) return;
    const x0 = tx * TILE_PX + TILE_PX / 2;
    this.scene.tweens.add({ targets: img, x: { from: x0 - 1.5, to: x0 }, duration: 120, ease: 'Bounce' });
  }

  /** Nguồn sáng từ công trình gần người chơi. */
  lights(t: number): LightSource[] {
    const out: LightSource[] = [];
    for (const sm of this.sts.values()) {
      for (const v of sm.values()) {
        const def = STRUCTURES[v.st.id];
        if (!def?.light) continue;
        if (def.fuel && !(v.st.fu && v.st.fu > t)) continue;
        out.push({ x: v.tx + 0.5, y: v.ty + 0.4, r: def.light, fire: v.st.id === 'campfire' || v.st.id === 'torch_stand' || v.st.id === 'furnace' });
      }
    }
    return out;
  }

  /** Công trình ở ô (để hiển thị gợi ý tương tác). */
  structViews(): Iterable<StView> {
    const self = this;
    return (function* () {
      for (const sm of self.sts.values()) yield* sm.values();
    })();
  }

  destroy(): void {
    for (const g of this.ground.values()) {
      g.layer.destroy();
      g.map.destroy();
    }
    for (const k of [...this.objs.keys()]) this.destroyObjects(k);
    this.ground.clear();
  }
}
