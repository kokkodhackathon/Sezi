import { coverOf, loc, type WorkPhoto } from "@sezi/shared";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { WorkThumb } from "@/components/work-thumb";
import type { WorkListItem } from "@/lib/data";
import { href, t, type Lang } from "@/lib/i18n";
import { PILOT_SLUGS } from "@/lib/pilot-slugs";

/** Konum kesinliği rozeti: renk yanında her zaman açık metin taşır. */
export function PrecisionBadge({
  precision,
  lang,
}: {
  precision: WorkListItem["location_precision"];
  lang: Lang;
}) {
  if (precision === "exact") {
    return <Badge variant="success">{t(lang, "works.precision.exact")}</Badge>;
  }
  if (precision === "approximate") {
    return <Badge variant="warning">{t(lang, "works.precision.approximate")}</Badge>;
  }
  return <Badge variant="outline">{t(lang, "works.precision.unknown")}</Badge>;
}

/** Eser liste kartı: kapak fotoğrafı ya da tür tonunda glif karosu, ad, tür · ilçe · il ve konum kesinliği rozeti. */
export function WorkCard({
  work,
  lang,
  priority = false,
}: {
  work: WorkListItem;
  lang: Lang;
  priority?: boolean;
}) {
  const name = loc(work.name, lang);
  const typeName = loc(work.type_name, lang);
  const cityName = loc(work.city_name, lang);
  const meta = [typeName, work.district, cityName].filter(Boolean).join(" · ");
  const cover: WorkPhoto | undefined = coverOf(work);
  const alt = cover ? loc(cover.alt, lang) || name : "";
  const isPilot = PILOT_SLUGS.has(work.slug);

  return (
    <Card className="group relative overflow-hidden py-0 transition-colors hover:border-primary/50">
      <Link
        href={href(lang, `/eser/${work.slug}`)}
        aria-label={`${name} — ${meta}`}
        className="flex h-full min-h-12 flex-col outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        <WorkThumb
          photo={cover}
          typeSlug={work.type_slug}
          alt={alt}
          priority={priority}
          className="aspect-[16/10] w-full border-b"
        />
        <CardContent className="flex flex-1 flex-col justify-between gap-3 p-4">
          <div className="grid gap-1">
            <h3 className="font-heading text-lg font-bold leading-snug text-foreground group-hover:text-link group-hover:underline">
              {name}
            </h3>
            <p className="text-sm text-muted-foreground">{meta}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <PrecisionBadge precision={work.location_precision} lang={lang} />
            {work.unesco ? <Badge variant="secondary">{t(lang, "works.unesco")}</Badge> : null}
            {isPilot ? <Badge variant="outline">{t(lang, "works.card.pilotBadge")}</Badge> : null}
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
