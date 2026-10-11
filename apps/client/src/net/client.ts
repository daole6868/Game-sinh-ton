import type { C2S, ReqArgs, ReqOp, ReqRes, S2C } from '@suongdo/shared';
import { getWorld, initWorld } from '../game/world';
import { note, pushChat, useStore } from '../state/store';

type Handler<T extends S2C['t']> = (msg: Extract<S2C, { t: T }>) => void;

export class ReqError extends Error {
  readonly confirm: boolean;
  constructor(message: string) {
    const confirm = message.startsWith('CONFIRM:');
    super(confirm ? message.slice(8) : message);
    this.confirm = confirm;
  }
}

/** Kết nối WebSocket tới máy chủ game. */
class Net {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<(m: S2C) => void>>();
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: number }>();
  private rid = 1;
  private token = '';
  private closedByUser = false;
  private retry = 0;
  latency = 0;

  on<T extends S2C['t']>(t: T, fn: Handler<T>): () => void {
    let set = this.handlers.get(t);
    if (!set) {
      set = new Set();
      this.handlers.set(t, set);
    }
    set.add(fn as (m: S2C) => void);
    return () => set!.delete(fn as (m: S2C) => void);
  }

  connect(token: string): void {
    this.token = token;
    this.closedByUser = false;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      useStore.setState({ connected: true, connError: null });
    };
    ws.onmessage = (ev) => {
      let msg: S2C;
      try {
        msg = JSON.parse(ev.data as string) as S2C;
      } catch {
        return;
      }
      this.handle(msg);
    };
    ws.onclose = (ev) => {
      useStore.setState({ connected: false });
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(new ReqError('Mất kết nối.'));
      }
      this.pending.clear();
      if (this.closedByUser) return;
      if (ev.code === 1006 && this.retry > 3) useStore.setState({ connError: 'Không kết nối được máy chủ.' });
      const wait = Math.min(10_000, 1000 * 2 ** this.retry++);
      setTimeout(() => {
        if (!this.closedByUser && this.ws === ws) this.connect(this.token);
      }, wait);
    };
  }

  close(): void {
    this.closedByUser = true;
    this.ws?.close();
    this.ws = null;
  }

  get open(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  send(msg: C2S): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  /** Gửi yêu cầu và chờ phản hồi. */
  req<K extends ReqOp>(op: K, a: ReqArgs<K>, timeoutMs = 10_000): Promise<ReqRes<K>> {
    return new Promise((resolve, reject) => {
      if (!this.open) {
        reject(new ReqError('Chưa kết nối máy chủ.'));
        return;
      }
      const rid = this.rid++;
      const timer = window.setTimeout(() => {
        this.pending.delete(rid);
        reject(new ReqError('Máy chủ không phản hồi.'));
      }, timeoutMs);
      this.pending.set(rid, { resolve: resolve as (v: unknown) => void, reject, timer });
      this.send({ t: 'req', rid, op, a });
    });
  }

  private handle(msg: S2C): void {
    const st = useStore.getState();
    switch (msg.t) {
      case 'welcome': {
        const w = initWorld(msg.seed);
        w.myChar = msg.me.id;
        useStore.setState({ me: msg.me, seed: msg.seed, hardcore: msg.hardcore, worldTime: msg.world.wt, weather: msg.world.weather, dead: null });
        break;
      }
      case 'ch':
        getWorld()?.applyChunk(msg);
        break;
      case 'cu':
        getWorld()?.applyTile(msg);
        break;
      case 'res': {
        const p = this.pending.get(msg.rid);
        if (p) {
          clearTimeout(p.timer);
          this.pending.delete(msg.rid);
          if (msg.ok) p.resolve(msg.d);
          else p.reject(new ReqError(msg.err ?? 'Lỗi.'));
        }
        break;
      }
      case 'inv':
        useStore.setState({ inv: msg.inv, eq: msg.eq, reserved: msg.reserved });
        break;
      case 'wallet':
        useStore.setState({ xu: msg.xu });
        break;
      case 'skills':
        useStore.setState({ skills: msg.s });
        break;
      case 'quest':
        useStore.setState({ quest: msg.q });
        break;
      case 'stats':
        useStore.setState({ stats: msg.d });
        break;
      case 'chat':
        pushChat({ ch: msg.ch, from: msg.from, text: msg.text, ts: msg.ts });
        break;
      case 'note':
        note(msg.text, msg.kind ?? 'info');
        break;
      case 'cont':
        useStore.setState({ container: msg.c });
        break;
      case 'trade':
        useStore.setState({ trade: msg.v });
        break;
      case 'trade_invite':
        useStore.setState({ tradeInvite: msg.from });
        break;
      case 'dead':
        useStore.setState({ dead: { cause: msg.cause, bed: msg.bed, hardcore: msg.hardcore, days: msg.days }, window: null, container: null });
        break;
      case 'alive':
        useStore.setState({ dead: null });
        break;
      case 'terr': {
        const w = getWorld();
        if (w) w.view.territories = msg.l;
        useStore.setState({ territories: msg.l });
        break;
      }
      case 'world':
        useStore.setState({ weather: msg.w.weather });
        break;
      case 'mail':
        if (msg.unread > st.mailUnread) note(`Bạn có ${msg.unread} thư chưa nhận (Thủ kho ở trạm).`, 'info');
        useStore.setState({ mailUnread: msg.unread });
        break;
      case 'disc':
        useStore.setState({ discovered: msg.l });
        break;
      case 'kick':
        note(msg.reason, 'bad');
        this.closedByUser = true;
        useStore.setState({ connError: msg.reason });
        break;
      default:
        break;
    }
    const set = this.handlers.get(msg.t);
    if (set) for (const fn of set) fn(msg);
  }
}

export const net = new Net();

/** Gửi yêu cầu, hiển thị lỗi thành thông báo. Trả về null nếu lỗi. */
export async function call<K extends ReqOp>(op: K, a: ReqArgs<K>): Promise<ReqRes<K> | null> {
  try {
    return await net.req(op, a);
  } catch (e) {
    note((e as Error).message, 'bad');
    return null;
  }
}

export function newKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ───────────────────────── HTTP ─────────────────────────

export async function api<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({ ok: false, error: 'Máy chủ không phản hồi.' }))) as { ok: boolean; error?: string } & T;
  if (!res.ok || !j.ok) throw new Error(j.error ?? `Lỗi ${res.status}`);
  return j;
}
