import { coverOf, isCommons, loc, type WorkPhoto } from "@sezi/shared";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { WorkThumb } from "@/components/work-thumb";
import { toneClass } from "@/lib/tone";
import type { ExploreItem } from "@/lib/explore";
import { PhotoSource } from "@/components/works/photo-source";
import { href, t, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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

// Kademeli bulanıklık: alttan yukarı azalan dört katman (Bencho "Progressive blur"). Her katman maskeyle kendi
// bandında görünür; üstte görünmez, altta en yoğun.
const BLUR_LAYERS = [
  { blur: "backdrop-blur-[1px]", mask: "linear-gradient(to bottom, transparent 0%, black 25%, black 100%)" },
  { blur: "backdrop-blur-[2px]", mask: "linear-gradient(to bottom, transparent 25%, black 50%, black 100%)" },
  { blur: "backdrop-blur-[4px]", mask: "linear-gradient(to bottom, transparent 50%, black 75%, black 100%)" },
  { blur: "backdrop-blur-[8px]", mask: "linear-gradient(to bottom, transparent 75%, black 100%)" },
] as const;

/**
 * Eser kartı (Bencho "Progressive blur"): fotoğraf kartın tamamı; ad, tür ve yer fotoğrafın alt kısmında, aşağı
 * doğru koyulaşan kademeli bir bulanıklığın üstünde yazılır. Üzerine gelince bulanıklık biraz yükselir ve fotoğraf
 * hafifçe yakınlaşır (hareket azaltmada anlık). Fotoğraf yoksa tür tonunda hafif glif karosu, yazı koyu. Yazının okunurluğu
 * bulanıklığa değil altındaki koyu örtüye dayanır; yüksek kontrastta örtü düz zemindir.
 */
export function WorkCard({ work, lang, priority = false }: { work: ExploreItem; lang: Lang; priority?: boolean }) {
  const name = loc(work.name, lang);
  const place = work.district ? `${work.district}, ${loc(work.city_name, lang)}` : loc(work.city_name, lang);
  const cover: WorkPhoto | undefined = coverOf(work);
  const alt = cover ? loc(cover.alt, lang) || name : "";

  return (
    <div className="group relative isolate block aspect-[4/5] overflow-hidden rounded-xl bg-muted contrast:outline-2 contrast:outline-border">
      <Link
        href={href(lang, `/eser/${work.slug}`)}
        aria-label={name}
        className="absolute inset-0 z-0 outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background rounded-xl"
      >
        <WorkThumb photo={cover} typeSlug={work.type_slug} alt={alt} priority={priority} className="absolute inset-0" imageClassName="group-hover:scale-[1.04]" />
        {cover ? (
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 transition-[height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:h-[62%] contrast:hidden">
            {BLUR_LAYERS.map((l) => (
              <div key={l.blur} className={cn("absolute inset-0", l.blur)} style={{ maskImage: l.mask, WebkitMaskImage: l.mask }} />
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/35 to-transparent" />
          </div>
        ) : null}
        {/* Fotoğrafsız kartta yazı açık karonun üstünde koyu kalır; koyu örtü ve bulanıklık yalnız fotoğrafta. */}
        <span className={cn("pointer-events-none absolute inset-x-0 bottom-0 grid gap-1.5 p-3 sm:gap-2 sm:p-4", cover ? "text-background contrast:bg-foreground" : "text-foreground")}>
          <span className="font-heading text-base font-bold leading-snug text-balance group-hover:underline sm:text-lg">{name}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold", toneClass(work.type_slug))}>{loc(work.type_name, lang)}</span>
            <span className={cover ? "text-background/90" : "text-muted-foreground"}>{place}</span>
          </span>
        </span>
      </Link>
      {cover && isCommons(cover) ? (
        // Üst köşede: alttaki ad, tür ve yer satırını örtmez.
        <div className="absolute right-2.5 top-2.5 z-10 sm:right-3 sm:top-3">
          <PhotoSource photo={cover} align="end" side="bottom" />
        </div>
      ) : null}
    </div>
  );
}
