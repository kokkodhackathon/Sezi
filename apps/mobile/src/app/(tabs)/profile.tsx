import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTabBarSpace } from '@/components/app-tabs';
import { Avatar } from '@/components/avatar';
import { ProfileCard } from '@/components/profile-card';
import { ScreenHeader } from '@/components/screen-header';
import { Badge, Button, Card, ListRow, SectionTitle } from '@/components/ui';
import { ChevronIcon } from '@/design/icons';
import { FadeInItem, outline, SoftPressable } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useAccount } from '@/lib/account';
import { useT } from '@/lib/i18n';
import { useIdentity } from '@/lib/identity';
import { useProfile } from '@/lib/profile';
import { useReports } from '@/lib/reports';
import { useSettings } from '@/lib/settings';
import { useWorks } from '@/lib/works';

export default function Profile() {
  const t = useSweetTheme();
  const { t: tr } = useT();
  const { profile } = useProfile();
  const { user } = useAccount();
  const { identity, avatar } = useIdentity();
  const { visited } = useSettings();
  const reports = useReports();
  const { data: works } = useWorks();
  const tabSpace = useTabBarSpace();
  if (!profile) return null;
  const visitedCount = works ? works.filter((w) => visited.includes(w.slug)).length : visited.length;
  return <SafeAreaView style={{ flex: 1, backgroundColor: t.background }} edges={['top']}>
    <ScrollView contentContainerStyle={[s.body, { paddingBottom: tabSpace }]}>
      <ScreenHeader title={tr('profile.title')} subtitle={tr('design.profileIntro')} />
      <FadeInItem index={0}>
        <ProfileCard profile={profile} onEdit={(field) => router.push({ pathname: '/onboarding', params: { step: field } })} />
      </FadeInItem>
      <FadeInItem index={1} style={{ gap: space.sm }}>
        <SectionTitle title={tr('profile.stats.visited')} />
        <Text style={[type.body, { color: t.text }]}>{tr('profile.stats.of', { n: visitedCount, total: works?.length ?? 0 })}</Text>
      </FadeInItem>
      <FadeInItem index={2} style={{ gap: space.md }}>
        <SectionTitle title={tr('profile.more')} />
        <Card padded={false}>
          <ListRow first title={tr('profile.reports')} trailing={reports.length ? <Badge label={String(reports.length)} /> : undefined} onPress={() => router.push('/reports')} />
          <ListRow title={tr('profile.settings')} onPress={() => router.push('/settings')} />
          <ListRow title={tr('exh.title')} onPress={() => router.push('/exhibitions')} />
          <ListRow title={tr('profile.about')} onPress={() => router.push('/about')} />
        </Card>
      </FadeInItem>
      <FadeInItem index={3}>
      {/* Hesap kartı. Girişli: fotoğraf, ad, @kullanıcı adı; dokununca hesap. Girişsiz: ne kazandırdığı ve iki doğrudan düğme. */}
      {user ? (
        <SoftPressable
          onPress={() => router.push('/account')}
          accessibilityRole="button"
          accessibilityLabel={`${tr('profile.account')}: ${identity?.display_name ?? user.email ?? ''}`}
          accessibilityHint={tr('profile.accountOpen')}
          style={[s.me, { backgroundColor: t.surface }, outline(t)]}>
          <Avatar identity={identity} source={avatar} size={64} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.itemTitle, { color: t.text }]} numberOfLines={2}>
              {identity?.display_name ?? user.email}
            </Text>
            <Text style={[type.meta, { color: t.textMuted }]} numberOfLines={1}>
              {identity?.username ? `@${identity.username}` : user.email}
            </Text>
          </View>
          <ChevronIcon color={t.textMuted} />
        </SoftPressable>
      ) : (
        <View style={[s.join, { backgroundColor: t.surface }, outline(t)]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
            <Avatar identity={null} size={56} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.itemTitle, { color: t.text }]} accessibilityRole="header">
                {tr('profile.joinTitle')}
              </Text>
              <Text style={[type.meta, { color: t.textMuted }]}>{tr('profile.joinBody')}</Text>
            </View>
          </View>
          <View style={s.joinActions}>
            <Button compact style={{ flex: 1 }} label={tr('account.signUp')} onPress={() => router.push('/account/sign-up')} />
            <Button compact variant="secondary" style={{ flex: 1 }} label={tr('account.signIn')} onPress={() => router.push('/account/sign-in')} />
          </View>
        </View>
      )}
      </FadeInItem>
    </ScrollView>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  body: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: 28 },
  me: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg, borderRadius: radius.lg, borderCurve: 'continuous', minHeight: 88 },
  join: { gap: space.lg, padding: space.lg, borderRadius: radius.lg, borderCurve: 'continuous' },
  joinActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
