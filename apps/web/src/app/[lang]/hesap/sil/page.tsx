"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AccountNote, FormError } from "@/components/account/form-error";
import { PageContainer, PageIntro } from "@/components/page";
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
import { Card, CardContent } from "@/components/ui/card";
import { deleteAccount, errorKey, useAccount } from "@/lib/account";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";

/** Hesabı kalıcı silme: ne silinir, ne kalır açıkça yazılır; son adımda AlertDialog onayı. */
export default function DeleteAccountPage() {
  const { t, lang } = useT();
  const router = useRouter();
  const { ready, user } = useAccount();
  const deletedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && !user && !deletedRef.current) {
      router.replace(href(lang, "/hesap/giris"));
    }
  }, [ready, user, router, lang]);

  if (!ready || (!user && !deletedRef.current)) return null;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      deletedRef.current = true;
      await deleteAccount();
      toast.success(t("account.deleted"));
      router.replace(href(lang, "/hesap"));
    } catch (err) {
      deletedRef.current = false;
      setError(t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer className="max-w-lg">
      <PageIntro title={t("account.deleteTitle")} lead={t("account.deleteLead")} />
      <Card>
        <CardContent className="grid gap-5">
          <AccountNote text={t("account.deleteKeeps")} />
          <FormError text={error} />
          <div className="grid gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={busy}>
                  {busy ? t("account.deleting") : t("account.deleteConfirm")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("account.deleteAsk")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("account.deleteAskBody")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => void run()} disabled={busy}>
                    {busy ? t("account.deleting") : t("account.deleteConfirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="ghost" asChild>
              <Link href={href(lang, "/hesap")}>{t("common.cancel")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
