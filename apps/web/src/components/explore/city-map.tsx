"use client";

import { useT } from "@/lib/i18n-client";
import { formatNumber } from "@/lib/i18n";
import type { TurkeyMapData } from "@/lib/turkey-map";
import { cn } from "@/lib/utils";

export interface CityMapCity {
  value: string;
  label: string;
  count: number;
}

/**
 * Noktalı Türkiye haritası, il işaretleri düğme: dokununca o il süzülür, seçili ile yeniden dokununca kalkar.
 * Harita süsü değil seçicidir; aynı seçim il çiplerinde de var (klavye ve ekran okuyucu için iki yol).
 * Seçili işaret dolgu, halka ve kalın yazıyla ayrılır (renk tek başına değil).
 */
export function CityMap({ data, cities, value, onChange }: { data: TurkeyMapData; cities: CityMapCity[]; value: string; onChange: (slug: string) => void }) {
  const { t, lang } = useT();
  const bySlug = new Map(cities.map((c) => [c.value, c]));

  return (
    <div role="group" aria-label={t("home.mapLabel")} className="relative w-full" style={{ aspectRatio: `${data.width} / ${data.height}` }}>
      <svg viewBox={`0 0 ${data.width} ${data.height}`} className="absolute inset-0 size-full text-primary/25 contrast:text-foreground/40" aria-hidden>
        <path d={data.path} stroke="currentColor" strokeWidth={0.55} strokeLinecap="round" fill="none" />
      </svg>
      {data.pins.map((pin) => {
        const city = bySlug.get(pin.slug);
        if (!city) return null;
        const on = value === pin.slug;
        // Sağ kenara yakın işaretin adı solda yazılır, taşmasın.
        const flip = pin.x > 70;
        return (
          <button
            key={pin.slug}
            type="button"
            aria-pressed={on}
            aria-label={t("home.mapCity", { name: city.label, n: formatNumber(lang, city.count) })}
            onClick={() => onChange(on ? "" : pin.slug)}
            className={cn(
              "group absolute flex min-h-12 -translate-y-1/2 items-center gap-2 rounded-lg px-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              flip ? "flex-row-reverse" : "",
            )}
            style={flip ? { right: `${100 - pin.x}%`, top: `${pin.y}%`, marginRight: "-1rem" } : { left: `${pin.x}%`, top: `${pin.y}%`, marginLeft: "-1rem" }}
          >
            <span
              aria-hidden
              className={cn(
                "relative size-4 shrink-0 rounded-full border-2 border-primary transition-transform duration-150 ease-out group-hover:scale-125",
                on ? "bg-primary ring-4 ring-primary/25" : "bg-card",
              )}
            />
            <span
              className={cn(
                "rounded-md px-2 py-1 text-sm whitespace-nowrap transition-colors",
                on ? "bg-primary font-bold text-primary-foreground" : "bg-card/90 font-semibold text-foreground group-hover:bg-secondary contrast:outline-1 contrast:outline-border",
              )}
            >
              {city.label}
              <span className={cn("num ml-1.5 text-xs font-normal", on ? "text-primary-foreground/85" : "text-muted-foreground")}>{formatNumber(lang, city.count)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
