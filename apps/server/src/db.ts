import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT,
  is_guest INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  playtime_sec INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  data TEXT NOT NULL,
  alive INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_characters_account ON characters(account_id, alive);

CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  CHECK (owner_type = 'system' OR balance >= 0)
);

CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY,
  from_wallet TEXT NOT NULL,
  to_wallet TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  ref TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON ledger(created_at);

CREATE TABLE IF NOT EXISTS chunks (
  cx INTEGER NOT NULL,
  cy INTEGER NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (cx, cy)
);

CREATE TABLE IF NOT EXISTS world_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS system_market (
  item_id TEXT PRIMARY KEY,
  stock REAL NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS market_orders (
  id INTEGER PRIMARY KEY,
  char_id INTEGER NOT NULL,
  char_name TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  item_id TEXT NOT NULL,
  uniq INTEGER NOT NULL DEFAULT 0,
  stack TEXT,
  price INTEGER NOT NULL CHECK (price > 0),
  qty_total INTEGER NOT NULL CHECK (qty_total > 0),
  qty_remaining INTEGER NOT NULL CHECK (qty_remaining >= 0),
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_book ON market_orders(item_id, side, status, price);
CREATE INDEX IF NOT EXISTS idx_orders_char ON market_orders(char_id, status);

CREATE TABLE IF NOT EXISTS market_fills (
  id INTEGER PRIMARY KEY,
  item_id TEXT NOT NULL,
  price INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  buy_order INTEGER,
  sell_order INTEGER,
  buyer INTEGER NOT NULL,
  seller INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fills_item ON market_fills(item_id, created_at);

CREATE TABLE IF NOT EXISTS mail (
  id INTEGER PRIMARY KEY,
  to_char INTEGER NOT NULL,
  from_char INTEGER,
  from_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL DEFAULT '[]',
  xu INTEGER NOT NULL DEFAULT 0 CHECK (xu >= 0),
  cod INTEGER NOT NULL DEFAULT 0 CHECK (cod >= 0),
  kind TEXT NOT NULL DEFAULT 'player',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  claimed_at INTEGER,
  returned INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_mail_to ON mail(to_char, claimed_at);

CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY,
  a INTEGER NOT NULL,
  b INTEGER NOT NULL,
  a_offer TEXT NOT NULL,
  b_offer TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency (
  key TEXT PRIMARY KEY,
  char_id INTEGER NOT NULL,
  response TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS contracts_done (
  char_id INTEGER NOT NULL,
  day INTEGER NOT NULL,
  contract_id TEXT NOT NULL,
  PRIMARY KEY (char_id, day, contract_id)
);

CREATE TABLE IF NOT EXISTS territories (
  id INTEGER PRIMARY KEY,
  owner INTEGER NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  radius INTEGER NOT NULL,
  auth TEXT NOT NULL DEFAULT '[]',
  debt_days INTEGER NOT NULL DEFAULT 0,
  last_upkeep_day INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stalls (
  key TEXT PRIMARY KEY,
  owner INTEGER NOT NULL,
  items TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS hall_of_fame (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  days REAL NOT NULL,
  cause TEXT NOT NULL,
  died_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  char_id INTEGER,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;

/** Bọc SQLite đồng bộ: mọi thao tác trong transaction đều nguyên tử trên một luồng duy nhất. */
export class Db {
  readonly raw: DatabaseSync;
  private stmts = new Map<string, StatementSync>();
  private depth = 0;

  constructor(file: string) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.raw = new DatabaseSync(file);
    this.raw.exec(SCHEMA);
  }

  stmt(sql: string): StatementSync {
    let s = this.stmts.get(sql);
    if (!s) {
      s = this.raw.prepare(sql);
      this.stmts.set(sql, s);
    }
    return s;
  }

  run(sql: string, ...params: SqlParam[]): { changes: number; lastInsertRowid: number } {
    const r = this.stmt(sql).run(...params);
    return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
  }

  get<T = Record<string, unknown>>(sql: string, ...params: SqlParam[]): T | undefined {
    return this.stmt(sql).get(...params) as T | undefined;
  }

  all<T = Record<string, unknown>>(sql: string, ...params: SqlParam[]): T[] {
    return this.stmt(sql).all(...params) as T[];
  }

  /** Chạy fn trong transaction. Lồng nhau dùng SAVEPOINT. Ném lỗi ⇒ hoàn tác. */
  tx<T>(fn: () => T): T {
    const sp = `sp${this.depth}`;
    if (this.depth === 0) this.raw.exec('BEGIN IMMEDIATE');
    else this.raw.exec(`SAVEPOINT ${sp}`);
    this.depth++;
    try {
      const r = fn();
      this.depth--;
      if (this.depth === 0) this.raw.exec('COMMIT');
      else this.raw.exec(`RELEASE ${sp}`);
      return r;
    } catch (e) {
      this.depth--;
      if (this.depth === 0) this.raw.exec('ROLLBACK');
      else this.raw.exec(`ROLLBACK TO ${sp}; RELEASE ${sp}`);
      throw e;
    }
  }

  get inTx(): boolean {
    return this.depth > 0;
  }

  getMeta(key: string): string | undefined {
    return this.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', key)?.value;
  }

  setMeta(key: string, value: string): void {
    this.run('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
  }

  getState<T>(key: string): T | undefined {
    const v = this.get<{ value: string }>('SELECT value FROM world_state WHERE key = ?', key)?.value;
    return v === undefined ? undefined : (JSON.parse(v) as T);
  }

  setState(key: string, value: unknown): void {
    this.run(
      'INSERT INTO world_state(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      JSON.stringify(value),
    );
  }

  close(): void {
    this.raw.close();
  }
}

export type SqlParam = string | number | bigint | null | Uint8Array;

/** Lỗi nghiệp vụ hiển thị được cho người chơi. */
export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameError';
  }
}
