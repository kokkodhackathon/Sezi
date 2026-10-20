"use client";

import { PROFILE_KEYS, profileFor, type ProfileKey, type UserProfile } from "@sezi/shared";
import { SlidersHorizontalIcon } from "lucide-react";
import { useRef, useState } from "react";

import { ProfileDialog } from "@/components/profile-dialog";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useT } from "@/lib/i18n-client";
import { localProfile, useProfile } from "@/lib/profile";

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

/**
 * Rota ve turlar sayfalarında ortak profil seçici:
 * Kayıtlı profil varsa "Profilim" + dört ön ayar (`walker`, `wheelchair`, `blind`, `deaf`),
 * ayrıca kişisel erişilebilirlik profilini düzenlemek için `ProfileDialog` düğmesi.
 */
export function ProfileSelect({
  value,
  onChange,
}: {
  value: ProfileChoice;
  onChange: (next: ProfileChoice) => void;
}) {
  const { t } = useT();
  const saved = useProfile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const beforeSnap = useRef<string | null>(null);

  const effective: ProfileChoice = value === "benim" && !saved ? "walker" : value;

  const openDialog = () => {
    beforeSnap.current = JSON.stringify(localProfile());
    setDialogOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      const after = localProfile();
      if (after && JSON.stringify(after) !== beforeSnap.current) {
        onChange("benim");
      }
    }
  };

  const whyText =
    effective === "benim" && saved
      ? `${t(`profile.vision.${saved.vision}`)} · ${t(`profile.mobility.${saved.mobility}`)} · ${t(`profile.hearing.${saved.hearing}`)} — ${t("route.why.mine")}`
      : t(`route.why.${effective === "benim" ? "walker" : effective}`);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{t("route.profile")}</span>
        <Button type="button" variant="outline" size="sm" onClick={openDialog}>
          <SlidersHorizontalIcon data-icon="inline-start" aria-hidden />
          {t("profile.open")}
        </Button>
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        value={effective}
        onValueChange={(v) => {
          if (v === "benim" || isPresetKey(v)) onChange(v);
        }}
        aria-label={t("route.profile")}
        className="w-full flex-wrap justify-start gap-2 gap-y-3"
      >
        {saved ? (
          <ToggleGroupItem
            value="benim"
            className="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:font-bold data-[state=on]:text-primary-foreground"
          >
            {t("route.profile.mine")}
          </ToggleGroupItem>
        ) : null}
        {PROFILE_KEYS.map((k) => (
          <ToggleGroupItem
            key={k}
            value={k}
            className="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:font-bold data-[state=on]:text-primary-foreground"
          >
            {t(`route.profile.${k}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-xs text-muted-foreground">{whyText}</p>
      <ProfileDialog open={dialogOpen} onOpenChange={handleOpenChange} />
    </div>
  );
}
