import { z } from "zod";

import type { LocalizedText } from "./schemas";

/**
 * Veritabanından okunan çok dilli metin: çevirisi olmayan satırlarda `en` null ya da boş gelebilir; bu durumda
 * alan düşürülür ve sonuç `LocalizedText` olur (yazma tarafındaki katı şema değişmez).
 */
const DbText = z
  .object({ tr: z.string().trim().min(1), en: z.string().nullish() })
  .transform(({ tr, en }): LocalizedText => (en?.trim() ? { tr, en: en.trim() } : { tr }));

export const WorkSourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  publisher: z.string().nullable(),
  year: z.number().nullable(),
  url: z.string().nullable(),
  page: z.string().nullable(),
  kind: z.enum(["inventory", "wikidata", "osm", "academic", "web", "other"]),
  volume: z.number().nullable(),
  section: DbText.nullable(),
});
export type WorkSource = z.infer<typeof WorkSourceSchema>;

export const WorkExhibitionSchema = z.object({
  slug: z.string(),
  title: DbText,
  venue: DbText,
  starts_on: z.string().nullable(),
  ends_on: z.string().nullable(),
});
export type WorkExhibition = z.infer<typeof WorkExhibitionSchema>;

/**
 * Eser fotoğrafı (Storage `media` bucket'ı; yollar bucket içinden). `origin`: `inventory` bize verilen envanter
 * arşivi, `commons` Wikimedia Commons'tan alınmış (Wikidata P18), `upload` admin panelinden yüklenmiş (fotoğrafçı
 * ve kullanım izni zorunlu). Commons ve yüklenen fotoğrafta yazar, lisans ve kaynak her zaman gösterilir.
 */
export const WorkPhotoSchema = z.object({
  id: z.string(),
  path: z.string(),
  thumb: z.string().nullable(),
  alt: DbText,
  credit: z.string().nullable(),
  kind: z.enum(["photo", "aerial", "inscription"]),
  width: z.number().nullable(),
  height: z.number().nullable(),
  // Eski önbellek satırlarında bu alanlar yok: envanter fotoğrafı sayılır.
  origin: z.enum(["inventory", "commons", "upload"]).default("inventory"),
  author: z.string().nullable().default(null),
  license: z.string().nullable().default(null),
  license_url: z.string().nullable().default(null),
  source_url: z.string().nullable().default(null),
  modifications: DbText.nullable().default(null),
});
export type WorkPhoto = z.infer<typeof WorkPhotoSchema>;

/** Commons fotoğrafı mı (Wikidata bağlantısı ve CC atfı). */
export const isCommons = (p: Pick<WorkPhoto, "origin"> | undefined): boolean => p?.origin === "commons";

/** Fotoğraf üstünde kaynak etiketi ve atıf satırı gereken fotoğraf (Commons ya da admin'in yüklediği). */
export const isAttributed = (p: Pick<WorkPhoto, "origin"> | undefined): boolean => p?.origin === "commons" || p?.origin === "upload";

/** Bilgi kartının (yapım yılı, bani, dönem, özet) geldiği kitap sayfası. */
export const FactsSourceSchema = z.object({
  title: z.string(),
  url: z.string().nullable(),
  volume: z.number().nullable(),
  page: z.string().nullable(),
  pdf_page: z.number().nullable(),
});
export type FactsSource = z.infer<typeof FactsSourceSchema>;

export const WorkConditionSchema = z.enum(["intact", "restored", "damaged", "destroyed", "unknown"]);
export type WorkCondition = z.infer<typeof WorkConditionSchema>;

export const LocationPrecisionSchema = z.enum(["exact", "approximate", "unknown"]);
export type LocationPrecision = z.infer<typeof LocationPrecisionSchema>;

/** public.works_view satırı (RLS: anonim kullanıcı yalnızca verified eserleri görür). */
export const WorkRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: DbText,
  summary: DbText.nullable(),
  history: DbText.nullable(),
  architecture: DbText.nullable(),
  period: DbText.nullable(),
  built_year: z.number().nullable(),
  founder: z.string().nullable(),
  a11y_score: z.number().nullable(),
  district: z.string().nullable(),
  address: DbText.nullable(),
  condition: WorkConditionSchema,
  condition_note: DbText.nullable(),
  unesco: z.boolean(),
  location_precision: LocationPrecisionSchema,
  type_slug: z.string(),
  type_name: DbText,
  city_slug: z.string(),
  city_name: DbText,
  complex_slug: z.string().nullable(),
  complex_name: DbText.nullable(),
  lng: z.number().nullable(),
  lat: z.number().nullable(),
  sources: z.array(WorkSourceSchema),
  exhibitions: z.array(WorkExhibitionSchema),
  photos: z.array(WorkPhotoSchema),
  /** Admin panelinden yüklenen ses kaydının Storage yolu (audio bucket); yoksa metin okunur. */
  audio_tr: z.string().nullable(),
  audio_en: z.string().nullable(),
  // Eski önbellek satırlarında aşağıdakiler yok.
  facts_source: FactsSourceSchema.nullable().default(null),
  /** Gitmeden önce: kaynağı (`visit_source`) ve kontrol tarihi olmadan veritabanına girmez. */
  visit_steps: z.number().nullable().default(null),
  visit_ramp: z.boolean().nullable().default(null),
  visit_hours: DbText.nullable().default(null),
  visit_minutes: z.number().nullable().default(null),
  visit_note: DbText.nullable().default(null),
  visit_source: z.string().nullable().default(null),
  visit_checked_on: z.string().nullable().default(null),
});

/** PDF'i kitabın ilgili sayfasında açan adres (`#page=`); sayfa bilinmiyorsa kitabın kendisi. */
export function bookPageUrl(url: string, pdfPage: number | null | undefined): string {
  return pdfPage ? `${url}#page=${pdfPage}` : url;
}
export type WorkRow = z.infer<typeof WorkRowSchema>;

/** Haritada gösterilebilir eser (konumu bilinen). */
export type MappedWork = WorkRow & { lng: number; lat: number };
export const hasLocation = <W extends { lng: number | null; lat: number | null }>(w: W): w is W & { lng: number; lat: number } =>
  w.lng !== null && w.lat !== null;

/** Envanter kitabı kaynağı (varsa): "Bursa Vakıf Eserleri — Cilt 1, s. 106". */
export function inventorySource(w: Pick<WorkRow, "sources">): WorkSource | undefined {
  return w.sources.find((s) => s.kind === "inventory");
}

export const coverOf = (w: Pick<WorkRow, "photos">): WorkPhoto | undefined => w.photos[0];

/** Fotoğrafın herkese açık adresi; küçük boy istenirse ve varsa önizleme dosyası. */
export function mediaUrl(base: string, p: WorkPhoto, size: "thumb" | "full" = "full"): string {
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return prefix + (size === "thumb" && p.thumb ? p.thumb : p.path);
}

export function loc(text: LocalizedText | null | undefined, lang: "tr" | "en"): string {
  if (!text) return "";
  const val = lang === "en" ? text.en : text.tr;
  return val || text.tr || "";
}

export const CityRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: DbText,
  is_active: z.boolean(),
  sort_order: z.number(),
  inventory_year: z.number().nullable(),
  inventory_works: z.number().nullable(),
  inventory_photos: z.number().nullable(),
  inventory_status: z.enum(["published", "printing", "in_progress", "planned"]).nullable(),
  inventory_note: DbText.nullable(),
});
export type CityRow = z.infer<typeof CityRowSchema>;

export const ExhibitionRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: DbText,
  venue: DbText,
  starts_on: z.string().nullable(),
  ends_on: z.string().nullable(),
  photo_count: z.number().nullable(),
  description: DbText.nullable(),
  source_url: z.string().nullable(),
  city: z.object({ slug: z.string(), name: DbText }).nullable(),
});
export type ExhibitionRow = z.infer<typeof ExhibitionRowSchema>;
