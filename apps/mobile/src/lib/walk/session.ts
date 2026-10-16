import { bearingDeg, dueStep, dueStoryPoints, initialTrack, stereoPan, storyVoice, trackFix, type GuidanceStep, type LngLat, type LocationFix, type TrackState, type UserProfile } from '@sezi/shared';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

import { inPilotArea, planRoute, startLocation, walkingSpeed, type PlannedRoute } from '../nav';
import { hapticAlert, hapticForTurn, playLandmarkCue } from '../sim/cues';
import type { AlertKind, NavAlert } from '../sim/session';
import { say, silence } from '../sim/speech';
import { createWalker, stepWalker, type Walker } from '../sim/walker';
import { storyAudioUri, storyPoints } from '../story';
import { playStoryFile, stopStoryFile } from './story-audio';

/**
 * Canlı yürüyüş: konum (GPS ya da geliştirici simülasyonu) izlenir; anlatım noktasının yarıçapına
 * girilince bilgi açılır, ayara göre ses çalar. Hedef seçildiyse (yalnız pilot alan) rota anlatım
 * noktalarına uğrayacak şekilde çizilir ve rehberlik `sim/session.ts` ile aynı takip hattından geçer.
 */
export interface WalkState {
  active: boolean;
  source: 'gps' | 'sim';
  /** off: konum servisleri kapalı. */
  permission: 'unknown' | 'granted' | 'denied' | 'off';
  fix: LocationFix | null;
  destSlug: string | null;
  plan: PlannedRoute | null;
  routeNote: 'outside_pilot' | 'no_route' | null;
  track: TrackState;
  distance: number;
  stepIndex: number;
  finished: boolean;
  /** Bu yürüyüşte açılmış nokta kimlikleri. */
  fired: string[];
  /** Ekrandaki nokta. */
  popup: string | null;
  /** Sırada bekleyen noktalar. */
  queue: string[];
  /** Sesi çalan nokta. */
  playing: string | null;
  alert: NavAlert | null;
  /** Her yeni ipucunda artar: görsel uyarı (CueFlash) bunu izler. */
  cueCount: number;
  /** Yalnız simülasyon: 1 | 3 | 8. */
  speed: number;
}

export interface WalkConfig {
  profile: UserProfile;
  speechRate: number;
  playback: 'auto' | 'tap';
  sim: boolean;
  simStart: string;
  onArrive: (slug: string) => void;
}

const TICK_MS = 200;

const TEXT = {
  tr: {
    intro: (name: string, m: number) => `Hedef: ${name}. Yaklaşık ${m} metre.`,
    offroute: (m: number) => `Rotadan çıktınız. Bulunduğunuz yerden yeni rota: ${m} metre.`,
    noRoute: 'Bulunduğunuz yerden rota bulunamadı.',
  },
  en: {
    intro: (name: string, m: number) => `Destination: ${name}. About ${m} metres.`,
    offroute: (m: number) => `You have left the route. New route from here: ${m} metres.`,
    noRoute: 'No route was found from here.',
  },
};

const initialState = (speed = 1): WalkState => ({
  active: false,
  source: 'gps',
  permission: 'unknown',
  fix: null,
  destSlug: null,
  plan: null,
  routeNote: null,
  track: initialTrack,
  distance: 0,
  stepIndex: -1,
  finished: false,
  fired: [],
  popup: null,
  queue: [],
  playing: null,
  alert: null,
  cueCount: 0,
  speed,
});

let state = initialState();
let cfg: WalkConfig | null = null;
let walker: Walker | null = null;
let walkerDone = false;
let timer: ReturnType<typeof setInterval> | null = null;
let watch: Location.LocationSubscription | null = null;
/** Konum kaynağı her değiştiğinde artar: geç dönen izin/abonelik eskisini canlandırmasın. */
let sourceToken = 0;
let alertId = 0;
/** Çalan anlatımın türü: dosya çalarken talimatlar bekletilir, TTS'te konuşma kuyruğuna girer. */
let playingKind: 'file' | 'tts' | null = null;
/** Dosya sesi çalarken gelen son talimat; ses bitince okunur. */
let pendingSpeech: string | null = null;
const listeners = new Set<() => void>();

function emit(patch: Partial<WalkState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const totalOf = (plan: PlannedRoute) => plan.geometry.nodeAtM.at(-1)!;
const canHear = (c: WalkConfig) => c.profile.hearing !== 'deaf' && c.profile.senses.audio;
const findPoint = (id: string) => storyPoints().find((p) => p.id === id);

// ---------- Ses ve uyarılar ----------

function flushPending() {
  const text = pendingSpeech;
  pendingSpeech = null;
  if (text && cfg && canHear(cfg)) say(text, { lang: cfg.profile.lang, rate: cfg.speechRate });
}

/** Talimatı okur; anlatım kaydı çalıyorsa kayıt bitince okunur (son gelen geçerli). */
function speakGuidance(text: string, interrupt = false) {
  if (!cfg || !canHear(cfg)) return;
  if (playingKind === 'file') pendingSpeech = text;
  else say(text, { lang: cfg.profile.lang, rate: cfg.speechRate, interrupt });
}

function announce(step: GuidanceStep, arrived: boolean, fix: LocationFix) {
  if (!cfg) return;
  const { profile } = cfg;
  // Duymayan kullanıcı: bilgi yalnızca sesle verilmez; görsel uyarı (cueCount) ve titreşim kullanılır.
  if (profile.senses.haptic || !canHear(cfg)) {
    void hapticForTurn(step.turn, arrived).then(() => {
      if (step.hazard) return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    });
  }
  if (!canHear(cfg)) return;
  if (step.landmark) playLandmarkCue(stereoPan(fix.heading ?? 0, bearingDeg(fix.position, step.landmark.location)));
  speakGuidance(step.text);
}

function raise(kind: AlertKind, text: string) {
  void hapticAlert();
  speakGuidance(text, true);
  emit({ alert: { id: ++alertId, kind, text }, cueCount: state.cueCount + 1 });
}

function intro(plan: PlannedRoute) {
  if (!cfg) return;
  const lang = cfg.profile.lang;
  speakGuidance(TEXT[lang].intro(plan.end.name?.[lang] ?? plan.end.name?.tr ?? '', Math.round(totalOf(plan))));
}

// ---------- Anlatım noktaları ----------

function present(id: string) {
  const point = findPoint(id);
  if (!cfg || !point) return;
  emit({ popup: id, cueCount: state.cueCount + 1 });
  if (cfg.profile.senses.haptic || !canHear(cfg)) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  AccessibilityInfo.announceForAccessibility(point.title[cfg.profile.lang] ?? point.title.tr);
  if (cfg.playback === 'auto' && canHear(cfg)) playStory(id);
}

function playStory(id: string) {
  const point = findPoint(id);
  if (!cfg || !point || !canHear(cfg)) return;
  const c = cfg;
  const lang = c.profile.lang;
  stopStoryFile();
  const voice = storyVoice(point, lang);
  emit({ playing: id });
  // Metin okuması bitince "Durdur" düğmesi "Dinle"ye döner.
  const ttsDone = () => {
    if (state.playing !== id || playingKind !== 'tts') return;
    playingKind = null;
    emit({ playing: null });
  };
  if (voice.kind === 'tts') {
    playingKind = 'tts';
    say(voice.text, { lang: voice.lang, rate: c.speechRate, interrupt: true, onDone: ttsDone });
    return;
  }
  playingKind = 'file';
  silence();
  playStoryFile(storyAudioUri(voice.path), {
    onEnd: () => {
      playingKind = null;
      emit({ playing: null });
      flushPending();
    },
    // Kayıt çalınamadı (internet yok, dosya yok): metin cihazda okunur.
    onError: () => {
      playingKind = 'tts';
      const en = lang === 'en' && point.body.en;
      say(en ? point.body.en! : point.body.tr, { lang: en ? 'en' : 'tr', rate: c.speechRate, interrupt: true, onDone: ttsDone });
      flushPending();
    },
  });
}

function stopStory() {
  stopStoryFile();
  if (playingKind === 'tts') silence();
  playingKind = null;
  if (state.playing) emit({ playing: null });
  flushPending();
}

// ---------- Rota ----------

/** Hedefe rota; anlatım noktaları (henüz açılmamış olanlar) yol üstündeyse uğranır. Bulunamazsa mevcut rota korunur. */
function replan(from: LngLat, leadIn: boolean): PlannedRoute | null {
  if (!cfg || !state.destSlug) {
    emit({ plan: null, routeNote: null });
    return null;
  }
  if (!inPilotArea(from)) {
    emit({ plan: null, routeNote: 'outside_pilot' });
    return null;
  }
  const fired = new Set(state.fired);
  const via = storyPoints()
    .filter((p) => !fired.has(p.id))
    .map((p) => ({ id: p.id, location: p.location }));
  const plan = planRoute(state.destSlug, cfg.profile, from, { leadIn, via });
  if (!plan) {
    emit({ routeNote: 'no_route' });
    return null;
  }
  emit({ plan, routeNote: null, track: initialTrack, distance: 0, stepIndex: -1, finished: false });
  return plan;
}

function onFix(fix: LocationFix) {
  if (!cfg || !state.active) return;

  // 1. Anlatım noktaları: yarıçapa girilen her nokta bu yürüyüşte bir kez açılır.
  const due = dueStoryPoints(storyPoints(), fix, new Set(state.fired));
  emit({ fix, fired: [...state.fired, ...due.map((p) => p.id)] });
  for (const p of due) {
    if (state.popup) emit({ queue: [...state.queue, p.id] });
    else present(p.id);
  }

  // 2. Rota: GPS'te ilk konum gelince çizilir; pilot alan dışındaysa her ölçümde yeniden denenir.
  if (state.destSlug && !state.plan && state.source === 'gps' && state.routeNote !== 'no_route') {
    const plan = replan(fix.position, true);
    if (plan) intro(plan);
    return;
  }
  const plan = state.plan;
  if (!plan || state.finished) return;
  const track = trackFix(state.track, plan.geometry.line, fix);
  if (track.offRoute && state.source === 'gps') {
    const next = replan(fix.position, true);
    const lang = cfg.profile.lang;
    if (next) raise('offroute', TEXT[lang].offroute(Math.round(totalOf(next))));
    else {
      // Rota korunur; sapma sayacı sıfırlanır, birkaç ölçüm sonra yeniden denenir.
      emit({ track: { ...track, offRoute: false, awayCount: 0 } });
      if (state.alert?.kind !== 'no_route') raise('no_route', TEXT[lang].noRoute);
    }
    return;
  }

  const total = totalOf(plan);
  // Sanal yürüyüşçü çizginin sonuna ulaştıysa GPS benzeri sapma varışı geciktirmesin.
  const distance = state.source === 'sim' && walkerDone ? total : track.alongM;
  const mps = walkingSpeed(cfg.profile) * (state.source === 'sim' ? state.speed : 1);
  const index = dueStep(plan.steps.map((s) => s.atM), state.stepIndex, distance, total, mps);
  const last = plan.steps.length - 1;
  let cueCount = state.cueCount;
  if (index > state.stepIndex) {
    announce(plan.steps[index]!, index === last, fix);
    cueCount++;
  }
  const finished = index === last;
  emit({ track: { ...track, alongM: distance }, distance, stepIndex: index, cueCount, finished });
  if (finished) cfg.onArrive(state.destSlug!);
}

// ---------- Konum kaynağı ----------

function stopSources() {
  sourceToken++;
  clearInterval(timer ?? undefined);
  timer = null;
  watch?.remove();
  watch = null;
  walker = null;
}

function simTick() {
  if (!walker || !cfg) return;
  const step = stepWalker(walker, (walkingSpeed(cfg.profile) * state.speed * TICK_MS) / 1000, Date.now());
  walker = step.walker;
  walkerDone = step.done;
  if (step.done && timer) {
    clearInterval(timer);
    timer = null;
  }
  onFix(step.fix);
}

async function startGps(): Promise<boolean> {
  const token = sourceToken;
  try {
    if (!(await Location.hasServicesEnabledAsync())) {
      if (token === sourceToken) emit({ permission: 'off', active: false });
      return false;
    }
    const perm = await Location.requestForegroundPermissionsAsync();
    if (token !== sourceToken) return false;
    if (perm.status !== 'granted') {
      emit({ permission: 'denied', active: false });
      return false;
    }
    emit({ permission: 'granted' });
    const sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 1 }, (loc) =>
      onFix({
        position: [loc.coords.longitude, loc.coords.latitude],
        heading: loc.coords.heading != null && loc.coords.heading >= 0 ? loc.coords.heading : undefined,
        accuracyM: loc.coords.accuracy ?? 30,
        t: loc.timestamp,
      }),
    );
    if (token !== sourceToken) {
      sub.remove();
      return false;
    }
    watch = sub;
    return true;
  } catch {
    if (token === sourceToken) emit({ permission: 'denied', active: false });
    return false;
  }
}

/** Simülasyon yalnız geliştirici modunda ve rota varken; aksi hâlde gerçek GPS. */
async function runSource(): Promise<boolean> {
  stopSources();
  walkerDone = false;
  if (cfg?.sim && state.plan) {
    walker = createWalker(state.plan.geometry.line);
    emit({ source: 'sim' });
    timer = setInterval(simTick, TICK_MS);
    return true;
  }
  emit({ source: 'gps' });
  return startGps();
}

export const walkSession = {
  async start(c: WalkConfig, destSlug: string | null) {
    walkSession.stop();
    cfg = c;
    emit({ ...initialState(state.speed), active: true, destSlug });
    if (destSlug && c.sim) replan(startLocation(c.simStart), false);
    const ok = await runSource();
    if (ok && state.plan) intro(state.plan);
  },
  stop() {
    stopSources();
    pendingSpeech = null;
    stopStory();
    silence();
    emit(initialState(state.speed));
  },
  configure(c: WalkConfig) {
    cfg = c;
  },
  async setDestination(slug: string | null) {
    emit({ destSlug: slug, plan: null, routeNote: null, track: initialTrack, distance: 0, stepIndex: -1, finished: false });
    if (!state.active || !cfg) return;
    if (slug && cfg.sim) replan(startLocation(cfg.simStart), false);
    else if (slug && state.fix && state.source === 'gps') replan(state.fix.position, true);
    // Kaynak değişiyorsa (sim ↔ GPS) ya da sanal yürüyüş yeni rotada baştan başlayacaksa kaynak yeniden açılır.
    const wantSim = cfg.sim && !!state.plan;
    if (wantSim || state.source === 'sim') {
      if (!(await runSource())) return;
    }
    if (state.plan) intro(state.plan);
  },
  playStory,
  stopStory,
  closePopup() {
    stopStory();
    const [next, ...rest] = state.queue;
    emit({ popup: null, queue: rest });
    if (next) present(next);
  },
  dismissAlert() {
    emit({ alert: null });
  },
  setSpeed(n: number) {
    emit({ speed: n });
  },
};

export function useWalkSession(): WalkState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
