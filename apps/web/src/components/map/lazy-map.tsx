"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { SeziMapProps } from "./sezi-map";

/** Görünür alana bu kadar yaklaşınca harita kütüphanesi indirilir. */
const NEAR_PX = 240;

/**
 * Mini harita: Mapbox ancak kutu görünüme yaklaşınca yüklenir.
 * Yer tutucu aynı kutudadır; harita gelince sayfa kaymaz.
 */
export function LazySeziMap(props: SeziMapProps) {
  const box = useRef<HTMLDivElement>(null);
  const [MapView, setMapView] = useState<ComponentType<SeziMapProps> | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let cancelled = false;
    const load = () => {
      void import("./sezi-map").then((mod) => {
        if (!cancelled) setMapView(() => mod.default);
      });
    };
    if (typeof IntersectionObserver === "undefined") {
      load();
      return () => {
        cancelled = true;
      };
    }
    const seen = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        seen.disconnect();
        load();
      },
      { rootMargin: `${NEAR_PX}px` },
    );
    seen.observe(el);
    return () => {
      cancelled = true;
      seen.disconnect();
    };
  }, []);

  if (MapView) return <MapView {...props} />;

  return (
    <div ref={box} className={cn("min-h-64", props.className)}>
      <Skeleton className="h-full min-h-64 w-full rounded-lg" />
    </div>
  );
}
