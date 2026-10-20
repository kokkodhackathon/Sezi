import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { FormScreen } from '@/components/account-fields';
import { Button, Card, ListRow, Note } from '@/components/ui';
import { InfoIcon } from '@/design/icons';
import { space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { errorKey, signOut, useAccount } from '@/lib/account';
import { useT } from '@/lib/i18n';

/** Hesap: girişsizken neden açılacağı ve iki düğme; girişliyken ad, e-posta, eşitleme durumu ve hesap işlemleri. */
export default function AccountHome() {
  const t = useSweetTheme();
  const { t: tr } = useT();
  const { ready, user, account, pending } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) {
    return (
      <FormScreen>
        <ActivityIndicator color={t.primaryText} accessibilityLabel={tr('account.loading')} />
      </FormScreen>
    );
  }

  if (!user) {
    return (
      <FormScreen lead={tr('account.intro')}>
        <Card padded={false}>
          <ListRow first title={tr('account.benefitSync')} subtitle={tr('account.benefitSyncSub')} />
          <ListRow title={tr('account.benefitSoon')} subtitle={tr('account.benefitSoonSub')} />
        </Card>
        <View style={{ gap: space.md }}>
          <Button label={tr('account.signUp')} onPress={() => router.push('/account/sign-up')} />
          <Button variant="outline" label={tr('account.signIn')} onPress={() => router.push('/account/sign-in')} />
        </View>
        <Note text={tr('account.privacy')} icon={<InfoIcon color={t.textMuted} />} />
      </FormScreen>
    );
  }

  const out = async () => {
    setBusy(true);
    setError(null);
    try {
      await signOut();
    } catch (e) {
      setError(tr(errorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen>
      <View style={{ gap: space.xs }} accessible accessibilityRole="header">
        <Text style={[type.title, { color: t.text }]}>{account?.display_name ?? user.email}</Text>
        {account ? <Text style={[type.body, { color: t.textMuted }]}>{user.email}</Text> : null}
      </View>
      <Note text={tr(pending ? 'account.syncPending' : 'account.syncDone')} icon={<InfoIcon color={t.textMuted} />} />
      <Card padded={false}>
        <ListRow first title={tr('account.editName')} subtitle={account?.display_name} onPress={() => router.push('/account/name')} />
        <ListRow title={tr('account.changePassword')} onPress={() => router.push({ pathname: '/account/password', params: { mode: 'change' } })} />
      </Card>
      <View style={{ gap: space.sm }}>
        <Button variant="outline" label={tr('account.signOut')} hint={tr('account.signOutHint')} onPress={out} disabled={busy} />
        {error ? (
          <Text style={[type.meta, { color: t.danger }]} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>
      <Card padded={false}>
        <ListRow first danger title={tr('account.delete')} onPress={() => router.push('/account/delete')} />
      </Card>
    </FormScreen>
  );
}
