"use client";

import { defaultSenses, profileFor, type UserProfile } from "@sezi/shared";
import { useState } from "react";
import { toast } from "sonner";

import { ChoiceGroup } from "@/components/choice-group";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n-client";
import { saveProfile, useProfile } from "@/lib/profile";

const VISION: UserProfile["vision"][] = ["full", "low", "blind"];
const MOBILITY: UserProfile["mobility"][] = ["none", "cane", "wheelchair"];
const HEARING: UserProfile["hearing"][] = ["full", "hard", "deaf"];

/**
 * Erişilebilirlik profili: görme, hareket, işitme. Duyu kanalları mobildeki varsayılanla hesaplanır
 * (`defaultSenses`); web'de ayrıca seçilmez. Dil sayfa dilidir. Kayıt `saveProfile` ile (girişliyse hesaba da gider).
 */
export function ProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, lang } = useT();
  const profile = useProfile();
  const base = profile ?? profileFor("walker", lang);
  const [vision, setVision] = useState(base.vision);
  const [mobility, setMobility] = useState(base.mobility);
  const [hearing, setHearing] = useState(base.hearing);
  const [lastOpen, setLastOpen] = useState(open);

  // Her açılışta kayıtlı değerlerden başlar.
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setVision(base.vision);
      setMobility(base.mobility);
      setHearing(base.hearing);
    }
  }

  const save = () => {
    saveProfile({ vision, mobility, hearing, senses: defaultSenses(vision, hearing), lang });
    toast.success(t("profile.saved"));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("profile.title")}</DialogTitle>
          <DialogDescription>{t("profile.body")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <ChoiceGroup legend={t("profile.vision")} value={vision} onChange={setVision} choices={VISION.map((v) => ({ value: v, label: t(`profile.vision.${v}`) }))} />
          <ChoiceGroup legend={t("profile.mobility")} value={mobility} onChange={setMobility} choices={MOBILITY.map((v) => ({ value: v, label: t(`profile.mobility.${v}`) }))} />
          <ChoiceGroup legend={t("profile.hearing")} value={hearing} onChange={setHearing} choices={HEARING.map((v) => ({ value: v, label: t(`profile.hearing.${v}`) }))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
