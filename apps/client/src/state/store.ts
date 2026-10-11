import type {
  ChatChannel,
  ContainerView,
  Equipment,
  MeSnap,
  NpcRole,
  QuestState,
  SkillId,
  SkillState,
  Slot,
  TerritoryInfo,
  TradeView,
  WeatherKind,
} from '@suongdo/shared';
import { create } from 'zustand';

export interface ChatLine {
  id: number;
  ch: ChatChannel;
  from: string;
  text: string;
  ts: number;
}

export interface Note {
  id: number;
  text: string;
  kind: 'info' | 'good' | 'bad' | 'warn';
  at: number;
}

export type WindowState =
  | { kind: 'inventory'; tab: 'craft' | 'skills' | 'quests' }
  | { kind: 'shop'; outpost: string; role: NpcRole }
  | { kind: 'market'; outpost: string }
  | { kind: 'keeper'; outpost: string }
  | { kind: 'contracts'; outpost: string }
  | { kind: 'travel'; outpost: string }
  | { kind: 'totem'; tx: number; ty: number }
  | { kind: 'stall'; tx: number; ty: number }
  | { kind: 'forge'; tx: number; ty: number }
  | { kind: 'map' }
  | { kind: 'leaderboard' }
  | { kind: 'help' }
  | { kind: 'account' };

export interface Auth {
  token: string;
  username: string;
  guest: boolean;
}

export interface Dead {
  cause: string;
  bed: boolean;
  hardcore: boolean;
  days: number;
}

export interface PlayerStatsView {
  days: number;
  maxRing: number;
  blood: number;
  rep: number;
  kills: number;
}

export interface Confirm {
  text: string;
  ok: () => void;
  okLabel?: string;
}

export interface UIState {
  auth: Auth | null;
  connected: boolean;
  connError: string | null;
  me: { id: number; name: string; guest: boolean } | null;
  seed: number;
  hardcore: boolean;
  snap: MeSnap | null;
  worldTime: number;
  weather: WeatherKind;
  inv: Slot[];
  eq: Equipment;
  reserved: number[];
  sel: number;
  xu: number;
  skills: Record<SkillId, SkillState> | null;
  quest: QuestState;
  stats: PlayerStatsView;
  chat: ChatLine[];
  notes: Note[];
  container: ContainerView | null;
  trade: TradeView | null;
  tradeInvite: { id: number; name: string } | null;
  dead: Dead | null;
  territories: TerritoryInfo[];
  discovered: string[];
  mailUnread: number;
  window: WindowState | null;
  demolish: boolean;
  prompt: string | null;
  chatOpen: boolean;
  confirm: Confirm | null;
  /** trạm đang đứng gần (để mở các cửa sổ NPC) */
  outpost: { id: string; name: string } | null;
  zone: { ring: number; name: string; color: string; biome: string; x: number; y: number };
  fps: number;
  set: (p: Partial<UIState>) => void;
}

let noteId = 1;
let chatId = 1;

export const useStore = create<UIState>((set) => ({
  auth: null,
  connected: false,
  connError: null,
  me: null,
  seed: 0,
  hardcore: false,
  snap: null,
  worldTime: 0,
  weather: 'clear',
  inv: [],
  eq: { head: null, body: null, mask: null },
  reserved: [],
  sel: 0,
  xu: 0,
  skills: null,
  quest: { idx: 0 },
  stats: { days: 0, maxRing: 0, blood: 0, rep: 0, kills: 0 },
  chat: [],
  notes: [],
  container: null,
  trade: null,
  tradeInvite: null,
  dead: null,
  territories: [],
  discovered: [],
  mailUnread: 0,
  window: null,
  demolish: false,
  prompt: null,
  chatOpen: false,
  confirm: null,
  outpost: null,
  zone: { ring: 0, name: 'Vùng Rìa', color: '#8fd18b', biome: '', x: 0, y: 0 },
  fps: 0,
  set: (p) => set(p),
}));

export function note(text: string, kind: Note['kind'] = 'info'): void {
  const n: Note = { id: noteId++, text, kind, at: Date.now() };
  useStore.setState((s) => ({ notes: [...s.notes.slice(-5), n] }));
  setTimeout(() => useStore.setState((s) => ({ notes: s.notes.filter((x) => x.id !== n.id) })), kind === 'bad' || kind === 'warn' ? 6000 : 4500);
}

export function pushChat(line: Omit<ChatLine, 'id'>): void {
  useStore.setState((s) => ({ chat: [...s.chat.slice(-120), { ...line, id: chatId++ }] }));
}

export function openWindow(w: WindowState | null): void {
  useStore.setState({ window: w });
}

export function askConfirm(text: string, ok: () => void, okLabel?: string): void {
  useStore.setState({ confirm: { text, ok, okLabel } });
}

const AUTH_KEY = 'suongdo.auth';

export function loadAuth(): Auth | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as Auth) : null;
  } catch {
    return null;
  }
}

export function saveAuth(a: Auth | null): void {
  try {
    if (a) localStorage.setItem(AUTH_KEY, JSON.stringify(a));
    else localStorage.removeItem(AUTH_KEY);
  } catch {
    /* bỏ qua */
  }
}
