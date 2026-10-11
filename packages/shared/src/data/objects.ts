import type { Drop } from '../types.ts';

export type GatherTool = 'axe' | 'pickaxe' | 'any';

export interface ObjectDef {
  /** số thứ tự lưu trong Uint8Array (bắt đầu từ 1, 0 = trống) */
  num: number;
  id: string;
  name: string;
  hp: number;
  tool: GatherTool;
  /** bậc công cụ tối thiểu */
  minTier: number;
  solid: boolean;
  drops: Drop[];
  /** thời gian mọc lại (giây thế giới) */
  respawn: number;
  xp: number;
  /** gây sát thương khi đánh bằng tay không */
  thorns?: number;
}

const DAY = 1200;

export const OBJECT_LIST: ObjectDef[] = [
  { num: 1, id: 'tree', name: 'Cây sồi', hp: 30, tool: 'axe', minTier: 0, solid: true, drops: [{ item: 'wood', min: 3, max: 5 }], respawn: 3 * DAY, xp: 4 },
  { num: 2, id: 'pine', name: 'Cây thông', hp: 36, tool: 'axe', minTier: 0, solid: true, drops: [{ item: 'wood', min: 4, max: 6 }], respawn: 3 * DAY, xp: 5 },
  { num: 3, id: 'dead_tree', name: 'Cây khô', hp: 15, tool: 'axe', minTier: 0, solid: true, drops: [{ item: 'wood', min: 2, max: 3 }], respawn: 3 * DAY, xp: 2 },
  { num: 4, id: 'blood_tree', name: 'Cây Huyết', hp: 70, tool: 'axe', minTier: 1, solid: true, drops: [{ item: 'wood', min: 5, max: 8 }, { item: 'mist_crystal', min: 1, max: 1, chance: 0.12 }], respawn: 5 * DAY, xp: 14 },
  { num: 5, id: 'bush', name: 'Bụi quả mọng', hp: 1, tool: 'any', minTier: 0, solid: false, drops: [{ item: 'berries', min: 2, max: 4 }, { item: 'carrot_seed', min: 1, max: 1, chance: 0.1 }, { item: 'pumpkin_seed', min: 1, max: 1, chance: 0.05 }], respawn: 2 * DAY, xp: 1 },
  { num: 6, id: 'grass_tuft', name: 'Bụi cỏ', hp: 1, tool: 'any', minTier: 0, solid: false, drops: [{ item: 'fiber', min: 1, max: 3 }], respawn: 1 * DAY, xp: 1 },
  { num: 7, id: 'twig', name: 'Cành cây khô', hp: 1, tool: 'any', minTier: 0, solid: false, drops: [{ item: 'wood', min: 1, max: 2 }], respawn: 1 * DAY, xp: 1 },
  { num: 8, id: 'pebble', name: 'Đá cuội', hp: 1, tool: 'any', minTier: 0, solid: false, drops: [{ item: 'stone', min: 1, max: 2 }], respawn: 1 * DAY, xp: 1 },
  { num: 9, id: 'rock', name: 'Tảng đá', hp: 40, tool: 'pickaxe', minTier: 0, solid: true, drops: [{ item: 'stone', min: 3, max: 5 }], respawn: 5 * DAY, xp: 5 },
  { num: 10, id: 'iron_rock', name: 'Mỏ sắt', hp: 60, tool: 'pickaxe', minTier: 0, solid: true, drops: [{ item: 'iron_ore', min: 2, max: 3 }, { item: 'stone', min: 1, max: 2 }], respawn: 5 * DAY, xp: 9 },
  { num: 11, id: 'coal_rock', name: 'Mỏ than', hp: 50, tool: 'pickaxe', minTier: 0, solid: true, drops: [{ item: 'coal', min: 2, max: 3 }, { item: 'stone', min: 1, max: 1 }], respawn: 5 * DAY, xp: 7 },
  { num: 12, id: 'crystal_node', name: 'Mỏ Tinh thể Sương', hp: 120, tool: 'pickaxe', minTier: 1, solid: true, drops: [{ item: 'mist_crystal', min: 1, max: 3 }], respawn: 10 * DAY, xp: 30 },
  { num: 13, id: 'cactus', name: 'Xương rồng', hp: 9, tool: 'any', minTier: 0, solid: true, drops: [{ item: 'cactus_flesh', min: 1, max: 2 }], respawn: 3 * DAY, xp: 2, thorns: 3 },
  { num: 14, id: 'reeds', name: 'Lau sậy', hp: 1, tool: 'any', minTier: 0, solid: false, drops: [{ item: 'reed', min: 1, max: 3 }], respawn: 2 * DAY, xp: 1 },
  { num: 15, id: 'herb_plant', name: 'Cây thảo dược', hp: 1, tool: 'any', minTier: 0, solid: false, drops: [{ item: 'herb', min: 1, max: 2 }], respawn: 2.5 * DAY, xp: 2 },
  { num: 16, id: 'mushroom_patch', name: 'Đám nấm', hp: 1, tool: 'any', minTier: 0, solid: false, drops: [{ item: 'mushroom', min: 1, max: 2 }], respawn: 2 * DAY, xp: 1 },
  { num: 17, id: 'clay_pit', name: 'Hố đất sét', hp: 12, tool: 'any', minTier: 0, solid: false, drops: [{ item: 'clay', min: 2, max: 3 }], respawn: 3 * DAY, xp: 2 },
  { num: 18, id: 'scrap_pile', name: 'Đống phế liệu', hp: 18, tool: 'any', minTier: 0, solid: false, drops: [{ item: 'scrap', min: 2, max: 4 }, { item: 'cloth', min: 1, max: 1, chance: 0.3 }], respawn: 4 * DAY, xp: 4 },
  { num: 19, id: 'wreck', name: 'Xác xe', hp: 80, tool: 'pickaxe', minTier: 0, solid: true, drops: [{ item: 'scrap', min: 4, max: 7 }, { item: 'parts', min: 1, max: 2, chance: 0.4 }, { item: 'electronics', min: 1, max: 1, chance: 0.15 }], respawn: 8 * DAY, xp: 12 },
  {
    num: 20, id: 'crate', name: 'Thùng tiếp tế cũ', hp: 15, tool: 'any', minTier: 0, solid: true,
    drops: [
      { item: 'canned_food', min: 1, max: 2, chance: 0.35 },
      { item: 'bandage', min: 1, max: 3, chance: 0.35 },
      { item: 'cloth', min: 1, max: 3, chance: 0.35 },
      { item: 'waterskin_clean', min: 1, max: 1, chance: 0.15 },
      { item: 'bullet', min: 3, max: 6, chance: 0.1 },
      { item: 'electronics', min: 1, max: 1, chance: 0.1 },
      { item: 'salt', min: 2, max: 5, chance: 0.2 },
      { item: 'serum', min: 1, max: 1, chance: 0.03 },
    ],
    respawn: 6 * DAY, xp: 6,
  },
  { num: 21, id: 'bones', name: 'Bộ xương', hp: 5, tool: 'any', minTier: 0, solid: false, drops: [{ item: 'bone', min: 2, max: 4 }], respawn: 4 * DAY, xp: 2 },
];

export const OBJECTS: Record<string, ObjectDef> = Object.fromEntries(OBJECT_LIST.map((o) => [o.id, o]));
export const OBJECT_BY_NUM: (ObjectDef | undefined)[] = [];
for (const o of OBJECT_LIST) OBJECT_BY_NUM[o.num] = o;
