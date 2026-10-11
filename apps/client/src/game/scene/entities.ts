import { type EntFull, type EntUpd, ITEMS, MOBS, TILE_PX } from '@suongdo/shared';
import Phaser from 'phaser';
import { SHIRT_COLORS } from '../art/sprites';

interface Sample {
  t: number;
  x: number;
  y: number;
  a: number;
}

export interface EV {
  id: number;
  data: EntFull;
  spr: Phaser.GameObjects.Image;
  held?: Phaser.GameObjects.Image;
  label?: Phaser.GameObjects.Text;
  bar?: Phaser.GameObjects.Graphics;
  samples: Sample[];
  x: number;
  y: number;
  a: number;
  h: number;
  s: number;
  walkT: number;
  moving: boolean;
  swingT: number;
  flashT: number;
  bornT: number;
}

const INTERP_DELAY = 130;
export const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"VT323", monospace',
  fontSize: '10px',
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 2,
};

export function playerFrame(charId: number, frame: number): string {
  return `player_${Math.abs(charId) % SHIRT_COLORS.length}_${frame}`;
}

/** Vẽ người chơi khác, quái, vật phẩm rơi, túi hành trang — nội suy từ ảnh chụp máy chủ. */
export class EntityRenderer {
  readonly ents = new Map<number, EV>();
  zoom = 3;

  constructor(
    private scene: Phaser.Scene,
    private layer: Phaser.GameObjects.Layer,
  ) {}

  private frameFor(d: EntFull): string {
    switch (d.k) {
      case 'p':
        return playerFrame(d.c ?? d.i, 0);
      case 'm':
        return `mob_${d.m}`;
      case 'i':
        return `icon_${d.it}`;
      case 'b':
        return 'bag';
    }
  }

  private create(d: EntFull, now: number): EV {
    const spr = this.scene.add.image(d.x * TILE_PX, d.y * TILE_PX, 'atlas', this.frameFor(d));
    if (!this.scene.textures.get('atlas').has(this.frameFor(d))) spr.setFrame('icon_unknown');
    spr.setOrigin(0.5, d.k === 'i' ? 0.5 : 0.9);
    if (d.k === 'i') spr.setScale(0.7);
    this.layer.add(spr);
    const ev: EV = {
      id: d.i,
      data: d,
      spr,
      samples: [{ t: now, x: d.x, y: d.y, a: d.a ?? 0 }],
      x: d.x,
      y: d.y,
      a: d.a ?? 0,
      h: d.h ?? 100,
      s: d.s ?? 0,
      walkT: 0,
      moving: false,
      swingT: 0,
      flashT: 0,
      bornT: now,
    };
    this.decorate(ev);
    return ev;
  }

  private decorate(ev: EV): void {
    const d = ev.data;
    ev.label?.destroy();
    ev.label = undefined;
    ev.held?.destroy();
    ev.held = undefined;
    if (d.k === 'p') {
      const name = d.pv ? `⚔ ${d.n ?? ''}` : (d.n ?? '');
      ev.label = this.scene.add.text(0, 0, name, { ...LABEL_STYLE, color: d.pv ? '#ff8a8a' : '#ffffff' }).setOrigin(0.5, 1).setResolution(this.zoom);
      if (d.it && ITEMS[d.it]) {
        ev.held = this.scene.add.image(0, 0, 'atlas', `icon_${d.it}`).setScale(0.6);
        this.layer.add(ev.held);
      }
    } else if (d.k === 'm') {
      const def = d.m ? MOBS[d.m] : undefined;
      if (def?.boss) {
        ev.label = this.scene.add.text(0, 0, `☠ ${def.name} Lv${d.l}`, { ...LABEL_STYLE, color: '#ff6a6a', fontSize: '11px' }).setOrigin(0.5, 1).setResolution(this.zoom);
      }
    } else if (d.k === 'b') {
      ev.label = this.scene.add.text(0, 0, `Túi của ${d.n}`, { ...LABEL_STYLE, color: '#e8d8a0', fontSize: '9px' }).setOrigin(0.5, 1).setResolution(this.zoom);
    } else if (d.k === 'i' && (d.q ?? 1) > 1) {
      ev.label = this.scene.add.text(0, 0, `${d.q}`, { ...LABEL_STYLE, fontSize: '8px' }).setOrigin(0, 0).setResolution(this.zoom);
    }
    if (ev.label) {
      ev.label.setDepth(1_000_002);
      this.layer.add(ev.label);
    }
  }

  onSnapshot(n: EntFull[], u: EntUpd[], x: number[], now: number): void {
    for (const d of n) {
      const ev = this.ents.get(d.i);
      if (ev) {
        const kindChanged = ev.data.k !== d.k || ev.data.m !== d.m || ev.data.it !== d.it || ev.data.n !== d.n || ev.data.pv !== d.pv || ev.data.q !== d.q;
        ev.data = d;
        ev.samples.push({ t: now, x: d.x, y: d.y, a: d.a ?? ev.a });
        if (d.h !== undefined) ev.h = d.h;
        if (d.s !== undefined) ev.s = d.s;
        ev.spr.setFrame(this.frameFor(d));
        if (kindChanged) this.decorate(ev);
      } else {
        this.ents.set(d.i, this.create(d, now));
      }
    }
    for (const [id, xx, yy, aa, h, s] of u) {
      const ev = this.ents.get(id);
      if (!ev) continue;
      if (h < ev.h) ev.flashT = 0.12;
      ev.samples.push({ t: now, x: xx / 100, y: yy / 100, a: aa / 100 });
      if (ev.samples.length > 8) ev.samples.splice(0, ev.samples.length - 8);
      ev.h = h;
      ev.s = s;
    }
    for (const id of x) this.remove(id);
  }

  remove(id: number): void {
    const ev = this.ents.get(id);
    if (!ev) return;
    ev.spr.destroy();
    ev.held?.destroy();
    ev.label?.destroy();
    ev.bar?.destroy();
    this.ents.delete(id);
  }

  clear(): void {
    for (const id of [...this.ents.keys()]) this.remove(id);
  }

  swing(id: number): void {
    const ev = this.ents.get(id);
    if (ev) ev.swingT = 0.22;
  }

  update(dt: number, now: number): void {
    const rt = now - INTERP_DELAY;
    for (const ev of this.ents.values()) {
      // nội suy vị trí
      const S = ev.samples;
      while (S.length > 2 && S[1]!.t <= rt) S.shift();
      let x: number;
      let y: number;
      let a = ev.a;
      if (S.length >= 2 && S[0]!.t <= rt) {
        const s0 = S[0]!;
        const s1 = S[1]!;
        const k = Math.min(1, (rt - s0.t) / Math.max(1, s1.t - s0.t));
        x = s0.x + (s1.x - s0.x) * k;
        y = s0.y + (s1.y - s0.y) * k;
        a = s1.a;
      } else {
        const s = S[S.length - 1]!;
        x = s.x;
        y = s.y;
        a = s.a;
      }
      const moved = Math.hypot(x - ev.x, y - ev.y);
      ev.moving = moved > 0.002;
      ev.x = x;
      ev.y = y;
      ev.a = a;
      this.place(ev, dt, now);
    }
  }

  private place(ev: EV, dt: number, now: number): void {
    const d = ev.data;
    const px = ev.x * TILE_PX;
    const py = ev.y * TILE_PX;
    const face = Math.cos(ev.a) < 0 ? -1 : 1;
    let bob = 0;
    if (ev.moving) ev.walkT += dt;
    if (d.k === 'p') {
      const f = ev.moving ? 1 + (Math.floor(ev.walkT * 8) % 2) : 0;
      ev.spr.setFrame(playerFrame(d.c ?? d.i, f));
      ev.spr.setFlipX(face < 0);
      if (ev.s === 1) ev.spr.setAlpha(0.7);
      else ev.spr.setAlpha(1);
    } else if (d.k === 'm') {
      ev.spr.setFlipX(face < 0);
      bob = ev.moving ? Math.abs(Math.sin(ev.walkT * 12)) * -1.2 : 0;
      if (ev.s === 2) bob = Math.sin(now / 50) * 0.8;
    } else if (d.k === 'i') {
      bob = Math.sin(now / 300 + ev.id) * 1.5 - 4;
    }
    ev.spr.setPosition(px, py + bob);
    ev.spr.setDepth(py);
    // nháy trắng khi trúng đòn
    if (ev.flashT > 0) {
      ev.flashT -= dt;
      ev.spr.setTintFill(0xffffff);
    } else ev.spr.clearTint();
    // vũ khí trên tay
    if (ev.held) {
      ev.swingT = Math.max(0, ev.swingT - dt);
      const sw = ev.swingT > 0 ? (1 - ev.swingT / 0.22) * 2.2 - 1.1 : 0;
      ev.held.setPosition(px + face * 5, py - 5);
      ev.held.setFlipX(face < 0);
      ev.held.setRotation(face * (sw + 0.2));
      ev.held.setDepth(py + 0.5);
    }
    if (ev.label) {
      if (d.k === 'i') ev.label.setPosition(px + 2, py - 2);
      else ev.label.setPosition(px, py - (d.k === 'm' && MOBS[d.m ?? '']?.boss ? 30 : 15));
    }
    // thanh máu
    const showBar = (d.k === 'm' || d.k === 'p') && ev.h < 100 && ev.h > 0;
    if (showBar) {
      if (!ev.bar) {
        ev.bar = this.scene.add.graphics();
        ev.bar.setDepth(1_000_001);
        this.layer.add(ev.bar);
      }
      const big = d.k === 'm' && MOBS[d.m ?? '']?.boss;
      const w = big ? 28 : 14;
      const top = py - (big ? 34 : 17);
      ev.bar.clear();
      ev.bar.fillStyle(0x000000, 0.7).fillRect(px - w / 2 - 1, top - 1, w + 2, 4);
      ev.bar.fillStyle(ev.h > 50 ? 0x5ad05a : ev.h > 25 ? 0xe8c040 : 0xe04040, 1).fillRect(px - w / 2, top, (w * ev.h) / 100, 2);
    } else if (ev.bar) {
      ev.bar.destroy();
      ev.bar = undefined;
    }
  }

  /** Tìm thực thể gần một điểm (đơn vị ô). */
  nearest(x: number, y: number, maxD: number, kinds: string[]): EV | null {
    let best: EV | null = null;
    let bd = maxD;
    for (const ev of this.ents.values()) {
      if (!kinds.includes(ev.data.k)) continue;
      const d = Math.hypot(ev.x - x, ev.y - y);
      if (d < bd) {
        bd = d;
        best = ev;
      }
    }
    return best;
  }

  setZoom(z: number): void {
    this.zoom = z;
    for (const ev of this.ents.values()) ev.label?.setResolution(z);
  }
}
