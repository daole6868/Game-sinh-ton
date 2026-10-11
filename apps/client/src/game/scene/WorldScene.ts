import {
  BUILD_RANGE,
  dayOf,
  darkness,
  type EntFull,
  HOTBAR_SIZE,
  INPUT_DT,
  INTERACT_RANGE,
  isBloodNight,
  ITEMS,
  type MeSnap,
  mistDensity,
  type MoveInput,
  type MoveState,
  nearestOutpost,
  NPC_LIST,
  type NpcRole,
  NPCS,
  OUTPOST_PLAZA_RADIUS,
  OUTPOST_SAFE_RADIUS,
  outpostsAround,
  ringOf,
  type S2C,
  seasonOf,
  STRUCTURES,
  stepMove,
  TILE_PX,
  TILES,
  zoneOf,
} from '@suongdo/shared';
import Phaser from 'phaser';
import { call, net } from '../../net/client';
import { askConfirm, note, openWindow, useStore } from '../../state/store';
import { buildFogCanvas, buildGlowCanvas, buildLightCanvas, getAtlas, solidCanvas } from '../art/atlas';
import { buildTileset } from '../art/tiles';
import { Keys } from '../input';
import { getWorld, initWorld, type ClientWorld } from '../world';
import { Effects } from './effects';
import { EntityRenderer, LABEL_STYLE, playerFrame } from './entities';
import { type LightSource, TerrainRenderer } from './terrain';
import { sfx } from '../sound';

type Target =
  | { kind: 'npc'; outpost: string; role: NpcRole; name: string; x: number; y: number }
  | { kind: 'struct'; tx: number; ty: number; id: string; x: number; y: number }
  | { kind: 'bag'; id: number; name: string; x: number; y: number }
  | { kind: 'player'; id: number; name: string; x: number; y: number };

const NPC_FRAME: Record<NpcRole, string> = {
  general: 'npc_general',
  smith: 'npc_smith',
  doctor: 'npc_doctor',
  scrap: 'npc_scrap',
  keeper: 'npc_keeper',
  guide: 'npc_guide',
  market: 'st_market_stall',
  board: 'st_notice_board',
};

const STRUCT_PROMPT: Record<string, string> = {
  chest: 'Mở rương',
  bed: 'Đặt điểm hồi sinh',
  sleeping_bag: 'Đặt điểm hồi sinh',
  campfire: 'Thêm gỗ vào lửa',
  lamp: 'Thêm than vào đèn',
  farm_plot: 'Gieo / thu hoạch',
  workbench: 'Chế tạo',
  furnace: 'Nung (chế tạo)',
  mech_bench: 'Chế tạo cơ khí',
  crystal_forge: 'Lò Tinh thể',
  totem: 'Quản lý lãnh thổ',
  market_stall: 'Xem sạp hàng',
};

export class WorldScene extends Phaser.Scene {
  private cw!: ClientWorld;
  private worldLayer!: Phaser.GameObjects.Layer;
  private overlayLayer!: Phaser.GameObjects.Layer;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private terrain!: TerrainRenderer;
  private entities!: EntityRenderer;
  private fx!: Effects;
  private keys!: Keys;
  private unsub: (() => void)[] = [];

  // ── nhân vật của mình (dự đoán phía client) ──
  private me: MoveState = { x: 0, y: 0, dashT: 0, dashCd: 0, dashX: 0, dashY: 0 };
  private prev = { x: 0, y: 0 };
  private corr = { x: 0, y: 0 };
  private ready = false;
  private acc = 0;
  private seq = 0;
  private pending: MoveInput[] = [];
  private sendQ: MoveInput[] = [];
  private sendT = 0;
  private dashQueued = false;
  private lastSnap: MeSnap | null = null;
  private renderX = 0;
  private renderY = 0;
  private aim = 0;
  private meSpr!: Phaser.GameObjects.Image;
  private meHeld!: Phaser.GameObjects.Image;
  private meLabel!: Phaser.GameObjects.Text;
  private walkT = 0;
  private swingT = 0;
  private mouseDown = false;
  private nextActAt = 0;
  private ghost!: Phaser.GameObjects.Image;
  private hover!: Phaser.GameObjects.Graphics;
  private target: Target | null = null;
  private targetT = 0;
  private uiT = 0;
  private fpsT = 0;
  private frames = 0;
  private worldTime = 0;
  private npcs = new Map<string, { img: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; x: number; y: number }>();
  private npcT = 0;
  private zoom = 3;

  constructor() {
    super('world');
  }

  // ───────────────────────── khởi tạo ─────────────────────────

  create(): void {
    this.makeTextures();
    const st = useStore.getState();
    this.cw = getWorld() ?? initWorld(st.seed);
    this.cw.myChar = st.me?.id ?? 0;
    this.worldTime = st.worldTime;

    this.worldLayer = this.add.layer();
    this.overlayLayer = this.add.layer();
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCam.ignore(this.worldLayer);
    this.cameras.main.ignore(this.overlayLayer);
    this.cameras.main.setBackgroundColor('#0d0a10');
    this.cameras.main.setRoundPixels(true);

    this.terrain = new TerrainRenderer(this, this.worldLayer, this.cw);
    this.terrain.myChar = this.cw.myChar;
    this.entities = new EntityRenderer(this, this.worldLayer);
    this.fx = new Effects(this, this.worldLayer, this.overlayLayer);

    this.meSpr = this.add.image(0, 0, 'atlas', playerFrame(this.cw.myChar, 0)).setOrigin(0.5, 0.9);
    this.meHeld = this.add.image(0, 0, 'atlas', 'icon_unknown').setScale(0.6).setVisible(false);
    this.meLabel = this.add.text(0, 0, st.me?.name ?? '', { ...LABEL_STYLE, color: '#ffe9a8' }).setOrigin(0.5, 1).setDepth(1_000_002);
    this.ghost = this.add.image(0, 0, 'atlas', 'icon_unknown').setOrigin(0.5, 1).setAlpha(0.6).setVisible(false).setDepth(1_000_003);
    this.hover = this.add.graphics().setDepth(1_000_004);
    this.worldLayer.add([this.meSpr, this.meHeld, this.meLabel, this.ghost, this.hover]);

    this.keys = new Keys();
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!p.leftButtonDown()) this.mouseDown = false;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const s = useStore.getState();
      const next = (s.sel + (dy > 0 ? 1 : -1) + HOTBAR_SIZE) % HOTBAR_SIZE;
      this.select(next);
    });

    this.scale.on('resize', () => this.onResize());
    this.onResize();

    this.unsub.push(
      net.on('s', (m) => this.onSnapshot(m)),
      net.on('fx', (m) => this.onFx(m)),
      net.on('welcome', (m) => this.onWelcome(m)),
      net.on('alive', () => {
        this.ready = false;
        this.pending = [];
      }),
      useStore.subscribe((s, prev) => {
        if (s.sel !== prev.sel) net.send({ t: 'sel', s: s.sel });
      }),
    );
    this.cw.view.territories = st.territories;
    this.events.once('shutdown', () => this.cleanup());
    this.events.once('destroy', () => this.cleanup());
  }

  private makeTextures(): void {
    const tex = this.textures;
    if (!tex.exists('tiles')) tex.addCanvas('tiles', buildTileset());
    if (!tex.exists('atlas')) {
      const a = getAtlas();
      const t = tex.addCanvas('atlas', a.canvas)!;
      for (const [name, f] of Object.entries(a.frames)) t.add(name, 0, f.x, f.y, f.w, f.h);
    }
    if (!tex.exists('light')) tex.addCanvas('light', buildLightCanvas(128));
    if (!tex.exists('glow')) tex.addCanvas('glow', buildGlowCanvas(64));
    if (!tex.exists('fog')) tex.addCanvas('fog', buildFogCanvas(128));
    if (!tex.exists('px')) tex.addCanvas('px', solidCanvas(1, 1, '#ffffff'));
    if (!tex.exists('rain')) tex.addCanvas('rain', solidCanvas(1, 7, '#a8c8f0'));
    if (!tex.exists('snow')) tex.addCanvas('snow', solidCanvas(2, 2, '#ffffff'));
  }

  private onResize(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.zoom = Math.max(2, Math.min(4, Math.round(h / (22 * TILE_PX))));
    this.cameras.main.setZoom(this.zoom);
    this.uiCam.setSize(w, h);
    this.fx.resize(w, h);
    this.fx.zoom = this.zoom;
    this.entities.setZoom(this.zoom);
    this.meLabel.setResolution(this.zoom);
    for (const n of this.npcs.values()) n.label.setResolution(this.zoom);
  }

  private onWelcome(m: Extract<S2C, { t: 'welcome' }>): void {
    if (m.seed !== this.cw.seed) {
      // máy chủ mới: tải lại toàn bộ
      this.scene.restart();
      return;
    }
    this.cw.myChar = m.me.id;
    this.terrain.myChar = m.me.id;
    this.meLabel.setText(m.me.name);
    this.ready = false;
    this.pending = [];
    this.entities.clear();
  }

  private cleanup(): void {
    for (const u of this.unsub) u();
    this.unsub = [];
    this.keys?.destroy();
    this.terrain?.destroy();
  }

  // ───────────────────────── mạng ─────────────────────────

  private moveCtx(s: MeSnap) {
    const me = this.cw.myChar;
    return {
      speedMul: s.sm,
      canRun: s.cr,
      canDash: s.cd,
      solid: (tx: number, ty: number) => this.cw.view.isSolid(tx, ty, me),
      tileSpeed: (tx: number, ty: number) => this.cw.view.tileSpeed(tx, ty),
    };
  }

  private onSnapshot(m: Extract<S2C, { t: 's' }>): void {
    const now = performance.now();
    this.worldTime = m.wt;
    this.cw.view.now = m.wt;
    this.lastSnap = m.me;
    useStore.setState({ snap: m.me });
    this.entities.onSnapshot(m.n, m.u, m.x, now);
    const s = m.me;
    if (!this.ready || !s.alive) {
      this.me = { x: s.x, y: s.y, dashT: s.dT, dashCd: s.dC, dashX: 0, dashY: 0 };
      this.prev = { x: s.x, y: s.y };
      this.corr = { x: 0, y: 0 };
      this.pending = [];
      this.ready = s.alive;
      return;
    }
    // Đối chiếu: lấy vị trí máy chủ rồi chạy lại các lệnh chưa được xác nhận
    this.pending = this.pending.filter((i) => i.seq > m.ack);
    const ns: MoveState = { x: s.x, y: s.y, dashT: s.dT, dashCd: s.dC, dashX: this.me.dashX, dashY: this.me.dashY };
    const ctx = this.moveCtx(s);
    for (const inp of this.pending) stepMove(ns, inp, ctx, INPUT_DT);
    const dx = ns.x - this.me.x;
    const dy = ns.y - this.me.y;
    if (Math.hypot(dx, dy) > 3) {
      this.corr = { x: 0, y: 0 };
      this.prev = { x: ns.x, y: ns.y };
    } else {
      this.corr.x -= dx;
      this.corr.y -= dy;
      this.prev.x += dx;
      this.prev.y += dy;
    }
    this.me = ns;
  }

  private onFx(m: Extract<S2C, { t: 'fx' }>): void {
    const myEid = useStore.getState().me?.eid;
    for (const f of m.l) {
      switch (f.k) {
        case 'hit': {
          const color = f.c === 'p' ? '#ff6a6a' : f.c === 'heal' ? '#7aff8a' : f.c === 'crit' ? '#ffd040' : f.c === 'struct' ? '#c8c8c8' : '#ffffff';
          this.fx.floatText(f.x, f.y, f.c === 'heal' ? `+${f.v}` : `${f.v}`, color, f.c === 'crit');
          if (f.c === 'p' && Math.hypot(f.x - this.me.x, f.y - this.me.y) < 0.6) {
            this.cameras.main.shake(100, 0.004);
            sfx('hurt');
          } else if (f.c !== 'heal') sfx('hit');
          break;
        }
        case 'swing':
          if (f.i !== myEid) this.entities.swing(f.i);
          break;
        case 'shot':
          this.fx.shot(f.x, f.y, f.a, f.sp, f.r, f.am);
          sfx(f.am === 'bullet' ? 'gun' : 'bow');
          break;
        case 'boom':
          this.fx.ring(f.x, f.y, f.r, 0x9ad040, 500, 0.4);
          this.fx.burst(f.x, f.y, 0x9ad040, 16, 90, 20, 2);
          this.cameras.main.shake(200, 0.008);
          sfx('boom');
          break;
        case 'slam':
          this.fx.telegraph(f.x, f.y, f.r);
          break;
        case 'gather':
          this.terrain.shake(f.tx, f.ty);
          this.fx.burst(f.tx + 0.5, f.ty + 0.6, 0xc8a878, 4, 30, 80);
          sfx('chop');
          break;
        case 'die': {
          const ev = this.entities.ents.get(f.i);
          if (ev) this.fx.burst(ev.x, ev.y - 0.3, 0xe0e0e0, 12, 50, 10, 1.5);
          break;
        }
        case 'lvl': {
          const names: Record<string, string> = {
            gathering: 'Thu hoạch',
            combat: 'Chiến đấu',
            crafting: 'Chế tạo',
            cooking: 'Nấu ăn',
            farming: 'Nông nghiệp',
            building: 'Xây dựng',
            trading: 'Thương lượng',
            survival: 'Sinh tồn',
          };
          note(`⬆ ${names[f.s] ?? f.s} lên cấp ${f.lv}!`, 'good');
          sfx('level');
          break;
        }
        case 'snd':
          sfx(f.s);
          break;
      }
    }
  }

  // ───────────────────────── vòng lặp ─────────────────────────

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.1, deltaMs / 1000);
    const now = performance.now();
    const st = useStore.getState();
    this.worldTime += dt;
    this.cw.view.now = this.worldTime;

    this.handleKeys(st);
    this.simulate(dt, st);
    this.sendT += dt;
    if (this.sendT >= 0.05 && this.sendQ.length > 0) {
      this.sendT = 0;
      net.send({ t: 'in', i: this.sendQ });
      this.sendQ = [];
    }

    // vị trí hiển thị = nội suy giữa hai bước + phần hiệu chỉnh mờ dần
    const k = Math.min(1, this.acc / INPUT_DT);
    const decay = Math.exp(-dt * 12);
    this.corr.x *= decay;
    this.corr.y *= decay;
    this.renderX = this.prev.x + (this.me.x - this.prev.x) * k + this.corr.x;
    this.renderY = this.prev.y + (this.me.y - this.prev.y) * k + this.corr.y;

    const cam = this.cameras.main;
    cam.centerOn(this.renderX * TILE_PX, this.renderY * TILE_PX - 4);

    this.terrain.update(this.renderX, this.renderY, this.worldTime, dt);
    this.entities.update(dt, now);
    this.fx.update(dt);
    this.drawSelf(dt, st);
    this.updateNpcs(dt);
    this.updateCursor(st);
    this.targetT -= dt;
    if (this.targetT <= 0) {
      this.targetT = 0.1;
      this.findTarget(st);
    }
    if (this.mouseDown && this.input.activePointer.leftButtonDown() && performance.now() >= this.nextActAt) this.primary(false);

    // ánh sáng & bầu không khí
    const snap = this.lastSnap;
    const blood = isBloodNight(this.worldTime);
    let dark = darkness(this.worldTime);
    if (st.weather === 'storm') dark = Math.max(dark, 0.25);
    if (blood) dark = Math.max(dark, 0.55);
    this.fx.drawLighting(cam, this.collectLights(st), dark, blood);
    const tx = Math.floor(this.renderX);
    const ty = Math.floor(this.renderY);
    const tile = TILES[this.cw.view.tile(tx, ty)]!;
    const ring = ringOf(this.renderX, this.renderY);
    const safe = nearestOutpost(this.cw.seed, this.renderX, this.renderY).dist <= OUTPOST_SAFE_RADIUS;
    const mist = safe ? 0 : mistDensity(ring, tile.key === 'mist');
    const winter = seasonOf(dayOf(this.worldTime)) === 3;
    this.fx.setAtmosphere({
      mist,
      weather: st.weather,
      snowy: tile.key === 'snow' || winter,
      blood,
      heat: st.weather === 'heat',
      dt,
      halluc: (snap?.mi ?? 0) > 50,
      w: this.scale.width,
      h: this.scale.height,
    });

    // cập nhật thông tin cho giao diện
    this.uiT -= dt;
    if (this.uiT <= 0) {
      this.uiT = 0.25;
      const zone = zoneOf(ring);
      const { outpost, dist } = nearestOutpost(this.cw.seed, this.renderX, this.renderY);
      const atOutpost = dist <= OUTPOST_PLAZA_RADIUS + 5 ? { id: outpost.id, name: outpost.name } : null;
      const cur = useStore.getState();
      if (cur.outpost?.id !== atOutpost?.id) useStore.setState({ outpost: atOutpost });
      useStore.setState({
        worldTime: this.worldTime,
        zone: { ring, name: safe ? `${outpost.name} (an toàn)` : zone.name, color: safe ? '#9ad8ff' : zone.color, biome: tile.biome, x: tx, y: ty },
      });
    }
    this.frames++;
    this.fpsT += dt;
    if (this.fpsT >= 1) {
      useStore.setState({ fps: Math.round(this.frames / this.fpsT) });
      this.frames = 0;
      this.fpsT = 0;
    }
  }

  /** Mô phỏng di chuyển theo bước cố định 30 Hz (giống máy chủ). */
  private simulate(dt: number, st: ReturnType<typeof useStore.getState>): void {
    const snap = this.lastSnap;
    if (!snap || !this.ready || !snap.alive || st.dead) {
      this.acc = 0;
      return;
    }
    const typing = st.chatOpen;
    let mx = 0;
    let my = 0;
    if (!typing) {
      if (this.keys.isDown('KeyA') || this.keys.isDown('ArrowLeft')) mx -= 1;
      if (this.keys.isDown('KeyD') || this.keys.isDown('ArrowRight')) mx += 1;
      if (this.keys.isDown('KeyW') || this.keys.isDown('ArrowUp')) my -= 1;
      if (this.keys.isDown('KeyS') || this.keys.isDown('ArrowDown')) my += 1;
    }
    if (st.touchMove) {
      mx = st.touchMove.x;
      my = st.touchMove.y;
    }
    const run = !typing && (this.keys.isDown('ShiftLeft') || this.keys.isDown('ShiftRight'));
    this.acc += dt;
    let steps = 0;
    const ctx = this.moveCtx(snap);
    while (this.acc >= INPUT_DT && steps < 5) {
      this.acc -= INPUT_DT;
      steps++;
      const inp: MoveInput = { seq: ++this.seq, mx, my, run, dash: this.dashQueued, a: this.aim };
      this.dashQueued = false;
      this.prev = { x: this.me.x, y: this.me.y };
      stepMove(this.me, inp, ctx, INPUT_DT);
      this.pending.push(inp);
      this.sendQ.push(inp);
      if (Math.hypot(mx, my) > 0) this.walkT += INPUT_DT;
    }
    if (this.pending.length > 90) this.pending.splice(0, this.pending.length - 90);
  }

  private drawSelf(dt: number, st: ReturnType<typeof useStore.getState>): void {
    const alive = !!this.lastSnap?.alive && !st.dead;
    this.meSpr.setVisible(alive);
    this.meLabel.setVisible(alive);
    if (!alive) {
      this.meHeld.setVisible(false);
      return;
    }
    const x = this.renderX * TILE_PX;
    const y = this.renderY * TILE_PX;
    const pointer = this.input.activePointer;
    const wp = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    this.aim = Math.atan2(wp.y / TILE_PX - (this.renderY - 0.35), wp.x / TILE_PX - this.renderX);
    const face = Math.cos(this.aim) < 0 ? -1 : 1;
    const moving = Math.hypot(this.me.x - this.prev.x, this.me.y - this.prev.y) > 0.001;
    const frame = moving ? 1 + (Math.floor(this.walkT * 8) % 2) : 0;
    this.meSpr.setFrame(playerFrame(this.cw.myChar, frame)).setFlipX(face < 0).setPosition(x, y).setDepth(y);
    this.meSpr.setAlpha((this.lastSnap?.dT ?? 0) > 0 ? 0.7 : 1);
    this.meLabel.setPosition(x, y - 15);
    const held = st.inv[st.sel];
    if (held && ITEMS[held.id] && !ITEMS[held.id]!.place) {
      this.swingT = Math.max(0, this.swingT - dt);
      const sw = this.swingT > 0 ? (1 - this.swingT / 0.22) * 2.2 - 1.1 : 0;
      this.meHeld
        .setVisible(true)
        .setFrame(`icon_${held.id}`)
        .setPosition(x + face * 5, y - 5)
        .setFlipX(face < 0)
        .setRotation(face * (sw + 0.2))
        .setDepth(y + 0.5);
    } else this.meHeld.setVisible(false);
  }

  private collectLights(st: ReturnType<typeof useStore.getState>): LightSource[] {
    const lights = this.terrain.lights(this.worldTime);
    if (this.lastSnap?.alive) {
      const held = st.inv[st.sel];
      const torch = held && ITEMS[held.id]?.light;
      lights.push({ x: this.renderX, y: this.renderY - 0.4, r: torch ? ITEMS[held.id]!.light! : 3.2, fire: !!torch });
    }
    for (const ev of this.entities.ents.values()) {
      if (ev.data.k === 'p') {
        const l = ev.data.it ? ITEMS[ev.data.it]?.light : undefined;
        lights.push({ x: ev.x, y: ev.y - 0.4, r: l ?? 2, fire: !!l });
      } else if (ev.data.k === 'm' && (ev.data.m === 'mist_spider' || ev.data.m === 'blood_herald' || ev.data.m === 'runner')) {
        lights.push({ x: ev.x, y: ev.y - 0.4, r: 1.2 });
      }
    }
    for (const n of this.npcs.values()) lights.push({ x: n.x, y: n.y - 0.5, r: 5 });
    return lights;
  }

  // ───────────────────────── NPC ở trạm ─────────────────────────

  private updateNpcs(dt: number): void {
    this.npcT -= dt;
    if (this.npcT > 0) return;
    this.npcT = 1;
    const want = new Set<string>();
    for (const o of outpostsAround(this.cw.seed, this.renderX, this.renderY)) {
      if (Math.hypot(o.x - this.renderX, o.y - this.renderY) > 70) continue;
      for (const n of NPC_LIST) {
        const key = `${o.id}:${n.role}`;
        want.add(key);
        if (this.npcs.has(key)) continue;
        const x = o.x + n.dx + 0.5;
        const y = o.y + n.dy + 0.5;
        const img = this.add.image(x * TILE_PX, (y + 0.45) * TILE_PX, 'atlas', NPC_FRAME[n.role]).setOrigin(0.5, 1).setDepth((y + 0.45) * TILE_PX);
        const text = n.role === 'market' ? 'Sàn giao dịch' : n.role === 'board' ? 'Bảng đơn hàng' : `${n.name}\n${n.title}`;
        const label = this.add
          .text(x * TILE_PX, (y - 0.7) * TILE_PX - (n.role === 'market' ? 8 : 0), text, { ...LABEL_STYLE, color: '#ffe9a8', fontSize: '9px', align: 'center' })
          .setOrigin(0.5, 1)
          .setDepth(1_000_002)
          .setResolution(this.zoom);
        this.worldLayer.add([img, label]);
        this.npcs.set(key, { img, label, x, y });
      }
    }
    for (const [k, n] of this.npcs) {
      if (!want.has(k)) {
        n.img.destroy();
        n.label.destroy();
        this.npcs.delete(k);
      }
    }
  }

  // ───────────────────────── điều khiển ─────────────────────────

  private select(i: number): void {
    useStore.setState({ sel: i });
  }

  private handleKeys(st: ReturnType<typeof useStore.getState>): void {
    for (const e of this.keys.takePressed()) {
      if (st.chatOpen) continue;
      const code = e.code;
      if (code.startsWith('Digit')) {
        const n = Number(code.slice(5));
        if (n >= 1 && n <= HOTBAR_SIZE) this.select(n - 1);
        continue;
      }
      if (st.dead) continue;
      switch (code) {
        case 'Space':
          this.dashQueued = true;
          break;
        case 'KeyE':
          if (this.target) this.interact(this.target);
          break;
        case 'KeyF': {
          const held = st.inv[st.sel];
          if (held) net.send({ t: 'use', i: st.sel });
          break;
        }
        case 'KeyQ': {
          const held = st.inv[st.sel];
          if (held && !st.reserved.includes(st.sel)) net.send({ t: 'drop', i: st.sel, n: e.shiftKey ? held.n : 1 });
          break;
        }
        case 'KeyB':
          useStore.setState({ demolish: !st.demolish });
          note(st.demolish ? 'Đã tắt chế độ tháo dỡ.' : 'Chế độ tháo dỡ: bấm vào công trình của bạn để tháo (hoàn lại vật phẩm nếu còn ≥ 50% độ bền).', 'info');
          break;
      }
    }
  }

  private worldPointer(): { x: number; y: number } {
    const wp = this.input.activePointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    return { x: wp.x / TILE_PX, y: wp.y / TILE_PX };
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    const st = useStore.getState();
    if (st.dead || !this.lastSnap?.alive) return;
    if (p.rightButtonDown()) {
      const w = this.worldPointer();
      const t = this.targetAt(w.x, w.y) ?? this.target;
      if (t) this.interact(t);
      else if (st.inv[st.sel]) net.send({ t: 'use', i: st.sel });
      return;
    }
    if (p.leftButtonDown()) {
      this.mouseDown = true;
      this.primary(true);
    }
  }

  /** Hành động chính: đánh, chặt, đặt công trình, ăn... */
  private primary(first: boolean): void {
    const st = useStore.getState();
    if (st.window || st.chatOpen) {
      this.mouseDown = false;
      return;
    }
    const w = this.worldPointer();
    const tx = Math.floor(w.x);
    const ty = Math.floor(w.y);
    const held = st.inv[st.sel];
    const def = held ? ITEMS[held.id] : undefined;
    if (st.demolish) {
      if (!first) return;
      const s = this.cw.structAt(tx, ty);
      if (!s) return;
      const name = STRUCTURES[s.id]?.name ?? s.id;
      askConfirm(`Tháo dỡ ${name}?`, () => net.send({ t: 'demolish', tx, ty }), 'Tháo dỡ');
      return;
    }
    if (def?.place) {
      if (!first) return;
      net.send({ t: 'place', i: st.sel, tx, ty });
      this.nextActAt = performance.now() + 220;
      return;
    }
    const consumable = def && (def.cat === 'food' || def.cat === 'drink' || def.cat === 'medicine' || def.usable);
    if (consumable && !first) return;
    net.send({ t: 'act', x: w.x, y: w.y });
    const cd = def?.weapon?.cd ?? (def?.tool?.kind === 'rod' ? 2.2 : 0.45);
    this.nextActAt = performance.now() + cd * 1000;
    if (!consumable && !def?.weapon?.ranged) this.swingT = 0.22;
  }

  private updateCursor(st: ReturnType<typeof useStore.getState>): void {
    const w = this.worldPointer();
    const tx = Math.floor(w.x);
    const ty = Math.floor(w.y);
    const held = st.inv[st.sel];
    const def = held ? ITEMS[held.id] : undefined;
    this.hover.clear();
    if (st.demolish) {
      this.ghost.setVisible(false);
      const s = this.cw.structAt(tx, ty);
      this.hover.lineStyle(1, s ? 0xff5050 : 0x804040, 1).strokeRect(tx * TILE_PX, ty * TILE_PX, TILE_PX, TILE_PX);
      return;
    }
    if (def?.place && this.lastSnap?.alive) {
      const ok = this.canPlaceHere(tx, ty);
      this.ghost
        .setVisible(true)
        .setFrame(`st_${def.place === 'campfire' ? 'campfire_1' : def.place}`)
        .setPosition(tx * TILE_PX + TILE_PX / 2, (ty + 1) * TILE_PX)
        .setTint(ok ? 0x80ff90 : 0xff6060);
      this.hover.lineStyle(1, ok ? 0x80ff90 : 0xff6060, 0.8).strokeRect(tx * TILE_PX, ty * TILE_PX, TILE_PX, TILE_PX);
    } else {
      this.ghost.setVisible(false);
      const obj = this.cw.view.objectAt(tx, ty);
      const d = Math.hypot(tx + 0.5 - this.renderX, ty + 0.5 - this.renderY);
      if (obj && d <= 2.7) this.hover.lineStyle(1, 0xffffff, 0.35).strokeRect(tx * TILE_PX, ty * TILE_PX, TILE_PX, TILE_PX);
    }
  }

  private canPlaceHere(tx: number, ty: number): boolean {
    if (Math.hypot(tx + 0.5 - this.renderX, ty + 0.5 - this.renderY) > BUILD_RANGE) return false;
    const tile = TILES[this.cw.view.tile(tx, ty)]!;
    if (tile.solid || tile.water) return false;
    if (this.cw.structAt(tx, ty) || this.cw.view.objectAt(tx, ty)) return false;
    if (nearestOutpost(this.cw.seed, tx + 0.5, ty + 0.5).dist <= OUTPOST_SAFE_RADIUS + 4) return false;
    if (Math.hypot(tx, ty) < 30) return false;
    return true;
  }

  // ───────────────────────── tương tác ─────────────────────────

  private targetAt(x: number, y: number): Target | null {
    const cands = this.candidates();
    let best: Target | null = null;
    let bd = 1.2;
    for (const c of cands) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bd && Math.hypot(c.x - this.renderX, c.y - this.renderY) <= INTERACT_RANGE + 0.8) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  private candidates(): Target[] {
    const out: Target[] = [];
    const px = this.renderX;
    const py = this.renderY;
    for (const [key, n] of this.npcs) {
      if (Math.hypot(n.x - px, n.y - py) > 4) continue;
      const [outpost, role] = key.split(':') as [string, NpcRole];
      out.push({ kind: 'npc', outpost, role, name: NPCS[role].name, x: n.x, y: n.y });
    }
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const tx = Math.floor(px) + dx;
        const ty = Math.floor(py) + dy;
        const s = this.cw.structAt(tx, ty);
        if (s && STRUCT_PROMPT[s.id]) out.push({ kind: 'struct', tx, ty, id: s.id, x: tx + 0.5, y: ty + 0.5 });
      }
    }
    for (const ev of this.entities.ents.values()) {
      if (Math.hypot(ev.x - px, ev.y - py) > 4) continue;
      if (ev.data.k === 'b') out.push({ kind: 'bag', id: ev.id, name: ev.data.n ?? '', x: ev.x, y: ev.y });
      else if (ev.data.k === 'p') out.push({ kind: 'player', id: ev.id, name: ev.data.n ?? '', x: ev.x, y: ev.y });
    }
    return out;
  }

  private findTarget(st: ReturnType<typeof useStore.getState>): void {
    if (st.dead || !this.lastSnap?.alive) {
      this.target = null;
      if (st.prompt) useStore.setState({ prompt: null });
      return;
    }
    let best: Target | null = null;
    let bd = INTERACT_RANGE + 0.3;
    for (const c of this.candidates()) {
      const d = Math.hypot(c.x - this.renderX, c.y - this.renderY) + (c.kind === 'player' ? 0.6 : 0);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    this.target = best;
    let prompt: string | null = null;
    if (best) {
      if (best.kind === 'npc') prompt = best.role === 'market' ? 'Mở Sàn giao dịch' : best.role === 'board' ? 'Xem Bảng đơn hàng' : `Nói chuyện với ${best.name}`;
      else if (best.kind === 'struct') {
        const s = this.cw.structAt(best.tx, best.ty);
        prompt = STRUCT_PROMPT[best.id] ?? 'Tương tác';
        if (best.id === 'farm_plot' && s) prompt = s.cr ? ((s.g ?? 0) >= 1 ? 'Thu hoạch' : `Đang lớn ${Math.floor((s.g ?? 0) * 100)}%`) : 'Gieo hạt (cầm hạt giống)';
        if (best.id === 'campfire' && s && !(s.fu && s.fu > this.worldTime)) prompt = 'Nhóm lửa (cần gỗ)';
      } else if (best.kind === 'bag') prompt = `Mở túi hành trang của ${best.name}`;
      else prompt = `Mời ${best.name} giao dịch`;
    }
    if (prompt !== st.prompt) useStore.setState({ prompt });
  }

  private interact(t: Target): void {
    switch (t.kind) {
      case 'npc': {
        const map: Record<NpcRole, () => void> = {
          general: () => openWindow({ kind: 'shop', outpost: t.outpost, role: 'general' }),
          smith: () => openWindow({ kind: 'shop', outpost: t.outpost, role: 'smith' }),
          doctor: () => openWindow({ kind: 'shop', outpost: t.outpost, role: 'doctor' }),
          scrap: () => openWindow({ kind: 'shop', outpost: t.outpost, role: 'scrap' }),
          board: () => openWindow({ kind: 'contracts', outpost: t.outpost }),
          keeper: () => openWindow({ kind: 'keeper', outpost: t.outpost }),
          guide: () => openWindow({ kind: 'travel', outpost: t.outpost }),
          market: () => openWindow({ kind: 'market', outpost: t.outpost }),
        };
        map[t.role]();
        const g = NPCS[t.role].greeting;
        if (g) note(`${NPCS[t.role].name}: “${g}”`, 'info');
        break;
      }
      case 'struct':
        switch (t.id) {
          case 'workbench':
          case 'furnace':
          case 'mech_bench':
            openWindow({ kind: 'inventory', tab: 'craft' });
            break;
          case 'crystal_forge':
            openWindow({ kind: 'forge', tx: t.tx, ty: t.ty });
            break;
          case 'totem':
            openWindow({ kind: 'totem', tx: t.tx, ty: t.ty });
            break;
          case 'market_stall':
            openWindow({ kind: 'stall', tx: t.tx, ty: t.ty });
            break;
          default:
            net.send({ t: 'ustruct', tx: t.tx, ty: t.ty });
        }
        break;
      case 'bag':
        net.send({ t: 'pickup', id: t.id });
        break;
      case 'player':
        void call('trade_invite', { target: t.id });
        break;
    }
  }

  /** Cho thanh điều khiển cảm ứng gọi. */
  touchAction(kind: 'primary' | 'interact' | 'dash'): void {
    if (kind === 'dash') this.dashQueued = true;
    else if (kind === 'interact') {
      if (this.target) this.interact(this.target);
    } else {
      // nhắm vào mục tiêu gần nhất
      const ev = this.entities.nearest(this.renderX, this.renderY, 3, ['m']);
      if (ev) this.aim = Math.atan2(ev.y - this.renderY, ev.x - this.renderX);
      const st = useStore.getState();
      const x = this.renderX + Math.cos(this.aim) * 1.2;
      const y = this.renderY + Math.sin(this.aim) * 1.2;
      net.send({ t: 'act', x, y });
      const def = st.inv[st.sel] ? ITEMS[st.inv[st.sel]!.id] : undefined;
      if (!def?.weapon?.ranged) this.swingT = 0.22;
    }
  }

  getEntity(id: number): EntFull | undefined {
    return this.entities.ents.get(id)?.data;
  }
}
