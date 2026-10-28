import { isLang, t } from "@/lib/i18n";
import { ogCard, ogSize } from "@/lib/og-card";

export const alt = "Sezi";
export const size = ogSize;
export const contentType = "image/png";

/** Turlar listesi: sayfa başlığı. */
export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const safe = isLang(lang) ? lang : "tr";
  return ogCard(t(safe, "tours.title"), t(safe, "site.tagline"));
}
