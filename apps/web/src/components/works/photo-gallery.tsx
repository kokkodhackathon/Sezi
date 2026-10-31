"use client";

import { loc, type WorkPhoto } from "@sezi/shared";
import { ChevronLeftIcon, ChevronRightIcon, ExpandIcon, LandmarkIcon } from "lucide-react";
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
import { Lens } from "@/components/works/lens";
import { photoCreditLine } from "@/components/works/photo-source";
import { useT } from "@/lib/i18n-client";
import { photoUrl } from "@/lib/media";
import { toneClass } from "@/lib/tone";
import { cn } from "@/lib/utils";

/**
 * Eser fotoğraf galerisi: büyütülebilir kapak fotoğrafı, görünür atıf ve küçük fotoğraf seçici.
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
      <div
        aria-hidden
        className={cn("grid h-52 w-full place-items-center overflow-hidden rounded-lg sm:h-60", toneClass(typeSlug))}
      >
        <LandmarkIcon className="size-20" strokeWidth={1.5} />
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

  const currentCreditLine = photoCreditLine(currentPhoto, t);
  const activeCreditLine = activePhoto ? photoCreditLine(activePhoto, t) : null;

  return (
    <div role="group" aria-label={t("works.detail.photosTitle")} className="grid gap-2">
      <figure className="grid gap-2">
        <Lens src={photoUrl(currentPhoto, "full")}>
          <div className="group relative aspect-[4/3] max-h-[560px] w-full overflow-hidden rounded-lg border bg-muted md:aspect-[16/9]">
            <button
              type="button"
              onClick={() => setActiveIndex(selectedPhotoIndex)}
              aria-label={t("works.detail.openPhoto", { alt: currentAlt })}
              className="absolute inset-0 size-full text-left outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              <Image
                src={photoUrl(currentPhoto, "full")}
                alt={currentAlt}
                fill
                priority={selectedPhotoIndex === 0}
                fetchPriority={selectedPhotoIndex === 0 ? "high" : "auto"}
                quality={selectedPhotoIndex === 0 ? 50 : 75}
                sizes="(min-width: 1280px) 1152px, calc(100vw - 2rem)"
                className="object-cover"
              />
              <span
                aria-hidden
                className="absolute bottom-3 right-3 inline-flex size-12 items-center justify-center rounded-lg border bg-card text-foreground"
              >
                <ExpandIcon className="size-5" />
              </span>
            </button>
          </div>
        </Lens>
        {currentCreditLine ? (
          <figcaption className="text-sm leading-relaxed text-muted-foreground">
            {t("works.detail.photoCreditLine", { credit: currentCreditLine })}
            {currentPhoto.source_url ? (
              <>
                {" · "}
                <a
                  href={currentPhoto.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 items-center font-medium text-link underline"
                >
                  {t("works.detail.openSourceUrl")}
                </a>
              </>
            ) : null}
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
                className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border ${
                  isSelected ? "ring-2 ring-primary ring-offset-2" : "opacity-75 hover:opacity-100"
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
        <DialogContent
          className="sm:max-w-4xl"
          closeLabel={t("works.detail.closeDialog")}
          closeButtonClassName="min-h-12 min-w-12"
        >
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
                {activeCreditLine ? (
                  <p className="text-sm text-muted-foreground">
                    {t("works.detail.photoCreditLine", { credit: activeCreditLine })}
                    {activePhoto.source_url ? (
                      <>
                        {" · "}
                        <a
                          href={activePhoto.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-12 items-center font-medium text-link underline"
                        >
                          {t("works.detail.openSourceUrl")}
                        </a>
                      </>
                    ) : null}
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
                      className="min-h-12"
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
                      className="min-h-12"
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
    </div>
  );
}
