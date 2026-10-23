import Mapbox, { Camera, CircleLayer, FillExtrusionLayer, FillLayer, Image as MapImage, Images, LineLayer, MapView, ShapeSource, StyleImport, SymbolLayer } from '@rnmapbox/maps';
import { GLYPH_TYPES, glyphType, LANDMARK_FULL_ZOOM, LANDMARK_MIN_ZOOM, LANDMARK_OPACITY, MAP_PITCH, PilotBuildingsSchema, toneForType, type LngLat } from '@sezi/shared';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { InteractionManager, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { WorkGlyphInline } from '@/design/work-glyph';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useIsDark, useSweetTheme } from '@/hooks/use-sweet-theme';
import { boundsOf } from '@/lib/nav';
import { useProfile } from '@/lib/profile';

import pilotBuildings from '../../../assets/pilot/bursa-hanlar-buildings.json';

/**
 * Uygulamanın harita katmanı (Mapbox). Ekranlar harita kütüphanesini doğrudan kullanmaz:
 * rota, nokta ve konum çizimleri buradaki bileşenlerle yapılır; kütüphane değişince yalnızca bu dosya değişir.
 */
void Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? null);

/** Harita yazı tipi (Mapbox glif servisi). */
const FONT = ['DIN Pro Medium', 'Arial Unicode MS Regular'];

// Mapbox Standard açık tema harita katmanı için doğal arazi sabitleri (yol, park, su); arayüz yüzey token'ı değildir.
const MAP_ROADS = '#E8DFD3';
const MAP_GREEN = '#DDE8D3';
const MAP_WATER = '#BFDCDD';

/**
 * Mapbox Standard: dükkân etiketleri kapalı; kara zemini sayfa zeminiyle (`t.background`) uyumlu.
 * 3B binalar açık (Standard'ın kendi verisi); pilot alanın yer işaretleri ayrıca vurgulanır (`PilotLandmarks`).
 * Koyu temada gece ışığı; az gören profilinde ve yüksek kontrastta tek renkli, düz harita (3B yok:
 * gölgeli cepheler kontrastı düşürür).
 */
function useStandardConfig() {
  const dark = useIsDark();
  const t = useSweetTheme();
  const { profile } = useProfile();
  const plain = profile?.vision === 'low' || t.outlined;
  return {
    lightPreset: dark ? 'night' : 'day',
    theme: plain ? 'monochrome' : 'faded',
    show3dObjects: !plain,
    showPointOfInterestLabels: false,
    showTransitLabels: true,
    showPlaceLabels: true,
    showRoadLabels: true,
    showPedestrianRoads: true,
    ...(dark || plain ? {} : { colorLand: t.background, colorRoads: MAP_ROADS, colorGreenspaces: MAP_GREEN, colorWater: MAP_WATER }),
  } as const;
}

/** Eğik (3B) bakış: yalnız etkileşimli haritada, hareket azaltma ve sade harita (az gören, yüksek kontrast) kapalıyken. */
function usePitch(interactive: boolean) {
  const t = useSweetTheme();
  const reduced = useReducedMotion();
  const { profile } = useProfile();
  return interactive && !reduced && !t.outlined && profile?.vision !== 'low' ? MAP_PITCH : 0;
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
  style?: StyleProp<ViewStyle>;
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
  const t = useSweetTheme();
  const camera = useRef<ComponentRef<typeof Camera>>(null);
  const ready = useDeferred();
  const config = useStandardConfig();
  const pitch = usePitch(interactive);
  // defaultSettings yalnız ilk açılışta uygulanır: profil, yüksek kontrast ya da hareket azaltma harita açıkken
  // değişirse eğim mevcut kameraya animasyonsuz taşınır (düz haritaya geçişte kamera eğik kalmasın).
  useEffect(() => {
    camera.current?.setCamera({ pitch, animationDuration: 0 });
  }, [pitch]);
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
  const defaultSettings = {
    centerCoordinate: initial.length > 1 ? ([(w + e) / 2, (s + n) / 2] as LngLat) : (initial[0] ?? ([29.0613, 40.1842] as LngLat)),
    zoomLevel: initial.length > 1 ? 15 : initialZoom,
    pitch,
  };
  return (
    // Harita ekran okuyucuya tek öğe olarak sunulur; içerik ekrandaki listelerde yazılı olarak var.
    <View style={[{ backgroundColor: t.soft, overflow: 'hidden' }, style]} accessible accessibilityLabel={accessibilityLabel} importantForAccessibility="no-hide-descendants">
      {ready ? (
        <MapView
          style={StyleSheet.absoluteFill}
          styleURL="mapbox://styles/mapbox/standard"
          scaleBarEnabled={false}
          compassEnabled={false}
          pitchEnabled={pitch > 0}
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
          <TypeIcons />
          <PilotDistrict />
          <PilotLandmarks />
          {children}
        </MapView>
      ) : null}
    </View>
  );
});

/** Harita resim adı: tema değişince yeni ad, eski resim önbellekte kalmaz. Simgesi olmayan tür `diger`. */
const iconName = (slug: string, theme: string) => `type-${theme}-${glyphType(slug)}`;
const ICON_SIZE = 30;

/**
 * Eser türü simgeleri: yüzey renginde yuvarlak, kenarı ve glifi tür mürekkebinde. Siluet türü anlatır,
 * renk tek başına anlam taşımaz. Native taraf her görünümü bir kez resme çevirir.
 */
function TypeIcons() {
  const t = useSweetTheme();
  const theme = useThemeKey();
  return (
    <Images>
      {GLYPH_TYPES.map((slug) => {
        const ink = t.tones[toneForType(slug)].ink;
        return (
          <MapImage key={slug} name={iconName(slug, theme)}>
            {/* collapsable={false}: düzleştirilirse SVG ikinci çocuk olur, native taraf yalnız tek görünümü resme çevirir. */}
            <View collapsable={false} style={{ width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2, backgroundColor: t.surface, borderWidth: 2.5, borderColor: ink, alignItems: 'center', justifyContent: 'center' }}>
              <WorkGlyphInline slug={slug} color={ink} size={ICON_SIZE * 0.62} />
            </View>
          </MapImage>
        );
      })}
      {DOT_KEYS.map((key) => (
        <MapImage key={`dot-${key}`} name={dotName(key, theme)}>
          <View collapsable={false} style={{ width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2, backgroundColor: dotColor(t, key), borderWidth: 2.5, borderColor: t.surface }} />
        </MapImage>
      ))}
    </Images>
  );
}

function useThemeKey() {
  const dark = useIsDark();
  const t = useSweetTheme();
  return t.outlined ? 'hc' : dark ? 'dark' : 'light';
}

/**
 * Nokta tabanları da resim (simge) olarak çizilir: daire katmanının aksine simgeler 3B bina arkasında
 * soluklaşmaz (`iconOcclusionOpacity`). Boyut `iconSize` ile (yarıçap / 12).
 */
const DOT_KEYS = ['accent', 'text', 'primary', 'muted'] as const;
type DotKey = (typeof DOT_KEYS)[number];
const DOT_SIZE = 29; // 12 px yarıçap + 2,5 px kenar, iki yanda
const dotName = (key: DotKey, theme: string) => `dot-${theme}-${key}`;
function dotColor(t: ReturnType<typeof useSweetTheme>, key: DotKey) {
  return key === 'accent' ? t.accentText : key === 'text' ? t.text : key === 'primary' ? t.primaryText : t.textMuted;
}

/** Veri hattının ürettiği pilot alan binaları (`data/build_buildings.py`); uygulamaya gömülü. */
const PILOT = PilotBuildingsSchema.parse(pilotBuildings);

/** Lynch "bölge": pilot alan (Ulu Cami ve Hanlar). Yollar ve binaların altında hafif dolgu, kesikli kenar. */
function PilotDistrict() {
  const t = useSweetTheme();
  if (!PILOT.district) return null;
  return (
    <ShapeSource id="district-src" shape={{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: PILOT.district.polygon } }}>
      <FillLayer id="district-fill" slot="bottom" style={{ fillColor: t.primaryText, fillOpacity: t.outlined ? 0 : 0.06 }} />
      <LineLayer id="district-edge" slot="bottom" style={{ lineColor: t.primaryText, lineWidth: t.outlined ? 2.5 : 1.5, lineOpacity: t.outlined ? 1 : 0.45, lineDasharray: [2, 1.5] }} />
    </ShapeSource>
  );
}

/** `middle` slotunda boş çapa: slot almayan 3B katman bunun hemen üstüne yerleşir, rota (sonra eklenir) ve noktalar (`top`) üstte kalır. */
const ANCHOR_ID = 'sezi-landmark-anchor';

/**
 * Lynch "yer işareti": pilot alandaki eser binaları tür tonunda, Mapbox'ın aynı binasından 1 m yüksek ve biraz
 * geniş 3B blok. FillExtrusionLayer bu sürümde `slot` almadığı için `middle` slotundaki çapanın üstüne konur.
 * 3B kapalıyken (az gören, yüksek kontrast) aynı yerde düz dolgu ve kalın kenar.
 */
function PilotLandmarks() {
  const t = useSweetTheme();
  const { profile } = useProfile();
  const flat = profile?.vision === 'low' || t.outlined;
  const byType = (pick: (tone: { fill: string; ink: string }) => string) =>
    [
      'match',
      ['get', 't'],
      ...GLYPH_TYPES.flatMap((slug) => [slug, pick(t.tones[toneForType(slug)])]),
      pick(t.tones[toneForType('diger')]),
    ] as const;
  return (
    <ShapeSource id="landmarks-src" shape={PILOT.landmarks}>
      <LineLayer id={ANCHOR_ID} slot="middle" filter={['==', ['get', 'w'], '']} style={{ lineOpacity: 0 }} />
      {flat ? (
        <>
          <FillLayer id="landmarks-fill" slot="middle" style={{ fillColor: t.outlined ? t.surface : byType((tone) => tone.fill) }} />
          <LineLayer id="landmarks-edge" slot="middle" style={{ lineColor: t.outlined ? t.text : byType((tone) => tone.ink), lineWidth: 2.5 }} />
        </>
      ) : (
        <FillExtrusionLayer
          id="landmarks-3d"
          aboveLayerID={ANCHOR_ID}
          minZoomLevel={LANDMARK_MIN_ZOOM}
          maxZoomLevel={24}
          style={{
            fillExtrusionColor: byType((tone) => tone.fill),
            fillExtrusionHeight: ['interpolate', ['linear'], ['zoom'], LANDMARK_MIN_ZOOM, 0, LANDMARK_FULL_ZOOM, ['get', 'h']],
            fillExtrusionBase: ['get', 'b'],
            fillExtrusionOpacity: LANDMARK_OPACITY,
            fillExtrusionVerticalGradient: true,
            fillExtrusionAmbientOcclusionIntensity: 0.25,
          }}
        />
      )}
    </ShapeSource>
  );
}

/** Rota çizgisi: yürünen kısım soluk, kalan kısım vurgulu. Etiketlerin altında, yolların üstünde. */
export function RouteLine({ id = 'route', line, walked }: { id?: string; line: LngLat[]; walked?: LngLat[] }) {
  const t = useSweetTheme();
  if (line.length < 2) return null;
  return (
    <>
      <ShapeSource id={`${id}-src`} shape={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } }}>
        <LineLayer id={`${id}-casing`} slot="middle" style={{ lineCap: 'round', lineJoin: 'round', lineColor: t.surface, lineWidth: 11 }} />
        <LineLayer id={`${id}-line`} slot="middle" style={{ lineCap: 'round', lineJoin: 'round', lineColor: t.primaryText, lineWidth: 6 }} />
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
  /** Eser türü (work_types.slug): verilirse nokta türün simgesiyle çizilir (siluet türü anlatır). */
  typeSlug?: string;
}

/** Seçili simge yaklaşık 1,25 kat; harita animasyonu değil, yeniden çizim (hareket azaltmadan etkilenmez). */
const ICON_SCALE = 0.95;
const ICON_SCALE_SELECTED = 1.2;

/** Noktalar: sıra numaralı anlatım noktaları, yer işaretleri, başlangıçlar, eserler (türü varsa simgeyle). Basılınca `onPress(id)`. */
export function PointsLayer({ id = 'points', points, onPress }: { id?: string; points: MapPoint[]; onPress?: (pointId: string) => void }) {
  const t = useSweetTheme();
  const theme = useThemeKey();
  const dotOf: Record<MapPointKind, DotKey> = { story: 'accent', arrival: 'accent', landmark: 'text', start: 'primary', work: 'primary' };
  const shape: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      properties: {
        id: p.id,
        dot: dotName(p.done ? 'muted' : dotOf[p.kind], theme),
        // Yarıçap 12'ye göre ölçek: numaralı 12, yer işareti / eser 5, diğerleri 8; seçili +3.
        dotScale: ((p.order ? 12 : p.kind === 'landmark' || p.kind === 'work' ? 5 : 8) + (p.selected ? 3 : 0)) / 12,
        order: p.order ? String(p.order) : '',
        label: p.label ?? '',
        icon: p.typeSlug && !p.order ? iconName(p.typeSlug, theme) : '',
        scale: p.selected ? ICON_SCALE_SELECTED : ICON_SCALE,
        done: p.done ? 1 : 0,
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
      <SymbolLayer
        id={`${id}-icon`}
        slot="top"
        filter={['!=', ['get', 'icon'], '']}
        style={{ iconImage: ['get', 'icon'], iconSize: ['get', 'scale'], iconOpacity: ['case', ['==', ['get', 'done'], 1], 0.5, 1], iconAllowOverlap: true, iconIgnorePlacement: true, iconOcclusionOpacity: 1 }}
      />
      {/* Sıra: tür simgeleri < nokta tabanları < numara; rota sırası (numaralı durak) her zaman üstte. */}
      <SymbolLayer
        id={`${id}-dot`}
        slot="top"
        filter={['==', ['get', 'icon'], '']}
        style={{ iconImage: ['get', 'dot'], iconSize: ['get', 'dotScale'], iconAllowOverlap: true, iconIgnorePlacement: true, iconOcclusionOpacity: 1 }}
      />
      <SymbolLayer id={`${id}-order`} slot="top" style={{ textField: ['get', 'order'], textFont: FONT, textSize: 13, textColor: t.surface, textAllowOverlap: true, textIgnorePlacement: true, textOcclusionOpacity: 1 }} />
      <SymbolLayer
        id={`${id}-label`}
        slot="top"
        minZoomLevel={14.5}
        style={{ textField: ['get', 'label'], textFont: FONT, textSize: 12, textOffset: [0, 1.5], textAnchor: 'top', textMaxWidth: 9, textOptional: true, textColor: t.text, textHaloColor: t.surface, textHaloWidth: 1.5 }}
      />
    </ShapeSource>
  );
}

/** Eser haritası: kümelenmiş eserler; seçili eser vurgulu. Basılınca `onPress(slug)`. */
export function WorkClusters({ works, selected, onPress }: { works: { slug: string; location: LngLat; typeSlug: string }[]; selected: string | null; onPress: (slug: string) => void }) {
  const t = useSweetTheme();
  const theme = useThemeKey();
  const shape: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: works.map((w) => ({
      type: 'Feature',
      properties: { slug: w.slug, icon: iconName(w.typeSlug, theme), scale: w.slug === selected ? ICON_SCALE_SELECTED : ICON_SCALE },
      geometry: { type: 'Point', coordinates: w.location },
    })),
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
      <CircleLayer id="works-clusters" slot="top" filter={['has', 'point_count']} style={{ circleRadius: ['step', ['get', 'point_count'], 18, 10, 22, 40, 28], circleColor: t.primary.fill, circleStrokeWidth: 3, circleStrokeColor: t.surface }} />
      <SymbolLayer id="works-cluster-label" slot="top" filter={['has', 'point_count']} style={{ textField: ['get', 'point_count_abbreviated'], textSize: 14, textFont: FONT, textColor: t.primary.ink, textAllowOverlap: true }} />
      {/* Seçili eser: simgenin altında vurgu halkası (renk dışında boyutla da ayrılır). */}
      <CircleLayer id="works-selected" slot="top" filter={['==', ['get', 'slug'], selected ?? '']} style={{ circleRadius: 22, circleColor: t.accentText, circleOpacity: 0.22, circleStrokeWidth: 2.5, circleStrokeColor: t.accentText }} />
      <SymbolLayer
        id="works-icon"
        slot="top"
        filter={['!', ['has', 'point_count']]}
        style={{ iconImage: ['get', 'icon'], iconSize: ['get', 'scale'], iconAllowOverlap: true, iconIgnorePlacement: true, iconOcclusionOpacity: 1, symbolSortKey: ['case', ['==', ['get', 'slug'], selected ?? ''], 1, 0] }}
      />
    </ShapeSource>
  );
}

/** Tek eser işareti (türü verilirse simgesiyle); konumu kesin değilse çevresinde yaklaşık alan. */
export function WorkPin({ location, approximate, typeSlug }: { location: LngLat; approximate?: boolean; typeSlug?: string }) {
  const t = useSweetTheme();
  const theme = useThemeKey();
  return (
    <ShapeSource id="work-src" shape={{ type: 'Point', coordinates: location }}>
      {approximate ? <CircleLayer id="work-area" slot="top" style={{ circleRadius: 46, circleColor: t.primaryText, circleOpacity: 0.14, circleStrokeWidth: 2, circleStrokeColor: t.primaryText }} /> : <></>}
      {typeSlug ? (
        <SymbolLayer id="work-icon" slot="top" style={{ iconImage: iconName(typeSlug, theme), iconSize: ICON_SCALE_SELECTED, iconAllowOverlap: true, iconIgnorePlacement: true, iconOcclusionOpacity: 1 }} />
      ) : (
        <>
          <CircleLayer id="work-halo" slot="top" style={{ circleRadius: 16, circleColor: t.surface }} />
          <CircleLayer id="work-circle" slot="top" style={{ circleRadius: 9, circleColor: t.accentText, circleStrokeWidth: 3, circleStrokeColor: t.surface }} />
        </>
      )}
    </ShapeSource>
  );
}

/** Kullanıcı konumu: halka ve nokta. */
export function UserDot({ location }: { location: LngLat }) {
  const t = useSweetTheme();
  return (
    <ShapeSource id="me-src" shape={{ type: 'Point', coordinates: location }}>
      <CircleLayer id="me-halo" slot="top" style={{ circleRadius: 18, circleColor: t.primaryText, circleOpacity: 0.18 }} />
      <CircleLayer id="me-dot" slot="top" style={{ circleRadius: 8, circleColor: t.primaryText, circleStrokeWidth: 3, circleStrokeColor: t.surface }} />
    </ShapeSource>
  );
}

/** Başlangıç ve varış işaretleri. */
export function EndPin({ id, location, kind }: { id: string; location: LngLat; kind: 'start' | 'end' }) {
  const t = useSweetTheme();
  const fill = kind === 'end' ? t.accentText : t.surface;
  const stroke = kind === 'end' ? t.surface : t.primaryText;
  return (
    <ShapeSource id={`${id}-src`} shape={{ type: 'Point', coordinates: location }}>
      <CircleLayer id={`${id}-pin`} slot="top" style={{ circleRadius: kind === 'end' ? 10 : 8, circleColor: fill, circleStrokeWidth: 3.5, circleStrokeColor: stroke }} />
    </ShapeSource>
  );
}
