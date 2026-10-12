import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import type { ThemeColors } from '@sezi/shared';
import * as Speech from 'expo-speech';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ExternalIcon, InfoIcon, PlayIcon, StopIcon } from '@/design/icons';
import { CengelMark, KilimBand } from '@/design/motif';
import { radius, space, type, upper } from '@/design/type';
import { colorForType, WorkGlyph } from '@/design/work-glyph';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';
import { loc, useWork, type WorkRow } from '@/lib/works';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export default function WorkDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr } = useT();
  const { data: work, isLoading, error } = useWork(slug);

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={t.primary} accessibilityLabel={tr('work.loading')} />
      </View>
    );
  }
  if (error || !work) {
    return (
      <View style={s.center}>
        <Text style={[type.body, { color: t.text }]}>{error ? tr('work.error') : tr('work.notFound')}</Text>
      </View>
    );
  }
  return <Detail work={work} t={t} s={s} />;
}

function Detail({ work, t, s }: { work: WorkRow; t: ThemeColors; s: ReturnType<typeof makeStyles> }) {
  const [speaking, setSpeaking] = useState(false);
  const { t: tr, lang } = useT();
  const name = loc(work.name, lang);
  const kind = loc(work.type_name, lang);
  const complex = loc(work.complex_name, lang);
  const history = loc(work.history, lang);

  useEffect(() => () => void Speech.stop(), []);

  const narration = [name, kind, complex && tr('work.partOf', { complex }), history].filter(Boolean).join('. ');
  const toggleSpeech = () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    Speech.speak(narration, {
      language: lang === 'tr' ? 'tr-TR' : 'en-US',
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
    });
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body}>
      <Stack.Screen options={{ title: '' }} />

      <View style={s.hero}>
        <WorkGlyph slug={work.type_slug} size={72} />
        <View style={s.heroText}>
          <Text style={[type.eyebrow, { color: t.primary }]}>{upper(kind, lang)}</Text>
          <Text style={[type.title, { color: t.text }]} accessibilityRole="header">
            {name}
          </Text>
          {complex ? <Text style={[type.meta, { color: t.textMuted }]}>{complex}</Text> : null}
        </View>
      </View>

      <Pressable
        onPress={toggleSpeech}
        accessibilityRole="button"
        accessibilityState={{ busy: speaking }}
        style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.88 }]}>
        {speaking ? <StopIcon color={t.onPrimary} /> : <PlayIcon color={t.onPrimary} />}
        <Text style={[type.button, { color: t.onPrimary }]}>{speaking ? tr('work.stop') : tr('work.listen')}</Text>
      </Pressable>

      <View style={s.map} accessible accessibilityLabel={tr('work.mapLabel', { name })} importantForAccessibility="no-hide-descendants">
        <Map style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE} dragPan={false} touchZoom={false} touchRotate={false}>
          <Camera initialViewState={{ center: [work.lng, work.lat], zoom: 17 }} />
          <GeoJSONSource id="work" data={{ type: 'Point', coordinates: [work.lng, work.lat] }}>
            <Layer id="work-halo" type="circle" paint={{ 'circle-radius': 18, 'circle-color': t.surface, 'circle-opacity': 0.9 }} />
            <Layer
              id="work-circle"
              type="circle"
              paint={{ 'circle-radius': 11, 'circle-color': colorForType(work.type_slug), 'circle-stroke-width': 3, 'circle-stroke-color': t.surface }}
            />
          </GeoJSONSource>
        </Map>
      </View>

      {t.motifOpacity > 0 ? (
        <View style={s.band}>
          <KilimBand color={t.accent} accent={t.primary} height={10} opacity={0.6} />
        </View>
      ) : null}

      <Section title={tr('work.history')} t={t}>
        {history ? (
          <Text style={[type.body, { color: t.text }]}>{history}</Text>
        ) : (
          <View style={s.note}>
            <InfoIcon color={t.textMuted} />
            <Text style={[type.meta, { color: t.textMuted, flex: 1 }]}>{tr('work.noHistory')}</Text>
          </View>
        )}
      </Section>

      <Section title={tr('work.sources')} t={t}>
        {work.sources.length === 0 ? (
          <Text style={[type.meta, { color: t.textMuted }]}>{tr('work.noSources')}</Text>
        ) : (
          work.sources.map((src) => (
            <Pressable
              key={src.id}
              disabled={!src.url}
              onPress={() => src.url && Linking.openURL(src.url)}
              accessibilityRole={src.url ? 'link' : 'text'}
              accessibilityHint={src.url ? tr('work.sourceHint') : undefined}
              style={({ pressed }) => [s.source, pressed && { backgroundColor: t.background }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.itemTitle, { color: t.text, fontSize: 16 }]}>{src.title}</Text>
                <Text style={[type.meta, { color: t.textMuted }]}>
                  {[src.publisher, src.year, src.page && `s. ${src.page}`].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {src.url ? <ExternalIcon color={t.primary} /> : null}
            </Pressable>
          ))
        )}
      </Section>
    </ScrollView>
  );
}

function Section({ title, t, children }: { title: string; t: ThemeColors; children: ReactNode }) {
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <CengelMark color={t.accent} />
        <Text style={[type.heading, { color: t.text }]} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { padding: space.lg, gap: space.xl, paddingBottom: 56 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: t.background },
    hero: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
    heroText: { flex: 1, gap: space.xs },
    primaryBtn: {
      flexDirection: 'row',
      gap: space.sm,
      minHeight: 56,
      borderRadius: radius.pill,
      backgroundColor: t.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    map: { height: 200, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: t.border, backgroundColor: t.surface },
    band: { height: 10, marginHorizontal: -space.lg },
    note: {
      flexDirection: 'row',
      gap: space.md,
      padding: space.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    source: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      padding: space.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
  });
