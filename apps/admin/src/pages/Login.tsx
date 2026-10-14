import { useState, type FormEvent } from 'react';

import { supabase } from '../lib/supabase';

/** E-posta ile sihirli bağlantı. Bağlantı bu adrese (window.location.origin) döner. */
export function Login() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setState('error');
      setMessage('Geçerli bir e-posta adresi yazın.');
      return;
    }
    setState('sending');
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (error) {
      setState('error');
      setMessage(error.message);
      return;
    }
    setState('sent');
  };

  return (
    <div className="center">
      <form className="card login" onSubmit={submit} noValidate>
        <h1>Sezi Yönetim</h1>
        <p className="muted">Eser içeriği, fotoğraflar ve onaylar. Giriş bağlantısı e-postanıza gelir.</p>
        <label className="field" htmlFor="email">
          E-posta
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button className="btn" type="submit" disabled={state === 'sending'}>
          {state === 'sending' ? 'Gönderiliyor…' : 'Giriş bağlantısı gönder'}
        </button>
        {state === 'sent' ? <p role="status">Bağlantı gönderildi. E-postanızdaki bağlantıya bu tarayıcıda tıklayın.</p> : null}
        {state === 'error' ? (
          <p role="alert" className="error">
            {message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
