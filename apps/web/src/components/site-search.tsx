"use client";

import { loc, searchWorks, WorkRowSchema } from "@sezi/shared";
import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { SeziLoader } from "@/components/sezi-loader";
import { Button } from "@/components/ui/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { browserSupabase } from "@/lib/supabase-browser";

const IndexRow = WorkRowSchema.pick({ slug: true, name: true, type_slug: true, type_name: true, city_name: true, district: true });
type IndexRow = z.infer<typeof IndexRow>;

const LIMIT = 8;

/**
 * Üst menüde arama (Ctrl+K / ⌘K): her sayfadan açılır, eser adı yazınca doğrudan eser sayfasına gider.
 * Eser dizini (yalnız ad, tür, yer) ilk açılışta çekilir ve oturum boyunca bellekte kalır; arama ortak
 * `searchWorks` ile tarayıcıda yapılır (ana sayfadaki aramayla aynı sonuç).
 */
export function SiteSearch() {
  const { t, lang } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState<IndexRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || index) return;
    let cancelled = false;
    setFailed(false);
    void browserSupabase()
      .from("works_view")
      .select("slug, name, type_slug, type_name, city_name, district")
      .eq("status", "verified")
      .then(({ data, error }) => {
        if (cancelled) return;
        const parsed = z.array(IndexRow).safeParse(data);
        if (error || !parsed.success) setFailed(true);
        else setIndex(parsed.data);
      });
    return () => {
      cancelled = true;
    };
  }, [open, index]);

  const results = useMemo(() => (index && q.trim() ? searchWorks(q, index).slice(0, LIMIT) : []), [index, q]);

  const go = (slug: string) => {
    setOpen(false);
    setQ("");
    router.push(href(lang, `/eser/${slug}`));
  };

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} aria-label={t("search.open")} aria-keyshortcuts="Control+K Meta+K" className="gap-2 max-sm:size-12 max-sm:px-0 group-data-[scrolled=true]/header:size-12 group-data-[scrolled=true]/header:px-0">
        <SearchIcon aria-hidden />
        <span className="hidden sm:inline group-data-[scrolled=true]/header:hidden">{t("search.button")}</span>
        <kbd className="hidden group-data-[scrolled=true]/header:hidden rounded border bg-muted px-1.5 font-sans text-[0.6875rem] font-semibold text-muted-foreground lg:inline">Ctrl K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title={t("search.open")} description={t("search.placeholder")}>
        <Command shouldFilter={false}>
          <CommandInput value={q} onValueChange={setQ} placeholder={t("search.placeholder")} />
          <CommandList>
            {!index ? (
              <div role="status" className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                {failed ? (
                  t("search.failed")
                ) : (
                  <>
                    <SeziLoader className="size-4" aria-hidden />
                    {t("search.loading")}
                  </>
                )}
              </div>
            ) : q.trim() ? (
              <>
                <CommandEmpty>{t("search.empty")}</CommandEmpty>
                <CommandGroup>
                  {results.map((w) => (
                    <CommandItem key={w.slug} value={w.slug} onSelect={go} className="min-h-12 flex-col items-start gap-0">
                      <span className="font-semibold">{loc(w.name, lang)}</span>
                      <span className="text-xs text-muted-foreground">
                        {loc(w.type_name, lang)} · {w.district ? `${w.district}, ` : ""}
                        {loc(w.city_name, lang)}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("search.hint")}</p>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
