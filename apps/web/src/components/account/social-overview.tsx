"use client";

import { ChevronRight, Camera, Footprints, Map as MapIcon, Shield, Stamp as StampIcon, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { FormError } from "@/components/account/form-error";
import { usePassportData } from "@/components/account/passport-content";
import { AchievementIcon, EmptyStamp, sortAchievements, Stamp, StatStrip } from "@/components/account/social-visuals";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/account";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { useIdentity } from "@/lib/identity";
import { getFriendships, getPhotos } from "@/lib/social";
import { useAsync } from "@/lib/use-async";
import { cn } from "@/lib/utils";

const cardLink =
  "group grid gap-4 rounded-xl border bg-card p-4 outline-none hover:border-link focus-visible:ring-3 focus-visible:ring-ring";

/** Hesap sayfası: pasaport kartı (son damgalar + sayılar) ve başarım kartı (son kazanılanlar + en yakın). */
export function SocialOverview({ uid }: { uid: string }) {
  const { t, lang } = useT();
  const passport = usePassportData(uid);
  const data = passport.data;
  if (passport.error) return <FormError text={t(errorKey(passport.error))} />;
  if (!data) return <Skeleton className="h-64 w-full rounded-xl" />;
  const bySlug = new Map(data.works.map((work) => [work.slug, work]));
  const stamps = [...data.visits].filter((visit) => bySlug.has(visit.work_slug)).sort((a, b) => b.first_at.localeCompare(a.first_at));
  const cities = data.stats.cities.filter((city) => city.visited > 0).length;
  const { earned, locked } = sortAchievements(data.list);
  const preview = [...earned.slice(0, 3), ...locked.slice(0, 1)];
  return (
    <div className="grid gap-4">
      <Link
        href={href(lang, "/hesap/pasaport")}
        className={cardLink}
        aria-label={`${t("passport.title")}. ${data.stats.stamps} ${t("stat.stamps")}, ${cities} ${t("stat.cities")}`}
      >
        <CardHead title={t("passport.title")} />
        <div aria-hidden className="flex items-center gap-3">
          {stamps.length
            ? stamps.slice(0, 4).map((visit) => (
                <Stamp key={visit.work_slug} slug={visit.work_slug} typeSlug={bySlug.get(visit.work_slug)!.type_slug} className="size-16" />
              ))
            : [0, 1, 2].map((i) => <EmptyStamp key={i} className="size-16" />)}
          {stamps.length > 4 ? (
            <span className="grid size-12 place-items-center rounded-full bg-muted font-heading font-bold">+{stamps.length - 4}</span>
          ) : null}
        </div>
        <div aria-hidden>
          <StatStrip
            items={[
              { icon: StampIcon, value: String(data.stats.stamps), label: t("stat.stamps") },
              { icon: MapIcon, value: String(cities), label: t("stat.cities") },
              {
                icon: Footprints,
                value: (data.stats.distanceM / 1000).toLocaleString(lang, { maximumFractionDigits: 1 }),
                label: t("stat.km"),
              },
            ]}
          />
        </div>
      </Link>
      <Link
        href={href(lang, "/hesap/basarimlar")}
        className={cardLink}
        aria-label={`${t("ach.title")}. ${t("ach.count", { n: earned.length, total: data.list.length })}`}
      >
        <CardHead title={t("ach.title")} trailing={`${earned.length}/${data.list.length}`} />
        <div aria-hidden className="flex flex-wrap gap-4 pt-1">
          {preview.map((a) => (
            <AchievementIcon key={a.id} achievement={a} size="sm" />
          ))}
        </div>
      </Link>
    </div>
  );
}

function CardHead({ title, trailing }: { title: string; trailing?: string }) {
  return (
    <div aria-hidden className="flex items-center gap-2">
      <h2 className="flex-1 font-heading text-lg font-bold">{title}</h2>
      {trailing ? <span className="text-sm text-muted-foreground">{trailing}</span> : null}
      <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
    </div>
  );
}

/** Topluluk kutucukları: Fotoğraflar, Arkadaşlar (gelen istek sayacı), Gizlilik. */
export function CommunityTiles({ uid }: { uid: string }) {
  const { t, lang } = useT();
  const { identity } = useIdentity();
  const community = useAsync(async () => {
    const [photos, friendships] = await Promise.all([getPhotos({ uid }), getFriendships()]);
    return {
      photos: photos.length,
      incoming: friendships.filter((row) => row.status === "pending" && row.addressee === uid).length,
    };
  }, [uid]);
  const reload = community.reload;
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [reload]);
  const incoming = community.data?.incoming ?? 0;
  const visibility = identity?.visibility ?? "private";
  return (
    <section aria-labelledby="community-heading" className="grid gap-3">
      <h2 id="community-heading" className="font-heading text-lg font-bold">
        {t("social.community")}
      </h2>
      <ul className="grid grid-cols-3 gap-3">
        <Tile href={href(lang, "/hesap/fotograflar")} icon={Camera} label={t("photos.short")} count={community.data?.photos || undefined} />
        <Tile
          href={href(lang, "/hesap/arkadaslar")}
          icon={Users}
          label={t("friends.title")}
          count={incoming || undefined}
          countLabel={incoming ? t("friends.incomingCount", { n: incoming }) : undefined}
          highlight={incoming > 0}
        />
        <Tile href={href(lang, "/hesap/gizlilik")} icon={Shield} label={t("privacy.title")} countLabel={t(`photos.${visibility}`)} />
      </ul>
    </section>
  );
}

function Tile({
  href: to,
  icon: Icon,
  label,
  count,
  countLabel,
  highlight,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  count?: number;
  countLabel?: string;
  highlight?: boolean;
}) {
  return (
    <li>
      <Link
        href={to}
        aria-label={[label, countLabel ?? (count ? String(count) : null)].filter(Boolean).join(", ")}
        className="relative grid min-h-28 justify-items-center content-center gap-2 rounded-xl border bg-card p-3 text-center outline-none hover:border-link focus-visible:ring-3 focus-visible:ring-ring"
      >
        <span
          aria-hidden
          className={cn(
            "grid size-12 place-items-center rounded-full contrast:bg-card contrast:outline-2 contrast:outline-border",
            highlight ? "bg-highlight text-highlight-foreground" : "bg-muted",
          )}
        >
          <Icon className="size-6" />
        </span>
        <span aria-hidden className="text-sm font-semibold">
          {label}
        </span>
        {count ? (
          <span
            aria-hidden
            className={cn(
              "absolute right-2 top-2 grid h-6 min-w-6 place-items-center rounded-full border-2 border-card px-1.5 text-xs font-bold",
              highlight ? "bg-link text-background" : "bg-muted",
            )}
          >
            {count}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
