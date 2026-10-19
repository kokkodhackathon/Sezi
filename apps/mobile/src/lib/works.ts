import type { LocalizedText } from '@sezi/shared';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import Storage from 'expo-sqlite/kv-store';

import type { Lang } from './i18n';
import { supabase } from './supabase';

/**
 * Eser satırlarının cihazdaki son bilinen hâli (slug başına bir anahtar). Açılan eser sayfaları ve
 * nokta eşitlemesinin önceden çektiği, noktalara bağlı eserler burada kalır: uygulama yeniden açılıp
 * internetsiz yüründüğünde de nokta kartındaki eser bilgisi ve eser sayfası görünür.
 */
const WORK_KEY = (slug: string) => `sezi.work.v1:${slug}`;

export function cachedWork(slug: string): WorkRow | undefined {
  try {
    const raw = Storage.getItemSync(WORK_KEY(slug));
    const row = raw ? (JSON.parse(raw) as WorkRow) : undefined;
    return row?.slug === slug ? row : undefined;
  } catch {
    // Bozuk kayıt yok sayılır; sunucudan yeniden alınır.
    return undefined;
  }
}

function storeWork(row: WorkRow) {
  Storage.setItemSync(WORK_KEY(row.slug), JSON.stringify(row));
}

/**
 * Verilen eserleri sunucudan çekip cihazda saklar (ör. noktalara bağlı eserler); kapak küçükleri de
 * diske indirilir. Hata sessizce atlanır; sonraki eşitlemede yeniden denenir.
 */
export async function prefetchWorks(slugs: string[]): Promise<void> {
  const want = [...new Set(slugs)];
  if (want.length === 0) return;
  try {
    const { data, error } = await supabase.from('works_view').select('*').in('slug', want);
    if (error || !data) return;
    const rows = data as WorkRow[];
    for (const row of rows) storeWork(row);
    const thumbs = rows.flatMap((r) => (r.photos[0] ? [photoUrl(r.photos[0], 'thumb')] : []));
    if (thumbs.length) await Image.prefetch(thumbs, 'disk');
  } catch {
    // İnternet yok: saklı satırlar kalır.
  }
}

export interface WorkSource {
  id: string;
  title: string;
  publisher: string | null;
  year: number | null;
  url: string | null;
  page: string | null;
  kind: 'inventory' | 'wikidata' | 'osm' | 'academic' | 'web' | 'other';
  volume: number | null;
  section: LocalizedText | null;
}

export interface WorkExhibition {
  slug: string;
  title: LocalizedText;
  venue: LocalizedText;
  starts_on: string | null;
  ends_on: string | null;
}

/** Envanter fotoğrafı (Storage `media` bucket'ı; yollar bucket içinden). */
export interface WorkPhoto {
  id: string;
  path: string;
  thumb: string | null;
  alt: LocalizedText;
  credit: string | null;
  kind: 'photo' | 'aerial' | 'inscription';
  width: number | null;
  height: number | null;
}

const MEDIA_BASE = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;
/** Fotoğrafın herkese açık adresi; küçük boy istenirse ve varsa önizleme dosyası. */
export function photoUrl(p: WorkPhoto, size: 'thumb' | 'full' = 'full'): string {
  return MEDIA_BASE + (size === 'thumb' && p.thumb ? p.thumb : p.path);
}
export const coverOf = (w: WorkRow): WorkPhoto | undefined => w.photos[0];

export type WorkCondition = 'intact' | 'restored' | 'damaged' | 'destroyed' | 'unknown';
export type LocationPrecision = 'exact' | 'approximate' | 'unknown';

/** public.works_view satırı (RLS: anonim kullanıcı yalnızca verified eserleri görür). */
export interface WorkRow {
  id: string;
  slug: string;
  name: LocalizedText;
  summary: LocalizedText | null;
  history: LocalizedText | null;
  architecture: LocalizedText | null;
  period: LocalizedText | null;
  built_year: number | null;
  founder: string | null;
  a11y_score: number | null;
  district: string | null;
  address: LocalizedText | null;
  condition: WorkCondition;
  condition_note: LocalizedText | null;
  unesco: boolean;
  location_precision: LocationPrecision;
  type_slug: string;
  type_name: LocalizedText;
  city_slug: string;
  city_name: LocalizedText;
  complex_slug: string | null;
  complex_name: LocalizedText | null;
  lng: number | null;
  lat: number | null;
  sources: WorkSource[];
  exhibitions: WorkExhibition[];
  photos: WorkPhoto[];
  /** Admin panelinden yüklenen ses kaydının Storage yolu (audio bucket); yoksa metin okunur. */
  audio_tr: string | null;
  audio_en: string | null;
}

/** Haritada gösterilebilir eser (konumu bilinen). */
export type MappedWork = WorkRow & { lng: number; lat: number };
export const hasLocation = (w: WorkRow): w is MappedWork => w.lng !== null && w.lat !== null;

export function loc(text: LocalizedText | null | undefined, lang: Lang): string {
  if (!text) return '';
  return text[lang] ?? text.tr;
}

/** Envanter kitabı kaynağı (varsa): "Bursa Vakıf Eserleri — Cilt 1, s. 106". */
export function inventorySource(w: WorkRow): WorkSource | undefined {
  return w.sources.find((s) => s.kind === 'inventory');
}

export function useWorks(citySlug?: string) {
  return useQuery({
    queryKey: ['works', citySlug ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('works_view').select('*').order('slug');
      if (citySlug) q = q.eq('city_slug', citySlug);
      const { data, error } = await q;
      if (error) throw error;
      return data as WorkRow[];
    },
  });
}

/**
 * Tek eser. Cihazdaki son bilinen satır hemen gösterilir (internetsiz de); sunucudan yenisi gelince
 * güncellenip saklanır. Sunucuya ulaşılamazsa son bilinen satır kalır; eser yayından kalktıysa silinir.
 */
export function useWork(slug: string) {
  return useQuery({
    queryKey: ['work', slug],
    queryFn: async () => {
      let res;
      try {
        res = await supabase.from('works_view').select('*').eq('slug', slug).maybeSingle();
      } catch (e) {
        res = { data: null, error: e };
      }
      if (res.error) {
        const last = cachedWork(slug);
        if (last) return last;
        throw res.error;
      }
      const row = res.data as WorkRow | null;
      if (row) storeWork(row);
      else Storage.removeItemSync(WORK_KEY(slug));
      return row;
    },
    initialData: () => (slug ? cachedWork(slug) : undefined),
    // Saklı satır eski sayılır: açılışta sunucudan yenilenir.
    initialDataUpdatedAt: 0,
    enabled: !!slug,
  });
}

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
  inventory_note: LocalizedText | null;
}

/** Envanter illeri: aktif olanlar (Hatay, Konya, Bursa) ve sıradaki iller. */
export function useCities() {
  return useQuery({
    queryKey: ['cities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('id, slug, name, is_active, sort_order, inventory_year, inventory_works, inventory_photos, inventory_status, inventory_note')
        .not('inventory_year', 'is', null)
        .order('sort_order');
      if (error) throw error;
      return data as CityRow[];
    },
    staleTime: 60 * 60_000,
  });
}

export interface ExhibitionRow {
  id: string;
  slug: string;
  title: LocalizedText;
  venue: LocalizedText;
  starts_on: string | null;
  ends_on: string | null;
  photo_count: number | null;
  description: LocalizedText | null;
  source_url: string | null;
  city: { slug: string; name: LocalizedText } | null;
}

export function useExhibitions() {
  return useQuery({
    queryKey: ['exhibitions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exhibitions')
        .select('id, slug, title, venue, starts_on, ends_on, photo_count, description, source_url, city:cities(slug, name)')
        .order('starts_on', { ascending: false });
      if (error) throw error;
      return data as unknown as ExhibitionRow[];
    },
    staleTime: 60 * 60_000,
  });
}

export interface InventoryBook {
  id: string;
  title: string;
  year: number | null;
  url: string | null;
  volume: number | null;
  city_id: string | null;
}

export function useInventoryBooks() {
  return useQuery({
    queryKey: ['inventory-books'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sources').select('id, title, year, url, volume, city_id').eq('kind', 'inventory').order('title');
      if (error) throw error;
      return data as InventoryBook[];
    },
    staleTime: 60 * 60_000,
  });
}
