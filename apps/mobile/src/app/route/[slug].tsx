import { Camera, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { distanceM, type LngLat, type ThemeColors } from '@sezi/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CueFlash } from '@/components/cue-flash';
import { DeferredMap } from '@/components/deferred-map';
import { NavAlertBanner } from '@/components/nav-alert';
import { ScenarioPanel } from '@/components/scenario-panel';
import { SoundCaptions } from '@/components/sound-captions';
import { Button, Segmented } from '@/components/ui';
import { PlayIcon, StopIcon, TurnIcon } from '@/design/icons';
import { radius, space, type } from '@/design/type';
import { colorForType } from '@/design/work-glyph';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';
import { boundsOf, segmentLines, walkingSpeed } from '@/lib/nav';
import { useProfile } from '@/lib/profile';
import { useSettings } from '@/lib/settings';
import { useNavSession } from '@/lib/sim/session';

/**
 * Rota: önce harita ve tek satır özet, sonra yönlendirmeler.
 * Sanal yürüyüş, hız, jüri senaryoları ve ses altyazısı yalnızca Ayarlar → Geliştirici seçenekleri → Simülasyon modu açıkken görünür.
 */
export default function RouteScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const { profile } = useProfile();
  const { settings, markVisited } = useSettings();
  const sim = useNavSession(slug, profile, { speechRate: settings.speechRate, onArrive: markVisited });
  const { plan } = sim;
  const dev = settings.devSimulation;

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
  const { stepIndex, running, finished, distance, speed } = sim.state;
  const current = stepIndex >= 0 ? plan.steps[stepIndex] : undefined;
  const started = running || distance > 0;
  const summary = [tr('route.summary', { m: Math.round(plan.route.lengthM), min: minutes }), plan.stairSegments === 0 ? tr('route.noStairs') : tr('route.stairs', { n: plan.stairSegments })].join(' · ');

  const routeLine: GeoJSON.Feature = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: plan.geometry.line } };
  const walked: GeoJSON.Feature = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: walkedLine(plan.geometry.line, distance, sim.state.position) } };
  const landmarks: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [...plan.passedLandmarks, plan.end].map((n) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: n.location }, properties: { color: colorForType(n.workType ?? '') } })),
  };
  const playLabel = running ? tr('route.pause') : finished ? tr('route.restart') : started ? tr('route.resume') : tr('route.start');

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.map} accessible accessibilityLabel={tr('route.mapLabel', { m: Math.round(plan.route.lengthM) })} importantForAccessibility="no-hide-descendants">
          <DeferredMap>
            <Camera initialViewState={{ bounds: boundsOf(plan.geometry.line), padding: { top: 40, bottom: 40, left: 40, right: 40 } }} />
            <GeoJSONSource id="route" data={routeLine}>
              <Layer id="route-casing" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': t.surface, 'line-width': 10 }} />
              <Layer id="route-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': t.primary, 'line-width': 6, 'line-opacity': dev ? 0.4 : 1 }} />
            </GeoJSONSource>
            {dev ? (
              <GeoJSONSource id="walked" data={walked}>
                <Layer id="walked-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': t.primary, 'line-width': 6 }} />
              </GeoJSONSource>
            ) : null}
            <GeoJSONSource id="landmarks" data={landmarks}>
              <Layer id="landmarks-circle" type="circle" paint={{ 'circle-radius': 7, 'circle-color': ['get', 'color'] as never, 'circle-stroke-width': 2, 'circle-stroke-color': t.surface }} />
            </GeoJSONSource>
            <GeoJSONSource id="blocked" data={segmentLines(sim.state.blocked)}>
              <Layer id="blocked-line" type="line" paint={{ 'line-color': t.danger, 'line-width': 7, 'line-dasharray': [1, 0.6] as never }} />
            </GeoJSONSource>
            <GeoJSONSource id="end" data={{ type: 'Point', coordinates: plan.end.location }}>
              <Layer id="end-dot" type="circle" paint={{ 'circle-radius': 9, 'circle-color': t.accent, 'circle-stroke-width': 3, 'circle-stroke-color': t.surface }} />
            </GeoJSONSource>
            {dev ? (
              <GeoJSONSource id="walker" data={{ type: 'Point', coordinates: sim.state.position }}>
                <Layer id="walker-halo" type="circle" paint={{ 'circle-radius': 16, 'circle-color': t.primary, 'circle-opacity': 0.18 }} />
                <Layer id="walker-dot" type="circle" paint={{ 'circle-radius': 8, 'circle-color': t.primary, 'circle-stroke-width': 3, 'circle-stroke-color': t.surface }} />
              </GeoJSONSource>
            ) : null}
          </DeferredMap>
        </View>

        <View style={{ gap: 2 }}>
          <Text style={[type.title, { color: t.text }]} accessibilityRole="header">
            {endName}
          </Text>
          <Text style={[type.meta, { color: t.textMuted }]}>{summary}</Text>
        </View>

        {dev ? (
          <>
            <NavAlertBanner alert={sim.state.alert} onDismiss={sim.dismissAlert} />
            {/* Canlı talimat: ekran okuyucu her yeni talimatı duyurur. */}
            <View style={[s.now, { backgroundColor: t.primary }]} accessibilityLiveRegion="polite" accessible>
              <TurnIcon turn={current?.turn ?? 'straight'} arrived={finished} color={t.onPrimary} size={32} />
              <Text style={[type.lead, { color: t.onPrimary, flex: 1, fontFamily: type.button.fontFamily }]}>{current?.text ?? tr('route.ready')}</Text>
            </View>
            <View style={s.track} accessibilityRole="progressbar" accessibilityLabel={tr('route.progress', { done: Math.round(distance), total: Math.round(sim.total) })} accessibilityValue={{ min: 0, max: 100, now: sim.total ? Math.round((distance / sim.total) * 100) : 0 }}>
              <View style={[s.fill, { width: `${sim.total ? Math.min(100, (distance / sim.total) * 100) : 0}%` }]} />
            </View>
            <View style={s.row}>
              <Button style={{ flex: 1 }} label={playLabel} onPress={running ? sim.pause : sim.play} icon={(c) => (running ? <StopIcon color={c} /> : <PlayIcon color={c} />)} />
              <Button style={{ flex: 1 }} variant="outline" label={tr('route.repeat')} onPress={sim.repeat} disabled={stepIndex < 0} />
            </View>
            <Segmented label={tr('route.speed')} value={speed} onChange={sim.setSpeed} options={[1, 3, 8].map((v) => ({ value: v, label: `${v}×` }))} />
            <Button variant="ghost" label={tr('guide.fullscreen')} hint={tr('guide.fullscreenHint')} onPress={() => router.push({ pathname: '/guide/[slug]', params: { slug } })} />
            {started ? <SoundCaptions sounds={sim.state.sounds} muted={profile.hearing === 'deaf' || !profile.senses.audio || sim.state.noisy} /> : null}
            <ScenarioPanel state={sim.state} onBlock={sim.blockAhead} onWrongTurn={sim.wrongTurn} onCrowd={sim.toggleCrowd} />
            <Button variant="outline" label={tr('sim.compare')} hint={tr('sim.compareHint')} onPress={() => router.push({ pathname: '/compare/[slug]', params: { slug } })} />
          </>
        ) : (
          <Text style={[type.body, { color: t.textMuted }]}>{tr('route.fieldOnly')}</Text>
        )}

        <View style={{ gap: space.xs }}>
          <Text style={[type.heading, { color: t.text }]} accessibilityRole="header">
            {tr('route.steps')}
          </Text>
          {plan.steps.map((step, i) => {
            const active = dev && i === stepIndex;
            return (
              <View key={`${step.nodeId}-${i}`} style={[s.step, { borderTopColor: t.border }, i === 0 && { borderTopWidth: 0 }]} accessible accessibilityLabel={`${step.text} ${Math.round(step.atM)} m`}>
                <View style={[s.stepIcon, { backgroundColor: active ? t.primary : t.soft }]}>
                  <TurnIcon turn={step.turn} arrived={i === plan.steps.length - 1} color={active ? t.onPrimary : t.text} size={20} />
                </View>
                <Text style={[type.body, { color: t.text, flex: 1 }]}>{step.text}</Text>
                <Text style={[type.meta, { color: t.textMuted }]}>{Math.round(step.atM)} m</Text>
              </View>
            );
          })}
        </View>
        <Text style={[type.meta, { color: t.textMuted }]}>{tr('route.dataNote')}</Text>
      </ScrollView>
      <CueFlash count={sim.state.cueCount} color={t.accent} enabled={dev && (profile.hearing !== 'full' || sim.state.noisy)} />
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

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { padding: space.xl, gap: space.lg, paddingBottom: 56 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: t.background },
    map: { height: 320, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: t.soft },
    now: { flexDirection: 'row', gap: space.lg, padding: space.lg, borderRadius: radius.xl, alignItems: 'center' },
    track: { height: 4, borderRadius: 2, backgroundColor: t.soft, overflow: 'hidden' },
    fill: { height: 4, backgroundColor: t.primary },
    row: { flexDirection: 'row', gap: space.sm },
    step: { flexDirection: 'row', gap: space.md, alignItems: 'center', paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth },
    stepIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  });
