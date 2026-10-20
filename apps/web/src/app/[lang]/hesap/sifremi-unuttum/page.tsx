"use client";

import { Email } from "@sezi/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AccountField } from "@/components/account/form-error";
import { PageContainer, PageIntro } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { errorKey, requestPasswordReset } from "@/lib/account";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";

function ForgotContent() {
  const { t, lang } = useT();
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState(sp.get("email") ?? "");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    const e = Email.safeParse(email);
    if (!e.success) {
      setError(t("account.err.invalid_email"));
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await requestPasswordReset(e.data);
      router.replace(href(lang, `/hesap/sifirlama-kodu?email=${encodeURIComponent(e.data)}`));
    } catch (err) {
      setError(t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer className="max-w-lg">
      <PageIntro title={t("account.forgotTitle")} lead={t("account.forgotLead")} />
      <Card>
        <CardContent>
          <form
            noValidate
            className="grid gap-5"
            onSubmit={(ev) => {
              ev.preventDefault();
              void submit();
            }}
          >
            <AccountField
              label={t("account.email")}
              type="email"
              inputMode="email"
              placeholder={t("account.emailPlaceholder")}
              error={error}
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              autoComplete="email"
            />
            <Button type="submit" disabled={busy}>
              {busy ? t("account.sending") : t("account.sendCode")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

/** Şifre sıfırlama kodu isteme sayfası (`/hesap/sifremi-unuttum`). */
export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotContent />
    </Suspense>
  );
}
