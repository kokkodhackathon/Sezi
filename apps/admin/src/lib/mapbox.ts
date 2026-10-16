import mapboxgl from 'mapbox-gl';

/**
 * Yönetim paneli haritaları (Mapbox GL JS). Uygulamayla aynı Mapbox Standard görünümü:
 * düz (3B kapalı), dükkân etiketleri kapalı, soluk tema; eklenen katmanlar `slot: 'top'` ile en üstte.
 */
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? '';

/** Harita yazı tipi (Mapbox glif servisi). */
export const MAP_FONT = ['DIN Pro Medium', 'Arial Unicode MS Regular'];

export function createMap(container: HTMLElement, center: [number, number], zoom: number): mapboxgl.Map {
  const m = new mapboxgl.Map({
    container,
    style: 'mapbox://styles/mapbox/standard',
    config: {
      basemap: {
        theme: 'faded',
        lightPreset: 'day',
        show3dObjects: false,
        showPointOfInterestLabels: false,
        // Uygulamayla aynı Çini zemini (packages/shared/src/theme.ts).
        colorLand: '#FAF7F2',
        colorRoads: '#E8DFD3',
        colorGreenspaces: '#DDE8D3',
        colorWater: '#BFDCDD',
      },
    },
    center,
    zoom,
  });
  m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
  return m;
}

export { mapboxgl };
