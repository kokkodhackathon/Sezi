"use client";

import { loc } from "@sezi/shared";
import { CheckIcon, ListIcon, MapIcon, RouteIcon } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { CityMap } from "@/components/explore/city-map";
import { FilterSelect, type FilterOption } from "@/components/explore/filter-select";
import { SearchField } from "@/components/explore/search-field";
import { CityTabs } from "@/components/explore/city-tabs";
import { Button } from "@/components/ui/button";
import { WorkCard } from "@/components/works/work-card";
import { WorksMapView } from "@/components/works/works-map-view";
import { applyFilters, EMPTY_FILTERS, filtersToQuery, hasActiveFilters, parseFilters, type ExploreFilters, type ExploreItem } from "@/lib/explore";
import { formatNumber, href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import type { TurkeyMapData } from "@/lib/turkey-map";
import { cn } from "@/lib/utils";

const PAGE = 24;

// Adres çubuğundaki filtreler: sunucu çiziminde boş (sayfa ISR ile önbellekte kalır), tarayıcıda adresten okunur.
const listeners = new Set<() => void>();
function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener("popstate", l);
  return () => {
    listeners.delete(l);
    window.removeEventListener("popstate", l);
  };
}
const readSearch = () => window.location.search;

function writeFilters(f: ExploreFilters) {
  const url = `${window.location.pathname}${filtersToQuery(f)}`;
  // Next'in istemci yönlendiricisiyle uyumlu: sayfa yeniden istenmez, yalnız adres değişir.
  window.history.replaceState(window.history.state, "", url);
  listeners.forEach((l) => l());
}

const chip =
  "inline-flex min-h-12 shrink-0 whitespace-nowrap items-center gap-2 rounded-lg px-4 text-sm transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 contrast:outline-2 contrast:outline-border";
const chipOff = "bg-secondary font-semibold text-secondary-foreground hover:bg-muted";
const chipOn = "bg-primary font-bold text-primary-foreground";

/**
 * Ana sayfa keşfi: üstte başlık + arama kutusu, yanında il seçen büyük noktalı Türkiye haritası; altında il sekmeleri
 * (kayan seçim dolgusu), tür / ilçe seçimi, fotoğraflı / kesin konum anahtarları ve sonuçlar.
 * Süzme yazarken anında (form gönderme yok); sonuçlar 24'erli açılır, harita görünümü aynı süzülmüş listeyi gösterir.
 */
export function Explore({ title, items, cityOrder, map }: { title: string; items: ExploreItem[]; cityOrder: string[]; map: TurkeyMapData }) {
  const { t, lang } = useT();
  const search = useSyncExternalStore(subscribe, readSearch, () => "");
  const filters = useMemo(() => (search ? parseFilters(search) : EMPTY_FILTERS), [search]);
  const [q, setQ] = useState(filters.q);
  const [shown, setShown] = useState(PAGE);

  // Adres dışarıdan değişince (geri tuşu, ilk açılış) arama kutusu da güncellenir.
  const [lastSearch, setLastSearch] = useState(search);
  if (search !== lastSearch) {
    setLastSearch(search);
    if (filters.q !== q) setQ(filters.q);
  }

  const deferredQ = useDeferredValue(q);
  const active = { ...filters, q: deferredQ.trim() };

  // Yazmayı bitirince adres güncellenir (her tuşta değil).
  useEffect(() => {
    if (q.trim() === filters.q) return;
    const id = window.setTimeout(() => writeFilters({ ...filters, q: q.trim() }), 300);
    return () => window.clearTimeout(id);
  }, [q, filters]);

  const set = (patch: Partial<ExploreFilters>) => {
    setShown(PAGE);
    const next = { ...filters, q: q.trim(), ...patch };
    if (patch.il !== undefined && patch.il !== filters.il) next.ilce = "";
    writeFilters(next);
  };

  // Yer tutucu örnekleri gerçek veriden: farklı türlerden üç fotoğraflı eserin adı ve en kalabalık iki "ilçe + tür".
  const examples = useMemo(() => {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const w of items) {
      if (names.length >= 3) break;
      if (w.photos.length === 0 || seen.has(w.type_slug)) continue;
      seen.add(w.type_slug);
      names.push(loc(w.name, lang));
    }
    const pairs = new Map<string, number>();
    for (const w of items) if (w.district) {
      const k = `${w.district} ${loc(w.type_name, lang).toLocaleLowerCase(lang)}`;
      pairs.set(k, (pairs.get(k) ?? 0) + 1);
    }
    const top = [...pairs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
    return [names[0], top[0], names[1], top[1], names[2]].filter((x): x is string => Boolean(x));
  }, [items, lang]);

  const results = useMemo(() => applyFilters(items, active, lang), [items, active.q, active.il, active.tur, active.ilce, active.foto, active.kesin, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seçenekler ve sayılar: il çipleri tüm eserlerden, tür ve ilçe seçili ile göre.
  const cities = useMemo(() => {
    const m = new Map<string, { label: string; count: number }>();
    for (const w of items) {
      const c = m.get(w.city_slug) ?? { label: loc(w.city_name, lang), count: 0 };
      c.count++;
      m.set(w.city_slug, c);
    }
    return cityOrder.flatMap((slug) => {
      const c = m.get(slug);
      return c ? [{ value: slug, ...c }] : [];
    });
  }, [items, cityOrder, lang]);
  const pool = useMemo(() => (filters.il ? items.filter((w) => w.city_slug === filters.il) : items), [items, filters.il]);
  const types: FilterOption[] = useMemo(() => {
    const m = new Map<string, FilterOption>();
    for (const w of pool) {
      const o = m.get(w.type_slug) ?? { value: w.type_slug, label: loc(w.type_name, lang), count: 0 };
      o.count = (o.count ?? 0) + 1;
      m.set(w.type_slug, o);
    }
    return [...m.values()].sort((a, b) => a.label.localeCompare(b.label, "tr"));
  }, [pool, lang]);
  const districts: FilterOption[] = useMemo(() => {
    if (!filters.il) return [];
    const m = new Map<string, number>();
    for (const w of pool) if (w.district) m.set(w.district, (m.get(w.district) ?? 0) + 1);
    return [...m.entries()].map(([d, n]) => ({ value: d, label: d, count: n })).sort((a, b) => a.label.localeCompare(b.label, "tr"));
  }, [pool, filters.il]);

  const anyFilter = hasActiveFilters(active);

  return (
    <div className="grid gap-6">
      <div className="grid items-center gap-x-10 gap-y-6 lg:grid-cols-2">
        <div className="grid gap-5">
          <h1 className="text-3xl font-extrabold tracking-tight text-balance sm:text-5xl">{title}</h1>
          <SearchField
            value={q}
            onChange={(v) => {
              setShown(PAGE);
              setQ(v);
            }}
            onClear={() => {
              setQ("");
              set({ q: "" });
            }}
            examples={examples}
          />
        </div>
        <CityMap data={map} cities={cities} value={filters.il} onChange={(il) => set({ il })} />
      </div>

      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <CityTabs tabs={[{ value: "", label: t("works.filter.cityAll"), count: items.length }, ...cities]} value={filters.il} onChange={(il) => set({ il })} />
        <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
        <FilterSelect label={t("works.filter.typeLabel")} allLabel={t("works.filter.typeAll")} value={filters.tur} options={types} onChange={(v) => set({ tur: v })} searchable />
        {filters.il ? (
          <FilterSelect label={t("works.filter.districtLabel")} allLabel={t("works.filter.districtAll")} value={filters.ilce} options={districts} onChange={(v) => set({ ilce: v })} searchable={districts.length > 8} />
        ) : null}
        <button type="button" aria-pressed={filters.foto} onClick={() => set({ foto: !filters.foto })} className={cn(chip, filters.foto ? chipOn : chipOff)}>
          {filters.foto ? <CheckIcon className="size-4" aria-hidden /> : null}
          {t("works.filter.onlyPhotos")}
        </button>
        <button type="button" aria-pressed={filters.kesin} onClick={() => set({ kesin: !filters.kesin })} className={cn(chip, filters.kesin ? chipOn : chipOff)}>
          {filters.kesin ? <CheckIcon className="size-4" aria-hidden /> : null}
          {t("works.filter.onlyExact")}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="num text-sm text-muted-foreground" aria-live="polite">
          {t("works.results.count", { n: formatNumber(lang, results.length) })}
          {anyFilter ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                writeFilters({ ...EMPTY_FILTERS, harita: filters.harita });
              }}
              className="ml-3 inline-flex min-h-12 items-center font-semibold text-link underline"
            >
              {t("works.filter.clear")}
            </button>
          ) : null}
        </p>
        <div role="radiogroup" aria-label={t("works.view.label")} className="relative flex gap-1 rounded-lg bg-secondary p-1">
          <span
            aria-hidden
            className="absolute top-1 left-1 size-10 rounded-lg bg-card shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] contrast:outline-2 contrast:outline-foreground"
            style={{ transform: filters.harita ? "translateX(calc(100% + 0.25rem))" : undefined }}
          />
          {[
            { on: !filters.harita, label: t("works.view.list"), icon: <ListIcon className="size-4" aria-hidden />, harita: false },
            { on: filters.harita, label: t("works.view.map"), icon: <MapIcon className="size-4" aria-hidden />, harita: true },
          ].map((v) => (
            <button
              key={String(v.harita)}
              type="button"
              role="radio"
              aria-checked={v.on}
              aria-label={v.label}
              title={v.label}
              onClick={() => set({ harita: v.harita })}
              className={cn("relative flex size-10 items-center justify-center rounded-lg transition-colors", v.on ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {v.icon}
            </button>
          ))}
        </div>
      </div>

      {!anyFilter && !filters.harita ? (
        <Link
          href={href(lang, "/rota")}
          className="flex min-h-14 items-center gap-4 rounded-lg bg-highlight px-5 py-3 text-highlight-foreground hover:brightness-[0.98] contrast:outline-2 contrast:outline-border"
        >
          <RouteIcon className="size-6 shrink-0" aria-hidden />
          <span className="grid flex-1 leading-tight">
            <span className="font-heading font-extrabold">{t("home.routeTitle")}</span>
            <span className="text-sm">{t("home.routeBody")}</span>
          </span>
          <span className="hidden font-heading text-sm font-bold underline sm:inline">{t("home.routeCta")}</span>
        </Link>
      ) : null}

      {results.length === 0 ? (
        <div role="status" className="grid justify-items-start gap-2 rounded-lg bg-secondary p-6">
          <p className="font-heading font-bold">{t("works.results.emptyTitle")}</p>
          <Button
            variant="outline"
            onClick={() => {
              setQ("");
              writeFilters({ ...EMPTY_FILTERS, harita: filters.harita });
            }}
          >
            {t("works.filter.clear")}
          </Button>
        </div>
      ) : filters.harita ? (
        <WorksMapView works={results} lang={lang} />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {results.slice(0, shown).map((w, i) => (
              <li key={w.slug}>
                <WorkCard work={w} lang={lang} priority={i < 4} />
              </li>
            ))}
          </ul>
          {results.length > shown ? (
            <div className="flex justify-center">
              <Button variant="outline" size="lg" className="rounded-lg" onClick={() => setShown((n) => n + PAGE * 2)}>
                {t("works.more", { n: formatNumber(lang, results.length - shown) })}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
