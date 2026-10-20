import { DisplayName, Email, NAME_MAX, Password } from '@sezi/shared';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { type TextInput, View } from 'react-native';

import { FormError, FormScreen, PasswordField } from '@/components/account-fields';
import { Button, Field, Note } from '@/components/ui';
import { InfoIcon, MailIcon, PersonIcon } from '@/design/icons';
import { space } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { errorKey, signUp } from '@/lib/account';
import { useT } from '@/lib/i18n';

type Errors = Partial<Record<'name' | 'email' | 'password' | 'form', string>>;

/** Kayıt: ad, e-posta, şifre → e-postaya 6 haneli kod → doğrulama ekranı. Alanlar klavyeden sırayla geçilir. */
export default function SignUp() {
  const t = useSweetTheme();
  const { t: tr, lang } = useT();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    if (busy) return;
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
      router.replace({ pathname: '/account/verify', params: { email: e.data } });
    } catch (err) {
      setErrors({ form: tr(errorKey(err)) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen lead={tr('account.signUpLead')}>
      <Field
        label={tr('account.name')}
        placeholder={tr('account.namePlaceholder')}
        help={tr('account.nameHelp')}
        error={errors.name}
        value={name}
        onChangeText={setName}
        autoComplete="name"
        textContentType="name"
        maxLength={NAME_MAX}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
        icon={(c) => <PersonIcon color={c} size={20} />}
      />
      <Field
        inputRef={emailRef}
        label={tr('account.email')}
        placeholder={tr('account.emailPlaceholder')}
        error={errors.email}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
        icon={(c) => <MailIcon color={c} />}
      />
      <PasswordField isNew inputRef={passwordRef} label={tr('account.password')} error={errors.password} value={password} onChangeText={setPassword} onSubmitEditing={submit} />
      <FormError text={errors.form} />
      <View style={{ gap: space.sm }}>
        <Button label={busy ? tr('account.sending') : tr('account.signUp')} onPress={submit} disabled={busy} />
        <Button variant="ghost" label={tr('account.haveAccount')} onPress={() => router.replace('/account/sign-in')} />
      </View>
      <Note text={tr('account.privacy')} icon={<InfoIcon color={t.textMuted} />} />
    </FormScreen>
  );
}
