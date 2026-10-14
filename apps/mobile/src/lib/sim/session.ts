import { bearingDeg, dueStep, initialTrack, pointAlong, soundKindFor, soundscapeMix, stereoPan, trackFix, type GuidanceStep, type LngLat, type LocationFix, type SoundSource, type SoundVoice, type TrackState, type UserProfile } from '@sezi/shared';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { blockableAhead, detourFrom, navVersion, pilotLandmarks, planRoute, useNavVersion, walkingSpeed, type PlannedRoute } from '../nav';
import { hapticAlert, hapticForTurn, playLandmarkCue } from './cues';
import { stopSoundscape, updateSoundscape } from './soundscape-engine';
import { say, silence } from './speech';
import { createWalker, stepWalker, walkerOnLine, type Walker } from './walker';

/**
 * Tek rehberlik oturumu. Rota ekranı ve tam ekran rehberlik aynı oturumu izler:
 * ekran değişince ilerleme kaybolmaz. Konum, sanal yürüyüşçünün ürettiği GPS benzeri
 * ölçümlerden gelir ve gerçek GPS ile aynı takip hattından (`trackFix`, `dueStep`) geçer.
 *
 * Senaryolar (jüri paneli): yol kapatma, yanlış dönüş, kalabalık. Rotadan sapma her durumda
 * aynı tepkiyi verir: uyarı, bulunulan yerden yeniden rota.
 */
export type AlertKind = 'offroute' | 'blocked' | 'crowd_on' | 'crowd_off' | 'no_route';

export interface NavAlert {
  id: number;
  kind: AlertKind;
  text: string;
}

export interface NavState {
  running: boolean;
  finished: boolean;
  /** Rota üzerindeki ilerleme (m). */
  distance: number;
  /** Rotaya eşlenmiş konum; rotadan çıkıldıysa gerçek konum (haritada gösterilen). */
  position: LngLat;
  heading: number;
  /** Son ham konum ölçümü. */
  fix: LocationFix | null;
  track: TrackState;
  /** Son duyurulan adım (yoksa -1). */
  stepIndex: number;
  /** Her yeni ipucunda artar: görsel uyarı (işitme engelli, kalabalık) bunu izler. */
  cueCount: number;
  speed: number;
  /** Kalabalık/gürültü: sesli ipuçları kapanır, titreşim ve ekran ışığı devralır. */
  noisy: boolean;
  /** Kapalı segmentler. */
  blocked: string[];
  reroutes: number;
  /** Son uyarı (ekranda şerit olarak gösterilir). */
  alert: NavAlert | null;
  /** Yürüyüşçü rotadan ayrılan bir sokakta (yanlış dönüş senaryosu). */
  detouring: boolean;
  /** Şu an duyulan yer işareti sesleri (ses altyazısı için; duymayan kullanıcıda da hesaplanır). */
  sounds: SoundVoice[];
}

interface Session {
  key: string;
  slug: string;
  profile: UserProfile | null;
  plan: PlannedRoute | null;
  state: NavState;
}

const TICK_MS = 200;

const TEXT = {
  tr: {
    intro: (name: string, m: number) => `Hedef: ${name}. Yaklaşık ${m} metre.`,
    offroute: (m: number) => `Rotadan çıktınız. Bulunduğunuz yerden yeni rota: ${m} metre.`,
    blocked: (m: number) => `İleride yol kapalı. Sizi başka yoldan götürüyorum: ${m} metre.`,
    noRoute: 'Kapalı yolun çevresinden geçen bir rota bulunamadı. Lütfen bekleyin ya da yardım isteyin.',
    crowdOn: 'Ortam gürültülü. Bundan sonra titreşim ve ekran ışığıyla yönlendiriyorum.',
    crowdOff: 'Ortam sakinleşti. Sesli yönlendirme yeniden açık.',
  },
  en: {
    intro: (name: string, m: number) => `Destination: ${name}. About ${m} metres.`,
    offroute: (m: number) => `You have left the route. New route from here: ${m} metres.`,
    blocked: (m: number) => `The way ahead is closed. Taking you another way: ${m} metres.`,
    noRoute: 'No route around the closed street was found. Please wait or ask for help.',
    crowdOn: 'It is noisy here. From now on I will guide you with vibration and screen light.',
    crowdOff: 'It is quieter now. Spoken guidance is back on.',
  },
};

const initialState = (plan: PlannedRoute | null, speed = 1): NavState => {
  const start = plan?.geometry.line[0] ?? ([0, 0] as LngLat);
  return {
    running: false,
    finished: false,
    distance: 0,
    position: start,
    heading: 0,
    fix: null,
    track: initialTrack,
    stepIndex: -1,
    cueCount: 0,
    speed,
    noisy: false,
    blocked: [],
    reroutes: 0,
    alert: null,
    detouring: false,
    sounds: [],
  };
};

/** Ses manzarasının kaynakları: pilot alandaki tüm yer işaretleri. */
let soundSources: SoundSource[] = [];

let session: Session = { key: '', slug: '', profile: null, plan: null, state: initialState(null) };
let walker: Walker | null = null;
/** Yürüyüşçünün gerçek (gürültüsüz) konumu: yeniden rota buradan başlar. */
let truth: LngLat | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let consumers = 0;
let alertId = 0;
const listeners = new Set<() => void>();
const options = { speechRate: 0.95, onArrive: (_slug: string) => {} };

function emit(state: Partial<NavState>) {
  session = { ...session, state: { ...session.state, ...state } };
  listeners.forEach((l) => l());
}

// Onaylı bildirim gelince (grafik sürümü değişince) oturum yeni grafikle yeniden açılır.
const keyOf = (slug: string, profile: UserProfile) => `${slug}|${JSON.stringify(profile)}|${navVersion()}`;
const totalOf = (plan: PlannedRoute) => plan.geometry.nodeAtM.at(-1)!;

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

function open(slug: string, profile: UserProfile) {
  const key = keyOf(slug, profile);
  if (session.key === key) return;
  stopTimer();
  silence();
  const plan = planRoute(slug, profile);
  walker = plan ? createWalker(plan.geometry.line) : null;
  truth = plan?.geometry.line[0] ?? null;
  soundSources = pilotLandmarks.map((n) => ({
    id: n.id,
    name: n.name?.[profile.lang] ?? n.name?.tr ?? '',
    kind: soundKindFor(n.workType),
    location: n.location,
  }));
  stopSoundscape();
  session = { key, slug, profile, plan, state: initialState(plan, session.state.speed) };
  listeners.forEach((l) => l());
}

/** Sesli ipucu bu oturumda kullanılabilir mi (duymayan kullanıcı ya da kalabalıkta hayır). */
function canSpeak() {
  const { profile, state } = session;
  return !!profile && profile.hearing !== 'deaf' && profile.senses.audio && !state.noisy;
}

function speak(text: string, interrupt = false) {
  const { profile } = session;
  if (profile && canSpeak()) say(text, { lang: profile.lang, rate: options.speechRate, interrupt });
}

function announce(step: GuidanceStep, index: number, position: LngLat, heading: number) {
  const { plan, profile } = session;
  if (!plan || !profile) return;
  const arrived = index === plan.steps.length - 1;
  // Duymayan kullanıcı ya da kalabalık: bilgi yalnızca sesle verilmez; görsel uyarı (cueCount) ve titreşim kullanılır.
  if (profile.senses.haptic || !canSpeak()) {
    void hapticForTurn(step.turn, arrived).then(() => {
      if (step.hazard) return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    });
  }
  if (!canSpeak()) return;
  if (step.landmark) playLandmarkCue(stereoPan(heading, bearingDeg(position, step.landmark.location)));
  speak(step.text);
}

function raise(kind: AlertKind, text: string, cueCount: number): Partial<NavState> {
  void hapticAlert();
  speak(text, true);
  return { alert: { id: ++alertId, kind, text }, cueCount: cueCount + 1 };
}

/** Bulunulan yerden yeniden rota. Bulunamazsa mevcut rota korunur. */
function reroute(kind: 'offroute' | 'blocked', blocked: string[]) {
  const { slug, profile, state } = session;
  if (!profile || !walker || !truth) return;
  const lang = profile.lang;
  const next = planRoute(slug, profile, truth, { blocked: new Set(blocked), leadIn: true });
  if (!next) {
    emit({ blocked, ...raise('no_route', TEXT[lang].noRoute, state.cueCount) });
    return;
  }
  walker = walkerOnLine(walker, next.geometry.line);
  session = { ...session, plan: next };
  const m = Math.round(totalOf(next));
  emit({
    blocked,
    distance: 0,
    track: initialTrack,
    stepIndex: -1,
    reroutes: state.reroutes + 1,
    detouring: false,
    position: next.geometry.line[0]!,
    ...raise(kind, kind === 'offroute' ? TEXT[lang].offroute(m) : TEXT[lang].blocked(m), state.cueCount),
  });
}

function tick() {
  const { plan, profile, state } = session;
  if (!plan || !profile || !walker) return;
  const mps = walkingSpeed(profile) * state.speed;
  const step = stepWalker(walker, (mps * TICK_MS) / 1000, Date.now());
  walker = step.walker;
  truth = step.truth;
  const total = totalOf(plan);
  const track = trackFix(state.track, plan.geometry.line, step.fix);

  // Rotadan çıkıldı (ya da sapma sokağının sonuna gelindi): uyarı ve yeniden rota.
  if (track.offRoute || (state.detouring && step.done)) {
    reroute('offroute', state.blocked);
    return;
  }

  // Yürüyüşçü rota çizgisinin sonuna ulaştıysa GPS sapması varışı geciktirmesin.
  const distance = step.done && !state.detouring ? total : track.alongM;
  const position = track.crossM > 10 ? step.truth : pointAlong(plan.geometry.line, distance);
  const heading = step.fix.heading ?? state.heading;

  const index = dueStep(
    plan.steps.map((s) => s.atM),
    state.stepIndex,
    distance,
    total,
    mps,
  );
  // Ses manzarası: kullanıcının gerçek konumu ve yönüne göre; duyamayan kullanıcıda yalnızca altyazı.
  const sounds = soundscapeMix(step.truth, heading, soundSources);
  if (canSpeak()) updateSoundscape(sounds);
  else stopSoundscape();

  let cueCount = state.cueCount;
  if (index > state.stepIndex) {
    announce(plan.steps[index]!, index, position, heading);
    cueCount++;
  }
  const finished = index === plan.steps.length - 1;
  if (finished) {
    stopTimer();
    stopSoundscape();
    options.onArrive(session.slug);
  }
  emit({ running: !finished, finished, distance, position, heading, fix: step.fix, track: { ...track, alongM: distance }, stepIndex: index, cueCount, sounds });
}

export const navSession = {
  play() {
    const { plan, profile, state } = session;
    if (!plan || !profile) return;
    if (state.finished) {
      // Baştan: ilk rota (kapatmalar temizlenir).
      const fresh = planRoute(session.slug, profile);
      if (!fresh) return;
      session = { ...session, plan: fresh };
      walker = createWalker(fresh.geometry.line);
      truth = fresh.geometry.line[0]!;
      emit({ ...initialState(fresh, state.speed), noisy: state.noisy });
    }
    if (session.state.distance === 0 && session.state.stepIndex < 0) {
      const p = session.plan!;
      speak(TEXT[profile.lang].intro(p.end.name?.[profile.lang] ?? p.end.name?.tr ?? '', Math.round(totalOf(p))));
    }
    stopTimer();
    timer = setInterval(tick, TICK_MS);
    emit({ running: true });
  },
  pause() {
    stopTimer();
    silence();
    stopSoundscape();
    emit({ running: false });
  },
  reset() {
    stopTimer();
    silence();
    stopSoundscape();
    const { profile } = session;
    const fresh = profile ? planRoute(session.slug, profile) : null;
    session = { ...session, plan: fresh };
    walker = fresh ? createWalker(fresh.geometry.line) : null;
    truth = fresh?.geometry.line[0] ?? null;
    emit(initialState(fresh, session.state.speed));
  },
  repeat() {
    const { plan, state, profile } = session;
    if (!plan || !profile || state.stepIndex < 0) return;
    const step = plan.steps[state.stepIndex]!;
    if (canSpeak()) say(step.text, { lang: profile.lang, rate: options.speechRate, interrupt: true });
    else if (profile.senses.haptic || state.noisy) void hapticForTurn(step.turn, state.stepIndex === plan.steps.length - 1);
    emit({ cueCount: state.cueCount + 1 });
  },
  setSpeed(speed: number) {
    emit({ speed });
  },
  /** Senaryo: önümüzdeki yol kapandı (onaylı erişilebilirlik bildirimi gibi). */
  blockAhead() {
    const { plan, state } = session;
    if (!plan || state.finished) return false;
    const ahead = blockableAhead(plan, state.distance);
    if (!ahead) return false;
    reroute('blocked', [...state.blocked, ahead.segmentId]);
    return true;
  },
  /** Senaryo: kullanıcı önündeki kavşakta dönmeyi kaçırıp düz devam eder. */
  wrongTurn() {
    const { plan, state } = session;
    if (!plan || !walker || state.finished || state.detouring) return false;
    const detour = detourFrom(plan, state.distance, new Set(state.blocked));
    if (!detour) return false;
    walker = walkerOnLine(walker, detour.line);
    emit({ detouring: true });
    if (!state.running) navSession.play();
    return true;
  },
  /** Senaryo: kalabalık/gürültü açılır ya da kapanır. */
  toggleCrowd() {
    const { profile, state } = session;
    if (!profile) return;
    const noisy = !state.noisy;
    const text = noisy ? TEXT[profile.lang].crowdOn : TEXT[profile.lang].crowdOff;
    // Geçiş mesajı her iki durumda da okunur (gürültüde de denenir), ardından mod değişir.
    if (profile.hearing !== 'deaf' && profile.senses.audio) say(text, { lang: profile.lang, rate: options.speechRate, interrupt: true });
    void hapticAlert();
    if (noisy) stopSoundscape();
    emit({ noisy, alert: { id: ++alertId, kind: noisy ? 'crowd_on' : 'crowd_off', text }, cueCount: state.cueCount + 1 });
  },
  dismissAlert() {
    emit({ alert: null });
  },
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => session;

/**
 * Bir rota için oturumu açar ve izler. Aynı rota ve profille açılmış oturum varsa ona bağlanır.
 * Oturumu izleyen son ekran kapanınca simülasyon duraklar (ilerleme korunur).
 */
export function useNavSession(slug: string, profile: UserProfile | null, opts: { speechRate: number; onArrive: (slug: string) => void }) {
  const current = useSyncExternalStore(subscribe, snapshot);
  const version = useNavVersion();
  const key = profile ? keyOf(slug, profile) : '';
  // Oturum açılana kadar (ilk çizim) aynı planı yerelde hesapla: ekran boş kalmasın.
  const fallback = useMemo(() => (profile && current.key !== key ? planRoute(slug, profile) : null), [slug, profile, key, current.key]);

  useEffect(() => {
    options.speechRate = opts.speechRate;
    options.onArrive = opts.onArrive;
  }, [opts.speechRate, opts.onArrive]);

  useEffect(() => {
    if (profile) open(slug, profile);
  }, [slug, profile, version]);

  useEffect(() => {
    consumers++;
    return () => {
      consumers--;
      if (consumers === 0) navSession.pause();
    };
  }, []);

  const ready = current.key === key;
  const plan = ready ? current.plan : fallback;
  const state = ready ? current.state : initialState(plan, current.state.speed);
  const total = plan ? totalOf(plan) : 0;
  return { plan, state, total, ...navSession };
}
