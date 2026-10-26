import { loc } from '@sezi/shared';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { Card, EmptyState, ListRow, ProgressBar, SectionTitle } from '@/components/ui';
import { space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useAchievements } from '@/lib/achievements';
import { useT } from '@/lib/i18n';
import { usePassport } from '@/lib/passport';
import { useCities, useWorks } from '@/lib/works';

export default function PassportScreen() {
  const t = useSweetTheme();
  const { t: tr, lang } = useT();
  const { stats } = useAchievements();
  const { visits } = usePassport();
  const { data: works = [] } = useWorks();
  const { data: cities = [] } = useCities();
  const bySlug = new Map(works.map((work) => [work.slug, work]));
  const stamps = [...visits]
    .filter((visit) => bySlug.has(visit.work_slug))
    .sort((a, b) => b.first_at.localeCompare(a.first_at));
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingBottom: space.xxl }}>
      <SectionTitle title={tr('passport.overview')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {[
          { label: tr('passport.stamps', { n: stats.stamps }), value: String(stats.stamps) },
          { label: tr('passport.types'), value: String(stats.types) },
          { label: tr('passport.distance'), value: (stats.distanceM / 1000).toFixed(1) },
        ].map((item) => (
          <Card key={item.label} style={{ flex: 1, minWidth: 88, gap: space.sm }}>
            <Text style={[type.title, { color: t.primaryText }]}>{item.value}</Text>
            <Text style={[type.meta, { color: t.text }]}>{item.label}</Text>
          </Card>
        ))}
      </View>
      {stats.cities.length ? (
        <View style={{ gap: space.lg }}>
          <SectionTitle title={tr('passport.cityProgress')} />
          {stats.cities.map((city) => {
            const row = cities.find((item) => item.slug === city.slug);
            const name = row ? loc(row.name, lang) : city.slug;
            return (
              <Card key={city.slug} style={{ gap: space.sm }}>
                <Text style={[type.itemTitle, { color: t.text }]}>{name}</Text>
                <ProgressBar value={city.visited} max={city.total} label={name} />
              </Card>
            );
          })}
        </View>
      ) : null}
      <SectionTitle title={tr('passport.recent')} />
      {stamps.length ? (
        <Card padded={false}>
          {stamps.map((visit, index) => (
            <ListRow
              key={visit.work_slug}
              first={index === 0}
              title={loc(bySlug.get(visit.work_slug)!.name, lang)}
              subtitle={`${new Date(visit.first_at).toLocaleDateString(lang)} · ${tr(visit.method === 'checkin' ? 'passport.byCheckin' : 'passport.byRoute')}`}
              onPress={() => router.push({ pathname: '/work/[slug]', params: { slug: visit.work_slug } })}
            />
          ))}
        </Card>
      ) : (
        <EmptyState title={tr('passport.empty')} />
      )}
    </ScrollView>
  );
}
