"use client";

import {
  coverOf,
  isAttributed,
  loc,
  planTour,
  walkingSpeed,
  type PlannedTour,
  type Tour,
  type WorkPhoto,
} from "@sezi/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  ProfileSelect,
  resolveProfileChoice,
  resolveUserProfile,
  type ProfileChoice,
} from "@/components/route/profile-select";
import { CardCarousel } from "@/components/card-carousel";
import { Badge } from "@/components/ui/badge";
import { WorkThumb } from "@/components/work-thumb";
import { PhotoSource } from "@/components/works/photo-source";
import type { NavOverlay, WorkListItem } from "@/lib/data";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { planner, usePlannerOverlay } from "@/lib/pilot";
import { useProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";

export function ToursList({
  tours,
  overlay,
  works,
  initialProfile,
}: {
  tours: Tour[];
  overlay: NavOverlay;
  works: WorkListItem[];
  initialProfile?: string;
}) {
  const { t, lang } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const savedProfile = useProfile();
  const version = usePlannerOverlay(overlay);

  const [explicitProfile, setExplicitProfile] = useState<ProfileChoice | null>(() =>
    initialProfile ? resolveProfileChoice(initialProfile, true) : null,
  );

  const profileChoice: ProfileChoice = explicitProfile
    ? resolveProfileChoice(explicitProfile, savedProfile !== null)
    : savedProfile
      ? "benim"
      : "walker";

  const activeProfile = useMemo(
    () => resolveUserProfile(profileChoice, savedProfile, lang),
    [profileChoice, savedProfile, lang],
  );

  const handleProfileChange = (next: ProfileChoice) => {
    setExplicitProfile(next);
    const defaultChoice: ProfileChoice = savedProfile ? "benim" : "walker";
    const qs = next !== defaultChoice ? `?profil=${next}` : "";
    router.replace(`${pathname}${qs}`, { scroll: false });
  };

  const worksBySlug = useMemo(() => {
    const out: Record<string, WorkListItem> = {};
    for (const w of works) out[w.slug] = w;
    return out;
  }, [works]);

  const plans = useMemo(() => {
    const list: { tour: Tour; plan: PlannedTour }[] = [];
    for (const tour of tours) {
      const plan = planTour(planner, tour, activeProfile, planner.defaultStart());
      if (plan && plan.stops.length > 0) list.push({ tour, plan });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tours, activeProfile, version]);

  const covers = useMemo(() => {
    const used = new Set<string>();
    const out: Record<string, { photo?: WorkPhoto; typeSlug: string }> = {};
    for (const { tour, plan: p } of plans) {
      let picked: WorkPhoto | undefined;
      let fallback: WorkPhoto | undefined;
      for (const stop of p.stops) {
        const w = worksBySlug[stop.slug];
        const c = w ? coverOf(w) : undefined;
        if (!c) continue;
        if (!fallback) fallback = c;
        if (!used.has(c.path)) {
          picked = c;
          used.add(c.path);
          break;
        }
      }
      out[tour.slug] = {
        photo: picked ?? fallback,
        typeSlug: p.stops[0]?.type ?? "cami",
      };
    }
    return out;
  }, [plans, worksBySlug]);

  const defaultChoice: ProfileChoice = savedProfile ? "benim" : "walker";
  const profileQuery = profileChoice !== defaultChoice ? `?profil=${profileChoice}` : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <ProfileSelect value={profileChoice} onChange={handleProfileChange} />
      </div>

      {plans.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {t("tours.none")}
        </div>
      ) : (
        <CardCarousel label={t("tours.title")} itemClassName="w-[17rem] sm:w-80">
          {plans.map(({ tour, plan }) => {
            const title = loc(tour.title, lang);
            const cover = covers[tour.slug];
            const mins = Math.max(1, Math.ceil(plan.lengthM / walkingSpeed(activeProfile) / 60));
            const tourHref = href(lang, `/turlar/${tour.slug}${profileQuery}`);
            const hasAttribution = cover?.photo && isAttributed(cover.photo);

            return (
              <div
                key={tour.slug}
                className="group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-xl bg-muted contrast:outline-2 contrast:outline-border"
              >
                <Link
                  href={tourHref}
                  aria-label={title}
                  className="absolute inset-0 z-0 outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background rounded-xl"
                >
                  <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.03]">
                    <WorkThumb
                      photo={cover?.photo}
                      typeSlug={cover?.typeSlug ?? "cami"}
                      alt={loc(cover?.photo?.alt, lang)}
                      className="size-full"
                      sizes="320px"
                    />
                  </div>
                  {/* Yazı fotoğrafın üstünde: alttan koyulaşan örtü okunurluğu sağlar (yüksek kontrastta düz zemin). */}
                  <div className={cn("pointer-events-none relative grid gap-2 bg-gradient-to-t from-foreground/90 via-foreground/70 to-transparent p-5 pt-16 text-background contrast:bg-foreground contrast:bg-none", hasAttribution && "pr-28 sm:pr-32")}>
                    <h2 className="font-heading text-xl font-extrabold leading-tight group-hover:underline">{title}</h2>
                    <p className="num flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span>{t("tours.stops", { n: plan.stops.length })}</span>
                      <span aria-hidden>·</span>
                      <span>{t("tours.statWalk", { n: mins })}</span>
                      {plan.stairs === 0 ? <Badge variant="success">{t("tours.stepFree")}</Badge> : null}
                    </p>
                  </div>
                </Link>
                {hasAttribution ? (
                  <div className="absolute bottom-3 right-3 z-10 sm:bottom-4 sm:right-4">
                    <PhotoSource photo={cover.photo} align="end" side="top" className="max-w-24 sm:max-w-28" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardCarousel>
      )}
    </div>
  );
}
