import { loc } from "@sezi/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/page";
import { TourDetail } from "@/components/tours/tour-detail";
import { getNavOverlay, getTours, getWorkIndex } from "@/lib/data";
import { href, isLang, t } from "@/lib/i18n";

export const revalidate = 600;

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  if (!isLang(lang)) return {};
  const tour = (await getTours()).find((x) => x.slug === id);
  if (!tour) return {};
  return {
    title: loc(tour.title, lang),
    description: tour.body ? loc(tour.body, lang) : t(lang, "tours.subtitle"),
    alternates: {
      canonical: href(lang, `/turlar/${id}`),
      languages: {
        tr: href("tr", `/turlar/${id}`),
        en: href("en", `/turlar/${id}`),
      },
    },
  };
}

export default async function TourDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { lang, id } = await params;
  const sp = await searchParams;
  if (!isLang(lang)) notFound();
  const [tour, overlay, works] = await Promise.all([getTours().then((list) => list.find((x) => x.slug === id)), getNavOverlay(), getWorkIndex()]);
  if (!tour) notFound();
  const rawProfil = sp.profil;
  const initialProfile = Array.isArray(rawProfil) ? rawProfil[0] : rawProfil;

  return (
    <PageContainer className="grid max-w-4xl gap-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{loc(tour.title, lang)}</h1>
      </header>
      <TourDetail tour={tour} overlay={overlay} works={works} initialProfile={initialProfile} />
    </PageContainer>
  );
}
