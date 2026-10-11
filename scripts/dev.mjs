// Chạy đồng thời máy chủ game (cổng 8787) và Vite dev server (cổng 5173).
import { spawn } from 'node:child_process';

const procs = [
  ['server', ['run', 'dev', '-w', '@suongdo/server'], '\x1b[35m'],
  ['client', ['run', 'dev', '-w', '@suongdo/client'], '\x1b[36m'],
];
const children = procs.map(([name, args, color]) => {
  const p = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { stdio: ['inherit', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  const tag = `${color}[${name}]\x1b[0m `;
  for (const s of [p.stdout, p.stderr]) {
    s.on('data', (d) => process.stdout.write(d.toString().split('\n').filter(Boolean).map((l) => tag + l).join('\n') + '\n'));
  }
  p.on('exit', (code) => {
    console.log(`${tag}đã dừng (mã ${code})`);
    for (const c of children) if (c !== p) c.kill('SIGINT');
    process.exit(code ?? 0);
  });
  return p;
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => children.forEach((c) => c.kill(sig)));
console.log('\n  Mở trình duyệt: http://localhost:5173\n');
