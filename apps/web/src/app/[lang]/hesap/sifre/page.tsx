"use client";

import { Code, Password } from "@sezi/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { CodeField, useCooldown } from "@/components/account/code-input";
import { FormError } from "@/components/account/form-error";
import { PasswordField } from "@/components/account/password-field";
import { PageContainer, PageIntro } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { errorKey, sendPasswordChangeCode, setPassword, useAccount } from "@/lib/account";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";

function PasswordContent() {
  const { t, lang } = useT();
  const router = useRouter();
  const sp = useSearchParams();
  const { ready, user } = useAccount();
  const mod = sp.get("mod") ?? sp.get("mode");
  const change = mod === "degistir" || mod === "change";

  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPw] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"code" | "password" | "form", string>>>({});
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown(false);

  useEffect(() => {
    if (ready && !user) {
      router.replace(href(lang, "/hesap/giris"));
    }
  }, [ready, user, router, lang]);

  if (!ready || !user) return null;

  const sendCode = async () => {
    setErrors({});
    setBusy(true);
    try {
      await sendPasswordChangeCode();
      setSent(true);
      cooldown.restart();
    } catch (err) {
      setErrors({ form: t(errorKey(err)) });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (busy) return;
    const p = Password.safeParse(password);
    const c = Code.safeParse(code);
    const next = {
      password: p.success ? undefined : t("account.err.invalid_password"),
      code: !change || c.success ? undefined : t("account.err.invalid_code"),
    };
    setErrors(next);
    if (!p.success || next.code) return;
    setBusy(true);
    try {
      await setPassword(p.data, change ? c.data : undefined);
      toast.success(t("account.passwordSaved"));
      router.replace(href(lang, "/hesap"));
    } catch (err) {
      setErrors({ form: t(errorKey(err)) });
    } finally {
      setBusy(false);
    }
  };

  const title = t(change ? "account.changePassword" : "account.newPasswordTitle");

  if (change && !sent) {
    return (
      <PageContainer className="max-w-lg">
        <PageIntro title={title} lead={t("account.changePasswordLead", { email: user.email ?? "" })} />
        <Card>
          <CardContent className="grid gap-4">
            <FormError text={errors.form} />
            <Button onClick={() => void sendCode()} disabled={busy}>
              {busy ? t("account.sending") : t("account.sendCode")}
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-lg">
      <PageIntro
        title={title}
        lead={change ? t("account.codeSent", { email: user.email ?? "" }) : t("account.newPasswordLead")}
      />
      <Card>
        <CardContent>
          <form
            noValidate
            className="grid gap-5"
            onSubmit={(ev) => {
              ev.preventDefault();
              void save();
            }}
          >
            {change ? <CodeField value={code} onChange={setCode} error={errors.code} /> : null}
            <PasswordField
              isNew
              label={t("account.newPassword")}
              value={password}
              onChange={setPw}
              error={errors.password}
            />
            <FormError text={errors.form} />
            <div className="grid gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? t("account.saving") : t("account.savePassword")}
              </Button>
              {change ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void sendCode()}
                  disabled={cooldown.left > 0 || busy}
                >
                  {cooldown.left > 0 ? t("account.resendIn", { s: cooldown.left }) : t("account.resend")}
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

/** Şifre sıfırlama (`?mod=sifirlama`) ve şifre değiştirme (`?mod=degistir`) sayfası. */
export default function PasswordPage() {
  return (
    <Suspense>
      <PasswordContent />
    </Suspense>
  );
}
