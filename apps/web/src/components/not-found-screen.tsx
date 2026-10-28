import Link from "next/link";

import { Button } from "@/components/ui/button";
import { href, t, type Lang } from "@/lib/i18n";

/** Tek h1, ana sayfaya dönüş. Dokunma alanı en az 48 px. */
export function NotFoundScreen({ lang }: { lang: Lang | "both" }) {
  if (lang === "both") {
    return (
      <section className="mx-auto grid max-w-xl gap-4 px-4 py-20 text-center">
        <h1 className="text-3xl font-extrabold">
          {t("tr", "notFound.title")} · {t("en", "notFound.title")}
        </h1>
        <p className="text-muted-foreground">{t("tr", "notFound.body")}</p>
        <p className="text-muted-foreground">{t("en", "notFound.body")}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="min-h-12 px-6">
            <Link href={href("tr")}>{t("tr", "notFound.home")}</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-12 px-6">
            <Link href={href("en")}>{t("en", "notFound.home")}</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto grid max-w-xl gap-4 px-4 py-20 text-center">
      <h1 className="text-3xl font-extrabold">{t(lang, "notFound.title")}</h1>
      <p className="text-muted-foreground">{t(lang, "notFound.body")}</p>
      <div>
        <Button asChild className="min-h-12 px-6">
          <Link href={href(lang)}>{t(lang, "notFound.home")}</Link>
        </Button>
      </div>
    </section>
  );
}
