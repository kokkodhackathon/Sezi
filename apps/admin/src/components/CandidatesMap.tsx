import { useEffect, useRef } from 'react';

import { createMap, MAP_FONT, mapboxgl } from '@/lib/mapbox';
import { SOURCE_COLOR, type Candidate } from '@/lib/review';

type Pt = [number, number];

interface Props {
  workId: string;
  /** Eserin şu anki konumu (yoksa null). */
  current: Pt | null;
  candidates: Candidate[];
  selectedId: string | null;
  fallbackCenter: Pt;
  onSelect: (id: string) => void;
}

/**
 * Aday haritası: eserin şu anki konumu halkayla, adaylar kart numarasıyla çizilir.
 * Vetolu aday içi boş daire; seçili aday büyür. Görünüm tüm noktaları kapsayacak biçimde ayarlanır.
 */
export function CandidatesMap({ workId, current, candidates, selectedId, fallbackCenter, onSelect }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const ready = useRef(false);
  const select = useRef(onSelect);
  select.current = onSelect;
  const latest = useRef({ current, candidates, selectedId });
  latest.current = { current, candidates, selectedId };

  const sync = (fit: boolean) => {
    const m = map.current;
    if (!m || !ready.current) return;
    const { current: cur, candidates: cs, selectedId: sel } = latest.current;
    (m.getSource('candidates') as mapboxgl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: cs.map((c, i) => ({
        type: 'Feature',
        properties: {
          id: c.id,
          n: String(i + 1),
          color: SOURCE_COLOR[c.source],
          vetoed: c.vetoed,
          selected: c.id === sel,
          dim: c.status === 'rejected',
        },
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      })),
    });
    (m.getSource('current') as mapboxgl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: cur ? [{ type: 'Feature', properties: { label: 'Şu anki konum' }, geometry: { type: 'Point', coordinates: cur } }] : [],
    });
    if (!fit) return;
    const pts: Pt[] = [...(cur ? [cur] : []), ...cs.map((c): Pt => [c.lng, c.lat])];
    if (pts.length === 0) {
      m.jumpTo({ center: fallbackCenter, zoom: 11 });
    } else if (pts.length === 1) {
      m.jumpTo({ center: pts[0]!, zoom: 17 });
    } else {
      const b = new mapboxgl.LngLatBounds(pts[0]!, pts[0]!);
      for (const p of pts) b.extend(p);
      m.fitBounds(b, { padding: 60, maxZoom: 17, duration: 0 });
    }
  };

  useEffect(() => {
    if (!box.current) return;
    const m = createMap(box.current, current ?? fallbackCenter, current ? 16 : 11);
    m.on('load', () => {
      m.addSource('current', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addSource('candidates', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({
        id: 'current-ring',
        type: 'circle',
        slot: 'top',
        source: 'current',
        paint: { 'circle-radius': 16, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#B8321F', 'circle-stroke-width': 3 },
      });
      m.addLayer({
        id: 'current-label',
        type: 'symbol',
        slot: 'top',
        source: 'current',
        layout: { 'text-field': ['get', 'label'], 'text-size': 12, 'text-offset': [0, -2.2], 'text-anchor': 'bottom', 'text-font': MAP_FONT },
        paint: { 'text-color': '#8E1F1A', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
      });
      m.addLayer({
        id: 'cand-circle',
        type: 'circle',
        slot: 'top',
        source: 'candidates',
        paint: {
          'circle-radius': ['case', ['get', 'selected'], 14, 11],
          'circle-color': ['case', ['get', 'vetoed'], '#FFFFFF', ['get', 'color']],
          'circle-stroke-color': ['case', ['get', 'vetoed'], ['get', 'color'], '#FFFFFF'],
          'circle-stroke-width': ['case', ['get', 'selected'], 4, 2],
          'circle-opacity': ['case', ['get', 'dim'], 0.4, 1],
          'circle-stroke-opacity': ['case', ['get', 'dim'], 0.4, 1],
        },
      });
      m.addLayer({
        id: 'cand-num',
        type: 'symbol',
        slot: 'top',
        source: 'candidates',
        layout: { 'text-field': ['get', 'n'], 'text-size': 12, 'text-font': MAP_FONT, 'text-allow-overlap': true, 'text-ignore-placement': true },
        paint: { 'text-color': ['case', ['get', 'vetoed'], ['get', 'color'], '#FFFFFF'] },
      });
      ready.current = true;
      sync(true);
    });
    m.on('click', (e: mapboxgl.MapMouseEvent) => {
      if (!ready.current) return;
      const hit = m.queryRenderedFeatures(e.point, { layers: ['cand-circle'] })[0];
      const id = hit?.properties?.id as string | undefined;
      if (id) select.current(id);
    });
    m.on('mouseenter', 'cand-circle', () => (m.getCanvas().style.cursor = 'pointer'));
    m.on('mouseleave', 'cand-circle', () => (m.getCanvas().style.cursor = ''));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      ready.current = false;
    };
    // Harita bir kez kurulur; veri değişimi aşağıdaki etkilerde işlenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Eser değişince görünüm yeniden kadrajlanır; yalnız seçim ya da durum değişince kadraj korunur.
  useEffect(() => sync(true), [workId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => sync(false), [candidates, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={box} className="h-[calc(100vh-300px)] min-h-[420px] w-full overflow-hidden rounded-xl border border-border" role="application" aria-label="Aday haritası: numaralı noktalar sağdaki kartlarla aynıdır; tıklayarak seçin" />;
}
