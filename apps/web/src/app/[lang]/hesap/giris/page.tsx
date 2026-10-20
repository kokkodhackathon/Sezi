"use client";

import { Email } from "@sezi/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AccountField, FormError } from "@/components/account/form-error";
import { PasswordField } from "@/components/account/password-field";
import { PageContainer } from "@/components/page";
import { Button } from "@/components/ui/button";
import { errorCode, errorKey, resendSignupCode, signIn } from "@/lib/account";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";

/**
 * Giriş: e-posta + şifre. Doğrulanmamış hesapta yeni kod gönderilip doğrulama sayfasına geçilir.
 * "Şifremi unuttum" bağlantısı şifre alanının hemen altındadır.
 */
export default function SignInPage() {
  const { t, lang } = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"email" | "form", string>>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    const e = Email.safeParse(email);
    if (!e.success) {
      setErrors({ email: t("account.err.invalid_email") });
      return;
    }
    if (!password) {
      setErrors({ form: t("account.err.invalid_credentials") });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await signIn(e.data, password);
      router.replace(href(lang, "/hesap"));
    } catch (err) {
      if (errorCode(err) === "email_not_confirmed") {
        await resendSignupCode(e.data).catch(() => undefined);
        router.push(href(lang, `/hesap/dogrula?email=${encodeURIComponent(e.data)}`));
        return;
      }
      setErrors({ form: t(errorKey(err)) });
    } finally {
      setBusy(false);
    }
  };

  const trimmedEmail = email.trim();
  const forgotPath = trimmedEmail
    ? `/hesap/sifremi-unuttum?email=${encodeURIComponent(trimmedEmail)}`
    : "/hesap/sifremi-unuttum";

  return (
    <PageContainer className="max-w-md">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("account.signIn")}</h1>
      </header>
      <form
        noValidate
        className="grid gap-5 rounded-lg border bg-card p-6"
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
          error={errors.email}
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          autoComplete="email"
        />
        <div className="grid gap-1">
          <PasswordField label={t("account.password")} value={password} onChange={setPassword} />
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" asChild>
              <Link href={href(lang, forgotPath)}>{t("account.forgot")}</Link>
            </Button>
          </div>
        </div>
        <FormError text={errors.form} />
        <div className="grid gap-2 pt-1">
          <Button type="submit" disabled={busy}>
            {busy ? t("account.signingIn") : t("account.signIn")}
          </Button>
          <Button variant="outline" asChild>
            <Link href={href(lang, "/hesap/kayit")}>{t("account.noAccount")}</Link>
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
