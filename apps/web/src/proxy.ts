import { NextResponse, type NextRequest } from "next/server";

/**
 * Dil öneki: `/` tarayıcı diline göre `/tr` ya da `/en`'e; öneksiz adresler (`/eserler`) Türkçeye yönlenir.
 * Statik dosyalar, Next iç adresleri ve SEO dosyaları dokunulmadan geçer.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const first = pathname.split("/")[1];
  if (first === "tr" || first === "en") return NextResponse.next();
  const lang = pathname === "/" && /^en\b/i.test(req.headers.get("accept-language") ?? "") ? "en" : "tr";
  const url = req.nextUrl.clone();
  url.pathname = `/${lang}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return NextResponse.redirect(url, 307);
}

export const config = {
  matcher: ["/((?!_next/|favicon\\.ico|icon|apple-icon|robots\\.txt|sitemap\\.xml|.*\\.[a-zA-Z0-9]+$).*)"],
};
