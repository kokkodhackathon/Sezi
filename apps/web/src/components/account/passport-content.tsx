"use client";

import {
  achievements,
  EMPTY_CONTRIBUTIONS,
  passportStats,
  type Achievement,
  type LocalizedText,
  type PassportStats,
  type PassportTour,
  type PassportWork,
  type Visit,
} from "@sezi/shared";
import { Footprints, Map as MapIcon, Route, Stamp as StampIcon } from "lucide-react";

import { EmptyInvite, EmptyPassportArt, StampGrid, StatStrip } from "@/components/account/social-visuals";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useT } from "@/lib/i18n-client";
import {
  getCities,
  getContributions,
  getTours,
  getVisits,
  getWorks,
} from "@/lib/social";
import { useAsync } from "@/lib/use-async";

export interface PassportData {
  works: PassportWork[];
  tours: PassportTour[];
  visits: Visit[];
  cities: { slug: string; name: LocalizedText }[];
  stats: PassportStats;
  list: Achievement[];
}

export function usePassportData(uid: string | undefined) {
  return useAsync(async () => {
    if (!uid) return null;
    const [works, tours, visits, contributions, cities] = await Promise.all([
      getWorks(),
      getTours(),
      getVisits(uid),
      getContributions(uid),
      getCities(),
    ]);
    return {
      works,
      tours,
      visits,
      cities,
      stats: passportStats(visits, works, tours),
      list: achievements({
        works,
        tours,
        visits,
        contributions: contributions ?? EMPTY_CONTRIBUTIONS,
      }),
    };
  }, [uid]);
}
/** Pasaport sayfası: sayı şeridi, damga ızgarası, ziyaret edilen illerin ilerlemesi. */
export function PassportContent({ data }: { data: PassportData }) {
  const { t, lang } = useT();
  const bySlug = new Map(data.works.map((work) => [work.slug, work]));
  const visited = data.stats.cities.filter((city) => city.visited > 0);
  return (
    <>
      <StatStrip
        items={[
          { icon: StampIcon, value: String(data.stats.stamps), label: t("stat.stamps") },
          { icon: MapIcon, value: String(visited.length), label: t("stat.cities") },
          {
            icon: Footprints,
            value: (data.stats.distanceM / 1000).toLocaleString(lang, { maximumFractionDigits: 1 }),
            label: t("stat.km"),
          },
          ...(data.stats.toursDone.length
            ? [{ icon: Route, value: String(data.stats.toursDone.length), label: t("stat.tours") }]
            : []),
        ]}
      />
      {data.stats.stamps ? (
        <section aria-labelledby="stamps-heading" className="grid gap-4">
          <h2 id="stamps-heading" className="font-heading text-lg font-bold">
            {t("passport.recent")}
          </h2>
          <StampGrid visits={data.visits} works={bySlug} />
        </section>
      ) : (
        <EmptyInvite
          art={<EmptyPassportArt />}
          text={t("passport.emptyInvite")}
          action={<p className="text-sm text-muted-foreground">{t("passport.webNote")}</p>}
        />
      )}
      {visited.length ? (
        <section aria-labelledby="cities-heading" className="grid gap-4">
          <h2 id="cities-heading" className="font-heading text-lg font-bold">
            {t("passport.cities")}
          </h2>
          {visited.map((city) => {
            const name = data.cities.find((item) => item.slug === city.slug)?.name;
            return (
              <ProgressBar
                key={city.slug}
                value={city.visited}
                max={city.total}
                label={name ? (name[lang] ?? name.tr) : city.slug}
              />
            );
          })}
        </section>
      ) : null}
    </>
  );
}
