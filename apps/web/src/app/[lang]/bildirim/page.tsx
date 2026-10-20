import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/page";
import { ReportForm } from "@/components/report/report-form";
import { getNavOverlay } from "@/lib/data";
import { isLang, t } from "@/lib/i18n";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return {
    title: t(lang, "report.title"),
    description: t(lang, "report.lead"),
    alternates: {
      languages: {
        tr: "/tr/bildirim",
        en: "/en/bildirim",
      },
    },
  };
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ eser?: string | string[] }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const query = await searchParams;
  const initialWorkSlug = typeof query.eser === "string" ? query.eser : undefined;
  const overlay = await getNavOverlay();

  return (
    <PageContainer className="max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t(lang, "report.title")}</h1>
      </header>
      <ReportForm overlay={overlay} initialWorkSlug={initialWorkSlug} />
    </PageContainer>
  );
}
