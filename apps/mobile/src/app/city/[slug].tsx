import { coverOf, loc, type SweetTheme } from '@sezi/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Linking, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExhibitionCard } from '@/components/exhibition-card';
import { FloatingHeader, useFloatingHeaderScroll } from '@/components/floating-header';
import { PhotoSourceTag } from '@/components/photo-source';
import { Button, EmptyState, Note, SectionTitle } from '@/components/ui';
import { ExternalIcon, InfoIcon } from '@/design/icons';
import { FadeInItem, outline, Skeleton, SoftPressable } from '@/design/sweet/components';
import { WorkGlyphInline } from '@/design/work-glyph';
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
  const header = useFloatingHeaderScroll();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  if (isLoading || !city) {
    return (
      <View style={[s.screen, { paddingTop: insets.top + 80, paddingHorizontal: space.xl, gap: space.xl }]} accessibilityLabel={tr('city.loading')} accessibilityState={{ busy: isLoading }}>
        {isLoading ? <><Skeleton width={width - 48} height={240} /><Skeleton width={width - 96} height={34} /><Skeleton width={width - 48} height={96} /></> : <EmptyState title={tr('city.notFound')} />}
        <FloatingHeader title={tr('city.eyebrow')} scrollY={header.scrollY} coverHeight={header.coverHeight} />
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
    <View style={s.screen}>
    <Animated.ScrollView scrollEventThrottle={16} onScroll={header.onScroll} contentContainerStyle={[s.body, { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 56 }]}>
      {cover ? (
        <View style={{ position: 'relative' }} onLayout={(e) => header.coverHeight.set(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
          <Image source={{ uri: photoUrl(cover, 'full') }} placeholder={{ uri: photoUrl(cover, 'thumb') }} placeholderContentFit="cover" style={[s.cover, outline(t)]} contentFit="cover" transition={150} accessible={false} />
          <PhotoSourceTag photo={cover} />
        </View>
      ) : null}
      <View onLayout={(e) => { if (!cover) header.coverHeight.set(e.nativeEvent.layout.y + e.nativeEvent.layout.height); }}>
      <FadeInItem index={0} style={s.hero}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Text style={[type.editorial, { color: t.text }]} accessibilityRole="header">
            {loc(city.name, lang)}
          </Text>
          <Text style={[type.meta, { color: t.textMuted }]}>{tr(`inv.status.${city.inventory_status ?? 'planned'}`)}</Text>
        </View>
      </FadeInItem>
      </View>

      <FadeInItem index={1} style={s.stats}>
        <Stat value={fmt(city.inventory_works)} label={tr('city.works')} t={t} />
        <Stat value={fmt(city.inventory_photos)} label={tr('city.photos')} t={t} />
        <Stat value={String(city.inventory_year ?? '—')} label={tr('city.year')} t={t} />
      </FadeInItem>

      {city.inventory_note ? <FadeInItem index={2}><Note text={loc(city.inventory_note, lang)} icon={<InfoIcon color={t.textMuted} />} /></FadeInItem> : null}

      <Button
        label={tr('city.explore')}
        onPress={() => {
          update({ city: city.slug });
          router.navigate('/');
        }}
      />



      {cityBooks.length ? (
        <FadeInItem index={3} style={{ gap: space.md }}>
          <SectionTitle title={tr('city.books')} />
          <View style={{ gap: space.md }}>
            {cityBooks.map((b) => {
              const content = <><View style={[s.bookSpine, { backgroundColor: t.tones.saffron.fill }, outline(t)]}><WorkGlyphInline slug="kutuphane" color={t.tones.saffron.ink} size={28} />{b.volume ? <Text style={[type.bubble, { color: t.tones.saffron.ink }]}>{tr('city.volume', { v: b.volume })}</Text> : null}</View><View style={{ flex: 1, gap: space.sm }}><Text style={[type.itemTitle, { color: t.text }]}>{b.title}</Text><Text style={[type.meta, { color: t.textMuted }]}>{[b.year, 'Vakıf Katılım'].filter(Boolean).join(' · ')}</Text>{b.url ? <Text style={[type.meta, { color: t.primaryText }]}>{tr('inv.openBook')}</Text> : null}</View>{b.url ? <ExternalIcon color={t.primaryText} /> : null}</>;
              const bookStyle = [s.book, { backgroundColor: t.surface }, outline(t)];
              return b.url ? <SoftPressable key={b.id} style={bookStyle} onPress={() => { if (b.url) void Linking.openURL(b.url); }} accessibilityRole="link" accessibilityLabel={b.title} accessibilityHint={tr('inv.openBookHint')}>{content}</SoftPressable> : <View key={b.id} style={bookStyle}>{content}</View>;
            })}
          </View>
        </FadeInItem>
      ) : null}

      {cityExh.length ? (
        <FadeInItem index={4} style={{ gap: space.md }}>
          <SectionTitle title={tr('city.exhibitions')} />
          {cityExh.map((e) => (
            <ExhibitionCard key={e.id} exhibition={e} />
          ))}
        </FadeInItem>
      ) : null}

      {districts.size ? (
        <FadeInItem index={5} style={{ gap: space.md }}>
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
        </FadeInItem>
      ) : null}
    </Animated.ScrollView>
    <FloatingHeader title={loc(city.name, lang)} scrollY={header.scrollY} coverHeight={header.coverHeight} />
    </View>
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
    book: { flexDirection: 'row', gap: space.lg, padding: space.lg, borderRadius: radius.lg, borderCurve: 'continuous', alignItems: 'center', minHeight: 112 },
    bookSpine: { width: 72, minHeight: 104, borderRadius: radius.sm, borderCurve: 'continuous', justifyContent: 'center', alignItems: 'center', gap: space.sm, padding: space.sm },
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
