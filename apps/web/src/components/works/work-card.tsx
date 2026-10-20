import { coverOf, loc, type WorkPhoto } from "@sezi/shared";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { WorkThumb } from "@/components/work-thumb";
import type { ExploreItem } from "@/lib/explore";
import { href, t, type Lang } from "@/lib/i18n";

/** Konum kesinliği rozeti: renk yanında her zaman açık metin taşır. */
export function PrecisionBadge({
  precision,
  lang,
}: {
  precision: ExploreItem["location_precision"];
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

/**
 * Eser kartı: önce fotoğraf (yoksa tür tonunda glif), altında ad ve tek satır tür ile il.
 * Çerçeve ve rozet yok; konum kesinliği eser sayfasında ve harita görünümünde gösterilir.
 */
export function WorkCard({
  work,
  lang,
  priority = false,
}: {
  work: ExploreItem;
  lang: Lang;
  priority?: boolean;
}) {
  const name = loc(work.name, lang);
  const meta = `${loc(work.type_name, lang)}, ${work.district ?? loc(work.city_name, lang)}`;
  const cover: WorkPhoto | undefined = coverOf(work);
  const alt = cover ? loc(cover.alt, lang) || name : "";

  return (
    <Link
      href={href(lang, `/eser/${work.slug}`)}
      className="group grid min-h-12 content-start gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
    >
      <WorkThumb
        photo={cover}
        typeSlug={work.type_slug}
        alt={alt}
        priority={priority}
        className="aspect-[4/3] w-full rounded-lg contrast:outline-2 contrast:outline-border"
      />
      <span className="grid gap-0.5 px-0.5">
        <span className="font-heading text-base font-bold leading-snug text-foreground group-hover:underline">{name}</span>
        <span className="text-sm text-muted-foreground">{meta}</span>
      </span>
    </Link>
  );
}
