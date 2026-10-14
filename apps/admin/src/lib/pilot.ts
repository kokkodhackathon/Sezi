// Pilot alan grafikleri: mobil uygulamayla aynı dosya (tek kaynak, data/build_nav_graph.py üretir).
import bursaHanlar from '../../../mobile/assets/pilot/bursa-hanlar-nav.json';

interface PilotGraph {
  name: { tr: string; en?: string };
  center: [number, number];
  segments: { id: string; geometry?: [number, number][]; lengthM: number; steps: number }[];
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
