import type { LocalizedText } from '@sezi/shared';
import { useQuery } from '@tanstack/react-query';

import { MEDIA_BASE, supabase } from './supabase';

export type Status = 'draft' | 'verified' | 'archived';
export type Precision = 'exact' | 'approximate' | 'unknown';
export type Condition = 'intact' | 'restored' | 'damaged' | 'destroyed' | 'unknown';

export const tr = (t: LocalizedText | null | undefined) => (t ? (t.tr ?? '') : '');

/** Liste satırı: works_view (security_invoker; admin taslakları da görür). */
export interface WorkListRow {
  id: string;
  slug: string;
  name: LocalizedText;
  type_slug: string;
  type_name: LocalizedText;
  city_slug: string;
  city_name: LocalizedText;
  district: string | null;
  status: Status;
  location_precision: Precision;
  photos: { id: string; thumb: string | null; path: string }[];
  sources: { kind: string; volume: number | null; page: string | null }[];
}

export interface WorkFilters {
  q: string;
  city: string;
  type: string;
  status: string;
  precision: string;
  /** '1': inceleme bekleyen (needs_review), '' hepsi */
  review: string;
  /** 'with' | 'without' | '' */
  photo: string;
  page: number;
}

export const PAGE_SIZE = 50;

export function useWorkList(f: WorkFilters) {
  return useQuery({
    queryKey: ['works', f],
    queryFn: async () => {
      let q = supabase
        .from('works_view')
        .select('id, slug, name, type_slug, type_name, city_slug, city_name, district, status, location_precision, photos, sources', { count: 'exact' })
        .order('name->>tr' as 'name')
        .range(f.page * PAGE_SIZE, f.page * PAGE_SIZE + PAGE_SIZE - 1);
      if (f.q.trim()) q = q.ilike('name->>tr' as 'name', `%${f.q.trim()}%`);
      if (f.city) q = q.eq('city_slug', f.city);
      if (f.type) q = q.eq('type_slug', f.type);
      if (f.status) q = q.eq('status', f.status);
      if (f.precision) q = q.eq('location_precision', f.precision);
      if (f.photo === 'with') q = q.neq('photos', '[]');
      if (f.photo === 'without') q = q.eq('photos', '[]');
      if (f.review === '1') {
        // needs_review görünümde yok: önce tablodan kimlikler alınır.
        const { data: ids, error } = await supabase.from('works').select('id').eq('needs_review', true);
        if (error) throw error;
        q = q.in('id', (ids ?? []).map((r) => r.id));
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as WorkListRow[], count: count ?? 0 };
    },
    placeholderData: (prev) => prev,
  });
}

export interface Lookup {
  id: string;
  slug: string;
  name: LocalizedText;
}

export function useLookups() {
  return useQuery({
    queryKey: ['lookups'],
    staleTime: Infinity,
    queryFn: async () => {
      const [types, cities] = await Promise.all([
        supabase.from('work_types').select('id, slug, name').order('slug'),
        supabase.from('cities').select('id, slug, name').eq('is_active', true).order('sort_order'),
      ]);
      if (types.error) throw types.error;
      if (cities.error) throw cities.error;
      return { types: types.data as Lookup[], cities: cities.data as Lookup[] };
    },
  });
}

/** Düzenleme formu: tablonun kendisi (görünümde olmayan alanlar dahil). */
export interface WorkRecord {
  id: string;
  slug: string;
  name: LocalizedText;
  summary: LocalizedText | null;
  history: LocalizedText | null;
  architecture: LocalizedText | null;
  period: LocalizedText | null;
  district: string | null;
  address: LocalizedText | null;
  condition: Condition;
  condition_note: LocalizedText | null;
  unesco: boolean;
  location_precision: Precision;
  status: Status;
  needs_review: boolean;
  work_type_id: string;
  city_id: string;
}

export interface MediaRow {
  id: string;
  storage_path: string;
  thumb_path: string | null;
  alt_text: LocalizedText;
  status: Status;
  kind: 'photo' | 'aerial' | 'inscription';
  sort_order: number;
  credit: string | null;
  source_file: string | null;
  source_volume: number | null;
  source_page: number | null;
}

export function useWork(slug: string) {
  return useQuery({
    queryKey: ['work', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('works')
        .select('id, slug, name, summary, history, architecture, period, district, address, condition, condition_note, unesco, location_precision, status, needs_review, work_type_id, city_id')
        .eq('slug', slug)
        .single();
      if (error) throw error;
      const work = data as WorkRecord;
      const [view, media] = await Promise.all([
        supabase.from('works_view').select('lng, lat, sources, city_slug').eq('id', work.id).single(),
        supabase.from('media').select('id, storage_path, thumb_path, alt_text, status, kind, sort_order, credit, source_file, source_volume, source_page').eq('work_id', work.id).order('sort_order'),
      ]);
      if (view.error) throw view.error;
      if (media.error) throw media.error;
      return {
        work,
        lng: view.data.lng as number | null,
        lat: view.data.lat as number | null,
        citySlug: view.data.city_slug as string,
        sources: view.data.sources as { title: string; kind: string; volume: number | null; page: string | null; url: string | null }[],
        media: (media.data ?? []) as MediaRow[],
      };
    },
  });
}

export const mediaUrl = (path: string) => MEDIA_BASE + path;

export const STATUS_LABEL: Record<Status, string> = { draft: 'Taslak', verified: 'Doğrulandı', archived: 'Arşivde' };
export const PRECISION_LABEL: Record<Precision, string> = { exact: 'Kesin', approximate: 'Yaklaşık', unknown: 'Yok' };
export const CONDITION_LABEL: Record<Condition, string> = { intact: 'Ayakta', restored: 'Restore edildi', damaged: 'Hasarlı', destroyed: 'Yıkıldı', unknown: 'Bilinmiyor' };
