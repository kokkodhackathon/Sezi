"use client";

import {
  boundsOf,
  formatDistance,
  loc,
  PROFILE_KEYS,
  profileFor,
  toNavPoints,
  walkingSpeed,
  type LngLat,
  type NavPoint,
  type ProfileKey,
} from "@sezi/shared";
import { CircleAlertIcon, ExternalLinkIcon, FlagIcon, InfoIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { SeziMap, type MapLine, type MapMarker } from "@/components/map";
import { CompareTable, type CompareRow } from "@/components/route/compare-table";
import {
  ProfileSelect,
  resolveProfileChoice,
  resolveUserProfile,
  type ProfileChoice,
} from "@/components/route/profile-select";
import { RoutePointCards, StepList } from "@/components/route/step-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAppearance } from "@/lib/appearance";
import type { NavOverlay } from "@/lib/data";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { planner, usePlannerOverlay } from "@/lib/pilot";
import { useProfile } from "@/lib/profile";
import { PROFILE_DRAW_ORDER, profileLine, routeLineColor } from "@/lib/route-style";

export interface InitialRouteParams {
  hedef?: string;
  baslangic?: string;
  lng?: string;
  lat?: string;
  profil?: string;
  karsilastir?: string;
}

const SELECT_CLASS =
  "min-h-12 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function parseInitialCoords(lngStr?: string, latStr?: string): LngLat | null {
  if (!lngStr || !latStr) return null;
  const lng = Number(lngStr);
  const lat = Number(latStr);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}

export function RoutePlanner({
  overlay,
  initial,
}: {
  overlay: NavOverlay;
  initial: InitialRouteParams;
}) {
  const { t, lang } = useT();
  const { contrast } = useAppearance();
  const router = useRouter();
  const pathname = usePathname();
  const savedProfile = useProfile();

  const version = usePlannerOverlay(overlay);

  const pointsById = useMemo(() => {
    const out: Record<string, NavPoint> = {};
    for (const p of toNavPoints(overlay.points)) out[p.id] = p;
    return out;
  }, [overlay.points]);

  // Başlangıç noktaları grafiğe nokta eklendikçe güncellenir.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const starts = useMemo(() => planner.startPoints(), [version]);
  const works = useMemo(
    () =>
      [...planner.pilotWorks]
        .filter((w) => w.workSlug)
        .sort((a, b) => (a.name?.tr ?? "").localeCompare(b.name?.tr ?? "", "tr")),
    [],
  );

  const initialCoords = parseInitialCoords(initial.lng, initial.lat);
  const [startMode, setStartMode] = useState<"point" | "pick">(initialCoords ? "pick" : "point");
  const [startId, setStartId] = useState<string>(initial.baslangic ?? "");
  const [pickedLocation, setPickedLocation] = useState<LngLat | null>(initialCoords);
  const [picking, setPicking] = useState(false);

  const [destSlug, setDestSlug] = useState<string>(() =>
    initial.hedef && planner.hasRouteTo(initial.hedef) ? initial.hedef : "",
  );
  const [explicitProfile, setExplicitProfile] = useState<ProfileChoice | null>(() =>
    initial.profil ? resolveProfileChoice(initial.profil, true) : null,
  );
  const [compare, setCompare] = useState<boolean>(initial.karsilastir === "1");

  const profileChoice: ProfileChoice = explicitProfile
    ? resolveProfileChoice(explicitProfile, savedProfile !== null)
    : savedProfile
      ? "benim"
      : "walker";

  const activeProfile = useMemo(
    () => resolveUserProfile(profileChoice, savedProfile, lang),
    [profileChoice, savedProfile, lang],
  );

  const effectiveStartId = startId || starts[0]?.id || "";

  const syncUrl = (next: {
    startMode: "point" | "pick";
    startId: string;
    pickedLocation: LngLat | null;
    destSlug: string;
    profileChoice: ProfileChoice;
    compare: boolean;
  }) => {
    const params = new URLSearchParams();
    if (next.destSlug) params.set("hedef", next.destSlug);
    if (next.startMode === "pick" && next.pickedLocation) {
      params.set("lng", next.pickedLocation[0].toFixed(5));
      params.set("lat", next.pickedLocation[1].toFixed(5));
    } else if (next.startId && next.startId !== (starts[0]?.id ?? "")) {
      params.set("baslangic", next.startId);
    }
    const defaultChoice: ProfileChoice = savedProfile ? "benim" : "walker";
    if (next.profileChoice !== defaultChoice) {
      params.set("profil", next.profileChoice);
    }
    if (next.compare) {
      params.set("karsilastir", "1");
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const outsidePilot =
    startMode === "pick" && pickedLocation !== null ? !planner.inPilotArea(pickedLocation) : false;

  const fromLocation: LngLat = useMemo(() => {
    if (startMode === "pick" && pickedLocation) return pickedLocation;
    return planner.startLocation(effectiveStartId || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMode, pickedLocation, effectiveStartId, version]);

  const leadIn = startMode === "pick" && pickedLocation !== null;

  const plan = useMemo(() => {
    if (outsidePilot) return null;
    if (destSlug) {
      return planner.planRoute(destSlug, activeProfile, fromLocation, { leadIn });
    }
    return planner.planStroll(activeProfile, fromLocation, { leadIn });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outsidePilot, destSlug, activeProfile, fromLocation, leadIn, version]);

  const stats = useMemo(() => (plan ? planner.routeStats(plan) : null), [plan]);
  const minutes = useMemo(
    () => (stats ? Math.max(1, Math.ceil(stats.lengthM / walkingSpeed(activeProfile) / 60)) : 0),
    [stats, activeProfile],
  );

  const compareRows: CompareRow[] | null = useMemo(() => {
    if (!compare || outsidePilot) return null;
    return PROFILE_KEYS.map((key) => {
      const p = profileFor(key, lang);
      const r = destSlug
        ? planner.planRoute(destSlug, p, fromLocation, { leadIn })
        : planner.planStroll(p, fromLocation, { leadIn });
      const st = r ? planner.routeStats(r) : null;
      const mins = st ? Math.max(1, Math.ceil(st.lengthM / walkingSpeed(p) / 60)) : 0;
      return { key, plan: r, stats: st, minutes: mins };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compare, outsidePilot, destSlug, lang, fromLocation, leadIn, version]);

  const mapLines: MapLine[] = useMemo(() => {
    if (compare && compareRows) {
      return PROFILE_DRAW_ORDER.flatMap((key) => {
        const row = compareRows.find((r) => r.key === key);
        if (!row?.plan) return [];
        const style = profileLine(key, contrast);
        return [
          {
            id: key,
            coords: row.plan.geometry.line,
            color: style.color,
            width: style.width,
            dash: style.dash,
          },
        ];
      });
    }
    if (!plan) return [];
    return [
      {
        id: "route",
        coords: plan.geometry.line,
        color: routeLineColor(contrast),
        width: 6,
      },
    ];
  }, [compare, compareRows, plan, contrast]);

  const mapMarkers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = [];
    const startCoords = startMode === "pick" && pickedLocation ? pickedLocation : plan?.start.location ?? fromLocation;
    list.push({
      id: "start",
      location: startCoords,
      label: t("route.markerStart"),
      emphasis: startMode === "pick" ? "picked" : "start",
    });

    if (plan) {
      list.push({
        id: "dest",
        location: plan.end.location,
        label: loc(plan.end.name, lang) || t("route.markerDest"),
        emphasis: "dest",
      });
      if (!compare) {
        plan.via.pointIds.forEach((id, idx) => {
          const pt = pointsById[id];
          if (pt) {
            list.push({
              id: `via-${id}`,
              location: pt.location,
              label: loc(pt.title, lang),
              number: idx + 1,
            });
          }
        });
      }
    } else if (destSlug) {
      const destNode = planner.landmarkNodeForWork(destSlug);
      if (destNode) {
        list.push({
          id: "dest",
          location: destNode.location,
          label: loc(destNode.name, lang) || t("route.markerDest"),
          emphasis: "dest",
        });
      }
    }
    return list;
  }, [startMode, pickedLocation, plan, fromLocation, t, lang, compare, pointsById, destSlug]);

  const mapBounds = useMemo(() => {
    if (compare && compareRows) {
      const all = compareRows.flatMap((r) => r.plan?.geometry.line ?? []);
      return all.length > 0 ? boundsOf(all) : null;
    }
    if (plan && plan.geometry.line.length > 0) {
      return boundsOf(plan.geometry.line);
    }
    return null;
  }, [compare, compareRows, plan]);

  const handleStartSelect = (val: string) => {
    if (val === "__pick__") {
      setStartMode("pick");
      if (!pickedLocation) {
        setPicking(true);
      } else {
        syncUrl({
          startMode: "pick",
          startId: effectiveStartId,
          pickedLocation,
          destSlug,
          profileChoice,
          compare,
        });
      }
      return;
    }
    const nextId = val === "__default__" ? "" : val;
    setPicking(false);
    setStartMode("point");
    setStartId(nextId);
    syncUrl({
      startMode: "point",
      startId: nextId,
      pickedLocation,
      destSlug,
      profileChoice,
      compare,
    });
  };

  const handleMapClick = (p: LngLat) => {
    setPicking(false);
    setStartMode("pick");
    setPickedLocation(p);
    syncUrl({
      startMode: "pick",
      startId: effectiveStartId,
      pickedLocation: p,
      destSlug,
      profileChoice,
      compare,
    });
  };

  const handleDestChange = (val: string) => {
    const nextDest = val === "__stroll__" ? "" : val;
    setDestSlug(nextDest);
    syncUrl({
      startMode,
      startId: effectiveStartId,
      pickedLocation,
      destSlug: nextDest,
      profileChoice,
      compare,
    });
  };

  const handleProfileChange = (nextChoice: ProfileChoice) => {
    setExplicitProfile(nextChoice);
    syncUrl({
      startMode,
      startId: effectiveStartId,
      pickedLocation,
      destSlug,
      profileChoice: nextChoice,
      compare,
    });
  };

  const handleCompareChange = (nextCompare: boolean) => {
    setCompare(nextCompare);
    syncUrl({
      startMode,
      startId: effectiveStartId,
      pickedLocation,
      destSlug,
      profileChoice,
      compare: nextCompare,
    });
  };

  const startSelectValue =
    startMode === "pick" ? "__pick__" : effectiveStartId || "__default__";

  const selectedPresetKey: ProfileKey | null =
    profileChoice === "benim" ? null : profileChoice;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(340px,2fr)_minmax(0,3fr)]">
      {/* Sol panel: başlangıç, hedef, profil, karşılaştırma, özet ve adım adım talimatlar */}
      <div className="flex flex-col gap-6">
        <Card aria-labelledby="route-form-heading">
          <CardHeader>
            <CardTitle id="route-form-heading">{t("route.formTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="flex flex-col gap-2">
                <Label htmlFor="route-start-select">{t("route.start")}</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    id="route-start-select"
                    value={startSelectValue}
                    onChange={(e) => handleStartSelect(e.target.value)}
                    className={`${SELECT_CLASS} min-w-48 flex-1`}
                  >
                    {starts.length === 0 ? (
                      <option value="__default__">{t("route.startDefault")}</option>
                    ) : (
                      starts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {loc(s.name, lang)}
                        </option>
                      ))
                    )}
                    <option value="__pick__">
                      {pickedLocation
                        ? t("route.startPicked", {
                            lat: pickedLocation[1].toFixed(4),
                            lng: pickedLocation[0].toFixed(4),
                          })
                        : t("route.startPickMode")}
                    </option>
                  </select>
                  <Button
                    type="button"
                    variant={picking || startMode === "pick" ? "default" : "outline"}
                    aria-pressed={picking}
                    onClick={() => setPicking((prev) => !prev)}
                  >
                    <MapPinIcon data-icon="inline-start" aria-hidden />
                    {picking ? t("route.startPicking") : t("route.startPickMode")}
                  </Button>
                </div>
                {picking ? (
                  <p className="text-xs font-medium text-link" aria-live="polite">
                    {t("route.startPickHint")}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="route-dest-select">{t("route.dest")}</Label>
                <select
                  id="route-dest-select"
                  value={destSlug || "__stroll__"}
                  onChange={(e) => handleDestChange(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="__stroll__">{t("route.stroll")}</option>
                  {works.map((w) => (
                    <option key={w.workSlug} value={w.workSlug}>
                      {loc(w.name, lang) || w.workSlug}
                    </option>
                  ))}
                </select>
              </div>

              <ProfileSelect value={profileChoice} onChange={handleProfileChange} />

              <Field orientation="horizontal" className="rounded-lg border bg-muted/30 p-3">
                <Switch
                  id="route-compare-switch"
                  checked={compare}
                  onCheckedChange={handleCompareChange}
                  className="after:-inset-y-4"
                />
                <FieldContent>
                  <FieldLabel htmlFor="route-compare-switch" className="cursor-pointer font-semibold">
                    {t("route.compareToggle")}
                  </FieldLabel>
                  <FieldDescription>{t("route.compareHint")}</FieldDescription>
                </FieldContent>
              </Field>

              {destSlug ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild variant="outline" size="sm">
                    <Link href={href(lang, `/eser/${destSlug}`)}>
                      <ExternalLinkIcon data-icon="inline-start" aria-hidden />
                      {t("route.workPage")}
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={href(lang, `/bildirim?eser=${encodeURIComponent(destSlug)}`)}>
                      <FlagIcon data-icon="inline-start" aria-hidden />
                      {t("route.reportIssue")}
                    </Link>
                  </Button>
                </div>
              ) : null}
            </FieldGroup>
          </CardContent>
        </Card>

        {outsidePilot ? (
          <Alert variant="destructive" role="alert">
            <CircleAlertIcon aria-hidden />
            <AlertTitle>{t("route.startPickMode")}</AlertTitle>
            <AlertDescription>{t("route.outsidePilot")}</AlertDescription>
          </Alert>
        ) : null}

        {!outsidePilot && !plan ? (
          <Alert role="status">
            <InfoIcon aria-hidden />
            <AlertTitle>{t("route.noRouteTitle")}</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <p>{t("route.noRouteBody")}</p>
              <div className="flex flex-wrap gap-2">
                {PROFILE_KEYS.filter((k) => k !== profileChoice).map((k) => (
                  <Button
                    key={k}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleProfileChange(k)}
                  >
                    {t(`route.profile.${k}`)}
                  </Button>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {plan && stats ? (
          <Card aria-labelledby="route-summary-heading">
            <CardHeader>
              <CardTitle id="route-summary-heading">{t("route.summaryTitle")}</CardTitle>
              <CardDescription>{t(`route.profile.${profileChoice === "benim" ? "mine" : profileChoice}`)}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">{t("route.statDistance")}</div>
                <div className="num text-xl font-extrabold">{formatDistance(stats.lengthM, lang)}</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">{t("route.statDuration")}</div>
                <div className="num text-xl font-extrabold">{t("common.minutes", { n: minutes })}</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">{t("route.statStairs")}</div>
                <div className="num text-xl font-extrabold">
                  {stats.stairs === 0 ? t("route.statStepFree") : t("common.stairs", { n: stats.stairs })}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">{t("route.statSurface")}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {stats.busyM > 0 ? (
                    <Badge variant="outline" className="num">
                      {t("route.busyM", { m: stats.busyM })}
                    </Badge>
                  ) : null}
                  {stats.cobbleM > 0 ? (
                    <Badge variant="outline" className="num">
                      {t("route.cobbleM", { m: stats.cobbleM })}
                    </Badge>
                  ) : null}
                  {stats.busyM === 0 && stats.cobbleM === 0 ? (
                    <span className="text-sm font-semibold">{t("route.calmSurface")}</span>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {plan ? <RoutePointCards plan={plan} pointsById={pointsById} /> : null}
      </div>

      {/* Sağ panel: Harita, karşılaştırma tablosu ve adım adım talimatlar */}
      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="p-2 sm:p-3">
            <SeziMap
              label={compare ? t("route.compareMapLabel") : t("route.mapLabel")}
              center={planner.center}
              zoom={15.5}
              bounds={mapBounds}
              markers={mapMarkers}
              lines={mapLines}
              onMapClick={handleMapClick}
              className="h-[420px] w-full rounded-lg sm:h-[480px]"
            />
          </CardContent>
        </Card>

        {compare && compareRows ? (
          <CompareTable
            rows={compareRows}
            selectedKey={selectedPresetKey}
            onSelect={(key) => handleProfileChange(key)}
          />
        ) : null}

        {plan ? <StepList steps={plan.steps} /> : null}

        <p className="text-xs text-muted-foreground">{t("route.dataNote")}</p>
      </div>
    </div>
  );
}
