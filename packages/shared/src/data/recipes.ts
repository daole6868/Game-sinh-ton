import type { StationId } from '../types.ts';

export interface Recipe {
  id: string;
  /** vật phẩm đầu ra (có thể nhiều món, ví dụ trả lại bình rỗng) */
  out: Record<string, number>;
  in: Record<string, number>;
  station?: StationId;
  skill: 'crafting' | 'cooking';
  xp: number;
}

const R = (
  id: string,
  out: Record<string, number>,
  inputs: Record<string, number>,
  station: StationId | undefined,
  xp = 5,
  skill: 'crafting' | 'cooking' = 'crafting',
): Recipe => ({ id, out, in: inputs, station, skill, xp });

export const RECIPES: Recipe[] = [
  // ───── Tay không (T0) ─────
  R('rope', { rope: 1 }, { fiber: 3 }, undefined, 2),
  R('torch', { torch: 1 }, { wood: 1, fiber: 2 }, undefined, 2),
  R('wooden_spear', { wooden_spear: 1 }, { wood: 4, fiber: 2 }, undefined, 4),
  R('stone_axe', { stone_axe: 1 }, { wood: 3, stone: 5, fiber: 2 }, undefined, 5),
  R('stone_pickaxe', { stone_pickaxe: 1 }, { wood: 3, stone: 6, fiber: 2 }, undefined, 5),
  R('stone_spear', { stone_spear: 1 }, { wood: 4, stone: 4, rope: 1 }, undefined, 6),
  R('campfire', { campfire: 1 }, { wood: 6, stone: 4 }, undefined, 5),
  R('torch_stand', { torch_stand: 1 }, { wood: 3, fiber: 3 }, undefined, 3),
  R('workbench', { workbench: 1 }, { wood: 15, stone: 6, rope: 2 }, undefined, 15),
  R('sleeping_bag', { sleeping_bag: 1 }, { hide: 3, fiber: 6 }, undefined, 8),
  R('straw_hat', { straw_hat: 1 }, { reed: 6, fiber: 4 }, undefined, 5),
  R('cloth_mask', { cloth_mask: 1 }, { cloth: 2, herb: 1 }, undefined, 6),
  R('bandage', { bandage: 1 }, { fiber: 5 }, undefined, 3),
  R('farm_plot', { farm_plot: 1 }, { wood: 4, fiber: 4 }, undefined, 4),
  R('fishing_rod', { fishing_rod: 1 }, { wood: 3, rope: 2 }, undefined, 5),

  // ───── Lửa trại (nấu ăn) ─────
  R('cooked_meat', { cooked_meat: 1 }, { raw_meat: 1 }, 'campfire', 3, 'cooking'),
  R('cooked_fish', { cooked_fish: 1 }, { raw_fish: 1 }, 'campfire', 3, 'cooking'),
  R('cooked_mushroom', { cooked_mushroom: 1 }, { mushroom: 1 }, 'campfire', 2, 'cooking'),
  R('boil_water', { waterskin_clean: 1 }, { waterskin_dirty: 1 }, 'campfire', 2, 'cooking'),
  R('jerky', { jerky: 2 }, { cooked_meat: 2, salt: 1 }, 'campfire', 6, 'cooking'),
  R('pumpkin_soup', { pumpkin_soup: 1, waterskin: 1 }, { pumpkin: 1, cooked_meat: 1, waterskin_clean: 1 }, 'campfire', 10, 'cooking'),

  // ───── Bàn chế tạo (T1) ─────
  R('wood_wall', { wood_wall: 1 }, { wood: 6 }, 'workbench', 4),
  R('wood_door', { wood_door: 1 }, { wood: 8, rope: 1 }, 'workbench', 6),
  R('wood_floor', { wood_floor: 1 }, { wood: 2 }, 'workbench', 1),
  R('stone_wall', { stone_wall: 1 }, { stone: 10, wood: 2 }, 'workbench', 6),
  R('chest', { chest: 1 }, { wood: 12, rope: 1 }, 'workbench', 8),
  R('furnace', { furnace: 1 }, { stone: 20, clay: 6 }, 'workbench', 15),
  R('bed', { bed: 1 }, { wood: 12, hide: 4, fiber: 6 }, 'workbench', 12),
  R('totem', { totem: 1 }, { wood: 20, stone: 10, rope: 2 }, 'workbench', 20),
  R('spike_trap', { spike_trap: 1 }, { wood: 6, stone: 3 }, 'workbench', 5),
  R('market_stall', { market_stall: 1 }, { wood: 20, cloth: 6, rope: 4 }, 'workbench', 20),
  R('leather', { leather: 1 }, { hide: 2, salt: 1 }, 'workbench', 4),
  R('cloth', { cloth: 1 }, { fiber: 4 }, 'workbench', 2),
  R('waterskin', { waterskin: 1 }, { hide: 2, rope: 1 }, 'workbench', 5),
  R('bow', { bow: 1 }, { wood: 6, rope: 3 }, 'workbench', 10),
  R('arrow', { arrow: 4 }, { wood: 1, stone: 1, fiber: 1 }, 'workbench', 2),
  R('arrow_bone', { arrow: 5 }, { wood: 1, bone: 1 }, 'workbench', 2),
  R('fur_hat', { fur_hat: 1 }, { fur: 3, rope: 1 }, 'workbench', 8),
  R('fur_coat', { fur_coat: 1 }, { fur: 6, leather: 2, rope: 2 }, 'workbench', 14),
  R('leather_armor', { leather_armor: 1 }, { leather: 5, rope: 2 }, 'workbench', 14),
  R('herbal_medicine', { herbal_medicine: 1, waterskin: 1 }, { herb: 3, waterskin_clean: 1 }, 'workbench', 6),
  R('lamp', { lamp: 1 }, { iron_ingot: 1, cloth: 1, coal: 2 }, 'workbench', 8),
  R('iron_axe', { iron_axe: 1 }, { iron_ingot: 3, wood: 3, leather: 1 }, 'workbench', 18),
  R('iron_pickaxe', { iron_pickaxe: 1 }, { iron_ingot: 3, wood: 3, leather: 1 }, 'workbench', 18),
  R('iron_sword', { iron_sword: 1 }, { iron_ingot: 5, leather: 1, wood: 1 }, 'workbench', 25),
  R('iron_helmet', { iron_helmet: 1 }, { iron_ingot: 4, leather: 1 }, 'workbench', 20),
  R('iron_armor', { iron_armor: 1 }, { iron_ingot: 10, leather: 3 }, 'workbench', 40),
  R('iron_wall', { iron_wall: 1 }, { iron_ingot: 2, stone: 4 }, 'workbench', 10),
  R('iron_door', { iron_door: 1 }, { iron_ingot: 4, parts: 1 }, 'workbench', 15),
  R('mech_bench', { mech_bench: 1 }, { iron_ingot: 6, parts: 4, wood: 10 }, 'workbench', 40),

  // ───── Lò nung ─────
  R('iron_ingot', { iron_ingot: 1 }, { iron_ore: 2, coal: 1 }, 'furnace', 4),

  // ───── Bàn cơ khí (T2) ─────
  R('parts', { parts: 2 }, { scrap: 4, iron_ingot: 1 }, 'mech_bench', 6),
  R('gunpowder', { gunpowder: 2 }, { coal: 2, salt: 1 }, 'mech_bench', 4),
  R('bullet', { bullet: 6 }, { iron_ingot: 1, gunpowder: 1 }, 'mech_bench', 6),
  R('crossbow', { crossbow: 1 }, { wood: 8, iron_ingot: 3, parts: 2, rope: 3 }, 'mech_bench', 40),
  R('pipe_gun', { pipe_gun: 1 }, { iron_ingot: 6, parts: 4, wood: 4 }, 'mech_bench', 60),
  R('gas_mask', { gas_mask: 1 }, { leather: 2, parts: 2, cloth: 3 }, 'mech_bench', 40),
  R('filter', { filter: 1 }, { cloth: 2, coal: 2 }, 'mech_bench', 6),
  R('serum', { serum: 1, waterskin: 1 }, { mist_crystal: 1, herb: 3, waterskin_clean: 1 }, 'mech_bench', 20),
  R('crystal_forge', { crystal_forge: 1 }, { iron_ingot: 10, mist_crystal: 10, parts: 8, electronics: 2 }, 'mech_bench', 120),

  // ───── Lò Tinh thể (T4) ─────
  R('mist_blade', { mist_blade: 1 }, { iron_ingot: 6, mist_crystal: 15, electronics: 2, leather: 2 }, 'crystal_forge', 150),
  R('mist_mask', { mist_mask: 1 }, { gas_mask: 1, mist_crystal: 10, electronics: 1 }, 'crystal_forge', 150),
  R('mist_armor', { mist_armor: 1 }, { iron_armor: 1, mist_crystal: 20, electronics: 2 }, 'crystal_forge', 200),
];

export const RECIPES_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

/** Công thức đầu tiên làm ra một vật phẩm (dùng để chặn vòng lặp kiếm lời). */
export const RECIPES_BY_OUTPUT: Record<string, Recipe[]> = {};
for (const r of RECIPES) {
  for (const id of Object.keys(r.out)) (RECIPES_BY_OUTPUT[id] ??= []).push(r);
}
