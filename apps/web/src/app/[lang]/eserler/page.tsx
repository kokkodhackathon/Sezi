import { loc, searchWorks } from "@sezi/shared";
import { ChevronLeftIcon, ChevronRightIcon, ListIcon, MapIcon, SearchIcon, XIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer, PageIntro } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkCard } from "@/components/works/work-card";
import { WorksMapView } from "@/components/works/works-map-view";
import { getWorkIndex } from "@/lib/data";
import { formatNumber, href, isLang, t, type Lang } from "@/lib/i18n";

export const revalidate = 600;

const PAGE_SIZE = 24;

type SearchParamsInput = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return (value[0] ?? "").trim();
  return (value ?? "").trim();
}

interface FilterState {
  q: string;
  il: string;
  tur: string;
  ilce: string;
  foto: boolean;
  kesin: boolean;
  sayfa: number;
  gorunum: "liste" | "harita";
}

function buildWorksUrl(lang: Lang, state: Partial<FilterState> & { base: FilterState }): string {
  const merged: FilterState = { ...state.base, ...state };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.il) params.set("il", merged.il);
  if (merged.tur) params.set("tur", merged.tur);
  if (merged.ilce) params.set("ilce", merged.ilce);
  if (merged.foto) params.set("foto", "1");
  if (merged.kesin) params.set("kesin", "1");
  if (merged.gorunum === "harita") params.set("gorunum", "harita");
  if (merged.sayfa > 1 && merged.gorunum === "liste") params.set("sayfa", String(merged.sayfa));
  const qs = params.toString();
  return href(lang, qs ? `/eserler?${qs}` : "/eserler");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return {
    title: t(lang, "works.title"),
    description: t(lang, "works.lead"),
    alternates: {
      languages: {
        tr: "/tr/eserler",
        en: "/en/eserler",
      },
    },
  };
}

export default async function WorksPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const sp = await searchParams;
  const q = firstParam(sp.q);
  const il = firstParam(sp.il);
  const tur = firstParam(sp.tur);
  const ilce = firstParam(sp.ilce);
  const foto = firstParam(sp.foto) === "1";
  const kesin = firstParam(sp.kesin) === "1";
  const gorunum: "liste" | "harita" = firstParam(sp.gorunum) === "harita" ? "harita" : "liste";
  const parsedPage = Number.parseInt(firstParam(sp.sayfa), 10);
  const requestedPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const allWorks = await getWorkIndex();

  // İl, tür ve ilçe seçenekleri (il seçiliyse ilçeler o ile daraltılır).
  const cityMap = new Map<string, string>();
  const typeMap = new Map<string, string>();
  for (const w of allWorks) {
    if (!cityMap.has(w.city_slug)) cityMap.set(w.city_slug, loc(w.city_name, lang));
    if (!typeMap.has(w.type_slug)) typeMap.set(w.type_slug, loc(w.type_name, lang));
  }
  const cityOptions = [...cityMap.entries()].sort((a, b) => a[1].localeCompare(b[1], "tr"));
  const typeOptions = [...typeMap.entries()].sort((a, b) => a[1].localeCompare(b[1], "tr"));

  const districtPool = il ? allWorks.filter((w) => w.city_slug === il) : allWorks;
  const districtSet = new Set<string>();
  for (const w of districtPool) {
    if (w.district) districtSet.add(w.district);
  }
  const districtOptions = [...districtSet].sort((a, b) => a.localeCompare(b, "tr"));

  // Arama: q doluysa shared searchWorks, boşsa Türkçe ada göre sıralama.
  const searched = q
    ? searchWorks(q, allWorks)
    : [...allWorks].sort((a, b) => loc(a.name, lang).localeCompare(loc(b.name, lang), "tr"));

  const filtered = searched.filter((w) => {
    if (il && w.city_slug !== il) return false;
    if (tur && w.type_slug !== tur) return false;
    if (ilce && w.district !== ilce) return false;
    if (foto && w.photos.length === 0) return false;
    if (kesin && w.location_precision !== "exact") return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasActiveFilters = Boolean(q || il || tur || ilce || foto || kesin);

  const filterState: FilterState = {
    q,
    il,
    tur,
    ilce,
    foto,
    kesin,
    sayfa: currentPage,
    gorunum,
  };

  return (
    <PageContainer className="grid gap-8">
      <PageIntro
        eyebrow={t(lang, "works.eyebrow")}
        title={t(lang, "works.title")}
        lead={t(lang, "works.lead")}
      />

      {/* GET filtre formu: JS olmadan da çalışır */}
      <form
        method="get"
        action={href(lang, "/eserler")}
        className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-6"
      >
        {gorunum === "harita" ? <input type="hidden" name="gorunum" value="harita" /> : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="eser-q">{t(lang, "works.filter.searchLabel")}</Label>
            <Input
              id="eser-q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder={t(lang, "works.filter.searchPlaceholder")}
              className="min-h-12"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="eser-il">{t(lang, "works.filter.cityLabel")}</Label>
            <select
              id="eser-il"
              name="il"
              defaultValue={il}
              className="min-h-12 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">{t(lang, "works.filter.cityAll")}</option>
              {cityOptions.map(([slug, label]) => (
                <option key={slug} value={slug}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="eser-tur">{t(lang, "works.filter.typeLabel")}</Label>
            <select
              id="eser-tur"
              name="tur"
              defaultValue={tur}
              className="min-h-12 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">{t(lang, "works.filter.typeAll")}</option>
              {typeOptions.map(([slug, label]) => (
                <option key={slug} value={slug}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="eser-ilce">{t(lang, "works.filter.districtLabel")}</Label>
            <select
              id="eser-ilce"
              name="ilce"
              defaultValue={ilce}
              className="min-h-12 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">{t(lang, "works.filter.districtAll")}</option>
              {districtOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="eser-foto"
              className="inline-flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg border bg-background px-3.5 text-sm font-medium hover:bg-muted"
            >
              <input
                id="eser-foto"
                type="checkbox"
                name="foto"
                value="1"
                defaultChecked={foto}
                className="size-4 accent-primary"
              />
              <span>{t(lang, "works.filter.onlyPhotos")}</span>
            </label>

            <label
              htmlFor="eser-kesin"
              className="inline-flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg border bg-background px-3.5 text-sm font-medium hover:bg-muted"
            >
              <input
                id="eser-kesin"
                type="checkbox"
                name="kesin"
                value="1"
                defaultChecked={kesin}
                className="size-4 accent-primary"
              />
              <span>{t(lang, "works.filter.onlyExact")}</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasActiveFilters ? (
              <Button variant="ghost" asChild>
                <Link href={href(lang, gorunum === "harita" ? "/eserler?gorunum=harita" : "/eserler")}>
                  <XIcon aria-hidden />
                  <span>{t(lang, "works.filter.clear")}</span>
                </Link>
              </Button>
            ) : null}
            <Button type="submit">
              <SearchIcon aria-hidden />
              <span>{t(lang, "works.filter.submit")}</span>
            </Button>
          </div>
        </div>
      </form>

      {/* Sonuç sayısı ve Liste / Harita görünümü seçici */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-heading text-base font-bold num" aria-live="polite">
          {t(lang, "works.results.count", { n: formatNumber(lang, filtered.length) })}
        </p>

        <nav aria-label={t(lang, "works.view.label")} className="flex items-center gap-2">
          <Button variant={gorunum === "liste" ? "default" : "outline"} size="sm" asChild>
            <Link
              href={buildWorksUrl(lang, { base: filterState, gorunum: "liste", sayfa: 1 })}
              aria-current={gorunum === "liste" ? "page" : undefined}
            >
              <ListIcon aria-hidden />
              <span>{t(lang, "works.view.list")}</span>
            </Link>
          </Button>
          <Button variant={gorunum === "harita" ? "default" : "outline"} size="sm" asChild>
            <Link
              href={buildWorksUrl(lang, { base: filterState, gorunum: "harita", sayfa: 1 })}
              aria-current={gorunum === "harita" ? "page" : undefined}
            >
              <MapIcon aria-hidden />
              <span>{t(lang, "works.view.map")}</span>
            </Link>
          </Button>
        </nav>
      </div>

      {/* Sonuç yoksa boş durum */}
      {filtered.length === 0 ? (
        <div
          role="status"
          className="grid place-items-center gap-3 rounded-2xl border bg-card p-10 text-center"
        >
          <h2 className="font-heading text-xl font-bold">{t(lang, "works.results.emptyTitle")}</h2>
          <p className="max-w-md text-muted-foreground">{t(lang, "works.results.emptyBody")}</p>
          <Button variant="outline" asChild>
            <Link href={href(lang, "/eserler")}>{t(lang, "works.filter.clear")}</Link>
          </Button>
        </div>
      ) : gorunum === "harita" ? (
        <WorksMapView works={filtered} totalCount={filtered.length} lang={lang} />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((work, i) => (
              <WorkCard key={work.slug} work={work} lang={lang} priority={i < 6} />
            ))}
          </div>

          {totalPages > 1 ? (
            <nav
              aria-label={t(lang, "works.pagination.label")}
              className="flex flex-wrap items-center justify-between gap-4 border-t pt-6"
            >
              <p className="text-sm text-muted-foreground num">
                {t(lang, "works.pagination.page", {
                  page: formatNumber(lang, currentPage),
                  total: formatNumber(lang, totalPages),
                })}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {currentPage > 1 ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={buildWorksUrl(lang, { base: filterState, sayfa: currentPage - 1 })}>
                      <ChevronLeftIcon aria-hidden />
                      <span>{t(lang, "works.pagination.prev")}</span>
                    </Link>
                  </Button>
                ) : null}
                {currentPage < totalPages ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={buildWorksUrl(lang, { base: filterState, sayfa: currentPage + 1 })}>
                      <span>{t(lang, "works.pagination.next")}</span>
                      <ChevronRightIcon aria-hidden />
                    </Link>
                  </Button>
                ) : null}
              </div>
            </nav>
          ) : null}
        </>
      )}
    </PageContainer>
  );
}
