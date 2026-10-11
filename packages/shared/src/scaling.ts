import { RING_SIZE } from './constants.ts';
import { SEASON_TEMP } from './time.ts';
import type { Season, WeatherKind } from './types.ts';

export function distFromCenter(x: number, y: number): number {
  return Math.hypot(x, y);
}

export function ringOf(x: number, y: number): number {
  return Math.floor(distFromCenter(x, y) / RING_SIZE);
}

export type ZoneId = 'edge' | 'grey' | 'red' | 'abyss';

export interface ZoneInfo {
  id: ZoneId;
  name: string;
  /** off: tắt · flag: chỉ khi cả hai bật cờ · on: bật trừ trạm & lãnh thổ · full: bật toàn phần */
  pvp: 'off' | 'flag' | 'on' | 'full';
  color: string;
}

export function zoneOf(ring: number): ZoneInfo {
  if (ring <= 0) return { id: 'edge', name: 'Vùng Rìa', pvp: 'off', color: '#8fd18b' };
  if (ring <= 2) return { id: 'grey', name: 'Vùng Xám', pvp: 'flag', color: '#b8b8c8' };
  if (ring <= 5) return { id: 'red', name: 'Vùng Đỏ', pvp: 'on', color: '#ff6b6b' };
  return { id: 'abyss', name: 'Vùng Thẳm', pvp: 'full', color: '#c06bff' };
}

/** Mật độ sương (0 = không có). Rừng Sương dày gấp rưỡi. */
export function mistDensity(ring: number, inMistForest = false): number {
  let d: number;
  if (ring <= 0) d = 0;
  else if (ring === 1) d = 0.15;
  else if (ring === 2) d = 0.3;
  else if (ring === 3) d = 0.5;
  else if (ring === 4) d = 0.6;
  else if (ring === 5) d = 0.7;
  else d = Math.min(1.6, 0.8 + 0.03 * (ring - 6));
  return inMistForest ? d * 1.5 : d;
}

/** Cấp quái theo độ sâu: 1 + 4 × Ring + ngẫu nhiên(0..2). */
export function mobLevel(ring: number, r: number): number {
  return 1 + 4 * Math.max(0, ring) + Math.floor(r * 3);
}

export function mobHp(base: number, lv: number): number {
  return Math.round(base * Math.pow(1 + 0.1 * (lv - 1), 1.5));
}

export function mobDmg(base: number, lv: number): number {
  return base * (1 + 0.08 * (lv - 1));
}

/** Hệ số chỉ số trang bị theo Cấp Sương. */
export function upgradeMul(lv: number | undefined): number {
  return 1 + 0.06 * (lv ?? 0);
}

/** Số Tinh thể Sương cần để nâng từ cấp lv lên lv+1. */
export function upgradeCost(lv: number): number {
  return Math.ceil(10 * Math.pow(1.25, lv));
}

/** Giảm sát thương theo giáp: giáp / (giáp + 50). */
export function armorReduction(armor: number): number {
  return armor <= 0 ? 0 : armor / (armor + 50);
}

/** Nhiệt độ môi trường (°C). */
export function ambientTemp(opts: {
  tileTemp: number;
  tileKey: string;
  dark: number;
  season: Season;
  weather: WeatherKind;
}): number {
  let t = opts.tileTemp + SEASON_TEMP[opts.season];
  const nightDrop = opts.tileKey === 'desert' ? 26 : 9;
  t -= nightDrop * (opts.dark / 0.88);
  if (opts.weather === 'rain' || opts.weather === 'storm') t -= 5;
  if (opts.weather === 'heat') t += 9;
  if (opts.weather === 'fog') t -= 2;
  return t;
}
