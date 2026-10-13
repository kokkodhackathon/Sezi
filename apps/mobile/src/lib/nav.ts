import {
  buildDetour,
  buildGuidance,
  distanceM,
  findRoute,
  NavSegment,
  routeGeometry,
  segmentAhead,
  withLeadIn,
  type GuidanceStep,
  type LngLat,
  type NavNode,
  type Route,
  type RouteGeometry,
  type UserProfile,
} from '@sezi/shared';

// Pilot grafiği uygulamaya gömülü: rota hesabı ve rehberlik internetsiz çalışır.
import raw from '../../assets/pilot/bursa-hanlar-nav.json';

type PilotNode = NavNode & { workSlug?: string; workType?: string };

const nodes = new Map<string, PilotNode>((raw.nodes as PilotNode[]).map((n) => [n.id, n]));
const segments = (raw.segments as unknown[]).map((s) => NavSegment.parse(s));
const segMap = new Map(segments.map((s) => [s.id, s]));

/** Simülasyon başlangıcı: Atatürk Caddesi'ndeki T1 Ulucami tramvay durağı (bölgeye en yaygın varış noktası). */
const DEFAULT_START: LngLat = [29.0620479, 40.1834979];

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
}

export interface PlanOptions {
  /** Kapalı segmentler (onaylı bildirim ya da simülasyondaki yol kapatma). */
  blocked?: ReadonlySet<string>;
  /** Rotayı tam bu noktadan başlat: noktadan en yakın düğüme bağlantı eklenir (yeniden rota). */
  leadIn?: boolean;
}

/** Kapalı segmentler işaretlenmiş graf (yoksa orijinali). */
function segmentsWith(blocked?: ReadonlySet<string>): NavSegment[] {
  if (!blocked || blocked.size === 0) return segments;
  return segments.map((s) => (blocked.has(s.id) ? { ...s, blocked: true } : s));
}

export function planRoute(destSlug: string, profile: UserProfile, from: LngLat = DEFAULT_START, opts: PlanOptions = {}): PlannedRoute | null {
  const end = landmarkNodeForWork(destSlug);
  if (!end) return null;
  const start = nearestNode(from);
  const route = findRoute(segmentsWith(opts.blocked), profile, start.id, end.id);
  if (!route) return null;
  let geometry = routeGeometry(route, nodes, segMap);
  let steps = buildGuidance(route, nodes, [], profile, geometry, segMap);
  if (opts.leadIn) ({ geometry, steps } = withLeadIn(geometry, steps, from));
  return {
    route,
    geometry,
    steps,
    start,
    end,
    stairSegments: route.segmentIds.filter((id) => (segMap.get(id)?.steps ?? 0) > 0).length,
    passedLandmarks: route.nodeIds.slice(1, -1).map((id) => nodes.get(id)!).filter((n) => n.lynchType === 'landmark'),
  };
}

const nodeLocations = new Map([...nodes.values()].map((n) => [n.id, n.location]));

/** Yanlış dönüş senaryosu: önümüzdeki ilk kavşakta rotadan ayrılan yürüyüş çizgisi. */
export function detourFrom(plan: PlannedRoute, alongM: number, blocked?: ReadonlySet<string>) {
  return buildDetour(plan.route, plan.geometry, segmentsWith(blocked), nodeLocations, alongM);
}

/** Yol kapatma senaryosu: kullanıcının önündeki ilk rota segmenti. */
export function blockableAhead(plan: PlannedRoute, alongM: number) {
  return segmentAhead(plan.route, plan.geometry, alongM);
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
  const r = findRoute(segments, profile, fromId, toId);
  if (!r) return null;
  return { lengthM: r.lengthM, stairs: r.segmentIds.filter((id) => (segMap.get(id)?.steps ?? 0) > 0).length };
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
    const seg = segMap.get(id);
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
