import { loadConfig } from './config.ts';
import { Db } from './db.ts';
import { Game } from './game/game.ts';
import { createServer } from './http.ts';

const cfg = loadConfig();
const db = new Db(cfg.dbPath);
const game = new Game(cfg, db);
const audit = game.ledger.audit();
if (!audit.ok) console.error('⚠ Sổ cái không khớp!', audit);

game.start();
const server = createServer(cfg, db, game);
server.listen(cfg.port, cfg.host, () => {
  console.log(`🌫  Sương Đỏ — ${cfg.realmName}${cfg.hardcore ? ' (Hardcore)' : ''}`);
  console.log(`   Máy chủ chạy tại http://localhost:${cfg.port}  ·  seed ${game.seed}  ·  CSDL ${cfg.dbPath}`);
});

// Kiểm tra sổ cái định kỳ
setInterval(() => {
  const a = game.ledger.audit();
  if (!a.ok) console.error('⚠ Sổ cái không khớp!', JSON.stringify(a));
}, 10 * 60_000).unref();

let stopping = false;
function shutdown(sig: string): void {
  if (stopping) return;
  stopping = true;
  console.log(`\n${sig}: đang lưu thế giới...`);
  game.stop();
  server.close();
  db.close();
  console.log('Đã lưu. Tạm biệt!');
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
