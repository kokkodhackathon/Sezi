import { loc } from "@sezi/shared";
import { ArrowRightIcon, BookOpenIcon, CompassIcon, ExternalLinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer, PageIntro, SectionTitle } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExhibitionCard } from "@/components/works/exhibition-card";
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
  const note = loc(city.inventory_note, lang);
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

  const featuredCityWorks = [
    ...cityWorks.filter((w) => w.photos.length > 0),
    ...cityWorks.filter((w) => w.photos.length === 0),
  ].slice(0, 9);

  return (
    <PageContainer className="grid gap-12">
      <PageIntro eyebrow={t(lang, "works.city.eyebrow")} title={cityName} lead={note || undefined}>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Badge variant={statusVariant}>{t(lang, statusKey)}</Badge>
          <Button size="sm" asChild>
            <Link href={href(lang, `/eserler?il=${city.slug}`)}>
              <CompassIcon aria-hidden />
              <span>{t(lang, "works.city.exploreAll")}</span>
            </Link>
          </Button>
        </div>
      </PageIntro>

      {/* Envanter sayıları */}
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5">
          <dt className="text-sm text-muted-foreground">{t(lang, "works.city.statYear")}</dt>
          <dd className="mt-1 font-heading text-3xl font-extrabold num">
            {city.inventory_year ?? "—"}
          </dd>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <dt className="text-sm text-muted-foreground">
            {t(lang, "works.city.statInventoryWorks")}
          </dt>
          <dd className="mt-1 font-heading text-3xl font-extrabold num">
            {city.inventory_works !== null ? formatNumber(lang, city.inventory_works) : "—"}
          </dd>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <dt className="text-sm text-muted-foreground">
            {t(lang, "works.city.statInventoryPhotos")}
          </dt>
          <dd className="mt-1 font-heading text-3xl font-extrabold num">
            {city.inventory_photos !== null ? formatNumber(lang, city.inventory_photos) : "—"}
          </dd>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <dt className="text-sm text-muted-foreground">
            {t(lang, "works.city.statVerifiedWorks")}
          </dt>
          <dd className="mt-1 font-heading text-3xl font-extrabold num">
            {formatNumber(lang, cityWorks.length)}
          </dd>
        </div>
      </dl>

      {/* Türlere göre eser sayıları (/eserler?il=&tur= bağlantıları) */}
      {sortedTypes.length > 0 ? (
        <section aria-labelledby="city-types-heading" className="grid gap-4">
          <SectionTitle id="city-types-heading" className="mb-0">
            {t(lang, "works.city.byTypeTitle")}
          </SectionTitle>
          <div className="flex flex-wrap gap-2.5">
            {sortedTypes.map(([typeSlug, info]) => (
              <Link
                key={typeSlug}
                href={href(lang, `/eserler?il=${city.slug}&tur=${typeSlug}`)}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border bg-card px-4 py-2 font-heading text-sm font-bold text-foreground transition-colors hover:border-primary/50 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
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

      {/* Harita */}
      {cityWorks.length > 0 ? (
        <section aria-labelledby="city-map-heading" className="grid gap-4">
          <SectionTitle id="city-map-heading" className="mb-0">
            {t(lang, "works.city.mapTitle", { city: cityName })}
          </SectionTitle>
          <WorksMapView
            works={cityWorks}
            totalCount={cityWorks.length}
            lang={lang}
            mapLabel={t(lang, "works.city.mapTitle", { city: cityName })}
          />
        </section>
      ) : null}

      {/* Envanter kitapları */}
      {cityBooks.length > 0 ? (
        <section aria-labelledby="city-books-heading" className="grid gap-4">
          <SectionTitle id="city-books-heading" className="mb-0">
            {t(lang, "works.city.booksTitle")}
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cityBooks.map((book) => (
              <Card key={book.id}>
                <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
                  <div className="grid gap-1">
                    <div className="flex items-center gap-2">
                      <BookOpenIcon className="size-4 text-primary" aria-hidden />
                      <h3 className="font-heading text-base font-bold">{book.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[
                        book.volume !== null
                          ? t(lang, "works.city.volume", { v: book.volume })
                          : null,
                        book.year ? String(book.year) : null,
                        "Vakıf Katılım",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {book.url ? (
                    <div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={book.url} target="_blank" rel="noopener noreferrer">
                          <span>{t(lang, "works.detail.openBookPdf")}</span>
                          <ExternalLinkIcon aria-hidden />
                        </a>
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {/* İldeki sergiler */}
      {cityExhibitions.length > 0 ? (
        <section aria-labelledby="city-exhibitions-heading" className="grid gap-4">
          <SectionTitle id="city-exhibitions-heading" className="mb-0">
            {t(lang, "works.city.exhibitionsTitle")}
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            {cityExhibitions.map((exh) => (
              <ExhibitionCard key={exh.id} exhibition={exh} lang={lang} />
            ))}
          </div>
        </section>
      ) : null}

      {/* İlden eserler */}
      {featuredCityWorks.length > 0 ? (
        <section aria-labelledby="city-works-heading" className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle id="city-works-heading" className="mb-0">
              {t(lang, "works.city.featuredTitle")}
            </SectionTitle>
            <Button variant="outline" asChild>
              <Link href={href(lang, `/eserler?il=${city.slug}`)}>
                <span>{t(lang, "works.city.exploreAll")}</span>
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredCityWorks.map((work) => (
              <WorkCard key={work.slug} work={work} lang={lang} />
            ))}
          </div>
        </section>
      ) : null}
    </PageContainer>
  );
}
