import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { FormScreen, PasswordField } from '@/components/account-fields';
import { Button, Field } from '@/components/ui';
import { type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { Email, errorCode, errorKey, resendSignupCode, signIn } from '@/lib/account';
import { useT } from '@/lib/i18n';

/** Giriş: e-posta + şifre. Doğrulanmamış hesapta yeni kod gönderilip doğrulama ekranına geçilir. */
export default function SignIn() {
  const t = useSweetTheme();
  const { t: tr } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e = Email.safeParse(email);
    if (!e.success) return setError(tr('account.err.invalid_email'));
    if (!password) return setError(tr('account.err.invalid_credentials'));
    setError(null);
    setBusy(true);
    try {
      await signIn(e.data, password);
      router.dismissTo('/account');
    } catch (err) {
      if (errorCode(err) === 'email_not_confirmed') {
        // Kod gönderilemese de (sıklık sınırı) ekrandaki "yeniden gönder" sonra dener.
        await resendSignupCode(e.data).catch(() => undefined);
        router.push({ pathname: '/account/verify', params: { mode: 'signup', email: e.data } });
        return;
      }
      setError(tr(errorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen>
      <Field
        label={tr('account.email')}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
      />
      <PasswordField label={tr('account.password')} value={password} onChangeText={setPassword} onSubmitEditing={submit} />
      {error ? (
        <Text style={[type.body, { color: t.danger }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button label={tr('account.signIn')} onPress={submit} disabled={busy} />
      <Button variant="ghost" label={tr('account.forgot')} onPress={() => router.push({ pathname: '/account/forgot', params: { email: email.trim() } })} />
      <Button variant="ghost" label={tr('account.noAccount')} onPress={() => router.replace('/account/sign-up')} />
    </FormScreen>
  );
}
