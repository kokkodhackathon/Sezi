"use client";

import {
  boundsOf,
  coverOf,
  formatDistance,
  loc,
  planTour,
  toneForType,
  walkingSpeed,
  type LngLat,
  type TourStop,
} from "@sezi/shared";
import {
  ArrowLeftIcon,
  ClockIcon,
  ExternalLinkIcon,
  FootprintsIcon,
  MapPinIcon,
  NavigationIcon,
  RouteIcon,
} from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  tourId,
  overlay,
  works,
  initialProfile,
}: {
  tourId: string;
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
    () => planTour(planner, tourId, activeProfile, planner.defaultStart()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tourId, activeProfile, version],
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
        tone: toneForType(w?.type_slug ?? leg.stop.type),
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
    <div className="flex flex-col gap-8">
      <div>
        <Button asChild variant="outline" size="sm">
          <Link href={href(lang, `/turlar${backQuery}`)}>
            <ArrowLeftIcon data-icon="inline-start" aria-hidden />
            {t("tours.backToTours")}
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ProfileSelect value={profileChoice} onChange={handleProfileChange} />
        </CardContent>
      </Card>

      {!plan || plan.stops.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("tours.none")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]">
          {/* Sol: özet ve sıralı durak listesi */}
          <div className="flex flex-col gap-6">
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="num">
                    <MapPinIcon className="size-3.5" aria-hidden />
                    {t("tours.stops", { n: plan.stops.length })}
                  </Badge>
                  <Badge variant="outline" className="num">
                    <RouteIcon className="size-3.5" aria-hidden />
                    {formatDistance(plan.lengthM, lang)}
                  </Badge>
                  <Badge variant="outline" className="num">
                    <ClockIcon className="size-3.5" aria-hidden />
                    {t("tours.statWalk", { n: mins })}
                  </Badge>
                  <Badge variant={plan.stairs === 0 ? "success" : "warning"} className="num">
                    <FootprintsIcon className="size-3.5" aria-hidden />
                    {plan.stairs === 0 ? t("tours.stepFree") : t("tours.stairs", { n: plan.stairs })}
                  </Badge>
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
                      {t("tours.start")}
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>

            <section aria-labelledby="tour-stops-heading" className="flex flex-col gap-4">
              <h2 id="tour-stops-heading" className="text-2xl font-extrabold tracking-tight">
                {t("tours.stopsTitle")}
              </h2>
              <ol className="flex flex-col gap-4">
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
                    <li key={leg.stop.slug}>
                      <Card size="sm">
                        <CardContent className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center">
                          <div className="flex items-center gap-3">
                            <span
                              className="num inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-sm font-extrabold text-primary-foreground"
                              aria-hidden
                            >
                              {leg.index}
                            </span>
                            <WorkThumb
                              photo={cover}
                              typeSlug={typeSlug}
                              alt={loc(cover?.alt, lang)}
                              className="size-20 shrink-0 rounded-lg"
                              sizes="80px"
                            />
                          </div>

                          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <div className="flex flex-wrap items-baseline gap-2">
                              <h3 className="text-lg font-bold text-foreground">
                                <span className="sr-only">{leg.index}. </span>
                                <Link href={workUrl} className="inline-flex min-h-12 items-center hover:underline">
                                  {name}
                                </Link>
                              </h3>
                              {typeName ? (
                                <span className="text-xs font-semibold text-muted-foreground">
                                  · {typeName}
                                </span>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="num">
                                {t("tours.leg", { m: Math.round(leg.stop.legM) })}
                              </span>
                              <Badge
                                variant={leg.stop.legStairs === 0 ? "success" : "warning"}
                                className="num"
                              >
                                {leg.stop.legStairs === 0
                                  ? t("tours.stepFree")
                                  : t("tours.stairs", { n: leg.stop.legStairs })}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <Button asChild variant="secondary" size="sm">
                                <Link href={routeUrl}>
                                  <NavigationIcon data-icon="inline-start" aria-hidden />
                                  {t("tours.openLegInRoute")}
                                </Link>
                              </Button>
                              <Button asChild variant="outline" size="sm">
                                <Link href={workUrl}>
                                  <ExternalLinkIcon data-icon="inline-start" aria-hidden />
                                  {t("tours.openWork")}
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  );
                })}
              </ol>
            </section>
          </div>

          {/* Sağ: Numaralı duraklar ve bacak çizgileriyle harita */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-20">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("tours.mapLabel")}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <SeziMap
                  label={t("tours.mapLabel")}
                  center={planner.center}
                  zoom={15.5}
                  bounds={mapBounds}
                  markers={mapMarkers}
                  lines={mapLines}
                  className="h-[420px] w-full rounded-lg sm:h-[520px]"
                />
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground">{t("route.dataNote")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
