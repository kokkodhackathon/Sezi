"use client";

import { useId } from "react";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export interface Choice<V extends string> {
  value: V;
  label: string;
  description?: string;
}

/**
 * Tek seçimli liste: her seçenek tam satır, en az 48 px yüksek, etiketin tamamı tıklanır.
 * Grup adı görünür başlıktır (`aria-labelledby`); seçili satır renk yanında çerçeve kalınlığıyla da ayrılır.
 */
export function ChoiceGroup<V extends string>({
  legend,
  value,
  onChange,
  choices,
  className,
  legendHidden,
}: {
  legend: string;
  value: V;
  onChange: (v: V) => void;
  choices: Choice<V>[];
  className?: string;
  legendHidden?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn("grid gap-2", className)}>
      <p id={`${id}-legend`} className={cn("font-heading text-sm font-bold", legendHidden && "sr-only")}>
        {legend}
      </p>
      <RadioGroup
        aria-labelledby={`${id}-legend`}
        value={value}
        onValueChange={(v) => {
          const hit = choices.find((c) => c.value === v);
          if (hit) onChange(hit.value);
        }}
        className="gap-2"
      >
        {choices.map((c) => (
          <label
            key={c.value}
            htmlFor={`${id}-${c.value}`}
            className={cn(
              "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm",
              c.value === value ? "border-2 border-primary" : "border-border",
            )}
          >
            <RadioGroupItem id={`${id}-${c.value}`} value={c.value} />
            <span className="grid">
              <span className="font-semibold">{c.label}</span>
              {c.description ? <span className="text-muted-foreground">{c.description}</span> : null}
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
