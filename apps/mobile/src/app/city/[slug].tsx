import { coverOf, loc, type SweetTheme } from '@sezi/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ExhibitionCard } from '@/components/exhibition-card';
import { Button, Card, ListRow, Note, SectionTitle } from '@/components/ui';
import { ExternalIcon, InfoIcon } from '@/design/icons';
import { outline } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { photoUrl, useCities, useExhibitions, useInventoryBooks, useWorks } from '@/lib/works';
import { Image } from 'expo-image';

export default function CityScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useSweetTheme();
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
        <ActivityIndicator color={t.primaryText} />
      </View>
    );
  }

  const fmt = (n: number | null) => (n === null ? '—' : n.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB'));
  const cityBooks = (books ?? []).filter((b) => b.city_id === city.id).sort((a, b) => (a.volume ?? 0) - (b.volume ?? 0));
  const cityExh = (exhibitions ?? []).filter((e) => e.city?.slug === slug);
  // Kapak: ilin havadan çekilmiş bir fotoğrafı varsa o, yoksa ilk fotoğraflı eser.
  const withPhoto = (works ?? []).filter((w) => coverOf(w));
  const cover = withPhoto.flatMap((w) => w.photos).find((p) => p.kind === 'aerial') ?? (withPhoto[0] ? coverOf(withPhoto[0]) : undefined);
  const districts = new globalThis.Map<string, number>();
  for (const w of works ?? []) if (w.district) districts.set(w.district, (districts.get(w.district) ?? 0) + 1);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <Stack.Screen options={{ title: '' }} />
      {cover ? <Image source={{ uri: photoUrl(cover, 'full') }} placeholder={{ uri: photoUrl(cover, 'thumb') }} style={[s.cover, outline(t)]} contentFit="cover" transition={150} accessible={false} /> : null}
      <View style={s.hero}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Text style={[type.editorial, { color: t.text }]} accessibilityRole="header">
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
                trailing={<ExternalIcon color={t.primaryText} />}
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
                <View key={d} style={[s.district, outline(t)]} accessible accessibilityLabel={`${d}: ${n}`}>
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

function Stat({ value, label, t }: { value: string; label: string; t: SweetTheme }) {
  return (
    <View style={[statStyle.box, { backgroundColor: t.soft }, outline(t)]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[type.title, { color: t.text }]}>{value}</Text>
      <Text style={[type.meta, { color: t.textMuted }]}>{label}</Text>
    </View>
  );
}

const statStyle = StyleSheet.create({
  box: { flexGrow: 1, flexBasis: 100, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.md, borderCurve: 'continuous', gap: 4 },
});

const makeStyles = (t: SweetTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { padding: space.xl, gap: space.xl, paddingBottom: 56 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.background },
    cover: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: t.soft },
    hero: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
    stats: { flexWrap: 'wrap', flexDirection: 'row', gap: space.sm },
    districts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    district: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: space.sm,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      borderRadius: radius.md,
      borderCurve: 'continuous',
      backgroundColor: t.surface,
    },
  });
