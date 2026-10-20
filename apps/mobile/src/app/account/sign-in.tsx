import { Email } from '@sezi/shared';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { type TextInput, View } from 'react-native';

import { FormError, FormScreen, PasswordField } from '@/components/account-fields';
import { Button, Field } from '@/components/ui';
import { MailIcon } from '@/design/icons';
import { space } from '@/design/type';
import { errorCode, errorKey, resendSignupCode, signIn } from '@/lib/account';
import { useT } from '@/lib/i18n';

/**
 * Giriş: e-posta + şifre. Doğrulanmamış hesapta yeni kod gönderilip doğrulama ekranına geçilir.
 * "Şifremi unuttum" şifre alanının hemen altında küçük bağlantıdır; ana düğmeden ayrı durur (yanlışlıkla basılmasın).
 */
export default function SignIn() {
  const { t: tr } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'email' | 'form', string>>>({});
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    if (busy) return;
    const e = Email.safeParse(email);
    if (!e.success) return setErrors({ email: tr('account.err.invalid_email') });
    if (!password) return setErrors({ form: tr('account.err.invalid_credentials') });
    setErrors({});
    setBusy(true);
    try {
      await signIn(e.data, password);
      router.dismissTo('/account');
    } catch (err) {
      if (errorCode(err) === 'email_not_confirmed') {
        // Kod gönderilemese de (sıklık sınırı) ekrandaki "yeniden gönder" sonra dener.
        await resendSignupCode(e.data).catch(() => undefined);
        router.push({ pathname: '/account/verify', params: { email: e.data } });
        return;
      }
      setErrors({ form: tr(errorKey(err)) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen lead={tr('account.signInLead')}>
      <Field
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
      <View style={{ gap: space.xs }}>
        <PasswordField inputRef={passwordRef} label={tr('account.password')} value={password} onChangeText={setPassword} onSubmitEditing={submit} />
        <Button
          compact
          variant="ghost"
          style={{ alignSelf: 'flex-end', paddingHorizontal: space.sm }}
          label={tr('account.forgot')}
          onPress={() => router.push({ pathname: '/account/forgot', params: { email: email.trim() } })}
        />
      </View>
      <FormError text={errors.form} />
      <View style={{ gap: space.sm }}>
        <Button label={busy ? tr('account.signingIn') : tr('account.signIn')} onPress={submit} disabled={busy} />
        <Button variant="outline" label={tr('account.noAccount')} onPress={() => router.replace('/account/sign-up')} />
      </View>
    </FormScreen>
  );
}
