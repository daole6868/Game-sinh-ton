import { useEffect, useState } from 'react';
import { PhaserGame } from './game/PhaserGame';
import { api, net } from './net/client';
import { loadAuth, saveAuth, useStore } from './state/store';
import { Hud } from './ui/Hud';
import { LoginScreen } from './ui/LoginScreen';

export function App() {
  const auth = useStore((s) => s.auth);
  const me = useStore((s) => s.me);
  const seed = useStore((s) => s.seed);
  const connected = useStore((s) => s.connected);
  const connError = useStore((s) => s.connError);
  const dead = useStore((s) => s.dead);
  const [checked, setChecked] = useState(false);

  // khôi phục phiên đăng nhập
  useEffect(() => {
    const saved = loadAuth();
    if (!saved) {
      setChecked(true);
      return;
    }
    api<{ username: string; guest: boolean }>('/api/me', undefined, saved.token)
      .then((r) => useStore.setState({ auth: { ...saved, username: r.username, guest: r.guest } }))
      .catch(() => saveAuth(null))
      .finally(() => setChecked(true));
  }, []);

  useEffect(() => {
    if (!auth) return;
    net.connect(auth.token);
    return () => net.close();
  }, [auth?.token]);

  if (!checked) return <div className="center-screen pixel" style={{ fontSize: 28 }}>Đang tải...</div>;
  if (!auth) return <LoginScreen />;

  // Hardcore: nhân vật đã chết vĩnh viễn, cần tạo nhân vật mới
  if (!me && dead?.hardcore) return <NewCharacter />;

  if (!me || !seed) {
    return (
      <div className="center-screen">
        <div className="logo">SƯƠNG ĐỎ</div>
        <div className="muted">{connError ?? (connected ? 'Đang vào thế giới...' : 'Đang kết nối máy chủ...')}</div>
        {connError && (
          <button
            onClick={() => {
              saveAuth(null);
              net.close();
              useStore.setState({ auth: null, connError: null });
            }}
          >
            Đăng xuất
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <PhaserGame key={seed} />
      <Hud />
    </>
  );
}

function NewCharacter() {
  const [name, setName] = useState('');
  return (
    <div className="login">
      <form
        className="login-card"
        onSubmit={(e) => {
          e.preventDefault();
          net.send({ t: 'newchar', name: name.trim() });
        }}
      >
        <div className="logo" style={{ fontSize: 44 }}>
          ☠ ĐÃ CHẾT
        </div>
        <div className="tagline">Chế độ Hardcore — nhân vật cũ đã được ghi vào Bảng Vinh Danh. Hãy bắt đầu lại.</div>
        <label>Tên nhân vật mới</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} />
        <div className="actions">
          <button className="primary" type="submit" disabled={name.trim().length < 3}>
            Tạo nhân vật
          </button>
        </div>
      </form>
    </div>
  );
}
