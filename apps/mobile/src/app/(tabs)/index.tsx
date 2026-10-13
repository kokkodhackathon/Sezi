import { Camera, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { ThemeColors } from '@sezi/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DeferredMap } from '@/components/deferred-map';
import { ScreenHeader } from '@/components/screen-header';
import { Button, Chip, EmptyState, ListRow, Segmented, SectionTitle } from '@/components/ui';
import { ChevronIcon, CloseIcon, FilterIcon, SearchIcon, TurnIcon } from '@/design/icons';
import { radius, type } from '@/design/type';
import { typeColor, WorkGlyphInline } from '@/design/work-glyph';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT, type Lang } from '@/lib/i18n';
import { boundsOf } from '@/lib/nav';
import { useSettings } from '@/lib/settings';
import { hasLocation, inventorySource, loc, useCities, useWorks, type WorkRow } from '@/lib/works';

export default function Explore() {
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const { data: cities, error: cityError, refetch: reloadCities } = useCities();
  const active = (cities ?? []).filter((c) => c.is_active);
  const citySlug = active.some((c) => c.slug === settings.city) ? settings.city : (active[0]?.slug ?? settings.city);
  const city = active.find((c) => c.slug === citySlug);
  const { data: works, isLoading, error, refetch } = useWorks(citySlug);
  const [kind, setKind] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [panel, setPanel] = useState<'cities' | 'filters' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const count = Number(!!kind) + Number(!!district);
  const types = useMemo(() => {
    const values = new Map<string, string>();
    for (const w of works ?? []) values.set(w.type_slug, loc(w.type_name, lang));
    return [...values].sort((a, b) => a[1].localeCompare(b[1], lang));
  }, [works, lang]);
  const districts = useMemo(() => [...new Set((works ?? []).flatMap((w) => w.district ? [w.district] : []))].sort((a, b) => a.localeCompare(b, lang)), [works, lang]);
  const visible = useMemo(() => (works ?? [])
    .filter((w) => (!kind || w.type_slug === kind) && (!district || w.district === district))
    .sort((a, b) => loc(a.name, lang).localeCompare(loc(b.name, lang), lang)), [works, kind, district, lang]);
  const mapped = visible.filter(hasLocation);
  const selectedWork = visible.find((w) => w.slug === selected);
  const bounds = mapped.length > 1 ? boundsOf(mapped.map((w) => [w.lng, w.lat])) : null;
  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: mapped.map((w) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [w.lng, w.lat] }, properties: { slug: w.slug, type: w.type_slug } })),
  };
  const colors = ['match', ['get', 'type'], ...Object.entries(typeColor).flat(), t.text];
  const open = (slug: string) => router.push({ pathname: '/work/[slug]', params: { slug } });
  const chooseCity = (slug: string) => { update({ city: slug }); setKind(null); setDistrict(null); setSelected(null); setPanel(null); };

  const header = (
    <View style={s.header}>
      <ScreenHeader title={tr('explore.title')} />
      <Pressable onPress={() => setPanel('cities')} accessibilityRole="button" accessibilityLabel={tr('design.chooseCity')} accessibilityHint={city ? loc(city.name, lang) : undefined} style={s.city}>
        <Text style={[type.itemTitle, { color: t.text, flex: 1 }]}>{city ? loc(city.name, lang) : tr('design.chooseCity')}</Text>
        <ChevronIcon color={t.primary} size={18} />
      </Pressable>
      <Pressable onPress={() => router.push('/search')} accessibilityRole="button" accessibilityLabel={tr('explore.searchCta')} style={s.search}>
        <SearchIcon color={t.textMuted} />
        <Text style={[type.body, { color: t.textMuted, flex: 1 }]}>{tr('explore.searchCta')}</Text>
      </Pressable>
      <View style={s.tools}>
        <View style={{ flex: 1 }}>
          <Segmented label={tr('design.view')} value={view} onChange={setView} options={[{ value: 'list', label: tr('design.list') }, { value: 'map', label: tr('design.map') }]} />
        </View>
        <Pressable onPress={() => setPanel('filters')} accessibilityRole="button" accessibilityLabel={tr('design.filtersCount', { n: count })} style={[s.filter, { borderColor: count ? t.primary : t.textMuted }]}>
          <FilterIcon color={t.primary} />
          <Text style={[type.button, { color: t.primary, fontSize: 15, flexShrink: 1 }]}>{tr('design.filters')}{count ? ` (${count})` : ''}</Text>
        </Pressable>
      </View>
      {count > 0 ? <Text style={[type.meta, { color: t.textMuted }]}>{[types.find(([slug]) => slug === kind)?.[1], district].filter(Boolean).join(' · ')}</Text> : null}
      {citySlug === 'bursa' ? (
        <Pressable onPress={() => router.push('/tours')} accessibilityRole="button" accessibilityLabel={tr('design.pilotTitle')} accessibilityHint={tr('inv.pilotBody')} style={s.pilot}>
          <TurnIcon turn="slight_right" color={t.primary} size={24} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.itemTitle, { color: t.text }]}>{tr('design.pilotTitle')}</Text>
            <Text style={[type.meta, { color: t.textMuted }]}>{tr('design.pilotSubtitle')}</Text>
          </View>
          <ChevronIcon color={t.primary} size={18} />
        </Pressable>
      ) : null}
      {view === 'map' && mapped.length > 0 ? (
        <>
          <View style={s.map} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <DeferredMap key={`${citySlug}:${kind}:${district}`}>
              <Camera initialViewState={bounds ? { bounds, padding: { top: 40, bottom: 40, left: 40, right: 40 } } : { center: [mapped[0]!.lng, mapped[0]!.lat], zoom: 15 }} />
              <GeoJSONSource id="works" data={geojson} cluster clusterRadius={42} clusterMaxZoom={15} onPress={(e) => {
                const slug = e.nativeEvent.features[0]?.properties?.slug;
                if (typeof slug === 'string') setSelected(slug);
              }}>
                <Layer id="works-clusters" type="circle" filter={['has', 'point_count']} paint={{ 'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 40, 28] as never, 'circle-color': t.primary, 'circle-stroke-width': 3, 'circle-stroke-color': t.surface }} />
                <Layer id="works-cluster-label" type="symbol" filter={['has', 'point_count']} layout={{ 'text-field': ['get', 'point_count_abbreviated'] as never, 'text-size': 14, 'text-font': ['Noto Sans Bold'] }} paint={{ 'text-color': t.onPrimary }} />
                <Layer id="works-circle" type="circle" filter={['!', ['has', 'point_count']] as never} paint={{ 'circle-radius': 9, 'circle-color': colors as never, 'circle-stroke-width': 3, 'circle-stroke-color': t.surface }} />
                <Layer id="selected-work" type="circle" filter={['==', ['get', 'slug'], selected ?? '']} paint={{ 'circle-radius': 15, 'circle-color': t.primary, 'circle-stroke-width': 3, 'circle-stroke-color': t.surface }} />
              </GeoJSONSource>
            </DeferredMap>
          </View>
          <Text style={[type.meta, { color: t.textMuted }]}>{tr('design.mapHelp', { n: mapped.length })}</Text>
        </>
      ) : null}
      <Text style={[type.meta, { color: t.textMuted }]} accessibilityLiveRegion="polite">{isLoading ? tr('explore.loading') : tr('search.results', { n: visible.length })}</Text>
    </View>
  );

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <FlatList
        importantForAccessibility={panel ? 'no-hide-descendants' : 'auto'}
        data={view === 'list' ? visible : selectedWork ? [selectedWork] : []}
        keyExtractor={(w) => w.id}
        ListHeaderComponent={header}
        contentContainerStyle={s.list}
        initialNumToRender={10}
        renderItem={({ item }) => <WorkRowView work={item} t={t} lang={lang} onPress={() => open(item.slug)} />}
        ListEmptyComponent={isLoading ? <ActivityIndicator color={t.primary} accessibilityLabel={tr('explore.loading')} style={{ marginVertical: 24 }} /> : error || cityError ? (
          <EmptyState title={tr('explore.error')} action={<Button label={tr('explore.retry')} onPress={() => { void refetch(); void reloadCities(); }} />} />
        ) : view === 'map' && mapped.length ? null : <EmptyState title={tr('explore.empty')} action={count ? <Button variant="outline" label={tr('design.clearFilters')} onPress={() => { setKind(null); setDistrict(null); }} /> : undefined} />}
      />
      <Modal visible={panel !== null} transparent animationType="none" onRequestClose={() => setPanel(null)}>
        <View style={s.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPanel(null)} accessibilityRole="button" accessibilityLabel={tr('design.close')} />
          <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} accessibilityViewIsModal>
            <View style={s.sheetHead}>
              <Text style={[type.title, { color: t.text, flex: 1 }]} accessibilityRole="header">{tr(panel === 'cities' ? 'design.chooseCity' : 'design.filters')}</Text>
              <Pressable onPress={() => setPanel(null)} accessibilityRole="button" accessibilityLabel={tr('design.close')} style={s.close}><CloseIcon color={t.text} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={s.sheetBody}>
              {panel === 'cities' ? <>
                {active.map((c) => <ListRow key={c.id} title={loc(c.name, lang)} subtitle={c.slug === citySlug ? tr('design.selected') : undefined} onPress={() => chooseCity(c.slug)} />)}
                {city ? <Button variant="outline" label={tr('design.cityInfo')} onPress={() => { setPanel(null); router.push({ pathname: '/city/[slug]', params: { slug: city.slug } }); }} /> : null}
              </> : <>
                <SectionTitle title={tr('design.workType')} />
                <View style={s.chips}><Chip label={tr('explore.all')} selected={kind === null} onPress={() => setKind(null)} />{types.map(([slug, name]) => <Chip key={slug} label={name} selected={kind === slug} onPress={() => setKind(kind === slug ? null : slug)} />)}</View>
                <SectionTitle title={tr('inv.district')} />
                <View style={s.chips}><Chip label={tr('inv.allDistricts')} selected={district === null} onPress={() => setDistrict(null)} />{districts.map((name) => <Chip key={name} label={name} selected={district === name} onPress={() => setDistrict(district === name ? null : name)} />)}</View>
              </>}
            </ScrollView>
            {panel === 'filters' ? <View style={{ gap: 8, paddingHorizontal: 24 }}>
              <Button label={tr('design.showResults', { n: visible.length })} onPress={() => { setSelected(null); setPanel(null); }} />
              <Button variant="ghost" label={tr('design.clearFilters')} onPress={() => { setKind(null); setDistrict(null); setSelected(null); }} />
            </View> : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function WorkRowView({ work, t, lang, onPress }: { work: WorkRow; t: ThemeColors; lang: Lang; onPress: () => void }) {
  const { t: tr } = useT();
  const inv = inventorySource(work);
  const precision = !hasLocation(work) ? tr('inv.unlocated') : work.location_precision === 'approximate' ? tr('inv.approx') : null;
  const ref = inv?.page ? inv.volume ? tr('inv.refShort', { v: inv.volume, page: inv.page }) : tr('inv.refPage', { page: inv.page }) : null;
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={[loc(work.name, lang), loc(work.type_name, lang), work.district, precision, ref].filter(Boolean).join('. ')} style={({ pressed }) => [{ flexDirection: 'row', gap: 16, paddingVertical: 20, alignItems: 'center', borderTopWidth: 1, borderColor: t.border, backgroundColor: pressed ? t.surface : t.background }]}>
    <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface, borderRadius: 12 }}><WorkGlyphInline slug={work.type_slug} color={t.primary} size={26} /></View>
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={[type.itemTitle, { color: t.text }]}>{loc(work.name, lang)}</Text>
      <Text style={[type.meta, { color: t.textMuted }]}>{[loc(work.type_name, lang), work.district].filter(Boolean).join(' · ')}</Text>
      {ref ? <Text style={[type.meta, { color: t.textMuted }]}>{ref}</Text> : null}
      {precision ? <Text style={[type.meta, { color: t.textMuted }]}>{precision}</Text> : null}
      {work.unesco ? <Text style={[type.meta, { color: t.primary }]}>UNESCO</Text> : null}
    </View>
    <ChevronIcon color={t.textMuted} size={18} />
  </Pressable>;
}

const makeStyles = (t: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.background },
  list: { paddingHorizontal: 24, paddingBottom: 32 },
  header: { gap: 16, paddingBottom: 16 },
  city: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, borderBottomWidth: 1, borderBottomColor: t.border },
  search: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 16, minHeight: 56, borderRadius: radius.md, borderWidth: 1, borderColor: t.textMuted, backgroundColor: t.surface },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  filter: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 56, maxWidth: '45%', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8 },
  pilot: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: t.border },
  map: { height: 340, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: t.surface },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: `${t.text}66` },
  sheet: { maxHeight: '88%', backgroundColor: t.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 16 },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  sheetBody: { padding: 24, gap: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
