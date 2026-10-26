"use client";

import {
  loc,
  PHOTO_ALT_MAX,
  PHOTO_CAPTION_MAX,
  type UserPhoto,
} from "@sezi/shared";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AccountNote, FormError } from "@/components/account/form-error";
import {
  SocialShell,
  useSocialAccount,
} from "@/components/account/social-shell";
import { ChoiceGroup } from "@/components/choice-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PhotoImage, PhotoStatus } from "@/components/works/community-photos";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import {
  deletePhoto,
  getPhoto,
  getWorks,
  photoUrls,
  socialErrorKey,
  updatePhoto,
} from "@/lib/social";
import { useAsync } from "@/lib/use-async";

export default function PhotoDetailPage() {
  const { t, lang } = useT();
  const { ready, user } = useSocialAccount();
  const { id } = useParams<{ id: string }>();
  const result = useAsync(async () => {
    if (!user) return null;
    const [photo, works] = await Promise.all([getPhoto(id), getWorks()]);
    if (!photo) return null;
    const urls = await photoUrls([photo.path]);
    return {
      photo,
      work: works.find((work) => work.slug === photo.work_slug),
      src: urls[photo.path],
    };
  }, [id, user?.id]);
  if (!ready || !user) return null;
  const data = result.data;
  return (
    <SocialShell
      title="photos.edit"
      error={result.error}
      loading={result.loading}
    >
      <Button asChild variant="outline" className="mb-6 min-h-12">
        <Link href={href(lang, "/hesap/fotograflar")}>{t("photos.back")}</Link>
      </Button>
      {!result.loading && !result.error && !data ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("photos.notFound")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : null}
      {data ? (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <PhotoImage
              src={data.src}
              alt={data.photo.alt_text}
              className="max-h-[36rem] rounded-lg object-contain"
            />
            <Link
              href={href(lang, `/eser/${data.photo.work_slug}`)}
              className="min-h-12 font-semibold underline underline-offset-4"
            >
              {data.work ? loc(data.work.name, lang) : data.photo.work_slug}
            </Link>
            <PhotoStatus photo={data.photo} />
            {data.photo.credit_name ? (
              <p className="text-sm text-muted-foreground">
                {t("photos.credit", { name: data.photo.credit_name })}
              </p>
            ) : null}
          </div>
          {data.photo.user_id === user.id ? (
            <PhotoEditor
              key={`${data.photo.id}:${data.photo.updated_at}`}
              photo={data.photo}
              reload={result.reload}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <p>{data.photo.alt_text}</p>
              {data.photo.caption ? <p>{data.photo.caption}</p> : null}
            </div>
          )}
        </div>
      ) : null}
    </SocialShell>
  );
}

function PhotoEditor({
  photo,
  reload,
}: {
  photo: UserPhoto;
  reload: () => void;
}) {
  const { t, lang } = useT();
  const router = useRouter();
  const [alt, setAlt] = useState(photo.alt_text);
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [visibility, setVisibility] = useState(photo.visibility);
  const [suggestArchive, setSuggestArchive] = useState(
    photo.archive === "suggested" || photo.archive === "accepted",
  );
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<"alt" | "caption" | "form", string>>
  >({});
  const submit = async () => {
    if (busy) return;
    const next: typeof errors = {};
    if (!alt.trim() || alt.trim().length > PHOTO_ALT_MAX)
      next.alt = t("photos.err.alt", { n: PHOTO_ALT_MAX });
    if (caption.length > PHOTO_CAPTION_MAX)
      next.caption = t("photos.err.caption", { n: PHOTO_CAPTION_MAX });
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await updatePhoto(photo.id, {
        alt_text: alt.trim(),
        caption: caption.trim() || null,
        visibility,
        ...(photo.archive === "accepted"
          ? {}
          : { archive: suggestArchive ? "suggested" : "none" }),
      });
      toast.success(t("photos.saved"));
      reload();
    } catch (error) {
      setErrors({ form: t(socialErrorKey(error)) });
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    setErrors({});
    try {
      await deletePhoto(photo);
      toast.success(t("photos.deleted"));
      router.push(href(lang, "/hesap/fotograflar"));
    } catch (error) {
      setErrors({ form: t(socialErrorKey(error)) });
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-6">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <fieldset disabled={busy} className="min-w-0">
          <FieldGroup>
            <Field data-invalid={!!errors.alt}>
              <FieldLabel htmlFor="photo-edit-alt">
                {t("photos.alt")}
              </FieldLabel>
              <Textarea
                id="photo-edit-alt"
                required
                maxLength={PHOTO_ALT_MAX}
                value={alt}
                onChange={(event) => setAlt(event.target.value)}
                aria-invalid={!!errors.alt}
                aria-describedby="photo-edit-alt-help photo-edit-alt-error"
              />
              <FieldDescription id="photo-edit-alt-help">
                {t("photos.altHelp")}
              </FieldDescription>
              <FieldError id="photo-edit-alt-error">{errors.alt}</FieldError>
            </Field>
            <Field data-invalid={!!errors.caption}>
              <FieldLabel htmlFor="photo-edit-caption">
                {t("photos.caption")}
              </FieldLabel>
              <Textarea
                id="photo-edit-caption"
                maxLength={PHOTO_CAPTION_MAX}
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                aria-invalid={!!errors.caption}
                aria-describedby="photo-edit-caption-error"
              />
              <FieldError id="photo-edit-caption-error">
                {errors.caption}
              </FieldError>
            </Field>
            <ChoiceGroup<UserPhoto["visibility"]>
              legend={t("photos.visibility")}
              value={visibility}
              onChange={setVisibility}
              choices={[
                { value: "private", label: t("photos.private") },
                { value: "friends", label: t("photos.friends") },
                { value: "public", label: t("photos.public") },
              ]}
            />
            {visibility === "public" ? (
              <AccountNote text={t("photos.publicNote")} />
            ) : null}
            <Field
              orientation="horizontal"
              className="min-h-12"
              data-disabled={photo.archive === "accepted"}
            >
              <FieldLabel htmlFor="photo-edit-archive">
                {t("photos.archiveSuggest")}
              </FieldLabel>
              <Switch
                id="photo-edit-archive"
                checked={suggestArchive}
                onCheckedChange={setSuggestArchive}
                disabled={photo.archive === "accepted"}
              />
            </Field>
            {suggestArchive ? (
              <AccountNote text={t("photos.archiveNote")} />
            ) : null}
            <FormError text={errors.form} />
            <Button type="submit" className="min-h-12" disabled={busy}>
              {t(busy ? "photos.saving" : "photos.save")}
            </Button>
          </FieldGroup>
        </fieldset>
      </form>
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!busy) setConfirmOpen(open);
        }}
      >
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="min-h-12" disabled={busy}>
            {t("photos.delete")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("photos.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("photos.deleteBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-12" disabled={busy}>
              {t("photos.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="min-h-12"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
            >
              {t("photos.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
