import { Camera, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { ThemeColors } from '@sezi/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ChevronIcon, SearchIcon } from '@/design/icons';
import { Medallion } from '@/design/motif';
import { radius, space, type } from '@/design/type';
import { typeColor, WorkGlyph, WorkGlyphInline } from '@/design/work-glyph';
import { DeferredMap } from '@/components/deferred-map';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT, type Lang } from '@/lib/i18n';
import { loc, useWorks, type WorkRow } from '@/lib/works';

const SULEYMANIYE: [number, number] = [28.9639, 41.0162];

// Harita noktaları liste glifleriyle aynı tür rengini taşır.
const circleColor = ['match', ['get', 'type'], ...Object.entries(typeColor).flat(), '#3A1A10'];

export default function Explore() {
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const { data: works, isLoading, error, refetch } = useWorks();
  const [type_, setType] = useState<string | null>(null);

  const types = useMemo(() => {
    const seen = new globalThis.Map<string, string>();
    for (const w of works ?? []) seen.set(w.type_slug, loc(w.type_name, lang));
    return [...seen].sort((a, b) => a[1].localeCompare(b[1], lang));
  }, [works, lang]);

  const visible = useMemo(
    () =>
      (works ?? [])
        .filter((w) => !type_ || w.type_slug === type_)
        .sort((a, b) => loc(a.name, lang).localeCompare(loc(b.name, lang), lang)),
    [works, type_, lang],
  );

  const geojson = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: visible.map((w) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [w.lng, w.lat] },
        properties: { slug: w.slug, type: w.type_slug },
      })),
    }),
    [visible],
  );

  const open = (slug: string) => router.push({ pathname: '/work/[slug]', params: { slug } });

  const header = (
    <View style={s.header}>
      <ScreenHeader
        eyebrow={tr('explore.eyebrow')}
        title={tr('explore.title')}
        subtitle={works ? `${tr('explore.subtitle')} · ${tr('explore.count', { n: works.length })}` : tr('explore.subtitle')}
      />

      <Pressable
        onPress={() => router.push('/search')}
        accessibilityRole="search"
        accessibilityLabel={tr('explore.searchCta')}
        style={({ pressed }) => [s.search, pressed && { borderColor: t.primary }]}>
        <SearchIcon color={t.textMuted} />
        <Text style={[type.body, { color: t.textMuted, flex: 1 }]}>{tr('explore.searchCta')}</Text>
      </Pressable>

      <View
        style={s.map}
        accessible
        accessibilityLabel={tr('explore.mapLabel', { n: visible.length })}
        importantForAccessibility="no-hide-descendants">
        <DeferredMap>
          <Camera initialViewState={{ center: SULEYMANIYE, zoom: 15.7 }} />
          <GeoJSONSource
            id="works"
            data={geojson}
            onPress={(e) => {
              const slug = e.nativeEvent.features[0]?.properties?.slug;
              if (typeof slug === 'string') open(slug);
            }}>
            <Layer id="works-halo" type="circle" paint={{ 'circle-radius': 13, 'circle-color': t.surface, 'circle-opacity': 0.9 }} />
            <Layer
              id="works-circle"
              type="circle"
              paint={{ 'circle-radius': 9, 'circle-color': circleColor as never, 'circle-stroke-width': 2, 'circle-stroke-color': t.surface }}
            />
          </GeoJSONSource>
        </DeferredMap>
      </View>

      <Pressable
        onPress={() => router.push({ pathname: '/complex/[slug]', params: { slug: 'suleymaniye' } })}
        accessibilityRole="button"
        accessibilityHint={tr('explore.complexCtaHint')}
        style={({ pressed }) => [s.complex, pressed && { opacity: 0.9 }]}>
        <Medallion primary={t.onPrimary} accent={t.accent} ink={t.primary} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.itemTitle, { color: t.onPrimary }]}>{tr('explore.complexCta')}</Text>
          <Text style={[type.meta, { color: t.onPrimary, opacity: 0.85 }]}>{tr('explore.subtitle')}</Text>
        </View>
        <ChevronIcon color={t.onPrimary} />
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={s.chipsRow}>
        <Chip label={tr('explore.all')} selected={type_ === null} onPress={() => setType(null)} t={t} />
        {types.map(([slug, name]) => (
          <Chip key={slug} slug={slug} label={name} selected={type_ === slug} onPress={() => setType(slug)} t={t} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <FlatList
        data={visible}
        keyExtractor={(w) => w.id}
        ListHeaderComponent={header}
        contentContainerStyle={s.list}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        renderItem={({ item }) => (
          <WorkCard work={item} onPress={() => open(item.slug)} t={t} lang={lang} hint={tr('explore.cardHint')} />
        )}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={t.primary} style={{ marginTop: space.xl }} accessibilityLabel={tr('explore.loading')} />
          ) : error ? (
            <View style={s.empty}>
              <Text style={[type.body, { color: t.text }]}>{tr('explore.error')}</Text>
              <Chip label={tr('explore.retry')} selected onPress={() => refetch()} t={t} />
            </View>
          ) : (
            <Text style={[type.body, { color: t.textMuted }]}>{tr('explore.empty')}</Text>
          )
        }
      />
    </SafeAreaView>
  );
}

function Chip({ label, slug, selected, onPress, t }: { label: string; slug?: string; selected: boolean; onPress: () => void; t: ThemeColors }) {
  const fg = selected ? t.onPrimary : t.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        chipStyles.chip,
        { borderColor: selected ? t.primary : t.border, backgroundColor: selected ? t.primary : t.surface },
        pressed && { opacity: 0.85 },
      ]}>
      {slug ? <WorkGlyphInline slug={slug} color={fg} size={18} /> : null}
      <Text style={[type.button, { color: fg, fontSize: 15 }]}>{label}</Text>
    </Pressable>
  );
}

function WorkCard({ work, onPress, t, lang, hint }: { work: WorkRow; onPress: () => void; t: ThemeColors; lang: Lang; hint: string }) {
  const name = loc(work.name, lang);
  const kind = loc(work.type_name, lang);
  const complex = loc(work.complex_name, lang);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[name, kind, complex].filter(Boolean).join(', ')}
      accessibilityHint={hint}
      style={({ pressed }) => [cardStyles.card, { backgroundColor: pressed ? t.background : t.surface, borderColor: t.border }]}>
      <WorkGlyph slug={work.type_slug} size={52} />
      <View style={cardStyles.text}>
        <Text style={[type.itemTitle, { color: t.text }]} numberOfLines={2}>
          {name}
        </Text>
        <Text style={[type.meta, { color: t.textMuted }]} numberOfLines={1}>
          {complex ? `${kind} · ${complex}` : kind}
        </Text>
      </View>
      <ChevronIcon color={t.textMuted} />
    </Pressable>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    list: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
    header: { gap: space.lg, paddingBottom: space.md },
    map: { height: 280, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: t.border, backgroundColor: t.surface },
    chipsRow: { marginHorizontal: -space.lg },
    search: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1.5, borderColor: t.border, backgroundColor: t.surface },
    complex: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg, borderRadius: radius.lg, backgroundColor: t.primary },
    chips: { gap: space.sm, paddingHorizontal: space.lg },
    empty: { gap: space.md, alignItems: 'flex-start', paddingTop: space.lg },
  });

const chipStyles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1 },
});

const cardStyles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, paddingRight: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  text: { flex: 1, gap: 2 },
});
