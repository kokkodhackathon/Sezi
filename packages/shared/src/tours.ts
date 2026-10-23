import { z } from "zod";

import { distanceM } from "./geo";
import type { Planner } from "./planner";
import { LocalizedText, type LngLat, type UserProfile } from "./schemas";

/**
 * Tur: admin panelinden girilen durak listesi (tours tablosu; kodda sabit tur yok).
 * Sıra varsayılan olarak başlangıç noktasından en yakın komşuyla hesaplanır; admin isterse sırayı sabitler.
 * Profile ulaşılamayan durak atlanır.
 */
export interface Tour {
  slug: string;
  citySlug: string;
  title: LocalizedText;
  body: LocalizedText | null;
  /** Eser slug'ları; fixedOrder false iken yalnız durak kümesidir. */
  stops: string[];
  fixedOrder: boolean;
  sortOrder: number;
}

export const TOUR_COLUMNS = "slug, city_slug, title, body, stops, fixed_order, sort_order";

export const TourRow = z.object({
  slug: z.string(),
  city_slug: z.string(),
  title: LocalizedText,
  body: LocalizedText.nullable(),
  stops: z.array(z.string()).min(1),
  fixed_order: z.boolean(),
  sort_order: z.number(),
});
export type TourRow = z.infer<typeof TourRow>;

/** Geçersiz satır atlanır; sıra: sort_order, sonra Türkçe başlık. */
export function toTours(rows: unknown[]): Tour[] {
  return rows
    .flatMap((r) => {
      const p = TourRow.safeParse(r);
      if (!p.success) return [];
      const d = p.data;
      return [{ slug: d.slug, citySlug: d.city_slug, title: d.title, body: d.body, stops: d.stops, fixedOrder: d.fixed_order, sortOrder: d.sort_order }];
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.tr.localeCompare(b.title.tr, "tr"));
}

export interface TourStop {
  slug: string;
  name: LocalizedText;
  type: string;
  /** Bir önceki duraktan yürüme mesafesi (m). */
  legM: number;
  legStairs: number;
}

export interface PlannedTour {
  slug: string;
  stops: TourStop[];
  lengthM: number;
  stairs: number;
}

export function planTour(planner: Planner, tour: Tour, profile: UserProfile, from: LngLat = planner.defaultStart()): PlannedTour | null {
  const bySlug = new Map(planner.pilotWorks.map((n) => [n.workSlug, n]));
  const pool = tour.stops.flatMap((s) => {
    const n = bySlug.get(s);
    return n ? [n] : []; // grafikte olmayan eser atlanır
  });
  if (pool.length === 0) return null;

  const stops: TourStop[] = [];
  let current = planner.nearestNode(from);
  const left = [...pool];
  while (left.length) {
    if (!tour.fixedOrder) left.sort((a, b) => distanceM(current.location, a.location) - distanceM(current.location, b.location));
    const next = left.shift()!;
    const leg = planner.legBetween(current.id, next.id, profile);
    if (!leg) continue; // bu profil için ulaşılamayan durak atlanır
    stops.push({ slug: next.workSlug!, name: next.name ?? { tr: next.workSlug! }, type: next.workType ?? "", legM: leg.lengthM, legStairs: leg.stairs });
    current = next;
  }
  return {
    slug: tour.slug,
    stops,
    lengthM: stops.reduce((s, x) => s + x.legM, 0),
    stairs: stops.reduce((s, x) => s + x.legStairs, 0),
  };
}
