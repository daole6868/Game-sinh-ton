import type { NpcRole } from './data/npcs.ts';
import type { MoveInput } from './movement.ts';
import type { Equipment, EquipSlot, ItemStack, SkillId, SkillState, Slot, StatusId, WeatherKind } from './types.ts';
import type { StructPublic, TerritoryInfo } from './world.ts';

// ───────────────────────── Client → Server ─────────────────────────

export type ContainerKind = 'inv' | 'eq' | 'cont';

export interface SlotRef {
  c: ContainerKind;
  /** chỉ số ô, hoặc tên ô trang bị */
  i: number | EquipSlot;
}

export type ChatChannel = 'local' | 'global' | 'trade' | 'whisper' | 'system';

export type C2S =
  | { t: 'in'; i: MoveInput[] }
  | { t: 'sel'; s: number }
  /** hành động chính (chuột trái) nhắm vào vị trí thế giới (đơn vị ô) */
  | { t: 'act'; x: number; y: number }
  /** dùng/ăn/trang bị vật phẩm ở ô túi (chuột phải) */
  | { t: 'use'; i: number }
  | { t: 'mv'; from: SlotRef; to: SlotRef; n?: number }
  | { t: 'drop'; i: number; n?: number }
  | { t: 'craft'; r: string; n: number }
  | { t: 'place'; i: number; tx: number; ty: number }
  | { t: 'demolish'; tx: number; ty: number }
  /** tương tác với công trình (mở rương, đặt điểm hồi sinh, thu hoạch...) */
  | { t: 'ustruct'; tx: number; ty: number }
  | { t: 'pickup'; id: number }
  | { t: 'close' }
  | { t: 'chat'; ch: ChatChannel; text: string }
  | { t: 'respawn'; at: 'bed' | 'outpost' | 'random' }
  | { t: 'newchar'; name: string }
  | { t: 'pvp'; on: boolean }
  | { t: 'req'; rid: number; op: ReqOp; a: unknown };

// ───────────────────────── Server → Client ─────────────────────────

export interface MeSnap {
  x: number;
  y: number;
  dT: number;
  dC: number;
  hp: number;
  mhp: number;
  hu: number;
  th: number;
  st: number;
  bt: number;
  mi: number;
  fx: StatusId[];
  sm: number;
  cr: boolean;
  cd: boolean;
  sel: number;
  pvp: boolean;
  w: number;
  alive: boolean;
  /** độ ấm cảm nhận (°C) */
  amb: number;
}

export type EntKind = 'p' | 'm' | 'i' | 'b';

export interface EntFull {
  i: number;
  k: EntKind;
  x: number;
  y: number;
  /** góc nhìn */
  a?: number;
  /** máu theo % */
  h?: number;
  /** trạng thái */
  s?: number;
  /** tên (người chơi, chủ túi) */
  n?: string;
  /** id quái */
  m?: string;
  /** cấp quái */
  l?: number;
  /** id vật phẩm (vật phẩm rơi, đồ cầm trên tay) */
  it?: string;
  q?: number;
  /** cờ PvP */
  pv?: boolean;
  /** id nhân vật (người chơi) */
  c?: number;
}

/** Cập nhật gọn: [id, x*100, y*100, góc*100, máu%, trạng thái] */
export type EntUpd = [number, number, number, number, number, number];

export type Fx =
  | { k: 'hit'; x: number; y: number; v: number; c?: 'p' | 'm' | 'heal' | 'crit' | 'struct' }
  | { k: 'swing'; i: number; a: number }
  | { k: 'shot'; x: number; y: number; a: number; sp: number; r: number; am: string }
  | { k: 'boom'; x: number; y: number; r: number }
  | { k: 'slam'; x: number; y: number; r: number }
  | { k: 'gather'; tx: number; ty: number }
  | { k: 'die'; i: number }
  | { k: 'lvl'; s: SkillId; lv: number }
  | { k: 'snd'; s: string; x: number; y: number };

export interface WorldInfo {
  wt: number;
  weather: WeatherKind;
  /** giây thực còn lại của thời tiết hiện tại */
  wLeft: number;
}

export interface ContainerView {
  id: string;
  title: string;
  kind: 'chest' | 'bag' | 'safe';
  slots: Slot[];
}

export interface TradeOfferView {
  /** các ô túi được đưa vào và số lượng */
  slots: { i: number; n: number }[];
  items: ItemStack[];
  xu: number;
  /** giá trị tham khảo (Xu) */
  value: number;
}

export interface TradeView {
  id: number;
  other: { id: number; name: string };
  mine: TradeOfferView;
  theirs: TradeOfferView;
  myLock: boolean;
  theirLock: boolean;
  myConfirm: boolean;
  theirConfirm: boolean;
  /** thời điểm (ms) được phép bấm xác nhận */
  confirmAt: number;
}

export interface QuestState {
  idx: number;
  progress?: string;
}

export type S2C =
  | {
      t: 'welcome';
      me: { id: number; name: string; guest: boolean; eid: number };
      seed: number;
      world: WorldInfo;
      hardcore: boolean;
      serverTime: number;
    }
  | { t: 's'; wt: number; ack: number; me: MeSnap; n: EntFull[]; u: EntUpd[]; x: number[] }
  | { t: 'ch'; cx: number; cy: number; rm: [number, number][]; st: [number, StructPublic][] }
  | { t: 'cu'; tx: number; ty: number; rm?: number | null; st?: StructPublic | null }
  | { t: 'inv'; inv: Slot[]; eq: Equipment; reserved: number[] }
  | { t: 'cont'; c: ContainerView | null }
  | { t: 'chat'; ch: ChatChannel; from: string; text: string; ts: number }
  | { t: 'fx'; l: Fx[] }
  | { t: 'res'; rid: number; ok: boolean; err?: string; d?: unknown }
  | { t: 'note'; text: string; kind?: 'info' | 'good' | 'bad' | 'warn' }
  | { t: 'wallet'; xu: number }
  | { t: 'skills'; s: Record<SkillId, SkillState> }
  | { t: 'quest'; q: QuestState }
  | { t: 'dead'; cause: string; bed: boolean; hardcore: boolean; days: number }
  | { t: 'alive' }
  | { t: 'trade'; v: TradeView | null }
  | { t: 'trade_invite'; from: { id: number; name: string } }
  | { t: 'terr'; l: TerritoryInfo[] }
  | { t: 'world'; w: WorldInfo }
  | { t: 'mail'; unread: number }
  | { t: 'disc'; l: string[] }
  | { t: 'stats'; d: { days: number; maxRing: number; blood: number; rep: number; kills: number } }
  | { t: 'kick'; reason: string };

// ───────────────────────── Yêu cầu / phản hồi ─────────────────────────

export interface ShopItemView {
  id: string;
  /** giá NPC bán (người chơi mua) */
  sell?: number;
  /** giá NPC mua (người chơi bán) */
  buy?: number;
  stock: number;
  target: number;
}

export interface ShopView {
  role: NpcRole;
  items: ShopItemView[];
  capLeft: number;
  cap: number;
}

export interface OrderView {
  id: number;
  side: 'buy' | 'sell';
  item: string;
  price: number;
  qty: number;
  total: number;
  owner: string;
  mine: boolean;
  unique?: ItemStack;
  created: number;
  expires: number;
}

export interface BookView {
  item: string;
  sells: { price: number; qty: number }[];
  buys: { price: number; qty: number }[];
  last: number | null;
  avg24: number | null;
  avg7: number | null;
  sys: { sell: number | null; buy: number | null };
  history: { day: string; avg: number; vol: number }[];
  listings: OrderView[];
}

export interface MarketSummary {
  item: string;
  bestSell: number | null;
  bestBuy: number | null;
  sellQty: number;
  buyQty: number;
  last: number | null;
}

export interface MailView {
  id: number;
  from: string;
  subject: string;
  body: string;
  items: ItemStack[];
  xu: number;
  cod: number;
  created: number;
  expires: number;
}

export interface ContractView {
  id: string;
  item: string;
  qty: number;
  reward: number;
  rep: number;
  done: boolean;
}

export interface TravelView {
  id: string;
  name: string;
  x: number;
  y: number;
  ring: number;
  fee: number;
  here: boolean;
}

export interface StallView {
  key: string;
  owner: string;
  mine: boolean;
  items: { slot: number; stack: ItemStack; price: number }[];
}

export interface LeaderRow {
  name: string;
  value: number;
  alive?: boolean;
}

export interface ReqMap {
  shop: { a: { outpost: string; role: NpcRole }; r: ShopView };
  shop_buy: { a: { outpost: string; role: NpcRole; item: string; qty: number }; r: { paid: number } };
  shop_sell: { a: { outpost: string; role: NpcRole; item: string; qty: number }; r: { got: number } };
  market_summary: { a: { outpost: string }; r: MarketSummary[] };
  market_book: { a: { outpost: string; item: string }; r: BookView };
  market_my: { a: { outpost: string }; r: OrderView[] };
  market_sell: { a: { outpost: string; slot: number; qty: number; price: number; confirm?: boolean; key: string }; r: { order: number | null; filled: number } };
  market_buy: { a: { outpost: string; item: string; qty: number; price: number; confirm?: boolean; key: string }; r: { order: number | null; filled: number } };
  market_buy_unique: { a: { outpost: string; order: number; key: string }; r: { ok: true } };
  market_cancel: { a: { outpost: string; order: number }; r: { ok: true } };
  mail_list: { a: { outpost: string }; r: MailView[] };
  mail_claim: { a: { outpost: string; id: number }; r: { ok: true } };
  mail_return: { a: { outpost: string; id: number }; r: { ok: true } };
  mail_send: {
    a: { outpost: string; to: string; subject: string; body: string; slots: { i: number; n: number }[]; xu: number; cod: number; key: string };
    r: { fee: number };
  };
  contracts: { a: { outpost: string }; r: { day: number; list: ContractView[]; rep: number } };
  contract_deliver: { a: { outpost: string; id: string }; r: { reward: number } };
  travel_list: { a: { outpost: string }; r: TravelView[] };
  travel: { a: { outpost: string; to: string }; r: { fee: number } };
  repair_quote: { a: { outpost: string; slot: number | EquipSlot }; r: { cost: number } };
  repair: { a: { outpost: string; slot: number | EquipSlot }; r: { cost: number } };
  upgrade: { a: { tx: number; ty: number; slot: number }; r: { lv: number; cost: number } };
  safe_open: { a: { outpost: string }; r: { unlocked: boolean; price: number } };
  safe_unlock: { a: { outpost: string }; r: { ok: true } };
  stall_view: { a: { tx: number; ty: number }; r: StallView };
  stall_put: { a: { tx: number; ty: number; slot: number; qty: number; price: number }; r: { ok: true } };
  stall_take: { a: { tx: number; ty: number; slot: number }; r: { ok: true } };
  stall_buy: { a: { tx: number; ty: number; slot: number; key: string }; r: { ok: true } };
  totem_info: { a: { tx: number; ty: number }; r: { territory: TerritoryInfo; authNames: { id: number; name: string }[]; upkeep: number; debt: number; structures: number } };
  totem_auth: { a: { tx: number; ty: number; name: string; add: boolean }; r: { ok: true } };
  fuel: { a: { tx: number; ty: number; item: string }; r: { until: number } };
  trade_invite: { a: { target: number }; r: { ok: true } };
  trade_respond: { a: { from: number; accept: boolean }; r: { ok: true } };
  trade_offer: { a: { slots: { i: number; n: number }[]; xu: number }; r: { ok: true } };
  trade_lock: { a: { lock: boolean }; r: { ok: true } };
  trade_confirm: { a: Record<string, never>; r: { ok: true } };
  trade_cancel: { a: Record<string, never>; r: { ok: true } };
  leaderboard: { a: { kind: 'days' | 'wealth' | 'ring' | 'blood' | 'hall' }; r: LeaderRow[] };
  price_ref: { a: { items: string[] }; r: Record<string, number> };
  player_name: { a: { id: number }; r: { name: string } };
}

export type ReqOp = keyof ReqMap;
export type ReqArgs<K extends ReqOp> = ReqMap[K]['a'];
export type ReqRes<K extends ReqOp> = ReqMap[K]['r'];
