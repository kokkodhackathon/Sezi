import { hasLocation, loc, toneForType, type SweetTheme } from '@sezi/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PointsLayer, SeziMap } from '@/components/map';
import { Button, Card, Eyebrow, ListRow, SectionTitle } from '@/components/ui';
import { TurnIcon } from '@/design/icons';
import { outline } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { WorkGlyphInline } from '@/design/work-glyph';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';
import { usePassport } from '@/lib/passport';
import { useTours } from '@/lib/tours';
import { useWorks } from '@/lib/works';

export default function ComplexScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useSweetTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const { has } = usePassport();
  const { data: works, isLoading } = useWorks();
  const parts = useMemo(() => (works ?? []).filter((w) => w.complex_slug === slug), [works, slug]);
  // Külliyenin bir eserinden geçen ilk tur (yoksa düğme görünmez).
  const tour = useTours().find((x) => parts.some((p) => x.stops.includes(p.slug)));

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={t.primaryText} />
      </View>
    );
  }
  const name = parts[0]?.complex_name ? loc(parts[0].complex_name, lang) : slug;

  // Türlere göre gruplama: külliyenin işlevsel bütünlüğünü gösterir.
  const groups = new globalThis.Map<string, typeof parts>();
  for (const w of parts) groups.set(w.type_slug, [...(groups.get(w.type_slug) ?? []), w]);

  const mapped = parts.filter(hasLocation);
  const visitedCount = parts.filter((w) => has(w.slug)).length;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <Stack.Screen options={{ title: '' }} />
      <View style={s.hero}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Eyebrow text={tr('complex.eyebrow')} />
          <Text style={[type.editorial, { color: t.text }]} accessibilityRole="header">
            {name}
          </Text>
          <Text style={[type.meta, { color: t.textMuted }]}>
            {tr('complex.verified', { n: parts.length })}
            {visitedCount ? ` · ${tr('profile.stats.of', { n: visitedCount, total: parts.length })} ${tr('work.visited').toLocaleLowerCase(lang)}` : ''}
          </Text>
        </View>
      </View>

      <Text style={[type.lead, { color: t.text }]}>{tr('complex.lead')}</Text>

      <SeziMap style={[s.map, outline(t)]} initial={mapped.map((w) => [w.lng, w.lat])} accessibilityLabel={tr('explore.mapLabel', { n: parts.length })}>
        <PointsLayer points={mapped.map((w) => ({ id: w.slug, location: [w.lng, w.lat], kind: 'work', typeSlug: w.type_slug }))} />
      </SeziMap>

      {tour ? (
        <Button
          label={tr('complex.tour')}
          onPress={() => router.push({ pathname: '/tour/[id]', params: { id: tour.slug } })}
          icon={(c) => <TurnIcon turn="slight_right" color={c} size={22} />}
        />
      ) : null}

      <SectionTitle title={tr('complex.parts')} />
      {[...groups.entries()].map(([typeSlug, list]) => {
        const tone = t.tones[toneForType(typeSlug)];
        return (
          <View key={typeSlug} style={{ gap: space.sm }}>
            <View style={s.groupHead}>
              <View style={[s.groupDot, { backgroundColor: tone.ink }]} />
              <Text style={[type.itemTitle, { color: t.text }]}>{tr('complex.byType', { n: list.length, type: loc(list[0]!.type_name, lang) })}</Text>
            </View>
            <Card padded={false}>
              {list.map((w, i) => (
                <ListRow
                  key={w.id}
                  first={i === 0}
                  title={loc(w.name, lang)}
                  subtitle={has(w.slug) ? tr('work.visited') : undefined}
                  leading={
                    <View
                      importantForAccessibility="no-hide-descendants"
                      accessibilityElementsHidden
                      style={[s.glyphBox, { backgroundColor: tone.fill }, outline(t)]}>
                      <WorkGlyphInline slug={w.type_slug} color={tone.ink} size={22} />
                    </View>
                  }
                  onPress={() => router.push({ pathname: '/work/[slug]', params: { slug: w.slug } })}
                />
              ))}
            </Card>
          </View>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (t: SweetTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { padding: space.xl, gap: space.xl, paddingBottom: 56 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.background },
    hero: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
    map: { height: 240, borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: t.soft },
    groupHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    groupDot: { width: 10, height: 10, borderRadius: 5 },
    glyphBox: { width: 40, height: 40, borderRadius: radius.sm, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  });
