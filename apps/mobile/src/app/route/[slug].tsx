import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { distanceM, type LngLat, type ThemeColors } from '@sezi/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { InfoIcon, PlayIcon, StopIcon, TurnIcon } from '@/design/icons';
import { CengelMark } from '@/design/motif';
import { radius, space, type, upper } from '@/design/type';
import { colorForType, WorkGlyph } from '@/design/work-glyph';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';
import { boundsOf, planRoute, walkingSpeed } from '@/lib/nav';
import { useProfile } from '@/lib/profile';
import { useGuidanceSimulation } from '@/lib/simulation';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const SPEEDS = [1, 3, 8];

export default function RouteScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const { profile } = useProfile();
  const plan = useMemo(() => (profile ? planRoute(slug, profile) : null), [slug, profile]);
  const [speed, setSpeed] = useState(1);
  const sim = useGuidanceSimulation(plan, profile!, speed);

  if (!profile || !plan) {
    return (
      <View style={s.center}>
        <Stack.Screen options={{ title: tr('route.eyebrow') }} />
        <Text style={[type.body, { color: t.text, textAlign: 'center' }]}>{tr('route.none')}</Text>
      </View>
    );
  }

  const endName = plan.end.name?.[lang] ?? plan.end.name?.tr ?? '';
  const minutes = Math.max(1, Math.round(plan.route.lengthM / walkingSpeed(profile) / 60));
  const { stepIndex, running, finished, distance } = sim.state;
  const current = stepIndex >= 0 ? plan.steps[stepIndex] : undefined;
  const upcoming = plan.steps[stepIndex + 1];
  const started = running || distance > 0;

  const routeLine: GeoJSON.Feature = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: plan.geometry.line } };
  const walked: GeoJSON.Feature = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: walkedLine(plan.geometry.line, distance, sim.state.position) },
  };
  const landmarks: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [...plan.passedLandmarks, plan.end].map((n) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: n.location },
      properties: { color: colorForType(n.workType ?? '') },
    })),
  };

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.titleRow}>
          {plan.end.workType ? <WorkGlyph slug={plan.end.workType} size={52} /> : null}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.eyebrow, { color: t.primary }]}>{upper(tr('route.eyebrow'), lang)}</Text>
            <Text style={[type.title, { color: t.text }]} accessibilityRole="header">
              {endName}
            </Text>
          </View>
        </View>

        <View style={s.chips}>
          <Fact label={tr('route.summary', { m: Math.round(plan.route.lengthM), min: minutes })} t={t} />
          <Fact
            label={plan.stairSegments === 0 ? tr('route.noStairs') : tr('route.stairs', { n: plan.stairSegments })}
            t={t}
            strong={profile.mobility === 'wheelchair'}
          />
        </View>

        <View style={s.map} accessible accessibilityLabel={tr('route.mapLabel', { m: Math.round(plan.route.lengthM) })} importantForAccessibility="no-hide-descendants">
          <Map style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE}>
            <Camera initialViewState={{ bounds: boundsOf(plan.geometry.line), padding: { top: 36, bottom: 36, left: 36, right: 36 } }} />
            <GeoJSONSource id="route" data={routeLine}>
              <Layer id="route-casing" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': t.surface, 'line-width': 10 }} />
              <Layer id="route-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': t.primary, 'line-width': 6, 'line-opacity': 0.45 }} />
            </GeoJSONSource>
            <GeoJSONSource id="walked" data={walked}>
              <Layer id="walked-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': t.primary, 'line-width': 6 }} />
            </GeoJSONSource>
            <GeoJSONSource id="landmarks" data={landmarks}>
              <Layer
                id="landmarks-circle"
                type="circle"
                paint={{ 'circle-radius': 8, 'circle-color': ['get', 'color'] as never, 'circle-stroke-width': 2, 'circle-stroke-color': t.surface }}
              />
            </GeoJSONSource>
            <GeoJSONSource id="walker" data={{ type: 'Point', coordinates: sim.state.position }}>
              <Layer id="walker-halo" type="circle" paint={{ 'circle-radius': 16, 'circle-color': t.accent, 'circle-opacity': 0.22 }} />
              <Layer id="walker-dot" type="circle" paint={{ 'circle-radius': 8, 'circle-color': t.accent, 'circle-stroke-width': 3, 'circle-stroke-color': t.surface }} />
            </GeoJSONSource>
          </Map>
        </View>

        {/* Canlı talimat kartı: ekran okuyucu her yeni talimatı duyurur. */}
        <View style={s.nowCard} accessibilityLiveRegion="polite" accessible>
          <View style={s.nowIcon}>
            <TurnIcon turn={current?.turn ?? 'straight'} arrived={finished} color={t.onPrimary} size={30} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[type.eyebrow, { color: t.onPrimary, opacity: 0.85 }]}>{upper(started ? tr('route.now') : tr('route.from'), lang)}</Text>
            <Text style={[type.lead, { color: t.onPrimary, fontFamily: type.heading.fontFamily }]}>
              {current?.text ?? tr('route.ready')}
            </Text>
            {upcoming && started && !finished ? (
              <Text style={[type.meta, { color: t.onPrimary, opacity: 0.85 }]}>
                {tr('route.next')}: {upcoming.text}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={s.progressTrack} accessibilityElementsHidden importantForAccessibility="no">
          <View style={[s.progressFill, { width: `${Math.min(100, (distance / sim.total) * 100)}%` }]} />
        </View>
        <Text style={[type.meta, { color: t.textMuted, marginTop: -space.md }]}>
          {tr('route.progress', { done: Math.round(distance), total: Math.round(sim.total) })}
        </Text>

        <View style={s.controls}>
          <Pressable
            onPress={running ? sim.pause : sim.play}
            accessibilityRole="button"
            style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.88 }]}>
            {running ? <StopIcon color={t.onPrimary} /> : <PlayIcon color={t.onPrimary} />}
            <Text style={[type.button, { color: t.onPrimary }]}>
              {running ? tr('route.pause') : finished ? tr('route.restart') : started ? tr('route.resume') : tr('route.start')}
            </Text>
          </Pressable>
          <Pressable
            onPress={sim.repeat}
            disabled={stepIndex < 0}
            accessibilityRole="button"
            accessibilityState={{ disabled: stepIndex < 0 }}
            style={({ pressed }) => [s.secondaryBtn, stepIndex < 0 && { opacity: 0.4 }, pressed && { opacity: 0.85 }]}>
            <Text style={[type.button, { color: t.text }]}>{tr('route.repeat')}</Text>
          </Pressable>
        </View>

        <View style={s.speedRow} accessibilityRole="radiogroup" accessibilityLabel={tr('route.speed')}>
          <Text style={[type.eyebrow, { color: t.textMuted }]}>{upper(tr('route.speed'), lang)}</Text>
          {SPEEDS.map((v) => (
            <Pressable
              key={v}
              onPress={() => setSpeed(v)}
              accessibilityRole="radio"
              accessibilityState={{ checked: speed === v }}
              style={[s.speedChip, { backgroundColor: speed === v ? t.text : t.surface, borderColor: speed === v ? t.text : t.border }]}>
              <Text style={[type.button, { fontSize: 15, color: speed === v ? t.background : t.text }]}>{v}×</Text>
            </Pressable>
          ))}
        </View>

        <View style={s.note}>
          <InfoIcon color={t.textMuted} />
          <Text style={[type.meta, { color: t.textMuted, flex: 1 }]}>{tr('route.simNote')}</Text>
        </View>

        <View style={{ gap: space.md }}>
          <View style={s.sectionTitle}>
            <CengelMark color={t.accent} />
            <Text style={[type.heading, { color: t.text }]} accessibilityRole="header">
              {tr('route.steps')}
            </Text>
          </View>
          {plan.steps.map((step, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <View key={`${step.nodeId}-${i}`} style={[s.step, active && { borderColor: t.primary, borderWidth: 2 }, done && { opacity: 0.55 }]}>
                <View style={[s.stepIcon, { backgroundColor: active ? t.primary : t.background }]}>
                  <TurnIcon turn={step.turn} arrived={i === plan.steps.length - 1} color={active ? t.onPrimary : t.text} size={22} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.body, { color: t.text }]}>{step.text}</Text>
                  <Text style={[type.meta, { color: t.textMuted }]}>{Math.round(step.atM)} m</Text>
                </View>
              </View>
            );
          })}
        </View>

        <Text style={[type.meta, { color: t.textMuted }]}>{tr('route.dataNote')}</Text>
      </ScrollView>
    </View>
  );
}

/** Rota çizgisinin yürünen kısmı (ilerleme göstergesi). */
function walkedLine(line: LngLat[], distance: number, position: LngLat): LngLat[] {
  if (distance <= 0) return [line[0]!, line[0]!];
  const out: LngLat[] = [line[0]!];
  let acc = 0;
  for (let i = 1; i < line.length; i++) {
    const seg = distanceM(line[i - 1]!, line[i]!);
    if (acc + seg >= distance) break;
    acc += seg;
    out.push(line[i]!);
  }
  out.push(position);
  return out;
}

function Fact({ label, t, strong }: { label: string; t: ThemeColors; strong?: boolean }) {
  return (
    <View style={[factStyle, { backgroundColor: strong ? t.primary : t.surface, borderColor: strong ? t.primary : t.border }]}>
      <Text style={[type.meta, { fontFamily: type.button.fontFamily, color: strong ? t.onPrimary : t.text }]}>{label}</Text>
    </View>
  );
}

const factStyle = { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1 } as const;

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { padding: space.lg, gap: space.lg, paddingBottom: 56 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: t.background },
    titleRow: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    map: { height: 300, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: t.border, backgroundColor: t.surface },
    nowCard: { flexDirection: 'row', gap: space.lg, padding: space.lg, borderRadius: radius.lg, backgroundColor: t.primary, alignItems: 'flex-start' },
    nowIcon: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: t.onPrimary, alignItems: 'center', justifyContent: 'center' },
    progressTrack: { height: 6, borderRadius: 3, backgroundColor: t.border, overflow: 'hidden' },
    progressFill: { height: 6, backgroundColor: t.accent },
    controls: { flexDirection: 'row', gap: space.md },
    primaryBtn: { flex: 2, flexDirection: 'row', gap: space.sm, minHeight: 56, borderRadius: radius.pill, backgroundColor: t.text, alignItems: 'center', justifyContent: 'center' },
    secondaryBtn: { flex: 1, minHeight: 56, borderRadius: radius.pill, borderWidth: 1.5, borderColor: t.border, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' },
    speedRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    speedChip: { minWidth: 52, minHeight: 44, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    note: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: t.border, backgroundColor: t.surface },
    sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    step: { flexDirection: 'row', gap: space.md, alignItems: 'center', padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface },
    stepIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  });
