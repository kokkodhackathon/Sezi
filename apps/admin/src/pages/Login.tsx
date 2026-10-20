import { CircleAlert, MailCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';

type Mode = 'password' | 'link';

/** Supabase hata mesajlarının Türkçe ve ne yapılacağını söyleyen karşılığı. */
function explain(message: string): string {
  if (/rate limit/i.test(message)) {
    return 'Saatlik e-posta sınırına ulaşıldı. Bir süre sonra yeniden deneyin ya da parolayla girin.';
  }
  if (/invalid login credentials/i.test(message)) return 'E-posta ya da parola hatalı.';
  if (/email not confirmed/i.test(message)) return 'E-posta adresi henüz doğrulanmamış.';
  return message;
}

/**
 * Giriş: parola ya da e-postaya giriş bağlantısı.
 * Parola varsayılandır: e-posta gönderimi saatlik sınıra tabidir.
 */
export function Login() {
  const [mode, setMode] = useState<Mode>('password');
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
    if (mode === 'password' && !password) return fail('Parolanızı yazın.');
    setState('sending');
    if (mode === 'password') {
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
    <div className="grid min-h-full place-items-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary font-heading text-lg font-extrabold text-primary-foreground" aria-hidden>
            S
          </span>
          <CardTitle className="text-2xl font-extrabold">Sezi Yönetim</CardTitle>
          <CardDescription>Yalnızca yönetici rolü olan hesaplar girebilir.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} noValidate className="flex flex-col gap-6">
            <Tabs
              value={mode}
              onValueChange={(v) => {
                setMode(v === 'link' ? 'link' : 'password');
                setState('idle');
              }}
            >
              <TabsList className="w-full" aria-label="Giriş yöntemi">
                <TabsTrigger value="password">Parola</TabsTrigger>
                <TabsTrigger value="link">E-posta bağlantısı</TabsTrigger>
              </TabsList>
            </Tabs>
            <FieldGroup>
              <Field data-invalid={state === 'error' || undefined}>
                <FieldLabel htmlFor="email">E-posta</FieldLabel>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={state === 'error' || undefined} />
              </Field>
              {mode === 'password' ? (
                <Field>
                  <FieldLabel htmlFor="password">Parola</FieldLabel>
                  <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>
              ) : (
                <FieldDescription>Giriş bağlantısı e-postanıza gelir; aynı tarayıcıda açın.</FieldDescription>
              )}
            </FieldGroup>
            <Button type="submit" size="lg" disabled={state === 'sending'}>
              {state === 'sending' ? <Spinner data-icon="inline-start" /> : null}
              {mode === 'password' ? 'Giriş yap' : 'Giriş bağlantısı gönder'}
            </Button>
            {state === 'sent' ? (
              <Alert role="status">
                <MailCheck />
                <AlertTitle>Bağlantı gönderildi</AlertTitle>
                <AlertDescription>E-postanızdaki bağlantıya bu tarayıcıda tıklayın.</AlertDescription>
              </Alert>
            ) : null}
            {state === 'error' ? (
              <Alert variant="destructive" role="alert">
                <CircleAlert />
                <AlertTitle>Giriş yapılamadı</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
