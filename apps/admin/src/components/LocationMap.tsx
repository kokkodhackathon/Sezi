import { useEffect, useRef } from 'react';

import { createMap, mapboxgl } from '../lib/mapbox';

/**
 * Konum iğnesi: haritaya tıklamak ya da iğneyi sürüklemek konumu belirler.
 * Konum yoksa harita il merkezinde açılır; ilk tıklamada iğne düşer.
 */
export function LocationMap({ value, fallbackCenter, onChange }: { value: [number, number] | null; fallbackCenter: [number, number]; onChange: (p: [number, number]) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    if (!box.current) return;
    const m = createMap(box.current, value ?? fallbackCenter, value ? 17 : 12);
    m.on('click', (e: mapboxgl.MapMouseEvent) => change.current([Number(e.lngLat.lng.toFixed(7)), Number(e.lngLat.lat.toFixed(7))]));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // Harita bir kez kurulur; konum değişimi aşağıdaki etkide işlenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!value) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = new mapboxgl.Marker({ color: '#B8321F', draggable: true }).setLngLat(value).addTo(m);
      marker.current.on('dragend', () => {
        const p = marker.current!.getLngLat();
        change.current([Number(p.lng.toFixed(7)), Number(p.lat.toFixed(7))]);
      });
    } else {
      marker.current.setLngLat(value);
    }
  }, [value]);

  return <div ref={box} className="map" role="application" aria-label="Konum haritası: tıklayarak ya da iğneyi sürükleyerek konum seçin" />;
}
