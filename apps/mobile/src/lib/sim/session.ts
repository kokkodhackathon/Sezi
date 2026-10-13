import { bearingDeg, dueStep, initialTrack, pointAlong, stereoPan, trackFix, type GuidanceStep, type LngLat, type LocationFix, type TrackState, type UserProfile } from '@sezi/shared';
import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { planRoute, walkingSpeed, type PlannedRoute } from '../nav';
import { hapticForTurn, playLandmarkCue } from './cues';
import { say, silence } from './speech';
import { createWalker, stepWalker, type Walker } from './walker';

/**
 * Tek rehberlik oturumu. Rota ekranı ve tam ekran rehberlik aynı oturumu izler:
 * ekran değişince ilerleme kaybolmaz. Konum, sanal yürüyüşçünün ürettiği GPS benzeri
 * ölçümlerden gelir ve gerçek GPS ile aynı takip hattından (`trackFix`, `dueStep`) geçer.
 */
export interface NavState {
  running: boolean;
  finished: boolean;
  /** Rota üzerindeki ilerleme (m). */
  distance: number;
  /** Rotaya eşlenmiş konum (haritada gösterilen). */
  position: LngLat;
  heading: number;
  /** Son ham konum ölçümü (rotadan sapma görselleştirmesi için). */
  fix: LocationFix | null;
  track: TrackState;
  /** Son duyurulan adım (yoksa -1). */
  stepIndex: number;
  /** Her yeni ipucunda artar: görsel uyarı (işitme engelli) bunu izler. */
  cueCount: number;
  speed: number;
}

interface Session {
  key: string;
  slug: string;
  profile: UserProfile | null;
  plan: PlannedRoute | null;
  state: NavState;
}

const TICK_MS = 200;

const initialState = (plan: PlannedRoute | null, speed = 1): NavState => {
  const start = plan?.geometry.line[0] ?? ([0, 0] as LngLat);
  return { running: false, finished: false, distance: 0, position: start, heading: 0, fix: null, track: initialTrack, stepIndex: -1, cueCount: 0, speed };
};

let session: Session = { key: '', slug: '', profile: null, plan: null, state: initialState(null) };
let walker: Walker | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let consumers = 0;
const listeners = new Set<() => void>();
const options = { speechRate: 0.95, onArrive: (_slug: string) => {} };

function emit(state: Partial<NavState>) {
  session = { ...session, state: { ...session.state, ...state } };
  listeners.forEach((l) => l());
}

const keyOf = (slug: string, profile: UserProfile) => `${slug}|${JSON.stringify(profile)}`;

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
  session = { key, slug, profile, plan, state: initialState(plan, session.state.speed) };
  listeners.forEach((l) => l());
}

function announce(step: GuidanceStep, index: number, position: LngLat, heading: number) {
  const { plan, profile } = session;
  if (!plan || !profile) return;
  const arrived = index === plan.steps.length - 1;
  // Duymayan kullanıcı: hiçbir bilgi yalnızca sesle verilmez; görsel uyarı (cueCount) ve titreşim kullanılır.
  if (profile.hearing === 'deaf') {
    if (profile.senses.haptic) void hapticForTurn(step.turn, arrived);
    return;
  }
  if (profile.senses.audio && step.landmark) playLandmarkCue(stereoPan(heading, bearingDeg(position, step.landmark.location)));
  if (profile.senses.haptic) void hapticForTurn(step.turn, arrived);
  if (profile.senses.audio) say(step.text, { lang: profile.lang, rate: options.speechRate });
}

function tick() {
  const { plan, profile, state } = session;
  if (!plan || !profile || !walker) return;
  const mps = walkingSpeed(profile) * state.speed;
  const step = stepWalker(walker, (mps * TICK_MS) / 1000, Date.now());
  walker = step.walker;
  const total = plan.geometry.nodeAtM.at(-1)!;
  const track = trackFix(state.track, plan.geometry.line, step.fix);
  // Yürüyüşçü çizginin sonuna ulaştıysa GPS sapması varışı geciktirmesin.
  const distance = step.done ? total : track.alongM;
  const position = pointAlong(plan.geometry.line, distance);
  const heading = step.fix.heading ?? state.heading;

  const index = dueStep(
    plan.steps.map((s) => s.atM),
    state.stepIndex,
    distance,
    total,
    mps,
  );
  let cueCount = state.cueCount;
  if (index > state.stepIndex) {
    announce(plan.steps[index]!, index, position, heading);
    cueCount++;
  }
  const finished = index === plan.steps.length - 1;
  if (finished) {
    stopTimer();
    options.onArrive(session.slug);
  }
  emit({ running: !finished, finished, distance, position, heading, fix: step.fix, track: { ...track, alongM: distance }, stepIndex: index, cueCount });
}

export const navSession = {
  play() {
    const { plan, state } = session;
    if (!plan) return;
    if (state.finished) {
      walker = createWalker(plan.geometry.line);
      emit({ ...initialState(plan, state.speed) });
    }
    stopTimer();
    timer = setInterval(tick, TICK_MS);
    emit({ running: true });
  },
  pause() {
    stopTimer();
    silence();
    emit({ running: false });
  },
  reset() {
    stopTimer();
    silence();
    walker = session.plan ? createWalker(session.plan.geometry.line) : null;
    emit(initialState(session.plan, session.state.speed));
  },
  repeat() {
    const { plan, state } = session;
    if (!plan || state.stepIndex < 0) return;
    const step = plan.steps[state.stepIndex]!;
    const { profile } = session;
    if (profile && profile.hearing !== 'deaf' && profile.senses.audio) say(step.text, { lang: profile.lang, rate: options.speechRate, interrupt: true });
    else if (profile?.senses.haptic) void hapticForTurn(step.turn, state.stepIndex === plan.steps.length - 1);
    emit({ cueCount: state.cueCount + 1 });
  },
  setSpeed(speed: number) {
    emit({ speed });
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
  const key = profile ? keyOf(slug, profile) : '';
  // Oturum açılana kadar (ilk çizim) aynı planı yerelde hesapla: ekran boş kalmasın.
  const fallback = useMemo(() => (profile && current.key !== key ? planRoute(slug, profile) : null), [slug, profile, key, current.key]);

  useEffect(() => {
    options.speechRate = opts.speechRate;
    options.onArrive = opts.onArrive;
  }, [opts.speechRate, opts.onArrive]);

  useEffect(() => {
    if (profile) open(slug, profile);
  }, [slug, profile]);

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
  const total = plan ? plan.geometry.nodeAtM.at(-1)! : 0;
  return { plan, state, total, ...navSession };
}
