"use client";

import { ALargeSmallIcon, ContrastIcon, MenuIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar } from "@/components/account/avatar";
import { useAccount } from "@/lib/account";
import { setAppearance, TEXT_SIZES, useAppearance } from "@/lib/appearance";
import { href, type MessageKey } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { useIdentity } from "@/lib/identity";
import { cn } from "@/lib/utils";

const LINKS: { path: string; label: MessageKey }[] = [
  { path: "/rota", label: "nav.route" },
  { path: "/turlar", label: "nav.tours" },
  { path: "/sergiler", label: "nav.exhibitions" },
];

function useActive() {
  const pathname = usePathname();
  const rest = pathname.replace(/^\/(tr|en)(?=\/|$)/, "");
  return { pathname, rest, isActive: (path: string) => rest === path || rest.startsWith(`${path}/`) };
}

/**
 * Görünüm: yüksek kontrast anahtarı ve üç yazı boyutu (her seçenek kendi boyutunda "A"). Açılır pencere tetikleyiciden
 * açılır; değişiklik hemen uygulanır.
 */
function AppearanceMenu() {
  const { t } = useT();
  const a = useAppearance();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("appearance.open")}>
          <ALargeSmallIcon aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-0 p-2">
        <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-lg px-2 hover:bg-muted">
          <span className="flex items-center gap-2.5 text-sm font-semibold">
            <ContrastIcon className="size-4" aria-hidden />
            {t("appearance.contrast")}
          </span>
          <Switch checked={a.contrast} onCheckedChange={(v) => setAppearance({ contrast: v })} />
        </label>
        <div className="px-2 pt-2 pb-1">
          <p id="text-size-label" className="pb-2 text-sm font-semibold">
            {t("appearance.text")}
          </p>
          <div role="radiogroup" aria-labelledby="text-size-label" className="grid grid-cols-3 gap-1 rounded-lg bg-secondary p-1">
            {TEXT_SIZES.map((s, i) => {
              const on = a.text === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={t(`appearance.text.${s}`)}
                  onClick={() => setAppearance({ text: s })}
                  className={cn(
                    "flex min-h-12 items-end justify-center rounded-lg pb-2.5 font-heading font-extrabold leading-none transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]",
                    on ? "bg-card text-foreground shadow-sm contrast:outline-2 contrast:outline-border" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span style={{ fontSize: `${0.875 + i * 0.25}rem` }} aria-hidden>
                    A
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LangSwitch() {
  const { t, lang } = useT();
  const { rest } = useActive();
  const other = lang === "tr" ? "en" : "tr";
  return (
    <Button variant="ghost" asChild>
      <Link href={href(other, rest)} hrefLang={other} lang={other} aria-label={t("nav.langLabel")}>
        {t("nav.lang")}
      </Link>
    </Button>
  );
}

/** Hesap düğmesi: girişsizken "Giriş yap", girişliyken avatar + ad → hesap sayfası. */
function AccountLink({ onNavigate }: { onNavigate?: () => void }) {
  const { t, lang } = useT();
  const { ready, user } = useAccount();
  const { identity, avatar } = useIdentity();
  if (!ready) return <span className="inline-block h-10 w-24" aria-hidden />;
  if (!user) {
    return (
      <Button variant="default" asChild>
        <Link href={href(lang, "/hesap/giris")} onClick={onNavigate}>
          <UserRoundIcon aria-hidden />
          {t("nav.signIn")}
        </Link>
      </Button>
    );
  }
  const name = identity?.display_name || user.email || t("nav.account");
  return (
    <Button variant="ghost" asChild>
      <Link href={href(lang, "/hesap")} onClick={onNavigate} aria-label={`${t("nav.account")}: ${name}`}>
        <Avatar identity={identity} src={avatar} size={28} />
        <span className="max-w-36 truncate">{name}</span>
      </Link>
    </Button>
  );
}

export function SiteHeader() {
  const { t, lang } = useT();
  const { isActive } = useActive();
  const [open, setOpen] = useState(false);

  const links = (onNavigate?: () => void, vertical = false) =>
    LINKS.map((l) => (
      <Link
        key={l.path}
        href={href(lang, l.path)}
        onClick={onNavigate}
        aria-current={isActive(l.path) ? "page" : undefined}
        className={cn(
          "inline-flex min-h-12 items-center rounded-lg px-3 font-heading text-[0.9375rem] font-bold text-muted-foreground hover:bg-muted hover:text-foreground",
          "aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8",
          vertical && "w-full",
        )}
      >
        {t(l.label)}
      </Link>
    ));

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
      >
        {t("nav.skip")}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
        <Link href={href(lang)} className="mr-2 inline-flex min-h-12 min-w-12 items-center justify-center font-heading text-2xl font-extrabold tracking-tight text-link" aria-label={t("nav.home")}>
          {t("site.name")}
        </Link>
        <nav aria-label={t("nav.main")} className="hidden flex-1 items-center gap-1 lg:flex">
          {links()}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <LangSwitch />
          <AppearanceMenu />
          <div className="hidden sm:block">
            <AccountLink />
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("nav.menu")}>
                <MenuIcon aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>{t("nav.menuTitle")}</SheetTitle>
              </SheetHeader>
              <nav aria-label={t("nav.main")} className="grid gap-1 px-4">
                {links(() => setOpen(false), true)}
                <div className="pt-3 sm:hidden">
                  <AccountLink onNavigate={() => setOpen(false)} />
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
