import { loc, searchWorks } from "@sezi/shared";

import type { WorkListItem } from "./data";
import type { Lang } from "./i18n";

/**
 * Ana sayfadaki keşif (arama + filtre + liste/harita): süzme tarayıcıda, yazarken anında yapılır.
 * Durum adreste tutulur (`/?q=&il=&tur=&ilce=&foto=1&kesin=1&gorunum=harita`); bağlantı paylaşılabilir, geri tuşu çalışır.
 */
export type ExploreItem = Pick<
  WorkListItem,
  "slug" | "name" | "type_slug" | "type_name" | "city_slug" | "city_name" | "district" | "lng" | "lat" | "location_precision" | "photos"
>;

/** İstemciye giden hafif satır: özet yok, yalnız kapak fotoğrafı (sayfa boyutu küçük kalsın). */
export const toExploreItem = (w: WorkListItem): ExploreItem => ({
  slug: w.slug,
  name: w.name,
  type_slug: w.type_slug,
  type_name: w.type_name,
  city_slug: w.city_slug,
  city_name: w.city_name,
  district: w.district,
  lng: w.lng,
  lat: w.lat,
  location_precision: w.location_precision,
  photos: w.photos.slice(0, 1),
});

export interface ExploreFilters {
  q: string;
  il: string;
  tur: string;
  ilce: string;
  foto: boolean;
  kesin: boolean;
  harita: boolean;
}

export const EMPTY_FILTERS: ExploreFilters = { q: "", il: "", tur: "", ilce: "", foto: false, kesin: false, harita: false };

export function parseFilters(search: string): ExploreFilters {
  const p = new URLSearchParams(search);
  const s = (k: string) => (p.get(k) ?? "").trim();
  return { q: s("q"), il: s("il"), tur: s("tur"), ilce: s("ilce"), foto: s("foto") === "1", kesin: s("kesin") === "1", harita: s("gorunum") === "harita" };
}

export function filtersToQuery(f: ExploreFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.il) p.set("il", f.il);
  if (f.tur) p.set("tur", f.tur);
  if (f.ilce) p.set("ilce", f.ilce);
  if (f.foto) p.set("foto", "1");
  if (f.kesin) p.set("kesin", "1");
  if (f.harita) p.set("gorunum", "harita");
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

export const hasActiveFilters = (f: ExploreFilters): boolean => Boolean(f.q || f.il || f.tur || f.ilce || f.foto || f.kesin);

/** Arama (ortak `searchWorks`, yazarken kelime başı eşleşmesi) ve filtreler. */
export function applyFilters(items: ExploreItem[], f: ExploreFilters, lang: Lang): ExploreItem[] {
  // Önce fotoğraflı, sonra ada göre; aramada eşit puanlı sonuçlar da bu sırada kalır (sıralama kararlı).
  const sorted = [...items].sort((a, b) => Number(b.photos.length > 0) - Number(a.photos.length > 0) || loc(a.name, lang).localeCompare(loc(b.name, lang), "tr"));
  const base = f.q ? searchWorks(f.q, sorted) : sorted;
  return base.filter(
    (w) =>
      (!f.il || w.city_slug === f.il) &&
      (!f.tur || w.type_slug === f.tur) &&
      (!f.ilce || w.district === f.ilce) &&
      (!f.foto || w.photos.length > 0) &&
      (!f.kesin || w.location_precision === "exact"),
  );
}
