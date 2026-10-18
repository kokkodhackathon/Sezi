import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router';

import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';
import { Login } from '../pages/Login';

/** Oturum yoksa giriş; rol admin değilse açıklama; admin ise menü + içerik. */
export function Layout() {
  const { session, loading, isAdmin, signOut } = useAuth();
  if (loading) return <div className="center muted">Yükleniyor…</div>;
  if (!session) return <Login />;
  if (!isAdmin) return <NotAdmin email={session.user.email ?? ''} signOut={signOut} />;
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          Sezi
          <small>Yönetim paneli</small>
        </div>
        <nav className="nav" aria-label="Ana menü">
          <NavLink to="/eserler" end>
            Eserler
          </NavLink>
          <NavLink to="/eserler/yeni">Yeni eser</NavLink>
          <NavLink to="/eslestirme">Konum eşleştirme</NavLink>
          <NavLink to="/metinler">Eser metinleri</NavLink>
          <NavLink to="/fotograflar">Fotoğraf kutusu</NavLink>
          <NavLink to="/noktalar">Noktalar</NavLink>
          <NavLink to="/rota-testi">Rota testi</NavLink>
          <NavLink to="/bildirimler">Bildirimler</NavLink>
          <NavLink to="/iller">İller</NavLink>
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

/**
 * Rol sonradan verildiyse oturum anahtarında henüz yazmaz. Anahtarı yenilemek (refresh) güncel rolü getirir;
 * yeniden giriş ve e-posta gerekmez. Ekran açılınca bir kez kendiliğinden denenir.
 */
function NotAdmin({ email, signOut }: { email: string; signOut: () => Promise<void> }) {
  const [state, setState] = useState<'refreshing' | 'still'>('refreshing');
  const refresh = async () => {
    setState('refreshing');
    const { data } = await supabase.auth.refreshSession();
    // Rol geldiyse AuthProvider oturum değişikliğini yakalar ve panel açılır.
    if (data.session?.user.app_metadata?.role !== 'admin') setState('still');
  };
  useEffect(() => {
    void refresh();
    // Yalnızca ilk açılışta bir kez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="center">
      <div className="card login">
        <h1>Yetki gerekiyor</h1>
        <p>
          <strong>{email}</strong> hesabıyla giriş yaptınız ama bu hesapta yönetici rolü görünmüyor.
        </p>
        {state === 'refreshing' ? <p className="muted">Yetki denetleniyor…</p> : null}
        {state === 'still' ? <p className="muted">Rol hâlâ tanımlı değil. Bir yönetici rol verdikten sonra “Yetkiyi yenile”ye basın.</p> : null}
        <div className="row">
          <button className="btn" disabled={state === 'refreshing'} onClick={() => void refresh()}>
            Yetkiyi yenile
          </button>
          <button className="btn outline" onClick={() => void signOut()}>
            Çıkış yap
          </button>
        </div>
      </div>
    </div>
  );
}
