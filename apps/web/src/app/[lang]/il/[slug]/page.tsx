import { loc } from "@sezi/shared";
import { CompassIcon, ExternalLinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkCard } from "@/components/works/work-card";
import { WorksMapView } from "@/components/works/works-map-view";
import { getCities, getExhibitions, getInventoryBooks, getWorkIndex } from "@/lib/data";
import { formatNumber, href, isLang, t, type MessageKey } from "@/lib/i18n";

export const revalidate = 600;
// Sayfalar ilk ziyarette üretilir ve önbellekte kalır (ISR); derlemede önceden üretilmez.
export const generateStaticParams = async (): Promise<{ slug: string }[]> => [];

const CITY_STATUS_KEYS: Record<string, MessageKey> = {
  published: "works.city.status.published",
  printing: "works.city.status.printing",
  in_progress: "works.city.status.in_progress",
  planned: "works.city.status.planned",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang)) return {};
  const cities = await getCities();
  const city = cities.find((c) => c.slug === slug);
  if (!city) return {};
  const cityName = loc(city.name, lang);
  return {
    title: cityName,
    description: loc(city.inventory_note, lang) || `${cityName} · ${t(lang, "works.city.eyebrow")}`,
    alternates: {
      languages: {
        tr: `/tr/il/${city.slug}`,
        en: `/en/il/${city.slug}`,
      },
    },
  };
}

export default async function CityDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isLang(lang)) notFound();

  const [cities, allWorks, exhibitions, books] = await Promise.all([
    getCities(),
    getWorkIndex(),
    getExhibitions(),
    getInventoryBooks(),
  ]);

  const city = cities.find((c) => c.slug === slug);
  if (!city) notFound();

  const cityName = loc(city.name, lang);
  const cityWorks = allWorks
    .filter((w) => w.city_slug === city.slug)
    .sort((a, b) => loc(a.name, lang).localeCompare(loc(b.name, lang), "tr"));
  const cityBooks = books
    .filter((b) => b.city_id === city.id)
    .sort((a, b) => (a.volume ?? 0) - (b.volume ?? 0));
  const cityExhibitions = exhibitions.filter((e) => e.city?.slug === city.slug);

  // Türlere göre eser sayıları
  const typeCounts = new Map<string, { label: string; count: number }>();
  for (const w of cityWorks) {
    const existing = typeCounts.get(w.type_slug);
    if (existing) {
      existing.count += 1;
    } else {
      typeCounts.set(w.type_slug, { label: loc(w.type_name, lang), count: 1 });
    }
  }
  const sortedTypes = [...typeCounts.entries()].sort((a, b) => b[1].count - a[1].count);

  const statusKey = CITY_STATUS_KEYS[city.inventory_status ?? "planned"] ?? "works.city.status.planned";
  const statusVariant =
    city.inventory_status === "published"
      ? "success"
      : city.inventory_status === "printing"
        ? "secondary"
        : "outline";

  return (
    <PageContainer className="grid gap-8">
      {/* Başlık ve 2-3 küçük anahtar sayı */}
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{cityName}</h1>
          <Button size="sm" asChild>
            <Link href={href(lang, `/?il=${city.slug}`)}>
              <CompassIcon aria-hidden />
              <span>{t(lang, "works.city.exploreAll")}</span>
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground num">
          <span className="font-semibold text-foreground">
            {formatNumber(lang, cityWorks.length)} {t(lang, "works.title").toLowerCase()}
          </span>
          {city.inventory_photos ? (
            <>
              <span aria-hidden>·</span>
              <span>{t(lang, "works.city.photos", { n: formatNumber(lang, city.inventory_photos) })}</span>
            </>
          ) : null}
          {city.inventory_year ? (
            <>
              <span aria-hidden>·</span>
              <span>{city.inventory_year}</span>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <Badge variant={statusVariant}>{t(lang, statusKey)}</Badge>
        </div>
      </header>

      {/* Tür çipleri (/?il=&tur=) */}
      {sortedTypes.length > 0 ? (
        <section aria-label={t(lang, "works.city.byTypeTitle")} className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            {sortedTypes.map(([typeSlug, info]) => (
              <Link
                key={typeSlug}
                href={href(lang, `/?il=${city.slug}&tur=${typeSlug}`)}
                className="inline-flex min-h-12 items-center gap-2 rounded-lg border bg-card px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <span>{info.label}</span>
                <Badge variant="secondary" className="num">
                  {formatNumber(lang, info.count)}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Eser ızgarası */}
      <section aria-label={cityName} className="grid gap-4">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cityWorks.map((work, i) => (
            <WorkCard key={work.slug} work={work} lang={lang} priority={i < 6} />
          ))}
        </div>
      </section>

      {/* Harita: isteğe bağlı katlanmış */}
      {cityWorks.length > 0 ? (
        <details className="group rounded-lg border p-4 text-sm">
          <summary className="cursor-pointer font-heading font-bold text-foreground hover:text-link">
            {t(lang, "works.city.mapTitle", { city: cityName })}
          </summary>
          <div className="mt-3">
            <WorksMapView
              works={cityWorks}
              totalCount={cityWorks.length}
              lang={lang}
              mapLabel={t(lang, "works.city.mapTitle", { city: cityName })}
            />
          </div>
        </details>
      ) : null}

      {/* Kitaplar ve sergiler: katlanmış kaynaklar */}
      {cityBooks.length > 0 || cityExhibitions.length > 0 ? (
        <details className="group rounded-lg border p-4 text-sm">
          <summary className="cursor-pointer font-heading font-bold text-foreground hover:text-link">
            {t(lang, "works.city.booksTitle")} & {t(lang, "works.city.exhibitionsTitle")}
          </summary>
          <div className="mt-3 grid gap-3 pt-2 text-muted-foreground">
            {cityBooks.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{b.title}</span>
                {b.url ? (
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-link underline"
                  >
                    <span>{t(lang, "works.detail.openBookPdf")}</span>
                    <ExternalLinkIcon className="size-3" aria-hidden />
                  </a>
                ) : null}
              </div>
            ))}
            {cityExhibitions.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                <span className="font-medium text-foreground">{loc(e.title, lang)}</span>
                <span className="text-xs">{loc(e.venue, lang)}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </PageContainer>
  );
}
