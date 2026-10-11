/** Loại nền (ô đất). Giá trị lưu trong Uint8Array của chunk. */
export enum T {
  DEEP = 0,
  SHALLOW = 1,
  SAND = 2,
  GRASS = 3,
  FOREST = 4,
  SWAMP = 5,
  DESERT = 6,
  SNOW = 7,
  ROCK = 8,
  RUINS = 9,
  MIST = 10,
  PLAZA = 11,
}

export interface TileDef {
  id: number;
  key: string;
  name: string;
  /** tên biome hiển thị */
  biome: string;
  /** màu chủ đạo (dùng cho bản đồ nhỏ) */
  color: number;
  /** không đi qua được */
  solid: boolean;
  /** hệ số tốc độ */
  speed: number;
  /** nhiệt độ môi trường ban ngày (°C) */
  temp: number;
  /** là nước (uống/múc/câu cá được) */
  water: boolean;
}

export const TILES: TileDef[] = [
  { id: 0, key: 'deep', name: 'Nước sâu', biome: 'Hồ nước', color: 0x1f4e79, solid: true, speed: 0, temp: 18, water: true },
  { id: 1, key: 'shallow', name: 'Nước nông', biome: 'Bờ nước', color: 0x3b7fb6, solid: false, speed: 0.55, temp: 18, water: true },
  { id: 2, key: 'sand', name: 'Cát', biome: 'Bờ cát', color: 0xd9c38a, solid: false, speed: 0.95, temp: 26, water: false },
  { id: 3, key: 'grass', name: 'Cỏ', biome: 'Đồng cỏ', color: 0x6aa84f, solid: false, speed: 1, temp: 22, water: false },
  { id: 4, key: 'forest', name: 'Đất rừng', biome: 'Rừng rậm', color: 0x3f7a3a, solid: false, speed: 1, temp: 18, water: false },
  { id: 5, key: 'swamp', name: 'Bùn lầy', biome: 'Đầm lầy', color: 0x4f5f3a, solid: false, speed: 0.8, temp: 24, water: false },
  { id: 6, key: 'desert', name: 'Cát sa mạc', biome: 'Sa mạc', color: 0xe0b26a, solid: false, speed: 0.92, temp: 38, water: false },
  { id: 7, key: 'snow', name: 'Tuyết', biome: 'Núi tuyết', color: 0xe8eef2, solid: false, speed: 0.85, temp: -8, water: false },
  { id: 8, key: 'rock', name: 'Đá núi', biome: 'Vùng núi', color: 0x8a8580, solid: false, speed: 1, temp: 8, water: false },
  { id: 9, key: 'ruins', name: 'Nhựa đường', biome: 'Phế tích đô thị', color: 0x5d5d63, solid: false, speed: 1.05, temp: 22, water: false },
  { id: 10, key: 'mist', name: 'Đất Sương', biome: 'Rừng Sương', color: 0x6b2a3e, solid: false, speed: 0.95, temp: 14, water: false },
  { id: 11, key: 'plaza', name: 'Sân lát đá', biome: 'Trạm giao thương', color: 0xb8a58a, solid: false, speed: 1.1, temp: 22, water: false },
];

export const TILE_COUNT = TILES.length;
