"use client";

import {
  coverOf,
  loc,
  planTour,
  TOURS,
  walkingSpeed,
  type PlannedTour,
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
import { Badge } from "@/components/ui/badge";
import { WorkThumb } from "@/components/work-thumb";
import type { NavOverlay, WorkListItem } from "@/lib/data";
import { href, type MessageKey } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { planner, usePlannerOverlay } from "@/lib/pilot";
import { useProfile } from "@/lib/profile";

export const TOUR_TEXT_KEYS: Record<string, { title: MessageKey; body: MessageKey }> = {
  tum: { title: "tours.tum.title", body: "tours.tum.body" },
  hanlar: { title: "tours.hanlar.title", body: "tours.hanlar.body" },
  camiler: { title: "tours.camiler.title", body: "tours.camiler.body" },
  su: { title: "tours.su.title", body: "tours.su.body" },
};

export function ToursList({
  overlay,
  works,
  initialProfile,
}: {
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
    const list: PlannedTour[] = [];
    for (const def of TOURS) {
      const planned = planTour(planner, def.id, activeProfile, planner.defaultStart());
      if (planned && planned.stops.length > 0) {
        list.push(planned);
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile, version]);

  const covers = useMemo(() => {
    const used = new Set<string>();
    const out: Record<string, { photo?: WorkPhoto; typeSlug: string }> = {};
    for (const p of plans) {
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
      out[p.id] = {
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
        <div className="grid gap-5 sm:grid-cols-2">
          {plans.map((plan) => {
            const keys = TOUR_TEXT_KEYS[plan.id];
            const title = keys ? t(keys.title) : plan.id;
            const cover = covers[plan.id];
            const mins = Math.max(1, Math.ceil(plan.lengthM / walkingSpeed(activeProfile) / 60));
            const tourHref = href(lang, `/turlar/${plan.id}${profileQuery}`);

            return (
              <Link
                key={plan.id}
                href={tourHref}
                className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/50"
              >
                <WorkThumb
                  photo={cover?.photo}
                  typeSlug={cover?.typeSlug ?? "cami"}
                  alt={loc(cover?.photo?.alt, lang)}
                  className="aspect-[16/9] w-full"
                  sizes="(min-width: 640px) 50vw, 100vw"
                />
                <div className="flex flex-1 flex-col justify-between gap-2 p-4">
                  <h2 className="font-heading text-lg font-bold text-foreground group-hover:underline">
                    {title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground num">
                    <Badge variant="secondary">
                      {t("tours.stops", { n: plan.stops.length })}
                    </Badge>
                    <span aria-hidden>·</span>
                    <span>{t("tours.statWalk", { n: mins })}</span>
                    {plan.stairs === 0 ? (
                      <>
                        <span aria-hidden>·</span>
                        <Badge variant="success">{t("tours.stepFree")}</Badge>
                      </>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
