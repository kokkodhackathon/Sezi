import { loc, type ExhibitionRow } from "@sezi/shared";

import { Badge } from "@/components/ui/badge";
import { formatDate, t, type Lang } from "@/lib/i18n";

/** Sergi kartı: başlık, mekân, tarih aralığı, "Sürüyor" rozeti. */
export function ExhibitionCard({ exhibition, lang }: { exhibition: ExhibitionRow; lang: Lang }) {
  const today = new Date().toISOString().slice(0, 10);
  const ongoing = Boolean(
    exhibition.starts_on &&
      exhibition.starts_on <= today &&
      (!exhibition.ends_on || exhibition.ends_on >= today),
  );
  const title = loc(exhibition.title, lang);
  const venue = loc(exhibition.venue, lang);
  const dates = exhibition.starts_on
    ? exhibition.ends_on
      ? t(lang, "works.exhibitions.dates", {
          from: formatDate(lang, exhibition.starts_on),
          to: formatDate(lang, exhibition.ends_on),
        })
      : t(lang, "works.exhibitions.from", { from: formatDate(lang, exhibition.starts_on) })
    : "";

  return (
    <article className="flex flex-col justify-between gap-2 rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 sm:flex-row sm:items-center">
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center gap-2">
          {exhibition.source_url ? (
            <a
              href={exhibition.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-heading text-base font-bold text-foreground hover:underline"
            >
              {title}
            </a>
          ) : (
            <h2 className="font-heading text-base font-bold text-foreground">{title}</h2>
          )}
          {ongoing ? <Badge variant="success">{t(lang, "works.exhibitions.ongoing")}</Badge> : null}
        </div>
        <p className="text-sm text-muted-foreground">{venue}</p>
      </div>
      {dates ? (
        <span className="shrink-0 text-xs text-muted-foreground num">{dates}</span>
      ) : null}
    </article>
  );
}
