import { hasLocation, loc } from "@sezi/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { WorkCard } from "@/components/works/work-card";
import { WorksMapView } from "@/components/works/works-map-view";
import { getWorkIndex } from "@/lib/data";
import { formatNumber, href, isLang, t } from "@/lib/i18n";

export const revalidate = 600;
// Sayfalar ilk ziyarette üretilir ve önbellekte kalır (ISR); derlemede önceden üretilmez.
export const generateStaticParams = async (): Promise<{ slug: string }[]> => [];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLang(lang)) return {};
  const allWorks = await getWorkIndex();
  const complexWorks = allWorks.filter((w) => w.complex_slug === slug);
  const first = complexWorks[0];
  if (!first) return {};
  const complexName = loc(first.complex_name, lang) || slug;
  return {
    title: complexName,
    description: t(lang, "works.complex.lead"),
    alternates: {
      languages: {
        tr: `/tr/kulliye/${slug}`,
        en: `/en/kulliye/${slug}`,
      },
    },
  };
}

export default async function ComplexDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isLang(lang)) notFound();

  const allWorks = await getWorkIndex();
  const complexWorks = allWorks
    .filter((w) => w.complex_slug === slug)
    .sort((a, b) => loc(a.name, lang).localeCompare(loc(b.name, lang), "tr"));

  const first = complexWorks[0];
  if (!first) notFound();

  const complexName = loc(first.complex_name, lang) || slug;
  const cityName = loc(first.city_name, lang);
  const hasAnyLocation = complexWorks.some(hasLocation);

  // Tür sayıları
  const typeCounts = new Map<string, { label: string; count: number }>();
  for (const w of complexWorks) {
    const existing = typeCounts.get(w.type_slug);
    if (existing) {
      existing.count += 1;
    } else {
      typeCounts.set(w.type_slug, { label: loc(w.type_name, lang), count: 1 });
    }
  }
  const sortedTypes = [...typeCounts.entries()].sort((a, b) => b[1].count - a[1].count);

  return (
    <PageContainer className="grid gap-8">
      {/* Başlık ve küçük anahtar bilgiler */}
      <header className="grid gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{complexName}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground num">
          <Link
            href={href(lang, `/il/${first.city_slug}`)}
            className="font-medium text-foreground hover:underline"
          >
            {[cityName, first.district].filter(Boolean).join(", ")}
          </Link>
          <span aria-hidden>·</span>
          <Badge variant="secondary" className="num">
            {t(lang, "works.complex.count", { n: formatNumber(lang, complexWorks.length) })}
          </Badge>
        </div>
      </header>

      {/* Tür çipleri */}
      {sortedTypes.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {sortedTypes.map(([typeSlug, info]) => (
            <Link
              key={typeSlug}
              href={href(lang, `/?il=${first.city_slug}&tur=${typeSlug}`)}
              className="inline-flex min-h-12 items-center gap-2 rounded-lg border bg-card px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <span>{info.label}</span>
              <Badge variant="secondary" className="num">
                {formatNumber(lang, info.count)}
              </Badge>
            </Link>
          ))}
        </div>
      ) : null}

      {/* Yapılar ızgarası */}
      <section aria-label={complexName} className="grid gap-4">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {complexWorks.map((work, i) => (
            <WorkCard key={work.slug} work={work} lang={lang} priority={i < 6} />
          ))}
        </div>
      </section>

      {/* Harita: isteğe bağlı katlanmış */}
      {hasAnyLocation ? (
        <details className="group rounded-lg border p-4 text-sm">
          <summary className="cursor-pointer font-heading font-bold text-foreground hover:text-link">
            {t(lang, "works.complex.mapTitle", { name: complexName })}
          </summary>
          <div className="mt-3">
            <WorksMapView
              works={complexWorks}
              totalCount={complexWorks.length}
              lang={lang}
              mapLabel={t(lang, "works.complex.mapTitle", { name: complexName })}
            />
          </div>
        </details>
      ) : null}
    </PageContainer>
  );
}
