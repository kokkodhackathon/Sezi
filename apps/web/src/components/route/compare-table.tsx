"use client";

import { formatDistance, PROFILE_KEYS, type PlannedRoute, type ProfileKey } from "@sezi/shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppearance } from "@/lib/appearance";
import { useT } from "@/lib/i18n-client";
import { profileLine } from "@/lib/route-style";
import { cn } from "@/lib/utils";

export interface CompareRow {
  key: ProfileKey;
  plan: PlannedRoute | null;
  stats: { lengthM: number; stairs: number; busyM: number; cobbleM: number } | null;
  minutes: number;
}

/** Haritadaki profil çizgisinin küçük örneği: renk yanında kalınlık ve kesiklikle de ayırt edilir. */
function LineSwatch({ profileKey, highContrast }: { profileKey: ProfileKey; highContrast: boolean }) {
  const s = profileLine(profileKey, highContrast);
  const w = Math.min(s.width, 8);
  return (
    <svg width="40" height="12" viewBox="0 0 40 12" aria-hidden="true" className="shrink-0">
      <line
        x1="2"
        y1="6"
        x2="38"
        y2="6"
        stroke={s.color}
        strokeWidth={w}
        strokeLinecap={s.dash ? "butt" : "round"}
        strokeDasharray={s.dash ? s.dash.map((d) => d * w).join(" ") : undefined}
      />
    </svg>
  );
}

/** Dört profilin rotasını yan yana karşılaştıran tablo. */
export function CompareTable({
  rows,
  selectedKey,
  onSelect,
}: {
  rows: CompareRow[];
  selectedKey: ProfileKey | null;
  onSelect: (key: ProfileKey) => void;
}) {
  const { t, lang } = useT();
  const { contrast } = useAppearance();

  const lengths = rows.flatMap((r) => (r.stats ? [r.stats.lengthM] : []));
  const shortest = lengths.length > 0 ? Math.min(...lengths) : 0;

  return (
    <Card aria-labelledby="route-compare-heading">
      <CardHeader>
        <CardTitle id="route-compare-heading">{t("route.compareTitle")}</CardTitle>
        <CardDescription>{t("route.compareLead")}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b text-xs font-bold text-muted-foreground">
              <th scope="col" className="py-2.5 pr-3">
                {t("route.colProfile")}
              </th>
              <th scope="col" className="py-2.5 px-3">
                {t("route.colDistance")}
              </th>
              <th scope="col" className="py-2.5 px-3">
                {t("route.colDiff")}
              </th>
              <th scope="col" className="py-2.5 px-3">
                {t("route.colDuration")}
              </th>
              <th scope="col" className="py-2.5 px-3">
                {t("route.colStairs")}
              </th>
              <th scope="col" className="py-2.5 px-3">
                {t("route.colBusy")}
              </th>
              <th scope="col" className="py-2.5 px-3">
                {t("route.colWhy")}
              </th>
              <th scope="col" className="py-2.5 pl-3 text-right">
                <span className="sr-only">{t("route.selectProfile")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const sig = r.plan?.route.segmentIds.join(",") ?? "";
              const same = r.plan
                ? rows.find(
                    (o) =>
                      o !== r &&
                      o.plan &&
                      o.plan.route.segmentIds.join(",") === sig &&
                      PROFILE_KEYS.indexOf(o.key) < PROFILE_KEYS.indexOf(r.key),
                  )
                : undefined;
              const diff = r.stats ? Math.max(0, Math.round(r.stats.lengthM - shortest)) : 0;
              const isSelected = r.key === selectedKey;

              return (
                <tr
                  key={r.key}
                  data-profile={r.key}
                  aria-current={isSelected ? "true" : undefined}
                  className={cn("align-top", isSelected && "bg-highlight/50")}
                >
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      <LineSwatch profileKey={r.key} highContrast={contrast} />
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{t(`route.profile.${r.key}`)}</span>
                        <span className="text-xs text-muted-foreground">{t(`route.lineStyle.${r.key}`)}</span>
                      </div>
                    </div>
                  </td>

                  {r.plan && r.stats ? (
                    <>
                      <td className="num py-3 px-3 font-semibold whitespace-nowrap">
                        {formatDistance(r.stats.lengthM, lang)}
                      </td>
                      <td className="num py-3 px-3 whitespace-nowrap text-muted-foreground">
                        {diff === 0 ? t("route.shortest") : t("route.diffPlus", { m: diff })}
                      </td>
                      <td className="num py-3 px-3 whitespace-nowrap">{t("common.minutes", { n: r.minutes })}</td>
                      <td className="num py-3 px-3 font-semibold whitespace-nowrap">{r.stats.stairs}</td>
                      <td className="num py-3 px-3 whitespace-nowrap">
                        <div>{t("route.busyM", { m: r.stats.busyM })}</div>
                        <div className="text-xs text-muted-foreground">{t("route.cobbleM", { m: r.stats.cobbleM })}</div>
                      </td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">
                        {t(`route.why.${r.key}`)}
                        {same ? (
                          <span className="ml-1 font-semibold text-foreground">
                            {t("route.sameAs", { profile: t(`route.profile.${same.key}`) })}
                          </span>
                        ) : null}
                      </td>
                    </>
                  ) : (
                    <td colSpan={6} className="py-3 px-3 text-muted-foreground">
                      {t("route.compareNoRoute")}
                    </td>
                  )}

                  <td className="py-3 pl-3 text-right whitespace-nowrap">
                    <Button
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      aria-pressed={isSelected}
                      onClick={() => onSelect(r.key)}
                    >
                      {isSelected ? t("route.selectedProfile") : t("route.selectProfile")}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
