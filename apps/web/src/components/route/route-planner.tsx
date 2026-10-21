"use client";

import {
  boundsOf,
  formatDistance,
  loc,
  PROFILE_KEYS,
  profileFor,
  toNavPoints,
  toneForType,
  walkingSpeed,
  type LngLat,
  type NavPoint,
  type PlannedRoute,
  type ProfileKey,
} from "@sezi/shared";
import { CircleDotIcon, FlagIcon, LandmarkIcon, MapPinIcon, ShuffleIcon, CrosshairIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";

import { SeziMap, type MapLine, type MapMarker } from "@/components/map";
import { PlacePicker, type PlaceOption } from "@/components/route/place-picker";
import { PROFILE_ICON, ProfileSelect, resolveProfileChoice, resolveUserProfile, type ProfileChoice } from "@/components/route/profile-select";
import { RollingText } from "@/components/rolling-text";
import { StepList, ViaList } from "@/components/route/step-list";
import { Button } from "@/components/ui/button";
import { useAppearance } from "@/lib/appearance";
import type { NavOverlay } from "@/lib/data";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { planner, usePlannerOverlay } from "@/lib/pilot";
import { useProfile } from "@/lib/profile";
import { PROFILE_DRAW_ORDER, profileLine, routeLineColor } from "@/lib/route-style";
import { cn } from "@/lib/utils";

export interface InitialRouteParams {
  hedef?: string;
  baslangic?: string;
  lng?: string;
  lat?: string;
  profil?: string;
  karsilastir?: string;
}

const PICK = "__pick__";
const STROLL = "__stroll__";

function parseCoords(lngStr?: string, latStr?: string): LngLat | null {
  if (!lngStr || !latStr) return null;
  const lng = Number(lngStr);
  const lat = Number(latStr);
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
}

interface Summary {
  plan: PlannedRoute;
  stats: { lengthM: number; stairs: number; busyM: number; cobbleM: number };
  minutes: number;
}

function summarize(plan: PlannedRoute | null, speed: number): Summary | null {
  if (!plan) return null;
  const stats = planner.routeStats(plan);
  return { plan, stats, minutes: Math.max(1, Math.ceil(stats.lengthM / speed / 60)) };
}

/** Profil çizgisinin küçük örneği (karşılaştırma listesinde haritadaki çizgiyle eşleşir). */
function LineSwatch({ k, contrast }: { k: ProfileKey; contrast: boolean }) {
  const s = profileLine(k, contrast);
  return (
    <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden className="shrink-0">
      <line
        x1="2"
        y1="6"
        x2="26"
        y2="6"
        stroke={s.color}
        strokeWidth={Math.min(s.width, 8)}
        strokeDasharray={s.dash ? s.dash.map((d) => d * Math.min(s.width, 8)).join(" ") : undefined}
        strokeLinecap={s.dash ? "butt" : "round"}
      />
    </svg>
  );
}

/**
 * Rota: harita uygulamalarındaki gibi tam ekran harita ve üstünde yüzen panel (masaüstünde solda, telefonda altta).
 * Panel: nereden / nereye, profil, sonuç (süre, mesafe, basamak), yol tarifi. Haritada esere dokunmak hedefi seçer.
 */
export function RoutePlanner({ overlay, initial }: { overlay: NavOverlay; initial: InitialRouteParams }) {
  const { t, lang } = useT();
  const { contrast } = useAppearance();
  const router = useRouter();
  const pathname = usePathname();
  const savedProfile = useProfile();
  const version = usePlannerOverlay(overlay);
  const wide = useSyncExternalStore(
    (l) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", l);
      return () => mq.removeEventListener("change", l);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true,
  );

  const pointsById = useMemo(() => {
    const out: Record<string, NavPoint> = {};
    for (const p of toNavPoints(overlay.points)) out[p.id] = p;
    return out;
  }, [overlay.points]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const starts = useMemo(() => planner.startPoints(), [version]);
  const works = useMemo(
    () => planner.pilotWorks.filter((w) => w.workSlug).sort((a, b) => loc(a.name, lang).localeCompare(loc(b.name, lang), "tr")),
    [lang],
  );

  const initialCoords = parseCoords(initial.lng, initial.lat);
  const [startId, setStartId] = useState<string>(initialCoords ? PICK : (initial.baslangic ?? ""));
  const [picked, setPicked] = useState<LngLat | null>(initialCoords);
  const [picking, setPicking] = useState(false);
  const [destSlug, setDestSlug] = useState(() => (initial.hedef && planner.hasRouteTo(initial.hedef) ? initial.hedef : ""));
  const [explicitProfile, setExplicitProfile] = useState<ProfileChoice | null>(() =>
    initial.profil ? resolveProfileChoice(initial.profil, true) : null,
  );
  const [compare, setCompare] = useState(initial.karsilastir === "1");

  const profileChoice: ProfileChoice = explicitProfile
    ? resolveProfileChoice(explicitProfile, savedProfile !== null)
    : savedProfile
      ? "benim"
      : "walker";
  const profile = useMemo(() => resolveUserProfile(profileChoice, savedProfile, lang), [profileChoice, savedProfile, lang]);

  const usePicked = startId === PICK && picked !== null;
  const effectiveStart = startId === PICK ? "" : startId || starts[0]?.id || "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const from: LngLat = useMemo(() => (usePicked && picked ? picked : planner.startLocation(effectiveStart || undefined)), [usePicked, picked, effectiveStart, version]);
  const outside = usePicked && picked !== null && !planner.inPilotArea(picked);

  const planFor = (p: typeof profile) =>
    outside ? null : destSlug ? planner.planRoute(destSlug, p, from, { leadIn: usePicked }) : planner.planStroll(p, from, { leadIn: usePicked });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const current = useMemo(() => summarize(planFor(profile), walkingSpeed(profile)), [profile, destSlug, from, usePicked, outside, version]);
  const rows = useMemo(
    () =>
      compare
        ? PROFILE_KEYS.map((k) => {
            const p = profileFor(k, lang);
            return { key: k, summary: summarize(planFor(p), walkingSpeed(p)) };
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compare, lang, destSlug, from, usePicked, outside, version],
  );

  const sync = (next: Partial<{ startId: string; picked: LngLat | null; destSlug: string; profile: ProfileChoice; compare: boolean }>) => {
    const s = { startId, picked, destSlug, profile: profileChoice, compare, ...next };
    const q = new URLSearchParams();
    if (s.destSlug) q.set("hedef", s.destSlug);
    if (s.startId === PICK && s.picked) {
      q.set("lng", s.picked[0].toFixed(5));
      q.set("lat", s.picked[1].toFixed(5));
    } else if (s.startId && s.startId !== starts[0]?.id) q.set("baslangic", s.startId);
    if (s.profile !== (savedProfile ? "benim" : "walker")) q.set("profil", s.profile);
    if (s.compare) q.set("karsilastir", "1");
    const qs = q.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const chooseStart = (v: string) => {
    if (v === PICK) {
      setPicking(true);
      return;
    }
    setPicking(false);
    setStartId(v);
    sync({ startId: v });
  };
  const chooseDest = (v: string) => {
    const slug = v === STROLL ? "" : v;
    setDestSlug(slug);
    sync({ destSlug: slug });
  };
  const chooseProfile = (p: ProfileChoice) => {
    setExplicitProfile(p);
    sync({ profile: p });
  };
  const toggleCompare = () => {
    setCompare(!compare);
    sync({ compare: !compare });
  };
  const onMapClick = (p: LngLat) => {
    if (!picking) return;
    setPicking(false);
    setPicked(p);
    setStartId(PICK);
    sync({ startId: PICK, picked: p });
  };

  const startOptions: PlaceOption[] = [
    ...starts.map((s) => ({ value: s.id, label: loc(s.name, lang), icon: <CircleDotIcon aria-hidden /> })),
    { value: PICK, label: t("route.fromPick"), icon: <CrosshairIcon aria-hidden /> },
  ];
  const destOptions: PlaceOption[] = [
    { value: STROLL, label: t("route.stroll"), icon: <ShuffleIcon aria-hidden /> },
    ...works.map((w) => ({ value: w.workSlug ?? "", label: loc(w.name, lang), icon: <LandmarkIcon aria-hidden /> })),
  ];
  const startLabel = usePicked ? t("route.picked") : (startOptions.find((o) => o.value === effectiveStart)?.label ?? t("route.markerStart"));
  const destLabel = destSlug ? (destOptions.find((o) => o.value === destSlug)?.label ?? destSlug) : t("route.stroll");

  // ---------- Harita ----------
  const lines: MapLine[] = useMemo(() => {
    if (rows) {
      return PROFILE_DRAW_ORDER.flatMap((k) => {
        const r = rows.find((x) => x.key === k)?.summary;
        if (!r) return [];
        const s = profileLine(k, contrast);
        return [{ id: k, coords: r.plan.geometry.line, color: s.color, width: s.width, dash: s.dash }];
      });
    }
    return current ? [{ id: "route", coords: current.plan.geometry.line, color: routeLineColor(contrast), width: 6 }] : [];
  }, [rows, current, contrast]);

  const markers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = works
      .filter((w) => w.workSlug !== destSlug)
      .map((w) => ({ id: `work:${w.workSlug}`, location: w.location, label: loc(w.name, lang), tone: toneForType(w.workType ?? "") }));
    list.push({ id: "start", location: usePicked && picked ? picked : (current?.plan.start.location ?? from), label: t("route.markerStart"), emphasis: usePicked ? "picked" : "start" });
    const dest = current?.plan.end ?? (destSlug ? planner.landmarkNodeForWork(destSlug) : undefined);
    if (dest && (destSlug || current)) list.push({ id: "dest", location: dest.location, label: loc(dest.name, lang) || t("route.markerDest"), emphasis: "dest" });
    if (current && !rows) {
      current.plan.via.pointIds.forEach((id, i) => {
        const p = pointsById[id];
        if (p) list.push({ id: `via:${id}`, location: p.location, label: loc(p.title, lang), number: i + 1 });
      });
    }
    return list;
  }, [works, destSlug, usePicked, picked, current, from, rows, pointsById, lang, t]);

  const bounds = useMemo(() => {
    const all = rows ? rows.flatMap((r) => r.summary?.plan.geometry.line ?? []) : (current?.plan.geometry.line ?? []);
    return all.length ? boundsOf(all) : null;
  }, [rows, current]);

  const shortest = rows ? Math.min(...rows.flatMap((r) => (r.summary ? [r.summary.stats.lengthM] : []))) : 0;
  const profileName = (k: ProfileChoice) => t(k === "benim" ? "route.profile.mine" : `route.profile.${k}`);

  return (
    <div className="relative flex flex-col lg:block lg:h-[calc(100dvh-4rem)] lg:min-h-[600px]">
      {/* Harita: masaüstünde tüm alan, telefonda üstte */}
      <div className="relative h-[46dvh] min-h-72 lg:absolute lg:inset-0 lg:h-auto">
        <SeziMap
          label={t("route.mapLabel")}
          center={planner.center}
          zoom={15.5}
          bounds={bounds}
          markers={markers}
          lines={lines}
          onMarkerClick={(id) => {
            if (id.startsWith("work:")) chooseDest(id.slice(5));
          }}
          onMapClick={picking ? onMapClick : undefined}
          fitPadding={wide ? { top: 64, right: 64, bottom: 64, left: 420 } : { top: 40, right: 40, bottom: 56, left: 40 }}
          className="h-full w-full rounded-none border-0"
        />
        {picking ? (
          <div role="status" className="absolute inset-x-3 top-3 z-10 flex items-center gap-2 rounded-lg bg-card py-1.5 pr-1.5 pl-4 text-sm font-semibold shadow-lg lg:left-[412px] lg:right-auto">
            <CrosshairIcon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{t("route.pickHint")}</span>
            <Button size="icon-sm" variant="ghost" aria-label={t("route.cancel")} onClick={() => setPicking(false)}>
              <XIcon aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>

      {/* Panel */}
      <section
        aria-labelledby="route-title"
        className="relative z-10 -mt-5 flex flex-col rounded-t-xl bg-card lg:absolute lg:top-4 lg:bottom-4 lg:left-4 lg:mt-0 lg:w-[380px] lg:overflow-hidden lg:rounded-xl lg:shadow-xl contrast:outline-2 contrast:outline-border"
      >
        <div className="grid gap-3 border-b p-4">
          <h1 id="route-title" className="flex items-baseline justify-between gap-2 text-lg font-extrabold">
            {t("route.title")}
            <span className="truncate font-sans text-xs font-normal text-muted-foreground">{t("route.area")}</span>
          </h1>
          <div className="grid gap-1.5">
            <PlacePicker
              id="route-from"
              label={t("route.from")}
              marker={<CircleDotIcon className="size-4 text-link" />}
              value={usePicked ? PICK : effectiveStart}
              display={startLabel}
              options={startOptions}
              onChange={chooseStart}
            />
            <PlacePicker
              id="route-to"
              label={t("route.to")}
              marker={<MapPinIcon className="size-5 text-accent-text" />}
              value={destSlug || STROLL}
              display={destLabel}
              options={destOptions}
              onChange={chooseDest}
            />
          </div>
          <ProfileSelect value={profileChoice} onChange={chooseProfile} />
        </div>

        <div className="grid content-start gap-4 p-4 lg:flex-1 lg:overflow-y-auto">
          {outside ? (
            <p role="alert" className="rounded-lg bg-warning p-3 text-sm font-semibold text-warning-foreground">
              {t("route.outsidePilot")}
            </p>
          ) : !current ? (
            <p role="status" className="rounded-lg bg-secondary p-3 text-sm">
              {t("route.noRoute")}
            </p>
          ) : (
            <div aria-live="polite" className="grid gap-2">
              <p className="flex items-baseline gap-3">
                <RollingText text={t("common.minutes", { n: current.minutes })} className="font-heading text-3xl font-extrabold" />
                <RollingText text={formatDistance(current.stats.lengthM, lang)} className="text-muted-foreground" />
              </p>
              <ul className="flex flex-wrap gap-1.5 text-xs font-semibold">
                <li className={cn("rounded-lg px-2.5 py-1", current.stats.stairs === 0 ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground")}>
                  {current.stats.stairs === 0 ? t("route.stepFree") : t("route.stairs", { n: current.stats.stairs })}
                </li>
                {current.stats.busyM > 0 ? <li className="rounded-lg bg-secondary px-2.5 py-1">{t("route.busyM", { m: current.stats.busyM })}</li> : null}
                {current.stats.cobbleM > 0 ? <li className="rounded-lg bg-secondary px-2.5 py-1">{t("route.cobbleM", { m: current.stats.cobbleM })}</li> : null}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button variant={compare ? "default" : "outline"} size="sm" aria-pressed={compare} onClick={toggleCompare}>
              {t("route.compare")}
            </Button>
            {destSlug ? (
              <>
                <Button variant="ghost" size="icon" asChild>
                  <Link href={href(lang, `/eser/${destSlug}`)} aria-label={t("route.workPage")} title={t("route.workPage")}>
                    <LandmarkIcon aria-hidden />
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" asChild>
                  <Link href={href(lang, `/bildirim?eser=${encodeURIComponent(destSlug)}`)} aria-label={t("route.report")} title={t("route.report")}>
                    <FlagIcon aria-hidden />
                  </Link>
                </Button>
              </>
            ) : null}
          </div>

          {rows ? (
            <ul aria-label={t("route.compare")} className="grid gap-1">
              {rows.map(({ key, summary }) => {
                const on = profileChoice === key;
                const same = summary ? rows.find((o) => o.key !== key && PROFILE_KEYS.indexOf(o.key) < PROFILE_KEYS.indexOf(key) && o.summary?.plan.geometry.line.length === summary.plan.geometry.line.length && o.summary.stats.lengthM === summary.stats.lengthM) : undefined;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => chooseProfile(key)}
                      className={cn("flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left transition-colors hover:bg-muted", on && "bg-secondary ring-2 ring-primary")}
                    >
                      <LineSwatch k={key} contrast={contrast} />
                      <span className="text-muted-foreground">{PROFILE_ICON[key]}</span>
                      <span className="grid flex-1 leading-tight">
                        <span className={cn("text-sm", on && "font-bold")}>{profileName(key)}</span>
                        {same ? <span className="text-xs text-muted-foreground">{t("route.sameAs", { profile: profileName(same.key) })}</span> : null}
                      </span>
                      {summary ? (
                        <span className="num grid text-right text-sm leading-tight">
                          <span className="font-bold">{t("common.minutes", { n: summary.minutes })}</span>
                          <span className="text-xs text-muted-foreground">
                            {summary.stats.lengthM > shortest ? `+${Math.round(summary.stats.lengthM - shortest)} m` : formatDistance(summary.stats.lengthM, lang)}
                            {summary.stats.stairs > 0 ? `, ${t("common.stairs", { n: summary.stats.stairs })}` : ""}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t("route.noRoute")}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {current ? (
            <>
              <ViaList plan={current.plan} pointsById={pointsById} />
              <section aria-labelledby="route-steps">
                <h2 id="route-steps" className="font-heading text-sm font-bold">
                  {t("route.steps")}
                </h2>
                <StepList steps={current.plan.steps} />
              </section>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
