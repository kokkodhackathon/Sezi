import { loc } from "@sezi/shared";

import { getCities } from "@/lib/data";
import { isLang, t } from "@/lib/i18n";
import { ogCard, ogSize } from "@/lib/og-card";

export const alt = "Sezi";
export const size = ogSize;
export const contentType = "image/png";

/** İl sayfası: il adı başlıkta. */
export default async function Image({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const safe = isLang(lang) ? lang : "tr";
  const city = (await getCities()).find((c) => c.slug === slug);
  const title = city ? loc(city.name, safe) : t(safe, "site.name");
  return ogCard(title, t(safe, "site.tagline"));
}
