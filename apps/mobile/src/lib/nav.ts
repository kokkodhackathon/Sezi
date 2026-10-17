import { createPlanner } from '@sezi/shared';
import { useSyncExternalStore } from 'react';

// Pilot grafiği uygulamaya gömülü: rota hesabı ve rehberlik internetsiz çalışır.
// Grafik yalnızca yol ağı ve eserlerdir; başlangıç, yer işareti ve anlatım noktaları admin panelinden gelir (setNavPoints).
// Planlayıcının kendisi ortak pakette (shared/planner.ts): admin panelindeki rota testi aynı rotayı çizer.
import raw from '../../assets/pilot/bursa-hanlar-nav.json';

export { boundsOf, formatDistance, walkingSpeed, type OverrideType, type PilotNode, type PlannedRoute, type PlanOptions, type StartPoint } from '@sezi/shared';

export const planner = createPlanner(raw);

export const {
  area: PILOT_AREA,
  pilotWorks,
  setNavPoints,
  setOverrides,
  startPoints,
  defaultStart,
  startLocation,
  nearestNode,
  landmarkNodeForWork,
  hasRouteTo,
  inPilotArea,
  landmarkNodes,
  planRoute,
  planStroll,
  blockableAhead,
  detourFrom,
  legBetween,
  nearestSegmentId,
  routeStats,
} = planner;

/** Rota hesaplayan ekranlar bu sürümü useMemo bağımlılığına ekler: nokta ya da bildirim değişince plan yenilenir. */
export function useNavVersion(): number {
  return useSyncExternalStore(planner.subscribe, planner.version);
}

export function useStartPoints() {
  useNavVersion();
  return planner.startPoints();
}

/** Segmentlerin çizgileri (haritada kapalı yolları göstermek için). */
export function segmentLines(ids: readonly string[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: ids.flatMap((id) => {
      const coordinates = planner.segmentCoords(id);
      return coordinates ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates } }] : [];
    }),
  };
}
