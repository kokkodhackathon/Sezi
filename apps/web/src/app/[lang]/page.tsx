import { notFound } from "next/navigation";

import { Explore } from "@/components/explore/explore";
import { PageContainer } from "@/components/page";
import { getCities, getWorkIndex } from "@/lib/data";
import { toExploreItem } from "@/lib/explore";
import { isLang, t } from "@/lib/i18n";

export const revalidate = 600;

/**
 * Ana sayfa = keşif: arama, filtreler ve eserler tek yerde. Sayfa sunucuda tüm listeyle üretilir (ISR, SEO);
 * süzme tarayıcıda anında yapılır, durum adreste tutulur.
 */
export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const [works, cities] = await Promise.all([getWorkIndex(), getCities()]);

  return (
    <PageContainer className="grid gap-6 pt-6 sm:pt-10">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t(lang, "home.title")}</h1>
      <Explore items={works.map(toExploreItem)} cityOrder={cities.map((c) => c.slug)} />
    </PageContainer>
  );
}
