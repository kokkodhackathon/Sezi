"use client";

import type { Identity, SweetToneName } from "@sezi/shared";
import { UserRoundIcon } from "lucide-react";

import { initials } from "@/lib/identity";
import { cn } from "@/lib/utils";

export const AVATAR_TONE_CLASS: Record<SweetToneName, string> = {
  cobalt: "bg-tone-cobalt text-tone-cobalt-ink",
  teal: "bg-tone-teal text-tone-teal-ink",
  coral: "bg-tone-coral text-tone-coral-ink",
  saffron: "bg-tone-saffron text-tone-saffron-ink",
  sage: "bg-tone-sage text-tone-sage-ink",
  plum: "bg-tone-plum text-tone-plum-ink",
};

/**
 * Profil dairesi: fotoğraf varsa fotoğraf, yoksa seçilen Çini 2 tonunda baş harfler; ad yoksa
 * kişi simgesi. Dekoratiftir (`aria-hidden`): kimin olduğu yanındaki adla söylenir.
 */
export function Avatar({
  identity,
  src,
  size = 56,
  className,
}: {
  identity: Pick<Identity, "display_name" | "avatar_tone"> | null;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const tone = identity?.avatar_tone ?? "teal";
  const letters = initials(identity?.display_name ?? "");
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-heading font-extrabold",
        "contrast:border-2 contrast:border-border",
        AVATAR_TONE_CLASS[tone],
        className,
      )}
    >
      {letters ? (
        <span>{letters}</span>
      ) : (
        <UserRoundIcon style={{ width: Math.round(size * 0.46), height: Math.round(size * 0.46) }} aria-hidden />
      )}
      {src ? <img src={src} alt="" className="absolute inset-0 size-full object-cover" /> : null}
    </span>
  );
}
