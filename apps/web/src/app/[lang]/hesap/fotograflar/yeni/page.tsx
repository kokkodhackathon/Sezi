"use client";

import {
  loc,
  PHOTO_ALT_MAX,
  PHOTO_CAPTION_MAX,
  type UserPhoto,
} from "@sezi/shared";
import { ImagePlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { FormError } from "@/components/account/form-error";
import { Stamp, TypeGlyph } from "@/components/account/social-visuals";
import {
  SocialShell,
  useSocialAccount,
} from "@/components/account/social-shell";
import { PhotoOptions } from "@/components/account/photo-options";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PhotoImage } from "@/components/works/community-photos";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { useIdentity } from "@/lib/identity";
import { getWorks, socialErrorKey, uploadPhoto } from "@/lib/social";
import { useAsync } from "@/lib/use-async";

type Errors = Partial<
  Record<"work" | "file" | "alt" | "caption" | "form", string>
>;

export default function NewPhotoPage() {
  return (
    <Suspense>
      <NewPhoto />
    </Suspense>
  );
}

function NewPhoto() {
  const { t, lang } = useT();
  const { ready, user } = useSocialAccount();
  const { identity } = useIdentity();
  const search = useSearchParams();
  const router = useRouter();
  const works = useAsync(getWorks, []);
  const [workSlug, setWorkSlug] = useState(search.get("eser") ?? "");
  const [query, setQuery] = useState("");
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [visibilityOverride, setVisibility] =
    useState<UserPhoto["visibility"]>();
  const visibility = visibilityOverride ?? identity?.photo_default ?? "private";
  const [suggestArchive, setSuggestArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  useEffect(() => {
    if (!file) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const selectedWork = works.data?.find((work) => work.slug === workSlug);
  const matches =
    works.data
      ?.filter((work) =>
        `${loc(work.name, lang)} ${work.city_slug}`
          .toLocaleLowerCase(lang)
          .includes(query.trim().toLocaleLowerCase(lang)),
      )
      .slice(0, 20) ?? [];
  const submit = async () => {
    if (busy) return;
    const next: Errors = {};
    if (!selectedWork) next.work = t("photos.err.work");
    if (!file || !file.type.startsWith("image/"))
      next.file = t("photos.err.file");
    if (!alt.trim() || alt.trim().length > PHOTO_ALT_MAX)
      next.alt = t("photos.err.alt", { n: PHOTO_ALT_MAX });
    if (caption.length > PHOTO_CAPTION_MAX)
      next.caption = t("photos.err.caption", { n: PHOTO_CAPTION_MAX });
    setErrors(next);
    if (Object.keys(next).length || !file || !selectedWork) return;
    setBusy(true);
    try {
      await uploadPhoto({
        file,
        workSlug: selectedWork.slug,
        altText: alt.trim(),
        caption: caption.trim(),
        visibility,
        suggestArchive,
      });
      toast.success(t("photos.uploaded"));
      router.push(
        href(
          lang,
          `/hesap/fotograflar?eser=${encodeURIComponent(selectedWork.slug)}`,
        ),
      );
    } catch (error) {
      setErrors({ form: t(socialErrorKey(error)) });
    } finally {
      setBusy(false);
    }
  };
  if (!ready || !user) return null;
  return (
    <SocialShell title="photos.add" error={works.error} loading={works.loading}>
      <form
        noValidate
        className="mx-auto w-full max-w-xl"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <fieldset disabled={busy} className="min-w-0">
          <FieldGroup>
            {/* 1. Fotoğraf: seçilmemişse kesikli alan; tüm alan dosya seçiciyi açar. */}
            <Field data-invalid={!!errors.file}>
              <FieldLabel htmlFor="photo-file" className="sr-only">
                {t("photos.file")}
              </FieldLabel>
              <label
                htmlFor="photo-file"
                className="relative grid min-h-48 cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-card text-center has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring"
              >
                {preview ? (
                  <PhotoImage src={preview} alt={alt} className="max-h-96 w-full object-contain" />
                ) : (
                  <span className="grid justify-items-center gap-3 p-6">
                    <span aria-hidden className="grid size-16 place-items-center rounded-full bg-highlight text-highlight-foreground">
                      <ImagePlus className="size-8" />
                    </span>
                    <span className="font-heading font-bold">{t("photos.file")}</span>
                  </span>
                )}
                <input
                  id="photo-file"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-invalid={!!errors.file}
                  aria-describedby="photo-file-help photo-file-error"
                  onChange={(event) => {
                    const chosen = event.target.files?.[0];
                    setFile(chosen?.type.startsWith("image/") ? chosen : undefined);
                    setErrors((previous) => ({
                      ...previous,
                      file: chosen && !chosen.type.startsWith("image/") ? t("photos.err.file") : undefined,
                    }));
                  }}
                />
              </label>
              <FieldDescription id="photo-file-help">{t("photos.fileHelp")}</FieldDescription>
              <FieldError id="photo-file-error">{errors.file}</FieldError>
            </Field>
            {/* 2. Eser: seçiliyse glifli çip, değilse arama ve sonuçlar. */}
            <Field data-invalid={!!errors.work}>
              <FieldLabel htmlFor="photo-work-search">{t("photos.work")}</FieldLabel>
              {selectedWork ? (
                <div className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-3 py-2">
                  <Stamp slug={selectedWork.slug} typeSlug={selectedWork.type_slug} className="size-11" />
                  <span className="flex-1 font-semibold">{loc(selectedWork.name, lang)}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="size-12 rounded-full"
                    aria-label={t("photos.changeWork")}
                    onClick={() => setWorkSlug("")}
                  >
                    <X aria-hidden />
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    id="photo-work-search"
                    className="min-h-12"
                    type="search"
                    placeholder={t("photos.searchWork")}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    aria-invalid={!!errors.work}
                    aria-describedby={errors.work ? "photo-work-error" : undefined}
                  />
                  {query.trim() ? (
                    <div className="flex max-h-72 flex-col overflow-y-auto rounded-xl border bg-card" role="group" aria-label={t("photos.chooseWork")}>
                      {matches.map((work) => (
                        <Button
                          key={work.slug}
                          type="button"
                          variant="ghost"
                          className="min-h-12 justify-start gap-3 whitespace-normal rounded-none text-left"
                          onClick={() => {
                            setWorkSlug(work.slug);
                            setQuery("");
                          }}
                        >
                          <TypeGlyph slug={work.type_slug} className="size-5 shrink-0" />
                          {loc(work.name, lang)}
                        </Button>
                      ))}
                      {!works.loading && matches.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">{t("photos.noWorks")}</p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
              {errors.work ? <FieldError id="photo-work-error">{errors.work}</FieldError> : null}
            </Field>
            <Field data-invalid={!!errors.alt}>
              <FieldLabel htmlFor="photo-alt">{t("photos.alt")}</FieldLabel>
              <Textarea
                id="photo-alt"
                required
                maxLength={PHOTO_ALT_MAX}
                value={alt}
                onChange={(event) => setAlt(event.target.value)}
                aria-invalid={!!errors.alt}
                aria-describedby="photo-alt-help photo-alt-error"
              />
              <FieldDescription id="photo-alt-help">
                {t("photos.altHelp")}
              </FieldDescription>
              <FieldError id="photo-alt-error">{errors.alt}</FieldError>
            </Field>
            <Field data-invalid={!!errors.caption}>
              <FieldLabel htmlFor="photo-caption">
                {t("photos.caption")}
              </FieldLabel>
              <Textarea
                id="photo-caption"
                maxLength={PHOTO_CAPTION_MAX}
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                aria-invalid={!!errors.caption}
                aria-describedby="photo-caption-error"
              />
              <FieldError id="photo-caption-error">{errors.caption}</FieldError>
            </Field>
            <PhotoOptions
              visibility={visibility}
              onVisibility={setVisibility}
              suggestArchive={suggestArchive}
              onSuggestArchive={setSuggestArchive}
            />
            <FormError text={errors.form} />
            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                className="min-h-12"
                disabled={busy || works.loading || !identity}
              >
                {t(busy ? "photos.saving" : "photos.save")}
              </Button>
              <Button asChild variant="outline" className="min-h-12">
                <Link href={href(lang, "/hesap/fotograflar")}>
                  {t("photos.cancel")}
                </Link>
              </Button>
            </div>
          </FieldGroup>
        </fieldset>
      </form>
    </SocialShell>
  );
}
