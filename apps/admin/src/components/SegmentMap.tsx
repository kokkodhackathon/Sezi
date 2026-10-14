import * as maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { useEffect, useRef } from 'react';

const STYLE = 'https://tiles.openfreemap.org/styles/liberty';

/** Bildirilen yol parçasını mercan kırmızısı çizgiyle gösterir; seçim değişince haritayı ona kaydırır. */
export function SegmentMap({ line, center }: { line: [number, number][] | null; center: [number, number] }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const pending = useRef(line);
  pending.current = line;

  const draw = (m: maplibregl.Map, l: [number, number][] | null) => {
    const data: FeatureCollection = {
      type: 'FeatureCollection',
      features: l ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: l } }] : [],
    };
    const src = m.getSource('seg') as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(data);
    else {
      m.addSource('seg', { type: 'geojson', data });
      m.addLayer({ id: 'seg-casing', type: 'line', source: 'seg', paint: { 'line-color': '#FFFFFF', 'line-width': 12 } });
      m.addLayer({ id: 'seg-line', type: 'line', source: 'seg', paint: { 'line-color': '#B8321F', 'line-width': 7 } });
    }
    if (l && l.length > 1) {
      const b = new maplibregl.LngLatBounds(l[0], l[0]);
      for (const p of l) b.extend(p);
      m.fitBounds(b, { padding: 80, maxZoom: 18, duration: 400 });
    }
  };

  useEffect(() => {
    if (!box.current) return;
    const m = new maplibregl.Map({ container: box.current, style: STYLE, center, zoom: 16 });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.on('load', () => {
      ready.current = true;
      draw(m, pending.current);
    });
    map.current = m;
    return () => {
      ready.current = false;
      m.remove();
      map.current = null;
    };
    // Harita bir kez kurulur; çizgi değişimi aşağıdaki etkide işlenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (map.current && ready.current) draw(map.current, line);
  }, [line]);

  return <div ref={box} className="map" role="img" aria-label="Bildirilen yol parçasının haritası" />;
}
