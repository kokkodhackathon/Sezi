import type { ThemeColors } from '@sezi/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SeziMap, WorkClusters } from '@/components/map';
import { Button, Chip, EmptyState, ListRow, SectionTitle, softShadow } from '@/components/ui';
import { ChevronIcon, CloseIcon, FilterIcon, ListIcon, MapIcon, SearchIcon, TurnIcon } from '@/design/icons';
import { radius, space, type } from '@/design/type';
import { colorForType, WorkGlyphInline } from '@/design/work-glyph';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT, type Lang } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { coverOf, hasLocation, loc, photoUrl, useCities, useWorks, type WorkRow } from '@/lib/works';

/**
 * Keşfet: önce fotoğraf, sonra yazı. Fotoğraflı eserler öne çıkar; ilk eser büyük kartla açılır.
 * Ayrıntı (kaynak, konum kesinliği, durum) eser sayfasındadır; listede yalnızca ad, tür ve ilçe.
 */
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
  const { data: works, isLoading, error, refetch, isRefetching } = useWorks(citySlug);
  const [kind, setKind] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [panel, setPanel] = useState<'cities' | 'filters' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // Türler, eser sayısına göre: en kalabalık türler önce (yatay şeritte ilk görünenler).
  const types = useMemo(() => {
    const counts = new Map<string, { name: string; n: number }>();
    for (const w of works ?? []) counts.set(w.type_slug, { name: loc(w.type_name, lang), n: (counts.get(w.type_slug)?.n ?? 0) + 1 });
    return [...counts].sort((a, b) => b[1].n - a[1].n);
  }, [works, lang]);
  const districts = useMemo(() => [...new Set((works ?? []).flatMap((w) => (w.district ? [w.district] : [])))].sort((a, b) => a.localeCompare(b, lang)), [works, lang]);
  const visible = useMemo(
    () =>
      (works ?? [])
        .filter((w) => (!kind || w.type_slug === kind) && (!district || w.district === district))
        .sort((a, b) => Number(!!coverOf(b)) - Number(!!coverOf(a)) || loc(a.name, lang).localeCompare(loc(b.name, lang), lang)),
    [works, kind, district, lang],
  );
  const mapped = visible.filter(hasLocation);
  const selectedWork = visible.find((w) => w.slug === selected);
  const open = (slug: string) => router.push({ pathname: '/work/[slug]', params: { slug } });
  const chooseCity = (slug: string) => {
    update({ city: slug });
    setKind(null);
    setDistrict(null);
    setSelected(null);
    setPanel(null);
  };
  // Pilot alan kartının görseli: Bursa'da fotoğrafı olan bir han ya da ilk fotoğraflı eser.
  const pilotWork = citySlug === 'bursa' ? ((works ?? []).find((w) => w.type_slug === 'han' && coverOf(w)) ?? (works ?? []).find((w) => coverOf(w))) : undefined;
  const pilotCover = pilotWork ? coverOf(pilotWork) : undefined;

  const header = (
    <View style={s.header}>
      <View style={s.titleRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Pressable onPress={() => setPanel('cities')} accessibilityRole="button" accessibilityLabel={tr('design.chooseCity')} accessibilityHint={city ? loc(city.name, lang) : undefined} style={s.city} hitSlop={8}>
            <Text style={[type.button, { color: t.primary }]}>{city ? loc(city.name, lang) : tr('design.chooseCity')}</Text>
            <View style={{ transform: [{ rotate: '90deg' }] }}>
              <ChevronIcon color={t.primary} size={16} />
            </View>
          </Pressable>
          <Text style={[type.screenTitle, { color: t.text }]} accessibilityRole="header">
            {tr('explore.title')}
          </Text>
        </View>
        <Pressable
          onPress={() => setView(view === 'list' ? 'map' : 'list')}
          accessibilityRole="button"
          accessibilityLabel={view === 'list' ? tr('design.map') : tr('design.list')}
          style={[s.iconBtn, softShadow(t), { backgroundColor: t.surface }]}>
          {view === 'list' ? <MapIcon color={t.text} /> : <ListIcon color={t.text} />}
        </Pressable>
      </View>

      <View style={s.searchRow}>
        <Pressable onPress={() => router.push('/search')} accessibilityRole="button" accessibilityLabel={tr('explore.searchCta')} style={[s.search, { backgroundColor: t.soft }]}>
          <SearchIcon color={t.textMuted} />
          <Text style={[type.body, { color: t.textMuted, flex: 1 }]} numberOfLines={1}>
            {tr('explore.searchCta')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setPanel('filters')}
          accessibilityRole="button"
          accessibilityLabel={tr('design.filtersCount', { n: Number(!!district) })}
          style={[s.iconBtn, { backgroundColor: district ? t.primary : t.soft }]}>
          <FilterIcon color={district ? t.onPrimary : t.text} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={{ marginHorizontal: -space.xl }}>
        <Chip label={tr('explore.all')} selected={kind === null} onPress={() => setKind(null)} />
        {types.map(([slug, { name }]) => (
          <Chip key={slug} label={name} selected={kind === slug} onPress={() => setKind(kind === slug ? null : slug)} />
        ))}
      </ScrollView>
      {district ? (
        <Pressable onPress={() => setDistrict(null)} accessibilityRole="button" accessibilityLabel={`${district}, ${tr('design.clearFilters')}`} style={[s.activeFilter, { backgroundColor: t.soft }]}>
          <Text style={[type.meta, { color: t.text }]}>{district}</Text>
          <CloseIcon color={t.textMuted} size={16} />
        </Pressable>
      ) : null}

      {citySlug === 'bursa' && view === 'list' && !kind && !district ? (
        <Pressable onPress={() => router.push('/tours')} accessibilityRole="button" accessibilityLabel={tr('design.pilotTitle')} accessibilityHint={tr('inv.pilotBody')} style={[s.pilot, { backgroundColor: t.primary }]}>
          {pilotCover ? <Image source={{ uri: photoUrl(pilotCover, 'thumb') }} style={s.pilotImg} contentFit="cover" accessible={false} /> : null}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.itemTitle, { color: t.onPrimary }]}>{tr('design.pilotTitle')}</Text>
            <Text style={[type.meta, { color: t.onPrimary }]} numberOfLines={1}>
              {tr('design.pilotSubtitle')}
            </Text>
          </View>
          <TurnIcon turn="slight_right" color={t.onPrimary} size={22} />
        </Pressable>
      ) : null}

      {view === 'map' && mapped.length > 0 ? (
        <SeziMap
          key={`${citySlug}:${kind}:${district}`}
          style={s.map}
          initial={mapped.map((w) => [w.lng, w.lat])}
          initialZoom={15}
          accessibilityLabel={tr('design.mapHelp', { n: mapped.length })}>
          <WorkClusters works={mapped.map((w) => ({ slug: w.slug, location: [w.lng, w.lat], color: colorForType(w.type_slug) }))} selected={selected} onPress={setSelected} />
        </SeziMap>
      ) : null}
      <Text style={[type.meta, { color: t.textMuted }]} accessibilityLiveRegion="polite">
        {isLoading ? tr('explore.loading') : view === 'map' ? tr('design.mapHelp', { n: mapped.length }) : tr('search.results', { n: visible.length })}
      </Text>
    </View>
  );

  const data = view === 'list' ? visible : selectedWork ? [selectedWork] : [];
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <FlatList
        importantForAccessibility={panel ? 'no-hide-descendants' : 'auto'}
        data={data}
        keyExtractor={(w) => w.id}
        ListHeaderComponent={header}
        contentContainerStyle={s.list}
        initialNumToRender={8}
        // Aşağı çekip yenile: admin panelinde onaylanan içerik hemen gelir.
        refreshing={isRefetching}
        onRefresh={() => {
          void refetch();
          void reloadCities();
        }}
        renderItem={({ item, index }) =>
          index === 0 && coverOf(item) && view === 'list' ? (
            <FeatureCard work={item} t={t} lang={lang} onPress={() => open(item.slug)} />
          ) : (
            <WorkRowView work={item} t={t} lang={lang} onPress={() => open(item.slug)} />
          )
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={t.primary} accessibilityLabel={tr('explore.loading')} style={{ marginVertical: space.xl }} />
          ) : error || cityError ? (
            <EmptyState title={tr('explore.error')} action={<Button label={tr('explore.retry')} onPress={() => { void refetch(); void reloadCities(); }} />} />
          ) : view === 'map' && mapped.length ? null : (
            <EmptyState title={tr('explore.empty')} action={kind || district ? <Button variant="outline" label={tr('design.clearFilters')} onPress={() => { setKind(null); setDistrict(null); }} /> : undefined} />
          )
        }
      />
      <Modal visible={panel !== null} transparent animationType="none" onRequestClose={() => setPanel(null)}>
        <View style={s.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPanel(null)} accessibilityRole="button" accessibilityLabel={tr('design.close')} />
          <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]} accessibilityViewIsModal>
            <View style={s.sheetHead}>
              <Text style={[type.title, { color: t.text, flex: 1 }]} accessibilityRole="header">
                {tr(panel === 'cities' ? 'design.chooseCity' : 'inv.district')}
              </Text>
              <Pressable onPress={() => setPanel(null)} accessibilityRole="button" accessibilityLabel={tr('design.close')} style={s.close}>
                <CloseIcon color={t.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={s.sheetBody}>
              {panel === 'cities' ? (
                <>
                  {active.map((c, i) => (
                    <ListRow key={c.id} first={i === 0} title={loc(c.name, lang)} subtitle={c.slug === citySlug ? tr('design.selected') : undefined} onPress={() => chooseCity(c.slug)} />
                  ))}
                  {city ? (
                    <Button variant="outline" label={tr('design.cityInfo')} onPress={() => { setPanel(null); router.push({ pathname: '/city/[slug]', params: { slug: city.slug } }); }} />
                  ) : null}
                </>
              ) : (
                <>
                  <SectionTitle title={tr('inv.district')} />
                  <View style={s.wrapChips}>
                    <Chip label={tr('inv.allDistricts')} selected={district === null} onPress={() => setDistrict(null)} />
                    {districts.map((name) => (
                      <Chip key={name} label={name} selected={district === name} onPress={() => setDistrict(district === name ? null : name)} />
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
            {panel === 'filters' ? (
              <View style={{ paddingHorizontal: space.xl }}>
                <Button label={tr('design.showResults', { n: visible.length })} onPress={() => { setSelected(null); setPanel(null); }} />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/** Erişilebilirlik etiketi: görülen her şey ve konum durumu (listede yazı olarak gösterilmez). */
function a11yLabel(work: WorkRow, lang: Lang, tr: ReturnType<typeof useT>['t']) {
  const precision = !hasLocation(work) ? tr('inv.unlocated') : work.location_precision === 'approximate' ? tr('inv.approx') : null;
  return [loc(work.name, lang), loc(work.type_name, lang), work.district, work.unesco ? 'UNESCO' : null, precision].filter(Boolean).join('. ');
}

function FeatureCard({ work, t, lang, onPress }: { work: WorkRow; t: ThemeColors; lang: Lang; onPress: () => void }) {
  const { t: tr } = useT();
  const cover = coverOf(work)!;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11yLabel(work, lang, tr)} style={({ pressed }) => [styles.feature, softShadow(t), { backgroundColor: t.surface }, pressed && { opacity: 0.92 }]}>
      <Image source={{ uri: photoUrl(cover, 'full') }} placeholder={{ uri: photoUrl(cover, 'thumb') }} style={styles.featureImg} contentFit="cover" transition={150} accessible={false} />
      <View style={styles.featureCap}>
        <Text style={[type.title, { color: t.text, fontSize: 22, lineHeight: 28 }]} numberOfLines={2}>
          {loc(work.name, lang)}
        </Text>
        <Text style={[type.meta, { color: t.textMuted }]}>{[loc(work.type_name, lang), work.district].filter(Boolean).join(' · ')}</Text>
      </View>
    </Pressable>
  );
}

function WorkRowView({ work, t, lang, onPress }: { work: WorkRow; t: ThemeColors; lang: Lang; onPress: () => void }) {
  const { t: tr } = useT();
  const cover = coverOf(work);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11yLabel(work, lang, tr)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      {cover ? (
        <Image source={{ uri: photoUrl(cover, 'thumb') }} style={styles.thumb} contentFit="cover" transition={120} accessible={false} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: t.soft, alignItems: 'center', justifyContent: 'center' }]}>
          <WorkGlyphInline slug={work.type_slug} color={colorForType(work.type_slug)} size={28} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.itemTitle, { color: t.text }]} numberOfLines={2}>
          {loc(work.name, lang)}
        </Text>
        <Text style={[type.meta, { color: t.textMuted }]} numberOfLines={1}>
          {[loc(work.type_name, lang), work.district].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {work.unesco ? <View style={[styles.dot, { backgroundColor: t.accent }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  feature: { borderRadius: radius.xl, overflow: 'hidden', marginBottom: space.md },
  featureImg: { width: '100%', aspectRatio: 4 / 3 },
  featureCap: { padding: space.lg, gap: 2 },
  row: { flexDirection: 'row', gap: space.lg, paddingVertical: space.md, alignItems: 'center', minHeight: 88 },
  thumb: { width: 72, height: 72, borderRadius: radius.lg },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    list: { paddingHorizontal: space.xl, paddingBottom: space.xxl },
    header: { gap: space.lg, paddingBottom: space.sm, paddingTop: space.md },
    titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
    city: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 32 },
    iconBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    searchRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
    search: { flex: 1, flexDirection: 'row', gap: space.md, alignItems: 'center', paddingHorizontal: space.lg, minHeight: 52, borderRadius: radius.pill },
    chips: { gap: space.sm, paddingHorizontal: space.xl },
    activeFilter: { flexDirection: 'row', gap: space.sm, alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: space.md, minHeight: 36, borderRadius: radius.pill },
    pilot: { flexDirection: 'row', gap: space.md, alignItems: 'center', padding: space.sm, paddingRight: space.lg, borderRadius: radius.xl },
    pilotImg: { width: 56, height: 56, borderRadius: radius.lg },
    map: { height: 380, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: t.soft },
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: `${t.text}66` },
    sheet: { maxHeight: '88%', backgroundColor: t.background, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
    sheetHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingTop: space.lg },
    close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    sheetBody: { padding: space.xl, gap: space.lg },
    wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  });
