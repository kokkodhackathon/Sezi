"use client";

import { PROFILE_KEYS, profileFor, type ProfileKey, type UserProfile } from "@sezi/shared";
import { AccessibilityIcon, EarOffIcon, EyeOffIcon, PersonStandingIcon, SlidersHorizontalIcon, UserRoundIcon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { ProfileDialog } from "@/components/profile-dialog";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n-client";
import { localProfile, useProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";

export type ProfileChoice = "benim" | ProfileKey;

const isPresetKey = (v: string | undefined): v is ProfileKey =>
  v === "walker" || v === "wheelchair" || v === "blind" || v === "deaf";

/**
 * URL ya da başlangıç değerinden geçerli profil seçimini çözer.
 * Kayıtlı profil varsa ve URL'de açıkça başka bir ön ayar seçilmediyse "benim" varsayılandır; yoksa "walker".
 */
export function resolveProfileChoice(param: string | undefined, hasSaved: boolean): ProfileChoice {
  if (isPresetKey(param)) return param;
  if (param === "benim" && hasSaved) return "benim";
  return hasSaved ? "benim" : "walker";
}

/** Seçilen anahtardan rota motoruna verilecek `UserProfile` nesnesini üretir. */
export function resolveUserProfile(choice: ProfileChoice, saved: UserProfile | null, lang: "tr" | "en"): UserProfile {
  if (choice === "benim" && saved) return { ...saved, lang };
  return profileFor(choice === "benim" ? "walker" : choice, lang);
}

export const PROFILE_ICON: Record<ProfileChoice, ReactNode> = {
  benim: <UserRoundIcon className="size-5" aria-hidden />,
  walker: <PersonStandingIcon className="size-5" aria-hidden />,
  wheelchair: <AccessibilityIcon className="size-5" aria-hidden />,
  blind: <EyeOffIcon className="size-5" aria-hidden />,
  deaf: <EarOffIcon className="size-5" aria-hidden />,
};

/**
 * Harita uygulamalarındaki ulaşım türü seçici gibi: simge + kısa ad, tek sıra. Yanında profil ayarı düğmesi.
 * Seçili öğenin altındaki dolgu yeni seçime kayar (sekme çubuğu gibi); seçili öğe ayrıca kalın yazılır
 * (renk tek başına değil). Radyo grubu: oklarla gezilir. Hareket azaltmada dolgu anında yer değiştirir.
 */
export function ProfileSelect({ value, onChange }: { value: ProfileChoice; onChange: (next: ProfileChoice) => void }) {
  const { t } = useT();
  const saved = useProfile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const beforeSnap = useRef<string | null>(null);
  const effective: ProfileChoice = value === "benim" && !saved ? "walker" : value;
  const choices: ProfileChoice[] = saved ? ["benim", ...PROFILE_KEYS] : [...PROFILE_KEYS];
  const activeIndex = Math.max(0, choices.indexOf(effective));

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (open) {
      beforeSnap.current = JSON.stringify(localProfile());
      return;
    }
    const after = localProfile();
    if (after && JSON.stringify(after) !== beforeSnap.current) onChange("benim");
  };

  const move = (dir: number) => {
    const i = choices.indexOf(effective);
    const next = choices[(i + dir + choices.length) % choices.length];
    if (next) {
      onChange(next);
      document.getElementById(`profile-opt-${next}`)?.focus();
    }
  };

  return (
    <div className="flex items-start gap-1">
      <div
        role="radiogroup"
        aria-label={t("route.profile")}
        className="relative grid flex-1 gap-1"
        style={{ gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))` }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            move(1);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            move(-1);
          }
        }}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-lg bg-primary transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] contrast:outline-2 contrast:outline-foreground"
          style={{ width: `calc((100% - ${choices.length - 1} * 0.25rem) / ${choices.length})`, transform: `translateX(calc(${activeIndex} * (100% + 0.25rem)))` }}
        />
        {choices.map((k) => {
          const on = k === effective;
          return (
            <button
              key={k}
              id={`profile-opt-${k}`}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(k)}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-center text-[0.6875rem] leading-tight transition-[color,transform] duration-300 ease-out active:scale-[0.97]",
                on ? "font-bold text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {PROFILE_ICON[k]}
              <span>{t(k === "benim" ? "route.profile.mine" : `route.profile.${k}`)}</span>
            </button>
          );
        })}
      </div>
      <Button type="button" variant="ghost" size="icon" aria-label={t("route.profileSettings")} onClick={() => handleOpenChange(true)} className="mt-2">
        <SlidersHorizontalIcon aria-hidden />
      </Button>
      <ProfileDialog open={dialogOpen} onOpenChange={handleOpenChange} />
    </div>
  );
}
