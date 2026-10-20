"use client";

import { DisplayName, Email, NAME_MAX, Password } from "@sezi/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AccountField, AccountNote, FormError } from "@/components/account/form-error";
import { PasswordField } from "@/components/account/password-field";
import { PageContainer, PageIntro } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { errorKey, signUp } from "@/lib/account";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";

type Errors = Partial<Record<"name" | "email" | "password" | "form", string>>;

/** Kayıt: ad, e-posta, şifre → e-postaya 6 haneli doğrulama kodu → doğrulama sayfası. */
export default function SignUpPage() {
  const { t, lang } = useT();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    const n = DisplayName.safeParse(name);
    const e = Email.safeParse(email);
    const p = Password.safeParse(password);
    const next: Errors = {
      name: n.success ? undefined : t("account.err.invalid_name", { n: NAME_MAX }),
      email: e.success ? undefined : t("account.err.invalid_email"),
      password: p.success ? undefined : t("account.err.invalid_password"),
    };
    setErrors(next);
    if (!n.success || !e.success || !p.success) return;
    setBusy(true);
    try {
      await signUp({ name: n.data, email: e.data, password: p.data, lang });
      router.replace(href(lang, `/hesap/dogrula?email=${encodeURIComponent(e.data)}`));
    } catch (err) {
      setErrors({ form: t(errorKey(err)) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer className="max-w-lg">
      <PageIntro title={t("account.signUp")} lead={t("account.signUpLead")} />
      <div className="grid gap-6">
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
                label={t("account.email")}
                type="email"
                inputMode="email"
                placeholder={t("account.emailPlaceholder")}
                error={errors.email}
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                autoComplete="email"
              />
              <PasswordField
                isNew
                label={t("account.password")}
                value={password}
                onChange={setPassword}
                error={errors.password}
              />
              <FormError text={errors.form} />
              <div className="grid gap-2 pt-1">
                <Button type="submit" disabled={busy}>
                  {busy ? t("account.sending") : t("account.signUp")}
                </Button>
                <Button variant="ghost" asChild>
                  <Link href={href(lang, "/hesap/giris")}>{t("account.haveAccount")}</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <AccountNote text={t("account.privacy")} />
      </div>
    </PageContainer>
  );
}
