"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import {
  GLYPH_TYPES,
  glyphSvgBody,
  glyphType,
  LANDMARK_FULL_ZOOM,
  LANDMARK_MIN_ZOOM,
  LANDMARK_OPACITY,
  PilotBuildingsSchema,
  sweetThemes,
  toneForType,
  type LngLat,
  type SweetTheme,
} from "@sezi/shared";
import type { Feature, FeatureCollection, GeoJsonProperties } from "geojson";
import type { ExpressionSpecification, Map as MapboxMap } from "mapbox-gl";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { useAppearance } from "@/lib/appearance";
import { useT } from "@/lib/i18n-client";
import { useProfile } from "@/lib/profile";

import pilotBuildings from "../../../../mobile/assets/pilot/bursa-hanlar-buildings.json";
import { createMap, MAP_FONT, MAPBOX_TOKEN, mapPitch, type MapLook } from "./mapbox";

/** Haritadaki işaret. Haritadaki her bilgi sayfadaki listede de yazılıdır; harita destekleyicidir. */
export interface MapMarker {
  id: string;
  location: LngLat;
  label?: string;
  /** Eser türü (work_types.slug): verilirse işaret türün simgesiyle çizilir (siluet türü anlatır, renk tek başına değil). */
  typeSlug?: string;
  /** Konumu kesin değil: yarı saydam çizilir. */
  approximate?: boolean;
  /** Numaralı durak (tur, uğranan nokta). */
  number?: number;
  /** Başlangıç / hedef / seçilen yer: ana renkte, büyük. */
  emphasis?: "start" | "dest" | "picked";
  selected?: boolean;
}

export interface MapLine {
  id: string;
  coords: LngLat[];
  color: string;
  width: number;
  dash?: number[];
}

export interface SeziMapProps {
  /** Ekran okuyucu için bölge adı. */
  label: string;
  center: LngLat;
  zoom?: number;
  /** [batı, güney, doğu, kuzey]: verilirse harita buna sığdırılır. */
  bounds?: [number, number, number, number] | null;
  /** Sığdırırken kenar boşluğu (px); haritanın üstündeki panel için. */
  fitPadding?: { top: number; right: number; bottom: number; left: number };
  markers?: MapMarker[];
  lines?: MapLine[];
  /** Vurgulanan yol parçası (bildirim). */
  highlight?: LngLat[] | null;
  onMarkerClick?: (id: string) => void;
  onMapClick?: (p: LngLat) => void;
  className?: string;
}

const fc = (features: Feature[]): FeatureCollection => ({ type: "FeatureCollection", features });
const lineFeature = (coordinates: LngLat[], properties: GeoJsonProperties = {}): Feature => ({
  type: "Feature",
  properties,
  geometry: { type: "LineString", coordinates },
});
const MAX_LINES = 6;

function setData(m: MapboxMap, id: string, data: FeatureCollection) {
  const src = m.getSource(id);
  if (src && src.type === "geojson") src.setData(data);
}

/** Veri hattının ürettiği pilot alan binaları (`data/build_buildings.py`; mobil uygulamayla aynı dosya). */
const PILOT = PilotBuildingsSchema.parse(pilotBuildings);

const ICON_SIZE = 30;
const ICON_RATIO = 2;
const ICON_SCALE = 0.95;
const ICON_SCALE_SELECTED = 1.2;
const iconName = (slug: string) => `type-${glyphType(slug)}`;

/**
 * Eser türü simgeleri (mobil haritayla aynı): yüzey renginde yuvarlak, kenarı ve glifi tür mürekkebinde.
 * SVG tarayıcıda resme çevrilip haritaya eklenir.
 */
async function addTypeIcons(m: MapboxMap, th: SweetTheme) {
  const px = ICON_SIZE * ICON_RATIO;
  await Promise.all(
    GLYPH_TYPES.map(async (slug) => {
      const ink = th.tones[toneForType(slug)].ink;
      const g = ICON_SIZE * 0.62;
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">` +
        `<circle cx="15" cy="15" r="13.75" fill="${th.surface}" stroke="${ink}" stroke-width="2.5"/>` +
        `<svg x="${(ICON_SIZE - g) / 2}" y="${(ICON_SIZE - g) / 2}" width="${g}" height="${g}" viewBox="0 0 24 24">${glyphSvgBody(slug, ink)}</svg></svg>`;
      const img = new Image(px, px);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await img.decode();
      if (!m.hasImage(iconName(slug))) m.addImage(iconName(slug), img, { pixelRatio: ICON_RATIO });
    }),
  );
}

/**
 * Lynch dili (mobil haritayla aynı): pilot alan "bölgesi" yolların altında hafif dolgu ve kesikli kenar;
 * "yer işareti" binaları tür tonunda yarı saydam 3B blok. Sade haritada aynı yerde düz dolgu ve kalın kenar.
 */
function addPilotLayers(m: MapboxMap, th: SweetTheme, look: MapLook) {
  if (PILOT.district) {
    m.addSource("district", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: PILOT.district.polygon } } });
    m.addLayer({ id: "district-fill", type: "fill", slot: "bottom", source: "district", paint: { "fill-color": th.primaryText, "fill-opacity": th.outlined ? 0 : 0.06 } });
    m.addLayer({
      id: "district-edge",
      type: "line",
      slot: "bottom",
      source: "district",
      paint: { "line-color": th.primaryText, "line-width": th.outlined ? 2.5 : 1.5, "line-opacity": th.outlined ? 1 : 0.45, "line-dasharray": [2, 1.5] },
    });
  }
  const byType = (pick: (tone: { fill: string; ink: string }) => string): ExpressionSpecification => [
    "match",
    ["get", "t"],
    ...GLYPH_TYPES.flatMap((slug) => [slug, pick(th.tones[toneForType(slug)])]),
    pick(th.tones[toneForType("diger")]),
  ];
  m.addSource("landmarks", { type: "geojson", data: PILOT.landmarks });
  if (look.plain) {
    m.addLayer({ id: "landmarks-fill", type: "fill", slot: "middle", source: "landmarks", paint: { "fill-color": th.outlined ? th.surface : byType((tone) => tone.fill) } });
    m.addLayer({ id: "landmarks-edge", type: "line", slot: "middle", source: "landmarks", paint: { "line-color": th.outlined ? th.text : byType((tone) => tone.ink), "line-width": 2.5 } });
    return;
  }
  m.addLayer({
    id: "landmarks-3d",
    type: "fill-extrusion",
    slot: "middle",
    source: "landmarks",
    minzoom: LANDMARK_MIN_ZOOM,
    paint: {
      "fill-extrusion-color": byType((tone) => tone.fill),
      "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], LANDMARK_MIN_ZOOM, 0, LANDMARK_FULL_ZOOM, ["get", "h"]],
      "fill-extrusion-base": ["get", "b"],
      "fill-extrusion-opacity": LANDMARK_OPACITY,
      "fill-extrusion-vertical-gradient": true,
      "fill-extrusion-ambient-occlusion-intensity": 0.25,
    },
  });
}

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";
const subscribeReducedMotion = (onChange: () => void) => {
  const q = window.matchMedia(REDUCE_QUERY);
  q.addEventListener("change", onChange);
  return () => q.removeEventListener("change", onChange);
};
/** Sistemin hareket azaltma tercihi; harita yalnız tarayıcıda çizildiği için sunucu değeri yalnız tip içindir. */
const useReducedMotion = () =>
  useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCE_QUERY).matches, () => false);

export default function SeziMap(props: SeziMapProps) {
  const { t } = useT();
  const { contrast } = useAppearance();
  const profile = useProfile();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const ready = useRef(false);
  const latest = useRef(props);
  const fitted = useRef<string | null>(null);
  latest.current = props;
  const theme = contrast ? sweetThemes.highContrast : sweetThemes.light;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  // Sade harita: yüksek kontrast ya da az gören profili (mobil haritayla aynı kural).
  const plain = contrast || profile?.vision === "low";
  // Hareket azaltma canlı izlenir: tercih harita açıkken değişirse harita eğimsiz (ya da eğik) yeniden kurulur.
  const reducedMotion = useReducedMotion();
  const pitched = !plain && !reducedMotion;
  const lookRef = useRef<MapLook>({ plain, pitched, theme });
  lookRef.current = { plain, pitched, theme };

  const sync = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    const p = latest.current;
    const th = themeRef.current;
    const lines = p.lines ?? [];
    for (let i = 0; i < MAX_LINES; i++) {
      const l = lines[i];
      setData(m, `line-${i}`, fc(l ? [lineFeature(l.coords)] : []));
      if (l) {
        m.setPaintProperty(`line-${i}`, "line-color", l.color);
        m.setPaintProperty(`line-${i}`, "line-width", l.width);
        m.setPaintProperty(`line-${i}-casing`, "line-width", l.width + 4);
        m.setPaintProperty(`line-${i}`, "line-dasharray", l.dash ?? [1, 0]);
      }
    }
    setData(m, "highlight", fc(p.highlight ? [lineFeature(p.highlight)] : []));
    m.getCanvas().style.cursor = p.onMapClick ? "crosshair" : "";
    setData(
      m,
      "markers",
      fc(
        (p.markers ?? []).map((k) => ({
          type: "Feature",
          properties: {
            id: k.id,
            label: k.label ?? "",
            number: k.number !== undefined ? String(k.number) : "",
            // Türü olan eser işareti simgeyle çizilir; numaralı durak ve başlangıç daire kalır.
            icon: k.typeSlug && k.number === undefined && k.emphasis !== "start" ? iconName(k.typeSlug) : "",
            scale: k.selected || k.emphasis ? ICON_SCALE_SELECTED : ICON_SCALE,
            color: k.emphasis === "dest" ? th.accentText : k.emphasis ? th.primaryText : th.text,
            radius: k.emphasis || k.number !== undefined ? 11 : k.selected ? 9 : 6,
            opacity: k.approximate ? 0.45 : 1,
          },
          geometry: { type: "Point", coordinates: k.location },
        })),
      ),
    );
    const key = p.bounds ? p.bounds.join(",") : null;
    if (p.bounds && key !== fitted.current) {
      fitted.current = key;
      const [w, s, e, n] = p.bounds;
      m.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: p.fitPadding ?? 48, duration: 0, maxZoom: 17.5, pitch: mapPitch(lookRef.current) },
      );
    }
  };

  useEffect(() => {
    if (!box.current || !MAPBOX_TOKEN) return;
    const th = themeRef.current;
    const look = lookRef.current;
    const m = createMap(box.current, latest.current.center, latest.current.zoom ?? 15, look);
    map.current = m;
    m.on("load", async () => {
      await addTypeIcons(m, th);
      if (map.current !== m) return; // simgeler yüklenirken harita kaldırıldı
      addPilotLayers(m, th, look);
      for (let i = 0; i < MAX_LINES; i++) {
        m.addSource(`line-${i}`, { type: "geojson", data: fc([]) });
        m.addLayer({
          id: `line-${i}-casing`,
          type: "line",
          slot: "top",
          source: `line-${i}`,
          paint: { "line-color": th.surface, "line-width": 8 },
          layout: { "line-join": "round", "line-cap": "round" },
        });
      }
      for (let i = 0; i < MAX_LINES; i++) {
        m.addLayer({
          id: `line-${i}`,
          type: "line",
          slot: "top",
          source: `line-${i}`,
          paint: { "line-color": th.primaryText, "line-width": 4 },
          layout: { "line-join": "round" },
        });
      }
      m.addSource("highlight", { type: "geojson", data: fc([]) });
      m.addLayer({ id: "highlight", type: "line", slot: "top", source: "highlight", paint: { "line-color": th.accentText, "line-width": 8 }, layout: { "line-cap": "round" } });
      m.addSource("markers", { type: "geojson", data: fc([]) });
      m.addLayer({
        id: "markers",
        type: "circle",
        slot: "top",
        source: "markers",
        filter: ["==", ["get", "icon"], ""],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["get", "radius"],
          "circle-opacity": ["get", "opacity"],
          "circle-stroke-color": th.surface,
          "circle-stroke-width": 2,
        },
      });
      // Simgeler 3B binaların arkasında soluklaşmaz (occlusion opacity 1); numaralı durak daima üstte.
      m.addLayer({
        id: "markers-icon",
        type: "symbol",
        slot: "top",
        source: "markers",
        filter: ["!=", ["get", "icon"], ""],
        layout: { "icon-image": ["get", "icon"], "icon-size": ["get", "scale"], "icon-allow-overlap": true, "icon-ignore-placement": true },
        paint: { "icon-opacity": ["get", "opacity"], "icon-occlusion-opacity": 1 },
      });
      m.addLayer({
        id: "markers-number",
        type: "symbol",
        slot: "top",
        source: "markers",
        filter: ["!=", ["get", "number"], ""],
        layout: { "text-field": ["get", "number"], "text-font": MAP_FONT, "text-size": 12, "text-allow-overlap": true },
        paint: { "text-color": th.surface, "text-occlusion-opacity": 1 },
      });
      m.addLayer({
        id: "markers-label",
        type: "symbol",
        slot: "top",
        source: "markers",
        minzoom: 15.5,
        layout: { "text-field": ["get", "label"], "text-font": MAP_FONT, "text-size": 12, "text-offset": [0, 1.3], "text-anchor": "top", "text-optional": true },
        paint: { "text-color": th.text, "text-halo-color": th.surface, "text-halo-width": 1.5 },
      });
      const clickable = ["markers", "markers-icon"];
      for (const layer of clickable) {
        m.on("click", layer, (e) => {
          const id = e.features?.[0]?.properties?.id;
          if (typeof id === "string") latest.current.onMarkerClick?.(id);
        });
        m.on("mouseenter", layer, () => {
          if (latest.current.onMarkerClick) m.getCanvas().style.cursor = "pointer";
        });
        m.on("mouseleave", layer, () => {
          m.getCanvas().style.cursor = latest.current.onMapClick ? "crosshair" : "";
        });
      }
      m.on("click", (e) => {
        const hit = m.queryRenderedFeatures(e.point, { layers: clickable });
        if (hit.length && latest.current.onMarkerClick) return;
        latest.current.onMapClick?.([Number(e.lngLat.lng.toFixed(7)), Number(e.lngLat.lat.toFixed(7))]);
      });
      if (latest.current.onMapClick) m.getCanvas().style.cursor = "crosshair";
      ready.current = true;
      sync();
    });
    return () => {
      ready.current = false;
      fitted.current = null;
      map.current = null;
      m.remove();
    };
    // Tema, sade harita ya da eğik bakış değişince harita yeniden kurulur (taban harita ayarları ve katman renkleri).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrast, plain, pitched]);

  useEffect(sync);

  if (!MAPBOX_TOKEN) {
    return (
      <div role="note" className={`grid place-items-center bg-muted p-6 text-center text-sm text-muted-foreground ${props.className ?? "rounded-lg border"}`}>
        {t("map.noToken")}
      </div>
    );
  }
  return <div ref={box} role="region" aria-label={props.label || t("map.label")} className={`overflow-hidden ${props.className ?? "rounded-lg border"}`} />;
}
