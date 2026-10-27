"use client";

import type { Visibility } from "@sezi/shared";
import { Archive, Globe } from "lucide-react";
import { useId, useState } from "react";

import { VisibilityChoice } from "@/components/account/social-visuals";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/lib/i18n-client";

/**
 * Fotoğraf görünürlüğü (simgeli seçenekler) ve arşiv önerisi. Ekranda tek kısa satır;
 * tam izin metni "İzin ayrıntısı" penceresinde (hukuki metin kısaltılmaz).
 */
export function PhotoOptions({
  visibility,
  onVisibility,
  suggestArchive,
  onSuggestArchive,
  accepted = false,
}: {
  visibility: Visibility;
  onVisibility: (v: Visibility) => void;
  suggestArchive: boolean;
  onSuggestArchive: (v: boolean) => void;
  accepted?: boolean;
}) {
  const { t } = useT();
  const id = useId();
  const [license, setLicense] = useState(false);
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <p id={`${id}-vis`} className="font-heading text-sm font-bold">
          {t("photos.visibility")}
        </p>
        <VisibilityChoice
          label={t("photos.visibility")}
          value={visibility}
          onChange={onVisibility}
          labels={{ private: t("photos.private"), friends: t("photos.friends"), public: t("photos.public") }}
        />
        {visibility === "public" ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe aria-hidden className="size-4 shrink-0" />
            {t("photos.publicShort")}
          </p>
        ) : null}
      </div>
      <div className="grid gap-1 rounded-xl border bg-card p-2">
        <div className="flex min-h-12 items-center gap-3 px-2">
          <Archive aria-hidden className="size-5 shrink-0" />
          <label htmlFor={`${id}-archive`} className="grid flex-1 cursor-pointer">
            <span className="font-semibold">{accepted ? t("photos.archive.accepted") : t("photos.archiveSuggest")}</span>
            {suggestArchive || accepted ? <span className="text-sm text-muted-foreground">{t("photos.archiveShort")}</span> : null}
          </label>
          <Switch id={`${id}-archive`} checked={suggestArchive || accepted} disabled={accepted} onCheckedChange={onSuggestArchive} />
        </div>
        {suggestArchive || accepted ? (
          <div>
            <Button type="button" variant="link" className="min-h-12" onClick={() => setLicense(true)}>
              {t("photos.archiveMore")}
            </Button>
          </div>
        ) : null}
      </div>
      <Dialog open={license} onOpenChange={setLicense}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("photos.archiveSuggest")}</DialogTitle>
            <DialogDescription>{t("photos.archiveNote")}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
