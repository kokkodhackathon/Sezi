"use client";

import { AlertCircleIcon, InfoIcon } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Form genel hatası (sunucu, ağ): alanların altında, ikonla; ekran okuyucu hemen duyurur. */
export function FormError({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex items-start gap-3 rounded-lg border-2 border-destructive bg-destructive/5 p-4 text-sm font-medium text-destructive",
        className,
      )}
    >
      <AlertCircleIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>{text}</span>
    </div>
  );
}

/** Bilgilendirme kutusu (gizlilik, kod gelmediyse, eşitleme durumu). */
export function AccountNote({ text, live, className }: { text: string; live?: boolean; className?: string }) {
  return (
    <div
      role={live ? "status" : undefined}
      aria-live={live ? "polite" : undefined}
      className={cn("flex items-start gap-3 rounded-lg border bg-muted/60 p-4 text-sm text-muted-foreground", className)}
    >
      <InfoIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
      <span>{text}</span>
    </div>
  );
}

/**
 * Etiketli metin alanı: görünür etiket, yer tutucu, açıklama ve hata metni (`aria-describedby`, `aria-invalid`).
 */
export function AccountField({
  label,
  help,
  error,
  prefix,
  className,
  ...inputProps
}: Omit<ComponentProps<typeof Input>, "id" | "prefix"> & {
  label: string;
  help?: string;
  error?: string;
  prefix?: ReactNode;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <Field data-invalid={!!error || undefined} className={className}>
      <FieldLabel htmlFor={id} className="font-heading text-sm font-bold">
        {label}
      </FieldLabel>
      <div className="relative flex items-center">
        {prefix ? (
          <span className="pointer-events-none absolute left-3 select-none text-muted-foreground" aria-hidden>
            {prefix}
          </span>
        ) : null}
        <Input
          id={id}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn("h-12", prefix && "pl-8")}
          {...inputProps}
        />
      </div>
      {help ? <FieldDescription id={helpId}>{help}</FieldDescription> : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}
