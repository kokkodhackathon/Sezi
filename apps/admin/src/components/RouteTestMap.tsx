import { boundsOf, sliceLine, type LngLat, type NavPoint, type PilotNode, type ProfileKey, type StartPoint } from '@sezi/shared';
import { useEffect, useRef } from 'react';

import { createMap, MAP_FONT } from '@/lib/mapbox';
import { PROFILE_LINE } from '@/lib/route-test';
import { ROLE_COLOR, hasRadius } from './PointsMap';

/** Merkez ve yarıçaptan (m) 48 köşeli daire poligonu. */
function circlePolygon(center: LngLat, radiusM: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const dLat = radiusM / 110540;
  const dLng = radiusM / (111320 * Math.cos((center[1] * Math.PI) / 180));
  const ring: LngLat[] = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * 2 * Math.PI;
    ring.push([center[0] + dLng * Math.cos(a), center[1] + dLat * Math.sin(a)]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

const line = (coordinates: LngLat[]): GeoJSON.Feature<GeoJSON.LineString> => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } });
const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features });
const round = (p: { lng: number; lat: number }): LngLat => [Number(p.lng.toFixed(7)), Number(p.lat.toFixed(7))];

interface Props {
  center: LngLat;
  routeLine: LngLat[] | null;
  /** Rota boyunca yürünen mesafe (m): yürünen kısım koyu çizilir. */
  walkedM: number;
  detourLine: LngLat[] | null;
  blockedLines: LngLat[][];
  starts: StartPoint[];
  works: PilotNode[];
  points: NavPoint[];
  /** Rotanın uğradığı noktaların sırası (haritada numara). */
  order: Map<string, number>;
  fired: ReadonlySet<string>;
  selectedStart: string | null;
  pickedStart: LngLat | null;
  dest: string | null;
  position: LngLat | null;
  picking: boolean;
  onPick: (p: LngLat) => void;
  onStart: (id: string) => void;
  onDest: (slug: string) => void;
  /** Profil karşılaştırması açıksa her profilin rotası; tek rota yerine bunlar çizilir. */
  compare: { key: ProfileKey; line: LngLat[]; selected: boolean }[] | null;
}

/**
 * Rota testi haritası: rota, yürünen kısım, kapalı yollar, yanlış dönüş çizgisi, noktalar ve sanal yürüyüşçü.
 * Başlangıç noktasına tık başlangıcı, esere tık hedefi seçer; "haritadan seç" açıkken boş yere tık başlangıcı belirler.
 */
export function RouteTestMap(props: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const ready = useRef(false);
  const latest = useRef(props);
  latest.current = props;
  const fittedFor = useRef<unknown>(null);

  const sync = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    const p = latest.current;
    const set = (id: string, data: GeoJSON.FeatureCollection) => (m.getSource(id) as mapboxgl.GeoJSONSource).setData(data);

    set('route', fc(p.routeLine && !p.compare ? [line(p.routeLine)] : []));
    for (const key of Object.keys(PROFILE_LINE) as ProfileKey[]) {
      const c = p.compare?.find((x) => x.key === key);
      set(`cmp-${key}`, fc(c ? [{ ...line(c.line), properties: { selected: c.selected } }] : []));
    }
    set('walked', fc(p.routeLine && p.walkedM > 1 ? [line(sliceLine(p.routeLine, 0, p.walkedM))] : []));
    set('detour', fc(p.detourLine ? [line(p.detourLine)] : []));
    set('blocked', fc(p.blockedLines.map(line)));
    set('radius', fc(p.points.filter((x) => hasRadius(x.roles)).map((x) => circlePolygon(x.location, x.radiusM))));

    const feats: GeoJSON.Feature[] = [];
    for (const s of p.starts) {
      feats.push({
        type: 'Feature',
        properties: { kind: 'start', id: s.id, color: ROLE_COLOR.start, label: s.name.tr, selected: s.id === p.selectedStart, order: '' },
        geometry: { type: 'Point', coordinates: s.location },
      });
    }
    for (const w of p.works) {
      feats.push({
        type: 'Feature',
        properties: { kind: 'work', id: w.workSlug, color: w.workSlug === p.dest ? '#B8321F' : '#3A2A1E', label: w.name?.tr ?? '', selected: w.workSlug === p.dest, order: '' },
        geometry: { type: 'Point', coordinates: w.location },
      });
    }
    for (const x of p.points) {
      if (!hasRadius(x.roles)) continue;
      const n = p.order.get(x.id);
      feats.push({
        type: 'Feature',
        properties: {
          kind: 'point',
          id: x.id,
          color: p.fired.has(x.id) ? '#8C827A' : ROLE_COLOR[x.roles.includes('arrival') ? 'arrival' : 'story'],
          label: n ? '' : x.title.tr,
          selected: false,
          order: n ? String(n) : '',
        },
        geometry: { type: 'Point', coordinates: x.location },
      });
    }
    set('points', fc(feats));
    set('picked', fc(p.pickedStart ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p.pickedStart } }] : []));
    set('user', fc(p.position ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p.position } }] : []));
    m.getCanvas().style.cursor = p.picking ? 'crosshair' : '';

    // Yeni rota (ya da karşılaştırma kümesi) çizilince ekrana sığdırılır; yürürken kamera kendiliğinden kaymaz.
    const cmp = p.compare;
    if (cmp && cmp !== fittedFor.current && cmp.length) {
      fittedFor.current = cmp;
      const [w, s, e, n] = boundsOf(cmp.flatMap((c) => c.line));
      m.fitBounds([[w, s], [e, n]], { padding: 60, duration: 400, maxZoom: 18 });
    } else if (!cmp && p.routeLine && p.routeLine !== fittedFor.current && p.walkedM === 0) {
      fittedFor.current = p.routeLine;
      const [w, s, e, n] = boundsOf(p.routeLine);
      m.fitBounds([[w, s], [e, n]], { padding: 60, duration: 400, maxZoom: 18 });
    }
  };

  useEffect(() => {
    if (!box.current) return;
    const m = createMap(box.current, latest.current.center, 16);
    m.on('load', () => {
      for (const id of ['route', 'walked', 'detour', 'blocked', 'radius', 'points', 'picked', 'user']) {
        m.addSource(id, { type: 'geojson', data: fc([]) });
      }
      // Profil karşılaştırması: her profil kendi kaynağında, kalından inceye (kalın çizgi altta kalır).
      for (const key of Object.keys(PROFILE_LINE) as ProfileKey[]) {
        const s = PROFILE_LINE[key];
        m.addSource(`cmp-${key}`, { type: 'geojson', data: fc([]) });
        m.addLayer({
          id: `cmp-${key}`,
          type: 'line',
          slot: 'top',
          source: `cmp-${key}`,
          paint: { 'line-color': s.color, 'line-width': s.width, 'line-opacity': ['case', ['get', 'selected'], 1, 0.5], ...(s.dash ? { 'line-dasharray': s.dash } : {}) },
          layout: { 'line-join': 'round', ...(s.dash ? {} : { 'line-cap': 'round' as const }) },
        });
      }
      m.addLayer({ id: 'radius-fill', type: 'fill', slot: 'top', source: 'radius', paint: { 'fill-color': '#B8321F', 'fill-opacity': 0.08 } });
      m.addLayer({ id: 'route-casing', type: 'line', slot: 'top', source: 'route', paint: { 'line-color': '#FFFFFF', 'line-width': 10 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      m.addLayer({ id: 'route-line', type: 'line', slot: 'top', source: 'route', paint: { 'line-color': '#0B6E73', 'line-width': 6 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      m.addLayer({ id: 'walked-line', type: 'line', slot: 'top', source: 'walked', paint: { 'line-color': '#8C827A', 'line-width': 6 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      m.addLayer({ id: 'detour-line', type: 'line', slot: 'top', source: 'detour', paint: { 'line-color': '#B07A12', 'line-width': 4, 'line-dasharray': [1.5, 1.5] } });
      m.addLayer({ id: 'blocked-line', type: 'line', slot: 'top', source: 'blocked', paint: { 'line-color': '#8E1F1A', 'line-width': 7, 'line-dasharray': [1, 1] } });
      m.addLayer({
        id: 'points-circle',
        type: 'circle',
        slot: 'top',
        source: 'points',
        paint: {
          'circle-radius': ['case', ['!=', ['get', 'order'], ''], 11, ['get', 'selected'], 9, 6],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': ['case', ['get', 'selected'], 3, 2],
        },
      });
      m.addLayer({
        id: 'points-order',
        type: 'symbol',
        slot: 'top',
        source: 'points',
        layout: { 'text-field': ['get', 'order'], 'text-size': 12, 'text-font': MAP_FONT, 'text-allow-overlap': true, 'text-ignore-placement': true },
        paint: { 'text-color': '#FFFFFF' },
      });
      m.addLayer({
        id: 'points-label',
        type: 'symbol',
        slot: 'top',
        source: 'points',
        minzoom: 15.5,
        layout: { 'text-field': ['get', 'label'], 'text-size': 12, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-font': MAP_FONT, 'text-optional': true },
        paint: { 'text-color': '#3A2A1E', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 },
      });
      m.addLayer({ id: 'picked-dot', type: 'circle', slot: 'top', source: 'picked', paint: { 'circle-radius': 8, 'circle-color': '#0B6E73', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } });
      m.addLayer({ id: 'user-halo', type: 'circle', slot: 'top', source: 'user', paint: { 'circle-radius': 16, 'circle-color': '#0B6E73', 'circle-opacity': 0.2 } });
      m.addLayer({ id: 'user-dot', type: 'circle', slot: 'top', source: 'user', paint: { 'circle-radius': 8, 'circle-color': '#0B6E73', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } });
      ready.current = true;
      sync();
    });
    m.on('click', (e: mapboxgl.MapMouseEvent) => {
      const p = latest.current;
      if (p.picking || !ready.current) {
        p.onPick(round(e.lngLat));
        return;
      }
      const hit = m.queryRenderedFeatures(e.point, { layers: ['points-circle'] })[0];
      const kind = hit?.properties?.kind as string | undefined;
      const id = hit?.properties?.id as string | undefined;
      if (!id) return;
      if (kind === 'start') p.onStart(id);
      else if (kind === 'work') p.onDest(id);
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      ready.current = false;
    };
    // Harita bir kez kurulur; veri değişimi sync ile işlenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(sync);

  return (
    <div
      ref={box}
      className="h-[600px] w-full overflow-hidden rounded-lg border"
      role="application"
      aria-label="Rota testi haritası: başlangıç noktasına tıklayarak başlangıcı, esere tıklayarak hedefi seçin. Rota ve talimatlar sağdaki listede yazılıdır."
    />
  );
}
