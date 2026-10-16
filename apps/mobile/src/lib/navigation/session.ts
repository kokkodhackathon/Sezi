import {
  bearingDeg,
  distanceM,
  dueStep,
  duePoints,
  initialTrack,
  offRouteThreshold,
  pointAlong,
  pointVoice,
  projectOnLine,
  soundKindFor,
  soundscapeMix,
  stereoPan,
  trackFix,
  type GuidanceStep,
  type LngLat,
  type LocationFix,
  type NavPoint,
  type SoundSource,
  type SoundVoice,
  type TrackState,
  type UserProfile,
} from '@sezi/shared';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

import { blockableAhead, detourFrom, inPilotArea, landmarkNodes, planRoute, planStroll, startLocation, walkingSpeed, type PlannedRoute } from '../nav';
import { navPoints, pointAudioUri } from '../points';
import { hapticAlert, hapticForTurn, playLandmarkCue } from '../sim/cues';
import { stopSoundscape, updateSoundscape } from '../sim/soundscape-engine';
import { say, silence } from '../sim/speech';
import { createWalker, stepWalker, walkerOnLine, type Walker } from '../sim/walker';
import { playPointFile, stopPointFile } from './point-audio';

/**
 * Tek navigasyon oturumu: rota planı, canlı rehberlik ve yürüyüş aynı yerde.
 *
 * - Başlangıç: bulunduğum yer (GPS), admin panelindeki bir başlangıç noktası ya da haritada seçilen yer.
 * - Hedef: bir eser (rota yakındaki anlatım noktalarına uğrar), tur (eserler sırayla) ya da hedefsiz gezinti.
 * - Konum kaynağı: gerçek GPS ya da (geliştirici simülasyon modunda) sanal yürüyüşçü. İkisi de aynı takip
 *   hattından geçer (`trackFix`, `dueStep`, `duePoints`); yalnızca konumun nereden geldiği değişir.
 * - Anlatım noktasına girince bilgi açılır, ayara göre ses çalar; esere varınca varış kartı ve sesi.
 */

export type StartChoice = { kind: 'here' } | { kind: 'point'; id: string } | { kind: 'pick'; location: LngLat };

export type AlertKind = 'offroute' | 'blocked' | 'crowd_on' | 'crowd_off' | 'no_route';
export interface NavAlert {
  id: number;
  kind: AlertKind;
  text: string;
}

export interface NavState {
  phase: 'plan' | 'active' | 'arrived';
  source: 'gps' | 'sim';
  /** off: konum servisleri kapalı. */
  permission: 'unknown' | 'granted' | 'denied' | 'off';
  start: StartChoice;
  /** Şu anki hedef eser (hedefsiz gezintide null). */
  dest: string | null;
  /** Turda sıradaki eserler. */
  tour: string[];
  plan: PlannedRoute | null;
  /** Rota neden yok: konum bekleniyor, pilot alan dışında, yol yok, yakında anlatım noktası yok. */
  note: 'need_location' | 'outside_pilot' | 'no_route' | 'no_points' | null;
  /** Son GPS konumu. */
  here: LngLat | null;
  /** Sanal yürüyüş ilerliyor mu (GPS'te her zaman true). */
  running: boolean;
  /** Haritadaki konum: rotaya eşlenmiş ya da (rotadan çıkıldıysa) ölçülen. */
  position: LngLat | null;
  heading: number;
  fix: LocationFix | null;
  track: TrackState;
  distance: number;
  stepIndex: number;
  /** Her yeni ipucunda artar: görsel uyarı (CueFlash) bunu izler. */
  cueCount: number;
  /** Simülasyon hızı (1 | 3 | 8). */
  speed: number;
  /** Kalabalık/gürültü (simülasyon senaryosu): sesli ipuçları kapanır, titreşim ve ekran ışığı devralır. */
  noisy: boolean;
  blocked: string[];
  reroutes: number;
  alert: NavAlert | null;
  /** Sanal yürüyüşçü rotadan ayrılan bir sokakta (yanlış dönüş senaryosu). */
  detouring: boolean;
  sounds: SoundVoice[];
  /** Bu yürüyüşte açılmış noktalar. */
  fired: string[];
  popup: string | null;
  queue: string[];
  playing: string | null;
  /** Varılan eser (varış ekranı). */
  arrived: string | null;
}

export interface NavConfig {
  profile: UserProfile;
  speechRate: number;
  playback: 'auto' | 'tap';
  /** Geliştirici simülasyon modu: başlangıç GPS değilse yürüyüş sanaldır. */
  sim: boolean;
  onArrive: (slug: string) => void;
}

const TICK_MS = 200;
/** Plan aşamasında GPS konumu bu kadar değişince önizleme rotası yenilenir (m). */
const REPLAN_MOVE_M = 25;

const TEXT = {
  tr: {
    intro: (name: string, m: number) => `Hedef: ${name}. Yaklaşık ${m} metre.`,
    strollIntro: (n: number, m: number) => `Gezinti: ${n} anlatım noktası, yaklaşık ${m} metre.`,
    offroute: (m: number) => `Rotadan çıktınız. Bulunduğunuz yerden yeni rota: ${m} metre.`,
    blocked: (m: number) => `İleride yol kapalı. Sizi başka yoldan götürüyorum: ${m} metre.`,
    noRoute: 'Bulunduğunuz yerden rota bulunamadı. Lütfen bekleyin ya da yardım isteyin.',
    crowdOn: 'Ortam gürültülü. Bundan sonra titreşim ve ekran ışığıyla yönlendiriyorum.',
    crowdOff: 'Ortam sakinleşti. Sesli yönlendirme yeniden açık.',
  },
  en: {
    intro: (name: string, m: number) => `Destination: ${name}. About ${m} metres.`,
    strollIntro: (n: number, m: number) => `Stroll: ${n} story points, about ${m} metres.`,
    offroute: (m: number) => `You have left the route. New route from here: ${m} metres.`,
    blocked: (m: number) => `The way ahead is closed. Taking you another way: ${m} metres.`,
    noRoute: 'No route was found from here. Please wait or ask for help.',
    crowdOn: 'It is noisy here. From now on I will guide you with vibration and screen light.',
    crowdOff: 'It is quieter now. Spoken guidance is back on.',
  },
};

const tracking = () => ({
  running: false,
  position: null,
  heading: 0,
  fix: null,
  track: initialTrack,
  distance: 0,
  stepIndex: -1,
  noisy: false,
  blocked: [] as string[],
  reroutes: 0,
  alert: null,
  detouring: false,
  sounds: [] as SoundVoice[],
  fired: [] as string[],
  popup: null,
  queue: [] as string[],
  playing: null,
  arrived: null,
});

let state: NavState = {
  phase: 'plan',
  source: 'gps',
  permission: 'unknown',
  start: { kind: 'here' },
  dest: null,
  tour: [],
  plan: null,
  note: null,
  here: null,
  cueCount: 0,
  speed: 1,
  ...tracking(),
};

let cfg: NavConfig | null = null;
let walker: Walker | null = null;
let walkerDone = false;
/** Sanal yürüyüşçünün gürültüsüz konumu: yeniden rota buradan başlar. */
let truth: LngLat | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let watch: Location.LocationSubscription | null = null;
/** Konum aboneliği her değiştiğinde artar: geç dönen izin/abonelik eskisini canlandırmasın. */
let watchToken = 0;
/** Önizleme rotasının hesaplandığı konum ("bulunduğum yer" başlangıcında). */
let plannedFrom: LngLat | null = null;
let alertId = 0;
/** Popup açılınca sanal yürüyüş durur; kapanınca bu bayrakla devam eder. */
let resumeAfterPopup = false;
/** Çalan anlatımın türü: dosya çalarken talimatlar bekletilir, TTS'te konuşma kuyruğuna girer. */
let playingKind: 'file' | 'tts' | null = null;
/** Dosya sesi çalarken gelen son talimat; ses bitince okunur. */
let pendingSpeech: string | null = null;
let soundSources: SoundSource[] = [];
const listeners = new Set<() => void>();

function emit(patch: Partial<NavState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const totalOf = (plan: PlannedRoute) => plan.geometry.nodeAtM.at(-1)!;
const findPoint = (id: string): NavPoint | undefined => navPoints().find((p) => p.id === id);
const canHear = () => !!cfg && cfg.profile.hearing !== 'deaf' && cfg.profile.senses.audio && !state.noisy;
const wantsSim = (c: NavConfig, start: StartChoice) => c.sim && start.kind !== 'here';

// ---------- Ses ve uyarılar ----------

function flushPending() {
  const text = pendingSpeech;
  pendingSpeech = null;
  if (text && cfg && canHear()) say(text, { lang: cfg.profile.lang, rate: cfg.speechRate });
}

/** Talimatı okur; anlatım kaydı çalıyorsa kayıt bitince okunur (son gelen geçerli). */
function speak(text: string, interrupt = false) {
  if (!cfg || !canHear()) return;
  if (playingKind === 'file') pendingSpeech = text;
  else say(text, { lang: cfg.profile.lang, rate: cfg.speechRate, interrupt });
}

function announce(step: GuidanceStep, arrived: boolean, at: LngLat, heading: number) {
  if (!cfg) return;
  // Duymayan kullanıcı ya da kalabalık: bilgi yalnızca sesle verilmez; görsel uyarı (cueCount) ve titreşim.
  if (cfg.profile.senses.haptic || !canHear()) {
    void hapticForTurn(step.turn, arrived).then(() => {
      if (step.hazard) return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    });
  }
  if (!canHear()) return;
  if (step.landmark) playLandmarkCue(stereoPan(heading, bearingDeg(at, step.landmark.location)));
  speak(step.text);
}

function raise(kind: AlertKind, text: string) {
  void hapticAlert();
  speak(text, true);
  emit({ alert: { id: ++alertId, kind, text }, cueCount: state.cueCount + 1 });
}

function intro(plan: PlannedRoute) {
  if (!cfg) return;
  const lang = cfg.profile.lang;
  const m = Math.round(totalOf(plan));
  speak(plan.kind === 'stroll' ? TEXT[lang].strollIntro(plan.via.pointIds.length, m) : TEXT[lang].intro(plan.end.name?.[lang] ?? plan.end.name?.tr ?? '', m));
}

// ---------- Noktalar ----------

function present(id: string) {
  const point = findPoint(id);
  if (!cfg || !point) return;
  // Sanal yürüyüş nokta okunurken bekler (sahada kullanıcı da durup okur).
  if (timer) {
    stopTimer();
    resumeAfterPopup = true;
    emit({ running: false });
  }
  emit({ popup: id, cueCount: state.cueCount + 1 });
  if (cfg.profile.senses.haptic || !canHear()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  AccessibilityInfo.announceForAccessibility(point.title[cfg.profile.lang] ?? point.title.tr);
  if (cfg.playback === 'auto') playPoint(id);
}

function playPoint(id: string) {
  const point = findPoint(id);
  if (!cfg || !point || !canHear()) return;
  const c = cfg;
  const voice = pointVoice(point, c.profile.lang);
  if (!voice) return;
  stopPointFile();
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
  playPointFile(pointAudioUri(voice.path), {
    onEnd: () => {
      playingKind = null;
      emit({ playing: null });
      flushPending();
    },
    // Kayıt çalınamadı (internet yok, dosya yok): metin cihazda okunur.
    onError: () => {
      playingKind = 'tts';
      const en = c.profile.lang === 'en' && point.body?.en;
      const text = en ? point.body!.en! : point.body?.tr;
      if (text) say(text, { lang: en ? 'en' : 'tr', rate: c.speechRate, interrupt: true, onDone: ttsDone });
      else ttsDone();
      flushPending();
    },
  });
}

function stopAudio() {
  stopPointFile();
  if (playingKind === 'tts') silence();
  playingKind = null;
  if (state.playing) emit({ playing: null });
  flushPending();
}

// ---------- Plan ----------

function origin(start: StartChoice): LngLat | null {
  if (start.kind === 'here') return state.here;
  if (start.kind === 'point') return startLocation(start.id);
  return start.location;
}

/** Bu başlangıç ve hedef için rota; bulunamazsa nedeni. */
function compute(from: LngLat, dest: string | null, leadIn: boolean, extra: { blocked?: string[]; skip?: string[] } = {}) {
  if (!cfg) return { plan: null, note: null };
  if (!inPilotArea(from)) return { plan: null, note: 'outside_pilot' as const };
  const opts = { leadIn, blocked: new Set(extra.blocked ?? []), skip: new Set(extra.skip ?? []) };
  const plan = dest ? planRoute(dest, cfg.profile, from, opts) : planStroll(cfg.profile, from, opts);
  return plan ? { plan, note: null } : { plan: null, note: dest ? ('no_route' as const) : ('no_points' as const) };
}

function replanPreview() {
  if (!cfg || state.phase !== 'plan') return;
  const from = origin(state.start);
  plannedFrom = from;
  if (!from) {
    emit({ plan: null, note: 'need_location' });
    return;
  }
  emit(compute(from, state.dest, state.start.kind !== 'point'));
}

// ---------- Yürüyüş ----------

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

function stopWatch() {
  watchToken++;
  watch?.remove();
  watch = null;
}

async function startWatch(): Promise<boolean> {
  if (watch) return true;
  const token = ++watchToken;
  try {
    if (!(await Location.hasServicesEnabledAsync())) {
      if (token === watchToken) emit({ permission: 'off' });
      return false;
    }
    const perm = await Location.requestForegroundPermissionsAsync();
    if (token !== watchToken) return false;
    if (perm.status !== 'granted') {
      emit({ permission: 'denied' });
      return false;
    }
    emit({ permission: 'granted' });
    const sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 1 }, (loc) =>
      onGps({
        position: [loc.coords.longitude, loc.coords.latitude],
        heading: loc.coords.heading != null && loc.coords.heading >= 0 ? loc.coords.heading : undefined,
        accuracyM: loc.coords.accuracy ?? 30,
        t: loc.timestamp,
      }),
    );
    if (token !== watchToken) {
      sub.remove();
      return false;
    }
    watch = sub;
    return true;
  } catch {
    if (token === watchToken) emit({ permission: 'denied' });
    return false;
  }
}

function onGps(fix: LocationFix) {
  if (state.phase === 'plan') {
    const moved = !plannedFrom || distanceM(plannedFrom, fix.position) > REPLAN_MOVE_M;
    emit({ here: fix.position, fix });
    if (state.start.kind === 'here' && moved) replanPreview();
    return;
  }
  if (state.phase !== 'active' || state.source !== 'gps') return;
  emit({ here: fix.position });
  const plan = state.plan;
  if (!plan) {
    // Yürüyüş konum beklerken başladı ya da pilot alan dışındaydı: konum değiştikçe rota yeniden denenir.
    if (!plannedFrom || distanceM(plannedFrom, fix.position) > REPLAN_MOVE_M) {
      plannedFrom = fix.position;
      const next = compute(fix.position, state.dest, true, { blocked: state.blocked, skip: state.fired });
      emit(next);
      if (next.plan) intro(next.plan);
    }
  } else if (state.distance === 0 && state.stepIndex < 0 && projectOnLine(plan.geometry.line, fix.position).crossM > offRouteThreshold(fix.accuracyM)) {
    // İlk ölçüm rotanın başından uzak (başlangıç olarak başka bir yer seçilmişti): rota buradan yeniden çizilir.
    const next = compute(fix.position, state.dest, true, { blocked: state.blocked, skip: state.fired });
    if (next.plan) emit({ plan: next.plan, track: initialTrack });
  }
  onFix(fix, fix.position, false);
}

function simTick() {
  if (!walker || !cfg) return;
  const step = stepWalker(walker, (walkingSpeed(cfg.profile) * state.speed * TICK_MS) / 1000, Date.now());
  walker = step.walker;
  walkerDone = step.done;
  truth = step.truth;
  if (step.done && !state.detouring) stopTimer();
  onFix(step.fix, step.truth, step.done);
}

/** Konum ölçümünü işler (GPS ya da sanal). `truthAt`: yeniden rotanın başlayacağı yer. */
function onFix(fix: LocationFix, truthAt: LngLat, walkerAtEnd: boolean) {
  if (!cfg || state.phase !== 'active') return;
  const heading = fix.heading ?? state.heading;

  // 1. Noktalar: yarıçapa girilen her nokta bu yürüyüşte bir kez açılır.
  const due = duePoints(navPoints(), fix, new Set(state.fired)).filter((p) => p.id !== state.plan?.arrival?.id);
  if (due.length) emit({ fired: [...state.fired, ...due.map((p) => p.id)] });
  for (const p of due) {
    if (state.popup) emit({ queue: [...state.queue, p.id] });
    else present(p.id);
  }

  // 2. Ses manzarası: yakındaki yer işaretleri, yön ve uzaklığa göre.
  const sounds = soundscapeMix(truthAt, heading, soundSources);
  if (canHear()) updateSoundscape(sounds);
  else stopSoundscape();

  const plan = state.plan;
  if (!plan) {
    emit({ fix, position: fix.position, heading, sounds });
    return;
  }

  // 3. Rota takibi.
  const track = trackFix(state.track, plan.geometry.line, fix);
  if (track.offRoute || (state.detouring && walkerAtEnd)) {
    reroute('offroute', state.blocked, truthAt);
    return;
  }
  const total = totalOf(plan);
  // Sanal yürüyüşçü çizginin sonuna ulaştıysa GPS benzeri sapma varışı geciktirmesin.
  const distance = state.source === 'sim' && walkerDone && !state.detouring ? total : track.alongM;
  const position = state.source === 'sim' && track.crossM <= 10 ? pointAlong(plan.geometry.line, distance) : fix.position;
  const mps = walkingSpeed(cfg.profile) * (state.source === 'sim' ? state.speed : 1);
  const index = dueStep(plan.steps.map((s) => s.atM), state.stepIndex, distance, total, mps);
  const last = plan.steps.length - 1;
  let cueCount = state.cueCount;
  if (index > state.stepIndex) {
    announce(plan.steps[index]!, index === last, position, heading);
    cueCount++;
  }
  emit({ fix, position, heading, sounds, track: { ...track, alongM: distance }, distance, stepIndex: index, cueCount });
  if (index === last) arrive();
}

/** Bulunulan yerden yeniden rota. Bulunamazsa mevcut rota korunur. */
function reroute(kind: 'offroute' | 'blocked', blocked: string[], from: LngLat) {
  if (!cfg) return;
  const lang = cfg.profile.lang;
  const next = compute(from, state.dest, true, { blocked, skip: state.fired });
  if (!next.plan) {
    // Sapma sayacı sıfırlanır; birkaç ölçüm sonra yeniden denenir.
    emit({ blocked, track: { ...state.track, offRoute: false, awayCount: 0 } });
    if (state.alert?.kind !== 'no_route') raise('no_route', TEXT[lang].noRoute);
    return;
  }
  if (walker) walker = walkerOnLine(walker, next.plan.geometry.line);
  walkerDone = false;
  emit({ plan: next.plan, blocked, distance: 0, track: initialTrack, stepIndex: -1, reroutes: state.reroutes + 1, detouring: false });
  const m = Math.round(totalOf(next.plan));
  raise(kind, kind === 'offroute' ? TEXT[lang].offroute(m) : TEXT[lang].blocked(m));
  if (state.source === 'sim' && !timer && !state.popup) startTimer();
}

function startTimer() {
  stopTimer();
  timer = setInterval(simTick, TICK_MS);
  emit({ running: true });
}

function arrive() {
  if (!cfg) return;
  stopTimer();
  stopWatch();
  stopSoundscape();
  const plan = state.plan;
  const slug = state.dest;
  emit({ phase: 'arrived', running: false, arrived: slug });
  if (slug) cfg.onArrive(slug);
  // Varış bilgisi: kart ekranda; ses ayara göre.
  const arrival = plan?.arrival;
  if (arrival) {
    emit({ fired: [...state.fired, arrival.id], cueCount: state.cueCount + 1 });
    if (cfg.playback === 'auto') playPoint(arrival.id);
  }
}

async function begin() {
  if (!cfg) return;
  const sim = wantsSim(cfg, state.start);
  if (sim && !state.plan) return;
  stopTimer();
  silence();
  soundSources = landmarkNodes().map((n) => ({
    id: n.id,
    name: n.name?.[cfg!.profile.lang] ?? n.name?.tr ?? '',
    kind: n.sound ?? soundKindFor(n.workType),
    location: n.location,
  }));
  walkerDone = false;
  const plan = state.plan;
  emit({ phase: 'active', source: sim ? 'sim' : 'gps', ...tracking(), position: plan?.geometry.line[0] ?? state.here, cueCount: state.cueCount });
  if (sim) {
    stopWatch();
    walker = createWalker(plan!.geometry.line);
    truth = plan!.geometry.line[0]!;
    intro(plan!);
    startTimer();
    return;
  }
  walker = null;
  emit({ running: true });
  if (!(await startWatch())) {
    emit({ phase: 'plan', running: false });
    return;
  }
  if (state.plan) intro(state.plan);
}

// ---------- Dışa açık API ----------

export const navigation = {
  configure(c: NavConfig) {
    const changed = !cfg || cfg.profile !== c.profile || cfg.sim !== c.sim;
    cfg = c;
    if (changed && state.phase === 'plan') replanPreview();
  },
  /** Ekran açılınca: hedef ve tur. Başlangıç seçimi korunur. */
  open(dest: string | null, tour: string[] = []) {
    navigation.stop();
    emit({ dest, tour });
    replanPreview();
    if (state.start.kind === 'here') void startWatch();
  },
  setStart(start: StartChoice) {
    if (state.phase !== 'plan') return;
    emit({ start });
    if (start.kind === 'here') void startWatch();
    replanPreview();
  },
  setDest(dest: string | null) {
    if (state.phase !== 'plan') return;
    emit({ dest, tour: [] });
    replanPreview();
  },
  /** Nokta ya da bildirim değişti (grafik sürümü): önizleme yenilenir. */
  refresh() {
    replanPreview();
  },
  begin,
  /** Yürüyüşü bitirir; plan ekranına döner. */
  stop() {
    stopTimer();
    stopAudio();
    silence();
    stopSoundscape();
    pendingSpeech = null;
    resumeAfterPopup = false;
    walker = null;
    if (state.start.kind !== 'here') stopWatch();
    emit({ phase: 'plan', ...tracking() });
    replanPreview();
  },
  /** Ekrandan çıkınca: her şey susar, konum izlenmez. */
  close() {
    navigation.stop();
    stopWatch();
  },
  pause() {
    stopTimer();
    silence();
    stopSoundscape();
    emit({ running: false });
  },
  resume() {
    if (state.phase === 'active' && state.source === 'sim' && !state.popup) startTimer();
  },
  repeat() {
    const step = state.plan && state.stepIndex >= 0 ? state.plan.steps[state.stepIndex] : undefined;
    if (!step || !cfg) return;
    if (canHear()) say(step.text, { lang: cfg.profile.lang, rate: cfg.speechRate, interrupt: true });
    else void hapticForTurn(step.turn, state.stepIndex === state.plan!.steps.length - 1);
    emit({ cueCount: state.cueCount + 1 });
  },
  setSpeed(speed: number) {
    emit({ speed });
  },
  /** Senaryo: önümüzdeki yol kapandı (onaylı erişilebilirlik bildirimi gibi). */
  blockAhead(): boolean {
    const plan = state.plan;
    if (!plan || state.phase !== 'active' || !truth) return false;
    const ahead = blockableAhead(plan, state.distance);
    if (!ahead) return false;
    reroute('blocked', [...state.blocked, ahead.segmentId], truth);
    return true;
  },
  /** Senaryo: kullanıcı önündeki kavşakta dönmeyi kaçırıp düz devam eder. */
  wrongTurn(): boolean {
    const plan = state.plan;
    if (!plan || !walker || state.phase !== 'active' || state.detouring) return false;
    const detour = detourFrom(plan, state.distance, new Set(state.blocked));
    if (!detour) return false;
    walker = walkerOnLine(walker, detour.line);
    walkerDone = false;
    emit({ detouring: true });
    if (!timer && !state.popup) startTimer();
    return true;
  },
  /** Senaryo: kalabalık/gürültü açılır ya da kapanır. */
  toggleCrowd() {
    if (!cfg) return;
    const noisy = !state.noisy;
    const text = noisy ? TEXT[cfg.profile.lang].crowdOn : TEXT[cfg.profile.lang].crowdOff;
    // Geçiş mesajı her iki durumda da okunur (gürültüde de denenir), ardından mod değişir.
    if (cfg.profile.hearing !== 'deaf' && cfg.profile.senses.audio) say(text, { lang: cfg.profile.lang, rate: cfg.speechRate, interrupt: true });
    void hapticAlert();
    if (noisy) stopSoundscape();
    emit({ noisy, alert: { id: ++alertId, kind: noisy ? 'crowd_on' : 'crowd_off', text }, cueCount: state.cueCount + 1 });
  },
  dismissAlert() {
    emit({ alert: null });
  },
  playPoint,
  stopAudio,
  closePopup() {
    stopAudio();
    const [next, ...rest] = state.queue;
    emit({ popup: null, queue: rest });
    if (next) present(next);
    else if (resumeAfterPopup && state.phase === 'active') {
      resumeAfterPopup = false;
      startTimer();
    }
  },
  /** Turda sıradaki esere: bulunulan yerden yeni rota ve yürüyüş. */
  async nextStop() {
    const [dest, ...tour] = state.tour;
    if (!dest || !cfg) return;
    stopAudio();
    const from = state.source === 'sim' ? (truth ?? state.position) : state.here;
    const start: StartChoice = state.source === 'sim' && from ? { kind: 'pick', location: from } : { kind: 'here' };
    emit({ phase: 'plan', dest, tour, start, ...tracking() });
    replanPreview();
    await begin();
  },
};

export function useNavigation(): NavState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export const navigationState = () => state;
