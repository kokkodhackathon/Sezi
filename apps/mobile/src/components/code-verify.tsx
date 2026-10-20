import { Code, CODE_LENGTH } from '@sezi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';

import { CodeField, FormScreen, useCooldown } from '@/components/account-fields';
import { Button, Note } from '@/components/ui';
import { InfoIcon } from '@/design/icons';
import { space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { errorKey, requestPasswordReset, resendSignupCode, verifyPasswordReset, verifySignup } from '@/lib/account';
import { useT } from '@/lib/i18n';

/**
 * E-postadaki 6 haneli kod. İki ayrı rota kullanır (başlıkları `_layout.tsx`'te sabit):
 * `account/verify` (kayıt: hesap doğrulanır, oturum açılır) ve `account/reset-code` (sıfırlama: oturum açılır,
 * yeni şifre ekranına geçilir). Kod 6 haneye ulaşınca kendiliğinden gönderilir.
 */
export function CodeVerify({ mode, email }: { mode: 'signup' | 'recovery'; email: string }) {
  const t = useSweetTheme();
  const { t: tr } = useT();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown();

  const submit = async (value = code) => {
    if (busy) return;
    const c = Code.safeParse(value);
    if (!c.success) return setError(tr('account.err.invalid_code'));
    setError(undefined);
    setBusy(true);
    try {
      if (mode === 'recovery') {
        await verifyPasswordReset(email, c.data);
        router.replace({ pathname: '/account/password', params: { mode: 'recovery' } });
      } else {
        await verifySignup(email, c.data);
        AccessibilityInfo.announceForAccessibility(tr('account.verified'));
        router.dismissTo('/account');
      }
    } catch (err) {
      setError(tr(errorKey(err)));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(undefined);
    try {
      if (mode === 'recovery') await requestPasswordReset(email);
      else await resendSignupCode(email);
      cooldown.restart();
      setInfo(tr('account.resent'));
    } catch (err) {
      setError(tr(errorKey(err)));
    }
  };

  return (
    <FormScreen lead={tr('account.verifyLead', { email })}>
      <CodeField value={code} onChange={setCode} error={error} onComplete={(c) => void submit(c)} />
      <View style={{ gap: space.sm }}>
        <Button label={busy ? tr('account.checking') : tr('account.verify')} onPress={() => void submit()} disabled={busy || code.length < CODE_LENGTH} />
        <Button
          variant="ghost"
          label={cooldown.left > 0 ? tr('account.resendIn', { s: cooldown.left }) : tr('account.resend')}
          onPress={resend}
          disabled={cooldown.left > 0}
        />
        {info ? (
          <Text style={[type.meta, { color: t.textMuted, textAlign: 'center' }]} accessibilityLiveRegion="polite">
            {info}
          </Text>
        ) : null}
      </View>
      <Note text={tr(mode === 'recovery' ? 'account.noCodeRecovery' : 'account.noCode')} icon={<InfoIcon color={t.textMuted} />} />
    </FormScreen>
  );
}
