import { Email } from '@sezi/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { FormScreen } from '@/components/account-fields';
import { Button, Field } from '@/components/ui';
import { MailIcon } from '@/design/icons';
import { errorKey, requestPasswordReset } from '@/lib/account';
import { useT } from '@/lib/i18n';

/** Şifre sıfırlama: e-postaya kod → doğrulama → yeni şifre. Adres kayıtlı olmasa da aynı yanıt verilir. */
export default function Forgot() {
  const { t: tr } = useT();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    const e = Email.safeParse(email);
    if (!e.success) return setError(tr('account.err.invalid_email'));
    setError(undefined);
    setBusy(true);
    try {
      await requestPasswordReset(e.data);
      router.replace({ pathname: '/account/reset-code', params: { email: e.data } });
    } catch (err) {
      setError(tr(errorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen lead={tr('account.forgotLead')}>
      <Field
        label={tr('account.email')}
        placeholder={tr('account.emailPlaceholder')}
        error={error}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={submit}
        icon={(c) => <MailIcon color={c} />}
      />
      <Button label={busy ? tr('account.sending') : tr('account.sendCode')} onPress={submit} disabled={busy} />
    </FormScreen>
  );
}
