import { distanceM } from "./geo";
import type { Planner } from "./planner";
import type { LngLat, LocalizedText, UserProfile } from "./schemas";

/**
 * Tur tanımları: her tur pilot alanın doğrulanmış eserlerinden türe göre seçilir (yazılmış durak listesi yok).
 * Mobil uygulama sırayı gerçek yol grafiğiyle hesaplar; yönetim paneli kapsamı (fotoğraf, metin) bu tanımla sayar.
 */
export interface TourDef {
  /** i18n anahtar öneki: tours.<id>.title / .body */
  id: string;
  /** Eser türü slug'ları; null: pilot alandaki bütün eserler. */
  types: string[] | null;
}

export const TOURS: TourDef[] = [
  { id: "tum", types: null },
  { id: "hanlar", types: ["han", "bedesten", "carsi"] },
  { id: "camiler", types: ["cami", "mescit", "turbe"] },
  { id: "su", types: ["cesme", "sebil", "hamam"] },
];

/** Eser bu tura girer mi (türüne göre). */
export const inTour = (def: TourDef, workType: string | undefined): boolean =>
  def.types === null || (workType !== undefined && def.types.includes(workType));

export interface TourStop {
  slug: string;
  name: LocalizedText;
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

export function planTour(planner: Planner, id: string, profile: UserProfile, from: LngLat = planner.defaultStart()): PlannedTour | null {
  const def = TOURS.find((t) => t.id === id);
  if (!def) return null;
  const pool = planner.pilotWorks.filter((n) => inTour(def, n.workType));
  if (pool.length === 0) return null;

  const stops: TourStop[] = [];
  let current = planner.nearestNode(from);
  const left = [...pool];
  while (left.length) {
    left.sort((a, b) => distanceM(current.location, a.location) - distanceM(current.location, b.location));
    const next = left.shift()!;
    const leg = planner.legBetween(current.id, next.id, profile);
    if (!leg) continue; // bu profil için ulaşılamayan durak atlanır
    stops.push({ slug: next.workSlug!, name: next.name ?? { tr: next.workSlug! }, type: next.workType ?? "", legM: leg.lengthM, legStairs: leg.stairs });
    current = next;
  }
  return {
    id,
    stops,
    lengthM: stops.reduce((s, x) => s + x.legM, 0),
    stairs: stops.reduce((s, x) => s + x.legStairs, 0),
  };
}
