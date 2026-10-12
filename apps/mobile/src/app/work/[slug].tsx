import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import type { ThemeColors } from '@sezi/shared';
import * as Speech from 'expo-speech';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
        <Text style={s.body}>{error ? tr('work.error') : tr('work.notFound')}</Text>
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
    Speech.speak(narration, { language: lang === 'tr' ? 'tr-TR' : 'en-US', onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false) });
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.body_}>
      <Stack.Screen options={{ title: name }} />

      <Text style={s.title} accessibilityRole="header">
        {name}
      </Text>
      <Text style={s.meta}>
        {kind}
        {complex ? ` · ${complex}` : ''}
      </Text>

      <Pressable
        onPress={toggleSpeech}
        accessibilityRole="button"
        accessibilityState={{ busy: speaking }}
        style={({ pressed }) => [s.primaryBtn, { opacity: pressed ? 0.85 : 1 }]}>
        <Text style={s.primaryBtnText}>{speaking ? tr('work.stop') : tr('work.listen')}</Text>
      </Pressable>

      <View style={s.map} accessible accessibilityLabel={tr('work.mapLabel', { name })} importantForAccessibility="no-hide-descendants">
        <Map style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE} dragPan={false} touchZoom={false} touchRotate={false}>
          <Camera initialViewState={{ center: [work.lng, work.lat], zoom: 17 }} />
          <GeoJSONSource id="work" data={{ type: 'Point', coordinates: [work.lng, work.lat] }}>
            <Layer
              id="work-circle"
              type="circle"
              paint={{ 'circle-radius': 10, 'circle-color': t.accent, 'circle-stroke-width': 3, 'circle-stroke-color': t.surface }}
            />
          </GeoJSONSource>
        </Map>
      </View>

      <Text style={s.h2} accessibilityRole="header">
        {tr('work.history')}
      </Text>
      {history ? (
        <Text style={s.body}>{history}</Text>
      ) : (
        <Text style={s.muted}>{tr('work.noHistory')}</Text>
      )}

      <Text style={s.h2} accessibilityRole="header">
        {tr('work.sources')}
      </Text>
      {work.sources.length === 0 ? (
        <Text style={s.muted}>{tr('work.noSources')}</Text>
      ) : (
        work.sources.map((src) => (
          <Pressable
            key={src.id}
            disabled={!src.url}
            onPress={() => src.url && Linking.openURL(src.url)}
            accessibilityRole={src.url ? 'link' : 'text'}
            accessibilityHint={src.url ? tr('work.sourceHint') : undefined}
            style={s.source}>
            <Text style={[s.body, src.url && s.link]}>{src.title}</Text>
            <Text style={s.muted}>{[src.publisher, src.year, src.page && `s. ${src.page}`].filter(Boolean).join(' · ')}</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body_: { padding: 16, gap: 12, paddingBottom: 48 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: t.background },
    title: { fontSize: 28, fontWeight: '700', color: t.text },
    meta: { fontSize: 16, color: t.textMuted, marginTop: -6 },
    h2: { fontSize: 20, fontWeight: '700', color: t.text, marginTop: 12 },
    body: { fontSize: 17, lineHeight: 25, color: t.text },
    muted: { fontSize: 15, lineHeight: 22, color: t.textMuted },
    link: { color: t.primary, textDecorationLine: 'underline' },
    map: { height: 200, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: t.border },
    primaryBtn: { minHeight: 52, borderRadius: 14, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' },
    primaryBtnText: { fontSize: 17, fontWeight: '700', color: t.onPrimary },
    source: { paddingVertical: 8, gap: 2, borderBottomWidth: 1, borderBottomColor: t.border },
  });
