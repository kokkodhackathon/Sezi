import { Camera, GeoJSONSource, Layer, type CameraRef } from '@maplibre/maplibre-react-native';
import { distanceM, type LngLat, type ThemeColors } from '@sezi/shared';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { CueFlash } from '@/components/cue-flash';
import { DeferredMap } from '@/components/deferred-map';
import { NavAlertBanner } from '@/components/nav-alert';
import { StoryPopup } from '@/components/story-popup';
import { Button, Chip, EmptyState, Note, Segmented } from '@/components/ui';
import { PlayIcon, TurnIcon } from '@/design/icons';
import { radius, space, type } from '@/design/type';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { useT } from '@/lib/i18n';
import { boundsOf, DEFAULT_START_POINT, formatDistance, hasRouteTo, pilotLandmarks, walkingSpeed } from '@/lib/nav';
import { useProfile } from '@/lib/profile';
import { useSettings } from '@/lib/settings';
import { useStoryPoints } from '@/lib/story';
import { useWalkSession, walkSession, type WalkConfig } from '@/lib/walk/session';

/** Hedef seçenekleri: pilot alanda eseri olan yer işaretleri. */
const DESTINATIONS = pilotLandmarks.filter((n) => n.workSlug);

/**
 * Yürüyüş: konum izlenir, anlatım noktasına gelince bilgi açılır. Hedef seçilirse (yalnız pilot alan)
 * rota yol üstündeki anlatım noktalarından geçer. Ekran yürüyüş boyunca açık kalır.
 */
export default function WalkScreen() {
  const params = useLocalSearchParams<{ dest?: string }>();
  const t = useSeziTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const { height } = useWindowDimensions();
  const { profile } = useProfile();
  const { settings, markVisited } = useSettings();
  const points = useStoryPoints();
  const state = useWalkSession();
  const [dest, setDest] = useState<string | null>(() => (params.dest && hasRouteTo(params.dest) ? params.dest : null));
  const [follow, setFollow] = useState(true);
  const cameraRef = useRef<CameraRef>(null);
  const [initialCenter] = useState<LngLat>(() => state.fix?.position ?? points[0]?.location ?? DEFAULT_START_POINT);

  const cfg = useMemo<WalkConfig | null>(
    () =>
      profile
        ? { profile, speechRate: settings.speechRate, playback: settings.storyPlayback, sim: settings.devSimulation, simStart: settings.simStart, onArrive: markVisited }
        : null,
    [profile, settings.speechRate, settings.storyPlayback, settings.devSimulation, settings.simStart, markVisited],
  );

  useEffect(() => {
    if (cfg) walkSession.configure(cfg);
  }, [cfg]);
  useEffect(() => () => walkSession.stop(), []);

  // Ekran yürüyüş boyunca açık kalır (arka planda konum izlenmez).
  useEffect(() => {
    if (!state.active) return;
    void activateKeepAwakeAsync('walk');
    return () => void deactivateKeepAwake('walk');
  }, [state.active]);

  useEffect(() => {
    if (follow && state.fix) cameraRef.current?.easeTo({ center: state.fix.position, duration: 500 });
  }, [follow, state.fix]);

  // Ekrandaki nokta sunucudan kaldırıldıysa pop-up kapanır, sıradaki açılır.
  useEffect(() => {
    if (state.popup && !points.some((p) => p.id === state.popup)) walkSession.closePopup();
  }, [state.popup, points]);

  if (!profile || !cfg) return null;

  const canHear = profile.hearing !== 'deaf' && profile.senses.audio;
  const plan = state.plan;
  const popupPoint = state.popup ? points.find((p) => p.id === state.popup) : undefined;
  const current = plan && state.stepIndex >= 0 ? plan.steps[state.stepIndex] : undefined;

  const fired = new Set(state.fired);
  const nearest = state.fix
    ? points
        .filter((p) => !fired.has(p.id))
        .map((p) => ({ p, d: distanceM(state.fix!.position, p.location) }))
        .sort((a, b) => a.d - b.d)[0]
    : undefined;

  const storiesFc: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: points.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p.location }, properties: { fired: fired.has(p.id) } })),
  };

  const chooseDest = (slug: string | null) => {
    setDest(slug);
    if (state.active) void walkSession.setDestination(slug);
  };

  const permissionBlocked = !state.active && (state.permission === 'denied' || state.permission === 'off');

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.body, popupPoint && { paddingBottom: 360 }]}>
        <View style={[s.map, { height: Math.round(height * 0.45) }]} accessible accessibilityLabel={tr('walk.mapLabel', { n: points.length })} importantForAccessibility="no-hide-descendants">
          <DeferredMap>
            <Camera ref={cameraRef} initialViewState={plan ? { bounds: boundsOf(plan.geometry.line), padding: { top: 40, bottom: 40, left: 40, right: 40 } } : { center: initialCenter, zoom: 16 }} />
            {plan ? (
              <GeoJSONSource id="route" data={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: plan.geometry.line } }}>
                <Layer id="route-casing" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': t.surface, 'line-width': 10 }} />
                <Layer id="route-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': t.primary, 'line-width': 6 }} />
              </GeoJSONSource>
            ) : null}
            <GeoJSONSource id="stories" data={storiesFc}>
              <Layer id="stories-circle" type="circle" paint={{ 'circle-radius': 8, 'circle-color': ['case', ['get', 'fired'], t.textMuted, t.accent] as never, 'circle-stroke-width': 2, 'circle-stroke-color': t.surface }} />
            </GeoJSONSource>
            {plan ? (
              <GeoJSONSource id="end" data={{ type: 'Point', coordinates: plan.end.location }}>
                <Layer id="end-dot" type="circle" paint={{ 'circle-radius': 9, 'circle-color': t.primary, 'circle-stroke-width': 3, 'circle-stroke-color': t.surface }} />
              </GeoJSONSource>
            ) : null}
            {state.fix ? (
              <GeoJSONSource id="me" data={{ type: 'Point', coordinates: state.fix.position }}>
                <Layer id="me-halo" type="circle" paint={{ 'circle-radius': 16, 'circle-color': t.primary, 'circle-opacity': 0.18 }} />
                <Layer id="me-dot" type="circle" paint={{ 'circle-radius': 8, 'circle-color': t.primary, 'circle-stroke-width': 3, 'circle-stroke-color': t.surface }} />
              </GeoJSONSource>
            ) : null}
          </DeferredMap>
        </View>
        <View style={{ alignItems: 'flex-start' }}>
          <Chip label={tr('walk.follow')} selected={follow} onPress={() => setFollow((v) => !v)} />
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={[type.meta, { color: t.textMuted }]}>{tr('walk.dest')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl }} style={{ marginHorizontal: -space.xl }}>
            <Chip label={tr('walk.noDest')} selected={dest === null} onPress={() => chooseDest(null)} />
            {DESTINATIONS.map((n) => (
              <Chip key={n.id} label={n.name?.[lang] ?? n.name?.tr ?? ''} selected={dest === n.workSlug} onPress={() => chooseDest(n.workSlug!)} />
            ))}
          </ScrollView>
        </View>

        {state.routeNote ? <Note text={tr(state.routeNote === 'outside_pilot' ? 'walk.outsidePilot' : 'walk.noRoute')} /> : null}
        {plan ? (
          <View style={{ gap: 2 }}>
            <Text style={[type.meta, { color: t.textMuted }]}>
              {tr('route.summary', { m: Math.round(plan.route.lengthM), min: Math.max(1, Math.round(plan.route.lengthM / walkingSpeed(profile) / 60)) })}
            </Text>
            {plan.via ? (
              <Text style={[type.meta, { color: t.primary, fontFamily: type.button.fontFamily }]}>
                {plan.via.extraM > 0 ? tr('walk.via', { n: plan.via.storyIds.length, m: plan.via.extraM }) : tr('walk.viaOnRoute', { n: plan.via.storyIds.length })}
              </Text>
            ) : null}
          </View>
        ) : null}
        {nearest ? (
          <Text style={[type.meta, { color: t.textMuted }]}>
            {tr('walk.nearest', { name: nearest.p.title[lang] ?? nearest.p.title.tr, d: formatDistance(nearest.d, lang) })}
          </Text>
        ) : null}

        {state.active ? (
          <>
            {state.source === 'sim' ? (
              <View style={{ gap: space.sm }}>
                <Text style={[type.meta, { color: t.textMuted }]}>{tr('walk.simNote')}</Text>
                <Segmented label={tr('route.speed')} value={state.speed} onChange={walkSession.setSpeed} options={[1, 3, 8].map((v) => ({ value: v, label: `${v}×` }))} />
              </View>
            ) : null}
            {!state.fix ? <Text style={[type.body, { color: t.textMuted }]}>{tr('walk.waiting')}</Text> : null}
            <NavAlertBanner alert={state.alert} onDismiss={walkSession.dismissAlert} />
            {plan ? (
              // Canlı talimat: ekran okuyucu her yeni talimatı duyurur.
              <View style={[s.now, { backgroundColor: t.primary }]} accessibilityLiveRegion="polite" accessible>
                <TurnIcon turn={current?.turn ?? 'straight'} arrived={state.finished} color={t.onPrimary} size={32} />
                <Text style={[type.lead, { color: t.onPrimary, flex: 1, fontFamily: type.button.fontFamily }]}>{current?.text ?? tr('route.ready')}</Text>
              </View>
            ) : null}
            <Button variant="outline" label={tr('walk.stop')} onPress={walkSession.stop} />
          </>
        ) : permissionBlocked ? (
          <EmptyState
            title={tr(state.permission === 'off' ? 'walk.servicesOff' : 'walk.denied')}
            action={<Button label={tr('walk.openSettings')} onPress={() => void Linking.openSettings()} />}
          />
        ) : null}
        {!state.active ? (
          <Button label={tr('walk.start')} hint={tr('walk.startHint')} icon={(c) => <PlayIcon color={c} />} onPress={() => void walkSession.start(cfg, dest)} />
        ) : null}
      </ScrollView>

      {popupPoint ? (
        <StoryPopup
          point={popupPoint}
          playing={state.playing === popupPoint.id}
          canPlay={canHear}
          queued={state.queue.length}
          onPlay={() => walkSession.playStory(popupPoint.id)}
          onStop={walkSession.stopStory}
          onClose={walkSession.closePopup}
        />
      ) : null}
      <CueFlash count={state.cueCount} color={t.accent} enabled={profile.hearing !== 'full' || !profile.senses.audio} />
    </View>
  );
}

const makeStyles = (t: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    body: { padding: space.xl, gap: space.lg },
    map: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: t.soft },
    now: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
  });
