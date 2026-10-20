"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/lib/i18n-client";
import { cn } from "@/lib/utils";

export interface PlaceOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

/**
 * Harita uygulamalarındaki gibi yer kutusu: tıklanınca aranabilir liste açılır (yazarak süzülür, klavyeyle seçilir).
 * Görünür etiket kutunun içinde solda (Nereden / Nereye); seçilen yer kalın yazılır.
 */
export function PlacePicker({
  id,
  label,
  marker,
  value,
  display,
  options,
  onChange,
}: {
  id: string;
  label: string;
  /** Soldaki işaret (başlangıç dairesi, hedef iğnesi). */
  marker: ReactNode;
  value: string;
  /** Kutuda görünen ad. */
  display: string;
  options: PlaceOption[];
  onChange: (value: string) => void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-label={`${label}: ${display}`}
          className={cn(
            "flex min-h-12 w-full items-center gap-3 rounded-lg bg-secondary px-3 text-left text-[0.9375rem] outline-none",
            "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:ring-2 aria-expanded:ring-ring/40 contrast:outline-2 contrast:outline-border",
          )}
        >
          <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden>
            {marker}
          </span>
          <span className="grid min-w-0 flex-1 leading-tight">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="truncate font-semibold">{display}</span>
          </span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0">
        <Command>
          <CommandInput placeholder={t("route.search")} aria-label={`${label}: ${t("route.search")}`} />
          <CommandList className="max-h-72">
            <CommandEmpty>{t("route.noMatch")}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.value}`}
                  data-checked={o.value === value ? "true" : undefined}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className="min-h-11"
                >
                  {o.icon}
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
