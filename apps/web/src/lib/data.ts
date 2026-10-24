import "server-only";

import {
  CityRowSchema,
  ExhibitionRowSchema,
  NAV_POINT_COLUMNS,
  TOUR_COLUMNS,
  toTours,
  toWorkPoints,
  WORK_TEXT_COLUMNS,
  workTextRows,
  type NavPoint,
  WorkRowSchema,
  type CityRow,
  type ExhibitionRow,
  type OverrideType,
  type Tour,
  type WorkRow,
} from "@sezi/shared";
import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { z } from "zod";

import { PILOT_SLUGS } from "@/lib/pilot-slugs";

/**
 * Sunucu veri katmanı: sorgular anonim çalışır, RLS yalnız `verified` içeriği döndürür (ayrıca her sorguda
 * `status = verified`, mobil kalıbı). Sayfalar `revalidate = 600` ile 10 dakikada bir yenilenir (ISR).
 * Sorgu hatası atılır; `[lang]/error.tsx` gösterir, ISR'da son başarılı sayfa kalır.
 */
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Pilot alan (gömülü grafikteki `area`); sunucu dosyası 470 KB'lık grafiği içe aktarmasın diye sabit. */
export const PILOT_AREA = "bursa-hanlar";

const WORK_LIST_COLUMNS =
  "slug, name, type_slug, type_name, city_slug, city_name, district, complex_slug, complex_name, lng, lat, location_precision, unesco, photos, summary";

export const WorkListItemSchema = WorkRowSchema.pick({
  slug: true,
  name: true,
  type_slug: true,
  type_name: true,
  city_slug: true,
  city_name: true,
  district: true,
  complex_slug: true,
  complex_name: true,
  lng: true,
  lat: true,
  location_precision: true,
  unesco: true,
  photos: true,
  summary: true,
});
export type WorkListItem = z.infer<typeof WorkListItemSchema>;

/** Yayındaki tüm eserler, liste kolonlarıyla (istek başına bir kez). */
export const getWorkIndex = cache(async (): Promise<WorkListItem[]> => {
  const { data, error } = await supabase.from("works_view").select(WORK_LIST_COLUMNS).eq("status", "verified").order("slug");
  if (error) throw error;
  return z.array(WorkListItemSchema).parse(data);
});

export const getWork = cache(async (slug: string): Promise<WorkRow | null> => {
  const { data, error } = await supabase.from("works_view").select("*").eq("status", "verified").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data ? WorkRowSchema.parse(data) : null;
});

/** Yayındaki hazır turlar (admin › Turlar); sıra istemcide rota grafiğiyle hesaplanır. */
export const getTours = cache(async (): Promise<Tour[]> => {
  const { data, error } = await supabase.from("tours_view").select(TOUR_COLUMNS).eq("status", "verified");
  if (error) throw error;
  return toTours(data ?? []);
});

/** Envanter illeri: aktif olanlar ve sıradaki iller (mobil `useCities`). */
export const getCities = cache(async (): Promise<CityRow[]> => {
  const { data, error } = await supabase
    .from("cities")
    .select("id, slug, name, is_active, sort_order, inventory_year, inventory_works, inventory_photos, inventory_status, inventory_note")
    .not("inventory_year", "is", null)
    .order("sort_order");
  if (error) throw error;
  return z.array(CityRowSchema).parse(data);
});

export const getExhibitions = cache(async (): Promise<ExhibitionRow[]> => {
  const { data, error } = await supabase
    .from("exhibitions")
    .select("id, slug, title, venue, starts_on, ends_on, photo_count, description, source_url, city:cities(slug, name)")
    .eq("status", "verified")
    .order("starts_on", { ascending: false });
  if (error) throw error;
  return z.array(ExhibitionRowSchema).parse(data);
});

const InventoryBookSchema = z.object({
  id: z.string(),
  title: z.string(),
  year: z.number().nullable(),
  url: z.string().nullable(),
  volume: z.number().nullable(),
  city_id: z.string().nullable(),
});
export type InventoryBook = z.infer<typeof InventoryBookSchema>;

/** Envanter kitapları (Hakkında › Kaynaklar). */
export const getInventoryBooks = cache(async (): Promise<InventoryBook[]> => {
  const { data, error } = await supabase.from("sources").select("id, title, year, url, volume, city_id").eq("kind", "inventory").order("title");
  if (error) throw error;
  return z.array(InventoryBookSchema).parse(data);
});

const OverrideRowSchema = z.object({
  segment_key: z.string(),
  type: z.enum(["stairs", "ramp_blocked", "narrow_path", "surface_damage", "construction", "other"]) satisfies z.ZodType<OverrideType>,
});

export interface NavOverlay {
  /** `nav_points_view` satırları; istemcide `toNavPoints` ile ayrıştırılır. */
  points: unknown[];
  overrides: { segment_key: string; type: OverrideType }[];
  /** Pilot alan eserlerinin anlatımı: yayındaki sade özet, yoksa tarihçenin ilk cümleleri (sunucuda kısaltılır). Varışta önce bu gösterilir (`arrivalText`). */
  works: NavPoint[];
}

/** Rota grafiğine uygulanan admin verisi: yayındaki noktalar ve onaylı yol düzeltmeleri (admin ile aynı sıra). */
export const getNavOverlay = cache(async (): Promise<NavOverlay> => {
  const [points, overrides, works] = await Promise.all([
    supabase.from("nav_points_view").select(NAV_POINT_COLUMNS).eq("status", "verified"),
    supabase.from("segment_overrides").select("segment_key, type").eq("area", PILOT_AREA),
    supabase
      .from("works_view")
      .select(WORK_TEXT_COLUMNS)
      .eq("status", "verified")
      .eq("location_precision", "exact")
      .in("slug", [...PILOT_SLUGS]),
  ]);
  if (points.error) throw points.error;
  if (overrides.error) throw overrides.error;
  if (works.error) throw works.error;
  return {
    points: points.data ?? [],
    overrides: z.array(OverrideRowSchema).parse(overrides.data),
    works: toWorkPoints(workTextRows(works.data ?? [], () => true)),
  };
});
