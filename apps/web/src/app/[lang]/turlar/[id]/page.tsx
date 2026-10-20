import { TOURS } from "@sezi/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/page";
import { TourDetail } from "@/components/tours/tour-detail";
const TOUR_KEYS: Record<string, { title: "tours.tum.title" | "tours.hanlar.title" | "tours.camiler.title" | "tours.su.title"; body: "tours.tum.body" | "tours.hanlar.body" | "tours.camiler.body" | "tours.su.body" }> = {
  tum: { title: "tours.tum.title", body: "tours.tum.body" },
  hanlar: { title: "tours.hanlar.title", body: "tours.hanlar.body" },
  camiler: { title: "tours.camiler.title", body: "tours.camiler.body" },
  su: { title: "tours.su.title", body: "tours.su.body" },
};
import { getNavOverlay, getWorkIndex } from "@/lib/data";
import { href, isLang, t } from "@/lib/i18n";

export const revalidate = 600;

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  const keys = TOUR_KEYS[id];
  if (!isLang(lang) || !keys) return {};
  return {
    title: t(lang, keys.title),
    description: t(lang, keys.body),
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
  const keys = TOUR_KEYS[id];
  if (!isLang(lang) || !keys || !TOURS.some((d) => d.id === id)) {
    notFound();
  }

  const [overlay, works] = await Promise.all([getNavOverlay(), getWorkIndex()]);
  const rawProfil = sp.profil;
  const initialProfile = Array.isArray(rawProfil) ? rawProfil[0] : rawProfil;

  return (
    <PageContainer className="grid max-w-4xl gap-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t(lang, keys.title)}</h1>
      </header>
      <TourDetail tourId={id} overlay={overlay} works={works} initialProfile={initialProfile} />
    </PageContainer>
  );
}
