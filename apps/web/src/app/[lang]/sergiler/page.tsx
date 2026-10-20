import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/page";
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
    <PageContainer className="grid max-w-4xl gap-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t(lang, "works.exhibitions.title")}
        </h1>
      </header>

      {exhibitions.length === 0 ? (
        <div
          role="status"
          className="py-16 text-center text-sm text-muted-foreground"
        >
          {t(lang, "works.exhibitions.empty")}
        </div>
      ) : (
        <div className="grid gap-3">
          {exhibitions.map((exhibition) => (
            <ExhibitionCard key={exhibition.id} exhibition={exhibition} lang={lang} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
