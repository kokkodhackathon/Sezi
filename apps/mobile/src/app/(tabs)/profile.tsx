import { loc } from '@sezi/shared';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTabBarSpace } from '@/components/app-tabs';
import { Avatar } from '@/components/avatar';
import { ProfileCard } from '@/components/profile-card';
import { ScreenHeader } from '@/components/screen-header';
import { Badge, Button, Card, ListRow, ProgressBar, SectionTitle } from '@/components/ui';
import { ChevronIcon } from '@/design/icons';
import { FadeInItem, outline, SoftPressable } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useAccount } from '@/lib/account';
import { useAchievements } from '@/lib/achievements';
import { useIncomingCount } from '@/lib/friends';
import { useT } from '@/lib/i18n';
import { useIdentity } from '@/lib/identity';
import { usePassport } from '@/lib/passport';
import { useMyPhotos } from '@/lib/photos';
import { useProfile } from '@/lib/profile';
import { useReports } from '@/lib/reports';
import { useWorks } from '@/lib/works';

export default function Profile() {
  const t = useSweetTheme();
  const { t: tr, lang } = useT();
  const { profile } = useProfile();
  const { user } = useAccount();
  const { identity, avatar } = useIdentity();
  const { visits } = usePassport();
  const { list, stats } = useAchievements();
  const incoming = useIncomingCount();
  const { data: photos = [] } = useMyPhotos();
  const reports = useReports();
  const { data: works } = useWorks();
  const tabSpace = useTabBarSpace();
  if (!profile) return null;
  const earned = list.filter((item) => item.level > 0).length;
  const nearest = list
    .filter((item) => item.level === 0 && item.nextTarget !== null)
    .sort((a, b) => b.current / b.nextTarget! - a.current / a.nextTarget!)[0];
  const recent = [...visits].sort((a, b) => b.first_at.localeCompare(a.first_at)).slice(0, 3);
  const visibility = identity?.visibility ?? 'private';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.background }} edges={['top']}>
      <ScrollView contentContainerStyle={[s.body, { paddingBottom: tabSpace }]}>
        <ScreenHeader title={tr('profile.title')} subtitle={tr('design.profileIntro')} />
        <FadeInItem index={0}>
          <ProfileCard
            profile={profile}
            onEdit={(field) => router.push({ pathname: '/onboarding', params: { step: field } })}
          />
        </FadeInItem>
        <Card style={{ gap: space.md }}>
          <SectionTitle title={tr('passport.title')} />
          <Text style={[type.title, { color: t.primaryText }]}>
            {tr('passport.stamps', { n: stats.stamps })}
          </Text>
          <Text style={[type.body, { color: t.text }]}>
            {tr('passport.summary', {
              cities: stats.cities.filter((city) => city.visited > 0).length,
              km: (stats.distanceM / 1000).toFixed(1),
            })}
          </Text>
          {recent.map((visit) => {
            const work = works?.find((item) => item.slug === visit.work_slug);
            return work ? (
              <Text key={visit.work_slug} style={[type.meta, { color: t.textMuted }]}>
                {loc(work.name, lang)}
              </Text>
            ) : null;
          })}
          <ListRow first title={tr('passport.open')} onPress={() => router.push('/passport')} />
        </Card>
        <Card style={{ gap: space.md }}>
          <ListRow
            first
            title={tr('ach.count', { n: earned, total: list.length })}
            onPress={() => router.push('/achievements')}
          />
          {nearest ? (
            <>
              <Text style={[type.itemTitle, { color: t.text }]}>
                {tr(`ach.${nearest.kind}.title`, {
                  name: nearest.subject ? loc(nearest.subject.name, lang) : '',
                })}
              </Text>
              <ProgressBar
                value={nearest.current}
                max={nearest.nextTarget!}
                label={tr(`ach.${nearest.kind}.title`, {
                  name: nearest.subject ? loc(nearest.subject.name, lang) : '',
                })}
              />
            </>
          ) : null}
        </Card>
        {user ? (
          <View style={{ gap: space.md }}>
            <SectionTitle title={tr('profile.community')} />
            <Card padded={false}>
              <ListRow
                first
                title={tr('photos.title')}
                trailing={<Badge label={String(photos.length)} />}
                onPress={() => router.push('/photos')}
              />
              <ListRow
                title={tr('friends.title')}
                trailing={incoming ? <Badge tone="primary" label={String(incoming)} /> : undefined}
                onPress={() => router.push('/friends')}
              />
              <ListRow
                title={tr('privacy.title')}
                subtitle={tr(
                  visibility === 'public'
                    ? 'account.visPublic'
                    : visibility === 'friends'
                      ? 'account.visFriends'
                      : 'account.visPrivate',
                )}
                onPress={() => router.push('/privacy')}
              />
            </Card>
          </View>
        ) : null}
        <FadeInItem index={2} style={{ gap: space.md }}>
          <SectionTitle title={tr('profile.more')} />
          <Card padded={false}>
            <ListRow
              first
              title={tr('profile.reports')}
              trailing={reports.length ? <Badge label={String(reports.length)} /> : undefined}
              onPress={() => router.push('/reports')}
            />
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
                <Button
                  compact
                  style={{ flex: 1 }}
                  label={tr('account.signUp')}
                  onPress={() => router.push('/account/sign-up')}
                />
                <Button
                  compact
                  variant="secondary"
                  style={{ flex: 1 }}
                  label={tr('account.signIn')}
                  onPress={() => router.push('/account/sign-in')}
                />
              </View>
            </View>
          )}
        </FadeInItem>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  body: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: 28 },
  me: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    minHeight: 88,
  },
  join: { gap: space.lg, padding: space.lg, borderRadius: radius.lg, borderCurve: 'continuous' },
  joinActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
