import type { Drop } from '../types.ts';

export type MobBehavior = 'passive' | 'neutral' | 'hostile';

export interface MobDef {
  id: string;
  name: string;
  hp: number;
  dmg: number;
  speed: number;
  radius: number;
  behavior: MobBehavior;
  /** tầm phát hiện (ô) */
  sight: number;
  attackRange: number;
  attackCd: number;
  drops: Drop[];
  xp: number;
  /** cộng Nhiễm Sương khi cắn trúng */
  mist?: number;
  /** xác suất gây ngộ độc khi cắn */
  poison?: number;
  /** xác suất gây chảy máu khi cắn */
  bleed?: number;
  /** tự nổ khi tới gần */
  explode?: { radius: number; dmg: number; mist: number };
  boss?: boolean;
  /** đòn đập đất gây sát thương diện rộng */
  slam?: { radius: number; dmg: number; cd: number };
  /** id ô nền nơi quái xuất hiện */
  tiles: string[];
  minRing: number;
  /** chỉ xuất hiện ban đêm */
  night?: boolean;
  /** xuất hiện nhiều hơn ban đêm */
  nocturnal?: boolean;
  weight: number;
  pack?: [number, number];
  /** điểm sức mạnh khi tính đợt quái Đêm Sương Đỏ */
  waveCost?: number;
}

export const MOB_LIST: MobDef[] = [
  { id: 'rabbit', name: 'Thỏ', hp: 8, dmg: 0, speed: 3.6, radius: 0.25, behavior: 'passive', sight: 6, attackRange: 0, attackCd: 1, drops: [{ item: 'raw_meat', min: 1, max: 1 }, { item: 'hide', min: 1, max: 1, chance: 0.4 }], xp: 3, tiles: ['grass', 'forest', 'snow'], minRing: 0, weight: 10, pack: [1, 2] },
  { id: 'deer', name: 'Nai', hp: 30, dmg: 0, speed: 4.8, radius: 0.35, behavior: 'passive', sight: 9, attackRange: 0, attackCd: 1, drops: [{ item: 'raw_meat', min: 2, max: 3 }, { item: 'hide', min: 1, max: 2 }, { item: 'bone', min: 1, max: 1, chance: 0.5 }], xp: 8, tiles: ['forest', 'grass'], minRing: 0, weight: 6, pack: [1, 3] },
  { id: 'boar', name: 'Lợn rừng', hp: 45, dmg: 8, speed: 3.6, radius: 0.35, behavior: 'neutral', sight: 6, attackRange: 0.9, attackCd: 1.1, drops: [{ item: 'raw_meat', min: 2, max: 4 }, { item: 'hide', min: 1, max: 1 }], xp: 12, tiles: ['forest', 'swamp', 'grass'], minRing: 0, weight: 4 },
  { id: 'crab', name: 'Cua đột biến', hp: 30, dmg: 6, speed: 2.6, radius: 0.3, behavior: 'neutral', sight: 5, attackRange: 0.8, attackCd: 1.2, drops: [{ item: 'raw_meat', min: 1, max: 1 }, { item: 'bone', min: 1, max: 2, chance: 0.6 }], xp: 8, tiles: ['sand', 'shallow'], minRing: 0, weight: 5 },
  { id: 'wolf', name: 'Sói', hp: 40, dmg: 7, speed: 4.7, radius: 0.32, behavior: 'hostile', sight: 9, attackRange: 0.85, attackCd: 1.15, bleed: 0.15, drops: [{ item: 'raw_meat', min: 1, max: 2 }, { item: 'fur', min: 1, max: 1, chance: 0.6 }, { item: 'bone', min: 1, max: 1, chance: 0.4 }], xp: 15, tiles: ['forest', 'snow', 'grass'], minRing: 0, nocturnal: true, weight: 4, pack: [2, 3], waveCost: 8 },
  { id: 'bear', name: 'Gấu', hp: 160, dmg: 18, speed: 3.9, radius: 0.45, behavior: 'hostile', sight: 8, attackRange: 1.1, attackCd: 1.4, bleed: 0.25, drops: [{ item: 'raw_meat', min: 4, max: 6 }, { item: 'fur', min: 2, max: 3 }, { item: 'bone', min: 1, max: 2 }], xp: 45, tiles: ['snow', 'forest', 'rock'], minRing: 1, weight: 2 },
  { id: 'scorpion', name: 'Bọ cạp', hp: 25, dmg: 5, speed: 3.3, radius: 0.28, behavior: 'hostile', sight: 6, attackRange: 0.8, attackCd: 1.0, poison: 0.35, drops: [{ item: 'raw_meat', min: 1, max: 1, chance: 0.5 }], xp: 10, tiles: ['desert'], minRing: 0, weight: 6 },
  { id: 'snake', name: 'Rắn', hp: 18, dmg: 4, speed: 3.0, radius: 0.25, behavior: 'hostile', sight: 5, attackRange: 0.8, attackCd: 1.1, poison: 0.4, drops: [{ item: 'raw_meat', min: 1, max: 1 }, { item: 'hide', min: 1, max: 1, chance: 0.3 }], xp: 8, tiles: ['swamp'], minRing: 0, weight: 6 },
  { id: 'infected', name: 'Kẻ Nhiễm', hp: 50, dmg: 9, speed: 2.5, radius: 0.32, behavior: 'hostile', sight: 9, attackRange: 0.85, attackCd: 1.4, mist: 2, bleed: 0.1, drops: [{ item: 'cloth', min: 1, max: 2, chance: 0.5 }, { item: 'scrap', min: 1, max: 2, chance: 0.4 }, { item: 'canned_food', min: 1, max: 1, chance: 0.05 }, { item: 'bandage', min: 1, max: 1, chance: 0.08 }], xp: 18, tiles: ['grass', 'forest', 'ruins', 'desert', 'swamp', 'snow', 'rock', 'sand', 'mist'], minRing: 0, night: true, weight: 6, waveCost: 10 },
  { id: 'ruin_infected', name: 'Kẻ Nhiễm', hp: 50, dmg: 9, speed: 2.5, radius: 0.32, behavior: 'hostile', sight: 9, attackRange: 0.85, attackCd: 1.4, mist: 2, bleed: 0.1, drops: [{ item: 'cloth', min: 1, max: 2, chance: 0.5 }, { item: 'scrap', min: 1, max: 2, chance: 0.4 }, { item: 'canned_food', min: 1, max: 1, chance: 0.05 }, { item: 'bandage', min: 1, max: 1, chance: 0.08 }], xp: 18, tiles: ['ruins'], minRing: 0, weight: 8 },
  { id: 'runner', name: 'Kẻ Chạy Sương', hp: 45, dmg: 10, speed: 5.3, radius: 0.3, behavior: 'hostile', sight: 12, attackRange: 0.85, attackCd: 0.9, mist: 3, drops: [{ item: 'cloth', min: 1, max: 1, chance: 0.4 }, { item: 'scrap', min: 1, max: 2, chance: 0.4 }, { item: 'mist_crystal', min: 1, max: 1, chance: 0.05 }], xp: 25, tiles: ['grass', 'forest', 'ruins', 'desert', 'swamp', 'snow', 'rock', 'mist'], minRing: 1, night: true, weight: 4, waveCost: 15 },
  { id: 'bloater', name: 'Kẻ Phình', hp: 60, dmg: 0, speed: 2.0, radius: 0.4, behavior: 'hostile', sight: 8, attackRange: 1.0, attackCd: 1, explode: { radius: 2.6, dmg: 26, mist: 10 }, drops: [{ item: 'mist_crystal', min: 1, max: 1, chance: 0.12 }], xp: 22, tiles: ['ruins', 'swamp', 'mist', 'grass', 'forest'], minRing: 2, weight: 3, waveCost: 20 },
  { id: 'mist_spider', name: 'Nhện Sương', hp: 70, dmg: 12, speed: 4.1, radius: 0.38, behavior: 'hostile', sight: 10, attackRange: 0.95, attackCd: 1.0, mist: 5, poison: 0.2, drops: [{ item: 'mist_crystal', min: 1, max: 2, chance: 0.5 }, { item: 'fiber', min: 2, max: 4 }], xp: 35, tiles: ['mist'], minRing: 3, weight: 8, pack: [1, 3] },
  { id: 'frost_bear', name: 'Gấu Sương', hp: 1200, dmg: 30, speed: 3.7, radius: 0.7, behavior: 'hostile', sight: 12, attackRange: 1.4, attackCd: 1.6, boss: true, slam: { radius: 3.2, dmg: 35, cd: 7 }, mist: 6, drops: [{ item: 'mist_crystal', min: 8, max: 14 }, { item: 'fur', min: 6, max: 10 }, { item: 'raw_meat', min: 6, max: 9 }], xp: 400, tiles: ['snow'], minRing: 2, weight: 0.25 },
  { id: 'blood_herald', name: 'Sứ Giả Sương Đỏ', hp: 2500, dmg: 38, speed: 3.4, radius: 0.7, behavior: 'hostile', sight: 16, attackRange: 1.4, attackCd: 1.5, boss: true, slam: { radius: 3.6, dmg: 40, cd: 6 }, mist: 10, drops: [{ item: 'mist_crystal', min: 15, max: 25 }, { item: 'blood_chest', min: 2, max: 3 }, { item: 'electronics', min: 2, max: 4 }], xp: 900, tiles: [], minRing: 3, weight: 0, waveCost: 300 },
];

export const MOBS: Record<string, MobDef> = Object.fromEntries(MOB_LIST.map((m) => [m.id, m]));
