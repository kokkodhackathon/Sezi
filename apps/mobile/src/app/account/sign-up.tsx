import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { FormScreen, PasswordField } from '@/components/account-fields';
import { Button, Field, Note } from '@/components/ui';
import { InfoIcon } from '@/design/icons';
import { type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { DisplayName, Email, errorKey, NAME_MAX, Password, signUp } from '@/lib/account';
import { useT } from '@/lib/i18n';

type Errors = Partial<Record<'name' | 'email' | 'password' | 'form', string>>;

/** Kayıt: ad, e-posta, şifre → e-postaya 6 haneli kod → doğrulama ekranı. */
export default function SignUp() {
  const t = useSweetTheme();
  const { t: tr, lang } = useT();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const n = DisplayName.safeParse(name);
    const e = Email.safeParse(email);
    const p = Password.safeParse(password);
    const next: Errors = {
      name: n.success ? undefined : tr('account.err.invalid_name', { n: NAME_MAX }),
      email: e.success ? undefined : tr('account.err.invalid_email'),
      password: p.success ? undefined : tr('account.err.invalid_password'),
    };
    setErrors(next);
    if (!n.success || !e.success || !p.success) return;
    setBusy(true);
    try {
      await signUp({ name: n.data, email: e.data, password: p.data, lang });
      router.replace({ pathname: '/account/verify', params: { mode: 'signup', email: e.data } });
    } catch (err) {
      setErrors({ form: tr(errorKey(err)) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen lead={tr('account.signUpLead')}>
      <Field label={tr('account.name')} help={tr('account.nameHelp')} error={errors.name} value={name} onChangeText={setName} autoComplete="name" textContentType="name" maxLength={NAME_MAX} />
      <Field
        label={tr('account.email')}
        error={errors.email}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
      />
      <PasswordField isNew label={tr('account.password')} help={tr('account.passwordHelp')} error={errors.password} value={password} onChangeText={setPassword} onSubmitEditing={submit} />
      {errors.form ? (
        <Text style={[type.body, { color: t.danger }]} accessibilityLiveRegion="polite">
          {errors.form}
        </Text>
      ) : null}
      <Button label={tr('account.signUp')} onPress={submit} disabled={busy} />
      <Button variant="ghost" label={tr('account.haveAccount')} onPress={() => router.replace('/account/sign-in')} />
      <Note text={tr('account.privacy')} icon={<InfoIcon color={t.textMuted} />} />
    </FormScreen>
  );
}
