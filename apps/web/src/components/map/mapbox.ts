import { MAP_PITCH, type SweetTheme } from "@sezi/shared";
import mapboxgl from "mapbox-gl";

/**
 * Harita kütüphanesine ait kod yalnız bu klasörde (ileride kütüphane değişebilir). Mobil ile aynı
 * Mapbox Standard görünümü: dükkân etiketleri kapalı, soluk tema, kara zemini sayfa zemininde; 3B binalar ve
 * eğik bakış açık. Sade haritada (yüksek kontrast, az gören profili) tek renkli ve düz: gölgeli cepheler
 * kontrastı düşürür. Hareket azaltmada eğik bakış yok.
 */
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
mapboxgl.accessToken = MAPBOX_TOKEN;

/** Harita yazı tipi (Mapbox glif servisi). */
export const MAP_FONT = ["DIN Pro Medium", "Arial Unicode MS Regular"];

// Mapbox Standard açık tema için doğal arazi sabitleri (yol, park, su; mobil haritayla aynı); arayüz token'ı değildir.
const MAP_ROADS = "#E8DFD3";
const MAP_GREEN = "#DDE8D3";
const MAP_WATER = "#BFDCDD";

export interface MapLook {
  /** Tek renkli, düz harita (yüksek kontrast ya da az gören profili). */
  plain: boolean;
  /** Eğik bakış (sade haritada ve hareket azaltmada kapalı). */
  pitched: boolean;
  theme: SweetTheme;
}

export const mapPitch = (look: MapLook) => (look.pitched ? MAP_PITCH : 0);

export function createMap(
  container: HTMLElement,
  center: [number, number],
  zoom: number,
  look: MapLook,
  options: { miniMap: boolean; zoomInLabel: string; zoomOutLabel: string } = {
    miniMap: false,
    zoomInLabel: "Zoom in",
    zoomOutLabel: "Zoom out",
  },
): mapboxgl.Map {
  const m = new mapboxgl.Map({
    container,
    style: "mapbox://styles/mapbox/standard",
    config: {
      basemap: {
        theme: look.plain ? "monochrome" : "faded",
        lightPreset: "day",
        show3dObjects: !look.plain,
        showPointOfInterestLabels: false,
        ...(look.plain ? {} : { colorLand: look.theme.background, colorRoads: MAP_ROADS, colorGreenspaces: MAP_GREEN, colorWater: MAP_WATER }),
      },
    },
    center,
    zoom,
    pitch: mapPitch(look),
    pitchWithRotate: look.pitched,
    cooperativeGestures: !options.miniMap,
    scrollZoom: !options.miniMap,
    // Etiket solması haritayı yüzlerce milisaniye meşgul eder; rota katmanı solmadan da okunur.
    fadeDuration: 0,
  });
  if (!look.pitched) m.touchPitch.disable();
  const navigation = new mapboxgl.NavigationControl({ showCompass: false });
  m.addControl(navigation, "top-right");
  if (options.miniMap) {
    const container = m.getContainer();
    const zoomIn = container.querySelector<HTMLButtonElement>(".mapboxgl-ctrl-zoom-in");
    const zoomOut = container.querySelector<HTMLButtonElement>(".mapboxgl-ctrl-zoom-out");
    if (zoomIn) zoomIn.setAttribute("aria-label", options.zoomInLabel);
    if (zoomOut) zoomOut.setAttribute("aria-label", options.zoomOutLabel);
  }
  return m;
}

export { mapboxgl };
