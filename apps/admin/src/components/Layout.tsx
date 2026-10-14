import { NavLink, Outlet } from 'react-router';

import { useAuth } from '../lib/auth-context';
import { Login } from '../pages/Login';

/** Oturum yoksa giriş; rol admin değilse açıklama; admin ise menü + içerik. */
export function Layout() {
  const { session, loading, isAdmin, signOut } = useAuth();
  if (loading) return <div className="center muted">Yükleniyor…</div>;
  if (!session) return <Login />;
  if (!isAdmin) {
    return (
      <div className="center">
        <div className="card login">
          <h1>Yetki gerekiyor</h1>
          <p>
            <strong>{session.user.email}</strong> hesabıyla giriş yaptınız ama bu hesap henüz yönetici değil. Bir yönetici rolü tanımladıktan sonra çıkış yapıp yeniden girin.
          </p>
          <button className="btn outline" onClick={() => void signOut()}>
            Çıkış yap
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          Sezi
          <small>Yönetim paneli</small>
        </div>
        <nav className="nav" aria-label="Ana menü">
          <NavLink to="/eserler">Eserler</NavLink>
        </nav>
        <div className="user">
          <span>{session.user.email}</span>
          <button className="btn ghost small" style={{ justifySelf: 'start', paddingInline: 0 }} onClick={() => void signOut()}>
            Çıkış yap
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
