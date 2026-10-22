"use client";

import { isAttributed, isCommons, loc, type WorkPhoto } from "@sezi/shared";
import { ExternalLinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { MessageKey } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { cn } from "@/lib/utils";

/**
 * Fotoğraf atıf satırı: yüklemelerde yazar/lisans, Commons'ta ayrıca kaynak adı,
 * envanterde mevcut fotoğrafçı kredisi korunur.
 */
export function photoCreditLine(
  photo: WorkPhoto,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
): string | null {
  if (isAttributed(photo)) {
    const author = photo.author?.trim() || t("works.commons.authorUnknown");
    return [author, photo.license?.trim(), isCommons(photo) ? "Wikimedia Commons" : null].filter(Boolean).join(" · ");
  }
  return photo.credit ? t("works.detail.photoCredit", { credit: photo.credit }) : null;
}

/**
 * Küçük liste karolarında gösterilen etkileşimsiz kaynak etiketi.
 */
export function PhotoSourceBadge({ photo, className }: { photo: WorkPhoto; className?: string }) {
  const { t } = useT();
  if (!isAttributed(photo)) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute bottom-1 right-1 max-w-[calc(100%-0.5rem)] truncate rounded bg-background/85 px-1 py-0.5 text-[9px] font-semibold leading-none text-foreground backdrop-blur-xs",
        "contrast:bg-background contrast:text-foreground contrast:outline-1 contrast:outline-foreground",
        className,
      )}
    >
      {isCommons(photo) ? t("works.commons.tagShort") : t("works.commons.photo", { author: photo.author?.trim() || t("works.commons.authorUnknown") })}
    </span>
  );
}

export interface PhotoSourceProps {
  photo: WorkPhoto | undefined;
  className?: string;
  popoverContentClassName?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
}

/**
 * Kaynak ve atıf etiketi: Commons ile yönetici yüklemelerinin ayrıntılarını açar.
 * Envanter fotoğraflarında hiçbir şey çizmez; düğmenin dokunma alanı en az 48px'tir.
 */
export function PhotoSource({
  photo,
  className,
  popoverContentClassName,
  align = "start",
  side = "top",
}: PhotoSourceProps) {
  const { t, lang } = useT();

  if (!photo || !isAttributed(photo)) {
    return null;
  }

  const authorText = photo.author?.trim() || t("works.commons.authorUnknown");
  const modificationsText = loc(photo.modifications, lang);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="xs"
          variant="secondary"
          aria-label={t("works.commons.sourceDetails")}
          onClick={(e) => {
            e.stopPropagation();
          }}
          className={cn(
            "min-h-12 min-w-12 max-w-56 rounded-md bg-background/85 px-2 text-xs font-semibold text-foreground backdrop-blur-xs shadow-xs",
            "hover:bg-background hover:text-foreground",
            "focus-visible:ring-2 focus-visible:ring-ring outline-none",
            "contrast:bg-background contrast:text-foreground contrast:outline-2 contrast:outline-foreground",
            className,
          )}
        >
          <span className="truncate">{isCommons(photo) ? t("works.commons.tag") : t("works.commons.photo", { author: authorText })}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className={cn(
          "w-72 max-w-[calc(100vw-2rem)] rounded-lg bg-popover p-3 text-xs text-popover-foreground shadow-md contrast:outline-2 contrast:outline-border",
          popoverContentClassName,
        )}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="grid gap-2">
          {/* 1. Yazar */}
          <div className="text-foreground">
            {t("works.commons.photo", { author: authorText })}
          </div>

          {/* 2. Lisans */}
          {photo.license ? (
            <div className="text-foreground">
              {photo.license_url ? (
                <a
                  href={photo.license_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 min-w-12 items-center gap-1 font-medium text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs"
                >
                  <span>{t("works.commons.license", { license: photo.license })}</span>
                  <ExternalLinkIcon className="size-3 shrink-0" aria-hidden />
                </a>
              ) : (
                <span>{t("works.commons.license", { license: photo.license })}</span>
              )}
            </div>
          ) : null}

          {/* 3. Değişiklik */}
          {modificationsText ? (
            <div className="text-muted-foreground">
              {t("works.commons.modifications", { modifications: modificationsText })}
            </div>
          ) : null}

          {/* 4. Kaynak sayfası */}
          {photo.source_url ? (
            <div className="border-t border-border/50 pt-2">
              <a
                href={photo.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 min-w-12 items-center gap-1 font-medium text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs"
              >
                <span>{t(isCommons(photo) ? "works.commons.openCommons" : "works.commons.openSource")}</span>
                <ExternalLinkIcon className="size-3 shrink-0" aria-hidden />
              </a>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
