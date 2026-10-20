"use client";

import { profileFor } from "@sezi/shared";
import { ChevronRightIcon, KeyRoundIcon, LogOutIcon, PencilIcon, Trash2Icon, UserCheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/account/avatar";
import { AccountNote, FormError } from "@/components/account/form-error";
import { PageContainer, PageIntro } from "@/components/page";
import { ProfileDialog } from "@/components/profile-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  const { ready, user, pending } = useAccount();
  const { identity, avatar } = useIdentity();
  const savedProfile = useProfile();
  const profile = savedProfile ?? profileFor("walker", lang);
  const [profileOpen, setProfileOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [outError, setOutError] = useState<string | null>(null);

  const profileSummary = `${t(`profile.vision.${profile.vision}`)} · ${t(`profile.mobility.${profile.mobility}`)} · ${t(`profile.hearing.${profile.hearing}`)}`;

  if (!ready) {
    return (
      <PageContainer className="max-w-xl">
        <PageIntro title={t("account.title")} />
        <div role="status" aria-label={t("account.loading")} className="grid gap-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer className="max-w-xl">
        <PageIntro title={t("account.title")} lead={t("account.intro")} />
        <div className="grid gap-6">
          <Card>
            <CardContent className="grid gap-4">
              <div className="grid gap-1">
                <h2 className="font-heading text-base font-bold">{t("account.benefitSync")}</h2>
                <p className="text-sm text-muted-foreground">{t("account.benefitSyncSub")}</p>
              </div>
              <div className="border-t pt-4 grid gap-1">
                <h2 className="font-heading text-base font-bold">{t("account.benefitSoon")}</h2>
                <p className="text-sm text-muted-foreground">{t("account.benefitSoonSub")}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <div className="grid gap-1">
                <h2 className="font-heading text-base font-bold">{t("profile.title")}</h2>
                <p className="text-sm text-muted-foreground">{profileSummary}</p>
              </div>
              <Button variant="outline" onClick={() => setProfileOpen(true)}>
                {t("profile.change")}
              </Button>
            </CardContent>
          </Card>

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
    <PageContainer className="max-w-xl">
      <PageIntro title={t("account.title")} />
      <div className="grid gap-6">
        <Card>
          <CardContent className="grid gap-4">
            <div className="flex items-center gap-4">
              <Avatar identity={identity} src={avatar} size={72} />
              <div className="min-w-0 flex-1 grid gap-1">
                <h2 className="truncate font-heading text-xl font-extrabold">{name}</h2>
                <p className="truncate text-sm text-muted-foreground">
                  {identity?.username ? `@${identity.username}` : user.email}
                </p>
                {identity ? (
                  <div className="pt-1">
                    <Badge variant="secondary">
                      {t(identity.visibility === "public" ? "account.visPublic" : "account.visPrivate")}
                    </Badge>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="border-t pt-3">
              <Link
                href={href(lang, "/hesap/duzenle")}
                className="flex min-h-12 items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted"
              >
                <span className="flex items-center gap-3">
                  <PencilIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="grid">
                    <span className="font-heading text-sm font-bold">{t("account.editProfile")}</span>
                    <span className="text-xs text-muted-foreground">{t("account.editProfileSub")}</span>
                  </span>
                </span>
                <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <UserCheckIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="grid gap-1">
                <h2 className="font-heading text-base font-bold">{t("profile.title")}</h2>
                <p className="text-sm text-muted-foreground">{profileSummary}</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setProfileOpen(true)}>
              {t("profile.change")}
            </Button>
          </CardContent>
        </Card>

        <AccountNote text={t(pending ? "account.syncPending" : "account.syncDone")} />

        <Card>
          <CardContent className="grid gap-2">
            <Link
              href={href(lang, "/hesap/sifre?mod=degistir")}
              className="flex min-h-12 items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted"
            >
              <span className="flex items-center gap-3 font-heading text-sm font-bold">
                <KeyRoundIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                {t("account.changePassword")}
              </span>
              <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>

            <div className="border-t pt-3 grid gap-2">
              <Button variant="outline" onClick={() => void handleSignOut()} disabled={leaving} className="justify-center">
                <LogOutIcon aria-hidden />
                {leaving ? t("account.signingOut") : t("account.signOut")}
              </Button>
              <p className="text-center text-xs text-muted-foreground">{t("account.signOutHint")}</p>
              <FormError text={outError} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Link
              href={href(lang, "/hesap/sil")}
              className="flex min-h-12 items-center justify-between gap-3 rounded-lg px-2 py-2 text-destructive hover:bg-destructive/5"
            >
              <span className="flex items-center gap-3 font-heading text-sm font-bold">
                <Trash2Icon className="size-5 shrink-0" aria-hidden />
                {t("account.delete")}
              </span>
              <ChevronRightIcon className="size-5 shrink-0" aria-hidden />
            </Link>
          </CardContent>
        </Card>
      </div>
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </PageContainer>
  );
}
