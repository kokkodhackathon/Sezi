import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/page";
import { ToursList } from "@/components/tours/tours-list";
import { getNavOverlay, getTours, getWorkIndex } from "@/lib/data";
import { href, isLang, t } from "@/lib/i18n";

export const revalidate = 600;

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return {
    title: t(lang, "tours.title"),
    description: t(lang, "tours.subtitle"),
    alternates: {
      canonical: href(lang, "/turlar"),
      languages: {
        tr: href("tr", "/turlar"),
        en: href("en", "/turlar"),
      },
    },
  };
}

export default async function ToursPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ lang }, sp, overlay, works, tours] = await Promise.all([
    params,
    searchParams,
    getNavOverlay(),
    getWorkIndex(),
    getTours(),
  ]);
  if (!isLang(lang)) notFound();

  const rawProfil = sp.profil;
  const initialProfile = Array.isArray(rawProfil) ? rawProfil[0] : rawProfil;

  return (
    <PageContainer className="grid max-w-4xl gap-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t(lang, "tours.title")}</h1>
      </header>
      <ToursList tours={tours} overlay={overlay} works={works} initialProfile={initialProfile} />
    </PageContainer>
  );
}
