export type NpcRole = 'general' | 'smith' | 'doctor' | 'scrap' | 'board' | 'keeper' | 'guide' | 'market';

export interface NpcDef {
  role: NpcRole;
  name: string;
  title: string;
  /** vị trí so với tâm trạm (ô) */
  dx: number;
  dy: number;
  /** NPC bán cho người chơi */
  sells: string[];
  /** NPC thu mua từ người chơi */
  buys: string[];
  greeting: string;
}

export const NPC_LIST: NpcDef[] = [
  {
    role: 'general',
    name: 'Cô Tư',
    title: 'Chủ tạp hóa',
    dx: -6,
    dy: -3,
    sells: ['salt', 'carrot_seed', 'pumpkin_seed', 'torch', 'waterskin', 'waterskin_clean', 'canned_food', 'rope', 'fishing_rod', 'straw_hat'],
    buys: ['wood', 'stone', 'fiber', 'reed', 'clay', 'berries', 'mushroom', 'raw_meat', 'cooked_meat', 'jerky', 'raw_fish', 'cooked_fish', 'carrot', 'pumpkin', 'pumpkin_soup', 'cactus_flesh', 'hide', 'rope', 'cloth'],
    greeting: 'Hàng tươi đây! Mùa đông giá đồ ăn lên lắm đó nghen.',
  },
  {
    role: 'smith',
    name: 'Bác Hùng',
    title: 'Thợ rèn',
    dx: 6,
    dy: -3,
    sells: ['stone_axe', 'stone_pickaxe', 'stone_spear', 'iron_axe', 'iron_pickaxe', 'iron_sword', 'arrow', 'bow', 'iron_ingot', 'coal'],
    buys: ['iron_ore', 'iron_ingot', 'coal', 'scrap', 'bone', 'stone', 'fur', 'leather'],
    greeting: 'Đồ cùn thì mang lại đây ta mài. Mỗi lần sửa là mòn đi một chút đấy.',
  },
  {
    role: 'doctor',
    name: 'Y sĩ Lan',
    title: 'Y sĩ',
    dx: -6,
    dy: 3,
    sells: ['bandage', 'herbal_medicine', 'serum', 'filter', 'cloth_mask'],
    buys: ['herb', 'mushroom', 'mist_crystal', 'hide', 'fur'],
    greeting: 'Đừng ở trong sương quá lâu. Huyết thanh đắt, mạng còn đắt hơn.',
  },
  {
    role: 'scrap',
    name: 'Chú Sáu Ve Chai',
    title: 'Thu mua phế liệu',
    dx: 6,
    dy: 3,
    sells: ['parts', 'bullet', 'gunpowder'],
    buys: ['scrap', 'parts', 'electronics', 'cloth', 'mist_crystal', 'bullet', 'gunpowder'],
    greeting: 'Ve chai, đồng nát, bo mạch... cái gì tui cũng mua!',
  },
  { role: 'board', name: 'Bảng đơn hàng', title: 'Hợp đồng của trạm', dx: 0, dy: -6, sells: [], buys: [], greeting: '' },
  { role: 'keeper', name: 'Ông Ba', title: 'Thủ kho · Hòm thư', dx: -3, dy: 6, sells: [], buys: [], greeting: 'Thư từ, hàng gửi, kho an toàn — có hết.' },
  { role: 'guide', name: 'Anh Dũng', title: 'Người dẫn đường', dx: 3, dy: 6, sells: [], buys: [], greeting: 'Muốn tới trạm khác? Có phí, nhưng an toàn.' },
  { role: 'market', name: 'Sàn giao dịch', title: 'Sàn của người chơi', dx: 0, dy: 0, sells: [], buys: [], greeting: '' },
];

export const NPCS: Record<NpcRole, NpcDef> = Object.fromEntries(NPC_LIST.map((n) => [n.role, n])) as Record<NpcRole, NpcDef>;

/** Tất cả mặt hàng mà hệ thống có giao dịch (để tính giá động). */
export const SYSTEM_TRADED_ITEMS: string[] = [
  ...new Set(NPC_LIST.flatMap((n) => [...n.sells, ...n.buys])),
];
