import type { SkillId, SkillState } from '../types.ts';
import { SKILL_IDS } from '../types.ts';

export const SKILL_NAMES: Record<SkillId, string> = {
  gathering: 'Thu hoạch',
  combat: 'Chiến đấu',
  crafting: 'Chế tạo',
  cooking: 'Nấu ăn',
  farming: 'Nông nghiệp',
  building: 'Xây dựng',
  trading: 'Thương lượng',
  survival: 'Sinh tồn',
};

export const SKILL_DESC: Record<SkillId, string> = {
  gathering: '+0,5% sát thương lên tài nguyên và +0,4% cơ hội nhận thêm vật phẩm mỗi cấp.',
  combat: '+0,5% sát thương mỗi cấp.',
  crafting: 'Đồ chế ra có chỉ số và độ bền cao hơn.',
  cooking: 'Món ăn hồi nhiều hơn 0,5% mỗi cấp.',
  farming: 'Cây lớn nhanh hơn 0,5% mỗi cấp.',
  building: 'Công trình bền hơn 0,5% mỗi cấp.',
  trading: 'Giảm thuế sàn (5% → 3%), tăng hạn mức bán cho hệ thống, NPC trả giá cao hơn.',
  survival: 'Đói, khát giảm chậm hơn 0,3% mỗi cấp.',
};

export const MAX_SKILL_LEVEL = 100;

/** Kinh nghiệm cần để lên từ cấp lv lên lv+1. */
export function xpToNext(lv: number): number {
  return Math.floor(40 * Math.pow(lv, 1.6));
}

export function newSkills(): Record<SkillId, SkillState> {
  const s = {} as Record<SkillId, SkillState>;
  for (const id of SKILL_IDS) s[id] = { lv: 1, xp: 0 };
  return s;
}

/** Cộng kinh nghiệm, trả về số cấp vừa tăng. */
export function addSkillXp(s: SkillState, xp: number): number {
  let ups = 0;
  if (s.lv >= MAX_SKILL_LEVEL) return 0;
  s.xp += xp;
  while (s.lv < MAX_SKILL_LEVEL && s.xp >= xpToNext(s.lv)) {
    s.xp -= xpToNext(s.lv);
    s.lv++;
    ups++;
  }
  if (s.lv >= MAX_SKILL_LEVEL) s.xp = 0;
  return ups;
}

export function tradeTaxRate(tradingLv: number, base = 0.05, min = 0.03): number {
  return Math.max(min, base - (base - min) * ((tradingLv - 1) / (MAX_SKILL_LEVEL - 1)));
}
