"use client";

import {
  excerpt,
  formatDistance,
  loc,
  type GuidanceStep,
  type Hazard,
  type NavPoint,
  type PlannedRoute,
  type Turn,
} from "@sezi/shared";
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

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n-client";

function TurnIcon({ turn }: { turn: Turn }) {
  switch (turn) {
    case "straight":
      return <ArrowUp className="size-5 shrink-0" aria-hidden />;
    case "slight_left":
      return <ArrowUpLeft className="size-5 shrink-0" aria-hidden />;
    case "left":
      return <CornerUpLeft className="size-5 shrink-0" aria-hidden />;
    case "slight_right":
      return <ArrowUpRight className="size-5 shrink-0" aria-hidden />;
    case "right":
      return <CornerUpRight className="size-5 shrink-0" aria-hidden />;
    case "back":
      return <Undo2 className="size-5 shrink-0" aria-hidden />;
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

/** Adım adım yönlendirme listesi (`<ol>`): dönüş ikonu, talimat cümlesi, mesafe ve tehlike rozeti. */
export function StepList({ steps }: { steps: GuidanceStep[] }) {
  const { t, lang } = useT();

  return (
    <Card aria-labelledby="route-steps-heading">
      <CardHeader>
        <CardTitle id="route-steps-heading">{t("route.stepsTitle")}</CardTitle>
        <CardAction>
          <Badge variant="secondary" className="num">
            {t("route.stepsCount", { n: steps.length })}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col divide-y">
          {steps.map((step, i) => (
            <li key={`${step.nodeId}-${i}`} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                <TurnIcon turn={step.turn} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-base font-medium text-foreground">
                    <span className="num mr-1.5 font-bold text-muted-foreground">{i + 1}.</span>
                    {step.text}
                  </span>
                  <span className="num shrink-0 text-xs font-semibold text-muted-foreground">
                    {formatDistance(step.atM, lang)}
                  </span>
                </div>
                {step.hazard ? (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <Badge variant="warning">
                      <HazardIcon hazard={step.hazard} />
                      <span>{t(`route.hazard.${step.hazard}`)}</span>
                    </Badge>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

/** Rotanın uğradığı anlatım noktaları (rotadaki sırayla) ve varsa varış bilgisi kartı. */
export function RoutePointCards({
  plan,
  pointsById,
}: {
  plan: PlannedRoute;
  pointsById: Record<string, NavPoint>;
}) {
  const { t, lang } = useT();

  const viaItems = plan.via.pointIds.flatMap((id, idx) => {
    const point = pointsById[id];
    if (!point) return [];
    return [{ point, index: idx + 1, atM: plan.via.atM[idx] ?? 0 }];
  });

  if (viaItems.length === 0 && !plan.arrival) return null;

  return (
    <section aria-labelledby="route-points-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="route-points-heading" className="text-xl font-extrabold tracking-tight">
          {t("route.viaTitle")}
        </h2>
        {viaItems.length > 0 ? (
          <Badge variant="secondary" className="num">
            {plan.via.extraM > 0 ? t("route.viaExtra", { m: plan.via.extraM }) : t("route.viaOnWay")}
          </Badge>
        ) : null}
      </div>
      <div className="grid gap-3">
        {viaItems.map(({ point, index, atM }) => {
          const bodyText = point.body ? loc(point.body, lang) : "";
          return (
            <Card key={point.id} size="sm">
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <span
                    className="num inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-xs font-extrabold text-primary-foreground"
                    aria-hidden
                  >
                    {index}
                  </span>
                  <CardTitle className="text-base">{loc(point.title, lang)}</CardTitle>
                </div>
                <CardAction>
                  <span className="num text-xs font-semibold text-muted-foreground">{formatDistance(atM, lang)}</span>
                </CardAction>
              </CardHeader>
              {bodyText ? (
                <CardContent className="pt-0 text-sm text-muted-foreground">{excerpt(bodyText)}</CardContent>
              ) : null}
            </Card>
          );
        })}

        {plan.arrival ? (
          <Card size="sm" className="border-l-4 border-l-primary">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPinCheckInside className="size-5 shrink-0 text-link" aria-hidden />
                <CardTitle className="text-base">{loc(plan.arrival.title, lang)}</CardTitle>
              </div>
              <CardAction>
                <Badge variant="success">{t("route.arrivalTitle")}</Badge>
              </CardAction>
            </CardHeader>
            {plan.arrival.body ? (
              <CardContent className="pt-0 text-sm text-muted-foreground">
                {excerpt(loc(plan.arrival.body, lang))}
              </CardContent>
            ) : null}
          </Card>
        ) : null}
      </div>
    </section>
  );
}
