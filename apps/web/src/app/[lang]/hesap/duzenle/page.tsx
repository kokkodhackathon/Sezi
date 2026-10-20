"use client";

import {
  AVATAR_TONES,
  DisplayName,
  NAME_MAX,
  Username,
  USERNAME_MAX,
  USERNAME_MIN,
  type Identity,
} from "@sezi/shared";
import { CheckIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar, AVATAR_TONE_CLASS } from "@/components/account/avatar";
import { AccountField, FormError } from "@/components/account/form-error";
import { ChoiceGroup } from "@/components/choice-group";
import { PageContainer } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount } from "@/lib/account";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { identityErrorKey, useIdentity, type IdentityController } from "@/lib/identity";
import { cn } from "@/lib/utils";

type Errors = Partial<Record<"name" | "username" | "photo" | "form", string>>;

/**
 * Profili düzenle: fotoğraf (dosya seç / kaldır), ad, @kullanıcı adı, renk (6 Çini 2 tonu) ve görünürlük.
 */
export default function EditProfilePage() {
  const { t, lang } = useT();
  const router = useRouter();
  const { ready, user } = useAccount();
  const { identity, avatar, save, setAvatar, removeAvatar } = useIdentity();

  useEffect(() => {
    if (ready && !user) {
      router.replace(href(lang, "/hesap/giris"));
    }
  }, [ready, user, router, lang]);

  if (!ready || !user) return null;

  if (!identity) {
    return (
      <PageContainer className="max-w-md">
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("account.editProfile")}</h1>
        </header>
        <div role="status" aria-label={t("account.loading")} className="grid gap-4">
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </PageContainer>
    );
  }

  return (
    <Editor
      identity={identity}
      avatar={avatar}
      save={save}
      setAvatar={setAvatar}
      removeAvatar={removeAvatar}
    />
  );
}

function Editor({
  identity,
  avatar,
  save,
  setAvatar,
  removeAvatar,
}: { identity: Identity } & Omit<IdentityController, "identity" | "loading">) {
  const { t, lang } = useT();
  const router = useRouter();
  const toneGroupId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(identity.display_name);
  const [username, setUsername] = useState(identity.username ?? "");
  const [tone, setTone] = useState(identity.avatar_tone);
  const [visibility, setVisibility] = useState(identity.visibility);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const onFilePick = async (file: File | undefined) => {
    if (!file) return;
    setErrors({});
    setPhotoBusy(true);
    try {
      await setAvatar(file);
      toast.success(t("account.photoSaved"));
    } catch (e) {
      setErrors({ photo: t(identityErrorKey(e)) });
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const dropPhoto = async () => {
    setErrors({});
    setPhotoBusy(true);
    try {
      await removeAvatar();
      toast.success(t("account.photoRemoved"));
    } catch (e) {
      setErrors({ photo: t(identityErrorKey(e)) });
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = async () => {
    if (busy) return;
    const n = DisplayName.safeParse(name);
    const uname = username.trim();
    const u = Username.safeParse(uname);
    const usernameOk = !uname || u.success;
    const next: Errors = {
      name: n.success ? undefined : t("account.err.invalid_name", { n: NAME_MAX }),
      username: usernameOk ? undefined : t("account.err.invalid_username", { min: USERNAME_MIN, max: USERNAME_MAX }),
    };
    setErrors(next);
    if (!n.success || !usernameOk) return;
    setBusy(true);
    try {
      await save({
        display_name: n.data,
        username: uname ? (u.data ?? null) : null,
        avatar_tone: tone,
        visibility,
      });
      toast.success(t("account.profileSaved"));
      router.push(href(lang, "/hesap"));
    } catch (e) {
      const key = identityErrorKey(e);
      setErrors(key === "account.err.username_taken" ? { username: t(key) } : { form: t(key) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer className="max-w-md">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("account.editProfile")}</h1>
      </header>
      <form
        noValidate
        className="grid gap-6 rounded-lg border bg-card p-6"
        onSubmit={(ev) => {
          ev.preventDefault();
          void submit();
        }}
      >
            <div className="flex flex-col items-center gap-3">
              <Avatar
                identity={{ display_name: name || identity.display_name, avatar_tone: tone }}
                src={avatar}
                size={96}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                aria-label={t("account.photoPick")}
                className="sr-only"
                onChange={(ev) => void onFilePick(ev.target.files?.[0])}
              />
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={photoBusy}
                  onClick={() => fileRef.current?.click()}
                >
                  <UploadIcon aria-hidden />
                  {photoBusy ? t("account.photoUploading") : t("account.photoPick")}
                </Button>
                {identity.avatar_path ? (
                  <Button type="button" variant="ghost" disabled={photoBusy} onClick={() => void dropPhoto()}>
                    {t("account.photoRemove")}
                  </Button>
                ) : null}
              </div>
              <FormError text={errors.photo} className="w-full" />
            </div>

            <AccountField
              label={t("account.name")}
              placeholder={t("account.namePlaceholder")}
              help={t("account.nameHelp")}
              error={errors.name}
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              autoComplete="name"
              maxLength={NAME_MAX}
            />

            <AccountField
              label={t("account.username")}
              prefix="@"
              placeholder={t("account.usernamePlaceholder")}
              help={t("account.usernameHelp", { min: USERNAME_MIN, max: USERNAME_MAX })}
              error={errors.username}
              value={username}
              onChange={(ev) => setUsername(ev.target.value.toLowerCase().replace(/\s/g, ""))}
              autoComplete="username"
              maxLength={USERNAME_MAX}
            />

            <div className="grid gap-2">
              <p id={toneGroupId} className="font-heading text-sm font-bold">
                {t("account.tone")}
              </p>
              <div role="radiogroup" aria-labelledby={toneGroupId} className="flex flex-wrap gap-3">
                {AVATAR_TONES.map((k) => {
                  const selected = tone === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={t(`account.tone.${k}`)}
                      onClick={() => setTone(k)}
                      className={cn(
                        "inline-flex size-12 items-center justify-center rounded-full border-2 transition-transform",
                        AVATAR_TONE_CLASS[k],
                        selected ? "border-foreground ring-2 ring-ring" : "border-transparent contrast:border-border",
                      )}
                    >
                      {selected ? <CheckIcon className="size-5" aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground">
                {t("account.toneHelp", { tone: t(`account.tone.${tone}`) })}
              </p>
            </div>

            <ChoiceGroup
              legend={t("account.visibility")}
              value={visibility}
              onChange={setVisibility}
              choices={[
                { value: "private", label: t("account.visPrivate"), description: t("account.visPrivateHelp") },
                { value: "public", label: t("account.visPublic"), description: t("account.visPublicHelp") },
              ]}
            />

            <FormError text={errors.form} />

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button type="submit" disabled={busy}>
                {busy ? t("account.saving") : t("account.save")}
              </Button>
              <Button variant="ghost" asChild>
                <Link href={href(lang, "/hesap")}>{t("common.cancel")}</Link>
              </Button>
            </div>
      </form>
    </PageContainer>
  );
}
