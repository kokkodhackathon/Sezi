import { Camera, GeoJSONSource, Layer, type CameraRef } from '@maplibre/maplibre-react-native';
import type { LngLat } from '@sezi/shared';
import { forwardRef, useImperativeHandle, useRef, type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { DeferredMap } from '@/components/deferred-map';
import { useSeziTheme } from '@/hooks/use-sezi-theme';
import { boundsOf } from '@/lib/nav';

/**
 * Uygulamanın harita katmanı. Ekranlar harita kütüphanesini doğrudan kullanmaz: rota, nokta ve
 * konum çizimleri buradaki bileşenlerle yapılır; kütüphane değişince yalnızca bu dosya değişir.
 * Noktalar GeoJSON katmanıyla çizilir (MapLibre Marker RN 0.86'da çöküyor).
 */

/** Harita yazı tipleri (stil glifleri). */
const FONT = ['Noto Sans Regular'];

export interface SeziMapHandle {
  /** Çizgiyi ya da noktaları ekrana sığdırır (alt panel için `bottom` boşluğu). */
  fit(points: LngLat[], padding?: { top?: number; bottom?: number; left?: number; right?: number }): void;
  centerOn(p: LngLat, zoom?: number): void;
}

interface SeziMapProps {
  /** İlk görünüm: noktalar sığdırılır (tek nokta ise ona yakınlaşılır). */
  initial: LngLat[];
  initialPadding?: { top?: number; bottom?: number; left?: number; right?: number };
  onPress?: (p: LngLat) => void;
  accessibilityLabel: string;
  style?: ViewStyle;
  children?: ReactNode;
}

const pad = (p?: { top?: number; bottom?: number; left?: number; right?: number }) => ({ top: p?.top ?? 48, bottom: p?.bottom ?? 48, left: p?.left ?? 40, right: p?.right ?? 40 });

export const SeziMap = forwardRef<SeziMapHandle, SeziMapProps>(function SeziMap({ initial, initialPadding, onPress, accessibilityLabel, style, children }, ref) {
  const camera = useRef<CameraRef>(null);
  useImperativeHandle(ref, () => ({
    fit(points, padding) {
      if (points.length === 0) return;
      if (points.length === 1) camera.current?.easeTo({ center: points[0]!, zoom: 17, duration: 500 });
      else camera.current?.fitBounds(boundsOf(points), { padding: pad(padding), duration: 600 });
    },
    centerOn(p, zoom) {
      camera.current?.easeTo({ center: p, ...(zoom ? { zoom } : {}), duration: 500 });
    },
  }));
  const initialView = initial.length > 1 ? { bounds: boundsOf(initial), padding: pad(initialPadding) } : { center: initial[0] ?? ([29.0613, 40.1842] as LngLat), zoom: 16.5 };
  return (
    // Harita ekran okuyucuya tek öğe olarak sunulur; içerik ekrandaki listelerde yazılı olarak var.
    <View style={style} accessible accessibilityLabel={accessibilityLabel} importantForAccessibility="no-hide-descendants">
      <DeferredMap onPress={onPress ? (e) => onPress(e.nativeEvent.lngLat as LngLat) : undefined} logo={false} attributionPosition={{ bottom: 8, left: 8 }}>
        <Camera ref={camera} initialViewState={initialView} />
        {children}
      </DeferredMap>
    </View>
  );
});

/** Rota çizgisi: yürünen kısım soluk, kalan kısım vurgulu. */
export function RouteLine({ id = 'route', line, walked }: { id?: string; line: LngLat[]; walked?: LngLat[] }) {
  const t = useSeziTheme();
  if (line.length < 2) return null;
  return (
    <>
      <GeoJSONSource id={`${id}-src`} data={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } }}>
        <Layer id={`${id}-casing`} type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': t.surface, 'line-width': 11 }} />
        <Layer id={`${id}-line`} type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': t.primary, 'line-width': 6 }} />
      </GeoJSONSource>
      {walked && walked.length >= 2 ? (
        <GeoJSONSource id={`${id}-walked-src`} data={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: walked } }}>
          <Layer id={`${id}-walked`} type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': t.textMuted, 'line-width': 6, 'line-opacity': 0.7 }} />
        </GeoJSONSource>
      ) : null}
    </>
  );
}

/** Ek çizgiler: kapalı yollar (kesikli, tehlike rengi) ya da karşılaştırmadaki diğer rotalar. */
export function ExtraLines({ id, data, color, width = 5, dashed, opacity = 1 }: { id: string; data: GeoJSON.FeatureCollection | GeoJSON.Feature; color: string; width?: number; dashed?: boolean; opacity?: number }) {
  return (
    <GeoJSONSource id={`${id}-src`} data={data}>
      <Layer
        id={`${id}-line`}
        type="line"
        layout={{ 'line-cap': dashed ? 'butt' : 'round', 'line-join': 'round' }}
        paint={{ 'line-color': color, 'line-width': width, 'line-opacity': opacity, ...(dashed ? { 'line-dasharray': [1.4, 1] as never } : {}) }}
      />
    </GeoJSONSource>
  );
}

export type MapPointKind = 'story' | 'arrival' | 'landmark' | 'start' | 'work';

export interface MapPoint {
  id: string;
  location: LngLat;
  kind: MapPointKind;
  /** Rotadaki sıra numarası (uğranacak noktalar). */
  order?: number;
  label?: string;
  /** Açılmış / geçilmiş nokta: soluk. */
  done?: boolean;
  selected?: boolean;
}

/** Noktalar: sıra numaralı anlatım noktaları, yer işaretleri, başlangıçlar, eserler. Basılınca `onPress(id)`. */
export function PointsLayer({ id = 'points', points, onPress }: { id?: string; points: MapPoint[]; onPress?: (pointId: string) => void }) {
  const t = useSeziTheme();
  const color: Record<MapPointKind, string> = { story: t.accent, arrival: t.accent, landmark: t.text, start: t.primary, work: t.primary };
  const data: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      properties: {
        id: p.id,
        color: p.done ? t.textMuted : color[p.kind],
        r: p.order ? 12 : p.kind === 'landmark' || p.kind === 'work' ? 5 : 7,
        order: p.order ? String(p.order) : '',
        label: p.label ?? '',
        selected: !!p.selected,
      },
      geometry: { type: 'Point', coordinates: p.location },
    })),
  };
  return (
    <GeoJSONSource id={`${id}-src`} data={data} onPress={onPress ? (e) => {
      const hit = e.nativeEvent.features[0]?.properties?.id;
      if (typeof hit === 'string') onPress(hit);
    } : undefined}>
      <Layer
        id={`${id}-circle`}
        type="circle"
        paint={{
          'circle-radius': ['case', ['get', 'selected'], ['+', ['get', 'r'], 3], ['get', 'r']] as never,
          'circle-color': ['get', 'color'] as never,
          'circle-stroke-width': 2.5,
          'circle-stroke-color': t.surface,
        }}
      />
      <Layer id={`${id}-order`} type="symbol" layout={{ 'text-field': ['get', 'order'] as never, 'text-font': FONT, 'text-size': 13, 'text-allow-overlap': true, 'text-ignore-placement': true }} paint={{ 'text-color': t.onAccent }} />
      <Layer
        id={`${id}-label`}
        type="symbol"
        minzoom={14.5}
        layout={{ 'text-field': ['get', 'label'] as never, 'text-font': FONT, 'text-size': 12, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-max-width': 9, 'text-optional': true }}
        paint={{ 'text-color': t.text, 'text-halo-color': t.surface, 'text-halo-width': 1.5 }}
      />
    </GeoJSONSource>
  );
}

/** Kullanıcı konumu: halka ve nokta. */
export function UserDot({ location }: { location: LngLat }) {
  const t = useSeziTheme();
  return (
    <GeoJSONSource id="me-src" data={{ type: 'Point', coordinates: location }}>
      <Layer id="me-halo" type="circle" paint={{ 'circle-radius': 18, 'circle-color': t.primary, 'circle-opacity': 0.18 }} />
      <Layer id="me-dot" type="circle" paint={{ 'circle-radius': 8, 'circle-color': t.primary, 'circle-stroke-width': 3, 'circle-stroke-color': t.surface }} />
    </GeoJSONSource>
  );
}

/** Başlangıç ve varış işaretleri. */
export function EndPin({ id, location, kind }: { id: string; location: LngLat; kind: 'start' | 'end' }) {
  const t = useSeziTheme();
  const fill = kind === 'end' ? t.accent : t.surface;
  const stroke = kind === 'end' ? t.surface : t.primary;
  return (
    <GeoJSONSource id={`${id}-src`} data={{ type: 'Point', coordinates: location }}>
      <Layer id={`${id}-pin`} type="circle" paint={{ 'circle-radius': kind === 'end' ? 10 : 8, 'circle-color': fill, 'circle-stroke-width': 3.5, 'circle-stroke-color': stroke }} />
    </GeoJSONSource>
  );
}
