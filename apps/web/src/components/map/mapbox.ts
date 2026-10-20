import mapboxgl from "mapbox-gl";

/**
 * Harita kütüphanesine ait kod yalnız bu klasörde (ileride kütüphane değişebilir). Mobil ve admin ile aynı
 * Mapbox Standard görünümü: düz (3B kapalı), dükkân etiketleri kapalı, soluk tema; eklenen katmanlar `slot: 'top'`.
 * Yüksek kontrastta tek renkli tema.
 */
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
mapboxgl.accessToken = MAPBOX_TOKEN;

/** Harita yazı tipi (Mapbox glif servisi). */
export const MAP_FONT = ["DIN Pro Medium", "Arial Unicode MS Regular"];

export function createMap(container: HTMLElement, center: [number, number], zoom: number, highContrast: boolean): mapboxgl.Map {
  const m = new mapboxgl.Map({
    container,
    style: "mapbox://styles/mapbox/standard",
    config: {
      basemap: {
        theme: highContrast ? "monochrome" : "faded",
        lightPreset: "day",
        show3dObjects: false,
        showPointOfInterestLabels: false,
      },
    },
    center,
    zoom,
    cooperativeGestures: true,
  });
  m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
  return m;
}

export { mapboxgl };
