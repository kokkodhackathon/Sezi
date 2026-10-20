"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/lib/i18n-client";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

/**
 * Filtre çipi: tıklanınca yuvarlak köşeli liste açılır (uzun listede arama kutusuyla). Boş değer "Tümü".
 * Seçim yapılınca çip ana renkle dolar ve seçilen ad yazılır; renk tek başına değil, metin de değişir.
 */
export function FilterSelect({
  label,
  allLabel,
  value,
  options,
  onChange,
  searchable = false,
}: {
  label: string;
  allLabel: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  searchable?: boolean;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  const all: FilterOption = { value: "", label: allLabel };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${current?.label ?? allLabel}`}
          className={cn(
            "inline-flex min-h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm outline-none transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]",
            "focus-visible:ring-3 focus-visible:ring-ring/50 contrast:outline-2 contrast:outline-border",
            current ? "bg-primary font-bold text-primary-foreground" : "bg-secondary font-semibold text-secondary-foreground hover:bg-muted",
          )}
        >
          <span className="max-w-44 truncate">{current?.label ?? label}</span>
          <ChevronDownIcon className={cn("size-4 shrink-0 transition-transform duration-200 ease-out", open && "rotate-180")} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 overflow-hidden rounded-lg p-0">
        <Command className="rounded-lg! p-1.5">
          {searchable ? <CommandInput placeholder={t("route.search")} aria-label={`${label}: ${t("route.search")}`} /> : null}
          <CommandList className="max-h-80">
            <CommandEmpty>{t("route.noMatch")}</CommandEmpty>
            <CommandGroup className="p-0">
              {[all, ...options].map((o) => (
                <CommandItem
                  key={o.value || "__all__"}
                  value={`${o.label} ${o.value}`}
                  data-checked={o.value === value ? "true" : undefined}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className="min-h-11 rounded-lg! px-3 text-[0.9375rem] data-[checked=true]:font-bold"
                >
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.count !== undefined ? <span className="num text-xs text-muted-foreground">{o.count}</span> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
