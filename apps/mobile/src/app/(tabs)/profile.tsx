import { router } from 'expo-router';
import type { ComponentType } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTabBarSpace } from '@/components/app-tabs';
import { Avatar } from '@/components/avatar';
import { ProfileCard } from '@/components/profile-card';
import { ScreenHeader } from '@/components/screen-header';
import { sortAchievements } from '@/components/social-grids';
import { AchievementIcon, EmptyStamp, FriendsArt, Stamp, StatStrip } from '@/components/social-visuals';
import { Badge, Button, Card, ListRow, SectionTitle } from '@/components/ui';
import { CameraIcon, ChevronIcon, FootprintsIcon, MapAreaIcon, ShieldIcon, StampIcon, UsersIcon } from '@/design/icons';
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

type Icon = ComponentType<{ color: string; size?: number }>;

/**
 * Profil sekmesi: kimlik, pasaport (son damgalar + sayılar), başarımlar, topluluk kutucukları,
 * algısal profil ve diğer bağlantılar. Az yazı: ayrıntı dokununca açılan ekranlarda.
 */
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
  const { data: works = [] } = useWorks();
  const tabSpace = useTabBarSpace();
  if (!profile) return null;
  const bySlug = new Map(works.map((work) => [work.slug, work]));
  const stamps = [...visits]
    .filter((visit) => bySlug.has(visit.work_slug))
    .sort((a, b) => b.first_at.localeCompare(a.first_at));
  const { earned, locked } = sortAchievements(list);
  const preview = [...earned.slice(0, 3), ...locked.slice(0, 1)];
  const cities = stats.cities.filter((city) => city.visited > 0).length;
  const visibility = identity?.visibility ?? 'private';
  const card = [s.card, { backgroundColor: t.surface }, outline(t)];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.background }} edges={['top']}>
      <ScrollView contentContainerStyle={[s.body, { paddingBottom: tabSpace }]}>
        <ScreenHeader title={tr('profile.title')} />

        {user ? (
          <FadeInItem index={0}>
            <SoftPressable
              onPress={() => router.push('/account')}
              accessibilityRole="button"
              accessibilityLabel={`${identity?.display_name ?? user.email ?? ''}${identity?.username ? `, @${identity.username}` : ''}`}
              accessibilityHint={tr('profile.accountOpen')}
              style={s.me}>
              <Avatar identity={identity} source={avatar} size={64} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.title, { color: t.text }]} numberOfLines={2}>
                  {identity?.display_name ?? user.email}
                </Text>
                {identity?.username ? (
                  <Text style={[type.meta, { color: t.textMuted }]} numberOfLines={1}>
                    @{identity.username}
                  </Text>
                ) : null}
              </View>
              <ChevronIcon color={t.textMuted} />
            </SoftPressable>
          </FadeInItem>
        ) : null}

        <FadeInItem index={1}>
          <SoftPressable
            onPress={() => router.push('/passport')}
            accessibilityRole="button"
            accessibilityLabel={`${tr('passport.title')}. ${stats.stamps} ${tr('stat.stamps')}, ${cities} ${tr('stat.cities')}`}
            accessibilityHint={tr('passport.open')}
            style={card}>
            <CardHead title={tr('passport.title')} />
            <View style={s.stamps} importantForAccessibility="no-hide-descendants">
              {stamps.length
                ? stamps.slice(0, 3).map((visit) => (
                    <Stamp key={visit.work_slug} slug={visit.work_slug} typeSlug={bySlug.get(visit.work_slug)!.type_slug} size={68} />
                  ))
                : [0, 1, 2].map((i) => <EmptyStamp key={i} size={68} />)}
              {stamps.length > 3 ? (
                <View style={[s.more, { backgroundColor: t.soft }, outline(t)]}>
                  <Text style={[type.cardTitle, { color: t.text }]}>+{stamps.length - 3}</Text>
                </View>
              ) : null}
            </View>
            <View importantForAccessibility="no-hide-descendants">
              <StatStrip
                items={[
                  { icon: StampIcon, value: String(stats.stamps), label: tr('stat.stamps') },
                  { icon: MapAreaIcon, value: String(cities), label: tr('stat.cities') },
                  {
                    icon: FootprintsIcon,
                    value: (stats.distanceM / 1000).toLocaleString(lang, { maximumFractionDigits: 1 }),
                    label: tr('stat.km'),
                  },
                ]}
              />
            </View>
          </SoftPressable>
        </FadeInItem>

        <FadeInItem index={2}>
          <SoftPressable
            onPress={() => router.push('/achievements')}
            accessibilityRole="button"
            accessibilityLabel={`${tr('ach.title')}. ${tr('ach.count', { n: earned.length, total: list.length })}`}
            style={card}>
            <CardHead title={tr('ach.title')} trailing={`${earned.length}/${list.length}`} />
            <View style={s.badges} importantForAccessibility="no-hide-descendants">
              {preview.map((a) => (
                <AchievementIcon key={a.id} achievement={a} size={60} />
              ))}
            </View>
          </SoftPressable>
        </FadeInItem>

        <FadeInItem index={3} style={{ gap: space.md }}>
          <SectionTitle title={tr('profile.community')} />
          {user ? (
            <View style={s.tiles}>
              <CommunityTile icon={CameraIcon} label={tr('photos.short')} count={photos.length || undefined} onPress={() => router.push('/photos')} />
              <CommunityTile
                icon={UsersIcon}
                label={tr('friends.title')}
                count={incoming || undefined}
                countLabel={incoming ? tr('friends.incomingCount', { n: incoming }) : undefined}
                highlight={!!incoming}
                onPress={() => router.push('/friends')}
              />
              <CommunityTile
                icon={ShieldIcon}
                label={tr('privacy.title')}
                countLabel={tr(`photos.vis.${visibility}`)}
                onPress={() => router.push('/privacy')}
              />
            </View>
          ) : (
            <View style={[card, { alignItems: 'center', gap: space.lg }]}>
              <FriendsArt />
              <Text style={[type.itemTitle, { color: t.text, textAlign: 'center' }]}>{tr('profile.joinShort')}</Text>
              <View style={s.joinActions}>
                <Button compact style={{ flex: 1 }} label={tr('account.signUp')} onPress={() => router.push('/account/sign-up')} />
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

        <FadeInItem index={4}>
          <ProfileCard profile={profile} onEdit={(field) => router.push({ pathname: '/onboarding', params: { step: field } })} />
        </FadeInItem>

        <FadeInItem index={5} style={{ gap: space.md }}>
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
      </ScrollView>
    </SafeAreaView>
  );
}

/** Kart başlığı: ad, isteğe bağlı sayı ve ok. Etiketi kartın kendisi taşır. */
function CardHead({ title, trailing }: { title: string; trailing?: string }) {
  const t = useSweetTheme();
  return (
    <View style={s.head} importantForAccessibility="no-hide-descendants">
      <Text style={[type.heading, { color: t.text, flex: 1 }]}>{title}</Text>
      {trailing ? <Text style={[type.meta, { color: t.textMuted }]}>{trailing}</Text> : null}
      <ChevronIcon color={t.textMuted} />
    </View>
  );
}

/** Topluluk kutucuğu: büyük simge, kısa ad, köşede sayaç (gelen istek varsa firuze). */
function CommunityTile({
  icon: I,
  label,
  count,
  countLabel,
  highlight,
  onPress,
}: {
  icon: Icon;
  label: string;
  count?: number;
  countLabel?: string;
  highlight?: boolean;
  onPress: () => void;
}) {
  const t = useSweetTheme();
  return (
    <SoftPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[label, countLabel ?? (count ? String(count) : null)].filter(Boolean).join(', ')}
      style={[s.tile, { backgroundColor: t.surface }, outline(t)]}>
      <View style={[s.tileIcon, { backgroundColor: highlight && !t.outlined ? t.primary.fill : t.soft }]}>
        <I color={highlight && !t.outlined ? t.primary.ink : t.text} size={26} />
      </View>
      <Text style={[type.bubble, { color: t.text, textAlign: 'center' }]} numberOfLines={2}>
        {label}
      </Text>
      {count ? (
        <View style={[s.count, { backgroundColor: highlight ? t.primaryText : t.soft, borderColor: t.surface }]}>
          <Text style={[type.tab, { color: highlight ? t.background : t.text, fontFamily: type.button.fontFamily }]}>{count}</Text>
        </View>
      ) : null}
    </SoftPressable>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.xl },
  me: { flexDirection: 'row', alignItems: 'center', gap: space.lg, minHeight: 72 },
  card: { gap: space.lg, padding: space.lg, borderRadius: radius.lg, borderCurve: 'continuous' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stamps: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  more: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', gap: space.lg, paddingTop: 4 },
  tiles: { flexDirection: 'row', gap: space.md },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.lg,
    paddingHorizontal: space.sm,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    minHeight: 112,
  },
  tileIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  count: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignSelf: 'stretch' },
});
