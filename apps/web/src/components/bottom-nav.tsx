"use client";

import { CompassIcon, MapIcon, RouteIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { useRef, type ReactNode } from "react";

import { Avatar } from "@/components/account/avatar";
import { useAccount } from "@/lib/account";
import { href, type MessageKey } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { useIdentity } from "@/lib/identity";
import { useSlidingBox } from "@/lib/use-sliding-box";
import { cn } from "@/lib/utils";

/**
 * Telefon ve tablette alt sekme çubuğu (uygulamadaki gibi): Keşfet, Rota, Turlar, Hesap. Başparmakla erişilir;
 * seçili sekmenin dolgusu kayar ve sekme kalın yazılır (renk tek başına değil). Masaüstünde üst menü yeterli.
 * Hesap sekmesi girişsizken giriş sayfasına, girişliyken hesap sayfasına gider (avatar gösterilir).
 */
export function BottomNav({ rest }: { rest: string }) {
  const { t, lang } = useT();
  const { user } = useAccount();
  const { identity, avatar } = useIdentity();
  const ref = useRef<HTMLDivElement>(null);

  const tabs: { path: string; match: string; label: MessageKey; icon: ReactNode }[] = [
    { path: "", match: "", label: "nav.explore", icon: <CompassIcon className="size-5" aria-hidden /> },
    { path: "/rota", match: "/rota", label: "nav.route", icon: <RouteIcon className="size-5" aria-hidden /> },
    { path: "/turlar", match: "/turlar", label: "nav.tours", icon: <MapIcon className="size-5" aria-hidden /> },
    {
      path: user ? "/hesap" : "/hesap/giris",
      match: "/hesap",
      label: user ? "nav.account" : "nav.signIn",
      icon: user ? <Avatar identity={identity} src={avatar} size={22} /> : <UserRoundIcon className="size-5" aria-hidden />,
    },
  ];
  const active = tabs.findIndex((tab) => (tab.match === "" ? rest === "" || rest === "/" : rest === tab.match || rest.startsWith(`${tab.match}/`)));
  const box = useSlidingBox(ref, "a", active, [lang]);

  return (
    <nav
      aria-label={t("nav.main")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:hidden"
    >
      <div ref={ref} className="relative mx-auto flex max-w-lg gap-1 px-2 py-1.5">
        {box ? (
          <span
            aria-hidden
            className="absolute inset-y-1.5 left-0 rounded-lg bg-secondary transition-[transform,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] contrast:outline-2 contrast:outline-foreground"
            style={{ width: box.width, transform: `translateX(${box.left}px)` }}
          />
        ) : null}
        {tabs.map((tab, i) => (
          <Link
            key={tab.match || "home"}
            href={href(lang, tab.path)}
            aria-current={i === active ? "page" : undefined}
            className={cn(
              "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              i === active ? "font-bold text-foreground" : "font-semibold text-muted-foreground",
            )}
          >
            {tab.icon}
            {t(tab.label)}
          </Link>
        ))}
      </div>
    </nav>
  );
}
