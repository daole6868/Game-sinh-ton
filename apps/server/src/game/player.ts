import {
  type EntFull,
  type EntUpd,
  type Equipment,
  emptySlots,
  INVENTORY_SIZE,
  ITEMS,
  inventoryWeight,
  type MeSnap,
  type MoveInput,
  newSkills,
  type QuestState,
  SAFE_STORAGE_SIZE,
  type S2C,
  type SkillId,
  type SkillState,
  type Slot,
  type StatusId,
  upgradeMul,
} from '@suongdo/shared';
import type { WebSocket } from 'ws';
import { Entity } from './entities.ts';

export interface PlayerStats {
  kills: number;
  maxRing: number;
  bloodStreak: number;
  bloodBest: number;
  deaths: number;
  questKills: number;
}

/** Dữ liệu nhân vật lưu trong CSDL (cột characters.data). */
export interface CharacterData {
  x: number;
  y: number;
  hp: number;
  hunger: number;
  thirst: number;
  stamina: number;
  bodyTemp: number;
  mist: number;
  status: Partial<Record<StatusId, number>>;
  inv: Slot[];
  eq: Equipment;
  sel: number;
  skills: Record<SkillId, SkillState>;
  quest: QuestState;
  rep: number;
  stats: PlayerStats;
  spawn: { tx: number; ty: number } | null;
  discovered: string[];
  pvp: boolean;
  alive: boolean;
  deathCause?: string;
  lifeStart: number;
  capDay: string;
  soldToday: number;
  safeUnlocked: boolean;
  safe: Slot[];
}

export function newCharacterData(x: number, y: number, now: number): CharacterData {
  return {
    x,
    y,
    hp: 100,
    hunger: 85,
    thirst: 85,
    stamina: 100,
    bodyTemp: 37,
    mist: 0,
    status: {},
    inv: emptySlots(INVENTORY_SIZE),
    eq: { head: null, body: null, mask: null },
    sel: 0,
    skills: newSkills(),
    quest: { idx: 0 },
    rep: 0,
    stats: { kills: 0, maxRing: 0, bloodStreak: 0, bloodBest: 0, deaths: 0, questKills: 0 },
    spawn: null,
    discovered: [],
    pvp: false,
    alive: true,
    lifeStart: now,
    capDay: '',
    soldToday: 0,
    safeUnlocked: false,
    safe: emptySlots(SAFE_STORAGE_SIZE),
  };
}

export interface OpenContainer {
  kind: 'chest' | 'bag' | 'safe';
  /** chest: "tx,ty"; bag: id thực thể; safe: id trạm */
  key: string;
  x: number;
  y: number;
}

export class Player extends Entity {
  readonly kind = 'p' as const;
  ws: WebSocket | null = null;
  a = 0;
  dashT = 0;
  dashCd = 0;
  dashX = 0;
  dashY = 0;
  hp: number;
  maxHp = 100;
  hunger: number;
  thirst: number;
  stamina: number;
  bodyTemp: number;
  mist: number;
  ambient = 22;
  /** trạng thái → hết hạn (giây thế giới) */
  status = new Map<StatusId, number>();
  inv: Slot[];
  eq: Equipment;
  sel: number;
  skills: Record<SkillId, SkillState>;
  quest: QuestState;
  rep: number;
  stats: PlayerStats;
  spawn: { tx: number; ty: number } | null;
  discovered: Set<string>;
  pvp: boolean;
  alive: boolean;
  deathCause = '';
  lifeStart: number;
  capDay: string;
  soldToday: number;
  safeUnlocked: boolean;
  safe: Slot[];
  xu = 0;

  // ── trạng thái phiên (không lưu) ──
  inputs: MoveInput[] = [];
  lastSeq = 0;
  moveBudget = 0;
  running = false;
  nextActionAt = 0;
  nextUseAt = 0;
  nextPlaceAt = 0;
  lastCombatAt = 0;
  lastStaminaUse = 0;
  known = new Map<number, number>();
  lastSnapTick = 0;
  chunks = new Set<string>();
  chunkCx = NaN;
  chunkCy = NaN;
  open: OpenContainer | null = null;
  tradeId: number | null = null;
  reserved = new Map<number, number>();
  dirty = true;
  invDirty = true;
  chatAt = 0;
  msgCount = 0;
  msgWindow = 0;
  joinedAt = Date.now();
  playtimeFlushedAt = Date.now();
  nightAlive = false;
  bloodAlive = false;
  ring = 0;
  /** chỉ số tổng hợp từ trang bị, tính lại khi đổi đồ */
  armor = 0;
  warmth = 0;
  cooling = 0;
  mistProt = 0;
  speedMul = 1;
  weight = 0;
  heldLightUntil = 0;
  /** thời điểm (ms) xóa nhân vật khỏi thế giới sau khi rớt mạng */
  leaveAt?: number;
  lastHeldId?: string;
  /** độ ấm từ lửa gần nhất (tính lại định kỳ) */
  fireWarmth = 0;
  onFloor = false;
  invites = new Map<number, number>();

  constructor(
    id: number,
    readonly charId: number,
    readonly accountId: number,
    public name: string,
    public guest: boolean,
    d: CharacterData,
  ) {
    super(id);
    this.x = d.x;
    this.y = d.y;
    this.hp = d.hp;
    this.hunger = d.hunger;
    this.thirst = d.thirst;
    this.stamina = d.stamina;
    this.bodyTemp = d.bodyTemp;
    this.mist = d.mist;
    this.inv = d.inv.length === INVENTORY_SIZE ? d.inv : [...d.inv, ...emptySlots(INVENTORY_SIZE)].slice(0, INVENTORY_SIZE);
    this.eq = d.eq;
    this.sel = d.sel;
    this.skills = { ...newSkills(), ...d.skills };
    this.quest = d.quest;
    this.rep = d.rep;
    this.stats = Object.assign({ kills: 0, maxRing: 0, bloodStreak: 0, bloodBest: 0, deaths: 0, questKills: 0 }, d.stats);
    this.spawn = d.spawn;
    this.discovered = new Set(d.discovered);
    this.pvp = d.pvp;
    this.alive = d.alive;
    this.deathCause = d.deathCause ?? '';
    this.lifeStart = d.lifeStart;
    this.capDay = d.capDay;
    this.soldToday = d.soldToday;
    this.safeUnlocked = d.safeUnlocked;
    this.safe = d.safe?.length === SAFE_STORAGE_SIZE ? d.safe : emptySlots(SAFE_STORAGE_SIZE);
    this.statusFromSaved(d.status, 0);
    this.recalcGear();
  }

  statusFromSaved(s: Partial<Record<StatusId, number>>, now: number): void {
    this.status.clear();
    for (const [k, v] of Object.entries(s)) if (v && v > 0) this.status.set(k as StatusId, now + v);
  }

  toData(now: number): CharacterData {
    const status: Partial<Record<StatusId, number>> = {};
    for (const [k, until] of this.status) if (until > now) status[k] = Math.round(until - now);
    return {
      x: this.x,
      y: this.y,
      hp: this.hp,
      hunger: this.hunger,
      thirst: this.thirst,
      stamina: this.stamina,
      bodyTemp: this.bodyTemp,
      mist: this.mist,
      status,
      inv: this.inv,
      eq: this.eq,
      sel: this.sel,
      skills: this.skills,
      quest: this.quest,
      rep: this.rep,
      stats: this.stats,
      spawn: this.spawn,
      discovered: [...this.discovered],
      pvp: this.pvp,
      alive: this.alive,
      deathCause: this.deathCause,
      lifeStart: this.lifeStart,
      capDay: this.capDay,
      soldToday: this.soldToday,
      safeUnlocked: this.safeUnlocked,
      safe: this.safe,
    };
  }

  /** Sao chụp phần dữ liệu kinh tế (để hoàn tác nếu giao dịch thất bại). */
  snapshot(): string {
    return JSON.stringify({ inv: this.inv, eq: this.eq, safe: this.safe, soldToday: this.soldToday, capDay: this.capDay, rep: this.rep, quest: this.quest });
  }

  restore(snap: string): void {
    const s = JSON.parse(snap) as Pick<CharacterData, 'inv' | 'eq' | 'safe' | 'soldToday' | 'capDay' | 'rep' | 'quest'>;
    this.inv = s.inv;
    this.eq = s.eq;
    this.safe = s.safe;
    this.soldToday = s.soldToday;
    this.capDay = s.capDay;
    this.rep = s.rep;
    this.quest = s.quest;
    this.recalcGear();
    this.invDirty = true;
  }

  send(msg: S2C): void {
    const ws = this.ws;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  get held(): Slot {
    return this.inv[this.sel] ?? null;
  }

  has(s: StatusId, now: number): boolean {
    const u = this.status.get(s);
    return u !== undefined && u > now;
  }

  recalcGear(): void {
    let armor = 0;
    let warmth = 0;
    let cooling = 0;
    let mist = 0;
    for (const s of Object.values(this.eq)) {
      if (!s) continue;
      const a = ITEMS[s.id]?.armor;
      if (!a) continue;
      const mul = (s.q ?? 1) * upgradeMul(s.lv);
      armor += a.armor * mul;
      warmth += a.warmth ?? 0;
      cooling += a.cooling ?? 0;
      mist += a.mist ?? 0;
    }
    this.armor = armor;
    this.warmth = warmth;
    this.cooling = cooling;
    this.mistProt = Math.min(0.95, mist);
    this.weight = inventoryWeight(this.inv);
  }

  full(): EntFull {
    return {
      i: this.id,
      k: 'p',
      x: this.x,
      y: this.y,
      a: this.a,
      n: this.name,
      h: Math.round((this.hp / this.maxHp) * 100),
      it: this.held?.id,
      pv: this.pvp,
      c: this.charId,
    };
  }

  upd(): EntUpd {
    return [
      this.id,
      Math.round(this.x * 100),
      Math.round(this.y * 100),
      Math.round(this.a * 100),
      Math.max(0, Math.round((this.hp / this.maxHp) * 100)),
      this.dashT > 0 ? 1 : 0,
    ];
  }

  me(now: number): MeSnap {
    const fx: StatusId[] = [];
    for (const [k, u] of this.status) if (u > now) fx.push(k);
    return {
      x: this.x,
      y: this.y,
      dT: this.dashT,
      dC: this.dashCd,
      hp: Math.round(this.hp * 10) / 10,
      mhp: this.maxHp,
      hu: Math.round(this.hunger * 10) / 10,
      th: Math.round(this.thirst * 10) / 10,
      st: Math.round(this.stamina),
      bt: Math.round(this.bodyTemp * 10) / 10,
      mi: Math.round(this.mist * 10) / 10,
      fx,
      sm: this.speedMul,
      cr: this.stamina > 5 && this.hunger > 0,
      cd: this.stamina >= 22,
      sel: this.sel,
      pvp: this.pvp,
      w: Math.round(this.weight * 10) / 10,
      alive: this.alive,
      amb: Math.round(this.ambient),
    };
  }
}
