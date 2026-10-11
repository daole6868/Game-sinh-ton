import type { StationId } from '../types.ts';

export interface StructureDef {
  id: string;
  name: string;
  hp: number;
  solid: boolean;
  /** cửa: chủ và người được cấp quyền đi qua được */
  door?: boolean;
  /** bán kính chiếu sáng */
  light?: number;
  /** cần nhiên liệu để sáng (light chỉ có khi còn nhiên liệu) */
  fuel?: { items: Record<string, number>; max: number; initial: number };
  /** sưởi ấm (+°C trong bán kính 4 ô) khi đang sáng */
  warmth?: number;
  station?: StationId;
  /** số ô chứa đồ */
  container?: number;
  /** đặt điểm hồi sinh */
  spawn?: boolean;
  totem?: boolean;
  farm?: boolean;
  stall?: boolean;
  trap?: number;
  floor?: boolean;
  /** vẽ thấp hơn thực thể (nằm dưới chân) */
  low?: boolean;
}

export const STRUCTURE_LIST: StructureDef[] = [
  { id: 'campfire', name: 'Lửa trại', hp: 60, solid: false, light: 7, warmth: 18, station: 'campfire', fuel: { items: { wood: 120, coal: 300 }, max: 900, initial: 240 }, low: true },
  { id: 'torch_stand', name: 'Đuốc cắm', hp: 30, solid: false, light: 5 },
  { id: 'lamp', name: 'Đèn dầu', hp: 60, solid: false, light: 9, fuel: { items: { coal: 900 }, max: 3600, initial: 900 } },
  { id: 'wood_wall', name: 'Tường gỗ', hp: 250, solid: true },
  { id: 'stone_wall', name: 'Tường đá', hp: 600, solid: true },
  { id: 'iron_wall', name: 'Tường sắt', hp: 1400, solid: true },
  { id: 'wood_door', name: 'Cửa gỗ', hp: 200, solid: true, door: true },
  { id: 'iron_door', name: 'Cửa sắt', hp: 1000, solid: true, door: true },
  { id: 'wood_floor', name: 'Sàn gỗ', hp: 120, solid: false, floor: true, low: true },
  { id: 'chest', name: 'Rương gỗ', hp: 150, solid: true, container: 20 },
  { id: 'workbench', name: 'Bàn chế tạo', hp: 200, solid: true, station: 'workbench' },
  { id: 'furnace', name: 'Lò nung', hp: 400, solid: true, station: 'furnace', light: 3, warmth: 10 },
  { id: 'mech_bench', name: 'Bàn cơ khí', hp: 500, solid: true, station: 'mech_bench' },
  { id: 'crystal_forge', name: 'Lò Tinh thể', hp: 900, solid: true, station: 'crystal_forge', light: 4 },
  { id: 'bed', name: 'Giường', hp: 150, solid: false, spawn: true },
  { id: 'sleeping_bag', name: 'Túi ngủ', hp: 60, solid: false, spawn: true, low: true },
  { id: 'totem', name: 'Cột Lãnh Thổ', hp: 1500, solid: true, totem: true, light: 3 },
  { id: 'farm_plot', name: 'Luống trồng', hp: 80, solid: false, farm: true, low: true },
  { id: 'spike_trap', name: 'Bẫy chông', hp: 120, solid: false, trap: 14, low: true },
  { id: 'market_stall', name: 'Sạp hàng', hp: 400, solid: true, stall: true },
];

export const STRUCTURES: Record<string, StructureDef> = Object.fromEntries(STRUCTURE_LIST.map((s) => [s.id, s]));

export const STATION_NAMES: Record<StationId, string> = {
  campfire: 'Lửa trại',
  workbench: 'Bàn chế tạo',
  furnace: 'Lò nung',
  mech_bench: 'Bàn cơ khí',
  crystal_forge: 'Lò Tinh thể',
};

export interface CropDef {
  id: string;
  name: string;
  /** giây thế giới để chín */
  grow: number;
  yield: { item: string; min: number; max: number; chance?: number }[];
}

export const CROPS: Record<string, CropDef> = {
  carrot: {
    id: 'carrot',
    name: 'Cà rốt',
    grow: 1200,
    yield: [
      { item: 'carrot', min: 2, max: 3 },
      { item: 'carrot_seed', min: 1, max: 2, chance: 0.8 },
    ],
  },
  pumpkin: {
    id: 'pumpkin',
    name: 'Bí ngô',
    grow: 2400,
    yield: [
      { item: 'pumpkin', min: 1, max: 2 },
      { item: 'pumpkin_seed', min: 1, max: 2, chance: 0.8 },
    ],
  },
};
