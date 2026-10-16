import {
  buildDetour,
  buildGuidance,
  CuratedRoute,
  curatedGuidance,
  distanceM,
  findRoute,
  matchCurated,
  NavSegment,
  routeGeometry,
  routeOverlap,
  routeVia,
  segmentAhead,
  withLeadIn,
  type GuidanceStep,
  type LngLat,
  type LocalizedText,
  type NavNode,
  type Route,
  type RouteGeometry,
  type UserProfile,
} from '@sezi/shared';

import { useSyncExternalStore } from 'react';
import { z } from 'zod';

// Pilot grafiği uygulamaya gömülü: rota hesabı ve rehberlik internetsiz çalışır.
import raw from '../../assets/pilot/bursa-hanlar-nav.json';

type PilotNode = NavNode & {
  workSlug?: string;
  workType?: string;
  /** Ekibin seçtiği Lynch noktası (data/lynch): buluşma/varış ya da eser dışı yer işareti. */
  pointId?: string;
  roles?: ('gathering' | 'landmark')[];
  /** Ortam sesi (ses manzarası): su, çarşı uğultusu… */
  sound?: 'water' | 'market' | 'chime';
};

/** Başlangıç seçeneği: insanların buluştuğu ya da toplu taşımadan indiği yer ("Neredesiniz?"). */
export interface StartPoint {
  id: string;
  nodeId: string;
  name: { tr: string; en?: string };
  location: LngLat;
}

const nodes = new Map<string, PilotNode>((raw.nodes as PilotNode[]).map((n) => [n.id, n]));
const segments = (raw.segments as unknown[]).map((s) => NavSegment.parse(s));
const segMap = new Map(segments.map((s) => [s.id, s]));

/** Pilot alanın kimliği (bildirimler ve onaylı etkiler bununla eşleşir). */
export const PILOT_AREA: string = raw.area;

// ---------- Onaylı erişilebilirlik bildirimleri ----------
// Admin panelinde onaylanan bildirim (segment_overrides) yol parçasının özelliğini değiştirir;
// rota motoru değişmez, yalnızca grafiğin o parçası güncellenir. Kural veritabanı tetikleyicisiyle aynı.
export type OverrideType = 'stairs' | 'ramp_blocked' | 'narrow_path' | 'surface_damage' | 'construction' | 'other';

let effective: NavSegment[] = segments;
let effMap = segMap;
let version = 0;
const versionListeners = new Set<() => void>();

function applyOverride(s: NavSegment, types: Set<OverrideType>): NavSegment {
  let next = s;
  if (types.has('stairs')) next = { ...next, steps: Math.max(next.steps, 1) };
  if (types.has('ramp_blocked') || types.has('construction')) next = { ...next, blocked: true };
  if (types.has('narrow_path')) next = { ...next, widthCm: Math.min(next.widthCm ?? 80, 60) };
  if (types.has('surface_damage')) next = { ...next, surface: 'gravel' };
  return next;
}

/** Sunucudan gelen onaylı etkileri grafiğe uygular; değişiklik varsa rotalar yeniden hesaplanır. */
export function setOverrides(list: { segment_key: string; type: OverrideType }[]) {
  const by = new Map<string, Set<OverrideType>>();
  for (const o of list) by.set(o.segment_key, (by.get(o.segment_key) ?? new Set()).add(o.type));
  effective = by.size ? segments.map((s) => (by.has(s.id) ? applyOverride(s, by.get(s.id)!) : s)) : segments;
  effMap = new Map(effective.map((s) => [s.id, s]));
  version++;
  versionListeners.forEach((l) => l());
}

/** Rota hesaplayan ekranlar bu sürümü useMemo bağımlılığına ekler: onay gelince plan yenilenir. */
export function useNavVersion(): number {
  return useSyncExternalStore(
    (l) => {
      versionListeners.add(l);
      return () => versionListeners.delete(l);
    },
    () => version,
  );
}
export const navVersion = () => version;

// ---------- Altın rotalar ----------
// Ekibin elle yazdığı onaylı Lynch tarifleri (data/lynch/routes): başlangıç ve varış eşleşirse motorun yerine geçer.
const curatedRoutes = z.object({ curatedRoutes: z.array(CuratedRoute).default([]) }).parse(raw).curatedRoutes;
let preferCurated = true;

/** Geliştirici karşılaştırması: altın rota yerine motorun tarifini göster (oturumlar yeniden açılır). */
export function setPreferCurated(v: boolean) {
  if (v === preferCurated) return;
  preferCurated = v;
  version++;
  versionListeners.forEach((l) => l());
}
export const prefersCurated = () => preferCurated;

/** Bu başlangıç ve varış için onaylı altın rota var mı (profil kısıtına bakmadan). */
export function hasCuratedRoute(startId: string, endId: string): boolean {
  return curatedRoutes.some((r) => r.status === 'verified' && r.nodeIds[0] === startId && r.nodeIds.at(-1) === endId);
}

/** Pilot alanın başlangıç seçenekleri (data/lynch'te seçilmiş buluşma/varış noktaları). */
export const START_POINTS: StartPoint[] = (raw as unknown as { starts?: StartPoint[] }).starts ?? [];
/** Varsayılan başlangıç: T1 Ulucami tramvay durağı (bölgeye en yaygın varış); yoksa listedeki ilk nokta. */
export const DEFAULT_START_ID = START_POINTS.some((p) => p.id === 't1-ulucami') ? 't1-ulucami' : (START_POINTS[0]?.id ?? '');
const DEFAULT_START: LngLat = START_POINTS.find((p) => p.id === DEFAULT_START_ID)?.location ?? [29.0620479, 40.1834979];

/** Kimliği verilen başlangıcın konumu (bilinmeyen kimlikte varsayılan). */
export function startLocation(id: string | undefined): LngLat {
  return START_POINTS.find((p) => p.id === id)?.location ?? DEFAULT_START;
}

export function nearestNode(p: LngLat): PilotNode {
  let best: PilotNode | undefined;
  let bestD = Infinity;
  for (const n of nodes.values()) {
    const d = distanceM(p, n.location);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best!;
}

export function landmarkNodeForWork(slug: string): PilotNode | undefined {
  for (const n of nodes.values()) if (n.workSlug === slug) return n;
  return undefined;
}

export function hasRouteTo(slug: string): boolean {
  return landmarkNodeForWork(slug) !== undefined;
}

export interface PlannedRoute {
  route: Route;
  geometry: RouteGeometry;
  steps: GuidanceStep[];
  start: PilotNode;
  end: PilotNode;
  /** Rotadaki basamaklı segment sayısı (profil açıklaması için). */
  stairSegments: number;
  /** Rota boyunca geçilen landmark'lar (başlangıç ve varış hariç). */
  passedLandmarks: PilotNode[];
  /** Tarif ekibin onaylı altın rotasından geliyorsa kimliği ve onay bilgisi. */
  curated?: { id: string; name: LocalizedText; verifiedBy?: string; verifiedAt?: string };
  /** Altın rota kullanıldıysa motorun aynı yolculuk için ürettiği rota (fark raporu). */
  engine?: { overlap: number; lengthM: number; turnSteps: number };
  /** Rota anlatım noktalarından geçiyorsa: geçilen nokta kimlikleri ve uzama (m). */
  via?: { storyIds: string[]; extraM: number };
}

export interface PlanOptions {
  /** Kapalı segmentler (onaylı bildirim ya da simülasyondaki yol kapatma). */
  blocked?: ReadonlySet<string>;
  /** Rotayı tam bu noktadan başlat: noktadan en yakın düğüme bağlantı eklenir (yeniden rota). */
  leadIn?: boolean;
  /** Yol üstünde uğranabilecek anlatım noktaları. */
  via?: readonly { id: string; location: LngLat }[];
}

/** Anlatım noktasının grafiğe bağlanacağı en uzak düğüm (m). */
const STORY_SNAP_M = 40;
/** Konum en yakın düğüme bundan yakınsa pilot alanın içinde sayılır (m). */
export const PILOT_REACH_M = 150;

/** Konum pilot grafiğin kapsadığı alanda mı (rota yalnızca burada çizilir). */
export function inPilotArea(p: LngLat): boolean {
  return distanceM(p, nearestNode(p).location) <= PILOT_REACH_M;
}

const nodeLocations = new Map([...nodes.values()].map((n) => [n.id, n.location]));

/** Kapalı segmentler işaretlenmiş graf (onaylı bildirimler zaten uygulanmış). */
function segmentsWith(blocked?: ReadonlySet<string>): NavSegment[] {
  if (!blocked || blocked.size === 0) return effective;
  return effective.map((s) => (blocked.has(s.id) ? { ...s, blocked: true } : s));
}

export function planRoute(destSlug: string, profile: UserProfile, from: LngLat = DEFAULT_START, opts: PlanOptions = {}): PlannedRoute | null {
  const end = landmarkNodeForWork(destSlug);
  if (!end) return null;
  const start = nearestNode(from);
  const segs = segmentsWith(opts.blocked);
  // Uğrayan rota: yol üstündeki anlatım noktaları en yakın düğümlerine bağlanır, rota sınırlı bütçeyle uzatılır.
  let viaRoute: { route: Route; storyIds: string[]; extraM: number } | null = null;
  if (opts.via?.length) {
    const nodeToStories = new Map<string, string[]>();
    for (const p of opts.via) {
      const n = nearestNode(p.location);
      if (n.id === start.id || n.id === end.id || distanceM(n.location, p.location) > STORY_SNAP_M) continue;
      nodeToStories.set(n.id, [...(nodeToStories.get(n.id) ?? []), p.id]);
    }
    const v = nodeToStories.size > 0 ? routeVia(segs, profile, start.id, end.id, [...nodeToStories.keys()], nodeLocations) : null;
    if (v && v.via.length > 0) {
      viaRoute = { route: v.route, storyIds: v.via.flatMap((id) => nodeToStories.get(id)!), extraM: Math.round(v.route.lengthM - v.baseLengthM) };
    }
  }
  // Altın rota profile uymuyorsa ya da yolu kapalıysa motor devralır. Uğrayan rotada altın rota kullanılmaz.
  const match = preferCurated && !viaRoute ? matchCurated(curatedRoutes, segs === effective ? effMap : new Map(segs.map((s) => [s.id, s])), profile, start.id, end.id) : null;
  const engineRoute = viaRoute ? viaRoute.route : findRoute(segs, profile, start.id, end.id);
  const route = match?.route ?? engineRoute;
  if (!route) return null;
  let geometry = routeGeometry(route, nodes, segMap);
  let steps = match ? curatedGuidance(match.def, route, nodes, profile, geometry) : buildGuidance(route, nodes, [], profile, geometry, segMap);
  let engine: PlannedRoute['engine'];
  if (match && engineRoute) {
    const engineSteps = buildGuidance(engineRoute, nodes, [], profile, routeGeometry(engineRoute, nodes, segMap), segMap);
    engine = { overlap: routeOverlap(route, engineRoute, segMap), lengthM: engineRoute.lengthM, turnSteps: engineSteps.filter((s) => s.kind === 'turn').length };
  }
  if (opts.leadIn) ({ geometry, steps } = withLeadIn(geometry, steps, from));
  return {
    route,
    geometry,
    steps,
    start,
    end,
    stairSegments: route.segmentIds.filter((id) => (effMap.get(id)?.steps ?? 0) > 0).length,
    passedLandmarks: [...new Set(route.nodeIds.slice(1, -1))].map((id) => nodes.get(id)!).filter((n) => n.lynchType === 'landmark'),
    curated: match ? { id: match.def.id, name: match.def.name, verifiedBy: match.def.verifiedBy, verifiedAt: match.def.verifiedAt } : undefined,
    engine,
    via: viaRoute ? { storyIds: viaRoute.storyIds, extraM: viaRoute.extraM } : undefined,
  };
}

/** Yanlış dönüş senaryosu: önümüzdeki ilk kavşakta rotadan ayrılan yürüyüş çizgisi. */
export function detourFrom(plan: PlannedRoute, alongM: number, blocked?: ReadonlySet<string>) {
  return buildDetour(plan.route, plan.geometry, segmentsWith(blocked), nodeLocations, alongM);
}

/** Yol kapatma senaryosu: kullanıcının önündeki ilk rota segmenti. */
export function blockableAhead(plan: PlannedRoute, alongM: number) {
  return segmentAhead(plan.route, plan.geometry, alongM);
}

/** Mesafe metni: 1 km altı metre, üstü tek ondalıklı kilometre (TR'de virgülle). */
export function formatDistance(m: number, lang: 'tr' | 'en'): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', { maximumFractionDigits: 1 })} km`;
}

/** Profile göre yürüme hızı (m/sn); süre tahmini ve simülasyon için. */
export function walkingSpeed(profile: UserProfile): number {
  if (profile.mobility === 'wheelchair') return 0.9;
  if (profile.mobility === 'cane' || profile.vision === 'blind') return 0.8;
  return 1.2;
}

export function boundsOf(line: LngLat[]): [number, number, number, number] {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of line) {
    w = Math.min(w, x);
    s = Math.min(s, y);
    e = Math.max(e, x);
    n = Math.max(n, y);
  }
  return [w, s, e, n];
}

export const pilotLandmarks = [...nodes.values()].filter((n) => n.lynchType === 'landmark');

/** İki düğüm arası rota uzunluğu ve basamak sayısı (tur planlama için). */
export function legBetween(fromId: string, toId: string, profile: UserProfile): { lengthM: number; stairs: number } | null {
  const r = findRoute(effective, profile, fromId, toId);
  if (!r) return null;
  return { lengthM: r.lengthM, stairs: r.segmentIds.filter((id) => (effMap.get(id)?.steps ?? 0) > 0).length };
}

/** Bir esere en yakın yol segmenti (erişilebilirlik bildirimi bu segmente bağlanır). */
export function nearestSegmentId(p: LngLat): string {
  let best = segments[0]!.id;
  let bestD = Infinity;
  for (const s of segments) {
    const pts = s.geometry ?? [nodes.get(s.from)!.location, nodes.get(s.to)!.location];
    for (const q of pts) {
      const d = distanceM(p, q);
      if (d < bestD) {
        bestD = d;
        best = s.id;
      }
    }
  }
  return best;
}

/** Rotanın erişilebilirlik özeti: profil karşılaştırmasında gösterilir. */
export function routeStats(plan: PlannedRoute) {
  let busyM = 0;
  let cobbleM = 0;
  for (const id of plan.route.segmentIds) {
    const seg = effMap.get(id);
    if (!seg) continue;
    if (seg.noise >= 0.6) busyM += seg.lengthM;
    if (seg.surface === 'cobble') cobbleM += seg.lengthM;
  }
  return { lengthM: plan.route.lengthM, stairs: plan.stairSegments, busyM: Math.round(busyM), cobbleM: Math.round(cobbleM) };
}

/** Segmentlerin çizgileri (haritada kapalı yolları göstermek için). */
export function segmentLines(ids: readonly string[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: ids.flatMap((id) => {
      const seg = segMap.get(id);
      if (!seg) return [];
      const coordinates = seg.geometry ?? [nodes.get(seg.from)!.location, nodes.get(seg.to)!.location];
      return [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates } }];
    }),
  };
}

export const DEFAULT_START_POINT = DEFAULT_START;
export type LngLatLike = LngLat;
