"use client";

import { boundsOf, hasLocation, loc, toneForType, type LngLat } from "@sezi/shared";
import { useMemo, useState } from "react";

import { SeziMap, type MapMarker } from "@/components/map";
import type { WorkListItem } from "@/lib/data";
import { formatNumber, t, type Lang } from "@/lib/i18n";

import { WorkCard } from "./work-card";

const DEFAULT_CENTER: LngLat = [29.063, 40.184];

/**
 * Konumu bilinen eserleri harita üzerinde gösterir; seçilen eserin kartı haritanın yanında açılır.
 * Haritadaki her bilgi yan listede de erişilebilir olarak yer alır.
 */
export function WorksMapView({
  works,
  totalCount,
  lang,
  mapLabel,
}: {
  works: WorkListItem[];
  totalCount?: number;
  lang: Lang;
  mapLabel?: string;
}) {
  const located = useMemo(() => works.filter(hasLocation), [works]);
  const [pickedSlug, setPickedSlug] = useState<string | null>(null);

  const activeWork = useMemo(() => {
    if (located.length === 0) return null;
    if (pickedSlug) {
      const found = located.find((w) => w.slug === pickedSlug);
      if (found) return found;
    }
    return located[0] ?? null;
  }, [located, pickedSlug]);

  const markers: MapMarker[] = useMemo(
    () =>
      located.map((w) => ({
        id: w.slug,
        location: [w.lng, w.lat],
        label: loc(w.name, lang),
        tone: toneForType(w.type_slug),
        approximate: w.location_precision !== "exact",
        selected: w.slug === activeWork?.slug,
        emphasis: w.slug === activeWork?.slug ? "picked" : undefined,
      })),
    [located, lang, activeWork?.slug],
  );

  const bounds = useMemo(
    () => (located.length >= 2 ? boundsOf(located.map((w) => [w.lng, w.lat])) : null),
    [located],
  );

  const center: LngLat = located[0] ? [located[0].lng, located[0].lat] : DEFAULT_CENTER;

  if (located.length === 0) {
    return (
      <div role="status" className="rounded-xl border bg-card p-6 text-center text-muted-foreground">
        {t(lang, "works.map.noLocated")}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {totalCount !== undefined ? (
        <p className="text-sm text-muted-foreground num">
          {t(lang, "works.results.locatedCount", {
            located: formatNumber(lang, located.length),
            total: formatNumber(lang, totalCount),
          })}
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <SeziMap
          label={mapLabel ?? t(lang, "map.label")}
          center={center}
          zoom={15}
          bounds={bounds}
          markers={markers}
          onMarkerClick={(id) => setPickedSlug(id)}
          className="h-[440px] w-full"
        />
        <div className="grid gap-4" aria-live="polite">
          <div>
            <h3 className="font-heading text-base font-bold">{t(lang, "works.map.selectedTitle")}</h3>
            <p className="text-xs text-muted-foreground">{t(lang, "works.map.selectHint")}</p>
          </div>
          {activeWork ? <WorkCard work={activeWork} lang={lang} /> : null}
          {located.length > 1 ? (
            <div className="max-h-52 overflow-y-auto rounded-xl border bg-card p-2">
              <ul className="grid gap-1">
                {located.map((w) => {
                  const selected = w.slug === activeWork?.slug;
                  return (
                    <li key={w.slug}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setPickedSlug(w.slug)}
                        className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          selected
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <span className="truncate">{loc(w.name, lang)}</span>
                        <span
                          className={`shrink-0 text-xs ${
                            selected ? "text-primary-foreground/90" : "text-muted-foreground"
                          }`}
                        >
                          {loc(w.type_name, lang)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
