"use client";

import { profileFor } from "@sezi/shared";
import { ChevronRightIcon, KeyRoundIcon, LogOutIcon, PencilIcon, Trash2Icon, UserCheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/account/avatar";
import { AccountNote, FormError } from "@/components/account/form-error";
import { CommunityTiles, SocialOverview } from "@/components/account/social-overview";
import { PageContainer } from "@/components/page";
import { ProfileDialog } from "@/components/profile-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey, signOut, useAccount } from "@/lib/account";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { useIdentity } from "@/lib/identity";
import { useProfile } from "@/lib/profile";

/**
 * Hesap ana sayfası: girişsizken tanıtım, erişilebilirlik profili özeti ve kayıt/giriş bağlantıları;
 * girişliyken kimlik kartı, erişilebilirlik profili özeti, şifre değişimi, çıkış ve hesap silme.
 */
export default function AccountPage() {
  const { t, lang } = useT();
  const { ready, user } = useAccount();
  const { identity, avatar } = useIdentity();
  const savedProfile = useProfile();
  const profile = savedProfile ?? profileFor("walker", lang);
  const [profileOpen, setProfileOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [outError, setOutError] = useState<string | null>(null);

  const profileSummary = `${t(`profile.vision.${profile.vision}`)} · ${t(`profile.mobility.${profile.mobility}`)} · ${t(`profile.hearing.${profile.hearing}`)}`;

  if (!ready) {
    return (
      <PageContainer className="max-w-md">
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("account.title")}</h1>
        </header>
        <div role="status" aria-label={t("account.loading")} className="grid gap-4">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer className="max-w-md">
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("account.title")}</h1>
        </header>
        <div className="grid gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4">
            <div className="grid gap-0.5">
              <h2 className="font-heading text-sm font-bold">{t("profile.title")}</h2>
              <p className="text-xs text-muted-foreground">{profileSummary}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setProfileOpen(true)}>
              {t("profile.change")}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button asChild>
              <Link href={href(lang, "/hesap/kayit")}>{t("account.signUp")}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={href(lang, "/hesap/giris")}>{t("account.signIn")}</Link>
            </Button>
          </div>

          <AccountNote text={t("account.privacy")} />
        </div>
        <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      </PageContainer>
    );
  }

  const handleSignOut = async () => {
    setLeaving(true);
    setOutError(null);
    try {
      await signOut();
      toast.success(t("account.signedOut"));
    } catch (e) {
      setOutError(t(errorKey(e) === "account.err.network" ? "account.signOutOffline" : "account.err.generic"));
    } finally {
      setLeaving(false);
    }
  };

  const name = identity?.display_name ?? user.email ?? "";

  return (
    <PageContainer className="max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("account.title")}</h1>
      </header>
      {/* Dar ekranda sıra: kimlik, pasaport/başarımlar, topluluk, diğerleri; geniş ekranda pasaport sağ sütunda. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <Link
            href={href(lang, "/hesap/duzenle")}
            aria-label={`${name}${identity?.username ? `, @${identity.username}` : ""}. ${t("account.editProfile")}`}
            className="group flex items-center gap-4 rounded-xl border bg-card p-4 outline-none hover:border-link focus-visible:ring-3 focus-visible:ring-ring"
          >
            <Avatar identity={identity} src={avatar} size={64} />
            <span aria-hidden className="grid min-w-0 flex-1 gap-0.5">
              <span className="truncate font-heading text-xl font-extrabold">{name}</span>
              <span className="truncate text-sm text-muted-foreground">
                {identity?.username ? `@${identity.username}` : user.email}
              </span>
            </span>
            <PencilIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>

          <div className="lg:col-start-2 lg:row-span-5 lg:row-start-1">
            <SocialOverview uid={user.id} />
          </div>

          <div className="lg:col-start-1">
            <CommunityTiles uid={user.id} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <UserCheckIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="grid gap-0.5">
                <h2 className="font-heading text-sm font-bold">{t("profile.title")}</h2>
                <p className="text-xs text-muted-foreground">{profileSummary}</p>
              </div>
            </div>
            <Button variant="outline" className="min-h-12" onClick={() => setProfileOpen(true)}>
              {t("profile.change")}
            </Button>
          </div>

          <div className="grid gap-1 rounded-xl border bg-card p-2">
            <Link
              href={href(lang, "/hesap/sifre?mod=degistir")}
              className="flex min-h-12 items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-muted"
            >
              <span className="flex items-center gap-3 font-heading text-sm font-bold">
                <KeyRoundIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {t("account.changePassword")}
              </span>
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
            <Link
              href={href(lang, "/hesap/sil")}
              className="flex min-h-12 items-center justify-between gap-3 rounded-lg px-3 py-2 text-destructive hover:bg-destructive/5"
            >
              <span className="flex items-center gap-3 font-heading text-sm font-bold">
                <Trash2Icon className="size-4 shrink-0" aria-hidden />
                {t("account.delete")}
              </span>
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </div>

          <div className="grid gap-2">
            <Button variant="outline" onClick={() => void handleSignOut()} disabled={leaving} className="min-h-12 justify-center">
              <LogOutIcon aria-hidden />
              {leaving ? t("account.signingOut") : t("account.signOut")}
            </Button>
            <FormError text={outError} />
          </div>
      </div>
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </PageContainer>
  );
}
