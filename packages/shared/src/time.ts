import { BLOOD_NIGHT_EVERY, DAWN_END, DAY_END, DAY_LENGTH, DAYS_PER_SEASON, DUSK_END } from './constants.ts';
import type { Season } from './types.ts';

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

/** Ngày thứ mấy của thế giới (bắt đầu từ 1). Mỗi ngày bắt đầu lúc bình minh. */
export function dayOf(worldTime: number): number {
  return Math.floor(worldTime / DAY_LENGTH) + 1;
}

/** Giây trong ngày (0 = bắt đầu bình minh). */
export function timeOfDay(worldTime: number): number {
  return ((worldTime % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH;
}

export function phaseOf(worldTime: number): DayPhase {
  const t = timeOfDay(worldTime);
  if (t < DAWN_END) return 'dawn';
  if (t < DAY_END) return 'day';
  if (t < DUSK_END) return 'dusk';
  return 'night';
}

export function isNight(worldTime: number): boolean {
  return phaseOf(worldTime) === 'night';
}

/** Giờ hiển thị (0–24). Bình minh 5h–6h, ngày 6h–19h, hoàng hôn 19h–20h, đêm 20h–5h. */
export function clockHours(worldTime: number): number {
  const t = timeOfDay(worldTime);
  if (t < DAWN_END) return 5 + t / DAWN_END;
  if (t < DAY_END) return 6 + ((t - DAWN_END) / (DAY_END - DAWN_END)) * 13;
  if (t < DUSK_END) return 19 + (t - DAY_END) / (DUSK_END - DAY_END);
  return (20 + ((t - DUSK_END) / (DAY_LENGTH - DUSK_END)) * 9) % 24;
}

export function formatClock(worldTime: number): string {
  const h = clockHours(worldTime);
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Độ tối môi trường (0 = sáng, ~0.88 = tối nhất). */
export function darkness(worldTime: number): number {
  const t = timeOfDay(worldTime);
  const NIGHT = 0.88;
  if (t < DAWN_END) return NIGHT * (1 - t / DAWN_END);
  if (t < DAY_END) return 0;
  if (t < DUSK_END) return NIGHT * ((t - DAY_END) / (DUSK_END - DAY_END));
  return NIGHT;
}

export const SEASON_NAMES = ['Xuân', 'Hạ', 'Thu', 'Đông'] as const;
/** Chênh lệch nhiệt độ theo mùa. */
export const SEASON_TEMP = [0, 7, -3, -14] as const;

export function seasonOf(day: number): Season {
  return (Math.floor((day - 1) / DAYS_PER_SEASON) % 4) as Season;
}

export function isBloodNightDay(day: number): boolean {
  return day % BLOOD_NIGHT_EVERY === 0;
}

/** Đang trong Đêm Sương Đỏ (phần đêm của ngày thứ 7, 14, 21...). */
export function isBloodNight(worldTime: number): boolean {
  return isBloodNightDay(dayOf(worldTime)) && phaseOf(worldTime) === 'night';
}

/** Số ngày còn lại tới Đêm Sương Đỏ tiếp theo (0 = đêm nay). */
export function daysUntilBloodNight(day: number): number {
  return (BLOOD_NIGHT_EVERY - (day % BLOOD_NIGHT_EVERY)) % BLOOD_NIGHT_EVERY;
}
