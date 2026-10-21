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
import { Lens } from "@/components/works/lens";
import { useT } from "@/lib/i18n-client";
import { photoUrl } from "@/lib/media";

/**
 * Eser fotoğraf galerisi: her fotoğrafın altında varsa `credit` yazılır; fareyle üstünde gezince büyüteç
 * (`Lens`), tıklayınca `Dialog` içinde büyük boy açılır. Fotoğraf yoksa tür tonunda glif karosu ve bilgi notu gösterilir.
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
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="w-full">
        <WorkThumb
          photo={undefined}
          typeSlug={typeSlug}
          alt=""
          className="h-28 w-full rounded-lg sm:h-36"
        />
      </div>
    );
  }

  const currentPhoto = photos[selectedPhotoIndex] ?? photos[0];
  if (!currentPhoto) return null;
  const currentAlt = loc(currentPhoto.alt, lang) || workName;

  const activePhoto = activeIndex !== null ? photos[activeIndex] : undefined;
  const activeAlt = activePhoto
    ? loc(activePhoto.alt, lang) || workName
    : workName;

  return (
    <section aria-label={t("works.detail.photosTitle")} className="grid gap-2">
      {/* Büyük tepe fotoğrafı */}
      <figure className="grid gap-1.5">
        <Lens src={photoUrl(currentPhoto, "full")}>
          <button
            type="button"
            onClick={() => setActiveIndex(selectedPhotoIndex)}
            aria-label={t("works.detail.openPhoto", { alt: currentAlt })}
            className="group relative aspect-[16/9] max-h-[480px] w-full overflow-hidden rounded-lg border bg-muted text-left outline-none focus-visible:ring-3 focus-visible:ring-ring sm:aspect-[21/9]"
          >
            <Image
              src={photoUrl(currentPhoto, "full")}
              alt={currentAlt}
              fill
              priority
              sizes="(min-width: 1024px) 1152px, 100vw"
              className="object-cover"
            />
            <span
              aria-hidden
              className="absolute bottom-3 right-3 inline-flex size-10 items-center justify-center rounded-lg border bg-card/90 text-foreground"
            >
              <ExpandIcon className="size-4" />
            </span>
          </button>
        </Lens>
        {currentPhoto.credit ? (
          <figcaption className="text-right text-xs text-muted-foreground">
            {t("works.detail.photoCredit", { credit: currentPhoto.credit })}
          </figcaption>
        ) : null}
      </figure>

      {/* Birden çok fotoğraf varsa küçük küçük seçici şerit */}
      {photos.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {photos.map((p, idx) => {
            const isSelected = idx === selectedPhotoIndex;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPhotoIndex(idx)}
                aria-current={isSelected ? "true" : undefined}
                aria-label={loc(p.alt, lang) || `${workName} — ${idx + 1}`}
                className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border transition-all ${
                  isSelected
                    ? "ring-2 ring-primary ring-offset-2"
                    : "opacity-75 hover:opacity-100"
                }`}
              >
                <Image
                  src={photoUrl(p, "thumb")}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      ) : null}

      <Dialog
        open={activeIndex !== null}
        onOpenChange={(open) => !open && setActiveIndex(null)}
      >
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
                    {t("works.detail.photoCredit", {
                      credit: activePhoto.credit,
                    })}
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
                          prev === null
                            ? 0
                            : (prev - 1 + photos.length) % photos.length,
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
                        setActiveIndex((prev) =>
                          prev === null ? 0 : (prev + 1) % photos.length,
                        )
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
