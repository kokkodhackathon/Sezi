import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer, PageIntro } from "@/components/page";
import { RoutePlanner, type InitialRouteParams } from "@/components/route/route-planner";
import { getNavOverlay } from "@/lib/data";
import { href, isLang, t } from "@/lib/i18n";

export const revalidate = 600;

type SearchParams = Record<string, string | string[] | undefined>;

const firstParam = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return {
    title: t(lang, "route.title"),
    description: t(lang, "route.lead"),
    alternates: {
      canonical: href(lang, "/rota"),
      languages: {
        tr: href("tr", "/rota"),
        en: href("en", "/rota"),
      },
    },
  };
}

export default async function RoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ lang }, sp, overlay] = await Promise.all([params, searchParams, getNavOverlay()]);
  if (!isLang(lang)) notFound();

  const initial: InitialRouteParams = {
    hedef: firstParam(sp.hedef),
    baslangic: firstParam(sp.baslangic),
    lng: firstParam(sp.lng),
    lat: firstParam(sp.lat),
    profil: firstParam(sp.profil),
    karsilastir: firstParam(sp.karsilastir),
  };

  return (
    <PageContainer>
      <PageIntro
        eyebrow={t(lang, "route.eyebrow")}
        title={t(lang, "route.title")}
        lead={t(lang, "route.lead")}
      />
      <RoutePlanner overlay={overlay} initial={initial} />
    </PageContainer>
  );
}
