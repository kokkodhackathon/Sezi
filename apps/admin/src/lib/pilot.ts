// Pilot alan grafikleri: mobil uygulamayla aynı dosya (tek kaynak, data/build_nav_graph.py üretir).
import { createPlanner, type PilotGraphData } from '@sezi/shared';

import bursaHanlar from '../../../mobile/assets/pilot/bursa-hanlar-nav.json';

interface PilotGraph {
  name: { tr: string; en?: string };
  center: [number, number];
  segments: { id: string; geometry?: [number, number][]; lengthM: number; steps: number }[];
  /** Eser düğümleri `workSlug` taşır (turlar ve pano kapsamı bunlardan). */
  nodes: { id: string; name: { tr: string; en?: string }; workSlug?: string; workType?: string }[];
}

export const PILOT_AREAS: Record<string, PilotGraph> = {
  'bursa-hanlar': bursaHanlar as unknown as PilotGraph,
};

/** Bildirilen yol parçasının çizgisi (bulunamazsa null). */
export function segmentGeometry(area: string | null, key: string | null): [number, number][] | null {
  if (!area || !key) return null;
  const seg = PILOT_AREAS[area]?.segments.find((s) => s.id === key);
  return seg?.geometry ?? null;
}

/** Rota testi: mobil uygulamayla aynı planlayıcı ve aynı gömülü grafik (Bursa Ulu Cami ve Hanlar Bölgesi). */
export const pilotPlanner = createPlanner(bursaHanlar as unknown as PilotGraphData);
/** Pilot alanın ili (noktalar bu ilden okunur). */
export const PILOT_CITY = 'bursa';
