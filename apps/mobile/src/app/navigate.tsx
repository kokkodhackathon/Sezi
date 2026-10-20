import { sliceLine, type LngLat, type NavPoint, type SweetTheme } from '@sezi/shared';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CueFlash } from '@/components/cue-flash';
import { EndPin, ExtraLines, PointsLayer, RouteLine, SeziMap, UserDot, type MapPoint, type SeziMapHandle } from '@/components/map';
import { NavAlertBanner } from '@/components/nav-alert';
import { PointPopup } from '@/components/point-popup';
import { ScenarioPanel } from '@/components/scenario-panel';
import { SoundCaptions } from '@/components/sound-captions';
import { Badge, Button, Chip, Note, Segmented } from '@/components/ui';
import { ChevronIcon, CloseIcon, MapIcon, PinIcon, PlayIcon, StopIcon, TurnIcon } from '@/design/icons';
import { FadeInItem, outline, SoftPressable, sweetShadow } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useT } from '@/lib/i18n';
import { formatDistance, pilotWorks, segmentLines, useNavVersion, useStartPoints, walkingSpeed, type PlannedRoute } from '@/lib/nav';
import { navigation, useNavigation, type NavConfig, type NavState } from '@/lib/navigation/session';
import { useNavPoints, useWorkPoints } from '@/lib/points';
import { useProfile } from '@/lib/profile';
import { useSettings } from '@/lib/settings';
import { coverOf, loc, photoUrl, useWork } from '@/lib/works';

/** Hedef seçenekleri: pilot alandaki eserler, ada göre. */
const DESTINATIONS = [...pilotWorks].sort((a, b) => (a.name?.tr ?? '').localeCompare(b.name?.tr ?? '', 'tr'));

const minutesFor = (m: number, mps: number) => Math.max(1, Math.round(m / mps / 60));

/**
 * Navigasyon: rota planı, canlı rehberlik ve yürüyüş tek ekranda.
 * Nereden (konumum, başlangıç noktası ya da haritada seçilen yer) → nereye (eser, tur ya da hedefsiz gezinti) →
 * yakındaki anlatım noktalarına uğrayan rota → yürürken noktalarda bilgi ve ses → esere varınca varış kartı.
 */
export default function Navigate() {
  const params = useLocalSearchParams<{ dest?: string; tour?: string }>();
  const t = useSweetTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { t: tr, lang } = useT();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { profile } = useProfile();
  const { settings, markVisited } = useSettings();
  const state = useNavigation();
  const points = useNavPoints();
  const workPts = useWorkPoints();
  const starts = useStartPoints();
  const version = useNavVersion();
  const mapRef = useRef<SeziMapHandle>(null);
  const [picking, setPicking] = useState(false);
  const [follow, setFollow] = useState(true);

  const cfg = useMemo<NavConfig | null>(
    () => (profile ? { profile, speechRate: settings.speechRate, playback: settings.storyPlayback, sim: settings.devSimulation, onArrive: markVisited } : null),
    [profile, settings.speechRate, settings.storyPlayback, settings.devSimulation, markVisited],
  );

  // Ekran açılınca hedef/tur yüklenir; çıkınca her şey susar ve konum izlenmez.
  useEffect(() => {
    if (!cfg) return;
    navigation.configure(cfg);
    const tour = params.tour ? params.tour.split(',').filter(Boolean) : [];
    navigation.open(tour[0] ?? params.dest ?? null, tour.slice(1));
    return () => navigation.close();
    // Ekran açılışında ve hedef/tur parametresi değişince (derin bağlantı); ayar değişiklikleri configure ile gelir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!cfg, params.dest, params.tour]);

  useEffect(() => {
    if (cfg) navigation.configure(cfg);
  }, [cfg]);

  // Noktalar ya da onaylı bildirimler değişince önizleme rotası yenilenir.
  useEffect(() => {
    navigation.refresh();
  }, [version]);

  // Ekran yürüyüş boyunca açık kalır.
  useEffect(() => {
    if (state.phase !== 'active') return;
    void activateKeepAwakeAsync('navigate');
    return () => void deactivateKeepAwake('navigate');
  }, [state.phase]);

  const mapH = Math.round(height * (state.phase === 'plan' ? 0.44 : state.phase === 'active' ? 0.5 : 0.3));

  // Plan değişince rota ekrana sığdırılır; yürürken kamera kullanıcıyı izler.
  const plan = state.plan;
  useEffect(() => {
    if (state.phase !== 'plan' || !plan) return;
    mapRef.current?.fit(plan.geometry.line, { top: insets.top + 72, bottom: 40 });
  }, [plan, state.phase, insets.top]);
  useEffect(() => {
    if (state.phase === 'active' && follow && state.position) mapRef.current?.centerOn(state.position);
  }, [state.position, state.phase, follow]);

  const order = useMemo(() => new Map((plan?.via.pointIds ?? []).map((id, i) => [id, i + 1])), [plan]);
  const mapPoints = useMemo(() => buildMapPoints(points, starts, state, order, lang), [points, starts, state, order, lang]);

  if (!profile || !cfg) return null;

  const canHear = profile.hearing !== 'deaf' && profile.senses.audio;
  const sim = cfg.sim && state.start.kind !== 'here';
  const popupPoint = state.popup ? (points.find((p) => p.id === state.popup) ?? workPts.find((p) => p.id === state.popup)) : undefined;
  const walked = plan && state.phase === 'active' && state.distance > 1 ? sliceLine(plan.geometry.line, 0, state.distance) : undefined;
  const userAt = state.phase === 'active' ? state.position : state.start.kind === 'here' ? state.here : null;
  const startAt = state.start.kind === 'pick' ? state.start.location : plan?.geometry.line[0];

  const onMapPress = (p: LngLat) => {
    if (!picking) return;
    setPicking(false);
    navigation.setStart({ kind: 'pick', location: p });
  };
  const onPointPress = (id: string) => {
    if (state.phase !== 'plan' || picking) return;
    if (id.startsWith('work:')) navigation.setDest(id.slice(5));
    else if (starts.some((p) => p.id === id)) navigation.setStart({ kind: 'point', id });
  };

  return (
    <View style={s.screen}>
      <SeziMap
        ref={mapRef}
        style={{ height: mapH }}
        initial={plan ? plan.geometry.line : starts.map((p) => p.location)}
        initialPadding={{ top: insets.top + 72 }}
        onPress={onMapPress}
        accessibilityLabel={tr('nav.mapLabel', { n: order.size })}>
        {plan ? <RouteLine line={plan.geometry.line} walked={walked} /> : null}
        {state.blocked.length ? <ExtraLines id="blocked" data={segmentLines(state.blocked)} color={t.danger} dashed /> : null}
        <PointsLayer points={mapPoints} onPress={onPointPress} />
        {startAt && state.phase === 'plan' ? <EndPin id="start" location={startAt} kind="start" /> : null}
        {plan ? <EndPin id="end" location={plan.end.location} kind="end" /> : null}
        {userAt ? <UserDot location={userAt} /> : null}
      </SeziMap>

      {/* Haritanın üstünde: kapat ve konuma dön. */}
      <View style={[s.mapBar, { top: insets.top + space.sm }]} pointerEvents="box-none">
        <RoundButton label={tr('nav.close')} onPress={() => router.back()} t={t}>
          <CloseIcon color={t.text} />
        </RoundButton>
        {state.phase === 'active' ? (
          <RoundButton label={tr('nav.recenter')} onPress={() => setFollow((v) => !v)} t={t} active={follow}>
            <PinIcon color={follow ? t.primary.ink : t.text} size={20} />
          </RoundButton>
        ) : null}
      </View>
      {picking ? (
        <View style={[s.pickBanner, sweetShadow(t), { top: insets.top + 72 }]} accessibilityLiveRegion="polite">
          <Text style={[type.button, { color: t.primary.ink }]}>{tr('nav.pickHint')}</Text>
        </View>
      ) : null}

      <View style={[s.panel, outline(t)]}>
        <View style={[s.handle, { backgroundColor: t.border }]} />
        <ScrollView contentContainerStyle={[s.panelBody, { paddingBottom: insets.bottom + space.xl }, popupPoint && { paddingBottom: 380 }]}>
          {state.phase === 'plan' ? (
            <PlanPanel state={state} starts={starts} points={points} order={order} picking={picking} setPicking={setPicking} sim={sim} t={t} />
          ) : state.phase === 'active' ? (
            <ActivePanel state={state} points={points} order={order} sim={sim} canHear={canHear} hearing={profile.hearing} mps={walkingSpeed(profile)} t={t} />
          ) : (
            <ArrivalPanel state={state} points={points} canHear={canHear} t={t} />
          )}
        </ScrollView>
      </View>

      {/* Varış ekranında eserin bilgisi kartta; gezintinin son noktası ise pop-up'ta açılır. */}
      {popupPoint && (state.phase !== 'arrived' || !state.arrived) ? (
        <PointPopup
          point={popupPoint}
          order={order.get(popupPoint.id)}
          playing={state.playing === popupPoint.id}
          canPlay={canHear}
          queued={state.queue.length}
          onPlay={() => navigation.playPoint(popupPoint.id)}
          onStop={navigation.stopAudio}
          onClose={navigation.closePopup}
        />
      ) : null}
      <CueFlash count={state.cueCount} color={t.accentText} enabled={profile.hearing !== 'full' || !profile.senses.audio || state.noisy} />
    </View>
  );
}

// ---------- Plan ----------

function PlanPanel({
  state,
  starts,
  points,
  order,
  picking,
  setPicking,
  sim,
  t,
}: {
  state: NavState;
  starts: ReturnType<typeof useStartPoints>;
  points: NavPoint[];
  order: Map<string, number>;
  picking: boolean;
  setPicking: (v: boolean) => void;
  sim: boolean;
  t: SweetTheme;
}) {
  const s = makeStyles(t);
  const { t: tr, lang } = useT();
  const { profile } = useProfile();
  const plan = state.plan;
  const dest = state.dest ? DESTINATIONS.find((n) => n.workSlug === state.dest) : undefined;
  const title = dest ? (dest.name?.[lang] ?? dest.name?.tr ?? '') : tr('nav.stroll');
  const mps = profile ? walkingSpeed(profile) : 1.2;
  const blockedPermission = state.start.kind === 'here' && (state.permission === 'denied' || state.permission === 'off');
  const canBegin = sim ? !!plan : !(state.dest && !plan && state.note !== 'need_location') && !blockedPermission;

  return (
    <>
      <View style={{ gap: space.xs }}>
        <Text style={[type.title, { color: t.text }]} accessibilityRole="header">
          {title}
        </Text>
        {plan ? <RouteSummary plan={plan} mps={mps} t={t} /> : null}
        {state.tour.length ? <Text style={[type.meta, { color: t.textMuted }]}>{tr('nav.tourLeft', { n: state.tour.length })}</Text> : null}
      </View>

      {/* Nereden */}
      <View style={{ gap: space.sm }}>
        <Text style={s.label}>{tr('nav.from')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={s.chipScroll}>
          <Chip label={tr('nav.here')} selected={state.start.kind === 'here'} onPress={() => navigation.setStart({ kind: 'here' })} icon={(c) => <PinIcon color={c} size={18} />} />
          <Chip label={state.start.kind === 'pick' ? tr('nav.picked') : tr('nav.pickOnMap')} selected={state.start.kind === 'pick' || picking} onPress={() => setPicking(!picking)} icon={(c) => <MapIcon color={c} size={18} />} />
          {starts.map((p) => (
            <Chip key={p.id} label={p.name[lang] ?? p.name.tr} selected={state.start.kind === 'point' && state.start.id === p.id} onPress={() => navigation.setStart({ kind: 'point', id: p.id })} />
          ))}
        </ScrollView>
      </View>

      {/* Nereye */}
      {state.tour.length === 0 ? (
        <View style={{ gap: space.sm }}>
          <Text style={s.label}>{tr('nav.to')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={s.chipScroll}>
            <Chip label={tr('nav.stroll')} selected={state.dest === null} onPress={() => navigation.setDest(null)} />
            {DESTINATIONS.map((n) => (
              <Chip key={n.id} label={n.name?.[lang] ?? n.name?.tr ?? ''} selected={state.dest === n.workSlug} onPress={() => navigation.setDest(n.workSlug!)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {state.note ? <Note text={tr(`nav.note.${state.note}`)} /> : null}
      {blockedPermission ? (
        <View style={{ gap: space.sm }}>
          <Note text={tr(state.permission === 'off' ? 'nav.servicesOff' : 'nav.denied')} />
          <Button variant="outline" label={tr('nav.openSettings')} onPress={() => void Linking.openSettings()} />
        </View>
      ) : null}

      {plan && plan.via.pointIds.length ? <ViaList plan={plan} points={points} order={order} fired={state.fired} t={t} /> : null}

      {sim ? <Note text={tr('nav.simNote')} /> : null}
      <Button
        label={state.dest ? tr('nav.begin') : tr('nav.beginStroll')}
        hint={tr('nav.beginHint')}
        disabled={!canBegin}
        icon={(c) => <PlayIcon color={c} />}
        onPress={() => void navigation.begin()}
      />
      {state.dest ? (
        <Button variant="ghost" label={tr('nav.compare')} onPress={() => router.push({ pathname: '/compare/[slug]', params: { slug: state.dest! } })} />
      ) : null}
    </>
  );
}

function RouteSummary({ plan, mps, t }: { plan: PlannedRoute; mps: number; t: SweetTheme }) {
  const { t: tr, lang } = useT();
  const len = plan.route.lengthM;
  const parts = [
    `${formatDistance(len, lang)} · ${tr('nav.minutes', { n: minutesFor(len, mps) })}`,
    plan.stairSegments === 0 ? tr('nav.noStairs') : tr('nav.stairs', { n: plan.stairSegments }),
  ];
  return (
    <View style={{ gap: 2 }}>
      <Text style={[type.lead, { color: t.text }]}>{parts.join(' · ')}</Text>
      {plan.via.pointIds.length ? (
        <Text style={[type.meta, { color: t.primaryText, fontFamily: type.button.fontFamily }]}>
          {plan.kind === 'stroll'
            ? tr('nav.strollPoints', { n: plan.via.pointIds.length })
            : plan.via.extraM > 0
              ? tr('nav.via', { n: plan.via.pointIds.length, m: plan.via.extraM })
              : tr('nav.viaOnRoute', { n: plan.via.pointIds.length })}
        </Text>
      ) : null}
    </View>
  );
}

/** Rotanın uğradığı noktalar, haritadaki numaralarıyla. */
function ViaList({ plan, points, order, fired, t }: { plan: PlannedRoute; points: NavPoint[]; order: Map<string, number>; fired: string[]; t: SweetTheme }) {
  const s = makeStyles(t);
  const { t: tr, lang } = useT();
  return (
    <View style={{ gap: space.sm }}>
      <Text style={s.label}>{tr('nav.onTheWay')}</Text>
      <View style={[s.viaBox, { backgroundColor: t.soft }, outline(t)]}>
        {plan.via.pointIds.map((id) => {
          const p = points.find((x) => x.id === id);
          if (!p) return null;
          const done = fired.includes(id);
          const name = p.title[lang] ?? p.title.tr;
          return (
            <View key={id} style={s.viaRow} accessible accessibilityLabel={`${order.get(id)}. ${name}${done ? `. ${tr('nav.seen')}` : ''}`}>
              <View style={[s.num, { backgroundColor: done ? t.surface : t.accent.fill }, outline(t)]}>
                <Text style={[type.meta, { color: done ? t.textMuted : t.accent.ink, fontFamily: type.button.fontFamily }]}>{order.get(id)}</Text>
              </View>
              <Text style={[type.body, { color: done ? t.textMuted : t.text, flex: 1 }]} numberOfLines={2}>
                {name}
              </Text>
              {p.audio.tr || p.audio.en ? <Badge label={tr('nav.hasAudio')} /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ---------- Yürüyüş ----------

function ActivePanel({
  state,
  points,
  order,
  sim,
  canHear,
  hearing,
  mps,
  t,
}: {
  state: NavState;
  points: NavPoint[];
  order: Map<string, number>;
  sim: boolean;
  canHear: boolean;
  hearing: string;
  mps: number;
  t: SweetTheme;
}) {
  const s = makeStyles(t);
  const { t: tr, lang } = useT();
  const { settings } = useSettings();
  const plan = state.plan;
  const current = plan && state.stepIndex >= 0 ? plan.steps[state.stepIndex] : undefined;
  const nextStep = plan?.steps[state.stepIndex + 1];
  const total = plan ? plan.geometry.nodeAtM.at(-1)! : 0;
  const left = Math.max(0, Math.round(total - state.distance));
  const toNext = nextStep ? Math.max(0, Math.round(nextStep.atM - state.distance)) : null;
  const progress = total > 0 ? Math.min(100, Math.round((state.distance / total) * 100)) : 0;
  const nextVia = plan?.via.pointIds.find((id) => !state.fired.includes(id));
  const nextViaPoint = nextVia ? points.find((p) => p.id === nextVia) : undefined;

  return (
    <>
      {sim ? <Badge label={tr('nav.simBadge')} tone="primary" /> : null}
      <NavAlertBanner alert={state.alert} onDismiss={navigation.dismissAlert} />

      {/* Şimdiki talimat: yön oku ve metin; ekran okuyucu her yeni talimatı duyurur.
          Yalnız yürüyüş başlarken bir kez girer; adım değişimini CueFlash gösterir. */}
      <FadeInItem index={0}>
        <View style={[s.instruction, { backgroundColor: t.primary.fill }, outline(t)]} accessible accessibilityLiveRegion="polite">
          <TurnIcon turn={current?.turn ?? 'straight'} arrived={false} color={t.primary.ink} size={44} />
          <View style={{ flex: 1, gap: 2 }}>
            {plan ? (
              <>
                <Text style={[type.display, { color: t.primary.ink, fontSize: 22, lineHeight: 28 }]}>{current?.text ?? tr('nav.ready')}</Text>
                {toNext !== null ? <Text style={[type.meta, { color: t.primary.ink }]}>{tr('nav.nextIn', { d: formatDistance(toNext, lang) })}</Text> : null}
              </>
            ) : (
              <>
                <Text style={[type.display, { color: t.primary.ink, fontSize: 22, lineHeight: 28 }]}>{state.fix ? tr('nav.freeWalk') : tr('nav.waiting')}</Text>
                <Text style={[type.meta, { color: t.primary.ink }]}>{tr('nav.freeWalkHint')}</Text>
              </>
            )}
          </View>
        </View>
      </FadeInItem>
      {nextStep && state.stepIndex >= 0 ? (
        <Text style={[type.body, { color: t.textMuted }]} numberOfLines={2}>
          {tr('nav.then')}: {nextStep.text}
        </Text>
      ) : null}

      {plan ? (
        <View style={{ gap: space.xs }}>
          <View style={[s.track, { backgroundColor: t.soft }, outline(t)]} accessibilityRole="progressbar" accessibilityLabel={tr('nav.progress', { done: Math.round(state.distance), total: Math.round(total) })} accessibilityValue={{ min: 0, max: 100, now: progress }}>
            <View style={{ width: `${progress}%`, height: '100%', backgroundColor: t.primary.fill, borderRadius: radius.pill }} />
          </View>
          <Text style={[type.meta, { color: t.textMuted }]}>{tr('nav.remaining', { d: formatDistance(left, lang), min: minutesFor(left, mps) })}</Text>
        </View>
      ) : null}

      {nextViaPoint ? (
        <View style={[s.nextVia, { backgroundColor: t.soft }, outline(t)]} accessible accessibilityLabel={tr('nav.nextVia', { n: order.get(nextViaPoint.id) ?? '', name: nextViaPoint.title[lang] ?? nextViaPoint.title.tr })}>
          <View style={[s.num, { backgroundColor: t.accent.fill }, outline(t)]}>
            <Text style={[type.meta, { color: t.accent.ink, fontFamily: type.button.fontFamily }]}>{order.get(nextViaPoint.id)}</Text>
          </View>
          <Text style={[type.body, { color: t.text, flex: 1 }]} numberOfLines={1}>
            {nextViaPoint.title[lang] ?? nextViaPoint.title.tr}
          </Text>
          <ChevronIcon color={t.textMuted} size={18} />
        </View>
      ) : null}

      {/* Duyamayan kullanıcı ve kalabalıkta ses manzarasının yazılı karşılığı. */}
      {hearing !== 'full' || state.noisy ? <SoundCaptions sounds={state.sounds} muted={!canHear || state.noisy} /> : null}

      <View style={s.controls}>
        <Button style={{ flex: 1 }} variant="outline" label={tr('nav.repeat')} disabled={state.stepIndex < 0} onPress={navigation.repeat} />
        {sim ? (
          <Button
            style={{ flex: 1 }}
            variant="outline"
            label={state.running ? tr('nav.pause') : tr('nav.resume')}
            onPress={state.running ? navigation.pause : navigation.resume}
            icon={(c) => (state.running ? <StopIcon color={c} /> : <PlayIcon color={c} />)}
          />
        ) : null}
      </View>
      <Button variant="danger" label={tr('nav.end')} onPress={navigation.stop} />

      {sim && settings.devSimulation ? (
        <View style={{ gap: space.md }}>
          <Segmented label={tr('nav.speed')} value={state.speed} onChange={navigation.setSpeed} options={[1, 3, 8].map((v) => ({ value: v, label: `${v}×` }))} />
          <ScenarioPanel state={state} onBlock={navigation.blockAhead} onWrongTurn={navigation.wrongTurn} onCrowd={navigation.toggleCrowd} />
        </View>
      ) : null}
    </>
  );
}

// ---------- Varış ----------

function ArrivalPanel({ state, points, canHear, t }: { state: NavState; points: NavPoint[]; canHear: boolean; t: SweetTheme }) {
  const s = makeStyles(t);
  const { t: tr, lang } = useT();
  const slug = state.arrived;
  const { data: work } = useWork(slug ?? '');
  const workPts = useWorkPoints();
  // Admin'de varış bilgisi yoksa eserin yayındaki metninden kısa anlatım (oturumdaki varışla aynı nokta).
  const arrival = state.plan?.arrival ?? workPts.find((p) => p.workSlug === slug);
  const cover = work ? coverOf(work) : undefined;
  const nextSlug = state.tour[0];
  const next = nextSlug ? DESTINATIONS.find((n) => n.workSlug === nextSlug) : undefined;

  if (!slug) {
    // Hedefsiz gezinti bitti: görülen noktalar ve yanından geçilen eserler.
    const seen = state.fired.map((id) => points.find((p) => p.id === id) ?? workPts.find((p) => p.id === id)).filter((p): p is NavPoint => !!p);
    return (
      <>
        <Text style={[type.title, { color: t.text }]} accessibilityRole="header">
          {tr('nav.strollDone')}
        </Text>
        <Text style={[type.lead, { color: t.textMuted }]}>{tr('nav.seenCount', { n: seen.length })}</Text>
        {seen.map((p) => (
          <Text key={p.id} style={[type.body, { color: t.text }]}>
            · {p.title[lang] ?? p.title.tr}
          </Text>
        ))}
        <Button label={tr('nav.finish')} onPress={() => router.back()} />
      </>
    );
  }

  const name = work ? loc(work.name, lang) : (arrival?.title[lang] ?? arrival?.title.tr ?? '');
  const body = arrival?.body ? (arrival.body[lang] ?? arrival.body.tr) : '';
  return (
    <>
      {/* Varış nadir ve önemli an: başlık, fotoğraf ve metin sırayla gelir (düğmeler hemen kullanılabilir). */}
      <FadeInItem index={0}>
        <View style={s.arrivedHead} accessible accessibilityLiveRegion="assertive">
          <TurnIcon turn="straight" arrived color={t.accentText} size={28} />
          <Text style={[type.eyebrow, { color: t.accentText }]}>{tr('nav.arrived')}</Text>
        </View>
      </FadeInItem>
      {cover ? (
        <FadeInItem index={1}>
          <Image source={{ uri: photoUrl(cover) }} style={s.cover} contentFit="cover" accessibilityIgnoresInvertColors accessible={false} />
        </FadeInItem>
      ) : null}
      <FadeInItem index={2} style={{ gap: space.xs }}>
        <Text style={[type.title, { color: t.text }]} accessibilityRole="header">
          {name}
        </Text>
        {work ? <Text style={[type.meta, { color: t.textMuted }]}>{[loc(work.type_name, lang), work.district].filter(Boolean).join(' · ')}</Text> : null}
      </FadeInItem>
      {body ? (
        <FadeInItem index={3}>
          <Text style={[type.body, { color: t.text }]}>{body}</Text>
        </FadeInItem>
      ) : null}
      {arrival && canHear ? (
        <Button
          label={state.playing === arrival.id ? tr('nav.stopAudio') : tr('nav.listen')}
          onPress={() => (state.playing === arrival.id ? navigation.stopAudio() : navigation.playPoint(arrival.id))}
          icon={(c) => (state.playing === arrival.id ? <StopIcon color={c} /> : <PlayIcon color={c} />)}
        />
      ) : null}
      <Button variant="outline" label={tr('nav.workPage')} onPress={() => router.push({ pathname: '/work/[slug]', params: { slug } })} />
      {next ? (
        <Button label={tr('nav.nextStop', { name: next.name?.[lang] ?? next.name?.tr ?? '' })} onPress={() => void navigation.nextStop()} />
      ) : (
        <Button variant="ghost" label={tr('nav.finish')} onPress={() => router.back()} />
      )}
    </>
  );
}

// ---------- Yardımcılar ----------

function RoundButton({ label, onPress, children, t, active }: { label: string; onPress: () => void; children: React.ReactNode; t: SweetTheme; active?: boolean }) {
  return (
    <SoftPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active === undefined ? undefined : { selected: active }}
      style={[
        { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? t.primary.fill : t.surface },
        sweetShadow(t),
        active && t.outlined && { borderWidth: 3 },
      ]}>
      {children}
    </SoftPressable>
  );
}

/** Haritadaki noktalar: uğranacak (numaralı) anlatım noktaları, diğer noktalar, plan aşamasında başlangıçlar ve eserler. */
function buildMapPoints(points: NavPoint[], starts: ReturnType<typeof useStartPoints>, state: NavState, order: Map<string, number>, lang: 'tr' | 'en'): MapPoint[] {
  const out: MapPoint[] = [];
  const fired = new Set(state.fired);
  const name = (p: NavPoint) => p.title[lang] ?? p.title.tr;
  for (const p of points) {
    const opens = !!p.body && (p.roles.includes('story') || p.roles.includes('arrival'));
    if (opens && p.id !== state.plan?.arrival?.id) out.push({ id: p.id, location: p.location, kind: 'story', order: order.get(p.id), label: order.has(p.id) ? name(p) : undefined, done: fired.has(p.id) });
    else if (p.roles.includes('landmark') && !p.roles.includes('start')) out.push({ id: p.id, location: p.location, kind: 'landmark', label: name(p) });
  }
  if (state.phase === 'plan') {
    // Seçili başlangıç adıyla, diğerleri yalnızca nokta: harita kalabalıklaşmasın; dokununca seçilir.
    for (const p of starts) {
      const selected = state.start.kind === 'point' && state.start.id === p.id;
      out.push({ id: p.id, location: p.location, kind: 'start', label: selected ? (p.name[lang] ?? p.name.tr) : undefined, selected });
    }
    for (const n of DESTINATIONS) {
      if (n.workSlug === state.dest) continue;
      out.push({ id: `work:${n.workSlug}`, location: n.location, kind: 'work' });
    }
  }
  return out;
}

const makeStyles = (t: SweetTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background },
    mapBar: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', justifyContent: 'space-between' },
    pickBanner: { position: 'absolute', alignSelf: 'center', backgroundColor: t.primary.fill, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, borderCurve: 'continuous' },
    panel: { flex: 1, marginTop: -radius.xl, backgroundColor: t.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderCurve: 'continuous' },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: space.sm },
    panelBody: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.lg },
    label: { ...type.eyebrow, color: t.textMuted },
    chips: { gap: space.sm, paddingHorizontal: space.xl },
    chipScroll: { marginHorizontal: -space.xl },
    viaBox: { borderRadius: radius.lg, borderCurve: 'continuous', padding: space.md, gap: space.sm },
    viaRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 32 },
    num: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    instruction: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg, borderRadius: radius.xl, borderCurve: 'continuous' },
    track: { height: 8, borderRadius: radius.pill, borderCurve: 'continuous', overflow: 'hidden' },
    nextVia: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, borderCurve: 'continuous', minHeight: 48 },
    controls: { flexDirection: 'row', gap: space.sm },
    arrivedHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: t.soft },
  });
