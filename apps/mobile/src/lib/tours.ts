import { distanceM, inTour, TOURS, type LngLat, type UserProfile } from '@sezi/shared';

import { defaultStart, legBetween, nearestNode, pilotWorks } from './nav';

/**
 * Turlar doğrulanmış eserlerden ve gerçek yol grafiğinden hesaplanır (yazılmış içerik yok).
 * Tanımlar `@sezi/shared` (TOURS); sıra: başlangıçtan en yakın komşu sezgisi.
 */
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

export function planTour(id: string, profile: UserProfile, from: LngLat = defaultStart()): PlannedTour | null {
  const def = TOURS.find((t) => t.id === id);
  if (!def) return null;
  const pool = pilotWorks.filter((n) => inTour(def, n.workType));
  if (pool.length === 0) return null;

  const stops: TourStop[] = [];
  let current = nearestNode(from);
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
