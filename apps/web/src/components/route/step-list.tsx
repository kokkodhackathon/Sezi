"use client";

import { arrivalText, excerpt, formatDistance, loc, type GuidanceStep, type Hazard, type NavPoint, type PlannedRoute, type Turn } from "@sezi/shared";
import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CircleAlert,
  CornerUpLeft,
  CornerUpRight,
  Footprints,
  MapPinCheckInside,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import type { ReactNode } from "react";

import { useT } from "@/lib/i18n-client";

function TurnIcon({ turn }: { turn: Turn }) {
  const cls = "size-5 shrink-0";
  switch (turn) {
    case "straight":
      return <ArrowUp className={cls} aria-hidden />;
    case "slight_left":
      return <ArrowUpLeft className={cls} aria-hidden />;
    case "left":
      return <CornerUpLeft className={cls} aria-hidden />;
    case "slight_right":
      return <ArrowUpRight className={cls} aria-hidden />;
    case "right":
      return <CornerUpRight className={cls} aria-hidden />;
    case "back":
      return <Undo2 className={cls} aria-hidden />;
  }
}

function HazardIcon({ hazard }: { hazard: Hazard }) {
  switch (hazard) {
    case "stairs":
      return <Footprints className="size-3.5 shrink-0" aria-hidden />;
    case "cobble":
      return <CircleAlert className="size-3.5 shrink-0" aria-hidden />;
    case "traffic":
      return <TriangleAlert className="size-3.5 shrink-0" aria-hidden />;
  }
}

/** Yol tarifi: harita uygulamalarındaki gibi dönüş simgesi, cümle ve mesafe; uyarı varsa simge + metin. */
export function StepList({ steps }: { steps: GuidanceStep[] }) {
  const { t, lang } = useT();
  return (
    <ol className="grid">
      {steps.map((step, i) => (
        <li key={`${step.nodeId}-${i}`} className="flex items-start gap-3 border-b py-3 last:border-b-0">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
            <TurnIcon turn={step.turn} />
          </span>
          <span className="grid min-w-0 flex-1 gap-1">
            <span className="text-[0.9375rem] leading-snug">{step.text}</span>
            <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="num">{formatDistance(step.atM, lang)}</span>
              {step.hazard ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-warning px-2 py-0.5 font-semibold text-warning-foreground">
                  <HazardIcon hazard={step.hazard} />
                  {t(`route.hazard.${step.hazard}`)}
                </span>
              ) : null}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Yol üstündeki anlatım noktaları ve varış bilgisi; seçilen satır haritadaki geliş bacağını vurgular. */
export function ViaList({ plan, pointsById, workPoints, activeLeg, onSelectLeg }: { plan: PlannedRoute; pointsById: Record<string, NavPoint>; workPoints: readonly NavPoint[]; activeLeg: number | null; onSelectLeg: (leg: number | null) => void }) {
  const { t, lang } = useT();
  // Yol üstündeki eser varış noktası da aynı sırayla: eserin özeti/tarihçesi varsa o (anlatım noktası kendi metniyle kalır).
  const items = plan.via.pointIds.flatMap((id, idx) => {
    const raw = pointsById[id];
    if (!raw) return [];
    const point = raw.roles.includes("story") ? raw : (arrivalText(raw.workSlug, workPoints, raw) ?? raw);
    return [{ point, index: idx + 1 }];
  });
  // Mobille aynı sıra: eserin sade özeti, yoksa tarihçe başı, o da yoksa admin'in varış noktası.
  const arrival = arrivalText(plan.end.workSlug, workPoints, plan.arrival);
  if (items.length === 0 && !arrival) return null;

  const row = (key: string, badge: ReactNode, title: string, body: string | undefined, leg: number) => (
    <li key={key}>
      <button
        type="button"
        aria-pressed={activeLeg === leg}
        onMouseEnter={() => onSelectLeg(leg)}
        onFocus={() => onSelectLeg(leg)}
        onClick={() => onSelectLeg(leg)}
        className="flex min-h-12 w-full items-start gap-3 rounded-lg px-2 py-3 text-left hover:bg-muted aria-pressed:bg-secondary aria-pressed:outline aria-pressed:outline-2 aria-pressed:outline-border"
      >
        {badge}
        <span className="grid flex-1 gap-1">
          <span className="font-semibold">{title}</span>
          {body ? <span className="text-sm text-muted-foreground">{excerpt(body)}</span> : null}
        </span>
      </button>
    </li>
  );

  return (
    <ul className="grid gap-1">
      <li><button type="button" className="min-h-12 min-w-12 rounded-lg px-3 text-sm font-semibold hover:bg-muted" aria-pressed={activeLeg === null} onClick={() => onSelectLeg(null)}>{t("route.allLegs")}</button></li>
      {items.map(({ point, index }) =>
        row(
          point.id,
          <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-highlight text-xs font-extrabold text-highlight-foreground" aria-label={`${t("route.via")} ${index}`}>
            {index}
          </span>,
          loc(point.title, lang),
          point.body ? loc(point.body, lang) : undefined,
          index - 1,
        ),
      )}
      {arrival
        ? row(
            "arrival",
            <MapPinCheckInside className="size-6 shrink-0 text-accent-text" aria-label={t("route.arrival")} />,
            loc(arrival.title, lang),
            arrival.body ? loc(arrival.body, lang) : undefined,
            plan.via.pointIds.length,
          )
        : null}
    </ul>
  );
}
