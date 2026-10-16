import { useEffect, useRef } from 'react';

import type { PointRole, PointRow } from '../lib/data';
import { createMap, MAP_FONT, mapboxgl } from '../lib/mapbox';

type Pt = [number, number];

/** Rol renkleri (index.css token'ları). Haritada renk tek başına anlam taşımaz: yanında ad etiketi, sayfada liste ve lejant var. */
export const ROLE_COLOR: Record<PointRole, string> = {
  start: '#0B6E73',
  landmark: '#3A2A1E',
  story: '#B8321F',
  arrival: '#B07A12',
};
/** Birden çok rolü olan noktanın rengi bu sıradaki ilk rolden gelir. */
const ROLE_ORDER: PointRole[] = ['arrival', 'story', 'start', 'landmark'];
export const primaryRole = (roles: PointRole[]) => ROLE_ORDER.find((r) => roles.includes(r)) ?? roles[0]!;

/** Yarıçapı tetikleme için kullanılan roller. */
export const hasRadius = (roles: PointRole[]) => roles.includes('story') || roles.includes('arrival');

/** Merkez ve yarıçaptan (m) 48 köşeli daire poligonu. */
function circlePolygon(center: Pt, radiusM: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const dLat = radiusM / 110540;
  const dLng = radiusM / (111320 * Math.cos((center[1] * Math.PI) / 180));
  const ring: Pt[] = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * 2 * Math.PI;
    ring.push([center[0] + dLng * Math.cos(a), center[1] + dLat * Math.sin(a)]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

const round = (p: { lng: number; lat: number }): Pt => [Number(p.lng.toFixed(7)), Number(p.lat.toFixed(7))];

interface Props {
  points: PointRow[];
  selectedId: string | null;
  draft: Pt | null;
  /** Taslağın tetikleme yarıçapı (anlatım/varış değilse null). */
  draftRadius: number | null;
  center: Pt;
  onSelect: (id: string) => void;
  onPick: (p: Pt) => void;
}

/** Nokta haritası: noktaya tık seçer, boşluğa tık taslak konumu belirler; daire anlatım/varış yarıçapıdır. */
export function PointsMap({ points, selectedId, draft, draftRadius, center, onSelect, onPick }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const ready = useRef(false);
  const select = useRef(onSelect);
  const pick = useRef(onPick);
  select.current = onSelect;
  pick.current = onPick;
  const latest = useRef({ points, selectedId, draft, draftRadius });
  latest.current = { points, selectedId, draft, draftRadius };

  const sync = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    const { points: ps, selectedId: sel, draft: d, draftRadius: r } = latest.current;
    (m.getSource('points') as mapboxgl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: ps.map((p) => ({
        type: 'Feature',
        properties: { id: p.id, selected: p.id === sel, color: ROLE_COLOR[primaryRole(p.roles)], name: p.title.tr, draft: p.status !== 'verified' },
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      })),
    });
    const circles = ps.filter((p) => p.id !== sel && hasRadius(p.roles)).map((p) => circlePolygon([p.lng, p.lat], p.radius_m));
    if (d && r) circles.push(circlePolygon(d, r));
    (m.getSource('radius') as mapboxgl.GeoJSONSource).setData({ type: 'FeatureCollection', features: circles });
  };

  useEffect(() => {
    if (!box.current) return;
    const m = createMap(box.current, center, 16);
    m.on('load', () => {
      m.addSource('radius', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addSource('points', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'radius-fill', type: 'fill', slot: 'top', source: 'radius', paint: { 'fill-color': '#B8321F', 'fill-opacity': 0.12 } });
      m.addLayer({
        id: 'points-circle',
        type: 'circle',
        slot: 'top',
        source: 'points',
        paint: {
          'circle-radius': ['case', ['get', 'selected'], 10, 7],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': ['case', ['get', 'selected'], 3, 2],
          // Taslak noktalar soluk: yayında olmadığı bir bakışta anlaşılsın.
          'circle-opacity': ['case', ['get', 'draft'], 0.5, 1],
        },
      });
      m.addLayer({
        id: 'points-label',
        type: 'symbol',
        slot: 'top',
        source: 'points',
        layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-font': MAP_FONT },
        paint: { 'text-color': '#3A2A1E', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
      });
      ready.current = true;
      sync();
    });
    m.on('click', (e: mapboxgl.MapMouseEvent) => {
      // Stil henüz yüklenmediyse (yavaş ağ) noktalar çizilmemiştir: tık doğrudan konum seçer.
      const hit = ready.current ? m.queryRenderedFeatures(e.point, { layers: ['points-circle'] })[0] : undefined;
      const id = hit?.properties?.id as string | undefined;
      if (id) select.current(id);
      else pick.current(round(e.lngLat));
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
      ready.current = false;
    };
    // Harita bir kez kurulur; veri değişimi aşağıdaki etkilerde işlenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(sync, [points, selectedId, draft, draftRadius]);

  // Merkez (il) değişince ya da nokta seçilince oraya git.
  useEffect(() => {
    map.current?.jumpTo({ center });
  }, [center[0], center[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!draft) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = new mapboxgl.Marker({ color: '#B8321F', draggable: true }).setLngLat(draft).addTo(m);
      marker.current.on('dragend', () => pick.current(round(marker.current!.getLngLat())));
    } else {
      marker.current.setLngLat(draft);
    }
  }, [draft]);

  return <div ref={box} className="map" style={{ height: 560 }} role="application" aria-label="Nokta haritası: noktaya tıklayarak seçin, boş yere tıklayarak konum belirleyin" />;
}
