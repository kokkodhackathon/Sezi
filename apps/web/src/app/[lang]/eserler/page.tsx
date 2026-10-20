import { redirect } from "next/navigation";

import { href, isLang } from "@/lib/i18n";

/** Keşif ana sayfaya taşındı; eski adresler (paylaşılmış bağlantılar) aynı filtrelerle ana sayfaya yönlenir. */
export default async function WorksRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ lang }, sp] = await Promise.all([params, searchParams]);
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const first = Array.isArray(v) ? v[0] : v;
    if (first && k !== "sayfa") q.set(k, first);
  }
  const qs = q.toString();
  redirect(`${href(isLang(lang) ? lang : "tr")}${qs ? `?${qs}` : ""}`);
}
