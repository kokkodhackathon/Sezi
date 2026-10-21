import "server-only";

import DottedMap from "dotted-map";

import type { ExploreItem } from "./explore";

/** Noktalı Türkiye haritası: noktalar tek SVG yolu (sayfa küçük kalsın), il işaretleri yüzde konumuyla. */
export interface CityPin {
  slug: string;
  /** Haritadaki konum, kutunun yüzdesi olarak (0-100). */
  x: number;
  y: number;
}

export interface TurkeyMapData {
  width: number;
  height: number;
  /** Her nokta sıfır uzunlukta bir çizgi; yuvarlak uçla daire olarak çizilir. */
  path: string;
  pins: CityPin[];
}

const HEIGHT = 36;

/**
 * Harita sunucuda bir kez üretilir (dünya sınırları paketi istemciye gitmez). İl işaretinin yeri sabit değil:
 * o ildeki konumu bilinen eserlerin ortalamasıdır; yeni il veri olarak eklenince haritada kendiliğinden çıkar.
 */
export function buildTurkeyMap(items: ExploreItem[], cityOrder: string[]): TurkeyMapData {
  const map = new DottedMap({ height: HEIGHT, countries: ["TUR"], grid: "diagonal" });
  const { width, height } = map.image;
  const path = map
    .getPoints()
    .map((p) => `M${+p.x.toFixed(2)} ${+p.y.toFixed(2)}h0`)
    .join("");

  const sums = new Map<string, { lng: number; lat: number; n: number }>();
  for (const w of items) {
    if (w.lng === null || w.lat === null) continue;
    const s = sums.get(w.city_slug) ?? { lng: 0, lat: 0, n: 0 };
    s.lng += w.lng;
    s.lat += w.lat;
    s.n++;
    sums.set(w.city_slug, s);
  }
  const pins = cityOrder.flatMap((slug) => {
    const s = sums.get(slug);
    const pin = s ? map.getPin({ lat: s.lat / s.n, lng: s.lng / s.n }) : undefined;
    return pin ? [{ slug, x: (pin.x / width) * 100, y: (pin.y / height) * 100 }] : [];
  });
  return { width, height, path, pins };
}
