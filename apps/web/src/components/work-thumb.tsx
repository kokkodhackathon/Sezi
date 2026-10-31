"use client";

import { isAttributed, type WorkPhoto } from "@sezi/shared";
import { LandmarkIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { photoUrl } from "@/lib/media";
import { toneClass } from "@/lib/tone";
import { PhotoSourceBadge } from "@/components/works/photo-source";
import { cn } from "@/lib/utils";

/**
 * Eser görseli: fotoğraf ya da fotoğraf yoksa tür tonunda sade dekoratif glif.
 * `imageClassName` fotoğraflara kart üzeri efekt verir.
 */
export function WorkThumb({
  photo,
  typeSlug,
  alt,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw",
  size = "thumb",
  className,
  imageClassName,
  priority,
  sourceTag,
}: {
  photo: WorkPhoto | undefined;
  typeSlug: string;
  /** Fotoğrafın alt metni (boşsa dekoratif). */
  alt: string;
  sizes?: string;
  size?: "thumb" | "full";
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  /** Küçük liste karolarında etkileşimsiz kaynak etiketi */
  sourceTag?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  if (photo) {
    return (
      <div className={cn("relative overflow-hidden bg-muted", className)}>
        {loaded ? null : <div aria-hidden className="absolute inset-0 animate-shimmer bg-[linear-gradient(100deg,transparent_30%,var(--color-card)_50%,transparent_70%)] bg-[length:200%_100%] opacity-70" />}
        <Image
          src={photoUrl(photo, size)}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          fetchPriority={priority ? "high" : "auto"}
          onLoad={() => setLoaded(true)}
          className={cn("object-cover transition-[opacity,transform] duration-500 ease-out", loaded ? "opacity-100" : "opacity-0", imageClassName)}
        />
        {sourceTag && isAttributed(photo) ? <PhotoSourceBadge photo={photo} /> : null}
      </div>
    );
  }
  return (
    <div className={cn("grid place-items-center overflow-hidden", toneClass(typeSlug), className)} aria-hidden>
      <LandmarkIcon className="size-12" strokeWidth={1.5} />
    </div>
  );
}
