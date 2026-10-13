import { Camera, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { ThemeColors } from '@sezi/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DeferredMap } from '@/components/deferred-map';
import { ScreenHeader } from '@/components/screen-header';
import { Badge, Chip } from '@/components/ui';
import { ChevronIcon, SearchIcon, TurnIcon } from '@/design/icons';
import { Medallion } from '@/design/motif';
import { radius, space, type, upper } from '@/design/type';
import { typeColor, WorkGlyph, WorkGlyphInline } from '@/design/work-glyph';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT, type Lang } from '@/lib/i18n';
import { boundsOf } from '@/lib/nav';
import { useSettings } from '@/lib/settings';
import { hasLocation, inventorySource, loc, useCities, useWorks, type CityRow, type WorkRow } from '@/lib/works';

// Harita noktaları liste glifleriyle aynı tür rengini taşır.
const circleColor = ['match', ['get', 'type'], ...Object.entries(typeColor).flat(), '#3A1A10'];
const PILOT_CITY = 'bursa';

export default function Explore() {
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const { settings, update } = useSettings();
  const { data: cities } = useCities();
  const active = (cities ?? []).filter((c) => c.is_active);
  const citySlug = active.some((c) => c.slug === settings.city) ? settings.city : (active[0]?.slug ?? settings.city);
  const city = active.find((c) => c.slug === citySlug);
  const { data: works, isLoading, error, refetch } = useWorks(citySlug);
  const [type_, setType] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);

  const selectCity = (slug: string) => {
    update({ city: slug });
    setType(null);
    setDistrict(null);
  };

  const types = useMemo(() => {
    const seen = new globalThis.Map<string, { name: string; n: number }>();
    for (const w of works ?? []) {
      const cur = seen.get(w.type_slug);
      seen.set(w.type_slug, { name: loc(w.type_name, lang), n: (cur?.n ?? 0) + 1 });
    }
    return [...seen].sort((a, b) => b[1].n - a[1].n);
  }, [works, lang]);

  const districts = useMemo(() => {
    const m = new globalThis.Map<string, number>();
    for (const w of works ?? []) if (w.district) m.set(w.district, (m.get(w.district) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [works]);

  const visible = useMemo(
    () =>
      (works ?? [])
        .filter((w) => (!type_ || w.type_slug === type_) && (!district || w.district === district))
        .sort((a, b) => loc(a.name, lang).localeCompare(loc(b.name, lang), lang)),
    [works, type_, district, lang],
  );
  const mapped = useMemo(() => visible.filter(hasLocation), [visible]);

  const geojson = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: mapped.map((w) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [w.lng, w.lat] },
        properties: { slug: w.slug, type: w.type_slug },
      })),
    }),
    [mapped],
  );
  const bounds = mapped.length > 1 ? boundsOf(mapped.map((w) => [w.lng, w.lat])) : null;

  const open = (slug: string) => router.push({ pathname: '/work/[slug]', params: { slug } });

  const header = (
    <View style={s.header}>
      <ScreenHeader eyebrow={tr('inv.eyebrow')} title={tr('explore.title')} />

      {/* İl seçici: envanterin çalışma illeri */}
      <View style={s.cityRow} accessibilityRole="radiogroup" accessibilityLabel={tr('city.eyebrow')}>
        {active.map((c) => {
          const on = c.slug === citySlug;
          return (
            <Pressable
              key={c.slug}
              onPress={() => selectCity(c.slug)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[s.cityTab, on && { backgroundColor: t.text, borderColor: t.text }]}>
              <Text style={[type.button, { color: on ? t.background : t.text }]}>{loc(c.name, lang)}</Text>
            </Pressable>
          );
        })}
      </View>

      {city ? <CityCard city={city} listed={works?.length ?? 0} t={t} lang={lang} s={s} /> : null}

      <Pressable onPress={() => router.push('/search')} accessibilityRole="search" accessibilityLabel={tr('explore.searchCta')} style={s.search}>
        <SearchIcon color={t.textMuted} />
        <Text style={[type.body, { color: t.textMuted, flex: 1 }]}>{tr('explore.searchCta')}</Text>
      </Pressable>

      <View style={s.map} accessible accessibilityLabel={tr('explore.mapLabel', { n: mapped.length })} importantForAccessibility="no-hide-descendants">
        <DeferredMap key={citySlug}>
          {bounds ? <Camera initialViewState={{ bounds, padding: { top: 32, bottom: 32, left: 32, right: 32 } }} /> : null}
          <GeoJSONSource
            id="works"
            data={geojson}
            cluster
            clusterRadius={42}
            clusterMaxZoom={15}
            onPress={(e) => {
              const slug = e.nativeEvent.features[0]?.properties?.slug;
              if (typeof slug === 'string') open(slug);
            }}>
            <Layer
              id="clusters"
              type="circle"
              filter={['has', 'point_count']}
              paint={{ 'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 40, 26] as never, 'circle-color': t.primary, 'circle-stroke-width': 3, 'circle-stroke-color': t.surface }}
            />
            <Layer
              id="cluster-count"
              type="symbol"
              filter={['has', 'point_count']}
              layout={{ 'text-field': ['get', 'point_count_abbreviated'] as never, 'text-size': 13, 'text-font': ['Noto Sans Bold'] }}
              paint={{ 'text-color': t.onPrimary }}
            />
            <Layer
              id="works-circle"
              type="circle"
              filter={['!', ['has', 'point_count']] as never}
              paint={{ 'circle-radius': 8, 'circle-color': circleColor as never, 'circle-stroke-width': 2, 'circle-stroke-color': t.surface }}
            />
          </GeoJSONSource>
        </DeferredMap>
      </View>

      {citySlug === PILOT_CITY ? (
        <Pressable onPress={() => router.push('/tours')} accessibilityRole="button" style={({ pressed }) => [s.pilot, pressed && { opacity: 0.9 }]}>
          <View style={s.pilotIcon}>
            <TurnIcon turn="slight_right" color={t.onAccent} size={22} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.itemTitle, { color: t.onAccent }]}>{tr('inv.pilot')}</Text>
            <Text style={[type.meta, { color: t.onAccent, opacity: 0.9 }]}>{tr('inv.pilotBody')}</Text>
          </View>
          <ChevronIcon color={t.onAccent} />
        </Pressable>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={s.chipsRow}>
        <Chip label={tr('explore.all')} selected={type_ === null} onPress={() => setType(null)} />
        {types.map(([slug, { name, n }]) => (
          <Chip
            key={slug}
            label={`${name} ${n}`}
            selected={type_ === slug}
            onPress={() => setType(type_ === slug ? null : slug)}
            icon={(c) => <WorkGlyphInline slug={slug} color={c} size={18} />}
          />
        ))}
      </ScrollView>
      {districts.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={s.chipsRow}>
          <Chip label={tr('inv.allDistricts')} selected={district === null} onPress={() => setDistrict(null)} />
          {districts.map(([d, n]) => (
            <Chip key={d} label={`${d} ${n}`} selected={district === d} onPress={() => setDistrict(district === d ? null : d)} />
          ))}
        </ScrollView>
      ) : null}
      <Text style={[type.meta, { color: t.textMuted }]} accessibilityLiveRegion="polite">
        {tr('search.results', { n: visible.length })}
      </Text>
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
        initialNumToRender={12}
        renderItem={({ item }) => (
          <WorkCard work={item} onPress={() => open(item.slug)} t={t} lang={lang} hint={tr('explore.cardHint')} unlocated={tr('inv.unlocated')} />
        )}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={t.primary} style={{ marginTop: space.xl }} accessibilityLabel={tr('explore.loading')} />
          ) : error ? (
            <View style={s.empty}>
              <Text style={[type.body, { color: t.text }]}>{tr('explore.error')}</Text>
              <Chip label={tr('explore.retry')} selected onPress={() => refetch()} />
            </View>
          ) : (
            <Text style={[type.body, { color: t.textMuted }]}>{tr('explore.empty')}</Text>
          )
        }
      />
    </SafeAreaView>
  );
}

function CityCard({ city, listed, t, lang, s }: { city: CityRow; listed: number; t: ThemeColors; lang: Lang; s: ReturnType<typeof makeStyles> }) {
  const { t: tr } = useT();
  const fmt = (n: number | null) => (n === null ? '—' : n.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB'));
  const summary = tr('inv.cityCard', { year: city.inventory_year ?? '', works: fmt(city.inventory_works), photos: fmt(city.inventory_photos) });
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/city/[slug]', params: { slug: city.slug } })}
      accessibilityRole="button"
      accessibilityLabel={`${loc(city.name, lang)}. ${summary}. ${tr('inv.listed', { n: listed })}`}
      style={({ pressed }) => [s.cityCard, pressed && { opacity: 0.92 }]}>
      <Medallion primary={t.onPrimary} accent={t.accent} ink={t.primary} size={52} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.eyebrow, { color: t.onPrimary, opacity: 0.85 }]}>{upper(tr(`inv.status.${city.inventory_status ?? 'planned'}`), lang)}</Text>
        <Text style={[type.title, { color: t.onPrimary, fontSize: 24, lineHeight: 30 }]}>{loc(city.name, lang)}</Text>
        <Text style={[type.meta, { color: t.onPrimary, opacity: 0.9 }]}>{summary}</Text>
      </View>
      <ChevronIcon color={t.onPrimary} />
    </Pressable>
  );
}

function WorkCard({ work, onPress, t, lang, hint, unlocated }: { work: WorkRow; onPress: () => void; t: ThemeColors; lang: Lang; hint: string; unlocated: string }) {
  const name = loc(work.name, lang);
  const kind = loc(work.type_name, lang);
  const inv = inventorySource(work);
  const meta = [kind, work.district].filter(Boolean).join(' · ');
  const ref = inv ? `${inv.volume ? `C.${inv.volume} ` : ''}s.${inv.page}` : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[name, kind, work.district, !hasLocation(work) ? unlocated : null].filter(Boolean).join(', ')}
      accessibilityHint={hint}
      style={({ pressed }) => [cardStyles.card, { backgroundColor: pressed ? t.background : t.surface, borderColor: t.border }]}>
      <WorkGlyph slug={work.type_slug} size={52} />
      <View style={cardStyles.text}>
        <Text style={[type.itemTitle, { color: t.text }]} numberOfLines={2}>
          {name}
        </Text>
        <Text style={[type.meta, { color: t.textMuted }]} numberOfLines={1}>
          {meta}
        </Text>
        <View style={cardStyles.badges}>
          {ref ? <Badge label={ref} /> : null}
          {work.unesco ? <Badge label="UNESCO" tone="primary" /> : null}
          {!hasLocation(work) ? <Badge label={unlocated} tone="accent" /> : null}
        </View>
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
    cityRow: { flexDirection: 'row', gap: space.sm },
    cityTab: { flex: 1, minHeight: 48, borderRadius: radius.pill, borderWidth: 1.5, borderColor: t.border, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' },
    cityCard: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg, borderRadius: radius.lg, backgroundColor: t.primary },
    search: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1.5, borderColor: t.border, backgroundColor: t.surface },
    map: { height: 300, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: t.border, backgroundColor: t.surface },
    pilot: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: t.accent },
    pilotIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: t.onAccent, alignItems: 'center', justifyContent: 'center' },
    chipsRow: { marginHorizontal: -space.lg },
    chips: { gap: space.sm, paddingHorizontal: space.lg },
    empty: { gap: space.md, alignItems: 'flex-start', paddingTop: space.lg },
  });

const cardStyles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, paddingRight: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  text: { flex: 1, gap: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
