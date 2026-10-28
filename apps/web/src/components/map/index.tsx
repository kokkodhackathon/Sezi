"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

import type { SeziMapProps } from "./sezi-map";

export type { MapLine, MapMarker, MapRoute, SeziMapProps } from "./sezi-map";

/** Harita yalnız tarayıcıda yüklenir (kütüphane `window` ister); sayfalar bunu kullanır. */
export const SeziMap = dynamic<SeziMapProps>(() => import("./sezi-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-64 w-full rounded-lg" />,
});

export { LazySeziMap } from "./lazy-map";
