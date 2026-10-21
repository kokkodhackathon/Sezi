"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useT } from "@/lib/i18n-client";
import { cn } from "@/lib/utils";

const INTERVAL = 3200;

/**
 * Ana sayfa arama kutusu: çerçevesiz, il sekmeleri ve filtre çipleriyle aynı zemin (`secondary`); odakta açık yüzey
 * ve halka. Boşken yer tutucu, gerçek eserlerden çıkarılmış örnek aramalar arasında yukarı kayarak
 * döner (Aceternity "Placeholders and Vanish Input" gibi; "Koza Hanı", "Osmangazi hamam"…): ne aranabildiği
 * yazı yazmadan görünür. Örnekler süs; kutunun adı her zaman etikette, ekran okuyucu örnekleri okumaz.
 * Hareket azaltmada yer tutucu sabit kalır. "/" tuşu her yerden kutuya odaklanır (yazı alanındayken değil).
 */
export function SearchField({ value, onChange, onClear, examples }: { value: string; onChange: (v: string) => void; onClear: () => void; examples: string[] }) {
  const { t } = useT();
  const ref = useRef<HTMLInputElement>(null);
  const hints = [t("home.searchPlaceholder"), ...examples];
  const [i, setI] = useState(0);

  useEffect(() => {
    if (value || hints.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % hints.length), INTERVAL);
    return () => window.clearInterval(id);
  }, [value, hints.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)) return;
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div role="search" className="group/search relative">
      <label htmlFor="explore-q" className="sr-only">
        {t("home.searchLabel")}
      </label>
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 grid size-11 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors duration-200 group-focus-within/search:bg-primary group-focus-within/search:text-primary-foreground"
      >
        <SearchIcon className="size-5" />
      </span>
      <input
        ref={ref}
        id="explore-q"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        enterKeyHint="search"
        className="peer h-16 w-full rounded-xl bg-secondary pr-14 pl-16 text-lg text-secondary-foreground outline-none transition-[background-color,box-shadow] duration-200 hover:bg-muted focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring/50 contrast:outline-2 contrast:outline-border [&::-webkit-search-cancel-button]:hidden"
      />
      {/* Dönen yer tutucu: her örnek kendi satırında; değişince satırlar yukarı kayar. */}
      {value ? null : (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-14 left-16 overflow-hidden text-lg text-muted-foreground">
          <span className="flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ transform: `translateY(${-i * 4}rem)` }}>
            {hints.map((h, n) => (
              <span key={n} className={cn("flex h-16 shrink-0 items-center truncate transition-opacity duration-500", n === i ? "opacity-100" : "opacity-0")}>
                {h}
              </span>
            ))}
          </span>
        </span>
      )}
      {value ? (
        <button
          type="button"
          aria-label={t("works.filter.clear")}
          onClick={() => {
            onClear();
            ref.current?.focus();
          }}
          className="absolute top-1/2 right-2 grid size-12 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <XIcon className="size-5" aria-hidden />
        </button>
      ) : (
        <kbd aria-hidden className="pointer-events-none absolute top-1/2 right-4 hidden -translate-y-1/2 rounded-md bg-card px-2 py-0.5 font-sans text-xs font-semibold text-muted-foreground peer-focus:hidden sm:block">
          /
        </kbd>
      )}
    </div>
  );
}
