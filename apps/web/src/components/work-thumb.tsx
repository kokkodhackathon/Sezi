import { toneForType, type WorkPhoto } from "@sezi/shared";
import { LandmarkIcon } from "lucide-react";
import Image from "next/image";

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

/**
 * Eser görseli: kapak fotoğrafı (küçük boy) ya da fotoğraf yoksa tür tonunda glif karosu (dekoratif; tür adı
 * yanında yazılı). Az yazı, önce fotoğraf (DESIGN.md "Çini 2").
 */
export function WorkThumb({
  photo,
  typeSlug,
  alt,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw",
  size = "thumb",
  className,
  priority,
}: {
  photo: WorkPhoto | undefined;
  typeSlug: string;
  /** Fotoğrafın alt metni (boşsa dekoratif). */
  alt: string;
  sizes?: string;
  size?: "thumb" | "full";
  className?: string;
  priority?: boolean;
}) {
  if (photo) {
    return (
      <div className={cn("relative overflow-hidden bg-muted", className)}>
        <Image src={photoUrl(photo, size)} alt={alt} fill sizes={sizes} className="object-cover" priority={priority} />
      </div>
    );
  }
  return (
    <div className={cn("grid place-items-center", TONE_CLASS[toneForType(typeSlug)], className)} aria-hidden>
      <LandmarkIcon className="size-1/3 max-h-16 max-w-16" strokeWidth={1.5} />
    </div>
  );
}
