import type { ThemeColors } from '@sezi/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ExhibitionCard } from '@/components/exhibition-card';
import { Button, Card, Eyebrow, ListRow, Note, SectionTitle } from '@/components/ui';
import { ExternalIcon, InfoIcon } from '@/design/icons';
import { KilimBand, Medallion } from '@/design/motif';
import { radius, space, type } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { loc, useCities, useExhibitions, useInventoryBooks, useWorks } from '@/lib/works';

export default function CityScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const { update } = useSettings();
  const { data: cities, isLoading } = useCities();
  const { data: works } = useWorks(slug);
  const { data: books } = useInventoryBooks();
  const { data: exhibitions } = useExhibitions();
  const city = cities?.find((c) => c.slug === slug);

  if (isLoading || !city) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }

  const fmt = (n: number | null) => (n === null ? '—' : n.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB'));
  const cityBooks = (books ?? []).filter((b) => b.city_id === city.id).sort((a, b) => (a.volume ?? 0) - (b.volume ?? 0));
  const cityExh = (exhibitions ?? []).filter((e) => e.city?.slug === slug);
  const districts = new globalThis.Map<string, number>();
  for (const w of works ?? []) if (w.district) districts.set(w.district, (districts.get(w.district) ?? 0) + 1);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <Stack.Screen options={{ title: '' }} />
      <View style={s.hero}>
        <Medallion primary={t.primary} accent={t.accent} ink={t.text} size={88} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Eyebrow text={tr('city.eyebrow')} />
          <Text style={[type.display, { color: t.text }]} accessibilityRole="header">
            {loc(city.name, lang)}
          </Text>
          <Text style={[type.meta, { color: t.textMuted }]}>{tr(`inv.status.${city.inventory_status ?? 'planned'}`)}</Text>
        </View>
      </View>

      <View style={s.stats}>
        <Stat value={fmt(city.inventory_works)} label={tr('city.works')} t={t} />
        <Stat value={fmt(city.inventory_photos)} label={tr('city.photos')} t={t} />
        <Stat value={String(city.inventory_year ?? '—')} label={tr('city.year')} t={t} />
      </View>

      {city.inventory_note ? <Note text={loc(city.inventory_note, lang)} icon={<InfoIcon color={t.textMuted} />} /> : null}

      <Button
        label={tr('city.explore')}
        onPress={() => {
          update({ city: city.slug });
          router.navigate('/');
        }}
      />

      {t.motifOpacity > 0 ? (
        <View style={{ height: 10, marginHorizontal: -space.lg }}>
          <KilimBand color={t.accent} accent={t.primary} height={10} opacity={0.6} />
        </View>
      ) : null}

      {cityBooks.length ? (
        <View style={{ gap: space.md }}>
          <SectionTitle title={tr('city.books')} />
          <Card padded={false}>
            {cityBooks.map((b, i) => (
              <ListRow
                key={b.id}
                first={i === 0}
                title={b.title}
                subtitle={[b.year ? String(b.year) : null, 'Vakıf Katılım'].filter(Boolean).join(' · ')}
                hint={tr('inv.openBookHint')}
                trailing={<ExternalIcon color={t.primary} />}
                onPress={b.url ? () => Linking.openURL(b.url!) : undefined}
              />
            ))}
          </Card>
        </View>
      ) : null}

      {cityExh.length ? (
        <View style={{ gap: space.md }}>
          <SectionTitle title={tr('city.exhibitions')} />
          {cityExh.map((e) => (
            <ExhibitionCard key={e.id} exhibition={e} />
          ))}
        </View>
      ) : null}

      {districts.size ? (
        <View style={{ gap: space.md }}>
          <SectionTitle title={tr('city.districts')} />
          <View style={s.districts}>
            {[...districts]
              .sort((a, b) => b[1] - a[1])
              .map(([d, n]) => (
                <View key={d} style={s.district} accessible accessibilityLabel={`${d}: ${n}`}>
                  <Text style={[type.itemTitle, { color: t.text, fontSize: 16 }]}>{d}</Text>
                  <Text style={[type.meta, { color: t.textMuted }]}>{n}</Text>
                </View>
              ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Stat({ value, label, t }: { value: string; label: string; t: ThemeColors }) {
  return (
    <View style={[statStyle.box, { backgroundColor: t.surface, borderColor: t.border }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[type.title, { color: t.text, fontSize: 24, lineHeight: 30 }]}>{value}</Text>
      <Text style={[type.meta, { color: t.textMuted }]}>{label}</Text>
    </View>
  );
}

const statStyle = StyleSheet.create({ box: { flex: 1, padding: space.md, borderRadius: radius.md, borderWidth: 1, gap: 2 } });

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { padding: space.lg, gap: space.xl, paddingBottom: 56 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.background },
    hero: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
    stats: { flexDirection: 'row', gap: space.sm },
    districts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    district: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface },
  });
