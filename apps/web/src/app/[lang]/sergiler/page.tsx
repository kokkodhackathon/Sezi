import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer, PageIntro } from "@/components/page";
import { ExhibitionCard } from "@/components/works/exhibition-card";
import { getExhibitions } from "@/lib/data";
import { isLang, t } from "@/lib/i18n";

export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return {
    title: t(lang, "works.exhibitions.title"),
    description: t(lang, "works.exhibitions.lead"),
    alternates: {
      languages: {
        tr: "/tr/sergiler",
        en: "/en/sergiler",
      },
    },
  };
}

export default async function ExhibitionsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const exhibitions = await getExhibitions();

  return (
    <PageContainer className="grid gap-8">
      <PageIntro
        eyebrow={t(lang, "works.exhibitions.eyebrow")}
        title={t(lang, "works.exhibitions.title")}
        lead={t(lang, "works.exhibitions.lead")}
      />

      {exhibitions.length === 0 ? (
        <div
          role="status"
          className="rounded-2xl border bg-card p-8 text-center text-muted-foreground"
        >
          {t(lang, "works.exhibitions.empty")}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {exhibitions.map((exhibition) => (
            <ExhibitionCard key={exhibition.id} exhibition={exhibition} lang={lang} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
