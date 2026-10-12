import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import type { ThemeColors } from '@sezi/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { loc, useWorks, type WorkRow } from '@/lib/works';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const SULEYMANIYE: [number, number] = [28.9639, 41.0162];
const LANG = 'tr' as const; // i18n gelene kadar

export default function Explore() {
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { data: works, isLoading, error, refetch } = useWorks();
  const [type, setType] = useState<string | null>(null);

  const types = useMemo(() => {
    const seen = new globalThis.Map<string, string>();
    for (const w of works ?? []) seen.set(w.type_slug, loc(w.type_name, LANG));
    return [...seen].sort((a, b) => a[1].localeCompare(b[1], 'tr'));
  }, [works]);

  const visible = useMemo(
    () => (works ?? []).filter((w) => !type || w.type_slug === type).sort((a, b) => loc(a.name, LANG).localeCompare(loc(b.name, LANG), 'tr')),
    [works, type],
  );

  const geojson = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: visible.map((w) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [w.lng, w.lat] },
        properties: { slug: w.slug },
      })),
    }),
    [visible],
  );

  const open = (slug: string) => router.push({ pathname: '/work/[slug]', params: { slug } });

  const header = (
    <View style={s.header}>
      <Text style={s.title} accessibilityRole="header">
        Keşfet
      </Text>
      <Text style={s.subtitle}>Süleymaniye Külliyesi ve çevresi</Text>

      <View
        style={s.map}
        accessible
        accessibilityLabel={`Harita: ${visible.length} eser. Eserlerin listesi aşağıdadır.`}
        importantForAccessibility="no-hide-descendants">
        <Map style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE}>
          <Camera initialViewState={{ center: SULEYMANIYE, zoom: 15.7 }} />
          <GeoJSONSource
            id="works"
            data={geojson}
            onPress={(e) => {
              const slug = e.nativeEvent.features[0]?.properties?.slug;
              if (typeof slug === 'string') open(slug);
            }}>
            <Layer
              id="works-circle"
              type="circle"
              paint={{
                'circle-radius': 8,
                'circle-color': t.accent,
                'circle-stroke-width': 2,
                'circle-stroke-color': t.surface,
              }}
            />
          </GeoJSONSource>
        </Map>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        <Chip label="Tümü" selected={type === null} onPress={() => setType(null)} t={t} />
        {types.map(([slug, name]) => (
          <Chip key={slug} label={name} selected={type === slug} onPress={() => setType(slug)} t={t} />
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
        renderItem={({ item }) => <WorkCard work={item} onPress={() => open(item.slug)} t={t} />}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={t.primary} accessibilityLabel="Eserler yükleniyor" />
          ) : error ? (
            <View style={s.empty}>
              <Text style={s.body}>Eserler yüklenemedi. İnternet bağlantınızı kontrol edin.</Text>
              <Chip label="Tekrar dene" selected onPress={() => refetch()} t={t} />
            </View>
          ) : (
            <Text style={s.body}>Bu türde eser yok.</Text>
          )
        }
      />
    </SafeAreaView>
  );
}

function Chip({ label, selected, onPress, t }: { label: string; selected: boolean; onPress: () => void; t: ThemeColors }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        chipStyles.chip,
        { borderColor: selected ? t.primary : t.border, backgroundColor: selected ? t.primary : t.surface },
      ]}>
      <Text style={[chipStyles.label, { color: selected ? t.onPrimary : t.text }]}>{label}</Text>
    </Pressable>
  );
}

function WorkCard({ work, onPress, t }: { work: WorkRow; onPress: () => void; t: ThemeColors }) {
  const name = loc(work.name, LANG);
  const kind = loc(work.type_name, LANG);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${kind}`}
      accessibilityHint="Eser ayrıntılarını açar"
      style={({ pressed }) => [cardStyles.card, { backgroundColor: t.surface, borderColor: t.border, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[cardStyles.dot, { backgroundColor: t.accent }]} />
      <View style={cardStyles.text}>
        <Text style={[cardStyles.name, { color: t.text }]}>{name}</Text>
        <Text style={[cardStyles.meta, { color: t.textMuted }]}>{kind}</Text>
      </View>
      <Text style={[cardStyles.chevron, { color: t.textMuted }]} importantForAccessibility="no">
        ›
      </Text>
    </Pressable>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    list: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
    header: { gap: 12, paddingTop: 8, paddingBottom: 4 },
    title: { fontSize: 30, fontWeight: '700', color: t.text },
    subtitle: { fontSize: 16, color: t.textMuted, marginTop: -8 },
    map: { height: 260, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: t.border },
    chips: { gap: 8, paddingVertical: 4 },
    empty: { gap: 12, alignItems: 'flex-start' },
    body: { fontSize: 16, color: t.text },
  });

const chipStyles = StyleSheet.create({
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, justifyContent: 'center' },
  label: { fontSize: 15, fontWeight: '600' },
});

const cardStyles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { flex: 1, paddingVertical: 12, gap: 2 },
  name: { fontSize: 17, fontWeight: '600' },
  meta: { fontSize: 14 },
  chevron: { fontSize: 24 },
});
