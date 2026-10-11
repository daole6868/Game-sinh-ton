import {
  AOI_RADIUS,
  addStack,
  type C2S,
  CHUNK_VIEW_RADIUS,
  chunkKey,
  chunkOf,
  dayOf,
  type EntFull,
  type EntUpd,
  type Fx,
  INPUT_DT,
  type ItemStack,
  localIndex,
  makeStack,
  nearestOutpost,
  OUTPOST_PLAZA_RADIUS,
  phaseOf,
  type DayPhase,
  RING_SIZE,
  ringOf,
  type S2C,
  seasonOf,
  type Slot,
  SNAPSHOT_EVERY_TICKS,
  START_XU,
  stepMove,
  type StructPublic,
  TICK_DT,
  TICK_RATE,
  TILES,
  type WeatherKind,
  type WorldInfo,
  WorldGen,
  DASH_STAMINA,
  hashString,
  CHUNK,
  BAG_LIFETIME_MS,
  BAG_OWNER_ONLY_MS,
  type TerritoryInfo,
} from '@suongdo/shared';
import crypto from 'node:crypto';
import type { WebSocket } from 'ws';
import type { Config } from '../config.ts';
import { type Db, GameError } from '../db.ts';
import { charWallet, Ledger, SYS } from '../economy/ledger.ts';
import { ChunkStore, publicStruct, ServerWorldView } from './chunks.ts';
import { Bag, type Entity, GroundItem, Mob, type Projectile, SpatialGrid } from './entities.ts';
import { type CharacterData, newCharacterData, Player } from './player.ts';
import { updateSurvival } from './survival.ts';
import { updateMobs, spawnTick, onBloodNightStart, onBloodNightWave } from './mobs.ts';
import { updateProjectiles } from './combat.ts';
import { autoPickup, tickCrops } from './actions.ts';
import { dispatch } from '../net/dispatch.ts';
import { questEvent } from './quests.ts';
import { Market } from '../economy/market.ts';
import { Mail } from '../economy/mail.ts';
import { Shop } from '../economy/shop.ts';
import { Trades } from '../economy/trade.ts';
import { Contracts } from '../economy/contracts.ts';
import { Territories } from '../economy/territory.ts';
import { Stalls } from '../economy/stall.ts';

export interface Account {
  id: number;
  username: string;
  is_guest: number;
  playtime_sec: number;
}

interface FxEntry {
  x: number;
  y: number;
  fx: Fx;
}

export class Game {
  readonly ledger: Ledger;
  readonly gen: WorldGen;
  readonly view: ServerWorldView;
  readonly chunks: ChunkStore;
  readonly seed: number;
  time = 0;
  weather: { kind: WeatherKind; until: number } = { kind: 'clear', until: 0 };
  tickN = 0;
  private nextId = 1;
  readonly players = new Map<number, Player>();
  readonly byChar = new Map<number, Player>();
  readonly mobs = new Map<number, Mob>();
  readonly items = new Map<number, GroundItem>();
  readonly bags = new Map<number, Bag>();
  projectiles: Projectile[] = [];
  readonly grid = new SpatialGrid<Entity>(8);
  private fxQueue: FxEntry[] = [];
  groundDirty = false;
  flags = { market: true, mail: true, trade: true, stall: true };
  private lastDay = 0;
  private lastPhase: DayPhase = 'day';
  private lastSave = Date.now();
  private lastMinute = Date.now();
  private timer: NodeJS.Timeout | null = null;
  readonly market: Market;
  readonly mail: Mail;
  readonly shop: Shop;
  readonly trades: Trades;
  readonly contracts: Contracts;
  readonly territories: Territories;
  readonly stalls: Stalls;
  bloodWaves = 0;
  readonly startedAt = Date.now();

  constructor(
    readonly cfg: Config,
    readonly db: Db,
  ) {
    const savedSeed = db.getMeta('seed');
    this.seed = savedSeed ? Number(savedSeed) : cfg.seed >>> 0;
    if (!savedSeed) db.setMeta('seed', String(this.seed));
    this.gen = new WorldGen(this.seed, 600);
    this.view = new ServerWorldView(this.gen);
    this.chunks = new ChunkStore(db, this.view);
    this.view.store = this.chunks;
    this.ledger = new Ledger(db);
    this.time = db.getState<number>('time') ?? 30;
    this.view.now = this.time;
    this.weather = db.getState<{ kind: WeatherKind; until: number }>('weather') ?? { kind: 'clear', until: 0 };
    this.lastDay = dayOf(this.time);
    this.lastPhase = phaseOf(this.time);
    this.market = new Market(this);
    this.mail = new Mail(this);
    this.shop = new Shop(this);
    this.trades = new Trades(this);
    this.contracts = new Contracts(this);
    this.territories = new Territories(this);
    this.stalls = new Stalls(this);
    this.loadGround();
    this.contracts.ensureDay(this.lastDay);
  }

  // ───────────────────────── vòng lặp ─────────────────────────

  start(): void {
    if (this.timer) return;
    let last = performance.now();
    let acc = 0;
    this.timer = setInterval(() => {
      const t = performance.now();
      acc += (t - last) / 1000;
      last = t;
      // bắt kịp tối đa 5 tick nếu server bị chậm
      let n = 0;
      while (acc >= TICK_DT && n < 5) {
        acc -= TICK_DT;
        n++;
        try {
          this.tick();
        } catch (e) {
          console.error('[tick] lỗi:', e);
        }
      }
      if (acc > TICK_DT * 5) acc = 0;
    }, 1000 / TICK_RATE / 2);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const p of [...this.players.values()]) {
      this.trades.cancelFor(p, 'Máy chủ tắt.');
    }
    this.saveAll();
  }

  newId(): number {
    return this.nextId++;
  }

  tick(): void {
    const now = Date.now();
    this.time += TICK_DT * this.cfg.timeScale;
    this.view.now = this.time;
    this.tickN++;

    for (const p of this.players.values()) {
      if (!p.ws && p.leaveAt !== undefined && p.leaveAt <= now) {
        this.finalizeLeave(p);
        continue;
      }
      this.processInputs(p);
      if (p.alive) {
        updateSurvival(this, p, TICK_DT);
        autoPickup(this, p, now);
        this.grid.update(p);
        this.updateChunkSubs(p);
        this.checkPosition(p);
        if (p.open && p.open.kind !== 'safe' && Math.hypot(p.open.x - p.x, p.open.y - p.y) > 5) {
          p.open = null;
          p.send({ t: 'cont', c: null });
        }
      }
    }

    updateMobs(this, TICK_DT, now);
    updateProjectiles(this, TICK_DT);
    this.updateTimeEvents();
    this.updateWeather(now);

    if (this.tickN % TICK_RATE === 0) {
      spawnTick(this, now);
      this.expireGround(now);
      this.trades.tick(now);
    }
    if (this.tickN % SNAPSHOT_EVERY_TICKS === 0) {
      for (const p of this.players.values()) this.sendSnapshot(p);
    }
    this.flushFx();

    if (now - this.lastSave > this.cfg.saveIntervalSec * 1000) {
      this.lastSave = now;
      this.saveAll();
      this.unloadChunks();
    }
    if (now - this.lastMinute > 60_000) {
      this.lastMinute = now;
      this.minuteJobs();
    }
  }

  private minuteJobs(): void {
    try {
      this.shop.restock(60);
      tickCrops(this);
      this.market.expire();
      this.mail.expire();
      this.db.run('DELETE FROM idempotency WHERE created_at < ?', Date.now() - 24 * 3600_000);
      for (const p of this.players.values()) {
        const secs = Math.floor((Date.now() - p.playtimeFlushedAt) / 1000);
        if (secs > 0) {
          this.db.run('UPDATE accounts SET playtime_sec = playtime_sec + ? WHERE id = ?', secs, p.accountId);
          p.playtimeFlushedAt += secs * 1000;
        }
      }
    } catch (e) {
      console.error('[minute] lỗi:', e);
    }
  }

  private processInputs(p: Player): void {
    p.moveBudget = Math.min(p.moveBudget + TICK_DT, 0.35);
    let count = 0;
    const now = Date.now();
    while (p.inputs.length > 0 && p.moveBudget >= INPUT_DT - 1e-6 && count < 10) {
      const inp = p.inputs.shift()!;
      p.moveBudget -= INPUT_DT;
      count++;
      p.lastSeq = inp.seq;
      if (!p.alive) continue;
      const r = stepMove(
        p,
        inp,
        {
          speedMul: p.speedMul,
          canRun: p.stamina > 5 && p.hunger > 0,
          canDash: p.stamina >= DASH_STAMINA,
          solid: (tx, ty) => this.view.isSolid(tx, ty, p.charId),
          tileSpeed: (tx, ty) => this.view.tileSpeed(tx, ty),
        },
        INPUT_DT,
      );
      if (r.dashed) {
        p.stamina -= DASH_STAMINA;
        p.lastStaminaUse = now;
      }
      p.running = r.running;
      if (r.running) {
        p.stamina = Math.max(0, p.stamina - 12 * INPUT_DT);
        p.lastStaminaUse = now;
      }
      if (Number.isFinite(inp.a)) p.a = inp.a;
      p.changed = this.tickN;
      p.dirty = true;
    }
    if (p.inputs.length > 30) p.inputs.splice(0, p.inputs.length - 30);
  }

  /** Kiểm tra trạm đã khám phá, độ sâu mới, nhiệm vụ theo vị trí. */
  private checkPosition(p: Player): void {
    if (this.tickN % 10 !== 0) return;
    const ring = ringOf(p.x, p.y);
    p.ring = ring;
    if (ring > p.stats.maxRing) {
      p.stats.maxRing = ring;
      p.dirty = true;
    }
    questEvent(this, p, { kind: 'reach_ring', ring });
    const { outpost, dist } = nearestOutpost(this.seed, p.x, p.y);
    if (dist <= OUTPOST_PLAZA_RADIUS + 6) {
      if (!p.discovered.has(outpost.id)) {
        p.discovered.add(outpost.id);
        p.dirty = true;
        p.send({ t: 'disc', l: [...p.discovered] });
        this.note(p, `Đã khám phá ${outpost.name}. Bạn có thể dịch chuyển tới đây từ các trạm khác.`, 'good');
      }
      questEvent(this, p, { kind: 'visit_outpost' });
    }
  }

  // ───────────────────────── thời gian & thời tiết ─────────────────────────

  private updateTimeEvents(): void {
    const day = dayOf(this.time);
    const phase = phaseOf(this.time);
    if (day !== this.lastDay) {
      this.lastDay = day;
      this.onNewDay(day);
    }
    if (phase !== this.lastPhase) {
      const prev = this.lastPhase;
      this.lastPhase = phase;
      this.onPhase(phase, prev, day);
    }
    if (this.bloodWaves > 0 && phase === 'night') {
      const t = this.time % 1200;
      const waveTimes = [905, 1000, 1095];
      const idx = 3 - this.bloodWaves;
      if (idx >= 0 && idx < 3 && t >= waveTimes[idx]!) {
        this.bloodWaves--;
        onBloodNightWave(this, idx);
      }
    }
  }

  private onNewDay(day: number): void {
    this.contracts.ensureDay(day);
    try {
      this.territories.dailyUpkeep(day);
    } catch (e) {
      console.error('[upkeep] lỗi:', e);
    }
    const season = seasonOf(day);
    if (seasonOf(day - 1) !== season) {
      const names = ['Mùa xuân', 'Mùa hạ', 'Mùa thu', 'Mùa đông'];
      this.systemChat(`${names[season]} đã đến. ${season === 3 ? 'Trời rất lạnh, cây ngoài trời lớn rất chậm — hãy tích trữ thức ăn!' : ''}`);
    }
  }

  private onPhase(phase: DayPhase, _prev: DayPhase, day: number): void {
    const blood = day % 7 === 0;
    if (phase === 'dusk') {
      if (blood) this.systemChat('⚠ Trăng đỏ đang mọc... ĐÊM SƯƠNG ĐỎ sắp bắt đầu! Hãy về căn cứ và chuẩn bị.');
      for (const p of this.players.values()) p.nightAlive = p.alive;
    }
    if (phase === 'night') {
      for (const p of this.players.values()) if (!p.alive) p.nightAlive = false;
      if (blood) {
        this.bloodWaves = 3;
        onBloodNightStart(this);
      }
    }
    if (phase === 'dawn') {
      const wasBlood = (day - 1) % 7 === 0 && day > 1;
      for (const p of this.players.values()) {
        if (p.alive && p.nightAlive && p.ws) questEvent(this, p, { kind: 'survive_night' });
        if (wasBlood && p.alive && p.bloodAlive && p.ws) this.rewardBloodNight(p);
        p.nightAlive = false;
        p.bloodAlive = false;
      }
      if (wasBlood) {
        this.bloodWaves = 0;
        this.systemChat('Bình minh. Đêm Sương Đỏ đã qua. Người sống sót nhận Rương Sương Đỏ trong hòm thư.');
      }
    }
  }

  private rewardBloodNight(p: Player): void {
    p.stats.bloodStreak++;
    p.stats.bloodBest = Math.max(p.stats.bloodBest, p.stats.bloodStreak);
    const xu = 100 + 30 * p.stats.bloodStreak;
    try {
      this.atomic([p], () => {
        this.mail.sendSystem(p.charId, 'Phần thưởng Đêm Sương Đỏ', `Bạn đã sống sót qua ${p.stats.bloodStreak} Đêm Sương Đỏ liên tiếp.`, [makeStack('blood_chest', 1, { now: this.time })], 0);
        this.ledger.transfer(SYS.reward, charWallet(p.charId), xu, 'blood_night', String(dayOf(this.time)));
      });
      this.refreshWallet(p);
      this.note(p, `Sống sót qua Đêm Sương Đỏ! +${xu} Xu và 1 Rương Sương Đỏ (xem hòm thư ở trạm).`, 'good');
      p.send({ t: 'mail', unread: this.mail.unreadCount(p.charId) });
    } catch (e) {
      console.error('[blood reward]', e);
    }
    questEvent(this, p, { kind: 'blood_night' });
  }

  private updateWeather(now: number): void {
    if (now < this.weather.until) return;
    const season = seasonOf(dayOf(this.time));
    const table: Record<number, [WeatherKind, number][]> = {
      0: [['clear', 0.5], ['rain', 0.35], ['fog', 0.15]],
      1: [['clear', 0.55], ['heat', 0.3], ['rain', 0.1], ['storm', 0.05]],
      2: [['clear', 0.4], ['fog', 0.35], ['rain', 0.25]],
      3: [['clear', 0.5], ['rain', 0.3], ['storm', 0.1], ['fog', 0.1]],
    };
    let r = Math.random();
    let kind: WeatherKind = 'clear';
    for (const [k, w] of table[season]!) {
      if (r < w) {
        kind = k;
        break;
      }
      r -= w;
    }
    const dur = (kind === 'clear' ? 4 + Math.random() * 5 : 2 + Math.random() * 4) * 60_000;
    this.weather = { kind, until: now + dur };
    this.db.setState('weather', this.weather);
    const info = this.worldInfo();
    for (const p of this.players.values()) p.send({ t: 'world', w: info });
  }

  worldInfo(): WorldInfo {
    return { wt: this.time, weather: this.weather.kind, wLeft: Math.max(0, Math.round((this.weather.until - Date.now()) / 1000)) };
  }

  // ───────────────────────── kết nối ─────────────────────────

  findSpawnPoint(): { x: number; y: number } {
    for (let i = 0; i < 400; i++) {
      const ang = Math.random() * Math.PI * 2;
      const d = 90 + Math.random() * 180;
      const tx = Math.floor(Math.cos(ang) * d);
      const ty = Math.floor(Math.sin(ang) * d);
      if (this.isFreeTile(tx, ty) && this.isFreeTile(tx + 1, ty) && this.isFreeTile(tx, ty + 1)) {
        return { x: tx + 0.5, y: ty + 0.5 };
      }
    }
    return { x: 0.5, y: 20.5 };
  }

  isFreeTile(tx: number, ty: number): boolean {
    const tile = TILES[this.view.tile(tx, ty)];
    if (!tile || tile.solid || tile.water) return false;
    return !this.view.isSolid(tx, ty, 0);
  }

  /** Tạo nhân vật mới cho tài khoản. */
  createCharacter(accountId: number, name: string): number {
    const sp = this.findSpawnPoint();
    const data = newCharacterData(sp.x, sp.y, this.time);
    const now = Date.now();
    return this.db.tx(() => {
      const id = this.db.run(
        'INSERT INTO characters(account_id, name, data, alive, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)',
        accountId,
        name,
        JSON.stringify(data),
        now,
        now,
      ).lastInsertRowid;
      this.ledger.ensure(charWallet(id));
      this.ledger.transfer(SYS.starter, charWallet(id), START_XU, 'starter', String(id));
      return id;
    });
  }

  join(ws: WebSocket, acc: Account): Player | null {
    let row = this.db.get<{ id: number; name: string; data: string }>(
      'SELECT id, name, data FROM characters WHERE account_id = ? AND alive = 1 ORDER BY id DESC LIMIT 1',
      acc.id,
    );
    if (!row) {
      const dead = this.db.get<{ id: number }>('SELECT id FROM characters WHERE account_id = ? LIMIT 1', acc.id);
      if (dead && this.cfg.hardcore) {
        // Hardcore: nhân vật cũ đã chết, client phải tạo nhân vật mới
        ws.send(JSON.stringify({ t: 'dead', cause: 'Nhân vật của bạn đã chết vĩnh viễn.', bed: false, hardcore: true, days: 0 } satisfies S2C));
        (ws as WebSocket & { pendingAccount?: Account }).pendingAccount = acc;
        return null;
      }
      const name = this.uniqueName(acc.username);
      this.createCharacter(acc.id, name);
      row = this.db.get('SELECT id, name, data FROM characters WHERE account_id = ? AND alive = 1 ORDER BY id DESC LIMIT 1', acc.id)!;
    }
    // Đang có kết nối cũ hoặc đang "lơ lửng" sau khi rớt mạng
    const existing = this.byChar.get(row.id);
    if (existing) {
      if (existing.ws && existing.ws !== ws) {
        existing.send({ t: 'kick', reason: 'Tài khoản đăng nhập ở nơi khác.' });
        existing.ws.close();
      }
      existing.ws = ws;
      existing.leaveAt = undefined;
      existing.known.clear();
      existing.chunks.clear();
      existing.chunkCx = NaN;
      existing.inputs = [];
      this.sendInitial(existing);
      return existing;
    }
    const data = JSON.parse(row.data) as CharacterData;
    const p = new Player(this.newId(), row.id, acc.id, row.name, !!acc.is_guest, data);
    p.statusFromSaved(data.status, this.time);
    p.ws = ws;
    p.xu = this.ledger.balance(charWallet(p.charId));
    this.players.set(p.id, p);
    this.byChar.set(p.charId, p);
    if (p.alive) this.grid.update(p);
    this.sendInitial(p);
    if (p.alive) this.systemChat(`${p.name} đã vào game.`, true);
    return p;
  }

  uniqueName(base: string): string {
    let name = base.slice(0, 16);
    let i = 1;
    while (this.db.get('SELECT 1 FROM characters WHERE name = ?', name)) {
      name = `${base.slice(0, 13)}${i++}`;
    }
    return name;
  }

  private sendInitial(p: Player): void {
    p.send({
      t: 'welcome',
      me: { id: p.charId, name: p.name, guest: p.guest, eid: p.id },
      seed: this.seed,
      world: this.worldInfo(),
      hardcore: this.cfg.hardcore,
      serverTime: Date.now(),
    });
    p.invDirty = true;
    this.sendInv(p);
    this.refreshWallet(p);
    p.send({ t: 'skills', s: p.skills });
    p.send({ t: 'quest', q: p.quest });
    p.send({ t: 'disc', l: [...p.discovered] });
    p.send({ t: 'terr', l: this.territories.list() });
    p.send({ t: 'mail', unread: this.mail.unreadCount(p.charId) });
    this.sendStats(p);
    this.updateChunkSubs(p, true);
    if (!p.alive) {
      p.send({ t: 'dead', cause: p.deathCause || 'Bạn đã gục ngã.', bed: !!p.spawn, hardcore: this.cfg.hardcore, days: 0 });
    }
  }

  sendStats(p: Player): void {
    p.send({
      t: 'stats',
      d: {
        days: Math.max(0, (this.time - p.lifeStart) / 1200),
        maxRing: p.stats.maxRing,
        blood: p.stats.bloodStreak,
        rep: p.rep,
        kills: p.stats.kills,
      },
    });
  }

  leave(p: Player): void {
    p.ws = null;
    // Giữ nhân vật trong thế giới 10 giây (chống thoát game giữa trận)
    p.leaveAt = Date.now() + (Date.now() - p.lastCombatAt < 30_000 ? 15_000 : 3_000);
    this.trades.cancelFor(p, `${p.name} đã ngắt kết nối.`);
  }

  /** Xóa nhân vật khỏi thế giới ngay (dùng khi tạo nhân vật mới ở Hardcore). */
  dropPlayer(p: Player): void {
    p.ws = null;
    this.finalizeLeave(p);
  }

  private finalizeLeave(p: Player): void {
    p.open = null;
    try {
      this.db.tx(() => this.savePlayer(p));
      const secs = Math.floor((Date.now() - p.playtimeFlushedAt) / 1000);
      if (secs > 0) this.db.run('UPDATE accounts SET playtime_sec = playtime_sec + ? WHERE id = ?', secs, p.accountId);
    } catch (e) {
      console.error('[leave] lưu thất bại', e);
    }
    this.players.delete(p.id);
    this.byChar.delete(p.charId);
    this.grid.remove(p);
    if (p.alive) this.systemChat(`${p.name} đã rời game.`, true);
  }

  handle(p: Player, msg: C2S): void {
    dispatch(this, p, msg);
  }

  // ───────────────────────── gửi dữ liệu ─────────────────────────

  updateChunkSubs(p: Player, force = false): void {
    const cx = chunkOf(Math.floor(p.x));
    const cy = chunkOf(Math.floor(p.y));
    if (!force && cx === p.chunkCx && cy === p.chunkCy) return;
    p.chunkCx = cx;
    p.chunkCy = cy;
    const R = CHUNK_VIEW_RADIUS;
    for (let dx = -R; dx <= R; dx++) {
      for (let dy = -R; dy <= R; dy++) {
        const key = chunkKey(cx + dx, cy + dy);
        if (p.chunks.has(key)) continue;
        p.chunks.add(key);
        const c = this.chunks.get(cx + dx, cy + dy);
        const rm: [number, number][] = [];
        for (const [i, at] of c.rm) if (at > this.time) rm.push([i, at]);
        const st: [number, StructPublic][] = [];
        for (const [i, s] of c.st) st.push([i, publicStruct(s)]);
        p.send({ t: 'ch', cx: cx + dx, cy: cy + dy, rm, st });
      }
    }
    for (const key of p.chunks) {
      const [kx, ky] = key.split(',').map(Number) as [number, number];
      if (Math.abs(kx - cx) > R + 1 || Math.abs(ky - cy) > R + 1) p.chunks.delete(key);
    }
  }

  /** Báo cho những ai đang xem chunk biết ô (tx, ty) thay đổi. */
  chunkUpdate(tx: number, ty: number): void {
    const key = chunkKey(chunkOf(tx), chunkOf(ty));
    const c = this.chunks.at(tx, ty);
    const i = localIndex(tx, ty);
    const s = c.st.get(i);
    const at = c.rm.get(i);
    const msg: S2C = { t: 'cu', tx, ty, rm: at !== undefined && at > this.time ? at : null, st: s ? publicStruct(s) : null };
    for (const p of this.players.values()) if (p.chunks.has(key)) p.send(msg);
  }

  private sendSnapshot(p: Player): void {
    if (!p.ws) return;
    const near = this.grid.query(p.x, p.y, AOI_RADIUS);
    const n: EntFull[] = [];
    const u: EntUpd[] = [];
    const seen = new Set<number>();
    for (const e of near) {
      if (e === p || e.removed) continue;
      seen.add(e.id);
      const kv = p.known.get(e.id);
      if (kv !== e.ver) {
        n.push(e.full());
        p.known.set(e.id, e.ver);
      } else if (e.changed > p.lastSnapTick) {
        u.push(e.upd());
      }
    }
    const x: number[] = [];
    for (const id of p.known.keys()) {
      if (!seen.has(id)) {
        x.push(id);
        p.known.delete(id);
      }
    }
    p.lastSnapTick = this.tickN;
    p.send({ t: 's', wt: Math.round(this.time * 100) / 100, ack: p.lastSeq, me: p.me(this.time), n, u, x });
  }

  fx(x: number, y: number, fx: Fx): void {
    this.fxQueue.push({ x, y, fx });
  }

  private flushFx(): void {
    if (this.fxQueue.length === 0) return;
    const q = this.fxQueue;
    this.fxQueue = [];
    const r2 = (AOI_RADIUS + 4) ** 2;
    for (const p of this.players.values()) {
      if (!p.ws) continue;
      const l: Fx[] = [];
      for (const f of q) if ((f.x - p.x) ** 2 + (f.y - p.y) ** 2 <= r2) l.push(f.fx);
      if (l.length) p.send({ t: 'fx', l });
    }
  }

  broadcast(msg: S2C): void {
    const s = JSON.stringify(msg);
    for (const p of this.players.values()) if (p.ws && p.ws.readyState === 1) p.ws.send(s);
  }

  broadcastNear(x: number, y: number, r: number, msg: S2C): void {
    const s = JSON.stringify(msg);
    for (const p of this.players.values()) {
      if (p.ws && p.ws.readyState === 1 && (p.x - x) ** 2 + (p.y - y) ** 2 <= r * r) p.ws.send(s);
    }
  }

  systemChat(text: string, quiet = false): void {
    if (quiet && this.players.size > 30) return;
    this.broadcast({ t: 'chat', ch: 'system', from: 'Hệ thống', text, ts: Date.now() });
  }

  note(p: Player, text: string, kind: 'info' | 'good' | 'bad' | 'warn' = 'info'): void {
    p.send({ t: 'note', text, kind });
  }

  sendInv(p: Player): void {
    if (!p.invDirty) return;
    p.invDirty = false;
    p.recalcGear();
    p.send({ t: 'inv', inv: p.inv, eq: p.eq, reserved: [...p.reserved.keys()] });
    if (p.open?.kind === 'safe') p.send({ t: 'cont', c: { id: 'safe', title: 'Kho an toàn', kind: 'safe', slots: p.safe } });
  }

  invChanged(p: Player): void {
    p.invDirty = true;
    p.dirty = true;
    const heldId = p.held?.id;
    if (heldId !== p.lastHeldId) {
      p.lastHeldId = heldId;
      p.ver++;
    }
    this.sendInv(p);
  }

  refreshWallet(p: Player): void {
    p.xu = this.ledger.balance(charWallet(p.charId));
    p.send({ t: 'wallet', xu: p.xu });
  }

  // ───────────────────────── thực thể ─────────────────────────

  addMob(m: Mob): void {
    this.mobs.set(m.id, m);
    m.changed = this.tickN;
    this.grid.update(m);
  }

  removeMob(m: Mob): void {
    m.removed = true;
    this.mobs.delete(m.id);
    this.grid.remove(m);
  }

  /** Thả vật phẩm xuống đất (gộp với vật phẩm cùng loại ở gần). */
  dropItem(stack: ItemStack, x: number, y: number, dropper?: number): void {
    if (stack.n <= 0) return;
    const gi = new GroundItem(this.newId(), stack, x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, Date.now());
    if (dropper !== undefined) {
      gi.noPickupFor = dropper;
      gi.noPickupUntil = Date.now() + 2500;
    }
    gi.changed = this.tickN;
    this.items.set(gi.id, gi);
    this.grid.update(gi);
    this.groundDirty = true;
  }

  removeItemEntity(gi: GroundItem): void {
    gi.removed = true;
    this.items.delete(gi.id);
    this.grid.remove(gi);
    this.groundDirty = true;
  }

  /** Cho vật phẩm vào túi, phần thừa rơi xuống đất. */
  giveOrDrop(p: Player, stack: ItemStack): void {
    const left = addStack(p.inv, stack);
    if (left > 0) {
      this.dropItem({ ...stack, n: left }, p.x, p.y);
      this.note(p, 'Túi đầy — vật phẩm rơi xuống đất.', 'warn');
    }
  }

  spawnBag(p: Player, slots: Slot[]): void {
    const nonEmpty = slots.filter(Boolean);
    if (nonEmpty.length === 0) return;
    const now = Date.now();
    const ownerOnly = ringOf(p.x, p.y) < 3 ? now + BAG_OWNER_ONLY_MS : now;
    const bag = new Bag(this.newId(), p.charId, p.name, slots, p.x, p.y, now + BAG_LIFETIME_MS, ownerOnly);
    bag.changed = this.tickN;
    this.bags.set(bag.id, bag);
    this.grid.update(bag);
    this.groundDirty = true;
  }

  removeBag(b: Bag): void {
    b.removed = true;
    this.bags.delete(b.id);
    this.grid.remove(b);
    this.groundDirty = true;
    for (const p of this.players.values()) {
      if (p.open?.kind === 'bag' && p.open.key === String(b.id)) {
        p.open = null;
        p.send({ t: 'cont', c: null });
      }
    }
  }

  private expireGround(now: number): void {
    for (const gi of this.items.values()) if (gi.despawnAt <= now) this.removeItemEntity(gi);
    for (const b of this.bags.values()) if (b.expiresAt <= now || b.isEmpty()) this.removeBag(b);
  }

  private loadGround(): void {
    const g = this.db.getState<{ items: { s: ItemStack; x: number; y: number; d: number }[]; bags: { o: number; n: string; s: Slot[]; x: number; y: number; e: number; oo: number }[] }>('ground');
    if (!g) return;
    for (const it of g.items) {
      const gi = new GroundItem(this.newId(), it.s, it.x, it.y, Date.now());
      gi.despawnAt = it.d;
      this.items.set(gi.id, gi);
      this.grid.update(gi);
    }
    for (const b of g.bags) {
      const bag = new Bag(this.newId(), b.o, b.n, b.s, b.x, b.y, b.e, b.oo);
      this.bags.set(bag.id, bag);
      this.grid.update(bag);
    }
  }

  // ───────────────────────── lưu trữ ─────────────────────────

  savePlayer(p: Player): void {
    this.db.run('UPDATE characters SET data = ?, updated_at = ? WHERE id = ?', JSON.stringify(p.toData(this.time)), Date.now(), p.charId);
  }

  /** Ghi mọi thứ đang "bẩn". Các hàm dọn dẹp chỉ chạy sau khi commit thành công. */
  private flushDirty(done: (() => void)[]): void {
    for (const p of this.players.values()) {
      if (!p.dirty) continue;
      this.savePlayer(p);
      done.push(() => {
        p.dirty = false;
      });
    }
    this.chunks.flush(this.time, done);
    if (this.groundDirty) {
      this.db.setState('ground', {
        items: [...this.items.values()].map((g) => ({ s: g.stack, x: g.x, y: g.y, d: g.despawnAt })),
        bags: [...this.bags.values()].map((b) => ({ o: b.owner, n: b.ownerName, s: b.slots, x: b.x, y: b.y, e: b.expiresAt, oo: b.ownerOnlyUntil })),
      });
      done.push(() => {
        this.groundDirty = false;
      });
    }
    this.db.setState('time', this.time);
  }

  saveAll(): void {
    const done: (() => void)[] = [];
    try {
      this.db.tx(() => this.flushDirty(done));
      for (const d of done) d();
    } catch (e) {
      console.error('[save] lỗi lưu:', e);
    }
  }

  /**
   * Thao tác kinh tế nguyên tử: chụp trạng thái người chơi liên quan, chạy fn trong
   * transaction cùng với việc ghi toàn bộ trạng thái đang bẩn. Lỗi ⇒ hoàn tác cả CSDL lẫn bộ nhớ.
   */
  atomic<T>(players: Player[], fn: () => T): T {
    const snaps = players.map((p) => p.snapshot());
    const done: (() => void)[] = [];
    try {
      const r = this.db.tx(() => {
        const out = fn();
        for (const p of players) p.dirty = true;
        this.flushDirty(done);
        return out;
      });
      for (const d of done) d();
      for (const p of players) {
        p.invDirty = true;
        this.invChanged(p);
      }
      return r;
    } catch (e) {
      players.forEach((p, i) => p.restore(snaps[i]!));
      for (const p of players) this.sendInv(p);
      throw e;
    }
  }

  /** Khóa chống lặp: trả lại kết quả cũ nếu cùng khóa đã được xử lý. */
  idempotent<T>(p: Player, key: string | undefined, fn: () => T): T {
    if (!key) return fn();
    const k = `${p.charId}:${key.slice(0, 64)}`;
    const prev = this.db.get<{ response: string }>('SELECT response FROM idempotency WHERE key = ?', k);
    if (prev) return JSON.parse(prev.response) as T;
    return this.db.tx(() => {
      const r = fn();
      this.db.run('INSERT OR REPLACE INTO idempotency(key, char_id, response, created_at) VALUES (?, ?, ?, ?)', k, p.charId, JSON.stringify(r ?? null), Date.now());
      return r;
    });
  }

  private unloadChunks(): void {
    const needed = new Set<string>();
    for (const p of this.players.values()) for (const k of p.chunks) needed.add(k);
    for (const m of this.mobs.values()) needed.add(chunkKey(chunkOf(Math.floor(m.x)), chunkOf(Math.floor(m.y))));
    this.chunks.unloadIdle(needed, 60_000);
  }

  // ───────────────────────── tiện ích ─────────────────────────

  playerByName(name: string): Player | undefined {
    const n = name.toLowerCase();
    for (const p of this.players.values()) if (p.name.toLowerCase() === n) return p;
    return undefined;
  }

  charIdByName(name: string): { id: number; name: string } | undefined {
    return this.db.get<{ id: number; name: string }>('SELECT id, name FROM characters WHERE name = ? AND alive = 1', name);
  }

  charName(id: number): string {
    return this.byChar.get(id)?.name ?? this.db.get<{ name: string }>('SELECT name FROM characters WHERE id = ?', id)?.name ?? '???';
  }

  /** Người chơi có đang ở trong khu trung tâm của trạm `outpostId` không. */
  requireAtOutpost(p: Player, outpostId: string): void {
    const { outpost, dist } = nearestOutpost(this.seed, p.x, p.y);
    if (outpost.id !== outpostId || dist > OUTPOST_PLAZA_RADIUS + 5) throw new GameError('Bạn phải ở trong trạm giao thương.');
    if (!p.alive) throw new GameError('Bạn đã gục ngã.');
  }

  /** Điều kiện dùng sàn và hòm thư (chống tài khoản phụ/bot). */
  requireTradeUnlocked(p: Player): void {
    if (p.guest) throw new GameError('Tài khoản khách chưa dùng được tính năng này. Hãy đăng ký (miễn phí) để giữ tiến trình.');
    const row = this.db.get<{ playtime_sec: number }>('SELECT playtime_sec FROM accounts WHERE id = ?', p.accountId);
    const played = (row?.playtime_sec ?? 0) + Math.floor((Date.now() - p.playtimeFlushedAt) / 1000);
    const need = this.cfg.tradeMinPlaytimeMin * 60;
    if (played < need) throw new GameError(`Cần chơi ít nhất ${this.cfg.tradeMinPlaytimeMin} phút trước khi dùng sàn và hòm thư (còn ${Math.ceil((need - played) / 60)} phút).`);
  }

  territoryList(): TerritoryInfo[] {
    return this.territories.list();
  }

  /** Mã duy nhất cho đồ độc nhất. */
  uid(): string {
    return crypto.randomUUID();
  }

  isTileInSafeZone(x: number, y: number): boolean {
    return nearestOutpost(this.seed, x, y).dist <= 24;
  }

  /** Hạt giống tất định cho ô (dùng cho các sự kiện ngẫu nhiên có thể tái lập). */
  tileHash(tx: number, ty: number): number {
    return hashString(`${this.seed}:${tx}:${ty}`);
  }

  ringAt(x: number, y: number): number {
    return Math.floor(Math.hypot(x, y) / RING_SIZE);
  }

  chunkSize(): number {
    return CHUNK;
  }
}
