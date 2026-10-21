"use client";

import { useRef } from "react";

import { formatNumber } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { useSlidingBox } from "@/lib/use-sliding-box";
import { cn } from "@/lib/utils";

export interface CityTab {
  value: string;
  label: string;
  count: number;
}

/**
 * İl seçimi (Tümü / Hatay / Konya / Bursa): tek zemin üstünde sekmeler, seçim dolgusu yeni sekmeye kayar
 * (Turlar'daki profil seçiciyle aynı dil). Sekme genişlikleri farklı olduğu için dolgunun yeri ve genişliği
 * ölçülür; yazı boyutu ya da pencere değişince yeniden ölçülür. Radyo grubu: oklarla gezilir.
 * Seçili sekme ayrıca kalın yazılır (renk tek başına değil); hareket azaltmada dolgu anında yer değiştirir.
 */
export function CityTabs({ tabs, value, onChange }: { tabs: CityTab[]; value: string; onChange: (value: string) => void }) {
  const { t, lang } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const activeIndex = Math.max(0, tabs.findIndex((c) => c.value === value));
  const box = useSlidingBox(ref, "[role=radio]", activeIndex, [tabs]);

  const move = (dir: number) => {
    const next = tabs[(activeIndex + dir + tabs.length) % tabs.length];
    if (!next) return;
    onChange(next.value);
    ref.current?.querySelectorAll<HTMLButtonElement>("[role=radio]")[tabs.indexOf(next)]?.focus();
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={t("works.filter.cityLabel")}
      className="relative flex shrink-0 rounded-lg bg-secondary contrast:outline-2 contrast:outline-border"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      {box ? (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-lg bg-primary transition-[transform,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ width: box.width, transform: `translateX(${box.left}px)` }}
        />
      ) : null}
      {tabs.map((c, i) => {
        const on = i === activeIndex;
        return (
          <button
            key={c.value || "all"}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(c.value)}
            className={cn(
              "relative inline-flex min-h-12 shrink-0 items-center gap-2 rounded-lg px-4 text-sm whitespace-nowrap transition-colors duration-300 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              // Dolgu ölçülmeden önce (ilk boyama) seçili sekme kendi zeminini taşır; sonra kayan dolgu devralır.
              on ? cn("font-bold text-primary-foreground", !box && "bg-primary") : "font-semibold text-secondary-foreground hover:text-foreground",
            )}
          >
            {c.label}
            <span className={cn("num font-sans text-xs font-normal transition-colors duration-300", on ? "text-primary-foreground/85" : "text-muted-foreground")}>{formatNumber(lang, c.count)}</span>
          </button>
        );
      })}
    </div>
  );
}
