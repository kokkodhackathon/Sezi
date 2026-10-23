"use client";

import {
  boundsOf,
  coverOf,
  formatDistance,
  loc,
  planTour,
  walkingSpeed,
  type LngLat,
  type Tour,
  type TourStop,
} from "@sezi/shared";
import { ArrowLeftIcon, MapPinIcon, NavigationIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { SeziMap, type MapLine, type MapMarker } from "@/components/map";
import {
  ProfileSelect,
  resolveProfileChoice,
  resolveUserProfile,
  type ProfileChoice,
} from "@/components/route/profile-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkThumb } from "@/components/work-thumb";
import { useAppearance } from "@/lib/appearance";
import type { NavOverlay, WorkListItem } from "@/lib/data";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { planner, usePlannerOverlay } from "@/lib/pilot";
import { useProfile } from "@/lib/profile";
import { routeLineColor } from "@/lib/route-style";

interface ComputedLeg {
  stop: TourStop;
  index: number;
  fromLocation: LngLat;
  nodeLocation: LngLat;
  coords: LngLat[];
}

export function TourDetail({
  tour,
  overlay,
  works,
  initialProfile,
}: {
  tour: Tour;
  overlay: NavOverlay;
  works: WorkListItem[];
  initialProfile?: string;
}) {
  const { t, lang } = useT();
  const { contrast } = useAppearance();
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

  const plan = useMemo(
    () => planTour(planner, tour, activeProfile, planner.defaultStart()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tour, activeProfile, version],
  );

  const legs: ComputedLeg[] = useMemo(() => {
    if (!plan) return [];
    const out: ComputedLeg[] = [];
    let prevLocation: LngLat = planner.defaultStart();
    plan.stops.forEach((stop, i) => {
      const legPlan = planner.planRoute(stop.slug, activeProfile, prevLocation, { via: false });
      const node = planner.landmarkNodeForWork(stop.slug);
      const nodeLocation = node?.location ?? legPlan?.end.location ?? prevLocation;
      out.push({
        stop,
        index: i + 1,
        fromLocation: prevLocation,
        nodeLocation,
        coords: legPlan?.geometry.line ?? [prevLocation, nodeLocation],
      });
      prevLocation = nodeLocation;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, activeProfile, version]);

  const allCoords: LngLat[] = useMemo(() => legs.flatMap((l) => l.coords), [legs]);

  const mapLines: MapLine[] = useMemo(() => {
    if (allCoords.length === 0) return [];
    return [
      {
        id: "tour-route",
        coords: allCoords,
        color: routeLineColor(contrast),
        width: 5,
      },
    ];
  }, [allCoords, contrast]);

  const mapMarkers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = [
      {
        id: "start",
        location: planner.defaultStart(),
        label: t("route.markerStart"),
        emphasis: "start",
      },
    ];
    for (const leg of legs) {
      const w = worksBySlug[leg.stop.slug];
      const name = loc(w?.name ?? leg.stop.name, lang) || leg.stop.slug;
      list.push({
        id: leg.stop.slug,
        location: leg.nodeLocation,
        label: name,
        number: leg.index,
        typeSlug: w?.type_slug ?? leg.stop.type,
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legs, worksBySlug, lang, t, version]);

  const mapBounds = useMemo(
    () => (allCoords.length > 0 ? boundsOf(allCoords) : null),
    [allCoords],
  );

  const defaultChoice: ProfileChoice = savedProfile ? "benim" : "walker";
  const profileSuffix = profileChoice !== defaultChoice ? `&profil=${profileChoice}` : "";
  const backQuery = profileChoice !== defaultChoice ? `?profil=${profileChoice}` : "";

  const mins = plan
    ? Math.max(1, Math.ceil(plan.lengthM / walkingSpeed(activeProfile) / 60))
    : 0;
  const firstStop = plan?.stops[0];

  return (
    <div className="flex flex-col gap-6">
      {/* Üst çubuk: geri dön & profil seçici */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={href(lang, `/turlar${backQuery}`)}>
            <ArrowLeftIcon data-icon="inline-start" aria-hidden />
            {t("tours.backToTours")}
          </Link>
        </Button>
        <ProfileSelect value={profileChoice} onChange={handleProfileChange} />
      </div>

      {!plan || plan.stops.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {t("tours.none")}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* 1. Harita tepede */}
          <section aria-label={t("tours.mapLabel")}>
            <SeziMap
              label={t("tours.mapLabel")}
              center={planner.center}
              zoom={15.5}
              bounds={mapBounds}
              markers={mapMarkers}
              lines={mapLines}
              className="h-[360px] w-full rounded-lg border sm:h-[440px]"
            />
          </section>

          {/* 2. Rota özeti tek satır */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div className="flex flex-wrap items-center gap-2 num text-xs text-muted-foreground">
              <Badge variant="secondary">
                <MapPinIcon className="size-3" aria-hidden />
                {t("tours.stops", { n: plan.stops.length })}
              </Badge>
              <span>·</span>
              <span>{formatDistance(plan.lengthM, lang)}</span>
              <span>·</span>
              <span>{t("tours.statWalk", { n: mins })}</span>
              {plan.stairs === 0 ? (
                <>
                  <span aria-hidden>·</span>
                  <Badge variant="success">{t("tours.stepFree")}</Badge>
                </>
              ) : (
                <>
                  <span aria-hidden>·</span>
                  <Badge variant="warning">{t("tours.stairs", { n: plan.stairs })}</Badge>
                </>
              )}
            </div>
            {firstStop ? (
              <Button asChild size="sm">
                <Link
                  href={href(
                    lang,
                    `/rota?hedef=${encodeURIComponent(firstStop.slug)}${profileSuffix}`,
                  )}
                >
                  <NavigationIcon data-icon="inline-start" aria-hidden />
                  <span>{t("tours.start")}</span>
                </Link>
              </Button>
            ) : null}
          </div>

          {/* 3. Numaralı durak listesi */}
          <section aria-label={t("tours.stopsTitle")} className="flex flex-col gap-3">
            <h2 className="font-heading text-lg font-bold text-foreground">
              {t("tours.stopsTitle")}
            </h2>
            <ol className="flex flex-col gap-3">
              {legs.map((leg) => {
                const w = worksBySlug[leg.stop.slug];
                const cover = w ? coverOf(w) : undefined;
                const typeSlug = w?.type_slug ?? leg.stop.type;
                const typeName = w ? loc(w.type_name, lang) : leg.stop.type;
                const name = loc(w?.name ?? leg.stop.name, lang) || leg.stop.slug;
                const workUrl = href(lang, `/eser/${leg.stop.slug}`);
                const routeUrl = href(
                  lang,
                  `/rota?hedef=${encodeURIComponent(leg.stop.slug)}&lng=${leg.fromLocation[0].toFixed(5)}&lat=${leg.fromLocation[1].toFixed(5)}${profileSuffix}`,
                );

                return (
                  <li
                    key={leg.stop.slug}
                    className="flex flex-col justify-between gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="num inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-xs font-bold text-primary-foreground"
                        aria-hidden
                      >
                        {leg.index}
                      </span>
                      <WorkThumb
                        photo={cover}
                        typeSlug={typeSlug}
                        alt={loc(cover?.alt, lang)}
                        className="size-14 shrink-0 rounded-lg"
                        sizes="60px"
                        sourceTag
                      />
                      <div className="grid gap-0.5">
                        <Link
                          href={workUrl}
                          className="font-heading text-base font-bold text-foreground hover:underline"
                        >
                          {name}
                        </Link>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground num">
                          <span>{typeName}</span>
                          <span aria-hidden>·</span>
                          <span>{t("tours.leg", { m: Math.round(leg.stop.legM) })}</span>
                          {leg.stop.legStairs === 0 ? (
                            <>
                              <span aria-hidden>·</span>
                              <Badge variant="success" className="text-[10px] py-0">
                                {t("tours.stepFree")}
                              </Badge>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button asChild variant="outline" size="sm">
                        <Link href={routeUrl}>
                          <NavigationIcon data-icon="inline-start" aria-hidden />
                          <span>{t("tours.openLegInRoute")}</span>
                        </Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}
