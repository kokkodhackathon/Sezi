import { Camera, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { ThemeColors } from '@sezi/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Eyebrow, ListRow, SectionTitle } from '@/components/ui';
import { TurnIcon } from '@/design/icons';
import { Medallion } from '@/design/motif';
import { radius, space, type } from '@/design/type';
import { colorForType, typeColor, WorkGlyph } from '@/design/work-glyph';
import { DeferredMap } from '@/components/deferred-map';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';
import { boundsOf } from '@/lib/nav';
import { useSettings } from '@/lib/settings';
import { hasLocation, loc, useWorks } from '@/lib/works';

const circleColor = ['match', ['get', 'type'], ...Object.entries(typeColor).flat(), '#3A1A10'];

export default function ComplexScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const { visited } = useSettings();
  const { data: works, isLoading } = useWorks();
  const parts = useMemo(() => (works ?? []).filter((w) => w.complex_slug === slug), [works, slug]);

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }
  const name = parts[0]?.complex_name ? loc(parts[0].complex_name, lang) : slug;

  // Türlere göre gruplama: külliyenin işlevsel bütünlüğünü gösterir.
  const groups = new globalThis.Map<string, typeof parts>();
  for (const w of parts) groups.set(w.type_slug, [...(groups.get(w.type_slug) ?? []), w]);

  const mapped = parts.filter(hasLocation);
  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: mapped.map((w) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [w.lng, w.lat] }, properties: { type: w.type_slug } })),
  };
  const bounds = mapped.length ? boundsOf(mapped.map((w) => [w.lng, w.lat])) : undefined;
  const visitedCount = parts.filter((w) => visited.includes(w.slug)).length;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <Stack.Screen options={{ title: '' }} />
      <View style={s.hero}>
        <Medallion primary={t.primary} accent={t.accent} ink={t.text} size={88} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Eyebrow text={tr('complex.eyebrow')} />
          <Text style={[type.title, { color: t.text }]} accessibilityRole="header">
            {name}
          </Text>
          <Text style={[type.meta, { color: t.textMuted }]}>
            {tr('complex.verified', { n: parts.length })}
            {visitedCount ? ` · ${tr('profile.stats.of', { n: visitedCount, total: parts.length })} ${tr('work.visited').toLocaleLowerCase(lang)}` : ''}
          </Text>
        </View>
      </View>

      <Text style={[type.lead, { color: t.text }]}>{tr('complex.lead')}</Text>

      <View style={s.map} accessible accessibilityLabel={tr('explore.mapLabel', { n: parts.length })} importantForAccessibility="no-hide-descendants">
        <DeferredMap>
          {bounds ? <Camera initialViewState={{ bounds, padding: { top: 40, bottom: 40, left: 40, right: 40 } }} /> : null}
          <GeoJSONSource id="parts" data={geojson}>
            <Layer id="parts-circle" type="circle" paint={{ 'circle-radius': 9, 'circle-color': circleColor as never, 'circle-stroke-width': 2, 'circle-stroke-color': t.surface }} />
          </GeoJSONSource>
        </DeferredMap>
      </View>

      <Button
        label={tr('complex.tour')}
        onPress={() => router.push({ pathname: '/tour/[id]', params: { id: 'tum' } })}
        icon={(c) => <TurnIcon turn="slight_right" color={c} size={22} />}
      />

      <SectionTitle title={tr('complex.parts')} />
      {[...groups.entries()].map(([typeSlug, list]) => (
        <View key={typeSlug} style={{ gap: space.sm }}>
          <View style={s.groupHead}>
            <View style={[s.groupDot, { backgroundColor: colorForType(typeSlug) }]} />
            <Text style={[type.itemTitle, { color: t.text }]}>{tr('complex.byType', { n: list.length, type: loc(list[0]!.type_name, lang) })}</Text>
          </View>
          <Card padded={false}>
            {list.map((w, i) => (
              <ListRow
                key={w.id}
                first={i === 0}
                title={loc(w.name, lang)}
                subtitle={visited.includes(w.slug) ? tr('work.visited') : undefined}
                leading={<WorkGlyph slug={w.type_slug} size={40} />}
                onPress={() => router.push({ pathname: '/work/[slug]', params: { slug: w.slug } })}
              />
            ))}
          </Card>
        </View>
      ))}
    </ScrollView>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { padding: space.lg, gap: space.xl, paddingBottom: 56 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.background },
    hero: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
    map: { height: 240, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: t.border, backgroundColor: t.surface },
    groupHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    groupDot: { width: 12, height: 12, borderRadius: 3, transform: [{ rotate: '45deg' }] },
  });
