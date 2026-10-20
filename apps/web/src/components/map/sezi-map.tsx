"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import { sweetThemes, type LngLat, type SweetToneName } from "@sezi/shared";
import type { Feature, FeatureCollection, GeoJsonProperties } from "geojson";
import type { Map as MapboxMap } from "mapbox-gl";
import { useEffect, useRef } from "react";

import { useAppearance } from "@/lib/appearance";
import { useT } from "@/lib/i18n-client";

import { createMap, MAP_FONT, MAPBOX_TOKEN } from "./mapbox";

/** Haritadaki işaret. Haritadaki her bilgi sayfadaki listede de yazılıdır; harita destekleyicidir. */
export interface MapMarker {
  id: string;
  location: LngLat;
  label?: string;
  /** Eser türü tonu (dekoratif; tür adı listede yazılı). */
  tone?: SweetToneName;
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

export default function SeziMap(props: SeziMapProps) {
  const { t } = useT();
  const { contrast } = useAppearance();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const ready = useRef(false);
  const latest = useRef(props);
  const fitted = useRef<string | null>(null);
  latest.current = props;
  const theme = contrast ? sweetThemes.highContrast : sweetThemes.light;
  const themeRef = useRef(theme);
  themeRef.current = theme;

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
            color: k.emphasis === "dest" ? th.accentText : k.emphasis ? th.primaryText : k.tone ? th.tones[k.tone].ink : th.text,
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
        { padding: 48, duration: 0, maxZoom: 17.5 },
      );
    }
  };

  useEffect(() => {
    if (!box.current || !MAPBOX_TOKEN) return;
    const th = themeRef.current;
    const m = createMap(box.current, latest.current.center, latest.current.zoom ?? 15, contrast);
    map.current = m;
    m.on("load", () => {
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
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["get", "radius"],
          "circle-opacity": ["get", "opacity"],
          "circle-stroke-color": th.surface,
          "circle-stroke-width": 2,
        },
      });
      m.addLayer({
        id: "markers-number",
        type: "symbol",
        slot: "top",
        source: "markers",
        filter: ["!=", ["get", "number"], ""],
        layout: { "text-field": ["get", "number"], "text-font": MAP_FONT, "text-size": 12, "text-allow-overlap": true },
        paint: { "text-color": th.surface },
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
      m.on("click", "markers", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === "string") latest.current.onMarkerClick?.(id);
      });
      m.on("mouseenter", "markers", () => {
        if (latest.current.onMarkerClick) m.getCanvas().style.cursor = "pointer";
      });
      m.on("mouseleave", "markers", () => {
        m.getCanvas().style.cursor = latest.current.onMapClick ? "crosshair" : "";
      });
      m.on("click", (e) => {
        const hit = m.queryRenderedFeatures(e.point, { layers: ["markers"] });
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
    // Tema değişince harita yeniden kurulur (taban harita teması ve katman renkleri).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrast]);

  useEffect(sync);

  if (!MAPBOX_TOKEN) {
    return (
      <div role="note" className={`grid place-items-center rounded-xl border bg-muted p-6 text-center text-sm text-muted-foreground ${props.className ?? ""}`}>
        {t("map.noToken")}
      </div>
    );
  }
  return <div ref={box} role="region" aria-label={props.label || t("map.label")} className={`overflow-hidden rounded-xl border ${props.className ?? ""}`} />;
}
