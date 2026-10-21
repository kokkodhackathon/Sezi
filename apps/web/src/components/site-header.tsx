"use client";

import { ALargeSmallIcon, ContrastIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Avatar } from "@/components/account/avatar";
import { BottomNav } from "@/components/bottom-nav";
import { SiteSearch } from "@/components/site-search";
import { useAccount } from "@/lib/account";
import { setAppearance, TEXT_SIZES, useAppearance } from "@/lib/appearance";
import { href, type MessageKey } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { useIdentity } from "@/lib/identity";
import { useSlidingBox } from "@/lib/use-sliding-box";
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
function AccountLink() {
  const { t, lang } = useT();
  const { ready, user } = useAccount();
  const { identity, avatar } = useIdentity();
  if (!ready) return <span className="inline-block h-10 w-24" aria-hidden />;
  if (!user) {
    return (
      <Button variant="default" asChild>
        <Link href={href(lang, "/hesap/giris")}>
          <UserRoundIcon aria-hidden />
          {t("nav.signIn")}
        </Link>
      </Button>
    );
  }
  const name = identity?.display_name || user.email || t("nav.account");
  return (
    <Button variant="ghost" asChild>
      <Link href={href(lang, "/hesap")} aria-label={`${t("nav.account")}: ${name}`}>
        <Avatar identity={identity} src={avatar} size={28} />
        <span className="max-w-36 truncate">{name}</span>
      </Link>
    </Button>
  );
}

/**
 * Üst menü (Aceternity "Resizable Navbar" gibi): sayfanın başında tam genişlikte düz çubuk; aşağı kayınca daralıp
 * ortada yüzen, bulanık zeminli bir çubuğa dönüşür, yukarı dönünce açılır. Sayfa bağlantıları ortada (logo solda,
 * eylemler sağda; üç sütun). Rota / Turlar / Sergiler'de dolgu
 * üzerine gelinen bağlantının arkasına kayar, imleç yokken seçili sayfada durur (seçili sayfa ayrıca kalın ve koyu).
 * Arama (Ctrl+K), dil, görünüm ve hesap sağda. Telefon ve tablette sayfalar alttaki sekme çubuğunda (`BottomNav`);
 * Sergiler, Hakkında ve Bildirim alt bilgide. Hareket azaltmada geçişler anlık.
 */
export function SiteHeader() {
  const { t, lang } = useT();
  const { rest, isActive } = useActive();
  const navRef = useRef<HTMLElement>(null);
  const active = LINKS.findIndex((l) => isActive(l.path));
  const [hovered, setHovered] = useState<number | null>(null);
  const pill = useSlidingBox(navRef, "a", hovered ?? active, [lang]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        data-scrolled={scrolled}
        className={cn(
          // Yükseklik değişmez (sayfa kaymasın); yüzen çubuk yalnız `transform` ile aşağı iner.
          "group/header sticky top-0 z-40 border-b px-3 transition-[background-color,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:px-4",
          scrolled ? "border-transparent" : "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85",
        )}
      >
        <a
          href="#icerik"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
        >
          {t("nav.skip")}
        </a>
        <div
          className={cn(
            "mx-auto flex h-16 items-center gap-2 border px-1 lg:grid lg:grid-cols-[1fr_auto_1fr] transition-[max-width,border-radius,background-color,box-shadow,border-color,transform,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            scrolled
              ? "max-w-4xl translate-y-2 rounded-xl px-3 border-border bg-background/80 shadow-lg shadow-foreground/5 backdrop-blur-md contrast:border-2 contrast:border-foreground contrast:bg-background"
              : "max-w-6xl rounded-none border-transparent",
          )}
        >
          <Link href={href(lang)} className="mr-2 inline-flex min-h-12 min-w-12 items-center justify-center justify-self-start font-heading text-2xl font-extrabold tracking-tight text-link" aria-label={t("nav.home")}>
            {t("site.name")}
          </Link>
          <nav ref={navRef} aria-label={t("nav.main")} className="relative hidden items-center gap-1 justify-self-center lg:flex" onMouseLeave={() => setHovered(null)}>
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-1/2 left-0 h-10 rounded-lg bg-secondary transition-[transform,width,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] contrast:outline-2 contrast:outline-foreground",
                pill ? "opacity-100" : "opacity-0",
              )}
              style={pill ? { width: pill.width, transform: `translate(${pill.left}px, -50%)` } : undefined}
            />
            {LINKS.map((l, i) => (
              <Link
                key={l.path}
                href={href(lang, l.path)}
                aria-current={isActive(l.path) ? "page" : undefined}
                onMouseEnter={() => setHovered(i)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
                className="relative inline-flex min-h-12 items-center rounded-lg px-4 font-heading text-[0.9375rem] font-bold text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:font-extrabold aria-[current=page]:text-foreground"
              >
                {t(l.label)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 justify-self-end">
            <SiteSearch />
            <LangSwitch />
            <AppearanceMenu />
            <div className="hidden lg:block">
              <AccountLink />
            </div>
          </div>
        </div>
      </header>
      <BottomNav rest={rest} />
    </>
  );
}
