import {
  buildGuidance,
  distanceM,
  findRoute,
  NavSegment,
  routeGeometry,
  type GuidanceStep,
  type LngLat,
  type NavNode,
  type Route,
  type RouteGeometry,
  type UserProfile,
} from '@sezi/shared';

// Pilot grafiği uygulamaya gömülü: rota hesabı ve rehberlik internetsiz çalışır.
import raw from '../../assets/pilot/suleymaniye-nav.json';

type PilotNode = NavNode & { workSlug?: string; workType?: string };

const nodes = new Map<string, PilotNode>((raw.nodes as PilotNode[]).map((n) => [n.id, n]));
const segments = (raw.segments as unknown[]).map((s) => NavSegment.parse(s));
const segMap = new Map(segments.map((s) => [s.id, s]));

/** Simülasyon başlangıcı: külliyenin güneyindeki üniversite kapısı önü (Süleymaniye Caddesi). */
const DEFAULT_START: LngLat = [28.964014, 41.015038];

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

export function planRoute(destSlug: string, profile: UserProfile, from: LngLat = DEFAULT_START): PlannedRoute | null {
  const end = landmarkNodeForWork(destSlug);
  if (!end) return null;
  const start = nearestNode(from);
  const route = findRoute(segments, profile, start.id, end.id);
  if (!route) return null;
  const geometry = routeGeometry(route, nodes, segMap);
  const steps = buildGuidance(route, nodes, [], profile, geometry);
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
