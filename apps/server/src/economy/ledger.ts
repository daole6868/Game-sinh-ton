import { type Db, GameError } from '../db.ts';

/** Ví hệ thống (được phép âm: là nguồn tạo/hủy tiền). */
export const SYS = {
  reward: 'sys:reward', // phần thưởng nhiệm vụ, sự kiện, hợp đồng (nguồn vào)
  npc: 'sys:npc', // NPC mua bán (nguồn vào & nguồn ra)
  tax: 'sys:tax', // thuế và phí sàn (nguồn ra)
  upkeep: 'sys:upkeep', // phí bảo trì lãnh thổ (nguồn ra)
  services: 'sys:services', // sửa đồ, dịch chuyển, thư, kho (nguồn ra)
  escrow: 'sys:escrow', // ký quỹ lệnh mua trên sàn (không bao giờ âm)
  mail: 'sys:mail', // Xu gửi kèm thư chờ nhận (không bao giờ âm)
  starter: 'sys:starter', // tiền khởi đầu
} as const;

export function charWallet(charId: number): string {
  return `c:${charId}`;
}

/** Sổ cái kế toán kép: mọi biến động Xu là một bút toán từ ví A sang ví B. Tổng mọi ví luôn = 0. */
export class Ledger {
  constructor(private db: Db) {
    for (const id of Object.values(SYS)) this.ensure(id, 'system');
  }

  ensure(id: string, type: 'system' | 'character' = 'character'): void {
    this.db.run('INSERT OR IGNORE INTO wallets(id, owner_type, balance) VALUES (?, ?, 0)', id, type);
  }

  balance(id: string): number {
    return this.db.get<{ balance: number }>('SELECT balance FROM wallets WHERE id = ?', id)?.balance ?? 0;
  }

  /** Chuyển Xu. Phải gọi bên trong transaction. Ném GameError nếu không đủ tiền. */
  transfer(from: string, to: string, amount: number, reason: string, ref = ''): void {
    if (!this.db.inTx) throw new Error('Ledger.transfer phải chạy trong transaction');
    if (!Number.isInteger(amount) || amount < 0) throw new Error(`Số tiền không hợp lệ: ${amount}`);
    if (amount === 0 || from === to) return;
    const src = this.db.get<{ balance: number; owner_type: string }>('SELECT balance, owner_type FROM wallets WHERE id = ?', from);
    if (!src) throw new Error(`Không có ví ${from}`);
    const mustCover = src.owner_type !== 'system' || from === SYS.escrow || from === SYS.mail;
    if (mustCover && src.balance < amount) throw new GameError('Không đủ Xu.');
    this.ensure(to, to.startsWith('sys:') ? 'system' : 'character');
    this.db.run('UPDATE wallets SET balance = balance - ? WHERE id = ?', amount, from);
    this.db.run('UPDATE wallets SET balance = balance + ? WHERE id = ?', amount, to);
    this.db.run(
      'INSERT INTO ledger(from_wallet, to_wallet, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      from,
      to,
      amount,
      reason,
      ref,
      Date.now(),
    );
  }

  /** Kiểm tra toàn vẹn: tổng số dư = 0 và mỗi ví khớp với sổ cái. */
  audit(): { ok: boolean; total: number; mismatches: { id: string; balance: number; ledger: number }[] } {
    const total = this.db.get<{ s: number }>('SELECT COALESCE(SUM(balance), 0) AS s FROM wallets')!.s;
    const rows = this.db.all<{ id: string; balance: number; ledger: number }>(`
      SELECT w.id, w.balance,
        COALESCE((SELECT SUM(amount) FROM ledger WHERE to_wallet = w.id), 0)
        - COALESCE((SELECT SUM(amount) FROM ledger WHERE from_wallet = w.id), 0) AS ledger
      FROM wallets w`);
    const mismatches = rows.filter((r) => r.balance !== r.ledger);
    const escrowNeg = rows.filter((r) => (r.id === SYS.escrow || r.id === SYS.mail) && r.balance < 0);
    return { ok: total === 0 && mismatches.length === 0 && escrowNeg.length === 0, total, mismatches };
  }

  /** Tổng Xu người chơi đang nắm giữ. */
  moneySupply(): number {
    return this.db.get<{ s: number }>("SELECT COALESCE(SUM(balance), 0) AS s FROM wallets WHERE owner_type = 'character'")!.s;
  }

  flows(sinceMs: number): { reason: string; from: string; to: string; amount: number }[] {
    return this.db.all(
      `SELECT reason, CASE WHEN from_wallet LIKE 'sys:%' THEN from_wallet ELSE 'player' END AS "from",
              CASE WHEN to_wallet LIKE 'sys:%' THEN to_wallet ELSE 'player' END AS "to",
              SUM(amount) AS amount
       FROM ledger WHERE created_at >= ? GROUP BY 1, 2, 3 ORDER BY amount DESC`,
      sinceMs,
    );
  }
}
