import { z } from "zod";

import type { PilotNode, Planner } from "./planner";
import { LocalizedText, type LngLat, type UserProfile } from "./schemas";

/**
 * Tur: admin panelinden girilen durak listesi (tours tablosu; kodda sabit tur yok).
 * Sıra varsayılan olarak gerçek yol mesafesiyle en kısa yürüyüştür: en yakın komşuyla başlanır, sonra 2-opt
 * ile kısaltılır (git-gel yapan sıralar düzelir). Admin isterse sırayı sabitler. Profile ulaşılamayan durak atlanır.
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
  const pool = [...new Set(tour.stops)].flatMap((s) => {
    const n = bySlug.get(s);
    return n ? [n] : []; // grafikte olmayan eser atlanır
  });
  if (pool.length === 0) return null;
  const start = planner.nearestNode(from);

  // Gerçek yol mesafeleri (yol simetrik: her çift bir kez hesaplanır); ulaşılamayan çift sonsuz.
  const legs = new Map<string, { lengthM: number; stairs: number } | null>();
  const leg = (a: PilotNode, b: PilotNode) => {
    const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
    if (!legs.has(key)) legs.set(key, planner.legBetween(a.id, b.id, profile));
    return legs.get(key)!;
  };
  const d = (a: PilotNode, b: PilotNode) => leg(a, b)?.lengthM ?? Infinity;

  // Başlangıçtan ulaşılamayan durak bu profil için atlanır.
  const reachable = pool.filter((n) => leg(start, n) !== null);
  const order = tour.fixedOrder ? reachable : shortestOrder(start, reachable, d);

  const stops: TourStop[] = [];
  let current = start;
  for (const next of order) {
    const l = leg(current, next);
    if (!l) continue; // sabit sırada ara bacak kopuksa durak atlanır
    stops.push({ slug: next.workSlug!, name: next.name ?? { tr: next.workSlug! }, type: next.workType ?? "", legM: l.lengthM, legStairs: l.stairs });
    current = next;
  }
  return {
    slug: tour.slug,
    stops,
    lengthM: stops.reduce((s, x) => s + x.legM, 0),
    stairs: stops.reduce((s, x) => s + x.legStairs, 0),
  };
}

/** Başlangıcı sabit açık yol: en yakın komşu, sonra 2-opt (bir aralığı ters çevirmek yolu kısaltıyorsa çevir). */
function shortestOrder<T>(start: T, stops: readonly T[], d: (a: T, b: T) => number): T[] {
  const left = [...stops];
  const order: T[] = [];
  let cur = start;
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) if (d(cur, left[i]!) < d(cur, left[best]!)) best = i;
    cur = left.splice(best, 1)[0]!;
    order.push(cur);
  }
  const at = (i: number) => (i < 0 ? start : order[i]!);
  for (let improved = true; improved; ) {
    improved = false;
    for (let i = 0; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const after = j + 1 < order.length ? order[j + 1]! : undefined;
        const before = d(at(i - 1), order[i]!) + (after ? d(order[j]!, after) : 0);
        const swapped = d(at(i - 1), order[j]!) + (after ? d(order[i]!, after) : 0);
        if (swapped < before - 0.5) {
          order.splice(i, j - i + 1, ...order.slice(i, j + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return order;
}
