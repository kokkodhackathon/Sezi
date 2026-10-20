"use client";

import { PASSWORD_MIN } from "@sezi/shared";
import { CheckIcon, CircleIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n-client";
import { cn } from "@/lib/utils";

const RULES = [
  { key: "account.ruleLength", ok: (p: string) => p.length >= PASSWORD_MIN },
  { key: "account.ruleLetter", ok: (p: string) => /\p{L}/u.test(p) },
  { key: "account.ruleDigit", ok: (p: string) => /\d/.test(p) },
] as const;

/** Şifre kuralları: yazdıkça her kural ikon + metinle ayrı ayrı işaretlenir. */
export function PasswordRules({ value, id }: { value: string; id?: string }) {
  const { t } = useT();
  return (
    <ul id={id} className="grid gap-1.5 text-sm">
      {RULES.map((r) => {
        const ok = r.ok(value);
        return (
          <li
            key={r.key}
            className={cn("flex items-center gap-2", ok ? "font-medium text-foreground" : "text-muted-foreground")}
          >
            {ok ? (
              <CheckIcon className="size-4 shrink-0 text-link" aria-hidden />
            ) : (
              <CircleIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span>
              {t(r.key)}
              {ok ? <span className="sr-only">{`, ${t("account.ruleMet")}`}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Şifre alanı: sağda 48×48 göster/gizle düğmesi. Yeni şifrede (`isNew`) kurallar alanın altında
 * canlı olarak güncellenir ve `aria-describedby` ile alana bağlanır.
 */
export function PasswordField({
  label,
  value,
  onChange,
  error,
  isNew,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  isNew?: boolean;
}) {
  const { t } = useT();
  const id = useId();
  const rulesId = `${id}-rules`;
  const errorId = `${id}-error`;
  const [visible, setVisible] = useState(false);
  const describedBy = [isNew ? rulesId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <Field data-invalid={!!error || undefined}>
      <FieldLabel htmlFor={id} className="font-heading text-sm font-bold">
        {label}
      </FieldLabel>
      <div className="relative flex items-center">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={isNew ? "new-password" : "current-password"}
          placeholder={t(isNew ? "account.newPasswordPlaceholder" : "account.passwordPlaceholder")}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className="h-12 pr-12"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("account.hide") : t("account.show")}
          className="absolute right-1"
        >
          {visible ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
        </Button>
      </div>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      {isNew ? <PasswordRules id={rulesId} value={value} /> : null}
    </Field>
  );
}
