import {
  addStack,
  canAddAll,
  type ItemStack,
  ITEMS,
  MAIL_COD_HOURS,
  MAIL_FEE_PER_STACK,
  MAIL_KEEP_DAYS,
  type MailView,
  takeFromSlot,
} from '@suongdo/shared';
import { GameError } from '../db.ts';
import type { Game } from '../game/game.ts';
import type { Player } from '../game/player.ts';
import { questEvent } from '../game/quests.ts';
import { charWallet, SYS } from './ledger.ts';

interface MailRow {
  id: number;
  to_char: number;
  from_char: number | null;
  from_name: string;
  subject: string;
  body: string;
  items: string;
  xu: number;
  cod: number;
  kind: string;
  created_at: number;
  expires_at: number;
  claimed_at: number | null;
  returned: number;
}

/** Hòm thư: nhận hàng mua trên sàn, phần thưởng, và gửi đồ/Xu giữa người chơi (có thu tiền khi nhận). */
export class Mail {
  constructor(private game: Game) {}

  /** Gửi thư hệ thống. Nếu xu > 0 thì Xu phải đã nằm sẵn trong ví sys:mail. Phải gọi trong transaction. */
  sendSystem(toChar: number, subject: string, body: string, items: ItemStack[], xu: number, kind = 'system', fromName = 'Hệ thống', fromChar: number | null = null, cod = 0, keepMs = MAIL_KEEP_DAYS * 86400_000): number {
    const now = Date.now();
    return this.game.db.run(
      'INSERT INTO mail(to_char, from_char, from_name, subject, body, items, xu, cod, kind, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      toChar,
      fromChar,
      fromName,
      subject.slice(0, 80),
      body.slice(0, 500),
      JSON.stringify(items),
      xu,
      cod,
      kind,
      now,
      now + keepMs,
    ).lastInsertRowid;
  }

  unreadCount(charId: number): number {
    return this.game.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM mail WHERE to_char = ? AND claimed_at IS NULL', charId)!.n;
  }

  list(p: Player, outpost: string): MailView[] {
    this.game.requireAtOutpost(p, outpost);
    return this.game.db
      .all<MailRow>('SELECT * FROM mail WHERE to_char = ? AND claimed_at IS NULL ORDER BY id DESC LIMIT 100', p.charId)
      .map((r) => ({
        id: r.id,
        from: r.from_name,
        subject: r.subject,
        body: r.body,
        items: JSON.parse(r.items) as ItemStack[],
        xu: r.xu,
        cod: r.cod,
        created: r.created_at,
        expires: r.expires_at,
      }));
  }

  claim(p: Player, outpost: string, id: number): { ok: true } {
    this.game.requireAtOutpost(p, outpost);
    const m = this.game.db.get<MailRow>('SELECT * FROM mail WHERE id = ? AND to_char = ? AND claimed_at IS NULL', id, p.charId);
    if (!m) throw new GameError('Không tìm thấy thư.');
    const items = JSON.parse(m.items) as ItemStack[];
    if (!canAddAll(p.inv, items)) throw new GameError('Túi đồ không đủ chỗ để nhận.');
    if (m.cod > 0 && p.xu < m.cod) throw new GameError(`Cần trả ${m.cod} Xu để nhận hàng.`);
    this.game.atomic([p], () => {
      if (m.cod > 0) {
        if (m.from_char === null) throw new GameError('Thư không hợp lệ.');
        this.game.ledger.transfer(charWallet(p.charId), charWallet(m.from_char), m.cod, 'mail_cod', `mail#${m.id}`);
      }
      if (m.xu > 0) this.game.ledger.transfer(SYS.mail, charWallet(p.charId), m.xu, 'mail_claim', `mail#${m.id}`);
      for (const s of items) addStack(p.inv, s);
      const r = this.game.db.run('UPDATE mail SET claimed_at = ? WHERE id = ? AND claimed_at IS NULL', Date.now(), m.id);
      if (r.changes !== 1) throw new GameError('Thư đã được nhận.');
    });
    this.game.refreshWallet(p);
    p.send({ t: 'mail', unread: this.unreadCount(p.charId) });
    if (m.cod > 0 && m.from_char !== null) {
      const sender = this.game.byChar.get(m.from_char);
      if (sender) {
        this.game.refreshWallet(sender);
        this.game.note(sender, `${p.name} đã nhận hàng và trả ${m.cod} Xu cho bạn.`, 'good');
      }
    }
    questEvent(this.game, p, { kind: 'have' });
    return { ok: true };
  }

  /** Trả thư về người gửi (từ chối hàng thu tiền khi nhận). */
  returnMail(p: Player, outpost: string, id: number): { ok: true } {
    this.game.requireAtOutpost(p, outpost);
    const m = this.game.db.get<MailRow>('SELECT * FROM mail WHERE id = ? AND to_char = ? AND claimed_at IS NULL', id, p.charId);
    if (!m) throw new GameError('Không tìm thấy thư.');
    if (m.from_char === null || m.returned) throw new GameError('Thư hệ thống không trả lại được.');
    this.game.atomic([p], () => this.bounce(m));
    p.send({ t: 'mail', unread: this.unreadCount(p.charId) });
    return { ok: true };
  }

  private bounce(m: MailRow): void {
    this.game.db.run('UPDATE mail SET claimed_at = ?, returned = 1 WHERE id = ?', Date.now(), m.id);
    this.sendSystem(m.from_char!, `Thư bị trả lại: ${m.subject}`, `Người nhận không lấy hàng.`, JSON.parse(m.items) as ItemStack[], m.xu, 'return', 'Hòm thư', null);
    const sender = this.game.byChar.get(m.from_char!);
    if (sender) sender.send({ t: 'mail', unread: this.unreadCount(sender.charId) });
  }

  send(
    p: Player,
    a: { outpost: string; to: string; subject: string; body: string; slots: { i: number; n: number }[]; xu: number; cod: number; key: string },
  ): { fee: number } {
    return this.game.idempotent(p, a.key, () => {
      if (!this.game.flags.mail) throw new GameError('Hòm thư đang tạm dừng.');
      this.game.requireAtOutpost(p, a.outpost);
      this.game.requireTradeUnlocked(p);
      const to = this.game.charIdByName(a.to.trim());
      if (!to) throw new GameError('Không tìm thấy người nhận.');
      if (to.id === p.charId) throw new GameError('Không thể gửi cho chính mình.');
      const xu = Math.floor(a.xu);
      const cod = Math.floor(a.cod);
      if (!(xu >= 0) || !(cod >= 0) || xu > 100_000_000 || cod > 100_000_000) throw new GameError('Số Xu không hợp lệ.');
      const slots = a.slots.slice(0, 12);
      const seen = new Set<number>();
      for (const s of slots) {
        const it = p.inv[s.i];
        if (!it || seen.has(s.i) || p.reserved.has(s.i) || !Number.isInteger(s.n) || s.n < 1 || s.n > it.n) throw new GameError('Vật phẩm không hợp lệ.');
        if (ITEMS[it.id]?.bound) throw new GameError(`${ITEMS[it.id]?.name} không gửi được.`);
        seen.add(s.i);
      }
      if (slots.length === 0 && xu === 0) throw new GameError('Thư trống.');
      if (cod > 0 && slots.length === 0) throw new GameError('Thu tiền khi nhận chỉ dùng khi gửi kèm hàng.');
      const fee = MAIL_FEE_PER_STACK * Math.max(1, slots.length) + (xu > 0 ? Math.ceil(xu * 0.01) : 0);
      if (p.xu < xu + fee) throw new GameError(`Cần ${xu + fee} Xu (gồm ${fee} Xu cước).`);
      this.game.atomic([p], () => {
        const items: ItemStack[] = [];
        for (const s of slots) items.push(takeFromSlot(p.inv, s.i, s.n)!);
        this.game.ledger.transfer(charWallet(p.charId), SYS.services, fee, 'mail_fee', a.to);
        if (xu > 0) this.game.ledger.transfer(charWallet(p.charId), SYS.mail, xu, 'mail_send', a.to);
        const keep = cod > 0 ? MAIL_COD_HOURS * 3600_000 : undefined;
        this.sendSystem(to.id, a.subject.trim() || '(không tiêu đề)', a.body ?? '', items, xu, 'player', p.name, p.charId, cod, keep);
      });
      this.game.refreshWallet(p);
      const target = this.game.byChar.get(to.id);
      if (target) {
        target.send({ t: 'mail', unread: this.unreadCount(to.id) });
        this.game.note(target, `Bạn có thư mới từ ${p.name}${cod > 0 ? ` (thu ${cod} Xu khi nhận)` : ''}. Nhận ở Thủ kho tại trạm.`, 'info');
      }
      return { fee };
    });
  }

  /** Thư thu tiền khi nhận quá hạn thì tự trả về; thư quá 30 ngày bị xóa. */
  expire(): void {
    const now = Date.now();
    const rows = this.game.db.all<MailRow>('SELECT * FROM mail WHERE claimed_at IS NULL AND expires_at < ? LIMIT 200', now);
    if (rows.length === 0) return;
    this.game.atomic([], () => {
      for (const m of rows) {
        if (m.from_char !== null && !m.returned) {
          this.bounce(m);
        } else {
          // Xu trong thư hết hạn quay về hệ thống
          if (m.xu > 0) this.game.ledger.transfer(SYS.mail, SYS.services, m.xu, 'mail_expired', `mail#${m.id}`);
          this.game.db.run('UPDATE mail SET claimed_at = ? WHERE id = ?', now, m.id);
          this.game.db.run('INSERT INTO audit(kind, char_id, data, created_at) VALUES (?, ?, ?, ?)', 'mail_expired', m.to_char, m.items, now);
        }
      }
    });
  }
}
