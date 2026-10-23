import { SenseCue as SenseCueSchema, TourRow, type LocalizedText } from '@sezi/shared';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

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
  photos: { id: string; thumb: string | null; path: string; origin?: 'inventory' | 'commons' | 'upload' }[];
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
  /** 'inventory' | 'commons' | '' */
  origin?: string;
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
      if (f.origin === 'commons') q = q.filter('photos', 'cs', '[{"origin":"commons"}]');
      if (f.origin === 'inventory') q = q.filter('photos', 'cs', '[{"origin":"inventory"}]');
      if (f.origin === 'upload') q = q.filter('photos', 'cs', '[{"origin":"upload"}]');
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
  built_year: number | null;
  founder: string | null;
  visit_steps: number | null;
  visit_ramp: boolean | null;
  visit_hours: LocalizedText | null;
  visit_minutes: number | null;
  visit_note: LocalizedText | null;
  visit_source: string | null;
  visit_checked_on: string | null;
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
  audio_tr_id: string | null;
  audio_en_id: string | null;
}

const LocalizedSchema = z.object({ tr: z.string(), en: z.string().optional() });
const WorkRecordSchema = z.object({
  id: z.string(), slug: z.string(), name: LocalizedSchema,
  summary: LocalizedSchema.nullable(), history: LocalizedSchema.nullable(), architecture: LocalizedSchema.nullable(),
  period: LocalizedSchema.nullable(), built_year: z.number().nullable(), founder: z.string().nullable(),
  visit_steps: z.number().nullable(), visit_ramp: z.boolean().nullable(), visit_hours: LocalizedSchema.nullable(),
  visit_minutes: z.number().nullable(), visit_note: LocalizedSchema.nullable(), visit_source: z.string().nullable(), visit_checked_on: z.string().nullable(),
  district: z.string().nullable(), address: LocalizedSchema.nullable(),
  condition: z.enum(['intact', 'restored', 'damaged', 'destroyed', 'unknown']), condition_note: LocalizedSchema.nullable(),
  unesco: z.boolean(), location_precision: z.enum(['exact', 'approximate', 'unknown']),
  status: z.enum(['draft', 'verified', 'archived']), needs_review: z.boolean(), work_type_id: z.string(), city_id: z.string(),
  audio_tr_id: z.string().nullable(), audio_en_id: z.string().nullable(),
});
export interface VisitForm {
  steps: string; ramp: string; minutes: string; hoursTr: string; hoursEn: string;
  noteTr: string; noteEn: string; source: string; checkedOn: string;
}
export function toVisitForm(w: WorkRecord): VisitForm {
  return { steps: w.visit_steps?.toString() ?? '', ramp: w.visit_ramp === null ? '' : w.visit_ramp ? 'yes' : 'no',
    minutes: w.visit_minutes?.toString() ?? '', hoursTr: w.visit_hours?.tr ?? '', hoursEn: w.visit_hours?.en ?? '',
    noteTr: w.visit_note?.tr ?? '', noteEn: w.visit_note?.en ?? '', source: w.visit_source ?? '', checkedOn: w.visit_checked_on ?? '' };
}
export function visitError(v: VisitForm) {
  const hasVisitData = Object.values(v).some((value) => value.trim());
  if (hasVisitData && (!v.source.trim() || !v.checkedOn)) return 'Ziyaret bilgisi için kaynak ve kontrol tarihi zorunludur.';
  if (v.steps && (!Number.isInteger(Number(v.steps)) || Number(v.steps) < 0 || Number(v.steps) > 200)) return 'Basamak sayısı 0–200 arasında tam sayı olmalıdır.';
  if (v.minutes && (!Number.isInteger(Number(v.minutes)) || Number(v.minutes) < 1 || Number(v.minutes) > 600)) return 'Gezme süresi 1–600 dakika arasında tam sayı olmalıdır.';
  if ((v.hoursEn.trim() && !v.hoursTr.trim()) || (v.noteEn.trim() && !v.noteTr.trim())) return 'İngilizce ziyaret bilgisinin Türkçesini de girin.';
  return '';
}
export function visitPatch(v: VisitForm) {
  return { visit_steps: v.steps === '' ? null : Number(v.steps), visit_ramp: v.ramp === '' ? null : v.ramp === 'yes',
    visit_minutes: v.minutes === '' ? null : Number(v.minutes),
    visit_hours: v.hoursTr.trim() ? { tr: v.hoursTr.trim(), ...(v.hoursEn.trim() ? { en: v.hoursEn.trim() } : {}) } : null,
    visit_note: v.noteTr.trim() ? { tr: v.noteTr.trim(), ...(v.noteEn.trim() ? { en: v.noteEn.trim() } : {}) } : null,
    visit_source: v.source.trim() || null, visit_checked_on: v.checkedOn || null };
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
  origin: 'inventory' | 'commons' | 'upload';
  author: string | null;
  license: string | null;
  license_url: string | null;
  source_url: string | null;
  modifications: LocalizedText | null;
  wikidata_id: string | null;
}

export interface WorkSource {
  title: string;
  kind: string;
  volume: number | null;
  page: string | null;
  url: string | null;
}

export interface WorkDetail {
  work: WorkRecord;
  lng: number | null;
  lat: number | null;
  citySlug: string;
  sources: WorkSource[];
  media: MediaRow[];
  /** Ses kayıtlarının Storage yolları (audio bucket). */
  audio: { tr: string | null; en: string | null };
}

export function useWork(slug: string) {
  return useQuery({
    queryKey: ['work', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('works')
        .select('id, slug, name, summary, history, architecture, period, built_year, founder, visit_steps, visit_ramp, visit_hours, visit_minutes, visit_note, visit_source, visit_checked_on, district, address, condition, condition_note, unesco, location_precision, status, needs_review, work_type_id, city_id, audio_tr_id, audio_en_id')
        .eq('slug', slug)
        .single();
      if (error) throw error;
      const work = WorkRecordSchema.parse(data);
      const [view, media] = await Promise.all([
        supabase.from('works_view').select('lng, lat, sources, city_slug, audio_tr, audio_en').eq('id', work.id).single(),
        supabase.from('media').select('id, storage_path, thumb_path, alt_text, status, kind, sort_order, credit, source_file, source_volume, source_page, origin, author, license, license_url, source_url, modifications, wikidata_id').eq('work_id', work.id).order('sort_order'),
      ]);
      if (view.error) throw view.error;
      if (media.error) throw media.error;
      const detail: WorkDetail = {
        work,
        lng: view.data.lng as number | null,
        lat: view.data.lat as number | null,
        citySlug: view.data.city_slug as string,
        sources: view.data.sources as WorkSource[],
        media: (media.data ?? []) as MediaRow[],
        audio: { tr: view.data.audio_tr as string | null, en: view.data.audio_en as string | null },
      };
      return detail;
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

// ---------- Noktalar (rotaların uğradığı ve kullandığı yerler) ----------

export type PointRole = 'start' | 'landmark' | 'story' | 'arrival';
export type Ambient = 'water' | 'market' | 'chime';

export const ROLE_LABEL: Record<PointRole, string> = {
  start: 'Başlangıç',
  landmark: 'Yer işareti',
  story: 'Anlatım',
  arrival: 'Eser varışı',
};
export const ROLE_HINT: Record<PointRole, string> = {
  start: 'Buluşma ya da varış yeri (durak, meydan). Kullanıcı rotayı buradan başlatabilir.',
  landmark: 'Talimatlarda anılır ("Heykel hizasında sağa"); rota görünen yer işaretlerinin yanından geçmeyi tercih eder.',
  story: 'Yarıçapa girilince metin ve ses açılır. Rotalar yakındaki anlatım noktalarına uğrar.',
  arrival: 'Esere varınca açılan metin ve ses. Bir esere bağlanır.',
};
export const AMBIENT_LABEL: Record<Ambient, string> = { water: 'Su', market: 'Çarşı uğultusu', chime: 'Çan / saat' };
export type SenseCue = z.infer<typeof SenseCueSchema>;
export const SENSE_CUES: readonly SenseCue[] = SenseCueSchema.options;
/** Uygulamanın söylediği olasılık cümlesi (shared/guidance.ts > CUE_TEXT ile aynı anlam). */
export const CUE_LABEL: Record<SenseCue, string> = {
  water: 'Su sesi ("su akıyorsa sesini duyabilirsiniz")',
  bakery: 'Fırın kokusu ("açıkken fırın kokusu gelebilir")',
  prayer: 'Ezan sesi ("ezan okunurken ses bu camiden geliyor olabilir")',
};

/** nav_points_view satırı (security_invoker; admin taslakları da görür). */
export interface PointRow {
  id: string;
  city_id: string;
  city_slug: string;
  roles: PointRole[];
  title: LocalizedText;
  body: LocalizedText | null;
  radius_m: number;
  source_note: string | null;
  status: Status;
  lng: number;
  lat: number;
  work_id: string | null;
  work_slug: string | null;
  salience: number | null;
  ambient: Ambient | null;
  cue: SenseCue | null;
  field_checked: boolean;
  sort_order: number;
  audio_tr_id: string | null;
  audio_tr: string | null;
  audio_en_id: string | null;
  audio_en: string | null;
}

export function usePoints(citySlug: string) {
  return useQuery({
    queryKey: ['nav_points', citySlug],
    queryFn: async () => {
      const { data, error } = await supabase.from('nav_points_view').select('*').eq('city_slug', citySlug).order('updated_at', { ascending: false });
      if (error) throw error;
      return data as PointRow[];
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
  origin: 'inventory' | 'commons' | 'upload';
  author: string | null;
  license: string | null;
  license_url: string | null;
  source_url: string | null;
  modifications: LocalizedText | null;
  wikidata_id: string | null;
}

export function useInbox() {
  return useQuery({
    queryKey: ['inbox'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('media')
        .select('id, storage_path, thumb_path, folder, source_file, kind, origin, author, license, license_url, source_url, modifications, wikidata_id')
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

// ---------- Turlar ----------

/** tours_view satırı (security_invoker; admin taslakları da görür). */
const TourAdminRowSchema = TourRow.extend({
  id: z.string(),
  city_id: z.string(),
  status: z.enum(['draft', 'verified', 'archived']),
  updated_at: z.string(),
});
export type TourAdminRow = z.infer<typeof TourAdminRowSchema>;

export function useToursAdmin(citySlug: string) {
  return useQuery({
    queryKey: ['tours', citySlug],
    queryFn: async () => {
      const { data, error } = await supabase.from('tours_view').select('*').eq('city_slug', citySlug).order('sort_order');
      if (error) throw error;
      return z.array(TourAdminRowSchema).parse(data ?? []);
    },
  });
}
