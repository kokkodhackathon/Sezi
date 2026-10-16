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

/** İl merkezleri: konumu olmayan eser/nokta için harita buradan açılır. */
export const CITY_CENTER: Record<string, [number, number]> = {
  bursa: [29.0613, 40.1842],
  konya: [32.4932, 37.8714],
  hatay: [36.1612, 36.2021],
};

/** Boş metin veritabanında null olur; yalnızca İngilizcesi olan metin kabul edilmez (TR zorunlu). */
export const localized = (v: { tr: string; en: string }): LocalizedText | null => (v.tr.trim() ? { tr: v.tr.trim(), ...(v.en.trim() ? { en: v.en.trim() } : {}) } : null);

// ---------- Anlatım noktaları ----------

/** story_points_view satırı (security_invoker; admin taslakları da görür). */
export interface StoryRow {
  id: string;
  city_id: string;
  city_slug: string;
  title: LocalizedText;
  body: LocalizedText | null;
  radius_m: number;
  source_note: string | null;
  status: Status;
  lng: number;
  lat: number;
  audio_tr_id: string | null;
  audio_tr: string | null;
  audio_en_id: string | null;
  audio_en: string | null;
}

export function useStoryPoints(citySlug: string) {
  return useQuery({
    queryKey: ['story_points', citySlug],
    queryFn: async () => {
      const { data, error } = await supabase.from('story_points_view').select('*').eq('city_slug', citySlug).order('updated_at', { ascending: false });
      if (error) throw error;
      return data as StoryRow[];
    },
  });
}

// ---------- Fotoğraf kutusu ----------

export interface InboxPhoto {
  id: string;
  storage_path: string;
  thumb_path: string | null;
  folder: string | null;
  source_file: string | null;
  kind: 'photo' | 'aerial' | 'inscription';
}

export function useInbox() {
  return useQuery({
    queryKey: ['inbox'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('media')
        .select('id, storage_path, thumb_path, folder, source_file, kind')
        .is('work_id', null)
        .order('folder')
        .order('source_file');
      if (error) throw error;
      return (data ?? []) as InboxPhoto[];
    },
  });
}

/** Eser arama (fotoğraf bağlama, yeni eser kontrolü): ada göre, isteğe bağlı il süzgeciyle. */
export async function searchWorks(q: string, city?: string) {
  let query = supabase.from('works_view').select('id, slug, name, district, type_name, city_slug').order('name->>tr' as 'name').limit(12);
  if (q.trim()) query = query.ilike('name->>tr' as 'name', `%${q.trim()}%`);
  if (city) query = query.eq('city_slug', city);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as { id: string; slug: string; name: LocalizedText; district: string | null; type_name: LocalizedText; city_slug: string }[];
}

// ---------- Erişilebilirlik bildirimleri ----------

export type ReportType = 'stairs' | 'ramp_blocked' | 'narrow_path' | 'surface_damage' | 'construction' | 'other';
export type ReportStatus = 'pending' | 'approved' | 'rejected';

export interface ReportRow {
  id: string;
  area: string | null;
  segment_key: string | null;
  work_slug: string | null;
  type: ReportType;
  note: string | null;
  status: ReportStatus;
  created_at: string;
  reviewed_at: string | null;
}

export function useReports(status: ReportStatus) {
  return useQuery({
    queryKey: ['reports', status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('a11y_reports')
        .select('id, area, segment_key, work_slug, type, note, status, created_at, reviewed_at')
        .eq('status', status)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ReportRow[];
    },
  });
}

export const REPORT_LABEL: Record<ReportType, string> = {
  stairs: 'Merdiven var',
  ramp_blocked: 'Rampa kapalı',
  narrow_path: 'Geçit dar',
  surface_damage: 'Zemin bozuk',
  construction: 'İnşaat / yol kapalı',
  other: 'Diğer',
};
/** Onaylanınca rotaya etkisi (uygulamadaki nav.ts ile aynı kural). */
export const REPORT_EFFECT: Record<ReportType, string> = {
  stairs: 'Yol parçası merdivenli sayılır: tekerlekli sandalye rotası kaçınır.',
  ramp_blocked: 'Yol parçası kapanır: tüm rotalar kaçınır.',
  narrow_path: 'Geçit dar sayılır: tekerlekli sandalye rotası kaçınır.',
  surface_damage: 'Zemin bozuk sayılır: bastonlu ve tekerlekli sandalye rotası pahalılaşır.',
  construction: 'Yol parçası kapanır: tüm rotalar kaçınır.',
  other: 'Rotaya etkisi yok; yalnızca kayıt.',
};

// ---------- İller ----------

export interface CityRow {
  id: string;
  slug: string;
  name: LocalizedText;
  is_active: boolean;
  sort_order: number;
  inventory_year: number | null;
  inventory_works: number | null;
  inventory_photos: number | null;
  inventory_status: 'published' | 'printing' | 'in_progress' | 'planned' | null;
  region_id: string;
}

export function useCitiesAdmin() {
  return useQuery({
    queryKey: ['cities-admin'],
    queryFn: async () => {
      const [cities, regions, counts] = await Promise.all([
        supabase.from('cities').select('id, slug, name, is_active, sort_order, inventory_year, inventory_works, inventory_photos, inventory_status, region_id').order('sort_order'),
        supabase.from('regions').select('id, name').order('id'),
        supabase.from('works_view').select('city_slug'),
      ]);
      if (cities.error) throw cities.error;
      if (regions.error) throw regions.error;
      if (counts.error) throw counts.error;
      const n = new Map<string, number>();
      for (const r of counts.data ?? []) n.set(r.city_slug as string, (n.get(r.city_slug as string) ?? 0) + 1);
      return { cities: cities.data as CityRow[], regions: regions.data as { id: string; name: LocalizedText }[], workCount: n };
    },
  });
}

/** Türkçe ad → URL dostu kısa ad (ı→i, ş→s …). */
export function slugify(text: string): string {
  const map: Record<string, string> = { ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c', â: 'a', î: 'i', û: 'u' };
  return text
    .replace(/[ıİşŞğĞüÜöÖçÇâîû]/g, (c) => map[c] ?? c)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
