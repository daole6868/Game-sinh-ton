import { TILE_PX } from '@suongdo/shared';
import Phaser from 'phaser';
import { LABEL_STYLE } from './entities';
import type { LightSource } from './terrain';

interface Particle {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  max: number;
  grav: number;
}

interface Shot {
  g: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  left: number;
}

/** Hiệu ứng thế giới + lớp phủ màn hình (ánh sáng, sương, mưa). */
export class Effects {
  private particles: Particle[] = [];
  private shots: Shot[] = [];
  private dark!: Phaser.GameObjects.RenderTexture;
  private glows: Phaser.GameObjects.Image[] = [];
  private mistRect!: Phaser.GameObjects.Rectangle;
  private fog!: Phaser.GameObjects.TileSprite;
  private tint!: Phaser.GameObjects.Rectangle;
  private rain!: Phaser.GameObjects.Particles.ParticleEmitter;
  private snow!: Phaser.GameObjects.Particles.ParticleEmitter;
  private rainZone = new Phaser.Geom.Rectangle(0, -20, 100, 10);
  private ghosts: Phaser.GameObjects.Image[] = [];
  private ghostT = 3;
  zoom = 3;

  constructor(
    private scene: Phaser.Scene,
    private world: Phaser.GameObjects.Layer,
    private overlay: Phaser.GameObjects.Layer,
  ) {
    this.dark = scene.add.renderTexture(0, 0, 64, 64).setOrigin(0, 0).setDepth(900_000);
    world.add(this.dark);
    this.tint = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0).setOrigin(0, 0);
    this.mistRect = scene.add.rectangle(0, 0, 10, 10, 0x8a1830, 0).setOrigin(0, 0);
    this.fog = scene.add.tileSprite(0, 0, 10, 10, 'fog').setOrigin(0, 0).setAlpha(0).setTint(0xd05a6a);
    overlay.add([this.tint, this.mistRect, this.fog]);
    this.rain = scene.add.particles(0, 0, 'rain', {
      emitZone: { type: 'random', source: this.rainZone as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource },
      lifespan: 1400,
      speedY: { min: 520, max: 720 },
      speedX: { min: -90, max: -60 },
      alpha: 0.55,
      quantity: 3,
      frequency: 18,
      emitting: false,
    });
    this.snow = scene.add.particles(0, 0, 'snow', {
      emitZone: { type: 'random', source: this.rainZone as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource },
      lifespan: 7000,
      speedY: { min: 40, max: 90 },
      speedX: { min: -30, max: 30 },
      alpha: { start: 0.9, end: 0.3 },
      scale: { min: 1, max: 2 },
      quantity: 2,
      frequency: 60,
      emitting: false,
    });
    overlay.add([this.rain, this.snow]);
  }

  resize(w: number, h: number): void {
    this.tint.setSize(w, h);
    this.mistRect.setSize(w, h);
    this.fog.setSize(w, h);
    this.rainZone.width = w + 200;
    this.rainZone.x = 0;
  }

  // ───────────────────────── hiệu ứng thế giới ─────────────────────────

  floatText(x: number, y: number, text: string, color: string, big = false): void {
    const t = this.scene.add
      .text(x * TILE_PX + (Math.random() - 0.5) * 6, y * TILE_PX - 14, text, { ...LABEL_STYLE, color, fontSize: big ? '13px' : '10px' })
      .setOrigin(0.5, 1)
      .setDepth(1_000_010)
      .setResolution(this.zoom);
    this.world.add(t);
    this.scene.tweens.add({ targets: t, y: t.y - 14, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  burst(x: number, y: number, color: number, n = 6, speed = 40, grav = 60, size = 1): void {
    for (let i = 0; i < n; i++) {
      const img = this.scene.add.image(x * TILE_PX, y * TILE_PX, 'px').setTint(color).setScale(size).setDepth(y * TILE_PX + 5);
      this.world.add(img);
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({ img, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.6, life: 0, max: 0.4 + Math.random() * 0.4, grav });
    }
  }

  shot(x: number, y: number, a: number, speed: number, range: number, ammo: string): void {
    const g = this.scene.add.image(x * TILE_PX, y * TILE_PX - 6, 'atlas', ammo === 'bullet' ? 'icon_bullet' : 'icon_arrow');
    g.setScale(ammo === 'bullet' ? 0.35 : 0.6).setRotation(a + Math.PI / 4).setDepth(1_000_000);
    this.world.add(g);
    this.shots.push({ g, vx: Math.cos(a) * speed * TILE_PX, vy: Math.sin(a) * speed * TILE_PX, left: range / speed });
    if (ammo === 'bullet') this.burst(x + Math.cos(a) * 0.6, y + Math.sin(a) * 0.6 - 0.3, 0xffd060, 4, 50, 0);
  }

  ring(x: number, y: number, r: number, color: number, duration = 400, fill = 0.25): void {
    const g = this.scene.add.graphics().setDepth(y * TILE_PX - 1);
    this.world.add(g);
    const obj = { t: 0 };
    this.scene.tweens.add({
      targets: obj,
      t: 1,
      duration,
      onUpdate: () => {
        g.clear();
        g.fillStyle(color, fill * (1 - obj.t));
        g.fillCircle(x * TILE_PX, y * TILE_PX, r * TILE_PX * (0.3 + 0.7 * obj.t));
        g.lineStyle(1, color, 1 - obj.t);
        g.strokeCircle(x * TILE_PX, y * TILE_PX, r * TILE_PX * (0.3 + 0.7 * obj.t));
      },
      onComplete: () => g.destroy(),
    });
  }

  /** Vòng cảnh báo đòn đập đất (đỏ) trước khi trúng. */
  telegraph(x: number, y: number, r: number): void {
    const g = this.scene.add.graphics().setDepth(y * TILE_PX - 1);
    this.world.add(g);
    const obj = { t: 0 };
    this.scene.tweens.add({
      targets: obj,
      t: 1,
      duration: 800,
      onUpdate: () => {
        g.clear();
        g.fillStyle(0xff2030, 0.12 + 0.2 * obj.t);
        g.fillCircle(x * TILE_PX, y * TILE_PX, r * TILE_PX);
        g.lineStyle(1, 0xff4050, 0.9);
        g.strokeCircle(x * TILE_PX, y * TILE_PX, r * TILE_PX * obj.t);
      },
      onComplete: () => {
        g.destroy();
        this.ring(x, y, r, 0xff4050, 300, 0.4);
        this.scene.cameras.main.shake(180, 0.006);
      },
    });
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life += dt;
      p.vy += p.grav * dt;
      p.img.x += p.vx * dt;
      p.img.y += p.vy * dt;
      p.img.setAlpha(1 - p.life / p.max);
      if (p.life >= p.max) {
        p.img.destroy();
        this.particles.splice(i, 1);
      }
    }
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i]!;
      s.g.x += s.vx * dt;
      s.g.y += s.vy * dt;
      s.left -= dt;
      if (s.left <= 0) {
        s.g.destroy();
        this.shots.splice(i, 1);
      }
    }
  }

  // ───────────────────────── ánh sáng ─────────────────────────

  /**
   * Lớp bóng tối: tô tối toàn khung nhìn rồi "khoét" các vùng sáng.
   * Vẽ ở độ phân giải thế giới (rẻ, ra chất pixel mềm).
   */
  drawLighting(cam: Phaser.Cameras.Scene2D.Camera, lights: LightSource[], darkness: number, blood: boolean): void {
    // vẽ ở nửa độ phân giải thế giới rồi phóng ×2 (rẻ hơn 4 lần, vẫn mềm mại)
    const S = 2;
    const wv = cam.worldView;
    const w = Math.ceil(wv.width / S) + 2;
    const h = Math.ceil(wv.height / S) + 2;
    if (darkness <= 0.01) {
      this.dark.setVisible(false);
      for (const g of this.glows) g.setVisible(false);
      return;
    }
    this.dark.setVisible(true);
    if (this.dark.width !== w || this.dark.height !== h) this.dark.resize(w, h);
    const ox = Math.floor(wv.x / S) * S - S;
    const oy = Math.floor(wv.y / S) * S - S;
    this.dark.setPosition(ox, oy).setScale(S);
    this.dark.clear();
    this.dark.fill(blood ? 0x2a0008 : 0x050818, darkness);
    let gi = 0;
    for (const l of lights) {
      const lx = (l.x * TILE_PX - ox) / S;
      const ly = (l.y * TILE_PX - oy) / S;
      const R = (l.r * TILE_PX) / S;
      if (lx < -R || ly < -R || lx > w + R || ly > h + R) continue;
      const flick = l.fire ? 1 + Math.sin(performance.now() / 90 + l.x * 7) * 0.04 : 1;
      this.dark.stamp('light', undefined, lx, ly, { scale: ((R * 2) / 128) * flick, erase: true, originX: 0.5, originY: 0.5 });
      if (l.fire) {
        let g = this.glows[gi];
        if (!g) {
          g = this.scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(900_001);
          this.world.add(g);
          this.glows.push(g);
        }
        g.setVisible(true).setPosition(l.x * TILE_PX, l.y * TILE_PX).setScale((l.r * TILE_PX * 1.6 * flick) / 64).setAlpha(Math.min(1, darkness * 1.1));
        gi++;
      }
    }
    for (; gi < this.glows.length; gi++) this.glows[gi]!.setVisible(false);
  }

  // ───────────────────────── lớp phủ màn hình ─────────────────────────

  setAtmosphere(opts: { mist: number; weather: string; snowy: boolean; blood: boolean; heat: boolean; dt: number; halluc: boolean; w: number; h: number }): void {
    const { mist, weather, snowy, blood, heat, dt } = opts;
    const mistA = Math.min(0.32, mist * 0.22);
    this.mistRect.setAlpha(mistA);
    const fogA = Math.min(0.85, mist * 0.55 + (weather === 'fog' ? 0.35 : 0));
    this.fog.setAlpha(fogA);
    this.fog.setTint(mist > 0 ? 0xd05a6a : 0xe8eef2);
    this.fog.tilePositionX += dt * 6;
    this.fog.tilePositionY += dt * 2;
    if (blood) this.tint.setFillStyle(0x800010, 0.12);
    else if (heat) this.tint.setFillStyle(0xff9a30, 0.07);
    else this.tint.setFillStyle(0x000000, 0);
    const wet = weather === 'rain' || weather === 'storm';
    const wantRain = wet && !snowy;
    const wantSnow = wet && snowy;
    if (wantRain !== this.rain.emitting) wantRain ? this.rain.start() : this.rain.stop();
    if (wantSnow !== this.snow.emitting) wantSnow ? this.snow.start() : this.snow.stop();
    this.rain.setQuantity(weather === 'storm' ? 6 : 3);
    // ảo giác khi Nhiễm Sương cao
    if (opts.halluc) {
      this.ghostT -= dt;
      if (this.ghostT <= 0) {
        this.ghostT = 2 + Math.random() * 5;
        const frames = ['mob_infected', 'mob_runner', 'mob_mist_spider', 'mob_wolf'];
        const g = this.scene.add
          .image(Math.random() * opts.w, opts.h * (0.2 + Math.random() * 0.6), 'atlas', frames[Math.floor(Math.random() * frames.length)])
          .setScale(this.zoom)
          .setAlpha(0)
          .setTint(0xff3050);
        this.overlay.add(g);
        this.ghosts.push(g);
        this.scene.tweens.add({ targets: g, alpha: { from: 0, to: 0.45 }, yoyo: true, duration: 700, onComplete: () => g.destroy() });
      }
    }
  }
}
