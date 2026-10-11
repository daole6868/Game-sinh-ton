import type { EquipSlot, StatusId } from '../types.ts';

export type ItemCategory =
  | 'resource'
  | 'material'
  | 'food'
  | 'drink'
  | 'medicine'
  | 'tool'
  | 'weapon'
  | 'ammo'
  | 'armor'
  | 'placeable'
  | 'seed'
  | 'special';

export type ToolKind = 'axe' | 'pickaxe' | 'rod';

export interface ToolSpec {
  kind: ToolKind;
  /** sát thương lên tài nguyên mỗi lần đánh */
  power: number;
  tier: number;
}

export interface WeaponSpec {
  dmg: number;
  /** tầm đánh cận chiến (ô) */
  range: number;
  /** thời gian hồi giữa hai đòn (giây) */
  cd: number;
  /** góc quét (radian) */
  arc?: number;
  stamina?: number;
  ranged?: { ammo: string; speed: number; range: number; loud?: boolean };
}

export interface ArmorSpec {
  slot: EquipSlot;
  armor: number;
  warmth?: number;
  cooling?: number;
  /** giảm hấp thụ Sương (0..1) */
  mist?: number;
}

export interface FoodSpec {
  hunger?: number;
  thirst?: number;
  hp?: number;
  /** thay đổi Nhiễm Sương (âm = giảm) */
  mist?: number;
  /** xác suất ngộ độc */
  poison?: number;
  buff?: { id: StatusId; secs: number };
  /** thời gian (giây thế giới) để hỏng hoàn toàn */
  spoil?: number;
  /** vật phẩm trả lại sau khi dùng (ví dụ bình rỗng) */
  returns?: string;
  cure?: StatusId[];
}

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  cat: ItemCategory;
  stack: number;
  weight: number;
  /** giá gốc P0 (Xu) */
  price: number;
  /** tồn kho mục tiêu của hệ thống */
  target?: number;
  /** độ nhạy giá */
  k?: number;
  tier?: number;
  durability?: number;
  tool?: ToolSpec;
  weapon?: WeaponSpec;
  armor?: ArmorSpec;
  food?: FoodSpec;
  /** id công trình được đặt ra từ vật phẩm này */
  place?: string;
  /** id cây trồng */
  seed?: string;
  /** bán kính chiếu sáng khi cầm trên tay */
  light?: number;
  /** không giao dịch được */
  bound?: boolean;
  /** dùng được (mở rương, lõi lọc...) */
  usable?: boolean;
}

const DAY = 1200;

const I = (d: Omit<ItemDef, 'desc'> & { desc?: string }): ItemDef => ({ desc: '', ...d });

export const ITEM_LIST: ItemDef[] = [
  // ───── Tài nguyên thô ─────
  I({ id: 'wood', name: 'Gỗ', cat: 'resource', stack: 100, weight: 0.5, price: 10, target: 10000, k: 0.7, desc: 'Chặt từ cây. Dùng để chế tạo và xây dựng.' }),
  I({ id: 'stone', name: 'Đá', cat: 'resource', stack: 100, weight: 0.6, price: 8, target: 10000, k: 0.7, desc: 'Đập từ tảng đá hoặc nhặt đá cuội.' }),
  I({ id: 'fiber', name: 'Cỏ sợi', cat: 'resource', stack: 100, weight: 0.1, price: 6, target: 8000, k: 0.7, desc: 'Nhổ từ bụi cỏ. Bện thành dây thừng.' }),
  I({ id: 'reed', name: 'Lau sậy', cat: 'resource', stack: 100, weight: 0.2, price: 6, target: 4000, k: 0.7, desc: 'Mọc ở đầm lầy và bờ nước.' }),
  I({ id: 'clay', name: 'Đất sét', cat: 'resource', stack: 100, weight: 0.8, price: 10, target: 3000, k: 0.7, desc: 'Đào ở đầm lầy. Dùng xây lò nung.' }),
  I({ id: 'hide', name: 'Da sống', cat: 'resource', stack: 50, weight: 0.8, price: 25, target: 2000, k: 0.7, desc: 'Lột từ thú. Thuộc thành da thuộc.' }),
  I({ id: 'fur', name: 'Lông thú', cat: 'resource', stack: 50, weight: 0.6, price: 40, target: 1000, k: 0.6, desc: 'Giữ ấm rất tốt.' }),
  I({ id: 'bone', name: 'Xương', cat: 'resource', stack: 100, weight: 0.4, price: 12, target: 3000, k: 0.7, desc: 'Làm mũi tên, thuốc súng...' }),
  I({ id: 'iron_ore', name: 'Quặng sắt', cat: 'resource', stack: 100, weight: 1, price: 30, target: 3000, k: 0.7, tier: 1, desc: 'Nung trong lò để lấy thỏi sắt.' }),
  I({ id: 'coal', name: 'Than', cat: 'resource', stack: 100, weight: 0.6, price: 20, target: 3000, k: 0.7, desc: 'Nhiên liệu cho lò nung và đèn.' }),
  I({ id: 'scrap', name: 'Phế liệu', cat: 'resource', stack: 100, weight: 1, price: 20, target: 4000, k: 0.7, desc: 'Nhặt ở phế tích đô thị.' }),
  I({ id: 'electronics', name: 'Bo mạch', cat: 'resource', stack: 50, weight: 0.3, price: 150, target: 300, k: 0.5, tier: 2, desc: 'Linh kiện điện tử hiếm từ thời trước Đại Biến.' }),
  I({ id: 'mist_crystal', name: 'Tinh thể Sương', cat: 'resource', stack: 100, weight: 0.3, price: 220, target: 300, k: 0.5, tier: 3, desc: 'Kết tinh từ màn sương đỏ. Hàng xa xỉ của vùng sâu.' }),
  I({ id: 'herb', name: 'Thảo dược', cat: 'resource', stack: 50, weight: 0.1, price: 12, target: 2000, k: 0.7, food: { hp: 2 }, desc: 'Làm thuốc và khẩu trang.' }),
  I({ id: 'salt', name: 'Muối', cat: 'material', stack: 100, weight: 0.2, price: 8, target: 5000, k: 0.6, desc: 'Ướp thịt, thuộc da, làm thuốc súng. Mua ở Chủ tạp hóa.' }),

  // ───── Vật liệu tinh chế ─────
  I({ id: 'rope', name: 'Dây thừng', cat: 'material', stack: 50, weight: 0.2, price: 20, target: 2000, k: 0.6, desc: 'Bện từ cỏ sợi.' }),
  I({ id: 'leather', name: 'Da thuộc', cat: 'material', stack: 50, weight: 0.6, price: 65, target: 1000, k: 0.6, tier: 1, desc: 'Da sống thuộc với muối.' }),
  I({ id: 'cloth', name: 'Vải', cat: 'material', stack: 50, weight: 0.2, price: 30, target: 3000, k: 0.6, desc: 'Dệt từ cỏ sợi hoặc nhặt ở phế tích.' }),
  I({ id: 'iron_ingot', name: 'Thỏi sắt', cat: 'material', stack: 50, weight: 1, price: 95, target: 1500, k: 0.6, tier: 1, desc: 'Nung từ quặng sắt và than.' }),
  I({ id: 'parts', name: 'Linh kiện cơ khí', cat: 'material', stack: 50, weight: 0.5, price: 90, target: 800, k: 0.6, tier: 2, desc: 'Bánh răng, lò xo, ốc vít.' }),
  I({ id: 'gunpowder', name: 'Thuốc súng', cat: 'material', stack: 50, weight: 0.2, price: 45, target: 800, k: 0.6, tier: 2, desc: 'Dùng làm đạn.' }),

  // ───── Thức ăn & nước ─────
  I({ id: 'berries', name: 'Quả mọng', cat: 'food', stack: 40, weight: 0.1, price: 5, target: 4000, k: 0.7, food: { hunger: 8, thirst: 3, spoil: 4 * DAY }, desc: 'Ăn sống được.' }),
  I({ id: 'mushroom', name: 'Nấm', cat: 'food', stack: 40, weight: 0.1, price: 6, target: 3000, k: 0.7, food: { hunger: 6, hp: -3, poison: 0.1, spoil: 3 * DAY }, desc: 'Ăn sống hơi độc. Nướng lên thì ngon.' }),
  I({ id: 'cooked_mushroom', name: 'Nấm nướng', cat: 'food', stack: 40, weight: 0.1, price: 12, target: 2000, k: 0.7, food: { hunger: 14, hp: 2, spoil: 2 * DAY } }),
  I({ id: 'raw_meat', name: 'Thịt sống', cat: 'food', stack: 40, weight: 0.4, price: 15, target: 3000, k: 0.7, food: { hunger: 10, poison: 0.35, spoil: 1.5 * DAY }, desc: 'Nên nướng chín trước khi ăn.' }),
  I({ id: 'cooked_meat', name: 'Thịt nướng', cat: 'food', stack: 40, weight: 0.4, price: 30, target: 2500, k: 0.7, food: { hunger: 30, hp: 5, spoil: 2.5 * DAY } }),
  I({ id: 'jerky', name: 'Thịt khô', cat: 'food', stack: 40, weight: 0.2, price: 50, target: 1500, k: 0.6, food: { hunger: 26, thirst: -4, spoil: 20 * DAY }, desc: 'Để được rất lâu. Món hàng mùa đông.' }),
  I({ id: 'raw_fish', name: 'Cá sống', cat: 'food', stack: 40, weight: 0.3, price: 14, target: 2500, k: 0.7, food: { hunger: 8, poison: 0.25, spoil: 1 * DAY } }),
  I({ id: 'cooked_fish', name: 'Cá nướng', cat: 'food', stack: 40, weight: 0.3, price: 26, target: 2000, k: 0.7, food: { hunger: 22, thirst: 2, hp: 5, spoil: 2 * DAY } }),
  I({ id: 'carrot', name: 'Cà rốt', cat: 'food', stack: 40, weight: 0.2, price: 10, target: 3000, k: 0.7, food: { hunger: 10, thirst: 4, spoil: 6 * DAY } }),
  I({ id: 'pumpkin', name: 'Bí ngô', cat: 'food', stack: 20, weight: 1, price: 22, target: 2000, k: 0.7, food: { hunger: 15, thirst: 5, spoil: 10 * DAY } }),
  I({ id: 'pumpkin_soup', name: 'Súp bí thịt', cat: 'food', stack: 20, weight: 0.5, price: 95, target: 600, k: 0.6, food: { hunger: 50, thirst: 20, hp: 15, buff: { id: 'warm', secs: 300 }, spoil: 3 * DAY }, desc: 'Ấm bụng. Tăng thân nhiệt trong 5 phút.' }),
  I({ id: 'canned_food', name: 'Đồ hộp', cat: 'food', stack: 20, weight: 0.5, price: 70, target: 800, k: 0.6, food: { hunger: 35, thirst: 5 }, desc: 'Không bao giờ hỏng.' }),
  I({ id: 'cactus_flesh', name: 'Ruột xương rồng', cat: 'food', stack: 40, weight: 0.2, price: 8, target: 2000, k: 0.7, food: { thirst: 15, hunger: 3, hp: -2, spoil: 3 * DAY } }),
  I({ id: 'waterskin', name: 'Bình da (rỗng)', cat: 'material', stack: 5, weight: 0.3, price: 75, target: 1000, k: 0.6, desc: 'Dùng ở chỗ có nước để múc.' }),
  I({ id: 'waterskin_dirty', name: 'Bình nước bẩn', cat: 'drink', stack: 5, weight: 1, price: 75, target: 600, k: 0.6, food: { thirst: 25, poison: 0.3, returns: 'waterskin' }, desc: 'Nên đun sôi ở lửa trại.' }),
  I({ id: 'waterskin_clean', name: 'Bình nước sạch', cat: 'drink', stack: 5, weight: 1, price: 85, target: 800, k: 0.6, food: { thirst: 40, returns: 'waterskin' } }),

  // ───── Thuốc ─────
  I({ id: 'bandage', name: 'Băng gạc', cat: 'medicine', stack: 20, weight: 0.1, price: 32, target: 1500, k: 0.6, food: { hp: 15, cure: ['bleed'] } }),
  I({ id: 'herbal_medicine', name: 'Thuốc thảo dược', cat: 'medicine', stack: 20, weight: 0.2, price: 70, target: 800, k: 0.6, food: { hp: 30, cure: ['poison', 'bleed'] } }),
  I({ id: 'serum', name: 'Huyết thanh', cat: 'medicine', stack: 10, weight: 0.2, price: 300, target: 300, k: 0.5, tier: 2, food: { mist: -40, hp: 10 }, desc: 'Giảm 40% Nhiễm Sương.' }),
  I({ id: 'filter', name: 'Lõi lọc', cat: 'special', stack: 20, weight: 0.2, price: 110, target: 800, k: 0.6, tier: 2, usable: true, desc: 'Dùng khi đang đeo mặt nạ để hồi độ bền mặt nạ.' }),
  I({ id: 'blood_chest', name: 'Rương Sương Đỏ', cat: 'special', stack: 10, weight: 1, price: 300, target: 200, k: 0.5, usable: true, desc: 'Phần thưởng sau Đêm Sương Đỏ. Dùng để mở.' }),

  // ───── Hạt giống ─────
  I({ id: 'carrot_seed', name: 'Hạt cà rốt', cat: 'seed', stack: 50, weight: 0.05, price: 6, target: 3000, k: 0.6, seed: 'carrot', desc: 'Gieo vào Luống trồng. Thu sau ~1 ngày.' }),
  I({ id: 'pumpkin_seed', name: 'Hạt bí ngô', cat: 'seed', stack: 50, weight: 0.05, price: 10, target: 2000, k: 0.6, seed: 'pumpkin', desc: 'Gieo vào Luống trồng. Thu sau ~2 ngày.' }),

  // ───── Công cụ ─────
  I({ id: 'stone_axe', name: 'Rìu đá', cat: 'tool', stack: 1, weight: 2, price: 85, tier: 0, durability: 120, tool: { kind: 'axe', power: 10, tier: 0 }, weapon: { dmg: 9, range: 1.5, cd: 0.55 } }),
  I({ id: 'stone_pickaxe', name: 'Cuốc chim đá', cat: 'tool', stack: 1, weight: 2, price: 90, tier: 0, durability: 120, tool: { kind: 'pickaxe', power: 10, tier: 0 }, weapon: { dmg: 8, range: 1.5, cd: 0.55 } }),
  I({ id: 'iron_axe', name: 'Rìu sắt', cat: 'tool', stack: 1, weight: 2.5, price: 380, tier: 1, durability: 400, tool: { kind: 'axe', power: 22, tier: 1 }, weapon: { dmg: 16, range: 1.5, cd: 0.5 } }),
  I({ id: 'iron_pickaxe', name: 'Cuốc chim sắt', cat: 'tool', stack: 1, weight: 2.5, price: 380, tier: 1, durability: 400, tool: { kind: 'pickaxe', power: 22, tier: 1 }, weapon: { dmg: 14, range: 1.5, cd: 0.5 } }),
  I({ id: 'fishing_rod', name: 'Cần câu', cat: 'tool', stack: 1, weight: 1, price: 70, tier: 0, durability: 100, tool: { kind: 'rod', power: 1, tier: 0 }, desc: 'Nhắm vào mặt nước rồi bấm để câu cá.' }),
  I({ id: 'torch', name: 'Đuốc', cat: 'tool', stack: 1, weight: 0.5, price: 22, tier: 0, durability: 240, light: 7, weapon: { dmg: 6, range: 1.4, cd: 0.6 }, desc: 'Cầm trên tay để soi sáng. Cháy trong 4 phút.' }),

  // ───── Vũ khí ─────
  I({ id: 'wooden_spear', name: 'Giáo gỗ', cat: 'weapon', stack: 1, weight: 1.5, price: 55, tier: 0, durability: 80, weapon: { dmg: 12, range: 1.9, cd: 0.6, arc: 0.6 } }),
  I({ id: 'stone_spear', name: 'Giáo đá', cat: 'weapon', stack: 1, weight: 2, price: 100, tier: 0, durability: 150, weapon: { dmg: 17, range: 2.0, cd: 0.6, arc: 0.6 } }),
  I({ id: 'iron_sword', name: 'Kiếm sắt', cat: 'weapon', stack: 1, weight: 2.5, price: 600, tier: 1, durability: 350, weapon: { dmg: 28, range: 1.6, cd: 0.45, arc: 1.6 } }),
  I({ id: 'bow', name: 'Cung gỗ', cat: 'weapon', stack: 1, weight: 1, price: 130, tier: 1, durability: 200, weapon: { dmg: 20, range: 1.2, cd: 0.8, ranged: { ammo: 'arrow', speed: 18, range: 12 } } }),
  I({ id: 'crossbow', name: 'Nỏ', cat: 'weapon', stack: 1, weight: 3, price: 750, tier: 2, durability: 300, weapon: { dmg: 40, range: 1.2, cd: 1.3, ranged: { ammo: 'arrow', speed: 24, range: 15 } } }),
  I({ id: 'pipe_gun', name: 'Súng ống tự chế', cat: 'weapon', stack: 1, weight: 3, price: 1100, tier: 2, durability: 250, weapon: { dmg: 58, range: 1.2, cd: 1.0, ranged: { ammo: 'bullet', speed: 34, range: 18, loud: true } }, desc: 'Rất mạnh nhưng tiếng nổ thu hút quái.' }),
  I({ id: 'mist_blade', name: 'Lưỡi Sương', cat: 'weapon', stack: 1, weight: 2, price: 4800, tier: 4, durability: 600, weapon: { dmg: 55, range: 1.8, cd: 0.4, arc: 1.8 }, desc: 'Rèn từ Tinh thể Sương.' }),
  I({ id: 'arrow', name: 'Mũi tên', cat: 'ammo', stack: 50, weight: 0.05, price: 6, target: 4000, k: 0.6 }),
  I({ id: 'bullet', name: 'Đạn tự chế', cat: 'ammo', stack: 50, weight: 0.05, price: 22, target: 1500, k: 0.6, tier: 2 }),

  // ───── Giáp & quần áo ─────
  I({ id: 'straw_hat', name: 'Nón lá', cat: 'armor', stack: 1, weight: 0.3, price: 65, tier: 0, durability: 300, armor: { slot: 'head', armor: 1, cooling: 10 }, desc: 'Mát mẻ dưới nắng gắt.' }),
  I({ id: 'fur_hat', name: 'Mũ lông', cat: 'armor', stack: 1, weight: 0.5, price: 150, tier: 1, durability: 300, armor: { slot: 'head', armor: 2, warmth: 8 } }),
  I({ id: 'iron_helmet', name: 'Mũ sắt', cat: 'armor', stack: 1, weight: 2, price: 480, tier: 1, durability: 400, armor: { slot: 'head', armor: 10 } }),
  I({ id: 'leather_armor', name: 'Áo giáp da', cat: 'armor', stack: 1, weight: 3, price: 380, tier: 1, durability: 300, armor: { slot: 'body', armor: 10, warmth: 5 } }),
  I({ id: 'fur_coat', name: 'Áo khoác lông', cat: 'armor', stack: 1, weight: 3, price: 440, tier: 1, durability: 300, armor: { slot: 'body', armor: 4, warmth: 16 } }),
  I({ id: 'iron_armor', name: 'Giáp sắt', cat: 'armor', stack: 1, weight: 8, price: 1250, tier: 1, durability: 500, armor: { slot: 'body', armor: 25 } }),
  I({ id: 'mist_armor', name: 'Giáp Sương', cat: 'armor', stack: 1, weight: 5, price: 6500, tier: 4, durability: 800, armor: { slot: 'body', armor: 40, warmth: 8, mist: 0.2 } }),
  I({ id: 'cloth_mask', name: 'Khẩu trang thảo mộc', cat: 'armor', stack: 1, weight: 0.1, price: 80, tier: 0, durability: 600, armor: { slot: 'mask', armor: 0, mist: 0.3 }, desc: 'Lọc bớt 30% Sương. Độ bền giảm khi ở trong sương.' }),
  I({ id: 'gas_mask', name: 'Mặt nạ phòng độc', cat: 'armor', stack: 1, weight: 1, price: 600, tier: 2, durability: 900, armor: { slot: 'mask', armor: 1, mist: 0.7 }, desc: 'Lọc 70% Sương. Dùng Lõi lọc để hồi độ bền.' }),
  I({ id: 'mist_mask', name: 'Mặt nạ Sương', cat: 'armor', stack: 1, weight: 1, price: 3500, tier: 4, durability: 1800, armor: { slot: 'mask', armor: 3, mist: 0.9 } }),

  // ───── Công trình ─────
  I({ id: 'campfire', name: 'Lửa trại', cat: 'placeable', stack: 10, weight: 2, price: 100, place: 'campfire', desc: 'Nấu ăn, sưởi ấm, chiếu sáng. Thêm gỗ để cháy lâu hơn.' }),
  I({ id: 'torch_stand', name: 'Đuốc cắm', cat: 'placeable', stack: 20, weight: 0.6, price: 55, place: 'torch_stand' }),
  I({ id: 'lamp', name: 'Đèn dầu', cat: 'placeable', stack: 10, weight: 1, price: 180, tier: 1, place: 'lamp', desc: 'Sáng rộng. Thêm than để đốt.' }),
  I({ id: 'wood_wall', name: 'Tường gỗ', cat: 'placeable', stack: 50, weight: 3, price: 60, place: 'wood_wall' }),
  I({ id: 'stone_wall', name: 'Tường đá', cat: 'placeable', stack: 50, weight: 5, price: 105, tier: 1, place: 'stone_wall' }),
  I({ id: 'iron_wall', name: 'Tường sắt', cat: 'placeable', stack: 50, weight: 6, price: 230, tier: 1, place: 'iron_wall' }),
  I({ id: 'wood_door', name: 'Cửa gỗ', cat: 'placeable', stack: 10, weight: 3, price: 100, place: 'wood_door', desc: 'Chỉ chủ và người được cấp quyền đi qua được.' }),
  I({ id: 'iron_door', name: 'Cửa sắt', cat: 'placeable', stack: 10, weight: 6, price: 480, tier: 1, place: 'iron_door' }),
  I({ id: 'wood_floor', name: 'Sàn gỗ', cat: 'placeable', stack: 50, weight: 1, price: 20, place: 'wood_floor', desc: 'Đứng trên sàn ấm hơn một chút.' }),
  I({ id: 'chest', name: 'Rương gỗ', cat: 'placeable', stack: 10, weight: 4, price: 140, place: 'chest' }),
  I({ id: 'workbench', name: 'Bàn chế tạo', cat: 'placeable', stack: 5, weight: 6, price: 250, place: 'workbench' }),
  I({ id: 'furnace', name: 'Lò nung', cat: 'placeable', stack: 5, weight: 8, price: 220, place: 'furnace' }),
  I({ id: 'mech_bench', name: 'Bàn cơ khí', cat: 'placeable', stack: 5, weight: 10, price: 1100, tier: 2, place: 'mech_bench' }),
  I({ id: 'crystal_forge', name: 'Lò Tinh thể', cat: 'placeable', stack: 5, weight: 12, price: 5200, tier: 4, place: 'crystal_forge', desc: 'Chế đồ Sương và cường hóa Cấp Sương.' }),
  I({ id: 'bed', name: 'Giường', cat: 'placeable', stack: 5, weight: 6, price: 300, place: 'bed', desc: 'Đặt điểm hồi sinh.' }),
  I({ id: 'sleeping_bag', name: 'Túi ngủ', cat: 'placeable', stack: 5, weight: 2, price: 120, place: 'sleeping_bag', desc: 'Đặt điểm hồi sinh.' }),
  I({ id: 'totem', name: 'Cột Lãnh Thổ', cat: 'placeable', stack: 1, weight: 8, price: 360, place: 'totem', desc: 'Xác lập lãnh thổ bán kính 16 ô. Tốn phí bảo trì mỗi ngày.' }),
  I({ id: 'farm_plot', name: 'Luống trồng', cat: 'placeable', stack: 20, weight: 2, price: 70, place: 'farm_plot', desc: 'Gieo hạt giống vào đây.' }),
  I({ id: 'spike_trap', name: 'Bẫy chông', cat: 'placeable', stack: 20, weight: 3, price: 85, place: 'spike_trap', desc: 'Gây sát thương quái giẫm lên.' }),
  I({ id: 'market_stall', name: 'Sạp hàng', cat: 'placeable', stack: 2, weight: 8, price: 520, place: 'market_stall', desc: 'Bày bán đồ, người khác mua được cả khi bạn offline.' }),
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(ITEM_LIST.map((d) => [d.id, d]));

export function itemDef(id: string): ItemDef {
  const d = ITEMS[id];
  if (!d) throw new Error(`Không có vật phẩm: ${id}`);
  return d;
}

/** Vật phẩm độc nhất: có độ bền, không xếp chồng, mang mã định danh riêng. */
export function isUnique(id: string): boolean {
  return ITEMS[id]?.durability !== undefined;
}

export function isPerishable(id: string): boolean {
  return ITEMS[id]?.food?.spoil !== undefined;
}
