"use client";

import { toneForType, type WorkPhoto } from "@sezi/shared";
import { LandmarkIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { photoUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

const TONE_CLASS = {
  cobalt: "bg-tone-cobalt text-tone-cobalt-ink",
  teal: "bg-tone-teal text-tone-teal-ink",
  coral: "bg-tone-coral text-tone-coral-ink",
  saffron: "bg-tone-saffron text-tone-saffron-ink",
  sage: "bg-tone-sage text-tone-sage-ink",
  plum: "bg-tone-plum text-tone-plum-ink",
} as const;

/** Tür tonunun dolgu + mürekkep sınıfları (glif karosu, tür etiketi). */
export const toneClass = (typeSlug: string): string => TONE_CLASS[toneForType(typeSlug)];

/**
 * Eser görseli: kapak fotoğrafı ya da fotoğraf yoksa tür tonunda glif karosu (dekoratif; tür adı yanında yazılı).
 * Fotoğraf yüklenirken ışıltılı yer tutucu, yüklenince yumuşak beliriş (hareket azaltmada anlık).
 * Glif karosu hafif: tonun açığı, üstünde ince nokta deseni (çini dokusu) ve küçük simge; fotoğraflı kartlardan
 * ayrılır ama listede göze batmaz. `imageClassName` kart üzerine gelme efekti içindir (ör. yakınlaşma).
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
          onLoad={() => setLoaded(true)}
          className={cn("object-cover transition-[opacity,transform] duration-500 ease-out", loaded ? "opacity-100" : "opacity-0", imageClassName)}
        />
      </div>
    );
  }
  return (
    <div className={cn("relative grid place-items-center overflow-hidden", toneClass(typeSlug), className)} aria-hidden>
      <div className="absolute inset-0 bg-card/30" />
      <div className="absolute inset-0 bg-[radial-gradient(currentColor_1px,transparent_1.5px)] bg-[length:14px_14px] opacity-35" />
      <span className="relative grid size-14 place-items-center rounded-full bg-card/80 contrast:outline-2 contrast:outline-border">
        <LandmarkIcon className="size-7" strokeWidth={1.75} />
      </span>
    </div>
  );
}
