import { distanceM } from "./geo";
import { findRoute, type Route } from "./routing";
import type { LngLat, NavSegment, UserProfile } from "./schemas";

/**
 * Uğrayan rota: A→B rotasını, yol üstündeki anlatım noktalarına uğrayacak şekilde
 * sınırlı bir bütçeyle uzatır. Açgözlü ekleme: her turda ek yolu en küçük aday,
 * bütçe yettiği sürece en ucuz bacak arasına yerleştirilir.
 */

export interface ViaBudget {
  /** Rota uzunluğuna oranla izin verilen uzama. */
  ratio: number;
  /** Mutlak uzama tavanı (m). */
  maxExtraM: number;
}

/** Rota en fazla %25 ve en çok 300 m uzayabilir. */
export const VIA_BUDGET: ViaBudget = { ratio: 0.25, maxExtraM: 300 };

/** Değerlendirilen en yakın aday sayısı (Dijkstra sayısını sınırlar). */
export const VIA_MAX_CANDIDATES = 12;

export interface ViaRoute {
  route: Route;
  /** Rotanın geçtiği aday düğümler, rotadaki sırayla. */
  via: string[];
  /** Uğramasız rotanın uzunluğu (m). */
  baseLengthM: number;
}

/** Ardışık bacakları tek rotaya birleştirir; kavşak düğümleri tekrarlanmaz. */
export function joinRoutes(legs: readonly Route[]): Route {
  const [first, ...rest] = legs;
  const nodeIds = [...first!.nodeIds];
  const segmentIds = [...first!.segmentIds];
  let lengthM = first!.lengthM;
  let cost = first!.cost;
  for (const leg of rest) {
    nodeIds.push(...leg.nodeIds.slice(1));
    segmentIds.push(...leg.segmentIds);
    lengthM += leg.lengthM;
    cost += leg.cost;
  }
  return { nodeIds, segmentIds, lengthM, cost };
}

export function routeVia(
  segments: NavSegment[],
  profile: UserProfile,
  fromId: string,
  toId: string,
  candidates: readonly string[],
  locations: ReadonlyMap<string, LngLat>,
  budget: ViaBudget = VIA_BUDGET,
): ViaRoute | null {
  const base = findRoute(segments, profile, fromId, toId);
  if (!base) return null;

  const slack = Math.min(base.lengthM * budget.ratio, budget.maxExtraM);
  const allowedM = base.lengthM + slack;

  // Havuz: rotada zaten olmayan, konumu bilinen ve kuş uçuşu gidiş-dönüşü bütçeye sığan en yakın adaylar.
  const onBase = new Set(base.nodeIds);
  const baseLocs = base.nodeIds.map((id) => locations.get(id)).filter((l): l is LngLat => !!l);
  const scored: { id: string; crow: number }[] = [];
  for (const id of new Set(candidates)) {
    if (onBase.has(id)) continue;
    const loc = locations.get(id);
    if (!loc || baseLocs.length === 0) continue;
    const crow = Math.min(...baseLocs.map((l) => distanceM(loc, l)));
    if (crow * 2 > slack) continue;
    scored.push({ id, crow });
  }
  scored.sort((a, b) => a.crow - b.crow || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const pool = scored.slice(0, VIA_MAX_CANDIDATES).map((s) => s.id);

  const cache = new Map<string, Route | null>([[`${fromId}>${toId}`, base]]);
  const leg = (a: string, b: string) => {
    const key = `${a}>${b}`;
    if (!cache.has(key)) cache.set(key, findRoute(segments, profile, a, b));
    return cache.get(key)!;
  };

  const seq = [fromId, toId];
  let total = base.lengthM;
  for (;;) {
    let best: { c: string; i: number; extra: number; l1: Route; l2: Route } | null = null;
    for (const c of pool) {
      for (let i = 0; i < seq.length - 1; i++) {
        const l1 = leg(seq[i]!, c);
        const l2 = leg(c, seq[i + 1]!);
        if (!l1 || !l2) continue;
        const extra = l1.lengthM + l2.lengthM - leg(seq[i]!, seq[i + 1]!)!.lengthM;
        if (total + extra > allowedM) continue;
        if (!best || extra < best.extra) best = { c, i, extra, l1, l2 };
      }
    }
    if (!best) break;
    seq.splice(best.i + 1, 0, best.c);
    total += best.extra;
    // Yeni bacakların zaten geçtiği adaylar ayrıca eklenmez.
    const passed = new Set([...best.l1.nodeIds, ...best.l2.nodeIds]);
    for (let k = pool.length - 1; k >= 0; k--) {
      if (pool[k] === best.c || passed.has(pool[k]!)) pool.splice(k, 1);
    }
  }

  const legs: Route[] = [];
  for (let i = 0; i < seq.length - 1; i++) legs.push(leg(seq[i]!, seq[i + 1]!)!);
  const route = joinRoutes(legs);

  const wanted = new Set(candidates);
  wanted.delete(fromId);
  wanted.delete(toId);
  const via: string[] = [];
  for (const id of route.nodeIds) {
    if (wanted.has(id) && !via.includes(id)) via.push(id);
  }
  return { route, via, baseLengthM: base.lengthM };
}
