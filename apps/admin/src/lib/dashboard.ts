import { inTour, TOURS, type LocalizedText } from '@sezi/shared';
import { useQuery } from '@tanstack/react-query';

import { PILOT_AREAS } from './pilot';
import { supabase } from './supabase';

/**
 * Pano: veri kapsamı ve bekleyen işler. Her şey admin oturumuyla canlı tablolardan sayılır (RLS admine her satırı açar);
 * ayrı bir istatistik tablosu ya da önbellek yok, sayılar her açılışta günceldir.
 */

interface CityRaw {
  id: string;
  slug: string;
  name: LocalizedText;
  sort_order: number;
  is_active: boolean;
  inventory_works: number | null;
}
interface WorkRaw {
  id: string;
  slug: string;
  name: LocalizedText;
  city_id: string;
  status: 'draft' | 'verified' | 'archived';
  location_precision: 'exact' | 'approximate' | 'unknown';
  needs_review: boolean;
}
interface MediaRaw {
  work_id: string | null;
  status: 'draft' | 'verified' | 'archived';
}
interface DraftRaw {
  work_id: string;
  status: string;
}
interface CandidateRaw {
  work_id: string;
  status: string;
}

/** PostgREST tek istekte en çok 1000 satır döndürür: sayfa sayfa okunur. */
async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw error;
    const rows = (data ?? []) as unknown as T[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

async function countWhere(table: string, column: string, value: string): Promise<number> {
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq(column, value);
  if (error) throw error;
  return count ?? 0;
}

export interface CityStats {
  slug: string;
  name: string;
  /** Envanter bilgi notundaki eser sayısı (cities.inventory_works). */
  inventory: number | null;
  verified: number;
  draft: number;
  exact: number;
  approximate: number;
  unknown: number;
  withPhoto: number;
  withText: number;
}

export interface PilotWork {
  slug: string;
  name: string;
  type: string;
  photo: boolean;
  text: boolean;
  exact: boolean;
}

export interface TourStats {
  id: string;
  stops: number;
  photo: number;
  text: number;
}

export interface Dashboard {
  cities: CityStats[];
  totals: { verified: number; draft: number; archived: number; withPhoto: number; withText: number; exact: number };
  photos: { published: number; draftLinked: number; unlinked: number };
  texts: { published: number; pending: number; rejected: number };
  candidates: { pending: number; worksPending: number; accepted: number };
  reports: { pending: number };
  points: number;
  needsReview: number;
  pilot: { name: string; works: PilotWork[]; tours: TourStats[] };
}

/** Pilot alan grafiğindeki eser düğümleri (mobil turlarla aynı kaynak). */
function pilotNodes() {
  const area = Object.values(PILOT_AREAS)[0]!;
  return { name: area.name.tr, nodes: area.nodes.filter((n) => n.workSlug) };
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async (): Promise<Dashboard> => {
      const [cities, works, media, drafts, candidates, reportsPending, points] = await Promise.all([
        fetchAll<CityRaw>('cities', 'id, slug, name, sort_order, is_active, inventory_works'),
        fetchAll<WorkRaw>('works', 'id, slug, name, city_id, status, location_precision, needs_review'),
        fetchAll<MediaRaw>('media', 'work_id, status'),
        fetchAll<DraftRaw>('text_drafts', 'work_id, status'),
        fetchAll<CandidateRaw>('location_candidates', 'work_id, status'),
        countWhere('a11y_reports', 'status', 'pending'),
        countWhere('nav_points', 'status', 'verified'),
      ]);

      const photoWorks = new Set(media.filter((m) => m.status === 'verified' && m.work_id).map((m) => m.work_id));
      const textWorks = new Set(drafts.filter((d) => d.status === 'published').map((d) => d.work_id));
      const live = works.filter((w) => w.status === 'verified');

      const cityStats: CityStats[] = cities
        .filter((c) => c.is_active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => {
          const own = works.filter((w) => w.city_id === c.id);
          const pub = own.filter((w) => w.status === 'verified');
          return {
            slug: c.slug,
            name: c.name.tr ?? c.slug,
            inventory: c.inventory_works,
            verified: pub.length,
            draft: own.filter((w) => w.status === 'draft').length,
            exact: pub.filter((w) => w.location_precision === 'exact').length,
            approximate: pub.filter((w) => w.location_precision === 'approximate').length,
            unknown: pub.filter((w) => w.location_precision === 'unknown').length,
            withPhoto: pub.filter((w) => photoWorks.has(w.id)).length,
            withText: pub.filter((w) => textWorks.has(w.id)).length,
          };
        });

      const bySlug = new Map(works.map((w) => [w.slug, w]));
      const area = pilotNodes();
      const pilotWorks: PilotWork[] = area.nodes.map((n) => {
        const w = bySlug.get(n.workSlug!);
        return {
          slug: n.workSlug!,
          name: w?.name.tr ?? n.name.tr ?? n.workSlug!,
          type: n.workType ?? '',
          photo: !!w && photoWorks.has(w.id),
          text: !!w && textWorks.has(w.id),
          exact: w?.location_precision === 'exact',
        };
      });
      const tours: TourStats[] = TOURS.map((def) => {
        const stops = pilotWorks.filter((p) => inTour(def, p.type));
        return { id: def.id, stops: stops.length, photo: stops.filter((s) => s.photo).length, text: stops.filter((s) => s.text).length };
      });

      const pendingCand = candidates.filter((c) => c.status === 'pending');
      return {
        cities: cityStats,
        totals: {
          verified: live.length,
          draft: works.filter((w) => w.status === 'draft').length,
          archived: works.filter((w) => w.status === 'archived').length,
          withPhoto: live.filter((w) => photoWorks.has(w.id)).length,
          withText: live.filter((w) => textWorks.has(w.id)).length,
          exact: live.filter((w) => w.location_precision === 'exact').length,
        },
        photos: {
          published: media.filter((m) => m.status === 'verified' && m.work_id).length,
          draftLinked: media.filter((m) => m.status === 'draft' && m.work_id).length,
          unlinked: media.filter((m) => !m.work_id).length,
        },
        texts: {
          published: drafts.filter((d) => d.status === 'published').length,
          pending: drafts.filter((d) => d.status === 'pending').length,
          rejected: drafts.filter((d) => d.status === 'rejected').length,
        },
        candidates: {
          pending: pendingCand.length,
          worksPending: new Set(pendingCand.map((c) => c.work_id)).size,
          accepted: candidates.filter((c) => c.status === 'accepted').length,
        },
        reports: { pending: reportsPending },
        points,
        needsReview: works.filter((w) => w.needs_review && w.status !== 'archived').length,
        pilot: { name: area.name, works: pilotWorks, tours },
      };
    },
  });
}
