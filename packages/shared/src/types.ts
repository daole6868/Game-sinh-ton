/** Một chồng vật phẩm. Khóa ngắn để gói tin gọn. */
export interface ItemStack {
  /** id định nghĩa vật phẩm */
  id: string;
  /** số lượng */
  n: number;
  /** độ bền hiện tại (đồ độc nhất) */
  d?: number;
  /** độ bền tối đa (giảm dần sau mỗi lần sửa) */
  md?: number;
  /** Cấp Sương (cường hóa) */
  lv?: number;
  /** hệ số phẩm chất khi chế tạo (0.9 – 1.2) */
  q?: number;
  /** thời điểm (giây thế giới) mà món ăn còn tươi 100% — dùng tính độ hỏng */
  t?: number;
  /** mã định danh duy nhất (đồ độc nhất) */
  u?: string;
}

export type Slot = ItemStack | null;

export type EquipSlot = 'head' | 'body' | 'mask';
export const EQUIP_SLOTS: readonly EquipSlot[] = ['head', 'body', 'mask'];

export type Equipment = Record<EquipSlot, Slot>;

export type SkillId =
  | 'gathering'
  | 'combat'
  | 'crafting'
  | 'cooking'
  | 'farming'
  | 'building'
  | 'trading'
  | 'survival';

export const SKILL_IDS: readonly SkillId[] = [
  'gathering',
  'combat',
  'crafting',
  'cooking',
  'farming',
  'building',
  'trading',
  'survival',
];

export interface SkillState {
  lv: number;
  xp: number;
}

export type StatusId = 'poison' | 'bleed' | 'wet' | 'warm' | 'fed';

export interface Drop {
  item: string;
  min: number;
  max: number;
  /** xác suất rơi (mặc định 1) */
  chance?: number;
}

export type StationId = 'campfire' | 'workbench' | 'furnace' | 'mech_bench' | 'crystal_forge';

export type Season = 0 | 1 | 2 | 3;

export type WeatherKind = 'clear' | 'rain' | 'fog' | 'storm' | 'heat';

export interface Vec2 {
  x: number;
  y: number;
}
