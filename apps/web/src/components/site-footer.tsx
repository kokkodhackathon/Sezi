import Link from "next/link";

import { href, t, type Lang } from "@/lib/i18n";

const LINK = "inline-flex min-h-12 min-w-12 items-center justify-center px-1 font-heading font-bold text-link underline";

export function SiteFooter({ lang }: { lang: Lang }) {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto grid max-w-6xl gap-2 px-4 py-6 text-sm text-muted-foreground">
        <nav aria-label={t(lang, "nav.about")} className="flex flex-wrap gap-x-4">
          <Link className={LINK} href={href(lang, "/hakkinda")}>
            {t(lang, "nav.about")}
          </Link>
          <Link className={LINK} href={href(lang, "/bildirim")}>
            {t(lang, "nav.report")}
          </Link>
        </nav>
        <p>{t(lang, "footer.source")}</p>
        <p>{t(lang, "footer.project")}</p>
      </div>
    </footer>
  );
}
