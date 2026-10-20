"use client";

import { loc, type WorkPhoto } from "@sezi/shared";
import { ChevronLeftIcon, ChevronRightIcon, ExpandIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WorkThumb } from "@/components/work-thumb";
import { useT } from "@/lib/i18n-client";
import { photoUrl } from "@/lib/media";

/**
 * Eser fotoğraf galerisi: her fotoğrafın altında varsa `credit` yazılır, tıklayınca `Dialog` içinde
 * büyük boy açılır. Fotoğraf yoksa tür tonunda glif karosu ve bilgi notu gösterilir.
 */
export function PhotoGallery({
  photos,
  workName,
  typeSlug,
}: {
  photos: WorkPhoto[];
  workName: string;
  typeSlug: string;
}) {
  const { t, lang } = useT();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (photos.length === 0) {
    return (
      <div className="grid gap-2">
        <WorkThumb
          photo={undefined}
          typeSlug={typeSlug}
          alt=""
          className="h-56 w-full rounded-xl border sm:h-72"
        />
        <p className="text-sm text-muted-foreground">{t("works.detail.noPhotos")}</p>
      </div>
    );
  }

  const activePhoto = activeIndex !== null ? photos[activeIndex] : undefined;
  const activeAlt = activePhoto ? loc(activePhoto.alt, lang) || workName : workName;

  return (
    <section aria-label={t("works.detail.photosTitle")} className="grid gap-4">
      <div
        className={
          photos.length === 1
            ? "grid"
            : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        {photos.map((photo, index) => {
          const alt = loc(photo.alt, lang) || workName;
          const isHero = index === 0 && photos.length === 1;
          return (
            <figure key={photo.id} className="grid gap-1.5">
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={t("works.detail.openPhoto", { alt })}
                className={`group relative w-full overflow-hidden rounded-xl border bg-muted text-left outline-none focus-visible:ring-3 focus-visible:ring-ring ${
                  isHero ? "aspect-[16/9] max-h-[460px]" : "aspect-[16/10]"
                }`}
              >
                <Image
                  src={photoUrl(photo, isHero ? "full" : "thumb")}
                  alt={alt}
                  fill
                  priority={index === 0}
                  sizes={
                    isHero
                      ? "(min-width: 1024px) 1100px, 100vw"
                      : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  }
                  className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                />
                <span
                  aria-hidden
                  className="absolute right-3 bottom-3 inline-flex size-10 items-center justify-center rounded-lg border bg-card/90 text-foreground"
                >
                  <ExpandIcon className="size-4" />
                </span>
              </button>
              <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{alt}</span>
                {photo.credit ? (
                  <span>{t("works.detail.photoCredit", { credit: photo.credit })}</span>
                ) : null}
              </figcaption>
            </figure>
          );
        })}
      </div>

      <Dialog open={activeIndex !== null} onOpenChange={(open) => !open && setActiveIndex(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {t("works.detail.photoDialogTitle", {
                name: workName,
                index: (activeIndex ?? 0) + 1,
                total: photos.length,
              })}
            </DialogTitle>
            <DialogDescription>{activeAlt}</DialogDescription>
          </DialogHeader>
          {activePhoto ? (
            <div className="grid gap-3">
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border bg-muted">
                <Image
                  src={photoUrl(activePhoto, "full")}
                  alt={activeAlt}
                  fill
                  sizes="(min-width: 1024px) 896px, 100vw"
                  className="object-contain"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {activePhoto.credit ? (
                  <p className="text-sm text-muted-foreground">
                    {t("works.detail.photoCredit", { credit: activePhoto.credit })}
                  </p>
                ) : (
                  <span />
                )}
                {photos.length > 1 ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={t("works.detail.prevPhoto")}
                      onClick={() =>
                        setActiveIndex((prev) =>
                          prev === null ? 0 : (prev - 1 + photos.length) % photos.length,
                        )
                      }
                    >
                      <ChevronLeftIcon aria-hidden />
                      <span>{t("works.detail.prevPhoto")}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={t("works.detail.nextPhoto")}
                      onClick={() =>
                        setActiveIndex((prev) => (prev === null ? 0 : (prev + 1) % photos.length))
                      }
                    >
                      <span>{t("works.detail.nextPhoto")}</span>
                      <ChevronRightIcon aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
