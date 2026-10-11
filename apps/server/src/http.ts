import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { dayOf } from '@suongdo/shared';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Config } from './config.ts';
import type { Db } from './db.ts';
import type { Account, Game } from './game/game.ts';
import type { Player } from './game/player.ts';
import { parseMessage } from './net/dispatch.ts';
import { leaderboard } from './economy/services.ts';

const NAME_RE = /^[\p{L}\p{N}_]{3,16}$/u;
const SESSION_DAYS = 30;

// ───────────────────────── mật khẩu & phiên ─────────────────────────

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(pw: string, stored: string | null): boolean {
  if (!stored) return false;
  const [kind, saltHex, hashHex] = stored.split('$');
  if (kind !== 'scrypt' || !saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(hashHex, 'hex');
  return expected.length === hash.length && crypto.timingSafeEqual(expected, hash);
}

function newSession(db: Db, accountId: number): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  db.run('INSERT INTO sessions(token, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)', token, accountId, now, now + SESSION_DAYS * 86400_000);
  return token;
}

export function accountByToken(db: Db, token: string | null | undefined): Account | null {
  if (!token || token.length > 128) return null;
  return (
    db.get<Account>(
      'SELECT a.id, a.username, a.is_guest, a.playtime_sec FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token = ? AND s.expires_at > ? AND a.status = ?',
      token,
      Date.now(),
      'active',
    ) ?? null
  );
}

// ───────────────────────── tiện ích HTTP ─────────────────────────

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 16_384) throw new HttpError(413, 'Dữ liệu quá lớn.');
    chunks.push(c as Buffer);
  }
  if (chunks.length === 0) return {};
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    throw new HttpError(400, 'JSON không hợp lệ.');
  }
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  const s = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(s);
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

function serveStatic(cfg: Config, req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://x');
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || !path.extname(rel)) rel = '/index.html';
  const file = path.normalize(path.join(cfg.clientDist, rel));
  if (!file.startsWith(path.normalize(cfg.clientDist))) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      if (rel === '/index.html') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end('<h1>Sương Đỏ</h1><p>Client chưa được build. Chạy <code>npm run build</code> rồi khởi động lại, hoặc dùng <code>npm run dev</code>.</p>');
      } else res.writeHead(404).end();
      return;
    }
    const ext = path.extname(file);
    res.writeHead(200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'cache-control': rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    res.end(data);
  });
}

// ───────────────────────── giới hạn tần suất ─────────────────────────

const buckets = new Map<string, { n: number; reset: number }>();
function limit(ip: string, max: number, windowMs: number): void {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.reset < now) {
    buckets.set(ip, { n: 1, reset: now + windowMs });
    return;
  }
  b.n++;
  if (b.n > max) throw new HttpError(429, 'Bạn thao tác quá nhanh, hãy thử lại sau ít phút.');
}

function ipOf(req: http.IncomingMessage): string {
  return req.socket.remoteAddress ?? '?';
}

// ───────────────────────── API ─────────────────────────

async function api(cfg: Config, db: Db, game: Game, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://x');
  const p = url.pathname;
  const method = req.method ?? 'GET';
  const bearer = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');

  if (p === '/api/status' && method === 'GET') {
    const online = [...game.players.values()].filter((x) => x.ws).length;
    return send(res, 200, { ok: true, online, day: dayOf(game.time), realm: cfg.realmName, hardcore: cfg.hardcore });
  }
  if (p === '/api/leaderboard' && method === 'GET') {
    const kind = (url.searchParams.get('kind') ?? 'days') as 'days' | 'wealth' | 'ring' | 'blood' | 'hall';
    if (!['days', 'wealth', 'ring', 'blood', 'hall'].includes(kind)) throw new HttpError(400, 'Loại không hợp lệ.');
    return send(res, 200, { ok: true, rows: leaderboard(game, kind) });
  }
  if (p === '/api/guest' && method === 'POST') {
    limit(ipOf(req), 10, 60_000);
    let name = '';
    for (let i = 0; i < 20; i++) {
      name = `Khach${Math.floor(1000 + Math.random() * 99000)}`;
      if (!db.get('SELECT 1 FROM accounts WHERE username = ?', name) && !db.get('SELECT 1 FROM characters WHERE name = ?', name)) break;
    }
    const id = db.run('INSERT INTO accounts(username, pass_hash, is_guest, created_at) VALUES (?, NULL, 1, ?)', name, Date.now()).lastInsertRowid;
    return send(res, 200, { ok: true, token: newSession(db, id), username: name, guest: true });
  }
  if (p === '/api/register' && method === 'POST') {
    limit(ipOf(req), 10, 60_000);
    const body = await readJson(req);
    const username = String(body.username ?? '').trim();
    const password = String(body.password ?? '');
    if (!NAME_RE.test(username)) throw new HttpError(400, 'Tên 3–16 ký tự, chỉ gồm chữ, số và dấu gạch dưới.');
    if (password.length < 6 || password.length > 128) throw new HttpError(400, 'Mật khẩu cần ít nhất 6 ký tự.');
    if (db.get('SELECT 1 FROM accounts WHERE username = ?', username) || db.get('SELECT 1 FROM characters WHERE name = ?', username)) {
      throw new HttpError(409, 'Tên này đã có người dùng.');
    }
    const id = db.run('INSERT INTO accounts(username, pass_hash, is_guest, created_at) VALUES (?, ?, 0, ?)', username, hashPassword(password), Date.now()).lastInsertRowid;
    return send(res, 200, { ok: true, token: newSession(db, id), username, guest: false });
  }
  if (p === '/api/login' && method === 'POST') {
    limit(ipOf(req), 20, 60_000);
    const body = await readJson(req);
    const username = String(body.username ?? '').trim();
    const row = db.get<{ id: number; username: string; pass_hash: string | null; status: string }>(
      'SELECT id, username, pass_hash, status FROM accounts WHERE username = ? AND is_guest = 0',
      username,
    );
    if (!row || !verifyPassword(String(body.password ?? ''), row.pass_hash)) throw new HttpError(401, 'Sai tên đăng nhập hoặc mật khẩu.');
    if (row.status !== 'active') throw new HttpError(403, 'Tài khoản đã bị khóa.');
    return send(res, 200, { ok: true, token: newSession(db, row.id), username: row.username, guest: false });
  }
  if (p === '/api/upgrade' && method === 'POST') {
    limit(ipOf(req), 10, 60_000);
    const acc = accountByToken(db, bearer);
    if (!acc) throw new HttpError(401, 'Phiên đăng nhập hết hạn.');
    if (!acc.is_guest) throw new HttpError(400, 'Tài khoản đã được đăng ký.');
    const body = await readJson(req);
    const username = String(body.username ?? '').trim();
    const password = String(body.password ?? '');
    if (!NAME_RE.test(username)) throw new HttpError(400, 'Tên 3–16 ký tự, chỉ gồm chữ, số và dấu gạch dưới.');
    if (password.length < 6) throw new HttpError(400, 'Mật khẩu cần ít nhất 6 ký tự.');
    const taken = db.get<{ account_id: number }>('SELECT account_id FROM characters WHERE name = ?', username);
    if (db.get('SELECT 1 FROM accounts WHERE username = ? AND id != ?', username, acc.id) || (taken && taken.account_id !== acc.id)) {
      throw new HttpError(409, 'Tên này đã có người dùng.');
    }
    db.tx(() => {
      db.run('UPDATE accounts SET username = ?, pass_hash = ?, is_guest = 0 WHERE id = ?', username, hashPassword(password), acc.id);
      db.run('UPDATE characters SET name = ? WHERE account_id = ? AND alive = 1', username, acc.id);
    });
    // nếu đang online: cập nhật tên và trạng thái khách
    for (const pl of game.players.values()) {
      if (pl.accountId === acc.id) {
        pl.name = username;
        pl.guest = false;
        pl.ver++;
        pl.send({ t: 'welcome', me: { id: pl.charId, name: pl.name, guest: false }, seed: game.seed, world: game.worldInfo(), hardcore: cfg.hardcore, serverTime: Date.now() });
      }
    }
    game.territories.reload();
    return send(res, 200, { ok: true, username, guest: false });
  }
  if (p === '/api/me' && method === 'GET') {
    const acc = accountByToken(db, bearer);
    if (!acc) throw new HttpError(401, 'Phiên đăng nhập hết hạn.');
    return send(res, 200, { ok: true, username: acc.username, guest: !!acc.is_guest });
  }
  if (p === '/api/logout' && method === 'POST') {
    db.run('DELETE FROM sessions WHERE token = ?', bearer);
    return send(res, 200, { ok: true });
  }
  // ── quản trị ──
  if (p.startsWith('/api/admin/')) {
    const tok = String(req.headers['x-admin-token'] ?? '');
    if (!cfg.adminToken || tok.length !== cfg.adminToken.length || !crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(cfg.adminToken))) {
      throw new HttpError(403, 'Không có quyền.');
    }
    if (p === '/api/admin/economy' && method === 'GET') {
      const since = Date.now() - 86400_000;
      return send(res, 200, {
        ok: true,
        moneySupply: game.ledger.moneySupply(),
        audit: game.ledger.audit(),
        flows24h: game.ledger.flows(since),
        players: db.get<{ n: number }>('SELECT COUNT(*) AS n FROM characters WHERE alive = 1')!.n,
        openOrders: db.get<{ n: number }>("SELECT COUNT(*) AS n FROM market_orders WHERE status = 'open'")!.n,
        flags: game.flags,
      });
    }
    if (p === '/api/admin/flags' && method === 'POST') {
      const body = await readJson(req);
      for (const k of ['market', 'mail', 'trade', 'stall'] as const) if (typeof body[k] === 'boolean') game.flags[k] = body[k] as boolean;
      return send(res, 200, { ok: true, flags: game.flags });
    }
  }
  throw new HttpError(404, 'Không tìm thấy.');
}

// ───────────────────────── máy chủ ─────────────────────────

export function createServer(cfg: Config, db: Db, game: Game): http.Server {
  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';
    if (url.startsWith('/api/')) {
      api(cfg, db, game, req, res).catch((e: unknown) => {
        if (e instanceof HttpError) send(res, e.status, { ok: false, error: e.message });
        else {
          console.error('[http]', e);
          send(res, 500, { ok: false, error: 'Lỗi máy chủ.' });
        }
      });
      return;
    }
    serveStatic(cfg, req, res);
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }
    const acc = accountByToken(db, url.searchParams.get('token'));
    if (!acc) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    const online = [...game.players.values()].filter((x) => x.ws).length;
    if (online >= cfg.maxPlayers) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => onConnection(cfg, db, game, ws, acc));
  });
  return server;
}

function onConnection(cfg: Config, db: Db, game: Game, ws: WebSocket, acc: Account): void {
  let player: Player | null = null;
  try {
    player = game.join(ws, acc);
  } catch (e) {
    console.error('[join]', e);
    ws.close();
    return;
  }
  ws.on('message', (data) => {
    let raw: unknown;
    try {
      raw = JSON.parse(data.toString());
    } catch {
      return;
    }
    const msg = parseMessage(raw);
    if (!msg) return;
    if (!player) {
      // Hardcore: tạo nhân vật mới sau khi nhân vật cũ chết vĩnh viễn
      if (msg.t === 'newchar' && cfg.hardcore) {
        const name = msg.name.trim();
        if (!NAME_RE.test(name) || db.get('SELECT 1 FROM characters WHERE name = ?', name)) {
          ws.send(JSON.stringify({ t: 'note', text: 'Tên không hợp lệ hoặc đã có người dùng.', kind: 'bad' }));
          return;
        }
        game.createCharacter(acc.id, name);
        player = game.join(ws, acc);
      }
      return;
    }
    if (msg.t === 'newchar' && cfg.hardcore && !player.alive) {
      const name = msg.name.trim();
      if (!NAME_RE.test(name) || db.get('SELECT 1 FROM characters WHERE name = ?', name)) {
        player.send({ t: 'note', text: 'Tên không hợp lệ hoặc đã có người dùng.', kind: 'bad' });
        return;
      }
      const old = player;
      game.dropPlayer(old);
      game.createCharacter(acc.id, name);
      player = game.join(ws, acc);
      return;
    }
    game.handle(player, msg);
  });
  ws.on('close', () => {
    if (player && player.ws === ws) game.leave(player);
  });
  ws.on('error', () => ws.close());
}
