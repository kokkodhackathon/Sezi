import { isLang, t } from "@/lib/i18n";
import { ogCard, ogSize } from "@/lib/og-card";

export const alt = "Sezi";
export const size = ogSize;
export const contentType = "image/png";

/** Site geneli paylaşım görseli: logo, ad ve kısa slogan. */
export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const safe = isLang(lang) ? lang : "tr";
  return ogCard(t(safe, "site.name"), t(safe, "site.tagline"));
}
