import { useState, type FormEvent } from 'react';

import { supabase } from '../lib/supabase';

type Mode = 'link' | 'password';

/** Supabase hata mesajlarının Türkçe ve ne yapılacağını söyleyen karşılığı. */
function explain(message: string): string {
  if (/rate limit/i.test(message)) {
    return 'Saatlik e-posta sınırına ulaşıldı (Supabase ücretsiz e-posta servisi). Yaklaşık bir saat sonra yeniden deneyin ya da parolayla girin.';
  }
  if (/invalid login credentials/i.test(message)) return 'E-posta ya da parola hatalı.';
  if (/email not confirmed/i.test(message)) return 'E-posta adresi henüz doğrulanmamış.';
  return message;
}

/**
 * Giriş: e-postaya sihirli bağlantı ya da parola.
 * Parola, ücretsiz plandaki saatlik e-posta sınırına takılmamak içindir; yönetici kendisi belirler.
 */
export function Login() {
  const [mode, setMode] = useState<Mode>('link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const fail = (m: string) => {
    setState('error');
    setMessage(m);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Geçerli bir e-posta adresi yazın.');
    setState('sending');
    if (mode === 'password') {
      if (!password) return fail('Parolanızı yazın.');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return fail(explain(error.message));
      setState('idle');
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (error) return fail(explain(error.message));
    setState('sent');
  };

  return (
    <div className="center">
      <form className="card login" onSubmit={submit} noValidate>
        <h1>Sezi Yönetim</h1>
        <div className="row" role="tablist" aria-label="Giriş yöntemi" style={{ gap: 6 }}>
          <button type="button" role="tab" aria-selected={mode === 'link'} className={`btn small ${mode === 'link' ? '' : 'outline'}`} onClick={() => { setMode('link'); setState('idle'); }}>
            E-posta bağlantısı
          </button>
          <button type="button" role="tab" aria-selected={mode === 'password'} className={`btn small ${mode === 'password' ? '' : 'outline'}`} onClick={() => { setMode('password'); setState('idle'); }}>
            Parola
          </button>
        </div>
        <label className="field" htmlFor="email">
          E-posta
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode === 'password' ? (
          <label className="field" htmlFor="password">
            Parola
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Giriş bağlantısı e-postanıza gelir; aynı tarayıcıda açın.
          </p>
        )}
        <button className="btn" type="submit" disabled={state === 'sending'}>
          {state === 'sending' ? 'Bekleyin…' : mode === 'password' ? 'Giriş yap' : 'Giriş bağlantısı gönder'}
        </button>
        {state === 'sent' ? <p role="status">Bağlantı gönderildi. E-postanızdaki bağlantıya bu tarayıcıda tıklayın.</p> : null}
        {state === 'error' ? (
          <p role="alert" className="error" style={{ margin: 0 }}>
            {message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
