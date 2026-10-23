import {
  createWalker,
  duePoints,
  followRoute,
  initialTrack,
  pointVoice,
  PROFILE_KEYS,
  profileFor,
  stepWalker,
  walkerOnLine,
  walkingSpeed,
  type LngLat,
  type LocationFix,
  type NavPoint,
  type OverrideType,
  type PlannedRoute,
  type Planner,
  type ProfileKey,
  type TrackState,
  type UserProfile,
  type Walker,
} from '@sezi/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { usePoints, type PointRow } from './data';
import { PILOT_CITY, pilotPlanner } from './pilot';
import { AUDIO_BASE, supabase } from './supabase';

/**
 * Rota testi: mobil uygulamadaki rota planlayıcı ve sanal yürüyüş, panelde.
 * Rota, talimatlar, uğrama noktaları ve takip adımı uygulamayla aynı koddan gelir (shared: planner, walker, follow);
 * yalnızca ses ve ekran tepkisi farklıdır (talimatlar kayıtta, istenirse tarayıcı sesiyle).
 */

export const PROFILE_LABEL: Record<ProfileKey, string> = {
  walker: 'Yürüyen',
  wheelchair: 'Tekerlekli sandalye',
  blind: 'Görme engelli (baston)',
  deaf: 'Duymayan',
};

/** Profil rotayı nasıl değiştirir (uygulamadaki karşılaştırma ekranıyla aynı açıklama). */
export const PROFILE_WHY: Record<ProfileKey, string> = {
  walker: 'En kısa yol; yer işaretlerinin göründüğü sokaklar tercih edilir.',
  wheelchair: 'Merdivenli, dik ve dar yollar hiç kullanılmaz; arnavut kaldırımı mümkünse atlanır.',
  blind: 'Gürültülü ana caddelerden uzak durur ki ses ipuçları duyulsun; kaldırım kenarları azaltılır.',
  deaf: 'Rota yürüyenle aynı maliyetle hesaplanır; fark ipucundadır: ses yerine yazı, titreşim ve ekran ışığı.',
};

export interface ProfileRoute {
  key: ProfileKey;
  plan: PlannedRoute | null;
  stats: { lengthM: number; stairs: number; busyM: number; cobbleM: number } | null;
  minutes: number;
}

/**
 * Karşılaştırma haritasında profil çizgileri: renk yanında kalınlık ve kesiklikle de ayrışır (renk tek başına anlam taşımaz).
 * Çizim sırası kalından inceye; kalın çizgi altta kalır, üst üste binen rotalar da görünür.
 */
export const PROFILE_LINE: Record<ProfileKey, { color: string; width: number; dash?: number[]; style: string }> = {
  wheelchair: { color: '#0B6E73', width: 9, style: 'kalın düz çizgi' },
  blind: { color: '#B8321F', width: 5, dash: [1.4, 1], style: 'kesikli çizgi' },
  walker: { color: '#1E1A17', width: 3, style: 'ince düz çizgi' },
  deaf: { color: '#B07A12', width: 3, dash: [0.4, 1.8], style: 'noktalı çizgi' },
};

export type Start = { kind: 'point'; id: string } | { kind: 'pick'; location: LngLat };

export type LogKind = 'step' | 'point' | 'reroute' | 'blocked' | 'detour' | 'arrive' | 'info';
export interface LogEntry {
  id: number;
  /** Yürüyüşün başından geçen süre (sn, sanal). */
  t: number;
  kind: LogKind;
  text: string;
}

export interface RouteTestState {
  profile: ProfileKey;
  lang: 'tr' | 'en';
  start: Start | null;
  /** Hedef eser; null = hedefsiz gezinti. */
  dest: string | null;
  phase: 'plan' | 'active' | 'arrived';
  plan: PlannedRoute | null;
  note: 'need_start' | 'outside_pilot' | 'no_route' | 'no_points' | null;
  running: boolean;
  speed: number;
  /** Haritadaki konum (rotaya oturtulmuş ya da ölçülen). */
  position: LngLat | null;
  distance: number;
  stepIndex: number;
  track: TrackState;
  fired: string[];
  blocked: string[];
  reroutes: number;
  detouring: boolean;
  /** Yanlış dönüşte yürüyüşçünün izlediği çizgi (haritada gösterilir). */
  detourLine: LngLat[] | null;
  /** Son açılan nokta (kartta gösterilir). */
  openPoint: string | null;
  elapsedS: number;
  log: LogEntry[];
  /** Talimatları ve nokta metinlerini tarayıcı sesiyle oku. */
  voice: boolean;
}

const TICK_MS = 200;

const tracking = () => ({
  running: false,
  position: null,
  distance: 0,
  stepIndex: -1,
  track: initialTrack,
  fired: [] as string[],
  blocked: [] as string[],
  reroutes: 0,
  detouring: false,
  detourLine: null,
  openPoint: null,
  elapsedS: 0,
  log: [] as LogEntry[],
});

export class RouteTest {
  private planner: Planner;
  private points: NavPoint[] = [];
  private walker: Walker | null = null;
  private walkerDone = false;
  private truth: LngLat | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private logId = 0;
  private audio: HTMLAudioElement | null = null;
  private listeners = new Set<() => void>();
  state: RouteTestState;

  constructor(planner: Planner) {
    this.planner = planner;
    this.state = { profile: 'walker', lang: 'tr', start: null, dest: null, phase: 'plan', plan: null, note: 'need_start', speed: 3, voice: false, ...tracking() };
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  getState = () => this.state;

  private emit(patch: Partial<RouteTestState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  private profile(): UserProfile {
    return profileFor(this.state.profile, this.state.lang);
  }

  private origin(): LngLat | null {
    const s = this.state.start;
    if (!s) return null;
    return s.kind === 'point' ? this.planner.startLocation(s.id) : s.location;
  }

  private compute(from: LngLat, leadIn: boolean, blocked: string[] = [], skip: string[] = []) {
    if (!this.planner.inPilotArea(from)) return { plan: null, note: 'outside_pilot' as const };
    const opts = { leadIn, blocked: new Set(blocked), skip: new Set(skip) };
    const dest = this.state.dest;
    const plan = dest ? this.planner.planRoute(dest, this.profile(), from, opts) : this.planner.planStroll(this.profile(), from, opts);
    return plan ? { plan, note: null } : { plan: null, note: dest ? ('no_route' as const) : ('no_points' as const) };
  }

  /** Plan aşamasında önizleme rotası (başlangıç, hedef, profil, nokta ya da bildirim değişince). */
  replan() {
    if (this.state.phase !== 'plan') return;
    const from = this.origin();
    if (!from) {
      this.emit({ plan: null, note: 'need_start' });
      return;
    }
    this.emit(this.compute(from, this.state.start?.kind === 'pick'));
  }

  // ---------- Kayıt ve ses ----------

  private log(kind: LogKind, text: string) {
    const entry = { id: ++this.logId, t: Math.round(this.state.elapsedS), kind, text };
    this.emit({ log: [entry, ...this.state.log].slice(0, 200) });
  }

  private canHear() {
    const p = this.profile();
    return p.hearing !== 'deaf' && p.senses.audio;
  }

  private speak(text: string, interrupt = false) {
    if (!this.state.voice || !this.canHear() || typeof speechSynthesis === 'undefined') return;
    if (interrupt) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = this.state.lang === 'tr' ? 'tr-TR' : 'en-GB';
    speechSynthesis.speak(u);
  }

  private open(id: string, label: string) {
    const p = this.points.find((x) => x.id === id);
    if (!p) return;
    this.emit({ openPoint: id });
    this.log('point', `${label}: ${p.title[this.state.lang] ?? p.title.tr}`);
    if (!this.state.voice || !this.canHear()) return;
    const v = pointVoice(p, this.state.lang);
    if (!v) return;
    if (v.kind === 'file') {
      this.audio?.pause();
      this.audio = new Audio(AUDIO_BASE + v.path);
      void this.audio.play().catch(() => this.speak(p.body?.[this.state.lang] ?? p.body?.tr ?? ''));
    } else this.speak(v.text);
  }

  stopAudio() {
    this.audio?.pause();
    this.audio = null;
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }

  // ---------- Yürüyüş ----------

  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private startTimer() {
    this.stopTimer();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.emit({ running: true });
  }

  private tick() {
    if (!this.walker) return;
    const mps = walkingSpeed(this.profile()) * this.state.speed;
    const step = stepWalker(this.walker, (mps * TICK_MS) / 1000, Date.now());
    this.walker = step.walker;
    this.walkerDone = step.done;
    this.truth = step.truth;
    this.emit({ elapsedS: this.state.elapsedS + (this.state.speed * TICK_MS) / 1000 });
    if (step.done && !this.state.detouring) this.stopTimer();
    this.onFix(step.fix, step.truth, step.done);
  }

  private onFix(fix: LocationFix, truthAt: LngLat, walkerAtEnd: boolean) {
    const plan = this.state.plan;
    if (!plan || this.state.phase !== 'active') return;

    // 1. Yarıçapa girilen noktalar (varış bilgisi varışta açılır).
    const due = duePoints(this.points, fix, new Set(this.state.fired)).filter((p) => p.id !== plan.arrival?.id);
    if (due.length) this.emit({ fired: [...this.state.fired, ...due.map((p) => p.id)] });
    for (const p of due) this.open(p.id, 'Nokta açıldı (yarıçap)');

    // 2. Rota takibi: uygulamayla aynı adım.
    const r = followRoute({
      line: plan.geometry.line,
      totalM: plan.geometry.nodeAtM.at(-1)!,
      stepsAtM: plan.steps.map((s) => s.atM),
      via: plan.via,
      track: this.state.track,
      stepIndex: this.state.stepIndex,
      fired: new Set(this.state.fired),
      fix,
      mps: walkingSpeed(this.profile()) * this.state.speed,
      snapToLine: true,
      atEnd: this.walkerDone && !this.state.detouring,
    });
    if (r.offRoute || (this.state.detouring && walkerAtEnd)) {
      this.reroute('offroute', this.state.blocked, truthAt);
      return;
    }
    this.emit({ position: r.position, track: r.track, distance: r.distance, stepIndex: r.stepIndex });
    if (r.newStep) {
      const text = plan.steps[r.stepIndex]!.text;
      this.log('step', text);
      this.speak(text, true);
    }
    if (r.reached.length) this.emit({ fired: [...this.state.fired, ...r.reached] });
    for (const id of r.reached) this.open(id, 'Nokta açıldı (rotada)');
    if (r.arrived) this.arrive();
  }

  private reroute(kind: 'offroute' | 'blocked', blocked: string[], from: LngLat) {
    const next = this.compute(from, true, blocked, this.state.fired);
    if (!next.plan) {
      this.emit({ blocked, track: { ...this.state.track, offRoute: false, awayCount: 0 } });
      this.log('info', 'Yeni rota bulunamadı; birkaç ölçüm sonra yeniden denenecek.');
      return;
    }
    if (this.walker) this.walker = walkerOnLine(this.walker, next.plan.geometry.line);
    this.walkerDone = false;
    this.emit({ plan: next.plan, blocked, distance: 0, track: initialTrack, stepIndex: -1, reroutes: this.state.reroutes + 1, detouring: false, detourLine: null });
    const m = Math.round(next.plan.geometry.nodeAtM.at(-1)!);
    this.log('reroute', kind === 'offroute' ? `Rotadan çıkıldı; bulunulan yerden yeni rota: ${m} m` : `Yol kapalı; yeni rota: ${m} m`);
    if (!this.timer) this.startTimer();
  }

  private arrive() {
    this.stopTimer();
    const plan = this.state.plan;
    this.emit({ phase: 'arrived', running: false });
    this.log('arrive', plan?.kind === 'stroll' ? `Gezinti tamamlandı: ${this.state.fired.length} nokta` : 'Varış');
    const arrival = plan?.arrival;
    if (arrival) {
      this.emit({ fired: [...this.state.fired, arrival.id] });
      this.open(arrival.id, 'Varış bilgisi');
    }
  }

  // ---------- Dışa açık API ----------

  /**
   * Aynı başlangıç ve hedef için her profilin rotası (karşılaştırma). Başlangıç yoksa ya da pilot alan dışındaysa boş.
   * Yürüyüşte o anki rota değil, plan aşamasındaki başlangıç kullanılır.
   */
  compareProfiles(): ProfileRoute[] {
    const from = this.origin();
    if (!from || !this.planner.inPilotArea(from)) return [];
    const leadIn = this.state.start?.kind === 'pick';
    return PROFILE_KEYS.map((key) => {
      const profile = profileFor(key, this.state.lang);
      const plan = this.state.dest ? this.planner.planRoute(this.state.dest, profile, from, { leadIn }) : this.planner.planStroll(profile, from, { leadIn });
      return {
        key,
        plan,
        stats: plan ? this.planner.routeStats(plan) : null,
        minutes: plan ? Math.max(1, Math.round(plan.route.lengthM / walkingSpeed(profile) / 60)) : 0,
      };
    });
  }

  /** Noktalar değişti (veri ya da taslak seçimi): önizleme yenilenir. */
  setPoints(points: NavPoint[]) {
    this.points = points;
    this.replan();
  }
  setProfile(profile: ProfileKey) {
    this.emit({ profile });
    this.replan();
  }
  setLang(lang: 'tr' | 'en') {
    this.emit({ lang });
    this.replan();
  }
  setStart(start: Start) {
    if (this.state.phase !== 'plan') return;
    this.emit({ start });
    this.replan();
  }
  setDest(dest: string | null) {
    if (this.state.phase !== 'plan') return;
    this.emit({ dest });
    this.replan();
  }
  setSpeed(speed: number) {
    this.emit({ speed });
  }
  setVoice(voice: boolean) {
    if (!voice) this.stopAudio();
    this.emit({ voice });
  }
  begin() {
    const plan = this.state.plan;
    if (!plan || this.state.phase !== 'plan') return;
    this.stopAudio();
    this.walker = createWalker(plan.geometry.line);
    this.walkerDone = false;
    this.truth = plan.geometry.line[0]!;
    this.emit({ phase: 'active', ...tracking(), position: plan.geometry.line[0]! });
    this.log('info', `Yürüyüş başladı: ${PROFILE_LABEL[this.state.profile]}, ${Math.round(plan.route.lengthM)} m`);
    this.startTimer();
  }
  pause() {
    this.stopTimer();
    this.emit({ running: false });
  }
  resume() {
    if (this.state.phase === 'active') this.startTimer();
  }
  /** Yürüyüşü bitirir; plan aşamasına döner (kayıt korunur). */
  stop() {
    this.stopTimer();
    this.stopAudio();
    this.walker = null;
    const log = this.state.log;
    this.emit({ phase: 'plan', ...tracking(), log });
    this.replan();
  }
  /** Senaryo: önümüzdeki yol kapandı (onaylı erişilebilirlik bildirimi gibi). Uygulanamazsa kayda yazar. */
  blockAhead() {
    const plan = this.state.plan;
    if (!plan || this.state.phase !== 'active' || !this.truth) return;
    const ahead = this.planner.blockableAhead(plan, this.state.distance);
    if (!ahead) {
      this.log('info', 'Önde kapatılacak yol yok (varışa çok yakın).');
      return;
    }
    this.log('blocked', 'Önümüzdeki yol kapatıldı');
    this.reroute('blocked', [...this.state.blocked, ahead.segmentId], this.truth);
  }
  /** Senaryo: yürüyüşçü önündeki kavşakta dönmeyi kaçırıp düz devam eder. Uygulanamazsa kayda yazar. */
  wrongTurn() {
    const plan = this.state.plan;
    if (!plan || !this.walker || this.state.phase !== 'active' || this.state.detouring) return;
    const detour = this.planner.detourFrom(plan, this.state.distance, new Set(this.state.blocked));
    if (!detour) {
      this.log('info', 'Önde sapılabilecek kavşak yok; biraz ilerleyip yeniden deneyin.');
      return;
    }
    this.walker = walkerOnLine(this.walker, detour.line);
    this.walkerDone = false;
    this.emit({ detouring: true, detourLine: detour.line });
    this.log('detour', 'Yanlış dönüş: yürüyüşçü kavşakta dönmeyip rotadan ayrıldı');
    if (!this.timer) this.startTimer();
  }
  closePoint() {
    this.stopAudio();
    this.emit({ openPoint: null });
  }
  dispose() {
    this.stopTimer();
    this.stopAudio();
  }
}

// ---------- Veri ----------

/** nav_points_view satırı → planlayıcının nokta modeli. */
export function toNavPoint(r: PointRow): NavPoint {
  return {
    id: r.id,
    citySlug: r.city_slug,
    roles: r.roles,
    title: r.title,
    body: r.body ?? undefined,
    location: [r.lng, r.lat],
    radiusM: r.radius_m,
    workSlug: r.work_slug ?? undefined,
    salience: r.salience ?? undefined,
    ambient: r.ambient ?? undefined,
    cue: r.cue ?? undefined,
    sortOrder: r.sort_order,
    audio: { tr: r.audio_tr ?? undefined, en: r.audio_en ?? undefined },
  };
}

/** Planlayıcıya her uygulamada artan sayaç (pilotPlanner modül düzeyinde paylaşılır). */
let plannerVersion = 0;
const plannerListeners = new Set<() => void>();
/** Planlayıcıya en son uygulanan nokta listesi (hazır mı denetimi için). */
let appliedPoints: readonly NavPoint[] | null = null;
const subscribePlanner = (l: () => void) => {
  plannerListeners.add(l);
  return () => plannerListeners.delete(l);
};

/**
 * Planlayıcıya pilot ilin noktalarını ve onaylı bildirimleri uygular (mobil uygulamayla aynı mesafeler için).
 * `includeDrafts`: taslak noktalar da rotaya girer (yayına almadan önce denemek için); arşivdekiler hiç girmez.
 * `version` her uygulamada artar: planlayıcıdan hesaplanan değerler buna bağlanır.
 */
export function usePilotPlanner(includeDrafts: boolean) {
  const { data: rows, isLoading, error } = usePoints(PILOT_CITY);
  const { data: overrides, isLoading: overridesLoading } = useQuery({
    queryKey: ['segment_overrides', pilotPlanner.area],
    queryFn: async () => {
      const { data, error: e } = await supabase.from('segment_overrides').select('segment_key, type').eq('area', pilotPlanner.area);
      if (e) throw e;
      return (data ?? []) as { segment_key: string; type: OverrideType }[];
    },
  });

  const points = useMemo(
    () => (rows ?? []).filter((r) => r.status === 'verified' || (includeDrafts && r.status === 'draft')).map(toNavPoint),
    [rows, includeDrafts],
  );

  const version = useSyncExternalStore(subscribePlanner, () => plannerVersion);
  useEffect(() => {
    pilotPlanner.setOverrides(overrides ?? []);
    pilotPlanner.setNavPoints(points);
    appliedPoints = points;
    plannerVersion += 1;
    plannerListeners.forEach((l) => l());
  }, [points, overrides]);

  // Noktalar ve yol düzeltmeleri gelip planlayıcıya uygulanmadan hesaplanan mesafe yanlış başlangıçtan olur
  // (varsayılan başlangıç noktası yerine grafiğin merkezi).
  const ready = !!rows && !!overrides && appliedPoints === points;
  return { points, overrides: overrides ?? [], version, ready, isLoading: isLoading || overridesLoading, error };
}

export function useRouteTest(includeDrafts: boolean) {
  const [test] = useState(() => new RouteTest(pilotPlanner));
  const state = useSyncExternalStore(test.subscribe, test.getState);
  const { points, overrides, isLoading, error } = usePilotPlanner(includeDrafts);

  useEffect(() => {
    test.setPoints(points);
  }, [points, test]);

  useEffect(() => () => test.dispose(), [test]);

  return { test, state, points, overrides, isLoading, error };
}
