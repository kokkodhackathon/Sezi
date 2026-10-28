import { NextResponse, type NextRequest } from "next/server";

/** Dil öneki olmadan da açılan sayfalar. Bunların dışındakiler 404'tür (yönlendirme yok). */
const APP_ROOTS = new Set([
  "rota",
  "turlar",
  "sergiler",
  "hakkinda",
  "bildirim",
  "eser",
  "eserler",
  "hesap",
  "il",
  "kisi",
  "kulliye",
]);

/**
 * Dil öneki: `/` tarayıcı diline göre `/tr` ya da `/en`'e; bilinen öneksiz adresler Türkçeye yönlenir.
 * Bilinmeyen kök adresler (ör. `/foo`) Accept-Language ile `/tr` veya `/en` altına içeriden yazılır;
 * 404'i `[lang]/not-found` çizer. İstek başlığı eklenmez: 404 sınırı dinamik olmasın.
 * Statik dosyalar, Next iç adresleri ve SEO dosyaları dokunulmadan geçer.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  const prefersEn = /^en\b/i.test(req.headers.get("accept-language") ?? "");

  if (first === "tr" || first === "en") {
    return NextResponse.next();
  }

  if (pathname !== "/" && !APP_ROOTS.has(first)) {
    const lang = prefersEn ? "en" : "tr";
    const url = req.nextUrl.clone();
    url.pathname = `/${lang}${pathname}`;
    url.search = search;
    return NextResponse.rewrite(url);
  }

  const lang = pathname === "/" && prefersEn ? "en" : "tr";
  const url = req.nextUrl.clone();
  url.pathname = `/${lang}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return NextResponse.redirect(url, 307);
}

export const config = {
  matcher: ["/((?!_next/|favicon\\.ico|icon|apple-icon|robots\\.txt|sitemap\\.xml|.*\\.[a-zA-Z0-9]+$).*)"],
};
