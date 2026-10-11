import { useEffect, useState } from 'react';
import { api } from '../net/client';
import { type Auth, saveAuth, useStore } from '../state/store';

interface Status {
  online: number;
  day: number;
  realm: string;
  hardcore: boolean;
}

export function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    api<Status>('/api/status')
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  async function go(kind: 'login' | 'register' | 'guest') {
    setBusy(true);
    setErr(null);
    try {
      const r =
        kind === 'guest'
          ? await api<{ token: string; username: string; guest: boolean }>('/api/guest', {})
          : await api<{ token: string; username: string; guest: boolean }>(`/api/${kind}`, { username: username.trim(), password });
      const auth: Auth = { token: r.token, username: r.username, guest: r.guest };
      saveAuth(auth);
      useStore.setState({ auth, connError: null });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="mist-bg" />
      <form
        className="login-card"
        onSubmit={(e) => {
          e.preventDefault();
          void go(mode);
        }}
      >
        <div className="logo">SƯƠNG ĐỎ</div>
        <div className="tagline">Sinh tồn vô hạn · Thế giới không có điểm cuối</div>
        {status && (
          <div className="tagline" style={{ marginTop: -12 }}>
            {status.realm} · Ngày {status.day} · {status.online} người đang chơi
          </div>
        )}
        <label>Tên đăng nhập</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" maxLength={16} placeholder="3–16 ký tự" />
        <label>Mật khẩu</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Ít nhất 6 ký tự" />
        {err && <div className="err">{err}</div>}
        <div className="actions">
          <button className="primary" type="submit" disabled={busy || !username || !password}>
            {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </button>
          <button type="button" className="ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} disabled={busy}>
            {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
          </button>
          <button type="button" onClick={() => void go('guest')} disabled={busy}>
            Chơi ngay (tài khoản khách)
          </button>
        </div>
        <div className="foot">
          Tài khoản khách chơi được ngay nhưng chưa dùng Sàn giao dịch và Hòm thư.
          <br />
          WASD di chuyển · Chuột trái hành động · E tương tác · Tab túi đồ · H trợ giúp
        </div>
      </form>
    </div>
  );
}
