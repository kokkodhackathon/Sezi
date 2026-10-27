import { loc } from '@sezi/shared';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { StampGrid } from '@/components/social-grids';
import { EmptyInvite, EmptyPassportArt, StatStrip } from '@/components/social-visuals';
import { Button, ProgressBar, SectionTitle } from '@/components/ui';
import { FootprintsIcon, MapAreaIcon, RouteIcon, StampIcon } from '@/design/icons';
import { space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useAchievements } from '@/lib/achievements';
import { useT } from '@/lib/i18n';
import { usePassport } from '@/lib/passport';
import { useCities, useWorks } from '@/lib/works';

/** Vakıf Pasaportu: sayı şeridi, damga ızgarası, il ilerlemesi. */
export default function PassportScreen() {
  const t = useSweetTheme();
  const { t: tr, lang } = useT();
  const { stats } = useAchievements();
  const { visits } = usePassport();
  const { data: works = [] } = useWorks();
  const { data: cities = [] } = useCities();
  const bySlug = new Map(works.map((work) => [work.slug, work]));
  const visited = stats.cities.filter((city) => city.visited > 0);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingBottom: space.xxl }}>
      <StatStrip
        items={[
          { icon: StampIcon, value: String(stats.stamps), label: tr('stat.stamps') },
          { icon: MapAreaIcon, value: String(visited.length), label: tr('stat.cities') },
          { icon: FootprintsIcon, value: (stats.distanceM / 1000).toLocaleString(lang, { maximumFractionDigits: 1 }), label: tr('stat.km') },
          ...(stats.toursDone.length ? [{ icon: RouteIcon, value: String(stats.toursDone.length), label: tr('stat.tours') }] : []),
        ]}
      />
      {stats.stamps ? (
        <View style={{ gap: space.lg }}>
          <SectionTitle title={tr('passport.recent')} />
          <StampGrid visits={visits} works={bySlug} />
        </View>
      ) : (
        <EmptyInvite
          art={<EmptyPassportArt />}
          text={tr('passport.emptyInvite')}
          action={<Button variant="secondary" label={tr('passport.findWork')} onPress={() => router.push('/')} />}
        />
      )}
      {visited.length ? (
        <View style={{ gap: space.lg }}>
          <SectionTitle title={tr('passport.cityProgress')} />
          {visited.map((city) => {
            const row = cities.find((item) => item.slug === city.slug);
            const name = row ? loc(row.name, lang) : city.slug;
            return (
              <View key={city.slug} style={{ gap: space.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} importantForAccessibility="no-hide-descendants">
                  <Text style={[type.itemTitle, { color: t.text }]}>{name}</Text>
                  <Text style={[type.meta, { color: t.textMuted }]}>
                    {city.visited}/{city.total}
                  </Text>
                </View>
                <ProgressBar compact value={city.visited} max={city.total} label={name} />
              </View>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}
