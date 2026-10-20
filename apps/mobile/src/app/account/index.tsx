import { router } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Text, View } from 'react-native';

import { FormError, FormScreen } from '@/components/account-fields';
import { Avatar } from '@/components/avatar';
import { Badge, Button, Card, ListRow, Note } from '@/components/ui';
import { InfoIcon } from '@/design/icons';
import { space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { errorKey, signOut, useAccount } from '@/lib/account';
import { useT } from '@/lib/i18n';
import { useIdentity } from '@/lib/identity';

/**
 * Hesap: girişsizken neden açılacağı ve iki düğme; girişliyken profil kartı (fotoğraf, ad, @kullanıcı adı,
 * görünürlük), eşitleme durumu ve hesap işlemleri. Çıkış her durumda bu cihazdaki oturumu kapatır ve Profil'e döner.
 */
export default function AccountHome() {
  const t = useSweetTheme();
  const { t: tr } = useT();
  const { ready, user, pending } = useAccount();
  const { identity, avatar } = useIdentity();
  const [leaving, setLeaving] = useState(false);
  const [outError, setOutError] = useState<string | null>(null);

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

  // Başarı yalnız cihazdaki oturum gerçekten silindiyse: süresi dolmuş oturum internetsiz kapatılamaz, kullanıcı girişli kalır.
  const out = async () => {
    setLeaving(true);
    setOutError(null);
    try {
      await signOut();
      AccessibilityInfo.announceForAccessibility(tr('account.signedOut'));
      if (router.canGoBack()) router.back();
    } catch (e) {
      setOutError(tr(errorKey(e) === 'account.err.network' ? 'account.signOutOffline' : 'account.err.generic'));
    } finally {
      setLeaving(false);
    }
  };

  const name = identity?.display_name ?? user.email ?? '';
  return (
    <FormScreen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
        <Avatar identity={identity} source={avatar} size={72} />
        <View style={{ flex: 1, gap: 2 }} accessible accessibilityRole="header">
          <Text style={[type.title, { color: t.text }]} numberOfLines={2}>
            {name}
          </Text>
          <Text style={[type.body, { color: t.textMuted }]} numberOfLines={1}>
            {identity?.username ? `@${identity.username}` : user.email}
          </Text>
        </View>
      </View>
      {identity ? <Badge label={tr(identity.visibility === 'public' ? 'account.visPublic' : 'account.visPrivate')} /> : null}
      <Card padded={false}>
        <ListRow first title={tr('account.editProfile')} subtitle={tr('account.editProfileSub')} onPress={() => router.push('/account/edit')} />
        <ListRow title={tr('account.changePassword')} onPress={() => router.push({ pathname: '/account/password', params: { mode: 'change' } })} />
      </Card>
      <Note text={tr(pending ? 'account.syncPending' : 'account.syncDone')} icon={<InfoIcon color={t.textMuted} />} />
      <Button variant="outline" label={leaving ? tr('account.signingOut') : tr('account.signOut')} hint={tr('account.signOutHint')} onPress={out} disabled={leaving} />
      <FormError text={outError} />
      <Card padded={false}>
        <ListRow first danger title={tr('account.delete')} onPress={() => router.push('/account/delete')} />
      </Card>
    </FormScreen>
  );
}
