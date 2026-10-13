import { distanceM, type UserProfile } from '@sezi/shared';

import { DEFAULT_START_POINT, legBetween, nearestNode, pilotLandmarks } from './nav';

/**
 * Turlar doğrulanmış eserlerden ve gerçek yol grafiğinden hesaplanır (yazılmış içerik yok).
 * Sıra: başlangıçtan en yakın komşu sezgisi.
 */
export interface TourDef {
  id: string;
  /** i18n anahtar öneki: tours.<id>.title / .body */
  types: string[] | null;
}

export const TOURS: TourDef[] = [
  { id: 'tum', types: null },
  { id: 'hanlar', types: ['han', 'bedesten', 'carsi'] },
  { id: 'camiler', types: ['cami', 'mescit', 'turbe'] },
  { id: 'su', types: ['cesme', 'sebil', 'hamam'] },
];

export interface TourStop {
  slug: string;
  name: { tr: string; en?: string };
  type: string;
  /** Bir önceki duraktan yürüme mesafesi (m). */
  legM: number;
  legStairs: number;
}

export interface PlannedTour {
  id: string;
  stops: TourStop[];
  lengthM: number;
  stairs: number;
}

export function planTour(id: string, profile: UserProfile): PlannedTour | null {
  const def = TOURS.find((t) => t.id === id);
  if (!def) return null;
  const pool = pilotLandmarks.filter((n) => n.workSlug && (!def.types || def.types.includes(n.workType ?? '')));
  if (pool.length === 0) return null;

  const stops: TourStop[] = [];
  let current = nearestNode(DEFAULT_START_POINT);
  const left = [...pool];
  while (left.length) {
    left.sort((a, b) => distanceM(current.location, a.location) - distanceM(current.location, b.location));
    const next = left.shift()!;
    const leg = legBetween(current.id, next.id, profile);
    if (!leg) continue; // bu profil için ulaşılamayan durak atlanır
    stops.push({ slug: next.workSlug!, name: next.name as TourStop['name'], type: next.workType ?? '', legM: leg.lengthM, legStairs: leg.stairs });
    current = next;
  }
  return {
    id,
    stops,
    lengthM: stops.reduce((s, x) => s + x.legM, 0),
    stairs: stops.reduce((s, x) => s + x.legStairs, 0),
  };
}
