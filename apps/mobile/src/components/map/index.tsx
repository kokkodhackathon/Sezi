import Mapbox, { Camera, CircleLayer, LineLayer, MapView, ShapeSource, StyleImport, SymbolLayer } from '@rnmapbox/maps';
import { palette, type LngLat } from '@sezi/shared';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { InteractionManager, StyleSheet, View, type ViewStyle } from 'react-native';

import { useIsDark, useSeziTheme } from '@/hooks/use-sezi-theme';
import { boundsOf } from '@/lib/nav';
import { useProfile } from '@/lib/profile';

/**
 * Uygulamanın harita katmanı (Mapbox). Ekranlar harita kütüphanesini doğrudan kullanmaz:
 * rota, nokta ve konum çizimleri buradaki bileşenlerle yapılır; kütüphane değişince yalnızca bu dosya değişir.
 */
void Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? null);

/** Harita yazı tipi (Mapbox glif servisi). */
const FONT = ['DIN Pro Medium', 'Arial Unicode MS Regular'];

/**
 * Mapbox Standard: düz (3B kapalı), dükkân etiketleri kapalı; zemin ve yeşil alan Çini paletine yakın.
 * Koyu temada gece ışığı, az gören profilinde tek renkli (monochrome) sade harita.
 */
function useStandardConfig() {
  const dark = useIsDark();
  const { profile } = useProfile();
  const low = profile?.vision === 'low';
  return {
    lightPreset: dark ? 'night' : 'day',
    theme: low ? 'monochrome' : 'faded',
    show3dObjects: false,
    showPointOfInterestLabels: false,
    showTransitLabels: true,
    showPlaceLabels: true,
    showRoadLabels: true,
    showPedestrianRoads: true,
    ...(dark || low ? {} : { colorLand: palette.ivory, colorRoads: '#E8DFD3', colorGreenspaces: '#DDE8D3', colorWater: '#BFDCDD' }),
  } as const;
}

type Padding = { top?: number; bottom?: number; left?: number; right?: number };
const pad = (p?: Padding) => ({ paddingTop: p?.top ?? 48, paddingBottom: p?.bottom ?? 48, paddingLeft: p?.left ?? 40, paddingRight: p?.right ?? 40 });

export interface SeziMapHandle {
  /** Noktaları ekrana sığdırır (tek nokta ise ona yakınlaşır). */
  fit(points: LngLat[], padding?: Padding): void;
  centerOn(p: LngLat, zoom?: number): void;
}

interface SeziMapProps {
  /** İlk görünüm: noktalar sığdırılır (tek nokta ise ona yakınlaşılır). */
  initial: LngLat[];
  initialPadding?: Padding;
  /** Tek nokta açılışındaki yakınlık. */
  initialZoom?: number;
  onPress?: (p: LngLat) => void;
  /** false: harita yalnızca gösterir (kaydırma, yakınlaştırma yok). */
  interactive?: boolean;
  accessibilityLabel: string;
  style?: ViewStyle;
  children?: ReactNode;
}

/**
 * Harita, ekranın ilk çizimi ve geçiş animasyonu bittikten sonra yüklenir:
 * ilk açılışta ekran akıcı kalır, harita hemen ardından gelir.
 */
function useDeferred() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => setReady(true), 120);
    });
    return () => {
      task.cancel();
      clearTimeout(timer);
    };
  }, []);
  return ready;
}

export const SeziMap = forwardRef<SeziMapHandle, SeziMapProps>(function SeziMap(
  { initial, initialPadding, initialZoom = 16.5, onPress, interactive = true, accessibilityLabel, style, children },
  ref,
) {
  const t = useSeziTheme();
  const camera = useRef<ComponentRef<typeof Camera>>(null);
  const ready = useDeferred();
  const config = useStandardConfig();
  useImperativeHandle(ref, () => ({
    fit(points, padding) {
      if (points.length === 0) return;
      if (points.length === 1) {
        camera.current?.setCamera({ centerCoordinate: points[0]!, zoomLevel: 17, animationDuration: 500 });
        return;
      }
      const [w, s, e, n] = boundsOf(points);
      camera.current?.setCamera({ bounds: { ne: [e, n], sw: [w, s] }, padding: pad(padding), animationDuration: 600 });
    },
    centerOn(p, zoom) {
      camera.current?.setCamera({ centerCoordinate: p, ...(zoom ? { zoomLevel: zoom } : {}), animationDuration: 500, animationMode: 'easeTo' });
    },
  }));
  const [w, s, e, n] = initial.length > 1 ? boundsOf(initial) : [0, 0, 0, 0];
  // İlk görünüm: noktaların ortası; sığdırma harita yüklenince yapılır.
  const defaultSettings = { centerCoordinate: initial.length > 1 ? ([(w + e) / 2, (s + n) / 2] as LngLat) : (initial[0] ?? ([29.0613, 40.1842] as LngLat)), zoomLevel: initial.length > 1 ? 15 : initialZoom };
  return (
    // Harita ekran okuyucuya tek öğe olarak sunulur; içerik ekrandaki listelerde yazılı olarak var.
    <View style={[{ backgroundColor: t.soft, overflow: 'hidden' }, style]} accessible accessibilityLabel={accessibilityLabel} importantForAccessibility="no-hide-descendants">
      {ready ? (
        <MapView
          style={StyleSheet.absoluteFill}
          styleURL="mapbox://styles/mapbox/standard"
          scaleBarEnabled={false}
          compassEnabled={false}
          pitchEnabled={false}
          scrollEnabled={interactive}
          zoomEnabled={interactive}
          rotateEnabled={interactive}
          logoPosition={{ bottom: 8, left: 8 }}
          attributionPosition={{ bottom: 8, right: 8 }}
          onPress={onPress ? (f) => onPress(f.geometry.coordinates as LngLat) : undefined}
          // Harita boyutu belli olunca ilk noktalar sığdırılır (ilk çizimde harita henüz yerleşmemiş olabilir).
          onDidFinishLoadingMap={() => {
            if (initial.length > 1) camera.current?.setCamera({ bounds: { ne: [e, n], sw: [w, s] }, padding: pad(initialPadding), animationDuration: 0 });
          }}>
          <StyleImport id="basemap" existing config={config} />
          <Camera ref={camera} defaultSettings={defaultSettings} />
          {children}
        </MapView>
      ) : null}
    </View>
  );
});

/** Rota çizgisi: yürünen kısım soluk, kalan kısım vurgulu. Etiketlerin altında, yolların üstünde. */
export function RouteLine({ id = 'route', line, walked }: { id?: string; line: LngLat[]; walked?: LngLat[] }) {
  const t = useSeziTheme();
  if (line.length < 2) return null;
  return (
    <>
      <ShapeSource id={`${id}-src`} shape={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } }}>
        <LineLayer id={`${id}-casing`} slot="middle" style={{ lineCap: 'round', lineJoin: 'round', lineColor: t.surface, lineWidth: 11 }} />
        <LineLayer id={`${id}-line`} slot="middle" style={{ lineCap: 'round', lineJoin: 'round', lineColor: t.primary, lineWidth: 6 }} />
      </ShapeSource>
      {walked && walked.length >= 2 ? (
        <ShapeSource id={`${id}-walked-src`} shape={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: walked } }}>
          <LineLayer id={`${id}-walked`} slot="middle" style={{ lineCap: 'round', lineJoin: 'round', lineColor: t.textMuted, lineWidth: 6, lineOpacity: 0.7 }} />
        </ShapeSource>
      ) : null}
    </>
  );
}

/** Ek çizgiler: kapalı yollar (kesikli) ya da karşılaştırmadaki diğer rotalar. */
export function ExtraLines({ id, data, color, width = 5, dashed, opacity = 1 }: { id: string; data: GeoJSON.FeatureCollection | GeoJSON.Feature; color: string; width?: number; dashed?: boolean; opacity?: number }) {
  return (
    <ShapeSource id={`${id}-src`} shape={data}>
      <LineLayer
        id={`${id}-line`}
        slot="middle"
        style={{ lineCap: dashed ? 'butt' : 'round', lineJoin: 'round', lineColor: color, lineWidth: width, lineOpacity: opacity, ...(dashed ? { lineDasharray: [1.4, 1] } : {}) }}
      />
    </ShapeSource>
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
  /** Türe özel renk (ör. külliye parçalarında eser türü). */
  color?: string;
}

/** Noktalar: sıra numaralı anlatım noktaları, yer işaretleri, başlangıçlar, eserler. Basılınca `onPress(id)`. */
export function PointsLayer({ id = 'points', points, onPress }: { id?: string; points: MapPoint[]; onPress?: (pointId: string) => void }) {
  const t = useSeziTheme();
  const color: Record<MapPointKind, string> = { story: t.accent, arrival: t.accent, landmark: t.text, start: t.primary, work: t.primary };
  const shape: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      properties: {
        id: p.id,
        color: p.done ? t.textMuted : (p.color ?? color[p.kind]),
        r: (p.order ? 12 : p.kind === 'landmark' || p.kind === 'work' ? 5 : 8) + (p.selected ? 3 : 0),
        order: p.order ? String(p.order) : '',
        label: p.label ?? '',
      },
      geometry: { type: 'Point', coordinates: p.location },
    })),
  };
  return (
    <ShapeSource
      id={`${id}-src`}
      shape={shape}
      hitbox={{ width: 24, height: 24 }}
      onPress={
        onPress
          ? (e) => {
              const hit = e.features[0]?.properties?.id;
              if (typeof hit === 'string') onPress(hit);
            }
          : undefined
      }>
      <CircleLayer id={`${id}-circle`} slot="top" style={{ circleRadius: ['get', 'r'], circleColor: ['get', 'color'], circleStrokeWidth: 2.5, circleStrokeColor: t.surface }} />
      <SymbolLayer id={`${id}-order`} slot="top" style={{ textField: ['get', 'order'], textFont: FONT, textSize: 13, textColor: t.onAccent, textAllowOverlap: true, textIgnorePlacement: true }} />
      <SymbolLayer
        id={`${id}-label`}
        slot="top"
        minZoomLevel={14.5}
        style={{ textField: ['get', 'label'], textFont: FONT, textSize: 12, textOffset: [0, 1.3], textAnchor: 'top', textMaxWidth: 9, textOptional: true, textColor: t.text, textHaloColor: t.surface, textHaloWidth: 1.5 }}
      />
    </ShapeSource>
  );
}

/** Eser haritası: kümelenmiş eserler; seçili eser vurgulu. Basılınca `onPress(slug)`. */
export function WorkClusters({ works, selected, onPress }: { works: { slug: string; location: LngLat; color: string }[]; selected: string | null; onPress: (slug: string) => void }) {
  const t = useSeziTheme();
  const shape: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: works.map((w) => ({ type: 'Feature', properties: { slug: w.slug, color: w.color }, geometry: { type: 'Point', coordinates: w.location } })),
  };
  return (
    <ShapeSource
      id="works-src"
      shape={shape}
      cluster
      clusterRadius={40}
      clusterMaxZoomLevel={15}
      hitbox={{ width: 24, height: 24 }}
      onPress={(e) => {
        const slug = e.features[0]?.properties?.slug;
        if (typeof slug === 'string') onPress(slug);
      }}>
      <CircleLayer id="works-clusters" slot="top" filter={['has', 'point_count']} style={{ circleRadius: ['step', ['get', 'point_count'], 18, 10, 22, 40, 28], circleColor: t.primary, circleStrokeWidth: 3, circleStrokeColor: t.surface }} />
      <SymbolLayer id="works-cluster-label" slot="top" filter={['has', 'point_count']} style={{ textField: ['get', 'point_count_abbreviated'], textSize: 14, textFont: FONT, textColor: t.onPrimary, textAllowOverlap: true }} />
      <CircleLayer id="works-circle" slot="top" filter={['!', ['has', 'point_count']]} style={{ circleRadius: 9, circleColor: ['get', 'color'], circleStrokeWidth: 3, circleStrokeColor: t.surface }} />
      <CircleLayer id="works-selected" slot="top" filter={['==', ['get', 'slug'], selected ?? '']} style={{ circleRadius: 15, circleColor: t.accent, circleStrokeWidth: 3, circleStrokeColor: t.surface }} />
    </ShapeSource>
  );
}

/** Tek eser işareti; konumu kesin değilse çevresinde yaklaşık alan. */
export function WorkPin({ location, approximate }: { location: LngLat; approximate?: boolean }) {
  const t = useSeziTheme();
  return (
    <ShapeSource id="work-src" shape={{ type: 'Point', coordinates: location }}>
      {approximate ? <CircleLayer id="work-area" slot="top" style={{ circleRadius: 46, circleColor: t.primary, circleOpacity: 0.14, circleStrokeWidth: 2, circleStrokeColor: t.primary }} /> : <></>}
      <CircleLayer id="work-halo" slot="top" style={{ circleRadius: 16, circleColor: t.surface }} />
      <CircleLayer id="work-circle" slot="top" style={{ circleRadius: 9, circleColor: t.accent, circleStrokeWidth: 3, circleStrokeColor: t.surface }} />
    </ShapeSource>
  );
}

/** Kullanıcı konumu: halka ve nokta. */
export function UserDot({ location }: { location: LngLat }) {
  const t = useSeziTheme();
  return (
    <ShapeSource id="me-src" shape={{ type: 'Point', coordinates: location }}>
      <CircleLayer id="me-halo" slot="top" style={{ circleRadius: 18, circleColor: t.primary, circleOpacity: 0.18 }} />
      <CircleLayer id="me-dot" slot="top" style={{ circleRadius: 8, circleColor: t.primary, circleStrokeWidth: 3, circleStrokeColor: t.surface }} />
    </ShapeSource>
  );
}

/** Başlangıç ve varış işaretleri. */
export function EndPin({ id, location, kind }: { id: string; location: LngLat; kind: 'start' | 'end' }) {
  const t = useSeziTheme();
  const fill = kind === 'end' ? t.accent : t.surface;
  const stroke = kind === 'end' ? t.surface : t.primary;
  return (
    <ShapeSource id={`${id}-src`} shape={{ type: 'Point', coordinates: location }}>
      <CircleLayer id={`${id}-pin`} slot="top" style={{ circleRadius: kind === 'end' ? 10 : 8, circleColor: fill, circleStrokeWidth: 3.5, circleStrokeColor: stroke }} />
    </ShapeSource>
  );
}
