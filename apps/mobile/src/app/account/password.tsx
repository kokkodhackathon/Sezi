import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, Text } from 'react-native';

import { CodeField, FormScreen, PasswordField, useCooldown } from '@/components/account-fields';
import { Button } from '@/components/ui';
import { type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { Code, errorKey, Password, sendPasswordChangeCode, setPassword, useAccount } from '@/lib/account';
import { useT } from '@/lib/i18n';

/**
 * Yeni şifre. `recovery`: sıfırlama kodu doğrulandıktan hemen sonra (yeni oturum, ek kod yok).
 * `change`: girişliyken; sunucu `secure_password_change` ister: önce e-postaya onay kodu gider.
 */
export default function PasswordScreen() {
  const t = useSweetTheme();
  const { t: tr } = useT();
  const { user } = useAccount();
  const { mode } = useLocalSearchParams<{ mode: 'recovery' | 'change' }>();
  const change = mode === 'change';
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPw] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'code' | 'password' | 'form', string>>>({});
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown(false);

  const sendCode = async () => {
    setErrors({});
    setBusy(true);
    try {
      await sendPasswordChangeCode();
      setSent(true);
      cooldown.restart();
    } catch (err) {
      setErrors({ form: tr(errorKey(err)) });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const p = Password.safeParse(password);
    const c = Code.safeParse(code);
    const next = {
      password: p.success ? undefined : tr('account.err.invalid_password'),
      code: !change || c.success ? undefined : tr('account.err.invalid_code'),
    };
    setErrors(next);
    if (!p.success || next.code) return;
    setBusy(true);
    try {
      await setPassword(p.data, change ? c.data : undefined);
      AccessibilityInfo.announceForAccessibility(tr('account.passwordSaved'));
      router.dismissTo('/account');
    } catch (err) {
      setErrors({ form: tr(errorKey(err)) });
    } finally {
      setBusy(false);
    }
  };

  const formError = errors.form ? (
    <Text style={[type.body, { color: t.danger }]} accessibilityLiveRegion="polite">
      {errors.form}
    </Text>
  ) : null;

  // Değişim, ilk adım: onay kodu iste.
  if (change && !sent) {
    return (
      <FormScreen lead={tr('account.changePasswordLead', { email: user?.email ?? '' })}>
        <Stack.Screen options={{ title: tr('account.changePassword') }} />
        {formError}
        <Button label={tr('account.sendCode')} onPress={sendCode} disabled={busy} />
      </FormScreen>
    );
  }

  return (
    <FormScreen lead={change ? tr('account.codeSent', { email: user?.email ?? '' }) : tr('account.newPasswordLead')}>
      <Stack.Screen options={{ title: tr(change ? 'account.changePassword' : 'account.newPasswordTitle') }} />
      {change ? <CodeField value={code} onChange={setCode} error={errors.code} /> : null}
      <PasswordField isNew label={tr('account.newPassword')} help={tr('account.passwordHelp')} error={errors.password} value={password} onChangeText={setPw} onSubmitEditing={save} />
      {formError}
      <Button label={tr('account.savePassword')} onPress={save} disabled={busy} />
      {change ? (
        <Button
          variant="ghost"
          label={cooldown.left > 0 ? tr('account.resendIn', { s: cooldown.left }) : tr('account.resend')}
          onPress={sendCode}
          disabled={cooldown.left > 0 || busy}
        />
      ) : null}
    </FormScreen>
  );
}
