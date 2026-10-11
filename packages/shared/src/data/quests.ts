/**
 * Chuỗi nhiệm vụ cột mốc: hướng dẫn 30 phút đầu, sau đó dẫn người chơi đi sâu hơn.
 * Server kiểm tra điều kiện dựa trên sự kiện (event) phát sinh trong lúc chơi.
 */
export type QuestEvent =
  | { kind: 'have'; items: Record<string, number> }
  | { kind: 'craft'; item: string }
  | { kind: 'place'; structure: string }
  | { kind: 'eat_cooked' }
  | { kind: 'drink' }
  | { kind: 'survive_night' }
  | { kind: 'visit_outpost' }
  | { kind: 'sell_npc' }
  | { kind: 'reach_ring'; ring: number }
  | { kind: 'market_order' }
  | { kind: 'blood_night' }
  | { kind: 'kill'; mob?: string; count: number };

export interface QuestDef {
  id: string;
  title: string;
  hint: string;
  goal: QuestEvent;
  reward: number;
  rewardItems?: Record<string, number>;
}

export const QUESTS: QuestDef[] = [
  { id: 'gather', title: 'Những thứ đầu tiên', hint: 'Nhặt cành cây khô, đá cuội và bụi cỏ (bấm chuột trái vào chúng). Cần 6 Gỗ, 6 Đá, 4 Cỏ sợi.', goal: { kind: 'have', items: { wood: 6, stone: 6, fiber: 4 } }, reward: 20 },
  { id: 'axe', title: 'Rìu đá', hint: 'Mở túi đồ (Tab) → Chế tạo → Rìu đá.', goal: { kind: 'craft', item: 'stone_axe' }, reward: 20 },
  { id: 'campfire', title: 'Ngọn lửa', hint: 'Chặt cây lấy gỗ, chế tạo Lửa trại rồi chọn nó trên thanh nhanh và bấm để đặt.', goal: { kind: 'place', structure: 'campfire' }, reward: 25 },
  { id: 'eat', title: 'Bữa ăn nóng', hint: 'Săn thỏ lấy thịt hoặc hái nấm, đứng gần lửa trại để nướng, rồi ăn.', goal: { kind: 'eat_cooked' }, reward: 20, rewardItems: { waterskin: 1 } },
  { id: 'drink', title: 'Nước là sự sống', hint: 'Cầm Bình da, nhắm vào mặt nước và bấm để múc. Đun sôi ở lửa trại rồi uống. Hoặc uống trực tiếp (có thể ngộ độc).', goal: { kind: 'drink' }, reward: 15 },
  { id: 'night', title: 'Đêm đầu tiên', hint: 'Sống sót qua một đêm. Ở gần lửa và có vũ khí trong tay.', goal: { kind: 'survive_night' }, reward: 50, rewardItems: { bandage: 2 } },
  { id: 'outpost', title: 'Trạm Trung Tâm', hint: 'Đi tới Trạm Trung Tâm ở tọa độ (0, 0). Xem bản đồ (M).', goal: { kind: 'visit_outpost' }, reward: 30 },
  { id: 'sell', title: 'Đồng Xu đầu tiên', hint: 'Bán thứ gì đó cho một NPC ở trạm (Cô Tư mua gỗ, đá, thịt...).', goal: { kind: 'sell_npc' }, reward: 30 },
  { id: 'workbench', title: 'Bàn chế tạo', hint: 'Chế tạo và đặt một Bàn chế tạo. Nó mở khóa công trình và đồ bậc 1.', goal: { kind: 'place', structure: 'workbench' }, reward: 40 },
  { id: 'totem', title: 'Căn cứ đầu tiên', hint: 'Chế tạo Cột Lãnh Thổ ở bàn chế tạo và cắm nó xuống. Chỉ bạn mới mở được rương, cửa trong lãnh thổ.', goal: { kind: 'place', structure: 'totem' }, reward: 100 },
  { id: 'iron', title: 'Thời đại sắt', hint: 'Đào quặng sắt và than (vùng núi, tuyết), xây Lò nung và nung Thỏi sắt.', goal: { kind: 'craft', item: 'iron_ingot' }, reward: 60 },
  { id: 'ring1', title: 'Vùng Xám', hint: 'Đi xa hơn 1.000 ô từ tâm thế giới. Sương bắt đầu xuất hiện — cân nhắc đeo khẩu trang.', goal: { kind: 'reach_ring', ring: 1 }, reward: 80 },
  { id: 'market', title: 'Thương nhân', hint: 'Đặt một lệnh mua hoặc bán trên Sàn giao dịch ở trạm.', goal: { kind: 'market_order' }, reward: 50 },
  { id: 'hunter', title: 'Thợ săn', hint: 'Hạ 10 quái vật thù địch.', goal: { kind: 'kill', count: 10 }, reward: 80 },
  { id: 'blood', title: 'Đêm Sương Đỏ', hint: 'Vượt qua một Đêm Sương Đỏ (mỗi 7 ngày game) mà không chết.', goal: { kind: 'blood_night' }, reward: 200 },
  { id: 'ring3', title: 'Vùng Đỏ', hint: 'Đặt chân vào Vùng Đỏ (cách tâm hơn 3.000 ô). Ở đây PvP luôn bật!', goal: { kind: 'reach_ring', ring: 3 }, reward: 300 },
  { id: 'crystal', title: 'Tinh thể Sương', hint: 'Sở hữu 10 Tinh thể Sương (đào ở Rừng Sương, hạ Nhện Sương...).', goal: { kind: 'have', items: { mist_crystal: 10 } }, reward: 300 },
  { id: 'forge', title: 'Lò Tinh thể', hint: 'Dựng Lò Tinh thể ở căn cứ để chế đồ Sương và cường hóa trang bị.', goal: { kind: 'place', structure: 'crystal_forge' }, reward: 500 },
];
