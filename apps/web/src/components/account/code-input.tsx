"use client";

import { Code, CODE_LENGTH, RESEND_SECONDS } from "@sezi/shared";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { AccountNote } from "@/components/account/form-error";
import { PageContainer } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { errorKey, requestPasswordReset, resendSignupCode, verifyPasswordReset, verifySignup } from "@/lib/account";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";

/** Yeniden gönderme sayacı: sunucu aynı adrese dakikada bir kod gönderir (`RESEND_SECONDS`). */
export function useCooldown(startActive = true) {
  const [left, setLeft] = useState(startActive ? RESEND_SECONDS : 0);
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return { left, restart: () => setLeft(RESEND_SECONDS) };
}

/**
 * 6 haneli doğrulama kodu alanı: `autocomplete="one-time-code"`, `inputMode="numeric"`,
 * 6. haneye ulaşınca otomatik gönderim (`onComplete`).
 */
export function CodeField({
  value,
  onChange,
  error,
  onComplete,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
}) {
  const { t } = useT();
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [helpId, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <Field data-invalid={!!error || undefined}>
      <FieldLabel htmlFor={id} className="font-heading text-sm font-bold">
        {t("account.code")}
      </FieldLabel>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        placeholder={t("account.codePlaceholder")}
        value={value}
        autoFocus={autoFocus}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
          onChange(digits);
          if (digits.length === CODE_LENGTH) onComplete?.(digits);
        }}
        className="num h-14 text-center font-heading text-2xl font-extrabold tracking-[0.4em]"
      />
      <FieldDescription id={helpId}>{t("account.codeHelp", { n: CODE_LENGTH })}</FieldDescription>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}

/**
 * Kayıt (`dogrula`) ve şifre sıfırlama (`sifirlama-kodu`) için ortak 6 haneli kod doğrulama ekranı.
 */
export function CodeVerify({ mode, email }: { mode: "signup" | "recovery"; email: string }) {
  const { t, lang } = useT();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown(true);

  const submit = async (value = code) => {
    if (busy) return;
    const parsed = Code.safeParse(value);
    if (!parsed.success) {
      setError(t("account.err.invalid_code"));
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      if (mode === "recovery") {
        await verifyPasswordReset(email, parsed.data);
        router.replace(href(lang, "/hesap/sifre?mod=sifirlama"));
      } else {
        await verifySignup(email, parsed.data);
        toast.success(t("account.verified"));
        router.replace(href(lang, "/hesap"));
      }
    } catch (err) {
      setError(t(errorKey(err)));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(undefined);
    try {
      if (mode === "recovery") await requestPasswordReset(email);
      else await resendSignupCode(email);
      cooldown.restart();
      setInfo(t("account.resent"));
    } catch (err) {
      setError(t(errorKey(err)));
    }
  };

  return (
    <PageContainer className="max-w-md">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t(mode === "recovery" ? "account.forgotTitle" : "account.verifyTitle")}
        </h1>
        {email ? <p className="mt-1 text-sm text-muted-foreground">{email}</p> : null}
      </header>
      <div className="grid gap-6">
        <form
          className="grid gap-5 rounded-lg border bg-card p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <CodeField value={code} onChange={setCode} error={error} onComplete={(c) => void submit(c)} autoFocus />
          <div className="grid gap-2">
            <Button type="submit" disabled={busy || code.length < CODE_LENGTH}>
              {busy ? t("account.checking") : t("account.verify")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => void resend()} disabled={cooldown.left > 0 || busy}>
              {cooldown.left > 0 ? t("account.resendIn", { s: cooldown.left }) : t("account.resend")}
            </Button>
          </div>
          {info ? (
            <p role="status" aria-live="polite" className="text-center text-sm text-muted-foreground">
              {info}
            </p>
          ) : null}
        </form>
        <AccountNote text={t(mode === "recovery" ? "account.noCodeRecovery" : "account.noCode")} />
      </div>
    </PageContainer>
  );
}
