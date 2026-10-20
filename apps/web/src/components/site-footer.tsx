import Link from "next/link";

import { href, t, type Lang } from "@/lib/i18n";

export function SiteFooter({ lang }: { lang: Lang }) {
  return (
    <footer className="mt-16 border-t bg-card">
      <div className="mx-auto grid max-w-6xl gap-3 px-4 py-8 text-sm text-muted-foreground">
        <p>{t(lang, "footer.source")}</p>
        <p>{t(lang, "footer.map")}</p>
        <p>{t(lang, "footer.project")}</p>
        <nav aria-label={t(lang, "nav.about")} className="flex flex-wrap gap-x-2">
          <Link className="inline-flex min-h-12 min-w-12 items-center justify-center px-1 text-link underline" href={href(lang, "/hakkinda")}>
            {t(lang, "nav.about")}
          </Link>
          <Link className="inline-flex min-h-12 min-w-12 items-center justify-center px-1 text-link underline" href={href(lang, "/bildirim")}>
            {t(lang, "nav.report")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
