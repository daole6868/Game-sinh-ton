import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '../../..');

function envInt(name: string, def: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function envBool(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  return v === '1' || v.toLowerCase() === 'true';
}

export interface Config {
  port: number;
  host: string;
  dbPath: string;
  /** seed của thế giới (chỉ dùng khi tạo thế giới mới) */
  seed: number;
  hardcore: boolean;
  realmName: string;
  adminToken: string;
  /** số phút chơi tối thiểu trước khi dùng sàn và hòm thư */
  tradeMinPlaytimeMin: number;
  /** tốc độ thời gian (1 = bình thường) — chỉ để thử nghiệm */
  timeScale: number;
  clientDist: string;
  maxPlayers: number;
  saveIntervalSec: number;
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  const hardcore = envBool('HARDCORE', false);
  return {
    port: envInt('PORT', 8787),
    host: process.env.HOST ?? '0.0.0.0',
    dbPath: process.env.DB_PATH ?? path.join(ROOT, 'data', hardcore ? 'hardcore.db' : 'world.db'),
    seed: envInt('SEED', Math.floor(Math.random() * 2 ** 31)),
    hardcore,
    realmName: process.env.REALM_NAME ?? (hardcore ? 'Hardcore' : 'Sinh Tồn Vô Hạn'),
    adminToken: process.env.ADMIN_TOKEN ?? '',
    tradeMinPlaytimeMin: envInt('TRADE_MIN_PLAYTIME_MIN', 30),
    timeScale: envInt('TIME_SCALE', 1),
    clientDist: process.env.CLIENT_DIST ?? path.join(ROOT, 'apps', 'client', 'dist'),
    maxPlayers: envInt('MAX_PLAYERS', 200),
    saveIntervalSec: envInt('SAVE_INTERVAL_SEC', 10),
    ...overrides,
  };
}
