"use client";

import { createPlanner, toNavPoints, type PilotGraphData } from "@sezi/shared";
import { useState, useSyncExternalStore } from "react";

import raw from "../../../mobile/assets/pilot/bursa-hanlar-nav.json";

import type { NavOverlay } from "./data";

/**
 * Pilot alan rota planlayıcısı: mobil uygulamayla aynı gömülü grafik ve aynı motor (`@sezi/shared`).
 * Yalnız rota, tur ve bildirim sayfalarının istemci bileşenleri içe aktarır; grafik diğer sayfaların paketine girmez.
 */
const graph: PilotGraphData = raw;
export const planner = createPlanner(graph);
export type WebPlanner = typeof planner;

let appliedKey: string | null = null;

/**
 * Sunucudan gelen admin verisini (onaylı yol düzeltmeleri, sonra noktalar; admin ile aynı sıra) grafiğe bir kez
 * uygular ve grafik sürümünü döndürür; sürüm değişince rota yeniden hesaplanır.
 */
export function usePlannerOverlay(overlay: NavOverlay): number {
  useState(() => {
    // Sunucuda modül istekler arasında yaşar: veri değiştiyse (ISR yenilemesi) yeniden uygulanır.
    const key = JSON.stringify([overlay.points, overlay.overrides]);
    if (key === appliedKey) return null;
    appliedKey = key;
    planner.setOverrides(overlay.overrides);
    planner.setNavPoints(toNavPoints(overlay.points));
    return null;
  });
  return useSyncExternalStore(planner.subscribe, planner.version, planner.version);
}
