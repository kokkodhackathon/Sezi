import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CheckIcon, ChevronIcon, InfoIcon, PlayIcon, SearchIcon } from '@/design/icons';
import { useTabBarSpace } from '@/components/app-tabs';
import { Button } from '@/components/ui';
import { FadeInItem, outline, PhotoTile, Skeleton, SoftPressable, SweetSheet, sweetShadow, TypeTile } from '@/design/sweet/components';
import { toneForType } from '@/design/sweet/tones';
import { radius, space, type } from '@/design/type';
import { WorkGlyphInline } from '@/design/work-glyph';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { coverOf, loc, photoUrl, useCities, useWorks } from '@/lib/works';

const HIGHLIGHT_W = 248;
const HIGHLIGHT_H = 300;

/**
 * Keşfet vitrini: az yazı, önce fotoğraf. Şehir adı, arama alanı, pilot kartı, tür kutucukları,
 * öne çıkan fotoğraflar ve iki sütunlu ızgara. Liste/harita ve ilçe aramada.
 */
export default function Explore() {
  const t = useSweetTheme();
  const { t: tr, lang } = useT();
  const { width } = useWindowDimensions();
  const tabSpace = useTabBarSpace();
  const { settings, update } = useSettings();
  const { data: cities, error: cityError, refetch: reloadCities } = useCities();
  const active = (cities ?? []).filter((c) => c.is_active);
  const citySlug = active.some((c) => c.slug === settings.city) ? settings.city : (active[0]?.slug ?? settings.city);
  const city = active.find((c) => c.slug === citySlug);
  const { data: works, isLoading, error, refetch, isRefetching } = useWorks(citySlug);
  const [kind, setKind] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);

  // Türler, eser sayısına göre: en kalabalık türler önce (yatay şeritte ilk görünenler).
  const types = useMemo(() => {
    const counts = new Map<string, { name: string; n: number }>();
    for (const w of works ?? []) counts.set(w.type_slug, { name: loc(w.type_name, lang), n: (counts.get(w.type_slug)?.n ?? 0) + 1 });
    return [...counts].sort((a, b) => b[1].n - a[1].n);
  }, [works, lang]);
  const visible = useMemo(
    () =>
      (works ?? [])
        .filter((w) => !kind || w.type_slug === kind)
        .sort((a, b) => Number(!!coverOf(b)) - Number(!!coverOf(a)) || loc(a.name, lang).localeCompare(loc(b.name, lang), lang)),
    [works, kind, lang],
  );
  const highlights = visible.filter((w) => coverOf(w)).slice(0, 8);
  const grid = visible.filter((w) => !highlights.includes(w));
  const tileW = (width - 2 * space.xl - space.md) / 2;
  const tileH = Math.round(tileW * 1.15);

  const open = (slug: string) => router.push({ pathname: '/work/[slug]', params: { slug } });
  const reload = () => {
    void refetch();
    void reloadCities();
  };
  const chooseCity = (slug: string) => {
    update({ city: slug });
    setKind(null);
    setSheet(false);
  };
  // Pilot alan kartının görseli: Bursa'da fotoğrafı olan bir han ya da ilk fotoğraflı eser.
  const pilotWork = citySlug === 'bursa' ? ((works ?? []).find((w) => w.type_slug === 'han' && coverOf(w)) ?? (works ?? []).find((w) => coverOf(w))) : undefined;
  const pilotCover = pilotWork ? coverOf(pilotWork) : undefined;
  const failed = !!(error || cityError);

  const header = (
    <View style={s.header}>
      <SoftPressable
        onPress={() => setSheet(true)}
        accessibilityRole="button"
        accessibilityLabel={tr('design.chooseCity')}
        accessibilityHint={city ? loc(city.name, lang) : undefined}
        style={s.cityRow}>
        <Text style={[type.hero, { color: t.text, flexShrink: 1 }]} numberOfLines={1}>
          {city ? loc(city.name, lang) : tr('design.chooseCity')}
        </Text>
        <View style={[s.chevron, { backgroundColor: t.soft }, outline(t)]}>
          <View style={{ transform: [{ rotate: '90deg' }] }}>
            <ChevronIcon color={t.text} size={16} />
          </View>
        </View>
      </SoftPressable>

      <SoftPressable
        onPress={() => router.push('/search')}
        accessibilityRole="button"
        accessibilityLabel={tr('explore.searchCta')}
        style={[s.search, { backgroundColor: t.soft }, outline(t)]}>
        <SearchIcon color={t.text} />
        <Text style={[type.body, { color: t.textMuted, flex: 1 }]} numberOfLines={1}>
          {tr('explore.searchCta')}
        </Text>
      </SoftPressable>

      {citySlug === 'bursa' ? (
        <FadeInItem index={0}>
          <SoftPressable
            onPress={() => router.push('/tours')}
            accessibilityRole="button"
            accessibilityLabel={tr('design.pilotTitle')}
            accessibilityHint={tr('inv.pilotBody')}
            style={[s.pilot, { backgroundColor: t.primary.fill }, sweetShadow(t)]}>
            <View style={[s.pilotImg, { backgroundColor: t.soft }]}>
              {pilotCover ? <Image source={{ uri: photoUrl(pilotCover, 'thumb') }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessible={false} /> : null}
            </View>
            <View style={s.pilotRow}>
              <Text style={[type.title, { color: t.primary.ink, flex: 1 }]} numberOfLines={2}>
                {tr('home.pilotShort')}
              </Text>
              <View style={[s.play, { backgroundColor: t.primary.ink }]}>
                <PlayIcon color={t.primary.fill} size={20} />
              </View>
            </View>
          </SoftPressable>
        </FadeInItem>
      ) : null}

      {types.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl }} contentContainerStyle={s.tiles}>
          <TypeTile label={tr('explore.all')} slug={null} selected={kind === null} tone={{ fill: t.soft, ink: t.text }} onPress={() => setKind(null)} />
          {types.map(([slug, { name }]) => (
            <TypeTile key={slug} label={name} slug={slug} selected={kind === slug} tone={t.tones[toneForType(slug)]} onPress={() => setKind(kind === slug ? null : slug)} />
          ))}
        </ScrollView>
      ) : null}

      {isLoading ? (
        <View style={{ gap: space.md }} accessible accessibilityLabel={tr('explore.loading')} accessibilityLiveRegion="polite">
          <Skeleton width={140} height={22} corner={radius.sm} />
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Skeleton width={HIGHLIGHT_W} height={HIGHLIGHT_H} />
            <Skeleton width={HIGHLIGHT_W} height={HIGHLIGHT_H} />
          </View>
        </View>
      ) : highlights.length > 0 ? (
        <View style={{ gap: space.md }}>
          <Text style={[type.heading, { color: t.text }]} accessibilityRole="header">
            {tr('home.highlights')}
          </Text>
          <FlatList
            key={kind ?? 'all'}
            horizontal
            data={highlights}
            keyExtractor={(w) => w.id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={HIGHLIGHT_W + space.md}
            decelerationRate="fast"
            style={{ marginHorizontal: -space.xl }}
            contentContainerStyle={s.carousel}
            renderItem={({ item, index }) => (
              <FadeInItem index={index}>
                <PhotoTile work={item} width={HIGHLIGHT_W} imageHeight={HIGHLIGHT_H} onPress={() => open(item.slug)} />
              </FadeInItem>
            )}
          />
        </View>
      ) : null}

      {!isLoading && !failed && grid.length > 0 ? (
        <View style={s.gridHead}>
          <Text style={[type.heading, { color: t.text }]} accessibilityRole="header">
            {tr('home.allWorks')}
          </Text>
          <View style={[s.count, { backgroundColor: t.soft }, outline(t)]}>
            <Text style={[type.bubble, { color: t.text }]} accessibilityLiveRegion="polite">
              {grid.length}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  const empty = isLoading ? (
    <View style={s.skeletonGrid} accessible={false}>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} width={tileW} height={tileH} />
      ))}
    </View>
  ) : failed ? (
    <View style={s.state}>
      <View style={[s.stateIcon, { backgroundColor: t.accent.fill }, outline(t)]}>
        <InfoIcon color={t.accent.ink} size={40} />
      </View>
      <Text style={[type.heading, { color: t.text, textAlign: 'center' }]}>{tr('explore.error')}</Text>
      <Button label={tr('explore.retry')} onPress={reload} />
    </View>
  ) : visible.length === 0 ? (
    <View style={s.state}>
      <View style={[s.stateIcon, { backgroundColor: t.soft }, outline(t)]}>
        <WorkGlyphInline slug={kind ?? 'cami'} color={t.text} size={44} />
      </View>
      <Text style={[type.heading, { color: t.text, textAlign: 'center' }]}>{tr('explore.empty')}</Text>
      {kind ? <Button variant="ghost" label={tr('explore.all')} onPress={() => setKind(null)} /> : null}
    </View>
  ) : null;

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: t.background }]} edges={['top']}>
      <FlatList
        importantForAccessibility={sheet ? 'no-hide-descendants' : 'auto'}
        data={isLoading || failed ? [] : grid}
        // Tür değişince kartlar yeniden kurulur (giriş animasyonu tekrar oynar); liste kaydırma yerini korur.
        keyExtractor={(w) => `${kind ?? 'all'}:${w.id}`}
        numColumns={2}
        columnWrapperStyle={{ gap: space.md }}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={[s.list, { paddingBottom: tabSpace }]}
        initialNumToRender={6}
        // Aşağı çekip yenile: admin panelinde onaylanan içerik hemen gelir.
        refreshing={isRefetching}
        onRefresh={reload}
        renderItem={({ item, index }) => (
          <FadeInItem index={index}>
            <PhotoTile work={item} width={tileW} imageHeight={tileH} onPress={() => open(item.slug)} />
          </FadeInItem>
        )}
      />

      <SweetSheet visible={sheet} onClose={() => setSheet(false)} title={tr('design.chooseCity')}>
        <ScrollView contentContainerStyle={s.sheetBody}>
          {active.map((c) => {
            const selected = c.slug === citySlug;
            return (
              <SoftPressable
                key={c.id}
                onPress={() => chooseCity(c.slug)}
                accessibilityRole="button"
                accessibilityLabel={loc(c.name, lang)}
                accessibilityState={{ selected }}
                style={[s.cityOption, { backgroundColor: selected ? t.primary.fill : t.soft }, !selected && outline(t)]}>
                <Text style={[type.title, { color: selected ? t.primary.ink : t.text, flex: 1 }]} numberOfLines={1}>
                  {loc(c.name, lang)}
                </Text>
                {selected ? (
                  <View style={[s.check, { backgroundColor: t.primary.ink }]}>
                    <CheckIcon color={t.primary.fill} size={18} />
                  </View>
                ) : null}
              </SoftPressable>
            );
          })}
          {city ? (
            <Button
              variant="ghost"
              label={tr('design.cityInfo')}
              onPress={() => {
                setSheet(false);
                router.push({ pathname: '/city/[slug]', params: { slug: city.slug } });
              }}
            />
          ) : null}
        </ScrollView>
      </SweetSheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.xl },
  header: { gap: space.xl, paddingTop: space.lg, paddingBottom: space.xs },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'flex-start', minHeight: 48 },
  chevron: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  search: {
    minHeight: 52,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  pilot: { borderRadius: radius.xl, borderCurve: 'continuous', padding: space.sm, gap: space.xs },
  pilotImg: { aspectRatio: 16 / 10, borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden' },
  pilotRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.md, paddingRight: space.xs, paddingVertical: space.sm },
  play: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  tiles: { paddingHorizontal: space.xl, gap: space.sm },
  carousel: { paddingHorizontal: space.xl, gap: space.md },
  gridHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  count: { minWidth: 32, height: 26, borderRadius: 13, paddingHorizontal: space.sm, alignItems: 'center', justifyContent: 'center' },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  state: { alignItems: 'center', gap: space.lg, paddingVertical: space.xxl },
  stateIcon: { width: 96, height: 96, borderRadius: 30, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  sheetBody: { paddingHorizontal: space.xl, gap: space.sm, paddingBottom: space.sm },
  cityOption: {
    minHeight: 64,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    gap: space.md,
  },
  check: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
