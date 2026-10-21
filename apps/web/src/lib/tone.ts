import { toneForType } from "@sezi/shared";

const TONE_CLASS = {
  cobalt: "bg-tone-cobalt text-tone-cobalt-ink",
  teal: "bg-tone-teal text-tone-teal-ink",
  coral: "bg-tone-coral text-tone-coral-ink",
  saffron: "bg-tone-saffron text-tone-saffron-ink",
  sage: "bg-tone-sage text-tone-sage-ink",
  plum: "bg-tone-plum text-tone-plum-ink",
} as const;

/**
 * Tür tonunun dolgu + mürekkep sınıfları (glif karosu, tür etiketi). İstemci bileşeninden ayrı dosyada: sunucu
 * bileşenleri de (eser kartı) çağırabilir.
 */
export const toneClass = (typeSlug: string): string => TONE_CLASS[toneForType(typeSlug)];
