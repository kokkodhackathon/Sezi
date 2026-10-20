import { hasLocation, loc } from "@sezi/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer, PageIntro, SectionTitle } from "@/components/page";
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

  return (
    <PageContainer className="grid gap-10">
      <PageIntro
        eyebrow={t(lang, "works.complex.eyebrow")}
        title={complexName}
        lead={t(lang, "works.complex.lead")}
      >
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Link
            href={href(lang, `/il/${first.city_slug}`)}
            className="inline-flex min-h-12 items-center font-heading font-bold text-link underline"
          >
            {cityName}
          </Link>
          {first.district ? (
            <>
              <span aria-hidden className="text-muted-foreground">
                ·
              </span>
              <span className="text-muted-foreground">{first.district}</span>
            </>
          ) : null}
          <Badge variant="secondary" className="num">
            {t(lang, "works.complex.count", { n: formatNumber(lang, complexWorks.length) })}
          </Badge>
        </div>
      </PageIntro>

      {hasAnyLocation ? (
        <section aria-labelledby="complex-map-heading" className="grid gap-4">
          <SectionTitle id="complex-map-heading" className="mb-0">
            {t(lang, "works.complex.mapTitle", { name: complexName })}
          </SectionTitle>
          <WorksMapView
            works={complexWorks}
            totalCount={complexWorks.length}
            lang={lang}
            mapLabel={t(lang, "works.complex.mapTitle", { name: complexName })}
          />
        </section>
      ) : null}

      <section aria-labelledby="complex-works-heading" className="grid gap-4">
        <SectionTitle id="complex-works-heading" className="mb-0">
          {t(lang, "works.complex.worksTitle")}
        </SectionTitle>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {complexWorks.map((work, i) => (
            <WorkCard key={work.slug} work={work} lang={lang} priority={i < 6} />
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
